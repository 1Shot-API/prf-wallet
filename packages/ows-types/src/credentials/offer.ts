import type {
  CredentialConfigurationId,
  CredentialId,
  CredentialIssuer,
  CredentialOfferUri,
  CredentialTypeName,
} from "../primitives/index.js";
import type { CredentialFormat } from "./format.js";

export type CredentialOffer = {
  credentialIssuer: CredentialIssuer;
  credentialConfigurationIds: CredentialConfigurationId[];
  grants?: Record<string, unknown>;
};

export type CredentialOfferInput = {
  credentialOfferUri?: CredentialOfferUri;
  offer?: CredentialOffer;
};

export type CredentialReceipt = {
  credentialId: CredentialId;
  format: CredentialFormat;
  type: CredentialTypeName[];
};
