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

const shutdown = async () => {
  await listener.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
