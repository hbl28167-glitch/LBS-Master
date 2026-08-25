/**
 * Build functional zones GeoJSON (GCJ-02).
 * zone_id FROZEN: sh:z:{type}:{slug}
 * Geometry v2: road-aligned convex hull from roads_gcj (not smooth ellipse).
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");
const { catalog } = require("./lib/zone-catalog");
const { ZONE_COLOR_TOKENS } = require("./lib/color-tokens");
const {
  buildRoadPointIndex,
  zonePolygonFromRoads,
  round6
} = require("./lib/zone-geom");

const OUT_GJ = root("data", "processed", "zones_shanghai.geojson");
const OUT_JSON = root("data", "processed", "zones_shanghai.json");
const ROADS = root("data", "processed", "roads_gcj.geojson");

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
  let roadIndex = null;
  let roadsNote = "missing roads_gcj — irregular fallback only";
  if (fs.existsSync(ROADS)) {
    console.log("loading roads for zone hulls…");
    const roadsFc = JSON.parse(fs.readFileSync(ROADS, "utf8"));
    roadIndex = buildRoadPointIndex(roadsFc, {
      cellDeg: 0.012,
      sampleStepM: 90,
      skipLink: true
    });
    roadsNote =
      "road samples=" +
      roadIndex.count +
      " from data/processed/roads_gcj.geojson";
    console.log("  " + roadsNote);
  } else {
    console.warn("WARN: " + ROADS + " not found; zones use irregular fallback");
  }

  const items = catalog();
  const features = [];
  const zones = [];
  const byType = {};
  const byBatch = {};
  const byMethod = {};

  for (const z of items) {
    const g = wgs84ToGcj02(z.lng_wgs, z.lat_wgs);
    const lng = round6(g.lng);
    const lat = round6(g.lat);
    const zone_id = `sh:z:${z.zone_type}:${z.slug}`;
    const style = styleFor(z.zone_type, z.grade);
    const geom = zonePolygonFromRoads(
      lng,
      lat,
      z.rx_m,
      z.ry_m,
      z.rot_deg,
      zone_id,
      roadIndex
    );
    byMethod[geom.method] = (byMethod[geom.method] || 0) + 1;

    const props = {
      zone_id,
      name: z.name,
      zone_type: z.zone_type,
      grade: z.grade,
      centroid_lng: lng,
      centroid_lat: lat,
      batch: z.batch,
      source: "public_name+road_aligned_aoi",
      geometry_method: geom.method,
      road_pts_used: geom.road_pts,
      labels: z.labels,
      ...style
    };
    features.push({
      type: "Feature",
      properties: props,
      geometry: { type: "Polygon", coordinates: [geom.ring] }
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
      geometry_method: geom.method,
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
    geometry_version: "v2_road_aligned",
    attribution:
      "Place names: public knowledge. Boundaries: road-aligned schematic AOI from OSM road skeleton (not official planning red-lines). Road geometry © OpenStreetMap contributors. © LBS-Master.",
    roads_note: roadsNote,
    count: features.length,
    by_type: byType,
    by_batch: byBatch,
    by_geometry_method: byMethod,
    features
  };

  const index = {
    version: "0.3.0",
    zone_id_rule: "sh:z:{type}:{slug}",
    crs: "GCJ-02",
    geometry_version: "v2_road_aligned",
    count: zones.length,
    by_type: byType,
    by_batch: byBatch,
    by_geometry_method: byMethod,
    color_tokens: ZONE_COLOR_TOKENS,
    ui_default_layer: true,
    product_layer: true,
    note:
      "Polygons from nearby roads_gcj convex hull (inflate). zone_id frozen. Ellipse default removed.",
    zones,
    geojson: "data/processed/zones_shanghai.geojson"
  };

  fs.mkdirSync(path.dirname(OUT_GJ), { recursive: true });
  fs.writeFileSync(OUT_GJ, JSON.stringify(fc));
  fs.writeFileSync(OUT_JSON, JSON.stringify(index, null, 2));
  console.log(
    `zones: ${zones.length} method=${JSON.stringify(byMethod)} type=${JSON.stringify(byType)} → ${OUT_GJ}`
  );
}

main();
