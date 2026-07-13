export {
  bytesToBase64Url,
  base64UrlToBytes,
  sdJwtHasher,
  sdJwtSaltGenerator,
  signEd25519,
  verifyEd25519,
  createEd25519SignerFromJwk,
  createEd25519VerifierFromJwk,
} from "./credentials/sd-jwt-vc/crypto.js";
export { extractHolderJwkFromSdJwtVc } from "./credentials/sd-jwt-vc/decode.js";
export { holderSignerToKbSigner } from "./credentials/sd-jwt-vc/holder-signer.js";
export {
  buildSdJwtVcPresentation,
  type BuildSdJwtVcPresentationInput,
  type BuildSdJwtVcPresentationResult,
} from "./credentials/sd-jwt-vc/presentation.js";
