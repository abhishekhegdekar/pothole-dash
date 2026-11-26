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

const NY_SIGNS: Array<[string, string, string, string]> = [
  ['BIG APPLE DELI', 'Sandwiches · Coffee', '#1f4f3a', '#f4f0e6'],
  ['5TH STREET DINER', 'Open 24 hours', '#c8281f', '#ffffff'],
  ['MANNY\'S HARDWARE', 'Keys cut while you wait', '#202a44', '#ffd23a'],
  ['LUCKY NOODLE', 'Dumplings · Noodles', '#e0412c', '#ffe14d'],
  ['BROADWAY CAFE', 'Espresso · Bagels', '#3a2a20', '#f2d7a0'],
  ['EMPIRE LAUNDROMAT', 'Wash · Dry · Fold', '#3f7fd0', '#ffffff'],
  ['GOLD STAR PHARMACY', 'Open late', '#ffffff', '#1f7a44'],
  ['CORNER BAGELS', 'Fresh since 6 am', '#f2c230', '#3a1d0e'],
  ['METRO SHOES', 'Repairs · Shine', '#2d2d33', '#e8c36a'],
  ['HUDSON PIZZA', 'Slices $2', '#2f7d4a', '#ffffff'],
  ['UPTOWN BARBERS', 'Walk-ins welcome', '#7a1f2b', '#f4f0e6'],
  ['NEON NIGHTS', 'Live music tonight', '#151a33', '#ff4fb0'],
  ['QUEENS FLOWERS', 'Roses · Tulips', '#d94f9c', '#ffffff'],
  ['LIBERTY BOOKS', 'New and used', '#f4f0e6', '#202a44'],
  ['DOWNTOWN DONUTS', 'Hot glazed', '#f6a7c1', '#7a1f2b'],
  ['ATLAS ELECTRONICS', 'Phones · Repairs', '#111114', '#4fd6ff'],
];

const LONDON_SIGNS: Array<[string, string, string, string]> = [
  ['THE CROWN & ANCHOR', 'Ales · Food served', '#1f3d2e', '#e8c36a'],
  ['PRIMROSE FLORIST', 'Fresh flowers daily', '#f4f0e6', '#5a7a3a'],
  ['FISH & CHIPS', 'Takeaway', '#202a6e', '#ffffff'],
  ['KING\'S NEWSAGENT', 'Papers · Sweets', '#7a1f2b', '#f4f0e6'],
  ['THAMES CAFE', 'Full breakfast', '#2d2d33', '#f2d7a0'],
  ['THE ROYAL OAK', 'Pub · Since 1862', '#3a2a20', '#e8c36a'],
  ['MAPLE BOOKSHOP', 'Rare and second-hand', '#1f4f3a', '#f4f0e6'],
  ['SOHO TAILORS', 'Bespoke suits', '#111114', '#c9b37a'],
  ['CORNER CHEMIST', 'Prescriptions', '#ffffff', '#1f7a44'],
  ['BRICK LANE BAKERY', 'Bagels · Pies', '#a0522d', '#fff4d6'],
  ['CAMDEN RECORDS', 'Vinyl · CDs', '#d8432f', '#111114'],
  ['ALBION HARDWARE', 'Tools · Keys', '#2b4a8a', '#ffffff'],
  ['TOWER TEA ROOM', 'Scones · Cream tea', '#f6e7d2', '#7a1f2b'],
  ['RIVERSIDE LAUNDRY', 'Service washes', '#3f7fd0', '#ffffff'],
  ['THE RED LION', 'Quiz night Thursday', '#7a1f2b', '#f2d7a0'],
  ['PICCADILLY PHONES', 'Unlocking · Repairs', '#2d2d33', '#4fd6ff'],
];

export type SignSet = 'india' | 'ny' | 'london';

export interface SignAtlas {
  texture: THREE.CanvasTexture;
  /** UV rectangles [u, v, w, h] for each sign, per sign set. */
  cells: Record<SignSet, Array<[number, number, number, number]>>;
}

/** Draws every sign into one texture, so all signs in a block share one material. */
export function createSignAtlas(): SignAtlas {
  const cols = 2;
  const sets: Array<[SignSet, Array<[string, string, string, string]>]> = [['india', INDIA_SIGNS], ['ny', NY_SIGNS], ['london', LONDON_SIGNS]];
  const all = sets.flatMap(([, list]) => list);
  const rows = Math.ceil(all.length / 2);
  const cw = 512;
  const ch = 128;
  const c = document.createElement('canvas');
  c.width = cols * cw;
  c.height = rows * ch;
  const ctx = c.getContext('2d')!;
  const flat: Array<[number, number, number, number]> = [];
  all.forEach(([name, tag, bg, fg], i) => {
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
    flat.push([x / c.width, 1 - (y + ch) / c.height, cw / c.width, ch / c.height]);
  });
  const cells = {} as SignAtlas['cells'];
  let at = 0;
  for (const [id, list] of sets) {
    cells[id] = flat.slice(at, at + list.length);
    at += list.length;
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, cells };
}
