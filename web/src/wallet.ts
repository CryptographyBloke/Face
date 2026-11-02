import { createWalletClient, custom, getAddress, type Address } from "viem";
import { discoverEvmWallets, type EvmWalletOption } from "./wallets";

function createConnectedWallet(account: string, option: EvmWalletOption) {
  const address = getAddress(account);
  const walletClient = createWalletClient({
    account: address,
    transport: custom(option.provider),
  });

  return {
    address,
    walletClient,
    provider: option.provider,
    providerId: option.id,
    providerName: option.name,
  };
}

async function getOption(option?: EvmWalletOption) {
  const selected = option || (await discoverEvmWallets())[0];
  if (!selected) {
    throw new Error(
      "No EVM wallet found. Install MetaMask, OKX Wallet, Binance Wallet, Rabby, or another browser wallet.",
    );
  }
  return selected;
}

export async function connectWallet(option?: EvmWalletOption) {
  const selected = await getOption(option);
  const accounts = (await selected.provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts?.[0]) throw new Error("Wallet did not return an account.");

  return createConnectedWallet(accounts[0], selected);
}

/** Restore an already-authorized wallet without opening a prompt. */
export async function restoreWallet(option: EvmWalletOption) {
  const accounts = (await option.provider.request({
    method: "eth_accounts",
  })) as string[];

  return accounts?.[0] ? createConnectedWallet(accounts[0], option) : null;
}

/** Clear the selected provider session; local logout works for all wallets. */
export async function disconnectWallet(provider?: EthereumProvider) {
  if (!provider) return;

  try {
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Local logout remains valid for wallets without permission revocation.
  }
}

export type AppWalletClient = Awaited<
  ReturnType<typeof connectWallet>
>["walletClient"];
export type WalletAddress = Address;
export type ConnectedWallet = Awaited<ReturnType<typeof connectWallet>>;
