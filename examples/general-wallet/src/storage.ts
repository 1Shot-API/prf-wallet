const WALLET_CREATED_KEY = "ows-wallet-created";
const CREDENTIAL_ID_KEY = "ows-credential-id";

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
