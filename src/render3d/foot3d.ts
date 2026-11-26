import * as THREE from 'three';
import { ZOMBIES, type FootWorld, type LootKind } from '../systems/foot';
import { GeoBuilder } from './geo';
import { car, playerVehicleGeo, rajGeo, weaponGeo, zombieGeo } from './props';

const POPUPS = 6;
const SHELF_GOODS = ['#d8432f', '#f2c230', '#2e6fb7', '#3f9e5a', '#f07a1a', '#8b3fa8', '#e8e4da', '#c8281f', '#4fb0c6'];
const LOOT_COLOUR: Record<LootKind, string> = {
  scrap: '#9aa2aa', fuel: '#c8281f', med: '#f4f2ee', inhaler: '#2e6fb7', keys: '#ffc21a', tools: '#e0602a', part: '#3fd07a',
};

/**
 * 3D view of an on-foot section: a dark supermarket lit by flickering tubes and Raj's torch.
 * Shares the game's WebGL renderer; the level geometry is rebuilt per layout.
 */
export class Foot3D {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(40, 1, 0.3, 200);
  private readonly mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  private level: THREE.Mesh | null = null;
  private glow: THREE.Mesh | null = null;
  private readonly raj = new THREE.Group();
  private readonly arm = new THREE.Group();
  private readonly armMeshes: Record<'bat' | 'machete', THREE.Mesh>;
  private readonly zombieMeshes: THREE.Group[] = [];
  private readonly zombieGeos: THREE.BufferGeometry[] = [];
  private readonly crateMeshes: Array<{ g: THREE.Group; bar: THREE.Mesh; lid: THREE.Mesh }> = [];
  private readonly exit: THREE.Mesh;
  private readonly torch: THREE.SpotLight;
  private readonly tubes: THREE.PointLight[] = [];
  private readonly popEls: HTMLDivElement[] = [];
  private readonly popLife = new Float32Array(POPUPS);
  private readonly popPos: THREE.Vector3[] = [];
  private popNext = 0;
  private readonly tmp = new THREE.Vector3();
  private w = 1;
  private h = 1;
  private time = 0;
  private shake = 0;
  private hurtFlash = 0;
  private builtFor: FootWorld | null = null;
  private layoutKey = '';

  constructor(private readonly gl: THREE.WebGLRenderer, private readonly world: FootWorld, host: HTMLElement) {
    this.scene.background = new THREE.Color('#0f1116');
    this.scene.fog = new THREE.Fog('#0f1116', 22, 48);
    this.scene.add(new THREE.HemisphereLight('#8fa0c8', '#2a2622', 0.9));
    const moon = new THREE.DirectionalLight('#a9bcff', 0.9);
    moon.position.set(-8, 20, 6);
    moon.castShadow = true;
    moon.shadow.camera.left = -20;
    moon.shadow.camera.right = 20;
    moon.shadow.camera.top = 24;
    moon.shadow.camera.bottom = -24;
    moon.shadow.mapSize.set(1024, 1024);
    this.scene.add(moon, moon.target);
    this.moon = moon;

    // Raj with his torch.
    const body = new THREE.Mesh(rajGeo(), this.mat);
    body.castShadow = true;
    this.raj.add(body);
    this.arm.position.set(0.33, 1.38, 0);
    this.armMeshes = { bat: new THREE.Mesh(weaponGeo('bat'), this.mat), machete: new THREE.Mesh(weaponGeo('machete'), this.mat) };
    for (const m of Object.values(this.armMeshes)) {
      m.castShadow = true;
      this.arm.add(m);
    }
    this.raj.add(this.arm);
    this.scene.add(this.raj);
    this.torch = new THREE.SpotLight('#fff1c8', 60, 16, 0.6, 0.55, 1.3);
    this.scene.add(this.torch, this.torch.target);

    for (let v = 0; v < 6; v++) this.zombieGeos.push(zombieGeo(v));

    const exitGeo = new THREE.PlaneGeometry(4, 1.6);
    exitGeo.rotateX(-Math.PI / 2);
    this.exit = new THREE.Mesh(exitGeo, new THREE.MeshBasicMaterial({ color: '#3fd07a', transparent: true, opacity: 0.4, depthWrite: false }));
    this.scene.add(this.exit);
    this.genLamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a2a' }));
    this.flood = new THREE.SpotLight('#f4f8ff', 160, 40, 0.9, 0.5, 1.2);
    this.scene.add(this.genLamp, this.flood, this.flood.target);

    const layer = document.createElement('div');
    layer.className = 'popups';
    host.appendChild(layer);
    for (let i = 0; i < POPUPS; i++) {
      const el = document.createElement('div');
      el.className = 'popup';
      el.hidden = true;
      layer.appendChild(el);
      this.popEls.push(el);
      this.popPos.push(new THREE.Vector3());
    }
  }

  private readonly moon: THREE.DirectionalLight;
  private readonly genLamp: THREE.Mesh;
  private readonly flood: THREE.SpotLight;

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Rebuilds the floor, shelves and pools of meshes for the current layout. */
  private build(): void {
    const fw = this.world;
    this.builtFor = fw;
    const { width: W, depth: D } = fw.level;
    const ox = -W / 2;
    const b = new GeoBuilder();
    const g = new GeoBuilder();
    this.genAt = null;
    if (this.rig) this.rig.visible = false;
    const layout = fw.level.layout;
    const indoor = layout === 'mall' || layout === 'apartment';
    this.buildFloor(b, g, W, D);
    for (const sh of fw.shelves) this.buildShelf(b, g, ox + sh.x, -sh.y, sh.hw, sh.hh, sh.kind, sh.x, sh.y);
    // Scattered litter: boxes in the store, bags and bottles outside.
    for (let i = 0; i < 12; i++) {
      const x = ox + ((i * 7.3) % (W - 2)) + 1;
      const y = 8 + ((i * 11.7) % (D - 10));
      if (fw.blocked(x - ox, y, 0.4)) continue;
      b.box(0.4, indoor ? 0.3 : 0.12, 0.3, x, indoor ? 0.15 : 0.06, -y, SHELF_GOODS[i % SHELF_GOODS.length]!, 0, i * 0.7);
    }
    this.level?.geometry.dispose();
    this.glow?.geometry.dispose();
    if (!this.level) {
      this.level = new THREE.Mesh(b.build(), this.mat);
      this.level.receiveShadow = true;
      this.level.castShadow = true;
      this.glow = new THREE.Mesh(g.build(), this.glowMat);
      this.scene.add(this.level, this.glow);
    } else {
      this.level.geometry = b.build();
      this.glow!.geometry = g.build();
    }
    // Point lights: tube lights indoors, canopy lamps at the pump, burning barrels at the gates.
    for (const l of this.tubes) this.scene.remove(l);
    this.tubes.length = 0;
    const lights: Array<[number, number, string, number]> =
      layout === 'mall' ? [[-W / 4, 8, '#dfe6ff', 14], [W / 4, 15, '#dfe6ff', 14], [-W / 4, 22, '#dfe6ff', 14], [W / 4, 29, '#dfe6ff', 14]]
      : layout === 'apartment' ? [[0, 3, '#ffe2b0', 12], [-W / 3, 9, '#dfe6ff', 8], [W / 3, 16, '#dfe6ff', 8], [0, 26, '#dfe6ff', 13]]
      : layout === 'pump' ? [[-6, 11, '#f4f8ff', 16], [6, 11, '#f4f8ff', 16], [-5, 21, '#ffd9a0', 10], [6, 25, '#ffd9a0', 6]]
      : [[-W / 2 + 4, 14, '#ff9a40', 22], [W / 2 - 5, 24, '#ff9a40', 22], [0, 4, '#ffd9a0', 16], [-3, 28, '#ff9a40', 18]];
    for (const [x, y, col, i] of lights) {
      const l = new THREE.PointLight(col, i, indoor ? 11 : 13, 1.4);
      l.position.set(x, indoor ? 3.6 : 3.2, -y);
      l.userData.base = i;
      this.scene.add(l);
      this.tubes.push(l);
    }

    // Zombie meshes, one per zombie.
    for (const m of this.zombieMeshes) this.scene.remove(m);
    this.zombieMeshes.length = 0;
    for (const z of fw.zombies) {
      const grp = new THREE.Group();
      const mesh = new THREE.Mesh(this.zombieGeos[z.variant % this.zombieGeos.length]!, this.mat);
      mesh.castShadow = true;
      if (z.type === 'brute') mesh.scale.set(1.45, 1.28, 1.45);
      else if (z.type === 'runner') mesh.scale.set(0.92, 1.0, 0.92);
      grp.add(mesh);
      this.scene.add(grp);
      this.zombieMeshes.push(grp);
    }
    // Crates.
    for (const c of this.crateMeshes) this.scene.remove(c.g);
    this.crateMeshes.length = 0;
    for (const c of fw.crates) {
      const grp = new THREE.Group();
      const cb = new GeoBuilder();
      cb.box(0.8, 0.55, 0.6, 0, 0.275, 0, '#b08a5a');
      cb.box(0.82, 0.06, 0.1, 0, 0.45, 0, '#8a6a42');
      cb.box(0.3, 0.3, 0.02, 0, 0.3, 0.31, LOOT_COLOUR[c.kind]);
      if (c.kind === 'med') {
        cb.box(0.18, 0.05, 0.03, 0, 0.3, 0.32, '#c8281f');
        cb.box(0.05, 0.18, 0.03, 0, 0.3, 0.32, '#c8281f');
      }
      const crate = new THREE.Mesh(cb.build(), this.mat);
      crate.castShadow = true;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.64), new THREE.MeshLambertMaterial({ color: '#9a7648' }));
      lid.position.y = 0.58;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: '#ffc21a', depthTest: false, transparent: true }));
      bar.position.y = 1.2;
      bar.renderOrder = 5;
      // Glowing marker so supplies stand out in the dark.
      const mark = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 20), new THREE.MeshBasicMaterial({ color: LOOT_COLOUR[c.kind], transparent: true, opacity: 0.55, depthWrite: false }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.y = 0.02;
      grp.add(crate, lid, bar, mark);
      this.scene.add(grp);
      this.crateMeshes.push({ g: grp, bar, lid });
    }
  }

  /** Floor, outer walls and the way out, for each kind of place. */
  private buildFloor(b: GeoBuilder, g: GeoBuilder, W: number, D: number): void {
    const layout = this.world.level.layout;
    if (layout === 'mall') {
      for (let x = 0; x < W; x += 2) for (let y = 0; y < D; y += 2) {
        b.box(2, 0.05, 2, -W / 2 + x + 1, -0.025, -(y + 1), (x + y) % 4 === 0 ? '#8f897c' : '#7f796d');
      }
      b.box(W + 1, 4, 0.4, 0, 2, -D - 0.2, '#6a6e78');
      for (const s of [-1, 1]) b.box(0.4, 4, D + 1, s * (W / 2 + 0.2), 2, -D / 2, '#5e626c');
      for (const s of [-1, 1]) {
        b.box(W / 2 - 2, 1.0, 0.3, s * (W / 4 + 1), 0.5, 0.15, '#4a4e58');
        b.box(W / 2 - 2, 0.04, 0.32, s * (W / 4 + 1), 1.0, 0.15, '#2a2e38');
      }
      for (let x = -W / 2 + 4; x < W / 2 - 2; x += 7) b.box(3, 0.7, 0.06, x, 3.2, -D + 0.03, SHELF_GOODS[Math.abs(Math.round(x)) % SHELF_GOODS.length]!);
      g.box(1.2, 0.35, 0.05, 0, 1.4, 0.3, '#3fd07a');
      g.box(2.4, 0.3, 0.05, 0, 3.8, -D + 0.05, '#ff5a4a');
      return;
    }
    if (layout === 'apartment') {
      const c0 = W / 2 - 3;
      const c1 = W / 2 + 3;
      for (let x = 0; x < W; x += 1) for (let y = 0; y < D; y += 1) {
        const room = y >= 5 && y < 19 && (x < c0 || x >= c1);
        const park = y >= 20;
        const col = park ? ((x + y) % 2 ? '#6c6a66' : '#696762')
          : room ? (y % 2 ? '#8a6a4a' : '#7f6243')
          : (x + y) % 2 ? '#c9c4b8' : '#bdb7aa';
        b.box(1, 0.05, 1, -W / 2 + x + 0.5, -0.025, -(y + 0.5), col);
      }
      // Parking bay lines.
      for (let x = 0.6; x < W - 0.5; x += 3.6) for (const y of [21, 26, 32]) b.box(0.08, 0.01, 4.4, -W / 2 + x, 0.006, -(y - 2.2 + (y === 32 ? -0.5 : 2)), '#e8e4d8');
      b.box(W + 1, 3.4, 0.4, 0, 1.7, -D - 0.2, '#8d8a84');
      for (const s of [-1, 1]) b.box(0.4, 3.4, D + 1, s * (W / 2 + 0.2), 1.7, -D / 2, '#b8b0a2');
      // Front: the stairwell, a wall with its door gap.
      for (const s of [-1, 1]) b.box(W / 2 - 2, 3.4, 0.3, s * (W / 4 + 1), 1.7, 0.15, '#b8b0a2');
      b.box(4, 0.2, 0.3, 0, 3.3, 0.15, '#b8b0a2');
      // Letter boxes and the society notice board in the lobby.
      for (let i = 0; i < 6; i++) b.box(0.35, 0.3, 0.12, -W / 2 + 1.2 + i * 0.4, 1.5, -0.3, i % 2 ? '#3f6aa8' : '#2f5a98');
      b.box(1.6, 1, 0.06, W / 2 - 2, 1.8, -0.32, '#5a3f2a');
      g.box(1.2, 0.35, 0.05, 0, 2.4, -0.05, '#3fd07a');
      return;
    }
    // Outdoors: asphalt or yard, and the highway or the camp road in front.
    const yard = layout === 'gates';
    for (let x = 0; x < W; x += 2) for (let y = 0; y < D; y += 2) {
      const n = ((x * 13 + y * 7) % 5) / 5;
      const col = yard ? (n < 0.4 ? '#6b5a44' : n < 0.8 ? '#735f47' : '#66553f') : n < 0.5 ? '#3c3d42' : '#38393e';
      b.box(2, 0.05, 2, -W / 2 + x + 1, -0.025, -(y + 1), col);
    }
    // Ground beyond the edges, so the view never ends in black.
    b.box(W + 60, 0.02, D + 60, 0, -0.06, -D / 2, yard ? '#4c4232' : '#3b4a32');
    if (!yard) {
      // Forecourt markings and the highway at the front.
      for (const x of [-9, -3, 3, 9]) b.box(0.1, 0.01, 6, x, 0.006, -11, '#e8e4d8');
      b.box(W + 60, 0.03, 6, 0, -0.01, 2.2, '#2e2f33');
      for (let x = -W / 2 - 28; x < W / 2 + 28; x += 6) b.box(3, 0.01, 0.15, x, 0.012, 2.2, '#e8e4d8');
      // Hedge and a low wall round the back and sides.
      for (const s of [-1, 1]) b.box(0.6, 0.9, D, s * (W / 2 + 0.3), 0.45, -D / 2, '#3e5a34');
      b.box(W + 1, 0.9, 0.6, 0, 0.45, -D - 0.3, '#3e5a34');
      // Canopy frame over the pumps: beams only, so the camera sees under it, with lit strips.
      for (const x of [-9, 9]) b.box(0.3, 0.4, 7, x, 4.6, -11, '#e6e2da');
      for (const z of [-8, -14]) b.box(18.3, 0.4, 0.3, 0, 4.6, z, '#e6e2da');
      for (const z of [-8, -14]) g.box(18, 0.08, 0.12, 0, 4.38, z, '#f4f8ff');
      // A tall price board on a pole, blank.
      b.box(0.3, 6, 0.3, W / 2 - 1.5, 3, -1.5, '#9aa0a8');
      b.box(1.6, 2.4, 0.2, W / 2 - 1.5, 6.4, -1.5, '#2a2f38');
      g.box(1.3, 0.3, 0.05, W / 2 - 1.5, 7.2, -1.38, '#ffb02e');
      this.parkedRig(b, -4.5, 2.4);
      return;
    }
    // Camp gates: chain-link fence round the yard, the camp gate and towers at the front.
    const fence = (x0: number, z0: number, x1: number, z1: number): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.5));
      for (let i = 0; i <= n; i++) b.box(0.1, 2.4, 0.1, x0 + ((x1 - x0) * i) / n, 1.2, z0 + ((z1 - z0) * i) / n, '#6f747a');
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const ry = Math.atan2(x1 - x0, z1 - z0);
      b.box(0.03, 2.0, len, cx, 1.2, cz, '#8f969c', 0, ry, 0);
      b.box(0.05, 0.05, len, cx, 2.45, cz, '#4a4e54', 0, ry, 0);
    };
    fence(-W / 2, 0, -W / 2, -D);
    fence(W / 2, 0, W / 2, -D);
    fence(-W / 2, -D, W / 2, -D);
    // Camp wall and the steel gate behind the exit, kept low so the camera sees over them.
    for (const sx of [-1, 1]) {
      b.box(W / 2 - 2.5, 1.4, 0.6, sx * (W / 4 + 1.25), 0.7, 0.6, '#8d8676');
      b.box(1.2, 1.9, 1.2, sx * 3.0, 0.95, 0.7, '#7d7666');
    }
    b.box(4.6, 1.3, 0.2, 0, 0.65, 0.75, '#5a6a56');
    for (let x = -2; x <= 2; x += 0.5) b.box(0.06, 1.3, 0.24, x, 0.65, 0.72, '#3e4a3c');
    // Floodlight masts at the back corners: dark until the generator runs.
    for (const sx of [-1, 1]) {
      b.box(0.3, 7, 0.3, sx * (W / 2 - 1), 3.5, -D + 1, '#5a5448');
      b.box(1.2, 0.5, 0.4, sx * (W / 2 - 1), 7.1, -D + 1.2, '#2a2a2e');
    }
    // Barbed wire coil on top of the wall.
    for (let x = -W / 2 + 1; x < W / 2 - 1; x += 0.7) if (Math.abs(x) > 2.6) b.box(0.5, 0.18, 0.5, x, 1.5, 0.6, '#9aa0a6', 0, x, 0.5);
    this.parkedRig(b, -W / 2 + 4.5, -3.5);
    // Oil drums with fires in them, the only light in the yard.
    for (const [x, y] of [[-W / 2 + 4, 14], [W / 2 - 5, 24], [-3, 28]] as Array<[number, number]>) {
      if (this.world.blocked(x + W / 2, y, 0.5)) continue;
      b.cylinder(0.4, 0.9, x, 0.45, -y, '#3d4a3a', 10);
      g.blob(0.35, x, 1.05, -y, '#ff8a2a', 0.8);
      g.blob(0.22, x + 0.1, 1.35, -y, '#ffd25a', 1.2);
    }
  }

  /** Raj's SUV parked at the edge, with the family inside. */
  private parkedRig(_b: GeoBuilder, x: number, z: number): void {
    if (this.rig) {
      this.scene.remove(this.rig);
      this.rig.geometry.dispose();
    }
    this.rig = new THREE.Mesh(playerVehicleGeo('rig', this.paint), this.mat);
    this.rig.rotation.y = Math.PI / 2;
    this.rig.position.set(x, 0, z);
    this.rig.castShadow = true;
    this.scene.add(this.rig);
  }

  private rig: THREE.Mesh | null = null;

  paint: string | undefined;

  /** One blocker: shelves, walls, cars and the rest, by kind. */
  private buildShelf(b: GeoBuilder, g: GeoBuilder, cx: number, cz: number, hw: number, hh: number, kind: number, sx: number, sy: number): void {
    const seed = Math.abs(Math.floor(sx * 7 + sy * 13));
    if (kind === 0) {
      // Grey shelf unit with rows of goods on both faces; some knocked over.
      b.box(hw * 2, 1.9, hh * 2, cx, 0.95, cz, '#7a7f88');
      for (let lvl = 0; lvl < 4; lvl++) {
        const yy = 0.3 + lvl * 0.45;
        b.box(hw * 2 + 0.12, 0.04, hh * 2, cx, yy - 0.04, cz, '#5a5e66');
        for (let z = -hh + 0.25; z < hh - 0.1; z += 0.5) {
          const k = Math.abs(Math.floor(sx * 7 + sy * 3 + z * 11 + lvl * 5)) % SHELF_GOODS.length;
          if ((k + lvl) % 7 === 0) continue;
          for (const side of [-1, 1]) b.box(0.18, 0.3, 0.4, cx + side * (hw - 0.02), yy + 0.15, cz + z, SHELF_GOODS[k]!);
        }
      }
    } else if (kind === 1) {
      b.box(hw * 2, 0.95, hh * 2, cx, 0.475, cz, '#6a7080');
      b.box(hw * 2 + 0.06, 0.05, hh * 2 + 0.06, cx, 0.97, cz, '#2a2a2e');
      b.box(0.4, 0.3, 0.3, cx - hw * 0.4, 1.12, cz, '#1e2026');
      b.box(0.36, 0.22, 0.03, cx - hw * 0.4, 1.32, cz + 0.12, '#2f4458');
    } else if (kind === 2) {
      b.box(hw * 2, 4, hh * 2, cx, 2, cz, '#8a8e96');
    } else if (kind === 3) {
      // Plastered wall with a dark skirting.
      b.box(hw * 2, 2.6, hh * 2, cx, 1.3, cz, '#d8cfbf');
      b.box(hw * 2 + 0.04, 0.18, hh * 2 + 0.04, cx, 0.09, cz, '#6a5a4a');
    } else if (kind === 4) {
      const cols = ['#c0392b', '#e8e4d8', '#2c6fb0', '#3d3f44', '#d98e04', '#6a7a5a'];
      car(b, cx, cz, cols[seed % cols.length]!, seed % 2 ? 1 : -1, false, hh * 2 - 0.1, null, seed % 3 === 0 ? 'hatch' : 'sedan');
    } else if (kind === 5) {
      // Fuel dispenser island: kerb, two pumps, hoses.
      b.box(hw * 2 + 0.3, 0.2, hh * 2 + 0.3, cx, 0.1, cz, '#d9d4cc');
      for (const dz of [-0.8, 0.8]) {
        b.box(0.7, 1.7, 0.5, cx, 1.05, cz + dz, '#e6e2da');
        b.box(0.72, 0.35, 0.52, cx, 1.75, cz + dz, '#2f7a4a');
        b.box(0.04, 0.3, 0.4, cx + 0.37, 1.3, cz + dz, '#1e2a36');
        b.box(0.1, 0.5, 0.1, cx - 0.4, 0.9, cz + dz, '#1c1c1f');
      }
    } else if (kind === 6) {
      // Sandbags, three rows, staggered.
      for (let row = 0; row < 3; row++) {
        const n = Math.floor((hw * 2) / 0.7);
        for (let i = 0; i < n; i++) {
          const off = row % 2 ? 0.35 : 0;
          const x = cx - hw + 0.35 + i * 0.7 + off;
          if (x > cx + hw - 0.2) continue;
          b.box(0.66, 0.3, hh * 2 - 0.1, x, 0.15 + row * 0.3, cz, (i + row) % 3 ? '#a8946a' : '#9a8660');
        }
      }
    } else if (kind === 7) {
      // Army tent: square, sloped roof.
      b.box(hw * 2, 1.2, hh * 2, cx, 0.6, cz, '#5f6a48');
      b.cylinder(hw * 1.45, 1.2, cx, 1.8, cz, '#56603f', 4, 0.05);
      b.box(0.8, 1.0, 0.05, cx, 0.5, cz + hh + 0.01, '#3a4030');
    } else if (kind === 8) {
      // Sofa or cupboard in a flat.
      const sofa = seed % 2 === 0;
      if (sofa) {
        b.box(hw * 2, 0.45, hh * 2, cx, 0.25, cz, '#7a3f3a');
        b.box(hw * 2, 0.5, 0.2, cx, 0.7, cz - hh + 0.1, '#6a3532');
      } else {
        b.box(hw * 2, 2.0, hh * 2, cx, 1.0, cz, '#8a6a4a');
        b.box(0.04, 1.8, 0.02, cx, 1.0, cz + hh + 0.01, '#5a3f2a');
      }
    } else if (kind === 9) {
      // Kiosk: shop with a shutter half down and a lit fridge inside.
      b.box(hw * 2, 3, hh * 2, cx, 1.5, cz, '#e6e2da');
      b.box(hw * 2 + 0.3, 0.35, hh * 2 + 0.3, cx, 3.1, cz, '#2f7a4a');
      b.box(hw * 1.4, 1.2, 0.08, cx, 2.2, cz + hh + 0.02, '#8e9399');
      g.box(hw * 1.3, 0.9, 0.05, cx, 1.1, cz + hh + 0.03, '#cfe8ff');
    } else if (kind === 10) {
      // Truck: cab and a covered cargo bed, along the length.
      const front = cz + hh - 0.9;
      b.box(hw * 2, 1.9, 1.6, cx, 1.35, front, '#4f5a40');
      b.box(hw * 2 - 0.1, 0.6, 0.05, cx, 1.8, front + 0.81, '#2a3e52');
      b.box(hw * 2, 2.2, hh * 2 - 1.8, cx, 1.5, cz - 0.9, '#5f6a48');
      for (const z of [front, cz - hh + 0.8, cz - hh + 2]) for (const s of [-1, 1]) b.cylinder(0.42, 0.3, cx + s * hw, 0.42, z, '#18181b', 10);
    } else if (kind === 11) {
      // Generator: yellow casing, control panel and exhaust.
      b.box(hw * 2, 1.3, hh * 2, cx, 0.65, cz, '#d9a520');
      b.box(hw * 2 + 0.1, 0.1, hh * 2 + 0.1, cx, 1.32, cz, '#2a2a2e');
      b.box(0.6, 0.5, 0.05, cx - hw * 0.4, 0.9, cz + hh + 0.02, '#1e2026');
      b.cylinder(0.1, 0.8, cx + hw * 0.6, 1.7, cz, '#3d3f44', 6);
      this.genAt = [cx - hw * 0.4, cz + hh + 0.06];
    }
  }

  /** Where the generator's status light sits. */
  private genAt: [number, number] | null = null;

  addShake(a: number): void {
    this.shake = Math.max(this.shake, a);
  }

  hurt(): void {
    this.hurtFlash = 1;
    this.addShake(10);
  }

  popText(text: string, x: number, y: number, colour: string): void {
    const i = this.popNext;
    this.popNext = (i + 1) % POPUPS;
    const el = this.popEls[i]!;
    el.textContent = text;
    el.style.color = colour;
    el.style.fontSize = '20px';
    el.hidden = false;
    this.popLife[i] = 1;
    this.popPos[i]!.set(x - this.world.level.width / 2, 2.2, -y);
  }

  hidePopups(): void {
    for (const el of this.popEls) el.hidden = true;
    this.popLife.fill(0);
  }

  draw(alpha: number, dt: number, weapon: 'bat' | 'machete'): void {
    const fw = this.world;
    const key = `${fw.level.layout}:${fw.level.width}x${fw.level.depth}:${fw.shelves.length}:${fw.shelves[0]?.y ?? 0}:${fw.crates[0]?.x ?? 0}`;
    if (this.builtFor !== fw || key !== this.layoutKey) {
      this.layoutKey = key;
      this.build();
    }
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    const ox = -fw.level.width / 2;
    const px = ox + fw.prevX + (fw.x - fw.prevX) * alpha;
    const pz = -(fw.prevY + (fw.y - fw.prevY) * alpha);

    // Raj: face the way he walks, bob while walking, swing the weapon.
    this.raj.position.set(px, fw.moving && fw.alive ? Math.abs(Math.sin(this.time * 11)) * 0.06 : 0, pz);
    this.raj.rotation.y = Math.atan2(Math.cos(fw.facing), -Math.sin(fw.facing));
    if (!fw.alive) this.raj.rotation.x = Math.max(this.raj.rotation.x - dt * 3, -1.4);
    else this.raj.rotation.x = 0;
    this.armMeshes.bat.visible = weapon === 'bat';
    this.armMeshes.machete.visible = weapon === 'machete';
    const k = fw.swingK;
    // Wind up over the shoulder, then sweep across in front.
    // Idle: weapon held low and forward. Swing: raised, then swept across.
    if (k > 0) this.arm.rotation.set(-0.5 + Math.sin((1 - k) * Math.PI) * 0.5, 1.4 - (1 - k) * 2.8, 0);
    else this.arm.rotation.set(0.75 + Math.sin(this.time * 2) * 0.04, 0.25, 0);
    this.raj.visible = !(fw.invuln > 0.3 && Math.floor(this.time * 16) % 2 === 0);

    // Torch follows Raj's facing.
    const fx = Math.cos(fw.facing);
    const fz = -Math.sin(fw.facing);
    this.torch.position.set(px + fx * 0.3, 1.5, pz + fz * 0.3);
    this.torch.target.position.set(px + fx * 8, 0, pz + fz * 8);
    this.torch.intensity = 60 + Math.sin(this.time * 31) * 2;
    for (let i = 0; i < this.tubes.length; i++) {
      // One tube flickers.
      const l = this.tubes[i]!;
      const base = l.userData.base as number;
      const fire = this.world.level.layout === 'gates' && i !== 2;
      l.intensity = fire ? base * (0.8 + Math.sin(this.time * 13 + i) * 0.12 + Math.sin(this.time * 31 + i * 2) * 0.08)
        : i === 1 ? (Math.sin(this.time * 23) > 0.3 || Math.sin(this.time * 3.1) > 0.8 ? base : base * 0.15) : base;
    }

    // Zombies: shamble, lunge, stagger, fall and fade.
    fw.zombies.forEach((z, i) => {
      const m = this.zombieMeshes[i];
      if (!m) return;
      m.visible = z.active;
      if (!z.active) return;
      m.position.set(ox + z.x, 0, -z.y);
      const face = Math.atan2(Math.cos(z.facing), -Math.sin(z.facing));
      let rx = 0;
      let rz = 0;
      if (z.down > 0) {
        const t = Math.min(1, z.down / 0.35);
        rx = -t * 1.45;
        rz = z.fall * t * 0.4;
        m.position.y = -Math.max(0, z.down - 0.9) * 0.8;
      } else {
        const speed = ZOMBIES[z.type].speed;
        const ph = this.time * (2 + speed * 1.6) + i;
        rz = Math.sin(ph) * (z.type === 'runner' ? 0.05 : 0.1);
        m.position.y = Math.abs(Math.sin(ph)) * (z.type === 'runner' ? 0.08 : 0.03);
        if (z.lunge > 0) rx = 0.35;
        if (z.stagger > 0) rx = -0.3;
      }
      m.rotation.set(rx, face, rz);
    });

    // Crates: lid lifts while searching, progress bar above.
    fw.crates.forEach((c, i) => {
      const m = this.crateMeshes[i];
      if (!m) return;
      m.g.position.set(ox + c.x, 0, -c.y);
      m.lid.position.y = c.active ? 0.58 + c.search * 0.18 : 0.75;
      m.lid.rotation.z = c.active ? c.search * 0.4 : 0.9;
      m.bar.visible = c.active && c.search > 0.02;
      m.bar.scale.x = Math.max(0.01, c.search);
      m.bar.quaternion.copy(this.camera.quaternion);
      (m.g.children[3] as THREE.Mesh).visible = c.active;
    });

    // Exit marker: red until the supplies are found, then green and pulsing.
    this.exit.position.set(0, 0.03, -0.8);
    const gates = fw.level.layout === 'gates';
    this.genLamp.visible = gates && this.genAt !== null;
    if (this.genAt) this.genLamp.position.set(this.genAt[0], 0.9, this.genAt[1]);
    (this.genLamp.material as THREE.MeshBasicMaterial).color.set(fw.exitOpen ? '#3fd07a' : Math.sin(this.time * 6) > 0 ? '#ff3a2a' : '#5a1410');
    // Power back on: the floodlights on the gate towers light the yard.
    this.flood.visible = gates && fw.exitOpen;
    this.flood.position.set(0, 7, -2);
    this.flood.target.position.set(px * 0.5, 0, pz);
    const em = this.exit.material as THREE.MeshBasicMaterial;
    em.color.set(fw.exitOpen ? '#3fd07a' : '#c8281f');
    em.opacity = fw.exitOpen ? 0.35 + Math.sin(this.time * 5) * 0.2 : 0.22;

    // Camera: high and behind, looking forward into the store.
    const c = this.camera;
    const portrait = c.aspect < 1;
    const dist = portrait ? 19 : 15;
    c.fov = portrait ? 50 : 40;
    c.updateProjectionMatrix();
    const lookZ = pz - (portrait ? 3.2 : 2.2);
    c.position.set(px * 0.85 + 2.2, dist * 0.82, lookZ + dist * 0.62);
    if (this.shake > 0) {
      c.position.x += (Math.random() - 0.5) * this.shake * 0.02;
      c.position.y += (Math.random() - 0.5) * this.shake * 0.02;
    }
    c.lookAt(px * 0.85, 0, lookZ);
    this.moon.position.set(px - 8, 20, pz + 6);
    this.moon.target.position.set(px, 0, pz);
    const sky = fw.level.layout === 'pump' || gates ? '#151b29' : '#0f1116';
    this.scene.background = (this.scene.background as THREE.Color).set(this.hurtFlash > 0 ? '#2a0f12' : sky);
    (this.scene.fog as THREE.Fog).color.set(sky);

    // A darker exposure than the street views; put the street's back afterwards.
    const exposure = this.gl.toneMappingExposure;
    this.gl.toneMappingExposure = 1.0;
    this.gl.render(this.scene, c);
    this.gl.toneMappingExposure = exposure;
    this.updatePopups(dt);
  }

  private updatePopups(dt: number): void {
    for (let i = 0; i < POPUPS; i++) {
      const el = this.popEls[i]!;
      let life = this.popLife[i]!;
      if (life <= 0) continue;
      life -= dt / 1.1;
      this.popLife[i] = life;
      if (life <= 0) {
        el.hidden = true;
        continue;
      }
      this.tmp.copy(this.popPos[i]!).project(this.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * this.w;
      const y = (-this.tmp.y * 0.5 + 0.5) * this.h - (1 - life) * 50;
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = String(Math.min(1, life * 2.5));
    }
  }
}
