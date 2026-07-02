# 08 — UI / UX

Cíl: přehledné, „juicy", responzivní (desktop i mobil), s jasnými signály bottlenecků. UI je **React overlay** nad canvas světem (viz [11](11-technical-architecture.md)).

---

## 1. Rozvržení herní obrazovky

```
┌───────────────────────────────────────────────────────────────┐
│  TOP BAR: [suroviny + rate/s] [populace] [happiness] [gold] ⚙  │
├───────────────────────────────────────────────────────────────┤
│                                                        ┌──────┐ │
│                                                        │ mini │ │
│                 SVĚT (canvas, pan/zoom)                │ mapa │ │
│         klik na uzel = gather, na budovu = detail      └──────┘ │
│                                                                 │
│                                                     [bottleneck │
│                                                      alerty]     │
├───────────────────────────────────────────────────────────────┤
│ LEVÁ LIŠTA IKON: 🏠Budovy 🔬Tech 💡Upgrady 👷Workforce         │
│                  🏆Achiev 🌟Ascension                          │
└───────────────────────────────────────────────────────────────┘
```

- **Top bar**: klíčové suroviny s aktuálním množstvím a `+X/s` (barevně: zelená = přebytek, červená = deficit). Přeteče-li sklad → varovná ikona. Populace, happiness (barevný index), gold. Vpravo ⚙ nastavení/pauza.
- **Svět**: hlavní plocha; interakce dle [01 §5](01-game-design-document.md).
- **Boční panely**: otevírají se z lišty ikon jako překryvné panely (desktop: side drawer; mobil: fullscreen sheet).
- **Bottleneck alerty**: nevtíravé toasty/ikonky „málo skladu na dřevo", „farmy stojí — chybí voda", klik = navede na řešení.

## 2. Panely

### 2.1 Budovy (build panel)
- Seznam/karty budov (kategorie: produkce, sklad, bydlení, servis, speciál).
- Karta: ikona, název, cena (barevně dle dostupnosti), efekt, počet postavených, tlačítko postavit (×1 / ×10 / max).
- Build mód: vybraná budova → duch (ghost) na mapě, validní/nevalidní umístění, klik postaví. Escape ruší.
- Filtry: „lze postavit", „nové/odemčené".

### 2.2 Tech tree panel
- Graf uzlů (éry = sloupce, větve = barvy), linie prerekvizit, stavy locked/available/owned ([05 §4](05-tech-tree.md)).
- Pan/zoom, vyhledávání, filtr větve, „další doporučený uzel" nápověda.
- Klik na uzel → detail + koupě (potvrzení u drahých).

### 2.3 Upgrady panel
- Mřížka upgradů; koupené ztlumené, dostupné zvýrazněné, uzamčené s podmínkou.
- Tooltip s **před/po** hodnotou efektu ([06 §6](06-upgrades-and-synergies.md)).
- Filtr/řazení (dle suroviny, ceny, „lze koupit").

### 2.4 Workforce panel (slidery)
- **Slidery/čítače** per kategorie práce; přehled „přiřazeno / sloty / volní lidé".
- Přepínač **Slider ↔ Priorita**; **presety** (uložit/načíst/přepnout).
- Živý náhled dopadu na produkci (mění se čísla `+/s` při tažení slideru).
- Volitelný toggle **auto-balance** (po odemčení).

### 2.5 Achievementy panel
- Mřížka s progresem, splněné vs. skryté; zobrazení získaného bonusu.

### 2.6 Ascension panel (odemčeno později)
- Ukazuje „získáš X Odkazu (+Y %)", **Legacy strom** k utrácení, tlačítko Ascend s jasným varováním co se resetuje ([07 §2](07-meta-progression.md)).

## 3. Interakce se světem

- **Klik na uzel** → gather + floating „+N 🪵" a particly; při critu výraznější.
- **Klik na budovu** → mini-detail (produkce, sloty, level, upgrade budovy).
- **Hover na dlaždici** (desktop) → tooltip (biome, uzel, vzdálenost ke skladu).
- **Pan/zoom**: drag / WASD / šipky; kolečko / pinch; tlačítko „domů".
- **Minimapa**: rozsah města, outposty, klik = přesun kamery.

## 4. Feedback a „juice" (UX vrstva)

- Floating combat-text pro zisky, plynulé číselné čítače (tween, ne skoky).
- Barevné kódování stavů (přebytek/deficit/plno).
- Mikroanimace tlačítek, „ka-ching" u koupě, jemný screen shake u velkých eventů (vypínatelné).
- Milníky (nová éra, laser, ascension) → celoobrazovkový důraz + zvuk ([09](09-art-direction.md), [10](10-audio-design.md)).

## 5. Onboarding v UI

- Kontextové **coach marks** (zvýraznění + šipka + krátký text) na první akce; **skippable**.
- Nově odemčená mechanika → jednorázový tooltip „Co teď".
- Žádná úvodní zeď textu.

## 6. Responzivita a vstup

- **Desktop**: klávesové zkratky (B budovy, T tech, U upgrady, W workforce, mezerník pauza, Esc zavřít), myš.
- **Mobil/dotyk**: panely jako fullscreen sheets, větší tap cíle, pinch-zoom, dlouhý tap = detail; slidery ovladatelné palcem. Layout se přeskládá (top bar zhuštěný, lišta dole).
- **Škálování UI** (velikost fontu) v nastavení; podpora bezpečných zón (notch).

## 7. Nastavení (settings)

- Zvuk: master/hudba/SFX/ambient, mute.
- Grafika: kvalita particlů, cap davu, screen shake on/off, denní cyklus on/off, redukce pohybu (accessibility).
- Hra: číselný formát (1.23M / 1.23e6 / vědecký), rychlost autosave, jazyk (CZ/EN, i18n-ready).
- Data: manuální save, export/import save, **hard reset** (s dvojím potvrzením).
- Přístupnost: barvoslepý-friendly paleta, větší text, redukce blikání.

## 8. Číselný formát

- Automatická notace: 1 234 → 1.23K → 1.23M → 1.23B → … → vědecká `1.23e21` pro extrémy.
- Volitelně pojmenované (K/M/B/T…) i čistě vědecké dle preference. Konzistentní napříč UI (jedna util funkce `formatNumber`).

## 9. Accessibility (a11y)

- Ovladatelnost klávesnicí pro menu/panely, čitelný kontrast, škálovatelný text, „reduce motion", barvoslepý mód, titulky/ikony místo pouhé barvy pro stavy. Cíl: hratelné pro co nejvíc lidí.

## 10. Wireframe poznámka pro implementaci

- UI stav (co je otevřené, hodnoty pro zobrazení) drží **UI store** (např. Zustand) čtoucí z herního stavu; **herní logika UI neimportuje**. UI se překresluje z herního stavu, ne naopak. Detail hranice: [11 §Architektura](11-technical-architecture.md).
