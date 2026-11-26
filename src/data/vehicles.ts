export type VehicleId = 'auto' | 'scooter' | 'bike' | 'hatch' | 'sportsbike' | 'suv' | 'cab';

export interface VehicleDef {
  id: VehicleId;
  name: string;
  /** Size in metres. */
  width: number;
  length: number;
  dents: number;
  /** Seconds to move one lane. */
  laneChangeTime: number;
  /** Top-speed factor on the shared speed curve. */
  speedMul: number;
  /** Ratings out of 5, for the garage card. */
  speedRating: number;
  handlingRating: number;
  /** Coins to buy; 0 = free. */
  price: number;
  /** One line about what makes it special. */
  perk: string;
  /** Coins picked up are worth this much. */
  coinMul: number;
  /** Near-miss points multiplier. */
  nearMissMul: number;
  /** Small potholes and puddles cost no dent. */
  shrugSmall: boolean;
  /** No pothole costs a dent. */
  shrugAll: boolean;
}

const base = {
  coinMul: 1,
  nearMissMul: 1,
  shrugSmall: false,
  shrugAll: false,
};

export const VEHICLES: Record<VehicleId, VehicleDef> = {
  auto: {
    ...base,
    id: 'auto', name: 'Auto-rickshaw', width: 1.35, length: 2.5, dents: 3, laneChangeTime: 0.15, speedMul: 1,
    speedRating: 2, handlingRating: 3, price: 0, perk: 'Sturdy starter. Knows every pothole in Mumbai.',
  },
  scooter: {
    ...base,
    id: 'scooter', name: 'Scooter', width: 0.75, length: 1.8, dents: 1, laneChangeTime: 0.11, speedMul: 1.06,
    speedRating: 3, handlingRating: 5, price: 500, perk: 'Fastest lane change. One knock and you are out.',
  },
  bike: {
    ...base,
    id: 'bike', name: 'Commuter bike', width: 0.8, length: 2.0, dents: 2, laneChangeTime: 0.13, speedMul: 1.12,
    speedRating: 4, handlingRating: 4, price: 1500, perk: 'Coins are worth 1.2×.', coinMul: 1.2,
  },
  hatch: {
    ...base,
    id: 'hatch', name: 'Hatchback', width: 1.7, length: 3.7, dents: 3, laneChangeTime: 0.15, speedMul: 1.12,
    speedRating: 4, handlingRating: 3, price: 4000, perk: 'Small potholes and puddles cost no dent.', shrugSmall: true,
  },
  sportsbike: {
    ...base,
    id: 'sportsbike', name: 'Sports bike', width: 0.8, length: 2.1, dents: 1, laneChangeTime: 0.1, speedMul: 1.2,
    speedRating: 5, handlingRating: 5, price: 8000, perk: 'Near misses score double.', nearMissMul: 2,
  },
  suv: {
    ...base,
    id: 'suv', name: 'SUV', width: 1.95, length: 4.5, dents: 4, laneChangeTime: 0.17, speedMul: 1.06,
    speedRating: 3, handlingRating: 2, price: 12000, perk: 'Rolls over every pothole without a dent.', shrugSmall: true, shrugAll: true,
  },
  cab: {
    ...base,
    id: 'cab', name: 'City cab', width: 1.75, length: 4.2, dents: 3, laneChangeTime: 0.13, speedMul: 1.12,
    speedRating: 4, handlingRating: 4, price: 15000, perk: 'Tips: +25% coins.', coinMul: 1.25,
  },
};

export const VEHICLE_ORDER: VehicleId[] = ['auto', 'scooter', 'bike', 'hatch', 'sportsbike', 'suv', 'cab'];

export function isVehicleId(x: unknown): x is VehicleId {
  return typeof x === 'string' && x in VEHICLES;
}
