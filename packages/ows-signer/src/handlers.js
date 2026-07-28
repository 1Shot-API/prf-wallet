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
import { getPublicKey as secpGetPublicKey, utils as secpUtils } from "./crypto/vendor/noble-secp256k1.js";
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
import {
  clearUi,
  CeremonyDeniedError,
  promptCeremonyConfirm,
  promptPassphrase,
  promptPrivateKey,
  showPrivateKey,
  updateCeremonyCopy,
} from "./ui.js";
import {
  createPasskeyCredential,
  getAssertionSignatureBase64Url,
  getCredentialId,
  getPasskeyAssertion,
  getCosePublicKeyBase64Url,
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

      case "importPrivateKey":
        await handleImportPrivateKey(params, correlationId, targetOrigin);
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

      case "executeBatch":
        await handleExecuteBatch(params, correlationId, targetOrigin);
        return;
    }
  } catch (error) {
    handleError(error, correlationId, targetOrigin);
  }
}

/**
 * @param {Record<string, unknown>} params
 * @returns {{
 *   explanationHeader?: unknown,
 *   explanationText?: unknown,
 *   confirmButtonText?: unknown,
 *   denyButtonText?: unknown,
 * }}
 */
function ceremonyFieldsFromParams(params) {
  return {
    explanationHeader: params.explanationHeader,
    explanationText: params.explanationText,
    confirmButtonText: params.confirmButtonText,
    denyButtonText: params.denyButtonText,
  };
}

/**
 * PRF bytes are returned on assertion (`prf.eval`), not registration (`prf.enable`).
 * Some platforms may return results on create; otherwise run a follow-up get.
 *
 * @param {PublicKeyCredential} credential
 * @param {string} [credentialId]
 * @param {(() => void) | undefined} [onBeforeFollowUpGet]
 * @returns {Promise<PublicKeyCredential>}
 */
async function credentialForKeyDerivation(
  credential,
  credentialId,
  onBeforeFollowUpGet,
) {
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
  if (typeof onBeforeFollowUpGet === "function") {
    onBeforeFollowUpGet();
  }
  // Prefer keeping the parent Confirm panel open (call from runOnConfirm) so
  // the user still sees why this second WebAuthn prompt appears.
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
      ? /** @type {{ rpName?: string, userDisplayName?: string, userId?: string, explanationHeader?: string, explanationText?: string, confirmButtonText?: string, denyButtonText?: string }} */ (
          params.options
        )
      : {};

  await withCeremony(async () => {
    // Create + optional PRF follow-up get stay under one Confirm panel so the
    // explanation remains visible for every WebAuthn prompt in this RPC.
    /** @type {PublicKeyCredential | undefined} */
    let registrationCredential;
    const prfCredential = await promptCeremonyConfirm(options, async () => {
      registrationCredential = await createPasskeyCredential(name, options);
      const credentialId = getCredentialId(registrationCredential);
      return credentialForKeyDerivation(
        registrationCredential,
        credentialId,
        () => {
          updateCeremonyCopy({
            explanationHeader: "Unlock your new passkey",
            explanationText:
              "Confirm with your passkey again to finish setting up this wallet.",
            confirmButtonText: options.confirmButtonText,
            denyButtonText: options.denyButtonText,
          });
        },
      );
    });
    if (!registrationCredential) {
      throw new Error("createCredential: registration credential missing");
    }
    const credentialId = getCredentialId(registrationCredential);
    const keys = await deriveKeysFromCredential(prfCredential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );

    emitEvent(window.parent, targetOrigin, "CredentialCreated", correlationId, {
      credentialId,
      cosePublicKey: getCosePublicKeyBase64Url(registrationCredential),
      secp256k1PublicKey: to0xHex(keys.secp256k1PublicKey),
    });
    zeroize(keys.secp256k1PrivateKey);
  });
}

/**
 * @typedef {{
 *   digestData: string,
 *   scheme: import('./constants.js').SignScheme,
 *   digest: Uint8Array,
 * }} ParsedDigestItem
 */

/**
 * @param {unknown} digests
 * @returns {{ ok: true, items: ParsedDigestItem[] } | { ok: false, reason: string }}
 */
function parseDigestItems(digests) {
  if (!Array.isArray(digests)) {
    return { ok: false, reason: "invalidParams" };
  }
  /** @type {ParsedDigestItem[]} */
  const items = [];
  for (const entry of digests) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, reason: "invalidParams" };
    }
    const record = /** @type {Record<string, unknown>} */ (entry);
    const digestData = record.digestData;
    const scheme = record.scheme;
    if (typeof digestData !== "string" || typeof scheme !== "string") {
      return { ok: false, reason: "invalidParams" };
    }
    if (
      !SIGN_SCHEMES.includes(
        /** @type {import('./constants.js').SignScheme} */ (scheme),
      )
    ) {
      return { ok: false, reason: "unknownScheme" };
    }
    const digest = parse0xHex(digestData);
    try {
      validateSignPayload(
        /** @type {import('./constants.js').SignScheme} */ (scheme),
        digest,
      );
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : "invalidPayload",
      };
    }
    items.push({
      digestData,
      scheme: /** @type {import('./constants.js').SignScheme} */ (scheme),
      digest,
    });
  }
  return { ok: true, items };
}

/**
 * @param {ParsedDigestItem[]} items
 * @param {Uint8Array} secp256k1PrivateKey
 * @param {Uint8Array} ed25519Seed
 * @param {string | null} credentialId
 * @returns {Promise<Array<{
 *   digest: string,
 *   scheme: string,
 *   signature: string,
 *   credentialId: string | null,
 * }>>}
 */
async function signParsedDigests(
  items,
  secp256k1PrivateKey,
  ed25519Seed,
  credentialId,
) {
  /** @type {Array<{ digest: string, scheme: string, signature: string, credentialId: string | null }>} */
  const results = [];
  for (const item of items) {
    const signature = await signWithScheme(
      item.scheme,
      item.digest,
      secp256k1PrivateKey,
      ed25519Seed,
    );
    results.push({
      digest: item.digestData,
      scheme: item.scheme,
      signature,
      credentialId,
    });
  }
  return results;
}

/**
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleSignDigest(params, correlationId, targetOrigin) {
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;
  const parsed = parseDigestItems(params.digests);
  if (!parsed.ok) {
    emitInvalid(correlationId, targetOrigin, parsed.reason);
    return;
  }
  const { items } = parsed;

  if (items.length === 0) {
    emitEvent(window.parent, targetOrigin, "DigestSigned", correlationId, {
      results: [],
    });
    return;
  }

  if (hasRecoverySession()) {
    const cached = getRecoveryPrivateKey();
    if (!cached) throw new Error("recoverySessionEmpty");
    const ed25519Seed = await ed25519SeedFromSecp256k1Scalar(cached);
    try {
      const results = await signParsedDigests(
        items,
        cached,
        ed25519Seed,
        credentialId ?? null,
      );
      emitEvent(window.parent, targetOrigin, "DigestSigned", correlationId, {
        results,
      });
    } finally {
      zeroize(ed25519Seed);
    }
    return;
  }

  await withCeremony(async () => {
    const credential = await promptCeremonyConfirm(
      ceremonyFieldsFromParams(params),
      () => getPasskeyAssertion(undefined, credentialId),
    );
    const keys = await deriveKeysFromCredential(credential);
    const ed25519Seed = await ed25519SeedFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );
    try {
      const results = await signParsedDigests(
        items,
        keys.secp256k1PrivateKey,
        ed25519Seed,
        credentialId ?? getCredentialId(credential),
      );
      emitEvent(window.parent, targetOrigin, "DigestSigned", correlationId, {
        results,
      });
    } finally {
      zeroize(keys.secp256k1PrivateKey);
      zeroize(ed25519Seed);
    }
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
    const credential = await promptCeremonyConfirm(
      ceremonyFieldsFromParams(params),
      () => getPasskeyAssertion(undefined, credentialId),
    );
    const keys = await deriveKeysFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );
    try {
      const dismiss = showPrivateKey(keys.secp256k1PrivateKey);
      zeroize(keys.secp256k1PrivateKey);
      await dismiss;
    } finally {
      zeroize(keys.secp256k1PrivateKey);
    }
  });
  emitEvent(
    window.parent,
    targetOrigin,
    "PrivateKeyRevealed",
    correlationId,
    {},
  );
}

/**
 * Paste a secp256k1 private key hex into the Signing Layer and start a recovery
 * session (same session semantics as `recoverKey` without a backup envelope).
 *
 * @param {Record<string, unknown>} _params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleImportPrivateKey(_params, correlationId, targetOrigin) {
  const raw = await promptPrivateKey();
  let privateKey;
  try {
    privateKey = parseImportedPrivateKeyHex(raw);
  } catch {
    emitInvalid(correlationId, targetOrigin, "invalidPrivateKey");
    return;
  }
  if (!secpUtils.isValidPrivateKey(privateKey)) {
    zeroize(privateKey);
    emitInvalid(correlationId, targetOrigin, "invalidPrivateKey");
    return;
  }

  setRecoveryPrivateKey(privateKey);

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

  emitEvent(
    window.parent,
    targetOrigin,
    "RecoverySessionStarted",
    correlationId,
    { recoverySessionActive: true },
  );
}

/**
 * @param {string} raw
 * @returns {Uint8Array}
 */
function parseImportedPrivateKeyHex(raw) {
  const trimmed = raw.trim();
  const withPrefix =
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? trimmed
      : `0x${trimmed}`;
  return parse0xHex(withPrefix, 32);
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
    const credential = await promptCeremonyConfirm(
      ceremonyFieldsFromParams(params),
      () => getPasskeyAssertion(undefined, credentialId),
    );
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
      await promptCeremonyConfirm(ceremonyFieldsFromParams(params), () =>
        getPasskeyAssertion(undefined, credentialId),
      );
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
    const credential = await promptCeremonyConfirm(
      ceremonyFieldsFromParams(params),
      () => getPasskeyAssertion(undefined, credentialId),
    );
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
    const credential = await promptCeremonyConfirm(
      ceremonyFieldsFromParams(params),
      () => getPasskeyAssertion(undefined, credentialId),
    );
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
    const credential = await promptCeremonyConfirm(
      ceremonyFieldsFromParams(params),
      () => getPasskeyAssertion(challenge, credentialId),
    );
    const keys = await deriveKeysFromCredential(credential);
    emitKeyDerived(
      targetOrigin,
      correlationId,
      keys.secp256k1PublicKey,
      keys.ed25519PublicKey,
    );

    emitEvent(window.parent, targetOrigin, "PublicKey", correlationId, {
      credentialId: getCredentialId(credential),
      cosePublicKey: getCosePublicKeyBase64Url(credential),
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
 * Mixed ceremony: digests + AES + public key + optional WebAuthn challenge.
 *
 * @param {Record<string, unknown>} params
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
async function handleExecuteBatch(params, correlationId, targetOrigin) {
  const credentialId =
    typeof params.credentialId === "string" ? params.credentialId : undefined;
  const includePublicKey = params.includePublicKey === true;
  const challengeHex =
    typeof params.challenge === "string" ? params.challenge : undefined;
  const challenge = challengeHex ? parse0xHex(challengeHex) : undefined;

  /** @type {ParsedDigestItem[] | undefined} */
  let digestItems;
  if (params.digests !== undefined) {
    const parsed = parseDigestItems(params.digests);
    if (!parsed.ok) {
      emitInvalid(correlationId, targetOrigin, parsed.reason);
      return;
    }
    digestItems = parsed.items;
  }

  /** @type {string[] | undefined} */
  let plaintexts;
  if (params.plaintexts !== undefined) {
    if (!isStringArray(params.plaintexts)) {
      emitInvalid(correlationId, targetOrigin, "invalidParams");
      return;
    }
    plaintexts = params.plaintexts;
  }

  /** @type {string[] | undefined} */
  let ciphertextsIn;
  if (params.ciphertexts !== undefined) {
    if (!isStringArray(params.ciphertexts)) {
      emitInvalid(correlationId, targetOrigin, "invalidParams");
      return;
    }
    ciphertextsIn = params.ciphertexts;
  }

  const hasDigests = (digestItems?.length ?? 0) > 0;
  const hasPlaintexts = (plaintexts?.length ?? 0) > 0;
  const hasCiphertexts = (ciphertextsIn?.length ?? 0) > 0;
  if (
    !hasDigests &&
    !hasPlaintexts &&
    !hasCiphertexts &&
    !includePublicKey &&
    !challenge
  ) {
    emitInvalid(correlationId, targetOrigin, "emptyBatch");
    return;
  }

  /**
   * @param {Uint8Array} secp256k1PrivateKey
   * @param {Uint8Array} ed25519Seed
   * @param {Uint8Array} secp256k1PublicKey
   * @param {Uint8Array} ed25519PublicKey
   * @param {string | null} resolvedCredentialId
   * @param {PublicKeyCredential | null} credential
   */
  async function runOps(
    secp256k1PrivateKey,
    ed25519Seed,
    secp256k1PublicKey,
    ed25519PublicKey,
    resolvedCredentialId,
    credential,
  ) {
    /** @type {Record<string, unknown>} */
    const data = { credentialId: resolvedCredentialId };

    if (hasDigests && digestItems) {
      data.results = await signParsedDigests(
        digestItems,
        secp256k1PrivateKey,
        ed25519Seed,
        resolvedCredentialId,
      );
    }
    if (hasPlaintexts && plaintexts) {
      data.ciphertexts = await encryptAes256Batch(
        plaintexts,
        secp256k1PrivateKey,
      );
    }
    if (hasCiphertexts && ciphertextsIn) {
      data.plaintexts = await decryptAes256Batch(
        ciphertextsIn,
        secp256k1PrivateKey,
      );
    }
    if (includePublicKey) {
      data.publicKey = {
        credentialId: resolvedCredentialId ?? undefined,
        cosePublicKey: credential
          ? getCosePublicKeyBase64Url(credential)
          : null,
        secp256k1PublicKey: to0xHex(secp256k1PublicKey),
        ed25519PublicKey: to0xHex(ed25519PublicKey),
      };
    }
    if (challenge && credential) {
      const signature = getAssertionSignatureBase64Url(credential);
      if (signature) {
        data.challengeSignature = signature;
      }
    }

    emitEvent(window.parent, targetOrigin, "BatchExecuted", correlationId, data);
  }

  // Challenge always forces a real assertion (assertion signature required).
  if (challenge || !hasRecoverySession()) {
    await withCeremony(async () => {
      const credential = await promptCeremonyConfirm(
        ceremonyFieldsFromParams(params),
        () => getPasskeyAssertion(challenge, credentialId),
      );
      const keys = await deriveKeysFromCredential(credential);
      const ed25519Seed = await ed25519SeedFromCredential(credential);
      emitKeyDerived(
        targetOrigin,
        correlationId,
        keys.secp256k1PublicKey,
        keys.ed25519PublicKey,
      );
      try {
        await runOps(
          keys.secp256k1PrivateKey,
          ed25519Seed,
          keys.secp256k1PublicKey,
          keys.ed25519PublicKey,
          credentialId ?? getCredentialId(credential),
          credential,
        );
      } finally {
        zeroize(keys.secp256k1PrivateKey);
        zeroize(ed25519Seed);
      }
    });
    return;
  }

  const cached = getRecoveryPrivateKey();
  if (!cached) throw new Error("recoverySessionEmpty");
  const ed25519Seed = await ed25519SeedFromSecp256k1Scalar(cached);
  const secp256k1PublicKey = secpGetPublicKey(cached, false);
  const ed25519PublicKey = await edGetPublicKeyAsync(ed25519Seed);
  emitKeyDerived(
    targetOrigin,
    correlationId,
    secp256k1PublicKey,
    ed25519PublicKey,
  );
  try {
    await runOps(
      cached,
      ed25519Seed,
      secp256k1PublicKey,
      ed25519PublicKey,
      credentialId ?? null,
      null,
    );
  } finally {
    zeroize(ed25519Seed);
  }
}

/**
 * @param {unknown} error
 * @param {string | undefined} correlationId
 * @param {string} targetOrigin
 */
function handleError(error, correlationId, targetOrigin) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof CeremonyDeniedError || name === "CeremonyDeniedError") {
    emitEvent(window.parent, targetOrigin, "SignDenied", correlationId, {
      reason: message || "signDenied",
    });
    return;
  }

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
