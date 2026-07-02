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
  sfxGain.gain.value = g?.s.settings.sfx ?? 0.7;
  musGain.gain.value = (g?.s.settings.music ?? 0.4) * 0.16;
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

// ---- generativní hudební podklad ----
const CHORDS = [
  [220, 261.6, 329.6],       // Am
  [174.6, 220, 261.6],       // F
  [196, 246.9, 293.7],       // G
  [261.6, 329.6, 392],       // C
];
let chordIdx = 0;

function playChord() {
  if (!ctx || (g?.s.settings.music ?? 0) <= 0.01) return;
  const chord = CHORDS[chordIdx % CHORDS.length];
  chordIdx++;
  const t0 = ctx.currentTime;
  for (const f of chord) {
    for (const det of [-2, 2]) {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f + det * 0.5;
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.linearRampToValueAtTime(0.5, t0 + 2.5);
      gn.gain.linearRampToValueAtTime(0.0001, t0 + 7.5);
      o.connect(gn); gn.connect(musGain);
      o.start(t0); o.stop(t0 + 8);
    }
  }
  // občasná jemná melodie (pentatonika)
  if (Math.random() < 0.6) {
    const penta = [440, 523.3, 587.3, 659.3, 784];
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = penta[Math.floor(Math.random() * penta.length)];
      const t = t0 + 1 + i * (0.8 + Math.random());
      const o = ctx.createOscillator(); const gn = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(0.35, t + 0.05);
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
}
