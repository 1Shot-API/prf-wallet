import type { PresentationRequestUri } from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialSummary } from "./filter.js";
import type { IHolderSigner } from "./holder-signer.js";
import type { PresentationDefinition, PresentationResult } from "./presentation.js";

export type PresentationBuildContext = {
  holderSigner: IHolderSigner;
};

export interface IOid4vpClient {
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
