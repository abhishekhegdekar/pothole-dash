import { Rng } from '../core/rng';
import { OBSTACLES, ObstacleKind } from '../data/obstacles';
import type { VehicleDef } from '../data/vehicles';

/** Sprites are drawn once in code to offscreen canvases, then copied each frame. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Size in CSS pixels. */
  w: number;
  h: number;
}

function makeCanvas(wCss: number, hCss: number, dpr: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(wCss * dpr));
  c.height = Math.max(1, Math.ceil(hCss * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return [c, ctx];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Top-down auto-rickshaw, nose pointing up. Drawn in metres, scaled by ppm. */
export function drawAutoSprite(v: VehicleDef, ppm: number, dpr: number): Sprite {
  const pad = 0.3;
  const wM = v.width + pad * 2;
  const hM = v.length + pad * 2;
  const [c, ctx] = makeCanvas(wM * ppm, hM * ppm, dpr);
  ctx.scale(dpr * ppm, dpr * ppm);
  ctx.translate(wM / 2, hM / 2);
  const L = v.length / 2;
  const W = v.width / 2;

  // Wheels: two at the back, one at the front.
  ctx.fillStyle = '#16161a';
  roundRect(ctx, -W - 0.04, L - 0.85, 0.24, 0.52, 0.08);
  ctx.fill();
  roundRect(ctx, W - 0.2, L - 0.85, 0.24, 0.52, 0.08);
  ctx.fill();
  roundRect(ctx, -0.11, -L + 0.05, 0.22, 0.42, 0.08);
  ctx.fill();

  // Lower body: green, wide at the back and tapering to a narrow nose.
  ctx.beginPath();
  ctx.moveTo(-W + 0.08, L - 0.05);
  ctx.lineTo(W - 0.08, L - 0.05);
  ctx.quadraticCurveTo(W, L - 0.1, W, L - 0.35);
  ctx.lineTo(W - 0.05, -0.25);
  ctx.quadraticCurveTo(0.42, -L + 0.2, 0, -L + 0.12);
  ctx.quadraticCurveTo(-0.42, -L + 0.2, -W + 0.05, -0.25);
  ctx.lineTo(-W, L - 0.35);
  ctx.quadraticCurveTo(-W, L - 0.1, -W + 0.08, L - 0.05);
  ctx.closePath();
  const body = ctx.createLinearGradient(-W, 0, W, 0);
  body.addColorStop(0, '#13623a');
  body.addColorStop(0.5, '#1f8a4f');
  body.addColorStop(1, '#13623a');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = '#0b3a22';
  ctx.stroke();

  // Handlebar and headlight on the nose.
  ctx.strokeStyle = '#2a2a2e';
  ctx.lineWidth = 0.06;
  ctx.beginPath();
  ctx.moveTo(-0.32, -L + 0.55);
  ctx.lineTo(0.32, -L + 0.55);
  ctx.stroke();
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.arc(0, -L + 0.2, 0.09, 0, Math.PI * 2);
  ctx.fill();
  // Side mirrors.
  ctx.fillStyle = '#c9ccd2';
  ctx.beginPath();
  ctx.arc(-0.46, -L + 0.62, 0.07, 0, Math.PI * 2);
  ctx.arc(0.46, -L + 0.62, 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Windscreen.
  ctx.fillStyle = '#2c3f55';
  ctx.beginPath();
  ctx.moveTo(-0.5, -0.42);
  ctx.lineTo(0.5, -0.42);
  ctx.lineTo(0.58, -0.2);
  ctx.lineTo(-0.58, -0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-0.36, -0.39, 0.22, 0.06);

  // Canopy roof: saffron yellow with ribs.
  const roofTop = -0.28;
  const roofBot = L - 0.12;
  roundRect(ctx, -W + 0.02, roofTop, v.width - 0.04, roofBot - roofTop, 0.28);
  const roof = ctx.createLinearGradient(-W, roofTop, W, roofBot);
  roof.addColorStop(0, '#ffd84a');
  roof.addColorStop(0.55, '#f6b800');
  roof.addColorStop(1, '#d99a00');
  ctx.fillStyle = roof;
  ctx.fill();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = '#1b1b1f';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,70,0,0.35)';
  ctx.lineWidth = 0.035;
  for (let i = 1; i <= 4; i++) {
    const y = roofTop + ((roofBot - roofTop) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(-W + 0.12, y);
    ctx.lineTo(W - 0.12, y);
    ctx.stroke();
  }
  // Black stripe along the roof edge, and a sheen.
  ctx.fillStyle = '#1b1b1f';
  ctx.fillRect(-W + 0.1, roofBot - 0.2, v.width - 0.2, 0.08);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, -W + 0.18, roofTop + 0.12, 0.22, roofBot - roofTop - 0.5, 0.1);
  ctx.fill();

  return { canvas: c, w: wM * ppm, h: hM * ppm };
}

const POTHOLE_SEED = 7331;

/** Pre-renders every pothole variant at the current zoom. */
export function drawPotholeSprites(ppm: number, dpr: number): Sprite[][] {
  const rng = new Rng(POTHOLE_SEED);
  const out: Sprite[][] = [];
  for (const kind of [ObstacleKind.SmallPothole, ObstacleKind.LargePothole]) {
    const def = OBSTACLES[kind];
    const list: Sprite[] = [];
    for (let v = 0; v < def.variants; v++) list.push(drawPothole(def.w, def.h, ppm, dpr, rng));
    out[kind] = list;
  }
  return out;
}

function blob(ctx: CanvasRenderingContext2D, rx: number, ry: number, pts: Float32Array, oy = 0, begin = true): void {
  const n = pts.length;
  if (begin) ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) / n) * Math.PI * 2;
    const r = pts[i % n]!;
    const x = Math.cos(a) * rx * r;
    const y = Math.sin(a) * ry * r + oy;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawPothole(w: number, h: number, ppm: number, dpr: number, rng: Rng): Sprite {
  const pad = 0.4;
  const [c, ctx] = makeCanvas((w + pad * 2) * ppm, (h + pad * 2) * ppm, dpr);
  ctx.scale(dpr * ppm, dpr * ppm);
  ctx.translate(w / 2 + pad, h / 2 + pad);
  const rx = w / 2;
  const ry = h / 2;
  const n = 14;
  const pts = new Float32Array(n);
  for (let i = 0; i < n; i++) pts[i] = rng.range(0.78, 1.0);

  // Broken asphalt rim and loose gravel.
  ctx.fillStyle = '#6a6660';
  blob(ctx, rx * 1.12, ry * 1.18, pts);
  ctx.fill();
  ctx.fillStyle = '#7d776e';
  for (let i = 0; i < 18; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(1.05, 1.35);
    ctx.fillRect(Math.cos(a) * rx * r, Math.sin(a) * ry * r, rng.range(0.04, 0.1), rng.range(0.04, 0.09));
  }

  // Cracks spreading from the rim.
  ctx.strokeStyle = '#26221f';
  ctx.lineWidth = 0.035;
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, Math.PI * 2);
    let x = Math.cos(a) * rx;
    let y = Math.sin(a) * ry;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      x += Math.cos(a + rng.range(-0.6, 0.6)) * 0.14;
      y += Math.sin(a + rng.range(-0.6, 0.6)) * 0.14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // The hole: dark and deep, lit from the top.
  blob(ctx, rx, ry, pts);
  const g = ctx.createRadialGradient(0, ry * 0.25, 0.05, 0, 0, Math.max(rx, ry));
  g.addColorStop(0, '#15110e');
  g.addColorStop(0.7, '#2a231d');
  g.addColorStop(1, '#3d352c');
  ctx.fillStyle = g;
  ctx.fill();
  // Inner shadow on the upper lip.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.rect(-rx * 2, -ry * 2, rx * 4, ry * 4);
  blob(ctx, rx, ry, pts, ry * 0.35, false);
  ctx.fill('evenodd');
  ctx.restore();

  // Some potholes hold muddy water.
  if (rng.chance(0.5)) {
    ctx.fillStyle = 'rgba(120,108,84,0.55)';
    ctx.beginPath();
    ctx.ellipse(rng.range(-0.15, 0.15) * rx, ry * 0.2, rx * 0.55, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,220,230,0.35)';
    ctx.beginPath();
    ctx.ellipse(-rx * 0.15, ry * 0.08, rx * 0.18, ry * 0.08, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas: c, w: (w + pad * 2) * ppm, h: (h + pad * 2) * ppm };
}
