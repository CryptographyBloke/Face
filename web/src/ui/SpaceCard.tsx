import { Link } from "react-router-dom";
import { api, useResource } from "../app/resource";
import { useSpaces, type SavedSpace } from "../app/SpacesProvider";
import { usePreferences } from "../app/Preferences";
import { spacePath } from "../app/config";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LoadingSkeleton } from "./primitives";
export function FollowButton({ space }: { space: SavedSpace }) {
  const { followed, toggle } = useSpaces();
  const { t } = usePreferences();
  const active = followed.some((s) => s.id === space.id);
  return (
    <button
      className={active ? "follow-button selected" : "follow-button"}
      aria-pressed={active}
      aria-label={`${t(active ? "取消收藏" : "收藏社区", active ? "Unfollow space" : "Follow space")} ${space.name}`}
      onClick={() => toggle(space)}
    >
      <Icon name={active ? "check" : "plus"} size={16} />
      {t(active ? "已收藏" : "收藏", active ? "Following" : "Follow")}
    </button>
  );
}
export function SpaceCard({ id }: { id: string }) {
  const { data, error, loading, retry } = useResource(
    "summary:" + id,
    (signal) => api.summary(id, { signal }),
  );
  const { t } = usePreferences();
  const space = {
    id,
    name: data?.space.name || id,
    avatar: data?.space.avatar || null,
  };
  return (
    <article className="space-card">
      <div className="space-card-top">
        <Link to={spacePath(id)} aria-label={space.name}>
          <Avatar uri={space.avatar} seed={id} name={space.name} size={52} />
        </Link>
        <FollowButton space={space} />
      </div>
      <Link className="space-card-title" to={spacePath(id)}>
        {space.name}
        <Icon name="chevron" size={17} />
      </Link>
      <div className="space-id">{id}</div>
      {loading ? (
        <LoadingSkeleton rows={2} />
      ) : (
        <p className="card-description">
          {data?.space.about ||
            t(
              "查看社区公开资料与治理活动。",
              "Explore this community’s public profile and governance.",
            )}
        </p>
      )}
      <div className="space-card-footer">
        <span>
          <i className="status-dot" /> Snapshot
        </span>
        {error ? (
          <button className="text-button" onClick={retry}>
            {t("重新读取", "Retry")}
          </button>
        ) : (
          <Link to={spacePath(id)}>
            {t("查看社区", "Open space")} <Icon name="arrow" size={14} />
          </Link>
        )}
      </div>
    </article>
  );
}
