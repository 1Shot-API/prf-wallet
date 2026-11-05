const DEBUG_KEY = "ows-signer:debug";

/**
 * True when a chrome-extension:// (or similar) page is an ancestor.
 * Chromium exposes this via `location.ancestorOrigins` even when top is
 * cross-origin — useful for side-panel embeds where WebAuthn often misbehaves.
 * @returns {boolean}
 */
export function isExtensionAncestor() {
  try {
    const origins = globalThis.location?.ancestorOrigins;
    if (!origins || origins.length === 0) return false;
    for (let i = 0; i < origins.length; i++) {
      const origin = origins[i];
      if (
        typeof origin === "string" &&
        (origin.startsWith("chrome-extension://") ||
          origin.startsWith("moz-extension://") ||
          origin.startsWith("safari-web-extension://"))
      ) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/** @returns {boolean} */
export function isDebug() {
  if (typeof globalThis === "undefined") return false;
  if (globalThis.OWS_SIGNER_DEBUG === true) return true;
  // Always log in extension side-panel embeds — GPM get() often hangs with no UI.
  if (isExtensionAncestor()) return true;
  try {
    return (
      typeof localStorage !== "undefined" &&
      localStorage.getItem(DEBUG_KEY) === "1"
    );
  } catch {
    return false;
  }
}

/** @returns {Record<string, unknown>} */
export function describeCeremonyEnvironment() {
  let visibilityState = null;
  let hasFocus = null;
  try {
    visibilityState = document.visibilityState;
    hasFocus = document.hasFocus?.() ?? null;
  } catch {
    // ignore
  }
  let ancestorOrigins = null;
  try {
    ancestorOrigins = globalThis.location?.ancestorOrigins
      ? Array.from(globalThis.location.ancestorOrigins)
      : null;
  } catch {
    ancestorOrigins = null;
  }
  return {
    extensionAncestor: isExtensionAncestor(),
    ancestorOrigins,
    visibilityState,
    hasFocus,
    userActivationActive: navigator.userActivation?.isActive ?? null,
    userActivationHasBeenActive: navigator.userActivation?.hasBeenActive ?? null,
  };
}

/** @param {...unknown} args */
export function debugLog(...args) {
  if (isDebug()) {
    console.info("[ows-signer]", ...args);
  }
}

/**
 * @param {PublicKeyCredential} credential
 * @returns {Record<string, unknown>}
 */
export function describePrfExtensionResults(credential) {
  const prf = credential.getClientExtensionResults()?.prf;
  const raw = prf?.results?.first;
  return {
    prfEnabled: prf?.enabled,
    hasResults: Boolean(prf?.results),
    resultKeys: prf?.results ? Object.keys(prf.results) : [],
    prfKeys: prf ? Object.keys(prf) : [],
    rawFirstType: typeof raw,
    rawFirstIsArrayBuffer: raw instanceof ArrayBuffer,
    rawFirstIsView: ArrayBuffer.isView(raw),
    rawFirstByteLength:
      raw instanceof ArrayBuffer
        ? raw.byteLength
        : ArrayBuffer.isView(raw)
          ? raw.byteLength
          : null,
  };
}
