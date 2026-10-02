import * as THREE from 'three';

// Time of day as one number: 0 day, 1 sunset, 2 dusk, 3 night, 4 dawn
// (5 wraps back to day). Everything lighting-related is keyed off it, so a
// "time-lapse" is just animating this number.
export const TOD = { day: 0, sunset: 1, dusk: 2, night: 3, dawn: 4 };

const C = (hex) => new THREE.Color(hex);

// lightAz/El: where the light through the window comes from (sun, later moon).
// Az is measured from the window's outward direction (+x) towards +z.
const KEYS = [
  {
    // day
    lightAz: -0.1, lightEl: 33, lightColor: C('#ffeccc'), lightI: 9,
    sunAz: -0.3, sunEl: 34, sunDisc: C('#fffbe8'), sunVisible: 1, moonAz: 0.35, moonEl: -20, moonVisible: 0,
    hemiSky: C('#fff4e6'), hemiGround: C('#b8a48e'), hemiI: 0.8, env: 0.42,
    fillColor: C('#fff6ea'), fillI: 0.75, interior: 0, exposure: 1,
    skyTop: C('#5aa9ec'), skyHorizon: C('#cfe8ff'), stars: 0,
    cloud: C('#ffffff'), cloudLit: C('#e6edf6'), cloudAlpha: 0.9, skyline: C('#9fb4c8'), cityLights: 0,
    shaft: 0.05,
  },
  {
    // sunset: low golden light right across the room
    lightAz: -0.12, lightEl: 6, lightColor: C('#ff8a3c'), lightI: 5,
    sunAz: -0.12, sunEl: 4, sunDisc: C('#ffb257'), sunVisible: 1, moonAz: 0.35, moonEl: -12, moonVisible: 0,
    hemiSky: C('#ffc8a0'), hemiGround: C('#8a6656'), hemiI: 0.55, env: 0.3,
    fillColor: C('#ffd0a8'), fillI: 0.65, interior: 0.25, exposure: 1,
    skyTop: C('#4f6fbd'), skyHorizon: C('#ffad66'), stars: 0,
    cloud: C('#f7b7a3'), cloudLit: C('#ff9a6a'), cloudAlpha: 0.85, skyline: C('#6b5a7a'), cityLights: 0.15,
    shaft: 0.12,
  },
  {
    // dusk: sun gone, lamps on, the evening carries on
    lightAz: -0.05, lightEl: 2, lightColor: C('#ff6a4a'), lightI: 0,
    sunAz: -0.06, sunEl: -9, sunDisc: C('#ff7a55'), sunVisible: 0.6, moonAz: 0.35, moonEl: 2, moonVisible: 0.5,
    hemiSky: C('#7a74b8'), hemiGround: C('#2f2744'), hemiI: 0.42, env: 0.15,
    fillColor: C('#9a90d0'), fillI: 0.3, interior: 1, exposure: 1.05,
    skyTop: C('#202a62'), skyHorizon: C('#c4607a'), stars: 0.4,
    cloud: C('#6d5f8f'), cloudLit: C('#a86a8a'), cloudAlpha: 0.7, skyline: C('#2b2a48'), cityLights: 0.8,
    shaft: 0,
  },
  {
    // night: moonlight through the window
    lightAz: 0.32, lightEl: 34, lightColor: C('#9db4ff'), lightI: 1.1,
    sunAz: 0, sunEl: -30, sunDisc: C('#ff7a55'), sunVisible: 0, moonAz: 0.3, moonEl: 26, moonVisible: 1,
    hemiSky: C('#3d4986'), hemiGround: C('#18142c'), hemiI: 0.3, env: 0.06,
    fillColor: C('#7c8ccc'), fillI: 0.18, interior: 1, exposure: 1.12,
    skyTop: C('#050918'), skyHorizon: C('#18224a'), stars: 1,
    cloud: C('#2a3150'), cloudLit: C('#1e2440'), cloudAlpha: 0.5, skyline: C('#10142a'), cityLights: 1,
    shaft: 0.04,
  },
  {
    // dawn: pink sunrise from the other side
    lightAz: 0.42, lightEl: 6, lightColor: C('#ffb48a'), lightI: 2.4,
    sunAz: 0.4, sunEl: 3, sunDisc: C('#ffd0a0'), sunVisible: 1, moonAz: 0.15, moonEl: 34, moonVisible: 0.2,
    hemiSky: C('#f1b8ae'), hemiGround: C('#6e5c64'), hemiI: 0.5, env: 0.22,
    fillColor: C('#f3c6b8'), fillI: 0.55, interior: 0.15, exposure: 1,
    skyTop: C('#6f86c8'), skyHorizon: C('#ffbf9c'), stars: 0.1,
    cloud: C('#f6c2c0'), cloudLit: C('#ffd2b0'), cloudAlpha: 0.8, skyline: C('#7c7896'), cityLights: 0.3,
    shaft: 0.08,
  },
];

const smooth = (t) => t * t * (3 - 2 * t);

export class Daylight {
  constructor() {
    this.tod = 0;
    this.anim = null;
    this.speed = 0; // tod units per second, for cloud drift
    this.k = {};
    for (const [key, v] of Object.entries(KEYS[0])) this.k[key] = v.isColor ? v.clone() : v;
    this.sample();
  }

  set(tod) {
    this.tod = tod;
    this.anim = null;
    this.sample();
  }

  // animate forward to `to` (may pass 5, which wraps to day) over `seconds`
  lapse(to, seconds, { linear = false, done } = {}) {
    if (seconds <= 0) {
      this.set(to % 5);
      done?.();
      return;
    }
    this.anim = { from: this.tod, to, seconds, t: 0, linear, done };
  }

  get lapsing() {
    return !!this.anim;
  }

  update(dt) {
    const before = this.tod;
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const p = Math.min(1, a.t / a.seconds);
      this.tod = a.from + (a.to - a.from) * (a.linear ? p : smooth(p));
      if (p >= 1) {
        this.tod %= 5;
        this.anim = null;
        a.done?.();
      }
    }
    this.speed = dt > 0 ? Math.abs(this.tod - before) / dt : 0;
    if (this.speed > 2) this.speed = 0; // a wrap, not a lapse
    this.sample();
  }

  sample() {
    const t = ((this.tod % 5) + 5) % 5;
    const i = Math.floor(t);
    const f = t - i;
    const A = KEYS[i];
    const B = KEYS[(i + 1) % 5];
    for (const key of Object.keys(A)) {
      const a = A[key];
      const b = B[key];
      if (a.isColor) this.k[key].copy(a).lerp(b, f);
      else this.k[key] = a + (b - a) * f;
    }
    return this.k;
  }

  // unit vector pointing from the room towards the light
  lightDirection(target) {
    const az = this.k.lightAz;
    const el = THREE.MathUtils.degToRad(this.k.lightEl);
    return target.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
  }
}
