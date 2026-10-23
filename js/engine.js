/**
 * EA839 4.0 V8 — 全程序化几何构建
 * 所有形体均由 Three.js 基础几何/曲线生成，不依赖任何外部模型文件。
 *
 * 坐标系：X=横向(右正) Y=竖向(上正) Z=纵向(前正)，单位 cm。
 *
 * 运动学（标准 90° V8 曲拐）：
 *   · 4 个共用曲拐销，每销承受左右两列各一根连杆，两杆互成 90°。
 *   · 右列滑块角 ψ = θ_k + Θ，左列滑块角 ψ_L = −ψ − 90°。
 *   · 由此点火顺序为 1-8-4-3-6-5-7-2（每 90° 曲轴转角一次），
 *     与 EA839 4.0 V8 实机一致。
 */
import * as THREE from 'three';

const S = Math.SQRT1_2; // sin45 = cos45

/* ============ 尺寸常量（cm） ============ */
export const DIM = {
  bore: 8.6,            // 缸径 86mm
  stroke: 8.6,          // 行程 86mm
  rodLen: 14.6,         // 连杆中心距 146mm
  crankThrow: 4.3,      // 曲柄半径 = 行程/2
  boreSpacing: 11.0,   // 气缸中心距
  deck: 22.5,           // 缸盖接合面（沿气缸轴线，自曲轴中心）
  headH: 11.0,
  coverH: 7.0,
};

/* 气缸中心距位置（Z，自前向后） */
export const CYL_Z = [16.5, 5.5, -5.5, -16.5];

/**
 * 每行的曲拐相位与缸号。
 * ψ = theta + Θ 为右列滑块角；左列滑块角 = −ψ − 90°。
 * 行序：左列 1-3-5-7，右列 8-6-4-2（自前向后）。
 */
export const ROWS = [
  { z: 16.5, theta: 3 * Math.PI / 2, cylL: 1, cylR: 8 },
  { z: 5.5, theta: 0, cylL: 3, cylR: 6 },
  { z: -5.5, theta: 2 * Math.PI, cylL: 5, cylR: 4 },
  { z: -16.5, theta: Math.PI / 2, cylL: 7, cylR: 2 },
];

/* 气缸轴线与横向面内的正交方向（局部 +X = Z × U，保证右手系） */
const U_R = new THREE.Vector3(S, S, 0);
const U_L = new THREE.Vector3(-S, S, 0);
const V_R = new THREE.Vector3(S, -S, 0);
const V_L = new THREE.Vector3(S, S, 0);

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/* ================= 材质 ================= */
function buildMaterials() {
  return {
    aluBlock:   new THREE.MeshStandardMaterial({ color: 0x99a3ae, metalness: 0.76, roughness: 0.46 }),
    aluHead:    new THREE.MeshStandardMaterial({ color: 0x9fa8b4, metalness: 0.72, roughness: 0.34 }),
    castAlu:    new THREE.MeshStandardMaterial({ color: 0x77818d, metalness: 0.60, roughness: 0.62 }),
    steel:      new THREE.MeshStandardMaterial({ color: 0x6d7783, metalness: 0.95, roughness: 0.24 }),
    steelDark:  new THREE.MeshStandardMaterial({ color: 0x474f59, metalness: 0.90, roughness: 0.44 }),
    piston:     new THREE.MeshStandardMaterial({ color: 0xc6ccd4, metalness: 0.82, roughness: 0.29 }),
    plastic:    new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.22, roughness: 0.55 }),
    plasticMid: new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: 0.30, roughness: 0.50 }),
    rubber:     new THREE.MeshStandardMaterial({ color: 0x0d0f12, metalness: 0.04, roughness: 0.94 }),
    turboShell: new THREE.MeshStandardMaterial({ color: 0x8d8375, metalness: 0.84, roughness: 0.56 }),
    inconel:    new THREE.MeshStandardMaterial({ color: 0x6b655d, metalness: 0.90, roughness: 0.50 }),
    brass:      new THREE.MeshStandardMaterial({ color: 0xae8b49, metalness: 0.90, roughness: 0.31 }),
    ceramic:    new THREE.MeshStandardMaterial({ color: 0xe6e2da, metalness: 0.02, roughness: 0.42 }),
    glass:      new THREE.MeshPhysicalMaterial({ color: 0x9fd0e4, metalness: 0, roughness: 0.08, transmission: 0.82, thickness: 0.5, transparent: true, opacity: 0.55 }),
    filterBody: new THREE.MeshStandardMaterial({ color: 0x2b3640, metalness: 0.52, roughness: 0.48 }),
    wire:       new THREE.MeshStandardMaterial({ color: 0x191c21, metalness: 0.12, roughness: 0.86 }),
    hotMetal:   new THREE.MeshStandardMaterial({ color: 0x3a2a1e, metalness: 0.72, roughness: 0.68, emissive: 0x1a0800, emissiveIntensity: 1 }),
    flame:      new THREE.MeshBasicMaterial({ color: 0xffa33c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}

/* ================= 几何工具 ================= */
function add(geo, mat, parent, pos, rot, scale) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** 沿任意轴向的圆柱 */
function cyl(rTop, rBot, h, mat, parent, pos, axis = 'y', seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  const m = new THREE.Mesh(g, mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function tubeFrom(points, radius, mat, parent, tubular = 48, radial = 12, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])), closed, 'catmullrom', 0.4);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, radius, radial, closed), mat);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
/** 旋转体：profile 为 [r,y] 数组，轴向沿 Y */
function lathe(profile, mat, parent, pos, rot, seg = 32) {
  const pts = profile.map(p => new THREE.Vector2(p[0], p[1]));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
/** 带齿的链轮/齿轮（2D Shape 挤出，轴向沿 Z） */
function gearGeometry(radius, teeth, toothDepth, thickness, boreR) {
  const shape = new THREE.Shape();
  const step = Math.PI * 2 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const pts = [
      [radius - toothDepth * 0.4, a0 + step * 0.06],
      [radius - toothDepth * 0.4, a0 + step * 0.22],
      [radius, a0 + step * 0.40],
      [radius, a0 + step * 0.60],
      [radius - toothDepth * 0.4, a0 + step * 0.78],
      [radius - toothDepth * 0.4, a0 + step * 0.94],
    ];
    pts.forEach((p, k) => {
      const x = Math.cos(p[1]) * p[0], y = Math.sin(p[1]) * p[0];
      if (i === 0 && k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  if (boreR > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, boreR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, curveSegments: 8 });
}
/** 螺旋弹簧 */
function springGeometry(radius, height, coils, wire) {
  const pts = [];
  const steps = coils * 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * coils * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, wire, 7, false);
}

/* ================= 主构建 ================= */
export function buildEngine() {
  const M = buildMaterials();
  const root = new THREE.Group();
  root.name = 'EA839';
  const parts = new Map();

  /**
   * 收集需要保持独立的动画对象（曲轴、活塞、连杆、涡轮叶轮、火焰等）。
   * 它们被 updateKinematics / updateFlames 逐帧驱动，不能参与几何合并。
   */
  function collectDynamic(g, set) {
    const mark = o => { if (o && o.isObject3D) o.traverse(x => set.add(x)); };
    g.traverse(o => {
      const ud = o.userData;
      if (!ud) return;
      for (const k of Object.keys(ud)) {
        const v = ud[k];
        if (v && v.isObject3D) mark(v);
        else if (Array.isArray(v)) {
          for (const it of v) {
            if (it && it.isObject3D) mark(it);
            else if (it && typeof it === 'object') {
              for (const w of Object.values(it)) mark(w);
            }
          }
        }
      }
    });
  }

  /**
   * 同一部件内，把「材质相同且非动画对象」的网格合并为单个网格，
   * 变换烘焙进几何。原实现每台发动机有 770+ 个独立网格与材质实例，
   * 合并后降到百余个，draw call 与材质切换开销大幅下降。
   */
  function mergeStaticMeshes(g, dynamic) {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const local = new THREE.Matrix4();

    const list = [];
    g.traverse(o => { if (o.isMesh && !dynamic.has(o)) list.push(o); });
    if (list.length < 2) return 0;

    const buckets = new Map();
    for (const o of list) {
      if (!o.material || !o.geometry) continue;
      let b = buckets.get(o.material);
      if (!b) buckets.set(o.material, b = []);
      b.push(o);
    }

    let reduced = 0;
    for (const [mat, objs] of buckets) {
      if (objs.length < 2) continue;
      const first = objs[0].geometry;
      const keys = Object.keys(first.attributes).sort();
      const sig = keys.join(',');
      const hasIndex = !!first.index;
      let ok = !!first.attributes.position;
      for (const o of objs) {
        const gg = o.geometry;
        if (!gg || !gg.attributes.position) { ok = false; break; }
        if (Object.keys(gg.attributes).sort().join(',') !== sig) { ok = false; break; }
        if (!!gg.index !== hasIndex) { ok = false; break; }
        for (const k of keys) {
          if (gg.attributes[k].isInterleavedBufferAttribute) { ok = false; break; }
        }
        if (!ok) break;
      }
      if (!ok) continue;

      // 逐网格克隆并把相对部件组的变换烘焙进几何（不污染可能被共享的原始几何）
      const baked = objs.map(o => {
        const c = o.geometry.clone();
        local.multiplyMatrices(inv, o.matrixWorld);
        c.applyMatrix4(local);
        return c;
      });

      let vCount = 0, iCount = 0;
      for (const gg of baked) {
        vCount += gg.attributes.position.count;
        iCount += hasIndex ? gg.index.count : 0;
      }
      const attrs = {};
      for (const k of keys) attrs[k] = new Float32Array(vCount * first.attributes[k].itemSize);
      let idxArr = null;
      if (hasIndex) {
        const Ctor = vCount > 65535 ? Uint32Array : Uint16Array;
        idxArr = new Ctor(iCount);
      }

      let vo = 0, io = 0;
      for (const gg of baked) {
        const n = gg.attributes.position.count;
        for (const k of keys) {
          const src = gg.attributes[k];
          attrs[k].set(src.array.subarray(0, n * src.itemSize), vo * src.itemSize);
        }
        if (hasIndex) {
          const gi = gg.index.array;
          for (let i = 0; i < gi.length; i++) idxArr[io + i] = gi[i] + vo;
          io += gi.length;
        }
        vo += n;
        gg.dispose();
      }

      const merged = new THREE.BufferGeometry();
      for (const k of keys) {
        merged.setAttribute(k, new THREE.BufferAttribute(attrs[k], first.attributes[k].itemSize));
      }
      if (idxArr) merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
      merged.computeBoundingSphere();
      merged.computeBoundingBox();

      for (const o of objs) if (o.parent) o.parent.remove(o);
      const nm = new THREE.Mesh(merged, mat);
      nm.castShadow = true; nm.receiveShadow = true;
      g.add(nm);
      reduced += objs.length - 1;
    }
    return reduced;
  }

  function part(id, buildFn, opts = {}) {
    const g = new THREE.Group();
    g.name = id;
    buildFn(g);

    // 1) 先识别动画对象，再把静态网格按材质合并
    const dynamic = new Set();
    collectDynamic(g, dynamic);
    mergeStaticMeshes(g, dynamic);

    const rec = { id, group: g, home: new THREE.Vector3(), offset: new THREE.Vector3(), mats: [], ...opts };
    // 2) 同一部件内「源材质相同」的网格共享一个克隆实例：
    //    既保留部件级高亮能力，又避免 700+ 份材质实例带来的 uniform 上传开销
    const shared = new Map();
    g.traverse(o => {
      if (!o.isMesh || !o.material) return;
      o.userData.partId = id;
      let m = shared.get(o.material);
      if (!m) {
        m = o.material.clone();
        shared.set(o.material, m);
        rec.mats.push({
          mat: m,
          base: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
          bi: m.emissiveIntensity,
        });
      }
      o.material = m;
    });
    root.add(g);
    parts.set(id, rec);
    return rec;
  }

  /**
   * 沿气缸轴线建立局部坐标系（局部 +Y → 气缸轴线 U，局部 +Z → 纵向）。
   * 先用 setFromUnitVectors 建立 Y→U 的旋转，再绕 U 轴补足 roll，
   * 使局部 Z 轴精确对齐世界纵向（避免 makeBasis 的存储序歧义）。
   */
  function bankFrame(side) {
    const grp = new THREE.Group();
    const U = side > 0 ? U_R : U_L;
    const V = side > 0 ? V_R : V_L;
    grp.quaternion.setFromUnitVectors(Y_AXIS, U);
    // 绕 U 轴旋转，使局部 +Z 对齐世界 +Z
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(grp.quaternion);
    const worldZ = new THREE.Vector3(0, 0, 1);
    const axis = new THREE.Vector3().crossVectors(localZ, worldZ);
    const sin = axis.length();
    if (sin > 1e-6) {
      const angle = Math.atan2(sin, localZ.dot(worldZ));
      grp.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(U, angle));
    }
    return { grp, U, V };
  }

  /* ---------- 缸体 ---------- */
  function buildBlock(g) {
    // 主裙部（曲轴箱下部）
    add(new THREE.BoxGeometry(23, 15, 45), M.aluBlock, g, [0, -8.5, 0]);
    // 油底壳法兰
    add(new THREE.BoxGeometry(24, 1.4, 46), M.aluBlock, g, [0, -16.6, 0]);
    // 主轴承座（5 道，环绕曲轴形成支承）
    for (let i = 0; i < 5; i++) {
      const z = -19.5 + i * 9.75;
      // 轴承座做成 U 形：底板 + 两侧立壁，保留中部观察窗口
      add(new THREE.BoxGeometry(15, 9, 3.2), M.aluBlock, g, [0, -11.0, z]);
      add(new THREE.BoxGeometry(3.4, 9, 3.2), M.aluBlock, g, [6.0, -7.5, z]);
      add(new THREE.BoxGeometry(3.4, 9, 3.2), M.aluBlock, g, [-6.0, -7.5, z]);
    }
    // 左右气缸列：只保留缸套外壁 + 前后端壁，中部镂空以显露活塞
    for (let side = -1; side <= 1; side += 2) {
      const { grp, U, V } = bankFrame(side);
      grp.position.copy(U).multiplyScalar(11.0);
      g.add(grp);
      // 缸套外壁（薄壁，围住缸孔）
      for (let i = 0; i < 4; i++) {
        const z = CYL_Z[i];
        // 缸孔外壁：四个薄板围成的方筒
        const w = 4.9, t = 1.5, hgt = 21;
        add(new THREE.BoxGeometry(w * 2 + t * 2, t, hgt), M.aluBlock, grp, [0, 0.5, z - 4.3 - t / 2]);
        add(new THREE.BoxGeometry(w * 2 + t * 2, t, hgt), M.aluBlock, grp, [0, 0.5, z + 4.3 + t / 2]);
        add(new THREE.BoxGeometry(t, hgt, w * 2), M.aluBlock, grp, [w + t / 2, 0.5, z]);
        add(new THREE.BoxGeometry(t, hgt, w * 2), M.aluBlock, grp, [-(w + t / 2), 0.5, z]);
      }
      // 气缸列外侧加强筋
      for (let i = 0; i < 4; i++) {
        add(new THREE.BoxGeometry(1.5, 8, 2.4), M.castAlu, grp, [7.6, 1.5, CYL_Z[i] + 3.2]);
      }
      // 缸列顶端横梁（与缸盖接合面）
      add(new THREE.BoxGeometry(12, 2.2, 46), M.aluBlock, grp, [0, 11.4, 0]);
    }
    // 前端正时腔壳体
    add(new THREE.BoxGeometry(23, 26, 4), M.aluBlock, g, [0, -3, -24.5]);
    // 后端飞轮壳法兰
    add(new THREE.BoxGeometry(25, 24, 2.4), M.castAlu, g, [0, -2, 24.5]);
    // 机油泵安装凸台
    add(new THREE.BoxGeometry(12, 11, 5), M.castAlu, g, [0, -13, -20]);
  }

  /* ---------- 油底壳 ---------- */
  function buildPan(g) {
    add(new THREE.BoxGeometry(22.4, 7, 43.6), M.castAlu, g, [0, -25, 0]);
    add(new THREE.BoxGeometry(18, 6, 39), M.castAlu, g, [0, -31, 0]);
    add(new THREE.BoxGeometry(14.5, 2.4, 33), M.castAlu, g, [0, -34.6, 0]);
    cyl(1.3, 1.3, 1.0, M.steel, g, [-4, -35.6, -9], 'y', 14);
    add(new THREE.BoxGeometry(0.5, 6, 39), M.steelDark, g, [0, -28, 0]);
    for (let i = 0; i < 8; i++) add(new THREE.BoxGeometry(20, 0.4, 1.6), M.steelDark, g, [0, -28.5, -17 + i * 5]);
  }

  /* ---------- 曲轴 ---------- */
  function buildCrank(g) {
    const rot = new THREE.Group();
    g.add(rot);
    for (let i = 0; i < 5; i++) cyl(2.8, 2.8, 3.6, M.steel, rot, [0, 0, -19.5 + i * 9.75], 'z', 26);
    // 4 个共用曲拐销
    for (let k = 0; k < 4; k++) {
      const z = ROWS[k].z;
      const th = ROWS[k].theta;
      // 右列参考方位下的曲拐销位置
      const p = U_R.clone().multiplyScalar(Math.cos(th) * DIM.crankThrow)
        .add(V_R.clone().multiplyScalar(Math.sin(th) * DIM.crankThrow));
      cyl(2.1, 2.1, 3.4, M.steel, rot, [p.x, p.y, z], 'z', 20);
      // 曲柄臂 / 平衡块（相对曲拐销反向）
      const cw = U_R.clone().multiplyScalar(Math.cos(th) * -2.1).add(V_R.clone().multiplyScalar(Math.sin(th) * -2.1));
      const w = add(new THREE.BoxGeometry(9.4, 4.2, 3.0), M.steel, rot, [cw.x, cw.y, z]);
      w.rotation.z = th - Math.PI / 2;
      const cw2 = U_R.clone().multiplyScalar(Math.cos(th) * -3.8).add(V_R.clone().multiplyScalar(Math.sin(th) * -3.8));
      const w2 = add(new THREE.BoxGeometry(8.0, 3.4, 3.4), M.steelDark, rot, [cw2.x, cw2.y, z]);
      w2.rotation.z = th - Math.PI / 2;
    }
    cyl(1.9, 1.9, 7, M.steel, rot, [0, 0, -24.5], 'z', 18);
    cyl(3.4, 3.4, 2.0, M.steel, rot, [0, 0, 22.6], 'z', 24);
    g.userData.crankRot = rot;
  }

  /* ---------- 活塞组 ---------- */
  /* 运动部件直接挂在部件根下（不经过气缸旋转坐标系），保证动画坐标正确 */
  function buildPistons(g) {
    const items = [];
    const flames = [];
    for (let side = -1; side <= 1; side += 2) {
      const U = side > 0 ? U_R : U_L;
      for (let i = 0; i < 4; i++) {
        const holder = new THREE.Group();
        g.add(holder);
        const body = new THREE.Group();
        body.quaternion.setFromUnitVectors(Y_AXIS, U);  // 缸套方向固定
        holder.add(body);
        lathe([[0, -3.2], [3.95, -3.2], [4.25, -2.0], [4.25, 2.4], [4.15, 3.0], [3.4, 3.3], [0, 3.3]],
          M.piston, body, [0, 0, 0], null, 30);
        for (let r = 0; r < 3; r++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(4.22, 0.16, 6, 28), M.steelDark);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 1.6 - r * 0.7;
          body.add(ring);
        }
        cyl(1.15, 1.15, 5.2, M.steel, body, [0, -0.6, 0], 'z', 16);
        items.push({ holder, body, U, row: i, side, index: items.length });

        // 燃烧闪光（点燃瞬间的火焰核心）
        const flame = new THREE.Mesh(new THREE.SphereGeometry(2.6, 14, 10), M.flame.clone());
        flame.material.opacity = 0;
        flame.userData.partId = 'pistons';
        g.add(flame);
        flames.push({ mesh: flame, U, row: i, side });
      }
    }
    g.userData.pistons = items;
    g.userData.flames = flames;
  }

  /* ---------- 连杆组 ---------- */
  function buildRods(g) {
    const items = [];
    for (let side = -1; side <= 1; side += 2) {
      const U = side > 0 ? U_R : U_L;
      for (let i = 0; i < 4; i++) {
        const holder = new THREE.Group();
        g.add(holder);
        const rod = new THREE.Group();
        holder.add(rod);
        const big = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.85, 10, 24), M.steel);
        rod.add(big);
        add(new THREE.BoxGeometry(1.5, DIM.rodLen - 3.2, 3.0), M.steel, rod, [0, (DIM.rodLen - 3.2) / 2 + 0.4, 0]);
        add(new THREE.BoxGeometry(0.7, DIM.rodLen - 4.0, 1.4), M.steelDark, rod, [0, (DIM.rodLen - 3.2) / 2 + 0.4, 0]);
        const small = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.55, 10, 20), M.steel);
        small.position.y = DIM.rodLen;
        rod.add(small);
        cyl(0.36, 0.36, 5.0, M.steelDark, rod, [0, 0.3, 0], 'z', 10);
        items.push({ holder, rod, U, row: i, side, index: items.length });
      }
    }
    g.userData.rods = items;
  }

  /* ---------- 气缸盖 ---------- */
  function buildHead(g, side) {
    const { grp, U, V } = bankFrame(side);
    grp.position.copy(U).multiplyScalar(DIM.deck);
    g.add(grp);
    // 缸盖主体：下缘为燃烧室顶面，上部为气门室
    add(new THREE.BoxGeometry(11.6, DIM.headH, 44), M.aluHead, grp, [0, DIM.headH / 2, 0]);
    // 缸盖底面法兰
    add(new THREE.BoxGeometry(12.8, 1.0, 45), M.aluHead, grp, [0, 0.5, 0]);
    // 缸盖分型面（沿纵向的分隔凸台，避免读作整块平板）
    for (let i = 0; i < 5; i++) {
      add(new THREE.BoxGeometry(12.2, 1.2, 1.4), M.aluHead, grp, [0, DIM.headH * 0.52, -18 + i * 9]);
    }
    // 凸轮轴轴承座
    for (let i = 0; i < 5; i++) cyl(1.9, 1.9, 3.0, M.aluHead, grp, [3.2, DIM.headH - 1.2, -19 + i * 9.5], 'z', 18);
    // 火花塞中央凸台
    for (let i = 0; i < 4; i++) {
      cyl(1.5, 1.7, 3.2, M.aluHead, grp, [0, 1.6, CYL_Z[i]], 'y', 16);
      cyl(1.1, 1.2, 2.6, M.aluHead, grp, [-2.2, 2.2, CYL_Z[i]], 'y', 14);
    }
    // 侧向水道凸起
    for (let i = 0; i < 4; i++) cyl(1.0, 1.0, 6.0, M.castAlu, grp, [6.0, DIM.headH * 0.45, CYL_Z[i]], 'y', 12);
  }

  /* ---------- 气门室罩盖 ---------- */
  function buildCover(g, side) {
    const { grp, U } = bankFrame(side);
    grp.position.copy(U).multiplyScalar(DIM.deck + DIM.headH);
    g.add(grp);
    add(new THREE.BoxGeometry(12.0, DIM.coverH, 44), M.plastic, grp, [0, DIM.coverH / 2, 0]);
    for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(2.0, 0.9, 1.0), M.plastic, grp, [0, DIM.coverH, -19 + i * 6.4]);
    add(new THREE.BoxGeometry(4.0, 0.5, 30), M.aluHead, grp, [0, DIM.coverH + 0.45, 0]);
    cyl(1.5, 1.5, 1.6, M.plasticMid, grp, [0, DIM.coverH + 0.9, 14], 'y', 16);
  }

  /* ---------- 凸轮轴组 ---------- */
  function buildCams(g, side) {
    const { grp, U, V } = bankFrame(side);
    grp.position.copy(U).multiplyScalar(DIM.deck + DIM.headH - 1.2);
    g.add(grp);
    for (let k = 0; k < 2; k++) {
      const off = k === 0 ? 3.2 : -3.2;
      const axis = new THREE.Group();
      axis.position.set(off, 0, 0);
      grp.add(axis);
      cyl(1.35, 1.35, 43, M.steel, axis, [0, 0, 0], 'z', 18);
      for (let i = 0; i < 4; i++) {
        for (let e = 0; e < 2; e++) {
          lathe([[0, -0.9], [1.5, -0.9], [2.15, 0], [1.9, 0.75], [1.35, 0.9], [0, 0.9]],
            M.steel, axis, [0, 0, CYL_Z[i] + (e ? 0.9 : -0.9)], [Math.PI / 2, 0, 0], 20);
        }
      }
      for (let i = 0; i < 5; i++) cyl(1.65, 1.65, 1.4, M.steelDark, axis, [0, 0, -19 + i * 9.5], 'z', 16);
    }
  }

  /* ---------- 气门与弹簧 ---------- */
  function buildValves(g) {
    for (let side = -1; side <= 1; side += 2) {
      const { grp } = bankFrame(side);
      g.add(grp);
      for (let i = 0; i < 4; i++) {
        for (let v = 0; v < 4; v++) {
          const isIntake = v < 2;
          const lateral = (v % 2 === 0 ? -1 : 1) * 2.3;
          const along = isIntake ? DIM.headH * 0.62 : DIM.headH * 0.12;
          const z = CYL_Z[i] + (v < 2 ? -0.85 : 0.85);
          cyl(0.32, 0.32, 5.0, M.steel, grp, [lateral, along, z], 'y', 10);
          const sp = new THREE.Mesh(springGeometry(0.95, 3.2, 5, 0.16), M.steelDark);
          sp.position.set(lateral, along - 1.6, z);
          sp.castShadow = true;
          grp.add(sp);
          cyl(1.1, 1.1, 0.4, M.steelDark, grp, [lateral, along - 2.4, z], 'y', 12);
        }
      }
    }
  }

  /* ---------- 飞轮 / 变矩器 ---------- */
  function buildFlywheel(g) {
    cyl(11.5, 11.5, 1.6, M.steelDark, g, [0, 0, 24.6], 'z', 48);
    add(gearGeometry(12.6, 110, 0.9, 1.4, 10.6), M.steel, g, [0, 0, 25.6]);
    lathe([[0, 0], [7.0, 0], [8.2, 1.4], [8.6, 4.0], [7.8, 6.0], [5.2, 6.6], [0, 6.6]],
      M.steelDark, g, [0, 0, 26.4], [Math.PI / 2, 0, 0], 40);
    lathe([[0, 0], [6.4, 0], [7.2, 1.0], [6.0, 2.0], [0, 2.0]],
      M.steel, g, [0, 0, 26.8], [Math.PI / 2, 0, 0], 32);
    cyl(2.2, 2.2, 6, M.steel, g, [0, 0, 29.5], 'z', 20);
  }

  /* ---------- 正时链轮 / VVT 调节器 ---------- */
  function buildSprockets(g) {
    add(gearGeometry(4.4, 38, 0.8, 1.6, 1.6), M.steel, g, [0, 0, -26.2]);
    for (let side = -1; side <= 1; side += 2) {
      const { grp } = bankFrame(side);
      grp.position.copy(U_R.clone().multiplyScalar(DIM.deck + DIM.headH - 1.2));
      g.add(grp);
      for (let k = 0; k < 2; k++) {
        const off = k === 0 ? 3.2 : -3.2;
        const p = new THREE.Vector3(off, 0, -25.4);
        add(gearGeometry(5.4, 46, 0.8, 1.4, 1.5), M.steel, grp, [p.x, p.y, p.z]);
        lathe([[0, 0], [4.4, 0], [4.8, 0.6], [4.8, 2.2], [3.2, 3.0], [0, 3.0]],
          M.steelDark, grp, [p.x, p.y, -24.0], [Math.PI / 2, 0, 0], 28);
        add(gearGeometry(4.6, 34, 0.5, 0.8, 1.2), M.brass, grp, [p.x, p.y, -23.2]);
      }
    }
    add(new THREE.BoxGeometry(5, 5, 4), M.plasticMid, g, [-9, 8, -25.6]);
    cyl(2.2, 2.2, 2.4, M.steel, g, [-9, 8, -27.0], 'z', 20);
    add(new THREE.BoxGeometry(1.2, 16, 2.0), M.plasticMid, g, [8, 14, -25.6], [0, 0, 0.3]);
  }

  /* ---------- 正时链条 ---------- */
  function buildChain(g) {
    for (let side = -1; side <= 1; side += 2) {
      const { grp } = bankFrame(side);
      grp.position.copy(U_R.clone().multiplyScalar(DIM.deck + DIM.headH - 1.2));
      g.add(grp);
      const c1 = new THREE.Vector3(3.2, 0, 0);
      const c2 = new THREE.Vector3(-3.2, 0, 0);
      const r0 = 4.9, r1 = 6.0;
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * 0.45 + (i / 10) * Math.PI * 1.1;
        pts.push([Math.cos(a) * r0, Math.sin(a) * r0, -25.8]);
      }
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * 0.25 + (i / 10) * Math.PI * 0.85;
        pts.push([c1.x + Math.cos(a) * r1, c1.y + Math.sin(a) * r1, -25.8]);
      }
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * 0.05 + (i / 10) * Math.PI * 0.85;
        pts.push([c2.x + Math.cos(a) * r1, c2.y + Math.sin(a) * r1, -25.8]);
      }
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI * 0.45 + (i / 10) * Math.PI * 0.9;
        pts.push([Math.cos(a) * r0, Math.sin(a) * r0, -25.8]);
      }
      tubeFrom(pts, 0.42, M.steelDark, grp, 90, 8, true);
      const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), true, 'catmullrom', 0.4);
      for (let i = 0; i < 60; i++) {
        const p = curve.getPointAt(i / 60);
        const tg = curve.getTangentAt(i / 60);
        const link = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 1.5), M.steel);
        link.position.copy(p);
        link.lookAt(p.clone().add(tg));
        grp.add(link);
      }
    }
  }

  /* ---------- 涡轮增压器（中央 hot-V） ---------- */
  function buildTurbo(g, zPos, side) {
    const grp = new THREE.Group();
    grp.position.set(0, 11.5, zPos);
    g.add(grp);
    cyl(2.15, 2.15, 7.4, M.steelDark, grp, [0, 0, 0], 'x', 26);
    // 涡轮蜗壳
    lathe([[0, 0], [2.0, 0], [3.4, 0.9], [4.3, 2.4], [4.4, 3.8], [3.4, 4.9], [1.2, 5.2], [0, 5.0]],
      M.turboShell, grp, [-3.6, 0, 0], [0, 0, Math.PI / 2], 34);
    cyl(1.55, 1.75, 3.2, M.inconel, grp, [-3.6, 4.2, 0], 'y', 22);
    tubeFrom([[-3.6, 2.2, -3.2], [-3.6, 1.2, -5.4], [-3.6, -1.4, -6.2], [-3.6, -4.0, -6.0]],
      1.35, M.inconel, grp, 30, 14);
    // 压气机蜗壳
    lathe([[0, 0], [1.9, 0], [3.2, 0.8], [4.0, 2.1], [4.1, 3.4], [3.2, 4.3], [1.0, 4.5], [0, 4.3]],
      M.turboShell, grp, [3.6, 0, 0], [0, 0, -Math.PI / 2], 34);
    cyl(1.5, 1.5, 3.0, M.steelDark, grp, [3.6, 0, -4.6], 'z', 22);
    tubeFrom([[3.6, 3.2, 1.6], [5.6, 4.4, 1.2], [8.4, 4.2, 0.4], [10.2, 3.2, 0]],
      1.25, M.steel, grp, 30, 14);
    // 叶轮
    const imp = new THREE.Group();
    imp.position.set(2.2, 0, 0);
    grp.add(imp);
    lathe([[0, 0], [0.9, 0.2], [1.5, 1.0], [1.3, 1.9], [0.6, 2.2], [0, 2.2]],
      M.brass, imp, [0, 0, 0], [0, 0, -Math.PI / 2], 24);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const bl = add(new THREE.BoxGeometry(0.16, 1.5, 0.7), M.brass, imp, [1.0, Math.cos(a) * 1.0, Math.sin(a) * 1.0]);
      bl.rotation.x = a;
    }
    g.userData.turboImpeller = imp;
    add(new THREE.BoxGeometry(2.2, 2.2, 3.0), M.plasticMid, grp, [-5.4, 2.4, 2.6]);
    add(new THREE.BoxGeometry(9, 1.2, 8), M.castAlu, grp, [0, -3.4, 0]);
  }

  /* ---------- 进气歧管 ---------- */
  function buildIntake(g, side) {
    const { grp, U, V } = bankFrame(side);
    grp.position.copy(U).multiplyScalar(DIM.deck);
    g.add(grp);
    const s = DIM.headH * 0.72;
    // 进气口朝气缸列外侧：世界"背离中轴"方向换算到局部
    const worldOut = new THREE.Vector3(side, 0, 0);
    const localOut = worldOut.clone().applyQuaternion(grp.quaternion.clone().invert());
    const lx = localOut.dot(new THREE.Vector3(1, 0, 0));
    const plenumX = 6.2 * Math.sign(lx) || 6.2;
    // 集气腔
    lathe([[0, -21], [2.2, -21], [2.8, -19], [2.9, 19], [2.2, 21], [0, 21]],
      M.castAlu, grp, [plenumX, s, 0], [Math.PI / 2, 0, 0], 28);
    // 4 根支管
    for (let i = 0; i < 4; i++) {
      const z = CYL_Z[i];
      tubeFrom([
        [plenumX - lx * 0.8, s + 1.2, z],
        [plenumX - lx * 0.2, s + 2.8, z],
        [plenumX + lx * 0.8, s + 3.8, z * 0.85],
        [plenumX + lx * 0.6, s + 4.4, z * 0.5],
        [plenumX, s + 4.0, z * 0.25],
      ], 0.85, M.castAlu, grp, 30, 14);
    }
    // 节气门体
    cyl(2.6, 2.6, 3.0, M.plasticMid, grp, [plenumX + lx * 0.8, s + 2.2, 19], 'z', 24);
    cyl(2.2, 2.2, 1.0, M.steelDark, grp, [plenumX + lx * 0.8, s + 2.2, 20.8], 'z', 24);
    // 进气压力传感器
    cyl(1.0, 1.0, 1.8, M.plasticMid, grp, [plenumX + lx * 0.6, s + 3.8, 13], 'y', 14);
  }

  /* ---------- 排气歧管 ---------- */
  function buildExhaust(g, side) {
    const { grp, U, V } = bankFrame(side);
    grp.position.copy(U).multiplyScalar(DIM.deck);
    g.add(grp);
    const s = DIM.headH * 0.18;
    // 排气口朝 V 形中央：用世界方向求"指向中轴"的横向分量，再换算回局部 X
    const worldIn = new THREE.Vector3(-side, 0, 0);                 // 世界：指向中轴
    const localIn = worldIn.clone().applyQuaternion(
      grp.quaternion.clone().invert()
    );                                                              // 换算到局部
    const lx = localIn.dot(new THREE.Vector3(1, 0, 0));
    const ly = localIn.dot(new THREE.Vector3(0, 1, 0));
    const portX = 5.4 * Math.sign(lx) || 5.4;                       // 排气口在缸盖内侧
    const portY = s + ly * 2.0;
    const turboX = side * 3.6, turboY = 11.5;
    for (let i = 0; i < 4; i++) {
      const z = CYL_Z[i];
      tubeFrom([
        [portX, portY, z],
        [portX + lx * 1.2, portY - 2.6, z * 0.95],
        [turboX * 1.3 - side * 1.2, turboY + 1.8, z * 0.62],
        [turboX, turboY + 3.8, z * 0.22],
      ], 1.0, M.inconel, grp, 34, 14);
      const fm = add(new THREE.BoxGeometry(4.2, 1.0, 4.2), M.inconel, grp, [portX, portY, z]);
      fm.rotation.z = Math.PI / 4;
    }
  }

  /* ---------- 机油泵 ---------- */
  function buildOilPump(g) {
    const grp = new THREE.Group();
    grp.position.set(0, -13.5, -21.0);
    g.add(grp);
    add(new THREE.BoxGeometry(11, 9, 5), M.aluBlock, grp, [0, 0, 0]);
    cyl(3.4, 3.4, 5.4, M.castAlu, grp, [0, 0.6, -3.4], 'z', 26);
    cyl(2.8, 2.8, 1.0, M.steelDark, grp, [0, 0.6, -6.3], 'z', 24);
    add(gearGeometry(4.0, 32, 0.7, 1.2, 1.2), M.steel, grp, [0, 0.6, -7.2]);
    cyl(1.2, 1.2, 3.0, M.steel, grp, [4.0, 2.0, 0], 'y', 14);
    tubeFrom([[0, -4.0, -2], [0, -8.0, 2], [0, -13.0, 6]], 0.9, M.steelDark, grp, 20, 10);
  }

  /* ---------- 机油滤清器 / 油冷 ---------- */
  function buildOilFilter(g) {
    const grp = new THREE.Group();
    grp.position.set(-12.5, -8.0, 12);
    g.add(grp);
    lathe([[0, -4.2], [3.2, -4.2], [3.4, -3.6], [3.4, 3.4], [2.6, 4.2], [1.0, 4.4], [0, 4.4]],
      M.filterBody, grp, [0, 0, 0], null, 26);
    cyl(2.7, 2.7, 0.6, M.steelDark, grp, [0, 4.5, 0], 'y', 24);
    const c = new THREE.Group();
    c.position.set(12.8, -6.0, 8);
    g.add(c);
    add(new THREE.BoxGeometry(4.0, 13, 11), M.castAlu, c, [0, 0, 0]);
    for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(4.3, 0.5, 10), M.steelDark, c, [0, -5.5 + i * 1.35, 0]);
    tubeFrom([[12.8, -6.0, 14], [13.0, -2.0, 18], [13.0, 4.0, 19]], 0.8, M.steelDark, g, 20, 10);
  }

  /* ---------- 冷却系统 ---------- */
  function buildCoolant(g) {
    const grp = new THREE.Group();
    grp.position.set(11.5, 2.0, 20.5);
    g.add(grp);
    lathe([[0, -4.0], [2.6, -4.0], [3.0, -3.0], [3.0, 3.2], [2.2, 4.0], [1.2, 4.2], [0, 4.2]],
      M.glass, grp, [0, 0, 0], null, 24);
    cyl(0.9, 0.9, 1.4, M.plasticMid, grp, [2.4, 1.0, 0], 'z', 12);
    tubeFrom([[11.5, 6.0, 20.5], [12.0, 9.0, 19.0], [13.0, 10.5, 16.0]], 1.0, M.rubber, g, 22, 10);
    tubeFrom([[11.5, -2.0, 20.5], [11.0, -8.0, 20.0], [9.0, -13.0, 18.0]], 0.9, M.rubber, g, 22, 10);
    add(new THREE.BoxGeometry(3.4, 3.4, 3.4), M.plasticMid, g, [11.0, -7.0, 20.2]);
  }

  /* ---------- 点火线圈 ---------- */
  function buildCoils(g) {
    for (let side = -1; side <= 1; side += 2) {
      const { grp } = bankFrame(side);
      grp.position.copy(U_R.clone().multiplyScalar(DIM.deck + DIM.headH + DIM.coverH * 0.5));
      g.add(grp);
      for (let i = 0; i < 4; i++) {
        add(new THREE.BoxGeometry(3.0, 2.6, 2.6), M.plastic, grp, [0, 0, CYL_Z[i]]);
        add(new THREE.BoxGeometry(2.2, 1.2, 2.0), M.plasticMid, grp, [0, 1.6, CYL_Z[i]]);
      }
    }
  }

  /* ---------- 火花塞 ---------- */
  function buildPlugs(g) {
    for (let side = -1; side <= 1; side += 2) {
      const { grp } = bankFrame(side);
      grp.position.copy(U_R.clone().multiplyScalar(DIM.deck));
      g.add(grp);
      for (let i = 0; i < 4; i++) {
        const z = CYL_Z[i];
        cyl(0.55, 0.62, 2.4, M.ceramic, grp, [0, 1.0, z], 'y', 14);
        cyl(0.45, 0.45, 1.8, M.steel, grp, [0, -1.0, z], 'y', 12);
        cyl(0.14, 0.14, 0.7, M.brass, grp, [0, -2.2, z], 'y', 8);
        // 中央凸台
      }
    }
  }

  /* ---------- 喷油器 + 燃油轨 ---------- */
  function buildInjectors(g) {
    for (let side = -1; side <= 1; side += 2) {
      const { grp } = bankFrame(side);
      grp.position.copy(U_R.clone().multiplyScalar(DIM.deck));
      g.add(grp);
      for (let i = 0; i < 4; i++) {
        const z = CYL_Z[i];
        cyl(0.62, 0.72, 3.4, M.steel, grp, [-2.2, 2.0, z], 'y', 14);
        cyl(0.42, 0.30, 0.9, M.steelDark, grp, [-2.2, 0.1, z], 'y', 10);
        add(new THREE.BoxGeometry(1.5, 1.2, 1.3), M.plasticMid, grp, [-2.2, 4.0, z]);
      }
      cyl(0.85, 0.85, 44, M.steel, grp, [-3.2, 3.6, 0], 'z', 18);
    }
  }

  /* ---------- 线束 / ECU ---------- */
  function buildWiring(g) {
    for (let side = -1; side <= 1; side += 2) {
      tubeFrom([[side * 9.0, 4.0, -22], [side * 10.5, 8.0, -10], [side * 10.0, 11.0, 4], [side * 9.5, 12.5, 16]],
        0.75, M.wire, g, 30, 10);
      tubeFrom([[side * 8.0, 6.0, -20], [side * 9.5, 2.0, -8], [side * 9.0, -2.0, 6]], 0.5, M.wire, g, 26, 8);
    }
    const ecu = new THREE.Group();
    ecu.position.set(-13.0, -2.0, 16.0);
    g.add(ecu);
    add(new THREE.BoxGeometry(6.5, 3.0, 8.5), M.plasticMid, ecu, [0, 0, 0]);
    add(new THREE.BoxGeometry(6.8, 0.8, 8.8), M.steelDark, ecu, [0, 1.9, 0]);
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(2.0, 1.6, 2.4), M.plastic, ecu, [0, -2.0, -3 + i * 3]);
  }

  /* ---------- 悬置 ---------- */
  function buildMounts(g) {
    for (let side = -1; side <= 1; side += 2) {
      const grp = new THREE.Group();
      grp.position.set(side * 12.0, -6.0, side * 8);
      g.add(grp);
      add(new THREE.BoxGeometry(4.0, 1.2, 8.0), M.castAlu, grp, [0, 3.2, 0]);
      add(new THREE.BoxGeometry(3.0, 2.6, 6.0), M.rubber, grp, [0, 0.6, 0]);
      add(new THREE.BoxGeometry(3.4, 1.2, 6.4), M.steelDark, grp, [0, -1.2, 0]);
      tubeFrom([[side * 12.0, -2.0, side * 8], [side * 10.0, 6.0, side * 10]], 0.8, M.steelDark, g, 16, 8);
    }
  }

  /* ---------- 附件轮系 ---------- */
  function buildAccessories(g) {
    const cp = new THREE.Group();
    cp.position.set(0, 0, -27.5);
    g.add(cp);
    lathe([[0, -1.6], [4.6, -1.6], [5.0, -1.0], [5.0, 1.0], [4.6, 1.6], [0, 1.6]],
      M.steelDark, cp, [0, 0, 0], [Math.PI / 2, 0, 0], 34);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(new THREE.BoxGeometry(0.5, 0.6, 3.0), M.steelDark, cp, [Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0], [0, 0, a]);
    }
    const alt = new THREE.Group();
    alt.position.set(11.5, 6.0, -27.0);
    g.add(alt);
    cyl(3.4, 3.4, 7.0, M.plasticMid, alt, [0, 0, 0], 'z', 24);
    cyl(1.8, 1.8, 7.6, M.steelDark, alt, [0, 0, 0], 'z', 18);
    const ac = new THREE.Group();
    ac.position.set(-10.0, 4.0, -27.5);
    g.add(ac);
    cyl(3.0, 3.0, 5.4, M.steelDark, ac, [0, 0, 0], 'z', 22);
    cyl(1.6, 1.6, 2.4, M.plasticMid, ac, [0, 0, 3.4], 'z', 16);
    const tn = new THREE.Group();
    tn.position.set(4.0, 7.5, -28.5);
    g.add(tn);
    cyl(2.2, 2.2, 2.6, M.plasticMid, tn, [0, 0, 0], 'z', 20);
    cyl(2.4, 2.4, 1.4, M.steel, tn, [0, 0, 1.2], 'z', 20);
    // 皮带
    const pts = [];
    const N = 64;
    for (let i = 0; i < N; i++) {
      const t = i / N * 4;
      let px, py;
      if (t < 1) { const a = Math.PI * 0.35 + (t % 1) * Math.PI * 1.3; px = Math.cos(a) * 5.0; py = Math.sin(a) * 5.0; }
      else if (t < 2) { const a = -Math.PI * 0.55 + ((t - 1) % 1) * Math.PI * 0.9; px = 11.5 + Math.cos(a) * 2.4; py = 6.0 + Math.sin(a) * 2.4; }
      else if (t < 3) { const a = Math.PI * 0.1 + ((t - 2) % 1) * Math.PI * 0.9; px = 4.0 + Math.cos(a) * 2.4; py = 7.5 + Math.sin(a) * 2.4; }
      else { const a = Math.PI * 0.55 + ((t - 3) % 1) * Math.PI * 0.9; px = -10.0 + Math.cos(a) * 2.6; py = 4.0 + Math.sin(a) * 2.6; }
      pts.push([px, py, -28.6]);
    }
    tubeFrom(pts, 0.55, M.rubber, g, 120, 8, true);
  }

  /* ---------- 中冷器 ---------- */
  function buildIntercooler(g) {
    const grp = new THREE.Group();
    grp.position.set(0, 8.0, -36.0);
    g.add(grp);
    add(new THREE.BoxGeometry(34, 15, 3.0), M.steelDark, grp, [0, 0, 0]);
    for (let i = 0; i < 26; i++) add(new THREE.BoxGeometry(0.35, 14, 2.2), M.steel, grp, [-16 + i * 1.28, 0, 0]);
    add(new THREE.BoxGeometry(34, 3.2, 4.2), M.castAlu, grp, [0, 8.4, 0]);
    add(new THREE.BoxGeometry(34, 3.2, 4.2), M.castAlu, grp, [0, -8.4, 0]);
    tubeFrom([[15, 12, -36], [16, 8, -28], [14, 4, -20]], 1.6, M.steel, g, 22, 12);
    tubeFrom([[-15, 12, -36], [-16, 8, -28], [-14, 4, -20]], 1.6, M.steel, g, 22, 12);
  }

  /* ---------- 催化器 ---------- */
  function buildCatalyst(g) {
    const grp = new THREE.Group();
    grp.position.set(-3.0, 2.0, 30.0);
    g.add(grp);
    const body = lathe([[0, -9], [4.4, -8.4], [5.4, -5.0], [5.4, 5.0], [4.4, 8.4], [0, 9]],
      M.steelDark, grp, [0, 0, 0], [Math.PI / 2, 0, 0], 28);
    body.scale.set(1, 1, 1.25);
    const wrap = lathe([[0, -8.6], [4.6, -8.0], [5.6, -4.8], [5.6, 4.8], [4.6, 8.0], [0, 8.6]],
      M.hotMetal, grp, [0, 0, 0], [Math.PI / 2, 0, 0], 28);
    wrap.scale.set(1, 1, 1.25);
    tubeFrom([[-3, 4, 20], [-3, 3, 25]], 1.7, M.inconel, g, 14, 12);
    tubeFrom([[-3, 1, 38], [-3, 1, 42], [-3, 2, 45]], 1.8, M.inconel, g, 18, 12);
    for (let i = 0; i < 2; i++) cyl(0.5, 0.5, 2.4, M.steel, grp, [2.0 + i * 2.0, 3.0, 2.0], 'x', 10);
  }

  /* ================= 注册部件 ================= */
  part('block', buildBlock, { label: [0, 4, -14] });
  part('oilpan', buildPan, { label: [0, -33, 8] });
  part('crank', buildCrank, { label: [0, 0, 10] });
  part('pistons', buildPistons, { label: [12, 17, -16] });
  part('rods', buildRods, { label: [9, 9, 8] });
  part('flywheel', buildFlywheel, { label: [0, 0, 31] });
  part('headL', g => buildHead(g, -1), { label: [-21, 24, -12] });
  part('headR', g => buildHead(g, 1), { label: [21, 24, -12] });
  part('coverL', g => buildCover(g, -1), { label: [-23, 31, 9] });
  part('coverR', g => buildCover(g, 1), { label: [23, 31, 9] });
  part('camsL', g => buildCams(g, -1), { label: [-19, 28, 0] });
  part('camsR', g => buildCams(g, 1), { label: [19, 28, 0] });
  part('valves', buildValves, { label: [0, 18, -22] });
  part('timingchain', buildChain, { label: [0, 14, -28] });
  part('sprockets', buildSprockets, { label: [-9, 8, -28] });
  part('intake', g => { buildIntake(g, -1); buildIntake(g, 1); }, { label: [23, 28, 14] });
  part('turboL', g => buildTurbo(g, -8, -1), { label: [0, 18, -8] });
  part('turboR', g => buildTurbo(g, 8, 1), { label: [0, 18, 8] });
  part('intercooler', buildIntercooler, { label: [0, 8, -38] });
  part('exhaustL', g => buildExhaust(g, -1), { label: [-11, 13, -6] });
  part('exhaustR', g => buildExhaust(g, 1), { label: [11, 13, 6] });
  part('catalyst', buildCatalyst, { label: [-3, 2, 33] });
  part('oilpump', buildOilPump, { label: [0, -14, -24] });
  part('oilfilter', buildOilFilter, { label: [-14, -8, 12] });
  part('coolant', buildCoolant, { label: [12, 2, 22] });
  part('coils', buildCoils, { label: [0, 37, 0] });
  part('plugs', buildPlugs, { label: [0, 20, 0] });
  part('injectors', buildInjectors, { label: [-9, 17, 6] });
  part('wiring', buildWiring, { label: [-14, 0, 16] });
  part('mounts', buildMounts, { label: [-12, -6, -8] });
  part('accessories', buildAccessories, { label: [13, 8, -30] });

  /* ================= 运动学 ================= */
  const R = DIM.crankThrow, L = DIM.rodLen;

  /** 滑块位置（沿气缸轴线，自曲轴中心） */
  function slider(psi) {
    const c = Math.cos(psi), s = Math.sin(psi);
    return R * c + Math.sqrt(Math.max(1e-4, L * L - R * R * s * s));
  }

  function updateKinematics(crankAngle) {
    const crank = parts.get('crank');
    if (crank.group.userData.crankRot) crank.group.userData.crankRot.rotation.z = crankAngle;

    const pistons = parts.get('pistons').group.userData.pistons;
    const rods = parts.get('rods').group.userData.rods;

    for (const p of pistons) {
      const row = ROWS[p.row];
      const psi = row.theta + crankAngle;              // 右列滑块角
      const psiL = -psi - Math.PI / 2;                 // 左列滑块角
      const ang = p.side > 0 ? psi : psiL;
      // 曲拐销（两列共用同一物理销）
      const pin = U_R.clone().multiplyScalar(Math.cos(psi) * R)
        .add(V_R.clone().multiplyScalar(Math.sin(psi) * R))
        .setZ(row.z);
      const x = slider(ang);
      const wrist = p.U.clone().multiplyScalar(x).setZ(row.z);
      p.holder.position.copy(pin);
      p.body.position.copy(wrist).sub(pin);
    }

    for (const r of rods) {
      const row = ROWS[r.row];
      const psi = row.theta + crankAngle;
      const psiL = -psi - Math.PI / 2;
      const ang = r.side > 0 ? psi : psiL;
      const pin = U_R.clone().multiplyScalar(Math.cos(psi) * R)
        .add(V_R.clone().multiplyScalar(Math.sin(psi) * R))
        .setZ(row.z);
      const x = slider(ang);
      const wrist = r.U.clone().multiplyScalar(x).setZ(row.z);
      r.holder.position.copy(pin);
      r.rod.quaternion.setFromUnitVectors(Y_AXIS, wrist.clone().sub(pin).normalize());
    }

    // 涡轮叶轮
    for (const id of ['turboL', 'turboR']) {
      const t = parts.get(id);
      if (t.group.userData.turboImpeller) t.group.userData.turboImpeller.rotation.x = -crankAngle * 7.5;
    }
  }

  /** 更新燃烧闪光强度（每 720° 曲轴转角点火 8 次） */
  function updateFlames(crankAngle, running) {
    const flames = parts.get('pistons').group.userData.flames;
    const cycle = Math.PI * 4; // 720°
    for (const f of flames) {
      const row = ROWS[f.row];
      const psi = row.theta + crankAngle;
      const psiL = -psi - Math.PI / 2;
      const ang = f.side > 0 ? psi : psiL;
      const x = slider(ang);
      // 上止点（滑块角为 0）对应的曲轴角
      const top = -ang;
      let d = (top - crankAngle) % cycle;
      if (d < 0) d += cycle;
      // 点火发生在上止点前约 20° CA
      const fire = (d > cycle - 0.35) ? (cycle - d) / 0.35 : 0;
      const k = running ? fire : 0;
      f.mesh.material.opacity = k * 0.5;
      f.mesh.scale.setScalar(0.45 + k * 0.75);
      f.mesh.position.copy(f.U).multiplyScalar(x + 3.6).setZ(row.z);
    }
  }

  return { root, parts, materials: M, updateKinematics, updateFlames, DIM, ROWS, CYL_Z };
}
