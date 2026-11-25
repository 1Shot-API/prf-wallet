import { useWallet } from "../wallet/WalletProvider";

export function OnboardingPanel() {
  const { loginWithPasskey, createNewWalletFromUi } = useWallet();

  return (
    <div className="py-2">
      <h2 className="mb-3 text-lg font-semibold">Welcome</h2>
      <p className="mb-4 text-[0.95rem] opacity-90">
        Log in with an existing passkey or create a new wallet account to get
        started.
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="cursor-pointer rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] bg-[color-mix(in_srgb,CanvasText_12%,Canvas)] px-4 py-2 font-medium"
          onClick={() => {
            void loginWithPasskey().catch((error: unknown) => {
              console.error("[wallet-setup] embedded login failed", error);
            });
          }}
        >
          Login with passkey
        </button>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] bg-[color-mix(in_srgb,CanvasText_12%,Canvas)] px-4 py-2 font-medium"
          onClick={() => {
            void createNewWalletFromUi().catch((error: unknown) => {
              console.error("[wallet-setup] embedded create failed", error);
            });
          }}
        >
          Create account
        </button>
      </div>
    </div>
  );
}
