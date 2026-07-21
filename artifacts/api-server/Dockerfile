# syntax=docker/dockerfile:1
#
# Build context MUST be the repo root (pnpm workspace), not this directory.
# Railway service settings: Root Directory = repo root, Dockerfile Path = artifacts/api-server/Dockerfile
# (already wired via railway.json at the repo root).

FROM node:24-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build

# esbuild produces a single self-contained dist/index.mjs (see build.mjs) —
# the runtime image needs no node_modules, only the Node runtime + ocrmypdf.
# build.mjs also copies lib/db/migrations into dist/migrations; the server
# applies them on startup via drizzle-orm's migrator (see src/index.ts), so
# drizzle-kit is never needed at runtime and migrations never prompt on a
# non-TTY container.
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ocrmypdf ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
