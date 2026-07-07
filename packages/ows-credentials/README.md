# @1shotapi/ows-credentials

Standards-aligned verifiable credential types and abstractions for OWS. Protocol-agnostic interfaces with mock implementations for demos and tests.

See [`spec/credentials/`](../../spec/credentials/README.md) for the extension spec.

## Usage

```ts
import {
  CREDENTIAL_WIRE_METHODS,
  type OpenWalletCredentialProvider,
} from "@1shotapi/ows-credentials";

import {
  InMemoryCredentialStore,
  MockOid4vciClient,
  MockOid4vpClient,
} from "@1shotapi/ows-credentials/mock";
```

Host apps use `proxy.credentials` from `@1shotapi/ows-provider`. Branding wallets register handlers via `wallet.credentials.register()`.

## Mock vs production

Mocks live under `@1shotapi/ows-credentials/mock` and are clearly labeled non-cryptographic fixtures. Swap in real OID4VCI/OID4VP/SD-JWT VC clients behind the interfaces for production.
