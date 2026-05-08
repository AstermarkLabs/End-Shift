# Threat Model

## Project Overview

This repository is a small pnpm monorepo containing two production-relevant surfaces: an Express API server and an Expo checklist application that can be deployed as a static build behind a lightweight Node.js server. Shared libraries provide generated API clients, Zod schemas, and optional PostgreSQL access via Drizzle. The mockup sandbox artifact is a development-only environment and is out of scope unless production reachability is demonstrated.

Under the deployment assumptions for this scan, production traffic is protected in transit by platform-managed TLS, `NODE_ENV` is `production`, and mockup sandbox code is not deployed.

## Assets

- **Application availability** — the checklist web server and API must remain responsive to valid and invalid internet traffic. A remotely triggerable crash is a meaningful security issue even if little data is stored.
- **Operational checklist data** — checklists, task completion state, and shift history are stored client-side in the Expo app. While not highly sensitive like payment data, they still describe internal store operations and should not be exposed unintentionally.
- **Environment secrets and infrastructure access** — `DATABASE_URL` and any future API credentials or auth tokens must remain server-side and never leak to clients or logs.
- **Shared API and schema contracts** — generated client/server contracts define trust boundaries for request validation. If they are bypassed or misused, future endpoints may accept unsafe input.

## Trust Boundaries

- **Browser/mobile client to server** — all requests to the Express API and the Expo static server cross from an untrusted client into server-side code. Request headers, URLs, and bodies must be treated as attacker-controlled.
- **Server to file system** — the Expo static server maps URL paths to local files inside `static-build/`. Path handling must prevent traversal and must not crash on malformed input.
- **Server to database** — shared DB code can connect directly to PostgreSQL when used by production code. Any future queries must remain parameterized and access-controlled.
- **Public to internal/dev surfaces** — `artifacts/mockup-sandbox/**` and build-time scripts are considered dev-only and should normally be ignored during production scans unless code paths prove otherwise.

## Scan Anchors

- Production entry points: `artifacts/api-server/src/index.ts`, `artifacts/checklist/server/serve.js`, `artifacts/checklist/app/**`
- Highest-risk code areas: `artifacts/checklist/server/serve.js`, any future files under `artifacts/api-server/src/routes/**`, and shared network helpers in `lib/api-client-react/**`
- Public surfaces: `GET /api/healthz` and the checklist static server routes (`/`, `/manifest`, static assets)
- Dev-only areas to usually ignore: `artifacts/mockup-sandbox/**`, `artifacts/checklist/scripts/build.js`

## Threat Categories

### Tampering

The main tampering risk in this project is unsafe use of attacker-controlled HTTP input at the static server boundary. URL paths, request headers, and any future API payloads must be validated before they affect filesystem access, HTML generation, or control flow. The system must guarantee that client-controlled input cannot alter files outside the intended static build root and cannot inject unsanitized values into server-generated responses.

### Information Disclosure

Current data exposure risk is modest because the API surface is minimal and the checklist app stores most data locally. Even so, server logs and API responses must not reveal secrets, auth material, or internal stack traces, and any future database-backed endpoints must return only the minimum necessary fields. Client-side persisted checklist history should be treated as potentially sensitive operational data rather than harmless demo content.

### Denial of Service

Availability is one of the most relevant security properties for this codebase. Public endpoints must handle malformed requests safely without throwing uncaught exceptions, consuming unbounded resources, or blocking on attacker-controlled input. In particular, the static Expo server must tolerate hostile header values and malformed paths because it is directly exposed to untrusted internet traffic.

### Elevation of Privilege

There is no meaningful role model or authenticated surface in the current production code, so classic privilege-escalation concerns are limited today. However, any future protected API routes must enforce authentication and authorization server-side rather than relying on the mobile client or generated API helpers. Shared DB access and custom fetch helpers should be treated as sensitive building blocks for future privileged operations.