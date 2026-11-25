import { OWSSigner } from "@1shotapi/ows-signer-utils";

/**
 * Proxy that forwards to a real {@link OWSSigner} once `awaitSigner` resolves.
 * Register Postmate handlers with this so `wallet.start()` can run before the
 * nested Signing Layer iframe finishes loading (Postmate parents give up after
 * ~2.5s of handshake retries).
 */
export function createDeferredSigner(
  awaitSigner: () => Promise<OWSSigner>,
): OWSSigner {
  let instance: OWSSigner | undefined;
  let loadError: unknown;
  void awaitSigner()
    .then((signer) => {
      instance = signer;
    })
    .catch((error: unknown) => {
      loadError = error;
      console.error(
        "[ows-example-general-wallet] deferred Signing Layer load failed",
        error,
      );
    });
  return new Proxy({} as OWSSigner, {
    get(_target, property) {
      // Avoid looking like a thenable if someone awaits the proxy.
      if (property === "then") {
        return undefined;
      }
      if (!instance) {
        if (loadError !== undefined) {
          throw loadError instanceof Error
            ? loadError
            : new Error(
                `Signing Layer failed to load: ${String(loadError)}`,
              );
        }
        throw new Error(
          "Signing Layer not ready — await ensureReady() before using the signer",
        );
      }
      const value = Reflect.get(instance, property, instance);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(instance)
        : value;
    },
  });
}
