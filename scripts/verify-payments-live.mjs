import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { digest } from "../server/platform/authorization.mjs";
import { PaymentService } from "../server/payments/service.mjs";
import { PaymentRepository } from "../server/payments/repository.mjs";
import { validatePayment, NETWORK } from "../server/payments/protocol.mjs";
if (process.env.FACE_PAYMENTS_VERIFY_ON_BUILD !== "true") process.exit(0);
if (
  process.env.VERCEL_ENV !== "preview" ||
  !(process.env.FACE_IDENTITY_DATABASE_URL || "").includes(
    "/walletface_identity_preview",
  )
)
  throw Error("Isolated payment Preview required");
const payer = privateKeyToAccount(generatePrivateKey()),
  repository = new PaymentRepository(process.env),
  service = new PaymentService({
    env: process.env,
    origin: "https://payment-acceptance.invalid",
    repository,
    snapshot: {},
  }),
  checks = [];
const client = new x402Client().register(NETWORK, new ExactEvmScheme(payer)),
  id = randomUUID(),
  q = await service.offer(id, "ens.eth"),
  offer = await service.required(q);
assert.equal(offer.status, 402);
assert.ok(offer.headers["PAYMENT-REQUIRED"]);
checks.push({
  name: "real-public-facilitator-v2-base-sepolia-discovery-and-402",
  success: true,
  network: NETWORK,
});
const payload = await client.createPaymentPayload(offer.data),
  p = await validatePayment(payload, q.requirements, q.resource_url);
const claims = await Promise.all(
  Array.from({ length: 8 }, () => repository.claim(id, p, q.requirements)),
);
assert.equal(claims.filter((c) => c.claimed).length, 1);
checks.push({
  name: "real-postgres-payment-replay-concurrency",
  success: true,
  accepted: 1,
  rejected: 7,
});
await repository.transition(id, "verifying", "preparing");
await repository.transition(id, "preparing", "settling", {
  response: { synthetic: true },
  responseHash: digest({ synthetic: true }),
});
await repository.transition(id, "settling", "settlement_unknown", {
  errorCode: "CONTROLLED_TIMEOUT_NO_REAL_SETTLEMENT",
});
await assert.rejects(
  repository.transition(id, "settlement_unknown", "settling"),
);
checks.push({
  name: "durable-unknown-state-cannot-resettle",
  success: true,
  controlledOutcome: true,
});
// Actual verification is read-only. This fresh test wallet has no funded balance.
const second = randomUUID(),
  sq = await service.offer(second, "ens.eth"),
  so = await service.required(sq),
  sp = await client.createPaymentPayload(so.data);
let rejected = false;
try {
  await service.report(second, "ens.eth", encodePaymentSignatureHeader(sp));
} catch {
  rejected = true;
}
assert.equal(rejected, true);
const receipt = await repository.receipt(second);
assert.equal(receipt.state, "failed");
checks.push({
  name: "real-facilitator-rejects-unfunded-wallet-before-settlement",
  success: true,
  errorCode: receipt.error_code,
});
const report = {
  checkedAt: new Date().toISOString(),
  officialSdkVersion: "2.31.0",
  realFacilitator: true,
  realPostgres: true,
  realSettlement: false,
  mainnetEnabled: false,
  paidModelCalls: 0,
  requiredAcceptance:
    "Funded Base Sepolia USDC payment with explicit human approval; successful on-chain settlement not yet tested",
  checks,
};
await writeFile(
  "web/dist/payment-verification.json",
  JSON.stringify(report, null, 2),
);
console.log("FACE_PAYMENTS_LIVE_CHECK " + JSON.stringify(report));
