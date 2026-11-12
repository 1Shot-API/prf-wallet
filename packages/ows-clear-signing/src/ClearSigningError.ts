import { OwsError } from "@1shotapi/ows-types";

/**
 * A descriptor cannot be applied to this transaction / message: binding mismatch, selector
 * or type-hash mismatch, unresolvable path, invalid map reference, failed `mustMatch`, etc.
 * Callers MUST fall back to their generic (non clear-signed) display.
 */
export class ClearSigningError extends OwsError {
  constructor(message: string) {
    super(message);
    this.name = "ClearSigningError";
  }
}
