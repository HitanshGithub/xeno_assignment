# channel-sim

The **stubbed channel service** — a separate process that pretends to be
WhatsApp / SMS / Email / RCS. It never delivers anything; it _simulates_ what
would happen and reports back to the CRM asynchronously.

## Why it's a separate service

The valuable seam in this product is the gap between "I asked to send" and
"here's what happened." That gap is a network hop you don't control: slow,
out-of-order, lossy, bursty. Making it a real HTTP boundary (with signed
callbacks) forces the CRM to deal with eventual, unordered, at-least-once truth
— which is the system-design problem worth showing.

## The loop

```
CRM  ──POST /v1/send (Bearer auth, batch)──▶  channel-sim
                                               │  validate → accept/reject
                                               │  enqueue async lifecycle
CRM  ◀─POST /api/receipts (HMAC-signed)──────  │  setTimeout per event
        delivered / opened / read / clicked /  │  retry+backoff on failure
        converted / failed / bounced / unsub   ▼
```

## What it models on purpose

| Reality | How it's simulated |
| --- | --- |
| Per-channel behaviour | Email reports OPENED, WhatsApp/RCS report READ, SMS neither; different delivery/click/convert rates |
| Bursty volume | A campaign launch is one batch of up to 5,000 messages |
| Async, delayed engagement | Each event fires on its own timer (compressed by `CHANNEL_SPEED` for demos) |
| Out-of-order receipts | Independent timers + retry jitter mean later events can land first |
| At-least-once delivery | `CHANNEL_DUPLICATE_RATE` re-sends some receipts (same `eventId`) |
| Lossy network | Receipt POSTs that fail are retried with exponential backoff, then dead-lettered |
| Idempotent sends | A replayed batch returns the original result, never re-sends |
| Hard failures | A share of messages FAIL / BOUNCE and terminate the lifecycle |
| Attribution source | A converting click emits CONVERTED carrying a fabricated order |

## Endpoints

- `POST /v1/send` — accept a batch (Bearer `CHANNEL_SERVICE_API_KEY`). Returns
  `202` with per-message `ACCEPTED` / `REJECTED`.
- `POST` callbacks to the CRM's receipt URL, signed with `CHANNEL_CALLBACK_SECRET`.
- `GET /health` — liveness.
- `GET /stats` — accepted/rejected, receipts delivered, duplicates injected,
  and live retry-queue metrics (depth, retries, dead-letters).

## Run

```bash
npm run dev -w @cadence/channel-sim     # tsx watch, port 4000
```

Config (all optional, sensible defaults): `CHANNEL_PORT`, `CHANNEL_SPEED`,
`CHANNEL_DUPLICATE_RATE`, `CHANNEL_SERVICE_API_KEY`, `CHANNEL_CALLBACK_SECRET`,
`CHANNEL_CALLBACK_*` (retry policy). See [`.env.example`](../../.env.example).
