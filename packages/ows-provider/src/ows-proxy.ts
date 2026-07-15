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
  /**
   * When true, grant Chrome Local Network Access / loopback Permissions Policy
   * so the branding iframe may fetch hosts that resolve to the user's LAN or
   * `127.0.0.1` (still requires a user permission prompt in Chrome 142+).
   * Default: `false`. Credential issuer/verifier demos set this so the ngrok
   * branding iframe can fetch local OID4 HTTPS endpoints (Chrome still prompts).
   */
  allowLocalAccess?: boolean;
};

/** Base Permissions Policy for the branding iframe (must be set before navigation). */
const WALLET_IFRAME_ALLOW_BASE = [
  "publickey-credentials-get *",
  "publickey-credentials-create *",
  // Branding-layer UI (e.g. create-backup copy) and delegation to the signer iframe.
  "clipboard-write *",
];

const WALLET_IFRAME_ALLOW_LOCAL = [
  "local-network-access *",
  "loopback-network *",
];

function walletIframeAllow(allowLocalAccess: boolean): string {
  return (
    allowLocalAccess
      ? [...WALLET_IFRAME_ALLOW_BASE, ...WALLET_IFRAME_ALLOW_LOCAL]
      : WALLET_IFRAME_ALLOW_BASE
  ).join("; ");
}
/** Must match postmate's internal `messageType` (not exported). */
const POSTMATE_MESSAGE_TYPE = "application/x-postmate-v1+json";

/**
 * Postmate only retries the parent handshake 5× (~2.5s after iframe `load`).
 * React branding apps often register `Postmate.Model` slightly later (or after
 * slow work). Keep pulsing until Postmate resolves or this budget elapses.
 */
const EXTENDED_HANDSHAKE_INTERVAL_MS = 500;
const EXTENDED_HANDSHAKE_BUDGET_MS = 30_000;

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
    const parent = await withWalletIframeAllow(
      container,
      Boolean(options?.allowLocalAccess),
      () =>
        withExtendedPostmateHandshake(container, walletUrl, () =>
          new Postmate({
            container,
            url: walletUrl,
            name: options?.name ?? "ows-wallet",
            classListArray: options?.classList ?? [],
          }),
        ),
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
  allowLocalAccess: boolean,
  create: () => Promise<Postmate.ParentAPI>,
): Promise<Postmate.ParentAPI> {
  const allow = walletIframeAllow(allowLocalAccess);
  const originalAppend = container.appendChild.bind(container);
  container.appendChild = (<T extends Node>(node: T): T => {
    if (node instanceof HTMLIFrameElement) {
      node.allow = allow;
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

/**
 * Continue Postmate handshake `postMessage`s after stock Postmate stops at 5 tries.
 * Parent's reply listener stays registered — extra handshakes still complete the Promise.
 */
async function withExtendedPostmateHandshake(
  container: HTMLElement,
  walletUrl: string,
  create: () => Promise<Postmate.ParentAPI>,
): Promise<Postmate.ParentAPI> {
  let childOrigin: string;
  try {
    childOrigin = new URL(walletUrl).origin;
  } catch {
    return create();
  }

  let intervalId: ReturnType<typeof setInterval> | undefined;
  let stopTimerId: ReturnType<typeof setTimeout> | undefined;

  const stop = () => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
    if (stopTimerId !== undefined) {
      clearTimeout(stopTimerId);
      stopTimerId = undefined;
    }
  };

  const pulse = () => {
    const iframe = container.querySelector("iframe");
    const child = iframe?.contentWindow;
    if (!child) return;
    child.postMessage(
      {
        postmate: "handshake",
        type: POSTMATE_MESSAGE_TYPE,
        model: {},
      },
      childOrigin,
    );
  };

  // Start extending after Postmate's native window (~2.5s) so we don't duplicate
  // the early attempts heavily; then pulse until connected or budget expires.
  const startExtending = () => {
    stopTimerId = setTimeout(stop, EXTENDED_HANDSHAKE_BUDGET_MS);
    intervalId = setInterval(pulse, EXTENDED_HANDSHAKE_INTERVAL_MS);
  };
  const extendDelayId = setTimeout(startExtending, 2_000);

  try {
    const parent = await create();
    clearTimeout(extendDelayId);
    stop();
    return parent;
  } catch (error) {
    clearTimeout(extendDelayId);
    stop();
    throw error;
  }
}
