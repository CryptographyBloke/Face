# Face API v1

Public API: `https://walletface.org`; local default: `http://localhost:8787`. Ethereum identity namespace only (`chainId=1`).
Other chains return 422. All errors are JSON:
`{"error":{"code":"INVALID_ADDRESS","message":"Invalid EVM address"}}`.

## Reads

| Method / route | Result |
|---|---|
| `GET /health` | version, `persistent` or `read-only` mode, supported chains |
| `GET /v1/profile/1/:address` | normalized profile, avatar URI/URLs/source, verification provenance, timestamps and cache metadata |
| `GET /v1/avatar/1/:address` | avatar subset with source/provenance |
| `GET /v1/spaces/:id` | public metadata, observed counts, limited proposals, optional verified branding, scan provenance |
| `GET /v1/spaces/:id/summary` | Space metadata and source/timestamp; no participant-history scan |
| `GET /v1/spaces/:id/members?page=0&search=0x&sort=recent` | 20 public governance participants/page; sort: recent, votes, address; search before pagination |
| `GET /v1/spaces/:id/activity` | up to 50 recent public votes in the scan |
| `GET /v1/spaces/:id/badges` | organization-issued badge records, including revoked records |

Snapshot profiles and individual avatar reads have a 60-second upstream cache;
community imports have a 120-second cache. Profile responses allow 30 seconds of HTTP caching.
Native records are reread on every API request. `FaceClient` uses `cache: no-store` for prompt
read-back. `updatedAt` is null for upstream profiles because a trustworthy modification time
is unavailable; `cache.fetchedAt` records response resolution time.
Read CORS is public, without credentials. Default limit: 60 incoming requests/IP/minute/process;
Snapshot calls are serialized and spaced by at least 1.1 seconds. Upstream calls time out
after 8 seconds and retry transient failures up to two times with bounded backoff.

Example real query (responses vary with live data):

```bash
curl http://localhost:8787/v1/spaces/yam.eth
curl http://localhost:8787/v1/spaces/yam.eth/members?page=0
```

Implementation smoke test on 2026-10-29 returned HTTP 200 for those routes. With the smoke
script's deliberately smaller limits it observed 20 wallets from 20 votes and five proposals;
both completeness flags were false.

Profile response schema:

```json
{"chainId":1,"address":"0x…","avatar":{"uri":null,"resolvedUrl":null,"urls":[],"source":"none"},"profile":{"name":null,"bio":null,"links":[],"revision":0},"provenance":{"profileClaimVerified":false,"sources":[],"warnings":[],"verification":null},"updatedAt":null,"cache":{"fetchedAt":"ISO timestamp","ttlSeconds":60}}
```

## Signed writes

Only the persistent deployment enables writes. Read-only previews return 503, before
requesting user authorization. No reusable login credential or bearer token is issued.

1. `POST /v1/challenge` with `{address, action, payload}` and the configured `Origin` header.
2. Inspect the returned normalized `payload` and EIP-712 `typedData`; explicitly sign it.
3. `POST /v1/execute` with `{nonce, signature, payload}` using the returned payload exactly.

The server fixes chain 1, domain `Wallet Face`, version `1`, origin-bound salt, random
32-byte nonce, payload hash, action and five-minute expiry. Each write verifies the EOA
signer and consumes the nonce atomically with its mutation. Wrong origin, tampering,
replays, expiration and stale profile revisions are rejected.

| Action | Payload |
|---|---|
| `profile.upsert` | `{name,bio,avatarURI,links,revision}` |
| `profile.hide` | `{revision}` |
| `space.brand` | `{spaceId,name,about}` |
| `role.set` | `{spaceId,recipient,role}`; an empty role clears the displayed label |
| `badge.issue` | `{spaceId,recipient,type,evidence,expiresAt}`; expiry is seconds or null |
| `badge.revoke` | `{spaceId,id}` |

Space-scoped operations require current Snapshot `admins` authorization. Badge types:
`Organization Member`, `Event Participant`, `Contributor`. Badge records are stored in SQLite.
Badge identifiers and issuance times are server-generated; the signature proves the issued
payload and issuer authorization.

## SDK

```ts
import {FaceClient} from '@wallet-face/sdk';
import {WalletFaceAvatar} from '@wallet-face/sdk/react';
const face = new FaceClient('https://your-api.example');
const profile = await face.resolveProfile({chainId: 1, address});
// React: <WalletFaceAvatar address={address} size={40} baseUrl="https://your-api.example" />
```

All SDK read methods accept optional `RequestInit`, including an AbortSignal. Directory reads
accept `directory(id, page, search, options, sort)`; the default sort remains recent.

`npm --prefix packages/sdk run build` emits JS and type declarations. `npm pack` from that
directory prepares a package. It is intentionally private/unpublished; npm publication needs
package-name ownership, reviewed metadata and explicit authorization.


## Face Copilot v0.5 / 治理助手

| Endpoint | Contract |
|---|---|
| `GET /v1/ai/status` | Available flag, data-only/restricted-beta mode, model ID, missing config names, six tools and limits |
| `POST /v1/ai/tools/:name` | Strict tool input → `{tool,data,provenance,untrustedContent:true}`; public same-origin read-only research |
| `POST /v1/ai/chat` | `{messages:[{role:"user" or "assistant",content}],context:{spaceId?,address?,proposalId?},language:"zh" or "en"}` → NDJSON |

Chat requires `Authorization: Bearer <owner beta key>` and exact application Origin. Native mutation routes remain independent.
Example public tool request: `POST /v1/ai/tools/getProposal` with `{spaceId:"ens.eth",proposalId:"0x…64 hex characters"}`.

Tool inputs:
- `getWalletProfile`: chainId=1, address.
- `getSpace`: spaceId.
- `listParticipants`: spaceId, search (address, ≤100 chars), sort (votes/recent/address), page 0–24, limit 1–20.
- `getGovernanceActivity`: spaceId, limit 1–20, optional address/start/end (Unix seconds, [start,end)).
- `getProposal`: spaceId, full 32-byte proposal hash.
- `analyzeParticipation`: spaceId, up to two explicit `{start,end}` ranges.

Stream events are `tool` (name/status), `evidence` (ID/validated tool result), `text` (delta),
`done` (usage/toolCalls/metered), or `error` (safe code/message). Client must check terminal completion.
Errors include AI_DISABLED (503), BETA_ACCESS (401), AI_QUOTA (429), QUOTA_UNAVAILABLE (503),
VALIDATION (400), BODY_SIZE/INPUT_LIMIT (413); mid-stream MODEL_ERROR, NO_EVIDENCE, CONTEXT_LIMIT, OUTPUT_LIMIT and CANCELLED.
A partial stream can contain useful evidence before an error; the client preserves it and offers manual retry.
All data responses include source time and applicable scan scope. See [exact controls](docs/AI_AGENT_ARCHITECTURE.md).
SDK types: `@wallet-face/sdk/ai`. Published Agent records and read-only MCP are implemented in the platform preview.

## Platform API / 平台接口

All routes start `/v1/platform`. GET: `status`, `agents?q=`, `agents/:uuid`, `agents/:uuid/card`, `reports/:uuid`, `organizations/:space`, `analytics/:space?start=&end=&compareStart=&compareEnd=`.
Wallet read session required for private `workspace`, `actions/:uuid`, `audit/:target`; private reports/Agent records return only to the owner.
POST `challenge`: `{actor,action,payload}` → `{typedData,payload,endpointControl?}`. POST `execute`: `{nonce,signature,payload}`.
Strict payload schemas: `server/platform/schemas.mjs`. Actions: session.create, agent.register/update/verify.endpoint/verify.registry, report.save, organization.configure, action.prepare/approve/execute/cancel.
POST `index/:space` requires an authenticated current Snapshot administrator; refreshes one public page. GET `refresh` requires the configured cron secret.
POST `/v1/mcp` is the public read-only MCP endpoint; supported tools are listed in [platform architecture](docs/PLATFORM_ARCHITECTURE.md).
There are no private MCP tools, arbitrary URL/GraphQL operations or automatic financial actions.

Release A adds versioned personal-Agent evidence and signed association actions. See [exact routes and evidence semantics](docs/AGENT_IDENTITY_RELEASE_A.md). Existing mutation namespaces and free profile/governance APIs are preserved.

Release B adds optional testnet-only `/v1/payments/status`, `/report`, `/receipts` and `/receipts/:id`. The report uses x402 v2 PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE. [Exact price, authorization and receipt semantics](docs/X402_RECEIVE_RELEASE_B.md). Free endpoints retain their existing contract.
