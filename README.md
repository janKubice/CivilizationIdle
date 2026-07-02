# Civilization Idle

> 2D top-down idle klikačka o růstu civilizace — od sbírání kamene rukama až po těžbu laserovými puškami a přepravu vrtulníky.

Repozitář obsahuje **hratelnou hru** (TypeScript + Vite, exportovatelnou jako **jediný HTML soubor**) a **kompletní designovou a technickou dokumentaci**, podle které vznikla a podle které se dá dál rozšiřovat.

## ▶️ Jak hrát

- **Bez instalace:** stáhni / otevři [`civilization-idle.html`](civilization-idle.html) v prohlížeči. Celá hra je jeden soubor — funguje offline, ukládá se do prohlížeče.
- **Vývoj:**
  ```bash
  npm install
  npm run dev        # dev server s HMR
  npm run build      # vyrobí dist/index.html — celá hra v jednom HTML souboru
  npm run typecheck  # tsc --noEmit
  ```

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
- **Implementovaný stack:** TypeScript + Vite + **Canvas 2D** + vanilla DOM UI + **WebAudio syntéza** (zvuky bez souborů) + procedurální grafika kreslená kódem + localStorage save + `vite-plugin-singlefile` → **export do jednoho HTML**. (Dokumentace v [11](docs/11-technical-architecture.md) popisuje i původně doporučenou těžší variantu PixiJS+React — architektonické principy platí pro obě.)
- **Hlavní technická výzva:** tisíce „lidí-zdrojů" na nekonečné mapě. Řešení = oddělení **ekonomické simulace** (agregovaná, deterministická, tick-based) od **vizuální prezentace** (LOD, jen viditelní agenti se animují). Viz [dokument 03](docs/03-people-and-work.md).
- **Progrese:** click → gather → build → grow → automate → tech → synergy → ascend.

---

## Stav projektu

- [x] Kompletní dokumentace a plán
- [x] Fáze 0 — kostra projektu (setup, fixed-timestep loop, chunkovaný svět)
- [x] Fáze 1 — hratelný prototyp (klik-gather, budovy, lidé, slidery, save, offline)
- [x] Fáze 2 (jádro) — výrobní řetězce, tech tree (éra 0–6), upgrady, organický růst města
- [x] Fáze 3–4 (jádro) — energie, doprava/haul, eventy (zlatý občan, festival), achievementy s bonusy, **ascension + Odkaz**, lasery 🔴 a vrtulníky 🚁
- [ ] Fáze 5 — hlubší balanc, mobilní UX, přístupnost, i18n (viz [roadmapa](docs/14-roadmap.md))

### Struktura kódu (`src/`)

| Soubor | Role |
|--------|------|
| `sim.ts`, `state.ts`, `worldgen.ts`, `data.ts` | **Simulace** — headless, deterministická; obsah je data-driven |
| `render.ts`, `sprites.ts` | **Prezentace** — canvas render, LOD agenti, particly, den/noc, minimapa |
| `ui.ts` | HUD, panely (stavby/práce/věda/vylepšení/úspěchy/vzestup), menu, modaly |
| `audio.ts` | Syntetizované SFX + generativní hudba (WebAudio) |
| `save.ts` | localStorage save, export/import, migrace |
| `main.ts` | bootstrap, herní smyčka, vstup (myš/dotyk/klávesnice) |
