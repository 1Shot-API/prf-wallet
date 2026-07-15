/**
 * Produces a wallet attestation JWT when an issuer or verifier requires one
 * (OID4VCI / OID4VP deployment profiles).
 */
export interface IWalletAttestationProvider {
  createAttestation(input: {
    audience: string;
    nonce?: string;
  }): Promise<string>;
}
