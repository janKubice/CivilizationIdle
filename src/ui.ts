// ===== UI vrstva: HUD, panely, menu, modaly (vanilla DOM, čte stav, posílá příkazy) =====

import { fmt, fmtRate, fmtTime, bus } from './util';
import { ERA_NAMES } from './config';
import { RES, RES_BY, B, BUILDINGS, TECHS, TECH_BY, UPGRADES, UPG_BY, ACHS, PERKS, Rec } from './data';
import { Game, slots, activeWorkers, sumAssigned, housingCap, waterCap, capOf } from './state';
import {
  buildCost, canAfford, upgradeCost, buyTech, buyUpgrade, setAssign, hasTech, techAvailable,
  ascendGain, ascensionUnlocked, civScore, perkCost, buyPerk, doAscend, OfflineSummary,
} from './sim';
import { saveGame, exportSave, importSave, hardReset, hasSave } from './save';
import type { Renderer } from './render';

let g: Game;
let renderer: Renderer;
let ui: HTMLElement;
let openedPanel: string | null = null;
let pbody: HTMLElement, ptitle: HTMLElement, panelEl: HTMLElement;
let topbar: HTMLElement, hintEl: HTMLElement, toastsEl: HTMLElement;
let onNewGameCb: () => void = () => {};
let onImportCb: (s: any) => void = () => {};

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function toast(msg: string, cls = '') {
  const t = el('div', 'toast ' + cls, msg);
  toastsEl.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 450); }, 4200);
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
    rows += `<div>${d?.icon || ''} ${esc(d?.name || r)}: <b style="color:#7ee787">+${fmt(v)}</b></div>`;
  }
  if (!rows) rows = '<div style="opacity:.7">Tvoji lidé odpočívali.</div>';
  showModal(`<h3>🌙 Byl jsi pryč ${fmtTime(sum.seconds)}</h3>
    <p>Civilizace mezitím pracovala (${fmtTime(sum.effSeconds)} efektivního času):</p>
    <div style="display:flex;flex-direction:column;gap:3px;font-size:13.5px">${rows}</div>`,
    [{ label: 'Pokračovat' }]);
}

// ---------- title screen ----------
export function showTitle(cont: boolean, onStart: (fresh: boolean) => void) {
  const t = el('div', '');
  t.id = 'title';
  t.innerHTML = `<h1>Civilization Idle</h1>
    <div class="sub">Od prvního kamene k laserovým těžebním puškám.<br>Klikej, stav, zkoumej — a nech své lidičky makat.</div>`;
  if (cont) {
    const b = el('button', '', '▶ Pokračovat') as HTMLButtonElement;
    b.onclick = () => { t.remove(); onStart(false); };
    t.appendChild(b);
  }
  const n = el('button', cont ? 'sec' : '', '✦ Nová hra') as HTMLButtonElement;
  n.onclick = () => {
    if (cont) {
      showModal('<h3>Nová hra</h3><p>Opravdu začít znovu? Současný postup (kromě nastavení) bude smazán, včetně Vzestupů.</p>',
        [{ label: 'Zrušit' }, { label: 'Začít znovu', cls: 'warn', cb: () => { t.remove(); onStart(true); } }]);
    } else { t.remove(); onStart(true); }
  };
  t.appendChild(n);
  t.appendChild(el('div', 'foot', 'v0.1 · vše se ukládá automaticky · funguje offline'));
  ui.appendChild(t);
}

// ---------- panely ----------
interface PanelDef { id: string; icon: string; label: string; title: string; render: () => void; show?: () => boolean }

const PANELS: PanelDef[] = [
  { id: 'build', icon: '🏗️', label: 'Stavby', title: '🏗️ Stavby', render: renderBuild },
  { id: 'work', icon: '👷', label: 'Práce', title: '👷 Pracovníci', render: renderWork },
  { id: 'tech', icon: '🔬', label: 'Věda', title: '🔬 Technologie', render: renderTech, show: () => (g.bCount.library || 0) > 0 || g.s.techs.length > 0 },
  { id: 'upg', icon: '💡', label: 'Vylepš.', title: '💡 Vylepšení', render: renderUpgrades, show: () => g.s.techs.length > 0 },
  { id: 'ach', icon: '🏆', label: 'Úspěchy', title: '🏆 Úspěchy', render: renderAchs },
  { id: 'asc', icon: '✨', label: 'Vzestup', title: '✨ Vzestup', render: renderAscension, show: () => g.maxEra >= 5 || (g.s.stats.ascensions || 0) > 0 || ascensionUnlocked(g) },
];

export function openPanel(id: string | null) {
  openedPanel = openedPanel === id ? null : id;
  document.querySelectorAll('.sbtn').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.p === openedPanel));
  if (!openedPanel) { panelEl.classList.remove('open'); return; }
  const p = PANELS.find(p => p.id === openedPanel)!;
  ptitle.textContent = p.title;
  panelEl.classList.add('open');
  p.render();
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
function renderBuild() {
  pbody.innerHTML = '';
  const info = el('div', 'idlebox', `<span>Vyber budovu a klikni do mapy. <b>Esc</b>/pravé tl. zruší.</span>`);
  pbody.appendChild(info);
  for (const def of BUILDINGS) {
    if (def.unbuildable) continue;
    if (def.tech && !hasTech(g.s, def.tech)) continue;
    const cost = buildCost(g, def.id);
    const n = g.bCount[def.id] || 0;
    const card = el('div', 'card' + (g.runtime.buildSel === def.id ? ' sel' : ''));
    let stat = '';
    if (def.jobs) stat = `<span class="badge">${def.jobs} míst${def.jobs >= 5 ? '' : 'a'}/ks</span>`;
    if (def.housing) stat = `<span class="badge">+${def.housing} bydlení</span>`;
    if (def.water) stat += `<span class="badge">+${def.water} voda</span>`;
    card.innerHTML = `<h4>${def.icon} ${esc(def.name)} ${n ? `<span class="badge">×${n}</span>` : ''} ${stat}</h4>
      <div class="desc">${esc(def.desc)}</div>${costHtml(cost)}`;
    const btn = el('button', '', g.runtime.buildSel === def.id ? '✕ Zrušit výběr' : 'Postavit') as HTMLButtonElement;
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
  const box = el('div', 'idlebox', `<span>😴 Nezaměstnaní: <b>${idle}</b> / ${g.s.pop}</span>`);
  if (g.m.autoAssign) {
    box.innerHTML += `<span class="badge">👷 Předák aktivní</span>`;
  }
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
      <div class="nm">${esc(def.jobName || def.name)}<small>${esc(def.name)} · ${prodTxt}</small></div>
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
  if (!any) pbody.appendChild(el('div', 'card', 'Postav budovy s pracovními místy (tábor, chýše, lom…) a přiřaď lidem práci.'));
}

// --- Technologie ---
function renderTech() {
  pbody.innerHTML = '';
  const rs = el('div', 'idlebox', `<span>🔬 Věda: <b>${fmt(g.s.res.research || 0)}</b> (${fmtRate(g.rates.research || 0)})</span>`);
  pbody.appendChild(rs);
  let era = -1;
  for (const t of TECHS) {
    const owned = hasTech(g.s, t.id);
    const avail = techAvailable(g, t.id);
    if (!owned && !avail && t.era > g.maxEra + 1) continue; // neukazuj hluboko zamčené
    if (t.era !== era) { era = t.era; pbody.appendChild(el('div', 'era-h', `Éra ${era} — ${ERA_NAMES[era]}`)); }
    const card = el('div', 'card' + (owned ? ' owned' : avail ? '' : ' locked'));
    const reqTxt = t.req.length && !owned && !avail
      ? `<div class="desc">Vyžaduje: ${t.req.map(r => esc(TECH_BY[r]?.name || r)).join(', ')}</div>` : '';
    card.innerHTML = `<h4>${esc(t.name)}</h4><div class="desc">${esc(t.desc)}</div>${reqTxt}`;
    if (!owned) {
      const costR: Rec = { research: t.cost, ...(t.mats || {}) };
      card.innerHTML += costHtml(costR);
      if (avail) {
        const btn = el('button', '', 'Vyzkoumat') as HTMLButtonElement;
        btn.disabled = (g.s.res.research || 0) < t.cost || (t.mats ? !canAfford(g, t.mats) : false);
        btn.onclick = () => {
          const err = buyTech(g, t.id);
          if (err) { toast('⚠️ ' + err); bus.emit('error'); }
          else { toast(`🔬 Vyzkoumáno: <b>${esc(t.name)}</b>`); renderTech(); }
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
      const card = el('div', 'card locked', `<h4>${u.icon} ${esc(u.name)}</h4><div class="desc">Vyžaduje: ${esc(TECH_BY[u.reqTech]?.name || u.reqTech)}</div>`);
      pbody.appendChild(card);
      continue;
    }
    const card = el('div', 'card' + (maxed ? ' owned' : ''));
    card.innerHTML = `<h4>${u.icon} ${esc(u.name)} ${u.max > 1 ? `<span class="badge">${lvl}/${u.max}</span>` : ''}</h4>
      <div class="desc">${esc(u.desc)}</div>`;
    if (!maxed) {
      const cost = upgradeCost(g, u.id);
      card.innerHTML += costHtml(cost);
      const btn = el('button', '', lvl > 0 ? 'Vylepšit' : 'Koupit') as HTMLButtonElement;
      btn.disabled = !canAfford(g, cost);
      btn.onclick = () => {
        const err = buyUpgrade(g, u.id);
        if (err) { toast('⚠️ ' + err); bus.emit('error'); }
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
  pbody.appendChild(el('div', 'idlebox', `<span>Získáno <b>${g.s.achs.length}</b>/${ACHS.length} · každý úspěch = <b>+2 %</b> produkce</span>`));
  const grid = el('div', 'agrid');
  for (const a of ACHS) {
    const got = g.s.achs.includes(a.id);
    const cell = el('div', 'acell ' + (got ? 'yes' : 'no'), a.icon);
    cell.title = `${a.name}\n${a.desc}`;
    grid.appendChild(cell);
  }
  pbody.appendChild(grid);
}

// --- Vzestup ---
function renderAscension() {
  pbody.innerHTML = '';
  const gain = ascendGain(g);
  const unlocked = ascensionUnlocked(g);
  const head = el('div', 'card', `<h4>✨ Vzestup civilizace</h4>
    <div class="desc">Resetuje město, suroviny a technologie. Získáš <b>Odkaz</b> — trvalou měnu na mocná vylepšení pro všechny další běhy. Úspěchy a nastavení zůstávají.</div>
    <div class="desc">Civilizační skóre: <b>${fmt(civScore(g))}</b><br>
    Odkaz při vzestupu: <b style="color:#ffd777">✨ +${gain}</b> (máš ${g.s.legacy.pts})<br>
    Vzestupů celkem: ${g.s.stats.ascensions || 0}</div>`);
  const btn = el('button', '', unlocked ? '✨ Provést Vzestup' : '🔒 Vyžaduje technologii Transcendence') as HTMLButtonElement;
  btn.disabled = !unlocked || gain < 1;
  btn.onclick = () => {
    showModal(`<h3>✨ Vzestup</h3><p>Civilizace vstoupí do dějin. Získáš <b>+${gain} Odkazu</b> a začneš znovu — silnější. Pokračovat?</p>`,
      [{ label: 'Zrušit' }, {
        label: 'Vzestoupit!', cls: 'warn', cb: () => {
          doAscend(g);
          saveGame(g);
          openPanel(null);
          toast(`✨ Vzestup dokončen! +${gain} Odkazu`, 'gold');
        },
      }]);
  };
  head.appendChild(btn);
  pbody.appendChild(head);

  pbody.appendChild(el('div', 'era-h', `Odkaz předků — máš ✨ ${g.s.legacy.pts}`));
  for (const p of PERKS) {
    const lvl = g.s.legacy.perks[p.id] || 0;
    const maxed = lvl >= p.max;
    const card = el('div', 'card' + (maxed ? ' owned' : ''));
    card.innerHTML = `<h4>${p.icon} ${esc(p.name)} <span class="badge">${lvl}/${p.max}</span></h4>
      <div class="desc">${esc(p.desc)}</div>`;
    if (!maxed) {
      const cost = perkCost(g, p.id);
      card.innerHTML += `<div class="cost"><span class="${g.s.legacy.pts >= cost ? 'ok' : 'no'}">✨${cost}</span></div>`;
      const btn2 = el('button', '', 'Koupit') as HTMLButtonElement;
      btn2.disabled = g.s.legacy.pts < cost;
      btn2.onclick = () => {
        const err = buyPerk(g, p.id);
        if (err) toast('⚠️ ' + err); else renderAscension();
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
  m.innerHTML = `<h3>⚙️ Nastavení</h3>`;
  const mk = (label: string, val: number, cb: (v: number) => void) => {
    const l = el('label', '', `<span>${label}</span>`);
    const r = document.createElement('input');
    r.type = 'range'; r.min = '0'; r.max = '1'; r.step = '0.05'; r.value = String(val);
    r.oninput = () => cb(Number(r.value));
    l.appendChild(r);
    m.appendChild(l);
  };
  mk('🔊 Zvuky', s.sfx, v => { s.sfx = v; bus.emit('volumes'); });
  mk('🎵 Hudba', s.music, v => { s.music = v; bus.emit('volumes'); });
  const mkChk = (label: string, val: boolean, cb: (v: boolean) => void) => {
    const l = el('label', '', `<span>${label}</span>`);
    const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = val;
    c.onchange = () => cb(c.checked);
    l.appendChild(c);
    m.appendChild(l);
  };
  mkChk('✨ Particly', s.particles, v => s.particles = v);
  mkChk('🌙 Denní cyklus', s.daynight, v => s.daynight = v);
  m.appendChild(el('hr'));

  // export/import
  m.appendChild(el('p', '', '<b>Přenos uložené hry</b>'));
  const ta = document.createElement('textarea');
  ta.placeholder = 'Sem vlož kód pro import…';
  m.appendChild(ta);
  const row = el('div', 'btns');
  const ex = el('button', '', '📤 Export') as HTMLButtonElement;
  ex.onclick = () => { ta.value = exportSave(g); ta.select(); try { navigator.clipboard?.writeText(ta.value); toast('Zkopírováno do schránky.'); } catch { /* */ } };
  const im = el('button', '', '📥 Import') as HTMLButtonElement;
  im.onclick = () => {
    try {
      const st = importSave(ta.value);
      back.remove();
      onImportCb(st);
      toast('Hra načtena z importu.');
    } catch { toast('⚠️ Neplatný kód.'); }
  };
  row.appendChild(ex); row.appendChild(im);
  m.appendChild(row);
  m.appendChild(el('hr'));

  const stats = el('p', '', `⏱️ Odehráno: ${fmtTime(g.s.playtime / 1000)} · 👆 kliků: ${fmt(g.s.stats.lifetimeClicks)} · 👥 rekord: ${g.s.stats.peakPop} · ✨ vzestupů: ${g.s.stats.ascensions || 0}`);
  m.appendChild(stats);

  const danger = el('div', 'btns');
  const hr = el('button', 'warn', '🗑️ Smazat vše') as HTMLButtonElement;
  hr.onclick = () => {
    back.remove();
    showModal('<h3>Smazat vše</h3><p>Opravdu? Smaže se kompletně celý postup včetně Vzestupů a Odkazu. Toto nelze vrátit.</p>',
      [{ label: 'Zrušit' }, { label: 'SMAZAT VŠE', cls: 'warn', cb: () => { hardReset(); location.reload(); } }]);
  };
  const close = el('button', '', 'Zavřít') as HTMLButtonElement;
  close.onclick = () => { back.remove(); saveGame(g); };
  danger.appendChild(hr); danger.appendChild(close);
  m.appendChild(danger);
  back.appendChild(m);
  ui.appendChild(back);
}

// ---------- top bar ----------
const chipEls = new Map<string, { root: HTMLElement; amt: HTMLElement; rate: HTMLElement }>();
let popChip: HTMLElement, hapChip: HTMLElement, energyChip: HTMLElement, buffWrap: HTMLElement;

function buildTopbar() {
  topbar = el('div');
  topbar.id = 'topbar';
  ui.appendChild(topbar);
  buffWrap = el('span');
}

function updateTopbar() {
  // suroviny (objevené)
  for (const r of RES) {
    const discovered = (g.s.totals[r.id] || 0) > 0 || (g.s.res[r.id] || 0) > 0 || ['wood', 'food'].includes(r.id);
    let c = chipEls.get(r.id);
    if (!discovered) { if (c) { c.root.remove(); chipEls.delete(r.id); } continue; }
    if (!c) {
      const root = el('span', 'chip');
      root.innerHTML = `${r.icon} <b></b><span class="rate"></span>`;
      c = { root, amt: root.querySelector('b')!, rate: root.querySelector('.rate')! };
      chipEls.set(r.id, c);
      topbar.insertBefore(root, popChip ?? null);
    }
    const cap = capOf(g, r.id);
    const amount = g.s.res[r.id] || 0;
    c.amt.textContent = fmt(amount);
    const rate = g.rates[r.id] || 0;
    c.rate.textContent = Math.abs(rate) > 0.005 ? ' ' + fmtRate(rate) : '';
    c.rate.className = 'rate ' + (rate > 0.005 ? 'pos' : rate < -0.005 ? 'neg' : '');
    c.root.classList.toggle('warn', isFinite(cap) && amount >= cap * 0.98);
    c.root.title = `${r.name}: ${Math.floor(amount)}${isFinite(cap) ? ' / ' + fmt(cap) : ''}`;
  }
  popChip.innerHTML = `👥 <b>${g.s.pop}</b><span class="rate">/${housingCap(g)}</span>`;
  popChip.title = `Populace / bydlení. Voda pro ${waterCap(g)} lidí.`;
  const hpct = Math.round(g.happiness * 100);
  hapChip.innerHTML = `${hpct >= 75 ? '😊' : hpct >= 45 ? '🙂' : '☹️'} <b>${hpct}%</b>`;
  hapChip.title = 'Spokojenost — ovlivňuje produkci i růst populace';
  if (g.energy.use > 0 || g.energy.prod > 0) {
    energyChip.style.display = '';
    energyChip.innerHTML = `⚡ <b>${fmt(g.energy.prod)}</b><span class="rate">/${fmt(g.energy.use)}</span>`;
    energyChip.classList.toggle('warn', g.energy.throttle < 1);
  } else energyChip.style.display = 'none';
  // buffy
  buffWrap.innerHTML = '';
  const now = Date.now();
  for (const b of g.s.buffs) {
    buffWrap.appendChild(el('span', 'chip buff', `${b.icon} ${esc(b.label)} ${Math.ceil((b.until - now) / 1000)}s`));
  }
}

// ---------- hint ----------
function computeHint(): string {
  const s = g.s;
  if ((s.totals.wood || 0) < 15) return '🪵 Klikej na stromy a nasbírej dřevo!';
  if (!g.bCount.hut) return '🏠 Otevři Stavby a postav Chatrč — přijdou noví obyvatelé.';
  if (!g.bCount.forestCamp && !g.bCount.gatherHut) return '🪓 Postav Dřevorubecký tábor nebo Sběračskou chýši — lidé budou pracovat za tebe.';
  if (sumAssigned(s) === 0 && (slots(g, 'forestCamp') > 0 || slots(g, 'gatherHut') > 0)) return '👷 Otevři panel Práce a přiřaď lidem zaměstnání.';
  if (!g.bCount.library) return '📚 Postav Knihovnu a začni generovat vědu.';
  if (s.techs.length === 0 && (s.res.research || 0) >= 15) return '🔬 Otevři Vědu a vyzkoumej první technologii!';
  if (s.techs.length === 0) return '🔬 Učenci v knihovně generují vědu na první technologii…';
  if ((g.rates.food || 0) < s.pop * 0.08 && (s.res.food || 0) < 50) return '🍎 Pozor na jídlo! Přiřaď víc sběračů nebo postav farmy.';
  if (g.happiness < 0.5) return '☹️ Spokojenost je nízká — postav studnu, tržiště nebo chrám.';
  if (s.pop >= housingCap(g)) return '🏠 Bydlení je plné. Postav chatrče/domy, nebo počkej — město roste i samo.';
  return '';
}

// ---------- init ----------
export function initUI(game: Game, opts: { renderer: Renderer; onNewGame: () => void; onImport: (s: any) => void }) {
  g = game;
  renderer = opts.renderer;
  onNewGameCb = opts.onNewGame;
  onImportCb = opts.onImport;
  ui = document.getElementById('ui')!;
  ui.innerHTML = '';

  buildTopbar();
  popChip = el('span', 'chip'); hapChip = el('span', 'chip'); energyChip = el('span', 'chip');
  energyChip.style.display = 'none';
  topbar.appendChild(popChip); topbar.appendChild(hapChip); topbar.appendChild(energyChip);
  topbar.appendChild(buffWrap);
  topbar.appendChild(el('span', 'spacer'));
  const home = el('button', 'iconbtn', '🏠') as HTMLButtonElement;
  home.title = 'Na náves';
  home.onclick = () => { renderer.cam.x = 0; renderer.cam.y = 0; };
  topbar.appendChild(home);
  const gear = el('button', 'iconbtn', '⚙️') as HTMLButtonElement;
  gear.onclick = () => showSettings();
  topbar.appendChild(gear);

  // sidebar
  const sb = el('div'); sb.id = 'sidebar';
  for (const p of PANELS) {
    const b = el('button', 'sbtn', `${p.icon}<small>${p.label}</small>`) as HTMLButtonElement;
    b.dataset.p = p.id;
    b.onclick = () => openPanel(p.id);
    sb.appendChild(b);
  }
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

  // hint + toasty + minimapa
  hintEl = el('div'); hintEl.id = 'hint'; ui.appendChild(hintEl);
  toastsEl = el('div'); toastsEl.id = 'toasts'; ui.appendChild(toastsEl);
  const mini = document.createElement('canvas');
  mini.id = 'minimap'; mini.width = 148; mini.height = 148;
  mini.style.width = '148px'; mini.style.height = '148px';
  ui.appendChild(mini);
  renderer.setMinimap(mini);
  mini.onclick = () => { /* klik na minimapu = návrat domů */ renderer.cam.x = 0; renderer.cam.y = 0; };

  // eventy → UI feedback
  bus.on('ach', (a: any) => toast(`🏆 <b>${esc(a.name)}</b> — ${esc(a.desc)} (+2 % produkce)`, 'ach'));
  bus.on('era', (e: any) => toast(`🎇 Nová éra: <b>${ERA_NAMES[e.era]}</b>!`, 'gold'));
  bus.on('golden', (e: any) => toast(`🌟 ${esc(e.text)}`, 'gold'));
  bus.on('goldenSpawn', () => toast('🌟 Zlatý občan se objevil ve městě! Najdi ho a klikni na něj!', 'gold'));
  bus.on('festival', () => toast('🎉 Ve městě propukl festival! +spokojenost na 45 s.'));
  bus.on('built', (e: any) => { if (openedPanel === 'build') refreshPanel(); if (openedPanel === 'work') refreshPanel(); });
  bus.on('tech', () => { if (openedPanel === 'build' || openedPanel === 'upg') refreshPanel(); });
  bus.on('pop', () => { if (openedPanel === 'work') refreshPanel(); });
}

let uiTimer = 0, hintTimer = 0;
export function uiFrame(dt: number) {
  uiTimer -= dt;
  if (uiTimer <= 0) {
    uiTimer = 0.25;
    updateTopbar();
    // dostupnost tlačítek v otevřeném panelu (lehké — jen disabled stavy přes rerender 1×/s)
  }
  hintTimer -= dt;
  if (hintTimer <= 0) {
    hintTimer = 1;
    const h = computeHint();
    hintEl.classList.toggle('off', !h);
    if (h && hintEl.innerHTML !== h) hintEl.innerHTML = h;
    // panely s měnícími se čísly
    if (openedPanel === 'tech' || openedPanel === 'asc') refreshPanel();
  }
}
