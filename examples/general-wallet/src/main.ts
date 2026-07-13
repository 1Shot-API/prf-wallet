import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  EVMChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { registerApprovalSigning } from "./ows/approval-dialog/install";
import { registerCreateBackup } from "./ows/create-backup/install";
import { registerRestoreBackup } from "./ows/recover-backup/install";
import { createCredentialConsentUi } from "./ows/credential-consent/install";
import { registerCredentialsProvider } from "./ows/credentials-provider/install";
import { registerAccountConnect } from "./ows/account-connect/install";
import { createWalletSetup } from "./ows/wallet-setup/install";
import {
  LocalStorageCredentialStore,
  MockOid4vciClient,
  MockOid4vpClient,
} from "../../shared/src/index.js";
import { showCredentialListDialog } from "./credential-list-dialog";
import {
  isWalletCreated,
  loadBackup,
  loadCachedEvmAddress,
  loadCachedSolanaAddress,
  loadCredentialId,
  saveBackup,
  saveCachedAddresses,
  saveWalletCreated,
} from "./storage";

// Temporary PRF / WebAuthn debugging (signer reads OWS_SIGNER_DEBUG + localStorage)
(globalThis as { OWS_SIGNER_DEBUG?: boolean }).OWS_SIGNER_DEBUG = false;

/** Demo chains for the branding-layer chain dropdown (fed into RpcHelper). */
const DEMO_CHAINS: ReadonlyArray<{
  chainId: EVMChainId;
  label: string;
  rpcUrl: string;
}> = [
  {
    chainId: EVMChainId("0xaa36a7"), // 11155111
    label: "Sepolia",
    rpcUrl: "https://sepolia.drpc.org",
  },
  {
    chainId: EVMChainId("0x14a34"), // 84532
    label: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
  },
  {
    chainId: EVMChainId("0x4cef52"), // 5042002
    label: "Arc Testnet",
    rpcUrl: "https://rpc.testnet.arc.network",
  },
];

const walletStatusEl = document.getElementById("wallet-status")!;
const evmAddressEl = document.getElementById("evm-address")!;
const solanaAddressEl = document.getElementById("solana-address")!;
const chainSelect = document.getElementById(
  "chain-select",
) as HTMLSelectElement;
const createBackupButton = document.getElementById("create-backup");
const restoreBackupButton = document.getElementById("restore-backup");
const listCredentialsButton = document.getElementById("list-credentials");
const credentialCountEl = document.getElementById("credential-count")!;

const credentialStore = new LocalStorageCredentialStore();

const walletStorage = {
  isWalletCreated,
  loadCredentialId,
  saveWalletCreated,
  saveCachedAddresses,
  loadCachedEvmAddress,
};

function setAddresses(
  evm: EVMAccountAddress,
  solana: SolanaAccountAddress,
): void {
  evmAddressEl.textContent = evm;
  solanaAddressEl.textContent = solana;
}

async function refreshCredentialCount(): Promise<void> {
  const listed = await credentialStore.list();
  credentialCountEl.textContent = String(listed.length);
}

function refreshStatusUi(walletSetup: { isUnlocked: () => boolean }): void {
  if (walletSetup.isUnlocked()) {
    walletStatusEl.textContent = "Unlocked";
  } else if (isWalletCreated()) {
    walletStatusEl.textContent = "Created (locked)";
  } else {
    walletStatusEl.textContent = "Not created";
  }

  if (createBackupButton instanceof HTMLElement) {
    createBackupButton.hidden = !walletSetup.isUnlocked();
  }
  if (restoreBackupButton instanceof HTMLElement) {
    restoreBackupButton.hidden = walletSetup.isUnlocked();
  }
}

function revealMainWalletPanel(): void {
  const onboarding = document.getElementById("wallet-onboarding");
  const mainPanel = document.getElementById("wallet-main");
  if (onboarding instanceof HTMLElement) {
    onboarding.hidden = true;
  }
  if (mainPanel instanceof HTMLElement) {
    mainPanel.hidden = false;
  }
}

function setChainSelectValue(chainId: EVMChainId): void {
  chainSelect.value = chainId;
}

async function main(): Promise<void> {
  const signerUrl = new URL("/signer/", window.location.origin).href;

  const cachedEvm = loadCachedEvmAddress();
  const cachedSolana = loadCachedSolanaAddress();
  if (cachedEvm) {
    setAddresses(
      cachedEvm,
      cachedSolana ?? SolanaAccountAddress("—"),
    );
  } else {
    setAddresses(EVMAccountAddress("0x0"), SolanaAccountAddress("—"));
  }

  const signer = await OWSSigner.create(
    document.getElementById("signer-container")!,
    signerUrl,
    {
      hidden: true,
      credentialId: loadCredentialId(),
    },
  );

  const wallet = OWSWallet.prepare({ debug: true });

  const walletSetup = createWalletSetup({
    storage: walletStorage,
    wallet,
    signer,
    onUnlocked: async () => {
      revealMainWalletPanel();
      const evm = await signer.evm.getAccountAddress();
      const solana = await signer.solana.getAccountAddress();
      setAddresses(evm, solana);
      saveCachedAddresses(evm, solana);
      refreshStatusUi(walletSetup);
    },
  });

  refreshStatusUi(walletSetup);

  const defaultChainId = DEMO_CHAINS[0]!.chainId;
  const rpcHelper = new RpcHelper(
    new Map(DEMO_CHAINS.map((chain) => [chain.chainId, chain.rpcUrl])),
    wallet,
    signer,
    { defaultChainId },
  );

  setChainSelectValue(rpcHelper.getChainId());
  rpcHelper.events.on("chainChanged", (chainId) => {
    setChainSelectValue(chainId);
  });
  chainSelect.addEventListener("change", () => {
    const previous = rpcHelper.getChainId();
    void rpcHelper.switchChain(chainSelect.value).catch((error: unknown) => {
      setChainSelectValue(previous);
      console.error(
        "[ows-example-general-wallet] chain switch failed",
        error,
      );
    });
  });

  registerAccountConnect(wallet, signer, {
    storage: walletStorage,
    ensureReady: walletSetup.ensureReady,
  });

  registerApprovalSigning(wallet, signer, {
    ensureReady: walletSetup.ensureReady,
  });

  const credentialConsent = createCredentialConsentUi();
  registerCredentialsProvider(wallet, signer, {
    store: credentialStore,
    oid4vci: new MockOid4vciClient(),
    oid4vp: new MockOid4vpClient(),
    ensureReady: walletSetup.ensureReady,
    ...credentialConsent,
  });

  registerCreateBackup(wallet, signer, {
    triggerButton: "#create-backup",
    signerContainer: "#signer-container",
    ensureReady: walletSetup.ensureReady,
    onBackupCreated: (result) => {
      saveBackup(result.encryptedPrivateKey);
    },
  });

  registerRestoreBackup(wallet, signer, {
    triggerButton: "#restore-backup",
    signerContainer: "#signer-container",
    getEncryptedPrivateKey: () => loadBackup(),
    onRestored: async () => {
      walletSetup.setUnlocked(true);
      revealMainWalletPanel();
      refreshStatusUi(walletSetup);
      const evm = await signer.evm.getAccountAddress();
      const solana = await signer.solana.getAccountAddress();
      setAddresses(evm, solana);
      saveCachedAddresses(evm, solana);
    },
  });

  await wallet.start();
  walletSetup.mountEmbeddedSetup();

  void refreshCredentialCount();

  if (listCredentialsButton instanceof HTMLButtonElement) {
    listCredentialsButton.addEventListener("click", () => {
      void (async () => {
        const listed = await credentialStore.list();
        credentialCountEl.textContent = String(listed.length);
        showCredentialListDialog(listed);
      })().catch((error: unknown) => {
        console.error("[ows-example-general-wallet] list credentials failed", error);
      });
    });
  }

  if (window.parent !== window) {
    document.getElementById("wallet-chrome")?.classList.add("wallet-chrome--embedded");
    document.getElementById("wallet-close")?.addEventListener("click", () => {
      void wallet.requestHide();
    });
  }

  console.info("[ows-example-general-wallet] ready", {
    chainId: rpcHelper.getChainId(),
  });
}

main().catch((error: unknown) => {
  console.error("[ows-example-general-wallet] failed to start", error);
  walletStatusEl.textContent = "Error";
});
