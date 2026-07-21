# CLAUDE.md

## Workspace

**Dep versions live in `pnpm-workspace.yaml` `catalog:` — update the catalog, not individual `package.json` files.**

## Rules

### Handoff docs for multi-step work

Multi-step task or goal spanning several sessions: write/update a handoff doc (`HANDOFF.md` in repo root, or task-specific `HANDOFF-<name>.md`) covering: goal, done so far, next steps, open decisions, gotchas hit. Update it before ending session or when context resets. Read it first thing when resuming known multi-step work.

### API contract is generated

`lib/api-spec/openapi.yaml` is source of truth. **Never edit files under `generated/`** — change `openapi.yaml` and re-run codegen (`pnpm --filter @workspace/api-spec run codegen`).

### Zod import paths — don't mix

api-server routes import from `"zod/v4"`. Generated `lib/api-zod` uses plain `"zod"`. Mixing both paths in one file breaks at runtime.

### custom-fetch.ts has non-obvious behavior

`lib/api-client-react/src/custom-fetch.ts` — read before editing:
- Uses `referrer` (double-r) not `Referer` — React Native's XHR blocks the standard spelling
- React Native body check is `response.body === null` — RN reports `undefined` even when data is present
- 401→refresh guard uses `_refreshInFlight` to prevent re-entrancy deadlock if the refresh request itself 401s

### Web token storage is intentional

Web: access token in memory only; refresh token + profile in `sessionStorage`. Security decision — treat the web origin as equivalent to holding those tokens. Don't migrate to `localStorage`.

### Tenant scoping model

`tenantId=null` → system user; `tenantId` set + `orgUnitId=null` → tenant-wide; both set → org-unit subtree. All queries must respect this or they leak cross-tenant data.

### DB schema — generated migrations, not `push`

Schema changes ship as **committed SQL migrations**, not runtime `drizzle-kit push`.

After editing `lib/db/src/schema/`:
1. `pnpm --filter @workspace/db run generate` — writes SQL to `lib/db/migrations/`
2. Commit the generated SQL alongside the schema change. It is reviewable and is the source of truth for what production applies.

The api-server applies pending migrations on startup via drizzle-orm's migrator (`runMigrations()` in `artifacts/api-server/src/index.ts`). `build.mjs` copies `lib/db/migrations` into `dist/`, so the runtime image needs no drizzle-kit and never prompts on a non-TTY container. Do not chain `drizzle-kit push` into a container `CMD`.

**Pre-existing DBs built with `push` must be baselined once** — they have the tables but no `drizzle.__drizzle_migrations` journal, so the migrator would replay `0000` and crash with `relation "..." already exists`:

```
pnpm --filter @workspace/db run baseline
```

Records existing migrations as applied without running their SQL. Idempotent, and refuses to run against an empty database. Empty DBs need no baseline — just start the server.

`push` / `push-force` still exist for throwaway local experiments, but anything that ships must go through `generate`. Using `push` on a DB you intend to keep will drift it from the migration history.

### esbuild external list

`artifacts/api-server/build.mjs` bundles to a single ESM file. When adding packages with native binaries, add them to the `external` list or the bundle will fail.

### TypeScript

Artifacts typecheck via their own `tsc -p`. `strictFunctionTypes: false` is intentional.
