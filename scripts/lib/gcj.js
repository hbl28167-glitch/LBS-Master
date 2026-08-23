/**
 * WGS84 → GCJ-02 (China encrypted offset model).
 * Algorithm mirrored from common open implementations; no business data.
 */

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let r =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  r +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  r +=
    ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  r +=
    ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) *
      2.0) /
    3.0;
  return r;
}

function transformLng(x, y) {
  let r =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  r +=
    ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) /
    3.0;
  r +=
    ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  r +=
    ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) *
      2.0) /
    3.0;
  return r;
}

/**
 * @param {number} lng WGS84 longitude
 * @param {number} lat WGS84 latitude
 * @returns {{ lng: number, lat: number }} GCJ-02
 */
function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lng: lng + dLng, lat: lat + dLat };
}

/**
 * Rough inverse (GCJ-02 → WGS84) via iteration; for alignment checks only.
 * @param {number} lng
 * @param {number} lat
 * @returns {{ lng: number, lat: number }}
 */
function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat };
  let wgsLng = lng;
  let wgsLat = lat;
  for (let i = 0; i < 5; i++) {
    const g = wgs84ToGcj02(wgsLng, wgsLat);
    wgsLng += lng - g.lng;
    wgsLat += lat - g.lat;
  }
  return { lng: wgsLng, lat: wgsLat };
}

module.exports = {
  wgs84ToGcj02,
  gcj02ToWgs84,
  outOfChina
};
