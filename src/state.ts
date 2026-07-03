// ===== Herní stav (serializovatelný) + runtime Game objekt =====

import { VERSION } from './config';
import { RES, B, BUILDINGS, TECH_BY, Rec } from './data';
import { World } from './worldgen';

export interface BuildingInst {
  t: string; x: number; y: number;
  auto?: 1;        // postaveno organickým růstem
  d?: number;      // vzdálenost k nejbližšímu skladu (cache)
  adj?: number;    // adjacency multiplikátor (cache, počítá se při stavbě)
  lvl?: number;    // úroveň budovy (1 default, max 3): efektivita ×2/×4
  big?: 1;         // "velká budova" — sloučená 4-v-1, zabírá 2×2, +50 % výkon
  dm?: number;     // čtvrťový bonus (cache z recount)
}

/** efektivita podle úrovně budovy */
export const lvlEff = (lvl?: number) => (lvl === 3 ? 4 : lvl === 2 ? 2 : 1);

export interface Buff { kind: 'frenzy' | 'clickFrenzy' | 'festival'; mult: number; until: number; label: string; icon: string }

export interface Settings {
  sfx: number; music: number; muted: boolean;
  particles: boolean; daynight: boolean;
  lang?: string;   // 'cs'|'en'|'de'|'fr'; chybí-li, detekce z prohlížeče
}

export interface GameState {
  v: number; seed: number;
  created: number; saved: number; playtime: number;
  res: Rec;
  totals: Rec;                       // hrubá produkce za běh (skóre, achievementy)
  pop: number; popFrac: number;
  assigned: Rec;                     // typ budovy -> počet pracovníků
  buildings: BuildingInst[];
  roads: string[];
  nodeDelta: Record<string, Record<number, number>>;
  techs: string[];
  upgrades: Rec;                     // id -> level
  achs: string[];
  clicks: number;
  buffs: Buff[];
  legacy: { pts: number; perks: Rec };
  stats: { peakPop: number; goldenClicked: number; ascensions: number; lifetimeClicks: number };
  settings: Settings;
  nextFestival: number;
}

export interface Mults {
  global: number; click: number; research: number; gather: number;
  job: Rec;
  toolPower: number; haulRange: number; capacity: number;
  growth: number; hapBonus: number; housing: number;
  critChance: number; critMult: number; goldenFreq: number;
  offlineEff: number; offlineCapH: number; kinetic: number;
  autoAssign: boolean;
}

export interface GoldenCitizen { tx: number; ty: number; until: number }

export interface Game {
  s: GameState;
  world: World;
  m: Mults;
  rates: Rec;                        // vyhlazené produkce/s pro UI
  happiness: number;
  hapParts: { key: string; v: number }[];  // rozpad spokojenosti pro UI
  starving: boolean;
  frenzy: number; clickFrenzy: number;
  energy: { prod: number; use: number; throttle: number };
  capMult: number;
  bCount: Rec;                       // počet budov dle typu
  bSlots: Rec;                       // pracovní místa dle typu (vč. velkých budov)
  housingSum: number; waterSum: number;
  maxEra: number;
  runtime: {
    golden: GoldenCitizen | null;
    buildSel: string | null;
    paused: boolean;
    hint: string;
    agentsDirty: boolean;
    started: boolean;
  };
}

export function defaultSettings(): Settings {
  return { sfx: 0.7, music: 0.4, muted: false, particles: true, daynight: true };
}

export function newState(seed: number, carry?: { legacy: GameState['legacy']; achs: string[]; settings: Settings; stats: GameState['stats'] }): GameState {
  const res: Rec = {}; const totals: Rec = {};
  for (const r of RES) { res[r.id] = 0; totals[r.id] = 0; }
  res.wood = 30; res.food = 30;

  const legacy = carry?.legacy ?? { pts: 0, perks: {} };
  // perky ovlivňující start
  const her = legacy.perks.heritage || 0;
  if (her > 0) { res.wood += 200 * her; res.food += 200 * her; res.stone += 200 * her; }
  const techs: string[] = [];
  if ((legacy.perks.headStart || 0) > 0) { techs.push('stoneTools', 'basketry', 'hunting'); res.research = 100; }

  // výchozí cesty od návsi
  const roads: string[] = [];
  for (let i = 1; i <= 5; i++) { roads.push(`${i},0`); roads.push(`${-1 - i},0`); roads.push(`0,${i}`); roads.push(`0,${-1 - i}`); }

  return {
    v: VERSION, seed,
    created: Date.now(), saved: Date.now(), playtime: 0,
    res, totals,
    pop: 3 + 2 * her, popFrac: 0,
    assigned: {},
    buildings: [{ t: 'plaza', x: -1, y: -1 }],
    roads,
    nodeDelta: {},
    techs,
    upgrades: {},
    achs: carry?.achs ?? [],
    clicks: 0,
    buffs: [],
    legacy,
    stats: carry?.stats ?? { peakPop: 0, goldenClicked: 0, ascensions: 0, lifetimeClicks: 0 },
    settings: carry?.settings ?? defaultSettings(),
    nextFestival: 0,
  };
}

export function baseMults(): Mults {
  return {
    global: 1, click: 1, research: 1, gather: 1, job: {},
    toolPower: 0, haulRange: 6, capacity: 1,
    growth: 1, hapBonus: 0, housing: 1,
    critChance: 0.02, critMult: 10, goldenFreq: 1,
    offlineEff: 0.5, offlineCapH: 8, kinetic: 0,
    autoAssign: false,
  };
}

const SIZES: Record<string, number> = Object.fromEntries(BUILDINGS.map(b => [b.id, b.size]));

/** velikost instance budovy (velké 4-v-1 zabírají 2×2) */
export const instSize = (b: BuildingInst) => (b.big ? 2 : SIZES[b.t] || 1);

/** přestaví occupancy mapu (respektuje velké budovy) */
export function rebuildOccupancy(g: Game) {
  g.world.occ.clear();
  g.s.buildings.forEach((b, i) => {
    const sz = instSize(b);
    for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) g.world.occ.set(`${b.x + dx},${b.y + dy}`, i);
  });
}

/** naváže stav na Game objekt (zachovává identitu g) */
export function initGame(g: Game, s: GameState) {
  g.s = s;
  g.world = new World(s.seed, s.nodeDelta, s.roads);
  g.m = baseMults();
  g.rates = {};
  g.happiness = 0.6;
  g.hapParts = [];
  g.starving = false;
  g.frenzy = 1; g.clickFrenzy = 1;
  g.energy = { prod: 0, use: 0, throttle: 1 };
  g.capMult = 1;
  g.bCount = {};
  g.bSlots = {};
  g.housingSum = 0; g.waterSum = 0;
  g.maxEra = 0;
  g.runtime = { golden: null, buildSel: null, paused: true, hint: '', agentsDirty: true, started: false };
  recount(g);
  rebuildOccupancy(g);
}

export function recount(g: Game) {
  const c: Rec = {};
  const sl: Rec = {};
  let housing = 0, water = 0;
  for (const b of g.s.buildings) {
    c[b.t] = (c[b.t] || 0) + 1;
    const def = B[b.t];
    if (!def) continue;
    const bigMult = b.big ? 4 : 1;
    const le = lvlEff(b.lvl);
    if (def.jobs) sl[b.t] = (sl[b.t] || 0) + def.jobs * bigMult;
    if (def.housing) housing += def.housing * (b.big ? 5 : 1) * le;
    if (def.water) water += def.water * (b.big ? 5 : 1) * le;
  }
  g.bCount = c;
  g.bSlots = sl;
  g.housingSum = housing;
  g.waterSum = water;
  let era = 0;
  for (const t of g.s.techs) { const d = TECH_BY[t]; if (d && d.era > era) era = d.era; }
  g.maxEra = era;
  computeDistricts(g);
}

/** čtvrtě: ≥3 produkční budovy stejné kategorie v okruhu 4 → bonus (cache v inst.dm) */
function computeDistricts(g: Game) {
  const prod = g.s.buildings.filter(b => { const d = B[b.t]; return d && d.jobs && (d.prod || d.recipe); });
  for (const b of prod) {
    const cat = B[b.t].cat;
    let near = b.big ? 3 : 0; // velká budova reprezentuje 4 budovy — čtvrť si drží sama
    for (const o of prod) {
      if (o === b || B[o.t].cat !== cat) continue;
      if (Math.max(Math.abs(o.x - b.x), Math.abs(o.y - b.y)) <= 4) near += o.big ? 4 : 1;
    }
    const dm = near >= 5 ? 1.25 : near >= 2 ? 1.15 : undefined;
    if (dm) b.dm = dm; else delete b.dm;
  }
}

export function countB(g: Game, t: string): number { return g.bCount[t] || 0; }

export function slots(g: Game, t: string): number {
  return g.bSlots[t] || 0;
}

export function activeWorkers(g: Game, t: string): number {
  return Math.min(g.s.assigned[t] || 0, slots(g, t));
}

export function sumAssigned(s: GameState): number {
  let n = 0; for (const v of Object.values(s.assigned)) n += v;
  return n;
}

export function housingCap(g: Game): number {
  return Math.floor(g.housingSum * g.m.housing);
}

export function waterCap(g: Game): number {
  return g.waterSum;
}

export function capOf(g: Game, res: string): number {
  const def = RES.find(r => r.id === res);
  if (!def || !isFinite(def.baseCap)) return Infinity;
  return Math.floor(def.baseCap * g.capMult);
}
