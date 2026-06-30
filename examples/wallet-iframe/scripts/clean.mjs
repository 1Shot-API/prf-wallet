/**
 * Remove webpack output and any stray TypeScript emit artifacts under src/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");
const emitPattern = /\.(js|d\.ts|js\.map|d\.ts\.map)$/;

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });

if (fs.existsSync(srcDir)) {
  for (const name of fs.readdirSync(srcDir)) {
    if (emitPattern.test(name)) {
      fs.unlinkSync(path.join(srcDir, name));
    }
  }
}
