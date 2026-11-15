# Agent identity and release dependencies / Agent 身份与后续版本

## Versioned foundation / 已实现基础

`server/identity/profile.mjs`: strict `face.agent-profile/1` schema and `resolveAgentProfile(id,{repository})` read interface.
Fields: ID/name/description/avatar, controller chain/address/claim, capabilities, HTTPS/MCP/A2A endpoints,
ERC-8004 registry chain/address/token/specification/checked-block reference, organization claims and timestamped evidence provenance.
Each claim records self-declared/verified/revoked status. A verified state requires an evidence ID and verification timestamp.
Schema validity alone never establishes cryptographic control. The resolver expects an already reviewed repository.
No new registry contract, reputation algorithm, Agent registration UI or external endpoint fetch is active.

## Standards research / 标准核对（2026-11-15）

- ERC-8004 official text: https://eips.ethereum.org/EIPS/eip-8004 and https://ercs.ethereum.org/ERCS/erc-8004 .
  The identity registry uses ERC-721 agent identifiers and versioned registration metadata/services; reputation and validation are separate registries.
  Ownership of a registry token, an agent wallet and a service endpoint are distinct facts. Store chain, registry, token, block and the checked evidence separately.
  Treat metadata as self-declared until controller signatures and current on-chain ownership have actually been checked.
- MCP tools/authentication: https://modelcontextprotocol.io/specification/2026-07-28/server/tools and
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization .
  Pin the adopted protocol revision at implementation time. Tool lists and input/output schemas need conformance tests.
  Private HTTP capabilities require the specified OAuth resource/audience checks. Tool annotations are discovery hints, not authorization.
- A2A 1.0 Agent Card: https://a2a-protocol.org/v1.0.0/specification/ and
  https://a2a-protocol.org/latest/specification/agent-card/ .
  Keep Agent Card URL, service interface/protocol version, declared capabilities and endpoint control evidence distinct.
  Public agent-card discovery must later have SSRF, redirect, DNS/IP and size controls; v0.5 does not fetch arbitrary endpoints.

Draft and evolving standards are mapped by adapters; the internal schema carries explicit versions and preserves evidence.
These researched interfaces are future design inputs, not a claim of current ERC-8004, MCP or A2A network compatibility.

| Release | Deliverables | Concrete dependencies and exit gates |
|---|---|---|
| v0.6 Governance Intelligence | Historical indexing, saved reports, refresh jobs, time comparisons, DAO workspaces | Snapshot pagination/cutoff reconciliation; shared Postgres with versioned migrations; consent/retention/deletion controls; scheduled-job idempotency; backfill coverage tests; measured quotas |
| v0.7 Agent Profiles | Human/Agent differentiation, signed metadata, ERC-8004 resolver, endpoint control | EIP-712 controller challenge with domain/nonce/expiry; fresh registry ownership/block check; EIP-1271 design; durable transactions and replay tests; DNS/HTTPS endpoint proof and SSRF tests; revocation/ownership-transfer handling |
| v0.8 Wallet Face MCP | `resolve_wallet_profile`, `get_space`, `list_public_participants`, `get_agent_profile`, `verify_identity_claim` | Stable tool contracts, version-pinned MCP SDK/conformance; authentication and resource scopes; distributed quotas; sanitized audit and integration tests; no public verifier before evidence implementation |
| v1.0 Face Actions | Reports, announcement/proposal drafts, membership/badge preparation, approved operations | Deterministic policy engine, durable approval records, explicit human review and wallet signatures, nonce/idempotency/replay protection, operation audit, failure/rollback design and adversarial tests |

Postgres is justified by durable reports/claims/workspaces, not transient v0.5 chat. Evaluate existing Neon/Postgres resources before provisioning.
A later schema can separate `agents`, `claims`, `claim_evidence`, `service_endpoints`, `analyses`, `operation_approvals`, `usage_buckets`, and `audit_events`.
Migration `001` must include transaction/rollback and backup/restore tests before storing live authorization nonces.
Existing SQLite authorization stays intact; no automatic serverless migration is attempted.

x402 is a later API-payment experiment: evaluate payment verification, exact resource binding, budgets, idempotent settlement,
replay handling and refunds before integration. Billing and autonomous financial execution are outside v0.5.
