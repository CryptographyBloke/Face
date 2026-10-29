import type { Directory } from "../../../packages/sdk/src/index";
import { WalletFaceAvatar } from "../../../packages/sdk/src/react";
import { short, api } from "./shared";
export function DirectoryList({ data, zh }: { data: Directory; zh: boolean }) {
  return (
    <div className="directory">
      {data.items.map((p) => (
        <article className="person" key={p.address}>
          <WalletFaceAvatar address={p.address} baseUrl={api.baseUrl} />
          <div>
            <a href={"/u/" + p.address}>{p.name || short(p.address)}</a>
            <small>
              {p.publicVotes}{" "}
              {zh ? "次公开投票（扫描范围内）" : "public votes in scan"}
            </small>
            <div className="tags">
              {p.profileClaimed && (
                <span>{zh ? "资料已认领" : "Profile claimed"}</span>
              )}
              {p.roles
                .filter((r) => r.role)
                .map((r) => (
                  <span key={r.role}>
                    {r.role} · {zh ? "组织分配" : "Org-issued"}
                  </span>
                ))}
              {p.badges
                .filter(
                  (b) =>
                    !b.revokedAt &&
                    (!b.expiresAt || b.expiresAt > Date.now() / 1000),
                )
                .map((b) => (
                  <span key={b.id}>
                    {b.type} · {short(b.issuer)}
                  </span>
                ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
