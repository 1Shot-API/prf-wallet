import { RPCCallId } from "../primitives/RPCCallId.js";
import {
  RPC_ERROR_INVALID_PARAMS,
  RPC_ERROR_UNIMPLEMENTED,
  RPC_ERROR_USER_REJECTED,
  type RpcErrorPayload,
} from "../protocol/wallet.js";
import { OwsError } from "./base.js";

export class OwsRpcError extends OwsError {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "OwsRpcError";
  }

  toPayload(): RpcErrorPayload {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }

  static fromPayload(payload: RpcErrorPayload): OwsRpcError {
    if (payload.code === RPC_ERROR_UNIMPLEMENTED) {
      return new OwsUnimplementedError(payload.message, payload.data);
    }
    if (payload.code === RPC_ERROR_INVALID_PARAMS) {
      return new OwsInvalidParamsError(payload.message, payload.data);
    }
    if (payload.code === RPC_ERROR_USER_REJECTED) {
      return new OwsUserRejectedError(payload.message, payload.data);
    }
    return new OwsRpcError(payload.message, payload.code, payload.data);
  }
}

export class OwsUnimplementedError extends OwsRpcError {
  constructor(message = "Method not implemented", data?: unknown) {
    super(message, RPC_ERROR_UNIMPLEMENTED, data);
    this.name = "OwsUnimplementedError";
  }
}

export class OwsInvalidParamsError extends OwsRpcError {
  constructor(message = "Invalid params", data?: unknown) {
    super(message, RPC_ERROR_INVALID_PARAMS, data);
    this.name = "OwsInvalidParamsError";
  }
}

export class OwsUserRejectedError extends OwsRpcError {
  constructor(message = "User rejected the request", data?: unknown) {
    super(message, RPC_ERROR_USER_REJECTED, data);
    this.name = "OwsUserRejectedError";
  }
}

export class OwsRpcTimeoutError extends OwsRpcError {
  constructor(
    message: string,
    readonly method: string,
    readonly callId: RPCCallId,
  ) {
    super(message, -32_603, { method, callId });
    this.name = "OwsRpcTimeoutError";
  }
}
