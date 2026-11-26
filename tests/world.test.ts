import { describe, expect, it } from 'vitest';
import { STEP } from '../src/core/loop';
import { VEHICLES } from '../src/data/vehicles';
import { BALANCE as B } from '../src/data/balance';
import { blocksLane, obstacleHalfH } from '../src/systems/collision';
import { World } from '../src/systems/world';
import { MAPS, MAP_ORDER } from '../src/data/maps';
import { OBSTACLES } from '../src/data/obstacles';
import { laneCenter, obstacleHalfW } from '../src/systems/collision';

describe('World', () => {
  it('a player who never steers eventually loses all dents and the run ends', () => {
    const w = new World(VEHICLES.auto, 1);
    let steps = 0;
    while (w.alive && steps < 60 * 600) {
      w.update(STEP);
      w.clearEvents();
      steps++;
    }
    expect(w.alive).toBe(false);
    expect(w.dents).toBe(0);
    expect(w.dist).toBeGreaterThan(0);
  });

  it('a bot that always picks a safe lane survives a long run', () => {
    // Looks at the nearest row it has not passed yet and steers to the closest safe lane.
    const phh = (VEHICLES.auto.length * B.hitboxScale) / 2;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const w = new World(VEHICLES.auto, seed);
      for (let i = 0; i < 60 * 120 && w.alive; i++) {
        let rowY = Infinity;
        for (const o of w.obstacles) {
          if (o.active && o.y + obstacleHalfH(o.kind) > w.dist - phh && o.y < rowY) rowY = o.y;
        }
        if (rowY !== Infinity) {
          let best = -1;
          for (let lane = 0; lane < w.laneCount; lane++) {
            let free = true;
            for (const o of w.obstacles) {
              if (o.active && Math.abs(o.y - rowY) < 2 && blocksLane(o.kind, o.x, lane, VEHICLES.auto.width)) free = false;
            }
            if (free && (best < 0 || Math.abs(lane - w.targetLane) < Math.abs(best - w.targetLane))) best = lane;
          }
          if (best >= 0 && best !== w.targetLane) w.steer(best < w.targetLane ? -1 : 1);
        }
        w.update(STEP);
        w.clearEvents();
      }
      expect(w.dents, `seed ${seed} at ${Math.floor(w.dist)} m`).toBe(VEHICLES.auto.dents);
    }
  });

  for (const id of MAP_ORDER) {
    it(`a look-ahead bot gets through ${MAPS[id].name} without crashing`, () => {
      const V = VEHICLES.auto;
      const phw = (V.width * B.hitboxScale) / 2;
      const phh = (V.length * B.hitboxScale) / 2;
      let coins = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const w = new World(V, seed, MAPS[id].laneCount, MAPS[id].mix);
        w.viewAhead = 46;
        w.reset(seed);
        // Seconds until something dents us in each lane (Infinity = clear).
        const danger = (lane: number): number => {
          let tMin = Infinity;
          const x = laneCenter(lane);
          for (const o of w.obstacles) {
            if (!o.active || o.hit || o.passed || OBSTACLES[o.kind].effect !== 'dent') continue;
            if (Math.abs(o.x - x) >= obstacleHalfW(o.kind) + phw) continue;
            const gap = o.y - obstacleHalfH(o.kind) - (w.dist + phh);
            const t = gap <= 0 ? 0 : gap / Math.max(0.1, (1 - o.motion) * w.speed);
            if (o.y + obstacleHalfH(o.kind) > w.dist - phh) tMin = Math.min(tMin, t);
          }
          return tMin;
        };
        for (let i = 0; i < 60 * 90 && w.alive; i++) {
          if (w.lanePos === w.targetLane && danger(w.targetLane) < 1.4) {
            let best = w.targetLane;
            let bestT = danger(best);
            for (let lane = 0; lane < w.laneCount; lane++) {
              // The path there must be clear for the time it takes to get there.
              const steps = Math.abs(lane - w.targetLane);
              let ok = true;
              for (let s = 1; s <= steps; s++) {
                const mid = w.targetLane + Math.sign(lane - w.targetLane) * s;
                if (danger(mid) < s * V.laneChangeTime + 0.05) ok = false;
              }
              const t = danger(lane);
              if (ok && (t > bestT + 0.01 || (t === bestT && Math.abs(lane - w.targetLane) < Math.abs(best - w.targetLane)))) {
                best = lane;
                bestT = t;
              }
            }
            if (best !== w.targetLane) w.steer(best < w.targetLane ? -1 : 1);
          } else if (w.lanePos === w.targetLane) {
            // Already moving through lanes one at a time: keep going toward the safest one.
          }
          w.update(STEP);
          w.clearEvents();
        }
        expect(w.alive, `${id} seed ${seed} crashed at ${Math.floor(w.dist)} m`).toBe(true);
        coins += w.coinCount;
      }
      expect(coins).toBeGreaterThan(20);
    });
  }

  it('reset restores a fresh run', () => {
    const w = new World(VEHICLES.auto, 7);
    for (let i = 0; i < 600; i++) w.update(STEP);
    w.reset(8);
    expect(w.dist).toBe(0);
    expect(w.dents).toBe(VEHICLES.auto.dents);
    expect(w.alive).toBe(true);
    expect(w.obstacles.every((o) => !o.active)).toBe(true);
  });
});
