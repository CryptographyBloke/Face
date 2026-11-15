import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { recoverTypedDataAddress, keccak256, toBytes } from "viem";
import { ApiError, address, canonical } from "../validation.mjs";
export const platformTypes = {
  Authorization: [
    { name: "actor", type: "address" },
    { name: "action", type: "string" },
    { name: "payloadHash", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "origin", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
};
export const digest = (value) => keccak256(toBytes(canonical(value)));
export function makeAuthorization(
  origin,
  actor,
  action,
  payload,
  now = Date.now(),
) {
  return {
    domain: {
      name: "Wallet Face Agent Platform",
      version: "1",
      chainId: 1,
      salt: keccak256(toBytes(origin)),
    },
    types: platformTypes,
    primaryType: "Authorization",
    message: {
      actor: address(actor),
      action,
      payloadHash: digest(payload),
      nonce: "0x" + randomBytes(32).toString("hex"),
      origin,
      expiresAt: Math.floor(now / 1000) + 300,
    },
  };
}
export async function verifyAuthorization(
  typedData,
  signature,
  payload,
  origin,
  now = Date.now(),
) {
  if (
    typedData.message.origin !== origin ||
    typedData.domain.salt !== keccak256(toBytes(origin)) ||
    typedData.domain.name !== "Wallet Face Agent Platform" ||
    typedData.domain.version !== "1" ||
    typedData.domain.chainId !== 1 ||
    typedData.message.expiresAt <= Math.floor(now / 1000)
  )
    throw new ApiError(
      403,
      "AUTHORIZATION",
      "Authorization expired or has a different origin/domain",
    );
  if (digest(payload) !== typedData.message.payloadHash)
    throw new ApiError(
      403,
      "PAYLOAD",
      "Signed content differs from submitted content",
    );
  let signer;
  try {
    signer = await recoverTypedDataAddress({ ...typedData, signature });
  } catch {
    throw new ApiError(403, "SIGNATURE", "Invalid wallet signature");
  }
  if (signer.toLowerCase() !== typedData.message.actor.toLowerCase())
    throw new ApiError(
      403,
      "SIGNATURE",
      "Wallet does not control this authorization",
    );
  return signer.toLowerCase();
}
function secret(env) {
  const s = env.FACE_SESSION_SECRET;
  if (!s || s.length < 32)
    throw new ApiError(
      503,
      "SESSION_CONFIG",
      "Workspace sessions are not configured",
    );
  return s;
}
export function issueSession(
  actor,
  origin,
  env = process.env,
  now = Date.now(),
) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "walletface",
      aud: origin,
      sub: actor.toLowerCase(),
      scope: "workspace.read",
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 900,
    }),
  ).toString("base64url");
  const signed = header + "." + payload;
  return (
    signed +
    "." +
    createHmac("sha256", secret(env)).update(signed).digest("base64url")
  );
}
export function sessionActor(
  request,
  origin,
  env = process.env,
  now = Date.now(),
) {
  const value = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!value || value.length > 1500)
    throw new ApiError(
      401,
      "SESSION_REQUIRED",
      "Sign in with your wallet to open private workspace records",
    );
  const parts = value.split(".");
  if (parts.length !== 3)
    throw new ApiError(401, "SESSION_INVALID", "Invalid session");
  const signed = parts[0] + "." + parts[1];
  const expected = createHmac("sha256", secret(env)).update(signed).digest();
  const got = Buffer.from(parts[2], "base64url");
  if (got.length !== expected.length || !timingSafeEqual(got, expected))
    throw new ApiError(401, "SESSION_INVALID", "Invalid session");
  let p, h;
  try {
    p = JSON.parse(Buffer.from(parts[1], "base64url"));
    h = JSON.parse(Buffer.from(parts[0], "base64url"));
  } catch {
    throw new ApiError(401, "SESSION_INVALID", "Invalid session");
  }
  if (
    h.alg !== "HS256" ||
    p.iss !== "walletface" ||
    p.aud !== origin ||
    p.scope !== "workspace.read" ||
    !Number.isFinite(p.exp) ||
    !Number.isFinite(p.iat) ||
    p.exp - p.iat !== 900 ||
    p.exp <= Math.floor(now / 1000) ||
    p.iat > Math.floor(now / 1000) + 30
  )
    throw new ApiError(
      401,
      "SESSION_EXPIRED",
      "Session expired or has a different audience",
    );
  return address(p.sub).toLowerCase();
}
