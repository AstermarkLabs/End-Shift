// Ephemeral in-memory store for passkey authentication challenges issued for
// usernameless flows.  Each challenge is single-use and expires after a short
// TTL.  Sufficient for a single-process API server; persist to a DB table if
// running multiple instances.

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  expiresAt: number;
}

const store = new Map<string, Entry>();

function sweep(now: number): void {
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
}

export function rememberChallenge(challenge: string): void {
  const now = Date.now();
  sweep(now);
  store.set(challenge, { expiresAt: now + TTL_MS });
}

export function consumeChallenge(challenge: string): boolean {
  const now = Date.now();
  sweep(now);
  const entry = store.get(challenge);
  if (!entry) return false;
  store.delete(challenge);
  return entry.expiresAt > now;
}
