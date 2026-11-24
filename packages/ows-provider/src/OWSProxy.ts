import { CredentialHostClient } from "./credentials/CredentialsHostClient.js";
import { BitcoinHostClient } from "./bitcoin/BitcoinHostClient.js";
import { SolanaHostClient } from "./solana/SolanaHostClient.js";
import {
  OWSProxyCore,
  type IOWSProxyConnection,
  type OWSProxyOptions,
} from "./OWSProxyCore.js";

/**
 * Full Host Layer proxy: everything in {@link OWSProxyCore} plus the
 * credentials, Bitcoin, and Solana namespaces.
 */
export class OWSProxy extends OWSProxyCore {
  public readonly credentials: CredentialHostClient;
  public readonly bitcoin: BitcoinHostClient;
  public readonly solana: SolanaHostClient;

  protected constructor(connection: IOWSProxyConnection) {
    super(connection);
    this.credentials = new CredentialHostClient(this.rpcClient);
    this.bitcoin = new BitcoinHostClient(this.rpcClient);
    this.solana = new SolanaHostClient(this.rpcClient);
  }

  static override async create(
    container: HTMLElement,
    walletUrl: string,
    options?: OWSProxyOptions,
  ): Promise<OWSProxy> {
    return new OWSProxy(
      await OWSProxyCore.connect(container, walletUrl, options),
    );
  }

  override destroy(): void {
    this.solana.destroy();
    super.destroy();
  }
}
