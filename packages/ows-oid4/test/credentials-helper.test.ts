import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CredentialConfigurationId,
  CredentialFormatId,
  CredentialId,
  CredentialIssuer,
  CredentialTypeName,
  type CredentialOffer,
  type CredentialSummary,
  type IOid4vciClient,
  type IOid4vpClient,
  type IIssuerTrustRegistry,
  type ICredentialRepository,
  type IssuerMetadata,
  type PresentationDefinition,
  type StoredCredential,
} from "@1shotapi/ows-types";
import { CredentialsHelper } from "../src/credentials/credentials-helper.js";

const issuer = CredentialIssuer("https://issuer.example");

function demoOffer(): CredentialOffer {
  return {
    credentialIssuer: issuer,
    credentialConfigurationIds: [
      CredentialConfigurationId("KycCredential"),
    ],
  };
}

function demoMetadata(): IssuerMetadata {
  return {
    credentialIssuer: issuer,
    credentialConfigurationsSupported: {
      [CredentialConfigurationId("KycCredential")]: {
        format: CredentialFormatId("sd-jwt-vc"),
      },
    },
  };
}

describe("CredentialsHelper display", () => {
  it("releases display after approveAndAcceptOffer (does not hide)", async () => {
    let releaseCount = 0;
    let hideCount = 0;
    let approved = false;

    const wallet = {
      requestDisplay: async () => ({
        hide: async () => {
          hideCount += 1;
        },
        release: () => {
          releaseCount += 1;
        },
      }),
      credentials: { register: () => undefined },
    };

    const oid4vci = {
      resolveOffer: async () => demoOffer(),
      fetchIssuerMetadata: async () => demoMetadata(),
    } as unknown as IOid4vciClient;

    const trust: IIssuerTrustRegistry = {
      isTrustedIssuer: async () => true,
    };

    const helper = new CredentialsHelper(wallet, {
      repository: {
        list: async () => [],
        get: async () => undefined,
        store: async () => undefined,
        delete: async () => undefined,
      } as ICredentialRepository,
      oid4vci,
      oid4vp: {} as IOid4vpClient,
      trust,
      approveAndAcceptOffer: async () => {
        approved = true;
        return {
          credentialId: CredentialId("cred-1"),
          format: CredentialFormatId("sd-jwt-vc"),
          type: [CredentialTypeName("KycCredential")],
        };
      },
      approveAndPresent: async () => {
        throw new Error("unused");
      },
    });

    const receipt = await helper.acceptOffer({ offer: demoOffer() });
    assert.equal(String(receipt.credentialId), "cred-1");
    assert.equal(approved, true);
    assert.equal(releaseCount, 1);
    assert.equal(hideCount, 0);
  });

  it("calls approveAndPresent with loaded credential and releases", async () => {
    let releaseCount = 0;
    const match: CredentialSummary = {
      credentialId: CredentialId("cred-1"),
      format: CredentialFormatId("sd-jwt-vc"),
      type: [CredentialTypeName("KycCredential")],
      issuer,
      issuedAt: 0,
    };
    const credential = {
      credentialId: match.credentialId,
      format: match.format,
      type: match.type,
      issuer,
    } as StoredCredential;

    const definition = {
      id: "def-1",
      verifier: { name: "Demo Verifier", id: "https://verifier.example" },
      requestedClaims: [],
    } as unknown as PresentationDefinition;

    const wallet = {
      requestDisplay: async () => ({
        hide: async () => undefined,
        release: () => {
          releaseCount += 1;
        },
      }),
      credentials: { register: () => undefined },
    };

    const oid4vp = {
      resolveRequest: async () => definition,
      matchCredentials: async () => [match],
    } as unknown as IOid4vpClient;

    let gotCredentialId: string | undefined;
    const helper = new CredentialsHelper(wallet, {
      repository: {
        list: async () => [match],
        get: async () => credential,
        store: async () => undefined,
        delete: async () => undefined,
      } as ICredentialRepository,
      oid4vci: {} as IOid4vciClient,
      oid4vp,
      trust: { isTrustedIssuer: async () => true },
      recheckTrustOnPresent: false,
      approveAndAcceptOffer: async () => {
        throw new Error("unused");
      },
      approveAndPresent: async (request) => {
        gotCredentialId = String(request.credential.credentialId);
        return {
          presentation: "fake.jwt",
          submittedToResponseUri: false,
        };
      },
    });

    const result = await helper.present({ request: definition });
    assert.equal(result.presentation, "fake.jwt");
    assert.equal(gotCredentialId, "cred-1");
    assert.equal(releaseCount, 1);
  });
});
