// ===== Herní stav (serializovatelný) + runtime Game objekt =====

import { VERSION } from './config';
import { RES, B, BUILDINGS, TECH_BY, Rec } from './data';
import { World } from './worldgen';

export interface BuildingInst {
  t: string; x: number; y: number;
  auto?: 1;        // postaveno organickým růstem
  d?: number;      // vzdálenost k nejbližšímu skladu (cache)
}

export interface Buff { kind: 'frenzy' | 'clickFrenzy' | 'festival'; mult: number; until: number; label: string; icon: string }

export interface Settings {
  sfx: number; music: number;
  particles: boolean; daynight: boolean;
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
  starving: boolean;
  frenzy: number; clickFrenzy: number;
  energy: { prod: number; use: number; throttle: number };
  capMult: number;
  bCount: Rec;                       // počet budov dle typu
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
  return { sfx: 0.7, music: 0.4, particles: true, daynight: true };
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

/** naváže stav na Game objekt (zachovává identitu g) */
export function initGame(g: Game, s: GameState) {
  g.s = s;
  g.world = new World(s.seed, s.nodeDelta, s.roads);
  g.m = baseMults();
  g.rates = {};
  g.happiness = 0.6;
  g.starving = false;
  g.frenzy = 1; g.clickFrenzy = 1;
  g.energy = { prod: 0, use: 0, throttle: 1 };
  g.capMult = 1;
  g.bCount = {};
  g.maxEra = 0;
  g.runtime = { golden: null, buildSel: null, paused: true, hint: '', agentsDirty: true, started: false };
  recount(g);
  g.world.rebuildOcc(s.buildings, SIZES);
}

export function recount(g: Game) {
  const c: Rec = {};
  for (const b of g.s.buildings) c[b.t] = (c[b.t] || 0) + 1;
  g.bCount = c;
  let era = 0;
  for (const t of g.s.techs) { const d = TECH_BY[t]; if (d && d.era > era) era = d.era; }
  g.maxEra = era;
}

export function countB(g: Game, t: string): number { return g.bCount[t] || 0; }

export function slots(g: Game, t: string): number {
  const def = B[t];
  return def?.jobs ? countB(g, t) * def.jobs : 0;
}

export function activeWorkers(g: Game, t: string): number {
  return Math.min(g.s.assigned[t] || 0, slots(g, t));
}

export function sumAssigned(s: GameState): number {
  let n = 0; for (const v of Object.values(s.assigned)) n += v;
  return n;
}

export function housingCap(g: Game): number {
  let h = 0;
  for (const [t, n] of Object.entries(g.bCount)) {
    const def = B[t];
    if (def?.housing) h += def.housing * n;
  }
  return Math.floor(h * g.m.housing);
}

export function waterCap(g: Game): number {
  let w = 0;
  for (const [t, n] of Object.entries(g.bCount)) {
    const def = B[t];
    if (def?.water) w += def.water * n;
  }
  return w;
}

export function capOf(g: Game, res: string): number {
  const def = RES.find(r => r.id === res);
  if (!def || !isFinite(def.baseCap)) return Infinity;
  return Math.floor(def.baseCap * g.capMult);
}
