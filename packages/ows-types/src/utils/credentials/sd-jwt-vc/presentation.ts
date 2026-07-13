import type { PresentationFrame } from "@sd-jwt/core";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import { SdJwtVcPresentationString } from "../../../primitives/SdJwtVcPresentationString.js";
import type { CredentialClaimName } from "../../../primitives/CredentialClaimName.js";
import type { HolderSigner } from "../../../credentials/holder-signer.js";
import type { PresentationDefinition } from "../../../credentials/presentation.js";
import type { StoredCredential } from "../../../credentials/credential.js";
import { sdJwtHasher, sdJwtSaltGenerator } from "./crypto.js";
import { holderSignerToKbSigner } from "./holder-signer.js";

export type BuildSdJwtVcPresentationInput = {
  credential: StoredCredential;
  definition: PresentationDefinition;
  holderSigner: HolderSigner;
};

export type BuildSdJwtVcPresentationResult = {
  presentation: SdJwtVcPresentationString;
  disclosedClaims: CredentialClaimName[];
};

function presentationFrameFromClaims(
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

/** Builds a selective-disclosure SD-JWT VC presentation with holder key binding. */
export async function buildSdJwtVcPresentation(
  input: BuildSdJwtVcPresentationInput,
): Promise<BuildSdJwtVcPresentationResult> {
  const { credential, definition, holderSigner } = input;

  if (credential.format !== "sd-jwt-vc") {
    throw new Error(`buildSdJwtVcPresentation: unsupported format ${credential.format}`);
  }

  const subject = credential.semantic.credentialSubject;
  const disclosedClaims = definition.requestedClaims.filter(
    (claim) => claim in subject,
  );

  if (disclosedClaims.length === 0) {
    throw new Error("buildSdJwtVcPresentation: no requested claims present in credential");
  }

  const presentationFrame = presentationFrameFromClaims(
    definition.requestedClaims,
    subject,
  );

  const sdjwt = new SDJwtVcInstance({
    kbSigner: holderSignerToKbSigner(holderSigner),
    kbSignAlg: "EdDSA",
    hasher: sdJwtHasher,
    hashAlg: "sha-256",
    saltGenerator: sdJwtSaltGenerator,
  });

  const nonce = definition.nonce;
  const audience = definition.audience ?? definition.verifier.id;
  if (!nonce) {
    throw new Error("buildSdJwtVcPresentation: presentation definition requires nonce for key binding");
  }

  const presentation = await sdjwt.present(credential.payload, presentationFrame, {
    kb: {
      payload: {
        iat: Math.floor(Date.now() / 1000),
        aud: audience,
        nonce,
      },
    },
  });

  return {
    presentation: SdJwtVcPresentationString(presentation),
    disclosedClaims,
  };
}
