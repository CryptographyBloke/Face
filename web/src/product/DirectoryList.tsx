import { Link } from "react-router-dom";
import type { Directory } from "../../../packages/sdk/src/index";
import { WalletFaceAvatar } from "../../../packages/sdk/src/react";
import { api } from "../app/resource";
import { profilePath, shortAddress } from "../app/config";
import { Badge } from "../ui/primitives";
import { Icon } from "../ui/Icon";
export function DirectoryList({
  data,
  zh,
  compact = false,
}: {
  data: Directory;
  zh: boolean;
  compact?: boolean;
}) {
  return (
    <div className="directory">
      {data.items.map((p) => (
        <article className="person" key={p.address}>
          <Link
            to={profilePath(p.address)}
            aria-label={p.name || shortAddress(p.address)}
          >
            <WalletFaceAvatar
              address={p.address}
              baseUrl={api.baseUrl}
              size={compact ? 36 : 42}
            />
          </Link>
          <div className="person-main">
            <Link className="person-name" to={profilePath(p.address)}>
              {p.name || shortAddress(p.address)}
            </Link>
            <small>
              {p.publicVotes}{" "}
              {zh ? "次公开投票（扫描范围内）" : "public votes in scan"}
            </small>
            <div className="tags">
              {p.profileClaimed && (
                <Badge tone="success">
                  {zh ? "资料已认领" : "Profile claimed"}
                </Badge>
              )}
              {p.roles
                .filter((r) => r.role)
                .map((r) => (
                  <Badge key={r.role}>{r.role}</Badge>
                ))}
              {p.badges
                .filter(
                  (b) =>
                    !b.revokedAt &&
                    (!b.expiresAt || b.expiresAt > Date.now() / 1000),
                )
                .map((b) => (
                  <Badge key={b.id}>
                    {b.type} · {shortAddress(b.issuer)}
                  </Badge>
                ))}
            </div>
          </div>
          {!compact && (
            <span className="person-date muted">
              {p.lastVotedAt
                ? new Date(p.lastVotedAt * 1000).toLocaleDateString(
                    zh ? "zh-CN" : "en-US",
                  )
                : "—"}
            </span>
          )}
          <Link
            className="person-open"
            to={profilePath(p.address)}
            aria-label={
              (zh ? "查看资料 " : "View profile ") + shortAddress(p.address)
            }
          >
            <Icon name="chevron" size={18} />
          </Link>
        </article>
      ))}
    </div>
  );
}
