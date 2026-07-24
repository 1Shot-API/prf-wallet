import { useEffect, useRef, useState } from "react";
import type { RecoveryDataCreatedData } from "@1shotapi/ows-types";
import { Modal } from "../Modal";
import { useWallet } from "../../wallet/WalletProvider";

const DEFAULT_MIN_PASSWORD_LENGTH = 12;

function formatBackupError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes("passwordTooShort")) {
      return "Passphrase is too short. Try again.";
    }
    if (
      error.name === "OwsSignDeniedError" ||
      message.includes("signDenied") ||
      message.includes("SignDenied")
    ) {
      return "Backup was cancelled.";
    }
    if (message.includes("NotAllowed") || message.includes("not allowed")) {
      return "Passkey prompt was cancelled or blocked.";
    }
    return message || "Backup failed.";
  }
  return "Backup failed.";
}

export function CreateBackupModal({
  onResolve,
}: {
  onResolve: () => void;
}) {
  const { getSigner, ensureReady, persistBackup } = useWallet();
  const [phase, setPhase] = useState<"prompt" | "result" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecoveryDataCreatedData | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const abortedRef = useRef(false);

  useEffect(() => {
    abortedRef.current = false;

    void (async () => {
      try {
        await ensureReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for backup");
        }

        const created = await signer.createRecoveryData(
          `Passphrase (min ${DEFAULT_MIN_PASSWORD_LENGTH} characters)`,
          "Continue",
          DEFAULT_MIN_PASSWORD_LENGTH,
          {
            explanationHeader: "Confirm backup",
            explanationText:
              "Your device will ask for a passkey to encrypt this backup.",
          },
        );

        if (abortedRef.current) return;

        await persistBackup(created.encryptedPrivateKey);
        if (abortedRef.current) return;

        setResult(created);
        setPhase("result");
      } catch (err) {
        if (abortedRef.current) return;
        setError(formatBackupError(err));
        setPhase("error");
      }
    })();

    return () => {
      abortedRef.current = true;
    };
  }, [ensureReady, getSigner, persistBackup]);

  if (phase === "result" && result) {
    return (
      <Modal
        title="Create backup"
        actions={[
          {
            label: copyLabel,
            variant: "secondary",
            onClick: () => {
              void navigator.clipboard.writeText(result.encryptedPrivateKey).then(
                () => {
                  setCopyLabel("Copied");
                  setTimeout(() => setCopyLabel("Copy"), 1500);
                },
                () => setCopyLabel("Copy failed"),
              );
            },
          },
          {
            label: "Done",
            variant: "primary",
            autoFocus: true,
            onClick: onResolve,
          },
        ]}
      >
        <p className="mb-1 text-[0.8rem] font-medium opacity-75">
          Encrypted backup
        </p>
        <pre className="m-0 max-h-40 overflow-auto break-all whitespace-pre-wrap rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] p-3 font-mono text-[0.8rem]">
          {result.encryptedPrivateKey}
        </pre>
      </Modal>
    );
  }

  return (
    <Modal
      title="Create backup"
      onBackdropDismiss={phase === "error" ? onResolve : undefined}
      actions={
        phase === "error" || phase === "prompt"
          ? [
              {
                label: phase === "error" ? "Close" : "Cancel",
                variant: "secondary",
                autoFocus: phase === "error",
                onClick: onResolve,
              },
            ]
          : undefined
      }
    >
      {phase === "prompt" ? (
        <p className="mb-4">
          Enter a passphrase of at least {DEFAULT_MIN_PASSWORD_LENGTH}{" "}
          characters to encrypt your private key. Store the backup somewhere
          safe; you will need it to restore your wallet.
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-[0.9rem] text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

function formatRestoreError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.includes("decryptionFailed") ||
      message.includes("decrypt") ||
      message.includes("OperationError")
    ) {
      return "Could not decrypt the backup. Check the passphrase and try again.";
    }
    if (
      error.name === "OwsSignDeniedError" ||
      message.includes("signDenied") ||
      message.includes("SignDenied")
    ) {
      return "Restore was cancelled.";
    }
    if (message.includes("NotAllowed") || message.includes("not allowed")) {
      return "Passkey prompt was cancelled or blocked.";
    }
    return message || "Restore failed.";
  }
  return "Restore failed.";
}

export function RestoreBackupModal({
  encryptedPrivateKey,
  onResolve,
}: {
  encryptedPrivateKey: string;
  onResolve: (restored: boolean) => void;
}) {
  const { getSigner, awaitSignerReady } = useWallet();
  const [phase, setPhase] = useState<"prompt" | "done" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);

  useEffect(() => {
    abortedRef.current = false;

    void (async () => {
      try {
        await awaitSignerReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for restore");
        }

        await signer.recoverKey(
          encryptedPrivateKey,
          "Backup passphrase",
          "Restore",
          {
            explanationHeader: "Confirm restore",
            explanationText:
              "Your device may ask for a passkey after you enter the passphrase.",
          },
        );
        if (abortedRef.current) return;
        setPhase("done");
      } catch (err) {
        if (abortedRef.current) return;
        setError(formatRestoreError(err));
        setPhase("error");
      }
    })();

    return () => {
      abortedRef.current = true;
    };
  }, [awaitSignerReady, encryptedPrivateKey, getSigner]);

  return (
    <Modal
      title="Restore backup"
      onBackdropDismiss={
        phase === "error" ? () => onResolve(false) : undefined
      }
      actions={
        phase === "done"
          ? [
              {
                label: "Done",
                variant: "primary",
                autoFocus: true,
                onClick: () => onResolve(true),
              },
            ]
          : [
              {
                label: phase === "error" ? "Close" : "Cancel",
                variant: "secondary",
                autoFocus: phase === "error",
                onClick: () => onResolve(false),
              },
            ]
      }
    >
      {phase === "prompt" ? (
        <p className="mb-4">
          Enter the passphrase you used when creating this backup to unlock your
          wallet.
        </p>
      ) : null}
      {phase === "done" ? (
        <p className="m-0">
          Wallet restored. You can sign until this tab is closed.
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-[0.9rem] text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
