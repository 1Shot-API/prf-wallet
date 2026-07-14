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

/**
 * Resolve `rel` under `rootDir`, rejecting path traversal (`..`, encoded separators).
 * Returns `undefined` when the result would escape `rootDir`.
 */
function resolveContainedPath(
  rootDir: string,
  urlRelative: string,
): string | undefined {
  let rel: string;
  try {
    rel = decodeURIComponent(urlRelative);
  } catch {
    return undefined;
  }
  if (rel.includes("\0")) {
    return undefined;
  }
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, rel);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    return undefined;
  }
  return resolved;
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
          const filePath = resolveContainedPath(
            signerPkgSrc,
            url.slice("/signer/src/".length),
          );
          if (!filePath || !fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          sendFile(res, filePath);
          return;
        }

        const filePath = resolveContainedPath(
          signerPublicDir,
          url.slice("/signer/".length),
        );
        if (!filePath || !fs.existsSync(filePath)) {
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
