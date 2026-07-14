/**
 * Start Vite for the mock credential issuer host (port 5175).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { createServer } from "vite";
import dotenv from "dotenv";
import { resolveHttpsOptions, walletIframeUrl } from "../../host-dev.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const port = Number(process.env.PORT ?? 5175);

let viteServer;
let shuttingDown = false;

function waitForPort(host, listenPort, timeoutMs = 30_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect({ host, port: listenPort }, () => {
        socket.end();
        resolve(undefined);
      });
      socket.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for port ${listenPort}`));
          return;
        }
        setTimeout(tryConnect, 200);
      });
    };
    tryConnect();
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (viteServer) await viteServer.close();
  } catch (error) {
    console.error(`Failed to shut down (${signal}):`, error);
    process.exit(1);
    return;
  }
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  viteServer = await createServer({
    configFile: path.join(__dirname, "../vite.config.mjs"),
    server: { port, host: "0.0.0.0" },
  });
  await viteServer.listen();
  await waitForPort("127.0.0.1", port);

  const https = resolveHttpsOptions({
    certsDir: path.join(__dirname, "../certs"),
    exampleLabel: "examples/credential-issuer",
  });
  const scheme = https ? "https" : "http";
  console.log(`OWS credential issuer demo: ${scheme}://localhost:${port}`);
  console.log(
    `  Also try: ${scheme}://ows-host.com:${port} (hosts file → 127.0.0.1)`,
  );
  console.log(`  Branding Layer iframe: ${walletIframeUrl()}`);
  if (scheme === "http") {
    console.log(
      "  Tip: HTTPS host is required for passkeys in nested HTTPS iframes — see examples/host/README.md",
    );
  }
} catch (error) {
  console.error("Failed to start credential issuer dev server:", error);
  process.exit(1);
}
