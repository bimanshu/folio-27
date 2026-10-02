import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The room is "clay": soft matte materials, every block's edges rounded.
const CLAY = new THREE.Color('#fff3e6');

// Every mesh gets its own material so hover highlights never bleed
// into other objects that happen to share a colour.
// `exact: true` skips the clay softening, for colours that must read as-is.
export function mat(color, { exact = false, ...opts } = {}) {
  const c = new THREE.Color(color);
  // a touch lighter and softer, like painted modelling clay
  if (!opts.map && !exact) c.lerp(CLAY, 0.14);
  return new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...opts, color: c });
}

function toMaterial(m) {
  if (Array.isArray(m) || m instanceof THREE.Material) return m;
  return mat(m);
}

export function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, toMaterial(material));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const rounded = new Map();
export function roundedBox(w, h, d) {
  const r = Math.min(0.05, Math.min(w, h, d) * 0.42);
  if (r < 0.0025) return new THREE.BoxGeometry(w, h, d);
  const key = `${w}|${h}|${d}`;
  if (!rounded.has(key)) rounded.set(key, new RoundedBoxGeometry(w, h, d, Math.min(w, h, d) > 0.08 ? 3 : 2, r));
  return rounded.get(key);
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  return mesh(roundedBox(w, h, d), material, x, y, z);
}

export function cyl(rTop, rBottom, h, material, segments = 16, x = 0, y = 0, z = 0) {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material, x, y, z);
}

// Canvas textures are drawn in small "design" pixels, then rendered at 4x
// so text and edges stay crisp up close.
const TEXTURE_SCALE = 4;

export function canvasTexture(width, height, draw, { repeat } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width * TEXTURE_SCALE;
  canvas.height = height * TEXTURE_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(TEXTURE_SCALE, TEXTURE_SCALE);
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

// Collects many small coloured boxes into one vertex-coloured mesh.
// Plants and fairy-light wires are hundreds of leaves; one draw call each.
export class Batch {
  constructor() {
    this.geometries = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  add(geometry, color, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
    this._e.set(rotation[0], rotation[1], rotation[2]);
    this._q.setFromEuler(this._e);
    this._p.set(position[0], position[1], position[2]);
    this._s.set(scale[0], scale[1], scale[2]);
    this._m.compose(this._p, this._q, this._s);
    return this.addMatrix(geometry, color, this._m);
  }

  addMatrix(geometry, color, matrix) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    const c = new THREE.Color(color);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    this.geometries.push(g);
    return this;
  }

  box(w, h, d, color, position, rotation, scale) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, position, rotation, scale);
  }

  build(opts = {}) {
    const merged = mergeGeometries(this.geometries, false);
    this.geometries.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...opts }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

// Deterministic randomness so the room looks identical on every visit.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tags every mesh under `object` so the raycaster can map hits back to a hotspot.
export function hotspot(object, key) {
  object.userData.hotspot = key;
  object.traverse((child) => {
    child.userData.hotspot = key;
  });
  return object;
}
