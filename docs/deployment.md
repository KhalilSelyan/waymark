# Deployment

## Required environment

Configure these values through the deployment platform secret manager, never in the repository:

- `DATABASE_URL`: production PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: random secret of at least 32 characters.
- `BETTER_AUTH_URL`: public application URL.
- `CORS_ORIGIN`: the same public application origin.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth credentials.
- `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, and `STORAGE_SECRET_ACCESS_KEY`: optional S3-compatible storage configuration. For Cloudflare R2, use the account S3 endpoint and `auto` region.

`WAYMARK_E2E` must not be enabled in production.

## Realtime scaling

The realtime hub currently stores listeners, stream versions, and presence in process memory. It is correct for a single web instance only; multiple instances require a shared pub/sub transport and shared stream-version store. No Redis or equivalent service is currently configured, so do not scale the web process horizontally while relying on realtime collaboration.

If storage variables are omitted, the app uses local `.data/assets` storage. Use R2 or another persistent S3-compatible provider for production.

For R2, create the bucket and a bucket-scoped API token in Cloudflare, then set the five `STORAGE_*` variables in the deployment secret manager. No R2 credentials belong in this repository.

## Build and start

The repository includes a root `nixpacks.toml` for Node 24-based platforms such as Railway. It installs the workspace, builds from the repository root, and starts the web package with its Node adapter.

For Coolify hosts where the Nixpacks bootstrap cannot download its Nixpkgs snapshot, the repository also includes a root `Dockerfile`. Set the Coolify build pack to Dockerfile, leave the Dockerfile path as `Dockerfile`, and expose container port `3000`.

```bash
pnpm install --frozen-lockfile
pnpm run db:migrate
pnpm run build
pnpm --filter web preview --host 0.0.0.0
```

The Node adapter produces a standalone server in `apps/web/build/`. The Docker image starts it directly with `node apps/web/build`; a non-Docker deployment can use `pnpm --filter web start`. The deployment must expose `/health` as its readiness check.

Webpage capture uses Playwright's Chromium browser. The included Dockerfile and Nixpacks configuration install Chromium and its system dependencies during the build; custom deployment pipelines must run `pnpm --filter web exec playwright install --with-deps chromium` as part of their image build.

## Database changes

When using the current `db:push` workflow, run `pnpm run db:check` first and review the schema diff produced by `pnpm run db:push` before applying it. Keep a provider-level backup and record the resulting schema version in the deployment notes.

1. Back up the production database.
2. Review the generated Drizzle migration.
3. Run `pnpm run db:migrate` before routing traffic to the new application build.
4. Verify `/health` returns `{ "status": "ok", "database": "ok" }`.

Do not use `db:push` against production.

### Backup validation

Use the provider's native PostgreSQL backup tool before migration, and verify the artifact can be listed and restored into an isolated database. A successful backup command without a restore test is not sufficient validation.

### Smoke check

After deployment, verify all of the following from outside the container:

```bash
curl --fail "$APP_URL/health"
curl --fail "$APP_URL/"
curl --fail "$APP_URL/login"
```

Then sign in with a synthetic account, create a disposable trip, open Canvas, Places, Itinerary, Expenses, and Activity, and delete the trip. Do not use production personal accounts for this check.

## Rollback

- Route traffic back to the previous application build.
- Do not automatically roll back database migrations unless the migration is explicitly reversible and reviewed.
- Preserve the failed build logs and health response for diagnosis.

## Demo data

Demo data must be created manually in a non-production database or through a future seed command using synthetic identities. Never commit OAuth credentials, invite tokens, or personal data. Keep demo trips disposable and delete them after smoke testing.
