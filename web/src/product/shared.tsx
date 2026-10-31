import { connectWallet } from "../wallet";
import type { ConnectedWallet } from "../app/WalletProvider";
import { api } from "../app/resource";
export { api } from "../app/resource";
export { spacePath as route, shortAddress as short } from "../app/config";
export async function authorize(
  action: string,
  payload: unknown,
  expectedAddress?: string,
  session?: ConnectedWallet,
) {
  const { address, walletClient } = session || (await connectWallet());
  if (
    expectedAddress &&
    expectedAddress.toLowerCase() !== address.toLowerCase()
  )
    throw new Error("Wallet account changed; reconnect the profile owner");
  const walletChain = await window.ethereum!.request({ method: "eth_chainId" });
  if (walletChain !== "0x1")
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1" }],
    });
  const c = await api.request<{
    payload: unknown;
    typedData: {
      domain: {
        name: string;
        version: string;
        chainId: 1;
        salt: `0x${string}`;
      };
      message: {
        address: `0x${string}`;
        action: string;
        payloadHash: `0x${string}`;
        nonce: `0x${string}`;
        origin: string;
        expiresAt: number;
      };
    };
  }>("/v1/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, action, payload }),
  });
  if (
    c.typedData.message.origin !== window.location.origin ||
    c.typedData.message.action !== action ||
    c.typedData.message.address.toLowerCase() !== address.toLowerCase()
  )
    throw new Error("Authorization origin/address/action mismatch");
  const types = {
    Authorization: [
      { name: "address", type: "address" },
      { name: "action", type: "string" },
      { name: "payloadHash", type: "bytes32" },
      { name: "nonce", type: "bytes32" },
      { name: "origin", type: "string" },
      { name: "expiresAt", type: "uint64" },
    ],
  } as const;
  const signature = await walletClient.signTypedData({
    account: address,
    domain: c.typedData.domain,
    types,
    primaryType: "Authorization",
    message: {
      ...c.typedData.message,
      expiresAt: BigInt(c.typedData.message.expiresAt),
    },
  });
  return api.request("/v1/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce: c.typedData.message.nonce,
      signature,
      payload: c.payload,
    }),
  });
}
