# 18 — Design expanze v0.2+ (reakce na playtest feedback)

Zdroj: playtest majitele projektu (07/2026), 25 bodů zpětné vazby. Tento dokument každý bod rozebírá, navrhuje řešení a přidává další obsah ve stejném duchu. **Zatím jen design — implementace proběhne po schválení, po fázích (viz §Z: Prioritizace).**

Značení: 🐛 = oprava chyby, 🎨 = UX/vizuál, ⚙️ = nový systém, 💥 = velký obsah.

---

## A. Opravy a čitelnost (body 2, 3, 4, 8)

### A1. 🐛 Teleportující se lidičky (bod 2)
**Diagnóza:** `syncAgents()` každé ~4 s kompletně zahodí a znovu vytvoří seznam vizuálních agentů (`this.agents = want`). Noví agenti dostanou startovní pozice → viditelný „teleport" všech postaviček naráz.

**Řešení — perzistentní agenti s identitou:**
- Agent dostane stabilní klíč `"{buildingIdx}:{slot}"`; sync dělá **diff**: existující agenti pokračují v cestě beze změny, přidají se jen chybějící, odeberou přebyteční.
- Agent opouštějící viewport se nemaže hned — jen se přestane kreslit (L1) a maže se až po ~20 s mimo záběr.
- Při změně přiřazení (slidery) agenti viditelně **dojdou** na nové pracoviště (přechodový stav `commute`), místo výměny skokem.
- Idle chodci: nový cíl si vybírají jen na konci trasy, nikdy uprostřed.

### A2. 🎨 Kapacita skladů není vidět (bod 3)
- Chip suroviny zobrazí **mini progress-bar** (2 px linka pod textem) zbarvený podle zaplnění: modrá < 70 %, žlutá < 95 %, červená ≥ 95 %.
- Klik na chip surovin otevře nový **panel Sklad**: tabulka všech surovin — množství / kapacita / produkce / spotřeba / „za jak dlouho plno·prázdno". Pro optimalizátory klíčová obrazovka.
- Tooltip zůstává (přesná čísla).

### A3. 🎨 Stav vody není vidět (bod 4)
- Nový chip **💧 `pokrytí/populace`** vedle bydlení (skryje se, když je pokrytí ≥ 120 % — nespamovat).
- Obecnější řešení: **rozpad spokojenosti** — klik na 😊 chip otevře breakdown: `jídlo ✓ +12 % · voda 80 % +10/13 % · bydlení ✓ · služby +8 % · festival +20 %…`. Hráč konečně vidí, *proč* má 65 %, a co s tím. (Data už existují — `computeHappiness` je jen sečte, nově vrátí i složky.)

### A4. 🐛🎨 Cesty tvoří slité pruhy (bod 8)
**Diagnóza:** `extendRoad` a L-napojování dovolí položit cestu přímo podél existující → dvou- až třířadé „asfaltové plochy".

**Řešení (logika + vizuál):**
- **Pravidlo pokládky:** nová dlaždice cesty smí mít max. 1 cestu v kolmém směru na směr pokládky (zákaz paralelek na dotyk); L-napojení preferuje trasu podél existujících cest s odstupem ≥ 2.
- **Autotiling:** cesta se kreslí užší (~65 % dlaždice) s tmavším okrajem a spojuje se jen do skutečných sousedů; křižovatky a zatáčky dostanou tvar. Z pruhů se stanou uličky.
- Éra mění vzhled: prašná stezka → dlážděná → asfalt (éra 4+) → svítící magistrála (éra 6).

---

## B. Budovy: velikost, levely, slučování (body 5, 6, 7, 16, 24)

### B1. ⚙️ Větší půdorysy (bod 5)
Nové rozměry: chrám 2×2, univerzita 2×2 (nová budova, viz B5), ocelárna 2×2, elektrárna 2×2, přístav 2×3 (viz D1), divy světa 3×3 až 4×4 (viz E1), kosmodrom 4×4 (viz F1). Velikost = vizuální hierarchie důležitosti.

### B2. ⚙️ Úrovně budov s jinými modely (bod 6)
- Každá produkční/obytná budova má **úroveň I → II → III**. Upgrade z detailu budovy (klik) za suroviny (~2,5× cena, éra-gate: II od éry +1, III od éry +3).
- Efekt: II = +100 % slotů a produkce, III = +300 %. Vizuál se **promění**: chatrč → roubenka → měšťanský dům; pila → parní pila (komín, kouř) → automatická linka (světla, jiskry). Procedurální sprity: přidaná patra, komíny, materiály dle úrovně.
- „Vylepšit vše" tlačítko per typ (QoL, odemyká Guvernér — viz D4).

### B3. ⚙️💥 Slučování budov — „super budovy" (body 7 + 24)
Mechanika à la merge-games, řeší i „hromada políček vedle sebe je divná":

- **4 stejné budovy ve čtverci 2×2** → nad clusterem se objeví tlačítko **„Sloučit"** → vznikne **Velká budova 2×2**: sloty 4 budov **+50 % bonus produkce** a −50 % spotřeba místa. Jiný, výrazně větší model.
- **4 Velké ve čtverci 4×4** (nebo Velká lvl III + tech) → **Kolos 4×4** — landmark s aurou (+15 % okolním budovám stejné kategorie).
- Konkrétně zemědělství (bod 24): 4 pole → **Velkostatek** (stodola, oplocené lány, **kůň s pluhem jezdí po polích**); éra 4+: velkostatek s techem Mechanizace → **Kombajnová farma** (jezdící **traktor/kombajn** jako vizuální agent, prachová stopa). 4 velkostatky → **Agrokombinát** (silo, hangár).
- Merge je vždy **vratný** (rozdělit zpět bez ztráty) — žádný trest za experimentování.

### B4. 🎨 Kategorie ve stavěcím menu (bod 16)
Taby: **🏠 Bydlení · 🌾 Jídlo · ⛏️ Těžba · 🏭 Výroba · 🎓 Věda a kultura · 🚚 Doprava · 🏛️ Divy**. Badge „NOVÉ" u čerstvě odemčených, fulltext hledání, řazení dle éry. Poslední použitá záložka se pamatuje.

### B5. ⚙️ Nové budovy do mezer
- **Univerzita** 2×2 (éra 3): velká věda, aura na knihovny — chyběl viditelný vědecký landmark.
- **Studna → Akvadukt → Vodárna → Rozvod vody**: voda škáluje s érami (souvisí s A3).
- **Sýpka** (jídlo-specifický sklad, éra 1), **Hasičská stanice** (éra 2, viz D3 požáry), **Kasárna/Strážnice** (viz E2), **Činžák/Panelák/Arkologie** (viz E3).

---

## C. Živý svět (body 11, 12, 13, 17 + nové)

### C1. ⚙️💥 Rybaření (bod 11)
Voda konečně k něčemu:
- **Hejna ryb** — nový klikatelný uzel na vodě (třpytící se kruhy), obnovitelný.
- **Rybářská chata** (éra 0–1, musí sousedit s vodou): rybáři chodí s prutem na břeh; produkují **rybu** — nová surovina kategorie jídlo.
- **Pestrá strava**: jídlo ze ≥ 2 zdrojů (bobule/farma + ryby) = +5 % happiness a +10 % growth. Ryby nejsou „další jídlo", ale synergie.
- **Přístav** 2×3 (éra 2–3, pobřeží): rybářské **loďky viditelně vyplouvají** na vodu (vizuální agenti na vodě!), velký výnos; později obchodní lodě (viz C6).

### C2. ⚙️ Čtvrtě — automatické zónové bonusy (bod 12)
Bez ručního zónování; **emergentní clustering**:
- Detekce: ≥ 3 budovy stejné kategorie (výroba / zemědělství / bydlení / věda / kultura) v okruhu 4 → vznikne **čtvrť**: jemné barevné podbarvení oblasti + generovaný název („Kovářská čtvrť", „Zelené předměstí") + **+15 % bonus** členům.
- Vyšší stupeň: ≥ 8 budov = **okrsek** (+25 % a vizuální prvek — tovární brána, tržní náměstí…).
- Skládá se s merge (B3): Kolos v okrsku = build strategie. Auto-growth (D4) preferuje stavět do odpovídajících čtvrtí → město se **samo přirozeně zónuje**.

### C3. ⚙️ Parky a okrašlování (bod 13)
- **Park, fontána, socha, alej, zahrada** (levné, éra 1+): happiness + adjacency bonus obytným budovám v okolí 3 (+X % growth).
- **Zelená čtvrť**: ≥ 3 parky u sebe = „Městské sady" (aura happiness).
- Organický růst občas sám vysadí strom/park (město se okrašluje samo); Guvernér (D4) to umí systematicky.

### C4. ⚙️💥 Roční období (bod 17a)
Cyklus **jaro → léto → podzim → zima**, ~6 min/období, viditelný v top baru (🌸☀️🍂❄️):
- **Vizuál:** barva trávy a stromů se plynule mění; na podzim padá listí, v zimě sníh na střechách a terénu, zamrzlé okraje jezer (bruslící lidičky!).
- **Gameplay (mírné, čitelné):** léto +20 % farmy; podzim +20 % sběr/lov; zima **−40 % farmy** a **spotřeba dřeva na topení** (dřevo zůstává relevantní navždy!) +10 % happiness při dostatku („útulno"); jaro +30 % růst populace.
- Zima je „puzzle roku": zásoby na zimu = klasický civilizační rytmus. Skleníky (éra 4) a klimatizované farmy (éra 6) sezónnost ruší — progrese vítězí nad přírodou.

### C5. ⚙️ Katastrofy a eventy (bod 17b)
**Mírné, řešitelné, nikdy neničí trvale** (pilíř odpouštivosti). Přepínač intenzity v nastavení (Klid / Normální / Drsné):
- **Požár** 🔥: náhodná budova vzplane → klikáním hasíš (mini-hra), nebo hasičská stanice v dosahu uhasí sama; neuhašená budova je „vyhořelá" (neprodukuje, oprava za 30 % ceny).
- **Sucho** ☀️: léto bez deště −farmy; akvadukt/vodárna imunizuje.
- **Krysy ve skladu** 🐀: −10 % jídla; **kočky** (upgrade „Městský kocour" — kosmetika s funkcí!) trvale řeší.
- **Vichřice** 🌪️: rozbité cesty (rychlá oprava), poletující listí.
- **Pozitivní eventy**: potulný cirkus (+happiness), kupecká karavana (jednorázový výhodný obchod), imigrační vlna, bohaté žně, **pád meteoritu** → 30 s klikací horečka na vzácné kovy, po dešti duha (+krátký buff, vyšší šance zlatého občana).

### C6. ⚙️ Obchod a karavany (nový)
- **Obchodní stezka** (éra 2, tržiště + cesta k okraji mapy): pošli karavanu (vizuálně odjíždí!) s vybranou surovinou → za X min se vrátí se zlatem/směnou. Éra 3: lodě z přístavu; éra 4: obchodní vlaky; éra 6: nákladní drony.
- Jednoduchý **trh s cenami** (±30 % sinusoida + šum) → „prodávej draze" mini-optimalizace.

### C7. 🎨 Ambientní život (nový)
Jeleni v lese, ptáci (hejno přeletí), ovce na loukách, psi u domů, motýli v létě, kouř jen z obydlených domů, rybáři na břehu i mimo směnu. Levné particle/agenti, obrovský dojmový efekt.

---

## D. Infrastruktura a autonomie (body 14, 18)

### D1. ⚙️💥 Železnice, která je vidět (bod 14)
**Dnes:** nádraží jen globálně přidává dosah dopravy — neviditelné, nepochopitelné. **Redesign:**
- Postavíš **2+ nádraží** → mezi nejbližšími se automaticky položí **koleje** (A* po volných dlaždicích, přes cesty mostkem) a začne jezdit **vláček** (lokomotiva + 2 vagóny, kouř, houkání 🚂).
- Efekt: budovy v okruhu 8 od nádraží mají haul efektivitu **jako by stály u skladu** → vzdálené těžební **outposty** konečně dávají smysl: „vysaď nádraží u vzdálených žil".
- Stejný princip pak: **Heliport** (éra 6) — vrtulníky létají viditelně mezi heliporty; koleje nepotřebují.
- Juice: první příjezd vlaku = malá slavnost (fanfára, lidé mávají).

### D2. ⚙️ Doprava obecně čitelnější
Detail budovy ukáže **odkud bere dopravu** (nejbližší sklad/nádraží + čára při hoveru). Ikona 🐌 na budově s efektivitou < 50 % — okamžitá diagnostika.

### D3. ⚙️ Koně, povozy, traktory (bod 24 – doprava)
- Éra 1 **Stáje**: koňské povozy viditelně vozí náklad (rychlejší haul animace + reálný bonus).
- Éra 4: náklaďáky, éra 6: drony. Vizuální flotila roste s érou — dopravní techy jsou **vidět**.

### D4. ⚙️💥 Guvernér — autonomie stavění (bod 18)
Postupné předávání mikro-managementu (idle progrese z dělníka na vládce):
- **Radnice** (éra 2): auto-bydlení (už existuje) + toggle **auto-služby** (studny, parky dle potřeb).
- **Guvernér** (éra 3, upgrade): toggly per kategorie — „auto-stavět farmy / těžbu / sklady", s **rozpočtem** (max. 30 % zásob, ať hráči nevyluxuje sklad).
- **Plánovací úřad** (éra 4): staví podle **bottlenecků** („chybí prkna → přistav pilu u lesa"), respektuje čtvrtě (C2).
- **AI Starosta** (éra 6, vtipný): přebírá i upgrady budov a slidery; hráč jen strategicky zadává priority. Pojmenovaný, občas komentuje dění bublinou („Postavil jsem pilu. Zase." 🙃).

---

## E. Megalomanie a meta (body 15, 19, 20, 21)

### E1. ⚙️💥 Divy světa — velké projekty (bod 15)
Jeden div per éra, **vícefázová stavba** (3–5 fází, každá žere hromadu surovin a času; staveniště viditelně roste — lešení, jeřáby):
| Éra | Div | Efekt |
|---|---|---|
| 1 | **Pyramida** 3×3 | +50 % klik, trvalé +5 % happiness |
| 2 | **Koloseum** 3×3 | festivaly 2× častěji a silnější |
| 3 | **Katedrála** 3×3 | +happiness, poutníci = pasivní gold |
| 4 | **Ocelový kolos** (Eiffelovka) 3×3 | −20 % ceny staveb, aura na výrobu |
| 5 | **Přehrada** 4×2 (přes řeku/jezero) | obří čistá energie |
| 6 | **Vesmírný výtah** 3×3 | brána k éře 7 (F1), pasivní elektronika |

Stavba diva je **dlouhodobý cíl éry**; dokončení = celoobrazovková oslava + trvalý landmark + kapitola v Kronice (E5).

### E2. ⚙️ Nájezdy a obrana (bod 21) — volitelný modul
Drženo mírné (není to survival), **výchozí „Mírné", vypínatelné**:
- Na frontieru se objevují **tábory barbarů** (vizuální). Jednou za čas nájezd: ukradnou % surovin, poničí (dočasně) pár budov na okraji.
- Obrana: **Palisáda/hradby** (obvod města — vizuálně nádherné, město dostane tvar!), **Strážní věž** (aura), **Kasárna** (job: stráž — další slot-sink pro populaci). Dost obrany = nájezd odražen s animací.
- **Výprava na tábor**: pošli stráže tábor vyčistit → kořist + odemčené území + achievement. Éra 6: obranné lasery, štítová kupole (vizuální wow).
- Nikdy game-over; prohraný nájezd = ztráta části zásob, nic trvalého.

### E3. ⚙️💥 Rebalanc: skutečná megalomanie (bod 20)
Cíl: **z vesničky metropole v řádech tisíců až statisíců lidí**:
- Nové bydlení: Činžák (éra 4, +30), Věžák (éra 5, +100), **Arkologie** (éra 6, +1000). Growth rate roste s érou řádově (migrace, medicína).
- Cílová čísla: éra 2 ≈ 200, éra 4 ≈ 2 000, éra 5 ≈ 20 000, éra 6 ≈ 200 000+. Ekonomika je agregovaná — zvládne to; vizuálně LOD dav (odzoom = světla a hustota, ne jednotlivci).
- **Vizuální proměna centra**: auto-growth v pozdních érách zahušťuje centrum výškovými budovami (downtown!), předměstí zůstávají nízká → skyline, který roste. Odzoomované noční město éry 5+ se **rozsvítí** jako skutečná metropole.
- Produkční čísla a ceny se natáhnou (více řádů), aby exponenciála „jela" dál — kompletní rebalanc pass s botem.

### E4. ⚙️💥 Achievementy a Vzestup s nápadem (bod 19)
**Achievementy — 3 změny:**
1. **Tematické odměny** místo paušálních +2 %: „Dřevorubec" → +10 % dřevo; „Lovec štěstí" → zlatí občané +15 %; klikací achievementy → klik bonusy. Bonus dává smysl k činu.
2. **Tiery** (bronz/stříbro/zlato: 1k/100k/10M dřeva…) + skryté vtipné („Klikni 50× na ovci" → ovce tě má ráda: ovce tě následuje 🐑).
3. **Tituly města**: splněné sady achievementů odemykají tituly („Město vědy", „Kupecká velmoc", „Zelené město") — **aktivní smí být jeden** a dává výrazný směrový bonus = build rozhodnutí, ne pasivní sbírka.

**Vzestup — redesign na „Odkaz civilizací":**
1. **Archetyp civilizace** na start běhu (odemčeno 1. vzestupem): **Industriální** (výroba+, smog, těžba estetika) / **Vědecká** (věda+, čisté bílé město) / **Kupecká** (gold+, karavany od začátku) / **Přírodní** (farmy a happiness+, město v zeleni). Mění bonusy, **vizuální paletu města** a 1 unikátní budovu → každý běh vypadá a hraje se jinak.
2. **Relikvie**: každý vzestup dá 1 náhodnou **relikvii** do trvalé sbírky (à la artefakty): „Zlaté kladivo" (10 % šance stavby zdarma), „Věčné semínko" (farmy ignorují zimu), „Kronikářův brk" (+1 achievement slot titulu), „Metronom" (offline 100 %)… Sbírka relikvií = dlouhodobý sběratelský tah, duplikáty se mění na Odkaz.
3. **Ceremonie vzestupu**: místo tlačítka **animace startu Archy** — obří raketa/loď se staví na kosmodromu, město se rozsvítí, odpočet, start, ohlédnutí za městem z výšky → nový běh. Vzestup = událost, ne reset.

### E5. ⚙️ Kronika města (nový)
- Herní čas = **letopočet** (éra posouvá století). Automatický **letopis**: „Rok 34: postavena první huť. Rok 112: Velký požár. Rok 205: dokončena Pyramida."
- Po vzestupu se kronika archivuje do **Síně civilizací** (jméno města — hráč si město pojmenuje! —, archetyp, éra, populace, divy, relikvie). Historie všech běhů = meta-sbírka a zdroj nostalgie.

---

## F. Ke hvězdám (body 22, 23)

### F1. 💥 Éra 7: Vesmírný věk (bod 22)
Po Fúzi a Vesmírném výtahu:
- **Kosmodrom** 4×4 (megaprojekt): staví se rakety (viditelně na rampě!). **Start rakety = celoobrazovková událost** — odpočet, plameny, otřes, kouřová stopa přes celou mapu.
- **Satelity** (vypouštěné raketami): GPS (+haul globálně), meteosatelit (mírní počasí/období), špionážní (odhalí bohatá ložiska na frontieru).
- **Orbitální laser** ⚡: aktivní schopnost s cooldownem — hráč klikne na ložisko a **z nebe sjede paprsek**, který vytěží celé ložisko naráz (přesně ten „laser z nebes"). Vizuální highlight hry.
- **Asteroidová těžba**: pasivní příjem vzácných kovů; **návratové kapsle** viditelně přistávají na padácích u kosmodromu.
- **Vesmírné divy**: Orbitální prstenec (trvalý oblouk na obloze města!), Měsíční základna (Měsíc v rohu oblohy dostane světélka).
- Ascension se integruje: **Archa** startuje z kosmodromu (E4.3).

### F2. ⚙️ Teraformace (bod 23)
Godgame nástroje za energii (éra 6–7), řeší i „špatný seed":
- **Buldozer** (éra 4): odstranit balvan/pařez/uzel.
- **Zavlažování** (éra 4): poušť/step → louka v okruhu.
- **Planýrování** (éra 6): odstřel kopce/hory → hromada kamene a rud + stavitelný terén.
- **Vodní inženýrství** (éra 6): vytvořit/vysušit jezero (přehrada E1 vyžaduje řeku — tady si ji můžeš „přivést").
- **Klimatizátor** (éra 7): změna biomu velkoplošně; sníh/poušť na přání (kosmeticky i produkčně).

---

## G. Další nové nápady (bod 25 — „vymysli víc")

1. **Expedice** ⚙️: pošli N lidí + zásoby na výpravu (10–60 min reálného času) → vrátí se s kořistí: nové ložisko, relikvie fragment, mapa k divu, exotické zvíře do parku (mini-zoo!). Risk/reward volby („jít přes bažinu = rychlejší, riziko ztrát").
2. **Slavní rodáci (hrdinové)** ⚙️: občas se narodí pojmenovaný občan s vlastností („Ada, geniální inženýrka: +15 % věda dokud žije"). Karta s generovaným portrétem, síň slávy. Jemná RPG vrstva bez managementu.
3. **Questy rádce** 🎨: řetěz úkolů s odměnami („Postav 5 farem → 200 zlata") — vede nováčka lépe než hint bar a dává krátkodobé cíle; pozdní questy = výzvy pro pokročilé („Přežij zimu bez ztráty populace").
4. **Panel statistik s grafy** 🎨: sparkline produkce každé suroviny, graf populace přes běh, heatmapa kliků. Optimalizátoři to milují.
5. **Fotomód** 🎨: schová UI, volný pohyb kamery, klik = PNG celého města (share!). Kombinuje se s kronikou (fotky do letopisu).
6. **Vlajka a jméno města** 🎨: mini editor vlajky (tvar/barvy/symbol), jméno v titulku, kronice a síni civilizací.
7. **Počasí** 🎨: déšť (farmy+, kouř mizí), bouřka s blesky, mlha nad ránem, duha po dešti (buff C5). Vše vypínatelné.
8. **Sezónní trhy a festivaly** ⚙️: zimní trh (vánoční světla!), dožínky, jarní slavnost — každé období má svůj event s unikátní odměnou.
9. **Muzeum** ⚙️: budova vystavující relikvie (E4) — vystavené relikvie dávají +X % navíc; návštěvníci = gold. Sbírka má fyzické místo ve městě.
10. **Denní/noční směny** ⚙️ (éra 4+): toggle „noční směna" per výrobní čtvrť: +50 % produkce, −happiness — trade-off páka.
11. **Zvukové scenérie** 🎨: u vody racci, v lese datel, v průmyslové čtvrti buchání, v centru ruch — audio „minimapa" při panování.
12. **Řeky** ⚙️ (worldgen): tekoucí řeky s mosty (cesty je kříží mostem — vizuál!), mlýny na řece +bonus, přehrada (E1) vyžaduje řeku. Mapa dostane strukturu a přirozené hranice čtvrtí.

---

## Z. Prioritizace — návrh fází implementace

| Fáze | Obsah | Body |
|---|---|---|
| **v0.2 „Čitelnost a základ"** | i18n (CZ/EN/DE/FR), oprava teleportace agentů, kapacity v UI + panel Sklad, chip vody + happiness breakdown, oprava cest + autotiling, kategorie stavěcího menu | 1, 2, 3, 4, 8, 16 |
| **v0.3 „Město, co roste do krásy"** | úrovně budov s modely, merge/super budovy, mega pole + koně/traktory, parky, čtvrtě s bonusy, větší půdorysy, ambientní život | 5, 6, 7, 12, 13, 24 |
| **v0.4 „Živý svět"** | rybaření + přístav, viditelná železnice s vlaky, roční období, eventy a katastrofy, obchod/karavany, Guvernér (autonomie) | 11, 14, 17, 18 |
| **v0.5 „Megalomanie"** | rebalanc populace do statisíců, výškové budovy/skyline, divy světa, nájezdy a obrana (volitelné), achievementy s tituly, Vzestup s archetypy + relikviemi, kronika | 15, 19, 20, 21 |
| **v0.6 „Ke hvězdám"** | éra 7: kosmodrom, rakety, orbitální laser, satelity, asteroidy; teraformace; expedice, hrdinové, muzeum, fotomód, řeky | 22, 23, + G |

Každá fáze končí buildem jednoho HTML, testy (smoke/features/endgame + nové), botím balanc-passem a pushem.

**Poznámka k i18n (bod 1):** všechny texty se přesunou do slovníků `src/i18n/{cs,en,de,fr}.ts` s klíči; data (budovy/techy/achievementy) dostanou překladové klíče místo přímých textů. Přepínač jazyka na title screenu i v nastavení, volba uložená v settings, výchozí dle prohlížeče. Čísla formátovaná dle locale.

---

## Addendum 2 — feedback po v0.4 (řeší se ve v0.5 „Megalomanie")

1. **Auto-slučování** ⚙️: upgrade *Stavební cechy* (éra 3) — město samo slučuje 4 stejné budovy ve čtverci do velkých (1/s, s toastem).
2. **Guvernér 2.0** 🐛⚙️: dosavadní auto-stavěč řešil jen jídlo/dřevo/sklady/studny → hráč skončil s plnými sklady a nedostatkem výroby a bydlení. Rozšíření: až **3 akce za sekundu**, nové přepínače **🏠 bydlení** (staví nejlepší odemčené bydlení, když dochází) a **🏭 výroba** (když surovina přetéká, postaví budovu, která ji spotřebovává — plné dřevo → pila, plná ruda → huť…), **🔬 věda**. Nejdřív obsazuje sloty, pak staví.
3. **Auto-vylepšovač** ⚙️: upgrade *Stavební úřad* (éra 3) — automaticky zvyšuje úrovně budov, když je na to (s rezervou).
4. **🐛 Vlak mimo koleje**: trasy vlaků se odvozovaly z pořadí nádraží v poli, koleje ale z nejbližšího souseda + půl-dlaždicový offset kotev. Fix: při pokládce kolejí se **uloží trasa** (railRoutes v save) a vlak jede přesně po ní (středy dlaždic).
5. **Čitelnost řetězců** 🎨: klik na surovinu v panelu Sklad otevře **výrobní řetězec** — co ji vyrábí (s receptem), co ji spotřebovává, případně jaký tech to odemyká; karty budov nově ukazují recept ikonami (🪵→🟫).

**Megalomanie (jádro v0.5):** činžák (+30) → panelák (+100) → **arkologie (+1000 bydlení)**, růst populace škáluje s érou (×1+0,5/éra) → města v desítkách tisíc; tech *Průmyslové zemědělství* (farmy ×6, skleníky ruší zimu); **jaderná elektrárna** ☢️ s chladicími věžemi; tech *Automobily* — **auta a náklaďáky jezdí po silnicích**, silnice se v éře 4+ mění na **asfalt s pruhy**; **divy světa** se stavbou v čase (lešení → ohňostroj): Velká pyramida (klik ×2), Ocelová věž (stavby −15 %, produkce ×1,2), Vesmírný výtah (produkce ×2, věda ×1,5). Nové achievementy: Velkoměsto (10 000), Sedmý div, Atomový věk.
