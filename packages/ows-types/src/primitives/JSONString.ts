import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A string that parses as JSON (object or array JSON text).
 *
 * Example: `'{"foo":"bar"}'`
 */
export type JSONString = Brand<string, "JSONString">;
export const JSONString = make<JSONString>();

/** Zod schema: string that `JSON.parse` accepts. */
export const JSONStringSchema = z
  .string()
  .refine(
    (s) => {
      try {
        JSON.parse(s);
        return true;
      } catch {
        return false;
      }
    },
    { message: "must be valid JSON" },
  )
  .transform((s) => JSONString(s));
