import type {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialId,
  CredentialIssuer,
  CredentialOfferUri,
  CredentialScope,
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

export type CredentialOfferApprovalRequest = {
  issuerName: string;
  issuerId: CredentialIssuer;
  offeredCredentials: Array<{
    configurationId: CredentialConfigurationId;
    format: CredentialFormatId;
    scope?: CredentialScope;
  }>;
};
