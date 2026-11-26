import * as THREE from 'three';
import { Rng } from '../core/rng';
import { ALL_KINDS, ObstacleKind, OBSTACLES } from '../data/obstacles';
import { GeoBuilder } from './geo';

/**
 * Low-poly obstacles and roadside vehicles, each built as one vertex-coloured geometry.
 * Vehicles point their nose to -z (the way the player drives) unless `dir` is +1.
 */

const TYRE = '#18181b';
const HUB = '#9aa0a8';
const GLASS = '#2f4458';
const HEAD = '#fff3c4';
const TAIL = '#d8321f';

function wheel(b: GeoBuilder, x: number, y: number, z: number, r: number, w: number): void {
  b.add(new THREE.CylinderGeometry(r, r, w, 12), TYRE, x, y, z, 0, 0, Math.PI / 2);
  b.add(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.02, 8), HUB, x, y, z, 0, 0, Math.PI / 2);
}

/** A hatchback-sized car. With `taxi`, Mumbai's black body and yellow top. */
export function car(b: GeoBuilder, x: number, z: number, body: string, dir: -1 | 1 = -1, taxi = false): void {
  const f = dir; // front is at z + f * 2
  const top = taxi ? '#f3c316' : body;
  const lower = taxi ? '#1d1d21' : body;
  b.box(1.76, 0.62, 3.9, x, 0.62, z, lower);
  b.box(1.78, 0.08, 3.94, x, 0.95, z, shade(lower, 0.85));
  // Cabin, a little back from the centre, with glass all round.
  b.box(1.56, 0.58, 2.0, x, 1.27, z - f * 0.25, top);
  b.box(1.6, 0.42, 0.06, x, 1.24, z + f * 0.78, GLASS, -f * 0.5);
  b.box(1.6, 0.42, 0.06, x, 1.24, z - f * 1.28, GLASS, f * 0.5);
  for (const s of [-1, 1]) b.box(0.04, 0.36, 1.7, x + s * 0.79, 1.27, z - f * 0.25, GLASS);
  // Lights and bumpers.
  for (const s of [-1, 1]) {
    b.box(0.34, 0.14, 0.05, x + s * 0.6, 0.78, z + f * 1.96, HEAD);
    b.box(0.3, 0.14, 0.05, x + s * 0.62, 0.8, z - f * 1.96, TAIL);
  }
  b.box(1.8, 0.16, 0.12, x, 0.42, z + f * 1.98, '#2a2a2e');
  b.box(1.8, 0.16, 0.12, x, 0.42, z - f * 1.98, '#2a2a2e');
  if (taxi) b.box(0.6, 0.18, 0.28, x, 1.65, z - f * 0.25, '#f3c316');
  for (const s of [-1, 1]) for (const zz of [1.25, -1.25]) wheel(b, x + s * 0.8, 0.33, z + zz, 0.33, 0.22);
}

export function parkedTaxi(b: GeoBuilder, x: number, z: number, side: number): void {
  car(b, x, z, '#1d1d21', side < 0 ? -1 : 1, true);
}

/** Red city bus, 9 m long. */
function bus(b: GeoBuilder, variant: number): void {
  const red = variant === 0 ? '#c8281f' : '#b5361d';
  b.box(2.45, 2.5, 8.9, 0, 1.65, 0, red);
  b.box(2.47, 0.35, 8.92, 0, 0.55, 0, '#3a3a3e');
  b.box(2.5, 0.2, 8.95, 0, 1.55, 0, '#f2efe6');
  // Window band down both sides, windscreen and the route board.
  for (const s of [-1, 1]) b.box(0.05, 0.9, 7.6, s * 1.23, 2.25, 0.3, GLASS);
  b.box(2.2, 1.2, 0.06, 0, 2.15, -4.47, GLASS);
  b.box(1.6, 0.3, 0.06, 0, 2.95, -4.47, '#ffb020');
  b.box(2.3, 0.25, 0.06, 0, 2.95, 4.47, '#1d1d21');
  b.box(2.0, 0.6, 0.06, 0, 2.2, 4.47, GLASS);
  for (const s of [-1, 1]) {
    b.box(0.3, 0.18, 0.06, s * 0.9, 0.9, -4.48, HEAD);
    b.box(0.25, 0.3, 0.06, s * 1.0, 1.0, 4.48, TAIL);
  }
  b.box(2.3, 0.15, 7.5, 0, 2.95, 0.3, '#d4d0c6');
  for (const s of [-1, 1]) for (const zz of [-3, 2.6]) wheel(b, s * 1.05, 0.5, zz, 0.5, 0.35);
}

/** Motorbike with a rider in a helmet. */
function motorbike(b: GeoBuilder, dir: -1 | 1, shirt: string, bike: string, box: string | null): void {
  const f = dir;
  wheel(b, 0, 0.32, f * 0.68, 0.32, 0.12);
  wheel(b, 0, 0.32, -f * 0.62, 0.32, 0.14);
  b.box(0.32, 0.36, 1.1, 0, 0.62, 0, bike);
  b.box(0.36, 0.14, 0.7, 0, 0.86, -f * 0.15, '#1c1c20');
  b.box(0.08, 0.7, 0.08, 0, 0.85, f * 0.62, '#2a2a2e', f * 0.35);
  b.box(0.7, 0.05, 0.05, 0, 1.18, f * 0.5, '#2a2a2e');
  b.box(0.16, 0.12, 0.06, 0, 0.95, f * 0.78, HEAD);
  // Rider.
  b.box(0.42, 0.62, 0.3, 0, 1.3, -f * 0.1, shirt, -f * 0.25);
  b.box(0.36, 0.3, 0.5, 0, 0.98, -f * 0.18, '#2c3140');
  for (const s of [-1, 1]) b.box(0.1, 0.1, 0.5, s * 0.24, 1.32, f * 0.2, shirt, f * 0.6);
  b.blob(0.2, 0, 1.78, -f * 0.05, '#2a2c33', 1.05);
  b.box(0.3, 0.1, 0.05, 0, 1.78, f * 0.14, '#7aa4c8');
  if (box) {
    b.box(0.55, 0.5, 0.5, 0, 1.15, -f * 0.62, box);
    b.box(0.57, 0.08, 0.52, 0, 1.42, -f * 0.62, shade(box, 0.75));
  }
}

function cow(b: GeoBuilder, variant: number): void {
  const coat = ['#ecebe6', '#b48a5f', '#8f8d88'][variant] ?? '#ecebe6';
  const dark = shade(coat, 0.7);
  b.box(0.85, 0.85, 1.7, 0, 1.15, 0, coat);
  b.box(0.6, 0.35, 0.5, 0, 1.68, -0.55, coat);
  b.box(0.5, 0.45, 0.6, 0, 1.35, -1.08, coat, 0.35);
  b.box(0.36, 0.22, 0.28, 0, 1.18, -1.38, '#d9b4a2');
  for (const s of [-1, 1]) {
    b.box(0.06, 0.28, 0.06, s * 0.2, 1.72, -1.05, '#e4d9c2', 0, 0, s * 0.5);
    b.box(0.22, 0.08, 0.12, s * 0.33, 1.52, -1.0, dark);
  }
  for (const [sx, sz] of [[-0.28, -0.6], [0.28, -0.6], [-0.28, 0.62], [0.28, 0.62]] as const) b.box(0.16, 0.78, 0.16, sx, 0.39, sz, dark);
  b.box(0.05, 0.6, 0.05, 0, 1.05, 0.87, dark, -0.2);
  if (variant === 0) b.box(0.87, 0.3, 0.5, 0, 1.25, 0.3, '#3a3632');
}

function handcart(b: GeoBuilder, variant: number): void {
  b.box(1.3, 0.12, 1.9, 0, 0.85, 0, '#8a6038');
  for (const s of [-1, 1]) b.box(0.08, 0.2, 1.9, s * 0.65, 0.97, 0, '#6d4a2b');
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 14), '#5a3d24', s * 0.72, 0.55, 0.15, 0, 0, Math.PI / 2);
  b.box(0.06, 0.06, 1.0, -0.3, 0.8, -1.4, '#6d4a2b');
  b.box(0.06, 0.06, 1.0, 0.3, 0.8, -1.4, '#6d4a2b');
  b.box(0.1, 0.75, 0.1, 0, 0.45, 0.9, '#6d4a2b');
  const loads = [['#e0412c', '#f08a24', '#e0412c'], ['#4f9a3a', '#7cbc4a', '#3f7d32'], ['#f2c230', '#e8a020', '#f6d84a']][variant]!;
  const rng = new Rng(variant + 9);
  for (let i = 0; i < 14; i++) {
    b.blob(0.17, rng.range(-0.45, 0.45), 1.05 + rng.range(0, 0.2), rng.range(-0.75, 0.75), loads[i % 3]!, 0.9);
  }
  // Canvas shade on a pole.
  b.box(0.05, 1.4, 0.05, 0.5, 1.6, 0.7, '#3a3632');
  b.box(1.2, 0.05, 1.1, 0.2, 2.3, 0.4, variant === 1 ? '#2e6fb7' : '#d8432f', 0.15);
}

function barricade(b: GeoBuilder, variant: number): void {
  const a = variant === 0 ? '#2d5fa8' : '#f07a1a';
  for (const s of [-1, 1]) {
    b.box(0.08, 1.1, 0.5, s * 1.05, 0.55, 0, '#3a3a3e', 0.35);
    b.box(0.08, 1.1, 0.5, s * 1.05, 0.55, 0, '#3a3a3e', -0.35);
  }
  for (let i = 0; i < 8; i++) {
    b.box(0.28, 0.32, 0.06, -0.98 + i * 0.28, 0.95, 0, i % 2 ? '#f4f2ee' : a);
    b.box(0.28, 0.2, 0.06, -0.98 + i * 0.28, 0.55, 0, i % 2 ? a : '#f4f2ee');
  }
  b.box(0.18, 0.18, 0.18, -1.05, 1.22, 0, '#ff5a1f');
}

function puddle(b: GeoBuilder, variant: number): void {
  const rng = new Rng(500 + variant);
  const shape = (rx: number, rz: number, y: number, col: string): void => {
    const s = new THREE.Shape();
    const n = 16;
    const pts = Array.from({ length: n }, () => rng.range(0.82, 1));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * rx * pts[i]!;
      const z = Math.sin(a) * rz * pts[i]!;
      if (i === 0) s.moveTo(x, z);
      else s.lineTo(x, z);
    }
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    b.add(g, col, 0, y, 0);
  };
  shape(1.15, 0.95, 0.012, '#5b5246');
  shape(1.0, 0.82, 0.02, '#6f8796');
  shape(0.55, 0.42, 0.026, '#91a9b6');
  shape(0.32, 0.22, 0.03, '#2b2722');
}

/** Flat irregular blob on the road, as one shape. `pts` sets the wobble of the edge. */
function flatBlob(b: GeoBuilder, rx: number, rz: number, pts: number[], y: number, col: string, ox = 0, oz = 0): void {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx * pts[i]! + ox;
    const z = Math.sin(a) * rz * pts[i]! + oz;
    if (i === 0) s.moveTo(x, -z);
    else s.lineTo(x, -z);
  }
  const g = new THREE.ShapeGeometry(s);
  // Lay it flat facing up; shape y was flipped above so `oz` and `z` keep their road meaning.
  g.rotateX(-Math.PI / 2);
  b.add(g, col, 0, y, 0);
}

/**
 * A pothole: a ragged rim of broken asphalt, a sunlit far wall, a dark floor, loose gravel,
 * hairline cracks running out from it, and sometimes muddy water at the bottom.
 */
function pothole(b: GeoBuilder, large: boolean, variant: number): void {
  const def = OBSTACLES[large ? ObstacleKind.LargePothole : ObstacleKind.SmallPothole];
  const rng = new Rng(900 + variant * 31 + (large ? 7 : 0));
  const scale = rng.range(0.86, 1);
  const rx = (def.w / 2) * scale * (large ? 0.92 : 1);
  const rz = (def.h / 2) * scale;
  const n = 26;
  // Edge noise: a few big lumps plus small chips, so no two holes match.
  const lumps = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  const edge = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return 0.86 + 0.08 * Math.sin(a * 2 + lumps[0]!) + 0.05 * Math.sin(a * 3 + lumps[1]!) + rng.range(-0.06, 0.06);
  });
  const chips = edge.map((e) => e + rng.range(0.04, 0.2));
  // Cracked, lighter asphalt around the hole, then the broken lip.
  flatBlob(b, rx * 1.25, rz * 1.32, chips.map((c) => c + rng.range(-0.05, 0.08)), 0.008, '#525358');
  flatBlob(b, rx * 1.08, rz * 1.1, chips, 0.012, '#66645f');
  // The hole: far wall catches light, floor is dark, near wall falls into shadow.
  flatBlob(b, rx, rz, edge, 0.016, '#5d5145');
  flatBlob(b, rx * 0.93, rz * 0.84, edge, 0.02, '#342c25', 0, rz * 0.1);
  flatBlob(b, rx * 0.78, rz * 0.62, edge, 0.024, '#211b16', 0, rz * 0.2);
  if (rng.chance(large ? 0.6 : 0.35)) {
    flatBlob(b, rx * 0.55, rz * 0.38, edge.map((e) => e * rng.range(0.85, 1.05)), 0.028, '#5f6a6e', rng.range(-0.1, 0.1), rz * 0.25);
    flatBlob(b, rx * 0.3, rz * 0.16, edge, 0.031, '#8f9ea3', rng.range(-0.1, 0.1), rz * 0.18);
  }
  // Loose gravel and chunks of broken road around the rim.
  const bits = large ? 16 : 9;
  for (let i = 0; i < bits; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0.7, 1.4);
    const sz = rng.range(0.05, large ? 0.2 : 0.14);
    b.box(sz, sz * 0.5, sz * rng.range(0.7, 1.3), Math.cos(a) * rx * d, sz * 0.25, Math.sin(a) * rz * d, rng.chance(0.5) ? '#77746e' : '#4c4a47', 0, rng.range(0, 3), 0);
  }
  // Hairline cracks running out from the edge.
  const cracks = rng.int(3, large ? 7 : 5);
  for (let i = 0; i < cracks; i++) {
    let a = rng.range(0, Math.PI * 2);
    let x = Math.cos(a) * rx * 0.95;
    let z = Math.sin(a) * rz * 0.95;
    const segs = rng.int(2, 4);
    for (let k = 0; k < segs; k++) {
      a += rng.range(-0.6, 0.6);
      const len = rng.range(0.18, large ? 0.5 : 0.3);
      const nx = x + Math.cos(a) * len;
      const nz = z + Math.sin(a) * len;
      const g = new THREE.PlaneGeometry(0.035, len);
      g.rotateX(-Math.PI / 2);
      g.rotateY(-Math.atan2(nz - z, nx - x) + Math.PI / 2);
      b.add(g, '#26272b', (x + nx) / 2, 0.01, (z + nz) / 2);
      x = nx;
      z = nz;
    }
  }
}

function speedBreaker(b: GeoBuilder, roadW: number): void {
  const n = Math.round(roadW / 0.75);
  const w = roadW / n;
  for (let i = 0; i < n; i++) {
    const x = -roadW / 2 + (i + 0.5) * w;
    b.box(w, 0.13, 0.9, x, 0.065, 0, i % 2 ? '#f2c230' : '#1d1d21');
    b.box(w, 0.06, 0.5, x, 0.16, 0, i % 2 ? '#f2c230' : '#1d1d21');
  }
}

const CAR_COLOURS = ['#c9ccd2', '#9a2b2b', '#2b4a8a', '#e8e4da', '#3c3f45'];
const SHIRTS = ['#e05a47', '#3f7fd0', '#f2c230', '#2f9e74', '#7a4fb3'];
const BIKES = ['#b8262b', '#202226', '#2c5c9e', '#d8d4cc'];
const DELIVERY = ['#f07a1a', '#2f9e74', '#d8432f'];

/** One geometry per obstacle kind and variant. Potholes are drawn separately and get an empty slot. */
export function buildObstacleGeos(roadW: number): THREE.BufferGeometry[][] {
  const out: THREE.BufferGeometry[][] = [];
  for (const kind of ALL_KINDS) {
    const list: THREE.BufferGeometry[] = [];
    for (let v = 0; v < OBSTACLES[kind].variants; v++) {
      const b = new GeoBuilder();
      switch (kind) {
        case ObstacleKind.SmallPothole: pothole(b, false, v); break;
        case ObstacleKind.LargePothole: pothole(b, true, v); break;
        case ObstacleKind.Puddle: puddle(b, v); break;
        case ObstacleKind.Cow: cow(b, v); break;
        case ObstacleKind.Handcart: handcart(b, v); break;
        case ObstacleKind.SpeedBreaker: speedBreaker(b, roadW); break;
        case ObstacleKind.Barricade: barricade(b, v); break;
        case ObstacleKind.Biker: motorbike(b, 1, SHIRTS[v % SHIRTS.length]!, BIKES[v % BIKES.length]!, null); break;
        case ObstacleKind.Bus: bus(b, v); break;
        case ObstacleKind.Taxi: car(b, 0, 0, '#1d1d21', -1, true); break;
        case ObstacleKind.DeliveryBike: motorbike(b, -1, SHIRTS[(v + 2) % SHIRTS.length]!, '#2a2c30', DELIVERY[v % DELIVERY.length]!); break;
        case ObstacleKind.StoppedCar: car(b, 0, 0, CAR_COLOURS[v % CAR_COLOURS.length]!, -1, false); break;
        default: break;
      }
      list.push(b.build());
    }
    out[kind] = list;
  }
  return out;
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}
