import type {
  EVMAccountAddress,
  EVMChainId,
  EVMSignatureHex,
} from "../primitives/index.js";

/**
 * Typed EIP-1193 methods supported by host `EIP1193Provider.request`.
 * Add entries here (with branded params/results) instead of casting at call sites.
 */
export type EIP1193Requests = {
  eth_requestAccounts: {
    result: EVMAccountAddress[];
  };
  eth_accounts: {
    result: EVMAccountAddress[];
  };
  eth_chainId: {
    result: EVMChainId;
  };
  personal_sign: {
    params: readonly [message: string, address: EVMAccountAddress];
    result: EVMSignatureHex;
  };
  eth_signTypedData_v4: {
    params: readonly [address: EVMAccountAddress, typedData: unknown];
    result: EVMSignatureHex;
  };
  wallet_switchEthereumChain: {
    params: readonly [{ chainId: EVMChainId }];
    result: null;
  };
};

export type KnownEIP1193Method = keyof EIP1193Requests;

export type EIP1193RequestArgsFor<M extends KnownEIP1193Method> =
  EIP1193Requests[M] extends { params: infer P }
    ? { method: M; params: P }
    : { method: M; params?: readonly [] };

/** Fallback for wallet-specific or not-yet-mapped EIP-1193 methods. */
export type EIP1193RequestArgs = {
  method: string;
  params?: readonly unknown[] | Record<string, unknown>;
};
