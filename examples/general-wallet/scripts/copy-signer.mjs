import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleRoot = path.resolve(__dirname, "..");
const signerPkgSrc = path.resolve(exampleRoot, "../../packages/ows-signer/src");
const signerPublic = path.join(exampleRoot, "signer-static/index.html");
const outSigner = path.join(exampleRoot, "dist/signer");

fs.rmSync(outSigner, { recursive: true, force: true });
fs.mkdirSync(path.join(outSigner, "src"), { recursive: true });
fs.cpSync(signerPkgSrc, path.join(outSigner, "src"), { recursive: true });
fs.copyFileSync(signerPublic, path.join(outSigner, "index.html"));

console.log("Copied Signing Layer to dist/signer/");
