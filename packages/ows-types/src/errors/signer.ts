import { OwsError } from "./base.js";

export class OwsSignerError extends OwsError {
  constructor(message: string) {
    super(message);
    this.name = "OwsSignerError";
  }
}

export class OwsNotAllowedError extends OwsSignerError {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "OwsNotAllowedError";
  }
}

/**
 * User cancelled the Signing Layer passkey Confirm UI (before WebAuthn).
 * Distinct from {@link OwsNotAllowedError} (WebAuthn cancel/policy) and
 * Host-layer EIP-1193 user rejection (`OwsUserRejectedError`).
 */
export class OwsSignDeniedError extends OwsSignerError {
  constructor(
    message = "User denied the passkey ceremony",
    readonly reason?: string,
  ) {
    super(message);
    this.name = "OwsSignDeniedError";
  }
}

export class OwsInvalidRequestError extends OwsSignerError {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = "OwsInvalidRequestError";
  }
}

export class OwsTimeoutError extends OwsSignerError {
  constructor(
    message: string,
    readonly method: string,
    readonly correlationId: string,
  ) {
    super(message);
    this.name = "OwsTimeoutError";
  }
}
