// ===== Save systém: localStorage, export/import, verze =====

import { SAVE_KEY, VERSION } from './config';
import { GameState, Game, defaultSettings } from './state';

export function serialize(g: Game): string {
  g.s.roads = [...g.world.roads];
  g.s.rails = [...g.world.rails];
  g.s.terra = [...g.world.terra];
  g.s.saved = Date.now();
  return JSON.stringify(g.s);
}

export function saveGame(g: Game) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(g));
  } catch (e) {
    console.warn('Save selhal:', e);
  }
}

export function hasSave(): boolean {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('Load selhal:', e);
    return null;
  }
}

function migrate(s: any): GameState | null {
  if (!s || typeof s !== 'object' || typeof s.v !== 'number') return null;
  if (s.v > VERSION) { console.warn('Save z novější verze hry.'); return null; }
  // řetěz migrací (zatím jen v1)
  // if (s.v === 1) { ...; s.v = 2; }
  // doplň chybějící pole (odolnost)
  s.settings = { ...defaultSettings(), ...(s.settings || {}) };
  s.buffs = s.buffs || [];
  s.legacy = s.legacy || { pts: 0, perks: {} };
  s.stats = { peakPop: 0, goldenClicked: 0, ascensions: 0, lifetimeClicks: 0, terraformed: 0, raidsWon: 0, ...(s.stats || {}) };
  s.nodeDelta = s.nodeDelta || {};
  s.roads = s.roads || [];
  s.rails = s.rails || [];
  s.railRoutes = s.railRoutes || [];
  s.terra = s.terra || [];
  s.achs = s.achs || [];
  s.techs = s.techs || [];
  s.upgrades = s.upgrades || {};
  s.assigned = s.assigned || {};
  s.totals = s.totals || {};
  s.auto = s.auto || {};
  s.nextFestival = s.nextFestival || 0;
  return s as GameState;
}

export function exportSave(g: Game): string {
  return btoa(unescape(encodeURIComponent(serialize(g))));
}

export function importSave(data: string): GameState {
  const json = decodeURIComponent(escape(atob(data.trim())));
  const s = migrate(JSON.parse(json));
  if (!s) throw new Error('Neplatný save.');
  return s;
}

export function hardReset() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
