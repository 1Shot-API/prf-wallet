import { useState } from "react";
import { Modal } from "../Modal";
import type { WalletSetupChoice } from "../../wallet/modalTypes";

export function WalletSetupModal({
  onResolve,
}: {
  onResolve: (choice: WalletSetupChoice) => void;
}) {
  return (
    <Modal
      title="Set up your wallet"
      onBackdropDismiss={() => onResolve("cancel")}
      actions={[
        {
          label: "Cancel",
          variant: "secondary",
          onClick: () => onResolve("cancel"),
        },
        {
          label: "Login with passkey",
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve("login"),
        },
        {
          label: "Create account",
          variant: "primary",
          onClick: () => onResolve("create"),
        },
      ]}
    >
      <p className="m-0">
        This wallet uses a passkey to secure your keys on this device. Log in
        with an existing passkey or create a new account before continuing.
      </p>
    </Modal>
  );
}

export function PasskeyNameModal({
  onResolve,
}: {
  onResolve: (name: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name for your passkey.");
      return;
    }
    onResolve(trimmed);
  };

  return (
    <Modal
      title="Name your passkey"
      onBackdropDismiss={() => onResolve(null)}
      actions={[
        {
          label: "Cancel",
          variant: "secondary",
          onClick: () => onResolve(null),
        },
        {
          label: "Continue",
          variant: "primary",
          onClick: submit,
        },
      ]}
    >
      <p className="mb-3">
        Choose a name for this wallet passkey. Your device will use it when you
        create the credential and when you sign in later.
      </p>
      <label className="mb-1.5 block text-[0.85rem] font-medium opacity-80" htmlFor="passkey-name">
        Account name
      </label>
      <input
        id="passkey-name"
        data-autofocus=""
        type="text"
        autoComplete="username"
        placeholder="e.g. My wallet"
        maxLength={64}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className="mb-2 box-border w-full rounded-md border border-[color-mix(in_srgb,CanvasText_25%,transparent)] bg-[Canvas] px-2.5 py-2 text-inherit"
      />
      {error ? <p className="m-0 text-[0.85rem] text-red-700">{error}</p> : null}
    </Modal>
  );
}

export function ConnectModal({
  onResolve,
}: {
  onResolve: (approved: boolean) => void;
}) {
  return (
    <Modal
      title="Connect wallet"
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: "Reject",
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: "Continue",
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="m-0">
        The connected app is requesting your wallet address. You may be asked to
        verify with your passkey after you continue.
      </p>
    </Modal>
  );
}
