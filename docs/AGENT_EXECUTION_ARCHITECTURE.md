# Agent execution / Agent 执行

Services have versioned publisher-signed configuration, a fixed endpoint, one capability, bounded JSON input schema and optional price declaration. Existing Agent IDs, owner/controller/domain proofs and receiver proofs are reused. Publication does not approve execution: external endpoint/protocol/capability/schema-hash tuples require server-side FACE_EXECUTION_ALLOWLIST review. Stale profiles, expired/revoked associations and paused services cannot start a task.

The private task API creates a plan before execution. The user separately approves its hash. A PostgreSQL conditional update admits one executor; repeated execution never starts a second remote call. Interrupted leases become execution_unknown, requiring inspection instead of automatic retry. A2A task IDs and status are persisted for explicit polling/cancellation. MCP performs a single approved tools/call after initialization/schema discovery. Requests use DNS-pinned public HTTPS, fixed destinations, no redirects, bounded bodies/timeouts and no forwarded cookies/credentials. No arbitrary code, messages, transactions or file operations are allowed by the first execution release.

Internal research computes observed participation through the existing Snapshot tools. Face Copilot Research reuses the real NewAPI chat pipeline, its shared quotas and cancellation controls. Its model output streams to the UI, while the final result and evidence are persisted. Deterministic research is explicitly marked modelGenerated=false. Remote output remains untrusted text/data and is never rendered as HTML or executed as an instruction.

Anonymous runs use 256-bit capability tokens stored only as server hashes and browser session credentials, never URLs. Wallet-associated runs require the matching origin-bound wallet session; guest tokens do not bypass wallet ownership. Tasks/results require explicit storage consent and access expires after 30 days. Physical retention cleanup is a separate operator maintenance requirement; expiry does not claim deletion or backup erasure.

The public A2A compatibility service stores only public governance results and a Space ID for one-day access; request text and wallet identity are not stored. It implements JSON-RPC v1 SendMessage/GetTask/CancelTask and returns explicit terminal states. It is a platform-controlled interoperability service, not independent proof of third-party Agent ownership or reliability. OAuth-protected remote services are unsupported in this release; no credential forwarding or OAuth compliance is claimed.

Protocol sources checked: https://a2a-protocol.org/v1.0.0/specification/ and https://ts.sdk.modelcontextprotocol.io/v2/client/ . Installed SDK source/types are the authority for the MCP call signatures.

## UTC ranges and service suspension

Internal research and Copilot freeze a server-computed `[start,end)` interval (default 30 days, configurable 1–365), filter proposal creation/public vote timestamps, and recompute participant counts and ranking. Original scan provenance remains attached. Internal and A2A public reports calculate all totals in code. A time filter never establishes complete historical coverage.

`market.service.pause` is a distinct wallet-signed, revision-bound, nonce-consuming action. It atomically disables execution approval and increments the service revision, even if endpoint evidence has expired. Resuming requires publication checks and renewed operator approval. A task claimed before revocation can already be running remotely; cancellation records delivery state, without promising rollback of the remote service.

The platform-controlled public A2A service executes bounded blocking `SendMessage` (25-second data budget); it explicitly rejects non-blocking requests. The external adapter requests non-blocking execution and persists returned task IDs for `GetTask`/`CancelTask`. Autonomous background polling and crash-safe long-running internal jobs require a later durable workflow integration.

Initial storage guard: a transaction-level advisory lock bounds retained private tasks to 300 and public A2A tasks to 100, including expired records. New tasks stop with a capacity error until operator retention maintenance; existing authorized results remain readable. This caps record growth before scheduled cleanup and backup/restore acceptance. Financial and authorization records are untouched.
