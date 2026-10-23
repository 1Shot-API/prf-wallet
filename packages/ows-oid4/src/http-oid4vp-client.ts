import {
  CredentialClaimName,
  CredentialTypeName,
  UriString,
  PresentationUtils,
  type CredentialSummary,
  type IOid4vpClient,
  type Oid4vpAuthorizationRequest,
  type OwsDcqlQuery,
  type PresentationBuildContext,
  type PresentationDefinition,
  type PresentationRequestUri,
  type PresentationResult,
  type StoredCredential,
} from "@1shotapi/ows-types";
import { mapDcqlToPresentationFields } from "./dcql-mapper.js";
import { type IFetchUtils } from "./fetch-json.js";
import { encryptPresentationResponse } from "./jwe.js";

type RawAuthRequest = {
  client_id?: string;
  nonce?: string;
  response_uri?: string;
  response_mode?: string;
  client_metadata?: Oid4vpAuthorizationRequest["clientMetadata"];
  dcql_query?: OwsDcqlQuery;
  presentation_definition?: {
    id?: string;
    requested_claims?: string[];
    credential_types?: string[];
    nonce?: string;
    audience?: string;
    verifier?: { id: string; name: string };
  };
};

/**
 * HTTP OID4VP client: request_uri → DCQL/PD map → SD-JWT presentation → optional encrypt/POST.
 */
export class HttpOid4vpClient implements IOid4vpClient {
  private readonly byDefinitionId = new Map<string, Oid4vpAuthorizationRequest>();

  constructor(protected readonly fetchUtils: IFetchUtils) {}

  async resolveRequest(
    uri: PresentationRequestUri,
  ): Promise<PresentationDefinition> {
    const url = String(uri);
    const raw = await this.fetchUtils.fetchJson<RawAuthRequest>(url);
    const auth = this.normalizeAuthRequest(raw, url);
    this.byDefinitionId.set(auth.presentationDefinition.id, auth);
    return auth.presentationDefinition;
  }

  getAuthorizationRequest(
    definitionId: string,
  ): Oid4vpAuthorizationRequest | undefined {
    return this.byDefinitionId.get(definitionId);
  }

  async matchCredentials(
    definition: PresentationDefinition,
    credentials: CredentialSummary[],
  ): Promise<CredentialSummary[]> {
    const types = definition.credentialTypes ?? [];
    return credentials.filter((c) => {
      if (types.length === 0) return true;
      return types.some((t) => c.type.includes(t));
    });
  }

  async buildPresentation(
    credential: StoredCredential,
    definition: PresentationDefinition,
    context?: PresentationBuildContext,
  ): Promise<PresentationResult> {
    if (!context?.holderSigner) {
      throw new Error("HttpOid4vpClient: holderSigner is required");
    }
    if (credential.format !== "sd-jwt-vc") {
      throw new Error(
        `HttpOid4vpClient: unsupported format ${credential.format}`,
      );
    }

    const auth =
      context.authorizationRequest ??
      this.byDefinitionId.get(definition.id);

    if (
      auth?.clientMetadata?.require_wallet_attestation &&
      context.attestationProvider
    ) {
      await context.attestationProvider.createAttestation({
        audience: auth.clientId,
        nonce: definition.nonce ?? auth.nonce,
      });
    }

    const built = await PresentationUtils.build({
      credential,
      definition,
      holderSigner: context.holderSigner,
    });

    let encryptedResponse: string | undefined;
    const responseMode = auth?.responseMode;
    const presentation = built.presentation;

    if (responseMode === "direct_post.jwt") {
      const jwk = auth?.clientMetadata?.jwks?.keys?.[0];
      if (!jwk) {
        throw new Error(
          "HttpOid4vpClient: direct_post.jwt requires client_metadata.jwks",
        );
      }
      encryptedResponse = await encryptPresentationResponse(
        String(presentation),
        jwk,
        {
          alg: auth.clientMetadata?.authorization_encrypted_response_alg,
          enc: auth.clientMetadata?.authorization_encrypted_response_enc,
        },
      );
    }

    let submittedToResponseUri = false;
    if (auth?.responseUri) {
      const body = new URLSearchParams();
      if (encryptedResponse) {
        body.set("response", encryptedResponse);
      } else {
        body.set("vp_token", String(presentation));
      }
      body.set(
        "presentation_submission",
        JSON.stringify({
          id: definition.id,
          definition_id: definition.id,
          descriptor_map: [],
        }),
      );

      const res = await this.fetchUtils.fetch(String(auth.responseUri), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `HttpOid4vpClient: response_uri POST failed (${res.status}): ${text.slice(0, 200)}`,
        );
      }
      submittedToResponseUri = true;
    }

    return {
      presentation,
      format: credential.format,
      disclosedClaims: built.disclosedClaims,
      encryptedResponse,
      responseMode,
      submittedToResponseUri,
    };
  }

  private normalizeAuthRequest(
    raw: RawAuthRequest,
    requestUrl: string,
  ): Oid4vpAuthorizationRequest {
    const clientId = raw.client_id ?? new URL(requestUrl).origin;
    let presentationDefinition: PresentationDefinition;

    if (raw.dcql_query) {
      const mapped = mapDcqlToPresentationFields(raw.dcql_query);
      let verifierName = "Verifier";
      try {
        verifierName =
          raw.client_metadata?.client_name ?? new URL(clientId).hostname;
      } catch {
        verifierName = raw.client_metadata?.client_name ?? clientId;
      }
      presentationDefinition = {
        id: raw.dcql_query.credentials[0]?.id ?? "dcql-request",
        verifier: {
          id: UriString(clientId),
          name: verifierName,
        },
        requestedClaims: mapped.requestedClaims,
        credentialTypes: mapped.credentialTypes,
        nonce: raw.nonce,
        audience: clientId,
      };
    } else if (raw.presentation_definition) {
      const pd = raw.presentation_definition;
      presentationDefinition = {
        id: pd.id ?? "presentation-request",
        verifier: pd.verifier
          ? {
              id: UriString(pd.verifier.id),
              name: pd.verifier.name,
            }
          : {
              id: UriString(clientId),
              name: raw.client_metadata?.client_name ?? "Verifier",
            },
        requestedClaims: (pd.requested_claims ?? []).map((c) =>
          CredentialClaimName(c),
        ),
        credentialTypes: (pd.credential_types ?? []).map((t) =>
          CredentialTypeName(t),
        ),
        nonce: pd.nonce ?? raw.nonce,
        audience: pd.audience ?? clientId,
      };
    } else {
      throw new Error(
        "OID4VP request must include dcql_query or presentation_definition",
      );
    }

    const mode = raw.response_mode;
    const responseMode =
      mode === "direct_post" ||
      mode === "direct_post.jwt" ||
      mode === "fragment"
        ? mode
        : undefined;

    return {
      clientId,
      nonce: raw.nonce ?? presentationDefinition.nonce,
      responseUri: raw.response_uri
        ? UriString(raw.response_uri)
        : undefined,
      responseMode,
      clientMetadata: raw.client_metadata,
      dcqlQuery: raw.dcql_query,
      presentationDefinition,
    };
  }
}
