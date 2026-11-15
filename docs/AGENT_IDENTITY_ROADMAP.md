# Agent identity and protocol roadmap / Agent 身份与协议路线

2026-11-15. Internal Agent records expose `schemaVersion:1`; strict native metadata inputs and a portable claim/evidence schema are versioned in source.
Public profiles separate controller signature checks, service-domain evidence, registry-token ownership and self-declared organization relationships.

## Implemented foundation

- Public Agent directory/profile/editor, EOA controller signatures and revision-bound metadata updates.
- Fresh service-domain control challenge with public-HTTPS/DNS pinning/size/timeout safeguards.
- Optional trusted-RPC ERC-721 token owner check with registry/chain/token/block/time. This does not certify registry standard conformance.
- Public discovery manifest; operator-declared MCP and A2A Agent Card URLs remain distinct from verified endpoint control.
- MCP SDK 2.4.0 exposes five read-only Wallet Face tools with real SDK-client tests; private capabilities are not exposed.
- Saved private analyses, bounded persistent governance pages/SQL comparisons, opt-in refresh configuration and signed organization workflows.

## Standards checked

ERC-8004 official draft: https://eips.ethereum.org/EIPS/eip-8004 . Identity uses ERC-721 IDs plus versioned registration files/services;
reputation and validation are separate registries. The current implementation checks an optional declared token owner, not contract conformance,
agentURI contents, delegated operators or an external reputation score. No registry contract is deployed by this release.

MCP: https://modelcontextprotocol.io/specification/2026-07-28 and https://ts.sdk.modelcontextprotocol.io/v2/ .
The pinned SDK's current per-request handler supports modern envelopes and stateless legacy HTTP compatibility.
Future private capabilities need OAuth audience/resource/scope enforcement; a workspace JWT is not an MCP OAuth token.

A2A: https://a2a-protocol.org/latest/specification/agent-card/ . Agent Cards identify supported interfaces and protocol versions.
Wallet Face stores declared operator Card URLs and serves its own versioned discovery manifest; it does not advertise unimplemented A2A task execution.

x402: https://www.x402.org/ and https://github.com/coinbase/x402 . Payments remain outside this release.
A future paid API needs exact resource/amount/network binding, pre-authorized spending, atomic reservation/settlement, replay protection,
independent transaction verification and a refund/error policy. No billing or autonomous financial execution is enabled.

## Remaining technical dependencies

| Release track | Implemented subset | Remaining gates |
|---|---|---|
| v0.6 Governance Intelligence | Durable bounded pages, SQL analytics, private reports, opted-in daily refresh and DAO settings | Reconcile deletions/source changes, stable pagination, deeper historical coverage, retention/deletion controls, workload/cost measurements |
| v0.7 Agent Profiles | EOA control, signed metadata, HTTPS control evidence, optional token owner read | Real operator endpoint proof, trusted RPC live verification, recognized registry conformance/agentURI, controller transfers, EIP-1271 contract wallets |
| v0.8 MCP | Five public read-only tools, protocol SDK-client acceptance | Broader client interoperability, private OAuth server/resource scopes, per-client API quotas and operational monitoring |
| v1.0 Face Actions | Deterministic preparation/approval/execution/cancellation, Wallet Face report/announcement/draft/badge/role records and audit | External Snapshot publication, chain operations and third-party messaging adapters require separate explicit authorization, wallet approval and compensating operations |

Every external consequential adapter must bind reviewed content, current permission, exact destination, nonce and expiry, retain audit evidence,
and define failure/rollback behavior. The AI runtime remains incapable of invoking signed platform writes directly.
Existing SQLite native profile/admin authorization has not been migrated; transactional backup/restore validation remains a prerequisite for that separate work.
