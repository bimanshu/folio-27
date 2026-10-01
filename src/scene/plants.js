import * as THREE from 'three';
import { Batch, cyl, hotspot, mat, rng } from './helpers.js';
import { basketTexture, potPatternTexture, snakeLeafTexture } from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();

// Matrix whose local +X runs along `dir`, centred on `pos`.
function alongX(dir, pos, upHint = UP) {
  _x.copy(dir).normalize();
  _y.copy(upHint).addScaledVector(_x, -_x.dot(upHint));
  if (_y.lengthSq() < 1e-6) _y.set(1, 0, 0);
  _y.normalize();
  _z.crossVectors(_x, _y);
  return _m.makeBasis(_x, _y, _z).setPosition(pos);
}

function leafBox(batch, w, h, d, color, from, dir, upHint) {
  const center = from.clone().addScaledVector(dir.clone().normalize(), w / 2);
  batch.addMatrix(new THREE.BoxGeometry(w, h, d), color, alongX(dir, center, upHint));
}

// ---------------------------------------------------------------------------
// Areca palm in a woven basket — the big floor plant on the left.
// ---------------------------------------------------------------------------
export function palm() {
  const g = new THREE.Group();
  const potH = 0.34;
  const pot = cyl(0.19, 0.15, potH, mat('#ffffff', { map: basketTexture() }), 12, 0, potH / 2, 0);
  g.add(pot, cyl(0.17, 0.17, 0.02, '#4a3424', 12, 0, potH - 0.02, 0));

  const r = rng(21);
  const leaves = new Batch();
  const greens = ['#4f8f3a', '#5c9c42', '#3f7a32', '#6aa84a'];
  const fronds = 11;
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + r() * 0.4;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const stalk = 0.35 + r() * 0.45;
    const reach = 0.38 + r() * 0.3;
    const rise = 0.35 + r() * 0.2;
    const droop = 0.55 + r() * 0.25;
    const base = new THREE.Vector3((r() - 0.5) * 0.12, potH, (r() - 0.5) * 0.12);
    // stalk
    const top = base.clone().addScaledVector(UP, stalk);
    leaves.addMatrix(new THREE.BoxGeometry(0.014, stalk, 0.014), '#6b8f3c', _m.makeTranslation(base.x, base.y + stalk / 2, base.z));

    const steps = 12;
    let prev = top;
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      const p = base.clone().addScaledVector(dir, reach * s).addScaledVector(UP, stalk + rise * s - droop * s * s);
      const seg = p.clone().sub(prev);
      leafBox(leaves, seg.length(), 0.012, 0.012, '#6b8f3c', prev, seg, UP);
      const len = 0.2 * Math.sin(Math.PI * (0.15 + s * 0.8)) + 0.04;
      for (const sign of [-1, 1]) {
        const out = side.clone().multiplyScalar(sign).addScaledVector(seg.clone().normalize(), 0.6).addScaledVector(UP, -0.35);
        leafBox(leaves, len, 0.006, 0.026, greens[Math.floor(r() * greens.length)], p, out, UP);
      }
      prev = p;
    }
  }
  g.add(leaves.build());
  return hotspot(g, 'palm');
}

// ---------------------------------------------------------------------------
// Snake plant — tall striped swords in a ceramic pot (right corner).
// ---------------------------------------------------------------------------
export function snakePlant() {
  const g = new THREE.Group();
  const potH = 0.32;
  g.add(cyl(0.14, 0.12, potH, '#e8dfcf', 12, 0, potH / 2, 0));
  g.add(cyl(0.145, 0.145, 0.03, '#d7cbb6', 12, 0, potH - 0.015, 0));
  g.add(cyl(0.125, 0.125, 0.02, '#4a3424', 12, 0, potH - 0.01, 0));

  const leafMat = mat('#ffffff', { map: snakeLeafTexture() });
  const r = rng(33);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const h = 0.5 + r() * 0.5;
    // flat sword leaf that tapers to a point
    const geo = new THREE.BoxGeometry(0.085, h, 0.016, 1, 6, 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const t = Math.min(1, Math.max(0, (pos.getY(v) + h / 2) / h));
      pos.setX(v, pos.getX(v) * (1 - 0.85 * Math.pow(t, 1.6)));
    }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafMat);
    const a = (i / n) * Math.PI * 2 + r() * 0.5;
    const rad = 0.025 + r() * 0.06;
    const tilt = 0.08 + rad * 1.6;
    leaf.position.set(Math.cos(a) * rad, potH + h / 2 - 0.03, Math.sin(a) * rad);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.set(tilt, -a + Math.PI / 2, 0);
    leaf.position.x += Math.cos(a) * Math.sin(tilt) * h * 0.5;
    leaf.position.z += Math.sin(a) * Math.sin(tilt) * h * 0.5;
    leaf.castShadow = leaf.receiveShadow = true;
    g.add(leaf);
  }
  return hotspot(g, 'snake');
}

// ---------------------------------------------------------------------------
// Poinsettia — red bracts in a black pot, right side of the desk.
// ---------------------------------------------------------------------------
export function poinsettia() {
  const g = new THREE.Group();
  const potH = 0.13;
  g.add(cyl(0.085, 0.068, potH, '#1f1e22', 10, 0, potH / 2, 0));
  g.add(cyl(0.078, 0.078, 0.01, '#3b2a1e', 10, 0, potH - 0.008, 0));

  const r = rng(44);
  const b = new Batch();
  const greens = ['#2f6b2c', '#3b7d34', '#285f27'];
  const reds = ['#d3202b', '#e33a33', '#b8151f'];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + r() * 0.3;
    const from = new THREE.Vector3(Math.cos(a) * 0.03, potH + 0.02 + r() * 0.08, Math.sin(a) * 0.03);
    const dir = new THREE.Vector3(Math.cos(a), 0.35 + r() * 0.3, Math.sin(a));
    leafBox(b, 0.16 + r() * 0.05, 0.008, 0.065, greens[i % 3], from, dir, UP);
  }
  const heads = [
    [0, 0.3, 0],
    [0.09, 0.25, 0.04],
    [-0.08, 0.26, 0.05],
    [0.04, 0.24, -0.09],
    [-0.05, 0.22, -0.07],
  ];
  heads.forEach(([hx, hy, hz], k) => {
    const c = new THREE.Vector3(hx, potH + hy - 0.1, hz);
    b.addMatrix(new THREE.BoxGeometry(0.01, hy - 0.04, 0.01), '#3b6b2c', _m.makeTranslation(hx * 0.6, potH + (hy - 0.1) / 2, hz * 0.6));
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k;
      const dir = new THREE.Vector3(Math.cos(a), 0.25, Math.sin(a));
      leafBox(b, 0.085 + r() * 0.03, 0.007, 0.045, reds[(i + k) % 3], c, dir, UP);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + k + 0.4;
      const dir = new THREE.Vector3(Math.cos(a), 0.9, Math.sin(a));
      leafBox(b, 0.045, 0.007, 0.03, reds[i % 3], c.clone().add(new THREE.Vector3(0, 0.008, 0)), dir, UP);
    }
    b.box(0.022, 0.014, 0.022, '#f3c63d', [c.x, c.y + 0.018, c.z]);
  });
  g.add(b.build());
  return hotspot(g, 'poinsettia');
}

// ---------------------------------------------------------------------------
// Pink kalanchoe in a painted pot (left of the monitor).
// ---------------------------------------------------------------------------
export function kalanchoe() {
  const g = new THREE.Group();
  const potH = 0.12;
  g.add(cyl(0.08, 0.065, potH, mat('#ffffff', { map: potPatternTexture() }), 12, 0, potH / 2, 0));
  g.add(cyl(0.083, 0.083, 0.02, '#e05f72', 12, 0, potH + 0.005, 0));

  const r = rng(55);
  const b = new Batch();
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2;
    const from = new THREE.Vector3(Math.cos(a) * 0.02, potH + 0.02 + r() * 0.06, Math.sin(a) * 0.02);
    const dir = new THREE.Vector3(Math.cos(a), 0.5 + r() * 0.6, Math.sin(a));
    leafBox(b, 0.08, 0.018, 0.05, r() > 0.5 ? '#3f7d36' : '#4f9441', from, dir, UP);
  }
  const pinks = ['#f6a3c0', '#ea6f9b', '#f9c2d4', '#e0588a'];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + r();
    const rad = 0.02 + r() * 0.09;
    const top = new THREE.Vector3(Math.cos(a) * rad, potH + 0.15 + r() * 0.1, Math.sin(a) * rad);
    b.addMatrix(new THREE.BoxGeometry(0.008, top.y - potH, 0.008), '#4d8a3d', _m.makeTranslation(top.x * 0.7, potH + (top.y - potH) / 2, top.z * 0.7));
    for (let i = 0; i < 7; i++) {
      b.box(0.022, 0.016, 0.022, pinks[Math.floor(r() * pinks.length)], [
        top.x + (r() - 0.5) * 0.06,
        top.y + (r() - 0.3) * 0.035,
        top.z + (r() - 0.5) * 0.06,
      ]);
    }
  }
  g.add(b.build());
  return hotspot(g, 'flowers');
}

export function succulent(seed = 1, potColor = '#f5f2ec') {
  const g = new THREE.Group();
  g.add(cyl(0.04, 0.032, 0.055, potColor, 10, 0, 0.0275, 0));
  const r = rng(seed);
  const b = new Batch();
  const greens = ['#7fae6b', '#6a9a5c', '#94c07e'];
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.5 + r() * 0.2;
      const dir = new THREE.Vector3(Math.cos(a), ring ? 1.4 : 0.55, Math.sin(a));
      leafBox(b, ring ? 0.035 : 0.045, 0.012, 0.022, greens[(i + ring) % 3], new THREE.Vector3(0, 0.06, 0), dir, UP);
    }
  }
  g.add(b.build());
  return g;
}
