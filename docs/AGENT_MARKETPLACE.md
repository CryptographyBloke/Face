# Agent Marketplace / Agent 服务市场

`/agents` lists actual service configurations and platform-provided research capabilities. Search, category, protocol and free/paid filters operate on available records; empty results are shown without invented service metrics. Existing identity-only directory remains `/agents/directory`.

`/agents/:id/playground?service=:serviceId` supports explicit task input, storage consent, plan review, execution events, streaming Copilot text, result reopening, copy and Markdown/JSON export. The selected service, endpoint, capability and parameters are displayed before execution. An interrupted request is recovered by reopening its task, rather than blindly resubmitting it. Guest recovery credentials remain in the current browser session.

`/developer/agents` shows database-computed request/completion/failure/latency records for the wallet's published services. It requires a wallet session. `/developer/agents/services/new?agentId=:id` publishes a service with a separate reviewed wallet signature after existing endpoint control and discovery. Free research services are the first public execution target. Price declarations and zero or absent settlement evidence are never presented as revenue.

Environment: FACE_EXECUTION_ENABLED=true; FACE_EXECUTION_ALLOWLIST is a server-side JSON array of reviewed {endpointUrl,protocol,capability,schemaHash} records. Platform-controlled capabilities are fixed in code. Third-party availability and read-only semantics remain operator-reviewed, separate from wallet/domain control and self-declared capability metadata.

Release 1 does not enable paid execution, mainnet, automatic spending, marketplace commissions, subscription billing, remote OAuth, unattended side effects or service reputation scores. Further releases retain independent acceptance and activation records.
