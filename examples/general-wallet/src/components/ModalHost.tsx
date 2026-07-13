import { useWallet } from "../wallet/WalletProvider";
import {
  ConnectModal,
  PasskeyNameModal,
  WalletSetupModal,
} from "./modals/SetupModals";
import { PersonalSignModal, TypedDataModal } from "./modals/SignModals";
import {
  CredentialListModal,
  CredentialOfferModal,
  CredentialPresentationModal,
} from "./modals/CredentialModals";
import { CreateBackupModal, RestoreBackupModal } from "./modals/BackupModals";

export function ModalHost() {
  const { activeModal } = useWallet();
  if (!activeModal) return null;

  switch (activeModal.kind) {
    case "walletSetup":
      return <WalletSetupModal onResolve={activeModal.resolve} />;
    case "passkeyName":
      return <PasskeyNameModal onResolve={activeModal.resolve} />;
    case "connect":
      return <ConnectModal onResolve={activeModal.resolve} />;
    case "personalSign":
      return (
        <PersonalSignModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
        />
      );
    case "typedData":
      return (
        <TypedDataModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
        />
      );
    case "credentialOffer":
      return (
        <CredentialOfferModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
        />
      );
    case "credentialPresentation":
      return (
        <CredentialPresentationModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
        />
      );
    case "credentialList":
      return (
        <CredentialListModal
          credentials={activeModal.credentials}
          onResolve={activeModal.resolve}
        />
      );
    case "createBackup":
      return (
        <CreateBackupModal
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "restoreBackup":
      return (
        <RestoreBackupModal
          encryptedPrivateKey={activeModal.encryptedPrivateKey}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    default:
      return null;
  }
}
