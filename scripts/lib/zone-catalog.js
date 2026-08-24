/**
 * Shanghai functional zones catalog (public names, approx WGS centers).
 * Geometry is schematic AOI around center (not official red-line).
 * batch1 = core demo coverage; batch2 = wider city fill.
 */
// [slug, name_zh, type, grade|null, lngW, latW, rx_m, ry_m, rot_deg, batch, labels[]]
const ROWS = [
  // —— retail premium ——
  ["nanjing_east", "南京东路", "retail", "premium", 121.484, 31.236, 900, 350, 5, "batch1", ["pedestrian"]],
  ["nanjing_west", "南京西路", "retail", "premium", 121.455, 31.23, 1100, 400, 0, "batch1", ["luxury"]],
  ["jingan_kerry", "静安嘉里中心", "retail", "premium", 121.448, 31.224, 450, 400, 0, "batch1", []],
  ["xintiandi", "新天地", "retail", "premium", 121.475, 31.22, 500, 450, 10, "batch1", []],
  ["lujiazui_retail", "陆家嘴商圈", "retail", "premium", 121.505, 31.238, 800, 700, 0, "batch1", ["cbd"]],
  ["qiantan_taikoo", "前滩太古里", "retail", "premium", 121.48, 31.16, 550, 500, 0, "batch1", []],
  ["ifc_shanghai", "上海IFC", "retail", "premium", 121.498, 31.236, 350, 300, 0, "batch1", []],
  ["iapm", "环贸iapm", "retail", "premium", 121.456, 31.218, 400, 350, 0, "batch1", []],
  ["hkri", "静安嘉里·久光", "retail", "premium", 121.45, 31.226, 400, 320, 0, "batch1", []],
  ["riverside_pass", "瑞虹天地太阳宫", "retail", "premium", 121.515, 31.27, 450, 400, 0, "batch2", []],
  // —— retail mass ——
  ["xujiahui", "徐家汇", "retail", "mass", 121.436, 31.188, 900, 800, 0, "batch1", ["mall"]],
  ["wujiaochang", "五角场", "retail", "mass", 121.514, 31.298, 1000, 900, 0, "batch1", ["university"]],
  ["zhongshan_park", "中山公园", "retail", "mass", 121.417, 31.22, 850, 700, 0, "batch1", []],
  ["global_harbor", "环球港", "retail", "mass", 121.41, 31.235, 500, 450, 0, "batch1", []],
  ["daning", "大宁国际", "retail", "mass", 121.455, 31.28, 700, 600, 0, "batch1", []],
  ["qibao", "七宝", "retail", "mass", 121.35, 31.155, 700, 600, 0, "batch2", []],
  ["jinqiao", "金桥国际", "retail", "mass", 121.605, 31.26, 800, 700, 0, "batch2", []],
  ["chuansha", "川沙", "retail", "mass", 121.7, 31.19, 700, 600, 0, "batch2", []],
  ["songjiang_thames", "松江泰晤士小镇商圈", "retail", "mass", 121.22, 31.03, 600, 500, 0, "batch2", []],
  ["jiading_gucun", "嘉定新城", "retail", "mass", 121.25, 31.38, 800, 700, 0, "batch2", []],
  ["minhang_qixin", "七宝万科广场", "retail", "mass", 121.355, 31.15, 500, 450, 0, "batch2", []],
  ["hongqiao_airport_retail", "虹桥天地", "retail", "mass", 121.32, 31.195, 600, 500, 0, "batch1", ["hub_adj"]],
  ["lujiazui_century", "世纪大道商带", "retail", "mass", 121.53, 31.23, 1200, 400, 20, "batch1", []],
  ["baoshan_wusong", "吴淞口商圈", "retail", "mass", 121.5, 31.38, 700, 550, 0, "batch2", []],
  ["fengxian_nanqiao", "南桥", "retail", "mass", 121.46, 30.92, 800, 650, 0, "batch2", []],
  ["qingpu_xujing", "徐泾", "retail", "mass", 121.28, 31.18, 700, 550, 0, "batch2", []],
  ["pudong_kangqiao", "康桥", "retail", "mass", 121.58, 31.12, 700, 600, 0, "batch2", []],
  ["yangpu_kongjiang", "控江路", "retail", "mass", 121.53, 31.28, 800, 450, 0, "batch2", []],
  ["putuo_changshou", "长寿路", "retail", "mass", 121.44, 31.24, 700, 400, 0, "batch2", []],
  ["huangpu_huaihai", "淮海中路", "retail", "premium", 121.47, 31.22, 1000, 350, 5, "batch1", []],
  // —— retail community ——
  ["community_jiangwan", "江湾社区配套", "retail", "community", 121.51, 31.32, 500, 400, 0, "batch2", []],
  ["community_zhangjiang", "张江社区商业", "retail", "community", 121.6, 31.2, 550, 450, 0, "batch2", []],
  ["community_sanlin", "三林社区", "retail", "community", 121.52, 31.14, 550, 450, 0, "batch2", []],
  ["community_gumei", "古美社区", "retail", "community", 121.4, 31.14, 500, 400, 0, "batch2", []],
  ["community_pengpu", "彭浦社区", "retail", "community", 121.45, 31.3, 500, 400, 0, "batch2", []],
  ["community_lingang", "临港滴水湖配套商业", "retail", "community", 121.92, 30.9, 700, 600, 0, "batch1", ["lingang"]],
  ["community_anting", "安亭社区", "retail", "community", 121.16, 31.29, 500, 400, 0, "batch2", []],
  ["community_zhoupu", "周浦", "retail", "community", 121.58, 31.12, 500, 400, 0, "batch2", []],
  ["community_beicai", "北蔡", "retail", "community", 121.55, 31.18, 500, 400, 0, "batch2", []],
  ["community_huamu", "花木", "retail", "community", 121.55, 31.21, 450, 400, 0, "batch2", []],

  // —— residential dense_mass ——
  ["res_putuo_zhenguang", "真光路居住区", "residential", "dense_mass", 121.38, 31.25, 1200, 1000, 0, "batch1", []],
  ["res_yangpu_kongjiang", "控江杨浦居住带", "residential", "dense_mass", 121.54, 31.275, 1400, 900, 0, "batch1", []],
  ["res_minhang_gumei", "古美居住区", "residential", "dense_mass", 121.395, 31.145, 1300, 1000, 0, "batch1", []],
  ["res_pudong_sanlin", "三林居住区", "residential", "dense_mass", 121.51, 31.13, 1400, 1100, 0, "batch1", []],
  ["res_baoshan_gucun", "顾村居住区", "residential", "dense_mass", 121.37, 31.35, 1500, 1200, 0, "batch2", []],
  ["res_jiading_nanxiang", "南翔居住区", "residential", "dense_mass", 121.32, 31.3, 1200, 1000, 0, "batch2", []],
  ["res_songjiang_xincheng", "松江新城居住", "residential", "dense_mass", 121.23, 31.03, 1400, 1100, 0, "batch2", []],
  ["res_qingpu_xujing", "徐泾居住区", "residential", "dense_mass", 121.27, 31.19, 1100, 900, 0, "batch2", []],
  ["res_fengxian_nanqiao", "南桥居住区", "residential", "dense_mass", 121.45, 30.93, 1300, 1000, 0, "batch2", []],
  ["res_jinshan_zhujing", "朱泾居住", "residential", "dense_mass", 121.16, 30.9, 1000, 800, 0, "batch2", []],
  ["res_pudong_chuansha", "川沙居住", "residential", "dense_mass", 121.7, 31.2, 1200, 1000, 0, "batch2", []],
  ["res_hongkou_sichuan", "四川北路居住", "residential", "dense_mass", 121.485, 31.26, 900, 800, 0, "batch1", []],
  ["res_xuhui_caohejing_res", "漕河泾周边居住", "residential", "dense_mass", 121.4, 31.17, 1000, 800, 0, "batch1", []],
  ["res_changning_tianshan", "天山居住", "residential", "dense_mass", 121.4, 31.21, 1000, 800, 0, "batch1", []],
  ["res_yangpu_wujiaochang_res", "五角场周边居住", "residential", "dense_mass", 121.52, 31.31, 1100, 900, 0, "batch1", []],
  ["res_pudong_zhangjiang_res", "张江居住", "residential", "dense_mass", 121.61, 31.19, 1200, 1000, 0, "batch2", []],
  // —— residential improve ——
  ["res_jingan_west", "静安西部改善", "residential", "improve", 121.43, 31.23, 800, 700, 0, "batch1", []],
  ["res_xuhui_hengshan", "衡山路居住", "residential", "improve", 121.45, 31.2, 700, 600, 0, "batch1", []],
  ["res_pudong_lianyang", "联洋", "residential", "improve", 121.55, 31.23, 900, 800, 0, "batch1", []],
  ["res_changning_gubei", "古北", "residential", "improve", 121.4, 31.2, 900, 750, 0, "batch1", []],
  ["res_minhang_qibao_imp", "七宝改善", "residential", "improve", 121.36, 31.16, 900, 700, 0, "batch2", []],
  ["res_pudong_huamu_imp", "花木改善", "residential", "improve", 121.56, 31.21, 800, 700, 0, "batch1", []],
  ["res_yangpu_xinjiangwan", "新江湾城", "residential", "improve", 121.52, 31.33, 1000, 900, 0, "batch2", []],
  ["res_qingpu_zhujiajiao_edge", "朱家角镇区居住", "residential", "improve", 121.05, 31.11, 800, 700, 0, "batch2", []],
  // —— residential premium_low ——
  ["res_xuhui_french", "徐汇衡复风貌区", "residential", "premium_low", 121.455, 31.205, 600, 500, 0, "batch1", []],
  ["res_jingan_bubbling", "静安别墅带", "residential", "premium_low", 121.445, 31.225, 500, 400, 0, "batch1", []],
  ["res_pudong_lujiazui_apt", "陆家嘴滨江公寓", "residential", "premium_low", 121.51, 31.24, 700, 400, 15, "batch1", []],
  ["res_changning_hongqiao_villa", "虹桥别墅区", "residential", "premium_low", 121.38, 31.2, 800, 600, 0, "batch2", []],
  ["res_minhang_qibao_villa", "七宝/华漕低密", "residential", "premium_low", 121.33, 31.18, 900, 700, 0, "batch2", []],
  ["res_songjiang_sheshan", "佘山低密", "residential", "premium_low", 121.2, 31.1, 1200, 900, 0, "batch2", ["scenic_adj"]],

  // —— office ——
  ["office_lujiazui", "陆家嘴金融城", "office", null, 121.505, 31.24, 1200, 1000, 0, "batch1", ["cbd", "finance"]],
  ["office_people_sq", "人民广场办公", "office", null, 121.475, 31.232, 700, 600, 0, "batch1", []],
  ["office_hongqiao_cbd", "虹桥商务区", "office", null, 121.31, 31.2, 1400, 1100, 0, "batch1", ["hub_adj"]],
  ["office_zhangjiang", "张江科学城", "office", null, 121.6, 31.2, 1800, 1500, 0, "batch1", ["tech"]],
  ["office_caohejing", "漕河泾开发区", "office", null, 121.4, 31.17, 1400, 1100, 0, "batch1", ["tech"]],
  ["office_xujiahui", "徐家汇办公", "office", null, 121.437, 31.19, 700, 600, 0, "batch1", []],
  ["office_north_bund", "北外滩", "office", null, 121.5, 31.25, 900, 600, 0, "batch1", []],
  ["office_qiantan", "前滩", "office", null, 121.475, 31.155, 1000, 800, 0, "batch1", []],
  ["office_new_jiangwan", "新江湾城办公", "office", null, 121.515, 31.325, 800, 600, 0, "batch2", []],
  ["office_jinqiao", "金桥出口加工区办公", "office", null, 121.62, 31.26, 1200, 1000, 0, "batch2", []],
  ["office_lingang", "临港新片区办公", "office", null, 121.91, 30.89, 1500, 1200, 0, "batch1", ["lingang"]],
  ["office_suzhou_creek", "苏河湾", "office", null, 121.47, 31.245, 700, 450, 0, "batch1", []],
  ["office_wujiaochang", "创智天地", "office", null, 121.51, 31.3, 700, 550, 0, "batch1", []],
  ["office_minhang_zizhu", "紫竹高新区", "office", null, 121.43, 31.03, 1200, 1000, 0, "batch2", []],
  ["office_jiading_auto", "嘉定汽车城研发", "office", null, 121.18, 31.3, 1100, 900, 0, "batch2", []],

  // —— industrial ——
  ["ind_baoshan_steel", "宝山工业带", "industrial", null, 121.49, 31.4, 2200, 1600, 0, "batch1", []],
  ["ind_jinshan_chem", "金山石化周边", "industrial", null, 121.34, 30.72, 2000, 1500, 0, "batch2", []],
  ["ind_waigaoqiao", "外高桥保税区", "industrial", null, 121.6, 31.35, 1800, 1400, 0, "batch1", ["port"]],
  ["ind_lingang_equip", "临港装备产业区", "industrial", null, 121.95, 30.88, 2000, 1600, 0, "batch1", ["lingang"]],
  ["ind_jiading_auto", "安亭汽车产业", "industrial", null, 121.16, 31.29, 1600, 1200, 0, "batch2", []],
  ["ind_qingpu_ind", "青浦工业园区", "industrial", null, 121.12, 31.15, 1500, 1200, 0, "batch2", []],
  ["ind_songjiang_ind", "松江工业区", "industrial", null, 121.25, 31.0, 1600, 1300, 0, "batch2", []],
  ["ind_fengxian_ind", "奉贤工业综合开发区", "industrial", null, 121.52, 30.88, 1700, 1400, 0, "batch2", []],
  ["ind_pudong_kangqiao", "康桥工业区", "industrial", null, 121.6, 31.1, 1400, 1100, 0, "batch2", []],
  ["ind_minhang_dev", "闵行经济技术开发区", "industrial", null, 121.38, 31.05, 1500, 1200, 0, "batch2", []],

  // —— hub ——
  ["hub_hongqiao", "虹桥综合交通枢纽", "hub", null, 121.315, 31.194, 1600, 1200, 0, "batch1", ["airport", "rail"]],
  ["hub_pudong_airport", "浦东国际机场", "hub", null, 121.8, 31.14, 2200, 1600, 0, "batch1", ["airport"]],
  ["hub_shanghai_station", "上海站", "hub", null, 121.455, 31.25, 700, 500, 0, "batch1", ["rail"]],
  ["hub_shanghai_south", "上海南站", "hub", null, 121.43, 31.155, 800, 600, 0, "batch1", ["rail"]],
  ["hub_shanghai_hongqiao_rail", "虹桥火车站", "hub", null, 121.32, 31.194, 900, 600, 0, "batch1", ["rail"]],
  ["hub_people_sq_metro", "人民广场地铁枢纽", "hub", null, 121.475, 31.23, 400, 350, 0, "batch1", ["metro"]],
  ["hub_century_ave", "世纪大道换乘", "hub", null, 121.527, 31.23, 400, 300, 0, "batch1", ["metro"]],
  ["hub_lingang_drop", "临港滴水湖站", "hub", null, 121.93, 30.907, 500, 400, 0, "batch1", ["lingang", "rail"]],

  // —— scenic ——
  ["scenic_the_bund", "外滩", "scenic", null, 121.49, 31.24, 600, 1200, 90, "batch1", ["waterfront"]],
  ["scenic_century_park", "世纪公园", "scenic", null, 121.555, 31.218, 1200, 1000, 0, "batch1", ["park"]],
  ["scenic_dishui", "滴水湖", "scenic", null, 121.925, 30.905, 1400, 1400, 0, "batch1", ["lingang", "lake"]],
  ["scenic_yuyuan", "豫园", "scenic", null, 121.492, 31.227, 350, 300, 0, "batch1", []],
  ["scenic_xujiahui_park", "徐家汇公园", "scenic", null, 121.44, 31.195, 400, 300, 0, "batch2", []],
  ["scenic_gongqing", "共青森林公园", "scenic", null, 121.55, 31.32, 1000, 800, 0, "batch2", []],
  ["scenic_sheshan", "佘山国家旅游度假区", "scenic", null, 121.195, 31.1, 1600, 1200, 0, "batch2", []],
  ["scenic_zhujiajiao", "朱家角古镇", "scenic", null, 121.05, 31.11, 900, 700, 0, "batch2", []],
  ["scenic_oriental_pearl", "小陆家嘴观光", "scenic", null, 121.5, 31.24, 400, 350, 0, "batch1", []],
  ["scenic_fuxing_park", "复兴公园", "scenic", null, 121.47, 31.22, 300, 250, 0, "batch2", []],

  // —— rural / open (coarse heat) ——
  ["rural_chongming_east", "崇明东部农田", "rural", null, 121.7, 31.6, 5000, 3500, 0, "batch2", []],
  ["rural_qingpu_west", "青浦西部农田", "rural", null, 120.98, 31.12, 4000, 3000, 0, "batch2", []],
  ["rural_jinshan_south", "金山南部空旷", "rural", null, 121.3, 30.75, 3500, 2500, 0, "batch2", []],
  ["rural_fengxian_east", "奉贤东部农田", "rural", null, 121.7, 30.9, 3500, 2500, 0, "batch2", []],
  ["rural_pudong_south_open", "浦东南部空旷带", "rural", null, 121.75, 30.95, 3000, 2000, 0, "batch2", []]
];

function catalog() {
  return ROWS.map((r) => {
    const [
      slug,
      name,
      zone_type,
      grade,
      lng,
      lat,
      rx_m,
      ry_m,
      rot_deg,
      batch,
      labels
    ] = r;
    return {
      slug,
      name,
      zone_type,
      grade,
      lng_wgs: lng,
      lat_wgs: lat,
      rx_m,
      ry_m,
      rot_deg: rot_deg || 0,
      batch,
      labels: labels || []
    };
  });
}

module.exports = { catalog, ROWS };
