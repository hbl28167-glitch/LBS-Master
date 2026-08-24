/** 05.1 §3.3 zone color tokens */
const ZONE_COLOR_TOKENS = {
  retail: {
    fill: "#7C3AED",
    fill_soft: "#A78BFA",
    stroke: "#5B21B6",
    label_zh: "商业/商圈"
  },
  residential: {
    fill: "#F5F0E8",
    fill_soft: "#EDE6DC",
    stroke: "#C4B8A8",
    label_zh: "住宅"
  },
  office: {
    fill: "#0D9488",
    fill_soft: "#5EEAD4",
    stroke: "#0F766E",
    label_zh: "办公/产业"
  },
  industrial: {
    fill: "#93C5FD",
    fill_soft: "#BFDBFE",
    stroke: "#3B82F6",
    label_zh: "工业"
  },
  hub: {
    fill: "#FBBF24",
    fill_soft: "#FDE68A",
    stroke: "#D97706",
    label_zh: "枢纽"
  },
  scenic: {
    fill: "#EA580C",
    fill_soft: "#FDBA74",
    stroke: "#C2410C",
    label_zh: "文旅"
  },
  rural: {
    fill: "#E5E7EB",
    fill_soft: "#F3F4F6",
    stroke: "#9CA3AF",
    label_zh: "农田/空旷"
  }
};

module.exports = { ZONE_COLOR_TOKENS };
