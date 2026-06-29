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

export type RpcModelHandler = (params: unknown) => Promise<unknown>;

export type RpcModelRegistration = {
  handler: RpcModelHandler;
  paramsSchema?: z.ZodType;
};

export async function handleRpcModelCall(
  childApi: Postmate.ChildAPI,
  data: unknown,
  registration: RpcModelRegistration,
): Promise<void> {
  let envelope;
  try {
    envelope = deserializeRpcRequest(data);
  } catch (error) {
    emitError(
      childApi,
      -1,
      error instanceof Error ? error.message : "Invalid RPC request",
      -32_600,
    );
    return;
  }

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
    childApi.emit(OWS_RPC_CALLBACK_EVENT, serializeRpc(response));
  } catch (error) {
    if (error instanceof OwsRpcError) {
      const response: RpcResponseEnvelope = {
        callId: envelope.callId,
        success: false,
        error: error.toPayload(),
      };
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
