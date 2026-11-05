/**
 * Start Vite for Branding Layer + Signing Layer, optionally expose via ngrok.
 * Loads NGROK_AUTHTOKEN from repo root .env (copy from .env.example).
 *
 * Usage:
 *   node scripts/dev.mjs              # dev server + ngrok tunnel
 *   node scripts/dev.mjs --no-tunnel  # local HTTP only
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const preferredPort = Number(process.env.PORT ?? 5174);
const noTunnel = process.argv.includes("--no-tunnel");
let viteServer;
let ngrokListener;
let shuttingDown = false;
/** Port Vite actually bound (must match ngrok `addr`). */
let listenPort = preferredPort;

async function startDevServer() {
  viteServer = await createServer({
    configFile: path.join(__dirname, "../vite.config.ts"),
    server: {
      port: preferredPort,
      strictPort: true,
      host: "0.0.0.0",
    },
  });
  await viteServer.listen();

  const address = viteServer.httpServer?.address();
  if (address && typeof address === "object") {
    listenPort = address.port;
  } else {
    listenPort = preferredPort;
  }
}

async function startTunnel() {
  const ngrok = (await import("@ngrok/ngrok")).default;
  const domain = normalizeNgrokDomain(process.env.NGROK_DOMAIN);
  const options = {
    addr: listenPort,
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
  const localWallet = `http://localhost:${listenPort}/wallet/`;
  const localSigner = `http://localhost:${listenPort}/signer/`;

  console.log(`OWS general-wallet dev server: http://localhost:${listenPort}`);
  console.log(`  Branding Layer (local):  ${localWallet}`);
  console.log(`  Signing Layer (local):   ${localSigner}`);

  if (tunnelUrl) {
    const walletUrl = new URL("/wallet/", tunnelUrl).href;
    const signerUrl = new URL("/signer/", tunnelUrl).href;
    console.log(`  Branding Layer (ngrok):  ${walletUrl}`);
    console.log(`  Signing Layer (ngrok):   ${signerUrl}`);
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
    if (viteServer) {
      await viteServer.close();
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
  const message = error instanceof Error ? error.message : String(error);
  if (/Port .* is already in use|EADDRINUSE/i.test(message)) {
    console.error(
      `Port ${preferredPort} is already in use. Stop the other general-wallet ` +
        `(or anything on that port), then retry. A leftover \`dev:local\` / ` +
        `\`--no-tunnel\` process will steal ngrok traffic and break the host handshake.`,
    );
  }
  console.error("Failed to start wallet dev server:", error);
  process.exit(1);
}
