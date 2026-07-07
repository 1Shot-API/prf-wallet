import { ISO8601DateTime } from "@1shotapi/ows-types";
import type { StoredCredential } from "../types/credential.js";
import type { CredentialStatusCheck } from "../types/status.js";

export interface CredentialStatusValidator {
  checkStatus(credential: StoredCredential): Promise<CredentialStatusCheck>;
}

export class NoopCredentialStatusValidator implements CredentialStatusValidator {
  async checkStatus(credential: StoredCredential): Promise<CredentialStatusCheck> {
    return {
      credentialId: credential.credentialId,
      status: "active",
      checkedAt: ISO8601DateTime(new Date().toISOString()),
    };
  }
}
