# Public Agent release / 公开 Agent 发布

Owner authorization: 2026-11-16. The owner reports an API-key spending cap is configured at NewAPI and explicitly requests public conversations and release of the existing Agent modules. Wallet Face does not expose or claim to independently verify that upstream billing configuration.

## Public behavior / 访问方式

- `/ai` and Space AI Insights accept visitor questions without a beta code in explicit public mode. Actual streaming NewAPI generation uses the six bounded public governance/profile tools and server-built evidence cards.
- `/my-agents` connects personal Agents using wallet-reviewed signatures; `/agents/:id` separates publisher, controller, endpoint control, receiver and ERC-8004 evidence.
- `/actions/new`, reports and workspaces retain their existing wallet sessions, signatures and administrator checks. The Copilot provides direct navigation to the workflows. Its model and public MCP tools do not receive write/signing authority.
- `/payments` and `/spending` publish the interfaces and accurate execution status. Production execution remains disabled: automatic approval rejected activating payments with an operator-unconfirmed generated receiver and incomplete funded-settlement acceptance. The isolated Preview retains the Base Sepolia demonstration. Enabling production testnet payments needs an explicitly confirmed receiver and successful funded acceptance; mainnet requires a separate release. Every payment needs the payer's explicit wallet confirmation.
- MCP/A2A metadata reads require current signed profile/association/domain evidence. They do not execute third-party tools or tasks. Controller/endpoint evidence is not a service-quality claim.

## Shared limits / 共享额度

`FACE_AI_ACCESS=public`; defaults are 200 model requests/day globally, 10/IP/hour and 40M reserved tokens/day. Requests reserve 200K tokens before calling the model; failed/cancelled attempts retain reservations. Existing history, 800-output-token/step, four-step, six-tool and 45-second budgets remain. Quota storage failure blocks model execution. Visitor IPs are hashed using a private server salt. No complete chat content is stored by default.

## Verification / 验证

The public-release change adds backend tests for code-free access, retained quota enforcement, invalid configuration and private quota hashing, plus a React test for public streaming and signed-workflow navigation. The complete candidate has 80 backend and 48 React tests. SDK/application/protocol builds and both dependency audits are required. The production build additionally checks migrations 001–008, runtime table permissions and the settlement guard, using read-only database queries.

Final deployment ID, commit, browser evidence and real public model usage are recorded after deployment. Previous evidence remains in FINAL_RELEASE_STATUS.md and the A–D release reports. Mainnet payments, autonomous signing and funded settlement acceptance remain distinct from public chat activation.
