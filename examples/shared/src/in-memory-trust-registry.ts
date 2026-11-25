import type { CredentialIssuer } from "@1shotapi/ows-types";
import type { IIssuerTrustRegistry, IssuerTrustMetadata } from "@1shotapi/ows-types";
import { MOCK_ISSUER_TRUST } from "./fixtures.js";

const LOCAL_DEMO_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "ows-host.com",
  "ows-issuer.com",
  "ows-verifier.com",
]);

/** True for local Vite / mkcert demo issuer origins. */
export function isLocalDemoIssuerOrigin(issuerId: string): boolean {
  try {
    const url = new URL(issuerId);
    return (
      LOCAL_DEMO_HOSTNAMES.has(url.hostname) ||
      url.hostname.endsWith(".ows-host.com") ||
      url.hostname.endsWith(".ows-issuer.com") ||
      url.hostname.endsWith(".ows-verifier.com")
    );
  } catch {
    return false;
  }
}

export class InMemoryIssuerTrustRegistry implements IIssuerTrustRegistry {
  constructor(
    private readonly entries: IssuerTrustMetadata[] = [MOCK_ISSUER_TRUST],
  ) {}

  async isTrustedIssuer(issuerId: CredentialIssuer): Promise<boolean> {
    const id = String(issuerId);
    if (isLocalDemoIssuerOrigin(id)) return true;
    return this.entries.some((e) => e.issuerId === issuerId);
  }

  async resolveIssuer(
    issuerId: CredentialIssuer,
  ): Promise<IssuerTrustMetadata | undefined> {
    const found = this.entries.find((e) => e.issuerId === issuerId);
    if (found) return found;
    if (isLocalDemoIssuerOrigin(String(issuerId))) {
      return {
        issuerId,
        name: "Local Demo KYC Issuer",
        assuranceLevels: ["substantial", "high"],
        jurisdictions: ["US", "GB"],
      };
    }
    return undefined;
  }

  async listIssuers(): Promise<IssuerTrustMetadata[]> {
    return [...this.entries];
  }
}
