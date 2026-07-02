# 06 — Upgrady, synergie a wow efekty

Tech tree odemyká **možnosti**; upgrady a synergie z nich dělají **buildy** a „aha momenty". Tento dokument je zásobárna nápadů i pravidel, jak je tvořit. Vše je **data-driven** ([16](16-data-schemas.md)).

---

## 1. Typy upgradů

| Typ | Efekt | Příklad |
|-----|-------|---------|
| **Globální multiplikátor** | ×N na veškerou produkci | „Industrializace: ×2 produkce" |
| **Per-surovina** | ×N na konkrétní surovinu | „Ostré pily: ×2 dřevo" |
| **Per-budova/kategorie** | ×N nebo +kapacita dané budově | „Hlubší doly: +50 % yield dolů" |
| **Per-klik** | zvýší gather na klik / crit | „Silné paže: ×3 na klik" |
| **Kvalita života (QoL)** | automatizace, presety, auto-balance | „Předák: auto-alokace volných lidí" |
| **Odemykací** | zpřístupní budovu/surovinu/mechaniku | často výstup tech uzlu |
| **Škálující** | efekt roste s herním stavem | „×1 % produkce za každých 10 obyvatel" |

- Ceny rostou dle cost curve ([13](13-balancing-and-formulas.md)); pozdní upgrady stojí i pokročilé suroviny, ne jen gold.
- Upgrady mají **řetězce** (levely I/II/III) i **jednorázové** unikáty.

## 2. Synergie — srdce „wow efektů"

Synergie = pravidlo, kde **jeden systém zesiluje jiný**. Cílem je, aby hráč objevil kombinace, které dají nečekaně velký skok. Kategorie a konkrétní nápady:

### 2.1 Adjacency (sousedství)
- **Sawmill u lesa**: pila vedle lesních uzlů +X % dřeva. → motivace k rozvážnému rozmístění.
- **Doly u sebe** (mining district): každý sousední důl +X % → shlukování.
- **Park mezi obytnými**: parky obklopené domky dávají víc happiness.
- **Elektrárna u továren**: snižuje ztráty energie na dálku.
- Implementačně levné: adjacency se počítá při stavbě/změně, ne per tick.

### 2.2 „Každé X zvyšuje Y" (množstevní)
- „Každá knihovna +2 % research **všem** knihovnám" (superlineární věda).
- „Každých 100 obyvatel +1 % globální produkce."
- „Každý odemčený tech +0,5 % research" (věda zrychluje sebe sama).
- Pozor na balanc: superlineární efekty musí mít protiváhu (rostoucí náklady), jinak rozbijí ekonomiku (viz [13](13-balancing-and-formulas.md)).

### 2.3 Konverze přebytku (overflow synergie)
- „Přebytečné jídlo nad kapacitou → +happiness (hostiny)."
- „Přebytečné dřevo → research (experimenty)."
- „Přebytečný gold → koupí lidi/urychlí růst."
- Řeší plýtvání a odměňuje nadprodukci → hráč staví „engine", který nic neztrácí.

### 2.4 Cross-branch synergie
- **Doprava × Těžba**: vrtulníky nejen ruší vzdálenost, ale při plné dopravě dají +% yield (nic nečeká).
- **Věda × Vše**: „vědecká renesance" — po X technologiích globální ×.
- **Happiness × Produkce**: nad prahem happiness se odemkne „boom" (dočasný ×), pod prahem „krize".
- **Energie × Automatizace**: přebytek energie → přetaktování strojů (+% za cenu vyšší spotřeby).

### 2.5 Prestige/ascension synergie
- Legacy upgrady, které mění pravidla: „start s odemčenou érou 1", „×2 offline", „klik škáluje s produkcí/s". Viz [07](07-meta-progression.md).

## 3. Klik zůstává relevantní (aktivní hraní)

Aby klikání nezaniklo:
- **Crit klik**: šance × násobek (upgradovatelné) + vizuální pop.
- **Klik škáluje s produkcí**: upgrade „klik dá X % tvé produkce/s" → i pozdě má klik smysl.
- **Combo/streak**: rychlé klikání buduje combo multiplikátor, který decayuje → aktivní burst.
- **Golden citizen / golden node** (viz eventy) — odměna za pozornost.

## 4. Náhodné eventy a „golden" momenty

Kořeněná mechanika pro aktivní hráče (inspirace „golden cookie"):

- **Golden Citizen**: občas se objeví zvláštní postavička/uzel; klik → dočasný buff (frenzy ×7 na 30 s), nebo balík surovin, nebo „click frenzy". Vizuálně/zvukově výrazné.
- **Festival / svátek**: periodický event → dočasně +happiness a +produkce; město se vizuálně vyzdobí.
- **Objev (prospecting)**: náhodně se odhalí bohaté ložisko na frontieru.
- **Krize** (mírná, volitelná): dočasný pokles (sucho → méně jídla), řešitelný → drží pozornost. Default jemné, aby nebylo frustrující.
- Eventy jsou **data-driven** (tabulka eventů: podmínka, četnost, efekt, vizuál/zvuk) a laditelné/vypínatelné v nastavení.

## 5. Milníkové „wow" momenty (design juice)

Body, kde má hra vizuálně/zvukově „explodovat", aby si hráč užil pokrok:
- **Nová éra** — fanfára, přebarvení/upgrade vizuálu města, konfety.
- **První laser / vrtulník** — dramatická animace, nový vzhled dělníků, paprsky a rotory.
- **Velká čísla** — juicy number pop, screen shake (jemný, vypínatelný), particly úměrné velikosti zisku.
- **Ascension** — „civilizace vstupuje do dějin": cinematická sekvence resetu, pak restart se zjevně silnějším startem.
- Detaily efektů: [09 §Juice a particly](09-art-direction.md).

## 6. Pravidla tvorby upgradů/synergií (aby to nerozbilo hru)

1. **Multiplikátory se násobí, ne sčítají** — drží se přehledná exponenciální progrese; vzorec produkce má jasné pořadí faktorů ([03 §7](03-people-and-work.md)).
2. **Superlineární efekty vždy s protiváhou** (rostoucí cena / cap / spotřeba). Testuj, ať běh po ~10 min nevystřelí do nekonečna omylem.
3. **Každý upgrade má být čitelný** — hráč musí z tooltipu chápat „co mi to dá" (ukázat před/po hodnotu).
4. **Synergie odměňuje rozhodnutí**, ne náhodu — adjacency/alokace, které hráč ovlivní.
5. **Nové vrstvy, ne jen větší čísla** — nejlepší upgrady **mění chování** (auto-alokace, overflow konverze, klik=produkce), ne jen ×2.
6. **Data-driven a testovatelné** — každý upgrade je záznam s efektem, který jde vyhodnotit čistě; snadné psát testy na ekonomiku.

## 7. Zásobník konkrétních upgradů (seed pro [15](15-content-catalog.md))

Náměty k rozpracování do katalogu (název — efekt):
- *Ostré nástroje I–V* — ×1.5 yield dané těžby (řetězec).
- *Dělba práce* — +% produkce za každý druh aktivní práce (odměna za diverzitu).
- *Urbanistika* — +kapacita bydlení a rychlejší organický růst.
- *Logistická síť* — haul penalizace −50 %, +% když je doprava „naplněná".
- *Vědecká metoda* — každý tech +0.5 % research.
- *Hostiny* — přebytek jídla → happiness.
- *Přetaktování* — přebytek energie → +% strojní produkce za vyšší spotřebu.
- *Zlatá horečka* — Golden Citizen 2× častěji, buff +50 %.
- *Silné paže I–V* — ×click.
- *Kinetický klik* — klik dá X % produkce/s (endgame relevance klikání).
- *Předák / Guvernér* — QoL auto-alokace a auto-nákup levných upgradů.
- *Ascendantní paměť* — část progrese přežije ascension.
