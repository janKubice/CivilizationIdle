# 12 — Save systém

Cíl: spolehlivé ukládání, malý save i pro nekonečnou mapu, verzování/migrace a **offline výpočet** při návratu.

---

## 1. Úložiště

- **IndexedDB** (přes `idb-keyval`) jako primární úložiště — větší kapacita než localStorage, async, nezablokuje UI.
- **Fallback** na localStorage, pokud IndexedDB není dostupné (privátní režimy).
- Klíče: `save:main` (aktivní hra), `save:backup:N` (rotující zálohy), `settings` (mimo save, aby přežilo hard reset hry).

## 2. Co se ukládá (a co ne)

Ukládáme **jen to, co nejde dogenerovat**:

| Ukládá se | Neukládá se (dogeneruje se) |
|-----------|------------------------------|
| `meta` (seed, verze, časy, playtime) | Terén/biomy chunků (z seedu) |
| **Chunk delty** (co hráč změnil: budovy, vytěžená ložiska) | Nezměněné chunky |
| `resources` (množství, kapacity) | Odvozené rate (`+/s`) |
| `citizens` (agregát/SoA: počty per jobKind, skill, kapacity) | Přesné pozice/animace L0 agentů (kosmetika) |
| `buildings` (typ, pozice, level) | Sprite/particle stav |
| `tech`, `upgrades`, `achievements`, `allocation`, `legacy`, `stats`, `settings` | |

- **Pozice jednotlivých agentů se neukládají** — jsou to „herci" ([03](03-people-and-work.md)); po načtení se lidé znovu rozmístí dle přiřazení. Ukládá se jen **ekonomicky relevantní agregát** (kolik lidí kde pracuje, kapacity, skill). To drží save malý i při desítkách tisíc obyvatel.

## 3. Serializace a velikost

- Stav → **plain JSON-serializovatelný objekt** (žádné třídy/funkce/cyklické reference; SoA typed arrays → base64/číselná pole).
- **Komprese LZ-String** (`compressToUTF16` / `compressToBase64`) → typicky výrazně menší.
- Cíl: i velké město = jednotky až desítky KB díky deltám a agregaci.

## 4. Verzování a migrace

- Save nese `version` (schéma). Při načtení, pokud `save.version < CURRENT`, spustí se **řetěz migrací** `migrate[v]→[v+1]` postupně na aktuální.
- Migrace jsou čisté funkce `(oldState) => newState`; každá má test (round-trip a „starý save se načte").
- Neznámá/vyšší verze (save z novější verze hry) → varování a bezpečné odmítnutí/backup, ne pád.

## 5. Autosave, zálohy, export/import

- **Autosave** periodicky (např. každých 30–60 s) a při klíčových akcích (ascension, zavření/`beforeunload` – best effort), throttled.
- **Rotující zálohy** (posledních N) proti korupci.
- **Export/Import**: save jako string (komprimovaný base64) do schránky/souboru → přenos mezi zařízeními, sdílení, ruční záloha.
- **Ochrana proti korupci**: zápis přes „write new → validate → swap"; při načtení validace schématem, při selhání fallback na poslední dobrou zálohu.

## 6. Offline výpočet (návrat do hry)

Při načtení:
1. `Δt = clamp(now − meta.lastSaved, 0, OFFLINE_CAP)` (cap např. 8–24 h, rozšiřitelný upgradem; záporný/skokový čas → 0, viz anti-cheat).
2. Dopočítej produkci za `Δt` pomocí **stejné headless simulace** ([11 §2](11-technical-architecture.md)):
   - **Rychlá cesta**: analytický přírůstek pro lineární úseky (produkce/s × čas × offline efektivita), s ohledem na kapacity skladů.
   - **Věrná cesta**: **coarse-tick** — spusť simulaci s většími kroky a capem počtu iterací, aby se zohlednily nelineární efekty (růst, bottlenecky). Doporučeno pro věrnost; rychlá cesta pro MVP.
3. Aplikuj **offline efektivitu** (default < 100 %, upgrady zvyšují) → aktivní hraní má smysl.
4. Zobraz **souhrn** („Byl jsi pryč …, získal jsi …") + volitelný „welcome back" bonus.

> Protože simulace je deterministická a nezávislá na renderu, offline výpočet je „jen" spuštění téže logiky ve zrychlení — žádná duplicitní „offline verze ekonomiky".

## 7. Anti-cheat / integrita (lehká, singleplayer)

- Detekce manipulace časem (posun hodin zpět/skok) → cap/ignore offline.
- Volitelný lehký kontrolní součet save (proti náhodné korupci, ne proti odhodlanému hráči — je to singleplayer, tvrdý anti-cheat nemá smysl).
- **Hard reset** (smazat vše) za dvojím potvrzením; **soft reset** = ascension.

## 8. API modulu save (návrh)

```ts
interface SaveModule {
  save(state: GameState): Promise<void>;          // serialize+compress+persist (+rotace záloh)
  load(): Promise<LoadResult>;                     // load+decompress+validate+migrate
  computeOffline(state: GameState, now: number): OfflineSummary; // aplikuje offline zisk
  export(state: GameState): string;                // base64 string
  import(data: string): GameState;                 // validace+migrace
  hardReset(): Promise<void>;
}
```

## 9. Testy (nutné)

- **Round-trip**: `deserialize(serialize(state))` ≈ `state` (v rámci tolerancí).
- **Migrace**: každý `migrate[v]` má fixture starého save → nový bez pádu.
- **Offline**: `computeOffline` dá očekávané hodnoty pro známý stav a `Δt` (a respektuje cap/efektivitu).
- **Odolnost**: poškozený/prázdný/cizí save → graceful fallback, ne crash.
