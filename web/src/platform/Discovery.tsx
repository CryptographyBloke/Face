import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useWallet } from "../app/WalletProvider";
import { platformRequest, SignedAction, usePlatformSession } from "./client";
import type { Agent } from "./Agents";
type Manifest = {
  schemaVersion: string;
  retrievedAt: string;
  localOnly: boolean;
  interfaces: {
    protocol: "mcp" | "a2a" | "https";
    url: string;
    checks: {
      checked_at: string;
      currentProfile: boolean;
      evidence: Record<string, unknown>;
    }[];
  }[];
};
export default function Discovery({ agent }: { agent: Agent }) {
  const { t } = usePreferences(),
    { wallet } = useWallet(),
    { token } = usePlatformSession();
  const [data, setData] = useState<Manifest | null>(null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    platformRequest<Manifest>(
      "agents/" + agent.id + "/discovery",
      undefined,
      token,
    )
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [agent.id, token, version]);
  return (
    <section>
      <h2>{t("MCP / A2A 服务发现", "MCP / A2A service discovery")}</h2>
      <p>
        {t(
          "核对已声明端点的工具目录或 Agent Card，记录元数据来源与时间。外部工具和任务执行保持关闭。",
          "Read tool catalogs or Agent Cards at declared endpoints and record metadata sources and time. External tools and task execution remain disabled.",
        )}
      </p>
      {error && <p role="status">{error}</p>}
      {data && (
        <>
          <p>
            {data.schemaVersion} · {data.retrievedAt}
          </p>
          {data.localOnly && (
            <p>
              {t(
                "本地 Agent，无公开网络端点。",
                "Local Agent, no public network endpoint.",
              )}
            </p>
          )}
          {data.interfaces.map((e) => (
            <article className="panel" key={e.protocol + e.url}>
              <h3>{e.protocol.toUpperCase()}</h3>
              <p>
                <a href={e.url} target="_blank" rel="noreferrer">
                  {e.url}
                </a>
              </p>
              {!e.checks.length && (
                <p>
                  {t(
                    "端点声明已保存，元数据尚未读取。",
                    "Endpoint declaration saved; metadata has not been read.",
                  )}
                </p>
              )}
              {e.checks.map((c) => (
                <details key={c.checked_at}>
                  <summary>
                    {c.currentProfile
                      ? t(
                          "当前资料版本的元数据记录",
                          "Metadata for current profile revision",
                        )
                      : t(
                          "旧资料版本的记录",
                          "Record for an earlier profile revision",
                        )}{" "}
                    · {c.checked_at}
                  </summary>
                  <pre>{JSON.stringify(c.evidence, null, 2)}</pre>
                </details>
              ))}
              {e.protocol !== "https" &&
                wallet?.address.toLowerCase() === agent.controller && (
                  <SignedAction
                    action={"agent.probe." + e.protocol}
                    payload={{
                      id: agent.id,
                      revision: agent.revision,
                      endpointUrl: e.url,
                    }}
                    onDone={() => setVersion((v) => v + 1)}
                  >
                    {t(
                      "审核并签名读取服务元数据",
                      "Review and sign metadata discovery",
                    )}
                  </SignedAction>
                )}
            </article>
          ))}
          <Link to="/my-agents">
            {t(
              "管理关联与域名控制证明",
              "Manage association and domain-control evidence",
            )}{" "}
            →
          </Link>
        </>
      )}
    </section>
  );
}
