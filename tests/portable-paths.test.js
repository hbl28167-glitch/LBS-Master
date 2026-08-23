/**
 * Fail if scripts/ or public/ source embeds drive-letter absolute paths.
 * Run: node --test tests/portable-paths.test.js
 * Or:  node tests/portable-paths.test.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["scripts", "public"];
const EXT_OK = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".html",
  ".css",
  ".json",
  ".md"
]);
const SKIP_NAMES = new Set([".gitkeep"]);
// Windows drive path or POSIX home absolute that looks machine-bound
const ABS_PATH_RE = /(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s'"`)]+/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "vendor") continue;
    if (SKIP_NAMES.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (EXT_OK.has(path.extname(ent.name).toLowerCase())) out.push(full);
  }
  return out;
}

function scanFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const hits = [];
  let m;
  const re = new RegExp(ABS_PATH_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    hits.push({ match: m[0], index: m.index });
  }
  return hits;
}

function run() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const violations = [];
  for (const file of files) {
    const hits = scanFile(file);
    for (const h of hits) {
      violations.push({
        file: path.relative(ROOT, file),
        match: h.match
      });
    }
  }
  return { filesScanned: files.length, violations };
}

const isMain =
  require.main === module ||
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (typeof require !== "undefined" && require.main === module) {
  const { filesScanned, violations } = run();
  if (violations.length) {
    console.error("portable-paths: FAIL — absolute paths found:");
    for (const v of violations) {
      console.error(`  ${v.file}: ${v.match}`);
    }
    process.exit(1);
  }
  console.log(`portable-paths: OK (${filesScanned} files scanned)`);
  process.exit(0);
}

// node:test harness
try {
  const { test } = require("node:test");
  const assert = require("node:assert/strict");
  test("scripts/ and public/ have no machine-absolute paths", () => {
    const { violations } = run();
    assert.equal(
      violations.length,
      0,
      violations.map((v) => `${v.file}: ${v.match}`).join("\n")
    );
  });
} catch {
  // node without --test already handled via require.main
}
