import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { installBrandingModules } from "@1shotapi/ows-branding-core";
import { EVMAccountAddress, SolanaAccountAddress } from "@1shotapi/ows-types";
import { personalSignApprovalModule } from "./ows/approval-dialog/install";
import {
  isWalletCreated,
  loadCredentialId,
  saveWalletCreated,
} from "./storage";

// Temporary PRF / WebAuthn debugging (signer reads OWS_SIGNER_DEBUG + localStorage)
(globalThis as { OWS_SIGNER_DEBUG?: boolean }).OWS_SIGNER_DEBUG = false;

const walletStatusEl = document.getElementById("wallet-status")!;
const evmAddressEl = document.getElementById("evm-address")!;
const solanaAddressEl = document.getElementById("solana-address")!;

function setWalletStatus(created: boolean): void {
  walletStatusEl.textContent = created ? "Created" : "Not created";
}

function setAddresses(
  evm: EVMAccountAddress,
  solana: SolanaAccountAddress,
): void {
  evmAddressEl.textContent = evm;
  solanaAddressEl.textContent = solana;
}

async function main(): Promise<void> {
  const signerUrl = new URL("/signer/", window.location.origin).href;
  const created = isWalletCreated();

  setWalletStatus(created);

  const signer = await OWSSigner.create(
    document.getElementById("signer-container")!,
    signerUrl,
    {
      hidden: true,
      credentialId: loadCredentialId(),
    },
  );

  async function refreshAddresses(): Promise<void> {
    if (!isWalletCreated()) {
      setAddresses(EVMAccountAddress("0x0"), SolanaAccountAddress("—"));
      return;
    }

    const [evm, solana] = await Promise.all([
      signer.evm.getAccountAddress(),
      signer.solana.getAccountAddress(),
    ]);
    setAddresses(evm, solana);
  }

  async function ensureWalletReady(): Promise<void> {
    if (isWalletCreated()) {
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
    setWalletStatus(true);
    await refreshAddresses();
  }

  const wallet = OWSWallet.prepare({ debug: true });

  await installBrandingModules(
    {
      wallet,
      signer,
      ensureReady: ensureWalletReady,
    },
    [personalSignApprovalModule],
  );

  wallet.registerEip1193("eth_requestAccounts", async () => {
    await ensureWalletReady();
    return [await signer.evm.getAccountAddress()];
  });

  wallet.registerEip1193("eth_accounts", async () => {
    if (!isWalletCreated()) {
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

  if (created) {
    try {
      await refreshAddresses();
    } catch (error) {
      console.warn("[ows-example-general-wallet] could not load addresses", error);
      setAddresses(EVMAccountAddress("0x0"), SolanaAccountAddress("—"));
    }
  }

  console.info("[ows-example-general-wallet] ready");
}

main().catch((error: unknown) => {
  console.error("[ows-example-general-wallet] failed to start", error);
  walletStatusEl.textContent = "Error";
});
