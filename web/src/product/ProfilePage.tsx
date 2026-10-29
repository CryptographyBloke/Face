import { useState } from "react";
import { WalletFaceAvatar } from "../../../packages/sdk/src/react";
import { api, useLoad, Status, short } from "./shared";
import ClaimForm from "./ClaimForm";
export default function ProfilePage({
  address,
  zh,
}: {
  address: string;
  zh: boolean;
}) {
  const { data, error, retry } = useLoad(
    () => api.resolveProfile({ address }),
    address,
  );
  const [copied, setCopied] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const copy = async (text: string) => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyNotice(zh ? "已复制" : "Copied");
    } catch {
      setCopyNotice(
        (zh
          ? "浏览器禁止剪贴板，请手动复制："
          : "Clipboard unavailable; copy manually: ") + text,
      );
    }
  };
  return (
    <>
      <Status error={error} loading={!data} retry={retry} zh={zh} />
      {data && (
        <>
          <section className="panel profile">
            <WalletFaceAvatar
              address={data.address}
              size={96}
              baseUrl={api.baseUrl}
            />
            <h1>{data.profile.name || short(data.address)}</h1>
            <p>
              {data.profile.bio ||
                (zh ? "这个钱包还没有公开简介。" : "No public bio yet.")}
            </p>
            <code>{data.address}</code>
            <div className="actions">
              <button
                onClick={() => {
                  void copy(data.address);
                }}
              >
                {copied
                  ? zh
                    ? "已复制"
                    : "Copied"
                  : zh
                    ? "复制地址"
                    : "Copy address"}
              </button>
              <button
                onClick={() =>
                  void copy(location.origin + "/u/" + data.address)
                }
              >
                {zh ? "复制资料链接" : "Copy profile URL"}
              </button>
            </div>
            <p role="status">{copyNotice}</p>
            <p className="tags">
              <span>
                {data.provenance.profileClaimVerified
                  ? zh
                    ? "原生资料签名已验证"
                    : "Native profile signature verified"
                  : zh
                    ? "外部公开资料 · 未认领"
                    : "Public sources · unclaimed"}
              </span>
              <span>
                {zh ? "头像来源" : "Avatar source"}: {data.avatar.source}
              </span>
            </p>
            {data.profile.links.map((link) => (
              <a key={link} href={link} rel="noreferrer" target="_blank">
                {link}
              </a>
            ))}
            <p>
              <a
                href={"https://snapshot.box/#/profile/" + data.address}
                target="_blank"
                rel="noreferrer"
              >
                Snapshot ↗
              </a>{" "}
              ·{" "}
              <a
                href={"https://etherscan.io/address/" + data.address}
                target="_blank"
                rel="noreferrer"
              >
                Etherscan ↗
              </a>
            </p>
            {data.provenance.warnings.map((w) => (
              <p className="alert" key={w}>
                {w}
              </p>
            ))}
          </section>
          <ClaimForm
            key={data.profile.revision}
            profile={data}
            zh={zh}
            onSaved={retry}
          />
        </>
      )}
    </>
  );
}
