/**
 * Start an HTTPS tunnel to the local Vite dev server using the official @ngrok/ngrok SDK.
 * Requires NGROK_AUTHTOKEN in the environment (https://dashboard.ngrok.com/get-started/your-authtoken).
 */
import ngrok from "@ngrok/ngrok";

const port = Number(process.env.PORT ?? 5173);

const listener = await ngrok.forward({
  addr: port,
  authtoken_from_env: true,
});

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
