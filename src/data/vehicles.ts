export interface VehicleDef {
  id: string;
  name: string;
  /** Size in metres. */
  width: number;
  length: number;
  dents: number;
  /** Seconds to move one lane. */
  laneChangeTime: number;
}

export const VEHICLES: Record<'auto', VehicleDef> = {
  auto: {
    id: 'auto',
    name: 'Auto-rickshaw',
    width: 1.35,
    length: 2.5,
    dents: 3,
    laneChangeTime: 0.15,
  },
};
