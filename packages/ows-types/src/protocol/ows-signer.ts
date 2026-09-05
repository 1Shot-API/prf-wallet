import type { AES256CipherText } from "../primitives/AES256CipherText.js";
import type { BitcoinChainId } from "../primitives/BitcoinChainId.js";
import type { BitcoinSegwitAccountAddress } from "../primitives/BitcoinSegwitAccountAddress.js";
import type { CredentialId } from "../primitives/CredentialId.js";
import type { EVMAccountAddress } from "../primitives/EVMAccountAddress.js";
import type { HexString } from "../primitives/HexString.js";
import type { SolanaAccountAddress } from "../primitives/SolanaAccountAddress.js";
import type {
  CeremonyUiParams,
  CreateCredentialOptions,
  CredentialCreatedData,
  DigestSignedData,
  ExecuteBatchParams,
  ExecuteBatchResult,
  GetPublicKeyParams,
  PublicKeyData,
  RecoveryCeremonyOptions,
  RecoveryDataCreatedData,
  SignScheme,
  VersionData,
  WebAuthnAssertionFields,
} from "./signer.js";

/**
 * Branding Layer ↔ Signing Layer contract.
 *
 * Implemented by `OWSSigner` in `@1shotapi/ows-signer-utils`. Prefer this
 * interface in add-ons (e.g. `@1shotapi/ows-oid4`) over depending on the
 * concrete class or inventing duck-typed clones.
 */
export interface IOWSSigner {
  getCredentialId(): CredentialId | undefined;
  getLastPublicKeyData(): PublicKeyData | undefined;
  getCachedAddress(): EVMAccountAddress | undefined;
  setCachedAddress(address: EVMAccountAddress): void;
  getCachedSolanaAddress(): SolanaAccountAddress | undefined;
  setCachedSolanaAddress(address: SolanaAccountAddress): void;
  getCachedBitcoinSegwitAddress(
    chainId?: BitcoinChainId,
  ): BitcoinSegwitAccountAddress | undefined;
  setCachedBitcoinSegwitAddress(
    chainId: BitcoinChainId,
    address: BitcoinSegwitAccountAddress,
  ): void;

  getVersion(): Promise<VersionData>;
  createCredential(
    name: string,
    options?: CreateCredentialOptions,
  ): Promise<CredentialCreatedData>;
  /**
   * Sign digests under one passkey ceremony.
   * Default scheme per item (when omitted on the call site) is
   * `secp256k1-ecdsa-recoverable`.
   */
  signDigest(
    digests: Array<{
      digestData: HexString | `0x${string}`;
      scheme?: SignScheme;
    }>,
    options?: CeremonyUiParams & { credentialId?: CredentialId },
  ): Promise<DigestSignedData[]>;
  executeBatch(params: ExecuteBatchParams): Promise<ExecuteBatchResult>;
  getPublicKey(
    params: GetPublicKeyParams & { challenge: `0x${string}` },
  ): Promise<PublicKeyData & { assertion: WebAuthnAssertionFields }>;
  getPublicKey(
    params?: GetPublicKeyParams,
  ): Promise<PublicKeyData & { assertion?: WebAuthnAssertionFields }>;
  createRecoveryData(
    passwordText: string,
    buttonText: string,
    minPasswordLength: number,
    options?: RecoveryCeremonyOptions,
  ): Promise<RecoveryDataCreatedData>;
  recoverKey(
    aes256EncryptedPrivateKey: string,
    passwordText: string,
    buttonText: string,
    options?: RecoveryCeremonyOptions,
  ): Promise<void>;
  revealPrivateKey(options?: RecoveryCeremonyOptions): Promise<void>;
  /** Paste a hex private key into the Signing Layer; starts a tab recovery session. */
  importPrivateKey(): Promise<void>;
  clearRecoverySession(): Promise<void>;
  encryptAES256(
    plaintexts: string[],
    options?: CeremonyUiParams & { credentialId?: CredentialId },
  ): Promise<AES256CipherText[]>;
  decryptAES256(
    ciphertexts: AES256CipherText[],
    options?: CeremonyUiParams & { credentialId?: CredentialId },
  ): Promise<string[]>;
  destroy(): void;
}
