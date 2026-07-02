# 17 — Glosář

Definice pojmů používaných napříč dokumentací.

| Pojem | Význam |
|-------|--------|
| **Idle / incremental hra** | Žánr, kde produkce běží i bez aktivního zásahu; těžiště je v rostoucích číslech, upgradech a automatizaci. |
| **Core loop** | Základní opakovaná smyčka hráčových akcí (klik → gather → build → grow). Viz [01](01-game-design-document.md). |
| **Tile (dlaždice)** | Základní jednotka mřížky světa; celočíselné souřadnice `(tx,ty)`. |
| **Chunk** | Blok `CHUNK_SIZE²` dlaždic; jednotka načítání/generování světa. Viz [02](02-world-and-map.md). |
| **Worldgen** | Procedurální generování světa z `seed` (deterministické). |
| **Seed** | Číslo určující generování světa/RNG; uloženo v save → reprodukovatelnost. |
| **Delta (chunk delta)** | Uložené změny chunku oproti generátoru (jen ony se ukládají). Viz [12](12-save-system.md). |
| **Frontier** | Okraj zástavby, kam roste město / kde se objevují nové zdroje. Viz [02 §4](02-world-and-map.md). |
| **Outpost** | Vzdálená těžební základna napojená dopravou na město. |
| **Citizen (obyvatel)** | Jednotlivý „člověk-zdroj"; entita, která pracuje/chodí/těží. Viz [03](03-people-and-work.md). |
| **JobKind** | Kategorie práce (dřevorubec, horník, farmář, učenec…); jednotka alokace/sliderů. |
| **Job slot** | Statické pracovní místo u budovy/uzlu; přiřazení člověka = O(1) vazba. Viz [03 §3](03-people-and-work.md). |
| **SoA (Structure-of-Arrays)** | Data-oriented uložení entit v typed arrays (cache-friendly, škáluje). Viz [03 §5](03-people-and-work.md). |
| **LOD (Level of Detail)** | Různá úroveň simulace/detailu dle vzdálenosti od kamery; mimo obraz = statistika. Viz [03 §4](03-people-and-work.md). |
| **Ekonomická simulace** | „Pravda" o hře — agregovaný, deterministický výpočet produkce per tick. Oddělená od prezentace. |
| **Prezentace** | Render + UI + audio; čte stav simulace, nemutuje ho přímo. Viz [11 §2](11-technical-architecture.md). |
| **Fixed-timestep** | Simulace s pevným krokem `SIM_DT` (nezávislá na FPS) → determinismus a offline výpočet. |
| **Tick** | Jeden krok simulace (`SIM_DT`, default 100 ms). |
| **Haul / haul efektivita** | Doprava surovin; efektivita klesá se vzdáleností, roste s dopravními techy. Viz [03 §8](03-people-and-work.md). |
| **Adjacency** | Synergie za sousedství budov/zdrojů (pila u lesa apod.). Viz [06 §2.1](06-upgrades-and-synergies.md). |
| **Synergie** | Pravidlo, kde jeden systém zesiluje jiný (zdroj „wow efektů"). Viz [06](06-upgrades-and-synergies.md). |
| **Bottleneck** | Úzké hrdlo ekonomiky (málo skladu/vstupu/energie) — záměrný, řešitelný puzzle. Viz [04 §8](04-economy-and-resources.md). |
| **Happiness** | Index 0..1 z plnění potřeb; ovlivňuje růst populace a produkci. Viz [13 §5](13-balancing-and-formulas.md). |
| **Research (věda)** | Abstraktní surovina utrácená v tech tree. |
| **Tech tree** | Strom vynálezů (éry × větve) odemykající obsah a mechaniky. Viz [05](05-tech-tree.md). |
| **Éra (tier)** | Fáze technologického vývoje (0 kámen → 6 budoucnost). |
| **Upgrade** | Koupě dávající multiplikátor/efekt. Viz [06](06-upgrades-and-synergies.md). |
| **Golden Citizen** | Náhodný „golden" event odměňující aktivní hráče. Viz [06 §4](06-upgrades-and-synergies.md). |
| **Achievement** | Milník; mnohé dávají trvalý bonus. Viz [07 §1](07-meta-progression.md). |
| **Ascension / prestige** | Reset běhu za trvalou **Legacy** měnu a boosty. Viz [07 §2](07-meta-progression.md). |
| **Legacy (Odkaz)** | Meta měna z ascensionu; kupuje trvalá vylepšení. |
| **Offline progres** | Dopočítaná produkce za dobu nehraní (s capem/efektivitou). Viz [12 §6](12-save-system.md). |
| **Data-driven** | Obsah (suroviny, budovy, techy…) je data, ne kód; logika je interpretuje. Viz [16](16-data-schemas.md). |
| **Effect / Condition** | Deklarativní datové popisy „co to dělá" / „kdy to platí". Viz [16 §2–3](16-data-schemas.md). |
| **Instanced rendering** | Kreslení mnoha spritů málo draw cally (batch). Viz [09 §5](09-art-direction.md). |
| **Object pooling** | Recyklace objektů/spritů místo alokace v hot loopu (výkon). |
| **Juice** | Vizuální/zvukový feedback dodávající „šťávu" (particly, tweeny, stingery). Viz [09 §8](09-art-direction.md). |
| **DoD (Definition of Done)** | Kritéria dokončení fáze. Viz [14](14-roadmap.md). |
