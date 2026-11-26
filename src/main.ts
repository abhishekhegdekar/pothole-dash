import './style.css';
import { Action, Input } from './core/input';
import { startLoop } from './core/loop';
import { STORY_ROAD, legRoad } from './data/story';
import {
  CAMPS, CAMP_ORDER, campaignNodes, chapterAt, ending, gatesLevel, isCampId, kmDone, legMetres, routeKm,
  type CampId, type CampaignNode, type DriveNode, type FootNode, type Line, type Scene,
} from './data/campaign';
import { SPEAKER_NAMES, portrait, sceneArt } from './ui/portraits';
import { routeMapSvg } from './ui/routeMap';
import { newCampaign } from './storage/save';
import { MACHETE, PAINTS, UPGRADES, lvl, paintColour, storyRules, storyVehicle } from './data/upgrades';
import { FootWorld, MALL_TEST, type FootLevel } from './systems/foot';
import { FootControls } from './core/footControls';
import { Foot3D } from './render3d/foot3d';
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
    hudFuel: el('hudFuel'),
    hudFuelFill: el('hudFuelFill'),
    hudCoinDot: el('hudCoinDot'),
    hudHp: el('hudHp'),
    hudHpFill: el('hudHpFill'),
    hudLabel: el('hudLabel'),
    footPad: el('footPad'),
    storyPick: el('storyPick'),
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
  // On-foot sections draw with the same WebGL renderer (not available in the 2D fallback).
  const foot = new FootWorld(newSeed());
  const foot3d = renderer instanceof Renderer3D ? new Foot3D(renderer.webgl, foot, app) : null;
  const footIn = new FootControls(el('footPad'), el('stickBase'), el('stickKnob'), el('btnAttack'));
  const input = new Input(el<HTMLCanvasElement>('game'));
  input.bindPedal(el('pedalGas'), 'gas');
  input.bindPedal(el('pedalBrake'), 'brake');

  let state: State = 'menu';
  /** Free Run or the Story Mode test drive. `road` is the map being driven right now. */
  let mode: 'free' | 'story' | 'foot' = 'free';
  let road: MapDef = map;
  let garageOpen = false;
  /** The current run is a campaign drive or stop (not the endless zombie run). */
  let inCampaign = false;
  let footLevel: FootLevel = MALL_TEST;
  /** What the game-over card's main button does. */
  let overAction: 'again' | 'continue' | 'restart' = 'again';
  /** Where the workshop's back button goes. */
  let shopReturn: 'pick' | 'route' | 'advance' = 'pick';
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

  const resize = (): void => {
    renderer.resize(app.clientWidth, app.clientHeight, window.devicePixelRatio);
    foot3d?.resize(app.clientWidth, app.clientHeight);
  };
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
  /** Story line under the menu's Story Mode button; set once the campaign code below is ready. */
  let storySub = (): string => 'The night of the siren. Get out of Mumbai.';
  const renderWallet = (): void => {
    ui.walletCoins.textContent = fmt(save.coins);
    ui.walletPoints.textContent = fmt(save.points);
    ui.mapsCoins.textContent = fmt(save.coins);
    el('menuEyebrow').textContent = `${map.name} · ${map.conditions}`;
    ui.best.textContent = save.bestScore > 0 ? `Best score ${fmt(save.bestScore)}` : 'Watch the road. It bites.';
    el('menuStorySub').textContent = storySub();
  };
  renderSettings();
  renderWallet();

  const show = (which: HTMLElement | null): void => {
    for (const o of [ui.menu, ui.paused, ui.over, ui.settings, ui.maps, ui.garage, ui.storyPick, el('workshop'), el('scene'), el('route')]) o.hidden = o !== which;
    ui.hud.classList.toggle('is-hidden', state === 'menu');
    ui.pedals.classList.toggle('is-hidden', mode === 'foot' || which !== null || state === 'menu' || state === 'over');
    ui.footPad.hidden = mode !== 'foot' || which !== null || state === 'menu' || state === 'over';
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
    if (mode === 'foot') {
      foot.reset(newSeed(), footLevel);
      foot.weapon = save.weapons.includes('machete') ? 'machete' : 'bat';
      footIn.reset();
      foot3d?.hidePopups();
    }
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
    const story = mode !== 'free';
    const isBest = !story && score > save.bestScore;
    save.runs++;
    if (isBest) save.bestScore = score;
    if (mode === 'foot') {
      // Escaping keeps the scrap and adds a bonus; going down still keeps half of it.
      save.scrap += foot.escaped ? foot.scrap + 15 : Math.floor(foot.scrap / 2);
    } else if (story) {
      save.scrap += world.coinCount;
    } else {
      save.points += score;
      save.coins += world.coinCount;
      save.bestByMap[map.id] = Math.max(save.bestByMap[map.id] ?? 0, score);
      if (d > save.bestDistance) save.bestDistance = d;
    }
    store.save(save);
    ui.overDist.textContent = formatDistance(d);
    ui.overScore.textContent = score.toLocaleString('en-IN');
    ui.overNear.textContent = String(world.nearMisses);
    ui.overCombo.textContent = world.bestCombo > 1 ? `×${world.bestCombo}` : String(world.bestCombo);
    ui.overBest.textContent = `Best score: ${save.bestScore.toLocaleString('en-IN')} · Best distance: ${formatDistance(save.bestDistance)}`;
    ui.overBadge.hidden = !isBest;
    ui.overTitle.textContent = story
      ? (world.endReason === 'fuel' ? 'Out of fuel!' : 'The SUV is wrecked!')
      : isBest ? 'New record!' : `${vehicle.id === 'auto' ? 'Auto' : vehicle.name} broke down!`;
    const earned: string[] = [];
    if (story) {
      earned.push(`${world.kills} zombies knocked down`);
      if (world.coinCount > 0) earned.push(`+${fmt(world.coinCount)} scrap`);
    } else {
      if (world.coinCount > 0) earned.push(`+${fmt(world.coinCount)} coins`);
      if (score > 0) earned.push(`+${fmt(score)} points for Story Mode`);
    }
    ui.overEarned.textContent = earned.join(' · ');
    const labels = mode === 'foot' ? ['You found', 'Zombies', 'Health', 'Scrap'] : ['You drove', 'Score', 'Near misses', 'Best combo'];
    ['overFinalLabel', 'overL1', 'overL2', 'overL3'].forEach((id, i) => (el(id).textContent = labels[i]!));
    ui.btnAgain.textContent = mode === 'foot' ? 'Go in again' : 'Drive again';
    if (mode === 'foot') {
      ui.overDist.textContent = `${foot.found} of ${foot.level.goal} supplies`;
      ui.overScore.textContent = String(foot.kills);
      ui.overNear.textContent = `${Math.round(foot.hp)}%`;
      ui.overCombo.textContent = String(foot.scrap);
      ui.overBadge.hidden = true;
      ui.overBest.textContent = '';
      ui.overTitle.textContent = foot.escaped ? 'Back to the SUV!' : 'Raj is down. Tanvi pulls him out.';
      ui.overEarned.textContent = foot.escaped ? `+${foot.scrap + 15} scrap (+15 for getting out)` : `+${Math.floor(foot.scrap / 2)} scrap`;
    }
    overAction = 'again';
    if (inCampaign) campaignOver();
    renderWallet();
    overTimer = window.setTimeout(() => {
      overReady = true;
      show(ui.over);
      ui.btnAgain.focus({ preventScroll: true });
    }, 1300);
  };

  // Story campaign.
  const camp = (): CampId | null => (isCampId(save.campaign.camp) ? save.campaign.camp : null);
  const nodes = (): CampaignNode[] => campaignNodes(camp());
  const node = (): CampaignNode | undefined => nodes()[save.campaign.node];
  const kmLeft = (): number => {
    const c = camp();
    if (!c) return 0;
    const n = node();
    const done = kmDone(c, save.campaign.node) + (n?.kind === 'drive' && state !== 'menu' ? Math.min(1, world.dist / legMetres(n.km)) * n.km : 0);
    return Math.max(0, Math.round(routeKm(c) - done));
  };
  const flash = (text: string, ms = 2200): void => {
    ui.banner.textContent = text;
    ui.banner.hidden = false;
    replay(ui.banner, 'is-on');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => (ui.banner.hidden = true), ms);
  };

  /** Results of a campaign drive or stop, on the game-over card. */
  function campaignOver(): void {
    const n = node();
    const ok = mode === 'foot' ? foot.escaped : world.endReason === 'arrived';
    if (!n) return;
    if (ok) {
      if (n.kind === 'drive') {
        save.campaign.fuel = world.fuel;
        save.scrap += 10;
        ui.overTitle.textContent = `Made it: ${n.place.split(' to ').pop()}`;
        ui.overEarned.textContent = `${world.kills} zombies knocked down · +${fmt(world.coinCount + 10)} scrap`;
        ui.overDist.textContent = `${kmLeft()} km`;
        el('overFinalLabel').textContent = 'Left to the camp';
      } else if (n.kind === 'foot') {
        if (n.level.layout === 'pump') save.campaign.fuel = 1;
        else if (n.level.layout === 'mall') save.campaign.fuel = Math.max(save.campaign.fuel, 0.75);
        ui.overTitle.textContent = n.level.layout === 'gates' ? 'The generator roars to life!' : n.level.layout === 'apartment' ? 'Down to the SUV!' : 'Back to the SUV!';
      }
      overAction = 'continue';
      ui.btnAgain.textContent = 'Continue';
    } else {
      ui.btnAgain.textContent = 'Try again';
      if (mode !== 'foot') ui.overEarned.textContent = `${world.kills} zombies knocked down · ${kmLeft()} km still to go`;
    }
    ui.overBest.textContent = '';
    ui.overBadge.hidden = true;
    store.save(save);
  }

  /** Puts a campaign drive's road behind the menus, so the scene and the map sit on it. */
  const showRoad = (n: DriveNode | null): void => {
    const next = n ? legRoad(n.theme, n.time, n.danger, n.place) : STORY_ROAD;
    if (mode !== 'story') setMode('story');
    road = next;
    world.configure(storyVehicle(save.upgrades), road.laneCount, road.mix, storyRules(save.upgrades));
    world.reset(newSeed());
    renderer.setVehicle?.('rig', paintColour(save.paint));
    renderer.setMap?.(road);
    renderer.resetRun();
  };
  /** The next drive from here, for the background. */
  const nextDrive = (): DriveNode | null => {
    const list = nodes();
    for (let i = save.campaign.node; i < list.length; i++) if (list[i]!.kind === 'drive') return list[i] as DriveNode;
    return null;
  };

  // Scene player: one line at a time, tap to go on; choices at the end.
  const sc = {
    bg: el('sceneBg'), chapter: el('sceneChapter'), chNum: el('sceneChNum'), chTitle: el('sceneChTitle'), place: el('scenePlace'),
    panel: el('scenePanel'), portrait: el('scenePortrait'), who: el('sceneWho'), line: el('sceneLine'), choices: el('sceneChoices'), tap: el('sceneTap'),
  };
  let sceneLines: Line[] = [];
  let sceneI = 0;
  let sceneChoice: Scene['choice'] | undefined;
  let sceneDone: (() => void) | null = null;
  let sceneLock = 0;
  const showLine = (l: Line): void => {
    const narr = l.who === 'narrator';
    sc.panel.classList.toggle('is-narrator', narr);
    sc.panel.classList.toggle('is-radio', l.who === 'kavita' || l.who === 'alert');
    sc.portrait.innerHTML = narr ? '' : portrait(l.who, l.name);
    sc.portrait.hidden = narr;
    sc.who.textContent = l.who === 'survivor' ? l.name ?? '' : SPEAKER_NAMES[l.who];
    sc.line.textContent = l.text;
    replay(sc.panel, 'is-in');
    sceneLock = performance.now() + 250;
  };
  const playScene = (scene: Scene, chapter: [number, string] | undefined, place: string, done: () => void): void => {
    sc.bg.innerHTML = sceneArt(scene.bg);
    sc.chapter.hidden = !chapter;
    if (chapter) {
      sc.chNum.textContent = `Chapter ${chapter[0]}`;
      sc.chTitle.textContent = chapter[1];
      replay(sc.chapter, 'is-in');
    }
    sc.place.textContent = place;
    sc.choices.hidden = true;
    sc.tap.hidden = false;
    sceneLines = scene.lines;
    sceneChoice = scene.choice;
    sceneI = 0;
    sceneDone = done;
    state = 'menu';
    show(el('scene'));
    showLine(sceneLines[0]!);
  };
  const endScene = (): void => {
    const done = sceneDone;
    sceneDone = null;
    done?.();
  };
  const showChoices = (): void => {
    const ch = sceneChoice!;
    sceneChoice = undefined;
    sc.choices.textContent = '';
    sc.tap.hidden = true;
    const prompt = document.createElement('p');
    prompt.className = 'sc-prompt';
    prompt.textContent = ch.prompt;
    sc.choices.appendChild(prompt);
    for (const o of ch.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sc-choice';
      const cant = (o.scrap ?? 0) < 0 && save.scrap < -(o.scrap ?? 0);
      b.disabled = cant;
      b.textContent = cant ? `${o.label} (not enough scrap)` : o.label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const cpg = save.campaign;
        if (o.helper) cpg.helpers++;
        if (o.kind) cpg.kindness++;
        if (o.fuel) cpg.fuel = Math.max(0.2, Math.min(1, cpg.fuel + o.fuel));
        if (o.scrap) save.scrap = Math.max(0, save.scrap + o.scrap);
        store.save(save);
        sfx.ding(2);
        sc.choices.hidden = true;
        sc.tap.hidden = false;
        sceneLines = o.reply;
        sceneI = 0;
        showLine(sceneLines[0]!);
      });
      sc.choices.appendChild(b);
    }
    sc.choices.hidden = false;
  };
  const nextLine = (): void => {
    if (!sc.choices.hidden || performance.now() < sceneLock) return;
    sfx.swish();
    sceneI++;
    if (sceneI < sceneLines.length) showLine(sceneLines[sceneI]!);
    else if (sceneChoice) showChoices();
    else endScene();
  };
  el('scene').addEventListener('click', nextLine);
  el('btnSceneSkip').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!sc.choices.hidden) return;
    if (sceneChoice) {
      sceneI = sceneLines.length - 1;
      showLine(sceneLines[sceneI]!);
      showChoices();
    } else endScene();
  });

  // Route map: pick a camp, or see the road so far and the next stop.
  let pickCamp: CampId | null = null;
  const renderRoute = (): void => {
    const c = camp();
    const n = node();
    el('routeScrap').textContent = fmt(save.scrap);
    const camps = el('routeCamps');
    const next = el('routeNext');
    camps.textContent = '';
    const go = el<HTMLButtonElement>('btnRouteGo');
    el('btnRouteShop').hidden = !c;
    if (n?.kind === 'choose' || (!c && !n)) {
      el('routeTitle').textContent = 'Choose a camp';
      el('routeMap').innerHTML = routeMapSvg(null, 0, pickCamp);
      for (const id of CAMP_ORDER) {
        const cp = CAMPS[id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `camp-card camp-${id}`;
        b.setAttribute('aria-pressed', String(pickCamp === id));
        b.innerHTML = '<span class="cc-name"></span><span class="cc-near"></span><span class="cc-blurb"></span><span class="cc-traits"></span>';
        b.querySelector('.cc-name')!.textContent = cp.name;
        b.querySelector('.cc-near')!.textContent = `${cp.near} · ${routeKm(id)} km`;
        b.querySelector('.cc-blurb')!.textContent = cp.blurb;
        b.querySelector('.cc-traits')!.textContent = cp.traits;
        b.addEventListener('click', () => {
          pickCamp = id;
          sfx.swish();
          renderRoute();
          go.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
        camps.appendChild(b);
      }
      camps.hidden = false;
      next.classList.add('is-pick');
      el('routeChapter').textContent = 'Chapter 1 · Siren Night';
      el('routeKm').textContent = pickCamp ? `${routeKm(pickCamp)} km` : '72 hours';
      el('routeNextName').textContent = pickCamp ? `${CAMPS[pickCamp].name}, ${CAMPS[pickCamp].near}` : 'Pick a camp on the map';
      el('routeNextGoal').textContent = pickCamp ? CAMPS[pickCamp].traits : 'Each camp is a different road out of Mumbai.';
      go.textContent = pickCamp ? 'Head there' : 'Choose a camp';
      go.disabled = !pickCamp;
      return;
    }
    camps.hidden = true;
    next.classList.remove('is-pick');
    go.disabled = false;
    el('routeTitle').textContent = c ? CAMPS[c].name : 'Get out of Mumbai';
    el('routeMap').innerHTML = routeMapSvg(c, save.campaign.node);
    const [num, title] = chapterAt(c, save.campaign.node);
    el('routeChapter').textContent = `Chapter ${num} · ${title}`;
    el('routeKm').textContent = c ? `${kmLeft()} km to go` : '72 hours';
    if (!n) return;
    el('routeNextName').textContent = n.place;
    if (n.kind === 'drive') {
      const tod = { night: 'Night', dawn: 'Dawn', day: 'Day', dusk: 'Dusk' }[n.time];
      const terr = { city: 'City streets', highway: 'Highway', ghat: 'Ghat road, fog', coast: 'Coast road' }[n.theme];
      el('routeNextGoal').textContent = `${n.km} km · ${terr} · ${tod} · Tank ${Math.round(Math.max(save.campaign.fuel, 0.45) * 100)}%`;
      go.textContent = 'Drive';
    } else if (n.kind === 'foot') {
      el('routeNextGoal').textContent = n.goal;
      go.textContent = 'Go in';
    } else if (n.kind === 'garage') {
      el('routeNextGoal').textContent = 'Spend scrap and points on the SUV before the next road.';
      go.textContent = 'Open the workshop';
    } else {
      el('routeNextGoal').textContent = '';
      go.textContent = 'Continue';
    }
  };
  const openRoute = (): void => {
    state = 'menu';
    renderRoute();
    show(el('route'));
  };
  el('btnRouteGo').addEventListener('click', () => {
    sfx.unlock();
    const n = node();
    if (n?.kind === 'choose') {
      if (!pickCamp) return;
      save.campaign.camp = pickCamp;
      sfx.ding(3);
      advance();
      return;
    }
    if (!n) return;
    if (n.kind === 'drive') startDrive(n);
    else if (n.kind === 'foot') startFoot(n);
    else if (n.kind === 'garage') {
      shopReturn = 'advance';
      openWorkshop();
    } else runNode();
  });
  el('btnRouteShop').addEventListener('click', () => {
    shopReturn = 'route';
    openWorkshop();
  });
  el('btnRouteBack').addEventListener('click', () => toMenu());

  const startDrive = (n: DriveNode): void => {
    showRoad(n);
    inCampaign = true;
    const startFuel = Math.max(save.campaign.fuel, 0.45);
    if (save.campaign.fuel < 0.45) flash('Tanvi siphons fuel from a wreck', 2400);
    world.configure(storyVehicle(save.upgrades), road.laneCount, road.mix, { ...storyRules(save.upgrades), goal: legMetres(n.km), startFuel });
    buildDents();
    ui.hudLabel.textContent = 'To the camp';
    start();
    if (save.campaign.fuel >= 0.45) flash(`${n.place} · ${n.km} km`, 2400);
  };
  const startFoot = (n: FootNode): void => {
    if (!foot3d) {
      // No WebGL: the on-foot parts cannot be drawn, so count them as done.
      advance();
      return;
    }
    inCampaign = true;
    footLevel = n.level.layout === 'gates' ? gatesLevel(save.campaign.helpers) : n.level;
    setMode('foot');
    foot3d.paint = paintColour(save.paint);
    ui.hudLabel.textContent = { apartment: 'Found', pump: 'Fuel cans', mall: 'Supplies', gates: 'Parts' }[footLevel.layout];
    start();
    flash(n.goal, 3200);
  };

  /** Plays whatever the campaign is at now. */
  function runNode(): void {
    const n = node();
    inCampaign = false;
    if (!n) {
      // Finished or broken: back to the start.
      save.campaign = newCampaign(save.campaign.endings);
      store.save(save);
      toMenu();
      return;
    }
    if (mode !== 'story') setMode('story');
    if (n.kind === 'scene') {
      showRoad(nextDrive());
      playScene(n.scene, n.chapter, n.place, advance);
    } else if (n.kind === 'end') {
      const c = camp()!;
      const e = ending(save.campaign.helpers, save.campaign.kindness, c);
      playScene({ bg: save.campaign.helpers >= 2 ? 'dawn' : 'camp', lines: e.lines }, undefined, e.title, () => finishStory(e.title));
    } else {
      showRoad(n.kind === 'drive' ? n : nextDrive());
      pickCamp = null;
      openRoute();
    }
  }
  function advance(): void {
    save.campaign.node++;
    save.campaign.started = true;
    store.save(save);
    runNode();
  }
  const finishStory = (title: string): void => {
    const c = camp()!;
    const helpers = save.campaign.helpers;
    if (!save.campaign.endings.includes(title)) save.campaign.endings.push(title);
    save.campaign = newCampaign(save.campaign.endings);
    save.scrap += 100;
    store.save(save);
    state = 'over';
    overReady = true;
    overAction = 'restart';
    ui.overTitle.textContent = 'The End';
    el('overFinalLabel').textContent = CAMPS[c].name;
    ui.overDist.textContent = title.replace('Ending: ', '');
    ['overL1', 'overL2', 'overL3'].forEach((id, i) => (el(id).textContent = ['Road driven', 'Survivors', 'Endings seen'][i]!));
    ui.overScore.textContent = `${routeKm(c)} km`;
    ui.overNear.textContent = String(helpers);
    ui.overCombo.textContent = `${save.campaign.endings.length} of 2`;
    ui.overBadge.hidden = true;
    ui.overEarned.textContent = '+100 scrap for the workshop';
    ui.overBest.textContent = helpers >= 2 ? '' : 'Take more survivors along for the other ending.';
    ui.btnAgain.textContent = 'Play the story again';
    show(ui.over);
  };
  const storyStatus = (): string => {
    const cp = save.campaign;
    if (!cp.started) return 'The night of the siren. Get out of Mumbai.';
    const [num, title] = chapterAt(camp(), cp.node);
    return `Continue · Chapter ${num}: ${title}${camp() ? ` · ${kmLeft()} km to go` : ''}`;
  };
  storySub = storyStatus;
  renderWallet();
  const renderStoryPick = (): void => {
    const cp = save.campaign;
    const [num, title] = chapterAt(camp(), cp.node);
    el('storyGoCond').textContent = `Chapter ${num} · ${title}`;
    el('storyGoName').textContent = cp.started ? 'Continue the story' : 'Start the story';
    el('storyGoTag').textContent = cp.started
      ? `${node()?.place ?? ''}${camp() ? `. Heading for ${CAMPS[camp()!].name}.` : '.'}`
      : 'Mumbai, 2:47 in the morning. Every phone in the building screams at once.';
    el('storyGoKm').textContent = camp() ? `${kmLeft()} km to go` : cp.endings.length ? `Endings seen: ${cp.endings.length} of 2` : 'Six chapters, three camps';
    el('storyGoBtn').textContent = cp.started ? 'Continue' : 'Play';
    el('btnStoryReset').hidden = !cp.started;
  };
  el('btnStoryGo').addEventListener('click', () => {
    sfx.unlock();
    runNode();
  });
  el('btnStoryReset').addEventListener('click', () => {
    save.campaign = newCampaign(save.campaign.endings);
    store.save(save);
    renderStoryPick();
  });

  // Map select.
  const useMap = (next: MapDef): void => {
    if (next.id === map.id) return;
    map = next;
    save.selectedMap = map.id;
    store.save(save);
    road = map;
    world.configure(vehicle, map.laneCount, map.mix);
    world.reset(newSeed());
    renderer.setMap?.(map);
    renderer.resetRun();
  };
  /** Sets up the world, 3D view and HUD for Free Run or Story Mode. */
  const setMode = (next: 'free' | 'story' | 'foot'): void => {
    if (next === mode) return;
    const wasFree = mode === 'free';
    mode = next;
    const story = mode !== 'free';
    // The road behind the on-foot view stays the Story road, so the menu looks right after.
    if (wasFree !== !story) {
      road = story ? STORY_ROAD : map;
      const v = story ? storyVehicle(save.upgrades) : vehicle;
      world.configure(v, road.laneCount, road.mix, story ? storyRules(save.upgrades) : undefined);
      world.reset(newSeed());
      renderer.setVehicle?.(v.id, story ? paintColour(save.paint) : undefined);
      renderer.setMap?.(road);
      renderer.resetRun();
      buildDents();
    }
    ui.hudFuel.hidden = mode !== 'story';
    ui.hudHp.hidden = mode !== 'foot';
    ui.dents.hidden = mode === 'foot';
    ui.hudLabel.textContent = mode === 'foot' ? 'Supplies' : 'Distance';
    ui.hudCoinDot.className = `chip-dot ${story ? 'chip-scrap' : 'chip-coin'}`;
    footIn.enabled = mode === 'foot';
    footIn.reset();
    shownMeters = shownScore = shownCoins = -1;
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
        setMode('free');
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
  const again = (): void => {
    if (!overReady) return;
    if (overAction === 'continue') advance();
    else if (overAction === 'restart') runNode();
    else start();
  };
  ui.btnAgain.addEventListener('click', again);
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
  // Tanvi's workshop: SUV upgrades, paint and the machete.
  const shop = el('workshop');
  const shopList = el('shopList');
  const renderWorkshop = (): void => {
    el('shopPoints').textContent = fmt(save.points);
    el('shopScrap').textContent = fmt(save.scrap);
    shopList.textContent = '';
    const row = (name: string, detail: string, pips: number | null, cost: { points: number; scrap: number } | null, owned: string, buy: () => void): void => {
      const r = document.createElement('div');
      r.className = 'shop-row';
      const can = cost !== null && save.points >= cost.points && save.scrap >= cost.scrap;
      r.innerHTML = `<div class="sr-text"><span class="sr-name"></span><span class="sr-detail"></span></div><span class="sr-pips"></span><button type="button" class="sr-buy"></button>`;
      r.querySelector('.sr-name')!.textContent = name;
      r.querySelector('.sr-detail')!.textContent = detail;
      const pipsEl = r.querySelector('.sr-pips')!;
      if (pips !== null) for (let i = 0; i < 3; i++) {
        const p = document.createElement('i');
        if (i < pips) p.className = 'on';
        pipsEl.appendChild(p);
      }
      const btn = r.querySelector('.sr-buy') as HTMLButtonElement;
      if (cost === null) {
        btn.textContent = owned;
        btn.disabled = true;
      } else {
        btn.innerHTML = `<span>${fmt(cost.points)} pts</span>${cost.scrap > 0 ? `<span>${fmt(cost.scrap)} scrap</span>` : ''}`;
        btn.classList.toggle('cant', !can);
        btn.addEventListener('click', () => {
          if (!can) {
            sfx.thud();
            return;
          }
          save.points -= cost.points;
          save.scrap -= cost.scrap;
          buy();
          store.save(save);
          sfx.ding(3);
          renderWorkshop();
        });
      }
      shopList.appendChild(r);
    };
    for (const u of UPGRADES) {
      const level = lvl(save.upgrades, u.id);
      const next = level < 3 ? { points: u.points[level]!, scrap: u.scrap[level]! } : null;
      row(u.name, level < 3 ? `Next: ${u.levels[level]}` : u.levels[2], level, next, 'Maxed', () => {
        save.upgrades[u.id] = level + 1;
      });
    }
    const hasMachete = save.weapons.includes('machete');
    row('Machete', 'On foot: hits twice as hard as the bat', null, hasMachete ? null : MACHETE, 'Owned', () => {
      save.weapons.push('machete');
    });
    // Paint swatches.
    const paints = el('shopPaints');
    paints.textContent = '';
    for (const p of PAINTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.background = p.colour;
      b.title = p.price > 0 && !save.weapons.includes(`paint:${p.id}`) ? `${p.name} · ${fmt(p.price)} pts` : p.name;
      b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(save.paint === p.id));
      b.classList.toggle('locked', p.price > 0 && !save.weapons.includes(`paint:${p.id}`));
      b.addEventListener('click', () => {
        const owned = p.price === 0 || save.weapons.includes(`paint:${p.id}`);
        if (!owned) {
          if (save.points < p.price) {
            sfx.thud();
            return;
          }
          save.points -= p.price;
          save.weapons.push(`paint:${p.id}`);
          sfx.ding(2);
        }
        save.paint = p.id;
        store.save(save);
        renderer.setVehicle?.('rig', paintColour(save.paint));
        renderWorkshop();
      });
      paints.appendChild(b);
    }
    el('shopPaintName').textContent = `${PAINTS.find((p) => p.id === save.paint)?.name ?? ''} · dashed colours cost points`;
  };
  function openWorkshop(): void {
    sfx.unlock();
    setMode('story');
    renderer.setVehicle?.('rig', paintColour(save.paint));
    garageOpen = true;
    renderWorkshop();
    show(shop);
  }
  el('btnShopBack').addEventListener('click', () => {
    garageOpen = false;
    const back = shopReturn;
    shopReturn = 'pick';
    if (back === 'advance') advance();
    else if (back === 'route') openRoute();
    else show(ui.storyPick);
  });

  ui.btnStory.addEventListener('click', () => {
    sfx.unlock();
    renderStoryPick();
    show(ui.storyPick);
  });
  el('btnStoryBack').addEventListener('click', () => show(ui.menu));
  el('btnStoryRoad').addEventListener('click', () => {
    inCampaign = false;
    setMode('story');
    if (road !== STORY_ROAD) {
      road = STORY_ROAD;
      renderer.setMap?.(road);
    }
    ui.hudLabel.textContent = 'Distance';
    world.configure(storyVehicle(save.upgrades), road.laneCount, road.mix, storyRules(save.upgrades));
    buildDents();
    start();
  });
  el('btnStoryShop').addEventListener('click', () => {
    shopReturn = 'pick';
    openWorkshop();
  });
  el('btnStoryShop').hidden = false;
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
    setMode('free');
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
    inCampaign = false;
    setMode('free');
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
      if (a === Action.Pause) pause();
      else if (mode === 'foot') return;
      else if (a === Action.Left) world.steer(-1);
      else if (a === Action.Right) world.steer(1);
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
      } else if (!el('workshop').hidden) {
        if (a === Action.Pause) el('btnShopBack').click();
      } else if (!el('scene').hidden) {
        if (a === Action.Confirm || a === Action.Right) nextLine();
        else if (a === Action.Pause) toMenu();
      } else if (!el('route').hidden) {
        if (a === Action.Confirm) el('btnRouteGo').click();
        else if (a === Action.Pause) toMenu();
      } else if (!ui.storyPick.hidden) {
        if (a === Action.Pause) show(ui.menu);
      } else if (a === Action.Confirm && ui.settings.hidden && ui.maps.hidden) openMaps();
    } else if (state === 'over' && overReady && a === Action.Confirm) {
      again();
    }
  };

  const updateFoot = (dt: number): void => {
    const play = state === 'play';
    foot.update(dt, play ? footIn.moveX : 0, play ? footIn.moveY : 0, play && footIn.takeAttack());
    const ev = foot.events;
    if (ev.swing) sfx.swish();
    if (ev.hits > 0) {
      sfx.whack();
      foot3d?.addShake(4);
      vibrate(15);
    }
    if (ev.kills > 0) foot3d?.popText(`+${ev.kills * 5}`, ev.hitX, ev.hitY, '#c9e08a');
    if (ev.hurt) {
      sfx.thud();
      foot3d?.hurt();
      replay(ui.flash, 'is-on');
      vibrate(40);
    }
    if (ev.loot) {
      const name = {
        scrap: `+${ev.lootAmount} scrap`, fuel: 'Fuel can!', med: 'Medkit +35', inhaler: "Lara's inhaler!",
        keys: 'SUV keys!', tools: "Tanvi's toolbox!", part: 'Generator part!',
      }[ev.loot];
      if (ev.loot === 'scrap') sfx.coin(2);
      else sfx.fuel();
      foot3d?.popText(name, ev.lootX, ev.lootY, ev.loot === 'scrap' ? '#d4d8dc' : '#ffc21a');
      if (ev.loot !== 'scrap' && ev.loot !== 'med' && foot.exitOpen) {
        flash({ apartment: 'Got them! Back to the stairs', pump: 'Enough fuel! Back to the SUV', mall: 'Got it! Back to the door', gates: 'All three! Run to the generator' }[foot.level.layout], 1900);
      }
    }
    if (ev.done && state === 'play') gameOver();
    foot.clearEvents();
  };

  const laneCenterX = (): number => (world.lanePos + 0.5) * world.roadWidth / world.laneCount;
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
    } else if (mode === 'foot' && (state === 'play' || state === 'over')) {
      updateFoot(dt);
    } else if (state === 'play' || state === 'over') {
      const slowmo = !world.alive && world.endReason === 'wreck' && world.crashT < SLOWMO_TIME;
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
      if (ev.rams > 0) {
        sfx.whack();
        renderer.burst(ev.ramX, ev.ramY);
        renderer.addShake(ev.rams > 1 ? 9 : 5);
        renderer.popText(`+${ev.rams * 5}`, ev.ramX, ev.ramY + 1, '#c9e08a', 18);
        vibrate(20);
      }
      if (ev.shot) {
        sfx.shot();
        renderer.shot?.(ev.shotX, ev.shotY);
      }
      if (ev.fuel) {
        sfx.fuel();
        renderer.popText('Fuel +40%', laneCenterX(), world.dist + 2, '#ffc21a', 20);
      }
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
          renderer.popText(mode === 'story' ? '−1 armour' : '−1 dent', ev.hitX, ev.hitY + 1, '#ff7a63', 20);
        }
        vibrate(ev.crash ? 120 : 40);
      }
      if ((ev.crash || ev.arrived) && state === 'play') {
        if (ev.arrived) {
          sfx.horn();
          flash('Made it!', 1400);
        }
        gameOver();
      }
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
      road.music,
    );
    if (mode === 'story') {
      ui.hudFuelFill.style.transform = `scaleX(${world.fuel.toFixed(3)})`;
      ui.hudFuel.classList.toggle('is-low', world.fuel < 0.22);
    }
    music.setMuffled(state === 'paused');
    music.update();
    sfx.setEngine(running || state === 'countdown', Math.min(1, renderer.speedFx + (world.throttleMul - 1) * 0.8));
    if (mode === 'foot' && foot3d && state !== 'menu') {
      sfx.setEngine(false, 0);
      foot3d.draw(alpha, state === 'paused' ? 0 : frameDt, foot.weapon);
      ui.hudHpFill.style.transform = `scaleX(${(foot.hp / foot.maxHp).toFixed(3)})`;
      ui.hudHp.classList.toggle('is-low', foot.hp < 30);
      const sup = foot.found * 1000 + foot.kills;
      if (sup !== shownMeters) {
        shownMeters = sup;
        ui.dist.textContent = `${foot.found} / ${foot.level.goal}`;
        ui.score.textContent = `Zombies ${foot.kills}`;
      }
      if (foot.scrap !== shownCoins) {
        shownCoins = foot.scrap;
        ui.hudCoins.textContent = fmt(shownCoins);
      }
      return;
    }
    const slow = state === 'over' && world.endReason === 'wreck' && world.crashT < SLOWMO_TIME ? SLOWMO_SCALE : 1;
    renderer.draw(alpha, state === 'paused' ? 0 : frameDt * slow, state === 'play', state === 'menu' ? (garageOpen ? 'garage' : 'menu') : 'game');
    const fx = Math.round(renderer.speedFx * 100) / 100;
    if (fx !== shownFx) {
      shownFx = fx;
      ui.speedfx.style.opacity = String(fx);
    }
    const meters = Math.floor(world.dist);
    if (state !== 'menu' && state !== 'over' && meters !== shownMeters) {
      shownMeters = meters;
      ui.dist.textContent = inCampaign ? `${kmLeft()} km` : formatDistance(world.dist);
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

// Offline play: the normal build registers a service worker; the one-file preview does not.
if (import.meta.env.PROD && import.meta.env.MODE !== 'single' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Offline cache unavailable', err));
  });
}
