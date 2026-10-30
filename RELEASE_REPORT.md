# Wallet Face 0.3 — release evidence

## Production update / 正式上线（2026-10-29）

At the owner's explicit request, the tested preview source was rebuilt for Production
and published to <https://dao.sarl/>. This update supersedes the preview-only status below.

- Production deployment: `dpl_3pQ5gCG9qAWRQ53xzW8WEedYsfLY`, READY.
- Source: `6b4fe82734d14d90f20fb3e6a80013491ba5db65`; framework React/Vite + Node API.
- Build duration: approximately 38 seconds. No DNS or access-protection settings changed.
- Rollback target retained: `dpl_6JgZJyd1WXTGgNkFxLW4cVRtZ38x`.
- Public unauthenticated `/health` returned HTTP 200, version `0.3.0`, mode `read-only`.
- Browser verification on the production domain rendered the original avatar entry,
  navigation, Space import, real Yam participant directory and recent governance activity.
  The observed count was 102 wallets within the documented bounded scan.
- Production error/fatal runtime-log query for this deployment over the previous ten
  minutes returned no matching logs.
- Native claims/admin writes remain disabled. The original browser Snapshot publisher
  is retained; no real-wallet upload/signature was performed during this rollout.
- `npm audit` reports one high advisory for runtime Zod (GHSA-mrhx-c7xc-m3w5), plus
  two high findings in the frontend build/development dependency tree (Vite and source-map-js).
  These dependencies were not upgraded during this deployment. Fixed-version upgrades,
  compatibility tests and a follow-up release remain necessary.
- No automated monitoring or log-drain setup was added. Native data persistence and
  fuller wallet/mobile validation remain rollout gaps.

以下保留首次预览交付记录；生产状态以上述更新为准。

Initial preview delivery: 2026-10-29.

## Delivery / 交付

- Branch: `feature/face-spaces-mvp`.
- Draft PR: <https://github.com/CryptographyBloke/Face/pull/2> (not merged).
- Read-only preview: <https://hnudao-face-qbsl22pwx-dao-vote.vercel.app>.
- Community example: <https://hnudao-face-qbsl22pwx-dao-vote.vercel.app/spaces/yam.eth>.
- Preview source: `6b4fe82734d14d90f20fb3e6a80013491ba5db65`. Later branch
  commits update CI and documentation only; this preview does not include those edits.
- Vercel deployment: `dpl_DeeEkckmtcboH1T3veUXUvHtzsKJ`, READY, target null
  (Preview), no aliases assigned. Deployment protection may require the owner's Vercel login.

首次预览独立部署，随后正式版本按上文上线。上一版生产部署为
`dpl_6JgZJyd1WXTGgNkFxLW4cVRtZ38x`。

## Implemented / 已实现

The original wallet → IPFS → gasless Snapshot publisher is retained, with bilingual
navigation and public profile links. New functionality includes public address profiles,
bounded Snapshot community directories and activity, a versioned resolver API, typed
TypeScript/React SDK, deterministic avatar fallback and three first-party integration examples.

The separate Node 24 + SQLite application implements signed profile claims/hiding,
fresh Snapshot-admin authorization, branding, role labels, organization-issued badges
and revocation. Native records are off-chain service data stored in SQLite. Administrative
authorization is checked against the current Snapshot admins list.

## Verification / 验证

- Backend/security/persistence/real HTTP integration: 17 tests pass.
- Frontend and SDK regression suite: 6 tests pass (mocked wallet/upstream boundaries).
- Web TypeScript + production build, SDK declarations/build, original Snapshot protocol
  hash check and `git diff --check`: pass.
- Real read-only Snapshot Hub smoke test: HTTP 200, bounded scan with provenance.
- Deployed preview `/health`: HTTP 200, version 0.3.0, mode `read-only`.
- Deployed `/v1/spaces/yam.eth` and `/members?page=1`: HTTP 200 with real Hub data.
  This observation returned 102 unique public participating wallets from at most 50
  proposals and 500 votes. Both completeness flags were false.
- Deployed `/v1/profile/1/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`:
  HTTP 200 with normalized response and `avatar.source: none`.
- Direct `/spaces/yam.eth` page request: HTTP 200, SPA entry and asset references.
- Legacy CI workflows updated to Node 24 + locked dependency installation; inspect the
  PR checks for their latest remote result. The new Product checks passed before this update.

Not verified: a real browser wallet signature/upload, mobile wallets, full remote visual
acceptance, Docker execution, production write operations or external partner adoption.
The managed preview browser connection failed during final online UI verification.
Earlier managed-local Snapshot requests timed out although the separate real upstream
smoke and Vercel API checks succeeded. Production browser verification is recorded above.

## Access and architecture / 访问与架构

Vercel serves the compiled SPA and a stateless **read-only** API. API requests query the
official Snapshot Hub with bounded scans, caching, retries and provenance. Native claims
and administration are intentionally disabled there because no shared durable database
has been provisioned. Original Snapshot avatar publication is a separate browser-wallet flow.

For the writable local application, use Node 24:

```bash
npm ci
npm --prefix web ci
npm run build
npm start
# Open http://localhost:8787
```

Example preview reads (a protected preview may need an authenticated Vercel session):

```bash
curl 'https://hnudao-face-qbsl22pwx-dao-vote.vercel.app/health'
curl 'https://hnudao-face-qbsl22pwx-dao-vote.vercel.app/v1/spaces/yam.eth/members?page=1'
```

See `ARCHITECTURE.md`, `API.md`, `SECURITY.md` and `DEPLOYMENT.md` for contracts and limits.

## Remaining work / 尚未完成

- Durable shared staging/production persistence and restore drills; no production promotion.
- Invitation onboarding, bulk exports and complete append-only audit history.
- Safe/EIP-1271, WalletConnect/mobile validation and distributed rate limits.
- Full historical indexing, partner-owned integrations and paid service operations.
- Billing, API-key plans, support commitments and jurisdiction-specific policy review.

The Phase 1/2 foundation and locally tested signed administration are implemented.
Applications display avatars through Snapshot, ENS or the Face resolver. The next commercial
milestone is a partner-owned community integration and a durable pilot backend with
independent verification.
