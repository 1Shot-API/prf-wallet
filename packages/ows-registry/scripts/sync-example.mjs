/**
 * Copy registry module files into an example app (monorepo maintainer workflow).
 *
 * Usage:
 *   node scripts/sync-example.mjs <example-name> <item-name> [variant]
 *
 * Example:
 *   node scripts/sync-example.mjs general-wallet approval-dialog vanilla
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(registryRoot, "../..");

const [exampleName, itemName, variant = "vanilla"] = process.argv.slice(2);

if (!exampleName || !itemName) {
  console.error(
    "Usage: node scripts/sync-example.mjs <example-name> <item-name> [variant]",
  );
  process.exit(1);
}

const sourceDir = path.join(registryRoot, "items", itemName, variant);
const targetDir = path.join(
  repoRoot,
  "examples",
  exampleName,
  "src",
  "ows",
  itemName,
);

if (!fs.existsSync(sourceDir)) {
  console.error(`Registry source not found: ${sourceDir}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const files = fs.readdirSync(sourceDir).filter((name) => !name.startsWith("."));
for (const file of files) {
  const from = path.join(sourceDir, file);
  const to = path.join(targetDir, file);
  fs.copyFileSync(from, to);
  console.log(`  ${path.relative(repoRoot, from)} → ${path.relative(repoRoot, to)}`);
}

console.log(`Synced ${itemName} (${variant}) → examples/${exampleName}/src/ows/${itemName}/`);
