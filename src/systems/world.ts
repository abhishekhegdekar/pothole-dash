import { BALANCE as B } from '../data/balance';
import { ObstacleKind, OBSTACLES, POTHOLES_ONLY, type ObstacleMix } from '../data/obstacles';
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
  /** Speed as a fraction of the player's speed (see ObstacleDef.motion). */
  motion: number;
}

export interface Coin {
  active: boolean;
  x: number;
  y: number;
}

/** Coins sit 2.2 m apart in a trail. */
const COIN_GAP = 2.2;
const COIN_POOL = 40;
const COIN_R = 0.45;

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
  /** Coins picked up this step. */
  coins: number;
  /** Drove over a speed breaker this step. */
  bump: boolean;
}

/** All game logic for a run. No DOM or drawing, so it can be unit tested. */
export class World {
  readonly obstacles: Obstacle[] = [];
  readonly events: WorldEvents = {
    hit: false, crash: false, laneChange: 0, hitX: 0, hitY: 0,
    nearMiss: 0, nearMissPoints: 0, nearMissX: 0, nearMissY: 0, milestone: 0, coins: 0, bump: false,
  };
  readonly coins: Coin[] = [];
  /** Coins picked up this run. */
  coinCount = 0;

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
  /** Set by the player: -1 brake, 0 cruise, +1 accelerate. */
  throttle: -1 | 0 | 1 = 0;
  /** Current throttle multiplier, easing toward the target. */
  throttleMul = 1;
  private boostAcc = 0;
  private nextRowY = 0;
  private nextMilestoneAt = 0;
  private readonly row = createRow();
  private lastRowY = 0;
  private lastRowMask = 0;
  private readonly rng: Rng;
  private spawner: Spawner;
  private readonly coinRng = new Rng(1);
  laneCount: number;
  vehicle: VehicleDef;
  /** Chance that the gap between two rows gets a coin trail. */
  coinRate = 0.45;

  constructor(vehicle: VehicleDef, seed: number, laneCount: number = B.laneCount, mix: ObstacleMix = POTHOLES_ONLY) {
    this.vehicle = vehicle;
    this.laneCount = laneCount;
    for (let i = 0; i < B.obstaclePool; i++) {
      this.obstacles.push({ active: false, kind: ObstacleKind.SmallPothole, x: 0, y: 0, variant: 0, hit: false, passed: false, motion: 0 });
    }
    for (let i = 0; i < COIN_POOL; i++) this.coins.push({ active: false, x: 0, y: 0 });
    this.rng = new Rng(seed);
    this.spawner = new Spawner(this.rng, laneCount, vehicle.width, vehicle.laneChangeTime, mix);
    this.reset(seed);
  }

  /** Switches map rules (lanes and obstacles) and vehicle. Takes effect from the next reset. */
  configure(vehicle: VehicleDef, laneCount: number, mix: ObstacleMix): void {
    this.vehicle = vehicle;
    this.laneCount = laneCount;
    this.spawner = new Spawner(this.rng, laneCount, vehicle.width, vehicle.laneChangeTime, mix);
  }

  /** Road width in metres. */
  get roadWidth(): number {
    return this.laneCount * B.laneWidth;
  }

  /** Distance plus near-miss bonus. */
  get score(): number {
    return Math.floor(this.dist) + this.bonus;
  }

  reset(seed: number): void {
    this.rng.reset(seed);
    this.coinRng.reset(seed ^ 0x5bd1e995);
    for (const o of this.obstacles) o.active = false;
    for (const c of this.coins) c.active = false;
    this.coinCount = 0;
    this.t = 0;
    this.dist = this.prevDist = 0;
    this.speed = B.startSpeed;
    this.speedMul = 1;
    this.throttle = 0;
    this.throttleMul = 1;
    this.boostAcc = 0;
    const start = Math.min(B.startLane, this.laneCount - 1);
    this.lanePos = this.prevLanePos = this.targetLane = start;
    this.spawner.reset(start);
    this.dents = this.vehicle.dents;
    this.invuln = 0;
    this.alive = true;
    this.crashT = 0;
    this.bonus = this.combo = this.comboTimer = this.nearMisses = this.bestCombo = 0;
    this.nextRowY = B.startSpeed * B.firstRowDelay + this.spawnAhead();
    this.lastRowY = this.nextRowY - 12;
    this.lastRowMask = 1 << start;
    this.nextMilestoneAt = nextMilestone(0);
    this.clearEvents();
  }

  clearEvents(): void {
    const e = this.events;
    e.hit = e.crash = false;
    e.laneChange = e.nearMiss = e.nearMissPoints = e.milestone = e.coins = 0;
    e.bump = false;
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
      this.moveTraffic(dt);
      return;
    }

    this.t += dt;
    if (this.speedMul < 1) this.speedMul = Math.min(1, this.speedMul + ((1 - B.hitSlowdown) * dt) / B.hitRecoverTime);
    const base = speedAt(this.t);
    const want = this.throttle > 0 ? B.boostMul : this.throttle < 0 ? B.brakeMul : 1;
    const dm = B.throttleRate * dt;
    this.throttleMul += Math.max(-dm * 1.6, Math.min(dm, want - this.throttleMul));
    this.speed = base * this.speedMul * this.throttleMul;
    this.dist += this.speed * dt;
    if (this.throttleMul > 1.01) {
      this.boostAcc += this.speed * dt * B.boostPoints * ((this.throttleMul - 1) / (B.boostMul - 1));
      const whole = Math.floor(this.boostAcc);
      this.bonus += whole;
      this.boostAcc -= whole;
    }
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

    this.moveTraffic(dt);

    // Spawn rows ahead, spaced by time at the current base speed.
    while (this.nextRowY < this.dist + this.spawnAhead()) {
      const interval = rowIntervalAt(this.t);
      const ahead = this.nextRowY - this.dist;
      this.spawner.next(this.row, this.t, base, interval, ahead);
      for (let k = 0; k < this.row.count; k++) {
        const o = this.take();
        if (!o) break;
        o.kind = this.row.kind[k]!;
        o.motion = OBSTACLES[o.kind].motion;
        o.x = this.row.x[k]!;
        o.y = this.nextRowY + this.row.dy[k]!;
        // Oncoming traffic starts further up the road and meets the player at the row.
        if (o.motion < 0) o.y += -o.motion * ahead;
        o.variant = this.row.variant[k]!;
        o.hit = false;
        o.passed = false;
      }
      this.layCoins(this.lastRowY, this.nextRowY, this.lastRowMask & this.row.freeMask & ~this.row.blockedMask);
      this.lastRowY = this.nextRowY;
      this.lastRowMask = this.row.freeMask & ~this.row.blockedMask;
      this.nextRowY += interval * base;
    }

    // Recycle obstacles behind the player, check hits and near misses.
    const px = laneCenter(this.lanePos);
    const phw = (this.vehicle.width * B.hitboxScale) / 2;
    const phh = (this.vehicle.length * B.hitboxScale) / 2;
    for (const c of this.coins) {
      if (!c.active) continue;
      if (c.y < this.dist - 6) {
        c.active = false;
        continue;
      }
      if (boxesOverlap(px, this.dist, phw + 0.15, phh, c.x, c.y, COIN_R, COIN_R)) {
        c.active = false;
        this.coinCount++;
        this.events.coins++;
      }
    }
    for (const o of this.obstacles) {
      if (!o.active) continue;
      if (o.y < this.dist - 12) {
        o.active = false;
        continue;
      }
      const ohw = obstacleHalfW(o.kind);
      const ohh = obstacleHalfH(o.kind);
      if (OBSTACLES[o.kind].effect === 'slow') {
        // Speed breaker: a jolt and a slowdown, never a dent.
        if (!o.hit && Math.abs(o.y - this.dist) < ohh + phh * 0.3) {
          o.hit = true;
          o.passed = true;
          // Braking for it means a gentle roll over; hitting it fast costs speed.
          if (this.throttleMul > 0.8) this.speedMul = Math.min(this.speedMul, 0.72);
          this.events.bump = true;
        }
        continue;
      }
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

  /** Moving traffic drives at a fraction of the player's speed, so where it meets the player is fixed. */
  private moveTraffic(dt: number): void {
    for (const o of this.obstacles) {
      if (o.active && o.motion !== 0) o.y += o.motion * this.speed * dt;
    }
  }

  /** Lays a short coin trail between two rows, in a lane that is safe at both ends. */
  private layCoins(fromY: number, toY: number, lanes: number): void {
    if (lanes === 0 || !this.coinRng.chance(this.coinRate)) return;
    const picks: number[] = [];
    for (let l = 0; l < this.laneCount; l++) if (lanes & (1 << l)) picks.push(l);
    const lane = picks[this.coinRng.int(0, picks.length)]!;
    const y0 = fromY + 2.6;
    const y1 = toY - 2.6;
    const n = Math.min(6, Math.floor((y1 - y0) / COIN_GAP) + 1);
    if (n < 2) return;
    const x = laneCenter(lane);
    for (let i = 0; i < n; i++) {
      const c = this.coins.find((k) => !k.active);
      if (!c) return;
      c.active = true;
      c.x = x;
      c.y = y0 + i * COIN_GAP;
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
