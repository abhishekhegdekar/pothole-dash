/** Keyboard + touch/mouse input turned into a small queue of game actions. */
export const Action = { Left: 1, Right: 2, Pause: 3, Confirm: 4 } as const;
export type Action = (typeof Action)[keyof typeof Action];

const QUEUE_SIZE = 16;
const SWIPE_PX = 24;
const TAP_MS = 350;

export class Input {
  private queue = new Uint8Array(QUEUE_SIZE);
  private head = 0;
  private count = 0;
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private pointerId = -1;
  private swiped = false;
  private readonly offs: Array<() => void> = [];
  private gasKey = false;
  private brakeKey = false;
  private gasPedal = false;
  private brakePedal = false;

  constructor(private readonly surface: HTMLElement) {
    this.on(window, 'keydown', (e) => this.onKey(e as KeyboardEvent));
    this.on(window, 'keyup', (e) => this.onKeyUp(e as KeyboardEvent));
    this.on(window, 'blur', () => (this.gasKey = this.brakeKey = this.gasPedal = this.brakePedal = false));
    this.on(surface, 'pointerdown', (e) => this.onDown(e as PointerEvent));
    this.on(surface, 'pointermove', (e) => this.onMove(e as PointerEvent));
    this.on(surface, 'pointerup', (e) => this.onUp(e as PointerEvent));
    this.on(surface, 'pointercancel', () => (this.pointerId = -1));
  }

  /** Calls fn for each queued action, oldest first, then empties the queue. */
  drain(fn: (a: Action) => void): void {
    while (this.count > 0) {
      const a = this.queue[this.head] as Action;
      this.head = (this.head + 1) % QUEUE_SIZE;
      this.count--;
      fn(a);
    }
  }

  clear(): void {
    this.count = 0;
  }

  /** -1 braking, 0 cruising, +1 accelerating. Brake wins if both are held. */
  get throttle(): -1 | 0 | 1 {
    if (this.brakeKey || this.brakePedal) return -1;
    if (this.gasKey || this.gasPedal) return 1;
    return 0;
  }

  /** Wires an on-screen pedal button: held while a finger or the mouse is on it. */
  bindPedal(el: HTMLElement, which: 'gas' | 'brake'): void {
    const set = (held: boolean): void => {
      if (which === 'gas') this.gasPedal = held;
      else this.brakePedal = held;
      el.classList.toggle('is-held', held);
    };
    this.on(el, 'pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        el.setPointerCapture((e as PointerEvent).pointerId);
      } catch {
        /* ignore */
      }
      set(true);
    });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(el, t, () => set(false));
    this.on(el, 'contextmenu', (e) => e.preventDefault());
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') this.gasKey = false;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') this.brakeKey = false;
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  private push(a: Action): void {
    if (this.count >= QUEUE_SIZE) return;
    this.queue[(this.head + this.count) % QUEUE_SIZE] = a;
    this.count++;
  }

  private on(target: EventTarget, type: string, fn: (e: Event) => void): void {
    target.addEventListener(type, fn, { passive: false });
    this.offs.push(() => target.removeEventListener(type, fn));
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      this.gasKey = true;
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.brakeKey = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.push(Action.Left);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.push(Action.Right);
        break;
      case 'KeyP':
      case 'Escape':
        this.push(Action.Pause);
        break;
      case 'Space':
      case 'Enter':
        this.push(Action.Confirm);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  private onDown(e: PointerEvent): void {
    if (this.pointerId !== -1) return;
    this.pointerId = e.pointerId;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downT = performance.now();
    this.swiped = false;
    e.preventDefault();
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId || this.swiped) return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      this.push(dx < 0 ? Action.Left : Action.Right);
      this.swiped = true;
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    if (this.swiped) return;
    if (performance.now() - this.downT > TAP_MS) return;
    const rect = this.surface.getBoundingClientRect();
    this.push(e.clientX < rect.left + rect.width / 2 ? Action.Left : Action.Right);
  }
}
