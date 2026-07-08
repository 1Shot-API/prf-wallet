/**
 * MOCK demo Ed25519 keypairs — TEST ONLY. Do not use in production.
 * Generated once via Node `generateKeyPairSync('ed25519')`.
 */

/** Demo issuer — signs mock KYC SD-JWT VCs. */
export const DEMO_ISSUER_PRIVATE_JWK: JsonWebKey = {
  crv: "Ed25519",
  d: "pcLAFtmJw-OtcPm7taGhEDocf63HfBk5TMXWSoF6rvw",
  x: "ObRX6jKS0AbsXx3ICSIiozuqzYUXXrQhlj4GkeqXfbs",
  kty: "OKP",
};

export const DEMO_ISSUER_PUBLIC_JWK: JsonWebKey = {
  crv: "Ed25519",
  x: "ObRX6jKS0AbsXx3ICSIiozuqzYUXXrQhlj4GkeqXfbs",
  kty: "OKP",
};

/** Fallback demo holder when branding does not supply a wallet `HolderSigner`. */
export const DEMO_HOLDER_PRIVATE_JWK: JsonWebKey = {
  crv: "Ed25519",
  d: "G8_8M9RjEA5L5NIeAoB24C9yOb8KPuRoh9y7SidoXJA",
  x: "3dmWOAMTtkMxm88aJ9QhlK5SWimNXt6-WTsI4eFHwC8",
  kty: "OKP",
};

export const DEMO_HOLDER_PUBLIC_JWK: JsonWebKey = {
  crv: "Ed25519",
  x: "3dmWOAMTtkMxm88aJ9QhlK5SWimNXt6-WTsI4eFHwC8",
  kty: "OKP",
};
