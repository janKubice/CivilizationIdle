// ===== Renderer: canvas 2D, chunk cache, LOD agenti, particly, den/noc =====
// Prezentační vrstva — čte stav, nikdy ho nemění. Viz docs/11-technical-architecture.md.

import { TILE, CHUNK, CHUNK_PX, BIOME_COLORS, B_WATER, MAX_AGENTS, MAX_PARTICLES } from './config';
import { clamp, lerp, hash2, key, bus, fmt } from './util';
import { B, BUILDINGS, RES_BY, NODE_DEFS, N_TREE, N_BERRY, N_ROCK, N_COPPER, N_IRON, N_COAL } from './data';
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
  state: 'walk' | 'work' | 'back' | 'idle';
  timer: number;
  color: string; carry: string | null;
  speed: number; variant: number;
}
interface Heli { x: number; y: number; tx: number; ty: number; rot: number }

const AGENT_COLORS: Record<string, string> = {
  forestCamp: '#4a8040', gatherHut: '#c9a83e', quarry: '#8d939c', farm: '#7fb356',
  copperMine: '#e08d4f', ironMine: '#c8cdd8', coalMine: '#454a52', sawmill: '#c08a4e',
  smelter: '#e88a2a', workshop: '#e8c46a', market: '#ffd777', library: '#8fb8ff',
  ironworks: '#a8adba', brickworks: '#c4593e', steelworks: '#c8d2e0', powerPlant: '#ffe14a',
  factory: '#9fb4d8', hitechLab: '#6fd8c8', trainStation: '#b8a97e', idle: '#d8c8b0',
};

const NODE_SPRITES = ['tree', 'berry', 'rock', 'copperVein', 'ironVein', 'coalVein'];

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

    // --- uzly ---
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      const chunk = g.world.chunk(cx, cy);
      for (const n of chunk.nodes) {
        if (n.tx < t0x - 1 || n.tx > t1x + 1 || n.ty < t0y - 2 || n.ty > t1y + 1) continue;
        let sp: HTMLCanvasElement;
        if (n.stock <= 0.5) {
          sp = n.kind === N_TREE ? sprites.stump : n.kind === N_BERRY ? sprites.berryEmpty : n.kind === N_ROCK ? sprites.rock : sprites.veinEmpty;
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
      const sp = sprites[b.t];
      if (!sp) continue;
      const sh = def.size === 2 ? 80 : 44;
      const [sx, sy] = this.worldToScreen(b.x * TILE, b.y * TILE - (sh - def.size * TILE));
      x.drawImage(sp, sx, sy, def.size * TILE * z, sh * z);
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
