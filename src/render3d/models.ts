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

/** Side profile (z, y pairs) extruded across the width, centred on x = 0. */
function sideExtrude(points: ReadonlyArray<readonly [number, number]>, width: number, bevel = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // Shape x is our z; extrusion runs along local z. Turn it so the extrusion runs across x.
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 - bevel, 0, 0);
  return g;
}

/** Points along an ellipse arc, from angle a0 to a1 (radians, 0 = +x, π/2 = up). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** Low-poly auto-rickshaw, nose pointing to -z, wheels on y = 0. About 2.7 m long and 1.4 m wide. */
export function buildAuto(): THREE.Group {
  const g = new THREE.Group();
  const green = mat('#1d8a4a');
  const greenDark = mat('#13603a');
  const yellow = new THREE.MeshLambertMaterial({ color: '#f7c31a' });
  const yellowDark = mat('#d9a10c');
  const black = mat('#18181c');
  const rubber = mat('#111114');
  const steel = mat('#9aa0a8');
  const chrome = mat('#d8dce2');
  const glass = new THREE.MeshLambertMaterial({ color: '#34506b', transparent: true, opacity: 0.72 });
  const seat = mat('#2a2a30');
  const canvas = mat('#26262b');
  const khaki = mat('#b9a26b');
  const skin = mat('#8a5a3c');
  const hair = mat('#141012');
  const plate = mat('#f4e9a6');
  const head = mat('#fff4c8', { emissive: '#ffe9a0', emissiveIntensity: 1 });
  const tail = mat('#e8412c', { emissive: '#b01d10', emissiveIntensity: 0.7 });
  const amber = mat('#ff9d1c', { emissive: '#c25e00', emissiveIntensity: 0.5 });

  // Rear tub: the wide passenger section with a rounded back.
  const tub = sideExtrude(
    [
      [-0.25, 0.3],
      [1.05, 0.3],
      ...arc(1.05, 0.5, 0.17, 0.2, -Math.PI / 2, 0, 3),
      [1.22, 0.86],
      [-0.25, 0.86],
    ],
    1.36,
  );
  g.add(part(tub, green, 0, 0, 0));
  // Belt line trim along the tub.
  g.add(part(new THREE.BoxGeometry(1.4, 0.06, 1.42), yellowDark, 0, 0.84, 0.5));

  // Front cowl: narrower, with the sloping nose that holds the headlight.
  const cowl = sideExtrude(
    [
      [-0.2, 0.32],
      [-0.2, 1.02],
      [-0.62, 1.04],
      [-1.02, 0.98],
      [-1.3, 0.84],
      [-1.42, 0.62],
      [-1.4, 0.42],
      [-1.22, 0.3],
    ],
    0.9,
    0.06,
  );
  g.add(part(cowl, green, 0, 0, 0));
  // Dark kick panel under the nose and a chrome guard bar.
  g.add(part(new THREE.BoxGeometry(0.7, 0.16, 0.12), greenDark, 0, 0.4, -1.42));
  g.add(part(new THREE.CylinderGeometry(0.025, 0.025, 0.86, 6), chrome, 0, 0.5, -1.5, 0, 0, Math.PI / 2));
  // Round headlight with a chrome ring, and two amber indicators.
  g.add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 14), chrome, 0, 0.74, -1.38, Math.PI / 2 - 0.45));
  g.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 14), head, 0, 0.745, -1.42, Math.PI / 2 - 0.45));
  g.add(part(new THREE.BoxGeometry(0.09, 0.06, 0.05), amber, -0.32, 0.86, -1.26));
  g.add(part(new THREE.BoxGeometry(0.09, 0.06, 0.05), amber, 0.32, 0.86, -1.26));

  // Canopy: a curved yellow hood on an arch, the shape everyone knows.
  const outer = arc(0, 1.3, 0.72, 0.56, 0.18, Math.PI - 0.18, 14);
  const inner = arc(0, 1.3, 0.66, 0.5, Math.PI - 0.2, 0.2, 14);
  const hood = new THREE.Shape();
  outer.forEach(([x, y], i) => (i === 0 ? hood.moveTo(x, y) : hood.lineTo(x, y)));
  inner.forEach(([x, y]) => hood.lineTo(x, y));
  hood.closePath();
  const hoodGeo = new THREE.ExtrudeGeometry(hood, { depth: 1.82, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  hoodGeo.translate(0, 0, -0.6);
  hoodGeo.computeVertexNormals();
  g.add(part(hoodGeo, yellow, 0, 0, 0));
  // Stitched seams on the roof, and a black edge band.
  for (const sx of [-0.28, 0.28]) {
    const seam = new THREE.BoxGeometry(0.03, 0.02, 1.8);
    g.add(part(seam, yellowDark, sx, 1.3 + 0.56 * Math.sqrt(1 - (sx / 0.72) ** 2) + 0.012, 0.31));
  }
  const band = new THREE.BoxGeometry(0.05, 0.06, 1.86);
  for (const sx of [-0.7, 0.7]) g.add(part(band, black, sx, 1.42, 0.31));

  // Back panel closing the hood, with a small rear window.
  const back = new THREE.Shape();
  arc(0, 1.3, 0.72, 0.56, 0.18, Math.PI - 0.18, 14).forEach(([x, y], i) => (i === 0 ? back.moveTo(x, y) : back.lineTo(x, y)));
  back.lineTo(-0.7, 0.86);
  back.lineTo(0.7, 0.86);
  back.closePath();
  const backGeo = new THREE.ExtrudeGeometry(back, { depth: 0.05, bevelEnabled: false });
  backGeo.translate(0, 0, 1.18);
  g.add(part(backGeo, canvas, 0, 0, 0));
  g.add(part(new THREE.BoxGeometry(0.7, 0.26, 0.02), glass, 0, 1.44, 1.24));
  g.add(part(new THREE.BoxGeometry(1.36, 0.05, 0.04), yellowDark, 0, 1.25, 1.24));
  // Rear side panels over the passenger bench (the front is open for the driver).
  for (const sx of [-0.69, 0.69]) g.add(part(new THREE.BoxGeometry(0.04, 0.58, 0.72), yellow, sx, 1.15, 0.82));
  // Grab rails and posts from tub to hood.
  const post = new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6);
  for (const [px, pz] of [[-0.66, -0.5], [0.66, -0.5], [-0.66, 0.42], [0.66, 0.42]] as const) g.add(part(post, black, px, 1.15, pz));

  // Windscreen, wiper and mirrors.
  g.add(part(new THREE.BoxGeometry(1.0, 0.56, 0.03), glass, 0, 1.32, -0.6, -0.12));
  g.add(part(new THREE.BoxGeometry(0.42, 0.02, 0.02), black, 0.1, 1.1, -0.63, 0, 0, 0.5));
  for (const sx of [-0.62, 0.62]) {
    g.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), black, sx, 1.14, -0.66, 0, 0, sx > 0 ? -0.6 : 0.6));
    g.add(part(new THREE.BoxGeometry(0.12, 0.08, 0.03), chrome, sx * 1.12, 1.24, -0.68));
  }

  // Driver in a khaki shirt, hands on the bar, and the handlebar itself.
  g.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), black, 0, 1.02, -0.48, 0, 0, Math.PI / 2));
  g.add(part(new THREE.BoxGeometry(0.34, 0.12, 0.34), seat, 0, 0.92, -0.12));
  g.add(part(new THREE.BoxGeometry(0.38, 0.42, 0.24), khaki, 0, 1.18, -0.14, -0.15));
  g.add(part(new THREE.SphereGeometry(0.12, 10, 8), skin, 0, 1.5, -0.18));
  g.add(part(new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 1.52, -0.16));
  for (const sx of [-0.17, 0.17]) g.add(part(new THREE.BoxGeometry(0.08, 0.08, 0.34), khaki, sx, 1.12, -0.36, 0.35));

  // Passenger bench with a backrest.
  g.add(part(new THREE.BoxGeometry(1.2, 0.14, 0.48), seat, 0, 0.94, 0.72));
  g.add(part(new THREE.BoxGeometry(1.2, 0.42, 0.1), seat, 0, 1.18, 1.0, 0.12));

  // Rear: tail lights, plate, bumper bar.
  for (const sx of [-0.52, 0.52]) g.add(part(new THREE.BoxGeometry(0.16, 0.11, 0.05), tail, sx, 0.66, 1.275));
  g.add(part(new THREE.BoxGeometry(0.42, 0.16, 0.03), plate, 0, 0.5, 1.275));
  g.add(part(new THREE.BoxGeometry(0.34, 0.03, 0.035), black, 0, 0.52, 1.292));
  g.add(part(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), steel, 0, 0.36, 1.33, 0, 0, Math.PI / 2));

  // Wheels with hubs: one at the front under a mudguard, two at the back.
  const tyre = new THREE.CylinderGeometry(0.25, 0.25, 0.16, 16);
  const hub = new THREE.CylinderGeometry(0.12, 0.12, 0.17, 10);
  const wheel = (x: number, z: number): void => {
    g.add(part(tyre, rubber, x, 0.25, z, 0, 0, Math.PI / 2));
    g.add(part(hub, steel, x, 0.25, z, 0, 0, Math.PI / 2));
  };
  wheel(0, -1.06);
  wheel(-0.6, 0.78);
  wheel(0.6, 0.78);
  const guard = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12, 1, true, -Math.PI / 2, Math.PI);
  g.add(part(guard, black, 0, 0.27, -1.06, 0, 0, Math.PI / 2));
  for (const sx of [-0.62, 0.62]) g.add(part(guard, black, sx, 0.27, 0.78, 0, 0, Math.PI / 2));
  // Spare-fuel style side box under the bench.
  g.add(part(new THREE.BoxGeometry(0.2, 0.14, 0.4), greenDark, 0.72, 0.42, 0.25));

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
  });
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
