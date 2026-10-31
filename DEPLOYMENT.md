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
