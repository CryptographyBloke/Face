# Release D — Agent interoperability / Agent 互操作

MCP/A2A metadata discovery extends the signed personal-Agent foundation. It leaves external tool execution, A2A task execution and payment signing outside the Copilot runtime.

## Implemented interfaces / 已实现接口

- The public MCP endpoint remains /v1/mcp with exactly five read-only tools: resolve_wallet_profile, get_space, list_public_participants, get_agent_profile, verify_identity_claim. The two Agent tools now include bounded personal association and receiving-wallet evidence when personal identity is enabled. Private profiles remain private; wallet sessions are not exposed as MCP OAuth credentials.
- GET /v1/platform/agents/:id/discovery emits walletface.agent-discovery/2: publisher-signed endpoint declarations, runtime controller, local/public distinction, capability and pricing declarations, association evidence, receiver checks, historical registry evidence, metadata sources and retrieval times.
- Agent profile pages display service discovery records. Profile publishers can sign agent.probe.mcp / agent.probe.a2a through the existing reviewed nonce authorization flow.
- Probes require the exact currently declared endpoint and an active owner/controller association with domain-control evidence from the preceding 24 hours. Changed profiles invalidate the records; rechecking requires a new signature.
- MCP probing uses the maintained SDK 2.4.0. A pinned-DNS HTTPS transport allows initialization, initialized notification and tools/list only, at most three POSTs, 32 KB response and five seconds per network request. Redirects, private networks, credential URLs, forwarded cookies/Authorization and arbitrary methods are rejected. Long-running SSE GETs are disabled for discovery.
- A2A reads bounded HTTPS Agent Cards and validates v1 HTTP-compatible identity, supportedInterfaces, capability and skill metadata. It records operator declarations; Agent Card JWS signatures are not verified and task delivery is not tested.
- Agent discovery history and nonce consumption share an atomic PostgreSQL transaction and audit record (migration 008). No registry contract or proprietary reputation system is deployed.

## Standards / 标准

Checked against maintained primary sources on 2026-11-15 UTC:

| Standard | Implementation relationship |
| --- | --- |
| ERC-8004 | Curated Ethereum/Base Sepolia registry references and historical owner/agent-wallet reads; source block/time retained. Registration alone gives no service-quality badge. |
| MCP | Official TypeScript client/server 2.4.0. Server supports current per-request handling and stateless older clients. The client negotiates its supported protocol; actual tool discovery is tested with the SDK. |
| A2A | Agent Card v1 supportedInterfaces and per-interface protocol versions; HTTP metadata only. Wallet Face discovery manifest is separately versioned and never advertised as an A2A task service. |
| x402 v2 | Official 2.31.0 SDK, exact EIP-3009 testnet receive and durable receipts in Release B; funded settlement gate remains. |
| AP2 v0.2 | User intent/action authorization/receipt concepts guide Release C; no AP2 mandate/credential conformance is claimed. |
| Programmable wallets | An independent smart-account permission manager/policy signer is required before future autonomous execution; current mode uses explicit human wallet confirmation. |

Primary sources:
- https://eips.ethereum.org/EIPS/eip-8004
- https://github.com/erc-8004/erc-8004-contracts
- https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28
- https://github.com/modelcontextprotocol/typescript-sdk
- https://a2a-protocol.org/latest/specification/agent-card/
- https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
- https://ap2-protocol.org/ap2/specification/

## Deployment and verification / 部署与验证

Existing Vercel project and isolated Neon Preview database; additive migration 008. FACE_INTEROP_ENABLED and Preview-only FACE_INTEROP_VERIFY_ON_BUILD gate the new capability. No new paid infrastructure or credentials.

Application commit 438708974c87a5c3972e5c41401e5c7db16b89ef; PR https://github.com/CryptographyBloke/Face/pull/8. Preview https://walletface-c95g87iyr-dao-vote.vercel.app is READY (dpl_2GWuLak5yeefKhdVwoN6uRzbkPwz). Vercel independently passed 78 backend and 47 React tests, SDK/application builds and the avatar EIP-712 protocol check. Its live integration check at 2026-11-15T20:21:28.300Z passed real production MCP discovery and synthetic-wallet signed Neon discovery/replay validation.

The build acceptance connects to the actual public production MCP endpoint and lists its five tools without invoking them. Synthetic-wallet Neon tests exercise reviewed discovery persistence, replay rejection and versioned manifest. Remote domain proof/A2A responses in that database test are controlled fixtures and are explicitly labeled; they do not prove ownership of a live third-party Agent.

A/B have real desktop/mobile Preview screenshots. C/D browser acceptance requires an authenticated Vercel Preview session in the available browser. The original connection was lost; the replacement login handoff was cancelled and its browser session is now closed. No access protection change or temporary public share link has been enabled.

Full funded Base Sepolia payment and owner-selected real remote endpoints remain acceptance inputs. Mainnet payments and automated signing stay disabled. Successful payment settlement, service delivery, controller ownership, domain control and capability declarations retain separate evidence fields.
