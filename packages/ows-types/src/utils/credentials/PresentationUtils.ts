import type { PresentationFrame } from "@sd-jwt/core";
import { decodeJwt, decodeSdJwt, getClaims, splitSdJwt } from "@sd-jwt/core";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import type { IHolderSigner } from "../../credentials/holder-signer.js";
import type { PresentationDefinition } from "../../credentials/presentation.js";
import type { StoredCredential } from "../../credentials/credential.js";
import type { CredentialClaimName } from "../../primitives/CredentialClaimName.js";
import { SdJwtVcPresentationString } from "../../primitives/SdJwtVcPresentationString.js";
import { CredentialCryptoUtils } from "./CredentialCryptoUtils.js";

export type SdJwtVcIssuerClaims = {
  iss?: string;
  vct?: string;
  iat?: number;
  cnf?: { jwk?: JsonWebKey };
};

export type KbJwtClaims = {
  iat?: number;
  aud?: string;
  nonce?: string;
  sd_hash?: string;
};

export type BuildSdJwtVcPresentationInput = {
  credential: StoredCredential;
  definition: PresentationDefinition;
  holderSigner: IHolderSigner;
};

export type BuildSdJwtVcPresentationResult = {
  presentation: SdJwtVcPresentationString;
  disclosedClaims: CredentialClaimName[];
};

/** JWT / SD-JWT envelope keys excluded from credential-subject maps. */
const SD_JWT_ENVELOPE_KEYS = new Set([
  "iss",
  "iat",
  "exp",
  "nbf",
  "vct",
  "cnf",
  "status",
  "_sd",
  "_sd_alg",
  "aud",
  "sub",
  "jti",
]);

/**
 * SD-JWT VC presentation helpers: decode compact strings, unpack selective
 * disclosures, and build holder presentations with key binding.
 */
export class PresentationUtils {
  /** Decodes issuer JWT payload claims from an SD-JWT VC compact string. */
  static decodeIssuerClaims(
    encoded: SdJwtVcPresentationString | string,
  ): SdJwtVcIssuerClaims {
    const { jwt } = splitSdJwt(String(encoded));
    const { payload } = decodeJwt<Record<string, unknown>, SdJwtVcIssuerClaims>(
      jwt,
    );
    return payload;
  }

  /** Reads `cnf.jwk` from an SD-JWT VC (presentation or full credential). */
  static extractHolderJwk(
    encoded: SdJwtVcPresentationString | string,
  ): JsonWebKey | undefined {
    return PresentationUtils.decodeIssuerClaims(encoded).cnf?.jwk;
  }

  /**
   * Decodes the key-binding JWT (`kb+jwt`) claims from a presentation.
   * Returns `undefined` when no kb segment is present.
   */
  static extractKbJwtClaims(
    encoded: SdJwtVcPresentationString | string,
  ): KbJwtClaims | undefined {
    const parts = String(encoded).split("~");
    const kb = parts[parts.length - 1];
    if (!kb || !kb.includes(".")) {
      return undefined;
    }
    try {
      const { payload } = decodeJwt<Record<string, unknown>, KbJwtClaims>(kb);
      return payload;
    } catch {
      return undefined;
    }
  }

  /**
   * Unpack an SD-JWT VC compact string into a credential-subject claim map.
   *
   * Selectively disclosed claims live only in `~` disclosure segments (hashed as
   * `_sd` in the JWT). Callers that peek at the JWT payload alone miss them.
   */
  static async unpackSubject(
    sdJwt: string,
  ): Promise<Record<string, unknown>> {
    const decoded = await decodeSdJwt(sdJwt, CredentialCryptoUtils.hasher);
    const claims = await getClaims<Record<string, unknown>>(
      decoded.jwt.payload,
      decoded.disclosures,
      CredentialCryptoUtils.hasher,
    );

    const subject: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(claims)) {
      if (SD_JWT_ENVELOPE_KEYS.has(key)) continue;
      subject[key] = value;
    }
    return subject;
  }

  /** Builds a selective-disclosure SD-JWT VC presentation with holder key binding. */
  static async build(
    input: BuildSdJwtVcPresentationInput,
  ): Promise<BuildSdJwtVcPresentationResult> {
    const { credential, definition, holderSigner } = input;

    if (credential.format !== "sd-jwt-vc") {
      throw new Error(
        `PresentationUtils.build: unsupported format ${credential.format}`,
      );
    }

    // Prefer unpacked SD disclosures; selectively disclosed claims are absent
    // from the JWT payload (and thus from a naïve credentialSubject peek).
    const unpacked = await PresentationUtils.unpackSubject(credential.payload);
    const subject =
      Object.keys(unpacked).length > 0
        ? unpacked
        : credential.semantic.credentialSubject;
    const disclosedClaims = definition.requestedClaims.filter(
      (claim) => claim in subject,
    );

    if (disclosedClaims.length === 0) {
      throw new Error(
        "PresentationUtils.build: no requested claims present in credential",
      );
    }

    const presentationFrame = PresentationUtils.presentationFrameFromClaims(
      definition.requestedClaims,
      subject,
    );

    const sdjwt = new SDJwtVcInstance({
      kbSigner: (data) => holderSigner.signKbJwt(data),
      kbSignAlg: "EdDSA",
      hasher: CredentialCryptoUtils.hasher,
      hashAlg: "sha-256",
      saltGenerator: CredentialCryptoUtils.saltGenerator,
    });

    const nonce = definition.nonce;
    const audience = definition.audience ?? definition.verifier.id;
    if (!nonce) {
      throw new Error(
        "PresentationUtils.build: presentation definition requires nonce for key binding",
      );
    }

    const presentation = await sdjwt.present(
      credential.payload,
      presentationFrame,
      {
        kb: {
          payload: {
            iat: Math.floor(Date.now() / 1000),
            aud: audience,
            nonce,
          },
        },
      },
    );

    return {
      presentation: SdJwtVcPresentationString(presentation),
      disclosedClaims,
    };
  }

  private static presentationFrameFromClaims(
    requestedClaims: CredentialClaimName[],
    subject: Record<string, unknown>,
  ): PresentationFrame<Record<string, unknown>> {
    const frame: Record<string, boolean> = {};
    for (const claim of requestedClaims) {
      if (claim in subject) {
        frame[claim] = true;
      }
    }
    return frame;
  }
}
