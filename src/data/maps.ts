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

export type Weather = 'clear' | 'rain' | 'drizzle';

export type MusicTheme = 'mumbai' | 'thane' | 'bangalore';

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
  music: MusicTheme;
  /** Card colours for the map select screen. */
  card: [string, string];
}

export type MapId = 'mumbai' | 'thane' | 'bangalore';

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
};

export const MAPS: Record<MapId, MapDef> = {
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
    music: 'bangalore',
    card: ['#4b3f6e', '#8f7fb8'],
  },
};

export const MAP_ORDER: MapId[] = ['mumbai', 'thane', 'bangalore'];

export function isMapId(x: unknown): x is MapId {
  return typeof x === 'string' && x in MAPS;
}
