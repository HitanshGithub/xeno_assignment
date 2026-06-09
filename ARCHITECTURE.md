# Architecture

This document is the map of the system and, more importantly, the **record of
the tradeoffs I made on purpose**. The brief asks for reasoning over a perfect
architecture, so each decision below is paired with "what I'd do at real scale."

> This doc evolves with the code. Sections fill in as their phase lands.

---

## 1. The shape of the system

Cadence is **two services** connected by an **asynchronous, callback-driven
loop** — the loop is the point of the exercise, so it's modelled as honestly as
a stub can be.

```
        ┌──────────────────────────────────────────────┐
        │                  apps/web                      │
        │     Next.js — UI + CRM API + AI brain          │
        │                                                │
        │  ┌────────┐  ┌────────────┐  ┌──────────────┐  │
        │  │  UI    │  │ CRM domain │  │  AI co-pilot │  │
        │  │ (React)│→ │  services  │← │ (Claude/mock)│  │
        │  └────────┘  └─────┬──────┘  └──────────────┘  │
        │                    │  Postgres (Prisma)        │
        └────────────────────┼───────────────────────────┘
                  (1) POST /v1/send        ▲
                  recipient,msg,channel    │ (2) POST /api/receipts
                             │             │  delivered/opened/read/clicked…
                             ▼             │  (HMAC-signed, async, retried)
        ┌────────────────────────────────────────────────┐
        │               apps/channel-sim                  │
        │   Stubbed channel — does NOT deliver anything.   │
        │   Enqueues → simulates a per-channel lifecycle   │
        │   state machine → emits receipts back to the CRM │
        └────────────────────────────────────────────────┘
```

**Why two services and not one process pretending?** The whole value of the
exercise is the seam between "I asked to send" and "here's what happened,"
which in reality is a network hop you don't control: it's slow, out-of-order,
lossy, and bursty. Putting a real HTTP + signed-callback boundary there forces
the CRM to deal with eventual, unordered, at-least-once truth — which is the
interesting system-design problem.

**Why the UI + CRM API live together (and only the channel is split out).**
The split that matters for this brief is delivery, not presentation. Co-locating
the React UI with the CRM API (Next.js route handlers over a clean,
framework-agnostic domain layer in `apps/web/src/server`) keeps one deployable
for the product and avoids a pointless BFF hop, while the domain layer stays
portable enough to lift into its own service later.

---

## 2. The delivery loop (the core)

Two HTTP hops, authenticated differently because they have different trust
needs:

```
 CRM ──POST /v1/send──────────────▶ channel-sim     (Bearer token)
        batch of messages              accept/reject synchronously,
                                        then simulate each lifecycle async
 CRM ◀─POST /api/receipts──────────── channel-sim     (HMAC-SHA256 of body)
        one event per call             delivered/opened/read/clicked/
        idempotent on eventId          converted/failed/bounced/unsubscribed
```

The contract (`@cadence/shared`):

- **Send is fire-and-forget.** The CRM writes `Communication` rows as `QUEUED`,
  hands the batch to the channel, records the returned `providerMessageId`s, and
  returns `202`. The marketer never waits on delivery. A replayed batch is a
  no-op (idempotency key per message).
- **Receipts are the asynchronous truth** — delivered **at least once**, often
  **out of order**. The CRM treats each as an event: dedup on `eventId`, append
  to the log, then advance the cached `status` **monotonically** (a late
  `DELIVERED` after a `CLICKED` changes nothing). See
  [`lifecycle.ts`](./packages/shared/src/lifecycle.ts).
- **The channel is built to misbehave** — it reorders (independent timers),
  duplicates (`CHANNEL_DUPLICATE_RATE`), hard-fails a share, and retries failed
  callbacks with exponential backoff before dead-lettering — because a stub that
  always succeeds proves nothing about the CRM.

**Why a `RetryQueue` and not just `await fetch`.** The receipt hop is wrapped in
a bounded-concurrency queue with backoff + a dead-letter sink
([`queue.ts`](./apps/channel-sim/src/queue.ts)). It's the in-process stand-in
for SQS / Redis Streams, kept behind a small interface so the production swap is
mechanical. The CRM side is symmetric: receipts land on an append-only log first
(durable), and the status projection is derived — so even a crash mid-ingest
can't corrupt state.

This loop is verified end-to-end (signed receipts, idempotent resend, injected
duplicates, 401 on bad auth) — see the channel-sim smoke path.

---

## 3. Data model

Postgres via Prisma. Full schema: [`packages/db/prisma/schema.prisma`](./packages/db/prisma/schema.prisma).

```
Brand (singleton, grounds the AI's tone/products)

Customer ──< Order ──< OrderItem
   │            │
   │            └─ attributedCommunicationId ─┐  (which message drove this order)
   │                                          │
   └──< Communication >── Campaign >── Segment │
            │   ▲              (rule-tree definition: Json)
            │   └─────────────────────────────┘
            └──< CommunicationEvent   (append-only receipt log)
```

Three deliberate modelling choices a reviewer should know:

1. **Customer rollups are denormalised.** `orderCount`, `lifetimeValueCents`,
   `firstOrderAt`, `lastOrderAt`, `avgOrderValueCents` are maintained on order
   ingestion. Segment evaluation then becomes a single indexed scan over
   `Customer` instead of a per-customer aggregate over `Order` — the right
   trade for a read-heavy segmentation workload. The cost (write-time upkeep,
   possible drift) is bounded because ingestion is the only writer.

2. **`Communication.status` is a projection, not the truth.** The truth is the
   append-only `CommunicationEvent` log. Status (+ the per-stage timestamps) is
   a cached read model advanced **monotonically** so a late `delivered` can't
   overwrite an existing `clicked`. This is what lets the receipt loop be
   out-of-order and at-least-once without corrupting state.

3. **Money is integer minor units** (`*Cents`, paise) with `currency`
   alongside — no floats in the data layer. Segments are stored as a **rule
   tree (`Json`)**, not raw SQL, so the AI's output is inspectable, editable,
   and safe to compile.

The seed (`packages/db/prisma/seed.ts`) is deterministic and persona-driven —
loyal regulars, VIPs, lapsed weekly drinkers, new shoppers, one-and-done, and
churned — so segmentation demos are reproducible and actually have signal.

---

## 4. The AI layer

AI is woven in at the **decision points**, never as a chat gimmick. One
interface, [`CadenceAi`](./apps/web/src/server/ai/types.ts), exposes four skills:

1. **intent → audience** (`compileSegment`) — natural language becomes an
   editable rule tree the marketer can see and tweak before it runs.
2. **message drafting** (`draftMessage`) — per-channel, personalised copy using
   only the allow-listed placeholders.
3. **performance narrative** (`summarizePerformance`) — a plain-language read of
   the funnel a marketer can act on.
4. **the co-pilot** (`planCampaign`) — a single goal → a complete, reviewable
   campaign (audience + channel + message). This is the agentic surface.

Two implementations back the interface and are chosen at runtime: an
**Anthropic** provider (Sonnet for reasoning, Haiku for cheap drafting — a
conscious cost/latency split) and a **deterministic mock** so the product runs,
and demos, with zero API keys.

Three design choices that matter:

- **The model can't invent fields.** The shared field catalogue is injected into
  the prompt; the model is constrained to fields and operators that actually
  exist and compile.
- **Output is forced into a typed shape, then re-validated.** The Anthropic
  provider uses a single-tool `tool_choice` whose `input_schema` is derived from
  a zod schema, and validates the model's tool input back through that same
  schema — so a model reply that doesn't fit is a caught error, not a runtime
  surprise. (Tool-use over the structured-output helper sidesteps a zod major-
  version coupling, and lets the rule tree stay expressive.)
- **AI proposes; the human disposes.** Every AI output is rendered as editable
  structure (rule tree, draft, channel) before anything is sent. No black box.

---

## 5. Scale assumptions & conscious tradeoffs

The honest framing: **this is built for a single brand, low-thousands of
customers, demo-scale throughput** — and engineered so the seams that would
break at real scale are visible and swappable rather than hidden.

| Concern | What I did for this scope | What I'd do at real scale |
| --- | --- | --- |
| Delivery queue | In-process queue with retry/backoff + idempotency, behind an interface | SQS / Redis Streams / Kafka with the same idempotency contract |
| Receipt ingestion | HTTP endpoint writing an append-only event log | Webhook → queue → batch writer; partition by communication id |
| Segment evaluation | Compile rule tree → SQL, evaluate on demand | Materialised audiences + incremental recompute on data change |
| DB | Single Postgres (Neon) | Read replicas; events to a columnar store for analytics |
| AI calls | Synchronous per request | Cached + batched; async for bulk drafting |

The guiding principle: **make the expensive, lossy, asynchronous parts explicit
in the design even at small scale**, so the reasoning is legible.
