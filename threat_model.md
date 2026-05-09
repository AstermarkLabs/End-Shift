# Threat Model

## Project Overview

This repository is a pnpm monorepo for End Shift, a checklist application with a production Express API server and an Expo-based checklist client that can run as mobile apps and as a web/static deployment. The production backend uses PostgreSQL via Drizzle, password-based login, refresh/access JWTs, WebAuthn passkeys, and role-based access control for user and role administration.

Under the deployment assumptions for this scan, production traffic is protected in transit by platform-managed TLS, `NODE_ENV` is `production`, and `artifacts/mockup-sandbox/**` is not deployed unless production reachability is explicitly demonstrated.

## Assets

- **Administrative accounts and role configuration** — the API exposes profile and role management operations. Compromise of an administrative account allows creation, deletion, promotion, and deactivation of other users.
- **Authentication material** — passwords, passkey credentials, access tokens, refresh tokens, and JWT signing secrets protect all authenticated API access. Theft or forgery of these values would let an attacker impersonate users.
- **Operational checklist data** — checklist content, task completion state, and shift history are business data for store operations. Even if not highly regulated, they should not be exposed or tampered with by unauthorized parties.
- **Application availability** — the checklist web server and API must remain responsive to hostile and malformed public traffic. Public auth and static-serving routes are reachable from the internet.
- **Environment secrets and infrastructure access** — `DATABASE_URL`, JWT secrets, and WebAuthn environment configuration must remain server-side and must never leak through client bundles, logs, or error responses.

## Trust Boundaries

- **Client to API boundary** — browser and mobile clients send attacker-controlled headers, paths, and JSON bodies to `/api/auth/**`, `/api/profiles/**`, and `/api/roles/**`. The server must authenticate, authorize, and validate every request.
- **API to database boundary** — the API server reads and mutates users, roles, and passkey credentials in PostgreSQL. Broken access control or unsafe queries at the API layer directly impact the auth database.
- **Client to static checklist server boundary** — the checklist web server handles untrusted URL paths and request headers for `/`, `/manifest`, `/.well-known/*`, and static assets under `static-build/`.
- **Browser storage boundary** — on web, auth state crosses from server responses into browser `localStorage`; on native, it crosses into `expo-secure-store`. Script execution on the web origin must be treated as equivalent to token access.
- **Public to admin boundary** — login, token refresh, passkey auth, and health routes are public, while profile and role administration are authenticated and often require elevated rights. That distinction must be enforced on the server, not in the Expo client.
- **Public to internal/dev boundary** — `artifacts/mockup-sandbox/**` and build scripts are development-only and should usually be ignored during production scans unless code paths prove they are reachable in deployment.

## Scan Anchors

- Production entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/checklist/server/serve.js`, `artifacts/checklist/app/_layout.tsx`, `artifacts/checklist/context/AuthContext.tsx`
- Highest-risk code areas: `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/routes/profiles.ts`, `artifacts/api-server/src/routes/roles.ts`, `artifacts/api-server/src/middlewares/auth.ts`, `artifacts/api-server/src/lib/seed.ts`, `artifacts/checklist/server/serve.js`
- Public surfaces: `GET /api/healthz`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/passkey/auth-options`, `POST /api/auth/passkey/auth-verify`, checklist landing-page and manifest routes
- Privileged surfaces: `POST /api/auth/passkey/register-*`, `GET/PUT /api/profiles/me`, all `/api/profiles/**` admin paths, all `/api/roles/**`
- Dev-only areas to usually ignore: `artifacts/mockup-sandbox/**`, `artifacts/checklist/scripts/build.js`

## Threat Categories

### Spoofing

This project now has meaningful authentication surfaces. The system must ensure that only callers with valid passwords, passkeys, or signed tokens can assume a user identity, and that bootstrap paths do not create predictable credentials in production. JWT signing secrets must be strong and production-only; refresh and access tokens must not be forgeable or indefinitely reusable after logout or credential rotation.

### Tampering

The most important tampering risks are unsafe acceptance of client-controlled role, profile, and password changes, plus improper handling of untrusted headers and paths at the checklist server boundary. The API must enforce role and profile mutation rules server-side with checks that match the intended rights model, and the checklist server must prevent hostile request input from altering generated responses or accessing files outside the static root.

### Information Disclosure

The biggest disclosure risks are leakage of tokens, secrets, or operational data through client-side storage, same-origin script execution, logs, or overly broad API responses. Web tokens should be treated as highly sensitive because any script running in the app origin can read them when stored in `localStorage`. Error responses and logs must avoid exposing stack traces, secrets, or unnecessary auth state.

### Denial of Service

Availability is important for both the API and the checklist web server. Public endpoints must tolerate malformed URLs, malformed JSON, hostile headers, repeated auth attempts, and missing configuration without crashing or exhausting resources. The server should especially avoid unbounded work on unauthenticated routes such as login, refresh, passkey auth, landing-page rendering, and static file handling.

### Elevation of Privilege

Elevation of privilege is a primary risk in this codebase because the API implements roles, rights, and user administration. All protected routes must enforce authorization on the server, and profile or role operations must not let a caller gain rights through self-service updates, inconsistent hierarchy checks, or assumptions that the client has already enforced restrictions. Shared DB and token-handling code should be treated as security-critical because flaws there can undermine every privileged endpoint.