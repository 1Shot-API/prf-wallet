import {
  Base64UrlEncodedString,
  ConversionUtils,
  CredentialId,
  EVMAccountAddress,
  JSONString,
  SolanaAccountAddress,
  AES256CipherText,
} from "@1shotapi/ows-types";
import type {
  ED25519PublicKey,
  SECP256K1PublicKey,
  CeremonyUiParams,
  CreateCredentialOptions,
  CredentialCreatedData,
  DigestSignedData,
  DigestSignedResult,
  ExecuteBatchParams,
  ExecuteBatchResult,
  GetPublicKeyParams,
  PublicKeyData,
  RecoveryCeremonyOptions,
  RecoveryDataCreatedData,
  SignScheme,
  VersionData,
  EncryptAES256Result,
  DecryptAES256Result,
  IOWSSigner,
  WebAuthnAssertionFields,
} from "@1shotapi/ows-types";
import type { Hex } from "viem";
import { publicKeyToAddress } from "viem/utils";
import { createSignerIframe, getSignerOrigin, showSignerCeremonyPanel } from "./iframe.js";
import { EvmSigner } from "./evm/namespace.js";
import { addressFromEd25519PublicKey } from "./solana/address.js";
import { SolanaSigner } from "./solana/namespace.js";
import {
  keyDerivedDataFromEvent,
  credentialCreatedDataFromEvent,
  publicKeyDataFromEvent,
  SignerRpcClient,
} from "./rpc/client.js";

export type OWSSignerOptions = {
  credentialId?: CredentialId;
  hidden?: boolean;
  rpcTimeoutMs?: number;
};

const DEFAULT_CEREMONY_UI: Required<CeremonyUiParams> = {
  explanationHeader: "Confirm passkey",
  explanationText: "Your device will ask for a passkey to continue.",
  confirmButtonText: "Continue",
  denyButtonText: "Cancel",
};

function withCeremonyDefaults(
  fields?: CeremonyUiParams,
): Required<CeremonyUiParams> {
  return {
    explanationHeader:
      fields?.explanationHeader ?? DEFAULT_CEREMONY_UI.explanationHeader,
    explanationText:
      fields?.explanationText ?? DEFAULT_CEREMONY_UI.explanationText,
    confirmButtonText:
      fields?.confirmButtonText ?? DEFAULT_CEREMONY_UI.confirmButtonText,
    denyButtonText:
      fields?.denyButtonText ?? DEFAULT_CEREMONY_UI.denyButtonText,
  };
}

/**
 * Decode Signing Layer wire assertion (base64url fields) into branded values.
 */
function webAuthnAssertionFromEvent(
  value: unknown,
): WebAuthnAssertionFields | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.authenticatorData !== "string" ||
    typeof record.clientDataJSON !== "string" ||
    typeof record.signature !== "string" ||
    typeof record.credentialId !== "string"
  ) {
    return undefined;
  }
  try {
    const authenticatorData = ConversionUtils.bytesToHex(
      ConversionUtils.base64UrlToBytes(
        Base64UrlEncodedString(record.authenticatorData),
      ),
    );
    const signature = ConversionUtils.bytesToHex(
      ConversionUtils.base64UrlToBytes(
        Base64UrlEncodedString(record.signature),
      ),
    );
    const clientDataUtf8 = new TextDecoder().decode(
      ConversionUtils.base64UrlToBytes(
        Base64UrlEncodedString(record.clientDataJSON),
      ),
    );
    JSON.parse(clientDataUtf8);
    return {
      authenticatorData,
      clientDataJSON: JSONString(clientDataUtf8),
      signature,
      credentialId: CredentialId(record.credentialId),
    };
  } catch {
    return undefined;
  }
}

export class OWSSigner implements IOWSSigner {
  readonly evm: EvmSigner;
  readonly solana: SolanaSigner;

  private readonly rpc: SignerRpcClient;
  private credentialId?: CredentialId;
  private cachedAddress?: EVMAccountAddress;
  private cachedSolanaAddress?: SolanaAccountAddress;
  private lastPublicKeyData?: PublicKeyData;

  private constructor(
    private readonly iframe: HTMLIFrameElement,
    rpc: SignerRpcClient,
    options?: OWSSignerOptions,
  ) {
    this.rpc = rpc;
    this.credentialId = options?.credentialId;
    this.evm = new EvmSigner(this);
    this.solana = new SolanaSigner(this);
  }

  static async create(
    container: HTMLElement,
    signerUrl: string,
    options?: OWSSignerOptions,
  ): Promise<OWSSigner> {
    const iframe = await createSignerIframe(container, signerUrl, {
      hidden: options?.hidden,
    });
    const signerOrigin = getSignerOrigin(signerUrl);
    const rpc = new SignerRpcClient(
      iframe,
      signerOrigin,
      options?.rpcTimeoutMs,
    );
    return new OWSSigner(iframe, rpc, options);
  }

  getCredentialId(): CredentialId | undefined {
    return this.credentialId;
  }

  /**
   * Drop session credential id and address cache (e.g. branding “change account”).
   * Does not clear Branding Layer localStorage — callers clear that separately.
   */
  clearSession(): void {
    this.credentialId = undefined;
    this.cachedAddress = undefined;
    this.cachedSolanaAddress = undefined;
    this.lastPublicKeyData = undefined;
  }

  getCachedAddress(): EVMAccountAddress | undefined {
    return this.cachedAddress;
  }

  setCachedAddress(address: EVMAccountAddress): void {
    this.cachedAddress = address;
  }

  getCachedSolanaAddress(): SolanaAccountAddress | undefined {
    return this.cachedSolanaAddress;
  }

  setCachedSolanaAddress(address: SolanaAccountAddress): void {
    this.cachedSolanaAddress = address;
  }

  /** Last `getPublicKey` result in this session — avoids repeat WebAuthn for holder binding. */
  getLastPublicKeyData(): PublicKeyData | undefined {
    return this.lastPublicKeyData;
  }

  destroy(): void {
    this.rpc.destroy();
    this.iframe.remove();
  }

  private onKeyDerived = (data: Record<string, unknown>): void => {
    const derived = keyDerivedDataFromEvent(data);
    if (derived) {
      this.lastPublicKeyData = {
        cosePublicKey: null,
        secp256k1PublicKey: derived.secp256k1PublicKey,
        ed25519PublicKey: derived.ed25519PublicKey,
        credentialId: this.credentialId,
      };
      this.cacheAddressesFromPublicKeys(
        derived.secp256k1PublicKey,
        derived.ed25519PublicKey,
      );
    }
  };

  private cacheAddressesFromPublicKeys(
    secp256k1PublicKey: SECP256K1PublicKey,
    ed25519PublicKey: ED25519PublicKey,
  ): void {
    if (!this.cachedAddress) {
      this.cachedAddress = EVMAccountAddress(
        publicKeyToAddress(secp256k1PublicKey),
      );
    }
    if (!this.cachedSolanaAddress) {
      this.cachedSolanaAddress =
        addressFromEd25519PublicKey(ed25519PublicKey);
    }
  }

  private cacheAddressFromPublicKey(publicKey: SECP256K1PublicKey): void {
    if (this.cachedAddress) return;
    this.cachedAddress = EVMAccountAddress(publicKeyToAddress(publicKey));
  }

  private async withCeremonyPanel<T>(run: () => Promise<T>): Promise<T> {
    const restore = showSignerCeremonyPanel(this.iframe);
    try {
      return await run();
    } finally {
      restore();
    }
  }

  async getVersion(): Promise<VersionData> {
    return this.rpc.request<VersionData>("getVersion", undefined, {
      terminalEvent: "Version",
    });
  }

  async createCredential(
    name: string,
    options?: CreateCredentialOptions,
  ): Promise<CredentialCreatedData> {
    const ceremony = withCeremonyDefaults(options);
    return this.withCeremonyPanel(async () => {
      const result = await this.rpc.request<Record<string, unknown>>(
        "createCredential",
        {
          name,
          options: {
            ...options,
            ...ceremony,
          },
        },
        {
          terminalEvent: "CredentialCreated",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
      const created = credentialCreatedDataFromEvent(result);
      if (!created) {
        throw new Error("createCredential: invalid CredentialCreated payload");
      }
      this.credentialId = created.credentialId;
      if (created.secp256k1PublicKey) {
        this.cacheAddressFromPublicKey(created.secp256k1PublicKey);
      }
      return created;
    });
  }

  async signDigest(
    digests: Array<{
      digestData: Hex;
      scheme?: SignScheme;
    }>,
    options?: CeremonyUiParams & { credentialId?: string },
  ): Promise<DigestSignedData[]> {
    const ceremony = withCeremonyDefaults(options);
    return this.withCeremonyPanel(async () => {
      const result = await this.rpc.request<DigestSignedResult>(
        "signDigest",
        {
          digests: digests.map((item) => ({
            digestData: item.digestData,
            scheme: item.scheme ?? "secp256k1-ecdsa-recoverable",
          })),
          credentialId: options?.credentialId ?? this.credentialId,
          ...ceremony,
        },
        {
          terminalEvent: "DigestSigned",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
      const firstCredentialId = result.results.find((r) => r.credentialId)
        ?.credentialId;
      if (firstCredentialId) {
        this.credentialId = firstCredentialId;
      }
      return result.results;
    });
  }

  /**
   * Mixed ceremony: digests, AES encrypt/decrypt, public key, and/or
   * WebAuthn challenge auth under one passkey assertion.
   */
  async executeBatch(params: ExecuteBatchParams): Promise<ExecuteBatchResult> {
    const ceremony = withCeremonyDefaults(params);
    return this.withCeremonyPanel(async () => {
      const result = await this.rpc.request<ExecuteBatchResult>(
        "executeBatch",
        {
          ...params,
          ...ceremony,
          credentialId: params.credentialId ?? this.credentialId,
        },
        {
          terminalEvent: "BatchExecuted",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
      if (result.credentialId) {
        this.credentialId = result.credentialId;
      }
      if (result.publicKey) {
        this.lastPublicKeyData = result.publicKey;
        this.cacheAddressesFromPublicKeys(
          result.publicKey.secp256k1PublicKey,
          result.publicKey.ed25519PublicKey,
        );
      }
      const assertion = webAuthnAssertionFromEvent(result.assertion);
      if (params.challenge !== undefined && !assertion) {
        throw new Error(
          "executeBatch: challenge was supplied but assertion fields missing",
        );
      }
      return assertion ? { ...result, assertion } : { ...result, assertion: undefined };
    });
  }

  async getPublicKey(
    params: GetPublicKeyParams & { challenge: `0x${string}` },
  ): Promise<PublicKeyData & { assertion: WebAuthnAssertionFields }>;
  async getPublicKey(
    params?: GetPublicKeyParams,
  ): Promise<PublicKeyData & { assertion?: WebAuthnAssertionFields }>;
  async getPublicKey(
    params?: GetPublicKeyParams,
  ): Promise<PublicKeyData & { assertion?: WebAuthnAssertionFields }> {
    const hasChallenge = params?.challenge !== undefined;
    const credentialId = params?.discoverable
      ? undefined
      : (params?.credentialId ?? this.credentialId);
    const ceremony = withCeremonyDefaults(params);

    return this.withCeremonyPanel(async () => {
      const result = await this.rpc.request<Record<string, unknown>>(
        "getPublicKey",
        {
          credentialId,
          challenge: params?.challenge,
          ...ceremony,
        },
        {
          terminalEvent: "PublicKey",
          alsoWaitFor: hasChallenge ? ["ChallengeSigned"] : undefined,
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );

      const publicKeyData = publicKeyDataFromEvent(result);
      if (!publicKeyData) {
        throw new Error("getPublicKey: invalid PublicKey payload");
      }

      if (publicKeyData.credentialId) {
        this.credentialId = publicKeyData.credentialId;
      }

      this.lastPublicKeyData = publicKeyData;

      this.cacheAddressesFromPublicKeys(
        publicKeyData.secp256k1PublicKey,
        publicKeyData.ed25519PublicKey,
      );

      const assertion = webAuthnAssertionFromEvent(result.assertion);
      if (hasChallenge && !assertion) {
        throw new Error(
          "getPublicKey: challenge was supplied but assertion fields missing",
        );
      }
      return assertion ? { ...publicKeyData, assertion } : publicKeyData;
    });
  }

  async createRecoveryData(
    passwordText: string,
    buttonText: string,
    minPasswordLength: number,
    options?: RecoveryCeremonyOptions,
  ): Promise<RecoveryDataCreatedData> {
    const ceremony = withCeremonyDefaults(options);
    return this.withCeremonyPanel(async () =>
      this.rpc.request<RecoveryDataCreatedData>(
        "createRecoveryData",
        {
          passwordText,
          buttonText,
          minPasswordLength,
          credentialId: options?.credentialId ?? this.credentialId,
          ...ceremony,
        },
        {
          terminalEvent: "RecoveryDataCreated",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      ),
    );
  }

  async recoverKey(
    aes256EncryptedPrivateKey: string,
    passwordText: string,
    buttonText: string,
    options?: RecoveryCeremonyOptions,
  ): Promise<void> {
    const ceremony = withCeremonyDefaults(options);
    const credentialId = options?.credentialId;
    await this.withCeremonyPanel(async () => {
      await this.rpc.request<{ recoverySessionActive?: true; rebound?: boolean }>(
        "recoverKey",
        {
          aes256EncryptedPrivateKey,
          passwordText,
          buttonText,
          credentialId,
          ...ceremony,
        },
        {
          terminalEvent: credentialId
            ? "RecoverySessionCleared"
            : "RecoverySessionStarted",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
    });
  }

  async revealPrivateKey(options?: RecoveryCeremonyOptions): Promise<void> {
    const ceremony = withCeremonyDefaults(options);
    await this.withCeremonyPanel(async () => {
      await this.rpc.request<Record<string, never>>(
        "revealPrivateKey",
        {
          credentialId: options?.credentialId ?? this.credentialId,
          ...ceremony,
        },
        {
          // KeyDerived is intermediate (cache addresses); panel stays open until
          // the user dismisses the key UI (PrivateKeyRevealed).
          terminalEvent: "PrivateKeyRevealed",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
    });
  }

  /**
   * Prompt for a hex private key in the Signing Layer and start a recovery
   * session (same terminal events as `recoverKey` without a backup envelope).
   */
  async importPrivateKey(): Promise<void> {
    await this.withCeremonyPanel(async () => {
      await this.rpc.request<{ recoverySessionActive?: true }>(
        "importPrivateKey",
        undefined,
        {
          terminalEvent: "RecoverySessionStarted",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
    });
  }

  async clearRecoverySession(): Promise<void> {
    await this.rpc.request<Record<string, never>>(
      "clearRecoverySession",
      undefined,
      { terminalEvent: "RecoverySessionCleared" },
    );
  }

  /**
   * Batch-encrypt plaintexts with AES-256-GCM keyed from the wallet secp256k1
   * scalar (same material as `signDigest`, HKDF info `ows-v1/aes256-gcm`).
   * One passkey ceremony (or recovery session) covers the whole batch.
   */
  async encryptAES256(
    plaintexts: string[],
    options?: CeremonyUiParams & { credentialId?: string },
  ): Promise<AES256CipherText[]> {
    const ceremony = withCeremonyDefaults(options);
    return this.withCeremonyPanel(async () => {
      const result = await this.rpc.request<EncryptAES256Result>(
        "encryptAES256",
        {
          plaintexts,
          credentialId: options?.credentialId ?? this.credentialId,
          ...ceremony,
        },
        {
          terminalEvent: "AES256Encrypted",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
      return result.ciphertexts.map((c) => AES256CipherText(c));
    });
  }

  /**
   * Batch-decrypt `ows-aes1:` AES-256-GCM envelopes. One passkey ceremony
   * (or recovery session) covers the whole batch.
   */
  async decryptAES256(
    ciphertexts: AES256CipherText[],
    options?: CeremonyUiParams & { credentialId?: string },
  ): Promise<string[]> {
    const ceremony = withCeremonyDefaults(options);
    return this.withCeremonyPanel(async () => {
      const result = await this.rpc.request<DecryptAES256Result>(
        "decryptAES256",
        {
          ciphertexts: ciphertexts.map(String),
          credentialId: options?.credentialId ?? this.credentialId,
          ...ceremony,
        },
        {
          terminalEvent: "AES256Decrypted",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
      return result.plaintexts;
    });
  }
}
