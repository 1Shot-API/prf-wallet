import {
  SOLANA_WIRE_METHODS,
  type IOpenWalletSolanaProvider,
  type ISolanaGetAccountAddressParams,
  type ISolanaSignAndSendTransactionParams,
  type ISolanaSignAndSendTransactionResult,
  type ISolanaSignInParams,
  type ISolanaSignInResult,
  type ISolanaSignMessageParams,
  type ISolanaSignMessageResult,
  type ISolanaSignTransactionParams,
  type ISolanaSignTransactionResult,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";
import type { RpcHostClient } from "../rpc/RpcHostClient.js";

/**
 * Host-side Solana namespace — forwards to Branding via Postmate wire methods.
 * Wallet Standard registration (`registerSolanaWallet`) is Phase 2.
 */
export class SolanaHostClient implements IOpenWalletSolanaProvider {
  constructor(private readonly rpcClient: RpcHostClient) {}

  getAccountAddress(
    params?: ISolanaGetAccountAddressParams,
  ): Promise<SolanaAccountAddress> {
    return this.rpcClient.request<SolanaAccountAddress>(
      SOLANA_WIRE_METHODS.getAccountAddress,
      params ?? {},
    );
  }

  signMessage(
    params: ISolanaSignMessageParams,
  ): Promise<ISolanaSignMessageResult> {
    return this.rpcClient.request<ISolanaSignMessageResult>(
      SOLANA_WIRE_METHODS.signMessage,
      params,
    );
  }

  signTransaction(
    params: ISolanaSignTransactionParams,
  ): Promise<ISolanaSignTransactionResult> {
    return this.rpcClient.request<ISolanaSignTransactionResult>(
      SOLANA_WIRE_METHODS.signTransaction,
      params,
    );
  }

  signAndSendTransaction(
    params: ISolanaSignAndSendTransactionParams,
  ): Promise<ISolanaSignAndSendTransactionResult> {
    return this.rpcClient.request<ISolanaSignAndSendTransactionResult>(
      SOLANA_WIRE_METHODS.signAndSendTransaction,
      params,
    );
  }

  signIn(params?: ISolanaSignInParams): Promise<ISolanaSignInResult> {
    return this.rpcClient.request<ISolanaSignInResult>(
      SOLANA_WIRE_METHODS.signIn,
      params ?? {},
    );
  }
}
