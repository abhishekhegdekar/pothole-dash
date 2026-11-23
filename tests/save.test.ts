import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave, SaveStore, type StorageLike } from '../src/storage/save';

class MemStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}
class BrokenStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('blocked');
  }
}

describe('save', () => {
  it('round-trips valid data', () => {
    const s = new SaveStore(new MemStorage());
    s.save({ v: 2, bestDistance: 812.5, bestScore: 990, runs: 4, muted: true });
    expect(s.load()).toEqual({ v: 2, bestDistance: 812.5, bestScore: 990, runs: 4, muted: true });
  });
  it('migrates a version 1 save', () => {
    expect(parseSave('{"v":1,"bestDistance":640.4,"runs":3,"muted":true}')).toEqual({
      v: 2, bestDistance: 640.4, bestScore: 640, runs: 3, muted: true,
    });
  });
  it('resets corrupted or unknown data without throwing', () => {
    expect(parseSave('{not json')).toEqual(defaultSave());
    expect(parseSave('null')).toEqual(defaultSave());
    expect(parseSave('{"v":99,"bestDistance":5}')).toEqual(defaultSave());
    expect(parseSave('{"v":2,"bestDistance":-3,"bestScore":"x","runs":"x"}')).toEqual(defaultSave());
  });
  it('keeps working in memory when storage is blocked', () => {
    const s = new SaveStore(new BrokenStorage());
    s.save({ v: 2, bestDistance: 100, bestScore: 100, runs: 1, muted: false });
    expect(s.load().bestDistance).toBe(100);
  });
});
