import { createPublicClient, http } from "viem";
import { mainnet, baseSepolia } from "viem/chains";
import { ApiError } from "../validation.mjs";
export const identityRegistries = Object.freeze({
  1: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  84532: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
});
const abi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "getAgentWallet",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
];
export async function verifyRegistration(
  ref,
  owner,
  env = process.env,
  clientFactory,
) {
  if (
    ref.registryAddress.toLowerCase() !==
    identityRegistries[ref.chainId]?.toLowerCase()
  )
    throw new ApiError(
      422,
      "REGISTRY_UNRECOGNIZED",
      "Use the documented ERC-8004 identity registry for this network",
    );
  const rpc = ref.chainId === 1 ? env.ENS_RPC_URL : env.BASE_SEPOLIA_RPC_URL;
  if (!rpc && !clientFactory)
    throw new ApiError(
      503,
      "REGISTRY_RPC",
      "A trusted RPC is not configured for this network",
    );
  const client = clientFactory
    ? clientFactory(ref.chainId)
    : createPublicClient({
        chain: ref.chainId === 1 ? mainnet : baseSepolia,
        transport: http(rpc, { timeout: 6000, retryCount: 0 }),
      });
  if ((await client.getChainId()) !== ref.chainId)
    throw new ApiError(502, "REGISTRY_CHAIN", "RPC returned a different chain");
  const block = await client.getBlockNumber();
  const contract = {
    address: ref.registryAddress,
    abi,
    args: [BigInt(ref.tokenId)],
    blockNumber: block,
  };
  const [actualOwner, uri, paymentWallet] = await Promise.all([
    client.readContract({ ...contract, functionName: "ownerOf" }),
    client.readContract({ ...contract, functionName: "tokenURI" }),
    client.readContract({ ...contract, functionName: "getAgentWallet" }),
  ]);
  if (actualOwner.toLowerCase() !== owner.toLowerCase())
    throw new ApiError(
      403,
      "REGISTRY_OWNER",
      "The registered token owner differs from this profile wallet",
    );
  if (typeof uri !== "string" || uri.length > 8192)
    throw new ApiError(
      502,
      "REGISTRY_METADATA",
      "Registration URI is unavailable or oversized",
    );
  return {
    status: "registered-owner-checked",
    chainId: ref.chainId,
    registryAddress: ref.registryAddress,
    agentId: ref.tokenId,
    owner: actualOwner.toLowerCase(),
    agentWallet: paymentWallet.toLowerCase(),
    agentURI: uri,
    blockNumber: block.toString(),
    checkedAt: new Date().toISOString(),
    sourceUrl: `https://${ref.chainId === 1 ? "etherscan.io" : "sepolia.basescan.org"}/token/${ref.registryAddress}?a=${ref.tokenId}`,
    registrationFileStatus: "not_fetched",
    reliability: "not_assessed",
  };
}
