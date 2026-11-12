import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * EIP-712 struct type name, e.g. a message `primaryType`.
 *
 * Example: `"Permit"`, `"PermitBatch"`, `"SafeTx"`
 */
export type EIP712TypeName = Brand<string, "EIP712TypeName">;
export const EIP712TypeName = make<EIP712TypeName>();

/** Zod schema: identifier-shaped EIP-712 struct name. */
export const EIP712TypeNameSchema = z
  .string()
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, {
    message: "must be an EIP-712 struct type name",
  })
  .transform((s) => EIP712TypeName(s));
