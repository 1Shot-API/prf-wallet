import type { CredentialIssuer } from "@1shotapi/ows-types";
import type { IssuerTrustRegistry, IssuerTrustMetadata } from "@1shotapi/ows-types";
import { MOCK_ISSUER_TRUST } from "./fixtures.js";

export class InMemoryIssuerTrustRegistry implements IssuerTrustRegistry {
  constructor(
    private readonly entries: IssuerTrustMetadata[] = [MOCK_ISSUER_TRUST],
  ) {}

  async resolveIssuer(
    issuerId: CredentialIssuer,
  ): Promise<IssuerTrustMetadata | undefined> {
    return this.entries.find((e) => e.issuerId === issuerId);
  }

  async listIssuers(): Promise<IssuerTrustMetadata[]> {
    return [...this.entries];
  }
}
