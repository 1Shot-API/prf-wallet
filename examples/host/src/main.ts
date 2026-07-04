import { OWSProxy } from "@1shotapi/ows-provider";
import { EVMChainId } from "@1shotapi/ows-types";
import "./styles.css";

const messageInput = document.getElementById("message-input") as HTMLTextAreaElement;
const signButton = document.getElementById("sign-button") as HTMLButtonElement;
const showWalletButton = document.getElementById(
  "show-wallet-button",
) as HTMLButtonElement;
const chainSelect = document.getElementById("chain-select") as HTMLSelectElement;
const chainRefreshButton = document.getElementById(
  "chain-refresh-button",
) as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const signatureOutput = document.getElementById("signature-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

/** Canonical hex chain id for `<option value>` matching. */
function normalizeChainIdHex(value: string): EVMChainId {
  return EVMChainId(`0x${BigInt(value).toString(16)}`);
}

function setChainSelectValue(chainId: EVMChainId): void {
  const value = String(chainId);
  if ([...chainSelect.options].some((option) => option.value === value)) {
    chainSelect.value = value;
    return;
  }
  // Unknown chain — show it as a temporary option so the UI stays honest.
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  chainSelect.append(option);
  chainSelect.value = value;
}

async function refreshChainFromWallet(proxy: OWSProxy): Promise<EVMChainId> {
  const chainId = normalizeChainIdHex(
    await proxy.ethereum.request({ method: "eth_chainId" }),
  );
  setChainSelectValue(chainId);
  return chainId;
}

async function main(): Promise<void> {
  setStatus("Connecting to wallet…");

  const proxy = await OWSProxy.create(walletContainer, __WALLET_IFRAME_URL__);

  try {
    const chainId = await refreshChainFromWallet(proxy);
    setStatus(`Wallet connected on ${chainId}. Enter a message and click Sign.`);
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Failed to read chain id",
      true,
    );
  }

  chainSelect.addEventListener("change", () => {
    void (async () => {
      const selected = EVMChainId(chainSelect.value as `0x${string}`);
      chainSelect.disabled = true;
      try {
        await proxy.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: selected }],
        });
        setStatus(`Switched to ${selected}`);
      } catch (error) {
        await refreshChainFromWallet(proxy).catch(() => undefined);
        setStatus(
          error instanceof Error ? error.message : "Chain switch failed",
          true,
        );
      } finally {
        chainSelect.disabled = false;
      }
    })();
  });

  chainRefreshButton.addEventListener("click", () => {
    void (async () => {
      chainRefreshButton.disabled = true;
      try {
        const chainId = await refreshChainFromWallet(proxy);
        setStatus(`Chain synced: ${chainId}`);
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Failed to refresh chain",
          true,
        );
      } finally {
        chainRefreshButton.disabled = false;
      }
    })();
  });

  signButton.addEventListener("click", () => {
    void handleSign(proxy);
  });

  showWalletButton.addEventListener("click", () => {
    proxy.showWallet();
    setStatus("Wallet panel shown. Use × in the wallet to hide.");
  });
}

async function handleSign(proxy: OWSProxy): Promise<void> {
  const message = messageInput.value.trim();
  if (!message) {
    setStatus("Enter a message to sign.", true);
    return;
  }

  signButton.disabled = true;
  signatureOutput.hidden = true;
  setStatus("Requesting accounts…");

  try {
    const accounts = await proxy.ethereum.request({
      method: "eth_requestAccounts",
    });

    const account = accounts[0];
    if (!account) {
      throw new Error("No account returned from wallet");
    }

    setStatus("Approve the passkey prompt to sign…");

    const signature = await proxy.ethereum.request({
      method: "personal_sign",
      params: [message, account],
    });

    signatureOutput.textContent = signature;
    signatureOutput.hidden = false;
    setStatus(`Signed as ${account}`);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "Signing failed";
    setStatus(messageText, true);
  } finally {
    signButton.disabled = false;
  }
}

main().catch((error: unknown) => {
  console.error("[ows-example-host] failed to start", error);
  setStatus(
    error instanceof Error ? error.message : "Failed to connect to wallet",
    true,
  );
});
