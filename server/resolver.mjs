import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import {
  address,
  chain,
  avatarUrls,
  publicProfileSchema,
} from "./validation.mjs";
export function ensAdapter(endpoint) {
  if (!endpoint) return null;
  const client = createPublicClient({
    chain: mainnet,
    transport: http(endpoint, { timeout: 5000, retryCount: 1 }),
  });
  return async (addr) => {
    const name = await client.getEnsName({ address: addr });
    return name
      ? { name, avatar: await client.getEnsText({ name, key: "avatar" }) }
      : null;
  };
}
export async function resolveProfile({ snapshot, store, ens }, chainId, addr) {
  chain(chainId);
  const a = address(addr);
  const native = store?.get("profile", a.toLowerCase());
  const warnings = [];
  let snap = null,
    record = null;
  try {
    snap = await snapshot.user(a);
  } catch {
    warnings.push("Snapshot profile source unavailable");
  }
  if (ens)
    try {
      record = await ens(a);
    } catch {
      warnings.push("ENS profile source unavailable");
    }
  const claim = native?.visible ? native : null;
  const candidates = [
    ["face", claim?.avatarURI],
    ["snapshot", snap?.avatar],
    ["ens", record?.avatar],
  ];
  const chosen = candidates.find(([, uri]) => avatarUrls(uri).length > 0);
  const uri = chosen?.[1] || null;
  const urls = avatarUrls(uri);
  return publicProfileSchema.parse({
    chainId: 1,
    address: a,
    avatar: {
      uri,
      resolvedUrl: urls[0] || null,
      urls,
      source: chosen?.[0] || "none",
    },
    profile: {
      name: claim?.name || snap?.name || record?.name || null,
      bio: claim?.bio || snap?.about || null,
      links: claim?.links || [],
      revision: native?.revision || 0,
    },
    provenance: {
      profileClaimVerified: !!claim,
      sources: [
        ...(claim ? ["face"] : []),
        ...(snap ? ["snapshot"] : []),
        ...(record ? ["ens"] : []),
      ],
      warnings,
      verification: claim?.verification || null,
    },
    updatedAt: claim?.updatedAt || null,
    cache: { fetchedAt: new Date().toISOString(), ttlSeconds: 60 },
  });
}
