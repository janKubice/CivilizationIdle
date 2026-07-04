// ===== Audio: syntetizované SFX + generativní hudba (WebAudio, žádné soubory) =====

import { bus } from './util';
import { Game } from './state';

let ctx: AudioContext | null = null;
let sfxGain: GainNode, musGain: GainNode;
let musicTimer: number | null = null;
let g: Game;
let lastSfx: Record<string, number> = {};

function ensure(): boolean {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
    musGain = ctx.createGain(); musGain.connect(ctx.destination);
    applyVolumes();
    startMusic();
    return true;
  } catch { return false; }
}

export function applyVolumes() {
  if (!ctx) return;
  const mute = g?.s.settings.muted ? 0 : 1;
  sfxGain.gain.value = (g?.s.settings.sfx ?? 0.7) * mute;
  musGain.gain.value = (g?.s.settings.music ?? 0.4) * 0.16 * mute;
}

/** krátký syntetický tón */
function blip(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, slide = 0, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const gn = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(gn); gn.connect(sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function throttled(id: string, ms: number): boolean {
  const now = performance.now();
  if ((lastSfx[id] || 0) + ms > now) return false;
  lastSfx[id] = now;
  return true;
}

const RES_FREQ: Record<string, number> = {
  wood: 300, food: 420, stone: 220, copperOre: 260, ironOre: 240, coal: 200, gold: 660, research: 540,
};

// ---- generativní hudební podklad (vyvíjí se érou) ----
const CHORD_SETS = [
  [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [261.6, 329.6, 392]],        // é0–1: doba kamenná/bronz (Am F G C)
  [[261.6, 329.6, 392], [293.7, 370, 440], [329.6, 415.3, 493.9], [349.2, 440, 523.3]],         // é2–3: jasnější antika/středověk
  [[130.8, 164.8, 196], [146.8, 185, 220], [164.8, 207.7, 246.9], [196, 246.9, 293.7]],         // é4–5: hlubší industriál
  [[261.6, 311.1, 392], [277.2, 329.6, 415.3], [233.1, 293.7, 349.2], [311.1, 392, 466.2]],     // é6: vesmírné harmonie
];
const PENTA_SETS = [
  [440, 523.3, 587.3, 659.3, 784], [523.3, 587.3, 659.3, 784, 880],
  [392, 440, 523.3, 587.3, 659.3], [523.3, 622.3, 698.5, 784, 932.3],
];
function eraGroup(): number { const e = g?.maxEra ?? 0; return e >= 6 ? 3 : e >= 4 ? 2 : e >= 2 ? 1 : 0; }
let chordIdx = 0;

function playChord() {
  if (!ctx || (g?.s.settings.music ?? 0) <= 0.01) return;
  const grp = eraGroup();
  const raid = !!g?.runtime?.raid;
  const chord = CHORD_SETS[grp][chordIdx % 4];
  chordIdx++;
  const t0 = ctx.currentTime;
  for (const f of chord) {
    for (const det of [-2, 2]) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = raid ? 'sawtooth' : 'triangle';
      o.frequency.value = f + det * 0.5;
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.linearRampToValueAtTime(raid ? 0.35 : 0.5, t0 + 2.5);
      gn.gain.linearRampToValueAtTime(0.0001, t0 + 7.5);
      o.connect(gn); gn.connect(musGain);
      o.start(t0); o.stop(t0 + 8);
    }
  }
  // basová linka, když je město velké (vrstvení)
  if ((g?.s.pop ?? 0) > 150) {
    const o = ctx.createOscillator(); const gn = ctx.createGain();
    o.type = 'sine'; o.frequency.value = chord[0] / 2;
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(0.4, t0 + 1.5);
    gn.gain.linearRampToValueAtTime(0.0001, t0 + 7);
    o.connect(gn); gn.connect(musGain);
    o.start(t0); o.stop(t0 + 7.5);
  }
  // jemná melodie (pentatonika dle éry; při nájezdu napjatější a hustší)
  if (raid || Math.random() < 0.6) {
    const penta = PENTA_SETS[grp];
    const n = raid ? 4 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = penta[Math.floor(Math.random() * penta.length)];
      const t = t0 + 1 + i * (raid ? 0.5 : 0.8 + Math.random());
      const o = ctx.createOscillator(); const gn = ctx.createGain();
      o.type = raid ? 'square' : 'sine'; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(raid ? 0.22 : 0.35, t + 0.05);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      o.connect(gn); gn.connect(musGain);
      o.start(t); o.stop(t + 1.5);
    }
  }
}

function startMusic() {
  if (musicTimer !== null) return;
  playChord();
  musicTimer = window.setInterval(playChord, 7000);
}

// ---- napojení na herní eventy ----
export function initAudio(game: Game) {
  g = game;
  const unlock = () => { ensure(); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  bus.on('volumes', applyVolumes);

  bus.on('gather', (e: any) => {
    if (!ctx || !throttled('gather', 40)) return;
    const f = (RES_FREQ[e.res] || 350) * (0.95 + Math.random() * 0.1);
    if (e.crit) { blip(f * 1.5, 0.12, 'square', 0.2, f); blip(f * 2.2, 0.18, 'sine', 0.18, f, 0.05); }
    else blip(f, 0.07, 'triangle', 0.16, 40);
  });
  bus.on('built', () => {
    if (!ctx || !throttled('built', 100)) return;
    blip(150, 0.1, 'square', 0.15, -40);
    blip(220, 0.12, 'triangle', 0.14, 30, 0.07);
  });
  bus.on('tech', () => {
    if (!ctx) return;
    [392, 494, 587, 784].forEach((f, i) => blip(f, 0.25, 'triangle', 0.16, 0, i * 0.09));
  });
  bus.on('upgrade', () => {
    if (!ctx) return;
    blip(523, 0.1, 'triangle', 0.15); blip(784, 0.14, 'triangle', 0.14, 0, 0.08);
  });
  bus.on('ach', () => {
    if (!ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'sine', 0.14, 0, i * 0.08));
  });
  bus.on('era', () => {
    if (!ctx) return;
    [262, 330, 392, 523, 659, 784].forEach((f, i) => blip(f, 0.4, 'triangle', 0.16, 0, i * 0.12));
  });
  bus.on('golden', () => {
    if (!ctx) return;
    [880, 1109, 1319, 1760].forEach((f, i) => blip(f, 0.2, 'sine', 0.15, 0, i * 0.06));
  });
  bus.on('goldenSpawn', () => {
    if (!ctx) return;
    blip(1319, 0.3, 'sine', 0.12, 200); blip(1760, 0.3, 'sine', 0.1, 200, 0.12);
  });
  bus.on('festival', () => {
    if (!ctx) return;
    [523, 659, 784, 659, 523, 784].forEach((f, i) => blip(f, 0.15, 'square', 0.08, 0, i * 0.1));
  });
  bus.on('ascend', () => {
    if (!ctx) return;
    [262, 392, 523, 784, 1047, 1568].forEach((f, i) => blip(f, 0.6, 'sine', 0.15, 0, i * 0.15));
  });
  bus.on('error', () => {
    if (!ctx || !throttled('err', 200)) return;
    blip(140, 0.15, 'square', 0.1, -40);
  });
  bus.on('demolished', () => {
    if (!ctx || !throttled('dem', 150)) return;
    blip(110, 0.2, 'square', 0.14, -60);
    blip(80, 0.25, 'triangle', 0.12, -30, 0.08);
  });
  bus.on('storageFull', () => {
    if (!ctx || !throttled('full', 2000)) return;
    blip(520, 0.09, 'sine', 0.08); blip(390, 0.12, 'sine', 0.08, 0, 0.1);
  });
  bus.on('fire', () => {
    if (!ctx) return;
    for (let i = 0; i < 3; i++) { blip(720, 0.18, 'square', 0.1, 0, i * 0.28); blip(560, 0.18, 'square', 0.1, 0, i * 0.28 + 0.14); }
  });
  bus.on('extinguish', () => {
    if (!ctx || !throttled('ext', 80)) return;
    blip(300, 0.08, 'sine', 0.1, -120);
  });
  bus.on('meteor', () => {
    if (!ctx) return;
    blip(90, 0.6, 'square', 0.2, -50); blip(1200, 0.4, 'sine', 0.1, -900);
  });
  bus.on('circus', () => {
    if (!ctx) return;
    [523, 659, 523, 784, 659, 1047].forEach((f, i) => blip(f, 0.14, 'square', 0.09, 0, i * 0.11));
  });
  // v0.8 eventy
  bus.on('rank', () => {
    if (!ctx) return;
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, 0.5, 'triangle', 0.16, 0, i * 0.1));
  });
  bus.on('quest', () => {
    if (!ctx || !throttled('quest', 120)) return;
    blip(784, 0.1, 'sine', 0.14); blip(1047, 0.16, 'sine', 0.13, 0, 0.09);
  });
  bus.on('wonderDone', () => {
    if (!ctx) return;
    [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, 0.6, 'triangle', 0.17, 0, i * 0.13));
  });
  bus.on('raidIncoming', () => {
    if (!ctx) return;
    for (let i = 0; i < 3; i++) { blip(110, 0.5, 'sawtooth', 0.18, -10, i * 0.55); blip(146, 0.5, 'sawtooth', 0.12, -8, i * 0.55); }
  });
  bus.on('raidWin', () => {
    if (!ctx) return;
    [392, 523, 659, 880, 1175].forEach((f, i) => blip(f, 0.35, 'triangle', 0.16, 0, i * 0.1));
  });
  bus.on('raidLoss', () => {
    if (!ctx) return;
    [330, 262, 196, 147, 110].forEach((f, i) => blip(f, 0.4, 'sawtooth', 0.15, -20, i * 0.12));
  });
  bus.on('skyLaser', () => {
    if (!ctx) return;
    blip(1800, 0.5, 'sawtooth', 0.14, -1600); blip(90, 0.4, 'square', 0.16, 40, 0.1);
  });
}
