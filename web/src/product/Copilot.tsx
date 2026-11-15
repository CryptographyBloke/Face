import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { Icon } from "../ui/Icon";
import { CopyButton } from "../ui/primitives";
import { api } from "../app/resource";
import { validAddress, validSpaceId } from "../app/config";
import type {
  AgentContext,
  AgentStatus,
  AgentEvent,
  Evidence,
  ToolName,
} from "../../../packages/sdk/src/ai";
import "./copilot.css";
const names: Record<ToolName, [string, string]> = {
  getWalletProfile: ["钱包资料", "Wallet profile"],
  getSpace: ["社区概览", "Space overview"],
  listParticipants: ["活跃参与者", "Active participants"],
  getGovernanceActivity: ["公开活动", "Public activity"],
  getProposal: ["提案详情", "Proposal details"],
  analyzeParticipation: ["参与统计", "Participation analysis"],
};
async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return api.request<T>(path, {
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
    signal,
  });
}
function sourceHref(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" &&
      ["snapshot.box", "walletface.org"].includes(u.hostname) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
function localLink(id: string, pid?: string) {
  return (
    "/spaces/" +
    encodeURIComponent(id) +
    (pid ? "/proposals/" + encodeURIComponent(pid) : "")
  );
}
function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function DataView({ e }: { e: Evidence }) {
  const { t } = usePreferences();
  const d = e.data;
  if (e.tool === "getWalletProfile") {
    const p = d.profile as { name?: string; bio?: string };
    return (
      <div className="evidence-data">
        <strong>{p?.name || String(d.address)}</strong>
        <p className="break-address">{String(d.address)}</p>
        <p>{p?.bio}</p>
        <span>
          {t("资料认领验证", "Profile claim verified")}:{" "}
          {e.provenance.claimVerified
            ? t("已验证", "Verified")
            : t("未认领", "Unclaimed")}
        </span>
        <Link to={"/u/" + encodeURIComponent(String(d.address))}>
          {t("打开钱包资料", "Open wallet profile")} →
        </Link>
      </div>
    );
  }
  if (e.tool === "getProposal")
    return (
      <div className="evidence-data">
        <h3>{String(d.title)}</h3>
        <p>
          {t("状态", "State")}: {String(d.state)} · {String(d.type)}
        </p>
        <p>
          {new Date(Number(d.start) * 1000).toLocaleString()} →{" "}
          {new Date(Number(d.end) * 1000).toLocaleString()}
        </p>
        <p>
          {t("隐私模式", "Privacy")}: {String(d.privacy || t("公开", "Public"))}
        </p>
        <ol>
          {((d.choices as string[]) || []).map((c, i) => (
            <li key={i}>
              {c}
              {Array.isArray(d.scores) ? " · " + formatValue(d.scores[i]) : ""}
            </li>
          ))}
        </ol>
        <details>
          <summary>{t("提案正文", "Proposal body")}</summary>
          <p className="proposal-body">
            {String(d.body || t("正文缺失", "Body unavailable"))}
          </p>
          {d.bodyTruncated === true && (
            <small>
              {t("正文显示前 6000 字符", "Body limited to 6,000 characters")}
            </small>
          )}
        </details>
      </div>
    );
  if (e.tool === "analyzeParticipation")
    return (
      <div className="evidence-data">
        <div className="copilot-metrics">
          <div>
            <strong>{String(d.publicVotes)}</strong>
            <span>{t("公开投票", "Public votes")}</span>
          </div>
          <div>
            <strong>{String(d.uniqueWallets)}</strong>
            <span>{t("扫描内钱包", "Wallets in scan")}</span>
          </div>
          <div>
            <strong>
              {d.topFiveShare == null
                ? "—"
                : (Number(d.topFiveShare) * 100).toFixed(1) + "%"}
            </strong>
            <span>{t("前五钱包占比", "Top five share")}</span>
          </div>
        </div>
        <DataTable
          items={(d.ranking || []) as Record<string, unknown>[]}
          fields={["address", "publicVotes", "lastVotedAt"]}
        />
        <details>
          <summary>
            {t("分布、日期与区间统计", "Distribution, dates and ranges")}
          </summary>
          <pre>
            {JSON.stringify(
              {
                distribution: d.distribution,
                dailyCounts: d.dailyCounts,
                ranges: d.ranges,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </div>
    );
  if (e.tool === "getSpace") {
    const s = d.space as { id: string; name: string; about: string };
    return (
      <div className="evidence-data">
        <h3>{s.name || s.id}</h3>
        <p>{s.about}</p>
        <Link to={localLink(s.id)}>{t("打开社区", "Open Space")} →</Link>
        <div className="copilot-proposals">
          {((d.proposals as { id: string; title: string }[]) || []).map((p) => (
            <Link key={p.id} to={localLink(s.id, p.id)}>
              {p.title} →
            </Link>
          ))}
        </div>
      </div>
    );
  }
  return (
    <DataTable
      items={(d.items || []) as Record<string, unknown>[]}
      fields={
        e.tool === "listParticipants"
          ? ["address", "publicVotes", "lastVotedAt"]
          : ["voter", "created", "proposal"]
      }
    />
  );
}
function DataTable({
  items,
  fields,
}: {
  items: Record<string, unknown>[];
  fields: string[];
}) {
  const { t } = usePreferences();
  return items.length ? (
    <div className="copilot-table">
      <table>
        <thead>
          <tr>
            {fields.map((f) => (
              <th key={f}>
                {t(
                  ...(
                    {
                      address: ["钱包地址", "Address"],
                      voter: ["投票钱包", "Voter"],
                      publicVotes: ["公开投票数", "Public votes"],
                      lastVotedAt: ["最近投票", "Last voted"],
                      created: ["投票时间", "Voted at"],
                      proposal: ["提案", "Proposal"],
                    } as Record<string, [string, string]>
                  )[f],
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => (
            <tr key={i}>
              {fields.map((f) => (
                <td key={f}>
                  {f === "address" || f === "voter" ? (
                    <Link to={"/u/" + encodeURIComponent(String(p[f]))}>
                      {String(p[f])}
                    </Link>
                  ) : f === "proposal" ? (
                    String((p[f] as { title?: string })?.title || "—")
                  ) : f === "created" || f === "lastVotedAt" ? (
                    new Date(Number(p[f]) * 1000).toLocaleString()
                  ) : (
                    formatValue(p[f])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p>{t("此扫描范围内没有记录", "No records in this scan")}</p>
  );
}
export function EvidenceCard({ e, index }: { e: Evidence; index: number }) {
  const { t } = usePreferences();
  const p = e.provenance;
  const href = sourceHref(p.sourceUrl);
  return (
    <article className="copilot-evidence">
      <header>
        <strong>
          [{index}] {t(...names[e.tool])}
        </strong>
        {href && (
          <a href={href} target="_blank" rel="noreferrer">
            {p.source} ↗
          </a>
        )}
      </header>
      <DataView e={e} />
      <footer>
        <time>
          {t("读取于", "Retrieved")} {new Date(p.fetchedAt).toLocaleString()}
        </time>
        {p.votesScanned !== undefined && (
          <span>
            {p.proposalsScanned} {t("提案", "proposals")} · {p.votesScanned}{" "}
            {t("已扫描投票", "votes scanned")} ·{" "}
            {p.votesComplete && p.proposalsComplete
              ? t("查询已到末尾", "Query exhausted")
              : t("扫描范围有限", "Scan limited")}
            {p.scanLimits
              ? ` (${p.scanLimits.proposals}/${p.scanLimits.votes})`
              : ""}
          </span>
        )}
        {p.privateVotesOmitted !== undefined && (
          <span>
            {t("隐私投票已排除", "Private votes omitted")}:{" "}
            {p.privateVotesOmitted}
          </span>
        )}
      </footer>
    </article>
  );
}
type Turn = {
  tool?: ToolName;
  question: string;
  text: string;
  evidence: Evidence[];
  error?: string;
  stopped?: boolean;
  usage?: string;
};
export default function Copilot({
  spaceId,
  proposalId,
  address,
  embedded = false,
}: {
  spaceId?: string;
  proposalId?: string;
  address?: string;
  embedded?: boolean;
}) {
  const { t, lang } = usePreferences();
  const [params] = useSearchParams();
  const [space, setSpace] = useState(spaceId || params.get("space") || "");
  const [wallet, setWallet] = useState(address || params.get("address") || "");
  const [proposal, setProposal] = useState(
    proposalId || params.get("proposal") || "",
  );
  const [status, setStatus] = useState<AgentStatus | null>(null),
    [statusError, setStatusError] = useState("");
  const [question, setQuestion] = useState(""),
    [turns, setTurns] = useState<Turn[]>([]),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [error, setError] = useState(""),
    [beta, setBeta] = useState("");
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    request<AgentStatus>("/v1/ai/status", undefined, controller.signal)
      .then(setStatus)
      .catch(() => {
        if (!controller.signal.aborted)
          setStatusError(
            t("无法读取服务状态，请重试", "Status unavailable; retry"),
          );
      });
    return () => {
      mounted.current = false;
      controller.abort();
      abort.current?.abort();
    };
  }, [lang]);
  const context: AgentContext = {
    ...(space ? { spaceId: space } : {}),
    ...(wallet ? { address: wallet } : {}),
    ...(proposal ? { proposalId: proposal } : {}),
  };
  function checked() {
    if (space && !validSpaceId(space))
      throw Error(t("请输入有效的 Space ID", "Enter a valid Space ID"));
    if (wallet && !validAddress(wallet))
      throw Error(t("请输入有效的钱包地址", "Enter a valid wallet address"));
    if (proposal && (!/^0x[0-9a-fA-F]{64}$/.test(proposal) || !space))
      throw Error(
        t(
          "提案需要 Space ID 和完整哈希",
          "Proposal needs a Space ID and full hash",
        ),
      );
  }
  function update(fn: (turn: Turn) => Turn) {
    if (mounted.current)
      setTurns((old) => old.map((v, i) => (i === old.length - 1 ? fn(v) : v)));
  }
  async function runTool(name: ToolName) {
    if (busy) return;
    try {
      checked();
      if (name === "getWalletProfile" && !wallet)
        throw Error(t("请填写钱包地址", "Enter a wallet address"));
      if (name !== "getWalletProfile" && !space)
        throw Error(t("请填写 Space ID", "Enter a Space ID"));
      if (name === "getProposal" && !proposal)
        throw Error(t("请填写提案哈希", "Enter a proposal hash"));
    } catch (e) {
      setError(String((e as Error).message));
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    setProgress(t(...names[name]));
    setTurns((old) =>
      [
        ...old,
        { tool: name, question: t(...names[name]), text: "", evidence: [] },
      ].slice(-4),
    );
    try {
      const body =
        name === "getWalletProfile"
          ? { chainId: 1, address: wallet }
          : name === "getProposal"
            ? { spaceId: space, proposalId: proposal }
            : name === "getGovernanceActivity"
              ? { spaceId: space, ...(wallet ? { address: wallet } : {}) }
              : { spaceId: space };
      const e = await request<Evidence>(
        "/v1/ai/tools/" + name,
        body,
        controller.signal,
      );
      update((v) => ({ ...v, evidence: [e] }));
    } catch (e) {
      update((v) => ({
        ...v,
        error: controller.signal.aborted
          ? t("已停止", "Stopped")
          : (e as Error).message,
      }));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  async function ask(text = question) {
    if (busy || !text.trim()) return;
    try {
      checked();
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!status?.available) {
      setError(
        t(
          "AI 尚未激活，可使用下方公开数据工具。",
          "AI is not activated. Use the public data tools below.",
        ),
      );
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    setQuestion("");
    setProgress(t("正在分析", "Analyzing"));
    const history = turns
      .filter((v) => v.text && !v.error)
      .slice(-3)
      .flatMap((v) => [
        { role: "user", content: v.question },
        { role: "assistant", content: v.text.slice(0, 3000) },
      ]);
    setTurns((old) =>
      [...old, { question: text, text: "", evidence: [] }].slice(-4),
    );
    try {
      const res = await fetch("/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(beta ? { Authorization: "Bearer " + beta } : {}),
        },
        body: JSON.stringify({
          context,
          language: lang,
          messages: [...history, { role: "user", content: text }],
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const b = await res.json();
        throw Error(
          b.error?.code === "AI_QUOTA"
            ? t("配额已用完，请稍后重试", "Quota reached; retry later")
            : b.error?.code === "BETA_ACCESS"
              ? t("请填写内测访问密钥", "Enter the beta access key")
              : b.error?.message || "Request failed",
        );
      }
      const reader = res.body?.getReader();
      if (!reader) throw Error("Stream unavailable");
      const decoder = new TextDecoder();
      let buffer = "",
        finished = false;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const e: AgentEvent = JSON.parse(line);
        if (e.type === "text") update((v) => ({ ...v, text: v.text + e.text }));
        if (e.type === "evidence")
          update((v) => ({ ...v, evidence: [...v.evidence, e.result] }));
        if (e.type === "tool")
          setProgress(
            t(...names[e.name]) +
              (e.status === "failed" ? t("：读取失败", ": failed") : ""),
          );
        if (e.type === "error") {
          finished = true;
          update((v) => ({
            ...v,
            error:
              e.code === "CANCELLED"
                ? t("已停止或超时", "Stopped or timed out")
                : e.message,
          }));
        }
        if (e.type === "done") {
          finished = true;
          update((v) => ({
            ...v,
            usage: `${e.usage.totalTokens} tokens · ${e.toolCalls} tools`,
          }));
        }
      };
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 100000) throw Error("Malformed stream");
          let end;
          while ((end = buffer.indexOf("\n")) >= 0) {
            consume(buffer.slice(0, end));
            buffer = buffer.slice(end + 1);
          }
        }
        buffer += decoder.decode();
        consume(buffer);
        if (!finished)
          throw Error(t("连接中断，请重试", "Stream interrupted; retry"));
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch (e) {
      update((v) => ({
        ...v,
        error: controller.signal.aborted
          ? t("已停止", "Stopped")
          : (e as Error).message,
      }));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  function exportTurn(v: Turn) {
    const text = [
      v.question,
      v.text,
      ...v.evidence.map(
        (e, i) =>
          `[${i + 1}] ${e.tool}\n${JSON.stringify(e.data, null, 2)}\n${JSON.stringify(e.provenance, null, 2)}`,
      ),
    ].join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "wallet-face-analysis.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  const prompts = [
    t(
      "概括这个社区的公开治理活动",
      "Summarize this Space’s public governance activity",
    ),
    t(
      "扫描内哪些钱包参与最活跃？",
      "Which wallets are most active in this scan?",
    ),
    t(
      "解释这个提案的选择与时间安排",
      "Explain this proposal’s choices and timing",
    ),
  ];
  return (
    <section
      className={"copilot " + (embedded ? "copilot-embedded" : "page-stack")}
    >
      <div className="copilot-heading">
        <div>
          <span className="eyebrow">WALLET FACE / COPILOT</span>
          <h1>
            Face Copilot <span className="copilot-beta">BETA</span>
          </h1>
          <p>
            {t(
              "用公开证据了解 DAO 治理。",
              "Understand DAO governance through public evidence.",
            )}
          </p>
        </div>
        <Icon name="activity" size={32} />
      </div>
      <div className="copilot-status" role="status">
        <span className={status?.available ? "status-dot on" : "status-dot"} />
        {status?.available
          ? t("AI 内测 · 只读工具", "AI beta · read-only tools")
          : status
            ? t(
                "公开数据可用 · AI 待激活",
                "Public data available · AI awaiting activation",
              )
            : statusError || t("正在检查服务", "Checking service")}
        {statusError && (
          <button className="button" onClick={() => window.location.reload()}>
            {t("重试", "Retry")}
          </button>
        )}
      </div>
      <div className="panel copilot-context">
        <label>
          Snapshot Space ID
          <input
            disabled={busy || !!spaceId}
            value={space}
            maxLength={100}
            onChange={(e) => {
              setSpace(e.target.value.trim());
              setTurns([]);
            }}
            placeholder="ens.eth"
          />
        </label>
        <label>
          {t("钱包地址（可选）", "Wallet address (optional)")}
          <input
            disabled={busy || !!address}
            value={wallet}
            maxLength={42}
            onChange={(e) => {
              setWallet(e.target.value.trim());
              setTurns([]);
            }}
            placeholder="0x…"
          />
        </label>
        <label>
          {t("提案哈希（可选）", "Proposal hash (optional)")}
          <input
            disabled={busy || !!proposalId}
            value={proposal}
            maxLength={66}
            onChange={(e) => {
              setProposal(e.target.value.trim());
              setTurns([]);
            }}
            placeholder="0x…"
          />
        </label>
      </div>
      <div className="copilot-tools">
        {(Object.keys(names) as ToolName[]).map((n) => (
          <button
            className="button"
            key={n}
            disabled={busy}
            onClick={() => void runTool(n)}
          >
            {t(...names[n])}
            <Icon name="arrow" size={14} />
          </button>
        ))}
      </div>
      <div
        className="copilot-conversation"
        aria-label={t("研究记录", "Research conversation")}
      >
        {turns.map((v, i) => (
          <article className="copilot-turn" key={i}>
            <h2>{v.question}</h2>
            {v.text && <div className="copilot-answer">{v.text}</div>}
            {v.evidence.map((e, j) => (
              <EvidenceCard key={j} e={e} index={j + 1} />
            ))}
            {v.error && (
              <div className="copilot-error" role="alert">
                {v.error}
                <button
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void (v.tool ? runTool(v.tool) : ask(v.question))
                  }
                >
                  {t("重试", "Retry")}
                </button>
              </div>
            )}
            {(v.text || v.evidence.length > 0) && (
              <div className="actions">
                <CopyButton
                  value={v.text || JSON.stringify(v.evidence, null, 2)}
                  label={t("复制", "Copy")}
                />
                <button className="button" onClick={() => exportTurn(v)}>
                  {t("导出", "Export")}
                </button>
                {v.usage && <small>{v.usage}</small>}
              </div>
            )}
          </article>
        ))}
      </div>
      {busy && (
        <div className="copilot-progress" role="status">
          <span className="status-dot on" />
          {progress}
          <button className="button" onClick={() => abort.current?.abort()}>
            {t("停止", "Stop")}
          </button>
        </div>
      )}
      <div className="panel copilot-composer">
        <div className="copilot-prompts">
          {prompts.map((p) => (
            <button key={p} disabled={busy} onClick={() => setQuestion(p)}>
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label className="sr-only" htmlFor="copilot-question">
            {t("治理问题", "Governance question")}
          </label>
          <textarea
            id="copilot-question"
            placeholder={t(
              "询问社区、钱包或提案…",
              "Ask about a Space, wallet or proposal…",
            )}
            value={question}
            maxLength={3000}
            disabled={busy}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="copilot-composer-footer">
            <small>
              {t("会话仅保留在当前页面", "Conversation stays on this page")}
            </small>
            <button
              className="button primary"
              disabled={busy || !question.trim() || !status?.available}
            >
              {t("发送", "Send")} <Icon name="arrow" size={15} />
            </button>
          </div>
        </form>
        {status?.available && (
          <details>
            <summary>{t("内测访问", "Beta access")}</summary>
            <input
              type="password"
              aria-label={t("内测密钥", "Beta access key")}
              value={beta}
              onChange={(e) => setBeta(e.target.value)}
              autoComplete="off"
            />
          </details>
        )}
        {error && (
          <p className="copilot-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {!embedded && !space && (
        <div className="copilot-discover">
          {["ens.eth", "yam.eth", "aavedao.eth"].map((id) => (
            <button
              className="button"
              key={id}
              onClick={() => {
                setSpace(id);
                setTurns([]);
              }}
            >
              {id} →
            </button>
          ))}
          <Link to="/spaces">{t("探索社区", "Explore Spaces")} →</Link>
        </div>
      )}
    </section>
  );
}
