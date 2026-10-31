# Wallet Face 0.4 — release evidence / 发布验证

Date: 2026-10-31. Branch: `feature/snapshot-inspired-ui-v04`.
Baseline: `feature/face-spaces-mvp` at `ebba64ca2d48cb590bdcb66b553a153c35cb4896`.
Primary domain: https://walletface.org.

## Implemented

- Persistent application shell, global EIP-1193 wallet state and context search.
- Home, discover/followed/recent collections, four Space sections and refreshed profiles.
- URL-backed participant search/page/sort, compact provenance and public activity.
- Avatar upload/sign/publish stages, immediate local preview and global avatar update.
- Chinese/English, system/light/dark theme, mobile bottom navigation and dialog drawer.
- Reusable cards, skeleton/error/empty states, modal focus handling, toast and clipboard fallback.
- Metadata-only summary API, cancellable SDK reads and validated safe profile links.
- Canonical metadata, original favicon, sitemap/robots directive, developer/pilot entrances.
- Snapshot MIT source study and attribution; original React implementation.

## Automated evidence

- Backend/security/SQLite/HTTP suite: 19 passed.
- Frontend/SDK/provider suite: 23 passed, including original publisher envelope regression,
  shared wallet state, account changes, logout restoration, navigation, collections,
  participant filters and read-only capability gates.
- Web TypeScript/production build, SDK declarations and Snapshot EIP-712 digest check: passed.
- Root and web npm audits: zero vulnerabilities after Zod 4.6.7, Vite 7.3.7 and source-map-js update.
- Native wrong-origin, replay, tampering, stale revisions and admin authorization remain enforced.
- HTTP deep links include home/avatar/followed/Space/participants/profile/developers.

Mocked tests use labeled fixture identities and intercept uploads/sequencer calls. They create
no public profile changes. Real wallet signature/upload and mobile-wallet approval are pending.

## Browser evidence

The local managed preview serves the QA build. Real API data is read from the stable public
walletface.org API because managed-local upstream Snapshot requests time out.
The observed Yam scan contains 102 public wallets, 50 proposals and 500 public votes, with
both completeness flags false. Activity, participant profiles and community metadata render.

Responsive checks use real iframe CSS viewports at 1440, 1024, 768 and 375; the 1440 frame is
visually scaled to 85% for capture within the available browser. Connected screenshots use a
visibly labeled fixture that cannot sign. See docs/UI_RESEARCH.md for the exact setup.

Screenshots and final production observations are appended after rollout.

## Deployment

Preview/production IDs and commit/PR links are recorded after the deployment completes.
Vercel native writes remain disabled. No production database, paid service or access-protection
change is part of this release.

Rollback target: `dpl_4LtevLxZM7vpQchDXoRuiX8cMtCd`.

## Remaining verification / 下一步

- Real EIP-1193 wallet upload/signature, mobile wallets/WalletConnect and optional ENS transaction.
- Durable production native database, backup/restore drill, shared limits and append-only audit.
- Partner-controlled SDK integration, pilot adoption and commercial operations.
- China-mainland reachability requires independent regional measurement; this environment
  does not establish nationwide availability.
