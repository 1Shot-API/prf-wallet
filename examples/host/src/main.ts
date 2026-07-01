import { OWSProxy } from "@1shotapi/ows-provider";
import "./styles.css";

const messageInput = document.getElementById("message-input") as HTMLTextAreaElement;
const signButton = document.getElementById("sign-button") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const signatureOutput = document.getElementById("signature-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

async function main(): Promise<void> {
  setStatus("Connecting to wallet…");

  const proxy = await OWSProxy.create(walletContainer, __WALLET_IFRAME_URL__);

  setStatus("Wallet connected. Enter a message and click Sign.");

  signButton.addEventListener("click", () => {
    void handleSign(proxy);
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
