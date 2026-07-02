# 04 — Ekonomika a suroviny

Pokrývá suroviny, výrobní řetězce, sklady, spotřebu, potřeby a **slidery alokace práce**. Konkrétní čísla jsou v [13](13-balancing-and-formulas.md) a datové tabulky v [15](15-content-catalog.md).

---

## 1. Kategorie surovin

| Kategorie | Příklady | Role |
|-----------|----------|------|
| **Raw / suroviny** | dřevo, kámen, bobule/jídlo, voda, rudy (měď, železo, uhlí, zlato), hlína, ryby, ropa | Základ, těží se z uzlů |
| **Refined / zpracované** | prkna, cihly, měděný/železný ingot, ocel, sklo, nástroje, papír | Výstup craftingu, vstup pro pokročilé |
| **Advanced / pokročilé** | stroje, elektronika, palivo, kompozity, laserové moduly, součástky vrtulníků | Pozdní hra, mocné multiplikátory |
| **Abstract / abstraktní** | research (věda), happiness (spokojenost), gold/mince (měna), energie/power | Neskladují se stejně; pohánějí systémy |
| **Meta** | populace, Legacy měna (ascension) | Progrese napříč běhy |

> Přesný seznam v [15 — Katalog obsahu](15-content-catalog.md). Přidávání surovin je **data-driven** (viz [16](16-data-schemas.md)), takže rozšíření je otázka dat, ne kódu.

## 2. Výrobní řetězce (production chains)

Suroviny tvoří orientovaný graf. Ukázka rané části:

```
strom ──► DŘEVO ──►(pila)──► PRKNA ──►(dílna)──► NÁSTROJE ─┐
balvan ─► KÁMEN ──►(cihelna)► CIHLY                        ├─► zvyšují yield těžby
rudná žíla► RUDA ─►(huť)────► INGOT ──►(kovárna)► NÁSTROJE ─┘
keř ─────► JÍDLO                (spotřeba populace)
pramen ──► VODA                 (spotřeba populace)
knihovna ► RESEARCH             (tech tree)
```

Pozdější řetězce (průmysl+): uhlí+železo → ocel; ocel+stroje → továrny; ropa → palivo; elektronika + lasery → laserové těžební pušky; palivo + kompozity → vrtulníky. Plný graf: [15](15-content-catalog.md).

### Pravidla řetězců
- Crafting budova má **vstupní** a **výstupní** suroviny + rychlost. Bez vstupů → stojí (bottleneck).
- Řetězce jsou **idle-friendly**: bez pixel-perfect dopravníků. „Vstup je dostupný, pokud je na skladě" — logistika je abstrahovaná do haul efektivity (viz [03 §8](03-people-and-work.md#doprava-a-haul)).
- Delší řetězce = vyšší hodnota, ale víc bottlenecků k vyřešení → hloubka optimalizace.

## 3. Sklady a kapacita

- Každá surovina má **kapacitu skladu** (součet skladovacích budov + upgradů pro danou surovinu/skupinu).
- Produkce nad kapacitu se **plýtvá** (default) → motivace stavět sklady. Upgrade „overflow → převod" může přebytek konvertovat (např. přebytečné dřevo → trocha research) jako synergie.
- **Abstract** suroviny: research se hromadí bez limitu (nebo měkký limit), happiness je index (0..1), energie je **flow** (výroba vs. spotřeba za tick, ne zásoba — nebo malá bufferová baterie).

## 4. Spotřeba a potřeby

Populace generuje **spotřebu** škálující s počtem lidí:

| Potřeba | Zdroj plnění | Efekt při nesplnění |
|---------|--------------|---------------------|
| Jídlo | farmy, lov, ryby | růst se zastaví, pak odliv lidí |
| Bydlení (kapacita) | obytné budovy + organický růst | noví lidé nepřicházejí |
| Voda | studny, akvadukty | snižuje happiness |
| Spokojenost (happiness) | tržiště, chrám, kultura, parky, luxus | nižší produkční multiplikátor, odliv |
| (pozdě) Zdraví, Kultura, Luxus | lázně, divadlo, luxusní zboží | odemyká vyšší populační strop a bonusy |

**Happiness** je agregátní index z plnění potřeb; ovlivňuje `growthRate` a `happinessFactor` v produkčním vzorci ([03 §7](03-people-and-work.md)). Vzorce: [13](13-balancing-and-formulas.md).

## 5. Energie / power (od fáze 3)

- Zavádí se jako **flow zdroj**: budovy energii vyrábějí (uhelná elektrárna → později solár, fúze) a spotřebovávají (stroje, lasery).
- Pokud spotřeba > výroba → stroje běží na snížený výkon (proporční škrcení), ne blackout.
- Přidává novou optimalizační vrstvu a je branou k hi-tech produkci.

## 6. Alokace práce (slidery) {#alokace-prace}

Hlavní nástroj hráče, jak řídit ekonomiku, aniž by klikal jednotlivce.

### Model
- Lidé jsou rozděleni do **kategorií práce (jobKind)**. Volní (nezaměstnaní) lidé se rozdělují podle nastavení.
- **Slider režim (default):** pro každou kategorii slider „kolik z volných lidí sem". Slidery jsou provázané (normalizují se do 100 %) nebo absolutní počty s tlačítky +/−. Systém pak plní job sloty dané kategorie.
- **Priorita režim (pokročilý):** hráč seřadí kategorie dle priority; sloty se plní shora dolů, přebytek jde na další. Vhodné pro „vždy měj plné farmáře, zbytek do těžby".
- **Presety:** hráč si uloží konfigurace sliderů (např. „build mode", „research rush") a přepíná je jedním klikem.

### Chování při změně
- Změna slideru → systém spočítá cílové počty per kategorie → **batch přeřazení** id-ček slotů (O(1) na osobu, žádná AI). Vizuálně L0 agenti „odejdou" ze staré práce a „přijdou" k nové.
- **Overflow lidí** (víc lidí než slotů) → zůstávají idle (procházejí se), jsou rezerva pro nové budovy.
- **Nedostatek lidí** → sloty zůstanou prázdné, produkce nižší → signál „potřebuješ víc lidí / bydlení".

### Auto-alokace (QoL)
- Volitelné „auto-balance", které drží kritické potřeby (jídlo) plné a zbytek rozděluje dle sliderů → méně mikromanagementu pro pohodové hráče. Odemyká se upgradem/techem.

## 7. Měna (gold/mince) a obchod

- **Gold** vzniká z **tržiště** (prodej přebytků) a plnění potřeb; slouží k nákupu upgradů, urychlení staveb, obchodu.
- Volitelný **obchod / karavany / přístav** (pozdější éra): směna surovin za gold nebo mezi surovinami s marží → řeší lokální nedostatky a je zdrojem synergií.

## 8. Ekonomické bottlenecky jako obsah

Design záměrně tvoří **řešitelná úzká hrdla**, protože jejich řešení je zábava:
- Málo skladu → přetékání → postav sklady / overflow upgrade.
- Málo vstupu pro crafting → řetězec stojí → doplň těžbu / přealokuj slidery.
- Vzdálené zdroje → nízká haul efektivita → dopravní tech / outpost.
- Nízký happiness → pomalý růst → servisní budovy.
- Málo energie → škrcení → víc elektráren / efektivnější stroje.

Každé hrdlo má **jasný signál v UI** (viz [08](08-ui-ux.md)) a jasné řešení → hráč se cítí chytře, ne frustrovaně.

## 9. Datová reprezentace (shrnutí)

- Suroviny: `Record<ResourceId, { amount, capacity, perSec }>` — `perSec` je odvozené (produkce − spotřeba) pro UI.
- Vše je **data-driven** z definic (`resources.json`, `recipes.json`, `buildings.json`) → balancování a rozšiřování bez zásahu do logiky. Schémata: [16](16-data-schemas.md).
