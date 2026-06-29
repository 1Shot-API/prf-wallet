export class OwsSignerError extends Error {
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
