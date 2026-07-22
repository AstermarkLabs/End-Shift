/**
 * End-Shift checklist app driver.
 *
 * Usage (from repo root or artifacts/checklist/):
 *   node .claude/skills/run-checklist/driver.mjs [--port 8099] [--viewport mobile|desktop] [--out /tmp/ss]
 *
 * What it does:
 *   1. Starts the Expo web dev server on PORT (default 8099)
 *   2. Opens the app in headless Chromium via Playwright
 *   3. Injects local-no-auth state so the app bypasses the login screen
 *      (no API or database required)
 *   4. Takes screenshots of: login, main tabs (mobile + desktop), settings
 *   5. Kills the dev server and exits
 *
 * Screenshots land in OUT_DIR (default /tmp/end-shift-screenshots/).
 *
 * Environment:
 *   PLAYWRIGHT_ROOT  path to global playwright install
 *                    defaults to $(npm root -g) i.e. ~/.nvm/versions/node/<v>/lib/node_modules
 *   CHROME_BIN       path to Chrome/Chromium binary (default: /bin/google-chrome)
 */

import { execSync, spawn } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';

// ── Config ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const PORT     = args[args.indexOf('--port') + 1]    ?? '8099';
const VIEWPORT = args[args.indexOf('--viewport') + 1]?? 'mobile';
const OUT_DIR  = args[args.indexOf('--out') + 1]     ?? '/tmp/end-shift-screenshots';

const CHROME   = process.env.CHROME_BIN ?? '/bin/google-chrome';
const PW_ROOT  = process.env.PLAYWRIGHT_ROOT
  ?? execSync('npm root -g', { encoding: 'utf8' }).trim();
const PW_PATH  = resolve(PW_ROOT, 'playwright');

// ── Playwright bootstrap ────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
if (!existsSync(PW_PATH)) {
  console.error(`playwright not found at ${PW_PATH} — run: npm install -g playwright`);
  process.exit(1);
}
const { chromium } = require(PW_PATH);

mkdirSync(OUT_DIR, { recursive: true });

// ── Dev-server helpers ──────────────────────────────────────────────────────────
// driver lives at: artifacts/checklist/.claude/skills/run-checklist/driver.mjs
// → go up 4 path components to reach artifacts/checklist/
const BASE = resolve(new URL(import.meta.url).pathname, '../../../..');

function startServer(port) {
  const server = spawn('pnpm', ['exec', 'expo', 'start', '--web', `--port`, port, '--no-dev'], {
    cwd: BASE,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});
  return server;
}

async function waitForServer(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Dev server on port ${port} did not become ready within ${timeoutMs}ms`);
}

// ── Inject local-no-auth state ──────────────────────────────────────────────────
async function injectNoAuthState(page) {
  await page.evaluate(() => {
    localStorage.setItem('@end_shift_storage_mode', 'local-no-auth');
    localStorage.setItem('@end_shift_onboarding', JSON.stringify({
      completed: true,
      accountKind: 'personal',
      businessType: 'single-unit',
      regions: [],
      locations: [{ id: 'loc1', name: 'Test Location', regionId: null }],
      teamMembers: [],
      settings: { showRegionsStep: true, showLocationsStep: true, showTeamStep: true },
    }));
    localStorage.setItem('@end_shift_app_config', JSON.stringify({
      appName: 'End Shift', primaryColor: '#C8102E', appIcon: null,
    }));
  });
}

// ── Main ────────────────────────────────────────────────────────────────────────
const server = startServer(PORT);
let exitCode = 0;

try {
  console.log(`Starting Expo web server on port ${PORT}…`);
  await waitForServer(PORT);
  console.log('Server ready. Waiting 3s for initial bundle…');
  await new Promise(r => setTimeout(r, 3000));

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const vp = VIEWPORT === 'desktop'
    ? { width: 1280, height: 800 }
    : { width: 390, height: 844 };

  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. Login screen (before inject)
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 45_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT_DIR}/01-login.png`, fullPage: true });
  console.log(`01-login.png  [${page.url()}]`);

  // 2. Inject no-auth state and reload
  await injectNoAuthState(page);
  await page.reload({ waitUntil: 'load', timeout: 20_000 });
  await page.waitForTimeout(2500);

  // 3. Click "Back to personal account" to enter the app
  await page.locator('text=Back to personal account').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT_DIR}/02-main-tabs.png`, fullPage: true });
  console.log(`02-main-tabs.png  [${page.url()}]`);

  // 4. Settings screen
  await page.goto(`http://localhost:${PORT}/settings`, { waitUntil: 'load', timeout: 10_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT_DIR}/03-settings.png`, fullPage: true });
  console.log(`03-settings.png  [${page.url()}]`);

  // 5. Profile screen (no-auth → renders null body; tests routing/layout only)
  await page.goto(`http://localhost:${PORT}/profile`, { waitUntil: 'load', timeout: 10_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT_DIR}/04-profile.png`, fullPage: true });
  console.log(`04-profile.png  [${page.url()}]`);

  if (errors.length) {
    console.warn('Console errors detected:', errors.slice(0, 5).join('\n'));
  } else {
    console.log('No console errors.');
  }

  await browser.close();
} catch (err) {
  console.error('Driver failed:', err.message);
  exitCode = 1;
} finally {
  server.kill();
  process.exit(exitCode);
}
