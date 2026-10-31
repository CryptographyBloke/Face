import { Link } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useWallet } from "../app/WalletProvider";
import { useSpaces } from "../app/SpacesProvider";
import {
  CURATED_SPACES,
  profilePath,
  shortAddress,
  spacePath,
} from "../app/config";
import { WalletButton } from "../app/AppShell";
import { SpaceCard } from "../ui/SpaceCard";
import { Icon } from "../ui/Icon";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/primitives";
export default function Home() {
  const { t } = usePreferences();
  const { wallet } = useWallet();
  const { followed, recent } = useSpaces();
  return (
    <div className="page-stack">
      <div className="home-intro">
        <div>
          <div className="eyebrow">WALLET FACE</div>
          <h1>
            {t("你的钱包身份，", "Your wallet identity,")}
            <br />
            <span>{t("连接整个 Web3。", "across Web3.")}</span>
          </h1>
          <p>
            {t(
              "发布头像，认识社区，让每一次参与都有清晰的身份。",
              "Publish your avatar. Find your communities. Put a face to your participation.",
            )}
          </p>
          <div className="actions">
            <Link className="button primary" to="/avatar">
              <Icon name="image" />
              {t("设置头像", "Set your avatar")}
              <Icon name="arrow" size={16} />
            </Link>
            <Link className="button" to="/spaces">
              {t("探索社区", "Explore communities")}
            </Link>
          </div>
          <div className="hero-note">
            <span className="status-dot" />
            {t(
              "Snapshot 头像发布 · 免费 · 免 Gas",
              "Snapshot publishing · Free · Gasless",
            )}
          </div>
        </div>
        <div className="identity-card">
          <div className="identity-card-top">
            <span className="eyebrow">{t("你的身份", "YOUR IDENTITY")}</span>
            <Badge tone="accent">
              {wallet
                ? t("已连接", "Connected")
                : t("钱包驱动", "Wallet-powered")}
            </Badge>
          </div>
          <div className="identity-visual">
            <Avatar
              seed={wallet?.address || "wallet-face"}
              name={t("钱包身份", "Wallet identity")}
              size={76}
            />
            <span className="identity-dot" />
          </div>
          <h2>
            {wallet
              ? shortAddress(wallet.address)
              : t("从你的钱包开始", "Start with your wallet")}
          </h2>
          <p>
            {t(
              "一个头像，一张可分享的钱包名片。",
              "One avatar. A profile you can share.",
            )}
          </p>
          {wallet ? (
            <Link
              className="button full-width"
              to={profilePath(wallet.address)}
            >
              {t("打开我的资料", "Open my profile")}
              <Icon name="arrow" size={16} />
            </Link>
          ) : (
            <WalletButton />
          )}
        </div>
      </div>
      <div className="quick-grid">
        <Link className="quick-card" to="/avatar">
          <span className="feature-icon">
            <Icon name="image" size={24} />
          </span>
          <div>
            <h3>{t("让钱包有张面孔", "Make your wallet yours")}</h3>
            <p>
              {t(
                "上传图片，用钱包签名发布。",
                "Upload an image and publish with a signature.",
              )}
            </p>
          </div>
          <Icon name="arrow" />
        </Link>
        <Link className="quick-card" to="/communities">
          <span className="feature-icon lavender">
            <Icon name="globe" size={24} />
          </span>
          <div>
            <h3>{t("把社区连接起来", "Bring your community together")}</h3>
            <p>
              {t(
                "参与者、治理活动和钱包资料，一处查看。",
                "Participants, governance and profiles in one place.",
              )}
            </p>
          </div>
          <Icon name="arrow" />
        </Link>
      </div>
      {(recent.length > 0 || followed.length > 0) && (
        <section>
          <div className="section-heading">
            <h2>{t("继续探索", "Pick up where you left off")}</h2>
            <Link to="/followed">
              {t("所有收藏", "All followed")}
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="recent-strip">
            {[
              ...recent,
              ...followed.filter((s) => !recent.some((r) => r.id === s.id)),
            ]
              .slice(0, 4)
              .map((space) => (
                <Link key={space.id} to={spacePath(space.id)}>
                  <Avatar
                    uri={space.avatar}
                    seed={space.id}
                    name={space.name}
                    size={34}
                  />
                  <span>
                    {space.name}
                    <small>{space.id}</small>
                  </span>
                  <Icon name="chevron" size={15} />
                </Link>
              ))}
          </div>
        </section>
      )}
      <section>
        <div className="section-heading">
          <div>
            <h2>{t("发现社区", "Discover communities")}</h2>
            <p className="muted">
              {t(
                "从公开的 Snapshot 社区开始。",
                "Start with public spaces on Snapshot.",
              )}
            </p>
          </div>
          <Link to="/spaces">
            {t("查看全部", "Explore spaces")}
            <Icon name="arrow" size={16} />
          </Link>
        </div>
        <div className="space-grid">
          {CURATED_SPACES.map((id) => (
            <SpaceCard key={id} id={id} />
          ))}
        </div>
      </section>
      <Link className="developer-banner" to="/developers">
        <span className="code-mark">
          <Icon name="code" size={27} />
        </span>
        <div>
          <h3>
            {t(
              "给你的应用加上钱包身份",
              "Wallet identity for your application",
            )}
          </h3>
          <p>
            {t(
              "使用 Resolver API 和 React SDK，快速接入头像与资料。",
              "Resolve avatars and profiles with the API and React SDK.",
            )}
          </p>
        </div>
        <span>
          {t("开发者文档", "Developer docs")}
          <Icon name="arrow" size={17} />
        </span>
      </Link>
    </div>
  );
}
