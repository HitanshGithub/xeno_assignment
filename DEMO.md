# Walkthrough script (~5–6 min)

A beat-by-beat script for the narrated video. Times are targets, not rules.

---

## 0 · Product intro — ~30s

> "This is **Cadence** — an AI-native mini CRM for reaching shoppers, built for
> a fictional coffee chain, Brew & Bean. My bet: the hard part of reaching
> shoppers isn't the send button, it's the **decision** — who to talk to and
> why. So Cadence is an AI co-pilot with a human always in the loop. It proposes
> the audience, the channel, and the message; the marketer reviews editable
> structure — never a black box — and ships."

## 1 · Functional demo — ~1.5 min

Open the live URL. Start on the **Dashboard** (stats, recent campaigns).

1. **Co-pilot.** Type a goal: *"Win back lapsed weekly drinkers with a cold-brew
   offer."* Hit generate.
   > "From one line, Cadence compiles an **audience** — and crucially shows it as
   > editable rules plus a live preview of exactly who's in. It picks a
   > **channel** with a reason, and drafts a **personalised message**. I can edit
   > any of it, or redraft the copy."
2. Click **Launch**.
   > "It snapshots one communication per recipient and hands the batch to a
   > **separate channel service**."
3. On the **campaign page**, watch the **funnel fill live** — sent → delivered →
   read → clicked → converted — as the channel posts results back.
   > "These updates are real: a second service is simulating delivery and
   > calling back asynchronously."
4. Click **Read the results**.
   > "And the AI reads the funnel back in plain language — what worked, and what
   > to do next."

Quickly show **Segments** (the plain-language compiler) and **Customers** (the
seeded base).

## 2 · Technical architecture — ~1 min

Show the diagram in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

> "Two services across an **async, callback-driven loop** — the core of the
> brief. The CRM fires a batch and returns; the channel simulates each message's
> lifecycle on its own timers and posts **HMAC-signed receipts** back, out of
> order and at-least-once. The CRM treats receipts as an **append-only event
> log** and projects status forward **monotonically**, so a late 'delivered'
> never clobbers a 'clicked', and duplicates are no-ops. The channel is
> deliberately built to misbehave — reorder, duplicate, fail, retry — because a
> stub that always succeeds proves nothing."

Mention the conscious trade: in-process retry queue now, SQS/Redis Streams at
scale, behind the same interface.

## 3 · Code walkthrough — ~1 min

- [`packages/shared`](./packages/shared) — the typed contracts both services and
  the AI agree on, including the **segment rule-tree** and the **field
  catalogue**.
- [`apps/web/src/server/segments/compiler.ts`](./apps/web/src/server/segments/compiler.ts)
  — the rule tree → parameterised Prisma query (no injection, composes with
  count/preview).
- [`apps/web/src/server/receipts/ingest.ts`](./apps/web/src/server/receipts/ingest.ts)
  — idempotent ingestion + the monotonic projection + attribution.
- [`apps/channel-sim/src`](./apps/channel-sim/src) — the lifecycle state machine
  and the `RetryQueue`.

## 4 · AI-native workflow — ~1 min

- In the product: [`apps/web/src/server/ai`](./apps/web/src/server/ai) — one
  `CadenceAi` interface, two providers (Anthropic + a deterministic mock). The
  model is **grounded in the shared field catalogue** so it can't invent a field,
  and forced into a **typed shape via tool-use**, then re-validated with zod.
- In the build: I worked AI-natively too — directing an agent through tight,
  verifiable phases (commit-by-commit), reviewing and integrating each piece,
  and verifying every layer end-to-end (the channel loop, the segment compiler
  against hand-written SQL, the full HTTP flow) before moving on.

> "Closing thought: a working deployed product is the floor. Where Cadence tries
> to stand out is the **opinionated scope** — co-pilot, not chatbot — the
> **honest two-service loop**, and **AI woven into the decisions**, not bolted on."
