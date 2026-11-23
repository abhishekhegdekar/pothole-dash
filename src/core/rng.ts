/** Seeded random numbers (mulberry32). The same seed always gives the same sequence. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  reset(seed: number): void {
    this.s = seed >>> 0;
  }
  /** Float in [0, 1). */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number {
    return min + Math.floor(this.next() * (maxExclusive - min));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
