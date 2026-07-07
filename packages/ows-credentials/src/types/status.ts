import type { CredentialId, ISO8601DateTime } from "@1shotapi/ows-types";

export type CredentialStatusCheck = {
  credentialId: CredentialId;
  status: "active" | "revoked" | "suspended" | "unknown";
  checkedAt: ISO8601DateTime;
  details?: string;
};
