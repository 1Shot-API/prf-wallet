import type { PresentationRequestUri } from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialSummary } from "./filter.js";
import type { HolderSigner } from "./holder-signer.js";
import type { PresentationDefinition, PresentationResult } from "./presentation.js";

export type PresentationBuildContext = {
  holderSigner: HolderSigner;
};

export interface Oid4vpClient {
  resolveRequest(uri: PresentationRequestUri): Promise<PresentationDefinition>;
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
