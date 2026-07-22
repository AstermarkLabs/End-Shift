---
name: run-checklist
description: Build, run, screenshot, and drive the End-Shift checklist Expo app. Use when asked to start the checklist app, take a screenshot, run it locally, verify a UI change, or interact with the running web build.
---

End-Shift checklist is an Expo Router app. For headless driving an agent uses `driver.mjs` (Playwright + Google Chrome) against the Expo web dev server. No database or API server is required for local-no-auth mode, which covers all frontend-only UI work.

All paths below are relative to `artifacts/checklist/`.

## Prerequisites

```bash
# Google Chrome (used as the Playwright browser — already installed on this machine)
which /bin/google-chrome   # must exist

# Global Playwright (install once, stays in npm global)
npm install -g playwright  # installs to $(npm root -g)/playwright
```

Node 24 via nvm is already active. `pnpm` is required (workspace root enforces it).

## Run (agent path)

The driver starts the dev server, injects local-no-auth state, navigates through the app, captures screenshots, and exits cleanly.

```bash
# From artifacts/checklist/:
node .claude/skills/run-checklist/driver.mjs [--port 8099] [--viewport mobile|desktop] [--out /tmp/my-screenshots]
```

Screenshots land in `--out` (default `/tmp/end-shift-screenshots/`):

| File | Screen |
|---|---|
| `01-login.png` | Login screen (before auth bypass) |
| `02-main-tabs.png` | Shift Reports dashboard (main tabs) |
| `03-settings.png` | App Settings modal |
| `04-profile.png` | Profile route (blank in no-auth mode — needs cloud auth) |

**Desktop viewport** (`--viewport desktop`) renders at 1280×800 and captures the web layout.

Environment overrides:
```bash
CHROME_BIN=/usr/bin/chromium    # alternate Chrome path
PLAYWRIGHT_ROOT=/custom/path    # alternate npm global root
```

## Run (human path)

```bash
pnpm exec expo start --web --port 8099 --no-dev
# Open http://localhost:8099 in a browser
```

## Local-no-auth bypass

The auth redirect fires before AsyncStorage hydrates, so the app always lands on `/login` first. The bypass sequence (built into the driver):

1. Load the app once (to get the bundle ready).
2. Inject into `localStorage`:
   - `@end_shift_storage_mode` = `"local-no-auth"`
   - `@end_shift_onboarding` = JSON with `completed: true`
3. Reload.
4. Click **"Back to personal account"** (visible once `noAuthMode` is true in `AuthContext`).
5. App lands at `/reports` — the full tab shell is accessible.

## Profile screen (requires cloud auth)

`profile.tsx` returns `null` immediately when there is no `profile` context value. Testing the profile UI requires a logged-in cloud session (the database lives on Replit, not locally). To test profile changes:

1. Deploy to Replit (or run the full stack with `DATABASE_URL`).
2. Sign in via the login screen.
3. Navigate to Settings → "Profile & Passkeys".

## Gotchas

- **`--no-dev` flag**: Without it, Metro starts in development mode and triggers an interactive terminal prompt — the server never becomes ready in a headless context. Always pass `--no-dev`.
- **`waitUntil: 'networkidle'` times out**: Expo's bundler holds open long-poll connections. Use `waitUntil: 'load'` + explicit `waitForTimeout` instead.
- **Cold-start bundle delay**: The HTTP 200 from Metro arrives before the JS bundle is compiled. The driver waits 3s after `waitForServer` to give the bundler time to finish. If screenshots come out blank, increase this delay.
- **Playwright location**: Playwright is installed globally (`npm install -g playwright`), not in the project. The driver resolves it via `$(npm root -g)/playwright`. If it's missing, run `npm install -g playwright` — no browser download needed since `google-chrome` is used directly.
- **Port conflicts**: If port 8099 is already in use, the driver fails immediately. Kill the old server with `pkill -f "expo start"` first.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Dev server did not become ready within 60000ms` | The Metro bundler hung. Check `/tmp/expo-web.log`. Run `pnpm exec expo start --web --port 8099 --no-dev` manually to see the error. |
| `page.goto: Timeout 45000ms exceeded` | Bundle is taking too long on first compile. Increase `waitForTimeout(3000)` to `waitForTimeout(8000)` in the driver. |
| `playwright not found at …` | Run `npm install -g playwright` then retry. |
| Profile page blank | Expected in no-auth mode. Needs cloud auth — see section above. |
| `Back to personal account` link not found | `noAuthMode` didn't hydrate. Check that `localStorage.setItem('@end_shift_storage_mode', 'local-no-auth')` was called before `page.reload()`. |
