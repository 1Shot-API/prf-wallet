import Postmate from "@1shotapi/postmate";
import {
  DEFAULT_RPC_TIMEOUT_MS,
  deserializeRpcResponse,
  OwsRpcError,
  OwsRpcTimeoutError,
  OWS_RPC_CALLBACK_EVENT,
  serializeRpc,
  type RpcRequestEnvelope,
  type RpcResponseEnvelope,
} from "@1shotapi/ows-types";

type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export class RpcHostClient {
  private nextCallId = 1;
  private readonly pending = new Map<number, PendingRpc>();

  constructor(
    private readonly child: Postmate.ParentAPI,
    private readonly defaultTimeoutMs = DEFAULT_RPC_TIMEOUT_MS,
  ) {
    child.on(OWS_RPC_CALLBACK_EVENT, (data: unknown) => {
      this.handleCallback(data);
    });
  }

  request<T = unknown>(
    method: string,
    params: unknown,
    timeoutMs?: number,
  ): Promise<T> {
    const callId = this.nextCallId++;
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(callId);
        reject(new OwsRpcTimeoutError(`RPC timed out: ${method}`, method, callId));
      }, timeout);

      this.pending.set(callId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeoutId,
      });

      this.child.call(method, this.createRpcRequest(callId, method, params));
    });
  }

  destroy(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("RpcHostClient destroyed"));
    }
    this.pending.clear();
  }

  private handleCallback(data: unknown): void {
    let envelope: RpcResponseEnvelope;
    try {
      envelope = deserializeRpcResponse(data);
    } catch {
      return;
    }

    const pending = this.pending.get(envelope.callId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutId);
    this.pending.delete(envelope.callId);

    if (!envelope.success) {
      if (envelope.error) {
        pending.reject(OwsRpcError.fromPayload(envelope.error));
        return;
      }
      pending.reject(new OwsRpcError("RPC failed", -32_603));
      return;
    }

    pending.resolve(envelope.result);
  }

  private createRpcRequest(
    callId: number,
    method: string,
    params: unknown,
  ): string {
    const envelope: RpcRequestEnvelope = { callId, method, params };
    return serializeRpc(envelope);
  }
}
