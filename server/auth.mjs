import { randomBytes, randomUUID } from "node:crypto";
import { recoverTypedDataAddress, keccak256, toBytes } from "viem";
import { address, payloadFor, payloadHash, ApiError } from "./validation.mjs";
export const authTypes = {
  Authorization: [
    { name: "address", type: "address" },
    { name: "action", type: "string" },
    { name: "payloadHash", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "origin", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
};
export function challenge(store, origin, addr, action, input) {
  const payload = payloadFor(action, input);
  const a = address(addr);
  const data = {
    domain: {
      name: "Wallet Face",
      version: "1",
      chainId: 1,
      salt: keccak256(toBytes(origin)),
    },
    types: authTypes,
    primaryType: "Authorization",
    message: {
      address: a,
      action,
      payloadHash: payloadHash(payload),
      nonce: "0x" + randomBytes(32).toString("hex"),
      origin,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
    },
  };
  store.challenge(data);
  return { typedData: data, payload };
}
export async function execute(
  { store, snapshot, origin },
  { nonce, signature, payload: input },
) {
  const c = store.getChallenge(nonce);
  if (!c || c.used || c.message.expiresAt < Math.floor(Date.now() / 1000))
    throw new ApiError(
      409,
      "REPLAY",
      "Authorization missing, expired, or already used",
    );
  if (c.message.origin !== origin)
    throw new ApiError(403, "ORIGIN", "Origin mismatch");
  const payload = payloadFor(c.message.action, input);
  if (payloadHash(payload) !== c.message.payloadHash)
    throw new ApiError(
      403,
      "PAYLOAD",
      "Payload differs from authorized content",
    );
  let signer;
  try {
    const { used, ...typed } = c;
    signer = await recoverTypedDataAddress({ ...typed, signature });
  } catch {
    throw new ApiError(
      403,
      "SIGNATURE",
      "Invalid EOA signature; EIP-1271 wallets are not supported in this release",
    );
  }
  if (signer.toLowerCase() !== c.message.address.toLowerCase())
    throw new ApiError(
      403,
      "SIGNATURE",
      "Signer does not control the requested profile",
    );
  let authority = null;
  if (payload.spaceId) {
    const space = await snapshot.space(payload.spaceId, true);
    if (!space.admins.some((a) => a.toLowerCase() === signer.toLowerCase()))
      throw new ApiError(
        403,
        "NOT_ADMIN",
        "Current Snapshot admin permission required",
      );
    authority = {
      source: "snapshot.admins",
      spaceId: space.id,
      checkedAt: new Date().toISOString(),
    };
  }
  const verification = {
    signature,
    typedData: (({ used, ...rest }) => rest)(c),
    authority,
  };
  return store.consume(nonce, () => {
    const action = c.message.action;
    const now = new Date().toISOString();
    if (action.startsWith("profile.")) {
      const key = signer.toLowerCase();
      const old = store.get("profile", key);
      if ((old?.revision || 0) !== payload.revision)
        throw new ApiError(
          409,
          "REVISION",
          "Profile changed; reload before signing again",
        );
      const value = {
        ...(action === "profile.hide"
          ? { name: "", bio: "", avatarURI: "", links: [] }
          : payload),
        address: signer,
        chainId: 1,
        revision: payload.revision + 1,
        visible: action !== "profile.hide",
        updatedAt: now,
        verification,
      };
      store.put("profile", key, value);
      return { ok: true, revision: value.revision };
    }
    if (action === "space.brand") {
      store.put(
        "space",
        payload.spaceId,
        { ...payload, issuer: signer, updatedAt: now, verification },
        payload.spaceId,
      );
      return { ok: true };
    }
    if (action === "role.set") {
      store.put(
        "role",
        payload.spaceId + ":" + payload.recipient.toLowerCase(),
        { ...payload, issuer: signer, updatedAt: now, verification },
        payload.spaceId,
      );
      return { ok: true };
    }
    if (action === "badge.issue") {
      if (
        payload.expiresAt &&
        payload.expiresAt <= Math.floor(Date.now() / 1000)
      )
        throw new ApiError(
          400,
          "EXPIRY",
          "Badge expiration must be in the future",
        );
      const id = randomUUID();
      store.put(
        "badge",
        id,
        {
          ...payload,
          class: "organization-issued",
          id,
          issuer: signer,
          issuedAt: now,
          revokedAt: null,
          verification,
        },
        payload.spaceId,
      );
      return { ok: true, id };
    }
    if (action === "badge.revoke") {
      const badge = store.get("badge", payload.id);
      if (!badge || badge.spaceId !== payload.spaceId)
        throw new ApiError(404, "BADGE", "Badge not found in this space");
      store.put(
        "badge",
        badge.id,
        { ...badge, revokedAt: now, revocation: verification },
        payload.spaceId,
      );
      return { ok: true };
    }
    throw new ApiError(400, "ACTION", "Unsupported action");
  });
}
