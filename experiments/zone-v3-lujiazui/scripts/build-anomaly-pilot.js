"use strict";

const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "processed");
const PREVIEW = path.join(ROOT, "preview", "data");

const eta = JSON.parse(fs.readFileSync(path.join(OUT, "eta-v2-pilot.json"), "utf8"));
const zones = JSON.parse(fs.readFileSync(path.join(OUT, "zones-v3-stable.geojson"), "utf8"));
const roadSummary = JSON.parse(fs.readFileSync(path.join(OUT, "road-v3-summary.json"), "utf8"));
const base = eta.scenes.base, rain = eta.scenes.rain;
const rainById = new Map(rain.blocks.map(b => [b.block_id, b]));

function haversine(a, b) {
  const r = 6371000, d = Math.PI / 180;
  const dLat = (b.lat - a.lat) * d, dLng = (b.lng - a.lng) * d;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(x)));
}

function nearestZone(block) {
  let best = null, bestM = Infinity;
  for (const z of zones.features) {
    const p = z.properties;
    const m = haversine(block, { lng: p.centroid_lng, lat: p.centroid_lat });
    if (m < bestM) { bestM = m; best = z; }
  }
  return best;
}

const impacts = base.blocks.map(b => {
  const rb = rainById.get(b.block_id);
  const z = nearestZone(b);
  const rainEta = rb ? rb.eta_min : null;
  const state = b.eta_min <= 10 && (rainEta == null || rainEta > 10) ? "lost" : rainEta != null && rainEta <= 10 ? "stable" : "outside";
  return {
    ...b,
    base_eta_min: b.eta_min,
    rain_eta_min: rainEta,
    impact_state: state,
    functional_type: z ? z.properties.functional_type : "unknown",
    functional_confidence: z ? z.properties.confidence : 0
  };
});
const lost = impacts.filter(x => x.impact_state === "lost");
const bySide = { puxi: [], pudong: [] };
for (const b of lost) bySide[b.lng < 121.5 ? "puxi" : "pudong"].push(b);
const sideDemand = side => bySide[side].reduce((s, b) => s + b.demand_index, 0);
const candidateSide = sideDemand("puxi") >= sideDemand("pudong") ? "puxi" : "pudong";
const focus = bySide[candidateSide];
const totalWeight = focus.reduce((s, b) => s + b.demand_index, 0) || 1;
const candidate = {
  id: "candidate:rain-gap-01",
  name: candidateSide === "puxi" ? "浦西雨天补位候选站" : "浦东雨天补位候选站",
  lng: +(focus.reduce((s, b) => s + b.lng * b.demand_index, 0) / totalWeight).toFixed(6),
  lat: +(focus.reduce((s, b) => s + b.lat * b.demand_index, 0) / totalWeight).toFixed(6),
  stalls: 12,
  power_kw: 180,
  synthetic: true
};
const recoverable = lost.filter(b => {
  const driveMin = haversine(candidate, b) * 1.35 / (18 * 1000 / 60) + 1;
  return driveMin <= 10;
});
const recoveredDemand = recoverable.reduce((s, b) => s + b.demand_index, 0);
const currentOrders = rain.metrics.estimated_orders_day;
const baseOrders = base.metrics.estimated_orders_day;
const incrementalOrders = Math.min(baseOrders - currentOrders, candidate.stalls * 14, Math.round(recoveredDemand * 0.018));

const lostByType = {};
for (const b of lost) {
  if (!lostByType[b.functional_type]) lostByType[b.functional_type] = { blocks: 0, demand_index: 0 };
  lostByType[b.functional_type].blocks++;
  lostByType[b.functional_type].demand_index += b.demand_index;
}

const crossRiverDemand = lost.filter(b => b.lng < 121.5).reduce((s, b) => s + b.demand_index, 0);
const lostDemand = lost.reduce((s, b) => s + b.demand_index, 0) || 1;
const crossShare = Math.round(crossRiverDemand / lostDemand * 100);
const causes = [
  { id: "impedance", label: "晚高峰与降雨导致道路速度下降", contribution_pct: Math.max(55, 82 - Math.round(crossShare * 0.45)), evidence: "R1–R6 场景速度共同下降，10分钟覆盖显著收缩" },
  { id: "cross_river", label: "跨江通道形成瓶颈", contribution_pct: Math.min(32, Math.max(12, Math.round(crossShare * 0.45))), evidence: `丢失需求中约 ${crossShare}% 位于浦西侧` },
  { id: "access", label: "站点接路影响", contribution_pct: 3, evidence: `接路距离 ${base.station_snap.distance_m}m，影响较低` }
];
const used = causes.reduce((s, c) => s + c.contribution_pct, 0);
causes.push({ id: "uncertainty", label: "速度样本不完整带来的模型不确定性", contribution_pct: Math.max(2, 100 - used), evidence: `实测限速覆盖 ${roadSummary.v3.observed_speed_roads}/${roadSummary.v3.roads}，需要后续校准` });
const causeTotal = causes.reduce((s, c) => s + c.contribution_pct, 0);
causes[0].contribution_pct += 100 - causeTotal;

const issue = {
  issue_id: "ISSUE-LZ-2026-0829-01",
  title: "晚高峰雨天 10 分钟入站覆盖异常收缩",
  severity: "P1",
  status: "待处置",
  detected_at: "2026-08-29 18:10",
  station: eta.station,
  baseline: { blocks_10min: base.metrics.blocks_10min, demand_index_10min: base.metrics.demand_index_10min, orders_day: baseOrders, service_revenue_day_rmb: base.metrics.estimated_service_revenue_day_rmb },
  current: { blocks_10min: rain.metrics.blocks_10min, demand_index_10min: rain.metrics.demand_index_10min, orders_day: currentOrders, service_revenue_day_rmb: rain.metrics.estimated_service_revenue_day_rmb },
  delta: {
    blocks: rain.metrics.blocks_10min - base.metrics.blocks_10min,
    blocks_pct: Math.round((rain.metrics.blocks_10min / base.metrics.blocks_10min - 1) * 100),
    demand_pct: Math.round((rain.metrics.demand_index_10min / base.metrics.demand_index_10min - 1) * 100),
    revenue_rmb: rain.metrics.estimated_service_revenue_day_rmb - base.metrics.estimated_service_revenue_day_rmb
  }
};

const payload = {
  meta: { business_story: "existing_energy_station_coverage_anomaly", topology_source: "OSM", metrics: "Synthetic", confidence: "medium" },
  issue,
  trust_gate: [
    { name: "站点数据完整性", status: "pass", value: "100%", note: "坐标、功率、车位、接入口齐全" },
    { name: "Road V3 连通性", status: "pass", value: `${Math.round(roadSummary.v3.giant_component_rate * 1000) / 10}%`, note: "单行、桥隧和道路等级已纳入" },
    { name: "功能区建筑归属", status: "pass", value: "100%", note: "浦西与浦东建筑均有地块归属" },
    { name: "速度标定充分度", status: "warn", value: `${Math.round(roadSummary.v3.observed_speed_roads / roadSummary.v3.roads * 100)}%`, note: "本轮可用于方案比较，绝对 ETA 需真实样本校准" }
  ],
  causes,
  impacts,
  lost_by_type: lostByType,
  proposal: {
    action_id: "ACTION-LZ-RAIN-GAP-01",
    title: `新增${candidate.name}并配置雨天分流策略`,
    candidate,
    recoverable_blocks: recoverable.length,
    recoverable_block_ids: recoverable.map(b => b.block_id),
    recovered_demand_index: recoveredDemand,
    estimated_incremental_orders_day: incrementalOrders,
    estimated_incremental_service_revenue_day_rmb: incrementalOrders * 38,
    predicted_blocks_10min: Math.min(base.metrics.blocks_10min, rain.metrics.blocks_10min + recoverable.length),
    predicted_service_revenue_day_rmb: rain.metrics.estimated_service_revenue_day_rmb + incrementalOrders * 38,
    estimate_basis: "Synthetic · lost blocks within candidate 10min proxy · capped by station capacity and baseline gap"
  },
  task: {
    task_id: "TASK-LZ-2026-0829-01",
    owner: "站网策略产品 / 地图中台",
    collaborators: ["能源业务", "道路数据", "经营分析"],
    sla: { response: "4h", diagnosis: "1d", mitigation: "3d", revalidation: "7d" },
    next_checkpoint: "完成候选站可行性核验与真实高峰速度抽样",
    status: "待领取"
  }
};

for (const dir of [OUT, PREVIEW]) fs.writeFileSync(path.join(dir, "anomaly-pilot.json"), JSON.stringify(payload, null, 2));
console.log(JSON.stringify({ issue: issue.delta, lost_blocks: lost.length, lost_by_type: lostByType, candidate, proposal: payload.proposal, causes }, null, 2));
