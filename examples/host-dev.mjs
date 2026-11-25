/**
 * Shared helpers for OWS Host Layer example Vite servers
 * (host, credential-issuer, credential-verifier).
 *
 * HTTPS: enable when HOST_HTTPS=1/true, or when default mkcert files exist under
 * the example's certs/ directory (or HOST_SSL_CERT / HOST_SSL_KEY).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const examplesDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(examplesDir, "..");

/**
 * Resolve a path from env: absolute paths stay absolute; relative paths are
 * anchored at the repo root (matches `.env.example` paths like
 * `examples/host/certs/dev-cert.pem`), not `process.cwd()`.
 *
 * @param {string} filePath
 */
function resolveRepoPath(filePath) {
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(repoRoot, filePath);
}

/** Host Layer demo hostname (hosts file → 127.0.0.1). */
export const OWS_HOST_HOSTNAME = "ows-host.com";
/** Credential issuer public hostname (credential `iss` / offer URIs). */
export const OWS_ISSUER_HOSTNAME = "ows-issuer.com";
/** Credential verifier public hostname (`request_uri` / `client_id`). */
export const OWS_VERIFIER_HOSTNAME = "ows-verifier.com";

/** Default local ports for demos. */
export const OWS_ISSUER_PORT = 5175;
export const OWS_VERIFIER_PORT = 5176;

/**
 * Public demo origin for issuer/verifier (not the bind address).
 * Prefer env override, else `{scheme}://{hostname}:{port}`.
 *
 * @param {{ hostname: string, port: number, scheme: string, envValue?: string }} options
 */
export function demoPublicOrigin({ hostname, port, scheme, envValue }) {
  const fromEnv = envValue?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `${scheme}://${hostname}:${port}`;
}

/** mkcert SANs used by local HTTPS demos. */
export const MKCERT_DEMO_SANS = [
  OWS_HOST_HOSTNAME,
  OWS_ISSUER_HOSTNAME,
  OWS_VERIFIER_HOSTNAME,
  "localhost",
  "127.0.0.1",
];

/**
 * @param {{ certsDir: string, exampleLabel: string }} options
 * @returns {{ key: Buffer, cert: Buffer } | undefined}
 */
export function resolveHttpsOptions({ certsDir, exampleLabel }) {
  const flag = process.env.HOST_HTTPS?.trim().toLowerCase();
  const forceOn = flag === "1" || flag === "true" || flag === "yes";
  const forceOff = flag === "0" || flag === "false" || flag === "no";

  const defaultCert = path.join(certsDir, "dev-cert.pem");
  const defaultKey = path.join(certsDir, "dev-key.pem");
  const hostFallbackCert = path.join(examplesDir, "host/certs/dev-cert.pem");
  const hostFallbackKey = path.join(examplesDir, "host/certs/dev-key.pem");

  let certPath = process.env.HOST_SSL_CERT?.trim()
    ? resolveRepoPath(process.env.HOST_SSL_CERT.trim())
    : defaultCert;
  let keyPath = process.env.HOST_SSL_KEY?.trim()
    ? resolveRepoPath(process.env.HOST_SSL_KEY.trim())
    : defaultKey;

  // Reuse examples/host mkcert files when this example has none of its own.
  if (
    !process.env.HOST_SSL_CERT?.trim() &&
    !process.env.HOST_SSL_KEY?.trim() &&
    !(fs.existsSync(certPath) && fs.existsSync(keyPath)) &&
    fs.existsSync(hostFallbackCert) &&
    fs.existsSync(hostFallbackKey)
  ) {
    certPath = hostFallbackCert;
    keyPath = hostFallbackKey;
  }

  const certsPresent = fs.existsSync(certPath) && fs.existsSync(keyPath);

  if (forceOff) return undefined;
  if (!forceOn && !certsPresent) return undefined;

  if (!certsPresent) {
    throw new Error(
      `HOST_HTTPS is set but cert/key missing for ${exampleLabel}.\n` +
        `  Expected:\n` +
        `    ${certPath}\n` +
        `    ${keyPath}\n` +
        `  Generate with:\n` +
        `    mkcert -install\n` +
        `    mkcert -cert-file examples/host/certs/dev-cert.pem -key-file examples/host/certs/dev-key.pem ${MKCERT_DEMO_SANS.join(" ")}\n` +
        `  (issuer/verifier reuse examples/host/certs when present)`,
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

/** Hostname only — accepts `immune-sheep-light.ngrok-free.app` or a full URL. */
export function normalizeNgrokDomain(value) {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(url).hostname;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

/**
 * Branding Layer iframe URL for Host Layer demos.
 *
 * Priority:
 * 1. `WALLET_IFRAME_URL` — full URL override (any branding implementation)
 * 2. `NGROK_DOMAIN` → `https://<domain>/wallet/`
 * 3. `http://localhost:5174/wallet/`
 */
export function walletIframeUrl() {
  const override = process.env.WALLET_IFRAME_URL?.trim();
  if (override) {
    return override.replace(/\/?$/, "/");
  }
  const domain = normalizeNgrokDomain(process.env.NGROK_DOMAIN);
  if (domain) {
    return `https://${domain}/wallet/`;
  }
  return "http://localhost:5174/wallet/";
}
