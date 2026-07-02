# 14 — Roadmapa a plán implementace

Fázovaný plán od prázdného repa po plnou hru. Každá fáze má **cíl**, **rozsah** a **definici hotového (DoD)**. Fáze jsou inkrementální — po každé je hra spustitelná a hratelná (rostoucí měrou).

Priorita: **výkonová architektura (oddělení sim/prezentace, SoA, LOD) je součástí Fáze 0/1, ne „až potom"** — je to nejdražší věc na dodatečné zavedení.

---

## Fáze 0 — Kostra projektu (foundation)
**Cíl:** spustitelný skelet s herní smyčkou a prázdným světem.

Rozsah:
- Setup: Vite + TypeScript (strict) + ESLint/Prettier + Vitest.
- PixiJS scéna + kamera (pan/zoom), prázdný chunkovaný svět s terénem z noise ([02](02-world-and-map.md)).
- **Fixed-timestep game loop** + oddělení sim/render/UI ([11 §3](11-technical-architecture.md)).
- SoA stores skeleton ([03 §5](03-people-and-work.md)), event bus.
- React overlay „hello HUD", základní settings.
- Save skeleton (IndexedDB + serialize round-trip test).
- CI (lint+typecheck+test+build) + doporučený **SessionStart hook** pro web sessions.

**DoD:** `npm run dev` ukáže procedurální terén, jde panovat/zoomovat, loop běží 60 FPS, testy a build zelené, save/load prázdného stavu funguje.

---

## Fáze 1 — Hratelný prototyp / MVP (core loop)
**Cíl:** ověřit zábavnost jádra: klik → gather → build → lidé → auto produkce.

Rozsah:
- Surovinové uzly na mapě + **klik gather** (dřevo, jídlo) s floating textem/particly.
- 2–3 budovy (skladiště, bydlení, jedna produkční) + build mód.
- **Lidé jako zdroje**: příchod, přiřazení k job slotům, **agregovaná produkce** ([03](03-people-and-work.md)); vizuální L0 agenti (instanced) s LOD.
- Základní **slidery alokace** ([04 §6](04-economy-and-resources.md)).
- Potřeby (jídlo+bydlení) → růst populace; happiness v0.
- Autosave + offline v0 (lineární).
- Základní SFX (klik, build) a HUD s rate/s.

**DoD:** hráč od nuly během pár minut sbírá, staví, přiřazuje lidi a sleduje růst; 60 FPS s ~1 000 lidmi; save přežije reload; smyčka je prokazatelně zábavná (interní playtest).

---

## Fáze 2 — Ekonomika, řetězce a tech tree (depth)
**Cíl:** hloubka a první progrese.

Rozsah:
- **Výrobní řetězce** (dřevo→prkna, kámen→cihly, ruda→ingot→nástroje) + bottlenecky ([04](04-economy-and-resources.md)).
- **Nástroje = multiplikátory těžby** (první velký skok).
- **Tech tree** engine (data-driven) + éry 0–2 obsahu ([05](05-tech-tree.md)); research budovy/učenci.
- **Upgrady** engine + první sada + první **synergie** (adjacency) ([06](06-upgrades-and-synergies.md)).
- **Organický růst města** v0 (auto obytné domky na frontieru + cesty) ([02 §4](02-world-and-map.md)).
- Sklady/kapacity, plýtvání, servisní budovy (voda/tržiště), gold.
- Minimapa, bottleneck alerty, presety sliderů.

**DoD:** hra nabídne ~1–2 h smysluplné progrese; tech/upgrady/synergie fungují data-driven; město viditelně roste; čísla nerozjetá (sanity testy).

---

## Fáze 3 — Průmysl, energie, logistika, eventy (scale)
**Cíl:** eskalace o řády a prostorová hra.

Rozsah:
- **Energie/power** vrstva + stroje/automatizace ([04 §5](04-economy-and-resources.md)); éry 3–4 tech tree.
- **Doprava/haul** techy (vozík→silnice→vlak), **outposty**, vzdálenost jako reálný faktor ([03 §8](03-people-and-work.md)).
- **Náhodné eventy** + Golden Citizen + festivaly ([06 §4](06-upgrades-and-synergies.md)).
- **Achievementy** s bonusy ([07 §1](07-meta-progression.md)).
- Denní/noční cyklus, bohatší „živoucí město" vizuál ([09](09-art-direction.md)), víc SFX/hudba dle éry ([10](10-audio-design.md)).
- Offline výpočet v1 (coarse-tick).

**DoD:** desítky hodin obsahu; produkce roste o řády kontrolovaně; město „žije"; achievementy a eventy odměňují; výkon drží cíl.

---

## Fáze 4 — Moderní/budoucnost a ascension (endgame)
**Cíl:** vrchol progrese a nekonečná smyčka.

Rozsah:
- Éry 5–6: **laserové těžební pušky, vrtulníky/drony, roboti, fúze** ([05](05-tech-tree.md)) + signature vizuály/zvuky.
- Pokročilé **synergie / engine buildy** ([06](06-upgrades-and-synergies.md)).
- **Ascension** + Legacy strom + specializace civilizace ([07 §2](07-meta-progression.md)).
- Statistiky, codex.

**DoD:** hráč dosáhne éry 6, provede ascension, druhý běh je výrazně rychlejší; Legacy strom dává smysl; endgame smyčka drží motivaci.

---

## Fáze 5 — Polish, juice, a11y, balanc (ship quality)
**Cíl:** z „funguje" udělat „hra".

Rozsah:
- Juice (particly, tweeny, screen shake, milníkové momenty), audio mix ([09](09-art-direction.md), [10](10-audio-design.md)).
- **Onboarding/tutoriál** ([08 §5](08-ui-ux.md)).
- Mobil/dotyk, responzivita, **accessibility** ([08 §9](08-ui-ux.md)).
- i18n (CZ/EN), number formatting, nastavení.
- **Balancování** přes playtesty + sanity testy ([13](13-balancing-and-formulas.md)).
- Optimalizace (profiling, cap ladění, případně web worker pro sim).

**DoD:** hratelné a příjemné na desktopu i mobilu; onboarding vede nového hráče; žádné zjevné výkonové/balanc problémy; přístupné.

---

## Fáze 6 — Release a post-launch (volitelné)
- Hosting (statický web — GitHub Pages/Netlify/Vercel), analytika opt-in.
- Volitelné: cloud save, leaderboardy skóre, další éry/obsah, sezónní eventy, moddovací API (data-driven už to umožňuje).

---

## Doporučené pořadí prací uvnitř fází (obecně)
1. **Data + logika (sim)** dřív než vizuál — ekonomika je testovatelná headless.
2. **Vizuál/UI** navázat na hotovou logiku přes read-only snapshot + eventy.
3. **Audio a juice** jako poslední vrstva feedbacku.
4. Průběžně **testy** (ekonomika, save, balanc) a **profiling** výkonu.

## Milníkový přehled

| Fáze | Výsledek | Hlavní riziko / na co dbát |
|------|----------|----------------------------|
| 0 | Skelet + loop + CI | Zavést oddělení sim/prezentace hned |
| 1 | Zábavné jádro (MVP) | Ověřit fun a výkon lidí od začátku |
| 2 | Hloubka (řetězce, tech, growth) | Data-driven čistota, balanc |
| 3 | Eskalace (průmysl, doprava, eventy) | Výkon při škále, rozjetí čísel |
| 4 | Endgame (hi-tech + ascension) | Rytmus prestige, motivace |
| 5 | Polish (juice, a11y, mobil, balanc) | Nešetřit — je to pilíř „je to hra" |
| 6 | Release | Scope guardraily |
