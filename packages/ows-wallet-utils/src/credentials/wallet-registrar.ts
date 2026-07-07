import type { z } from "zod";
import {
  CREDENTIAL_PARAM_SCHEMAS,
  CREDENTIAL_WIRE_METHODS,
  type CredentialHandlers,
} from "@1shotapi/ows-credentials";

type RpcHandlerRegistration = {
  handler: (params: unknown) => Promise<unknown>;
  paramsSchema?: z.ZodType;
};

type CredentialMethod = keyof typeof CREDENTIAL_WIRE_METHODS;

const METHOD_TO_WIRE: Record<CredentialMethod, string> = {
  acceptOffer: CREDENTIAL_WIRE_METHODS.acceptOffer,
  present: CREDENTIAL_WIRE_METHODS.present,
  list: CREDENTIAL_WIRE_METHODS.list,
  delete: CREDENTIAL_WIRE_METHODS.delete,
};

const PARAM_SCHEMAS: Record<CredentialMethod, z.ZodType> = {
  acceptOffer: CREDENTIAL_PARAM_SCHEMAS.acceptOffer,
  present: CREDENTIAL_PARAM_SCHEMAS.present,
  list: CREDENTIAL_PARAM_SCHEMAS.list,
  delete: CREDENTIAL_PARAM_SCHEMAS.delete,
};

export class CredentialWalletRegistrar {
  private readonly handlers = new Map<string, RpcHandlerRegistration>();

  register(handlers: CredentialHandlers): void {
    const entries: Array<[CredentialMethod, CredentialHandlers[CredentialMethod]]> =
      [
        ["acceptOffer", handlers.acceptOffer],
        ["present", handlers.present],
        ["list", handlers.list],
        ["delete", handlers.delete],
      ];

    for (const [method, handler] of entries) {
      const wireKey = METHOD_TO_WIRE[method];
      this.handlers.set(wireKey, {
        paramsSchema: PARAM_SCHEMAS[method],
        handler: async (params) => handler(params as never),
      });
    }
  }

  getWireMethods(): string[] {
    return [...this.handlers.keys()];
  }

  getRegistration(wireKey: string): RpcHandlerRegistration | undefined {
    return this.handlers.get(wireKey);
  }

  isRegistered(): boolean {
    return this.handlers.size > 0;
  }
}
