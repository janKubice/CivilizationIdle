// ===== Procedurální nekonečný svět: chunky, biomy, surovinové uzly =====
// (viz docs/02-world-and-map.md) — deterministické ze seedu, ukládají se jen delty.

import { CHUNK, B_WATER, B_SAND, B_GRASS, B_FOREST, B_HILLS, B_MOUNTAIN } from './config';
import { fbm, hash2, clamp, lerp, key } from './util';
import { NODE_DEFS, FORCED_NODES, N_TREE, N_BERRY, N_ROCK, N_COPPER, N_IRON, N_COAL, N_FISH } from './data';

export interface NodeInst {
  idx: number;          // index v chunk.nodes (klíč pro deltu)
  tx: number; ty: number;
  kind: number;         // index do NODE_DEFS
  stock: number;
  variant: number;      // vizuální varianta
}

export interface Chunk {
  cx: number; cy: number;
  tiles: Uint8Array;               // biome per tile
  nodes: NodeInst[];
  nodeMap: Map<string, NodeInst>;  // "tx,ty" -> node
  avg: string;                     // průměrná barva pro minimapu
}

const FORCED = new Map<string, number>(FORCED_NODES.map(([x, y, k]) => [key(x, y), k]));

export class World {
  seed: number;
  chunks = new Map<string, Chunk>();
  /** obsazenost dlaždic budovami: "tx,ty" -> index budovy */
  occ = new Map<string, number>();
  /** cesty */
  roads = new Set<string>();
  /** železniční koleje */
  rails = new Set<string>();
  /** reference na delty ze save (mutujeme přímo) */
  nodeDelta: Record<string, Record<number, number>>;

  constructor(seed: number, nodeDelta: Record<string, Record<number, number>>, roads: string[], rails: string[] = []) {
    this.seed = seed;
    this.nodeDelta = nodeDelta;
    this.roads = new Set(roads);
    this.rails = new Set(rails);
  }

  elevation(tx: number, ty: number): number {
    let e = fbm(this.seed, tx / 46, ty / 46, 4);
    let m = fbm(this.seed + 7777, tx / 31, ty / 31, 3);
    // vyrovnání startu: kolem počátku vždy tráva
    const d = Math.hypot(tx, ty);
    if (d < 16) { e = lerp(0.5, e, clamp(d / 16, 0, 1)); m = lerp(0.4, m, clamp(d / 16, 0, 1)); }
    return e * 1000 + m; // zakódované obě hodnoty? ne – viz biome()
  }

  biome(tx: number, ty: number): number {
    let e = fbm(this.seed, tx / 46, ty / 46, 4);
    let mo = fbm(this.seed + 7777, tx / 31, ty / 31, 3);
    const d = Math.hypot(tx, ty);
    if (d < 16) { e = lerp(0.5, e, clamp(d / 16, 0, 1)); mo = lerp(0.4, mo, clamp(d / 16, 0, 1)); }
    if (e < 0.34) return B_WATER;
    if (e < 0.37) return B_SAND;
    if (e > 0.78) return B_MOUNTAIN;
    if (e > 0.62) return B_HILLS;
    return mo > 0.56 ? B_FOREST : B_GRASS;
  }

  chunk(cx: number, cy: number): Chunk {
    const k = key(cx, cy);
    let c = this.chunks.get(k);
    if (c) return c;
    c = this.generate(cx, cy);
    this.chunks.set(k, c);
    return c;
  }

  private generate(cx: number, cy: number): Chunk {
    const tiles = new Uint8Array(CHUNK * CHUNK);
    const nodes: NodeInst[] = [];
    const nodeMap = new Map<string, NodeInst>();
    let rSum = 0, gSum = 0, bSum = 0;
    const colors = [[46, 95, 138], [201, 180, 124], [93, 138, 74], [74, 116, 64], [125, 127, 106], [154, 154, 160]];

    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
        let b = this.biome(tx, ty);
        const fk = key(tx, ty);
        const forced = FORCED.get(fk);
        if (forced !== undefined && (b === B_WATER || b === B_MOUNTAIN)) b = B_GRASS;
        tiles[ly * CHUNK + lx] = b;
        const col = colors[b]; rSum += col[0]; gSum += col[1]; bSum += col[2];

        // uzly
        let kind = -1;
        if (forced !== undefined) kind = forced;
        else {
          const r = hash2(this.seed ^ 0x9e3779b9, tx, ty);
          const dist = Math.hypot(tx, ty);
          if (b === B_WATER && r < 0.02) kind = N_FISH;
          else if (b === B_FOREST && r < 0.26) kind = N_TREE;
          else if (b === B_GRASS) {
            if (r < 0.010) kind = N_BERRY;
            else if (r < 0.017) kind = N_ROCK;
            else if (r < 0.021 && dist > 25) kind = N_COPPER;
            else if (r < 0.024 && dist > 55) kind = N_IRON;
            else if (r < 0.027 && dist > 85) kind = N_COAL;
          } else if (b === B_HILLS) {
            if (r < 0.05) kind = N_ROCK;
            else if (r < 0.075 && dist > 18) kind = N_COPPER;
            else if (r < 0.095 && dist > 40) kind = N_IRON;
            else if (r < 0.115 && dist > 60) kind = N_COAL;
          }
        }
        if (kind >= 0) {
          const def = NODE_DEFS[kind];
          const node: NodeInst = { idx: nodes.length, tx, ty, kind, stock: def.max, variant: Math.floor(hash2(this.seed ^ 0x51ed, tx, ty) * 3) };
          nodes.push(node);
          nodeMap.set(fk, node);
        }
      }
    }

    // aplikuj deltu ze save
    const dk = key(cx, cy);
    const delta = this.nodeDelta[dk];
    if (delta) for (const [idxS, stock] of Object.entries(delta)) {
      const n = nodes[Number(idxS)];
      if (n) n.stock = stock as number;
    }

    const n2 = CHUNK * CHUNK;
    const avg = `rgb(${Math.round(rSum / n2)},${Math.round(gSum / n2)},${Math.round(bSum / n2)})`;
    return { cx, cy, tiles, nodes, nodeMap, avg };
  }

  biomeAt(tx: number, ty: number): number {
    const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
    const c = this.chunk(cx, cy);
    return c.tiles[(ty - cy * CHUNK) * CHUNK + (tx - cx * CHUNK)];
  }

  nodeAt(tx: number, ty: number): NodeInst | undefined {
    const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
    return this.chunk(cx, cy).nodeMap.get(key(tx, ty));
  }

  /** lze na dlaždici stavět? */
  buildable(tx: number, ty: number): boolean {
    const b = this.biomeAt(tx, ty);
    if (b === B_WATER || b === B_MOUNTAIN) return false;
    const k = key(tx, ty);
    if (this.occ.has(k) || this.roads.has(k)) return false;
    if (this.nodeAt(tx, ty)) return false;
    return true;
  }

  /** zapiš změnu stavu uzlu do delty */
  writeDelta(node: NodeInst) {
    const cx = Math.floor(node.tx / CHUNK), cy = Math.floor(node.ty / CHUNK);
    const dk = key(cx, cy);
    const def = NODE_DEFS[node.kind];
    let d = this.nodeDelta[dk];
    if (node.stock >= def.max) {
      if (d) { delete d[node.idx]; if (Object.keys(d).length === 0) delete this.nodeDelta[dk]; }
      return;
    }
    if (!d) { d = {}; this.nodeDelta[dk] = d; }
    d[node.idx] = Math.round(node.stock * 10) / 10;
  }

  /** regenerace obnovitelných uzlů v načtených chuncích */
  regen(seconds: number) {
    for (const c of this.chunks.values()) {
      for (const n of c.nodes) {
        const def = NODE_DEFS[n.kind];
        if (def.renew > 0 && n.stock < def.max) {
          n.stock = Math.min(def.max, n.stock + def.renew * seconds);
          this.writeDelta(n);
        }
      }
    }
  }

  /** drž počet cache chunků rozumný (delty jsou v save, nic se neztratí) */
  trim(centerCx: number, centerCy: number) {
    if (this.chunks.size <= 160) return;
    const arr = [...this.chunks.entries()];
    arr.sort((a, b) => {
      const da = Math.abs(a[1].cx - centerCx) + Math.abs(a[1].cy - centerCy);
      const db = Math.abs(b[1].cx - centerCx) + Math.abs(b[1].cy - centerCy);
      return db - da;
    });
    for (let i = 0; i < arr.length - 130; i++) this.chunks.delete(arr[i][0]);
  }

  rebuildOcc(buildings: { t: string; x: number; y: number }[], sizes: Record<string, number>) {
    this.occ.clear();
    buildings.forEach((b, i) => {
      const s = sizes[b.t] || 1;
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) this.occ.set(key(b.x + dx, b.y + dy), i);
    });
  }
}
