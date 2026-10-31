import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { connectWallet, disconnectWallet, restoreWallet } from "../wallet";
export type ConnectedWallet = Awaited<ReturnType<typeof connectWallet>>;
type State = "restoring" | "connecting" | "connected" | "disconnected";
const Context = createContext<{
  wallet: ConnectedWallet | null;
  status: State;
  error: string;
  chainId: string;
  connect: () => Promise<ConnectedWallet>;
  disconnect: () => Promise<void>;
  refreshAvatar: (uri?: string, address?: string) => void;
  avatarRevision: number;
  publishedAvatar: { address: string; uri: string } | null;
} | null>(null);
const isLoggedOut = () => {
  try {
    return sessionStorage.getItem("wallet-face:logged-out") === "1";
  } catch {
    return false;
  }
};
export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [status, setStatus] = useState<State>("restoring");
  const [error, setError] = useState("");
  const [chainId, setChain] = useState("");
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [publishedAvatar, setPublishedAvatar] = useState<{
    address: string;
    uri: string;
  } | null>(null);
  const epoch = useRef(0);
  const current = useRef<ConnectedWallet | null>(null);
  const pendingConnect = useRef<Promise<ConnectedWallet> | null>(null);
  const setCurrent = (next: ConnectedWallet | null) => {
    current.current = next;
    setWallet(next);
  };
  useEffect(() => {
    let active = true;
    const provider = window.ethereum;
    const restore = async () => {
      const generation = ++epoch.current;
      if (isLoggedOut()) {
        setStatus("disconnected");
        return;
      }
      try {
        const next = await restoreWallet();
        if (!active || generation !== epoch.current) return;
        setCurrent(next);
        setStatus(next ? "connected" : "disconnected");
        setError("");
      } catch {
        if (active && generation === epoch.current) {
          setCurrent(null);
          setStatus("disconnected");
        }
      }
    };
    const accounts = () => {
      setCurrent(null);
      void restore();
    };
    const disconnected = () => {
      ++epoch.current;
      setCurrent(null);
      setChain("");
      setStatus("disconnected");
    };
    const chain = (id: unknown) => setChain(typeof id === "string" ? id : "");
    void restore();
    void provider
      ?.request({ method: "eth_chainId" })
      .then((id) => {
        if (active) chain(id);
      })
      .catch(() => {});
    provider?.on?.("accountsChanged", accounts);
    provider?.on?.("chainChanged", chain);
    provider?.on?.("disconnect", disconnected);
    return () => {
      active = false;
      ++epoch.current;
      provider?.removeListener?.("accountsChanged", accounts);
      provider?.removeListener?.("chainChanged", chain);
      provider?.removeListener?.("disconnect", disconnected);
    };
  }, []);
  const connect = () => {
    if (current.current) return Promise.resolve(current.current);
    if (pendingConnect.current) return pendingConnect.current;
    const generation = ++epoch.current;
    setError("");
    setStatus("connecting");
    const promise = connectWallet()
      .then((next) => {
        if (generation !== epoch.current)
          throw new Error("Wallet account changed. Connect again.");
        try {
          sessionStorage.removeItem("wallet-face:logged-out");
        } catch {
          /* Optional browser storage. */
        }
        setCurrent(next);
        setStatus("connected");
        return next;
      })
      .catch((cause) => {
        if (generation === epoch.current) {
          setError((cause as Error).message);
          setStatus("disconnected");
        }
        throw cause;
      })
      .finally(() => {
        pendingConnect.current = null;
      });
    pendingConnect.current = promise;
    return promise;
  };
  const disconnect = async () => {
    ++epoch.current;
    setCurrent(null);
    setChain("");
    setStatus("disconnected");
    setError("");
    setPublishedAvatar(null);
    try {
      sessionStorage.setItem("wallet-face:logged-out", "1");
    } catch {
      /* Optional browser storage. */
    }
    await disconnectWallet();
  };
  return (
    <Context.Provider
      value={{
        wallet,
        status,
        error,
        chainId,
        connect,
        disconnect,
        avatarRevision,
        publishedAvatar,
        refreshAvatar: (uri, address) => {
          if (uri && address) setPublishedAvatar({ uri, address });
          setAvatarRevision((n) => n + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWallet() {
  const value = useContext(Context);
  if (!value) throw new Error("WalletProvider is required");
  return value;
}
