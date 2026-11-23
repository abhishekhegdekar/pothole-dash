import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });
  it('stays in range', () => {
    const r = new Rng(9);
    for (let i = 0; i < 10000; i++) {
      const v = r.int(0, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });
});
