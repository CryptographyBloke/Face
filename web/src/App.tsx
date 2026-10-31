import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { publishEnsAvatar } from "./ens";
import { publishSnapshotAvatar, readSnapshotAvatar } from "./snapshot";
import { resolveAvatarUris, uploadAvatar, validateAvatarFile } from "./storage";
import { usePreferences } from "./app/Preferences";
import { useWallet } from "./app/WalletProvider";
import { profilePath, shareUrl } from "./app/config";
import { WalletButton } from "./app/AppShell";
import { Avatar } from "./ui/Avatar";
import { Icon } from "./ui/Icon";
import { Badge, CopyButton, PageHeader } from "./ui/primitives";
type Step = "idle" | "uploading" | "signing" | "publishing" | "done";
function PreviewImage({ sources }: { sources: string[] }) {
  const key = sources.join("|");
  const [failed, setFailed] = useState({ key: "", index: 0 });
  const index = failed.key === key ? failed.index : 0;
  return sources[index] ? (
    <img
      src={sources[index]}
      alt="Avatar preview"
      onError={() => setFailed({ key, index: index + 1 })}
    />
  ) : (
    <Icon name="image" size={42} />
  );
}
export default function App() {
  const { t, zh } = usePreferences();
  const { wallet, refreshAvatar, publishedAvatar } = useWallet();
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [uri, setUri] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [syncEns, setSyncEns] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    currentAddress = useRef(wallet?.address);
  currentAddress.current = wallet?.address;
  const address = wallet?.address;
  const busy = ["uploading", "signing", "publishing"].includes(step);
  useEffect(() => {
    setFile(null);
    setPreview("");
    setUri(null);
    setError("");
    setNotice("");
    setStep("idle");
    if (!address) return;
    const controller = new AbortController();
    void readSnapshotAvatar(address, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setUri((current) => current || value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [address]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const choose = (next?: File) => {
    if (!next) return;
    setError("");
    setNotice("");
    try {
      validateAvatarFile(next);
      setFile(next);
      setPreview(URL.createObjectURL(next));
      setStep("idle");
    } catch (cause) {
      setFile(null);
      setPreview("");
      setStep("idle");
      const text = (cause as Error).message;
      setError(
        zh
          ? text.includes("JPG")
            ? "请选择 JPG 或 PNG 图片。"
            : text.includes("1 MB")
              ? "图片太大，请控制在 1 MB 以内。"
              : text
          : text,
      );
    }
  };
  const publish = async () => {
    if (!wallet || !file) return;
    const publishingWallet = wallet;
    const selected = file;
    const stillCurrent = () =>
      currentAddress.current?.toLowerCase() ===
      publishingWallet.address.toLowerCase();
    const assertCurrent = async () => {
      const accounts = (await window.ethereum?.request({
        method: "eth_accounts",
      })) as string[] | undefined;
      if (
        !stillCurrent() ||
        accounts?.[0]?.toLowerCase() !== publishingWallet.address.toLowerCase()
      )
        throw new Error(
          t(
            "钱包已切换，请重新选择图片。",
            "Wallet changed. Choose your image again.",
          ),
        );
    };
    setError("");
    setNotice("");
    setStep("uploading");
    try {
      const uploaded = await uploadAvatar(selected);
      await assertCurrent();
      await publishSnapshotAvatar(
        publishingWallet.walletClient,
        publishingWallet.address,
        uploaded,
        async (stage) => {
          await assertCurrent();
          setStep(stage);
        },
      );
      let ensNotice = "";
      if (syncEns) {
        try {
          await assertCurrent();
          const result = await publishEnsAvatar(
            publishingWallet.address,
            uploaded,
          );
          ensNotice = result.updated
            ? t("ENS 头像已同步。", "ENS avatar synchronized.")
            : t(
                "可在已有 ENS 名称中设置头像记录。",
                "Set an avatar record on an existing ENS name.",
              );
        } catch {
          ensNotice = t(
            "Snapshot 已发布，可稍后重试 ENS 同步。",
            "Snapshot is published. You can retry ENS synchronization later.",
          );
        }
      }
      if (!stillCurrent()) return;
      setUri(uploaded);
      setFile(null);
      setStep("done");
      setNotice(
        t("头像已发布。", "Avatar published.") +
          (ensNotice ? " " + ensNotice : ""),
      );
      refreshAvatar(uploaded, publishingWallet.address);
    } catch (cause) {
      if (stillCurrent()) {
        setError((cause as Error).message);
        setStep("idle");
      }
    }
  };
  const override =
    publishedAvatar && publishedAvatar.address === address
      ? publishedAvatar.uri
      : null;
  const sources = preview ? [preview] : resolveAvatarUris(override || uri);
  const labels = [
    t("选择图片", "Choose an image"),
    t("上传到 IPFS", "Upload to IPFS"),
    t("钱包签名", "Wallet signature"),
    t("发布资料", "Publish profile"),
  ];
  const stageIndex =
    step === "uploading"
      ? 1
      : step === "signing"
        ? 2
        : step === "publishing"
          ? 3
          : step === "done"
            ? 4
            : 0;
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="YOUR IDENTITY"
        title={t("设置钱包头像", "Set your wallet avatar")}
        description={t(
          "选择图片，签名发布，在兼容应用中使用。",
          "Choose an image, sign and use your avatar in compatible apps.",
        )}
        actions={
          <Badge tone="success">{t("免费 · 免 Gas", "Free · Gasless")}</Badge>
        }
      />
      <div className="publisher-grid">
        <section className="panel publisher-panel">
          <ol className="publish-steps">
            {labels.map((label, i) => (
              <li
                key={i}
                className={
                  stageIndex > i
                    ? "complete"
                    : stageIndex === i
                      ? "current"
                      : ""
                }
              >
                <span>
                  {stageIndex > i ? <Icon name="check" size={13} /> : i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
          <div className="publisher-preview">
            <div className="preview-ring">
              <PreviewImage sources={sources} />
            </div>
            <h2>
              {step === "done"
                ? t(
                    "准备好与大家见面了。",
                    "Ready to put a face to your wallet.",
                  )
                : t("给你的钱包，一张新面孔。", "A new face for your wallet.")}
            </h2>
            <p>{t("JPG 或 PNG · 最大 1 MB", "JPG or PNG · Up to 1 MB")}</p>
          </div>
          {wallet ? (
            <>
              <label className="upload-drop">
                <input
                  ref={input}
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={busy}
                  onClick={(e) => {
                    e.currentTarget.value = "";
                  }}
                  onChange={(e) => choose(e.target.files?.[0])}
                />
                <Icon name="image" size={24} />
                <strong>
                  {preview
                    ? t("更换图片", "Choose another image")
                    : t("选择头像图片", "Choose your avatar")}
                </strong>
                <span>
                  {file?.name ||
                    t("点击选择 JPG 或 PNG", "Select a JPG or PNG file")}
                </span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={syncEns}
                  onChange={(e) => setSyncEns(e.target.checked)}
                  disabled={busy}
                />
                <span>
                  {t(
                    "同时同步已有 ENS 头像（可选，可能需要 Gas）",
                    "Also sync an existing ENS avatar (optional, may require gas)",
                  )}
                </span>
              </label>
              <button
                className="primary full-width"
                onClick={() => {
                  void publish();
                }}
                disabled={busy || !file}
              >
                {busy ? (
                  <>
                    <span className="spinner" />
                    {step === "uploading"
                      ? t("正在上传图片…", "Uploading image…")
                      : step === "signing"
                        ? t("等待钱包签名…", "Waiting for your signature…")
                        : t("正在发布资料…", "Publishing profile…")}
                  </>
                ) : (
                  <>
                    <Icon name="image" size={18} />
                    {t("发布头像", "Publish avatar")}
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="publisher-connect">
              <p>
                {t(
                  "连接钱包，开始设置你的头像。",
                  "Connect your wallet to set an avatar.",
                )}
              </p>
              <WalletButton />
            </div>
          )}
          {notice && (
            <div className="success-state" role="status">
              <Icon name="check" />
              {notice}
            </div>
          )}
          {error && (
            <div className="error-state" role="alert">
              <Icon name="info" />
              <span>{error}</span>
              {file && (
                <button
                  disabled={busy}
                  onClick={() => {
                    void publish();
                  }}
                >
                  {t("重试", "Retry")}
                </button>
              )}
            </div>
          )}
          {uri && <code className="uri">{uri}</code>}
          {step === "done" && address && (
            <div className="actions">
              <Link className="button primary" to={profilePath(address)}>
                {t("打开我的公开资料", "Open my public profile")}
                <Icon name="arrow" size={16} />
              </Link>
              <CopyButton
                value={shareUrl(profilePath(address))}
                label={t("复制资料链接", "Copy profile link")}
              />
            </div>
          )}
        </section>
        <aside className="page-stack">
          <section className="panel publisher-info">
            <div className="feature-icon">
              <Icon name="wallet" size={24} />
            </div>
            <h2>{t("由你的钱包掌握", "Owned by your wallet")}</h2>
            <p>
              {t(
                "用钱包签署 Snapshot Profile，头像通过 IPFS 保存。",
                "Sign a Snapshot Profile with your wallet. Your image is stored on IPFS.",
              )}
            </p>
            <div className="info-row">
              <Icon name="check" size={17} />
              {t("Snapshot 发布免 Gas", "Gasless Snapshot publishing")}
            </div>
            <div className="info-row">
              <Icon name="check" size={17} />
              {t("可选 ENS 同步", "Optional ENS synchronization")}
            </div>
            <div className="info-row">
              <Icon name="check" size={17} />
              {t("可分享的钱包资料页", "Shareable wallet profile")}
            </div>
          </section>
          {address && (
            <section className="panel">
              <div className="section-heading">
                <h3>{t("当前钱包", "Current wallet")}</h3>
              </div>
              <div className="wallet-row">
                <Avatar
                  uri={override || uri}
                  seed={address}
                  name={address}
                  size={40}
                />
                <code className="break-address">{address}</code>
              </div>
              <Link className="text-link" to={profilePath(address)}>
                {t("查看钱包资料", "View wallet profile")}
                <Icon name="arrow" size={15} />
              </Link>
            </section>
          )}
          <section className="panel">
            <h3>{t("在其他应用中查看", "Open in compatible apps")}</h3>
            <div className="source-links">
              <a
                href={
                  address
                    ? `https://snapshot.box/#/profile/${address}`
                    : "https://snapshot.box/"
                }
                target="_blank"
                rel="noreferrer"
              >
                Snapshot
                <Icon name="external" size={14} />
              </a>
              {address && (
                <a
                  href={`https://cdn.stamp.fyi/avatar/${address}?s=512`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Stamp
                  <Icon name="external" size={14} />
                </a>
              )}
              {uri && (
                <a
                  href={resolveAvatarUris(uri)[0]}
                  target="_blank"
                  rel="noreferrer"
                >
                  IPFS
                  <Icon name="external" size={14} />
                </a>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
