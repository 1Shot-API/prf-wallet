import { type Brand, make } from "ts-brand";

/**
 * A monotonically increasing number for RPC calls.
 */
export type RPCCallId = Brand<number, "RPCCallId">;
export const RPCCallId = make<RPCCallId>();
