const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "public", "data", "regions");
const index = JSON.parse(fs.readFileSync(path.join(root, "index.json"), "utf8"));

test("five delivered regions are published", () => {
  assert.equal(index.regions.length, 5);
  assert.equal(new Set(index.regions.map((x) => x.region_id)).size, 5);
});

test("real-building regions expose building layers", () => {
  for (const id of ["qiantan_xuhui_riverside", "xujiahui_caohejing"]) {
    const meta = JSON.parse(fs.readFileSync(path.join(root, id, "meta.json"), "utf8"));
    assert.equal(meta.buildings_real, true);
    assert.ok(meta.buildings_visualized > 10000);
    assert.ok(meta.files.buildings);
    assert.ok(fs.existsSync(path.join(root, id, meta.files.buildings)));
  }
});

test("synthetic seed buildings are hidden by the quality gate", () => {
  for (const id of ["hongqiao_hub", "zhangjiang", "lingang"]) {
    const meta = JSON.parse(fs.readFileSync(path.join(root, id, "meta.json"), "utf8"));
    assert.equal(meta.status, "conditional");
    assert.equal(meta.buildings_real, false);
    assert.equal(meta.buildings_visualized, 0);
    assert.equal(meta.files.buildings, undefined);
    assert.ok(meta.synthetic_buildings_hidden > 0);
  }
});
