import * as THREE from 'three';

/** Made-up shop names for Indian streets. No real brands. */
const INDIA_SIGNS: Array<[string, string, string, string]> = [
  // name, tagline, background, text
  ['SHANTI SWEETS', 'Pure ghee · Since 1978', '#c8281f', '#fff4d6'],
  ['RAJU MOBILES', 'Recharge · Repair · Covers', '#1f5fae', '#ffffff'],
  ['CHAI POINT', 'Cutting chai ₹10', '#f2c230', '#3a1d0e'],
  ['LAXMI HARDWARE', 'Paints · Pipes · Tools', '#2f7d4a', '#fff8e0'],
  ['NEW FASHION', 'Ladies · Gents · Kids', '#8b3fa8', '#ffe9fb'],
  ['SAI MEDICAL', '24 hours open', '#11806f', '#ffffff'],
  ['OM TRAVELS', 'Bus · Train · Air tickets', '#f07a1a', '#ffffff'],
  ['KRISHNA DAIRY', 'Milk · Curd · Paneer', '#f4f0e6', '#1f4fa0'],
  ['VADA PAV CORNER', 'Hot and fresh', '#e0412c', '#ffe14d'],
  ['GANESH ELECTRICALS', 'Fans · Lights · Wiring', '#202a44', '#ffd23a'],
  ['FRESH MART', 'Daily needs', '#4caf50', '#ffffff'],
  ['HOTEL ANNAPURNA', 'Pure veg · Family room', '#7a1f2b', '#ffe8b0'],
  ['ROYAL TAILORS', 'Suits stitched in 2 days', '#2d2d33', '#e8c36a'],
  ['METRO OPTICALS', 'Eye test free', '#e9eef2', '#c8281f'],
  ['POOJA STORES', 'Kirana · General', '#ffde59', '#7a1f2b'],
  ['JAI HIND BAKERY', 'Pav · Khari · Cakes', '#a0522d', '#fff4d6'],
];

export interface SignAtlas {
  texture: THREE.CanvasTexture;
  /** UV rectangles [u, v, w, h] for each sign. */
  cells: Array<[number, number, number, number]>;
}

/** Draws every sign into one texture, so all signs in a block share one material. */
export function createSignAtlas(): SignAtlas {
  const cols = 2;
  const rows = 8;
  const cw = 512;
  const ch = 128;
  const c = document.createElement('canvas');
  c.width = cols * cw;
  c.height = rows * ch;
  const ctx = c.getContext('2d')!;
  const cells: SignAtlas['cells'] = [];
  INDIA_SIGNS.forEach(([name, tag, bg, fg], i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, cw, ch);
    // Border and a painted stripe, like a real shop board.
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 6;
    ctx.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.arc(x + 62, y + ch / 2, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name[0]!, x + 62, y + ch / 2 + 2);
    ctx.fillStyle = fg;
    ctx.textAlign = 'left';
    let size = 46;
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(name).width > cw - 130 && size > 22) {
      size -= 2;
      ctx.font = `900 ${size}px system-ui, sans-serif`;
    }
    ctx.fillText(name, x + 112, y + 52);
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(tag, x + 114, y + 94);
    // Canvas y runs down; texture v runs up.
    cells.push([x / c.width, 1 - (y + ch) / c.height, cw / c.width, ch / c.height]);
  });
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, cells };
}
