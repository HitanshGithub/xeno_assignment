# One image, run twice: the CRM web app and the channel simulator are the same
# monorepo, so we build a single image and start different workspaces from it
# (see docker-compose.yml). Keeps local/self-host to one `docker compose up`.
FROM node:20-slim AS base
WORKDIR /app
# Prisma needs openssl present at runtime on Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# --- deps: install with only the manifests for cache-friendly layers --------
# The lockfile is intentionally NOT copied: it was generated on Windows, and npm
# skips cross-platform optional native deps (lightningcss/SWC) when installing
# from a foreign-OS lockfile. Resolving fresh in-container fetches the correct
# Linux binaries. (Vercel handles Next's native deps itself; the channel service
# has no native deps — so this only matters for the self-host image.)
COPY package.json tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/channel-sim/package.json apps/channel-sim/
RUN npm install --no-audit --no-fund

# --- source + build ---------------------------------------------------------
COPY . .
# Generate the Prisma client and build the Next app. No DB connection needed
# for either step. A placeholder DATABASE_URL keeps any tooling happy.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npm run db:generate && npm run build -w @cadence/web

EXPOSE 3000 4000
# Default command runs the web app; the channel service overrides it in compose.
CMD ["npm", "run", "start", "-w", "@cadence/web"]
