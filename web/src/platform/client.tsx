import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Address, Hex } from "viem";
import { api } from "../app/resource";
import { useWallet } from "../app/WalletProvider";
import { usePreferences } from "../app/Preferences";
import { Modal } from "../ui/primitives";
export type JsonRecord = Record<string, unknown>;
type Typed = {
  domain: { name: string; version: string; chainId: number; salt: Hex };
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
};
type Challenge = {
  typedData: Typed;
  payload: unknown;
  endpointControl?: Record<string, unknown>;
};
const Session = createContext<{
  token: string;
  setToken: (value: string) => void;
}>({ token: "", setToken: () => {} });
export function PlatformSession({ children }: { children: ReactNode }) {
  const { wallet } = useWallet();
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken("");
  }, [wallet?.address]);
  return (
    <Session.Provider value={{ token, setToken }}>{children}</Session.Provider>
  );
}
export function usePlatformSession() {
  return useContext(Session);
}
export function platformRequest<T>(path: string, body?: unknown, token = "") {
  return api.request<T>("/v1/platform/" + path, {
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  });
}
export function SignedAction({
  action,
  payload,
  children,
  onDone,
  disabled = false,
}: {
  action: string;
  payload: unknown;
  children: ReactNode;
  onDone?: (result: JsonRecord) => void;
  disabled?: boolean;
}) {
  const { t } = usePreferences();
  const { wallet, connect } = useWallet();
  const session = usePlatformSession();
  const [review, setReview] = useState<Challenge | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [signer, setSigner] = useState<Address | null>(null);
  const prepare = async () => {
    setBusy(true);
    setError("");
    try {
      const w = wallet || (await connect());
      setSigner(w.address);
      const c = await platformRequest<Challenge>("challenge", {
        actor: w.address,
        action,
        payload,
      });
      setReview(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sign = async () => {
    setBusy(true);
    setError("");
    try {
      if (!review || !wallet || wallet.address !== signer)
        throw new Error(
          t("钱包已变化，请重新审核。", "Wallet changed; review again."),
        );
      if ((await wallet.walletClient.getChainId()) !== 1)
        throw new Error(
          t(
            "请在钱包中切换到 Ethereum 主网。",
            "Switch your wallet to Ethereum mainnet.",
          ),
        );
      const signature = await wallet.walletClient.signTypedData({
        ...review.typedData,
        account: wallet.address,
      });
      const result = await platformRequest<JsonRecord>("execute", {
        nonce: review.typedData.message.nonce,
        signature,
        payload: review.payload,
      });
      if (action === "session.create" && typeof result.token === "string")
        session.setToken(result.token);
      setReview(null);
      onDone?.(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void prepare()}
      >
        {busy ? t("处理中…", "Working…") : children}
      </button>
      {error && (
        <p role="alert" className="platform-error">
          {error}
        </p>
      )}
      {review && (
        <Modal
          title={t("审核钱包授权", "Review wallet authorization")}
          onClose={() => {
            if (!busy) setReview(null);
          }}
        >
          <p>
            {t(
              "请核对下列内容。签名只授权本次操作，五分钟后失效。",
              "Review the content below. The signature authorizes this operation only and expires in five minutes.",
            )}
          </p>
          <strong>{action}</strong>
          {review.endpointControl && (
            <>
              <p>
                {t(
                  "先在服务域名发布下列 JSON 到 /.well-known/wallet-face-agent.json，随后签名验证。",
                  "First publish the JSON below at /.well-known/wallet-face-agent.json on your service domain, then sign to verify.",
                )}
              </p>
              <pre>
                {JSON.stringify(
                  { ...review.endpointControl, controller: signer },
                  null,
                  2,
                )}
              </pre>
            </>
          )}
          <pre>{JSON.stringify(review.payload, null, 2)}</pre>
          <p>
            {t("应用域名", "Application origin")}:{" "}
            {review.typedData.message.origin as string}
          </p>
          <button type="button" disabled={busy} onClick={() => void sign()}>
            {t("确认内容并在钱包签名", "Confirm and sign in wallet")}
          </button>
        </Modal>
      )}
    </>
  );
}
export function WalletSession() {
  const { t } = usePreferences();
  const { token, setToken } = usePlatformSession();
  return token ? (
    <button onClick={() => setToken("")}>
      {t("退出工作区", "Lock workspace")}
    </button>
  ) : (
    <SignedAction
      action="session.create"
      payload={{ purpose: "workspace.read" }}
    >
      {t("钱包签名打开私有工作区", "Sign in to private workspace")}
    </SignedAction>
  );
}
