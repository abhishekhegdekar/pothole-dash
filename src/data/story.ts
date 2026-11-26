import { ObstacleKind } from './obstacles';
import { MAPS, type MapDef } from './maps';
import type { RunRules } from '../systems/world';
import type { Lighting } from './maps';
import type { Theme, TimeOfDay } from './campaign';

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

const LIGHT: Record<TimeOfDay, Lighting> = {
  night: STORY_ROAD.light,
  dawn: { sky: '#d99a86', hemiSky: '#ffd8bc', hemiGround: '#4a3a30', hemi: 1.35, sun: '#ffb07a', sunIntensity: 1.7, exposure: 1.12, night: false },
  day: { sky: '#aebcc6', hemiSky: '#e6eef4', hemiGround: '#4f4a3e', hemi: 1.5, sun: '#fff1da', sunIntensity: 1.7, exposure: 1.05, night: false },
  dusk: { sky: '#6a4660', hemiSky: '#f0b0a0', hemiGround: '#3a2a30', hemi: 1.3, sun: '#ff8a5a', sunIntensity: 1.3, exposure: 1.2, night: true },
};

/** The road for one drive of the campaign: city streets, highway, ghat or coast, at a time of day. */
export function legRoad(theme: Theme, time: TimeOfDay, danger: number, name: string): MapDef {
  const d = Math.max(0, Math.min(1, danger));
  const city = theme === 'city';
  const base = city ? STORY_ROAD : MAPS.thane;
  const dark = time === 'night' || time === 'dusk';
  return {
    ...base,
    name,
    tagline: '',
    conditions: '',
    laneCount: 3,
    mix: {
      puddleRate: theme === 'ghat' ? 0.3 : 0.1,
      specialRate: 0.35 + d * 0.35,
      specials: {
        [ObstacleKind.Zombie]: 3 + d * 6,
        [ObstacleKind.Horde]: d * 3,
        [ObstacleKind.Wreck]: city ? 3 : 2,
        [ObstacleKind.StoppedCar]: city ? 1 : 0.5,
        [ObstacleKind.Barricade]: city ? 1 : 0.3,
        ...(theme === 'highway' ? { [ObstacleKind.Cow]: 0.6 } : {}),
      },
    },
    style: {
      ...base.style,
      terrain: theme,
      hills: theme !== 'city',
      lake: false,
      taxis: false,
      // litRate doubles as "it is dark" for the open-road builders: dhaba lights and house windows.
      litRate: dark ? (city ? 0.12 : 0.45) : 0.05,
      footpath: theme === 'ghat' ? '#7a6f5e' : theme === 'coast' ? '#b8a27a' : city ? base.style.footpath : '#a08a68',
      leaf: theme === 'ghat' ? ['#2f6b34', '#3f7d3a', '#37713a'] : base.style.leaf,
    },
    light: LIGHT[time],
    weather: theme === 'ghat' ? 'drizzle' : 'clear',
    fog: theme === 'ghat' ? 0.4 : dark ? 0.75 : 1,
    music: 'zombie',
  };
}
