import { base58 } from "@scure/base";
import {
  ConversionUtils,
  DomainStringSchema,
  ISO8601DateTimeSchema,
  SolanaAccountAddressSchema,
  SolanaChainIdSchema,
  UriStringSchema,
  type DomainString,
  type IOpenWalletSolanaProvider,
  type ISolanaSignInParams,
  type ISO8601DateTime,
  type SolanaAccountAddress,
  type SolanaChainId,
  type UriString,
} from "@1shotapi/ows-types";
import type {
  IdentifierArray,
  Wallet,
  WalletAccount,
  WalletIcon,
  WalletVersion,
} from "@wallet-standard/base";
import type {
  StandardConnectFeature,
  StandardConnectMethod,
  StandardDisconnectFeature,
  StandardDisconnectMethod,
  StandardEventsFeature,
  StandardEventsListeners,
  StandardEventsOnMethod,
} from "@wallet-standard/features";
import {
  SolanaSignAndSendTransaction,
  SolanaSignIn,
  SolanaSignMessage,
  SolanaSignTransaction,
  type SolanaSignAndSendTransactionFeature,
  type SolanaSignAndSendTransactionMethod,
  type SolanaSignInFeature,
  type SolanaSignInInput,
  type SolanaSignInMethod,
  type SolanaSignMessageFeature,
  type SolanaSignMessageMethod,
  type SolanaSignTransactionFeature,
  type SolanaSignTransactionMethod,
} from "@solana/wallet-standard-features";
import { DEFAULT_SOLANA_WALLET_ICON } from "./icon.js";
import { attachSignatureAndEncode, extractMessageBytes } from "./tx-wire.js";

export const SOLANA_STANDARD_CHAINS = [
  "solana:mainnet",
  "solana:devnet",
] as const satisfies IdentifierArray;

const ACCOUNT_FEATURES = [
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
  SolanaSignMessage,
  SolanaSignIn,
] as const satisfies IdentifierArray;

export type OwsSolanaStandardWalletOptions = {
  name?: string;
  icon?: WalletIcon;
};

type OwsSolanaFeatures = StandardConnectFeature &
  StandardDisconnectFeature &
  StandardEventsFeature &
  SolanaSignMessageFeature &
  SolanaSignInFeature &
  SolanaSignTransactionFeature &
  SolanaSignAndSendTransactionFeature;

/**
 * Wallet Standard `Wallet` that forwards Solana features to the OWS Branding
 * wire via {@link IOpenWalletSolanaProvider}.
 */
export class OwsSolanaStandardWallet implements Wallet {
  readonly version = "1.0.0" as const satisfies WalletVersion;
  readonly name: string;
  readonly icon: WalletIcon;
  readonly chains = SOLANA_STANDARD_CHAINS;
  readonly features: OwsSolanaFeatures;

  #accounts: readonly WalletAccount[] = [];
  readonly #listeners: {
    change: Set<StandardEventsListeners["change"]>;
  } = { change: new Set() };
  readonly #client: IOpenWalletSolanaProvider;

  constructor(
    client: IOpenWalletSolanaProvider,
    options?: OwsSolanaStandardWalletOptions,
  ) {
    this.#client = client;
    this.name = options?.name ?? "1Shot Wallet";
    this.icon = options?.icon ?? DEFAULT_SOLANA_WALLET_ICON;

    this.features = {
      "standard:connect": {
        version: "1.0.0",
        connect: this.#connect,
      },
      "standard:disconnect": {
        version: "1.0.0",
        disconnect: this.#disconnect,
      },
      "standard:events": {
        version: "1.0.0",
        on: this.#on,
      },
      [SolanaSignMessage]: {
        version: "1.1.0",
        signMessage: this.#signMessage,
      },
      [SolanaSignIn]: {
        version: "1.1.0",
        signIn: this.#signIn,
      },
      [SolanaSignTransaction]: {
        version: "1.0.0",
        supportedTransactionVersions: ["legacy", 0],
        signTransaction: this.#signTransaction,
      },
      [SolanaSignAndSendTransaction]: {
        version: "1.0.0",
        supportedTransactionVersions: ["legacy", 0],
        signAndSendTransaction: this.#signAndSendTransaction,
      },
    };
  }

  get accounts(): readonly WalletAccount[] {
    return this.#accounts;
  }

  readonly #on: StandardEventsOnMethod = (event, listener) => {
    this.#listeners[event].add(listener);
    return (): void => {
      this.#listeners[event].delete(listener);
    };
  };

  #emit(event: keyof StandardEventsListeners, ...args: Parameters<StandardEventsListeners[typeof event]>): void {
    for (const listener of this.#listeners[event]) {
      listener.apply(null, args);
    }
  }

  #setAccounts(accounts: readonly WalletAccount[]): void {
    this.#accounts = accounts;
    this.#emit("change", { accounts: this.accounts });
  }

  readonly #connect: StandardConnectMethod = async () => {
    const address = await this.#client.getAccountAddress();
    const account = this.#toWalletAccount(address);
    this.#setAccounts([account]);
    return { accounts: this.accounts };
  };

  readonly #disconnect: StandardDisconnectMethod = async () => {
    this.#setAccounts([]);
  };

  readonly #signMessage: SolanaSignMessageMethod = async (...inputs) => {
    const messages = inputs.map((input) =>
      ConversionUtils.bytesToBase64(input.message),
    );
    const { signatures } = await this.#client.signMessage({ messages });
    if (signatures.length !== inputs.length) {
      throw new Error(
        `solana.signMessage returned ${signatures.length} signatures for ${inputs.length} messages`,
      );
    }
    return inputs.map((input, i) => ({
      signedMessage: input.message,
      signature: base58.decode(signatures[i]!),
      signatureType: "ed25519" as const,
    }));
  };

  readonly #signIn: SolanaSignInMethod = async (...inputs) => {
    if (inputs.length === 0) {
      const result = await this.#client.signIn();
      const account = this.#toWalletAccount(result.account);
      this.#setAccounts([account]);
      return [
        {
          account,
          signedMessage: ConversionUtils.base64ToBytes(result.signedMessage),
          signature: base58.decode(result.signature),
          signatureType: "ed25519" as const,
        },
      ];
    }

    const outputs = [];
    for (const input of inputs) {
      const result = await this.#client.signIn(mapSignInInput(input));
      const account = this.#toWalletAccount(result.account);
      this.#setAccounts([account]);
      outputs.push({
        account,
        signedMessage: ConversionUtils.base64ToBytes(result.signedMessage),
        signature: base58.decode(result.signature),
        signatureType: "ed25519" as const,
      });
    }
    return outputs;
  };

  readonly #signTransaction: SolanaSignTransactionMethod = async (...inputs) => {
    const decoded = inputs.map((input) =>
      extractMessageBytes(input.transaction),
    );
    const { signatures } = await this.#client.signTransaction({
      transactions: decoded.map((d) =>
        ConversionUtils.bytesToBase64(d.messageBytes),
      ),
    });
    if (signatures.length !== inputs.length) {
      throw new Error(
        `solana.signTransaction returned ${signatures.length} signatures for ${inputs.length} transactions`,
      );
    }
    return inputs.map((input, i) => {
      const sigBytes = base58.decode(signatures[i]!);
      return {
        signedTransaction: attachSignatureAndEncode(
          decoded[i]!.transaction,
          input.account.address,
          sigBytes,
        ),
      };
    });
  };

  readonly #signAndSendTransaction: SolanaSignAndSendTransactionMethod =
    async (...inputs) => {
      const outputs = [];
      for (const input of inputs) {
        const { messageBytes } = extractMessageBytes(input.transaction);
        const chainId = parseOptionalSolanaChainId(input.chain);
        const { signature } = await this.#client.signAndSendTransaction({
          transaction: ConversionUtils.bytesToBase64(messageBytes),
          ...(chainId !== undefined ? { chainId } : {}),
        });
        outputs.push({ signature: base58.decode(signature) });
      }
      return outputs;
    };

  #toWalletAccount(address: SolanaAccountAddress): WalletAccount {
    const publicKey = base58.decode(address);
    if (publicKey.length !== 32) {
      throw new Error("Solana account address must decode to 32 bytes");
    }
    return {
      address,
      publicKey,
      chains: SOLANA_STANDARD_CHAINS,
      features: ACCOUNT_FEATURES,
    };
  }
}

function mapSignInInput(input: SolanaSignInInput): ISolanaSignInParams {
  const params: ISolanaSignInParams = {};
  if (input.domain !== undefined) {
    params.domain = parseDomain(input.domain);
  }
  if (input.address !== undefined) {
    params.address = SolanaAccountAddressSchema.parse(input.address);
  }
  if (input.statement !== undefined) {
    params.statement = input.statement;
  }
  if (input.uri !== undefined) {
    params.uri = parseUri(input.uri);
  }
  if (input.version !== undefined) {
    params.version = input.version;
  }
  if (input.chainId !== undefined) {
    const chainId = parseOptionalSolanaChainId(input.chainId);
    if (chainId !== undefined) {
      params.chainId = chainId;
    }
  }
  if (input.nonce !== undefined) {
    params.nonce = input.nonce;
  }
  if (input.issuedAt !== undefined) {
    params.issuedAt = parseIso(input.issuedAt);
  }
  if (input.expirationTime !== undefined) {
    params.expirationTime = parseIso(input.expirationTime);
  }
  if (input.notBefore !== undefined) {
    params.notBefore = parseIso(input.notBefore);
  }
  if (input.requestId !== undefined) {
    params.requestId = input.requestId;
  }
  if (input.resources !== undefined) {
    params.resources = input.resources.map(parseUri);
  }
  return params;
}

function parseOptionalSolanaChainId(
  value: string | undefined,
): SolanaChainId | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = SolanaChainIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function parseDomain(value: string): DomainString {
  return DomainStringSchema.parse(value);
}

function parseUri(value: string): UriString {
  return UriStringSchema.parse(value);
}

function parseIso(value: string): ISO8601DateTime {
  return ISO8601DateTimeSchema.parse(value);
}
