import {
  BITCOIN_WIRE_METHODS,
  type IBitcoinAccountAddressEntry,
  type IBitcoinGetAccountAddressesParams,
  type IOpenWalletBitcoinProvider,
} from "@1shotapi/ows-types";
import type { RpcHostClient } from "../rpc/RpcHostClient.js";

/**
 * Host-side Bitcoin namespace — conforms to the Reown / BIP-122 static-wallet pattern.
 */
export class BitcoinHostClient implements IOpenWalletBitcoinProvider {
  constructor(private readonly rpcClient: RpcHostClient) {}

  getAccountAddresses(
    params?: IBitcoinGetAccountAddressesParams,
  ): Promise<IBitcoinAccountAddressEntry[]> {
    return this.rpcClient.request<IBitcoinAccountAddressEntry[]>(
      BITCOIN_WIRE_METHODS.getAccountAddresses,
      params ?? {},
    );
  }
}
