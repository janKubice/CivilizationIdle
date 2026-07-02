# 07 — Meta progrese: achievementy, ascension, offline

Systémy, které drží hráče napříč sezeními a běhy.

---

## 1. Achievementy

### Princip
Achievementy odměňují milníky a **mnohé dávají trvalý herní bonus** (ne jen odznak) — dle zadání „achievementy co zlepšují progres".

### Kategorie
- **Progrese**: „Postav první pilu", „Dosáhni éry 3", „1 000 obyvatel".
- **Ekonomika**: „Naskladni 1M dřeva", „Produkce 10k/s".
- **Klik**: „100k kliknutí", „Crit za 1M".
- **Optimalizace**: „Nulové plýtvání po 10 min", „5 druhů práce naráz".
- **Meta**: „První ascension", „10 ascensionů".
- **Skryté / vtipné**: easter-eggy (odemknou kosmetiku).

### Odměny
- **Trvalý bonus** (typicky malý globální multiplikátor, aditivní do „achievement power"), např. každých 10 achievementů +1 % produkce; nebo cílené bonusy (klikací achievementy → +click).
- **Kosmetika** (skiny budov, barvy, tituly).
- **Odemčení QoL** (např. presety sliderů po X achievementech).

### Implementace
- **Data-driven** seznam: `{ id, name, desc, condition, reward, hidden }`. Podmínky se vyhodnocují proti hernímu stavu (event-driven kde to jde, jinak levný check per pomalý tick). Viz [15](15-content-catalog.md)/[16](16-data-schemas.md).

## 2. Ascension / prestige

### Koncept
Když civilizace dosáhne určité vyspělosti (skóre / milník), hráč může provést **Ascension**: resetuje město a suroviny, ale získá **Legacy měnu** (pracovní název **„Odkaz"** / anglicky *Legacy* nebo *Relics*), kterou utratí za **trvalá vylepšení**, jež platí ve všech dalších bězích.

Je to hlavní **endgame smyčka** a zdroj znovuhratelnosti.

### Co se resetuje a co zůstává
| Reset (začne znovu) | Zůstává (napříč běhy) |
|---------------------|-----------------------|
| Mapa, budovy, populace | Legacy měna a Legacy strom |
| Skladované suroviny | Odemčené achievementy + jejich bonusy |
| Postup tech tree | Nastavení, kosmetika, statistiky |
| Aktuální upgrady | Volitelně „carry-over" odemčené Legacy perky |

### Legacy měna — kolik dostanu
- Odvozeno od **celkového civilizačního skóre** dosaženého v běhu (funkce populace, produkce, odemčených technologií, monumentů).
- Vzorec typu „odmocnina/log z nahromaděné hodnoty", aby delší běhy dávaly víc, ale s klesajícími výnosy (klasika prestige balancu). Viz [13](13-balancing-and-formulas.md).
- UI před ascensionem jasně ukáže „získáš X Odkazu (+Y %)" → informované rozhodnutí kdy resetovat.

### Legacy strom (za co se utrácí)
- **Startovní boost**: začni s odemčenou érou / s balíkem surovin / s N lidmi.
- **Trvalé multiplikátory**: ×produkce, ×research, ×click, ×offline.
- **Odemčení mechanik**: auto-alokace od startu, druhý slider preset, „kinetický klik", overflow konverze zdarma.
- **Nové vrstvy** exkluzivní pro ascension: např. **specializace civilizace** (vyber archetyp: Industriální / Vědecká / Obchodní / Zelená — každý mění bonusy a styl běhu) → znovuhratelnost.
- **Meta-meta** (velmi pozdě, volitelné): druhá vrstva prestige („Věky/Epochy") nad ascensionem pro nekonečné škálování — jen pokud první vrstva sedí.

### Rytmus
- První ascension by měl přijít po **několika hodinách** prvního běhu (výrazný, oslavovaný milník).
- Další běhy jsou **znatelně rychlejší** (Legacy boosty) → hráč cítí „teď to lítá" a dosáhne dál/odemkne nové Legacy uzly.

## 3. Offline progres

Idle hra musí odměnit i dobu, kdy hráč nehraje.

### Výpočet
- Při načtení se zjistí `Δt = now − lastSaved`.
- Produkce se dopočítá pomocí **agregátní ekonomiky** (stejné vzorce jako online, protože ekonomika je deterministická a nezávislá na renderu — viz [03](03-people-and-work.md)) buď:
  - **analyticky** (uzavřený vzorec pro lineární úseky) pro rychlost, nebo
  - **zrychleným během simulace** ve velkých krocích (coarse ticks) pro věrnost nelineárních efektů (potřeby, growth). Doporučeno: coarse-tick s většími `SIM_DT` a capem počtu kroků.
- **Cap**: offline se počítá do limitu (např. 8–24 h, rozšiřitelný upgradem) a s **efektivitou** (např. 100 % base, upgrady zvyšují) → aby aktivní hraní mělo pořád smysl.
- Po návratu se zobrazí **souhrn** („Byl jsi pryč 6 h, vydělal jsi …") + volitelný „bonus za návrat".

### Poznámky
- Growth a bottlenecky offline: buď zjednodušit (drž poslední rate) nebo coarse-simulovat; MVP může držet konzervativní „rate v okamžiku odchodu × čas × efektivita".
- Anti-cheat na čas (posun systémových hodin): detekce záporného/skokového času → cap/ignore; není kritické pro singleplayer, ale ošetřit.

## 4. Statistiky a codex

- **Statistiky**: celkem nasbíráno, kliknutí, čas hraní, počet ascensionů, rekordy → napájí achievementy a dává hráči přehled.
- **Codex / encyklopedie**: odemčené suroviny, budovy, techy s popiskem a lore → podpora „sběratelského" tahu a onboardingu.

## 5. Shrnutí smyčky meta progrese

```
běh ──roste skóre──► Ascension ──Legacy měna──► Legacy strom (trvalé boosty)
  ▲                                                        │
  └───────────── rychlejší a dál v dalším běhu ◄───────────┘
   (+ achievementy a jejich bonusy se hromadí napříč vším)
```
