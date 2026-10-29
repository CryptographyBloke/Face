import { useState } from "react";
import { api } from "./shared";
import { DaoDirectory } from "../../../examples/directory";
import { ProposalAuthor } from "../../../examples/governance";
import { WalletAccount } from "../../../examples/wallet";
export default function Examples({ kind, zh }: { kind: string; zh: boolean }) {
  const [input, setInput] = useState("");
  const [addr, setAddr] = useState("");
  return (
    <section className="panel">
      <h1>
        {kind} · {zh ? "真实 API 示例" : "Live API example"}
      </h1>
      <p>
        {zh
          ? "输入真实钱包地址，组件将调用 Face Resolver；这是本站演示，不是外部客户案例。"
          : "Enter a real wallet address. This component calls the Face resolver; this is a first-party demo, not a customer integration."}
      </p>
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault();
          setAddr(input);
        }}
      >
        <label>
          {zh ? "钱包地址" : "Wallet address"}
          <input
            pattern="0x[0-9a-fA-F]{40}"
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button>{zh ? "解析" : "Resolve"}</button>
      </form>
      {addr &&
        (kind === "directory" ? (
          <DaoDirectory addresses={[addr]} apiUrl={api.baseUrl} />
        ) : kind === "governance" ? (
          <ProposalAuthor
            address={addr}
            title="Example author card — address supplied by visitor"
            apiUrl={api.baseUrl}
          />
        ) : (
          <WalletAccount address={addr} apiUrl={api.baseUrl} />
        ))}
    </section>
  );
}
