// ===== Data-driven obsah hry: suroviny, budovy, techy, upgrady, achievementy, perky =====
// (viz docs/15-content-catalog.md a docs/16-data-schemas.md)

export type Rec = Record<string, number>;

// ---------- Suroviny ----------
export interface ResDef {
  id: string; name: string; icon: string;
  baseCap: number;        // Infinity = bez limitu
  value: number;          // hodnota pro civScore
  color: string;          // barva particlů / floating textů
}

export const RES: ResDef[] = [
  { id: 'wood', name: 'Dřevo', icon: '🪵', baseCap: 250, value: 1, color: '#c08a4e' },
  { id: 'food', name: 'Jídlo', icon: '🍎', baseCap: 250, value: 1, color: '#e35d5d' },
  { id: 'stone', name: 'Kámen', icon: '🪨', baseCap: 200, value: 1, color: '#aab0b8' },
  { id: 'plank', name: 'Prkna', icon: '🟫', baseCap: 150, value: 3, color: '#d8a35f' },
  { id: 'copperOre', name: 'Měděná ruda', icon: '🟤', baseCap: 120, value: 3, color: '#b87333' },
  { id: 'copper', name: 'Měď', icon: '🟠', baseCap: 100, value: 8, color: '#e08d4f' },
  { id: 'ironOre', name: 'Železná ruda', icon: '⚫', baseCap: 120, value: 3, color: '#7d7f88' },
  { id: 'iron', name: 'Železo', icon: '🔩', baseCap: 100, value: 8, color: '#a8adba' },
  { id: 'brick', name: 'Cihly', icon: '🧱', baseCap: 150, value: 4, color: '#c4593e' },
  { id: 'coal', name: 'Uhlí', icon: '◼️', baseCap: 180, value: 3, color: '#454a52' },
  { id: 'steel', name: 'Ocel', icon: '⛓️', baseCap: 80, value: 20, color: '#c8d2e0' },
  { id: 'tools', name: 'Nástroje', icon: '🛠️', baseCap: 80, value: 15, color: '#e8c46a' },
  { id: 'machinery', name: 'Stroje', icon: '⚙️', baseCap: 50, value: 60, color: '#9fb4d8' },
  { id: 'electronics', name: 'Elektronika', icon: '💾', baseCap: 40, value: 150, color: '#6fd8c8' },
  { id: 'gold', name: 'Zlato', icon: '💰', baseCap: Infinity, value: 5, color: '#ffd777' },
  { id: 'research', name: 'Věda', icon: '🔬', baseCap: Infinity, value: 2, color: '#8fb8ff' },
];
export const RES_BY: Record<string, ResDef> = Object.fromEntries(RES.map(r => [r.id, r]));

// ---------- Budovy ----------
export interface BDef {
  id: string; name: string; icon: string; desc: string; era: number;
  cost: Rec; size: number;
  jobs?: number; jobName?: string;
  prod?: { res: string; rate: number };   // /pracovník/s
  raw?: boolean;                          // těžba – aplikuje se gather+tool mult
  noHaul?: boolean;                       // gold/research – bez dopravní penalizace
  recipe?: { inputs: Rec; outputs: Rec }; // /pracovník/s
  fuel?: { res: string; rate: number };   // elektrárna
  energyOut?: number; energyUse?: number; // /pracovník
  housing?: number; water?: number; hap?: number;
  capBoost?: boolean;                     // skladiště
  tech?: string;                          // vyžadovaná technologie
  unbuildable?: boolean;                  // náves
}

export const BUILDINGS: BDef[] = [
  { id: 'plaza', name: 'Náves', icon: '🏕️', desc: 'Srdce tvé civilizace.', era: 0, cost: {}, size: 2, housing: 5, water: 15, unbuildable: true },
  { id: 'hut', name: 'Chatrč', icon: '🛖', desc: 'Bydlení pro 4 obyvatele. Město si je staví i samo.', era: 0, cost: { wood: 15, stone: 5 }, size: 1, housing: 4 },
  { id: 'storehouse', name: 'Skladiště', icon: '📦', desc: '+75 % kapacity všech surovin. Zkracuje donášku okolním budovám.', era: 0, cost: { wood: 40, stone: 15 }, size: 1, capBoost: true },
  { id: 'forestCamp', name: 'Dřevorubecký tábor', icon: '🪓', desc: 'Dřevorubci automaticky těží dřevo.', era: 0, cost: { wood: 20 }, size: 1, jobs: 2, jobName: 'Dřevorubci', prod: { res: 'wood', rate: 0.5 }, raw: true },
  { id: 'gatherHut', name: 'Sběračská chýše', icon: '🧺', desc: 'Sběrači shánějí jídlo v okolí.', era: 0, cost: { wood: 15 }, size: 1, jobs: 2, jobName: 'Sběrači', prod: { res: 'food', rate: 0.45 }, raw: true },
  { id: 'quarry', name: 'Lom', icon: '⛏️', desc: 'Kameníci lámou kámen.', era: 0, cost: { wood: 30 }, size: 1, jobs: 2, jobName: 'Kameníci', prod: { res: 'stone', rate: 0.3 }, raw: true },
  { id: 'library', name: 'Knihovna', icon: '📚', desc: 'Učenci generují vědu pro výzkum technologií.', era: 0, cost: { wood: 35 }, size: 1, jobs: 2, jobName: 'Učenci', prod: { res: 'research', rate: 0.22 }, noHaul: true },
  { id: 'well', name: 'Studna', icon: '⛲', desc: 'Voda pro 40 obyvatel. Zvyšuje spokojenost.', era: 1, cost: { stone: 20 }, size: 1, water: 40, hap: 0.02 },
  { id: 'sawmill', name: 'Pila', icon: '🪚', desc: 'Řeže dřevo na prkna (2 dřevo → 1 prkno).', era: 1, cost: { wood: 50, stone: 15 }, size: 1, jobs: 2, jobName: 'Pilaři', recipe: { inputs: { wood: 1 }, outputs: { plank: 0.5 } }, tech: 'woodworking' },
  { id: 'farm', name: 'Farma', icon: '🌾', desc: 'Stabilní a vydatný zdroj jídla.', era: 1, cost: { wood: 35, plank: 10 }, size: 1, jobs: 3, jobName: 'Farmáři', prod: { res: 'food', rate: 1.1 }, raw: true, tech: 'agriculture' },
  { id: 'copperMine', name: 'Měděný důl', icon: '⚒️', desc: 'Horníci těží měděnou rudu.', era: 1, cost: { wood: 40, plank: 10 }, size: 1, jobs: 2, jobName: 'Horníci (Cu)', prod: { res: 'copperOre', rate: 0.25 }, raw: true, tech: 'copperSmelting' },
  { id: 'smelter', name: 'Huť', icon: '🔥', desc: 'Taví měděnou rudu na měď.', era: 1, cost: { stone: 40, wood: 20 }, size: 1, jobs: 2, jobName: 'Slévači', recipe: { inputs: { copperOre: 0.5 }, outputs: { copper: 0.25 } }, tech: 'copperSmelting' },
  { id: 'workshop', name: 'Dílna', icon: '🛠️', desc: 'Vyrábí nástroje (prkna + měď). Nástroje zrychlují těžbu!', era: 1, cost: { plank: 30, copper: 10 }, size: 1, jobs: 2, jobName: 'Řemeslníci', recipe: { inputs: { plank: 0.3, copper: 0.12 }, outputs: { tools: 0.1 } }, tech: 'toolmaking' },
  { id: 'market', name: 'Tržiště', icon: '🏪', desc: 'Obchodníci vydělávají zlato. Zvyšuje spokojenost.', era: 1, cost: { wood: 30, plank: 20 }, size: 1, jobs: 2, jobName: 'Obchodníci', prod: { res: 'gold', rate: 0.25 }, noHaul: true, hap: 0.05, tech: 'marketplace' },
  { id: 'ironMine', name: 'Železný důl', icon: '⚒️', desc: 'Horníci těží železnou rudu.', era: 2, cost: { plank: 25, copper: 10 }, size: 1, jobs: 2, jobName: 'Horníci (Fe)', prod: { res: 'ironOre', rate: 0.22 }, raw: true, tech: 'ironWorking' },
  { id: 'ironworks', name: 'Železárna', icon: '🔩', desc: 'Taví železnou rudu (ruda + dřevo → železo).', era: 2, cost: { stone: 60, plank: 20 }, size: 1, jobs: 2, jobName: 'Hutníci', recipe: { inputs: { ironOre: 0.4, wood: 0.5 }, outputs: { iron: 0.2 } }, tech: 'ironWorking' },
  { id: 'brickworks', name: 'Cihelna', icon: '🧱', desc: 'Pálí cihly z kamene.', era: 2, cost: { stone: 40, wood: 20 }, size: 1, jobs: 2, jobName: 'Cihláři', recipe: { inputs: { stone: 0.6 }, outputs: { brick: 0.3 } }, tech: 'masonry' },
  { id: 'house', name: 'Dům', icon: '🏠', desc: 'Zděné bydlení pro 9 obyvatel.', era: 2, cost: { wood: 40, brick: 20 }, size: 1, housing: 9, tech: 'masonry' },
  { id: 'temple', name: 'Chrám', icon: '🏛️', desc: 'Výrazně zvyšuje spokojenost. Umožňuje festivaly.', era: 2, cost: { brick: 60, stone: 80 }, size: 1, hap: 0.1, tech: 'theology' },
  { id: 'coalMine', name: 'Uhelný důl', icon: '⬛', desc: 'Horníci těží uhlí — palivo průmyslu.', era: 4, cost: { plank: 30, iron: 10 }, size: 1, jobs: 2, jobName: 'Horníci (uhlí)', prod: { res: 'coal', rate: 0.3 }, raw: true, tech: 'coalMining' },
  { id: 'steelworks', name: 'Ocelárna', icon: '🏗️', desc: 'Železo + uhlí → ocel.', era: 4, cost: { brick: 80, iron: 40 }, size: 1, jobs: 2, jobName: 'Oceláři', recipe: { inputs: { iron: 0.3, coal: 0.4 }, outputs: { steel: 0.15 } }, tech: 'steel' },
  { id: 'powerPlant', name: 'Elektrárna', icon: '⚡', desc: 'Spaluje uhlí a vyrábí energii pro továrny.', era: 4, cost: { brick: 60, steel: 20 }, size: 1, jobs: 2, jobName: 'Operátoři', energyOut: 3, fuel: { res: 'coal', rate: 0.4 }, tech: 'electricity' },
  { id: 'factory', name: 'Továrna', icon: '🏭', desc: 'Vyrábí stroje z oceli. Potřebuje energii.', era: 4, cost: { brick: 100, steel: 60 }, size: 2, jobs: 3, jobName: 'Dělníci', recipe: { inputs: { steel: 0.15 }, outputs: { machinery: 0.04 } }, energyUse: 2, tech: 'industrialization' },
  { id: 'trainStation', name: 'Nádraží', icon: '🚉', desc: 'Železnice — masivně zlepšuje dopravu surovin.', era: 4, cost: { steel: 80, brick: 80 }, size: 2, tech: 'railways' },
  { id: 'hitechLab', name: 'Hi-tech laboratoř', icon: '🔬', desc: 'Vyrábí elektroniku a produkuje spoustu vědy.', era: 5, cost: { steel: 60, machinery: 25 }, size: 1, jobs: 2, jobName: 'Vědci', recipe: { inputs: { machinery: 0.04 }, outputs: { electronics: 0.015, research: 1.4 } }, energyUse: 3, tech: 'electronicsTech' },
  { id: 'monument', name: 'Monument', icon: '🗿', desc: 'Velkolepý pomník tvé civilizace. Spokojenost a sláva (skóre).', era: 3, cost: { stone: 600, brick: 250, gold: 800 }, size: 2, hap: 0.12, tech: 'monuments' },
];
export const B: Record<string, BDef> = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

// ---------- Technologie ----------
export interface TechFx {
  unlock?: string[];                 // id budov (informativně; gate je BDef.tech)
  gather?: number; click?: number; research?: number; global?: number;
  job?: Record<string, number>;
  toolPower?: number;                // nastaví (ne násobí) sílu nástrojů
  haul?: number;                     // + dosah dopravy
  hap?: number; growth?: number;
  special?: 'laser' | 'heli' | 'fusion' | 'ascension';
}
export interface TDef { id: string; name: string; desc: string; era: number; cost: number; mats?: Rec; req: string[]; fx: TechFx }

export const TECHS: TDef[] = [
  // éra 0 – doba kamenná
  { id: 'stoneTools', name: 'Kamenné nástroje', desc: '+25 % těžby, +50 % kliku. Nástroje dostávají smysl.', era: 0, cost: 15, req: [], fx: { gather: 1.25, click: 1.5, toolPower: 0.25 } },
  { id: 'basketry', name: 'Košíkářství', desc: 'Lepší nošení surovin (+dosah dopravy).', era: 0, cost: 25, req: [], fx: { haul: 6 } },
  { id: 'hunting', name: 'Lov a sběr', desc: 'Sběrači jsou o 50 % efektivnější.', era: 0, cost: 20, req: [], fx: { job: { gatherHut: 1.5 } } },
  // éra 1 – bronzová
  { id: 'woodworking', name: 'Zpracování dřeva', desc: 'Odemyká pilu (dřevo → prkna).', era: 1, cost: 60, req: ['stoneTools'], fx: { unlock: ['sawmill'] } },
  { id: 'agriculture', name: 'Zemědělství', desc: 'Odemyká farmy — stabilní zdroj jídla.', era: 1, cost: 90, req: ['hunting'], fx: { unlock: ['farm'] } },
  { id: 'copperSmelting', name: 'Tavení mědi', desc: 'Odemyká měděný důl a huť.', era: 1, cost: 100, mats: { wood: 50 }, req: ['stoneTools'], fx: { unlock: ['copperMine', 'smelter'] } },
  { id: 'wheel', name: 'Kolo', desc: 'Vozíky! +dosah dopravy.', era: 1, cost: 120, req: ['basketry'], fx: { haul: 12 } },
  { id: 'toolmaking', name: 'Řemesla', desc: 'Odemyká dílnu. Bronzové nástroje (síla 0,6).', era: 1, cost: 130, req: ['copperSmelting'], fx: { unlock: ['workshop'], toolPower: 0.6 } },
  { id: 'marketplace', name: 'Tržiště', desc: 'Odemyká tržiště a obchod se zlatem.', era: 1, cost: 150, req: ['woodworking'], fx: { unlock: ['market'] } },
  // éra 2 – antika
  { id: 'writing', name: 'Písmo', desc: 'Znalosti se předávají: +50 % vědy.', era: 2, cost: 250, req: ['woodworking'], fx: { research: 1.5 } },
  { id: 'masonry', name: 'Zdivo', desc: 'Odemyká cihelnu a zděné domy.', era: 2, cost: 400, req: ['writing'], fx: { unlock: ['brickworks', 'house'] } },
  { id: 'roads', name: 'Silnice', desc: 'Dlážděné cesty: +dosah dopravy, město roste podél cest.', era: 2, cost: 450, req: ['wheel', 'writing'], fx: { haul: 20 } },
  { id: 'ironWorking', name: 'Železo', desc: 'Odemyká železný důl a železárnu. Železné nástroje (síla 1,2).', era: 2, cost: 500, mats: { copper: 30 }, req: ['copperSmelting', 'writing'], fx: { unlock: ['ironMine', 'ironworks'], toolPower: 1.2 } },
  { id: 'theology', name: 'Chrámy', desc: 'Odemyká chrám. +5 % spokojenosti.', era: 2, cost: 600, req: ['writing'], fx: { unlock: ['temple'], hap: 0.05 } },
  // éra 3 – středověk
  { id: 'guilds', name: 'Cechy', desc: 'Dílny ×2, tržiště ×1,5.', era: 3, cost: 1500, req: ['ironWorking', 'marketplace'], fx: { job: { workshop: 2, market: 1.5 } } },
  { id: 'millwork', name: 'Mlýny', desc: 'Vodní a větrné mlýny: pily ×2, farmy ×1,5.', era: 3, cost: 2000, req: ['ironWorking'], fx: { job: { sawmill: 2, farm: 1.5 } } },
  { id: 'education', name: 'Univerzita', desc: 'Vzdělání: věda ×2, knihovny ×2.', era: 3, cost: 2500, req: ['masonry'], fx: { research: 2, job: { library: 2 } } },
  { id: 'monuments', name: 'Monumenty', desc: 'Odemyká stavbu monumentů.', era: 3, cost: 3000, req: ['theology', 'masonry'], fx: { unlock: ['monument'] } },
  // éra 4 – průmysl
  { id: 'coalMining', name: 'Těžba uhlí', desc: 'Odemyká uhelný důl.', era: 4, cost: 6000, req: ['education'], fx: { unlock: ['coalMine'] } },
  { id: 'steel', name: 'Ocel', desc: 'Odemyká ocelárnu. Ocelové nástroje (síla 2,5).', era: 4, cost: 9000, mats: { iron: 60 }, req: ['coalMining'], fx: { unlock: ['steelworks'], toolPower: 2.5 } },
  { id: 'steamPower', name: 'Parní síla', desc: 'Parní stroje: doly a lom ×2, +50 % těžby.', era: 4, cost: 12000, req: ['coalMining'], fx: { gather: 1.5, job: { copperMine: 2, ironMine: 2, coalMine: 2, quarry: 2 } } },
  { id: 'railways', name: 'Železnice', desc: 'Vlaky: +40 dosah dopravy. Odemyká nádraží.', era: 4, cost: 16000, req: ['steamPower'], fx: { haul: 40, unlock: ['trainStation'] } },
  { id: 'industrialization', name: 'Industrializace', desc: 'Odemyká továrny. Veškerá produkce ×1,5.', era: 4, cost: 20000, mats: { steel: 40 }, req: ['steel', 'steamPower'], fx: { unlock: ['factory'], global: 1.5 } },
  { id: 'electricity', name: 'Elektřina', desc: 'Odemyká elektrárnu — energie pro továrny.', era: 4, cost: 25000, req: ['industrialization'], fx: { unlock: ['powerPlant'] } },
  // éra 5 – moderna
  { id: 'electronicsTech', name: 'Elektronika', desc: 'Odemyká hi-tech laboratoř.', era: 5, cost: 60000, req: ['electricity'], fx: { unlock: ['hitechLab'] } },
  { id: 'sanitation', name: 'Hygiena', desc: 'Kanalizace a medicína: +10 % spokojenosti, růst ×1,5.', era: 5, cost: 70000, req: ['electricity'], fx: { hap: 0.1, growth: 1.5 } },
  { id: 'heavyMachinery', name: 'Těžké stroje', desc: 'Rypadla: doly a lom ×3, tábor ×2.', era: 5, cost: 80000, mats: { machinery: 20 }, req: ['electronicsTech'], fx: { job: { copperMine: 3, ironMine: 3, coalMine: 3, quarry: 3, forestCamp: 2 } } },
  { id: 'automation', name: 'Automatizace', desc: 'Veškerá produkce ×2.', era: 5, cost: 120000, mats: { machinery: 50 }, req: ['electronicsTech'], fx: { global: 2 } },
  // éra 6 – budoucnost
  { id: 'laserMining', name: 'Laserové těžební pušky', desc: 'Tvoji lidé těží LASERY. Těžba ×10, klik ×10. 🔴', era: 6, cost: 300000, mats: { electronics: 30 }, req: ['heavyMachinery', 'automation'], fx: { gather: 10, click: 10, special: 'laser' } },
  { id: 'rotorcraft', name: 'Vrtulníky', desc: 'Vzdálenost přestává existovat — vrtulníky přepraví vše. 🚁', era: 6, cost: 400000, mats: { electronics: 50 }, req: ['automation'], fx: { haul: 9999, special: 'heli' } },
  { id: 'robotics', name: 'Robotika', desc: 'Robotičtí pomocníci: veškerá produkce ×2.', era: 6, cost: 500000, mats: { electronics: 80 }, req: ['laserMining'], fx: { global: 2 } },
  { id: 'fusion', name: 'Fúze', desc: 'Elektrárny ×10 energie a už nepotřebují uhlí. ☀️', era: 6, cost: 800000, mats: { electronics: 120 }, req: ['robotics'], fx: { special: 'fusion' } },
  { id: 'transcendence', name: 'Transcendence', desc: 'Tvá civilizace je připravena vstoupit do dějin… Odemyká Vzestup.', era: 6, cost: 1000000, req: ['fusion', 'rotorcraft'], fx: { special: 'ascension' } },
];
export const TECH_BY: Record<string, TDef> = Object.fromEntries(TECHS.map(t => [t.id, t]));

// ---------- Upgrady ----------
export interface UDef {
  id: string; name: string; icon: string; desc: string;
  max: number; base: Rec; growth: number;
  reqTech?: string;
  fx: { job?: Record<string, number>; click?: number; capacity?: number; research?: number; hap?: number; housing?: number; growth?: number; haulX?: number; critChance?: number; goldenFreq?: number; kinetic?: number; special?: 'autoAssign' | 'sciPerTech' };
}

export const UPGRADES: UDef[] = [
  { id: 'sharpAxes', name: 'Ostré sekery', icon: '🪓', desc: 'Dřevorubci ×1,6 za úroveň.', max: 5, base: { wood: 100, stone: 40 }, growth: 4, fx: { job: { forestCamp: 1.6 } } },
  { id: 'sharpPicks', name: 'Tvrzené krumpáče', icon: '⛏️', desc: 'Lom a všechny doly ×1,6 za úroveň.', max: 5, base: { wood: 80, stone: 80 }, growth: 4, fx: { job: { quarry: 1.6, copperMine: 1.6, ironMine: 1.6, coalMine: 1.6 } } },
  { id: 'fertilizer', name: 'Hnojení', icon: '🌱', desc: 'Farmy ×1,6 a sběrači ×1,4 za úroveň.', max: 5, base: { food: 120, gold: 60 }, growth: 4, fx: { job: { farm: 1.6, gatherHut: 1.4 } } },
  { id: 'strongArms', name: 'Silné paže', icon: '💪', desc: 'Klik ×2 za úroveň.', max: 5, base: { wood: 80, food: 60 }, growth: 5, fx: { click: 2 } },
  { id: 'critMastery', name: 'Šťastná rána', icon: '🎯', desc: '+3 % šance na kritický klik (×10) za úroveň.', max: 3, base: { gold: 400 }, growth: 5, fx: { critChance: 0.03 } },
  { id: 'warehouses', name: 'Rozšíření skladů', icon: '📦', desc: 'Kapacita skladů ×1,6 za úroveň.', max: 5, base: { gold: 120, plank: 60 }, growth: 4, fx: { capacity: 1.6 } },
  { id: 'feasts', name: 'Hostiny', icon: '🍖', desc: '+6 % spokojenosti.', max: 1, base: { gold: 500, food: 400 }, growth: 1, fx: { hap: 0.06 } },
  { id: 'sciMethod', name: 'Vědecká metoda', icon: '🧪', desc: 'Věda ×1,5 a navíc +0,5 % za každou technologii.', max: 1, base: { gold: 900 }, growth: 1, fx: { research: 1.5, special: 'sciPerTech' } },
  { id: 'urbanism', name: 'Urbanismus', icon: '🏘️', desc: 'Bydlení +30 %, růst populace ×1,5.', max: 1, base: { gold: 1000, brick: 100 }, growth: 1, reqTech: 'masonry', fx: { housing: 1.3, growth: 1.5 } },
  { id: 'logistics', name: 'Logistická síť', icon: '🚚', desc: 'Dosah dopravy ×2.', max: 1, base: { gold: 1200 }, growth: 1, reqTech: 'roads', fx: { haulX: 2 } },
  { id: 'foreman', name: 'Předák', icon: '👷', desc: 'Automaticky přiřazuje volné obyvatele do práce.', max: 1, base: { gold: 1500 }, growth: 1, fx: { special: 'autoAssign' } },
  { id: 'goldRush', name: 'Zlatá horečka', icon: '🌟', desc: 'Zlatí občané chodí 2× častěji.', max: 1, base: { gold: 2000 }, growth: 1, fx: { goldenFreq: 2 } },
  { id: 'kineticClick', name: 'Kinetický klik', icon: '⚡', desc: 'Každý klik navíc přidá 2 % produkce dané suroviny za sekundu.', max: 1, base: { gold: 5000 }, growth: 1, reqTech: 'industrialization', fx: { kinetic: 0.02 } },
];
export const UPG_BY: Record<string, UDef> = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

// ---------- Achievementy (každý = +2 % globální produkce) ----------
export interface AchDef { id: string; name: string; desc: string; icon: string; cond: (g: any) => boolean }
export const ACH_BONUS = 0.02;

export const ACHS: AchDef[] = [
  { id: 'firstClick', name: 'První úder', desc: 'Klikni na surovinu.', icon: '👆', cond: g => g.s.clicks >= 1 },
  { id: 'clicker100', name: 'Pilný sběrač', desc: '100 kliknutí.', icon: '🖱️', cond: g => g.s.clicks >= 100 },
  { id: 'clicker5k', name: 'Mozolnaté ruce', desc: '5 000 kliknutí.', icon: '✊', cond: g => g.s.clicks >= 5000 },
  { id: 'firstHut', name: 'Domov', desc: 'Postav první chatrč.', icon: '🛖', cond: g => (g.bCount.hut || 0) + (g.bCount.house || 0) >= 1 },
  { id: 'pop10', name: 'Vesnička', desc: '10 obyvatel.', icon: '👥', cond: g => g.s.pop >= 10 },
  { id: 'pop50', name: 'Vesnice', desc: '50 obyvatel.', icon: '🏘️', cond: g => g.s.pop >= 50 },
  { id: 'pop200', name: 'Město', desc: '200 obyvatel.', icon: '🏙️', cond: g => g.s.pop >= 200 },
  { id: 'pop1000', name: 'Metropole', desc: '1 000 obyvatel.', icon: '🌆', cond: g => g.s.pop >= 1000 },
  { id: 'wood1k', name: 'Dřevorubec', desc: 'Nasbírej celkem 1 000 dřeva.', icon: '🪵', cond: g => (g.s.totals.wood || 0) >= 1000 },
  { id: 'wood100k', name: 'Odlesnění', desc: 'Nasbírej celkem 100 000 dřeva.', icon: '🌲', cond: g => (g.s.totals.wood || 0) >= 100000 },
  { id: 'stone10k', name: 'Kamenolam', desc: 'Nasbírej celkem 10 000 kamene.', icon: '🪨', cond: g => (g.s.totals.stone || 0) >= 10000 },
  { id: 'tools100', name: 'Vybavení', desc: 'Vyrob celkem 100 nástrojů.', icon: '🛠️', cond: g => (g.s.totals.tools || 0) >= 100 },
  { id: 'steel100', name: 'Ocelové srdce', desc: 'Vyrob celkem 100 oceli.', icon: '⛓️', cond: g => (g.s.totals.steel || 0) >= 100 },
  { id: 'gold1k', name: 'Bohatství', desc: 'Vydělej celkem 1 000 zlata.', icon: '💰', cond: g => (g.s.totals.gold || 0) >= 1000 },
  { id: 'tech1', name: 'Objevitel', desc: 'Vyzkoumej první technologii.', icon: '💡', cond: g => g.s.techs.length >= 1 },
  { id: 'tech10', name: 'Osvícenství', desc: 'Vyzkoumej 10 technologií.', icon: '🎓', cond: g => g.s.techs.length >= 10 },
  { id: 'tech20', name: 'Renesance', desc: 'Vyzkoumej 20 technologií.', icon: '🔭', cond: g => g.s.techs.length >= 20 },
  { id: 'era4', name: 'Průmyslová revoluce', desc: 'Dosáhni éry Průmyslu.', icon: '🏭', cond: g => g.maxEra >= 4 },
  { id: 'era6', name: 'Budoucnost je teď', desc: 'Dosáhni éry Budoucnosti.', icon: '🚀', cond: g => g.maxEra >= 6 },
  { id: 'happy', name: 'Ráj na zemi', desc: 'Spokojenost 90 % a víc.', icon: '😊', cond: g => g.happiness >= 0.9 },
  { id: 'monumental', name: 'Monumentální', desc: 'Postav monument.', icon: '🗿', cond: g => (g.bCount.monument || 0) >= 1 },
  { id: 'golden5', name: 'Lovec štěstí', desc: 'Chyť 5 zlatých občanů.', icon: '🌟', cond: g => (g.s.stats.goldenClicked || 0) >= 5 },
  { id: 'ascend1', name: 'Vzestup', desc: 'Proveď první Vzestup.', icon: '✨', cond: g => (g.s.stats.ascensions || 0) >= 1 },
];

// ---------- Ascension perky ----------
export interface PerkDef { id: string; name: string; icon: string; desc: string; max: number; baseCost: number; costGrowth: number }
export const PERKS: PerkDef[] = [
  { id: 'prosperity', name: 'Prosperita', icon: '🌟', desc: 'Veškerá produkce ×1,25 za úroveň.', max: 10, baseCost: 1, costGrowth: 2 },
  { id: 'firmHand', name: 'Pevná ruka', icon: '💪', desc: 'Klik ×1,6 za úroveň.', max: 5, baseCost: 1, costGrowth: 2 },
  { id: 'wisdom', name: 'Učenost', icon: '📜', desc: 'Věda ×1,3 za úroveň.', max: 5, baseCost: 1, costGrowth: 2 },
  { id: 'heritage', name: 'Zásoby předků', icon: '🎁', desc: 'Start s +200 dřeva/jídla/kamene a +2 obyvateli za úroveň.', max: 3, baseCost: 2, costGrowth: 2 },
  { id: 'eternalFlame', name: 'Věčný oheň', icon: '🔥', desc: 'Offline efektivita +15 % a limit +4 h za úroveň.', max: 3, baseCost: 2, costGrowth: 2 },
  { id: 'headStart', name: 'Rychlý rozjezd', icon: '🚀', desc: 'Začínáš s technologiemi doby kamenné a 100 vědy.', max: 1, baseCost: 3, costGrowth: 1 },
];
export const PERK_BY: Record<string, PerkDef> = Object.fromEntries(PERKS.map(p => [p.id, p]));

// ---------- Surovinové uzly na mapě ----------
export interface NodeDef { res: string; max: number; renew: number; name: string }
export const NODE_DEFS: NodeDef[] = [
  { res: 'wood', max: 40, renew: 0.05, name: 'Strom' },
  { res: 'food', max: 30, renew: 0.06, name: 'Keř s bobulemi' },
  { res: 'stone', max: 60, renew: 0.02, name: 'Balvan' },
  { res: 'copperOre', max: 250, renew: 0, name: 'Měděná žíla' },
  { res: 'ironOre', max: 250, renew: 0, name: 'Železná žíla' },
  { res: 'coal', max: 300, renew: 0, name: 'Uhelná sloj' },
];
export const N_TREE = 0, N_BERRY = 1, N_ROCK = 2, N_COPPER = 3, N_IRON = 4, N_COAL = 5;

/** ručně umístěné uzly kolem startu, ať má hráč vždy co klikat */
export const FORCED_NODES: [number, number, number][] = [
  [3, 1, N_TREE], [4, 3, N_TREE], [2, 4, N_TREE], [-4, 2, N_TREE], [6, 5, N_TREE], [-5, 4, N_TREE], [-6, -3, N_TREE],
  [-3, -3, N_BERRY], [4, -2, N_BERRY], [-2, 6, N_BERRY], [2, -5, N_BERRY],
  [1, -4, N_ROCK], [-4, -1, N_ROCK], [5, -5, N_ROCK], [7, 2, N_ROCK],
];
