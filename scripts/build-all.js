/**
 * Full pipeline: WS-B geo → WS-C synthetic → manifest.
 */
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const node = process.execPath;

function run(rel) {
  const script = path.join(ROOT, rel);
  console.log(`\n=== ${rel} ===`);
  const r = spawnSync(node, [script], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  if (r.status !== 0 && r.status != null) {
    console.error(`failed: ${rel} exit=${r.status}`);
    process.exit(r.status);
  }
}

run("scripts/build-anchors.js");
run("scripts/build-grids.js");
run("scripts/build-landuse.js");
// Prefer existing raw; if missing, try tiled download once.
{
  const fs = require("fs");
  const raw = path.join(ROOT, "data", "raw", "osm", "shanghai_highways_overpass.json");
  if (!fs.existsSync(raw) || fs.statSync(raw).size < 10000) {
    console.log("\n=== scripts/download-osm-roads.js (raw missing/small) ===");
    const r = spawnSync(node, [path.join(ROOT, "scripts/download-osm-roads.js")], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env
    });
    if (r.status !== 0 && r.status != null) {
      console.warn("download:osm failed; build-roads will fallback");
    }
  }
}
run("scripts/build-roads-pipeline.js");
run("scripts/verify-alignment.js");
run("scripts/build-synthetic.js");
run("scripts/verify-synthetic.js");
run("scripts/build-manifest.js");
run("scripts/copy-public-data.js");

console.log("\nbuild-all (geo + synthetic + public/data): done");
