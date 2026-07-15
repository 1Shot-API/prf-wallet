import { ISO8601DateTime } from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialStatusCheck } from "./status.js";

/** Issuer-side status / revocation check (Token Status List, etc.). */
export interface ICredentialStatusValidator {
  checkStatus(credential: StoredCredential): Promise<CredentialStatusCheck>;
}

/** Demo default — always active. Production wallets fail closed on non-active. */
export class NoopCredentialStatusValidator implements ICredentialStatusValidator {
  async checkStatus(credential: StoredCredential): Promise<CredentialStatusCheck> {
    return {
      credentialId: credential.credentialId,
      status: "active",
      checkedAt: ISO8601DateTime(new Date().toISOString()),
    };
  }
}
