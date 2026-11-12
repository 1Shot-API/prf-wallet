import { z } from "zod";
import {
  Base64StringSchema,
  DomainStringSchema,
  ISO8601DateTimeSchema,
  SOLANA_WIRE_METHODS,
  SolanaAccountAddressSchema,
  SolanaChainIdSchema,
  UriStringSchema,
  type IOpenWalletSolanaProvider,
} from "@1shotapi/ows-types";

export const getAccountAddressParamsSchema = z
  .object({
    chainId: SolanaChainIdSchema.optional(),
  })
  .optional()
  .default({});

export const signMessageParamsSchema = z.object({
  messages: z.array(Base64StringSchema).min(1),
});

export const signTransactionParamsSchema = z.object({
  transactions: z.array(Base64StringSchema).min(1),
});

export const signAndSendTransactionParamsSchema = z.object({
  transaction: Base64StringSchema,
  chainId: SolanaChainIdSchema.optional(),
});

export const signInParamsSchema = z
  .object({
    domain: DomainStringSchema.optional(),
    address: SolanaAccountAddressSchema.optional(),
    statement: z.string().optional(),
    uri: UriStringSchema.optional(),
    version: z.string().optional(),
    chainId: SolanaChainIdSchema.optional(),
    nonce: z.string().optional(),
    issuedAt: ISO8601DateTimeSchema.optional(),
    expirationTime: ISO8601DateTimeSchema.optional(),
    notBefore: ISO8601DateTimeSchema.optional(),
    requestId: z.string().optional(),
    resources: z.array(UriStringSchema).optional(),
  })
  .optional()
  .default({});

export const SOLANA_PARAM_SCHEMAS = {
  getAccountAddress: getAccountAddressParamsSchema,
  signMessage: signMessageParamsSchema,
  signTransaction: signTransactionParamsSchema,
  signAndSendTransaction: signAndSendTransactionParamsSchema,
  signIn: signInParamsSchema,
} as const;

type RpcHandlerRegistration = {
  handler: (params: unknown) => Promise<unknown>;
  paramsSchema?: z.ZodType;
};

export class SolanaWalletRegistrar {
  private readonly handlers = new Map<string, RpcHandlerRegistration>();

  register(provider: IOpenWalletSolanaProvider): void {
    this.handlers.set(SOLANA_WIRE_METHODS.getAccountAddress, {
      handler: (params: unknown) =>
        provider.getAccountAddress(
          params as Parameters<IOpenWalletSolanaProvider["getAccountAddress"]>[0],
        ),
      paramsSchema: SOLANA_PARAM_SCHEMAS.getAccountAddress,
    });
    this.handlers.set(SOLANA_WIRE_METHODS.signMessage, {
      handler: (params: unknown) =>
        provider.signMessage(
          params as Parameters<IOpenWalletSolanaProvider["signMessage"]>[0],
        ),
      paramsSchema: SOLANA_PARAM_SCHEMAS.signMessage,
    });
    this.handlers.set(SOLANA_WIRE_METHODS.signTransaction, {
      handler: (params: unknown) =>
        provider.signTransaction(
          params as Parameters<IOpenWalletSolanaProvider["signTransaction"]>[0],
        ),
      paramsSchema: SOLANA_PARAM_SCHEMAS.signTransaction,
    });
    this.handlers.set(SOLANA_WIRE_METHODS.signAndSendTransaction, {
      handler: (params: unknown) =>
        provider.signAndSendTransaction(
          params as Parameters<
            IOpenWalletSolanaProvider["signAndSendTransaction"]
          >[0],
        ),
      paramsSchema: SOLANA_PARAM_SCHEMAS.signAndSendTransaction,
    });
    this.handlers.set(SOLANA_WIRE_METHODS.signIn, {
      handler: (params: unknown) =>
        provider.signIn(
          params as Parameters<IOpenWalletSolanaProvider["signIn"]>[0],
        ),
      paramsSchema: SOLANA_PARAM_SCHEMAS.signIn,
    });
  }

  getRegistration(wireMethod: string): RpcHandlerRegistration | undefined {
    return this.handlers.get(wireMethod);
  }

  registeredWireMethods(): string[] {
    return Array.from(this.handlers.keys());
  }
}
