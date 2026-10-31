import { Link, Navigate, useParams } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useWallet } from "../app/WalletProvider";
import { useSpaces } from "../app/SpacesProvider";
import { api, useCapabilities, useResource } from "../app/resource";
import {
  profilePath,
  safeHttps,
  shareUrl,
  shortAddress,
  spacePath,
  validAddress,
} from "../app/config";
import { WalletButton } from "../app/AppShell";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import {
  Badge,
  CopyButton,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../ui/primitives";
import ClaimForm from "./ClaimForm";
export default function ProfilePage() {
  const { address } = useParams();
  const { wallet } = useWallet();
  const { t } = usePreferences();
  if (!address)
    return wallet ? (
      <Navigate replace to={profilePath(wallet.address)} />
    ) : (
      <EmptyState
        icon="user"
        title={t("你的钱包，就是你的名片。", "Your wallet is your profile.")}
        description={t(
          "连接钱包查看资料，或使用上方搜索查找任意钱包。",
          "Connect to view your profile, or search for any wallet above.",
        )}
      >
        <WalletButton />
        <Link className="button" to="/avatar">
          {t("设置头像", "Set avatar")}
        </Link>
      </EmptyState>
    );
  if (!validAddress(address))
    return (
      <EmptyState
        icon="user"
        title={t("请输入有效的钱包地址", "Enter a valid wallet address")}
      />
    );
  return <ProfileView key={address.toLowerCase()} address={address} />;
}
function ProfileView({ address }: { address: string }) {
  const { t, zh } = usePreferences();
  const { wallet, publishedAvatar, avatarRevision } = useWallet();
  const { recent } = useSpaces();
  const { canWrite } = useCapabilities();
  const state = useResource(
    "profile:" + address.toLowerCase() + ":" + avatarRevision,
    (signal) => api.resolveProfile({ address }, { signal }),
  );
  const p = state.data;
  const self = wallet?.address.toLowerCase() === address.toLowerCase();
  if (!p)
    return state.error ? (
      <ErrorState message={state.error} retry={state.retry} />
    ) : (
      <LoadingSkeleton rows={6} />
    );
  const uri =
    publishedAvatar?.address.toLowerCase() === address.toLowerCase()
      ? publishedAvatar.uri
      : p.avatar.uri;
  return (
    <div className="page-stack profile-page">
      <section className="profile-header">
        <div className="profile-cover">
          <div className="cover-lines" />
          <CopyButton
            value={shareUrl(profilePath(p.address))}
            label={t("分享资料", "Share profile")}
          />
        </div>
        <div className="profile-header-content">
          <Avatar
            uri={uri}
            seed={p.address}
            name={p.profile.name || shortAddress(p.address)}
            size={96}
          />
          <div className="profile-title">
            <h1>{p.profile.name || shortAddress(p.address)}</h1>
            <Badge
              tone={p.provenance.profileClaimVerified ? "success" : "neutral"}
            >
              {p.provenance.profileClaimVerified
                ? t("资料签名已验证", "Signed profile")
                : t("公开资料", "Public profile")}
            </Badge>
          </div>
          <div className="profile-address">
            <code className="break-address">{p.address}</code>
            <CopyButton
              value={p.address}
              label={t("复制地址", "Copy address")}
              iconOnly
            />
          </div>
          {p.profile.bio && <p className="profile-bio">{p.profile.bio}</p>}
          <div className="actions">
            {self && (
              <Link className="button primary" to="/avatar">
                <Icon name="image" size={17} />
                {t("更换头像", "Change avatar")}
              </Link>
            )}
            {self && canWrite && (
              <a className="button" href="#edit-profile">
                <Icon name="user" size={17} />
                {t("编辑资料", "Edit profile")}
              </a>
            )}
            {p.profile.links.map((link) =>
              safeHttps(link) ? (
                <a
                  className="button"
                  key={link}
                  href={safeHttps(link)!}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="globe" size={16} />
                  {new URL(link).hostname}
                  <Icon name="external" size={13} />
                </a>
              ) : null,
            )}
          </div>
        </div>
      </section>
      <div className="profile-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>{t("钱包身份", "Wallet identity")}</h2>
            <Icon name="user" />
          </div>
          <dl className="metadata-list">
            <div>
              <dt>{t("资料来源", "Profile sources")}</dt>
              <dd>
                {p.provenance.sources.join(" · ") ||
                  t("钱包地址", "Wallet address")}
              </dd>
            </div>
            <div>
              <dt>{t("头像来源", "Avatar source")}</dt>
              <dd>
                {uri === publishedAvatar?.uri
                  ? "Snapshot"
                  : p.avatar.source === "none"
                    ? t("地址图案", "Address identicon")
                    : p.avatar.source}
              </dd>
            </div>
            <div>
              <dt>{t("身份网络", "Identity network")}</dt>
              <dd>Ethereum · Chain 1</dd>
            </div>
            <div>
              <dt>{t("资料版本", "Profile revision")}</dt>
              <dd>{p.profile.revision}</dd>
            </div>
          </dl>
          {!p.profile.bio && (
            <p className="muted">
              {t(
                "这个钱包还没有公开简介。",
                "This wallet has no public bio yet.",
              )}
            </p>
          )}
          <div className="source-links">
            <a
              href={`https://snapshot.box/#/profile/${p.address}`}
              target="_blank"
              rel="noreferrer"
            >
              Snapshot
              <Icon name="external" size={14} />
            </a>
            <a
              href={`https://etherscan.io/address/${p.address}`}
              target="_blank"
              rel="noreferrer"
            >
              Etherscan
              <Icon name="external" size={14} />
            </a>
          </div>
          {p.provenance.warnings.map((w) => (
            <p className="muted" key={w}>
              {w}
            </p>
          ))}
          <small className="muted">
            {t("读取于", "Retrieved")}{" "}
            {new Date(p.cache.fetchedAt).toLocaleString(zh ? "zh-CN" : "en-US")}
          </small>
        </section>
        <section className="panel">
          <h2>{t("继续了解社区", "Continue exploring")}</h2>
          <p className="muted">
            {t(
              "打开最近访问的社区，搜索这个钱包的公开参与记录。",
              "Open a recently viewed space and search this wallet’s public participation.",
            )}
          </p>
          {recent.length ? (
            <div className="profile-spaces">
              {recent.slice(0, 4).map((space) => (
                <Link
                  key={space.id}
                  to={
                    spacePath(space.id) +
                    "/participants?q=" +
                    encodeURIComponent(p.address)
                  }
                >
                  <Avatar
                    uri={space.avatar}
                    seed={space.id}
                    name={space.name}
                    size={32}
                  />
                  <span>{space.name}</span>
                  <Icon name="chevron" size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <Link className="button" to="/spaces">
              {t("探索社区", "Explore spaces")}
              <Icon name="arrow" size={16} />
            </Link>
          )}
        </section>
      </div>
      {self && (
        <div id="edit-profile">
          <ClaimForm
            key={p.profile.revision}
            profile={p}
            zh={zh}
            onSaved={state.retry}
          />
        </div>
      )}
    </div>
  );
}
