import type { CredentialId } from "@1shotapi/ows-types";
import type {
  ICredentialRepository,
  StoredCredential,
  CredentialFilter,
  CredentialSummary,
} from "@1shotapi/ows-types";

/** localStorage key for demo credentials (shared across wallet iframe loads on one origin). */
export const OWS_MOCK_CREDENTIALS_STORAGE_KEY = "ows.mock.credentials.v1";

/** Minimal sync key/value API (localStorage or test double). */
export type CredentialStorageBackend = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StoredBlob = {
  credentials: Record<string, StoredCredential>;
  revoked: string[];
};

function summarize(
  credentials: Iterable<StoredCredential>,
  filter?: CredentialFilter,
): CredentialSummary[] {
  const filtered = [...credentials].filter((c) => {
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

/** MOCK — persists credentials in localStorage for multi-tab demo flows (plaintext). */
export class LocalStorageCredentialRepository implements ICredentialRepository {
  private readonly storageKey: string;
  private readonly storage: CredentialStorageBackend;

  constructor(
    options: {
      storageKey?: string;
      storage?: CredentialStorageBackend;
    } = {},
  ) {
    this.storageKey =
      options.storageKey ?? OWS_MOCK_CREDENTIALS_STORAGE_KEY;
    this.storage =
      options.storage ??
      (typeof localStorage !== "undefined"
        ? localStorage
        : createMemoryStorageBackend());
  }

  async store(credential: StoredCredential): Promise<void> {
    const blob = this.readBlob();
    blob.credentials[credential.credentialId] = credential;
    blob.revoked = blob.revoked.filter((id) => id !== credential.credentialId);
    this.writeBlob(blob);
  }

  async get(credentialId: CredentialId): Promise<StoredCredential | undefined> {
    const blob = this.readBlob();
    if (blob.revoked.includes(credentialId)) {
      return undefined;
    }
    return blob.credentials[credentialId];
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    const blob = this.readBlob();
    const active = Object.values(blob.credentials).filter(
      (c) => !blob.revoked.includes(c.credentialId),
    );
    return summarize(active, filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
    const blob = this.readBlob();
    delete blob.credentials[credentialId];
    this.writeBlob(blob);
  }

  async revoke(credentialId: CredentialId): Promise<void> {
    const blob = this.readBlob();
    if (blob.credentials[credentialId] && !blob.revoked.includes(credentialId)) {
      blob.revoked.push(credentialId);
      this.writeBlob(blob);
    }
  }

  private readBlob(): StoredBlob {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return { credentials: {}, revoked: [] };
    }

    try {
      const parsed = JSON.parse(raw) as
        | StoredBlob
        | Record<string, StoredCredential>;
      if (
        parsed &&
        typeof parsed === "object" &&
        "credentials" in parsed &&
        typeof (parsed as StoredBlob).credentials === "object"
      ) {
        const blob = parsed as StoredBlob;
        return {
          credentials: blob.credentials ?? {},
          revoked: Array.isArray(blob.revoked) ? blob.revoked : [],
        };
      }
      // Legacy shape: flat id → credential map
      return {
        credentials: parsed as Record<string, StoredCredential>,
        revoked: [],
      };
    } catch {
      return { credentials: {}, revoked: [] };
    }
  }

  private writeBlob(blob: StoredBlob): void {
    const credCount = Object.keys(blob.credentials).length;
    if (credCount === 0 && blob.revoked.length === 0) {
      this.storage.removeItem(this.storageKey);
      return;
    }

    this.storage.setItem(this.storageKey, JSON.stringify(blob));
  }
}

/** In-memory backend for Node tests and SSR fallbacks. */
export function createMemoryStorageBackend(): CredentialStorageBackend {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
