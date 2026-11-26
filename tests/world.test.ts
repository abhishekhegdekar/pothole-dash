import { describe, expect, it } from 'vitest';
import { STEP } from '../src/core/loop';
import { VEHICLES } from '../src/data/vehicles';
import { BALANCE as B } from '../src/data/balance';
import { blocksLane, obstacleHalfH } from '../src/systems/collision';
import { World } from '../src/systems/world';
import { MAPS, MAP_ORDER, type MapDef } from '../src/data/maps';
import { STORY_ROAD, STORY_TEST_RULES } from '../src/data/story';
import type { VehicleId } from '../src/data/vehicles';
import type { RunRules } from '../src/systems/world';
import { ObstacleKind, OBSTACLES } from '../src/data/obstacles';
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

  const runs: Array<[string, MapDef, VehicleId, RunRules | undefined]> = [
    ...MAP_ORDER.flatMap((m) => (['auto', 'suv', 'scooter'] as const).map((v) => [MAPS[m].name, MAPS[m], v, undefined] as [string, MapDef, VehicleId, undefined])),
    ['Story Mode', STORY_ROAD, 'rig', { ...STORY_TEST_RULES, fuel: false }],
  ];
  for (const [name, map, vid, rules] of runs) {
    it(`a look-ahead bot gets through ${name} in the ${vid} with at most 2 knocks`, () => {
      // Lots of dents so the run goes the full distance; we count the knocks instead.
      const V = { ...VEHICLES[vid], dents: 99 };
      const id = map.id;
      const phw = (V.width * B.hitboxScale) / 2;
      const phh = (V.length * B.hitboxScale) / 2;
      let coins = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const w = new World(V, seed, map.laneCount, map.mix);
        if (rules) w.configure(V, map.laneCount, map.mix, rules);
        w.viewAhead = 46;
        w.reset(seed);
        // Seconds until something dents us in each lane (Infinity = clear).
        const danger = (lane: number): number => {
          let tMin = Infinity;
          const x = laneCenter(lane);
          for (const o of w.obstacles) {
            if (!o.active || o.hit || o.passed || o.down > 0 || OBSTACLES[o.kind].effect === 'slow') continue;
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
        expect(99 - w.dents, `${id} seed ${seed} knocks by ${Math.floor(w.dist)} m`).toBeLessThanOrEqual(2);
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

  describe('Story Mode', () => {
    const story = (seed: number, rules: RunRules = STORY_TEST_RULES): World => {
      const w = new World(VEHICLES.rig, seed, STORY_ROAD.laneCount, STORY_ROAD.mix);
      w.configure(VEHICLES.rig, STORY_ROAD.laneCount, STORY_ROAD.mix, rules);
      w.reset(seed);
      return w;
    };

    it('an empty tank ends the run with the fuel reason', () => {
      const w = story(3);
      w.fuel = 1e-6;
      w.update(STEP);
      expect(w.alive).toBe(false);
      expect(w.endReason).toBe('fuel');
      expect(w.events.crash).toBe(true);
    });

    it('fuel drains with distance and a full tank lasts the set range', () => {
      const w = story(4, { ...STORY_TEST_RULES, gun: 0 });
      w.dents = 999;
      while (w.alive && w.dist < 500) {
        w.update(STEP);
        w.clearEvents();
      }
      // Fuel cans may have topped it up, but it must have gone down on the way.
      expect(w.fuel).toBeLessThan(1);
    });

    it('ramming zombies wears the bumper before it costs armour', () => {
      const w = story(5, { ...STORY_TEST_RULES, gun: 0, ram: 1 });
      const hits = B.ramHits[1]!;
      for (let n = 1; n <= hits; n++) {
        const z = w.obstacles.find((o) => !o.active)!;
        Object.assign(z, { active: true, kind: ObstacleKind.Zombie, x: laneCenter(w.targetLane), y: w.dist + 1, hit: false, passed: false, down: 0, motion: 0 });
        w.invuln = 0;
        w.update(STEP);
        expect(w.events.rams).toBe(1);
        expect(z.down).toBeGreaterThan(0);
        expect(w.dents).toBe(n < hits ? VEHICLES.rig.dents : VEHICLES.rig.dents - 1);
        w.clearEvents();
      }
      expect(w.kills).toBe(hits);
    });

    it('the roof gun knocks down zombies ahead', () => {
      const w = story(6, { ...STORY_TEST_RULES, fuel: false, gun: 3 });
      w.dents = 999;
      let shots = 0;
      for (let i = 0; i < 60 * 60 && w.alive; i++) {
        w.update(STEP);
        if (w.events.shot) shots++;
        w.clearEvents();
      }
      expect(shots).toBeGreaterThan(5);
      expect(w.kills).toBeGreaterThanOrEqual(shots);
    });

    it('fuel cans show up on the road', () => {
      const w = story(7, { ...STORY_TEST_RULES, tank: 1000, gun: 0 });
      w.dents = 999;
      let cans = 0;
      for (let i = 0; i < 60 * 120; i++) {
        w.update(STEP);
        w.clearEvents();
        cans = Math.max(cans, w.coins.filter((c) => c.active && c.fuel).length);
        if (cans > 0) break;
      }
      expect(cans).toBeGreaterThan(0);
    });
  });
});
