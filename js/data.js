/**
 * EA839 拆解可视化 — 静态内容数据
 * 功能介绍 / 应用车型 / 技术规格 / 快捷键
 *
 * 车型与参数依据大众集团及保时捷公开技术资料整理，不同年款 / 市场存在差异，
 * 页面内数据仅供工程演示与教学参考。
 */

const svg = (inner, c = '#48dcff') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.3"
        stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

/* ================= 功能介绍 ================= */
export const FEATURES = [
  {
    tag: '核心',
    icon: svg('<path d="M12 2 20 7v10l-8 5-8-5V7z"/><path d="M12 7v10M7 9.5 17 9.5"/><path d="M4.5 6.5 12 11l7.5-4.5"/>'),
    title: '全机交互拆解',
    desc: '点击三维模型中任意部件即刻触发该部件的独立拆解动画；底部滑块可连续控制整机拆解程度 0–100%，直观呈现 90° V8 的装配层级。',
  },
  {
    tag: '核心',
    icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 12 19 8"/><circle cx="12" cy="12" r="2.2"/>'),
    title: '曲柄连杆运转演示',
    desc: '按 V8 真实点火次序与曲拐相位驱动曲轴、活塞、连杆与涡轮叶轮，转速 0–2000 rpm 无级可调，配合缸内火焰辉光还原工作循环。',
  },
  {
    tag: '核心',
    icon: svg('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    title: '31 项部件 BOM 清单',
    desc: '机体、曲柄连杆、配气、正时、进气增压、排气、润滑冷却、电气点火、悬置附件九大总成分组，中英双语名称，支持模糊搜索秒级定位。',
  },
  {
    tag: '核心',
    icon: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M8.5 11h5M11 8.5v5"/>'),
    title: '部件技术档案',
    desc: '每个部件附带材料牌号、成形工艺、关键公差与性能参数，并给出工程视角的设计说明（如 PLS 涂层缸孔、hot-V 布置、干式油底壳等）。',
  },
  {
    tag: 'NEW',
    icon: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4" stroke-dasharray="2 2"/>'),
    title: 'X 光透视模式',
    desc: '一键将选中部件以外的全部零件半透明化，视线可直达发动机内部，用于观察水道、油道、活塞顶与气门的相对位置关系。快捷键 X。',
  },
  {
    tag: 'NEW',
    icon: svg('<path d="M12 2v20"/><path d="M4 6h16"/><path d="M6 6a6 6 0 0 0 12 0"/><path d="M3 18h18"/>'),
    title: '剖切视图',
    desc: '沿发动机纵向启用全局裁剪平面，可拖动滑块连续剖切，观察缸孔、曲轴箱、涡轮流道等内部结构截面，相当于工程图纸的剖视图。快捷键 C。',
  },
  {
    tag: 'NEW',
    icon: svg('<path d="M3 8 12 4l9 4-9 4z"/><path d="M3 12l9 4 9-4"/><path d="M3 16l9 4 9-4"/>'),
    title: '四向视角预设',
    desc: '等轴 / 正视 / 侧视 / 俯视四个标准工程视角一键切换，带缓动相机动画，便于对照图纸或录制讲解视频。快捷键 1 / 2 / 3 / 4。',
  },
  {
    tag: 'NEW',
    icon: svg('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" stroke-dasharray="3 3"/><path d="M4 20 20 4"/>'),
    title: '部件逐层隐藏',
    desc: '由外向内逐层剥离遮挡件（罩盖→歧管→机体），还原真实维修拆卸顺序；Shift+H 一键恢复全部显示。快捷键 H。',
  },
  {
    tag: 'NEW',
    icon: svg('<path d="M5 19 12 5l7 14"/><path d="M8 14h8"/><path d="M12 5v14" stroke-dasharray="2 3"/>'),
    title: '拆解轨迹引导线',
    desc: '显示每个部件从装配位到拆解位的运动轨迹射线，拆解视图下可一眼读懂各零件的拆出方向与行程。快捷键 G。',
  },
  {
    tag: 'NEW',
    icon: svg('<rect x="2" y="4" width="20" height="14" rx="2"/><path d="m9 9 5 3-5 3z"/><path d="M8 21h8"/>'),
    title: '自动导览演示',
    desc: '按装配逻辑自动依次聚焦并拆解 12 个关键部件，无需人工操作，适合展厅投屏、课堂讲解与产品培训。快捷键 T。',
  },
  {
    tag: 'NEW',
    icon: svg('<path d="M4 8V5a1 1 0 0 1 1-1h11l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="9" cy="13" r="2"/><path d="m4 18 4.5-3.5L13 17l3-2.5L20 19"/>'),
    title: '一键截图导出',
    desc: '将当前视角（含拆解状态与辉光特效）导出为高清 PNG，可直接用于课件、技术文档与汇报材料。快捷键 P。',
  },
  {
    tag: 'NEW',
    icon: svg('<path d="M9 15 4 20M4 20h5M4 20v-5"/><path d="M15 9l5-5M20 4h-5M20 4v5"/>'),
    title: 'URL 预置视图分享',
    desc: '在地址栏追加 #explode=0.6&select=turboL&run=1&rpm=900 即可直接复现指定拆解 / 选中 / 运转状态，方便把某个讲解节点发给他人。',
  },
  {
    tag: '性能',
    icon: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    title: '自适应画质与帧率守护',
    desc: '几何按材质批量合并、辉光半分辨率、阴影按需更新、射线拾取节流；帧率低于阈值自动降级到流畅画质，也可按 Q 手动锁定档位。',
  },
  {
    tag: '交互',
    icon: svg('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/>'),
    title: '三态标注与全键盘操作',
    desc: '标注支持关闭 / 智能 / 全部三档，自动垂直避让并限制同屏数量；拆解、运转、聚焦、标注、画质等高频操作全部绑定单键快捷键。',
  },
];

/* ================= 应用车型 ================= */
export const VEHICLES = {
  porsche: {
    title: '保时捷 · EA839 4.0 TFSI V8 装机车型',
    sub: 'PORSCHE APPLICATIONS · MLBevo 纵置平台',
    list: [
      {
        name: 'Panamera Turbo', code: '971 (G1)', years: '2017–2020',
        power: '550 PS', torque: '770 N·m', acc: '3.8 s', top: '306 km/h',
        note: '8 速 PDK 双离合 · PTV 四驱。本机页面展示的 550 PS / 770 N·m 即该版本标定。',
        hot: true,
      },
      {
        name: 'Panamera Turbo S', code: '971 (G2)', years: '2020–2023',
        power: '630 PS', torque: '820 N·m', acc: '3.1 s', top: '315 km/h',
        note: '同排量高增压版本，增压压力与冷却系统同步强化，为 971 世代最强纯燃油 Panamera。',
      },
      {
        name: 'Panamera GTS', code: '971 (G2)', years: '2018–',
        power: '460–480 PS', torque: '620 N·m', acc: '3.9 s', top: '300 km/h',
        note: '以 4.0 V8 取代早期 4.8 自吸，配运动底盘与排气，定位驾驶取向的豪华轿跑。',
      },
      {
        name: 'Panamera Turbo S E-Hybrid', code: '971 (G2)', years: '2020–',
        power: '≈680 PS 综合', torque: '≈850 N·m', acc: '3.2 s', top: '315 km/h',
        note: 'V8 本体约 571 PS，后轴电机 136 PS，8 速 PDK 集成电机，插电混动旗舰。',
      },
      {
        name: 'Cayenne Turbo', code: '9Y0 (E3)', years: '2018–',
        power: '550 PS', torque: '770 N·m', acc: '3.9 s', top: '286 km/h',
        note: '与 Panamera Turbo 同标定，配 8 速 Tiptronic S、三腔空气悬架与 PDCC。',
        hot: true,
      },
      {
        name: 'Cayenne Turbo Coupé', code: '9Y0 (E3)', years: '2019–',
        power: '550 PS', torque: '770 N·m', acc: '3.9 s', top: '286 km/h',
        note: '溜背车身 + 主动尾翼，机械部分与标准轴距 Cayenne Turbo 一致。',
      },
      {
        name: 'Cayenne GTS / GTS Coupé', code: '9Y0 (E3.2)', years: '2020–',
        power: '460 PS', torque: '620 N·m', acc: '4.5 s', top: '270 km/h',
        note: '运动化调校的中置排气与降低 24 mm 的运动底盘，兼顾日常与赛道。',
      },
      {
        name: 'Cayenne Turbo GT', code: '9Y0 (E3.2)', years: '2021–',
        power: '640 PS', torque: '850 N·m', acc: '3.3 s', top: '300 km/h',
        note: '强化曲轴 / 连杆 / 正时链驱动、加大涡轮与中冷，为保时捷最强非混动 V8。',
      },
      {
        name: 'Cayenne Turbo S E-Hybrid', code: '9Y0 (E3.2)', years: '2019–',
        power: '≈680 PS 综合', torque: '≈900 N·m', acc: '3.7 s', top: '295 km/h',
        note: 'V8 + 后轴电机混动架构，保留 V8 声浪的同时提供纯电通勤能力。',
      },
    ],
  },
  family: {
    title: '同平台衍生机型（EA825 调校分支）',
    sub: 'SHARED PLATFORM · DERIVED CALIBRATIONS',
    list: [
      { name: 'Audi RS 6 Avant', code: 'C8', years: '2019–', power: '600 PS', torque: '800 N·m', acc: '3.6 s', top: '305 km/h', note: '48V 轻混 + 8 速 Tiptronic，quattro 全时四驱。' },
      { name: 'Audi RS 7 Sportback', code: 'C8', years: '2019–', power: '600 PS', torque: '800 N·m', acc: '3.6 s', top: '306 km/h', note: '与 RS 6 同动力总成，轿跑车身与主动尾翼。' },
      { name: 'Audi RS Q8', code: '4M', years: '2019–', power: '600 PS', torque: '800 N·m', acc: '3.8 s', top: '305 km/h', note: '与 Urus / Cayenne Coupé 共享平台的旗舰性能 SUV。' },
      { name: 'Audi S8', code: 'D5', years: '2019–', power: '571 PS', torque: '800 N·m', acc: '3.8 s', top: '250 km/h', note: '旗舰行政轿车，配主动悬架与四轮转向。' },
      { name: 'Lamborghini Urus', code: '—', years: '2018–', power: '650 PS', torque: '850 N·m', acc: '3.6 s', top: '305 km/h', note: '该机型家族中功率最高的量产版本之一。' },
      { name: 'Bentley Continental GT V8', code: '—', years: '2019–', power: '550 PS', torque: '770 N·m', acc: '4.0 s', top: '318 km/h', note: '与 Flying Spur V8 / Bentayga V8 同标定。' },
      { name: 'Bentley Flying Spur V8', code: '—', years: '2020–', power: '550 PS', torque: '770 N·m', acc: '4.1 s', top: '318 km/h', note: '超豪华四门轿车，与添越 V8 共用动力总成。' },
    ],
  },
};

/* ================= 整机技术规格 ================= */
export const SPECS = [
  ['发动机代号', 'EA839（VW Group 4.0 TFSI V8）'],
  ['排量', '3996 cc'],
  ['缸径 × 行程', '86.0 × 86.0 mm（方形）'],
  ['气缸夹角 / 缸数', '90° · V8 · DOHC 32V'],
  ['最大功率', '550 PS @ 5750–6000 rpm'],
  ['最大扭矩', '770 N·m @ 1960–4500 rpm'],
  ['压缩比', '10.1 : 1'],
  ['增压形式', '中央双涡轮 hot-V（双涡管）'],
  ['燃油系统', '缸内直喷 350 bar + 进气道喷射'],
  ['点火次序', '1-5-4-8-6-3-7-2'],
  ['可变气门', '进气 / 排气 VVT 50° 曲轴角'],
  ['闭缸技术', 'COD 四缸闭缸（低负荷）'],
  ['正时驱动', '单排正时链 + 链轮调节器'],
  ['润滑系统', '干式油底壳 · 风冷集油盘'],
  ['排气后处理', '双三元催化 + GPF（视市场）'],
  ['整机重量', '约 229 kg（干重，视配置）'],
];

/* ================= 快捷键 ================= */
export const KEYS = [
  ['拖拽', '旋转视角'],
  ['滚轮', '缩放模型'],
  ['右键拖拽', '平移视图'],
  ['点击部件', '选中并单独拆解'],
  ['1 / 2 / 3 / 4', '等轴 / 正视 / 侧视 / 俯视'],
  ['E', '全部拆解 / 全部合拢'],
  ['R', '复位视角与拆解状态'],
  ['空格', '启动 / 停止运转演示'],
  ['F', '聚焦当前选中部件'],
  ['L', '循环切换标注模式'],
  ['Q', '切换画质档位'],
  ['X', 'X 光透视开关'],
  ['C', '剖切视图开关'],
  ['H / Shift+H', '隐藏选中部件 / 显示全部'],
  ['G', '拆解轨迹引导线开关'],
  ['T', '自动导览演示'],
  ['P', '截图导出 PNG'],
  ['I', '打开本介绍'],
  ['ESC', '取消选择 / 关闭浮层'],
];
