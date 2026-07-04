// ===== i18n: CZ (kanonická, z dat) + EN/DE/FR překladové slovníky =====

import { bus, setDecimalSep } from './util';
import { RES, BUILDINGS, TECHS, UPGRADES, ACHS, PERKS, NODE_DEFS } from './data';
import { ERA_NAMES } from './config';
import { EN } from './i18n-en';
import { DE } from './i18n-de';
import { FR } from './i18n-fr';

export type Lang = 'cs' | 'en' | 'de' | 'fr';
export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
];

export interface Dict {
  ui: Record<string, string>;
  res: Record<string, string>;
  b: Record<string, [string, string]>;     // [název, popis]
  job: Record<string, string>;
  tech: Record<string, [string, string]>;
  upg: Record<string, [string, string]>;
  ach: Record<string, [string, string]>;
  perk: Record<string, [string, string]>;
  node: Record<string, string>;
  eras: string[];
}

// ---------- CS: obsah z data.ts (kanonický zdroj), UI stringy zde ----------
const CS_UI: Record<string, string> = {
  // panely a sidebar
  'p.build': 'Stavby', 'p.work': 'Práce', 'p.store': 'Sklad', 'p.tech': 'Věda', 'p.upg': 'Vylepš.', 'p.ach': 'Úspěchy', 'p.asc': 'Vzestup',
  't.build': '🏗️ Stavby', 't.work': '👷 Pracovníci', 't.store': '📦 Sklad', 't.tech': '🔬 Technologie', 't.upg': '💡 Vylepšení', 't.ach': '🏆 Úspěchy', 't.asc': '✨ Vzestup',
  // build panel
  'build.info': 'Vyber budovu a klikni do mapy. <b>Esc</b>/pravé tl. zruší.',
  'build.slots': '{0} místa/ks', 'build.housing': '+{0} bydlení', 'build.water': '+{0} voda', 'build.wonder': '⏳ stavba {0} s',
  'build.btn': 'Postavit', 'build.cancel': '✕ Zrušit výběr',
  'cat.all': 'Vše', 'cat.city': '🏠 Město', 'cat.food': '🌾 Jídlo', 'cat.mine': '⛏️ Těžba', 'cat.ind': '🏭 Výroba', 'cat.other': '🎓 Ostatní', 'cat.wonder': '🗿 Divy',
  // work panel
  'work.idle': '😴 Nezaměstnaní: <b>{0}</b> / {1}', 'work.foreman': '👷 Předák aktivní',
  'work.empty': 'Postav budovy s pracovními místy (tábor, chýše, lom…) a přiřaď lidem práci.',
  // storage panel
  'store.head': 'Surovina · zásoba / kapacita · produkce',
  'store.full': 'plno za {0}', 'store.empty2': 'prázdno za {0}', 'store.nocap': 'bez limitu',
  'store.chainHint': 'Klikni: kde se surovina vyrábí a spotřebovává',
  'chain.made': 'Vyrábí se v:', 'chain.used': 'Spotřebovává se v:', 'chain.none': '— zatím nikde —',
  // tech panel
  'tech.res': '🔬 Věda: <b>{0}</b> ({1})', 'tech.era': 'Éra {0} — {1}', 'tech.req': 'Vyžaduje: {0}',
  'tech.buy': 'Vyzkoumat', 'tech.done': '🔬 Vyzkoumáno: <b>{0}</b>',
  // upgrady
  'upg.buy': 'Koupit', 'upg.lvl': 'Vylepšit', 'upg.reqTech': 'Vyžaduje: {0}',
  // achievementy
  'ach.head': 'Získáno <b>{0}</b>/{1} · každý úspěch = <b>+2 %</b> produkce',
  'ach.toast': '🏆 <b>{0}</b> — {1} (+2 % produkce)',
  // ascension
  'asc.title': '✨ Vzestup civilizace',
  'asc.desc': 'Resetuje město, suroviny a technologie. Získáš <b>Odkaz</b> — trvalou měnu na mocná vylepšení pro všechny další běhy. Úspěchy a nastavení zůstávají.',
  'asc.score': 'Civilizační skóre: <b>{0}</b>', 'asc.gain': 'Odkaz při vzestupu: <b style="color:#ffd777">✨ +{0}</b> (máš {1})', 'asc.count': 'Vzestupů celkem: {0}',
  'asc.btn': '✨ Provést Vzestup', 'asc.locked': '🔒 Vyžaduje technologii Transcendence',
  'asc.confirm': 'Civilizace vstoupí do dějin. Získáš <b>+{0} Odkazu</b> a začneš znovu — silnější. Pokračovat?',
  'asc.go': 'Vzestoupit!', 'asc.done': '✨ Vzestup dokončen! +{0} Odkazu',
  'asc.perks': 'Odkaz předků — máš ✨ {0}',
  // topbar
  'top.home': 'Na náves', 'top.mute': 'Ztlumit / zapnout zvuk', 'top.era': 'Aktuální éra tvé civilizace',
  'top.pop': 'Populace / bydlení. Voda pro {0} lidí.', 'top.hap': 'Spokojenost — klikni pro rozpis',
  'top.water': 'Pokrytí vodou / populace',
  // happiness breakdown
  'hap.title': '😊 Spokojenost: {0} %', 'hap.base': 'Základ', 'hap.food': 'Jídlo', 'hap.water': 'Voda', 'hap.housing': 'Bydlení',
  'hap.services': 'Služby (tržiště, chrám…)', 'hap.bonus': 'Bonusy (techy, upgrady)', 'hap.festival': 'Festival', 'hap.starving': 'HLAD!',
  'hap.info': 'Spokojenost násobí produkci (50–100 %) a řídí příchod nových obyvatel (růst nad 55 %, odchod pod 25 %).',
  // title
  'title.sub': 'Od prvního kamene k laserovým těžebním puškám.<br>Klikej, stav, zkoumej — a nech své lidičky makat.',
  'title.continue': '▶ Pokračovat', 'title.new': '✦ Nová hra',
  'title.newConfirm': 'Opravdu začít znovu? Současný postup (kromě nastavení) bude smazán, včetně Vzestupů.',
  'title.newGo': 'Začít znovu', 'title.foot': 'v0.5 „Megalomanie" · vše se ukládá automaticky · funguje offline',
  // settings
  'set.title': '⚙️ Nastavení', 'set.sfx': '🔊 Zvuky', 'set.music': '🎵 Hudba', 'set.particles': '✨ Particly', 'set.daynight': '🌙 Denní cyklus',
  'set.lang': '🌍 Jazyk', 'set.transfer': '<b>Přenos uložené hry</b>', 'set.export': '📤 Export', 'set.import': '📥 Import',
  'set.importPh': 'Sem vlož kód pro import…', 'set.copied': 'Zkopírováno do schránky.', 'set.imported': 'Hra načtena z importu.', 'set.badCode': '⚠️ Neplatný kód.',
  'set.stats': '⏱️ Odehráno: {0} · 👆 kliků: {1} · 👥 rekord: {2} · ✨ vzestupů: {3}',
  'set.help': '❓ Jak hrát', 'set.reset': '🗑️ Smazat vše', 'set.close': 'Zavřít',
  'set.resetConfirm': 'Opravdu? Smaže se kompletně celý postup včetně Vzestupů a Odkazu. Toto nelze vrátit.',
  'set.resetGo': 'SMAZAT VŠE',
  // help
  'help.title': '❓ Jak hrát',
  'help.1': '<b>Smyčka:</b> klikej na suroviny (stromy 🌳, keře, balvany) → stav budovy <b>[B]</b> → přiřaď lidem práci <b>[P]</b> → plň potřeby (jídlo, bydlení, voda, spokojenost) → přicházejí noví lidé → zkoumej technologie <b>[T]</b> a kupuj vylepšení <b>[U]</b>.',
  'help.2': '<b>Ovládání:</b> tažení myší / WASD = posun mapy · kolečko = zoom · klik na budovu = detail a bourání · Esc = zavřít/zrušit.',
  'help.3': '<b>Tipy:</b> stav pily u lesa a doly u žil — dostaneš <b>bonus sousedství</b>. Vzdálené budovy mají pomalejší dopravu, pomůžou skladiště a dopravní technologie. Hlídej 🌟 zlaté občany! Město si samo staví chatrče, když je splněné jídlo a spokojenost.',
  'help.4': '<b>Cíl:</b> dotáhni civilizaci od kamenné éry k laserům 🔴 a vrtulníkům 🚁, pak proveď <b>Vzestup</b> ✨ a začni znovu — silnější.',
  'help.ok': 'Rozumím',
  // modaly / různé
  'ok': 'Zavřít', 'cancel': 'Zrušit', 'continue': 'Pokračovat',
  'offline.title': '🌙 Byl jsi pryč {0}', 'offline.body': 'Civilizace mezitím pracovala ({0} efektivního času):', 'offline.rest': 'Tvoji lidé odpočívali.',
  'binfo.auto': 'postaveno městem', 'binfo.workers': '👷 Pracovníci typu: <b>{0}</b> / {1} (tato budova: {2} míst)',
  'binfo.haul': '🚚 Doprava: <b>{0} %</b> (vzdálenost {1} od skladu)', 'binfo.adj': '🧭 Bonus sousedství: <b style="color:#7ee787">+{0} %</b>',
  'binfo.housing': '🏠 Bydlení: +{0}', 'binfo.water': '💧 Voda pro {0} lidí', 'binfo.hap': '😊 Spokojenost: +{0} %', 'binfo.cap': '📦 Kapacita skladů: +75 %',
  'binfo.demolish': '🗑️ Zbourat (vrátí ~50 %)',
  'toast.demolished': '🗑️ {0} zbořeno. Vráceno: {1}', 'toast.adj': '🧭 Bonus sousedství: <b>+{0} %</b> ({1})',
  'toast.full': '📦 Sklad suroviny {0} <b>{1}</b> je plný — produkce se plýtvá. Postav skladiště nebo kup Rozšíření skladů.',
  'toast.era': '🎇 Nová éra: <b>{0}</b>!', 'toast.golden': '🌟 Zlatý občan se objevil ve městě! Najdi ho a klikni na něj!',
  'toast.festival': '🎉 Ve městě propukl festival! +spokojenost na 45 s.', 'toast.buildCancel': 'Stavění zrušeno.',
  'err.terrain': 'Tady stavět nejde.', 'err.res': 'Nedostatek surovin.', 'err.tech': 'Chybí technologie.',
  'err.sci': 'Nedostatek vědy.', 'err.req': 'Chybí předpoklady.', 'err.max': 'Maximální úroveň.', 'err.legacy': 'Nedostatek Odkazu.',
  'err.era': 'Vyžaduje vyšší éru.', 'err.merge': 'Ke sloučení chybí 2×2 stejných budov.',
  'err.water': 'Musí stát u vody.',
  'season.0': 'Jaro', 'season.1': 'Léto', 'season.2': 'Podzim', 'season.3': 'Zima',
  'toast.season': 'Začíná {0}!', 'toast.rails': '🚂 Koleje položeny — mezi nádražími jezdí vlak!',
  'hap.diet': 'Pestrá strava (ryby)', 'hap.cold': 'MRZNOU! (došlo dřevo na topení)', 'hap.cozy': 'Útulná zima (topení)',
  'binfo.fire': '🔥 HOŘÍ! Klikej na budovu a uhas ji!', 'binfo.dmg': '🪦 Vyhořelá — neprodukuje, oprav ji.', 'binfo.repair': 'Opravit',
  'toast.fire': '🔥 {0} hoří! Rychle na ni klikej, ať ji uhasíš!', 'toast.fireOut': '💧 {0}: požár uhašen!',
  'toast.burned': '🪦 {0} vyhořela. Klikni na ni a oprav ji (30 % ceny).', 'toast.repaired': '🔧 {0} opravena.',
  'toast.circus': '🎪 Do města přijel kočovný cirkus! +15 % spokojenosti na 90 s.',
  'toast.meteor': '☄️ Meteor! Z trosek jsi získal +{0} {1} a lidé v šoku klikají ×10!',
  'toast.gov': '🏛️ Guvernér nechal postavit: {0}',
  'auto.title': 'Guvernér staví sám:', 'auto.food': 'Jídlo (farmy/sběrači při nedostatku)', 'auto.wood': 'Dřevo (tábory při nedostatku)',
  'auto.store': 'Sklady (když něco přetéká)', 'auto.water': 'Studny (když chybí voda)',
  'auto.housing': 'Bydlení (staví nejlepší dostupné domy)', 'auto.industry': 'Výroba (zpracuje přebytky surovin na vyšší)', 'auto.science': 'Věda (knihovny a učenci)',
  'toast.wonder': '✨ DIV SVĚTA dostavěn: {0}! Cítíš tu sílu?',
  'binfo.lvl': 'Úroveň: {0}', 'binfo.lvlUp': 'Vylepšit na {0}',
  'binfo.big': '★ Velká budova (4-v-1): sloty ×4 a +50 % výkon',
  'binfo.merge': '🔗 Sloučit 4 do velké budovy', 'binfo.split': '✂️ Rozdělit zpět na 4',
  'binfo.district': '🏘️ Čtvrť: +{0} % produkce',
  'toast.merged': '🔗 Vznikla velká budova: {0}!', 'toast.split': '✂️ {0}: rozděleno zpět na 4 budovy.',
  'toast.upgraded': '⬆ {0} vylepšeno na úroveň {1}.',
  'toast.mergeHint': '🔗 Máš 4× {0} ve čtverci 2×2 — klikni na ně a sluč je do velké budovy!',
  'toast.district': '🏘️ Vznikla čtvrť! Produkční budovy stejné kategorie u sebe: +15 % (od 6 budov +25 %).',
  // golden eventy
  'golden.frenzy': 'Zlatá horečka! Produkce ×7 na 30 s!', 'golden.gift': 'Dar osudu: +{0} {1}!', 'golden.click': 'Klikací šílenství! Kliky ×20 na 15 s!',
  'buff.frenzy': 'Zlatá horečka ×7', 'buff.click': 'Klikací šílenství ×20', 'buff.festival': 'Festival',
  // hinty
  'hint.wood': '🪵 Klikej na stromy a nasbírej dřevo!',
  'hint.hut': '🏠 Otevři Stavby a postav Chatrč — přijdou noví obyvatelé.',
  'hint.camp': '🪓 Postav Dřevorubecký tábor nebo Sběračskou chýši — lidé budou pracovat za tebe.',
  'hint.assign': '👷 Otevři panel Práce a přiřaď lidem zaměstnání.',
  'hint.library': '📚 Postav Knihovnu a začni generovat vědu.',
  'hint.tech': '🔬 Otevři Vědu a vyzkoumej první technologii!',
  'hint.techWait': '🔬 Učenci v knihovně generují vědu na první technologii…',
  'hint.food': '🍎 Pozor na jídlo! Přiřaď víc sběračů nebo postav farmy.',
  'hint.hap': '☹️ Spokojenost je nízká — postav studnu, tržiště nebo chrám.',
  'hint.housing': '🏠 Bydlení je plné. Postav chatrče/domy, nebo počkej — město roste i samo.',
};

function buildCS(): Dict {
  const d: Dict = { ui: CS_UI, res: {}, b: {}, job: {}, tech: {}, upg: {}, ach: {}, perk: {}, node: {}, eras: ERA_NAMES };
  for (const r of RES) d.res[r.id] = r.name;
  for (const b of BUILDINGS) { d.b[b.id] = [b.name, b.desc]; if (b.jobName) d.job[b.id] = b.jobName; }
  for (const t of TECHS) d.tech[t.id] = [t.name, t.desc];
  for (const u of UPGRADES) d.upg[u.id] = [u.name, u.desc];
  for (const a of ACHS) d.ach[a.id] = [a.name, a.desc];
  for (const p of PERKS) d.perk[p.id] = [p.name, p.desc];
  NODE_DEFS.forEach((n, i) => d.node[i] = n.name);
  return d;
}

const CS = buildCS();
const DICTS: Record<Lang, Partial<Dict>> = { cs: CS, en: EN, de: DE, fr: FR };

let lang: Lang = 'cs';
let cur: Partial<Dict> = CS;

export function getLang(): Lang { return lang; }

export function setLang(l: Lang) {
  lang = l;
  cur = DICTS[l] || CS;
  setDecimalSep(l === 'en' ? '.' : ',');
  bus.emit('lang');
}

export function detectLang(): Lang {
  const n = (navigator.language || 'en').toLowerCase();
  if (n.startsWith('cs') || n.startsWith('sk')) return 'cs';
  if (n.startsWith('de')) return 'de';
  if (n.startsWith('fr')) return 'fr';
  return 'en';
}

/** UI string s {0},{1} placeholdery */
export function t(key: string, ...args: (string | number)[]): string {
  let s = cur.ui?.[key] ?? CS.ui[key] ?? key;
  for (let i = 0; i < args.length; i++) s = s.split(`{${i}}`).join(String(args[i]));
  return s;
}

type Cat = 'b' | 'tech' | 'upg' | 'ach' | 'perk';
/** název obsahu (budova/tech/upgrade/achievement/perk) */
export function tn(cat: Cat, id: string): string {
  return (cur[cat] as any)?.[id]?.[0] ?? (CS[cat] as any)[id]?.[0] ?? id;
}
/** popis obsahu */
export function td(cat: Cat, id: string): string {
  return (cur[cat] as any)?.[id]?.[1] ?? (CS[cat] as any)[id]?.[1] ?? '';
}
export function tres(id: string): string { return cur.res?.[id] ?? CS.res[id] ?? id; }
export function tjob(id: string): string { return cur.job?.[id] ?? CS.job[id] ?? tn('b', id); }
export function tera(n: number): string { return cur.eras?.[n] ?? CS.eras[n] ?? String(n); }
