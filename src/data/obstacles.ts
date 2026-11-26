export const ObstacleKind = {
  SmallPothole: 0,
  LargePothole: 1,
  /** Muddy water hiding a pothole: looks harmless, still dents. */
  Puddle: 2,
  Cow: 3,
  Handcart: 4,
  /** Painted bump across the whole road: no dent, but it slows you down. */
  SpeedBreaker: 5,
  Barricade: 6,
  /** Motorbike riding the wrong way, toward you. */
  Biker: 7,
  Bus: 8,
  Taxi: 9,
  DeliveryBike: 10,
  /** Parked or stuck car (traffic jams). */
  StoppedCar: 11,
  /** Manhole breathing steam (New York). */
  SteamVent: 12,
  /** Double-parked delivery truck. */
  DeliveryTruck: 13,
  /** Pedestrian standing in the road. */
  Jaywalker: 14,
  YellowCab: 15,
  Cyclist: 16,
  DoubleDecker: 17,
  /** Cones and a barrier around a dug-up patch (London). */
  Roadworks: 18,
  BlackCab: 19,
} as const;
export type ObstacleKind = (typeof ObstacleKind)[keyof typeof ObstacleKind];

export interface ObstacleDef {
  /** Size in metres (across, along the road). Hitboxes are a fraction of this. */
  w: number;
  h: number;
  /** Number of drawn variants (shapes or colours). */
  variants: number;
  /** 'dent' costs a dent; 'slow' only slows you. */
  effect: 'dent' | 'slow';
  /**
   * Movement as a fraction of the player's current speed. Positive moves the same way as the
   * player (slower traffic), negative comes toward the player, 0 stays put.
   */
  motion: number;
  /** How it is placed: in one lane, between two lanes, or across the road. */
  place: 'lane' | 'span' | 'full';
}

export const OBSTACLES: Record<ObstacleKind, ObstacleDef> = {
  [ObstacleKind.SmallPothole]: { w: 1.4, h: 1.05, variants: 8, effect: 'dent', motion: 0, place: 'lane' },
  // Large potholes sit across a lane line and catch both lanes.
  [ObstacleKind.LargePothole]: { w: 3.7, h: 1.7, variants: 5, effect: 'dent', motion: 0, place: 'span' },
  [ObstacleKind.Puddle]: { w: 2.1, h: 1.7, variants: 3, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.Cow]: { w: 1.3, h: 2.4, variants: 3, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.Handcart]: { w: 1.5, h: 2.2, variants: 3, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.SpeedBreaker]: { w: 99, h: 0.9, variants: 1, effect: 'slow', motion: 0, place: 'full' },
  [ObstacleKind.Barricade]: { w: 2.3, h: 0.7, variants: 2, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.Biker]: { w: 0.9, h: 2.0, variants: 4, effect: 'dent', motion: -0.5, place: 'lane' },
  [ObstacleKind.Bus]: { w: 2.5, h: 9, variants: 2, effect: 'dent', motion: 0.45, place: 'lane' },
  [ObstacleKind.Taxi]: { w: 1.8, h: 4.0, variants: 3, effect: 'dent', motion: 0.5, place: 'lane' },
  [ObstacleKind.DeliveryBike]: { w: 0.9, h: 1.9, variants: 3, effect: 'dent', motion: 0.55, place: 'lane' },
  [ObstacleKind.StoppedCar]: { w: 1.8, h: 4.0, variants: 5, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.SteamVent]: { w: 1.4, h: 1.4, variants: 2, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.DeliveryTruck]: { w: 2.3, h: 6.5, variants: 3, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.Jaywalker]: { w: 0.8, h: 0.8, variants: 4, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.YellowCab]: { w: 1.9, h: 4.6, variants: 2, effect: 'dent', motion: 0.5, place: 'lane' },
  [ObstacleKind.Cyclist]: { w: 0.8, h: 1.8, variants: 4, effect: 'dent', motion: 0.4, place: 'lane' },
  [ObstacleKind.DoubleDecker]: { w: 2.5, h: 10, variants: 1, effect: 'dent', motion: 0.42, place: 'lane' },
  [ObstacleKind.Roadworks]: { w: 2.4, h: 2.2, variants: 2, effect: 'dent', motion: 0, place: 'lane' },
  [ObstacleKind.BlackCab]: { w: 1.8, h: 4.4, variants: 1, effect: 'dent', motion: 0.5, place: 'lane' },
};

/** Potholes and puddles: the hazards that tougher vehicles can shrug off. */
export const POTHOLE_KINDS: ReadonlySet<ObstacleKind> = new Set([ObstacleKind.SmallPothole, ObstacleKind.LargePothole, ObstacleKind.Puddle]);

export const ALL_KINDS = Object.values(ObstacleKind) as ObstacleKind[];

/**
 * Which obstacles a map uses. Rows are potholes most of the time; with `specialRate`
 * a row uses one of the map's special kinds instead, picked by weight.
 */
export interface ObstacleMix {
  /** Chance that a small pothole is drawn as a muddy puddle instead (same hazard). */
  puddleRate: number;
  specialRate: number;
  specials: Partial<Record<ObstacleKind, number>>;
}

/** Plain potholes only, like the original game. */
export const POTHOLES_ONLY: ObstacleMix = { puddleRate: 0, specialRate: 0, specials: {} };
