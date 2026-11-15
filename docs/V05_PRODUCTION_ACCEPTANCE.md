# v0.5 production acceptance / 正式发布验收

Published 2026-11-15, 21:24–21:29 Singapore time.

- Live: https://walletface.org/ai
- Deployment: `dpl_5UyBL32456RYrRm9GN4WtxowTvXo` / https://walletface-a13zt3264-dao-vote.vercel.app
- Application commit: `5d745097ddfa82a05980e40cf74c722da7398c59`
- Preserved rollback: `dpl_GjPfmyukWFpKuzk5AYHS83YxF9vD`, source `3f505dc3`.

The owner explicitly approved the previously blocked formal initialization. Migrations 001–004 applied successfully to the separate `walletface_production` database.
The database-scoped `face_production_runtime` role can read all four migration versions and execute the shared quota function.
Provider credentials were scoped server-side to production without displaying their values. Production uses a separate database/session secret and PostgreSQL quota counters.
Native SQLite/profile authorization data was not migrated. Scheduled refresh remains disabled until configured; the existing avatar publishing flow is unchanged.

Production HTTP checks: AI status available=true/restricted-beta/missing=[], public Agent list 200 with an empty dataset, and full website rendering.
A real production browser generation invoked analyzeParticipation, returned ENS 390 public votes / 128 observed wallets, cited Snapshot, and displayed the 50/500 scope and 110 private votes omitted.
Provider-reported production usage: 11,788 tokens. Total observed model usage including previous acceptance: 107,274 tokens; monetary cost remains dependent on NewAPI channel pricing.

A real MCP SDK v2 client connected over the public production HTTP endpoint, discovered all five read-only tools and successfully called get_space with a verified Snapshot source URL.
Chinese UI, existing connected-wallet restoration and the production evidence cards rendered in Edge. Screenshot: screenshots/platform/production-copilot.png.

Pre-release checks remain 52 backend +39 web tests, SDK/build/protocol passed, both audits zero vulnerabilities.
Clipboard/download end-to-end automation is still unverified after a browser automation timeout. No user wallet signature or financial payment was automated.

Next work starts on a separate Release A branch; v0.5 production and its original feature branch remain preserved.
