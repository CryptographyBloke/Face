import { usePreferences } from "../app/Preferences";
import { PageHeader } from "../ui/primitives";
export default function Privacy() {
  const { t } = usePreferences();
  return (
    <div className="page-stack prose-page">
      <PageHeader
        eyebrow="WALLET FACE"
        title={t("隐私与数据来源", "Privacy & data sources")}
      />
      <section className="panel prose">
        <h2>{t("资料来源", "Profile sources")}</h2>
        <p>
          {t(
            "社区资料与公开投票记录来自 Snapshot。头像按原生资料、Snapshot、可选 ENS 的顺序解析，页面展示来源和读取时间。",
            "Community profiles and public votes come from Snapshot. Avatars resolve from native profiles, Snapshot and optional ENS, with source and retrieval details.",
          )}
        </p>
        <h2>{t("发布与隐藏", "Publishing and hiding")}</h2>
        <p>
          {t(
            "原生资料通过钱包签名发布，也可签名隐藏。Snapshot 和 IPFS 上的公开数据由对应服务保存。私钥由钱包保管。",
            "Wallet signatures publish or hide native profiles. Snapshot and IPFS retain their respective public data. Private keys remain in your wallet.",
          )}
        </p>
        <h2>{t("浏览器记录", "Browser storage")}</h2>
        <p>
          {t(
            "收藏、最近访问、语言和主题保存在此浏览器。钱包授权由钱包管理，退出登录清除本站的连接状态。",
            "Followed spaces, recent spaces, language and theme are saved in this browser. Your wallet manages permissions; logging out clears the site’s connection state.",
          )}
        </p>
        <h2>{t("服务端记录", "Server records")}</h2>
        <p>
          {t(
            "持久化部署保存签名授权、随机 nonce、资料版本和操作时间，用于验证更新与防止重复提交。",
            "Persistent deployments retain signed authorizations, random nonces, profile revisions and operation timestamps to verify updates and prevent replay.",
          )}
        </p>
      </section>
    </div>
  );
}
