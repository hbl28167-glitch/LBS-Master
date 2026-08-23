/**
 * Shanghai MVP bbox (WGS84), including Lingang (临港).
 * Slightly padded for grid edges.
 */
const SHANGHAI_BBOX_WGS84 = {
  minLng: 120.85,
  minLat: 30.67,
  maxLng: 122.2,
  maxLat: 31.88
};

/** Default cell edge length in metres (sparse for volume control). */
const DEFAULT_CELL_M = 1000;

module.exports = {
  SHANGHAI_BBOX_WGS84,
  DEFAULT_CELL_M
};
