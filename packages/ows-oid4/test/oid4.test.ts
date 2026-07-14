import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapDcqlToPresentationFields } from "../src/dcql-mapper.js";
import { ParseUtils } from "../src/parse-utils.js";
import {
  encryptPresentationResponse,
} from "../src/jwe.js";
import { CredentialOfferUri } from "@1shotapi/ows-types";

const parseUtils = new ParseUtils();

describe("dcql-mapper", () => {
  it("maps a single credential claim query", () => {
    const result = mapDcqlToPresentationFields({
      credentials: [
        {
          id: "kyc",
          format: "vc+sd-jwt",
          meta: { vct_values: ["KycCredential"] },
          claims: [{ path: ["ageOver18"] }, { path: ["country"] }],
        },
      ],
    });
    assert.equal(result.requestedClaims.length, 2);
    assert.equal(String(result.credentialTypes[0]), "KycCredential");
  });

  it("rejects multi-credential queries", () => {
    assert.throws(() =>
      mapDcqlToPresentationFields({
        credentials: [
          { id: "a", format: "vc+sd-jwt", claims: [{ path: ["x"] }] },
          { id: "b", format: "vc+sd-jwt", claims: [{ path: ["y"] }] },
        ],
      }),
    );
  });
});

describe("ParseUtils", () => {
  it("parses https and openid-credential-offer URIs", () => {
    const https = parseUtils.parseCredentialOfferUri(
      CredentialOfferUri("https://issuer.example/offers/demo"),
    );
    assert.equal(https.kind, "https");

    const deep = parseUtils.parseCredentialOfferUri(
      CredentialOfferUri(
        "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.example%2Foffers%2Fdemo",
      ),
    );
    assert.equal(deep.kind, "openid-credential-offer");
  });

  it("normalizes raw offers", () => {
    const offer = parseUtils.normalizeCredentialOffer({
      credential_issuer: "https://issuer.example",
      credential_configuration_ids: ["KycCredential"],
      grants: {
        "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
          "pre-authorized_code": "code-1",
        },
      },
    });
    assert.equal(String(offer.credentialIssuer), "https://issuer.example");
    assert.ok(
      offer.grants?.["urn:ietf:params:oauth:grant-type:pre-authorized_code"]?.[
        "pre-authorized_code"
      ],
    );
  });
});

describe("jwe", () => {
  it("encrypts a presentation for a verifier public JWK", async () => {
    const { generateKeyPair, exportJWK, compactDecrypt, importJWK } =
      await import("jose");
    const { publicKey, privateKey } = await generateKeyPair("ECDH-ES", {
      crv: "P-256",
      extractable: true,
    });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.alg = "ECDH-ES";
    const privateJwk = await exportJWK(privateKey);
    const jwe = await encryptPresentationResponse("vp-token-payload", publicJwk);
    const { plaintext } = await compactDecrypt(
      jwe,
      await importJWK(privateJwk, "ECDH-ES"),
    );
    assert.equal(new TextDecoder().decode(plaintext), "vp-token-payload");
  });
});

describe("HttpOid4vciClient", () => {
  it("resolves offer, well-known, token prepare with mocked fetch", async () => {
    const { HttpOid4vciClient } = await import("../src/http-oid4vci-client.js");
    const { FetchUtils } = await import("../src/fetch-json.js");
    const { CredentialIssuer } = await import("@1shotapi/ows-types");

    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/offers/demo")) {
        return new Response(
          JSON.stringify({
            credential_issuer: "https://issuer.example",
            credential_configuration_ids: ["KycCredential"],
            grants: {
              "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
                "pre-authorized_code": "code-1",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/.well-known/openid-credential-issuer")) {
        return new Response(
          JSON.stringify({
            credential_issuer: "https://issuer.example",
            credential_endpoint: "https://issuer.example/credential",
            token_endpoint: "https://issuer.example/token",
            credential_configurations_supported: {
              KycCredential: { format: "vc+sd-jwt", scope: "kyc" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/token") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            access_token: "atk_test",
            c_nonce: "cnonce_test",
            c_nonce_expires_in: 300,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const client = new HttpOid4vciClient(new FetchUtils(fetchImpl), parseUtils);
    const offer = await client.resolveOffer(
      CredentialOfferUri("https://issuer.example/offers/demo"),
    );
    assert.equal(String(offer.credentialIssuer), "https://issuer.example");

    const metadata = await client.fetchIssuerMetadata(
      CredentialIssuer("https://issuer.example"),
    );
    assert.equal(String(metadata.tokenEndpoint), "https://issuer.example/token");

    const prep = await client.prepareCredentialRequest!(offer, metadata);
    assert.equal(prep.accessToken, "atk_test");
    assert.equal(prep.cNonce, "cnonce_test");
  });
});

describe("HttpOid4vpClient", () => {
  it("maps DCQL request_uri with mocked fetch", async () => {
    const { HttpOid4vpClient } = await import("../src/http-oid4vp-client.js");
    const { FetchUtils } = await import("../src/fetch-json.js");
    const { PresentationRequestUri } = await import("@1shotapi/ows-types");

    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/request/demo")) {
        return new Response(
          JSON.stringify({
            client_id: "https://verifier.example",
            nonce: "vp-nonce-1",
            response_uri: "https://verifier.example/response",
            response_mode: "direct_post",
            dcql_query: {
              credentials: [
                {
                  id: "kyc",
                  format: "vc+sd-jwt",
                  meta: { vct_values: ["KycCredential"] },
                  claims: [{ path: ["ageOver18"] }],
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const client = new HttpOid4vpClient(new FetchUtils(fetchImpl));
    const definition = await client.resolveRequest(
      PresentationRequestUri("https://verifier.example/request/demo"),
    );
    assert.equal(definition.nonce, "vp-nonce-1");
    assert.equal(String(definition.requestedClaims[0]), "ageOver18");
    assert.equal(String(definition.credentialTypes?.[0]), "KycCredential");
  });
});
