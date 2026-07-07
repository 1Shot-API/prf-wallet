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

const port = Number(process.env.PORT ?? 5176);

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

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    if (devServer) await devServer.stop();
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
  const config = webpackConfig({}, { mode: "development", env: {} });
  config.mode = "development";
  devServer = new WebpackDevServer(config.devServer, webpack(config));
  await devServer.start();
  await waitForPort("127.0.0.1", port);
  console.log(`OWS credential verifier demo: http://localhost:${port}`);
  console.log(`  Branding Layer iframe: ${webpackConfig.walletIframeUrl()}`);
} catch (error) {
  console.error("Failed to start credential verifier dev server:", error);
  process.exit(1);
}
