import { useState } from "react";
import type { Profile } from "../../../packages/sdk/src/index";
import { connectWallet } from "../wallet";
import { authorize, api, useLoad } from "./shared";
export default function ClaimForm({
  profile,
  zh,
  onSaved,
}: {
  profile: Profile;
  zh: boolean;
  onSaved: () => void;
}) {
  const mode = useLoad(
    () => api.request<{ mode: string }>("/health"),
    "health",
  );
  const [name, setName] = useState(profile.profile.name || "");
  const [bio, setBio] = useState(profile.profile.bio || "");
  const [avatar, setAvatar] = useState(profile.avatar.uri || "");
  const [website, setWebsite] = useState(profile.profile.links[0] || "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = async (hide = false) => {
    setBusy(true);
    setNotice("");
    try {
      const w = await connectWallet();
      if (w.address.toLowerCase() !== profile.address.toLowerCase())
        throw new Error(
          zh
            ? "请连接该资料所属钱包"
            : "Connect the wallet that owns this profile",
        );
      await authorize(
        hide ? "profile.hide" : "profile.upsert",
        hide
          ? { revision: profile.profile.revision }
          : {
              name,
              bio,
              avatarURI: avatar,
              links: website ? [website] : [],
              revision: profile.profile.revision,
            },
        profile.address,
      );
      setNotice(zh ? "已保存签名资料" : "Signed profile saved");
      onSaved();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (mode.data?.mode === "read-only")
    return (
      <section className="panel">
        <p>
          {zh
            ? "这是只读预览。原生资料认领需要接入持久化后端；预览不会请求资料签名。"
            : "Read-only preview. Native claims require a persistent backend; this preview will not request a claim signature."}
        </p>
      </section>
    );
  return (
    <form
      className="panel form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2>{zh ? "认领 / 编辑钱包资料" : "Claim / edit wallet profile"}</h2>
      <p>
        {zh
          ? "资料将公开；签名仅授权本次修改，不代表加入 DAO。仅支持普通 EOA 钱包。"
          : "Fields will be public. Signing authorizes this update, not DAO membership. EOA wallets only."}
      </p>
      <label>
        {zh ? "名称" : "Display name"}
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        {zh ? "简介" : "Bio"}
        <textarea
          value={bio}
          maxLength={500}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      <label>
        {zh ? "头像 URI" : "Avatar URI"}
        <input
          value={avatar}
          maxLength={256}
          onChange={(e) => setAvatar(e.target.value)}
        />
      </label>
      <label>
        {zh ? "网站（HTTPS）" : "Website (HTTPS)"}
        <input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>
      <div className="actions">
        <button disabled={busy}>
          {busy
            ? zh
              ? "等待钱包签名…"
              : "Waiting for signature…"
            : zh
              ? "签名并公开保存"
              : "Sign and publish"}
        </button>
        <button type="button" disabled={busy} onClick={() => void submit(true)}>
          {zh ? "签名隐藏原生资料" : "Sign to hide native profile"}
        </button>
      </div>
      <p role="status">{notice}</p>
    </form>
  );
}
