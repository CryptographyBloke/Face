import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getWallets } from "@wallet-standard/app";
import { connectWallet, disconnectWallet, restoreWallet } from "../wallet";
import {
  discoverEvmWallets,
  subscribeEvmWallets,
  type EvmWalletOption,
} from "../wallets";

export type ConnectedWallet = Awaited<ReturnType<typeof connectWallet>>;
type State = "restoring" | "connecting" | "connected" | "disconnected";
type StandardWallet = ReturnType<ReturnType<typeof getWallets>["get"]>[number];
type SolanaConnection = {
  address: string;
  name: string;
  wallet: StandardWallet;
};
type SolanaConnectFeature = {
  connect: (options?: { silent?: boolean }) => Promise<{
    accounts: readonly { address: string }[];
  }>;
};
type SolanaDisconnectFeature = { disconnect: () => Promise<void> };
type SolanaEventsFeature = {
  on: (
    event: "change",
    listener: (change: { accounts?: readonly { address: string }[] }) => void,
  ) => () => void;
};
const SOLANA_CHAIN_PREFIX = "solana:";
const isSolanaWallet = (wallet: StandardWallet) =>
  wallet.chains.some((chain) => chain.startsWith(SOLANA_CHAIN_PREFIX)) &&
  typeof (
    wallet.features["standard:connect"] as SolanaConnectFeature | undefined
  )?.connect === "function";

const Context = createContext<{
  wallet: ConnectedWallet | null;
  wallets: EvmWalletOption[];
  solanaWallets: StandardWallet[];
  solana: SolanaConnection | null;
  status: State;
  error: string;
  chainId: string;
  connect: (walletId?: string) => Promise<ConnectedWallet>;
  connectSolana: (wallet: StandardWallet) => Promise<void>;
  disconnect: () => Promise<void>;
  disconnectSolana: () => Promise<void>;
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

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* Optional browser storage. */
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [wallets, setWallets] = useState<EvmWalletOption[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<EvmWalletOption | null>(
    null,
  );
  const [solanaWallets, setSolanaWallets] = useState<StandardWallet[]>([]);
  const [solana, setSolana] = useState<SolanaConnection | null>(null);
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
  const selectedRef = useRef<EvmWalletOption | null>(null);
  const solanaRef = useRef<SolanaConnection | null>(null);
  const pendingConnect = useRef<Promise<ConnectedWallet> | null>(null);
  const setCurrent = (next: ConnectedWallet | null) => {
    current.current = next;
    setWallet(next);
  };
  const setSolanaCurrent = (next: SolanaConnection | null) => {
    solanaRef.current = next;
    setSolana(next);
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeEvmWallets(setWallets);
    const restore = async () => {
      const generation = ++epoch.current;
      try {
        const available = await discoverEvmWallets();
        if (!active || generation !== epoch.current) return;
        setWallets(available);
        if (isLoggedOut()) {
          setStatus("disconnected");
          return;
        }
        const savedId = readStored("wallet-face:evm-wallet");
        const option =
          available.find((candidate) => candidate.storageKey === savedId) ||
          (savedId ? null : available[0]) ||
          (available.length === 1 ? available[0] : null);
        if (!option) {
          setStatus("disconnected");
          return;
        }
        selectedRef.current = option;
        setSelectedWallet(option);
        const chain = await option.provider.request({ method: "eth_chainId" });
        if (active && generation === epoch.current)
          setChain(typeof chain === "string" ? chain : "");
        const next = await restoreWallet(option);
        if (!active || generation !== epoch.current) return;
        if (next) writeStored("wallet-face:evm-wallet", option.storageKey);
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
    void restore();
    return () => {
      active = false;
      ++epoch.current;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedWallet) return;
    let active = true;
    const provider = selectedWallet.provider;
    const accounts = () => {
      const generation = ++epoch.current;
      if (isLoggedOut()) {
        setCurrent(null);
        setStatus("disconnected");
        return;
      }
      void restoreWallet(selectedWallet)
        .then((next) => {
          if (!active || generation !== epoch.current) return;
          setCurrent(next);
          setStatus(next ? "connected" : "disconnected");
        })
        .catch(() => {
          if (active && generation === epoch.current) {
            setCurrent(null);
            setStatus("disconnected");
          }
        });
    };
    const disconnected = () => {
      ++epoch.current;
      setCurrent(null);
      setChain("");
      setStatus("disconnected");
    };
    const chain = (id: unknown) => setChain(typeof id === "string" ? id : "");
    void provider
      .request({ method: "eth_chainId" })
      .then(chain)
      .catch(() => {});
    provider.on?.("accountsChanged", accounts);
    provider.on?.("chainChanged", chain);
    provider.on?.("disconnect", disconnected);
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", accounts);
      provider.removeListener?.("chainChanged", chain);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [selectedWallet]);

  useEffect(() => {
    const registry = getWallets();
    const sync = () => {
      const available = registry.get().filter(isSolanaWallet);
      setSolanaWallets(available);
      const connected = solanaRef.current;
      if (connected) {
        const stillAvailable = available.find(
          (item) => item === connected.wallet,
        );
        if (!stillAvailable) setSolanaCurrent(null);
        else {
          const address = stillAvailable.accounts[0]?.address;
          if (address) setSolanaCurrent({ ...connected, address });
        }
      } else if (!isLoggedOut()) {
        const savedName = readStored("wallet-face:solana-wallet");
        const saved = available.find((item) => item.name === savedName);
        const address = saved?.accounts[0]?.address;
        if (saved && address)
          setSolanaCurrent({ wallet: saved, name: saved.name, address });
      }
    };
    const offRegister = registry.on("register", sync);
    const offUnregister = registry.on("unregister", sync);
    sync();
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  useEffect(() => {
    if (!solana) return;
    const events = solana.wallet.features["standard:events"] as
      | SolanaEventsFeature
      | undefined;
    if (!events?.on) return;
    return events.on("change", (change) => {
      const account = change.accounts?.[0] || solana.wallet.accounts[0];
      if (account) setSolanaCurrent({ ...solana, address: account.address });
      else setSolanaCurrent(null);
    });
  }, [solana]);

  const connect = (walletId?: string) => {
    const option =
      wallets.find((candidate) => candidate.id === walletId) ||
      selectedRef.current ||
      wallets[0];
    if (
      current.current &&
      (!walletId || current.current.providerId === walletId)
    )
      return Promise.resolve(current.current);
    if (pendingConnect.current) return pendingConnect.current;
    const generation = ++epoch.current;
    setError("");
    setStatus("connecting");
    const promise = connectWallet(option)
      .then((next) => {
        if (generation !== epoch.current)
          throw new Error("Wallet account changed. Connect again.");
        try {
          sessionStorage.removeItem("wallet-face:logged-out");
        } catch {
          /* Optional browser storage. */
        }
        selectedRef.current = option || null;
        setSelectedWallet(option || null);
        if (option) writeStored("wallet-face:evm-wallet", option.storageKey);
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

  const connectSolana = async (candidate: StandardWallet) => {
    if (!isSolanaWallet(candidate))
      throw new Error(
        "This wallet does not support the Solana connect feature.",
      );
    const feature = candidate.features[
      "standard:connect"
    ] as SolanaConnectFeature;
    const result = await feature.connect();
    const account = result.accounts[0] || candidate.accounts[0];
    if (!account) throw new Error("Solana wallet did not return an account.");
    writeStored("wallet-face:solana-wallet", candidate.name);
    setSolanaCurrent({
      wallet: candidate,
      name: candidate.name,
      address: account.address,
    });
  };

  const disconnectSolana = async () => {
    const connected = solanaRef.current;
    setSolanaCurrent(null);
    writeStored("wallet-face:solana-wallet", null);
    const feature = connected?.wallet.features["standard:disconnect"] as
      | SolanaDisconnectFeature
      | undefined;
    try {
      await feature?.disconnect?.();
    } catch {
      // Clearing this app's connection is sufficient for wallets without it.
    }
  };

  const disconnect = async () => {
    ++epoch.current;
    const provider = selectedRef.current?.provider;
    setCurrent(null);
    setChain("");
    setStatus("disconnected");
    setError("");
    setPublishedAvatar(null);
    selectedRef.current = null;
    setSelectedWallet(null);
    writeStored("wallet-face:evm-wallet", null);
    try {
      sessionStorage.setItem("wallet-face:logged-out", "1");
    } catch {
      /* Optional browser storage. */
    }
    await disconnectWallet(provider);
    await disconnectSolana();
  };

  return (
    <Context.Provider
      value={{
        wallet,
        wallets,
        solanaWallets,
        solana,
        status,
        error,
        chainId,
        connect,
        connectSolana,
        disconnect,
        disconnectSolana,
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
