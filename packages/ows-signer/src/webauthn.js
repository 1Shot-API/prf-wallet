import { getCeremonyAbortSignal, getRpId } from "./state.js";
import { PRF_LABEL_SECP256K1 } from "./constants.js";
import { bufferToBase64Url } from "./hex.js";
import { debugLog, describePrfExtensionResults } from "./debug.js";

/**
 * @param {Uint8Array} [userId]
 * @returns {Uint8Array}
 */
function randomUserId(userId) {
  if (userId) return userId;
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * @param {string} name
 * @param {{ rpName?: string, userDisplayName?: string, userId?: string }} [options]
 * @returns {Promise<PublicKeyCredential>}
 */
export async function createPasskeyCredential(name, options = {}) {
  const rpId = getRpId();
  const rpName =
    typeof options.rpName === "string" && options.rpName
      ? options.rpName
      : "OWS";
  const userId = options.userId
    ? Uint8Array.from(atob(options.userId), (c) => c.charCodeAt(0))
    : randomUserId();
  const displayName = options.userDisplayName ?? name;
  const signal = getCeremonyAbortSignal();

  debugLog("createPasskeyCredential userActivation.isActive", {
    isActive: navigator.userActivation?.isActive ?? false,
  });

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: rpName, id: rpId },
      user: {
        id: userId,
        name,
        displayName,
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      // Chromium warns when ES256 (-7) is present without RS256 (-257).
      // Prefer ES256 (PRF); RS256 is listed for authenticator compatibility.
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required",
      },
      extensions: {
        prf: {
          enable: {
            first: PRF_LABEL_SECP256K1,
          },
        },
      },
    },
    ...(signal ? { signal } : {}),
  });

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new Error("credentialCreationFailed");
  }
  debugLog("createPasskeyCredential", describePrfExtensionResults(credential));
  return credential;
}

/**
 * @param {Uint8Array} [challenge]
 * @param {string} [credentialId]
 * @returns {Promise<PublicKeyCredential>}
 */
export async function getPasskeyAssertion(challenge, credentialId) {
  const rpId = getRpId();
  const allowCredentials = credentialId
    ? [
        {
          type: "public-key",
          id: base64UrlToBytes(credentialId),
        },
      ]
    : undefined;
  const signal = getCeremonyAbortSignal();

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: challenge ?? crypto.getRandomValues(new Uint8Array(32)),
      rpId,
      userVerification: "required",
      allowCredentials,
      extensions: {
        prf: {
          eval: {
            first: PRF_LABEL_SECP256K1,
          },
        },
      },
    },
    ...(signal ? { signal } : {}),
  });

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new Error("credentialGetFailed");
  }
  debugLog("getPasskeyAssertion", describePrfExtensionResults(credential));
  return credential;
}

/**
 * @param {string} value
 * @returns {Uint8Array}
 */
function base64UrlToBytes(value) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * @param {PublicKeyCredential} credential
 * @returns {string}
 */
export function getCredentialId(credential) {
  return bufferToBase64Url(credential.rawId);
}

/**
 * @param {PublicKeyCredential} credential
 * @returns {string | null} COSE credentialPublicKey as base64url, or null
 */
export function getCosePublicKeyBase64Url(credential) {
  const response = credential.response;
  // COSE lives in attestation authenticator data only — not on assertions,
  // and not via AuthenticatorAttestationResponse.getPublicKey() (that is SPKI).
  if (
    !("getAuthenticatorData" in response) ||
    typeof response.getAuthenticatorData !== "function"
  ) {
    return null;
  }
  const authData = response.getAuthenticatorData();
  if (!authData) return null;
  const cose = extractCosePublicKeyFromAuthenticatorData(
    new Uint8Array(authData),
  );
  return cose ? bufferToBase64Url(cose) : null;
}

/**
 * Slice the COSE credentialPublicKey from attested credential data.
 * @param {Uint8Array} authData
 * @returns {Uint8Array | null}
 */
function extractCosePublicKeyFromAuthenticatorData(authData) {
  if (authData.length < 37) return null;
  const flags = authData[32];
  const hasAttestedCredentialData = (flags & 0x40) !== 0;
  if (!hasAttestedCredentialData) return null;

  let offset = 37; // rpIdHash(32) + flags(1) + signCount(4)
  offset += 16; // aaguid
  if (offset + 2 > authData.length) return null;
  const credentialIdLength = (authData[offset] << 8) | authData[offset + 1];
  offset += 2 + credentialIdLength;
  if (offset >= authData.length) return null;

  try {
    const length = cborFirstItemLength(authData, offset);
    return authData.subarray(offset, offset + length);
  } catch {
    return null;
  }
}

/**
 * Byte length of the first definite-length CBOR item at `offset`.
 * Sufficient for WebAuthn COSE public keys (maps of ints / bstrs).
 * @param {Uint8Array} buf
 * @param {number} offset
 * @returns {number}
 */
function cborFirstItemLength(buf, offset) {
  if (offset >= buf.length) throw new Error("cborTruncated");
  const initial = buf[offset];
  const major = initial >> 5;
  const additional = initial & 31;
  let pos = offset + 1;
  let argument = additional;

  if (additional === 24) {
    argument = buf[pos];
    pos += 1;
  } else if (additional === 25) {
    argument = (buf[pos] << 8) | buf[pos + 1];
    pos += 2;
  } else if (additional === 26) {
    argument =
      (buf[pos] << 24) |
      (buf[pos + 1] << 16) |
      (buf[pos + 2] << 8) |
      buf[pos + 3];
    pos += 4;
  } else if (additional === 27) {
    // 64-bit; WebAuthn keys never need this size
    throw new Error("cborUint64Unsupported");
  } else if (additional >= 28) {
    throw new Error("cborIndefiniteUnsupported");
  }

  if (major === 0 || major === 1) {
    return pos - offset;
  }
  if (major === 2 || major === 3) {
    return pos - offset + argument;
  }
  if (major === 7) {
    if (additional < 24) return pos - offset;
    if (additional === 25) return pos - offset + 2;
    if (additional === 26) return pos - offset + 4;
    if (additional === 27) return pos - offset + 8;
    return pos - offset;
  }
  if (major === 6) {
    const inner = cborFirstItemLength(buf, pos);
    return pos - offset + inner;
  }
  if (major === 4 || major === 5) {
    const valueCount = major === 5 ? argument * 2 : argument;
    for (let i = 0; i < valueCount; i++) {
      pos += cborFirstItemLength(buf, pos);
    }
    return pos - offset;
  }
  throw new Error("cborUnsupportedMajor");
}

/**
 * @param {PublicKeyCredential} credential
 * @returns {string | null}
 */
export function getAssertionSignatureBase64Url(credential) {
  const response = credential.response;
  if ("signature" in response && response.signature) {
    return bufferToBase64Url(response.signature);
  }
  return null;
}

/**
 * Full WebAuthn assertion fields for host/relayer auth (base64url).
 * @param {PublicKeyCredential} credential
 * @returns {{
 *   authenticatorData: string,
 *   clientDataJSON: string,
 *   signature: string,
 *   credentialId: string,
 * } | null}
 */
export function getAssertionFieldsBase64Url(credential) {
  const response = credential.response;
  if (
    !("authenticatorData" in response) ||
    !response.authenticatorData ||
    !("clientDataJSON" in response) ||
    !response.clientDataJSON ||
    !("signature" in response) ||
    !response.signature
  ) {
    return null;
  }
  return {
    authenticatorData: bufferToBase64Url(response.authenticatorData),
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    signature: bufferToBase64Url(response.signature),
    credentialId: getCredentialId(credential),
  };
}
