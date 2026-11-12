import type { PresentationRequestUri } from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialSummary } from "./filter.js";
import type { IHolderSigner } from "./holder-signer.js";
import type {
  Oid4vpAuthorizationRequest,
  PresentationDefinition,
  PresentationResult,
} from "./presentation.js";
import type { IWalletAttestationProvider } from "./wallet-attestation.js";

export type PresentationBuildContext = {
  holderSigner: IHolderSigner;
  /** Optional provider when verifier client_metadata requires attestation. */
  attestationProvider?: IWalletAttestationProvider;
  /** Full auth request when resolved from HTTP `request_uri` (for response_uri / encryption). */
  authorizationRequest?: Oid4vpAuthorizationRequest;
};

export interface IOid4vpClient {
  resolveRequest(uri: PresentationRequestUri): Promise<PresentationDefinition>;
  /**
   * Optional: return full authorization request after resolve (HTTP clients).
   * Used for response_uri posting and encryption.
   */
  getAuthorizationRequest?(
    definitionId: string,
  ): Oid4vpAuthorizationRequest | undefined;
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
