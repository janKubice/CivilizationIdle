# 02 — Svět a mapa

Pokrývá: teoreticky nekonečnou mapu, procedurální generování terénu a surovin, a **organický růst města**.

---

## 1. Souřadnicový systém

- Svět je **mřížka dlaždic** (tile grid) s celočíselnými souřadnicemi `(tx, ty)`, teoreticky neomezená v obou osách (v praxi omezená rozsahem `Number.MAX_SAFE_INTEGER`, což je pro idle hru „nekonečno").
- Jedna dlaždice = základní jednotka umístění (budova zabírá 1..N dlaždic, surovinový uzel 1 dlaždici).
- **Chunk** = blok `CHUNK_SIZE × CHUNK_SIZE` dlaždic (doporučeno `32×32`). Svět je slovník chunků klíčovaný `"cx,cy"`, kde `cx = floor(tx / CHUNK_SIZE)`.
- Render používá plynulé float souřadnice (kamera, interpolace agentů); logika používá integer tile souřadnice.

## 2. Nekonečná mapa přes chunky

### Princip
Nikdy negenerujeme ani nedržíme v paměti celý svět. Držíme jen chunky, které jsou:
- **aktivní** (obsahují město / uzly, se kterými se pracuje), nebo
- **viditelné** (v okně kamery + malý okraj).

### Životní cyklus chunku
```
NEEXISTUJE ──generate()──► LOADED (v paměti) ──►  VISIBLE (renderuje se)
     ▲                          │
     └──────unload()◄───────────┘   (když je daleko od kamery i města a nemá aktivní stav)
```

- **Generování je deterministické** z globálního `worldSeed` + souřadnic chunku → stejný chunk vždy vypadá stejně, není nutné ho ukládat, pokud se nezměnil.
- **Ukládáme jen „delty"**: co hráč v chunku změnil (postavené budovy, vytěžená/změněná ložiska). Ostatní se dogeneruje. To drží save malý (viz [12](12-save-system.md)).
- Chunky mimo dosah se **unloadují** (uvolní se jejich sprity/mesh), ale jejich delta zůstává v save datech.

### Datový model chunku (koncept)
```ts
interface Chunk {
  cx: number; cy: number;
  tiles: Uint8Array;          // biome/terrain id per tile (CHUNK_SIZE²), z generátoru
  nodes: ResourceNode[];      // surovinové uzly v chunku
  buildings: BuildingRef[];   // reference na budovy (vlastní data v BuildingStore)
  delta: ChunkDelta | null;   // změny oproti generátoru (pro save)
  state: 'loaded' | 'visible';
}
```
Formální schéma: [16](16-data-schemas.md).

## 3. Procedurální generování

### Vrstvy generátoru (per tile, deterministicky ze seedu)
1. **Elevation** (výška) — simplex noise, low frequency. Určuje voda / nížina / kopce / hory.
2. **Moisture** (vlhkost) — druhý simplex noise. S elevation určuje **biom**.
3. **Biome** — lookup z (elevation, moisture): voda, pláž, louka, les, step, kopce, hory, poušť, tundra.
4. **Resource placement** — na vhodných biomech se s deterministickou pravděpodobností (hashovaný noise / blue-noise pro rozestup) rozmístí **surovinové uzly**:
   - Les → stromy (dřevo), keře (bobule/jídlo).
   - Louka/step → úrodná půda (pole), zvěř.
   - Kopce → balvany (kámen), rudné žíly (měď, železo, uhlí).
   - Hory → vzácné rudy (zlato), později (s techem) horské doly.
   - Voda → ryby, později přístav.
   - Poušť/spec. → ropa, sůl, vzácné suroviny pro pozdní hru.
5. **Rarita a klastrování** — vzácné suroviny jsou vzácnější a dál od startu (soft difficulty gradient: čím dál od výchozího bodu, tím hodnotnější, ale i „dražší na dosažení" kvůli vzdálenosti/dopravě).

### Knihovna šumu
Doporučeno `simplex-noise` (npm) nebo vlastní hash-based value noise. Seed je součást save. Detail v [11](11-technical-architecture.md).

### Regenerace vs. vyčerpání ložisek
- **Obnovitelné** (les, bobule, ryby, pole): mají zásobu, která se v čase regeneruje; při vyčerpání se uzel „vyčerpá" (změní sprite) a po čase obnoví.
- **Neobnovitelné** (rudné žíly): mají konečnou zásobu; po vytěžení uzel zmizí. Aby mapa „nedošla", **frontier expanze** (viz níže) a **auto-prospecting** techy odhalují/generují nová ložiska dál od centra.

## 4. Organický růst města

Toto je jeden z hlavních vizuálních pilířů: město se **nerozkládá do pravidelné mřížky, kterou hráč vyplňuje**, ale **organicky se šíří** do krajiny. Zároveň to musí zůstat idle-friendly (hráč nemusí ručně stavět každý domek).

### Model: „město jako organismus"
Město má **centrum** (výchozí bod / hlavní budova) a **frontier** (okraj zástavby). Růst probíhá tak, že se na frontieru objevují nové budovy podle pravidel.

### Co staví hráč vs. co roste samo
- **Hráč staví ručně** klíčové **produkční a servisní** budovy (rozhoduje o strategii): pily, doly, farmy, laby, tržiště, monumenty.
- **Samo roste** hlavně **obytná a dekorativní** zástavba (domky, uličky, zeleň, drobná infrastruktura), když jsou splněné podmínky. To je „vata", která dělá město živým, aniž by hráče zavalila mikromanagementem.
- Hráč růst **ovlivňuje**, ne ignoruje: přes **zóny/slidery** (viz níže) říká, jakým směrem/jak hustě má město růst, a přes tech/upgrady mění styl a rychlost.

### Algoritmus organického růstu (koncept)
Growth tick (řádově každých pár sekund, ne každý frame):

1. **Trigger:** město má právo přistavět, pokud `populace > obsazenost bydlení × práh` a je přebytek stavebních surovin (nebo je to „zdarma dekorace" placená pomalu).
2. **Výběr místa (site selection):** z kandidátních dlaždic na **frontieru** (dlaždice sousedící se zástavbou/cestou, na stavitelném biomu) se vybere místo **váženou pravděpodobností**:
   - + blízkost k cestě / náměstí (města rostou podél cest),
   - + blízkost k odpovídajícím zdrojům (farmy k půdě, domky k centru),
   - − příliš velká vzdálenost od centra (drží kompaktnost),
   - + shoda se **zónou** nastavenou hráčem (residential / industrial / farming / green).
3. **Cesty (roads):** růst nejdřív protahuje **cestní síť** z centra ven (jednoduchá heuristika: prodluž cestu k novému shluku; volitelně L-system pro přirozené větvení). Budovy se lepí na cesty → vzniká přirozený uliční vzor, ne mřížka.
4. **Umístění budovy:** vybere se typ dle zóny a potřeb (nejčastěji domek pro bydlení), zaplatí se (pomalu, z „municipal" rozpočtu) a budova se **animovaně postaví** (staveniště → hotovo).
5. **Districting (emergentně):** protože se stejné typy lepí k sobě a ke zdrojům, přirozeně vznikají čtvrti (farmářská u polí, průmyslová u dolů, obytná u centra).

> Pozn.: Growth je **kosmeticko-ekonomický** — obytné domky přidávají kapacitu bydlení a „život", ale nevytvářejí neomezeně job slotů. Ekonomicky důležité budovy staví hráč. Tím se růst nesmí „utrhnout" a rozbít balanc.

### Zóny (jak hráč ovlivní růst, aniž by klikal domky)
- Hráč může na mapě **natřít zóny** (volitelná pokročilá mechanika, odemčená ve fázi 2): Residential, Industrial, Farming, Green/Park.
- Zóna mění váhy v site selection → město roste tam a tak, jak hráč chce.
- Alternativně (jednodušší default) jen **globální slidery** stylu růstu: „kompaktní ↔ rozvolněné", „preferuj bydlení ↔ preferuj zeleň".
- Doporučení pro MVP: začít s **plně automatickým růstem bez zón** (jen se drží frontieru a cest), zóny přidat později jako depth.

### Výkon organického růstu
- Growth běží v **pomalém tick** (např. 0.5–1 Hz), ne per frame.
- Kandidátní dlaždice se drží v malé „frontier" množině, ne že se prochází celá mapa.
- Nově postavené domky mimo viewport se **nerenderují jako živé sprity**, jen se zaznamenají do chunk delty a připočtou ke kapacitě.

## 5. Interakce mapy a ekonomiky

- **Vzdálenost = čas dopravy.** Uzel/budova daleko od skladu znamená delší haul → nižší efektivní produkci, dokud hráč neodemkne dopravní techy (vozíky → silnice → vlaky → vrtulníky/drony). Toto je hlavní důvod, proč expanze do dáli má cenu i náklad. Model dopravy: [03 §Doprava a haul](03-people-and-work.md#doprava-a-haul).
- **Frontier expanze** je motivovaná: vzácné suroviny jsou dál → hráč musí město „natáhnout" nebo postavit vzdálené výsadky (outposty) napojené dopravou.
- **Outposty**: vzdálené těžební základny (odemčené techem), které fungují jako mini-uzly produkce napojené na hlavní město dopravní linkou. Umožňují dosáhnout na vzdálené zdroje bez souvislé zástavby.

## 6. Kamera a viewport

- Volný pan (drag/WASD/šipky), zoom (kolečko/pinch) v rozsahu např. 0.25×–2×.
- „Domů" tlačítko / dvojklik na centrum města.
- Kamera určuje, které chunky jsou `visible` a kteří agenti se plně simulují (LOD, viz [03](03-people-and-work.md)).
- **Minimapa** (odemčená brzy): zobrazuje rozsah města, zdroje, outposty; klik = přesun kamery.

## 7. Shrnutí klíčových rozhodnutí

| Rozhodnutí | Volba | Proč |
|-----------|-------|------|
| Reprezentace světa | Chunkovaná tile grid, 32² | Nekonečnost bez plné paměti |
| Generování | Deterministické ze seedu, ukládají se jen delty | Malý save, konzistence |
| Růst města | Organický, auto pro obytné/dekor, ruční pro produkční | Živé město + idle-friendly + zachovaný balanc |
| Vzdálenost | Ovlivňuje čas dopravy, ne blokuje | Motivace k expanzi i k dopravním techům |
| Vyčerpání zdrojů | Obnovitelné regenerují, rudy konečné + frontier + outposty | Mapa „nedojde", expanze má smysl |
