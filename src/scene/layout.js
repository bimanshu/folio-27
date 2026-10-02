// Where everything lives (metres). +x runs towards the window wall, -z towards
// the desk wall; the room is cut away on the front (+z) and left (-x).

export const ROOM = {
  minX: -2.75,
  maxX: 3.05,
  minZ: -1.7,
  maxZ: 1.5,
  wallH: 2.7,
  wallT: 0.12,
};

// opening in the right-hand wall
export const WINDOW = { z0: -1.05, z1: 0.15, y0: 0.9, y1: 2.2 };

export const DESK = { x: 0.15, z: -1.325, w: 2.4, d: 0.75, top: 0.76 };

// the desk chair: where it sits while you work, and where it waits otherwise
export const CHAIR = { x: 0.15, workZ: -0.64, restZ: -0.36, seat: 0.486 };

// single bed, head against the window wall, long side facing the room
export const BED = { x: 2.05, z: 1.02, length: 2.0, width: 0.95, top: 0.5 };

// sofa against the open left side, facing the window
export const SOFA = { x: -2.325, z: 0.5, depth: 0.85, length: 1.9, seat: 0.44 };

export const PLANTS = {
  palm: [-2.25, -1.28],
  snake: [2.62, -1.35],
  poinsettia: [1.17, -1.42], // on the desk
  flowers: [-0.86, -1.42], // on the desk
};

export const VACUUM_DOCK = { x: 1.72, z: -1.56 };
export const CAN_HOME = { x: 2.12, z: -1.47 };

// Where to stand, facing `yaw`, so the watering can's spout is right over a
// pot. While pouring, the spout is `reach` ahead of him and `side` to his
// right: low over floor pots, arm out over the desk for the ones up there.
const POUR = { floor: [0.47, 0.16], desk: [0.574, 0.173] };
const pourSpot = (plant, yaw, [reach, side]) => {
  const [px, pz] = PLANTS[plant];
  return { x: px - reach * Math.sin(yaw) + side * Math.cos(yaw), z: pz - reach * Math.cos(yaw) - side * Math.sin(yaw), yaw };
};

// Standing spots the character walks to, with the way they face once there.
export const SPOTS = {
  desk: { x: CHAIR.x, z: CHAIR.restZ + 0.5, yaw: Math.PI }, // in front of the chair
  sofa: { x: -1.55, z: SOFA.z, yaw: -Math.PI / 2 },
  bed: { x: 2.0, z: 0.2, yaw: 0 },
  // side-on where there's room, so the can stays on the side you're looking from
  palm: pourSpot('palm', Math.PI, POUR.floor),
  snake: pourSpot('snake', Math.PI / 2, POUR.floor),
  poinsettia: pourSpot('poinsettia', Math.PI, POUR.desk),
  flowers: pourSpot('flowers', Math.PI, POUR.desk),
  can: { x: CAN_HOME.x - 0.1, z: -1.02, yaw: Math.PI },
  vacuum: { x: VACUUM_DOCK.x, z: -1.08, yaw: Math.PI },
};

// Where to sit / lie (hip position + facing). Lying characters face up with
// the head towards their local -z. Leg shapes are [knee lift, shin drop] in
// radians from straight out: `sitLegs` once both legs are up and he's still
// sitting, `legs` lying down. `lean` curls the shoulders up onto the pillow.
export const SEATS = {
  sofa: { x: SOFA.x + 0.12, z: SOFA.z, yaw: Math.PI / 2, y: SOFA.seat + 0.012 },
  // the sofa is shorter than he is: knees up, feet on the cushion
  sofaLie: { x: SOFA.x + 0.17, z: 0.7, yaw: 0, y: SOFA.seat + 0.15, sitLegs: [0.97, 1.2], legs: [0.5, 1.17], lean: 0.1 },
  bed: { x: 2.0, z: BED.z - BED.width / 2 + 0.2, yaw: Math.PI, y: BED.top + 0.012 },
  bedLie: { x: 2.1, z: BED.z, yaw: -Math.PI / 2, y: BED.top + 0.15, sitLegs: [0, 0], legs: [0, 0], lean: 0.15 },
};

// Spots along the desk edge for wiping it down.
export const WIPE_SPOTS = [-0.72, -0.2, 0.42, 0.95].map((x) => ({ x, z: -0.62, yaw: Math.PI }));

// A loop over the open floor for the vacuum.
export const VACUUM_ROUTE = [
  [1.3, -0.45],
  [0.85, 0.3],
  [-0.35, 0.45],
  [-1.45, 0.15],
  [-1.5, -0.55],
  [-0.65, -0.2],
  [0.4, 0.9],
  [1.45, 0.2],
];

// Furniture footprints the character walks around: [x0, z0, x1, z1].
export const OBSTACLES = [
  [-1.05, -1.7, 1.35, -0.95], // desk
  [SOFA.x - SOFA.depth / 2, SOFA.z - SOFA.length / 2, SOFA.x + SOFA.depth / 2, SOFA.z + SOFA.length / 2],
  [BED.x - BED.length / 2, BED.z - BED.width / 2, BED.x + BED.length / 2, BED.z + BED.width / 2],
  [-2.75, -1.7, -1.88, -0.88], // palm
  [2.36, -1.7, 3.05, -1.08], // snake plant
  [-1.82, -1.62, -1.42, -1.22], // floor books
  [1.56, -1.7, 1.88, -1.42], // vacuum dock
  [1.98, -1.62, 2.26, -1.32], // watering can
];

// Junctions in the open floor that paths can route through.
export const HUBS = [
  [-1.4, 0.2],
  [-0.65, 0.35],
  [0.15, 0.55],
  [0.85, 0.3],
  [1.6, 0.15],
  [1.6, -0.6],
  [-1.25, -0.55],
  [-0.5, -0.45],
  [0.75, -0.45],
];
