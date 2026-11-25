import { OWSProxy } from "@1shotapi/ows-provider";
import { CredentialOfferUri } from "@1shotapi/ows-types";
import "./styles.css";

declare const __WALLET_IFRAME_URL__: string;
declare const __ISSUER_ORIGIN__: string;

const offerUriEl = document.getElementById("offer-uri")!;
const issueButton = document.getElementById("issue-button") as HTMLButtonElement;
const showWalletButton = document.getElementById(
  "show-wallet-button",
) as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const resultOutput = document.getElementById("result-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

const offerUri = CredentialOfferUri(
  `${__ISSUER_ORIGIN__.replace(/\/$/, "")}/offers/demo`,
);
offerUriEl.textContent = `Offer URI: ${offerUri}`;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

async function main(): Promise<void> {
  const proxy = await OWSProxy.create(walletContainer, __WALLET_IFRAME_URL__, {
    // Branding iframe (ngrok) fetches loopback issuer OID4 endpoints.
    allowLocalAccess: true,
  });

  showWalletButton.addEventListener("click", () => {
    proxy.showWallet();
  });

  issueButton.addEventListener("click", () => {
    void (async () => {
      issueButton.disabled = true;
      resultOutput.hidden = true;
      setStatus("Sending credential offer to wallet…");

      try {
        const receipt = await proxy.credentials.acceptOffer({
          credentialOfferUri: offerUri,
        });
        resultOutput.textContent = JSON.stringify(receipt, null, 2);
        resultOutput.hidden = false;
        setStatus("Credential stored in wallet.");
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Credential offer failed";
        setStatus(message, true);
      } finally {
        issueButton.disabled = false;
      }
    })();
  });

  setStatus("Ready — OID4VCI HTTP issuer + general-wallet credentials.");
}

main().catch((error: unknown) => {
  console.error("[ows-example-credential-issuer] failed", error);
  setStatus("Failed to start", true);
});
