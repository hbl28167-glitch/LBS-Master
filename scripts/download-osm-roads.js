/**
 * Tiled Overpass fetch → data/raw/osm/shanghai_highways_overpass.json
 * Resume: data/raw/osm/_tiles_progress.json
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { root } = require("./lib/paths");
const { SHANGHAI_BBOX_WGS84 } = require("./lib/bbox");

const RAW_DIR = root("data", "raw", "osm");
const OUT =
  process.env.LBS_OSM_OUT ||
  path.join(RAW_DIR, "shanghai_highways_overpass.json");
const PROGRESS =
  process.env.LBS_OSM_PROGRESS ||
  path.join(RAW_DIR, "_tiles_progress.json");
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];
// B2: motorway..tertiary + links (Overpass is fallback when no PBF extract)
const LEVELS =
  process.env.LBS_ROAD_LEVELS
    ? process.env.LBS_ROAD_LEVELS.split(",").map((s) => s.trim()).filter(Boolean).join("|")
    : "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link";

function httpPost(url, body, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const insecure =
      process.env.LBS_TLS_INSECURE === "1" ||
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
    const data = `data=${encodeURIComponent(body)}`;
    const req = lib.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(data),
          "User-Agent": "lbs-master-ws-b/0.1 (portfolio; ODbL)"
        },
        timeout: timeoutMs,
        rejectUnauthorized: !insecure
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 160)}`));
            return;
          }
          resolve(text);
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(data);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tiles(b, stepLat = 0.18, stepLng = 0.22) {
  const list = [];
  for (let lat = b.minLat; lat < b.maxLat; lat += stepLat) {
    for (let lng = b.minLng; lng < b.maxLng; lng += stepLng) {
      list.push({
        s: lat,
        w: lng,
        n: Math.min(b.maxLat, lat + stepLat),
        e: Math.min(b.maxLng, lng + stepLng)
      });
    }
  }
  return list;
}

function queryFor(t) {
  return `[out:json][timeout:75];(way["highway"~"^(${LEVELS})$"](${t.s},${t.w},${t.n},${t.e}););out geom;`;
}

function loadProgress() {
  if (!fs.existsSync(PROGRESS)) {
    return { done: {}, elements: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(PROGRESS, "utf8"));
  } catch {
    return { done: {}, elements: {} };
  }
}

function saveProgress(prog) {
  fs.writeFileSync(PROGRESS, JSON.stringify(prog));
}

function tileKey(t) {
  return `${t.s.toFixed(4)},${t.w.toFixed(4)},${t.n.toFixed(4)},${t.e.toFixed(4)}`;
}

async function fetchTile(t) {
  const q = queryFor(t);
  let lastErr;
  for (const ep of ENDPOINTS) {
    try {
      const text = await httpPost(ep, q, 100000);
      if (text.trimStart().startsWith("<")) throw new Error("HTML overpass error");
      const json = JSON.parse(text);
      if (!json.elements) throw new Error("no elements");
      return json.elements;
    } catch (e) {
      lastErr = e;
      await sleep(1200);
    }
  }
  throw lastErr || new Error("all endpoints failed");
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const b = SHANGHAI_BBOX_WGS84;
  const list = tiles(b);
  const prog = loadProgress();
  if (!prog.done) prog.done = {};
  if (!prog.elements) prog.elements = {};

  console.log(`tiles=${list.length} already_done=${Object.keys(prog.done).length}`);

  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const key = tileKey(t);
    if (prog.done[key]) {
      process.stdout.write(`[${i + 1}/${list.length}] skip ${key}\n`);
      continue;
    }
    process.stdout.write(`[${i + 1}/${list.length}] ${key} `);
    let ok = false;
    for (let attempt = 0; attempt < 5 && !ok; attempt++) {
      try {
        const els = await fetchTile(t);
        for (const el of els) {
          if (el.type === "way" && el.id != null) {
            prog.elements[String(el.id)] = el;
          }
        }
        prog.done[key] = { n: els.length, at: new Date().toISOString() };
        saveProgress(prog);
        console.log(`+${els.length} uniq=${Object.keys(prog.elements).length}`);
        ok = true;
        await sleep(1500);
      } catch (e) {
        console.log(`try${attempt + 1}:${e.message}`);
        await sleep(3000 * (attempt + 1));
      }
    }
    if (!ok) console.log("SKIP");
  }

  const elements = Object.values(prog.elements);
  const doc = {
    version: 0.6,
    generator: "lbs-master download-osm-roads.js",
    osm3s: { remark: "tiled overpass Shanghai highways" },
    elements
  };
  fs.writeFileSync(OUT, JSON.stringify(doc));
  console.log(
    `wrote ${OUT} ways=${elements.length} MB=${(fs.statSync(OUT).size / 1e6).toFixed(2)}`
  );
  if (elements.length < 100) {
    console.error("too few ways");
    process.exit(1);
  }
  // drop progress after success (raw json is enough; progress is huge)
  try {
    fs.unlinkSync(PROGRESS);
  } catch {
    /* ignore */
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
