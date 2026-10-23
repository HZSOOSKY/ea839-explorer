/**
 * EA839 交互式拆解可视化 — 主程序
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEngine, DIM } from './engine.js';
import { PARTS, PART_MAP, GROUPS } from './parts.js';
import { FEATURES, VEHICLES, SPECS, KEYS } from './data.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ================= 渲染器 / 场景 ================= */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
// 像素比上限 1.5：2.0 在高 DPI 屏上会让片元数与后处理开销翻倍，是掉帧的主因之一
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 阴影改为按需更新：方向光阴影与相机无关，只有部件移动（拆解/运转）时才需要重画
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
// 剖切视图依赖材质级裁剪平面
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040810, 0.0042);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 800);
const FIT_BASE = new THREE.Vector3(116, 76, 82);
// 窄屏两侧栏占掉的视觉宽度更多，相机相应后撤，避免模型被半透明面板压住
const fitK = Math.max(
  innerWidth < 1400 ? 1.24 : innerWidth < 1600 ? 1.10 : 1,
  innerHeight > 950 ? 1.12 : 1
);
camera.position.copy(FIT_BASE).multiplyScalar(fitK);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 40;
controls.maxDistance = 400;
controls.maxPolarAngle = Math.PI * 0.88;
controls.target.set(0, 6, 0);
controls.autoRotateSpeed = 0.55;
// 拆解展开时的相机后撤以此为基准，避免「一展开反而先贴近」的跳变
const baseDist = camera.position.distanceTo(controls.target);

/* ================= 灯光 =================
   启用环境贴图后 IBL 已承担一部分环境照明，故环境光 / 半球光相应下调，
   避免金属件整体过曝。 */
scene.add(new THREE.AmbientLight(0x36546a, 0.52));
scene.add(new THREE.HemisphereLight(0x5a8fb5, 0x0d141c, 0.62));

const key = new THREE.DirectionalLight(0xdcf0ff, 2.9);
key.position.set(60, 90, 70);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 20;
key.shadow.camera.far = 320;
key.shadow.camera.left = -90; key.shadow.camera.right = 90;
key.shadow.camera.top = 90; key.shadow.camera.bottom = -90;
key.shadow.bias = -0.0009;
scene.add(key);

const rim = new THREE.DirectionalLight(0x3fb4e8, 1.9);
rim.position.set(-70, 30, -60);
scene.add(rim);

const fill = new THREE.DirectionalLight(0xffb878, 0.85);
fill.position.set(-30, -20, 70);
scene.add(fill);

const under = new THREE.PointLight(0x1f7fa8, 260, 220, 2);
under.position.set(0, -34, 20);
scene.add(under);

const core = new THREE.PointLight(0x48dcff, 300, 150, 2);
core.position.set(0, 4, 0);
scene.add(core);

/* ================= 程序化环境贴图 =================
   金属件（缸体 / 曲轴 / 涡轮）在没有环境反射时只能靠漫反射着色，观感发灰发闷。
   这里用几个自发光面片搭一个极简「灯箱」，经 PMREM 卷积成 IBL 环境贴图。
   渲染只发生一次，之后每帧只是多一次纹理采样，成本可忽略，但金属高光与
   轮廓反射会明显立体。 */
let envTex = null;
(function buildEnvironment() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(80, 80, 80),
    new THREE.MeshBasicMaterial({ color: 0x0b141d, side: THREE.BackSide })
  );
  env.add(room);
  const panel = (color, w, h, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    env.add(m);
  };
  // 顶部主光（冷白）
  panel(0xdff1ff, 46, 46, [0, 38, 0], [Math.PI / 2, 0, 0]);
  // 侧向补光：青 / 琥珀，对应 UI 主色，让高光带有环境色倾向
  panel(0x2e7fa8, 40, 26, [-38, 4, 0], [0, Math.PI / 2, 0]);
  panel(0x7a4f18, 40, 26, [38, 2, 0], [0, -Math.PI / 2, 0]);
  panel(0x1d5f80, 46, 22, [0, 2, -38], [0, 0, 0]);
  panel(0x101a24, 46, 30, [0, -6, 38], [0, Math.PI, 0]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  envTex = pmrem.fromScene(env, 0.03).texture;
  scene.environment = envTex;
  pmrem.dispose();
  room.geometry.dispose();
  env.traverse(o => { if (o.isMesh) o.material.dispose(); });
})();

/* ================= 科技感背景：地面网格 + 环形光晕 ================= */
const grid = new THREE.GridHelper(420, 56, 0x1d5f80, 0x0d2a3a);
grid.material.transparent = true;
grid.material.opacity = 0.42;
grid.position.y = -44;
scene.add(grid);

const glowRing = new THREE.Mesh(
  new THREE.RingGeometry(58, 118, 96),
  new THREE.MeshBasicMaterial({
    color: 0x1d7fb0, transparent: true, opacity: 0.10,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  })
);
glowRing.rotation.x = -Math.PI / 2;
glowRing.position.y = -43.4;
scene.add(glowRing);

const glowRing2 = new THREE.Mesh(
  new THREE.RingGeometry(28, 44, 72),
  new THREE.MeshBasicMaterial({
    color: 0x48dcff, transparent: true, opacity: 0.13,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  })
);
glowRing2.rotation.x = -Math.PI / 2;
glowRing2.position.y = -43.2;
scene.add(glowRing2);

/* 悬浮粒子 */
const particleCount = 420;
const pPos = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  const r = 40 + Math.random() * 130;
  const a = Math.random() * Math.PI * 2;
  pPos[i * 3] = Math.cos(a) * r;
  pPos[i * 3 + 1] = -40 + Math.random() * 130;
  pPos[i * 3 + 2] = Math.sin(a) * r;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  color: 0x48dcff, size: 0.55, transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
}));
scene.add(particles);

/* ================= 发动机 ================= */
const { root, parts, materials, updateKinematics, updateFlames } = buildEngine();
root.position.y = 4;
scene.add(root);

/* 部件初始偏移 */
for (const [id, rec] of parts) {
  const meta = PART_MAP[id];
  if (!meta) continue;
  const dir = new THREE.Vector3(...meta.explode);
  if (dir.lengthSq() > 0) rec.offset.copy(dir.normalize().multiplyScalar(meta.dist));
  // 环境反射强度略作收敛，保留金属质感又不至于把暗部提亮
  for (const m of rec.mats) if ('envMapIntensity' in m.mat) m.mat.envMapIntensity = 0.72;
}

/* ---------- 拆解轨迹引导线 ----------
   每条线段 = 该部件标注锚点从装配位到拆解位的运动轨迹，一次性构建，零逐帧开销。 */
const trails = (function buildTrails() {
  const usable = [];
  for (const [id, rec] of parts) if (rec.label && rec.offset.lengthSq() > 0) usable.push(rec);
  const pos = new Float32Array(usable.length * 6);
  usable.forEach((rec, i) => {
    const a = rec.label, b = rec.offset;
    pos.set([a[0], a[1], a[2], a[0] + b.x, a[1] + b.y, a[2] + b.z], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color: 0x48dcff, transparent: true, opacity: 0.34, depthWrite: false,
  }));
  line.visible = false;
  line.frustumCulled = false;
  root.add(line);
  return line;
})();

/* ---------- 剖切平面 ----------
   法线指向 -X：保留 x <= constant 的一侧，滑块直接控制 constant。 */
const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 70);

/* ================= 后期处理 ================= */
/* Bloom 以半分辨率运行：辉光本身是低频模糊，降采样肉眼几乎无差，
   但省下 5 级 mip 模糊链的大量填充率开销。 */
const BLOOM_SCALE = 0.5;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth * BLOOM_SCALE, innerHeight * BLOOM_SCALE), 0.62, 0.72, 0.82);
const _bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => _bloomSetSize(w * BLOOM_SCALE, h * BLOOM_SCALE);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ================= 状态 ================= */
const state = {
  selected: null,
  hover: null,
  running: false,
  crankAngle: 0,
  rpm: 0,
  explodeAmount: 0,      // 0 = 合拢, 1 = 全拆
  targetExplode: 0,
  exploded: new Set(),    // 单独拆出的部件
  labelMode: 1,           // 0=关闭  1=智能（选中/悬停/已拆解）  2=全部
  quality: 'high',        // high | low
  autoQuality: true,      // 帧率过低时自动降级
  master: 0,              // 爆炸插值
  frame: 0,
  fps: 60,
  xray: false,            // X 光透视：选中部件以外半透明
  clip: false,            // 剖切视图
  clipPos: 70,            // 剖切面位置（世界 X）
  trails: false,          // 拆解轨迹引导线
  hidden: new Set(),      // 被隐藏的部件 id
  tour: null,             // 自动导览状态 { i, timer }
  view: 0,                // 当前视角预设
};

/* 标准工程视角预设（相机位置，观察目标统一为整机中心上方） */
const VIEWS = [
  { key: 'iso', name: '等轴', pos: [116, 76, 82] },
  { key: 'front', name: '正视', pos: [0, 18, 158] },
  { key: 'side', name: '侧视', pos: [158, 16, 4] },
  { key: 'top', name: '俯视', pos: [0, 205, 42] },
];

const partState = new Map();  // id -> { master: 0, solo: 0 }
for (const id of parts.keys()) partState.set(id, { master: 0, solo: 0 });

/* ================= 部件清单 UI ================= */
function buildCatalog() {
  const list = $('#catalog-list');
  list.innerHTML = '';
  GROUPS.forEach(grp => {
    const items = PARTS.filter(p => p.group === grp.id);
    if (!items.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'cat-group';
    const t = document.createElement('div');
    t.className = 'cat-group-title';
    t.innerHTML = `<span class="cat-dot" style="background:${grp.color};box-shadow:0 0 6px ${grp.color}"></span>
                   <span>${grp.name}</span><span class="cat-line"></span>
                   <span>${items.length}</span>`;
    wrap.appendChild(t);
    items.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'cat-item';
      row.dataset.id = p.id;
      row.innerHTML = `<span class="cat-idx">${String(i + 1).padStart(2, '0')}</span>
                      <span class="cat-name">${p.name}</span>
                      <span class="cat-state">拆解</span>`;
      row.addEventListener('click', () => selectPart(p.id, true));
      wrap.appendChild(row);
    });
    list.appendChild(wrap);
  });

  $('#search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $$('.cat-item').forEach(el => {
      const p = PART_MAP[el.dataset.id];
      const hit = !q || p.name.toLowerCase().includes(q) || p.en.toLowerCase().includes(q) || p.id.includes(q);
      el.style.display = hit ? '' : 'none';
    });
    $$('.cat-group').forEach(g => {
      const any = Array.from(g.querySelectorAll('.cat-item')).some(el => el.style.display !== 'none');
      g.style.display = any ? '' : 'none';
    });
  });
}

/* ================= 详情面板 ================= */
const OVERVIEW = `
  <div class="det-empty" style="justify-content:flex-start;padding-top:40px;gap:16px">
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#48dcff" stroke-width="1.1">
      <circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>
      <circle cx="12" cy="12" r="3.4"/>
    </svg>
    <p>点击三维模型中的任意部件<br>查看技术参数与拆解</p>
    <span class="kbd">ESC 取消选择</span>
    <div class="det-rule" style="width:100%"></div>
    <div style="text-align:left;width:100%;font-size:11.5px;line-height:2;color:#7d97a8">
      <div style="display:flex;justify-content:space-between"><span>整机型号</span><b style="color:#cfe3f0">EA839 4.0 TFSI V8</b></div>
      <div style="display:flex;justify-content:space-between"><span>排量 / 缸径×行程</span><b style="color:#cfe3f0">3996 cc / 86×86 mm</b></div>
      <div style="display:flex;justify-content:space-between"><span>结构形式</span><b style="color:#cfe3f0">90° V8 · DOHC 32V</b></div>
      <div style="display:flex;justify-content:space-between"><span>最大功率 / 扭矩</span><b style="color:#cfe3f0">550 PS / 770 Nm</b></div>
      <div style="display:flex;justify-content:space-between"><span>压缩比</span><b style="color:#cfe3f0">10.1 : 1</b></div>
      <div style="display:flex;justify-content:space-between"><span>增压方式</span><b style="color:#cfe3f0">中央双涡轮 hot-V</b></div>
      <div style="display:flex;justify-content:space-between"><span>正时驱动</span><b style="color:#cfe3f0">单排正时链 · VVT 50°</b></div>
      <div style="display:flex;justify-content:space-between"><span>可拆分部件</span><b style="color:#48dcff">${PARTS.length} 项</b></div>
    </div>
  </div>`;

function showDetail(p) {
  const body = $('#detail-body');
  if (!p) { body.innerHTML = OVERVIEW; return; }
  const grp = GROUPS.find(g => g.id === p.group);
  const rows = p.specs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  body.innerHTML = `
    <div class="det-tag" style="color:${grp.color};border-color:${grp.color}55">${grp.name}</div>
    <div class="det-title">${p.name}</div>
    <div class="det-en">${p.en}</div>
    <div class="det-rule"></div>
    <div class="det-desc">${p.desc}</div>
    <div class="det-rule"></div>
    <div class="det-tag" style="color:#6d8798;border-color:#6d879833">技术参数 / SPECIFICATIONS</div>
    <table class="spec-table">${rows}</table>
    <div class="det-actions">
      <button class="btn amber" id="det-explode">${state.exploded.has(p.id) ? '合拢该部件' : '单独拆解'}</button>
      <button class="btn" id="det-focus">聚焦该部件</button>
    </div>`;  $('#det-explode').addEventListener('click', () => toggleExplode(p.id));
  $('#det-focus').addEventListener('click', () => focusPart(p.id));
}

/* ================= 选中 / 高亮 ================= */
const HL = new THREE.Color(0x48dcff);
const HL_SEL = new THREE.Color(0xffb648);

function applyHighlight() {
  for (const [id, rec] of parts) {
    const isSel = state.selected === id;
    const isHov = state.hover === id;
    const active = isSel || isHov;
    rec.mats.forEach(m => {
      const mat = m.mat;
      // MeshBasicMaterial 等无 emissive 属性的材质跳过高亮
      if (!mat.emissive) return;
      if (active) {
        mat.emissive.copy(isSel ? HL_SEL : HL);
        mat.emissiveIntensity = isSel ? 0.55 : 0.28;
      } else {
        mat.emissive.copy(m.base);
        mat.emissiveIntensity = m.bi;
      }
    });
  }
}

function selectPart(id, toggle = false) {
  if (toggle && state.selected === id) {
    state.selected = null;
  } else {
    state.selected = id;
  }
  $$('.cat-item').forEach(el => el.classList.toggle('sel', el.dataset.id === state.selected));
  showDetail(state.selected ? PART_MAP[state.selected] : null);
  applyHighlight();
  refreshXray();
  updateLabels();
}

function toggleExplode(id) {
  if (state.exploded.has(id)) state.exploded.delete(id);
  else state.exploded.add(id);
  const rec = parts.get(id);
  if (rec) rec.group.userData.wanted = state.exploded.has(id) ? 1 : 0;
  $$('.cat-item').forEach(el => el.classList.toggle('exploded', state.exploded.has(el.dataset.id)));
  if (state.selected === id) showDetail(PART_MAP[id]);
  updateLabels();
}

/* ================= 拾取 ================= */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;

function pickAt(cx, cy) {
  pointer.x = (cx / innerWidth) * 2 - 1;
  pointer.y = -(cy / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(root, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.partId) o = o.parent;
    // Raycaster 不检查 visible，被隐藏的部件需要自己过滤掉，否则会「隔空点中」
    if (o && o.userData.partId && !state.hidden.has(o.userData.partId)) return o.userData.partId;
  }
  return null;
}

canvas.addEventListener('pointerdown', e => { downPos = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  downPos = null;
  if (moved > 5) return;
  const id = pickAt(e.clientX, e.clientY);
  if (!id) { selectPart(null); return; }
  // 同一部件再次点击 → 合拢；否则选中并自动拆解
  if (state.selected === id && state.exploded.has(id)) {
    toggleExplode(id);
    return;
  }
  selectPart(id);
  if (!state.exploded.has(id)) toggleExplode(id);
});

/* 悬停拾取只记录坐标，真正的射线求交放到主循环里节流执行。
   pointermove 每秒可触发上百次，每次对整机所有子网格做射线求交是主要卡顿源之一。 */
let pendingPick = null;
canvas.addEventListener('pointermove', e => {
  if (e.buttons) return;
  pendingPick = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => {
  pendingPick = null;
  if (state.hover) { state.hover = null; canvas.classList.remove('pickable'); applyHighlight(); }
});

/* ================= 标注 =================
   设计要点：
   1) 三态开关：关闭 / 智能（仅选中·悬停·已拆解）/ 全部（限量）。
      旧实现只要存在任一选中项就渲染全部 31 个标签，「关闭」按钮也无法真正隐藏。
   2) 无论哪种模式都限制同屏标签数量，避免堆叠与 DOM 写入风暴。
   3) 只在数值变化时写 DOM（缓存上一次 transform / opacity / class），
      并统一走 translate3d 走合成层，不触发布局重排。 */
const labelEls = new Map();
const labelLayer = $('#labels');

const LABEL_MODES = [
  { key: 'off', text: '标注：关', limit: 0 },
  { key: 'smart', text: '标注：智能', limit: 10 },
  { key: 'all', text: '标注：全部', limit: 16 },
];

function ensureLabels() {
  const order = new Map(PARTS.map((p, i) => [p.id, i + 1]));
  for (const [id] of parts) {
    if (labelEls.has(id)) continue;
    const el = document.createElement('div');
    el.className = 'lbl';
    el.innerHTML = `<span class="idx">${String(order.get(id) || 0).padStart(2, '0')}</span><span class="tx"></span>`;
    el.querySelector('.tx').textContent = PART_MAP[id] ? PART_MAP[id].name : id;
    el._shown = false;
    el._tf = '';
    el._op = '';
    el._sel = null;
    labelLayer.appendChild(el);
    labelEls.set(id, el);
  }
}

function hideLabel(el) {
  if (!el) return;
  if (el._shown) { el.classList.remove('show'); el._shown = false; }
  // 必须同时把内联 opacity 归零：内联样式优先级高于 .lbl{opacity:0}，
  // 只移除 class 的话标签会一直留在屏幕上（旧版「标注关不掉」的另一半原因）
  if (el._op !== '0') { el.style.opacity = '0'; el._op = '0'; }
}

const _wp = new THREE.Vector3();
const _tmpItems = [];

function updateLabels() {
  if (!labelEls.size) ensureLabels();
  const mode = LABEL_MODES[state.labelMode];
  const limit = state.quality === 'low' ? Math.min(8, mode.limit) : mode.limit;

  // 关闭模式：一次性全部隐藏后直接返回，之后每帧零 DOM 操作
  if (mode.key === 'off' || limit === 0) {
    for (const el of labelEls.values()) hideLabel(el);
    return;
  }

  // 1) 收集候选：智能模式只取「选中 / 悬停 / 已拆解」的部件；
  //    整机拆解展开时（滑块 > 5%）改为限量显示全部，否则拆解视图里会一个标注都没有
  const globalExplode = state.master > 0.05;
  _tmpItems.length = 0;
  for (const [id, rec] of parts) {
    const el = labelEls.get(id);
    if (!el) continue;
    if (state.hidden.has(id)) { hideLabel(el); continue; }
    if (mode.key === 'smart' && !globalExplode) {
      const focused = id === state.selected || id === state.hover || state.exploded.has(id);
      if (!focused) { hideLabel(el); continue; }
    }
    const anchor = rec.group.userData.labelWorld;
    if (!anchor) { hideLabel(el); continue; }
    _wp.copy(anchor);
    const dist = _wp.distanceTo(camera.position);
    _wp.project(camera);
    if (!(_wp.z < 1 && Math.abs(_wp.x) < 1.25 && Math.abs(_wp.y) < 1.2)) { hideLabel(el); continue; }
    const isSel = state.selected === id || state.hover === id || state.exploded.has(id);
    _tmpItems.push({
      el, dist, isSel,
      x: (_wp.x * 0.5 + 0.5) * innerWidth,
      y: (-_wp.y * 0.5 + 0.5) * innerHeight,
    });
  }

  // 2) 全部模式下限量：优先保留选中/悬停/已拆解，其余按距离由近及远
  if (_tmpItems.length > limit) {
    _tmpItems.sort((a, b) => (b.isSel - a.isSel) || (a.dist - b.dist));
    for (let i = limit; i < _tmpItems.length; i++) hideLabel(_tmpItems[i].el);
    _tmpItems.length = limit;
  }

  // 3) 垂直避让：按屏幕 Y 排序，保证相邻标签至少间隔一个行高
  _tmpItems.sort((a, b) => (b.isSel - a.isSel) || (a.y - b.y));
  const LH = 20;
  const placed = [];
  const maxY = innerHeight - 70;
  for (const it of _tmpItems) {
    let y = it.y;
    let guard = 0;
    while (guard++ < 24 && placed.some(p => Math.abs(p - y) < LH)) {
      y += LH;
      if (y > maxY) { y = Math.max(70, it.y - LH * placed.length); break; }
    }
    placed.push(y);
    it.ly = y;
    it.side = it.x < innerWidth * 0.5 ? -1 : 1;
  }

  // 4) 写入：仅当值变化时才碰 DOM
  for (const it of _tmpItems) {
    const el = it.el;
    const off = it.side < 0 ? -14 : 14;
    const tx = it.x + off;
    const tf = `translate3d(${tx.toFixed(1)}px, ${it.ly.toFixed(1)}px, 0)`
      + (it.side < 0 ? ' translate(-100%, -50%)' : ' translate(0, -50%)');
    if (el._tf !== tf) { el.style.transform = tf; el._tf = tf; }
    const op = it.isSel ? '1' : Math.max(0.34, Math.min(1, 130 / it.dist)).toFixed(2);
    if (el._op !== op) { el.style.opacity = op; el._op = op; }
    if (el._sel !== it.isSel) { el.classList.toggle('sel', it.isSel); el._sel = it.isSel; }
    if (!el._shown) { el.classList.add('show'); el._shown = true; }
  }
}

/* ================= 聚焦 ================= */
function focusPart(id) {
  const rec = parts.get(id);
  if (!rec) return;
  const box = new THREE.Box3().setFromObject(rec.group);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  const dist = Math.max(34, size * 1.5);
  camAnim = {
    t: 0, dur: 0.9,
    fromT: controls.target.clone(), toT: c,
    fromP: camera.position.clone(), toP: c.clone().add(dir.multiplyScalar(dist)),
  };
}
let camAnim = null;

/* ================= 视角预设 ================= */
function flyTo(pos, target, dur = 0.9) {
  camAnim = {
    t: 0, dur,
    fromT: controls.target.clone(), toT: target.clone(),
    fromP: camera.position.clone(), toP: pos.clone(),
  };
}

function applyView(i) {
  state.view = i;
  const v = VIEWS[i];
  // 拆解展开时整机跨度变大，各视角按拆解程度同步后撤
  const k = fitK * (1 + state.master * 0.55);
  flyTo(
    new THREE.Vector3(v.pos[0] * k, v.pos[1] * k, v.pos[2] * k),
    new THREE.Vector3(0, 6 + state.master * 6, 0)
  );
  $$('[data-view]').forEach(el => el.classList.toggle('active', +el.dataset.view === i));
  toast('视角：' + v.name);
}

/* ================= X 光透视 ================= */
function refreshXray() {
  if (!state.xray) return;
  for (const [id, rec] of parts) {
    const ghost = id !== state.selected;
    for (const m of rec.mats) {
      const mat = m.mat;
      if (mat.__xop == null) { mat.__xop = mat.opacity; mat.__xtr = mat.transparent; mat.__xdw = mat.depthWrite; }
      if (ghost) {
        mat.transparent = true; mat.opacity = 0.13; mat.depthWrite = false;
      } else {
        mat.opacity = mat.__xop; mat.transparent = mat.__xtr; mat.depthWrite = mat.__xdw;
      }
      mat.needsUpdate = true;
    }
  }
}

function setXray(on) {
  state.xray = on;
  const btn = $('#btn-xray');
  if (btn) { btn.classList.toggle('active', on); btn.textContent = on ? 'X 光 · 开' : 'X 光'; }
  if (on) {
    refreshXray();
    toast(state.selected ? 'X 光透视：仅「' + PART_MAP[state.selected].name + '」保持实体' : 'X 光透视已开启（选中部件后其余零件将半透明）');
  } else {
    for (const [, rec] of parts) {
      for (const m of rec.mats) {
        const mat = m.mat;
        if (mat.__xop == null) continue;
        mat.opacity = mat.__xop; mat.transparent = mat.__xtr; mat.depthWrite = mat.__xdw;
        mat.__xop = null; mat.needsUpdate = true;
      }
    }
    renderer.shadowMap.needsUpdate = true;
    toast('X 光透视已关闭');
  }
  syncModeStat();
}

/* ================= 剖切视图 ================= */
const CLIP_OFF = 70;
function applyClip() {
  const on = state.clip && state.clipPos < CLIP_OFF;
  clipPlane.constant = state.clipPos;
  for (const [, rec] of parts) {
    for (const m of rec.mats) {
      const mat = m.mat;
      const has = mat.clippingPlanes && mat.clippingPlanes.length > 0;
      if (on && !has) {
        // 剖切后原本朝向相机的背面会变成「空洞」，
        // 临时改为双面渲染，让缸孔/水套内壁显形（仅剖切期间，避免常态关闭剔除）
        mat.__side = mat.side;
        mat.side = THREE.DoubleSide;
        mat.clippingPlanes = [clipPlane];
        mat.needsUpdate = true;
      } else if (!on && has) {
        if (mat.__side != null) { mat.side = mat.__side; mat.__side = null; }
        mat.clippingPlanes = null;
        mat.needsUpdate = true;
      }
    }
  }
  trails.material.clippingPlanes = on ? [clipPlane] : null;
}

function setClip(on) {
  state.clip = on;
  if (on && state.clipPos >= CLIP_OFF) {
    state.clipPos = 0;
    $('#clip-slider').value = 0;
  }
  if (!on) {
    state.clipPos = CLIP_OFF;
    $('#clip-slider').value = CLIP_OFF;
  }
  $('#clip-val').textContent = on ? state.clipPos + ' cm' : '关';
  const btn = $('#btn-clip');
  if (btn) { btn.classList.toggle('active', on); btn.textContent = on ? '剖切 · 开' : '剖切'; }
  applyClip();
  renderer.shadowMap.needsUpdate = true;
  toast(on ? '剖切视图已开启，拖动「剖切位置」滑块查看截面' : '剖切视图已关闭');
  syncModeStat();
}

/* ================= 轨迹引导线 ================= */
function setTrails(on) {
  state.trails = on;
  trails.material.opacity = 0.34;
  const btn = $('#btn-trails');
  if (btn) btn.classList.toggle('active', on);
  toast(on ? '拆解轨迹引导线已开启' : '拆解轨迹引导线已关闭');
}

/* ================= 部件隐藏 ================= */
function toggleHide(id) {
  if (!id) { toast('请先在模型中点选一个部件'); return; }
  const rec = parts.get(id);
  if (!rec) return;
  const nowHidden = !state.hidden.has(id);
  if (nowHidden) state.hidden.add(id); else state.hidden.delete(id);
  rec.group.visible = !nowHidden;
  refreshXray();
  renderer.shadowMap.needsUpdate = true;
  $$('.cat-item').forEach(el => el.classList.toggle('hidden', state.hidden.has(el.dataset.id)));
  toast(nowHidden ? '已隐藏「' + PART_MAP[id].name + '」（Shift+H 恢复全部）' : '已恢复显示「' + PART_MAP[id].name + '」');
  syncModeStat();
}

function showAllHidden() {
  if (!state.hidden.size) { toast('当前没有被隐藏的部件'); return; }
  for (const id of state.hidden) { const r = parts.get(id); if (r) r.group.visible = true; }
  state.hidden.clear();
  $$('.cat-item').forEach(el => el.classList.remove('hidden'));
  renderer.shadowMap.needsUpdate = true;
  toast('已恢复显示全部部件');
  syncModeStat();
}

/* ================= 截图导出 =================
   WebGL 默认不保留绘制缓冲，因此只在「刚渲染完的同一帧」内取像素，
   不改变 preserveDrawingBuffer（那会拖慢每一帧）。 */
let shotPending = false;
function takeShot() {
  shotPending = true;
  toast('正在导出当前视图…');
}
function doShot() {
  canvas.toBlob(blob => {
    if (!blob) { toast('截图失败，请重试'); return; }
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const name = `EA839_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('已导出 ' + name);
  }, 'image/png');
}

/* ================= 自动导览 ================= */
const TOUR = ['block', 'pistons', 'crank', 'headL', 'camsL', 'valves', 'timingchain',
  'turboL', 'intake', 'exhaustL', 'oilpump', 'injectors'].filter(id => parts.has(id));
const TOUR_HOLD = 3.4;   // 每个部件停留秒数

function startTour() {
  state.tour = { i: -1, timer: TOUR_HOLD };
  state.targetExplode = 0;
  state.exploded.clear();
  for (const [id, rec] of parts) rec.group.userData.wanted = 0;
  $('#btn-explode-all').classList.remove('active');
  $('#btn-explode-all').textContent = '全部拆解';
  $('#explode-slider').value = 0; $('#explode-val').textContent = '0%';
  $('#btn-tour').classList.add('active');
  $('#btn-tour').textContent = '停止导览';
  toast('自动导览开始：' + TOUR.length + ' 个关键部件依次拆解');
}

function stopTour() {
  state.tour = null;
  $('#btn-tour').classList.remove('active');
  $('#btn-tour').textContent = '导览';
  toast('自动导览已停止');
}

function stepTour(dt) {
  const t = state.tour;
  t.timer += dt;
  if (t.timer < TOUR_HOLD) return;
  t.timer = 0;
  if (t.i >= 0 && t.i < TOUR.length) {
    const prev = TOUR[t.i];
    if (state.exploded.has(prev)) toggleExplode(prev);
  }
  t.i++;
  if (t.i >= TOUR.length) { stopTour(); toast('自动导览结束'); return; }
  const id = TOUR[t.i];
  selectPart(id);
  if (!state.exploded.has(id)) toggleExplode(id);
  focusPart(id);
}

/* ================= 顶栏模式指示 ================= */
function syncModeStat() {
  const tags = [];
  if (state.xray) tags.push('X光');
  if (state.clip) tags.push('剖切');
  if (state.hidden.size) tags.push('隐藏 ' + state.hidden.size);
  if (state.trails) tags.push('轨迹');
  const el = $('#stat-mode');
  if (el) el.textContent = '视图：' + (tags.length ? tags.join(' · ') : '透视');
}

/* ================= 控制台按钮 ================= */
function bindBtn(sel, fn) {
  const el = $(sel);
  if (el) el.addEventListener('click', fn);
}

bindBtn('#btn-explode-all', () => {
  const on = state.targetExplode < 0.5;
  state.targetExplode = on ? 1 : 0;
  $('#btn-explode-all').classList.toggle('active', on);
  $('#btn-explode-all').textContent = on ? '全部合拢' : '全部拆解';
  if (!on) {
    state.exploded.clear();
    state.exploded.clear();
    for (const [id, rec] of parts) rec.group.userData.wanted = 0;
    $$('.cat-item').forEach(el => el.classList.remove('exploded'));
  }
  toast(on ? '全机拆解序列展开' : '全机合拢复位');
});

bindBtn('#btn-reset', () => {
  state.targetExplode = 0;
  state.exploded.clear();
  state.exploded.clear();
  for (const [id, rec] of parts) rec.group.userData.wanted = 0;
  $$('.cat-item').forEach(el => el.classList.remove('exploded'));
  $('#btn-explode-all').classList.remove('active');
  $('#btn-explode-all').textContent = '全部拆解';
  state.selected = null;
  showDetail(null);
  applyHighlight();
  camAnim = {
    t: 0, dur: 0.9,
    fromT: controls.target.clone(), toT: new THREE.Vector3(0, 6, 0),
    fromP: camera.position.clone(), toP: FIT_BASE.clone().multiplyScalar(fitK),
  };
  toast('视角与拆解状态已复位');
});

bindBtn('#btn-run', () => {
  state.running = !state.running;
  kinDirty = true;                 // 停机时也要再算一次，把火焰强度归零
  $('#btn-run').classList.toggle('active', state.running);
  $('#btn-run').textContent = state.running ? '停止运转' : '运转演示';
  toast(state.running ? '曲柄连杆运动演示启动' : '运转演示已停止');
});

bindBtn('#btn-spin', () => {
  controls.autoRotate = !controls.autoRotate;
  $('#btn-spin').classList.toggle('active', controls.autoRotate);
  toast(controls.autoRotate ? '自动环绕已开启' : '自动环绕已关闭');
});

bindBtn('#btn-labels', () => {
  state.labelMode = (state.labelMode + 1) % LABEL_MODES.length;
  const m = LABEL_MODES[state.labelMode];
  const btn = $('#btn-labels');
  btn.textContent = m.text;
  btn.classList.toggle('active', state.labelMode !== 0);
  toast(state.labelMode === 0 ? '已关闭全部标注'
    : state.labelMode === 1 ? '标注模式：智能（仅选中 / 悬停 / 已拆解部件）'
      : '标注模式：全部（同屏最多 ' + m.limit + ' 个）');
  updateLabels();
});

bindBtn('#btn-quality', () => {
  setQuality(state.quality === 'high' ? 'low' : 'high', false);
});

bindBtn('#btn-focus', () => {
  if (state.selected) focusPart(state.selected);
  else toast('请先在模型中点选一个部件');
});

bindBtn('#btn-help', () => {
  const g = $('#guide');
  g.style.display = g.style.display === 'none' ? '' : 'none';
  $('#btn-help').classList.toggle('active', g.style.display !== 'none');
});

/* --- 新增功能按钮 --- */
$$('[data-view]').forEach(el => {
  el.addEventListener('click', () => applyView(+el.dataset.view));
});

bindBtn('#btn-xray', () => setXray(!state.xray));
bindBtn('#btn-clip', () => setClip(!state.clip));
bindBtn('#btn-trails', () => setTrails(!state.trails));
bindBtn('#btn-tour', () => (state.tour ? stopTour() : startTour()));
bindBtn('#btn-hide', () => toggleHide(state.selected || state.hover));
bindBtn('#btn-shot', takeShot);
bindBtn('#btn-intro', () => openIntro('features'));
bindBtn('#btn-cars', () => openIntro('cars'));

$('#clip-slider').addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  state.clipPos = v;
  const on = v < CLIP_OFF;
  if (on !== state.clip) {
    state.clip = on;
    $('#btn-clip').classList.toggle('active', on);
    $('#btn-clip').textContent = on ? '剖切 · 开' : '剖切';
  }
  $('#clip-val').textContent = on ? v + ' cm' : '关';
  applyClip();
  renderer.shadowMap.needsUpdate = true;
  syncModeStat();
});

/* ================= 画质档位 =================
   high：辉光 + 阴影 + 粒子 + 1.5x 像素比
   low ：关闭辉光/阴影/粒子，像素比 1 —— 集显或高分屏下的主要保帧手段 */
function setQuality(q, auto) {
  state.quality = q;
  if (!auto) state.autoQuality = false;
  const low = q === 'low';
  bloom.enabled = !low;
  renderer.shadowMap.enabled = !low;
  particles.visible = !low;
  // 环境反射（IBL）在集显上是明显的片元开销，流畅档位下关闭
  scene.environment = low ? null : envTex;
  renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.needsUpdate = true;
  // 透射材质（玻璃）会让 three 每帧额外渲染一遍场景，流畅画质下退化为普通半透明
  for (const [, rec] of parts) {
    for (const m of rec.mats) {
      const mat = m.mat;
      if (!mat.transmission) continue;
      if (low) { mat.__trans = mat.transmission; mat.transmission = 0; mat.needsUpdate = true; }
      else if (mat.__trans != null) { mat.transmission = mat.__trans; mat.needsUpdate = true; }
    }
  }
  onResize();
  const btn = $('#btn-quality');
  if (btn) {
    btn.textContent = low ? '画质：流畅' : '画质：高';
    btn.classList.toggle('active', low);
  }
  if (!auto) toast(low ? '已切换到流畅画质（关闭辉光 / 阴影 / 粒子）' : '已切换到高画质');
}

/* 拆解滑块 */
$('#explode-slider').addEventListener('input', e => {
  const v = parseFloat(e.target.value);
  state.targetExplode = v;
  $('#explode-val').textContent = Math.round(v * 100) + '%';
  $('#btn-explode-all').classList.toggle('active', v > 0.5);
  $('#btn-explode-all').textContent = v > 0.5 ? '全部合拢' : '全部拆解';
});

/* 转速滑块 */
$('#rpm-slider').addEventListener('input', e => {
  state.rpm = parseFloat(e.target.value);
  $('#rpm-val').textContent = state.rpm + ' rpm';
});

/* ================= 提示条 ================= */
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ================= 应用介绍浮层 ================= */
const INTRO_SEEN = 'ea839_intro_seen';
const INTRO_AUTO = 'ea839_intro_auto';

function carCard(v) {
  return `
    <div class="car-card${v.hot ? ' hot' : ''}">
      <div class="car-name">${v.name}</div>
      <div class="car-meta"><span>${v.code}</span><i>/</i><span>${v.years}</span></div>
      <div class="car-num">
        <div><span class="k">POWER</span><span class="v am">${v.power}</span></div>
        <div><span class="k">TORQUE</span><span class="v am">${v.torque}</span></div>
        <div><span class="k">0–100</span><span class="v">${v.acc}</span></div>
        <div><span class="k">V-MAX</span><span class="v">${v.top}</span></div>
      </div>
      <div class="car-note">${v.note}</div>
    </div>`;
}

const INTRO_RENDER = {
  features: () => `
    <div class="sec-head">
      <h3>功能介绍 · FEATURES</h3>
      <p>本应用以保时捷 / 大众集团 EA839 4.0 TFSI V8 为对象，构建可交互的三维拆解教学模型。
         除基础拆解与运转演示外，新增 X 光透视、剖切视图、视角预设、部件隐藏、轨迹引导、自动导览与截图导出等能力，
         可直接用于课堂讲解、展厅展示与技术培训。</p>
    </div>
    <div class="feat-grid">
      ${FEATURES.map(f => `
        <div class="feat-card">
          <div class="feat-top">
            <div class="feat-ico">${f.icon}</div>
            <div class="feat-name">${f.title}</div>
            <span class="feat-tag${f.tag === 'NEW' ? ' new' : ''}">${f.tag}</span>
          </div>
          <div class="feat-desc">${f.desc}</div>
        </div>`).join('')}
    </div>`,

  cars: () => `
    <div class="car-sec">
      <div class="sec-head">
        <h3>${VEHICLES.porsche.title}</h3>
        <p>${VEHICLES.porsche.sub}</p>
      </div>
      <div class="car-grid">${VEHICLES.porsche.list.map(carCard).join('')}</div>
    </div>
    <div class="car-sec">
      <div class="sec-head">
        <h3>${VEHICLES.family.title}</h3>
        <p>${VEHICLES.family.sub} —— 同一 90° V8 hot-V 基础架构，依据品牌定位进行增压压力、冷却与传动匹配差异化标定。</p>
      </div>
      <div class="car-grid">${VEHICLES.family.list.map(carCard).join('')}</div>
    </div>`,

  spec: () => `
    <div class="sec-head">
      <h3>整机技术规格 · SPECIFICATIONS</h3>
      <p>下表为本页面展示车型（Cayenne Turbo / Panamera Turbo，550 PS 版本）的整机参数。</p>
    </div>
    <div class="spec-grid">
      ${SPECS.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('')}
    </div>
    <div class="sec-head" style="margin-top:24px">
      <h3>结构亮点 · ENGINEERING HIGHLIGHTS</h3>
      <p>在模型中可对应到具体部件，点击部件即可查看该结构的图文说明。</p>
    </div>
    <div class="hl-list">
      <div><b>hot-V 布置</b><span>双涡轮置于两列气缸夹角内侧，缩短排气路径、减小涡轮迟滞，同时收窄整机宽度 —— 对应「进气增压」分组。</span></div>
      <div><b>无缸套 PLS 涂层</b><span>缸孔采用等离子喷涂铁基涂层取代铸铁缸套，减重约 6.7 kg 并改善导热 —— 对应「铝合金缸体」。</span></div>
      <div><b>干式油底壳</b><span>降低发动机高度与整车重心，满足高性能车型极限横向加速度下的供油需求 —— 对应「油底壳与集油盘」。</span></div>
      <div><b>COD 闭缸</b><span>低负荷工况关闭 2/3/5/8 缸，配合 48V 系统降低巡航油耗 —— 对应「气门与弹簧组件」与凸轮轴相位。</span></div>
      <div><b>350 bar 双喷射</b><span>缸内直喷 + 进气道喷射两套系统，兼顾高负荷功率输出与低负荷颗粒物排放 —— 对应「燃油喷油器」。</span></div>
    </div>`,

  keys: () => `
    <div class="sec-head">
      <h3>操作方式与快捷键 · SHORTCUTS</h3>
      <p>鼠标与键盘均可完成全部操作；输入框聚焦时快捷键自动失效，避免与搜索冲突。</p>
    </div>
    <div class="key-grid">
      ${KEYS.map(([k, v]) => `<div class="key-item"><span class="k">${k}</span><span>${v}</span></div>`).join('')}
    </div>`,
};

let introTab = 'features';
function renderIntro() {
  $('#intro-body').innerHTML = INTRO_RENDER[introTab]();
  $('#intro-body').scrollTop = 0;
  $$('.itab').forEach(el => el.classList.toggle('active', el.dataset.tab === introTab));
}
function openIntro(tab) {
  introTab = tab || introTab;
  renderIntro();
  $('#intro').classList.remove('hidden');
}
function closeIntro() {
  $('#intro').classList.add('hidden');
  try { localStorage.setItem(INTRO_SEEN, '1'); } catch (_) { /* 隐私模式忽略 */ }
}

$$('.itab').forEach(el => el.addEventListener('click', () => { introTab = el.dataset.tab; renderIntro(); }));
$('#intro-close').addEventListener('click', closeIntro);
$('#intro-mask').addEventListener('click', closeIntro);
$('#intro-auto').addEventListener('change', e => {
  try { localStorage.setItem(INTRO_AUTO, e.target.checked ? '1' : '0'); } catch (_) { }
});

/* ================= 键盘 ================= */
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  // ESC 优先关闭浮层；输入框内也生效，方便随时退出
  if (k === 'escape') {
    if (!$('#intro').classList.contains('hidden')) closeIntro();
    else selectPart(null);
    return;
  }
  if (e.target.tagName === 'INPUT') return;
  switch (k) {
    case '1': applyView(0); break;
    case '2': applyView(1); break;
    case '3': applyView(2); break;
    case '4': applyView(3); break;
    case 'x': setXray(!state.xray); break;
    case 'c': setClip(!state.clip); break;
    case 'g': setTrails(!state.trails); break;
    case 'h': e.shiftKey ? showAllHidden() : toggleHide(state.selected || state.hover); break;
    case 't': state.tour ? stopTour() : startTour(); break;
    case 'p': takeShot(); break;
    case 'i': $('#intro').classList.contains('hidden') ? openIntro(introTab) : closeIntro(); break;
    case 'e': $('#btn-explode-all').click(); break;
    case 'r': $('#btn-reset').click(); break;
    case 'space': e.preventDefault(); $('#btn-run').click(); break;
    case 'f': $('#btn-focus').click(); break;
    case 'l': $('#btn-labels').click(); break;
    case 'q': $('#btn-quality').click(); break;
  }
});

/* ================= 尺寸自适应 ================= */
function onResize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  // 后处理的 RT 必须按「绘制缓冲」尺寸（含像素比）设置，
  // 传 CSS 尺寸会让画面被降采样而发虚
  const pr = renderer.getPixelRatio();
  composer.setSize(w * pr, h * pr);
}
addEventListener('resize', onResize);

/* ================= 动画循环 ================= */
const clock = new THREE.Clock();
let fpsAcc = 0, fpsCount = 0, lowStreak = 0, lastPickAt = 0;
let kinDirty = true;                       // 运动学/火焰只在运转或状态变化时重算
let anchorsReady = false;                  // 标注锚点世界坐标是否已算过
const _v1 = new THREE.Vector3();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  state.frame++;

  // FPS 统计 + 帧率过低时自动降级
  fpsAcc += dt; fpsCount++;
  if (fpsAcc > 0.5) {
    state.fps = Math.round(fpsCount / fpsAcc);
    $('#fps').textContent = state.fps;
    fpsAcc = 0; fpsCount = 0;
    if (state.autoQuality && state.quality === 'high' && state.fps < 34) {
      if (++lowStreak >= 3) {
        lowStreak = 0;
        setQuality('low', true);
        toast('检测到帧率偏低，已自动切换到流畅画质（可按 Q 切回）');
      }
    } else {
      lowStreak = 0;
    }
  }

  // 悬停拾取：节流到约 11 次/秒
  if (pendingPick && performance.now() - lastPickAt > 90) {
    lastPickAt = performance.now();
    const id = pickAt(pendingPick.x, pendingPick.y);
    pendingPick = null;
    if (id !== state.hover) {
      state.hover = id;
      canvas.classList.toggle('pickable', !!id);
      applyHighlight();
    }
  }

  // 拆解插值
  let moving = false;
  const mStep = Math.min(1, dt * 4.2), sStep = Math.min(1, dt * 5.0);
  if (Math.abs(state.targetExplode - state.master) > 0.002) moving = true;
  state.master += (state.targetExplode - state.master) * mStep;
  for (const [id, rec] of parts) {
    const ps = partState.get(id);
    const soloTarget = state.exploded.has(id) ? 1 : 0;
    if (Math.abs(soloTarget - ps.solo) > 0.002) moving = true;
    ps.solo += (soloTarget - ps.solo) * sStep;
    const amount = Math.max(state.master, ps.solo);
    rec.group.position.copy(rec.offset).multiplyScalar(amount);
    rec.group.userData.amount = amount;
  }

  // 拆解展开时相机自动后撤，保证全部部件留在视口内。
  // 只在「拆解动画进行中」触发：否则会在用户手动切换视角预设后立刻把相机拽回去。
  let soloMax = 0;
  for (const id of state.exploded) soloMax = Math.max(soloMax, partState.get(id)?.solo || 0);
  const spread = Math.max(state.master, soloMax);
  {
    const wantDist = baseDist * (1 + spread * 0.92);
    const wantTargetY = 6 + spread * 6;
    const curDist = camera.position.distanceTo(controls.target);
    if (moving && !camAnim && (Math.abs(curDist - wantDist) > 6 || Math.abs(controls.target.y - wantTargetY) > 2)) {
      _v1.subVectors(camera.position, controls.target).normalize();
      camAnim = {
        t: 0, dur: 0.7,
        fromT: controls.target.clone(), toT: new THREE.Vector3(0, wantTargetY, 0),
        fromP: camera.position.clone(),
        toP: new THREE.Vector3(0, wantTargetY, 0).add(_v1.multiplyScalar(wantDist)),
      };
    }
  }

  // 运动学：静止时完全跳过（旧实现即使停机也每帧重算 8 缸曲柄连杆）
  if (state.running) {
    state.crankAngle += (state.rpm / 60) * Math.PI * 2 * dt;
    if (state.crankAngle > Math.PI * 2) state.crankAngle -= Math.PI * 2;
    kinDirty = true;
  }
  if (kinDirty) {
    updateKinematics(state.crankAngle);
    updateFlames(state.crankAngle, state.running);
    kinDirty = state.running;
  }

  // 阴影只在有物体移动时重画（静态时省掉一遍阴影贴图渲染）
  if (moving || state.running) renderer.shadowMap.needsUpdate = true;

  // 相机动画
  if (camAnim) {
    camAnim.t += dt;
    const t = Math.min(1, camAnim.t / camAnim.dur);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
    camera.position.lerpVectors(camAnim.fromP, camAnim.toP, e);
    if (t >= 1) camAnim = null;
  }

  // 辉光脉动
  const pulse = 0.55 + Math.sin(state.frame * 0.045) * 0.16;
  bloom.strength = pulse + state.master * 0.5;
  core.intensity = 240 + Math.sin(state.frame * 0.06) * 70 + state.master * 200;
  under.intensity = 200 + Math.sin(state.frame * 0.04) * 60;
  glowRing.material.opacity = 0.07 + state.master * 0.16;
  glowRing2.material.opacity = 0.10 + state.master * 0.24;
  glowRing2.rotation.z = state.frame * 0.0016;
  glowRing.rotation.z = -state.frame * 0.0009;
  particles.rotation.y = state.frame * 0.00035;

  // 标注锚点的世界坐标只随部件移动变化（与相机无关），故仅在拆解/运转时重算
  if (moving || !anchorsReady) {
    for (const [id, rec] of parts) {
      if (!rec.label) continue;
      if (!rec.group.userData.labelWorld) rec.group.userData.labelWorld = new THREE.Vector3();
      if (!rec.group.userData.labelLocal) rec.group.userData.labelLocal = new THREE.Vector3(...rec.label);
      rec.group.localToWorld(rec.group.userData.labelWorld.copy(rec.group.userData.labelLocal));
    }
    anchorsReady = true;
  }

  controls.update();

  // 自动导览：按装配顺序依次聚焦并拆解关键部件
  if (state.tour) stepTour(dt);

  // 轨迹引导线：开启即显示，透明度随拆解程度增强
  trails.visible = state.trails;
  if (state.trails) trails.material.opacity = 0.12 + Math.min(1, spread * 1.6) * 0.34;

  updateLabels();
  composer.render();

  // 截图必须紧跟渲染：WebGL 不保留绘制缓冲
  if (shotPending) { shotPending = false; doShot(); }
}

/* ================= 启动 ================= */
buildCatalog();
showDetail(null);
ensureLabels();
onResize();                                   // 统一后处理缓冲尺寸
$('#btn-labels').classList.toggle('active', state.labelMode !== 0);
$$('[data-view]')[0]?.classList.add('active');
syncModeStat();
tick();

setTimeout(() => {
  $('#loader').classList.add('hide');
  toast('点击模型任意部件开始交互式拆解 · 按 I 查看应用介绍');
}, 420);

// 首次访问自动打开应用介绍（可在浮层底部关闭）
// 地址栏 #intro=0 直接跳过，#intro=cars|spec|keys 可直达指定标签页
try {
  const m = /intro=([\w]+)/.exec(location.hash);
  const want = m ? m[1] : null;
  const auto = localStorage.getItem(INTRO_AUTO);
  $('#intro-auto').checked = auto !== '0';
  if (want && want !== '0') setTimeout(() => openIntro(INTRO_RENDER[want] ? want : 'features'), 760);
  else if (!want && !localStorage.getItem(INTRO_SEEN) && auto !== '0') {
    setTimeout(() => openIntro('features'), 760);
  }
} catch (_) { /* 隐私模式下跳过 */ }


// 支持 #explode / #select=<id> / #run 预置视图状态
(function applyHashState() {
  const h = (location.hash || '').replace('#', '');
  if (!h) return;
  const q = new URLSearchParams(h.includes('=') ? h : 'm=' + h);
  if (q.get('explode')) {
    const v = parseFloat(q.get('explode'));
    state.targetExplode = isNaN(v) ? 1 : v;
    $('#explode-slider').value = state.targetExplode;
    $('#explode-val').textContent = Math.round(state.targetExplode * 100) + '%';
    $('#btn-explode-all').classList.toggle('active', state.targetExplode > 0.5);
    $('#btn-explode-all').textContent = state.targetExplode > 0.5 ? '全部合拢' : '全部拆解';
  }
  const sel = q.get('select');
  if (sel && parts.has(sel)) {
    state.selected = sel;
    state.exploded.add(sel);
    $$('.cat-item').forEach(el => {
      el.classList.toggle('sel', el.dataset.id === sel);
      el.classList.toggle('exploded', el.dataset.id === sel);
    });
    showDetail(PART_MAP[sel]);
    applyHighlight();
  }
  if (q.get('run')) {
    state.running = true;
    state.rpm = parseFloat(q.get('rpm')) || 600;
    $('#btn-run').classList.add('active');
    $('#btn-run').textContent = '停止运转';
    $('#rpm-slider').value = state.rpm;
    $('#rpm-val').textContent = state.rpm + ' rpm';
  }
  if (q.get('spin')) { controls.autoRotate = true; $('#btn-spin').classList.add('active'); }
  if (q.get('q') === 'low') setQuality('low', true);
})();

window.__ea839 = { scene, camera, parts, state, renderer, controls, selectPart, toggleExplode, focusPart };
