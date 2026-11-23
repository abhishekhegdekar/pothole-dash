export const ObstacleKind = { SmallPothole: 0, LargePothole: 1 } as const;
export type ObstacleKind = (typeof ObstacleKind)[keyof typeof ObstacleKind];

export interface ObstacleDef {
  /** Drawn width and length in metres. */
  w: number;
  h: number;
  /** Number of drawn variants (shapes) to pre-render. */
  variants: number;
}

export const OBSTACLES: Record<ObstacleKind, ObstacleDef> = {
  [ObstacleKind.SmallPothole]: { w: 1.7, h: 1.2, variants: 6 },
  // Large potholes cover about a lane and a half.
  [ObstacleKind.LargePothole]: { w: 4.4, h: 1.8, variants: 4 },
};
