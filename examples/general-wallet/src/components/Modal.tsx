import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

export type ModalAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  autoFocus?: boolean;
  disabled?: boolean;
};

export type ModalProps = {
  title: string;
  children: ReactNode;
  actions?: ModalAction[];
  onBackdropDismiss?: () => void;
  /** Extra content after children (e.g. signer slot). */
  footer?: ReactNode;
  wide?: boolean;
};

/**
 * Consent / status panel. Uses the native `<dialog>` + `showModal()` so the
 * browser owns focus trapping, Escape, and the backdrop.
 */
export function Modal({
  title,
  children,
  actions,
  onBackdropDismiss,
  footer,
  wide,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    const focusTarget =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.querySelector<HTMLElement>(
        "button, [href], input, select, textarea",
      );
    focusTarget?.focus();

    const onCancel = (event: Event) => {
      // Escape — only dismiss when the host offered a dismiss handler.
      if (!onBackdropDismiss) {
        event.preventDefault();
        return;
      }
      onBackdropDismiss();
    };

    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [onBackdropDismiss]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-4 open:grid open:place-items-center backdrop:bg-[color-mix(in_srgb,CanvasText_35%,transparent)]"
    >
      {onBackdropDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 z-0 cursor-default border-0 bg-transparent p-0"
          onClick={onBackdropDismiss}
        />
      ) : null}
      <div
        className={`relative z-10 max-h-[min(85vh,36rem)] min-w-0 overflow-x-hidden overflow-y-auto rounded-[10px] bg-[Canvas] p-5 text-[CanvasText] shadow-[0_12px_40px_color-mix(in_srgb,CanvasText_25%,transparent)] ${
          wide ? "w-[min(32rem,100%)]" : "w-[min(28rem,100%)]"
        }`}
      >
        <h2 id={titleId} className="mb-3 text-lg font-semibold">
          {title}
        </h2>
        <div className="min-w-0 overflow-x-hidden text-[0.95rem] opacity-90">
          {children}
        </div>
        {footer}
        {actions && actions.length > 0 ? (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                data-autofocus={action.autoFocus ? "" : undefined}
                onClick={action.onClick}
                className={`cursor-pointer rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] px-4 py-2 text-[inherit] disabled:cursor-not-allowed disabled:opacity-50 ${
                  action.variant === "primary"
                    ? "bg-[color-mix(in_srgb,CanvasText_12%,Canvas)] font-medium"
                    : "bg-transparent"
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
