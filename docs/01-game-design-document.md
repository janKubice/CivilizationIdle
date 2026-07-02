# 01 — Game Design Document (GDD)

Tento dokument popisuje **co hráč dělá a proč to funguje**. Technické „jak" je v [dokumentu 11](11-technical-architecture.md), konkrétní čísla v [dokumentu 13](13-balancing-and-formulas.md) a [15](15-content-catalog.md).

---

## 1. Herní smyčka (core loop)

Na nejvyšší úrovni je smyčka:

```
KLIK / GATHER  →  SUROVINY  →  STAVBA & LIDÉ  →  PLNĚNÍ POTŘEB  →  RŮST MĚSTA
      ▲                                                                  │
      └──────────────  odemyká techy, upgrady, více lidí  ◄──────────────┘
```

Rozepsáno do jednotlivých akcí, které hráč reálně provádí:

1. **Klikni na surovinový uzel** na mapě (strom, balvan, keř, ložisko rudy) → přidá surovinu do skladu. Manuální gather.
2. **Postav budovu** za suroviny (nebo ji nechej organicky vyrůst, když je splněná podmínka) → budova vytvoří **pracovní místa (job slots)**.
3. **Přiřaď lidi k práci** — buď přímo, nebo přes **slidery alokace** (kolik % lidí dělá dřevorubce vs. horníky vs. farmáře). Přiřazený člověk automaticky produkuje surovinu.
4. **Plň potřeby** rostoucí populace: jídlo, bydlení, voda, spokojenost, později luxus. Splněné potřeby → přicházejí **noví obyvatelé** a odemyká se **růst města**.
5. **Utrácej za progresi**: research (tech tree), upgrady, ascension. To zpětně zrychluje kroky 1–4.

Smyčka se opakuje na rostoucích řádech: první strom → první vesnice → město → metropole → hi-tech civilizace → ascension → znovu, ale rychleji a dál.

## 2. Zdroje hodnoty (proč hráč pokračuje)

- **Rostoucí čísla** (produkce/s, populace, skóre) s viditelnou akcelerací.
- **Odemykání** (nová budova, surovina, tech, mechanika) v rytmu ~5–15 min.
- **Optimalizace** (vyladit slidery a build tak, aby úzké hrdlo zmizelo).
- **Vizuální odměna** (město roste, particly, „wow" momenty).
- **Meta cíle** (achievementy, ascension milníky).

## 3. Fáze hry (macro progression)

Hra je rozdělená do fází, které zhruba (ne striktně) odpovídají érám tech tree. Každá fáze zavádí novou mechaniku, aby se hra „nevyčerpala".

### Fáze 0 — První kliknutí (0–2 min)
- Start: 3 lidé, prázdná krajina, pár surovinových uzlů poblíž.
- Hráč klikáním sbírá **dřevo** a **jídlo (bobule)**.
- Cíl: postavit první **Skladiště** a první **Chatrč** (bydlení).
- Odemkne: možnost přiřadit prvního člověka k automatické práci.

### Fáze 1 — První vesnice (2–15 min)
- Zavádí **automatickou produkci** (přiřazení lidí k uzlům/budovám) a **slidery alokace**.
- Suroviny: dřevo, kámen, jídlo, voda.
- Potřeby: jídlo + bydlení → populace roste.
- Odemkne: **research** (první bod výzkumu) → vstup do tech tree.
- Zavádí **organický růst**: když je splněná podmínka, město začne samo přistavovat domy na frontieru.

### Fáze 2 — Řemesla a řetězce (15 min–2 h)
- Zavádí **výrobní řetězce**: dřevo → prkna, kámen → cihly, ruda → ingoty, ingoty → nástroje.
- **Nástroje** zvyšují efektivitu těžby → první velký multiplikátor.
- Potřeby se rozšiřují o **spokojenost** (studna, tržiště, později kultura).
- Zavádí **upgrady** (viz [06](06-upgrades-and-synergies.md)) a první **synergie** (adjacency bonusy budov).

### Fáze 3 — Průmysl (2–10 h)
- Zavádí **energii/power** jako novou vrstvu (uhlí → pára → elektřina).
- Stroje automatizují řetězce, produkce roste o řády.
- **Logistika** začíná hrát roli: vzdálenost = čas dopravy → odemykají se dopravní techy (vozíky, silnice, vlaky).
- Zavádí **náhodné eventy** a „golden citizen" pro aktivní hráče.

### Fáze 4 — Moderní & budoucnost (10 h+)
- **Laserové těžební pušky**, **vrtulníky/drony** pro dopravu, **fúzní energie**, elektronika, automatizace (roboti dělníci?).
- Synergie se skládají do „engine buildů", produkce exploduje.
- Odemyká se **Ascension** — možnost resetovat civilizaci za trvalou měnu.

### Fáze 5 — Ascension smyčka (endgame, ∞)
- Reset města → získáš **Legacy měnu** (např. „Odkaz"/Relikvie).
- Utratíš za trvalé multiplikátory a odemčení, které zrychlí/prohloubí další průchod.
- Každý průchod je rychlejší a dosáhne dál; odemykají se **nové mechaniky exkluzivní pro ascension** (viz [07](07-meta-progression.md)).

## 4. Jádrové mechaniky (detailně)

### 4.1 Gathering (klikání)
- Surovinové uzly na mapě mají typ, zásobu (deposit) a yield na klik.
- Klik = přidá `yieldPerClick × clickMultiplier` dané suroviny.
- Deposit se vyčerpává (u rud) nebo je **obnovitelný** (les/bobule regenerují). Vyčerpané ložisko zmizí a nové se generuje jinde na frontieru.
- **Crit klik**: šance (upgradovatelná) na násobený yield s vizuálním pop efektem.
- Klikání zůstává relevantní i pozdě díky upgradům „klik škáluje s produkcí/s" (viz synergie).
- Detaily surovin a uzlů: [04](04-economy-and-resources.md).

### 4.2 Lidé jako zdroje (workers)
- Každý obyvatel je entita se stavem (idle/walking/working/hauling/resting), přiřazením k **job slotu**, domovem a rychlostí.
- Přiřazený k práci → produkuje surovinu podle vzorce (viz níže). Nepřiřazený → idle (chodí po městě, „žije").
- **Optimalizace je zásadní** — plný design v [dokumentu 03](03-people-and-work.md). Stručně: ekonomika se počítá **agregovaně a deterministicky** per tick; jednotliví agenti jsou vizuální vrstva se **LOD** (jen viditelní se plně animují a pathfindují).

### 4.3 Alokace práce (slidery)
- Hráč nastavuje **poměry** mezi kategoriemi práce (gathering: dřevo/kámen/jídlo/ruda…; crafting; stavba; research).
- Dva režimy (hráč volí, default = per-kategorie slidery):
  - **Slider režim**: procenta volných lidí do každé kategorie; systém sám plní job sloty v dané kategorii.
  - **Priorita režim** (pokročilý): seznam priorit, sloty se plní shora dolů.
- Změna slideru okamžitě přealokuje lidi (s krátkou vizuální animací přesunu).
- Detail: [04 §Alokace](04-economy-and-resources.md#alokace-prace).

### 4.4 Budovy
- Budovy: **produkční** (job sloty), **skladovací** (kapacita surovin), **obytné** (kapacita populace), **potřebové/servisní** (plní potřeby: studna, tržiště, chrám), **speciální** (research lab, monument, ascension).
- Stavba stojí suroviny; cena roste s počtem už postavených (viz cost curve, [13](13-balancing-and-formulas.md)).
- Budovy mají **levely/upgrady** (zvýší kapacitu/rychlost).
- **Organický růst**: část budov (hlavně obytné a dekorace) město staví samo, když jsou splněné podmínky — hráč to může ovlivnit „zónováním"/slidery, ale nemusí ručně klikat každý domek. Detail v [02](02-world-and-map.md).

### 4.5 Potřeby a růst populace
- Populace má **potřeby** škálující s počtem lidí: jídlo (spotřeba/s), bydlení (kapacita), voda, spokojenost (happiness), později zdraví, kultura, luxus.
- **Happiness** je souhrnný index z plnění potřeb; ovlivňuje **rychlost přílivu nových obyvatel** a produkční multiplikátor.
- Když happiness > práh a je volná kapacita bydlení + přebytek jídla → přicházejí noví lidé (growth rate). Když potřeby dlouhodobě neplněné → lidé odcházejí (soft fail, ne smrt) a produkce klesá.
- Vzorce: [13](13-balancing-and-formulas.md).

### 4.6 Research a tech tree
- **Research body** generují research budovy (knihovna, lab) + přiřazení „učenci".
- Body se utrácejí v **tech tree** (éry × větve) za odemčení budov, surovin, upgradů a mechanik.
- Kompletní strom: [05](05-tech-tree.md).

### 4.7 Upgrady a synergie
- **Upgrady**: jednorázové koupě za suroviny/research, dávají multiplikátory (globální, per-surovina, per-budova, per-klik).
- **Synergie**: pravidla, kde jeden systém zesiluje jiný (adjacency, „každá X zvyšuje Y", převod přebytku, combo eventy). Sem patří „wow efekty".
- Detail a konkrétní příklady: [06](06-upgrades-and-synergies.md).

### 4.8 Meta progrese
- **Achievementy**: za milníky; mnohé dávají **trvalý bonus** (malý multiplikátor), takže nejsou jen kosmetika.
- **Ascension/prestige**: reset za Legacy měnu → strom trvalých vylepšení.
- **Offline progres**: hra dopočítá produkci za dobu, kdy hráč nehrál (s cap/efektivitou).
- Detail: [07](07-meta-progression.md).

## 5. Ovládání (high level)

- **Levý klik** na uzel: gather. Na budovu: otevře detail. Na prázdno v build módu: postavit.
- **Drag / šipky / WASD**: pan kamery. **Kolečko / pinch**: zoom.
- **Boční panely**: budovy, tech tree, upgrady, workforce (slidery), achievementy, ascension, nastavení.
- Plný UX a wireframy: [08](08-ui-ux.md).

## 6. Onboarding

- Jemný, kontextový tutoriál: první klik zvýrazněný, první budova navedená, každá nově odemčená mechanika má krátký tooltip/tip.
- Žádná zeď textu na začátku — hráč se učí děláním. Tutoriál je **skippable** a **data-driven** (kroky jako data, ne hardcode).

## 7. Fail states / tlak (failure & friction)

- Hra je **odpouštějící** (idle žánr). Není „game over".
- Přirozená úzká hrdla (nedostatek jídla → růst se zastaví; málo skladu → produkce přeteče a plýtvá) fungují jako **puzzle k vyřešení**, ne trest.
- Přebytek surovin nad kapacitou skladu se **plýtvá** (nebo konvertuje přes upgrade) — motivace stavět sklady a řešit bottlenecky.

## 8. Přehled obrazovek (screen flow)

```
[ Hlavní menu ] ──► [ Hra (svět + HUD + panely) ] ──► [ Pauza / Nastavení ]
       │                        │
       │                        ├──► [ Tech tree ]
       ▼                        ├──► [ Upgrady ]
[ Nový / Načíst / Nastavení ]   ├──► [ Workforce / slidery ]
                                ├──► [ Achievementy ]
                                └──► [ Ascension ] (odemčeno později)
```

Detail každé obrazovky v [08](08-ui-ux.md).
