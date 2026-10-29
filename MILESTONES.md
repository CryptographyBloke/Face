# Wallet Face — Product Milestones

> Status updated: 2026-10-29

## 0.3 progress (read-only production release)

Implemented on `feature/face-spaces-mvp`: public profile routes, bounded real Snapshot Space
imports, a versioned resolver API, typed SDK/React component, three first-party integration
examples, native EOA-signed claims with SQLite persistence, fresh Snapshot-admin checks,
branding, role labels and revocable organization badges. The original avatar flow remains.

Local/backend checks and real read-only Hub smoke tests are available. Vercel preview mode
is explicitly read-only; a writable production backend is not provisioned. Native write
logic is locally tested; only the read-only frontend/API release is live on `dao.sarl`
as of 2026-10-29. See `RELEASE_REPORT.md`, `DEPLOYMENT.md` and `SECURITY.md`.

Still open: invitations, bulk exports, Safe/EIP-1271, mobile-wallet/WalletConnect validation,
shared serverless persistence, distributed limits, partner adoption and paid operations.

## Current state — public prototype

The production site is available at <https://dao.sarl>. The app supports wallet connection, JPG/PNG upload to IPFS, gasless Snapshot Profile signing, profile read-back, bilingual UI, logout, local preview, gateway fallback, and links to compatible services. ENS synchronization is optional.

Production now serves the 0.3 frontend and read-only resolver/community API. Persistent
native writes, billing and full organization onboarding are still not enabled. External wallet,
Pineapple, Snapshot and IPFS availability remain dependencies.

There is no universal avatar registry: third-party applications need to integrate Snapshot, ENS, Stamp, IPFS, or a future resolver API before they can display these avatars.

## Roadmap

| Milestone | Proposed focus | Evidence of progress |
|---|---|---|
| M0 — Prototype (done) | Wallet → IPFS → Snapshot; optional ENS; bilingual interface; logout; compatibility links | Public demo, successful build, EIP-712 protocol check |
| M1 — Reliable beta | Mobile wallet testing, upload retry/status, clearer failure states, consistent releases, privacy and content policy | 20–50 external testers and measured publish success |
| M2 — Resolver API/SDK | Read-only address-to-avatar endpoint, caching, gateway health checks, CORS/rate limits, integration examples | Three independent demo integrations |
| M3 — Community pilot | Branded member pages, invite/import flow, roles/badges, moderation and export | Two or three pilot communities |
| M4 — Commercial version | API keys, usage dashboard, billing, support, monitoring and operational policies | First recurring organizational customers |

Targets are proposals, not achieved results. Individual avatar upload should remain free; possible paid value is organization tooling, resolver infrastructure, or white-label deployments.

## Immediate priorities

1. Recruit testers and measure end-to-end upload and profile-read reliability.
2. Validate the implemented resolver/SDK with an external partner-controlled integration; the three included examples are first-party demos, not independent adoption.
3. Provision and verify a durable staging backend before inviting real users to claim profiles, then validate community demand before adding billing.

## Product principles

- Keep wallet keys in the user's wallet; never add key custody.
- Keep Snapshot and ENS as compatibility adapters rather than hard requirements.
- Do not claim that every website will display the avatar automatically.
- Avoid a custom registry contract until real integrations demonstrate the need.
