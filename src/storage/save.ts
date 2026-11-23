/** Versioned save data. Reads are validated; bad or old data is migrated or reset, never thrown. */
export const SAVE_VERSION = 1;
const KEY = 'pothole-dash.save';

export interface SaveData {
  v: typeof SAVE_VERSION;
  bestDistance: number;
  runs: number;
  muted: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSave(): SaveData {
  return { v: SAVE_VERSION, bestDistance: 0, runs: 0, muted: false };
}

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);

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
  if (d.v !== SAVE_VERSION) return defaultSave();
  return {
    v: SAVE_VERSION,
    bestDistance: num(d.bestDistance),
    runs: Math.floor(num(d.runs)),
    muted: d.muted === true,
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
