import {
  OwsInvalidRequestError,
  OwsNotAllowedError,
  OwsSignDeniedError,
  OwsTimeoutError,
} from "../errors.js";
import {
  API_VERSION,
  type SignerEvent,
  type SignerEventMessage,
  type SignerMethod,
  type SignerRequest,
} from "@1shotapi/ows-types";

export { keyDerivedDataFromEvent } from "./parse-public-keys.js";
export {
  publicKeyDataFromEvent,
  credentialCreatedDataFromEvent,
} from "./parse-public-keys.js";

export type RequestOptions = {
  terminalEvent: SignerEvent;
  /** After terminalEvent, wait briefly for these events and merge their data. */
  alsoWaitFor?: SignerEvent[];
  alsoWaitForTimeoutMs?: number;
  timeoutMs?: number;
  onIntermediate?: (event: SignerEvent, data: Record<string, unknown>) => void;
};

type PendingRequest<TData extends Record<string, unknown>> = {
  method: SignerMethod;
  terminalEvent: SignerEvent;
  alsoWaitFor?: SignerEvent[];
  alsoWaitForTimeoutMs: number;
  accumulated: Record<string, unknown>;
  receivedAlsoWaitFor: Set<SignerEvent>;
  resolve: (data: TData) => void;
  reject: (error: Error) => void;
  onIntermediate?: RequestOptions["onIntermediate"];
  timeoutId: ReturnType<typeof setTimeout>;
  alsoWaitForTimeoutId?: ReturnType<typeof setTimeout>;
  waitingForAlsoWaitFor: boolean;
};

const DEFAULT_TIMEOUT_MS = 120_000;

export class SignerRpcClient {
  private nextCorrelationId = 1;
  private readonly pending = new Map<string, PendingRequest<Record<string, unknown>>>();
  private readonly listener: (event: MessageEvent) => void;

  constructor(
    private readonly iframe: HTMLIFrameElement,
    readonly signerOrigin: string,
    private readonly defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.listener = (event: MessageEvent) => {
      this.handleMessage(event);
    };
    window.addEventListener("message", this.listener);
  }

  request<TData extends Record<string, unknown>>(
    method: SignerMethod,
    params: Record<string, unknown> | undefined,
    options: RequestOptions,
  ): Promise<TData> {
    const correlationId = String(this.nextCorrelationId++);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<TData>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(correlationId);
        this.postCancel();
        reject(
          new OwsTimeoutError(
            `Signer RPC timed out: ${method}`,
            method,
            correlationId,
          ),
        );
      }, timeoutMs);

      this.pending.set(correlationId, {
        method,
        terminalEvent: options.terminalEvent,
        alsoWaitFor: options.alsoWaitFor,
        alsoWaitForTimeoutMs: options.alsoWaitForTimeoutMs ?? 100,
        accumulated: {},
        receivedAlsoWaitFor: new Set(),
        resolve: resolve as (data: Record<string, unknown>) => void,
        reject,
        onIntermediate: options.onIntermediate,
        timeoutId,
        waitingForAlsoWaitFor: false,
      });

      const message: SignerRequest = {
        v: API_VERSION,
        kind: "request",
        method,
        correlationId,
        params,
      };

      const target = this.iframe.contentWindow;
      if (!target) {
        clearTimeout(timeoutId);
        this.pending.delete(correlationId);
        reject(new Error("Signer iframe contentWindow unavailable"));
        return;
      }

      target.postMessage(message, this.signerOrigin);
    });
  }

  destroy(): void {
    window.removeEventListener("message", this.listener);
    this.postCancel();
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeoutId);
      if (pending.alsoWaitForTimeoutId) {
        clearTimeout(pending.alsoWaitForTimeoutId);
      }
      pending.reject(new Error("SignerRpcClient destroyed"));
      this.pending.delete(id);
    }
  }

  /** Tell the signer to drop a stuck Confirm wait / ceremony lock. */
  private postCancel(): void {
    const target = this.iframe.contentWindow;
    if (!target) return;
    target.postMessage(
      { v: API_VERSION, kind: "cancel" },
      this.signerOrigin,
    );
  }

  private handleMessage(event: MessageEvent): void {
    if (event.origin !== this.signerOrigin) return;
    if (event.source !== this.iframe.contentWindow) return;

    const data = event.data;
    if (!isSignerEventMessage(data)) return;

    const correlationId = data.correlationId;
    if (correlationId === undefined) return;

    const pending = this.pending.get(correlationId);
    if (!pending) return;

    if (data.event === "SignDenied") {
      this.finishPending(
        correlationId,
        pending,
        new OwsSignDeniedError(
          String(data.data.reason ?? "signDenied"),
          typeof data.data.reason === "string" ? data.data.reason : undefined,
        ),
      );
      return;
    }

    if (data.event === "NotAllowed") {
      this.finishPending(
        correlationId,
        pending,
        new OwsNotAllowedError(
          String(data.data.reason ?? "notAllowed"),
          typeof data.data.reason === "string" ? data.data.reason : undefined,
        ),
      );
      return;
    }

    if (data.event === "InvalidRequest") {
      this.finishPending(
        correlationId,
        pending,
        new OwsInvalidRequestError(
          String(data.data.reason ?? "invalidRequest"),
          typeof data.data.reason === "string" ? data.data.reason : undefined,
        ),
      );
      return;
    }

    if (data.event === "KeyDerived" && pending.onIntermediate) {
      pending.onIntermediate(data.event, data.data);
    } else if (pending.onIntermediate) {
      pending.onIntermediate(data.event, data.data);
    }

    Object.assign(pending.accumulated, data.data);

    if (pending.alsoWaitFor?.includes(data.event)) {
      pending.receivedAlsoWaitFor.add(data.event);
    }

    if (data.event === pending.terminalEvent) {
      if (pending.alsoWaitFor?.length && !pending.waitingForAlsoWaitFor) {
        pending.waitingForAlsoWaitFor = true;
        const allReceived = pending.alsoWaitFor.every((event) =>
          pending.receivedAlsoWaitFor.has(event),
        );
        if (allReceived) {
          this.finishPending(correlationId, pending, undefined, pending.accumulated);
          return;
        }
        pending.alsoWaitForTimeoutId = setTimeout(() => {
          this.finishPending(correlationId, pending, undefined, pending.accumulated);
        }, pending.alsoWaitForTimeoutMs);
        return;
      }
      this.finishPending(correlationId, pending, undefined, pending.accumulated);
      return;
    }

    if (
      pending.waitingForAlsoWaitFor &&
      pending.alsoWaitFor?.includes(data.event)
    ) {
      const allReceived = pending.alsoWaitFor.every((event) =>
        pending.receivedAlsoWaitFor.has(event),
      );
      if (allReceived) {
        if (pending.alsoWaitForTimeoutId) {
          clearTimeout(pending.alsoWaitForTimeoutId);
        }
        this.finishPending(correlationId, pending, undefined, pending.accumulated);
      }
    }
  }

  private finishPending(
    correlationId: string,
    pending: PendingRequest<Record<string, unknown>>,
    error?: Error,
    data?: Record<string, unknown>,
  ): void {
    clearTimeout(pending.timeoutId);
    if (pending.alsoWaitForTimeoutId) {
      clearTimeout(pending.alsoWaitForTimeoutId);
    }
    this.pending.delete(correlationId);
    if (error) {
      pending.reject(error);
      return;
    }
    pending.resolve(data ?? pending.accumulated);
  }
}

export function isSignerEventMessage(data: unknown): data is SignerEventMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.v === API_VERSION &&
    msg.kind === "event" &&
    typeof msg.event === "string" &&
    typeof msg.data === "object" &&
    msg.data !== null
  );
}
