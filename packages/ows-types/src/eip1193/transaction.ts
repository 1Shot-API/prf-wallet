import { z } from "zod";
import { EVMAccountAddressSchema } from "../primitives/EVMAccountAddress.js";
import { EVMChainIdSchema } from "../primitives/EVMChainId.js";
import { HexStringSchema } from "../primitives/HexString.js";

/**
 * EIP-1193 `eth_sendTransaction` / `eth_signTransaction` request object.
 * Quantities are hex-encoded per JSON-RPC.
 */
export const IEVMTransactionRequestSchema = z.object({
  from: EVMAccountAddressSchema.optional(),
  to: EVMAccountAddressSchema.nullable().optional(),
  gas: HexStringSchema.optional(),
  gasPrice: HexStringSchema.optional(),
  maxFeePerGas: HexStringSchema.optional(),
  maxPriorityFeePerGas: HexStringSchema.optional(),
  value: HexStringSchema.optional(),
  data: HexStringSchema.optional(),
  nonce: HexStringSchema.optional(),
  chainId: EVMChainIdSchema.optional(),
  type: z.string().optional(),
  accessList: z.array(z.unknown()).optional(),
});

export type IEVMTransactionRequest = z.infer<
  typeof IEVMTransactionRequestSchema
>;
