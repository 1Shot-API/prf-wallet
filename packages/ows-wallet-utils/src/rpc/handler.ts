import type { z } from "zod";
import { OwsInvalidParamsError, OwsRpcError } from "@1shotapi/ows-types";

export async function runHandler<T>(
  params: unknown,
  schema: z.ZodType<T> | undefined,
  handler: (validated: T) => Promise<unknown>,
): Promise<unknown> {
  try {
    if (schema) {
      const parsed = schema.safeParse(params);
      if (!parsed.success) {
        throw new OwsInvalidParamsError("Invalid params", parsed.error.flatten());
      }
      return await handler(parsed.data);
    }
    return await handler(params as T);
  } catch (error) {
    if (error instanceof OwsRpcError) {
      throw error;
    }
    throw error;
  }
}
