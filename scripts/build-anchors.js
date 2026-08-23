/**
 * Build data/static/anchors_shanghai.json from public WGS names → GCJ.
 */
const fs = require("fs");
const path = require("path");
const { root } = require("./lib/paths");
const { wgs84ToGcj02 } = require("./lib/gcj");

const OUT = root("data", "static", "anchors_shanghai.json");

/** Public WGS84 approx for well-known places (Shanghai + Lingang). */
const WGS_PLACES = [
  {
    id: "lujiazui",
    name: "陆家嘴",
    lng: 121.4998,
    lat: 31.2397,
    landuse: "office",
    labels: ["cbd", "finance"]
  },
  {
    id: "peoples_square",
    name: "人民广场",
    lng: 121.4737,
    lat: 31.2304,
    landuse: "hub",
    labels: ["metro_hub", "civic"]
  },
  {
    id: "hongqiao_hub",
    name: "虹桥枢纽",
    lng: 121.315,
    lat: 31.194,
    landuse: "hub",
    labels: ["airport", "rail"]
  },
  {
    id: "pudong_airport",
    name: "浦东国际机场",
    lng: 121.799,
    lat: 31.143,
    landuse: "hub",
    labels: ["airport"]
  },
  {
    id: "xujiahui",
    name: "徐家汇",
    lng: 121.436,
    lat: 31.188,
    landuse: "retail",
    labels: ["mall", "office_mix"]
  },
  {
    id: "jing_an_temple",
    name: "静安寺",
    lng: 121.4455,
    lat: 31.2235,
    landuse: "retail",
    labels: ["commercial"]
  },
  {
    id: "wujiaochang",
    name: "五角场",
    lng: 121.514,
    lat: 31.298,
    landuse: "retail",
    labels: ["university_area"]
  },
  {
    id: "zhangjiang",
    name: "张江高科技园区",
    lng: 121.601,
    lat: 31.203,
    landuse: "industrial_park",
    labels: ["tech_park"]
  },
  {
    id: "anting",
    name: "安亭汽车城",
    lng: 121.16,
    lat: 31.293,
    landuse: "industrial_park",
    labels: ["auto"]
  },
  {
    id: "dishui_lake",
    name: "滴水湖（临港）",
    lng: 121.925,
    lat: 30.905,
    landuse: "scenic",
    labels: ["lingang", "lake"]
  },
  {
    id: "lingang_new_city",
    name: "临港新片区主城区",
    lng: 121.908,
    lat: 30.893,
    landuse: "mixed",
    labels: ["lingang", "new_town"]
  },
  {
    id: "nanjing_east_road",
    name: "南京东路",
    lng: 121.484,
    lat: 31.236,
    landuse: "retail",
    labels: ["pedestrian_street"]
  },
  {
    id: "zhongshan_park",
    name: "中山公园",
    lng: 121.417,
    lat: 31.22,
    landuse: "mixed",
    labels: ["residential_mix"]
  },
  {
    id: "century_park",
    name: "世纪公园",
    lng: 121.555,
    lat: 31.218,
    landuse: "scenic",
    labels: ["park"]
  },
  {
    id: "songjiang_university",
    name: "松江大学城",
    lng: 121.213,
    lat: 31.05,
    landuse: "mixed",
    labels: ["education"]
  },
  {
    id: "baoshan_steel",
    name: "宝山工业带",
    lng: 121.487,
    lat: 31.403,
    landuse: "industrial_park",
    labels: ["industry"]
  }
];

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function main() {
  const anchors = WGS_PLACES.map((p) => {
    const g = wgs84ToGcj02(p.lng, p.lat);
    return {
      id: p.id,
      name: p.name,
      lng: round6(g.lng),
      lat: round6(g.lat),
      landuse: p.landuse,
      labels: p.labels,
      wgs84: { lng: p.lng, lat: p.lat }
    };
  });
  const doc = {
    crs: "GCJ-02",
    source:
      "public place names; WGS approx → scripts/lib/gcj.js wgs84ToGcj02",
    anchors
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2));
  console.log(`anchors: ${anchors.length} → ${OUT}`);
}

main();
