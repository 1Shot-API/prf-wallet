const DEBUG_KEY = "ows-signer:debug";

/** @returns {boolean} */
export function isDebug() {
  if (typeof globalThis === "undefined") return false;
  return (
    globalThis.OWS_SIGNER_DEBUG === true ||
    (typeof localStorage !== "undefined" &&
      localStorage.getItem(DEBUG_KEY) === "1")
  );
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
