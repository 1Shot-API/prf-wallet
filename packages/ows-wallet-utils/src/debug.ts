const DEBUG_STORAGE_KEY = "ows-wallet-utils:debug";

let optionsDebug = false;

/** Enable via `OWSWalletOptions.debug`, `localStorage['ows-wallet-utils:debug']='1'`, or `globalThis.OWS_WALLET_UTILS_DEBUG`. */
export function setOwsWalletDebugFromOptions(enabled: boolean | undefined): void {
  optionsDebug = enabled === true;
}

export function isOwsWalletDebugEnabled(): boolean {
  if (optionsDebug) {
    return true;
  }
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as { OWS_WALLET_UTILS_DEBUG?: boolean }).OWS_WALLET_UTILS_DEBUG ===
      true
  ) {
    return true;
  }
  if (
    typeof localStorage !== "undefined" &&
    localStorage.getItem(DEBUG_STORAGE_KEY) === "1"
  ) {
    return true;
  }
  return false;
}

export function debugLog(message: string, data?: unknown): void {
  if (!isOwsWalletDebugEnabled()) {
    return;
  }
  if (data === undefined) {
    console.debug(`[ows-wallet-utils] ${message}`);
    return;
  }
  console.debug(`[ows-wallet-utils] ${message}`, data);
}
