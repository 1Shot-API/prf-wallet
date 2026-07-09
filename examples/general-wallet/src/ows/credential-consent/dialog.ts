import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
} from "@1shotapi/ows-types";

export type CredentialConsentDialogOptions = {
  container?: HTMLElement;
};

const panelStyle = [
  "max-width:28rem",
  "width:calc(100% - 2rem)",
  "padding:1.25rem",
  "border-radius:8px",
  "background:Canvas",
  "color:CanvasText",
  "border:1px solid color-mix(in srgb, CanvasText 20%, transparent)",
  "font:system-ui,sans-serif",
  "line-height:1.5",
].join(";");

const buttonStyle =
  "padding:0.5rem 0.875rem;border:1px solid color-mix(in srgb, CanvasText 25%, transparent);border-radius:6px;font:inherit;cursor:pointer";

function createBackdrop(container: HTMLElement): HTMLDivElement {
  const backdrop = document.createElement("div");
  backdrop.className = "ows-credential-consent-backdrop";
  backdrop.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:10000",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:color-mix(in srgb, CanvasText 25%, transparent)",
  ].join(";");
  container.append(backdrop);
  return backdrop;
}

export function requestCredentialOfferApproval(
  request: CredentialOfferApprovalRequest,
  options?: CredentialConsentDialogOptions,
): Promise<boolean> {
  const container = options?.container ?? document.body;

  return new Promise((resolve) => {
    const backdrop = createBackdrop(container);

    const panel = document.createElement("div");
    panel.className = "ows-credential-consent-panel";
    panel.style.cssText = panelStyle;

    const title = document.createElement("h2");
    title.textContent = "Accept credential offer?";
    title.style.cssText = "margin:0 0 0.75rem;font-size:1.1rem";

    const issuer = document.createElement("p");
    issuer.textContent = `${request.issuerName} (${request.issuerId}) wants to issue a credential to your wallet.`;
    issuer.style.margin = "0 0 0.75rem";

    const offeredLabel = document.createElement("p");
    offeredLabel.textContent = "Offered credentials:";
    offeredLabel.style.cssText = "margin:0 0 0.25rem;font-weight:600";

    const offeredList = document.createElement("ul");
    offeredList.style.cssText = "margin:0 0 1rem;padding-left:1.25rem";
    for (const credential of request.offeredCredentials) {
      const li = document.createElement("li");
      const scope = credential.scope ? ` — ${credential.scope}` : "";
      li.textContent = `${credential.configurationId} (${credential.format})${scope}`;
      offeredList.appendChild(li);
    }

    const note = document.createElement("p");
    note.textContent =
      "You may be asked to verify with your passkey after you continue.";
    note.style.cssText = "margin:0 0 1rem;font-size:0.9rem;opacity:0.85";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:0.5rem;justify-content:flex-end";

    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.textContent = "Reject";
    rejectBtn.style.cssText = `${buttonStyle};background:transparent;color:inherit`;

    const approveBtn = document.createElement("button");
    approveBtn.type = "button";
    approveBtn.textContent = "Accept";
    approveBtn.style.cssText = `${buttonStyle};background:Highlight;color:HighlightText`;

    const cleanup = (approved: boolean) => {
      backdrop.remove();
      resolve(approved);
    };

    rejectBtn.addEventListener("click", () => cleanup(false));
    approveBtn.addEventListener("click", () => cleanup(true));

    actions.append(rejectBtn, approveBtn);
    panel.append(title, issuer, offeredLabel, offeredList, note, actions);
    backdrop.append(panel);
    approveBtn.focus();
  });
}

export function requestCredentialPresentationApproval(
  request: CredentialPresentationApprovalRequest,
  options?: CredentialConsentDialogOptions,
): Promise<boolean> {
  const container = options?.container ?? document.body;

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "ows-credential-consent-backdrop";
    backdrop.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:10000",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:color-mix(in srgb, CanvasText 25%, transparent)",
    ].join(";");

    const panel = document.createElement("div");
    panel.className = "ows-credential-consent-panel";
    panel.style.cssText = [
      "max-width:28rem",
      "width:calc(100% - 2rem)",
      "padding:1.25rem",
      "border-radius:8px",
      "background:Canvas",
      "color:CanvasText",
      "border:1px solid color-mix(in srgb, CanvasText 20%, transparent)",
      "font:system-ui,sans-serif",
      "line-height:1.5",
    ].join(";");

    const title = document.createElement("h2");
    title.textContent = "Share credential?";
    title.style.cssText = "margin:0 0 0.75rem;font-size:1.1rem";

    const verifier = document.createElement("p");
    verifier.textContent = `${request.verifierName} (${request.verifierId}) is requesting proof.`;
    verifier.style.margin = "0 0 0.5rem";

    const credential = document.createElement("p");
    credential.textContent = `Credential: ${request.credentialType} from ${request.credentialIssuer}`;
    credential.style.margin = "0 0 0.75rem";

    const claimsLabel = document.createElement("p");
    claimsLabel.textContent = "Claims to disclose:";
    claimsLabel.style.cssText = "margin:0 0 0.25rem;font-weight:600";

    const claimsList = document.createElement("ul");
    claimsList.style.cssText = "margin:0 0 1rem;padding-left:1.25rem";
    for (const claim of request.requestedClaims) {
      const li = document.createElement("li");
      li.textContent = claim;
      claimsList.appendChild(li);
    }

    const note = document.createElement("p");
    note.textContent =
      "You may be asked to verify with your passkey after you continue.";
    note.style.cssText = "margin:0 0 1rem;font-size:0.9rem;opacity:0.85";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:0.5rem;justify-content:flex-end";

    const rejectBtn = document.createElement("button");
    rejectBtn.type = "button";
    rejectBtn.textContent = "Reject";
    rejectBtn.style.cssText =
      "padding:0.5rem 0.875rem;border:1px solid color-mix(in srgb, CanvasText 25%, transparent);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer";

    const approveBtn = document.createElement("button");
    approveBtn.type = "button";
    approveBtn.textContent = "Share";
    approveBtn.style.cssText =
      "padding:0.5rem 0.875rem;border:1px solid color-mix(in srgb, CanvasText 25%, transparent);border-radius:6px;background:Highlight;color:HighlightText;font:inherit;cursor:pointer";

    const cleanup = (approved: boolean) => {
      backdrop.remove();
      resolve(approved);
    };

    rejectBtn.addEventListener("click", () => cleanup(false));
    approveBtn.addEventListener("click", () => cleanup(true));

    actions.append(rejectBtn, approveBtn);
    panel.append(title, verifier, credential, claimsLabel, claimsList, note, actions);
    backdrop.append(panel);
    container.append(backdrop);
    approveBtn.focus();
  });
}
