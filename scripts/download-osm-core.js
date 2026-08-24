/**
 * Dense Overpass tiles for Shanghai urban core + Lingang (fill holes).
 * Writes data/raw/osm/shanghai_core_overpass.json (merge in build-roads).
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { root } = require("./lib/paths");

const RAW_DIR = root("data", "raw", "osm");
const OUT = path.join(RAW_DIR, "shanghai_core_overpass.json");
const PROGRESS = path.join(RAW_DIR, "_core_progress.json");

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter"
];

const LEVELS =
  "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link";

// Urban core + Pudong + Hongqiao + Lingang patches (small tiles)
const BOXES = [
  // Huangpu / Lujiazui / Jing'an
  { s: 31.18, w: 121.40, n: 31.28, e: 121.55 },
  { s: 31.18, w: 121.55, n: 31.28, e: 121.70 },
  // Xuhui / Changning / Hongqiao
  { s: 31.14, w: 121.28, n: 31.24, e: 121.42 },
  { s: 31.14, w: 121.42, n: 31.24, e: 121.55 },
  // Yangpu / Wujiaochang
  { s: 31.26, w: 121.48, n: 31.36, e: 121.62 },
  // Minhang / south
  { s: 31.05, w: 121.35, n: 31.18, e: 121.55 },
  // Pudong mid
  { s: 31.10, w: 121.55, n: 31.22, e: 121.75 },
  // Airport / south Pudong
  { s: 31.05, w: 121.70, n: 31.20, e: 121.90 },
  // Lingang
  { s: 30.82, w: 121.82, n: 30.98, e: 122.05 },
  // Anting / west
  { s: 31.22, w: 121.08, n: 31.35, e: 121.28 },
  // Baoshan
  { s: 31.32, w: 121.40, n: 31.45, e: 121.58 },
  // Songjiang
  { s: 30.98, w: 121.12, n: 31.12, e: 121.32 }
];

function httpPost(url, body, timeoutMs = 100000) {
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
          "User-Agent": "lbs-master-ws-b2/0.1"
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
            reject(new Error(`HTTP ${res.statusCode}`));
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

function query(b) {
  return `[out:json][timeout:90];(way["highway"~"^(${LEVELS})$"](${b.s},${b.w},${b.n},${b.e}););out geom;`;
}

function loadProg() {
  if (!fs.existsSync(PROGRESS)) return { done: {}, elements: {} };
  try {
    return JSON.parse(fs.readFileSync(PROGRESS, "utf8"));
  } catch {
    return { done: {}, elements: {} };
  }
}

async function fetchBox(b) {
  const q = query(b);
  let last;
  for (const ep of ENDPOINTS) {
    try {
      const text = await httpPost(ep, q, 110000);
      if (text.trimStart().startsWith("<")) throw new Error("HTML");
      const json = JSON.parse(text);
      if (!json.elements) throw new Error("no elements");
      return json.elements;
    } catch (e) {
      last = e;
      await sleep(1500);
    }
  }
  throw last || new Error("fail");
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const prog = loadProg();
  console.log(`core boxes=${BOXES.length} done=${Object.keys(prog.done).length}`);

  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    const key = `${b.s},${b.w},${b.n},${b.e}`;
    if (prog.done[key]) {
      console.log(`[${i + 1}] skip ${key}`);
      continue;
    }
    process.stdout.write(`[${i + 1}/${BOXES.length}] ${key} `);
    let ok = false;
    for (let t = 0; t < 5 && !ok; t++) {
      try {
        const els = await fetchBox(b);
        for (const el of els) {
          if (el.type === "way" && el.id != null) {
            prog.elements[String(el.id)] = el;
          }
        }
        prog.done[key] = els.length;
        fs.writeFileSync(PROGRESS, JSON.stringify(prog));
        console.log(`+${els.length} uniq=${Object.keys(prog.elements).length}`);
        ok = true;
        await sleep(2000);
      } catch (e) {
        console.log(`try${t + 1}:${e.message}`);
        await sleep(4000 * (t + 1));
      }
    }
    if (!ok) console.log("SKIP");
  }

  const elements = Object.values(prog.elements);
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      version: 0.6,
      generator: "download-osm-core.js",
      elements
    })
  );
  console.log(`wrote ${OUT} ways=${elements.length}`);
  if (elements.length < 500) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
