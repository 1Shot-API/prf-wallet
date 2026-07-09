import type { BrandingContext, BrandingModule } from "@1shotapi/ows-branding-core";
import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
} from "@1shotapi/ows-types";
import {
  requestCredentialOfferApproval,
  requestCredentialPresentationApproval,
} from "./dialog";

export type CredentialConsentModuleOptions = {
  container?: HTMLElement;
};

export function createCredentialConsentModule(
  options?: CredentialConsentModuleOptions,
): BrandingModule {
  return {
    name: "credential-consent",
    phase: "pre-start",
    install(ctx: BrandingContext): void {
      if (!ctx.ui) {
        ctx.ui = {};
      }

      ctx.ui.requestCredentialPresentationApproval ??=
        (request: CredentialPresentationApprovalRequest) =>
          requestCredentialPresentationApproval(request, {
            container: options?.container,
          });

      ctx.ui.requestCredentialOfferApproval ??=
        (request: CredentialOfferApprovalRequest) =>
          requestCredentialOfferApproval(request, {
            container: options?.container,
          });
    },
  };
}

export const credentialConsentModule = createCredentialConsentModule();
