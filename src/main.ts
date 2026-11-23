import './style.css';
import { Action, Input } from './core/input';
import { startLoop } from './core/loop';
import { VEHICLES } from './data/vehicles';
import { Sfx } from './audio/sfx';
import { Renderer } from './render/renderer';
import { SaveStore } from './storage/save';
import { World } from './systems/world';
import { formatDistance } from './ui/format';

type State = 'menu' | 'play' | 'paused' | 'over';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id}`);
  return e as T;
}

// One global error handler: show a friendly restart screen instead of a frozen page.
let crashed = false;
function showError(err: unknown): void {
  console.error(err);
  if (crashed) return;
  crashed = true;
  const box = document.getElementById('error');
  if (box) box.hidden = false;
}
window.addEventListener('error', (e) => showError(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));
document.getElementById('btnReload')?.addEventListener('click', () => location.reload());

function boot(): void {
  const app = el('app');
  const canvas = el<HTMLCanvasElement>('game');
  const ui = {
    menu: el('menu'),
    paused: el('paused'),
    over: el('over'),
    hud: el('hud'),
    dist: el('hudDist'),
    dents: el('hudDents'),
    best: el('menuBest'),
    overDist: el('overDist'),
    overBest: el('overBest'),
    overBadge: el('overBadge'),
    overTitle: el('overTitle'),
    btnStart: el('btnStart'),
    btnAgain: el<HTMLButtonElement>('btnAgain'),
    btnResume: el('btnResume'),
    btnPause: el('btnPause'),
    btnMute: el('btnMute'),
  };

  const store = new SaveStore();
  const save = store.load();
  const sfx = new Sfx();
  sfx.muted = save.muted;
  const newSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  const world = new World(VEHICLES.auto, newSeed());
  const renderer = new Renderer(canvas, world);
  const input = new Input(canvas);

  let state: State = 'menu';
  let overReady = false;
  let overTimer = 0;
  let shownMeters = -1;
  let shownDents = -1;

  const resize = (): void => renderer.resize(app.clientWidth, app.clientHeight, window.devicePixelRatio);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  const renderMute = (): void => {
    ui.btnMute.textContent = sfx.muted ? 'Sound off' : 'Sound on';
    ui.btnMute.setAttribute('aria-pressed', String(!sfx.muted));
  };
  renderMute();
  ui.best.textContent = save.bestDistance > 0 ? `Best: ${formatDistance(save.bestDistance)}` : 'Watch the road. It bites.';

  const show = (which: HTMLElement | null): void => {
    for (const o of [ui.menu, ui.paused, ui.over]) o.hidden = o !== which;
    ui.hud.classList.toggle('is-hidden', state === 'menu');
  };

  const start = (): void => {
    sfx.unlock();
    window.clearTimeout(overTimer);
    world.reset(newSeed());
    renderer.particles.clear();
    input.clear();
    state = 'play';
    overReady = false;
    shownDents = -1;
    show(null);
    sfx.horn();
  };

  const pause = (): void => {
    if (state !== 'play') return;
    state = 'paused';
    show(ui.paused);
    sfx.suspend();
  };

  const resume = (): void => {
    if (state !== 'paused') return;
    sfx.unlock();
    input.clear();
    state = 'play';
    show(null);
  };

  const gameOver = (): void => {
    state = 'over';
    const d = world.dist;
    const isBest = d > save.bestDistance;
    save.runs++;
    if (isBest) save.bestDistance = d;
    store.save(save);
    ui.overDist.textContent = formatDistance(d);
    ui.overBest.textContent = `Best: ${formatDistance(save.bestDistance)}`;
    ui.overBadge.hidden = !isBest;
    ui.overTitle.textContent = isBest ? 'New record!' : 'Auto broke down!';
    ui.best.textContent = `Best: ${formatDistance(save.bestDistance)}`;
    overTimer = window.setTimeout(() => {
      overReady = true;
      show(ui.over);
      ui.btnAgain.focus({ preventScroll: true });
    }, 700);
  };

  // Buttons.
  ui.btnStart.addEventListener('click', start);
  ui.menu.addEventListener('pointerdown', (e) => {
    if (e.target === ui.menu) start();
  });
  ui.btnAgain.addEventListener('click', () => overReady && start());
  ui.btnResume.addEventListener('click', resume);
  ui.paused.addEventListener('pointerdown', (e) => {
    if (e.target === ui.paused) resume();
  });
  ui.btnPause.addEventListener('click', (e) => {
    e.stopPropagation();
    pause();
  });
  ui.btnMute.addEventListener('click', (e) => {
    e.stopPropagation();
    sfx.muted = !sfx.muted;
    save.muted = sfx.muted;
    store.save(save);
    sfx.unlock();
    renderMute();
  });
  const unlockOnce = (): void => sfx.unlock();
  window.addEventListener('pointerdown', unlockOnce, { once: true });
  window.addEventListener('keydown', unlockOnce, { once: true });

  // Pause when the tab is hidden or the window loses focus; resume only on player input.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);

  const onAction = (a: Action): void => {
    if (state === 'play') {
      if (a === Action.Left) world.steer(-1);
      else if (a === Action.Right) world.steer(1);
      else if (a === Action.Pause) pause();
    } else if (state === 'paused') {
      if (a === Action.Pause || a === Action.Confirm) resume();
    } else if (state === 'menu') {
      if (a === Action.Confirm) start();
    } else if (state === 'over' && overReady && a === Action.Confirm) {
      start();
    }
  };

  const update = (dt: number): void => {
    input.drain(onAction);
    if (state === 'play' || state === 'over') {
      world.update(dt);
      const ev = world.events;
      if (ev.laneChange !== 0) sfx.swish();
      if (ev.hit) {
        renderer.burst(ev.hitX, ev.hitY);
        renderer.addShake(ev.crash ? 18 : 10);
        if (ev.crash) sfx.crash();
        else sfx.thud();
        try {
          navigator.vibrate?.(ev.crash ? 120 : 40);
        } catch {
          /* not supported */
        }
      }
      if (ev.crash && state === 'play') gameOver();
      world.clearEvents();
    } else if (state === 'menu') {
      world.attract(dt);
    } else {
      world.prevDist = world.dist;
      world.prevLanePos = world.lanePos;
    }
  };

  const render = (alpha: number, frameDt: number): void => {
    renderer.draw(alpha, state === 'paused' ? 0 : frameDt, state === 'play');
    const meters = Math.floor(world.dist);
    if (state !== 'menu' && meters !== shownMeters) {
      shownMeters = meters;
      ui.dist.textContent = formatDistance(world.dist);
    }
    if (world.dents !== shownDents) {
      shownDents = world.dents;
      const parts = ui.dents.children;
      for (let i = 0; i < parts.length; i++) parts[i]!.classList.toggle('is-lost', i >= world.dents);
      ui.dents.setAttribute('aria-label', `${world.dents} of ${world.vehicle.dents} dents left`);
    }
  };

  // Build the dent icons once.
  for (let i = 0; i < world.vehicle.dents; i++) {
    const s = document.createElement('span');
    s.className = 'dent';
    ui.dents.appendChild(s);
  }

  show(ui.menu);
  startLoop(update, render);
}

try {
  boot();
} catch (err) {
  showError(err);
}
