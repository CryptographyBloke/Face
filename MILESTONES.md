# Wallet Face — Product Milestones

> Status updated: 2026-10-29

## Current state — public prototype

The production site is available at <https://dao.sarl>. The app supports wallet connection, JPG/PNG upload to IPFS, gasless Snapshot Profile signing, profile read-back, bilingual UI, logout, local preview, gateway fallback, and links to compatible services. ENS synchronization is optional.

The web client is static and has no custom account database, resolver API, organization workspace, billing, or moderation dashboard. It depends on browser wallets, Pineapple, Snapshot, and public IPFS gateways.

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
2. Build a read-only resolver prototype and integrate it into several independent demo apps before adding a new registry contract.
3. Validate demand with community pilots before adding workspaces or billing.

## Product principles

- Keep wallet keys in the user's wallet; never add key custody.
- Keep Snapshot and ENS as compatibility adapters rather than hard requirements.
- Do not claim that every website will display the avatar automatically.
- Avoid a custom registry contract until real integrations demonstrate the need.
