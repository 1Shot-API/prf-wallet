import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { EVMAccountAddress, SolanaAccountAddress } from "@1shotapi/ows-types";
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

    console.info(
      "[ows-example-wallet] createCredential via signer iframe (layer C)",
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

  await OWSWallet.create({
    debug: true,
    eip1193: {
      async eth_requestAccounts() {
        await ensureWalletReady();
        return [await signer.evm.getAccountAddress()];
      },
      async eth_accounts() {
        if (!isWalletCreated()) {
          return [];
        }
        return [await signer.evm.getAccountAddress()];
      },
      async personal_sign(params) {
        const [message] = params as [string, string];
        await ensureWalletReady();
        return signer.evm.signMessage({ message });
      },
    },
  });

  if (created) {
    try {
      await refreshAddresses();
    } catch (error) {
      console.warn("[ows-example-wallet] could not load addresses", error);
      setAddresses(EVMAccountAddress("0x0"), SolanaAccountAddress("—"));
    }
  }

  console.info("[ows-example-wallet] ready");
}

main().catch((error: unknown) => {
  console.error("[ows-example-wallet] failed to start", error);
  walletStatusEl.textContent = "Error";
});
