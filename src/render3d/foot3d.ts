import * as THREE from 'three';
import { ZOMBIES, type FootWorld, type LootKind } from '../systems/foot';
import { GeoBuilder } from './geo';
import { rajGeo, weaponGeo, zombieGeo } from './props';

const POPUPS = 6;
const SHELF_GOODS = ['#d8432f', '#f2c230', '#2e6fb7', '#3f9e5a', '#f07a1a', '#8b3fa8', '#e8e4da', '#c8281f', '#4fb0c6'];
const LOOT_COLOUR: Record<LootKind, string> = { scrap: '#9aa2aa', fuel: '#c8281f', med: '#f4f2ee', inhaler: '#2e6fb7' };

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
    // Floor tiles in two tones, a dark skirting and the back and side walls.
    for (let x = 0; x < W; x += 2) for (let y = 0; y < D; y += 2) {
      b.box(2, 0.05, 2, ox + x + 1, -0.025, -(y + 1), (x + y) % 4 === 0 ? '#8f897c' : '#7f796d');
    }
    b.box(W + 1, 4, 0.4, 0, 2, -D - 0.2, '#6a6e78');
    for (const s of [-1, 1]) b.box(0.4, 4, D + 1, s * (W / 2 + 0.2), 2, -D / 2, '#5e626c');
    // Front wall with the glass door gap.
    for (const s of [-1, 1]) {
      b.box(W / 2 - 2, 1.0, 0.3, s * (W / 4 + 1), 0.5, 0.15, '#4a4e58');
      b.box(W / 2 - 2, 0.04, 0.32, s * (W / 4 + 1), 1.0, 0.15, '#2a2e38');
    }
    // Signs on the back wall.
    for (let x = -W / 2 + 4; x < W / 2 - 2; x += 7) b.box(3, 0.7, 0.06, x, 3.2, -D + 0.03, SHELF_GOODS[Math.abs(Math.round(x)) % SHELF_GOODS.length]!);
    for (const s of fw.shelves) {
      const cx = ox + s.x;
      const cz = -s.y;
      if (s.kind === 0) {
        // Grey shelf unit with rows of goods on both faces; some knocked over.
        b.box(s.hw * 2, 1.9, s.hh * 2, cx, 0.95, cz, '#7a7f88');
        for (let lvl = 0; lvl < 4; lvl++) {
          const yy = 0.3 + lvl * 0.45;
          b.box(s.hw * 2 + 0.12, 0.04, s.hh * 2, cx, yy - 0.04, cz, '#5a5e66');
          for (let z = -s.hh + 0.25; z < s.hh - 0.1; z += 0.5) {
            const k = Math.abs(Math.floor((s.x * 7 + s.y * 3 + z * 11 + lvl * 5))) % SHELF_GOODS.length;
            if ((k + lvl) % 7 === 0) continue;
            for (const side of [-1, 1]) b.box(0.18, 0.3, 0.4, cx + side * (s.hw - 0.02), yy + 0.15, cz + z, SHELF_GOODS[k]!);
          }
        }
      } else if (s.kind === 1) {
        b.box(s.hw * 2, 0.95, s.hh * 2, cx, 0.475, cz, '#6a7080');
        b.box(s.hw * 2 + 0.06, 0.05, s.hh * 2 + 0.06, cx, 0.97, cz, '#2a2a2e');
        b.box(0.4, 0.3, 0.3, cx - s.hw * 0.4, 1.12, cz, '#1e2026');
        b.box(0.36, 0.22, 0.03, cx - s.hw * 0.4, 1.32, cz + 0.12, '#2f4458');
      } else {
        b.box(s.hw * 2, 4, s.hh * 2, cx, 2, cz, '#8a8e96');
      }
    }
    // Scattered trolleys and spilled boxes.
    for (let i = 0; i < 10; i++) {
      const x = ox + ((i * 7.3) % (W - 2)) + 1;
      const y = 8 + ((i * 11.7) % (D - 10));
      if (fw.blocked(x - ox, y, 0.4)) continue;
      b.box(0.4, 0.3, 0.3, x, 0.15, -y, SHELF_GOODS[i % SHELF_GOODS.length]!, 0, i * 0.7);
    }
    // Emergency exit sign over the door and a glowing sign on the back wall.
    g.box(1.2, 0.35, 0.05, 0, 1.4, 0.3, '#3fd07a');
    g.box(2.4, 0.3, 0.05, 0, 3.8, -D + 0.05, '#ff5a4a');
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
    // Point lights under a few working tubes.
    for (const l of this.tubes) this.scene.remove(l);
    this.tubes.length = 0;
    for (const [x, y] of [[-W / 4, 8], [W / 4, 15], [-W / 4, 22], [W / 4, 29]] as Array<[number, number]>) {
      const l = new THREE.PointLight('#dfe6ff', 14, 11, 1.4);
      l.position.set(x, 3.6, -y);
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
    const key = `${fw.level.width}x${fw.level.depth}:${fw.shelves.length}:${fw.shelves[0]?.y ?? 0}:${fw.crates[0]?.x ?? 0}`;
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
      this.tubes[i]!.intensity = i === 1 ? (Math.sin(this.time * 23) > 0.3 || Math.sin(this.time * 3.1) > 0.8 ? 14 : 2) : 14;
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
    this.scene.background = (this.scene.background as THREE.Color).set(this.hurtFlash > 0 ? '#2a0f12' : '#0f1116');

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
