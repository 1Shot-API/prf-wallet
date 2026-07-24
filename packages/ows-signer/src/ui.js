import { to0xHex } from "./hex.js";

/** @type {HTMLElement | null} */
let root = null;

/** @type {((reason?: Error) => void) | null} */
let pendingConfirmReject = null;

const DEFAULT_CEREMONY_HEADER = "Confirm passkey";
const DEFAULT_CEREMONY_TEXT =
  "Your device will ask for a passkey to continue.";
const DEFAULT_CONFIRM_TEXT = "Continue";
const DEFAULT_DENY_TEXT = "Cancel";

const MAX_HEADER_LENGTH = 120;
const MAX_EXPLANATION_LENGTH = 2_000;
const MAX_BUTTON_LABEL_LENGTH = 64;
const MAX_PASSPHRASE_PROMPT_LENGTH = 200;

/**
 * Plain-text sanitize Branding-supplied copy before it touches the DOM.
 * Tags are stripped; remaining text is assigned via `textContent` (never HTML).
 *
 * @param {unknown} value
 * @param {{ maxLength?: number, allowNewlines?: boolean }} [options]
 * @returns {string}
 */
export function sanitizeDisplayText(value, options = {}) {
  if (typeof value !== "string") return "";
  const maxLength = options.maxLength ?? 500;
  const allowNewlines = options.allowNewlines === true;

  let text = value.replace(/<[^>]*>/g, "");
  // Decode a few common entities so stripped markup cannot leave `&lt;script&gt;`-shaped bait.
  text = text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&");
  // Strip again after entity decode (e.g. `&lt;img onerror=...&gt;`).
  text = text.replace(/<[^>]*>/g, "");

  if (allowNewlines) {
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    text = text.replace(/\r\n?/g, "\n");
  } else {
    text = text.replace(/[\u0000-\u001F\u007F]/g, " ");
    text = text.replace(/\s+/g, " ");
  }

  text = text.trim();
  if (text.length > maxLength) {
    text = text.slice(0, maxLength).trimEnd();
  }
  return text;
}

/**
 * @param {HTMLElement} container
 */
export function initUi(container) {
  root = container;
  root.innerHTML = "";
  root.className = "ows-signer-ui";
}

export function clearUi() {
  if (root) {
    root.innerHTML = "";
    root.className = "ows-signer-ui";
  }
}

/**
 * Error thrown when the user cancels the ceremony Confirm UI.
 * Mapped to the `SignDenied` event by handlers.
 */
export class CeremonyDeniedError extends Error {
  constructor(message = "signDenied") {
    super(message);
    this.name = "CeremonyDeniedError";
  }
}

/**
 * Abort an open Confirm panel (e.g. client timeout or superseding RPC).
 * Does nothing if no confirm is waiting.
 */
export function cancelPendingCeremonyConfirm() {
  if (!pendingConfirmReject) return;
  const reject = pendingConfirmReject;
  pendingConfirmReject = null;
  clearUi();
  reject(new CeremonyDeniedError("ceremonyCancelled"));
}

/**
 * @typedef {{
 *   explanationHeader?: string,
 *   explanationText?: string,
 *   confirmButtonText?: string,
 *   denyButtonText?: string,
 * }} CeremonyUiFields
 */

/**
 * Resolve ceremony copy with defaults.
 * @param {CeremonyUiFields | Record<string, unknown> | undefined} fields
 */
export function resolveCeremonyUi(fields) {
  const src = fields && typeof fields === "object" ? fields : {};
  const header = sanitizeDisplayText(src.explanationHeader, {
    maxLength: MAX_HEADER_LENGTH,
  });
  const explanation = sanitizeDisplayText(src.explanationText, {
    maxLength: MAX_EXPLANATION_LENGTH,
    allowNewlines: true,
  });
  const confirmButtonText = sanitizeDisplayText(src.confirmButtonText, {
    maxLength: MAX_BUTTON_LABEL_LENGTH,
  });
  const denyButtonText = sanitizeDisplayText(src.denyButtonText, {
    maxLength: MAX_BUTTON_LABEL_LENGTH,
  });
  return {
    header: header || DEFAULT_CEREMONY_HEADER,
    explanation: explanation || DEFAULT_CEREMONY_TEXT,
    confirmButtonText: confirmButtonText || DEFAULT_CONFIRM_TEXT,
    denyButtonText: denyButtonText || DEFAULT_DENY_TEXT,
  };
}

/**
 * Show Confirm/Cancel. On Confirm, runs `runOnConfirm` **synchronously from the
 * click handler** so WebAuthn keeps user activation / document focus on mobile.
 *
 * Copy stays visible while the ceremony runs; buttons are disabled until it
 * settles. The panel is cleared only on deny, success, failure, or cancel.
 *
 * Layout: header + actions stay fixed; only explanation text scrolls.
 * Branding strings are sanitized then set with `textContent` (plain text only).
 *
 * @template T
 * @param {CeremonyUiFields | Record<string, unknown> | undefined} fields
 * @param {() => T | Promise<T>} runOnConfirm
 * @returns {Promise<T>}
 */
export function promptCeremonyConfirm(fields, runOnConfirm) {
  if (!root) {
    return Promise.reject(new Error("uiNotInitialized"));
  }
  cancelPendingCeremonyConfirm();
  clearUi();
  root.className = "ows-signer-ui ows-signer-ui--ceremony";
  const ui = resolveCeremonyUi(fields);

  return new Promise((resolve, reject) => {
    pendingConfirmReject = reject;

    const header = document.createElement("h2");
    header.className = "ows-ceremony-header";
    header.textContent = ui.header;

    const body = document.createElement("div");
    body.className = "ows-ceremony-body";
    const text = document.createElement("p");
    text.className = "ows-ceremony-text";
    text.textContent = ui.explanation;
    body.append(text);

    const actions = document.createElement("div");
    actions.className = "ows-ceremony-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "ows-confirm";
    confirmBtn.textContent = ui.confirmButtonText;

    const denyBtn = document.createElement("button");
    denyBtn.type = "button";
    denyBtn.className = "ows-deny";
    denyBtn.textContent = ui.denyButtonText;

    const finishWaiting = () => {
      pendingConfirmReject = null;
    };

    const settleSuccess = (result) => {
      // Cancel may have already cleared the waiter / panel.
      if (pendingConfirmReject !== reject) return;
      finishWaiting();
      clearUi();
      resolve(result);
    };

    const settleFailure = (error) => {
      if (pendingConfirmReject !== reject) return;
      finishWaiting();
      clearUi();
      reject(error);
    };

    confirmBtn.addEventListener("click", () => {
      confirmBtn.disabled = true;
      denyBtn.disabled = true;
      try {
        // Start WebAuthn in the same turn as the click (no prior await).
        // Keep copy visible until the ceremony settles.
        Promise.resolve(runOnConfirm()).then(settleSuccess, settleFailure);
      } catch (error) {
        settleFailure(error);
      }
    });

    denyBtn.addEventListener("click", () => {
      finishWaiting();
      clearUi();
      reject(new CeremonyDeniedError());
    });

    actions.append(confirmBtn, denyBtn);
    root.append(header, body, actions);
  });
}

/**
 * @param {Uint8Array} privateKey
 */
export function showPrivateKey(privateKey) {
  if (!root) return;
  cancelPendingCeremonyConfirm();
  clearUi();
  const pre = document.createElement("pre");
  pre.className = "ows-key";
  pre.textContent = to0xHex(privateKey);
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "ows-copy";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(pre.textContent ?? "");
  });
  root.append(pre, copyBtn);
}

/**
 * @param {string} passwordText
 * @param {string} buttonText
 * @param {number} minPasswordLength
 * @returns {Promise<string>}
 */
export function promptPassphrase(passwordText, buttonText, minPasswordLength) {
  if (!root) {
    return Promise.reject(new Error("uiNotInitialized"));
  }
  cancelPendingCeremonyConfirm();
  clearUi();
  const safePlaceholder = sanitizeDisplayText(passwordText, {
    maxLength: MAX_PASSPHRASE_PROMPT_LENGTH,
  });
  const safeButton = sanitizeDisplayText(buttonText, {
    maxLength: MAX_BUTTON_LABEL_LENGTH,
  });
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "password";
    input.className = "ows-password";
    input.placeholder = safePlaceholder || "Passphrase";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ows-confirm";
    button.textContent = safeButton || "Continue";
    button.addEventListener("click", () => {
      if (input.value.length < minPasswordLength) {
        reject(new Error("passwordTooShort"));
        return;
      }
      resolve(input.value);
      clearUi();
    });
    root.append(input, button);
  });
}
