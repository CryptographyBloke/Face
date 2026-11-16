# Marketplace acceptance / 服务市场验收

Status recorded 2026-11-16. This report distinguishes implemented code from activated services.

| Check | Actual status |
|---|---|
| Existing public Face Copilot | Production enabled at baseline bbcc651 |
| Release 1 verified implementation | READY, 8e8306aa; https://walletface-e1otb8b7j-dao-vote.vercel.app |
| Backend / React | 94 / 52 passed on the verified implementation |
| Follow-up security/range regression | Passed in Vercel as well as locally; SDK, production build and avatar protocol passed |
| SDK / production build / avatar EIP-712 | Passed locally; repeated by deployment build |
| Dependency audit | Root and web: zero vulnerabilities |
| Actual Neon / Snapshot | Integration passed; migration 009 isolated Preview only |
| Public MCP get_space | Real HTTP call succeeded for yam.eth during Vercel build |
| Private result isolation / concurrent claim | Integration passed; one executor, two rejected claims, no repeated terminal execution |
| A2A protocol adapter | Controlled-response tests plus actual HTTP against project-controlled service, real Neon and Snapshot; persistent task replay passed. Independently operated public A2A acceptance remains pending |
| Independently owned external Agent | Not verified; curated execution remains closed by default |
| Preview browser acceptance | Blocked by disconnected extension, Vercel sign-in and cloud-browser URL policy; protection unchanged |
| Temporary share-link access | Rejected by automatic approval review; no workaround attempted |
| Browser widths/languages/screenshots | Pending actual rendering; no mock screenshot counted |
| Paid Agent delivery / verified income | Not implemented/activated in this candidate |
| Funded Base Sepolia settlement | Not verified; no successful transaction hash |
| Production marketplace activation | Pending candidate acceptance |

Current production payments and spending remain disabled. A test receiving address previously generated for Preview is not proof of owner control. Actual settlement acceptance needs an owner-confirmed receiving wallet, funded Base Sepolia USDC payer and explicit wallet authorization. No model calls or chargeable services were invoked by the Release 1 build verification.

New tasks are explicitly saved with consent and 30-day access expiry. Physical cleanup is not yet scheduled. The local browser harness uses ephemeral task storage with real public data and is only a developer aid; it is not evidence of durable production storage. Database restore, API keys, webhooks, organization run integration, full revenue dashboards and paid task linkage remain later release work.

Release 1 actual source check (2026-11-16T11:56:28Z): ENS `[2026-10-17T11:56:13Z,2026-11-16T11:56:13Z)` matched 2 proposals by creation time and 102 public votes. Original scan: 50 proposals / 500 votes, 110 private ballots omitted, incomplete historical coverage. Public MCP also queried yam.eth. These are a recorded acceptance observation, not hardcoded UI metrics.

Follow-up privacy hardening removes the private guest access token from frontend result state and JSON exports. SDK creation still returns its credential to the authorized caller for task recovery. Browser/export-download acceptance remains pending.
