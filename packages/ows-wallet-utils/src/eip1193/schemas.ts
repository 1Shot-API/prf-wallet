import {
  EVMAccountAddressSchema,
  EVMChainId,
  EVMChainIdSchema,
  HexStringSchema,
  type Eip1193Method,
} from "@1shotapi/ows-types";
import { z } from "zod";

const hexSchema = z.string().regex(/^0x[0-9a-fA-F]*$/);

/**
 * EIP-5792 chain id: `0x` + hex, no leading zeros (`0x0` is the only zero form).
 * `"0x01"` is invalid params, not a synonym of `"0x1"`.
 */
const strictHexChainIdSchema = z
  .string()
  .regex(/^0x(0|[1-9a-fA-F][0-9a-fA-F]*)$/, {
    message: "chainId must be 0x-prefixed hex with no leading zeros",
  })
  .transform((value) => EVMChainId(`0x${BigInt(value).toString(16)}` as `0x${string}`));

const walletCallCapabilitySchema = z
  .object({
    optional: z.boolean().optional(),
  })
  .catchall(z.unknown());

const walletCallSchema = z.strictObject({
  to: EVMAccountAddressSchema,
  data: hexSchema.optional(),
  value: hexSchema.optional(),
  capabilities: z.record(z.string(), walletCallCapabilitySchema).optional(),
});

const sendCallsParamsSchema = z.tuple([
  z.strictObject({
    version: z.literal("2.0.0"),
    id: z.string().min(1).max(8194).optional(),
    from: EVMAccountAddressSchema.optional(),
    chainId: strictHexChainIdSchema,
    atomicRequired: z.boolean(),
    calls: z.array(walletCallSchema).min(1),
    capabilities: z.record(z.string(), walletCallCapabilitySchema).optional(),
  }),
]);

const callsBundleIdSchema = z.tuple([z.string().min(1).max(8194)]);

const getCapabilitiesParamsSchema = z.union([
  z.tuple([]),
  z.tuple([EVMAccountAddressSchema]),
  z.tuple([
    EVMAccountAddressSchema,
    z.array(strictHexChainIdSchema),
  ]),
]);

const transactionObjectSchema = z.object({
  from: EVMAccountAddressSchema.optional(),
  to: EVMAccountAddressSchema.nullish(),
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
    address: EVMAccountAddressSchema,
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
  chainId: EVMChainIdSchema,
  from: EVMAccountAddressSchema.optional(),
  to: EVMAccountAddressSchema,
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
  permissionContext: HexStringSchema,
});

export const EIP1193_PARAM_SCHEMAS: Record<Eip1193Method, z.ZodType> = {
  eth_requestAccounts: z.tuple([]),
  eth_accounts: z.tuple([]),
  eth_chainId: z.tuple([]),
  personal_sign: z.tuple([
    z.union([hexSchema, z.string()]),
    EVMAccountAddressSchema,
  ]),
  eth_sign: z.tuple([EVMAccountAddressSchema, z.union([hexSchema, z.string()])]),
  eth_signTypedData: z.tuple([EVMAccountAddressSchema, typedDataSchema]),
  eth_signTypedData_v3: z.tuple([EVMAccountAddressSchema, typedDataSchema]),
  eth_signTypedData_v4: z.tuple([EVMAccountAddressSchema, typedDataSchema]),
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
  wallet_getCapabilities: getCapabilitiesParamsSchema,
  wallet_sendCalls: sendCallsParamsSchema,
  wallet_getCallsStatus: callsBundleIdSchema,
  wallet_showCallsStatus: callsBundleIdSchema,
};

export function getEip1193ParamSchema(method: Eip1193Method): z.ZodType {
  return EIP1193_PARAM_SCHEMAS[method];
}
