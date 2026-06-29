import type { RpcRequestEnvelope, RpcResponseEnvelope } from "./wallet.js";

export function serializeRpc<T>(value: T): string {
  return JSON.stringify(value);
}

export function deserializeRpcRequest(data: unknown): RpcRequestEnvelope {
  const parsed = parseJson(data);
  if (
    typeof parsed.callId !== "number" ||
    typeof parsed.method !== "string" ||
    !("params" in parsed)
  ) {
    throw new Error("Invalid RPC request envelope");
  }
  return parsed as RpcRequestEnvelope;
}

export function deserializeRpcResponse(data: unknown): RpcResponseEnvelope {
  const parsed = parseJson(data);
  if (
    typeof parsed.callId !== "number" ||
    typeof parsed.success !== "boolean"
  ) {
    throw new Error("Invalid RPC response envelope");
  }
  return parsed as RpcResponseEnvelope;
}

function parseJson(data: unknown): Record<string, unknown> {
  if (typeof data === "string") {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid RPC JSON payload");
    }
    return parsed as Record<string, unknown>;
  }
  if (!data || typeof data !== "object") {
    throw new Error("Invalid RPC payload");
  }
  return data as Record<string, unknown>;
}
