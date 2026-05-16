# End Shift

A mobile app for managing end-of-shift closing checklists, with multiple named checklists, required/optional tasks, shift history, and team-friendly task tracking.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Auth env (optional, have sensible dev defaults):
  - `JWT_SECRET`, `JWT_REFRESH_SECRET` — sign access/refresh tokens (required in production)
  - `WEBAUTHN_RP_ID` — domain used as WebAuthn relying party ID (default: `localhost`)
  - `WEBAUTHN_ORIGIN` — expected web origin (default: `http://localhost`)
  - `WEBAUTHN_RP_NAME` — display name shown in passkey dialogs (default: `End Shift`)
- Native passkey env (required for fingerprint/Face ID on Android & iOS):
  - `WEBAUTHN_ANDROID_SHA256` — app signing cert SHA-256 fingerprint, colon-separated hex (e.g. `AA:BB:CC:…`); find it in Play Console → App Integrity, or run `keytool -list -v -keystore release.jks`
  - `WEBAUTHN_ANDROID_PACKAGE` — Android package name matching `app.json` android.package (e.g. `com.endshift.app`)
  - `WEBAUTHN_IOS_TEAM_ID` — 10-character Apple Team ID from developer.apple.com
  - `WEBAUTHN_IOS_BUNDLE_ID` — iOS bundle identifier matching `app.json` ios.bundleIdentifier (e.g. `com.endshift.app`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- **DB schema** — `lib/db/src/schema/auth.ts` (tables: tenants, org_units, roles, users, passkey_credentials, refresh_tokens)
- **API contract** — `lib/api-spec/openapi.yaml` (source of truth; codegen writes to `lib/api-zod/` and `lib/api-client/`)
- **API routes** — `artifacts/api-server/src/routes/` (auth, profiles, roles, org-units, onboarding)
- **Tenant scoping utility** — `artifacts/api-server/src/lib/tenant-scope.ts` (recursive CTE subtree query)

## Architecture decisions

- **Tenant isolation via DB columns** — Every `user` and `role` row carries a `tenantId` foreign key. All profile/role queries filter by this before returning data. System Admin (isSystem=true) is the only bypass.
- **Org hierarchy as a self-referencing tree** — `org_units` has a nullable `parentId` referencing itself. Region → District → Location. Subtree visibility is resolved with a Postgres recursive CTE (`WITH RECURSIVE subtree AS …`), so the entire visible set is one round-trip regardless of depth.
- **Three visibility scopes**: (1) `role.isSystem = true` → global, (2) `tenantId` set + `orgUnitId = null` → tenant-wide (owner/admin), (3) `tenantId` + `orgUnitId` set → org-unit subtree only.
- **Per-tenant Admin role at registration** — Self-registration creates a `tenants` row and a tenant-scoped "Admin" role (level 950, all rights). Rights like `manage_profiles` are now safe because all queries are tenant-scoped.
- **`manage_org_units` right** — Dedicated right controlling who can create/edit/delete org units. Separate from `manage_profiles` to allow finer-grained delegation.

## Product

- Multi-tenant SaaS: each registered business is a fully isolated tenant
- Hierarchical org structure (Region → District → Location) within a tenant
- Role-based access with tenant-scoped roles; users are optionally pinned to an org unit
- Admins manage their org tree via `/api/org-units`; assign users to units via `orgUnitId` on profile create/update
- Visibility is enforced server-side: org-scoped users only see peers within their subtree

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
