# 15 — Katalog obsahu (datové tabulky)

Startovní obsah k implementaci. Vše je **návrh k vyladění** a **data-driven** ([16](16-data-schemas.md)) — čísla jsou orientační ([13](13-balancing-and-formulas.md)). Slouží jako výchozí seed dat, ne finální balanc.

---

## 1. Suroviny (resources)

| id | Název | Kategorie | Éra | Zdroj |
|----|-------|-----------|-----|-------|
| `wood` | Dřevo | raw | 0 | stromy (klik/dřevorubec) |
| `food` | Jídlo | raw | 0 | keře, lov, farmy, ryby |
| `water` | Voda | raw | 0 | pramen/studna |
| `stone` | Kámen | raw | 0 | balvany |
| `plank` | Prkna | refined | 1 | pila (wood→) |
| `brick` | Cihly | refined | 2 | cihelna (stone/clay→) |
| `clay` | Hlína | raw | 1 | ložiska u vody |
| `copperOre` | Měděná ruda | raw | 1 | žíly |
| `copperIngot` | Měděný ingot | refined | 1 | huť |
| `ironOre` | Železná ruda | raw | 2 | žíly |
| `ironIngot` | Železný ingot | refined | 2 | huť |
| `coal` | Uhlí | raw | 4 | ložiska |
| `steel` | Ocel | refined | 4 | ocelárna (iron+coal→) |
| `tools` | Nástroje | refined | 1 | dílna/kovárna → ×těžba |
| `gold` | Zlato/mince | abstract(měna) | 1 | tržiště |
| `research` | Věda | abstract | 0 | knihovna/učenci |
| `energy` | Energie | abstract(flow) | 4 | elektrárny |
| `machinery` | Stroje | advanced | 4 | továrna |
| `electronics` | Elektronika | advanced | 5 | hi-tech dílna |
| `oil` | Ropa | raw | 5 | ropné pole |
| `fuel` | Palivo | advanced | 5 | rafinerie |
| `laserModule` | Laserový modul | advanced | 6 | (electronics+…) → laser pušky |
| `composite` | Kompozit | advanced | 6 | endgame |
| `legacy` | Odkaz (Legacy) | meta | — | ascension |

> Rozšiřitelné (sůl, sklo, papír, luxusní zboží, nanomateriály…). Přidání = řádek v datech.

## 2. Budovy (buildings)

| id | Název | Typ | Éra | Vstup | Výstup / efekt | Job |
|----|-------|-----|-----|-------|----------------|-----|
| `storehouse` | Skladiště | storage | 0 | — | +kapacita surovin | — |
| `hut` | Chatrč | housing | 0 | — | +bydlení; spouští growth | — |
| `forestCamp` | Dřevorubecký tábor | production | 0 | — | wood | woodcutter |
| `gatherHut` | Sběračská chýše | production | 0 | — | food | forager |
| `well` | Studna | service | 1 | — | water, +happiness | — |
| `quarry` | Lom | production | 0 | — | stone | miner |
| `sawmill` | Pila | crafting | 1 | wood | plank; adjacency u lesa | sawyer |
| `farm` | Farma | production | 1 | (water) | food (stabilní) | farmer |
| `smelter` | Huť | crafting | 1 | ore | ingot | smelter |
| `workshop` | Dílna | crafting | 1 | plank/ingot | tools | crafter |
| `market` | Tržiště | service | 1 | přebytky | gold, +happiness | trader |
| `library` | Knihovna | special | 0 | — | research | scholar |
| `brickworks` | Cihelna | crafting | 2 | stone/clay | brick | crafter |
| `aqueduct` | Akvadukt | service | 2 | — | water na dálku | — |
| `temple` | Chrám | service | 2 | — | +happiness, strop pop | — |
| `mill` | Mlýn | crafting | 3 | — | automatizace (bez lidí navíc) | — |
| `university` | Univerzita | special | 3 | — | ×research | scholar |
| `steelworks` | Ocelárna | crafting | 4 | iron+coal | steel | smelter |
| `powerPlant` | Elektrárna | power | 4 | coal/… | energy | operator |
| `factory` | Továrna | crafting | 4 | (energy) | machinery; automatizace | operator |
| `trainStation` | Nádraží | logistics | 4 | — | ↑haul range | hauler |
| `outpost` | Outpost | production | 3 | — | vzdálená těžba napojená dopravou | dle typu |
| `hitechLab` | Hi-tech laboratoř | crafting | 5 | steel/energy | electronics | scholar/operator |
| `refinery` | Rafinerie | crafting | 5 | oil | fuel | operator |
| `laserForge` | Laserová zbrojnice | crafting | 6 | electronics/… | laserModule → laser pušky | crafter |
| `heliport` | Heliport | logistics | 6 | fuel/composite | vrtulníky/drony → haul ≈ ∞ | hauler |
| `fusionPlant` | Fúzní elektrárna | power | 6 | — | obří energy | operator |
| `monument` | Monument | special | 2+ | hodně surovin | milník, +civScore (ascension gate) | — |
| `ascensionSpire` | Věž odkazu | special | 6 | — | odemyká ascension | — |

## 3. Kategorie práce (jobKind)

`woodcutter, forager, farmer, fisher, hunter, miner, sawyer, smelter, crafter, trader, scholar, operator, hauler, builder`
(+ `idle` pro nezaměstnané). Každá má vlastní slider/prioritu ([04 §6](04-economy-and-resources.md)) a případné vizuální rozlišení ([09 §5](09-art-direction.md)).

## 4. Tech tree uzly (výběr) — viz [05](05-tech-tree.md) pro kontext

| id | Éra | Větev | Odemyká |
|----|-----|-------|---------|
| `stoneTools` | 0 | Gathering | kamenné nástroje (+yield) |
| `firstHearth` | 0 | Society | research generace |
| `basketry` | 0 | Logistics | základní haul |
| `copperSmelting` | 1 | Crafting | huť, měď |
| `agriculture` | 1 | Gathering | farmy |
| `wheel` | 1 | Logistics | vozík (haul++) |
| `marketplace` | 1 | Society | tržiště, gold upgrady |
| `ironWorking` | 2 | Crafting | železo, ocelové nástroje |
| `masonry` | 2 | City | cihly, odolné budovy |
| `writing` | 2 | Science | knihovna, rychlejší věda; otevírá éru 3 |
| `roads` | 2 | Logistics | silnice (haul++, růst podél cest) |
| `guilds` | 3 | Crafting | vícestupňový crafting |
| `watermill` | 3 | Crafting | první stroj/automatizace |
| `university` | 3 | Science | ×research; otevírá éru 4 |
| `steamPower` | 4 | Power | energie, parní stroj |
| `factories` | 4 | Crafting | továrny/automatizace |
| `railways` | 4 | Logistics | vlaky, outposty |
| `electricity` | 4 | Power | elektrická síť |
| `electronicsTech` | 5 | Science | elektronika |
| `heavyMachinery` | 5 | Gathering | rypadla |
| `oilTech` | 5 | Power | ropa/palivo |
| `laserMining` | 6 | Gathering | **laserové těžební pušky** |
| `rotorcraft` | 6 | Logistics | **vrtulníky/drony** (haul ≈ ∞) |
| `robotics` | 6 | Crafting | robotičtí dělníci |
| `fusion` | 6 | Power | fúze |
| `ascensionResearch` | 6 | Science | odemyká/vylepšuje ascension |

## 5. Upgrady (seed) — viz [06](06-upgrades-and-synergies.md)

| id | Efekt |
|----|-------|
| `sharpTools_I..V` | ×1.5 yield dané těžby (řetězec) |
| `strongArms_I..V` | ×click |
| `divisionOfLabor` | +% produkce za každý aktivní druh práce |
| `urbanPlanning` | +bydlení, rychlejší organický růst |
| `logisticsNetwork` | haul penalizace −50 %, bonus při plné dopravě |
| `scientificMethod` | každý tech +0.5 % research |
| `feasts` | přebytek jídla → happiness |
| `overclock` | přebytek energie → +% strojní produkce (za vyšší spotřebu) |
| `goldRush` | Golden Citizen 2× častěji, +50 % buff |
| `kineticClick` | klik dá X % produkce/s |
| `foreman` | auto-alokace volných lidí (QoL) |
| `warehouseExpansion_I..` | +kapacita skladů |
| `overflowConversion` | přebytek nad kapacitou → jiná surovina/research |

## 6. Achievementy (seed) — viz [07 §1](07-meta-progression.md)

| id | Podmínka | Odměna |
|----|----------|--------|
| `firstBlood` | první gather | tutoriál tip |
| `firstBuilding` | postav 1. budovu | — |
| `firstSawmill` | postav pilu | — |
| `population100/1k/10k` | dosáhni pop | +% produkce (řetězec) |
| `era3/5/6` | dosáhni éry | +% produkce |
| `stockpileWood1M` | 1M dřeva | +% dřevo |
| `noWaste10min` | 10 min bez plýtvání | +kapacita/efektivita |
| `clicker100k` | 100k kliků | +click |
| `firstAscension` | 1. ascension | +% Legacy zisk |
| `ascension10` | 10 ascensionů | odemkne specializaci/perk |
| `secretEasterEgg*` | skryté | kosmetika |

## 7. Eventy (seed) — viz [06 §4](06-upgrades-and-synergies.md)

| id | Trigger | Efekt |
|----|---------|-------|
| `goldenCitizen` | náhodně (throttled) | klik → frenzy ×7 / balík surovin / click frenzy |
| `festival` | periodicky | dočasně +happiness/+produkce, vizuál |
| `richDeposit` | náhodně na frontieru | bohaté ložisko |
| `drought` (mild) | náhodně, volitelné | dočasně −jídlo (řešitelné) |
| `eraFanfare` | vstup do éry | vizuál/zvuk milník |

## 8. Poznámka k rozšiřitelnosti
Vše výše je **seed**. Cílový obsah bude větší (víc surovin, budov, ~100+ techů/upgradů, desítky achievementů). Protože je vše data-driven ([16](16-data-schemas.md)), rozšiřování je přidávání záznamů + případně nových „effect kind" handlerů, ne přepis logiky.
