/**
 * OWS EIP-1193 provider for host applications.
 * Implementation forthcoming.
 */

export type OwsProviderConfig = {
  container: HTMLElement;
  walletUrl: string;
};

/** Minimal EIP-1193 shape — will be expanded during implementation. */
export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

export async function createOwsProvider(
  _config: OwsProviderConfig,
): Promise<EthereumProvider> {
  throw new Error("Not implemented");
}
