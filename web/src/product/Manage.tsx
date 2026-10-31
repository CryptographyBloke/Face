import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authorize, route } from "./shared";
import { usePreferences } from "../app/Preferences";
import { useWallet } from "../app/WalletProvider";
import { useCapabilities } from "../app/resource";
export default function Manage() {
  const { spaceId: id = "" } = useParams();
  const { zh } = usePreferences();
  const { connect } = useWallet();
  const mode = useCapabilities();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [recipient, setRecipient] = useState("");
  const [badgeType, setBadgeType] = useState("Organization Member");
  const [role, setRole] = useState("");
  const [revoke, setRevoke] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const act = async (action: string, payload: unknown) => {
    setBusy(true);
    setNotice("");
    try {
      if (!mode.canWrite)
        throw new Error("Community management requires a persistent backend");
      const wallet = await connect();
      await authorize(action, payload, wallet.address, wallet);
      setNotice(
        zh
          ? "已通过管理员校验并保存"
          : "Administrator permission verified; saved",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!mode.canWrite)
    return (
      <section className="panel">
        <h1>{zh ? "社区管理" : "Community administration"}</h1>
        <p>
          {zh
            ? "当前为浏览模式。连接持久化后端后可管理社区。"
            : "Browsing mode. Connect a persistent backend to manage this community."}
        </p>
        <Link to={route(id)}>{zh ? "返回社区" : "Back to space"}</Link>
      </section>
    );
  return (
    <section className="panel form">
      <h1>
        {zh ? "社区管理" : "Space administration"} · {id}
      </h1>
      <p>
        {zh
          ? "使用 Snapshot admins 列表中的 EOA 钱包签名，保存社区设置。"
          : "Sign with an EOA wallet in the current Snapshot admins list to save community settings."}
      </p>
      <p>
        <Link to={route(id)}>
          {zh
            ? "查看公开参与者与已认领资料"
            : "View public participants and claimed profiles"}
        </Link>
      </p>
      <label>
        {zh ? "组织名称" : "Organization name"}
        <input
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        {zh ? "组织简介" : "Description"}
        <textarea
          value={about}
          maxLength={1000}
          onChange={(e) => setAbout(e.target.value)}
        />
      </label>
      <button
        disabled={busy || !name}
        onClick={() => void act("space.brand", { spaceId: id, name, about })}
      >
        {zh ? "签名保存品牌信息" : "Sign branding update"}
      </button>
      <hr />
      <label>
        {zh ? "接收钱包" : "Recipient wallet"}
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
      </label>
      <label>
        {zh ? "徽章类型" : "Badge type"}
        <select
          value={badgeType}
          onChange={(e) => setBadgeType(e.target.value)}
        >
          <option>Organization Member</option>
          <option>Event Participant</option>
          <option>Contributor</option>
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() =>
          void act("badge.issue", {
            spaceId: id,
            recipient,
            type: badgeType,
            evidence: "",
            expiresAt: null,
          })
        }
      >
        {zh ? "签名颁发组织徽章" : "Sign organization badge"}
      </button>
      <label>
        {zh ? "角色标签（空值清除）" : "Role label (empty clears)"}
        <input
          value={role}
          maxLength={60}
          onChange={(e) => setRole(e.target.value)}
        />
      </label>
      <button
        disabled={busy}
        onClick={() => void act("role.set", { spaceId: id, recipient, role })}
      >
        {zh ? "签名设置角色" : "Sign role assignment"}
      </button>
      <label>
        {zh ? "撤销徽章 ID" : "Badge ID to revoke"}
        <input value={revoke} onChange={(e) => setRevoke(e.target.value)} />
      </label>
      <button
        disabled={busy}
        onClick={() => void act("badge.revoke", { spaceId: id, id: revoke })}
      >
        {zh ? "签名撤销徽章" : "Sign badge revocation"}
      </button>
      <p role="status">{notice}</p>
    </section>
  );
}
