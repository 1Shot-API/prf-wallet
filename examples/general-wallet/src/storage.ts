import {
  EVMAccountAddress,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";

const WALLET_CREATED_KEY = "ows-wallet-created";
const CREDENTIAL_ID_KEY = "ows-credential-id";
const BACKUP_KEY = "ows-wallet-backup";
const EVM_ADDRESS_KEY = "ows-evm-address";
const SOLANA_ADDRESS_KEY = "ows-solana-address";

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

export function loadCachedEvmAddress(): EVMAccountAddress | undefined {
  const value = localStorage.getItem(EVM_ADDRESS_KEY);
  if (!value) {
    return undefined;
  }
  return EVMAccountAddress(value as `0x${string}`);
}

export function loadCachedSolanaAddress(): SolanaAccountAddress | undefined {
  const value = localStorage.getItem(SOLANA_ADDRESS_KEY);
  if (!value) {
    return undefined;
  }
  return SolanaAccountAddress(value);
}

export function saveCachedAddresses(
  evm: EVMAccountAddress,
  solana?: SolanaAccountAddress,
): void {
  localStorage.setItem(EVM_ADDRESS_KEY, evm);
  if (solana) {
    localStorage.setItem(SOLANA_ADDRESS_KEY, solana);
  }
}

export function clearWalletStorage(): void {
  localStorage.removeItem(WALLET_CREATED_KEY);
  localStorage.removeItem(CREDENTIAL_ID_KEY);
  localStorage.removeItem(EVM_ADDRESS_KEY);
  localStorage.removeItem(SOLANA_ADDRESS_KEY);
}

/** App-owned backup blob (`ows1:…`). */
export function saveBackup(encryptedPrivateKey: string): void {
  localStorage.setItem(BACKUP_KEY, encryptedPrivateKey);
}

export function loadBackup(): string | undefined {
  return localStorage.getItem(BACKUP_KEY) ?? undefined;
}

export function hasBackup(): boolean {
  return Boolean(loadBackup());
}
