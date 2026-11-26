import { BALANCE as B } from '../data/balance';
import { laneCenter } from '../systems/collision';
import type { World } from '../systems/world';
import { Particles } from './particles';
import { drawRoadTile, TILE_M } from './road';
import { drawAutoSprite, drawPotholeSprites, type Sprite } from './sprites';

const MAX_DPR = 2;
const SKID_MAX = 240;
const SPEED_LINES = 26;
const TEXT_MAX = 8;
/** Particle kinds. */
const DUST = 0;
const DEBRIS = 1;
const EXHAUST = 2;
const SMOKE = 3;

/** Picks one of the cached tile variants for tile k: mostly plain, sometimes a zebra crossing. */
function tileVariant(k: number): number {
  const h = (Math.imul(k, 2654435761) >>> 0) % 8;
  return h === 0 ? 2 : h < 4 ? 1 : 0;
}

export class Renderer {
  readonly particles = new Particles();
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private ppm = 30;
  private roadLeft = 0;
  private playerY = 0;
  private tiles: HTMLCanvasElement[] = [];
  private tileH = 1;
  private auto: Sprite | null = null;
  private potholes: Sprite[][] = [];
  private shake = 0;
  private time = 0;
  private puffTimer = 0;
  private smokeTimer = 0;
  private topShade: CanvasGradient | null = null;
  private vignette: CanvasGradient | null = null;
  private crashDir = 1;

  // Skid marks: world-space segments in a ring buffer.
  private readonly skid = new Float32Array(SKID_MAX * 4);
  private skidHead = 0;
  private lastWheelY = NaN;
  private lastWheelX = 0;

  // Speed lines: screen-space streaks.
  private readonly lineX = new Float32Array(SPEED_LINES);
  private readonly lineY = new Float32Array(SPEED_LINES);
  private readonly lineL = new Float32Array(SPEED_LINES);

  // Floating text popups, world-anchored.
  private readonly textStr: string[] = new Array<string>(TEXT_MAX).fill('');
  private readonly textX = new Float32Array(TEXT_MAX);
  private readonly textY = new Float32Array(TEXT_MAX);
  private readonly textLife = new Float32Array(TEXT_MAX);
  private readonly textColour: string[] = new Array<string>(TEXT_MAX).fill('#fff');
  private readonly textSize = new Float32Array(TEXT_MAX);
  private textHead = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly world: World) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  resize(wCss: number, hCss: number, devicePixelRatio: number): void {
    this.w = Math.max(1, wCss);
    this.h = Math.max(1, hCss);
    this.dpr = Math.min(MAX_DPR, Math.max(1, devicePixelRatio || 1));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;

    const roadM = this.world.laneCount * B.laneWidth;
    const raw = Math.min((this.w * 0.8) / roadM, this.h / B.visibleMeters);
    // Snap the zoom so one tile is a whole number of device pixels (no seams while scrolling).
    this.ppm = Math.max(4, Math.round(raw * TILE_M * this.dpr) / (TILE_M * this.dpr));
    this.roadLeft = Math.round((this.w - roadM * this.ppm) / 2);
    this.playerY = this.h - B.playerOffset * this.ppm;
    this.tiles = [4242, 977, 3131].map((seed, i) =>
      drawRoadTile(this.w, this.ppm, this.dpr, this.roadLeft, roadM, this.world.laneCount, seed, i === 2),
    );
    this.tileH = (this.tiles[0]?.height ?? 1) / this.dpr;
    this.auto = drawAutoSprite(this.world.vehicle, this.ppm, this.dpr);
    this.potholes = drawPotholeSprites(this.ppm, this.dpr);
    this.topShade = this.ctx.createLinearGradient(0, 0, 0, 120);
    this.topShade.addColorStop(0, 'rgba(10,10,14,0.5)');
    this.topShade.addColorStop(1, 'rgba(10,10,14,0)');
    const r = Math.hypot(this.w, this.h) / 2;
    this.vignette = this.ctx.createRadialGradient(this.w / 2, this.h * 0.6, r * 0.45, this.w / 2, this.h * 0.6, r * 1.05);
    this.vignette.addColorStop(0, 'rgba(0,0,0,0)');
    this.vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    for (let i = 0; i < SPEED_LINES; i++) this.resetLine(i, Math.random() * this.h);
  }

  /** Clears per-run effects (skids, popups, particles). */
  resetRun(): void {
    this.particles.clear();
    this.skid.fill(0);
    this.textLife.fill(0);
    this.lastWheelY = NaN;
    this.shake = 0;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /** Dust and debris burst at a world position. */
  burst(x: number, y: number): void {
    const p = this.particles;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 6;
      p.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s + this.world.speed * 0.4, 0.5 + Math.random() * 0.4, 0.15 + Math.random() * 0.3, i % 3 === 0 ? DEBRIS : DUST);
    }
  }

  /** Starts the spin-out; dir is which way the auto spins. */
  crash(dir: number): void {
    this.crashDir = dir >= 0 ? 1 : -1;
  }

  popText(text: string, x: number, y: number, colour: string, size: number): void {
    const i = this.textHead;
    this.textHead = (this.textHead + 1) % TEXT_MAX;
    this.textStr[i] = text;
    this.textX[i] = x;
    this.textY[i] = y;
    this.textLife[i] = 1;
    this.textColour[i] = colour;
    this.textSize[i] = size;
  }

  draw(alpha: number, frameDt: number, running: boolean): void {
    const { ctx, world } = this;
    this.time += frameDt;
    this.particles.update(frameDt);
    this.shake = Math.max(0, this.shake - frameDt * 30);

    const cam = world.prevDist + (world.dist - world.prevDist) * alpha;
    const lane = world.prevLanePos + (world.lanePos - world.prevLanePos) * alpha;
    const speedK = Math.max(0, Math.min(1, (world.speed - 12) / (B.maxSpeed - 12)));

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    // Road tiles. Tile k covers distance [k*TILE_M, (k+1)*TILE_M]; its top edge is the far end.
    if (this.tiles.length) {
      const metersBelow = (this.h - this.playerY) / this.ppm;
      const first = Math.floor((cam - metersBelow) / TILE_M);
      const last = Math.floor((cam + this.playerY / this.ppm) / TILE_M);
      for (let k = first; k <= last; k++) {
        const tile = this.tiles[tileVariant(k)] ?? this.tiles[0]!;
        const top = this.playerY - ((k + 1) * TILE_M - cam) * this.ppm;
        const y = Math.round(top * this.dpr) / this.dpr;
        ctx.drawImage(tile, 0, y - 1, this.w, this.tileH + 1);
      }
    }

    this.drawSkids(cam);

    // Potholes.
    for (const o of world.obstacles) {
      if (!o.active) continue;
      const s = this.potholes[o.kind]?.[o.variant];
      if (!s) continue;
      const sx = this.roadLeft + o.x * this.ppm;
      const sy = this.playerY - (o.y - cam) * this.ppm;
      if (sy < -s.h || sy > this.h + s.h) continue;
      ctx.drawImage(s.canvas, sx - s.w / 2, sy - s.h / 2, s.w, s.h);
    }

    // Spin-out after the final crash.
    const crashK = world.alive ? 0 : 1 - Math.pow(1 - Math.min(1, world.crashT / 1.1), 3);
    const spin = crashK * 2.7 * this.crashDir;

    // Exhaust while driving, smoke after the crash, skid marks while steering hard.
    const px = laneCenter(lane);
    if (running && world.alive) {
      this.puffTimer -= frameDt;
      if (this.puffTimer <= 0) {
        this.puffTimer = 0.07;
        this.particles.spawn(px + 0.35, cam - world.vehicle.length / 2, (Math.random() - 0.5) * 0.6, world.speed * 0.75, 0.45, 0.18, EXHAUST);
      }
    }
    if (!world.alive && world.crashT < 1.8) {
      this.smokeTimer -= frameDt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.05;
        this.particles.spawn(px + (Math.random() - 0.5) * 0.8, cam + (Math.random() - 0.5), (Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, 0.9, 0.35 + Math.random() * 0.3, SMOKE);
      }
    }
    const steering = Math.abs(world.targetLane - lane) > 0.05 && world.alive;
    const skidding = (steering && running) || (!world.alive && world.speed > 0.5);
    this.trackSkid(skidding, px, cam, spin);

    this.drawParticles(cam, SMOKE, false);

    // Player.
    if (this.auto) {
      const sx = this.roadLeft + px * this.ppm;
      const steer = world.targetLane - lane;
      const tilt = world.alive ? Math.max(-0.22, Math.min(0.22, steer * 0.35)) : spin;
      const bounce = running && world.alive ? Math.sin(this.time * 22) * 0.6 * (0.6 + speedK) : 0;
      const blink = world.invuln > 0 && world.alive && Math.floor(this.time * 14) % 2 === 0;
      ctx.save();
      ctx.translate(sx, this.playerY + bounce);
      ctx.rotate(tilt);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(this.ppm * 0.18, this.ppm * 0.25, (world.vehicle.width / 2) * this.ppm * 1.05, (world.vehicle.length / 2) * this.ppm, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = blink ? 0.45 : 1;
      ctx.drawImage(this.auto.canvas, -this.auto.w / 2, -this.auto.h / 2, this.auto.w, this.auto.h);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    this.drawParticles(cam, SMOKE, true);
    if (running && world.alive && speedK > 0) this.drawSpeedLines(frameDt, speedK);
    this.drawTexts(cam, frameDt);

    // Darker edges at speed, and a soft shade at the top so the score stays readable.
    if (this.vignette && speedK > 0.05 && world.alive) {
      ctx.globalAlpha = speedK * 0.8;
      ctx.fillStyle = this.vignette;
      ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
      ctx.globalAlpha = 1;
    }
    if (this.topShade) ctx.fillStyle = this.topShade;
    ctx.fillRect(-20, -20, this.w + 40, 140);
  }

  private trackSkid(on: boolean, px: number, cam: number, spin: number): void {
    const wy = cam - 0.75;
    if (!on) {
      this.lastWheelY = NaN;
      return;
    }
    const offs = 0.6 * Math.cos(spin);
    if (!Number.isNaN(this.lastWheelY) && Math.abs(wy - this.lastWheelY) > 0.05) {
      for (const side of [-1, 1]) {
        const i = this.skidHead * 4;
        this.skid[i] = this.lastWheelX + side * offs;
        this.skid[i + 1] = this.lastWheelY;
        this.skid[i + 2] = px + side * offs;
        this.skid[i + 3] = wy;
        this.skidHead = (this.skidHead + 1) % SKID_MAX;
      }
    }
    if (Number.isNaN(this.lastWheelY) || Math.abs(wy - this.lastWheelY) > 0.05) {
      this.lastWheelX = px;
      this.lastWheelY = wy;
    }
  }

  private drawSkids(cam: number): void {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(18,18,20,0.4)';
    ctx.lineWidth = Math.max(1.5, 0.16 * this.ppm);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let s = 0; s < SKID_MAX; s++) {
      const i = s * 4;
      const y1 = this.skid[i + 1]!;
      const y2 = this.skid[i + 3]!;
      if (y1 === 0 && y2 === 0) continue;
      const sy1 = this.playerY - (y1 - cam) * this.ppm;
      if (sy1 < -10 || sy1 > this.h + 10) continue;
      ctx.moveTo(this.roadLeft + this.skid[i]! * this.ppm, sy1);
      ctx.lineTo(this.roadLeft + this.skid[i + 2]! * this.ppm, this.playerY - (y2 - cam) * this.ppm);
    }
    ctx.stroke();
  }

  private resetLine(i: number, y: number): void {
    // Mostly along the sides, so the lanes stay clear to read.
    const side = Math.random() < 0.5;
    const edge = Math.random() * Math.max(30, this.roadLeft + 30);
    this.lineX[i] = side ? edge : this.w - edge;
    this.lineY[i] = y;
    this.lineL[i] = 30 + Math.random() * 70;
  }

  private drawSpeedLines(dt: number, k: number): void {
    const { ctx } = this;
    const v = this.world.speed * this.ppm * 1.8;
    ctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.25 * k).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < SPEED_LINES; i++) {
      this.lineY[i] = this.lineY[i]! + v * dt;
      if (this.lineY[i]! - this.lineL[i]! > this.h) this.resetLine(i, -Math.random() * 120);
      const x = this.lineX[i]!;
      const y = this.lineY[i]!;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - this.lineL[i]! * (0.5 + k));
    }
    ctx.stroke();
  }

  private drawTexts(cam: number, dt: number): void {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < TEXT_MAX; i++) {
      const life = this.textLife[i]!;
      if (life <= 0) continue;
      this.textLife[i] = life - dt / 1.1;
      const rise = (1 - life) * 46;
      const pop = life > 0.85 ? 1 + (life - 0.85) * 3 : 1;
      const x = Math.max(70, Math.min(this.w - 70, this.roadLeft + this.textX[i]! * this.ppm));
      const y = this.playerY - (this.textY[i]! - cam) * this.ppm - rise - this.ppm * 1.6;
      ctx.globalAlpha = Math.min(1, life * 2.5);
      ctx.font = `900 ${Math.round(this.textSize[i]! * pop)}px 'Arial Black', 'Segoe UI Black', system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#15161a';
      ctx.strokeText(this.textStr[i]!, x, y);
      ctx.fillStyle = this.textColour[i]!;
      ctx.fillText(this.textStr[i]!, x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** Smoke is drawn above the auto, everything else below it. */
  private drawParticles(cam: number, onlyKind: number, only: boolean): void {
    const { ctx, particles: p } = this;
    for (let i = 0; i < p.max; i++) {
      const life = p.life[i]!;
      if (life <= 0) continue;
      const kind = p.kind[i]!;
      if ((kind === onlyKind) !== only) continue;
      const k = life / p.maxLife[i]!;
      const sx = this.roadLeft + p.x[i]! * this.ppm;
      const sy = this.playerY - (p.y[i]! - cam) * this.ppm;
      const grows = kind === EXHAUST || kind === SMOKE;
      const r = p.size[i]! * this.ppm * (grows ? 1 + (1 - k) * 2.2 : 1);
      ctx.globalAlpha = kind === EXHAUST ? k * 0.35 : kind === SMOKE ? k * 0.55 : k;
      ctx.fillStyle = kind === DUST ? '#c8b08a' : kind === DEBRIS ? '#3a332c' : kind === SMOKE ? '#3b3b40' : '#d8d8dc';
      if (kind === DEBRIS) {
        ctx.fillRect(sx - r / 2, sy - r / 2, r, r);
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
