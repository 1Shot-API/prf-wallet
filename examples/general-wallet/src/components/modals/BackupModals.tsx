import { useEffect, useRef, useState } from "react";
import { overlaySignerIframe } from "@1shotapi/ows-signer-utils";
import type { RecoveryDataCreatedData } from "@1shotapi/ows-types";
import { Modal } from "../Modal";
import { useWallet } from "../../wallet/WalletProvider";

const DEFAULT_MIN_PASSWORD_LENGTH = 12;

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function formatBackupError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes("passwordTooShort")) {
      return "Passphrase is too short. Try again.";
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
  onReject,
}: {
  onResolve: () => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, signerContainerRef, ensureReady, persistBackup } =
    useWallet();
  const signerSlotRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"prompt" | "result" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecoveryDataCreatedData | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const abortedRef = useRef(false);
  const restoreOverlayRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    abortedRef.current = false;
    const home = signerContainerRef.current;
    const slot = signerSlotRef.current;
    if (!home || !slot) {
      onReject(new Error("Signer not ready for backup"));
      return;
    }

    void (async () => {
      try {
        // Unlock is usually a no-op here (create only when unlocked); this still
        // waits for Signing Layer load before getSigner().
        await ensureReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for backup");
        }

        const iframe = home.querySelector("iframe");
        if (!(iframe instanceof HTMLIFrameElement)) {
          throw new Error("Signer iframe not found in signerContainer");
        }

        restoreOverlayRef.current = overlaySignerIframe(iframe, slot, {
          homeContainer: home,
        });
        await waitForPaint();

        const created = await signer.createRecoveryData(
          `Passphrase (min ${DEFAULT_MIN_PASSWORD_LENGTH} characters)`,
          "Continue",
          DEFAULT_MIN_PASSWORD_LENGTH,
        );

        if (abortedRef.current) return;

        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;

        await persistBackup(created.encryptedPrivateKey);
        if (abortedRef.current) return;

        setResult(created);
        setPhase("result");
      } catch (err) {
        if (abortedRef.current) return;
        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;
        setError(formatBackupError(err));
        setPhase("error");
      }
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
      onReject(err);
    });

    return () => {
      abortedRef.current = true;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
    };
  }, [
    ensureReady,
    getSigner,
    onReject,
    persistBackup,
    signerContainerRef,
  ]);

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
      footer={
        phase === "prompt" ? (
          <div
            ref={signerSlotRef}
            className="mb-4 min-h-28 overflow-hidden rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] bg-[color-mix(in_srgb,CanvasText_4%,Canvas)]"
          />
        ) : null
      }
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
          safe — you will need it to restore your wallet.
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
  onReject,
}: {
  encryptedPrivateKey: string;
  onResolve: (restored: boolean) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner, signerContainerRef, awaitSignerReady } = useWallet();
  const signerSlotRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"prompt" | "done" | "error">("prompt");
  const [error, setError] = useState<string | null>(null);
  const abortedRef = useRef(false);
  const restoreOverlayRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    abortedRef.current = false;
    const home = signerContainerRef.current;
    const slot = signerSlotRef.current;
    if (!home || !slot) {
      onReject(new Error("Signer not ready for restore"));
      return;
    }

    void (async () => {
      try {
        // Restore is offered while locked — wait for Signing Layer only.
        // Do not call ensureReady() (that would unlock / run setup first).
        await awaitSignerReady();
        if (abortedRef.current) return;

        const signer = getSigner();
        if (!signer) {
          throw new Error("Signer not ready for restore");
        }

        const iframe = home.querySelector("iframe");
        if (!(iframe instanceof HTMLIFrameElement)) {
          throw new Error("Signer iframe not found in signerContainer");
        }

        restoreOverlayRef.current = overlaySignerIframe(iframe, slot, {
          homeContainer: home,
        });
        await waitForPaint();
        await signer.recoverKey(
          encryptedPrivateKey,
          "Backup passphrase",
          "Restore",
        );
        if (abortedRef.current) return;
        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;
        setPhase("done");
      } catch (err) {
        if (abortedRef.current) return;
        restoreOverlayRef.current?.();
        restoreOverlayRef.current = null;
        setError(formatRestoreError(err));
        setPhase("error");
      }
    })().catch((err: unknown) => {
      if (abortedRef.current) return;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
      onReject(err);
    });

    return () => {
      abortedRef.current = true;
      restoreOverlayRef.current?.();
      restoreOverlayRef.current = null;
    };
  }, [
    awaitSignerReady,
    encryptedPrivateKey,
    getSigner,
    onReject,
    signerContainerRef,
  ]);

  return (
    <Modal
      title="Restore backup"
      onBackdropDismiss={
        phase === "error" ? () => onResolve(false) : undefined
      }
      footer={
        phase === "prompt" ? (
          <div
            ref={signerSlotRef}
            className="mb-4 min-h-28 overflow-hidden rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] bg-[color-mix(in_srgb,CanvasText_4%,Canvas)]"
          />
        ) : null
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
