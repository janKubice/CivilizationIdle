// ===== Ekonomická simulace (headless, deterministická) =====
// Agregovaný výpočet — O(druhy budov), ne O(lidé). Viz docs/03-people-and-work.md.

import { clamp, lerp, bus, key, hash2 } from './util';
import { B_WATER, B_MOUNTAIN } from './config';
import {
  RES, B, BUILDINGS, TECHS, TECH_BY, UPGRADES, UPG_BY, ACHS, ACH_BONUS,
  PERKS, PERK_BY, NODE_DEFS, ADJ_RULES, MERGEABLE, SEASON_LEN, Rec,
} from './data';
import {
  Game, GameState, BuildingInst, baseMults, newState, initGame, recount, rebuildOccupancy, lvlEff,
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
    if (fx.special === 'governor') m.governor = true;
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

export function haulEffOf(d: number, range: number): number {
  return 1 / (1 + Math.max(0, d - 2) / range);
}

/** adjacency bonus podle okolí (počítá se při stavbě, cache v BuildingInst.adj) */
export function computeAdj(g: Game, t: string, x: number, y: number, size: number): number {
  const rule = ADJ_RULES[t];
  if (!rule) return 1;
  let count = 0;
  for (let ty = y - 3; ty < y + size + 3; ty++) {
    for (let tx = x - 3; tx < x + size + 3; tx++) {
      if (tx >= x && tx < x + size && ty >= y && ty < y + size) continue;
      if (rule.water) {
        if (g.world.biomeAt(tx, ty) === B_WATER) count++;
      } else if (rule.kinds) {
        const n = g.world.nodeAt(tx, ty);
        if (n && rule.kinds.includes(n.kind)) count++;
      }
    }
  }
  return Math.min(rule.cap, 1 + rule.per * count);
}

function computeHaulDist(g: Game, b: { x: number; y: number }): number {
  let best = Math.max(Math.abs(b.x + 1), Math.abs(b.y + 1)); // náves na (-1,-1)
  for (const o of g.s.buildings) {
    if (o.t !== 'storehouse' && o.t !== 'trainStation') continue; // nádraží = lokální překladiště
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

  // roční období (deterministicky z odehraného času)
  const seasonTotal = (s.playtime / 1000) % (4 * SEASON_LEN);
  const season = Math.floor(seasonTotal / SEASON_LEN) % 4;
  if (season !== g.season) { g.season = season; bus.emit('season', { season }); }
  g.seasonT = (seasonTotal % SEASON_LEN) / SEASON_LEN;

  // buffy
  const now = Date.now();
  if (s.buffs.length) s.buffs = s.buffs.filter(b => b.until > now);
  let frenzy = 1, cFrenzy = 1, festHap = 0;
  for (const b of s.buffs) {
    if (b.kind === 'frenzy') frenzy *= b.mult;
    else if (b.kind === 'clickFrenzy') cFrenzy *= b.mult;
    else if (b.kind === 'festival') festHap += 0.2;
    else if (b.kind === 'circus') festHap += 0.15;
  }
  g.frenzy = frenzy; g.clickFrenzy = cFrenzy;

  const m = g.m;
  g.capMult = (1 + 0.75 * countB(g, 'storehouse')) * m.capacity;

  const delta: Rec = {};
  const gross: Rec = {};   // hrubá produkce (totals — skóre, achievementy)
  const avail = (r: string) => (s.res[r] || 0) + (delta[r] || 0);
  const add = (r: string, v: number) => {
    delta[r] = (delta[r] || 0) + v;
    if (v > 0) gross[r] = (gross[r] || 0) + v;
  };

  // spokojenost (levné, počítá se každý tick)
  computeHappiness(g, festHap);
  const prodF = (0.5 + 0.5 * g.happiness) * frenzy * m.global;

  // per-typ faktor: doprava × adjacency × úroveň × velká budova × čtvrť (jeden průchod)
  const tf: Record<string, { s: number; n: number }> = {};
  for (const b of s.buildings) {
    const bd = B[b.t];
    if (!bd?.jobs || b.fire || b.dmg) continue;
    const haul = bd.noHaul ? 1 : haulEffOf(b.d ?? 0, m.haulRange);
    const f = haul * (b.adj || 1) * lvlEff(b.lvl) * (b.big ? 1.5 : 1) * (b.dm || 1);
    const e = tf[b.t] || (tf[b.t] = { s: 0, n: 0 });
    e.s += f * (b.big ? 4 : 1); e.n += b.big ? 4 : 1; // velká váží za 4 budovy
  }
  const typeF = (t: string) => { const e = tf[t]; return e && e.n ? e.s / e.n : 1; };

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
      eProd = n * (def.energyOut || 0) * (fusion ? 10 : 1) * ratio * typeF('powerPlant');
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

    let mult = (m.job[def.id] || 1) * prodF * typeF(def.id);
    if (def.raw) mult *= m.gather * tMult;
    if (def.energyUse) mult *= throttle;
    // roční období: léto přeje farmám, podzim sběru, zima farmy dusí
    if (def.id === 'farm') mult *= [1, 1.2, 1, 0.6][g.season];
    else if (def.id === 'gatherHut' || def.id === 'forestCamp') mult *= g.season === 2 ? 1.2 : 1;

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

  // --- spotřeba jídla (ryby jsou záložní zdroj), opotřebení nástrojů ---
  const eat = s.pop * 0.08 * dt;
  const foodAvail = avail('food');
  if (foodAvail >= eat) {
    add('food', -eat);
    g.starving = false;
  } else {
    add('food', -Math.max(0, foodAvail));
    const shortfall = eat - Math.max(0, foodAvail);
    const fishAvail = avail('fish');
    if (fishAvail >= shortfall) { add('fish', -shortfall); g.starving = false; }
    else { add('fish', -Math.max(0, fishAvail)); g.starving = true; }
  }
  // zima: topení dřevem
  if (g.season === 3) {
    const heat = s.pop * 0.02 * dt;
    const wAvail = avail('wood');
    g.cold = wAvail < heat;
    add('wood', -Math.min(heat, Math.max(0, wAvail)));
  } else g.cold = false;
  const working = sumAssigned(s);
  if (working > 0 && (s.res.tools || 0) > 0) add('tools', -working * 0.0006 * dt);

  // --- aplikace delty s limity skladů ---
  for (const [r, v] of Object.entries(gross)) s.totals[r] = (s.totals[r] || 0) + v;
  for (const [r, v] of Object.entries(delta)) {
    const cap = capOf(g, r);
    s.res[r] = clamp((s.res[r] || 0) + v, 0, cap);
    // vyhlazený rate pro UI
    g.rates[r] = lerp(g.rates[r] || 0, v / dt, 0.12);
  }
  for (const r of Object.keys(g.rates)) if (!(r in delta)) g.rates[r] = lerp(g.rates[r], 0, 0.12);

  // --- růst populace (jaro přeje) ---
  const housing = housingCap(g);
  if (s.pop < housing && g.happiness > 0.55 && ((s.res.food || 0) > 1 || (s.res.fish || 0) > 1)) {
    s.popFrac += 0.016 * Math.sqrt(s.pop + 1) * g.happiness * m.growth * (g.season === 0 ? 1.3 : 1) * dt;
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
  const parts: { key: string; v: number }[] = [{ key: 'hap.base', v: 0.45 }];
  const foodPart = (s.res.food || 0) > 1 ? 0.12 : (g.starving ? -0.3 : 0);
  parts.push({ key: g.starving ? 'hap.starving' : 'hap.food', v: foodPart });
  const water = waterCap(g);
  parts.push({ key: 'hap.water', v: 0.13 * Math.min(1, water / Math.max(1, s.pop)) });
  const housing = housingCap(g);
  const crowd = housing > 0 ? s.pop / housing : 2;
  parts.push({ key: 'hap.housing', v: crowd < 0.95 ? 0.05 : crowd >= 1 ? -0.05 : 0 });
  let services = 0;
  for (const [t, n] of Object.entries(g.bCount)) {
    const def = B[t];
    if (def?.hap) services += def.hap * Math.min(n, 3);
  }
  parts.push({ key: 'hap.services', v: services });
  parts.push({ key: 'hap.bonus', v: g.m.hapBonus });
  if ((s.res.fish || 0) > 1 && (s.res.food || 0) > 1) parts.push({ key: 'hap.diet', v: 0.04 });
  if (g.season === 3) parts.push(g.cold ? { key: 'hap.cold', v: -0.1 } : { key: 'hap.cozy', v: 0.03 });
  if (festHap > 0) parts.push({ key: 'hap.festival', v: festHap });
  g.hapParts = parts;
  g.happiness = clamp(parts.reduce((a, p) => a + p.v, 0), 0.05, 1);
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

  // --- požáry ---
  let fireChanged = false;
  for (const b of s.buildings) {
    if (!b.fire) continue;
    let rate = 1;
    // hasičská stanice v okolí hasí 5× rychleji
    for (const o of s.buildings) {
      if (o.t === 'fireStation' && !o.dmg && Math.max(Math.abs(o.x - b.x), Math.abs(o.y - b.y)) <= 8) { rate = 5; break; }
    }
    b.fire -= seconds * rate;
    if (b.fire <= 0) {
      delete b.fire;
      if (rate > 1) bus.emit('fireOut', { t: b.t }); // uhasili hasiči
      else { b.dmg = 1; bus.emit('burned', { t: b.t, x: b.x, y: b.y }); }
      fireChanged = true;
    }
  }
  if (fireChanged) recount(g);
  // vznik požáru (jen když je co pálit; ~1× za 6 min)
  if (s.buildings.length > 6 && rand() < seconds / 360) {
    const cands = s.buildings.filter(b => !b.fire && !b.dmg && !B[b.t].unbuildable && (B[b.t].jobs || B[b.t].housing));
    if (cands.length) {
      const victim = cands[Math.floor(rand() * cands.length)];
      victim.fire = 30;
      recount(g);
      bus.emit('fire', { t: victim.t, x: victim.x, y: victim.y });
    }
  }

  // --- cirkus (pozitivní event) ---
  if (countB(g, 'market') > 0 && rand() < seconds / 600 && !s.buffs.some(b => b.kind === 'circus')) {
    s.buffs.push({ kind: 'circus', mult: 1, until: Date.now() + 90000, label: '', icon: '🎪' });
    bus.emit('circus');
  }

  // --- meteor (vzácný dar z nebes) ---
  if (g.maxEra >= 2 && rand() < seconds / 900) {
    const res = rand() < 0.5 ? 'ironOre' : 'copperOre';
    const amt = Math.max(60, Math.floor((g.rates[res] || 0) * 300));
    s.res[res] = Math.min(capOf(g, res), (s.res[res] || 0) + amt);
    s.totals[res] = (s.totals[res] || 0) + amt;
    s.buffs.push({ kind: 'clickFrenzy', mult: 10, until: Date.now() + 15000, label: '', icon: '☄️' });
    bus.emit('meteor', { res, amt });
  }

  // --- Guvernér: auto-stavění podle potřeb ---
  if (g.m.governor) governorTick(g, rand);

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

  // upozornění na plné sklady (throttled per surovina)
  const now2 = Date.now();
  for (const r of RES) {
    const cap = capOf(g, r.id);
    if (!isFinite(cap)) continue;
    if ((s.res[r.id] || 0) >= cap * 0.995 && (g.rates[r.id] || 0) > 0.01) {
      if ((storageWarn[r.id] || 0) + 120000 < now2) {
        storageWarn[r.id] = now2;
        bus.emit('storageFull', { res: r.id });
      }
    }
  }
}
const storageWarn: Rec = {};

/** klik na hořící budovu = hašení */
export function extinguishClick(g: Game, idx: number): boolean {
  const b = g.s.buildings[idx];
  if (!b || !b.fire) return false;
  b.fire -= 4;
  bus.emit('extinguish', { x: b.x, y: b.y });
  if (b.fire <= 0) {
    delete b.fire;
    recount(g);
    bus.emit('fireOut', { t: b.t });
  }
  return true;
}

export function repairCost(g: Game, idx: number): Rec | null {
  const b = g.s.buildings[idx];
  if (!b || !b.dmg) return null;
  const out: Rec = {};
  for (const [r, v] of Object.entries(B[b.t].cost)) out[r] = Math.max(1, Math.floor(v * 0.3 * (b.big ? 4 : 1)));
  return out;
}

export function repairBuilding(g: Game, idx: number): string | null {
  const cost = repairCost(g, idx);
  if (!cost) return 'err.req';
  if (!canAfford(g, cost)) return 'err.res';
  pay(g, cost);
  delete g.s.buildings[idx].dmg;
  recount(g);
  bus.emit('repaired', { t: g.s.buildings[idx].t });
  return null;
}

/** Guvernér: postaví max. 1 budovu za tick podle zapnutých potřeb */
function governorTick(g: Game, rand: () => number) {
  const s = g.s;
  const auto = s.auto || {};
  const tryGovBuild = (t: string): boolean => {
    const cost = buildCost(g, t);
    if (!canAfford(g, cost)) return false;
    const spot = findAutoSpot(g, rand);
    if (!spot) return false;
    pay(g, cost);
    placeBuilding(g, t, spot[0], spot[1], true);
    bus.emit('built', { t, x: spot[0], y: spot[1], auto: true });
    bus.emit('govBuilt', { t });
    return true;
  };
  // nejdřív obsaď volné sloty nezaměstnanými, teprve pak stav
  const fillOrBuild = (t: string): boolean => {
    const free = slots(g, t) - (s.assigned[t] || 0);
    const idle = s.pop - sumAssigned(s);
    if (free > 0 && idle > 0) { setAssign(g, t, (s.assigned[t] || 0) + Math.min(free, idle)); return true; }
    if (free <= 0) return tryGovBuild(t);
    return false;
  };
  // 1) jídlo: produkce nestíhá spotřebu
  if (auto.food && (g.rates.food || 0) < s.pop * 0.08 * 1.15) {
    if (fillOrBuild(hasTech(s, 'agriculture') ? 'farm' : 'gatherHut')) return;
  }
  // 2) dřevo: záporná bilance (zima!) nebo skoro nic
  if (auto.wood && (g.rates.wood || 0) < 0.1 && fillOrBuild('forestCamp')) return;
  // 3) sklady: něco přetéká
  if (auto.store) {
    for (const r of RES) {
      const cap = capOf(g, r.id);
      if (isFinite(cap) && (s.res[r.id] || 0) >= cap * 0.95 && (g.rates[r.id] || 0) > 0.01) {
        if (tryGovBuild('storehouse')) return;
        break;
      }
    }
  }
  // 4) voda: nedostatečné pokrytí
  if (auto.water && waterCap(g) < s.pop && tryGovBuild('well')) return;
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
  // město se okrašluje samo: park, když spokojenost klesá
  if (g.happiness < 0.62 && (g.bCount.park || 0) < 6 && rand() < 0.3) {
    const cost = buildCost(g, 'park');
    if (canAfford(g, cost)) {
      const spot = findAutoSpot(g, rand);
      if (spot) {
        pay(g, cost);
        placeBuilding(g, 'park', spot[0], spot[1], true);
        bus.emit('built', { t: 'park', x: spot[0], y: spot[1], auto: true });
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
      if (wouldFormRoadBlock(g, tx, ty)) break;
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

/** zabraň slitým plochám: nová cesta nesmí vytvořit 2×2 blok cest */
function wouldFormRoadBlock(g: Game, tx: number, ty: number): boolean {
  const r = (x: number, y: number) => g.world.roads.has(key(x, y));
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    if (r(tx + dx, ty) && r(tx, ty + dy) && r(tx + dx, ty + dy)) return true;
  }
  return false;
}

function tryRoad(g: Game, tx: number, ty: number) {
  const kk = key(tx, ty);
  if (g.world.roads.has(kk) || g.world.occ.has(kk) || g.world.nodeAt(tx, ty)) return;
  const b = g.world.biomeAt(tx, ty);
  if (b === B_WATER || b === B_MOUNTAIN) return;
  if (wouldFormRoadBlock(g, tx, ty)) return;
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
  const inst: import('./state').BuildingInst = auto ? { t, x: tx, y: ty, auto: 1 } : { t, x: tx, y: ty };
  g.s.buildings.push(inst);
  const idx = g.s.buildings.length - 1;
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) g.world.occ.set(key(tx + dx, ty + dy), idx);
  recount(g);
  if (def.jobs && !def.noHaul) inst.d = computeHaulDist(g, inst);
  const adj = computeAdj(g, t, tx, ty, def.size);
  if (adj > 1.001) inst.adj = Math.round(adj * 100) / 100;
  if (t === 'storehouse') recomputeAllHaul(g);
  if (t === 'trainStation') { recomputeMults(g); recomputeAllHaul(g); layRails(g, inst); }
  autoConnectRoad(g, tx, ty);
  g.runtime.agentsDirty = true;
  if (!auto && adj > 1.001) bus.emit('adj', { t, mult: adj, label: ADJ_RULES[t]?.label || '' });
}

/** položí koleje k nejbližšímu jinému nádraží (L-trasa, vyhýbá se vodě a budovám) */
function layRails(g: Game, st: BuildingInst) {
  let best: BuildingInst | null = null, bd = Infinity;
  for (const o of g.s.buildings) {
    if (o === st || o.t !== 'trainStation') continue;
    const d = Math.abs(o.x - st.x) + Math.abs(o.y - st.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  const put = (x: number, y: number) => {
    const b = g.world.biomeAt(x, y);
    if (b === B_WATER || b === B_MOUNTAIN) return;
    if (g.world.occ.has(key(x, y))) return;
    g.world.rails.add(key(x, y));
  };
  let cx = st.x + 1, cy = st.y + 2;
  const tx2 = best.x + 1, ty2 = best.y + 2;
  put(cx, cy);
  while (cx !== tx2) { cx += Math.sign(tx2 - cx); put(cx, cy); }
  while (cy !== ty2) { cy += Math.sign(ty2 - cy); put(cx, cy); }
  g.s.rails = [...g.world.rails];
  bus.emit('railsLaid', {});
}

// ---------- úrovně budov ----------
export function upgradeCostB(g: Game, idx: number): Rec | null {
  const inst = g.s.buildings[idx];
  if (!inst) return null;
  const def = B[inst.t];
  const lvl = inst.lvl || 1;
  if (lvl >= 3 || def.unbuildable || (!def.jobs && !def.housing && !def.water)) return null;
  const out: Rec = {};
  for (const [r, v] of Object.entries(def.cost)) out[r] = Math.floor(v * 4 * lvl * (inst.big ? 4 : 1));
  return Object.keys(out).length ? out : null;
}

export function upgradeEraOk(g: Game, idx: number): boolean {
  const inst = g.s.buildings[idx];
  if (!inst) return false;
  return g.maxEra >= B[inst.t].era + (inst.lvl || 1);
}

export function upgradeBuilding(g: Game, idx: number): string | null {
  const inst = g.s.buildings[idx];
  if (!inst) return 'err.req';
  const cost = upgradeCostB(g, idx);
  if (!cost) return 'err.max';
  if (!upgradeEraOk(g, idx)) return 'err.era';
  if (!canAfford(g, cost)) return 'err.res';
  pay(g, cost);
  inst.lvl = (inst.lvl || 1) + 1;
  recount(g);
  g.runtime.agentsDirty = true;
  bus.emit('upgraded', { t: inst.t, lvl: inst.lvl, x: inst.x, y: inst.y });
  return null;
}

// ---------- slučování 4-v-1 ----------
/** najdi 2×2 čtverec stejného typu obsahující budovu idx (TL,TR,BL,BR indexy) */
export function findMergeGroup(g: Game, idx: number): number[] | null {
  const inst = g.s.buildings[idx];
  if (!inst || inst.big || !MERGEABLE.has(inst.t)) return null;
  const at = (x: number, y: number): number =>
    g.s.buildings.findIndex(b => b.t === inst.t && !b.big && b.x === x && b.y === y);
  for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const tlx = inst.x + ox, tly = inst.y + oy;
    const ids = [at(tlx, tly), at(tlx + 1, tly), at(tlx, tly + 1), at(tlx + 1, tly + 1)];
    if (ids.every(i => i >= 0)) return ids;
  }
  return null;
}

export function mergeBuildings(g: Game, idx: number): string | null {
  const group = findMergeGroup(g, idx);
  if (!group) return 'err.merge';
  const insts = group.map(i => g.s.buildings[i]);
  const tlx = Math.min(...insts.map(b => b.x)), tly = Math.min(...insts.map(b => b.y));
  const t = insts[0].t;
  const lvl = Math.min(...insts.map(b => b.lvl || 1));
  const anyAuto = insts.some(b => b.auto);
  [...group].sort((a, b) => b - a).forEach(i => g.s.buildings.splice(i, 1));
  const merged: BuildingInst = { t, x: tlx, y: tly, big: 1 };
  if (lvl > 1) merged.lvl = lvl;
  if (anyAuto) merged.auto = 1;
  g.s.buildings.push(merged);
  rebuildOccupancy(g);
  recount(g);
  const def = B[t];
  if (def.jobs && !def.noHaul) merged.d = computeHaulDist(g, merged);
  const adj = computeAdj(g, t, tlx, tly, 2);
  if (adj > 1.001) merged.adj = Math.round(adj * 100) / 100;
  g.runtime.agentsDirty = true;
  bus.emit('merged', { t });
  return null;
}

export function splitBuilding(g: Game, idx: number): string | null {
  const inst = g.s.buildings[idx];
  if (!inst || !inst.big) return 'err.req';
  const { t, x, y, lvl, auto } = inst;
  const def = B[t];
  g.s.buildings.splice(idx, 1);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const nb: BuildingInst = { t, x: x + dx, y: y + dy };
    if (lvl && lvl > 1) nb.lvl = lvl;
    if (auto) nb.auto = 1;
    g.s.buildings.push(nb);
    if (def.jobs && !def.noHaul) nb.d = computeHaulDist(g, nb);
    const adj = computeAdj(g, t, nb.x, nb.y, 1);
    if (adj > 1.001) nb.adj = Math.round(adj * 100) / 100;
  }
  rebuildOccupancy(g);
  recount(g);
  g.runtime.agentsDirty = true;
  bus.emit('merged', { t, split: true });
  return null;
}

/** zboření budovy s 50% refundací */
export function demolish(g: Game, idx: number): string | null {
  const s = g.s;
  const inst = s.buildings[idx];
  if (!inst) return 'err.terrain';
  const def = B[inst.t];
  if (def.unbuildable) return 'err.terrain';
  const n = Math.max(0, countB(g, inst.t) - 1);
  const refund: Rec = {};
  const bigMult = inst.big ? 4 : 1;
  for (const [r, v] of Object.entries(def.cost)) refund[r] = Math.floor(v * Math.pow(1.12, n) * 0.5 * bigMult);
  s.buildings.splice(idx, 1);
  rebuildOccupancy(g);
  recount(g);
  for (const [r, v] of Object.entries(refund)) s.res[r] = Math.min(capOf(g, r), (s.res[r] || 0) + v);
  const sl = slots(g, inst.t);
  if ((s.assigned[inst.t] || 0) > sl) s.assigned[inst.t] = sl;
  if (inst.t === 'storehouse') recomputeAllHaul(g);
  if (inst.t === 'trainStation') recomputeMults(g);
  g.runtime.agentsDirty = true;
  bus.emit('demolished', { t: inst.t, refund });
  return null;
}

/** pokus o stavbu hráčem; vrací chybovou hlášku nebo null při úspěchu */
export function tryBuild(g: Game, t: string, tx: number, ty: number): string | null {
  const def = B[t];
  if (!def || def.unbuildable) return 'err.terrain';
  if (def.tech && !hasTech(g.s, def.tech)) return 'err.tech';
  for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) {
    if (!g.world.buildable(tx + dx, ty + dy)) return 'err.terrain';
  }
  if (def.nearWater) {
    let okW = false;
    for (let dy = -2; dy < def.size + 2 && !okW; dy++) for (let dx = -2; dx < def.size + 2 && !okW; dx++) {
      if (g.world.biomeAt(tx + dx, ty + dy) === B_WATER) okW = true;
    }
    if (!okW) return 'err.water';
  }
  const cost = buildCost(g, t);
  if (!canAfford(g, cost)) return 'err.res';
  pay(g, cost);
  placeBuilding(g, t, tx, ty, false);
  bus.emit('built', { t, x: tx, y: ty });
  const gi = g.s.buildings.length - 1;
  const inst = g.s.buildings[gi];
  // hint na slučování (throttled per typ)
  if (findMergeGroup(g, gi) && (mergeHintAt[t] || 0) + 120000 < Date.now()) {
    mergeHintAt[t] = Date.now();
    bus.emit('mergeHint', { t });
  }
  // oznám vznik nové čtvrti (přesně 3 členové = právě vznikla)
  if (inst.dm) {
    const def2 = B[t];
    let members = 1;
    for (const o of g.s.buildings) {
      if (o === inst) continue;
      const od = B[o.t];
      if (od.cat === def2.cat && od.jobs && (od.prod || od.recipe) &&
        Math.max(Math.abs(o.x - inst.x), Math.abs(o.y - inst.y)) <= 4) members++;
    }
    if (members === 3) bus.emit('district', { cat: def2.cat });
  }
  return null;
}
const mergeHintAt: Rec = {};

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
  if (!def) return 'err.req';
  if (hasTech(g.s, t)) return 'err.req';
  if (!techAvailable(g, t)) return 'err.req';
  if ((g.s.res.research || 0) < def.cost) return 'err.sci';
  if (def.mats && !canAfford(g, def.mats)) return 'err.res';
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
  if (!def) return 'err.req';
  const lvl = g.s.upgrades[u] || 0;
  if (lvl >= def.max) return 'err.max';
  if (def.reqTech && !hasTech(g.s, def.reqTech)) return 'err.tech';
  const cost = upgradeCost(g, u);
  if (!canAfford(g, cost)) return 'err.res';
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
  if (!def) return 'err.req';
  const lvl = g.s.legacy.perks[id] || 0;
  if (lvl >= def.max) return 'err.max';
  const cost = perkCost(g, id);
  if (g.s.legacy.pts < cost) return 'err.legacy';
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
