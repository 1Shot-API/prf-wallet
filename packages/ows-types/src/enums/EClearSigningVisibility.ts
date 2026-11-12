import { z } from "zod";

/**
 * ERC-7730 simple field `visible` rules. Complex rules (`ifNotIn`, `mustMatch`) are objects;
 * see `IClearSigningVisibilityRule`.
 */
export enum EClearSigningVisibility {
  Never = "never",
  Always = "always",
  Optional = "optional",
}

/** Zod schema: {@link EClearSigningVisibility} string values. */
export const EClearSigningVisibilitySchema = z.enum([
  EClearSigningVisibility.Never,
  EClearSigningVisibility.Always,
  EClearSigningVisibility.Optional,
]);
