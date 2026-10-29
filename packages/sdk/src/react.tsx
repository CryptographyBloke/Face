import { useEffect, useState } from "react";
import { FaceClient } from "./index.js";
export function Identicon({
  address,
  size = 40,
}: {
  address: string;
  size?: number;
}) {
  const hex = address.replace(/^0x/, "").padEnd(40, "0");
  const color = "#" + hex.slice(0, 6);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      role="img"
      aria-label={`Wallet ${address}`}
      style={{ borderRadius: 8, background: "#eff0f8", flexShrink: 0 }}
    >
      {Array.from({ length: 15 }, (_, i) => {
        const x = i % 3,
          y = Math.floor(i / 3);
        return parseInt(hex[i], 16) % 2 ? (
          <g key={i} fill={color}>
            <rect x={x} y={y} width="1" height="1" />
            {x < 2 && <rect x={4 - x} y={y} width="1" height="1" />}
          </g>
        ) : null;
      })}
    </svg>
  );
}
export function WalletFaceAvatar({
  address,
  chainId = 1,
  size = 40,
  baseUrl = "",
}: {
  address: string;
  chainId?: number;
  size?: number;
  baseUrl?: string;
}) {
  const key = `${chainId}:${address}:${baseUrl}`;
  const [resolved, setResolved] = useState<{ key: string; sources: string[] }>({
    key: "",
    sources: [],
  });
  const sources = resolved.key === key ? resolved.sources : [];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let active = true;
    setResolved({ key, sources: [] });
    setIndex(0);
    new FaceClient(baseUrl)
      .resolveProfile({ address, chainId })
      .then((p) => {
        if (active) setResolved({ key, sources: p.avatar.urls });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [address, chainId, baseUrl, key]);
  return sources[index] ? (
    <img
      src={sources[index]}
      width={size}
      height={size}
      alt={`Avatar ${address}`}
      style={{ objectFit: "cover", borderRadius: 8 }}
      referrerPolicy="no-referrer"
      onError={() => setIndex((i) => i + 1)}
    />
  ) : (
    <Identicon address={address} size={size} />
  );
}
