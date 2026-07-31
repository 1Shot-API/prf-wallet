import {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  type Eip1193Method,
} from "@1shotapi/ows-types";
import { z } from "zod";

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => EVMAccountAddress(value as `0x${string}`));

const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/);

const hexStringSchema = hexSchema.transform((value) =>
  HexString(value as `0x${string}`),
);

const chainIdSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .transform((value) =>
    EVMChainId(`0x${BigInt(value).toString(16)}` as `0x${string}`),
  );

const transactionObjectSchema = z.object({
  from: addressSchema.optional(),
  to: addressSchema.nullish(),
  gas: hexSchema.optional(),
  gasPrice: hexSchema.optional(),
  maxFeePerGas: hexSchema.optional(),
  maxPriorityFeePerGas: hexSchema.optional(),
  value: hexSchema.optional(),
  data: hexSchema.optional(),
  nonce: hexSchema.optional(),
  chainId: hexSchema.optional(),
  type: z.string().optional(),
  accessList: z.array(z.unknown()).optional(),
});

const typedDataObjectSchema = z.object({
  types: z.record(
    z.string(),
    z.array(z.object({ name: z.string(), type: z.string() })),
  ),
  primaryType: z.string(),
  domain: z.record(z.string(), z.unknown()),
  message: z.record(z.string(), z.unknown()),
});

/** Object or JSON string (common for eth_signTypedData_v3 / _v4). */
const typedDataSchema = z.union([
  typedDataObjectSchema,
  z.string().transform((value, ctx) => {
    try {
      return typedDataObjectSchema.parse(JSON.parse(value));
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Invalid EIP-712 typed data JSON",
      });
      return z.NEVER;
    }
  }),
]);

const switchChainParamsSchema = z.object({
  chainId: hexSchema,
});

const addChainParamsSchema = z.object({
  chainId: hexSchema,
  chainName: z.string(),
  nativeCurrency: z.object({
    name: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  rpcUrls: z.array(z.string()),
  blockExplorerUrls: z.array(z.string()).optional(),
  iconUrls: z.array(z.string()).optional(),
});

const watchAssetParamsSchema = z.object({
  type: z.literal("ERC20"),
  options: z.object({
    address: addressSchema,
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    image: z.string().optional(),
  }),
});

const executionPermissionSchema = z.object({
  type: z.string().min(1),
  isAdjustmentAllowed: z.boolean(),
  data: z.record(z.string(), z.unknown()),
});

const executionPermissionRuleSchema = z.object({
  type: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

/** Single EIP-7715 permission request object. */
const executionPermissionRequestSchema = z.object({
  chainId: chainIdSchema,
  from: addressSchema.optional(),
  to: addressSchema,
  permission: executionPermissionSchema,
  rules: z.array(executionPermissionRuleSchema).optional(),
});

/**
 * EIP-7715: `params` is the permission request array itself
 * (not wrapped as a single tuple element).
 */
const requestExecutionPermissionsParamsSchema = z.array(
  executionPermissionRequestSchema,
);

const revokeExecutionPermissionParamsSchema = z.object({
  permissionContext: hexStringSchema,
});

export const EIP1193_PARAM_SCHEMAS: Record<Eip1193Method, z.ZodType> = {
  eth_requestAccounts: z.tuple([]),
  eth_accounts: z.tuple([]),
  eth_chainId: z.tuple([]),
  personal_sign: z.tuple([z.union([hexSchema, z.string()]), addressSchema]),
  eth_sign: z.tuple([addressSchema, z.union([hexSchema, z.string()])]),
  eth_signTypedData: z.tuple([addressSchema, typedDataSchema]),
  eth_signTypedData_v3: z.tuple([addressSchema, typedDataSchema]),
  eth_signTypedData_v4: z.tuple([addressSchema, typedDataSchema]),
  eth_sendTransaction: z.tuple([transactionObjectSchema]),
  eth_signTransaction: z.tuple([transactionObjectSchema]),
  wallet_switchEthereumChain: z.tuple([switchChainParamsSchema]),
  wallet_addEthereumChain: z.tuple([addChainParamsSchema]),
  wallet_watchAsset: z.tuple([watchAssetParamsSchema]),
  wallet_requestExecutionPermissions: requestExecutionPermissionsParamsSchema,
  wallet_revokeExecutionPermission: z.tuple([
    revokeExecutionPermissionParamsSchema,
  ]),
  wallet_getSupportedExecutionPermissions: z.tuple([]),
  wallet_getGrantedExecutionPermissions: z.tuple([]),
};

export function getEip1193ParamSchema(method: Eip1193Method): z.ZodType {
  return EIP1193_PARAM_SCHEMAS[method];
}
