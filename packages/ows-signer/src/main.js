import { handleRequest } from "./handlers.js";
import {
  abandonCeremony,
  isValidNesting,
  setCancelConfirmHook,
  setTrustedParentOrigin,
} from "./state.js";
import { cancelPendingCeremonyConfirm, initUi } from "./ui.js";
import { isValidParentMessage, parseRequest } from "./rpc.js";

function bootstrap() {
  const root = document.getElementById("ows-signer-root");
  if (!root) {
    throw new Error("OWS signer root element missing");
  }
  initUi(root);
  setCancelConfirmHook(cancelPendingCeremonyConfirm);

  if (!isValidNesting()) {
    console.error("[ows-signer] Must be embedded in a wallet iframe (double iframe).");
    return;
  }

  window.addEventListener("message", (event) => {
    if (!isValidParentMessage(event)) return;

    const data = event.data;
    if (
      data &&
      typeof data === "object" &&
      /** @type {{ kind?: unknown }} */ (data).kind === "cancel"
    ) {
      setTrustedParentOrigin(event.origin);
      // Do not await — parent timeout must unlock immediately even if a prior
      // handleRequest is still suspended on credentials.get.
      void abandonCeremony(cancelPendingCeremonyConfirm);
      return;
    }

    if (!parseRequest(data)) return;

    setTrustedParentOrigin(event.origin);
    const targetOrigin = event.origin;
    const { method, correlationId, params = {} } = /** @type {{ method: string, correlationId?: string, params?: Record<string, unknown> }} */ (
      data
    );

    void (async () => {
      // Drop a stuck Confirm wait (e.g. parent timed out) before starting anew.
      await abandonCeremony(cancelPendingCeremonyConfirm);
      await handleRequest(
        method,
        /** @type {Record<string, unknown>} */ (params),
        correlationId,
        targetOrigin,
      );
    })().catch((error) => {
      console.error("[ows-signer] request handler failed", error);
    });
  });
}

bootstrap();
