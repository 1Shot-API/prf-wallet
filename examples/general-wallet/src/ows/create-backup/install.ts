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
};

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

      if (typeof options.triggerButton !== "string") {
        options.triggerButton.addEventListener("click", handleClick);
        return;
      }

      // Event delegation so install succeeds even if the button is not in the
      // DOM yet (e.g. stale HTML during HMR) and still works once it appears.
      const selector = options.triggerButton;
      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest(selector)) return;
        handleClick();
      });
    },
  };
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
