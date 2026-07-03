// ===== Procedurálně kreslené sprity (žádné externí assety → single-file export) =====

export const sprites: Record<string, HTMLCanvasElement> = {};

function c(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const x = cv.getContext('2d')!;
  draw(x);
  return cv;
}

// pomocné tvary
function roof(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, col: string) {
  x.fillStyle = col;
  x.beginPath();
  x.moveTo(x0 - 2, y0); x.lineTo(x0 + w / 2, y0 - h); x.lineTo(x0 + w + 2, y0);
  x.closePath(); x.fill();
}
function box(x: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, col: string, stroke = '#00000030') {
  x.fillStyle = col; x.fillRect(x0, y0, w, h);
  x.strokeStyle = stroke; x.lineWidth = 1; x.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
}
function windowPair(x: CanvasRenderingContext2D, x0: number, y0: number) {
  x.fillStyle = '#3a3020';
  x.fillRect(x0, y0, 4, 4); x.fillRect(x0 + 8, y0, 4, 4);
}

export function makeSprites() {
  // ---- stromy (2 varianty + pařez) ----
  for (let v = 0; v < 3; v++) {
    sprites['tree' + v] = c(32, 40, x => {
      x.fillStyle = '#5b4327'; x.fillRect(14, 26, 4, 10);
      const g = ['#2e5d2a', '#33682f', '#2a5526'][v];
      const g2 = ['#3f7a38', '#478543', '#3a7034'][v];
      x.fillStyle = g; x.beginPath(); x.arc(16, 18, 11, 0, 7); x.fill();
      x.fillStyle = g2; x.beginPath(); x.arc(13, 14, 7, 0, 7); x.fill();
      x.beginPath(); x.arc(21, 20, 6, 0, 7); x.fill();
    });
  }
  sprites.stump = c(32, 40, x => {
    x.fillStyle = '#6b5232'; x.fillRect(12, 28, 8, 6);
    x.fillStyle = '#8a6b42'; x.fillRect(12, 26, 8, 3);
  });
  // ---- keř s bobulemi ----
  sprites.berry = c(32, 40, x => {
    x.fillStyle = '#3a6b33'; x.beginPath(); x.arc(16, 28, 9, 0, 7); x.fill();
    x.fillStyle = '#4a8040'; x.beginPath(); x.arc(12, 24, 6, 0, 7); x.fill();
    x.fillStyle = '#d84848';
    for (const [bx, by] of [[10, 27], [16, 23], [21, 28], [14, 31], [20, 23]]) { x.beginPath(); x.arc(bx, by, 1.8, 0, 7); x.fill(); }
  });
  sprites.berryEmpty = c(32, 40, x => {
    x.fillStyle = '#4d5c40'; x.beginPath(); x.arc(16, 28, 8, 0, 7); x.fill();
  });
  // ---- balvan a žíly ----
  sprites.rock = c(32, 40, x => {
    x.fillStyle = '#8d939c'; x.beginPath();
    x.moveTo(6, 34); x.lineTo(9, 24); x.lineTo(17, 20); x.lineTo(25, 25); x.lineTo(27, 34); x.closePath(); x.fill();
    x.fillStyle = '#a8aeb8'; x.fillRect(12, 24, 6, 4);
  });
  const vein = (spots: string) => c(32, 40, x => {
    x.fillStyle = '#7b7f88'; x.beginPath();
    x.moveTo(5, 34); x.lineTo(8, 23); x.lineTo(18, 19); x.lineTo(26, 24); x.lineTo(28, 34); x.closePath(); x.fill();
    x.fillStyle = spots;
    for (const [sx, sy] of [[11, 27], [17, 23], [22, 29], [14, 31]]) { x.beginPath(); x.arc(sx, sy, 2.2, 0, 7); x.fill(); }
  });
  sprites.copperVein = vein('#e08d4f');
  sprites.ironVein = vein('#c8cdd8');
  sprites.coalVein = vein('#23262b');
  sprites.veinEmpty = c(32, 40, x => {
    x.fillStyle = '#5a5e66'; x.beginPath();
    x.moveTo(7, 34); x.lineTo(10, 26); x.lineTo(20, 24); x.lineTo(26, 34); x.closePath(); x.fill();
    x.fillStyle = '#42464d'; x.beginPath(); x.arc(16, 31, 4, 0, 7); x.fill();
  });

  // ---- budovy (1×1 => 32×44, 2×2 => 64×80) ----
  sprites.plaza = c(64, 80, x => {
    x.fillStyle = '#b09a72'; x.fillRect(2, 20, 60, 58);
    x.strokeStyle = '#8d7a56'; x.strokeRect(2.5, 20.5, 59, 57);
    // ohniště
    x.fillStyle = '#6e625049'; x.beginPath(); x.arc(32, 50, 12, 0, 7); x.fill();
    x.fillStyle = '#5a4a35'; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; x.fillRect(32 + Math.cos(a) * 10 - 1.5, 50 + Math.sin(a) * 10 - 1.5, 3, 3); }
    x.fillStyle = '#e88a2a'; x.beginPath(); x.arc(32, 50, 5, 0, 7); x.fill();
    x.fillStyle = '#ffcf5e'; x.beginPath(); x.arc(32, 49, 2.5, 0, 7); x.fill();
    // vlajka
    x.strokeStyle = '#5a4a35'; x.lineWidth = 2; x.beginPath(); x.moveTo(12, 44); x.lineTo(12, 22); x.stroke();
    x.fillStyle = '#c8432e'; x.beginPath(); x.moveTo(12, 22); x.lineTo(24, 26); x.lineTo(12, 30); x.fill();
  });
  sprites.hut = c(32, 44, x => {
    box(x, 6, 22, 20, 16, '#8a6b46');
    roof(x, 6, 22, 20, 11, '#6b4e2e');
    windowPair(x, 9, 27);
    x.fillStyle = '#4a3820'; x.fillRect(14, 30, 5, 8);
  });
  sprites.house = c(32, 44, x => {
    box(x, 4, 16, 24, 22, '#c9b49a');
    roof(x, 4, 16, 24, 11, '#a04836');
    windowPair(x, 7, 21); windowPair(x, 7, 29);
    x.fillStyle = '#5a4028'; x.fillRect(14, 30, 6, 8);
  });
  sprites.storehouse = c(32, 44, x => {
    box(x, 3, 20, 26, 18, '#9a7c52');
    roof(x, 3, 20, 26, 9, '#7a5c38');
    x.fillStyle = '#6b5232'; x.fillRect(6, 26, 7, 7); x.fillRect(19, 28, 7, 7);
    x.strokeStyle = '#00000025'; x.strokeRect(6.5, 26.5, 6, 6); x.strokeRect(19.5, 28.5, 6, 6);
  });
  sprites.forestCamp = c(32, 44, x => {
    x.fillStyle = '#7a5c3a'; x.beginPath(); x.moveTo(5, 38); x.lineTo(16, 20); x.lineTo(27, 38); x.closePath(); x.fill();
    x.fillStyle = '#4a3820'; x.beginPath(); x.moveTo(12, 38); x.lineTo(16, 30); x.lineTo(20, 38); x.closePath(); x.fill();
    x.fillStyle = '#8a6b42'; x.fillRect(22, 33, 9, 3); x.fillRect(23, 29, 9, 3);
  });
  sprites.gatherHut = c(32, 44, x => {
    box(x, 7, 24, 18, 14, '#96784e');
    roof(x, 7, 24, 18, 9, '#5d7a3a');
    x.fillStyle = '#d84848'; x.beginPath(); x.arc(24, 22, 2, 0, 7); x.fill();
    x.fillStyle = '#4a3820'; x.fillRect(13, 31, 5, 7);
  });
  sprites.quarry = c(32, 44, x => {
    x.fillStyle = '#8d939c'; x.beginPath(); x.moveTo(4, 38); x.lineTo(8, 24); x.lineTo(24, 22); x.lineTo(28, 38); x.closePath(); x.fill();
    x.fillStyle = '#6e747d'; x.fillRect(10, 28, 12, 10);
    x.fillStyle = '#3d4148'; x.fillRect(13, 31, 6, 7);
  });
  sprites.library = c(32, 44, x => {
    box(x, 5, 20, 22, 18, '#c9bda0');
    roof(x, 5, 20, 22, 8, '#8d6b4a');
    x.fillStyle = '#8d7a56'; for (let i = 0; i < 3; i++) x.fillRect(8 + i * 6.5, 24, 3, 14);
  });
  sprites.well = c(32, 44, x => {
    x.fillStyle = '#8d939c'; x.beginPath(); x.arc(16, 32, 8, 0, 7); x.fill();
    x.fillStyle = '#2e5f8a'; x.beginPath(); x.arc(16, 32, 5, 0, 7); x.fill();
    x.strokeStyle = '#6b5232'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(9, 32); x.lineTo(9, 20); x.moveTo(23, 32); x.lineTo(23, 20); x.stroke();
    x.fillStyle = '#7a5c38'; x.fillRect(7, 17, 18, 4);
  });
  sprites.sawmill = c(32, 44, x => {
    box(x, 4, 22, 24, 16, '#8a6b46');
    roof(x, 4, 22, 24, 9, '#5d4a30');
    x.fillStyle = '#b8bec8'; x.beginPath(); x.arc(24, 22, 6, 0, 7); x.fill();
    x.fillStyle = '#8d939c'; x.beginPath(); x.arc(24, 22, 2, 0, 7); x.fill();
    x.fillStyle = '#8a6b42'; x.fillRect(2, 34, 10, 3);
  });
  sprites.farm = c(32, 44, x => {
    x.fillStyle = '#7a6234'; x.fillRect(2, 22, 28, 16);
    x.fillStyle = '#c9a83e';
    for (let i = 0; i < 4; i++) x.fillRect(4, 24 + i * 4, 24, 2);
    box(x, 20, 12, 10, 10, '#a04836');
    roof(x, 20, 12, 10, 5, '#7a3428');
  });
  sprites.copperMine = c(32, 44, x => {
    x.fillStyle = '#7b7f88'; x.beginPath(); x.moveTo(3, 38); x.lineTo(10, 22); x.lineTo(24, 22); x.lineTo(29, 38); x.closePath(); x.fill();
    x.fillStyle = '#26221c'; x.beginPath(); x.arc(16, 34, 6, Math.PI, 0); x.fill();
    x.strokeStyle = '#6b5232'; x.lineWidth = 2; x.strokeRect(10, 28, 12, 10);
    x.fillStyle = '#e08d4f'; x.beginPath(); x.arc(24, 25, 2, 0, 7); x.fill();
  });
  sprites.ironMine = c(32, 44, x => {
    x.drawImage(sprites.copperMine, 0, 0);
    x.fillStyle = '#c8cdd8'; x.beginPath(); x.arc(24, 25, 2.4, 0, 7); x.fill();
  });
  sprites.coalMine = c(32, 44, x => {
    x.drawImage(sprites.copperMine, 0, 0);
    x.fillStyle = '#111'; x.beginPath(); x.arc(24, 25, 2.4, 0, 7); x.fill();
  });
  sprites.smelter = c(32, 44, x => {
    box(x, 5, 22, 22, 16, '#9c6b52');
    x.fillStyle = '#6e4a38'; x.fillRect(19, 10, 6, 14);
    x.fillStyle = '#e88a2a'; x.fillRect(9, 30, 6, 8);
    x.fillStyle = '#ffcf5e'; x.fillRect(11, 33, 2, 5);
  });
  sprites.workshop = c(32, 44, x => {
    box(x, 4, 22, 24, 16, '#a08a62');
    roof(x, 4, 22, 24, 9, '#6b563a');
    x.fillStyle = '#5a4a35'; x.fillRect(8, 28, 16, 3);
    x.fillStyle = '#c8cdd8'; x.fillRect(11, 25, 2, 4); x.fillRect(18, 25, 2, 4);
  });
  sprites.market = c(32, 44, x => {
    box(x, 4, 26, 24, 12, '#a08a62');
    // pruhovaná markýza
    for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#c8432e' : '#e8d8b0'; x.fillRect(3 + i * 4.4, 20, 4.4, 7); }
    x.fillStyle = '#ffd777'; x.beginPath(); x.arc(10, 32, 2, 0, 7); x.fill();
    x.fillStyle = '#d84848'; x.beginPath(); x.arc(16, 33, 2, 0, 7); x.fill();
    x.fillStyle = '#4a8040'; x.beginPath(); x.arc(22, 32, 2, 0, 7); x.fill();
  });
  sprites.ironworks = c(32, 44, x => {
    box(x, 4, 24, 24, 14, '#8d7462');
    x.fillStyle = '#5d4a3e'; x.fillRect(6, 12, 5, 14); x.fillRect(21, 15, 5, 11);
    x.fillStyle = '#e88a2a'; x.fillRect(13, 30, 6, 8);
  });
  sprites.brickworks = c(32, 44, x => {
    box(x, 4, 24, 24, 14, '#b06a4e');
    x.fillStyle = '#c4593e';
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) x.fillRect(6 + i * 6 + (r % 2) * 3, 27 + r * 4, 5, 3);
    x.fillStyle = '#6e4a38'; x.fillRect(22, 14, 5, 12);
  });
  sprites.temple = c(32, 44, x => {
    x.fillStyle = '#ded4bc'; x.fillRect(4, 22, 24, 16);
    x.fillStyle = '#c9bda0'; for (let i = 0; i < 4; i++) x.fillRect(6 + i * 6, 24, 3, 14);
    roof(x, 3, 22, 26, 9, '#b8a97e');
    x.fillStyle = '#ffd777'; x.beginPath(); x.arc(16, 17, 2, 0, 7); x.fill();
  });
  sprites.steelworks = c(32, 44, x => {
    box(x, 3, 24, 26, 14, '#7d8492');
    x.fillStyle = '#5a616e'; x.fillRect(6, 12, 6, 14); x.fillRect(20, 14, 6, 12);
    x.fillStyle = '#e88a2a'; x.fillRect(13, 29, 6, 9);
    x.fillStyle = '#ffcf5e'; x.fillRect(15, 32, 2, 6);
  });
  sprites.powerPlant = c(32, 44, x => {
    box(x, 3, 26, 26, 12, '#8d939c');
    // chladicí věž
    x.fillStyle = '#b8bec8'; x.beginPath();
    x.moveTo(8, 26); x.lineTo(11, 10); x.lineTo(19, 10); x.lineTo(22, 26); x.closePath(); x.fill();
    x.fillStyle = '#ffd74a'; x.fillRect(24, 30, 3, 5);
  });
  sprites.factory = c(64, 80, x => {
    box(x, 4, 42, 56, 34, '#8d8492');
    x.fillStyle = '#6e6572';
    x.beginPath(); x.moveTo(4, 42); x.lineTo(18, 30); x.lineTo(18, 42); x.lineTo(32, 30); x.lineTo(32, 42); x.lineTo(46, 30); x.lineTo(46, 42); x.closePath(); x.fill();
    x.fillStyle = '#5a515e'; x.fillRect(48, 14, 8, 28);
    windowPair(x, 10, 52); windowPair(x, 28, 52); windowPair(x, 44, 52);
    x.fillStyle = '#3d3844'; x.fillRect(26, 62, 12, 14);
  });
  sprites.trainStation = c(64, 80, x => {
    box(x, 4, 42, 56, 30, '#a08a62');
    roof(x, 4, 42, 56, 14, '#6b563a');
    x.fillStyle = '#3d3844'; x.fillRect(8, 74, 48, 4);
    x.fillStyle = '#c8cdd8'; x.fillRect(10, 75, 44, 1);
    x.fillStyle = '#5a4a35'; x.fillRect(28, 58, 8, 14);
    windowPair(x, 10, 52); windowPair(x, 44, 52);
  });
  sprites.hitechLab = c(32, 44, x => {
    box(x, 4, 20, 24, 18, '#5f7d94');
    x.fillStyle = '#9fd8e8'; x.fillRect(7, 23, 18, 8);
    x.strokeStyle = '#ffffff40'; x.strokeRect(7.5, 23.5, 17, 7);
    x.fillStyle = '#6fd8c8'; x.beginPath(); x.arc(16, 17, 3, 0, 7); x.fill();
  });
  sprites.monument = c(64, 80, x => {
    x.fillStyle = '#b8ab8c'; x.fillRect(14, 66, 36, 10);
    x.fillStyle = '#cabf9e';
    x.beginPath(); x.moveTo(24, 66); x.lineTo(29, 16); x.lineTo(35, 16); x.lineTo(40, 66); x.closePath(); x.fill();
    x.fillStyle = '#ffd777'; x.beginPath(); x.moveTo(29, 16); x.lineTo(32, 6); x.lineTo(35, 16); x.closePath(); x.fill();
  });
  // ---- parky a dekorace ----
  sprites.park = c(32, 44, x => {
    x.fillStyle = '#4a8040'; x.fillRect(3, 26, 26, 12);
    x.fillStyle = '#5b4327'; x.fillRect(13, 29, 3, 7);
    x.fillStyle = '#3f7a38'; x.beginPath(); x.arc(14, 23, 7, 0, 7); x.fill();
    x.fillStyle = '#8a6b42'; x.fillRect(21, 32, 8, 2); x.fillRect(21, 34, 2, 3); x.fillRect(27, 34, 2, 3);
    x.fillStyle = '#d84a8a'; x.fillRect(6, 33, 2, 2);
    x.fillStyle = '#e8d84a'; x.fillRect(9, 35, 2, 2);
  });
  sprites.fountain = c(32, 44, x => {
    x.fillStyle = '#9aa0a8'; x.beginPath(); x.arc(16, 32, 9, 0, 7); x.fill();
    x.fillStyle = '#3d78b8'; x.beginPath(); x.arc(16, 32, 6.5, 0, 7); x.fill();
    x.fillStyle = '#9aa0a8'; x.fillRect(14.5, 22, 3, 10);
    x.fillStyle = '#8fc8f0'; x.beginPath(); x.arc(16, 22, 2.5, 0, 7); x.fill();
    x.fillStyle = 'rgba(200,232,255,.55)'; x.fillRect(12, 24, 1.5, 6); x.fillRect(18.5, 24, 1.5, 6);
  });
  sprites.statue = c(32, 44, x => {
    x.fillStyle = '#8d939c'; x.fillRect(10, 32, 12, 6);
    x.fillStyle = '#aab0b8'; x.fillRect(12.5, 20, 7, 12);
    x.fillStyle = '#c8ced8'; x.beginPath(); x.arc(16, 17, 3.5, 0, 7); x.fill();
    x.fillRect(19, 18, 5, 2);
    x.fillStyle = '#ffd74a'; x.beginPath(); x.arc(24.5, 17, 1.8, 0, 7); x.fill();
  });

  // ---- rybaření ----
  sprites.fishHut = c(32, 44, x => {
    box(x, 6, 24, 20, 14, '#8a7250');
    roof(x, 6, 24, 20, 9, '#5d6e7a');
    x.strokeStyle = '#4a3820'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(24, 20); x.lineTo(29, 14); x.stroke(); // prut
    x.strokeStyle = '#c8d8e8'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(29, 14); x.lineTo(29, 22); x.stroke();
    x.fillStyle = '#6fa8d8'; x.beginPath(); x.arc(29, 23, 1.5, 0, 7); x.fill();
    x.fillStyle = '#4a3820'; x.fillRect(13, 31, 5, 7);
  });
  sprites.fishShoal = c(32, 40, x => {
    x.strokeStyle = 'rgba(220,240,255,.5)'; x.lineWidth = 1.5;
    x.beginPath(); x.arc(16, 28, 8, 0, 7); x.stroke();
    x.beginPath(); x.arc(16, 28, 4.5, 0, 7); x.stroke();
    x.fillStyle = '#9fc8e8';
    // rybky
    for (const [fx, fy, fl] of [[12, 26, 1], [19, 29, -1], [15, 31, 1]]) {
      x.beginPath(); x.ellipse(fx, fy, 2.6, 1.2, 0, 0, 7); x.fill();
      x.beginPath(); x.moveTo(fx + 2.6 * (fl as number), fy); x.lineTo(fx + 4 * (fl as number), fy - 1.4); x.lineTo(fx + 4 * (fl as number), fy + 1.4); x.fill();
    }
  });
  sprites.fishEmpty = c(32, 40, x => {
    x.strokeStyle = 'rgba(220,240,255,.25)'; x.lineWidth = 1.2;
    x.beginPath(); x.arc(16, 28, 6, 0, 7); x.stroke();
  });

  // ---- velké budovy (sloučené 4-v-1) ----
  const bigCustom: Record<string, (x: CanvasRenderingContext2D) => void> = {
    farm: x => { // velkostatek: lány, stodola, silo, plot
      x.fillStyle = '#7a6234'; x.fillRect(2, 30, 60, 46);
      x.fillStyle = '#c9a83e';
      for (let i = 0; i < 9; i++) x.fillRect(4, 33 + i * 4.8, 56, 2.4);
      box(x, 38, 14, 22, 18, '#a04836');
      roof(x, 38, 14, 22, 8, '#7a3428');
      x.fillStyle = '#c8ced8'; x.fillRect(28, 14, 8, 18);
      x.fillStyle = '#8d939c'; x.beginPath(); x.arc(32, 14, 4, Math.PI, 0); x.fill();
      x.fillStyle = '#8a6b42'; for (let i = 0; i < 15; i++) x.fillRect(2 + i * 4.2, 74, 2, 4);
    },
    hut: x => { // dvůr: tři chatrče kolem dvorku s ohništěm
      x.fillStyle = '#b09a72'; x.fillRect(6, 42, 52, 32);
      x.drawImage(sprites.hut, 2, 6, 28, 38);
      x.drawImage(sprites.hut, 34, 6, 28, 38);
      x.drawImage(sprites.hut, 18, 34, 28, 38);
      x.fillStyle = '#e88a2a'; x.beginPath(); x.arc(32, 64, 3, 0, 7); x.fill();
    },
  };
  for (const t of ['farm', 'hut', 'house', 'forestCamp', 'gatherHut', 'quarry', 'sawmill', 'copperMine', 'ironMine', 'coalMine', 'library', 'market']) {
    sprites['big:' + t] = c(64, 80, x => {
      if (bigCustom[t]) { bigCustom[t](x); return; }
      // generická velká budova: podesta + zvětšený model + prapor
      x.fillStyle = '#9a917a'; x.fillRect(2, 68, 60, 10);
      x.strokeStyle = '#00000030'; x.strokeRect(2.5, 68.5, 59, 9);
      x.drawImage(sprites[t], 8, 6, 48, 66);
      x.strokeStyle = '#5a4a35'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(57, 30); x.lineTo(57, 10); x.stroke();
      x.fillStyle = '#d29922'; x.beginPath(); x.moveTo(57, 10); x.lineTo(64, 13.5); x.lineTo(57, 17); x.fill();
    });
  }
}

/** noční okna – souřadnice per budova (px v spritu) */
export const NIGHT_WINDOWS: Record<string, [number, number][]> = {
  hut: [[9, 27], [17, 27]],
  house: [[7, 21], [15, 21], [7, 29], [15, 29]],
  library: [[10, 26]],
  workshop: [[11, 25], [18, 25]],
  market: [[10, 30]],
  factory: [[10, 52], [28, 52], [44, 52]],
  hitechLab: [[10, 24], [18, 24]],
  temple: [[14, 28]],
};
