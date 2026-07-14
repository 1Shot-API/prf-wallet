import {
  MOCK_KYC_ISSUER_ID,
  MOCK_KYC_POLICY,
  type CustodyStep,
  type MockVerifierResult,
} from "../../shared/src/index.js";
import { validateMockPresentation, getMockVerifierRequestUri } from "./mock-verifier";
import { OWSProxy } from "@1shotapi/ows-provider";
import { PresentationRequestUri, type PresentationResult } from "@1shotapi/ows-types";
import "./styles.css";

const requestUriEl = document.getElementById("request-uri")!;
const verifyButton = document.getElementById("verify-button") as HTMLButtonElement;
const showWalletButton = document.getElementById(
  "show-wallet-button",
) as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const inspectionEl = document.getElementById("inspection")!;
const custodyList = document.getElementById("custody-list")!;
const credentialMeta = document.getElementById("credential-meta")!;
const claimCards = document.getElementById("claim-cards")!;
const resultOutput = document.getElementById("result-output") as HTMLPreElement;
const walletContainer = document.getElementById("wallet-container")!;

const requestUri = PresentationRequestUri(getMockVerifierRequestUri());
requestUriEl.textContent = `Request URI: ${requestUri}`;

function setStatus(message: string, kind: "neutral" | "ok" | "error" = "neutral"): void {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", kind === "error");
  statusEl.classList.toggle("status--ok", kind === "ok");
}

function renderCustody(steps: CustodyStep[]): void {
  custodyList.replaceChildren(
    ...steps.map((step) => {
      const li = document.createElement("li");
      li.className = `custody-step custody-step--${step.ok ? "ok" : "fail"}`;
      li.innerHTML = `
        <span class="custody-step__mark" aria-hidden="true">${step.ok ? "✓" : "✗"}</span>
        <div>
          <div class="custody-step__label">${escapeHtml(step.label)}</div>
          <div class="custody-step__detail">${escapeHtml(step.detail)}</div>
        </div>
      `;
      return li;
    }),
  );
}

function renderCredentialMeta(validation: MockVerifierResult): void {
  const rows: Array<[string, string]> = [
    ["Type (vct)", validation.vct ?? "—"],
    ["Issuer (iss)", validation.issuer ?? "—"],
    ["Format", validation.format],
    ["Holder thumbprint", validation.holderThumbprint ?? "—"],
  ];
  if (validation.kb) {
    rows.push(
      ["kb+jwt nonce", validation.kb.nonce ?? "—"],
      ["kb+jwt aud", validation.kb.aud ?? "—"],
    );
  }
  credentialMeta.innerHTML = rows
    .map(
      ([dt, dd]) =>
        `<div><dt>${escapeHtml(dt)}</dt><dd>${escapeHtml(dd)}</dd></div>`,
    )
    .join("");
}

function renderClaims(disclosed: Record<string, unknown>): void {
  const entries = Object.entries(disclosed);
  if (entries.length === 0) {
    claimCards.innerHTML = `<p class="claim-card__value">No disclosed claim values available.</p>`;
    return;
  }
  claimCards.replaceChildren(
    ...entries.map(([name, value]) => {
      const card = document.createElement("article");
      card.className = "claim-card";
      card.innerHTML = `
        <p class="claim-card__name">${escapeHtml(name)}</p>
        <p class="claim-card__value">${escapeHtml(formatClaimValue(value))}</p>
      `;
      return card;
    }),
  );
}

function formatClaimValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInspection(
  presentation: PresentationResult,
  validation: MockVerifierResult,
): void {
  renderCustody(validation.custody);
  renderCredentialMeta(validation);
  renderClaims(validation.disclosedClaims);
  resultOutput.textContent = JSON.stringify({ presentation, validation }, null, 2);
  inspectionEl.hidden = false;
}

async function main(): Promise<void> {
  const proxy = await OWSProxy.create(walletContainer, __WALLET_IFRAME_URL__);

  showWalletButton.addEventListener("click", () => {
    proxy.showWallet();
  });

  verifyButton.addEventListener("click", () => {
    void (async () => {
      verifyButton.disabled = true;
      inspectionEl.hidden = true;
      setStatus("Requesting credential presentation from wallet…");

      try {
        const presentation = await proxy.credentials.present({
          requestUri,
          acceptedIssuers: [MOCK_KYC_ISSUER_ID],
        });
        const validation = await validateMockPresentation(
          presentation,
          MOCK_KYC_POLICY,
          MOCK_KYC_ISSUER_ID,
        );

        renderInspection(presentation, validation);

        if (validation.valid) {
          setStatus(
            "Presentation verified — crypto, policy, and custody checks passed.",
            "ok",
          );
        } else {
          setStatus(
            `Presentation rejected: ${validation.reasons.join(", ") || "custody check failed"}`,
            "error",
          );
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Presentation request failed";
        setStatus(message, "error");
      } finally {
        verifyButton.disabled = false;
      }
    })();
  });

  setStatus("Ready — ensure wallet has a demo KYC credential (use issuer demo first).");
}

main().catch((error: unknown) => {
  console.error("[ows-example-credential-verifier] failed", error);
  setStatus("Failed to start", "error");
});
