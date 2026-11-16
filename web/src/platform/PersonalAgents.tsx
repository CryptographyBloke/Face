import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useWallet } from "../app/WalletProvider";
import {
  platformRequest,
  SignedAction,
  WalletSession,
  usePlatformSession,
  type JsonRecord,
} from "./client";
import type { Agent } from "./Agents";
import "./platform.css";
type PersonalMetadata = Agent["metadata"] & {
  agentController?: string;
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
  registration?: {
    chainId: 1 | 84532;
    registryAddress: string;
    tokenId: string;
  } | null;
  localOnly?: boolean;
};
export type PersonalLink = {
  id: string;
  agent_id: string;
  owner: string;
  controller: string;
  revision: number;
  agent_revision: number;
  profile_revision?: number;
  name?: string;
  metadata?: PersonalMetadata;
  origins: string[];
  status: string;
  effectiveStatus: string;
  availability: string;
  verification: {
    ownerSignature: boolean;
    controllerSignature: boolean;
    activeAssociation: boolean;
    endpointControl: boolean;
  };
  endpoint_evidence: { url: string; checkedAt: string }[];
};
export default function MyAgents() {
  const { t } = usePreferences();
  const { token } = usePlatformSession();
  const [items, setItems] = useState<PersonalLink[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    setLoaded(false);
    setItems([]);
    setError("");
    if (token)
      platformRequest<{ items: PersonalLink[] }>("my-agents", undefined, token)
        .then((d) => {
          if (live) {
            setItems(d.items);
            setLoaded(true);
            setError("");
          }
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
      <header className="page-heading">
        <div>
          <p className="eyebrow">PERSONAL AGENTS</p>
          <h1>{t("我的 Agents", "My Agents")}</h1>
          <p>
            {t(
              "关联多个 Agent，分别核验资料钱包、运行控制者和服务域名。",
              "Connect multiple agents and check the profile wallet, runtime controller and service domain separately.",
            )}
          </p>
        </div>
        <Link to="/my-agents/connect" className="button">
          {t("连接 Agent", "Connect Agent")}
        </Link>
      </header>
      <Link to="/spending">{t("Agent 支出限额", "Agent spending limits")} →</Link>
      <Link to="/payments">
        {t("支付与结算记录", "Payments and receipts")} →
      </Link>
      <WalletSession />
      {error && <p role="alert">{error}</p>}
      {loaded && !items.length && (
        <div className="panel">
          <h2>{t("尚未关联 Agent", "No agents connected")}</h2>
          <p>
            {t(
              "创建本地 Agent 资料，或关联已有公开资料。",
              "Create a local Agent profile or link an existing published profile.",
            )}
          </p>
        </div>
      )}
      {items.map((l) => (
        <article className="panel" key={l.id}>
          <h2>
            <Link to={"/agents/" + l.agent_id}>{l.name || l.agent_id}</Link>
          </h2>
          <p>
            {t("关联状态", "Association")}: {l.effectiveStatus}
          </p>
          <p>
            {l.origins.length
              ? t("服务可用性待检测", "Service availability unchecked")
              : t("本地 Agent · 无公开服务", "Local Agent · no public service")}
          </p>
          <p>
            {t("所有者", "Owner")}:{" "}
            <span className="break-address">{l.owner}</span>
          </p>
          <p>
            {t("控制者", "Controller")}:{" "}
            <span className="break-address">{l.controller}</span>
          </p>
          <Link to={"/my-agents/links/" + l.id}>
            {t("核验证据与管理关联", "Check evidence and manage association")} →
          </Link>
        </article>
      ))}
    </section>
  );
}
export function ConnectAgent() {
  const { t } = usePreferences();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const [id, setId] = useState(q.get("agentId") || ""),
    [agent, setAgent] = useState<Agent | null>(null),
    [error, setError] = useState("");
  const [linkId] = useState(() => crypto.randomUUID());
  const { token } = usePlatformSession();
  const load = async () => {
    setAgent(null);
    setError("");
    try {
      setAgent(await platformRequest<Agent>("agents/" + id, undefined, token));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const meta = agent?.metadata as PersonalMetadata | undefined;
  return (
    <section className="platform-page panel form">
      <h1>{t("连接我的 Agent", "Connect my Agent")}</h1>
      <p>
        {t(
          "所有者先签名；独立控制者随后确认。远程服务还需要域名控制证明，完成后才显示有效关联。",
          "The owner signs first; a separate controller then confirms. Remote services also require domain control evidence before the association becomes active.",
        )}
      </p>
      <Link to="/agents/new?connect=1">
        {t(
          "创建新的本地或远程 Agent 资料",
          "Create a new local or remote Agent profile",
        )}{" "}
        →
      </Link>
      <label>
        {t("已有 Wallet Face Agent ID", "Existing Wallet Face Agent ID")}
        <input
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setAgent(null);
          }}
        />
      </label>
      <button onClick={() => void load()}>
        {t("读取 Agent", "Load Agent")}
      </button>
      {error && <p role="alert">{error}</p>}
      {agent && (
        <>
          <h2>{agent.name}</h2>
          <p>{agent.metadata.description}</p>
          <p>
            {t("资料钱包", "Profile wallet")}: {agent.controller}
          </p>
          <p>
            {t("声明的运行控制者", "Declared runtime controller")}:{" "}
            {meta?.agentController || agent.controller}
          </p>
          <p>
            {agent.metadata.endpoints.map((e) => e.url).join(" · ") ||
              t(
                "本地资料，无公开服务地址",
                "Local profile; no public service URL",
              )}
          </p>
          <SignedAction
            action="identity.link"
            payload={{
              id: linkId,
              agentId: agent.id,
              agentRevision: agent.revision,
              controller: meta?.agentController || agent.controller,
            }}
            onDone={(r) => nav("/my-agents/links/" + r.id)}
          >
            {t("审核并签名关联", "Review and sign association")}
          </SignedAction>
        </>
      )}
    </section>
  );
}
export function AgentLinkPage() {
  const { id } = useParams();
  const { t } = usePreferences();
  const { token } = usePlatformSession();
  const { wallet } = useWallet();
  const [data, setData] = useState<PersonalLink | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    if (!token) return;
    platformRequest<PersonalLink>("links/" + id, undefined, token)
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
  }, [id, token, refresh]);
  const own = data?.owner === wallet?.address.toLowerCase(),
    controller = data?.controller === wallet?.address.toLowerCase();
  return (
    <section className="platform-page">
      <h1>{t("Agent 关联与证据", "Agent association and evidence")}</h1>
      <WalletSession />
      {error && <p role="alert">{error}</p>}
      {data && (
        <article className="panel">
          <h2>
            <Link to={"/agents/" + data.agent_id}>
              {data.name || data.agent_id}
            </Link>
          </h2>
          <p>
            {t("状态", "Status")}: {data.effectiveStatus}
          </p>
          <p className="break-address">
            {t("所有者", "Owner")}: {data.owner}
          </p>
          <p className="break-address">
            {t("运行控制者", "Runtime controller")}: {data.controller}
          </p>
          <p>
            {t("资料版本 / 关联版本", "Profile / association revision")}:{" "}
            {data.profile_revision} / {data.revision}
          </p>
          <p>
            {t(
              "钱包签名证明授权时的控制权；服务可靠性与执行结果单独记录。",
              "Wallet signatures prove control at authorization time; service reliability and delivery outcomes are separate records.",
            )}
          </p>
          {data.effectiveStatus === "stale_profile" && own && (
            <SignedAction
              action="identity.link.refresh"
              payload={{
                id: data.id,
                revision: data.revision,
                agentRevision: data.profile_revision,
              }}
              onDone={() => setRefresh((v) => v + 1)}
            >
              {t(
                "审核新版资料并刷新关联",
                "Review changed profile and refresh association",
              )}
            </SignedAction>
          )}
          {data.status === "pending" &&
            data.effectiveStatus !== "stale_profile" &&
            controller && (
              <SignedAction
                action="identity.link.confirm"
                payload={{ id: data.id, revision: data.revision }}
                onDone={() => setRefresh((v) => v + 1)}
              >
                {t(
                  "控制者签名确认关联",
                  "Controller: sign association confirmation",
                )}
              </SignedAction>
            )}
          {own &&
            ["pending", "active"].includes(data.effectiveStatus) &&
            data.origins.map((origin) => (
              <div key={origin}>
                <h3>{origin}</h3>
                <p>
                  {data.endpoint_evidence.find((e) => e.url === origin)
                    ?.checkedAt ||
                    t(
                      "需要发布一次性域名证明",
                      "A fresh domain-control proof is required",
                    )}
                </p>
                <SignedAction
                  action="identity.verify.endpoint"
                  payload={{
                    id: data.id,
                    revision: data.revision,
                    endpointUrl: origin,
                  }}
                  onDone={() => setRefresh((v) => v + 1)}
                >
                  {t(
                    "发布证明后签名核验域名",
                    "Publish proof and sign domain check",
                  )}
                </SignedAction>
              </div>
            ))}
          {own && !["revoked", "disconnected"].includes(data.status) && (
            <div className="platform-links">
              <SignedAction
                action="identity.link.disconnect"
                payload={{ id: data.id, revision: data.revision }}
                onDone={() => setRefresh((v) => v + 1)}
              >
                {t("签名断开关联", "Sign disconnection")}
              </SignedAction>
              <SignedAction
                action="identity.link.revoke"
                payload={{ id: data.id, revision: data.revision }}
                onDone={() => setRefresh((v) => v + 1)}
              >
                {t("签名撤销关联证明", "Sign association revocation")}
              </SignedAction>
            </div>
          )}
          <details>
            <summary>{t("核验状态", "Verification status")}</summary>
            <pre>{JSON.stringify(data.verification, null, 2)}</pre>
          </details>
        </article>
      )}
    </section>
  );
}
type IdentityData = {
  profileWallet: string;
  declaredController: string;
  localOnly: boolean;
  links: PersonalLink[];
  paymentWallets: {
    wallet: string;
    network: string;
    revision: number;
    controlVerified: boolean;
    revoked: boolean;
  }[];
  registration: { current: boolean; evidence: JsonRecord } | null;
};
export function AgentIdentityEvidence({ agent }: { agent: Agent }) {
  const { t } = usePreferences();
  const { wallet } = useWallet();
  const [data, setData] = useState<IdentityData | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const { token } = usePlatformSession();
  const metadata = agent.metadata as PersonalMetadata;
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    platformRequest<IdentityData>(
      "agents/" + agent.id + "/identity",
      undefined,
      token,
    )
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
  }, [agent.id, token, refresh]);
  return (
    <div className="personal-agent-evidence">
      <h2>{t("个人 Agent 身份证据", "Personal Agent identity evidence")}</h2>
      {error && <p role="status">{error}</p>}
      {data && (
        <>
          <p>
            {t("资料管理钱包", "Profile wallet")}:{" "}
            <span className="break-address">{data.profileWallet}</span>
          </p>
          <p>
            {t("运行控制者", "Runtime controller")}:{" "}
            <span className="break-address">{data.declaredController}</span>
          </p>
          <p>
            {data.localOnly
              ? t(
                  "本地 Agent · 不提供公开网络服务",
                  "Local Agent · not advertised as publicly reachable",
                )
              : t(
                  "远程 Agent · 服务可用性尚未核验",
                  "Remote Agent · service availability unchecked",
                )}
          </p>
          {data.links.map((l) => (
            <p key={l.id}>
              <Link to={"/u/" + l.owner}>{l.owner.slice(0, 8)}…</Link> ·{" "}
              {l.effectiveStatus} ·{" "}
              {l.verification.activeAssociation
                ? t("关联证据已核验", "Association evidence checked")
                : t("关联待确认或已失效", "Association pending or inactive")}
            </p>
          ))}
          <Link to={"/my-agents/connect?agentId=" + agent.id}>
            {t("关联到我的钱包", "Connect to my wallet")} →
          </Link>
        </>
      )}
      <h3>{t("服务与价格声明", "Declared services and pricing")}</h3>
      {(metadata.services || []).map((s) => (
        <div className="panel" key={s.id}>
          <strong>{s.name}</strong>
          <p>{s.description}</p>
          <a href={s.endpoint} rel="noreferrer" target="_blank">
            {s.endpoint}
          </a>
          {s.price ? (
            <>
              <p>
                {s.price.amount} {t("代币最小单位", "atomic token units")} ·{" "}
                {s.price.network}
              </p>
              <p className="break-address">
                {t("资产", "Asset")}: {s.price.asset}
              </p>
              <p className="break-address">
                {t("收款钱包", "Receiving wallet")}: {s.price.payTo}
              </p>
              <p>
                {data?.paymentWallets.find(
                  (p) =>
                    p.wallet === s.price?.payTo.toLowerCase() &&
                    p.network === s.price.network,
                )?.controlVerified
                  ? t(
                      "收款钱包控制权已核验",
                      "Receiving wallet control checked",
                    )
                  : t(
                      "收款钱包控制权未核验",
                      "Receiving wallet control unchecked",
                    )}
              </p>
              {wallet?.address.toLowerCase() ===
                s.price.payTo.toLowerCase() && (
                <SignedAction
                  action="identity.verify.wallet"
                  payload={{
                    agentId: agent.id,
                    agentRevision: agent.revision,
                    wallet: s.price.payTo,
                    network: s.price.network,
                  }}
                  onDone={() => setRefresh((v) => v + 1)}
                >
                  {t(
                    "收款钱包签名核验",
                    "Receiving wallet: sign control proof",
                  )}
                </SignedAction>
              )}
              <p>
                {t(
                  "此价格由服务方声明；外部支付与交付由对应服务处理。",
                  "Pricing is declared by the operator; external payment and delivery are handled by that service.",
                )}
              </p>
            </>
          ) : (
            <p>{t("免费服务声明", "Declared free service")}</p>
          )}
        </div>
      ))}
      {data?.paymentWallets
        .filter((w) => w.controlVerified)
        .map(
          (w) =>
            (wallet?.address.toLowerCase() === w.wallet ||
              wallet?.address.toLowerCase() === agent.controller) && (
              <SignedAction
                key={w.wallet + w.network}
                action="identity.wallet.revoke"
                payload={{
                  agentId: agent.id,
                  wallet: w.wallet,
                  network: w.network,
                  revision: w.revision,
                }}
                onDone={() => setRefresh((v) => v + 1)}
              >
                {t("撤销收款钱包证明", "Revoke receiving-wallet proof")}
              </SignedAction>
            ),
        )}
      <h3>ERC-8004</h3>
      {metadata.registration ? (
        <>
          <p className="break-address">
            {metadata.registration.chainId} ·{" "}
            {metadata.registration.registryAddress} ·{" "}
            {metadata.registration.tokenId}
          </p>
          {data?.registration && (
            <pre>{JSON.stringify(data.registration, null, 2)}</pre>
          )}
          {wallet?.address.toLowerCase() === agent.controller && (
            <SignedAction
              action="identity.verify.registration"
              payload={{ agentId: agent.id, agentRevision: agent.revision }}
              onDone={() => setRefresh((v) => v + 1)}
            >
              {t(
                "核验注册所有者与收款地址",
                "Check registered owner and receiving wallet",
              )}
            </SignedAction>
          )}
        </>
      ) : (
        <p>{t("尚未声明注册记录", "No registration declared")}</p>
      )}
    </div>
  );
}
