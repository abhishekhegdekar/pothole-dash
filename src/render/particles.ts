/** Fixed-size particle pool for dust and debris. Positions are in world metres. */
const MAX = 160;

export class Particles {
  readonly x = new Float32Array(MAX);
  readonly y = new Float32Array(MAX);
  readonly vx = new Float32Array(MAX);
  readonly vy = new Float32Array(MAX);
  readonly life = new Float32Array(MAX);
  readonly maxLife = new Float32Array(MAX);
  readonly size = new Float32Array(MAX);
  readonly kind = new Uint8Array(MAX);
  readonly max = MAX;
  private cursor = 0;

  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, kind: number): void {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.kind[i] = kind;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i] = this.life[i]! - dt;
      this.x[i] = this.x[i]! + this.vx[i]! * dt;
      this.y[i] = this.y[i]! + this.vy[i]! * dt;
      this.vx[i] = this.vx[i]! * 0.96;
      this.vy[i] = this.vy[i]! * 0.96;
    }
  }

  clear(): void {
    this.life.fill(0);
  }
}
