import * as THREE from 'three';
import { GeoBuilder } from './geo';

/**
 * Rounded low-poly cars. Each body is a side profile (length × height) extruded across the
 * width with a bevel, so edges come out soft instead of boxy. The glasshouse and roof are
 * a second, narrower profile on top. Noses point to -z when `dir` is -1.
 */

const TYRE = '#18181b';
const HUB = '#b4bac2';
const GLASS = '#2a3e52';
const CHROME = '#d4d8dc';
const HEAD = '#fff3c4';
const TAIL = '#d8321f';
const TRIM = '#232327';

export type CarStyle = 'classic' | 'sedan' | 'hatch' | 'suv' | 'london';

interface Profile {
  /** Height of the body's bottom edge, beltline and roof. */
  base: number;
  belt: number;
  roof: number;
  /** Shares of the length taken by the bonnet and the boot (0 for a hatch). */
  hood: number;
  boot: number;
  /** How far the windscreen and rear glass lean in, metres. */
  rakeF: number;
  rakeR: number;
  width: number;
  wheelR: number;
  /** Corner softness. */
  bevel: number;
}

const PROFILES: Record<CarStyle, Profile> = {
  // 1960s Mumbai taxi: tall rounded cabin, short bonnet and boot, narrow body.
  classic: { base: 0.34, belt: 0.92, roof: 1.5, hood: 0.27, boot: 0.22, rakeF: 0.42, rakeR: 0.38, width: 1.62, wheelR: 0.31, bevel: 0.12 },
  sedan: { base: 0.3, belt: 0.86, roof: 1.38, hood: 0.3, boot: 0.22, rakeF: 0.62, rakeR: 0.48, width: 1.76, wheelR: 0.32, bevel: 0.1 },
  hatch: { base: 0.3, belt: 0.88, roof: 1.42, hood: 0.26, boot: 0.04, rakeF: 0.6, rakeR: 0.22, width: 1.7, wheelR: 0.31, bevel: 0.1 },
  suv: { base: 0.44, belt: 1.18, roof: 1.86, hood: 0.24, boot: 0.03, rakeF: 0.42, rakeR: 0.12, width: 1.94, wheelR: 0.42, bevel: 0.1 },
  london: { base: 0.34, belt: 0.98, roof: 1.78, hood: 0.24, boot: 0.1, rakeF: 0.3, rakeR: 0.2, width: 1.74, wheelR: 0.35, bevel: 0.12 },
};

/** Extrudes a side profile (x = along the car, front at +x; y = up) across `width`. */
function extrude(points: Array<[number, number]>, width: number, bevel: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0]![0], points[0]![1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i]![0], points[i]![1]);
  shape.closePath();
  const depth = Math.max(0.02, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Points along a quadratic curve, for rounded bonnets and boots. */
function curve(a: [number, number], c: [number, number], b: [number, number], n = 3): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

function wheel(b: GeoBuilder, x: number, y: number, z: number, r: number, w: number, chrome: boolean): void {
  b.add(new THREE.CylinderGeometry(r, r, w, 14), TYRE, x, y, z, 0, 0, Math.PI / 2);
  b.add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 12), chrome ? CHROME : '#3a3d42', x, y, z, 0, 0, Math.PI / 2);
  b.add(new THREE.CylinderGeometry(r * 0.22, r * 0.22, w + 0.04, 8), HUB, x, y, z, 0, 0, Math.PI / 2);
}

export interface CarOptions {
  style: CarStyle;
  len: number;
  body: string;
  /** Roof and upper cabin colour (the Mumbai taxi's yellow top). Defaults to the body. */
  roof?: string;
  dir?: -1 | 1;
  /** Round headlights and chrome bumpers (older cars). */
  vintage?: boolean;
  roofSign?: string | null;
  /** Luggage carrier on the roof. */
  carrier?: boolean;
}

/** Builds one rounded car at (x, z). */
export function shapedCar(b: GeoBuilder, x: number, z: number, o: CarOptions): void {
  const p = PROFILES[o.style];
  const L = o.len;
  const h = L / 2;
  const dir = o.dir ?? -1;
  const ry = dir < 0 ? Math.PI / 2 : -Math.PI / 2;
  const roof = o.roof ?? o.body;
  const W = p.width;

  // Lower body: flat bottom, rounded nose and tail, bonnet and boot curving into the beltline.
  const front = h - p.bevel;
  const rear = -h + p.bevel;
  const hoodEnd = front - L * p.hood;
  const bootEnd = rear + L * p.boot;
  const lowPts: Array<[number, number]> = [
    [rear, p.base], [front, p.base], [front, p.belt - 0.22],
    ...curve([front, p.belt - 0.22], [front, p.belt - 0.02], [front - 0.3, p.belt - 0.01]),
    [hoodEnd, p.belt + 0.02],
    [bootEnd, p.belt + 0.02],
    ...curve([bootEnd, p.belt + 0.02], [rear, p.belt], [rear, p.belt - 0.24]),
  ];
  b.add(extrude(lowPts, W, p.bevel), o.body, x, 0, z, 0, ry);

  // Glasshouse: dark glass, a little narrower, with the roof slab on top.
  const gFront = hoodEnd - 0.02;
  const gRear = bootEnd + 0.02;
  const top = p.roof - 0.08;
  const glassPts: Array<[number, number]> = [
    [gRear, p.belt], [gFront, p.belt], [gFront - p.rakeF, top], [gRear + p.rakeR, top],
  ];
  // The cabin is painted; glass panes poke out through its sides and its raked ends.
  b.add(extrude(glassPts, W - 0.16, 0.06), roof, x, 0, z, 0, ry);
  const inset = 0.07;
  const sidePts: Array<[number, number]> = [
    [gRear + inset + 0.1, p.belt + 0.05], [gFront - inset - 0.1, p.belt + 0.05],
    [gFront - p.rakeF - inset * 0.5, top - 0.07], [gRear + p.rakeR + inset * 0.5, top - 0.07],
  ];
  b.add(extrude(sidePts, W - 0.13, 0.02), GLASS, x, 0, z, 0, ry);
  const k = 0.05;
  const endPts: Array<[number, number]> = [
    [gRear - k, p.belt + 0.05], [gFront + k, p.belt + 0.05],
    [gFront - p.rakeF + k, top - 0.05], [gRear + p.rakeR - k, top - 0.05],
  ];
  b.add(extrude(endPts, W - 0.4, 0.02), GLASS, x, 0, z, 0, ry);
  const roofPts: Array<[number, number]> = [
    [gRear + p.rakeR - 0.04, top - 0.02], [gFront - p.rakeF + 0.04, top - 0.02], [gFront - p.rakeF - 0.02, p.roof], [gRear + p.rakeR + 0.02, p.roof],
  ];
  b.add(extrude(roofPts, W - 0.12, 0.06), roof, x, 0, z, 0, ry);

  // Centre pillars in the roof colour so the side windows read as two panes.
  const mid = (gFront + gRear) / 2;
  for (const s of [-1, 1]) {
    b.box(0.05, top - p.belt - 0.04, 0.12, x + s * (W / 2 - 0.07), (p.belt + top) / 2, z + dir * mid, roof);
  }
  // A thin waist line and door seams.
  for (const s of [-1, 1]) {
    b.box(0.02, 0.05, L * 0.8, x + s * (W / 2 + 0.005), p.belt - 0.12, z, o.vintage ? CHROME : TRIM);
    for (const at of [mid + 0.05, mid - L * 0.22]) b.box(0.02, p.belt - p.base - 0.15, 0.025, x + s * (W / 2 + 0.005), (p.belt + p.base) / 2, z + dir * at, TRIM);
    // Door handles and mirrors.
    b.box(0.03, 0.04, 0.14, x + s * (W / 2 + 0.02), p.belt - 0.2, z + dir * (mid + 0.25), CHROME);
    b.box(0.12, 0.08, 0.1, x + s * (W / 2 + 0.06), p.belt + 0.1, z + dir * (gFront - 0.1), o.vintage ? CHROME : TRIM);
  }

  // Wheel arches and wheels.
  const axle = L * 0.33;
  for (const s of [-1, 1]) for (const a of [axle, -axle * 0.95]) {
    b.add(new THREE.CylinderGeometry(p.wheelR + 0.07, p.wheelR + 0.07, 0.04, 14, 1, false, 0, Math.PI), TRIM, x + s * (W / 2 + 0.005), p.wheelR, z + dir * a, 0, 0, Math.PI / 2);
    wheel(b, x + s * (W / 2 - 0.12), p.wheelR, z + dir * a, p.wheelR, 0.24, !!o.vintage);
  }

  // Nose and tail: bumpers, grille, lights, number plates.
  const fz = z + dir * (h + 0.02);
  const rz = z - dir * (h + 0.02);
  const bumper = o.vintage ? CHROME : TRIM;
  b.box(W + 0.04, 0.14, 0.12, x, p.base + 0.08, fz, bumper);
  b.box(W + 0.04, 0.14, 0.12, x, p.base + 0.08, rz, bumper);
  b.box(W * 0.46, 0.2, 0.04, x, p.base + 0.32, fz, o.vintage ? CHROME : '#141416');
  if (o.vintage) for (let i = -2; i <= 2; i++) b.box(0.02, 0.18, 0.05, x + i * 0.12, p.base + 0.32, fz, '#3a3a3e');
  for (const s of [-1, 1]) {
    if (o.vintage) {
      b.add(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), HEAD, x + s * (W / 2 - 0.26), p.belt - 0.24, fz, Math.PI / 2, 0, 0);
      b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 12), CHROME, x + s * (W / 2 - 0.26), p.belt - 0.24, fz - dir * 0.02, Math.PI / 2, 0, 0);
    } else {
      b.box(0.4, 0.13, 0.05, x + s * (W / 2 - 0.3), p.belt - 0.18, fz, HEAD);
    }
    b.box(o.vintage ? 0.14 : 0.32, o.vintage ? 0.2 : 0.13, 0.05, x + s * (W / 2 - 0.24), p.belt - 0.2, rz, TAIL);
  }
  b.box(0.5, 0.12, 0.03, x, p.base + 0.26, fz + dir * 0.03, '#f4f2ea');
  b.box(0.5, 0.12, 0.03, x, p.base + 0.3, rz - dir * 0.03, o.vintage ? '#f2c230' : '#f4f2ea');

  if (o.carrier) {
    // Roof carrier: two rails on short legs with cross bars.
    const span = (gFront - p.rakeF) - (gRear + p.rakeR) - 0.1;
    const c = (gFront - p.rakeF + gRear + p.rakeR) / 2;
    for (const s of [-1, 1]) b.box(0.05, 0.05, span, x + s * (W / 2 - 0.22), p.roof + 0.12, z + dir * c, '#2a2a2e');
    for (const t of [-0.4, -0.13, 0.13, 0.4]) b.box(W - 0.4, 0.04, 0.04, x, p.roof + 0.14, z + dir * (c + t * span), '#2a2a2e');
    for (const s of [-1, 1]) for (const t of [-0.45, 0.45]) b.box(0.04, 0.12, 0.04, x + s * (W / 2 - 0.22), p.roof + 0.06, z + dir * (c + t * span), '#2a2a2e');
  }
  if (o.roofSign) b.box(0.7, 0.22, 0.3, x, p.roof + 0.11, z + dir * ((gFront - p.rakeF + gRear + p.rakeR) / 2), o.roofSign);
}

/** Mumbai's black-and-yellow taxi: a rounded 1960s sedan, black body, yellow roof, roof carrier. */
export function kaaliPeeli(b: GeoBuilder, x: number, z: number, dir: -1 | 1 = -1): void {
  shapedCar(b, x, z, { style: 'classic', len: 4.05, body: '#18181b', roof: '#f3c316', dir, vintage: true, carrier: true });
}

/** A box with soft rounded edges (bus and truck bodies). Centre at (x, y, z), length along z. */
export function roundedBox(b: GeoBuilder, w: number, h: number, d: number, x: number, y: number, z: number, colour: string, bevel = 0.14): void {
  const hd = d / 2 - bevel;
  const hh = h / 2 - bevel;
  b.add(extrude([[-hd, -hh], [hd, -hh], [hd, hh], [-hd, hh]], w, bevel), colour, x, y, z, 0, Math.PI / 2);
}
