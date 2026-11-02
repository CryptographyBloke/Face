export type EvmWalletOption = {
  id: string;
  storageKey: string;
  name: string;
  icon?: string;
  rdns?: string;
  provider: EthereumProvider;
};

type AnnouncedProvider = {
  info?: {
    uuid?: string;
    name?: string;
    icon?: string;
    rdns?: string;
  };
  provider?: EthereumProvider;
};

const providers: EvmWalletOption[] = [];
const subscribers = new Set<(wallets: EvmWalletOption[]) => void>();
let initialized = false;

function legacyName(provider: EthereumProvider): string {
  const brands: [keyof EthereumProvider, string][] = [
    ["isOKXWallet", "OKX Wallet"],
    ["isOkxWallet", "OKX Wallet"],
    ["isBinanceWallet", "Binance Wallet"],
    ["isBinance", "Binance Wallet"],
    ["isRabby", "Rabby"],
    ["isCoinbaseWallet", "Coinbase Wallet"],
    ["isCoinbase", "Coinbase Wallet"],
    ["isTrustWallet", "Trust Wallet"],
    ["isTrust", "Trust Wallet"],
    ["isBitgetWallet", "Bitget Wallet"],
    ["isBitKeep", "Bitget Wallet"],
    ["isTokenPocket", "TokenPocket"],
    ["isMathWallet", "MathWallet"],
    ["isPhantom", "Phantom"],
    ["isExodus", "Exodus"],
    ["isMetaMask", "MetaMask"],
  ];
  return (
    brands.find(([flag]) => provider[flag] === true)?.[1] || "Browser wallet"
  );
}

function notify() {
  const snapshot = [...providers];
  subscribers.forEach((listener) => listener(snapshot));
}

function addLegacyProviders() {
  const injected = window.ethereum?.providers?.length
    ? window.ethereum.providers
    : window.ethereum
      ? [window.ethereum]
      : [];
  for (const [index, provider] of injected.entries()) {
    if (typeof provider.request !== "function") continue;
    const name = legacyName(provider);
    const id = `injected:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${index}`;
    const option: EvmWalletOption = {
      id,
      storageKey: id,
      name,
      provider,
    };
    const existing = providers.findIndex(
      (wallet) => wallet.provider === provider || wallet.id === id,
    );
    if (existing >= 0) providers[existing] = option;
    else providers.push(option);
  }
}

function onAnnounce(event: Event) {
  const detail = (event as CustomEvent<AnnouncedProvider>).detail;
  const provider = detail?.provider;
  const info = detail?.info;
  if (!provider || typeof provider.request !== "function") return;
  const name = info?.name || legacyName(provider);
  const id = info?.uuid || info?.rdns || `eip6963:${name}`;
  const storageKey = info?.rdns
    ? `rdns:${info.rdns.toLowerCase()}`
    : `name:${name.toLowerCase()}`;
  const option: EvmWalletOption = {
    id,
    storageKey,
    name,
    icon: info?.icon?.startsWith("data:image/") ? info.icon : undefined,
    rdns: info?.rdns,
    provider,
  };
  const existing = providers.findIndex(
    (wallet) =>
      wallet.provider === provider ||
      wallet.id === id ||
      (wallet.id.startsWith("injected:") &&
        (wallet.name === name || wallet.storageKey === storageKey)),
  );
  if (existing >= 0) providers[existing] = option;
  else providers.push(option);
  notify();
}

function ensureRegistry() {
  if (initialized) return;
  initialized = true;
  // EIP-6963 requires this listener to stay active for the page lifetime so
  // wallets injected or announced later are still discovered.
  window.addEventListener("eip6963:announceProvider", onAnnounce);
}

/** Subscribe to the live EIP-6963 wallet registry. */
export function subscribeEvmWallets(
  listener: (wallets: EvmWalletOption[]) => void,
) {
  ensureRegistry();
  subscribers.add(listener);
  listener([...providers]);
  return () => subscribers.delete(listener);
}

/** Discover injected wallets through EIP-6963, with legacy EIP-1193 fallback. */
export async function discoverEvmWallets(
  responseWindow = 180,
): Promise<EvmWalletOption[]> {
  ensureRegistry();
  addLegacyProviders();
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  await new Promise((resolve) => window.setTimeout(resolve, responseWindow));
  addLegacyProviders();
  return [...providers];
}
