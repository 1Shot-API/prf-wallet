import {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialIssuer,
  CredentialScope,
  UriString,
  type CredentialIssuanceContext,
  type CredentialOffer,
  type CredentialOfferUri,
  type CredentialRequestPreparation,
  type IOid4vciClient,
  type IssuerMetadata,
  type StoredCredential,
} from "@1shotapi/ows-types";
import { type IFetchUtils } from "./fetch-json.js";
import { type IParseUtils } from "./parse-utils.js";
import { storedCredentialFromSdJwtVc } from "./sd-jwt-stored.js";

type WellKnownIssuer = {
  credential_issuer: string;
  credential_endpoint: string;
  token_endpoint?: string;
  authorization_servers?: string[];
  jwks_uri?: string;
  credential_configurations_supported?: Record<
    string,
    {
      format: string;
      scope?: string;
      proof_types_supported?: Record<string, unknown>;
    }
  >;
};

type TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  c_nonce?: string;
  c_nonce_expires_in?: number;
};

type CredentialResponse = {
  credential?: string;
  credentials?: Array<string | { credential: string }>;
  c_nonce?: string;
};

type Session = {
  accessToken: string;
  cNonce?: string;
};

/**
 * HTTP OID4VCI client: offer URI → well-known → pre-authorized token → credential.
 */
export class HttpOid4vciClient implements IOid4vciClient {
  private session: Session | undefined;

  constructor(
    protected readonly fetchUtils: IFetchUtils,
    protected readonly parseUtils: IParseUtils,
  ) {}

  async resolveOffer(uri: CredentialOfferUri): Promise<CredentialOffer> {
    const parsed = this.parseUtils.parseCredentialOfferUri(uri);
    if (parsed.kind === "https") {
      const raw = await this.fetchUtils.fetchJson<{
        credential_issuer: string;
        credential_configuration_ids: string[];
        grants?: CredentialOffer["grants"];
      }>(parsed.url);
      return this.parseUtils.normalizeCredentialOffer(raw);
    }

    const fromQuery = this.parseUtils.offerFromQueryParams(parsed.query);
    if (fromQuery.offer) {
      return fromQuery.offer;
    }
    if (fromQuery.credentialOfferUri) {
      const raw = await this.fetchUtils.fetchJson<{
        credential_issuer: string;
        credential_configuration_ids: string[];
        grants?: CredentialOffer["grants"];
      }>(fromQuery.credentialOfferUri);
      return this.parseUtils.normalizeCredentialOffer(raw);
    }
    throw new Error("resolveOffer: empty offer");
  }

  async fetchIssuerMetadata(issuer: CredentialIssuer): Promise<IssuerMetadata> {
    const base = String(issuer).replace(/\/$/, "");
    const wellKnown = await this.fetchUtils.fetchJson<WellKnownIssuer>(
      `${base}/.well-known/openid-credential-issuer`,
    );

    const configs: IssuerMetadata["credentialConfigurationsSupported"] = {};
    for (const [id, cfg] of Object.entries(
      wellKnown.credential_configurations_supported ?? {},
    )) {
      configs[CredentialConfigurationId(id)] = {
        format: CredentialFormatId(cfg.format),
        scope: cfg.scope ? CredentialScope(cfg.scope) : undefined,
      };
    }

    let tokenEndpoint = wellKnown.token_endpoint;
    if (!tokenEndpoint && wellKnown.authorization_servers?.[0]) {
      const asBase = wellKnown.authorization_servers[0].replace(/\/$/, "");
      const asMeta = await this.fetchUtils
        .fetchJson<{ token_endpoint?: string }>(
          `${asBase}/.well-known/oauth-authorization-server`,
        )
        .catch(() => undefined);
      tokenEndpoint = asMeta?.token_endpoint ?? `${asBase}/token`;
    }

    const proofTypes: string[] = [];
    for (const cfg of Object.values(
      wellKnown.credential_configurations_supported ?? {},
    )) {
      if (cfg.proof_types_supported) {
        proofTypes.push(...Object.keys(cfg.proof_types_supported));
      }
    }

    return {
      credentialIssuer: CredentialIssuer(wellKnown.credential_issuer),
      credentialConfigurationsSupported: configs,
      credentialEndpoint: UriString(wellKnown.credential_endpoint),
      tokenEndpoint: tokenEndpoint
        ? UriString(tokenEndpoint)
        : UriString(`${base}/token`),
      jwksUri: wellKnown.jwks_uri
        ? UriString(wellKnown.jwks_uri)
        : undefined,
      proofTypesSupported: proofTypes.length > 0 ? proofTypes : ["jwt"],
    };
  }

  async prepareCredentialRequest(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
  ): Promise<CredentialRequestPreparation> {
    const grant =
      offer.grants?.["urn:ietf:params:oauth:grant-type:pre-authorized_code"];
    if (!grant?.["pre-authorized_code"]) {
      throw new Error(
        "HttpOid4vciClient: pre-authorized_code grant is required",
      );
    }
    if (!metadata.tokenEndpoint) {
      throw new Error("HttpOid4vciClient: tokenEndpoint missing from metadata");
    }

    const token = await this.fetchUtils.fetchFormJson<TokenResponse>(
      String(metadata.tokenEndpoint),
      {
        grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code",
        "pre-authorized_code": grant["pre-authorized_code"],
      },
    );

    this.session = {
      accessToken: token.access_token,
      cNonce: token.c_nonce,
    };

    return {
      accessToken: token.access_token,
      cNonce: token.c_nonce,
      cNonceExpiresIn: token.c_nonce_expires_in,
    };
  }

  async requestCredential(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
    context?: CredentialIssuanceContext,
  ): Promise<StoredCredential> {
    if (!context?.proof || !context.holderPublicKeyJwk) {
      throw new Error(
        "HttpOid4vciClient: CredentialIssuanceContext with proof is required",
      );
    }
    if (!metadata.credentialEndpoint) {
      throw new Error(
        "HttpOid4vciClient: credentialEndpoint missing from metadata",
      );
    }
    if (!this.session?.accessToken) {
      await this.prepareCredentialRequest(offer, metadata);
    }
    const accessToken = this.session?.accessToken;
    if (!accessToken) {
      throw new Error("HttpOid4vciClient: missing access token");
    }

    const configurationId = offer.credentialConfigurationIds[0];
    if (!configurationId) {
      throw new Error("HttpOid4vciClient: offer has no configuration ids");
    }

    const body: Record<string, unknown> = {
      format:
        metadata.credentialConfigurationsSupported[configurationId]?.format ??
        "vc+sd-jwt",
      credential_configuration_id: configurationId,
      proof: context.proof,
    };
    if (context.walletAttestationJwt) {
      body.wallet_attestation = context.walletAttestationJwt;
    }

    const response = await this.fetchUtils.fetchJson<CredentialResponse>(
      String(metadata.credentialEndpoint),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (response.c_nonce) {
      this.session = {
        accessToken,
        cNonce: response.c_nonce,
      };
    }

    const sdJwt = this.extractCredentialString(response);
    return await storedCredentialFromSdJwtVc({
      sdJwt,
      fallbackIssuer: offer.credentialIssuer,
    });
  }

  protected extractCredentialString(response: CredentialResponse): string {
    if (typeof response.credential === "string") {
      return response.credential;
    }
    const first = response.credentials?.[0];
    if (typeof first === "string") {
      return first;
    }
    if (first && typeof first === "object" && typeof first.credential === "string") {
      return first.credential;
    }
    throw new Error("HttpOid4vciClient: credential response missing credential");
  }
}
