import type {
  CredentialId,
  CredentialIssuer,
  CredentialTypeName,
  ISO8601DateTime,
} from "../primitives/index.js";
import type { CredentialFormat } from "./format.js";

export type CredentialFilter = {
  type?: CredentialTypeName;
  issuer?: CredentialIssuer;
};

export type CredentialSummary = {
  credentialId: CredentialId;
  type: CredentialTypeName[];
  issuer: CredentialIssuer;
  format: CredentialFormat;
  issuedAt: ISO8601DateTime;
  validUntil?: ISO8601DateTime;
};
