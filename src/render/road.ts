import { Rng } from '../core/rng';

/** Length of one cached road tile in metres. Must be a multiple of every repeating pattern (6 m). */
export const TILE_M = 24;

const ROOF_COLOURS = ['#e9a7a0', '#8fd0c8', '#f2c46d', '#c7b8e6', '#a9d18e', '#f0e2c4', '#e98c5a', '#9fc0e8'];

/**
 * Draws one tile of road plus roadside (curb, footpath, rooftops) to an offscreen canvas.
 * The tile is drawn once per resize and then scrolled, so the background costs almost nothing per frame.
 */
export function drawRoadTile(
  wCss: number,
  ppm: number,
  dpr: number,
  roadLeft: number,
  roadWidthM: number,
  laneCount: number,
  seed: number,
): HTMLCanvasElement {
  const hCss = TILE_M * ppm;
  const c = document.createElement('canvas');
  c.width = Math.ceil(wCss * dpr);
  c.height = Math.round(hCss * dpr);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.scale(dpr, dpr);
  const rng = new Rng(seed);
  const m = (v: number): number => v * ppm;
  const roadW = m(roadWidthM);
  const roadRight = roadLeft + roadW;
  const curbW = m(0.35);
  const walkW = m(1.3);

  // Ground beyond the buildings.
  ctx.fillStyle = '#b89f7e';
  ctx.fillRect(0, 0, wCss, hCss);

  // Rooftops on both sides.
  const drawSide = (x0: number, x1: number): void => {
    if (x1 - x0 < 2) return;
    let y = 0;
    while (y < TILE_M - 0.5) {
      const len = Math.min(TILE_M - y, rng.range(3.5, 7.5));
      const gap = rng.range(0.2, 0.6);
      const depthPx = x1 - x0;
      const by = m(y + gap / 2);
      const bh = m(len - gap);
      ctx.fillStyle = ROOF_COLOURS[rng.int(0, ROOF_COLOURS.length)]!;
      ctx.fillRect(x0, by, depthPx, bh);
      // Parapet edge.
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = Math.max(1, m(0.15));
      ctx.strokeRect(x0 + m(0.1), by + m(0.1), depthPx - m(0.2), bh - m(0.2));
      // Black water tanks on the roof, a common sight.
      const tanks = rng.int(0, 3);
      for (let i = 0; i < tanks; i++) {
        const tx = rng.range(x0 + m(0.8), Math.max(x0 + m(0.8), x1 - m(0.8)));
        const ty = rng.range(by + m(0.8), Math.max(by + m(0.8), by + bh - m(0.8)));
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(tx + m(0.12), ty + m(0.12), m(0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1d1e22';
        ctx.beginPath();
        ctx.arc(tx, ty, m(0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a3c42';
        ctx.lineWidth = Math.max(1, m(0.06));
        ctx.beginPath();
        ctx.arc(tx, ty, m(0.3), 0, Math.PI * 2);
        ctx.stroke();
      }
      // Stair box or AC unit.
      if (rng.chance(0.5)) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        const sw = m(rng.range(0.8, 1.4));
        ctx.fillRect(rng.range(x0, Math.max(x0, x1 - sw)), by + bh - m(1.4), sw, m(0.9));
      }
      y += len;
    }
  };
  drawSide(0, roadLeft - curbW - walkW);
  drawSide(roadRight + curbW + walkW, wCss);

  // Footpaths with paving lines.
  const walk = (x: number): void => {
    ctx.fillStyle = '#cdbb9c';
    ctx.fillRect(x, 0, walkW, hCss);
    ctx.strokeStyle = 'rgba(80,60,30,0.18)';
    ctx.lineWidth = 1;
    for (let yM = 0; yM < TILE_M; yM += 1) {
      ctx.beginPath();
      ctx.moveTo(x, m(yM));
      ctx.lineTo(x + walkW, m(yM));
      ctx.stroke();
    }
  };
  walk(roadLeft - curbW - walkW);
  walk(roadRight + curbW);

  // Trees along the footpath.
  for (const side of [0, 1]) {
    let y = rng.range(1, 5);
    while (y < TILE_M - 2) {
      const x = side === 0 ? roadLeft - curbW - walkW * 0.55 : roadRight + curbW + walkW * 0.55;
      const r = m(rng.range(1.0, 1.5));
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(x + m(0.3), m(y) + m(0.3), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f7d3a';
      ctx.beginPath();
      ctx.arc(x, m(y), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5c9e4c';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, m(y) - r * 0.25, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      y += rng.range(6, 11);
    }
  }

  // Curbs painted in black and yellow stripes.
  for (const x of [roadLeft - curbW, roadRight]) {
    for (let yM = 0; yM < TILE_M; yM += 1) {
      ctx.fillStyle = yM % 2 === 0 ? '#f4c20d' : '#1c1c1f';
      ctx.fillRect(x, m(yM), curbW, m(1) + 0.5);
    }
  }

  // Asphalt with speckle, patch repairs and oil stains.
  ctx.fillStyle = '#4b4c52';
  ctx.fillRect(roadLeft, 0, roadW, hCss);
  const speckles = Math.floor((roadW * hCss) / 140);
  for (let i = 0; i < speckles; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(roadLeft + rng.range(0, roadW), rng.range(0, hCss), 1.5, 1.5);
  }
  for (let i = 0; i < 3; i++) {
    const pw = m(rng.range(1.5, 3.5));
    const ph = m(rng.range(1.2, 3));
    ctx.fillStyle = 'rgba(25,25,30,0.28)';
    ctx.fillRect(roadLeft + rng.range(0, roadW - pw), rng.range(0, hCss - ph), pw, ph);
  }
  for (let lane = 0; lane < laneCount; lane++) {
    const cx = roadLeft + m((lane + 0.5) * (roadWidthM / laneCount));
    ctx.fillStyle = 'rgba(0,0,0,0.09)';
    ctx.fillRect(cx - m(0.85), 0, m(0.35), hCss);
    ctx.fillRect(cx + m(0.5), 0, m(0.35), hCss);
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = 'rgba(10,10,12,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx + m(rng.range(-0.3, 0.3)), rng.range(0, hCss), m(0.3), m(0.5), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Edge lines and dashed lane lines (3 m dash, 3 m gap).
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(roadLeft + m(0.15), 0, m(0.14), hCss);
  ctx.fillRect(roadRight - m(0.29), 0, m(0.14), hCss);
  ctx.fillStyle = 'rgba(240,236,224,0.85)';
  for (let lane = 1; lane < laneCount; lane++) {
    const x = roadLeft + m(lane * (roadWidthM / laneCount)) - m(0.07);
    for (let yM = 0; yM < TILE_M; yM += 6) ctx.fillRect(x, m(yM), m(0.14), m(3));
  }
  return c;
}
