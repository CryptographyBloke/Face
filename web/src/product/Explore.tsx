import { useState } from "react";
import { route } from "./shared";
export default function Explore({ zh }: { zh: boolean }) {
  const [id, setId] = useState("");
  return (
    <section className="panel">
      <div className="eyebrow">FACE SPACES</div>
      <h1>
        {zh
          ? "从治理记录，认识社区。"
          : "Meet a community through its governance."}
      </h1>
      <p>
        {zh
          ? "输入 Snapshot Space ID，读取真实公开资料。导入页面不是官方组织认领。"
          : "Enter a Snapshot Space ID to explore public data. Imported pages are not official organization claims."}
      </p>
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[a-z0-9][a-z0-9._-]{0,99}$/.test(id)) location.href = route(id);
        }}
      >
        <label className="grow">
          Snapshot Space ID
          <input
            value={id}
            required
            pattern="[a-z0-9][a-z0-9._-]{0,99}"
            placeholder="yam.eth"
            onChange={(e) => setId(e.target.value.toLowerCase())}
          />
        </label>
        <button>{zh ? "读取公开社区" : "Explore space"}</button>
      </form>
      <p>
        {zh ? "试试公开社区：" : "Explore a public space: "}
        <a href="/spaces/yam.eth">yam.eth ↗</a>
      </p>
    </section>
  );
}
