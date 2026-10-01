import * as THREE from 'three';
import { box, hotspot, mat, rng } from './helpers.js';
import { floorTexture, ginghamTexture, glowTexture, posterTexture, rugTexture } from './textures.js';

// Room footprint (metres). The diorama is cut away on the front and left so
// the camera looks into the back-right corner, like the photo of the desk.
export const ROOM = {
  minX: -2.3,
  maxX: 2.3,
  minZ: -1.7,
  maxZ: 0.75,
  wallH: 2.7,
  wallT: 0.12,
};

export const GLOW_LAYER = 1; // excluded from the normal/edge pass

export function buildRoom() {
  const room = new THREE.Group();
  const { minX, maxX, minZ, maxZ, wallH, wallT } = ROOM;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  // plinth + wooden floor
  const plinth = box(width + wallT, 0.22, depth + wallT, '#d9ccb9', (minX + maxX + wallT) / 2, -0.12, (minZ + maxZ - wallT) / 2);
  plinth.castShadow = false;
  room.add(plinth);
  const floorMat = mat('#ffffff', { map: floorTexture() });
  const floor = box(width, 0.02, depth, floorMat, (minX + maxX) / 2, -0.01, (minZ + maxZ) / 2);
  floor.castShadow = false;
  room.add(floor);

  // walls with a darker cap so the cut-away reads as a diorama
  const wallColor = '#f1ebe2';
  const back = box(width + wallT, wallH, wallT, wallColor, (minX + maxX + wallT) / 2, wallH / 2, minZ - wallT / 2);
  const side = box(wallT, wallH, depth, '#ebe4d9', maxX + wallT / 2, wallH / 2, (minZ + maxZ) / 2);
  back.castShadow = side.castShadow = false;
  room.add(back, side);
  room.add(box(width + wallT, 0.03, wallT, '#cfc3b2', (minX + maxX + wallT) / 2, wallH + 0.015, minZ - wallT / 2));
  room.add(box(wallT, 0.03, depth, '#cfc3b2', maxX + wallT / 2, wallH + 0.015, (minZ + maxZ) / 2));
  // skirting boards
  room.add(box(width, 0.08, 0.02, '#fbf8f3', (minX + maxX) / 2, 0.04, minZ + 0.01));
  room.add(box(0.02, 0.08, depth, '#fbf8f3', maxX - 0.01, 0.04, (minZ + maxZ) / 2));

  // rug under the chair
  const rug = box(1.9, 0.012, 1.25, mat('#ffffff', { map: rugTexture() }), 0.12, 0.006, -0.55);
  rug.castShadow = false;
  room.add(rug);

  room.add(buildPosterWall());
  room.add(buildGinghamFrames());

  return room;
}

// The gallery wall above the monitor, arranged in the same diamond as the photo.
function buildPosterWall() {
  const wall = new THREE.Group();
  const cx = 0.12;
  const cy = 1.86;
  const W = 0.232;
  const H = 0.32;
  // [poster, column offset, row offset] in poster widths / heights
  const layout = [
    ['ego', -2.12, 0],
    ['art', -1.04, 0.47],
    ['secret', -1.04, -0.58],
    ['risk', 0, 1.04],
    ['collage', 0, 0],
    ['life', 0, -1.05],
    ['proud', 1.04, 0.47],
    ['create', 1.04, -0.58],
    ['abstract', 2.12, 0],
  ];
  const paper = '#fbf9f5';
  for (const [name, col, row] of layout) {
    const mats = [paper, paper, paper, paper, mat('#ffffff', { map: posterTexture(name) }), paper].map((m) =>
      typeof m === 'string' ? mat(m) : m,
    );
    const p = box(W, H, 0.006, mats, cx + col * W, cy + row * H, ROOM.minZ + 0.004);
    p.castShadow = false;
    wall.add(p);
  }
  return hotspot(wall, 'posters');
}

function buildGinghamFrames() {
  const frames = new THREE.Group();
  const r = rng(9);
  const kinds = ['cherry', 'pink', 'flower', 'yellow'];
  kinds.forEach((kind, i) => {
    const mats = Array.from({ length: 6 }, (_, f) =>
      f === 1 ? mat('#ffffff', { map: ginghamTexture(kind) }) : mat('#f7efe4'),
    );
    const frame = box(0.008, 0.34, 0.3, mats, ROOM.maxX - 0.005, 2.16 - i * 0.39, -0.62 + (r() - 0.5) * 0.06);
    frame.rotation.x = (r() - 0.5) * 0.08;
    frame.castShadow = false;
    frames.add(frame);
  });
  return hotspot(frames, 'frames');
}

// ---------------------------------------------------------------------------
// Fairy lights: a pixel wire, little warm bulbs and additive glow sprites.
// ---------------------------------------------------------------------------
let sharedGlow;
const WARM = new THREE.Color('#ffc46b');

export function fairyLights(points, { spacing = 0.12, sag = 0, seed = 1 } = {}) {
  sharedGlow ||= glowTexture();
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const length = curve.getLength();
  const count = Math.max(2, Math.round(length / spacing));
  const r = rng(seed);

  const g = new THREE.Group();
  const wirePoints = curve.getSpacedPoints(Math.max(8, count * 4));
  const wire = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(wirePoints),
    new THREE.LineBasicMaterial({ color: '#cfc6b8', transparent: true, opacity: 0.85 }),
  );
  wire.layers.set(GLOW_LAYER);
  g.add(wire);

  const bulbGeo = new THREE.BoxGeometry(0.024, 0.024, 0.024);
  const bulbs = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = curve.getPointAt(t);
    p.y -= Math.sin(t * Math.PI) * sag;
    const bulbMat = new THREE.MeshBasicMaterial({ color: WARM.clone() });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.copy(p);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sharedGlow,
        color: WARM.clone(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.4,
      }),
    );
    glow.scale.setScalar(0.17);
    glow.position.copy(p);
    glow.layers.set(GLOW_LAYER);
    g.add(bulb, glow);
    bulbs.push({ bulb, glow, phase: r() * Math.PI * 2, t });
  }
  return { group: g, bulbs, curve };
}
