import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { platformRequest, usePlatformSession, WalletSession } from "./client";
import "./platform.css";
type Analysis = {
  spaceId: string;
  range: { start: number; end: number };
  votes: number;
  wallets: number;
  ranking: { address: string; votes: number }[];
  distribution: { votes: number; wallets: number }[];
  trends: { month: string; votes: number; wallets: number }[];
  comparison: {
    votes: number;
    wallets: number;
    voteDelta: number;
    walletDelta: number;
  } | null;
  provenance: {
    sourceUrl: string;
    retrievedAt: string;
    completeness: string;
    scan: {
      votes_scanned: number;
      proposals_scanned: number;
      cutoff: string;
      updated_at: string;
    } | null;
    limitations: string;
  };
};
export default function Analytics() {
  const { t } = usePreferences();
  const { token } = usePlatformSession();
  const [q] = useSearchParams();
  const [space, setSpace] = useState(q.get("spaceId") || "ens.eth"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [compareStart, setCompareStart] = useState(""),
    [compareEnd, setCompareEnd] = useState(""),
    [data, setData] = useState<Analysis | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = async (refresh = false) => {
    setBusy(true);
    setError("");
    try {
      if (refresh) await platformRequest("index/" + space, {}, token);
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries({
        start,
        end,
        compareStart,
        compareEnd,
      }))
        if (v) {
          const parsed = new Date(v + "T00:00:00.000Z");
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
            !Number.isFinite(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== v
          )
            throw new Error(
              t(
                "请使用有效的 YYYY-MM-DD 日期。",
                "Use a valid YYYY-MM-DD date.",
              ),
            );
          search.set(k, String(Math.floor(parsed.getTime() / 1000)));
        }
      setData(
        await platformRequest<Analysis>("analytics/" + space + "?" + search),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="platform-page" aria-busy={busy}>
      <h1>{t("治理参与统计", "Governance participation")}</h1>
      <p>
        {t(
          "按明确时间区间统计已索引的公开记录。排名仅代表所观察的数据。管理员可以分批刷新；隐私投票不会保存。",
          "Analyze indexed public records within explicit time ranges. Rankings cover only the observed dataset. Administrators can refresh in bounded pages; private ballots are not retained.",
        )}
      </p>
      <div className="panel form">
        <label>
          Snapshot Space ID
          <input value={space} onChange={(e) => setSpace(e.target.value)} />
        </label>
        <div className="platform-grid">
          {[
            [t("开始（含）", "Start (inclusive)"), start, setStart],
            [t("结束（不含）", "End (exclusive)"), end, setEnd],
            [t("对比开始", "Comparison start"), compareStart, setCompareStart],
            [t("对比结束", "Comparison end"), compareEnd, setCompareEnd],
          ].map(([label, value, set], i) => (
            <label key={i}>
              {label as string}
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                maxLength={10}
                value={value as string}
                onChange={(e) => (set as (s: string) => void)(e.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="platform-links">
          <button disabled={busy} onClick={() => void load()}>
            {t("读取统计", "Load analytics")}
          </button>
          <WalletSession />
          <button disabled={busy || !token} onClick={() => void load(true)}>
            {t("管理员刷新下一页", "Admin: refresh next page")}
          </button>
        </div>
        {busy && (
          <p role="status">{t("正在读取统计…", "Loading analytics…")}</p>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      {data && (
        <>
          <div className="panel">
            <p>
              {t("覆盖状态", "Coverage")}: {data.provenance.completeness} ·{" "}
              {data.provenance.retrievedAt}
            </p>
            <p>
              {t(
                "统计区间（UTC，含开始、不含结束）",
                "Analysis range (UTC, inclusive start / exclusive end)",
              )}
              : {new Date(data.range.start * 1000).toISOString()} →{" "}
              {new Date(data.range.end * 1000).toISOString()}
            </p>
            <div className="metric-grid">
              <div>
                <strong>{data.votes}</strong>
                {t("公开投票", "Public votes")}
              </div>
              <div>
                <strong>{data.wallets}</strong>
                {t("观察到的钱包", "Observed wallets")}
              </div>
            </div>
            <p>
              {t("本轮已扫描", "Current scan")}:{" "}
              {data.provenance.scan?.proposals_scanned || 0}{" "}
              {t("个提案", "proposals")} ·{" "}
              {data.provenance.scan?.votes_scanned || 0} {t("条投票", "votes")}
            </p>
            <a
              href={data.provenance.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Snapshot →
            </a>
            <p>
              {t(
                "数据查询结束也不代表全球完整历史；数据可能缺失、撤回或在源端变化。",
                "Query exhaustion does not imply universally complete history; source records may be missing, withdrawn or changed.",
              )}
            </p>
            {data.comparison && (
              <p>
                {t("与对比区间相比", "Versus comparison range")}:{" "}
                {data.comparison.voteDelta >= 0 ? "+" : ""}
                {data.comparison.voteDelta} {t("票", "votes")} ·{" "}
                {data.comparison.walletDelta >= 0 ? "+" : ""}
                {data.comparison.walletDelta} {t("个钱包", "wallets")}
              </p>
            )}
          </div>
          <div className="panel platform-table">
            <h2>
              {t(
                "观察数据中的参与排名",
                "Participation ranking in observed data",
              )}
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{t("钱包", "Wallet")}</th>
                  <th>{t("投票次数", "Votes")}</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((r) => (
                  <tr key={r.address}>
                    <td>
                      <Link to={"/u/" + r.address}>
                        {r.address.slice(0, 8)}…{r.address.slice(-6)}
                      </Link>
                    </td>
                    <td>{r.votes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="platform-grid">
            <div className="panel">
              <h2>{t("月度活动（UTC）", "Monthly activity (UTC)")}</h2>
              {data.trends.map((r) => (
                <p key={r.month}>
                  {r.month} · {r.votes} {t("票", "votes")} · {r.wallets}{" "}
                  {t("个钱包", "wallets")}
                </p>
              ))}
            </div>
            <div className="panel">
              <h2>{t("参与分布", "Participation distribution")}</h2>
              {data.distribution.map((r) => (
                <p key={r.votes}>
                  {r.votes} {t("次投票", "votes")} → {r.wallets}{" "}
                  {t("个钱包", "wallets")}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
