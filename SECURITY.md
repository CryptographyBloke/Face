# Security and privacy / 安全与隐私

## Enforced boundaries

- Production native authorization is bound to `https://walletface.org`. Old-domain browser
  state is not transferred. A new host requires a fresh wallet connection and signature.
- The 0.4 dependency upgrade pins Zod 4.6.7 and Vite 7.3.7 and updates source-map-js.
  Root and frontend `npm audit` reported zero vulnerabilities during release validation.
- The QA-only build labels its connected-wallet fixture and rejects signing methods.
  Standard production builds tree-shake the QA bootstrap and fixture modules.

- No private keys/seed phrases are requested or stored. Only explicit wallet signatures.
- Native EIP-712 authorization binds origin, chain 1, exact canonical payload, action,
  address, random nonce and expiry. Signature recovery is server-side. Nonce consumption
  and record mutation share one SQLite transaction. Profile revision conflicts return 409.
- Space writes freshly query Snapshot `admins` and check the recovered signer.
  Role labels and administrator authorization are separate fields.
- EIP-1271/Safe signatures are not supported and are not silently accepted. Controller-only
  wallets absent from `admins` cannot claim administration through this release.
- User text is length-limited and rendered as text. Profile links require HTTPS. Avatar
  URIs accept constrained IPFS/Arweave or HTTPS. There is no arbitrary server-side image proxy.
- Upstream endpoint configuration is server-owned, not supplied by API visitors. Address,
  Space ID, payload and upstream data are validated. POST bodies are limited to 16 KiB.
- Read endpoints are public. Signed writes require the configured exact origin. Rate limits,
  cache caps, bounded scans, timeouts and retries constrain routine load.
- Governance endpoints return public voting participation. Shielded/private votes are
  omitted. Profile claims verify control of the signing wallet.

## Limitations before production writes

Security review status: automated authorization and persistence tests; external audit pending.
Use one persistent API replica. Multiple replicas require shared rate limits and cache coordination.
Deploy behind a correctly configured TLS proxy/WAF and a durable backed-up database.
The Node adapter uses the socket peer for rate limits and does not blindly trust forwarded
headers. A reverse proxy may therefore share one limit across users until trusted-proxy
handling is explicitly configured. The Vercel preview uses its platform-provided real-IP header.

Availability/semantics of Snapshot admin metadata are trusted; upstream compromise could affect
authorization. Public official-status reads can be up
to two minutes stale; every sensitive mutation bypasses that cache. Controller changes are not
resolved separately. ENS lookup is optional and unverified when no trusted RPC is configured.

The latest signed verification is retained with each record; there is no complete append-only
audit log. SQLite tables include operational challenge rows and native public data. Operators
must define retention, backups, erasure/support procedures and incident response before pilots
collect personal data.

## Visibility and data handling

Native fields are published only after a wallet signature. `profile.hide` removes those
fields from public Face resolution but may fall back to already-public Snapshot/ENS data.
IPFS, Snapshot, browser caches and third-party copies retain their corresponding records. Profile hiding
retains the revision and hide signature to prevent stale updates. Public votes are cached in
memory, not persisted as a behavioral profile. IP-based rate counters are in-memory, bounded,
and expired on later requests; no advertising analytics is implemented.

## Reporting

Do not post secrets or an exploitable production vulnerability in a public issue. Use the
repository owner's configured private GitHub reporting channel if available; otherwise contact
the maintainer to establish a private channel.


## v0.5 Agent boundaries / AI 安全边界

The Agent has six read-only capabilities. Its server registry has no signing, voting, transaction, profile
or admin mutation tool. Native EIP-712 authorization and SQLite nonce transactions are unchanged.
Model input is text-only; fixed system instructions treat all retrieved content as untrusted data.
Zod schemas reject arbitrary URLs, GraphQL, extra properties and client-supplied system roles.
Escaped text rendering and server-built source cards prevent retrieved/model HTML from executing.
Semantic prompt injection can still mislead prose; capability boundaries and code-computed evidence remain enforced.
AI execution requires a 32-character owner beta key, model provider access and shared atomic PostgreSQL or Redis reservations.
Quotas fail closed. Conversations are page-memory only; quota stores retain hashed-IP counters and aggregate token usage. Explicitly signed saved reports are separate private records.
Provider errors are sanitized. Public data routes keep the existing bounded per-process controls; they incur no model cost.
See [actual controls and limits](docs/AI_AGENT_ARCHITECTURE.md). Preview uses owner-provided server-side NewAPI access and an owner beta token. Free Neon storage is configured; no paid service/quota was enabled.

## Signed platform operations

Platform writes have separate origin-bound EIP-712 nonces, expiry, optimistic revisions, fresh Snapshot admin policy, transactional audit and replay enforcement.
The AI and public MCP registries remain read-only. Private read sessions expire in 15 minutes and clear on wallet change.
Endpoint-control verification permits only pinned public HTTPS destinations with bounded JSON and no redirects.
Controller signatures prove EOA control at authorization time; service control, declared organization relations and registry token ownership are distinct evidence.
Registry standard conformance and real-world identities are not inferred. Production schema application requires owner approval.
Details and test limits: [platform architecture](docs/PLATFORM_ARCHITECTURE.md), [acceptance](docs/AI_AGENT_TEST_REPORT.md).

Personal-Agent associations use separate owner/controller signatures, revision-bound metadata, nonce-based remote-origin checks and independent receiving-wallet proofs. Additive migration 005 atomically consumes nonces and audits changes. Profile edits stale prior associations; owner refresh clears old controller/domain evidence. See [Release A security scope](docs/AGENT_IDENTITY_RELEASE_A.md). No model tool can invoke these writes or authorize spending.

x402 beta is fixed to Base Sepolia USDC and server-owned requirements. Unique authorization nonce/payer/asset/network plus durable transitions prevent concurrent resettlement. Reports are computed/cached before settlement; ambiguous outcomes require chain reconciliation. Independent USDC Transfer and AuthorizationUsed logs establish settlement; no model can authorize payment or alter a receiver. [Payment security details](docs/X402_RECEIVE_RELEASE_B.md).
