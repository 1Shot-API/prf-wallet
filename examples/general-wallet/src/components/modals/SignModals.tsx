import type {
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import { ConversionUtils, HexString } from "@1shotapi/ows-types";
import { Modal } from "../Modal";

export function PersonalSignModal({
  request,
  onResolve,
}: {
  request: PersonalSignApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  return (
    <Modal
      title="Sign message"
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
      <p className="mb-1 text-[0.8rem] font-medium opacity-75">Message</p>
      <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] p-3 font-mono text-[0.85rem]">
        {formatMessageForDisplay(request.message)}
      </pre>
    </Modal>
  );
}

export function TypedDataModal({
  request,
  onResolve,
}: {
  request: SignTypedDataApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  const { typedData } = request;
  return (
    <Modal
      title="Sign typed data"
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
      <LabeledBlock label="Primary type" content={typedData.primaryType} />
      <LabeledBlock label="Domain" content={formatJson(typedData.domain)} />
      <LabeledBlock label="Message" content={formatJson(typedData.message)} />
    </Modal>
  );
}

function LabeledBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[0.8rem] font-medium opacity-75">{label}</p>
      <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[color-mix(in_srgb,CanvasText_20%,transparent)] p-3 font-mono text-[0.85rem]">
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
      const bytes = ConversionUtils.hexToBytes(HexString(message as `0x${string}`));
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
