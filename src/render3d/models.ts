import * as THREE from 'three';
import { Rng } from '../core/rng';
import { OBSTACLES, ObstacleKind } from '../data/obstacles';

const mat = (colour: THREE.ColorRepresentation, extra: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({ color: colour, flatShading: true, ...extra });

function part(geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  return mesh;
}

/** Low-poly auto-rickshaw, nose pointing to -z, wheels on y = 0. */
export function buildAuto(): THREE.Group {
  const g = new THREE.Group();
  const green = mat('#1f7a44');
  const yellow = mat('#f6be12');
  const black = mat('#1a1a1e');
  const glass = mat('#2c3f55');
  const chrome = mat('#c9ccd2');
  const light = mat('#fff3c4', { emissive: '#fff0b0', emissiveIntensity: 0.9 });

  // Body: wide at the back, narrow nose at the front.
  g.add(part(new THREE.BoxGeometry(1.3, 0.55, 1.6), green, 0, 0.55, 0.35));
  g.add(part(new THREE.BoxGeometry(0.85, 0.65, 0.9), green, 0, 0.6, -0.85));
  g.add(part(new THREE.BoxGeometry(0.6, 0.5, 0.35), green, 0, 0.55, -1.38));
  // Windscreen, handlebar, mirrors and headlight.
  g.add(part(new THREE.BoxGeometry(0.95, 0.62, 0.06), glass, 0, 1.25, -0.62, -0.25));
  g.add(part(new THREE.BoxGeometry(0.8, 0.05, 0.05), black, 0, 1.0, -0.95));
  g.add(part(new THREE.BoxGeometry(0.08, 0.08, 0.08), chrome, -0.5, 1.15, -0.75));
  g.add(part(new THREE.BoxGeometry(0.08, 0.08, 0.08), chrome, 0.5, 1.15, -0.75));
  g.add(part(new THREE.BoxGeometry(0.22, 0.16, 0.06), light, 0, 0.72, -1.57));
  // Seats and the passenger bench.
  g.add(part(new THREE.BoxGeometry(0.5, 0.15, 0.4), black, 0, 0.92, -0.25));
  g.add(part(new THREE.BoxGeometry(1.15, 0.18, 0.55), black, 0, 0.92, 0.6));
  // Canopy: yellow roof on black posts, with a yellow back panel.
  const post = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6);
  for (const [px, pz] of [[-0.6, -0.55], [0.6, -0.55], [-0.6, 1.0], [0.6, 1.0]] as const) g.add(part(post, black, px, 1.25, pz));
  g.add(part(new THREE.BoxGeometry(1.42, 0.14, 1.85), yellow, 0, 1.73, 0.22));
  g.add(part(new THREE.BoxGeometry(1.3, 0.06, 1.7), yellow, 0, 1.82, 0.22));
  g.add(part(new THREE.BoxGeometry(1.32, 0.95, 0.07), yellow, 0, 1.22, 1.1));
  g.add(part(new THREE.BoxGeometry(1.34, 0.1, 0.09), black, 0, 0.92, 1.12));
  // Tail lights.
  const tail = mat('#e5432f', { emissive: '#a01a10', emissiveIntensity: 0.6 });
  g.add(part(new THREE.BoxGeometry(0.14, 0.1, 0.04), tail, -0.5, 0.62, 1.16));
  g.add(part(new THREE.BoxGeometry(0.14, 0.1, 0.04), tail, 0.5, 0.62, 1.16));
  // Wheels: one at the front, two at the back.
  const wheel = new THREE.CylinderGeometry(0.26, 0.26, 0.18, 12);
  g.add(part(wheel, black, 0, 0.26, -1.15, 0, 0, Math.PI / 2));
  g.add(part(wheel, black, -0.66, 0.26, 0.75, 0, 0, Math.PI / 2));
  g.add(part(wheel, black, 0.66, 0.26, 0.75, 0, 0, Math.PI / 2));
  return g;
}

/** Pre-made pothole shapes: [kind][variant] → rim, hole and optional puddle geometries, flat on the road. */
export interface PotholeShape {
  rim: THREE.BufferGeometry;
  hole: THREE.BufferGeometry;
  /** Darker inner part, shifted toward the viewer, so the hole reads as deep. */
  deep: THREE.BufferGeometry;
  water: THREE.BufferGeometry | null;
}

function blobShape(rx: number, rz: number, pts: number[]): THREE.Shape {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx * pts[i]!;
    const y = Math.sin(a) * rz * pts[i]!;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function flat(shape: THREE.Shape, y: number): THREE.BufferGeometry {
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

export function buildPotholeShapes(): PotholeShape[][] {
  const rng = new Rng(7331);
  const out: PotholeShape[][] = [];
  for (const kind of [ObstacleKind.SmallPothole, ObstacleKind.LargePothole]) {
    const def = OBSTACLES[kind];
    const list: PotholeShape[] = [];
    for (let v = 0; v < def.variants; v++) {
      const pts = Array.from({ length: 14 }, () => rng.range(0.78, 1));
      const rx = def.w / 2;
      const rz = def.h / 2;
      list.push({
        rim: flat(blobShape(rx * 1.15, rz * 1.2, pts), 0.012),
        hole: flat(blobShape(rx, rz, pts), 0.02),
        deep: flat(blobShape(rx * 0.8, rz * 0.7, pts), 0.024).translate(0, 0, rz * 0.12),
        water: rng.chance(0.5) ? flat(blobShape(rx * 0.6, rz * 0.5, pts), 0.028) : null,
      });
    }
    out[kind] = list;
  }
  return out;
}
