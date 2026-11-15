# Release B — x402 v2 receive / 测试网收款

Parent: independently validated Release A `c9593a4`. Official maintained `@x402/core` / `@x402/evm` pinned to **2.31.0**, matching installed README, type declarations and implementation inspected before integration. Protocol x402 v2, exact / EIP-3009 authorization flow only.

## Endpoint and cost / 接口与成本

`GET /v1/payments/report?spaceId=ens.eth&requestId=<UUID>` packages a deterministic observed-governance report and evidence. One fixed offer: Base Sepolia `eip155:84532`, USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, **1000 atomic units = 0.001 test USDC**. No paid language-model call. Existing free governance/profile endpoints remain free.

`GET /v1/payments/status` reports configuration, receiver and mainnetEnabled=false. `/payments` provides bilingual offer → visible review → explicit wallet confirmation → receipt/report. Distinct second click invokes wallet signing; chain/asset/recipient/exact amount/expiry are checked at that boundary. This is manual human payment, not delegated agent spending.

`GET /v1/payments/receipts` and `/receipts/:id` require the payer's existing origin-bound wallet session; at most 50 records. Responses distinguish facilitator outcome, independently checked chain settlement and cached delivery. A third-party service price on an Agent profile remains an operator declaration and is never recorded as a Wallet Face settlement.

Unit economics: synthetic testnet revenue only; 0 model calls per paid request; existing Vercel Function + Neon queries + Snapshot reads + public testnet facilitator. No new paid resource. Actual production unit cost and margin remain unmeasured; mainnet pricing and facilitator fees require separate acceptance and owner activation. No subscriptions, commissions, custody or payment routing enabled.

## Durable flow / 持久化流程

1. Quote snapshot with fixed requirements and canonical resource URL; offer expires after 10 minutes. SDK emits PAYMENT-REQUIRED.
2. Official SDK creates EIP-3009 signature in the user's wallet (120 seconds max). Server strictly validates schema, exact server requirements and payer signature before claiming work.
3. PostgreSQL binds request ID and unique (network, asset, payer, authorization nonce). Concurrent repeats accept one processor; another resource cannot reuse the authorization. Payload hashes reject conflicting retries.
4. Official resource server/facilitator verify payment, then compute and durably cache the report before requesting settlement.
5. Durable state enters settling before exactly one official facilitator settle call. Timeout or ambiguous response enters settlement_unknown. The resource server's automatic settlement-pending retry is deliberately avoided; no implicit resubmission occurs.
6. Independent trusted Base Sepolia RPC checks chain ID, successful receipt, USDC Transfer event with exact payer/receiver/amount and AuthorizationUsed event with exact nonce. Only matching on-chain evidence produces settlementVerified=true and delivery.
7. A repeated identical payment retrieves the cached report; unknown transaction hashes can be reconciled by receipt lookup without another settlement call. Expired signatures may retrieve their already-bound receipt/report. A failed report before settlement is never charged.

`006_x402_receive.sql` adds quotes, receipts, transition events and constrained atomic state changes. Authorization signatures are not stored in the database; only authorization fields, nonce and payload hash. Responses expose no raw signatures. Unknown settlement without a transaction hash requires operator reconciliation; the application does not generate a new charge automatically. A network failure after delivery can retrieve the same cached output.

EIP-3009 itself binds the token transfer, not arbitrary HTTP content. Wallet Face additionally binds first-use nonce to request/resource in its shared ledger; the UI reviews the exact resource. Future delegated spending requires its own signed intent/policy boundary (Release C).

## Configuration / 配置

Server-only `FACE_X402_ENABLED=true`, `FACE_X402_RECEIVER` and the existing platform database. Production flag stays unset/disabled. Optional `BASE_SEPOLIA_RPC_URL`; default is official public `https://sepolia.base.org`. Facilitator is fixed `https://x402.org/facilitator`; no client-supplied URLs, queries or provider choices.

Preview uses the existing isolated identity database with additive migration 006. Preview receiver is a generated test address; its key is held only in an ignored local test checkpoint, never deployed or sent to an AI model. It is not labeled as the owner's verified receiving wallet. Replace with an explicitly configured operator receiver for release activation.

Public facilitator `/supported` returned HTTP 200 and x402Version=2/scheme=exact/network=eip155:84532 on 2026-11-15. `FACE_PAYMENTS_VERIFY_ON_BUILD` validates actual discovery, official SDK offer creation, real PostgreSQL duplicate/state controls and an unfunded-wallet rejection. Successful settlement remains a separate funded testnet acceptance.

## Validation and remaining activation / 验证与激活

67 backend tests +45 React tests cover malformed/oversized payments, forged payer/receiver, wrong network/token, price/resource changes, expired authorizations, concurrency, replay, facilitator timeout, failed service, missing chain evidence, private receipts, shared quotas, human review and wrong-chain signing prevention. Existing avatar protocol regression remains required.

Full successful testnet settlement is **pending** a funded payer with Base Sepolia USDC and explicit wallet approval. No real-money payment has been enabled or claimed as tested. Preview: https://walletface-fjnvvtacc-dao-vote.vercel.app/payments (dpl_8seTqVy6XmGXsoR7eM7bpy85Wn2Y, source 2d1bd5e). PR: https://github.com/CryptographyBloke/Face/pull/6.

Actual Preview build acceptance: facilitator discovery + HTTP 402/official SDK offer, eight concurrent PostgreSQL receipt claims accept one, unknown state rejects resettlement, fresh unfunded wallet rejected before settlement. FACE_PAYMENTS_LIVE_CHECK explicitly records realSettlement=false.

Edge rendered the live fixed offer in Chinese and English, with native navigation and no horizontal overflow at 1440/1024/768/375. Screenshots: screenshots/platform/payments-desktop.png and payments-mobile.png. Browser-discovered rewrite-capture input and missing shell issues were fixed and regression tested. No user wallet signature/payment was automated. AP2 compliance and autonomous transfers are outside this release.

Primary references: https://github.com/x402-foundation/x402 / https://docs.x402.org/getting-started/quickstart-for-sellers / https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md .
