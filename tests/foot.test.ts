import { describe, expect, it } from 'vitest';
import { FootWorld, MALL_TEST, ZOMBIES, WEAPONS } from '../src/systems/foot';

const STEP = 1 / 60;

/** Clears the floor and puts one zombie of a type right in front of Raj. */
function duel(type: 'walker' | 'runner' | 'brute', gap = 1.0): FootWorld {
  const w = new FootWorld(1);
  for (const z of w.zombies) z.active = false;
  const z = w.zombies[0]!;
  Object.assign(z, { active: true, type, x: w.x, y: w.y + gap + ZOMBIES[type].radius, hp: ZOMBIES[type].hp, down: 0, lunge: 0, stagger: 0 });
  w.facing = Math.PI / 2;
  return w;
}

describe('FootWorld', () => {
  it('builds the same layout for the same seed', () => {
    const a = new FootWorld(42);
    const b = new FootWorld(42);
    expect(a.shelves).toEqual(b.shelves);
    expect(a.crates.map((c) => [c.x, c.y, c.kind])).toEqual(b.crates.map((c) => [c.x, c.y, c.kind]));
    expect(a.zombies.length).toBe(13);
  });

  it('nothing spawns inside a shelf, and the entrance is clear', () => {
    for (let seed = 1; seed < 50; seed++) {
      const w = new FootWorld(seed);
      for (const z of w.zombies) expect(w.blocked(z.x, z.y, ZOMBIES[z.type].radius)).toBe(false);
      for (const c of w.crates) expect(w.blocked(c.x, c.y, 0.3)).toBe(false);
      expect(w.blocked(w.x, w.y, 0.32)).toBe(false);
      expect(w.zombies.every((z) => z.y > 8)).toBe(true);
    }
  });

  it('two bat swings put a walker down; a brute takes six', () => {
    for (const [type, n] of [['walker', 2], ['runner', 1], ['brute', 6]] as const) {
      const w = duel(type, 0.6);
      let swings = 0;
      for (let i = 0; i < 60 * 10 && w.zombies[0]!.down === 0; i++) {
        // Stay in reach: step forward after each knockback.
        const z = w.zombies[0]!;
        const d = Math.hypot(z.x - w.x, z.y - w.y) - ZOMBIES[type].radius;
        w.update(STEP, 0, d > WEAPONS.bat.reach - 0.2 ? 1 : 0, true);
        if (w.events.swing) swings++;
        w.clearEvents();
      }
      expect(w.zombies[0]!.down, type).toBeGreaterThan(0);
      expect(swings, type).toBe(n);
      expect(w.kills).toBe(1);
    }
  });

  it('the machete hits harder', () => {
    const w = duel('brute', 0.6);
    w.weapon = 'machete';
    let swings = 0;
    for (let i = 0; i < 60 * 10 && w.zombies[0]!.down === 0; i++) {
      const z = w.zombies[0]!;
      const d = Math.hypot(z.x - w.x, z.y - w.y) - ZOMBIES.brute.radius;
      w.update(STEP, 0, d > WEAPONS.machete.reach - 0.2 ? 1 : 0, true);
      if (w.events.swing) swings++;
      w.clearEvents();
    }
    expect(swings).toBe(3);
  });

  it('a zombie that reaches Raj lunges and hurts him; standing still long enough is fatal', () => {
    const w = duel('walker', 0.2);
    let hurt = 0;
    for (let i = 0; i < 60 * 40 && w.alive; i++) {
      w.update(STEP, 0, 0, false);
      if (w.events.hurt) hurt++;
      w.clearEvents();
    }
    expect(hurt).toBeGreaterThan(3);
    expect(w.alive).toBe(false);
  });

  it('runners close the distance faster than walkers', () => {
    const dist = (type: 'walker' | 'runner'): number => {
      const w = duel(type, 6);
      for (let i = 0; i < 60; i++) w.update(STEP, 0, 0, false);
      const z = w.zombies[0]!;
      return Math.hypot(z.x - w.x, z.y - w.y);
    };
    expect(dist('runner')).toBeLessThan(dist('walker') - 1.5);
  });

  it('Raj cannot walk through shelves', () => {
    const w = new FootWorld(3);
    for (const z of w.zombies) z.active = false;
    for (let i = 0; i < 60 * 12; i++) {
      w.update(STEP, Math.sin(i * 0.01), 1, false);
      expect(w.blocked(w.x, w.y, 0.3)).toBe(false);
    }
  });

  it('searching crates finds supplies; the door only lets Raj out with enough of them', () => {
    const w = new FootWorld(5);
    for (const z of w.zombies) z.active = false;
    // Try to leave first: nothing happens.
    w.y = 1.2;
    w.update(STEP, 0, -1, false);
    expect(w.escaped).toBe(false);
    for (const c of w.crates.filter((k) => k.kind !== 'scrap' && k.kind !== 'med')) {
      w.x = c.x;
      w.y = c.y;
      for (let i = 0; i < 60; i++) w.update(STEP, 0, 0, false);
      expect(c.active).toBe(false);
    }
    expect(w.found).toBeGreaterThanOrEqual(MALL_TEST.goal);
    w.x = MALL_TEST.width / 2;
    w.y = 1.2;
    w.update(STEP, 0, -1, false);
    expect(w.escaped).toBe(true);
    expect(w.events.done).toBe('escaped');
  });
});
