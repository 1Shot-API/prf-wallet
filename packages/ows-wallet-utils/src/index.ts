/**
 * OWS wallet iframe utilities — host ↔ wallet messaging.
 * Wraps @1shotapi/postmate with typed RPC. Implementation forthcoming.
 */

export type OwsWalletParentOptions = {
  container: HTMLElement;
  url: string;
  allow?: string;
};

export class OwsWalletParent {
  static async connect(_options: OwsWalletParentOptions): Promise<OwsWalletParent> {
    throw new Error("Not implemented");
  }
}

export class OwsWalletChild {
  static async handshake(): Promise<OwsWalletChild> {
    throw new Error("Not implemented");
  }
}
