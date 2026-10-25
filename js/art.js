'use strict';
/* =========================================================
   KLINGENHORT – Prozedurale Pixel-Grafik
   Waffen je Form und Material, Rüstungs-Icons, Umhänge, Flügel,
   Kronen, Weltkarte, Versteck-Stationen
   ========================================================= */

const OUT = '#1a1420';
const WOOD = ['#5e3a1e', '#8a5a32', '#b07a48'], LEATH = ['#4a2a18', '#6a4224', '#a8743e'], GOLDC = ['#9c6a24', '#e8b04a', '#ffe08a'], BONE = ['#a8a08a', '#e8e2cf', '#fffaf0'];
const ORB = ['#79c24e', '#ff8a3a', '#57c7e6', '#a070f0', '#ff5a2a', '#ff7a2a', '#9aa2ff', '#ffe08a'];

/* ---------- Pixelpuffer ---------- */
function PB(w, h) {
  const a = new Array(w * h).fill(null);
  return {
    w, h, a,
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < w && y < h) a[y * w + x] = c; },
    get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? a[y * w + x] : null; },
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) this.set(x + i, y + j, c); },
    line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let k = 0; k <= n; k++) this.set(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, c); },
    disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + .3) this.set(x, y, c); }
  };
}
function pbOutline(b, col) {
  const o = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (!b.get(x, y) && (b.get(x - 1, y) || b.get(x + 1, y) || b.get(x, y - 1) || b.get(x, y + 1))) o.push([x, y]);
  for (const [x, y] of o) b.set(x, y, col || OUT);
  return b;
}
function pbCanvas(b) { return mk(b.w, b.h, g => { for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const c = b.a[y * b.w + x]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } } }); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- Waffen ---------- */
function wform(it) { const F = WFORM[it.base]; if (!F) return {}; return F.find(f => f.id === it.form) || F.find(f => f.std) || F[0]; }
function itemArtKey(it) { return it.slot + it.base + (it.form || '') + it.tier + '.' + it.rar + (it.myth || '') + (it.set || '') + (it.name ? 'n' : ''); }
function gemCol(it) { return it.myth ? '#ff4fd8' : it.set ? '#4ade80' : RAR[it.rar].c; }
const WACACHE = {};
function weaponArt(it) {
  const k = itemArtKey(it); if (WACACHE[k]) return WACACHE[k];
  const F = wform(it), M = MAT[clamp(it.tier, 0, TIERS - 1)].m, R = mulberry(hashStr(k));
  const fancy = it.rar >= 4 || it.set, guard = fancy || it.tier >= 4 ? GOLDC : [M[0], M[1], M[2]];
  let res;
  if (it.base === 'sword') res = artSword(F, M, guard, it, R);
  else if (it.base === 'axe') res = artAxe(F, M, guard, it, R);
  else if (it.base === 'dagger') res = artDagger(F, M, guard, it, R);
  else if (it.base === 'bow') res = F.id === 'arm' ? artCrossbow(M, guard, it) : artBow(F, M, guard, it, R);
  else res = artStaff(F, M, guard, it, R);
  return WACACHE[k] = res;
}
function bladeRow(b, x, y, ww, M, fuller) { for (let i = 0; i < ww; i++) b.set(x + i, y, i === 0 ? M[3] : i === ww - 1 ? M[1] : fuller && i === Math.floor(ww / 2) ? M[1] : M[2]); }
function sparkle(b, it, R) { if (it.tier === 6 || it.myth) for (let k = 0; k < 3; k++) { const x = Math.floor(R() * b.w), y = Math.floor(R() * b.h * .6); if (b.get(x, y) && b.get(x, y) !== OUT) b.set(x, y, '#ffffff'); } }
function artSword(F, M, G, it, R) {
  const len = F.len + (it.tier >= 5 ? 1 : 0), w = F.w, big = F.big ? 1 : 0, curve = F.curve ? 3 : 0, gl = big ? 6 : 4;
  const bl = 4 + big, W = bl + w + 4 + big + curve, H = len + gl + 7, b = PB(W, H);
  const tipLen = Math.ceil((w - 1) / 2);
  for (let y = 1; y <= len; y++) {
    const off = curve ? Math.round(curve * Math.pow((len - y) / len, 2)) : 0;
    let ww = Math.max(1, w - Math.max(0, tipLen - y + 1) * 2), lx = bl + off + Math.floor((w - ww) / 2);
    if (F.wavy && y > 2 && y < len - 1 && (y >> 1) % 2) { lx++; ww--; }
    bladeRow(b, lx, y, ww, M, w >= 4 && y > 3 && y < len - 1);
  }
  const gy = len + 1, gx = bl - 2 - big, gw = w + 4 + big * 2;
  b.rect(gx, gy, gw, 1, G[1]); b.rect(gx, gy + 1, gw, 1, G[0]); b.set(gx, gy, G[2]);
  if (it.tier >= 3 || it.rar >= 3) { b.set(gx, gy - 1, G[1]); b.set(gx + gw - 1, gy - 1, G[1]); }
  if (it.tier >= 4 || it.rar >= 4) { b.set(gx - 1, gy - 2, G[1]); b.set(gx + gw, gy - 2, G[1]); }
  const cx = bl + Math.floor(w / 2);
  if (it.rar >= 2) { b.set(cx, gy, gemCol(it)); if (w >= 4) b.set(cx - 1, gy, gemCol(it)); }
  const hx = cx - 1;
  for (let y = gy + 2; y < gy + 2 + gl; y++) { b.set(hx, y, (y & 1) ? LEATH[2] : LEATH[1]); b.set(hx + 1, y, LEATH[0]); }
  const py = gy + 2 + gl; b.rect(hx, py, 2, 1, G[1]); b.set(hx, py + 1, G[0]); b.set(hx + 1, py + 1, G[0]);
  if (it.rar >= 3) b.set(hx, py, gemCol(it));
  sparkle(b, it, R);
  return { c: pbCanvas(pbOutline(b)), ox: hx + 1, oy: gy + 3, bow: false };
}
function artAxe(F, M, G, it, R) {
  const id = F.id, H = id === 'helle' ? 30 : id === 'beil' ? 18 : 24, W = 17, hx = 7, b = PB(W, H);
  const metalHaft = it.tier >= 5, HF = metalHaft ? [M[0], M[1]] : [WOOD[0], WOOD[1]];
  const top = id === 'helle' ? 7 : 2;
  for (let y = top; y < H - 2; y++) { b.set(hx, y, HF[1]); b.set(hx + 1, y, HF[0]); }
  const blade = (y0, prof, dir) => prof.forEach((wd, r) => { for (let i = 0; i < wd; i++) { const x = dir > 0 ? hx + 2 + i : hx - 1 - i; b.set(x, y0 + r, i === wd - 1 ? M[3] : i === 0 ? M[1] : M[2]); } });
  if (id === 'beil') blade(3, [2, 3, 4, 4, 3, 2], 1);
  else if (id === 'streit') { blade(2, [2, 3, 5, 6, 6, 6, 5, 3, 2], 1); b.rect(hx - 2, 5, 2, 2, M[1]); b.set(hx - 3, 5, M[2]); }
  else if (id === 'doppel') { const p = [2, 4, 5, 6, 6, 6, 5, 4, 2]; blade(2, p, 1); blade(2, p, -1); }
  else if (id === 'barte') { blade(2, [2, 3, 3, 3, 4, 5, 6, 6, 5, 3], 1); b.set(hx + 7, 10, M[3]); }
  else if (id === 'hammer') { b.rect(hx - 3, 2, 8, 6, M[2]); b.rect(hx - 3, 2, 8, 1, M[3]); b.rect(hx - 3, 7, 8, 1, M[1]); b.rect(hx - 3, 2, 1, 6, M[3]); b.rect(hx + 4, 2, 1, 6, M[1]); b.rect(hx - 1, 4, 4, 2, M[1]); }
  else if (id === 'helle') { b.set(hx, 0, M[3]); b.rect(hx, 1, 2, 6, M[2]); b.set(hx, 1, M[3]); b.set(hx, 2, M[3]); blade(8, [2, 4, 5, 5, 4, 2], 1); b.set(hx - 1, 9, M[2]); b.set(hx - 2, 10, M[2]); }
  const band = id === 'helle' ? 14 : id === 'hammer' ? 8 : 11; b.rect(hx, band, 2, 1, G[1]);
  if (it.rar >= 2) b.set(hx, band, gemCol(it));
  b.rect(hx, H - 3, 2, 1, G[0]);
  for (let y = H - 7; y < H - 3; y++) b.set(hx, y, (y & 1) ? LEATH[2] : LEATH[1]);
  if (it.tier >= 4 || it.rar >= 4) { b.set(hx - 1, band, G[1]); b.set(hx + 2, band, G[1]); }
  sparkle(b, it, R);
  return { c: pbCanvas(pbOutline(b)), ox: hx + 1, oy: H - 5, bow: false };
}
function artDagger(F, M, G, it, R) {
  const id = F.id, len = id === 'stilett' ? 10 : id === 'katar' ? 7 : 8, W = 10, H = len + 9, b = PB(W, H), cx = 4;
  if (id === 'sichel') {
    for (let y = 2; y <= len; y++) { const off = y < 4 ? 4 - y : 0; bladeRow(b, cx + off, y, 2, M, false); }
    b.set(cx + 3, 1, M[3]); b.set(cx + 4, 2, M[2]);
  } else if (id === 'katar') {
    for (let y = 1; y <= len; y++) { const ww = Math.min(4, 1 + Math.floor((y - 1) * .8)); bladeRow(b, cx - Math.floor((ww - 1) / 2), y, ww, M, false); }
  } else {
    const w = id === 'stilett' ? 1 : 2;
    for (let y = 1; y <= len; y++) { let x = cx; if (id === 'kris' && y > 1 && y < len - 1) x += (y >> 1) % 2 ? 1 : 0; const ww = y === 1 ? 1 : w; bladeRow(b, x, y, ww, M, false); if (w === 1) b.set(x + 1, y, y > 2 ? M[1] : null); }
  }
  const gy = len + 1;
  if (id === 'katar') { b.rect(cx - 2, gy, 6, 1, G[1]); b.rect(cx - 2, gy + 1, 1, 4, G[0]); b.rect(cx + 3, gy + 1, 1, 4, G[0]); b.rect(cx - 1, gy + 3, 4, 1, LEATH[2]); }
  else { b.rect(cx - 2, gy, 6, 1, G[1]); if (it.rar >= 2) b.set(cx, gy, gemCol(it)); for (let y = gy + 1; y < gy + 4; y++) { b.set(cx, y, (y & 1) ? LEATH[2] : LEATH[1]); b.set(cx + 1, y, LEATH[0]); } b.rect(cx, gy + 4, 2, 1, G[1]); }
  sparkle(b, it, R);
  return { c: pbCanvas(pbOutline(b)), ox: cx + 1, oy: gy + 2, bow: false };
}
function artBow(F, M, G, it, R) {
  const id = F.id, H = id === 'lang' ? 30 : id === 'kurz' ? 22 : 26, depth = id === 'kurz' ? 4 : 5, W = 11, b = PB(W, H);
  const L = it.tier <= 1 ? [WOOD[0], WOOD[1], WOOD[2]] : [M[0], M[1], M[2]], sx = 2;
  for (let y = 2; y <= H - 3; y++) b.set(sx, y, '#e8e2cf');
  for (let y = 1; y <= H - 2; y++) {
    const u = (y - 1) / (H - 3); let x = sx + Math.round(depth * Math.sin(Math.PI * u));
    if (id === 'reflex' && (u < .1 || u > .9)) x -= 1;
    b.set(x, y, L[1]); b.set(x + 1, y, L[0]); if (id === 'lang' || it.tier >= 3) b.set(x - 1, y, L[2]);
  }
  const mid = Math.floor(H / 2), mx = sx + depth; b.rect(mx - 1, mid - 2, 3, 4, LEATH[1]); b.set(mx - 1, mid - 1, LEATH[2]);
  b.rect(sx - 1, 0, 2, 2, G[1]); b.rect(sx - 1, H - 2, 2, 2, G[1]);
  if (it.tier >= 3 || it.rar >= 3) for (const u of [.25, .75]) { const y = Math.round(1 + u * (H - 3)), x = sx + Math.round(depth * Math.sin(Math.PI * u)); b.set(x, y, G[2]); b.set(x + 1, y, G[1]); }
  if (it.rar >= 2) b.set(mx, mid, gemCol(it));
  sparkle(b, it, R);
  return { c: pbCanvas(pbOutline(b)), ox: Math.floor(W / 2), oy: mid, bow: true };
}
function artCrossbow(M, G, it) {
  const W = 19, H = 15, b = PB(W, H), y0 = 7;
  b.rect(1, y0, 13, 1, WOOD[2]); b.rect(1, y0 + 1, 13, 1, WOOD[1]); b.rect(1, y0 + 2, 4, 1, WOOD[0]); b.rect(4, y0 + 2, 2, 2, LEATH[1]);
  for (let y = 1; y <= 13; y++) { const x = 13 + Math.round(1.8 * Math.sin(Math.PI * (y - 1) / 12)); b.set(x, y, M[2]); b.set(x + 1, y, M[1]); }
  b.line(13, 1, 8, y0, '#e8e2cf'); b.line(13, 13, 8, y0 + 1, '#e8e2cf');
  b.rect(10, y0 - 1, 6, 1, M[3]); b.set(16, y0 - 1, M[3]);
  if (it.rar >= 2) b.set(13, y0, gemCol(it));
  b.set(14, 0, G[1]); b.set(14, 14, G[1]);
  return { c: pbCanvas(pbOutline(b)), ox: 7, oy: y0, bow: true };
}
function artStaff(F, M, G, it, R) {
  const id = F.id, H = id === 'zepter' ? 24 : 31, W = 13, cx = 6, b = PB(W, H), oc = it.myth ? '#ff4fd8' : ORB[clamp(it.tier, 0, 7)];
  const S = id === 'knochen' ? BONE : it.tier >= 3 ? [M[0], M[1], M[2]] : WOOD;
  for (let y = 8; y < H - 1; y++) { b.set(cx - 1, y, S[1]); b.set(cx, y, S[0]); }
  if (id !== 'knochen') for (let y = 12; y < H - 1; y += 6) b.rect(cx - 1, y, 2, 1, G[1]);
  if (id === 'stab') { b.disc(cx - .5, 4, 2.6, oc); b.set(cx - 2, 3, '#fff'); for (const s of [-1, 1]) { const x = s < 0 ? cx - 4 : cx + 3; b.line(x, 6, x, 2, M[2]); b.set(s < 0 ? x + 1 : x - 1, 7, M[1]); b.set(x, 1, M[3]); } }
  else if (id === 'zepter') { b.rect(cx - 3, 5, 6, 3, G[1]); b.rect(cx - 3, 7, 6, 1, G[0]); for (const x of [cx - 3, cx - 1, cx + 1, cx + 2]) b.set(x, 4, G[2]); b.rect(cx - 1, 2, 2, 3, oc); b.set(cx - 1, 2, '#fff'); }
  else if (id === 'kristall') { [1, 3, 3, 5, 5, 5, 3, 1].forEach((wd, r) => { for (let i = 0; i < wd; i++) b.set(cx - Math.floor(wd / 2) - (wd % 2 ? 0 : 1) + i, r, i === 0 ? '#ffffff' : oc); }); b.set(cx, 3, '#fff'); b.rect(cx - 2, 8, 4, 1, G[1]); }
  else if (id === 'knochen') { b.rect(cx - 3, 2, 6, 5, BONE[1]); b.rect(cx - 2, 7, 4, 1, BONE[1]); b.rect(cx - 3, 2, 6, 1, BONE[2]); b.set(cx - 2, 4, it.tier >= 3 ? oc : OUT); b.set(cx + 1, 4, it.tier >= 3 ? oc : OUT); b.set(cx - 1, 6, BONE[0]); b.set(cx, 6, BONE[0]); }
  else if (id === 'mond') { for (let y = 0; y < 10; y++) for (let x = 0; x < W; x++) { const d1 = Math.hypot(x - cx, y - 5), d2 = Math.hypot(x - cx - 2.4, y - 3.6); if (d1 <= 4.6 && d2 > 3.4) b.set(x, y, x < cx - 2 ? M[3] : M[2]); } b.disc(cx - .5, 5, 1, oc); }
  if (it.rar >= 4 || it.set) { b.set(cx - 2, 9, G[2]); b.set(cx + 1, 9, G[2]); }
  sparkle(b, it, R);
  return { c: pbCanvas(pbOutline(b)), ox: cx, oy: H - 6, bow: false };
}
/* Farbe des Zauberstab-Kopfes / Klingenglanz für Licht und Partikel */
function weaponGlow(it) { return it.base === 'staff' ? (it.myth ? '#ff4fd8' : ORB[clamp(it.tier, 0, 7)]) : (MAT[clamp(it.tier, 0, 7)].glow || MAT[clamp(it.tier, 0, 7)].m[3]); }

/* ---------- Rüstung & Helm (Icons) ---------- */
const AACACHE = {};
function armorArt(it, cls) {
  const st = CLASSES[cls].style, k = itemArtKey(it) + st; if (AACACHE[k]) return AACACHE[k];
  const T = MAT[clamp(it.tier, 0, 7)], a = T.c[0], s = T.c[1], h = T.m[3], t = it.rar >= 4 || it.set || it.tier >= 4 ? GOLDC[1] : T.m[1], gem = gemCol(it), b = PB(16, 16);
  if (it.slot === 'armor') {
    if (st === 'plate') {
      for (let y = 3; y < 13; y++) { const ww = y < 10 ? 10 : 8, x0 = 8 - ww / 2; for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); b.set(x0, y, h); }
      b.disc(3.5, 3.5, 2.2, a); b.disc(12, 3.5, 2.2, s); b.set(3, 2, h); b.rect(6, 2, 4, 2, null);
      b.rect(6, 3, 4, 1, s); b.rect(7, 4, 2, 6, t); b.rect(4, 10, 8, 1, t); b.rect(5, 13, 2, 2, s); b.rect(9, 13, 2, 2, s);
    } else if (st === 'robe') {
      for (let y = 2; y < 15; y++) { const ww = Math.min(13, 5 + Math.floor((y - 2) * .8)), x0 = 8 - Math.floor(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); }
      b.rect(2, 4, 2, 5, s); b.rect(12, 4, 2, 5, s); b.rect(6, 2, 4, 2, t); b.rect(7, 4, 2, 10, t); b.rect(3, 14, 10, 1, t); b.rect(4, 8, 8, 1, LEATH[1]);
    } else if (st === 'cloak') {
      b.disc(8, 4, 3.6, s); b.disc(8, 4.5, 2.2, OUT);
      for (let y = 6; y < 15; y++) { const ww = Math.min(13, 7 + (y - 6)), x0 = 8 - Math.floor(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); b.set(8, y, '#1e1828'); }
      b.set(5, 7, h); b.rect(7, 7, 2, 1, t);
    } else {
      for (let y = 3; y < 14; y++) { const ww = 9, x0 = 4; for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < 4 ? a : s); }
      b.rect(3, 3, 2, 3, s); b.rect(12, 3, 2, 3, s); b.rect(6, 3, 4, 2, null); b.rect(6, 3, 4, 1, LEATH[1]);
      for (let y = 5; y < 10; y++) b.set(y % 2 ? 7 : 8, y, LEATH[2]); b.rect(4, 10, 9, 1, LEATH[1]); b.set(8, 10, t);
    }
  } else {
    if (st === 'plate') {
      for (let y = 4; y < 13; y++) { const ww = y < 6 ? 7 : 9, x0 = 8 - Math.ceil(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); b.set(x0, y, h); }
      b.rect(5, 8, 7, 1, OUT); b.rect(7, 9, 1, 3, OUT); b.rect(9, 9, 1, 3, OUT);
      if (T.pl) { b.rect(7, 1, 3, 3, T.pl[0]); b.set(10, 2, T.pl[1]); b.set(10, 1, T.pl[1]); }
    } else if (st === 'robe') {
      for (let y = 1; y < 11; y++) { const ww = Math.max(1, Math.floor(y * .7)), x0 = 7 - Math.floor(ww / 2) + Math.round((10 - y) * .25); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); }
      b.rect(1, 11, 14, 2, s); b.rect(2, 11, 6, 1, a); b.rect(4, 10, 8, 1, t);
    } else if (st === 'cloak') {
      for (let y = 2; y < 14; y++) { const ww = y < 4 ? 7 : y > 11 ? 7 : 9, x0 = 8 - Math.ceil(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); }
      b.rect(4, 6, 3, 2, OUT); b.rect(9, 6, 3, 2, OUT); b.set(5, 6, it.tier >= 4 ? T.m[3] : '#e8e2cf'); b.set(10, 6, it.tier >= 4 ? T.m[3] : '#e8e2cf'); b.rect(6, 10, 4, 1, s);
    } else {
      for (let x = 2; x < 14; x++) { const y = 8 + Math.round(Math.abs(x - 7.5) * -.35 + 1.5); b.set(x, y, a); b.set(x, y + 1, s); }
      b.line(11, 7, 14, 1, '#f0f0f0'); b.line(12, 7, 14, 2, T.c[0]); b.set(14, 0, '#fff');
    }
  }
  if (it.rar >= 2) b.set(8, it.slot === 'armor' ? 5 : 9, gem);
  return AACACHE[k] = pbCanvas(pbOutline(b));
}

/* ---------- Kleine Icons (Versteck, Karte) ---------- */
const PACACHE = {};
function artIcon(name) {
  if (PACACHE[name]) return PACACHE[name];
  const b = PB(16, 16);
  switch (name) {
    case 'feuer': b.rect(3, 12, 10, 2, WOOD[1]); b.line(3, 14, 12, 11, WOOD[0]); b.line(3, 11, 12, 14, WOOD[2]); b.disc(8, 8, 3.2, '#ff6a2a'); b.disc(8, 9, 2, '#ffb03a'); b.rect(7, 3, 2, 4, '#ff6a2a'); b.set(8, 9, '#fff0a0'); b.set(6, 5, '#ffb03a'); break;
    case 'frage': b.disc(8, 8, 6.5, '#2a4a6a'); b.disc(8, 8, 5.5, '#3a6a8a'); b.rect(6, 4, 4, 1, '#bfefff'); b.rect(10, 5, 1, 3, '#bfefff'); b.rect(8, 8, 2, 1, '#bfefff'); b.rect(8, 9, 1, 2, '#bfefff'); b.rect(8, 12, 1, 1, '#bfefff'); break;
    case 'amboss': b.rect(2, 5, 12, 3, '#6a707c'); b.rect(2, 5, 12, 1, '#a8b0bc'); b.rect(0, 5, 3, 2, '#6a707c'); b.rect(5, 8, 6, 2, '#4a505c'); b.rect(3, 10, 10, 3, '#4a505c'); b.rect(3, 10, 10, 1, '#7a828e'); break;
    case 'kessel': b.disc(8, 10, 5, '#3a3440'); b.rect(3, 6, 10, 2, '#4a4450'); b.disc(8, 7, 3.5, '#79c24e'); b.set(6, 5, '#c8f06a'); b.set(9, 3, '#c8f06a'); b.rect(4, 14, 2, 2, '#3a3440'); b.rect(10, 14, 2, 2, '#3a3440'); break;
    case 'juwel': [1, 3, 5, 7, 7, 5, 3, 1].forEach((wd, r) => b.rect(8 - Math.ceil(wd / 2), 4 + r, wd, 1, r < 3 ? '#9ee8f0' : '#57a7d6')); b.set(6, 6, '#fff'); b.rect(3, 4, 10, 1, '#c8f0ff'); break;
    case 'truhe': b.rect(2, 6, 12, 8, '#8a5a32'); b.rect(2, 4, 12, 3, '#b07a48'); b.rect(2, 9, 12, 1, '#e8b04a'); b.rect(7, 8, 2, 3, '#ffd24a'); b.rect(2, 13, 12, 1, '#5e3a1e'); break;
    case 'puppe': b.rect(7, 2, 3, 3, '#c8a878'); b.rect(5, 5, 7, 6, '#c8a878'); b.rect(3, 6, 11, 2, '#a8865a'); b.rect(8, 11, 1, 4, WOOD[1]); b.disc(8.5, 7.5, 1.4, '#c8342c'); break;
    case 'rad': b.disc(8, 7, 6, '#9c6a24'); b.disc(8, 7, 5, '#e8b04a'); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; b.line(8, 7, 8 + Math.cos(a) * 5, 7 + Math.sin(a) * 5, k % 2 ? '#c8342c' : '#57a7d6'); } b.disc(8, 7, 1, '#ffe08a'); b.rect(7, 13, 2, 3, WOOD[1]); break;
    case 'buch': b.rect(3, 3, 10, 11, '#7a2a2a'); b.rect(4, 3, 9, 10, '#a83a3a'); b.rect(4, 12, 9, 1, '#efe2bf'); b.rect(7, 6, 4, 2, '#e8b04a'); b.rect(3, 3, 1, 11, '#4a1414'); break;
    case 'mine': b.rect(2, 4, 12, 10, '#4a4450'); b.rect(4, 6, 8, 8, '#16121e'); b.rect(3, 4, 10, 2, WOOD[1]); b.rect(3, 6, 2, 8, WOOD[0]); b.rect(11, 6, 2, 8, WOOD[0]); b.rect(6, 11, 4, 2, '#9aa2ae'); b.set(7, 11, '#9ee8f0'); break;
    case 'garten': b.rect(2, 11, 12, 3, '#5e3a1e'); for (const x of [4, 8, 12]) { b.rect(x - 1, 6, 1, 5, '#3a7a2a'); b.disc(x - 1, 6, 1.5, '#79c24e'); } b.set(7, 4, '#f786a0'); break;
    case 'spiegel': b.rect(4, 1, 8, 13, '#e8b04a'); b.rect(5, 2, 6, 11, '#8ec8e6'); b.line(6, 4, 8, 2, '#e8f8ff'); b.line(6, 7, 10, 3, '#c8e8f8'); b.rect(6, 14, 4, 1, '#9c6a24'); break;
    case 'portal': b.disc(8, 8, 6.5, '#6a48c0'); b.disc(8, 8, 5, '#b892f4'); b.disc(8, 8, 3.5, '#2a1e3a'); b.disc(8, 8, 1.5, '#e8d8ff'); break;
    case 'muenze': b.disc(8, 8, 5.5, '#9c6a24'); b.disc(8, 8, 4.5, '#ffd24a'); b.rect(7, 5, 2, 6, '#e8b04a'); b.rect(6, 7, 4, 1, '#fff3c0'); b.set(6, 6, '#fff'); break;
    case 'bau': b.rect(2, 3, 2, 12, WOOD[1]); b.rect(12, 3, 2, 12, WOOD[1]); b.rect(1, 5, 14, 2, WOOD[2]); b.rect(1, 10, 14, 2, WOOD[2]); b.rect(6, 7, 4, 3, '#e8b04a'); b.set(8, 8, '#1a1420'); break;
    case 'held': b.disc(8, 5, 3, '#fccba3'); b.rect(5, 9, 7, 6, '#57a7d6'); break;
  }
  return PACACHE[name] = pbCanvas(pbOutline(b));
}

/* ---------- Held: Umhang, Flügel, Kopfschmuck ----------
   g = Zeichenfläche, (ox, oy) = linke obere Ecke des Einzelbilds, m = Ankerpunkte */
function headgearOf(helm) {
  if (!helm) return null;
  if (helm.rar === 6) return 'halo';
  if (helm.rar === 4 || helm.tier >= 7) return 'crown';
  if (helm.tier === 4 || helm.tier === 5) return 'horns';
  return null;
}
function capeCols(L) {
  if (L.ccape) { const C = COSM[L.ccape]; return { a: C.c[0], b: C.c[1], trim: C.trim, stars: C.stars }; }
  if (L.cape >= 0 && CAPES[L.cape]) return { a: CAPES[L.cape][1], b: CAPES[L.cape][2] };
  return null;
}
function drawCape(g, ox, oy, m, cc, moving, ph) {
  const y0 = m.sy - 2, y1 = m.feet - 1, bx = m.back + 3;
  let lastLeft = m.back;
  for (let y = y0; y <= y1; y++) {
    const k = (y - y0) / Math.max(1, y1 - y0), fl = moving ? 1.4 + Math.sin(ph + k * 2.5) * 1.1 : .3 + Math.sin(T * 2 + k * 2) * .35;
    const left = m.back - Math.round(1 + k * 3.2 + k * fl); lastLeft = left;
    g.fillStyle = OUT; g.fillRect(ox + left - 1, oy + y, 1, 1);
    g.fillStyle = cc.b; g.fillRect(ox + left, oy + y, 1, 1);
    g.fillStyle = y === y0 ? cc.b : cc.a; g.fillRect(ox + left + 1, oy + y, bx - left, 1);
    if (k > .3 && (y & 1)) { g.fillStyle = cc.b; g.fillRect(ox + left + 2, oy + y, 1, 1); }
  }
  g.fillStyle = OUT; g.fillRect(ox + lastLeft - 1, oy + y1 + 1, bx - lastLeft + 1, 1);
  if (cc.trim) { g.fillStyle = cc.trim; g.fillRect(ox + lastLeft, oy + y1, bx - lastLeft, 1); g.fillRect(ox + m.back - 1, oy + y0, 3, 1); }
  if (cc.stars) { g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) if (Math.floor(T * 3 + i) % 3) g.fillRect(ox + m.back - 1 - i, oy + y0 + 3 + i * 3, 1, 1); }
}
/* Dreieck und Linie Pixel für Pixel (ohne Kantenglättung) */
function triPx(g, a, b, c, col) {
  const x0 = Math.floor(Math.min(a[0], b[0], c[0])), x1 = Math.ceil(Math.max(a[0], b[0], c[0])), y0 = Math.floor(Math.min(a[1], b[1], c[1])), y1 = Math.ceil(Math.max(a[1], b[1], c[1]));
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  g.fillStyle = col;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const p = [x + .5, y + .5], d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a); if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) g.fillRect(x, y, 1, 1); }
}
function lineP(g, a, b, col) { const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1)); g.fillStyle = col; for (let k = 0; k <= n; k++) g.fillRect(Math.round(a[0] + (b[0] - a[0]) * k / n), Math.round(a[1] + (b[1] - a[1]) * k / n), 1, 1); }
function drawWings(g, ox, oy, m, C, moving) {
  const ax = ox + m.back + 4, ay = oy + m.sy - 1, fl = Math.sin(T * (moving ? 16 : 5)) * (moving ? 18 : 8);
  const layer = (dx, dy, sc, cA, cB) => {
    const A = [ax + dx, ay + dy], tips = [92, 114, 136, 158, 180].map((a0, i) => { const a = (a0 + fl) * Math.PI / 180, L = [12, 16, 16, 13, 9][i] * sc; return [A[0] + Math.cos(a) * L, A[1] - Math.sin(a) * L]; });
    if (C.bat) { for (let i = 0; i < 4; i++) { const t0 = tips[i], t1 = tips[i + 1], mid = [((t0[0] + t1[0]) / 2) * .78 + A[0] * .22, ((t0[1] + t1[1]) / 2) * .78 + A[1] * .22]; triPx(g, A, t0, mid, cA); triPx(g, A, mid, t1, cA); } tips.forEach(t => lineP(g, A, t, cB)); }
    else if (C.fairy) { triPx(g, A, tips[0], tips[2], cA); triPx(g, A, tips[2], tips[4], cB); lineP(g, A, tips[2], '#ffffff'); }
    else tips.forEach((t, i) => { const a = Math.atan2(t[1] - A[1], t[0] - A[0]) + Math.PI / 2, w = 1.7; triPx(g, [A[0] + Math.cos(a) * w, A[1] + Math.sin(a) * w], [A[0] - Math.cos(a) * w, A[1] - Math.sin(a) * w], t, i % 2 ? cB : cA); });
  };
  layer(3, -1, .8, C.c[1], OUT);
  layer(0, 0, 1, C.c[0], C.c[1]);
}
function drawHeadgear(g, ox, oy, m, kind, helm) {
  const x = ox + m.cx, y = oy + m.top, d = (px_, py_, c) => { g.fillStyle = c; g.fillRect(px_, py_, 1, 1); };
  if (kind === 'horns') {
    const c = helm.tier === 5 ? ['#2a1e3a', '#ff8a3a'] : ['#e8e2cf', '#c8342c'];
    for (const s of [-1, 1]) { const hx = x + s * 4; d(hx, y + 2, OUT); d(hx, y + 1, c[0]); d(hx + s, y, c[0]); d(hx + s, y - 1, c[1]); d(hx + s * 2, y, OUT); }
  } else if (kind === 'crown') {
    g.fillStyle = OUT; g.fillRect(x - 3, y - 3, 7, 3);
    g.fillStyle = '#e8b04a'; g.fillRect(x - 2, y - 2, 5, 2); g.fillStyle = '#ffe08a'; g.fillRect(x - 2, y - 3, 1, 1); g.fillRect(x, y - 3, 1, 1); g.fillRect(x + 2, y - 3, 1, 1);
    d(x, y - 2, '#c8342c');
  } else if (kind === 'halo') {
    const hy = y - 4 + Math.round(Math.sin(T * 3)), c = '#ffe08a';
    g.fillStyle = c; g.fillRect(x - 3, hy, 7, 1); g.fillRect(x - 3, hy + 2, 7, 1); d(x - 4, hy + 1, c); d(x + 4, hy + 1, c);
  }
}

/* ---------- Weltkarte ---------- */
// MAPV: Karte im Hochformat senkrecht – der Weg führt von unten nach oben
let MAPV = false;
function mapStart() { return MAPV ? [50, 97] : [3, 50]; }
function nodePos(M, r, i) {
  const n = M.rows[r].length, h1 = ((r * 73 + i * 151 + M.act * 37) % 97) / 97, h2 = ((r * 41 + i * 89 + M.act * 13) % 89) / 89;
  const a = (r + .5) / 7 * 100 + (h1 - .5) * 5, b = n === 1 ? 50 : clamp((i + .5) / n * 100 + (h2 - .5) * (50 / n), 12, 88);
  return MAPV ? [b, 100 - a] : [a, b];
}
const MAPBG = {};
function mapArt(M, W, H) {
  const k = M.act + ':' + (P.created % 9973) + ':' + P.rebirths + ':' + W + 'x' + H + (MAPV ? 'v' : ''); if (MAPBG[k]) return MAPBG[k];
  const b = biomeOf(M.act), R = mulberry(M.act * 7919 + (P.created % 9973) + P.rebirths * 31), cols = b.map;
  const c = mk(W, H), g = c.getContext('2d'), d = g.createImageData(W, H), p = d.data, rgb = cols.map(hexRgb);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = R(), ci = r < .72 ? 0 : r < .86 ? 1 : r < .97 ? 2 : 3, i = (y * W + x) * 4; [p[i], p[i + 1], p[i + 2]] = rgb[ci]; p[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  // Flecken für Gelände-Struktur
  for (let i = 0; i < 26; i++) { g.fillStyle = R() < .5 ? cols[2] : cols[1]; g.globalAlpha = .45; const x = R() * W, y = R() * H, rw = 10 + R() * 30, rh = 4 + R() * 10; g.beginPath(); g.ellipse(x, y, rw, rh, 0, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (b.key === 'glut' || b.key === 'hort') for (let i = 0; i < 5; i++) { let x = R() * W, y = R() * H; for (let s = 0; s < 40; s++) { g.fillStyle = s % 3 ? '#ff6a2a' : '#ffb03a'; g.fillRect(x | 0, y | 0, 2, 1); x += R() * 3 - .6; y += R() * 2 - 1; } }
  if (b.key === 'moss' || b.key === 'sumpf' || b.key === 'frost') for (let i = 0; i < 3; i++) { let x = R() * W, y = 0; const col = b.key === 'frost' ? '#a8d0e8' : b.key === 'sumpf' ? '#5a7a3a' : '#3a6a8a'; while (y < H) { g.fillStyle = col; g.fillRect(x | 0, y | 0, 3, 2); x += R() * 4 - 2; y += 2; } }
  const nodes = []; M.rows.forEach((row, r) => row.forEach((n, i) => { const [x, y] = nodePos(M, r, i); nodes.push([x / 100 * W, y / 100 * H]); }));
  const free = (x, y) => nodes.every(([nx, ny]) => Math.hypot(nx - x, ny - y) > 16);
  const deco = { kerker: ['ruin', 'rock', 'skull', 'rock'], moss: ['tree', 'tree', 'bush', 'shroom'], gruft: ['grave', 'grave', 'bones', 'deadtree'], glut: ['volcano', 'rock', 'rock', 'skull'], frost: ['pine', 'pine', 'ice', 'rock'], sumpf: ['reed', 'deadtree', 'bush', 'shroom'], schatten: ['spire', 'crystal', 'skull', 'ruin'], hort: ['gold', 'gold', 'bones', 'rock'] }[b.key];
  for (let i = 0; i < 70; i++) { const x = 6 + R() * (W - 12), y = 8 + R() * (H - 12); if (!free(x, y)) continue; mapDeco(g, deco[Math.floor(R() * deco.length)], x | 0, y | 0, R); }
  g.strokeStyle = '#120e18'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, H - 3); g.strokeStyle = '#6a5a48'; g.lineWidth = 1; g.strokeRect(3.5, 3.5, W - 7, H - 7);
  for (const [x, y] of [[4, 4], [W - 8, 4], [4, H - 8], [W - 8, H - 8]]) { g.fillStyle = '#e8b04a'; g.fillRect(x, y, 4, 4); g.fillStyle = '#9c6a24'; g.fillRect(x + 1, y + 1, 2, 2); }
  // Windrose
  const cx = W - 18, cy = H - 18; g.fillStyle = '#efe2bf'; g.fillRect(cx, cy - 6, 1, 13); g.fillRect(cx - 6, cy, 13, 1); g.fillStyle = '#c8463c'; g.fillRect(cx, cy - 6, 1, 4);
  return MAPBG[k] = c;
}
function mapDeco(g, k, x, y, R) {
  const r = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  switch (k) {
    case 'tree': r(-1, 0, 2, 3, '#5e3a1e'); r(-4, -6, 8, 5, '#2e6a2a'); r(-3, -8, 6, 3, '#3a8a32'); r(-2, -7, 2, 2, '#5aaa42'); break;
    case 'bush': r(-3, -2, 6, 3, '#2e6a2a'); r(-2, -3, 3, 2, '#4a9a3a'); break;
    case 'shroom': r(0, -2, 1, 3, '#e8e2cf'); r(-2, -4, 5, 2, R() < .5 ? '#c8342c' : '#b892f4'); r(-1, -4, 1, 1, '#fff'); break;
    case 'pine': r(0, 0, 1, 2, '#5e3a1e'); for (let i = 0; i < 4; i++) r(-i, -2 - (3 - i) * 2, i * 2 + 1, 2, i % 2 ? '#2e5a4a' : '#3a6a5a'); r(-1, -8, 3, 1, '#e8f4ff'); r(-3, -2, 1, 1, '#e8f4ff'); break;
    case 'ice': r(-1, -6, 2, 6, '#bfefff'); r(1, -4, 2, 4, '#8ec8e6'); r(-3, -3, 2, 3, '#a8d8f0'); r(-1, -6, 1, 2, '#fff'); break;
    case 'rock': r(-3, -2, 6, 3, '#4a4450'); r(-2, -3, 4, 1, '#6a6470'); r(-2, -2, 1, 1, '#8a8490'); break;
    case 'ruin': r(-4, -5, 2, 6, '#5a5260'); r(1, -3, 2, 4, '#5a5260'); r(-4, -5, 2, 1, '#7a7280'); r(-2, 0, 6, 1, '#3a3440'); break;
    case 'skull': r(-1, -2, 3, 2, '#e8e2cf'); r(-1, 0, 3, 1, '#a8a08a'); r(-1, -1, 1, 1, '#1a1420'); r(1, -1, 1, 1, '#1a1420'); break;
    case 'bones': r(-3, 0, 6, 1, '#e8e2cf'); r(-1, -2, 1, 4, '#d8d0bc'); break;
    case 'grave': r(-2, -5, 4, 6, '#6a6878'); r(-1, -6, 2, 1, '#6a6878'); r(-1, -4, 2, 1, '#3a3848'); r(0, -5, 1, 3, '#3a3848'); break;
    case 'deadtree': r(0, -7, 1, 8, '#4a3a2e'); r(-3, -6, 3, 1, '#4a3a2e'); r(1, -4, 3, 1, '#4a3a2e'); r(-3, -7, 1, 1, '#4a3a2e'); break;
    case 'volcano': for (let i = 0; i < 6; i++) r(-i, -6 + i, i * 2 + 1, 1, i < 2 ? '#ff6a2a' : '#3a2420'); r(0, -8, 1, 2, '#ffb03a'); break;
    case 'reed': for (let i = -2; i <= 2; i += 2) r(i, -5 + Math.abs(i), 1, 6 - Math.abs(i), '#6a7a3a'); r(0, -6, 1, 2, '#8a5a32'); break;
    case 'spire': r(-1, -10, 3, 11, '#1e1828'); r(0, -12, 1, 2, '#1e1828'); r(0, -7, 1, 1, '#b892f4'); r(-2, 0, 5, 1, '#120e18'); break;
    case 'crystal': r(-1, -5, 2, 5, '#8a5ad8'); r(1, -3, 2, 3, '#6a48c0'); r(-1, -5, 1, 2, '#e8d8ff'); break;
    case 'gold': r(-4, -1, 8, 2, '#c8902a'); r(-3, -2, 6, 1, '#e8b04a'); r(-1, -3, 3, 1, '#ffd24a'); r(-2, -2, 1, 1, '#fff3c0'); break;
  }
}

/* ---------- Versteck: Stationen ---------- */
function drawStation(o) {
  const x = Math.round(o.x - CX), y = Math.round(o.y - CY), r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
  const B = BUILD[o.id], lv = B.fixed ? 1 : (SAVE.meta.hide.b[o.id] || 0);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 12, 4, 0, 0, 6.283); ctx.fill();
  if (!lv) {
    r(-10, -16, 2, 17, WOOD[1]); r(8, -16, 2, 17, WOOD[1]); r(-11, -13, 22, 2, WOOD[2]); r(-11, -6, 22, 2, WOOD[2]); r(-6, -3, 12, 3, '#6a6470'); r(-4, -5, 5, 2, '#5a5460');
    r(-4, -24, 9, 7, '#c8a878'); r(-1, -17, 2, 3, WOOD[0]); ptext('?', x + 1, y - 20, '#1a1420', 6);
    return;
  }
  const f = Math.floor(T * 8);
  switch (o.id) {
    case 'feuer':
      r(-8, -2, 16, 3, WOOD[0]); r(-7, -3, 6, 2, WOOD[1]); r(1, -3, 6, 2, WOOD[2]); for (let i = 0; i < 8; i++) r(-9 + i * 2 + (i % 2), 0, 2, 2, '#6a6470');
      r(-4, -8 - f % 2, 8, 6, '#ff6a2a'); r(-2, -11 + (f % 3 ? 0 : 1), 4, 5, '#ffb03a'); r(-1, -7, 2, 3, '#fff0a0');
      addLight(x, y - 6, 70, 1); if (Math.random() < .3) part(o.x + rnd(-3, 3), o.y, 8, rnd(-5, 5), 0, rnd(20, 40), Math.random() < .5 ? '#ffb03a' : '#ff6a2a', .6, 1, -20, 1);
      break;
    case 'portal':
      r(-12, -30, 4, 31, '#5a5260'); r(8, -30, 4, 31, '#5a5260'); r(-12, -32, 24, 4, '#6a6270'); r(-12, -32, 24, 1, '#8a8290');
      ctx.globalAlpha = .9; drawFxFrame('ring', Math.floor(T * 12) % 14, x, y - 15, .55); ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(150,100,255,${.35 + .15 * Math.sin(T * 4)})`; ctx.fillRect(x - 8, y - 28, 16, 28); addLight(x, y - 14, 40, .9);
      break;
    case 'spiegel':
      r(-6, -26, 12, 26, '#9c6a24'); r(-5, -25, 10, 23, '#e8b04a'); r(-4, -24, 8, 21, '#5a7a98');
      ctx.globalAlpha = .5 + .2 * Math.sin(T * 2); r(-3, -22, 2, 9, '#e8f8ff'); r(0, -18, 1, 6, '#c8e8f8'); ctx.globalAlpha = 1; r(-7, -1, 14, 2, '#5e3a1e'); addLight(x, y - 14, 18, .4);
      break;
    case 'schmiede':
      r(-14, -22, 10, 22, '#4a4450'); r(-13, -21, 8, 3, '#6a6470'); r(-12, -12, 6, 6, '#ff6a2a'); r(-11, -11, 4, 4, f % 2 ? '#ffb03a' : '#ff8a3a'); addLight(x - 9, y - 9, 40, .9);
      r(-2, -9, 14, 3, '#6a707c'); r(-2, -9, 14, 1, '#a8b0bc'); r(-4, -9, 3, 2, '#6a707c'); r(1, -6, 7, 2, '#4a505c'); r(-1, -4, 11, 4, '#4a505c');
      if (lv >= 2) { r(14, -18, 2, 18, WOOD[1]); r(13, -18, 4, 2, WOOD[2]); r(17, -16, 1, 8, '#a8b0bc'); r(12, -15, 1, 9, '#d0d6de'); }
      if (lv >= 4) { r(-12, -26, 6, 4, '#c8342c'); addLight(x - 9, y - 22, 30, .6); }
      if (Math.random() < .05) for (let i = 0; i < 5; i++) part(o.x + 4, o.y - 2, 9, rnd(-40, 40), rnd(-10, 10), rnd(30, 60), '#ffd24a', .3, 1, 200, 1);
      break;
    case 'alchemie':
      r(-12, -24, 24, 3, WOOD[2]); r(-12, -21, 2, 21, WOOD[0]); r(10, -21, 2, 21, WOOD[0]);
      for (let i = 0; i < 4; i++) ctx.drawImage(SHEET, 288 + i * 16, 336, 16, 16, x - 13 + i * 6, y - 37, 12, 12);
      r(-7, -10, 14, 9, '#3a3440'); r(-8, -11, 16, 2, '#4a4450'); r(-6, -12, 12, 2, lv >= 3 ? '#b892f4' : '#79c24e'); r(-5 + f % 4, -14, 2, 2, '#c8f06a'); r(-6, -1, 3, 1, '#ff6a2a'); r(3, -1, 3, 1, '#ff6a2a');
      addLight(x, y - 12, 26, .6);
      break;
    case 'juwelier':
      r(-12, -10, 24, 3, WOOD[2]); r(-11, -7, 2, 7, WOOD[0]); r(9, -7, 2, 7, WOOD[0]); r(-10, -12, 6, 2, '#2a1e3a');
      [['#e8402a', -9], ['#57a7d6', -4], ['#3ac87a', 1], ['#b892f4', 6]].forEach(([c, dx], i) => { r(dx, -13, 3, 3, c); if ((f + i * 2) % 8 === 0) r(dx, -13, 1, 1, '#fff'); });
      if (lv >= 2) { r(-2, -22, 4, 6, '#9ee8f0'); r(-1, -24, 2, 2, '#c8f8ff'); addLight(x, y - 18, 22, .6); }
      break;
    case 'lager': {
      const n = Math.min(3, 1 + Math.floor(lv / 2));
      for (let i = 0; i < n; i++) { const dx = -14 + i * 10, f2 = 0; ctx.drawImage(SHEET, 304 + f2, 416, 16, 16, x + dx - 2, y - 15 - (i === 1 ? 4 : 0), 16, 16); }
      if (lv >= 3) { r(-12, -2, 24, 2, '#e8b04a'); r(-8, -3, 3, 1, '#ffd24a'); r(4, -3, 4, 1, '#ffd24a'); }
      break;
    }
    case 'training':
      r(-1, -6, 2, 7, WOOD[1]); r(-6, -1, 12, 2, WOOD[0]);
      r(-10, -20, 8, 1, WOOD[2]); r(6, -20, 6, 1, WOOD[2]);
      for (let i = 0; i < Math.min(5, lv); i++) r(-12 + i * 3, -27, 1, 5, '#a8b0bc');
      break;
    case 'tempel': {
      r(-2, -6, 4, 7, WOOD[0]); r(-8, -1, 16, 2, '#9c6a24');
      ctx.save(); ctx.translate(x, y - 18); ctx.rotate(T * .6 + (G && G.wheelSpin || 0));
      for (let k = 0; k < 8; k++) { ctx.fillStyle = WHEEL[k].c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 11, k / 8 * 6.283, (k + 1) / 8 * 6.283); ctx.fill(); }
      ctx.strokeStyle = '#e8b04a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.283); ctx.stroke(); ctx.fillStyle = '#ffe08a'; ctx.fillRect(-2, -2, 4, 4); ctx.restore();
      r(-1, -32, 3, 3, '#c8342c'); addLight(x, y - 18, 34, .7);
      break;
    }
    case 'bibliothek':
      r(-14, -30, 28, 30, '#5e3a1e'); r(-13, -29, 26, 28, '#3a2418');
      for (let s = 0; s < 3; s++) { r(-13, -20 + s * 9, 26, 2, '#8a5a32'); for (let bk = 0; bk < 8; bk++) { const c = ['#a83a3a', '#3a6ac8', '#3a9a4a', '#e8b04a', '#7a48c0'][(bk + s * 3) % 5]; r(-12 + bk * 3, -27 + s * 9, 2, 7 - (bk % 3 === 0 ? 1 : 0), c); } }
      if (lv >= 2) { r(10, -36, 3, 6, '#e8e2cf'); r(11, -38, 1, 2, '#ffb03a'); addLight(x + 11, y - 36, 24, .7); }
      break;
    case 'mine':
      r(-14, -26, 28, 26, '#3a3440'); r(-9, -20, 18, 20, '#100c16'); r(-11, -22, 22, 3, WOOD[1]); r(-11, -19, 3, 19, WOOD[0]); r(8, -19, 3, 19, WOOD[0]);
      r(-8, -1, 16, 1, '#6a707c'); r(-6, -7, 10, 5, '#5e3a1e'); r(-5, -9, 8, 3, '#9aa2ae'); if (lv >= 2) r(-3, -9, 2, 2, '#9ee8f0'); if (lv >= 3) r(1, -9, 2, 2, '#44c89a'); if (lv >= 5) r(-1, -10, 1, 1, '#b0b8ff');
      if (minePending('mine') > 0) { r(-1, -34, 3, 5, '#ffd24a'); r(-1, -28, 3, 2, '#ffd24a'); }
      break;
    case 'garten':
      r(-14, -6, 28, 6, '#5e3a1e'); r(-14, -6, 28, 1, '#7a4a28');
      for (let i = 0; i < 5; i++) { const h = 4 + (i * 7 + lv) % 5 + Math.round(Math.sin(T * 2 + i)), dx = -12 + i * 6; r(dx, -6 - h, 1, h, '#3a7a2a'); r(dx - 1, -7 - h, 3, 2, i % 2 ? '#79c24e' : '#5aaa42'); if (lv >= 3 && i % 2 === 0) r(dx, -8 - h, 1, 1, '#f786a0'); }
      if (minePending('garden') > 0) { r(-1, -24, 3, 5, '#ffd24a'); r(-1, -18, 3, 2, '#ffd24a'); }
      break;
  }
  if (!B.fixed) for (let i = 0; i < lv; i++) { r(-lv * 2 + i * 4, 4, 3, 2, '#e8b04a'); }
}
function drawNpc(o) {
  const x = Math.round(o.x - CX), y = Math.round(o.y - CY), S = SP[o.sp], fl = o.face || 1;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 2, 0, 0, 6.283); ctx.fill();
  const r = frameRect(o.sp, 'idle', Math.floor(T * 5 + o.x)), fly = o.sp === 'angel' ? 6 + Math.round(Math.sin(T * 3) * 2) : 0;
  ctx.save(); ctx.translate(x, y - fly); ctx.scale(fl, 1); ctx.drawImage(SHEET, r[0], r[1], r[2], r[3], -r[2] / 2, -r[3], r[2], r[3]); ctx.restore();
  if (o.sp === 'angel') addLight(x, y - 14, 24, .6);
}
function drawDummy(e) {
  const x = Math.round(e.x - CX), y = Math.round(e.y - CY), w = e.flash > 0 ? 3 : 0, sq = e.squash || 0;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 8, 3, 0, 0, 6.283); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.rotate(sq * (e.kbx > 0 ? 1 : -1) * 1.5);
  const r = (dx, dy, ww, h, c) => { ctx.fillStyle = e.flash > 0 ? '#ffffff' : c; ctx.fillRect(dx, dy, ww, h); };
  r(-1, -10, 2, 10, WOOD[1]); r(-5, -22, 10, 12, '#c8a878'); r(-9, -20, 18, 3, '#a8865a'); r(-3, -28, 6, 6, '#c8a878'); r(-2, -26, 1, 1, '#1a1420'); r(1, -26, 1, 1, '#1a1420');
  r(-2, -18, 4, 4, '#c8342c'); r(-1, -17, 2, 2, '#efe2bf'); ctx.restore();
  if (e.dps > 0) ptext(Math.round(e.dps) + ' SCH/s', x, y - 36, '#ffd24a', 6);
  void w;
}
