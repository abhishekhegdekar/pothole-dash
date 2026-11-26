import { ObstacleKind, type ObstacleMix } from './obstacles';

/** How a city's streets look. Plain data, read by the 3D city builder. */
export interface CityStyle {
  walls: string[];
  roofTrim: string;
  window: string;
  windowLit: string;
  /** Share of windows with the lights on. */
  litRate: number;
  awnings: string[];
  footpath: string;
  ground: string;
  curbA: string;
  curbB: string;
  leaf: string[];
  trunk: string;
  minFloors: number;
  maxFloors: number;
  /** Extra building types mixed into the street. */
  towers: number;
  chawls: number;
  /** Left side of the road is a lake on some blocks (Thane). */
  lake: boolean;
  /** Big shady trees close to the road (Bangalore). */
  bigTrees: boolean;
  /** Flyover construction pillars by the road (Bangalore). */
  flyover: boolean;
  /** Hills in the distance. */
  hills: boolean;
  /** Parked black-and-yellow taxis on the roadside (Mumbai). */
  taxis: boolean;
  /** Which shop names to paint on signs. */
  signs: 'india' | 'ny' | 'london';
  /** Share of very tall glass and brick towers (New York). */
  skyscrapers: number;
  /** Share of brick terraced houses with chimneys (London). */
  terraces: number;
  /** Neon strips on shop fronts. */
  neon: boolean;
  /** Some blocks are a bridge over a river. */
  river: boolean;
  /** Paint the left lane as a red bus lane (London). */
  busLane: boolean;
  /** Fire hydrants, newspaper boxes, phone boxes: 'ny' or 'london' street furniture. */
  furniture: 'india' | 'ny' | 'london';
}

export interface Lighting {
  sky: string;
  /** Hemisphere light: sky and ground colours, intensity. */
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunIntensity: number;
  exposure: number;
  /** Street lamps glow, windows light up and the auto's headlight is on. */
  night: boolean;
}

export type Weather = 'clear' | 'rain' | 'drizzle' | 'snow';

export type MusicTheme = 'mumbai' | 'thane' | 'bangalore' | 'newyork' | 'london' | 'zombie';

export interface MapDef {
  id: MapId;
  name: string;
  tagline: string;
  /** Short line about time and weather, for the map card. */
  conditions: string;
  /** Coins to unlock; 0 = free. */
  price: number;
  laneCount: number;
  mix: ObstacleMix;
  style: CityStyle;
  light: Lighting;
  weather: Weather;
  /** Fog distance factor: 1 normal, lower is thicker. */
  fog: number;
  music: MusicTheme;
  /** Card colours for the map select screen. */
  card: [string, string];
}

export type MapId = 'mumbai' | 'thane' | 'bangalore' | 'newyork' | 'london';

const BASE_STYLE: CityStyle = {
  walls: ['#e7b7a3', '#9fd3c7', '#f1cf7a', '#c9b9e3', '#b7d48f', '#efe3c8', '#e8946a', '#a6c4e6', '#f3f0ea'],
  roofTrim: '#5d5a57',
  window: '#2d3a4a',
  windowLit: '#ffd98a',
  litRate: 0.25,
  awnings: ['#d8432f', '#1f8a4f', '#2e6fb7', '#f0a020', '#8b3fa8'],
  footpath: '#c9b596',
  ground: '#a99273',
  curbA: '#f4c20d',
  curbB: '#1c1c1f',
  leaf: ['#3f7d3a', '#4f9444', '#2f6b34'],
  trunk: '#6b4a2f',
  minFloors: 2,
  maxFloors: 7,
  towers: 0,
  chawls: 0,
  lake: false,
  bigTrees: false,
  flyover: false,
  hills: false,
  taxis: false,
  signs: 'india',
  skyscrapers: 0,
  terraces: 0,
  neon: false,
  river: false,
  busLane: false,
  furniture: 'india',
};

export const MAPS = {
  mumbai: {
    id: 'mumbai',
    name: 'Mumbai',
    tagline: 'Monsoon night. Puddles hide the worst holes.',
    conditions: 'Night · Monsoon rain',
    price: 0,
    laneCount: 3,
    mix: {
      puddleRate: 0.35,
      specialRate: 0.3,
      specials: { [ObstacleKind.Biker]: 3, [ObstacleKind.Bus]: 2, [ObstacleKind.Taxi]: 3, [ObstacleKind.Handcart]: 1 },
    },
    style: {
      ...BASE_STYLE,
      walls: ['#d9a48f', '#88bfb3', '#dcb862', '#b3a3cf', '#a3c07b', '#dccfb2', '#d48256', '#93b0d2', '#e3dfd6'],
      litRate: 0.55,
      footpath: '#8f8476',
      ground: '#6f6253',
      maxFloors: 8,
      towers: 0.12,
      taxis: true,
    },
    light: {
      sky: '#1b2236',
      hemiSky: '#8ea2d6',
      hemiGround: '#2c2a30',
      hemi: 1.15,
      sun: '#a9bcff',
      sunIntensity: 0.9,
      exposure: 1.15,
      night: true,
    },
    weather: 'rain',
    fog: 1,
    music: 'mumbai',
    card: ['#1b2236', '#3c4f86'],
  },
  thane: {
    id: 'thane',
    name: 'Thane',
    tagline: 'Lakeside roads, cows and speed breakers.',
    conditions: 'Dusk · Clear',
    price: 0,
    laneCount: 3,
    mix: {
      puddleRate: 0,
      specialRate: 0.32,
      specials: { [ObstacleKind.Cow]: 4, [ObstacleKind.SpeedBreaker]: 2, [ObstacleKind.Handcart]: 3 },
    },
    style: {
      ...BASE_STYLE,
      walls: ['#e9d7b8', '#cfc4a8', '#e3b98c', '#bcd2c0', '#f0e6d2', '#d8c0a0', '#c7d3dd'],
      litRate: 0.3,
      footpath: '#c3ad8b',
      ground: '#9b8a62',
      minFloors: 2,
      maxFloors: 5,
      towers: 0.25,
      chawls: 0.35,
      lake: true,
      hills: true,
    },
    light: {
      sky: '#f0b58a',
      hemiSky: '#ffd9b0',
      hemiGround: '#6a5240',
      hemi: 1.5,
      sun: '#ffb070',
      sunIntensity: 2.6,
      exposure: 1.05,
      night: false,
    },
    weather: 'clear',
    fog: 1,
    music: 'thane',
    card: ['#c86b3c', '#f0b58a'],
  },
  bangalore: {
    id: 'bangalore',
    name: 'Bangalore',
    tagline: 'Four lanes, tree cover and traffic that never ends.',
    conditions: 'Evening · Drizzle',
    price: 3000,
    laneCount: 4,
    mix: {
      puddleRate: 0.1,
      specialRate: 0.36,
      specials: { [ObstacleKind.StoppedCar]: 4, [ObstacleKind.Barricade]: 3, [ObstacleKind.DeliveryBike]: 3 },
    },
    style: {
      ...BASE_STYLE,
      walls: ['#eae6df', '#c9d6d9', '#d9cbb3', '#b9c8b0', '#e6d2c2', '#cfd8e6'],
      litRate: 0.45,
      footpath: '#a39d93',
      ground: '#6f7a58',
      leaf: ['#2f6e36', '#3d8241', '#25582c'],
      minFloors: 2,
      maxFloors: 6,
      towers: 0.3,
      bigTrees: true,
      flyover: true,
      curbA: '#e8e4da',
      curbB: '#2a2a2e',
    },
    light: {
      sky: '#7c6f9c',
      hemiSky: '#d6c8f0',
      hemiGround: '#4a4a3c',
      hemi: 1.35,
      sun: '#ffc6a0',
      sunIntensity: 1.6,
      exposure: 1.1,
      night: false,
    },
    weather: 'drizzle',
    fog: 0.9,
    music: 'bangalore',
    card: ['#4b3f6e', '#8f7fb8'],
  },
} as Record<MapId, MapDef>;

MAPS.newyork = {
  id: 'newyork',
  name: 'New York',
  tagline: 'Snow, neon and yellow cabs. Mind the steam.',
  conditions: 'Neon night · Snow',
  price: 6000,
  laneCount: 4,
  mix: {
    puddleRate: 0,
    specialRate: 0.38,
    specials: {
      [ObstacleKind.YellowCab]: 4,
      [ObstacleKind.SteamVent]: 3,
      [ObstacleKind.DeliveryTruck]: 2,
      [ObstacleKind.Jaywalker]: 2,
    },
  },
  style: {
    ...BASE_STYLE,
    walls: ['#8a4b3a', '#a65f45', '#6f6a66', '#b8a48c', '#5c4a42', '#9c8676'],
    windowLit: '#ffe0a0',
    litRate: 0.5,
    awnings: ['#1f4f3a', '#7a1f2b', '#202a44', '#3a3a3e'],
    footpath: '#9ea0a4',
    ground: '#7d7f84',
    curbA: '#b9bbbf',
    curbB: '#a4a6aa',
    leaf: ['#5a7a4a', '#4a6a3e'],
    minFloors: 4,
    maxFloors: 8,
    skyscrapers: 0.4,
    neon: true,
    signs: 'ny',
    furniture: 'ny',
  },
  light: {
    sky: '#151a33',
    hemiSky: '#9aa8e0',
    hemiGround: '#3a3440',
    hemi: 1.25,
    sun: '#b8c4ff',
    sunIntensity: 0.9,
    exposure: 1.15,
    night: true,
  },
  weather: 'snow',
  fog: 0.85,
  music: 'newyork',
  card: ['#151a33', '#b03a7a'],
};

MAPS.london = {
  id: 'london',
  name: 'London',
  tagline: 'Fog, drizzle, double-deckers and cyclists.',
  conditions: 'Grey morning · Fog and drizzle',
  price: 9000,
  laneCount: 3,
  mix: {
    puddleRate: 0.25,
    specialRate: 0.36,
    specials: {
      [ObstacleKind.DoubleDecker]: 3,
      [ObstacleKind.BlackCab]: 3,
      [ObstacleKind.Cyclist]: 3,
      [ObstacleKind.Roadworks]: 3,
    },
  },
  style: {
    ...BASE_STYLE,
    walls: ['#9a5a44', '#b06a4e', '#e9e2d2', '#d8cfbd', '#8c4f3e', '#f0ebe0'],
    window: '#334050',
    litRate: 0.2,
    awnings: ['#1f3d2e', '#2a2a6e', '#7a1f2b', '#2d2d33'],
    footpath: '#a7a7a2',
    ground: '#7f8a6a',
    curbA: '#c9c9c4',
    curbB: '#b4b4ae',
    leaf: ['#4f7a3e', '#3f6b34'],
    minFloors: 3,
    maxFloors: 4,
    terraces: 0.6,
    river: true,
    busLane: true,
    signs: 'london',
    furniture: 'london',
  },
  light: {
    sky: '#b9bec4',
    hemiSky: '#e4e8ee',
    hemiGround: '#5a5e58',
    hemi: 1.7,
    sun: '#f2efe6',
    sunIntensity: 1.2,
    exposure: 1.05,
    night: false,
  },
  weather: 'drizzle',
  fog: 0.55,
  music: 'london',
  card: ['#5b6470', '#c8281f'],
};

export const MAP_ORDER: MapId[] = ['mumbai', 'thane', 'bangalore', 'newyork', 'london'];

export function isMapId(x: unknown): x is MapId {
  return typeof x === 'string' && x in MAPS;
}
