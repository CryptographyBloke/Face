# Durable Agent platform / 持久化 Agent 平台

React uses the existing Fetch API/Vercel Function. AI research and signed mutations occupy separate namespaces.
`server/platform/` uses Neon HTTP queries and versioned SQL under `migrations/001`–`004`.
`server/mcp/server.mjs` uses MCP SDK **2.4.0**, protocol 2026-07-28 with the SDK's stateless legacy compatibility.

## Implemented modules

| Module | Actual behavior |
|---|---|
| Governance index | Fixed Snapshot queries, 100 proposals + 100 votes/page, cutoff/offset/checkpoint/45s lease, deduplication, public ballots only |
| Analytics | SQL counts, top-20 observed ranking, vote-count distribution, UTC monthly activity, explicit [start,end) comparisons |
| Saved reports | Explicit wallet consent; server re-fetches 1–3 allowed evidence tools; private by default; summary remains author interpretation |
| Organization workspace | Fresh Snapshot admin check; revision-bound configuration and scheduled-refresh opt-in |
| Agent profiles | Public/private metadata, EIP-712 EOA controller proof, signed metadata updates, separate self-declared organization claims |
| Endpoint evidence | Fresh signed challenge; pinned public HTTPS DNS target; 32KB JSON, no redirects/private IPs, five-second timeout |
| Registry reference | Declared chain-1 ERC-721 reference; configured trusted RPC can check `ownerOf` at a recorded block. Token ownership and ERC-8004 conformance are separate |
| Read-only MCP | `resolve_wallet_profile`, `get_space`, `list_public_participants`, `get_agent_profile`, `verify_identity_claim` |
| Reviewed actions | Internal report publication, announcement records, proposal drafts, organization badge issue/revoke and role records |

Agent API responses carry `schemaVersion:1`. `server/identity/profile.mjs` retains the portable claim/evidence schema.
`GET /v1/platform/agents/:id/card` returns a Wallet Face discovery manifest, not a claim of A2A execution conformance.
A2A URLs identify operator-hosted Agent Cards; Wallet Face does not execute those services.

## Authorization

Every persistent user mutation: request challenge → visible content review → EOA typed-data signature → server validation → single PostgreSQL transaction.
Domain `Wallet Face Agent Platform`, version 1, chain 1, origin-derived salt. Authorization binds actor/action/exact payload hash/origin/random nonce/five-minute expiry.
The database locks and consumes a nonce together with the mutation and audit insert. Agent/organization/action revisions prevent stale writes.
Actions require separate preparation, approval and execution signatures; approval binds the stored content hash. Current Snapshot admin access is rechecked on each stage.
Execution affects Wallet Face records only. Failed transactions roll back all writes and leave the nonce unused for a manual retry within expiry.
There is no blockchain transaction, Snapshot vote submission, external message delivery or private-key custody.

Private reads use a wallet-authorized, origin-bound 15-minute HMAC session kept in page memory and cleared on wallet change.
The signed session grants private workspace reads; the explicit admin refresh button can refresh public index data after a fresh administrator check.
The AI tool registry cannot call any platform mutation. Public MCP exposes no private tool; future private MCP needs OAuth resource/audience/scopes.

## Storage and operations

Tables: challenges, agents, reports, organizations, actions, organization_records, audit_events, proposals, votes, scan_jobs, quota_buckets, schema_migrations.
Chats are not persisted. Explicitly saved reports and authorization evidence are retained. Expired challenges remain until an owner-reviewed retention job is added.
Public organization records omit proposal drafts; drafts stay in the controller's private action workspace. Badges are issuer attestations.
Audit events are append-only through the API; this is not an externally anchored immutable log.

Preview project: `soft-paper-81147406`; database `walletface`. Empty formal database: `walletface_production`, schema application awaits approval.
No SQLite authorization data has been migrated. The existing Worker/D1 alternative remains in its branch.
Daily Vercel cron at **03:17 UTC (11:17 Singapore)** is disabled unless `FACE_SCHEDULED_REFRESH=true` and a 32+ character `CRON_SECRET` are configured.
It refreshes at most three opted-in spaces, one page each; stale administrators are skipped. No unlimited retries/backfill are scheduled.

## Limits and boundaries

Platform POST JSON and Node ingress: 32KB; AI/native mutation ingress remains 16KB. Shared platform write quota: 100 requests/hour globally, 20/IP/hour.
Analytics pagination/ranking and workspace lists are bounded. Index query exhaustion describes the current observed source, not universal historical completeness.
Source records can change during pagination; no full reconciliation or deleted-record guarantee is made.
The free database has provider-enforced storage/compute/transfer quotas; exhaustion pauses service. No paid quota or recurring charge was enabled.
