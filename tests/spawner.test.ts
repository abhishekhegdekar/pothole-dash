import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { BALANCE as B } from '../src/data/balance';
import { VEHICLES } from '../src/data/vehicles';
import { rowIntervalAt, speedAt } from '../src/systems/difficulty';
import { computeFreeMask, createRow, everyLaneReachable, maxLaneShift, Spawner } from '../src/systems/spawner';

const V = VEHICLES.auto;

describe('spawner fairness', () => {
  it('can always shift at least one lane between rows, even at top difficulty', () => {
    for (let t = 0; t <= 600; t += 5) {
      expect(maxLaneShift(rowIntervalAt(t), speedAt(t), V.laneChangeTime)).toBeGreaterThanOrEqual(1);
    }
  });

  it('every row leaves a safe lane reachable from every previously safe lane, across 10,000 seeds', () => {
    const row = createRow();
    const all = (1 << B.laneCount) - 1;
    let obstacles = 0;
    const failures: string[] = [];
    for (let seed = 1; seed <= 10000; seed++) {
      const spawner = new Spawner(new Rng(seed), B.laneCount, V.width, V.laneChangeTime);
      let prev = 1 << B.startLane;
      // 60 rows spread over a long run, so late-game difficulty is covered too.
      for (let i = 0; i < 60; i++) {
        const t = i * 3;
        const speed = speedAt(t);
        const interval = rowIntervalAt(t);
        spawner.next(row, t, speed, interval);
        const mask = computeFreeMask(row, B.laneCount, V.width);
        if ((mask & all) === 0) failures.push(`seed ${seed} row ${i}: no safe lane`);
        if (mask !== row.freeMask) failures.push(`seed ${seed} row ${i}: mask mismatch`);
        if (!everyLaneReachable(prev, mask, maxLaneShift(interval, speed, V.laneChangeTime), B.laneCount)) {
          failures.push(`seed ${seed} row ${i}: unreachable`);
        }
        prev = mask;
        obstacles += row.count;
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
    // Sanity: the spawner really is placing obstacles, not just giving up.
    expect(obstacles).toBeGreaterThan(10000 * 60);
  }, 30000);

  it('is deterministic for a seed', () => {
    const a = new Spawner(new Rng(42), B.laneCount, V.width, V.laneChangeTime);
    const b = new Spawner(new Rng(42), B.laneCount, V.width, V.laneChangeTime);
    const ra = createRow();
    const rb = createRow();
    for (let i = 0; i < 200; i++) {
      a.next(ra, i, speedAt(i), rowIntervalAt(i));
      b.next(rb, i, speedAt(i), rowIntervalAt(i));
      expect(ra.count).toBe(rb.count);
      expect(ra.x.slice(0, ra.count)).toEqual(rb.x.slice(0, rb.count));
    }
  });
});
