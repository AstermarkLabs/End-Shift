# CLAUDE.md

## Workflow Rules

- Multi-step task/goal spanning sessions: write/update handoff doc (`HANDOFF.md` root, or `HANDOFF-<name>.md`). Cover goal, done so far, next steps, open decisions, gotchas hit. Update before ending session or on context reset. Read first when resuming known multi-step work.
- API contract generated: `lib/api-spec/openapi.yaml` is source of truth. Never edit `generated/` — change `openapi.yaml`, re-run `pnpm --filter @workspace/api-spec run codegen`.
- DB schema changes ship as committed SQL migrations, not runtime `drizzle-kit push`. After editing `lib/db/src/schema/`:
  1. `pnpm --filter @workspace/db run generate` — writes SQL to `lib/db/migrations/`
  2. Commit generated SQL alongside schema change — reviewable, source of truth for prod.
  api-server applies pending migrations on startup (`runMigrations()` in `artifacts/api-server/src/index.ts`). `build.mjs` copies migrations into `dist/` — never chain `drizzle-kit push` into container `CMD`.
  Pre-existing DBs built with `push` need one-time baseline (`pnpm --filter @workspace/db run baseline`) — no `drizzle.__drizzle_migrations` journal, migrator would replay `0000` and crash. Idempotent, refuses on empty DB. Empty DBs need no baseline.
  `push`/`push-force` OK for throwaway local experiments only — anything shipped goes through `generate`.

## Conventions Not Enforced by Tooling

- Dep versions live in `pnpm-workspace.yaml` `catalog:` — update catalog, not individual `package.json` files.

## Architecture Decisions

- Web token storage intentional: access token in memory only; refresh token + profile in `sessionStorage`. Security decision — treat web origin as equivalent to holding those tokens. Don't migrate to `localStorage`.
- Tenant scoping: `tenantId=null` = system user; `tenantId` set + `orgUnitId=null` = tenant-wide; both set = org-unit subtree. All queries must respect this or leak cross-tenant data.
- `strictFunctionTypes: false` intentional. Artifacts typecheck via own `tsc -p`.

## Runtime Gotchas

- Zod import paths don't mix: api-server routes import `"zod/v4"`; generated `lib/api-zod` uses plain `"zod"`. Mixing both in one file breaks at runtime.
- `lib/api-client-react/src/custom-fetch.ts` has non-obvious behavior, read before editing:
  - Uses `referrer` (double-r) not `Referer` — React Native XHR blocks standard spelling
  - RN body check is `response.body === null` — RN reports `undefined` even when data present
  - 401→refresh guard uses `_refreshInFlight` to prevent re-entrancy deadlock if refresh request itself 401s
- `artifacts/api-server/build.mjs` bundles to single ESM file. Packages with native binaries need adding to `external` list or bundle fails.

## graphify

Knowledge graph at graphify-out/ — god nodes, community structure, cross-file relationships.

- Codebase questions: run `graphify query "<question>"` first when graphify-out/graph.json exists. `graphify path "<A>" "<B>"` for relationships, `graphify explain "<concept>"` for focused concepts. Scoped subgraph, smaller than GRAPH_REPORT.md or raw grep.
- graphify-out/wiki/index.md exists: use for broad navigation over raw source browsing.
- graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain don't surface enough.
- After modifying code: `graphify update .` to keep graph current (AST-only, no API cost).
