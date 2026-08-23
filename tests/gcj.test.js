/**
 * Fixed-point assertions for WGS84 → GCJ-02.
 * Run: node --test tests/gcj.test.js
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { wgs84ToGcj02, outOfChina } = require("../scripts/lib/gcj.js");

// Shanghai: dLng ~ +0.004–0.006°, dLat often slightly negative (~-0.002°).
// Beijing: both deltas typically positive. Assert known fixed points.
const FIXTURES = [
  {
    name: "shanghai_people_square_wgs",
    wgs: { lng: 121.4737, lat: 31.2304 },
    // locked reference from this implementation (algorithm frozen)
    gcj: { lng: 121.47822305927693, lat: 31.22845773757727 },
    tol: 1e-9
  },
  {
    name: "beijing_tiananmen_wgs",
    wgs: { lng: 116.397, lat: 39.908 },
    gcj: { lng: 116.40324337854781, lat: 39.90940335390724 },
    tol: 1e-9
  },
  {
    name: "lingang_wgs",
    wgs: { lng: 121.9, lat: 30.9 },
    expectMinAbsDeltaLng: 0.003,
    expectMaxAbsDeltaLng: 0.012,
    expectMinAbsDeltaLat: 0.0005,
    expectMaxAbsDeltaLat: 0.006
  }
];

test("outOfChina true for mid-Atlantic", () => {
  assert.equal(outOfChina(-40, 30), true);
});

test("outOfChina false for Shanghai", () => {
  assert.equal(outOfChina(121.47, 31.23), false);
});

for (const f of FIXTURES) {
  if (f.gcj) {
    test(`wgs84ToGcj02 fixed point: ${f.name}`, () => {
      const g = wgs84ToGcj02(f.wgs.lng, f.wgs.lat);
      assert.ok(Math.abs(g.lng - f.gcj.lng) < f.tol, `lng ${g.lng}`);
      assert.ok(Math.abs(g.lat - f.gcj.lat) < f.tol, `lat ${g.lat}`);
    });
  } else {
    test(`wgs84ToGcj02 offset magnitude: ${f.name}`, () => {
      const g = wgs84ToGcj02(f.wgs.lng, f.wgs.lat);
      const dLng = Math.abs(g.lng - f.wgs.lng);
      const dLat = Math.abs(g.lat - f.wgs.lat);
      assert.ok(
        dLng >= f.expectMinAbsDeltaLng && dLng <= f.expectMaxAbsDeltaLng,
        `dLng=${dLng}`
      );
      assert.ok(
        dLat >= f.expectMinAbsDeltaLat && dLat <= f.expectMaxAbsDeltaLat,
        `dLat=${dLat}`
      );
    });
  }
}

test("wgs84ToGcj02 is deterministic", () => {
  const a = wgs84ToGcj02(121.5, 31.2);
  const b = wgs84ToGcj02(121.5, 31.2);
  assert.equal(a.lng, b.lng);
  assert.equal(a.lat, b.lat);
});

test("outside China is identity", () => {
  const g = wgs84ToGcj02(0, 0);
  assert.equal(g.lng, 0);
  assert.equal(g.lat, 0);
});

test("shanghai dLng positive (eastward offset)", () => {
  const g = wgs84ToGcj02(121.4737, 31.2304);
  assert.ok(g.lng > 121.4737);
});
