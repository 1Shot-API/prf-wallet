import type {
  BrandingModule,
  BrandingSignerHost,
  BrandingWalletHost,
} from "@1shotapi/ows-branding-core";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import {
  mountEmbeddedSetupScreen,
  showPasskeyNameDialog,
  showWalletSetupScreen,
} from "./dialog";

export type WalletSetupStorage = {
  isWalletCreated: () => boolean;
  loadCredentialId: () => string | undefined;
  saveWalletCreated: (credentialId: string) => void;
  saveCachedAddresses: (
    evm: EVMAccountAddress,
    solana?: SolanaAccountAddress,
  ) => void;
};

export type WalletSetupModuleOptions = {
  storage: WalletSetupStorage;
  wallet: BrandingWalletHost;
  signer: BrandingSignerHost;
  /** Element to mount embedded setup UI (default `#wallet-onboarding`). */
  embeddedMount?: HTMLElement | string;
  /** Called after unlock or wallet creation succeeds. */
  onUnlocked?: () => void | Promise<void>;
  /** Override dialog mount target. */
  dialogContainer?: HTMLElement;
};

export type WalletSetupModuleResult = {
  module: BrandingModule;
  ensureReady: () => Promise<void>;
  isUnlocked: () => boolean;
  setUnlocked: (value: boolean) => void;
};

export function createWalletSetupModule(
  options: WalletSetupModuleOptions,
): WalletSetupModuleResult {
  const walletRef = options.wallet;
  const signerRef = options.signer;
  let unlocked = false;
  let unlockInFlight: Promise<void> | undefined;

  async function refreshAddressesFromSigner(): Promise<void> {
    const evm = await signerRef.evm.getAccountAddress();
    const solana = await signerRef.solana.getAccountAddress();
    options.storage.saveCachedAddresses(evm, solana);
  }

  async function loginWithPasskey(): Promise<void> {
    const result = await signerRef.getPublicKey({ discoverable: true });
    const credentialId = result.credentialId ?? signerRef.getCredentialId();
    if (!credentialId) {
      throw new Error("Passkey login succeeded but credential id missing");
    }
    options.storage.saveWalletCreated(credentialId);
    await refreshAddressesFromSigner();
    unlocked = true;
    await options.onUnlocked?.();
  }

  async function promptPasskeyAccountName(): Promise<string> {
    const name = await showPasskeyNameDialog({
      container: options.dialogContainer,
    });
    if (!name) {
      throw new OwsUserRejectedError("User cancelled passkey creation");
    }
    return name;
  }

  async function createNewWallet(accountName: string): Promise<void> {
    await signerRef.createCredential(accountName, {
      rpName: "Open Wallet",
      userDisplayName: accountName,
    });
    const credentialId = signerRef.getCredentialId();
    if (!credentialId) {
      throw new Error("Passkey created but credential id missing");
    }
    options.storage.saveWalletCreated(credentialId);
    await refreshAddressesFromSigner();
    unlocked = true;
    await options.onUnlocked?.();
  }

  async function runSetupFlow(): Promise<void> {
    const display = await walletRef.requestDisplay({ width: 420, height: 480 });
    try {
      const choice = await showWalletSetupScreen({
        container: options.dialogContainer,
      });
      if (choice === "cancel") {
        throw new OwsUserRejectedError("User cancelled wallet setup");
      }
      if (choice === "login") {
        await loginWithPasskey();
        return;
      }
      const accountName = await promptPasskeyAccountName();
      await createNewWallet(accountName);
    } finally {
      await display.hide();
    }
  }

  async function unlockWithStoredCredential(): Promise<void> {
    const storedCredentialId = options.storage.loadCredentialId();
    if (storedCredentialId) {
      const result = await signerRef.getPublicKey({
        credentialId: storedCredentialId,
      });
      const credentialId = result.credentialId ?? signerRef.getCredentialId();
      if (!credentialId) {
        throw new Error("Passkey unlock succeeded but credential id missing");
      }
      options.storage.saveWalletCreated(credentialId);
      await refreshAddressesFromSigner();
      unlocked = true;
      await options.onUnlocked?.();
      return;
    }

    await loginWithPasskey();
  }

  async function ensureReady(): Promise<void> {
    if (unlocked) {
      return;
    }
    if (unlockInFlight) {
      await unlockInFlight;
      return;
    }

    unlockInFlight = (async () => {
      if (options.storage.isWalletCreated()) {
        await unlockWithStoredCredential();
        return;
      }
      await runSetupFlow();
    })();

    try {
      await unlockInFlight;
    } finally {
      unlockInFlight = undefined;
    }
  }

  const module: BrandingModule = {
    name: "wallet-setup",
    phase: "post-start",
    install(): void {
      if (window.parent === window || options.storage.isWalletCreated()) {
        return;
      }

      const mount = resolveElement(
        options.embeddedMount ?? "#wallet-onboarding",
        "embeddedMount",
      );
      const mainPanel = document.querySelector("#wallet-main");
      if (mainPanel instanceof HTMLElement) {
        mainPanel.hidden = true;
      }
      mount.hidden = false;
      mountEmbeddedSetupScreen(mount, {
        onLogin: () =>
          void (async () => {
            try {
              await loginWithPasskey();
            } catch (error: unknown) {
              console.error("[wallet-setup] embedded login failed", error);
            }
          })(),
        onCreate: () =>
          void (async () => {
            try {
              const accountName = await promptPasskeyAccountName();
              await createNewWallet(accountName);
            } catch (error: unknown) {
              console.error("[wallet-setup] embedded create failed", error);
            }
          })(),
      });
    },
  };

  return {
    module,
    ensureReady,
    isUnlocked: () => unlocked,
    setUnlocked: (value: boolean) => {
      unlocked = value;
    },
  };
}

function resolveElement(
  target: HTMLElement | string,
  label: string,
): HTMLElement {
  if (typeof target !== "string") {
    return target;
  }
  const element = document.querySelector(target);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`wallet-setup: ${label} not found: ${target}`);
  }
  return element;
}
