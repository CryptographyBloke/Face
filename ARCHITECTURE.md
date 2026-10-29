# Wallet Face 0.3 architecture / 架构

## Boundaries

- `web/src/App.tsx`: retained free browser avatar publisher. Snapshot signature domain/type and Pineapple upload contract are unchanged. Native claims are optional.
- `web/src/Product.tsx`, `web/src/product/`: bilingual navigation, public profile, spaces, administration and developer pages. Pages are lazy-loaded. React renders user text as text, not HTML.
- `server/app.mjs`: Fetch-compatible versioned API, request validation, CORS, rate limits and JSON errors.
- `server/snapshot.mjs`: fixed official Hub endpoint, schema-validated queries, bounded scans, serialized upstream requests, timeout/retry, single-flight caching.
- `server/resolver.mjs`: deterministic native → Snapshot → optional ENS precedence. Each avatar retains its original URI and chosen source. Empty or unsafe URIs fall through to the next source. Browser image errors try the chosen source's gateways, not silently another identity source.
- `server/auth.mjs`: operation-specific EIP-712 challenge and server-side EOA signature verification.
- `server/store.mjs`, `server/migrations/001.sql`: SQLite persistence, unique challenges, one-use transactions and indexed community records.
- `packages/sdk/`: typed read client and React avatar/identicon, independent of the main website.
- `examples/`: separate directory, proposal-author and wallet-account demo components. These are project examples, not claimed external adoption.
- `api/index.mjs`: read-only Vercel adapter. No ephemeral writable database is used on serverless functions.

## Public facts versus organization identity

Snapshot supplies public Space metadata, the current `admins` list, proposal metadata,
and available public vote records. This version does not infer identities from shielded voting.
Votes associated with a nonempty proposal `privacy` field are omitted even if the upstream
later reveals some data. `members` in API routes is a compatibility route name only: its
response kind is `public_governance_participants`, never an admitted membership list.

Counts refer to a scan of at most 50 proposals and 500 votes. `*Complete` means the query
reached the end rather than a full audit of all historical participation. A fixed creation
cutoff reduces moving-page effects; Hub offset pagination can still change on deletions or
same-timestamp ordering. Deduplication handles overlap; completeness is not guaranteed under
concurrent upstream edits. Do not use these observations for admission, rewards or eligibility.

Native profile claims prove control over one Ethereum address, not a person's legal identity,
contribution quality or DAO membership. Roles are labels issued by authorized admins, not
permissions to administer Wallet Face. Badges retain issuer, source permission check,
signature, issuance/expiry and revocation provenance.

An imported Space is a public mirror by default. Saved branding is shown as organization-verified
only if its signer is still present in the cached current Snapshot `admins` data. The read
status is bounded by cache freshness (up to two minutes), not an eternal organization assertion.
Each sensitive write queries admins afresh; a cached browser role never grants write access.
Controllers not in `admins` and EIP-1271 wallets are deliberately unsupported for administration.

## Data ownership and persistence

User signatures authorize exact native profile changes; images are still uploaded through
Pineapple/IPFS. Snapshot remains a signed-profile compatibility service. Optional ENS reads
use a configured trusted Ethereum RPC, and existing browser ENS writes remain optional.
Wallet Face stores native claims, latest authorization proofs, branding, badges and roles
centrally in SQLite. Challenges expire in five minutes and old rows are pruned; signed record
proofs remain with the current record. There is no complete historical audit log or durable
governance index. Hiding a native profile removes its public native fields, not already public
Snapshot/IPFS data. Hidden records retain a revision and the hide-operation proof.

SQLite runs on one persistent Node 24 process with WAL. A single read-modify-write transaction
consumes a nonce and applies the mutation. Profile revisions prevent overwriting a newer claim.
Multiple replicas require shared durable storage and distributed limits before enabling writes.

## Centralization

User-held keys and content addressing improve portability; the frontend host, Snapshot Hub,
Pineapple pinning, gateways and Wallet Face's native database remain operational dependencies.
This is not a fully decentralized or universally supported identity registry. The API and
database schema are self-hostable; user signatures and original image URIs are preserved.

## Sources checked

- Official Snapshot API docs: https://docs.snapshot.box/tools/api
- Official source: https://github.com/snapshot-labs/snapshot-docs/blob/master/tools/api/README.md
- Space administration: https://github.com/snapshot-labs/snapshot-docs/blob/master/user-guides/spaces/settings.md
- Live `hub.snapshot.org/graphql` queries for `yam.eth`, `admins`, proposal privacy,
  votes, `created_lte`, `first`/`skip` were checked during implementation on 2026-10-29.
