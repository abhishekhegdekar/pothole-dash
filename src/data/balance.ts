/** Every tunable gameplay number lives here. Distances are metres, times are seconds. */
export const BALANCE = {
  laneCount: 3,
  laneWidth: 3,
  /** Metres of road visible ahead on a tall screen (sets the zoom). */
  visibleMeters: 24,
  /** Distance from the bottom edge of the screen to the player's centre. */
  playerOffset: 4.2,
  startLane: 1,

  startSpeed: 9,
  maxSpeed: 19,
  /** Time constant of the speed curve: ~63% of the way to max after this long. */
  speedTau: 50,

  /** Seconds between obstacle rows, at the start and at the hardest point. */
  rowIntervalStart: 1.15,
  rowIntervalMin: 0.62,
  rowIntervalTau: 55,
  /** Random forward/back offset of each obstacle within its row. */
  rowJitter: 0.6,
  /** Time the player needs to see and react before steering. */
  reactionTime: 0.3,

  doubleChanceStart: 0.15,
  doubleChanceMax: 0.6,
  largeChanceStart: 0.12,
  largeChanceMax: 0.4,
  /** Seconds of driving before the first row. */
  firstRowDelay: 1.6,

  /** Speed multiplier right after a hit, recovering back to 1. */
  hitSlowdown: 0.65,
  hitRecoverTime: 1.1,
  invulnTime: 1.0,
  /** Hitboxes are this fraction of the drawn size, so near-touches feel fair. */
  hitboxScale: 0.78,

  /** A pass this close (metres, edge to edge) without touching counts as a near miss. */
  nearMissGap: 0.6,
  /** Points per near miss, multiplied by the current combo. */
  nearMissPoints: 10,
  /** Seconds a combo stays alive without another near miss. */
  comboWindow: 3,
  /** Distance milestones that get a banner; after the last one, every `milestoneStep`. */
  milestones: [250, 500, 1000],
  milestoneStep: 500,
  /** How fast the auto skids to a stop after the final crash (m/s per second). */
  crashDecel: 16,

  /** Throttle: speed multipliers when accelerating or braking, and how fast they kick in (per second). */
  boostMul: 1.3,
  brakeMul: 0.5,
  throttleRate: 1.6,
  /** Extra points per metre while accelerating. */
  boostPoints: 0.5,

  /** Story Mode: a full tank lasts this many metres. */
  fuelRange: 1100,
  /** Fuel a can puts back, as a share of the tank. */
  fuelCan: 0.4,
  /** Chance that a safe gap gets a fuel can instead of a scrap trail. */
  fuelCanRate: 0.04,
  /** Zombies the bumper can take before it costs a dent, by ram bar level 0..3. Hordes count as 3. */
  ramHits: [3, 5, 8, 12],
  /** Seconds between roof gun shots, by gun level 1..3 (0 = no gun). */
  gunCooldown: [0, 2.4, 1.7, 1.1],
  /** How far ahead the roof gun reaches (metres). */
  gunRange: 30,
  /** Points for each zombie knocked down. */
  zombiePoints: 5,

  /** Particles, rows etc. are kept in fixed pools of this size. */
  obstaclePool: 48,
} as const;
