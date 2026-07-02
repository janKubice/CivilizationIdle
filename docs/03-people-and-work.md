# 03 — Lidé a práce (klíčový systém + optimalizace)

> Toto je nejcitlivější systém hry. Zadání: *„každý človíček je jako zdroj, co umí pracovat, těžit, někam chodit — zkus to optimalizovat."* Cílem je, aby lidé **působili** jako živé jednotlivé bytosti, ale aby simulace **škálovala na tisíce** bez zabití výkonu.

---

## 1. Hlavní myšlenka: odděl simulaci od prezentace

Nejčastější chyba, která takovou hru zabije, je **plná per-agent simulace** (každý člověk každý frame pathfinduje, hledá cíl, nese náklad). To nejde na tisíce entit v prohlížeči.

Řešení — **dvě oddělené vrstvy**:

```
┌─────────────────────────────────────────────────────────────┐
│  EKONOMICKÁ SIMULACE  (pravda o hře)                         │
│  - agregovaná, deterministická, fixed-timestep tick (~10 Hz) │
│  - "kolik čeho se vyrobí" = funkce(přiřazení, rate, tech)    │
│  - NEřeší pohyb jednotlivců krok po kroku                    │
│  - škáluje na libovolný počet lidí (je to pár aritmetik)     │
└─────────────────────────────────────────────────────────────┘
                          │ (počty, přiřazení, stavy)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  VIZUÁLNÍ PREZENTACE  (jak to vypadá)                        │
│  - jen agenti V DOHLEDU KAMERY se plně animují a "chodí"     │
│  - Level of Detail: mimo obraz = žádné sprity, žádný pohyb   │
│  - agenti jsou "herci", kteří odehrávají to, co ekonomika    │
│    už rozhodla; jejich přesná poloha ekonomiku neovlivňuje   │
└─────────────────────────────────────────────────────────────┘
```

**Ekonomika je pravda; agenti jsou divadlo.** Když je farmářů 500, ekonomika spočítá jídlo jedním vzorcem; na obrazovce se hýbe jen těch ~30 farmářů, které vidíš. Hráč nikdy nepozná rozdíl, protože zbytek stejně nevidí.

## 2. Datový model člověka (Citizen)

Logická data člověka jsou minimální a **data-oriented** (Structure-of-Arrays, viz §5). Konceptuálně:

```ts
interface Citizen {
  id: number;
  // Ekonomika (vždy přítomné, levné):
  jobId: number;        // -1 = idle/nezaměstnaný; jinak id job-slotu
  jobKind: JobKind;     // woodcutter | miner | farmer | hauler | builder | scholar | ...
  skill: number;        // 0..N úroveň dovednosti (roste zkušeností → multiplikátor)
  homeId: number;       // id obytné budovy (kapacita bydlení)
  // Prezentace (jen pro "aktivní" agenty v dohledu, jinak se neřeší):
  x: number; y: number; // float pozice (interpolovaná)
  state: AgentState;    // idle | walking | working | hauling | resting
  animPhase: number;    // fáze animace / cesty (0..1)
  spriteVariant: number;// vzhled (viz "variabilita lidí")
}
```

- **Ekonomická pole** (`jobId`, `jobKind`, `skill`, `homeId`) existují pro všechny lidi vždy — je to pár čísel.
- **Prezentační pole** (`x,y,state,animPhase`) se aktivně **udržují jen pro agenty v „aktivní zóně"** (viewport + okraj). Pro ostatní jsou irelevantní / lazy.

## 3. Job sloty místo hledání cílů

Aby lidé **nemuseli za běhu hledat, kam jít a co těžit** (drahé), používáme **job sloty**:

- Každá produkční budova / vytěžitelný uzel vystaví pevný počet **job slotů** (`jobSlots`), případně navýšených upgrady.
- **Job slot** = statická vazba `{ slotId, jobKind, workplacePos, dropoffPos, baseRate }`.
- Přiřazení člověka = zápis `citizen.jobId = slotId` (O(1)). Žádné hledání.
- Produkce slotu je funkce (viz §7), ne výsledek pozorování pohybu.
- Když hráč mění slidery, systém **hromadně** přeřazuje id-čka slotů k lidem (batch), ne per-agent AI rozhodování.

Tím je „člověk umí těžit / pracovat / chodit" vyřešeno jako **vazba + vzorec + volitelná animace cesty**, ne jako plnohodnotná AI.

## 4. Level of Detail (LOD) — tři úrovně

| Úroveň | Kdy | Co se děje |
|--------|-----|-----------|
| **L0 — Plná** | Agent je ve viewportu (+ okraj) | Renderuje se sprite, interpoluje se pohyb po cestě workplace↔dropoff, přehrává animace, může mít particly |
| **L1 — Odlehčená** | Poblíž viewportu (prstenec) | Existuje pozice, ale animace zjednodušená / nižší update rate; sprite volitelně |
| **L2 — Statistická** | Mimo obraz | Žádný sprite, žádná pozice se neupdatuje. Přispívá jen do ekonomiky přes agregát. „Ožije" (dostane pozici) až vstoupí do L1/L0 |

- Přechod L2→L1/L0: agentovi se přiřadí věrohodná pozice (u jeho workplace/domova) a začne se animovat od aktuální fáze.
- **Cap na počet L0 agentů**: i kdyby viewport pokrýval obří město, renderuje se max `MAX_VISIBLE_AGENTS` (např. 300–500); zbytek v záběru je L1/statický dav (viz §9 „dav").

## 5. Data-oriented storage (SoA) — proč a jak

Pro výkon na tisících entit **nepoužívat pole objektů** (`Citizen[]`), ale **Structure-of-Arrays** v typed arrays:

```ts
// místo Citizen[] (roztroušené v paměti, drahý GC):
const jobId   = new Int32Array(MAX_CITIZENS);
const jobKind = new Uint8Array(MAX_CITIZENS);
const skill   = new Uint16Array(MAX_CITIZENS);
const homeId  = new Int32Array(MAX_CITIZENS);
const posX    = new Float32Array(MAX_CITIZENS); // jen pro aktivní se udržuje
const posY    = new Float32Array(MAX_CITIZENS);
const state   = new Uint8Array(MAX_CITIZENS);
const alive   = new Uint8Array(MAX_CITIZENS);   // bitmapa existence
```

Výhody: cache-friendly iterace, žádný per-entita GC tlak, snadná serializace (kopie bufferů), triviální „spočítej kolik lidí má jobKind==miner" (jeden průchod / průběžně udržovaný čítač).

> Doporučená implementace: buď **vlastní SoA store** (nejjednodušší, plná kontrola), nebo **`bitecs`** (ECS knihovna postavená přesně na typed-array SoA). Viz [11](11-technical-architecture.md).

**Klíčový trik:** ekonomika většinou nepotřebuje iterovat jednotlivce vůbec. Stačí jí **agregované čítače** „kolik lidí dělá který jobKind s jakým průměrným skillem". Ty se udržují inkrementálně při (pře)řazení, ne přepočtem přes všechny.

## 6. Fixed-timestep tick vs. render

- **Simulace**: fixní krok `SIM_DT` (např. 100 ms → 10 Hz). Akumulátor konzumuje reálný čas → deterministické, nezávislé na FPS. Jeden tick:
  1. přepočti produkci per jobKind (agregát),
  2. aplikuj spotřebu (jídlo, energie), naplň/odečti sklady s respektem ke kapacitě,
  3. vyhodnoť potřeby/happiness a příliv/odliv lidí,
  4. posuň dlouhé procesy (stavby, research, growth tick jen občas).
- **Render**: `requestAnimationFrame` (typicky 60 Hz). Interpoluje pozice L0 agentů mezi sim kroky (`alpha = akumulátor/SIM_DT`), kreslí svět, UI, particly.
- Oddělení znamená, že **počet lidí neovlivňuje FPS** (ekonomika je O(druhy práce), ne O(lidi)); render je O(viditelní agenti), který je capnutý.

Detail smyčky: [11 §Game loop](11-technical-architecture.md).

## 7. Produkční vzorec (jak „člověk těží")

Produkce dané kategorie za tick:

```
production(jobKind) =
    Σ_over_slots( baseRate_slot )
  × skillFactor(avgSkill)
  × techMultiplier(jobKind)       // z tech tree
  × toolMultiplier(jobKind)       // nástroje/vybavení (laser pušky atd.)
  × happinessFactor               // spokojení lidé makají víc
  × haulEfficiency(jobKind)       // penalizace za vzdálenost (viz §8)
  × globalMultipliers             // upgrady, synergie, ascension
```

- `baseRate_slot` je vlastnost job slotu (uzlu/budovy).
- Počet aktivních slotů = min(job sloty, přiřazení lidé, dostupnost vstupů pro crafting).
- **Crafting** (řetězce) navíc omezuje vstup: slot spotřebuje vstupní suroviny; pokud nejsou, slot stojí (idle) → to je bottleneck, který hráč řeší.
- Vzorec je **čistá aritmetika nad agregáty** → běží stejně rychle pro 10 i 10 000 lidí.

Konkrétní čísla a křivky: [13](13-balancing-and-formulas.md).

## 8. Doprava a haul {#doprava-a-haul}

Vzdálenost dělá hru prostorovou, aniž bychom museli simulovat každou cestu:

- Každý job slot má **vzdálenost `d`** mezi workplace a nejbližším vhodným skladem/dropoffem (spočítá se při vzniku/přesunu, ne každý tick).
- `haulEfficiency = f(d, transportTech)` — klesající funkce vzdálenosti, kterou **dopravní techy zplošťují** (silnice, vozíky, vlaky, vrtulníky/drony efektivně ruší penalizaci).
- Volitelně **dedikovaní haulers** (nosiči) jako vlastní jobKind: zvyšují propustnost dopravy mezi vzdálenými outposty a městem (další slider).
- Vizuálně: L0 agenti opravdu chodí po cestě tam a zpět; ale **efektivní produkci určuje vzorec**, ne dokončení konkrétní cesty. Animace jen „ilustruje" už spočítaný tok.

## 9. Vizuální dav a variabilita lidí

Aby město „žilo", potřebujeme hodně viditelných postaviček, ale levně:

- **Instanced rendering**: všechny postavičky stejného sprite-sheetu se kreslí jedním batch draw callem (PixiJS `ParticleContainer` / instanced mesh). Tisíce sprite-ů = jednotky draw callů.
- **Variabilita vzhledu** bez nákladů: `spriteVariant` vybírá z palety (barva oblečení, tón kůže, doplněk), animace se sdílejí. Vytváří dojem individuality při jedné textuře.
- **Idle chování**: nepřiřazení lidé se procházejí po městě, postávají u budov, jdou „domů" v noci — čistě kosmetické, jen pro L0/L1, řízené levným „ambientním" pohybem (náhodná procházka po cestách), ne pathfindingem.
- **Cap davu**: nad limit viditelných agentů se zbytek reprezentuje jako **statická „hustota davu"** (např. víc teček/míň detailu při odzoomování) — hráč vnímá „je jich hodně", ne přesné jednotlivce.

## 10. Životní cyklus obyvatele

- **Příchod**: když happiness + kapacita bydlení + přebytek jídla dovolí, `growth` vytvoří nové obyvatele (batch). Objeví se animací (přijdou po cestě z okraje / z „migrace").
- **Přiřazení**: automaticky dle sliderů/priorit do volných slotů; nebo ručně.
- **Skill růst**: prací roste `skill` daného člověka/kategorie (nebo per-kategorie agregátní skill pro jednoduchost) → mírný multiplikátor, odměna za stabilní alokaci.
- **Odchod**: při dlouhodobě nesplněných potřebách část lidí odejde (batch úbytek), produkce klesne — signál k nápravě, ne trest.
- **Smrt/stáří**: v základu **není** (idle, odpouštějící). Volitelný pozdní mechanismus (generace) jen pokud přinese zábavu — default vypnuto.

## 11. Shrnutí optimalizačních pravidel (checklist pro implementaci)

1. **Ekonomika agregovaně** — produkce = vzorec nad čítači per jobKind, ne suma per-agent. O(druhy), ne O(lidi).
2. **SoA / typed arrays** pro data lidí; udržuj inkrementální čítače přiřazení.
3. **LOD**: plně žijí jen agenti v dohledu; ostatní jsou statistika.
4. **Cap na viditelné agenty**; instanced/batch rendering; object pooling spritů.
5. **Fixed-timestep sim** oddělený od renderu; interpolace pro plynulost.
6. **Job sloty** místo runtime hledání cílů; přeřazování batchově.
7. **Vzdálenost předpočítaná** (haul distance per slot), ne per-tick pathfinding.
8. **Growth/organický růst v pomalém ticku**, ne per frame.
9. **Bez per-agent GC**: žádné alokace v hot loopu, recykluj buffery a sprity.

Dodržení těchto pravidel = plynulý běh i s desítkami tisíc obyvatel, protože drahé věci (render, pohyb) jsou omezené na to, co hráč vidí, a levné věci (ekonomika) jsou konstantně levné bez ohledu na počet.
