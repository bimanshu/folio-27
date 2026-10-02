import * as THREE from 'three';
import { rng } from './helpers.js';

// The view out of the window: a painted sky that follows the time of day,
// with drifting clouds, a low skyline, the sun or moon, and stars at night.
const W = 256;
const H = 288;
const HORIZON = 0.7; // fraction of the height where the skyline sits

const css = (c, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;

export class Sky {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const r = rng(17);
    this.stars = Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H * HORIZON * 0.95, s: r() < 0.15 ? 2 : 1, p: r() * 6 }));
    this.clouds = Array.from({ length: 6 }, (_, i) => ({
      x: r() * W * 1.4 - W * 0.2,
      y: H * (0.12 + r() * 0.4),
      w: 50 + r() * 60,
      speed: 0.6 + r() * 0.8,
      seed: i,
    }));
    // a low skyline across the bottom, with windows that light up at night
    this.buildings = [];
    let x = -4;
    while (x < W) {
      const w = 14 + Math.floor(r() * 26);
      const h = 18 + Math.floor(r() * 46);
      const lit = [];
      for (let wy = 6; wy < h - 4; wy += 7) for (let wx = 4; wx < w - 4; wx += 6) if (r() < 0.45) lit.push([wx, wy, r()]);
      this.buildings.push({ x, w, h, lit });
      x += w + 2 + Math.floor(r() * 4);
    }
    this.time = 0;
  }

  // k: interpolated time-of-day keys from Daylight
  draw(k, dt, lapseSpeed) {
    this.time += dt;
    const ctx = this.ctx;
    const horizon = H * HORIZON;

    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, css(k.skyTop));
    g.addColorStop(1, css(k.skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // stars
    if (k.stars > 0.01) {
      for (const s of this.stars) {
        const tw = 0.6 + 0.4 * Math.sin(this.time * 1.7 + s.p);
        ctx.fillStyle = `rgba(255,250,235,${k.stars * tw})`;
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
    }

    // sun or moon: elevation maps to height in the frame, azimuth to x
    const body = (az, el, radius, draw) => {
      const x = W * (0.5 + az * 0.9);
      const y = horizon - (el / 38) * horizon;
      if (y > horizon + radius) return;
      draw(x, y, radius);
    };
    if (k.sunVisible > 0.01) {
      body(k.sunAz, k.sunEl, 15, (x, y, r) => {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
        glow.addColorStop(0, css(k.sunDisc, 0.55 * k.sunVisible));
        glow.addColorStop(1, css(k.sunDisc, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
        ctx.fillStyle = css(k.sunDisc, k.sunVisible);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    if (k.moonVisible > 0.01) {
      body(k.moonAz, k.moonEl, 11, (x, y, r) => {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        glow.addColorStop(0, `rgba(200,215,255,${0.3 * k.moonVisible})`);
        glow.addColorStop(1, 'rgba(200,215,255,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
        ctx.fillStyle = `rgba(246,243,228,${k.moonVisible})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(205,200,182,${k.moonVisible})`;
        [
          [-3, -2, 2.6],
          [4, 3, 2],
          [1, -5, 1.4],
        ].forEach(([dx, dy, cr]) => {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, cr, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }

    // clouds race across during a time-lapse, drift otherwise
    const drift = dt * (6 + lapseSpeed * 260);
    for (const c of this.clouds) {
      c.x += drift * c.speed;
      if (c.x - c.w > W) c.x = -c.w * 1.4;
      const puffs = 5;
      for (let i = 0; i < puffs; i++) {
        const px = c.x + (i / (puffs - 1)) * c.w;
        const py = c.y + Math.sin(i * 1.7 + c.seed) * 4;
        const pr = c.w * (0.16 + 0.07 * Math.sin(i * 2.3 + c.seed));
        ctx.fillStyle = css(k.cloud, k.cloudAlpha);
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(k.cloudLit, k.cloudAlpha * 0.9);
        ctx.beginPath();
        ctx.arc(px, py + pr * 0.35, pr * 0.8, 0, Math.PI);
        ctx.fill();
      }
    }

    // horizon haze, then the skyline
    const haze = ctx.createLinearGradient(0, horizon - 30, 0, horizon);
    haze.addColorStop(0, css(k.skyHorizon, 0));
    haze.addColorStop(1, css(k.skyHorizon, 0.8));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 30, W, 30);
    ctx.fillStyle = css(k.skyline);
    ctx.fillRect(0, horizon, W, H - horizon);
    for (const b of this.buildings) {
      ctx.fillStyle = css(k.skyline);
      ctx.fillRect(b.x, horizon - b.h, b.w, b.h);
      if (k.cityLights > 0.01) {
        for (const [wx, wy, p] of b.lit) {
          if (p > k.cityLights) continue;
          ctx.fillStyle = `rgba(255,214,140,${0.85 * k.cityLights})`;
          ctx.fillRect(b.x + wx, horizon - b.h + wy, 3, 3);
        }
      }
    }
    // trees in the foreground
    ctx.fillStyle = css(k.skyline.clone().multiplyScalar(0.8));
    for (let x = -10; x < W + 20; x += 22) {
      ctx.beginPath();
      ctx.arc(x + Math.sin(x) * 4, H - 8, 18, Math.PI, 0);
      ctx.fill();
    }
    this.texture.needsUpdate = true;
  }
}
