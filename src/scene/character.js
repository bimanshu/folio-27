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

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const damp = (current, target, rate, dt) => current + (target - current) * (1 - Math.exp(-rate * dt));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const POSES = {
  typing: { shoulderX: -0.78, shoulderZ: 0.06, elbowX: -0.95, elbowZ: 0, lean: 0.1, headX: 0.12, headY: 0 },
  rest: { shoulderX: -0.32, shoulderZ: 0.08, elbowX: -0.95, elbowZ: 0, lean: 0, headX: 0, headY: 0 },
};

export class Avatar {
  constructor(chair) {
    this.chair = chair;
    this.root = new THREE.Group();
    this.root.position.set(0, chair.seatTop, -0.02);
    chair.swivel.add(this.root);

    this.homeZ = chair.group.position.z;
    this.homeYaw = chair.swivel.rotation.y;
    this.seq = null;
    this.time = 0;
    this.glanceTimer = 4;
    this.glance = 0;
    this.bubble = null; // text shown above the head while set
    this.joints = { ...POSES.typing, waveZ: 0, wave: 0 };
    this.build();
    hotspot(this.root, 'me');
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
    const shoeTop = mat(A.shoe);
    const shoeMats = [
      mat('#ffffff', { map: shoeSideTexture(false) }),
      mat('#ffffff', { map: shoeSideTexture(true) }),
      shoeTop,
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
      return { thigh, knee };
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
    for (const s of [-1, 1]) {
      head.add(box(0.042, 0.055, 0.012, '#1b1512', s * 0.068, 0.15, fz));
      head.add(box(0.014, 0.014, 0.006, '#ffffff', s * 0.068 - 0.01, 0.165, fz + 0.006));
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
      shoulder.add(elbow);
      torso.add(shoulder);
      return { shoulder, elbow, side: s };
    });
  }

  // Swivel round to face the camera and wave.
  wave(cameraPosition) {
    if (this.seq) return;
    this.seq = { kind: 'wave', t: 0, face: this._faceAngle(cameraPosition) };
  }

  // A full spin on the chair.
  spin() {
    if (this.seq) return;
    this.seq = { kind: 'spin', t: 0 };
  }

  get busy() {
    return !!this.seq;
  }

  _faceAngle(cam) {
    const p = new THREE.Vector3();
    this.chair.group.getWorldPosition(p);
    return Math.atan2(cam.x - p.x, cam.z - p.z);
  }

  headWorldPosition(target) {
    return this.head.localToWorld(target.set(0, 0.42, 0));
  }

  update(dt, cameraPosition) {
    this.time += dt;
    const t = this.time;
    const J = this.joints;
    let pose = POSES.typing;
    let yaw = this.homeYaw;
    let rollBack = 0;
    let waving = 0;
    this.bubble = null;

    if (this.seq) {
      const s = this.seq;
      s.t += dt;
      if (s.kind === 'wave') {
        // stop a little short of facing the camera: a 3/4 view reads better
        // for a seated pose, and the head turns the rest of the way
        const full = wrapAngle(s.face - this.homeYaw);
        const delta = full - Math.sign(full) * 0.55;
        const out = ease(clamp01((s.t - 0.35) / 0.8));
        const back = ease(clamp01((s.t - 3.7) / 0.8));
        yaw = this.homeYaw + delta * (out - back);
        rollBack = ease(clamp01(s.t / 0.4)) - ease(clamp01((s.t - 4.45) / 0.4));
        pose = s.t < 4.5 ? POSES.rest : POSES.typing;
        waving = s.t > 1.05 && s.t < 3.7 ? 1 : 0;
        if (s.t > 1.15 && s.t < 3.75) this.bubble = 'hey, there! 👋';
        if (s.t > 4.9) this.seq = null;
      } else {
        const turn = ease(clamp01((s.t - 0.35) / 1.5));
        yaw = this.homeYaw + turn * Math.PI * 2;
        rollBack = ease(clamp01(s.t / 0.35)) - ease(clamp01((s.t - 1.9) / 0.4));
        pose = s.t < 2 ? POSES.rest : POSES.typing;
        if (s.t > 0.45 && s.t < 2.1) this.bubble = 'wheee!';
        if (s.t > 2.4) this.seq = null;
        if (!this.seq) yaw = this.homeYaw;
      }
    }

    this.chair.swivel.rotation.y = yaw;
    this.chair.group.position.z = this.homeZ + rollBack * 0.24;

    // the occasional glance at whoever is looking at the screen
    const typing = !this.seq;
    this.glanceTimer -= dt;
    if (typing && this.glanceTimer < 0) {
      this.glance = this.glance ? 0 : 1;
      this.glanceTimer = this.glance ? 1.4 : 6 + Math.random() * 5;
    }
    if (!typing) this.glance = this.seq?.kind === 'wave' ? 1 : 0;
    let glanceYaw = 0;
    if (this.glance && cameraPosition) {
      glanceYaw = THREE.MathUtils.clamp(wrapAngle(this._faceAngle(cameraPosition) - yaw), -0.95, 0.95);
    }

    const rate = 9;
    for (const k of ['shoulderX', 'shoulderZ', 'elbowX', 'elbowZ', 'lean', 'headX']) {
      J[k] = damp(J[k], pose[k], rate, dt);
    }
    J.headY = damp(J.headY, glanceYaw, 6, dt);
    J.wave = damp(J.wave, waving, 8, dt);

    this.torso.rotation.x = J.lean + Math.sin(t * 2.1) * 0.012;
    this.torso.scale.y = 1 + Math.sin(t * 2.1) * 0.012;
    this.head.rotation.x = J.headX * (1 - this.glance * 0.8) + Math.sin(t * 1.3) * 0.02;
    this.head.rotation.y = J.headY + Math.sin(t * 0.7) * 0.04;
    this.head.rotation.z = J.wave * 0.12;

    for (const arm of this.arms) {
      const { shoulder, elbow, side } = arm;
      const typingJitter = typing ? Math.sin(t * 19 + side * 1.9) * 0.07 : 0;
      shoulder.rotation.x = J.shoulderX;
      shoulder.rotation.z = J.shoulderZ * side;
      elbow.rotation.x = J.elbowX + typingJitter;
      elbow.rotation.z = 0;
      if (side === -1 && J.wave > 0.001) {
        // right arm (character's right is -x): raise and wave from the elbow
        shoulder.rotation.x = THREE.MathUtils.lerp(J.shoulderX, -0.15, J.wave);
        shoulder.rotation.z = THREE.MathUtils.lerp(-J.shoulderZ, -2.55, J.wave);
        elbow.rotation.x = THREE.MathUtils.lerp(J.elbowX, -0.2, J.wave);
        elbow.rotation.z = Math.sin(t * 11) * 0.45 * J.wave;
      }
    }
    this.mouth.scale.x = 1 + J.wave * 0.5;
    this.mouth.scale.y = 1 + J.wave * 1.6;
    return typing;
  }
}
