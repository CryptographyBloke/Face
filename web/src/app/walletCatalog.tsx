import type { IconComponent } from "@web3icons/react";
import WalletBackpack from "@web3icons/react/icons/wallets/WalletBackpack";
import WalletCoinbase from "@web3icons/react/icons/wallets/WalletCoinbase";
import WalletEnkrypt from "@web3icons/react/icons/wallets/WalletEnkrypt";
import WalletExodus from "@web3icons/react/icons/wallets/WalletExodus";
import WalletGlow from "@web3icons/react/icons/wallets/WalletGlow";
import WalletImtoken from "@web3icons/react/icons/wallets/WalletImtoken";
import WalletMetamask from "@web3icons/react/icons/wallets/WalletMetamask";
import WalletOkx from "@web3icons/react/icons/wallets/WalletOkx";
import WalletPhantom from "@web3icons/react/icons/wallets/WalletPhantom";
import WalletRabby from "@web3icons/react/icons/wallets/WalletRabby";
import WalletRainbow from "@web3icons/react/icons/wallets/WalletRainbow";
import WalletSolflare from "@web3icons/react/icons/wallets/WalletSolflare";
import WalletTokenPocket from "@web3icons/react/icons/wallets/WalletTokenPocket";
import WalletTrust from "@web3icons/react/icons/wallets/WalletTrust";
import WalletZerion from "@web3icons/react/icons/wallets/WalletZerion";
import ExchangeBinance from "@web3icons/react/icons/exchanges/ExchangeBinance";
import ExchangeBitget from "@web3icons/react/icons/exchanges/ExchangeBitget";
import { Icon } from "../ui/Icon";

export type WalletBrand = {
  id: string;
  name: string;
  aliases: string[];
  icon?: IconComponent;
};

export const EVM_WALLET_BRANDS: WalletBrand[] = [
  {
    id: "metamask",
    name: "MetaMask",
    aliases: ["metamask", "io.metamask"],
    icon: WalletMetamask,
  },
  {
    id: "okx",
    name: "OKX Wallet",
    aliases: ["okx", "okxwallet", "com.okex.wallet"],
    icon: WalletOkx,
  },
  {
    id: "binance",
    name: "Binance Wallet",
    aliases: ["binance", "binancewallet", "com.binance.wallet"],
    icon: ExchangeBinance,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    aliases: ["coinbase", "coinbasewallet", "com.coinbase.wallet"],
    icon: WalletCoinbase,
  },
  {
    id: "rabby",
    name: "Rabby",
    aliases: ["rabby", "io.rabby"],
    icon: WalletRabby,
  },
  {
    id: "bitget",
    name: "Bitget Wallet",
    aliases: ["bitget", "bitgetwallet", "bitkeep"],
    icon: ExchangeBitget,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    aliases: ["trust", "trustwallet"],
    icon: WalletTrust,
  },
  {
    id: "tokenpocket",
    name: "TokenPocket",
    aliases: ["tokenpocket", "io.tokenpocket"],
    icon: WalletTokenPocket,
  },
  {
    id: "phantom",
    name: "Phantom",
    aliases: ["phantom", "app.phantom"],
    icon: WalletPhantom,
  },
  {
    id: "backpack",
    name: "Backpack",
    aliases: ["backpack", "xnft"],
    icon: WalletBackpack,
  },
  {
    id: "exodus",
    name: "Exodus",
    aliases: ["exodus", "exodus.web3"],
    icon: WalletExodus,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    aliases: ["rainbow", "me.rainbow"],
    icon: WalletRainbow,
  },
  {
    id: "imtoken",
    name: "imToken",
    aliases: ["imtoken", "im.token"],
    icon: WalletImtoken,
  },
  {
    id: "mathwallet",
    name: "MathWallet",
    aliases: ["mathwallet", "com.mathwallet"],
  },
  {
    id: "zerion",
    name: "Zerion",
    aliases: ["zerion"],
    icon: WalletZerion,
  },
  {
    id: "enkrypt",
    name: "Enkrypt",
    aliases: ["enkrypt"],
    icon: WalletEnkrypt,
  },
];

export const SOLANA_WALLET_BRANDS: WalletBrand[] = [
  {
    id: "phantom",
    name: "Phantom",
    aliases: ["phantom", "app.phantom"],
    icon: WalletPhantom,
  },
  {
    id: "solflare",
    name: "Solflare",
    aliases: ["solflare"],
    icon: WalletSolflare,
  },
  {
    id: "backpack",
    name: "Backpack",
    aliases: ["backpack", "x nft"],
    icon: WalletBackpack,
  },
  {
    id: "glow",
    name: "Glow",
    aliases: ["glow"],
    icon: WalletGlow,
  },
];

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function findWalletBrand(
  brands: WalletBrand[],
  name: string,
  rdns = "",
) {
  const values = [normalize(name), normalize(rdns)];
  return brands.find((brand) =>
    brand.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      return values.some(
        (value) =>
          value === normalizedAlias ||
          (value.length > normalizedAlias.length &&
            value.startsWith(normalizedAlias)),
      );
    }),
  );
}

export function WalletBrandIcon({
  brand,
  className,
}: {
  brand: WalletBrand;
  className?: string;
}) {
  const Mark = brand.icon;
  if (!Mark)
    return (
      <span
        className={className}
        data-wallet-brand={brand.id}
        aria-hidden="true"
      >
        <Icon name="wallet" size={24} />
      </span>
    );
  return (
    <Mark
      size={30}
      variant="branded"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-wallet-brand={brand.id}
    />
  );
}
