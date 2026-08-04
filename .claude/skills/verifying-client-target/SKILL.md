---
name: verifying-client-target
description: Use when debugging an error that names an "expected X, got Y" mismatch — auth origin rejected, CORS blocked, token issuer/audience mismatch, WebAuthn/passkey origin errors, unexpected 401/403 — in an app whose backend URL is client-configured (EXPO_PUBLIC_*, NEXT_PUBLIC_*, VITE_*, API_URL, .env). Use before editing any server-side allowlist, CORS config, or origin/issuer validation code.
---

# Verifying Client Target

## Overview

An "expected X, got Y" error names the SERVER's config. It says nothing about which backend the CLIENT actually reached. The server config is frequently already correct — the client is silently pointed at the wrong deployment (prod instead of local, staging instead of prod, a stale build). Checking the client's actual target config is a 10-second read; skipping it can burn an hour adjusting server env vars that were never the problem.

## When to Use

- Auth/CORS/CSRF error naming an expected origin/issuer/audience that doesn't match what you expect
- WebAuthn/passkey "unexpected registration response origin" errors
- 401/403 that "should" work given the server config you're looking at
- About to edit a server-side allowlist, RP ID, CORS origin list, or JWT issuer check to fix a mismatch

## Core Pattern

1. **Find and read the client's runtime target config FIRST** — before touching server code. `.env`, `EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`, `VITE_*`, any `API_URL`/`API_BASE`/`*_DOMAIN` var. Actually `cat` the file. Don't recall from memory ("I set that to localhost earlier") — it drifts, especially after a prod-testing session.
2. **Compare that value against the error's "expected" value.** If they don't line up with the environment you *think* you're testing, that mismatch is the bug. Stop investigating server config — fix the client target instead.
3. Only once the client target is confirmed to match the environment you intend to test, move on to server-side config (allowlists, RP ID, CORS origins, issuer checks).
4. If you edit the client's target config, restart the dev server/bundler before retesting. Build-time env vars (`EXPO_PUBLIC_*`, `NEXT_PUBLIC_*`, `VITE_*`) get baked into the bundle — a stale bundle keeps showing the old value even after the `.env` file is fixed.

The error message tells you what the server believes is correct. It does not tell you what backend the client reached — a leftover `.env` value, a proxy, or a stale build can redirect it silently. Verify that by reading the client's own config, not by reasoning about the server in isolation.

## Common Mistakes

- Adjusting server-side env vars/allowlists that were already correct because nobody checked which deployment the client was actually hitting.
- Trusting memory of what an env var is set to instead of `cat`-ing it right now.
- Treating "expected X" in an error as proof the server is misconfigured, when it usually just means the client and the environment you're reasoning about have diverged.

## Real-World Impact

End-Shift passkey debug session: burned several turns adjusting a Railway env var (`WEBAUTHN_ANDROID_SHA256`) for a WebAuthn "expected origin http://localhost" error before discovering `EXPO_PUBLIC_DOMAIN` in the mobile app's `.env` pointed at the Railway prod deployment instead of localhost. Server config was correct the entire time.
