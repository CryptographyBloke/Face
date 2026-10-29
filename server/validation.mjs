import { getAddress, isAddress, keccak256, toBytes } from "viem";
import { z } from "zod";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function address(value) {
  if (typeof value !== "string" || !isAddress(value, { strict: false }))
    throw new ApiError(400, "INVALID_ADDRESS", "Invalid EVM address");
  return getAddress(value.toLowerCase());
}
export function chain(value) {
  if (String(value) !== "1")
    throw new ApiError(
      422,
      "UNSUPPORTED_CHAIN",
      "This release resolves Ethereum identities (chainId 1) only",
    );
  return 1;
}
export function spaceId(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(value))
    throw new ApiError(400, "INVALID_SPACE", "Invalid Snapshot Space ID");
  return value;
}
export function avatarUrls(uri) {
  if (!uri) return [];
  if (/^ipfs:\/\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9._-]+)*$/.test(uri)) {
    const p = uri.slice(7);
    if (p.split("/").some((x) => x === "." || x === "..")) return [];
    return [
      "https://ipfs.io/ipfs/",
      "https://dweb.link/ipfs/",
      "https://gateway.pinata.cloud/ipfs/",
    ].map((g) => g + p);
  }
  if (/^ar:\/\/[a-zA-Z0-9_-]+$/.test(uri))
    return ["https://arweave.net/" + uri.slice(5)];
  try {
    const u = new URL(uri);
    return u.protocol === "https:" && !u.username && !u.password
      ? [u.href]
      : [];
  } catch {
    return [];
  }
}
const text = (n) => z.string().trim().max(n);
const safeLink = z
  .string()
  .max(2048)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "Use an HTTPS URL without credentials");
export const profileSchema = z
  .object({
    name: text(80),
    bio: text(500),
    avatarURI: text(256).refine(
      (v) => !v || avatarUrls(v).length > 0,
      "Invalid avatar URI",
    ),
    links: z.array(safeLink).max(5),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const schemas = {
  "profile.upsert": profileSchema,
  "profile.hide": z
    .object({ revision: z.number().int().nonnegative() })
    .strict(),
  "space.brand": z
    .object({
      spaceId: z.string().transform(spaceId),
      name: text(100).min(1),
      about: text(1000),
    })
    .strict(),
  "badge.issue": z
    .object({
      spaceId: z.string().transform(spaceId),
      recipient: z.string().transform(address),
      type: z.enum(["Organization Member", "Event Participant", "Contributor"]),
      evidence: text(500),
      expiresAt: z.number().int().positive().nullable(),
    })
    .strict(),
  "badge.revoke": z
    .object({ spaceId: z.string().transform(spaceId), id: z.string().uuid() })
    .strict(),
  "role.set": z
    .object({
      spaceId: z.string().transform(spaceId),
      recipient: z.string().transform(address),
      role: text(60),
    })
    .strict(),
};
export function payloadFor(action, payload) {
  if (!schemas[action])
    throw new ApiError(400, "INVALID_ACTION", "Unsupported signed action");
  return schemas[action].parse(payload);
}
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const payloadHash = (payload) => keccak256(toBytes(canonical(payload)));
export const publicProfileSchema = z.object({
  chainId: z.literal(1),
  address: z.string(),
  avatar: z.object({
    uri: z.string().nullable(),
    resolvedUrl: z.string().nullable(),
    urls: z.array(z.string()),
    source: z.enum(["face", "snapshot", "ens", "none"]),
  }),
  profile: z.object({
    name: z.string().nullable(),
    bio: z.string().nullable(),
    links: z.array(z.string()),
    revision: z.number().int(),
  }),
  provenance: z.object({
    profileClaimVerified: z.boolean(),
    sources: z.array(z.string()),
    warnings: z.array(z.string()),
    verification: z.unknown().nullable(),
  }),
  updatedAt: z.string().nullable(),
  cache: z.object({ fetchedAt: z.string(), ttlSeconds: z.number() }),
});
