const WALLET_CREATED_KEY = "ows-wallet-created";
const CREDENTIAL_ID_KEY = "ows-credential-id";
const BACKUP_KEY = "ows-wallet-backup";

export function isWalletCreated(): boolean {
  return localStorage.getItem(WALLET_CREATED_KEY) === "true";
}

export function loadCredentialId(): string | undefined {
  return localStorage.getItem(CREDENTIAL_ID_KEY) ?? undefined;
}

export function saveWalletCreated(credentialId: string): void {
  localStorage.setItem(WALLET_CREATED_KEY, "true");
  localStorage.setItem(CREDENTIAL_ID_KEY, credentialId);
}

/** App-owned backup blob (`ows1:…`) — not part of registry module contracts. */
export function saveBackup(encryptedPrivateKey: string): void {
  localStorage.setItem(BACKUP_KEY, encryptedPrivateKey);
}

export function loadBackup(): string | undefined {
  return localStorage.getItem(BACKUP_KEY) ?? undefined;
}

export function hasBackup(): boolean {
  return Boolean(loadBackup());
}
