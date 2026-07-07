import type { CredentialId } from "@1shotapi/ows-types";
import type { StoredCredential } from "./types/credential.js";
import type { CredentialFilter, CredentialSummary } from "./types/filter.js";

export interface CredentialStore {
  save(credential: StoredCredential): Promise<void>;
  get(credentialId: CredentialId): Promise<StoredCredential | undefined>;
  list(filter?: CredentialFilter): Promise<CredentialSummary[]>;
  delete(credentialId: CredentialId): Promise<void>;
}
