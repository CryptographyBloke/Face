# Release A — Personal Agent identity / 个人 Agent 身份

Based on the merged, production-validated v0.5 (`48b3d6d`). Original feature branch and production deployment remain available for rollback.

## Implemented / 已实现

`My Profile → My Agents → Connect Agent` (`/my-agents`). Multiple Agent profiles per wallet; local profiles, separate runtime controllers, HTTPS/MCP/A2A references, capability and service-price declarations, optional curated ERC-8004 references.

The existing Agent `controller` column remains the **profile publishing wallet** for v0.5 compatibility. Optional `metadata.agentController` identifies the runtime controller. Both labels are visible. The profile publisher signs changes; an association owner signs the exact profile revision and metadata hash; a separate declared controller signs confirmation. Remote associations become active only after every declared service origin passes a fresh, nonce-bound HTTPS domain-control challenge. Local profiles have no public service endpoints.

Changing a profile makes associations stale. Owner refresh clears controller/domain evidence and requires fresh confirmation. Disconnect/revoke is signed, atomic and terminal for that association; historical evidence is retained. A new association for the same owner/profile cannot replace the revoked record silently.

Paid service declarations are metadata. A declared receiver must independently sign a nonce-based proof for that profile revision and network. Profile or receiver wallet can revoke it. No funds are moved in Release A.

ERC-8004 checks use a fixed registry allowlist (Ethereum / Base Sepolia), a configured trusted RPC, chain verification and one block for ownerOf/tokenURI/getAgentWallet. Registered NFT owner must match the profile publishing wallet. Store block/time/source; URI content is not fetched and service quality remains unassessed. Evidence is historical; a current-chain ownership check is needed before consequential use.

## Evidence semantics / 证据含义

| Record | Proven fact | Scope |
| --- | --- | --- |
| Profile signature | Profile wallet authorized exact metadata | Recorded signature/revision |
| Owner + controller signatures | Both wallets authorized exact association | Current profile revision; revocable |
| Endpoint challenge | Exact nonce JSON was served by declared HTTPS origin | Recorded retrieval time; no reliability promise |
| ERC-8004 reference | Curated registry returned owner/URI/payment wallet | Recorded block/time |
| Receiver signature | Receiving wallet authorized declaration | Exact profile revision/network; revocable |
| Capabilities/prices | Publisher declaration | Delivery and reputation unverified |
| Local Agent | Profile metadata only | No publicly reachable service advertised |

## API / 接口

All writes retain the existing `POST /v1/platform/challenge` → human wallet review → `POST /v1/platform/execute` flow. EIP-712 authorization domain version 1, chain 1, origin, action, actor, payload hash, random nonce and 5-minute expiry. Workspace JWT authorizes private reads for 15 minutes. Private receiver proof is available after publishing the relevant profile; private profile metadata remains restricted to the publishing wallet.

- `GET /v1/platform/my-agents`: authenticated owner/controller list (50 max).
- `GET /v1/platform/links/:id`: authenticated evidence and association revision.
- `GET /v1/platform/agents/:id/identity`: public published profile evidence; private profile requires publisher session.
- Actions: `identity.link`, `identity.link.confirm`, `identity.link.refresh`, `identity.link.disconnect`, `identity.link.revoke`, `identity.verify.endpoint`, `identity.verify.wallet`, `identity.wallet.revoke`, `identity.verify.registration`.
- SDK: `resolveAgentIdentity(client, id, options)` and `PersonalAgentIdentity` v1.

## Storage and operation / 存储与运行

Additive migration `005_personal_agents.sql`: agent_links, agent_wallet_proofs, agent_registration_evidence and atomic apply_identity_change. Nonce consumption, revision checks, record changes and audit insertion share one PostgreSQL transaction. Lock order is challenge → profile → association. Server-computed endpoint evidence cannot be supplied by the client.

`FACE_IDENTITY_ENABLED=true` activates actions/read routes. Optional `FACE_IDENTITY_DATABASE_URL` selects isolated Agent platform storage when enabled; production continues using its existing database unless explicitly configured. Preview uses an empty `walletface_identity_preview` database in the existing free Neon project and a database/schema-scoped runtime role. The Vercel project is currently unlinked from Git, so branch-specific env creation is unavailable; additive identity-only Preview variables preserve v0.5's default connection. No project, paid compute or subscription added.

Optional `ENS_RPC_URL` / `BASE_SEPOLIA_RPC_URL` enable real registry reads. Without them, a registration check returns a clear configuration error. Registry validation tests use controlled clients and must not be described as live chain verification.

`FACE_IDENTITY_VERIFY_ON_BUILD=true` runs synthetic-wallet acceptance against the isolated Preview DB only. It writes `identity-verification.json`, creates private test profiles and withdraws the one temporarily published receiver test profile. It never signs a user's connected wallet.

## Validation / 验证

Automated: 59 backend tests, 40 React tests; SDK build, application build and avatar EIP-712 protocol regression pass. Added tests cover forged controller/receiver, signature substitution, profile changes, revocation, domain nonce/context, local/public schema contradictions, arbitrary registry and wrong RPC chain. Existing SSRF tests cover private networks, DNS pinning, redirects, response bounds and deadlines.

Real Preview database checks and browser evidence will be appended after deployment. Endpoint-control success uses controlled JSON fixtures in unit tests; no third-party service ownership is claimed. Payments are a separate Release B/C.
