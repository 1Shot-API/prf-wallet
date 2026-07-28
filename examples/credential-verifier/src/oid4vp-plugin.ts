import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { applyDemoCors } from "../../shared/src/demo/cors.js";
import { DEMO_ISSUER_PUBLIC_JWK } from "../../shared/src/demo/demo-keys.js";
import {
  decryptPresentationResponse,
  generateVerifierEncryptionKeyPair,
} from "./presentation-jwe.js";

type StoredResponse = {
  receivedAt: string;
  vpToken?: string;
  encryptedResponse?: string;
  presentationSubmission?: string;
};

type StoredRequest = {
  client_id: string;
  nonce: string;
  response_uri: string;
  response_mode: string;
};

let encryptionKeys: {
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
} | null = null;

const lastResponses: StoredResponse[] = [];
let lastRequest: StoredRequest | null = null;

/** Demo endpoints only — reject oversized POSTs before buffering. */
const MAX_BODY_BYTES = 1_048_576;

async function ensureKeys() {
  if (!encryptionKeys) {
    encryptionKeys = await generateVerifierEncryptionKeyPair();
  }
  return encryptionKeys;
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const ct = String(req.headers["content-type"] ?? "");
      // OWS HttpOid4vpClient posts form-urlencoded; also accept JSON for other clients.
      if (ct.includes("application/json")) {
        try {
          resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
        } catch (error) {
          reject(error);
        }
        return;
      }
      resolve(Object.fromEntries(new URLSearchParams(raw)));
    });
    req.on("error", reject);
  });
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return undefined;
  }
  return JSON.stringify(value);
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  applyDemoCors(res);
  res.end(JSON.stringify(body));
}

/**
 * Vite plugin: OID4VP request_uri + response endpoints.
 *
 * @param options.publicOrigin Stable verifier origin (`https://ows-verifier.com:5176`).
 */
export function oid4vpDemoPlugin(options: {
  publicOrigin: string;
  issuerJwksUrl?: string;
}): Plugin {
  const base = options.publicOrigin.replace(/\/$/, "");

  return {
    name: "ows-oid4vp-demo",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // OPTIONS + open CORS are handled by demoCorsPlugin (vite.config).
        const url = new URL(req.url ?? "/", "http://localhost");
        const path = url.pathname;

        try {
          if (req.method === "GET" && path === "/request/demo") {
            const keys = await ensureKeys();
            const nonce = `vp-nonce-${Date.now()}`;
            const body = {
              client_id: base,
              nonce,
              response_uri: `${base}/response`,
              response_mode: "direct_post.jwt",
              client_metadata: {
                client_name: "OWS Demo Verifier",
                require_wallet_attestation: true,
                authorization_encrypted_response_alg: "ECDH-ES",
                authorization_encrypted_response_enc: "A256GCM",
                jwks: { keys: [keys.publicJwk] },
              },
              dcql_query: {
                credentials: [
                  {
                    id: "kyc",
                    format: "vc+sd-jwt",
                    meta: { vct_values: ["KycCredential"] },
                    claims: [
                      { path: ["ageOver18"] },
                      { path: ["country"] },
                    ],
                  },
                ],
              },
            };
            lastRequest = {
              client_id: body.client_id,
              nonce: body.nonce,
              response_uri: body.response_uri,
              response_mode: body.response_mode,
            };
            sendJson(res, 200, body);
            return;
          }

          if (req.method === "GET" && path === "/request/latest") {
            sendJson(res, 200, lastRequest);
            return;
          }

          if (req.method === "POST" && path === "/response") {
            const body = await readBody(req);
            const keys = await ensureKeys();
            let vpToken = asOptionalString(body.vp_token);
            const encrypted = asOptionalString(body.response);
            if (encrypted && !vpToken) {
              vpToken = await decryptPresentationResponse(
                encrypted,
                keys.privateJwk,
              );
            }
            lastResponses.unshift({
              receivedAt: new Date().toISOString(),
              vpToken,
              encryptedResponse: encrypted,
              presentationSubmission: asOptionalString(
                body.presentation_submission,
              ),
            });
            if (lastResponses.length > 20) lastResponses.length = 20;
            sendJson(res, 200, { status: "ok" });
            return;
          }

          if (req.method === "GET" && path === "/response/latest") {
            sendJson(res, 200, lastResponses[0] ?? null);
            return;
          }

          if (req.method === "GET" && path === "/issuer-jwks") {
            if (options.issuerJwksUrl) {
              try {
                const remote = await fetch(options.issuerJwksUrl);
                if (remote.ok) {
                  const jwks = await remote.json();
                  sendJson(res, 200, jwks);
                  return;
                }
              } catch {
                // fall through to embedded demo key
              }
            }
            sendJson(res, 200, {
              keys: [{ ...DEMO_ISSUER_PUBLIC_JWK, alg: "EdDSA", use: "sig" }],
            });
            return;
          }
        } catch (error: unknown) {
          sendJson(res, 500, {
            error: "server_error",
            error_description:
              error instanceof Error ? error.message : String(error),
          });
          return;
        }

        next();
      });
    },
  };
}
