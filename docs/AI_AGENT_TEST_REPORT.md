# Agent platform acceptance / Agent 平台验收

2026-11-15 · branch `feature/face-ai-agent-v05`. Baseline green v0.4: `3f505dc3b5092d77c5f3797b5dfe5393d973b09d`.
Production was promoted after explicit owner approval; see [production acceptance](V05_PRODUCTION_ACCEPTANCE.md). Existing SQLite authorization is unchanged.

## Automated checks

| Check | Verified result |
|---|---|
| `npm test` | 52 passed |
| `npm --prefix web test` | 39 passed |
| SDK build, TypeScript/Vite production build | Passed |
| `npm run test:protocol` | Passed; existing Snapshot avatar signing contract |
| Root and web `npm audit` | Zero vulnerabilities |

Tests cover read-only AI tools, schema/body/context/output budgets, source metadata, partial datasets, private ballot/score omission,
model failures/cancellation, controlled prompt injection, zh/en UI, wallet approval review, chain rejection, EIP-712 origins,
nonce replay, altered payloads, Agent signature checks, SSRF/DNS rejection, private sessions, indexing and database quota calls.
The real MCP SDK v2 client discovers exactly five read-only tools and invokes the actual tool adapter.
Controlled model tests exercise the installed AI SDK and NewAPI SSE adapter; these are separate from the live checks below.

## Live NewAPI and Snapshot

[Model report](AI_MODEL_LIVE_REPORT.json): two real NewAPI tool-calling generations, ENS Chinese and Yam English, **23,597 tokens**.
Actual browser generations added ENS Chinese participation analysis (**11,774 tokens**) and English proposal explanation (**12,062 tokens**).
The initial English proposal explanation converted a Unix timestamp to the wrong month. This failed acceptance.
The reader now supplies `startUtc`, `endUtc`, `createdUtc` and `votingWindowUTC`; system policy requires copying these values.
The corrective real NewAPI regression passed on commit `41aadb3` at 20:44 Singapore time: both UTC dates match tool evidence.
[Regression report](AI_PROPOSAL_REGRESSION.json): one getProposal call, 48,053 reported tokens.

| Space | Bounded proposals/votes | Private omitted | Public votes | Observed wallets |
|---|---:|---:|---:|---:|
| ENS | 50 / 500 | 110 | 390 | 128 |
| Yam | 50 / 500 | 0 | 500 | 102 |

These are scan observations, not complete historical rankings. Raw tools: [live evidence](AI_LIVE_EVIDENCE.json).
No monetary charge is inferred from token counts: NewAPI channel pricing/ledger is unavailable. Total reported model usage is **95,486 tokens** including the corrective regression.

## Real PostgreSQL

[Database report](PLATFORM_LIVE_REPORT.json), protected Preview build `bdd5181`:

- Real signed private Agent create and metadata signature verification; public lookup withholds private record.
- Replaying an authorization fails. Four concurrent submissions consume one nonce exactly once.
- Preparation → approval → execution applies an internal announcement and three audit events atomically. Skipping approval fails.
- Twelve concurrent quota reservations: five accepted, seven rejected.
- Real Snapshot index pages: ENS 100 public votes / 66 wallets; Yam 100 / 46. Both partial.

Synthetic test wallets are generated in memory. Organization authority in the workflow test uses an explicit controlled Snapshot admin fixture.
No real DAO administrator was impersonated and no real user wallet signed during automated testing.
Test records remain isolated in the Preview database. Production database is separate and currently empty.

## Browser acceptance

Live Edge rendering against the initial https://walletface-7n0698h4m-dao-vote.vercel.app and corrected https://walletface-nmpiox22a-dao-vote.vercel.app, without disabling deployment protection:

- Explore → ENS → AI Insights → real model/tool response → official Snapshot source opened.
- Global Copilot → actual public wallet → profile source/claim state/time → wallet profile.
- Actual ENS proposal page → title, public choices/scores, timing → real English model explanation; date issue found as above.
- Agent directory empty state → registration form; mobile navigation exposes Agent/Workspace entries.
- Widths 1440 / 1024 / 768 / 375: no document horizontal overflow. Chinese, English and dark theme inspected.

[Screenshots](screenshots/platform/) accompany the earlier [v0.5 screenshots](screenshots/v05/).
Full-page capture timed out once; viewport captures succeeded. Clipboard/download automation later timed out and reset the browser session; end-to-end clipboard content and file download are not claimed as verified. Copy/export controls and their deterministic UI tests remain available. New platform wallet signing is covered by deterministic UI tests and real database signature tests;
no unattended signature was requested from a user wallet. Live upstream faults were not induced; timeout/rate-limit/malformed response recovery uses controlled tests.

## Release gates

The initial production schema request was blocked pending specific authorization; the owner subsequently approved it and migrations 001–004 succeeded.
Corrective proposal regression and formal deployment passed; subsequent real production model/MCP checks are in V05_PRODUCTION_ACCEPTANCE.md.
Calendar input uses explicit validated YYYY-MM-DD UTC dates; impossible calendar dates are rejected before querying.
Final `38a78d1` Preview browser comparison: 2026-10-01 to 2026-11-01 yielded 86 observed public votes / 64 wallets; comparison to the observed September subset yielded +86 / +64. Coverage remained partial.
Private workspace sign-in boundaries, Agent draft form, internal action preparation and all four viewport widths were inspected.
Endpoint proof tests additionally cover redirects, oversized JSON and total DNS/body deadlines.
Registry token ownership checks additionally need a trusted `ENS_RPC_URL`; no successful live ERC-8004 registry verification is claimed.
Service-domain proof needs an operator to publish the fresh well-known challenge; no external service control is invented.

Formal release approval target: [exact production change request](PRODUCTION_CHANGE_REQUEST.md).
