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

/** Pre-authorized code grant (OID4VCI). */
export type PreAuthorizedCodeGrant = {
  "pre-authorized_code": string;
  tx_code?: {
    input_mode?: string;
    length?: number;
    description?: string;
  };
  user_pin_required?: boolean;
};

export type CredentialOfferGrants = {
  "urn:ietf:params:oauth:grant-type:pre-authorized_code"?: PreAuthorizedCodeGrant;
};

export type CredentialOffer = {
  credentialIssuer: CredentialIssuer;
  credentialConfigurationIds: CredentialConfigurationId[];
  grants?: CredentialOfferGrants;
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
