# Deployment and rollback

## Status

The read-only 0.3 release was published to `https://dao.sarl/` on 2026-10-29 at the owner's
request. Deployment `dpl_3pQ5gCG9qAWRQ53xzW8WEedYsfLY` rebuilt the verified preview source
for Production. Native writes remain disabled; see `RELEASE_REPORT.md` for evidence and
known dependency advisories. No production DNS or persistent database has changed. The legacy
`face.hnudao.online` custom-domain removal is not reversed by this upgrade.

## Local persistent application (Node 24)

```bash
npm ci
npm --prefix web ci
npm run build
npm start
```

Open `http://localhost:8787`. The same process serves the compiled SPA and `/v1` API.
For overrides, copy `.env.example` to `.env.local` and use `npm run dev`; the latter loads that
file. Set `APP_ORIGIN` to the exact browser origin, with scheme/port and no path or trailing slash.
Native writes fail safely if it does not match. No paid upstream subscription is needed.

For Vite hot reload, run the API plus `npm --prefix web run dev`, and configure API
`APP_ORIGIN=http://localhost:5173`. Vite proxies `/v1` and `/health` to 127.0.0.1:8787.

## Self-hosted persistent pilot

Use a single Node 24 process with a mounted persistent directory, TLS reverse proxy,
`HOST=0.0.0.0`, `PORT=8787`, `APP_ORIGIN=https://your-pilot.example`, and
`FACE_DB_PATH=/persistent/face.sqlite`. Optional `ENS_RPC_URL` is server-only. The schema in
`server/migrations/001.sql` is applied idempotently at startup. Do not use an ephemeral
serverless filesystem for claim records or nonce storage.

`Dockerfile` is supplied as a deployment starting point. Container execution was not assumed
or reported as tested unless explicitly recorded in the release report. Review/pin the base
image digest before a production rollout. Provisioning a new paid host/database is outside
this implementation's authorization.

## Vercel preview (read-only)

`vercel.json` builds `web/dist`, routes `/v1` and `/health` to `api/index.mjs`, and preserves SPA
deep links. The preview adapter intentionally does not instantiate SQLite or enable native
claims/admin writes. This avoids pretending that function-local files are durable storage.
The avatar publisher still talks directly to Pineapple/Snapshot through the wallet.

Deploy the feature branch to the existing verified team/project with target **preview**, not
production. Do not assign custom domains or promote. A writable Vercel release needs a real
shared database adapter (for example a managed SQL service), an authorization review and
separate staging tests. That integration is not implemented here.

## Migration and rollback

1. Stop writes and back up the existing database. For this release there is no production
   native database migration; it introduces a new optional schema rather than overwriting data.
2. Apply/test against a separate staging database first. Keep the previous commit/build.
3. Do not promote until the original avatar flow and signed write tests pass on the actual host.
4. Roll back the application to the previous build and restore its matching database backup
   when needed. Never roll a production nonce database backwards while continuing to accept
   old unexpired signatures: rotate origin/domain version or wait beyond the challenge TTL.
5. The stable avatar-only deployment can remain in service independently of the new API.

Backup: stop the single writer and copy the SQLite database after clean shutdown/checkpoint,
or use a SQLite-consistent backup tool. Do not copy an active WAL database file alone. Test
restores separately; backups contain public profile fields and authorization proofs.

## Quality gates

```bash
npm test
npm --prefix web test
npm --prefix packages/sdk run build
npm run build
npm run test:protocol
npm run smoke
```

The smoke test is a real read-only upstream integration and is intentionally not part of
deterministic CI. It uses smaller scan limits and prints their provenance. npm publication,
production promotion, paid services and custom-domain changes require separate approval.
