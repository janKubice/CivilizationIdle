# 10 — Audio design (zvuk a hudba)

Zvuk je v zadání explicitně požadovaný. Cíl: příjemný, neúnavný audio zážitek, který posiluje feedback a atmosféru, s minimální technickou náročností.

---

## 1. Technologie

- **Doporučeno: Howler.js** (jednoduché API, audio sprites, prostorové/volume ovládání, dobrá kompatibilita web/mobil). Alternativa: nativní Web Audio API pro plnou kontrolu (mixování, efekty) — víc práce.
- **Audio sprites** (jeden soubor + časové značky) pro krátké SFX → méně requestů, rychlé přehrávání.
- Formáty: `.ogg` + `.mp3` fallback (kompatibilita napříč prohlížeči).
- **Autoplay policy**: audio se odemyká až po první interakci uživatele (klik) — ošetřit „unlock" gesto.

## 2. Vrstvy zvuku

| Vrstva | Obsah | Poznámka |
|--------|-------|----------|
| **Hudba** | 2–4 smyčky měnící se dle éry/fáze (klidná akustická → orchestrální → elektronická/hi-tech) | Crossfade mezi tracky při přechodu éry |
| **Ambient** | zvuk prostředí (les, vítr, ruch města sílící s populací) | Dynamicky mixovaný dle stavu (víc lidí = rušnější) |
| **SFX akce** | klik/gather, crit, stavba, koupě upgradu, chyba | Krátké, výrazné, ne únavné |
| **SFX události** | nová éra (fanfára), ascension (cinematic), Golden Citizen, level up | „Wow" momenty |
| **UI SFX** | otevření panelu, hover, přepnutí | Jemné, tiché |

## 3. Klíčové zvuky (feedback)

- **Gather klik**: krátký, příjemný „tuk/cink"; **variace výšky** podle suroviny a lehký random pitch, aby rychlé klikání neznělo roboticky.
- **Crit**: výraznější „ka-cink" + vyšší pitch.
- **Combo/streak**: stoupající tón s comboem (pozitivní gradient).
- **Koupě/stavba**: „ka-ching" / zaklepání kladiva.
- **Bottleneck alert**: nevtíravý, ale rozpoznatelný „ping" (nesmí otravovat — throttling).
- **Nová éra / laser / vrtulník / ascension**: signature stingery (viz [06 §5](06-upgrades-and-synergies.md), [09 §8](09-art-direction.md)).

## 4. Dynamické mixování

- Hlasitost/hustota ambientu **škáluje s populací a aktivitou** → město „zní" větší, jak roste.
- Hudební track se **volí dle aktuální éry**; přechod = crossfade.
- **Ducking**: při důležitém stingeru (éra/ascension) se hudba/ambient krátce ztiší.
- **Anti-spam**: stejné SFX se v krátkém okně slévá / omezuje počet souběžných instancí (voice limit) — hlavně u rychlého klikání a hromadných eventů.

## 5. Ovládání a nastavení

- Oddělené slidery: **Master / Hudba / SFX / Ambient**, každý mute.
- Respektuj „reduce motion"/tichý režim; **pauza hry ztlumí/pozastaví** ambient (volitelné).
- Stav hlasitostí se ukládá do save/nastavení.

## 6. Asset zdroje a pipeline

- **Placeholder-first**: volné CC0 knihovny (freesound.org CC0, Kenney audio packs) pro rané fáze; finální custom později.
- Evidence licencí v CREDITS.
- Loudness normalizace (aby SFX nebyly různě hlasité); krátké soubory jako audio-sprite atlas.

## 7. Implementační poznámka

- **AudioManager** modul: `play(id, {volume, pitch, throttleMs})`, `playMusicForEra(era)`, `setBus(bus, volume)`. Herní logika jen **emituje eventy** („resourceGathered", „eraUnlocked"), AudioManager na ně reaguje → zvuk je oddělený od logiky (stejná hranice jako UI, viz [11](11-technical-architecture.md)). To umožní testovat logiku bez audia a měnit zvuky bez zásahu do herní smyčky.
