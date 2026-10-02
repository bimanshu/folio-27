import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PixelPass } from './PixelPass.js';
import { buildRoom, fairyLights, GLOW_LAYER, ROOM } from './room.js';
import { books, candle, chair, consoleTower, desk, DESK, headphones, keyboard, lamp, monitor } from './props.js';
import { kalanchoe, palm, poinsettia, snakePlant, succulent } from './plants.js';
import { Avatar } from './character.js';
import { hotspot } from './helpers.js';

// Scene lighting for each theme; the world blends between them.
const THEMES = {
  light: {
    sky: new THREE.Color('#fff4e6'),
    ground: new THREE.Color('#b8a48e'),
    hemi: 1.7,
    sun: new THREE.Color('#fff1d9'),
    sunI: 3.1,
    fairy: 0.08,
    bulb: 1.0,
    glow: 0.22,
    screen: 0.95,
    monitorI: 0,
    lampI: 0.6,
    candleI: 0.05,
    fillI: 0,
  },
  dark: {
    sky: new THREE.Color('#5b5a96'),
    ground: new THREE.Color('#251d38'),
    hemi: 1.0,
    sun: new THREE.Color('#8d96ff'),
    sunI: 0.45,
    fairy: 0.55,
    bulb: 1.6,
    glow: 0.85,
    screen: 1.2,
    monitorI: 0.9,
    lampI: 1.8,
    candleI: 0.4,
    fillI: 0.7,
  },
};

const VIEW = { theta: -0.36, phi: 1.1, distance: 10 };
const TARGET = new THREE.Vector3(0.12, 0.98, -0.45);
const HOVER_EMISSIVE = new THREE.Color('#3b2a12');

export class World {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.mix = 0; // 0 = light, 1 = dark
    this.mixTarget = 0;
    this.lampOn = false;
    this.lampLevel = 0;
    this.candleLit = true;
    this.twinkle = 0;
    this.lastInteraction = -10;
    this.lastAutoWave = 0;
    this.time = 0;
    this.effects = [];
    // per-instance so other renderers of the same room can retune them
    this.themes = THEMES;
    this.view = { ...VIEW };
    this.target = TARGET.clone();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false; // PixelPass refreshes it once per frame
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 3, 20);
    this.camera.layers.enable(GLOW_LAYER);

    this.hotspots = new Map();
    this.build();
    this.setupLights();
    this.setupControls();

    this.composer = new EffectComposer(this.renderer);
    this.pixelPass = new PixelPass(3, this.scene, this.camera, { normalEdgeStrength: 0.35, depthEdgeStrength: 0.55 }, GLOW_LAYER);
    this.composer.addPass(this.pixelPass);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.timer = new THREE.Timer();
  }

  register(key, object) {
    hotspot(object, key);
    if (!this.hotspots.has(key)) this.hotspots.set(key, []);
    this.hotspots.get(key).push(object);
    return object;
  }

  build() {
    const s = this.scene;
    s.add(buildRoom());
    s.add(desk());

    const mon = monitor();
    this.screen = mon.screen;
    this.screenMat = mon.screenMat;
    s.add(this.register('monitor', mon.group));
    s.add(this.register('keyboard', keyboard()));
    s.add(this.register('headphones', headphones()));

    this.candle = candle();
    s.add(this.register('candle', this.candle.group));

    this.console = consoleTower();
    s.add(this.register('console', this.console.group));

    this.lamp = lamp();
    this.lamp.shadeMat.userData.ownEmissive = true;
    s.add(this.register('lamp', this.lamp.group));

    const b = books();
    s.add(this.register('books', b.desk), this.register('books', b.floor));

    const plants = [
      ['palm', palm(), [-1.78, 0, -1.25]],
      ['snake', snakePlant(), [1.88, 0, -1.3]],
      ['poinsettia', poinsettia(), [1.17, DESK.top, -1.42]],
      ['flowers', kalanchoe(), [-0.86, DESK.top, -1.47]],
    ];
    for (const [key, obj, pos] of plants) {
      obj.position.set(...pos);
      s.add(this.register(key, obj));
    }
    const s1 = succulent(3);
    s1.position.set(-0.64, DESK.top, -1.56);
    const s2 = succulent(8, '#e8d9c4');
    s2.position.set(-0.52, DESK.top, -1.6);
    s2.scale.setScalar(0.85);
    s.add(this.register('succulents', s1), this.register('succulents', s2));
    // the poster wall & frames tag themselves; collect them for highlights
    s.traverse((o) => {
      if (o.userData.hotspot === 'posters' && o.parent?.userData.hotspot !== 'posters') this.register('posters', o);
      if (o.userData.hotspot === 'frames' && o.parent?.userData.hotspot !== 'frames') this.register('frames', o);
    });

    // chair + avatar
    this.chair = chair();
    this.chair.group.position.set(0.12, 0.012, -0.64);
    this.chair.swivel.rotation.y = Math.PI;
    s.add(this.chair.group);
    this.avatar = new Avatar(this.chair);
    this.register('me', this.avatar.root);
    this.chair.group.children.forEach((c) => {
      if (c !== this.chair.swivel) hotspot(c, 'chair');
    });
    this.chair.swivel.children.forEach((c) => {
      if (c !== this.avatar.root) hotspot(c, 'chair');
    });
    this.hotspots.set('chair', [this.chair.group]);

    // fairy lights: the big strand around the posters plus a few on the plants
    const z = -1.68;
    const strands = [
      fairyLights(
        [
          [-0.95, 0.86, -1.45],
          [-0.76, 1.1, z],
          [-0.7, 1.5, z],
          [-0.64, 1.95, z],
          [-0.4, 2.2, z],
          [-0.14, 2.4, z],
          [0.12, 2.5, z],
          [0.38, 2.4, z],
          [0.64, 2.2, z],
          [0.88, 1.98, z],
          [0.94, 1.58, z],
          [1.0, 1.2, z],
          [1.12, 0.98, -1.5],
        ],
        { spacing: 0.13, seed: 2 },
      ),
      fairyLights(
        [
          [1.06, 0.95, -1.36],
          [1.24, 1.0, -1.3],
          [1.3, 1.06, -1.48],
          [1.08, 1.1, -1.55],
          [1.17, 1.12, -1.4],
        ],
        { spacing: 0.07, seed: 4 },
      ),
      fairyLights(
        [
          [-1.95, 0.45, -1.05],
          [-1.6, 0.62, -1.08],
          [-1.62, 0.85, -1.4],
          [-1.95, 1.0, -1.45],
          [-1.8, 1.18, -1.2],
        ],
        { spacing: 0.1, seed: 6 },
      ),
    ];
    this.bulbs = [];
    const lightsGroup = new THREE.Group();
    strands.forEach((st) => {
      lightsGroup.add(st.group);
      this.bulbs.push(...st.bulbs);
    });
    s.add(this.register('lights', lightsGroup));
    this.mainStrand = strands[0];
  }

  setupLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
    s.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#ffffff', 2);
    this.sun.position.set(-3.2, 5.5, 3.4);
    this.sun.target.position.set(0.3, 0.6, -0.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const c = this.sun.shadow.camera;
    c.left = -3.6;
    c.right = 3.6;
    c.top = 3.6;
    c.bottom = -3.6;
    c.near = 1;
    c.far = 14;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    s.add(this.sun, this.sun.target);

    this.fairyLightsPoints = [0.18, 0.5, 0.82].map((t) => {
      const p = this.mainStrand.curve.getPointAt(t);
      const light = new THREE.PointLight('#ffb867', 0, 1.8, 1.8);
      light.position.set(p.x, p.y - 0.05, p.z + 0.18);
      s.add(light);
      return light;
    });

    this.monitorLight = new THREE.PointLight('#8fb6ff', 0, 1.9, 1.8);
    this.monitorLight.position.set(0.12, 1.12, -1.2);
    s.add(this.monitorLight);

    // soft fill so you can still see me (and the fit) at night
    this.fillLight = new THREE.PointLight('#ffd2a6', 0, 2.6, 1.6);
    this.fillLight.position.set(-0.5, 1.5, 0.35);
    s.add(this.fillLight);
  }

  setupControls() {
    const controls = new OrbitControls(this.camera, this.canvas);
    controls.target.copy(this.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.55;
    controls.minAzimuthAngle = -1.3;
    controls.maxAzimuthAngle = 0.12;
    controls.minPolarAngle = 0.72;
    controls.maxPolarAngle = 1.38;
    // vertical swipes keep scrolling the page on phones; sideways ones orbit
    this.canvas.style.touchAction = 'pan-y';
    controls.addEventListener('start', () => {
      this.dragging = true;
      this.lastInteraction = this.time;
      this.resetTween = null;
    });
    controls.addEventListener('end', () => {
      this.dragging = false;
      this.lastInteraction = this.time;
    });
    this.controls = controls;
    this.setView(this.view.theta, this.view.phi);
  }

  setView(theta, phi) {
    const sph = new THREE.Spherical(this.view.distance, phi, theta);
    this.camera.position.setFromSpherical(sph).add(this.target);
    this.camera.lookAt(this.target);
    this.controls.update();
  }

  resetView() {
    const sph = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.target));
    this.resetTween = { from: { theta: sph.theta, phi: sph.phi }, t: 0 };
  }

  setSize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(width, height);
    // keep art-pixels chunky but readable: ~420 of them across the stage
    const cssPixel = THREE.MathUtils.clamp(width / 420, 1.5, 3.2);
    this.pixelPass.setPixelSize(Math.max(1, Math.round(cssPixel * dpr)));

    this.fitFrustum(width / height);
    this.size = { width, height };
  }

  // Frame the whole diorama from the default view, whatever the stage shape.
  fitFrustum(aspect) {
    const probe = new THREE.Camera(); // a camera, so lookAt points -z at the target
    probe.position.setFromSpherical(new THREE.Spherical(this.view.distance, this.view.phi, this.view.theta)).add(this.target);
    probe.lookAt(this.target);
    probe.updateMatrixWorld();
    const inv = probe.matrixWorld.clone().invert();
    const { minX, maxX, minZ, maxZ, wallH, wallT } = ROOM;
    // On tall/narrow stages, frame the desk corner instead of the whole room
    // (you can still drag around to see the rest).
    const tight = THREE.MathUtils.clamp((1.25 - aspect) / 0.6, 0, 1);
    const lerp = (a, b) => a + (b - a) * tight;
    const xs = [lerp(minX, -2.0), lerp(maxX + wallT, 2.1)];
    const ys = [lerp(-0.23, 0.1), lerp(wallH + 0.03, 2.55)];
    const zs = [minZ - wallT, lerp(maxZ, 0.0)];
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const p = new THREE.Vector3();
    for (const x of xs) {
      for (const y of ys) {
        for (const z of zs) {
          p.set(x, y, z).applyMatrix4(inv);
          x0 = Math.min(x0, p.x);
          x1 = Math.max(x1, p.x);
          y0 = Math.min(y0, p.y);
          y1 = Math.max(y1, p.y);
        }
      }
    }
    const pad = 0.045 * (y1 - y0);
    let w = x1 - x0 + pad * 2;
    let h = y1 - y0 + pad * 2;
    if (w / h < aspect) w = h * aspect;
    else h = w / aspect;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    Object.assign(this.camera, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 });
    this.camera.updateProjectionMatrix();
  }

  setTheme(theme, animate = true) {
    this.mixTarget = theme === 'dark' ? 1 : 0;
    if (!animate) this.mix = this.mixTarget;
    this.lampOn = theme === 'dark';
    if (!animate) this.lampLevel = this.lampOn ? 1 : 0;
  }

  // --- interaction --------------------------------------------------------
  pick(ndcX, ndcY) {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      if (h.object.userData.hotspot) return h.object.userData.hotspot;
    }
    return null;
  }

  setHover(key) {
    if (key === this.hovered) return;
    if (this.hovered) this._tint(this.hovered, false);
    this.hovered = key;
    if (key) this._tint(key, true);
  }

  _tint(key, on) {
    for (const root of this.hotspots.get(key) || []) {
      root.traverse((o) => {
        if (!o.isMesh || o.userData.hotspot !== key) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m.emissive || m.userData.ownEmissive) continue;
          m.emissive.copy(on ? HOVER_EMISSIVE : new THREE.Color(0));
        }
      });
    }
  }

  activate(key) {
    this.lastInteraction = this.time;
    switch (key) {
      case 'me':
        this.avatar.wave(this.camera.position);
        break;
      case 'chair':
        this.avatar.spin();
        break;
      case 'monitor':
        this.screen.next();
        this.bounce('monitor', 0.04);
        break;
      case 'lamp':
        this.lampOn = !this.lampOn;
        break;
      case 'candle':
        this.candleLit = !this.candleLit;
        break;
      case 'lights':
        this.twinkle = 2.6;
        break;
      case 'console':
        this.effects.push({ t: 0, dur: 0.9, apply: (p) => this._pandaHop(p) });
        break;
      case 'posters':
      case 'frames':
        this.wiggle(key);
        break;
      case 'keyboard':
        this.bounce(key, 0.05);
        break;
      default:
        this.bounce(key, 0.12);
    }
  }

  wave() {
    this.avatar.wave(this.camera.position);
  }

  bounce(key, amount) {
    const roots = this.hotspots.get(key) || [];
    roots.forEach((root) => {
      root.userData.baseScale ??= root.scale.clone();
    });
    this.effects.push({
      t: 0,
      dur: 0.6,
      apply: (p) => {
        const k = Math.sin(p * Math.PI * 3) * (1 - p) * amount;
        roots.forEach((root) => {
          const b = root.userData.baseScale;
          root.scale.set(b.x * (1 - k * 0.5), b.y * (1 + k), b.z * (1 - k * 0.5));
        });
      },
    });
  }

  // flat things on the walls swing on their nails instead of squashing
  wiggle(key) {
    const items = [];
    (this.hotspots.get(key) || []).forEach((root) => root.children.forEach((c) => items.push(c)));
    items.forEach((c, i) => {
      c.userData.baseRot ??= c.rotation.clone();
      c.userData.phase = i * 0.6;
    });
    const axis = key === 'frames' ? 'x' : 'z';
    this.effects.push({
      t: 0,
      dur: 1.2,
      apply: (p) => {
        items.forEach((c) => {
          const k = Math.sin(p * Math.PI * 4 + c.userData.phase) * (1 - p) * 0.12;
          c.rotation[axis] = c.userData.baseRot[axis] + k;
        });
      },
    });
  }

  _pandaHop(p) {
    const panda = this.console.panda;
    panda.userData.baseY ??= panda.position.y;
    panda.position.y = panda.userData.baseY + Math.sin(p * Math.PI) * 0.12;
    panda.rotation.y = -0.5 + p * Math.PI * 2;
  }

  // --- frame ----------------------------------------------------------------
  update() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;

    this.mix += (this.mixTarget - this.mix) * (1 - Math.exp(-dt * 3.5));
    this.lampLevel += ((this.lampOn ? 1 : 0) - this.lampLevel) * (1 - Math.exp(-dt * 10));
    const m = this.mix;
    const L = this.themes.light;
    const D = this.themes.dark;
    const lerp = (a, b) => a + (b - a) * m;

    this.hemi.color.copy(L.sky).lerp(D.sky, m);
    this.hemi.groundColor.copy(L.ground).lerp(D.ground, m);
    this.hemi.intensity = lerp(L.hemi, D.hemi);
    this.sun.color.copy(L.sun).lerp(D.sun, m);
    this.sun.intensity = lerp(L.sunI, D.sunI);

    // fairy lights twinkle; a click sends a chase down the strand
    this.twinkle = Math.max(0, this.twinkle - dt);
    const bulbBase = lerp(L.bulb, D.bulb);
    const glowBase = lerp(L.glow, D.glow);
    for (const b of this.bulbs) {
      let k = this.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 2.2 + b.phase);
      if (this.twinkle > 0) {
        const wave = Math.sin((b.t * 10 - t * 9) * 1.0);
        k = 0.35 + Math.max(0, wave) * 1.2;
      }
      b.bulb.material.color.setRGB(1, 0.77, 0.42).multiplyScalar(bulbBase * k);
      b.glow.material.opacity = glowBase * k;
    }
    const fairyI = lerp(L.fairy, D.fairy);
    this.fairyLightsPoints.forEach((l, i) => {
      l.intensity = fairyI * (0.9 + 0.1 * Math.sin(t * 1.7 + i));
    });

    // lamp
    const lampI = lerp(L.lampI, D.lampI) * this.lampLevel;
    this.lamp.light.intensity = lampI;
    this.lamp.shadeMat.emissiveIntensity = this.lampLevel * lerp(0.35, 0.9);
    this.lamp.glow.material.opacity = this.lampLevel * lerp(0.12, 0.7);

    // candle
    const flicker = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    const lit = this.candleLit ? 1 : 0;
    this.candle.flame.visible = this.candleLit;
    this.candle.flame.scale.set(1, flicker, 1);
    this.candle.light.intensity = lerp(L.candleI, D.candleI) * flicker * lit;
    this.candle.glow.material.opacity = lerp(0.2, 0.75) * flicker * lit;

    // every so often, if nobody is poking around, say hi again
    if (!this.reducedMotion && !this.avatar.busy && t - this.lastInteraction > 10 && t - this.lastAutoWave > 25) {
      this.lastAutoWave = t;
      this.wave();
    }

    // monitor
    const typing = this.avatar.update(dt, this.camera.position);
    this.screen.update(dt, typing);
    const sc = lerp(L.screen, D.screen);
    this.screenMat.color.setScalar(sc);
    this.monitorLight.intensity = lerp(L.monitorI, D.monitorI);
    this.fillLight.intensity = lerp(L.fillI, D.fillI);

    // one-shot effects (bounces, panda hop)
    this.effects = this.effects.filter((e) => {
      e.t += dt;
      const p = Math.min(1, e.t / e.dur);
      e.apply(p);
      return p < 1;
    });

    // camera: reset tween, then a gentle idle sway
    if (this.resetTween) {
      const r = this.resetTween;
      r.t = Math.min(1, r.t + dt / 0.9);
      const e = 1 - Math.pow(1 - r.t, 3);
      this.setView(r.from.theta + (this.view.theta - r.from.theta) * e, r.from.phi + (this.view.phi - r.from.phi) * e);
      if (r.t >= 1) this.resetTween = null;
    } else if (!this.dragging && !this.reducedMotion && t - this.lastInteraction > 6) {
      const sph = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.target));
      const goal = this.view.theta + Math.sin(t * 0.22) * 0.08;
      const theta = sph.theta + (goal - sph.theta) * (1 - Math.exp(-dt * 0.6));
      const phi = sph.phi + (this.view.phi - sph.phi) * (1 - Math.exp(-dt * 0.6));
      this.setView(theta, phi);
    } else {
      this.controls.update();
    }

    this.composer.render(dt);
  }
}
