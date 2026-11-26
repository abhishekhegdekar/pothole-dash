/**
 * Adaptive music composed in code. Each theme is a set of layers (drone, pad, bass, drums, hats,
 * percussion, lead, lead double). The game sets a mood and an intensity; layers fade in and out
 * over about a second, so the music follows the action without ever cutting.
 */
import type { Sfx } from './sfx';

export type Mood = 'off' | 'menu' | 'run' | 'over';

type LayerName = 'drone' | 'pad' | 'bass' | 'drums' | 'hats' | 'perc' | 'lead' | 'lead2';
const LAYERS: LayerName[] = ['drone', 'pad', 'bass', 'drums', 'hats', 'perc', 'lead', 'lead2'];

interface Note {
  step: number;
  midi: number;
  len: number;
}

const NOTE_BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parses a note name such as "F#4" or "Bb3" to a MIDI number. */
export function midiOf(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NOTE_BASE[m[1]!]! + acc;
}

/**
 * Reads one bar per string, 16 tokens each: a note name starts a note, "-" holds it, "." is a rest.
 * Returns notes with absolute steps across all bars.
 */
export function parseBars(bars: string[]): Note[] {
  const out: Note[] = [];
  bars.forEach((bar, b) => {
    const tokens = bar.trim().split(/\s+/);
    if (tokens.length !== 16) throw new Error(`Bar ${b} has ${tokens.length} steps`);
    let cur: Note | null = null;
    tokens.forEach((tok, i) => {
      if (tok === '-') {
        if (cur) cur.len++;
        return;
      }
      cur = null;
      if (tok === '.') return;
      cur = { step: b * 16 + i, midi: midiOf(tok), len: 1 };
      out.push(cur);
    });
  });
  return out;
}

const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

interface Theme {
  bpm: number;
  bars: number;
  chords: number[][];
  bassRoots: number[];
  bassPattern: string;
  lead: Note[];
  /** Synth voice for the lead. */
  leadVoice: 'bansuri' | 'shehnai' | 'pluck';
  /** Semitones to shift the whole theme. */
  transpose?: number;
  drums: string;
  hats: string;
  perc: string;
  /** Tanpura plucks: four per bar. */
  drone: number[] | null;
  /** Layer levels for an intensity from 0 to 1. */
  levels(i: number): Record<LayerName, number>;
}

const ramp = (i: number, from: number, to: number): number => Math.min(1, Math.max(0, (i - from) / (to - from)));

/** Mumbai Free Run: dhol groove and a shehnai-style synth lead in D, Hijaz flavour. */
const RUN: Theme = {
  bpm: 116,
  bars: 8,
  chords: [
    [57, 62, 66], // D
    [58, 63, 67], // Eb
    [55, 60, 63], // Cm
    [57, 62, 66], // D
    [55, 58, 62], // Gm
    [58, 63, 67], // Eb
    [55, 60, 63], // Cm
    [57, 62, 66], // D
  ],
  bassRoots: ['D2', 'Eb2', 'C2', 'D2', 'G1', 'Eb2', 'C2', 'D2'].map(midiOf),
  bassPattern: 'R . . R . . R . R . . O . 5 . .',
  lead: parseBars([
    'A4 - - F#4 - G4 A4 - Bb4 - A4 - G4 - F#4 -',
    'G4 - - Eb4 - F#4 G4 - Bb4 - G4 - F#4 - Eb4 -',
    'C5 - Bb4 - A4 - G4 - Eb4 - G4 - C5 - - -',
    'D5 - - - C5 Bb4 A4 - G4 - F#4 - D4 - - -',
    'D5 - D5 - Bb4 - D5 - C5 - Bb4 - A4 - G4 -',
    'Bb4 - Bb4 - G4 - Bb4 - A4 - G4 - F#4 - Eb4 -',
    'G4 - A4 - Bb4 - C5 - D5 - Eb5 - D5 - C5 -',
    'D5 - - - - - - - A4 - F#4 - A4 - - -',
  ]),
  leadVoice: 'shehnai',
  drums: 'D . T D . T T . D . T D . T T .',
  hats: '. . x . . . x . . . x . . . x .',
  perc: 's s c s s s s s s s c s s s s s',
  drone: null,
  levels: (i) => ({
    drone: 0,
    pad: 0.55,
    bass: 0.85 + 0.15 * i,
    drums: 0.75 + 0.25 * i,
    hats: ramp(i, 0.15, 0.4),
    perc: ramp(i, 0.5, 0.8),
    lead: 0.8,
    lead2: ramp(i, 0.65, 0.95),
  }),
};

/** Menu: tanpura drone, soft pads and a bansuri flute over a gentle tabla. */
const MENU: Theme = {
  bpm: 84,
  bars: 8,
  chords: [
    [57, 62, 66],
    [57, 62, 66],
    [55, 60, 63],
    [58, 63, 67],
    [57, 62, 66],
    [55, 58, 62],
    [58, 63, 67],
    [57, 62, 66],
  ],
  bassRoots: ['D2', 'D2', 'C2', 'Eb2', 'D2', 'G1', 'Eb2', 'D2'].map(midiOf),
  bassPattern: 'R . . . . . . . R . . . . . . .',
  lead: parseBars([
    'A4 - - - - - - - F#4 - G4 - A4 - - -',
    '. . . . . . . . . . . . . . . .',
    'G4 - - - Eb4 - - - C4 - Eb4 - G4 - - -',
    'F#4 - - - - - - - . . . . . . . .',
    'D5 - - - C5 - Bb4 - A4 - - - - - - -',
    'Bb4 - - - A4 - G4 - . . . . . . . .',
    'G4 - A4 - Bb4 - - - A4 - G4 - F#4 - Eb4 -',
    'D4 - - - - - - - - - - - . . . .',
  ]),
  leadVoice: 'bansuri',
  drums: 'G . . n . . n . G . n . n . . .',
  hats: '. . . . . . . . . . . . . . . .',
  // (tabla is kept soft in the menu mix: see levels)
  perc: '. . . . . . . . . . . . . . . .',
  drone: ['A3', 'D4', 'D4', 'D3'].map(midiOf),
  levels: (i) => ({
    drone: 0.8,
    pad: 0.6,
    bass: 0.5,
    drums: 0.28 + 0.25 * i,
    hats: 0,
    perc: 0,
    lead: 0.75,
    lead2: 0,
  }),
};

/** Thane: same tune, gentler, up a tone, with bansuri and a lighter dhol. */
const THANE: Theme = {
  ...RUN,
  bpm: 104,
  transpose: 2,
  leadVoice: 'bansuri',
  drums: 'D . . T . . T . D . T . . T . .',
  perc: '. . . . s . . . . . . . s . . .',
  levels: (i) => ({ ...RUN.levels(i), drone: 0.35, perc: ramp(i, 0.3, 0.7), lead2: ramp(i, 0.5, 0.9) }),
  drone: ['A3', 'D4', 'D4', 'D3'].map(midiOf),
};

/** Bangalore: electronic, four on the floor, a plucked synth riff. */
const BANGALORE: Theme = {
  ...RUN,
  bpm: 124,
  transpose: -2,
  leadVoice: 'pluck',
  bassPattern: '. . R . . . R . . . R . . R O .',
  drums: 'K . . . K . . . K . . . K . . .',
  hats: '. . x . . . x . . . x . . . x .',
  perc: '. . . . c . . . . . . . c . s s',
  levels: (i) => ({
    drone: 0,
    pad: 0.6,
    bass: 1,
    drums: 0.85 + 0.15 * i,
    hats: 0.5 + 0.5 * ramp(i, 0.1, 0.4),
    perc: ramp(i, 0.35, 0.7),
    lead: 0.75,
    lead2: ramp(i, 0.6, 0.95),
  }),
};

/** New York: slow funk in E, snare backbeat, plucked clav-like riff. */
const NEWYORK: Theme = {
  bpm: 100,
  bars: 8,
  chords: [[55, 59, 64], [57, 61, 64], [55, 59, 64], [57, 61, 64], [55, 60, 64], [57, 62, 66], [55, 59, 64], [54, 59, 63]],
  bassRoots: ['E2', 'A1', 'E2', 'A1', 'C2', 'D2', 'E2', 'B1'].map(midiOf),
  bassPattern: 'R . . R . 5 . R O . R . . 5 R .',
  lead: parseBars([
    'E5 . G5 . A5 . G5 E5 . . D5 . E5 . . .',
    'C#5 . E5 . . A4 . B4 . C#5 . E5 . . . .',
    'E5 . G5 . A5 . B5 . A5 . G5 . E5 . D5 .',
    'E5 - - - . . . . . . B4 . D5 . E5 .',
    'G5 . G5 . E5 . G5 A5 . . G5 . E5 . . .',
    'E5 . . C#5 . E5 . . A4 . . . . . . .',
    'C5 . E5 . G5 . E5 . D5 . F#5 . A5 . F#5 .',
    'E5 - - - - - - - . . . . . . . .',
  ]),
  leadVoice: 'pluck',
  drums: 'K . . . S . . K . . K . S . . .',
  hats: 'x . x . x . x . x . x . x . x .',
  perc: '. s . s . s . s . s . s . s . s',
  drone: null,
  levels: (i) => ({ drone: 0, pad: 0.5, bass: 1, drums: 0.85 + 0.15 * i, hats: 0.4 + 0.4 * i, perc: ramp(i, 0.4, 0.8), lead: 0.8, lead2: ramp(i, 0.6, 0.95) }),
};

/** London: bright indie rock in D, driving eighths and a jangly riff. */
const LONDON: Theme = {
  bpm: 128,
  bars: 8,
  chords: [[57, 62, 66], [57, 61, 64], [59, 62, 66], [55, 59, 62], [57, 62, 66], [57, 61, 64], [59, 62, 66], [55, 59, 62]],
  bassRoots: ['D2', 'A1', 'B1', 'G1', 'D2', 'A1', 'B1', 'G1'].map(midiOf),
  bassPattern: 'R . R . R . R . R . R . R . R .',
  lead: parseBars([
    'D5 . A4 . F#5 . A4 . D5 . A4 . F#5 . A4 .',
    'C#5 . A4 . E5 . A4 . C#5 . A4 . E5 . A4 .',
    'B4 . F#4 . D5 . F#4 . B4 . F#4 . D5 . F#4 .',
    'B4 . G4 . D5 . G4 . B4 . G4 . D5 . E5 .',
    'F#5 - - - E5 - D5 - . . A4 - D5 - E5 -',
    'E5 - - - C#5 - A4 - . . . . . . . .',
    'D5 - - - F#5 - - - B4 - - - D5 - C#5 -',
    'B4 - - - - - - - D5 - E5 - F#5 - A5 -',
  ]),
  leadVoice: 'pluck',
  drums: 'K . . . S . . . K . K . S . . .',
  hats: 'x . x . x . x . x . x . x . x .',
  perc: '. . . . . . . . . . . . . . s s',
  drone: null,
  levels: (i) => ({ drone: 0, pad: 0.55, bass: 0.9, drums: 0.8 + 0.2 * i, hats: 0.5 + 0.4 * i, perc: ramp(i, 0.3, 0.7), lead: 0.8, lead2: ramp(i, 0.55, 0.9) }),
};

export type RunTheme = 'mumbai' | 'thane' | 'bangalore' | 'newyork' | 'london';
const RUN_THEMES: Record<RunTheme, Theme> = { mumbai: RUN, thane: THANE, bangalore: BANGALORE, newyork: NEWYORK, london: LONDON };

const LOOKAHEAD = 0.25;

export class Music {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private out: GainNode | null = null;
  private muffle: BiquadFilterNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private layers = new Map<LayerName, GainNode>();
  private targets = new Map<LayerName, number>();

  private mood: Mood = 'off';
  private theme: Theme | null = null;
  private pending: Theme | null = null;
  private switchAt = 0;
  private step = 0;
  private nextTime = 0;
  private intensity = 0;
  private lastLeadHz = 0;
  private muffled = false;
  private overTimer = 0;
  private runTheme: RunTheme = 'mumbai';
  /** Steps played since the theme started: the lead waits for the groove to settle in. */
  private played = 0;

  constructor(private readonly sfx: Sfx) {
    sfx.onReady(() => this.init());
  }

  private init(): void {
    const c = this.sfx.context;
    const dest = this.sfx.musicOut;
    if (!c || !dest) return;
    try {
      this.ctx = c;
      this.noise = this.sfx.noiseBuffer;
      this.muffle = c.createBiquadFilter();
      this.muffle.type = 'lowpass';
      this.muffle.frequency.value = 18000;
      this.muffle.connect(dest);
      this.out = c.createGain();
      this.out.gain.value = 0;
      this.out.connect(this.muffle);

      // Small room reverb from decaying noise, and a dotted-eighth echo for the lead.
      this.reverb = c.createConvolver();
      this.reverb.buffer = this.impulse(c, 2.2);
      const wet = c.createGain();
      wet.gain.value = 0.26;
      this.reverb.connect(wet).connect(this.out);
      this.delay = c.createDelay(1.5);
      const fb = c.createGain();
      fb.gain.value = 0.28;
      const dlFilter = c.createBiquadFilter();
      dlFilter.type = 'lowpass';
      dlFilter.frequency.value = 2600;
      this.delay.connect(dlFilter).connect(fb).connect(this.delay);
      const dlOut = c.createGain();
      dlOut.gain.value = 0.35;
      dlFilter.connect(dlOut).connect(this.out);
      dlOut.connect(this.reverb);

      for (const name of LAYERS) {
        const g = c.createGain();
        g.gain.value = 0;
        g.connect(this.out);
        const send = c.createGain();
        send.gain.value = name === 'lead' || name === 'pad' || name === 'drone' || name === 'lead2' ? 0.6 : 0.15;
        g.connect(send).connect(this.reverb);
        if (name === 'lead') g.connect(this.delay);
        this.layers.set(name, g);
        this.targets.set(name, -1);
      }
      const want = this.mood;
      this.mood = 'off';
      this.setMood(want);
    } catch {
      this.ctx = null;
    }
  }

  private impulse(c: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  /** Changes the music to fit the game state. Safe to call every frame. */
  setMood(mood: Mood, intensity = 0, runTheme: RunTheme = this.runTheme): void {
    this.intensity = Math.min(1, Math.max(0, intensity));
    const themeChanged = runTheme !== this.runTheme;
    this.runTheme = runTheme;
    if (mood === this.mood && !(mood === 'run' && themeChanged)) return;
    const prev = this.mood;
    this.mood = mood;
    const c = this.ctx;
    if (!c || !this.out) return;
    window.clearTimeout(this.overTimer);
    const t = c.currentTime;
    if (mood === 'off') {
      this.out.gain.setTargetAtTime(0, t, 0.3);
      return;
    }
    if (mood === 'over') {
      // Drop the band, play a falling phrase, then drift back to the calm theme.
      this.out.gain.setTargetAtTime(0, t, 0.08);
      this.stinger(t + 0.05);
      this.overTimer = window.setTimeout(() => {
        if (this.mood === 'over') this.switchTo(MENU, 0.6);
      }, 1900);
      return;
    }
    this.switchTo(mood === 'menu' ? MENU : RUN_THEMES[this.runTheme], prev === 'off' ? 0.05 : 0.45);
  }

  /** Muffles and lowers the music, for pause screens. */
  setMuffled(on: boolean): void {
    if (on === this.muffled || !this.ctx || !this.muffle) return;
    this.muffled = on;
    const t = this.ctx.currentTime;
    this.muffle.frequency.setTargetAtTime(on ? 600 : 18000, t, 0.25);
  }

  private switchTo(theme: Theme, fade: number): void {
    const c = this.ctx;
    if (!c || !this.out) return;
    const t = c.currentTime;
    if (this.theme === theme && this.pending === null) {
      this.out.gain.setTargetAtTime(1, t, 0.3);
      return;
    }
    this.out.gain.setTargetAtTime(0, t, fade / 3);
    this.pending = theme;
    this.switchAt = t + fade;
  }

  /** Schedules notes ahead of time. Call every frame. */
  update(): void {
    const c = this.ctx;
    if (!c || !this.out || this.mood === 'off' || c.state !== 'running') return;
    const now = c.currentTime;
    if (this.pending && now >= this.switchAt) {
      this.theme = this.pending;
      this.pending = null;
      this.step = 0;
      this.played = 0;
      this.nextTime = now + 0.06;
      for (const name of LAYERS) this.targets.set(name, -1);
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.setTargetAtTime(1, now, 0.35);
    }
    const th = this.theme;
    if (!th || this.pending) return;
    // Layer levels follow intensity with a soft fade.
    const lv = th.levels(this.mood === 'run' ? this.intensity : this.mood === 'over' ? 0 : this.intensity);
    for (const name of LAYERS) {
      const want = lv[name];
      if (Math.abs((this.targets.get(name) ?? -1) - want) > 0.02) {
        this.targets.set(name, want);
        this.layers.get(name)!.gain.setTargetAtTime(want, now, 0.45);
      }
    }
    // If the tab stalled, skip ahead instead of firing a burst of old notes.
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    const stepDur = 60 / th.bpm / 4;
    while (this.nextTime < now + LOOKAHEAD) {
      this.playStep(th, this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % (th.bars * 16);
      this.played++;
      this.nextTime += stepDur;
    }
  }

  private playStep(th: Theme, step: number, t: number, sd: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const tr = th.transpose ?? 0;
    const L = (n: LayerName): GainNode => this.layers.get(n)!;
    // Swing the off-sixteenths a little for a human feel.
    const tt = s % 2 === 1 ? t + sd * 0.12 : t;

    if (s === 0) this.pad(L('pad'), th.chords[bar]!.map((m) => m + tr), t, sd * 16);
    if (th.drone && s % 4 === 0) this.tanpura(L('drone'), th.drone[s / 4]! + tr, t);

    const b = th.bassPattern.split(' ')[s];
    if (b && b !== '.') {
      const root = th.bassRoots[bar]! + tr;
      const m = b === 'R' ? root : b === 'O' ? root + 12 : root + 7;
      this.bass(L('bass'), hz(m), tt, sd * (th.bpm < 100 ? 6 : 1.6));
    }

    const d = th.drums.split(' ')[s];
    if (d === 'D') this.dha(L('drums'), tt);
    else if (d === 'T') this.ta(L('drums'), tt, 0.8 + Math.random() * 0.25);
    else if (d === 'G') this.ge(L('drums'), tt);
    else if (d === 'n') this.na(L('drums'), tt);
    else if (d === 'K') this.kick(L('drums'), t);
    else if (d === 'S') this.snare(L('drums'), tt);

    if (th.hats.split(' ')[s] === 'x') this.hat(L('hats'), tt, 0.09);
    const p = th.perc.split(' ')[s];
    if (p === 's') this.hat(L('perc'), tt, 0.035, 0.22);
    else if (p === 'c') this.clap(L('perc'), tt);
    // A dhol roll into the next phrase at the end of every 4 bars.
    if ((th === RUN || th === THANE) && bar % 4 === 3 && s >= 12) this.ta(L('perc'), tt, 0.8);

    // Let the drums and bass play one bar on their own before the tune comes in.
    if (this.played < 16 && th !== MENU) return;
    for (const n of th.lead) {
      if (n.step !== step) continue;
      const dur = n.len * sd;
      const f = hz(n.midi + tr);
      if (th.leadVoice === 'shehnai') this.shehnai(L('lead'), f, t, dur);
      else if (th.leadVoice === 'pluck') {
        this.sitar(L('lead'), f, t, 0.16);
        this.sitar(L('lead'), f * 2, t + sd * 2, 0.06);
      } else this.bansuri(L('lead'), f, t, dur);
      this.sitar(L('lead2'), f * 2, t);
    }
  }

  // ---- Instruments ---------------------------------------------------------------------------

  private env(g: GainNode, t: number, peak: number, attack: number, hold: number, release: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  private osc(type: OscillatorType, f: number, t: number, stop: number, detune = 0): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.start(t);
    o.stop(stop);
    return o;
  }

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode | null {
    if (!this.noise) return null;
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 0.3);
    s.stop(t + dur);
    return s;
  }

  private pad(out: AudioNode, chord: number[], t: number, dur: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.linearRampToValueAtTime(1300, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(700, t + dur);
    f.connect(g).connect(out);
    this.env(g, t, 0.05, dur * 0.25, dur * 0.5, dur * 0.35);
    for (const m of chord) {
      for (const det of [-8, 8]) this.osc('sawtooth', hz(m), t, t + dur + 0.1, det).connect(f);
    }
  }

  private tanpura(out: AudioNode, m: number, t: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(hz(m) * 6, t);
    f.frequency.exponentialRampToValueAtTime(hz(m) * 2, t + 2.4);
    f.connect(g).connect(out);
    this.env(g, t, 0.09, 0.02, 0.1, 2.6);
    this.osc('sawtooth', hz(m), t, t + 2.8).connect(f);
    this.osc('sawtooth', hz(m), t, t + 2.8, 4).connect(f);
  }

  private bass(out: AudioNode, f0: number, t: number, dur: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 4;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + Math.min(0.25, dur));
    f.connect(g).connect(out);
    this.env(g, t, 0.32, 0.008, dur * 0.6, 0.12);
    this.osc('sawtooth', f0, t, t + dur + 0.2).connect(f);
    const sub = c.createGain();
    sub.gain.value = 0.9;
    this.osc('sine', f0, t, t + dur + 0.2).connect(sub).connect(g);
  }

  /** Dhol bass head: a deep boom with a little skin slap. */
  private dha(out: AudioNode, t: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    g.connect(out);
    this.env(g, t, 0.9, 0.004, 0.02, 0.38);
    const o = this.osc('sine', 120, t, t + 0.5);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.3);
    o.connect(g);
    this.ta(out, t, 0.6);
  }

  /** Dhol treble stick: a sharp crack. */
  private ta(out: AudioNode, t: number, vol: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    g.connect(out);
    this.env(g, t, 0.35 * vol, 0.002, 0.005, 0.09);
    const o = this.osc('triangle', 520, t, t + 0.15);
    o.frequency.exponentialRampToValueAtTime(330, t + 0.08);
    o.connect(g);
    const n = this.noiseSrc(t, 0.1);
    if (n) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2800;
      bp.Q.value = 1.5;
      const ng = c.createGain();
      this.env(ng, t, 0.4 * vol, 0.001, 0.004, 0.06);
      n.connect(bp).connect(ng).connect(out);
    }
  }

  /** Tabla bayan "ge": a low tone that bends up. */
  private ge(out: AudioNode, t: number): void {
    const g = this.ctx!.createGain();
    g.connect(out);
    this.env(g, t, 0.55, 0.005, 0.05, 0.5);
    const o = this.osc('sine', 85, t, t + 0.7);
    o.frequency.linearRampToValueAtTime(120, t + 0.25);
    o.connect(g);
  }

  /** Tabla dayan "na": a bright ringing tap. */
  private na(out: AudioNode, t: number): void {
    const g = this.ctx!.createGain();
    g.connect(out);
    this.env(g, t, 0.22, 0.002, 0.01, 0.35);
    this.osc('sine', hz(74), t, t + 0.45).connect(g);
    const h = this.ctx!.createGain();
    h.gain.value = 0.35;
    this.osc('sine', hz(74) * 2.7, t, t + 0.2).connect(h).connect(g);
  }

  private hat(out: AudioNode, t: number, dur: number, vol = 0.3): void {
    const c = this.ctx!;
    const n = this.noiseSrc(t, dur + 0.02);
    if (!n) return;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = c.createGain();
    this.env(g, t, vol, 0.001, 0.003, dur);
    n.connect(hp).connect(g).connect(out);
  }

  private clap(out: AudioNode, t: number): void {
    const c = this.ctx!;
    for (const dt of [0, 0.012, 0.024]) {
      const n = this.noiseSrc(t + dt, 0.15);
      if (!n) return;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 0.8;
      const g = c.createGain();
      this.env(g, t + dt, dt === 0.024 ? 0.35 : 0.2, 0.001, 0.002, dt === 0.024 ? 0.12 : 0.02);
      n.connect(bp).connect(g).connect(out);
    }
  }

  /** Reedy lead with a slide from the previous note and a delayed vibrato. */
  private shehnai(out: AudioNode, f0: number, t: number, dur: number): void {
    const c = this.ctx!;
    const from = this.lastLeadHz > 0 && Math.abs(Math.log2(this.lastLeadHz / f0)) < 1 ? this.lastLeadHz : f0;
    this.lastLeadHz = f0;
    const g = c.createGain();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.7;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    bp.connect(lp).connect(g).connect(out);
    this.env(g, t, 0.12, 0.045, Math.max(0.02, dur - 0.09), 0.14);
    const lfo = this.osc('sine', 5.6, t, t + dur + 0.25);
    const depth = c.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f0 * 0.012, t + Math.min(0.35, dur));
    lfo.connect(depth);
    for (const [type, det, vol] of [['square', 0, 0.6], ['sawtooth', 6, 0.5]] as const) {
      const o = this.osc(type, from, t, t + dur + 0.25, det);
      o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
      depth.connect(o.frequency);
      const v = c.createGain();
      v.gain.value = vol;
      o.connect(v).connect(bp);
    }
  }

  /** Breathy flute: soft sine and triangle, a puff of air at the start, gentle vibrato. */
  private bansuri(out: AudioNode, f0: number, t: number, dur: number): void {
    const c = this.ctx!;
    const from = this.lastLeadHz > 0 && Math.abs(Math.log2(this.lastLeadHz / f0)) < 1 ? this.lastLeadHz : f0;
    this.lastLeadHz = f0;
    const g = c.createGain();
    g.connect(out);
    this.env(g, t, 0.2, 0.08, Math.max(0.05, dur - 0.15), 0.3);
    const lfo = this.osc('sine', 5, t, t + dur + 0.5);
    const depth = c.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f0 * 0.01, t + Math.min(0.5, dur));
    lfo.connect(depth);
    for (const [type, mult, vol] of [['sine', 1, 0.8], ['triangle', 1, 0.35], ['sine', 2, 0.12]] as const) {
      const o = this.osc(type, from * mult, t, t + dur + 0.5);
      o.frequency.exponentialRampToValueAtTime(f0 * mult, t + 0.09);
      depth.connect(o.frequency);
      const v = c.createGain();
      v.gain.value = vol;
      o.connect(v).connect(g);
    }
    const n = this.noiseSrc(t, 0.25);
    if (n) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f0 * 2;
      bp.Q.value = 2;
      const ng = c.createGain();
      this.env(ng, t, 0.05, 0.02, 0.03, 0.15);
      n.connect(bp).connect(ng).connect(out);
    }
  }

  /** Plucked, buzzy string a little like a sitar: bright attack, quick fall, a small bend in. */
  /** Electronic kick drum. */
  private kick(out: AudioNode, t: number): void {
    const g = this.ctx!.createGain();
    g.connect(out);
    this.env(g, t, 0.95, 0.002, 0.03, 0.28);
    const o = this.osc('sine', 160, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.12);
    o.connect(g);
  }

  private snare(out: AudioNode, t: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    g.connect(out);
    this.env(g, t, 0.3, 0.002, 0.01, 0.12);
    this.osc('triangle', 190, t, t + 0.15).connect(g);
    const n = this.noiseSrc(t, 0.2);
    if (n) {
      const bp = c.createBiquadFilter();
      bp.type = 'highpass';
      bp.frequency.value = 1500;
      const ng = c.createGain();
      this.env(ng, t, 0.45, 0.001, 0.01, 0.16);
      n.connect(bp).connect(ng).connect(out);
    }
  }

  private sitar(out: AudioNode, f0: number, t: number, vol = 0.09): void {
    const c = this.ctx!;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(5000, t);
    f.frequency.exponentialRampToValueAtTime(700, t + 0.5);
    f.connect(g).connect(out);
    this.env(g, t, vol, 0.003, 0.02, 0.9);
    for (const det of [0, 7]) {
      const o = this.osc('sawtooth', f0 * 0.985, t, t + 1.1, det);
      o.frequency.exponentialRampToValueAtTime(f0, t + 0.04);
      o.connect(f);
    }
  }

  /** Game over: a falling sitar phrase over a low gong. */
  private stinger(t: number): void {
    const c = this.ctx!;
    const bus = this.muffle;
    if (!bus || !this.reverb) return;
    const out = c.createGain();
    out.gain.value = 1;
    out.connect(bus);
    out.connect(this.reverb);
    ['A4', 'G4', 'F#4', 'Eb4', 'D4'].forEach((n, i) => this.sitar(out, hz(midiOf(n)), t + i * 0.16));
    const g = c.createGain();
    g.connect(out);
    this.env(g, t, 0.4, 0.01, 0.1, 2.2);
    for (const [m, v] of [[38, 1], [38 + 12, 0.3], [38 + 19, 0.15]] as const) {
      const vg = c.createGain();
      vg.gain.value = v;
      this.osc('sine', hz(m), t, t + 2.5).connect(vg).connect(g);
    }
  }
}
