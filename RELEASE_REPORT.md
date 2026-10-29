# Wallet Face 0.3 preview — release evidence

Date: 2026-10-29. This is a feature-branch preview, not a production release.

## Delivery / 交付

- Branch: `feature/face-spaces-mvp`.
- Draft PR: <https://github.com/CryptographyBloke/Face/pull/2> (not merged).
- Read-only preview: <https://hnudao-face-qbsl22pwx-dao-vote.vercel.app>.
- Community example: <https://hnudao-face-qbsl22pwx-dao-vote.vercel.app/spaces/yam.eth>.
- Preview source: `6b4fe82734d14d90f20fb3e6a80013491ba5db65`. Later branch
  commits update CI and documentation only; this preview does not include those edits.
- Vercel deployment: `dpl_DeeEkckmtcboH1T3veUXUvHtzsKJ`, READY, target null
  (Preview), no aliases assigned. Deployment protection may require the owner's Vercel login.

本次只发布独立预览。`dao.sarl` 正式站、DNS、自定义域名均未修改；旧域名解绑没有恢复。
Verified the latest production deployment remains `dpl_6JgZJyd1WXTGgNkFxLW4cVRtZ38x`.

## Implemented / 已实现

The original wallet → IPFS → gasless Snapshot publisher is retained, with bilingual
navigation and public profile links. New functionality includes public address profiles,
bounded Snapshot community directories and activity, a versioned resolver API, typed
TypeScript/React SDK, deterministic avatar fallback and three first-party integration examples.

The separate Node 24 + SQLite application implements signed profile claims/hiding,
fresh Snapshot-admin authorization, branding, role labels, organization-issued badges
and revocation. These native records are off-chain service data, not NFTs or universal
identity credentials. Roles do not grant administrative privileges.

## Verification / 验证

- Backend/security/persistence/real HTTP integration: 17 tests pass.
- Frontend and SDK regression suite: 6 tests pass (mocked wallet/upstream boundaries).
- Web TypeScript + production build, SDK declarations/build, original Snapshot protocol
  hash check and `git diff --check`: pass.
- Real read-only Snapshot Hub smoke test: HTTP 200, bounded scan with provenance.
- Deployed preview `/health`: HTTP 200, version 0.3.0, mode `read-only`.
- Deployed `/v1/spaces/yam.eth` and `/members?page=1`: HTTP 200 with real Hub data.
  This observation returned 102 unique public participating wallets from at most 50
  proposals and 500 votes. Both completeness flags were false. Counts are neither
  an official membership roster nor the full historical total; they can change.
- Deployed `/v1/profile/1/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`:
  HTTP 200 with normalized response and honest `avatar.source: none` (no invented image).
- Direct `/spaces/yam.eth` page request: HTTP 200, SPA entry and asset references.
- Legacy CI workflows updated to Node 24 + locked dependency installation; inspect the
  PR checks for their latest remote result. The new Product checks passed before this update.

Not verified: a real browser wallet signature/upload, mobile wallets, full remote visual
acceptance, Docker execution, production write operations or external partner adoption.
The managed preview browser connection failed during final online UI verification.
Earlier managed-local Snapshot requests timed out although the separate real upstream
smoke and Vercel API checks succeeded. These limitations are not recorded as passes.

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

This delivers the Phase 1/2 foundation plus a locally tested signed administration slice,
not the complete commercial roadmap. Cross-site avatar display still requires each
third-party site to adopt Snapshot/ENS or this resolver; it is not automatic everywhere.
The next commercial milestone is one real community's partner-owned integration and
a durable, independently verified pilot backend, not a claim of revenue or traction.
