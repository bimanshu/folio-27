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

// Thigh and knee angles for a leg shape that stays put in the room while the
// body pitches back: `lift` raises the knee, `drop` swings the shin down
// (0, 0 is a straight leg along the body; 0, π/2 is sitting on a chair).
export const legJoints = (lift, drop, pitch) => ({ thigh: -lift - pitch, knee: drop - H + lift });

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
    this.lieLegs = [0, 0];
    this.lieLean = 0;
    this.activity = 'type';
    this.walkBlend = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.time = 0;
    this.blink = 0;
    this.nextBlink = 2;
    this.bubble = null;
    this.bubbleTime = 0;
    this.items = {}; // name -> { object, mode }
    this.lock = {}; // joints driven directly (staged moves like getting into bed)
    this.pouring = false;
    this.pourReach = false;
    this.pour = 0;
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
  // Items live in the scene and are placed from the hands every frame, so the
  // hands are always on them. mode: 'book' (both hands), 'phone' (right
  // hand, screen to the eyes), 'can' (hangs from the right hand, tips to pour)
  hold(name, object, mode) {
    this.drop(name);
    this.group.parent.add(object);
    this.items[name] = { object, mode };
    this._placeItems();
  }

  drop(name) {
    const item = this.items[name];
    if (item) item.object.parent?.remove(item.object);
    delete this.items[name];
    return item?.object;
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
    // [shoulder x, shoulder z (outwards), elbow x, elbow z (inwards)]
    const right = ([a, b, c, d = 0]) => Object.assign(T, { rShX: a, rShZ: b, rElX: c, rElZ: d });
    const left = ([a, b, c, d = 0]) => Object.assign(T, { lShX: a, lShZ: b, lElX: c, lElZ: d });
    const lying = this.base === 'lie';
    if (this.base === 'sit') {
      Object.assign(T, { rootY: this.seatY, rThigh: 0, rKnee: 0, lThigh: 0, lKnee: 0, spread: 0.06 });
      right([-0.32, 0.08, -0.95]);
      left([-0.32, 0.08, -0.95]);
    } else if (lying) {
      const [lift, drop] = this.lieLegs;
      const thigh = H - lift;
      const knee = drop - H + lift;
      Object.assign(T, { rootY: this.lieY, pitch: -H, lean: this.lieLean, rThigh: thigh, lThigh: thigh, rKnee: knee, lKnee: knee });
      right([0.12, 0.14, -0.1]);
      left([0.12, 0.14, -0.1]);
    }
    switch (this.activity) {
      case 'type':
        right([-0.78, 0.06, -0.95]);
        left([-0.78, 0.06, -0.95]);
        Object.assign(T, { lean: 0.1, headX: 0.12 });
        break;
      case 'read': {
        // elbows down by the ribs (or on the cushion), the book at the chest
        const pose = lying ? [-0.6, 0.14, -1.75, -0.4] : [-0.64, 0.26, -1.55, -0.7];
        right(pose);
        left(pose);
        T.headX = lying ? 0.32 : 0.42;
        break;
      }
      case 'phone':
        // elbow on the mattress, phone held up over the chest
        right(lying ? [-0.48, 0.14, -1.95, -0.6] : [-0.68, 0.14, -1.65, -0.8]);
        T.headX = lying ? 0.34 : 0.42;
        break;
      case 'carry':
        right([0.06, 0.14, -0.05]);
        break;
      case 'pour':
        // floor pots: can held low in front; desk pots: arm out over the desk
        if (this.pourReach) {
          right([-1.52, 0.18, -0.05, -0.5]);
          Object.assign(T, { lean: 0.38, headX: 0.3 });
        } else {
          right([-1.04, 0.1, -0.2, -0.4]);
          Object.assign(T, { lean: 0.2, headX: 0.42 });
        }
        left([0.04, 0.1, -0.2]);
        break;
      case 'wipe':
        right([-0.95, 0.12, -0.5]);
        left([-0.72, 0.05, -0.62]);
        Object.assign(T, { lean: 0.42, headX: 0.4 });
        break;
      case 'vacuum':
        right([-0.62, -0.06, -0.38]);
        left([0.02, 0.1, -0.15]);
        Object.assign(T, { lean: 0.1, headX: 0.38 });
        break;
      case 'wave':
        right([-0.15, 2.55, -0.2]);
        Object.assign(T, { headZ: 0.12, mouth: 1 });
        break;
      case 'stretch':
        right([-0.15, 2.7, -0.2]);
        left([-0.15, 2.7, -0.2]);
        Object.assign(T, { headX: -0.35, mouth: 1, eyes: 0.2 });
        break;
      case 'groggy':
        if (lying && this.items.phone) right([0.04, 0.14, -2.15, -0.6]); // phone sinks onto the chest
        Object.assign(T, { headX: lying ? 0.2 : 0.42, eyes: 0.3 });
        break;
      case 'sleep':
        Object.assign(T, { eyes: 0, headY: 0.4, headZ: 0.1 });
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
      J[k] = k in this.lock ? this.lock[k] : damp(J[k], T[k], rate, dt);
    }

    // turning
    this.yaw += wrapAngle(this.yawTarget - this.yaw) * (1 - Math.exp(-dt * 10));
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
      thigh.rotation.x = th - w * swing * 0.55;
      thigh.rotation.y = side * J.spread;
      knee.rotation.x = kn + w * Math.max(0, phase * c) * 0.8;
    });

    const busyR = ['type', 'read', 'phone', 'pour', 'wipe', 'vacuum', 'wave', 'stretch', 'carry'].includes(this.activity);
    const busyL = ['type', 'read', 'phone', 'wipe', 'stretch'].includes(this.activity);
    const [r, l] = this.arms;
    r.shoulder.rotation.x = J.rShX + (busyR ? 0 : w * s * 0.4);
    r.shoulder.rotation.z = J.rShZ * r.side;
    r.elbow.rotation.x = J.rElX;
    r.elbow.rotation.z = J.rElZ * r.side;
    l.shoulder.rotation.x = J.lShX - (busyL ? 0 : w * s * 0.4);
    l.shoulder.rotation.z = J.lShZ * l.side;
    l.elbow.rotation.x = J.lElX;
    l.elbow.rotation.z = J.lElZ * l.side;

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
        r.elbow.rotation.x += Math.max(0, Math.sin(t * 2.1)) * 0.05; // thumb flick
        break;
      case 'read':
        if (t % 7 < 0.5) l.elbow.rotation.x += Math.sin((t % 7) * Math.PI * 2) * 0.12; // page turn
        break;
      case 'wave':
        r.elbow.rotation.z += Math.sin(t * 11) * 0.45;
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

    this.pour = damp(this.pour, this.pouring ? 1 : 0, 5, dt);
    this._placeItems();

    if (this.bubbleTime > 0) {
      this.bubbleTime -= dt;
      if (this.bubbleTime <= 0) this.bubble = null;
    }
  }

  _placeItems() {
    const names = Object.keys(this.items);
    if (!names.length) return;
    this.group.updateMatrixWorld(true);
    const [r, l] = this.arms;
    const handR = r.hand.getWorldPosition(_hr);
    const handL = l.hand.getWorldPosition(_hl);
    const eyes = this.head.localToWorld(_eye.set(0, 0.15, 0.16));
    const headUp = _up.set(0, 1, 0).applyQuaternion(this.head.getWorldQuaternion(_q));
    for (const name of names) {
      const { object, mode } = this.items[name];
      if (mode === 'book') {
        // pages turned to the eyes; each hand grips an outer edge near the
        // bottom, so the forearms come up from underneath instead of through it
        const across = _x.subVectors(handR, handL).normalize();
        const mid = _p.addVectors(handR, handL).multiplyScalar(0.5);
        const toEyes = _z.subVectors(eyes, mid);
        toEyes.addScaledVector(across, -toEyes.dot(across)).normalize();
        const up = _y.crossVectors(toEyes, across);
        if (up.dot(headUp) < 0) {
          up.negate();
          across.negate();
        }
        object.position.copy(mid).addScaledVector(up, 0.06).addScaledVector(toEyes, 0.03);
        object.quaternion.setFromRotationMatrix(_m.makeBasis(across, up, toEyes));
      } else if (mode === 'phone') {
        // gripped low in the right hand, screen to the eyes, top towards the top of the head
        const toEyes = _z.subVectors(eyes, handR).normalize();
        const up = _y.copy(headUp).addScaledVector(toEyes, -headUp.dot(toEyes)).normalize();
        const across = _x.crossVectors(up, toEyes);
        object.position.copy(handR).addScaledVector(toEyes, 0.03).addScaledVector(up, 0.045);
        object.quaternion.setFromRotationMatrix(_m.makeBasis(across, up, toEyes));
      } else if (mode === 'can') {
        // hangs from the grip; tips forward to pour
        object.position.copy(handR);
        object.quaternion.setFromEuler(_e.set(this.pour * 1.05, this.yaw, 0, 'YXZ'));
      }
      object.updateMatrixWorld(true);
    }
  }

  // called by whoever moves the avatar, so the legs keep pace with the floor
  stride(distance) {
    this.walkPhase += distance * 4.8; // ~2 steps a second at walking pace
  }
}

const _hr = new THREE.Vector3();
const _hl = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _up = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
