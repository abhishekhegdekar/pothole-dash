import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave, SaveStore, type SaveData, type StorageLike } from '../src/storage/save';

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

const sample = (): SaveData => ({
  ...defaultSave(),
  bestDistance: 812.5,
  bestScore: 990,
  runs: 4,
  muted: true,
  coins: 120,
  points: 4500,
  scrap: 7,
  settings: { vibration: false, graphics: 'low', musicVol: 0.25, sfxVol: 1 },
  ownedMaps: ['mumbai', 'thane', 'bangalore'],
  selectedMap: 'bangalore',
  bestByMap: { mumbai: 990, bangalore: 40 },
});

describe('save', () => {
  it('round-trips valid data', () => {
    const s = new SaveStore(new MemStorage());
    s.save(sample());
    expect(s.load()).toEqual(sample());
  });
  it('migrates a version 1 save', () => {
    expect(parseSave('{"v":1,"bestDistance":640.4,"runs":3,"muted":true}')).toEqual({
      ...defaultSave(), bestDistance: 640.4, bestScore: 640, runs: 3, muted: true, bestByMap: { mumbai: 640 },
    });
  });
  it('migrates a version 2 save, keeping progress and starting an empty wallet', () => {
    expect(parseSave('{"v":2,"bestDistance":300,"bestScore":410,"runs":9,"muted":false}')).toEqual({
      ...defaultSave(), bestDistance: 300, bestScore: 410, runs: 9, bestByMap: { mumbai: 410 },
    });
  });
  it('migrates a version 3 save and ignores a pick the player does not own', () => {
    const v3 = '{"v":3,"bestScore":77,"coins":50,"selectedMap":"bangalore"}';
    expect(parseSave(v3)).toEqual({ ...defaultSave(), bestScore: 77, coins: 50, bestByMap: { mumbai: 77 } });
  });
  it('resets corrupted or unknown data without throwing', () => {
    expect(parseSave('{not json')).toEqual(defaultSave());
    expect(parseSave('null')).toEqual(defaultSave());
    expect(parseSave('{"v":99,"bestDistance":5}')).toEqual(defaultSave());
    expect(parseSave('{"v":4,"bestDistance":-3,"coins":"x","settings":"bad","ownedMaps":"x"}')).toEqual(defaultSave());
  });
  it('keeps working in memory when storage is blocked', () => {
    const s = new SaveStore(new BrokenStorage());
    s.save({ ...defaultSave(), bestDistance: 100 });
    expect(s.load().bestDistance).toBe(100);
  });
});
