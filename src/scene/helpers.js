import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Every mesh gets its own material so hover highlights never bleed
// into other objects that happen to share a colour.
export function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
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

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
}

export function cyl(rTop, rBottom, h, material, segments = 10, x = 0, y = 0, z = 0) {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material, x, y, z);
}

// How canvas textures are drawn: `scale` > 1 redraws them at a higher
// resolution for renderers that don't pixelate the scene.
export const TEXTURES = { scale: 1 };

// Pixel-art canvas texture: drawn once at a tiny resolution and sampled
// with nearest filtering so it stays crisp next to the pixel pass.
export function canvasTexture(width, height, draw, { repeat } = {}) {
  const scale = TEXTURES.scale;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(scale, scale);
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
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
    const m = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }));
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
