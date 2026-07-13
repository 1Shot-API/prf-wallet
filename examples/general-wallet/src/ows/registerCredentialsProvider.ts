import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  CredentialFormatId,
  CredentialOfferUri,
  CredentialTypeName,
  HexString,
  OwsUserRejectedError,
  PresentationRequestUri,
  NoopCredentialStatusValidator,
  type CredentialOffer,
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
  type CredentialStore,
  type IssuerMetadata,
  type Oid4vciClient,
  type Oid4vpClient,
  type CredentialStatusValidator,
  type HolderSigner,
} from "@1shotapi/ows-types";
import { createOwsEd25519HolderSigner } from "@1shotapi/ows-wallet-utils";

export type RegisterCredentialsProviderOptions = {
  store: CredentialStore;
  oid4vci: Oid4vciClient;
  oid4vp: Oid4vpClient;
  status?: CredentialStatusValidator;
  holderSigner?: HolderSigner | (() => Promise<HolderSigner>);
  ensureReady?: () => Promise<void>;
  requestCredentialOfferApproval?: (
    request: CredentialOfferApprovalRequest,
  ) => Promise<boolean>;
  requestCredentialPresentationApproval?: (
    request: CredentialPresentationApprovalRequest,
  ) => Promise<boolean>;
};

/**
 * Register wallet.credentials handlers (call before `wallet.start()`).
 */
export function registerCredentialsProvider(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterCredentialsProviderOptions,
): void {
  const { oid4vci, oid4vp } = options;
  const status = options.status ?? new NoopCredentialStatusValidator();

  const resolveHolderSigner = async (): Promise<HolderSigner> => {
    if (options.holderSigner) {
      return typeof options.holderSigner === "function"
        ? options.holderSigner()
        : options.holderSigner;
    }

    return createOwsEd25519HolderSigner({
      getEd25519PublicKeyHex: async () => {
        const cached = signer.getLastPublicKeyData?.();
        if (cached?.ed25519PublicKey) {
          return cached.ed25519PublicKey;
        }
        const keys = await signer.getPublicKey({
          credentialId: signer.getCredentialId(),
        });
        return keys.ed25519PublicKey;
      },
      signDigest: async (digest, scheme) => {
        const result = await signer.signDigest(digest, scheme ?? "ed25519");
        return { signature: HexString(result.signature) };
      },
    });
  };

  const requestOfferApproval = async (
    request: CredentialOfferApprovalRequest,
  ): Promise<boolean> => {
    if (options.requestCredentialOfferApproval) {
      return options.requestCredentialOfferApproval(request);
    }
    return true;
  };

  const requestPresentationApproval = async (
    request: CredentialPresentationApprovalRequest,
  ): Promise<boolean> => {
    if (options.requestCredentialPresentationApproval) {
      return options.requestCredentialPresentationApproval(request);
    }
    return true;
  };

  wallet.credentials.register({
    acceptOffer: async (input) => {
      const uri = input.credentialOfferUri;
      const offer =
        input.offer ?? (uri ? await oid4vci.resolveOffer(uri) : undefined);
      if (!offer) {
        throw new Error("credentialOfferUri or offer is required");
      }

      const metadata = await oid4vci.fetchIssuerMetadata(offer.credentialIssuer);

      const display = await wallet.requestDisplay({
        width: 400,
        height: 460,
      });
      try {
        const approved = await requestOfferApproval(
          buildOfferApprovalRequest(offer, metadata),
        );
        if (!approved) {
          throw new OwsUserRejectedError("User rejected credential offer");
        }

        await options.ensureReady?.();

        const holderSigner = await resolveHolderSigner();
        const stored = await oid4vci.requestCredential(offer, metadata, {
          holderPublicKeyJwk: await holderSigner.publicKeyJwk(),
        });
        await status.checkStatus(stored);
        await options.store.save(stored);

        return {
          credentialId: stored.credentialId,
          format: stored.format,
          type: stored.type,
        };
      } finally {
        await display.hide();
      }
    },

    present: async (input) => {
      const uri = input.requestUri;
      const definition =
        input.request ?? (uri ? await oid4vp.resolveRequest(uri) : undefined);
      if (!definition) {
        throw new Error("requestUri or request is required");
      }

      const summaries = await options.store.list();
      const matches = await oid4vp.matchCredentials(definition, summaries);
      if (matches.length === 0) {
        throw new Error("No matching credentials in wallet");
      }

      const match = matches[0]!;
      const display = await wallet.requestDisplay({
        width: 420,
        height: 500,
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

        await options.ensureReady?.();

        const credential = await options.store.get(match.credentialId);
        if (!credential) {
          throw new Error("Credential not found");
        }

        const holderSigner = await resolveHolderSigner();
        return oid4vp.buildPresentation(credential, definition, {
          holderSigner,
        });
      } finally {
        await display.hide();
      }
    },

    list: async (filter) => options.store.list(filter),

    delete: async (input) => options.store.delete(input.credentialId),
  });
}

function buildOfferApprovalRequest(
  offer: CredentialOffer,
  metadata: IssuerMetadata,
): CredentialOfferApprovalRequest {
  return {
    issuerName: formatIssuerName(offer.credentialIssuer),
    issuerId: offer.credentialIssuer,
    offeredCredentials: offer.credentialConfigurationIds.map((configurationId) => {
      const config = metadata.credentialConfigurationsSupported[configurationId];
      return {
        configurationId,
        format: config?.format ?? CredentialFormatId("sd-jwt-vc"),
        scope: config?.scope,
      };
    }),
  };
}

function formatIssuerName(issuer: CredentialOffer["credentialIssuer"]): string {
  try {
    return new URL(issuer).hostname;
  } catch {
    return issuer;
  }
}

export const DEMO_CREDENTIAL_OFFER_URI = CredentialOfferUri("mock://kyc-offer/demo");
export const DEMO_PRESENTATION_REQUEST_URI = PresentationRequestUri(
  "mock://kyc-presentation/demo",
);
