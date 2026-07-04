import type {
  BrandingContext,
  BrandingModule,
  CreateBackupResult,
} from "@1shotapi/ows-branding-core";
import { runCreateBackupFlow } from "./dialog";

export type CreateBackupModuleOptions = {
  /** Override dialog mount target. */
  container?: HTMLElement;
  /** Button that starts the create-backup flow (element or CSS selector). */
  triggerButton: HTMLElement | string;
  /** Home container for the signer iframe (element or CSS selector). */
  signerContainer: HTMLElement | string;
  /** Minimum passphrase length (default 12). */
  minPasswordLength?: number;
  /** App-owned hook when a backup blob is created (e.g. persist to localStorage). */
  onBackupCreated?: (result: CreateBackupResult) => void | Promise<void>;
};

/** Document-delegated listeners keyed by selector (replaced on reinstall). */
const delegatedClickListeners = new Map<string, (event: Event) => void>();

/** Direct element listeners (replaced on reinstall of the same node). */
const elementClickListeners = new WeakMap<
  HTMLElement,
  (event: Event) => void
>();

export function createCreateBackupModule(
  options: CreateBackupModuleOptions,
): BrandingModule {
  return {
    name: "create-backup",
    phase: "pre-start",
    install(ctx: BrandingContext): void {
      const handleClick = (): void => {
        void runBackupClick(ctx, options).catch((error: unknown) => {
          console.error("[create-backup] failed", error);
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

async function runBackupClick(
  ctx: BrandingContext,
  options: CreateBackupModuleOptions,
): Promise<void> {
  const signerContainer = resolveElement(
    options.signerContainer,
    "signerContainer",
  );

  if (ctx.ensureReady) {
    await ctx.ensureReady();
  }

  const display = await ctx.wallet.requestDisplay({
    width: 480,
    height: 420,
  });

  try {
    const hostShowResult = ctx.ui?.showCreateBackupResult;

    await runCreateBackupFlow(ctx.signer, {
      container: options.container,
      signerContainer,
      minPasswordLength: options.minPasswordLength,
      onBackupCreated: options.onBackupCreated,
      showResult: hostShowResult
        ? (result: CreateBackupResult) => hostShowResult(result)
        : undefined,
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
