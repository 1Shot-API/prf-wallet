#!/usr/bin/env node
/**
 * Build this example the way an integrator would: from `npm pack` tarballs
 * (not workspace links) in a temp dir outside the monorepo, then `next build`
 * and server-render `/` to prove SSR does not touch `window`.
 *
 * Usage: npm run verify:packed -w @1shotapi/ows-example-wagmi-next
 *        KEEP=1 … to keep the temp app for `npm run dev` / browser testing.
 */
import { execFileSync, spawn } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exampleDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(exampleDir, "../..");
const workDir = mkdtempSync(join(tmpdir(), "ows-wagmi-next-"));
const packDir = join(workDir, "packs");
const appDir = join(workDir, "app");

const PACKAGES = [
  "@1shotapi/ows-types",
  "@1shotapi/ows-provider",
  "@1shotapi/wagmi-connector",
];

function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(" ")}  (${cwd})`);
  return execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim();
}

for (const name of PACKAGES) run("npm", ["run", "build", "-w", name], repoRoot);

mkdirSync(packDir, { recursive: true });
const tarballs = {};
for (const name of PACKAGES) {
  const out = run(
    "npm",
    ["pack", "-w", name, "--pack-destination", packDir, "--json"],
    repoRoot,
  );
  const [{ filename }] = JSON.parse(out);
  tarballs[name] = `file:${join(packDir, filename)}`;
}

cpSync(exampleDir, appDir, {
  recursive: true,
  filter: (src) =>
    !/[\\/](node_modules|\.next|scripts)([\\/]|$)/.test(src.slice(exampleDir.length)),
});

const pkgPath = join(appDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.name = "wagmi-next-packed";
delete pkg.scripts["verify:packed"];
pkg.dependencies["@1shotapi/ows-provider"] = tarballs["@1shotapi/ows-provider"];
pkg.dependencies["@1shotapi/wagmi-connector"] =
  tarballs["@1shotapi/wagmi-connector"];
pkg.overrides = { "@1shotapi/ows-types": tarballs["@1shotapi/ows-types"] };
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// Unreleased tarballs carry pre-`changeset version` numbers, so the connector's
// `@1shotapi/ows-provider` peer range can't match them yet.
console.warn(
  "\nInstalling with --legacy-peer-deps: local packages are not version-bumped until release.",
);
run(
  "npm",
  ["install", "--no-audit", "--no-fund", "--legacy-peer-deps"],
  appDir,
);
run("npx", ["next", "build"], appDir);

const port = 3917;
const server = spawn("npx", ["next", "start", "-p", String(port)], {
  cwd: appDir,
  stdio: "ignore",
});
try {
  let html = "";
  for (let attempt = 0; attempt < 40 && !html; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    html = await fetch(`http://localhost:${port}/`)
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
  }
  if (!html.includes("1Shot Wallet × wagmi")) {
    throw new Error("SSR render of / did not return the example page");
  }
  console.log(`\nSSR OK: GET / rendered (${html.length} bytes)`);
} finally {
  server.kill();
}

if (process.env.KEEP) {
  console.log(`\nKept packed app at ${appDir} — run \`npm run dev\` there.`);
} else {
  rmSync(workDir, { recursive: true, force: true });
}
