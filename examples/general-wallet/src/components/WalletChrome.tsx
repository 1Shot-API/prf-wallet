import { useWallet } from "../wallet/WalletProvider";

export function WalletChrome() {
  const { requestHide } = useWallet();

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-2 border-b border-[color-mix(in_srgb,CanvasText_15%,transparent)] px-3 py-2.5"
      aria-label="Wallet panel"
    >
      <h2 className="m-0 text-[0.9rem] font-semibold">Open Wallet</h2>
      <button
        type="button"
        aria-label="Close wallet"
        onClick={() => {
          void requestHide();
        }}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] bg-transparent text-lg leading-none text-inherit"
      >
        ×
      </button>
    </header>
  );
}
