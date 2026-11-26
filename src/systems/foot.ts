import { Rng } from '../core/rng';

/**
 * On-foot sections of Story Mode: Raj leaves the SUV to search a building for supplies.
 * Top-down arena in metres: x across (0..width), y forward from the entrance (0..depth).
 * Pure logic, no DOM, so it can be unit tested.
 */

export type ZombieType = 'walker' | 'runner' | 'brute';
export type WeaponId = 'bat' | 'machete';
export type LootKind = 'scrap' | 'fuel' | 'med' | 'inhaler' | 'keys' | 'tools' | 'part';
/** Supplies that count toward a level's goal. */
export const SUPPLY_KINDS: LootKind[] = ['fuel', 'inhaler', 'keys', 'tools', 'part'];
export type FootLayout = 'mall' | 'apartment' | 'pump' | 'gates';

export interface ZombieDef {
  speed: number;
  hp: number;
  damage: number;
  radius: number;
  sight: number;
  /** Seconds from starting a lunge to the hit landing. */
  windup: number;
  /** Knockback when struck, metres. */
  knock: number;
}

export const ZOMBIES: Record<ZombieType, ZombieDef> = {
  walker: { speed: 1.15, hp: 2, damage: 12, radius: 0.34, sight: 9, windup: 0.55, knock: 0.9 },
  runner: { speed: 3.1, hp: 1, damage: 8, radius: 0.3, sight: 13, windup: 0.35, knock: 1.2 },
  brute: { speed: 0.85, hp: 6, damage: 26, radius: 0.55, sight: 8, windup: 0.8, knock: 0.35 },
};

export interface WeaponDef {
  damage: number;
  /** Reach from Raj's centre, metres, and the swing arc in radians. */
  reach: number;
  arc: number;
  cooldown: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bat: { damage: 1, reach: 1.55, arc: 2.0, cooldown: 0.5 },
  machete: { damage: 2, reach: 1.7, arc: 1.7, cooldown: 0.42 },
};

export interface Zombie {
  active: boolean;
  type: ZombieType;
  x: number;
  y: number;
  hp: number;
  facing: number;
  /** >0 while winding up a lunge. */
  lunge: number;
  /** >0 while staggered after being hit. */
  stagger: number;
  /** Seconds since knocked down (0 = up). */
  down: number;
  fall: number;
  wanderA: number;
  wanderT: number;
  variant: number;
}

export interface Crate {
  active: boolean;
  x: number;
  y: number;
  kind: LootKind;
  amount: number;
  /** Search progress 0..1 while Raj stands next to it. */
  search: number;
}

export interface Shelf {
  x: number;
  y: number;
  /** Half sizes. */
  hw: number;
  hh: number;
  /**
   * 0 shelf, 1 counter, 2 pillar, 3 wall, 4 parked car, 5 fuel pump, 6 sandbags, 7 tent,
   * 8 furniture, 9 kiosk, 10 truck, 11 generator.
   */
  kind: number;
}

export interface FootEvents {
  swing: boolean;
  hits: number;
  hitX: number;
  hitY: number;
  kills: number;
  hurt: boolean;
  loot: LootKind | null;
  lootAmount: number;
  lootX: number;
  lootY: number;
  done: 'escaped' | 'down' | null;
}

export interface FootLevel {
  layout: FootLayout;
  width: number;
  depth: number;
  /** How many supply crates Raj must find before leaving. */
  goal: number;
  /** The supply crates on the floor, in order (can be more than the goal, to leave spares). */
  supplies: LootKind[];
  zombies: Partial<Record<ZombieType, number>>;
  /** All crates, supplies included; the rest hold scrap and medkits. */
  crates: number;
  /** More zombies keep coming from the far end: one every `every` seconds, up to `cap` on their feet at once. */
  waves?: { every: number; cap: number; pool: number };
}

export const MALL_TEST: FootLevel = {
  layout: 'mall', width: 24, depth: 34, goal: 2, supplies: ['inhaler', 'fuel', 'fuel'], zombies: { walker: 9, runner: 3, brute: 1 }, crates: 9,
};

const PLAYER_R = 0.32;
const PLAYER_SPEED = 4.3;
const SEARCH_TIME = 0.7;
const HURT_INVULN = 0.7;
const MAX_HP = 100;
const EXIT_HALF = 2;

export class FootWorld {
  readonly zombies: Zombie[] = [];
  readonly crates: Crate[] = [];
  readonly shelves: Shelf[] = [];
  readonly events: FootEvents = { swing: false, hits: 0, hitX: 0, hitY: 0, kills: 0, hurt: false, loot: null, lootAmount: 0, lootX: 0, lootY: 0, done: null };
  level: FootLevel = MALL_TEST;
  weapon: WeaponId = 'bat';
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  facing = Math.PI / 2;
  hp = MAX_HP;
  readonly maxHp = MAX_HP;
  /** Swing animation 0..1 (1 = just swung). */
  swingK = 0;
  private swingCd = 0;
  invuln = 0;
  /** Supplies found toward the goal. */
  found = 0;
  scrap = 0;
  kills = 0;
  t = 0;
  alive = true;
  escaped = false;
  /** Moving this step (for the walk animation). */
  moving = false;
  private readonly rng = new Rng(1);
  private waveT = 0;

  constructor(seed = 1, level: FootLevel = MALL_TEST) {
    this.reset(seed, level);
  }

  get exitOpen(): boolean {
    return this.found >= this.level.goal;
  }

  reset(seed: number, level: FootLevel = this.level): void {
    this.level = level;
    this.rng.reset(seed);
    this.t = 0;
    this.hp = MAX_HP;
    this.found = this.scrap = this.kills = 0;
    this.alive = true;
    this.escaped = false;
    this.invuln = 0;
    this.swingK = this.swingCd = 0;
    this.x = this.prevX = level.width / 2;
    this.y = this.prevY = 1.6;
    this.facing = Math.PI / 2;
    this.buildLayout();
    this.clearEvents();
  }

  clearEvents(): void {
    const e = this.events;
    e.swing = e.hurt = false;
    e.hits = e.kills = e.lootAmount = 0;
    e.loot = null;
    e.done = null;
  }

  /** Supermarket floor: checkout counters near the door, then rows of shelves with cross aisles. */
  private buildMall(): void {
    const { width: W, depth: D } = this.level;
    const r = this.rng;
    // Checkout counters with gaps between them.
    for (let x = 3; x < W - 2; x += 4.2) {
      if (Math.abs(x + 1 - W / 2) < 2.2) continue;
      this.shelves.push({ x: x + 1, y: 6, hw: 1.0, hh: 0.4, kind: 1 });
    }
    // Shelf rows: aisles run forward; two cross aisles break them up.
    const blocks: Array<[number, number]> = [[9.5, 17], [19.5, 27.5]];
    for (let x = 2.6; x < W - 2; x += 3.4) {
      for (const [y0, y1] of blocks) {
        const shorten = r.chance(0.25) ? r.range(0.8, 2.2) : 0;
        const a = y0 + (r.chance(0.5) ? shorten : 0);
        const b = y1 - (a === y0 ? shorten : 0);
        this.shelves.push({ x, y: (a + b) / 2, hw: 0.55, hh: (b - a) / 2, kind: 0 });
      }
    }
    // A few pillars along the back.
    for (let x = 4; x < W - 2; x += 8) this.shelves.push({ x, y: D - 2.2, hw: 0.35, hh: 0.35, kind: 2 });
  }

  /** A wall from (x0, y0) to (x1, y1), axis aligned, 0.3 m thick. */
  private wall(x0: number, y0: number, x1: number, y1: number): void {
    const t = 0.15;
    this.shelves.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, hw: Math.max(t, Math.abs(x1 - x0) / 2), hh: Math.max(t, Math.abs(y1 - y0) / 2), kind: 3 });
  }

  /** Raj's building, ground floor: a lobby, flats with open doors on both sides, and the parking at the back. */
  private buildApartment(): void {
    const { width: W, depth: D } = this.level;
    const r = this.rng;
    const c0 = W / 2 - 3;
    const c1 = W / 2 + 3;
    // Lobby: the watchman's desk and the lift shaft by the stairs.
    this.shelves.push({ x: c0 - 1.6, y: 3.2, hw: 1.0, hh: 0.4, kind: 1 });
    this.shelves.push({ x: c1 + 1.8, y: 2.6, hw: 1.1, hh: 1.1, kind: 2 });
    // Flats: two on each side of the corridor, a doorway into each from the corridor.
    for (const [x, edge] of [[c0, 0], [c1, W]] as Array<[number, number]>) {
      for (const [y0, y1] of [[5, 12], [12, 19]] as Array<[number, number]>) {
        const door = r.range(y0 + 1.2, y1 - 2.4);
        this.wall(x, y0, x, door);
        this.wall(x, door + 1.6, x, y1);
        this.wall(Math.min(x, edge), y1, Math.max(x, edge), y1);
        // A sofa or a cupboard inside.
        const fx = (x + edge) / 2 + r.range(-1, 1);
        this.shelves.push({ x: fx, y: y0 + 1.6 + r.range(0, 2.5), hw: 1.0, hh: 0.45, kind: 8 });
      }
      this.wall(Math.min(x, edge), 5, Math.max(x, edge), 5);
    }
    // Parking: rows of cars under the building, pillars between them.
    for (const y of [23.5, 29.5]) {
      for (let x = 2.4; x < W - 2; x += 3.6) {
        if (Math.abs(x - W / 2) < 1.5) continue;
        if (r.chance(0.75)) this.shelves.push({ x, y, hw: 0.85, hh: 2.0, kind: 4 });
      }
    }
    for (let x = 4.2; x < W - 2; x += 7.2) this.shelves.push({ x, y: 26.5, hw: 0.35, hh: 0.35, kind: 2 });
    void D;
  }

  /** Highway fuel station at night: pump islands under the canopy, the kiosk, and cars left at the pumps. */
  private buildPump(): void {
    const { width: W } = this.level;
    const r = this.rng;
    for (const x of [W / 2 - 6, W / 2, W / 2 + 6]) this.shelves.push({ x, y: 11, hw: 0.55, hh: 1.6, kind: 5 });
    // Canopy pillars.
    for (const x of [W / 2 - 9, W / 2 + 9]) for (const y of [8, 14]) this.shelves.push({ x, y, hw: 0.3, hh: 0.3, kind: 2 });
    // Kiosk and the air pump, and a tanker parked behind.
    this.shelves.push({ x: W / 2 - 5, y: 24, hw: 4, hh: 2.4, kind: 9 });
    this.shelves.push({ x: W / 2 + 7, y: 25, hw: 1.2, hh: 4.2, kind: 10 });
    // Cars abandoned at the pumps and on the forecourt.
    for (let i = 0; i < 4; i++) {
      const x = [W / 2 - 3, W / 2 + 3, 3, W - 3][r.int(0, 4)]!;
      const y = r.range(8, 19);
      if (!this.blocked(x, y, 2.4)) this.shelves.push({ x, y, hw: 0.85, hh: 2.0, kind: 4 });
    }
  }

  /** Outside the camp gate: sandbag walls, tents and army trucks, the generator by the gate. */
  private buildGates(): void {
    const { width: W, depth: D } = this.level;
    const r = this.rng;
    // Sandbag lines with gaps to run through.
    for (const y of [9, 19]) {
      const gap = r.range(4, W - 8);
      for (let x = 1; x < W - 1; x += 3.2) {
        if (x > gap && x < gap + 4.2) continue;
        this.shelves.push({ x: x + 1.4, y, hw: 1.4, hh: 0.45, kind: 6 });
      }
    }
    for (let i = 0; i < 4; i++) {
      const p = [r.range(3, W - 3), r.range(11, D - 4)] as const;
      if (!this.blocked(p[0], p[1], 2.2)) this.shelves.push({ x: p[0], y: p[1], hw: 1.5, hh: 1.5, kind: 7 });
    }
    for (const x of [3.2, W - 3.2]) this.shelves.push({ x, y: r.range(23, D - 4), hw: 1.1, hh: 2.6, kind: 10 });
    // The generator by the gate.
    this.shelves.push({ x: W / 2 + 4, y: 3, hw: 1.2, hh: 0.8, kind: 11 });
  }

  private buildLayout(): void {
    this.shelves.length = 0;
    const L = this.level;
    if (L.layout === 'apartment') this.buildApartment();
    else if (L.layout === 'pump') this.buildPump();
    else if (L.layout === 'gates') this.buildGates();
    else this.buildMall();
    this.placeThings();
  }

  /** Crates and zombies for any layout. */
  private placeThings(): void {
    const { depth: D } = this.level;
    const r = this.rng;
    // Crates: supplies toward the back, scrap and medkits around.
    this.crates.length = 0;
    const sup = this.level.supplies;
    const want = Math.max(this.level.crates, sup.length);
    for (let i = 0; i < want; i++) {
      const supply = i < sup.length;
      const kind: LootKind = supply ? sup[i]! : r.chance(0.3) ? 'med' : 'scrap';
      const p = this.freeSpot(supply ? Math.min(18, D * 0.5) : 9, D - 1.5, 0.5);
      this.crates.push({ active: true, x: p[0], y: p[1], kind, amount: kind === 'scrap' ? r.int(3, 9) : 1, search: 0 });
    }

    // Zombies, kept away from the door.
    this.zombies.length = 0;
    let v = 0;
    for (const type of ['walker', 'runner', 'brute'] as ZombieType[]) {
      for (let i = 0; i < (this.level.zombies[type] ?? 0); i++) {
        const p = this.freeSpot(type === 'walker' ? 9 : 14, D - 1, ZOMBIES[type].radius);
        this.zombies.push({
          active: true, type, x: p[0], y: p[1], hp: ZOMBIES[type].hp, facing: -Math.PI / 2,
          lunge: 0, stagger: 0, down: 0, fall: 1, wanderA: r.range(0, Math.PI * 2), wanderT: r.range(0.5, 2), variant: v++,
        });
      }
    }
    // Reserve for waves: asleep until called in.
    for (let i = 0; i < (this.level.waves?.pool ?? 0); i++) {
      this.zombies.push({
        active: false, type: 'walker', x: 0, y: D, hp: 0, facing: -Math.PI / 2,
        lunge: 0, stagger: 0, down: 0, fall: 1, wanderA: 0, wanderT: 1, variant: v++,
      });
    }
    this.waveT = this.level.waves?.every ?? 0;
  }

  /** Calls in the next zombie of a wave at the far end. */
  private spawnWave(dt: number): void {
    const w = this.level.waves;
    if (!w) return;
    this.waveT -= dt;
    if (this.waveT > 0) return;
    this.waveT = w.every;
    const standing = this.zombies.filter((z) => z.active && z.down === 0).length;
    if (standing >= w.cap) return;
    const z = this.zombies.find((q) => !q.active);
    if (!z) return;
    const type: ZombieType = this.rng.chance(0.15) ? 'brute' : this.rng.chance(0.35) ? 'runner' : 'walker';
    const W = this.level.width;
    let x = this.rng.range(1, W - 1);
    for (let k = 0; k < 10 && this.blocked(x, this.level.depth - 0.8, ZOMBIES[type].radius); k++) x = this.rng.range(1, W - 1);
    Object.assign(z, {
      active: true, type, x, y: this.level.depth - 0.8, hp: ZOMBIES[type].hp, facing: -Math.PI / 2,
      lunge: 0, stagger: 0, down: 0, fall: 1, wanderT: 0.5,
    });
    // Called in by the noise: they head straight for Raj.
    z.wanderA = -Math.PI / 2;
  }

  /** A random point on open floor between y0 and y1. */
  private freeSpot(y0: number, y1: number, rad: number): [number, number] {
    const W = this.level.width;
    for (let k = 0; k < 60; k++) {
      const x = this.rng.range(1, W - 1);
      const y = this.rng.range(y0, y1);
      if (this.blocked(x, y, rad + 0.25)) continue;
      if (this.crates.some((c) => Math.hypot(c.x - x, c.y - y) < 1.4)) continue;
      return [x, y];
    }
    return [W / 2, (y0 + y1) / 2];
  }

  /** True when a circle at (x, y) overlaps a shelf. */
  blocked(x: number, y: number, rad: number): boolean {
    for (const s of this.shelves) {
      if (Math.abs(x - s.x) < s.hw + rad && Math.abs(y - s.y) < s.hh + rad) return true;
    }
    return false;
  }

  /** Moves a circle by (dx, dy), sliding along shelves and walls. */
  private slide(p: { x: number; y: number }, dx: number, dy: number, rad: number): void {
    const W = this.level.width;
    const D = this.level.depth;
    let nx = Math.max(rad, Math.min(W - rad, p.x + dx));
    if (this.blocked(nx, p.y, rad)) nx = p.x;
    let ny = Math.max(rad, Math.min(D - rad, p.y + dy));
    if (this.blocked(nx, ny, rad)) ny = p.y;
    p.x = nx;
    p.y = ny;
  }

  /** mx, my: stick direction (-1..1, forward is +y). attack: swing this step. */
  update(dt: number, mx: number, my: number, attack: boolean): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.swingK = Math.max(0, this.swingK - dt * 3.2);
    for (const z of this.zombies) if (z.active && z.down > 0) {
      z.down += dt;
      if (z.down > 2.4) z.active = false;
    }
    if (!this.alive || this.escaped) return;
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.swingCd = Math.max(0, this.swingCd - dt);

    // Walk.
    const len = Math.hypot(mx, my);
    this.moving = len > 0.15;
    if (this.moving) {
      const k = Math.min(1, len);
      const ux = mx / len;
      const uy = my / len;
      this.facing = Math.atan2(uy, ux);
      // Slower while swinging.
      const sp = PLAYER_SPEED * k * (this.swingK > 0.5 ? 0.55 : 1);
      this.slide(this, ux * sp * dt, uy * sp * dt, PLAYER_R);
    }

    if (attack && this.swingCd <= 0) this.swing();

    this.spawnWave(dt);
    this.updateZombies(dt);
    this.updateCrates(dt);

    // Leaving through the door once the supplies are found.
    if (this.exitOpen && this.y < 1.4 && Math.abs(this.x - this.level.width / 2) < EXIT_HALF) {
      this.escaped = true;
      this.events.done = 'escaped';
    }
  }

  private swing(): void {
    const w = WEAPONS[this.weapon];
    this.swingCd = w.cooldown;
    this.swingK = 1;
    this.events.swing = true;
    // Turn toward the nearest zombie in reach, so taps on a phone still connect.
    let best: Zombie | null = null;
    let bestD = w.reach + 0.8;
    for (const z of this.zombies) {
      if (!z.active || z.down > 0) continue;
      const d = Math.hypot(z.x - this.x, z.y - this.y) - ZOMBIES[z.type].radius;
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    if (best) this.facing = Math.atan2(best.y - this.y, best.x - this.x);
    for (const z of this.zombies) {
      if (!z.active || z.down > 0) continue;
      const def = ZOMBIES[z.type];
      const dx = z.x - this.x;
      const dy = z.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d - def.radius > w.reach) continue;
      let da = Math.atan2(dy, dx) - this.facing;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > w.arc / 2 && d > def.radius + PLAYER_R + 0.1) continue;
      z.hp -= w.damage;
      z.lunge = 0;
      z.stagger = 0.4;
      const kx = d > 0.01 ? dx / d : Math.cos(this.facing);
      const ky = d > 0.01 ? dy / d : Math.sin(this.facing);
      this.slide(z, kx * def.knock, ky * def.knock, def.radius);
      this.events.hits++;
      this.events.hitX = z.x;
      this.events.hitY = z.y;
      if (z.hp <= 0) {
        z.down = 0.0001;
        z.fall = kx >= 0 ? 1 : -1;
        this.kills++;
        this.events.kills++;
      }
    }
  }

  private updateZombies(dt: number): void {
    for (const z of this.zombies) {
      if (!z.active || z.down > 0) continue;
      const def = ZOMBIES[z.type];
      const dx = this.x - z.x;
      const dy = this.y - z.y;
      const d = Math.hypot(dx, dy);
      if (z.stagger > 0) {
        z.stagger -= dt;
        continue;
      }
      const reach = def.radius + PLAYER_R + 0.35;
      if (z.lunge > 0) {
        z.lunge -= dt;
        if (z.lunge <= 0) {
          // The lunge lands only if Raj is still in reach.
          if (d < reach + 0.25 && this.invuln <= 0) this.hurt(def.damage);
        }
        continue;
      }
      if (d < reach) {
        z.lunge = def.windup;
        z.facing = Math.atan2(dy, dx);
        continue;
      }
      let vx: number;
      let vy: number;
      let sp = def.speed;
      if (d < def.sight) {
        vx = dx / d;
        vy = dy / d;
        z.facing = Math.atan2(vy, vx);
      } else {
        z.wanderT -= dt;
        if (z.wanderT <= 0) {
          z.wanderA = this.rng.range(0, Math.PI * 2);
          z.wanderT = this.rng.range(1, 3);
        }
        vx = Math.cos(z.wanderA);
        vy = Math.sin(z.wanderA);
        z.facing = z.wanderA;
        sp *= 0.35;
      }
      const ox = z.x;
      const oy = z.y;
      this.slide(z, vx * sp * dt, vy * sp * dt, def.radius);
      // Stuck on a shelf corner: try sidestepping.
      if (Math.abs(z.x - ox) + Math.abs(z.y - oy) < sp * dt * 0.2) {
        const side = z.variant % 2 ? 1 : -1;
        this.slide(z, -vy * side * sp * dt, vx * side * sp * dt, def.radius);
      }
    }
    // Keep zombies from stacking on each other.
    for (let i = 0; i < this.zombies.length; i++) {
      const a = this.zombies[i]!;
      if (!a.active || a.down > 0) continue;
      for (let j = i + 1; j < this.zombies.length; j++) {
        const b = this.zombies[j]!;
        if (!b.active || b.down > 0) continue;
        const min = ZOMBIES[a.type].radius + ZOMBIES[b.type].radius;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2;
          this.slide(a, (-dx / d) * push, (-dy / d) * push, ZOMBIES[a.type].radius);
          this.slide(b, (dx / d) * push, (dy / d) * push, ZOMBIES[b.type].radius);
        }
      }
    }
  }

  private hurt(damage: number): void {
    this.hp -= damage;
    this.invuln = HURT_INVULN;
    this.events.hurt = true;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.events.done = 'down';
    }
  }

  private updateCrates(dt: number): void {
    for (const c of this.crates) {
      if (!c.active) continue;
      const near = Math.hypot(c.x - this.x, c.y - this.y) < 1.15;
      c.search = near ? c.search + dt / SEARCH_TIME : Math.max(0, c.search - dt);
      if (c.search < 1) continue;
      c.active = false;
      const e = this.events;
      e.loot = c.kind;
      e.lootAmount = c.amount;
      e.lootX = c.x;
      e.lootY = c.y;
      if (c.kind === 'scrap') this.scrap += c.amount;
      else if (c.kind === 'med') this.hp = Math.min(MAX_HP, this.hp + 35);
      else this.found++;
    }
  }
}
