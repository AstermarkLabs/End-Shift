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

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
