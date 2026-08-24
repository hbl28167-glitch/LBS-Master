/**
 * WS-B2: convert → snap → qc (fail stops build)
 */
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const node = process.execPath;

function run(rel, args = []) {
  console.log(`\n=== ${rel} ${args.join(" ")}===`);
  const r = spawnSync(node, [path.join(ROOT, rel), ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  if (r.status !== 0 && r.status != null) {
    console.error(`failed: ${rel} exit=${r.status}`);
    process.exit(r.status);
  }
}

run("scripts/build-roads.js");
run("scripts/repair-roads-snap.js");
run("scripts/qc-roads.js", ["--label", "after"]);
console.log("\nbuild:roads pipeline OK");
