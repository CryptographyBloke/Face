import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useWallet } from "../app/WalletProvider";
import {
  platformRequest,
  SignedAction,
  usePlatformSession,
  type JsonRecord,
} from "./client";
import { Avatar } from "../ui/Avatar";
import "./platform.css";
type Metadata = {
  id: string;
  name: string;
  description: string;
  avatar: string | null;
  capabilities: string[];
  endpoints: { protocol: "https" | "mcp" | "a2a"; url: string }[];
  registry: { chainId: 1; registryAddress: string; tokenId: string } | null;
  organizations: { spaceId: string; description: string }[];
  published: boolean;
  endpointVerification?: { url: string; checkedAt: string }[];
  registryVerification?: JsonRecord | null;
};
export type Agent = {
  id: string;
  name: string;
  controller: string;
  revision: number;
  metadata: Metadata;
  controllerVerification: {
    verified: boolean;
    metadataSignatureVerified: boolean;
  };
  updated_at: string;
};
function useAgent(id?: string) {
  const { token } = usePlatformSession();
  const [agent, setAgent] = useState<Agent | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    let live = true;
    platformRequest<Agent>("agents/" + id, undefined, token)
      .then((a) => {
        if (live) setAgent(a);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, token]);
  return { agent, error };
}
export default function Agents() {
  const { t } = usePreferences();
  const [items, setItems] = useState<Agent[]>([]),
    [error, setError] = useState(""),
    [q, setQ] = useState("");
  useEffect(() => {
    const c = new AbortController();
    platformRequest<{ items: Agent[] }>("agents?q=" + encodeURIComponent(q))
      .then((d) => {
        if (!c.signal.aborted) {
          setItems(d.items);
          setError("");
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [q]);
  return (
    <section className="platform-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">HUMANS & AI AGENTS</p>
          <h1>{t("Agent 身份", "Agent identities")}</h1>
          <p>
            {t(
              "发现公开服务与控制权证据。能力和组织关系由发布者声明。",
              "Discover public services and control evidence. Capabilities and organization relationships are publisher declarations.",
            )}
          </p>
        </div>
        <Link className="button" to="/agents/new">
          {t("注册 Agent", "Register Agent")}
        </Link>
      </header>
      <label>
        {t("搜索名称或控制钱包", "Search name or controller wallet")}
        <input
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="platform-grid">
        {items.map((a) => (
          <Link to={"/agents/" + a.id} className="panel agent-card" key={a.id}>
            <Avatar
              uri={a.metadata.avatar}
              seed={a.id}
              name={a.name}
              size={52}
            />
            <h2>{a.name}</h2>
            <p>{a.metadata.description}</p>
            <small>
              {t("控制钱包签名", "Controller signature")}:{" "}
              {a.controllerVerification.metadataSignatureVerified
                ? t("已核验", "Checked")
                : t("未核验", "Unchecked")}
            </small>
          </Link>
        ))}
      </div>
      {!items.length && !error && (
        <div className="panel">
          <h2>{t("尚无公开 Agent", "No published agents yet")}</h2>
          <p>
            {t(
              "用控制钱包签名创建首个资料。",
              "Create a profile with a controller wallet signature.",
            )}
          </p>
        </div>
      )}
      <Link to="/workspaces">{t("打开我的工作区", "Open my workspace")} →</Link>
    </section>
  );
}
export function AgentProfile() {
  const { id } = useParams();
  const { agent: a, error } = useAgent(id);
  const { t } = usePreferences();
  const { wallet } = useWallet();
  if (error) return <p role="alert">{error}</p>;
  if (!a) return <p>{t("正在读取资料…", "Loading profile…")}</p>;
  const own = wallet?.address.toLowerCase() === a.controller;
  return (
    <section className="platform-page">
      <div className="panel">
        <Avatar uri={a.metadata.avatar} seed={a.id} name={a.name} size={70} />
        <h1>{a.name}</h1>
        <p>{a.metadata.description}</p>
        <p>
          {t("控制钱包", "Controller")}:{" "}
          <Link to={"/u/" + a.controller} className="break-address">
            {a.controller}
          </Link>
        </p>
        <p>
          {t("元数据签名核验", "Metadata signature checked")}:{" "}
          {a.controllerVerification.metadataSignatureVerified
            ? t("是", "Yes")
            : t("否", "No")}
        </p>
        <p>
          {t(
            "这验证授权时的钱包控制权，不代表真实身份、服务安全性或组织成员资格。",
            "This checks wallet control at authorization time, not real-world identity, service safety or organization membership.",
          )}
        </p>
        <p>{a.metadata.capabilities.join(" · ")}</p>
        {a.metadata.endpoints.map((e) => (
          <p key={e.url}>
            <a href={e.url} target="_blank" rel="noreferrer">
              {e.protocol.toUpperCase()} · {e.url}
            </a>{" "}
            ·{" "}
            {a.metadata.endpointVerification?.find(
              (v) => v.url === new URL(e.url).origin,
            )
              ? t(
                  "域名控制已核验（见时间）",
                  "Domain control checked (see timestamp)",
                )
              : t("发布者声明", "Self-declared")}
            {own && (
              <SignedAction
                action="agent.verify.endpoint"
                payload={{ id: a.id, revision: a.revision, endpointUrl: e.url }}
                onDone={() => window.location.reload()}
              >
                {t("验证服务域名", "Verify service domain")}
              </SignedAction>
            )}
          </p>
        ))}
        {a.metadata.endpointVerification?.map((v) => (
          <p key={v.url}>
            {v.url} · {v.checkedAt}
          </p>
        ))}
        <p>
          {t("注册表引用", "Registry reference")}:{" "}
          {a.metadata.registry
            ? JSON.stringify(a.metadata.registry)
            : t("未声明", "None declared")}
        </p>
        {a.metadata.registry && own && (
          <SignedAction
            action="agent.verify.registry"
            payload={{ id: a.id, revision: a.revision }}
            onDone={() => window.location.reload()}
          >
            {t("核验链上代币控制权", "Check on-chain token ownership")}
          </SignedAction>
        )}
        {a.metadata.registryVerification && (
          <pre>{JSON.stringify(a.metadata.registryVerification, null, 2)}</pre>
        )}
        <h2>{t("自声明的组织关系", "Self-declared organization claims")}</h2>
        {a.metadata.organizations.map((o) => (
          <p key={o.spaceId}>
            <Link to={"/spaces/" + o.spaceId}>{o.spaceId}</Link> ·{" "}
            {o.description}
          </p>
        ))}
        {own && (
          <Link to={"/agents/" + a.id + "/edit"}>
            {t("编辑资料", "Edit profile")}
          </Link>
        )}
        <details>
          <summary>{t("查看公开证据", "View public evidence")}</summary>
          <a
            href={"/v1/platform/agents/" + a.id}
            target="_blank"
            rel="noreferrer"
          >
            {t("完整资料与签名", "Full profile and signatures")}
          </a>
        </details>
      </div>
    </section>
  );
}
export function AgentEditor() {
  const { id } = useParams();
  const { agent, error } = useAgent(id);
  const { t } = usePreferences();
  const nav = useNavigate();
  const [value, setValue] = useState<Metadata>(() => ({
    id: crypto.randomUUID(),
    name: "",
    description: "",
    avatar: null,
    capabilities: [],
    endpoints: [],
    registry: null,
    organizations: [],
    published: true,
  }));
  const [endpoint, setEndpoint] = useState(""),
    [protocol, setProtocol] = useState<"https" | "mcp" | "a2a">("https");
  useEffect(() => {
    if (agent) setValue(agent.metadata);
  }, [agent]);
  const payload = {
    ...Object.fromEntries(
      [
        "id",
        "name",
        "description",
        "avatar",
        "capabilities",
        "endpoints",
        "registry",
        "organizations",
        "published",
      ].map((k) => [k, value[k as keyof Metadata]]),
    ),
    ...(id ? { revision: agent?.revision } : {}),
    endpoints: endpoint ? [{ protocol, url: endpoint }] : value.endpoints,
  };
  return (
    <section className="platform-page panel form">
      <h1>
        {id ? t("编辑 Agent", "Edit Agent") : t("注册 Agent", "Register Agent")}
      </h1>
      <p>
        {t(
          "只发布你愿意公开的资料。控制钱包签名会作为公开证据保存。",
          "Publish only information you want public. Your controller signature is retained as public evidence.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      <label>
        {t("名称", "Name")}
        <input
          value={value.name}
          maxLength={100}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
      </label>
      <label>
        {t("描述", "Description")}
        <textarea
          value={value.description}
          maxLength={2000}
          onChange={(e) => setValue({ ...value, description: e.target.value })}
        />
      </label>
      <label>
        {t("头像 HTTPS URL", "Avatar HTTPS URL")}
        <input
          type="url"
          value={value.avatar || ""}
          onChange={(e) =>
            setValue({ ...value, avatar: e.target.value || null })
          }
        />
      </label>
      <label>
        {t("能力（逗号分隔）", "Capabilities (comma separated)")}
        <input
          value={value.capabilities.join(",")}
          onChange={(e) =>
            setValue({
              ...value,
              capabilities: e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label>
        {t("服务协议", "Service protocol")}
        <select
          value={protocol}
          onChange={(e) => setProtocol(e.target.value as typeof protocol)}
        >
          <option value="https">HTTPS</option>
          <option value="mcp">MCP</option>
          <option value="a2a">A2A Agent Card URL</option>
        </select>
      </label>
      <label>
        {t("公开服务 URL", "Public service URL")}
        <input
          type="url"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="https://"
        />
      </label>
      <details>
        <summary>
          {t(
            "Ethereum 注册表引用（可选、自声明）",
            "Ethereum registry reference (optional, self-declared)",
          )}
        </summary>
        <label>
          {t("合约地址", "Contract address")}
          <input
            value={value.registry?.registryAddress || ""}
            onChange={(e) =>
              setValue({
                ...value,
                registry: {
                  chainId: 1,
                  registryAddress: e.target.value,
                  tokenId: value.registry?.tokenId || "0",
                },
              })
            }
          />
        </label>
        <label>
          Token ID
          <input
            value={value.registry?.tokenId || ""}
            onChange={(e) =>
              setValue({
                ...value,
                registry: {
                  chainId: 1,
                  registryAddress: value.registry?.registryAddress || "",
                  tokenId: e.target.value,
                },
              })
            }
          />
        </label>
        <button onClick={() => setValue({ ...value, registry: null })}>
          {t("移除引用", "Remove reference")}
        </button>
      </details>
      <SignedAction
        action={id ? "agent.update" : "agent.register"}
        payload={payload}
        disabled={!value.name || (!!id && !agent)}
        onDone={(r) => nav("/agents/" + r.id)}
      >
        {t("审核并签名保存", "Review and sign profile")}
      </SignedAction>
    </section>
  );
}
