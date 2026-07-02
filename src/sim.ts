// ===== Ekonomická simulace (headless, deterministická) =====
// Agregovaný výpočet — O(druhy budov), ne O(lidé). Viz docs/03-people-and-work.md.

import { clamp, lerp, bus, key, hash2 } from './util';
import { B_WATER, B_MOUNTAIN } from './config';
import {
  RES, B, BUILDINGS, TECHS, TECH_BY, UPGRADES, UPG_BY, ACHS, ACH_BONUS,
  PERKS, PERK_BY, NODE_DEFS, Rec,
} from './data';
import {
  Game, GameState, baseMults, newState, initGame, recount,
  countB, slots, activeWorkers, sumAssigned, housingCap, waterCap, capOf,
} from './state';
import { NodeInst } from './worldgen';

// ---------- multiplikátory (cache, přepočet při změně techů/upgradů/achů/perků) ----------
export function recomputeMults(g: Game) {
  const m = baseMults();
  const s = g.s;

  for (const tid of s.techs) {
    const t = TECH_BY[tid]; if (!t) continue;
    const fx = t.fx;
    if (fx.gather) m.gather *= fx.gather;
    if (fx.click) m.click *= fx.click;
    if (fx.research) m.research *= fx.research;
    if (fx.global) m.global *= fx.global;
    if (fx.haul) m.haulRange += fx.haul;
    if (fx.hap) m.hapBonus += fx.hap;
    if (fx.growth) m.growth *= fx.growth;
    if (fx.toolPower && fx.toolPower > m.toolPower) m.toolPower = fx.toolPower;
    if (fx.job) for (const [k, v] of Object.entries(fx.job)) m.job[k] = (m.job[k] || 1) * v;
  }

  for (const [uid, lvl] of Object.entries(s.upgrades)) {
    const u = UPG_BY[uid]; if (!u || !lvl) continue;
    const fx = u.fx;
    for (let i = 0; i < lvl; i++) {
      if (fx.click) m.click *= fx.click;
      if (fx.capacity) m.capacity *= fx.capacity;
      if (fx.research) m.research *= fx.research;
      if (fx.hap) m.hapBonus += fx.hap;
      if (fx.housing) m.housing *= fx.housing;
      if (fx.growth) m.growth *= fx.growth;
      if (fx.haulX) m.haulRange *= fx.haulX;
      if (fx.critChance) m.critChance += fx.critChance;
      if (fx.goldenFreq) m.goldenFreq *= fx.goldenFreq;
      if (fx.kinetic) m.kinetic += fx.kinetic;
      if (fx.job) for (const [k, v] of Object.entries(fx.job)) m.job[k] = (m.job[k] || 1) * v;
    }
    if (fx.special === 'autoAssign') m.autoAssign = true;
    if (fx.special === 'sciPerTech') m.research *= 1 + 0.005 * s.techs.length;
  }

  // achievementy: +2 % globální produkce každý
  m.global *= 1 + ACH_BONUS * s.achs.length;

  // legacy perky
  const p = s.legacy.perks;
  if (p.prosperity) m.global *= Math.pow(1.25, p.prosperity);
  if (p.firmHand) m.click *= Math.pow(1.6, p.firmHand);
  if (p.wisdom) m.research *= Math.pow(1.3, p.wisdom);
  if (p.eternalFlame) { m.offlineEff = Math.min(1.2, m.offlineEff + 0.15 * p.eternalFlame); m.offlineCapH += 4 * p.eternalFlame; }

  // nádraží přidává dosah dopravy
  m.haulRange += 15 * countB(g, 'trainStation');

  g.m = m;
}

export const hasTech = (s: GameState, id: string) => s.techs.includes(id);

// ---------- pomocné ----------
function toolMult(g: Game): number {
  const cov = Math.min(1, (g.s.res.tools || 0) / Math.max(1, g.s.pop * 0.5));
  return 1 + g.m.toolPower * cov;
}

function haulEffOf(d: number, range: number): number {
  return 1 / (1 + Math.max(0, d - 2) / range);
}

/** průměrná dopravní efektivita budov daného typu */
function haulEff(g: Game, t: string): number {
  let sum = 0, n = 0;
  for (const b of g.s.buildings) {
    if (b.t !== t) continue;
    sum += haulEffOf(b.d ?? 0, g.m.haulRange); n++;
  }
  return n ? sum / n : 1;
}

function computeHaulDist(g: Game, b: { x: number; y: number }): number {
  let best = Math.max(Math.abs(b.x + 1), Math.abs(b.y + 1)); // náves na (-1,-1)
  for (const o of g.s.buildings) {
    if (o.t !== 'storehouse') continue;
    const d = Math.max(Math.abs(b.x - o.x), Math.abs(b.y - o.y));
    if (d < best) best = d;
  }
  return best;
}

function recomputeAllHaul(g: Game) {
  for (const b of g.s.buildings) {
    const def = B[b.t];
    if (def?.jobs && !def.noHaul) b.d = computeHaulDist(g, b);
  }
}

// ---------- hlavní tick ----------
export function tick(g: Game, dt: number) {
  const s = g.s;
  s.playtime += dt * 1000;

  // buffy
  const now = Date.now();
  if (s.buffs.length) s.buffs = s.buffs.filter(b => b.until > now);
  let frenzy = 1, cFrenzy = 1, festHap = 0;
  for (const b of s.buffs) {
    if (b.kind === 'frenzy') frenzy *= b.mult;
    else if (b.kind === 'clickFrenzy') cFrenzy *= b.mult;
    else if (b.kind === 'festival') festHap += 0.2;
  }
  g.frenzy = frenzy; g.clickFrenzy = cFrenzy;

  const m = g.m;
  g.capMult = (1 + 0.75 * countB(g, 'storehouse')) * m.capacity;

  const delta: Rec = {};
  const avail = (r: string) => (s.res[r] || 0) + (delta[r] || 0);
  const add = (r: string, v: number) => { delta[r] = (delta[r] || 0) + v; };

  // spokojenost (levné, počítá se každý tick)
  computeHappiness(g, festHap);
  const prodF = (0.5 + 0.5 * g.happiness) * frenzy * m.global;

  // --- energie (elektrárny první, továrny podle throttle) ---
  const fusion = hasTech(s, 'fusion');
  let eProd = 0;
  {
    const def = B.powerPlant;
    const n = activeWorkers(g, 'powerPlant');
    if (n > 0) {
      let ratio = 1;
      if (!fusion && def.fuel) {
        const want = n * def.fuel.rate * dt;
        ratio = want > 0 ? clamp(avail(def.fuel.res) / want, 0, 1) : 1;
        add(def.fuel.res, -want * ratio);
      }
      eProd = n * (def.energyOut || 0) * (fusion ? 10 : 1) * ratio;
    }
  }
  let eUse = 0;
  for (const def of BUILDINGS) if (def.energyUse) eUse += activeWorkers(g, def.id) * def.energyUse;
  const throttle = eUse > 0 ? Math.min(1, eProd / eUse) : 1;
  g.energy = { prod: eProd, use: eUse, throttle };

  // --- produkce a recepty ---
  const tMult = toolMult(g);
  for (const def of BUILDINGS) {
    if (!def.jobs || def.id === 'powerPlant') continue;
    const n = activeWorkers(g, def.id);
    if (!n) continue;

    let mult = (m.job[def.id] || 1) * prodF;
    if (def.raw) mult *= m.gather * tMult;
    if (!def.noHaul) mult *= haulEff(g, def.id);
    if (def.energyUse) mult *= throttle;

    if (def.prod) {
      let rate = def.prod.rate;
      if (def.prod.res === 'research') rate *= m.research;
      add(def.prod.res, n * rate * mult * dt);
    } else if (def.recipe) {
      // vstupy limitují výrobu
      let ratio = 1;
      for (const [r, rate] of Object.entries(def.recipe.inputs)) {
        const want = n * rate * mult * dt;
        if (want > 0) ratio = Math.min(ratio, clamp(avail(r) / want, 0, 1));
      }
      if (ratio > 0) {
        for (const [r, rate] of Object.entries(def.recipe.inputs)) add(r, -n * rate * mult * dt * ratio);
        for (const [r, rate] of Object.entries(def.recipe.outputs)) {
          let v = n * rate * mult * dt * ratio;
          if (r === 'research') v *= m.research;
          add(r, v);
        }
      }
    }
  }

  // --- spotřeba jídla, opotřebení nástrojů ---
  const eat = s.pop * 0.08 * dt;
  const foodAvail = avail('food');
  g.starving = foodAvail < eat;
  add('food', -Math.min(eat, Math.max(0, foodAvail)));
  const working = sumAssigned(s);
  if (working > 0 && (s.res.tools || 0) > 0) add('tools', -working * 0.0006 * dt);

  // --- aplikace delty s limity skladů ---
  for (const [r, v] of Object.entries(delta)) {
    if (v > 0) s.totals[r] = (s.totals[r] || 0) + v;
    const cap = capOf(g, r);
    s.res[r] = clamp((s.res[r] || 0) + v, 0, cap);
    // vyhlazený rate pro UI
    g.rates[r] = lerp(g.rates[r] || 0, v / dt, 0.12);
  }
  for (const r of Object.keys(g.rates)) if (!(r in delta)) g.rates[r] = lerp(g.rates[r], 0, 0.12);

  // --- růst populace ---
  const housing = housingCap(g);
  if (s.pop < housing && g.happiness > 0.55 && (s.res.food || 0) > 1) {
    s.popFrac += 0.016 * Math.sqrt(s.pop + 1) * g.happiness * m.growth * dt;
  } else if ((g.starving || g.happiness < 0.25) && s.pop > 3) {
    s.popFrac -= 0.012 * Math.sqrt(s.pop) * dt;
  }
  if (s.popFrac >= 1) {
    const k = Math.floor(s.popFrac);
    s.pop = Math.min(housing, s.pop + k); s.popFrac -= k;
    if (s.pop > s.stats.peakPop) s.stats.peakPop = s.pop;
    bus.emit('pop', { pop: s.pop });
    g.runtime.agentsDirty = true;
  } else if (s.popFrac <= -1) {
    s.pop -= 1; s.popFrac += 1;
    clampAssignments(g);
    bus.emit('popDown', { pop: s.pop });
  }
}

function computeHappiness(g: Game, festHap: number) {
  const s = g.s;
  let h = 0.45;
  h += (s.res.food || 0) > 1 ? 0.12 : (g.starving ? -0.3 : 0);
  const water = waterCap(g);
  h += 0.13 * Math.min(1, water / Math.max(1, s.pop));
  const housing = housingCap(g);
  const crowd = housing > 0 ? s.pop / housing : 2;
  if (crowd < 0.95) h += 0.05; else if (crowd >= 1) h -= 0.05;
  for (const [t, n] of Object.entries(g.bCount)) {
    const def = B[t];
    if (def?.hap) h += def.hap * Math.min(n, 3);
  }
  h += g.m.hapBonus + festHap;
  g.happiness = clamp(h, 0.05, 1);
}

function clampAssignments(g: Game) {
  const s = g.s;
  let total = sumAssigned(s);
  const kinds = Object.keys(s.assigned);
  let i = 0;
  while (total > s.pop && kinds.length) {
    const k = kinds[i % kinds.length];
    if ((s.assigned[k] || 0) > 0) { s.assigned[k]--; total--; }
    i++;
    if (i > 10000) break;
  }
}

// ---------- pomalý tick (1 s) ----------
let organicTimer = 0, saveTimer = 0;
export function slowTick(g: Game, seconds: number, rand: () => number) {
  const s = g.s;
  g.world.regen(seconds);

  // organický růst města
  organicTimer += seconds;
  if (organicTimer >= 4) {
    organicTimer = 0;
    organicGrowth(g, rand);
  }

  // zlatý občan
  if (!g.runtime.golden && rand() < (seconds / 180) * g.m.goldenFreq) spawnGolden(g, rand);
  if (g.runtime.golden && g.runtime.golden.until < Date.now()) g.runtime.golden = null;

  // festival
  if (countB(g, 'temple') > 0) {
    const now = Date.now();
    if (s.nextFestival === 0) s.nextFestival = now + 240000;
    else if (now >= s.nextFestival) {
      s.nextFestival = now + (360 + rand() * 240) * 1000;
      s.buffs.push({ kind: 'festival', mult: 1, until: now + 45000, label: 'Festival', icon: '🎉' });
      bus.emit('festival');
    }
  }

  // auto-přiřazení (Předák)
  if (g.m.autoAssign) autoAssign(g);

  // achievementy
  for (const a of ACHS) {
    if (s.achs.includes(a.id)) continue;
    try {
      if (a.cond(g)) {
        s.achs.push(a.id);
        recomputeMults(g);
        bus.emit('ach', a);
      }
    } catch { /* podmínka nesmí shodit hru */ }
  }
}

function autoAssign(g: Game) {
  const s = g.s;
  let idle = s.pop - sumAssigned(s);
  if (idle <= 0) return;
  // priorita: jídlo pokud deficit, pak věda, pak cokoli volného
  const deficit = (g.rates.food || 0) < s.pop * 0.08 * 1.15;
  const order = [...BUILDINGS].filter(b => b.jobs).sort((a, b) => {
    const pa = (deficit && a.prod?.res === 'food') ? 0 : a.prod?.res === 'research' ? 1 : 2;
    const pb = (deficit && b.prod?.res === 'food') ? 0 : b.prod?.res === 'research' ? 1 : 2;
    return pa - pb;
  });
  for (const def of order) {
    if (idle <= 0) break;
    const free = slots(g, def.id) - (s.assigned[def.id] || 0);
    if (free > 0) {
      const take = Math.min(free, idle);
      s.assigned[def.id] = (s.assigned[def.id] || 0) + take;
      idle -= take;
      g.runtime.agentsDirty = true;
    }
  }
}

// ---------- organický růst ----------
function organicGrowth(g: Game, rand: () => number) {
  const s = g.s;
  const housing = housingCap(g);
  // město si samo přistavuje chatrče, když dochází bydlení
  if (housing - s.pop < 4) {
    const cost = buildCost(g, 'hut');
    if (canAfford(g, cost)) {
      const spot = findAutoSpot(g, rand);
      if (spot) {
        pay(g, cost);
        placeBuilding(g, 'hut', spot[0], spot[1], true);
        bus.emit('built', { t: 'hut', x: spot[0], y: spot[1], auto: true });
        return;
      }
    }
  }
  // občas protáhni cestu — město "dýchá" do krajiny
  if (rand() < 0.35) extendRoad(g, rand);
}

function findAutoSpot(g: Game, rand: () => number): [number, number] | null {
  const roads = [...g.world.roads];
  if (!roads.length) return null;
  for (let i = 0; i < 25; i++) {
    const rk = roads[Math.floor(rand() * roads.length)];
    const [rx, ry] = rk.split(',').map(Number);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const start = Math.floor(rand() * 4);
    for (let j = 0; j < 4; j++) {
      const [dx, dy] = dirs[(start + j) % 4];
      const tx = rx + dx, ty = ry + dy;
      if (Math.hypot(tx, ty) > 60) continue;   // drž kompaktnost
      if (g.world.buildable(tx, ty)) return [tx, ty];
    }
  }
  extendRoad(g, rand);
  return null;
}

function extendRoad(g: Game, rand: () => number) {
  const roads = [...g.world.roads];
  if (!roads.length) return;
  for (let i = 0; i < 12; i++) {
    const rk = roads[Math.floor(rand() * roads.length)];
    const [rx, ry] = rk.split(',').map(Number);
    // nezahušťuj: max 2 sousední cesty
    let neigh = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.world.roads.has(key(rx + dx, ry + dy))) neigh++;
    if (neigh > 2) continue;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [dx, dy] = dirs[Math.floor(rand() * 4)];
    const len = 3 + Math.floor(rand() * 4);
    let placed = 0;
    for (let stp = 1; stp <= len; stp++) {
      const tx = rx + dx * stp, ty = ry + dy * stp;
      if (Math.hypot(tx, ty) > 70) break;
      const kk = key(tx, ty);
      if (g.world.roads.has(kk)) break;
      const b = g.world.biomeAt(tx, ty);
      if (b === B_WATER || b === B_MOUNTAIN) break;
      if (g.world.occ.has(kk) || g.world.nodeAt(tx, ty)) break;
      g.world.roads.add(kk);
      placed++;
    }
    if (placed > 0) { syncRoads(g); return; }
  }
}

function syncRoads(g: Game) { g.s.roads = [...g.world.roads]; }

/** po postavení budovy ji napoj cestou na síť (L-tvar) */
function autoConnectRoad(g: Game, bx: number, by: number) {
  // už je u cesty?
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.world.roads.has(key(bx + dx, by + dy))) return;
  // najdi nejbližší cestu do 14 dlaždic
  let best: [number, number] | null = null, bd = 15;
  for (const rk of g.world.roads) {
    const [rx, ry] = rk.split(',').map(Number);
    const d = Math.abs(rx - bx) + Math.abs(ry - by);
    if (d < bd) { bd = d; best = [rx, ry]; }
  }
  if (!best) return;
  // L-cesta: nejdřív x, pak y
  let cx = bx, cy = by;
  const stepTo = (tx: number, ty: number) => {
    while (cx !== tx) {
      cx += Math.sign(tx - cx);
      tryRoad(g, cx, cy);
    }
    while (cy !== ty) {
      cy += Math.sign(ty - cy);
      tryRoad(g, cx, cy);
    }
  };
  stepTo(best[0], best[1]);
  syncRoads(g);
}

function tryRoad(g: Game, tx: number, ty: number) {
  const kk = key(tx, ty);
  if (g.world.roads.has(kk) || g.world.occ.has(kk) || g.world.nodeAt(tx, ty)) return;
  const b = g.world.biomeAt(tx, ty);
  if (b === B_WATER || b === B_MOUNTAIN) return;
  g.world.roads.add(kk);
}

// ---------- akce hráče ----------
export function buildCost(g: Game, t: string): Rec {
  const def = B[t];
  const n = countB(g, t);
  const out: Rec = {};
  for (const [r, v] of Object.entries(def.cost)) out[r] = Math.floor(v * Math.pow(1.12, n));
  return out;
}

export function canAfford(g: Game, cost: Rec): boolean {
  for (const [r, v] of Object.entries(cost)) if ((g.s.res[r] || 0) < v) return false;
  return true;
}

export function pay(g: Game, cost: Rec) {
  for (const [r, v] of Object.entries(cost)) g.s.res[r] = (g.s.res[r] || 0) - v;
}

function placeBuilding(g: Game, t: string, tx: number, ty: number, auto: boolean) {
  const def = B[t];
  const inst = auto ? { t, x: tx, y: ty, auto: 1 as const } : { t, x: tx, y: ty };
  g.s.buildings.push(inst);
  const idx = g.s.buildings.length - 1;
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) g.world.occ.set(key(tx + dx, ty + dy), idx);
  recount(g);
  if (def.jobs && !def.noHaul) (inst as any).d = computeHaulDist(g, inst);
  if (t === 'storehouse') recomputeAllHaul(g);
  if (t === 'trainStation') recomputeMults(g);
  autoConnectRoad(g, tx, ty);
  g.runtime.agentsDirty = true;
}

/** pokus o stavbu hráčem; vrací chybovou hlášku nebo null při úspěchu */
export function tryBuild(g: Game, t: string, tx: number, ty: number): string | null {
  const def = B[t];
  if (!def || def.unbuildable) return 'Tuto budovu nelze postavit.';
  if (def.tech && !hasTech(g.s, def.tech)) return 'Chybí technologie.';
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) {
    if (!g.world.buildable(tx + dx, ty + dy)) return 'Tady stavět nejde.';
  }
  const cost = buildCost(g, t);
  if (!canAfford(g, cost)) return 'Nedostatek surovin.';
  pay(g, cost);
  placeBuilding(g, t, tx, ty, false);
  bus.emit('built', { t, x: tx, y: ty });
  return null;
}

export function setAssign(g: Game, t: string, n: number) {
  const s = g.s;
  const cur = s.assigned[t] || 0;
  n = clamp(Math.round(n), 0, slots(g, t));
  const others = sumAssigned(s) - cur;
  n = Math.min(n, s.pop - others);
  s.assigned[t] = Math.max(0, n);
  g.runtime.agentsDirty = true;
}

// ---------- klik na uzel ----------
export function gather(g: Game, node: NodeInst): { amt: number; crit: boolean; res: string } | null {
  if (node.stock <= 0) return null;
  const s = g.s;
  const def = NODE_DEFS[node.kind];
  const m = g.m;
  let amt = m.click * (1 + m.toolPower * Math.min(1, (s.res.tools || 0) / Math.max(1, s.pop * 0.5))) * g.frenzy * g.clickFrenzy;
  const crit = Math.random() < m.critChance;
  if (crit) amt *= m.critMult;
  if (m.kinetic > 0) amt += m.kinetic * Math.max(0, g.rates[def.res] || 0);
  amt = Math.max(1, Math.round(amt));
  node.stock = Math.max(0, node.stock - 1);
  g.world.writeDelta(node);
  const cap = capOf(g, def.res);
  s.res[def.res] = Math.min(cap, (s.res[def.res] || 0) + amt);
  s.totals[def.res] = (s.totals[def.res] || 0) + amt;
  s.clicks++; s.stats.lifetimeClicks++;
  return { amt, crit, res: def.res };
}

// ---------- technologie a upgrady ----------
export function techAvailable(g: Game, t: string): boolean {
  const def = TECH_BY[t];
  if (!def || hasTech(g.s, t)) return false;
  return def.req.every(r => hasTech(g.s, r));
}

export function buyTech(g: Game, t: string): string | null {
  const def = TECH_BY[t];
  if (!def) return 'Neznámá technologie.';
  if (hasTech(g.s, t)) return 'Už vyzkoumáno.';
  if (!techAvailable(g, t)) return 'Chybí předpoklady.';
  if ((g.s.res.research || 0) < def.cost) return 'Nedostatek vědy.';
  if (def.mats && !canAfford(g, def.mats)) return 'Nedostatek materiálu.';
  g.s.res.research -= def.cost;
  if (def.mats) pay(g, def.mats);
  const prevEra = g.maxEra;
  g.s.techs.push(t);
  recount(g);
  recomputeMults(g);
  bus.emit('tech', def);
  if (g.maxEra > prevEra) bus.emit('era', { era: g.maxEra });
  return null;
}

export function upgradeCost(g: Game, u: string): Rec {
  const def = UPG_BY[u];
  const lvl = g.s.upgrades[u] || 0;
  const out: Rec = {};
  for (const [r, v] of Object.entries(def.base)) out[r] = Math.floor(v * Math.pow(def.growth, lvl));
  return out;
}

export function buyUpgrade(g: Game, u: string): string | null {
  const def = UPG_BY[u];
  if (!def) return 'Neznámý upgrade.';
  const lvl = g.s.upgrades[u] || 0;
  if (lvl >= def.max) return 'Maximální úroveň.';
  if (def.reqTech && !hasTech(g.s, def.reqTech)) return 'Chybí technologie.';
  const cost = upgradeCost(g, u);
  if (!canAfford(g, cost)) return 'Nedostatek surovin.';
  pay(g, cost);
  g.s.upgrades[u] = lvl + 1;
  recomputeMults(g);
  bus.emit('upgrade', def);
  return null;
}

// ---------- zlatý občan ----------
function spawnGolden(g: Game, rand: () => number) {
  const roads = [...g.world.roads].filter(rk => {
    const [x, y] = rk.split(',').map(Number);
    return Math.hypot(x, y) < 18;
  });
  if (!roads.length) return;
  const [tx, ty] = roads[Math.floor(rand() * roads.length)].split(',').map(Number);
  g.runtime.golden = { tx, ty, until: Date.now() + 25000 };
  bus.emit('goldenSpawn', g.runtime.golden);
}

export function collectGolden(g: Game): void {
  const gc = g.runtime.golden;
  if (!gc) return;
  g.runtime.golden = null;
  g.s.stats.goldenClicked = (g.s.stats.goldenClicked || 0) + 1;
  const roll = Math.random();
  const now = Date.now();
  if (roll < 0.45) {
    g.s.buffs.push({ kind: 'frenzy', mult: 7, until: now + 30000, label: 'Zlatá horečka ×7', icon: '🌟' });
    bus.emit('golden', { kind: 'frenzy', text: 'Zlatá horečka! Produkce ×7 na 30 s!' });
  } else if (roll < 0.75) {
    // balík surovin: 8 minut současné produkce nejlepší suroviny
    let bestRes = 'wood', bestRate = 0;
    for (const [r, v] of Object.entries(g.rates)) if (v > bestRate && r !== 'research') { bestRate = v; bestRes = r; }
    const amt = Math.max(20, Math.floor(bestRate * 480));
    g.s.res[bestRes] = Math.min(capOf(g, bestRes), (g.s.res[bestRes] || 0) + amt);
    g.s.totals[bestRes] = (g.s.totals[bestRes] || 0) + amt;
    bus.emit('golden', { kind: 'gift', text: `Dar osudu: +${amt} ${bestRes}!`, res: bestRes, amt });
  } else {
    g.s.buffs.push({ kind: 'clickFrenzy', mult: 20, until: now + 15000, label: 'Klikací šílenství ×20', icon: '👆' });
    bus.emit('golden', { kind: 'clickFrenzy', text: 'Klikací šílenství! Kliky ×20 na 15 s!' });
  }
}

// ---------- ascension ----------
export function civScore(g: Game): number {
  let sc = 0;
  for (const r of RES) sc += (g.s.totals[r.id] || 0) * r.value;
  sc += g.s.stats.peakPop * 100;
  sc += g.s.techs.length * 1000;
  sc += countB(g, 'monument') * 25000;
  return sc;
}

export function ascendGain(g: Game): number {
  return Math.floor(Math.sqrt(civScore(g) / 2000));
}

export function ascensionUnlocked(g: Game): boolean {
  return hasTech(g.s, 'transcendence');
}

export function perkCost(g: Game, id: string): number {
  const def = PERK_BY[id];
  const lvl = g.s.legacy.perks[id] || 0;
  return Math.floor(def.baseCost * Math.pow(def.costGrowth, lvl));
}

export function buyPerk(g: Game, id: string): string | null {
  const def = PERK_BY[id];
  if (!def) return 'Neznámý perk.';
  const lvl = g.s.legacy.perks[id] || 0;
  if (lvl >= def.max) return 'Maximální úroveň.';
  const cost = perkCost(g, id);
  if (g.s.legacy.pts < cost) return 'Nedostatek Odkazu.';
  g.s.legacy.pts -= cost;
  g.s.legacy.perks[id] = lvl + 1;
  recomputeMults(g);
  return null;
}

export function doAscend(g: Game) {
  const gain = ascendGain(g);
  const s = g.s;
  const legacy = { pts: s.legacy.pts + gain, perks: { ...s.legacy.perks } };
  const stats = { ...s.stats, ascensions: (s.stats.ascensions || 0) + 1 };
  const fresh = newState((Math.random() * 2 ** 31) | 0, { legacy, achs: [...s.achs], settings: s.settings, stats });
  fresh.playtime = s.playtime;
  initGame(g, fresh);
  recomputeMults(g);
  bus.emit('ascend', { gain });
}

// ---------- offline progres ----------
export interface OfflineSummary { seconds: number; gains: Rec; effSeconds: number }

export function computeOffline(g: Game, seconds: number): OfflineSummary {
  const m = g.m;
  const capped = Math.min(seconds, m.offlineCapH * 3600);
  const effSeconds = capped * m.offlineEff;
  const before: Rec = { ...g.s.res };
  // coarse-tick: 120 kroků deterministické simulace
  const steps = 120;
  const stepDt = effSeconds / steps;
  if (stepDt > 0) {
    for (let i = 0; i < steps; i++) tick(g, stepDt);
  }
  const gains: Rec = {};
  for (const r of RES) {
    const d = (g.s.res[r.id] || 0) - (before[r.id] || 0);
    if (Math.abs(d) > 0.5) gains[r.id] = d;
  }
  return { seconds, gains, effSeconds };
}

// ---------- nový běh ----------
export function freshRun(g: Game, keepMeta: boolean) {
  const s = g.s;
  const carry = keepMeta && s ? { legacy: s.legacy, achs: s.achs, settings: s.settings, stats: s.stats } : undefined;
  const fresh = newState((Math.random() * 2 ** 31) | 0, carry);
  initGame(g, fresh);
  recomputeMults(g);
}

// deterministické rng pro slow tick (seed z herního stavu)
export function makeSimRand(g: Game): () => number {
  let counter = 0;
  return () => hash2(g.s.seed ^ 0xabcd, counter++, Math.floor(g.s.playtime / 1000));
}
