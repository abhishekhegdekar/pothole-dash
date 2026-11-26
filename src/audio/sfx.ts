/** Sound effects generated in code with Web Audio. Audio errors never break the game. */
type Ctx = AudioContext;

export class Sfx {
  private _muted = false;
  private ctx: Ctx | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private vols = { music: 0.7, sfx: 0.9 };
  private engineNodes: { osc: OscillatorNode; sub: OscillatorNode; lfo: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private engineOn = false;
  private readonly listeners: Array<() => void> = [];

  get muted(): boolean {
    return this._muted;
  }

  set muted(m: boolean) {
    this._muted = m;
    this.applyVolumes();
  }

  /** The shared audio context, once unlocked. */
  get context(): Ctx | null {
    return this.ctx;
  }

  /** Where music should connect. */
  get musicOut(): AudioNode | null {
    return this.musicBus;
  }

  /** Shared white noise, 0.6 s long. */
  get noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  /** Called once, right after the context is first created. */
  onReady(fn: () => void): void {
    if (this.ctx) fn();
    else this.listeners.push(fn);
  }

  setVolumes(music: number, sfx: number): void {
    this.vols = { music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this._muted ? 0 : 1, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.8, t, 0.05);
  }

  /** Call from a user gesture (tap/click/key). Browsers only allow sound after one. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const len = Math.floor(this.ctx.sampleRate * 0.6);
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        comp.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.connect(comp);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain();
        this.musicBus.connect(this.master);
        this.applyVolumes();
        for (const fn of this.listeners.splice(0)) fn();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
  }

  suspend(): void {
    try {
      if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
    } catch {
      /* ignore */
    }
  }

  /** Pothole thud: low noise burst plus a falling tone. */
  thud(): void {
    this.play((c, t, out) => {
      this.noiseBurst(c, t, out, 0.25, 420, 0.9);
      this.tone(c, t, out, 'sine', 140, 50, 0.22, 0.8);
    });
  }

  crash(): void {
    this.play((c, t, out) => {
      this.noiseBurst(c, t, out, 0.55, 900, 1);
      this.tone(c, t, out, 'square', 220, 60, 0.4, 0.25);
    });
  }

  swish(): void {
    this.play((c, t, out) => this.noiseBurst(c, t, out, 0.09, 2400, 0.12));
  }

  /** Two quick auto-rickshaw horn beeps. */
  horn(): void {
    this.play((c, t, out) => {
      for (const at of [0, 0.16]) {
        this.tone(c, t + at, out, 'square', 460, 455, 0.11, 0.12);
        this.tone(c, t + at, out, 'square', 580, 575, 0.11, 0.08);
      }
    });
  }

  /** Coin pickup: a bright two-note ping that climbs with a quick streak. */
  coin(streak: number): void {
    const f = 1320 * Math.pow(1.06, Math.min(streak, 8));
    this.play((c, t, out) => {
      this.tone(c, t, out, 'triangle', f, f, 0.07, 0.12);
      this.tone(c, t + 0.06, out, 'triangle', f * 1.5, f * 1.5, 0.14, 0.12);
    });
  }

  /** Roof gun: a sharp crack with a low thump. */
  shot(): void {
    this.play((c, t, out) => {
      this.noiseBurst(c, t, out, 0.12, 2600, 0.55);
      this.tone(c, t, out, 'square', 180, 60, 0.08, 0.3);
    });
  }

  /** Zombie hits the ram bar: a dull whack. */
  whack(): void {
    this.play((c, t, out) => {
      this.noiseBurst(c, t, out, 0.14, 600, 0.6);
      this.tone(c, t, out, 'sine', 120, 70, 0.12, 0.5);
    });
  }

  /** Fuel can: a slosh and a rising chime. */
  fuel(): void {
    this.play((c, t, out) => {
      this.noiseBurst(c, t, out, 0.25, 900, 0.25);
      this.tone(c, t + 0.05, out, 'triangle', 660, 990, 0.25, 0.16);
    });
  }

  /** Speed breaker: a dull double knock. */
  bump(): void {
    this.play((c, t, out) => {
      this.tone(c, t, out, 'sine', 110, 60, 0.12, 0.6);
      this.tone(c, t + 0.12, out, 'sine', 95, 55, 0.12, 0.45);
      this.noiseBurst(c, t, out, 0.1, 300, 0.4);
    });
  }

  /** Countdown beep; `go` is the higher final beep. */
  beep(go: boolean): void {
    this.play((c, t, out) => this.tone(c, t, out, 'square', go ? 880 : 520, go ? 880 : 520, go ? 0.3 : 0.12, 0.12));
  }

  /** Near-miss ding, pitched up with the combo. */
  ding(combo: number): void {
    const f = 700 * Math.pow(1.12, Math.min(combo - 1, 10));
    this.play((c, t, out) => {
      this.noiseBurst(c, t, out, 0.12, 3000, 0.15);
      this.tone(c, t, out, 'triangle', f, f * 1.5, 0.18, 0.22);
    });
  }

  /**
   * Two-stroke putter of the auto's engine. `k` is 0 at idle and 1 at top speed.
   * Call every frame; it is cheap when nothing changes.
   */
  setEngine(on: boolean, k: number): void {
    const c = this.ctx;
    if (!c || !this.sfxBus) return;
    try {
      if (!this.engineNodes) {
        const osc = c.createOscillator();
        osc.type = 'sawtooth';
        const sub = c.createOscillator();
        sub.type = 'square';
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = 3;
        const gain = c.createGain();
        gain.gain.value = 0;
        const am = c.createGain();
        am.gain.value = 0.5;
        const lfo = c.createOscillator();
        lfo.type = 'square';
        const lfoDepth = c.createGain();
        lfoDepth.gain.value = 0.45;
        lfo.connect(lfoDepth).connect(am.gain);
        const subGain = c.createGain();
        subGain.gain.value = 0.5;
        osc.connect(filter);
        sub.connect(subGain).connect(filter);
        filter.connect(am).connect(gain).connect(this.sfxBus);
        osc.start();
        sub.start();
        lfo.start();
        this.engineNodes = { osc, sub, lfo, filter, gain };
      }
      const n = this.engineNodes;
      const t = c.currentTime;
      const f = 38 + k * 34;
      n.osc.frequency.setTargetAtTime(f, t, 0.15);
      n.sub.frequency.setTargetAtTime(f / 2, t, 0.15);
      n.lfo.frequency.setTargetAtTime(9 + k * 14, t, 0.15);
      n.filter.frequency.setTargetAtTime(240 + k * 420, t, 0.15);
      if (on !== this.engineOn) {
        this.engineOn = on;
        n.gain.gain.setTargetAtTime(on ? 0.07 : 0, t, on ? 0.3 : 0.12);
      }
    } catch {
      /* ignore */
    }
  }

  private play(fn: (c: Ctx, t: number, out: AudioNode) => void): void {
    if (this._muted || !this.ctx || !this.sfxBus || this.ctx.state !== 'running') return;
    try {
      fn(this.ctx, this.ctx.currentTime, this.sfxBus);
    } catch {
      /* ignore */
    }
  }

  private tone(c: Ctx, t: number, out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(c: Ctx, t: number, out: AudioNode, dur: number, cutoff: number, vol: number): void {
    if (!this.noise) return;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    s.stop(t + dur + 0.02);
  }
}
