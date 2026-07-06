import type {
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-branding-core";

export type ApprovalDialogOptions = {
  /** Element to mount the dialog into (default `document.body`). */
  container?: HTMLElement;
};

let stylesInjected = false;

/**
 * Prompt the user to approve an EIP-191 personal_sign request.
 * Resolves `true` on Sign, `false` on Reject or dismiss.
 */
export function requestPersonalSignApproval(
  request: PersonalSignApprovalRequest,
  options?: ApprovalDialogOptions,
): Promise<boolean> {
  ensureStyles();

  return openApprovalDialog({
    title: "Sign message",
    address: request.address,
    container: options?.container,
    body: [
      labeledBlock("Message", formatMessageForDisplay(request.message)),
    ],
  });
}

/**
 * Prompt the user to approve an EIP-712 eth_signTypedData request.
 * Shows primary type, domain, and message as structured JSON.
 */
export function requestSignTypedDataApproval(
  request: SignTypedDataApprovalRequest,
  options?: ApprovalDialogOptions,
): Promise<boolean> {
  ensureStyles();

  const { typedData } = request;

  return openApprovalDialog({
    title: "Sign typed data",
    address: request.address,
    container: options?.container,
    body: [
      labeledBlock("Primary type", typedData.primaryType),
      labeledBlock("Domain", formatJson(typedData.domain)),
      labeledBlock("Message", formatJson(typedData.message)),
    ],
  });
}

type ApprovalDialogBody = {
  title: string;
  address: string;
  container?: HTMLElement;
  body: HTMLElement[];
};

function openApprovalDialog(spec: ApprovalDialogBody): Promise<boolean> {
  const container = spec.container ?? document.body;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ows-approval-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "ows-approval-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ows-approval-title");

    const title = document.createElement("h2");
    title.id = "ows-approval-title";
    title.className = "ows-approval-title";
    title.textContent = spec.title;

    const addressLabel = document.createElement("p");
    addressLabel.className = "ows-approval-label";
    addressLabel.textContent = "Account";

    const addressValue = document.createElement("p");
    addressValue.className = "ows-approval-address";
    addressValue.textContent = spec.address;

    const actions = document.createElement("div");
    actions.className = "ows-approval-actions";

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "ows-approval-button ows-approval-button--secondary";
    rejectButton.textContent = "Reject";

    const signButton = document.createElement("button");
    signButton.type = "button";
    signButton.className = "ows-approval-button ows-approval-button--primary";
    signButton.textContent = "Sign";

    let settled = false;

    const finish = (approved: boolean): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(approved);
    };

    rejectButton.addEventListener("click", () => finish(false));
    signButton.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    actions.append(rejectButton, signButton);
    dialog.append(title, addressLabel, addressValue, ...spec.body, actions);
    overlay.append(dialog);
    container.append(overlay);

    signButton.focus();
  });
}

function labeledBlock(label: string, content: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "ows-approval-block";

  const labelEl = document.createElement("p");
  labelEl.className = "ows-approval-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("pre");
  valueEl.className = "ows-approval-message";
  valueEl.textContent = content;

  wrap.append(labelEl, valueEl);
  return wrap;
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, jsonReplacer, 2);
  } catch {
    return String(value);
  }
}

/** Render bigint as decimal string for readable typed-data previews. */
function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

function formatMessageForDisplay(message: string): string {
  if (message.startsWith("0x") && message.length > 2) {
    try {
      const bytes = hexToBytes(message.slice(2));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {
      // fall through to raw message
    }
  }
  return message;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function isMostlyPrintable(text: string): boolean {
  if (!text.trim()) return false;
  let printable = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) printable++;
  }
  return printable / text.length >= 0.85;
}

function ensureStyles(): void {
  if (!stylesInjected) {
    injectApprovalDialogStyles();
    stylesInjected = true;
  }
}

/** @internal */
export function injectApprovalDialogStyles(): void {
  if (document.getElementById("ows-approval-dialog-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ows-approval-dialog-styles";
  style.textContent = `
    .ows-approval-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: color-mix(in srgb, CanvasText 35%, transparent);
    }
    .ows-approval-dialog {
      width: min(28rem, 100%);
      max-height: min(80vh, 36rem);
      overflow: auto;
      padding: 1.25rem;
      border-radius: 10px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 12px 40px color-mix(in srgb, CanvasText 25%, transparent);
      font-family: system-ui, sans-serif;
      line-height: 1.5;
    }
    .ows-approval-title {
      margin: 0 0 1rem;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .ows-approval-block {
      margin: 0 0 0.75rem;
    }
    .ows-approval-label {
      margin: 0 0 0.25rem;
      font-size: 0.8rem;
      font-weight: 500;
      opacity: 0.75;
    }
    .ows-approval-address {
      margin: 0 0 0.75rem;
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      word-break: break-all;
    }
    .ows-approval-message {
      margin: 0;
      padding: 0.75rem;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 0.85rem;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 12rem;
      overflow: auto;
    }
    .ows-approval-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      margin-top: 0.25rem;
    }
    .ows-approval-button {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ows-approval-button--primary {
      background: color-mix(in srgb, CanvasText 12%, Canvas);
      font-weight: 500;
    }
    .ows-approval-button:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  `;
  document.head.append(style);
}
