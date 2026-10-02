import * as THREE from 'three';
import { box, hotspot, mat } from './helpers.js';
import { denimTexture, shoeSideTexture, teeTexture } from './textures.js';

// Tweak these to make the avatar look more like you.
export const AVATAR = {
  skin: '#c98d66',
  skinShade: '#b57a55',
  hair: '#1d1613',
  tee: '#f4f2ed', // FOG Essentials tee, white
  denim: '#4d72a6', // baggy mid-wash denim
  denimDark: '#3d5f8f',
  shoe: '#f8f6f1', // Nike Blazer Mid '77 — white leather, black swoosh, sail sole
  sole: '#ece0c4',
};

const H = Math.PI / 2;
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Joint values that make up a pose. Arms: "r" is the working hand.
const JOINTS = [
  'rootY', 'pitch', 'lean', 'twist', 'headX', 'headY', 'headZ',
  'rThigh', 'rKnee', 'lThigh', 'lKnee', 'spread',
  'rShX', 'rShZ', 'rElX', 'rElZ', 'lShX', 'lShZ', 'lElX', 'lElZ',
  'eyes', 'mouth',
];

export const STAND_HEIGHT = 0.875; // hip height when standing on the floor

export class Avatar {
  constructor() {
    this.group = new THREE.Group(); // floor position + facing
    this.root = new THREE.Group(); // posture: hip height, lying back
    this.group.add(this.root);
    this.yaw = 0;
    this.yawTarget = 0;
    this.base = 'sit'; // stand | sit | lie
    this.seatY = 0.486;
    this.lieY = 0.65;
    this.activity = 'type';
    this.walkBlend = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.time = 0;
    this.blink = 0;
    this.nextBlink = 2;
    this.bubble = null;
    this.bubbleTime = 0;
    this.items = {};
    this.J = Object.fromEntries(JOINTS.map((k) => [k, 0]));
    this.build();
    Object.assign(this.J, this._targets());
    hotspot(this.group, 'me');
  }

  build() {
    const A = AVATAR;
    const skin = A.skin;
    const denimMap = denimTexture();
    const denim = () => mat('#ffffff', { map: denimMap });

    const hips = new THREE.Group();
    hips.position.set(0, 0, -0.03);
    this.root.add(hips);
    hips.add(box(0.34, 0.13, 0.25, denim(), 0, 0.065, 0));
    hips.add(box(0.345, 0.025, 0.255, '#2e2a26', 0, 0.12, 0)); // belt line

    // legs — wide, baggy denim stacking over the shoes
    const shoeMats = [
      mat('#ffffff', { map: shoeSideTexture(false) }),
      mat('#ffffff', { map: shoeSideTexture(true) }),
      mat(A.shoe),
      mat(A.sole),
      mat(A.shoe),
      mat(A.shoe),
    ];
    this.legs = [-1, 1].map((s) => {
      const thigh = new THREE.Group();
      thigh.position.set(s * 0.09, 0.07, 0.04);
      thigh.add(box(0.17, 0.15, 0.46, denim(), 0, 0, 0.2));
      const knee = new THREE.Group();
      knee.position.set(0, 0, 0.41);
      knee.add(box(0.175, 0.42, 0.175, denim(), 0, -0.2, 0));
      knee.add(box(0.19, 0.07, 0.19, mat(A.denimDark), 0, -0.39, 0));
      const foot = new THREE.Group();
      foot.position.set(0, -0.455, 0);
      foot.add(box(0.12, 0.1, 0.25, shoeMats, 0, -0.005, 0.05));
      foot.add(box(0.13, 0.028, 0.268, A.sole, 0, -0.066, 0.052));
      foot.add(box(0.06, 0.006, 0.12, '#e9e5dd', 0, 0.047, 0.08)); // laces
      knee.add(foot);
      thigh.add(knee);
      hips.add(thigh);
      return { thigh, knee, foot, side: s };
    });

    // torso
    const torso = new THREE.Group();
    torso.position.set(0, 0.13, -0.01);
    hips.add(torso);
    this.torso = torso;
    const teeSide = mat(A.tee);
    torso.add(
      box(0.4, 0.38, 0.22, [teeSide, teeSide, teeSide, teeSide, mat('#ffffff', { map: teeTexture('front') }), mat('#ffffff', { map: teeTexture('back') })], 0, 0.19, 0),
    );
    torso.add(box(0.13, 0.02, 0.06, '#e3dfd7', 0, 0.38, 0.06)); // collar rib
    torso.add(box(0.1, 0.06, 0.1, skin, 0, 0.4, 0));

    // head
    const head = new THREE.Group();
    head.position.set(0, 0.42, 0);
    torso.add(head);
    this.head = head;
    head.scale.setScalar(1.12);
    head.add(box(0.3, 0.29, 0.28, skin, 0, 0.155, 0.01));
    const fz = 0.152;
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = box(0.042, 0.055, 0.012, '#1b1512', s * 0.068, 0.15, fz);
      const shine = box(0.014, 0.014, 0.006, '#ffffff', s * 0.068 - 0.01, 0.165, fz + 0.006);
      head.add(eye, shine);
      this.eyes.push({ eye, shine });
      head.add(box(0.07, 0.018, 0.012, A.hair, s * 0.07, 0.205, fz));
      head.add(box(0.04, 0.018, 0.008, '#e08a7e', s * 0.105, 0.098, fz - 0.001));
      head.add(box(0.03, 0.07, 0.06, skin, s * 0.158, 0.14, 0));
    }
    head.add(box(0.03, 0.035, 0.02, A.skinShade, 0, 0.115, fz + 0.006));
    this.mouth = box(0.06, 0.014, 0.01, '#7a3a34', 0, 0.068, fz);
    head.add(this.mouth);
    // hair: cap, back, sides and a choppy fringe
    head.add(box(0.32, 0.08, 0.31, A.hair, 0, 0.32, 0.005));
    head.add(box(0.32, 0.22, 0.05, A.hair, 0, 0.2, -0.135));
    head.add(box(0.03, 0.13, 0.22, A.hair, -0.16, 0.25, -0.02));
    head.add(box(0.03, 0.13, 0.22, A.hair, 0.16, 0.25, -0.02));
    [
      [-0.115, 0.07],
      [-0.04, 0.1],
      [0.04, 0.085],
      [0.115, 0.06],
    ].forEach(([x, h]) => head.add(box(0.085, h, 0.03, A.hair, x, 0.31 - h / 2, 0.152)));
    const tuft = box(0.2, 0.045, 0.18, A.hair, 0.02, 0.37, 0.03);
    tuft.rotation.z = 0.08;
    head.add(tuft);

    // arms — dropped, boxy sleeves of an oversized tee
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.215, 0.34, 0);
      shoulder.add(box(0.135, 0.19, 0.15, A.tee, 0, -0.07, 0));
      shoulder.add(box(0.14, 0.02, 0.155, '#e6e2da', 0, -0.165, 0));
      shoulder.add(box(0.075, 0.07, 0.075, skin, 0, -0.19, 0));
      const elbow = new THREE.Group();
      elbow.position.set(0, -0.215, 0);
      elbow.add(box(0.072, 0.2, 0.072, skin, 0, -0.1, 0));
      elbow.add(box(0.08, 0.075, 0.085, skin, 0, -0.235, 0.005));
      const hand = new THREE.Object3D();
      hand.position.set(0, -0.255, 0.01);
      elbow.add(hand);
      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow, hand, side: s };
    });
    this.hand = this.arms[0].hand;
  }

  // --- things in hand -------------------------------------------------------
  // `where`: 'hand' (hangs from the working hand) or 'torso' (held in front)
  hold(name, object, where, position = [0, 0, 0], rotation = [0, 0, 0]) {
    this.drop(name);
    const parent = where === 'hand' ? this.hand : this.torso;
    object.position.set(...position);
    object.rotation.set(...rotation);
    parent.add(object);
    this.items[name] = object;
  }

  drop(name) {
    const o = this.items[name];
    if (o) o.parent?.remove(o);
    delete this.items[name];
    return o;
  }

  say(text, seconds = 2.5) {
    this.bubble = text;
    this.bubbleTime = seconds;
  }

  headWorldPosition(target) {
    return this.head.localToWorld(target.set(0, 0.45, 0));
  }

  handWorldPosition(target) {
    return this.hand.getWorldPosition(target);
  }

  get position() {
    return this.group.position;
  }

  // --- posture ----------------------------------------------------------------
  _targets() {
    const T = {
      rootY: STAND_HEIGHT, pitch: 0, lean: 0, twist: 0, headX: 0, headY: 0, headZ: 0,
      rThigh: H, rKnee: -H, lThigh: H, lKnee: -H, spread: 0,
      rShX: 0.04, rShZ: 0.08, rElX: -0.14, rElZ: 0, lShX: 0.04, lShZ: 0.08, lElX: -0.14, lElZ: 0,
      eyes: 1, mouth: 0,
    };
    const arms = (r, l = r) => {
      [T.rShX, T.rShZ, T.rElX] = r;
      [T.lShX, T.lShZ, T.lElX] = l;
    };
    if (this.base === 'sit') {
      Object.assign(T, { rootY: this.seatY, rThigh: 0, rKnee: 0, lThigh: 0, lKnee: 0, spread: 0.06 });
      arms([-0.32, 0.08, -0.95]);
    } else if (this.base === 'lie') {
      Object.assign(T, { rootY: this.lieY, pitch: -H });
      arms([0.12, 0.14, -0.1]);
    }
    const lying = this.base === 'lie';
    switch (this.activity) {
      case 'type':
        arms([-0.78, 0.06, -0.95]);
        Object.assign(T, { lean: 0.1, headX: 0.12 });
        break;
      case 'read':
        arms([lying ? -1.25 : -0.92, -0.2, lying ? -0.75 : -1.1]);
        T.headX = lying ? 0.1 : 0.34;
        break;
      case 'phone':
        arms([lying ? -1.15 : -0.85, -0.28, lying ? -0.95 : -1.45], [lying ? 0.1 : -0.32, 0.12, lying ? -0.2 : -0.95]);
        T.headX = lying ? 0.12 : 0.36;
        break;
      case 'carry':
        T.rShX = 0.06;
        T.rShZ = 0.14;
        T.rElX = -0.05;
        break;
      case 'pour':
        arms([-0.95, 0.12, -0.18], [0.04, 0.1, -0.2]);
        Object.assign(T, { lean: 0.14, headX: 0.38 });
        break;
      case 'wipe':
        arms([-0.95, 0.12, -0.5], [-0.72, 0.05, -0.62]);
        Object.assign(T, { lean: 0.42, headX: 0.4 });
        break;
      case 'vacuum':
        arms([-0.62, -0.06, -0.38], [0.02, 0.1, -0.15]);
        Object.assign(T, { lean: 0.1, headX: 0.38 });
        break;
      case 'wave':
        T.rShX = -0.15;
        T.rShZ = 2.55;
        T.rElX = -0.2;
        Object.assign(T, { headZ: 0.12, mouth: 1 });
        break;
      case 'stretch':
        arms([-0.15, 2.7, -0.2]);
        Object.assign(T, { headX: -0.35, mouth: 1, eyes: 0.2 });
        break;
      case 'groggy':
        Object.assign(T, { headX: 0.42, eyes: 0.3 });
        break;
      case 'sleep':
        Object.assign(T, { eyes: 0, headY: 0.4, headZ: 0.1 });
        break;
      case 'look':
        T.headY = Math.sin(this.time * 0.8) * 0.6;
        break;
      default:
    }
    return T;
  }

  // --- frame ------------------------------------------------------------------
  update(dt) {
    this.time += dt;
    const t = this.time;
    const J = this.J;
    const T = this._targets();
    for (const k of JOINTS) {
      const rate = k === 'pitch' || k === 'rootY' ? 5 : k === 'eyes' ? 6 : 8;
      J[k] = damp(J[k], T[k], rate, dt);
    }

    // turning
    this.yaw += wrapAngle(this.yawTarget - this.yaw) * (1 - Math.exp(-dt * 9));
    this.group.rotation.y = this.yaw;

    // walk cycle, driven by how far the director moved us this frame
    this.walkBlend = damp(this.walkBlend, this.moving ? 1 : 0, 10, dt);
    const w = this.walkBlend;
    const s = Math.sin(this.walkPhase);
    const c = Math.cos(this.walkPhase);

    this.root.position.y = J.rootY + w * (Math.abs(c) * 0.022 - 0.011);
    this.root.rotation.x = J.pitch;

    const breath = Math.sin(t * (this.activity === 'sleep' ? 1.3 : 2.1)) * (this.activity === 'sleep' ? 0.025 : 0.012);
    this.torso.rotation.x = J.lean + breath * 0.5;
    this.torso.rotation.y = J.twist + w * s * 0.07;
    this.torso.scale.y = 1 + breath;

    this.head.rotation.x = J.headX + Math.sin(t * 1.3) * 0.02;
    this.head.rotation.y = J.headY + Math.sin(t * 0.7) * 0.04;
    this.head.rotation.z = J.headZ;

    const legs = [
      [J.rThigh, J.rKnee, 1],
      [J.lThigh, J.lKnee, -1],
    ];
    this.legs.forEach(({ thigh, knee, side }, i) => {
      const [th, kn, phase] = legs[i];
      const swing = s * phase;
      thigh.rotation.x = th - w * swing * 0.5;
      thigh.rotation.y = side * J.spread;
      knee.rotation.x = kn + w * Math.max(0, phase * c) * 0.75;
    });

    const busyR = ['type', 'read', 'phone', 'pour', 'wipe', 'vacuum', 'wave', 'stretch', 'carry'].includes(this.activity);
    const busyL = ['type', 'read', 'phone', 'wipe', 'stretch'].includes(this.activity);
    const [r, l] = this.arms;
    r.shoulder.rotation.x = J.rShX + (busyR ? 0 : w * s * 0.4);
    r.shoulder.rotation.z = J.rShZ * r.side;
    r.elbow.rotation.x = J.rElX;
    r.elbow.rotation.z = J.rElZ;
    l.shoulder.rotation.x = J.lShX - (busyL ? 0 : w * s * 0.4);
    l.shoulder.rotation.z = J.lShZ * l.side;
    l.elbow.rotation.x = J.lElX;
    l.elbow.rotation.z = J.lElZ;

    // per-activity motion on top of the pose
    switch (this.activity) {
      case 'type':
        r.elbow.rotation.x += Math.sin(t * 19) * 0.07;
        l.elbow.rotation.x += Math.sin(t * 19 + 1.9) * 0.07;
        break;
      case 'wipe':
        r.shoulder.rotation.x += Math.sin(t * 6) * 0.16;
        r.shoulder.rotation.z += Math.cos(t * 6) * 0.14 * r.side;
        break;
      case 'vacuum':
        r.shoulder.rotation.x += Math.sin(t * 3.2) * 0.32;
        r.elbow.rotation.x += Math.sin(t * 3.2) * 0.14;
        break;
      case 'phone':
        r.elbow.rotation.z = Math.max(0, Math.sin(t * 2.1)) * 0.06;
        break;
      case 'read':
        if (t % 7 < 0.5) l.elbow.rotation.z = Math.sin((t % 7) * Math.PI * 2) * 0.25; // page turn
        break;
      case 'wave':
        r.elbow.rotation.z = Math.sin(t * 11) * 0.45;
        break;
      default:
    }

    // blinking (and closed eyes when sleepy)
    this.nextBlink -= dt;
    if (this.nextBlink < 0) {
      this.blink = 0.14;
      this.nextBlink = 2.5 + Math.random() * 3;
    }
    this.blink = Math.max(0, this.blink - dt);
    const open = Math.max(0.08, J.eyes * (this.blink > 0 ? 0.1 : 1));
    for (const { eye, shine } of this.eyes) {
      eye.scale.y = open;
      shine.visible = open > 0.5;
    }
    this.mouth.scale.set(1 + J.mouth * 0.4, 1 + J.mouth * 1.8, 1);

    if (this.bubbleTime > 0) {
      this.bubbleTime -= dt;
      if (this.bubbleTime <= 0) this.bubble = null;
    }
  }

  // called by whoever moves the avatar, so the legs keep pace with the floor
  stride(distance) {
    this.walkPhase += distance * 8.2;
  }
}
