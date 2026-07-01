import type {
  EIP1193RequestArgs,
  EIP1193RequestArgsFor,
  EIP1193Requests,
  KnownEIP1193Method,
} from "./requests.js";

export type {
  EIP1193RequestArgs,
  EIP1193Requests,
  EvmSignatureHex,
  KnownEIP1193Method,
} from "./requests.js";

type RpcInvoker = (method: string, params: unknown) => Promise<unknown>;

export class EIP1193Provider {
  private readonly listeners = new Map<
    string,
    Set<(...args: unknown[]) => void>
  >();

  constructor(private readonly invoke: RpcInvoker) {}

  request<M extends string>(
    args: M extends KnownEIP1193Method
      ? EIP1193RequestArgsFor<M>
      : EIP1193RequestArgs,
  ): Promise<
    M extends KnownEIP1193Method ? EIP1193Requests[M]["result"] : unknown
  > {
    const rpcParams = normalizeEip1193Params(args.params);
    return this.invoke(args.method, rpcParams) as Promise<
      M extends KnownEIP1193Method ? EIP1193Requests[M]["result"] : unknown
    >;
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  removeListener(event: string, listener: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }
}

function normalizeEip1193Params(
  params: EIP1193RequestArgs["params"],
): unknown[] {
  if (params === undefined) {
    return [];
  }
  if (Array.isArray(params)) {
    return [...params];
  }
  return [params];
}
