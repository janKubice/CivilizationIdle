# 13 — Balancování a vzorce

Konkrétní matematika ekonomiky. Čísla jsou **výchozí návrhy k vyladění** (data-driven — [16](16-data-schemas.md)), ne posvátná. Cíl: hladká exponenciální progrese bez rozjetí do NaN/nekonečna.

---

## 1. Základní principy

- **Náklady rostou exponenciálně, produkce po vrstvách** → klasická incremental křivka (každý další kus stojí víc, ale nové vrstvy/multiplikátory drží tempo).
- **Multiplikátory se násobí** (ne sčítají) v jasném pořadí ([03 §7](03-people-and-work.md)) → čitelná progrese.
- **Superlineární efekty vždy s protiváhou** (cap / rostoucí cena / spotřeba) → nic se „neutrhne".
- **Vše laditelné z dat**; tento dokument definuje *tvar* křivek, ne finální konstanty.

## 2. Cost curve (cena N-té budovy/upgradu)

Geometrický růst:

```
cost(n) = baseCost × growth^n
```
- `n` = počet už vlastněných.
- `growth` typicky **1.07–1.15** (nižší = rychlejší expanze; pila ~1.10, drahé budovy ~1.15).
- Cena „koupit ×k naráz" = součet geometrické řady:
  ```
  costBulk(n, k) = baseCost × growth^n × (growth^k − 1) / (growth − 1)
  ```
- Více surovin: každá složka ceny má vlastní `baseCost`, sdílí `growth`.

## 3. Produkce (napojení na [03 §7](03-people-and-work.md))

```
prodPerSec(jobKind) =
    activeSlots(jobKind) × baseRate
  × skillFactor
  × techMult × toolMult
  × happinessFactor
  × haulEfficiency
  × globalMult
```

- `activeSlots = min(jobSlots, assignedWorkers, inputAvailability)`.
- `skillFactor = 1 + skillCoef × avgSkill` (mírné, např. skillCoef ~0.02/level, cap).
- `techMult`, `toolMult`, `globalMult` = součin odemčených multiplikátorů dané kategorie/globálně.
- `happinessFactor = lerp(minF, maxF, happiness)` (např. 0.5 → 1.5 dle happiness 0..1; volitelný „boom" nad prahem).

## 4. Haul efektivita (vzdálenost)

```
haulEfficiency(d) = 1 / (1 + d / range(transportTech))
```
- `d` = vzdálenost slotu ke skladu (dlaždice), předpočítaná ([03 §8](03-people-and-work.md)).
- `range` roste s dopravními techy (košík → vozík → silnice → vlak → vrtulník) — vyšší `range` = plošší penalizace; vrtulníky/drony `range → ∞` (penalizace ≈ 0).
- Design: bez dopravy je vzdálený zdroj ~poloviční ve vzdálenosti `= range`; techy to posouvají.

## 5. Populace, potřeby, happiness

### Spotřeba
```
foodConsumption/s = pop × foodPerCapita
waterConsumption/s = pop × waterPerCapita
```

### Happiness (index 0..1)
Vážený průměr splnění potřeb:
```
needScore_i = clamp(supply_i / demand_i, 0, 1)     // pro každou potřebu i
happiness   = Σ (weight_i × needScore_i) / Σ weight_i    // + bonusy (chrám, parky, luxus)
```
- Váhy: jídlo a bydlení nejvyšší; voda/spokojenost střední; luxus pozdě.
- Bonusy (servisní budovy, festival) přičítají nad základ (cap 1, resp. přes cap pro „boom").

### Růst / odliv populace
```
if happiness ≥ growthThreshold and housingFree > 0 and foodSurplus > 0:
    growth/s = growthBase × happiness × f(foodSurplus, housingFree)
elif happiness < declineThreshold:
    decline/s = declineBase × (declineThreshold − happiness)
```
- Batch aplikace (celá čísla lidí) v pomalejším tiku.
- `growthThreshold` ~0.6, `declineThreshold` ~0.3 (ladit). Odliv je mírný (odpouštějící, ne survival).

## 6. Research

```
research/s = scholars × baseResearchRate × scienceMult × happinessFactor
techCost(era, idx) = base_era × costGrowth^idx     // roste napříč érou i strom
```
- `base_era` roste po érách (řádový skok za éru), kompenzováno růstem `research/s` z lepších lab a víc učenců.
- Některé techy mají navíc **materiálový gate** (fixní vklad surovin) — nezávislý na research křivce.

## 7. Klik

```
gainPerClick = baseClick × clickMult × (1 + comboBonus)
crit: s pravděpodobností pCrit × critMult
kineticClick (endgame upgrade): gain += kineticCoef × prodPerSec(target)
```
- `comboBonus` roste s rychlostí klikání a decayuje (streak).
- „Kinetický klik" drží klik relevantní pozdě (škáluje s produkcí).

## 8. Ascension / Legacy měna

Odměna z celkové hodnoty běhu s klesajícími výnosy:

```
legacyGain = floor( K × sqrt(civScore / S0) )        // nebo log-based
civScore  = f(totalProduced, peakPop, techsUnlocked, monuments, ...)
```
- `sqrt`/`log` tvar → delší běh dá víc, ale ne lineárně (motivace resetovat ve správný čas, ne donekonečna grindit jeden běh).
- Legacy perky: převážně **multiplikátory** (×prod, ×research, ×click, ×offline) a **startovní boosty** — jejich cena v Legacy měně opět geometricky roste.
- Cílový rytmus: 1. ascension po pár hodinách; každý další běh výrazně rychlejší (viz [07](07-meta-progression.md)).

## 9. Offline

```
offlineGain = integrate(prodPerSec) over clamp(Δt,0,OFFLINE_CAP) × offlineEfficiency
```
- MVP: lineární aproximace (rate v okamžiku odchodu). Lepší: coarse-tick simulace ([12 §6](12-save-system.md)).
- `offlineEfficiency` default < 1 (např. 0.5), upgrady/Legacy zvyšují k 1+.
- `OFFLINE_CAP` rozšiřitelný upgradem.

## 10. Číselné meze a bezpečnost

- Hlídat **NaN/Infinity** (dělení nulou v haul/needs, prázdné agregáty) → clampy a guardy ve vzorcích.
- Pro extrémně velká čísla (velmi pozdní hra / mnoho ascensionů) zvážit **break_infinity.js** (BigNumber) — až když `Number` přestane stačit; do té doby `Number` + vědecká notace v UI.
- **Sanity testy** ([11 §10](11-technical-architecture.md)): simulovaný běh X minut nesmí vyprodukovat NaN/Infinity ani nulovou produkci při validním buildu.

## 11. Pracovní tabulka výchozích konstant (k ladění)

| Konstanta | Návrh | Poznámka |
|-----------|-------|----------|
| `SIM_DT` | 100 ms | 10 Hz simulace |
| `growth` (cost) | 1.07–1.15 | dle budovy |
| `foodPerCapita` | ~0.1 /s | ladit s produkcí farem |
| `growthThreshold` | 0.6 | happiness práh růstu |
| `declineThreshold` | 0.3 | práh odlivu |
| `skillCoef` | ~0.02 /level (cap) | mírná odměna za stabilitu |
| `pCrit` base | ~2 % | upgradovatelné |
| `critMult` | ×7 | „golden" pocit |
| `OFFLINE_CAP` | 8 h (rozšiřitelný) | balanc idle |
| `offlineEfficiency` | 0.5 → 1+ | upgrady/Legacy |
| `legacy K, S0` | ladit | tak, aby 1. ascension ~ pár hodin |

> Tyto hodnoty jsou **startovní**; skutečné balancování probíhá iterativně přes playtesty a sanity testy proti těmto vzorcům.
