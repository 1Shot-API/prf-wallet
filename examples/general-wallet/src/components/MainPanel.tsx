import { useWallet } from "../wallet/WalletProvider";

export function MainPanel() {
  const {
    unlocked,
    walletCreated,
    evmAddress,
    solanaAddress,
    chainId,
    chains,
    credentialCount,
    switchChain,
    openCreateBackup,
    openRestoreBackup,
    openCredentialList,
  } = useWallet();

  const status = unlocked
    ? "Unlocked"
    : walletCreated
      ? "Created (locked)"
      : "Not created";

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">OWS Example General Wallet</h1>
      <p className="mb-4 text-[0.9rem] opacity-75">
        Branding Layer — general-purpose wallet with nested Signing Layer.
      </p>

      <section className="grid max-w-xl gap-2" aria-label="Wallet status">
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">Status</span>
          <span className="font-mono text-[0.85rem] break-all">{status}</span>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">EVM</span>
          <span className="font-mono text-[0.85rem] break-all">{evmAddress}</span>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">Solana</span>
          <span className="font-mono text-[0.85rem] break-all">
            {solanaAddress}
          </span>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <label className="font-medium" htmlFor="chain-select">
            Chain
          </label>
          <select
            id="chain-select"
            aria-label="Active chain"
            className="max-w-64 rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] bg-[Canvas] px-2 py-1.5 text-[0.9rem] text-inherit"
            value={chainId}
            onChange={(event) => {
              void switchChain(event.target.value);
            }}
          >
            {chains.map((chain) => (
              <option key={chain.chainId} value={chain.chainId}>
                {chain.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[7rem_1fr] items-baseline gap-2">
          <span className="font-medium">Credentials</span>
          <span className="font-mono text-[0.85rem]">{credentialCount}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {unlocked ? (
            <button
              type="button"
              className="cursor-pointer rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] bg-transparent px-3.5 py-2 text-[0.9rem]"
              onClick={() => {
                void openCreateBackup().catch((error: unknown) => {
                  console.error("[create-backup] failed", error);
                });
              }}
            >
              Create backup
            </button>
          ) : null}
          {!unlocked ? (
            <button
              type="button"
              className="cursor-pointer rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] bg-transparent px-3.5 py-2 text-[0.9rem]"
              onClick={() => {
                void openRestoreBackup().catch((error: unknown) => {
                  console.error("[recover-backup] failed", error);
                });
              }}
            >
              Restore backup
            </button>
          ) : null}
          <button
            type="button"
            className="cursor-pointer rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] bg-transparent px-3.5 py-2 text-[0.9rem]"
            onClick={() => {
              void openCredentialList().catch((error: unknown) => {
                console.error(
                  "[ows-example-general-wallet] list credentials failed",
                  error,
                );
              });
            }}
          >
            My credentials
          </button>
        </div>
      </section>
    </>
  );
}
