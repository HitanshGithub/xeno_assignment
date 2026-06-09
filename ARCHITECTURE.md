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

_Fills in with Phase 3._ Design contract:

- **Send** is fire-and-forget from the CRM's perspective. It writes a
  `Communication` row in `QUEUED`, then hands off to the channel service and
  returns. The marketer never waits on delivery.
- **Receipts** arrive asynchronously, **out of order**, and **at least once**.
  The CRM treats them as an event stream: each receipt is idempotent (dedup key)
  and applied as a **monotonic state transition** so a late `delivered` can
  never clobber an already-recorded `clicked`.
- **The channel is allowed to misbehave** — it drops, delays, reorders, and
  occasionally hard-fails — because a stub that always succeeds teaches the CRM
  nothing.

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

_Fills in with Phase 5._ AI is woven in at three decision points, never as a
chat gimmick: (a) **intent → audience** — natural language compiled into an
editable rule tree; (b) **message drafting** — per-channel, personalised,
grounded in real customer fields; (c) **insights** — a narrative read of the
performance stats. A pluggable provider interface backs all three, with a
deterministic mock so the product runs with zero API keys.

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
