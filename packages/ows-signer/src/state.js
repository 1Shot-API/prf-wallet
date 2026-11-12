/** @type {Uint8Array | null} */
let recoveryPrivateKey = null;

/** @type {Promise<unknown> | null} */
let ceremonyPromise = null;

/** @type {AbortController | null} */
let ceremonyAbortController = null;

/** @type {string | null} */
let trustedParentOrigin = null;

/**
 * @returns {boolean}
 */
export function isValidNesting() {
  try {
    return window.parent !== window && window.parent !== window.top;
  } catch {
    return false;
  }
}

/**
 * @returns {string}
 */
export function getRpId() {
  return window.location.hostname;
}

/**
 * @param {string} origin
 */
export function setTrustedParentOrigin(origin) {
  if (trustedParentOrigin === null) {
    trustedParentOrigin = origin;
  }
}

/**
 * @returns {string | null}
 */
export function getTrustedParentOrigin() {
  return trustedParentOrigin;
}

/**
 * @returns {boolean}
 */
export function hasRecoverySession() {
  return recoveryPrivateKey !== null;
}

/**
 * @returns {Uint8Array | null}
 */
export function getRecoveryPrivateKey() {
  return recoveryPrivateKey;
}

/**
 * @param {Uint8Array} key
 */
export function setRecoveryPrivateKey(key) {
  clearRecoveryPrivateKey();
  recoveryPrivateKey = key;
}

export function clearRecoveryPrivateKey() {
  if (recoveryPrivateKey) {
    recoveryPrivateKey.fill(0);
    recoveryPrivateKey = null;
  }
}

/**
 * AbortSignal for the active ceremony (WebAuthn `credentials.get/create`).
 * @returns {AbortSignal | undefined}
 */
export function getCeremonyAbortSignal() {
  return ceremonyAbortController?.signal;
}

/** @type {(() => void) | null} */
let cancelConfirmHook = null;

/**
 * Branding/UI registers the Confirm-cancel hook so steal / abandon can dismiss
 * the panel without a circular import on `ui.js`.
 *
 * @param {(() => void) | null} hook
 */
export function setCancelConfirmHook(hook) {
  cancelConfirmHook = hook;
}

/**
 * Force-drop the ceremony lock and abort in-flight WebAuthn.
 * Safe to call when no ceremony is active.
 */
function forceUnlockCeremony() {
  try {
    cancelConfirmHook?.();
  } catch {
    // ignore
  }
  const abort = ceremonyAbortController;
  const pending = ceremonyPromise;
  ceremonyPromise = null;
  ceremonyAbortController = null;
  try {
    abort?.abort();
  } catch {
    // ignore
  }
  if (pending) {
    void pending.catch(() => {
      // Prior ceremony was cancelled, aborted, or failed.
    });
  }
}

/**
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withCeremony(fn) {
  // Steal any leftover lock (e.g. hung credentials.get after parent timeout).
  // Throwing ceremonyInProgress left Branding retries stuck after RPC timeout.
  if (ceremonyPromise) {
    forceUnlockCeremony();
  }
  ceremonyAbortController = new AbortController();
  const promise = fn();
  ceremonyPromise = promise;
  try {
    return await promise;
  } finally {
    if (ceremonyPromise === promise) {
      ceremonyPromise = null;
      ceremonyAbortController = null;
    }
  }
}

/**
 * Cancel Confirm UI, abort in-flight WebAuthn, and unlock the ceremony immediately.
 * Used when the parent times out or starts a new RPC. Must not wait forever on
 * hung `credentials.get` — that left Branding retries stuck with ceremonyInProgress.
 *
 * @param {() => void} [_cancelPendingConfirm]
 */
export async function abandonCeremony(_cancelPendingConfirm) {
  // Prefer the registered hook (always current); keep the argument for callers.
  forceUnlockCeremony();
  if (typeof _cancelPendingConfirm === "function") {
    try {
      _cancelPendingConfirm();
    } catch {
      // ignore — hook already ran
    }
  }
}

/**
 * @param {Uint8Array} bytes
 */
export function zeroize(bytes) {
  if (bytes) bytes.fill(0);
}
