import type { CredentialId } from "../primitives/index.js";
import type { StoredCredential } from "./credential.js";
import type { CredentialFilter, CredentialSummary } from "./filter.js";

/**
 * Branding-owned credential persistence.
 * Methods take/return full {@link StoredCredential} objects (plaintext JSON at this boundary).
 * Encryption at rest is a branding implementation detail.
 */
export interface ICredentialRepository {
  store(credential: StoredCredential): Promise<void>;
  get(credentialId: CredentialId): Promise<StoredCredential | undefined>;
  list(filter?: CredentialFilter): Promise<CredentialSummary[]>;
  delete(credentialId: CredentialId): Promise<void>;
  /** Local wallet lifecycle (tombstone / hide) — not issuer-side revocation. */
  revoke(credentialId: CredentialId): Promise<void>;
}
