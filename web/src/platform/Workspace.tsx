import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import {
  platformRequest,
  SignedAction,
  usePlatformSession,
  WalletSession,
  type JsonRecord,
} from "./client";
import type { Agent } from "./Agents";
import "./platform.css";
type SavedReport = {
  id: string;
  title: string;
  space_id: string;
  summary: string;
  public: boolean;
  created_at: string;
  evidence: JsonRecord[];
};
type PreparedAction = {
  id: string;
  space_id: string;
  kind: string;
  content: JsonRecord;
  content_hash: string;
  revision: number;
  state: string;
  created_at: string;
  result?: JsonRecord;
};
type Organization = { space_id: string; name: string; revision: number };
type WorkspaceData = {
  agents: Agent[];
  reports: SavedReport[];
  actions: PreparedAction[];
  organizations: Organization[];
};
export default function Workspace() {
  const { t } = usePreferences();
  const { token } = usePlatformSession();
  const [data, setData] = useState<WorkspaceData | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setData(null);
    if (token)
      platformRequest<WorkspaceData>("workspace", undefined, token)
        .then((d) => {
          if (live) setData(d);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [token]);
  return (
    <section className="platform-page">
      <h1>{t("我的工作区", "My workspace")}</h1>
      <p>
        {t(
          "仅在明确签名保存后保留报告。聊天不会自动上传或永久保存。",
          "Reports are retained only after explicit signed consent. Chats are not automatically uploaded or persisted.",
        )}
      </p>
      <WalletSession />
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="platform-links">
            <Link to="/my-agents">{t("我的 Agents", "My Agents")}</Link>
            <Link to="/reports/new">
              {t("保存治理报告", "Save governance report")}
            </Link>
            <Link to="/actions/new">
              {t("准备组织操作", "Prepare organization action")}
            </Link>
            <Link to="/organizations">
              {t("组织设置", "Organization settings")}
            </Link>
          </div>
          <h2>{t("报告", "Reports")}</h2>
          {data.reports.map((r) => (
            <article className="panel" key={r.id}>
              <Link to={"/reports/" + r.id}>{r.title}</Link>
              <p>
                {r.space_id} ·{" "}
                {r.public ? t("公开", "Public") : t("私有", "Private")} ·{" "}
                {r.created_at}
              </p>
            </article>
          ))}
          {!data.reports.length && (
            <p>{t("尚未保存报告。", "No saved reports.")}</p>
          )}
          <h2>{t("我的 Agent", "My agents")}</h2>
          {data.agents.map((a) => (
            <p key={a.id}>
              <Link to={"/agents/" + a.id}>{a.name}</Link>
            </p>
          ))}
          <h2>{t("待审与已完成操作", "Pending and completed actions")}</h2>
          {data.actions.map((a) => (
            <p key={a.id}>
              <Link to={"/actions/" + a.id}>
                {a.kind} · {a.space_id}
              </Link>{" "}
              · {a.state}
            </p>
          ))}
          <h2>{t("组织工作区", "Organization workspaces")}</h2>
          {data.organizations.map((o) => (
            <p key={o.space_id}>
              <Link to={"/organizations?spaceId=" + o.space_id}>{o.name}</Link>
            </p>
          ))}
        </>
      )}
    </section>
  );
}
export function ReportEditor() {
  const { t } = usePreferences();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const [space, setSpace] = useState(q.get("spaceId") || ""),
    [title, setTitle] = useState(""),
    [summary, setSummary] = useState("");
  const [id] = useState(() => crypto.randomUUID());
  const payload = {
    id,
    spaceId: space,
    title,
    summary,
    public: false,
    tools: [{ name: "analyzeParticipation", input: { spaceId: space } }],
  };
  return (
    <section className="platform-page panel form">
      <h1>{t("保存治理报告", "Save governance report")}</h1>
      <p>
        {t(
          "你的摘要是个人解读。服务器会重新获取该 Space 的统计与来源作为证据；报告默认私有。",
          "Your summary is personal interpretation. The server retrieves current statistics and sources as evidence; reports default to private.",
        )}
      </p>
      <label>
        Snapshot Space ID
        <input
          value={space}
          maxLength={100}
          onChange={(e) => setSpace(e.target.value)}
        />
      </label>
      <label>
        {t("标题", "Title")}
        <input
          value={title}
          maxLength={160}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        {t("个人摘要", "Your summary")}
        <textarea
          value={summary}
          maxLength={12000}
          rows={9}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <SignedAction
        action="report.save"
        payload={payload}
        disabled={!space || !title}
        onDone={(r) => nav("/reports/" + r.id)}
      >
        {t("审核并签名保存私有报告", "Review and sign private report")}
      </SignedAction>
    </section>
  );
}
export function ReportPage() {
  const { id } = useParams();
  const { t } = usePreferences();
  const { token } = usePlatformSession();
  const [data, setData] = useState<SavedReport | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    platformRequest<SavedReport>("reports/" + id, undefined, token)
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, token]);
  return (
    <section className="platform-page">
      <WalletSession />
      {error && (
        <p role="alert">
          {error} ·{" "}
          {t(
            "私有报告需要原保存钱包登录。",
            "Private reports require the saving wallet to sign in.",
          )}
        </p>
      )}
      {data && (
        <article className="panel">
          <h1>{data.title}</h1>
          <p>
            <Link to={"/spaces/" + data.space_id}>{data.space_id}</Link> ·{" "}
            {data.created_at} ·{" "}
            {data.public ? t("公开", "Public") : t("私有", "Private")}
          </p>
          <h2>{t("作者解读", "Author interpretation")}</h2>
          <p className="preserve-lines">{data.summary}</p>
          <h2>{t("服务器获取的结构化证据", "Server-retrieved evidence")}</h2>
          {data.evidence.map((e, i) => (
            <details key={i} open>
              <summary>
                {String(e.tool || "Evidence")} [{i + 1}]
              </summary>
              <pre>{JSON.stringify(e, null, 2)}</pre>
            </details>
          ))}
          <Link
            to={
              "/actions/new?spaceId=" + data.space_id + "&reportId=" + data.id
            }
          >
            {t("请求管理员审核发布", "Request administrator review to publish")}
          </Link>
        </article>
      )}
    </section>
  );
}
const kinds = [
  ["announcement.publish", "组织公告", "Organization announcement"],
  ["proposal.draft.save", "提案草稿", "Proposal draft"],
  ["report.publish", "发布报告", "Publish report"],
  ["badge.issue", "签发组织徽章", "Issue organization badge"],
  ["badge.revoke", "撤销徽章", "Revoke badge"],
  ["role.set", "设置组织角色", "Set organization role"],
];
export function ActionEditor() {
  const { t } = usePreferences();
  const [q] = useSearchParams();
  const nav = useNavigate();
  const [id] = useState(() => crypto.randomUUID());
  const [space, setSpace] = useState(q.get("spaceId") || ""),
    [kind, setKind] = useState(
      q.get("reportId") ? "report.publish" : "announcement.publish",
    ),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [choices, setChoices] = useState("For\nAgainst"),
    [recipient, setRecipient] = useState(""),
    [role, setRole] = useState(""),
    [badgeType, setBadgeType] = useState("Contributor"),
    [recordId, setRecordId] = useState(q.get("reportId") || "");
  const content: JsonRecord =
    kind === "report.publish"
      ? { reportId: recordId }
      : kind === "badge.revoke"
        ? { badgeId: recordId }
        : kind === "badge.issue"
          ? { recipient, type: badgeType, evidence: body, expiresAt: null }
          : kind === "role.set"
            ? { recipient, role }
            : kind === "proposal.draft.save"
              ? {
                  title,
                  body,
                  choices: choices
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
                }
              : { title, body };
  return (
    <section className="platform-page panel form">
      <h1>{t("准备组织操作", "Prepare organization action")}</h1>
      <p>
        {t(
          "需要当前 Snapshot 管理员的钱包。准备、审核批准与执行分别签名；提案仅保存草稿，不会提交 Snapshot 投票。",
          "Requires a current Snapshot administrator wallet. Preparation, approval and execution each require a separate signature. Proposals are saved as drafts; no Snapshot vote is submitted.",
        )}
      </p>
      <label>
        Space ID
        <input value={space} onChange={(e) => setSpace(e.target.value)} />
      </label>
      <label>
        {t("操作", "Action")}
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k[0]} value={k[0]}>
              {t(k[1], k[2])}
            </option>
          ))}
        </select>
      </label>
      {["report.publish", "badge.revoke"].includes(kind) ? (
        <label>
          {t("记录 ID", "Record ID")}
          <input
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
          />
        </label>
      ) : (
        <>
          {["badge.issue", "role.set"].includes(kind) ? (
            <label>
              {t("接收钱包", "Recipient wallet")}
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </label>
          ) : (
            <label>
              {t("标题", "Title")}
              <input
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          )}
          {kind === "role.set" ? (
            <label>
              {t("角色", "Role")}
              <input
                value={role}
                maxLength={60}
                onChange={(e) => setRole(e.target.value)}
              />
            </label>
          ) : (
            <label>
              {kind === "badge.issue"
                ? t("公开依据", "Public evidence")
                : t("正文", "Body")}
              <textarea
                value={body}
                maxLength={kind === "badge.issue" ? 1000 : 12000}
                rows={7}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
          )}
          {kind === "badge.issue" && (
            <label>
              {t("徽章类型", "Badge type")}
              <select
                value={badgeType}
                onChange={(e) => setBadgeType(e.target.value)}
              >
                {[
                  "Contributor",
                  "Organization Member",
                  "Event Participant",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          {kind === "proposal.draft.save" && (
            <label>
              {t("选项，每行一项", "Choices, one per line")}
              <textarea
                value={choices}
                onChange={(e) => setChoices(e.target.value)}
              />
            </label>
          )}
        </>
      )}
      <SignedAction
        action="action.prepare"
        payload={{ id, spaceId: space, kind, content }}
        disabled={!space}
        onDone={(r) => nav("/actions/" + r.id)}
      >
        {t("审核并签名准备", "Review and sign preparation")}
      </SignedAction>
    </section>
  );
}
export function ActionPage() {
  const { id } = useParams();
  const { t } = usePreferences();
  const { token } = usePlatformSession();
  const [data, setData] = useState<PreparedAction | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [audit, setAudit] = useState<JsonRecord[]>([]);
  useEffect(() => {
    let live = true;
    if (!token) return;
    Promise.all([
      platformRequest<PreparedAction>("actions/" + id, undefined, token),
      platformRequest<{ items: JsonRecord[] }>("audit/" + id, undefined, token),
    ])
      .then(([d, a]) => {
        if (live) {
          setData(d);
          setAudit(a.items);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, token, revision]);
  return (
    <section className="platform-page">
      <h1>{t("审核组织操作", "Review organization action")}</h1>
      <WalletSession />
      {error && <p role="alert">{error}</p>}
      {data && (
        <div className="panel">
          <h2>{data.kind}</h2>
          <p>
            {data.space_id} · {data.state} · {t("版本", "Revision")}{" "}
            {data.revision}
          </p>
          <pre>{JSON.stringify(data.content, null, 2)}</pre>
          <p className="break-address">
            {t("内容哈希", "Content hash")}: {data.content_hash}
          </p>
          {["prepared", "approved"].includes(data.state) && (
            <div className="platform-links">
              <SignedAction
                action={
                  data.state === "prepared"
                    ? "action.approve"
                    : "action.execute"
                }
                payload={{
                  id: data.id,
                  revision: data.revision,
                  contentHash: data.content_hash,
                }}
                onDone={() => setRevision((v) => v + 1)}
              >
                {data.state === "prepared"
                  ? t("签名批准上述内容", "Sign approval for this content")
                  : t(
                      "签名执行已批准操作",
                      "Sign execution of approved action",
                    )}
              </SignedAction>
              <SignedAction
                action="action.cancel"
                payload={{
                  id: data.id,
                  revision: data.revision,
                  contentHash: data.content_hash,
                }}
                onDone={() => setRevision((v) => v + 1)}
              >
                {t("签名取消", "Sign cancellation")}
              </SignedAction>
            </div>
          )}
          {data.result && <pre>{JSON.stringify(data.result, null, 2)}</pre>}
          <h2>{t("审计记录", "Audit trail")}</h2>
          {audit.map((a) => (
            <p key={String(a.id)}>
              {String(a.action)} · {String(a.created_at)} · {String(a.outcome)}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
export function OrganizationPage() {
  const { t } = usePreferences();
  const [q] = useSearchParams();
  const [space, setSpace] = useState(q.get("spaceId") || ""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [refresh, setRefresh] = useState(false),
    [revision, setRevision] = useState(0),
    [error, setError] = useState("");
  const load = async () => {
    try {
      const d = await platformRequest<{
        organization: {
          name: string;
          revision: number;
          config: { description: string; refreshEnabled: boolean };
        } | null;
      }>("organizations/" + space);
      setRevision(d.organization?.revision || 0);
      if (d.organization) {
        setName(d.organization.name);
        setDescription(d.organization.config.description);
        setRefresh(d.organization.config.refreshEnabled);
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="platform-page panel form">
      <h1>{t("组织工作区设置", "Organization workspace settings")}</h1>
      <p>
        {t(
          "每次写入重新验证当前 Snapshot 管理员。组织徽章是签发者的声明，不等同于投票参与记录。",
          "Current Snapshot administrator access is checked for every write. Organization badges are issuer attestations, separate from observed voting activity.",
        )}
      </p>
      <label>
        Space ID
        <input
          value={space}
          onChange={(e) => {
            setSpace(e.target.value);
            setRevision(0);
          }}
        />
      </label>
      <button onClick={() => void load()}>
        {t("读取当前设置", "Load current settings")}
      </button>
      {error && <p role="alert">{error}</p>}
      <label>
        {t("名称", "Name")}
        <input
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        {t("简介", "Description")}
        <textarea
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={refresh}
          onChange={(e) => setRefresh(e.target.checked)}
        />
        {t(
          "允许定时刷新公共治理索引",
          "Allow scheduled public governance refresh",
        )}
      </label>
      <SignedAction
        action="organization.configure"
        payload={{
          spaceId: space,
          name,
          description,
          refreshEnabled: refresh,
          revision,
        }}
        disabled={!space || !name}
        onDone={() => void load()}
      >
        {t("审核并签名保存设置", "Review and sign settings")}
      </SignedAction>
      <Link to={"/analytics?spaceId=" + space}>
        {t("治理统计", "Governance analytics")} →
      </Link>
    </section>
  );
}
