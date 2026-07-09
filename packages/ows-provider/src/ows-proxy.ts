import Postmate from "postmate";
import { DEFAULT_RPC_TIMEOUT_MS } from "@1shotapi/ows-types";
import { RpcHostClient } from "./rpc/host-client.js";
import { EIP1193Provider } from "./eip1193/provider.js";
import {
  applyHiddenWalletContainerStyles,
  applyHiddenWalletFrameStyles,
  DEFAULT_WALLET_SIZE_X,
  DEFAULT_WALLET_SIZE_Y,
  DisplayHostHandler,
} from "./display/host-handler.js";
import { CredentialHostClient } from "./credentials/host-client.js";

export type OWSProxyOptions = {
  /** iframe `name` attribute. Default: `ows-wallet` */
  name?: string;
  /** CSS classes applied to the iframe at creation time. */
  classList?: string[];
  rpcTimeoutMs?: number;
  /**
   * Visible wallet flyout width in CSS pixels.
   * Default: {@link DEFAULT_WALLET_SIZE_X} (300).
   */
  walletSizeX?: number;
  /**
   * Visible wallet flyout height in CSS pixels.
   * Default: {@link DEFAULT_WALLET_SIZE_Y} (400).
   */
  walletSizeY?: number;
};

/** Permissions Policy for the branding iframe (must be set before navigation). */
const WALLET_IFRAME_ALLOW = [
  "publickey-credentials-get *",
  "publickey-credentials-create *",
  // Branding-layer UI (e.g. create-backup copy) and delegation to the signer iframe.
  "clipboard-write *",
].join("; ");

export class OWSProxy {
  public readonly ethereum: EIP1193Provider;
  public readonly credentials: CredentialHostClient;

  private readonly rpcClient: RpcHostClient;
  private readonly displayHandler: DisplayHostHandler;
  private readonly parent: Postmate.ParentAPI;

  private constructor(
    parent: Postmate.ParentAPI,
    rpcClient: RpcHostClient,
    displayHandler: DisplayHostHandler,
  ) {
    this.parent = parent;
    this.rpcClient = rpcClient;
    this.displayHandler = displayHandler;
    this.credentials = new CredentialHostClient(rpcClient);
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

    // Hide the container before Postmate appends the iframe so wallet content
    // does not flash while the cross-frame handshake completes.
    applyHiddenWalletContainerStyles(container);

    // Postmate sets a minimal `allow` then appendChild, then assigns `src`.
    // Permissions Policy is fixed at navigation — patch allow on append, before src.
    const parent = await withWalletIframeAllow(container, () =>
      new Postmate({
        container,
        url: walletUrl,
        name: options?.name ?? "ows-wallet",
        classListArray: options?.classList ?? [],
      }),
    );

    const displayHandler = new DisplayHostHandler(parent, {
      walletSizeX: options?.walletSizeX ?? DEFAULT_WALLET_SIZE_X,
      walletSizeY: options?.walletSizeY ?? DEFAULT_WALLET_SIZE_Y,
    });
    displayHandler.initializeHidden();
    const rpcClient = new RpcHostClient(
      parent,
      options?.rpcTimeoutMs ?? DEFAULT_RPC_TIMEOUT_MS,
      {
        beforeRequest: () => displayHandler.prepareForRpcAccess(),
        afterRequest: () => displayHandler.completeRpcAccess(),
      },
    );

    return new OWSProxy(parent, rpcClient, displayHandler);
  }

  rpc<T = unknown>(method: string, params?: unknown): Promise<T> {
    return this.rpcClient.request<T>(method, params ?? null);
  }

  /**
   * Show the branding iframe as a lower-right flyout (host-initiated).
   * Uses {@link OWSProxyOptions.walletSizeX} / {@link OWSProxyOptions.walletSizeY}.
   * Useful for demos and manual testing without an EIP-1193 request.
   */
  showWallet(): void {
    this.displayHandler.show();
  }

  /** Hide a host-initiated flyout from {@link showWallet}. */
  hideWallet(): void {
    this.displayHandler.hide();
  }

  destroy(): void {
    this.displayHandler.destroy();
    this.rpcClient.destroy();
    this.parent.destroy();
  }
}

/**
 * Postmate creates the iframe, sets a default `allow`, appends it, then sets `src`.
 * Intercept `appendChild` so our Permissions Policy is in place before navigation.
 */
async function withWalletIframeAllow(
  container: HTMLElement,
  create: () => Promise<Postmate.ParentAPI>,
): Promise<Postmate.ParentAPI> {
  const originalAppend = container.appendChild.bind(container);
  container.appendChild = (<T extends Node>(node: T): T => {
    if (node instanceof HTMLIFrameElement) {
      node.allow = WALLET_IFRAME_ALLOW;
      applyHiddenWalletFrameStyles(node);
    }
    return originalAppend(node) as T;
  }) as typeof container.appendChild;

  try {
    return await create();
  } finally {
    container.appendChild = originalAppend;
  }
}
