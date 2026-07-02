# 00 — Vize a pilíře

## Elevator pitch

> Začínáš jako hrstka lidí na kraji nekonečné divočiny. Klikáním lámeš první kameny a sbíráš bobule. Každý příchozí obyvatel je pár rukou navíc — pošleš ho těžit, orat nebo stavět. Jak plníš potřeby své civilizace, město se **samo organicky rozrůstá** do krajiny, odemykáš vynálezy od kamenných nástrojů po **laserové těžební pušky a přepravní vrtulníky**, skládáš upgrady do šílených synergií a nakonec necháš svou civilizaci vstoupit do dějin (**ascension**), abys začal znovu — silnější.

Civilization Idle spojuje uspokojení z **incremental her** (rostoucí čísla, exponenciální progrese, „ještě jeden upgrade") s vizuální radostí z **city-builderu**, kde je na první pohled vidět, že tvé rozhodnutí něco změnilo — město žije, lidé chodí, kola se točí.

## Designové pilíře

Každé designové rozhodnutí se poměřuje vůči těmto pěti pilířům. Pokud je feature v rozporu s pilířem, feature ustupuje.

### 1. Živoucí, rostoucí město
Hráč musí **vidět** dopad svých rozhodnutí. Když přibude farmář, na poli se objeví postavička, která ho oře. Když se postaví pila, začne z ní jezdit dřevo. Město se rozrůstá organicky — ne mřížka, kterou hráč vyplňuje, ale sídlo, které se samo šíří do krajiny podél cest a zdrojů. Den a noc, kouř z komínů, festivaly.

### 2. Každý člověk se počítá
Lidé nejsou abstraktní číslo „populace". Jsou to jednotlivé entity — zdroje, které umí chodit, těžit, nosit, pracovat. Hráč je alokuje, vidí je makat a raduje se, když jich přibývá. **Zároveň to musí škálovat na tisíce** bez zabití výkonu (viz pilíř „hra, ne tech demo" a [dokument 03](03-people-and-work.md)).

### 3. Klikání na začátku, automatizace potom
Prvních pár minut je aktivní klikačka — hráč cítí přímý dopad. Postupně se hra mění v optimalizační hru: nastav slidery, postav správné budovy, odemkni správné techy a nech civilizaci běžet. Klikání nikdy úplně nezmizí (dává boost, „golden" eventy), ale přestává být nutné.

### 4. Hloubka skrz progresi
Zábava pramení z odemykání. Tech tree, upgrady, synergie a ascension musí neustále nabízet další cíl. Vždy má existovat „další věc za ~5–15 minut" i „velký cíl za pár hodin". Systémy se mají **skládat** (upgrade A zesiluje efekt techu B, který otevírá synergii C).

### 5. Je to hra, ne tech demo
Menu, plynulé save/load, offline progres, achievementy, zvuk, pěkná grafika, nastavení, onboarding. Výkon je feature: cílíme 60 FPS na běžném notebooku i s velkým městem. Nic z toho není „až potom" — je to součást definice hotového.

## Cílový pocit (player fantasy)

- „Jsem zakladatel civilizace, kterou pozoruju z ptačí perspektivy, jak roste z ničeho v metropoli."
- „Mám v tom systém — vím, proč roste zrovna tohle číslo, a umím to vyladit."
- „Odemkl jsem něco absurdně silného a teď se dívám, jak mi obrazovka exploduje surovinami."

## Cílová skupina

- Fanoušci incremental/idle her (Cookie Clicker, Universal Paperclips, Antimatter Dimensions, Melvor Idle, Kittens Game, Forager).
- Fanoušci lehkých city-builderů a management her, kteří chtějí něco pohodového, co jde hrát „na pozadí".
- Platforma: **web (desktop i mobil)**. Primárně desktop prohlížeč, mobil jako plnohodnotný cíl (dotykové ovládání, responzivní UI).

## Referenční hry a co si z nich bereme

| Hra | Co si bereme |
|-----|--------------|
| **Cookie Clicker** | Klikací jádro, vrstvení produkčních budov, achievementy jako meta bonusy, „golden cookie" náhodné eventy |
| **Forager** | Top-down pocit, rozrůstání do mapy, radost z odemykání, vizuální hustota |
| **Kittens Game** | Populace jako pracující jednotky s přiřazením, hluboká ekonomika surovin, éry |
| **Universal Paperclips** | Elegantní eskalace od malého k absurdnímu, přechody mezi fázemi hry |
| **Factorio / Mindustry** | Výrobní řetězce, logistika, radost z běžícího „stroje" (my zjednodušeně/idle) |
| **Antimatter Dimensions** | Prestige/ascension vrstvy, synergie mezi vrstvami, „unlock další mechaniky při resetu" |
| **Melvor Idle** | Offline progres, breadth obsahu, čistý data-driven přístup |

## Co hra NENÍ (scope guardrails)

Aby projekt nebobtnal donekonečna, explicitně vymezujeme:

- **Není to plnohodnotný RTS/Factorio.** Logistika a výroba jsou zjednodušené a idle-friendly, ne pixel-perfect pásové dopravníky.
- **Není to multiplayer.** Čistě singleplayer, žádný server pro herní logiku (leaderboard/cloud save je volitelné „nice to have" v pozdní fázi).
- **Není to survival.** Lidé neumírají hlady dramaticky, nejsou nepřátelé/válka v jádru hry (případný „military/defense" obsah je až post-MVP a volitelný — viz [tech tree](05-tech-tree.md)).
- **Žádný pay-to-win / monetizace v MVP.** Design nepočítá s mikrotransakcemi.

## Metriky úspěchu (design goals, ne KPI)

- Nový hráč do **2 minut** provede první smysluplné rozhodnutí a vidí jeho dopad.
- Do **15 minut** má odemčenou automatizaci a první tech.
- Hra nabízí smysluplnou progresi minimálně na **desítky hodin** aktivní hry + neomezeně díky ascension.
- Udrží **60 FPS** s městem o ~2 000 obyvatelích na středním hardwaru.
