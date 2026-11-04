# Wallet Face — Product Milestones

> Status updated: 2026-11-04

## Current state: product code complete, awaiting launch

The code for M2 (resolver API and SDK) and M4 (commercial version) is now in the repository:

- `web/`: the rebuilt app. It has an avatar studio (in-browser crop and compression), public profile pages, developer docs, pricing, and a developer dashboard. Everything is bilingual.
- `api/`: a Cloudflare Worker with these parts:
  - address/ENS → avatar resolution, with gateway fallback and edge caching
  - identicon fallback images
  - batch lookups
  - wallet sign-in, hashed API keys, and monthly plan quotas
  - Stripe Checkout, the customer portal, and webhooks
- `sdk/`: a small JavaScript client.

Next it needs to be operated: deploy the API, connect Stripe, and win real integrations. The code alone does not prove demand.

## Roadmap

| Milestone | Proposed focus | Evidence of progress |
|---|---|---|
| M0 — Prototype (done) | Wallet → IPFS → Snapshot; optional ENS; bilingual interface; logout; compatibility links | Public demo, successful build, EIP-712 protocol check |
| M1 — Reliable beta | Mobile wallet testing, upload retry/status, clearer failure states, consistent releases, privacy and content policy | 20–50 external testers and measured publish success |
| M2 — Resolver API/SDK (code done) | Address-to-avatar endpoint, image proxy, caching, gateway fallback, CORS/rate limits, SDK | Deployed at api.dao.sarl; three independent integrations |
| M3 — Community pilot | Branded member pages, invite/import flow, roles/badges, moderation and export | Two or three pilot communities |
| M4 — Commercial version (code done) | API keys, usage dashboard, Stripe billing; still needed: monitoring, terms of service, support process | First recurring organizational customers |

Targets are proposals, not achieved results. Individual avatar upload should remain free; possible paid value is organization tooling, resolver infrastructure, or white-label deployments.

## Immediate priorities

1. Deploy the API (see `api/README.md`) and point `api.dao.sarl` at it.
2. Create the Stripe products and set the secrets. Publish terms of service and a privacy policy before you charge anyone.
3. Integrate the image URL into 3–5 real apps (DAO tools, explorers, wallets), and record their usage in the dashboard.
4. Recruit 20–50 testers and measure how often publishing succeeds on mobile wallets.

## Product principles

- Keep wallet keys in the user's wallet; never add key custody.
- Keep Snapshot and ENS as compatibility adapters rather than hard requirements.
- Do not claim that every website will display the avatar automatically.
- Avoid a custom registry contract until real integrations demonstrate the need.
