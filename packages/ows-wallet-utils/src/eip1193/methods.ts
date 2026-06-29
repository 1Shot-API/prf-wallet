export const EIP1193_METHODS = [
  "eth_requestAccounts",
  "eth_accounts",
  "eth_chainId",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_sendTransaction",
  "eth_signTransaction",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_watchAsset",
] as const;

export type Eip1193Method = (typeof EIP1193_METHODS)[number];

export function isEip1193Method(method: string): method is Eip1193Method {
  return (EIP1193_METHODS as readonly string[]).includes(method);
}
