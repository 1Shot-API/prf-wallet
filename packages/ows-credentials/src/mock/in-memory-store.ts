import type { CredentialId } from "@1shotapi/ows-types";
import type { CredentialStore } from "../storage.js";
import type { StoredCredential } from "../types/credential.js";
import type { CredentialFilter, CredentialSummary } from "../types/filter.js";

export class InMemoryCredentialStore implements CredentialStore {
  private readonly credentials = new Map<string, StoredCredential>();

  async save(credential: StoredCredential): Promise<void> {
    this.credentials.set(credential.credentialId, credential);
  }

  async get(credentialId: CredentialId): Promise<StoredCredential | undefined> {
    return this.credentials.get(credentialId);
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    const all = [...this.credentials.values()];
    const filtered = all.filter((c) => {
      if (filter?.type && !c.type.includes(filter.type)) {
        return false;
      }
      if (filter?.issuer && c.issuer !== filter.issuer) {
        return false;
      }
      return true;
    });

    return filtered.map((c) => ({
      credentialId: c.credentialId,
      type: c.type,
      issuer: c.issuer,
      format: c.format,
      issuedAt: c.issuedAt,
      validUntil: c.validUntil,
    }));
  }

  async delete(credentialId: CredentialId): Promise<void> {
    this.credentials.delete(credentialId);
  }
}
