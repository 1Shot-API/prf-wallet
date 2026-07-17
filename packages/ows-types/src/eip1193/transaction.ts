import type { EVMAccountAddress } from "../primitives/EVMAccountAddress.js";
import type { EVMChainId } from "../primitives/EVMChainId.js";
import type { HexString } from "../primitives/HexString.js";

/**
 * EIP-1193 `eth_sendTransaction` / `eth_signTransaction` request object.
 * Quantities are hex-encoded per JSON-RPC.
 */
export interface IEVMTransactionRequest {
  from?: EVMAccountAddress;
  to?: EVMAccountAddress | null;
  gas?: HexString;
  gasPrice?: HexString;
  maxFeePerGas?: HexString;
  maxPriorityFeePerGas?: HexString;
  value?: HexString;
  data?: HexString;
  nonce?: HexString;
  chainId?: EVMChainId;
  type?: string;
  accessList?: unknown[];
}
