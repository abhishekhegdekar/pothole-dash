import { BALANCE as B } from '../data/balance';
import { ObstacleKind, OBSTACLES, POTHOLES_ONLY, type ObstacleMix } from '../data/obstacles';
import type { Rng } from '../core/rng';
import { blocksLane, laneCenter } from './collision';
import { doubleChanceAt, largeChanceAt } from './difficulty';

export const MAX_PER_ROW = 3;

/** One row of obstacles. Reused between calls, so the spawner never allocates. */
export interface Row {
  count: number;
  kind: ObstacleKind[];
  x: number[];
  /** Forward offset from the row's position, in metres. */
  dy: number[];
  variant: number[];
  /** Bit i set = lane i is safe in this row. */
  freeMask: number;
  /** Lanes kept clear in this row because moving traffic passes through them. */
  blockedMask: number;
}

export function createRow(): Row {
  return {
    count: 0,
    kind: new Array<ObstacleKind>(MAX_PER_ROW).fill(ObstacleKind.SmallPothole),
    x: new Array<number>(MAX_PER_ROW).fill(0),
    dy: new Array<number>(MAX_PER_ROW).fill(0),
    variant: new Array<number>(MAX_PER_ROW).fill(0),
    freeMask: 0,
    blockedMask: 0,
  };
}

/**
 * How many lanes the player can move between two rows that are `interval`
 * seconds apart at `speed`, after reacting and allowing for row jitter.
 */
export function maxLaneShift(interval: number, speed: number, laneChangeTime: number): number {
  const usable = interval - (2 * B.rowJitter) / speed - B.reactionTime;
  return Math.max(0, Math.floor(usable / laneChangeTime));
}

/** Every safe lane in `from` can reach at least one safe lane in `to` within `shift` lanes. */
export function everyLaneReachable(from: number, to: number, shift: number, laneCount: number): boolean {
  for (let i = 0; i < laneCount; i++) {
    if (!(from & (1 << i))) continue;
    let ok = false;
    for (let j = Math.max(0, i - shift); j <= Math.min(laneCount - 1, i + shift); j++) {
      if (to & (1 << j)) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  return true;
}

/** Lanes not blocked by anything in the row. Obstacles that only slow you (speed breakers) block nothing. */
export function computeFreeMask(row: Row, laneCount: number, playerWidth: number): number {
  let mask = 0;
  for (let lane = 0; lane < laneCount; lane++) {
    let free = true;
    for (let k = 0; k < row.count; k++) {
      const kind = row.kind[k]!;
      if (OBSTACLES[kind].effect === 'slow') continue;
      if (blocksLane(kind, row.x[k]!, lane, playerWidth)) {
        free = false;
        break;
      }
    }
    if (free) mask |= 1 << lane;
  }
  return mask;
}

const isMover = (k: ObstacleKind): boolean => OBSTACLES[k].motion !== 0;

/**
 * Makes obstacle rows that are always fair: every lane that was safe in the
 * previous row has a safe lane in this row that the player can reach in time.
 *
 * Moving traffic keeps to its lane. Its speed is a fraction of the player's speed, so the
 * point where the player catches it is known when it spawns. Its lane is kept clear in the
 * rows it will drive through, so it never overlaps other obstacles and fairness still holds.
 */
export class Spawner {
  private prevMask: number;
  private readonly blockRows: number[];
  private readonly specialKinds: ObstacleKind[] = [];
  private readonly specialWeights: number[] = [];
  private specialTotal = 0;

  constructor(
    private readonly rng: Rng,
    private readonly laneCount: number,
    private readonly playerWidth: number,
    private readonly laneChangeTime: number,
    private readonly mix: ObstacleMix = POTHOLES_ONLY,
  ) {
    this.prevMask = 1 << B.startLane;
    this.blockRows = new Array<number>(laneCount).fill(0);
    for (const [k, w] of Object.entries(mix.specials)) {
      if (!w || w <= 0) continue;
      this.specialKinds.push(Number(k) as ObstacleKind);
      this.specialWeights.push(w);
      this.specialTotal += w;
    }
  }

  reset(startLane: number): void {
    this.prevMask = 1 << startLane;
    this.blockRows.fill(0);
  }

  get previousMask(): number {
    return this.prevMask;
  }

  private pickSpecial(): ObstacleKind | null {
    if (this.specialTotal <= 0 || !this.rng.chance(this.mix.specialRate)) return null;
    let r = this.rng.range(0, this.specialTotal);
    for (let i = 0; i < this.specialKinds.length; i++) {
      r -= this.specialWeights[i]!;
      if (r <= 0) return this.specialKinds[i]!;
    }
    return this.specialKinds[this.specialKinds.length - 1]!;
  }

  /**
   * Fills `out` with the next row. `t` is run time, `speed` and `interval` describe spacing,
   * `ahead` is how far in front of the player the row appears.
   */
  next(out: Row, t: number, speed: number, interval: number, ahead = 50): void {
    const shift = maxLaneShift(interval, speed, this.laneChangeTime);
    const all = (1 << this.laneCount) - 1;
    let blocked = 0;
    for (let l = 0; l < this.laneCount; l++) {
      if (this.blockRows[l]! > 0) {
        blocked |= 1 << l;
        this.blockRows[l]!--;
      }
    }
    out.blockedMask = blocked;
    const open = all & ~blocked;
    const special = this.pickSpecial();

    // Speed breaker: a row of its own across the road.
    if (special === ObstacleKind.SpeedBreaker) {
      if (everyLaneReachable(this.prevMask, open, shift, this.laneCount)) {
        out.count = 1;
        out.kind[0] = special;
        out.x[0] = (this.laneCount * B.laneWidth) / 2;
        out.dy[0] = 0;
        out.variant[0] = 0;
        out.freeMask = open;
        this.prevMask = open;
        return;
      }
    }

    // Moving traffic: alone in its row, and only when no other mover is around.
    if (special !== null && isMover(special) && blocked === 0) {
      const start = this.rng.int(0, this.laneCount);
      for (let i = 0; i < this.laneCount; i++) {
        const lane = (start + i) % this.laneCount;
        const mask = all & ~(1 << lane);
        if (!everyLaneReachable(this.prevMask, mask, shift, this.laneCount)) continue;
        const def = OBSTACLES[special];
        const m = def.motion;
        // Road the mover covers after this row: up to where the player catches it (same way),
        // or from where it starts down to this row (oncoming).
        const span = m > 0 ? (m / (1 - m)) * ahead : -m * ahead;
        const spacing = Math.max(1, interval * speed);
        this.blockRows[lane] = Math.ceil((span + def.h) / spacing) + 1;
        out.count = 1;
        out.kind[0] = special;
        out.x[0] = laneCenter(lane);
        out.dy[0] = 0;
        out.variant[0] = this.rng.int(0, def.variants);
        out.freeMask = mask;
        this.prevMask = mask;
        return;
      }
    }

    const staticSpecial = special !== null && !isMover(special) && special !== ObstacleKind.SpeedBreaker ? special : null;
    const pDouble = doubleChanceAt(t);
    const pLarge = largeChanceAt(t);
    for (let attempt = 0; attempt < 14; attempt++) {
      let want = this.rng.chance(pDouble) ? 2 : 1;
      if (want === 2 && this.laneCount >= 4 && this.rng.chance(pDouble * 0.5)) want = 3;
      let placed = 0;
      for (let k = 0; k < want; k++) {
        let kind: ObstacleKind;
        if (staticSpecial !== null && (k === 0 || this.rng.chance(0.6))) kind = staticSpecial;
        else if (this.laneCount >= 2 && this.rng.chance(pLarge)) kind = ObstacleKind.LargePothole;
        else kind = this.rng.chance(this.mix.puddleRate) ? ObstacleKind.Puddle : ObstacleKind.SmallPothole;
        const def = OBSTACLES[kind];
        let x: number;
        if (def.place === 'span') {
          x = this.rng.int(1, this.laneCount) * B.laneWidth + this.rng.range(-0.6, 0.6);
        } else {
          const j = Math.max(0, Math.min(0.5, (B.laneWidth - def.w) / 2));
          x = laneCenter(this.rng.int(0, this.laneCount)) + this.rng.range(-j, j);
        }
        // Keep obstacles in one row apart, and out of lanes that traffic is using.
        let clash = false;
        for (let m = 0; m < placed; m++) {
          const minGap = (def.w + OBSTACLES[out.kind[m]!].w) / 2;
          if (Math.abs(x - out.x[m]!) < minGap) clash = true;
        }
        for (let l = 0; l < this.laneCount && !clash; l++) {
          if (blocked & (1 << l) && blocksLane(kind, x, l, B.laneWidth / B.hitboxScale)) clash = true;
        }
        if (clash) continue;
        out.kind[placed] = kind;
        out.x[placed] = x;
        out.dy[placed] = this.rng.range(-B.rowJitter, B.rowJitter);
        out.variant[placed] = this.rng.int(0, def.variants);
        placed++;
      }
      out.count = placed;
      if (placed === 0) continue;
      const mask = computeFreeMask(out, this.laneCount, this.playerWidth) & open;
      if (mask !== 0 && everyLaneReachable(this.prevMask, mask, shift, this.laneCount)) {
        out.freeMask = mask;
        this.prevMask = mask;
        return;
      }
    }
    // Could not find a fair layout: leave the row empty.
    out.count = 0;
    out.freeMask = open;
    this.prevMask = open;
  }
}
