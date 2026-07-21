import {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
  HexString,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  type IEVMTransactionRequest,
  type RequestDisplayParams,
} from "@1shotapi/ows-types";
import {
  createPublicClient,
  custom,
  defineChain,
  type Hex,
  type TransactionSerializable,
  type TypedDataDefinition,
} from "viem";
import { prepareTransactionRequest } from "viem/actions";
import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
  SignTypedDataPayload,
} from "./approval-types.js";

/** EIP-1193 handler shape (matches `OWSWallet.registerEip1193`). */
export type Eip1193Handler = (params: unknown[]) => Promise<unknown>;

export type SignHelperDisplaySession = {
  hide(): Promise<void>;
};

/** Wallet surface used to show the branding iframe during consent / signing. */
export type SignHelperWallet = {
  requestDisplay(
    params: RequestDisplayParams,
  ): Promise<SignHelperDisplaySession>;
};

/** Minimal EVM signing surface (`OWSSigner` / `OWSSigner.evm` subset). */
export type SignHelperSigner = {
  /** Prefer cache so signing flows avoid an extra getPublicKey ceremony. */
  getCachedAddress?: () => EVMAccountAddress | null | undefined;
  evm: {
    getAccountAddress(options?: {
      credentialId?: string;
    }): Promise<EVMAccountAddress>;
    signMessage(args: { message: string }): Promise<string>;
    signTypedData(
      typedData: TypedDataDefinition,
      options?: { credentialId?: string },
    ): Promise<string>;
    signTransaction(
      transaction: TransactionSerializable,
      options?: { credentialId?: string },
    ): Promise<string>;
  };
};

/**
 * Active-chain JSON-RPC surface for prepare + broadcast.
 * Typically an `RpcHelper` from `ows-wallet-utils` (no package import here).
 */
export type SignHelperChainRpc = {
  getChainId(): EVMChainId;
  request(method: string, params?: unknown[]): Promise<unknown>;
};

export type SignHelperDisplaySize = {
  width: number;
  height: number;
};

export type SignHelperOptions = {
  /**
   * Run before signing / send consent when the branding app needs onboarding.
   * Prefer setup-only when a credential id already exists — the signing
   * ceremony itself unlocks the wallet.
   */
  ensureReady?: () => Promise<void>;
  /**
   * Called after a successful WebAuthn signing ceremony so the branding app
   * can mark the wallet unlocked and refresh addresses.
   */
  onAuthenticated?: () => void | Promise<void>;
  /** Consent UI for EIP-191 personal_sign. */
  requestPersonalSignApproval: (
    request: PersonalSignApprovalRequest,
  ) => Promise<boolean>;
  /** Consent UI for EIP-712 typed data. */
  requestSignTypedDataApproval: (
    request: SignTypedDataApprovalRequest,
  ) => Promise<boolean>;
  /**
   * Branding owns consent + prepare + passkey sign + broadcast for
   * `eth_sendTransaction`. Return the mined/submitted tx hash.
   */
  approveAndSignTransaction: (
    request: SendTransactionApprovalRequest,
  ) => Promise<EVMTransactionHash>;
  /** Active EIP-1193 chain id (for request validation). */
  getChainId: () => EVMChainId;
  /** Flyout size for personal_sign (default 448×360). */
  personalSignDisplaySize?: SignHelperDisplaySize;
  /** Flyout size for typed data (default 448×520). */
  typedDataDisplaySize?: SignHelperDisplaySize;
  /** Flyout size for eth_sendTransaction (default 448×480). */
  sendTransactionDisplaySize?: SignHelperDisplaySize;
};

export type Eip1193SignHandlers = {
  personal_sign: Eip1193Handler;
  eth_signTypedData: Eip1193Handler;
  eth_signTypedData_v3: Eip1193Handler;
  eth_signTypedData_v4: Eip1193Handler;
  eth_sendTransaction: Eip1193Handler;
};

const DEFAULT_PERSONAL_SIGN_SIZE: SignHelperDisplaySize = {
  width: 448,
  height: 360,
};
const DEFAULT_TYPED_DATA_SIZE: SignHelperDisplaySize = {
  width: 448,
  height: 520,
};
const DEFAULT_SEND_TRANSACTION_SIZE: SignHelperDisplaySize = {
  width: 448,
  height: 480,
};

const ZERO_VALUE = HexString("0x0");
const EMPTY_DATA = HexString("0x");

/**
 * Headless EIP-1193 signing wiring: display → consent → ensureReady → sign.
 * Does **not** register handlers — the branding app calls
 * `wallet.registerEip1193` in the order it wants.
 *
 * `eth_sendTransaction` flow: ensureReady → branding `approveAndSignTransaction`
 * (consent + prepare + sign + broadcast).
 */
export class SignHelper {
  readonly handlers: Eip1193SignHandlers;

  constructor(
    private readonly signer: SignHelperSigner,
    private readonly wallet: SignHelperWallet,
    private readonly options: SignHelperOptions,
  ) {
    const typedData: Eip1193Handler = (params) => this.handleTypedData(params);
    this.handlers = {
      personal_sign: (params) => this.handlePersonalSign(params),
      eth_signTypedData: typedData,
      eth_signTypedData_v3: typedData,
      eth_signTypedData_v4: typedData,
      eth_sendTransaction: (params) => this.handleSendTransaction(params),
    };
  }

  private async handlePersonalSign(params: unknown[]): Promise<string> {
    const [message, addressParam] = params as [string, string];
    const address = EVMAccountAddress(addressParam as `0x${string}`);
    const size =
      this.options.personalSignDisplaySize ?? DEFAULT_PERSONAL_SIGN_SIZE;

    return this.withDisplay(size, async () => {
      const approved = await this.options.requestPersonalSignApproval({
        message,
        address,
      });
      if (!approved) {
        throw new OwsUserRejectedError("User rejected the signing request");
      }
      if (this.options.ensureReady) {
        await this.options.ensureReady();
      }
      const signature = await this.signer.evm.signMessage({ message });
      await this.notifyAuthenticated();
      return signature;
    });
  }

  private async handleTypedData(params: unknown[]): Promise<string> {
    const [addressParam, typedDataParam] = params as [
      string,
      SignTypedDataPayload | string,
    ];
    const address = EVMAccountAddress(addressParam as `0x${string}`);
    const typedData = parseTypedData(typedDataParam);
    const size =
      this.options.typedDataDisplaySize ?? DEFAULT_TYPED_DATA_SIZE;

    return this.withDisplay(size, async () => {
      const approved = await this.options.requestSignTypedDataApproval({
        address,
        typedData,
      });
      if (!approved) {
        throw new OwsUserRejectedError("User rejected the signing request");
      }
      if (this.options.ensureReady) {
        await this.options.ensureReady();
      }
      const signature = await this.signer.evm.signTypedData(
        typedData as unknown as TypedDataDefinition,
      );
      await this.notifyAuthenticated();
      return signature;
    });
  }

  private async handleSendTransaction(
    params: unknown[],
  ): Promise<EVMTransactionHash> {
    const tx = parseTransactionRequest(params[0]);
    const chainId = this.options.getChainId();
    if (tx.chainId !== undefined) {
      const requested = normalizeChainId(tx.chainId);
      if (requested !== chainId) {
        throw new OwsInvalidParamsError(
          `eth_sendTransaction chainId ${requested} does not match active chain ${chainId}`,
        );
      }
    }

    const size =
      this.options.sendTransactionDisplaySize ?? DEFAULT_SEND_TRANSACTION_SIZE;

    return this.withDisplay(size, async () => {
      if (this.options.ensureReady) {
        await this.options.ensureReady();
      }

      const address = await this.resolveAccount(tx.from);
      if (tx.from && !sameAddress(tx.from, address)) {
        throw new OwsInvalidParamsError(
          "eth_sendTransaction from does not match the active account",
        );
      }

      const to =
        tx.to === undefined || tx.to === null
          ? null
          : EVMAccountAddress(tx.to as `0x${string}`);
      const data = HexString((tx.data ?? EMPTY_DATA) as `0x${string}`);
      const value = HexString((tx.value ?? ZERO_VALUE) as `0x${string}`);
      const transaction: IEVMTransactionRequest = {
        ...tx,
        from: address,
        chainId,
      };

      const hash = await this.options.approveAndSignTransaction({
        address,
        to,
        data,
        value,
        chainId,
        transaction,
      });
      if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        throw new OwsInvalidParamsError(
          "approveAndSignTransaction returned an invalid transaction hash",
        );
      }
      return EVMTransactionHash(hash as `0x${string}`);
    });
  }

  private async resolveAccount(
    from?: EVMAccountAddress,
  ): Promise<EVMAccountAddress> {
    const cached = this.signer.getCachedAddress?.() ?? null;
    if (from) {
      if (cached && !sameAddress(from, cached)) {
        throw new OwsInvalidParamsError(
          "eth_sendTransaction from does not match the active account",
        );
      }
      return from;
    }
    if (cached) {
      return cached;
    }
    return this.signer.evm.getAccountAddress();
  }

  private async notifyAuthenticated(): Promise<void> {
    if (this.options.onAuthenticated) {
      await this.options.onAuthenticated();
    }
  }

  private async withDisplay<T>(
    size: SignHelperDisplaySize,
    run: () => Promise<T>,
  ): Promise<T> {
    const display = await this.wallet.requestDisplay(size);
    try {
      return await run();
    } finally {
      await display.hide();
    }
  }
}

export function parseTypedData(
  value: SignTypedDataPayload | string,
): SignTypedDataPayload {
  if (typeof value === "string") {
    return JSON.parse(value) as SignTypedDataPayload;
  }
  return value;
}

function parseTransactionRequest(value: unknown): IEVMTransactionRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new OwsInvalidParamsError(
      "eth_sendTransaction requires a transaction object",
    );
  }
  const raw = value as Record<string, unknown>;
  const tx: IEVMTransactionRequest = {};

  if (raw.from !== undefined) {
    if (typeof raw.from !== "string") {
      throw new OwsInvalidParamsError("Invalid transaction from");
    }
    tx.from = EVMAccountAddress(raw.from as `0x${string}`);
  }
  if (raw.to !== undefined && raw.to !== null) {
    if (typeof raw.to !== "string") {
      throw new OwsInvalidParamsError("Invalid transaction to");
    }
    tx.to = EVMAccountAddress(raw.to as `0x${string}`);
  } else if (raw.to === null) {
    tx.to = null;
  }
  if (raw.data !== undefined) {
    tx.data = asHexField(raw.data, "data");
  }
  if (raw.value !== undefined) {
    tx.value = asHexField(raw.value, "value");
  }
  if (raw.gas !== undefined) {
    tx.gas = asHexField(raw.gas, "gas");
  }
  if (raw.gasPrice !== undefined) {
    tx.gasPrice = asHexField(raw.gasPrice, "gasPrice");
  }
  if (raw.maxFeePerGas !== undefined) {
    tx.maxFeePerGas = asHexField(raw.maxFeePerGas, "maxFeePerGas");
  }
  if (raw.maxPriorityFeePerGas !== undefined) {
    tx.maxPriorityFeePerGas = asHexField(
      raw.maxPriorityFeePerGas,
      "maxPriorityFeePerGas",
    );
  }
  if (raw.nonce !== undefined) {
    tx.nonce = asHexField(raw.nonce, "nonce");
  }
  if (raw.chainId !== undefined) {
    if (typeof raw.chainId !== "string") {
      throw new OwsInvalidParamsError("Invalid transaction chainId");
    }
    tx.chainId = normalizeChainId(raw.chainId);
  }
  if (raw.type !== undefined) {
    if (typeof raw.type !== "string") {
      throw new OwsInvalidParamsError("Invalid transaction type");
    }
    tx.type = raw.type;
  }
  if (raw.accessList !== undefined) {
    if (!Array.isArray(raw.accessList)) {
      throw new OwsInvalidParamsError("Invalid transaction accessList");
    }
    tx.accessList = raw.accessList;
  }
  return tx;
}

function asHexField(value: unknown, field: string): HexString {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new OwsInvalidParamsError(`Invalid transaction ${field}`);
  }
  return HexString(value as `0x${string}`);
}

function normalizeChainId(value: string): EVMChainId {
  const raw = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) {
    throw new OwsInvalidParamsError(`Invalid chainId: ${value}`);
  }
  return EVMChainId(`0x${BigInt(raw).toString(16)}`);
}

function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function hexQuantityToBigInt(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  return BigInt(value);
}

export async function prepareEvmTransaction(
  chainRpc: SignHelperChainRpc,
  account: EVMAccountAddress,
  tx: IEVMTransactionRequest,
): Promise<TransactionSerializable> {
  const chainId = chainRpc.getChainId();
  const chain = defineChain({
    id: Number(BigInt(chainId)),
    name: "ows-active",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["http://127.0.0.1"] } },
  });

  const client = createPublicClient({
    chain,
    transport: custom({
      async request({ method, params }) {
        return chainRpc.request(method, (params as unknown[]) ?? []);
      },
    }),
  });

  const base = {
    account,
    chain,
    to: (tx.to ?? undefined) as Hex | undefined,
    data: (tx.data as Hex | undefined) ?? undefined,
    value: hexQuantityToBigInt(tx.value),
    gas: hexQuantityToBigInt(tx.gas),
    nonce:
      tx.nonce !== undefined ? Number(hexQuantityToBigInt(tx.nonce)) : undefined,
  };

  const prepared =
    tx.gasPrice !== undefined
      ? await prepareTransactionRequest(client, {
          ...base,
          gasPrice: hexQuantityToBigInt(tx.gasPrice),
          type: "legacy",
        })
      : await prepareTransactionRequest(client, {
          ...base,
          maxFeePerGas: hexQuantityToBigInt(tx.maxFeePerGas),
          maxPriorityFeePerGas: hexQuantityToBigInt(tx.maxPriorityFeePerGas),
        });

  return prepared as TransactionSerializable;
}
