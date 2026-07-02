# Civilization Idle

> 2D top-down idle klikačka o růstu civilizace — od sbírání kamene rukama až po těžbu laserovými puškami a přepravu vrtulníky.

Tento repozitář zatím obsahuje **kompletní designovou a technickou dokumentaci** hry. Cílem dokumentace je, aby podle ní šlo hru celou naprogramovat — ať už člověkem nebo AI agentem — bez nutnosti dalšího dovysvětlování.

---

## Co to je

Civilization Idle je incremental / idle hra z pohledu shora (top-down). Hráč začíná s pár lidmi na okraji teoreticky nekonečné mapy, klikáním sbírá suroviny, staví budovy a přitahuje další obyvatele. Každý človíček je samostatný „zdroj", který umí chodit, těžit a pracovat. Plněním potřeb civilizace se město **organicky rozrůstá**, odemyká se tech tree (od doby kamenné po budoucnost), upgrady se skládají do silných synergií a po dosažení určitého milníku lze provést **ascension** (prestige reset) za trvalé bonusy.

Podrobná vize je v [`docs/00-vision-and-pillars.md`](docs/00-vision-and-pillars.md).

---

## Jak číst tuto dokumentaci

Dokumenty jdou od „co stavíme a proč" přes „jak to hráč hraje" až po „jak to technicky postavit". Doporučené pořadí čtení pro nového vývojáře: 00 → 01 → 11 → 03 → zbytek dle potřeby.

| # | Dokument | O čem |
|---|----------|-------|
| 00 | [Vize a pilíře](docs/00-vision-and-pillars.md) | Elevator pitch, designové pilíře, cílová skupina, referenční hry |
| 01 | [Game Design Document](docs/01-game-design-document.md) | Kompletní herní smyčka, fáze hry, mechaniky |
| 02 | [Svět a mapa](docs/02-world-and-map.md) | Nekonečná chunkovaná mapa, procedurální generování, organický růst města |
| 03 | [Lidé a práce](docs/03-people-and-work.md) | **Klíčové**: model „člověk = zdroj", optimalizace, LOD simulace, job systém |
| 04 | [Ekonomika a suroviny](docs/04-economy-and-resources.md) | Suroviny, výrobní řetězce, slidery alokace, spotřeba |
| 05 | [Tech tree](docs/05-tech-tree.md) | Éry, větve, konkrétní uzly od kamene po lasery a vrtulníky |
| 06 | [Upgrady a synergie](docs/06-upgrades-and-synergies.md) | Typy upgradů, synergie, wow efekty, eventy |
| 07 | [Meta progrese](docs/07-meta-progression.md) | Achievementy s bonusy, ascension/prestige, offline progres |
| 08 | [UI / UX](docs/08-ui-ux.md) | HUD, panely, slidery, ovládání, wireframy |
| 09 | [Art direction](docs/09-art-direction.md) | Vizuální styl, tileset, animace, „živoucí město", particly |
| 10 | [Audio design](docs/10-audio-design.md) | Hudba, SFX, ambient, mixování |
| 11 | [Technická architektura](docs/11-technical-architecture.md) | Tech stack, ECS, render/tick loop, struktura projektu |
| 12 | [Save systém](docs/12-save-system.md) | Serializace, verzování, migrace, offline výpočet |
| 13 | [Balancování a vzorce](docs/13-balancing-and-formulas.md) | Cost curves, produkční vzorce, ekonomická matematika |
| 14 | [Roadmapa](docs/14-roadmap.md) | Milníky, fáze, MVP → plná hra, definice hotového |
| 15 | [Katalog obsahu](docs/15-content-catalog.md) | Datové tabulky: suroviny, budovy, techy, upgrady, achievementy |
| 16 | [Datové schémata](docs/16-data-schemas.md) | TS/JSON schémata pro data-driven obsah |
| 17 | [Glosář](docs/17-glossary.md) | Definice pojmů použitých napříč dokumentací |

---

## Rychlé shrnutí pro netrpělivé

- **Žánr:** idle / incremental / city-builder, top-down 2D, běží v prohlížeči.
- **Doporučený stack:** TypeScript + Vite + PixiJS (WebGL render) + vlastní data-oriented ECS + React overlay pro UI + Howler.js (audio) + IndexedDB pro save. Detail a alternativy (Phaser) v [dokumentu 11](docs/11-technical-architecture.md).
- **Hlavní technická výzva:** tisíce „lidí-zdrojů" na nekonečné mapě. Řešení = oddělení **ekonomické simulace** (agregovaná, deterministická, tick-based) od **vizuální prezentace** (LOD, jen viditelní agenti se animují). Viz [dokument 03](docs/03-people-and-work.md).
- **Progrese:** click → gather → build → grow → automate → tech → synergy → ascend.

---

## Stav projektu

- [x] Kompletní dokumentace a plán
- [ ] Fáze 0 — kostra projektu (setup, render/tick loop)
- [ ] Fáze 1 — hratelný prototyp (MVP)
- [ ] Fáze 2+ — viz [roadmapa](docs/14-roadmap.md)

Licence a další organizační věci budou doplněny při startu implementace.
