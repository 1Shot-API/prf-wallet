import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
} from "@1shotapi/ows-types";

/** EIP-191 personal_sign consent payload for branding UI. */
export type PersonalSignApprovalRequest = {
  message: string;
  address: EVMAccountAddress;
};

/** EIP-712 typed data payload (`eth_signTypedData` / `_v3` / `_v4`). */
export type SignTypedDataPayload = {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
};

/** EIP-712 typed-data consent payload for branding UI. */
export type SignTypedDataApprovalRequest = {
  address: EVMAccountAddress;
  typedData: SignTypedDataPayload;
};

/** `eth_sendTransaction` consent payload for branding UI. */
export type SendTransactionApprovalRequest = {
  address: EVMAccountAddress;
  to: EVMAccountAddress | null;
  data: HexString;
  value: HexString;
  chainId: EVMChainId;
};
