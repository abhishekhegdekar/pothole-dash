import { BALANCE as B } from '../data/balance';
import { ObstacleKind } from '../data/obstacles';
import type { VehicleDef } from '../data/vehicles';
import { Rng } from '../core/rng';
import { boxesOverlap, laneCenter, obstacleHalfH, obstacleHalfW } from './collision';
import { rowIntervalAt, speedAt } from './difficulty';
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
}

/** Things that happened during the last update, for sound and effects. Cleared by the reader. */
export interface WorldEvents {
  hit: boolean;
  crash: boolean;
  laneChange: number;
  hitX: number;
  hitY: number;
}

/** All game logic for a run. No DOM or drawing, so it can be unit tested. */
export class World {
  readonly obstacles: Obstacle[] = [];
  readonly events: WorldEvents = { hit: false, crash: false, laneChange: 0, hitX: 0, hitY: 0 };

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

  private speedMul = 1;
  private nextRowY = 0;
  private readonly row = createRow();
  private readonly rng: Rng;
  private readonly spawner: Spawner;

  constructor(readonly vehicle: VehicleDef, seed: number, readonly laneCount: number = B.laneCount) {
    for (let i = 0; i < B.obstaclePool; i++) {
      this.obstacles.push({ active: false, kind: ObstacleKind.SmallPothole, x: 0, y: 0, variant: 0, hit: false });
    }
    this.rng = new Rng(seed);
    this.spawner = new Spawner(this.rng, laneCount, vehicle.width, vehicle.laneChangeTime);
    this.reset(seed);
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
    this.nextRowY = B.startSpeed * B.firstRowDelay + this.spawnAhead();
    this.clearEvents();
  }

  clearEvents(): void {
    this.events.hit = false;
    this.events.crash = false;
    this.events.laneChange = 0;
  }

  /** Metres ahead of the player where new rows appear (just off the top of the screen). */
  spawnAhead(): number {
    return B.visibleMeters - B.playerOffset + 4;
  }

  steer(dir: -1 | 1): void {
    if (!this.alive) return;
    const next = Math.min(this.laneCount - 1, Math.max(0, this.targetLane + dir));
    if (next !== this.targetLane) {
      this.targetLane = next;
      this.events.laneChange = dir;
    }
  }

  /** Slow scroll behind the title screen. */
  attract(dt: number): void {
    this.prevDist = this.dist;
    this.prevLanePos = this.lanePos;
    this.dist += 5 * dt;
  }

  update(dt: number): void {
    this.prevDist = this.dist;
    this.prevLanePos = this.lanePos;
    if (!this.alive) return;

    this.t += dt;
    if (this.speedMul < 1) this.speedMul = Math.min(1, this.speedMul + ((1 - B.hitSlowdown) * dt) / B.hitRecoverTime);
    const base = speedAt(this.t);
    this.speed = base * this.speedMul;
    this.dist += this.speed * dt;
    if (this.invuln > 0) this.invuln -= dt;

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
      }
      this.nextRowY += interval * base;
    }

    // Recycle obstacles behind the player, and check hits.
    const px = laneCenter(this.lanePos);
    const phw = (this.vehicle.width * B.hitboxScale) / 2;
    const phh = (this.vehicle.length * B.hitboxScale) / 2;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      if (o.y < this.dist - 8) {
        o.active = false;
        continue;
      }
      if (o.hit || this.invuln > 0) continue;
      if (boxesOverlap(px, this.dist, phw, phh, o.x, o.y, obstacleHalfW(o.kind), obstacleHalfH(o.kind))) {
        o.hit = true;
        this.dents--;
        this.invuln = B.invulnTime;
        this.speedMul = B.hitSlowdown;
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
