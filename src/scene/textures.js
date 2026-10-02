import * as THREE from 'three';
import { canvasTexture, rng } from './helpers.js';

const SANS = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function lines(ctx, rows, { x, y, size, lh = size, font = SANS, color, align = 'center', weight = '900' }) {
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.font = `${weight} ${size}px ${font}`;
  rows.forEach((row, i) => ctx.fillText(row, x, y + i * lh));
}

// ---------------------------------------------------------------------------
// Gallery wall — loosely redrawn from the posters above the desk.
// ---------------------------------------------------------------------------
const PW = 96;
const PH = 132;

const POSTERS = {
  ego(ctx) {
    ctx.fillStyle = '#8c1a1e';
    ctx.fillRect(0, 0, PW, PH);
    lines(ctx, ['ego.'], { x: 48, y: 30, size: 15, font: SERIF, color: '#f4e9e1', weight: '400' });
    ctx.fillStyle = '#1b0b0c';
    ctx.beginPath();
    ctx.arc(48, 78, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(28, 90, 40, 34);
    ctx.fillStyle = '#c33a2c';
    ctx.fillRect(40, 72, 6, 3);
    ctx.fillRect(34, 100, 5, 18);
  },
  art(ctx) {
    ctx.fillStyle = '#e8461f';
    ctx.fillRect(0, 0, PW, PH);
    lines(ctx, ['THE'], { x: 30, y: 22, size: 12, color: '#ffd23f' });
    lines(ctx, ['art'], { x: 54, y: 30, size: 30, font: SERIF, color: '#ffd23f', weight: '700' });
    lines(ctx, ['OF DOING', 'NOTHING'], { x: 48, y: 70, size: 15, lh: 17, color: '#ffd23f' });
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(70, 22, 8, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
  },
  secret(ctx) {
    ctx.fillStyle = '#18220f';
    ctx.fillRect(0, 0, PW, PH);
    const r = rng(7);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = r() > 0.5 ? '#2e4419' : '#3b5a1f';
      ctx.fillRect(r() * PW, r() * PH, 6 + r() * 8, 3 + r() * 4);
    }
    lines(ctx, ['THERE', 'IS NO'], { x: 48, y: 16, size: 17, lh: 19, color: '#f5f0d8' });
    lines(ctx, ['SECRET', 'RECIPE.'], { x: 48, y: 58, size: 17, lh: 19, color: '#d9e34c' });
    ctx.fillStyle = '#f2b632';
    ctx.fillRect(14, 112, 8, 8);
  },
  risk(ctx) {
    ctx.fillStyle = '#ddd4e8';
    ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#e2342b';
    ctx.fillRect(14, 24, 68, 66);
    lines(ctx, ['Take', 'that', 'risk.'], {
      x: 48, y: 28, size: 19, lh: 20, font: SERIF, color: '#1a1a1a', weight: '700',
    });
    ctx.fillStyle = '#7d7487';
    ctx.fillRect(20, 104, 56, 2);
    ctx.fillRect(28, 110, 40, 2);
  },
  collage(ctx) {
    ctx.fillStyle = '#f4f1ec';
    ctx.fillRect(0, 0, PW, PH);
    const r = rng(42);
    const palette = ['#1c1c1c', '#d8382b', '#9a9a9a', '#e8c9a8', '#4b6b9a', '#1c1c1c'];
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = palette[Math.floor(r() * palette.length)];
      ctx.fillRect(6 + r() * 76, 6 + r() * 112, 8 + r() * 16, 4 + r() * 9);
    }
    lines(ctx, ['DREAM LIFE'], { x: 48, y: 108, size: 9, color: '#d8382b' });
  },
  life(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, '#d9271d');
    g.addColorStop(0.55, '#a5130f');
    g.addColorStop(1, '#140606');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PW, PH);
    ctx.strokeStyle = 'rgba(255,240,230,0.85)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const w = 16 + i * 8;
      ctx.beginPath();
      ctx.moveTo(48 - w / 2, 62);
      ctx.lineTo(48 - w / 2, 34 - i * 2 + w / 2);
      ctx.arc(48, 34 - i * 2 + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(48 + w / 2, 62);
      ctx.stroke();
    }
    lines(ctx, ['THE LIFE YOU WANT', 'IS ON THE OTHER', 'SIDE OF THE HABITS'], {
      x: 48, y: 70, size: 7, lh: 9, color: '#fff3ea',
    });
    ctx.strokeStyle = 'rgba(255,240,230,0.6)';
    ctx.strokeRect(30, 104, 36, 18);
  },
  proud(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, '#173016');
    g.addColorStop(0.6, '#2c5220');
    g.addColorStop(1, '#4c7a2a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PW, PH);
    ctx.fillStyle = '#f2c94c';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(48 + Math.cos(a) * 7, 26 + Math.sin(a) * 7, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e07a1f';
    ctx.beginPath();
    ctx.arc(48, 26, 4, 0, Math.PI * 2);
    ctx.fill();
    lines(ctx, ['Make', 'little you', 'proud.'], {
      x: 48, y: 48, size: 15, lh: 17, font: SERIF, color: '#f3e3b5', weight: '700',
    });
  },
  create(ctx) {
    ctx.fillStyle = '#e1261c';
    ctx.fillRect(0, 0, PW, PH);
    lines(ctx, ['I', 'WAS', 'CREATED', 'TO', 'CREATE'], { x: 48, y: 22, size: 15, lh: 17, color: '#151010' });
  },
  abstract(ctx) {
    const g = ctx.createLinearGradient(0, 0, PW, PH);
    g.addColorStop(0, '#3a0809');
    g.addColorStop(1, '#6d1214');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PW, PH);
    ctx.strokeStyle = '#d8322a';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-6, 112);
    ctx.bezierCurveTo(30, 40, 70, 130, 104, 44);
    ctx.stroke();
    ctx.strokeStyle = '#f06a4a';
    ctx.lineWidth = 2;
    ctx.stroke();
    lines(ctx, ['·  ·  ·'], { x: 48, y: 18, size: 9, color: '#f4c7b8' });
  },
};

export function posterTexture(name) {
  return canvasTexture(PW, PH, (ctx) => {
    POSTERS[name](ctx);
    // thin white print border like real paper prints
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, PW, PH);
  });
}

// ---------------------------------------------------------------------------
// Room surfaces
// ---------------------------------------------------------------------------
export function floorTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const r = rng(3);
    const tones = ['#caa47c', '#c49d74', '#d0ab83', '#bf976d'];
    for (let row = 0; row < 8; row++) {
      let x = -Math.floor(r() * 24);
      while (x < 64) {
        const len = 18 + Math.floor(r() * 22);
        ctx.fillStyle = tones[Math.floor(r() * tones.length)];
        ctx.fillRect(x, row * 8, len, 8);
        ctx.fillStyle = '#9f7a54';
        ctx.fillRect(x, row * 8, 1, 8);
        x += len;
      }
      ctx.fillStyle = '#a98460';
      ctx.fillRect(0, row * 8 + 7, 64, 1);
    }
  }, { repeat: [3.8, 2.1] });
}

export function rugTexture() {
  return canvasTexture(96, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f1e6d3';
    ctx.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = r() > 0.5 ? '#e8dbc4' : '#f7eedf';
      ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1);
    }
    // checkered border
    const c = 4;
    for (let x = 0; x < w; x += c) {
      for (let y = 0; y < h; y += c) {
        const edge = x < c * 2 || y < c * 2 || x >= w - c * 2 || y >= h - c * 2;
        if (edge && ((x / c + y / c) % 2 === 0)) {
          ctx.fillStyle = '#c9392c';
          ctx.fillRect(x, y, c, c);
        }
      }
    }
    ctx.fillStyle = '#c9392c';
    ctx.fillRect(14, 14, w - 28, 1);
    ctx.fillRect(14, h - 15, w - 28, 1);
    ctx.fillRect(14, 14, 1, h - 28);
    ctx.fillRect(w - 15, 14, 1, h - 28);
    // small centre motif
    ctx.fillStyle = '#e9a23b';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(w / 2 + i * 8 - 1, h / 2 - 1, 3, 3);
    }
  });
}

export function keyboardTexture() {
  return canvasTexture(60, 18, (ctx, w, h) => {
    ctx.fillStyle = '#d9d1c4';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 14; col++) {
        ctx.fillStyle = row === 0 && col === 0 ? '#d9452f' : '#f6f1e8';
        ctx.fillRect(2 + col * 4, 1 + row * 4, 3, 3);
      }
    }
    ctx.fillStyle = '#d9d1c4';
    ctx.fillRect(18, 13, 24, 4);
    ctx.fillStyle = '#f6f1e8';
    ctx.fillRect(18, 13, 22, 3);
  });
}

export function bookCoverTexture() {
  return canvasTexture(40, 52, (ctx, w, h) => {
    ctx.fillStyle = '#f3ecd9';
    ctx.fillRect(0, 0, w, h);
    lines(ctx, ['the personal'], { x: 20, y: 9, size: 5, color: '#5b4a2e', weight: '700' });
    ctx.fillStyle = '#e6b23a';
    ctx.fillRect(5, 17, 30, 15);
    lines(ctx, ['MBA'], { x: 20, y: 18, size: 13, color: '#fff7e4' });
    ctx.fillStyle = '#5b4a2e';
    ctx.fillRect(10, 40, 20, 2);
  });
}

// ---------------------------------------------------------------------------
// Outfit: FOG Essentials tee, baggy denim, Blazer Mid
// ---------------------------------------------------------------------------
export function teeTexture(side) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#f4f2ed';
    ctx.fillRect(0, 0, w, h);
    // soft fabric folds
    ctx.fillStyle = '#e7e3dc';
    ctx.fillRect(10, 50, 14, 2);
    ctx.fillRect(38, 46, 16, 2);
    ctx.fillRect(0, 60, w, 4);
    if (side === 'front') {
      ctx.fillStyle = '#e1ddd5';
      ctx.fillRect(22, 0, 20, 4); // collar shadow
      lines(ctx, ['ESSENTIALS'], { x: 32, y: 18, size: 9, color: '#26231f' });
    } else {
      lines(ctx, ['ESSENTIALS'], { x: 32, y: 8, size: 6, color: '#3a3631' });
    }
  });
}

export function denimTexture() {
  return canvasTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#4d72a6';
    ctx.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 140; i++) {
      const v = r();
      ctx.fillStyle = v > 0.66 ? '#5f86bb' : v > 0.33 ? '#42659a' : '#6b91c4';
      ctx.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 2);
    }
    // faint twill diagonals
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = -h; i < w; i += 4) {
      for (let y = 0; y < h; y++) ctx.fillRect(i + y, y, 1, 1);
    }
  });
}

export function shoeSideTexture(mirror = false) {
  return canvasTexture(48, 36, (ctx, w, h) => {
    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.fillStyle = '#f8f6f1';
    ctx.fillRect(0, 0, w, h);
    // vintage sail midsole + toe overlay stitching
    ctx.fillStyle = '#ece0c4';
    ctx.fillRect(0, h - 8, w, 8);
    ctx.fillStyle = '#d9c8a4';
    ctx.fillRect(0, h - 8, w, 1);
    ctx.fillStyle = '#e4e0d8';
    ctx.fillRect(0, 14, 14, 1);
    // black swoosh: hook near the toe (left), tail rising to the heel (right)
    ctx.fillStyle = '#141414';
    ctx.beginPath();
    ctx.moveTo(45, 7);
    ctx.quadraticCurveTo(26, 21, 12, 25);
    ctx.quadraticCurveTo(4, 27, 6, 20);
    ctx.quadraticCurveTo(7, 17, 10, 15);
    ctx.quadraticCurveTo(9, 20, 14, 20);
    ctx.quadraticCurveTo(28, 17, 45, 7);
    ctx.fill();
  });
}

// ---------------------------------------------------------------------------
// Little extras
// ---------------------------------------------------------------------------
export function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function basketTexture() {
  return canvasTexture(32, 16, (ctx, w, h) => {
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = ((x + y) / 4) % 2 === 0 ? '#c79a62' : '#a77a45';
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.fillStyle = '#8a6136';
    ctx.fillRect(0, 0, w, 1);
  }, { repeat: [3, 1] });
}

export function snakeLeafTexture() {
  return canvasTexture(10, 32, (ctx, w, h) => {
    ctx.fillStyle = '#2d5a31';
    ctx.fillRect(0, 0, w, h);
    for (let y = 1; y < h; y += 4) {
      ctx.fillStyle = '#4f8b4a';
      ctx.fillRect(1, y, w - 2, 1);
      ctx.fillStyle = '#3c7140';
      ctx.fillRect(2, y + 2, w - 4, 1);
    }
    ctx.fillStyle = '#cfc966';
    ctx.fillRect(0, 0, 1, h);
    ctx.fillRect(w - 1, 0, 1, h);
  });
}

export function potPatternTexture() {
  return canvasTexture(32, 16, (ctx, w, h) => {
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5fb3a5';
    ctx.fillRect(0, 9, w, 3);
    ctx.fillStyle = '#f08aa0';
    for (let x = 2; x < w; x += 8) ctx.fillRect(x, 4, 3, 3);
    ctx.fillStyle = '#e6a23c';
    ctx.fillRect(0, 13, w, 1);
  }, { repeat: [2, 1] });
}
