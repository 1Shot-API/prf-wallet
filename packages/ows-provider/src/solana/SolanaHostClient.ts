import {
  SOLANA_WIRE_METHODS,
  type IOpenWalletSolanaProvider,
  type ISolanaGetAccountAddressParams,
  type ISolanaSignAndSendTransactionParams,
  type ISolanaSignAndSendTransactionResult,
  type ISolanaSignInParams,
  type ISolanaSignInResult,
  type ISolanaSignMessageParams,
  type ISolanaSignMessageResult,
  type ISolanaSignTransactionParams,
  type ISolanaSignTransactionResult,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";
import type { RpcHostClient } from "../rpc/RpcHostClient.js";
import {
  OwsSolanaStandardWallet,
  type OwsSolanaStandardWalletOptions,
} from "./standard-wallet.js";

export type RegisterSolanaWalletOptions = OwsSolanaStandardWalletOptions;
export type { WalletIcon } from "@wallet-standard/base";

/**
 * Host-side Solana namespace — forwards to Branding via Postmate wire methods.
 * Opt-in Wallet Standard discovery via {@link registerSolanaWallet}.
 */
export class SolanaHostClient implements IOpenWalletSolanaProvider {
  #standardWallet: OwsSolanaStandardWallet | undefined;
  #registered = false;
  #appReadyListener: ((event: Event) => void) | undefined;
  readonly #unregisterFns: Array<() => void> = [];

  constructor(private readonly rpcClient: RpcHostClient) {}

  getAccountAddress(
    params?: ISolanaGetAccountAddressParams,
  ): Promise<SolanaAccountAddress> {
    return this.rpcClient.request<SolanaAccountAddress>(
      SOLANA_WIRE_METHODS.getAccountAddress,
      params ?? {},
    );
  }

  signMessage(
    params: ISolanaSignMessageParams,
  ): Promise<ISolanaSignMessageResult> {
    return this.rpcClient.request<ISolanaSignMessageResult>(
      SOLANA_WIRE_METHODS.signMessage,
      params,
    );
  }

  signTransaction(
    params: ISolanaSignTransactionParams,
  ): Promise<ISolanaSignTransactionResult> {
    return this.rpcClient.request<ISolanaSignTransactionResult>(
      SOLANA_WIRE_METHODS.signTransaction,
      params,
    );
  }

  signAndSendTransaction(
    params: ISolanaSignAndSendTransactionParams,
  ): Promise<ISolanaSignAndSendTransactionResult> {
    return this.rpcClient.request<ISolanaSignAndSendTransactionResult>(
      SOLANA_WIRE_METHODS.signAndSendTransaction,
      params,
    );
  }

  signIn(params?: ISolanaSignInParams): Promise<ISolanaSignInResult> {
    return this.rpcClient.request<ISolanaSignInResult>(
      SOLANA_WIRE_METHODS.signIn,
      params ?? {},
    );
  }

  /**
   * Register this Solana namespace as a Wallet Standard wallet on the Host
   * `window` (idempotent). Never called automatically from `OWSProxy.create`.
   */
  registerSolanaWallet(options?: RegisterSolanaWalletOptions): void {
    if (typeof window === "undefined") {
      throw new Error(
        "registerSolanaWallet requires a browser Host window",
      );
    }
    if (this.#registered) {
      return;
    }
    this.#standardWallet ??= new OwsSolanaStandardWallet(this, options);
    const wallet = this.#standardWallet;

    const callback = ({
      register,
    }: {
      register: (wallet: OwsSolanaStandardWallet) => () => void;
    }): void => {
      const unregister = register(wallet);
      this.#unregisterFns.push(unregister);
    };

    try {
      window.dispatchEvent(
        new RegisterWalletEvent(callback as WindowRegisterWalletCallback),
      );
    } catch (error) {
      console.error(
        "wallet-standard:register-wallet event could not be dispatched\n",
        error,
      );
    }

    this.#appReadyListener = (event: Event): void => {
      callback(
        (event as CustomEvent<{ register: (wallet: OwsSolanaStandardWallet) => () => void }>).detail,
      );
    };
    try {
      window.addEventListener(
        "wallet-standard:app-ready",
        this.#appReadyListener,
      );
    } catch (error) {
      console.error(
        "wallet-standard:app-ready event listener could not be added\n",
        error,
      );
    }

    this.#registered = true;
  }

  /**
   * Unregister previously registered Wallet Standard entry points and clear
   * the app-ready listener. Safe to call when never registered.
   */
  unregisterSolanaWallet(): void {
    for (const unregister of this.#unregisterFns.splice(0)) {
      try {
        unregister();
      } catch {
        // ignore
      }
    }
    if (this.#appReadyListener !== undefined && typeof window !== "undefined") {
      window.removeEventListener(
        "wallet-standard:app-ready",
        this.#appReadyListener,
      );
      this.#appReadyListener = undefined;
    }
    this.#registered = false;
  }

  /** Tear down Standard registration (called from {@link OWSProxy.destroy}). */
  destroy(): void {
    this.unregisterSolanaWallet();
    this.#standardWallet = undefined;
  }
}

type WindowRegisterWalletCallback = (api: {
  register: (wallet: unknown) => () => void;
}) => void;

/**
 * Mirrors `@wallet-standard/wallet` `RegisterWalletEvent` so we can capture
 * the `unregister` return value from each app's `register(wallet)`.
 */
class RegisterWalletEvent extends Event {
  readonly #detail: WindowRegisterWalletCallback;

  get detail(): WindowRegisterWalletCallback {
    return this.#detail;
  }

  get type(): string {
    return "wallet-standard:register-wallet";
  }

  constructor(callback: WindowRegisterWalletCallback) {
    super("wallet-standard:register-wallet", {
      bubbles: false,
      cancelable: false,
      composed: false,
    });
    this.#detail = callback;
  }

  override preventDefault(): void {
    throw new Error("preventDefault cannot be called");
  }

  override stopImmediatePropagation(): void {
    throw new Error("stopImmediatePropagation cannot be called");
  }

  override stopPropagation(): void {
    throw new Error("stopPropagation cannot be called");
  }
}
