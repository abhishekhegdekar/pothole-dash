import * as THREE from 'three';
import { BALANCE as B } from '../data/balance';
import { laneCenter } from '../systems/collision';
import type { World } from '../systems/world';
import type { GraphicsQuality } from '../storage/save';
import type { GameRenderer } from '../render/types';
import { buildBlock, CHUNK_M, MUMBAI, ROAD_W, roadTexture, type CityStyle } from './city';
import { buildAuto, buildPotholeShapes, type PotholeShape } from './models';

const BLOCK_VARIANTS = 6;
const CHUNK_POOL = 8;
const PARTICLES = 90;
const POPUPS = 8;
/** The 3D camera sees further up the road than the 2D view, so rows are spawned further ahead. */
const VIEW_AHEAD = 46;

const DUST = 0;
const DEBRIS = 1;
const EXHAUST = 2;
const SMOKE = 3;
const PARTICLE_COLOURS = ['#c8b08a', '#3a332c', '#e2e2e6', '#3b3b40'];

/** Picks a block design for chunk k (deterministic, so a block looks the same when you pass it again). */
function blockVariant(k: number): number {
  return (Math.imul(k + 7, 2654435761) >>> 0) % BLOCK_VARIANTS;
}
function roadVariant(k: number): number {
  const h = (Math.imul(k + 3, 40503) >>> 0) % 7;
  return h === 0 ? 3 : h % 3;
}

interface Chunk {
  k: number;
  block: THREE.Mesh;
  road: THREE.Mesh;
}

interface PotholeMesh {
  group: THREE.Group;
  rim: THREE.Mesh;
  hole: THREE.Mesh;
  deep: THREE.Mesh;
  water: THREE.Mesh;
}

/** 2.5D isometric view: a low-poly 3D street under an angled camera. */
export class Renderer3D implements GameRenderer {
  speedFx = 0;
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  private readonly sun: THREE.DirectionalLight;
  private readonly ground: THREE.Mesh;
  private readonly chunks: Chunk[] = [];
  private readonly blockGeos: THREE.BufferGeometry[] = [];
  private readonly roadMats: THREE.MeshLambertMaterial[] = [];
  private readonly potholes: PotholeMesh[] = [];
  private readonly shapes: PotholeShape[][];
  private readonly auto: THREE.Group;
  private readonly pX = new Float32Array(PARTICLES);
  private readonly pY = new Float32Array(PARTICLES);
  private readonly pH = new Float32Array(PARTICLES);
  private readonly pVx = new Float32Array(PARTICLES);
  private readonly pVy = new Float32Array(PARTICLES);
  private readonly pVh = new Float32Array(PARTICLES);
  private readonly pLife = new Float32Array(PARTICLES);
  private readonly pMax = new Float32Array(PARTICLES);
  private readonly pSize = new Float32Array(PARTICLES);
  private readonly pKind = new Uint8Array(PARTICLES);
  private readonly sprites: THREE.Sprite[] = [];
  private pNext = 0;
  private readonly popEls: HTMLDivElement[] = [];
  private readonly popX = new Float32Array(POPUPS);
  private readonly popY = new Float32Array(POPUPS);
  private readonly popLife = new Float32Array(POPUPS);
  private popNext = 0;
  private readonly tmp = new THREE.Vector3();
  private w = 1;
  private h = 1;
  private dpr = 1;
  private quality: GraphicsQuality;
  private time = 0;
  private shake = 0;
  private crashDir = 1;
  private puff = 0;
  private smoke = 0;

  constructor(canvas: HTMLCanvasElement, private readonly world: World, quality: GraphicsQuality, style: CityStyle = MUMBAI) {
    this.quality = quality;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    world.viewAhead = VIEW_AHEAD;

    // Warm, hazy Mumbai evening.
    const sky = new THREE.Color('#e8c7a2');
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 40, 110);
    this.scene.add(new THREE.HemisphereLight('#ffe7c4', '#6d5a46', 1.6));
    this.sun = new THREE.DirectionalLight('#ffd6a0', 2.6);
    this.sun.shadow.camera.left = -26;
    this.sun.shadow.camera.right = 26;
    this.sun.shadow.camera.top = 34;
    this.sun.shadow.camera.bottom = -34;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: style.ground }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.03;
    this.scene.add(this.ground);

    // Street blocks: a few designs, reused as the road scrolls.
    const blockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (let i = 0; i < BLOCK_VARIANTS; i++) this.blockGeos.push(buildBlock(style, 1000 + i * 77));
    const aniso = this.gl.capabilities.getMaxAnisotropy();
    for (let i = 0; i < 4; i++) {
      const tex = new THREE.CanvasTexture(roadTexture(world.laneCount, i === 3, 50 + i));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, aniso);
      this.roadMats.push(new THREE.MeshLambertMaterial({ map: tex }));
    }
    const roadGeo = new THREE.PlaneGeometry(ROAD_W, CHUNK_M);
    roadGeo.rotateX(-Math.PI / 2);
    roadGeo.translate(0, 0, -CHUNK_M / 2);
    for (let i = 0; i < CHUNK_POOL; i++) {
      const block = new THREE.Mesh(this.blockGeos[0], blockMat);
      block.castShadow = true;
      block.receiveShadow = true;
      const road = new THREE.Mesh(roadGeo, this.roadMats[0]);
      road.receiveShadow = true;
      this.scene.add(block, road);
      this.chunks.push({ k: -999, block, road });
    }

    // Potholes: one mesh set per obstacle slot in the world's pool.
    this.shapes = buildPotholeShapes();
    const rimMat = new THREE.MeshLambertMaterial({ color: '#77716a' });
    const holeMat = new THREE.MeshLambertMaterial({ color: '#2b241e' });
    const deepMat = new THREE.MeshLambertMaterial({ color: '#130f0c' });
    const waterMat = new THREE.MeshLambertMaterial({ color: '#7d8a8c', transparent: true, opacity: 0.6 });
    const first = this.shapes[0]![0]!;
    for (let i = 0; i < world.obstacles.length; i++) {
      const group = new THREE.Group();
      const rim = new THREE.Mesh(first.rim, rimMat);
      const hole = new THREE.Mesh(first.hole, holeMat);
      const deep = new THREE.Mesh(first.deep, deepMat);
      const water = new THREE.Mesh(first.rim, waterMat);
      for (const m of [rim, hole, deep, water]) m.receiveShadow = true;
      group.add(rim, hole, deep, water);
      group.visible = false;
      this.scene.add(group);
      this.potholes.push({ group, rim, hole, deep, water });
    }

    this.auto = buildAuto();
    this.scene.add(this.auto);

    for (let i = 0; i < PARTICLES; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#ffffff', transparent: true, depthWrite: false }));
      s.visible = false;
      this.sprites.push(s);
      this.scene.add(s);
    }

    // Floating text popups are HTML, positioned over the 3D view each frame.
    const layer = document.createElement('div');
    layer.className = 'popups';
    canvas.parentElement?.appendChild(layer);
    for (let i = 0; i < POPUPS; i++) {
      const el = document.createElement('div');
      el.className = 'popup';
      el.hidden = true;
      layer.appendChild(el);
      this.popEls.push(el);
    }
    this.setQuality(quality);
  }

  setQuality(q: GraphicsQuality): void {
    this.quality = q;
    const shadows = q === 'high';
    this.gl.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m && !Array.isArray(m)) m.needsUpdate = true;
    });
    this.resize(this.w, this.h, this.dpr);
  }

  resize(wCss: number, hCss: number, devicePixelRatio: number): void {
    this.w = Math.max(1, wCss);
    this.h = Math.max(1, hCss);
    this.dpr = devicePixelRatio || 1;
    this.gl.setPixelRatio(Math.min(this.dpr, this.quality === 'high' ? 1.75 : 1));
    this.gl.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  resetRun(): void {
    this.pLife.fill(0);
    this.popLife.fill(0);
    for (const el of this.popEls) el.hidden = true;
    this.shake = 0;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  burst(x: number, y: number): void {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 4;
      this.spawn(x, y, 0.3, Math.cos(a) * s, Math.sin(a) * s + this.world.speed * 0.5, 2 + Math.random() * 3, 0.5 + Math.random() * 0.4, 0.25 + Math.random() * 0.3, i % 3 === 0 ? DEBRIS : DUST);
    }
  }

  crash(dir: number): void {
    this.crashDir = dir >= 0 ? 1 : -1;
  }

  popText(text: string, x: number, y: number, colour: string, size: number): void {
    const i = this.popNext;
    this.popNext = (this.popNext + 1) % POPUPS;
    const el = this.popEls[i]!;
    el.textContent = text;
    el.style.color = colour;
    el.style.fontSize = `${size}px`;
    el.hidden = false;
    this.popX[i] = x;
    this.popY[i] = y;
    this.popLife[i] = 1;
  }

  private spawn(x: number, y: number, h: number, vx: number, vy: number, vh: number, life: number, size: number, kind: number): void {
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % PARTICLES;
    this.pX[i] = x;
    this.pY[i] = y;
    this.pH[i] = h;
    this.pVx[i] = vx;
    this.pVy[i] = vy;
    this.pVh[i] = vh;
    this.pLife[i] = life;
    this.pMax[i] = life;
    this.pSize[i] = size;
    this.pKind[i] = kind;
  }

  draw(alpha: number, frameDt: number, running: boolean, mode: 'menu' | 'game' = 'game'): void {
    const { world } = this;
    this.time += frameDt;
    this.shake = Math.max(0, this.shake - frameDt * 30);
    const cam = world.prevDist + (world.dist - world.prevDist) * alpha;
    const lane = world.prevLanePos + (world.lanePos - world.prevLanePos) * alpha;
    const px = laneCenter(lane) - ROAD_W / 2;
    const speedK = world.alive ? Math.max(0, Math.min(1, (world.speed - 11) / (B.maxSpeed - 11))) : 0;
    this.speedFx += (speedK - this.speedFx) * Math.min(1, frameDt * 3);

    this.placeChunks(cam);
    this.placePotholes(cam);

    // The auto: steer yaw, body roll, engine bounce, spin-out after the crash.
    const steer = world.targetLane - lane;
    const crashK = world.alive ? 0 : 1 - Math.pow(1 - Math.min(1, world.crashT / 1.1), 3);
    this.auto.position.set(px, running && world.alive ? Math.abs(Math.sin(this.time * 20)) * 0.035 : 0, -cam);
    this.auto.rotation.set(0, world.alive ? -steer * 0.4 : crashK * 2.7 * this.crashDir, world.alive ? steer * 0.08 : 0);
    this.auto.visible = !(world.invuln > 0 && world.alive && Math.floor(this.time * 14) % 2 === 0);

    // Exhaust while driving, smoke after the crash.
    if (running && world.alive) {
      this.puff -= frameDt;
      if (this.puff <= 0) {
        this.puff = 0.06;
        this.spawn(laneCenter(lane) + 0.35, cam - 1.3, 0.35, (Math.random() - 0.5) * 0.4, world.speed * 0.8, 0.6, 0.5, 0.22, EXHAUST);
      }
    }
    if (!world.alive && world.crashT < 2) {
      this.smoke -= frameDt;
      if (this.smoke <= 0) {
        this.smoke = 0.05;
        this.spawn(laneCenter(lane) + (Math.random() - 0.5) * 0.8, cam + (Math.random() - 0.5), 1, (Math.random() - 0.5), 0.5, 1.5 + Math.random(), 1.1, 0.45 + Math.random() * 0.3, SMOKE);
      }
    }
    this.updateParticles(frameDt);

    this.placeCamera(cam, px, mode);
    this.placeSun(px, cam);
    this.gl.render(this.scene, this.camera);
    this.updatePopups(cam, frameDt);
  }

  private placeChunks(cam: number): void {
    const first = Math.floor((cam - 40) / CHUNK_M);
    for (let k = first; k < first + CHUNK_POOL; k++) {
      const c = this.chunks[((k % CHUNK_POOL) + CHUNK_POOL) % CHUNK_POOL]!;
      if (c.k === k) continue;
      c.k = k;
      c.block.geometry = this.blockGeos[blockVariant(k)]!;
      c.road.material = this.roadMats[roadVariant(k)]!;
      c.block.position.z = -k * CHUNK_M;
      c.road.position.z = -k * CHUNK_M;
    }
    this.ground.position.z = -cam;
  }

  private placePotholes(cam: number): void {
    const obs = this.world.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i]!;
      const m = this.potholes[i]!;
      const show = o.active && o.y > cam - 30 && o.y < cam + VIEW_AHEAD + 10;
      m.group.visible = show;
      if (!show) continue;
      const shape = this.shapes[o.kind]?.[o.variant];
      if (!shape) continue;
      m.rim.geometry = shape.rim;
      m.hole.geometry = shape.hole;
      m.deep.geometry = shape.deep;
      m.water.visible = shape.water !== null;
      if (shape.water) m.water.geometry = shape.water;
      m.group.position.set(o.x - ROAD_W / 2, 0, -o.y);
    }
  }

  private placeCamera(cam: number, px: number, mode: 'menu' | 'game'): void {
    const c = this.camera;
    const menu = mode === 'menu';
    c.fov = menu ? 34 : 38 + this.speedFx * 9;
    c.updateProjectionMatrix();
    // Angled view from above, behind and a little to the right: the 2.5D look.
    const yaw = menu ? 0.38 + Math.sin(this.time * 0.15) * 0.12 : 0.3;
    const elev = menu ? 0.82 : 0.92;
    // Pull back far enough that the road plus its footpaths fill the width on narrow phones.
    const halfH = Math.tan((c.fov * Math.PI) / 360);
    const needW = menu ? 17 : 13.5;
    let dist = needW / 2 / (halfH * c.aspect);
    const wide = c.aspect > 1;
    dist = Math.max(menu ? 22 : wide ? 24 : 19, Math.min(menu ? 40 : 44, dist));
    const lookX = menu ? 0 : px * 0.3;
    const lookZ = -cam - (menu ? 16 : wide ? 4 : 7);
    c.position.set(lookX + Math.sin(yaw) * Math.cos(elev) * dist, Math.sin(elev) * dist, lookZ + Math.cos(yaw) * Math.cos(elev) * dist);
    if (this.shake > 0) {
      c.position.x += (Math.random() - 0.5) * this.shake * 0.03;
      c.position.y += (Math.random() - 0.5) * this.shake * 0.03;
    }
    c.lookAt(lookX, 0, lookZ);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = dist + 18;
    fog.far = dist + 75;
  }

  private placeSun(px: number, cam: number): void {
    this.sun.position.set(px - 14, 26, -cam - 2);
    this.sun.target.position.set(px, 0, -cam - 14);
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < PARTICLES; i++) {
      const s = this.sprites[i]!;
      let life = this.pLife[i]!;
      if (life <= 0) {
        s.visible = false;
        continue;
      }
      life -= dt;
      this.pLife[i] = life;
      this.pX[i] = this.pX[i]! + this.pVx[i]! * dt;
      this.pY[i] = this.pY[i]! + this.pVy[i]! * dt;
      const kind = this.pKind[i]!;
      const rising = kind === EXHAUST || kind === SMOKE;
      this.pVh[i] = rising ? this.pVh[i]! : this.pVh[i]! - 9 * dt;
      this.pH[i] = Math.max(0.05, this.pH[i]! + this.pVh[i]! * dt);
      this.pVx[i] = this.pVx[i]! * 0.96;
      this.pVy[i] = this.pVy[i]! * 0.96;
      const k = Math.max(0, life / this.pMax[i]!);
      const size = this.pSize[i]! * (rising ? 1 + (1 - k) * 2.5 : 1);
      s.visible = life > 0;
      s.position.set(this.pX[i]! - ROAD_W / 2, this.pH[i]!, -this.pY[i]!);
      s.scale.set(size, size, size);
      const m = s.material;
      m.color.set(PARTICLE_COLOURS[kind]!);
      m.opacity = kind === EXHAUST ? k * 0.4 : kind === SMOKE ? k * 0.7 : k;
    }
  }

  private updatePopups(cam: number, dt: number): void {
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
      this.tmp.set(this.popX[i]! - ROAD_W / 2, 2.4, -Math.max(this.popY[i]!, cam - 2)).project(this.camera);
      const x = Math.max(70, Math.min(this.w - 70, (this.tmp.x * 0.5 + 0.5) * this.w));
      const y = (-this.tmp.y * 0.5 + 0.5) * this.h - (1 - life) * 50;
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${life > 0.85 ? 1 + (life - 0.85) * 2 : 1})`;
      el.style.opacity = String(Math.min(1, life * 2.5));
    }
  }
}
