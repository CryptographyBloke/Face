import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useMatch,
} from "react-router-dom";
import { usePreferences } from "./Preferences";
import { useWallet } from "./WalletProvider";
import { useSpaces } from "./SpacesProvider";
import {
  GITHUB_URL,
  profilePath,
  shareUrl,
  shortAddress,
  spacePath,
  validAddress,
  validSpaceId,
} from "./config";
import { api, useResource } from "./resource";
import { Avatar } from "../ui/Avatar";
import { BrandMark, Icon, type IconName } from "../ui/Icon";
import { CopyButton, Modal } from "../ui/primitives";
export function WalletButton() {
  const {
    wallet,
    status,
    error,
    connect,
    disconnect,
    avatarRevision,
    publishedAvatar,
  } = useWallet();
  const { t } = usePreferences();
  const [showError, setError] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  const profile = useResource(
    "wallet:" + (wallet?.address || "") + ":" + avatarRevision,
    (signal) => api.resolveProfile({ address: wallet!.address }, { signal }),
    !!wallet,
  );
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  if (wallet)
    return (
      <details
        ref={ref}
        className="account-menu"
        onKeyDown={(e) => {
          if (e.key === "Escape" && ref.current) {
            ref.current.open = false;
            ref.current.querySelector("summary")?.focus();
          }
        }}
      >
        <summary
          className="wallet-button"
          aria-label={t("钱包账户", "Wallet account")}
        >
          <Avatar
            uri={
              publishedAvatar?.address === wallet.address
                ? publishedAvatar.uri
                : profile.data?.avatar.uri
            }
            seed={wallet.address}
            name={shortAddress(wallet.address)}
            size={26}
          />
          <span>{shortAddress(wallet.address)}</span>
          <Icon name="chevron" size={14} />
        </summary>
        <div className="account-popover">
          <span className="eyebrow">{t("已连接钱包", "CONNECTED WALLET")}</span>
          <code className="break-address">{wallet.address}</code>
          <Link
            to={profilePath(wallet.address)}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
          >
            <Icon name="user" />
            {t("我的资料", "My profile")}
          </Link>
          <Link
            to="/avatar"
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
          >
            <Icon name="image" />
            {t("设置头像", "Set avatar")}
          </Link>
          <CopyButton
            value={shareUrl(profilePath(wallet.address))}
            label={t("复制资料链接", "Copy profile link")}
          />
          <hr />
          <button
            onClick={() => {
              if (ref.current) ref.current.open = false;
              void disconnect();
            }}
          >
            <Icon name="logout" />
            {t("退出登录", "Log out")}
          </button>
        </div>
      </details>
    );
  return (
    <>
      <button
        className="wallet-button"
        disabled={status === "restoring" || status === "connecting"}
        onClick={() => {
          void connect().catch(() => setError(true));
        }}
      >
        <Icon name="wallet" size={18} />
        <span>
          {status === "restoring"
            ? t("恢复连接…", "Restoring…")
            : status === "connecting"
              ? t("连接中…", "Connecting…")
              : t("连接钱包", "Connect wallet")}
        </span>
      </button>
      {showError && (
        <Modal
          title={t("连接钱包", "Connect wallet")}
          onClose={() => setError(false)}
        >
          <p role="alert">
            {error ||
              t(
                "请安装或打开支持 EIP-1193 的浏览器钱包。",
                "Install or open an EIP-1193 browser wallet.",
              )}
          </p>
          <button
            className="primary"
            onClick={() => {
              void connect()
                .then(() => setError(false))
                .catch(() => {});
            }}
          >
            {t("重试", "Try again")}
          </button>
        </Modal>
      )}
    </>
  );
}
export function UnifiedSearch() {
  const { t } = usePreferences();
  const spaceId = useMatch("/spaces/:spaceId/*")?.params.spaceId;
  const location = useLocation();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setValue("");
    setError("");
  }, [location.pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName) &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return (
    <form
      className="global-search"
      onSubmit={(e) => {
        e.preventDefault();
        const query = value.trim();
        if (!query) return;
        if (validAddress(query)) navigate(profilePath(query));
        else if (query.startsWith("0x"))
          setError(
            t("请输入完整的钱包地址。", "Enter a complete wallet address."),
          );
        else if (spaceId)
          navigate(
            `${spacePath(spaceId)}/participants?q=${encodeURIComponent(query)}`,
          );
        else if (validSpaceId(query.toLowerCase()) && query.includes("."))
          navigate(spacePath(query.toLowerCase()));
        else navigate(`/spaces?q=${encodeURIComponent(query)}`);
      }}
    >
      <label className="search-input">
        <Icon name="search" size={18} />
        <span className="sr-only">{t("全站搜索", "Search Wallet Face")}</span>
        <input
          ref={input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          placeholder={
            spaceId
              ? t("搜索参与者或钱包地址", "Search participants or wallet")
              : t(
                  "社区名称、Space ID 或钱包地址",
                  "Community, Space ID or wallet address",
                )
          }
          aria-invalid={!!error}
        />
        <kbd aria-hidden="true">/</kbd>
      </label>
      {error && (
        <span className="search-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
function Navigation({
  mobile = false,
  onSelect,
}: {
  mobile?: boolean;
  onSelect?: () => void;
}) {
  const { t } = usePreferences();
  const { wallet } = useWallet();
  const items: { to: string; icon: IconName; label: string; end?: boolean }[] =
    [
      { to: "/", icon: "home", label: t("首页", "Home"), end: true },
      { to: "/spaces", icon: "globe", label: t("探索", "Explore") },
      { to: "/followed", icon: "star", label: t("收藏", "Following") },
      {
        to: wallet ? profilePath(wallet.address) : "/profile",
        icon: "user",
        label: t("我的资料", "Profile"),
      },
      ...(!mobile
        ? [
            {
              to: "/developers",
              icon: "code" as IconName,
              label: t("开发者", "Developers"),
            },
          ]
        : []),
    ];
  return (
    <nav
      className={mobile ? "mobile-nav" : "main-nav"}
      aria-label={t(
        mobile ? "移动导航" : "主导航",
        mobile ? "Mobile navigation" : "Main navigation",
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onSelect}
          title={item.label}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
function Sidebar({ onSelect }: { onSelect?: () => void }) {
  const { followed } = useSpaces();
  const { t } = usePreferences();
  return (
    <>
      <Link className="wordmark" to="/" onClick={onSelect}>
        <BrandMark size={35} />
        <span>
          Wallet Face<small>IDENTITY, CONNECTED.</small>
        </span>
      </Link>
      <Navigation onSelect={onSelect} />
      <div className="sidebar-section">
        <div className="sidebar-label">
          {t("收藏的社区", "YOUR SPACES")}
          <Link
            to="/spaces"
            aria-label={t("发现社区", "Discover spaces")}
            onClick={onSelect}
          >
            <Icon name="plus" size={16} />
          </Link>
        </div>
        {followed.length ? (
          followed.map((space) => (
            <NavLink
              className="saved-space"
              key={space.id}
              to={spacePath(space.id)}
              onClick={onSelect}
              title={space.name}
            >
              <Avatar
                uri={space.avatar}
                seed={space.id}
                name={space.name}
                size={27}
              />
              <span>{space.name}</span>
            </NavLink>
          ))
        ) : (
          <p className="sidebar-empty">
            {t("收藏社区，随时回来看看。", "Follow a space to keep it close.")}
          </p>
        )}
        <p className="local-note">
          {t("收藏保存在此浏览器", "Saved in this browser")}
        </p>
      </div>
      <div className="sidebar-bottom">
        <Link to="/communities" onClick={onSelect}>
          <Icon name="plus" size={17} />
          {t("社区试点", "Community pilots")}
        </Link>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub <Icon name="external" size={13} />
        </a>
        <Link to="/privacy" onClick={onSelect}>
          {t("隐私与数据", "Privacy & data")}
        </Link>
        <small>WALLET FACE · v0.4</small>
      </div>
    </>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang, theme, setTheme } = usePreferences();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const title = location.pathname.startsWith("/avatar")
    ? t("设置头像", "Set avatar")
    : location.pathname.startsWith("/spaces")
      ? t("探索社区", "Explore communities")
      : location.pathname.startsWith("/developers")
        ? t("开发者", "Developers")
        : location.pathname === "/followed"
          ? t("收藏社区", "Following")
          : location.pathname.startsWith("/u/") ||
              location.pathname === "/profile"
            ? t("钱包资料", "Wallet profile")
            : location.pathname === "/communities"
              ? t("社区服务", "For communities")
              : location.pathname === "/privacy"
                ? t("隐私与数据", "Privacy & data")
                : t("首页", "Home");
  useEffect(() => {
    document.title = `${title} · Wallet Face`;
    document
      .querySelector('link[rel="canonical"]')
      ?.setAttribute("href", shareUrl(location.pathname));
    document
      .querySelector('meta[property="og:url"]')
      ?.setAttribute("content", shareUrl(location.pathname));
    setDrawer(false);
    window.scrollTo?.(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname, title]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("跳到主要内容", "Skip to content")}
      </a>
      <aside className="sidebar">
        <Sidebar />
      </aside>
      <div className="workspace">
        <header className="topnav">
          <button
            className="icon-button drawer-toggle"
            aria-label={t("打开导航", "Open navigation")}
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="breadcrumbs">
            <span>Wallet Face</span>
            <Icon name="chevron" size={14} />
            <strong>{title}</strong>
          </div>
          <UnifiedSearch />
          <div className="topnav-actions">
            <label className="language-control">
              <span className="sr-only">{t("语言", "Language")}</span>
              <select
                aria-label="Language"
                value={lang}
                onChange={(e) => setLang(e.target.value as "zh" | "en")}
              >
                <option value="zh">中文</option>
                <option value="en">EN</option>
              </select>
            </label>
            <button
              className="icon-button theme-button"
              title={t("切换主题", "Switch theme")}
              aria-label={t("切换主题", "Switch theme")}
              onClick={() =>
                setTheme(
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
                )
              }
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <WalletButton />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="content">
          {children}
        </main>
        <footer className="app-footer">
          <span>
            Wallet Face ·{" "}
            {t("钱包身份，连接社区。", "Your identity. Your communities.")}
          </span>
          <Link to="/privacy">
            {t("隐私与数据来源", "Privacy & data sources")}
          </Link>
        </footer>
      </div>
      <Navigation mobile />
      {drawer && (
        <Modal title={t("导航", "Navigation")} onClose={() => setDrawer(false)}>
          <div className="drawer-content">
            <Sidebar onSelect={() => setDrawer(false)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
