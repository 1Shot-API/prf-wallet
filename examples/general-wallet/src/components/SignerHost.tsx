import { useWallet } from "../wallet/WalletProvider";

/** Hidden mount point for the Signing Layer iframe. */
export function SignerHost() {
  const { signerContainerRef } = useWallet();
  return <div id="signer-container" ref={signerContainerRef} />;
}
