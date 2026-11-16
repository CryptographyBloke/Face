# Marketplace acceptance / 服务市场验收

Status recorded 2026-11-16. This report distinguishes implemented code from activated services.

| Check | Actual status |
|---|---|
| Existing public Face Copilot | Production enabled at baseline bbcc651 |
| Release 1 first Preview | READY, a179b779, https://walletface-1nteq8mo8-dao-vote.vercel.app |
| Backend / React at first candidate | 90 / 52 passed |
| Follow-up security/range regression | 94 backend / 52 React passed locally; SDK, build and avatar protocol passed; CI reruns exact next commit |
| SDK / production build / avatar EIP-712 | Passed locally; repeated by deployment build |
| Dependency audit | Root and web: zero vulnerabilities |
| Actual Neon / Snapshot | Integration passed; migration 009 isolated Preview only |
| Public MCP get_space | Real HTTP call succeeded for yam.eth during Vercel build |
| Private result isolation / concurrent claim | Integration passed; one executor, two rejected claims, no repeated terminal execution |
| A2A protocol adapter | Controlled-response tests; public HTTP acceptance pending |
| Independently owned external Agent | Not verified; curated execution remains closed by default |
| Preview browser acceptance | Blocked by Vercel sign-in; protection unchanged |
| Temporary share-link access | Rejected by automatic approval review; no workaround attempted |
| Browser widths/languages/screenshots | Pending actual rendering; no mock screenshot counted |
| Paid Agent delivery / verified income | Not implemented/activated in this candidate |
| Funded Base Sepolia settlement | Not verified; no successful transaction hash |
| Production marketplace activation | Pending candidate acceptance |

Current production payments and spending remain disabled. A test receiving address previously generated for Preview is not proof of owner control. Actual settlement acceptance needs an owner-confirmed receiving wallet, funded Base Sepolia USDC payer and explicit wallet authorization. No model calls or chargeable services were invoked by the Release 1 build verification.

New tasks are explicitly saved with consent and 30-day access expiry. Physical cleanup is not yet scheduled. The local browser harness uses ephemeral task storage with real public data and is only a developer aid; it is not evidence of durable production storage. Database restore, API keys, webhooks, organization run integration, full revenue dashboards and paid task linkage remain later release work.
