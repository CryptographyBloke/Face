import Discovery from "./Discovery";
import { AgentIdentityEvidence } from "./PersonalAgents";
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
  agentController?: string;
  localOnly?: boolean;
  registration?: {
    chainId: 1 | 84532;
    registryAddress: string;
    tokenId: string;
  } | null;
  services?: {
    id: string;
    name: string;
    description: string;
    endpoint: string;
    price: {
      network: string;
      asset: string;
      amount: string;
      payTo: string;
    } | null;
  }[];
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
    setAgent(null);
    setError("");
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
          {t("资料管理钱包", "Profile wallet")}:{" "}
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
            "签名核验授权时的钱包控制权。服务和组织关系分别核验。",
            "The signature checks wallet control at authorization time. Service and organization claims are checked separately.",
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
        <AgentIdentityEvidence agent={a} />
        <Discovery agent={a} />
        <Link to={"/agents?" + new URLSearchParams({ q: a.name })}>
          {t("查看此 Agent 的服务", "Explore this Agent’s services")} →
        </Link>
        {own && (
          <Link to={"/developer/agents/services/new?agentId=" + a.id}>
            {t("发布研究服务", "Publish research service")} →
          </Link>
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
  const { wallet } = useWallet();
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
    localOnly: true,
    services: [],
  }));
  useEffect(() => {
    if (agent) setValue(agent.metadata);
  }, [agent]);
  const setEndpoint = (protocol: "https" | "mcp" | "a2a", url: string) =>
    setValue((v) => {
      const endpoints = [...v.endpoints],
        i = endpoints.findIndex((e) => e.protocol === protocol);
      if (i >= 0) {
        if (url) endpoints[i] = { protocol, url };
        else endpoints.splice(i, 1);
      } else if (url) endpoints.push({ protocol, url });
      return { ...v, endpoints };
    });
  const services = value.services || [];
  const setService = (
    index: number,
    patch: Partial<(typeof services)[number]>,
  ) =>
    setValue((v) => ({
      ...v,
      services: (v.services || []).map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    }));
  const keys = [
    "id",
    "name",
    "description",
    "avatar",
    "capabilities",
    "endpoints",
    "registry",
    "organizations",
    "published",
    "localOnly",
    "agentController",
    "services",
    "registration",
  ];
  const payload = {
    ...Object.fromEntries(
      keys
        .filter((k) => value[k as keyof Metadata] !== undefined)
        .map((k) => [k, value[k as keyof Metadata]]),
    ),
    ...(id ? { revision: agent?.revision } : {}),
  };
  return (
    <section className="platform-page panel form">
      <h1>
        {id
          ? t("编辑 Agent", "Edit Agent")
          : t("创建我的 Agent 资料", "Create my Agent profile")}
      </h1>
      <p>
        {t(
          "资料钱包管理此页面；运行控制者、域名控制与收款钱包分别签名核验。",
          "The profile wallet manages this page. Runtime controller, domain control and receiving-wallet control are checked separately.",
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
          value={value.avatar || ""}
          onChange={(e) =>
            setValue({ ...value, avatar: e.target.value || null })
          }
        />
      </label>
      <label>
        {t(
          "运行控制钱包（可与所有者不同）",
          "Runtime controller wallet (may differ from owner)",
        )}
        <input
          value={value.agentController || ""}
          placeholder={wallet?.address || "0x…"}
          onChange={(e) =>
            setValue({ ...value, agentController: e.target.value || undefined })
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
        <input
          type="checkbox"
          checked={value.localOnly ?? value.endpoints.length === 0}
          onChange={(e) =>
            setValue({
              ...value,
              localOnly: e.target.checked,
              ...(e.target.checked ? { endpoints: [], services: [] } : {}),
            })
          }
        />
        {t(
          "本地 Agent，不发布公开服务地址",
          "Local Agent; no public service endpoints",
        )}
      </label>
      {!value.localOnly && (
        <>
          <p>
            {t(
              "远程地址先作为声明保存；关联生效前需发布一次性域名控制证明。",
              "Remote URLs start as declarations; a fresh domain-control proof is required before the association becomes active.",
            )}
          </p>
          {(["https", "mcp", "a2a"] as const).map((protocol) => (
            <label key={protocol}>
              {protocol === "https"
                ? t("公开 Agent HTTPS 地址", "Public Agent HTTPS URL")
                : protocol === "mcp"
                  ? "MCP endpoint"
                  : "A2A Agent Card URL"}
              <input
                type="url"
                value={
                  value.endpoints.find((e) => e.protocol === protocol)?.url ||
                  ""
                }
                placeholder="https://"
                onChange={(e) => setEndpoint(protocol, e.target.value)}
              />
            </label>
          ))}
          <h2>{t("发布的服务", "Published services")}</h2>
          {services.map((s, i) => (
            <div className="panel form" key={s.id}>
              <label>
                {t("服务名称", "Service name")}
                <input
                  value={s.name}
                  maxLength={100}
                  onChange={(e) => setService(i, { name: e.target.value })}
                />
              </label>
              <label>
                {t("服务说明", "Service description")}
                <textarea
                  value={s.description}
                  maxLength={1000}
                  onChange={(e) =>
                    setService(i, { description: e.target.value })
                  }
                />
              </label>
              <label>
                {t("服务 HTTPS 地址", "Service HTTPS URL")}
                <input
                  type="url"
                  value={s.endpoint}
                  onChange={(e) => setService(i, { endpoint: e.target.value })}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!s.price}
                  onChange={(e) =>
                    setService(i, {
                      price: e.target.checked
                        ? {
                            network: "eip155:84532",
                            asset: "",
                            amount: "1000",
                            payTo: wallet?.address || "",
                          }
                        : null,
                    })
                  }
                />
                {t("声明 x402 服务价格", "Declare x402 service price")}
              </label>
              {s.price && (
                <>
                  <label>
                    {t("网络", "Network")}
                    <select
                      value={s.price.network}
                      onChange={(e) =>
                        setService(i, {
                          price: { ...s.price!, network: e.target.value },
                        })
                      }
                    >
                      <option value="eip155:84532">
                        Base Sepolia (testnet)
                      </option>
                      <option value="eip155:8453">
                        Base (external service)
                      </option>
                      <option value="eip155:1">
                        Ethereum (external service)
                      </option>
                    </select>
                  </label>
                  <label>
                    {t("资产合约地址", "Asset contract")}
                    <input
                      value={s.price.asset}
                      onChange={(e) =>
                        setService(i, {
                          price: { ...s.price!, asset: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("价格（代币最小单位）", "Price (atomic token units)")}
                    <input
                      value={s.price.amount}
                      onChange={(e) =>
                        setService(i, {
                          price: { ...s.price!, amount: e.target.value },
                        })
                      }
                    />
                  </label>
                  <small>
                    {t(
                      "USDC 示例：1000 最小单位 = 0.001 USDC。",
                      "USDC example: 1000 atomic units = 0.001 USDC.",
                    )}
                  </small>
                  <label>
                    {t("收款钱包", "Receiving wallet")}
                    <input
                      value={s.price.payTo}
                      onChange={(e) =>
                        setService(i, {
                          price: { ...s.price!, payTo: e.target.value },
                        })
                      }
                    />
                  </label>
                </>
              )}
              <button
                onClick={() =>
                  setValue({
                    ...value,
                    services: services.filter((_, n) => n !== i),
                  })
                }
              >
                {t("移除此服务", "Remove service")}
              </button>
            </div>
          ))}
          <button
            disabled={services.length >= 10}
            onClick={() =>
              setValue({
                ...value,
                services: [
                  ...services,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    description: "",
                    endpoint: "",
                    price: null,
                  },
                ],
              })
            }
          >
            {t("添加服务", "Add service")}
          </button>
        </>
      )}
      <details>
        <summary>
          {t("ERC-8004 注册记录（可选）", "ERC-8004 registration (optional)")}
        </summary>
        <label>
          {t("注册网络", "Registry network")}
          <select
            value={value.registration?.chainId || 84532}
            onChange={(e) =>
              setValue({
                ...value,
                registration: {
                  chainId: Number(e.target.value) as 1 | 84532,
                  registryAddress:
                    Number(e.target.value) === 1
                      ? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
                      : "0x8004A818BFB912233c491871b3d84c89A494BD9e",
                  tokenId: value.registration?.tokenId || "0",
                },
              })
            }
          >
            <option value={84532}>Base Sepolia</option>
            <option value={1}>Ethereum</option>
          </select>
        </label>
        <label>
          Registry address
          <input
            value={value.registration?.registryAddress || ""}
            onChange={(e) =>
              setValue({
                ...value,
                registration: {
                  chainId: value.registration?.chainId || 84532,
                  registryAddress: e.target.value,
                  tokenId: value.registration?.tokenId || "0",
                },
              })
            }
          />
        </label>
        <label>
          Agent ID / Token ID
          <input
            value={value.registration?.tokenId || ""}
            onChange={(e) =>
              setValue({
                ...value,
                registration: {
                  chainId: value.registration?.chainId || 84532,
                  registryAddress:
                    value.registration?.registryAddress ||
                    "0x8004A818BFB912233c491871b3d84c89A494BD9e",
                  tokenId: e.target.value,
                },
              })
            }
          />
        </label>
        <button onClick={() => setValue({ ...value, registration: null })}>
          {t("移除注册声明", "Remove registry declaration")}
        </button>
      </details>
      <label>
        <input
          type="checkbox"
          checked={value.published}
          onChange={(e) => setValue({ ...value, published: e.target.checked })}
        />
        {t("公开资料", "Publish profile")}
      </label>
      <p>
        {t(
          id
            ? "保存新版资料后，需要重新审核关联与收款钱包证明。"
            : "创建资料后，继续用所有者钱包签名关联。",
          id
            ? "Profile updates require renewed association and receiving-wallet proofs."
            : "After creating the profile, continue with an owner-signed association.",
        )}
      </p>
      <SignedAction
        action={id ? "agent.update" : "agent.register"}
        payload={payload}
        disabled={!value.name || (!!id && !agent)}
        onDone={(r) =>
          nav(id ? "/agents/" + r.id : "/my-agents/connect?agentId=" + r.id)
        }
      >
        {t("审核并签名保存", "Review and sign profile")}
      </SignedAction>
    </section>
  );
}
