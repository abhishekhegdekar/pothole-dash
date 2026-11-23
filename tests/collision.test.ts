import { describe, expect, it } from 'vitest';
import { BALANCE as B } from '../src/data/balance';
import { ObstacleKind } from '../src/data/obstacles';
import { VEHICLES } from '../src/data/vehicles';
import { blocksLane, boxesOverlap, laneCenter, overlap1D } from '../src/systems/collision';

const W = VEHICLES.auto.width;

describe('collision', () => {
  it('overlap1D is strict at the edges', () => {
    expect(overlap1D(0, 1, 2, 1)).toBe(false);
    expect(overlap1D(0, 1, 1.99, 1)).toBe(true);
  });
  it('boxes overlap only when both axes do', () => {
    expect(boxesOverlap(0, 0, 1, 1, 1.5, 0, 1, 1)).toBe(true);
    expect(boxesOverlap(0, 0, 1, 1, 1.5, 3, 1, 1)).toBe(false);
  });
  it('a centred small pothole blocks only its own lane', () => {
    for (let lane = 0; lane < B.laneCount; lane++) {
      for (let other = 0; other < B.laneCount; other++) {
        expect(blocksLane(ObstacleKind.SmallPothole, laneCenter(lane), other, W)).toBe(lane === other);
      }
    }
  });
  it('a small pothole at its widest offset still leaves the next lane clear', () => {
    expect(blocksLane(ObstacleKind.SmallPothole, laneCenter(0) + 0.5, 1, W)).toBe(false);
  });
  it('a large pothole on a lane line blocks both lanes', () => {
    const x = B.laneWidth; // line between lane 0 and 1
    expect(blocksLane(ObstacleKind.LargePothole, x, 0, W)).toBe(true);
    expect(blocksLane(ObstacleKind.LargePothole, x, 1, W)).toBe(true);
    expect(blocksLane(ObstacleKind.LargePothole, x, 2, W)).toBe(false);
  });
});
