# Face Copilot / 治理助手架构

React → existing Vercel Fetch API → AI SDK **7.0.173** → server-only NewAPI OpenAI-compatible adapter **3.0.92** → six read-only tools.
Matching installed SDK docs/source were used. The existing green v0.4 wallet, avatar, ENS and community flows remain intact.

| Tool | Implemented data and bound |
|---|---|
| getWalletProfile | Existing chain-1 public resolver, avatar, source, verified claim state, timestamps/links |
| getSpace | Snapshot Space metadata and up to 12 recent proposal summaries from the bounded scan |
| listParticipants | Observed public participants, explicit sort/search, page 0–24, 1–20 rows |
| getGovernanceActivity | Up to 20 observed public votes, optional address/[start,end) filtering and eight proposal summaries |
| getProposal | Official Snapshot Hub, Space/hash binding, ≤6,000 body characters, choices/state/public scores, UTC ISO times, voting strategies by name/network |
| analyzeParticipation | Code-computed counts, top-ten observed ranking, distribution, top-five share, last 60 observed UTC days and two explicit range comparisons |

`GET /v1/ai/status` reports real activation prerequisites. `POST /v1/ai/chat` returns NDJSON events: tool progress, trusted evidence, text, usage/completion or sanitized error.
`POST /v1/ai/tools/:name` retrieves real public data without a model or beta key. It never simulates a model answer.
Tools accept fixed Zod schemas. No arbitrary model-supplied URL, GraphQL, signing or mutation is exposed.

## Data scope and citations

The Copilot scan remains **50 proposals / 500 votes**, fixed cutoff, deduplication, private/shielded vote omission.
Proposal and vote scans are independent; votes may reference older proposals. Query exhaustion flags do not establish universal historical completeness.
The newer persistent index is separate: bounded 100/100 pages and SQL analytics with their own coverage metadata.
Rankings describe the observed dataset. Voting does not establish organization membership or real-world identity.
Proposal scores and ballots are withheld for all privacy modes. Missing/truncated fields are explicit.

Source cards use server-built Snapshot/Wallet Face URLs, retrieval time, scope, counts and privacy omissions.
Model text is escaped; model-invented links do not become clickable citations. Evidence IDs correspond to completed tool order.
Numeric governance aggregation runs in code. Proposal UTC dates are converted by the server and copied by model policy.
The live acceptance process found and corrected a model month-conversion error; structured cards remain the authoritative values.
No semantic proof of arbitrary model prose is claimed.

## Cost and abuse controls

- At most 8 text-only history messages, 3,000 characters/message, 10KB input, 16KB HTTP body.
- At most 4 model steps, 800 output tokens/step, 6 tool calls, one concurrent tool execution, 45 seconds total.
- 40KB per-step system/message context guard and 16KB streamed output guard; no automatic provider retries.
- Owner beta token (32+ characters), provider credentials and shared quota storage are mandatory.
- Preview uses `FACE_AI_QUOTA_STORE=postgres`: atomic PostgreSQL transaction/advisory lock reserves requests/IP/token budget. Redis Lua remains an optional adapter.
- Maximum **5 requests/day globally**, **3/IP/hour**, **1,000,000 reserved tokens/day**; each attempt reserves 200,000 tokens before model execution.
- Failed/cancelled attempts keep reservations. Quota failures stop execution. A failed final usage write returns `metered:false` without releasing the reservation.
- IPs are salted/hashed. Aggregate usage is retained separately from prompts; chats stay in page memory.

NewAPI per-million input/output prices are owner/channel-specific and unavailable to this session. Estimated request charge is
`inputTokens × inputPrice / 1e6 + outputTokens × outputPrice / 1e6`.
Daily token limits bound model activity, not a trustworthy provider monetary cap. Execution therefore remains owner-controlled beta.
The development cost target is under US$1/day when provider rates permit it; no monetary guarantee or zero-spend claim is made.
Observed model usage and live results are in [acceptance](AI_AGENT_TEST_REPORT.md).

## Provider configuration

`FACE_AI_PROVIDER=newapi`, `NEWAPI_BASE_URL`, `NEWAPI_MODEL`, `NEWAPI_API_KEY` stay on the server.
The owner-selected endpoint is `http://82.156.218.54/v1`, model `gpt-6.1-sol`; plain HTTP requires explicit `NEWAPI_ALLOW_HTTP=true`.
That transport sends the bearer key without TLS. An HTTPS provider endpoint can replace it through server configuration.
Optional Vercel Gateway adapter uses `FACE_AI_PROVIDER=gateway`, `AI_GATEWAY_MODEL` and Gateway key/OIDC; it was not live-tested.
No client bundle contains model credentials. `FACE_AI_ENABLED=false` is the model execution kill switch.

## Persistent platform and future protocols

[Platform architecture](PLATFORM_ARCHITECTURE.md) covers Agent profiles, signed evidence, reports, SQL indexing, workspaces, MCP and reviewed actions.
These capabilities are independent of the six model tools. No automatically signed votes, transactions, credentials or organization changes are delegated to the model.
[Roadmap](AGENT_IDENTITY_ROADMAP.md) records standards references and remaining release dependencies.
