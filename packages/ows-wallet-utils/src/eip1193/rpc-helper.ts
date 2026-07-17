import {
  EIP1193_READ_METHODS,
  EIP1193_UNRECOGNIZED_CHAIN_ID,
  EVMChainId,
  EVMTransactionHash,
  HexString,
  OwsInvalidParamsError,
  OwsRpcError,
} from "@1shotapi/ows-types";
import type { Eip1193Handler } from "../ows-wallet.js";

export type RpcHelperEventMap = {
  chainChanged: [chainId: EVMChainId];
};

type Listener<E extends keyof RpcHelperEventMap> = (
  ...args: RpcHelperEventMap[E]
) => void;

/** Minimal EventEmitter for RpcHelper (no Node `events` dependency). */
export class RpcHelperEventEmitter {
  private readonly listeners = new Map<
    keyof RpcHelperEventMap,
    Set<Listener<keyof RpcHelperEventMap>>
  >();

  on<E extends keyof RpcHelperEventMap>(
    event: E,
    listener: Listener<E>,
  ): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<keyof RpcHelperEventMap>);
    return this;
  }

  off<E extends keyof RpcHelperEventMap>(
    event: E,
    listener: Listener<E>,
  ): this {
    this.listeners
      .get(event)
      ?.delete(listener as Listener<keyof RpcHelperEventMap>);
    return this;
  }

  emit<E extends keyof RpcHelperEventMap>(
    event: E,
    ...args: RpcHelperEventMap[E]
  ): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) {
      return false;
    }
    for (const listener of set) {
      (listener as Listener<E>)(...args);
    }
    return true;
  }
}

/** Wallet surface required to register EIP-1193 handlers. */
export type RpcHelperWallet = {
  registerEip1193(method: string, handler: Eip1193Handler): void;
};

/**
 * Optional Signing Layer handle for future signing/broadcast helpers.
 * Typed loosely so `ows-wallet-utils` does not depend on `ows-signer-utils`.
 * Pass an `OWSSigner` instance from the branding app when available.
 */
export type RpcHelperSigner = object;

export type RpcHelperOptions = {
  /**
   * Active chain on construct. Defaults to the first entry in `providers`
   * (insertion order).
   */
  defaultChainId?: EVMChainId;
  /**
   * Called before switching chains. Return `false` to abort the switch
   * (no error; handler resolves `null` and chain is unchanged).
   */
  beforeSwitchChain?: (
    chainId: EVMChainId,
  ) => boolean | void | Promise<boolean | void>;
  /** Fired after the active chain id changes. */
  onChainChanged?: (chainId: EVMChainId) => void;
};

/**
 * Registers EIP-1193 read methods and chain selection on an `OWSWallet`.
 *
 * Call after `OWSWallet.prepare()` and before `wallet.start()`.
 *
 * @param providers - Chain id → JSON-RPC HTTP(S) URL
 * @param wallet - Branding wallet used to `registerEip1193`
 * @param signer - Optional `OWSSigner` (reserved for future helpers)
 * @param options - Default chain and branding hooks
 */
export class RpcHelper {
  readonly events = new RpcHelperEventEmitter();

  private readonly providers: Map<EVMChainId, string>;
  private readonly beforeSwitchChain?: RpcHelperOptions["beforeSwitchChain"];
  private currentChainId: EVMChainId;

  constructor(
    providers: Map<EVMChainId, string> | ReadonlyMap<EVMChainId, string>,
    wallet: RpcHelperWallet,
    _signer?: RpcHelperSigner | null,
    options: RpcHelperOptions = {},
  ) {
    this.providers = normalizeProviders(providers);
    if (this.providers.size === 0) {
      throw new Error("RpcHelper: providers map must not be empty");
    }

    this.beforeSwitchChain = options.beforeSwitchChain;
    this.currentChainId = resolveDefaultChainId(
      this.providers,
      options.defaultChainId,
    );

    if (options.onChainChanged) {
      this.events.on("chainChanged", options.onChainChanged);
    }

    wallet.registerEip1193("eth_chainId", async () => this.currentChainId);

    wallet.registerEip1193("wallet_switchEthereumChain", async (params) =>
      this.switchChain(readSwitchChainId(params)),
    );

    const proxy =
      (method: string): Eip1193Handler =>
      async (params) => {
        const url = this.providers.get(this.currentChainId);
        if (!url) {
          throw new OwsRpcError(
            `No RPC provider configured for chain ${this.currentChainId}`,
            EIP1193_UNRECOGNIZED_CHAIN_ID,
            { chainId: this.currentChainId },
          );
        }
        return jsonRpcRequest(url, method, params);
      };

    for (const method of EIP1193_READ_METHODS) {
      wallet.registerEip1193(method, proxy(method));
    }
  }

  getChainId(): EVMChainId {
    return this.currentChainId;
  }

  getConfiguredChainIds(): readonly EVMChainId[] {
    return [...this.providers.keys()];
  }

  /**
   * JSON-RPC against the active chain's configured provider.
   * Used by Branding Layer helpers (e.g. transaction prepare / broadcast).
   * Does not register Host-facing methods such as `eth_sendRawTransaction`.
   */
  async request(method: string, params: unknown[] = []): Promise<unknown> {
    const url = this.providers.get(this.currentChainId);
    if (!url) {
      throw new OwsRpcError(
        `No RPC provider configured for chain ${this.currentChainId}`,
        EIP1193_UNRECOGNIZED_CHAIN_ID,
        { chainId: this.currentChainId },
      );
    }
    return jsonRpcRequest(url, method, params);
  }

  /**
   * Broadcast a signed raw transaction on the active chain.
   * Intended for SignHelper / branding internals — not Host EIP-1193.
   */
  async sendRawTransaction(
    signedTransaction: HexString | `0x${string}`,
  ): Promise<EVMTransactionHash> {
    const result = await this.request("eth_sendRawTransaction", [
      signedTransaction,
    ]);
    if (
      typeof result !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(result)
    ) {
      throw new OwsRpcError(
        "eth_sendRawTransaction returned an invalid transaction hash",
        -32_603,
        { result },
      );
    }
    return EVMTransactionHash(result as `0x${string}`);
  }

  /** Same logic as the EIP-1193 `wallet_switchEthereumChain` handler. */
  async switchChain(chainIdInput: EVMChainId | string): Promise<null> {
    const chainId = normalizeChainId(chainIdInput);
    if (!this.providers.has(chainId)) {
      throw new OwsRpcError(
        `Unrecognized chain ID: ${chainId}`,
        EIP1193_UNRECOGNIZED_CHAIN_ID,
        { chainId },
      );
    }

    if (this.beforeSwitchChain) {
      const allowed = await this.beforeSwitchChain(chainId);
      if (allowed === false) {
        return null;
      }
    }

    if (chainId !== this.currentChainId) {
      this.currentChainId = chainId;
      this.events.emit("chainChanged", this.currentChainId);
    }
    return null;
  }
}

function normalizeProviders(
  providers: Map<EVMChainId, string> | ReadonlyMap<EVMChainId, string>,
): Map<EVMChainId, string> {
  const out = new Map<EVMChainId, string>();
  for (const [chainId, url] of providers) {
    const id = normalizeChainId(chainId);
    const trimmed = url.trim();
    if (!trimmed) {
      throw new Error(`RpcHelper: empty URL for chain ${id}`);
    }
    out.set(id, trimmed);
  }
  return out;
}

function resolveDefaultChainId(
  providers: Map<EVMChainId, string>,
  defaultChainId?: EVMChainId,
): EVMChainId {
  if (defaultChainId !== undefined) {
    const id = normalizeChainId(defaultChainId);
    if (!providers.has(id)) {
      throw new Error(`RpcHelper: defaultChainId ${id} is not in providers`);
    }
    return id;
  }
  const first = providers.keys().next().value;
  if (first === undefined) {
    throw new Error("RpcHelper: providers map must not be empty");
  }
  return first;
}

/** Canonical hex chain id (`0x01` → `0x1`). */
export function normalizeChainId(value: string): EVMChainId {
  const raw = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(raw)) {
    throw new OwsInvalidParamsError(`Invalid chainId: ${value}`);
  }
  return EVMChainId(`0x${BigInt(raw).toString(16)}`);
}

function readSwitchChainId(params: unknown[]): string {
  const entry = params[0];
  if (
    entry === null ||
    typeof entry !== "object" ||
    !("chainId" in entry) ||
    typeof (entry as { chainId: unknown }).chainId !== "string"
  ) {
    throw new OwsInvalidParamsError(
      "wallet_switchEthereumChain requires [{ chainId }]",
    );
  }
  return (entry as { chainId: string }).chainId;
}

async function jsonRpcRequest(
  url: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
  } catch (error) {
    throw new OwsRpcError(
      error instanceof Error ? error.message : "RPC request failed",
      -32_603,
      { method, url },
    );
  }

  if (!response.ok) {
    throw new OwsRpcError(`RPC HTTP ${response.status}`, -32_603, {
      method,
      url,
      status: response.status,
    });
  }

  let body: {
    result?: unknown;
    error?: { code?: number; message?: string; data?: unknown };
  };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    throw new OwsRpcError("Invalid JSON-RPC response", -32_603, {
      method,
      url,
    });
  }

  if (body.error) {
    throw new OwsRpcError(
      body.error.message ?? "RPC error",
      body.error.code ?? -32_603,
      body.error.data,
    );
  }

  return body.result;
}
