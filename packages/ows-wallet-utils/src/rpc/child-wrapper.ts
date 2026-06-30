import type Postmate from "@1shotapi/postmate";
import {
  OWS_RPC_CALLBACK_EVENT,
  OwsRpcError,
  deserializeRpcRequest,
  serializeRpc,
  type RpcResponseEnvelope,
} from "@1shotapi/ows-types";
import { runHandler } from "./handler.js";
import type { z } from "zod";
import { debugLog } from "../debug.js";

export type RpcModelHandler = (params: unknown) => Promise<unknown>;

export type RpcModelRegistration = {
  handler: RpcModelHandler;
  paramsSchema?: z.ZodType;
};

export async function handleRpcModelCall(
  childApi: Postmate.ChildAPI,
  data: unknown,
  registration: RpcModelRegistration,
  methodLabel?: string,
): Promise<void> {
  let envelope;
  try {
    envelope = deserializeRpcRequest(data);
  } catch (error) {
    debugLog("RPC request deserialize failed", {
      method: methodLabel,
      error: error instanceof Error ? error.message : error,
    });
    emitError(
      childApi,
      -1,
      error instanceof Error ? error.message : "Invalid RPC request",
      -32_600,
    );
    return;
  }

  debugLog("RPC request received", {
    method: methodLabel ?? envelope.method,
    callId: envelope.callId,
    params: envelope.params,
  });

  try {
    const result = await runHandler(
      envelope.params,
      registration.paramsSchema,
      registration.handler,
    );
    const response: RpcResponseEnvelope = {
      callId: envelope.callId,
      success: true,
      result,
    };
    debugLog("RPC response success", {
      method: methodLabel ?? envelope.method,
      callId: envelope.callId,
      result,
    });
    childApi.emit(OWS_RPC_CALLBACK_EVENT, serializeRpc(response));
  } catch (error) {
    if (error instanceof OwsRpcError) {
      const response: RpcResponseEnvelope = {
        callId: envelope.callId,
        success: false,
        error: error.toPayload(),
      };
      debugLog("RPC response error", {
        method: methodLabel ?? envelope.method,
        callId: envelope.callId,
        error: error.toPayload(),
      });
      childApi.emit(OWS_RPC_CALLBACK_EVENT, serializeRpc(response));
      return;
    }

    const response: RpcResponseEnvelope = {
      callId: envelope.callId,
      success: false,
      error: {
        code: -32_603,
        message: error instanceof Error ? error.message : "Internal error",
      },
    };
    debugLog("RPC response internal error", {
      method: methodLabel ?? envelope.method,
      callId: envelope.callId,
      error: response.error,
    });
    childApi.emit(OWS_RPC_CALLBACK_EVENT, serializeRpc(response));
  }
}

function emitError(
  childApi: Postmate.ChildAPI,
  callId: number,
  message: string,
  code: number,
): void {
  const response: RpcResponseEnvelope = {
    callId,
    success: false,
    error: { code, message },
  };
  childApi.emit(OWS_RPC_CALLBACK_EVENT, serializeRpc(response));
}
