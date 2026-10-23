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

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ================= 渲染器 / 场景 ================= */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
// 像素比上限 1.5：2.0 在高 DPI 屏上会让片元数与后处理开销翻倍，是掉帧的主因之一
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// 阴影改为按需更新：方向光阴影与相机无关，只有部件移动（拆解/运转）时才需要重画
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x040810, 0.0042);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 800);
camera.position.set(104, 70, 74);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 40;
controls.maxDistance = 400;
controls.maxPolarAngle = Math.PI * 0.88;
controls.target.set(0, 6, 0);
controls.autoRotateSpeed = 0.55;

/* ================= 灯光 ================= */
scene.add(new THREE.AmbientLight(0x36546a, 0.75));
scene.add(new THREE.HemisphereLight(0x5a8fb5, 0x0d141c, 0.95));

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
}

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
};

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
    if (o && o.userData.partId) return o.userData.partId;
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
    fromP: camera.position.clone(), toP: new THREE.Vector3(104, 70, 74),
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

/* ================= 键盘 ================= */
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key.toLowerCase()) {
    case 'escape': selectPart(null); break;
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

  // 拆解展开时相机自动后撤，保证全部部件留在视口内
  {
    let soloMax = 0;
    for (const id of state.exploded) soloMax = Math.max(soloMax, partState.get(id)?.solo || 0);
    const spread = Math.max(state.master, soloMax);
    const wantDist = 118 + spread * 150;
    const wantTargetY = 6 + spread * 6;
    const curDist = camera.position.distanceTo(controls.target);
    if (!camAnim && (Math.abs(curDist - wantDist) > 6 || Math.abs(controls.target.y - wantTargetY) > 2)) {
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
  updateLabels();
  composer.render();
}

/* ================= 启动 ================= */
buildCatalog();
showDetail(null);
ensureLabels();
onResize();                                   // 统一后处理缓冲尺寸
$('#btn-labels').classList.toggle('active', state.labelMode !== 0);
tick();

setTimeout(() => {
  $('#loader').classList.add('hide');
  toast('点击模型任意部件开始交互式拆解');
}, 420);


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
})();

window.__ea839 = { scene, camera, parts, state, renderer, controls, selectPart, toggleExplode, focusPart };
