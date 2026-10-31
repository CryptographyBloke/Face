import { useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import type { Activity, Provenance } from "../../../packages/sdk/src/index";
import { usePreferences } from "../app/Preferences";
import { useSpaces } from "../app/SpacesProvider";
import { api, useResource } from "../app/resource";
import {
  profilePath,
  shareUrl,
  shortAddress,
  spacePath,
  validSpaceId,
} from "../app/config";
import { Avatar } from "../ui/Avatar";
import { FollowButton } from "../ui/SpaceCard";
import { Icon } from "../ui/Icon";
import {
  Badge,
  CopyButton,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  Pagination,
  SearchInput,
  Tabs,
} from "../ui/primitives";
import { DirectoryList } from "./DirectoryList";
function ActivityFeed({
  activity,
  id,
  limit = 50,
}: {
  activity: Activity;
  id: string;
  limit?: number;
}) {
  const { t, zh } = usePreferences();
  return activity.items.length ? (
    <div className="activity-feed">
      {activity.items.slice(0, limit).map((item) => (
        <article key={item.id} className="activity-item">
          <div className="activity-icon">
            <Icon name="activity" size={18} />
          </div>
          <div>
            <div className="activity-byline">
              <Link to={profilePath(item.voter)}>
                {shortAddress(item.voter)}
              </Link>
              <span>{t("参与了投票", "cast a public vote")}</span>
              <time dateTime={new Date(item.created * 1000).toISOString()}>
                {new Date(item.created * 1000).toLocaleDateString(
                  zh ? "zh-CN" : "en-US",
                )}
              </time>
            </div>
            <a
              className="proposal-title"
              target="_blank"
              rel="noreferrer"
              href={`https://snapshot.box/#/${encodeURIComponent(id)}/proposal/${encodeURIComponent(item.proposal.id)}`}
            >
              {item.proposal.title}
              <Icon name="external" size={14} />
            </a>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState
      icon="activity"
      title={t("暂无公开活动", "No public activity in this scan")}
    />
  );
}
function SourceDetails({ provenance }: { provenance: Provenance }) {
  const { t, zh } = usePreferences();
  return (
    <details className="source-details">
      <summary>
        <Icon name="info" size={15} />
        {t("数据来源与扫描范围", "Source and scan details")}
      </summary>
      <div>
        <p>
          Snapshot · {t("读取于", "Retrieved")}{" "}
          {new Date(provenance.fetchedAt).toLocaleString(
            zh ? "zh-CN" : "en-US",
          )}
        </p>
        <p>
          {provenance.proposalsScanned} {t("个提案", "proposals")} ·{" "}
          {provenance.votesScanned} {t("条公开投票", "public votes")} ·{" "}
          {t(
            provenance.votesComplete ? "已到数据末尾" : "扫描达到上限",
            provenance.votesComplete ? "End reached" : "Scan limit reached",
          )}
        </p>
        <a href={provenance.sourceUrl} target="_blank" rel="noreferrer">
          Snapshot <Icon name="external" size={13} />
        </a>
      </div>
    </details>
  );
}
export default function SpacePage() {
  const { spaceId = "", section = "" } = useParams();
  if (!validSpaceId(spaceId)) return <InvalidSpace />;
  if (!["", "participants", "activity", "about"].includes(section))
    return <Navigate replace to={spacePath(spaceId)} />;
  return <SpaceView key={spaceId} id={spaceId} section={section} />;
}
function InvalidSpace() {
  const { t } = usePreferences();
  return (
    <EmptyState
      title={t(
        "请输入有效的 Snapshot Space ID",
        "Enter a valid Snapshot Space ID",
      )}
    />
  );
}
function SpaceView({ id, section }: { id: string; section: string }) {
  const { t, zh } = usePreferences();
  const { visit } = useSpaces();
  const [params, setParams] = useSearchParams();
  const state = useResource("space:" + id, (signal) =>
    api.space(id, { signal }),
  );
  const page = Math.max(
    0,
    Math.min(100, Math.floor(Number(params.get("page")) || 0)),
  );
  const query = params.get("q") || "";
  const [search, setSearch] = useState(query);
  const sort = ["recent", "votes", "address"].includes(params.get("sort") || "")
    ? params.get("sort")!
    : "recent";
  useEffect(() => setSearch(query), [query]);
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      search ? next.set("q", search) : next.delete("q");
      next.delete("page");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, query, params, setParams]);
  const directory = useResource(
    `directory:${id}:${page}:${query}:${sort}`,
    (signal) => api.directory(id, page, query, { signal }, sort),
    section === "" || section === "participants",
  );
  const activity = useResource(
    "activity:" + id,
    (signal) => api.activity(id, { signal }),
    section === "" || section === "activity",
  );
  const d = state.data;
  useEffect(() => {
    if (d)
      visit({
        id,
        name: d.branding?.name || d.space.name || id,
        avatar: d.space.avatar,
      });
  }, [id, d, visit]);
  if (!d)
    return state.error ? (
      <ErrorState message={state.error} retry={state.retry} />
    ) : (
      <LoadingSkeleton rows={7} />
    );
  const name = d.branding?.name || d.space.name || id;
  return (
    <div className="page-stack space-page">
      <section className="space-header">
        <div className="space-cover">
          <span>WALLET FACE / COMMUNITY</span>
          <div className="cover-lines" />
        </div>
        <div className="space-header-content">
          <Avatar uri={d.space.avatar} seed={id} name={name} size={80} />
          <div className="space-header-actions">
            <FollowButton space={{ id, name, avatar: d.space.avatar }} />
            <CopyButton
              value={shareUrl(spacePath(id))}
              label={t("分享", "Share")}
            />
          </div>
          <div className="space-title">
            <h1>{name}</h1>
            {d.official && (
              <Badge tone="success">
                {t("组织已验证", "Organization verified")}
              </Badge>
            )}
          </div>
          <div className="space-id">
            {id} <span>· Snapshot</span>
          </div>
          <p>
            {d.branding?.about ||
              d.space.about ||
              t(
                "这个社区的公开资料与治理记录。",
                "Public profile and governance records for this community.",
              )}
          </p>
          <div className="space-meta">
            <a href={d.provenance.sourceUrl} target="_blank" rel="noreferrer">
              Snapshot
              <Icon name="external" size={13} />
            </a>
            <Link to={spacePath(id) + "/manage"}>
              {t("社区管理", "Administration")}
            </Link>
          </div>
        </div>
        <Tabs
          label={t("社区导航", "Space navigation")}
          items={[
            {
              to: spacePath(id),
              label: t("概览", "Overview"),
              active: section === "",
            },
            {
              to: spacePath(id) + "/participants",
              label: t("参与者", "Participants"),
              active: section === "participants",
            },
            {
              to: spacePath(id) + "/activity",
              label: t("活动", "Activity"),
              active: section === "activity",
            },
            {
              to: spacePath(id) + "/about",
              label: t("关于", "About"),
              active: section === "about",
            },
          ]}
        />
      </section>
      {section === "" && (
        <>
          <div className="metric-grid">
            <div className="metric">
              <span>
                {t("公开参与钱包（扫描内）", "Public wallets observed")}
              </span>
              <strong>
                {d.counts.publicParticipantsObserved.toLocaleString()}
              </strong>
              <small>
                {t("公开治理参与", "Public governance participation")}
              </small>
            </div>
            <div className="metric">
              <span>
                {t("已认领资料（扫描内）", "Claimed profiles observed")}
              </span>
              <strong>
                {d.counts.claimedProfilesObserved.toLocaleString()}
              </strong>
              <small>{t("钱包签名验证", "Wallet-signed profiles")}</small>
            </div>
            <div className="metric">
              <span>{t("扫描提案", "Proposals scanned")}</span>
              <strong>{d.counts.proposalsObserved.toLocaleString()}</strong>
              <small>
                {d.provenance.votesScanned} {t("条公开投票", "public votes")}
              </small>
            </div>
          </div>
          <div className="space-overview-grid">
            <section className="panel">
              <div className="section-heading">
                <h2>{t("最近治理活动", "Recent governance")}</h2>
                <Link to={spacePath(id) + "/activity"}>
                  {t("全部活动", "View activity")}
                  <Icon name="arrow" size={15} />
                </Link>
              </div>
              {activity.error ? (
                <ErrorState message={activity.error} retry={activity.retry} />
              ) : activity.data ? (
                <ActivityFeed activity={activity.data} id={id} limit={4} />
              ) : (
                <LoadingSkeleton />
              )}
            </section>
            <section className="panel">
              <div className="section-heading">
                <h2>{t("认识参与者", "Meet the participants")}</h2>
              </div>
              {directory.error ? (
                <ErrorState message={directory.error} retry={directory.retry} />
              ) : directory.data ? (
                <>
                  <DirectoryList
                    data={{
                      ...directory.data,
                      items: directory.data.items.slice(0, 4),
                    }}
                    zh={zh}
                    compact
                  />
                  <Link
                    className="button full-width"
                    to={spacePath(id) + "/participants"}
                  >
                    {t("打开参与者目录", "Explore participants")}
                    <Icon name="arrow" size={16} />
                  </Link>
                </>
              ) : (
                <LoadingSkeleton />
              )}
            </section>
          </div>
        </>
      )}
      {section === "participants" && (
        <section className="panel directory-panel">
          <div className="section-heading">
            <div>
              <h2>{t("公开治理参与者", "Public governance participants")}</h2>
              <p className="muted">
                {t(
                  "通过钱包地址或资料名称查找。",
                  "Find a wallet address or profile name.",
                )}
              </p>
            </div>
            <Badge>
              {directory.data?.totalObserved ??
                d.counts.publicParticipantsObserved}{" "}
              {t("个钱包", "wallets")}
            </Badge>
          </div>
          <div className="directory-toolbar">
            <SearchInput
              value={search}
              onChange={setSearch}
              label={t("搜索参与者", "Search participants")}
              placeholder={t("钱包地址或名称", "Wallet address or name")}
            />
            <label className="sort-select">
              <span className="sr-only">{t("排序", "Sort participants")}</span>
              <select
                aria-label={t("排序", "Sort participants")}
                value={sort}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  next.set("sort", e.target.value);
                  next.delete("page");
                  setParams(next);
                }}
              >
                <option value="recent">
                  {t("最近参与", "Recent activity")}
                </option>
                <option value="votes">{t("投票次数", "Public votes")}</option>
                <option value="address">
                  {t("钱包地址", "Wallet address")}
                </option>
              </select>
            </label>
          </div>
          {directory.error ? (
            <ErrorState message={directory.error} retry={directory.retry} />
          ) : directory.data ? (
            <>
              {directory.data.items.length ? (
                <DirectoryList data={directory.data} zh={zh} />
              ) : (
                <EmptyState
                  title={t("没有匹配的参与者", "No matching participants")}
                  description={t(
                    "试试其他地址或名称。",
                    "Try another address or name.",
                  )}
                />
              )}
              <Pagination
                page={page}
                hasMore={directory.data.hasMore}
                onPage={(p) => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(p));
                  setParams(next);
                }}
              />
            </>
          ) : (
            <LoadingSkeleton rows={6} />
          )}
        </section>
      )}
      {section === "activity" && (
        <section className="panel">
          <div className="section-heading">
            <h2>{t("公开治理活动", "Public governance activity")}</h2>
            <Badge>Snapshot</Badge>
          </div>
          {activity.error ? (
            <ErrorState message={activity.error} retry={activity.retry} />
          ) : activity.data ? (
            <ActivityFeed activity={activity.data} id={id} />
          ) : (
            <LoadingSkeleton rows={5} />
          )}
        </section>
      )}
      {section === "about" && (
        <section className="panel prose">
          <h2>{t("关于社区", "About this community")}</h2>
          <p>{d.space.about || "—"}</p>
          <dl className="metadata-list">
            <div>
              <dt>Snapshot Space ID</dt>
              <dd>{id}</dd>
            </div>
            <div>
              <dt>{t("网络 ID", "Network ID")}</dt>
              <dd>{d.space.network}</dd>
            </div>
            <div>
              <dt>{t("管理员钱包", "Administrator wallets")}</dt>
              <dd>
                {d.space.admins.map((a) => (
                  <Link key={a} to={profilePath(a)}>
                    {shortAddress(a)}
                  </Link>
                ))}
              </dd>
            </div>
          </dl>
          <h3>{t("扫描提案", "Observed proposals")}</h3>
          {d.proposals.slice(0, 8).map((p) => (
            <p key={p.id}>
              <a
                href={`https://snapshot.box/#/${encodeURIComponent(id)}/proposal/${p.id}`}
                target="_blank"
                rel="noreferrer"
              >
                {p.title}
                <Icon name="external" size={13} />
              </a>
            </p>
          ))}
        </section>
      )}
      <SourceDetails provenance={d.provenance} />
    </div>
  );
}
