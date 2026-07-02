# 09 — Art direction (grafika)

Cíl: hezká, čitelná, **živoucí** top-down grafika, která škáluje výkonově (viz [03](03-people-and-work.md), [11](11-technical-architecture.md)) a jde vyrobit i s malým týmem / placeholdery.

---

## 1. Vizuální styl — doporučení

**Primární volba: čistý „cozy" top-down, mírně izometricky laděný pixel-art nebo vektorové ploché tvary.** Dvě životaschopné cesty:

- **A) Pixel-art (doporučeno pro atmosféru):** teplá paleta, čitelné silné tvary, 16–32 px dlaždice. Snadné animace postaviček (2–4 snímky). Vibe: Forager / Stardew-lite z ptačí perspektivy.
- **B) Flat vector / low-poly 2D (doporučeno pro škálovatelnost a snadnou tvorbu):** geometrické tvary, jemné stíny, generovatelné programově (méně asset práce, ostré na všech rozlišeních). Vibe: moderní „minimal city".

> Doporučení: **začít stylem B (flat vektor / jednoduché tvary)** pro rychlý, konzistentní placeholder pipeline a případně přejít/kombinovat s A. Klíčové je držet **jeden konzistentní styl** a čitelnost při odzoomování.

## 2. Kamera a perspektiva

- Top-down (kolmý pohled) nebo mírná 2.5D „dimetrie" pro hloubku budov. Doporučeno **top-down s lehkým fake-3D u budov** (vyšší budovy mají malý „bok") — čitelné a levné.
- Vrstvení (z-order): teren < cesty < dekorace/uzly < budovy < agenti < particly < UI.

## 3. Tileset a svět

- **Biomy** (louka, les, step, kopce, hory, poušť, voda, pláž) — každý svá dlaždicová sada + přechody (autotiling / bitmask 4- nebo 8-směrný).
- **Cesty**: autotile spojující se do sítě (klíčové pro organický vzhled města).
- **Surovinové uzly**: rozlišitelné siluety (strom, balvan, rudná žíla se třpytem, keř, pole). Stav zásoby čitelný (plný/vytěžený sprite).
- **Voda**: animovaná (shader/posun UV) — levný „život".

## 4. Budovy a variabilita

- Každý typ budovy má **několik vizuálních variant** (2–4) a **vizuální levely** (chatrč → dům → patrový dům; huť → továrna) → město nevypadá „copy-paste" a je vidět pokrok.
- **Éra mění vzhled**: přechodem do nové éry se zástavba postupně „upgraduje" (kámen → cihla → beton → hi-tech) — silný wow moment.
- Staveniště → hotová budova jako animace (lešení, pak objevení).
- Dekorace (stromy v ulicích, lavičky, sochy, prádlo) pro „obydlenost", spawnované organickým růstem.

## 5. Postavičky (lidé) — variabilita a život

- **Jeden sprite-sheet + palette swap** pro variabilitu (barva oděvu, tón kůže, doplněk podle profese: sekera dřevorubce, krumpáč horníka, později laser puška). Viz [03 §9](03-people-and-work.md).
- Animace: chůze, práce (těžba/orba), idle (postávání), nošení nákladu. 2–6 snímků stačí.
- **Profese = vizuální rozlišení** (horník má helmu/laser, farmář klobouk) → hráč pozná, kdo co dělá.
- **Instanced/batch rendering** (PixiJS `ParticleContainer`) → tisíce postaviček levně.

## 6. „Živoucí město" — checklist

Co dělá dojem života (vše kosmetické, jen L0/L1, levné):
- Postavičky chodí po cestách, postávají, jdou v noci „domů".
- Kouř z komínů, otáčející se mlýny/turbíny, blikání oken v noci.
- Denní cyklus (viz §7), počasí (volitelné: déšť/sníh dle biomu/eventu).
- Ptáci/zvěř na okraji, vlnící se pole, voda.
- Festival → vlajky, ohňostroj, víc pohybu.
- Reakce na eventy (Golden Citizen svítí, krize = zataženo).

## 7. Denní / noční cyklus a osvětlení

- Plynulý cyklus (den → soumrak → noc → úsvit) měnící barevný nádech (tint) scény; v noci se rozsvítí okna a lampy.
- Implementačně levné: globální color-grade/tint overlay + „light" sprity u budov v noci. Vypínatelné (accessibility/výkon).
- Volitelně jemný vliv na atmosféru (ne na ekonomiku), aby to nebyl balanc faktor.

## 8. Particly a juice

- **Gather**: malé částice + floating „+N".
- **Crit**: výraznější záblesk/hvězdičky.
- **Stavba/level up**: prach, jiskry, „pop".
- **Laser těžba**: paprsek + odletující kusy horniny + záře (signature efekt éry 6).
- **Vrtulník/dron**: rotory, prachová vlna při přistání.
- **Nová éra / ascension**: konfety, světelný sloup, přebarvení města.
- Particly mají **rozpočet** (cap) a kvalitu dle nastavení; recyklují se z poolu (žádné alokace v hot loopu).

## 9. Barevná paleta a čitelnost

- Teplá, přívětivá základní paleta; **funkční barvy konzistentní** (zelená = přebytek/ok, červená = deficit, zlatá = gold/eventy, modrá = věda/energie).
- Vysoký kontrast siluet vůči terénu (čitelnost při odzoomu).
- **Barvoslepý-friendly** varianta (nespoléhat jen na barvu — i tvar/ikona). Viz [08 §9](08-ui-ux.md).

## 10. Asset pipeline a placeholdery

- **Placeholder-first**: začít jednoduchými tvary/barvami generovanými kódem nebo volnými CC0 assety (např. Kenney.nl top-down/tiny-town sady) → hratelnost dřív než finální art.
- Assety jako **atlasy (texture atlas / sprite sheet)** pro málo draw callů; nástroj TexturePacker nebo build-time atlasování.
- Konzistentní grid, pojmenování a **manifest** (data-driven mapa `spriteId → atlas frame`) → art jde měnit bez zásahu do logiky.
- Licencování assetů evidovat (CREDITS), preferovat CC0/vlastní.

## 11. Výkonová pravidla (art × engine)

- Vše přes atlasy + instancing; cap na viditelné agenty a particly; LOD (odzoom = méně detailu / dav místo jednotlivců).
- Animace sdílené (ne per-entita stavový stroj v JS pro tisíce entit — data-driven fáze).
- Denní cyklus/tint jako jeden overlay, ne per-sprite přepočet.
- Vazba na [11 — Technická architektura](11-technical-architecture.md) a [03 §11 checklist](03-people-and-work.md).
