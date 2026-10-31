import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../app/resource";
import { usePreferences } from "../app/Preferences";
import { validAddress } from "../app/config";
import { DaoDirectory } from "../../../examples/directory";
import { ProposalAuthor } from "../../../examples/governance";
import { WalletAccount } from "../../../examples/wallet";
import { EmptyState, PageHeader } from "../ui/primitives";
export default function Examples() {
  const { kind = "" } = useParams();
  const { t } = usePreferences();
  const [input, setInput] = useState(""),
    [address, setAddress] = useState(""),
    [error, setError] = useState("");
  if (!["directory", "governance", "wallet"].includes(kind))
    return (
      <EmptyState
        title={t("选择一个集成示例", "Choose an integration example")}
      >
        <Link to="/developers">API / SDK</Link>
      </EmptyState>
    );
  const title =
    kind === "directory"
      ? t("社区目录", "Community directory")
      : kind === "governance"
        ? t("提案作者", "Proposal author")
        : t("钱包账户", "Wallet account");
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="LIVE INTEGRATION EXAMPLE"
        title={title}
        description={t(
          "输入钱包地址，通过 Face Resolver 查看资料和头像。",
          "Enter a wallet address to load its profile and avatar through Face Resolver.",
        )}
      />
      <section className="panel">
        <form
          className="lookup-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (validAddress(input)) {
              setAddress(input);
              setError("");
            } else
              setError(
                t("请输入完整的钱包地址。", "Enter a complete wallet address."),
              );
          }}
        >
          <label>
            {t("钱包地址", "Wallet address")}
            <input
              required
              placeholder="0x…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </label>
          <button className="primary">
            {t("解析资料", "Resolve profile")}
          </button>
        </form>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {address ? (
          <div className="example-result">
            {kind === "directory" ? (
              <DaoDirectory addresses={[address]} apiUrl={api.baseUrl} />
            ) : kind === "governance" ? (
              <ProposalAuthor
                address={address}
                title={t("提案作者卡片示例", "Example proposal author card")}
                apiUrl={api.baseUrl}
              />
            ) : (
              <WalletAccount address={address} apiUrl={api.baseUrl} />
            )}
          </div>
        ) : (
          <EmptyState
            icon="code"
            title={t(
              "在你的应用中展示钱包身份",
              "See wallet identity in an application",
            )}
          />
        )}
      </section>
      <Link className="text-link" to="/developers">
        {t("返回开发者文档", "Back to developer docs")}
      </Link>
    </div>
  );
}
