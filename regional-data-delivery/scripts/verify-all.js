"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const REGIONS = [
  "qiantan_xuhui_riverside",
  "xujiahui_caohejing",
  "hongqiao_hub",
  "zhangjiang",
  "lingang"
];

const required = [
  "processed/roads-v3.wgs84.geojson",
  "processed/roads-v3.gcj02.geojson",
  "processed/buildings.wgs84.geojson",
  "processed/buildings.gcj02.geojson",
  "processed/zones-v3.wgs84.geojson",
  "processed/zones-v3.gcj02.geojson",
  "processed/zones-v3-review.geojson",
  "processed/entities.json",
  "processed/scenario-metrics.json",
  "qc/road-qc.json",
  "qc/zone-qc.json",
  "qc/entity-qc.json",
  "region-readme.md",
  "raw/source-metadata.json"
];

function sha256(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function walk(dir, base, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, base, out);
    else {
      out.push({
        path: path.relative(base, p).replace(/\\/g, "/"),
        bytes: st.size,
        sha256: sha256(p)
      });
    }
  }
}

const errors = [];
const warnings = [];
const regionStatus = {};

for (const id of REGIONS) {
  const rdir = path.join(ROOT, "regions", id);
  if (!fs.existsSync(rdir)) {
    errors.push("missing region " + id);
    regionStatus[id] = "fail";
    continue;
  }
  for (const rel of required) {
    const p = path.join(rdir, rel);
    if (!fs.existsSync(p)) errors.push(id + " missing " + rel);
  }
  const rq = JSON.parse(fs.readFileSync(path.join(rdir, "qc/road-qc.json"), "utf8"));
  const zq = JSON.parse(fs.readFileSync(path.join(rdir, "qc/zone-qc.json"), "utf8"));
  const eq = JSON.parse(fs.readFileSync(path.join(rdir, "qc/entity-qc.json"), "utf8"));
  const statuses = [rq.status, zq.status, eq.status];
  if (statuses.includes("fail")) regionStatus[id] = "fail";
  else if (statuses.includes("conditional_pass")) regionStatus[id] = "conditional_pass";
  else regionStatus[id] = "pass";
  if (rq.giant_component_ratio < 0.95) errors.push(id + " road giant <0.95");
  if (zq.building_assignment_ratio < 0.95) errors.push(id + " zone assign <0.95");
  if (!(zq.by_type && zq.by_type.residential)) errors.push(id + " no residential zones");
  if (eq.residential_origin_count < 3) errors.push(id + " residential_origin <3");
  const sm = JSON.parse(fs.readFileSync(path.join(rdir, "processed/scenario-metrics.json"), "utf8"));
  if (!sm.rows || sm.rows.length < 3) errors.push(id + " scenario rows <3");
}

const files = [];
walk(ROOT, ROOT, files);
const manifest = {
  generated_at: new Date().toISOString(),
  root: "regional-data-delivery",
  file_count: files.length,
  files
};
fs.writeFileSync(path.join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2));

const summary = {
  generated_at: new Date().toISOString(),
  regions: regionStatus,
  error_count: errors.length,
  warning_count: warnings.length,
  errors,
  warnings,
  overall:
    errors.length === 0
      ? Object.values(regionStatus).includes("conditional_pass")
        ? "CONDITIONAL"
        : "PASS"
      : "FAIL"
};
fs.writeFileSync(path.join(ROOT, "qc-summary.json"), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
console.log("manifest files:", files.length);
process.exitCode = errors.length ? 1 : 0;
