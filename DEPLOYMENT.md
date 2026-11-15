# Deployment and rollback / 部署与回滚

## v0.4 target

Primary: https://walletface.org. www.walletface.org is attached and verified.
The legacy dao.sarl domain is retained for migration. Source-controlled host redirects are
applied only after the new production domain has been checked.

Vercel team: `team_z5CyXH1a0Xdl2JTUxIzLoIpy`; project:
`prj_5756QzU8E5xtwSZxobEf460CHeKR` (`walletface`, renamed by the owner).
The project name does not appear in product branding. No DNS or access protection needs to
change for the UI upgrade. The removed face.hnudao.online alias remains removed.

## Local and persistent pilot

```bash
npm ci
npm --prefix web ci
npm run build
npm start
# http://localhost:8787
```

Node 24 serves the SPA and API. Optional settings are in `.env.example`; `npm run dev`
loads `.env.local`. For Vite hot reload, run the API and `npm --prefix web run dev`;
set API `APP_ORIGIN=http://localhost:5173`.

A writable pilot uses one Node 24 process, mounted persistent storage, TLS reverse proxy,
`HOST=0.0.0.0`, `APP_ORIGIN=https://your-pilot.example`, and
`FACE_DB_PATH=/persistent/face.sqlite`. Migrations apply idempotently.
Use SQLite-consistent backups and restore drills. Multiple replicas require shared durable
storage and distributed limits. The supplied Dockerfile still needs container validation.

原生资料、角色与徽章写入需要持久化后端；Vercel 当前保持只读。
`APP_ORIGIN` 必须与浏览器来源完全一致，包含协议与端口，不含路径或结尾斜杠。

## Vercel release process

1. Start from `feature/face-spaces-mvp` at `ebba64ca2d48cb590bdcb66b553a153c35cb4896`.
2. Build/test `feature/snapshot-inspired-ui-v04`; retain the previous deployment.
3. Upload sanitized source and create an independent Preview deployment.
4. Inspect build state/logs; browser-test the managed local preview and public APIs.
5. Rebuild the tested Preview source for Production. Check walletface.org HTTPS, deep links,
   health/version, real community data and read-only authorization.
6. After those checks, deploy the host-specific dao.sarl → walletface.org 308 redirect,
   preserving path and query. Also canonicalize www.walletface.org.
7. Record actual IDs/commits/results in RELEASE_REPORT.md.

Build: `npm ci && npm --prefix web ci`, then `npm run build`; output `web/dist`.
`api/index.mjs` serves a stateless read-only API. Its authorization origin defaults to
`https://walletface.org`. No database or paid integration is provisioned by this release.
The avatar publisher remains a direct browser → wallet → Pineapple/Snapshot flow.

Preview access protection stays enabled. No temporary public share URL, bypass secret or
authentication change is created. A protected Preview can require the owner's Vercel session.

## Domain configuration

Both walletface.org and www.walletface.org were verified on this existing project.
Observed apex DNS was configured and HTTPS worked before release. Keep Cloudflare records
DNS-only while using Vercel TLS. Changes to external DNS are a separate operation.

Canonical links, copy/share URLs, sitemap and developer examples use walletface.org.
Browser-local follows, history and logout state are scoped to each origin and are not migrated
between domains. Native signatures on the new origin require fresh authorization.

## Rollback

Pre-upgrade production retained: `dpl_4LtevLxZM7vpQchDXoRuiX8cMtCd`,
source `ebba64ca2d48cb590bdcb66b553a153c35cb4896`.

Restore that deployment through the Vercel rollback operation if needed. Host redirects are
source-controlled, so rolling back also restores its routing configuration. No production
native database migration occurs in this release. A writable pilot must restore matching
application/schema versions; do not roll nonce storage backwards while accepting unexpired
signatures.

## Quality gates

```bash
npm test
npm --prefix web test
npm --prefix packages/sdk run build
npm run build
npm run test:protocol
npm audit
npm --prefix web audit
git diff --check
```

Optional real upstream integration: `npm run smoke`.
Responsive methodology and reference sources: docs/UI_RESEARCH.md.


## Agent platform configuration / Agent 平台配置

Use the existing Vercel project, repository root, `npm ci && npm --prefix web ci`, output `web/dist`, Node 24.
`vercel.json` builds the app and runs live verification scripts only when their explicit flags are true.

| Variable | Purpose |
|---|---|
| FACE_AI_ENABLED | Model kill switch; Preview true, default false |
| FACE_AI_PROVIDER, NEWAPI_BASE_URL, NEWAPI_MODEL | Server provider/model |
| NEWAPI_API_KEY | Server-only sensitive provider key |
| NEWAPI_ALLOW_HTTP | Explicit opt-in for the owner's HTTP provider endpoint |
| FACE_AI_BETA_TOKEN | 32+ character owner beta access code |
| FACE_AI_QUOTA_STORE=postgres | Durable shared quotas |
| FACE_DATABASE_URL | Environment-specific Neon connection |
| FACE_PLATFORM_ENABLED=true | Persistent platform switch |
| FACE_SESSION_SECRET | 32+ character private read-session signing secret |
| ENS_RPC_URL | Optional trusted chain-1 token ownership verification |
| FACE_SCHEDULED_REFRESH, CRON_SECRET | Opted-in daily index job; disabled until configured |

Alternative quota adapter: UPSTASH_REDIS_REST_URL/TOKEN. Preview now uses Neon and no longer depends on the temporary Redis database's expiry.
No model/provider key belongs in VITE_* or client JavaScript. NewAPI uses http://82.156.218.54/v1 and gpt-6.1-sol, owner-authorized HTTP opt-in; TLS is preferable when the provider supplies it.

Apply versioned SQL `server/platform/migrations/001`–`004` on an isolated environment first. Preview migration/nonce concurrency tests passed.
Formal database `walletface_production` is empty: automatic approval review blocked applying the production schema pending owner confirmation.
No legacy SQLite records are copied or authorization stores switched.

Live checks: FACE_AI_VERIFY_ON_BUILD=true, optionally FACE_AI_VERIFY_CASE=proposal; FACE_PLATFORM_VERIFY_ON_BUILD=true.
These scripts require VERCEL_ENV=preview, use synthetic test wallets/prompts, and emit sanitized JSON reports. Model verification incurs provider usage.
Disable both verification flags after the explicit acceptance run. Scripts are not public API routes.

Cron is 03:17 UTC / 11:17 Singapore daily, at most three opted-in Spaces and one bounded page per Space.
Production deployment requires successful corrected proposal acceptance, final Preview rendering, approved formal schema application and environment configuration.
The owner authorized promotion after acceptance; production migration approval remains separately required by the task and automatic review.
Kill switches: FACE_AI_ENABLED=false, FACE_PLATFORM_ENABLED=false; redeploy. Original avatar publication remains independent.

Release A configuration: `FACE_IDENTITY_ENABLED`, optional isolated `FACE_IDENTITY_DATABASE_URL`, migration 005, optional trusted `ENS_RPC_URL`/`BASE_SEPOLIA_RPC_URL`. Preview acceptance is gated by `FACE_IDENTITY_VERIFY_ON_BUILD` and an isolated database name. [Release A deployment details](docs/AGENT_IDENTITY_RELEASE_A.md).

Release B: additive migration 006, `FACE_X402_ENABLED`, `FACE_X402_RECEIVER`, optional trusted `BASE_SEPOLIA_RPC_URL`, Preview-only `FACE_PAYMENTS_VERIFY_ON_BUILD`. Public facilitator supports Base Sepolia; mainnet activation remains disabled pending funded testnet acceptance. [Release B operations](docs/X402_RECEIVE_RELEASE_B.md).

Release C adds human-reviewed testnet spending policies, per-quote approval, conservative atomic budgets, revocation and a guarded wallet-signing boundary. See [exact routes and enforcement scope](docs/CONTROLLED_SPENDING_RELEASE_C.md).

Release D Preview: migration 008, FACE_INTEROP_ENABLED, Preview-only FACE_INTEROP_VERIFY_ON_BUILD. The complete release verification script runs backend/React tests, SDK/build/protocol checks and separately flagged integration checks; AI model verification remains off unless explicitly activated. [Release D acceptance scope](docs/AGENT_INTEROP_RELEASE_D.md).
