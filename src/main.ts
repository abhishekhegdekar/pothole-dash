import './style.css';
import { Action, Input } from './core/input';
import { startLoop } from './core/loop';
import { VEHICLES, VEHICLE_ORDER, isVehicleId, type VehicleDef } from './data/vehicles';
import { isMapId, MAP_ORDER, MAPS, type MapDef } from './data/maps';
import { Sfx } from './audio/sfx';
import { Music } from './audio/music';
import { Renderer } from './render/renderer';
import { Renderer3D } from './render3d/renderer3d';
import type { GameRenderer } from './render/types';
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
    settings: el('settings'),
    btnStory: el('btnStory'),
    btnGarage: el('btnGarage'),
    btnSettings: el('btnSettings'),
    btnSettingsDone: el('btnSettingsDone'),
    btnVibe: el('btnVibe'),
    btnGfxHigh: el('btnGfxHigh'),
    btnGfxLow: el('btnGfxLow'),
    btnQuit: el('btnQuit'),
    btnMenu: el('btnMenu'),
    menuNote: el('menuNote'),
    walletCoins: el('walletCoins'),
    walletPoints: el('walletPoints'),
    overEarned: el('overEarned'),
    speedfx: el('speedfx'),
    volMusic: el<HTMLInputElement>('volMusic'),
    volSfx: el<HTMLInputElement>('volSfx'),
    maps: el('maps'),
    mapList: el('mapList'),
    mapsCoins: el('mapsCoins'),
    btnMapsBack: el('btnMapsBack'),
    hudCoins: el('hudCoins'),
    pedals: el('pedals'),
    garage: el('garage'),
    garageCoins: el('garageCoins'),
    gcCount: el('gcCount'),
    gcName: el('gcName'),
    gcPerk: el('gcPerk'),
    gcSpeed: el('gcSpeed'),
    gcHandling: el('gcHandling'),
    gcDents: el('gcDents'),
    gcDots: el('gcDots'),
    btnVehAction: el<HTMLButtonElement>('btnVehAction'),
  };

  const store = new SaveStore();
  const save = store.load();
  const sfx = new Sfx();
  sfx.muted = save.muted;
  sfx.setVolumes(save.settings.musicVol, save.settings.sfxVol);
  const music = new Music(sfx);
  const newSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  let map: MapDef = isMapId(save.selectedMap) ? MAPS[save.selectedMap] : MAPS.mumbai;
  let vehicle: VehicleDef = isVehicleId(save.selectedVehicle) && save.ownedVehicles.includes(save.selectedVehicle) ? VEHICLES[save.selectedVehicle] : VEHICLES.auto;
  const world = new World(vehicle, newSeed(), map.laneCount, map.mix);
  let renderer: GameRenderer;
  try {
    renderer = new Renderer3D(canvas, world, save.settings.graphics, map);
  } catch (err) {
    // No WebGL: fall back to the flat 2D view so the game still runs.
    console.warn('3D unavailable, using 2D', err);
    const fresh = canvas.cloneNode() as HTMLCanvasElement;
    canvas.replaceWith(fresh);
    renderer = new Renderer(fresh, world);
  }
  renderer.setVehicle?.(vehicle.id);
  const input = new Input(el<HTMLCanvasElement>('game'));
  input.bindPedal(el('pedalGas'), 'gas');
  input.bindPedal(el('pedalBrake'), 'brake');

  let state: State = 'menu';
  let garageOpen = false;
  let overReady = false;
  let overTimer = 0;
  let shownMeters = -1;
  let shownDents = -1;
  let shownScore = -1;
  let shownCombo = -1;
  let countT = 0;
  let countBeat = -1;
  let bannerTimer = 0;
  let shownFx = -1;
  let shownCoins = -1;
  let coinStreak = 0;
  let coinStreakT = 0;

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

  const toggle = (b: HTMLElement, on: boolean): void => {
    b.textContent = on ? 'On' : 'Off';
    b.setAttribute('aria-pressed', String(on));
  };
  const renderSettings = (): void => {
    toggle(ui.btnMute, !sfx.muted);
    toggle(ui.btnVibe, save.settings.vibration);
    ui.btnGfxHigh.setAttribute('aria-pressed', String(save.settings.graphics === 'high'));
    ui.btnGfxLow.setAttribute('aria-pressed', String(save.settings.graphics === 'low'));
    for (const [input, v] of [[ui.volMusic, save.settings.musicVol], [ui.volSfx, save.settings.sfxVol]] as const) {
      input.value = String(Math.round(v * 100));
      input.style.setProperty('--fill', `${Math.round(v * 100)}%`);
    }
  };
  const fmt = (n: number): string => n.toLocaleString('en-IN');
  const renderWallet = (): void => {
    ui.walletCoins.textContent = fmt(save.coins);
    ui.walletPoints.textContent = fmt(save.points);
    ui.mapsCoins.textContent = fmt(save.coins);
    el('menuEyebrow').textContent = `${map.name} · ${map.conditions}`;
    ui.best.textContent = save.bestScore > 0 ? `Best score ${fmt(save.bestScore)}` : 'Watch the road. It bites.';
  };
  renderSettings();
  renderWallet();

  const show = (which: HTMLElement | null): void => {
    for (const o of [ui.menu, ui.paused, ui.over, ui.settings, ui.maps, ui.garage]) o.hidden = o !== which;
    ui.hud.classList.toggle('is-hidden', state === 'menu');
    ui.pedals.classList.toggle('is-hidden', which !== null || state === 'menu' || state === 'over');
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
    save.points += score;
    save.coins += world.coinCount;
    save.bestByMap[map.id] = Math.max(save.bestByMap[map.id] ?? 0, score);
    if (d > save.bestDistance) save.bestDistance = d;
    store.save(save);
    ui.overDist.textContent = formatDistance(d);
    ui.overScore.textContent = score.toLocaleString('en-IN');
    ui.overNear.textContent = String(world.nearMisses);
    ui.overCombo.textContent = world.bestCombo > 1 ? `×${world.bestCombo}` : String(world.bestCombo);
    ui.overBest.textContent = `Best score: ${save.bestScore.toLocaleString('en-IN')} · Best distance: ${formatDistance(save.bestDistance)}`;
    ui.overBadge.hidden = !isBest;
    ui.overTitle.textContent = isBest ? 'New record!' : 'Auto broke down!';
    const earned: string[] = [];
    if (world.coinCount > 0) earned.push(`+${fmt(world.coinCount)} coins`);
    if (score > 0) earned.push(`+${fmt(score)} points for Story Mode`);
    ui.overEarned.textContent = earned.join(' · ');
    renderWallet();
    overTimer = window.setTimeout(() => {
      overReady = true;
      show(ui.over);
      ui.btnAgain.focus({ preventScroll: true });
    }, 1300);
  };

  // Map select.
  const useMap = (next: MapDef): void => {
    if (next.id === map.id) return;
    map = next;
    save.selectedMap = map.id;
    store.save(save);
    world.configure(vehicle, map.laneCount, map.mix);
    world.reset(newSeed());
    renderer.setMap?.(map);
    renderer.resetRun();
  };
  const renderMaps = (): void => {
    ui.mapList.textContent = '';
    for (const id of MAP_ORDER) {
      const m = MAPS[id];
      const owned = save.ownedMaps.includes(id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'map-card';
      card.setAttribute('role', 'listitem');
      card.style.background = `linear-gradient(135deg, ${m.card[0]}, ${m.card[1]})`;
      card.classList.toggle('is-selected', id === map.id);
      card.classList.toggle('is-locked', !owned);
      const afford = save.coins >= m.price;
      card.classList.toggle('cant-afford', !owned && !afford);
      const best = save.bestByMap[id] ?? 0;
      card.innerHTML = `
        <span class="mc-cond"></span><span class="mc-name"></span><span class="mc-tag"></span>
        <span class="mc-foot"><span class="mc-best"></span><span class="mc-go"></span></span>`;
      card.querySelector('.mc-cond')!.textContent = m.conditions;
      card.querySelector('.mc-name')!.textContent = m.name;
      card.querySelector('.mc-tag')!.textContent = m.tagline;
      card.querySelector('.mc-best')!.textContent = owned ? (best > 0 ? `Best ${fmt(best)}` : `${m.laneCount} lanes`) : `${m.laneCount} lanes`;
      card.querySelector('.mc-go')!.textContent = owned ? 'Drive' : `Unlock · ${fmt(m.price)} coins`;
      card.addEventListener('click', () => {
        if (!owned) {
          if (!afford) {
            sfx.thud();
            return;
          }
          save.coins -= m.price;
          save.ownedMaps.push(id);
          store.save(save);
          sfx.ding(3);
          renderWallet();
          renderMaps();
          return;
        }
        useMap(m);
        start();
      });
      ui.mapList.appendChild(card);
    }
  };
  const openMaps = (): void => {
    sfx.unlock();
    renderMaps();
    show(ui.maps);
    (ui.mapList.querySelector('.is-selected') as HTMLElement | null)?.focus({ preventScroll: true });
  };
  ui.btnMapsBack.addEventListener('click', () => show(ui.menu));

  // Buttons.
  ui.btnStart.addEventListener('click', openMaps);
  ui.btnAgain.addEventListener('click', () => overReady && start());
  ui.btnResume.addEventListener('click', resume);
  ui.paused.addEventListener('pointerdown', (e) => {
    if (e.target === ui.paused) resume();
  });
  ui.btnPause.addEventListener('click', (e) => {
    e.stopPropagation();
    pause();
  });
  ui.btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    save.muted = sfx.muted;
    store.save(save);
    sfx.unlock();
    renderSettings();
  });
  ui.btnVibe.addEventListener('click', () => {
    save.settings.vibration = !save.settings.vibration;
    store.save(save);
    renderSettings();
    if (save.settings.vibration) vibrate(30);
  });
  const setGfx = (q: 'high' | 'low'): void => {
    save.settings.graphics = q;
    store.save(save);
    renderer.setQuality(q);
    resize();
    renderSettings();
  };
  const onVol = (): void => {
    save.settings.musicVol = Number(ui.volMusic.value) / 100;
    save.settings.sfxVol = Number(ui.volSfx.value) / 100;
    sfx.setVolumes(save.settings.musicVol, save.settings.sfxVol);
    sfx.unlock();
    renderSettings();
  };
  for (const input of [ui.volMusic, ui.volSfx]) {
    input.addEventListener('input', onVol);
    input.addEventListener('change', () => store.save(save));
  }
  ui.btnGfxHigh.addEventListener('click', () => setGfx('high'));
  ui.btnGfxLow.addEventListener('click', () => setGfx('low'));
  let noteTimer = 0;
  const note = (text: string): void => {
    ui.menuNote.textContent = text;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => (ui.menuNote.textContent = ''), 2600);
  };
  ui.btnStory.addEventListener('click', () => note('Story Mode "500 km" arrives in a later step. Points you earn now carry over.'));
  // Garage: browse the vehicles, buy with coins, pick one to drive.
  let browse = VEHICLE_ORDER.indexOf(vehicle.id);
  const bar = (host: HTMLElement, n: number, of: number): void => {
    host.textContent = '';
    for (let i = 0; i < of; i++) {
      const b = document.createElement('i');
      if (i < n) b.className = 'on';
      host.appendChild(b);
    }
  };
  const renderGarage = (): void => {
    const v = VEHICLES[VEHICLE_ORDER[browse]!];
    const owned = save.ownedVehicles.includes(v.id);
    ui.garageCoins.textContent = fmt(save.coins);
    ui.gcCount.textContent = `${browse + 1} / ${VEHICLE_ORDER.length}`;
    ui.gcName.textContent = v.name;
    ui.gcPerk.textContent = v.perk;
    bar(ui.gcSpeed, v.speedRating, 5);
    bar(ui.gcHandling, v.handlingRating, 5);
    bar(ui.gcDents, v.dents, 5);
    const btn = ui.btnVehAction;
    const selected = v.id === vehicle.id;
    btn.textContent = selected ? 'Driving this' : owned ? 'Drive this' : `Buy · ${fmt(v.price)} coins`;
    btn.setAttribute('aria-disabled', String(selected || (!owned && save.coins < v.price)));
    ui.gcDots.textContent = '';
    VEHICLE_ORDER.forEach((id, i) => {
      const d = document.createElement('i');
      if (i === browse) d.classList.add('on');
      if (save.ownedVehicles.includes(id)) d.classList.add('owned');
      ui.gcDots.appendChild(d);
    });
    renderer.setVehicle?.(v.id);
  };
  const useVehicle = (v: VehicleDef): void => {
    vehicle = v;
    save.selectedVehicle = v.id;
    store.save(save);
    world.configure(vehicle, map.laneCount, map.mix);
    world.reset(newSeed());
    renderer.resetRun();
    buildDents();
  };
  const step = (d: number): void => {
    browse = (browse + d + VEHICLE_ORDER.length) % VEHICLE_ORDER.length;
    sfx.unlock();
    renderGarage();
  };
  const openGarage = (): void => {
    sfx.unlock();
    browse = VEHICLE_ORDER.indexOf(vehicle.id);
    garageOpen = true;
    renderGarage();
    show(ui.garage);
  };
  const closeGarage = (): void => {
    garageOpen = false;
    renderer.setVehicle?.(vehicle.id);
    renderWallet();
    show(ui.menu);
  };
  ui.btnGarage.addEventListener('click', openGarage);
  // Swipe across the open space above the card to flip through vehicles.
  let swipeX = -1;
  ui.garage.addEventListener('pointerdown', (e) => {
    if (e.target === ui.garage) swipeX = e.clientX;
  });
  ui.garage.addEventListener('pointerup', (e) => {
    if (swipeX >= 0 && Math.abs(e.clientX - swipeX) > 40) step(e.clientX < swipeX ? 1 : -1);
    swipeX = -1;
  });
  el('btnGarageBack').addEventListener('click', closeGarage);
  el('btnVehPrev').addEventListener('click', () => step(-1));
  el('btnVehNext').addEventListener('click', () => step(1));
  ui.btnVehAction.addEventListener('click', () => {
    const v = VEHICLES[VEHICLE_ORDER[browse]!];
    if (v.id === vehicle.id) return;
    if (!save.ownedVehicles.includes(v.id)) {
      if (save.coins < v.price) {
        sfx.thud();
        return;
      }
      save.coins -= v.price;
      save.ownedVehicles.push(v.id);
      sfx.ding(3);
    }
    useVehicle(v);
    renderGarage();
  });
  ui.btnSettings.addEventListener('click', () => show(ui.settings));
  ui.btnSettingsDone.addEventListener('click', () => show(ui.menu));
  const toMenu = (): void => {
    window.clearTimeout(overTimer);
    window.clearTimeout(bannerTimer);
    ui.banner.hidden = true;
    ui.count.hidden = true;
    sfx.unlock();
    world.reset(newSeed());
    renderer.resetRun();
    state = 'menu';
    renderWallet();
    show(ui.menu);
  };
  ui.btnQuit.addEventListener('click', toMenu);
  ui.btnMenu.addEventListener('click', () => overReady && toMenu());
  const unlockOnce = (): void => sfx.unlock();
  window.addEventListener('pointerdown', unlockOnce, { once: true });
  window.addEventListener('keydown', unlockOnce, { once: true });

  // Pause when the tab is hidden or the window loses focus; resume only on player input.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);

  function vibrate(ms: number): void {
    if (!save.settings.vibration) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  }

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
      if (!ui.garage.hidden) {
        if (a === Action.Left) step(-1);
        else if (a === Action.Right) step(1);
        else if (a === Action.Confirm) ui.btnVehAction.click();
        else if (a === Action.Pause) closeGarage();
      } else if (a === Action.Confirm && ui.settings.hidden && ui.maps.hidden) openMaps();
    } else if (state === 'over' && overReady && a === Action.Confirm) {
      start();
    }
  };

  const update = (dt: number): void => {
    input.drain(onAction);
    world.throttle = state === 'play' ? input.throttle : 0;
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
      if (ev.coins > 0) {
        coinStreak = coinStreakT > 0 ? coinStreak + ev.coins : 0;
        coinStreakT = 0.6;
        sfx.coin(coinStreak);
        replay(ui.hudCoins.parentElement!, 'pop');
      }
      coinStreakT -= dt;
      if (ev.bump) {
        sfx.bump();
        renderer.addShake(7);
        vibrate(25);
      }
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
        vibrate(ev.crash ? 120 : 40);
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
    const running = state === 'play' && world.alive;
    music.setMood(
      state === 'menu' ? 'menu' : state === 'over' ? 'over' : 'run',
      Math.min(1, renderer.speedFx * 0.85 + Math.min(world.combo, 6) * 0.04),
      map.music,
    );
    music.setMuffled(state === 'paused');
    music.update();
    sfx.setEngine(running || state === 'countdown', Math.min(1, renderer.speedFx + (world.throttleMul - 1) * 0.8));
    const slow = state === 'over' && world.crashT < SLOWMO_TIME ? SLOWMO_SCALE : 1;
    renderer.draw(alpha, state === 'paused' ? 0 : frameDt * slow, state === 'play', state === 'menu' ? (garageOpen ? 'garage' : 'menu') : 'game');
    const fx = Math.round(renderer.speedFx * 100) / 100;
    if (fx !== shownFx) {
      shownFx = fx;
      ui.speedfx.style.opacity = String(fx);
    }
    const meters = Math.floor(world.dist);
    if (state !== 'menu' && state !== 'over' && meters !== shownMeters) {
      shownMeters = meters;
      ui.dist.textContent = formatDistance(world.dist);
    }
    if (world.coinCount !== shownCoins) {
      shownCoins = world.coinCount;
      ui.hudCoins.textContent = fmt(shownCoins);
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

  // The dent icons match the vehicle's dent count.
  function buildDents(): void {
    ui.dents.textContent = '';
    for (let i = 0; i < world.vehicle.dents; i++) {
      const s = document.createElement('span');
      s.className = 'dent';
      ui.dents.appendChild(s);
    }
    shownDents = -1;
  }
  buildDents();

  show(ui.menu);
  startLoop(update, render);
}

try {
  boot();
} catch (err) {
  showError(err);
}
