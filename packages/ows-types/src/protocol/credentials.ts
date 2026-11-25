import type { CredentialId } from "../primitives/CredentialId.js";
import type { CredentialOfferInput, CredentialReceipt } from "../credentials/offer.js";
import type { CredentialFilter, CredentialSummary } from "../credentials/filter.js";
import type {
  PresentationRequestInput,
  PresentationResult,
} from "../credentials/presentation.js";

/** Namespaced Postmate wire keys — not generic RPC method names. */
export const CREDENTIAL_WIRE_METHODS = {
  acceptOffer: "credentials.acceptOffer",
  present: "credentials.present",
  list: "credentials.list",
  delete: "credentials.delete",
} as const;

export type CredentialWireMethod =
  (typeof CREDENTIAL_WIRE_METHODS)[keyof typeof CREDENTIAL_WIRE_METHODS];

/** Shared contract for proxy.credentials (host) and wallet.credentials (branding). */
export interface OpenWalletCredentialProvider {
  acceptOffer(input: CredentialOfferInput): Promise<CredentialReceipt>;
  present(input: PresentationRequestInput): Promise<PresentationResult>;
  list(filter?: CredentialFilter): Promise<CredentialSummary[]>;
  delete(input: { credentialId: CredentialId }): Promise<void>;
}
