import type { BrandingContext, BrandingModule, BrandingSignerHost } from "@1shotapi/ows-branding-core";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
} from "@1shotapi/ows-types";
import { showConnectAddressDialog } from "../wallet-setup/dialog.js";

export type AccountConnectStorage = {
  loadCachedEvmAddress: () => EVMAccountAddress | undefined;
  saveCachedAddresses: (
    evm: EVMAccountAddress,
    solana?: import("@1shotapi/ows-types").SolanaAccountAddress,
  ) => void;
};

export type AccountConnectModuleOptions = {
  storage: AccountConnectStorage;
  ensureReady: () => Promise<void>;
  signer: BrandingSignerHost;
  dialogContainer?: HTMLElement;
};

export function createAccountConnectModule(
  options: AccountConnectModuleOptions,
): BrandingModule {
  return {
    name: "account-connect",
    phase: "pre-start",
    install(ctx: BrandingContext): void {
      ctx.wallet.registerEip1193("eth_accounts", async () => {
        const cached = options.storage.loadCachedEvmAddress();
        if (cached) {
          return [cached];
        }
        return [];
      });

      ctx.wallet.registerEip1193("eth_requestAccounts", async () => {
        const cached = options.storage.loadCachedEvmAddress();
        if (cached) {
          return [cached];
        }

        const display = await ctx.wallet.requestDisplay({ width: 420, height: 360 });
        try {
          const approved = await showConnectAddressDialog({
            container: options.dialogContainer,
          });
          if (!approved) {
            throw new OwsUserRejectedError(
              "User rejected the account connection request",
            );
          }

          await options.ensureReady();
          const evm = await options.signer.evm.getAccountAddress();
          const solana = await options.signer.solana.getAccountAddress();
          options.storage.saveCachedAddresses(evm, solana);
          return [evm];
        } finally {
          await display.hide();
        }
      });
    },
  };
}
