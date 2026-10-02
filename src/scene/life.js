import * as THREE from 'three';
import { BED, CHAIR, DESK, PLANTS, SEATS, SPOTS, VACUUM_ROUTE, WIPE_SPOTS } from './layout.js';
import { findPath } from './nav.js';
import { legJoints } from './character.js';
import { cloth, openBook, phone } from './furniture.js';

// The character's day: what he does next, how he gets there, and what
// happens when you click on things. Plans are generators that yield steps;
// a click interrupts the current plan, tidies up, then starts a new one.

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const H = Math.PI / 2;
// shortest turn between two headings; a half turn always goes the same way
const turnBy = (from, to) => {
  const d = wrap(to - from);
  return Math.abs(d) > Math.PI - 0.02 ? Math.PI : d;
};

export const BED_SCROLL_SECONDS = 60; // a minute of reels in bed, then he dozes off
export const NIGHT_AWAKE_SECONDS = 390; // up again after being woken, then back to bed

const LABELS = {
  work: 'working',
  read: 'reading',
  water: 'watering the plants',
  clean: 'cleaning the desk',
  vacuum: 'vacuuming',
  phone: 'scrolling reels',
  sleep: 'asleep',
};

export class Life {
  constructor(world) {
    this.w = world;
    this.a = world.avatar;
    this.chair = world.chair;
    this.book = openBook('#c8392b');
    this.phone = phone();
    this.cloth = cloth();
    this.drops = [];
    // water drops, stretched along the fall so the pour reads as a stream
    this.dropGeo = new THREE.SphereGeometry(0.012, 8, 6).scale(1, 2.2, 1);
    this.dropMat = new THREE.MeshBasicMaterial({ color: '#4fa9e6', transparent: true, opacity: 0.85 });

    this.mode = 'day'; // day | evening | bedtime | night (awake after being woken)
    this.asleep = false;
    this.location = 'desk'; // desk | standing | sofa | sofaLie | bed | bedLie
    this.label = LABELS.work;
    this.chairZ = CHAIR.workZ;
    this.plan = null;
    this.step = null;
    this.last = 'work';
    this.vacuuming = false;
    this.pouring = false;
    this.wiping = false;
    this.nightTimer = 0;

    // start at the desk, typing
    const a = this.a;
    a.base = 'sit';
    a.seatY = CHAIR.seat;
    a.activity = 'type';
    a.position.set(CHAIR.x, 0, CHAIR.workZ);
    a.yaw = a.yawTarget = Math.PI;
    a.update(0);
    this.plan = this.work(rand(25, 40));
  }

  // ---------------------------------------------------------------- steps ----
  wait(seconds, activity, label) {
    return {
      start: () => {
        this.a.activity = activity;
        if (label) this.label = label;
      },
      update: (dt, t) => t >= seconds,
    };
  }

  tween(seconds, fn) {
    return {
      update: (dt, t) => {
        const k = Math.min(1, t / seconds);
        fn(ease(k), k);
        return k >= 1;
      },
    };
  }

  call(fn) {
    return { update: () => (fn(), true) };
  }

  turn(yaw) {
    return {
      start: () => {
        this.a.yawTarget = yaw;
      },
      update: () => Math.abs(wrap(this.a.yaw - yaw)) < 0.08,
    };
  }

  walk(target, { speed = 1.3, activity = null } = {}) {
    const a = this.a;
    let path = [];
    let i = 0;
    return {
      start: () => {
        a.base = 'stand';
        a.activity = activity ?? (a.items.can ? 'carry' : 'idle');
        path = findPath({ x: a.position.x, z: a.position.z }, target, this.chairBox());
        i = 0;
      },
      update: (dt) => {
        const p = path[i];
        if (!p) return true;
        const dx = p.x - a.position.x;
        const dz = p.z - a.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.02) {
          i++;
          if (i >= path.length) return true;
          return false;
        }
        const heading = Math.atan2(dx, dz);
        a.yawTarget = heading;
        if (Math.abs(wrap(a.yaw - heading)) > 1.25) {
          a.moving = false; // turn on the spot first
          return false;
        }
        const step = Math.min(dist, speed * dt);
        a.position.x += (dx / dist) * step;
        a.position.z += (dz / dist) * step;
        a.stride(step);
        a.moving = true;
        return false;
      },
      end: () => {
        a.moving = false;
      },
    };
  }

  chairBox() {
    if (this.location === 'desk') return [];
    const { x, z } = this.chair.group.position;
    return [[x - 0.27, z - 0.27, x + 0.27, z + 0.27]];
  }

  // ------------------------------------------------------- getting around ----
  *standUp() {
    const a = this.a;
    a.drop('book');
    a.drop('phone');
    this.phone.group.removeFromParent(); // pockets it if it was left on the bed
    const loc = this.location;
    if (loc === 'standing') return;
    if (loc === 'desk') {
      // swivel away from the desk (the chair turns with him), roll back, stand up
      const y0 = a.yaw;
      const turn = turnBy(y0, 0);
      const z0 = a.position.z;
      yield this.tween(0.9, (e) => {
        a.yaw = a.yawTarget = y0 + turn * e;
        a.position.z = lerp(z0, CHAIR.restZ, e);
      });
      this.location = 'standing';
      this.chairZ = CHAIR.restZ;
      a.base = 'stand';
      a.activity = 'idle';
      yield this.tween(0.6, (e) => {
        a.position.z = lerp(CHAIR.restZ, SPOTS.desk.z, e);
      });
      return;
    }
    if (loc === 'sofaLie' || loc === 'bedLie') yield* this.sitUp(loc);
    this.location = 'standing';
    const spot = loc.startsWith('sofa') ? SPOTS.sofa : SPOTS.bed;
    const from = a.position.clone();
    a.base = 'stand';
    a.activity = 'idle';
    yield this.tween(0.7, (e) => {
      a.position.x = lerp(from.x, spot.x, e);
      a.position.z = lerp(from.z, spot.z, e);
    });
  }

  // Lying → sitting on the edge: upper body comes up, then the legs swing
  // off one at a time.
  *sitUp(lieKey) {
    const a = this.a;
    const name = lieKey === 'sofaLie' ? 'sofa' : 'bed';
    const seat = SEATS[name];
    const lie = SEATS[lieKey];
    const [la, lb] = lie.legs;
    const [sa, sb] = lie.sitLegs;
    a.activity = 'idle';
    const r0 = a.J.rootY;
    a.lock = {};
    const legs = (side, lift, drop, pitch) => {
      const j = legJoints(lift, drop, pitch);
      a.lock[side + 'Thigh'] = j.thigh;
      a.lock[side + 'Knee'] = j.knee;
    };
    yield this.tween(1.2, (e) => {
      const p = -H * (1 - e);
      a.lock.pitch = p;
      a.lock.rootY = lerp(r0, seat.y, e);
      for (const side of ['r', 'l']) legs(side, lerp(la, sa, e), lerp(lb, sb, e), p);
    });
    a.base = 'sit';
    a.seatY = seat.y;
    const turn = turnBy(a.yaw, seat.yaw);
    const [first, second] = turn > 0 ? ['r', 'l'] : ['l', 'r'];
    const y0 = a.yaw;
    const from = a.position.clone();
    const mid = { x: lerp(lie.x, seat.x, 0.5), z: lerp(lie.z, seat.z, 0.5) };
    // each leg lifts over the edge and comes down to the floor
    yield this.tween(0.7, (e) => {
      legs(first, lerp(sa, 0, e) + 0.25 * Math.sin(e * Math.PI), lerp(sb, H, e), 0);
      a.yaw = a.yawTarget = y0 + turn * 0.5 * e;
      a.position.x = lerp(from.x, mid.x, e);
      a.position.z = lerp(from.z, mid.z, e);
    });
    yield this.tween(0.7, (e) => {
      legs(second, lerp(sa, 0, e) + 0.25 * Math.sin(e * Math.PI), lerp(sb, H, e), 0);
      a.yaw = a.yawTarget = y0 + turn * (0.5 + 0.5 * e);
      a.position.x = lerp(mid.x, seat.x, e);
      a.position.z = lerp(mid.z, seat.z, e);
    });
    a.lock = {};
    this.location = name;
  }

  *sitDesk() {
    if (this.location === 'desk') return;
    yield* this.standUp();
    yield* this.chairTo(CHAIR.restZ);
    const a = this.a;
    yield this.walk(SPOTS.desk);
    yield this.turn(0); // back to the chair
    a.base = 'sit';
    a.seatY = CHAIR.seat;
    a.activity = 'idle';
    this.location = 'desk';
    const z0 = a.position.z;
    const x0 = a.position.x;
    yield this.tween(0.6, (e) => {
      a.position.z = lerp(z0, CHAIR.restZ, e);
      a.position.x = lerp(x0, CHAIR.x, e);
    });
    // swivel round to the desk and roll in
    const y0 = a.yaw;
    const turn = turnBy(y0, Math.PI);
    yield this.tween(1.0, (e) => {
      a.yaw = a.yawTarget = y0 + turn * e;
      a.position.z = lerp(CHAIR.restZ, CHAIR.workZ, e);
    });
  }

  *sitOn(name) {
    // name: 'sofa' | 'bed'
    if (this.location === name) return;
    yield* this.standUp();
    const a = this.a;
    const spot = SPOTS[name];
    const seat = SEATS[name];
    yield this.walk(spot);
    yield this.turn(seat.yaw);
    a.base = 'sit';
    a.seatY = seat.y;
    a.activity = 'idle';
    this.location = name;
    yield this.tween(0.7, (e) => {
      a.position.x = lerp(spot.x, seat.x, e);
      a.position.z = lerp(spot.z, seat.z, e);
    });
  }

  // Sitting on the edge → lying down, the way people actually get into bed:
  // one leg up, then the other, then the upper body goes down to rest.
  *lieOn(name) {
    const lieKey = name === 'sofa' ? 'sofaLie' : 'bedLie';
    if (this.location === lieKey) return;
    yield* this.sitOn(name);
    const a = this.a;
    const lie = SEATS[lieKey];
    const [sa, sb] = lie.sitLegs;
    const [la, lb] = lie.legs;
    a.activity = 'idle';
    yield this.wait(0.35, 'idle');
    const y0 = a.yaw;
    const turn = turnBy(y0, lie.yaw);
    // the leg on the side he's turning towards goes up first
    const [first, second] = turn > 0 ? ['l', 'r'] : ['r', 'l'];
    const from = a.position.clone();
    const mid = { x: lerp(from.x, lie.x, 0.45), z: lerp(from.z, lie.z, 0.45) };
    a.lock = {};
    const legs = (side, lift, drop, pitch) => {
      const j = legJoints(lift, drop, pitch);
      a.lock[side + 'Thigh'] = j.thigh;
      a.lock[side + 'Knee'] = j.knee;
    };
    // each leg lifts over the edge and settles on the mattress
    yield this.tween(0.85, (e) => {
      legs(first, lerp(0, sa, e) + 0.3 * Math.sin(e * Math.PI), lerp(H, sb, e), 0);
      a.yaw = a.yawTarget = y0 + turn * 0.45 * e;
      a.position.x = lerp(from.x, mid.x, e);
      a.position.z = lerp(from.z, mid.z, e);
    });
    yield this.tween(0.85, (e) => {
      legs(second, lerp(0, sa, e) + 0.3 * Math.sin(e * Math.PI), lerp(H, sb, e), 0);
      a.yaw = a.yawTarget = y0 + turn * (0.45 + 0.55 * e);
      a.position.x = lerp(mid.x, lie.x, e);
      a.position.z = lerp(mid.z, lie.z, e);
    });
    yield this.wait(0.3, 'idle');
    // lean back onto the pillow; the legs keep their place on the mattress
    const r0 = a.J.rootY;
    yield this.tween(1.5, (e) => {
      const p = -H * e;
      a.lock.pitch = p;
      a.lock.rootY = lerp(r0, lie.y, e);
      for (const side of ['r', 'l']) legs(side, lerp(sa, la, e), lerp(sb, lb, e), p);
    });
    a.base = 'lie';
    a.lieY = lie.y;
    a.lieLegs = lie.legs;
    a.lieLean = lie.lean;
    a.lock = {};
    this.location = lieKey;
  }

  *chairTo(z) {
    if (Math.abs(this.chairZ - z) < 0.01) return;
    const z0 = this.chairZ;
    yield this.tween(0.6, (e) => {
      this.chairZ = lerp(z0, z, e);
    });
  }

  // ----------------------------------------------------------- activities ----
  *work(seconds = rand(45, 80)) {
    this.label = 'heading to the desk';
    yield* this.sitDesk();
    yield this.wait(seconds, 'type', LABELS.work);
  }

  *read(lie, seconds = rand(30, 45)) {
    this.label = 'grabbing a book';
    if (lie) yield* this.lieOn('sofa');
    else yield* this.sitOn('sofa');
    yield this.call(() => this.a.hold('book', this.book, 'book'));
    yield this.wait(seconds, 'read', LABELS.read);
    yield this.call(() => this.a.drop('book'));
  }

  *water() {
    this.label = LABELS.water;
    yield* this.standUp();
    const a = this.a;
    yield this.walk(SPOTS.can);
    yield this.turn(SPOTS.can.yaw);
    yield this.wait(0.4, 'idle', LABELS.water);
    yield this.call(() => {
      const can = this.w.can.group;
      a.hold('can', can, 'can');
      a.activity = 'carry';
    });
    for (const plant of ['snake', 'poinsettia', 'flowers', 'palm']) {
      yield this.walk(SPOTS[plant]);
      yield this.turn(SPOTS[plant].yaw);
      yield this.pour(plant, 3);
      yield this.wait(0.3, 'carry');
    }
    yield* this.returnCan();
  }

  pour(plant, seconds) {
    return {
      start: () => {
        this.a.activity = 'pour';
        this.a.pouring = true;
        this.a.pourReach = ON_DESK.includes(plant);
        this.pouring = plant;
      },
      update: (dt, t) => t >= seconds,
      end: () => {
        this.pouring = false;
        this.a.pouring = false;
        this.a.activity = 'carry';
        this.w.bounce(plant, 0.1);
      },
    };
  }

  *returnCan() {
    const a = this.a;
    yield this.walk(SPOTS.can);
    yield this.turn(SPOTS.can.yaw);
    yield this.call(() => {
      const can = a.drop('can');
      if (can) this.w.placeCan(can);
      a.activity = 'idle';
    });
  }

  *clean() {
    this.label = LABELS.clean;
    yield* this.standUp();
    const spots = Math.random() < 0.5 ? WIPE_SPOTS : [...WIPE_SPOTS].reverse();
    yield this.walk(spots[0]);
    yield* this.chairTo(-0.06);
    this.label = LABELS.clean;
    for (const spot of spots) {
      yield this.walk(spot);
      yield this.turn(spot.yaw);
      yield this.call(() => {
        this.wiping = true;
        this.w.scene.add(this.cloth);
      });
      yield this.wait(rand(3, 4.5), 'wipe', LABELS.clean);
    }
    yield this.call(() => this.putAwayCloth());
    yield* this.chairTo(CHAIR.restZ);
  }

  putAwayCloth() {
    this.wiping = false;
    this.cloth.parent?.remove(this.cloth);
  }

  *vacuum() {
    this.label = LABELS.vacuum;
    yield* this.standUp();
    const a = this.a;
    yield this.walk(SPOTS.vacuum);
    yield this.turn(SPOTS.vacuum.yaw);
    yield this.call(() => {
      this.vacuuming = true;
      a.activity = 'vacuum';
      a.say('vrrrrr', 2);
    });
    for (const [x, z] of VACUUM_ROUTE) yield this.walk({ x, z }, { speed: 0.38, activity: 'vacuum' });
    yield* this.returnVacuum();
  }

  *returnVacuum() {
    yield this.walk(SPOTS.vacuum, { activity: 'vacuum' });
    yield this.turn(SPOTS.vacuum.yaw);
    yield this.call(() => {
      this.vacuuming = false;
      this.w.dockVacuum();
      this.a.activity = 'idle';
    });
  }

  *scroll(seconds, night) {
    this.label = night ? 'off to bed' : 'taking a break';
    yield* this.lieOn('bed');
    yield this.call(() => {
      this.a.hold('phone', this.phone.group, 'phone');
      if (night) this.a.say('one more reel…', 3);
    });
    yield this.wait(seconds, 'phone', LABELS.phone);
    if (!night) {
      yield this.call(() => this.a.drop('phone'));
      return;
    }
    // dozing off: eyes get heavy, the phone sinks to his chest and he puts it
    // down beside him, then the blanket comes up
    yield this.wait(4, 'groggy', 'dozing off');
    yield this.call(() => {
      const ph = this.a.drop('phone');
      ph.position.set(2.5, BED.top + 0.006, BED.z - 0.34);
      ph.rotation.set(H, H + 0.3, 0, 'YXZ');
      this.w.scene.add(ph);
    });
    yield this.tween(1.6, (e) => this.w.setBlanket(e));
    yield this.call(() => {
      this.asleep = true;
      this.label = LABELS.sleep;
    });
    yield this.wait(Infinity, 'sleep', LABELS.sleep);
  }

  *wakeUp(greeting) {
    const a = this.a;
    this.asleep = false;
    this.label = 'waking up';
    a.say(greeting, 3);
    yield this.wait(1.4, 'groggy', 'waking up');
    yield this.tween(1, (e) => this.w.setBlanket(1 - e));
    // picks the phone up from beside him and pockets it once he's sitting up
    if (this.phone.group.parent && !a.items.phone) yield this.call(() => a.hold('phone', this.phone.group, 'phone'));
    if (this.location === 'bedLie') yield* this.sitUp('bedLie');
    yield this.call(() => a.drop('phone'));
    yield this.wait(2.2, 'stretch');
    yield this.wait(0.8, 'groggy');
  }

  *wave() {
    const a = this.a;
    const cam = this.w.camera.position;
    const toCam = Math.atan2(cam.x - a.position.x, cam.z - a.position.z);
    a.say('hey, there! 👋', 2.8);
    if (this.location === 'desk') {
      const y0 = a.yaw;
      const z0 = a.position.z;
      const full = wrap(toCam - y0);
      const delta = full - Math.sign(full) * 0.55;
      yield this.tween(0.8, (e) => {
        a.yaw = a.yawTarget = y0 + delta * e;
        a.position.z = lerp(z0, CHAIR.workZ + 0.2, e);
      });
      yield this.wait(2.6, 'wave');
      yield this.tween(0.8, (e) => {
        a.yaw = a.yawTarget = y0 + delta * (1 - e);
        a.position.z = lerp(CHAIR.workZ + 0.2, z0, e);
      });
      return;
    }
    if (this.location === 'standing') yield this.turn(toCam);
    yield this.wait(2.6, 'wave');
  }

  *spin() {
    const a = this.a;
    const y0 = a.yaw;
    a.say('wheee!', 1.8);
    yield this.tween(0.35, (e) => {
      a.position.z = lerp(CHAIR.workZ, CHAIR.workZ + 0.22, e);
    });
    yield this.tween(1.5, (e) => {
      a.yaw = a.yawTarget = y0 + e * Math.PI * 2;
    });
    yield this.tween(0.4, (e) => {
      a.position.z = lerp(CHAIR.workZ + 0.22, CHAIR.workZ, e);
    });
  }

  // put away whatever's in hand before starting something new
  *tidy() {
    const a = this.a;
    a.drop('book');
    a.drop('phone');
    this.pouring = false;
    a.pouring = false;
    a.lock = {};
    if (this.wiping) this.putAwayCloth();
    if (a.items.can) {
      yield* this.standUp();
      yield* this.returnCan();
    }
    if (this.vacuuming) {
      yield* this.standUp();
      yield* this.returnVacuum();
    }
    if (this.location !== 'desk' && Math.abs(this.chairZ - CHAIR.restZ) > 0.01) yield* this.chairTo(CHAIR.restZ);
  }

  // -------------------------------------------------------------- choosing ----
  *next() {
    const options = [
      ['work', 3],
      ['sofa', 1.1],
      ['sofaLie', 1],
      ['water', 0.9],
      ['clean', 0.8],
      ['vacuum', 0.8],
      ['bed', 0.7],
    ].filter(([k]) => k !== this.last);
    let pick = 'work';
    if (this.last === 'work' || Math.random() > 0.55) {
      const total = options.reduce((s, [, w]) => s + w, 0);
      let r = Math.random() * total;
      for (const [k, w] of options) if ((r -= w) <= 0) {
        pick = k;
        break;
      }
    }
    this.last = pick;
    if (pick === 'work') yield* this.work();
    else if (pick === 'sofa') yield* this.read(false);
    else if (pick === 'sofaLie') yield* this.read(true);
    else if (pick === 'water') yield* this.water();
    else if (pick === 'clean') yield* this.clean();
    else if (pick === 'vacuum') yield* this.vacuum();
    else yield* this.scroll(rand(25, 40), false);
  }

  interrupt(factory) {
    this.a.moving = false;
    this.step?.end?.();
    this.step = null;
    const self = this;
    this.plan = (function* () {
      yield* self.tidy();
      yield* factory();
    })();
  }

  // ------------------------------------------------------- outside events ----
  // evening is over: off to bed with the phone, then sleep
  bedtime() {
    if (this.mode === 'bedtime') return;
    this.mode = 'bedtime';
    this.interrupt(() => this.scroll(BED_SCROLL_SECONDS, true));
  }

  // light mode: the sun is back up
  morning() {
    const wasNight = this.mode !== 'day';
    this.mode = 'day';
    if (this.asleep || (wasNight && this.location.startsWith('bed'))) {
      this.interrupt(function* () {
        yield* this.wakeUp('good morning ☀️');
        yield* this.work(rand(30, 50));
      }.bind(this));
    }
  }

  evening() {
    if (this.mode === 'day') this.mode = 'evening';
  }

  get inBedAtNight() {
    return this.mode === 'bedtime';
  }

  // a click on something in the room; returns true if it changed his plans
  request(key) {
    const work = ['desk', 'chair', 'monitor', 'keyboard', 'headphones'];
    if (this.inBedAtNight) {
      if ([...work, 'sofa'].includes(key)) {
        const groggy = this.asleep;
        this.mode = 'night';
        this.nightTimer = NIGHT_AWAKE_SECONDS;
        this.interrupt(function* () {
          if (groggy) yield* this.wakeUp('*yawn*… okay, okay, i’m up');
          else this.a.say('fine, back to work', 2.5);
          yield* this.work(rand(40, 60));
        }.bind(this));
        return true;
      }
      if (key === 'me') {
        this.a.say(this.asleep ? 'zzz… five more minutes' : 'just one more reel', 2.5);
        return true;
      }
      return false;
    }
    switch (key) {
      case 'me':
        this.interrupt(() => this.wave());
        return true;
      case 'chair':
        this.interrupt(() => (this.location === 'desk' ? this.spin() : this.work()));
        return true;
      case 'desk':
      case 'keyboard':
      case 'headphones':
        if (this.location !== 'desk') this.interrupt(() => this.work());
        return this.location !== 'desk';
      case 'monitor':
        if (this.location !== 'desk') {
          this.interrupt(() => this.work());
          return true;
        }
        return false;
      case 'sofa':
        this.interrupt(() => this.read(Math.random() < 0.5));
        return true;
      case 'books':
        this.interrupt(() => this.read(false));
        return true;
      case 'bed':
        if (this.mode === 'day') this.interrupt(() => this.scroll(rand(25, 40), false));
        else this.bedtime();
        return true;
      case 'palm':
      case 'snake':
      case 'poinsettia':
      case 'flowers':
      case 'succulents':
      case 'can':
        this.interrupt(() => this.water());
        return true;
      case 'vacuum':
        this.interrupt(() => this.vacuum());
        return true;
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------- frame ----
  update(dt) {
    if (this.mode === 'night' && !this.asleep) {
      this.nightTimer -= dt;
      if (this.nightTimer <= 0) this.bedtime();
    }

    if (!this.plan) this.plan = this.next();
    if (!this.step) {
      const r = this.plan.next();
      if (r.done) {
        this.plan = null;
      } else {
        this.step = r.value;
        this.step.t = 0;
        this.step.start?.();
      }
    }
    if (this.step) {
      this.step.t += dt;
      if (this.step.update(dt, this.step.t)) {
        this.step.end?.();
        this.step = null;
      }
    }

    const a = this.a;
    a.update(dt);
    this.followers(dt);

    if (this.asleep) {
      a.bubble = ['z', 'z z', 'z z z'][Math.floor(a.time / 0.9) % 3];
      a.bubbleTime = 0.5;
    }
  }

  // things that track the character: chair, vacuum, cloth, water, phone
  followers(dt) {
    const a = this.a;
    const chair = this.chair;
    if (this.location === 'desk') {
      chair.group.position.x = a.position.x;
      chair.group.position.z = a.position.z;
      chair.swivel.rotation.y = a.yaw;
      this.chairZ = a.position.z;
    } else {
      chair.group.position.x = CHAIR.x;
      chair.group.position.z = this.chairZ;
      chair.swivel.rotation.y = 0;
    }

    const hand = a.handWorldPosition(_v);
    if (this.vacuuming) this.w.holdVacuum(a, hand);
    if (this.wiping) this.cloth.position.set(hand.x, DESK.top + 0.008, Math.max(hand.z, DESK.z - DESK.d / 2 + 0.02));
    if (a.items.phone) {
      this.phone.draw(dt);
      this.phone.light.intensity = this.w.interior * 0.35;
    }

    // water leaves the spout the way it points, falls under gravity and lands
    // in the soil (the spot is chosen so the spout is over the pot, so the
    // sideways nudge needed is small)
    if (this.pouring && a.pour > 0.6) {
      const [px, pz] = PLANTS[this.pouring];
      const soil = (ON_DESK.includes(this.pouring) ? DESK.top : 0) + SOIL[this.pouring];
      const can = this.w.can;
      const start = can.tip.getWorldPosition(_v);
      const out = _dir.copy(SPOUT).applyQuaternion(can.group.quaternion);
      const vy = out.y * POUR_SPEED;
      const fall = start.y - soil;
      if (fall > 0) {
        const t = (vy + Math.sqrt(vy * vy + 2 * GRAVITY * fall)) / GRAVITY;
        for (let i = 0; i < 2; i++) {
          const tx = px + (Math.random() - 0.5) * 0.06;
          const tz = pz + (Math.random() - 0.5) * 0.06;
          const d = new THREE.Mesh(this.dropGeo, this.dropMat);
          d.position.copy(start);
          d.userData = { vel: new THREE.Vector3((tx - start.x) / t, vy, (tz - start.z) / t), left: t };
          this.w.scene.add(d);
          this.drops.push(d);
        }
      }
    }
    this.drops = this.drops.filter((d) => {
      const u = d.userData;
      u.vel.y -= GRAVITY * dt;
      d.position.addScaledVector(u.vel, dt);
      u.left -= dt;
      if (u.left > 0) return true;
      d.parent?.remove(d);
      return false;
    });
  }
}

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const GRAVITY = 9.8;
const POUR_SPEED = 0.6; // how fast water leaves the spout (m/s)
const SPOUT = new THREE.Vector3(0, Math.cos(0.95), Math.sin(0.95)); // spout axis in the can
const ON_DESK = ['poinsettia', 'flowers'];
// height of the soil above each plant's base, for the water to land in
const SOIL = { palm: 0.32, snake: 0.3, poinsettia: 0.125, flowers: 0.115 };
