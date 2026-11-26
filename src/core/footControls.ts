/**
 * On-foot controls. Touch: a floating joystick on the left half of the screen and an attack
 * button on the right. Keyboard: WASD or arrow keys to walk, Space, J or K to swing.
 */
export class FootControls {
  private readonly keys = new Set<string>();
  private stickId = -1;
  private ox = 0;
  private oy = 0;
  private sx = 0;
  private sy = 0;
  private attackQueued = false;
  private attackHeld = false;
  enabled = false;

  constructor(pad: HTMLElement, private readonly base: HTMLElement, private readonly knob: HTMLElement, attackBtn: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Space', 'KeyJ', 'KeyK'].includes(e.code)) {
        if (!e.repeat) this.attackQueued = true;
        this.attackHeld = true;
        e.preventDefault();
      }
      if (/^(Key[WASD]|Arrow)/.test(e.code)) this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (['Space', 'KeyJ', 'KeyK'].includes(e.code)) this.attackHeld = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.attackHeld = false;
      this.release();
    });
    pad.addEventListener('pointerdown', (e) => {
      if (this.stickId !== -1 || e.target !== pad) return;
      const r = pad.getBoundingClientRect();
      if (e.clientX > r.left + r.width * 0.6) return;
      this.stickId = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.sx = this.sy = 0;
      this.base.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
      this.base.classList.add('is-on');
      this.knob.style.transform = 'translate(-50%, -50%)';
      e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      const max = 46;
      let dx = e.clientX - this.ox;
      let dy = e.clientY - this.oy;
      const d = Math.hypot(dx, dy);
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      this.sx = dx / max;
      this.sy = dy / max;
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const up = (e: PointerEvent): void => {
      if (e.pointerId === this.stickId) this.release();
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
    attackBtn.addEventListener('pointerdown', (e) => {
      this.attackQueued = true;
      this.attackHeld = true;
      e.preventDefault();
      e.stopPropagation();
    });
    const off = (): void => {
      this.attackHeld = false;
    };
    attackBtn.addEventListener('pointerup', off);
    attackBtn.addEventListener('pointerleave', off);
  }

  private release(): void {
    this.stickId = -1;
    this.sx = this.sy = 0;
    this.base.classList.remove('is-on');
  }

  reset(): void {
    this.keys.clear();
    this.attackQueued = this.attackHeld = false;
    this.release();
  }

  /** Stick across (-1..1, right is +). */
  get moveX(): number {
    let x = this.sx;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    return Math.max(-1, Math.min(1, x));
  }

  /** Stick forward (-1..1, up the screen is +). */
  get moveY(): number {
    let y = -this.sy;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    return Math.max(-1, Math.min(1, y));
  }

  /** True once per tap, and repeatedly while the button is held. */
  takeAttack(): boolean {
    const a = this.attackQueued || this.attackHeld;
    this.attackQueued = false;
    return a;
  }
}
