import { type Brand, make } from "ts-brand";
import { getAddress } from "viem";
import { z } from "zod";

/**
 * EVM account address as an EIP-55 checksummed `0x`-prefixed hex string
 * (mixed-case, 40 hex digits). Prefer constructing via
 * {@link EVMAccountAddressSchema} or `AddressUtils.validateEVMAddress`.
 *
 * Example: `"0xAbCdEf0123456789AbCdEf0123456789aBcDeF01"`
 */
export type EVMAccountAddress = Brand<`0x${string}`, "EVMAccountAddress">;
export const EVMAccountAddress = make<EVMAccountAddress>();

/** Zod schema: 20-byte hex address, normalized to EIP-55 checksum. */
export const EVMAccountAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, { message: "must be a 20-byte 0x hex address" })
  .transform((s, ctx) => {
    try {
      return EVMAccountAddress(getAddress(s as `0x${string}`));
    } catch {
      ctx.addIssue({ code: "custom", message: "invalid EIP-55 address" });
      return z.NEVER;
    }
  });
