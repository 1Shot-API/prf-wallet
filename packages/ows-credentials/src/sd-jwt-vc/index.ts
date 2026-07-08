export type { HolderSigner } from "./holder-signer.js";
export { holderSignerToKbSigner } from "./holder-signer.js";
export {
  sdJwtHasher,
  sdJwtSaltGenerator,
  bytesToBase64Url,
  base64UrlToBytes,
  signEd25519,
  verifyEd25519,
} from "./crypto.js";
export {
  DEMO_ISSUER_PRIVATE_JWK,
  DEMO_ISSUER_PUBLIC_JWK,
  DEMO_HOLDER_PRIVATE_JWK,
  DEMO_HOLDER_PUBLIC_JWK,
} from "./demo-keys.js";
export {
  issueDemoSdJwtVc,
  createEd25519SignerFromJwk,
  createEd25519VerifierFromJwk,
  type IssueSdJwtVcInput,
} from "./issuer.js";
export {
  buildSdJwtVcPresentation,
  type BuildSdJwtVcPresentationInput,
  type BuildSdJwtVcPresentationResult,
} from "./presentation.js";
export {
  verifySdJwtVcPresentation,
  type VerifySdJwtVcPresentationInput,
  type VerifySdJwtVcPresentationResult,
} from "./verify.js";
export {
  createEd25519HolderSignerFromJwk,
  createDemoHolderSigner,
  createNodeEd25519HolderSigner,
} from "./jwk-holder-signer.js";
export {
  createOwsEd25519HolderSigner,
  type OwsEd25519SignerDeps,
} from "./ows-holder-signer.js";
export { extractHolderJwkFromSdJwtVc } from "./decode.js";
