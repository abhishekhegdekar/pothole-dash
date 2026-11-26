/** Versioned save data. Reads are validated; old versions are migrated, bad data is reset, never thrown. */
export const SAVE_VERSION = 4;
const KEY = 'pothole-dash.save';

export type GraphicsQuality = 'high' | 'low';

export interface Settings {
  vibration: boolean;
  graphics: GraphicsQuality;
  /** Volumes from 0 to 1. */
  musicVol: number;
  sfxVol: number;
}

export interface SaveData {
  v: typeof SAVE_VERSION;
  bestDistance: number;
  bestScore: number;
  runs: number;
  muted: boolean;
  /** Wallet. Coins buy Free Run vehicles and maps; points buy Story upgrades; scrap is found in Story. */
  coins: number;
  points: number;
  scrap: number;
  settings: Settings;
  /** Free Run maps and vehicles the player owns, and the current picks. */
  ownedMaps: string[];
  selectedMap: string;
  ownedVehicles: string[];
  selectedVehicle: string;
  /** Best score on each map. */
  bestByMap: Record<string, number>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    bestDistance: 0,
    bestScore: 0,
    runs: 0,
    muted: false,
    coins: 0,
    points: 0,
    scrap: 0,
    settings: { vibration: true, graphics: 'high', musicVol: 0.7, sfxVol: 0.9 },
    ownedMaps: ['mumbai', 'thane'],
    selectedMap: 'mumbai',
    ownedVehicles: ['auto'],
    selectedVehicle: 'auto',
    bestByMap: {},
  };
}

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
const vol = (x: unknown, fallback: number): number =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : fallback;
const int = (x: unknown): number => Math.floor(num(x));

export function parseSave(raw: string | null): SaveData {
  if (!raw) return defaultSave();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaultSave();
  }
  if (typeof data !== 'object' || data === null) return defaultSave();
  const d = data as Record<string, unknown>;
  // Migrations, oldest first. v1 had no score; v2 had no wallet or settings.
  if (d.v === 1) {
    d.bestScore = d.bestDistance;
    d.v = 2;
  }
  if (d.v === 2) d.v = 3;
  // v3 had no maps or vehicles: old best score counts for Mumbai, the original street.
  if (d.v === 3) {
    d.bestByMap = { mumbai: d.bestScore };
    d.v = 4;
  }
  if (d.v !== SAVE_VERSION) return defaultSave();

  const def = defaultSave();
  const ids = (x: unknown, base: string[]): string[] => {
    const list = Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string' && v.length < 40) : [];
    return [...new Set([...base, ...list])];
  };
  const ownedMaps = ids(d.ownedMaps, def.ownedMaps);
  const ownedVehicles = ids(d.ownedVehicles, def.ownedVehicles);
  const best: Record<string, number> = {};
  if (typeof d.bestByMap === 'object' && d.bestByMap !== null) {
    for (const [k, v] of Object.entries(d.bestByMap as Record<string, unknown>)) if (k.length < 40) best[k] = int(v);
  }
  const s = (typeof d.settings === 'object' && d.settings !== null ? d.settings : {}) as Record<string, unknown>;
  return {
    v: SAVE_VERSION,
    bestDistance: num(d.bestDistance),
    bestScore: int(d.bestScore),
    runs: int(d.runs),
    muted: d.muted === true,
    coins: int(d.coins),
    points: int(d.points),
    scrap: int(d.scrap),
    settings: {
      vibration: s.vibration !== false,
      graphics: s.graphics === 'low' ? 'low' : 'high',
      musicVol: vol(s.musicVol, 0.7),
      sfxVol: vol(s.sfxVol, 0.9),
    },
    ownedMaps,
    selectedMap: typeof d.selectedMap === 'string' && ownedMaps.includes(d.selectedMap) ? d.selectedMap : def.selectedMap,
    ownedVehicles,
    selectedVehicle:
      typeof d.selectedVehicle === 'string' && ownedVehicles.includes(d.selectedVehicle) ? d.selectedVehicle : def.selectedVehicle,
    bestByMap: best,
  };
}

/** Wraps localStorage. Falls back to memory when storage is blocked (private mode, sandboxed frames). */
export class SaveStore {
  private memory: string | null = null;
  private readonly storage: StorageLike | null;

  constructor(storage?: StorageLike | null) {
    if (storage !== undefined) {
      this.storage = storage;
    } else {
      let s: StorageLike | null = null;
      try {
        s = window.localStorage;
      } catch {
        s = null;
      }
      this.storage = s;
    }
  }

  load(): SaveData {
    let raw: string | null = this.memory;
    try {
      if (this.storage) raw = this.storage.getItem(KEY) ?? this.memory;
    } catch {
      /* use memory */
    }
    return parseSave(raw);
  }

  save(data: SaveData): void {
    const raw = JSON.stringify(data);
    this.memory = raw;
    try {
      this.storage?.setItem(KEY, raw);
    } catch {
      /* memory copy is kept */
    }
  }
}
