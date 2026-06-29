/** Base class for OWS SDK errors. */
export class OwsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwsError";
  }
}
