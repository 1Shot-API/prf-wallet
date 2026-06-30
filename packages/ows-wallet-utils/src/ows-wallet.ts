import Postmate from "@1shotapi/postmate";
import type { z } from "zod";
import { getEip1193ParamSchema } from "./eip1193/schemas.js";
import {
  EIP1193_METHODS,
  type Eip1193Method,
  isEip1193Method,
} from "./eip1193/methods.js";
import { OwsUnimplementedError } from "@1shotapi/ows-types";
import {
  handleRpcModelCall,
  type RpcModelRegistration,
} from "./rpc/child-wrapper.js";
import { debugLog, setOwsWalletDebugFromOptions } from "./debug.js";

export type Eip1193Handler = (params: unknown[]) => Promise<unknown>;

export type RpcHandlerRegistration = {
  handler: (params: unknown) => Promise<unknown>;
  paramsSchema?: z.ZodType;
};

export type OWSWalletOptions = {
  /** Log Postmate handshake and RPC traffic to `console.debug`. */
  debug?: boolean;
  eip1193?: Partial<Record<Eip1193Method, Eip1193Handler>>;
  rpc?: Record<string, RpcHandlerRegistration>;
};

export class OWSWallet {
  private childApi: Postmate.ChildAPI | null = null;
  private handshakePromise: Promise<Postmate.ChildAPI> | null = null;
  private readonly eip1193Handlers = new Map<Eip1193Method, Eip1193Handler>();
  private readonly customHandlers = new Map<string, RpcHandlerRegistration>();
  private handshakeStarted = false;

  private constructor(options?: OWSWalletOptions) {
    setOwsWalletDebugFromOptions(options?.debug);
    if (options?.eip1193) {
      for (const [method, handler] of Object.entries(options.eip1193)) {
        if (handler) {
          this.eip1193Handlers.set(method as Eip1193Method, handler);
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
      modelMethods: Object.keys(model).length,
    });

    this.handshakePromise = new Postmate.Model(model);
    this.childApi = await this.handshakePromise;

    debugLog("Postmate child connected; RPC model ready");

    return this;
  }

  registerEip1193(method: Eip1193Method, handler: Eip1193Handler): void {
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
    this.childApi = null;
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

    for (const method of EIP1193_METHODS) {
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

    return model;
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
    if (isEip1193 && isEip1193Method(method)) {
      const handler = this.eip1193Handlers.get(method);
      const paramsSchema = getEip1193ParamSchema(method);
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
