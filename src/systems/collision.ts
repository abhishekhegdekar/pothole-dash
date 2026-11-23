import { BALANCE as B } from '../data/balance';
import { OBSTACLES, type ObstacleKind } from '../data/obstacles';

/** True when the 1D ranges [a - ah, a + ah] and [b - bh, b + bh] overlap. */
export function overlap1D(a: number, ah: number, b: number, bh: number): boolean {
  return Math.abs(a - b) < ah + bh;
}

/** Axis-aligned box test, boxes given as centre + half sizes. */
export function boxesOverlap(
  ax: number, ay: number, ahw: number, ahh: number,
  bx: number, by: number, bhw: number, bhh: number,
): boolean {
  return overlap1D(ax, ahw, bx, bhw) && overlap1D(ay, ahh, by, bhh);
}

export function laneCenter(lane: number): number {
  return (lane + 0.5) * B.laneWidth;
}

export function obstacleHalfW(kind: ObstacleKind): number {
  return (OBSTACLES[kind].w * B.hitboxScale) / 2;
}
export function obstacleHalfH(kind: ObstacleKind): number {
  return (OBSTACLES[kind].h * B.hitboxScale) / 2;
}

/** True when an obstacle at x blocks a player of this width centred in `lane`. */
export function blocksLane(kind: ObstacleKind, x: number, lane: number, playerWidth: number): boolean {
  return overlap1D(x, obstacleHalfW(kind), laneCenter(lane), (playerWidth * B.hitboxScale) / 2);
}
