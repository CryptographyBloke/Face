# Release C — Human-reviewed spending / 人工审核支出

Separate Agent controller wallets use owner-signed policies and per-quote approvals. Caps cover each transaction, UTC daily and total authorized amounts, fixed Base Sepolia USDC, receiving-wallet allowlists and expiry (maximum 30 days).
The owner approves the exact service resource, receiver, amount, network, asset and policy revision. The Agent wallet then confirms a short-lived EIP-3009 signature. Automated signing is disabled.

An online permit is checked inside the SDK signing callback. Migration 007 serializes budget reservations and adds a PostgreSQL trigger before receipt creation and settlement. It rechecks active profile/association, policy, amount, recipient and expiry and binds approval to the exact payment nonce and payload hash. The trigger also applies to older deployments sharing the database.

Approved amounts stay reserved after cancellation, failure or unknown settlement. They represent authorized budget, distinct from settled spending. Policies have independent budgets.
Revocation blocks later authorization; a token authorization already in flight retains its token-level expiry. A general EOA key can sign externally. Future autonomous mode requires an independently policy-enforced smart account/signing provider. No primary-wallet key is stored or deployed.

Routes: /spending; GET /v1/spending/status, /policies, /intents, /permit?quoteId=<UUID>&payer=<address>.
Private policy/intent reads require owner/controller wallet sessions. Signed actions use the existing platform challenge/execute flow: spend.policy.create, spend.policy.revoke, spend.intent.approve, spend.intent.cancel.
FACE_SPENDING_ENABLED and Preview-only FACE_SPENDING_VERIFY_ON_BUILD activate the testnet implementation. No new paid infrastructure.

AP2 v0.2 is a design reference. This implementation does not implement AP2 SD-JWT mandates or claim AP2 compliance. References checked 2026-11-15:
- https://ap2-protocol.org/ap2/specification/
- https://ap2-protocol.org/ap2/agent_authorization/
- https://github.com/coinbase/spend-permissions/blob/main/src/SpendPermissionManager.sol
- https://help.coinbase.com/en/wallet/getting-started/smart-wallet-permissions

Local checks before execution-environment loss: 72 backend +46 React tests, application/SDK builds and avatar EIP-712 regression passed. Remote full validation verifies the recovered source again.
Actual funded testnet settlement remains pending from Release B; no mainnet spending is enabled or claimed as accepted.
