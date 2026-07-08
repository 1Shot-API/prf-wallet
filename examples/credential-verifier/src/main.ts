import {
  MOCK_KYC_ISSUER_ID,
  MOCK_KYC_POLICY,
} from "../../credentials-shared/src/index.js";
import { validateMockPresentation, getMockVerifierRequestUri } from "./mock-verifier";
import { OWSProxy } from "@1shotapi/ows-provider";
import { PresentationRequestUri } from "@1shotapi/ows-types";
import "./styles.css";

const requestUriEl = document.getElementById("request-uri")!;
const verifyButton = document.getElementById("verify-button") as HTMLButtonElement;
const showWalletButton = document.getElementById(
  "show-wallet-button",
) as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const resultOutput = document.getElementById("result-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

const requestUri = PresentationRequestUri(getMockVerifierRequestUri());
requestUriEl.textContent = `Request URI: ${requestUri}`;

function setStatus(message: string, isError = false): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

async function main(): Promise<void> {
  const proxy = await OWSProxy.create(walletContainer, __WALLET_IFRAME_URL__);

  showWalletButton.addEventListener("click", () => {
    proxy.showWallet();
  });

  verifyButton.addEventListener("click", () => {
    void (async () => {
      verifyButton.disabled = true;
      resultOutput.hidden = true;
      setStatus("Requesting credential presentation from wallet…");

      try {
        const presentation = await proxy.credentials.present({ requestUri });
        const validation = await validateMockPresentation(
          presentation,
          MOCK_KYC_POLICY,
          MOCK_KYC_ISSUER_ID,
        );

        resultOutput.textContent = JSON.stringify(
          { presentation, validation },
          null,
          2,
        );
        resultOutput.hidden = false;

        if (validation.valid) {
          setStatus("Presentation valid (mock policy check passed).");
        } else {
          setStatus(`Presentation rejected: ${validation.reasons.join(", ")}`, true);
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Presentation request failed";
        setStatus(message, true);
      } finally {
        verifyButton.disabled = false;
      }
    })();
  });

  setStatus("Ready — ensure wallet has a demo KYC credential (use issuer demo first).");
}

main().catch((error: unknown) => {
  console.error("[ows-example-credential-verifier] failed", error);
  setStatus("Failed to start", true);
});
