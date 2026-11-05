import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

/** Open CORS for OID4 demo servers (wallet iframe originates on ngrok / other hosts). */
export function applyDemoCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  // Public HTTPS wallet (ngrok) → local issuer/verifier triggers Chrome Private Network Access.
  res.setHeader("Access-Control-Allow-Private-Network", "true");
}

type NextFn = (err?: unknown) => void;

/**
 * Connect middleware: stamp open CORS on every response and short-circuit OPTIONS.
 * Register with Vite `server.cors: false` so Vite's localhost-only CORS does not win.
 */
export function demoCorsMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: NextFn) => {
    applyDemoCors(res);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    next();
  };
}

/** Vite plugin: demo CORS for issuer/verifier HTTP surfaces. */
export function demoCorsPlugin(): Plugin {
  return {
    name: "ows-demo-cors",
    configureServer(server) {
      server.middlewares.use(demoCorsMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(demoCorsMiddleware());
    },
  };
}
