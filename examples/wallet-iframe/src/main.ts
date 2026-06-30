import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet } from "@1shotapi/ows-wallet-utils";

async function main(): Promise<void> {
  const signerUrl = new URL("/signer/", window.location.origin).href;

  const signer = await OWSSigner.create(
    document.getElementById("signer-container")!,
    signerUrl,
    { hidden: true },
  );

  const wallet = await OWSWallet.create();

  console.info("[ows-example-wallet] ready", { signer, wallet });
}

main().catch((error: unknown) => {
  console.error("[ows-example-wallet] failed to start", error);
});
