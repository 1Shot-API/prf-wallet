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

export function Modal({
  title,
  children,
  actions,
  onBackdropDismiss,
  footer,
  wide,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusTarget =
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea",
      );
    focusTarget?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onBackdropDismiss) {
        event.preventDefault();
        onBackdropDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBackdropDismiss]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-[color-mix(in_srgb,CanvasText_35%,transparent)] p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onBackdropDismiss?.();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[min(85vh,36rem)] overflow-auto rounded-[10px] bg-[Canvas] p-5 text-[CanvasText] shadow-[0_12px_40px_color-mix(in_srgb,CanvasText_25%,transparent)] ${
          wide ? "w-[min(32rem,100%)]" : "w-[min(28rem,100%)]"
        }`}
      >
        <h2 id={titleId} className="mb-3 text-lg font-semibold">
          {title}
        </h2>
        <div className="text-[0.95rem] opacity-90">{children}</div>
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
    </div>
  );
}
