import type { IHolderSigner } from "../../credentials/holder-signer.js";
import { Base64UrlEncodedString } from "../../primitives/Base64UrlEncodedString.js";
import type { ED25519PublicKey } from "../../primitives/ED25519PublicKey.js";
import { HexString } from "../../primitives/HexString.js";
import { ConversionUtils } from "../ConversionUtils.js";
import type { Hasher, SaltGenerator, Signer, Verifier } from "@sd-jwt/core";

/** Signing Layer hooks used to build an SD-JWT VC {@link IHolderSigner}. */
export interface IOwsEd25519HolderSignerDeps {
  getEd25519PublicKeyHex: () => Promise<ED25519PublicKey>;
  signDigest: (
    digests: Array<{ digestData: HexString; scheme?: "ed25519" }>,
  ) => Promise<Array<{ signature: HexString }>>;
}

function toHashBytes(data: string | ArrayBuffer): Uint8Array {
  return typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
}

/** Web Crypto expects BufferSource backed by ArrayBuffer, not ArrayBufferLike. */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return new Uint8Array(bytes);
}

/**
 * Web Crypto helpers for SD-JWT VC / OID4 credential flows (hash, salt, Ed25519).
 */
export class CredentialCryptoUtils {
  /**
   * SHA-256 hasher for `@sd-jwt/core` (`Hasher` contract).
   * Algorithm strings must include `sha-256`.
   */
  static readonly hasher: Hasher = async (data, alg) => {
    if (!alg.includes("sha-256")) {
      throw new Error(
        `CredentialCryptoUtils.hasher: unsupported algorithm ${alg}`,
      );
    }
    const digest = await crypto.subtle.digest(
      "SHA-256",
      asBufferSource(toHashBytes(data)),
    );
    return new Uint8Array(digest);
  };

  /** Random salt generator for SD-JWT disclosures (`SaltGenerator` contract). */
  static readonly saltGenerator: SaltGenerator = async (length) => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return ConversionUtils.bytesToBase64Url(bytes);
  };

  static importEd25519PrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, [
      "sign",
    ]);
  }

  static importEd25519PublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
    return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, [
      "verify",
    ]);
  }

  /** Sign UTF-8 `data` with an Ed25519 private JWK; returns branded base64url. */
  static async signEd25519(
    privateJwk: JsonWebKey,
    data: string,
  ): Promise<Base64UrlEncodedString> {
    const key = await CredentialCryptoUtils.importEd25519PrivateKey(privateJwk);
    const signature = await crypto.subtle.sign(
      "Ed25519",
      key,
      asBufferSource(new TextEncoder().encode(data)),
    );
    return ConversionUtils.bytesToBase64Url(new Uint8Array(signature));
  }

  /** Verify an Ed25519 signature over UTF-8 `data`. */
  static async verifyEd25519(
    publicJwk: JsonWebKey,
    data: string,
    signatureBase64Url: Base64UrlEncodedString,
  ): Promise<boolean> {
    const key = await CredentialCryptoUtils.importEd25519PublicKey(publicJwk);
    return crypto.subtle.verify(
      "Ed25519",
      key,
      asBufferSource(ConversionUtils.base64UrlToBytes(signatureBase64Url)),
      asBufferSource(new TextEncoder().encode(data)),
    );
  }

  /** `@sd-jwt/core` `Signer` backed by an Ed25519 private JWK. */
  static createEd25519Signer(privateJwk: JsonWebKey): Signer {
    return (data) => CredentialCryptoUtils.signEd25519(privateJwk, data);
  }

  /** `@sd-jwt/core` `Verifier` backed by an Ed25519 public JWK. */
  static createEd25519Verifier(publicJwk: JsonWebKey): Verifier {
    return (data, sig) =>
      CredentialCryptoUtils.verifyEd25519(
        publicJwk,
        data,
        Base64UrlEncodedString(sig),
      );
  }

  /**
   * Bridges OWS Signing Layer Ed25519 (`signDigest` / public key hex) to
   * SD-JWT VC {@link IHolderSigner} key binding.
   */
  static createOwsEd25519HolderSigner(
    deps: IOwsEd25519HolderSignerDeps,
  ): IHolderSigner {
    let cachedJwk: JsonWebKey | undefined;

    return {
      async publicKeyJwk() {
        if (cachedJwk) {
          return cachedJwk;
        }
        const hex = await deps.getEd25519PublicKeyHex();
        const bytes = ConversionUtils.hexToBytes(HexString(hex));
        if (bytes.length !== 32) {
          throw new Error(
            "CredentialCryptoUtils.createOwsEd25519HolderSigner: ed25519 public key must be 32 bytes",
          );
        }
        cachedJwk = {
          kty: "OKP",
          crv: "Ed25519",
          x: ConversionUtils.bytesToBase64Url(bytes),
        };
        return cachedJwk;
      },
      async signKbJwt(unsignedJwt) {
        const digestHex = ConversionUtils.utf8ToHex(unsignedJwt);
        const [result] = await deps.signDigest([
          { digestData: digestHex, scheme: "ed25519" },
        ]);
        if (!result) {
          throw new Error(
            "CredentialCryptoUtils.createOwsEd25519HolderSigner: empty signDigest result",
          );
        }
        return ConversionUtils.bytesToBase64Url(
          ConversionUtils.hexToBytes(result.signature),
        );
      },
    };
  }
}
