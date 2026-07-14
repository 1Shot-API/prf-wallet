import type { CredentialIssuer } from "@1shotapi/ows-types";
import type { IIssuerTrustRegistry, IssuerTrustMetadata } from "@1shotapi/ows-types";
import { MOCK_ISSUER_TRUST } from "./fixtures.js";

export class InMemoryIssuerTrustRegistry implements IIssuerTrustRegistry {
  constructor(
    private readonly entries: IssuerTrustMetadata[] = [MOCK_ISSUER_TRUST],
  ) {}

  async isTrustedIssuer(issuerId: CredentialIssuer): Promise<boolean> {
    return this.entries.some((e) => e.issuerId === issuerId);
  }

  async resolveIssuer(
    issuerId: CredentialIssuer,
  ): Promise<IssuerTrustMetadata | undefined> {
    return this.entries.find((e) => e.issuerId === issuerId);
  }

  async listIssuers(): Promise<IssuerTrustMetadata[]> {
    return [...this.entries];
  }
}
