# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace shape

pnpm monorepo (Node.js 24, TypeScript 5.9). `pnpm` is enforced — `preinstall` rejects npm/yarn.

Packages (`pnpm-workspace.yaml`):
- `artifacts/api-server` — Express 5 API, `@workspace/api-server`. Entry: `src/index.ts` → `app.ts` → `routes/index.ts`. Built with esbuild to a single ESM bundle in `dist/`.
- `artifacts/checklist` — Expo Router app (`@workspace/checklist`). Runs on iOS / Android / web (static build served by `server/serve.js`).
- `artifacts/mockup-sandbox` — Vite + React design playground (`@workspace/mockup-sandbox`). Dev-only; do not assume it is deployed.
- `lib/db` — Drizzle ORM + Postgres pool (`@workspace/db`). Exports both connection (`db`, `pool`) and schema from `src/index.ts`.
- `lib/api-spec` — OpenAPI spec + Orval codegen config (`@workspace/api-spec`).
- `lib/api-client-react` — Generated react-query hooks + `customFetch` (`@workspace/api-client-react`).
- `lib/api-zod` — Generated Zod schemas (`@workspace/api-zod`).
- `scripts` — Misc workspace scripts (`@workspace/scripts`).

Versions for shared deps live in `pnpm-workspace.yaml` under `catalog:` — packages reference them as `"react": "catalog:"`, etc. Update the catalog, not individual `package.json` files.

## Common commands

Run from repo root unless noted:

```bash
# Typecheck everything (libs as a project-reference build, then per-artifact tsc)
pnpm run typecheck

# Build everything (typecheck + each package's build)
pnpm run build

# API server (port comes from $PORT env)
pnpm --filter @workspace/api-server run dev      # build + start
pnpm --filter @workspace/api-server run typecheck

# Expo / checklist app
pnpm --filter @workspace/checklist run dev        # expo start (uses Replit env vars)
pnpm --filter @workspace/checklist run build      # static web build
pnpm --filter @workspace/checklist run serve      # serve static-build via server/serve.js

# Mockup sandbox (Vite)
pnpm --filter @workspace/mockup-sandbox run dev

# DB schema push (dev only — drizzle-kit, no migration files)
pnpm --filter @workspace/db run push
pnpm --filter @workspace/db run push-force        # destructive; use with care

# Regenerate api-client-react + api-zod from lib/api-spec/openapi.yaml
pnpm --filter @workspace/api-spec run codegen
```

Single-package typecheck: `pnpm --filter <name> run typecheck`. There is no test runner configured.

## Architecture

### API contract is generated, not hand-written

`lib/api-spec/openapi.yaml` is the source of truth for the HTTP API. Orval generates two outputs from it:
- `lib/api-client-react/src/generated/` — TanStack Query hooks + types
- `lib/api-zod/src/generated/` — request/response Zod validators

The api-server consumes the Zod package to validate requests; the checklist app consumes the react-query package. **Never edit files under `generated/`** — change `openapi.yaml` and re-run `pnpm --filter @workspace/api-spec run codegen`. Codegen also runs `typecheck:libs` at the end so downstream type errors surface immediately.

Orval is configured (`lib/api-spec/orval.config.ts`) with `coerce` for booleans/numbers/strings in query/param and `bigint`/`date` in bodies/responses, plus `useDates: true` and `useBigInt: true`.

### Custom fetch is non-trivial — read before editing

`lib/api-client-react/src/custom-fetch.ts` is the mutator Orval injects into every generated hook. It implements:
- Base URL prepending (for native bundles pointing at a remote server) — `setBaseUrl`
- Bearer token injection via `setAuthTokenGetter` (web should rely on cookies instead)
- Transparent 401 → refresh → retry-once via `setAuthRefreshHandler`, guarded by `_refreshInFlight` to prevent re-entrancy deadlock when the refresh request itself 401s
- Replit reverse-proxy workarounds: forces `x-requested-with: XMLHttpRequest` and synthesizes a `referrer` header (note the double-r spelling — React Native's XHR forbids setting `Referer`/`Origin`, but `referrer` slips through)
- React Native body detection: uses strict `response.body === null` because RN always reports `body === undefined` even when the payload is present

### API server

`artifacts/api-server/src/app.ts` mounts `pino-http`, `cors()`, JSON/urlencoded parsers, then the router from `routes/index.ts` under `/api`. Routes: `health`, `auth`, `profiles`, `roles`, `onboarding`, `org-units`, `checklists`, `shifts`.

`index.ts` does two things before `app.listen` (default port 5000):
1. `verifySchema()` — runs a `SELECT COUNT(*)` against `information_schema.tables` to confirm `users`, `roles`, `refresh_tokens` exist. Missing tables abort startup with a message pointing at `pnpm --filter @workspace/db run push`.
2. `seedAuth()` — bootstraps roles/admin user. Errors are logged but non-fatal.

Auth + tenancy model (see `lib/db/src/schema/auth.ts`):
- `tenants` (one row per registered business) + `org_units` (self-referencing tree: region → district → location) + `roles` (with `level`, `isSystem`, `rights[]`) + `users` + `passkey_credentials` + `refresh_tokens`
- User scoping: `tenantId=null` → system; `tenantId` set + `orgUnitId=null` → tenant-wide; both set → org-unit subtree only
- Rights enum: `manage_profiles`, `assign_roles`, `manage_roles`, `create_checklists`, `manage_org_units`
- Self-registration creates a `tenants` row and a tenant-scoped Admin role (level 950, all rights)
- WebAuthn: `@simplewebauthn/server` on the API, `@simplewebauthn/browser` + `react-native-passkeys` on the client
- Access tokens are short-lived JWTs; refresh tokens are persisted by `tokenId` in `refresh_tokens` so they can be revoked

Checklist data model (see `lib/db/src/schema/checklist.ts`):
- `checklists` (owned by a location org unit) + `checklist_tasks` (sections + sort order) + `shift_logs` / `shift_task_completions` — all tenant-scoped

Tenant visibility is enforced by `artifacts/api-server/src/lib/tenant-scope.ts`, which resolves the visible org-unit subtree in a single Postgres recursive CTE. Auth middleware exports: `requireAuth`, `blockIfMustChangePassword`, `requireRight(right)`, `requireAnyRight(...rights)`.

Build (`artifacts/api-server/build.mjs`): esbuild bundles to ESM with a banner that re-installs CommonJS globals (`require`, `__filename`, `__dirname`) so bundled CJS packages (e.g. Express) keep working. `esbuild-plugin-pino` carves pino transports into separate files. The `external` list is intentionally broad — extend it when adding native-dep packages.

### Checklist app (Expo Router)

`artifacts/checklist/app/_layout.tsx` is the root. Providers nest as: `SafeAreaProvider` → `ErrorBoundary` → `QueryClientProvider` → `GestureHandlerRootView` → `KeyboardProvider` → `ChecklistProvider` → `OnboardingProvider` → `AuthProvider` → `Stack`. `useAuthRedirect()` runs inside the Stack and gates routes.

Routes are file-based: `(tabs)` for the main shell (checklist index + reports/dashboard), modals for `profile`, `admin`, `settings`, `checklist-settings`, `history`, plus `login`, `onboarding`, and `+not-found`.

Auth state lives in `context/AuthContext.tsx`. On native the access/refresh tokens go to `expo-secure-store`; on web the access token is kept **in memory only** and the refresh token + profile go to `sessionStorage` (scoped to the tab, not shared across windows — treat the web origin as security-equivalent to those tokens — see `threat_model.md`).

Checklist data (`ChecklistContext`) is backed by the API via `@workspace/api-client-react` hooks (`listChecklists`, `openShift`, `submitShift`, `completeShiftTask`, etc.). Local app config (name, primaryColor, icon) and onboarding state still live in `AsyncStorage`. `CompletedChecklist` history shapes are kept for backward-compat but shift history now comes from the API.

Onboarding flow (`context/OnboardingContext.tsx`, `app/onboarding.tsx`): persisted in AsyncStorage under `@end_shift_onboarding`. Captures business type (`single-unit` | `multi-unit`), org hierarchy (regions → districts → locations), and team members. `OnboardingSettings` flags control which steps are shown. `useAuthRedirect` in `AuthContext` gates all tabs behind `onboardingCompleted`.

Dashboard (`app/(tabs)/reports.tsx`): reads `CompletedChecklist` history from `ChecklistContext` and renders analytics — KPI cards, donut breakdown, trend chart, and missed-steps ranking. Components live in `components/dashboard/`; utility functions in `components/dashboard/dashUtils.ts`. `utils/mockData.ts` exports `generateMockHistory` for dev/demo seeding. Theme colors come from `hooks/useColors.ts` (derives palette from `AppConfig.primaryColor`). The app uses the Inter font family (`@expo-google-fonts/inter`).

Web/static deployment: `scripts/build.js` produces `static-build/`, and `server/serve.js` is a **zero-dependency Node http server** that serves it. It has two special routes — `GET /` or `/manifest` with an `expo-platform` header returns the platform manifest JSON; without it, `/` returns the landing page (template at `server/templates/landing-page.html`). All other paths fall through to static file serving from `static-build/`.

### TypeScript layout

`tsconfig.base.json` sets `customConditions: ["workspace"]`, `moduleResolution: bundler`, strict-but-with-`strictFunctionTypes: false`. The root `tsconfig.json` only project-references the three libs (`lib/db`, `lib/api-client-react`, `lib/api-zod`); artifacts and scripts are typechecked separately via their own `tsc -p`. That's why `pnpm run typecheck` runs `tsc --build` for libs and `pnpm -r run typecheck` for the rest.

## Operational notes

- **Required env**: `DATABASE_URL` (Postgres). Production also requires `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. WebAuthn dev defaults to `localhost` — native passkeys need `WEBAUTHN_ANDROID_SHA256`/`WEBAUTHN_ANDROID_PACKAGE`/`WEBAUTHN_IOS_TEAM_ID`/`WEBAUTHN_IOS_BUNDLE_ID` (full list in `replit.md`). Set `EXPO_PUBLIC_DOMAIN` on the Expo side when deploying native or EAS-hosted web so `custom-fetch.ts` prepends the correct base URL; omit it on Replit-hosted web builds (falls back to relative URLs).
- **Replit hooks**: `scripts/post-merge.sh` (wired via `.replit` `[postMerge]`) runs `pnpm install --frozen-lockfile` then `pnpm --filter db push` after every merge — so DB schema drift is auto-applied on Replit but **not locally**; remember to `push` manually when pulling schema changes.
- **pnpm catalog policy**: `minimumReleaseAge: 1440` (24 h) blocks brand-new releases; `@replit/*` and `stripe-replit-sync` are exempt. Many native binary subpackages are explicitly excluded (`'-'`) to keep the lockfile portable.
- **Threat model**: `threat_model.md` is the authoritative scope doc — `artifacts/mockup-sandbox/**` is dev-only and out of scope unless production reachability is demonstrated. Highest-risk areas: `artifacts/api-server/src/routes/{auth,profiles,roles,checklists,shifts,org-units}.ts`, `middlewares/auth.ts`, `lib/seed.ts`, and `artifacts/checklist/server/serve.js`.
