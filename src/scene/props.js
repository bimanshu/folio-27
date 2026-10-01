import * as THREE from 'three';
import { box, cyl, hotspot, mat } from './helpers.js';
import { bookCoverTexture, glowTexture, keyboardTexture } from './textures.js';
import { GLOW_LAYER } from './room.js';

export const DESK = { x: 0.15, z: -1.325, w: 2.4, d: 0.75, top: 0.76 };

// White trestle desk, like the one in the photo.
export function desk() {
  const g = new THREE.Group();
  const white = '#f6f4f0';
  const t = 0.035;
  g.add(box(DESK.w, t, DESK.d, white, DESK.x, DESK.top - t / 2, DESK.z));
  for (const tx of [-0.8, 1.1]) {
    for (const tz of [DESK.z - 0.27, DESK.z + 0.27]) {
      for (const s of [-1, 1]) {
        const leg = box(0.04, 0.77, 0.045, white, tx + s * 0.085, 0.36, tz);
        leg.rotation.z = s * 0.24;
        g.add(leg);
      }
    }
    g.add(box(0.05, 0.035, 0.6, white, tx, 0.7, DESK.z));
    g.add(box(0.3, 0.03, 0.03, white, tx, 0.3, DESK.z - 0.27));
    g.add(box(0.3, 0.03, 0.03, white, tx, 0.3, DESK.z + 0.27));
  }
  return g;
}

// ---------------------------------------------------------------------------
// Monitor with a live canvas screen (code / design / music).
// ---------------------------------------------------------------------------
class Screen {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 128;
    this.canvas.height = 76;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.modes = ['code', 'design', 'music'];
    this.mode = 0;
    this.typed = 0;
    this.clock = 0;
    this.code = this._makeCode();
    this.draw();
  }

  _makeCode() {
    const palette = ['#ff7a90', '#ffd166', '#7bdff2', '#b8f2a0', '#c3a6ff', '#e8e6f0'];
    const out = [];
    let seed = 3;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 40; i++) {
      const indent = [0, 4, 4, 8, 8, 12][Math.floor(rand() * 6)];
      const tokens = [];
      const n = 1 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) tokens.push({ w: 3 + Math.floor(rand() * 14), c: palette[Math.floor(rand() * palette.length)] });
      out.push({ indent, tokens, blank: rand() < 0.12 });
    }
    return out;
  }

  next() {
    this.mode = (this.mode + 1) % this.modes.length;
    this.draw();
  }

  update(dt, typing) {
    this.clock += dt;
    if (typing) this.typed += dt * 26;
    this._acc = (this._acc || 0) + dt;
    if (this._acc > 0.08) {
      this._acc = 0;
      this.draw();
    }
  }

  draw() {
    const { ctx } = this;
    const W = 128;
    const H = 76;
    const mode = this.modes[this.mode];
    if (mode === 'code') {
      ctx.fillStyle = '#262a45';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#343858';
      ctx.fillRect(0, 0, W, 7);
      ['#ff6b6b', '#ffd166', '#5ddc8f'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(3 + i * 5, 2, 3, 3);
      });
      ctx.fillStyle = '#1e2138';
      ctx.fillRect(0, 7, 22, H - 7);
      ctx.fillStyle = '#4a4f75';
      for (let i = 0; i < 8; i++) ctx.fillRect(3 + (i % 3 ? 3 : 0), 11 + i * 6, 12 - (i % 3) * 2, 2);
      ctx.fillStyle = '#7bdff2';
      ctx.fillRect(3, 23, 14, 2);

      const visible = 11;
      let budget = Math.floor(this.typed);
      const totalChars = this.code.reduce((s, l) => s + l.tokens.reduce((a, t) => a + t.w + 2, 0), 0);
      budget %= totalChars;
      let lineIndex = 0;
      const typedLines = [];
      while (budget > 0 && lineIndex < this.code.length) {
        const line = this.code[lineIndex];
        const len = line.tokens.reduce((a, t) => a + t.w + 2, 0);
        typedLines.push({ line, chars: Math.min(len, budget) });
        budget -= len;
        lineIndex++;
      }
      const start = Math.max(0, typedLines.length - visible);
      let cursor = [26, 11];
      typedLines.slice(start).forEach(({ line, chars }, row) => {
        const y = 11 + row * 6;
        ctx.fillStyle = '#4b4e66';
        ctx.fillRect(25, y, 3, 2);
        if (line.blank) return;
        let x = 32 + line.indent;
        let left = chars;
        for (const t of line.tokens) {
          if (left <= 0) break;
          const w = Math.min(t.w, left);
          ctx.fillStyle = t.c;
          ctx.fillRect(x, y, w, 3);
          x += t.w + 2;
          left -= t.w + 2;
        }
        cursor = [Math.min(x, W - 4), y - 1];
      });
      if (Math.floor(this.clock * 2) % 2 === 0) {
        ctx.fillStyle = '#f4f4f8';
        ctx.fillRect(cursor[0], cursor[1], 2, 4);
      }
    } else if (mode === 'design') {
      ctx.fillStyle = '#e9e5df';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(0, 0, W, 7);
      ctx.fillStyle = '#f7f5f1';
      ctx.fillRect(0, 7, 18, H);
      ctx.fillRect(W - 24, 7, 24, H);
      ctx.fillStyle = '#c9c4bc';
      for (let i = 0; i < 6; i++) ctx.fillRect(3, 11 + i * 7, 12, 3);
      for (let i = 0; i < 7; i++) ctx.fillRect(W - 21, 11 + i * 7, 16 - (i % 3) * 3, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(26, 13, 74, 54);
      ctx.fillStyle = '#e2342b';
      ctx.fillRect(32, 19, 30, 30);
      ctx.fillStyle = '#f6c53b';
      ctx.beginPath();
      ctx.arc(80, 34, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(32, 54, 40, 3);
      ctx.fillRect(32, 60, 26, 2);
      const bob = Math.sin(this.clock * 2) * 6;
      ctx.strokeStyle = '#3b82f6';
      ctx.strokeRect(67.5, 21.5 + bob * 0.2, 25, 25);
      ctx.fillStyle = '#111';
      ctx.fillRect(88 + bob, 48, 2, 6);
      ctx.fillRect(88 + bob, 48, 5, 2);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#2a1033');
      g.addColorStop(1, '#5c1420');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e2342b';
      ctx.fillRect(10, 12, 40, 40);
      ctx.fillStyle = '#ddd4e8';
      ctx.fillRect(16, 18, 28, 4);
      ctx.fillRect(16, 25, 20, 4);
      ctx.fillRect(16, 32, 24, 4);
      ctx.fillStyle = '#fff2ea';
      ctx.fillRect(58, 14, 52, 4);
      ctx.fillStyle = '#c99aa8';
      ctx.fillRect(58, 22, 34, 3);
      for (let i = 0; i < 12; i++) {
        const h = 4 + Math.abs(Math.sin(this.clock * 6 + i * 1.7)) * 14;
        ctx.fillStyle = i % 2 ? '#ff8a7a' : '#ffd166';
        ctx.fillRect(58 + i * 4, 48 - h, 3, h);
      }
      ctx.fillStyle = '#5a3a48';
      ctx.fillRect(10, 62, 108, 2);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(10, 62, 20 + ((this.clock * 4) % 88), 2);
    }
    this.texture.needsUpdate = true;
  }
}

export function monitor() {
  const g = new THREE.Group();
  const black = '#18181c';
  const y0 = 0;
  const z = 0;
  g.add(box(0.24, 0.014, 0.17, black, 0, y0 + 0.007, z - 0.02));
  g.add(box(0.045, 0.24, 0.03, black, 0, y0 + 0.13, z - 0.055));
  g.add(box(0.7, 0.42, 0.035, black, 0, y0 + 0.34, z));
  const screen = new Screen();
  const screenMat = new THREE.MeshBasicMaterial({ map: screen.texture });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.665, 0.385), screenMat);
  face.position.set(0, y0 + 0.345, z + 0.0185);
  g.add(face);
  g.position.set(0.12, DESK.top, -1.5);
  return { group: hotspot(g, 'monitor'), screen, screenMat };
}

export function keyboard() {
  const g = new THREE.Group();
  const top = mat('#ffffff', { map: keyboardTexture() });
  const side = mat('#d9d1c4');
  g.add(box(0.42, 0.02, 0.13, [side, side, top, side, side, side], 0, 0.01, 0));
  // mouse pad + mouse
  g.add(box(0.3, 0.004, 0.22, '#1f1f24', 0.44, 0.002, -0.01));
  g.add(box(0.058, 0.026, 0.095, '#f2efe9', 0.48, 0.017, 0));
  g.position.set(0.12, DESK.top, -1.07);
  return hotspot(g, 'keyboard');
}

export function headphones() {
  const g = new THREE.Group();
  const black = '#26262c';
  g.add(box(0.07, 0.03, 0.08, black, -0.075, 0.015, 0));
  g.add(box(0.07, 0.03, 0.08, black, 0.075, 0.015, 0));
  g.add(box(0.05, 0.006, 0.06, '#4a4a54', -0.075, 0.032, 0));
  g.add(box(0.05, 0.006, 0.06, '#4a4a54', 0.075, 0.032, 0));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.009, 4, 12, Math.PI), mat(black));
  band.rotation.x = -Math.PI / 2;
  band.position.set(0, 0.02, -0.005);
  band.castShadow = true;
  g.add(band);
  g.position.set(0.95, DESK.top, -1.13);
  g.rotation.y = 0.35;
  return hotspot(g, 'headphones');
}

export function candle() {
  const g = new THREE.Group();
  g.add(cyl(0.034, 0.034, 0.07, '#f2b3c4', 12, 0, 0.035, 0));
  g.add(cyl(0.03, 0.03, 0.004, '#fbe6ec', 12, 0, 0.068, 0));
  g.add(box(0.004, 0.014, 0.004, '#2a2420', 0, 0.075, 0));
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb347' });
  const flame = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.012), flameMat);
  flame.position.y = 0.094;
  g.add(flame);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffa040', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
  );
  glow.scale.setScalar(0.14);
  glow.position.y = 0.094;
  glow.layers.set(GLOW_LAYER);
  g.add(glow);
  const light = new THREE.PointLight('#ff9c42', 0, 1.2, 2);
  light.position.y = 0.13;
  g.add(light);
  g.position.set(-0.27, DESK.top, -1.42);
  return { group: hotspot(g, 'candle'), flame, flameMat, glow, light };
}

// White vertical console with a little panda figurine perched on top.
export function consoleTower() {
  const g = new THREE.Group();
  const y0 = 0;
  g.add(box(0.12, 0.012, 0.09, '#202024', 0, y0 + 0.006, 0));
  g.add(box(0.05, 0.34, 0.25, '#1b1b20', 0, y0 + 0.185, 0));
  g.add(box(0.02, 0.36, 0.27, '#f4f3f0', -0.035, y0 + 0.19, 0));
  g.add(box(0.02, 0.36, 0.27, '#f4f3f0', 0.035, y0 + 0.19, 0));
  g.add(box(0.012, 0.012, 0.004, '#7aa7ff', 0, y0 + 0.08, 0.126));

  const panda = new THREE.Group();
  const w = '#f7f5ef';
  const k = '#1e1e22';
  panda.add(box(0.075, 0.06, 0.06, w, 0, 0.03, 0));
  panda.add(box(0.077, 0.02, 0.062, '#c99b5c', 0, 0.012, 0));
  panda.add(box(0.025, 0.02, 0.035, k, -0.024, 0.01, 0.035));
  panda.add(box(0.025, 0.02, 0.035, k, 0.024, 0.01, 0.035));
  panda.add(box(0.018, 0.04, 0.02, k, -0.045, 0.04, 0.01));
  panda.add(box(0.018, 0.04, 0.02, k, 0.045, 0.04, 0.01));
  const head = new THREE.Group();
  head.add(box(0.075, 0.06, 0.06, w, 0, 0.03, 0));
  head.add(box(0.02, 0.02, 0.012, k, -0.03, 0.068, 0));
  head.add(box(0.02, 0.02, 0.012, k, 0.03, 0.068, 0));
  head.add(box(0.02, 0.016, 0.004, k, -0.018, 0.035, 0.031));
  head.add(box(0.02, 0.016, 0.004, k, 0.018, 0.035, 0.031));
  head.add(box(0.012, 0.008, 0.006, k, 0, 0.02, 0.032));
  head.position.y = 0.06;
  panda.add(head);
  panda.position.set(0, y0 + 0.37, 0.02);
  panda.rotation.y = -0.5;
  g.add(panda);
  g.position.set(0.68, DESK.top, -1.48);
  return { group: hotspot(g, 'console'), panda };
}

// Mushroom lamp: warm dome that lights up the right side of the desk.
export function lamp() {
  const g = new THREE.Group();
  g.add(cyl(0.065, 0.075, 0.016, '#f1e4cf', 12, 0, 0.008, 0));
  g.add(cyl(0.018, 0.024, 0.17, '#f1e4cf', 10, 0, 0.1, 0));
  const shadeMat = new THREE.MeshLambertMaterial({ color: '#f6d7a8', emissive: '#ffb45e', emissiveIntensity: 0 });
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), shadeMat);
  shade.position.y = 0.17;
  shade.castShadow = true;
  g.add(shade);
  g.add(cyl(0.11, 0.11, 0.008, '#f3caa0', 12, 0, 0.172, 0));
  const light = new THREE.PointLight('#ffb267', 0, 3.2, 1.6);
  light.position.set(0, 0.14, 0.04);
  light.castShadow = false;
  g.add(light);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb46a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }),
  );
  glow.scale.setScalar(0.5);
  glow.position.y = 0.2;
  glow.layers.set(GLOW_LAYER);
  g.add(glow);
  g.position.set(0.94, DESK.top, -1.58);
  return { group: hotspot(g, 'lamp'), shadeMat, light, glow };
}

function book(w, h, d, cover, pages = '#f3ecdc', topMat) {
  const g = new THREE.Group();
  const c = typeof cover === 'string' ? mat(cover) : cover;
  g.add(box(w, h - 0.008, d - 0.008, pages, 0.004, 0, 0));
  const top = box(w, 0.005, d, topMat ? [c, c, topMat, c, c, c] : c, 0, h / 2 - 0.0025, 0);
  g.add(top, box(w, 0.005, d, c, 0, -h / 2 + 0.0025, 0), box(0.008, h, d, c, -w / 2 + 0.004, 0, 0));
  return g;
}

export function books() {
  const desk = new THREE.Group();
  const stack = [
    [0.25, 0.042, 0.18, '#2f6f73', 0.02],
    [0.23, 0.036, 0.165, '#c8392b', -0.06],
    [0.2, 0.046, 0.15, '#f3ecd9', 0.1, true],
  ];
  let y = 0;
  stack.forEach(([w, h, d, color, rot, cover]) => {
    const b = book(w, h, d, color, '#f6efe0', cover ? mat('#ffffff', { map: bookCoverTexture() }) : null);
    b.position.set(0, y + h / 2, 0);
    b.rotation.y = rot;
    y += h;
    desk.add(b);
  });
  desk.position.set(-0.55, DESK.top, -1.13);
  desk.rotation.y = -0.15;

  const floor = new THREE.Group();
  let fy = 0;
  [
    [0.3, 0.05, 0.22, '#e6b23a', 0.1],
    [0.27, 0.04, 0.2, '#2b2b33', -0.12],
    [0.24, 0.05, 0.18, '#d8a3a8', 0.25],
  ].forEach(([w, h, d, color, rot]) => {
    const b = book(w, h, d, color);
    b.position.set(0, fy + h / 2, 0);
    b.rotation.y = rot;
    fy += h;
    floor.add(b);
  });
  floor.position.set(-1.32, 0.012, -1.2);
  return { desk: hotspot(desk, 'books'), floor: hotspot(floor, 'books') };
}

// Swivel chair. The avatar is parented to `swivel` so they spin together.
export function chair() {
  const g = new THREE.Group();
  const dark = '#2a2a30';
  const metal = '#55555e';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box(0.3, 0.03, 0.045, dark, Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14);
    leg.rotation.y = -a;
    g.add(leg);
    g.add(box(0.04, 0.04, 0.04, '#111114', Math.cos(a) * 0.28, 0.02, Math.sin(a) * 0.28));
  }
  g.add(cyl(0.022, 0.026, 0.3, metal, 8, 0, 0.22, 0));

  const swivel = new THREE.Group();
  swivel.position.y = 0;
  swivel.add(box(0.2, 0.03, 0.2, dark, 0, 0.385, 0));
  swivel.add(box(0.48, 0.07, 0.46, '#34343b', 0, 0.43, 0));
  swivel.add(box(0.44, 0.012, 0.42, '#3e3e46', 0, 0.468, 0.005));
  swivel.add(box(0.06, 0.26, 0.04, dark, 0, 0.55, -0.235));
  const back = box(0.44, 0.32, 0.06, '#34343b', 0, 0.76, -0.25);
  back.rotation.x = -0.1;
  swivel.add(back);
  g.add(swivel);
  return { group: g, swivel, seatTop: 0.474 };
}
