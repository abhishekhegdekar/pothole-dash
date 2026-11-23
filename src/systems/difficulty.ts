import { BALANCE as B } from '../data/balance';

const ease = (t: number, tau: number): number => 1 - Math.exp(-t / tau);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export function speedAt(t: number): number {
  return lerp(B.startSpeed, B.maxSpeed, ease(t, B.speedTau));
}
export function rowIntervalAt(t: number): number {
  return lerp(B.rowIntervalStart, B.rowIntervalMin, ease(t, B.rowIntervalTau));
}
export function doubleChanceAt(t: number): number {
  return lerp(B.doubleChanceStart, B.doubleChanceMax, ease(t, 60));
}
export function largeChanceAt(t: number): number {
  return lerp(B.largeChanceStart, B.largeChanceMax, ease(t, 70));
}
