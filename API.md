# Face API v1

Local default: `http://localhost:8787`. Ethereum identity namespace only (`chainId=1`).
Other chains return 422 rather than pretending cross-chain coverage. All errors are JSON:
`{"error":{"code":"INVALID_ADDRESS","message":"Invalid EVM address"}}`.

## Reads

| Method / route | Result |
|---|---|
| `GET /health` | version, `persistent` or `read-only` mode, supported chains |
| `GET /v1/profile/1/:address` | normalized profile, avatar URI/URLs/source, verification provenance, timestamps and cache metadata |
| `GET /v1/avatar/1/:address` | avatar subset with source/provenance |
| `GET /v1/spaces/:id` | public metadata, observed counts, limited proposals, optional verified branding, scan provenance |
| `GET /v1/spaces/:id/members?page=0&search=0x` | 20 public governance participants/page; normalized and deduplicated |
| `GET /v1/spaces/:id/activity` | up to 50 recent public votes in the scan |
| `GET /v1/spaces/:id/badges` | organization-issued badge records, including revoked records |

Snapshot profiles and individual avatar reads have a 60-second upstream cache;
community imports have a 120-second cache. Profile responses allow 30 seconds of HTTP caching.
Native records are reread on every API request. `FaceClient` uses `cache: no-store` for prompt
read-back. `updatedAt` is null for upstream profiles because a trustworthy modification time
is not provided; `cache.fetchedAt` is response resolution time, not a signed profile timestamp.
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
both completeness flags were false. These are test observations, not platform totals.

Profile shape (schema illustration, not a real user's asserted data):

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
`Organization Member`, `Event Participant`, `Contributor`. Badges do not mint NFTs or tokens.
Badge identifiers and issuance times are server-generated; the signature proves the issued
payload and issuer authorization, not an independently decentralized badge registry.

## SDK

```ts
import {FaceClient} from '@wallet-face/sdk';
import {WalletFaceAvatar} from '@wallet-face/sdk/react';
const face = new FaceClient('https://your-api.example');
const profile = await face.resolveProfile({chainId: 1, address});
// React: <WalletFaceAvatar address={address} size={40} baseUrl="https://your-api.example" />
```

`npm --prefix packages/sdk run build` emits JS and type declarations. `npm pack` from that
directory prepares a package. It is intentionally private/unpublished; npm publication needs
package-name ownership, reviewed metadata and explicit authorization. No npm credentials were used.
