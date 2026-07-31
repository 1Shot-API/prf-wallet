import Postmate from "postmate";
import type { z } from "zod";
import {
  EIP1193_METHODS,
  isEip1193Method,
  OWS_DISPLAY_READY_MODEL_METHOD,
  OWS_HIDE_READY_MODEL_METHOD,
  OwsUnimplementedError,
  type RequestDisplayParams,
} from "@1shotapi/ows-types";
import { getEip1193ParamSchema } from "./eip1193/schemas.js";
import {
  handleRpcModelCall,
  type RpcModelRegistration,
} from "./rpc/child-wrapper.js";
import {
  DisplayChildClient,
  type DisplaySession,
} from "./display/child-client.js";
import { AnalyticsChildClient } from "./analytics/child-client.js";
import { debugLog, setOwsWalletDebugFromOptions } from "./debug.js";
import { CredentialWalletRegistrar } from "./credentials/wallet-registrar.js";
import type {
  IOWSAnalyticsEvent,
  OpenWalletCredentialProvider,
} from "@1shotapi/ows-types";

export type { DisplaySession, RequestDisplayParams };

export type Eip1193Handler = (params: unknown[]) => Promise<unknown>;

export type RpcHandlerRegistration = {
  handler: (params: unknown) => Promise<unknown>;
  paramsSchema?: z.ZodType;
};

export type OWSWalletOptions = {
  /** Log Postmate handshake and RPC traffic to `console.debug`. */
  debug?: boolean;
  /**
   * EIP-1193 handlers. Keys may be standard wallet methods (`Eip1193Method`)
   * or additional methods registered by branding modules (e.g. `eth_call`).
   */
  eip1193?: Partial<Record<string, Eip1193Handler>>;
  rpc?: Record<string, RpcHandlerRegistration>;
};

export class OWSWallet {
  private childApi: Postmate.ChildAPI | null = null;
  private handshakePromise: Promise<Postmate.ChildAPI> | null = null;
  private displayClient: DisplayChildClient | null = null;
  private analyticsClient: AnalyticsChildClient | null = null;
  private displayReadyHandler: ((data: unknown) => void) | null = null;
  private hideReadyHandler: ((data: unknown) => void) | null = null;
  private readonly eip1193Handlers = new Map<string, Eip1193Handler>();
  private readonly customHandlers = new Map<string, RpcHandlerRegistration>();
  private readonly credentialRegistrar = new CredentialWalletRegistrar();
  private handshakeStarted = false;

  private constructor(options?: OWSWalletOptions) {
    setOwsWalletDebugFromOptions(options?.debug);
    if (options?.eip1193) {
      for (const [method, handler] of Object.entries(options.eip1193)) {
        if (handler) {
          this.eip1193Handlers.set(method, handler);
        }
      }
    }
    if (options?.rpc) {
      for (const [method, registration] of Object.entries(options.rpc)) {
        this.customHandlers.set(method, registration);
      }
    }
  }

  /** Build a wallet instance; call `register*` then `start()`. */
  static prepare(options?: OWSWalletOptions): OWSWallet {
    if (typeof window === "undefined") {
      throw new Error("OWSWallet requires a browser environment");
    }
    return new OWSWallet(options);
  }

  /** Namespaced verifiable credential handlers (not generic `registerRpc`). */
  readonly credentials = {
    register: (handlers: OpenWalletCredentialProvider): void => {
      this.assertNotConnected();
      this.credentialRegistrar.register(handlers);
    },
  };

  /**
   * Branding → Host analytics. Emits the full event object over Postmate
   * (`ows:analytics`). Extra fields beyond the OWS base are branding-owned.
   */
  readonly analytics = {
    emit: (event: IOWSAnalyticsEvent): void => {
      const client = this.getAnalyticsClient();
      if (!client) {
        debugLog("analytics emit skipped; wallet not connected", {
          name: event.name,
        });
        return;
      }
      client.emit(event);
    },
  };

  static async create(options?: OWSWalletOptions): Promise<OWSWallet> {
    return OWSWallet.prepare(options).start();
  }

  async start(): Promise<OWSWallet> {
    if (this.handshakeStarted) {
      throw new Error("OWSWallet handshake already started");
    }
    this.handshakeStarted = true;

    const model = this.buildPostmateModel();
    debugLog("starting Postmate child handshake", {
      eip1193Handlers: [...this.eip1193Handlers.keys()],
      customRpc: [...this.customHandlers.keys()],
      credentialRpc: this.credentialRegistrar.getWireMethods(),
      modelMethods: Object.keys(model).length,
    });

    this.handshakePromise = new Postmate.Model(model);
    this.childApi = await this.handshakePromise;
    this.displayClient = new DisplayChildClient(this.childApi);
    this.analyticsClient = new AnalyticsChildClient(this.childApi);
    this.displayReadyHandler = (data) => {
      this.displayClient?.handleDisplayReady(data);
    };
    this.hideReadyHandler = (data) => {
      this.displayClient?.handleHideReady(data);
    };

    debugLog("Postmate child connected; RPC model ready");

    return this;
  }

  /**
   * Ask the host to show and focus this iframe so WebAuthn / UI can run in a
   * cross-origin embedding. Resolves when the host confirms display is ready.
   */
  async requestDisplay(
    params: RequestDisplayParams = {},
  ): Promise<DisplaySession> {
    const childApi =
      this.childApi ?? (await this.handshakePromise);
    if (!childApi) {
      throw new Error("OWSWallet is not connected to a host");
    }

    if (!this.displayClient) {
      this.displayClient = new DisplayChildClient(childApi);
    }

    return this.displayClient.requestDisplay(params);
  }

  /** Ask the host to hide the wallet panel (e.g. user dismissed the flyout). */
  async requestHide(): Promise<void> {
    const childApi =
      this.childApi ?? (await this.handshakePromise);
    if (!childApi) {
      throw new Error("OWSWallet is not connected to a host");
    }

    if (!this.displayClient) {
      this.displayClient = new DisplayChildClient(childApi);
    }

    return this.displayClient.requestHide();
  }

  /**
   * Register an EIP-1193 method handler. Standard wallet methods are always
   * exposed on the Postmate model; additional methods (e.g. `eth_call`) are
   * added when registered so host `ethereum.request` can reach them.
   */
  registerEip1193(method: string, handler: Eip1193Handler): void {
    this.assertNotConnected();
    this.eip1193Handlers.set(method, handler);
  }

  registerRpc(
    method: string,
    handler: (params: unknown) => Promise<unknown>,
    paramsSchema?: z.ZodType,
  ): void {
    this.assertNotConnected();
    this.customHandlers.set(method, { handler, paramsSchema });
  }

  destroy(): void {
    this.displayClient?.destroy();
    this.displayClient = null;
    this.analyticsClient = null;
    this.displayReadyHandler = null;
    this.hideReadyHandler = null;
    this.childApi = null;
  }

  private getAnalyticsClient(): AnalyticsChildClient | null {
    if (this.analyticsClient) {
      return this.analyticsClient;
    }
    if (!this.childApi) {
      return null;
    }
    this.analyticsClient = new AnalyticsChildClient(this.childApi);
    return this.analyticsClient;
  }

  private assertNotConnected(): void {
    if (this.handshakeStarted) {
      throw new Error(
        "Cannot register handlers after OWSWallet.create(); pass handlers in OWSWalletOptions",
      );
    }
  }

  private buildPostmateModel(): Record<
    string,
    (data: unknown) => Promise<void>
  > {
    const model: Record<string, (data: unknown) => Promise<void>> = {};

    model[OWS_DISPLAY_READY_MODEL_METHOD] = async (data) => {
      this.displayReadyHandler?.(data);
    };

    model[OWS_HIDE_READY_MODEL_METHOD] = async (data) => {
      this.hideReadyHandler?.(data);
    };

    const eip1193Methods = new Set<string>([
      ...EIP1193_METHODS,
      ...this.eip1193Handlers.keys(),
    ]);
    for (const method of eip1193Methods) {
      model[method] = async (data) => {
        await this.dispatch(method, data, true);
      };
    }

    for (const method of this.customHandlers.keys()) {
      if (!(method in model)) {
        model[method] = async (data) => {
          await this.dispatch(method, data, false);
        };
      }
    }

    for (const wireKey of this.credentialRegistrar.getWireMethods()) {
      if (!(wireKey in model)) {
        model[wireKey] = async (data) => {
          await this.dispatchCredential(wireKey, data);
        };
      }
    }

    return model;
  }

  private async dispatchCredential(wireKey: string, data: unknown): Promise<void> {
    debugLog("Credential RPC model invoked", { wireKey, raw: data });

    const childApi =
      this.childApi ?? (await this.handshakePromise);
    if (!childApi) {
      debugLog("Credential RPC dropped — child API not available", { wireKey });
      return;
    }

    const registration = this.credentialRegistrar.getRegistration(wireKey);
    if (!registration) {
      await handleRpcModelCall(
        childApi,
        data,
        {
          handler: async () => {
            throw new OwsUnimplementedError(
              `Credential method not registered: ${wireKey}`,
            );
          },
        },
        wireKey,
      );
      return;
    }

    await handleRpcModelCall(childApi, data, registration, wireKey);
  }

  private async dispatch(
    method: string,
    data: unknown,
    isEip1193: boolean,
  ): Promise<void> {
    debugLog("RPC model invoked", { method, isEip1193, raw: data });

    const childApi =
      this.childApi ?? (await this.handshakePromise);
    if (!childApi) {
      debugLog("RPC dropped — child API not available", { method });
      return;
    }

    const registration = this.resolveRegistration(method, isEip1193);
    await handleRpcModelCall(childApi, data, registration, method);
  }

  private resolveRegistration(
    method: string,
    isEip1193: boolean,
  ): RpcModelRegistration {
    if (isEip1193) {
      const handler = this.eip1193Handlers.get(method);
      const paramsSchema = isEip1193Method(method)
        ? getEip1193ParamSchema(method)
        : undefined;
      if (handler) {
        return {
          paramsSchema,
          handler: async (params) => handler(params as unknown[]),
        };
      }
      return {
        paramsSchema,
        handler: async () => {
          throw new OwsUnimplementedError(`EIP-1193 method not implemented: ${method}`);
        },
      };
    }

    const custom = this.customHandlers.get(method);
    if (custom) {
      return custom;
    }

    return {
      handler: async () => {
        throw new OwsUnimplementedError(`RPC method not implemented: ${method}`);
      },
    };
  }
}
