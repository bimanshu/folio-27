import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRoom, fairyLights, GLOW_LAYER, ROOM, skyPlane, sunOccluders, WINDOW } from './room.js';
import { books, candle, chair, consoleTower, desk, headphones, keyboard, lamp, monitor } from './props.js';
import { kalanchoe, palm, poinsettia, snakePlant, succulent } from './plants.js';
import { bed, sofa, stickVacuum, wateringCan } from './furniture.js';
import { Avatar } from './character.js';
import { Life } from './life.js';
import { Daylight, TOD } from './daylight.js';
import { Sky } from './sky.js';
import { hotspot } from './helpers.js';
import { BED, CAN_HOME, CHAIR, DESK, PLANTS, VACUUM_DOCK } from './layout.js';

// How long the evening lasts once you switch to dark mode, before bedtime.
export const EVENING_SECONDS = 390;

const VIEW = { theta: -0.5, phi: 1.04, distance: 10 };
const HOVER_EMISSIVE = new THREE.Color('#3b2a12');
const WARM_BULB = new THREE.Color(1, 0.77, 0.42);

export class World {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.time = 0;
    this.effects = [];
    this.twinkle = 0;
    this.lampLevel = 0;
    this.lampOverride = null;
    this.candleOverride = null;
    this.curtainsClosed = false;
    this.curtainK = 0;
    this.phase = 'day'; // day | sunset | evening | nightfall | night | sunrise
    this.dayStart = 0;
    this.nightMinutes = 0;
    this.lastInteraction = -10;
    this.view = { ...VIEW };
    this.target = new THREE.Vector3(0.15, 1.1, -0.1);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 60);
    this.camera.layers.enable(GLOW_LAYER);

    this.hotspots = new Map();
    this.daylight = new Daylight();
    this.build();
    this.setupLights();
    this.setupControls();

    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());

    this.life = new Life(this);
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
    const room = buildRoom();
    s.add(room);
    this.curtains = room.userData.curtains;
    s.add(this.register('desk', desk()));

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
    b.floor.position.set(-1.62, 0.012, -1.42);
    s.add(this.register('books', b.desk), this.register('books', b.floor));

    const plants = [
      ['palm', palm(), [PLANTS.palm[0], 0, PLANTS.palm[1]]],
      ['snake', snakePlant(), [PLANTS.snake[0], 0, PLANTS.snake[1]]],
      ['poinsettia', poinsettia(), [PLANTS.poinsettia[0], DESK.top, PLANTS.poinsettia[1]]],
      ['flowers', kalanchoe(), [PLANTS.flowers[0], DESK.top, PLANTS.flowers[1]]],
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

    // things tagged inside the room builder: collect their roots for highlights
    s.traverse((o) => {
      const key = o.userData.hotspot;
      if ((key === 'posters' || key === 'window') && o.parent?.userData.hotspot !== key) this.register(key, o);
    });

    this.bed = bed();
    s.add(this.register('bed', this.bed.group));
    s.add(this.register('sofa', sofa()));
    this.vacuum = stickVacuum();
    s.add(this.register('vacuum', this.vacuum.group));
    this.dockVacuum();
    this.can = wateringCan();
    this.register('can', this.can.group);
    this.placeCan(this.can.group);

    this.chair = chair();
    this.chair.group.position.set(CHAIR.x, 0.012, CHAIR.workZ);
    s.add(this.chair.group);
    this.chair.group.traverse((c) => hotspot(c, 'chair'));
    this.hotspots.set('chair', [this.chair.group]);

    this.avatar = new Avatar();
    s.add(this.register('me', this.avatar.group));

    // fairy lights: the big strand around the posters plus a few on the plants
    const z = -1.68;
    const [px, pz] = PLANTS.palm;
    const strands = [
      fairyLights(
        [
          [-0.95, 0.86, -1.45], [-0.76, 1.1, z], [-0.7, 1.5, z], [-0.64, 1.95, z], [-0.4, 2.2, z], [-0.14, 2.4, z],
          [0.12, 2.5, z], [0.38, 2.4, z], [0.64, 2.2, z], [0.88, 1.98, z], [0.94, 1.58, z], [1.0, 1.2, z], [1.12, 0.98, -1.5],
        ],
        { spacing: 0.13, seed: 2 },
      ),
      fairyLights(
        [[1.06, 0.95, -1.36], [1.24, 1.0, -1.3], [1.3, 1.06, -1.48], [1.08, 1.1, -1.55], [1.17, 1.12, -1.4]],
        { spacing: 0.07, seed: 4 },
      ),
      fairyLights(
        [[px - 0.17, 0.45, pz + 0.2], [px + 0.18, 0.62, pz + 0.17], [px + 0.16, 0.85, pz - 0.15], [px - 0.17, 1.0, pz - 0.2], [px - 0.02, 1.18, pz + 0.05]],
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

    // the view out of the window and a soft shaft of light through it
    this.sky = new Sky();
    s.add(skyPlane(this.sky.texture));
    this.shaft = this.buildShaft();
    s.add(this.shaft);
  }

  setupLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1);
    s.add(this.hemi);

    // sun (and later moon) through the window: crisp shadows, sealed room
    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 0.5, far: 30 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 2.5;
    this.sun.target.position.set(0.1, 0.4, -0.1);
    s.add(this.sun, this.sun.target);
    sunOccluders(this.sun.shadow.camera).forEach((o) => s.add(o));

    // soft "studio" fill from the open front-left, for the clay look
    this.fill = new THREE.DirectionalLight('#ffffff', 1);
    this.fill.position.set(-3.4, 5.4, 4.6);
    this.fill.target.position.set(0.2, 0.5, -0.3);
    this.fill.castShadow = true;
    this.fill.shadow.mapSize.set(2048, 2048);
    Object.assign(this.fill.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    this.fill.shadow.bias = -0.0006;
    this.fill.shadow.normalBias = 0.02;
    this.fill.shadow.radius = 8;
    s.add(this.fill, this.fill.target);

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
  }

  // A soft beam from the window to wherever the light lands.
  buildShaft() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    const alpha = new Float32Array(8 * 4).fill(1);
    for (let i = 4; i < 8; i++) alpha[i * 4 + 3] = 0;
    geo.setAttribute('color', new THREE.BufferAttribute(alpha, 4));
    // four sides of the beam (window edge i to far edge i)
    const idx = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      idx.push(i, j, j + 4, i, j + 4, i + 4);
    }
    geo.setIndex(idx);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0.05,
      }),
    );
    m.frustumCulled = false;
    m.layers.set(GLOW_LAYER);
    return m;
  }

  updateShaft(dir, k) {
    const { maxX, minX } = ROOM;
    const { z0, z1, y0, y1 } = WINDOW;
    const pos = this.shaft.geometry.attributes.position;
    const corners = [
      [maxX, y0, z0],
      [maxX, y0, z1],
      [maxX, y1, z1],
      [maxX, y1, z0],
    ];
    const open = 1 - this.curtainK * 0.85;
    corners.forEach(([x, y, z], i) => {
      const dx = -dir.x;
      const dy = -dir.y;
      const dz = -dir.z;
      let t = 7;
      if (dy < -1e-3) t = Math.min(t, y / -dy);
      if (dx < -1e-3) t = Math.min(t, (minX - x) / dx);
      pos.setXYZ(i, x, y, z);
      pos.setXYZ(i + 4, x + dx * t, y + dy * t, z + dz * t);
    });
    pos.needsUpdate = true;
    this.shaft.geometry.computeBoundingSphere();
    this.shaft.material.color.copy(k.lightColor);
    this.shaft.material.opacity = k.shaft * open * Math.min(1, k.lightI);
    this.shaft.visible = this.shaft.material.opacity > 0.002;
  }

  // --- props the character uses ----------------------------------------------
  placeCan(can) {
    this.scene.add(can);
    can.position.set(CAN_HOME.x, this.can.restY, CAN_HOME.z);
    can.rotation.set(0, -0.6, 0);
  }

  dockVacuum() {
    const g = this.vacuum.group;
    if (g.parent !== this.scene) this.scene.add(g);
    g.position.set(VACUUM_DOCK.x, 0, VACUUM_DOCK.z + 0.08);
    g.rotation.set(-0.2, 0.2, 0);
  }

  // keep the vacuum's head on the floor in front of him, its handle in his hand
  holdVacuum(avatar, hand) {
    const g = this.vacuum.group;
    const fwd = _a.set(Math.sin(avatar.yaw), 0, Math.cos(avatar.yaw));
    const gy = Math.max(0.35, Math.min(hand.y, this.vacuum.length - 0.05));
    const reach = Math.sqrt(this.vacuum.length ** 2 - gy ** 2);
    g.position.set(hand.x + fwd.x * reach, 0, hand.z + fwd.z * reach);
    const up = _b.copy(hand).sub(g.position).normalize();
    const right = _c.crossVectors(up, fwd).normalize();
    const forward = _d.crossVectors(right, up);
    g.quaternion.setFromRotationMatrix(_m.makeBasis(right, up, forward));
  }

  setBlanket(e) {
    const b = this.bed.blanket;
    b.scale.x = 0.28 + 0.72 * e;
    b.scale.y = 2.2 - 1.2 * e;
    b.position.y = BED.top + 0.03 + 0.2 * e;
  }

  get interior() {
    return this.daylight.k.interior;
  }

  // --- camera --------------------------------------------------------------------
  setupControls() {
    const controls = new OrbitControls(this.camera, this.canvas);
    controls.target.copy(this.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.55;
    controls.minAzimuthAngle = -1.3;
    controls.maxAzimuthAngle = 0.05;
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
    this.fitView(width / height);
    this.size = { width, height };
  }

  // Frame the room from the default angle, whatever the stage shape. On tall,
  // narrow stages it frames the middle of the room; you can drag to see the rest.
  fitView(aspect) {
    const { minX, maxX, minZ, maxZ, wallH, wallT } = ROOM;
    const tight = THREE.MathUtils.clamp((1.25 - aspect) / 0.6, 0, 1);
    const l = (a, b) => a + (b - a) * tight;
    const box = {
      x: [l(minX, -1.8), l(maxX + wallT, 3.0)],
      y: [l(-0.2, 0.1), l(wallH + 0.03, 2.55)],
      z: [minZ - wallT, l(maxZ, 0.6)],
    };
    const current = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.target));
    const probe = new THREE.Camera();
    for (let pass = 0; pass < 2; pass++) {
      probe.position.setFromSpherical(new THREE.Spherical(this.view.distance, this.view.phi, this.view.theta)).add(this.target);
      probe.lookAt(this.target);
      probe.updateMatrixWorld();
      const inv = probe.matrixWorld.clone().invert();
      const pts = [];
      for (const x of box.x) for (const y of box.y) for (const z of box.z) pts.push(new THREE.Vector3(x, y, z).applyMatrix4(inv));
      const sx = pts.map((p) => p.x / -p.z);
      const sy = pts.map((p) => p.y / -p.z);
      const [x0, x1, y0, y1] = [Math.min(...sx), Math.max(...sx), Math.min(...sy), Math.max(...sy)];
      if (pass === 0) {
        // re-centre the orbit target on the room, then size the lens
        const d = this.view.distance;
        const right = new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(probe.matrixWorld, 1);
        this.target.addScaledVector(right, ((x0 + x1) / 2) * d).addScaledVector(up, ((y0 + y1) / 2) * d);
        continue;
      }
      const tan = Math.max(Math.max(Math.abs(y0), Math.abs(y1)), Math.max(Math.abs(x0), Math.abs(x1)) / aspect) * 1.04;
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tan));
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.controls.target.copy(this.target);
    this.setView(current.theta, current.phi);
  }

  // --- time of day ----------------------------------------------------------------
  // Dark mode doesn't jump to night: the sun sets, the evening plays out, and
  // only then is it bedtime. Light mode runs the clock on to sunrise.
  setTheme(theme, animate = true) {
    const lapse = animate && !this.reducedMotion;
    const dl = this.daylight;
    if (theme === 'dark') {
      if (this.phase !== 'day' && this.phase !== 'sunrise') return;
      if (lapse) {
        this.phase = 'sunset';
        dl.lapse(TOD.sunset, 9, { done: () => this.startEvening() });
      } else {
        dl.set(TOD.sunset);
        this.startEvening();
      }
      return;
    }
    if (this.phase === 'day') {
      if (!lapse) dl.set(TOD.day);
      return;
    }
    if (this.phase === 'sunrise') return;
    this.life.morning();
    const toDay = () => {
      this.phase = 'day';
      this.dayStart = this.time;
      this.nightMinutes = 0;
    };
    if (lapse) {
      this.phase = 'sunrise';
      dl.lapse(5, Math.max(8, (5 - dl.tod) * 4.5), { done: toDay });
    } else {
      dl.set(TOD.day);
      toDay();
    }
  }

  startEvening() {
    this.phase = 'evening';
    this.life.evening();
    this.daylight.lapse(TOD.dusk, EVENING_SECONDS, { linear: true, done: () => this.nightfall() });
  }

  nightfall() {
    this.phase = 'nightfall';
    this.life.bedtime();
    this.daylight.lapse(TOD.night, this.reducedMotion ? 0 : 7, {
      done: () => {
        this.phase = 'night';
      },
    });
  }

  // a readable clock for the HUD, following the time-lapse
  get clock() {
    const t = this.daylight.tod;
    const stops = [14 * 60, 18 * 60 + 45, 21 * 60 + 30, 23 * 60 + 20, 30 * 60, 38 * 60];
    let minutes;
    if (this.phase === 'day') minutes = Math.min(17 * 60, 14 * 60 + (this.time - this.dayStart) / 60);
    else {
      const i = Math.min(4, Math.floor(t));
      minutes = stops[i] + (stops[i + 1] - stops[i]) * (t - i);
      if (this.phase === 'night') minutes = 23 * 60 + 20 + Math.min(this.nightMinutes, 6 * 60);
    }
    minutes = Math.floor(minutes) % (24 * 60);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  }

  get doing() {
    return this.life.label;
  }

  // --- interaction --------------------------------------------------------------
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
          m.emissive.copy(on ? HOVER_EMISSIVE : _black);
        }
      });
    }
  }

  activate(key) {
    this.lastInteraction = this.time;
    if (this.life.request(key)) return;
    switch (key) {
      case 'monitor':
        this.screen.next();
        this.bounce('monitor', 0.04);
        break;
      case 'lamp':
        this.lampOverride = !(this.lampOverride ?? this.lampAuto);
        break;
      case 'candle':
        this.candleOverride = !(this.candleOverride ?? this.candleAuto);
        break;
      case 'lights':
        this.twinkle = 2.6;
        break;
      case 'console':
        this.effects.push({ t: 0, dur: 0.9, apply: (p) => this._pandaHop(p) });
        break;
      case 'posters':
        this.wiggle(key);
        break;
      case 'window':
        this.curtainsClosed = !this.curtainsClosed;
        break;
      case 'me':
      case 'bed':
        break;
      default:
        this.bounce(key, 0.06);
    }
  }

  wave() {
    this.activate('me');
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
    this.effects.push({
      t: 0,
      dur: 1.2,
      apply: (p) => {
        items.forEach((c) => {
          c.rotation.z = c.userData.baseRot.z + Math.sin(p * Math.PI * 4 + c.userData.phase) * (1 - p) * 0.12;
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

  // --- frame ------------------------------------------------------------------
  update() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;
    if (this.phase === 'night') this.nightMinutes += dt * 0.25; // ~15x real time

    // time of day → lights and sky
    this.daylight.update(dt);
    const k = this.daylight.k;
    const dir = this.daylight.lightDirection(_a);
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 14);
    this.sun.color.copy(k.lightColor);
    this.curtainK += ((this.curtainsClosed ? 1 : 0) - this.curtainK) * (1 - Math.exp(-dt * 4));
    this.sun.intensity = k.lightI;
    this.hemi.color.copy(k.hemiSky);
    this.hemi.groundColor.copy(k.hemiGround);
    this.hemi.intensity = k.hemiI;
    this.scene.environmentIntensity = k.env;
    this.fill.color.copy(k.fillColor);
    this.fill.intensity = k.fillI;
    this.renderer.toneMappingExposure = k.exposure;
    this.updateShaft(dir, k);
    this.skyClock = (this.skyClock || 0) - dt;
    if (this.skyClock <= 0) {
      this.sky.draw(k, this.daylight.lapsing ? 1 / 12 : 1 / 5, this.daylight.speed);
      this.skyClock = this.daylight.lapsing ? 1 / 12 : 1 / 5;
    }
    this.curtains.forEach((c) => {
      c.scale.x = c.userData.open + (c.userData.closed - c.userData.open) * this.curtainK;
    });

    // the character, then everything that reacts to what he's doing
    this.life.update(dt);
    const asleep = this.life.asleep;
    // lights come on as soon as dark mode starts, and grow brighter as the sky darkens
    const dark = this.phase !== 'day' && this.phase !== 'sunrise';
    const night = Math.max(k.interior, dark ? 0.6 : 0);

    // lamp and candle come on with dark mode and go off when he sleeps; a
    // click overrides that until the next change
    const lampAuto = dark && !asleep;
    if (lampAuto !== this.lampAuto) this.lampOverride = null;
    this.lampAuto = lampAuto;
    const lampOn = this.lampOverride ?? lampAuto;
    this.lampLevel += ((lampOn ? 1 : 0) - this.lampLevel) * (1 - Math.exp(-dt * 6));
    this.lamp.light.intensity = 1.8 * this.lampLevel;
    this.lamp.shadeMat.emissiveIntensity = this.lampLevel * 0.9;
    this.lamp.glow.material.opacity = this.lampLevel * 0.7 * night;

    const candleAuto = dark && !asleep;
    if (candleAuto !== this.candleAuto) this.candleOverride = null;
    this.candleAuto = candleAuto;
    const candleLit = this.candleOverride ?? candleAuto;
    const flicker = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    this.candle.flame.visible = candleLit;
    this.candle.flame.scale.set(1, flicker, 1);
    this.candle.light.intensity = candleLit ? 0.4 * flicker : 0;
    this.candle.glow.material.opacity = candleLit ? (0.2 + 0.55 * night) * flicker : 0;

    // fairy lights: faint by day, glowing at night, a night-light while he sleeps
    this.twinkle = Math.max(0, this.twinkle - dt);
    const fairy = (0.3 + 0.7 * night) * (asleep ? 0.65 : 1);
    for (const b of this.bulbs) {
      let f = this.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * 2.2 + b.phase);
      if (this.twinkle > 0) f = 0.35 + Math.max(0, Math.sin(b.t * 10 - t * 9)) * 1.2;
      b.bulb.material.color.copy(WARM_BULB).multiplyScalar((0.8 + 0.9 * night) * f * (asleep ? 0.75 : 1));
      b.glow.material.opacity = (0.15 + 0.7 * night) * f * (asleep ? 0.7 : 1);
    }
    this.fairyLightsPoints.forEach((l, i) => {
      l.intensity = 0.55 * fairy * night * (0.9 + 0.1 * Math.sin(t * 1.7 + i));
    });

    // monitor: live while he's up, dark while he sleeps
    const typing = this.avatar.activity === 'type';
    this.screen.update(dt, typing);
    const screenOn = asleep ? 0.06 : 0.95 + 0.25 * night;
    this.screenMat.color.setScalar(screenOn);
    this.monitorLight.intensity = asleep ? 0 : 0.9 * night;

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
      const goal = this.view.theta + Math.sin(t * 0.22) * 0.06;
      const theta = sph.theta + (goal - sph.theta) * (1 - Math.exp(-dt * 0.6));
      const phi = sph.phi + (this.view.phi - sph.phi) * (1 - Math.exp(-dt * 0.6));
      this.setView(theta, phi);
    } else {
      this.controls.update();
    }

    this.composer.render(dt);
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _black = new THREE.Color(0);
