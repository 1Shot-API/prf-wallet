import path from "node:path";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const signerPkgRoot = path.resolve(__dirname, "../../packages/ows-signer");
const signerPkgSrc = path.join(signerPkgRoot, "src");
const signerPublicDir = path.resolve(__dirname, "signer-static");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function contentType(filePath: string): string {
  return MIME[path.extname(filePath)] ?? "application/octet-stream";
}

function sendFile(res: ServerResponse, filePath: string): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType(filePath));
  fs.createReadStream(filePath).pipe(res);
}

/** Serve `/signer/` outside Vite `base` so WebAuthn + nest stay same-origin. */
function serveSignerPlugin(): Plugin {
  return {
    name: "ows-serve-signer",
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/signer")) {
          next();
          return;
        }

        if (url === "/signer" || url === "/signer/") {
          sendFile(res, path.join(signerPublicDir, "index.html"));
          return;
        }

        if (url.startsWith("/signer/src/")) {
          const rel = url.slice("/signer/src/".length);
          const filePath = path.join(signerPkgSrc, rel);
          if (!filePath.startsWith(signerPkgSrc) || !fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          sendFile(res, filePath);
          return;
        }

        const rel = url.slice("/signer/".length);
        const filePath = path.join(signerPublicDir, rel);
        if (!filePath.startsWith(signerPublicDir) || !fs.existsSync(filePath)) {
          next();
          return;
        }
        sendFile(res, filePath);
      });
    },
  };
}

export default defineConfig({
  base: "/wallet/",
  publicDir: false,
  plugins: [react(), tailwindcss(), serveSignerPlugin()],
  resolve: {
    alias: {
      "@ows-shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5174),
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      allow: [path.resolve(__dirname, "../..")],
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 5174),
    strictPort: true,
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist/wallet",
    emptyOutDir: true,
    sourcemap: true,
  },
});
