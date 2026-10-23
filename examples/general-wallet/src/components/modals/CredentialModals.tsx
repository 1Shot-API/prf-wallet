import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
  CredentialSummary,
} from "@1shotapi/ows-types";
import { Modal } from "../Modal";

export function CredentialOfferModal({
  request,
  onResolve,
}: {
  request: CredentialOfferApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  return (
    <Modal
      title="Accept credential offer?"
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: "Reject",
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: "Accept",
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="mb-3">
        {request.issuerName} ({request.issuerId}) wants to issue a credential to
        your wallet.
      </p>
      <p className="mb-1 font-semibold">Offered credentials:</p>
      <ul className="mb-3 list-disc pl-5">
        {request.offeredCredentials.map((credential) => {
          const scope = credential.scope ? ` — ${credential.scope}` : "";
          return (
            <li key={credential.configurationId}>
              {credential.configurationId} ({credential.format})
              {scope}
            </li>
          );
        })}
      </ul>
      <p className="m-0 text-[0.9rem] opacity-85">
        You may be asked to verify with your passkey after you continue.
      </p>
    </Modal>
  );
}

export function CredentialPresentationModal({
  request,
  onResolve,
}: {
  request: CredentialPresentationApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  return (
    <Modal
      title="Share credential?"
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: "Reject",
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: "Share",
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="mb-2">
        {request.verifierName} ({request.verifierId}) is requesting proof.
      </p>
      <p className="mb-3">
        Credential: {request.credentialType} from {request.credentialIssuer}
      </p>
      <p className="mb-1 font-semibold">Claims to disclose:</p>
      <ul className="mb-3 list-disc pl-5">
        {request.requestedClaims.map((claim) => (
          <li key={claim}>{claim}</li>
        ))}
      </ul>
      <p className="m-0 text-[0.9rem] opacity-85">
        You may be asked to verify with your passkey after you continue.
      </p>
    </Modal>
  );
}

export function CredentialListModal({
  credentials,
  onResolve,
}: {
  credentials: CredentialSummary[];
  onResolve: () => void;
}) {
  return (
    <Modal
      title="My credentials"
      wide
      onBackdropDismiss={onResolve}
      actions={[
        {
          label: "Close",
          variant: "primary",
          autoFocus: true,
          onClick: onResolve,
        },
      ]}
    >
      {credentials.length === 0 ? (
        <p className="m-0 opacity-85">
          No credentials stored in this wallet yet.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {credentials.map((credential) => (
            <li
              key={credential.credentialId}
              className="rounded-md border border-[color-mix(in_srgb,CanvasText_15%,transparent)] bg-[color-mix(in_srgb,CanvasText_4%,transparent)] p-3"
            >
              <p className="mb-1 font-semibold">
                {credential.type.join(", ")}
              </p>
              <p className="mb-1 text-[0.85rem]">Issuer: {credential.issuer}</p>
              <p className="m-0 font-mono text-xs opacity-85">
                {credential.validUntil
                  ? `Issued ${credential.issuedAt} · Valid until ${credential.validUntil}`
                  : `Issued ${credential.issuedAt}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
