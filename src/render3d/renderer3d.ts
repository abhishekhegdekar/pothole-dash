import * as THREE from 'three';
import { BALANCE as B } from '../data/balance';
import { laneCenter } from '../systems/collision';
import type { World } from '../systems/world';
import type { GraphicsQuality } from '../storage/save';
import type { GameRenderer, ViewMode } from '../render/types';
import { MAPS, type MapDef } from '../data/maps';
import { ObstacleKind } from '../data/obstacles';
import { buildBlock, CHUNK_M, poolTexture, roadTexture, type BlockGeometry } from './city';
import { buildAuto, type PotholeShape } from './models';
import { buildObstacleGeos, fuelCanGeo, playerVehicleGeo } from './props';
import { VEHICLES, type VehicleId } from '../data/vehicles';
import { createSignAtlas, type SignAtlas } from './signs';
import { Ambient } from './ambient';

const BLOCK_VARIANTS = 6;
const CHUNK_POOL = 8;
const PARTICLES = 90;
const RAIN_MAX = 700;
const SNOW_MAX = 520;
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
  glow: THREE.Mesh;
  pools: THREE.Mesh;
  signs: THREE.Mesh;
  road: THREE.Mesh;
}

interface PotholeMesh {
  group: THREE.Group;
  rim: THREE.Mesh;
  hole: THREE.Mesh;
  deep: THREE.Mesh;
  water: THREE.Mesh;
  prop: THREE.Mesh;
}

/** 2.5D isometric view: a low-poly 3D street under an angled camera. */
export class Renderer3D implements GameRenderer {
  speedFx = 0;
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly headlight: THREE.SpotLight;
  private readonly ground: THREE.Mesh;
  private readonly chunks: Chunk[] = [];
  private blockGeos: BlockGeometry[] = [];
  private roadMats: THREE.MeshLambertMaterial[] = [];
  private readonly roadGeo: THREE.PlaneGeometry;
  private readonly glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly poolMat: THREE.MeshBasicMaterial;
  private readonly propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private obstacleGeos: THREE.BufferGeometry[][] = [];
  private readonly coinMeshes: THREE.Mesh[] = [];
  private readonly canMeshes: THREE.Mesh[] = [];
  private readonly coinMat = new THREE.MeshLambertMaterial({ color: '#ffc21a', emissive: '#7a5200', emissiveIntensity: 0.8 });
  private readonly coinRimMat = new THREE.MeshLambertMaterial({ color: '#e09a00', emissive: '#5a3a00' });
  private readonly tracer: THREE.Line;
  private readonly flash: THREE.PointLight;
  private tracerT = 0;
  private readonly rain: THREE.LineSegments;
  private readonly rainPos: Float32Array;
  private rainCount = 0;
  private readonly snow: THREE.Points;
  private readonly snowPos: Float32Array;
  private readonly snowPhase = new Float32Array(SNOW_MAX);
  private map: MapDef = MAPS.mumbai;
  private readonly atlas: SignAtlas;
  private readonly ambient: Ambient;
  private readonly signMat: THREE.MeshLambertMaterial;
  /** Shared clock for the wind shader. */
  private readonly windTime = { value: 0 };
  private tailMat: THREE.MeshLambertMaterial | null = null;
  private pitch = 0;
  private roadW = 9;
  private readonly potholes: PotholeMesh[] = [];
  private readonly shapes: PotholeShape[][];
  private auto: THREE.Group;
  private vehicleId: VehicleId = 'auto';
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

  constructor(canvas: HTMLCanvasElement, private readonly world: World, quality: GraphicsQuality, map: MapDef = MAPS.mumbai) {
    this.quality = quality;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    world.viewAhead = VIEW_AHEAD;

    this.scene.fog = new THREE.Fog('#000000', 40, 110);
    this.hemi = new THREE.HemisphereLight('#ffe7c4', '#6d5a46', 1.6);
    this.scene.add(this.hemi);
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

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: '#a99273' }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.03;
    this.scene.add(this.ground);

    // Street blocks: a few designs per map, reused as the road scrolls.
    const blockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    // Breeze: leaves and bunting carry a 'sway' weight and move with a gentle, uneven wind.
    blockMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.windTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float sway;\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          if (sway > 0.0) {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            float gust = 0.6 + 0.4 * sin(uTime * 0.35 + wp.z * 0.02);
            float ph = uTime * 1.7 + wp.x * 0.35 + wp.z * 0.23;
            transformed.x += sway * gust * (sin(ph) * 0.16 + sin(ph * 2.3) * 0.05);
            transformed.z += sway * gust * cos(ph * 0.8) * 0.09;
            transformed.y += sway * gust * sin(ph * 1.3) * 0.04;
          }`,
        );
    };
    this.atlas = createSignAtlas();
    this.ambient = new Ambient(this.scene);
    this.signMat = new THREE.MeshLambertMaterial({ map: this.atlas.texture, side: THREE.DoubleSide });
    this.poolMat = new THREE.MeshBasicMaterial({
      map: poolTexture(), vertexColors: true, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.roadGeo = new THREE.PlaneGeometry(9, CHUNK_M);
    const empty = new THREE.BufferGeometry();
    for (let i = 0; i < CHUNK_POOL; i++) {
      const block = new THREE.Mesh(empty, blockMat);
      block.castShadow = true;
      block.receiveShadow = true;
      const glow = new THREE.Mesh(empty, this.glowMat);
      const pools = new THREE.Mesh(empty, this.poolMat);
      pools.renderOrder = 2;
      const signs = new THREE.Mesh(empty, this.signMat);
      signs.receiveShadow = true;
      const road = new THREE.Mesh(this.roadGeo, blockMat);
      road.receiveShadow = true;
      this.scene.add(block, glow, pools, signs, road);
      this.chunks.push({ k: -999, block, glow, pools, signs, road });
    }

    // Obstacles: pothole meshes plus one prop mesh per slot in the world's pool.
    // Potholes are now built like the other obstacles (see props.ts); these slots stay empty.
    this.shapes = [];
    const rimMat = new THREE.MeshLambertMaterial({ color: '#77716a' });
    const holeMat = new THREE.MeshLambertMaterial({ color: '#2b241e' });
    const deepMat = new THREE.MeshLambertMaterial({ color: '#130f0c' });
    const waterMat = new THREE.MeshLambertMaterial({ color: '#7d8a8c', transparent: true, opacity: 0.6 });
    for (let i = 0; i < world.obstacles.length; i++) {
      const group = new THREE.Group();
      const rim = new THREE.Mesh(empty, rimMat);
      const hole = new THREE.Mesh(empty, holeMat);
      const deep = new THREE.Mesh(empty, deepMat);
      const water = new THREE.Mesh(empty, waterMat);
      const prop = new THREE.Mesh(empty, this.propMat);
      prop.castShadow = true;
      prop.receiveShadow = true;
      for (const m of [rim, hole, deep, water]) m.receiveShadow = true;
      group.add(rim, hole, deep, water, prop);
      group.visible = false;
      this.scene.add(group);
      this.potholes.push({ group, rim, hole, deep, water, prop });
    }

    // Coins: gold discs standing on edge.
    const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.09, 18);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = this.coinMat;
    const rimGeo = new THREE.TorusGeometry(0.4, 0.05, 6, 18);
    const rimCoinMat = this.coinRimMat;
    const canGeo = fuelCanGeo();
    for (let i = 0; i < world.coins.length; i++) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.add(new THREE.Mesh(rimGeo, rimCoinMat));
      m.castShadow = true;
      m.visible = false;
      this.scene.add(m);
      this.coinMeshes.push(m);
      const can = new THREE.Mesh(canGeo, this.propMat);
      can.castShadow = true;
      can.visible = false;
      this.scene.add(can);
      this.canMeshes.push(can);
    }

    // Roof gun tracer and muzzle flash.
    this.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffe9a0', transparent: true }));
    this.tracer.frustumCulled = false;
    this.tracer.visible = false;
    this.scene.add(this.tracer);
    this.flash = new THREE.PointLight('#ffcf70', 0, 9, 1.6);
    this.scene.add(this.flash);

    // Rain: short streaks that fall around the camera's target.
    this.rainPos = new Float32Array(RAIN_MAX * 6);
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#b8cbe6', transparent: true, opacity: 0.5 }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    // Snow: round soft points.
    this.snowPos = new Float32Array(SNOW_MAX * 3);
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    const flake = document.createElement('canvas');
    flake.width = flake.height = 32;
    const fctx = flake.getContext('2d')!;
    const fg = fctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    fg.addColorStop(0, 'rgba(255,255,255,1)');
    fg.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    fg.addColorStop(1, 'rgba(255,255,255,0)');
    fctx.fillStyle = fg;
    fctx.fillRect(0, 0, 32, 32);
    this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      size: 0.32, map: new THREE.CanvasTexture(flake), transparent: true, depthWrite: false, color: '#f4f6ff',
    }));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.scene.add(this.snow);

    this.headlight = new THREE.SpotLight('#fff1c8', 0, 34, 0.55, 0.65, 1.1);
    this.scene.add(this.headlight, this.headlight.target);

    this.auto = this.buildVehicle('auto');
    this.scene.add(this.auto);
    this.setMap(map);

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

  /** The shared WebGL renderer, for other views such as the on-foot sections. */
  get webgl(): THREE.WebGLRenderer {
    return this.gl;
  }

  /** Builds the player's vehicle: the detailed auto, or a merged low-poly model with brake lights. */
  private buildVehicle(id: VehicleId): THREE.Group {
    let g: THREE.Group;
    if (id === 'auto') {
      g = buildAuto();
    } else {
      g = new THREE.Group();
      const body = new THREE.Mesh(playerVehicleGeo(id), this.propMat);
      body.castShadow = true;
      g.add(body);
      const def = VEHICLES[id];
      const tail = new THREE.MeshLambertMaterial({ color: '#7a1410', emissive: '#ff2a1a', emissiveIntensity: 0.7, name: 'tail' });
      const two = def.width > 1.2;
      const lampGeo = new THREE.BoxGeometry(two ? 0.3 : 0.16, 0.1, 0.04);
      for (const x of two ? [-def.width / 2 + 0.25, def.width / 2 - 0.25] : [0]) {
        const lamp = new THREE.Mesh(lampGeo, tail);
        lamp.position.set(x, two ? 0.78 : 0.9, def.length / 2 + 0.02);
        g.add(lamp);
      }
    }
    this.tailMat = null;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
      if (m && m.name === 'tail') this.tailMat = m;
    });
    return g;
  }

  /** Swaps the player's vehicle model. */
  setVehicle(id: VehicleId): void {
    if (id === this.vehicleId) return;
    const old = this.vehicleId;
    this.vehicleId = id;
    this.scene.remove(this.auto);
    if (old !== 'auto') {
      this.auto.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    this.auto = this.buildVehicle(id);
    this.scene.add(this.auto);
  }

  /** Rebuilds the street, lighting and weather for a map. Takes a moment, so call it between runs. */
  setMap(map: MapDef): void {
    this.map = map;
    this.roadW = this.world.roadWidth;
    for (const g of this.blockGeos) {
      g.main.dispose();
      g.glow.dispose();
      g.pools.dispose();
      g.signs.dispose();
    }
    for (const m of this.roadMats) {
      m.map?.dispose();
      m.dispose();
    }
    for (const list of this.obstacleGeos) for (const g of list ?? []) g.dispose();
    this.blockGeos = [];
    this.roadMats = [];
    const seedBase = map.id.length * 131;
    for (let i = 0; i < BLOCK_VARIANTS; i++) this.blockGeos.push(buildBlock(map.style, 1000 + i * 77 + seedBase, this.roadW, this.atlas.cells[map.style.signs]));
    this.obstacleGeos = buildObstacleGeos(this.roadW);
    const aniso = this.gl.capabilities.getMaxAnisotropy();
    const wet = map.weather === 'rain' ? '#a3a9b8' : map.weather === 'drizzle' ? '#c4c6cc' : map.weather === 'snow' ? '#d6d9e0' : '#ffffff';
    for (let i = 0; i < 4; i++) {
      const tex = new THREE.CanvasTexture(roadTexture(this.world.laneCount, this.roadW, i === 3, 50 + i, map.style.busLane));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, aniso);
      this.roadMats.push(new THREE.MeshLambertMaterial({ map: tex, color: wet }));
    }
    this.roadGeo.dispose();
    const roadGeo = new THREE.PlaneGeometry(this.roadW, CHUNK_M);
    roadGeo.rotateX(-Math.PI / 2);
    roadGeo.translate(0, 0, -CHUNK_M / 2);
    for (const c of this.chunks) {
      c.road.geometry = roadGeo;
      c.k = -999;
    }

    // Story Mode picks up scrap, not coins: dull steel instead of gold.
    const story = this.world.rules.fuel;
    this.coinMat.color.set(story ? '#9aa2aa' : '#ffc21a');
    this.coinMat.emissive.set(story ? '#20262c' : '#7a5200');
    this.coinRimMat.color.set(story ? '#6a7078' : '#e09a00');
    this.coinRimMat.emissive.set(story ? '#101214' : '#5a3a00');

    // Light and mood.
    const L = map.light;
    const sky = new THREE.Color(L.sky);
    this.scene.background = sky;
    (this.scene.fog as THREE.Fog).color.copy(sky);
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemi;
    this.sun.color.set(L.sun);
    this.sun.intensity = L.sunIntensity;
    this.gl.toneMappingExposure = L.exposure;
    (this.ground.material as THREE.MeshLambertMaterial).color.set(map.style.ground);
    this.glowMat.color.set(L.night ? '#ffffff' : '#c9c4b8');
    this.poolMat.opacity = L.night ? 0.38 : 0;
    for (const c of this.chunks) c.pools.visible = L.night;
    this.headlight.intensity = L.night ? 140 : 0;
    this.ambient.configure(L.night, map.weather === 'rain');
    this.rainCount = map.weather === 'rain' ? RAIN_MAX : map.weather === 'drizzle' ? 260 : 0;
    this.rain.visible = this.rainCount > 0;
    this.rain.geometry.setDrawRange(0, this.rainCount * 2);
    for (let i = 0; i < this.rainCount; i++) this.resetDrop(i, Math.random() * 18);
    this.snow.visible = map.weather === 'snow';
    if (this.snow.visible) for (let i = 0; i < SNOW_MAX; i++) this.resetFlake(i, Math.random() * 16);
  }

  private resetDrop(i: number, y: number): void {
    const p = this.rainPos;
    const x = (Math.random() - 0.5) * 30;
    const z = (Math.random() - 0.5) * 50;
    p[i * 6] = x;
    p[i * 6 + 1] = y;
    p[i * 6 + 2] = z;
    p[i * 6 + 3] = x + 0.12;
    p[i * 6 + 4] = y + 0.75;
    p[i * 6 + 5] = z - 0.1;
  }

  private resetFlake(i: number, y: number): void {
    const p = this.snowPos;
    p[i * 3] = (Math.random() - 0.5) * 34;
    p[i * 3 + 1] = y;
    p[i * 3 + 2] = (Math.random() - 0.5) * 54;
    this.snowPhase[i] = Math.random() * 6.28;
  }

  /** Snow drifts down slowly and sways; it is drawn as soft round points. */
  private updateSnow(dt: number, cx: number, cz: number): void {
    if (!this.snow.visible) return;
    const p = this.snowPos;
    for (let i = 0; i < SNOW_MAX; i++) {
      const ph = this.snowPhase[i]!;
      p[i * 3] = p[i * 3]! + Math.sin(this.time * 1.3 + ph) * 0.6 * dt - 0.4 * dt;
      p[i * 3 + 1] = p[i * 3 + 1]! - (1.3 + (ph % 1)) * dt;
      p[i * 3 + 2] = p[i * 3 + 2]! + Math.cos(this.time * 0.9 + ph) * 0.3 * dt;
      if (p[i * 3 + 1]! < 0) this.resetFlake(i, 14 + Math.random() * 3);
    }
    this.snow.position.set(cx, 0, cz);
    this.snow.geometry.attributes.position!.needsUpdate = true;
  }

  private updateRain(dt: number, cx: number, cz: number): void {
    this.updateSnow(dt, cx, cz);
    if (this.rainCount === 0) return;
    const p = this.rainPos;
    const fall = (this.map.weather === 'rain' ? 24 : 16) * dt;
    for (let i = 0; i < this.rainCount; i++) {
      p[i * 6 + 1] = p[i * 6 + 1]! - fall;
      p[i * 6 + 4] = p[i * 6 + 4]! - fall;
      p[i * 6] = p[i * 6]! - fall * 0.15;
      p[i * 6 + 3] = p[i * 6 + 3]! - fall * 0.15;
      if (p[i * 6 + 1]! < 0) this.resetDrop(i, 16 + Math.random() * 4);
    }
    this.rain.position.set(cx, 0, cz);
    this.rain.geometry.attributes.position!.needsUpdate = true;
  }

  private placeCoins(cam: number): void {
    const coins = this.world.coins;
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i]!;
      const can = this.canMeshes[i]!;
      const show = c.active && c.y < cam + VIEW_AHEAD + 10;
      can.visible = show && c.fuel;
      if (can.visible) {
        can.position.set(c.x - this.roadW / 2, 0.75 + Math.sin(this.time * 3 + c.y) * 0.12, -c.y);
        can.rotation.y = this.time * 1.6;
      }
      const m = this.coinMeshes[i]!;
      m.visible = show && !c.fuel;
      if (!m.visible) continue;
      m.position.set(c.x - this.roadW / 2, 0.75 + Math.sin(this.time * 4 + c.y) * 0.1, -c.y);
      m.rotation.y = this.time * 3 + c.y * 0.4;
    }
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

  /** Roof gun: a tracer from the turret to the target and a flash. */
  shot(x: number, y: number): void {
    const from = this.tmp.set(this.auto.position.x + 0.35, 2.3, this.auto.position.z - 1.1);
    const pos = this.tracer.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, x - this.roadW / 2, 1.3, -y);
    pos.needsUpdate = true;
    this.tracerT = 0.09;
    this.flash.position.copy(from);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, y, 1.2, Math.cos(a) * 2, Math.sin(a) * 2 + this.world.speed * 0.3, 1 + Math.random() * 2, 0.35, 0.18, DUST);
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

  draw(alpha: number, frameDt: number, running: boolean, mode: ViewMode = 'game'): void {
    const { world } = this;
    this.time += frameDt;
    this.windTime.value = this.time;
    this.shake = Math.max(0, this.shake - frameDt * 30);
    const cam = world.prevDist + (world.dist - world.prevDist) * alpha;
    const lane = world.prevLanePos + (world.lanePos - world.prevLanePos) * alpha;
    const px = laneCenter(lane) - this.roadW / 2;
    const speedK = world.alive ? Math.max(0, Math.min(1, (world.speed - 11) / (B.maxSpeed - 11))) : 0;
    this.speedFx += (speedK - this.speedFx) * Math.min(1, frameDt * 3);

    this.placeChunks(cam);
    // The garage is a clean showroom on the road: the buildings step away so the orbiting camera never clips them.
    const street = mode !== 'garage';
    if (this.chunks[0]!.block.visible !== street) {
      for (const c of this.chunks) {
        c.block.visible = c.glow.visible = c.signs.visible = street;
        c.pools.visible = street && this.map.light.night;
      }
    }
    this.placePotholes(cam);
    this.placeCoins(cam);

    // The auto: steer yaw, body roll, engine bounce, spin-out after the crash.
    const steer = world.targetLane - lane;
    const crashK = world.alive ? 0 : 1 - Math.pow(1 - Math.min(1, world.crashT / 1.1), 3);
    this.auto.position.set(px, running && world.alive ? Math.abs(Math.sin(this.time * 20)) * 0.035 : 0, -cam);
    // Nose dips when braking and lifts when boosting.
    const pitchWant = world.alive ? (world.throttle < 0 ? -0.05 : world.throttle > 0 ? 0.035 : 0) : 0;
    this.pitch += (pitchWant - this.pitch) * Math.min(1, frameDt * 8);
    this.auto.rotation.set(-this.pitch, world.alive ? -steer * 0.4 : crashK * 2.7 * this.crashDir, world.alive ? steer * 0.08 : 0);
    if (this.tailMat) this.tailMat.emissiveIntensity = world.throttle < 0 && world.alive ? 3 : 0.7;
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
    this.tracerT = Math.max(0, this.tracerT - frameDt);
    this.tracer.visible = this.tracerT > 0;
    (this.tracer.material as THREE.LineBasicMaterial).opacity = this.tracerT / 0.09;
    this.flash.intensity = this.tracerT > 0 ? 40 * (this.tracerT / 0.09) : 0;

    if (this.headlight.intensity > 0) {
      const yaw = this.auto.rotation.y;
      this.headlight.position.set(px - Math.sin(yaw) * 1.4, 1.0, -cam - 1.4);
      this.headlight.target.position.set(px - Math.sin(yaw) * 14, 0, -cam - 14);
    }
    this.placeCamera(cam, px, mode);
    this.updateRain(frameDt, px, -cam - 10);
    this.ambient.update(frameDt, 0, -cam - 10, this.roadW / 2);
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
      const g = this.blockGeos[blockVariant(k)]!;
      c.block.geometry = g.main;
      c.glow.geometry = g.glow;
      c.pools.geometry = g.pools;
      c.signs.geometry = g.signs;
      c.road.material = this.roadMats[roadVariant(k)]!;
      for (const m of [c.block, c.glow, c.pools, c.signs, c.road]) m.position.z = -k * CHUNK_M;
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
      const isHole = shape !== undefined;
      m.rim.visible = m.hole.visible = m.deep.visible = isHole;
      m.water.visible = isHole && shape.water !== null;
      m.prop.visible = !isHole;
      if (shape) {
        m.rim.geometry = shape.rim;
        m.hole.geometry = shape.hole;
        m.deep.geometry = shape.deep;
        if (shape.water) m.water.geometry = shape.water;
      } else {
        m.prop.geometry = this.obstacleGeos[o.kind]?.[o.variant] ?? m.prop.geometry;
      }
      m.group.position.set(o.x - this.roadW / 2, 0, -o.y);
      // Cows stand at an angle; bikes wobble a little.
      let ry = 0;
      let rx = 0;
      let rz = 0;
      if (o.kind === ObstacleKind.Cow) ry = ((o.variant * 7 + Math.floor(o.y)) % 5) * 0.35 - 0.7;
      else if (o.kind === ObstacleKind.Biker || o.kind === ObstacleKind.DeliveryBike) ry = Math.sin(this.time * 3 + o.y) * 0.05;
      else if (o.kind === ObstacleKind.Zombie || o.kind === ObstacleKind.Horde) {
        if (o.down > 0) {
          // Knocked down: topple away, then sink into the road and fade out. No blood.
          const k = Math.min(1, o.down / 0.35);
          rx = -k * 1.45;
          rz = o.fall * k * 0.5;
          m.group.position.x += o.fall * k * 0.6;
          m.group.position.y = -Math.max(0, o.down - 0.7) * 0.9;
          m.group.position.z -= k * 0.8;
          if (o.down > 2.2) m.group.visible = false;
        } else {
          // Staggering shuffle.
          const ph = this.time * 2.2 + o.y;
          rz = Math.sin(ph) * 0.09;
          ry = Math.sin(ph * 0.5) * 0.2;
          m.group.position.x += Math.sin(ph * 0.5) * 0.12;
        }
      }
      m.group.rotation.set(rx, ry, rz);
    }
  }

  private placeCamera(cam: number, px: number, mode: ViewMode): void {
    const c = this.camera;
    if (mode === 'garage') {
      // Slow orbit close around the vehicle, framed in the top half of the screen (the cards sit below).
      c.fov = 34;
      c.updateProjectionMatrix();
      const a = 0.6 + this.time * 0.35;
      // Far enough that the whole vehicle fits across the screen, even on a tall phone.
      const len = VEHICLES[this.vehicleId].length;
      const halfW = c.aspect < 1 ? len * 0.6 + 0.8 : len * 0.9 + 1.5;
      const d = Math.max(6.5, halfW / (Math.tan((c.fov * Math.PI) / 360) * Math.min(c.aspect, 1.3)));
      c.position.set(px + Math.sin(a) * d, d * (c.aspect < 1 ? 0.42 : 0.62), -cam + Math.cos(a) * d);
      // On a phone the card covers the lower half, so aim below the vehicle to lift it up the screen.
      c.lookAt(px, c.aspect < 1 ? -d * 0.2 : -d * 0.16, -cam);
      const fog = this.scene.fog as THREE.Fog;
      fog.near = 30;
      fog.far = 90;
      return;
    }
    const menu = mode === 'menu';
    c.fov = menu ? 34 : 38 + this.speedFx * 9;
    c.updateProjectionMatrix();
    // Angled view from above, behind and a little to the right: the 2.5D look.
    const yaw = menu ? 0.38 + Math.sin(this.time * 0.15) * 0.12 : 0.3;
    const elev = menu ? 0.82 : 0.92;
    // Pull back far enough that the road plus its footpaths fill the width on narrow phones.
    const halfH = Math.tan((c.fov * Math.PI) / 360);
    const needW = (menu ? 17 : 13.5) + (this.roadW - 9);
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
    const f = this.map.fog;
    fog.near = dist + 18 * f - (1 - f) * 10;
    fog.far = dist + 75 * f;
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
      s.position.set(this.pX[i]! - this.roadW / 2, this.pH[i]!, -this.pY[i]!);
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
      this.tmp.set(this.popX[i]! - this.roadW / 2, 2.4, -Math.max(this.popY[i]!, cam - 2)).project(this.camera);
      const x = Math.max(70, Math.min(this.w - 70, (this.tmp.x * 0.5 + 0.5) * this.w));
      const y = (-this.tmp.y * 0.5 + 0.5) * this.h - (1 - life) * 50;
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${life > 0.85 ? 1 + (life - 0.85) * 2 : 1})`;
      el.style.opacity = String(Math.min(1, life * 2.5));
    }
  }
}
