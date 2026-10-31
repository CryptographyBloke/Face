import { Link } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useCapabilities } from "../app/resource";
import { GITHUB_URL } from "../app/config";
import { Icon, type IconName } from "../ui/Icon";
import { Badge, PageHeader } from "../ui/primitives";
export default function Communities() {
  const { t } = usePreferences();
  const { canWrite } = useCapabilities();
  const features: { icon: IconName; title: string; body: string }[] = [
    {
      icon: "globe",
      title: t("导入你的社区", "Bring your space"),
      body: t(
        "输入 Snapshot Space ID，汇集公开资料与治理活动。",
        "Use a Snapshot Space ID to bring public profiles and governance into one view.",
      ),
    },
    {
      icon: "user",
      title: t("认识参与者", "Meet the participants"),
      body: t(
        "按钱包搜索公开参与记录，打开头像和可分享的资料页。",
        "Search public participation by wallet, then open a profile to learn more.",
      ),
    },
    {
      icon: "code",
      title: t("接入你的网站", "Make it part of your website"),
      body: t(
        "用 API 和 React 组件把钱包资料接到社区应用中。",
        "Embed wallet profiles in your community app with the API and React components.",
      ),
    },
  ];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="FOR COMMUNITIES"
        title={t(
          "让每一次参与，都有一张面孔。",
          "Put a face to your community.",
        )}
        description={t(
          "从公开治理记录出发，建立更容易认识和连接的社区。",
          "Build a community people can recognize, starting with public governance.",
        )}
      />
      <div className="feature-grid">
        {features.map((item) => (
          <article className="panel feature-panel" key={item.icon}>
            <div className="feature-icon">
              <Icon name={item.icon} size={25} />
            </div>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
      <section className="panel pilot-panel">
        <div>
          <Badge tone="accent">
            {t("设计伙伴试点", "Design-partner pilot")}
          </Badge>
          <h2>
            {t(
              "把 Wallet Face 带进你的社区",
              "Bring Wallet Face to your community",
            )}
          </h2>
          <p>
            {t(
              "一起完成社区目录、品牌配置和一次真实的网站接入。持久化部署还提供钱包资料认领、角色标签与可撤销组织徽章。",
              "Build a community directory, tailor its branding and integrate it into your website. Persistent deployments add profile claims, role labels and revocable organization badges.",
            )}
          </p>
          <p className="muted">
            {t("当前站点：", "This site: ")}
            {canWrite
              ? t(
                  "资料与社区管理可用",
                  "profile and community management enabled",
                )
              : t(
                  "公开资料与治理浏览",
                  "public profiles and governance browsing",
                )}
          </p>
          <div className="actions">
            <a
              className="button primary"
              href={`${GITHUB_URL}/issues/new?title=Wallet%20Face%20community%20pilot`}
              target="_blank"
              rel="noreferrer"
            >
              {t("申请社区试点", "Request a pilot")}
              <Icon name="external" size={16} />
            </a>
            <Link className="button" to="/spaces/yam.eth">
              {t("查看社区示例", "View a space")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
