import { CAMPS, CAMP_ORDER, campaignNodes, type CampId, type Place } from '../data/campaign';

/** West Maharashtra and the Konkan, drawn as a flat SVG map. */
const LON0 = 72.4;
const LON1 = 76.0;
const LAT0 = 14.5;
const LAT1 = 21.4;
const W = 300;
const H = 400;

const px = ([lon, lat]: Place): [number, number] => [((lon - LON0) / (LON1 - LON0)) * W, ((LAT1 - lat) / (LAT1 - LAT0)) * H];
const pt = (p: Place): string => px(p).map((v) => v.toFixed(1)).join(',');

const COAST: Place[] = [
  [72.82, 21.4], [72.86, 20.6], [72.75, 20.0], [72.82, 19.4], [72.8, 18.95], [72.93, 18.6], [73.0, 18.1], [73.08, 17.6],
  [73.2, 17.1], [73.32, 16.6], [73.45, 16.1], [73.65, 15.7], [73.8, 15.3], [73.95, 15.0], [74.08, 14.8], [74.2, 14.5],
];
const GHATS: Place[] = [[73.62, 21.3], [73.5, 20.4], [73.48, 19.6], [73.42, 18.9], [73.4, 18.3], [73.62, 17.3], [73.85, 16.4], [74.1, 15.4], [74.3, 14.6]];
const CITIES: Array<[string, Place]> = [
  ['Mumbai', [72.87, 19.04]], ['Nashik', [73.79, 20.0]], ['Pune', [73.86, 18.52]], ['Satara', [74.0, 17.68]],
  ['Kolhapur', [74.24, 16.7]], ['Ratnagiri', [73.3, 16.99]], ['Goa', [73.83, 15.49]], ['Dhule', [74.77, 20.9]],
];
const CAMP_COLOUR: Record<CampId, string> = { north: '#ffc21a', south: '#3fd07a', coast: '#4fb0ff' };

/** The places a camp's road passes through, in order, starting in Mumbai. */
function routePoints(camp: CampId): Place[] {
  const pts: Place[] = [[72.87, 19.04]];
  for (const n of CAMPS[camp].nodes) {
    const last = pts[pts.length - 1]!;
    if (n.at[0] !== last[0] || n.at[1] !== last[1]) pts.push(n.at);
  }
  return pts;
}

/**
 * The route map. With no camp chosen it shows all three roads to pick from; with a camp it
 * shows that road, the stretch already driven, the stops, and where the SUV is now.
 */
export function routeMapSvg(camp: CampId | null, node: number, highlight: CampId | null = null): string {
  const sea = `M0,0 L${COAST.map(pt).join(' L')} L0,${H} Z`;
  let out = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Route map">
    <rect width="${W}" height="${H}" fill="#3a3a2c"/>
    <path d="${sea}" fill="#1f3a4a"/>
    <path d="M${COAST.map(pt).join(' L')}" fill="none" stroke="#7fa6b8" stroke-width="1.5"/>
    <path d="M${GHATS.map(pt).join(' L')}" fill="none" stroke="#5f6e4a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <text x="${px([73.0, 20.6])[0]}" y="${px([73.0, 20.6])[1]}" fill="#8a9a6a" font-size="9" transform="rotate(-80 ${px([73.0, 20.6]).join(' ')})" font-family="system-ui" letter-spacing="2">SAHYADRI</text>
    <text x="16" y="${H - 120}" fill="#5f8aa0" font-size="10" font-family="system-ui" letter-spacing="2" transform="rotate(-70 16 ${H - 120})">ARABIAN SEA</text>`;
  for (const [name, p] of CITIES) {
    const [x, y] = px(p);
    const dx = name === 'Mumbai' ? -44 : 5;
    out += `<circle cx="${x}" cy="${y}" r="2.2" fill="#d9d4c8"/><text x="${x + dx}" y="${y + (name === 'Mumbai' ? 14 : 3)}" fill="#d9d4c8" font-size="9" font-family="system-ui">${name}</text>`;
  }
  const camps = camp ? [camp] : CAMP_ORDER;
  for (const id of camps) {
    const pts = routePoints(id);
    const col = CAMP_COLOUR[id];
    const dim = !camp && highlight && highlight !== id;
    out += `<path d="M${pts.map(pt).join(' L')}" fill="none" stroke="${col}" stroke-width="${dim ? 2 : 3}" stroke-dasharray="${camp ? '0' : '6 4'}" stroke-linejoin="round" stroke-linecap="round" opacity="${dim ? 0.35 : 0.95}"/>`;
    const [cx, cy] = px(CAMPS[id].at);
    out += `<rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" rx="2" fill="${col}" stroke="#15161a" stroke-width="2"/>
      <text x="${cx + (id === 'north' ? -60 : 9)}" y="${cy + (id === 'north' ? -10 : 4)}" fill="${col}" font-size="11" font-weight="800" font-family="system-ui">${CAMPS[id].name}</text>`;
  }
  if (camp) {
    // Driven so far, stops, and the SUV.
    const nodes = campaignNodes(camp);
    const driven: Place[] = [[72.87, 19.04]];
    let here: Place = [72.87, 19.04];
    nodes.forEach((n, i) => {
      if (i < node) {
        here = n.at;
        const last = driven[driven.length - 1]!;
        if (n.at[0] !== last[0] || n.at[1] !== last[1]) driven.push(n.at);
      }
      if (n.kind === 'foot' || n.kind === 'garage') {
        const [x, y] = px(n.at);
        const col = n.kind === 'garage' ? '#e0602a' : n.level.layout === 'pump' ? '#c8281f' : '#2e6fb7';
        out += `<circle cx="${x}" cy="${y}" r="5" fill="${col}" stroke="#15161a" stroke-width="1.5" opacity="${i < node ? 0.5 : 1}"/>`;
      }
    });
    if (driven.length > 1) out += `<path d="M${driven.map(pt).join(' L')}" fill="none" stroke="#f7f2e7" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
    const [hx, hy] = px(here);
    out += `<circle cx="${hx}" cy="${hy}" r="11" fill="#ffc21a" opacity="0.25"><animate attributeName="r" values="8;14;8" dur="1.6s" repeatCount="indefinite"/></circle>
      <circle cx="${hx}" cy="${hy}" r="6" fill="#ffc21a" stroke="#15161a" stroke-width="2"/>`;
  } else {
    const [mx, my] = px([72.87, 19.04]);
    out += `<circle cx="${mx}" cy="${my}" r="6" fill="#ffc21a" stroke="#15161a" stroke-width="2"/>`;
  }
  return out + '</svg>';
}

export { CAMP_COLOUR };
