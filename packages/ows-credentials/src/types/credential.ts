import type {
  CredentialId,
  CredentialIssuer,
  CredentialTypeName,
  ISO8601DateTime,
  UriString,
} from "@1shotapi/ows-types";
import type { CredentialFormat } from "./format.js";

/** W3C VC 2.0 semantic subset — transport-agnostic. */
export type CredentialStatus = {
  id?: UriString;
  type: string;
  statusListCredential?: UriString;
  statusListIndex?: string;
};

export type CredentialSchemaRef = {
  id: UriString;
  type: string;
};

export type CredentialSubject = Record<string, unknown>;

export type VerifiableCredentialSemantic = {
  id?: UriString;
  type: CredentialTypeName[];
  issuer: CredentialIssuer | { id: CredentialIssuer; name?: string };
  validFrom?: ISO8601DateTime;
  validUntil?: ISO8601DateTime;
  credentialSubject: CredentialSubject;
  credentialStatus?: CredentialStatus;
  credentialSchema?: CredentialSchemaRef;
  evidence?: unknown[];
  termsOfUse?: unknown[];
};

/** Credential as stored in the wallet (payload + metadata). */
export type StoredCredential = {
  credentialId: CredentialId;
  format: CredentialFormat;
  type: CredentialTypeName[];
  issuer: CredentialIssuer;
  issuedAt: ISO8601DateTime;
  validUntil?: ISO8601DateTime;
  /** Opaque credential payload (SD-JWT, JWT, JSON-LD doc, …). */
  payload: string;
  semantic: VerifiableCredentialSemantic;
};
