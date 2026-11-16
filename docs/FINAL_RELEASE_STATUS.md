# Wallet Face — final release candidate / 最终发布候选

Updated 2026-11-16 Asia/Singapore. Public Copilot, signed Agent identity and metadata discovery are live. Production payment/spending execution remains disabled after automatic approval rejected the unconfirmed receiving address and incomplete funded-settlement acceptance. [Current deployment and actual validation](PUBLIC_AGENT_RELEASE.md).

| Track | Branch / application commit | PR | Working deployment |
| --- | --- | --- | --- |
| Public release live | feature/snapshot-inspired-ui-v04 / bbcc6511c993ac1586ff1d8df0910556043358bf | https://github.com/CryptographyBloke/Face/pull/9 (merged) | https://walletface.org/ai |
| Prior v0.5 rollback | feature/face-ai-agent-v05 / 5d745097ddfa82a05980e40cf74c722da7398c59 | https://github.com/CryptographyBloke/Face/pull/4 (merged) | Retained Vercel deployment dpl_5UyBL32456RYrRm9GN4WtxowTvXo |
| A — personal identity | feature/face-agent-identity-a / c9593a4e26740e54f7d71baae6d600346f54afe4 | https://github.com/CryptographyBloke/Face/pull/5 | https://walletface-p5vgkoxru-dao-vote.vercel.app/my-agents |
| B — testnet receive | feature/face-x402-receive-b / 2d1bd5ec23867210f0b99fffdbfe65ea0c8e2a88 (evidence 40e4efc) | https://github.com/CryptographyBloke/Face/pull/6 | https://walletface-fjnvvtacc-dao-vote.vercel.app/payments |
| C — reviewed spending | feature/face-controlled-spending-c / db81f77e803752b495dba979af379ff1e9176773 | https://github.com/CryptographyBloke/Face/pull/7 | https://walletface-2prdt0hnr-dao-vote.vercel.app/spending |
| D — interoperability | feature/face-agent-interop-d / 438708974c87a5c3972e5c41401e5c7db16b89ef | https://github.com/CryptographyBloke/Face/pull/8 | https://walletface-c95g87iyr-dao-vote.vercel.app |

## Implemented / 已实现

Real streaming NewAPI governance Copilot (six strictly read-only tools), wallet/Space/proposal context, deterministic analytics, trusted source cards, Chinese/English, bounded history/output/tool calls and PostgreSQL global quotas. Public MCP uses the official SDK and five read-only identity/governance tools. Saved reports, observed historical pages and reviewed internal DAO actions retain prior authorization boundaries.

Owner/controller-signed personal Agent linking, local profiles, fresh remote-domain challenges, update invalidation, revocation, receiving-wallet signatures, curated historical ERC-8004 evidence, service/capability/price declarations, versioned REST/SDK identity/discovery interfaces.

Official x402 v2 Base Sepolia exact-USDC receive, visible human review, durable quotes/receipts, replay/concurrency controls, prepared report before settlement, independent Transfer+AuthorizationUsed chain verification and reconciliation without repeated settlement. Independent Agent-wallet policies, serial budget reservation, per-quote owner approval, signer-boundary permit checks and a PostgreSQL settlement trigger.

MCP/A2A metadata discovery requires profile authorization, an active association and recent domain control. Capabilities remain operator claims; remote tools/tasks are never invoked by Copilot.

## Actual validation / 实测

- v0.5: real production model generation, Snapshot scans for ENS/Yam, proposal explanation and actual external MCP client; desktop/mobile screenshots retained.
- A/B: Edge at 1440/1024/768/375, Chinese/English, actual signed synthetic profile rendering and live 402 offer; no horizontal overflow. Screenshots: docs/screenshots/platform.
- C: Vercel independently passed 72 backend +46 React tests, SDK/application builds, avatar EIP-712 protocol regression and real Neon policy tests. Five simultaneous 1000-unit approvals under a 2000-unit daily cap accepted two. Missing/cancelled approvals could not pass the DB guard; executing approval was consumed before settlement.
- D adds six backend metadata/security tests and one React interaction test. Vercel deployment dpl_2GWuLak5yeefKhdVwoN6uRzbkPwz independently passed 78 backend +47 React tests, SDK/application builds and the avatar EIP-712 protocol regression; state READY at application commit 4387089. Real Neon signed discovery/replay tests and discovery of the five production MCP tools passed. Remote domain-control/A2A data were controlled fixtures.
- Root/web audits have zero known vulnerabilities at verification. No user's wallet was signed automatically.

## Final release gates / 正式发布前的实际步骤

1. Public production browser checks now pass at all four required Copilot widths; signed identity/connection and disabled spending/payment screens render accurately. Export-file completion remains unverified after download automation timed out. No share-link bypass or protection change was made.
2. One funded Base Sepolia USDC payment, explicitly approved in the payer's wallet, followed by actual chain settlement, cached delivery and repeat-retrieval acceptance. Current evidence explicitly records realSettlement=false. Amount is 0.001 test USDC. The configured Preview receiver is a generated test address; select the operator receiver before final activation.
3. Exercise a real owner-selected remote Agent endpoint if remote ownership/discovery badges are to be activated for that Agent. Controlled fixture A2A/domain tests never become public verified claims.
4. PRs #5–#9 are merged; additive migrations 005–008 and grants restricted to new tables/sequences are applied to the production platform database. Production deployment dpl_J6KgKFBSe23PFW5NVvti99tkzSDA serves the tested public candidate. Payments/spending are off; mainnet needs separate activation after testnet acceptance. Native SQLite authorization is unchanged.

Production rollback remains dpl_GjPfmyukWFpKuzk5AYHS83YxF9vD (3f505dc3); accepted v0.5 deployment dpl_5UyBL32456RYrRm9GN4WtxowTvXo is also retained. No registry contract, paid plan, custody, subscription, commission or autonomous financial operation was added.

## Cost and configuration / 成本与配置

Existing free Neon project only; isolated identity/payment Preview database, separate production database, scoped runtime roles and additive migrations. Existing Vercel project/domains are preserved.

Observed NewAPI acceptance usage: 131,006 provider-reported tokens including 23,732 for the two public-release chats; A–D checks made no paid model calls. NewAPI channel prices are owner-managed and unavailable to this code, so monetary AI cost is not fabricated. Public caps are 200 requests/day, 10/IP/hour, 40M reserved tokens/day, 800 output tokens/step, four steps/six tools and 45 seconds; inspect the configured status for exact values. The owner reports a provider-side key spending cap.

Server-only provider credentials already exist. Trusted ENS/Base Sepolia RPCs enable real registry reads. Full funded settlement, confirmed operator receiver, real remote ownership and mainnet activation remain pending; they are not claimed as complete.
