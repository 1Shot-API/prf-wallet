import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { installBrandingModules } from "@1shotapi/ows-branding-core";
import { EVMAccountAddress, SolanaAccountAddress } from "@1shotapi/ows-types";
import { personalSignApprovalModule } from "./ows/approval-dialog/install";
import { createCreateBackupModule } from "./ows/create-backup/install";
import { createRestoreBackupModule } from "./ows/recover-backup/install";
import {
  isWalletCreated,
  loadBackup,
  loadCredentialId,
  saveBackup,
  saveWalletCreated,
} from "./storage";

// Temporary PRF / WebAuthn debugging (signer reads OWS_SIGNER_DEBUG + localStorage)
(globalThis as { OWS_SIGNER_DEBUG?: boolean }).OWS_SIGNER_DEBUG = false;

const walletStatusEl = document.getElementById("wallet-status")!;
const evmAddressEl = document.getElementById("evm-address")!;
const solanaAddressEl = document.getElementById("solana-address")!;
const createBackupButton = document.getElementById("create-backup");
const restoreBackupButton = document.getElementById("restore-backup");

/**
 * Whether keys are available this tab. How they were obtained (passkey vs
 * recovery) stays inside the Signing Layer — branding only tracks unlocked.
 */
let unlocked = false;

function setAddresses(
  evm: EVMAccountAddress,
  solana: SolanaAccountAddress,
): void {
  evmAddressEl.textContent = evm;
  solanaAddressEl.textContent = solana;
}

function refreshStatusUi(): void {
  if (unlocked) {
    walletStatusEl.textContent = "Unlocked";
  } else if (isWalletCreated()) {
    walletStatusEl.textContent = "Created (locked)";
  } else {
    walletStatusEl.textContent = "Not created";
  }

  if (createBackupButton instanceof HTMLElement) {
    createBackupButton.hidden = !unlocked;
  }
  if (restoreBackupButton instanceof HTMLElement) {
    restoreBackupButton.hidden = unlocked;
  }
}

async function main(): Promise<void> {
  const signerUrl = new URL("/signer/", window.location.origin).href;

  // Do not auto-prompt WebAuthn on load — show locked/created status only.
  refreshStatusUi();
  setAddresses(EVMAccountAddress("0x0"), SolanaAccountAddress("—"));

  const signer = await OWSSigner.create(
    document.getElementById("signer-container")!,
    signerUrl,
    {
      hidden: true,
      credentialId: loadCredentialId(),
    },
  );

  /**
   * Addresses come only from the signer SDK. Passkey unlock and recoverKey both
   * emit KeyDerived, which warms the address cache — getAccountAddress() is
   * identical either way.
   */
  async function refreshAddresses(): Promise<void> {
    // Sequential: a cold EVM call runs one getPublicKey ceremony and caches both.
    const evm = await signer.evm.getAccountAddress();
    const solana = await signer.solana.getAccountAddress();
    setAddresses(evm, solana);
  }

  /** Unlock existing passkey wallet or create one. Does not run on page load. */
  async function ensureWalletReady(): Promise<void> {
    if (unlocked) {
      return;
    }

    if (isWalletCreated()) {
      console.info(
        "[ows-example-general-wallet] unlocking existing passkey wallet",
      );
      await refreshAddresses();
      unlocked = true;
      refreshStatusUi();
      return;
    }

    console.debug(
      "[ows-example-general-wallet] navigator.userActivation.isActive",
      navigator.userActivation.isActive,
    );
    console.info(
      "[ows-example-general-wallet] createCredential via Signing Layer",
    );
    await signer.createCredential("ows-wallet", { rpName: "Open Wallet" });
    const credentialId = signer.getCredentialId();
    if (!credentialId) {
      throw new Error("Passkey created but credential id missing");
    }

    saveWalletCreated(credentialId);
    await refreshAddresses();
    unlocked = true;
    refreshStatusUi();
  }

  const wallet = OWSWallet.prepare({ debug: true });

  await installBrandingModules(
    {
      wallet,
      signer,
      ensureReady: ensureWalletReady,
    },
    [
      personalSignApprovalModule,
      createCreateBackupModule({
        triggerButton: "#create-backup",
        signerContainer: "#signer-container",
        onBackupCreated: (result) => {
          saveBackup(result.encryptedPrivateKey);
        },
      }),
      createRestoreBackupModule({
        triggerButton: "#restore-backup",
        signerContainer: "#signer-container",
        getEncryptedPrivateKey: () => loadBackup(),
        onRestored: async () => {
          unlocked = true;
          refreshStatusUi();
          await refreshAddresses();
        },
      }),
    ],
  );

  wallet.registerEip1193("eth_requestAccounts", async () => {
    await ensureWalletReady();
    return [await signer.evm.getAccountAddress()];
  });

  wallet.registerEip1193("eth_accounts", async () => {
    // Silent: do not prompt WebAuthn when locked.
    if (!unlocked) {
      return [];
    }
    return [await signer.evm.getAccountAddress()];
  });

  await wallet.start();

  if (window.parent !== window.top) {
    document.getElementById("wallet-chrome")?.classList.add("wallet-chrome--embedded");
    document.getElementById("wallet-close")?.addEventListener("click", () => {
      void wallet.requestHide();
    });
  }

  console.info("[ows-example-general-wallet] ready");
}

main().catch((error: unknown) => {
  console.error("[ows-example-general-wallet] failed to start", error);
  walletStatusEl.textContent = "Error";
});
