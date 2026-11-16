import { createPublicClient, http, parseAbi, parseEventLogs } from "viem";
import { baseSepolia } from "viem/chains";
import { ASSET, NETWORK } from "./protocol.mjs";
const abi = parseAbi([
  "event Transfer(address indexed from,address indexed to,uint256 value)",
  "event AuthorizationUsed(address indexed authorizer,bytes32 indexed nonce)",
]);
export async function checkSettlement(
  record,
  env = process.env,
  clientFactory,
) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(record.transaction_hash || "")) return null;
  const client = clientFactory
    ? clientFactory()
    : createPublicClient({
        chain: baseSepolia,
        transport: http(
          env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
          { timeout: 5000, retryCount: 0 },
        ),
      });
  try {
    if ((await client.getChainId()) !== 84532) return null;
    const receipt = await client.getTransactionReceipt({
      hash: record.transaction_hash,
    });
    if (receipt.status !== "success")
      return {
        settled: false,
        reverted: true,
        blockNumber: receipt.blockNumber.toString(),
      };
    const logs = receipt.logs.filter(
        (l) => l.address.toLowerCase() === ASSET.toLowerCase(),
      ),
      events = parseEventLogs({ abi, logs, strict: true });
    const transfer = events.some(
      (e) =>
        e.eventName === "Transfer" &&
        e.args.from.toLowerCase() === record.payer &&
        e.args.to.toLowerCase() === record.receiver &&
        e.args.value === BigInt(record.amount),
    );
    const nonce = events.some(
      (e) =>
        e.eventName === "AuthorizationUsed" &&
        e.args.authorizer.toLowerCase() === record.payer &&
        e.args.nonce.toLowerCase() === record.authorization_nonce,
    );
    if (!transfer || !nonce) return null;
    return {
      settled: true,
      network: NETWORK,
      asset: ASSET,
      amount: String(record.amount),
      payer: record.payer,
      receiver: record.receiver,
      authorizationNonce: record.authorization_nonce,
      transactionHash: record.transaction_hash,
      blockNumber: receipt.blockNumber.toString(),
      checkedAt: new Date().toISOString(),
      sourceUrl: "https://sepolia.basescan.org/tx/" + record.transaction_hash,
    };
  } catch {
    return null;
  }
}
