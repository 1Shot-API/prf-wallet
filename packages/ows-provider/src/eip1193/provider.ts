export type EIP1193RequestArgs = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

export type EIP1193Provider = {
  request(args: EIP1193RequestArgs): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

type RpcInvoker = (method: string, params: unknown) => Promise<unknown>;

export function createEip1193Provider(
  invoke: RpcInvoker,
): EIP1193Provider {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    async request({ method, params }) {
      const rpcParams = normalizeEip1193Params(params);
      return invoke(method, rpcParams);
    },
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener);
    },
  };
}

function normalizeEip1193Params(
  params: EIP1193RequestArgs["params"],
): unknown[] {
  if (params === undefined) {
    return [];
  }
  if (Array.isArray(params)) {
    return params;
  }
  return [params];
}
