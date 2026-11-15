# Face Copilot v0.5 / 治理助手架构

React → `/v1/ai/chat` → AI SDK **7.0.173** → NewAPI OpenAI-compatible model (or optional Vercel AI Gateway) → six read-only tools.
The installed package's tools, streaming, reference and testing docs were used; SDK 6 examples were not copied.
The existing Fetch API and single Vercel function are retained. Node's HTTP adapter now forwards chunks and disconnect cancellation.

## Actual tools / 已实现工具

| Tool | Data and limits |
|---|---|
| `getWalletProfile` | Existing Ethereum chain-1 resolver; public fields, avatar, source and claim status |
| `getSpace` | Existing Snapshot scan; metadata and at most 12 recent proposal summaries |
| `listParticipants` | Address search, votes/recent/address sort, page 0–24, 1–20 rows; native public profile names where available |
| `getGovernanceActivity` | Up to 20 scanned public votes, optional wallet and [start,end) Unix-second filtering; eight proposal summaries |
| `getProposal` | Official Hub, Space/hash binding, title, body ≤6,000 characters, choices, state, start/end, public scores and strategy names/networks |
| `analyzeParticipation` | All included public votes in the bounded scan; counts, top ten ranking, distribution, top-five share, last 60 observed UTC dates, two explicit [start,end) comparisons |

Tools use fixed GraphQL operations, Zod input/upstream validation and server-built provenance. There is no model-supplied URL fetch or GraphQL execution.
Public tool execution is also exposed through `/v1/ai/tools/:name`; the UI uses it as **public data retrieval**, including while model execution is disabled.
This path does not simulate a model answer. Its structured metrics are computed in code.

## Scope and evidence / 数据范围

Each scan covers at most **50 proposals / 500 votes**, with a fixed cutoff, deduplication and private-vote omission.
Proposal and vote scans are separate: the latest scanned votes can refer to proposals outside the latest 50 proposals.
`votesComplete` and `proposalsComplete` mean query exhaustion at that cutoff; Hub pagination can still move.
Every evidence card includes tool name, source, retrieval time and available scope/completeness metadata.
Only server-built `snapshot.box` / `walletface.org` evidence URLs become clickable cards. Model text is rendered as escaped text;
model-supplied links are not activated. The model references evidence IDs [1], [2]. Cards remain the authoritative structured record.
Free-form interpretation can still be mistaken; no semantic fact-checker or mathematical proof of generated text is claimed.
Private/shielded proposal scores and ballot details are withheld even if the upstream reveals them later. Strategy parameters are omitted.

## Request controls / 请求控制

- Strict text-only user/assistant history: at most eight messages, 3,000 characters/message, 10,000 UTF-8 bytes/request input.
- Request body: 16,000 bytes. No client system messages, tools, model choice or provider options.
- Four model steps, 800 output tokens/step, six tool executions, one concurrent tool execution, 45 seconds total.
- 40,000 UTF-8 bytes of messages/system per model step; provider tool schemas add overhead. This is a conservative byte context guard, not an exact tokenizer.
- A 16,000-byte output guard also stops unexpected streams. Provider retries and stream retries are zero.
- Owner-controlled beta token (32+ characters) plus **shared Redis** are mandatory, even on protected Preview.
- Atomic Redis Lua reserves requests and conservative 200,000-token allowances before any model call.
  Maximum five requests/day globally, three/IP/hour and 1,000,000 reserved tokens/day. Failed/cancelled requests keep reservations.
- Quota-store failure stops AI execution. A failed post-request usage write is returned as `metered:false`; the earlier reservation remains.
- Redis holds short-lived hashed-IP quotas and seven-day aggregate token counts, with no prompts or full addresses.
- Public data tools retain the existing process-local 60/minute limit and bounded upstream queue/cache. These free-data controls are not a global paid quota.

Quota keys deliberately have no deployment suffix, so Preview and Production sharing one Redis credential share a global budget.
Changing the model changes pricing; model-specific monetary caps require provider/Gateway account controls. Public paid AI stays restricted beta.
Redis integration is implemented and failure-tested with controlled transports. No live shared Redis was provisioned in this release.

## Streaming and cancellation / 流式与取消

NDJSON events: `tool`, `evidence`, `text`, `done`, `error`. Text and evidence are separate channels.
`done` includes usage and tool-call count; credentials, raw provider errors and reasoning traces are excluded.
Disconnect/Stop aborts model execution. A caller abandoning a shared directory lookup stops waiting; its already-started bounded cached scan can finish for other readers.
Proposal reads propagate AbortSignal into the upstream fetch. Each existing upstream request has an eight-second timeout and bounded retries.

## Data policy / 数据策略

Conversation state is component memory, up to four displayed turns, cleared on navigation/context change.
No server chat database, browser chat persistence, auto-saving or third-party analytics is added.
Copy/export is user initiated. Exports include structured tool data and provenance.
Model activation sends the selected public evidence and conversation to the configured model provider; account-level provider retention applies.
The beta access key stays in page memory and is sent only to the same-origin chat endpoint.

## Activation and cost / 激活与成本

The owner selected **NewAPI**. `FACE_AI_PROVIDER=newapi` (default), `NEWAPI_BASE_URL=https://host/v1`,
`NEWAPI_API_KEY` and `NEWAPI_MODEL` configure the server-only `@ai-sdk/openai-compatible` **3.0.92** provider.
It uses `/v1/chat/completions`, streaming tool calls and usage reporting. Base URLs are server configuration, require HTTPS by default and never come from visitors.
NewAPI official reference: https://docs.newapi.pro/en/docs/guide/feature-guide/user/api .
Controlled HTTP tests validate the actual provider adapter, tool-call round trip, request endpoint, output cap and usage aggregation.
No live NewAPI request has run because endpoint/key/model are not configured. Rates depend on the owner’s NewAPI instance and model/channel pricing.

Optional `FACE_AI_PROVIDER=gateway` selects `AI_GATEWAY_MODEL` and Gateway authentication.
See DEPLOYMENT.md. AI execution defaults off. The optional verified low-cost Gateway candidate is `alibaba/qwen3.7-flash`, which supports tools and structured output.
Live Gateway catalog checked 2026-11-15: input $0.03/M, output $0.13/M below 32K context; higher input/output tiers apply beyond that.
Illustrative request: four model steps with 10K input tokens each and 800 output tokens each costs about **$0.001616** at the lowest tier.
The conservative 200K-token reservation is an abuse allowance, not observed billing or a monetary guarantee.
Current live model spend for this implementation: **$0**; all model tests use AI SDK MockLanguageModelV4.
Read-only live ENS/Yam queries use the real Snapshot Hub. No paid plan, database, registry contract or recurring charge was created.

## Future module boundaries / 后续边界

`server/identity/profile.mjs` exports `face.agent-profile/1`, checked claim evidence requirements and an injected read-only repository resolver.
It validates records; it does not verify signatures, chain ownership, endpoints or reputation. No public Agent registry is enabled.
`packages/sdk/src/ai.ts` exports tool, context, provenance and NDJSON types through `@wallet-face/sdk/ai`.
Later MCP/A2A adapters can wrap the same validated tools after authentication and protocol conformance tests.

Owner-selected NewAPI example: `NEWAPI_BASE_URL=http://82.156.218.54/v1`,
`NEWAPI_MODEL=gpt-6.1-sol`. HTTP requires explicit `NEWAPI_ALLOW_HTTP=true`.
HTTP transports the bearer key without TLS; use the provider’s HTTPS entry when available.
The implementation is server-side JavaScript ESM through AI SDK, matching the existing `.mjs` API.
The React UI remains TypeScript. cURL is for diagnostics; all languages call the same API.
The configured example has not been called with a live key. Its pricing depends on the owner’s NewAPI plan/channel.
