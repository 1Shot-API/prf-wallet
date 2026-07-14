import {
  API_VERSION,
  METHODS,
  PRF_LABEL_ED25519,
  SIGN_SCHEMES,
  SIGNER_VERSION,
} from "./constants.js";
import {
  decryptAes256Batch,
  encryptAes256Batch,
} from "./crypto/aes256.js";
import {
  deriveEd25519SeedFromPrf,
  deriveKeysFromCredential,
  hkdfExpand,
  normalizePrfOutputToArrayBuffer,
} from "./crypto/prf.js";
import { getPublicKeyAsync as edGetPublicKeyAsync } from "./crypto/vendor/noble-ed25519.js";
import { getPublicKey as secpGetPublicKey } from "./crypto/vendor/noble-secp256k1.js";
import { debugLog, describePrfExtensionResults } from "./debug.js";
import { decryptPrivateKey, encryptPrivateKey } from "./crypto/recovery.js";
import { signWithScheme, validateSignPayload } from "./crypto/sign.js";
import { parse0xHex, to0xHex } from "./hex.js";
import { emitEvent } from "./rpc.js";
import {
  clearRecoveryPrivateKey,
  getRecoveryPrivateKey,
  hasRecoverySession,
  setRecoveryPrivateKey,
  withCeremony,
  zeroize,
} from "./state.js";
import { clearUi, promptPassphrase, showPrivateKey } from "./ui.js";
import {
  createPasskeyCredential,
  getAssertionSignatureBase64Url,
  getCredentialId,
  getPasskeyAssertion,
  getPasskeyPublicKeyBase64Url,
} from "./webauthn.js";

/**
 * @param {PublicKeyCredential} credential
 * @returns {Promise<Uint8Array>}
 */
async function ed25519SeedFromCredential(credential) {
  const prfRaw = /** @type {{ prf?: { results?: { first?: unknown } } }} */ (
    credential.getClientExtensionResults()
  ).prf?.results?.first;
  const prfBuf = normalizePrfOutputToArrayBuffer(prfRaw);
  if (!prfBuf) throw new Error("noPrf");
  return deriveEd25519SeedFromPrf(prfBuf);
}

/**
 * @param {Uint8Array} secp256k1Scalar
 * @returns {Promise<Uint8Array>}
 */
async function ed25519SeedFromSecp256k1Scalar(secp256k1Scalar) {
  return hkdfExpand(
    secp256k1Scalar.buffer.slice(
      secp256k1Scalar.byteOffset,
      secp256k1Scalar.byteOffset + secp256k1Scalar.byteLength,
    ),
    PRF_LABEL_ED25519,
    32,
  );
}

/**
 * @param {string} targetOrigin
 * @param {string | undefined} correlationId
 * @param {Uint8Array} secp256k1PublicKey
 * @param {Uint8Array} ed25519PublicKey
 */
function emitKeyDerived(
  targetOrigin,
  correlationId,
  secp256k1PublicKey,
  ed25519PublicKey,
) {
  emitEvent(window.parent, targetOrigin, "KeyDerived", correlationId, {
    secp256k1PublicKey: to0xHex(secp256k1PublicKey),
    ed25519PublicKey: to0xHex(ed25519PublicKey),
  });
}

/**
 * @param {string} method
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
export async function handleRequest(
  method,
  params,
  correlationId,
  targetOrigin,
) {
  if (!METHODS.includes(method)) {
    emitEvent(window.parent, targetOrigin, "InvalidRequest", correlationId, {
      reason: "unknownMethod",
    });
    return;
  }

  try {
    switch (method) {
      case "getVersion":
        emitEvent(window.parent, targetOrigin, "Version", correlationId, {
          apiVersion: API_VERSION,
          signerVersion: SIGNER_VERSION,
          recoverySessionActive: hasRecoverySession(),
        });
        return;

      case "createCredential":
        await handleCreateCredential(params, correlationId, targetOrigin);
        return;

      case "signDigest":
        await handleSignDigest(params, correlationId, targetOrigin);
        return;

      case "revealPrivateKey":
        await handleRevealPrivateKey(params, correlationId, targetOrigin);
        return;

      case "createRecoveryData":
        await handleCreateRecoveryData(params, correlationId, targetOrigin);
        return;

      case "recoverKey":
        await handleRecoverKey(params, correlationId, targetOrigin);
        return;

      case "getPublicKey":
        await handleGetPublicKey(params, correlationId, targetOrigin);
        return;

      case "clearRecoverySession":
        clearRecoveryPrivateKey();
        clearUi();
        emitEvent(
          window.parent,
          targetOrigin,
          "RecoverySessionCleared",
          correlationId,
          {},
        );
        return;

      case "encryptAES256":
        await handleEncryptAES256(params, correlationId, targetOrigin);
        return;

      case "decryptAES256":
        await handleDecryptAES256(params, correlationId, targetOrigin);
        return;
    }
  } catch (error) {
    handleError(error, correlationId, targetOrigin);
  }
}

/**
 * PRF bytes are returned on assertion (`prf.eval`), not registration (`prf.enable`).
 * Some platforms may return results on create; otherwise run a follow-up get.
 *
 * @param {PublicKeyCredential} credential
 * @param {string} [credentialId]
 * @returns {Promise<PublicKeyCredential>}
 */
async function credentialForKeyDerivation(credential, credentialId) {
  debugLog("ceremony extension results", describePrfExtensionResults(credential));

  const rawPrf = credential.getClientExtensionResults()?.prf?.results?.first;
  if (normalizePrfOutputToArrayBuffer(rawPrf)) {
    debugLog("using PRF output from current ceremony");
    return credential;
  }

  const id = credentialId ?? getCredentialId(credential);
  debugLog("no PRF results on registration; running assertion with prf.eval", {
    credentialId: id,
  });
  const assertion = await getPasskeyAssertion(undefined, id);
  debugLog(
    "assertion extension results",
    describePrfExtensionResults(assertion),
  );
  return assertion;
}

/**
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleCreateCredential(params, correlationId, targetOrigin) {
  const name = params.name;
  if (typeof name !== "string" || !name) {
    emitInvalid(correlationId, targetOrigin, "invalidName");
    return;
  }
  const options =
    params.options && typeof params.options === "object"
      ? /** @type {{ rpName?: string, userDisplayName?: string, userId?: string }} */ (
          params.options
        )
      : {};

  await withCeremony(async () => {
    const credential = await createPasskeyCredential(name, options);
    const credentialId = getCredentialId(credential);
    const prfCredential = await credentialForKeyDerivation(
      credential,
      credentialId,
    );
    const keys = await deriveKeysFromCredential(prfCredential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );

    emitEvent(window.parent, targetOrigin, "CredentialCreated", correlationId, {
      credentialId,
      passkeyPublicKey: getPasskeyPublicKeyBase64Url(credential),
      secp256k1PublicKey: to0xHex(keys.secp256k1PublicKey),
    });
    zeroize(keys.secp256k1PrivateKey);
  });
}

/**
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleSignDigest(params, correlationId, targetOrigin) {
  const digestData = params.digestData;
  const scheme = params.scheme;
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;

  if (typeof digestData !== "string" || typeof scheme !== "string") {
    emitInvalid(correlationId, targetOrigin, "invalidParams");
    return;
  }
  if (
    !SIGN_SCHEMES.includes(
      /** @type {import('./constants.js').SignScheme} */ (scheme),
    )
  ) {
    emitInvalid(correlationId, targetOrigin, "unknownScheme");
    return;
  }

  const digest = parse0xHex(digestData);
  validateSignPayload(
    /** @type {import('./constants.js').SignScheme} */ (scheme),
    digest,
  );

  if (hasRecoverySession()) {
    const cached = getRecoveryPrivateKey();
    if (!cached) throw new Error("recoverySessionEmpty");
    const ed25519Seed = await ed25519SeedFromSecp256k1Scalar(cached);
    const signature = await signWithScheme(
      /** @type {import('./constants.js').SignScheme} */ (scheme),
      digest,
      cached,
      ed25519Seed,
    );
    zeroize(ed25519Seed);
    emitEvent(window.parent, targetOrigin, "DigestSigned", correlationId, {
      digest: digestData,
      scheme,
      signature,
      credentialId: credentialId ?? null,
    });
    return;
  }

  await withCeremony(async () => {
    const credential = await getPasskeyAssertion(undefined, credentialId);
    const keys = await deriveKeysFromCredential(credential);
    const ed25519Seed = await ed25519SeedFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );

    const signature = await signWithScheme(
      /** @type {import('./constants.js').SignScheme} */ (scheme),
      digest,
      keys.secp256k1PrivateKey,
      ed25519Seed,
    );
    zeroize(keys.secp256k1PrivateKey);
    zeroize(ed25519Seed);

    emitEvent(window.parent, targetOrigin, "DigestSigned", correlationId, {
      digest: digestData,
      scheme,
      signature,
      credentialId: credentialId ?? getCredentialId(credential),
    });
  });
}

/**
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleRevealPrivateKey(params, correlationId, targetOrigin) {
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;

  await withCeremony(async () => {
    const credential = await getPasskeyAssertion(undefined, credentialId);
    const keys = await deriveKeysFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );
    showPrivateKey(keys.secp256k1PrivateKey);
    zeroize(keys.secp256k1PrivateKey);
  });
}

/**
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleCreateRecoveryData(params, correlationId, targetOrigin) {
  const passwordText = params.passwordText;
  const buttonText = params.buttonText;
  const minPasswordLength = params.minPasswordLength;
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;

  if (
    typeof passwordText !== "string" ||
    typeof buttonText !== "string" ||
    typeof minPasswordLength !== "number"
  ) {
    emitInvalid(correlationId, targetOrigin, "invalidParams");
    return;
  }

  const passphrase = await promptPassphrase(
    passwordText,
    buttonText,
    minPasswordLength,
  );

  // Recovery session already holds the secp256k1 scalar — no WebAuthn needed.
  if (hasRecoverySession()) {
    const cached = getRecoveryPrivateKey();
    if (!cached) throw new Error("recoverySessionEmpty");
    const secp256k1PublicKey = secpGetPublicKey(cached, false);
    const ed25519Seed = await ed25519SeedFromSecp256k1Scalar(cached);
    const ed25519PublicKey = await edGetPublicKeyAsync(ed25519Seed);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      secp256k1PublicKey,
      ed25519PublicKey,
    );
    const encryptedPrivateKey = await encryptPrivateKey(cached, passphrase);
    zeroize(ed25519Seed);
    clearUi();
    emitEvent(
      window.parent,
      targetOrigin,
      "RecoveryDataCreated",
      correlationId,
      { encryptedPrivateKey },
    );
    return;
  }

  await withCeremony(async () => {
    const credential = await getPasskeyAssertion(undefined, credentialId);
    const keys = await deriveKeysFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );
    const encryptedPrivateKey = await encryptPrivateKey(
      keys.secp256k1PrivateKey,
      passphrase,
    );
    zeroize(keys.secp256k1PrivateKey);
    emitEvent(
      window.parent,
      targetOrigin,
      "RecoveryDataCreated",
      correlationId,
      { encryptedPrivateKey },
    );
  });
}

/**
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleRecoverKey(params, correlationId, targetOrigin) {
  const envelope = params.aes256EncryptedPrivateKey;
  const passwordText = params.passwordText;
  const buttonText = params.buttonText;
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;

  if (
    typeof envelope !== "string" ||
    typeof passwordText !== "string" ||
    typeof buttonText !== "string"
  ) {
    emitInvalid(correlationId, targetOrigin, "invalidParams");
    return;
  }

  const passphrase = await promptPassphrase(passwordText, buttonText, 1);
  const privateKey = await decryptPrivateKey(envelope, passphrase);
  setRecoveryPrivateKey(privateKey);

  // Emit public keys so OWSSigner can cache addresses (uncompressed secp256k1 —
  // viem publicKeyToAddress requires 0x04 ‖ X ‖ Y).
  const secp256k1PublicKey = secpGetPublicKey(privateKey, false);
  const ed25519Seed = await ed25519SeedFromSecp256k1Scalar(privateKey);
  const ed25519PublicKey = await edGetPublicKeyAsync(ed25519Seed);
  emitKeyDerived(
    targetOrigin,
    correlationId,
    secp256k1PublicKey,
    ed25519PublicKey,
  );
  zeroize(ed25519Seed);

  showPrivateKey(privateKey);

  if (credentialId) {
    await withCeremony(async () => {
      await getPasskeyAssertion(undefined, credentialId);
      clearRecoveryPrivateKey();
    });
    emitEvent(
      window.parent,
      targetOrigin,
      "RecoverySessionCleared",
      correlationId,
      { rebound: true },
    );
    return;
  }

  emitEvent(
    window.parent,
    targetOrigin,
    "RecoverySessionStarted",
    correlationId,
    { recoverySessionActive: true },
  );
}

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
function isStringArray(value) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * Batch AES-256-GCM seal using the secp256k1 scalar (same as `signDigest`).
 *
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleEncryptAES256(params, correlationId, targetOrigin) {
  const plaintexts = params.plaintexts;
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;

  if (!isStringArray(plaintexts)) {
    emitInvalid(correlationId, targetOrigin, "invalidParams");
    return;
  }

  if (plaintexts.length === 0) {
    emitEvent(window.parent, targetOrigin, "AES256Encrypted", correlationId, {
      ciphertexts: [],
    });
    return;
  }

  if (hasRecoverySession()) {
    const cached = getRecoveryPrivateKey();
    if (!cached) throw new Error("recoverySessionEmpty");
    const ciphertexts = await encryptAes256Batch(plaintexts, cached);
    emitEvent(window.parent, targetOrigin, "AES256Encrypted", correlationId, {
      ciphertexts,
    });
    return;
  }

  await withCeremony(async () => {
    const credential = await getPasskeyAssertion(undefined, credentialId);
    const keys = await deriveKeysFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );
    try {
      const ciphertexts = await encryptAes256Batch(
        plaintexts,
        keys.secp256k1PrivateKey,
      );
      emitEvent(window.parent, targetOrigin, "AES256Encrypted", correlationId, {
        ciphertexts,
      });
    } finally {
      zeroize(keys.secp256k1PrivateKey);
    }
  });
}

/**
 * Batch AES-256-GCM unseal using the secp256k1 scalar (same as `signDigest`).
 *
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleDecryptAES256(params, correlationId, targetOrigin) {
  const ciphertexts = params.ciphertexts;
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;

  if (!isStringArray(ciphertexts)) {
    emitInvalid(correlationId, targetOrigin, "invalidParams");
    return;
  }

  if (ciphertexts.length === 0) {
    emitEvent(window.parent, targetOrigin, "AES256Decrypted", correlationId, {
      plaintexts: [],
    });
    return;
  }

  if (hasRecoverySession()) {
    const cached = getRecoveryPrivateKey();
    if (!cached) throw new Error("recoverySessionEmpty");
    const plaintexts = await decryptAes256Batch(ciphertexts, cached);
    emitEvent(window.parent, targetOrigin, "AES256Decrypted", correlationId, {
      plaintexts,
    });
    return;
  }

  await withCeremony(async () => {
    const credential = await getPasskeyAssertion(undefined, credentialId);
    const keys = await deriveKeysFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );
    try {
      const plaintexts = await decryptAes256Batch(
        ciphertexts,
        keys.secp256k1PrivateKey,
      );
      emitEvent(window.parent, targetOrigin, "AES256Decrypted", correlationId, {
        plaintexts,
      });
    } finally {
      zeroize(keys.secp256k1PrivateKey);
    }
  });
}

/**
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleGetPublicKey(params, correlationId, targetOrigin) {
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;
  const challenge =
    typeof params.challenge === "string"
      ? parse0xHex(params.challenge)
      : undefined;

  await withCeremony(async () => {
    const credential = await getPasskeyAssertion(challenge, credentialId);
    const keys = await deriveKeysFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );

    emitEvent(window.parent, targetOrigin, "PublicKey", correlationId, {
      credentialId: getCredentialId(credential),
      passkeyPublicKey: getPasskeyPublicKeyBase64Url(credential),
      secp256k1PublicKey: to0xHex(keys.secp256k1PublicKey),
      ed25519PublicKey: to0xHex(keys.ed25519PublicKey),
    });

    if (challenge) {
      const signature = getAssertionSignatureBase64Url(credential);
      if (signature) {
        emitEvent(
          window.parent,
          targetOrigin,
          "ChallengeSigned",
          correlationId,
          {
            challenge: to0xHex(challenge),
            signature,
          },
        );
      }
    }

    zeroize(keys.secp256k1PrivateKey);
  });
}

/**
 * @param {unknown} error
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
function handleError(error, correlationId, targetOrigin) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);

  if (name === "NotAllowedError" || message.includes("NotAllowed")) {
    emitEvent(window.parent, targetOrigin, "NotAllowed", correlationId, {
      reason: message || "notAllowed",
    });
    return;
  }

  if (message === "ceremonyInProgress") {
    emitEvent(window.parent, targetOrigin, "InvalidRequest", correlationId, {
      reason: "ceremonyInProgress",
    });
    return;
  }

  emitEvent(window.parent, targetOrigin, "InvalidRequest", correlationId, {
    reason: message || "error",
  });
}

/**
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 * @param {string} reason
 */
function emitInvalid(correlationId, targetOrigin, reason) {
  emitEvent(window.parent, targetOrigin, "InvalidRequest", correlationId, {
    reason,
  });
}
