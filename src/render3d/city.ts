import * as THREE from 'three';
import { Rng } from '../core/rng';
import { GeoBuilder } from './geo';

/** Length of one street block along the road, metres. Lane dashes repeat every 6 m, so this is a multiple of 6. */
export const CHUNK_M = 24;
export const ROAD_W = 9;
const CURB_W = 0.35;
const WALK_W = 2.6;
/** Distance from the road centre to where buildings start. */
const LOT_X = ROAD_W / 2 + CURB_W + WALK_W;

/** City look as data: later maps (Thane, Bangalore, New York, London) are new palettes and props. */
export interface CityStyle {
  walls: string[];
  roofTrim: string;
  window: string;
  windowLit: string;
  awnings: string[];
  footpath: string;
  ground: string;
  curbA: string;
  curbB: string;
  leaf: string[];
  trunk: string;
  minFloors: number;
  maxFloors: number;
}

export const MUMBAI: CityStyle = {
  walls: ['#e7b7a3', '#9fd3c7', '#f1cf7a', '#c9b9e3', '#b7d48f', '#efe3c8', '#e8946a', '#a6c4e6', '#f3f0ea'],
  roofTrim: '#5d5a57',
  window: '#2d3a4a',
  windowLit: '#ffd98a',
  awnings: ['#d8432f', '#1f8a4f', '#2e6fb7', '#f0a020', '#8b3fa8'],
  footpath: '#c9b596',
  ground: '#a99273',
  curbA: '#f4c20d',
  curbB: '#1c1c1f',
  leaf: ['#3f7d3a', '#4f9444', '#2f6b34'],
  trunk: '#6b4a2f',
  minFloors: 2,
  maxFloors: 7,
};

/** Builds the static parts of one street block (both roadsides) as a single merged geometry. Road is separate. */
export function buildBlock(style: CityStyle, seed: number): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const rng = new Rng(seed);
  const pick = <T>(arr: T[]): T => arr[rng.int(0, arr.length)]!;

  for (const side of [-1, 1] as const) {
    // Curb: painted stripes, 1 m each.
    for (let z = 0; z < CHUNK_M; z++) {
      b.box(CURB_W, 0.22, 1, side * (ROAD_W / 2 + CURB_W / 2), 0.11, -z - 0.5, z % 2 === 0 ? style.curbA : style.curbB);
    }
    // Footpath and the ground behind it.
    b.box(WALK_W, 0.16, CHUNK_M, side * (ROAD_W / 2 + CURB_W + WALK_W / 2), 0.08, -CHUNK_M / 2, style.footpath);
    b.box(40, 0.02, CHUNK_M, side * (LOT_X + 20), 0.0, -CHUNK_M / 2, style.ground);

    // Buildings, packed along the block.
    let z = 0;
    while (z < CHUNK_M - 2) {
      const width = Math.min(CHUNK_M - z, rng.range(4.5, 8));
      const depth = rng.range(7, 11);
      const floors = rng.int(style.minFloors, style.maxFloors + 1);
      const h = floors * 3 + 0.6;
      const cx = side * (LOT_X + 0.6 + depth / 2);
      const cz = -(z + width / 2);
      const wall = pick(style.walls);
      b.box(depth, h, width - 0.3, cx, h / 2, cz, wall);
      // Roof edge and rooftop clutter: black water tanks, a stair box.
      b.box(depth + 0.2, 0.35, width - 0.1, cx, h + 0.17, cz, style.roofTrim);
      const tanks = rng.int(0, 3);
      for (let i = 0; i < tanks; i++) {
        b.cylinder(0.55, 1.1, cx + rng.range(-depth / 3, depth / 3), h + 0.9, cz + rng.range(-width / 4, width / 4), '#1d1e22', 10);
      }
      if (rng.chance(0.5)) b.box(1.6, 1.6, 1.8, cx + side * depth * 0.25, h + 0.8, cz, '#d9d4cc');
      // Windows on the face that looks at the road, some lit.
      const face = side * (LOT_X + 0.6) - side * 0.02;
      const cols = Math.max(1, Math.floor((width - 1) / 1.7));
      for (let f = 1; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const wz = -(z + 0.85 + c * ((width - 1.2) / cols) + 0.4);
          b.box(0.08, 1.3, 0.95, face, f * 3 + 1.4, wz, rng.chance(0.25) ? style.windowLit : style.window);
          // Little balcony ledge.
          if (rng.chance(0.3)) b.box(0.5, 0.12, 1.2, face - side * 0.25, f * 3 + 0.7, wz, style.roofTrim);
        }
      }
      // Ground-floor shop: shutter and a sloped awning over the footpath.
      if (rng.chance(0.75)) {
        b.box(0.1, 2.2, width - 1.2, face - side * 0.03, 1.2, cz, rng.chance(0.5) ? '#8e9399' : '#5a4636');
        b.box(1.4, 0.12, width - 0.8, face - side * 0.7, 2.9, cz, pick(style.awnings), 0, 0, side * 0.35);
      }
      z += width;
    }

    // Trees and street lamps along the outer footpath.
    let tz = rng.range(2, 6);
    while (tz < CHUNK_M - 1) {
      const tx = side * (ROAD_W / 2 + CURB_W + WALK_W - 0.7);
      b.cylinder(0.18, 2.4, tx, 1.3, -tz, style.trunk, 6);
      b.blob(1.5, tx, 3.6, -tz, pick(style.leaf), 0.85);
      b.blob(1.0, tx - side * 0.6, 4.3, -tz + 0.4, pick(style.leaf), 0.9);
      tz += rng.range(7, 12);
    }
    const lampZ = side < 0 ? 4 : 16;
    const lx = side * (ROAD_W / 2 + CURB_W + 0.3);
    b.cylinder(0.08, 6, lx, 3, -lampZ, '#3d3f44', 6);
    b.box(1.6, 0.1, 0.12, lx - side * 0.8, 5.95, -lampZ, '#3d3f44');
    b.box(0.5, 0.15, 0.3, lx - side * 1.5, 5.85, -lampZ, '#fff1c4');

    // Street life on the footpath: parked scooters and people.
    let pz = rng.range(1, 4);
    while (pz < CHUNK_M - 1) {
      const px = side * (ROAD_W / 2 + CURB_W + rng.range(0.5, 1.6));
      if (rng.chance(0.55)) {
        const col = pick(['#c0392b', '#2c6fb0', '#e8e4d8', '#222428', '#d98e04']);
        b.box(0.45, 0.55, 1.5, px, 0.45, -pz, col, 0, side * 0.3, 0);
        b.box(0.5, 0.08, 0.1, px, 0.95, -pz + 0.55, '#2a2a2e', 0, side * 0.3, 0);
      } else {
        const shirt = pick(['#e05a47', '#3f7fd0', '#f2c230', '#f4f0e6', '#7a4fb3', '#2f9e74']);
        b.box(0.45, 0.8, 0.3, px, 0.6 + 0.4, -pz, '#3b3a45');
        b.box(0.5, 0.65, 0.32, px, 1.4 + 0.32, -pz, shirt);
        b.box(0.26, 0.28, 0.26, px, 2.2, -pz, '#8a5a3c');
        b.box(0.28, 0.08, 0.28, px, 2.37, -pz, '#1e1712');
      }
      pz += rng.range(2.5, 6);
    }
  }
  return b.build();
}

/** Road surface texture for one block: worn asphalt, patches, lane dashes, edge lines. */
export function roadTexture(laneCount: number, zebra: boolean, seed: number): HTMLCanvasElement {
  const pxPerM = 28;
  const c = document.createElement('canvas');
  c.width = Math.round(ROAD_W * pxPerM);
  c.height = Math.round(CHUNK_M * pxPerM);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  const rng = new Rng(seed);
  const m = (v: number): number => v * pxPerM;
  ctx.fillStyle = '#4a4b51';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(rng.range(0, c.width), rng.range(0, c.height), 1.5, 1.5);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(25,25,30,0.3)';
    ctx.fillRect(rng.range(0, c.width - m(3)), rng.range(0, c.height - m(3)), m(rng.range(1.2, 3.2)), m(rng.range(1, 3)));
  }
  const laneW = ROAD_W / laneCount;
  for (let lane = 0; lane < laneCount; lane++) {
    const cx = m((lane + 0.5) * laneW);
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(cx - m(0.85), 0, m(0.35), c.height);
    ctx.fillRect(cx + m(0.5), 0, m(0.35), c.height);
    ctx.fillStyle = 'rgba(10,10,12,0.25)';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + m(rng.range(-0.3, 0.3)), rng.range(0, c.height), m(0.3), m(0.5), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#ece7da';
  ctx.fillRect(m(0.15), 0, m(0.14), c.height);
  ctx.fillRect(c.width - m(0.29), 0, m(0.14), c.height);
  const zebraTop = m(CHUNK_M / 2 - 1.5);
  for (let lane = 1; lane < laneCount; lane++) {
    const x = m(lane * laneW) - m(0.07);
    for (let y = 0; y < CHUNK_M; y += 6) {
      if (zebra && m(y + 3) > zebraTop && m(y) < zebraTop + m(3)) continue;
      ctx.fillRect(x, m(y), m(0.14), m(3));
    }
  }
  if (zebra) {
    for (let x = m(0.5); x < c.width - m(0.5); x += m(0.9)) ctx.fillRect(x, zebraTop, m(0.5), m(3));
  }
  return c;
}
