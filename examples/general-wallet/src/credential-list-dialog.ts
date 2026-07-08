import type { CredentialSummary } from "@1shotapi/ows-credentials";

export type CredentialListDialogOptions = {
  container?: HTMLElement;
};

/** Shows stored credentials or an empty-state message. */
export function showCredentialListDialog(
  credentials: CredentialSummary[],
  options?: CredentialListDialogOptions,
): void {
  const container = options?.container ?? document.body;

  const backdrop = document.createElement("div");
  backdrop.className = "ows-credential-list-backdrop";
  backdrop.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:10000",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:color-mix(in srgb, CanvasText 25%, transparent)",
  ].join(";");

  const panel = document.createElement("div");
  panel.className = "ows-credential-list-panel";
  panel.style.cssText = [
    "max-width:32rem",
    "width:calc(100% - 2rem)",
    "max-height:calc(100% - 2rem)",
    "overflow:auto",
    "padding:1.25rem",
    "border-radius:8px",
    "background:Canvas",
    "color:CanvasText",
    "border:1px solid color-mix(in srgb, CanvasText 20%, transparent)",
    "font:system-ui,sans-serif",
    "line-height:1.5",
  ].join(";");

  const title = document.createElement("h2");
  title.textContent = "My credentials";
  title.style.cssText = "margin:0 0 0.75rem;font-size:1.1rem";

  const body = document.createElement("div");
  body.style.margin = "0 0 1rem";

  if (credentials.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No credentials stored in this wallet yet.";
    empty.style.cssText = "margin:0;opacity:0.85";
    body.append(empty);
  } else {
    const list = document.createElement("ul");
    list.style.cssText = "margin:0;padding:0;list-style:none;display:grid;gap:0.75rem";

    for (const credential of credentials) {
      const item = document.createElement("li");
      item.style.cssText = [
        "padding:0.75rem",
        "border-radius:6px",
        "border:1px solid color-mix(in srgb, CanvasText 15%, transparent)",
        "background:color-mix(in srgb, CanvasText 4%, transparent)",
      ].join(";");

      const typeLine = document.createElement("p");
      typeLine.style.cssText = "margin:0 0 0.25rem;font-weight:600";
      typeLine.textContent = credential.type.join(", ");

      const issuerLine = document.createElement("p");
      issuerLine.style.cssText = "margin:0 0 0.25rem;font-size:0.85rem";
      issuerLine.textContent = `Issuer: ${credential.issuer}`;

      const metaLine = document.createElement("p");
      metaLine.style.cssText =
        "margin:0;font-family:ui-monospace,monospace;font-size:0.75rem;opacity:0.85";
      metaLine.textContent = credential.validUntil
        ? `Issued ${credential.issuedAt} · Valid until ${credential.validUntil}`
        : `Issued ${credential.issuedAt}`;

      item.append(typeLine, issuerLine, metaLine);
      list.append(item);
    }

    body.append(list);
  }

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;justify-content:flex-end";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.style.cssText =
    "padding:0.5rem 0.875rem;border:1px solid color-mix(in srgb, CanvasText 25%, transparent);border-radius:6px;background:Highlight;color:HighlightText;font:inherit;cursor:pointer";

  closeBtn.addEventListener("click", () => backdrop.remove());
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      backdrop.remove();
    }
  });

  actions.append(closeBtn);
  panel.append(title, body, actions);
  backdrop.append(panel);
  container.append(backdrop);
  closeBtn.focus();
}
