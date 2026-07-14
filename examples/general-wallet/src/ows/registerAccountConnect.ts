import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";

export type AccountConnectStorage = {
  loadCachedEvmAddress: () => EVMAccountAddress | undefined;
  saveCachedAddresses: (
    evm: EVMAccountAddress,
    solana?: SolanaAccountAddress,
  ) => void;
};

export type RegisterAccountConnectOptions = {
  storage: AccountConnectStorage;
  ensureReady: () => Promise<void>;
  requestConnectApproval: () => Promise<boolean>;
};

/**
 * Register `eth_accounts` / `eth_requestAccounts` on the wallet (pre-`start()`).
 */
export function registerAccountConnect(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterAccountConnectOptions,
): void {
  wallet.registerEip1193("eth_accounts", async () => {
    const cached = options.storage.loadCachedEvmAddress();
    if (cached) {
      return [cached];
    }
    return [];
  });

  wallet.registerEip1193("eth_requestAccounts", async () => {
    const cached = options.storage.loadCachedEvmAddress();
    if (cached) {
      return [cached];
    }

    const display = await wallet.requestDisplay({ width: 420, height: 360 });
    try {
      const approved = await options.requestConnectApproval();
      if (!approved) {
        throw new OwsUserRejectedError(
          "User rejected the account connection request",
        );
      }

      await options.ensureReady();
      const evm = await signer.evm.getAccountAddress();
      const solana = await signer.solana.getAccountAddress();
      options.storage.saveCachedAddresses(evm, solana);
      return [evm];
    } finally {
      await display.hide();
    }
  });
}
