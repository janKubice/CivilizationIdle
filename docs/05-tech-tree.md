# 05 — Tech tree

Tech tree je páteř progrese. Odemyká budovy, suroviny, upgrady a **nové mechaniky**. Je **data-driven** (uzly jako data — [16](16-data-schemas.md)), takže rozšiřování = přidání dat.

---

## 1. Struktura

- **Éry (tiers):** 0 Doba kamenná → 1 Bronzová → 2 Železná/Antika → 3 Středověk → 4 Průmysl → 5 Moderní → 6 Budoucnost. Éra se „otevře", až hráč splní její vstupní podmínky (klíčové techy předchozí éry).
- **Větve (branches):** paralelní směry, mezi kterými hráč volí pořadí:
  - **Gathering** (těžba/sběr): efektivita a nové suroviny.
  - **Crafting/Industry** (výroba): řetězce, stroje, automatizace.
  - **Logistics/Transport** (doprava): vozíky → silnice → vlaky → vrtulníky/drony.
  - **City/Society** (město): bydlení, potřeby, happiness, populace strop.
  - **Science** (věda): rychlost research, odemčení pokročilých větví.
  - **Power** (energie, od éry 4): uhlí → pára → elektřina → fúze.
- **Uzel (tech):** má `cost` (research +/− suroviny), `prereqs` (předchozí uzly), `era`, `branch`, `effects` (co odemkne / jaký multiplikátor dá).

## 2. Zdroj a útrata research

- Research generují **science budovy** (ohniště příběhů → knihovna → univerzita → výzkumné centrum) + přiřazení **učenci** (scholar jobKind).
- Rychlost research škáluje s techy Science větve a upgrady.
- Utrácí se v tech tree; některé uzly navíc vyžadují **materiálový vklad** (např. „postav monument z X kamene") jako gate.

## 3. Mapa stromu (přehled uzlů po érách)

Níže reprezentativní (ne vyčerpávající) uzly. Kompletní balancované hodnoty: [15](15-content-catalog.md). Formát: **Název** — co dělá.

### Éra 0 — Doba kamenná
- **Opracovaný kámen** — odemyká kamenné nástroje → +yield těžby dřeva a kamene.
- **Sběr a lov** — odemyká lovce/keře → víc jídla.
- **První ohniště (Society)** — odemyká research generaci (vstup do stromu).
- **Chatrč / bydlení** — +kapacita populace, spouští organický růst.
- **Košíkářství (Logistics)** — základní haul, mírně ruší penalizaci vzdálenosti.

### Éra 1 — Bronzová
- **Tavení mědi** — huť: ruda → měděný ingot; odemyká měď jako surovinu.
- **Bronzové nástroje** — silnější nástroje → větší těžební multiplikátor.
- **Zemědělství (pole)** — farmy: stabilní jídlo místo sběru; spouští farmářskou čtvrť.
- **Studna (City)** — plní potřebu vody, +happiness.
- **Tržiště** — gold z přebytků, +happiness; odemyká upgrady za gold.
- **Kolo / vozík (Logistics)** — výrazně zlepší haul na střední vzdálenost.

### Éra 2 — Železná / Antika
- **Tavba železa** — železné ingoty; silnější nástroje, stavební materiál.
- **Ocelové (železné) nástroje** — další skok yieldu.
- **Zděné stavby (cihly)** — cihelna; odolnější/kapacitnější budovy, nové vizuály.
- **Akvadukt** — voda na dálku, větší města.
- **Písmo / knihovna (Science)** — rychlejší research, odemyká éru 3.
- **Silnice (Logistics)** — cesty výrazně zvyšují haul; podporuje organický růst podél cest.
- **Chrám / kultura (Society)** — nová potřeba/bonus happiness, vyšší populační strop.

### Éra 3 — Středověk
- **Cechy / dílny** — vícestupňový crafting, nástroje a zboží.
- **Vodní/větrný mlýn** — první „stroj": automatizace mletí/pily bez lidí navíc → efektivita.
- **Univerzita** — velký boost research; odemyká pokročilé větve.
- **Opevnění/monumenty** — velké stavby jako milníky (a gate pro ascension progress).
- **Karavany / přístav** — obchod, směna surovin za gold i mezi sebou.

### Éra 4 — Průmysl
- **Uhlí a pára (Power)** — parní stroj: zavádí **energii** jako vrstvu; pohání továrny.
- **Ocelárna** — uhlí+železo → ocel (klíčový materiál moderní éry).
- **Továrny / automatizace** — stroje nahrazují část ruční práce; obří produkční skok.
- **Železnice (Logistics)** — vlaky: skoro ruší penalizaci vzdálenosti, propojí outposty.
- **Veřejné služby (City)** — kanalizace, zdraví; další zvýšení populačního stropu.
- **Elektřina** — přechod z páry na elektrickou síť; předpoklad hi-tech.

### Éra 5 — Moderní
- **Elektronika** — nová surovina/řetězec; předpoklad laserů a dronů.
- **Těžké stroje / rypadla** — masivní těžba.
- **Nákladní auta / dálnice (Logistics)** — rychlá doprava zboží.
- **Výzkumná centra** — research na maximum, odemyká budoucnost.
- **Ropa a paliva (Power)** — palivo pro dopravu a stroje.

### Éra 6 — Budoucnost
- **Laserové těžební pušky (Gathering)** — lidé těží lasery: enormní yield, vizuálně „wow" (paprsky, částice); mění vzhled horníků.
- **Vrtulníky & dopravní drony (Logistics)** — okamžitá přeprava napříč mapou: **plně ruší** penalizaci vzdálenosti, umožní vzdálené outposty bez cest.
- **Robotičtí dělníci / automatizace** — sloty obsazované roboty (nezávisle na populaci) — nová vrstva „lidé vs. stroje".
- **Fúzní energie (Power)** — prakticky neomezená energie → odemyká nejsilnější stroje.
- **Kompozity a nanomateriály** — vrcholové suroviny pro endgame synergie.
- **Ascension research** — odemyká/vylepšuje samotný ascension systém (viz [07](07-meta-progression.md)).

## 4. Vizualizace tech tree v UI

- Graf uzlů s **liniemi prerekvizit**, seskupený po **érách (sloupce/pásma)** a **větvích (řádky/barvy)**.
- Stavy uzlu: `locked` (šedý, chybí prereq), `available` (zvýrazněný, lze koupit), `owned` (barevný).
- Hover → tooltip s efekty a cenou; klik → koupě (s potvrzením u drahých).
- Pan/zoom (strom je velký); vyhledávání / filtr dle větve.
- Detail: [08 §Tech tree panel](08-ui-ux.md).

## 5. Designová pravidla stromu

- **Vždy je co dělat další:** v každé fázi má hráč 2–4 dosažitelné uzly → volba, ne lineární tunel.
- **Křižovatky:** občas exkluzivní volby (A **nebo** B v daném běhu) → znovuhratelnost přes ascension.
- **Milníkové uzly** otevírají éru a dávají výrazný „level up" pocit (vizuální/zvukový důraz).
- **Gate přes materiál** u klíčových uzlů propojuje research s ekonomikou (nejen „naklikat vědu").
- **Škálování ceny:** research cost roste napříč érami exponenciálně; kompenzováno rostoucí produkcí research (viz [13](13-balancing-and-formulas.md)).
