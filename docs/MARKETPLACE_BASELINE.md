# Marketplace baseline / 开发基线

Verified 2026-11-16. Production walletface.org serves bbcc6511c993ac1586ff1d8df0910556043358bf, deployment dpl_J6KgKFBSe23PFW5NVvti99tkzSDA. Public Copilot and signed identity/discovery are enabled; payment/spending execution is disabled. Production schema versions are 001–008. PR #10 is merged; the current source branch is feature/snapshot-inspired-ui-v04 at afff0031fce98d6f080ae84038fc9b35af601432.

An independent feature/agent-marketplace-e2e worktree inherits that source. Prior worktrees, staged controlled-spending work and private browser screenshots are preserved. Alternative main/Workers/D1/billing code is unchanged.

Installed protocol dependencies: AI SDK 7.0.173, MCP client/server 2.4.0 and x402 core/evm 2.31.0. MCP calls use the installed SDK's callTool(params, options) contract. The A2A adapter implements the v1 JSON-RPC binding (SendMessage/GetTask/CancelTask, ROLE_USER, TASK_STATE_*); it does not claim unsupported transports or older protocol compatibility.

Migration 009 adds signed service publication, private runs, execution events and a public-data-only A2A compatibility task store. It is first applied to walletface_identity_preview with grants restricted to its four new tables and one event sequence. No paid resource is provisioned.

Release 1 validation and deployment are recorded as they complete. A confirmed receiving wallet, funded Base Sepolia USDC authorization and successful independent chain proof are still needed for paid acceptance; none is fabricated from a mock result.
