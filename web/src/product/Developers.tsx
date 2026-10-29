export default function Developers({ zh }: { zh: boolean }) {
  return (
    <section className="panel">
      <div className="eyebrow">FACE API / SDK</div>
      <h1>
        {zh
          ? "一次接入，解析钱包资料。"
          : "One integration. Wallet profiles resolved."}
      </h1>
      <p>
        {zh
          ? "原生签名资料 → Snapshot → 可选 ENS；返回原 URI、来源和缓存信息。仅支持链 1。"
          : "Native signed profile → Snapshot → optional ENS. Original URI, source and cache metadata are preserved. Chain 1 only."}
      </p>
      <pre>
        GET /v1/profile/1/0x…{"\n"}GET /v1/avatar/1/0x…{"\n"}GET
        /v1/spaces/yam.eth{"\n"}GET /v1/spaces/yam.eth/members{"\n"}GET
        /v1/spaces/yam.eth/activity
      </pre>
      <pre>
        {
          "const face = new FaceClient('https://your-api.example');\nconst profile = await face.resolveProfile({ chainId: 1, address });\n<WalletFaceAvatar address={address} chainId={1} size={40} />"
        }
      </pre>
      <p>
        {zh
          ? "三个示例仅为本站演示，不代表外部机构采用："
          : "These are first-party demos, not external adoption: "}
      </p>
      <div className="actions">
        <a href="/examples/directory">Directory</a>
        <a href="/examples/governance">Governance authors</a>
        <a href="/examples/wallet">Wallet app</a>
      </div>
      <p>
        <a href="https://github.com/CryptographyBloke/Face/tree/feature/face-spaces-mvp/packages/sdk">
          {zh ? "SDK 源码与发布说明" : "SDK source and packaging instructions"}{" "}
          ↗
        </a>
      </p>
    </section>
  );
}
