// ===== Bootstrap + herní smyčka + vstup =====

import './style.css';
import { SIM_DT, TILE, OFFLINE_MIN } from './config';
import { clamp, bus } from './util';
import { Game, newState, initGame } from './state';
import {
  recomputeMults, tick, slowTick, makeSimRand, gather, tryBuild,
  collectGolden, computeOffline, freshRun,
} from './sim';
import { Renderer } from './render';
import { initUI, uiFrame, showTitle, showOffline, openPanel, toast } from './ui';
import { initAudio } from './audio';
import { loadState, saveGame, hasSave } from './save';

const canvas = document.getElementById('game') as HTMLCanvasElement;

// ---------- game objekt (stabilní identita) ----------
const g = {} as Game;
const saved = loadState();
initGame(g, saved ?? newState((Math.random() * 2 ** 31) | 0));
recomputeMults(g);

const renderer = new Renderer(canvas, g);
initAudio(g);

function cancelBuild() {
  g.runtime.buildSel = null;
  canvas.classList.remove('building');
}

initUI(g, {
  renderer,
  onNewGame: () => { /* nepoužito – řeší title */ },
  onImport: (st) => {
    initGame(g, st);
    recomputeMults(g);
    bus.emit('worldReset');
    openPanel(null);
    g.runtime.paused = false;
    g.runtime.started = true;
  },
});

// debug / testy
(window as any).G = g;

// ---------- title ----------
showTitle(!!saved, (fresh) => {
  if (fresh) {
    const settings = g.s.settings;
    freshRun(g, false);
    g.s.settings = settings;
    bus.emit('worldReset');
  } else if (saved) {
    const away = (Date.now() - (saved.saved || Date.now())) / 1000;
    if (away > OFFLINE_MIN) {
      const sum = computeOffline(g, away);
      showOffline(sum);
    }
  }
  g.runtime.paused = false;
  g.runtime.started = true;
  saveGame(g);
});

// ---------- vstup ----------
const pointers = new Map<number, { x: number; y: number }>();
let panStart: { x: number; y: number; camX: number; camY: number } | null = null;
let panned = false;
let pinchDist = 0;
const keys = new Set<string>();

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    panStart = { x: e.clientX, y: e.clientY, camX: renderer.cam.x, camY: renderer.cam.y };
    panned = false;
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    panStart = null;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (p) { p.x = e.clientX; p.y = e.clientY; }
  // hover pro ducha stavby
  const [wx, wy] = renderer.screenToWorld(e.clientX, e.clientY);
  renderer.mouse.sx = e.clientX; renderer.mouse.sy = e.clientY;
  renderer.mouse.tx = Math.floor(wx / TILE); renderer.mouse.ty = Math.floor(wy / TILE);
  renderer.mouse.over = true;

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist > 0) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAt(mx, my, renderer.cam.z * (d / pinchDist));
    }
    pinchDist = d;
    return;
  }
  if (panStart && pointers.has(e.pointerId)) {
    const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y;
    if (Math.hypot(dx, dy) > 6) panned = true;
    if (panned) {
      renderer.cam.x = panStart.camX - dx / renderer.cam.z;
      renderer.cam.y = panStart.camY - dy / renderer.cam.z;
    }
  }
});

function endPointer(e: PointerEvent) {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (wasSingle && panStart && !panned && g.runtime.started) {
    handleClick(e.clientX, e.clientY);
  }
  panStart = null;
  pinchDist = 0;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { renderer.mouse.over = false; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, renderer.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
}, { passive: false });

function zoomAt(sx: number, sy: number, newZ: number) {
  newZ = clamp(newZ, 0.35, 2.5);
  const [wx, wy] = renderer.screenToWorld(sx, sy);
  renderer.cam.z = newZ;
  const [wx2, wy2] = renderer.screenToWorld(sx, sy);
  renderer.cam.x += wx - wx2;
  renderer.cam.y += wy - wy2;
}

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (g.runtime.buildSel) { cancelBuild(); toast('Stavění zrušeno.'); }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (g.runtime.buildSel) cancelBuild();
    else openPanel(null);
    return;
  }
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function handleClick(sx: number, sy: number) {
  const [wx, wy] = renderer.screenToWorld(sx, sy);
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);

  // stavění
  if (g.runtime.buildSel) {
    const err = tryBuild(g, g.runtime.buildSel, tx, ty);
    if (err) { toast('⚠️ ' + err); bus.emit('error'); }
    return;
  }

  // zlatý občan (velkorysý hitbox)
  const gc = g.runtime.golden;
  if (gc) {
    const gx = gc.tx * TILE + TILE / 2, gy = gc.ty * TILE + TILE / 2;
    if (Math.hypot(wx - gx, wy - gy) < TILE * 1.4) {
      collectGolden(g);
      return;
    }
  }

  // těžba klikem
  const node = g.world.nodeAt(tx, ty);
  if (node) {
    const r = gather(g, node);
    if (r) bus.emit('gather', { tx: node.tx, ty: node.ty, amt: r.amt, res: r.res, crit: r.crit });
  }
}

// ---------- smyčka ----------
const simRand = makeSimRand(g);
let last = performance.now();
let acc = 0, slowAcc = 0, saveAcc = 0;

function frame(now: number) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;

  // návrat po dlouhé pauze (skrytá záložka)
  if (dt > 5 && g.runtime.started && !g.runtime.paused) {
    const sum = computeOffline(g, dt);
    if (dt > OFFLINE_MIN) showOffline(sum);
    dt = 0.05;
  }
  dt = Math.min(dt, 0.25);

  if (!g.runtime.paused) {
    acc += dt;
    let guard = 0;
    while (acc >= SIM_DT && guard++ < 40) { tick(g, SIM_DT); acc -= SIM_DT; }
    if (guard >= 40) acc = 0;
    slowAcc += dt;
    if (slowAcc >= 1) { slowTick(g, slowAcc, simRand); slowAcc = 0; }
    saveAcc += dt;
    if (saveAcc >= 20) { saveAcc = 0; saveGame(g); }
  }

  // posun kamery klávesnicí
  const sp = (420 / renderer.cam.z) * dt;
  if (keys.has('w') || keys.has('arrowup')) renderer.cam.y -= sp;
  if (keys.has('s') || keys.has('arrowdown')) renderer.cam.y += sp;
  if (keys.has('a') || keys.has('arrowleft')) renderer.cam.x -= sp;
  if (keys.has('d') || keys.has('arrowright')) renderer.cam.x += sp;

  renderer.frame(g, dt, now);
  uiFrame(dt);

  // úklid chunk cache podle kamery
  if ((now | 0) % 4000 < 20) {
    g.world.trim(Math.floor(renderer.cam.x / (TILE * 32)), Math.floor(renderer.cam.y / (TILE * 32)));
  }
}
requestAnimationFrame(frame);

// ---------- ukládání při odchodu ----------
window.addEventListener('beforeunload', () => { if (g.runtime.started) saveGame(g); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && g.runtime.started) saveGame(g);
});
