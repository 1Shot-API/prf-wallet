/**
 * Start an HTTPS tunnel to the local Vite dev server using the official @ngrok/ngrok SDK.
 * Requires NGROK_AUTHTOKEN in the environment (https://dashboard.ngrok.com/get-started/your-authtoken).
 * Optionally set NGROK_DOMAIN (repo root .env) for a reserved static domain.
 */
import ngrok from "@ngrok/ngrok";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const port = Number(process.env.PORT ?? 5173);
const domain = normalizeNgrokDomain(process.env.NGROK_DOMAIN);

const forwardOptions = {
  addr: port,
  authtoken_from_env: true,
};
if (domain) {
  forwardOptions.domain = domain;
}

const listener = await ngrok.forward(forwardOptions);

console.log(`OWS example host tunnel: ${listener.url()}`);
console.log(`Forwarding to http://localhost:${port}`);

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    await listener.close();
  } catch (error) {
    console.error(`Failed to close tunnel (${signal}):`, error);
    process.exit(1);
    return;
  }

  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

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
