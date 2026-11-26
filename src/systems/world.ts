import { BALANCE as B } from '../data/balance';
import { ObstacleKind } from '../data/obstacles';
import type { VehicleDef } from '../data/vehicles';
import { Rng } from '../core/rng';
import { boxesOverlap, laneCenter, obstacleHalfH, obstacleHalfW } from './collision';
import { rowIntervalAt, speedAt } from './difficulty';
import { nextMilestone } from './scoring';
import { createRow, Spawner } from './spawner';

export interface Obstacle {
  active: boolean;
  kind: ObstacleKind;
  /** Centre across the road, metres from the left road edge. */
  x: number;
  /** Centre along the road, metres from the start. */
  y: number;
  variant: number;
  hit: boolean;
  /** True once the player has driven past it (near miss already checked). */
  passed: boolean;
}

/** Things that happened during the last update, for sound and effects. Cleared by the reader. */
export interface WorldEvents {
  hit: boolean;
  crash: boolean;
  laneChange: number;
  hitX: number;
  hitY: number;
  /** Near miss this step: 0 = none, otherwise the new combo count. */
  nearMiss: number;
  nearMissPoints: number;
  nearMissX: number;
  nearMissY: number;
  /** Milestone distance reached this step, or 0. */
  milestone: number;
}

/** All game logic for a run. No DOM or drawing, so it can be unit tested. */
export class World {
  readonly obstacles: Obstacle[] = [];
  readonly events: WorldEvents = {
    hit: false, crash: false, laneChange: 0, hitX: 0, hitY: 0,
    nearMiss: 0, nearMissPoints: 0, nearMissX: 0, nearMissY: 0, milestone: 0,
  };

  t = 0;
  /** Distance travelled; the player's centre is at this y. */
  dist = 0;
  prevDist = 0;
  speed: number = B.startSpeed;
  lanePos: number = B.startLane;
  prevLanePos: number = B.startLane;
  targetLane: number = B.startLane;
  dents = 0;
  invuln = 0;
  alive = true;
  /** Seconds since the final crash. */
  crashT = 0;
  bonus = 0;
  combo = 0;
  comboTimer = 0;
  nearMisses = 0;
  bestCombo = 0;
  /** Metres of road the camera shows ahead of the player. The 3D view sees further than the 2D one. */
  viewAhead: number = B.visibleMeters - B.playerOffset;

  private speedMul = 1;
  private nextRowY = 0;
  private nextMilestoneAt = 0;
  private readonly row = createRow();
  private readonly rng: Rng;
  private readonly spawner: Spawner;

  constructor(readonly vehicle: VehicleDef, seed: number, readonly laneCount: number = B.laneCount) {
    for (let i = 0; i < B.obstaclePool; i++) {
      this.obstacles.push({ active: false, kind: ObstacleKind.SmallPothole, x: 0, y: 0, variant: 0, hit: false, passed: false });
    }
    this.rng = new Rng(seed);
    this.spawner = new Spawner(this.rng, laneCount, vehicle.width, vehicle.laneChangeTime);
    this.reset(seed);
  }

  /** Distance plus near-miss bonus. */
  get score(): number {
    return Math.floor(this.dist) + this.bonus;
  }

  reset(seed: number): void {
    this.rng.reset(seed);
    this.spawner.reset(B.startLane);
    for (const o of this.obstacles) o.active = false;
    this.t = 0;
    this.dist = this.prevDist = 0;
    this.speed = B.startSpeed;
    this.speedMul = 1;
    this.lanePos = this.prevLanePos = this.targetLane = B.startLane;
    this.dents = this.vehicle.dents;
    this.invuln = 0;
    this.alive = true;
    this.crashT = 0;
    this.bonus = this.combo = this.comboTimer = this.nearMisses = this.bestCombo = 0;
    this.nextRowY = B.startSpeed * B.firstRowDelay + this.spawnAhead();
    this.nextMilestoneAt = nextMilestone(0);
    this.clearEvents();
  }

  clearEvents(): void {
    const e = this.events;
    e.hit = e.crash = false;
    e.laneChange = e.nearMiss = e.nearMissPoints = e.milestone = 0;
  }

  /** Metres ahead of the player where new rows appear (just off the top of the screen). */
  spawnAhead(): number {
    return this.viewAhead + 4;
  }

  steer(dir: -1 | 1): void {
    if (!this.alive) return;
    const next = Math.min(this.laneCount - 1, Math.max(0, this.targetLane + dir));
    if (next !== this.targetLane) {
      this.targetLane = next;
      this.events.laneChange = dir;
    }
  }

  /** Slow scroll behind the title screen and countdown. */
  attract(dt: number, speed = 5): void {
    this.prevDist = this.dist;
    this.prevLanePos = this.lanePos;
    this.dist += speed * dt;
  }

  update(dt: number): void {
    this.prevDist = this.dist;
    this.prevLanePos = this.lanePos;
    if (!this.alive) {
      // Skid to a stop after the crash.
      this.crashT += dt;
      this.speed = Math.max(0, this.speed - B.crashDecel * dt);
      this.dist += this.speed * dt;
      return;
    }

    this.t += dt;
    if (this.speedMul < 1) this.speedMul = Math.min(1, this.speedMul + ((1 - B.hitSlowdown) * dt) / B.hitRecoverTime);
    const base = speedAt(this.t);
    this.speed = base * this.speedMul;
    this.dist += this.speed * dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.dist >= this.nextMilestoneAt) {
      this.events.milestone = this.nextMilestoneAt;
      this.nextMilestoneAt = nextMilestone(this.nextMilestoneAt);
    }

    // Steering: move toward the target lane at a fixed rate.
    const step = dt / this.vehicle.laneChangeTime;
    const d = this.targetLane - this.lanePos;
    this.lanePos = Math.abs(d) <= step ? this.targetLane : this.lanePos + Math.sign(d) * step;

    // Spawn rows ahead, spaced by time at the current base speed.
    while (this.nextRowY < this.dist + this.spawnAhead()) {
      const interval = rowIntervalAt(this.t);
      this.spawner.next(this.row, this.t, base, interval);
      for (let k = 0; k < this.row.count; k++) {
        const o = this.take();
        if (!o) break;
        o.kind = this.row.kind[k]!;
        o.x = this.row.x[k]!;
        o.y = this.nextRowY + this.row.dy[k]!;
        o.variant = this.row.variant[k]!;
        o.hit = false;
        o.passed = false;
      }
      this.nextRowY += interval * base;
    }

    // Recycle obstacles behind the player, check hits and near misses.
    const px = laneCenter(this.lanePos);
    const phw = (this.vehicle.width * B.hitboxScale) / 2;
    const phh = (this.vehicle.length * B.hitboxScale) / 2;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      if (o.y < this.dist - 8) {
        o.active = false;
        continue;
      }
      const ohw = obstacleHalfW(o.kind);
      const ohh = obstacleHalfH(o.kind);
      if (!o.passed && !o.hit && o.y + ohh < this.dist - phh) {
        o.passed = true;
        const gap = Math.abs(o.x - px) - (ohw + phw);
        if (gap >= 0 && gap < B.nearMissGap) this.nearMiss(o.x, o.y);
      }
      if (o.hit || o.passed || this.invuln > 0) continue;
      if (boxesOverlap(px, this.dist, phw, phh, o.x, o.y, ohw, ohh)) {
        o.hit = true;
        this.dents--;
        this.invuln = B.invulnTime;
        this.speedMul = B.hitSlowdown;
        this.combo = 0;
        this.events.hit = true;
        this.events.hitX = px;
        this.events.hitY = this.dist;
        if (this.dents <= 0) {
          this.dents = 0;
          this.alive = false;
          this.events.crash = true;
        }
      }
    }
  }

  private nearMiss(x: number, y: number): void {
    this.combo++;
    this.comboTimer = B.comboWindow;
    this.nearMisses++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const pts = B.nearMissPoints * this.combo;
    this.bonus += pts;
    const e = this.events;
    e.nearMiss = this.combo;
    e.nearMissPoints = pts;
    e.nearMissX = x;
    e.nearMissY = y;
  }

  private take(): Obstacle | undefined {
    for (const o of this.obstacles) {
      if (!o.active) {
        o.active = true;
        return o;
      }
    }
    return undefined;
  }
}
