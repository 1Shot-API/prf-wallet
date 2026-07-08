import type { UriString } from "@1shotapi/ows-types";
import type { HolderSigner } from "../sd-jwt-vc/holder-signer.js";
import type { StoredCredential } from "../types/credential.js";
import type { PresentationDefinition, PresentationResult } from "../types/presentation.js";
import type { CredentialSummary } from "../types/filter.js";

export type PresentationBuildContext = {
  holderSigner: HolderSigner;
};

export interface Oid4vpClient {
  resolveRequest(uri: UriString): Promise<PresentationDefinition>;
  matchCredentials(
    definition: PresentationDefinition,
    credentials: CredentialSummary[],
  ): Promise<CredentialSummary[]>;
  buildPresentation(
    credential: StoredCredential,
    definition: PresentationDefinition,
    context?: PresentationBuildContext,
  ): Promise<PresentationResult>;
}
