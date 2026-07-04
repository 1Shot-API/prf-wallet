import type { BrandingContext, BrandingModule } from "@1shotapi/ows-branding-core";
import { runRestoreBackupFlow } from "./dialog";

export type RestoreBackupModuleOptions = {
  /** Override dialog mount target. */
  container?: HTMLElement;
  /** Button that starts the restore-backup flow (element or CSS selector). */
  triggerButton: HTMLElement | string;
  /** Home container for the signer iframe (element or CSS selector). */
  signerContainer: HTMLElement | string;
  /**
   * Load the encrypted backup blob from app-owned storage.
   * Return `null` / `undefined` when no backup is available.
   */
  getEncryptedPrivateKey: () => string | null | undefined;
  /** Called after `recoverKey` succeeds (e.g. refresh addresses). */
  onRestored?: () => void | Promise<void>;
};

/** Document-delegated listeners keyed by selector (replaced on reinstall). */
const delegatedClickListeners = new Map<string, (event: Event) => void>();

/** Direct element listeners (replaced on reinstall of the same node). */
const elementClickListeners = new WeakMap<
  HTMLElement,
  (event: Event) => void
>();

export function createRestoreBackupModule(
  options: RestoreBackupModuleOptions,
): BrandingModule {
  return {
    name: "recover-backup",
    phase: "pre-start",
    install(ctx: BrandingContext): void {
      const handleClick = (): void => {
        void runRestoreClick(ctx, options).catch((error: unknown) => {
          console.error("[recover-backup] failed", error);
        });
      };

      bindTriggerButton(options.triggerButton, handleClick);
    },
  };
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

async function runRestoreClick(
  ctx: BrandingContext,
  options: RestoreBackupModuleOptions,
): Promise<void> {
  const encryptedPrivateKey = options.getEncryptedPrivateKey();
  if (!encryptedPrivateKey) {
    window.alert("No backup found. Create a backup first.");
    return;
  }

  const signerContainer = resolveElement(
    options.signerContainer,
    "signerContainer",
  );

  const display = await ctx.wallet.requestDisplay({
    width: 480,
    height: 420,
  });

  try {
    const restored = await runRestoreBackupFlow(ctx.signer, {
      container: options.container,
      signerContainer,
      encryptedPrivateKey,
    });
    if (restored) {
      await options.onRestored?.();
    }
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
    throw new Error(`recover-backup: ${label} not found (${target})`);
  }
  return el;
}
