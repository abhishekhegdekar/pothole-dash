import type { FootLevel } from '../systems/foot';

/**
 * The Story campaign: the siren night in Mumbai, the choice of survival camp, and the road
 * to it. A route is a list of nodes played in order: comic scenes, drives, on-foot stops and
 * Tanvi's garage. Places are real; the camps are made up.
 */

export type CampId = 'north' | 'south' | 'coast';
export type Speaker = 'narrator' | 'raj' | 'tanvi' | 'lara' | 'kavita' | 'alert' | 'sheru' | 'survivor';
export type SceneBg = 'night' | 'building' | 'garage' | 'radio' | 'toll' | 'road' | 'ghat' | 'pump' | 'camp' | 'dawn';
export type Theme = 'city' | 'highway' | 'ghat' | 'coast';
export type TimeOfDay = 'night' | 'dawn' | 'day' | 'dusk';

export interface Line {
  who: Speaker;
  text: string;
  /** Name shown for a survivor. */
  name?: string;
}

export interface ChoiceOption {
  label: string;
  /** What is said after the pick. */
  reply: Line[];
  /** Takes the survivor along: they help at the gates. */
  helper?: boolean;
  /** Changes to the tank (0..1) and the scrap wallet. */
  fuel?: number;
  scrap?: number;
  /** Counts as a kindness for the ending. */
  kind?: boolean;
}

export interface Scene {
  bg: SceneBg;
  lines: Line[];
  choice?: { prompt: string; options: ChoiceOption[] };
}

/** Lon, lat. */
export type Place = [number, number];

interface NodeBase {
  /** Starts a new chapter: number and title. */
  chapter?: [number, string];
  /** Where this happens, shown on the route map. */
  place: string;
  at: Place;
}

export interface DriveNode extends NodeBase {
  kind: 'drive';
  km: number;
  theme: Theme;
  time: TimeOfDay;
  /** Zombie density 0..1. */
  danger: number;
}
export interface SceneNode extends NodeBase {
  kind: 'scene';
  scene: Scene;
}
export interface FootNode extends NodeBase {
  kind: 'foot';
  level: FootLevel;
  /** Objective shown before and during the level. */
  goal: string;
}
export interface GarageNode extends NodeBase {
  kind: 'garage';
}
export interface ChooseNode extends NodeBase {
  kind: 'choose';
}
export interface EndNode extends NodeBase {
  kind: 'end';
}
export type CampaignNode = DriveNode | SceneNode | FootNode | GarageNode | ChooseNode | EndNode;

export interface Camp {
  id: CampId;
  name: string;
  near: string;
  at: Place;
  /** Card blurb on the choice screen. */
  blurb: string;
  traits: string;
  nodes: CampaignNode[];
}

const MUMBAI: Place = [72.87, 19.04];

// On-foot levels.
export const APARTMENT: FootLevel = {
  layout: 'apartment', width: 22, depth: 32, goal: 2, supplies: ['keys', 'tools'], zombies: { walker: 7, runner: 1 }, crates: 6,
};
export const PUMP: FootLevel = {
  layout: 'pump', width: 26, depth: 30, goal: 3, supplies: ['fuel', 'fuel', 'fuel', 'fuel'], zombies: { walker: 8, runner: 3 }, crates: 8,
};
export const MALL: FootLevel = {
  layout: 'mall', width: 24, depth: 34, goal: 2, supplies: ['inhaler', 'fuel', 'fuel'], zombies: { walker: 10, runner: 3, brute: 1 }, crates: 9,
};
export const GATES: FootLevel = {
  layout: 'gates', width: 28, depth: 32, goal: 3, supplies: ['part', 'part', 'part'], zombies: { walker: 8, runner: 4, brute: 2 }, crates: 7,
  waves: { every: 2.6, cap: 12, pool: 18 },
};

/** The gates finale gets easier for each survivor who came along and fights beside Raj. */
export function gatesLevel(helpers: number): FootLevel {
  const h = Math.min(3, helpers);
  return {
    ...GATES,
    zombies: { walker: 8 - h * 2, runner: 4 - h, brute: h >= 2 ? 1 : 2 },
    waves: { every: 2.6 + h * 0.9, cap: 12 - h * 3, pool: 18 - h * 4 },
  };
}

// Shared opening: the siren night.
const PROLOGUE: CampaignNode[] = [
  {
    kind: 'scene', chapter: [1, 'Siren Night'], place: 'Sion, Mumbai', at: MUMBAI,
    scene: {
      bg: 'night',
      lines: [
        { who: 'narrator', text: 'Mumbai, 2:47 in the morning. Raj drives a kaali-peeli taxi by day. Tonight he is asleep at home in Sion.' },
        { who: 'narrator', text: 'Then every phone in the building screams at once.' },
        { who: 'alert', text: 'EMERGENCY ALERT. Stay indoors. Do not go near anyone who is sick. Wait for instructions.' },
        { who: 'tanvi', text: 'Raj. Raj! Wake up. Listen to the sirens. That is not one ambulance.' },
        { who: 'lara', text: 'Papa, Desai aunty is banging on our door. She looks… wrong. She is not talking.' },
        { who: 'tanvi', text: 'The SUV keys are in the society office downstairs. My toolbox is in the parking. We are not leaving without them.' },
        { who: 'raj', text: 'Lara, keep your inhaler in your pocket. Both of you wait on the stairs. I will go down first.' },
      ],
    },
  },
  {
    kind: 'foot', place: 'Sion, Mumbai', at: MUMBAI, level: APARTMENT,
    goal: 'Find the SUV keys and Tanvi’s toolbox, then get back to the stairs.',
  },
  {
    kind: 'scene', place: 'Sion, Mumbai', at: MUMBAI,
    scene: {
      bg: 'garage',
      lines: [
        { who: 'tanvi', text: 'Keys. Toolbox. Good. Lara, in the back seat. Belt on.' },
        { who: 'narrator', text: 'The old SUV coughs once, then roars. Tanvi has kept it running for ten years.' },
        { who: 'kavita', text: '…this is Major Kavita, Sahyadri Command, on all frequencies. Mumbai cannot be held. Get out of the city.' },
        { who: 'kavita', text: 'Three survivor camps are holding. Choose one and drive. The camp gates close in 72 hours.' },
        { who: 'raj', text: 'Seventy-two hours. Tanvi, where do we go?' },
        { who: 'tanvi', text: 'You know every road out of this city, Raj. You choose.' },
      ],
    },
  },
  { kind: 'choose', place: 'Sion, Mumbai', at: MUMBAI },
];

const sheru = (place: string, at: Place, toll: string): CampaignNode => ({
  kind: 'scene', chapter: [2, 'The Road Out'], place, at,
  scene: {
    bg: 'toll',
    lines: [
      { who: 'narrator', text: `${toll} toll plaza. The booths are empty and the barriers are up.` },
      { who: 'lara', text: 'Papa, stop! There is a puppy under the booth. He is all alone.' },
      { who: 'sheru', text: 'Woof!' },
      { who: 'raj', text: '…Fine. But he sits with you, and he does not chew my seats.' },
      { who: 'lara', text: 'His name is Sheru. Little lion.' },
    ],
  },
});

const inhalerScene = (place: string, at: Place): CampaignNode => ({
  kind: 'scene', place, at,
  scene: {
    bg: 'ghat',
    lines: [
      { who: 'narrator', text: 'At the top of the ghat, the fog lifts for a moment. Lara is coughing.' },
      { who: 'lara', text: 'Papa… only one puff left in my inhaler.' },
      { who: 'raj', text: 'We will find more at the next town. I promise.' },
      { who: 'tanvi', text: 'And the SUV needs work. I heard the engine knock on every bend.' },
    ],
  },
});

const garageScene = (place: string, at: Place): CampaignNode => ({
  kind: 'scene', place, at,
  scene: {
    bg: 'garage',
    lines: [
      { who: 'tanvi', text: `A closed garage in ${place}, with a full tool wall. Give me an hour and all the scrap you found.` },
      { who: 'raj', text: 'Can you fit a bigger ram bar?' },
      { who: 'tanvi', text: 'I can fit anything, if you can pay for it.' },
    ],
  },
});

const silence = (place: string, at: Place): CampaignNode => ({
  kind: 'scene', chapter: [5, 'Radio Silence'], place, at,
  scene: {
    bg: 'radio',
    lines: [
      { who: 'raj', text: 'Major Kavita, come in. Major? This is Raj, the driver. Come in.' },
      { who: 'kavita', text: '…shhhhhhh…' },
      { who: 'tanvi', text: 'Nothing since this morning. Not even the recorded message.' },
      { who: 'lara', text: 'Is the camp still there?' },
      { who: 'raj', text: 'It is. It has to be. We drive through the night.' },
    ],
  },
});

const arrival = (camp: string, place: string, at: Place): CampaignNode => ({
  kind: 'scene', chapter: [6, 'The Gates'], place, at,
  scene: {
    bg: 'camp',
    lines: [
      { who: 'narrator', text: `${camp}. The gate is shut. The floodlights are dark. Hundreds of them are pressed against the fence.` },
      { who: 'kavita', text: 'Raj…? I see your headlights from the tower. The generator is down. No power, no radio, no gate.' },
      { who: 'kavita', text: 'Three spare parts are in the supply crates in the yard. Bring them to the generator by the gate. Hurry.' },
      { who: 'tanvi', text: 'I will fit them. You keep them off me.' },
    ],
  },
});

const finale = (camp: string, place: string, at: Place): CampaignNode[] => [
  arrival(camp, place, at),
  { kind: 'foot', place, at, level: GATES, goal: 'Find three generator parts in the yard and bring them to the gate.' },
  { kind: 'end', place, at },
];

/** A survivor met on the road, with the three usual answers. */
function survivor(chapter: [number, string] | undefined, place: string, at: Place, bg: SceneBg, name: string, lines: string[], take: string, give: string, leave: string): CampaignNode {
  return {
    kind: 'scene', chapter, place, at,
    scene: {
      bg,
      lines: lines.map((text, i) => (i % 2 === 0 ? { who: 'survivor', name, text } : { who: 'raj', text })),
      choice: {
        prompt: `What do you do about ${name}?`,
        options: [
          { label: 'Take them with us', helper: true, kind: true, fuel: -0.12, reply: [{ who: 'tanvi', text: take }] },
          { label: 'Give them 15 scrap', scrap: -15, kind: true, reply: [{ who: 'survivor', name, text: give }] },
          { label: 'Drive on', reply: [{ who: 'lara', text: leave }] },
        ],
      },
    },
  };
}

export const CAMPS: Record<CampId, Camp> = {
  north: {
    id: 'north',
    name: 'Camp Tapi',
    near: 'near Jalgaon',
    at: [75.56, 21.0],
    blurb: 'North-east over Kasara Ghat and through Nashik, to an army camp on the Tapi river.',
    traits: 'Shortest road · Most zombies',
    nodes: [
      { kind: 'drive', place: 'Sion to Thane', at: [72.97, 19.2], km: 28, theme: 'city', time: 'night', danger: 0.7 },
      sheru('Thane', [72.97, 19.2], 'Anand Nagar'),
      survivor(undefined, 'Bhiwandi', [73.06, 19.3], 'road', 'Anwar', [
        'Bhai! Stop! My truck tyre is gone and they are coming out of the godowns!',
        'How many of you?',
        'Just me. I have driven this highway for twenty years. I know every short cut to Nashik.',
      ], 'Squeeze in, Anwar. Mind the dog.', 'Shukriya. I can fix the tyre with this. Go, go!', 'Papa… he is still waving at us.'),
      { kind: 'drive', place: 'Bhiwandi to Shahapur', at: [73.33, 19.45], km: 45, theme: 'highway', time: 'dawn', danger: 0.45 },
      { kind: 'foot', place: 'Shahapur fuel pump', at: [73.33, 19.45], level: PUMP, goal: 'The pumps have no power. Find three fuel cans in the station.' },
      {
        kind: 'scene', chapter: [3, 'Kasara Ghat'], place: 'Kasara', at: [73.48, 19.64],
        scene: {
          bg: 'radio',
          lines: [
            { who: 'kavita', text: 'Driver, Kasara Ghat is under fog and the railings are down in places. Go slow on the bends.' },
            { who: 'tanvi', text: 'Fog is good. They cannot see us either.' },
          ],
        },
      },
      { kind: 'drive', place: 'Kasara Ghat', at: [73.56, 19.7], km: 32, theme: 'ghat', time: 'day', danger: 0.5 },
      inhalerScene('Igatpuri', [73.56, 19.7]),
      garageScene('Nashik', [73.79, 20.0]),
      { kind: 'garage', place: 'Nashik', at: [73.79, 20.0] },
      { kind: 'drive', chapter: [4, 'Supplies'], place: 'Nashik to Malegaon', at: [74.53, 20.55], km: 85, theme: 'highway', time: 'day', danger: 0.6 },
      { kind: 'foot', place: 'Malegaon supermarket', at: [74.53, 20.55], level: MALL, goal: 'Find Lara’s inhaler and a fuel can, then get out.' },
      survivor(undefined, 'Malegaon', [74.53, 20.55], 'road', 'Dr Meera', [
        'Please! I am a doctor. My two nursing students are with me. We ran out of fuel.',
        'Where are you headed?',
        'Camp Tapi. They will need doctors there more than anywhere.',
      ], 'A doctor. Lara, you sit on my lap. Everyone in.', 'Thank you. We will walk to the next town and find a car.', 'Mumma, what if Lara needs a doctor?'),
      { kind: 'drive', place: 'Malegaon to Dhule', at: [74.77, 20.9], km: 90, theme: 'highway', time: 'dusk', danger: 0.65 },
      silence('Dhule', [74.77, 20.9]),
      { kind: 'drive', place: 'Dhule to Jalgaon', at: [75.56, 21.0], km: 140, theme: 'highway', time: 'night', danger: 0.85 },
      ...finale('Camp Tapi', 'Camp Tapi', [75.56, 21.0]),
    ],
  },
  south: {
    id: 'south',
    name: 'Camp Ghataprabha',
    near: 'near Belagavi',
    at: [74.5, 15.85],
    blurb: 'South-east up Bhor Ghat, past Pune and Satara, to a hill camp across the Karnataka border.',
    traits: 'Middle road · Balanced',
    nodes: [
      { kind: 'drive', place: 'Sion to Panvel', at: [73.11, 18.99], km: 40, theme: 'city', time: 'night', danger: 0.65 },
      sheru('Vashi', [73.0, 19.07], 'Vashi'),
      survivor(undefined, 'Panvel', [73.11, 18.99], 'road', 'Mr Pinto', [
        'Our car died on the flyover! My wife and son are inside. Please, sir!',
        'How far were you going?',
        'Anywhere but here. I was a mechanic in the Navy. I can help.',
      ], 'Another mechanic. Fine, but I am the boss of this SUV.', 'God bless you. We will try to start the car again.', 'Their boy was crying, Papa.'),
      { kind: 'drive', place: 'Panvel to Khalapur', at: [73.28, 18.83], km: 30, theme: 'highway', time: 'dawn', danger: 0.4 },
      { kind: 'foot', place: 'Khalapur fuel pump', at: [73.28, 18.83], level: PUMP, goal: 'The pumps have no power. Find three fuel cans in the station.' },
      {
        kind: 'scene', chapter: [3, 'Bhor Ghat'], place: 'Khopoli', at: [73.34, 18.79],
        scene: {
          bg: 'radio',
          lines: [
            { who: 'kavita', text: 'Driver, the expressway tunnels are blocked. Take the old Bhor Ghat road through Khandala. Heavy fog.' },
            { who: 'raj', text: 'The old ghat. My father drove trucks up here.' },
            { who: 'tanvi', text: 'Then drive like your father. Slowly.' },
          ],
        },
      },
      { kind: 'drive', place: 'Bhor Ghat, Khandala', at: [73.37, 18.76], km: 25, theme: 'ghat', time: 'day', danger: 0.45 },
      inhalerScene('Lonavala', [73.4, 18.75]),
      garageScene('Lonavala', [73.4, 18.75]),
      { kind: 'garage', place: 'Lonavala', at: [73.4, 18.75] },
      { kind: 'drive', chapter: [4, 'Supplies'], place: 'Lonavala to Pune', at: [73.86, 18.52], km: 65, theme: 'city', time: 'day', danger: 0.6 },
      { kind: 'foot', place: 'Pune supermarket', at: [73.86, 18.52], level: MALL, goal: 'Find Lara’s inhaler and a fuel can, then get out.' },
      survivor(undefined, 'Pune', [73.86, 18.52], 'road', 'Sergeant Bhosale', [
        'Civilian vehicle, halt! …Sorry. Habit. My unit is gone. I am the only one left.',
        'We are going to Camp Ghataprabha.',
        'I know it. I can get you past the army checkposts.',
      ], 'A soldier with a rifle. Yes. Get in.', 'Keep it. Go. I will hold this bridge for the next family.', 'Papa, he looked so tired.'),
      { kind: 'drive', place: 'Pune to Satara', at: [74.0, 17.68], km: 115, theme: 'highway', time: 'dusk', danger: 0.6 },
      silence('Satara', [74.0, 17.68]),
      { kind: 'drive', place: 'Satara to Belagavi', at: [74.5, 15.85], km: 225, theme: 'highway', time: 'night', danger: 0.85 },
      ...finale('Camp Ghataprabha', 'Camp Ghataprabha', [74.5, 15.85]),
    ],
  },
  coast: {
    id: 'coast',
    name: 'Naval Camp Kali',
    near: 'near Karwar',
    at: [74.12, 14.81],
    blurb: 'Down the Konkan coast, over Kashedi Ghat and past Goa, to a naval camp by the sea.',
    traits: 'Longest road · Fewer zombies · More fuel',
    nodes: [
      { kind: 'drive', place: 'Sion to Panvel', at: [73.11, 18.99], km: 40, theme: 'city', time: 'night', danger: 0.6 },
      sheru('Vashi', [73.0, 19.07], 'Vashi'),
      survivor(undefined, 'Pen', [73.09, 18.74], 'road', 'Ganpat the fisherman', [
        'Arre, wait! The boats are gone, the village is gone. Take an old man south?',
        'You know the coast?',
        'Every beach and every creek from here to Goa.',
      ], 'Sit in the front, Ganpat kaka. Show us the way.', 'This will get me a boat ride. Go safe, beta.', 'He gave Sheru a biscuit.'),
      { kind: 'drive', place: 'Pen to Mahad', at: [73.42, 18.08], km: 120, theme: 'highway', time: 'dawn', danger: 0.35 },
      { kind: 'foot', place: 'Mahad fuel pump', at: [73.42, 18.08], level: PUMP, goal: 'The pumps have no power. Find three fuel cans in the station.' },
      {
        kind: 'scene', chapter: [3, 'Kashedi Ghat'], place: 'Poladpur', at: [73.47, 17.98],
        scene: {
          bg: 'radio',
          lines: [
            { who: 'kavita', text: 'Driver, Kashedi Ghat is the only road south. It is narrow and the fog is thick. Do not stop.' },
            { who: 'lara', text: 'I can see the clouds below us!' },
          ],
        },
      },
      { kind: 'drive', place: 'Kashedi Ghat', at: [73.4, 17.85], km: 30, theme: 'ghat', time: 'day', danger: 0.4 },
      inhalerScene('Khed', [73.4, 17.72]),
      garageScene('Chiplun', [73.52, 17.53]),
      { kind: 'garage', place: 'Chiplun', at: [73.52, 17.53] },
      { kind: 'drive', chapter: [4, 'Supplies'], place: 'Chiplun to Ratnagiri', at: [73.3, 16.99], km: 90, theme: 'coast', time: 'day', danger: 0.45 },
      { kind: 'foot', place: 'Ratnagiri supermarket', at: [73.3, 16.99], level: MALL, goal: 'Find Lara’s inhaler and a fuel can, then get out.' },
      survivor(undefined, 'Ratnagiri', [73.3, 16.99], 'road', 'Sister Agnes', [
        'Please. I have three children from the school with me. We have been hiding in the church.',
        'There is not much room.',
        'They are small. They can sit on laps.',
      ], 'Then we make room. Children in the back.', 'Thank you, my son. We will wait for the next car.', 'Papa, they were so small…'),
      { kind: 'drive', place: 'Ratnagiri to Sawantwadi', at: [73.82, 15.9], km: 130, theme: 'coast', time: 'dusk', danger: 0.5 },
      silence('Sawantwadi', [73.82, 15.9]),
      { kind: 'drive', place: 'Sawantwadi to Karwar', at: [74.12, 14.81], km: 150, theme: 'coast', time: 'night', danger: 0.75 },
      ...finale('Naval Camp Kali', 'Naval Camp Kali', [74.12, 14.81]),
    ],
  },
};

export const CAMP_ORDER: CampId[] = ['north', 'south', 'coast'];

export function isCampId(x: unknown): x is CampId {
  return x === 'north' || x === 'south' || x === 'coast';
}

/** All nodes in play order: the shared opening, then the chosen camp's road. */
export function campaignNodes(camp: CampId | null): CampaignNode[] {
  return camp ? [...PROLOGUE, ...CAMPS[camp].nodes] : PROLOGUE;
}

export const PROLOGUE_LENGTH = PROLOGUE.length;

/** Game metres driven for a leg of `km` story kilometres. */
export function legMetres(km: number): number {
  return Math.round(Math.min(1800, Math.max(700, 500 + km * 7)));
}

/** Total road kilometres to the camp. */
export function routeKm(camp: CampId): number {
  return CAMPS[camp].nodes.reduce((s, n) => s + (n.kind === 'drive' ? n.km : 0), 0);
}

/** Kilometres already covered before node `index` (in campaignNodes order). */
export function kmDone(camp: CampId, index: number): number {
  const nodes = campaignNodes(camp);
  let km = 0;
  for (let i = 0; i < Math.min(index, nodes.length); i++) {
    const n = nodes[i]!;
    if (n.kind === 'drive') km += n.km;
  }
  return km;
}

/** The chapter a node belongs to: the last chapter header at or before it. */
export function chapterAt(camp: CampId | null, index: number): [number, string] {
  const nodes = campaignNodes(camp);
  let ch: [number, string] = [1, 'Siren Night'];
  for (let i = 0; i <= Math.min(index, nodes.length - 1); i++) if (nodes[i]!.chapter) ch = nodes[i]!.chapter!;
  return ch;
}

export interface Ending {
  title: string;
  lines: Line[];
}

/** Two endings: everyone gets in if Raj brought people along, otherwise the gate closes behind the family. */
export function ending(helpers: number, kindness: number, camp: CampId): Ending {
  const name = CAMPS[camp].name;
  if (helpers >= 2) {
    return {
      title: 'Ending: Everyone Gets In',
      lines: [
        { who: 'narrator', text: 'The floodlights burst on. The gate grinds open, and everyone who rode in the SUV runs through it together.' },
        { who: 'kavita', text: `Raj. You did not just save your family. You brought people who will keep ${name} alive.` },
        { who: 'tanvi', text: 'We made it. All of us.' },
        { who: 'lara', text: 'Sheru too!' },
        { who: 'kavita', text: 'There are more families out on that road. I need drivers who do not leave people behind. Interested?' },
        { who: 'raj', text: 'Give me a full tank and a map.' },
      ],
    };
  }
  return {
    title: 'Ending: The Gate Closes',
    lines: [
      { who: 'narrator', text: `The floodlights burst on. The gate opens just wide enough for the SUV, and slams shut behind it.` },
      { who: 'kavita', text: `Welcome to ${name}. You are safe now. All three of you.` },
      { who: 'lara', text: 'And Sheru.' },
      { who: 'raj', text: 'Safe…' },
      {
        who: 'narrator',
        text: kindness > 0
          ? 'That night Raj sits by the fence, thinking of the people he helped and the ones he could not bring. Maybe next time.'
          : 'That night Raj sits by the fence, looking at the dark road. He thinks of every car he did not stop for.',
      },
    ],
  };
}
