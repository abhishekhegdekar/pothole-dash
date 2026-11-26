import { ObstacleKind } from './obstacles';
import { MAPS, type MapDef } from './maps';
import type { RunRules } from '../systems/world';

/**
 * Story Mode test drive: Mumbai on the night of the siren. The full chapters (comic panels,
 * route map, on-foot sections) build on this road in later steps.
 */
export const STORY_ROAD: MapDef = {
  ...MAPS.mumbai,
  name: 'Mumbai',
  tagline: 'The night of the siren. Get out of the city.',
  conditions: 'Night · Sirens',
  mix: {
    puddleRate: 0.2,
    specialRate: 0.6,
    specials: {
      [ObstacleKind.Zombie]: 6,
      [ObstacleKind.Horde]: 2,
      [ObstacleKind.Wreck]: 3,
      [ObstacleKind.Barricade]: 1,
      [ObstacleKind.StoppedCar]: 1,
    },
  },
  style: {
    ...MAPS.mumbai.style,
    litRate: 0.12,
    taxis: false,
  },
  light: {
    ...MAPS.mumbai.light,
    exposure: 1.3,
    sky: '#24121a',
    hemiSky: '#d4a0ae',
    hemiGround: '#2a1e22',
    hemi: 1.35,
    sun: '#ff9a7a',
    sunIntensity: 1.0,
  },
  weather: 'clear',
  fog: 0.75,
  music: 'zombie',
};

/** Rules for the test drive: a standard tank, the first ram bar and the first roof gun. */
export const STORY_TEST_RULES: RunRules = { fuel: true, ram: 1, gun: 1, tank: 1 };
