import Postmate from "postmate";
import {
  deserializeRpcResponse,
  OwsRpcError,
  OWS_RPC_CALLBACK_EVENT,
  serializeRpc,
  type RpcRequestEnvelope,
  type RpcResponseEnvelope,
  RPCCallId,
} from "@1shotapi/ows-types";

type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export type RpcHostLifecycle = {
  beforeRequest?: () => void;
  afterRequest?: () => void;
};

/**
 * Host → Branding RPC over Postmate.
 *
 * No provider-imposed timeout: many methods (`personal_sign`,
 * `eth_sendTransaction`, `wallet_requestExecutionPermissions`, …) wait on
 * user deliberation, which has no deadline in EIP-1193. A pending request
 * settles when the Branding Layer emits its callback, or rejects when
 * {@link RpcHostClient.destroy} runs (e.g. `OWSProxy.destroy()`).
 * Hosts that need a bound on a specific non-interactive call should apply
 * their own `Promise.race` / abort at the call site.
 */
export class RpcHostClient {
  private nextCallId = RPCCallId(1);
  private readonly pending = new Map<RPCCallId, PendingRpc>();

  constructor(
    private readonly child: Postmate.ParentAPI,
    private readonly lifecycle?: RpcHostLifecycle,
  ) {
    child.on(OWS_RPC_CALLBACK_EVENT, (data: unknown) => {
      this.handleCallback(data);
    });
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    const callId = RPCCallId(this.nextCallId++);

    this.lifecycle?.beforeRequest?.();

    return new Promise<T>((resolve, reject) => {
      this.pending.set(callId, {
        resolve: (value) => {
          this.lifecycle?.afterRequest?.();
          resolve(value as T);
        },
        reject: (error) => {
          this.lifecycle?.afterRequest?.();
          reject(error);
        },
      });

      this.child.call(method, this.createRpcRequest(callId, method, params));
    });
  }

  destroy(): void {
    for (const pending of this.pending.values()) {
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
    callId: RPCCallId,
    method: string,
    params: unknown,
  ): string {
    const envelope: RpcRequestEnvelope = { callId, method, params };
    return serializeRpc(envelope);
  }
}
