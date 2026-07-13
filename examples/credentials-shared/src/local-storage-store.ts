import type { CredentialId } from "@1shotapi/ows-types";
import type {
  CredentialStore,
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

/** MOCK — persists credentials in localStorage for multi-tab demo flows. */
export class LocalStorageCredentialStore implements CredentialStore {
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

  async save(credential: StoredCredential): Promise<void> {
    const all = this.readAll();
    all.set(credential.credentialId, credential);
    this.writeAll(all);
  }

  async get(credentialId: CredentialId): Promise<StoredCredential | undefined> {
    return this.readAll().get(credentialId);
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    return summarize(this.readAll().values(), filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
    const all = this.readAll();
    all.delete(credentialId);
    this.writeAll(all);
  }

  private readAll(): Map<string, StoredCredential> {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      return new Map();
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, StoredCredential>;
      return new Map(Object.entries(parsed));
    } catch {
      return new Map();
    }
  }

  private writeAll(credentials: Map<string, StoredCredential>): void {
    if (credentials.size === 0) {
      this.storage.removeItem(this.storageKey);
      return;
    }

    this.storage.setItem(
      this.storageKey,
      JSON.stringify(Object.fromEntries(credentials)),
    );
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
