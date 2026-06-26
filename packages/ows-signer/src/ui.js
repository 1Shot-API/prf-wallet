import { to0xHex } from "./hex.js";

/** @type {HTMLElement | null} */
let root = null;

/**
 * @param {HTMLElement} container
 */
export function initUi(container) {
  root = container;
  root.innerHTML = "";
  root.className = "ows-signer-ui";
}

export function clearUi() {
  if (root) root.innerHTML = "";
}

/**
 * @param {Uint8Array} privateKey
 */
export function showPrivateKey(privateKey) {
  if (!root) return;
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
  clearUi();
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "password";
    input.className = "ows-password";
    input.placeholder = passwordText;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ows-confirm";
    button.textContent = buttonText;
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
