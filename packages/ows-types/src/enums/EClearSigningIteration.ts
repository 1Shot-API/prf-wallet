import { z } from "zod";

/** ERC-7730 group `iteration` modes for groups containing arrays. */
export enum EClearSigningIteration {
  Sequential = "sequential",
  Bundled = "bundled",
}

/** Zod schema: {@link EClearSigningIteration} string values. */
export const EClearSigningIterationSchema = z.enum([
  EClearSigningIteration.Sequential,
  EClearSigningIteration.Bundled,
]);
