import { BALANCE as B } from '../data/balance';
import { ObstacleKind, OBSTACLES } from '../data/obstacles';
import type { Rng } from '../core/rng';
import { blocksLane, laneCenter } from './collision';
import { doubleChanceAt, largeChanceAt } from './difficulty';

export const MAX_PER_ROW = 2;

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
}

export function createRow(): Row {
  return {
    count: 0,
    kind: new Array<ObstacleKind>(MAX_PER_ROW).fill(ObstacleKind.SmallPothole),
    x: new Array<number>(MAX_PER_ROW).fill(0),
    dy: new Array<number>(MAX_PER_ROW).fill(0),
    variant: new Array<number>(MAX_PER_ROW).fill(0),
    freeMask: 0,
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

export function computeFreeMask(row: Row, laneCount: number, playerWidth: number): number {
  let mask = 0;
  for (let lane = 0; lane < laneCount; lane++) {
    let free = true;
    for (let k = 0; k < row.count; k++) {
      if (blocksLane(row.kind[k]!, row.x[k]!, lane, playerWidth)) {
        free = false;
        break;
      }
    }
    if (free) mask |= 1 << lane;
  }
  return mask;
}

/**
 * Makes obstacle rows that are always fair: every lane that was safe in the
 * previous row has a safe lane in this row that the player can reach in time.
 */
export class Spawner {
  private prevMask: number;

  constructor(
    private readonly rng: Rng,
    private readonly laneCount: number,
    private readonly playerWidth: number,
    private readonly laneChangeTime: number,
  ) {
    this.prevMask = 1 << B.startLane;
  }

  reset(startLane: number): void {
    this.prevMask = 1 << startLane;
  }

  get previousMask(): number {
    return this.prevMask;
  }

  /** Fills `out` with the next row. `t` is run time, `speed` and `interval` describe spacing. */
  next(out: Row, t: number, speed: number, interval: number): void {
    const shift = maxLaneShift(interval, speed, this.laneChangeTime);
    const pDouble = doubleChanceAt(t);
    const pLarge = largeChanceAt(t);
    const all = (1 << this.laneCount) - 1;

    for (let attempt = 0; attempt < 12; attempt++) {
      out.count = this.rng.chance(pDouble) ? 2 : 1;
      let placed = 0;
      for (let k = 0; k < out.count; k++) {
        const large = this.laneCount >= 2 && this.rng.chance(pLarge);
        const kind = large ? ObstacleKind.LargePothole : ObstacleKind.SmallPothole;
        const x = large
          ? this.rng.int(1, this.laneCount) * B.laneWidth + this.rng.range(-0.6, 0.6)
          : laneCenter(this.rng.int(0, this.laneCount)) + this.rng.range(-0.5, 0.5);
        // Keep two obstacles in one row from overlapping each other.
        let clash = false;
        for (let m = 0; m < placed; m++) {
          const minGap = (OBSTACLES[kind].w + OBSTACLES[out.kind[m]!].w) / 2;
          if (Math.abs(x - out.x[m]!) < minGap) clash = true;
        }
        if (clash) continue;
        out.kind[placed] = kind;
        out.x[placed] = x;
        out.dy[placed] = this.rng.range(-B.rowJitter, B.rowJitter);
        out.variant[placed] = this.rng.int(0, OBSTACLES[kind].variants);
        placed++;
      }
      out.count = placed;
      if (placed === 0) continue;
      const mask = computeFreeMask(out, this.laneCount, this.playerWidth);
      if (mask !== 0 && everyLaneReachable(this.prevMask, mask, shift, this.laneCount)) {
        out.freeMask = mask;
        this.prevMask = mask;
        return;
      }
    }
    // Could not find a fair layout: leave the row empty.
    out.count = 0;
    out.freeMask = all;
    this.prevMask = all;
  }
}
