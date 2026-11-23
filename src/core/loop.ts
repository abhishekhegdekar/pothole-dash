/**
 * Fixed 60 Hz update with an accumulator. The frame delta is clamped to 100 ms,
 * so a lag spike or returning to the tab never makes objects jump through each other.
 */
export const STEP = 1 / 60;
const MAX_FRAME = 0.1;

export interface Loop {
  stop(): void;
}

export function startLoop(
  update: (dt: number) => void,
  render: (alpha: number, frameDt: number) => void,
): Loop {
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  let running = true;

  const frame = (now: number): void => {
    if (!running) return;
    let frameDt = (now - last) / 1000;
    last = now;
    if (frameDt > MAX_FRAME) frameDt = MAX_FRAME;
    if (frameDt < 0) frameDt = 0;
    acc += frameDt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render(acc / STEP, frameDt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
