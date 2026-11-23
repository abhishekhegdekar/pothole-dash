/** Sound effects generated in code with Web Audio. Audio errors never break the game. */
type Ctx = AudioContext;

export class Sfx {
  muted = false;
  private ctx: Ctx | null = null;
  private noise: AudioBuffer | null = null;

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

  private play(fn: (c: Ctx, t: number, out: AudioNode) => void): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      fn(this.ctx, this.ctx.currentTime, this.ctx.destination);
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
