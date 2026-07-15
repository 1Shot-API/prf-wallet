export * from "./fixtures.js";
export * from "./in-memory-store.js";
export {
  LocalStorageCredentialRepository,
  OWS_MOCK_CREDENTIALS_STORAGE_KEY,
  createMemoryStorageBackend,
  type CredentialStorageBackend,
} from "./local-storage-store.js";
export { MockOid4vciClient, DEMO_HOLDER_PUBLIC_JWK } from "./mock/oid4vci.js";
export { MockOid4vpClient } from "./mock/oid4vp.js";
export {
  DEMO_HOLDER_PRIVATE_JWK,
  DEMO_ISSUER_PUBLIC_JWK,
} from "./demo/demo-keys.js";
export { InMemoryIssuerTrustRegistry, isLocalDemoIssuerOrigin } from "./in-memory-trust-registry.js";
export {
  DemoCredentialFlow,
  validateMockPresentation,
  type DemoCredentialFlowDeps,
  type MockVerifierResult,
  type CustodyStep,
  type CustodyStepId,
} from "./demo-flow.js";
