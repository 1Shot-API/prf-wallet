import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Git commit SHA of the ERC-7730 clear-signing registry snapshot a descriptor was resolved from.
 *
 * Example: `"3f2a9c0d1e5b7a8c9d0e1f2a3b4c5d6e7f8a9b0c"`
 */
export type ClearSigningRegistrySha = Brand<string, "ClearSigningRegistrySha">;
export const ClearSigningRegistrySha = make<ClearSigningRegistrySha>();

/** Zod schema: 40-hex git commit SHA, normalized to lowercase. */
export const ClearSigningRegistryShaSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{40}$/, { message: "must be a 40-hex git commit SHA" })
  .transform((s) => ClearSigningRegistrySha(s.toLowerCase()));
