import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { CityStyle } from '../data/maps';
import { GeoBuilder } from './geo';
import { parkedTaxi } from './props';

/** Length of one street block along the road, metres. Lane dashes repeat every 6 m, so this is a multiple of 6. */
export const CHUNK_M = 24;
const CURB_W = 0.35;
const WALK_W = 2.6;

export interface BlockGeometry {
  /** Lit by the scene. */
  main: THREE.BufferGeometry;
  /** Self-lit parts: lit windows, lamp heads, shop interiors. They glow at night. */
  glow: THREE.BufferGeometry;
  /** Light pools on the ground under lamps and shop fronts, drawn additively at night. */
  pools: THREE.BufferGeometry;
  /** Shop boards and billboards, textured from the sign atlas. */
  signs: THREE.BufferGeometry;
}

type Cell = [number, number, number, number];

/** Builds the static parts of one street block (both roadsides). Road is separate. */
export function buildBlock(style: CityStyle, seed: number, roadW: number, signCells: Cell[] = []): BlockGeometry {
  const b = new GeoBuilder();
  const glow = new GeoBuilder();
  const signs = new GeoBuilder();
  const sign = (w: number, h: number, x: number, y: number, z: number, side: number): void => {
    if (!signCells.length) return;
    const cell = signCells[rng.int(0, signCells.length)]!;
    signs.addAtlas(new THREE.PlaneGeometry(w, h), cell, x, y, z, (-side * Math.PI) / 2);
  };
  const pools: number[] = [];
  const rng = new Rng(seed);
  const pick = <T>(arr: T[]): T => arr[rng.int(0, arr.length)]!;
  const half = roadW / 2;
  const lotX = half + CURB_W + WALK_W;
  // On lake maps, about half the blocks have water on the left instead of buildings.
  const lakeLeft = style.lake && rng.chance(0.55);

  const windowAt = (x: number, y: number, z: number, w: number, h: number, side: number): void => {
    if (rng.chance(style.litRate)) glow.box(0.08, h, w, x, y, z, style.windowLit);
    else b.box(0.08, h, w, x, y, z, style.window);
    void side;
  };

  for (const side of [-1, 1] as const) {
    // Curb: painted stripes, 1 m each.
    for (let z = 0; z < CHUNK_M; z++) {
      b.box(CURB_W, 0.22, 1, side * (half + CURB_W / 2), 0.11, -z - 0.5, z % 2 === 0 ? style.curbA : style.curbB);
    }
    // Footpath and the ground behind it.
    b.box(WALK_W, 0.16, CHUNK_M, side * (half + CURB_W + WALK_W / 2), 0.08, -CHUNK_M / 2, style.footpath);

    if (side === -1 && lakeLeft) {
      buildLakeside(b, glow, rng, style, lotX, pools);
    } else {
      b.box(40, 0.02, CHUNK_M, side * (lotX + 20), 0.0, -CHUNK_M / 2, style.ground);
      // Buildings, packed along the block.
      let z = 0;
      while (z < CHUNK_M - 2) {
        const roll = rng.next();
        const kind = roll < style.towers ? 'tower' : roll < style.towers + style.chawls ? 'chawl' : 'house';
        const width = Math.min(CHUNK_M - z, kind === 'chawl' ? rng.range(9, 14) : kind === 'tower' ? rng.range(7, 10) : rng.range(4.5, 8));
        const depth = kind === 'tower' ? rng.range(10, 14) : rng.range(7, 11);
        const setback = kind === 'tower' ? rng.range(2, 5) : 0.6;
        const floors =
          kind === 'tower' ? rng.int(10, 17) : kind === 'chawl' ? rng.int(3, 5) : rng.int(style.minFloors, style.maxFloors + 1);
        const fh = 3;
        const h = floors * fh + 0.6;
        const cx = side * (lotX + setback + depth / 2);
        const cz = -(z + width / 2);
        const face = side * (lotX + setback) - side * 0.02;
        const wall = kind === 'tower' ? pick(['#d9dfe6', '#c3ced8', '#e9e4da', '#9fb3c6']) : pick(style.walls);
        b.box(depth, h, width - 0.3, cx, h / 2, cz, wall);
        b.box(depth + 0.2, 0.35, width - 0.1, cx, h + 0.17, cz, style.roofTrim);

        if (kind === 'tower') {
          // Glass bands on every floor, with a few lit offices.
          for (let f = 1; f < floors; f++) {
            const y = f * fh + 1.3;
            if (rng.chance(style.litRate * 0.8)) glow.box(0.1, 1.5, width - 1.2, face, y, cz, style.windowLit);
            else b.box(0.1, 1.5, width - 1.2, face, y, cz, '#3d5872');
          }
          b.box(2.2, 2.6, 2.6, cx, h + 1.3, cz, '#b9c0c8');
          // Compound wall and gate in front of the setback.
          b.box(0.25, 1.1, width - 0.3, side * (lotX + 0.3), 0.55, cz, '#d8d2c4');
        } else if (kind === 'chawl') {
          // Long corridor balconies with railings, doors in a row and washing on the lines.
          for (let f = 0; f < floors; f++) {
            const y = f * fh;
            if (f > 0) {
              b.box(1.2, 0.15, width - 0.4, face - side * 0.6, y + 0.1, cz, '#8d8478');
              b.box(0.08, 1.0, width - 0.4, face - side * 1.15, y + 0.6, cz, '#4f4a45');
            }
            const doors = Math.floor((width - 1) / 2);
            for (let d = 0; d < doors; d++) {
              const dz = -(z + 1 + d * 2 + 0.5);
              windowAt(face, y + 1.4, dz, 0.9, f === 0 ? 2.2 : 1.6, side);
              if (f > 0 && rng.chance(0.35)) {
                b.box(0.05, 0.7, 0.6, face - side * 1.1, y + 1.5, dz + 0.6, pick(['#e05a47', '#3f7fd0', '#f2c230', '#f4f0e6', '#2f9e74']));
              }
            }
          }
        } else {
          // Ordinary building: black water tanks and a stair box on the roof.
          const tanks = rng.int(0, 3);
          for (let i = 0; i < tanks; i++) {
            b.cylinder(0.55, 1.1, cx + rng.range(-depth / 3, depth / 3), h + 0.9, cz + rng.range(-width / 4, width / 4), '#1d1e22', 10);
          }
          if (rng.chance(0.5)) b.box(1.6, 1.6, 1.8, cx + side * depth * 0.25, h + 0.8, cz, '#d9d4cc');
          const cols = Math.max(1, Math.floor((width - 1) / 1.7));
          for (let f = 1; f < floors; f++) {
            for (let c = 0; c < cols; c++) {
              const wz = -(z + 0.85 + c * ((width - 1.2) / cols) + 0.4);
              windowAt(face, f * fh + 1.4, wz, 0.95, 1.3, side);
              if (rng.chance(0.3)) b.box(0.5, 0.12, 1.2, face - side * 0.25, f * fh + 0.7, wz, style.roofTrim);
            }
          }
          // Ground-floor shop: open and lit, or shuttered, with a sloped awning over the footpath.
          if (rng.chance(0.75)) {
            if (rng.chance(0.55)) {
              glow.box(0.1, 2.2, width - 1.2, face - side * 0.03, 1.2, cz, pick(['#ffe2a8', '#fff3d6', '#ffd0a0']));
              pools.push(face - side * 1.6, cz, 2.6, 0);
            } else {
              b.box(0.1, 2.2, width - 1.2, face - side * 0.03, 1.2, cz, rng.chance(0.5) ? '#8e9399' : '#5a4636');
            }
            b.box(1.4, 0.12, width - 0.8, face - side * 0.7, 2.9, cz, pick(style.awnings), 0, 0, side * 0.35);
            if (rng.chance(0.85)) {
              const sw = Math.min(width - 1.2, 5.5);
              const sh = Math.min(1.15, sw / 4);
              b.box(0.12, sh + 0.12, sw + 0.12, face - side * 0.04, 3.55 + sh / 2, cz, '#2a2a2e');
              sign(sw, sh, face - side * 0.12, 3.55 + sh / 2, cz, side);
            }
          }
          // Rooftop billboard on a frame.
          if (rng.chance(0.18) && width > 5.5) {
            const bx = cx - side * (depth / 2 - 0.8);
            for (const dz of [-1.8, 1.8]) b.box(0.15, 2.4, 0.15, bx, h + 1.2, cz + dz, '#3d3f44');
            b.box(0.15, 1.6, 6.2, bx + side * 0.05, h + 2.9, cz, '#3d3f44');
            sign(6, 1.5, bx - side * 0.05, h + 2.9, cz, side);
          }
        }
        z += width;
      }
    }

    // Trees: small street trees, or big shady ones that reach over the footpath.
    let tz = rng.range(2, 6);
    while (tz < CHUNK_M - 1) {
      const tx = side * (half + CURB_W + WALK_W - 0.7);
      if (style.bigTrees) {
        b.cylinder(0.32, 4.6, tx, 2.3, -tz, style.trunk, 7);
        b.sway = 1;
        b.blob(2.7, tx - side * 0.8, 6.2, -tz, pick(style.leaf), 0.6);
        b.blob(2.0, tx + side * 0.6, 6.8, -tz + 1.2, pick(style.leaf), 0.65);
        b.blob(1.8, tx - side * 1.8, 5.8, -tz - 1.1, pick(style.leaf), 0.6);
        b.sway = 0;
        tz += rng.range(5, 8);
      } else {
        b.cylinder(0.18, 2.4, tx, 1.3, -tz, style.trunk, 6);
        b.sway = 0.7;
        b.blob(1.5, tx, 3.6, -tz, pick(style.leaf), 0.85);
        b.sway = 1;
        b.blob(1.0, tx - side * 0.6, 4.3, -tz + 0.4, pick(style.leaf), 0.9);
        b.sway = 0;
        tz += rng.range(7, 12);
      }
    }
    // Street lamp, with its head glowing and a pool of light below.
    const lampZ = side < 0 ? 4 : 16;
    const lx = side * (half + CURB_W + 0.3);
    b.cylinder(0.08, 6, lx, 3, -lampZ, '#3d3f44', 6);
    b.box(1.6, 0.1, 0.12, lx - side * 0.8, 5.95, -lampZ, '#3d3f44');
    glow.box(0.5, 0.15, 0.3, lx - side * 1.5, 5.85, -lampZ, '#fff1c4');
    pools.push(lx - side * 1.5, -lampZ, 5.5, 1);

    // Street life on the footpath: parked scooters, people, and in Mumbai, parked taxis.
    let pz = rng.range(1, 4);
    while (pz < CHUNK_M - 1) {
      const px = side * (half + CURB_W + rng.range(0.5, 1.6));
      const r = rng.next();
      if (style.taxis && r < 0.18 && pz < CHUNK_M - 5) {
        parkedTaxi(b, side * (half + CURB_W + 1.1), -pz - 2, side);
        pz += 6;
        continue;
      }
      if (r < 0.55) {
        const col = pick(['#c0392b', '#2c6fb0', '#e8e4d8', '#222428', '#d98e04']);
        b.box(0.45, 0.55, 1.5, px, 0.45, -pz, col, 0, side * 0.3, 0);
        b.box(0.5, 0.08, 0.1, px, 0.95, -pz + 0.55, '#2a2a2e', 0, side * 0.3, 0);
      } else {
        const shirt = pick(['#e05a47', '#3f7fd0', '#f2c230', '#f4f0e6', '#7a4fb3', '#2f9e74']);
        b.box(0.45, 0.8, 0.3, px, 0.6 + 0.4, -pz, '#3b3a45');
        b.box(0.5, 0.65, 0.32, px, 1.4 + 0.32, -pz, shirt);
        b.box(0.26, 0.28, 0.26, px, 2.2, -pz, '#8a5a3c');
        b.box(0.28, 0.08, 0.28, px, 2.37, -pz, '#1e1712');
        // Some carry umbrellas when it rains in Mumbai.
        if (style.taxis && rng.chance(0.5)) {
          b.cylinder(0.75, 0.25, px, 2.75, -pz, pick(['#1c1c20', '#2b4a8a', '#7a1f2b']), 8, 0.05);
        }
      }
      pz += rng.range(2.5, 6);
    }

    // Electric pole with sagging wires that run on to the next block; birds sit on some.
    if (side === (style.flyover ? -1 : 1)) {
      const px = side * (half + CURB_W + WALK_W - 0.25);
      b.cylinder(0.13, 8.6, px, 4.3, -10, '#5b5650', 6, 0.1);
      b.box(0.12, 0.12, 1.6, px, 8.1, -10, '#4a4640', 0, Math.PI / 2, 0);
      for (const off of [-0.65, 0, 0.65]) b.box(0.08, 0.14, 0.08, px + off, 8.25, -10, '#d9d4c8');
      const sag = 0.85;
      for (const off of [-0.65, 0, 0.65]) {
        for (let z0 = 0; z0 < CHUNK_M; z0 += 2) {
          const yAt = (z: number): number => {
            const d = Math.abs(((z - 10 + 36) % 24) - 12);
            const u = 1 - d / 12;
            return 8.2 - sag * (2 * u - u * u) * (1 - Math.abs(off) * 0.2);
          };
          const y0 = yAt(z0);
          const y1 = yAt(z0 + 2);
          b.box(0.03, 0.03, 2.02, px + off, (y0 + y1) / 2, -z0 - 1, '#1c1c1f', Math.atan2(y1 - y0, 2), 0, 0);
          if (off === 0 && z0 % 6 === 2 && rng.chance(0.3)) {
            b.box(0.14, 0.16, 0.24, px, (y0 + y1) / 2 + 0.11, -z0 - 1, '#26262a');
            b.box(0.09, 0.08, 0.1, px, (y0 + y1) / 2 + 0.22, -z0 - 0.9, '#26262a');
          }
        }
      }
    }

    // Flyover under construction: concrete pillars and a deck, half built.
    if (style.flyover && side === 1) {
      const fx = side * (lotX - 0.2);
      for (const pz2 of [4, 16]) {
        b.box(1.4, 8, 1.4, fx, 4, -pz2, '#b7b2aa');
        b.box(3.2, 0.8, 2, fx - side * 0.6, 8.2, -pz2, '#aaa49b');
        // Blue and white construction hoarding around the base.
        for (let i = 0; i < 4; i++) b.box(0.08, 1.8, 0.9, fx - side * 1.2, 0.9, -pz2 - 1.4 + i * 0.95, i % 2 ? '#e9eef2' : '#2d5fa8');
      }
      if (seed % 2 === 0) b.box(4.5, 1.1, CHUNK_M, fx - side * 0.6, 9.1, -CHUNK_M / 2, '#bdb8ae');
    }
  }

  // Festival bunting strung across the road on some blocks; it flutters in the breeze.
  if (rng.chance(0.3)) {
    const bz = -rng.range(6, 18);
    const span = roadW + (CURB_W + 0.4) * 2;
    const n = Math.floor(span / 0.55);
    const cols = ['#e0412c', '#f2c230', '#2f9e74', '#3f7fd0', '#f07a1a', '#d94f9c'];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = -span / 2 + t * span;
      const y = 6.4 - Math.sin(t * Math.PI) * 0.9;
      b.box(0.56, 0.02, 0.02, x, y + 0.02, bz, '#2a2a2e');
      b.sway = 1;
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.22, 0, 0, 0.22, 0, 0, 0, -0.42, 0]), 3));
      tri.computeVertexNormals();
      b.add(tri, cols[i % cols.length]!, x, y, bz);
      const back = tri.clone();
      back.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.22, 0, 0, -0.22, 0, 0, 0, -0.42, 0]), 3));
      back.computeVertexNormals();
      b.add(back, cols[i % cols.length]!, x, y, bz);
      b.sway = 0;
    }
  }

  // Distant hills behind the city.
  if (style.hills) {
    for (const side of [-1, 1] as const) {
      const hx = side * (lotX + rng.range(42, 60));
      const hh = rng.range(14, 26);
      b.cylinder(rng.range(16, 24), hh, hx, hh / 2 - 1, -rng.range(4, 20), pick(['#6f7d52', '#7d8558', '#5f6e4a']), 7, rng.range(2, 6));
    }
  }

  const poolGeo = new THREE.BufferGeometry();
  if (pools.length) {
    const quads = new GeoBuilder();
    for (let i = 0; i < pools.length; i += 4) {
      const r = pools[i + 2]!;
      const g = new THREE.PlaneGeometry(r * 2, r * 2);
      g.rotateX(-Math.PI / 2);
      quads.add(g, pools[i + 3] ? '#ffcf8a' : '#ffb36b', pools[i]!, 0.2, pools[i + 1]!);
    }
    return { main: b.build(), glow: glow.build(), pools: quads.build(), signs: signs.build() };
  }
  return { main: b.build(), glow: glow.build(), pools: poolGeo, signs: signs.build() };
}

/** Thane-style lakefront: a promenade railing, benches, and water out to the hills. */
function buildLakeside(b: GeoBuilder, glow: GeoBuilder, rng: Rng, style: CityStyle, lotX: number, pools: number[]): void {
  const side = -1;
  b.box(1.4, 0.16, CHUNK_M, side * (lotX + 0.7), 0.08, -CHUNK_M / 2, style.footpath);
  b.box(60, 0.02, CHUNK_M, side * (lotX + 31.4), -0.25, -CHUNK_M / 2, '#4f8597');
  // Low stone edge, then railing posts every 2 m.
  b.box(0.35, 0.5, CHUNK_M, side * (lotX + 1.55), 0.25, -CHUNK_M / 2, '#c9c1ad');
  for (let z = 1; z < CHUNK_M; z += 2) b.box(0.08, 0.9, 0.08, side * (lotX + 1.55), 0.95, -z, '#3d3f44');
  b.box(0.06, 0.06, CHUNK_M, side * (lotX + 1.55), 1.35, -CHUNK_M / 2, '#3d3f44');
  // Benches and a few people looking at the water.
  for (const bz of [6, 18]) {
    b.box(0.5, 0.1, 1.6, side * (lotX + 0.9), 0.55, -bz, '#7a5a3c');
    b.box(0.1, 0.5, 1.6, side * (lotX + 1.1), 0.8, -bz, '#7a5a3c');
    if (rng.chance(0.6)) {
      b.box(0.45, 0.6, 0.32, side * (lotX + 0.9), 1.0, -bz + 0.3, pick(rng, ['#e05a47', '#3f7fd0', '#f2c230']));
      b.box(0.26, 0.28, 0.26, side * (lotX + 0.9), 1.48, -bz + 0.3, '#8a5a3c');
    }
  }
  // A small temple shrine on some lakefronts.
  if (rng.chance(0.3)) {
    const tx = side * (lotX + 8);
    b.box(3, 0.6, 3, tx, -0.0, -12, '#d9cfb8');
    b.box(2, 2.2, 2, tx, 1.4, -12, '#f1e7cf');
    b.cylinder(1.2, 2.2, tx, 3.6, -12, '#e8893a', 6, 0.1);
    glow.box(0.6, 1.2, 0.05, tx + 0.0, 1.2, -10.98, '#ffcf7a');
    pools.push(tx, -10.5, 2.2, 0);
  }
  void style;
}

function pick<T>(rng: Rng, arr: T[]): T {
  return arr[rng.int(0, arr.length)]!;
}

/** Road surface texture for one block: worn asphalt, patches, lane dashes, edge lines. */
export function roadTexture(laneCount: number, roadW: number, zebra: boolean, seed: number): HTMLCanvasElement {
  const pxPerM = 28;
  const c = document.createElement('canvas');
  c.width = Math.round(roadW * pxPerM);
  c.height = Math.round(CHUNK_M * pxPerM);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  const rng = new Rng(seed);
  const m = (v: number): number => v * pxPerM;
  ctx.fillStyle = '#4a4b51';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000 * (roadW / 9); i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(rng.range(0, c.width), rng.range(0, c.height), 1.5, 1.5);
  }
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = 'rgba(25,25,30,0.3)';
    ctx.fillRect(rng.range(0, c.width - m(3)), rng.range(0, c.height - m(3)), m(rng.range(1.2, 3.2)), m(rng.range(1, 3)));
  }
  const laneW = roadW / laneCount;
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
  // A manhole cover now and then.
  if (rng.chance(0.6)) {
    const mx = m(rng.range(1, roadW - 1));
    const my = rng.range(m(2), c.height - m(2));
    ctx.fillStyle = '#2e2f33';
    ctx.beginPath();
    ctx.arc(mx, my, m(0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    for (let r = 0.12; r < 0.4; r += 0.1) {
      ctx.beginPath();
      ctx.arc(mx, my, m(r), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Tyre-darkened tar seams and oil spots.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(15,15,18,0.18)';
    ctx.beginPath();
    ctx.ellipse(rng.range(0, c.width), rng.range(0, c.height), m(rng.range(0.2, 0.5)), m(rng.range(0.15, 0.3)), rng.range(0, 3), 0, Math.PI * 2);
    ctx.fill();
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

/** Soft round light for the night light pools. */
export function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
