/**
 * Start webpack-dev-server for wallet + signer, optionally expose via ngrok.
 * Loads NGROK_AUTHTOKEN from repo root .env (copy from .env.example).
 *
 * Usage:
 *   node scripts/dev.mjs              # dev server + ngrok tunnel
 *   node scripts/dev.mjs --no-tunnel  # local HTTP only
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

const port = Number(process.env.PORT ?? 5174);
const noTunnel = process.argv.includes("--no-tunnel");

let devServer;
let ngrokListener;
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

async function startTunnel() {
  const ngrok = (await import("@ngrok/ngrok")).default;
  const domain = normalizeNgrokDomain(process.env.NGROK_DOMAIN);
  const options = {
    addr: port,
    authtoken_from_env: true,
  };
  if (domain) {
    options.domain = domain;
  }
  ngrokListener = await ngrok.forward(options);
  return ngrokListener.url();
}

/** Hostname only — accepts `immune-sheep-light.ngrok-free.app` or a full URL. */
function normalizeNgrokDomain(value) {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(url).hostname;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

function printUrls(tunnelUrl) {
  const localWallet = `http://localhost:${port}/wallet/`;
  const localSigner = `http://localhost:${port}/signer/`;

  console.log(`OWS wallet dev server: http://localhost:${port}`);
  console.log(`  Wallet (local):  ${localWallet}`);
  console.log(`  Signer (local):  ${localSigner}`);

  if (tunnelUrl) {
    const walletUrl = new URL("/wallet/", tunnelUrl).href;
    const signerUrl = new URL("/signer/", tunnelUrl).href;
    console.log(`  Wallet (ngrok):  ${walletUrl}`);
    console.log(`  Signer (ngrok):  ${signerUrl}`);
    console.log(`  Host env:        WALLET_IFRAME_URL=${walletUrl}`);
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    if (ngrokListener) {
      await ngrokListener.close();
    }
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

  let tunnelUrl;
  if (!noTunnel) {
    if (!process.env.NGROK_AUTHTOKEN) {
      console.warn(
        "NGROK_AUTHTOKEN not set — running local only. Copy .env.example to .env at repo root.",
      );
    } else {
      tunnelUrl = await startTunnel();
    }
  }

  printUrls(tunnelUrl);
} catch (error) {
  console.error("Failed to start wallet dev server:", error);
  process.exit(1);
}
