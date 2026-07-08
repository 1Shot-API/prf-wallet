import { ISO8601DateTime } from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialStatusCheck } from "./status.js";

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
