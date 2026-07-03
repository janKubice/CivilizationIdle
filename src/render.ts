// ===== Renderer: canvas 2D, chunk cache, LOD agenti, particly, den/noc =====
// Prezentační vrstva — čte stav, nikdy ho nemění. Viz docs/11-technical-architecture.md.

import { TILE, CHUNK, CHUNK_PX, BIOME_COLORS, B_WATER, MAX_AGENTS, MAX_PARTICLES } from './config';
import { clamp, lerp, hash2, key, bus, fmt } from './util';
import { B, BUILDINGS, RES_BY, NODE_DEFS, N_TREE, N_BERRY, N_ROCK, N_COPPER, N_IRON, N_COAL, N_FISH, SEASON_ICONS } from './data';
import { Game, BuildingInst, activeWorkers, slots } from './state';
import { hasTech } from './sim';
import { sprites, makeSprites, NIGHT_WINDOWS } from './sprites';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface FloatText { x: number; y: number; text: string; color: string; life: number; big: boolean }
interface Agent {
  bIdx: number;            // index budovy
  x: number; y: number;    // world px
  path: [number, number][];// body cesty (world px)
  seg: number; t: number;  // segment + progres
  state: 'walk' | 'work' | 'back' | 'idle' | 'loop';
  timer: number;
  color: string; carry: string | null;
  speed: number; variant: number;
  kind?: 'horse' | 'tractor' | 'boat';   // vozidla/zvířata/loďky
}
interface Bird { x: number; y: number; vx: number; ph: number }
interface Train { path: [number, number][]; dist: number; dir: 1 | -1; pause: number; len: number }
interface Flake { x: number; y: number; vy: number; vx: number; ph: number }
interface Heli { x: number; y: number; tx: number; ty: number; rot: number }

const AGENT_COLORS: Record<string, string> = {
  forestCamp: '#4a8040', gatherHut: '#c9a83e', quarry: '#8d939c', farm: '#7fb356',
  copperMine: '#e08d4f', ironMine: '#c8cdd8', coalMine: '#454a52', sawmill: '#c08a4e',
  smelter: '#e88a2a', workshop: '#e8c46a', market: '#ffd777', library: '#8fb8ff',
  ironworks: '#a8adba', brickworks: '#c4593e', steelworks: '#c8d2e0', powerPlant: '#ffe14a',
  factory: '#9fb4d8', hitechLab: '#6fd8c8', trainStation: '#b8a97e', idle: '#d8c8b0',
};

const NODE_SPRITES = ['tree', 'berry', 'rock', 'copperVein', 'ironVein', 'coalVein', 'fishShoal'];

export class Renderer {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cam = { x: 0, y: 0, z: 1 };
  mouse = { sx: 0, sy: 0, tx: 0, ty: 0, over: false };
  W = 0; H = 0; dpr = 1;

  private chunkCache = new Map<string, HTMLCanvasElement>();
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  /** perzistentní agenti s identitou — brání "teleportům" při re-syncu */
  private agentMap = new Map<string, Agent>();
  private helis: Heli[] = [];
  private birds: Bird[] = [];
  private birdTimer = 8;
  private trains: Train[] = [];
  private trainStations = -1;
  private precip: Flake[] = [];
  private agentSync = 0;
  private mini: HTMLCanvasElement | null = null;
  private miniTimer = 0;
  private g: Game;

  constructor(canvas: HTMLCanvasElement, g: Game) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.g = g;
    makeSprites();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    bus.on('gather', (e: any) => {
      const wx = e.tx * TILE + TILE / 2, wy = e.ty * TILE + TILE / 2;
      this.float(wx, wy, `+${fmt(e.amt)}`, RES_BY[e.res]?.color || '#fff', e.crit);
      if (this.g.s.settings.particles) this.burst(wx, wy, RES_BY[e.res]?.color || '#fff', e.crit ? 14 : 6);
    });
    bus.on('built', (e: any) => {
      const wx = e.x * TILE + TILE / 2, wy = e.y * TILE + TILE / 2;
      if (this.g.s.settings.particles) this.burst(wx, wy, '#d8c8a0', 10);
      // agenti zůstávají — sync jen přidá nové (indexy budov se stavbou nemění)
    });
    bus.on('demolished', () => { this.agentMap.clear(); }); // indexy budov se posunuly
    bus.on('merged', () => { this.agentMap.clear(); });
    bus.on('festival', () => {
      for (let i = 0; i < 40; i++) this.burst(Math.random() * 200 - 100, Math.random() * 200 - 100, ['#d84848', '#ffd777', '#4a8040', '#8fb8ff'][i % 4], 2);
    });
    bus.on('ascend', () => this.reset());
    bus.on('worldReset', () => this.reset());
  }

  reset() {
    this.chunkCache.clear();
    this.particles.length = 0; this.floats.length = 0; this.agentMap.clear(); this.helis.length = 0;
    this.cam.x = 0; this.cam.y = 0; this.cam.z = 1;
  }

  setMinimap(cv: HTMLCanvasElement) { this.mini = cv; }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr;
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.W / 2) / this.cam.z + this.cam.x, (sy - this.H / 2) / this.cam.z + this.cam.y];
  }
  worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.cam.x) * this.cam.z + this.W / 2, (wy - this.cam.y) * this.cam.z + this.H / 2];
  }

  float(wx: number, wy: number, text: string, color: string, big = false) {
    if (this.floats.length > 40) this.floats.shift();
    this.floats.push({ x: wx + (Math.random() - 0.5) * 10, y: wy - 10, text, color, life: 1, big });
  }
  burst(wx: number, wy: number, color: string, n: number) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * 6.28, sp = 20 + Math.random() * 60;
      this.particles.push({ x: wx, y: wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 1, max: 0.5 + Math.random() * 0.5, color, size: 1.5 + Math.random() * 2 });
    }
  }

  // ---------- chunk terén ----------
  private chunkCanvas(cx: number, cy: number): HTMLCanvasElement {
    const k = key(cx, cy);
    let cc = this.chunkCache.get(k);
    if (cc) return cc;
    const chunk = this.g.world.chunk(cx, cy);
    const res = 8; // px per tile v cache
    cc = document.createElement('canvas');
    cc.width = CHUNK * res; cc.height = CHUNK * res;
    const x = cc.getContext('2d')!;
    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const b = chunk.tiles[ly * CHUNK + lx];
        const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
        x.fillStyle = BIOME_COLORS[b];
        x.fillRect(lx * res, ly * res, res, res);
        // jemná variace
        const h = hash2(1234, tx, ty);
        x.fillStyle = h > 0.5 ? '#ffffff08' : '#00000010';
        x.fillRect(lx * res, ly * res, res, res);
        if (b === B_WATER && h > 0.8) { x.fillStyle = '#ffffff20'; x.fillRect(lx * res + 2, ly * res + 3, 4, 1); }
      }
    }
    if (this.chunkCache.size > 80) {
      const first = this.chunkCache.keys().next().value;
      if (first) this.chunkCache.delete(first);
    }
    this.chunkCache.set(k, cc);
    return cc;
  }

  // ---------- agenti (LOD: jen viditelní; perzistentní identita) ----------
  private syncAgents(g: Game) {
    const view = this.viewBounds(1.5);
    const wanted = new Set<string>();
    let budget = MAX_AGENTS;

    // pracovníci u viditelných budov
    for (let i = 0; i < g.s.buildings.length && budget > 0; i++) {
      const b = g.s.buildings[i];
      const def = B[b.t];
      if (!def.jobs) continue;
      const wx = b.x * TILE, wy = b.y * TILE;
      if (wx < view[0] || wx > view[2] || wy < view[1] || wy > view[3]) continue;
      const act = activeWorkers(g, b.t);
      if (!act) continue;
      const perB = Math.max(0, Math.min(2, Math.round(act / Math.max(1, g.bCount[b.t] || 1))));
      for (let a = 0; a < perB && budget > 0; a++, budget--) {
        const k = `w:${i}:${a}`;
        wanted.add(k);
        if (!this.agentMap.has(k)) this.agentMap.set(k, this.makeAgent(g, i, a));
      }
    }
    // loďky rybářů
    for (let i = 0; i < g.s.buildings.length && budget > 0; i++) {
      const b = g.s.buildings[i];
      if (b.t !== 'fishHut' || !activeWorkers(g, 'fishHut')) continue;
      const wx = b.x * TILE, wy = b.y * TILE;
      if (wx < view[0] || wx > view[2] || wy < view[1] || wy > view[3]) continue;
      const k = `boat:${i}`;
      wanted.add(k); budget--;
      if (!this.agentMap.has(k)) {
        // najdi vodu poblíž (cíl vyjížďky)
        let target: [number, number] | null = null;
        outer: for (let r = 2; r <= 7; r++) for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * 6.28;
          const tx2 = b.x + Math.round(Math.cos(ang) * r), ty2 = b.y + Math.round(Math.sin(ang) * r);
          if (g.world.biomeAt(tx2, ty2) === 0) { target = [tx2 * TILE + TILE / 2, ty2 * TILE + TILE / 2]; break outer; }
        }
        if (target) {
          this.agentMap.set(k, {
            bIdx: i, x: wx + TILE / 2, y: wy + TILE / 2,
            path: [[wx + TILE / 2, wy + TILE / 2], target],
            seg: 0, t: Math.random(), state: 'loop', timer: 0,
            color: '#8a6b42', carry: null, speed: 20, variant: 0, kind: 'boat',
          });
        }
      }
    }
    // koně / traktory na velkostatcích (velké farmy)
    const tractor = hasTech(g.s, 'heavyMachinery');
    for (let i = 0; i < g.s.buildings.length && budget > 0; i++) {
      const b = g.s.buildings[i];
      if (!b.big || b.t !== 'farm') continue;
      const wx = b.x * TILE, wy = b.y * TILE;
      if (wx < view[0] || wx > view[2] || wy < view[1] || wy > view[3]) continue;
      const k = `v:${i}`;
      wanted.add(k); budget--;
      if (!this.agentMap.has(k)) {
        const pad = 6;
        const p: [number, number][] = [
          [wx - pad, wy - pad], [wx + 2 * TILE + pad, wy - pad],
          [wx + 2 * TILE + pad, wy + 2 * TILE + pad], [wx - pad, wy + 2 * TILE + pad],
        ];
        this.agentMap.set(k, {
          bIdx: i, x: p[0][0], y: p[0][1], path: p, seg: 0, t: Math.random(),
          state: 'loop', timer: 0, color: '#8a5a2a', carry: null,
          speed: tractor ? 46 : 26, variant: 0, kind: tractor ? 'tractor' : 'horse',
        });
      }
    }
    // zahaleči kolem návsi
    const idle = Math.min(8, g.s.pop - Object.values(g.s.assigned).reduce((a, v) => a + v, 0));
    for (let i = 0; i < idle && budget > 0; i++, budget--) {
      const k = `i:${i}`;
      wanted.add(k);
      if (!this.agentMap.has(k)) this.agentMap.set(k, this.makeIdleAgent(g, i));
    }
    // odeber už nechtěné (odpřiřazení, mimo dosah) — existující pokračují bez skoku
    for (const k of this.agentMap.keys()) if (!wanted.has(k)) this.agentMap.delete(k);

    // vrtulníky
    if (hasTech(g.s, 'rotorcraft')) {
      while (this.helis.length < 2) this.helis.push({ x: 0, y: 0, tx: (Math.random() - 0.5) * 1500, ty: (Math.random() - 0.5) * 1500, rot: 0 });
    } else this.helis.length = 0;
  }

  private makeAgent(g: Game, bIdx: number, n: number): Agent {
    const b = g.s.buildings[bIdx];
    const def = B[b.t];
    const size = def.size * TILE;
    const hx = b.x * TILE + size / 2, hy = b.y * TILE + size + 4;
    // cíl: nejbližší sklad / náves (L-cesta)
    let dx = -TILE / 2, dy = -TILE / 2, bd = Infinity;
    for (const o of g.s.buildings) {
      if (o.t !== 'storehouse' && o.t !== 'plaza') continue;
      const d = Math.abs(o.x - b.x) + Math.abs(o.y - b.y);
      if (d < bd) { bd = d; dx = o.x * TILE + TILE / 2; dy = o.y * TILE + TILE / 2 + (B[o.t].size * TILE) / 2; }
    }
    const midX = dx, midY = hy;
    const phase = hash2(99, bIdx, n);
    return {
      bIdx, x: hx, y: hy,
      path: [[hx, hy], [midX, midY], [dx, dy]],
      seg: 0, t: phase, state: phase > 0.5 ? 'work' : 'walk', timer: phase * 3,
      color: AGENT_COLORS[b.t] || '#d8c8b0', carry: null,
      speed: 55 + hash2(7, bIdx, n) * 25, variant: (bIdx + n) % 4,
    };
  }

  private makeIdleAgent(g: Game, n: number): Agent {
    const roads = g.s.roads;
    const pick = roads.length ? roads[(n * 7) % roads.length] : '2,2';
    const [rx, ry] = pick.split(',').map(Number);
    const x0 = rx * TILE + TILE / 2, y0 = ry * TILE + TILE / 2;
    return {
      bIdx: -1, x: x0, y: y0,
      path: [[x0, y0], [x0 + (Math.random() - 0.5) * 150, y0 + (Math.random() - 0.5) * 150]],
      seg: 0, t: Math.random(), state: 'idle', timer: 0,
      color: AGENT_COLORS.idle, carry: null, speed: 30, variant: n % 4,
    };
  }

  private updateAgents(g: Game, dt: number) {
    for (const a of this.agentMap.values()) {
      if (a.state === 'loop') {
        // vozidla objíždějí dokola (kůň s pluhem / traktor)
        const p0 = a.path[a.seg % a.path.length];
        const p1 = a.path[(a.seg + 1) % a.path.length];
        const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
        a.t += (a.speed * dt) / segLen;
        if (a.t >= 1) { a.seg = (a.seg + 1) % a.path.length; a.t = 0; }
        else { a.x = lerp(p0[0], p1[0], a.t); a.y = lerp(p0[1], p1[1], a.t); }
        continue;
      }
      if (a.state === 'work') {
        a.timer -= dt;
        if (a.timer <= 0) { a.state = 'walk'; a.seg = 0; a.t = 0; a.carry = a.bIdx >= 0 ? (B[g.s.buildings[a.bIdx]?.t]?.prod?.res ?? 'wood') : null; }
        continue;
      }
      const path = a.state === 'back' ? [...a.path].reverse() : a.path;
      const p0 = path[a.seg], p1 = path[a.seg + 1];
      if (!p0 || !p1) { // konec cesty
        if (a.state === 'walk') { a.state = 'back'; a.seg = 0; a.t = 0; a.carry = null; }
        else if (a.state === 'back') { a.state = 'work'; a.timer = 2 + Math.random() * 2; }
        else { // idle: nová náhodná procházka
          a.path = [[a.x, a.y], [a.x + (Math.random() - 0.5) * 150, a.y + (Math.random() - 0.5) * 150]];
          a.seg = 0; a.t = 0;
        }
        continue;
      }
      const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      a.t += (a.speed * dt) / segLen;
      if (a.t >= 1) { a.seg++; a.t = 0; }
      else { a.x = lerp(p0[0], p1[0], a.t); a.y = lerp(p0[1], p1[1], a.t); }
    }
    // vrtulníky
    for (const h of this.helis) {
      const dx = h.tx - h.x, dy = h.ty - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 30) { h.tx = (Math.random() - 0.5) * 2000; h.ty = (Math.random() - 0.5) * 2000; }
      else { h.x += (dx / d) * 160 * dt; h.y += (dy / d) * 160 * dt; }
      h.rot += dt * 25;
    }
  }

  private viewBounds(pad = 1): [number, number, number, number] {
    const hw = (this.W / 2 / this.cam.z) * pad, hh = (this.H / 2 / this.cam.z) * pad;
    return [this.cam.x - hw, this.cam.y - hh, this.cam.x + hw, this.cam.y + hh];
  }

  // ---------- hlavní frame ----------
  frame(g: Game, dt: number, now: number) {
    const x = this.ctx;
    const z = this.cam.z;
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    x.imageSmoothingEnabled = false;

    // --- terén ---
    const [vx0, vy0, vx1, vy1] = this.viewBounds();
    const c0x = Math.floor(vx0 / CHUNK_PX), c0y = Math.floor(vy0 / CHUNK_PX);
    const c1x = Math.floor(vx1 / CHUNK_PX), c1y = Math.floor(vy1 / CHUNK_PX);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const cc = this.chunkCanvas(cx, cy);
        const [sx, sy] = this.worldToScreen(cx * CHUNK_PX, cy * CHUNK_PX);
        x.drawImage(cc, sx, sy, CHUNK_PX * z + 0.5, CHUNK_PX * z + 0.5);
      }
    }

    // --- cesty (autotiling: užší jádro + spoje jen ke skutečným sousedům) ---
    const t0x = Math.floor(vx0 / TILE), t0y = Math.floor(vy0 / TILE);
    const t1x = Math.floor(vx1 / TILE), t1y = Math.floor(vy1 / TILE);
    const visRoads: [number, number][] = [];
    for (const rk of g.world.roads) {
      const ci = rk.indexOf(',');
      const tx = +rk.slice(0, ci), ty = +rk.slice(ci + 1);
      if (tx < t0x || tx > t1x || ty < t0y || ty > t1y) continue;
      visRoads.push([tx, ty]);
    }
    const hasRoad = (tx: number, ty: number) => g.world.roads.has(key(tx, ty));
    for (const pass of [{ inset: 5, col: '#8a7a58' }, { inset: 8, col: '#b0a077' }]) {
      x.fillStyle = pass.col;
      const ins = pass.inset * z, core = (TILE - 2 * pass.inset) * z;
      for (const [tx, ty] of visRoads) {
        const [sx, sy] = this.worldToScreen(tx * TILE, ty * TILE);
        x.fillRect(sx + ins, sy + ins, core, core);
        if (hasRoad(tx + 1, ty)) x.fillRect(sx + ins + core, sy + ins, ins * 2 + 0.5, core);
        if (hasRoad(tx - 1, ty)) x.fillRect(sx - 0.25, sy + ins, ins, core);
        if (hasRoad(tx, ty + 1)) x.fillRect(sx + ins, sy + ins + core, core, ins * 2 + 0.5);
        if (hasRoad(tx, ty - 1)) x.fillRect(sx + ins, sy - 0.25, core, ins);
      }
    }

    // --- koleje (pražce + dvě kolejnice ke skutečným sousedům) ---
    if (g.world.rails.size) {
      const hasRail = (tx: number, ty: number) => g.world.rails.has(key(tx, ty));
      for (const rk of g.world.rails) {
        const ci = rk.indexOf(',');
        const tx = +rk.slice(0, ci), ty = +rk.slice(ci + 1);
        if (tx < t0x || tx > t1x || ty < t0y || ty > t1y) continue;
        const [sx, sy] = this.worldToScreen(tx * TILE, ty * TILE);
        const T = TILE * z, mid = T / 2;
        const horiz = hasRail(tx + 1, ty) || hasRail(tx - 1, ty);
        const vert = hasRail(tx, ty + 1) || hasRail(tx, ty - 1);
        x.fillStyle = '#5a4a38';
        if (horiz || !vert) for (let i = 0; i < 4; i++) x.fillRect(sx + (i + 0.25) * T / 4, sy + mid - 6 * z, 2.5 * z, 12 * z);
        if (vert) for (let i = 0; i < 4; i++) x.fillRect(sx + mid - 6 * z, sy + (i + 0.25) * T / 4, 12 * z, 2.5 * z);
        x.fillStyle = '#8d939c';
        if (horiz || !vert) { x.fillRect(sx, sy + mid - 4 * z, T, 1.6 * z); x.fillRect(sx, sy + mid + 3 * z, T, 1.6 * z); }
        if (vert) { x.fillRect(sx + mid - 4 * z, sy, 1.6 * z, T); x.fillRect(sx + mid + 3 * z, sy, 1.6 * z, T); }
      }
    }

    // --- uzly ---
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const chunk = g.world.chunk(cx, cy);
      for (const n of chunk.nodes) {
        if (n.tx < t0x - 1 || n.tx > t1x + 1 || n.ty < t0y - 2 || n.ty > t1y + 1) continue;
        let sp: HTMLCanvasElement;
        if (n.stock <= 0.5) {
          sp = n.kind === N_TREE ? sprites.stump : n.kind === N_BERRY ? sprites.berryEmpty : n.kind === N_ROCK ? sprites.rock : n.kind === N_FISH ? sprites.fishEmpty : sprites.veinEmpty;
        } else {
          sp = n.kind === N_TREE ? sprites['tree' + n.variant] : sprites[NODE_SPRITES[n.kind]];
        }
        const [sx, sy] = this.worldToScreen(n.tx * TILE, n.ty * TILE - 8);
        x.globalAlpha = n.stock <= 0.5 && n.kind >= N_COPPER ? 0.6 : 1;
        x.drawImage(sp, sx, sy, TILE * z, 40 * z * (TILE / 32));
        x.globalAlpha = 1;
      }
    }

    // --- budovy (painter podle y) ---
    const night = this.nightFactor(now, g);
    const visB: { b: BuildingInst; i: number }[] = [];
    for (let i = 0; i < g.s.buildings.length; i++) {
      const b = g.s.buildings[i];
      const def = B[b.t];
      const wx = b.x * TILE, wy = b.y * TILE;
      if (wx > vx1 + TILE * 2 || wx + def.size * TILE < vx0 - TILE || wy > vy1 + TILE || wy + def.size * TILE < vy0 - TILE * 2) continue;
      visB.push({ b, i });
    }
    visB.sort((p, q) => p.b.y - q.b.y);
    for (const { b } of visB) {
      const def = B[b.t];
      const size = b.big ? 2 : def.size;
      const sp = (b.big && sprites['big:' + b.t]) || sprites[b.t];
      if (!sp) continue;
      const sh = size === 2 ? 80 : 44;
      const [sx, sy] = this.worldToScreen(b.x * TILE, b.y * TILE - (sh - size * TILE));
      x.drawImage(sp, sx, sy, size * TILE * z, sh * z);
      // pipsy úrovně (zlaté kosočtverce nad budovou)
      if (b.lvl && b.lvl > 1) {
        x.fillStyle = '#ffd74a';
        for (let p = 0; p < b.lvl - 1; p++) {
          const px0 = sx + (size * TILE * z) / 2 + (p - (b.lvl - 2) / 2) * 8 * z;
          const py0 = sy - 3 * z;
          x.beginPath();
          x.moveTo(px0, py0 - 3.5 * z); x.lineTo(px0 + 3 * z, py0);
          x.lineTo(px0, py0 + 3.5 * z); x.lineTo(px0 - 3 * z, py0);
          x.fill();
        }
      }
      // noční okna
      if (night > 0.45) {
        const wins = NIGHT_WINDOWS[b.t];
        if (wins) {
          x.fillStyle = `rgba(255,214,90,${0.85 * night})`;
          for (const [wxp, wyp] of wins) {
            const [wsx, wsy] = this.worldToScreen(b.x * TILE + wxp, b.y * TILE - (sh - def.size * TILE) + wyp);
            x.fillRect(wsx, wsy, 4 * z, 4 * z);
          }
        }
      }
      // kouř z komínů
      if (g.s.settings.particles && (b.t === 'smelter' || b.t === 'ironworks' || b.t === 'steelworks' || b.t === 'factory') && Math.random() < 0.06) {
        this.particles.push({ x: b.x * TILE + 22, y: b.y * TILE - 18, vx: 4, vy: -18, life: 1, max: 1.6, color: '#c8c8c880', size: 3 });
      }
    }

    // --- duch stavby ---
    if (g.runtime.buildSel && this.mouse.over) {
      const def = B[g.runtime.buildSel];
      const sp = sprites[g.runtime.buildSel];
      if (def && sp) {
        let ok = true;
        for (let dy = 0; dy < def.size; dy++) for (let dx = 0; dx < def.size; dx++) if (!g.world.buildable(this.mouse.tx + dx, this.mouse.ty + dy)) ok = false;
        const [sx, sy] = this.worldToScreen(this.mouse.tx * TILE, this.mouse.ty * TILE);
        x.fillStyle = ok ? '#3fb95040' : '#ff4a4a40';
        x.fillRect(sx, sy, def.size * TILE * z, def.size * TILE * z);
        const sh = def.size === 2 ? 80 : 44;
        x.globalAlpha = 0.65;
        x.drawImage(sp, sx, sy - (sh - def.size * TILE) * z, def.size * TILE * z, sh * z);
        x.globalAlpha = 1;
      }
    }

    // --- agenti ---
    this.agentSync -= dt;
    if (this.agentSync <= 0 || g.runtime.agentsDirty) {
      this.syncAgents(g); this.agentSync = 4; g.runtime.agentsDirty = false;
      // pulzy produkce nad budovami — živoucí ekonomika
      if (this.cam.z > 0.7) {
        let shown = 0;
        for (const b of g.s.buildings) {
          if (shown >= 5) break;
          const def = B[b.t];
          if (!def.jobs || !activeWorkers(g, b.t)) continue;
          const wx = b.x * TILE, wy = b.y * TILE;
          if (wx < vx0 || wx > vx1 || wy < vy0 || wy > vy1 || Math.random() < 0.6) continue;
          const out = def.prod?.res ?? (def.recipe ? Object.keys(def.recipe.outputs)[0] : null);
          if (!out) continue;
          this.float(wx + def.size * TILE / 2, wy - 20, RES_BY[out]?.icon || '+', RES_BY[out]?.color || '#fff');
          shown++;
        }
      }
    }
    this.updateAgents(g, dt);
    const laser = hasTech(g.s, 'laserMining');
    for (const a of this.agentMap.values()) {
      const [sx, sy] = this.worldToScreen(a.x, a.y);
      if (sx < -20 || sx > this.W + 20 || sy < -20 || sy > this.H + 20) continue;
      const s = z;
      // vozidla/zvířata na velkostatcích
      if (a.kind === 'horse') {
        x.fillStyle = '#00000030'; x.beginPath(); x.ellipse(sx, sy + 2 * s, 6 * s, 2 * s, 0, 0, 7); x.fill();
        x.fillStyle = '#7a4a22';
        x.fillRect(sx - 5 * s, sy - 6 * s, 10 * s, 4.5 * s);            // tělo
        x.fillRect(sx + 4 * s, sy - 9 * s, 3 * s, 4 * s);              // hlava+krk
        x.fillRect(sx - 4.5 * s, sy - 2 * s, 1.6 * s, 3 * s);          // nohy
        x.fillRect(sx + 3 * s, sy - 2 * s, 1.6 * s, 3 * s);
        x.fillStyle = '#4a2e14'; x.fillRect(sx - 6.5 * s, sy - 5.5 * s, 1.8 * s, 3 * s); // ocas
        // pluh za koněm
        x.strokeStyle = '#8a6b42'; x.lineWidth = 1.5 * s;
        x.beginPath(); x.moveTo(sx - 6 * s, sy - 3 * s); x.lineTo(sx - 10 * s, sy); x.stroke();
        continue;
      }
      if (a.kind === 'boat') {
        x.fillStyle = 'rgba(200,230,255,.25)'; x.beginPath(); x.ellipse(sx, sy + 3 * s, 8 * s, 2.5 * s, 0, 0, 7); x.fill();
        x.fillStyle = '#8a6b42';
        x.beginPath(); x.moveTo(sx - 7 * s, sy); x.quadraticCurveTo(sx, sy + 5 * s, sx + 7 * s, sy); x.lineTo(sx + 5 * s, sy - 2 * s); x.lineTo(sx - 5 * s, sy - 2 * s); x.closePath(); x.fill();
        x.fillStyle = '#5d6e7a'; x.fillRect(sx - 1.5 * s, sy - 7 * s, 3 * s, 5 * s);   // rybář
        x.fillStyle = '#e8c49a'; x.beginPath(); x.arc(sx, sy - 8.5 * s, 2 * s, 0, 7); x.fill();
        x.strokeStyle = '#4a3820'; x.lineWidth = s;
        x.beginPath(); x.moveTo(sx + 2 * s, sy - 6 * s); x.lineTo(sx + 9 * s, sy - 9 * s); x.stroke();
        continue;
      }
      if (a.kind === 'tractor') {
        x.fillStyle = '#00000030'; x.beginPath(); x.ellipse(sx, sy + 2 * s, 7 * s, 2.2 * s, 0, 0, 7); x.fill();
        x.fillStyle = '#c8352a';
        x.fillRect(sx - 6 * s, sy - 7 * s, 12 * s, 5 * s);             // kapota
        x.fillRect(sx - 1 * s, sy - 11 * s, 6 * s, 4.5 * s);           // kabina
        x.fillStyle = '#9fd8e8'; x.fillRect(sx + 0.2 * s, sy - 10 * s, 3.5 * s, 3 * s);
        x.fillStyle = '#26221c';
        x.beginPath(); x.arc(sx + 4 * s, sy - 1 * s, 3.4 * s, 0, 7); x.fill();   // velké kolo
        x.beginPath(); x.arc(sx - 4.5 * s, sy - 0.5 * s, 2.2 * s, 0, 7); x.fill(); // malé kolo
        if (this.g.s.settings.particles && Math.random() < 0.12)
          this.particles.push({ x: a.x - 6, y: a.y - 12, vx: -6, vy: -14, life: 1, max: 1.1, color: '#a8a8a880', size: 2.5 });
        continue;
      }
      const bob = a.state === 'work' ? Math.sin(now / 90) * 1.5 * s : 0;
      // stín
      x.fillStyle = '#00000030'; x.beginPath(); x.ellipse(sx, sy + 1 * s, 4 * s, 1.6 * s, 0, 0, 7); x.fill();
      // tělo
      x.fillStyle = a.color;
      x.fillRect(sx - 2.5 * s, sy - 7 * s + bob, 5 * s, 6 * s);
      // hlava
      x.fillStyle = ['#e8c49a', '#d8a87a', '#c89268', '#f0d0a8'][a.variant];
      x.beginPath(); x.arc(sx, sy - 9 * s + bob, 2.6 * s, 0, 7); x.fill();
      // náklad
      if (a.carry) {
        x.fillStyle = RES_BY[a.carry]?.color || '#c8a878';
        x.fillRect(sx - 2 * s, sy - 13 * s + bob, 4 * s, 3 * s);
      }
      // laserová těžba 🔴
      if (laser && a.state === 'work' && a.bIdx >= 0) {
        const bt = g.s.buildings[a.bIdx]?.t;
        if (bt === 'quarry' || bt === 'copperMine' || bt === 'ironMine' || bt === 'coalMine' || bt === 'forestCamp') {
          x.strokeStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(now / 60)})`;
          x.lineWidth = 1.5 * s;
          x.beginPath(); x.moveTo(sx + 2 * s, sy - 8 * s); x.lineTo(sx + 14 * s, sy - 2 * s); x.stroke();
          if (Math.random() < 0.15) this.burst(a.x + 14, a.y - 2, '#ff5a4a', 2);
        }
      }
    }

    // --- zlatý občan ---
    if (g.runtime.golden) {
      const gc = g.runtime.golden;
      const wx = gc.tx * TILE + TILE / 2, wy = gc.ty * TILE + TILE / 2;
      const [sx, sy] = this.worldToScreen(wx, wy);
      const pulse = 1 + 0.15 * Math.sin(now / 150);
      x.fillStyle = `rgba(255,215,80,${0.25 + 0.15 * Math.sin(now / 200)})`;
      x.beginPath(); x.arc(sx, sy - 6 * z, 16 * z * pulse, 0, 7); x.fill();
      x.fillStyle = '#ffd74a';
      x.fillRect(sx - 3 * z, sy - 8 * z, 6 * z, 7 * z);
      x.beginPath(); x.arc(sx, sy - 10 * z, 3 * z, 0, 7); x.fill();
      x.fillStyle = '#fff';
      x.font = `bold ${Math.round(13 * z)}px sans-serif`;
      x.textAlign = 'center';
      x.fillText('!', sx, sy - 16 * z);
      if (g.s.settings.particles && Math.random() < 0.3) this.burst(wx, wy - 8, '#ffd74a', 1);

      // šipka na okraji obrazovky, když je zlatý občan mimo záběr
      if (sx < -10 || sx > this.W + 10 || sy < -10 || sy > this.H + 10) {
        const cx = this.W / 2, cy = this.H / 2;
        const dx = sx - cx, dy = sy - cy;
        const scale = Math.min((this.W / 2 - 42) / Math.abs(dx || 1), (this.H / 2 - 42) / Math.abs(dy || 1));
        const ex = cx + dx * scale, ey = cy + dy * scale;
        const pulse = 1 + 0.12 * Math.sin(now / 130);
        x.fillStyle = '#ffd74acc';
        x.beginPath(); x.arc(ex, ey, 17 * pulse, 0, 7); x.fill();
        x.font = '17px sans-serif';
        x.fillText('🌟', ex, ey + 6);
        const ang = Math.atan2(dy, dx);
        x.fillStyle = '#ffd74a';
        x.beginPath();
        x.moveTo(ex + Math.cos(ang) * 26, ey + Math.sin(ang) * 26);
        x.lineTo(ex + Math.cos(ang + 2.6) * 16, ey + Math.sin(ang + 2.6) * 16);
        x.lineTo(ex + Math.cos(ang - 2.6) * 16, ey + Math.sin(ang - 2.6) * 16);
        x.closePath(); x.fill();
      }
    }

    // --- vláčky mezi nádražími ---
    {
      const stations = g.s.buildings.filter(b => b.t === 'trainStation');
      if (stations.length !== this.trainStations) {
        this.trainStations = stations.length;
        this.trains = [];
        for (let i = 1; i < stations.length; i++) {
          const a = stations[i - 1], b2 = stations[i];
          const p0: [number, number] = [(a.x + 1) * TILE, (a.y + 2) * TILE + TILE / 2];
          const p2: [number, number] = [(b2.x + 1) * TILE, (b2.y + 2) * TILE + TILE / 2];
          const pm: [number, number] = [p2[0], p0[1]];
          let len = Math.hypot(pm[0] - p0[0], pm[1] - p0[1]) + Math.hypot(p2[0] - pm[0], p2[1] - pm[1]);
          this.trains.push({ path: [p0, pm, p2], dist: 0, dir: 1, pause: 0, len });
        }
      }
      const pathPos = (path: [number, number][], d: number): [number, number, number] => {
        for (let i = 0; i < path.length - 1; i++) {
          const sl = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
          if (d <= sl || i === path.length - 2) {
            const t2 = sl > 0 ? Math.min(1, d / sl) : 0;
            return [lerp(path[i][0], path[i + 1][0], t2), lerp(path[i][1], path[i + 1][1], t2),
              Math.atan2(path[i + 1][1] - path[i][1], path[i + 1][0] - path[i][0])];
          }
          d -= sl;
        }
        return [path[0][0], path[0][1], 0];
      };
      for (const tr of this.trains) {
        if (tr.pause > 0) { tr.pause -= dt; }
        else {
          tr.dist += tr.dir * 95 * dt;
          if (tr.dist >= tr.len) { tr.dist = tr.len; tr.dir = -1; tr.pause = 1.8; }
          if (tr.dist <= 0) { tr.dist = 0; tr.dir = 1; tr.pause = 1.8; }
        }
        // lokomotiva + 2 vagóny
        for (let car = 0; car < 3; car++) {
          const d = Math.max(0, Math.min(tr.len, tr.dist - tr.dir * car * 15));
          const [wx2, wy2, ang] = pathPos(tr.path, d);
          const [sx2, sy2] = this.worldToScreen(wx2, wy2);
          if (sx2 < -40 || sx2 > this.W + 40 || sy2 < -40 || sy2 > this.H + 40) continue;
          x.save();
          x.translate(sx2, sy2);
          x.rotate(ang);
          if (car === 0) {
            x.fillStyle = '#2e5d3a'; x.fillRect(-8 * z, -5 * z, 16 * z, 9 * z);
            x.fillStyle = '#1e3d28'; x.fillRect(4 * z, -8 * z, 4 * z, 4 * z); // komín
            x.fillStyle = '#ffd74a'; x.fillRect(6.5 * z, -2 * z, 2 * z, 3 * z);
          } else {
            x.fillStyle = car === 1 ? '#7a5c3a' : '#6b5232';
            x.fillRect(-7 * z, -4.5 * z, 14 * z, 8 * z);
          }
          x.fillStyle = '#26221c';
          x.fillRect(-6 * z, 3.5 * z, 3 * z, 2 * z); x.fillRect(3 * z, 3.5 * z, 3 * z, 2 * z);
          x.restore();
          if (car === 0 && tr.pause <= 0 && g.s.settings.particles && Math.random() < 0.25) {
            this.particles.push({ x: wx2, y: wy2 - 10, vx: -8, vy: -20, life: 1, max: 1.4, color: '#d8d8d890', size: 3 });
          }
        }
      }
    }

    // --- ptáci (ambientní život) ---
    this.birdTimer -= dt;
    if (this.birdTimer <= 0 && this.birds.length === 0) {
      this.birdTimer = 12 + Math.random() * 16;
      const fromLeft = Math.random() < 0.5;
      const by = vy0 + Math.random() * (vy1 - vy0);
      const vx = (fromLeft ? 1 : -1) * (80 + Math.random() * 40);
      for (let i = 0; i < 3; i++) {
        this.birds.push({ x: (fromLeft ? vx0 - 30 : vx1 + 30) - i * 14 * Math.sign(vx), y: by + i * 9, vx, ph: Math.random() * 6.28 });
      }
    }
    x.strokeStyle = '#2a2f38'; x.lineWidth = Math.max(1, 1.3 * z);
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const bd = this.birds[i];
      bd.x += bd.vx * dt; bd.ph += dt * 9;
      bd.y += Math.sin(bd.ph * 0.35) * 6 * dt;
      if (bd.x < vx0 - 100 || bd.x > vx1 + 100) { this.birds.splice(i, 1); continue; }
      const [bsx, bsy] = this.worldToScreen(bd.x, bd.y);
      const w = 4 * z, flap = Math.sin(bd.ph) * 2.4 * z;
      x.beginPath();
      x.moveTo(bsx - w, bsy - flap); x.quadraticCurveTo(bsx, bsy + 1.6 * z, bsx + w, bsy - flap);
      x.stroke();
    }

    // --- vrtulníky ---
    for (const h of this.helis) {
      const [sx, sy] = this.worldToScreen(h.x, h.y);
      if (sx < -60 || sx > this.W + 60 || sy < -60 || sy > this.H + 60) continue;
      x.fillStyle = '#00000028'; x.beginPath(); x.ellipse(sx, sy + 26 * z, 10 * z, 3 * z, 0, 0, 7); x.fill();
      x.fillStyle = '#5f7d94';
      x.fillRect(sx - 8 * z, sy - 4 * z, 16 * z, 8 * z);
      x.fillRect(sx + 8 * z, sy - 2 * z, 8 * z, 3 * z);
      x.strokeStyle = '#c8d2e0'; x.lineWidth = 1.5 * z;
      const rl = 14 * z;
      x.beginPath();
      x.moveTo(sx - Math.cos(h.rot) * rl, sy - 6 * z - Math.sin(h.rot) * rl * 0.3);
      x.lineTo(sx + Math.cos(h.rot) * rl, sy - 6 * z + Math.sin(h.rot) * rl * 0.3);
      x.stroke();
    }

    // --- particly ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt / p.max;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt;
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      x.globalAlpha = Math.max(0, p.life);
      x.fillStyle = p.color;
      x.fillRect(sx, sy, p.size * z, p.size * z);
    }
    x.globalAlpha = 1;

    // --- floating texty ---
    x.textAlign = 'center';
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt / 1.3;
      if (f.life <= 0) { this.floats.splice(i, 1); continue; }
      f.y -= 26 * dt;
      const [sx, sy] = this.worldToScreen(f.x, f.y);
      x.globalAlpha = Math.min(1, f.life * 2);
      x.font = `bold ${Math.round((f.big ? 17 : 12.5) * Math.max(0.8, z))}px sans-serif`;
      x.strokeStyle = '#00000090'; x.lineWidth = 3;
      x.strokeText(f.text, sx, sy);
      x.fillStyle = f.color;
      x.fillText(f.text, sx, sy);
    }
    x.globalAlpha = 1;

    // --- roční období: nádech scény + sníh / padající listí ---
    const SEASON_TINT = ['', 'rgba(255,220,120,0.045)', 'rgba(205,125,40,0.08)', 'rgba(215,230,255,0.22)'];
    if (SEASON_TINT[g.season]) {
      x.fillStyle = SEASON_TINT[g.season];
      x.fillRect(0, 0, this.W, this.H);
    }
    if (g.s.settings.particles) {
      const want = g.season === 3 ? 70 : g.season === 2 ? 28 : 0;
      while (this.precip.length < want) {
        this.precip.push({ x: Math.random() * this.W, y: Math.random() * this.H, vy: 22 + Math.random() * 30, vx: (Math.random() - 0.5) * 14, ph: Math.random() * 6.28 });
      }
      if (this.precip.length > want) this.precip.length = want;
      for (const f of this.precip) {
        f.y += f.vy * dt; f.x += (f.vx + Math.sin(f.ph += dt * 2) * 8) * dt;
        if (f.y > this.H + 5) { f.y = -5; f.x = Math.random() * this.W; }
        if (f.x < -5) f.x = this.W + 5; else if (f.x > this.W + 5) f.x = -5;
        if (g.season === 3) {
          x.fillStyle = 'rgba(255,255,255,.8)';
          x.beginPath(); x.arc(f.x, f.y, 1.6, 0, 7); x.fill();
        } else {
          x.fillStyle = ['#c87a30', '#b05a28', '#d8983a'][(f.ph * 10 | 0) % 3];
          x.save(); x.translate(f.x, f.y); x.rotate(f.ph);
          x.fillRect(-2, -1.2, 4, 2.4);
          x.restore();
        }
      }
    } else this.precip.length = 0;

    // --- noc ---
    if (night > 0.03) {
      x.fillStyle = `rgba(10,16,42,${0.42 * night})`;
      x.fillRect(0, 0, this.W, this.H);
    }

    // --- minimapa ---
    this.miniTimer -= dt;
    if (this.mini && this.miniTimer <= 0) { this.miniTimer = 0.6; this.drawMinimap(g); }
  }

  nightFactor(now: number, g: Game): number {
    if (!g.s.settings.daynight) return 0;
    const t = (now / 1000 % 300) / 300; // 5min cyklus
    return clamp(Math.cos(t * Math.PI * 2) * -1.4 + 0.25, 0, 1); // většina času den
  }

  private drawMinimap(g: Game) {
    const mv = this.mini!;
    const x = mv.getContext('2d')!;
    const S = mv.width;
    x.fillStyle = '#0d1117'; x.fillRect(0, 0, S, S);
    const range = 4; // chunků na každou stranu
    const ccx = Math.floor(this.cam.x / CHUNK_PX), ccy = Math.floor(this.cam.y / CHUNK_PX);
    const cell = S / (range * 2 + 1);
    for (let dy = -range; dy <= range; dy++) for (let dx = -range; dx <= range; dx++) {
      const ch = g.world.chunk(ccx + dx, ccy + dy); // generuje dle potřeby (levné, jen data)
      x.fillStyle = ch.avg;
      x.fillRect((dx + range) * cell, (dy + range) * cell, cell + 0.5, cell + 0.5);
    }
    // budovy
    x.fillStyle = '#f0e6c8';
    for (const b of g.s.buildings) {
      const px = ((b.x * TILE) / CHUNK_PX - ccx + range) * cell;
      const py = ((b.y * TILE) / CHUNK_PX - ccy + range) * cell;
      if (px < 0 || px > S || py < 0 || py > S) continue;
      x.fillRect(px, py, 1.5, 1.5);
    }
    // viewport
    x.strokeStyle = '#ffd74a';
    const vw = (this.W / this.cam.z / CHUNK_PX) * cell, vh = (this.H / this.cam.z / CHUNK_PX) * cell;
    x.strokeRect(S / 2 - vw / 2 + ((this.cam.x / CHUNK_PX) % 1 - 0.5) * cell, S / 2 - vh / 2 + ((this.cam.y / CHUNK_PX) % 1 - 0.5) * cell, vw, vh);
  }
}
