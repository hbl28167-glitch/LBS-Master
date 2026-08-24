/**
 * Build functional zones GeoJSON (GCJ-02).
 * zone_id FROZEN: sh:z:{type}:{slug}
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");
const { catalog } = require("./lib/zone-catalog");
const { ZONE_COLOR_TOKENS } = require("./lib/color-tokens");

const OUT_GJ = root("data", "processed", "zones_shanghai.geojson");
const OUT_JSON = root("data", "processed", "zones_shanghai.json");

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** ellipse ring in degrees around GCJ center */
function ellipseRing(lng, lat, rx_m, ry_m, rotDeg, n = 32) {
  const midLat = lat;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((midLat * Math.PI) / 180);
  const rx = rx_m / mPerDegLng;
  const ry = ry_m / mPerDegLat;
  const rot = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    const xr = x * cos - y * sin;
    const yr = x * sin + y * cos;
    ring.push([round6(lng + xr), round6(lat + yr)]);
  }
  return ring;
}

function styleFor(type, grade) {
  const tok = ZONE_COLOR_TOKENS[type] || ZONE_COLOR_TOKENS.rural;
  let fill = tok.fill;
  let opacity = 0.35;
  if (type === "retail") {
    if (grade === "premium") {
      fill = tok.fill;
      opacity = 0.45;
    } else if (grade === "mass") {
      fill = tok.fill_soft;
      opacity = 0.38;
    } else {
      fill = tok.fill_soft;
      opacity = 0.28;
    }
  } else if (type === "residential") {
    fill = tok.fill;
    if (grade === "dense_mass") opacity = 0.5;
    else if (grade === "improve") opacity = 0.42;
    else opacity = 0.38;
  } else if (type === "industrial") {
    fill = tok.fill;
    opacity = 0.4;
  } else if (type === "office") {
    fill = tok.fill_soft;
    opacity = 0.4;
  } else if (type === "hub") {
    fill = tok.fill;
    opacity = 0.42;
  } else if (type === "scenic") {
    fill = tok.fill_soft;
    opacity = 0.4;
  } else {
    opacity = 0.2;
  }
  return {
    color_token: type,
    fill,
    stroke: tok.stroke,
    fill_opacity: opacity
  };
}

function main() {
  const items = catalog();
  const features = [];
  const zones = [];
  const byType = {};
  const byBatch = {};

  for (const z of items) {
    const g = wgs84ToGcj02(z.lng_wgs, z.lat_wgs);
    const lng = round6(g.lng);
    const lat = round6(g.lat);
    const zone_id = `sh:z:${z.zone_type}:${z.slug}`;
    const style = styleFor(z.zone_type, z.grade);
    const ring = ellipseRing(lng, lat, z.rx_m, z.ry_m, z.rot_deg);
    const props = {
      zone_id,
      name: z.name,
      zone_type: z.zone_type,
      grade: z.grade,
      centroid_lng: lng,
      centroid_lat: lat,
      batch: z.batch,
      source: "public_name+schematic_aoi",
      labels: z.labels,
      ...style
    };
    features.push({
      type: "Feature",
      properties: props,
      geometry: { type: "Polygon", coordinates: [ring] }
    });
    zones.push({
      zone_id,
      name: z.name,
      zone_type: z.zone_type,
      grade: z.grade,
      centroid_lng: lng,
      centroid_lat: lat,
      batch: z.batch,
      source: props.source,
      labels: z.labels,
      color_token: style.color_token,
      fill: style.fill,
      stroke: style.stroke,
      fill_opacity: style.fill_opacity,
      rx_m: z.rx_m,
      ry_m: z.ry_m
    });
    byType[z.zone_type] = (byType[z.zone_type] || 0) + 1;
    byBatch[z.batch] = (byBatch[z.batch] || 0) + 1;
  }

  const fc = {
    type: "FeatureCollection",
    crs_note: "GCJ-02",
    zone_id_rule: "sh:z:{type}:{slug}",
    attribution:
      "Place names: public knowledge. Boundaries: schematic AOI for sandbox (not official planning red-lines). © LBS-Master synthetic geometry.",
    count: features.length,
    by_type: byType,
    by_batch: byBatch,
    features
  };

  const index = {
    version: "0.2.0",
    zone_id_rule: "sh:z:{type}:{slug}",
    crs: "GCJ-02",
    count: zones.length,
    by_type: byType,
    by_batch: byBatch,
    color_tokens: ZONE_COLOR_TOKENS,
    ui_default_layer: true,
    product_layer: true,
    zones,
    geojson: "data/processed/zones_shanghai.geojson"
  };

  fs.mkdirSync(path.dirname(OUT_GJ), { recursive: true });
  fs.writeFileSync(OUT_GJ, JSON.stringify(fc));
  fs.writeFileSync(OUT_JSON, JSON.stringify(index, null, 2));
  console.log(
    `zones: ${zones.length} type=${JSON.stringify(byType)} batch=${JSON.stringify(byBatch)} → ${OUT_GJ}`
  );
}

main();
