import type { CredentialId } from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialFilter, CredentialSummary } from "./filter.js";

export interface CredentialStore {
  save(credential: StoredCredential): Promise<void>;
  get(credentialId: CredentialId): Promise<StoredCredential | undefined>;
  list(filter?: CredentialFilter): Promise<CredentialSummary[]>;
  delete(credentialId: CredentialId): Promise<void>;
}
