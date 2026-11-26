import { VEHICLES, type VehicleDef } from './vehicles';
import type { RunRules } from '../systems/world';

/** Tanvi's workshop: upgrades for Raj's SUV, three levels each. */
export type UpgradeId = 'engine' | 'brakes' | 'tyres' | 'armour' | 'ram' | 'tank' | 'gun' | 'lights';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** What each level does, for the card. */
  levels: [string, string, string];
  /** Cost of levels 1..3: Free Run points and scrap found in Story Mode. */
  points: [number, number, number];
  scrap: [number, number, number];
}

const P: [number, number, number] = [1500, 4000, 9000];

export const UPGRADES: UpgradeDef[] = [
  { id: 'engine', name: 'Engine', levels: ['Top speed +5%', 'Top speed +10%', 'Top speed +16%'], points: P, scrap: [0, 20, 50] },
  { id: 'brakes', name: 'Brakes', levels: ['Brake harder', 'Brake harder still', 'Racing brakes'], points: [1000, 3000, 7000], scrap: [0, 15, 40] },
  { id: 'tyres', name: 'Tyres', levels: ['Lane change 10% quicker', '20% quicker', '30% quicker'], points: [1200, 3500, 8000], scrap: [0, 15, 40] },
  { id: 'armour', name: 'Armour', levels: ['+1 armour', '+2 armour', '+3 armour'], points: [2000, 5000, 11000], scrap: [5, 25, 60] },
  { id: 'ram', name: 'Ram bar', levels: ['Takes 8 zombies per armour', '12 zombies', '20 zombies'], points: [1500, 4000, 9000], scrap: [5, 20, 50] },
  { id: 'tank', name: 'Fuel tank', levels: ['Tank +25%', 'Tank +50%', 'Tank +80%'], points: [1200, 3500, 8000], scrap: [0, 20, 45] },
  { id: 'gun', name: 'Roof gun', levels: ['Fires every 2.4 s', 'Every 1.7 s', 'Every 1.1 s'], points: [2500, 6000, 12000], scrap: [10, 30, 70] },
  { id: 'lights', name: 'Spotlights', levels: ['Pick up scrap from further', 'Further still', 'Scrap and fuel from a lane away'], points: [800, 2500, 6000], scrap: [0, 10, 30] },
];

export const UPGRADE_IDS = UPGRADES.map((u) => u.id);

export type Levels = Partial<Record<string, number>>;

export const lvl = (u: Levels, id: UpgradeId): number => Math.max(0, Math.min(3, Math.floor(u[id] ?? 0)));

/** Raj's SUV with the upgrades applied. */
export function storyVehicle(u: Levels): VehicleDef {
  const base = VEHICLES.rig;
  return {
    ...base,
    speedMul: base.speedMul * [1, 1.05, 1.1, 1.16][lvl(u, 'engine')]!,
    laneChangeTime: base.laneChangeTime * [1, 0.9, 0.8, 0.7][lvl(u, 'tyres')]!,
    dents: base.dents + lvl(u, 'armour'),
  };
}

/** Story rules with the upgrades applied. The roof gun is fitted from the start (level 1). */
export function storyRules(u: Levels): RunRules {
  return {
    fuel: true,
    // The ram bar comes fitted (level 1 in the world's table); each upgrade adds one.
    ram: 1 + lvl(u, 'ram'),
    gun: Math.max(1, lvl(u, 'gun')),
    tank: [1, 1.25, 1.5, 1.8][lvl(u, 'tank')]!,
    brake: [1, 0.85, 0.72, 0.6][lvl(u, 'brakes')]!,
    magnet: [0, 0.6, 1.2, 2.2][lvl(u, 'lights')]!,
  };
}

/** Paint jobs for the SUV. */
export const PAINTS: Array<{ id: string; name: string; colour: string; price: number }> = [
  { id: 'olive', name: 'Olive', colour: '#5f6a4c', price: 0 },
  { id: 'white', name: 'Dust white', colour: '#d8d4c8', price: 0 },
  { id: 'black', name: 'Night black', colour: '#26282c', price: 500 },
  { id: 'red', name: 'Rescue red', colour: '#a8281f', price: 800 },
  { id: 'blue', name: 'Police blue', colour: '#2b4a8a', price: 800 },
  { id: 'camo', name: 'Desert sand', colour: '#b49a6a', price: 1200 },
];

export const paintColour = (id: string): string => PAINTS.find((p) => p.id === id)?.colour ?? PAINTS[0]!.colour;

/** The machete for on-foot sections. */
export const MACHETE = { points: 2000, scrap: 30 };
