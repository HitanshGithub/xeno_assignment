# Deploying Cadence

Two services + one database. The CRM/web app goes to **Vercel**, the channel
simulator to **Render**, and Postgres to **Neon** — all have free tiers. They
reference each other by URL + a shared secret, so there's a small two-pass wiring
step at the end.

> Prefer one box? `docker compose up --build` runs all three locally or on any
> Docker host — see the [README](./README.md#run-it-locally). This guide is the
> managed-cloud path.

---

## 0. Secrets

Generate two shared secrets once and keep them handy — they must be **identical**
on both services:

```bash
openssl rand -hex 32   # → CHANNEL_SERVICE_API_KEY
openssl rand -hex 32   # → CHANNEL_CALLBACK_SECRET
```

## 1. Database — Neon

1. Create a project at [neon.tech](https://neon.tech). Copy the **pooled**
   connection string (host contains `-pooler`).
2. From your machine, push the schema and load the demo dataset:

   ```bash
   DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require" npm run db:push
   DATABASE_URL="postgresql://…-pooler…/neondb?sslmode=require" npm run db:seed
   ```

   This creates the tables and seeds Brew & Bean (480 customers, ~13k orders).

## 2. Channel service — Render

1. **New → Blueprint**, point it at this repo. Render reads [`render.yaml`](./render.yaml)
   and provisions the `cadence-channel` web service (it injects `PORT`; the
   service honours it).
2. Set its three `sync:false` env vars:
   - `CHANNEL_SERVICE_API_KEY`, `CHANNEL_CALLBACK_SECRET` — the secrets from step 0.
   - `CRM_BASE_URL` — leave blank for now; you'll set it in step 4.
3. Note the service URL, e.g. `https://cadence-channel.onrender.com`.

> Free Render services sleep when idle and cold-start in ~30–60s. For a smooth
> demo, open the channel's `/health` once to wake it before sending, or use a
> paid instance.

## 3. CRM / web — Vercel

1. **Import** this repo. Set **Root Directory** to `apps/web`
   ([`apps/web/vercel.json`](./apps/web/vercel.json) handles the monorepo install
   - Prisma generate).
2. Environment variables:

   | Key                       | Value                                              |
   | ------------------------- | -------------------------------------------------- |
   | `DATABASE_URL`            | your Neon pooled string                            |
   | `CHANNEL_SERVICE_URL`     | the Render channel URL (step 2)                    |
   | `CHANNEL_SERVICE_API_KEY` | secret from step 0                                 |
   | `CHANNEL_CALLBACK_SECRET` | secret from step 0                                 |
   | `AI_PROVIDER`             | `auto`                                             |
   | `ANTHROPIC_API_KEY`       | your key (optional — omit to run the free mock AI) |
   | `CRM_BASE_URL`            | set after the first deploy (step 4)                |

3. Deploy. Vercel gives you a URL, e.g. `https://cadence.vercel.app`.

## 4. Wire the loop closed

The channel needs to know where to post receipts, and the CRM needs to know its
own public URL for the callback address:

1. In **Vercel**, set `CRM_BASE_URL` = your Vercel URL → redeploy.
2. In **Render**, set `CRM_BASE_URL` = your Vercel URL → redeploy.

Open the Vercel URL, go to **Co-pilot**, describe a goal, and launch — the funnel
on the campaign page fills as the channel posts signed receipts back. ✅

---

## Verifying

- `GET https://<vercel-url>/api/health` → `{ "status": "ok", "db": "up", "ai": "…" }`
- `GET https://<render-url>/health` → `{ "status": "ok" }`
- `GET https://<render-url>/stats` → live send/receipt/retry counters.

## Notes & gotchas

- **AI key is optional.** With none set, `AI_PROVIDER=auto` falls back to the
  deterministic mock and the whole product still works.
- **Secrets must match** across Vercel and Render or receipts return `401` and
  the funnel never advances.
- **Re-seeding** wipes data (`db:seed` deletes first). Run it once.
