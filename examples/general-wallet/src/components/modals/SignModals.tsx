import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import {
  ConversionUtils,
  HexString,
  OwsUserRejectedError,
  type EVMSignatureHex,
} from "@1shotapi/ows-types";
import { useRef, useState } from "react";
import type { TypedDataDefinition } from "viem";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";

function isSignDenied(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "OwsSignDeniedError" ||
    error.message.includes("signDenied") ||
    error.message.includes("SignDenied") ||
    error.message.includes("NotAllowed") ||
    error.message.includes("not allowed")
  );
}

export function PersonalSignModal({
  request,
  onResolve,
  onReject,
}: {
  request: PersonalSignApprovalRequest;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner } = useWallet();
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const abortedRef = useRef(false);

  const cancel = () => {
    abortedRef.current = true;
    onReject(new OwsUserRejectedError("User rejected the signing request"));
  };

  const startSign = () => {
    abortedRef.current = false;
    setPhase("signing");
    void (async () => {
      const signer = getSigner();
      if (!signer) throw new Error("Signer not ready");
      const [signature] = await signer.evm.signMessage([request.message]);
      if (abortedRef.current) return;
      onResolve(signature!);
    })().catch((error: unknown) => {
      if (abortedRef.current) return;
      if (isSignDenied(error)) {
        setPhase("confirm");
        return;
      }
      onReject(error);
    });
  };

  return (
    <Modal
      title="Sign message"
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: "Reject",
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: "Sign",
                variant: "primary",
                autoFocus: true,
                onClick: startSign,
              },
            ]
          : undefined
      }
    >
      <p className="mb-1 text-[0.8rem] font-medium opacity-75">Account</p>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <p className="mb-1 text-[0.8rem] font-medium opacity-75">Message</p>
      <pre className="m-0 max-h-48 max-w-full min-w-0 overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] p-3 font-mono text-[0.85rem]">
        {formatMessageForDisplay(request.message)}
      </pre>
      {phase === "signing" ? (
        <p className="mt-4 m-0 text-[0.9rem] opacity-75">
          Confirm in the signing panel…
        </p>
      ) : null}
    </Modal>
  );
}

export function TypedDataModal({
  request,
  onResolve,
  onReject,
}: {
  request: SignTypedDataApprovalRequest;
  onResolve: (signature: EVMSignatureHex) => void;
  onReject: (error: unknown) => void;
}) {
  const { getSigner } = useWallet();
  const { typedData } = request;
  const [phase, setPhase] = useState<"confirm" | "signing">("confirm");
  const abortedRef = useRef(false);

  const cancel = () => {
    abortedRef.current = true;
    onReject(new OwsUserRejectedError("User rejected the signing request"));
  };

  const startSign = () => {
    abortedRef.current = false;
    setPhase("signing");
    void (async () => {
      const signer = getSigner();
      if (!signer) throw new Error("Signer not ready");
      const [signature] = await signer.evm.signTypedData([
        typedData as unknown as TypedDataDefinition,
      ]);
      if (abortedRef.current) return;
      onResolve(signature!);
    })().catch((error: unknown) => {
      if (abortedRef.current) return;
      if (isSignDenied(error)) {
        setPhase("confirm");
        return;
      }
      onReject(error);
    });
  };

  return (
    <Modal
      title="Sign typed data"
      onBackdropDismiss={phase === "confirm" ? cancel : undefined}
      actions={
        phase === "confirm"
          ? [
              {
                label: "Reject",
                variant: "secondary",
                onClick: cancel,
              },
              {
                label: "Sign",
                variant: "primary",
                autoFocus: true,
                onClick: startSign,
              },
            ]
          : undefined
      }
    >
      <p className="mb-1 text-[0.8rem] font-medium opacity-75">Account</p>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <LabeledBlock label="Primary type" content={typedData.primaryType} />
      <LabeledBlock label="Domain" content={formatJson(typedData.domain)} />
      <LabeledBlock label="Message" content={formatJson(typedData.message)} />
      {phase === "signing" ? (
        <p className="mt-4 m-0 text-[0.9rem] opacity-75">
          Confirm in the signing panel…
        </p>
      ) : null}
    </Modal>
  );
}

export function SendTransactionModal({
  request,
  onResolve,
}: {
  request: SendTransactionApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  return (
    <Modal
      title="Send transaction"
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: "Reject",
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: "Sign",
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="mb-1 text-[0.8rem] font-medium opacity-75">Account</p>
      <p className="mb-3 break-all font-mono text-[0.8rem]">{request.address}</p>
      <LabeledBlock
        label="Contract"
        content={request.to ?? "(contract creation)"}
      />
      <LabeledBlock label="Value" content={request.value} />
      <LabeledBlock label="Data" content={request.data} />
      <LabeledBlock label="Chain" content={request.chainId} />
    </Modal>
  );
}

function LabeledBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="mb-3 min-w-0">
      <p className="mb-1 text-[0.8rem] font-medium opacity-75">{label}</p>
      <pre className="m-0 max-h-48 max-w-full min-w-0 overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] p-3 font-mono text-[0.85rem]">
        {content}
      </pre>
    </div>
  );
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? v.toString() : v,
      2,
    );
  } catch {
    return String(value);
  }
}

function formatMessageForDisplay(message: string): string {
  if (message.startsWith("0x") && message.length > 2) {
    try {
      const bytes = ConversionUtils.hexToBytes(
        HexString(message as `0x${string}`),
      );
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {
      // fall through
    }
  }
  return message;
}

function isMostlyPrintable(text: string): boolean {
  if (!text.trim()) return false;
  let printable = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) printable++;
  }
  return printable / text.length >= 0.85;
}
