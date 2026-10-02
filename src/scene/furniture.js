import * as THREE from 'three';
import { box, cyl, hotspot, mat } from './helpers.js';
import { BED, SOFA } from './layout.js';

// Single bed: head against the window wall, solid navy sheet, one pillow.
export function bed() {
  const g = new THREE.Group();
  const { length: L, width: W, top } = BED;
  const wood = '#c9a47e';
  const navy = mat('#16234a', { exact: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, 0.1, 0.07, '#9c7a58', sx * (L / 2 - 0.08), 0.05, sz * (W / 2 - 0.06)));
  g.add(box(L, 0.16, W + 0.04, wood, 0, 0.18, 0));
  g.add(box(L - 0.06, 0.16, W - 0.04, '#f2efe8', 0, 0.34, 0)); // mattress
  g.add(box(L - 0.02, 0.24, W + 0.01, navy, 0.0, top - 0.12, 0)); // fitted sheet over the mattress
  const pillow = box(0.36, 0.09, 0.62, '#f3f0e9', L / 2 - 0.27, top + 0.04, 0);
  pillow.rotation.z = -0.06;
  g.add(pillow);
  g.add(box(0.07, 0.9, W + 0.08, wood, L / 2 + 0.005, 0.45, 0)); // headboard
  g.add(box(0.07, 0.36, W + 0.08, wood, -L / 2 - 0.005, 0.24, 0)); // footboard

  // a blanket folded at the foot that gets pulled up when it's time to sleep
  const blanket = new THREE.Group();
  const sheet = box(1.3, 0.05, W + 0.03, mat('#1a2a57', { exact: true }), 0.65, 0, 0);
  blanket.add(sheet);
  blanket.position.set(-L / 2 + 0.06, top + 0.03, 0);
  blanket.scale.x = 0.28;
  blanket.scale.y = 2.2;
  g.add(blanket);

  g.position.set(BED.x, 0, BED.z);
  return { group: hotspot(g, 'bed'), blanket };
}

// Beige sofa against the open left side, facing the window.
export function sofa() {
  const g = new THREE.Group();
  const { depth: D, length: L } = SOFA;
  const beige = '#d9c4a2';
  const shade = '#ccb592';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.06, 0.08, 0.06, '#6f5640', sx * (D / 2 - 0.08), 0.04, sz * (L / 2 - 0.08)));
  g.add(box(D, 0.2, L, shade, 0, 0.18, 0));
  const half = (L - 0.36) / 2;
  for (const s of [-1, 1]) {
    g.add(box(D - 0.26, 0.15, half - 0.02, beige, 0.1, 0.355, s * (half / 2 + 0.005)));
    const back = box(0.17, 0.38, half - 0.03, beige, -D / 2 + 0.26, 0.6, s * (half / 2 + 0.005));
    back.rotation.z = 0.14;
    g.add(back);
    g.add(box(D, 0.36, 0.18, shade, 0, 0.46, s * (L / 2 - 0.09))); // armrests
  }
  g.add(box(0.2, 0.44, L - 0.02, shade, -D / 2 + 0.1, 0.5, 0)); // back frame
  const cushion = box(0.12, 0.3, 0.3, '#c8553d', -0.2, 0.58, L / 2 - 0.36);
  cushion.rotation.set(0.2, 0.3, 0.15);
  g.add(cushion);
  g.position.set(SOFA.x, 0, SOFA.z);
  return hotspot(g, 'sofa');
}

// Watering can. Its origin is the top of the handle, where the hand grips it.
export function wateringCan() {
  const g = new THREE.Group();
  const mint = '#8ec9b4';
  g.add(cyl(0.065, 0.075, 0.13, mint, 18, 0, -0.14, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 16, Math.PI), mat(mint));
  handle.rotation.y = Math.PI / 2;
  handle.position.y = -0.07;
  handle.castShadow = true;
  g.add(handle);
  const spout = cyl(0.009, 0.016, 0.2, mint, 10, 0, -0.1, 0.12);
  spout.rotation.x = 0.95;
  g.add(spout);
  const tip = new THREE.Object3D();
  tip.position.set(0, -0.04, 0.2);
  g.add(tip);
  g.add(cyl(0.024, 0.012, 0.03, '#6fb39b', 10, 0, -0.035, 0.205).rotateX(0.95));
  return { group: hotspot(g, 'can'), tip, restY: 0.205 };
}

// Stick vacuum. Origin at the floor head; the stick runs up its local +y.
export function stickVacuum() {
  const g = new THREE.Group();
  const white = '#f2efea';
  const coral = '#e8644f';
  g.add(box(0.28, 0.045, 0.1, '#3b3b42', 0, 0.025, 0));
  g.add(box(0.2, 0.01, 0.02, coral, 0, 0.05, 0.035));
  g.add(cyl(0.012, 0.012, 0.85, '#b8b8c0', 10, 0, 0.47, 0));
  g.add(cyl(0.045, 0.045, 0.22, white, 16, 0, 0.66, 0.035));
  g.add(cyl(0.047, 0.047, 0.04, coral, 16, 0, 0.78, 0.035));
  g.add(box(0.035, 0.12, 0.04, '#3b3b42', 0, 0.94, -0.005));
  return { group: hotspot(g, 'vacuum'), length: 0.95 };
}

// An open book held in both hands.
export function openBook(color = '#2f6f73') {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    half.add(box(0.12, 0.17, 0.006, color, s * 0.06, 0, 0));
    half.add(box(0.11, 0.16, 0.012, '#f7f1e3', s * 0.058, 0, 0.008));
    half.rotation.y = -s * 0.32;
    g.add(half);
  }
  return g;
}

// Phone with a feed that scrolls while it's in use.
export function phone() {
  const g = new THREE.Group();
  g.add(box(0.07, 0.14, 0.01, '#16161b', 0, 0, 0));
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.128), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.z = 0.0055;
  g.add(screen);
  const ctx = canvas.getContext('2d');
  const palette = ['#ff6b8b', '#ffd166', '#6ad3ff', '#b49bff', '#7ee0a3', '#ff9f68'];
  let t = 0;
  const light = new THREE.PointLight('#9fc4ff', 0, 0.9, 2);
  light.position.z = 0.08;
  g.add(light);
  // reels: one full-screen card at a time, flicked up every few seconds
  const draw = (dt) => {
    t += dt;
    const card = Math.floor(t / 3);
    const phase = t % 3;
    const shift = phase > 2.7 ? ((phase - 2.7) / 0.3) * 128 : 0;
    for (let i = 0; i < 2; i++) {
      const y = i * 128 - shift;
      ctx.fillStyle = palette[(card + i) % palette.length];
      ctx.fillRect(0, y, 64, 128);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(32, y + 52, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(8, y + 100, 34, 5);
      ctx.fillRect(8, y + 110, 22, 4);
    }
    tex.needsUpdate = true;
  };
  draw(0);
  return { group: g, draw, light };
}

export function cloth() {
  const c = box(0.13, 0.012, 0.1, '#f2c14e', 0, 0, 0);
  c.castShadow = false;
  return c;
}
