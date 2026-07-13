import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
} from "@1shotapi/ows-types";
import {
  requestCredentialOfferApproval,
  requestCredentialPresentationApproval,
} from "./dialog";

export type CredentialConsentUiOptions = {
  container?: HTMLElement;
};

export type CredentialConsentUi = {
  requestCredentialOfferApproval: (
    request: CredentialOfferApprovalRequest,
  ) => Promise<boolean>;
  requestCredentialPresentationApproval: (
    request: CredentialPresentationApprovalRequest,
  ) => Promise<boolean>;
};

/** Example-local consent adapters for credential offer / presentation dialogs. */
export function createCredentialConsentUi(
  options?: CredentialConsentUiOptions,
): CredentialConsentUi {
  return {
    requestCredentialOfferApproval: (request) =>
      requestCredentialOfferApproval(request, {
        container: options?.container,
      }),
    requestCredentialPresentationApproval: (request) =>
      requestCredentialPresentationApproval(request, {
        container: options?.container,
      }),
  };
}
