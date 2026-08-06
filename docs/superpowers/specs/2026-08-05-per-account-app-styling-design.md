# Per-Account App Styling Scoping

## Problem

`AppConfig` (name, primaryColor, icon, custom icon, export layout settings) is loaded
from and persisted to a single global AsyncStorage key (`@end_shift_app_config`) in
`artifacts/checklist/context/ChecklistContext.tsx`. It is not scoped by account.

Result: if a user logs into a business account and sets/receives a primary color, then
logs out and into a personal account (or local/no-auth mode) on the same device, the
business styling bleeds through — `appConfig` state is never reloaded or reset on
account switch.

## Goal

Each distinct account context on a device keeps its own `AppConfig`:
- Business account → styling scoped to that business (tenant).
- Personal account → styling scoped to that individual user.
- Local/no-auth mode → styling scoped to a fixed local bucket.

Switching between these on the same device shows the correct styling for whichever
account is now active, without carrying over the previous account's config.

## Non-goals

- No server-side sync of `AppConfig` across devices. Today `AppConfig` is local-only
  (no API calls read/write it); this change preserves that — it only fixes local
  scoping. Cross-device shared business branding would require an API contract
  change (new endpoint / schema field) and is out of scope here — flag for
  `native-dev` if wanted later.
- No change to `ProfileAccountType`, tenant scoping on the server, or any other
  local-storage keys (`KEY_ACTIVE`, `KEY_ACTIVE_SHIFTS`, etc.) — those already behave
  per-session correctly and aren't part of this bug.

## Design

### Scope key

Add a helper, e.g. in `ChecklistContext.tsx`:

```ts
function getAppConfigScopeKey(
  profile: Profile | null,
  noAuthMode: boolean,
): string {
  if (noAuthMode || !profile) return "local";
  if (profile.accountType === ProfileAccountType.BUSINESS && profile.tenantId != null) {
    return `tenant:${profile.tenantId}`;
  }
  return `user:${profile.id}`;
}
```

Storage key becomes `` `@end_shift_app_config:${scopeKey}` `` (was the fixed
`KEY_APP_CONFIG`).

### Load / reload behavior

Currently `appConfig` is loaded once in the mount-time `init()` effect from the fixed
key. This must become:

1. Compute `scopeKey` from `profile` + `noAuthMode` (both already available via
   `useAuth()` in `ChecklistProvider`).
2. On mount, and whenever `scopeKey` changes (login, logout, switching accounts),
   read `` `@end_shift_app_config:${scopeKey}` `` from AsyncStorage and set
   `appConfig` to the stored value merged over `DEFAULT_APP_CONFIG`, or to
   `DEFAULT_APP_CONFIG` if nothing is stored yet for that scope.
3. This reload must replace in-memory `appConfig` state — not merge with whatever
   the previous account had in memory — so no stale fields leak across accounts.

### Persist behavior

The existing persist effect (writes `appConfig` on change) switches to writing under
the current scope key instead of the fixed key. Guard so it doesn't fire during the
reload-on-scope-change (same `loaded.current` pattern already used for the initial
load) to avoid writing a stale config back over a different scope's stored value.

### `updateAppConfig`

No signature/behavior change — it still just merges partial updates into state; the
persist effect (now scope-aware) handles writing it out.

### Existing tenant-name override

The existing line:

```ts
appConfig:
  profile?.accountType === ProfileAccountType.BUSINESS && profile?.tenantName
    ? { ...appConfig, name: profile.tenantName }
    : appConfig,
```

is unaffected — it already recomputes per profile on every render and stays correct
once the underlying scoped `appConfig` state is right.

## Migration

Existing users currently have one config under the old fixed key
(`@end_shift_app_config`). No migration is performed — new scoped keys simply start
from `DEFAULT_APP_CONFIG` the first time each scope is seen. The old key is left in
place (harmless orphan) rather than adding migration complexity for a cosmetic
setting; acceptable given this is device-local styling, not user data.

## Testing

- Manual: log into a business account, change primary color, log out, log into a
  different (personal) account — confirm default/personal styling shows, not the
  business color.
- Manual: log back into the same business account — confirm its color persisted.
- Manual: no-auth/local mode — confirm it has its own independent bucket.
- `pnpm --filter checklist typecheck` (or equivalent workspace filter) after the
  change.
