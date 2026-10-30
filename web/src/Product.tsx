import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";
import { Identicon } from "../../packages/sdk/src/react";
import "./product.css";
const AvatarPublisher = lazy(() => import("./App"));
const ProfilePage = lazy(() => import("./product/ProfilePage"));
const Explore = lazy(() => import("./product/Explore"));
const SpacePage = lazy(() => import("./product/SpacePage"));
const Manage = lazy(() => import("./product/Manage"));
const Developers = lazy(() => import("./product/Developers"));
const Examples = lazy(() => import("./product/Examples"));
type Lang = "zh" | "en";
export default function Product() {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("wallet-face-language");
      return saved === "zh" || saved === "en"
        ? saved
        : navigator.language.startsWith("zh")
          ? "zh"
          : "en";
    } catch {
      return "en";
    }
  });
  const zh = lang === "zh";
  useEffect(() => {
    document.documentElement.lang = zh ? "zh-CN" : "en";
    try {
      localStorage.setItem("wallet-face-language", lang);
    } catch {}
  }, [lang, zh]);
  const path = location.pathname.split("/").filter(Boolean);
  let body: ReactNode;
  try {
    if (!path.length)
      body = <AvatarPublisher locale={lang} onLocaleChange={setLang} />;
    else if (path[0] === "u" && path.length === 2)
      body = <ProfilePage address={decodeURIComponent(path[1])} zh={zh} />;
    else if (path[0] === "profile" && path[1] === "1" && path.length === 3) {
      location.replace("/u/" + encodeURIComponent(path[2]));
      body = null;
    } else if (path[0] === "spaces" && path.length === 1)
      body = <Explore zh={zh} />;
    else if (path[0] === "spaces" && path.length === 2)
      body = <SpacePage id={decodeURIComponent(path[1])} zh={zh} />;
    else if (path[0] === "spaces" && path[2] === "manage" && path.length === 3)
      body = <Manage id={decodeURIComponent(path[1])} zh={zh} />;
    else if (path[0] === "developers") body = <Developers zh={zh} />;
    else if (
      path[0] === "examples" &&
      ["directory", "governance", "wallet"].includes(path[1])
    )
      body = <Examples kind={path[1]} zh={zh} />;
    else if (path[0] === "communities")
      body = (
        <section className="panel">
          <div className="eyebrow">FOR COMMUNITIES</div>
          <h1>
            {zh
              ? "让公开参与变得可见，让组织身份有据可查。"
              : "Visible participation. Verifiable community identity."}
          </h1>
          <p>
            {zh
              ? "查看公开参与者目录和治理活动；持久化部署支持签名资料、品牌配置、组织角色与可撤销徽章。"
              : "Explore public participants and governance activity. Persistent deployments add signed profiles, branding, roles and revocable badges."}
          </p>
          <p>
            {zh
              ? "试点服务：定制品牌、托管部署、API 接入与运维。"
              : "Pilot services: custom branding, managed deployment, API integration and operations."}
          </p>
          <a
            className="button"
            href="https://github.com/CryptographyBloke/Face/issues/new?title=Community%20pilot"
          >
            {zh ? "申请设计伙伴试点" : "Request a design-partner pilot"} ↗
          </a>
        </section>
      );
    else if (path[0] === "privacy")
      body = (
        <section className="panel">
          <h1>{zh ? "隐私与数据来源" : "Privacy and data sources"}</h1>
          <p>
            {zh
              ? "社区资料与公开投票记录来自 Snapshot。原生资料通过钱包签名发布，也可签名隐藏；Snapshot 和 IPFS 上的公开数据由对应服务保存。"
              : "Community profiles and public votes come from Snapshot. Wallet signatures publish or hide native profiles. Snapshot and IPFS retain their respective public data."}
          </p>
          <p>
            {zh
              ? "服务器保存授权签名、随机 nonce 和操作时间。私钥由钱包保管。"
              : "The server stores authorization signatures, random nonces and operation timestamps. Private keys remain in the wallet."}
          </p>
        </section>
      );
    else
      body = (
        <section className="panel">
          <h1>404</h1>
          <a href="/">{zh ? "返回头像工具" : "Back to Avatar"}</a>
        </section>
      );
  } catch {
    body = (
      <section className="panel" role="alert">
        {zh ? "无效的网址" : "Invalid route"}
      </section>
    );
  }
  return (
    <>
      <header className="topbar">
        <a href="/" className="wordmark">
          <Identicon address="0xface" size={28} />
          Wallet Face
        </a>
        <nav aria-label={zh ? "主导航" : "Main navigation"}>
          <a href="/">{zh ? "头像" : "Avatar"}</a>
          <a href="/spaces">{zh ? "探索社区" : "Explore Spaces"}</a>
          <a href="/developers">{zh ? "开发者" : "Developers"}</a>
          <a href="/communities">{zh ? "社区服务" : "For Communities"}</a>
        </nav>
        <label>
          <span className="srOnly">Language</span>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <div className={!path.length ? "publisher-layout" : "product-layout"}>
        <Suspense
          fallback={
            <div className="skeleton" role="status">
              {zh ? "加载中…" : "Loading…"}
            </div>
          }
        >
          {body}
        </Suspense>
      </div>
      <footer className="product-footer">
        Wallet Face ·{" "}
        <a href="/privacy">{zh ? "隐私与数据来源" : "Privacy & provenance"}</a>{" "}
        · <a href="https://github.com/CryptographyBloke/Face">GitHub ↗</a>
      </footer>
    </>
  );
}
