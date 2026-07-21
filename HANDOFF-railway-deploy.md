# HANDOFF — Railway deploy + schema migrations

## Goal

Get the `api-server` Railway service booting with a correctly migrated database,
and put schema migrations on a deterministic, reviewable footing.

## Root cause (confirmed, not guessed)

The Railway `api-server` service was deploying a **prebuilt Docker Hub image**,
not this repo:

```
api-server source = {"image": "c0dezer019/api-server", "repo": null}
builder: RAILPACK   dockerfilePath: null   healthcheckPath: null
```

Image-sourced services skip the build phase entirely, so Railway never read
`railway.json` or `artifacts/api-server/Dockerfile`. Consequences:

- The `db push` chained into the Dockerfile `CMD` never ran → tables never created.
- `verifySchema()` in `artifacts/api-server/src/index.ts` threw on every boot →
  `CRASHED`, restart loop.
- The `/api/healthz` healthcheck in `railway.json` was never applied.

Decisive evidence: container start → crash in **1.6s** with zero drizzle-kit
output in the logs. A pnpm bootstrap + drizzle-kit connect + introspect + DDL
cannot complete in 1.6s.

Ruled out along the way (don't re-investigate):
- `lib/db` unreachable from the build — false; build context is repo root and
  `.dockerignore` does not exclude `lib/`.
- `__dirname` misresolving in `drizzle.config.ts` (ESM package) — works fine;
  `generate` read all 11 tables.
- `pnpm --filter @workspace/db` not matching — matches correctly.
- Missing `users` / `refresh_tokens` in the schema — they exist, just declared
  with the multi-line `pgTable(` form that a naive grep misses.

## Done so far

- Migrations are now **generated SQL, committed to the repo**, replacing runtime
  `drizzle-kit push`:
  - `lib/db/drizzle.config.ts` — added `out: ./migrations`; no longer throws when
    `DATABASE_URL` is unset (so `generate` works without a database).
  - `lib/db/package.json` — added `generate` and `migrate` scripts.
  - `lib/db/migrations/0000_organic_wallop.sql` — initial migration, 11 tables.
- `artifacts/api-server/build.mjs` — copies `lib/db/migrations` into
  `dist/migrations` (esbuild cannot bundle `.sql`).
- `artifacts/api-server/src/index.ts` — `runMigrations()` applies pending
  migrations via drizzle-orm's migrator before `verifySchema()`. No drizzle-kit
  at runtime, and no interactive prompt on a non-TTY container.
- `artifacts/api-server/Dockerfile` — restored the multi-stage build (an
  uncommitted edit had collapsed it to single-stage to make `db push` work at
  runtime, which dragged the whole monorepo incl. Expo/RN into the production
  image). Kept the `ocrmypdf` addition. Runtime stage carries only `dist/`.

Verified locally: `build` succeeds and emits `dist/migrations/`; `typecheck` clean.

- Pushed to `main` (`0b21b85`).
- Repointed the Railway service source from the Docker image to the GitHub repo
  via `railway service source connect --repo The-App-Foundry/End-Shift --branch main`.
  Confirmed `source = {"image": null, "repo": "The-App-Foundry/End-Shift"}`.

**Deploy is green.** Verified on Railway:

```
builder: DOCKERFILE   dockerfilePath: artifacts/api-server/Dockerfile
healthcheckPath: /api/healthz   timeout: 300

[INFO] Applying database migrations  migrationsFolder="/app/.../dist/migrations"
[INFO] Database migrations up to date
[INFO] Seeded system admin role  roleId=1
[INFO] Server listening  port=8080
[INFO] request completed  req={GET /api/healthz} res={"statusCode":200}
```

## Next steps

1. **URGENT / security.** The first successful boot printed bootstrap admin
   credentials in plaintext into the Railway deploy logs, because
   `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` are unset:
   `bootstrapUsername="sysadmin"`. Change the password via the app, then set
   both env vars so future boots stop generating and logging one.
2. Convert `DATABASE_URL` to the `${{Postgres.DATABASE_URL}}` reference variable.
3. Decide on the `push` vs `migrate` drift below and update CLAUDE.md.

## Open decisions / gotchas

- **`push` vs `migrate` drift.** `lib/db` still exposes `push` / `push-force`,
  and the project CLAUDE.md documents `push` for local dev. Production now uses
  committed migrations. Using `push` locally will drift local schema away from
  the migration history. Recommend moving local dev to
  `generate` + `migrate` and updating CLAUDE.md — not done yet, flagged.
- **`DATABASE_URL` is a hardcoded literal**, not `${{Postgres.DATABASE_URL}}`,
  with an inline password. There are also two *detached* postgres volumes. Works
  today; a Postgres recreate silently breaks it. Worth converting to a reference
  variable.
- **`scripts/post-merge.sh` is stale** — runs `pnpm --filter db push` (wrong
  script name; `push` is the script, not `db push`). It was the Replit
  auto-apply hook. Replit is dead per the repo owner; the file should probably
  be deleted.
- **`lib/db` location.** The original question was whether `lib/db` belongs in
  `artifacts/`. It is orthogonal to this bug. If still wanted: moving
  `lib/db` → `artifacts/db` is cheap (still matched by the `artifacts/*`
  workspace glob, package name unchanged so imports and filters keep working,
  `drizzle.config.ts` is `__dirname`-relative so it moves as a unit). Only
  `tsconfig.json` and `artifacts/api-server/tsconfig.json` reference paths need
  editing, plus the `build.mjs` migrations copy path. Folding `db` into
  `api-server` and renaming to `server` is **not** recommended — import churn
  across 9 files for no runtime gain.
