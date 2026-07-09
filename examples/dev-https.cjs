/**
 * Shared optional HTTPS for OWS Host Layer example webpack-dev-servers.
 *
 * Enable when HOST_HTTPS=1/true, or when default mkcert files exist under
 * the example's certs/ directory (or HOST_SSL_CERT / HOST_SSL_KEY).
 *
 * @param {{ certsDir: string, exampleLabel: string }} options
 * @returns {{ key: Buffer, cert: Buffer } | undefined}
 */
const fs = require("node:fs");
const path = require("node:path");

function resolveHttpsOptions({ certsDir, exampleLabel }) {
  const flag = process.env.HOST_HTTPS?.trim().toLowerCase();
  const forceOn = flag === "1" || flag === "true" || flag === "yes";
  const forceOff = flag === "0" || flag === "false" || flag === "no";

  const defaultCert = path.join(certsDir, "dev-cert.pem");
  const defaultKey = path.join(certsDir, "dev-key.pem");
  const hostFallbackCert = path.resolve(
    __dirname,
    "host/certs/dev-cert.pem",
  );
  const hostFallbackKey = path.resolve(__dirname, "host/certs/dev-key.pem");

  let certPath = process.env.HOST_SSL_CERT?.trim()
    ? path.resolve(process.env.HOST_SSL_CERT.trim())
    : defaultCert;
  let keyPath = process.env.HOST_SSL_KEY?.trim()
    ? path.resolve(process.env.HOST_SSL_KEY.trim())
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
        `    mkcert -cert-file examples/host/certs/dev-cert.pem -key-file examples/host/certs/dev-key.pem ows-host.com localhost 127.0.0.1\n` +
        `  (issuer/verifier reuse examples/host/certs when present)`,
    );
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

module.exports = { resolveHttpsOptions };
