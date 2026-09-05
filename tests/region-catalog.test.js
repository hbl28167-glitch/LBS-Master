const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const catalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "static", "region_catalog.json"), "utf8")
);

test("region catalog exposes six unique interview regions", () => {
  assert.equal(catalog.regions.length, 6);
  assert.equal(new Set(catalog.regions.map((x) => x.region_id)).size, 6);
  assert.ok(catalog.regions.some((x) => x.region_id === "qiantan_xuhui_riverside"));
});

test("every region has a map target, business case and residential role", () => {
  for (const region of catalog.regions) {
    assert.equal(region.center.length, 2);
    assert.ok(Number.isFinite(region.center[0]));
    assert.ok(Number.isFinite(region.center[1]));
    assert.ok(region.zoom >= 10 && region.zoom <= 16);
    assert.ok(region.primary_case);
    assert.ok(region.resident_role);
    assert.match(region.status, /^(ready|conditional|preparing)$/);
  }
});

test("real-building pilots are marked ready after regional delivery", () => {
  const ready = catalog.regions.filter((x) => x.status === "ready");
  assert.deepEqual(
    ready.map((x) => x.region_id),
    ["lujiazui_bund", "qiantan_xuhui_riverside"]
  );
});
