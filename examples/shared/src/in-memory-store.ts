import type { CredentialId } from "@1shotapi/ows-types";
import type {
  ICredentialRepository,
  StoredCredential,
  CredentialFilter,
  CredentialSummary,
} from "@1shotapi/ows-types";

export class InMemoryCredentialRepository implements ICredentialRepository {
  private readonly credentials = new Map<string, StoredCredential>();
  private readonly revoked = new Set<string>();

  async store(credential: StoredCredential): Promise<void> {
    this.credentials.set(credential.credentialId, credential);
    this.revoked.delete(credential.credentialId);
  }

  async get(credentialId: CredentialId): Promise<StoredCredential | undefined> {
    if (this.revoked.has(credentialId)) {
      return undefined;
    }
    return this.credentials.get(credentialId);
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    const all = [...this.credentials.values()].filter(
      (c) => !this.revoked.has(c.credentialId),
    );
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
    this.revoked.delete(credentialId);
  }

  async revoke(credentialId: CredentialId): Promise<void> {
    if (this.credentials.has(credentialId)) {
      this.revoked.add(credentialId);
    }
  }
}
