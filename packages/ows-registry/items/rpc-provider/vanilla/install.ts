import type { BrandingContext, BrandingModule } from "@1shotapi/ows-branding-core";
import {
  EVMChainId,
  OwsInvalidParamsError,
  OwsRpcError,
} from "@1shotapi/ows-types";

/**
 * Non-signing EIP-1193 methods proxied to the configured JSON-RPC endpoint
 * for the active chain. Account / signing methods are intentionally omitted.
 */
export const EIP1193_READ_METHODS = [
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_createAccessList",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_maxPriorityFeePerGas",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getProof",
  "eth_getTransactionCount",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getUncleByBlockHashAndIndex",
  "eth_getUncleByBlockNumberAndIndex",
  "eth_getUncleCountByBlockHash",
  "eth_getUncleCountByBlockNumber",
  "eth_getTransactionByHash",
  "eth_getTransactionByBlockHashAndIndex",
  "eth_getTransactionByBlockNumberAndIndex",
  "eth_getTransactionReceipt",
  "eth_getLogs",
  "eth_getFilterChanges",
  "eth_getFilterLogs",
  "eth_newFilter",
  "eth_newBlockFilter",
  "eth_newPendingTransactionFilter",
  "eth_uninstallFilter",
  "eth_syncing",
  "net_version",
  "net_listening",
  "net_peerCount",
  "web3_clientVersion",
  "web3_sha3",
] as const;

export type Eip1193ReadMethod = (typeof EIP1193_READ_METHODS)[number];

/** MetaMask / EIP-1193 code for an unknown `wallet_switchEthereumChain` target. */
const UNRECOGNIZED_CHAIN_ID = 4902;

export type RpcProviderEventMap = {
  chainChanged: [chainId: EVMChainId];
};

type Listener<E extends keyof RpcProviderEventMap> = (
  ...args: RpcProviderEventMap[E]
) => void;

/** Minimal EventEmitter for rpc-provider (no Node `events` dependency). */
export class RpcProviderEventEmitter {
  private readonly listeners = new Map<
    keyof RpcProviderEventMap,
    Set<Listener<keyof RpcProviderEventMap>>
  >();

  on<E extends keyof RpcProviderEventMap>(
    event: E,
    listener: Listener<E>,
  ): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<keyof RpcProviderEventMap>);
    return this;
  }

  off<E extends keyof RpcProviderEventMap>(
    event: E,
    listener: Listener<E>,
  ): this {
    this.listeners
      .get(event)
      ?.delete(listener as Listener<keyof RpcProviderEventMap>);
    return this;
  }

  emit<E extends keyof RpcProviderEventMap>(
    event: E,
    ...args: RpcProviderEventMap[E]
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

export type RpcProviderModuleOptions = {
  /**
   * Chain id → JSON-RPC HTTP(S) URL (public endpoints or Infura/Alchemy/etc.).
   * Keys are EIP-1193 hex chain ids (`0x1`, `0xaa36a7`, …).
   */
  providers: Map<EVMChainId, string> | ReadonlyMap<EVMChainId, string>;
  /**
   * Active chain on install. Defaults to the first entry in `providers`
   * (insertion order).
   */
  defaultChainId?: EVMChainId;
};

export type RpcProviderModule = BrandingModule & {
  readonly events: RpcProviderEventEmitter;
  getChainId(): EVMChainId;
  /** Same logic as the EIP-1193 `wallet_switchEthereumChain` handler. */
  switchChain(chainId: EVMChainId | string): Promise<null>;
  getConfiguredChainIds(): readonly EVMChainId[];
};

/**
 * Headless branding module: registers EIP-1193 read methods and chain selection
 * against a `Map<chainId, providerUrl>` configuration. No UI.
 */
export function createRpcProviderModule(
  options: RpcProviderModuleOptions,
): RpcProviderModule {
  const providers = normalizeProviders(options.providers);
  if (providers.size === 0) {
    throw new Error("rpc-provider: providers map must not be empty");
  }

  const events = new RpcProviderEventEmitter();
  let currentChainId = resolveDefaultChainId(providers, options.defaultChainId);

  const switchChain = async (
    chainIdInput: EVMChainId | string,
  ): Promise<null> => {
    const chainId = normalizeChainId(chainIdInput);
    if (!providers.has(chainId)) {
      throw new OwsRpcError(
        `Unrecognized chain ID: ${chainId}`,
        UNRECOGNIZED_CHAIN_ID,
        { chainId },
      );
    }
    if (chainId !== currentChainId) {
      currentChainId = chainId;
      events.emit("chainChanged", currentChainId);
    }
    return null;
  };

  return {
    name: "rpc-provider",
    phase: "pre-start",
    events,
    getChainId: () => currentChainId,
    switchChain,
    getConfiguredChainIds: () => [...providers.keys()],
    install(ctx: BrandingContext): void {
      ctx.wallet.registerEip1193("eth_chainId", async () => currentChainId);

      ctx.wallet.registerEip1193(
        "wallet_switchEthereumChain",
        async (params) => switchChain(readSwitchChainId(params)),
      );

      const proxy =
        (method: string) =>
        async (params: unknown[]): Promise<unknown> => {
          const url = providers.get(currentChainId);
          if (!url) {
            throw new OwsRpcError(
              `No RPC provider configured for chain ${currentChainId}`,
              UNRECOGNIZED_CHAIN_ID,
              { chainId: currentChainId },
            );
          }
          return jsonRpcRequest(url, method, params);
        };

      for (const method of EIP1193_READ_METHODS) {
        ctx.wallet.registerEip1193(method, proxy(method));
      }
    },
  };
}

function normalizeProviders(
  providers: Map<EVMChainId, string> | ReadonlyMap<EVMChainId, string>,
): Map<EVMChainId, string> {
  const out = new Map<EVMChainId, string>();
  for (const [chainId, url] of providers) {
    const id = normalizeChainId(chainId);
    const trimmed = url.trim();
    if (!trimmed) {
      throw new Error(`rpc-provider: empty URL for chain ${id}`);
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
      throw new Error(
        `rpc-provider: defaultChainId ${id} is not in providers`,
      );
    }
    return id;
  }
  const first = providers.keys().next().value;
  if (first === undefined) {
    throw new Error("rpc-provider: providers map must not be empty");
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
