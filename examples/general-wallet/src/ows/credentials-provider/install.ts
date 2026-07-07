import type { BrandingContext, BrandingModule } from "@1shotapi/ows-branding-core";
import {
  CredentialOfferUri,
  CredentialTypeName,
  OwsUserRejectedError,
  PresentationRequestUri,
  UriString,
} from "@1shotapi/ows-types";
import type {
  CredentialPresentationApprovalRequest,
  CredentialStore,
  Oid4vciClient,
  Oid4vpClient,
  CredentialStatusValidator,
} from "@1shotapi/ows-credentials";
import {
  MockOid4vciClient,
  MockOid4vpClient,
  NoopCredentialStatusValidator,
} from "@1shotapi/ows-credentials";

export type CredentialsProviderModuleOptions = {
  store: CredentialStore;
  oid4vci?: Oid4vciClient;
  oid4vp?: Oid4vpClient;
  status?: CredentialStatusValidator;
};

export function createCredentialsProviderModule(
  options: CredentialsProviderModuleOptions,
): BrandingModule {
  const oid4vci = options.oid4vci ?? new MockOid4vciClient();
  const oid4vp = options.oid4vp ?? new MockOid4vpClient();
  const status = options.status ?? new NoopCredentialStatusValidator();

  return {
    name: "credentials-provider",
    phase: "pre-start",
    install(ctx: BrandingContext): void {
      const requestPresentationApproval = async (
        request: CredentialPresentationApprovalRequest,
      ): Promise<boolean> => {
        if (ctx.ui?.requestCredentialPresentationApproval) {
          return ctx.ui.requestCredentialPresentationApproval(request);
        }
        return true;
      };

      ctx.wallet.credentials.register({
        acceptOffer: async (input) => {
          await ctx.ensureReady?.();

          const display = await ctx.wallet.requestDisplay({
            width: 400,
            height: 420,
          });
          try {
            const uri = input.credentialOfferUri;
            const offer =
              input.offer ??
              (uri ? await oid4vci.resolveOffer(UriString(uri)) : undefined);
            if (!offer) {
              throw new Error("credentialOfferUri or offer is required");
            }

            const metadata = await oid4vci.fetchIssuerMetadata(
              offer.credentialIssuer,
            );
            const stored = await oid4vci.requestCredential(offer, metadata);
            await status.checkStatus(stored);
            await options.store.save(stored);

            return {
              credentialId: stored.credentialId,
              format: stored.format,
              type: stored.type,
            };
          } finally {
            display.hide();
          }
        },

        present: async (input) => {
          await ctx.ensureReady?.();

          const uri = input.requestUri;
          const definition =
            input.request ??
            (uri ? await oid4vp.resolveRequest(UriString(uri)) : undefined);
          if (!definition) {
            throw new Error("requestUri or request is required");
          }

          const summaries = await options.store.list();
          const matches = await oid4vp.matchCredentials(definition, summaries);
          if (matches.length === 0) {
            throw new Error("No matching credentials in wallet");
          }

          const match = matches[0]!;
          const display = await ctx.wallet.requestDisplay({
            width: 420,
            height: 480,
          });
          try {
            const approved = await requestPresentationApproval({
              verifierName: definition.verifier.name,
              verifierId: definition.verifier.id,
              requestedClaims: definition.requestedClaims,
              credentialType:
                match.type.find((t) => t !== CredentialTypeName("VerifiableCredential")) ??
                match.type[0] ??
                CredentialTypeName("Credential"),
              credentialIssuer: match.issuer,
            });
            if (!approved) {
              throw new OwsUserRejectedError("User rejected credential presentation");
            }

            const credential = await options.store.get(match.credentialId);
            if (!credential) {
              throw new Error("Credential not found");
            }

            return oid4vp.buildPresentation(credential, definition);
          } finally {
            display.hide();
          }
        },

        list: async (filter) => options.store.list(filter),

        delete: async (input) => options.store.delete(input.credentialId),
      });
    },
  };
}

/** Convenience for demos — uses mock URI constants. */
export const DEMO_CREDENTIAL_OFFER_URI = CredentialOfferUri("mock://kyc-offer/demo");
export const DEMO_PRESENTATION_REQUEST_URI = PresentationRequestUri(
  "mock://kyc-presentation/demo",
);
