import * as THREE from 'three';
import { box, cyl, hotspot, mat, rng } from './helpers.js';
import { floorTexture, glowTexture, posterTexture, rugTexture } from './textures.js';
import { ROOM, WINDOW } from './layout.js';

export { ROOM, WINDOW };

export const GLOW_LAYER = 1; // drawn, but never picked by the raycaster

export function buildRoom() {
  const room = new THREE.Group();
  const { minX, maxX, minZ, maxZ, wallH, wallT } = ROOM;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  // plinth + wooden floor
  const plinth = box(width + wallT, 0.22, depth + wallT, '#d9ccb9', cx + wallT / 2, -0.12, cz - wallT / 2);
  plinth.castShadow = false;
  room.add(plinth);
  const floor = box(width, 0.02, depth, mat('#ffffff', { map: floorTexture() }), cx, -0.01, cz);
  floor.castShadow = false;
  room.add(floor);

  // back wall (desk side)
  const wallColor = '#f1ebe2';
  room.add(box(width + wallT, wallH, wallT, wallColor, cx + wallT / 2, wallH / 2, minZ - wallT / 2));
  room.add(box(width + wallT, 0.03, wallT, '#cfc3b2', cx + wallT / 2, wallH + 0.015, minZ - wallT / 2));
  room.add(box(width, 0.08, 0.02, '#fbf8f3', cx, 0.04, minZ + 0.01));

  const windowWall = buildWindowWall();
  room.userData.curtains = windowWall.userData.curtains;
  room.add(windowWall);
  room.add(buildPosterWall());

  const rug = box(1.9, 0.012, 1.25, mat('#ffffff', { map: rugTexture() }), 0.12, 0.006, -0.55);
  rug.castShadow = false;
  room.add(rug);

  return room;
}

// The right-hand wall, built around the window opening.
function buildWindowWall() {
  const g = new THREE.Group();
  const { minZ, maxZ, maxX, wallH, wallT } = ROOM;
  const { z0, z1, y0, y1 } = WINDOW;
  const x = maxX + wallT / 2;
  const side = '#ebe4d9';
  const piece = (zA, zB, yA, yB) => box(wallT, yB - yA, zB - zA, side, x, (yA + yB) / 2, (zA + zB) / 2);
  g.add(piece(minZ, maxZ, 0, y0)); // below the window
  g.add(piece(minZ, maxZ, y1, wallH)); // above
  g.add(piece(minZ, z0, y0, y1)); // left of it
  g.add(piece(z1, maxZ, y0, y1)); // right of it
  g.add(box(wallT, 0.03, maxZ - minZ, '#cfc3b2', x, wallH + 0.015, (minZ + maxZ) / 2));
  g.add(box(0.02, 0.08, maxZ - minZ, '#fbf8f3', maxX - 0.01, 0.04, (minZ + maxZ) / 2));

  // window frame, sill and a cross mullion that throws a shadow
  const frame = '#f7f4ef';
  const w = z1 - z0;
  const h = y1 - y0;
  const zc = (z0 + z1) / 2;
  const yc = (y0 + y1) / 2;
  const win = new THREE.Group();
  win.add(box(wallT + 0.02, 0.05, w + 0.1, frame, x, y1 + 0.005, zc));
  win.add(box(wallT + 0.2, 0.05, w + 0.16, frame, x - 0.07, y0 - 0.005, zc)); // sill
  win.add(box(wallT + 0.02, h, 0.05, frame, x, yc, z0 - 0.005));
  win.add(box(wallT + 0.02, h, 0.05, frame, x, yc, z1 + 0.005));
  win.add(box(0.04, h, 0.035, frame, x, yc, zc));
  win.add(box(0.04, 0.035, w, frame, x, y0 + h * 0.58, zc));
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: '#dfeeff', transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }),
  );
  glass.rotation.y = -Math.PI / 2;
  glass.position.set(x, yc, zc);
  win.add(glass);
  g.add(hotspot(win, 'window'));

  // curtain rod + two grey curtains (they draw shut when you click the window)
  const rodY = y1 + 0.17;
  const rod = cyl(0.012, 0.012, w + 1.05, '#b9b3aa', 10, maxX - 0.08, rodY, zc);
  rod.rotation.x = Math.PI / 2;
  g.add(rod);
  g.add(cyl(0.025, 0.025, 0.04, '#b9b3aa', 10, maxX - 0.08, rodY, z0 - 0.5).rotateX(Math.PI / 2));
  g.add(cyl(0.025, 0.025, 0.04, '#b9b3aa', 10, maxX - 0.08, rodY, z1 + 0.5).rotateX(Math.PI / 2));
  const curtains = [curtain(1), curtain(-1)];
  curtains[0].position.set(maxX - 0.1, rodY - 0.02, z0 - 0.42);
  curtains[1].position.set(maxX - 0.1, rodY - 0.02, z1 + 0.42);
  curtains.forEach((c) => g.add(hotspot(c, 'window')));
  g.userData.curtains = curtains;
  return g;
}

// A curtain hanging from its outer edge; scale.x is how far it's drawn.
function curtain(dir) {
  const height = WINDOW.y1 + 0.15;
  const geo = new THREE.PlaneGeometry(1, height, 40, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5; // 0..1 across the width
    pos.setX(i, u);
    pos.setZ(i, Math.sin(u * Math.PI * 9) * 0.028);
  }
  geo.computeVertexNormals();
  geo.translate(0, -height / 2, 0);
  const m = new THREE.Mesh(geo, mat('#8b8e94', { side: THREE.DoubleSide, shadowSide: THREE.DoubleSide, roughness: 1 }));
  m.castShadow = true;
  m.receiveShadow = true;
  const g = new THREE.Group();
  g.add(m);
  g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; // local +x runs towards the window centre
  g.scale.x = 0.36;
  g.userData.open = 0.36;
  g.userData.closed = (WINDOW.z1 - WINDOW.z0) / 2 + 0.45;
  return g;
}

// Invisible walls and a ceiling that only the sun's shadow sees, so daylight
// can only get in through the window.
export function sunOccluders(sunShadowCamera) {
  const { minX, maxX, minZ, maxZ, wallH, wallT } = ROOM;
  const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const parts = [
    [maxX - minX + 1, 0.1, maxZ - minZ + 1, (minX + maxX) / 2, wallH + 0.05, (minZ + maxZ) / 2], // ceiling
    [maxX - minX + 1, wallH + 0.1, 0.1, (minX + maxX) / 2, wallH / 2, maxZ + 0.05], // front
    [0.1, wallH + 0.1, maxZ - minZ + 1, minX - 0.05, wallH / 2, (minZ + maxZ) / 2], // left
    [0.1, 0.4, maxZ - minZ + 1, maxX + wallT + 0.05, wallH + 0.1, (minZ + maxZ) / 2], // over the window wall's top
  ];
  return parts.map(([w, h, d, x, y, z]) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.raycast = () => {};
    // draw into the sun's shadow map only; every other light ignores it
    o.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry) => {
      geometry.setDrawRange(0, shadowCamera === sunShadowCamera ? Infinity : 0);
    };
    return o;
  });
}

// The view out of the window: a painted sky just beyond the glass.
export function skyPlane(texture) {
  const { maxX, wallT } = ROOM;
  const { z0, z1, y0, y1 } = WINDOW;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.0),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  plane.rotation.y = -Math.PI / 2;
  plane.position.set(maxX + wallT + 0.22, (y0 + y1) / 2 + 0.05, (z0 + z1) / 2);
  plane.raycast = () => {};
  return plane;
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

// ---------------------------------------------------------------------------
// Fairy lights: a thin wire, little warm bulbs and additive glow sprites.
// ---------------------------------------------------------------------------
let sharedGlow;
const WARM = new THREE.Color('#ffc46b');

export function fairyLights(points, { spacing = 0.12, seed = 1 } = {}) {
  sharedGlow ||= glowTexture();
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const count = Math.max(2, Math.round(curve.getLength() / spacing));
  const r = rng(seed);

  const g = new THREE.Group();
  const wire = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(Math.max(8, count * 4))),
    new THREE.LineBasicMaterial({ color: '#cfc6b8', transparent: true, opacity: 0.85 }),
  );
  wire.layers.set(GLOW_LAYER);
  g.add(wire);

  const bulbGeo = new THREE.SphereGeometry(0.013, 8, 6);
  const bulbs = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = curve.getPointAt(t);
    const bulb = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: WARM.clone() }));
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
    glow.scale.setScalar(0.15);
    glow.position.copy(p);
    glow.layers.set(GLOW_LAYER);
    g.add(bulb, glow);
    bulbs.push({ bulb, glow, phase: r() * Math.PI * 2, t });
  }
  return { group: g, bulbs, curve };
}
