// ===== RNG, noise, matematika, formátování, event bus =====

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** deterministický hash 2D souřadnic -> [0,1) */
export function hash2(seed: number, x: number, y: number): number {
  let h = (seed | 0) ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t: number): number { return t * t * (3 - 2 * t); }

/** value noise s bilineární interpolací */
export function vnoise(seed: number, x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
  const a = hash2(seed, xi, yi), b = hash2(seed, xi + 1, yi);
  const c = hash2(seed, xi, yi + 1), d = hash2(seed, xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function fbm(seed: number, x: number, y: number, oct = 3): number {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += amp * vnoise(seed + i * 1013, x * f, y * f);
    tot += amp; amp *= 0.5; f *= 2;
  }
  return v / tot;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** formát čísel: 1234 -> 1,2K atd. (oddělovač dle jazyka — nastavuje i18n) */
const SUF = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
let DEC_SEP = ',';
export function setDecimalSep(s: string) { DEC_SEP = s; }
export function fmt(n: number, dec = 1): string {
  if (!isFinite(n)) return '∞';
  const neg = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n < 1000) {
    if (n === 0) return '0';
    if (n < 10 && n % 1 > 0.05) return neg + n.toFixed(1).replace('.', DEC_SEP);
    return neg + Math.floor(n).toString();
  }
  let i = -1;
  while (n >= 1000 && i < SUF.length - 1) { n /= 1000; i++; }
  return neg + (n < 100 ? n.toFixed(dec) : Math.round(n).toString()).replace('.', DEC_SEP) + SUF[i];
}

export function fmtRate(n: number): string {
  const s = fmt(Math.abs(n));
  return (n >= 0 ? '+' : '-') + s + '/s';
}

export function fmtTime(sec: number): string {
  sec = Math.floor(sec);
  if (sec < 60) return `${sec} s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ${sec % 60} s`;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h} h ${m} min`;
}

export const key = (tx: number, ty: number) => tx + ',' + ty;

// ===== jednoduchý event bus (sim -> prezentace) =====
type Handler = (data?: any) => void;
const handlers = new Map<string, Handler[]>();
export const bus = {
  on(ev: string, fn: Handler) {
    let l = handlers.get(ev);
    if (!l) { l = []; handlers.set(ev, l); }
    l.push(fn);
  },
  emit(ev: string, data?: any) {
    const l = handlers.get(ev);
    if (l) for (const fn of l) fn(data);
  },
};
