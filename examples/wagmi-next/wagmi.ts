import { oneShotWallet } from "@1shotapi/wagmi-connector";
import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { base, baseSepolia, mainnet, zora } from "wagmi/chains";

export const WALLET_URL =
  process.env.NEXT_PUBLIC_WALLET_URL ?? "https://wallet.1shotapi.com";

/**
 * `zora` is deliberately not supported by the 1Shot Wallet: switching to it
 * shows the unsupported-chain `SwitchChainError`.
 */
export const config = createConfig({
  chains: [base, baseSepolia, mainnet, zora],
  connectors: [oneShotWallet({ walletUrl: WALLET_URL })],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [mainnet.id]: http(),
    [zora.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
