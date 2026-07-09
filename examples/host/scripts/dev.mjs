/**
 * Start webpack-dev-server for the OWS example host.
 * Loads NGROK_DOMAIN from repo root .env for Branding Layer iframe URL (webpack.config.cjs).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import webpack from "webpack";
import WebpackDevServer from "webpack-dev-server";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const webpackConfig = require("../webpack.config.cjs");

const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const port = Number(process.env.PORT ?? 5173);

let devServer;
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

async function startDevServer() {
  const config = webpackConfig({}, { mode: "development", env: {} });
  config.mode = "development";
  const compiler = webpack(config);
  devServer = new WebpackDevServer(config.devServer, compiler);
  await devServer.start();
  await waitForPort("127.0.0.1", port);
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    if (devServer) {
      await devServer.stop();
    }
  } catch (error) {
    console.error(`Failed to shut down (${signal}):`, error);
    process.exit(1);
    return;
  }

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await startDevServer();
  const { walletIframeUrl, resolveHttpsOptions } = require("../webpack.config.cjs");
  const scheme = resolveHttpsOptions() ? "https" : "http";
  const walletUrl = walletIframeUrl();
  console.log(`OWS example host: ${scheme}://localhost:${port}`);
  console.log(`  Also try: ${scheme}://ows-host.com:${port} (hosts file → 127.0.0.1)`);
  console.log(`  Branding Layer iframe: ${walletUrl}`);
  if (scheme === "http") {
    console.log(
      "  Tip: HTTPS host is required for passkeys in nested HTTPS iframes — see examples/host/README.md",
    );
  }
} catch (error) {
  console.error("Failed to start host dev server:", error);
  process.exit(1);
}
