import {
  CREDENTIAL_WIRE_METHODS,
  type OpenWalletCredentialProvider,
  type CredentialOfferInput,
  type CredentialReceipt,
  type PresentationRequestInput,
  type PresentationResult,
  type CredentialFilter,
  type CredentialSummary,
} from "@1shotapi/ows-types";
import type { CredentialId } from "@1shotapi/ows-types";
import type { RpcHostClient } from "../rpc/host-client.js";

/** Host-side credentials namespace — routes via namespaced wire keys only. */
export class CredentialHostClient implements OpenWalletCredentialProvider {
  constructor(private readonly rpcClient: RpcHostClient) {}

  acceptOffer(input: CredentialOfferInput): Promise<CredentialReceipt> {
    return this.rpcClient.request<CredentialReceipt>(
      CREDENTIAL_WIRE_METHODS.acceptOffer,
      input,
    );
  }

  present(input: PresentationRequestInput): Promise<PresentationResult> {
    return this.rpcClient.request<PresentationResult>(
      CREDENTIAL_WIRE_METHODS.present,
      input,
    );
  }

  list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    return this.rpcClient.request<CredentialSummary[]>(
      CREDENTIAL_WIRE_METHODS.list,
      filter ?? null,
    );
  }

  delete(input: { credentialId: CredentialId }): Promise<void> {
    return this.rpcClient.request<void>(
      CREDENTIAL_WIRE_METHODS.delete,
      input,
    );
  }
}
