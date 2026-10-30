# Security and privacy / 安全与隐私

## Enforced boundaries

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
