import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "vite";
import {
  resolveHttpsOptions,
  walletIframeUrl,
} from "../host-dev.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const https = resolveHttpsOptions({
  certsDir: path.resolve(__dirname, "certs"),
  exampleLabel: "examples/host",
});

export default defineConfig({
  define: {
    __WALLET_IFRAME_URL__: JSON.stringify(walletIframeUrl()),
  },
  server: {
    port: Number(process.env.PORT ?? 5173),
    host: "0.0.0.0",
    allowedHosts: true,
    strictPort: true,
    ...(https ? { https } : {}),
  },
  preview: {
    port: Number(process.env.PORT ?? 5173),
    host: "0.0.0.0",
    strictPort: true,
    ...(https ? { https } : {}),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
