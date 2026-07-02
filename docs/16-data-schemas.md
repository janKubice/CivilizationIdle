# 16 — Datové schémata (TypeScript)

Formální tvar dat pro **data-driven** obsah a herní stav. Slouží jako smlouva mezi obsahem (data) a logikou (systémy). Typy jsou orientační — implementace je může upřesnit, ale hranice a princip „obsah = data, ne kód" musí zůstat.

---

## 1. Identifikátory a jednotky

```ts
type ResourceId = string;   // 'wood', 'stone', ...
type BuildingId = string;
type TechId = string;
type UpgradeId = string;
type JobKind =
  | 'woodcutter' | 'forager' | 'farmer' | 'fisher' | 'hunter'
  | 'miner' | 'sawyer' | 'smelter' | 'crafter' | 'trader'
  | 'scholar' | 'operator' | 'hauler' | 'builder' | 'idle';

type Era = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Tile = { tx: number; ty: number };
type ResourceAmount = Partial<Record<ResourceId, number>>; // {wood: 50, stone: 20}
```

## 2. Efekty (deklarativní, jádro data-driven přístupu)

Vše, co „něco dělá" (upgrade, tech, achievement, event), popisuje **efekt** jako data. Logika má handler per `kind`.

```ts
type Effect =
  | { kind: 'multiplier'; target: EffectTarget; value: number }        // ×value
  | { kind: 'add'; target: EffectTarget; value: number }               // +value
  | { kind: 'unlock'; what: 'building'|'tech'|'resource'|'mechanic'; id: string }
  | { kind: 'capacity'; resource: ResourceId; value: number }
  | { kind: 'clickMult'; value: number }
  | { kind: 'haulRange'; value: number }
  | { kind: 'conversion'; from: ResourceId; to: ResourceId; ratio: number } // overflow synergie
  | { kind: 'perCount'; source: CountSource; target: EffectTarget; perUnit: number } // "každé X → +Y"
  | { kind: 'grantResources'; amount: ResourceAmount }
  | { kind: 'tempBuff'; target: EffectTarget; value: number; durationMs: number }; // eventy

type EffectTarget =
  | { scope: 'global' }
  | { scope: 'resource'; id: ResourceId }
  | { scope: 'jobKind'; id: JobKind }
  | { scope: 'building'; id: BuildingId }
  | { scope: 'click' }
  | { scope: 'research' };

type CountSource =
  | { of: 'building'; id: BuildingId }
  | { of: 'population' }
  | { of: 'techsUnlocked' }
  | { of: 'jobKind'; id: JobKind };
```

> Přidat novou schopnost = přidat `kind` + handler. Většina obsahu ale vystačí s existujícími kindy → obsah je čistě data.

## 3. Definice obsahu (statická data, read-only)

```ts
interface ResourceDef {
  id: ResourceId;
  name: string;
  category: 'raw' | 'refined' | 'advanced' | 'abstract' | 'meta';
  era: Era;
  storable: boolean;         // energy/happiness = false (flow/index)
  baseCapacity?: number;
  icon: string;              // spriteId
}

interface RecipeDef {                 // crafting řetězec
  id: string;
  building: BuildingId;
  inputs: ResourceAmount;             // /operace
  outputs: ResourceAmount;
  baseRate: number;                   // operací/s na slot
}

interface BuildingDef {
  id: BuildingId;
  name: string;
  type: 'production' | 'crafting' | 'storage' | 'housing' | 'service' | 'power' | 'logistics' | 'special';
  era: Era;
  size: { w: number; h: number };     // v dlaždicích
  baseCost: ResourceAmount;
  costGrowth: number;                 // geometrický růst ceny
  jobKind?: JobKind;
  baseJobSlots?: number;
  baseRate?: number;                  // produkce/slot (u production)
  recipeId?: string;                  // u crafting
  provides?: Effect[];                // pasivní efekty (kapacita, happiness, haul...)
  adjacency?: AdjacencyRule[];        // synergie sousedství
  requiresTech?: TechId;
  variants: number;                   // vizuální varianty
  levels?: BuildingLevel[];           // upgrady budovy
}

interface AdjacencyRule {
  near: 'resourceNode' | BuildingId | 'road';
  nodeType?: ResourceId;
  effect: Effect;                     // typicky multiplier na tuto budovu
  radius: number;
}

interface TechDef {
  id: TechId;
  name: string; desc: string;
  era: Era;
  branch: 'gathering' | 'crafting' | 'logistics' | 'city' | 'science' | 'power';
  cost: { research: number; materials?: ResourceAmount };
  prereqs: TechId[];
  effects: Effect[];
}

interface UpgradeDef {
  id: UpgradeId;
  name: string; desc: string;
  cost: ResourceAmount;               // gold/suroviny/research
  requires?: { techs?: TechId[]; upgrades?: UpgradeId[]; condition?: ConditionExpr };
  effects: Effect[];
  repeatable?: { maxLevel: number; costGrowth: number }; // řetězce I..V
}

interface AchievementDef {
  id: string; name: string; desc: string;
  condition: ConditionExpr;
  reward?: Effect[];
  hidden?: boolean;
}

interface EventDef {
  id: string;
  trigger: 'random' | 'periodic' | 'onEra';
  weight?: number; cooldownMs?: number;
  condition?: ConditionExpr;
  effects: Effect[];                  // často tempBuff / grantResources
  presentation: { sprite?: string; sound?: string; toast?: string };
}

type ConditionExpr =
  | { kind: 'resourceAtLeast'; id: ResourceId; value: number }
  | { kind: 'population'; op: '>=' | '<'; value: number }
  | { kind: 'era'; value: Era }
  | { kind: 'buildingCount'; id: BuildingId; value: number }
  | { kind: 'stat'; id: string; op: '>='; value: number }
  | { kind: 'and'; all: ConditionExpr[] }
  | { kind: 'or'; any: ConditionExpr[] };
```

## 4. Herní stav (runtime, serializovatelný) — viz [11 §5](11-technical-architecture.md), [12](12-save-system.md)

```ts
interface GameState {
  meta: { version: number; seed: number; createdAt: number; lastSaved: number; playtimeMs: number; };

  resources: Record<ResourceId, { amount: number; capacity: number }>;

  // Lidé — SoA (typed arrays). Zde konceptuálně; v kódu Int32Array/Uint8Array (viz [03 §5]).
  citizens: {
    count: number;
    jobId: Int32Array; jobKind: Uint8Array; skill: Uint16Array; homeId: Int32Array;
    // prezentační pole (pos/state/anim) se NEUKLÁDAJÍ — dopočítají se ([12 §2])
    byJobKind: Record<JobKind, number>;   // udržovaný agregát pro ekonomiku
  };

  jobs: { slotId: Int32Array; kind: Uint8Array; buildingId: Int32Array;
          baseRate: Float32Array; haulDist: Float32Array; filled: Uint8Array; };

  buildings: Array<{ id: number; typeId: BuildingId; tx: number; ty: number; level: number; }>;

  world: { chunkDeltas: Record<string, ChunkDelta>; };  // jen změny; zbytek z seedu

  tech: Set<TechId>;
  research: number;
  upgrades: Record<UpgradeId, number>;   // level (0 = nekoupeno)
  achievements: { unlocked: Set<string>; progress: Record<string, number>; };

  allocation: {
    mode: 'slider' | 'priority';
    sliders: Record<JobKind, number>;
    priority: JobKind[];
    presets: Record<string, AllocationConfig>;
    autoBalance: boolean;
  };

  legacy: { currency: number; perks: Record<string, number>; specialization?: string };

  activeBuffs: Array<{ effect: Effect; endsAt: number }>;
  stats: Record<string, number>;
  settings: Settings;
}

interface ChunkDelta {
  removedNodes?: number[];             // vytěžené/odstraněné uzly
  changedNodes?: Record<number, number>; // uzel → zbývající zásoba
  builtBuildings?: number[];           // id budov v chunku
}
```

## 5. Validace

- Definiční data validovat při startu (dev) proti schématu (např. `zod`) → chyby v obsahu se chytí hned, ne za běhu.
- Save validovat při načtení ([12 §5](12-save-system.md)); neznámé id (z novější verze) → migrace nebo bezpečné ignorování.

## 6. Princip
> **Logika interpretuje data.** Systémy ([11 §4](11-technical-architecture.md)) čtou tyto definice a herní stav a počítají výsledky. Přidání suroviny/budovy/techu/upgradu/achievementu/eventu je **záznam v datech**; nová *mechanika* je nový `Effect.kind`/`Condition.kind` + handler. Tím se drží kód malý, testovatelný a rozšiřitelný.
