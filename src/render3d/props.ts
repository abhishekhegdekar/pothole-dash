import * as THREE from 'three';
import { Rng } from '../core/rng';
import { ALL_KINDS, ObstacleKind, OBSTACLES } from '../data/obstacles';
import { GeoBuilder } from './geo';
import { kaaliPeeli, roundedBox, shapedCar, type CarStyle } from './cars';

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

/** A car in traffic. With `taxi`, Mumbai's black-and-yellow taxi. */
export function car(b: GeoBuilder, x: number, z: number, body: string, dir: -1 | 1 = -1, taxi = false, len = 3.9, roofSign: string | null = null, style: CarStyle = 'sedan'): void {
  if (taxi) {
    kaaliPeeli(b, x, z, dir);
    return;
  }
  shapedCar(b, x, z, { style, len, body, dir, roofSign });
}

export function parkedTaxi(b: GeoBuilder, x: number, z: number, side: number): void {
  car(b, x, z, '#1d1d21', side < 0 ? -1 : 1, true);
}

/** Red city bus, 9 m long. */
function bus(b: GeoBuilder, variant: number): void {
  const red = variant === 0 ? '#c8281f' : '#b5361d';
  roundedBox(b, 2.45, 2.5, 8.9, 0, 1.65, 0, red, 0.2);
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

/** New York steam stack: an orange-and-white striped chimney over a manhole. */
function steamVent(b: GeoBuilder, variant: number): void {
  b.cylinder(0.62, 0.04, 0, 0.02, 0, '#2e2f33', 16);
  b.cylinder(0.5, 0.05, 0, 0.04, 0, '#3e4045', 16);
  const h = variant === 0 ? 1.6 : 1.2;
  for (let i = 0; i < 5; i++) {
    const r0 = 0.36 - i * 0.025;
    b.cylinder(r0, h / 5, 0, (i + 0.5) * (h / 5), 0, i % 2 ? '#f4f2ee' : '#f07a1a', 12, r0 - 0.025);
  }
}

function deliveryTruck(b: GeoBuilder, variant: number): void {
  const box = ['#f4f2ee', '#d9d4c8', '#c9d6df'][variant]!;
  const cab = ['#2b4a8a', '#c8281f', '#3a3a3e'][variant]!;
  roundedBox(b, 2.3, 2.6, 4.6, 0, 1.75, 0.9, box, 0.08);
  roundedBox(b, 2.2, 1.9, 1.7, 0, 1.4, -2.3, cab, 0.18);
  b.box(2.0, 0.8, 0.06, 0, 1.85, -3.16, GLASS);
  b.box(2.3, 0.4, 6.4, 0, 0.45, -0.1, '#2a2a2e');
  for (const s of [-1, 1]) {
    b.box(0.3, 0.16, 0.05, s * 0.85, 0.9, -3.18, HEAD);
    b.box(0.2, 0.3, 0.05, s * 1.0, 0.9, 3.22, TAIL);
    b.box(0.05, 0.6, 0.6, s * 1.16, 1.9, 0.9, cab);
  }
  // Hazard lights on: it is double-parked.
  b.box(0.18, 0.12, 0.05, -0.85, 1.2, 3.22, '#ffb020');
  for (const s of [-1, 1]) for (const zz of [-2.3, 1.6, 2.5]) wheel(b, s * 1.0, 0.45, zz, 0.45, 0.3);
}

function person(b: GeoBuilder, x: number, z: number, shirt: string, legs: string, facing: number, phone: boolean): void {
  b.box(0.18, 0.8, 0.2, x - 0.12, 0.4, z, legs);
  b.box(0.18, 0.8, 0.2, x + 0.12, 0.4, z + facing * 0.12, legs);
  b.box(0.5, 0.66, 0.3, x, 1.13, z, shirt);
  b.box(0.26, 0.28, 0.26, x, 1.62, z, '#c28e6a');
  b.box(0.28, 0.1, 0.28, x, 1.8, z, '#2a1d14');
  if (phone) {
    b.box(0.1, 0.12, 0.3, x + 0.2, 1.35, z - facing * 0.18, shirt, -0.6);
    b.box(0.08, 0.14, 0.02, x + 0.2, 1.47, z - facing * 0.32, '#9ad0ff');
  } else {
    for (const s of [-1, 1]) b.box(0.12, 0.6, 0.14, x + s * 0.32, 1.1, z, shirt);
  }
}

function jaywalker(b: GeoBuilder, variant: number): void {
  const shirts = ['#c8281f', '#2b4a8a', '#e8e4da', '#2f9e74'];
  person(b, 0, 0, shirts[variant]!, '#2c3140', variant % 2 ? 1 : -1, variant % 2 === 0);
  if (variant === 3) b.blob(0.18, 0.3, 1.5, 0, '#7a1f2b', 1);
}

function doubleDecker(b: GeoBuilder): void {
  const red = '#c8281f';
  roundedBox(b, 2.5, 4.2, 9.8, 0, 2.4, 0, red, 0.22);
  b.box(2.52, 0.3, 9.82, 0, 0.45, 0, '#2a2a2e');
  for (const s of [-1, 1]) {
    b.box(0.05, 0.9, 8.6, s * 1.26, 1.9, 0.3, GLASS);
    b.box(0.05, 0.9, 9.0, s * 1.26, 3.65, 0.1, GLASS);
  }
  b.box(2.2, 1.0, 0.06, 0, 1.9, -4.92, GLASS);
  b.box(2.2, 0.9, 0.06, 0, 3.65, -4.92, GLASS);
  b.box(1.6, 0.3, 0.06, 0, 4.25, -4.92, '#ffb020');
  b.box(2.52, 0.12, 9.82, 0, 4.55, 0, '#a52019');
  for (const s of [-1, 1]) {
    b.box(0.3, 0.18, 0.06, s * 0.9, 0.85, -4.93, HEAD);
    b.box(0.25, 0.35, 0.06, s * 1.0, 1.0, 4.93, TAIL);
  }
  for (const s of [-1, 1]) for (const zz of [-3.4, 3.0]) wheel(b, s * 1.05, 0.5, zz, 0.5, 0.35);
}

/** Bicycle with a rider; same way as the player. */
function cyclist(b: GeoBuilder, variant: number): void {
  const frame = ['#2f9e74', '#c8281f', '#202226', '#3f7fd0'][variant]!;
  const jacket = ['#f2c230', '#e8e4da', '#3f7fd0', '#f07a1a'][variant]!;
  for (const zz of [-0.55, 0.55]) b.add(new THREE.TorusGeometry(0.33, 0.035, 6, 16), '#18181b', 0, 0.36, zz, 0, Math.PI / 2, 0);
  b.box(0.05, 0.05, 1.1, 0, 0.6, 0, frame, 0.25);
  b.box(0.05, 0.55, 0.05, 0, 0.62, 0.15, frame);
  b.box(0.5, 0.04, 0.04, 0, 1.0, -0.5, '#2a2a2e');
  b.box(0.36, 0.6, 0.28, 0, 1.25, 0.05, jacket, 0.45);
  b.box(0.3, 0.35, 0.45, 0, 0.92, 0.1, '#2c3140');
  b.blob(0.18, 0, 1.68, -0.15, '#f4f2ee', 0.9);
  for (const s of [-1, 1]) b.box(0.09, 0.09, 0.5, s * 0.2, 1.2, -0.3, jacket, 0.6);
}

/** Cones, a red-and-white barrier and a dug-up patch of road. */
function roadworks(b: GeoBuilder, variant: number): void {
  b.box(2.0, 0.02, 1.6, 0, 0.012, 0, '#5a4a3a');
  b.box(1.2, 0.03, 0.8, 0.2, 0.02, 0.1, '#3a2e24');
  for (const [cx, cz] of [[-1.05, -0.95], [1.05, -0.95], [-1.05, 0.95], [1.05, 0.95]] as const) {
    b.cylinder(0.2, 0.7, cx, 0.36, cz, '#f07a1a', 10, 0.04);
    b.cylinder(0.14, 0.12, cx, 0.42, cz, '#f4f2ee', 10, 0.12);
    b.box(0.42, 0.05, 0.42, cx, 0.025, cz, '#2a2a2e');
  }
  const bar = variant === 0 ? '#c8281f' : '#f07a1a';
  for (let i = 0; i < 7; i++) b.box(0.3, 0.22, 0.05, -0.9 + i * 0.3, 0.85, -1.0, i % 2 ? '#f4f2ee' : bar);
  for (const s of [-1, 1]) b.box(0.06, 0.9, 0.06, s * 0.95, 0.45, -1.0, '#3a3a3e');
  b.box(0.2, 0.15, 0.2, 0.95, 1.0, -1.0, '#ffb020');
}

const CAR_COLOURS = ['#c9ccd2', '#9a2b2b', '#2b4a8a', '#e8e4da', '#3c3f45'];
const SHIRTS = ['#e05a47', '#3f7fd0', '#f2c230', '#2f9e74', '#7a4fb3'];
const BIKES = ['#b8262b', '#202226', '#2c5c9e', '#d8d4cc'];
const DELIVERY = ['#f07a1a', '#2f9e74', '#d8432f'];

/** One geometry per obstacle kind and variant. Potholes are drawn separately and get an empty slot. */
const ZOMBIE_SKIN = ['#8fa08a', '#9aa58f', '#7f927f', '#a3a894'];
const ZOMBIE_SHIRTS = ['#5a6470', '#7a5a4a', '#4f5f4a', '#8a8070', '#6a4a5a', '#4a5468'];

/**
 * A shambling zombie: hunched, head tilted, arms reaching toward the player (+z).
 * Torn, faded clothes and grey-green skin. No blood.
 */
function zombie(b: GeoBuilder, x: number, z: number, v: number): void {
  const skin = ZOMBIE_SKIN[v % ZOMBIE_SKIN.length]!;
  const shirt = ZOMBIE_SHIRTS[v % ZOMBIE_SHIRTS.length]!;
  const legs = v % 3 === 0 ? '#2c3140' : v % 3 === 1 ? '#4a4038' : '#3a3a3e';
  const lean = 0.22 + (v % 3) * 0.06;
  // Legs mid-stagger.
  b.box(0.18, 0.82, 0.2, x - 0.12, 0.41, z - 0.06, legs, 0.12);
  b.box(0.18, 0.82, 0.2, x + 0.12, 0.41, z + 0.1, legs, -0.18);
  b.box(0.2, 0.08, 0.3, x - 0.12, 0.04, z - 0.02, '#26221e');
  // Hunched torso with a torn hem.
  b.box(0.5, 0.64, 0.3, x, 1.12, z + 0.06, shirt, lean);
  b.box(0.18, 0.14, 0.04, x + 0.12, 0.84, z + 0.2, shade(shirt, 0.7), 0.3);
  b.box(0.12, 0.18, 0.04, x - 0.14, 0.86, z + 0.18, shade(shirt, 0.8), -0.2);
  // Head drooping to one side.
  b.box(0.27, 0.29, 0.27, x + (v % 2 ? 0.05 : -0.05), 1.56, z + 0.18, skin, 0.25, 0, v % 2 ? 0.25 : -0.25);
  b.box(0.29, 0.08, 0.29, x + (v % 2 ? 0.07 : -0.07), 1.72, z + 0.16, '#3a3028', 0.25, 0, v % 2 ? 0.25 : -0.25);
  b.box(0.18, 0.04, 0.02, x, 1.58, z + 0.32, '#2a2a24', 0.25);
  // Arms reaching forward, one higher than the other.
  b.box(0.12, 0.12, 0.62, x - 0.31, 1.28, z + 0.36, shirt, -0.15 - (v % 2) * 0.15);
  b.box(0.12, 0.12, 0.62, x + 0.31, 1.22, z + 0.36, shirt, 0.05);
  b.box(0.11, 0.1, 0.16, x - 0.31, 1.34 + (v % 2) * 0.1, z + 0.72, skin);
  b.box(0.11, 0.1, 0.16, x + 0.31, 1.2, z + 0.72, skin);
}

function horde(b: GeoBuilder, v: number): void {
  zombie(b, -1.15, 0.15, v);
  zombie(b, 0.05, -0.3, v + 2);
  zombie(b, 1.15, 0.25, v + 4);
}

/** Burnt-out car: scorched paint, rust, broken glass, a flat tyre. */
function wreck(b: GeoBuilder, v: number): void {
  const paint = ['#3a3430', '#4a3a2e', '#33383c'][v]!;
  b.box(1.8, 0.6, 4.0, 0, 0.55, 0, paint, 0, 0, v === 1 ? 0.06 : -0.04);
  b.box(1.6, 0.55, 2.1, 0, 1.12, 0.2, shade(paint, 0.85), 0, 0, v === 1 ? 0.06 : -0.04);
  b.box(1.5, 0.45, 0.05, 0, 1.12, -0.86, '#1a1a1c', 0.4);
  for (const s of [-1, 1]) b.box(0.05, 0.4, 1.8, s * 0.81, 1.13, 0.2, '#1c1c1e');
  // Rust and scorch patches.
  b.box(0.7, 0.04, 0.9, 0.3, 0.87, -1.3, '#7a3f22');
  b.box(0.5, 0.04, 0.6, -0.4, 1.41, 0.5, '#6b3a20');
  b.box(0.9, 0.05, 0.5, -0.2, 0.86, 1.5, '#1e1a18');
  // Crumpled bonnet up at an angle.
  b.box(1.6, 0.06, 1.0, 0, 0.98, -1.55, shade(paint, 1.1), -0.35);
  for (const sx of [-1, 1]) for (const zz of [1.3, -1.3]) {
    const flat = sx === 1 && zz > 0;
    wheel(b, sx * 0.82, flat ? 0.26 : 0.34, zz, 0.34, 0.24);
  }
  if (v === 2) b.box(0.4, 0.3, 0.4, -1.2, 0.15, 1.6, '#5a5048');
}

/** A red jerrycan: the fuel pickup in Story Mode. */
export function fuelCanGeo(): THREE.BufferGeometry {
  const b = new GeoBuilder();
  b.box(0.62, 0.78, 0.3, 0, 0, 0, '#c8281f');
  b.box(0.64, 0.06, 0.32, 0, -0.2, 0, '#9a1d16');
  b.box(0.64, 0.06, 0.32, 0, 0.16, 0, '#9a1d16');
  b.box(0.36, 0.1, 0.12, -0.08, 0.46, 0, '#2a2a2e');
  b.cylinder(0.07, 0.16, 0.2, 0.46, 0, '#e8c33a', 8);
  return b.build();
}

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
        case ObstacleKind.StoppedCar: car(b, 0, 0, CAR_COLOURS[v % CAR_COLOURS.length]!, -1, false, v % 2 ? 3.7 : 4.1, null, v % 2 ? 'hatch' : 'sedan'); break;
        case ObstacleKind.SteamVent: steamVent(b, v); break;
        case ObstacleKind.DeliveryTruck: deliveryTruck(b, v); break;
        case ObstacleKind.Jaywalker: jaywalker(b, v); break;
        case ObstacleKind.YellowCab: car(b, 0, 0, v ? '#f2b705' : '#f6c21a', -1, false, 4.6, '#f4f2ee'); break;
        case ObstacleKind.Cyclist: cyclist(b, v); break;
        case ObstacleKind.DoubleDecker: doubleDecker(b); break;
        case ObstacleKind.Roadworks: roadworks(b, v); break;
        case ObstacleKind.BlackCab: shapedCar(b, 0, 0, { style: 'london', len: 4.4, body: '#141416', roofSign: '#ffb020', vintage: true }); break;
        case ObstacleKind.Zombie: zombie(b, 0, 0, v); break;
        case ObstacleKind.Horde: horde(b, v); break;
        case ObstacleKind.Wreck: wreck(b, v); break;
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

/** Player vehicles other than the auto, as one geometry each (nose to -z, wheels on y = 0). */
export function playerVehicleGeo(id: string): THREE.BufferGeometry {
  const b = new GeoBuilder();
  switch (id) {
    case 'scooter': {
      wheel(b, 0, 0.26, -0.62, 0.26, 0.12);
      wheel(b, 0, 0.26, 0.58, 0.26, 0.14);
      b.box(0.5, 0.42, 0.9, 0, 0.55, 0.25, '#3fa7c9');
      b.box(0.44, 0.12, 0.6, 0, 0.83, 0.28, '#1c1c20');
      b.box(0.36, 0.7, 0.2, 0, 0.7, -0.5, '#3fa7c9', 0.25);
      b.box(0.62, 0.05, 0.05, 0, 1.12, -0.58, '#2a2a2e');
      b.box(0.18, 0.12, 0.06, 0, 0.98, -0.66, HEAD);
      b.box(0.2, 0.1, 0.05, 0, 0.62, 0.72, TAIL);
      // Rider in a white kurta and a red helmet.
      b.box(0.42, 0.6, 0.3, 0, 1.22, 0.15, '#f4f0e6', -0.15);
      b.box(0.36, 0.3, 0.5, 0, 0.92, 0.05, '#2c3140');
      for (const s of [-1, 1]) b.box(0.1, 0.1, 0.5, s * 0.24, 1.25, -0.25, '#f4f0e6', 0.6);
      b.blob(0.2, 0, 1.7, 0.1, '#c8281f', 1.05);
      break;
    }
    case 'bike':
      motorbike(b, -1, '#2b4a8a', '#b8262b', null);
      break;
    case 'sportsbike': {
      wheel(b, 0, 0.32, -0.75, 0.32, 0.16);
      wheel(b, 0, 0.32, 0.7, 0.32, 0.2);
      b.box(0.38, 0.4, 1.3, 0, 0.66, -0.05, '#22a35a');
      b.box(0.42, 0.3, 0.6, 0, 0.78, -0.55, '#22a35a', -0.4);
      b.box(0.3, 0.2, 0.04, 0, 1.02, -0.72, GLASS, -0.7);
      b.box(0.3, 0.12, 0.6, 0, 0.92, 0.35, '#1c1c20', 0.15);
      b.box(0.16, 0.1, 0.05, 0, 0.82, -0.88, HEAD);
      b.box(0.16, 0.08, 0.05, 0, 0.95, 0.68, TAIL);
      b.box(0.4, 0.5, 0.55, 0, 1.15, -0.05, '#111114', -0.9);
      b.blob(0.2, 0, 1.38, -0.35, '#f2c230', 1.0);
      break;
    }
    case 'hatch':
      shapedCar(b, 0, 0, { style: 'hatch', len: 3.7, body: '#d8432f' });
      break;
    case 'suv': {
      shapedCar(b, 0, 0, { style: 'suv', len: 4.5, body: '#e8e4da' });
      for (const s2 of [-1, 1]) b.box(0.06, 0.08, 2.2, s2 * 0.72, 1.92, 0.3, '#2a2a2e');
      b.box(1.9, 0.22, 0.16, 0, 0.62, -2.3, '#2a2a2e');
      break;
    }
    case 'cab':
      kaaliPeeli(b, 0, 0);
      break;
    case 'rig': {
      // Raj's SUV: dark olive, mesh over the windows, ram bar, roof gun and spare cans.
      const body = '#5f6a4c';
      shapedCar(b, 0, 0, { style: 'suv', len: 4.6, body });
      // Wire mesh over the side windows.
      for (const s2 of [-1, 1]) for (const zz of [-0.7, -0.2, 0.3, 0.8, 1.3]) b.box(0.03, 0.56, 0.03, s2 * 0.91, 1.5, zz, '#1e1e20');
      // Ram bar: thick pipes across the front.
      for (const yy of [0.62, 1.0]) b.box(2.15, 0.12, 0.12, 0, yy, -2.46, '#6a6e72');
      for (const xx of [-0.85, -0.3, 0.3, 0.85]) b.box(0.1, 0.6, 0.12, xx, 0.8, -2.46, '#5a5e62');
      b.box(1.2, 0.2, 0.3, 0, 0.4, -2.38, '#2a2a2e');
      // Roof rack, spare cans and the gun turret.
      for (const s2 of [-1, 1]) b.box(0.06, 0.08, 2.4, s2 * 0.72, 1.96, 0.35, '#2a2a2e');
      b.box(0.3, 0.42, 0.5, -0.5, 2.18, 1.15, '#c8281f');
      b.box(0.3, 0.42, 0.5, -0.16, 2.18, 1.15, '#c8281f');
      b.cylinder(0.3, 0.2, 0.35, 2.02, 0.05, '#2e3030', 10);
      b.box(0.36, 0.28, 0.5, 0.35, 2.24, 0.0, '#3a3c3c');
      b.box(0.08, 0.08, 0.9, 0.35, 2.28, -0.65, '#1a1a1c');
      break;
    }
    default:
      break;
  }
  return b.build();
}
