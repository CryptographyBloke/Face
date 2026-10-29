import { useEffect, useState } from "react";
import { FaceClient } from "../../../packages/sdk/src/index";
import { connectWallet } from "../wallet";
export const api = new FaceClient(import.meta.env.VITE_FACE_API_URL || "");
export const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
export const route = (id: string) => "/spaces/" + encodeURIComponent(id);
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError("");
    load()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [key, refresh]);
  return { data, error, retry: () => setRefresh((r) => r + 1) };
}
export function Status({
  error,
  loading,
  retry,
  zh,
}: {
  error: string;
  loading: boolean;
  retry: () => void;
  zh: boolean;
}) {
  return error ? (
    <div className="alert" role="alert">
      {zh ? "读取失败：" : "Could not load: "}
      {error} <button onClick={retry}>{zh ? "重试" : "Retry"}</button>
    </div>
  ) : loading ? (
    <div className="skeleton" role="status">
      {zh ? "正在读取公开资料…" : "Loading public data…"}
    </div>
  ) : null;
}
export async function authorize(
  action: string,
  payload: unknown,
  expectedAddress?: string,
) {
  const { address, walletClient } = await connectWallet();
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
