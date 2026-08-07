import { type Brand, make } from "ts-brand";

/**
 * Non-serialized raw JSON. May be a JSON object or array. Example: `{"foo":"bar"}` or `["foo","bar"]`.
 * Should be able to be parsed by `JSON.parse` with no manipulation.
 */
export type JSONString = Brand<string, "JSONString">;
export const JSONString = make<JSONString>();
