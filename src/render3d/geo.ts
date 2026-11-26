import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collects many simple shapes, each with a flat colour, into ONE geometry with vertex colours.
 * A whole street block then draws in a single call, which keeps phones fast.
 */
export class GeoBuilder {
  private readonly parts: THREE.BufferGeometry[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly c = new THREE.Color();
  /** Wind sway for parts added from now on (0 = still). Leaves use 1. */
  sway = 0;

  box(w: number, h: number, d: number, x: number, y: number, z: number, colour: THREE.ColorRepresentation, rx = 0, ry = 0, rz = 0): void {
    this.add(new THREE.BoxGeometry(w, h, d), colour, x, y, z, rx, ry, rz);
  }

  cylinder(r: number, h: number, x: number, y: number, z: number, colour: THREE.ColorRepresentation, segments = 8, rTop = r): void {
    this.add(new THREE.CylinderGeometry(rTop, r, h, segments), colour, x, y, z);
  }

  blob(r: number, x: number, y: number, z: number, colour: THREE.ColorRepresentation, sy = 1): void {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.scale(1, sy, 1);
    this.add(g, colour, x, y, z);
  }

  add(geo: THREE.BufferGeometry, colour: THREE.ColorRepresentation, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(this.m);
    this.c.set(colour);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = this.c.r;
      col[i * 3 + 1] = this.c.g;
      col[i * 3 + 2] = this.c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const sw = new Float32Array(n);
    if (this.sway) sw.fill(this.sway);
    g.setAttribute('sway', new THREE.BufferAttribute(sw, 1));
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    this.parts.push(g);
  }

  /** Adds a part whose texture coordinates point at one cell of a texture atlas. */
  addAtlas(geo: THREE.BufferGeometry, cell: [number, number, number, number], x: number, y: number, z: number, ry = 0): void {
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, cell[0] + uv.getX(i) * cell[2], cell[1] + uv.getY(i) * cell[3]);
    this.add(geo, '#ffffff', x, y, z, 0, ry, 0);
  }

  build(): THREE.BufferGeometry {
    if (this.parts.length === 0) return new THREE.BufferGeometry();
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts.length = 0;
    if (!merged) throw new Error('Could not merge geometry');
    merged.computeBoundingSphere();
    return merged;
  }
}
