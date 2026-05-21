# CLAUDE.md

## Workspace

pnpm monorepo (Node.js 24, TypeScript 5.9). `pnpm` enforced — `preinstall` rejects npm/yarn.

Packages:
- `artifacts/api-server` — Express API (`@workspace/api-server`)
- `artifacts/checklist` — Expo Router app, iOS/Android/web (`@workspace/checklist`)
- `artifacts/mockup-sandbox` — Vite+React dev playground, **not deployed**
- `lib/db` — Drizzle ORM + Postgres (`@workspace/db`)
- `lib/api-spec` — OpenAPI spec + Orval codegen config (`@workspace/api-spec`)
- `lib/api-client-react` — Generated TanStack Query hooks (`@workspace/api-client-react`)
- `lib/api-zod` — Generated Zod validators (`@workspace/api-zod`)

**Dep versions live in `pnpm-workspace.yaml` `catalog:` — update the catalog, not individual `package.json` files.**

## Rules

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

### DB schema — push manually on local dev

Replit auto-applies schema via post-merge hook; local dev does not. After pulling changes that touch `lib/db/src/schema/`, run `pnpm --filter @workspace/db run push`.

### esbuild external list

`artifacts/api-server/build.mjs` bundles to a single ESM file. When adding packages with native binaries, add them to the `external` list or the bundle will fail.

### TypeScript

Root `tsconfig.json` only project-references libs — artifacts typecheck via their own `tsc -p`. `strictFunctionTypes: false` is intentional. No test runner is configured.
