# 11 — Technická architektura

Jak hru postavit. Navazuje hlavně na [03 — Lidé a práce](03-people-and-work.md) (výkon) a [12 — Save](12-save-system.md).

> **Realizační poznámka (v0.1):** implementace v tomto repozitáři zvolila **odlehčenou variantu** kvůli požadavku na **export do jediného HTML souboru**: Canvas 2D místo PixiJS, vanilla DOM místo Reactu, WebAudio syntéza místo Howler.js + audio souborů, localStorage místo IndexedDB a **procedurální grafiku kreslenou kódem** (žádné externí assety). Všechny architektonické principy níže — oddělení simulace od prezentace, fixed-timestep, agregovaná ekonomika, data-driven obsah, LOD agentů — **platí beze změny** a implementace se jimi řídí. Těžší stack níže zůstává doporučením pro případný přechod na WebGL při větších nárocích.

---

## 1. Tech stack (doporučení + zdůvodnění)

| Vrstva | Volba | Proč |
|--------|-------|------|
| Jazyk | **TypeScript** | Typová bezpečnost pro velký data-driven projekt; skvělé pro refaktoring |
| Build/dev | **Vite** | Rychlý dev server, HMR, jednoduchý build, moderní |
| Renderer světa | **PixiJS (WebGL 2D)** | Vysoký výkon, batch/instanced rendering, `ParticleContainer` pro tisíce spritů, sprite atlasy |
| Simulace / entity | **Vlastní data-oriented store (SoA, typed arrays)**, volitelně **`bitecs`** | Cache-friendly, škáluje na tisíce lidí, snadná serializace (viz [03 §5](03-people-and-work.md)) |
| UI overlay | **React** (+ **Zustand** pro UI state) | Deklarativní panely/menu; oddělené od herní smyčky |
| Audio | **Howler.js** | Jednoduché, audio sprites, web+mobil ([10](10-audio-design.md)) |
| Persistence | **IndexedDB** (přes `idb-keyval`) + **LZ-String** komprese | Kapacita > localStorage, async, malý save ([12](12-save-system.md)) |
| Noise | `simplex-noise` nebo vlastní hash noise | Procedurální mapa ([02](02-world-and-map.md)) |
| Testy | **Vitest** | Rychlé, sdílí Vite config; testuje čistou ekonomiku |
| Lint/format | **ESLint + Prettier** | Konzistence |

### Alternativa: Phaser 3
Phaser je „batteries-included" (scény, vstup, audio, fyzika). **Kdy zvolit Phaser:** menší tým, který chce vše v jednom a nechce skládat PixiJS+React+audio. **Proč přesto doporučujeme PixiJS+React:** čistší oddělení herní simulace od UI, lepší kontrola nad výkonem simulace a jednodušší data-driven přístup. Phaser interně stejně používá renderer podobný Pixi. **Rozhodnutí je zaměnitelné** — architektura (oddělení sim/prezentace) platí pro obojí.

## 2. Vysokoúrovňová architektura

Striktní oddělení **simulace (pravda)** od **prezentace (render + UI + audio)** — stejný princip jako v [03](03-people-and-work.md).

```
┌──────────────────────────── APP ────────────────────────────┐
│                                                              │
│   ┌─────────────── SIMULACE (headless, deterministická) ──┐  │
│   │  GameState (SoA stores)                               │  │
│   │  Systems: production, needs, growth, research,        │  │
│   │           worldgen, worker allocation, events         │  │
│   │  fixed-timestep tick (SIM_DT)                         │  │
│   │  → nezávislá na renderu; jde spustit i bez UI (testy) │  │
│   └───────────────────────────────────────────────────────┘  │
│              │ (read-only snapshot / eventy)                  │
│     ┌────────┴───────────┬───────────────────┐               │
│     ▼                    ▼                   ▼                │
│  RENDERER (Pixi)     UI (React/Zustand)   AUDIO (Howler)      │
│  svět, agenti,       panely, HUD,         SFX/hudba reaguje   │
│  particly, kamera    slidery, menu        na eventy           │
│  rAF interpolace     čte snapshot         AudioManager        │
└──────────────────────────────────────────────────────────────┘
```

**Pravidla hranic:**
- Simulace **nezná** Pixi, React ani DOM. Je to čistá TS logika nad daty → testovatelná, spustitelná headless (nutné pro offline výpočet a testy).
- Prezentace **čte** stav simulace (read-only) a **posílá příkazy/intenty** zpět (např. „postav budovu X na (tx,ty)", „nastav slider"). Nikdy nemutuje stav přímo mimo definovaná API.
- Komunikace stav→prezentace: **snapshot čtení** (UI čte hodnoty pro render) + **event bus** (diskrétní události: `eraUnlocked`, `resourceGathered`, `achievementUnlocked`) pro juice/audio.

## 3. Game loop

```ts
let acc = 0;
let last = performance.now();
const SIM_DT = 100; // ms → 10 Hz simulace

function frame(now: number) {
  let dt = now - last; last = now;
  dt = Math.min(dt, MAX_FRAME_MS);   // clamp (tab switch, lag)
  acc += dt;
  while (acc >= SIM_DT) {            // fixed-timestep simulace
    simulation.tick(SIM_DT);
    acc -= SIM_DT;
  }
  const alpha = acc / SIM_DT;        // interpolační faktor
  renderer.render(alpha);           // vykresli s interpolací (60 fps rAF)
  ui.syncIfDirty();                 // UI čte snapshot (throttled, ne každý frame)
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- **Simulace fixní krok** → deterministická, nezávislá na FPS (klíč pro offline výpočet a testy).
- **Render rAF** interpoluje pozice L0 agentů mezi tiky (plynulost při 10 Hz sim).
- **UI update throttled** (např. 4–10× /s), ne každý frame → šetří React re-render.
- Pomalé systémy (organický růst, přepočet vzdáleností, autosave) běží na **vlastní nižší frekvenci** (každých N tiků), ne každý tick.

## 4. Simulace: systémy (tick pořadí)

Každý `tick(dt)` provede v pořadí (data-oriented, nad agregáty — [03](03-people-and-work.md)):
1. **WorkerAllocation** (jen když se změnily slidery/budovy) — přepočet přiřazení per jobKind.
2. **Production** — spočti výrobu per jobKind × vzorce; přičti do skladů s respektem ke kapacitě; crafting spotřebuje vstupy.
3. **Consumption/Needs** — spotřeba jídla/vody/energie; vyhodnoť happiness.
4. **PopulationGrowth** — příliv/odliv dle happiness/kapacit (batch).
5. **Research** — přičti research; zpracuj případné dokončené nákupy.
6. **Timers** — rozestavěné budovy, dočasné buffy (eventy), festivaly.
7. **Slow systems (každých N tiků)**: organický růst města, přepočet haul vzdáleností nových budov, autosave, kontrola achievementů, spawn eventů.

Systémy jsou **čisté funkce nad stavem** (`system(state, dt)` mutuje state stores) → snadno testovatelné a spustitelné ve zrychlení pro offline.

## 5. Datové stores (přehled)

```
GameState {
  meta: { seed, version, playtime, createdAt, lastSaved }
  resources: SoA/Record<ResourceId, {amount, capacity}>  // + odvozené rate v UI
  citizens: SoA (typed arrays: jobId, jobKind, skill, homeId, pos*, state, alive)  // [03 §5]
  jobs: SoA/pole job-slotů {kind, workplace, dropoff, baseRate, filled}
  buildings: Store<Building> {typeId, tx,ty, level, slots, ...}
  world: { chunks: Map<string,Chunk>, dirtyChunks }
  tech: Set<techId> + research bod
  upgrades: Set<upgradeId>
  achievements: Set<id> + progress
  allocation: { mode, sliders/priority, presets }
  legacy: { currency, purchasedPerks }  // přežívá ascension
  stats, settings
}
```
Formální TS schémata: [16](16-data-schemas.md).

## 6. Data-driven obsah

- Suroviny, budovy, recepty, techy, upgrady, achievementy, eventy jsou **data** (`/src/data/*.ts|json` validované schématem), ne kód.
- Herní logika interpretuje efekty deklarativně (`effect: {kind:'multiplier', target:'resource:wood', value:2}`), takže **přidání obsahu = přidání dat** + případně nový „effect kind" handler.
- Výhody: balancování bez zásahu do logiky, snadné testy, moddovatelnost, méně bugů. Viz [16](16-data-schemas.md), [15](15-content-catalog.md).

## 7. Struktura projektu (návrh)

```
/ (repo)
├── docs/                      # tato dokumentace
├── index.html
├── package.json  vite.config.ts  tsconfig.json
├── public/                    # statické (atlasy, audio, favicon)
├── src/
│   ├── main.ts                # bootstrap: init sim, renderer, ui, loop
│   ├── config.ts              # konstanty (SIM_DT, CHUNK_SIZE, capy)
│   ├── sim/                   # SIMULACE (headless, bez Pixi/React)
│   │   ├── state/             # SoA stores, GameState
│   │   ├── systems/           # production, needs, growth, research, worldgen, allocation, events
│   │   ├── worldgen/          # noise, biomy, generování chunků, uzlů
│   │   ├── economy/           # vzorce (production, cost curves, happiness)
│   │   ├── loop.ts            # fixed-timestep + offline compute
│   │   └── eventBus.ts
│   ├── render/                # PixiJS: scéna, kamera, world layer, agents (instanced), particles, day-night
│   ├── ui/                    # React: HUD, panely, menu, Zustand store, formatNumber
│   ├── audio/                 # AudioManager (Howler), reakce na eventy
│   ├── data/                  # data-driven obsah + JSON schémata
│   ├── save/                  # serializace, migrace, komprese, IndexedDB
│   └── util/                  # math, rng (seedable), format, pool
├── tests/                     # Vitest: ekonomika, save round-trip, balanc sanity
└── README.md
```

## 8. Determinismus a RNG

- **Seedable RNG** (např. mulberry32/xorshift) uložený v save → reprodukovatelnost (worldgen, eventy, criti offline vs. online konzistentní).
- Worldgen je čistě funkce(seed, coords) → není třeba ukládat mapu, jen delty ([02](02-world-and-map.md)).
- Fixed-timestep + seed RNG = základ pro **offline výpočet** i **testovatelnost** (stejný vstup → stejný výstup).

## 9. Výkonová pravidla (shrnutí, viz [03 §11](03-people-and-work.md))

- Ekonomika O(druhy práce), ne O(lidi); SoA typed arrays; žádné alokace v hot loopu (pooling).
- Render: batch/instanced, cap viditelných agentů a particlů, LOD, atlasy.
- UI: throttled sync, virtualizace dlouhých seznamů (achievementy/tech), memoizace.
- Sim/render/UI oddělené vlákno? Pro MVP jedno vlákno stačí (ekonomika je levná). **Volitelně web worker** pro simulaci při extrémním škálování (později; hranice už je čistá, takže přesun do workeru je proveditelný).

## 10. Kvalita a CI

- **Vitest** unit testy: ekonomické vzorce, cost curves, save serialize→deserialize round-trip, migrace verzí, „sanity" balanc testy (běh se nezhroutí / nevystřelí do NaN/Infinity za X simulovaných minut).
- **ESLint + Prettier**, TS `strict`.
- **CI** (GitHub Actions): lint + typecheck + test + build na PR. (Web session bez `gh` používá GitHub MCP.)
- Doporučen **SessionStart hook** pro Claude Code na webu, aby uměl spustit testy/lint (viz [14 §Fáze 0](14-roadmap.md)).

## 11. Rizika a mitigace

| Riziko | Mitigace |
|--------|----------|
| Výkon na tisících lidí | Agregovaná ekonomika + LOD + instancing od začátku (ne „až potom") |
| Rozjetý balanc (exponenciály) | Data-driven čísla + sanity testy + [13](13-balancing-and-formulas.md) |
| Bobtnání scope | Guardraily v [00](00-vision-and-pillars.md); MVP dřív ([14](14-roadmap.md)) |
| Save nekompatibilita mezi verzemi | Verzování + migrace + testy round-trip ([12](12-save-system.md)) |
| Float nepřesnost u velkých čísel | Konzistentní number handling; pro extrémy zvážit BigNumber lib (break_infinity.js) — až bude potřeba |
