import { getRpId } from "./state.js";
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
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
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
 * @returns {string | null}
 */
export function getPasskeyPublicKeyBase64Url(credential) {
  const response = credential.response;
  if ("getPublicKey" in response && typeof response.getPublicKey === "function") {
    const key = response.getPublicKey();
    return key ? bufferToBase64Url(key) : null;
  }
  return null;
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
