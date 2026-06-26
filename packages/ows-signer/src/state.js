/** @type {Uint8Array | null} */
let recoveryPrivateKey = null;

/** @type {Promise<unknown> | null} */
let ceremonyPromise = null;

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
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withCeremony(fn) {
  if (ceremonyPromise) {
    throw new Error("ceremonyInProgress");
  }
  const promise = fn();
  ceremonyPromise = promise;
  try {
    return await promise;
  } finally {
    ceremonyPromise = null;
  }
}

/**
 * @param {Uint8Array} bytes
 */
export function zeroize(bytes) {
  if (bytes) bytes.fill(0);
}
