import { useState } from "react";
import { api, useLoad, Status, short, route } from "./shared";
import { DirectoryList } from "./DirectoryList";
export default function SpacePage({ id, zh }: { id: string; zh: boolean }) {
  const state = useLoad(() => api.space(id), id);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const directory = useLoad(
    () => api.directory(id, page, search),
    id + ":" + page + ":" + search,
  );
  const activity = useLoad(() => api.activity(id), id);
  return (
    <>
      <Status
        error={state.error}
        loading={!state.data}
        retry={state.retry}
        zh={zh}
      />
      {state.data && (
        <>
          <section className="panel">
            <div className="eyebrow">
              {state.data.official
                ? zh
                  ? "组织已验证"
                  : "ORGANIZATION VERIFIED"
                : zh
                  ? "公开资料镜像 · 非官方认领"
                  : "PUBLIC MIRROR · NOT OFFICIALLY CLAIMED"}
            </div>
            <h1>{state.data.branding?.name || state.data.space.name || id}</h1>
            <p>{state.data.branding?.about || state.data.space.about}</p>
            <div className="stats">
              <div>
                <strong>{state.data.counts.publicParticipantsObserved}</strong>
                {zh ? "观察到的公开参与钱包" : "Public wallets observed"}
              </div>
              <div>
                <strong>{state.data.counts.claimedProfilesObserved}</strong>
                {zh ? "已认领资料（扫描内）" : "Claimed profiles in scan"}
              </div>
              <div>
                <strong>{state.data.counts.proposalsObserved}</strong>
                {zh ? "扫描提案数" : "Proposals scanned"}
              </div>
            </div>
            <p className="muted">
              {zh
                ? "数据不等同于正式成员名单；扫描有上限，不保证涵盖全部历史。"
                : "This is not an official membership list. Bounded scans may not cover all history."}{" "}
              {zh ? "已扫描投票：" : "Votes scanned: "}
              {state.data.provenance.votesScanned} ·{" "}
              {state.data.provenance.votesComplete
                ? zh
                  ? "已到数据末尾"
                  : "End reached"
                : zh
                  ? "达到扫描上限"
                  : "Scan limited"}
            </p>
            <small>
              {zh
                ? "来源：Snapshot · 读取时间："
                : "Source: Snapshot · Fetched: "}
              {state.data.provenance.fetchedAt}
            </small>
            <p>
              <a
                href={state.data.provenance.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Snapshot ↗
              </a>{" "}
              ·{" "}
              <a href={route(id) + "/manage"}>
                {zh ? "管理员管理" : "Administrator management"}
              </a>
            </p>
          </section>
          <section className="panel">
            <h2>{zh ? "公开治理参与者" : "Public governance participants"}</h2>
            <label>
              {zh ? "搜索当前扫描目录" : "Search this scanned directory"}
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="0x…"
              />
            </label>
            <Status
              error={directory.error}
              loading={!directory.data}
              retry={directory.retry}
              zh={zh}
            />
            {directory.data && (
              <>
                {!directory.data.items.length ? (
                  <p>
                    {zh
                      ? "当前范围没有可显示的公开投票记录。"
                      : "No public participants in this scan."}
                  </p>
                ) : (
                  <DirectoryList data={directory.data} zh={zh} />
                )}
                <div className="actions">
                  <button
                    disabled={!page}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {zh ? "上一页" : "Previous"}
                  </button>
                  <button
                    disabled={!directory.data.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {zh ? "下一页" : "Next"}
                  </button>
                </div>
              </>
            )}
          </section>
          <section className="panel">
            <h2>
              {zh ? "最近公开治理活动" : "Recent public governance activity"}
            </h2>
            <Status
              error={activity.error}
              loading={!activity.data}
              retry={activity.retry}
              zh={zh}
            />
            {activity.data?.items.slice(0, 10).map((v) => (
              <p key={v.id}>
                <a href={"/u/" + v.voter}>{short(v.voter)}</a> ·{" "}
                <a
                  href={`https://snapshot.box/#/${encodeURIComponent(id)}/proposal/${encodeURIComponent(v.proposal.id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {v.proposal.title}
                </a>{" "}
                · {new Date(v.created * 1000).toLocaleDateString()}
              </p>
            ))}
          </section>
        </>
      )}
    </>
  );
}
