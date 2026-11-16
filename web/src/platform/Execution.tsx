import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { usePlatformSession, WalletSession, SignedAction } from "./client";
import { CopyButton } from "../ui/primitives";
import { EvidenceCard } from "../product/Copilot";
import type { Evidence } from "../../../packages/sdk/src/ai";
import "./execution.css";
export type Service = {
  id: string;
  agentId: string | null;
  name: string;
  description: string;
  category: string;
  protocol: string;
  capability: string;
  inputSchema: Record<string, unknown>;
  endpointUrl: string | null;
  discoveryUrl?: string;
  price: {
    amount: string;
    network: string;
    asset: string;
    payTo: string;
  } | null;
  executionAvailable: boolean;
  availability: string;
  platformProvided: boolean;
  owner: string | null;
  revision: number;
};
type Run = {
  owner?: string | null;
  id: string;
  state: string;
  cancelRequested?: boolean;
  plan: Service;
  planHash: string;
  input: { task: string; arguments: Record<string, unknown> };
  result: { text?: string; evidence?: unknown[]; structured?: unknown } | null;
  errorCode?: string;
  events?: { id: number; kind: string; data: unknown }[];
  accessToken?: string;
};
async function call<T>(
  path: string,
  {
    body,
    token,
    runToken,
    signal,
  }: {
    body?: unknown;
    token?: string | null;
    runToken?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const r = await fetch("/v1/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(runToken ? { "X-Face-Run-Token": runToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error?.message || "Request failed");
  return d;
}
function privateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
function download(value: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([value], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const categoryNames: Record<string, [string, string]> = {
  governance: ["治理研究", "Governance"],
  security: ["安全研究", "Security"],
  onchain: ["链上研究", "On-chain Research"],
  developer: ["开发工具", "Developer Tools"],
  data: ["数据分析", "Data & Analytics"],
  content: ["内容与自动化", "Content & Automation"],
  identity: ["身份核验", "Identity & Verification"],
};
export default function Marketplace() {
  const { t } = usePreferences(),
    [items, setItems] = useState<Service[]>([]),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [protocol, setProtocol] = useState(""),
    [price, setPrice] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController(),
      query = new URLSearchParams();
    if (q) query.set("q", q);
    if (category) query.set("category", category);
    if (protocol) query.set("protocol", protocol);
    if (price) query.set("price", price);
    call<{ items: Service[] }>("marketplace/services?" + query, {
      signal: c.signal,
    })
      .then((d) => {
        setItems(d.items);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [q, category, protocol, price]);
  return (
    <section className="platform-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">IDENTITY · DISCOVERY · EXECUTION</p>
          <h1>{t("Agent 服务市场", "Agent Marketplace")}</h1>
          <p>
            {t(
              "选择服务、审核能力与参数，再获取可重新打开的任务结果。",
              "Choose a service, review its capability and inputs, then receive a task result you can reopen.",
            )}
          </p>
        </div>
        <div className="platform-links">
          <Link to="/my-agents/connect">
            {t("发布我的 Agent", "Publish my Agent")}
          </Link>
          <Link to="/developer/agents">
            {t("开发者工作台", "Developer Dashboard")}
          </Link>
        </div>
      </header>
      <div className="panel execution-filters">
        <label>
          {t("搜索服务", "Search services")}
          <input
            value={q}
            maxLength={100}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          {t("分类", "Category")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t("全部", "All")}</option>
            {Object.entries(categoryNames).map(([k, v]) => (
              <option key={k} value={k}>
                {t(...v)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("接入方式", "Protocol")}
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
          >
            <option value="">{t("全部", "All")}</option>
            {["internal", "mcp", "a2a"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          {t("价格", "Price")}
          <select value={price} onChange={(e) => setPrice(e.target.value)}>
            <option value="">{t("全部", "All")}</option>
            <option value="free">{t("免费", "Free")}</option>
            <option value="paid">{t("付费", "Paid")}</option>
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="platform-grid">
        {items.map((s) => (
          <article className="panel agent-card" key={s.id}>
            <p className="eyebrow">
              {t(...(categoryNames[s.category] || categoryNames.data))} ·{" "}
              {s.protocol.toUpperCase()}
            </p>
            <h2>{s.name}</h2>
            <p>{s.description}</p>
            <p>
              {s.price
                ? `${s.price.amount} atomic USDC · ${s.price.network}`
                : t("免费使用", "Free to use")}
            </p>
            <p>
              {s.platformProvided
                ? t("Wallet Face 提供", "Provided by Wallet Face")
                : t(
                    "发布者声明，分别核验控制权",
                    "Publisher declaration; control checked separately",
                  )}
            </p>
            <small>
              {t(
                ...(statusNames[s.availability] || [
                  s.availability,
                  s.availability,
                ]),
              )}
            </small>
            <div className="actions">
              <Link
                className="button primary"
                to={
                  "/agents/" +
                  (s.agentId || s.id) +
                  "/playground?service=" +
                  encodeURIComponent(s.id)
                }
              >
                {t("试用 Agent", "Try Agent")}
              </Link>
              {s.agentId && (
                <Link to={"/agents/" + s.agentId}>
                  {t("查看身份", "View identity")}
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      {!items.length && !error && (
        <div className="panel">
          {t(
            "没有符合条件的服务。可调整筛选或发布自己的 Agent。",
            "No matching service. Adjust the filters or publish your Agent.",
          )}
        </div>
      )}
      <Link to="/my-agents">{t("管理我的 Agent", "Manage my Agents")} →</Link>
    </section>
  );
}
const statusNames: Record<string, [string, string]> = {
  ready: ["可以使用", "Ready"],
  paused: ["已暂停", "Paused"],
  stale_profile: ["需要重新验证", "Reverification needed"],
  pending_operator_review: ["等待执行审核", "Awaiting execution review"],
  payment_activation_required: ["等待支付验收", "Payment acceptance pending"],
  awaiting_approval: ["请审核任务", "Review required"],
  executing: ["正在执行", "Executing"],
  completed: ["已完成", "Completed"],
  failed: ["执行失败", "Failed"],
  cancelled: ["已取消", "Cancelled"],
  waiting_remote: ["等待远程 Agent", "Waiting for remote Agent"],
  needs_input: ["需要补充输入", "Input required"],
  execution_unknown: ["执行结果待核查", "Execution outcome unknown"],
};
function parsedArguments(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
export function Playground() {
  const { id } = useParams(),
    [params] = useSearchParams(),
    serviceId = params.get("service") || id || "",
    { t, lang } = usePreferences(),
    { token } = usePlatformSession();
  const [service, setService] = useState<Service | null>(null),
    [run, setRun] = useState<Run | null>(null),
    [task, setTask] = useState(""),
    [args, setArgs] = useState('{"spaceId":"ens.eth"}'),
    [retain, setRetain] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [partial, setPartial] = useState(""),
    [events, setEvents] = useState<string[]>([]),
    [history, setHistory] = useState<{ id: string; task: string }[]>([]);
  const abort = useRef<AbortController | null>(null),
    runSecret = useRef("");
  useEffect(() => {
    const c = new AbortController();
    setService(null);
    setRun(null);
    call<Service>("marketplace/services/" + encodeURIComponent(serviceId), {
      signal: c.signal,
    })
      .then(setService)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    try {
      setHistory(
        JSON.parse(sessionStorage.getItem("face-task-history") || "[]"),
      );
    } catch {
      setHistory([]);
    }
    return () => {
      c.abort();
      abort.current?.abort();
    };
  }, [serviceId]);
  const auth = (secret = runSecret.current) => ({ token, runToken: secret });
  useEffect(() => {
    setRun((r) => (r?.owner ? null : r));
    setPartial("");
    setEvents([]);
  }, [token]);
  async function reopen(runId: string) {
    setError("");
    try {
      const secret = sessionStorage.getItem("face-task:" + runId) || "";
      runSecret.current = secret;
      setRun(await call<Run>("agent-runs/" + runId, auth(secret)));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function prepare() {
    setBusy(true);
    setError("");
    try {
      const input = JSON.parse(args),
        runId = crypto.randomUUID(),
        secret = privateToken();
      sessionStorage.setItem("face-task:" + runId, secret);
      runSecret.current = secret;
      const created = await call<Run>("agent-runs", {
        body: {
          id: runId,
          serviceId,
          task,
          language: lang,
          arguments: input,
          retainResult: true,
        },
        ...auth(secret),
      });
      setRun({ ...created, accessToken: undefined });
      setEvents([]);
      const next = [{ id: runId, task }, ...history].slice(0, 30);
      setHistory(next);
      sessionStorage.setItem("face-task-history", JSON.stringify(next));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function execute() {
    if (!run) return;
    setBusy(true);
    setError("");
    setPartial("");
    const c = new AbortController();
    abort.current = c;
    try {
      const r = await fetch("/v1/agent-runs/" + run.id + "/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Face-Run-Token": runSecret.current,
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: JSON.stringify({ approved: true, planHash: run.planHash }),
        signal: c.signal,
      });
      if (!r.ok) {
        const d = await r.json();
        throw Error(d.error?.message || "Execution failed");
      }
      const reader = r.body?.getReader();
      if (!reader) throw Error("Stream missing");
      const decoder = new TextDecoder();
      let buffer = "",
        finished = false;
      const accept = (line: string) => {
        if (!line.trim()) return;
        const e = JSON.parse(line);
        setEvents((old) =>
          [...old, e.tool ? `${e.kind}: ${e.tool}` : e.kind].slice(-40),
        );
        if (e.kind === "text" && typeof e.text === "string")
          setPartial((old) => old + e.text);
        if (e.kind === "result" && e.run) setRun(e.run);
        if (e.kind === "done") {
          finished = true;
          if (e.run) setRun(e.run);
        }
        if (e.kind === "error") setError(e.message || e.code);
      };
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          buffer += decoder.decode(part.value, { stream: true });
          if (buffer.length > 250000)
            throw Error("Execution stream exceeds limit");
          let end;
          while ((end = buffer.indexOf("\n")) >= 0) {
            accept(buffer.slice(0, end));
            buffer = buffer.slice(end + 1);
          }
        }
        buffer += decoder.decode();
        accept(buffer);
        if (!finished)
          throw Error(
            t(
              "连接中断，请重新打开原任务查询状态。",
              "Connection interrupted; reopen the original task to inspect its state.",
            ),
          );
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!run) return;
    try {
      const r = await call<Run>("agent-runs/" + run.id + "/cancel", {
        body: {},
        ...auth(),
      });
      abort.current?.abort();
      setRun(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function poll() {
    if (!run) return;
    setBusy(true);
    try {
      setRun(
        await call<Run>("agent-runs/" + run.id + "/poll", {
          body: {},
          ...auth(),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="platform-page execution-playground">
      <header className="page-heading">
        <div>
          <p className="eyebrow">AGENT PLAYGROUND</p>
          <h1>{service?.name || t("Agent 任务", "Agent task")}</h1>
          <p>{service?.description}</p>
        </div>
        <Link to="/agents">{t("返回市场", "Back to Marketplace")}</Link>
      </header>
      {error && (
        <p role="alert" className="copilot-error">
          {error}
        </p>
      )}
      <WalletSession />
      {service && (
        <>
          <div className="panel">
            <p>
              {service.protocol.toUpperCase()} · {service.capability} ·{" "}
              {t(
                ...(statusNames[service.availability] || [
                  service.availability,
                  service.availability,
                ]),
              )}
            </p>
            <p className="break-address">
              {service.endpointUrl ||
                t(
                  "Wallet Face 内置公开数据工具",
                  "Wallet Face internal public-data tools",
                )}
            </p>
            <p>
              {service.price
                ? `${service.price.amount} atomic USDC · ${service.price.network}`
                : t("本次服务免费", "This service is free")}
            </p>
            {service.owner && (
              <p className="break-address">
                {t("发布钱包", "Publisher wallet")}: {service.owner}
              </p>
            )}
          </div>
          <div className="panel form">
            <label>
              {t("任务描述", "Task description")}
              <textarea
                value={task}
                maxLength={3000}
                onChange={(e) => setTask(e.target.value)}
                placeholder={t(
                  "概括 ENS DAO 当前可用的公开治理记录，保留来源和扫描范围。",
                  "Summarize ENS DAO’s available public governance records with sources and scan scope.",
                )}
              />
            </label>
            {service.platformProvided && (
              <label>
                {t("Snapshot Space", "Snapshot Space")}
                <input
                  value={String(parsedArguments(args).spaceId || "")}
                  onChange={(e) =>
                    setArgs(
                      JSON.stringify({
                        ...parsedArguments(args),
                        spaceId: e.target.value,
                      }),
                    )
                  }
                  maxLength={100}
                />
              </label>
            )}
            {service.platformProvided &&
              "periodDays" in
                ((service.inputSchema.properties || {}) as Record<
                  string,
                  unknown
                >) && (
                <label>
                  {t("统计区间（UTC）", "Analysis period (UTC)")}
                  <select
                    value={String(parsedArguments(args).periodDays || 30)}
                    onChange={(e) =>
                      setArgs(
                        JSON.stringify({
                          ...parsedArguments(args),
                          periodDays: Number(e.target.value),
                        }),
                      )
                    }
                  >
                    {[7, 30, 90, 365].map((n) => (
                      <option key={n} value={n}>
                        {n} {t("天", "days")}
                      </option>
                    ))}
                  </select>
                  <small>
                    {t(
                      "按提案创建时间及投票时间筛选本次扫描；历史扫描上限仍适用。",
                      "Filters proposal creation and vote timestamps in the observed scan; scan limits still apply.",
                    )}
                  </small>
                </label>
              )}
            <details>
              <summary>{t("本次参数与能力", "Inputs and capability")}</summary>
              <p>
                {t(
                  "只会执行下面显示的能力与参数；服务返回内容按不可信数据展示。",
                  "Only the displayed capability and inputs will execute. Service output is treated as untrusted data.",
                )}
              </p>
              <label>
                {t("输入参数 JSON", "Input JSON")}
                <textarea
                  value={args}
                  maxLength={8000}
                  onChange={(e) => setArgs(e.target.value)}
                />
              </label>
              <pre>{JSON.stringify(service.inputSchema, null, 2)}</pre>
            </details>
            <label>
              <input
                type="checkbox"
                checked={retain}
                onChange={(e) => setRetain(e.target.checked)}
              />
              {t(
                "保存此任务和结果用于重新查看；访问凭据有效 30 天。匿名凭据仅保存在当前浏览器会话。",
                "Save this task and result for later review; access expires in 30 days. Anonymous credentials stay in this browser session.",
              )}
            </label>
            <button
              className="button primary"
              disabled={
                busy || !task.trim() || !retain || !service.executionAvailable
              }
              onClick={() => void prepare()}
            >
              {t("准备并审核任务", "Prepare and review task")}
            </button>
          </div>
        </>
      )}
      {run && (
        <article className="panel">
          <h2>
            {t("任务状态", "Task status")}:{" "}
            {t(...(statusNames[run.state] || [run.state, run.state]))}
          </h2>
          <p className="break-address">{run.id}</p>
          <h3>{run.plan.name}</h3>
          <p className="break-address">
            {run.plan.endpointUrl ||
              t("Wallet Face 内置能力", "Wallet Face internal capability")}
          </p>
          <p>{run.input.task}</p>
          <p>
            {run.plan.protocol} · {run.plan.capability} ·{" "}
            {run.plan.price ? t("付费", "Paid") : t("免费", "Free")}
          </p>
          <pre>{JSON.stringify(run.input.arguments, null, 2)}</pre>
          {run.state === "awaiting_approval" && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void execute()}
            >
              {t(
                "批准上述能力与参数并执行",
                "Approve displayed capability and inputs, then execute",
              )}
            </button>
          )}
          {[
            "awaiting_approval",
            "executing",
            "waiting_remote",
            "needs_input",
          ].includes(run.state) && (
            <button className="button" onClick={() => void cancel()}>
              {t("取消任务", "Cancel task")}
            </button>
          )}
          {run.state === "waiting_remote" && (
            <button
              className="button"
              disabled={busy}
              onClick={() => void poll()}
            >
              {t("查询远程进度", "Check remote progress")}
            </button>
          )}
          <button
            className="button"
            disabled={busy}
            onClick={() => void reopen(run.id)}
          >
            {t("重新读取记录", "Reload task record")}
          </button>
          {run.errorCode && <p role="alert">{run.errorCode}</p>}
          {run.cancelRequested && (
            <p>
              {t(
                "已请求取消，正在等待执行端结束。",
                "Cancellation requested; awaiting execution termination.",
              )}
            </p>
          )}
          {busy && partial && <div className="execution-answer">{partial}</div>}
          <div role="log">
            {events.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
          {run.result && (
            <>
              <div className="execution-answer">{run.result.text}</div>
              {run.plan.platformProvided &&
                run.plan.protocol === "internal" &&
                Array.isArray(run.result.evidence) &&
                run.result.evidence.map((e, i) => (
                  <EvidenceCard key={i} e={e as Evidence} index={i + 1} />
                ))}
              <details>
                <summary>
                  {t("结构化结果与证据", "Structured result and evidence")}
                </summary>
                <pre>{JSON.stringify(run.result, null, 2)}</pre>
              </details>
              <div className="actions">
                <CopyButton
                  value={run.result.text || JSON.stringify(run.result)}
                  label={t("复制结果", "Copy result")}
                />
                <button
                  className="button"
                  onClick={() =>
                    download(
                      `# ${run.plan.name}\n\n${run.input.task}\n\n${run.result?.text || ""}\n\n\x60\x60\x60json\n${JSON.stringify(run.result, null, 2)}\n\x60\x60\x60\n`,
                      "text/markdown;charset=utf-8",
                      "wallet-face-task.md",
                    )
                  }
                >
                  {t("导出 Markdown", "Export Markdown")}
                </button>
                <button
                  className="button"
                  onClick={() =>
                    download(
                      JSON.stringify(
                        { ...run, accessToken: undefined },
                        null,
                        2,
                      ),
                      "application/json",
                      "wallet-face-task.json",
                    )
                  }
                >
                  {t("导出 JSON", "Export JSON")}
                </button>
              </div>
            </>
          )}
        </article>
      )}
      {!!history.length && (
        <div className="panel">
          <h2>{t("当前会话任务", "Tasks in this session")}</h2>
          {history.map((h) => (
            <button
              className="button"
              key={h.id}
              onClick={() => void reopen(h.id)}
            >
              {h.task.slice(0, 50)} · {h.id.slice(0, 8)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
export function DeveloperDashboard() {
  const { t } = usePreferences(),
    { token } = usePlatformSession(),
    [days, setDays] = useState("30"),
    [data, setData] = useState<{
      items: {
        service_id: string;
        name: string;
        day: string;
        requests: number;
        completed: number;
        failed: number;
        average_latency_ms: string | null;
      }[];
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    setError("");
    if (!token) return;
    const c = new AbortController();
    call<typeof data>("marketplace/developer/analytics?days=" + days, {
      token,
      signal: c.signal,
    })
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [token, days]);
  const total = data?.items.reduce(
    (a, r) => ({
      requests: a.requests + r.requests,
      completed: a.completed + r.completed,
      failed: a.failed + r.failed,
    }),
    { requests: 0, completed: 0, failed: 0 },
  );
  return (
    <section className="platform-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">DEVELOPER</p>
          <h1>{t("开发者工作台", "Developer Dashboard")}</h1>
        </div>
        <Link to="/developer/agents/services/new">
          {t("发布服务", "Publish service")}
        </Link>
      </header>
      <WalletSession />
      {error && <p role="alert">{error}</p>}
      <label>
        {t("统计区间", "Period")}
        <select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">7 {t("天", "days")}</option>
          <option value="30">30 {t("天", "days")}</option>
          <option value="90">90 {t("天", "days")}</option>
        </select>
      </label>
      {total && (
        <div className="platform-grid">
          {[
            [t("请求", "Requests"), total.requests],
            [t("完成", "Completed"), total.completed],
            [t("失败", "Failed"), total.failed],
          ].map(([label, value]) => (
            <div className="panel" key={label}>
              <h2>{label}</h2>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="panel">
        <h2>{t("服务记录", "Service records")}</h2>
        <p>
          {t(
            "只统计自己发布服务的真实任务。已验证收入单独按结算凭证统计；填写价格不会计入收入。",
            "Only actual tasks for your published services are counted. Verified revenue requires settlement evidence; declared prices never count as revenue.",
          )}
        </p>
        {data?.items.map((r, i) => (
          <p key={i}>
            {r.day.slice(0, 10)} · {r.name} · {r.requests} / {r.completed} /{" "}
            {r.failed} · {r.average_latency_ms ?? "—"} ms{" "}
            <Link to={"/developer/agents/services/" + r.service_id}>
              {t("配置", "Configure")}
            </Link>
          </p>
        ))}
        {data && !data.items.length && (
          <p>{t("尚无服务调用记录。", "No service requests yet.")}</p>
        )}
      </div>
      <Link to="/my-agents">
        {t("管理身份与控制权验证", "Manage identity and control verification")}{" "}
        →
      </Link>
    </section>
  );
}
export function ServiceEditor() {
  const { id } = useParams(),
    [params] = useSearchParams(),
    { t } = usePreferences(),
    { token } = usePlatformSession();
  const [agentId, setAgentId] = useState(params.get("agentId") || ""),
    [agentRevision, setAgentRevision] = useState(1),
    [revision, setRevision] = useState(0),
    [serviceId] = useState(id && id !== "new" ? id : crypto.randomUUID()),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState("governance"),
    [protocol, setProtocol] = useState("mcp"),
    [endpoint, setEndpoint] = useState(""),
    [capability, setCapability] = useState(""),
    [schema, setSchema] = useState(
      '{"type":"object","properties":{},"additionalProperties":false}',
    ),
    [price, setPrice] = useState<Service["price"]>(null),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [choices, setChoices] = useState<{ name: string; inputSchema?: unknown }[]>(
      [],
    );
  async function discover() {
    try {
      const a = await call<{
        profileRevision: number;
        interfaces: {
          protocol: string;
          url: string;
          checks: {
            evidence: {
              tools?: { name: string; inputSchema?: unknown }[];
              card?: { skills: { id: string; name: string }[] };
            };
          }[];
        }[];
      }>("platform/agents/" + agentId + "/discovery", { token });
      setAgentRevision(a.profileRevision);
      const i = a.interfaces.find(
          (i) => i.protocol === protocol && i.url === endpoint,
        ),
        checked = i?.checks?.[0];
      setChoices(
        checked?.evidence?.tools ||
          checked?.evidence?.card?.skills.map((s) => ({ name: s.id })) ||
          [],
      );
      if (!checked)
        throw Error(
          t(
            "请先在身份页面完成端点控制与服务发现。",
            "Complete endpoint control and discovery on the identity page first.",
          ),
        );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!id || id === "new") return;
    call<Service & { agentRevision: number; published: boolean }>(
      "marketplace/services/" + id,
      { token },
    )
      .then((s) => {
        setAgentId(s.agentId || "");
        setAgentRevision(s.agentRevision);
        setRevision(s.revision);
        setName(s.name);
        setDescription(s.description);
        setCategory(s.category);
        setProtocol(s.protocol);
        setEndpoint(s.discoveryUrl || s.endpointUrl || "");
        setCapability(s.capability);
        setSchema(JSON.stringify(s.inputSchema, null, 2));
        setPrice(s.price);
        setPaused(s.availability === "paused");
      })
      .catch((e) => setError(e.message));
  }, [id, token]);
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(schema);
  } catch {}
  return (
    <section className="platform-page">
      <h1>{t("发布只读研究服务", "Publish a read-only research service")}</h1>
      <p>
        {t(
          "先核验身份、域名控制及服务发现。公开声明与执行批准分别记录；外部能力须经过平台审核后才能调用。",
          "Verify identity, domain control and service discovery first. Publication and execution approval are separate; external capabilities need platform review before invocation.",
        )}
      </p>
      <WalletSession />
      {error && <p role="alert">{error}</p>}
      <div className="panel form">
        <label>
          Agent ID
          <input value={agentId} onChange={(e) => setAgentId(e.target.value)} />
        </label>
        <label>
          {t("名称", "Name")}
          <input
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("描述", "Description")}
          <textarea
            value={description}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label>
          {t("分类", "Category")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.entries(categoryNames).map(([k, v]) => (
              <option key={k} value={k}>
                {t(...v)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("协议", "Protocol")}
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
          >
            <option value="mcp">MCP</option>
            <option value="a2a">A2A</option>
          </select>
        </label>
        <label>
          {t("已声明端点", "Declared endpoint")}
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </label>
        <button className="button" onClick={() => void discover()}>
          {t("读取已核验能力", "Read checked capabilities")}
        </button>
        <label>
          {t("能力", "Capability")}
          <select
            value={capability}
            onChange={(e) => {
              setCapability(e.target.value);
              const s = choices.find(
                (c) => c.name === e.target.value,
              )?.inputSchema;
              if (s) setSchema(JSON.stringify(s, null, 2));
            }}
          >
            <option value="">{t("选择能力", "Choose capability")}</option>
            {choices.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>
          {t("能力输入 Schema", "Capability input schema")}
          <textarea
            value={schema}
            maxLength={12000}
            onChange={(e) => setSchema(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
          />
          {t("暂停执行", "Pause execution")}
        </label>
        <p>
          {t(
            "首版发布免费研究服务。收费任务待真实结算验收后单独开放。",
            "This release publishes free research services. Paid execution opens separately after real settlement acceptance.",
          )}
        </p>
        {revision > 0 && (
          <SignedAction
            action="market.service.pause"
            payload={{ id: serviceId, revision }}
            onDone={(r) => {
              setRevision(Number(r.revision));
              setPaused(true);
            }}
          >
            {t("立即签名暂停服务", "Sign to pause service immediately")}
          </SignedAction>
        )}
        <SignedAction
          action="market.service.upsert"
          onDone={(r) => setRevision(Number(r.revision))}
          payload={{
            id: serviceId,
            agentId,
            agentRevision,
            revision,
            name,
            description,
            category,
            protocol,
            endpointUrl: endpoint,
            capability,
            inputSchema: parsed,
            published: true,
            paused,
            price,
          }}
          disabled={!parsed || !name || !capability || !agentId || !endpoint}
        >
          {t("审核服务内容并签名发布", "Review service and sign publication")}
        </SignedAction>
      </div>
    </section>
  );
}
