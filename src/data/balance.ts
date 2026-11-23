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

  /** Particles, rows etc. are kept in fixed pools of this size. */
  obstaclePool: 48,
} as const;
