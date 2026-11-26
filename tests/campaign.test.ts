import { describe, expect, it } from 'vitest';
import { CAMPS, CAMP_ORDER, campaignNodes, chapterAt, ending, gatesLevel, kmDone, legMetres, routeKm, APARTMENT, PUMP, GATES, MALL } from '../src/data/campaign';
import { legRoad } from '../src/data/story';
import { storyRules, storyVehicle } from '../src/data/upgrades';
import { parseSave, SAVE_VERSION } from '../src/storage/save';
import { FootWorld, ZOMBIES } from '../src/systems/foot';
import { World } from '../src/systems/world';

describe('Campaign', () => {
  it('every camp road is long, has all the stops and ends at the gates', () => {
    for (const id of CAMP_ORDER) {
      const km = routeKm(id);
      expect(km).toBeGreaterThan(300);
      expect(km).toBeLessThan(650);
      const nodes = campaignNodes(id);
      const kinds = nodes.map((n) => n.kind);
      expect(kinds.filter((k) => k === 'choose').length).toBe(1);
      expect(kinds[kinds.length - 1]).toBe('end');
      expect(nodes.some((n) => n.kind === 'drive' && n.theme === 'ghat')).toBe(true);
      expect(nodes.some((n) => n.kind === 'garage')).toBe(true);
      expect(nodes.some((n) => n.kind === 'foot' && n.level.layout === 'pump')).toBe(true);
      expect(nodes.filter((n) => n.kind === 'scene' && n.scene.choice).length).toBe(2);
      const chapters = nodes.filter((n) => n.chapter).map((n) => n.chapter![0]);
      expect(chapters).toEqual([1, 2, 3, 4, 5, 6]);
      expect(kmDone(id, nodes.length)).toBe(km);
      expect(chapterAt(id, nodes.length - 1)[0]).toBe(6);
      expect(CAMPS[id].name.length).toBeGreaterThan(3);
    }
  });

  it('drives are a sensible length', () => {
    expect(legMetres(10)).toBe(700);
    expect(legMetres(1000)).toBe(1800);
    expect(legMetres(100)).toBeGreaterThan(700);
  });

  it('two endings, picked by survivors taken along', () => {
    expect(ending(2, 2, 'north').title).not.toBe(ending(0, 0, 'north').title);
    expect(ending(0, 1, 'south').lines.length).toBeGreaterThan(2);
  });

  it('survivors make the gates easier', () => {
    const a = gatesLevel(0);
    const b = gatesLevel(3);
    expect(b.waves!.cap).toBeLessThan(a.waves!.cap);
    expect((b.zombies.walker ?? 0)).toBeLessThan(a.zombies.walker ?? 0);
  });

  it('a leg ends well at its goal, and the last stretch is clear', () => {
    const road = legRoad('highway', 'day', 0.5, 'Test');
    const w = new World(storyVehicle({}), 7, road.laneCount, road.mix);
    w.configure({ ...storyVehicle({}), dents: 99 }, road.laneCount, road.mix, { ...storyRules({}), tank: 1000, goal: 800, startFuel: 0.6 });
    w.reset(7);
    expect(w.fuel).toBeCloseTo(0.6);
    let arrived = false;
    for (let i = 0; i < 60 * 200 && !arrived; i++) {
      w.update(1 / 60);
      if (w.events.arrived) arrived = true;
      for (const o of w.obstacles) if (o.active) expect(o.y).toBeLessThan(800);
      w.clearEvents();
    }
    expect(arrived).toBe(true);
    expect(w.endReason).toBe('arrived');
    expect(w.dist).toBeGreaterThanOrEqual(800);
  });

  it('every on-foot place builds clean, with its supplies reachable off walls', () => {
    for (const lvl of [APARTMENT, PUMP, MALL, GATES, gatesLevel(2)]) {
      for (let seed = 1; seed < 30; seed++) {
        const w = new FootWorld(seed, lvl);
        expect(w.blocked(w.x, w.y, 0.32)).toBe(false);
        for (const z of w.zombies) if (z.active) expect(w.blocked(z.x, z.y, ZOMBIES[z.type].radius)).toBe(false);
        for (const c of w.crates) expect(w.blocked(c.x, c.y, 0.3)).toBe(false);
        expect(w.crates.filter((c) => c.kind !== 'scrap' && c.kind !== 'med').length).toBeGreaterThanOrEqual(lvl.goal);
      }
    }
  });

  it('the gates keep sending zombies', () => {
    const w = new FootWorld(3, GATES);
    for (const z of w.zombies) if (z.active) z.active = false;
    for (let i = 0; i < 60 * 10; i++) w.update(1 / 60, 0, 0, false);
    expect(w.zombies.filter((z) => z.active).length).toBeGreaterThan(1);
  });

  it('saves keep campaign progress; v5 saves start a fresh story', () => {
    const old = parseSave(JSON.stringify({ v: 5, scrap: 9 }));
    expect(old.v).toBe(SAVE_VERSION);
    expect(old.campaign.started).toBe(false);
    expect(old.scrap).toBe(9);
    const s = parseSave(JSON.stringify({ ...old, campaign: { started: true, camp: 'coast', node: 7, fuel: 0.4, helpers: 1, kindness: 2, endings: ['x'] } }));
    expect(s.campaign).toMatchObject({ camp: 'coast', node: 7, fuel: 0.4, helpers: 1 });
    const bad = parseSave(JSON.stringify({ ...old, campaign: { camp: 'mars', node: -3, fuel: 9 } }));
    expect(bad.campaign.camp).toBeNull();
    expect(bad.campaign.node).toBe(0);
    expect(bad.campaign.fuel).toBe(1);
  });
});
