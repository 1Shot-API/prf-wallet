import { handleRequest } from "./handlers.js";
import {
  isValidNesting,
  setTrustedParentOrigin,
} from "./state.js";
import { initUi } from "./ui.js";
import { isValidParentMessage, parseRequest } from "./rpc.js";

function bootstrap() {
  const root = document.getElementById("ows-signer-root");
  if (!root) {
    throw new Error("OWS signer root element missing");
  }
  initUi(root);

  if (!isValidNesting()) {
    console.error("[ows-signer] Must be embedded in a wallet iframe (double iframe).");
    return;
  }

  window.addEventListener("message", async (event) => {
    if (!isValidParentMessage(event)) return;
    if (!parseRequest(event.data)) return;

    setTrustedParentOrigin(event.origin);
    const targetOrigin = event.origin;
    const { method, correlationId, params = {} } = /** @type {{ method: string, correlationId?: string, params?: Record<string, unknown> }} */ (
      event.data
    );

    await handleRequest(
      method,
      /** @type {Record<string, unknown>} */ (params),
      correlationId,
      targetOrigin,
    );
  });
}

bootstrap();
