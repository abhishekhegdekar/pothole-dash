import { BALANCE as B } from '../data/balance';
import { laneCenter } from '../systems/collision';
import type { World } from '../systems/world';
import { Particles } from './particles';
import { drawRoadTile, TILE_M } from './road';
import { drawAutoSprite, drawPotholeSprites, type Sprite } from './sprites';

const MAX_DPR = 2;

export class Renderer {
  readonly particles = new Particles();
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private ppm = 30;
  private roadLeft = 0;
  private playerY = 0;
  private tile: HTMLCanvasElement | null = null;
  private tileH = 1;
  private auto: Sprite | null = null;
  private potholes: Sprite[][] = [];
  private shake = 0;
  private time = 0;
  private puffTimer = 0;
  private topShade: CanvasGradient | null = null;

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
    this.tile = drawRoadTile(this.w, this.ppm, this.dpr, this.roadLeft, roadM, this.world.laneCount, 4242);
    this.tileH = this.tile.height / this.dpr;
    this.auto = drawAutoSprite(this.world.vehicle, this.ppm, this.dpr);
    this.potholes = drawPotholeSprites(this.ppm, this.dpr);
    this.topShade = this.ctx.createLinearGradient(0, 0, 0, 110);
    this.topShade.addColorStop(0, 'rgba(10,10,14,0.45)');
    this.topShade.addColorStop(1, 'rgba(10,10,14,0)');
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /** Dust and debris burst at a world position. */
  burst(x: number, y: number): void {
    const p = this.particles;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 6;
      p.spawn(x, y, Math.cos(a) * s, Math.sin(a) * s + this.world.speed * 0.4, 0.5 + Math.random() * 0.4, 0.15 + Math.random() * 0.3, i % 3 === 0 ? 1 : 0);
    }
  }

  draw(alpha: number, frameDt: number, running: boolean): void {
    const { ctx, world } = this;
    this.time += frameDt;
    this.particles.update(frameDt);
    this.shake = Math.max(0, this.shake - frameDt * 30);

    const cam = world.prevDist + (world.dist - world.prevDist) * alpha;
    const lane = world.prevLanePos + (world.lanePos - world.prevLanePos) * alpha;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    // Road tiles. Tile k covers distance [k*TILE_M, (k+1)*TILE_M]; its top edge is the far end.
    if (this.tile) {
      const metersBelow = (this.h - this.playerY) / this.ppm;
      const first = Math.floor((cam - metersBelow) / TILE_M);
      const last = Math.floor((cam + this.playerY / this.ppm) / TILE_M);
      for (let k = first; k <= last; k++) {
        const top = this.playerY - ((k + 1) * TILE_M - cam) * this.ppm;
        const y = Math.round(top * this.dpr) / this.dpr;
        ctx.drawImage(this.tile, 0, y - 1, this.w, this.tileH + 1);
      }
    }

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

    // Exhaust puffs while driving.
    if (running && world.alive) {
      this.puffTimer -= frameDt;
      if (this.puffTimer <= 0) {
        this.puffTimer = 0.07;
        const px = laneCenter(lane) + 0.35;
        this.particles.spawn(px, cam - world.vehicle.length / 2, (Math.random() - 0.5) * 0.6, world.speed * 0.75, 0.45, 0.18, 2);
      }
    }
    this.drawParticles(cam);

    // Player.
    if (this.auto) {
      const px = this.roadLeft + laneCenter(lane) * this.ppm;
      const steer = world.targetLane - lane;
      const tilt = world.alive ? Math.max(-0.22, Math.min(0.22, steer * 0.35)) : 0.35;
      const bounce = running && world.alive ? Math.sin(this.time * 22) * 0.6 : 0;
      const blink = world.invuln > 0 && world.alive && Math.floor(this.time * 14) % 2 === 0;
      ctx.save();
      ctx.translate(px, this.playerY + bounce);
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

    // Soft shade at the top so the score stays readable.
    if (this.topShade) ctx.fillStyle = this.topShade;
    ctx.fillRect(-20, -20, this.w + 40, 130);
  }

  private drawParticles(cam: number): void {
    const { ctx, particles: p } = this;
    for (let i = 0; i < p.max; i++) {
      const life = p.life[i]!;
      if (life <= 0) continue;
      const k = life / p.maxLife[i]!;
      const sx = this.roadLeft + p.x[i]! * this.ppm;
      const sy = this.playerY - (p.y[i]! - cam) * this.ppm;
      const kind = p.kind[i]!;
      const r = p.size[i]! * this.ppm * (kind === 2 ? 1 + (1 - k) * 2 : 1);
      ctx.globalAlpha = kind === 2 ? k * 0.35 : k;
      ctx.fillStyle = kind === 0 ? '#c8b08a' : kind === 1 ? '#3a332c' : '#d8d8dc';
      if (kind === 1) {
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
