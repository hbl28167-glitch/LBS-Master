const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, "..", "public"));
const port = Number(process.argv[3] || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || "/").split("?")[0]);
  if (u === "/") u = "/index.html";
  const f = path.normalize(path.join(root, u.replace(/^\//, "")));
  if (!f.startsWith(root)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.readFile(f, (e, d) => {
    if (e) {
      res.writeHead(404);
      return res.end("not found " + u);
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(f).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(d);
  });
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.log("port " + port + " already in use — open http://127.0.0.1:" + port + "/");
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log("LBS-Master: " + root);
  console.log("Open: http://127.0.0.1:" + port + "/");
  console.log("Do NOT open index.html via file://");
});
