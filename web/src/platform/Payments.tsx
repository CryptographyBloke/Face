import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePreferences } from "../app/Preferences";
import { useWallet } from "../app/WalletProvider";
import { WalletSession, usePlatformSession } from "./client";
import { Modal } from "../ui/primitives";
import { PaymentRequiredV2Schema } from "@x402/core/schemas";
import type { PaymentRequired, PaymentPayload } from "@x402/core/types";
import {
  decodePaymentRequiredHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import "./platform.css";
type Status = {
  enabled: boolean;
  network: string;
  asset: string;
  amount: string;
  receiver: string | null;
  missing: string[];
  mainnetEnabled: false;
};
type Receipt = {
  id: string;
  state: string;
  settlementVerified?: boolean;
  network: string;
  asset: string;
  amount: string;
  receiver: string;
  payer: string;
  transactionHash?: string | null;
  transaction_hash?: string | null;
  chainEvidence?: { sourceUrl?: string };
  delivery?: string;
};
const ASSET = "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  NETWORK = "eip155:84532";
export default function Payments() {
  const { t } = usePreferences(),
    { wallet } = useWallet(),
    { token } = usePlatformSession();
  const [status, setStatus] = useState<Status | null>(null),
    [space, setSpace] = useState("ens.eth"),
    [offer, setOffer] = useState<PaymentRequired | null>(null),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      receipt: Receipt;
      report?: unknown;
      message?: string;
    } | null>(null),
    [items, setItems] = useState<Receipt[]>([]),
    [pending, setPending] = useState<{
      url: string;
      payload: PaymentPayload;
    } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/v1/payments/status")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.enabled !== "boolean" || !Array.isArray(d.missing))
          throw Error("Invalid payment status response");
        if (active) setStatus(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setItems([]);
    if (!token) return;
    let active = true;
    fetch("/v1/payments/receipts", {
      headers: { Authorization: "Bearer " + token },
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error?.message || "Receipt lookup failed");
        if (active) setItems(d.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const quote = async () => {
    setError("");
    setResult(null);
    setOffer(null);
    setPending(null);
    setBusy(true);
    try {
      if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(space))
        throw Error(t("请输入有效 Space ID。", "Enter a valid Space ID."));
      const url =
          "/v1/payments/report?spaceId=" +
          encodeURIComponent(space) +
          "&requestId=" +
          crypto.randomUUID(),
        r = await fetch(url),
        d = await r.json();
      if (r.status !== 402)
        throw Error(d.error?.message || "Payment offer unavailable");
      const header = r.headers.get("PAYMENT-REQUIRED");
      if (!header) throw Error("PAYMENT-REQUIRED missing");
      const q = PaymentRequiredV2Schema.parse(
          decodePaymentRequiredHeader(header),
        ),
        a = q.accepts[0];
      if (
        q.x402Version !== 2 ||
        q.accepts.length !== 1 ||
        a.network !== NETWORK ||
        a.asset.toLowerCase() !== ASSET.toLowerCase() ||
        a.amount !== "1000" ||
        a.payTo.toLowerCase() !== status?.receiver?.toLowerCase() ||
        a.scheme !== "exact" ||
        a.extra?.assetTransferMethod !== "eip3009" ||
        a.maxTimeoutSeconds > 120 ||
        q.resource.url !== location.origin + url
      )
        throw Error(
          t(
            "报价与固定测试网配置不一致。",
            "Offer differs from the fixed testnet configuration.",
          ),
        );
      setOffer({
        ...q,
        accepts: [{ ...a, network: NETWORK, extra: a.extra || {} }],
        extensions: q.extensions || undefined,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submit = async (url: string, payload: PaymentPayload) => {
    const r = await fetch(url, {
        headers: { "PAYMENT-SIGNATURE": encodePaymentSignatureHeader(payload) },
      }),
      d = await r.json();
    if (!d.receipt) throw Error(d.error?.message || "Payment unavailable");
    setResult(d);
    if (r.status === 200) setPending(null);
  };
  const pay = async () => {
    if (!offer || !wallet) return;
    setError("");
    setBusy(true);
    try {
      if ((await wallet.walletClient.getChainId()) !== 84532)
        throw Error(
          t(
            "请在钱包中切换到 Base Sepolia 测试网。",
            "Switch your wallet to Base Sepolia testnet.",
          ),
        );
      const a = offer.accepts[0],
        client = new x402Client().register(
          NETWORK,
          new ExactEvmScheme({
            address: wallet.address,
            signTypedData: async (data) => {
              // The wallet remains the human approval boundary; no signer is exposed to Copilot.
              if (
                data.domain.chainId !== 84532 ||
                String(data.domain.verifyingContract).toLowerCase() !==
                  ASSET.toLowerCase() ||
                data.primaryType !== "TransferWithAuthorization" ||
                String(data.message.from).toLowerCase() !==
                  wallet.address.toLowerCase() ||
                String(data.message.to).toLowerCase() !==
                  a.payTo.toLowerCase() ||
                BigInt(String(data.message.value)) !== 1000n ||
                BigInt(String(data.message.validBefore)) >
                  BigInt(Math.floor(Date.now() / 1000) + 125)
              )
                throw Error("Signing policy rejected payment");
              return wallet.walletClient.signTypedData({
                ...data,
                account: wallet.address,
              });
            },
          }),
        );
      const payload = await client.createPaymentPayload(offer);
      const url = new URL(offer.resource.url);
      if (url.origin !== location.origin)
        throw Error("Payment resource origin changed");
      setPending({ url: url.pathname + url.search, payload });
      setReview(false);
      await submit(url.pathname + url.search, payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="platform-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">x402 v2 · BASE SEPOLIA</p>
          <h1>{t("Agent 支付测试", "Agent payments testnet")}</h1>
          <p>
            {t(
              "按次获取可核验的公开治理报表。每笔支付先展示价格，再由钱包确认。",
              "Retrieve a verifiable public governance report per call. Review each price and approve in your wallet.",
            )}
          </p>
        </div>
        <Link to="/my-agents">{t("我的 Agents", "My Agents")} →</Link>
      </header>
      <div className="panel">
        <h2>{t("测试网状态", "Testnet status")}</h2>
        <p>
          {!status
            ? t("正在读取测试网状态…", "Loading testnet status…")
            : status.enabled
              ? t("测试网收款可用", "Testnet receiving enabled")
              : t("测试网执行待配置", "Testnet execution awaits configuration")}
        </p>
        <p>
          {t("本次报表报价", "Report price")}: 0.001 test USDC (1000 atomic
          units)
        </p>
        <p className="break-address">
          {t("网络 / 资产", "Network / asset")}: {NETWORK} / {ASSET}
        </p>
        <p className="break-address">
          {t("收款方", "Receiver")}:{" "}
          {status?.receiver || t("待配置", "Not configured")}
        </p>
        <p>
          {t(
            "主网支付关闭。报表计算不调用付费模型。",
            "Mainnet payments are disabled. Report computation uses no paid model calls.",
          )}
        </p>
        {!!status?.missing.length && (
          <p>
            {t("待配置", "Missing")}: {status.missing.join(", ")}
          </p>
        )}
      </div>
      <div className="panel form">
        <label>
          Snapshot Space ID
          <input
            value={space}
            maxLength={100}
            onChange={(e) => setSpace(e.target.value)}
          />
        </label>
        <button
          disabled={!status?.enabled || busy}
          onClick={() => void quote()}
        >
          {busy
            ? t("处理中…", "Working…")
            : t("获取测试网报价", "Get testnet offer")}
        </button>
        {offer && (
          <>
            <p>
              {t(
                "报价有效期为 10 分钟，付款签名最长有效 120 秒。",
                "Offers expire in 10 minutes; payment signatures last at most 120 seconds.",
              )}
            </p>
            <button disabled={busy || !wallet} onClick={() => setReview(true)}>
              {t("审核付款", "Review payment")}
            </button>
            {!wallet && (
              <p>
                {t(
                  "先连接付款钱包，再审核付款。",
                  "Connect the paying wallet to review payment.",
                )}
              </p>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {pending && (
          <button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              submit(pending.url, pending.payload)
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            {t(
              "查询同一授权的结算与交付",
              "Check this authorization and delivery",
            )}
          </button>
        )}
      </div>
      {result && (
        <article className="panel">
          <h2>{t("支付与交付记录", "Payment and delivery record")}</h2>
          <p>
            {result.receipt.state} ·{" "}
            {result.receipt.settlementVerified
              ? t("链上结算已核验", "On-chain settlement checked")
              : t("结算待核对", "Settlement awaits reconciliation")}
          </p>
          <p>{result.message}</p>
          {result.receipt.chainEvidence?.sourceUrl && (
            <a
              href={result.receipt.chainEvidence.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("查看 Base Sepolia 交易", "View Base Sepolia transaction")}
            </a>
          )}
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </article>
      )}
      <div className="panel">
        <h2>{t("我的支付记录", "My payment records")}</h2>
        <WalletSession />
        {items.map((r) => (
          <p key={r.id}>
            {r.id} · {r.state} · {r.amount} atomic USDC{" "}
            {r.transaction_hash && (
              <a
                href={"https://sepolia.basescan.org/tx/" + r.transaction_hash}
                target="_blank"
                rel="noreferrer"
              >
                {t("交易", "Transaction")}
              </a>
            )}
          </p>
        ))}
      </div>
      {review && offer && (
        <Modal
          title={t("审核测试网付款", "Review testnet payment")}
          onClose={() => setReview(false)}
        >
          <p>
            {t("服务：公开治理报表", "Service: public governance report")} ·{" "}
            {space}
          </p>
          <p>0.001 test USDC · Base Sepolia</p>
          <p className="break-address">
            {t("付款钱包", "Paying wallet")}: {wallet?.address}
          </p>
          <p className="break-address">
            {t("收款方", "Receiver")}: {offer.accepts[0].payTo}
          </p>
          <p>
            {t(
              "钱包将签署短期 EIP-3009 付款授权。结算后可用同一授权重取报表。",
              "Your wallet signs a short-lived EIP-3009 payment authorization. The same authorization can retrieve the settled report again.",
            )}
          </p>
          <button disabled={busy || !wallet} onClick={() => void pay()}>
            {t("在钱包中确认测试网付款", "Confirm testnet payment in wallet")}
          </button>
        </Modal>
      )}
    </section>
  );
}
