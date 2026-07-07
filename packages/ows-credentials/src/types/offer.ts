import type {
  CredentialConfigurationId,
  CredentialId,
  CredentialIssuer,
  CredentialOfferUri,
  CredentialTypeName,
} from "@1shotapi/ows-types";
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
