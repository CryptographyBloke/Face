import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { encodePaymentSignatureHeader } from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { encodeEventTopics, encodeAbiParameters, parseAbi } from "viem";
import { PaymentService } from "../server/payments/service.mjs";
import { createPaymentApi } from "../server/payments/api.mjs";
import { checkSettlement } from "../server/payments/chain.mjs";
import {
  NETWORK,
  ASSET,
  AMOUNT,
  paymentStatus,
  decodePayment,
  validatePayment,
} from "../server/payments/protocol.mjs";
const payer = privateKeyToAccount(generatePrivateKey()),
  receiver = privateKeyToAccount(generatePrivateKey()),
  env = {
    FACE_X402_ENABLED: "true",
    FACE_DATABASE_URL: "configured",
    FACE_X402_RECEIVER: receiver.address,
  };
function fixture(options = {}) {
  const quotes = new Map(),
    receipts = new Map();
  let settlements = 0,
    reports = 0,
    verifies = 0;
  const repository = {
    quote: async (id) => quotes.get(id),
    createQuote: async (id, space, url, requirements) => {
      const q = {
        id,
        space_id: space,
        resource_url: url,
        requirements,
        expires_at: new Date(Date.now() + 600000).toISOString(),
      };
      quotes.set(id, q);
      return q;
    },
    receipt: async (id) => receipts.get(id),
    claim: async (id, p, r) => {
      if (receipts.has(id)) return { record: receipts.get(id), claimed: false };
      for (const e of receipts.values())
        if (e.authorization_nonce === p.nonce && e.payer === p.payer)
          throw Error("replay");
      const record = {
        id,
        state: "verifying",
        payload_hash: p.payloadHash,
        payer: p.payer,
        authorization_nonce: p.nonce,
        authorization: p.authorization,
        network: r.network,
        asset: r.asset.toLowerCase(),
        receiver: r.payTo.toLowerCase(),
        amount: r.amount,
      };
      receipts.set(id, record);
      return { record, claimed: true };
    },
    transition: async (id, expected, state, patch = {}) => {
      const old = receipts.get(id);
      if (
        old.state === state ||
        (state === "settled" && old.state === "delivered")
      )
        return old;
      assert.equal(old.state, expected);
      const r = {
        ...old,
        state,
        ...(patch.settlement ? { settlement: patch.settlement } : {}),
        ...(patch.transactionHash
          ? { transaction_hash: patch.transactionHash }
          : {}),
        ...(patch.chainEvidence ? { chain_evidence: patch.chainEvidence } : {}),
        ...(patch.response ? { response_data: patch.response } : {}),
        ...(patch.responseHash ? { response_hash: patch.responseHash } : {}),
        ...(patch.errorCode ? { error_code: patch.errorCode } : {}),
      };
      receipts.set(id, r);
      return r;
    },
  };
  const facilitator = {
    getSupported: async () => ({
      kinds: [{ x402Version: 2, scheme: "exact", network: NETWORK }],
      extensions: [],
      signers: {},
    }),
    verify: async () => {
      verifies++;
      return { isValid: true, payer: payer.address };
    },
    settle: async () => {
      settlements++;
      if (options.settleError) throw Error("timeout");
      return {
        success: true,
        network: NETWORK,
        payer: payer.address,
        transaction: "0x" + "1".repeat(64),
      };
    },
  };
  const service = new PaymentService({
    env,
    origin: "https://walletface.test",
    repository,
    facilitator,
    chainCheck: async () =>
      options.chainUnavailable ? null : { settled: true, network: NETWORK },
    reportBuilder: async () => {
      reports++;
      if (options.reportFailure) throw Error("upstream");
      return {
        synthetic: true,
        publicVotes: 2,
        evidence: { completeness: "scan_limited" },
      };
    },
  });
  const client = new x402Client().register(NETWORK, new ExactEvmScheme(payer));
  const offer = async () => {
    const id = randomUUID(),
      q = await service.offer(id, "ens.eth"),
      response = await service.required(q),
      p = await client.createPaymentPayload(response.data);
    return { id, q, p, header: encodePaymentSignatureHeader(p) };
  };
  return {
    service,
    repository,
    facilitator,
    client,
    offer,
    quotes,
    receipts,
    counts: () => ({ settlements, reports, verifies }),
  };
}
test("official x402 v2 client/server generate a fixed testnet offer and EIP-3009 payload", async () => {
  const f = fixture(),
    o = await f.offer();
  assert.equal(o.q.requirements.network, NETWORK);
  assert.equal(o.q.requirements.amount, AMOUNT);
  assert.equal(o.q.requirements.asset.toLowerCase(), ASSET.toLowerCase());
  const d = decodePayment(o.header);
  assert.equal(
    (await validatePayment(d, o.q.requirements, o.q.resource_url)).payer,
    payer.address.toLowerCase(),
  );
  assert.equal(paymentStatus(env).mainnetEnabled, false);
});
test("rejects altered price, receiver, chain, token, resource and forged signatures before verification/settlement", async () => {
  const f = fixture(),
    o = await f.offer();
  for (const [key, v] of [
    ["network", "eip155:8453"],
    ["amount", "1"],
    ["payTo", payer.address],
    ["asset", payer.address],
  ]) {
    const p = structuredClone(o.p);
    p.accepted[key] = v;
    await assert.rejects(
      f.service.report(o.id, "ens.eth", encodePaymentSignatureHeader(p)),
      /match/,
    );
  }
  const p = structuredClone(o.p);
  p.payload.authorization.value = "1";
  await assert.rejects(
    f.service.report(o.id, "ens.eth", encodePaymentSignatureHeader(p)),
    /differs/,
  );
  p.payload.authorization.value = AMOUNT;
  p.payload.authorization.from = receiver.address;
  await assert.rejects(
    f.service.report(o.id, "ens.eth", encodePaymentSignatureHeader(p)),
    /payer/,
  );
  p.resource.url = "https://evil.test";
  await assert.rejects(
    f.service.report(o.id, "ens.eth", encodePaymentSignatureHeader(p)),
    /match/,
  );
  assert.equal(f.counts().settlements, 0);
  assert.equal(f.counts().verifies, 0);
  assert.throws(() => decodePayment("a".repeat(16001)), /oversized/);
});
test("concurrent duplicate payments settle once, preserve evidence and replay cached delivery", async () => {
  const f = fixture(),
    o = await f.offer();
  const attempts = await Promise.all(
    Array.from({ length: 5 }, () =>
      f.service.report(o.id, "ens.eth", o.header),
    ),
  );
  assert.equal(f.counts().settlements, 1);
  assert.equal(f.counts().reports, 1);
  assert.ok(attempts.some((r) => r.status === 200));
  const cached = await f.service.report(o.id, "ens.eth", o.header);
  assert.equal(cached.status, 200);
  assert.equal(cached.data.receipt.settlementVerified, true);
  assert.equal(cached.data.report.synthetic, true);
  assert.equal(f.counts().settlements, 1);
  const other = await f.offer();
  const moved = {
    ...o.p,
    resource: other.p.resource,
    accepted: other.p.accepted,
  };
  await assert.rejects(
    f.service.report(other.id, "ens.eth", encodePaymentSignatureHeader(moved)),
    /replay/,
  );
});
test("timeout or missing chain evidence remains pending and never retries settlement", async () => {
  for (const opts of [{ settleError: true }, { chainUnavailable: true }]) {
    const f = fixture(opts),
      o = await f.offer();
    const r = await f.service.report(o.id, "ens.eth", o.header);
    assert.equal(r.status, 202);
    assert.equal(r.data.receipt.settlementVerified, false);
    assert.equal(r.data.receipt.state, "settlement_unknown");
    await f.service.report(o.id, "ens.eth", o.header);
    assert.equal(f.counts().settlements, 1);
  }
});
test("failed work or verify prevents settlement; expired authorizations and disabled execution fail closed", async () => {
  const f = fixture({ reportFailure: true }),
    o = await f.offer();
  await assert.rejects(f.service.report(o.id, "ens.eth", o.header), /upstream/);
  assert.equal(f.counts().settlements, 0);
  assert.equal((await f.repository.receipt(o.id)).state, "failed");
  const g = fixture(),
    q = await g.offer();
  g.facilitator.verify = async () => ({ isValid: false });
  await assert.rejects(g.service.report(q.id, "ens.eth", q.header), /rejected/);
  assert.equal(g.counts().settlements, 0);
  await assert.rejects(
    validatePayment(q.p, q.q.requirements, q.q.resource_url, {
      now: Math.floor(Date.now() / 1000) + 200,
    }),
    /current/,
  );
  g.service.env = { ...env, FACE_X402_ENABLED: "false" };
  await assert.rejects(g.service.report(q.id, "ens.eth", q.header), /disabled/);
});
test("payment API exposes status, enforces private receipts, malformed input and shared rate limits", async () => {
  const f = fixture(),
    api = createPaymentApi({
      origin: "https://walletface.test",
      env,
      service: f.service,
    });
  assert.equal(
    (await api(new Request("https://walletface.test/v1/payments/status")))
      .status,
    200,
  );
  assert.equal(
    (
      await api(
        new Request(
          "https://walletface.test/v1/payments/report?spaceId=ens.eth&requestId=bad",
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (await api(new Request("https://walletface.test/v1/payments/receipts")))
      .status,
    401,
  );
  f.service.repository.db = { query: async () => [{ ok: false }] };
  assert.equal(
    (await api(new Request("https://walletface.test/v1/payments/receipts")))
      .status,
    429,
  );
});
test("independent chain check requires correct chain, USDC transfer, nonce consumption and success", async () => {
  const tx = "0x" + "1".repeat(64),
    nonce = "0x" + "2".repeat(64),
    a = payer.address.toLowerCase(),
    b = receiver.address.toLowerCase(),
    abi = parseAbi([
      "event Transfer(address indexed from,address indexed to,uint256 value)",
      "event AuthorizationUsed(address indexed authorizer,bytes32 indexed nonce)",
    ]);
  const logs = [
    {
      address: ASSET,
      topics: encodeEventTopics({
        abi,
        eventName: "Transfer",
        args: { from: payer.address, to: receiver.address },
      }),
      data: encodeAbiParameters([{ type: "uint256" }], [1000n]),
    },
    {
      address: ASSET,
      topics: encodeEventTopics({
        abi,
        eventName: "AuthorizationUsed",
        args: { authorizer: payer.address, nonce },
      }),
      data: "0x",
    },
  ];
  const record = {
    transaction_hash: tx,
    payer: a,
    receiver: b,
    amount: "1000",
    authorization_nonce: nonce,
  };
  const factory =
    (extra = {}) =>
    () => ({
      getChainId: async () => 84532,
      getTransactionReceipt: async () => ({
        status: "success",
        blockNumber: 10n,
        logs,
      }),
      ...extra,
    });
  assert.equal((await checkSettlement(record, {}, factory())).settled, true);
  assert.equal(
    await checkSettlement({ ...record, amount: "1001" }, {}, factory()),
    null,
  );
  assert.equal(
    await checkSettlement(record, {}, factory({ getChainId: async () => 1 })),
    null,
  );
  assert.equal(
    (
      await checkSettlement(
        record,
        {},
        factory({
          getTransactionReceipt: async () => ({
            status: "reverted",
            blockNumber: 10n,
          }),
        }),
      )
    ).reverted,
    true,
  );
});
