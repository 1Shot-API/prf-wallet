export type WalletSetupChoice = "login" | "create" | "cancel";

export type WalletSetupDialogOptions = {
  container?: HTMLElement;
};

let stylesInjected = false;

/**
 * Prompt the user to log in with an existing passkey or create a new wallet.
 */
export function showWalletSetupScreen(
  options?: WalletSetupDialogOptions,
): Promise<WalletSetupChoice> {
  ensureStyles();

  const container = options?.container ?? document.body;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ows-setup-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "ows-setup-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ows-setup-title");

    const title = document.createElement("h2");
    title.id = "ows-setup-title";
    title.className = "ows-setup-title";
    title.textContent = "Set up your wallet";

    const body = document.createElement("p");
    body.className = "ows-setup-body";
    body.textContent =
      "This wallet uses a passkey to secure your keys on this device. " +
      "Log in with an existing passkey or create a new account before continuing.";

    const actions = document.createElement("div");
    actions.className = "ows-setup-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "ows-setup-button ows-setup-button--secondary";
    cancelButton.textContent = "Cancel";

    const loginButton = document.createElement("button");
    loginButton.type = "button";
    loginButton.className = "ows-setup-button ows-setup-button--primary";
    loginButton.textContent = "Login with passkey";

    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "ows-setup-button ows-setup-button--primary";
    createButton.textContent = "Create account";

    let settled = false;

    const finish = (choice: WalletSetupChoice): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(choice);
    };

    cancelButton.addEventListener("click", () => finish("cancel"));
    loginButton.addEventListener("click", () => finish("login"));
    createButton.addEventListener("click", () => finish("create"));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish("cancel");
      }
    });

    actions.append(cancelButton, loginButton, createButton);
    dialog.append(title, body, actions);
    overlay.append(dialog);
    container.append(overlay);

    loginButton.focus();
  });
}

/**
 * Explain that the host app is requesting the user's wallet address.
 */
export function showConnectAddressDialog(
  options?: WalletSetupDialogOptions,
): Promise<boolean> {
  ensureStyles();

  const container = options?.container ?? document.body;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ows-setup-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "ows-setup-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ows-connect-title");

    const title = document.createElement("h2");
    title.id = "ows-connect-title";
    title.className = "ows-setup-title";
    title.textContent = "Connect wallet";

    const body = document.createElement("p");
    body.className = "ows-setup-body";
    body.textContent =
      "The connected app is requesting your wallet address. " +
      "You may be asked to verify with your passkey after you continue.";

    const actions = document.createElement("div");
    actions.className = "ows-setup-actions";

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "ows-setup-button ows-setup-button--secondary";
    rejectButton.textContent = "Reject";

    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "ows-setup-button ows-setup-button--primary";
    continueButton.textContent = "Continue";

    let settled = false;

    const finish = (approved: boolean): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(approved);
    };

    rejectButton.addEventListener("click", () => finish(false));
    continueButton.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    actions.append(rejectButton, continueButton);
    dialog.append(title, body, actions);
    overlay.append(dialog);
    container.append(overlay);

    continueButton.focus();
  });
}

/**
 * Prompt for an account name before passkey creation.
 * Resolves the trimmed name, or `null` if the user cancels.
 */
export function showPasskeyNameDialog(
  options?: WalletSetupDialogOptions,
): Promise<string | null> {
  ensureStyles();

  const container = options?.container ?? document.body;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ows-setup-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "ows-setup-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ows-passkey-name-title");

    const title = document.createElement("h2");
    title.id = "ows-passkey-name-title";
    title.className = "ows-setup-title";
    title.textContent = "Name your passkey";

    const body = document.createElement("p");
    body.className = "ows-setup-body";
    body.textContent =
      "Choose a name for this wallet passkey. Your device will use it when you " +
      "create the credential and when you sign in later.";

    const label = document.createElement("label");
    label.className = "ows-setup-label";
    label.htmlFor = "ows-passkey-name-input";
    label.textContent = "Account name";

    const input = document.createElement("input");
    input.id = "ows-passkey-name-input";
    input.className = "ows-setup-input";
    input.type = "text";
    input.autocomplete = "username";
    input.placeholder = "e.g. My wallet";
    input.maxLength = 64;

    const errorEl = document.createElement("p");
    errorEl.className = "ows-setup-error";
    errorEl.hidden = true;

    const actions = document.createElement("div");
    actions.className = "ows-setup-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "ows-setup-button ows-setup-button--secondary";
    cancelButton.textContent = "Cancel";

    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "ows-setup-button ows-setup-button--primary";
    continueButton.textContent = "Continue";

    let settled = false;

    const finish = (name: string | null): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(name);
    };

    const submit = (): void => {
      const name = input.value.trim();
      if (!name) {
        errorEl.textContent = "Enter a name for your passkey.";
        errorEl.hidden = false;
        input.focus();
        return;
      }
      finish(name);
    };

    cancelButton.addEventListener("click", () => finish(null));
    continueButton.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(null);
      }
    });

    actions.append(cancelButton, continueButton);
    dialog.append(title, body, label, input, errorEl, actions);
    overlay.append(dialog);
    container.append(overlay);

    input.focus();
  });
}

/** Render setup screen inline in the wallet body when embedded and not yet created. */
export function mountEmbeddedSetupScreen(
  mount: HTMLElement,
  handlers: {
    onLogin: () => void | Promise<void>;
    onCreate: () => void | Promise<void>;
  },
): void {
  ensureStyles();
  mount.replaceChildren();

  const panel = document.createElement("div");
  panel.className = "ows-setup-embedded";

  const title = document.createElement("h2");
  title.className = "ows-setup-title";
  title.textContent = "Welcome";

  const body = document.createElement("p");
  body.className = "ows-setup-body";
  body.textContent =
    "Log in with an existing passkey or create a new wallet account to get started.";

  const actions = document.createElement("div");
  actions.className = "ows-setup-actions ows-setup-actions--stacked";

  const loginButton = document.createElement("button");
  loginButton.type = "button";
  loginButton.className = "ows-setup-button ows-setup-button--primary";
  loginButton.textContent = "Login with passkey";
  loginButton.addEventListener("click", () => {
    void handlers.onLogin();
  });

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "ows-setup-button ows-setup-button--primary";
  createButton.textContent = "Create account";
  createButton.addEventListener("click", () => {
    void handlers.onCreate();
  });

  actions.append(loginButton, createButton);
  panel.append(title, body, actions);
  mount.append(panel);
}

function ensureStyles(): void {
  if (!stylesInjected) {
    injectWalletSetupStyles();
    stylesInjected = true;
  }
}

/** @internal */
export function injectWalletSetupStyles(): void {
  if (document.getElementById("ows-setup-dialog-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ows-setup-dialog-styles";
  style.textContent = `
    .ows-setup-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: color-mix(in srgb, CanvasText 35%, transparent);
    }
    .ows-setup-dialog {
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
    .ows-setup-embedded {
      padding: 0.5rem 0;
    }
    .ows-setup-title {
      margin: 0 0 0.75rem;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .ows-setup-body {
      margin: 0 0 1rem;
      font-size: 0.95rem;
      opacity: 0.9;
    }
    .ows-setup-label {
      display: block;
      margin: 0 0 0.35rem;
      font-size: 0.85rem;
      font-weight: 500;
      opacity: 0.8;
    }
    .ows-setup-input {
      width: 100%;
      box-sizing: border-box;
      margin: 0 0 0.75rem;
      padding: 0.5rem 0.625rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
      background: Canvas;
      color: CanvasText;
      font: inherit;
    }
    .ows-setup-input:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 1px;
    }
    .ows-setup-error {
      margin: -0.25rem 0 0.75rem;
      font-size: 0.85rem;
      color: #c00;
    }
    .ows-setup-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .ows-setup-actions--stacked {
      flex-direction: column;
      align-items: stretch;
    }
    .ows-setup-button {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ows-setup-button--primary {
      background: color-mix(in srgb, CanvasText 12%, Canvas);
      font-weight: 500;
    }
    .ows-setup-button:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  `;
  document.head.append(style);
}
