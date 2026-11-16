import { z } from "zod";
import { recoverTypedDataAddress } from "viem";
import { PaymentPayloadV2Schema } from "@x402/core/schemas";
import { decodePaymentSignatureHeader } from "@x402/core/http";
import { digest } from "../platform/authorization.mjs";
import { ApiError } from "../validation.mjs";
export const NETWORK = "eip155:84532",
  ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  AMOUNT = "1000",
  FACILITATOR = "https://x402.org/facilitator";
const wallet = z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  uint = z
    .string()
    .regex(/^(0|[1-9]\d{0,77})$/)
    .refine((v) => BigInt(v) < 2n ** 256n);
export const authorizationSchema = z
  .object({
    from: wallet,
    to: wallet,
    value: uint,
    validAfter: uint,
    validBefore: uint,
    nonce: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  })
  .strict();
export const paymentTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};
export function paymentStatus(env = process.env) {
  const configured =
    wallet.safeParse(env.FACE_X402_RECEIVER).success && !!env.FACE_DATABASE_URL;
  return {
    protocol: "x402",
    version: 2,
    release: "testnet-beta",
    enabled: env.FACE_X402_ENABLED === "true" && configured,
    network: NETWORK,
    asset: ASSET,
    amount: AMOUNT,
    decimals: 6,
    receiver: wallet.safeParse(env.FACE_X402_RECEIVER).success
      ? env.FACE_X402_RECEIVER
      : null,
    facilitator: FACILITATOR,
    humanApprovalRequired: true,
    mainnetEnabled: false,
    unitEconomics: {
      priceTestUsdc: "0.001",
      modelCalls: 0,
      paidInfraAdded: 0,
      observedMonetaryCost: null,
    },
    missing: [
      ...(!env.FACE_DATABASE_URL ? ["FACE_DATABASE_URL"] : []),
      ...(!wallet.safeParse(env.FACE_X402_RECEIVER).success
        ? ["FACE_X402_RECEIVER"]
        : []),
    ],
  };
}
export function decodePayment(header) {
  if (
    typeof header !== "string" ||
    header.length > 16000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(header)
  )
    throw new ApiError(
      400,
      "PAYMENT_HEADER",
      "Invalid or oversized PAYMENT-SIGNATURE",
    );
  let p;
  try {
    p = PaymentPayloadV2Schema.parse(decodePaymentSignatureHeader(header));
  } catch {
    throw new ApiError(400, "PAYMENT_SCHEMA", "Invalid x402 v2 payment");
  }
  p.payload = z
    .object({
      signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
      authorization: authorizationSchema,
    })
    .strict()
    .parse(p.payload);
  if (p.extensions && Object.keys(p.extensions).length)
    throw new ApiError(
      422,
      "PAYMENT_EXTENSION",
      "This endpoint accepts the basic EIP-3009 flow",
    );
  return p;
}
export async function validatePayment(
  p,
  requirements,
  resource,
  { allowExpired = false, now = Math.floor(Date.now() / 1000) } = {},
) {
  if (
    p.x402Version !== 2 ||
    digest(p.accepted) !== digest(requirements) ||
    p.resource?.url !== resource
  )
    throw new ApiError(
      422,
      "PAYMENT_REQUIREMENTS",
      "Network, asset, price, receiver and resource must match the server offer",
    );
  const a = authorizationSchema.parse(p.payload.authorization);
  if (
    a.to.toLowerCase() !== requirements.payTo.toLowerCase() ||
    a.value !== requirements.amount ||
    requirements.network !== NETWORK ||
    requirements.asset.toLowerCase() !== ASSET.toLowerCase() ||
    requirements.scheme !== "exact"
  )
    throw new ApiError(
      422,
      "PAYMENT_AMOUNT",
      "Payment differs from the fixed testnet offer",
    );
  if (
    !allowExpired &&
    (BigInt(a.validAfter) >= BigInt(now) ||
      BigInt(a.validBefore) <= BigInt(now) ||
      BigInt(a.validBefore) > BigInt(now + requirements.maxTimeoutSeconds + 5))
  )
    throw new ApiError(
      422,
      "PAYMENT_EXPIRY",
      "Payment authorization must be current and short lived",
    );
  const message = {
    ...a,
    value: BigInt(a.value),
    validAfter: BigInt(a.validAfter),
    validBefore: BigInt(a.validBefore),
  };
  let signer;
  try {
    signer = await recoverTypedDataAddress({
      domain: {
        name: "USDC",
        version: "2",
        chainId: 84532,
        verifyingContract: ASSET,
      },
      types: paymentTypes,
      primaryType: "TransferWithAuthorization",
      message,
      signature: p.payload.signature,
    });
  } catch {
    throw new ApiError(403, "PAYMENT_SIGNATURE", "Invalid payment signature");
  }
  if (signer.toLowerCase() !== a.from.toLowerCase())
    throw new ApiError(
      403,
      "PAYMENT_SIGNATURE",
      "The payer must authorize this exact payment",
    );
  return {
    payer: signer.toLowerCase(),
    nonce: a.nonce.toLowerCase(),
    payloadHash: digest(p),
    authorization: a,
  };
}
