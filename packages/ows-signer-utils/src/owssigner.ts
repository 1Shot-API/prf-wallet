import { EVMAccountAddress, SolanaAccountAddress } from "@1shotapi/ows-types";
import type { ED25519PublicKey, SECP256K1PublicKey } from "@1shotapi/ows-types";
import type { Hex } from "viem";
import { publicKeyToAddress } from "viem/utils";
import { createSignerIframe, getSignerOrigin, prepareSignerIframeForWebAuthn } from "./iframe.js";
import { EvmSigner } from "./evm/namespace.js";
import { addressFromEd25519PublicKey } from "./solana/address.js";
import { SolanaSigner } from "./solana/namespace.js";
import {
  keyDerivedDataFromEvent,
  credentialCreatedDataFromEvent,
  publicKeyDataFromEvent,
  SignerRpcClient,
} from "./rpc/client.js";
import type {
  CreateCredentialOptions,
  CredentialCreatedData,
  DigestSignedData,
  GetPublicKeyParams,
  PublicKeyData,
  RecoveryDataCreatedData,
  SignScheme,
  VersionData,
} from "./rpc/types.js";

export type OWSSignerOptions = {
  credentialId?: string;
  hidden?: boolean;
  rpcTimeoutMs?: number;
};

export class OWSSigner {
  readonly evm: EvmSigner;
  readonly solana: SolanaSigner;

  private readonly rpc: SignerRpcClient;
  private credentialId?: string;
  private cachedAddress?: EVMAccountAddress;
  private cachedSolanaAddress?: SolanaAccountAddress;

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

  getCredentialId(): string | undefined {
    return this.credentialId;
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

  destroy(): void {
    this.rpc.destroy();
    this.iframe.remove();
  }

  private onKeyDerived = (data: Record<string, unknown>): void => {
    const derived = keyDerivedDataFromEvent(data);
    if (derived) {
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

  async getVersion(): Promise<VersionData> {
    return this.rpc.request<VersionData>("getVersion", undefined, {
      terminalEvent: "Version",
    });
  }

  async createCredential(
    name: string,
    options?: CreateCredentialOptions,
  ): Promise<CredentialCreatedData> {
    const restoreSignerDisplay = prepareSignerIframeForWebAuthn(this.iframe);
    try {
      const result = await this.rpc.request<Record<string, unknown>>(
        "createCredential",
        { name, options },
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
      this.cacheAddressFromPublicKey(created.secp256k1PublicKey);
      return created;
    } finally {
      restoreSignerDisplay();
    }
  }

  async signDigest(
    digestData: Hex,
    scheme: SignScheme = "secp256k1-ecdsa-recoverable",
    credentialId?: string,
  ): Promise<DigestSignedData> {
    const restoreSignerDisplay = prepareSignerIframeForWebAuthn(this.iframe);
    try {
      const result = await this.rpc.request<DigestSignedData>(
        "signDigest",
        {
          digestData,
          scheme,
          credentialId: credentialId ?? this.credentialId,
        },
        {
          terminalEvent: "DigestSigned",
          onIntermediate: (_event, data) => this.onKeyDerived(data),
        },
      );
      if (result.credentialId) {
        this.credentialId = result.credentialId;
      }
      return result;
    } finally {
      restoreSignerDisplay();
    }
  }

  async getPublicKey(
    params?: GetPublicKeyParams,
  ): Promise<PublicKeyData & { challengeSignature?: string }> {
    const hasChallenge = params?.challenge !== undefined;

    const result = await this.rpc.request<Record<string, unknown>>(
      "getPublicKey",
      {
        credentialId: params?.credentialId ?? this.credentialId,
        challenge: params?.challenge,
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

    this.cacheAddressesFromPublicKeys(
      publicKeyData.secp256k1PublicKey,
      publicKeyData.ed25519PublicKey,
    );

    const signature =
      typeof result.signature === "string" ? result.signature : undefined;
    return signature
      ? { ...publicKeyData, challengeSignature: signature }
      : publicKeyData;
  }

  async createRecoveryData(
    passwordText: string,
    buttonText: string,
    minPasswordLength: number,
    credentialId?: string,
  ): Promise<RecoveryDataCreatedData> {
    return this.rpc.request<RecoveryDataCreatedData>(
      "createRecoveryData",
      {
        passwordText,
        buttonText,
        minPasswordLength,
        credentialId: credentialId ?? this.credentialId,
      },
      {
        terminalEvent: "RecoveryDataCreated",
        onIntermediate: (_event, data) => this.onKeyDerived(data),
      },
    );
  }

  async recoverKey(
    aes256EncryptedPrivateKey: string,
    passwordText: string,
    buttonText: string,
    credentialId?: string,
  ): Promise<void> {
    await this.rpc.request<{ recoverySessionActive?: true; rebound?: boolean }>(
      "recoverKey",
      {
        aes256EncryptedPrivateKey,
        passwordText,
        buttonText,
        credentialId,
      },
      {
        terminalEvent: credentialId
          ? "RecoverySessionCleared"
          : "RecoverySessionStarted",
        onIntermediate: (_event, data) => this.onKeyDerived(data),
      },
    );
  }

  async revealPrivateKey(credentialId?: string): Promise<void> {
    await this.rpc.request<Record<string, never>>(
      "revealPrivateKey",
      { credentialId: credentialId ?? this.credentialId },
      {
        terminalEvent: "KeyDerived",
        onIntermediate: (_event, data) => this.onKeyDerived(data),
      },
    );
  }

  async clearRecoverySession(): Promise<void> {
    await this.rpc.request<Record<string, never>>(
      "clearRecoverySession",
      undefined,
      { terminalEvent: "RecoverySessionCleared" },
    );
  }
}

/** @deprecated Use `OWSSigner.create()` instead. */
export type OwsSignerHostConfig = {
  signerUrl: string;
};

/** @deprecated Use `OWSSigner` instead. */
export type OwsSignerEvmApi = EvmSigner;
