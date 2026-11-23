import { describe, expect, it } from 'vitest';
import { STEP } from '../src/core/loop';
import { BALANCE as B } from '../src/data/balance';
import { ObstacleKind } from '../src/data/obstacles';
import { VEHICLES } from '../src/data/vehicles';
import { laneCenter, obstacleHalfW } from '../src/systems/collision';
import { nextMilestone } from '../src/systems/scoring';
import { World } from '../src/systems/world';

const phw = (VEHICLES.auto.width * B.hitboxScale) / 2;

/** A world with no random rows, and one hand-placed pothole just ahead. */
function worldWithPothole(x: number): World {
  const w = new World(VEHICLES.auto, 1);
  for (let i = 1; i < w.obstacles.length; i++) w.obstacles[i]!.active = false;
  const o = w.obstacles[0]!;
  Object.assign(o, { active: true, kind: ObstacleKind.SmallPothole, x, y: 6, variant: 0, hit: false, passed: false });
  // Run long enough to pass it, but before the first spawned row arrives.
  for (let i = 0; i < 60; i++) {
    w.update(STEP);
    w.clearEvents();
  }
  return w;
}

describe('milestones', () => {
  it('steps through the list, then every 500 m', () => {
    expect(nextMilestone(0)).toBe(250);
    expect(nextMilestone(250)).toBe(500);
    expect(nextMilestone(999)).toBe(1000);
    expect(nextMilestone(1000)).toBe(1500);
    expect(nextMilestone(1720)).toBe(2000);
  });
});

describe('near misses', () => {
  const ohw = obstacleHalfW(ObstacleKind.SmallPothole);
  const edge = laneCenter(B.startLane) + phw + ohw;

  it('counts a close pass at the lane edge', () => {
    const w = worldWithPothole(edge + B.nearMissGap / 2);
    expect(w.nearMisses).toBe(1);
    expect(w.bonus).toBe(B.nearMissPoints);
    expect(w.dents).toBe(VEHICLES.auto.dents);
  });
  it('does not count a pass that is too far away', () => {
    const w = worldWithPothole(edge + B.nearMissGap + 0.05);
    expect(w.nearMisses).toBe(0);
  });
  it('a hit is not a near miss', () => {
    const w = worldWithPothole(laneCenter(B.startLane));
    expect(w.nearMisses).toBe(0);
    expect(w.dents).toBe(VEHICLES.auto.dents - 1);
  });
});
