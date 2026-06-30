import type { Address, Hex } from "viem";
import { publicKeyToAddress } from "viem/utils";
import { createSignerIframe, getSignerOrigin } from "./iframe.js";
import { EvmSigner } from "./evm/namespace.js";
import { SolanaSigner } from "./solana/namespace.js";
import {
  cacheKeyDerivedFromEvent,
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
  private cachedAddress?: Address;

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

  getCachedAddress(): Address | undefined {
    return this.cachedAddress;
  }

  setCachedAddress(address: Address): void {
    this.cachedAddress = address;
  }

  destroy(): void {
    this.rpc.destroy();
    this.iframe.remove();
  }

  private onKeyDerived = (data: Record<string, unknown>): void => {
    const derived = cacheKeyDerivedFromEvent(data);
    if (derived) {
      this.cacheAddressFromPublicKey(derived.secp256k1PublicKey);
    }
  };

  private cacheAddressFromPublicKey(publicKey: Hex): void {
    if (this.cachedAddress) return;
    this.cachedAddress = publicKeyToAddress(publicKey);
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
    const result = await this.rpc.request<CredentialCreatedData>(
      "createCredential",
      { name, options },
      {
        terminalEvent: "CredentialCreated",
        onIntermediate: (_event, data) => this.onKeyDerived(data),
      },
    );
    this.credentialId = result.credentialId;
    this.cacheAddressFromPublicKey(result.secp256k1PublicKey);
    return result;
  }

  async signDigest(
    digestData: Hex,
    scheme: SignScheme = "secp256k1-ecdsa-recoverable",
    credentialId?: string,
  ): Promise<DigestSignedData> {
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
  }

  async getPublicKey(
    params?: GetPublicKeyParams,
  ): Promise<PublicKeyData & { challengeSignature?: string }> {
    const hasChallenge = params?.challenge !== undefined;

    const result = await this.rpc.request<
      PublicKeyData & { signature?: string }
    >(
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

    this.cacheAddressFromPublicKey(result.secp256k1PublicKey);

    const { signature, ...publicKeyData } = result;
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
