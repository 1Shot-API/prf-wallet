import type { CredentialId, ISO8601DateTime } from "../primitives/index.js";

export type CredentialStatusCheck = {
  credentialId: CredentialId;
  status: "active" | "revoked" | "suspended" | "unknown";
  checkedAt: ISO8601DateTime;
  details?: string;
};
