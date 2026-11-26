import type { SceneBg, Speaker } from '../data/campaign';

/**
 * Flat SVG art for the story scenes: speaker portraits and the panel backgrounds.
 * Everything is drawn here as plain shapes, so it stays small and crisp on any screen.
 */

const SKIN = '#b9825a';
const SKIN_LIGHT = '#c9946a';
const HAIR = '#1e1712';

function face(skin: string, extra: string, eyes = true): string {
  return `
    <ellipse cx="50" cy="52" rx="23" ry="26" fill="${skin}"/>
    <ellipse cx="27" cy="54" rx="4" ry="6" fill="${skin}"/><ellipse cx="73" cy="54" rx="4" ry="6" fill="${skin}"/>
    ${eyes ? `<ellipse cx="41" cy="52" rx="2.6" ry="3.2" fill="${HAIR}"/><ellipse cx="59" cy="52" rx="2.6" ry="3.2" fill="${HAIR}"/>
    <path d="M35 45q6-4 11 0M54 45q6-4 11 0" stroke="${HAIR}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : ''}
    <path d="M50 55q-3 7 0 9" stroke="#8a5a3c" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${extra}`;
}

const body = (colour: string, collar = ''): string =>
  `<path d="M14 100q4-24 36-24t36 24z" fill="${colour}"/>${collar}`;

/** Portrait SVG for a speaker; survivors pick an outfit from their name. */
export function portrait(who: Speaker, name = ''): string {
  let art = '';
  switch (who) {
    case 'raj':
      art = body('#b59a62', '<path d="M40 77l10 10 10-10" fill="#8f7848"/>') + face(SKIN, `
        <path d="M27 46q0-26 23-26t23 26q-4-14-23-14t-23 14z" fill="${HAIR}"/>
        <path d="M40 64q10-5 20 0q-3 4-10 3q-7 1-10-3z" fill="${HAIR}"/>
        <path d="M44 70q6 3 12 0" stroke="#6a3a2a" stroke-width="2" fill="none" stroke-linecap="round"/>`);
      break;
    case 'tanvi':
      art = body('#2f8f88', '<path d="M38 78q12 10 24 0" stroke="#e8b04a" stroke-width="3" fill="none"/>') + face(SKIN_LIGHT, `
        <path d="M25 52q-2-32 25-32t25 32q-3-18-25-20q-22 2-25 20z" fill="${HAIR}"/>
        <circle cx="50" cy="17" r="9" fill="${HAIR}"/>
        <circle cx="50" cy="41" r="2.2" fill="#c8281f"/>
        <path d="M43 68q7 4 14 0" stroke="#8a3a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <rect x="64" y="22" width="16" height="5" rx="2" fill="#9aa2aa" transform="rotate(30 72 24)"/>`);
      break;
    case 'lara':
      art = body('#f2c230') + face(SKIN_LIGHT, `
        <path d="M28 50q-1-28 22-28t22 28q-4-16-22-17q-18 1-22 17z" fill="${HAIR}"/>
        <path d="M27 44q-12 6-10 22q6-4 9-14z M73 44q12 6 10 22q-6-4-9-14z" fill="${HAIR}"/>
        <circle cx="25" cy="44" r="3" fill="#e05a9a"/><circle cx="75" cy="44" r="3" fill="#e05a9a"/>
        <path d="M44 67q6 5 12 0" stroke="#8a3a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
      break;
    case 'kavita':
      art = body('#5f6a48', '<rect x="40" y="80" width="20" height="5" fill="#3f4a30"/><circle cx="66" cy="86" r="3" fill="#d9a520"/>') + face(SKIN, `
        <path d="M26 44q0-22 24-22t24 22z" fill="#4f5a3a"/><rect x="24" y="40" width="52" height="7" rx="3" fill="#3f4a30"/>
        <circle cx="64" cy="33" r="3.5" fill="#d9a520"/>
        <path d="M74 52q6 10-6 18" stroke="#2a2a2e" stroke-width="3" fill="none"/><circle cx="66" cy="70" r="3" fill="#2a2a2e"/>
        <path d="M43 68h14" stroke="#6a3a2a" stroke-width="2.4" stroke-linecap="round"/>`);
      break;
    case 'sheru':
      art = `
        <ellipse cx="50" cy="94" rx="30" ry="16" fill="#a8743a"/>
        <ellipse cx="50" cy="56" rx="24" ry="22" fill="#b8844a"/>
        <path d="M27 40q-10 16-2 30q8-6 8-22z M73 40q10 16 2 30q-8-6-8-22z" fill="#7a4f28"/>
        <ellipse cx="50" cy="66" rx="12" ry="9" fill="#e8c89a"/>
        <ellipse cx="50" cy="61" rx="5" ry="3.6" fill="#1e1712"/>
        <circle cx="41" cy="50" r="3.4" fill="#1e1712"/><circle cx="59" cy="50" r="3.4" fill="#1e1712"/>
        <circle cx="42" cy="49" r="1" fill="#fff"/><circle cx="60" cy="49" r="1" fill="#fff"/>
        <path d="M50 70q0 6 5 7" stroke="#e05a6a" stroke-width="3" fill="none" stroke-linecap="round"/>
        <rect x="32" y="78" width="36" height="5" rx="2" fill="#c8281f"/>`;
      break;
    case 'alert':
      art = `
        <rect x="28" y="12" width="44" height="80" rx="8" fill="#1e2026" stroke="#5a5e66" stroke-width="3"/>
        <rect x="33" y="20" width="34" height="58" rx="3" fill="#c8281f"/>
        <path d="M50 30l14 26H36z" fill="#ffc21a"/><rect x="48" y="38" width="4" height="10" fill="#1e1712"/><circle cx="50" cy="52" r="2" fill="#1e1712"/>
        <rect x="37" y="62" width="26" height="3" rx="1" fill="#f7f2e7"/><rect x="40" y="68" width="20" height="3" rx="1" fill="#f7f2e7"/>`;
      break;
    case 'narrator':
      art = '';
      break;
    default: {
      const n = name.toLowerCase();
      if (n.includes('dr')) {
        art = body('#f2efe6', '<path d="M38 78q-4 14 6 16M62 78q4 14-6 16" stroke="#3d3f44" stroke-width="2.5" fill="none"/><circle cx="50" cy="94" r="3" fill="#9aa2aa"/>') + face(SKIN_LIGHT, `
          <path d="M26 54q-2-32 24-32t24 32q-2-18-24-20q-22 2-24 20z" fill="#3a2a22"/>
          <rect x="35" y="47" width="12" height="9" rx="3" fill="none" stroke="#2a2a2e" stroke-width="2"/><rect x="53" y="47" width="12" height="9" rx="3" fill="none" stroke="#2a2a2e" stroke-width="2"/>
          <path d="M44 68q6 3 12 0" stroke="#8a3a3a" stroke-width="2" fill="none"/>`);
      } else if (n.includes('sergeant')) {
        art = body('#5f6a48') + face(SKIN, `
          <path d="M24 48q0-28 26-28t26 28z" fill="#4f5a3a"/><rect x="22" y="44" width="56" height="6" rx="3" fill="#3f4a30"/>
          <path d="M40 64q10-4 20 0" stroke="${HAIR}" stroke-width="4" fill="none"/>`);
      } else if (n.includes('sister')) {
        art = body('#e8e4d8') + `<path d="M20 100q-2-80 30-80t30 80z" fill="#2a3e6a"/>` + face(SKIN_LIGHT, `
          <path d="M28 40q22-10 44 0v4q-22-8-44 0z" fill="#f2efe6"/>
          <path d="M44 68q6 3 12 0" stroke="#8a3a3a" stroke-width="2" fill="none"/>`);
      } else if (n.includes('ganpat')) {
        art = body('#3f7fd0', '<path d="M40 78l10 8 10-8" fill="#e8e4d8"/>') + face('#a87250', `
          <path d="M26 42q24-14 48 0q-4-20-24-20t-24 20z" fill="#e8e4d8"/>
          <path d="M38 62q12-6 24 0q-4 10-12 10t-12-10z" fill="#d9d4cc"/>`);
      } else if (n.includes('pinto')) {
        art = body('#3d5872') + face(SKIN_LIGHT, `
          <path d="M28 44q0-22 22-22t22 22q-6-10-22-10t-22 10z" fill="#5a4a3a"/>
          <path d="M42 64q8-4 16 0" stroke="#5a4a3a" stroke-width="4" fill="none"/>`);
      } else {
        art = body('#8a4a3a', '<path d="M40 78l10 8 10-8" fill="#6a3a2a"/>') + face(SKIN, `
          <path d="M26 44q0-24 24-24t24 24q-2-10-24-12q-22 2-24 12z" fill="${HAIR}"/>
          <rect x="26" y="30" width="48" height="10" rx="4" fill="#d9a520"/>
          <path d="M40 64q10-5 20 0" stroke="${HAIR}" stroke-width="4" fill="none"/>`);
      }
    }
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${art}</svg>`;
}

export const SPEAKER_NAMES: Record<Speaker, string> = {
  narrator: '',
  raj: 'Raj',
  tanvi: 'Tanvi',
  lara: 'Lara',
  kavita: 'Major Kavita · radio',
  alert: 'Phone alert',
  sheru: 'Sheru',
  survivor: '',
};

/** Deterministic pseudo-random numbers for the art. */
function rand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function skyline(r: () => number, base: number, colour: string, lit: number, tall = 1): string {
  let x = -10;
  let out = '';
  while (x < 410) {
    const w = 22 + r() * 40;
    const h = (40 + r() * 110) * tall;
    out += `<rect x="${x.toFixed(0)}" y="${(base - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${colour}"/>`;
    for (let wy = base - h + 8; wy < base - 8; wy += 12) {
      for (let wx = x + 5; wx < x + w - 6; wx += 9) {
        if (r() < lit) out += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="4" height="6" fill="#ffd98a" opacity="0.85"/>`;
      }
    }
    x += w + 2;
  }
  return out;
}

function hills(r: () => number, base: number, colour: string, amp: number): string {
  let d = `M-10 ${base}`;
  for (let x = -10; x <= 410; x += 40) d += ` L${x} ${(base - amp * (0.4 + r() * 0.6)).toFixed(0)}`;
  return `<path d="${d} L410 ${base + 200} L-10 ${base + 200}z" fill="${colour}"/>`;
}

/** Background art for a scene panel. 400 × 300, anchored to the bottom. */
export function sceneArt(bg: SceneBg): string {
  const r = rand(bg.length * 977 + bg.charCodeAt(0));
  let sky = '';
  let art = '';
  switch (bg) {
    case 'night':
      sky = '#1a1024,#4a1a2a';
      art = `<circle cx="320" cy="60" r="22" fill="#f2e6c8" opacity="0.8"/>` + skyline(r, 300, '#140c14', 0.2, 1.3) +
        `<rect x="0" y="230" width="400" height="8" fill="#c8281f" opacity="0.5"/>` +
        Array.from({ length: 5 }, (_, i) => `<circle cx="${40 + i * 80}" cy="${200 + (i % 2) * 20}" r="5" fill="${i % 2 ? '#ff3a2a' : '#3a8aff'}" opacity="0.9"/>`).join('');
      break;
    case 'building':
    case 'garage':
      sky = bg === 'garage' ? '#1e2026,#3a3d44' : '#2a2428,#4a3a3a';
      art = `<rect x="0" y="200" width="400" height="100" fill="#2a2a2e"/>` +
        Array.from({ length: 5 }, (_, i) => `<rect x="${i * 90}" y="40" width="22" height="200" fill="#4a4a50"/>`).join('') +
        `<rect x="0" y="36" width="400" height="10" fill="#55555c"/><rect x="150" y="50" width="100" height="6" fill="#dfe6ff" opacity="0.7"/>` +
        `<path d="M110 250q10-40 60-44h70q40 4 54 44z" fill="#5f6a48"/><rect x="100" y="240" width="200" height="30" rx="8" fill="#4f5a3a"/>` +
        `<circle cx="140" cy="272" r="16" fill="#18181b"/><circle cx="262" cy="272" r="16" fill="#18181b"/>` +
        `<rect x="186" y="212" width="40" height="22" rx="3" fill="#2a3e52"/><circle cx="110" cy="250" r="6" fill="#fff3c4"/>`;
      break;
    case 'radio':
      sky = '#0f1116,#1e2430';
      art = `<rect x="0" y="180" width="400" height="120" fill="#232327"/><rect x="0" y="176" width="400" height="8" fill="#3a3a40"/>` +
        `<rect x="140" y="200" width="120" height="44" rx="6" fill="#111"/><rect x="150" y="210" width="70" height="18" rx="2" fill="#3fd07a" opacity="0.8"/>` +
        `<circle cx="238" cy="222" r="9" fill="#5a5e66"/><path d="M60 300q10-90 80-100" stroke="#1c1c1f" stroke-width="18" fill="none"/>` +
        `<rect x="0" y="0" width="400" height="160" fill="#2a3e52" opacity="0.35"/>` + hills(r, 160, '#0f141c', 30);
      break;
    case 'toll':
      sky = '#2a2a3a,#6a4a5a';
      art = hills(r, 220, '#2a2838', 40) + `<rect x="0" y="220" width="400" height="80" fill="#3c3d42"/>` +
        `<rect x="20" y="120" width="360" height="22" fill="#d8d2c4"/>` +
        Array.from({ length: 4 }, (_, i) => `<rect x="${40 + i * 95}" y="142" width="40" height="80" fill="#c9c1ad"/><rect x="${46 + i * 95}" y="156" width="28" height="22" fill="#2a3e52"/><rect x="${80 + i * 95}" y="196" width="50" height="6" fill="${i % 2 ? '#c8281f' : '#f7f2e7'}" transform="rotate(-60 ${80 + i * 95} 199)"/>`).join('');
      break;
    case 'road':
      sky = '#6a5a6a,#d9a088';
      art = hills(r, 200, '#5a5048', 50) + `<path d="M150 200h100l150 100H0z" fill="#3c3d42"/>` +
        `<path d="M198 205h4l8 95h-20z" fill="#e8e4d8" opacity="0.7"/>` +
        `<rect x="40" y="170" width="70" height="34" fill="#7a5a4a"/><rect x="36" y="166" width="78" height="8" fill="#9aa0a6"/>` +
        `<rect x="290" y="176" width="80" height="30" rx="4" fill="#8a6a2a"/><circle cx="305" cy="208" r="8" fill="#18181b"/><circle cx="355" cy="208" r="8" fill="#18181b"/>`;
      break;
    case 'ghat':
      sky = '#8a9aa6,#c9d2d8';
      art = hills(r, 150, '#6a7a6a', 60) + hills(r, 190, '#4f6a4a', 70) +
        `<rect x="0" y="150" width="400" height="40" fill="#e8eef2" opacity="0.55"/>` + hills(r, 240, '#3f5a3a', 50) +
        `<path d="M0 260q200-30 400 0v40H0z" fill="#3c3d42"/>` +
        Array.from({ length: 10 }, (_, i) => `<rect x="${i * 42}" y="248" width="20" height="10" fill="${i % 2 ? '#1c1c1f' : '#e8e4d8'}"/>`).join('');
      break;
    case 'pump':
      sky = '#1a2030,#3a4050';
      art = `<rect x="0" y="230" width="400" height="70" fill="#3c3d42"/><rect x="40" y="110" width="320" height="16" fill="#e6e2da"/>` +
        `<rect x="44" y="126" width="312" height="4" fill="#f4f8ff" opacity="0.8"/>` +
        [90, 200, 310].map((x) => `<rect x="${x - 4}" y="130" width="8" height="100" fill="#c9c1ad"/><rect x="${x - 14}" y="180" width="28" height="50" fill="#e6e2da"/><rect x="${x - 14}" y="180" width="28" height="10" fill="#2f7a4a"/>`).join('');
      break;
    case 'camp':
      sky = '#0f1420,#2a2a3a';
      art = hills(r, 200, '#141a24', 40) + `<rect x="0" y="210" width="400" height="90" fill="#4c4232"/>` +
        `<rect x="60" y="90" width="30" height="130" fill="#5a5448"/><rect x="310" y="90" width="30" height="130" fill="#5a5448"/>` +
        `<rect x="50" y="82" width="50" height="12" fill="#3a3630"/><rect x="300" y="82" width="50" height="12" fill="#3a3630"/>` +
        `<rect x="90" y="140" width="220" height="80" fill="#5a6a56"/>` +
        Array.from({ length: 22 }, (_, i) => `<rect x="${94 + i * 10}" y="140" width="3" height="80" fill="#3e4a3c"/>`).join('') +
        Array.from({ length: 14 }, () => `<ellipse cx="${(r() * 400).toFixed(0)}" cy="${(232 + r() * 30).toFixed(0)}" rx="7" ry="16" fill="#26221c"/>`).join('');
      break;
    case 'dawn':
      sky = '#e0a088,#f2d0a0';
      art = `<circle cx="200" cy="200" r="40" fill="#ffd27a"/>` + hills(r, 220, '#7a6a5a', 40) + `<rect x="0" y="230" width="400" height="70" fill="#5a5048"/>`;
      break;
  }
  const [a, b] = sky.split(',');
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#sk)"/>${art}</svg>`;
}
