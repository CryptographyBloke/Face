interface EthereumProvider {
  request(args: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isOKXWallet?: boolean;
  isOkxWallet?: boolean;
  isBinance?: boolean;
  isBinanceWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isCoinbase?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isBitKeep?: boolean;
  isBitgetWallet?: boolean;
  isPhantom?: boolean;
  isTokenPocket?: boolean;
  isMathWallet?: boolean;
  isExodus?: boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}
