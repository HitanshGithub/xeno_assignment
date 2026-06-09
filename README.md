# Cadence

**An AI-native campaign co-pilot for consumer brands.**

> Describe the goal. Cadence finds the audience, writes the message, picks the
> channel, sends it, and tells you what actually worked.

Cadence is a mini CRM in the spirit of [Xeno](https://xeno.in) — built for a
D2C / retail marketer who wants to _reach the right shoppers_, not manage a
sales pipeline. You talk to it in plain language ("win back the lapsed weekly
latte drinkers"); it compiles that intent into a **transparent, auditable
audience**, drafts **per-channel personalised messages**, and runs the campaign
across a realistic, callback-driven delivery loop — then narrates the results.

This repo is a monorepo with two deployable services that talk over an
async, callback-driven loop — exactly how real channel delivery and engagement
tracking work.

```
cadence/
├─ apps/
│  ├─ web/           # Next.js — marketer UI + CRM API + AI brain (the product)
│  └─ channel-sim/   # Standalone service — the stubbed channel + delivery sim
├─ packages/
│  ├─ db/            # Prisma schema, client, realistic seed data
│  └─ shared/        # Zod contracts shared across the send ↔ receipt loop
└─ docker-compose.yml
```

## The bet (what I chose to build, and what I didn't)

The brief is deliberately open. My opinionated bet: **the hard, valuable part of
reaching shoppers is the decision — _who_ to talk to and _why_ — not the send
button.** So Cadence is built as an **AI co-pilot with a human-in-the-loop**:
the AI proposes the audience and the copy, but every decision is shown as
editable, reviewable structure (a rule tree, a live audience preview, draft
messages) before anything goes out. No black boxes.

I deliberately did **not** build: multi-tenant auth, a drag-and-drop journey
builder, real provider integrations, or a generic "chat with your data" toy.
See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full set of conscious
tradeoffs and scale assumptions.

## Status

🚧 Built in public, commit by commit. Setup, deploy, and architecture docs land
alongside the code they describe. Start with [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## License

MIT — see [`LICENSE`](./LICENSE).
