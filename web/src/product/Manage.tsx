import { useState } from "react";
import { authorize, route, api, useLoad } from "./shared";
export default function Manage({ id, zh }: { id: string; zh: boolean }) {
  const mode = useLoad(
    () => api.request<{ mode: string }>("/health"),
    "health",
  );
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
      await authorize(action, payload);
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
  if (mode.data?.mode === "read-only")
    return (
      <section className="panel">
        <h1>
          {zh ? "社区管理 · 只读预览" : "Administration · read-only preview"}
        </h1>
        <p>
          {zh
            ? "此部署未接入持久化数据库，管理员写入已禁用。"
            : "This deployment has no persistent database. Administrator writes are disabled."}
        </p>
        <a href={route(id)}>{zh ? "返回社区" : "Back to space"}</a>
      </section>
    );
  return (
    <section className="panel form">
      <h1>
        {zh ? "社区管理" : "Space administration"} · {id}
      </h1>
      <p>
        {zh
          ? "每次修改均需签名，并实时查询 Snapshot admins 权限。仅支持 EOA 管理员；Safe/EIP-1271 暂不支持。"
          : "Each change requires a signature and a fresh Snapshot admins permission check. EOA admins only; Safe/EIP-1271 is not supported yet."}
      </p>
      <p>
        <a href={route(id)}>
          {zh
            ? "查看公开参与者与已认领资料"
            : "View public participants and claimed profiles"}
        </a>
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
      <p>
        {zh
          ? "邀请链接、批量导出和 Safe 管理尚未实现。"
          : "Invitation links, bulk export, and Safe administration are not implemented yet."}
      </p>
    </section>
  );
}
