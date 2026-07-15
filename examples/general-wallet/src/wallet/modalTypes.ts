import type {
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
  CredentialSummary,
  RecoveryDataCreatedData,
} from "@1shotapi/ows-types";

export type WalletSetupChoice = "login" | "create" | "cancel";

export type ModalRequest =
  | {
      id: string;
      kind: "walletSetup";
      resolve: (choice: WalletSetupChoice) => void;
    }
  | {
      id: string;
      kind: "passkeyName";
      resolve: (name: string | null) => void;
    }
  | {
      id: string;
      kind: "connect";
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "personalSign";
      request: PersonalSignApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "typedData";
      request: SignTypedDataApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "credentialOffer";
      request: CredentialOfferApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "credentialPresentation";
      request: CredentialPresentationApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "credentialList";
      credentials: CredentialSummary[];
      resolve: () => void;
    }
  | {
      id: string;
      kind: "createBackup";
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "restoreBackup";
      encryptedPrivateKey: string;
      resolve: (restored: boolean) => void;
      reject: (error: unknown) => void;
    };

export type ActiveModal = ModalRequest;

let modalId = 0;

export function nextModalId(): string {
  modalId += 1;
  return `modal-${modalId}`;
}

export type CreateBackupResult = RecoveryDataCreatedData;
