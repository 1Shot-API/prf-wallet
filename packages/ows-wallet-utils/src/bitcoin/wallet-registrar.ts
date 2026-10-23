import { z } from "zod";
import {
  BITCOIN_WIRE_METHODS,
  type IOpenWalletBitcoinProvider,
} from "@1shotapi/ows-types";

export const getAccountAddressesParamsSchema = z
  .object({
    account: z.string().optional(),
    intentions: z.array(z.string()).optional(),
    chainId: z
      .enum(["Bitcoin", "BitcoinTestnet"])
      .optional(),
  })
  .optional()
  .default({});

export const BITCOIN_PARAM_SCHEMAS = {
  getAccountAddresses: getAccountAddressesParamsSchema,
} as const;

type RpcHandlerRegistration = {
  handler: (params: unknown) => Promise<unknown>;
  paramsSchema?: z.ZodType;
};

export class BitcoinWalletRegistrar {
  private readonly handlers = new Map<string, RpcHandlerRegistration>();

  register(provider: IOpenWalletBitcoinProvider): void {
    this.handlers.set(BITCOIN_WIRE_METHODS.getAccountAddresses, {
      handler: (params: unknown) =>
        provider.getAccountAddresses(
          params as Parameters<IOpenWalletBitcoinProvider["getAccountAddresses"]>[0],
        ),
      paramsSchema: BITCOIN_PARAM_SCHEMAS.getAccountAddresses,
    });
  }

  getRegistration(wireMethod: string): RpcHandlerRegistration | undefined {
    return this.handlers.get(wireMethod);
  }

  registeredWireMethods(): string[] {
    return Array.from(this.handlers.keys());
  }
}
