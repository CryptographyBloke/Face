import { Link, useSearchParams } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useSpaces } from "../app/SpacesProvider";
import { CURATED_SPACES, spacePath, validSpaceId } from "../app/config";
import { SpaceCard } from "../ui/SpaceCard";
import { EmptyState, PageHeader, SearchInput, Tabs } from "../ui/primitives";
import { Icon } from "../ui/Icon";
export default function Explore({ collection }: { collection?: "followed" }) {
  const { t } = usePreferences();
  const { followed, recent } = useSpaces();
  const [params, setParams] = useSearchParams();
  const view = collection ? "followed" : params.get("view") || "discover";
  const query = params.get("q") || "";
  const all = [
    ...new Set([
      ...CURATED_SPACES,
      ...followed.map((s) => s.id),
      ...recent.map((s) => s.id),
    ]),
  ];
  const pool =
    view === "followed"
      ? followed.map((s) => s.id)
      : view === "recent"
        ? recent.map((s) => s.id)
        : all;
  const ids = pool.filter((id) =>
    (
      id +
      " " +
      (followed.find((s) => s.id === id)?.name ||
        recent.find((s) => s.id === id)?.name ||
        "")
    )
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const direct = query.trim().toLowerCase();
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="COMMUNITIES"
        title={t(
          collection ? "收藏的社区" : "探索社区",
          collection ? "Your communities" : "Explore communities",
        )}
        description={t(
          "发现公开社区，了解参与者与治理活动。",
          "Find public spaces, meet participants and explore governance.",
        )}
      />
      <div className="explore-toolbar">
        <SearchInput
          label={t("搜索社区", "Search communities")}
          placeholder={t(
            "社区名称或 Snapshot Space ID",
            "Community name or Snapshot Space ID",
          )}
          value={query}
          onChange={(q) => {
            const next = new URLSearchParams(params);
            q ? next.set("q", q) : next.delete("q");
            setParams(next, { replace: true });
          }}
        />
        {validSpaceId(direct) && direct.includes(".") && (
          <Link className="button" to={spacePath(direct)}>
            {t("打开社区", "Open space")}
            <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>
      {!collection && (
        <Tabs
          label={t("社区分类", "Space collections")}
          items={[
            {
              to: "/spaces",
              label: t("发现", "Discover"),
              active: view === "discover",
            },
            {
              to: "/spaces?view=followed",
              label: t("收藏", "Following"),
              active: view === "followed",
              count: followed.length,
            },
            {
              to: "/spaces?view=recent",
              label: t("最近访问", "Recent"),
              active: view === "recent",
              count: recent.length,
            },
          ]}
        />
      )}
      <div className="section-heading">
        <span className="muted">
          {view === "discover"
            ? t("公开社区精选", "Public space collection")
            : t("保存在此浏览器", "Saved in this browser")}
        </span>
        <span className="muted">
          {ids.length} {t("个社区", "spaces")}
        </span>
      </div>
      {ids.length ? (
        <div className="space-grid">
          {ids.map((id) => (
            <SpaceCard key={id} id={id} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={view === "followed" ? "star" : "search"}
          title={t(
            view === "followed" ? "还没有收藏社区" : "没有匹配的社区",
            view === "followed"
              ? "Your next community is waiting"
              : "No matching spaces",
          )}
          description={t(
            "打开社区后点击收藏，或输入完整的 Snapshot Space ID。",
            "Follow a space to keep it here, or enter its full Snapshot Space ID.",
          )}
        >
          <Link className="button" to="/spaces">
            {t("发现社区", "Discover spaces")}
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
