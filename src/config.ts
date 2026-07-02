// ===== globální konstanty =====
export const VERSION = 1;
export const TILE = 32;            // px na dlaždici (svět, zoom 1)
export const CHUNK = 32;           // dlaždic na chunk
export const CHUNK_PX = TILE * CHUNK;
export const SIM_DT = 0.1;         // s – fixní krok simulace (10 Hz)
export const MAX_AGENTS = 240;     // cap viditelných postaviček
export const MAX_PARTICLES = 600;
export const OFFLINE_MIN = 90;     // s – od kdy se počítá offline progres s modalem
export const SAVE_KEY = 'civIdle.save.v1';

export const ERA_NAMES = [
  'Doba kamenná', 'Doba bronzová', 'Antika', 'Středověk', 'Průmysl', 'Moderna', 'Budoucnost',
];

// biomy
export const B_WATER = 0, B_SAND = 1, B_GRASS = 2, B_FOREST = 3, B_HILLS = 4, B_MOUNTAIN = 5;
export const BIOME_COLORS = ['#2e5f8a', '#c9b47c', '#5d8a4a', '#4a7440', '#7d7f6a', '#9a9aa0'];
