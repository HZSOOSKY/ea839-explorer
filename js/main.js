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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
key.shadow.mapSize.set(2048, 2048);
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
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.72, 0.82);
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
  showLabels: true,
  showAllLabels: false,
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

canvas.addEventListener('pointermove', e => {
  if (e.buttons) return;
  const id = pickAt(e.clientX, e.clientY);
  if (id !== state.hover) {
    state.hover = id;
    canvas.classList.toggle('pickable', !!id);
    applyHighlight();
  }
});

/* ================= 标注 ================= */
const labelEls = new Map();
const labelLayer = $('#labels');
const leaderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
leaderSvg.setAttribute('id', 'leaders');
leaderSvg.style.width = '100%';
leaderSvg.style.height = '100%';
labelLayer.appendChild(leaderSvg);

function ensureLabels() {
  for (const [id, rec] of parts) {
    if (labelEls.has(id)) continue;
    const el = document.createElement('div');
    el.className = 'lbl';
    el.innerHTML = `<span class="idx">${String(PARTS.findIndex(p => p.id === id) + 1).padStart(2, '0')}</span><span class="tx"></span>`;
    el.querySelector('.tx').textContent = PART_MAP[id] ? PART_MAP[id].name : id;
    labelLayer.appendChild(el);
    labelEls.set(id, el);
  }
}

const _wp = new THREE.Vector3();
function updateLabels() {
  ensureLabels();
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const show = state.showLabels && (state.showAllLabels || state.selected || state.exploded.size || state.master > 0.05);

  // 收集可见标签的屏幕坐标，随后做垂直避让与左右分侧排布
  const items = [];
  for (const [id, rec] of parts) {
    const el = labelEls.get(id);
    if (!el) continue;
    const anchor = rec.group.userData.labelWorld;
    if (!anchor) { el.classList.remove('show'); continue; }
    _wp.copy(anchor);
    const dist = _wp.distanceTo(camera.position);
    _wp.project(camera);
    const visible = _wp.z < 1 && Math.abs(_wp.x) < 1.25 && Math.abs(_wp.y) < 1.2;
    if (!visible || !show) { el.classList.remove('show'); continue; }
    items.push({
      id, el, dist,
      x: (_wp.x * 0.5 + 0.5) * innerWidth,
      y: (-_wp.y * 0.5 + 0.5) * innerHeight,
      isSel: state.selected === id,
    });
  }

  // 选中项优先占据其位置，其余按屏幕 Y 排序后分左右两列避让
  items.sort((a, b) => (b.isSel - a.isSel) || (a.y - b.y));
  const LH = 20;                       // 标签最小行高
  const leftCol = [], rightCol = [];
  const midX = innerWidth * 0.5;
  for (const it of items) {
    const col = it.x < midX ? leftCol : rightCol;
    // 在本列中找到不与已放置标签冲突的 Y
    let y = it.y;
    let guard = 0;
    while (guard++ < 40 && col.some(c => Math.abs(c - y) < LH)) {
      y += LH;
      if (y > innerHeight - 70) { y = it.y - LH * col.length; break; }
    }
    col.push(y);
    it.ly = y;
    it.side = it.x < midX ? -1 : 1;
  }

  for (const it of items) {
    const el = it.el;
    const off = it.side < 0 ? -14 : 14;
    // 标签位于锚点外侧，文字对齐方向随左右翻转
    el.style.transform = `translate(${it.x + off}px, ${it.ly}px) translateY(-50%)${it.side < 0 ? ' translateX(-100%)' : ''}`;
    el.style.textAlign = it.side < 0 ? 'right' : 'left';
    el.classList.add('show');
    el.classList.toggle('sel', it.isSel);
    el.style.opacity = it.isSel ? '1' : String(Math.max(0.28, Math.min(1, 130 / it.dist)));
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
  state.showAllLabels = !state.showAllLabels;
  $('#btn-labels').classList.toggle('active', state.showAllLabels);
  toast(state.showAllLabels ? '显示全部部件标注' : '仅显示选中/拆解部件标注');
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
  }
});

/* ================= 尺寸自适应 ================= */
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);

/* ================= 动画循环 ================= */
const clock = new THREE.Clock();
let fpsAcc = 0, fpsCount = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());
  state.frame++;

  // FPS
  fpsAcc += dt; fpsCount++;
  if (fpsAcc > 0.5) {
    state.fps = Math.round(fpsCount / fpsAcc);
    $('#fps').textContent = state.fps;
    fpsAcc = 0; fpsCount = 0;
  }

  // 拆解插值
  state.master += (state.targetExplode - state.master) * Math.min(1, dt * 4.2);
  for (const [id, rec] of parts) {
    const ps = partState.get(id);
    const soloTarget = state.exploded.has(id) ? 1 : 0;
    ps.solo += (soloTarget - ps.solo) * Math.min(1, dt * 5.0);
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
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      camAnim = {
        t: 0, dur: 0.7,
        fromT: controls.target.clone(), toT: new THREE.Vector3(0, wantTargetY, 0),
        fromP: camera.position.clone(),
        toP: new THREE.Vector3(0, wantTargetY, 0).add(dir.multiplyScalar(wantDist)),
      };
    }
  }

  // 运动学
  if (state.running) {
    state.crankAngle += (state.rpm / 60) * Math.PI * 2 * dt;
    if (state.crankAngle > Math.PI * 2) state.crankAngle -= Math.PI * 2;
  }
  updateKinematics(state.crankAngle);
  updateFlames(state.crankAngle, state.running);

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

  // 标注锚点随拆解移动（锚点为部件组局部坐标，随组位移自动跟随）
  for (const [id, rec] of parts) {
    if (!rec.label) continue;
    if (!rec.group.userData.labelWorld) rec.group.userData.labelWorld = new THREE.Vector3();
    if (!rec.group.userData.labelLocal) rec.group.userData.labelLocal = new THREE.Vector3(...rec.label);
    rec.group.localToWorld(rec.group.userData.labelWorld.copy(rec.group.userData.labelLocal));
  }

  controls.update();
  updateLabels();
  composer.render();
}

/* ================= 启动 ================= */
buildCatalog();
showDetail(null);
ensureLabels();
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
