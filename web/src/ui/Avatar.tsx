import { useState } from "react";
import { Identicon } from "../../../packages/sdk/src/react";
import { resolveAvatarUris } from "../storage";
import { safeHttps } from "../app/config";
export function Avatar({
  uri,
  seed,
  name,
  size = 48,
}: {
  uri?: string | null;
  seed: string;
  name: string;
  size?: number;
}) {
  const sources = resolveAvatarUris(uri || null)
    .map(safeHttps)
    .filter((u): u is string => !!u);
  const key = sources.join("|");
  const [failure, setFailure] = useState({ key: "", index: 0 });
  const index = failure.key === key ? failure.index : 0;
  return (
    <span className="avatar-frame" style={{ width: size, height: size }}>
      {sources[index] ? (
        <img
          src={sources[index]}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailure({ key, index: index + 1 })}
        />
      ) : (
        <Identicon address={seedFromText(seed)} size={size} />
      )}
    </span>
  );
}
function seedFromText(value: string) {
  if (/^0x[0-9a-fA-F]{40}$/.test(value)) return value;
  let hash = 0;
  for (const c of value) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) | 0;
  return "0x" + (hash >>> 0).toString(16).padStart(8, "0").repeat(5);
}
