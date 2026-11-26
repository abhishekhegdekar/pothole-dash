import { describe, expect, it } from 'vitest';
import { UPGRADES, storyRules, storyVehicle } from '../src/data/upgrades';
import { VEHICLES } from '../src/data/vehicles';
import { SAVE_VERSION, parseSave } from '../src/storage/save';
import { World } from '../src/systems/world';
import { STORY_ROAD } from '../src/data/story';

describe('Workshop upgrades', () => {
  it('every upgrade has three levels with rising costs', () => {
    expect(UPGRADES).toHaveLength(8);
    for (const u of UPGRADES) {
      expect(u.points[0]).toBeLessThan(u.points[1]);
      expect(u.points[1]).toBeLessThan(u.points[2]);
      expect(u.scrap[0]).toBeLessThanOrEqual(u.scrap[1]);
    }
  });

  it('a stock SUV has the ram bar and gun fitted and a standard tank', () => {
    const r = storyRules({});
    expect(r).toMatchObject({ fuel: true, ram: 1, gun: 1, tank: 1 });
    expect(storyVehicle({})).toEqual(VEHICLES.rig);
  });

  it('each level makes the SUV better', () => {
    for (let l = 1; l <= 3; l++) {
      const prevV = storyVehicle({ engine: l - 1, tyres: l - 1, armour: l - 1 });
      const v = storyVehicle({ engine: l, tyres: l, armour: l });
      expect(v.speedMul).toBeGreaterThan(prevV.speedMul);
      expect(v.laneChangeTime).toBeLessThan(prevV.laneChangeTime);
      expect(v.dents).toBe(prevV.dents + 1);
      const prev = storyRules({ ram: l - 1, tank: l - 1, brakes: l - 1, lights: l - 1, gun: l - 1 });
      const r = storyRules({ ram: l, tank: l, brakes: l, lights: l, gun: l });
      expect(r.ram).toBe(prev.ram + 1);
      expect(r.tank).toBeGreaterThan(prev.tank);
      expect(r.brake!).toBeLessThan(prev.brake!);
      expect(r.magnet!).toBeGreaterThan(prev.magnet!);
      expect(r.gun).toBeGreaterThanOrEqual(prev.gun);
    }
  });

  it('a bigger tank goes further on the same fuel', () => {
    const run = (tank: number): number => {
      const w = new World(storyVehicle({}), 9, STORY_ROAD.laneCount, STORY_ROAD.mix);
      w.configure(storyVehicle({}), STORY_ROAD.laneCount, STORY_ROAD.mix, { ...storyRules({ tank }), gun: 0 });
      w.reset(9);
      w.dents = 999;
      w.coins.length = 0; // no fuel cans
      while (w.alive && w.t < 600) {
        w.update(1 / 60);
        w.clearEvents();
      }
      return w.dist;
    };
    expect(run(3)).toBeGreaterThan(run(0) * 1.6);
  });

  it('old saves gain an empty workshop; bad levels are clamped', () => {
    const old = parseSave(JSON.stringify({ v: 4, coins: 5, points: 100 }));
    expect(old.v).toBe(SAVE_VERSION);
    expect(old.upgrades).toEqual({});
    expect(old.paint).toBe('olive');
    expect(old.weapons).toEqual(['bat']);
    const odd = parseSave(JSON.stringify({ v: 5, upgrades: { engine: 9, ram: -2, x: 'a' }, weapons: ['machete', 7] }));
    expect(odd.upgrades).toEqual({ engine: 3, ram: 0, x: 0 });
    expect(odd.weapons).toEqual(['bat', 'machete']);
  });
});
