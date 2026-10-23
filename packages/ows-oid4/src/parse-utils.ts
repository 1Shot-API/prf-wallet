import {
  CredentialConfigurationId,
  CredentialIssuer,
  CredentialOfferUri,
  type CredentialOffer,
  type CredentialOfferGrants,
} from "@1shotapi/ows-types";

export type ParsedCredentialOfferUri =
  | { kind: "https"; url: string }
  | { kind: "openid-credential-offer"; query: URLSearchParams };

type RawOffer = {
  credential_issuer: string;
  credential_configuration_ids: string[];
  grants?: CredentialOfferGrants;
};

/**
 * Credential offer URI parsing and normalization helpers.
 */
export interface IParseUtils {
  parseCredentialOfferUri(
    uri: CredentialOfferUri | string,
  ): ParsedCredentialOfferUri;
  normalizeCredentialOffer(raw: RawOffer): CredentialOffer;
  offerFromQueryParams(params: URLSearchParams): {
    offer?: CredentialOffer;
    credentialOfferUri?: string;
  };
}

/**
 * Default {@link IParseUtils} for OID4VCI offer URIs and deep links.
 */
export class ParseUtils implements IParseUtils {
  /** Parse `https://…` offer URLs and `openid-credential-offer://` deep links. */
  parseCredentialOfferUri(
    uri: CredentialOfferUri | string,
  ): ParsedCredentialOfferUri {
    const text = String(uri);
    if (text.startsWith("openid-credential-offer://")) {
      const qIndex = text.indexOf("?");
      const query = new URLSearchParams(
        qIndex >= 0 ? text.slice(qIndex + 1) : "",
      );
      return { kind: "openid-credential-offer", query };
    }
    if (text.startsWith("https://") || text.startsWith("http://")) {
      return { kind: "https", url: text };
    }
    throw new Error(`Unsupported credential offer URI scheme: ${text}`);
  }

  normalizeCredentialOffer(raw: RawOffer): CredentialOffer {
    return {
      credentialIssuer: CredentialIssuer(raw.credential_issuer),
      credentialConfigurationIds: raw.credential_configuration_ids.map((id) =>
        CredentialConfigurationId(id),
      ),
      grants: raw.grants,
    };
  }

  offerFromQueryParams(params: URLSearchParams): {
    offer?: CredentialOffer;
    credentialOfferUri?: string;
  } {
    const byValue = params.get("credential_offer");
    if (byValue) {
      const raw = JSON.parse(byValue) as RawOffer;
      return { offer: this.normalizeCredentialOffer(raw) };
    }
    const byUri = params.get("credential_offer_uri");
    if (byUri) {
      return { credentialOfferUri: byUri };
    }
    throw new Error(
      "openid-credential-offer URI requires credential_offer or credential_offer_uri",
    );
  }
}
