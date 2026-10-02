import { HUBS, OBSTACLES } from './layout.js';

// Tiny navigation: straight lines between open-floor junctions, avoiding
// furniture footprints (inflated by the character's radius).
const RADIUS = 0.16;

function segmentHitsBox(ax, az, bx, bz, [x0, z0, x1, z1]) {
  x0 -= RADIUS;
  z0 -= RADIUS;
  x1 += RADIUS;
  z1 += RADIUS;
  // Liang–Barsky clip of the segment against the box
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t1 - t0 > 1e-4;
}

function inside(x, z, [x0, z0, x1, z1]) {
  return x > x0 - RADIUS && x < x1 + RADIUS && z > z0 - RADIUS && z < z1 + RADIUS;
}

// extra: dynamic obstacles (like wherever the chair has been rolled to)
export function findPath(from, to, extra = []) {
  // ignore any box the start or end point is already standing in
  const boxes = [...OBSTACLES, ...extra].filter((b) => !inside(from.x, from.z, b) && !inside(to.x, to.z, b));
  const clear = (a, b) => boxes.every((o) => !segmentHitsBox(a.x, a.z, b.x, b.z, o));
  if (clear(from, to)) return [to];

  const nodes = [from, ...HUBS.map(([x, z]) => ({ x, z })), to];
  const n = nodes.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
    if (u === -1 || dist[u] === Infinity || u === n - 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      if (!clear(nodes[u], nodes[v])) continue;
      const d = dist[u] + Math.hypot(nodes[u].x - nodes[v].x, nodes[u].z - nodes[v].z);
      if (d < dist[v]) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[n - 1] === -1) return [to]; // no clean route: walk straight, it's a toy
  const path = [];
  for (let v = n - 1; v > 0; v = prev[v]) path.unshift(nodes[v]);
  return path;
}
