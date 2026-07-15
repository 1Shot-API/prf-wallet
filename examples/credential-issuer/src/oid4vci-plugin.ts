import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  CredentialClaimName,
  CredentialIssuer,
  ISO8601DateTime,
  ProofUtils,
} from "@1shotapi/ows-types";
import { applyDemoCors } from "../../shared/src/demo/cors.js";
import { DEMO_ISSUER_PUBLIC_JWK } from "../../shared/src/demo/demo-keys.js";
import { issueDemoSdJwtVc } from "../../shared/src/demo/issuer.js";

const PRE_AUTH_CODE = "ows-demo-preauth-code";
const ACCESS_TOKENS = new Map<string, { cNonce: string }>();

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const ct = String(req.headers["content-type"] ?? "");
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
 * Vite plugin: OID4VCI well-known / token / credential / offer endpoints.
 *
 * @param options.publicOrigin Stable public issuer origin (`https://ows-issuer.com:5175`).
 *   Used for `credential_issuer`, endpoint URLs, proof audience, and SD-JWT `iss`
 *   even when the process was reached via localhost.
 */
export function oid4vciDemoPlugin(options: { publicOrigin: string }): Plugin {
  const base = options.publicOrigin.replace(/\/$/, "");
  const credentialIssuer = CredentialIssuer(base);

  return {
    name: "ows-oid4vci-demo",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // OPTIONS + open CORS are handled by demoCorsPlugin (vite.config).
        const url = new URL(req.url ?? "/", "http://localhost");
        const path = url.pathname;

        try {
          if (
            req.method === "GET" &&
            path === "/.well-known/openid-credential-issuer"
          ) {
            sendJson(res, 200, {
              credential_issuer: String(credentialIssuer),
              credential_endpoint: `${base}/credential`,
              token_endpoint: `${base}/token`,
              jwks_uri: `${base}/jwks`,
              credential_configurations_supported: {
                KycCredential: {
                  format: "vc+sd-jwt",
                  scope: "kyc",
                  proof_types_supported: {
                    jwt: { proof_signing_alg_values_supported: ["EdDSA"] },
                  },
                },
              },
            });
            return;
          }

          if (req.method === "GET" && path === "/jwks") {
            sendJson(res, 200, {
              keys: [{ ...DEMO_ISSUER_PUBLIC_JWK, alg: "EdDSA", use: "sig" }],
            });
            return;
          }

          if (req.method === "GET" && path === "/offers/demo") {
            sendJson(res, 200, {
              credential_issuer: String(credentialIssuer),
              credential_configuration_ids: ["KycCredential"],
              grants: {
                "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
                  "pre-authorized_code": PRE_AUTH_CODE,
                },
              },
            });
            return;
          }

          if (req.method === "POST" && path === "/token") {
            const body = await readBody(req);
            if (
              body.grant_type !==
                "urn:ietf:params:oauth:grant-type:pre-authorized_code" ||
              body["pre-authorized_code"] !== PRE_AUTH_CODE
            ) {
              sendJson(res, 400, { error: "invalid_grant" });
              return;
            }
            const accessToken = `atk_${crypto.randomUUID()}`;
            const cNonce = `cnonce_${crypto.randomUUID()}`;
            ACCESS_TOKENS.set(accessToken, { cNonce });
            sendJson(res, 200, {
              access_token: accessToken,
              token_type: "bearer",
              expires_in: 3600,
              c_nonce: cNonce,
              c_nonce_expires_in: 300,
            });
            return;
          }

          if (req.method === "POST" && path === "/credential") {
            const auth = String(req.headers.authorization ?? "");
            const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
            const session = ACCESS_TOKENS.get(token);
            if (!session) {
              sendJson(res, 401, { error: "invalid_token" });
              return;
            }
            const body = await readBody(req);
            const proof = body.proof as { jwt?: string } | undefined;
            const proofJwt = proof?.jwt;
            if (!proofJwt) {
              sendJson(res, 400, { error: "invalid_proof" });
              return;
            }

            const proofResult = await ProofUtils.verifyOid4vciProofJwt({
              jwt: proofJwt,
              expectedAudience: credentialIssuer,
              expectedNonce: session.cNonce,
            });
            if (!proofResult.valid || !proofResult.holderPublicKeyJwk) {
              sendJson(res, 400, {
                error: "invalid_proof",
                error_description: proofResult.reasons.join("; "),
              });
              return;
            }

            const issuedAt = ISO8601DateTime(new Date().toISOString());
            const sdJwt = await issueDemoSdJwtVc({
              issuer: String(credentialIssuer),
              vct: "KycCredential",
              claims: {
                ageOver18: true,
                country: "US",
                assuranceLevel: "substantial",
                verifiedAt: issuedAt,
              },
              disclosableClaims: [
                CredentialClaimName("ageOver18"),
                CredentialClaimName("country"),
                CredentialClaimName("assuranceLevel"),
                CredentialClaimName("verifiedAt"),
              ],
              holderPublicKeyJwk: proofResult.holderPublicKeyJwk,
            });

            sendJson(res, 200, {
              credential: sdJwt,
              c_nonce: session.cNonce,
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

export function publicOfferUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/offers/demo`;
}
