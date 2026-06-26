/**
 * OWS custody signer host utilities for wallet iframe implementers.
 * Implementation forthcoming.
 */

export type OwsSignerHostConfig = {
  /** URL of the custody signer document (HTTPS or verified on-chain gateway). */
  signerUrl: string;
};

export type OwsSignerEvmApi = {
  signMessage(message: string | Uint8Array): Promise<`0x${string}`>;
  signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    message: Record<string, unknown>,
  ): Promise<`0x${string}`>;
};

export class OwsSignerHost {
  readonly evm: OwsSignerEvmApi;

  constructor(_config: OwsSignerHostConfig) {
    this.evm = {
      signMessage: async () => {
        throw new Error("Not implemented");
      },
      signTypedData: async () => {
        throw new Error("Not implemented");
      },
    };
  }
}
