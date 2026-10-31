import { Link } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { SITE_URL, GITHUB_URL } from "../app/config";
import { Badge, CopyButton, PageHeader } from "../ui/primitives";
import { Icon } from "../ui/Icon";
export default function Developers() {
  const { t } = usePreferences();
  const address = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
  const request = `curl '${SITE_URL}/v1/profile/1/${address}'`;
  const react = `import { FaceClient } from '@wallet-face/sdk';\nimport { WalletFaceAvatar } from '@wallet-face/sdk/react';\n\nconst face = new FaceClient('${SITE_URL}');\nconst profile = await face.resolveProfile({ chainId: 1, address });\n\n<WalletFaceAvatar\n  address={address}\n  size={40}\n  baseUrl="${SITE_URL}"\n/>`;
  return (
    <div className="page-stack docs-page">
      <PageHeader
        eyebrow="BUILD WITH WALLET FACE"
        title={t("钱包身份，一次接入。", "Wallet identity. One integration.")}
        description={t(
          "用一个 API 解析头像与资料，把熟悉的面孔带进你的应用。",
          "One API for wallet avatars and profiles, ready for your application.",
        )}
        actions={<Badge tone="accent">API v1 · Ethereum</Badge>}
      />
      <div className="docs-layout">
        <nav
          className="docs-nav"
          aria-label={t("文档章节", "Documentation sections")}
        >
          <a href="#resolver">{t("Resolver API", "Resolver API")}</a>
          <a href="#endpoints">{t("接口", "Endpoints")}</a>
          <a href="#react">{t("React SDK", "React SDK")}</a>
          <a href="#examples">{t("集成示例", "Examples")}</a>
        </nav>
        <div className="page-stack">
          <section className="panel" id="resolver">
            <div className="section-heading">
              <h2>Resolver API</h2>
              <CopyButton
                value={request}
                label={t("复制请求", "Copy request")}
              />
            </div>
            <p>
              {t(
                "原生签名资料 → Snapshot → 可选 ENS。响应保留头像 URI、来源、验证状态和缓存时间。",
                "Native signed profiles → Snapshot → optional ENS. Responses include avatar URI, source, verification and cache timestamps.",
              )}
            </p>
            <pre>
              <code>{request}</code>
            </pre>
            <a
              className="text-link"
              href={`${SITE_URL}/v1/profile/1/${address}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("打开真实响应", "Open a live response")}
              <Icon name="external" size={14} />
            </a>
          </section>
          <section className="panel" id="endpoints">
            <h2>{t("公开读取接口", "Public read endpoints")}</h2>
            <div className="endpoint-list">
              {[
                "/v1/profile/1/:address",
                "/v1/avatar/1/:address",
                "/v1/spaces/:id/summary",
                "/v1/spaces/:id",
                "/v1/spaces/:id/members?page=0&sort=recent",
                "/v1/spaces/:id/activity",
              ].map((path) => (
                <div key={path}>
                  <Badge tone="success">GET</Badge>
                  <code>{path}</code>
                </div>
              ))}
            </div>
            <p className="muted">
              {t(
                "地址解析使用 chainId 1。社区响应附带来源、扫描范围和分页信息。",
                "Address resolution uses chainId 1. Community responses include sources, scan limits and pagination.",
              )}
            </p>
          </section>
          <section className="panel" id="react">
            <div className="section-heading">
              <h2>TypeScript / React SDK</h2>
              <CopyButton value={react} label={t("复制代码", "Copy code")} />
            </div>
            <pre>
              <code>{react}</code>
            </pre>
            <p>
              {t(
                "从仓库构建并打包 SDK，支持地址校验、头像网关回退与地址图案。",
                "Build and package the SDK from the repository. It includes address validation, gateway fallback and deterministic identicons.",
              )}
            </p>
            <a
              className="text-link"
              href={
                GITHUB_URL +
                "/tree/feature/snapshot-inspired-ui-v04/packages/sdk"
              }
              target="_blank"
              rel="noreferrer"
            >
              {t("SDK 源码与打包说明", "SDK source and packaging")}
              <Icon name="external" size={14} />
            </a>
          </section>
          <section id="examples">
            <h2>{t("集成示例", "Integration examples")}</h2>
            <div className="example-grid">
              {[
                {
                  kind: "directory",
                  title: t("社区目录", "Community directory"),
                  icon: "user" as const,
                },
                {
                  kind: "governance",
                  title: t("提案作者", "Proposal author"),
                  icon: "activity" as const,
                },
                {
                  kind: "wallet",
                  title: t("钱包账户", "Wallet account"),
                  icon: "wallet" as const,
                },
              ].map((item) => (
                <Link
                  className="panel example-card"
                  key={item.kind}
                  to={"/examples/" + item.kind}
                >
                  <Icon name={item.icon} size={24} />
                  <h3>{item.title}</h3>
                  <span>
                    {t("打开交互示例", "Try the example")}
                    <Icon name="arrow" size={15} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
