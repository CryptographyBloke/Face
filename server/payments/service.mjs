import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  encodePaymentRequiredHeader,
  encodePaymentResponseHeader,
  readLimitedText,
} from "@x402/core/http";
import { createToolRegistry } from "../ai/tools.mjs";
import { digest } from "../platform/authorization.mjs";
import { PaymentRepository } from "./repository.mjs";
import { checkSettlement } from "./chain.mjs";
import {
  NETWORK,
  ASSET,
  AMOUNT,
  FACILITATOR,
  paymentStatus,
  decodePayment,
  validatePayment,
} from "./protocol.mjs";
import { ApiError } from "../validation.mjs";
export class PaymentService {
  constructor({
    env = process.env,
    origin,
    snapshot,
    repository,
    facilitator,
    chainCheck = checkSettlement,
    reportBuilder,
  } = {}) {
    this.env = env;
    this.origin = origin;
    this.snapshot = snapshot;
    this.repository = repository || new PaymentRepository(env);
    this.chainCheck = chainCheck;
    this.facilitator =
      facilitator ||
      new HTTPFacilitatorClient({ url: FACILITATOR, timeoutMs: 8000 });
    // One bounded discovery request; SDK getSupported's 429 retries are unnecessary for this beta.
    if (!facilitator)
      this.facilitator.getSupported = async () => {
        const r = await fetch(FACILITATOR + "/supported", {
          signal: AbortSignal.timeout(6000),
          redirect: "error",
        });
        if (!r.ok)
          throw new ApiError(
            503,
            "FACILITATOR_UNAVAILABLE",
            "Testnet facilitator is unavailable",
          );
        const text = await readLimitedText(r, 32768);
        if (text.length > 32768) throw Error("Facilitator response too large");
        const data = JSON.parse(text);
        if (!Array.isArray(data.kinds) || data.kinds.length > 100)
          throw Error("Invalid facilitator capabilities");
        return data;
      };
    this.server = new x402ResourceServer(this.facilitator).register(
      NETWORK,
      new ExactEvmScheme(),
    );
    this.reportBuilder =
      reportBuilder ||
      (async (space, signal) => {
        const tools = createToolRegistry({ snapshot, maxCalls: 1, signal });
        const result = await tools.run("analyzeParticipation", {
          spaceId: space,
          ranges: [],
        });
        return {
          schemaVersion: 1,
          kind: "observed_governance_report",
          spaceId: space,
          generatedAt: new Date().toISOString(),
          analysis: result.data,
          evidence: result.provenance,
          delivery: "computed_snapshot_report",
          modelGenerated: false,
        };
      });
  }
  async initialize() {
    if (!this.ready)
      this.ready = this.server.initialize().catch((e) => {
        this.ready = null;
        throw e;
      });
    return this.ready;
  }
  async offer(id, space) {
    let q = await this.repository.quote(id);
    const url =
      this.origin +
      "/v1/payments/report?spaceId=" +
      encodeURIComponent(space) +
      "&requestId=" +
      id;
    if (q && (q.space_id !== space || q.resource_url !== url))
      throw new ApiError(
        409,
        "PAYMENT_REQUEST",
        "Request ID is bound to another resource",
      );
    if (!q) {
      await this.initialize();
      const requirements = (
        await this.server.buildPaymentRequirements({
          scheme: "exact",
          network: NETWORK,
          payTo: this.env.FACE_X402_RECEIVER,
          price: {
            asset: ASSET,
            amount: AMOUNT,
            extra: {
              name: "USDC",
              version: "2",
              assetTransferMethod: "eip3009",
            },
          },
          maxTimeoutSeconds: 120,
        })
      )[0];
      q = await this.repository.createQuote(id, space, url, requirements);
    }
    if (
      q.requirements.payTo.toLowerCase() !==
      this.env.FACE_X402_RECEIVER.toLowerCase()
    )
      throw new ApiError(
        409,
        "PAYMENT_CONFIG_CHANGED",
        "Receiver configuration changed; request a fresh offer",
      );
    return q;
  }
  async required(q) {
    if (new Date(q.expires_at).getTime() <= Date.now())
      throw new ApiError(
        410,
        "QUOTE_EXPIRED",
        "Offer expired; request a new quote",
      );
    const data = await this.server.createPaymentRequiredResponse(
      [q.requirements],
      {
        url: q.resource_url,
        description:
          "Wallet Face observed governance report · Base Sepolia testnet",
        mimeType: "application/json",
      },
    );
    return {
      status: 402,
      data,
      headers: {
        "PAYMENT-REQUIRED": encodePaymentRequiredHeader(data),
        "Cache-Control": "private, no-store",
      },
    };
  }
  publicReceipt(r) {
    return {
      id: r.id,
      state: r.state,
      network: r.network,
      asset: r.asset,
      amount: String(r.amount),
      receiver: r.receiver,
      payer: r.payer,
      transactionHash: r.transaction_hash || null,
      settlementVerified: !!r.chain_evidence?.settled,
      chainEvidence: r.chain_evidence || null,
      delivery:
        r.state === "delivered"
          ? "cached_report_available"
          : "pending_or_failed",
      responseHash: r.response_hash || null,
      errorCode: r.error_code || null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
  async replay(record) {
    let r = record;
    if (r.state === "settlement_unknown" && r.transaction_hash) {
      const chain = await this.chainCheck(r, this.env);
      if (chain?.settled)
        r = await this.repository.transition(r.id, r.state, "settled", {
          chainEvidence: chain,
        });
      else if (chain?.reverted)
        r = await this.repository.transition(r.id, r.state, "failed", {
          chainEvidence: chain,
          errorCode: "TRANSACTION_REVERTED",
        });
    }
    if (r.state === "settled")
      r = await this.repository.transition(r.id, "settled", "delivered");
    const receipt = this.publicReceipt(r);
    if (r.state === "delivered")
      return {
        status: 200,
        data: { receipt, report: r.response_data },
        headers: {
          "PAYMENT-RESPONSE": encodePaymentResponseHeader({
            ...r.settlement,
            success: true,
            transaction: r.transaction_hash,
            network: NETWORK,
            payer: r.payer,
            amount: String(r.amount),
          }),
        },
      };
    return {
      status: r.state === "failed" ? 422 : 202,
      data: {
        receipt,
        message:
          r.state === "failed"
            ? "Payment failed; inspect the receipt before creating a new authorization"
            : "Payment is pending verification or reconciliation. This authorization will not be settled again.",
      },
      headers: { "Retry-After": "10" },
    };
  }
  async report(id, space, header, signal) {
    if (!paymentStatus(this.env).enabled)
      throw new ApiError(
        503,
        "PAYMENTS_DISABLED",
        "Testnet payment execution is disabled or unconfigured",
      );
    const q = await this.offer(id, space);
    if (!header) return this.required(q);
    const p = decodePayment(header),
      existing = await this.repository.receipt(id);
    const verified = await validatePayment(p, q.requirements, q.resource_url, {
      allowExpired: !!existing,
    });
    if (existing) {
      if (existing.payload_hash !== verified.payloadHash)
        throw new ApiError(
          409,
          "PAYMENT_REPLAY",
          "Request is already bound to a different authorization",
        );
      return this.replay(existing);
    }
    if (new Date(q.expires_at).getTime() <= Date.now())
      throw new ApiError(
        410,
        "QUOTE_EXPIRED",
        "Offer expired; create a fresh authorization",
      );
    const claim = await this.repository.claim(id, verified, q.requirements);
    if (!claim.claimed) return this.replay(claim.record);
    let r = claim.record;
    try {
      signal?.throwIfAborted();
      await this.initialize();
      let result;
      try {
        result = await this.server.verifyPayment(p, q.requirements);
      } catch (e) {
        if (e.invalidReason)
          throw new ApiError(
            422,
            "PAYMENT_VERIFICATION",
            "Check Base Sepolia USDC balance and authorization expiry before a fresh payment",
          );
        throw new ApiError(
          503,
          "FACILITATOR_UNAVAILABLE",
          "Payment verification is unavailable; no settlement was requested",
        );
      }
      if (!result.isValid || result.payer?.toLowerCase() !== verified.payer)
        throw new ApiError(
          422,
          "PAYMENT_VERIFICATION",
          "Facilitator rejected this authorization or payer",
        );
      r = await this.repository.transition(id, "verifying", "preparing");
      const data = await this.reportBuilder(space, signal);
      if (Buffer.byteLength(JSON.stringify(data)) > 100000)
        throw Error("Report too large");
      signal?.throwIfAborted();
      r = await this.repository.transition(id, "preparing", "settling", {
        response: data,
        responseHash: digest(data),
      });
    } catch (e) {
      await this.repository.transition(id, r.state, "failed", {
        errorCode: e.code || "REPORT_OR_VERIFY_FAILED",
      });
      throw e;
    }
    let settlement;
    // Call the maintained facilitator client exactly once. ResourceServer.settlePayment
    // can retry settlement_pending; our durable ledger instead reconciles on-chain.
    try {
      settlement = await this.facilitator.settle(p, q.requirements);
    } catch (e) {
      const details = e.settleResponse || e.response;
      const transactionHash = e.transaction || details?.transaction;
      r = await this.repository.transition(
        id,
        "settling",
        "settlement_unknown",
        {
          errorCode: "SETTLEMENT_UNCERTAIN",
          ...(typeof transactionHash === "string" &&
          /^0x[0-9a-fA-F]{64}$/.test(transactionHash)
            ? { transactionHash }
            : {}),
        },
      );
      return this.replay(r);
    }
    const hash =
      typeof settlement.transaction === "string" &&
      /^0x[0-9a-fA-F]{64}$/.test(settlement.transaction)
        ? settlement.transaction
        : null;
    r = await this.repository.transition(id, "settling", "settlement_unknown", {
      settlement,
      ...(hash ? { transactionHash: hash } : {}),
      ...(!settlement.success
        ? { errorCode: "FACILITATOR_SETTLEMENT_PENDING_OR_FAILED" }
        : {}),
    });
    return this.replay(r);
  }
}
