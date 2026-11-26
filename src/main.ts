import './style.css';
import { Action, Input } from './core/input';
import { startLoop } from './core/loop';
import { VEHICLES } from './data/vehicles';
import { Sfx } from './audio/sfx';
import { Renderer } from './render/renderer';
import { SaveStore } from './storage/save';
import { World } from './systems/world';
import { formatDistance } from './ui/format';

type State = 'menu' | 'countdown' | 'play' | 'paused' | 'over';

/** Countdown beats: 3, 2, 1 then GO, in seconds. */
const BEAT = 0.55;
const SLOWMO_TIME = 0.55;
const SLOWMO_SCALE = 0.3;

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
    score: el('hudScore'),
    combo: el('hudCombo'),
    count: el('count'),
    banner: el('banner'),
    flash: el('flash'),
    overScore: el('overScore'),
    overNear: el('overNear'),
    overCombo: el('overCombo'),
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
  let shownScore = -1;
  let shownCombo = -1;
  let countT = 0;
  let countBeat = -1;
  let bannerTimer = 0;

  /** Restarts a CSS animation on an element by toggling its class. */
  const replay = (node: HTMLElement, cls: string): void => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };

  const resize = (): void => renderer.resize(app.clientWidth, app.clientHeight, window.devicePixelRatio);
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  const renderMute = (): void => {
    ui.btnMute.textContent = sfx.muted ? 'Sound off' : 'Sound on';
    ui.btnMute.setAttribute('aria-pressed', String(!sfx.muted));
  };
  renderMute();
  ui.best.textContent = save.bestScore > 0 ? `Best score: ${save.bestScore.toLocaleString('en-IN')}` : 'Watch the road. It bites.';

  const show = (which: HTMLElement | null): void => {
    for (const o of [ui.menu, ui.paused, ui.over]) o.hidden = o !== which;
    ui.hud.classList.toggle('is-hidden', state === 'menu');
  };

  const showBeat = (beat: number): void => {
    const go = beat >= 3;
    ui.count.hidden = false;
    ui.count.classList.toggle('is-go', go);
    ui.count.innerHTML = `<span>${go ? 'GO!' : String(3 - beat)}</span>`;
    sfx.beep(go);
  };

  const beginCountdown = (): void => {
    state = 'countdown';
    countT = 0;
    countBeat = -1;
    input.clear();
    show(null);
  };

  const start = (): void => {
    sfx.unlock();
    window.clearTimeout(overTimer);
    window.clearTimeout(bannerTimer);
    ui.banner.hidden = true;
    world.reset(newSeed());
    renderer.resetRun();
    overReady = false;
    shownDents = shownScore = shownCombo = shownMeters = -1;
    beginCountdown();
  };

  const pause = (): void => {
    if (state !== 'play' && state !== 'countdown') return;
    state = 'paused';
    ui.count.hidden = true;
    show(ui.paused);
    sfx.suspend();
  };

  const resume = (): void => {
    if (state !== 'paused') return;
    sfx.unlock();
    // Always count back in, so the player is ready before the road moves.
    beginCountdown();
  };

  const milestone = (m: number): void => {
    ui.banner.textContent = `${formatDistance(m)}!`;
    ui.banner.hidden = false;
    replay(ui.banner, 'is-on');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => (ui.banner.hidden = true), 1700);
    sfx.horn();
  };

  const gameOver = (): void => {
    state = 'over';
    const d = world.dist;
    const score = world.score;
    const isBest = score > save.bestScore;
    save.runs++;
    if (isBest) save.bestScore = score;
    if (d > save.bestDistance) save.bestDistance = d;
    store.save(save);
    ui.overDist.textContent = formatDistance(d);
    ui.overScore.textContent = score.toLocaleString('en-IN');
    ui.overNear.textContent = String(world.nearMisses);
    ui.overCombo.textContent = world.bestCombo > 1 ? `×${world.bestCombo}` : String(world.bestCombo);
    ui.overBest.textContent = `Best score: ${save.bestScore.toLocaleString('en-IN')} · Best distance: ${formatDistance(save.bestDistance)}`;
    ui.overBadge.hidden = !isBest;
    ui.overTitle.textContent = isBest ? 'New record!' : 'Auto broke down!';
    ui.best.textContent = `Best score: ${save.bestScore.toLocaleString('en-IN')}`;
    overTimer = window.setTimeout(() => {
      overReady = true;
      show(ui.over);
      ui.btnAgain.focus({ preventScroll: true });
    }, 1300);
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
    } else if (state === 'countdown') {
      if (a === Action.Pause) pause();
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
    if (state === 'countdown') {
      countT += dt;
      const beat = Math.min(3, Math.floor(countT / BEAT));
      if (beat !== countBeat) {
        countBeat = beat;
        showBeat(beat);
      }
      if (beat >= 3) {
        state = 'play';
        show(null);
        window.setTimeout(() => {
          if (state !== 'countdown') ui.count.hidden = true;
        }, 450);
      }
      world.attract(dt, 0);
    } else if (state === 'play' || state === 'over') {
      const slowmo = !world.alive && world.crashT < SLOWMO_TIME;
      world.update(slowmo ? dt * SLOWMO_SCALE : dt);
      const ev = world.events;
      if (ev.laneChange !== 0) sfx.swish();
      if (ev.nearMiss > 0) {
        sfx.ding(ev.nearMiss);
        const label = ev.nearMiss > 1 ? `Close one! ×${ev.nearMiss}` : 'Close one!';
        renderer.popText(label, ev.nearMissX, ev.nearMissY + 1.5, '#ffc21a', 22);
        renderer.popText(`+${ev.nearMissPoints}`, ev.nearMissX, ev.nearMissY, '#f7f2e7', 18);
      }
      if (ev.milestone > 0) milestone(ev.milestone);
      if (ev.hit) {
        renderer.burst(ev.hitX, ev.hitY);
        renderer.addShake(ev.crash ? 18 : 10);
        replay(ui.flash, 'is-on');
        if (ev.crash) {
          sfx.crash();
          renderer.crash(world.targetLane >= 1 ? 1 : -1);
        } else {
          sfx.thud();
          renderer.popText('−1 dent', ev.hitX, ev.hitY + 1, '#ff7a63', 20);
        }
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
    const slow = state === 'over' && world.crashT < SLOWMO_TIME ? SLOWMO_SCALE : 1;
    renderer.draw(alpha, state === 'paused' ? 0 : frameDt * slow, state === 'play');
    const meters = Math.floor(world.dist);
    if (state !== 'menu' && state !== 'over' && meters !== shownMeters) {
      shownMeters = meters;
      ui.dist.textContent = formatDistance(world.dist);
    }
    if (state !== 'menu' && state !== 'over' && world.score !== shownScore) {
      shownScore = world.score;
      ui.score.textContent = `Score ${shownScore.toLocaleString('en-IN')}`;
    }
    if (world.combo !== shownCombo) {
      shownCombo = world.combo;
      ui.combo.hidden = world.combo < 2;
      if (world.combo >= 2) {
        ui.combo.textContent = `Combo ×${world.combo}`;
        replay(ui.combo, 'combo');
      }
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
