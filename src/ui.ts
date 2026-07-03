// ===== UI vrstva: HUD, panely, menu, modaly (vanilla DOM, čte stav, posílá příkazy) =====

import { fmt, fmtRate, fmtTime, bus } from './util';
import { RES, RES_BY, B, BUILDINGS, TECHS, TECH_BY, UPGRADES, ACHS, PERKS, BCat, Rec } from './data';
import { Game, slots, sumAssigned, housingCap, waterCap, capOf } from './state';
import {
  buildCost, canAfford, upgradeCost, buyTech, buyUpgrade, setAssign, hasTech, techAvailable,
  ascendGain, ascensionUnlocked, civScore, perkCost, buyPerk, doAscend, demolish, haulEffOf,
  upgradeCostB, upgradeEraOk, upgradeBuilding, findMergeGroup, mergeBuildings, splitBuilding, OfflineSummary,
} from './sim';
import { saveGame, exportSave, importSave, hardReset } from './save';
import { t, tn, td, tres, tjob, tera, setLang, getLang, LANGS, Lang } from './i18n';
import type { Renderer } from './render';

let g: Game;
let renderer: Renderer;
let ui: HTMLElement;
let openedPanel: string | null = null;
let pbody: HTMLElement, ptitle: HTMLElement, panelEl: HTMLElement;
let topbar: HTMLElement, hintEl: HTMLElement, toastsEl: HTMLElement;
let sideBtns: { id: string; btn: HTMLElement; icon: string }[] = [];
let onImportCb: (s: any) => void = () => {};

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function toast(msg: string, cls = '') {
  const tt = el('div', 'toast ' + cls, msg);
  toastsEl.appendChild(tt);
  setTimeout(() => { tt.style.opacity = '0'; tt.style.transition = 'opacity .4s'; setTimeout(() => tt.remove(), 450); }, 4200);
  while (toastsEl.children.length > 5) toastsEl.firstChild?.remove();
}

// ---------- modaly ----------
export function showModal(html: string, buttons: { label: string; cls?: string; cb?: () => void }[]): HTMLElement {
  const back = el('div', 'mback');
  const m = el('div', 'modal', html);
  const btns = el('div', 'btns');
  for (const b of buttons) {
    const bt = el('button', b.cls || '', b.label) as HTMLButtonElement;
    bt.onclick = () => { back.remove(); b.cb?.(); };
    btns.appendChild(bt);
  }
  m.appendChild(btns);
  back.appendChild(m);
  ui.appendChild(back);
  return back;
}

export function showOffline(sum: OfflineSummary) {
  let rows = '';
  for (const [r, v] of Object.entries(sum.gains)) {
    if (v <= 0) continue;
    const d = RES_BY[r];
    rows += `<div>${d?.icon || ''} ${esc(tres(r))}: <b style="color:#7ee787">+${fmt(v)}</b></div>`;
  }
  if (!rows) rows = `<div style="opacity:.7">${t('offline.rest')}</div>`;
  showModal(`<h3>${t('offline.title', fmtTime(sum.seconds))}</h3>
    <p>${t('offline.body', fmtTime(sum.effSeconds))}</p>
    <div style="display:flex;flex-direction:column;gap:3px;font-size:13.5px">${rows}</div>`,
    [{ label: t('continue') }]);
}

// ---------- info o budově ----------
const ROMAN = ['I', 'II', 'III'];
const costStr = (cost: Rec) => Object.entries(cost).map(([r, v]) => `${RES_BY[r]?.icon || ''}${fmt(v)}`).join(' ');

export function showBuildingInfo(idx: number) {
  const inst = g.s.buildings[idx];
  if (!inst) return;
  const def = B[inst.t];
  const lvl = inst.lvl || 1;
  let body = `<h3>${def.icon} ${esc(tn('b', inst.t))}${inst.big ? ' ★' : ''}${lvl > 1 ? ` <span class="badge">${ROMAN[lvl - 1]}</span>` : ''}${inst.auto ? ` <span class="badge">${t('binfo.auto')}</span>` : ''}</h3>
    <p>${esc(td('b', inst.t))}</p>`;
  const rows: string[] = [];
  if (inst.big) rows.push(t('binfo.big'));
  if (lvl > 1) rows.push(t('binfo.lvl', ROMAN[lvl - 1]));
  if (def.jobs) {
    rows.push(t('binfo.workers', g.s.assigned[inst.t] || 0, slots(g, inst.t), def.jobs * (inst.big ? 4 : 1)));
    if (!def.noHaul) rows.push(t('binfo.haul', Math.round(haulEffOf(inst.d ?? 0, g.m.haulRange) * 100), inst.d ?? 0));
    if (inst.adj && inst.adj > 1) rows.push(t('binfo.adj', Math.round((inst.adj - 1) * 100)));
    if (inst.dm && inst.dm > 1) rows.push(t('binfo.district', Math.round((inst.dm - 1) * 100)));
  }
  if (def.housing) rows.push(t('binfo.housing', def.housing * (inst.big ? 5 : 1) * (lvl === 3 ? 4 : lvl === 2 ? 2 : 1)));
  if (def.water) rows.push(t('binfo.water', def.water * (lvl === 3 ? 4 : lvl === 2 ? 2 : 1)));
  if (def.hap) rows.push(t('binfo.hap', Math.round(def.hap * 100)));
  if (def.capBoost) rows.push(t('binfo.cap'));
  if (rows.length) body += `<p style="line-height:1.7">${rows.join('<br>')}</p>`;

  const btns: { label: string; cls?: string; cb?: () => void }[] = [];
  // vylepšení úrovně
  const ucost = upgradeCostB(g, idx);
  if (ucost) {
    const eraOk = upgradeEraOk(g, idx);
    btns.push({
      label: `⬆ ${t('binfo.lvlUp', ROMAN[lvl])} (${eraOk ? costStr(ucost) : t('err.era')})`,
      cb: () => {
        const err = upgradeBuilding(g, idx);
        if (err) { toast('⚠️ ' + t(err)); bus.emit('error'); }
      },
    });
  }
  // sloučení / rozdělení
  if (findMergeGroup(g, idx)) {
    btns.push({
      label: t('binfo.merge'), cb: () => {
        const err = mergeBuildings(g, idx);
        if (err) { toast('⚠️ ' + t(err)); bus.emit('error'); }
      },
    });
  }
  if (inst.big) {
    btns.push({
      label: t('binfo.split'), cb: () => {
        const err = splitBuilding(g, idx);
        if (err) { toast('⚠️ ' + t(err)); bus.emit('error'); }
      },
    });
  }
  if (!def.unbuildable) {
    btns.push({
      label: t('binfo.demolish'), cls: 'warn', cb: () => {
        const err = demolish(g, idx);
        if (err) { toast('⚠️ ' + t(err)); bus.emit('error'); }
      },
    });
  }
  btns.push({ label: t('ok') });
  showModal(body, btns);
}

// ---------- rozpad spokojenosti ----------
function showHapBreakdown() {
  const rows = g.hapParts.map(p => {
    const pct = Math.round(p.v * 100);
    const col = pct > 0 ? '#7ee787' : pct < 0 ? '#ff7b72' : '#8b949e';
    return `<label><span>${esc(t(p.key))}</span><b style="color:${col}">${pct >= 0 ? '+' : ''}${pct} %</b></label>`;
  }).join('');
  showModal(`<h3>${t('hap.title', Math.round(g.happiness * 100))}</h3>${rows}<hr><p>${t('hap.info')}</p>`,
    [{ label: t('ok') }]);
}

// ---------- title screen ----------
export function showTitle(cont: boolean, onStart: (fresh: boolean) => void) {
  const wrap = el('div', '');
  wrap.id = 'title';
  const langBar = el('div', 'langbar');
  const content = el('div', 'tcontent');
  wrap.appendChild(langBar);
  wrap.appendChild(content);

  const renderLangs = () => {
    langBar.innerHTML = '';
    for (const L of LANGS) {
      const b = el('button', 'langbtn' + (getLang() === L.id ? ' active' : ''), L.flag) as HTMLButtonElement;
      b.title = L.label;
      b.onclick = () => { g.s.settings.lang = L.id; setLang(L.id); renderLangs(); renderContent(); };
      langBar.appendChild(b);
    }
  };
  const renderContent = () => {
    content.innerHTML = `<h1>Civilization Idle</h1><div class="sub">${t('title.sub')}</div>`;
    if (cont) {
      const b = el('button', '', t('title.continue')) as HTMLButtonElement;
      b.onclick = () => { wrap.remove(); onStart(false); };
      content.appendChild(b);
    }
    const n = el('button', cont ? 'sec' : '', t('title.new')) as HTMLButtonElement;
    n.onclick = () => {
      if (cont) {
        showModal(`<h3>${t('title.new')}</h3><p>${t('title.newConfirm')}</p>`,
          [{ label: t('cancel') }, { label: t('title.newGo'), cls: 'warn', cb: () => { wrap.remove(); onStart(true); } }]);
      } else { wrap.remove(); onStart(true); }
    };
    content.appendChild(n);
    content.appendChild(el('div', 'foot', t('title.foot')));
  };
  renderLangs();
  renderContent();
  ui.appendChild(wrap);
}

// ---------- panely ----------
interface PanelDef { id: string; icon: string; render: () => void; show?: () => boolean }

const PANELS: PanelDef[] = [
  { id: 'build', icon: '🏗️', render: renderBuild },
  { id: 'work', icon: '👷', render: renderWork },
  { id: 'store', icon: '📦', render: renderStorage },
  { id: 'tech', icon: '🔬', render: renderTech, show: () => (g.bCount.library || 0) > 0 || g.s.techs.length > 0 },
  { id: 'upg', icon: '💡', render: renderUpgrades, show: () => g.s.techs.length > 0 },
  { id: 'ach', icon: '🏆', render: renderAchs },
  { id: 'asc', icon: '✨', render: renderAscension, show: () => g.maxEra >= 5 || (g.s.stats.ascensions || 0) > 0 || ascensionUnlocked(g) },
];

export function openPanel(id: string | null) {
  openedPanel = openedPanel === id ? null : id;
  for (const s of sideBtns) s.btn.classList.toggle('active', s.id === openedPanel);
  if (!openedPanel) { panelEl.classList.remove('open'); return; }
  ptitle.textContent = '';
  ptitle.innerHTML = t('t.' + openedPanel);
  panelEl.classList.add('open');
  PANELS.find(p => p.id === openedPanel)!.render();
}

export function refreshPanel() {
  if (!openedPanel) return;
  const st = pbody.scrollTop;
  PANELS.find(p => p.id === openedPanel)?.render();
  pbody.scrollTop = st;
}

function costHtml(cost: Rec, extra = ''): string {
  const parts: string[] = [];
  for (const [r, v] of Object.entries(cost)) {
    const have = (g.s.res[r] || 0) >= v;
    parts.push(`<span class="${have ? 'ok' : 'no'}">${RES_BY[r]?.icon || ''}${fmt(v)}</span>`);
  }
  return `<div class="cost">${parts.join(' ')} ${extra}</div>`;
}

// --- Stavby ---
let buildTab: BCat | 'all' = 'all';
const CATS: (BCat | 'all')[] = ['all', 'city', 'food', 'mine', 'ind', 'other'];
const CAT_KEY: Record<string, string> = { all: 'cat.all', city: 'cat.city', food: 'cat.food', mine: 'cat.mine', ind: 'cat.ind', other: 'cat.other' };

function renderBuild() {
  pbody.innerHTML = '';
  const unlocked = BUILDINGS.filter(d => !d.unbuildable && (!d.tech || hasTech(g.s, d.tech)));
  // taby až když je co třídit
  if (unlocked.length > 8) {
    const tabs = el('div', 'tabs');
    for (const c of CATS) {
      if (c !== 'all' && !unlocked.some(d => d.cat === c)) continue;
      const b = el('button', 'tab' + (buildTab === c ? ' active' : ''), t(CAT_KEY[c])) as HTMLButtonElement;
      b.onclick = () => { buildTab = c; renderBuild(); };
      tabs.appendChild(b);
    }
    pbody.appendChild(tabs);
  } else buildTab = 'all';
  pbody.appendChild(el('div', 'idlebox', `<span>${t('build.info')}</span>`));

  for (const def of unlocked) {
    if (buildTab !== 'all' && def.cat !== buildTab) continue;
    const cost = buildCost(g, def.id);
    const n = g.bCount[def.id] || 0;
    const card = el('div', 'card' + (g.runtime.buildSel === def.id ? ' sel' : ''));
    let stat = '';
    if (def.jobs) stat = `<span class="badge">${t('build.slots', def.jobs)}</span>`;
    if (def.housing) stat = `<span class="badge">${t('build.housing', def.housing)}</span>`;
    if (def.water) stat += `<span class="badge">${t('build.water', def.water)}</span>`;
    card.innerHTML = `<h4>${def.icon} ${esc(tn('b', def.id))} ${n ? `<span class="badge">×${n}</span>` : ''} ${stat}</h4>
      <div class="desc">${esc(td('b', def.id))}</div>${costHtml(cost)}`;
    const btn = el('button', '', g.runtime.buildSel === def.id ? t('build.cancel') : t('build.btn')) as HTMLButtonElement;
    btn.disabled = !canAfford(g, cost) && g.runtime.buildSel !== def.id;
    btn.onclick = () => {
      g.runtime.buildSel = g.runtime.buildSel === def.id ? null : def.id;
      document.getElementById('game')!.classList.toggle('building', !!g.runtime.buildSel);
      renderBuild();
    };
    card.appendChild(btn);
    pbody.appendChild(card);
  }
}

// --- Pracovníci ---
function renderWork() {
  pbody.innerHTML = '';
  const idle = g.s.pop - sumAssigned(g.s);
  const box = el('div', 'idlebox', `<span>${t('work.idle', idle, g.s.pop)}</span>${g.m.autoAssign ? `<span class="badge">${t('work.foreman')}</span>` : ''}`);
  pbody.appendChild(box);

  let any = false;
  for (const def of BUILDINGS) {
    if (!def.jobs) continue;
    const sl = slots(g, def.id);
    if (sl === 0) continue;
    any = true;
    const cur = g.s.assigned[def.id] || 0;
    const row = el('div', 'trow');
    let prodTxt = '';
    if (def.prod) prodTxt = `${RES_BY[def.prod.res]?.icon || ''} ${fmtRate(g.rates[def.prod.res] || 0)}`;
    else if (def.recipe) prodTxt = Object.keys(def.recipe.outputs).map(r => RES_BY[r]?.icon || '').join('');
    row.innerHTML = `<div style="font-size:19px">${def.icon}</div>
      <div class="nm">${esc(tjob(def.id))}<small>${esc(tn('b', def.id))} · ${prodTxt}</small></div>
      <div class="cnt"><b>${cur}</b> / ${sl}</div>`;
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = String(sl); slider.value = String(cur);
    slider.oninput = () => {
      setAssign(g, def.id, Number(slider.value));
      const now = g.s.assigned[def.id] || 0;
      if (String(now) !== slider.value) slider.value = String(now);
      (row.querySelector('.cnt') as HTMLElement).innerHTML = `<b>${now}</b> / ${sl}`;
      (box.querySelector('b') as HTMLElement).textContent = String(g.s.pop - sumAssigned(g.s));
    };
    row.appendChild(slider);
    pbody.appendChild(row);
  }
  if (!any) pbody.appendChild(el('div', 'card', t('work.empty')));
}

// --- Sklad ---
function renderStorage() {
  pbody.innerHTML = '';
  pbody.appendChild(el('div', 'idlebox', `<span>${t('store.head')}</span>`));
  for (const r of RES) {
    const discovered = (g.s.totals[r.id] || 0) > 0 || (g.s.res[r.id] || 0) > 0;
    if (!discovered) continue;
    const amount = g.s.res[r.id] || 0;
    const cap = capOf(g, r.id);
    const rate = g.rates[r.id] || 0;
    let eta = '';
    if (isFinite(cap)) {
      if (rate > 0.005 && amount < cap) eta = t('store.full', fmtTime((cap - amount) / rate));
      else if (rate < -0.005 && amount > 0) eta = t('store.empty2', fmtTime(amount / -rate));
    } else eta = t('store.nocap');
    const pct = isFinite(cap) ? Math.min(100, (amount / cap) * 100) : 0;
    const barCol = pct >= 95 ? '#ff7b72' : pct >= 70 ? '#d29922' : '#4a6da8';
    const row = el('div', 'srow');
    row.innerHTML = `<div style="font-size:17px">${r.icon}</div>
      <div class="nm">${esc(tres(r.id))}<small>${eta}</small></div>
      <div class="cnt"><b>${fmt(amount)}</b>${isFinite(cap) ? ' / ' + fmt(cap) : ''}
        <span class="rate ${rate > 0.005 ? 'pos' : rate < -0.005 ? 'neg' : ''}">${Math.abs(rate) > 0.005 ? fmtRate(rate) : ''}</span></div>
      ${isFinite(cap) ? `<div class="sbar"><i style="width:${pct}%;background:${barCol}"></i></div>` : ''}`;
    pbody.appendChild(row);
  }
}

// --- Technologie ---
function renderTech() {
  pbody.innerHTML = '';
  pbody.appendChild(el('div', 'idlebox', `<span>${t('tech.res', fmt(g.s.res.research || 0), fmtRate(g.rates.research || 0))}</span>`));
  let era = -1;
  for (const td2 of TECHS) {
    const owned = hasTech(g.s, td2.id);
    const avail = techAvailable(g, td2.id);
    if (!owned && !avail && td2.era > g.maxEra + 1) continue;
    if (td2.era !== era) { era = td2.era; pbody.appendChild(el('div', 'era-h', t('tech.era', era, tera(era)))); }
    const card = el('div', 'card' + (owned ? ' owned' : avail ? '' : ' locked'));
    const reqTxt = td2.req.length && !owned && !avail
      ? `<div class="desc">${t('tech.req', td2.req.map(r => esc(tn('tech', r))).join(', '))}</div>` : '';
    card.innerHTML = `<h4>${esc(tn('tech', td2.id))}</h4><div class="desc">${esc(td('tech', td2.id))}</div>${reqTxt}`;
    if (!owned) {
      const costR: Rec = { research: td2.cost, ...(td2.mats || {}) };
      card.innerHTML += costHtml(costR);
      if (avail) {
        const btn = el('button', '', t('tech.buy')) as HTMLButtonElement;
        btn.disabled = (g.s.res.research || 0) < td2.cost || (td2.mats ? !canAfford(g, td2.mats) : false);
        btn.onclick = () => {
          const err = buyTech(g, td2.id);
          if (err) { toast('⚠️ ' + t(err)); bus.emit('error'); }
          else { toast(t('tech.done', esc(tn('tech', td2.id)))); renderTech(); }
        };
        card.appendChild(btn);
      }
    }
    pbody.appendChild(card);
  }
}

// --- Vylepšení ---
function renderUpgrades() {
  pbody.innerHTML = '';
  for (const u of UPGRADES) {
    const lvl = g.s.upgrades[u.id] || 0;
    const maxed = lvl >= u.max;
    if (u.reqTech && !hasTech(g.s, u.reqTech)) {
      pbody.appendChild(el('div', 'card locked', `<h4>${u.icon} ${esc(tn('upg', u.id))}</h4><div class="desc">${t('upg.reqTech', esc(tn('tech', u.reqTech)))}</div>`));
      continue;
    }
    const card = el('div', 'card' + (maxed ? ' owned' : ''));
    card.innerHTML = `<h4>${u.icon} ${esc(tn('upg', u.id))} ${u.max > 1 ? `<span class="badge">${lvl}/${u.max}</span>` : ''}</h4>
      <div class="desc">${esc(td('upg', u.id))}</div>`;
    if (!maxed) {
      const cost = upgradeCost(g, u.id);
      card.innerHTML += costHtml(cost);
      const btn = el('button', '', lvl > 0 ? t('upg.lvl') : t('upg.buy')) as HTMLButtonElement;
      btn.disabled = !canAfford(g, cost);
      btn.onclick = () => {
        const err = buyUpgrade(g, u.id);
        if (err) { toast('⚠️ ' + t(err)); bus.emit('error'); }
        else renderUpgrades();
      };
      card.appendChild(btn);
    }
    pbody.appendChild(card);
  }
}

// --- Úspěchy ---
function renderAchs() {
  pbody.innerHTML = '';
  pbody.appendChild(el('div', 'idlebox', `<span>${t('ach.head', g.s.achs.length, ACHS.length)}</span>`));
  const grid = el('div', 'agrid');
  for (const a of ACHS) {
    const got = g.s.achs.includes(a.id);
    const cell = el('div', 'acell ' + (got ? 'yes' : 'no'), a.icon);
    cell.title = `${tn('ach', a.id)}\n${td('ach', a.id)}`;
    grid.appendChild(cell);
  }
  pbody.appendChild(grid);
}

// --- Vzestup ---
function renderAscension() {
  pbody.innerHTML = '';
  const gain = ascendGain(g);
  const unlocked = ascensionUnlocked(g);
  const head = el('div', 'card', `<h4>${t('asc.title')}</h4>
    <div class="desc">${t('asc.desc')}</div>
    <div class="desc">${t('asc.score', fmt(civScore(g)))}<br>
    ${t('asc.gain', gain, g.s.legacy.pts)}<br>
    ${t('asc.count', g.s.stats.ascensions || 0)}</div>`);
  const btn = el('button', '', unlocked ? t('asc.btn') : t('asc.locked')) as HTMLButtonElement;
  btn.disabled = !unlocked || gain < 1;
  btn.onclick = () => {
    showModal(`<h3>${t('asc.title')}</h3><p>${t('asc.confirm', gain)}</p>`,
      [{ label: t('cancel') }, {
        label: t('asc.go'), cls: 'warn', cb: () => {
          doAscend(g);
          saveGame(g);
          openPanel(null);
          toast(t('asc.done', gain), 'gold');
        },
      }]);
  };
  head.appendChild(btn);
  pbody.appendChild(head);

  pbody.appendChild(el('div', 'era-h', t('asc.perks', g.s.legacy.pts)));
  for (const p of PERKS) {
    const lvl = g.s.legacy.perks[p.id] || 0;
    const maxed = lvl >= p.max;
    const card = el('div', 'card' + (maxed ? ' owned' : ''));
    card.innerHTML = `<h4>${p.icon} ${esc(tn('perk', p.id))} <span class="badge">${lvl}/${p.max}</span></h4>
      <div class="desc">${esc(td('perk', p.id))}</div>`;
    if (!maxed) {
      const cost = perkCost(g, p.id);
      card.innerHTML += `<div class="cost"><span class="${g.s.legacy.pts >= cost ? 'ok' : 'no'}">✨${cost}</span></div>`;
      const btn2 = el('button', '', t('upg.buy')) as HTMLButtonElement;
      btn2.disabled = g.s.legacy.pts < cost;
      btn2.onclick = () => {
        const err = buyPerk(g, p.id);
        if (err) toast('⚠️ ' + t(err)); else renderAscension();
      };
      card.appendChild(btn2);
    }
    pbody.appendChild(card);
  }
}

// ---------- nastavení ----------
function showSettings() {
  const s = g.s.settings;
  const back = el('div', 'mback');
  const m = el('div', 'modal');
  m.innerHTML = `<h3>${t('set.title')}</h3>`;
  const mk = (label: string, val: number, cb: (v: number) => void) => {
    const l = el('label', '', `<span>${label}</span>`);
    const r = document.createElement('input');
    r.type = 'range'; r.min = '0'; r.max = '1'; r.step = '0.05'; r.value = String(val);
    r.oninput = () => cb(Number(r.value));
    l.appendChild(r);
    m.appendChild(l);
  };
  mk(t('set.sfx'), s.sfx, v => { s.sfx = v; bus.emit('volumes'); });
  mk(t('set.music'), s.music, v => { s.music = v; bus.emit('volumes'); });
  const mkChk = (label: string, val: boolean, cb: (v: boolean) => void) => {
    const l = el('label', '', `<span>${label}</span>`);
    const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = val;
    c.onchange = () => cb(c.checked);
    l.appendChild(c);
    m.appendChild(l);
  };
  mkChk(t('set.particles'), s.particles, v => s.particles = v);
  mkChk(t('set.daynight'), s.daynight, v => s.daynight = v);

  // jazyk
  const langRow = el('label', '', `<span>${t('set.lang')}</span>`);
  const langBtns = el('span');
  for (const L of LANGS) {
    const b = el('button', 'langbtn' + (getLang() === L.id ? ' active' : ''), L.flag) as HTMLButtonElement;
    b.title = L.label;
    b.onclick = () => {
      s.lang = L.id; setLang(L.id);
      back.remove(); showSettings();
    };
    langBtns.appendChild(b);
  }
  langRow.appendChild(langBtns);
  m.appendChild(langRow);
  m.appendChild(el('hr'));

  // export/import
  m.appendChild(el('p', '', t('set.transfer')));
  const ta = document.createElement('textarea');
  ta.placeholder = t('set.importPh');
  m.appendChild(ta);
  const row = el('div', 'btns');
  const ex = el('button', '', t('set.export')) as HTMLButtonElement;
  ex.onclick = () => { ta.value = exportSave(g); ta.select(); try { navigator.clipboard?.writeText(ta.value); toast(t('set.copied')); } catch { /* */ } };
  const im = el('button', '', t('set.import')) as HTMLButtonElement;
  im.onclick = () => {
    try {
      const st = importSave(ta.value);
      back.remove();
      onImportCb(st);
      toast(t('set.imported'));
    } catch { toast(t('set.badCode')); }
  };
  row.appendChild(ex); row.appendChild(im);
  m.appendChild(row);
  m.appendChild(el('hr'));

  m.appendChild(el('p', '', t('set.stats', fmtTime(g.s.playtime / 1000), fmt(g.s.stats.lifetimeClicks), g.s.stats.peakPop, g.s.stats.ascensions || 0)));

  const helpBtn = el('button', '', t('set.help')) as HTMLButtonElement;
  helpBtn.onclick = () => {
    back.remove();
    showModal(`<h3>${t('help.title')}</h3><p>${t('help.1')}</p><p>${t('help.2')}</p><p>${t('help.3')}</p><p>${t('help.4')}</p>`,
      [{ label: t('help.ok') }]);
  };
  m.appendChild(helpBtn);

  const danger = el('div', 'btns');
  const hr = el('button', 'warn', t('set.reset')) as HTMLButtonElement;
  hr.onclick = () => {
    back.remove();
    showModal(`<h3>${t('set.reset')}</h3><p>${t('set.resetConfirm')}</p>`,
      [{ label: t('cancel') }, { label: t('set.resetGo'), cls: 'warn', cb: () => { hardReset(); location.reload(); } }]);
  };
  const close = el('button', '', t('set.close')) as HTMLButtonElement;
  close.onclick = () => { back.remove(); saveGame(g); };
  danger.appendChild(hr); danger.appendChild(close);
  m.appendChild(danger);
  back.appendChild(m);
  ui.appendChild(back);
}

// ---------- top bar ----------
const chipEls = new Map<string, { root: HTMLElement; amt: HTMLElement; rate: HTMLElement; bar: HTMLElement }>();
let popChip: HTMLElement, hapChip: HTMLElement, waterChip: HTMLElement, energyChip: HTMLElement, eraChip: HTMLElement, buffWrap: HTMLElement;
const ERA_ICONS = ['🪨', '🥉', '🏛️', '🏰', '🏭', '🏙️', '🚀'];
const BUFF_KEY: Record<string, string> = { frenzy: 'buff.frenzy', clickFrenzy: 'buff.click', festival: 'buff.festival' };

function updateTopbar() {
  for (const r of RES) {
    const discovered = (g.s.totals[r.id] || 0) > 0 || (g.s.res[r.id] || 0) > 0 || ['wood', 'food'].includes(r.id);
    let c = chipEls.get(r.id);
    if (!discovered) { if (c) { c.root.remove(); chipEls.delete(r.id); } continue; }
    if (!c) {
      const root = el('span', 'chip');
      root.innerHTML = `${r.icon} <b></b><span class="rate"></span><span class="cbar"><i></i></span>`;
      c = { root, amt: root.querySelector('b')!, rate: root.querySelector('.rate')!, bar: root.querySelector('.cbar i')! };
      chipEls.set(r.id, c);
      root.onclick = () => openPanel('store');
      topbar.insertBefore(root, popChip ?? null);
    }
    const cap = capOf(g, r.id);
    const amount = g.s.res[r.id] || 0;
    c.amt.textContent = fmt(amount);
    const rate = g.rates[r.id] || 0;
    c.rate.textContent = Math.abs(rate) > 0.005 ? ' ' + fmtRate(rate) : '';
    c.rate.className = 'rate ' + (rate > 0.005 ? 'pos' : rate < -0.005 ? 'neg' : '');
    if (isFinite(cap)) {
      const pct = Math.min(100, (amount / cap) * 100);
      c.bar.style.width = pct + '%';
      c.bar.style.background = pct >= 95 ? '#ff7b72' : pct >= 70 ? '#d29922' : '#4a6da8';
      (c.bar.parentElement as HTMLElement).style.display = '';
    } else (c.bar.parentElement as HTMLElement).style.display = 'none';
    c.root.classList.toggle('warn', isFinite(cap) && amount >= cap * 0.98);
    c.root.title = `${tres(r.id)}: ${Math.floor(amount)}${isFinite(cap) ? ' / ' + fmt(cap) : ''}`;
  }
  popChip.innerHTML = `👥 <b>${fmt(g.s.pop)}</b><span class="rate">/${fmt(housingCap(g))}</span>`;
  popChip.title = t('top.pop', waterCap(g));

  // voda: ukazuj, dokud není pohodlná rezerva
  const water = waterCap(g);
  if (water < g.s.pop * 1.2) {
    waterChip.style.display = '';
    waterChip.innerHTML = `💧 <b>${fmt(water)}</b><span class="rate">/${fmt(g.s.pop)}</span>`;
    waterChip.classList.toggle('warn', water < g.s.pop);
    waterChip.title = t('top.water');
  } else waterChip.style.display = 'none';

  const hpct = Math.round(g.happiness * 100);
  hapChip.innerHTML = `${hpct >= 75 ? '😊' : hpct >= 45 ? '🙂' : '☹️'} <b>${hpct}%</b>`;
  hapChip.title = t('top.hap');
  if (g.energy.use > 0 || g.energy.prod > 0) {
    energyChip.style.display = '';
    energyChip.innerHTML = `⚡ <b>${fmt(g.energy.prod)}</b><span class="rate">/${fmt(g.energy.use)}</span>`;
    energyChip.classList.toggle('warn', g.energy.throttle < 1);
  } else energyChip.style.display = 'none';
  eraChip.innerHTML = `${ERA_ICONS[g.maxEra]} <b>${tera(g.maxEra)}</b>`;
  eraChip.title = t('top.era');
  buffWrap.innerHTML = '';
  const now = Date.now();
  for (const b of g.s.buffs) {
    buffWrap.appendChild(el('span', 'chip buff', `${b.icon} ${esc(t(BUFF_KEY[b.kind] || b.kind))} ${Math.ceil((b.until - now) / 1000)}s`));
  }
}

// ---------- hint ----------
function computeHint(): string {
  const s = g.s;
  if ((s.totals.wood || 0) < 15) return t('hint.wood');
  if (!g.bCount.hut) return t('hint.hut');
  if (!g.bCount.forestCamp && !g.bCount.gatherHut) return t('hint.camp');
  if (sumAssigned(s) === 0 && (slots(g, 'forestCamp') > 0 || slots(g, 'gatherHut') > 0)) return t('hint.assign');
  if (!g.bCount.library) return t('hint.library');
  if (s.techs.length === 0 && (s.res.research || 0) >= 10) return t('hint.tech');
  if (s.techs.length === 0) return t('hint.techWait');
  if ((g.rates.food || 0) < s.pop * 0.08 && (s.res.food || 0) < 50) return t('hint.food');
  if (g.happiness < 0.5) return t('hint.hap');
  if (s.pop >= housingCap(g)) return t('hint.housing');
  return '';
}

// ---------- init ----------
export function initUI(game: Game, opts: { renderer: Renderer; onNewGame: () => void; onImport: (s: any) => void }) {
  g = game;
  renderer = opts.renderer;
  onImportCb = opts.onImport;
  ui = document.getElementById('ui')!;
  ui.innerHTML = '';

  topbar = el('div'); topbar.id = 'topbar'; ui.appendChild(topbar);
  buffWrap = el('span');
  popChip = el('span', 'chip'); hapChip = el('span', 'chip'); waterChip = el('span', 'chip'); energyChip = el('span', 'chip'); eraChip = el('span', 'chip');
  energyChip.style.display = 'none'; waterChip.style.display = 'none';
  hapChip.style.cursor = 'pointer';
  hapChip.onclick = () => showHapBreakdown();
  topbar.appendChild(popChip); topbar.appendChild(waterChip); topbar.appendChild(hapChip); topbar.appendChild(energyChip); topbar.appendChild(eraChip);
  topbar.appendChild(buffWrap);
  topbar.appendChild(el('span', 'spacer'));
  const home = el('button', 'iconbtn', '🏠') as HTMLButtonElement;
  home.onclick = () => { renderer.cam.x = 0; renderer.cam.y = 0; };
  topbar.appendChild(home);
  const mute = el('button', 'iconbtn', g.s.settings.muted ? '🔇' : '🔊') as HTMLButtonElement;
  mute.onclick = () => {
    g.s.settings.muted = !g.s.settings.muted;
    mute.textContent = g.s.settings.muted ? '🔇' : '🔊';
    bus.emit('volumes');
  };
  topbar.appendChild(mute);
  const gear = el('button', 'iconbtn', '⚙️') as HTMLButtonElement;
  gear.onclick = () => showSettings();
  topbar.appendChild(gear);
  const setTips = () => { home.title = t('top.home'); mute.title = t('top.mute'); };
  setTips();

  // sidebar
  const sb = el('div'); sb.id = 'sidebar';
  sideBtns = [];
  for (const p of PANELS) {
    const b = el('button', 'sbtn') as HTMLButtonElement;
    b.dataset.p = p.id;
    b.onclick = () => openPanel(p.id);
    sb.appendChild(b);
    sideBtns.push({ id: p.id, btn: b, icon: p.icon });
  }
  const setSideLabels = () => { for (const s of sideBtns) s.btn.innerHTML = `${s.icon}<small>${t('p.' + s.id)}</small>`; };
  setSideLabels();
  ui.appendChild(sb);

  // panel
  panelEl = el('div'); panelEl.id = 'panel';
  const head = el('header');
  ptitle = el('span');
  const x = el('span', 'x', '✕');
  x.onclick = () => openPanel(null);
  head.appendChild(ptitle); head.appendChild(x);
  pbody = el('div'); pbody.id = 'pbody';
  panelEl.appendChild(head); panelEl.appendChild(pbody);
  ui.appendChild(panelEl);

  hintEl = el('div'); hintEl.id = 'hint'; ui.appendChild(hintEl);
  toastsEl = el('div'); toastsEl.id = 'toasts'; ui.appendChild(toastsEl);
  const mini = document.createElement('canvas');
  mini.id = 'minimap'; mini.width = 148; mini.height = 148;
  mini.style.width = '148px'; mini.style.height = '148px';
  ui.appendChild(mini);
  renderer.setMinimap(mini);
  mini.onclick = () => { renderer.cam.x = 0; renderer.cam.y = 0; };

  // eventy → UI feedback
  bus.on('ach', (a: any) => toast(t('ach.toast', esc(tn('ach', a.id)), esc(td('ach', a.id))), 'ach'));
  bus.on('era', (e: any) => toast(t('toast.era', tera(e.era)), 'gold'));
  bus.on('golden', (e: any) => {
    const msg = e.kind === 'gift' ? t('golden.gift', fmt(e.amt), tres(e.res)) : e.kind === 'clickFrenzy' ? t('golden.click') : t('golden.frenzy');
    toast('🌟 ' + msg, 'gold');
  });
  bus.on('goldenSpawn', () => toast(t('toast.golden'), 'gold'));
  bus.on('festival', () => toast(t('toast.festival')));
  bus.on('built', () => { if (openedPanel === 'build' || openedPanel === 'work') refreshPanel(); });
  bus.on('tech', () => { if (openedPanel === 'build' || openedPanel === 'upg') refreshPanel(); });
  bus.on('pop', () => { if (openedPanel === 'work') refreshPanel(); });
  bus.on('demolished', (e: any) => {
    const parts = Object.entries(e.refund as Rec).map(([r, v]) => `${RES_BY[r]?.icon || ''}${fmt(v as number)}`).join(' ');
    toast(t('toast.demolished', esc(tn('b', e.t)), parts || '—'));
    if (openedPanel === 'build' || openedPanel === 'work') refreshPanel();
  });
  bus.on('adj', (e: any) => toast(t('toast.adj', Math.round((e.mult - 1) * 100), esc(tn('b', e.t))), 'gold'));
  bus.on('merged', (e: any) => {
    toast(e.split ? t('toast.split', esc(tn('b', e.t))) : t('toast.merged', esc(tn('b', e.t))), 'gold');
    if (openedPanel === 'build' || openedPanel === 'work') refreshPanel();
  });
  bus.on('upgraded', (e: any) => toast(t('toast.upgraded', esc(tn('b', e.t)), ROMAN[e.lvl - 1]), 'gold'));
  bus.on('mergeHint', (e: any) => toast(t('toast.mergeHint', esc(tn('b', e.t))), 'gold'));
  bus.on('district', () => toast(t('toast.district'), 'gold'));
  bus.on('storageFull', (e: any) => {
    const d = RES_BY[e.res];
    toast(t('toast.full', d?.icon || '', esc(tres(e.res))));
  });
  bus.on('lang', () => {
    setSideLabels(); setTips();
    if (openedPanel) { ptitle.innerHTML = t('t.' + openedPanel); refreshPanel(); }
    hintTimer = 0;
    // znovunač chip tooltips při dalším update
    updateTopbar();
  });
}

let uiTimer = 0, hintTimer = 0, slowPanelTimer = 0;
export function uiFrame(dt: number) {
  uiTimer -= dt;
  if (uiTimer <= 0) {
    uiTimer = 0.25;
    updateTopbar();
  }
  hintTimer -= dt;
  if (hintTimer <= 0) {
    hintTimer = 1;
    const h = computeHint();
    hintEl.classList.toggle('off', !h);
    if (h && hintEl.innerHTML !== h) hintEl.innerHTML = h;
    if (openedPanel === 'tech' || openedPanel === 'asc' || openedPanel === 'store') refreshPanel();
  }
  slowPanelTimer -= dt;
  if (slowPanelTimer <= 0) {
    slowPanelTimer = 2;
    if (openedPanel === 'build' || openedPanel === 'upg') refreshPanel();
  }
}
