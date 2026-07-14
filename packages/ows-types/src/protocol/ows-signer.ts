import type { AES256CipherText } from "../primitives/AES256CipherText.js";
import type { EVMAccountAddress } from "../primitives/EVMAccountAddress.js";
import type { HexString } from "../primitives/HexString.js";
import type { SolanaAccountAddress } from "../primitives/SolanaAccountAddress.js";
import type {
  CreateCredentialOptions,
  CredentialCreatedData,
  DigestSignedData,
  GetPublicKeyParams,
  PublicKeyData,
  RecoveryDataCreatedData,
  SignScheme,
  VersionData,
} from "./signer.js";

/**
 * Branding Layer ↔ Signing Layer contract.
 *
 * Implemented by `OWSSigner` in `@1shotapi/ows-signer-utils`. Prefer this
 * interface in add-ons (e.g. `@1shotapi/ows-oid4`) over depending on the
 * concrete class or inventing duck-typed clones.
 */
export interface IOWSSigner {
  getCredentialId(): string | undefined;
  getLastPublicKeyData(): PublicKeyData | undefined;
  getCachedAddress(): EVMAccountAddress | undefined;
  setCachedAddress(address: EVMAccountAddress): void;
  getCachedSolanaAddress(): SolanaAccountAddress | undefined;
  setCachedSolanaAddress(address: SolanaAccountAddress): void;

  getVersion(): Promise<VersionData>;
  createCredential(
    name: string,
    options?: CreateCredentialOptions,
  ): Promise<CredentialCreatedData>;
  signDigest(
    digestData: HexString | `0x${string}`,
    scheme?: SignScheme,
    credentialId?: string,
  ): Promise<DigestSignedData>;
  getPublicKey(
    params?: GetPublicKeyParams,
  ): Promise<PublicKeyData & { challengeSignature?: string }>;
  createRecoveryData(
    passwordText: string,
    buttonText: string,
    minPasswordLength: number,
    credentialId?: string,
  ): Promise<RecoveryDataCreatedData>;
  recoverKey(
    aes256EncryptedPrivateKey: string,
    passwordText: string,
    buttonText: string,
    credentialId?: string,
  ): Promise<void>;
  revealPrivateKey(credentialId?: string): Promise<void>;
  clearRecoverySession(): Promise<void>;
  encryptAES256(
    plaintexts: string[],
    credentialId?: string,
  ): Promise<AES256CipherText[]>;
  decryptAES256(
    ciphertexts: AES256CipherText[],
    credentialId?: string,
  ): Promise<string[]>;
  destroy(): void;
}
