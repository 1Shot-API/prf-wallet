import type {
  OWSSigner,
  RecoveryDataCreatedData,
} from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { runCreateBackupFlow } from "./dialog";

export type RegisterCreateBackupOptions = {
  /** Override dialog mount target. */
  container?: HTMLElement;
  /** Button that starts the create-backup flow (element or CSS selector). */
  triggerButton: HTMLElement | string;
  /** Home container for the signer iframe (element or CSS selector). */
  signerContainer: HTMLElement | string;
  /** Minimum passphrase length (default 12). */
  minPasswordLength?: number;
  /** Run before signer ceremonies (e.g. passkey unlock). */
  ensureReady?: () => Promise<void>;
  /** App-owned hook when a backup blob is created (e.g. persist to localStorage). */
  onBackupCreated?: (result: RecoveryDataCreatedData) => void | Promise<void>;
  /** Override result presentation (default: in-dialog copy UI). */
  showResult?: (result: RecoveryDataCreatedData) => Promise<void>;
};

/** Document-delegated listeners keyed by selector (replaced on re-register). */
const delegatedClickListeners = new Map<string, (event: Event) => void>();

/** Direct element listeners (replaced on re-register of the same node). */
const elementClickListeners = new WeakMap<
  HTMLElement,
  (event: Event) => void
>();

/**
 * Bind the create-backup trigger button (call before `wallet.start()`).
 */
export function registerCreateBackup(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterCreateBackupOptions,
): void {
  const handleClick = (): void => {
    void runBackupClick(wallet, signer, options).catch((error: unknown) => {
      console.error("[create-backup] failed", error);
    });
  };

  bindTriggerButton(options.triggerButton, handleClick);
}

function bindTriggerButton(
  triggerButton: HTMLElement | string,
  handleClick: () => void,
): void {
  if (typeof triggerButton !== "string") {
    const previous = elementClickListeners.get(triggerButton);
    if (previous) {
      triggerButton.removeEventListener("click", previous);
    }
    const onClick = (): void => {
      handleClick();
    };
    elementClickListeners.set(triggerButton, onClick);
    triggerButton.addEventListener("click", onClick);
    return;
  }

  const selector = triggerButton;
  const previous = delegatedClickListeners.get(selector);
  if (previous) {
    document.removeEventListener("click", previous);
  }

  const onDocumentClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(selector)) return;
    handleClick();
  };
  delegatedClickListeners.set(selector, onDocumentClick);
  document.addEventListener("click", onDocumentClick);
}

async function runBackupClick(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterCreateBackupOptions,
): Promise<void> {
  const signerContainer = resolveElement(
    options.signerContainer,
    "signerContainer",
  );

  const display = await wallet.requestDisplay({
    width: 480,
    height: 420,
  });

  try {
    await runCreateBackupFlow(signer, {
      container: options.container,
      signerContainer,
      minPasswordLength: options.minPasswordLength,
      onBackupCreated: options.onBackupCreated,
      ensureReady: options.ensureReady,
      showResult: options.showResult,
    });
  } finally {
    await display.hide();
  }
}

function resolveElement(
  target: HTMLElement | string,
  label: string,
): HTMLElement {
  if (typeof target !== "string") {
    return target;
  }
  const el = document.querySelector(target);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`create-backup: ${label} not found (${target})`);
  }
  return el;
}
