import Postmate from "@1shotapi/postmate";
import { DEFAULT_RPC_TIMEOUT_MS } from "@1shotapi/ows-types";
import { RpcHostClient } from "./rpc/host-client.js";
import { EIP1193Provider } from "./eip1193/provider.js";

export type OWSProxyOptions = {
  /** iframe `name` attribute. Default: `ows-wallet` */
  name?: string;
  /** CSS classes applied to the iframe at creation time. */
  classList?: string[];
  rpcTimeoutMs?: number;
};

export class OWSProxy {
  readonly ethereum: EIP1193Provider;

  private readonly rpcClient: RpcHostClient;
  private readonly parent: Postmate.ParentAPI;

  private constructor(parent: Postmate.ParentAPI, rpcClient: RpcHostClient) {
    this.parent = parent;
    this.rpcClient = rpcClient;
    this.ethereum = new EIP1193Provider((method, params) =>
      this.rpc(method, params),
    );
  }

  static async create(
    container: HTMLElement,
    walletUrl: string,
    options?: OWSProxyOptions,
  ): Promise<OWSProxy> {
    if (typeof window === "undefined") {
      throw new Error("OWSProxy requires a browser environment");
    }

    const handshake = new Postmate({
      container,
      url: walletUrl,
      name: options?.name ?? "ows-wallet",
      classListArray: options?.classList ?? [],
    });

    const parent = await handshake;
    const rpcClient = new RpcHostClient(
      parent,
      options?.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
    );

    return new OWSProxy(parent, rpcClient);
  }

  rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
    return this.rpcClient.request<T>(method, params ?? null);
  }

  destroy(): void {
    this.rpcClient.destroy();
    this.parent.destroy();
  }
}
