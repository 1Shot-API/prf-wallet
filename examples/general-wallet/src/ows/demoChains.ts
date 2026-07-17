import { EVMChainId } from "@1shotapi/ows-types";

/** Demo chains for the branding-layer chain dropdown (fed into RpcHelper). */
export const DEMO_CHAINS: ReadonlyArray<{
  chainId: EVMChainId;
  label: string;
  rpcUrl: string;
  /** Base URL for tx/address explorer links (no trailing slash). */
  blockExplorerUrl: string;
}> = [
  {
    chainId: EVMChainId("0xaa36a7"), // 11155111
    label: "Sepolia",
    rpcUrl: "https://sepolia.drpc.org",
    blockExplorerUrl: "https://sepolia.etherscan.io",
  },
  {
    chainId: EVMChainId("0x14a34"), // 84532
    label: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorerUrl: "https://sepolia.basescan.org",
  },
  {
    chainId: EVMChainId("0x4cef52"), // 5042002
    label: "Arc Testnet",
    rpcUrl: "https://rpc.testnet.arc.network",
    blockExplorerUrl: "https://testnet.arcscan.app",
  },
];
