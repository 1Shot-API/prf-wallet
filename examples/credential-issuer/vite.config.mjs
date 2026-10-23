import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "vite";
import {
  demoPublicOrigin,
  OWS_ISSUER_HOSTNAME,
  OWS_ISSUER_PORT,
  resolveHttpsOptions,
  walletIframeUrl,
} from "../host-dev.mjs";
import { demoCorsPlugin } from "../shared/src/demo/cors.ts";
import { oid4vciDemoPlugin } from "./src/oid4vci-plugin.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const https = resolveHttpsOptions({
  certsDir: path.resolve(__dirname, "certs"),
  exampleLabel: "examples/credential-issuer",
});

const port = Number(process.env.PORT ?? OWS_ISSUER_PORT);
const scheme = https ? "https" : "http";
const issuerOrigin = demoPublicOrigin({
  hostname: OWS_ISSUER_HOSTNAME,
  port,
  scheme,
  envValue: process.env.ISSUER_ORIGIN,
});

export default defineConfig({
  define: {
    __WALLET_IFRAME_URL__: JSON.stringify(walletIframeUrl()),
    __ISSUER_ORIGIN__: JSON.stringify(issuerOrigin),
  },
  resolve: {
    alias: {
      "@ows-shared": path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  plugins: [
    demoCorsPlugin(),
    oid4vciDemoPlugin({ publicOrigin: issuerOrigin }),
  ],
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    // Disable Vite default CORS (localhost-only). demoCorsPlugin allows *.
    cors: false,
    ...(https ? { https } : {}),
  },
  preview: {
    port,
    host: "0.0.0.0",
    cors: false,
    ...(https ? { https } : {}),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
