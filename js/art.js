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
function pbCanvas(b, pal) { return mk(b.w, b.h, g => { for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const c = b.a[y * b.w + x]; if (c) { g.fillStyle = pal ? pal[c] || c : c; g.fillRect(x, y, 1, 1); } } }); }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mixC(a, b, k) { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
function rgbaC(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
// Puffer vergrößern (Rand für Zierde) und wieder auf den Inhalt zuschneiden
function pbPad(b, p) { const n = PB(b.w + 2 * p, b.h + 2 * p); for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) n.a[(y + p) * n.w + x + p] = b.a[y * b.w + x]; return n; }
function pbTrim(b) {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.a[y * b.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return { b, x: 0, y: 0 };
  const n = PB(x1 - x0 + 1, y1 - y0 + 1); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) n.a[(y - y0) * n.w + x - x0] = b.a[y * b.w + x];
  return { b: n, x: x0, y: y0 };
}
function offPB(b, ox, oy) { return { w: b.w, h: b.h, set: (x, y, c) => b.set(x + ox, y + oy, c), get: (x, y) => b.get(x + ox, y + oy), rect: (x, y, w, h, c) => b.rect(x + ox, y + oy, w, h, c), line: (x0, y0, x1, y1, c) => b.line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, c), disc: (cx, cy, r, c) => b.disc(cx + ox, cy + oy, r, c) }; }
/* Pixelbild aus Zeichen (Helme, Kopfschmuck): . leer, 0–3 Zierfarben, g h i Beschlag, m n o p Metall, c d Rüstung, e/f Edelstein, w weiß, k dunkel, r rot, b blau, v grün, y gelb */
const PXC = { 0: 'a0', 1: 'a1', 2: 'a2', 3: 'a3', g: 'g0', h: 'g1', i: 'g2', m: 'm0', n: 'm1', o: 'm2', p: 'm3', c: 'c0', d: 'c1', e: 'gm', f: 'gd', w: '#ffffff', k: '#1a1420', r: '#d8342c', b: '#3a8ae8', v: '#3ac87a', y: '#ffe27a' };
function pxStamp(b, rows, x0, y0) { rows.forEach((s, y) => { for (let x = 0; x < s.length; x++) if (s[x] !== '.') b.set(x0 + x, y0 + y, PXC[s[x]] || s[x]); }); }

/* ---------- Waffen ----------
   Gezeichnet wird mit Rollen statt Farben: m0–m3 Metall, g0–g2 Beschlag, l0–l2 Griff, w0–w2 Holz, b0–b2 Knochen, st Sehne,
   gm/gd Edelstein, ob Kugel, r0/r1 Runen, a0–a3 Zierfarben, ou Umriss, rg Schein. itemPal() setzt die Farben ein:
   Stufe → Material und wachsende Form (Parierstange, Dornen, Sägezähne, Lichtkern, Flügel), Seltenheit → farbige Schneide
   (Magisch blau, Selten gold, Episch violett), Juwel, Runen, Umriss und Schein; benannte Gegenstände (ITEMLOOK) → eigene Palette und Zierde */
function wform(it) { const F = WFORM[it.base]; if (!F) return {}; return F.find(f => f.id === it.form) || F.find(f => f.std) || F[0]; }
// alles, was das Aussehen bestimmt (auch Name und Element) – gleiche Schlüssel heißen gleiches Bild
function itemArtKey(it) { return it.slot + it.base + (it.form || '') + it.tier + '.' + it.rar + (it.myth || '') + (it.set || '') + (it.name ? '~' + it.name : '') + (it.el ? '^' + it.el : ''); }
function gemCol(it) { return it.myth ? '#ff4fd8' : it.set ? '#4ade80' : RAR[it.rar].c; }
const RM = ['m0', 'm1', 'm2', 'm3'], RG = ['g0', 'g1', 'g2'], RL = ['l0', 'l1', 'l2'], RW = ['w0', 'w1', 'w2'], RB = ['b0', 'b1', 'b2'];
const RTINT = [null, '#6ab8ff', '#ffe36a', '#d6a8ff'];
const ROUT = [OUT, OUT, OUT, '#2a1240', '#3a1606', '#0a2e16', '#3a0832'];
const RRING = [null, null, null, 'rgba(184,146,244,.32)', 'rgba(255,150,60,.55)', 'rgba(74,222,128,.5)', 'rgba(255,79,216,.6)'];
function itemLook(it) {
  if (!it) return null;
  if (it.rar === 6 && it.myth) return ITEMLOOK['m:' + it.myth] || null;
  if (it.rar === 5 && it.set) return ITEMLOOK['s:' + it.set] || null;
  if (it.rar === 4 && it.name) return ITEMLOOK[it.name] || null;
  return null;
}
function itemPal(it, L) {
  const Tm = MAT[clamp(it.tier, 0, TIERS - 1)], M = Tm.m, r = clamp(it.rar, 0, 6), rc = RAR[r].c, p = { st: '#e8e2cf', ou: ROUT[r], rg: RRING[r] };
  const G = r >= 4 || it.set || it.tier >= 4 ? GOLDC : M, ec = it.el && typeof ELEM !== 'undefined' && ELEM[it.el] ? ELEM[it.el].c : null;
  for (let i = 0; i < 4; i++) p[RM[i]] = M[i];
  for (let i = 0; i < 3; i++) { p[RG[i]] = G[i]; p[RL[i]] = LEATH[i]; p[RW[i]] = WOOD[i]; p[RB[i]] = BONE[i]; }
  if (RTINT[r]) { p.m3 = mixC(M[3], RTINT[r], .6); for (let i = 0; i < 3; i++) p[RL[i]] = mixC(LEATH[i], RTINT[r], .5 + i * .12); }
  p.c0 = Tm.c[0]; p.c1 = Tm.c[1]; p.tr = r >= 4 || it.set || it.tier >= 4 ? GOLDC[1] : M[1];
  if (RTINT[r]) p.tr = mixC(p.tr, RTINT[r], .6);
  p.rb = RTINT[r] ? mixC(G[1], RTINT[r], .65) : G[1];
  p.gm = gemCol(it); p.gd = mixC(p.gm, '#000000', .45); p.ob = it.myth ? '#ff4fd8' : ORB[clamp(it.tier, 0, 7)];
  p.r0 = ec ? ec[2] : '#c8a0ff'; p.r1 = ec ? ec[3] : '#f4e8ff';
  p.a0 = mixC(rc, '#000000', .5); p.a1 = rc; p.a2 = mixC(rc, '#ffffff', .45); p.a3 = '#ffffff';
  if (L) Object.assign(p, L.pal);
  return p;
}
const WACACHE = {};
function weaponArt(it) {
  const k = itemArtKey(it); if (WACACHE[k]) return WACACHE[k];
  const F = wform(it), L = itemLook(it), pal = itemPal(it, L), R = mulberry(hashStr(k));
  let s;
  if (it.base === 'sword') s = artSword(F, it);
  else if (it.base === 'axe') s = artAxe(F, it);
  else if (it.base === 'dagger') s = artDagger(F, it);
  else if (it.base === 'bow') s = F.id === 'arm' ? artCrossbow(it) : artBow(F, it);
  else s = artStaff(F, it);
  const pd = 7, b = pbPad(s.b, pd), A = {}; for (const n in s.A) A[n] = Array.isArray(s.A[n]) && typeof s.A[n][0] === 'number' ? [s.A[n][0] + pd, s.A[n][1] + pd] : s.A[n];
  A.top = s.A.top + pd; A.hy = s.A.hy + pd; A.runes = s.A.runes.map(([x, y]) => [x + pd, y + pd]);
  // Episch (und Legendär ohne eigenes Aussehen): leuchtende Runen
  if (it.rar === 3 || (it.rar >= 4 && !L)) A.runes.forEach(([x, y], i) => { if (b.get(x, y)) b.set(x, y, i % 2 ? 'r1' : 'r0'); });
  if (L && L.w) for (const [d, o] of L.w) if (!o || !o.only || o.only.includes(it.base)) DECO[d](b, A, R, o || {});
  sparkle(b, it, R);
  return WACACHE[k] = finishArt(b, pal, L, s.ox + pd, s.oy + pd, { bow: s.bow, tip: A.tip, it });
}
/* Umriss, Schein, zuschneiden, Farben einsetzen; Mythisch: Bilder mit wandernden Zierfarben (fr) */
function finishArt(b, pal, L, ox, oy, o) {
  pbOutline(b, 'ou'); if (pal.rg) pbOutline(b, 'rg');
  const t = pbTrim(b), it = o.it; ox -= t.x; oy -= t.y;
  const res = { c: pbCanvas(t.b, pal), ox, oy, bow: !!o.bow, glint: it.rar >= 4, col: L ? L.acc : RAR[clamp(it.rar, 0, 6)].c, myth: it.rar === 6 };
  if (o.tip) res.tl = oy - (o.tip[1] - t.y); // Abstand Griff → Spitze (für Schweif und Funken)
  if (L && L.cyc) res.fr = cycFrames(t.b, pal, L.cyc, res.c);
  return res;
}
function cycFrames(b, pal, cyc, c0) {
  const n = 8, fr = [c0];
  for (let f = 1; f < n; f++) {
    const ph = f / n * cyc.length, i = Math.floor(ph), k = ph - i, A = cyc[i % cyc.length], B = cyc[(i + 1) % cyc.length], p = Object.assign({}, pal);
    for (let j = 0; j < 4; j++) p['a' + j] = mixC(A[j], B[j], k);
    p.rg = rgbaC(p.a2, .6); fr.push(pbCanvas(b, p));
  }
  return fr;
}
function bladeRow(b, x, y, ww, M, fuller) { for (let i = 0; i < ww; i++) b.set(x + i, y, i === 0 ? M[3] : i === ww - 1 ? M[1] : fuller && i === Math.floor(ww / 2) ? M[1] : M[2]); }
function sparkle(b, it, R) { if (it.tier >= 6 || it.myth) for (let k = 0, n = 0; k < 60 && n < 3; k++) { const x = Math.floor(R() * b.w), y = Math.floor(R() * b.h * .6); if (b.get(x, y)) { b.set(x, y, '#ffffff'); n++; } } }
function artSword(F, it) {
  const t = it.tier, r = it.rar, len = F.len + (t >= 5 ? 1 : 0), w = F.w, big = F.big ? 1 : 0, curve = F.curve ? 3 : 0, gl = big ? 6 : 4, M = RM, G = RG;
  const bl = 6 + big, W = bl + w + 7 + big + curve, H = len + gl + 9, b = PB(W, H), runes = [];
  const tipLen = Math.ceil((w - 1) / 2); let tip = null;
  for (let y = 1; y <= len; y++) {
    const off = curve ? Math.round(curve * Math.pow((len - y) / len, 2)) : 0;
    let ww = Math.max(1, w - Math.max(0, tipLen - y + 1) * 2), lx = bl + off + Math.floor((w - ww) / 2);
    if (F.wavy && y > 2 && y < len - 1 && (y >> 1) % 2) { lx++; ww--; }
    bladeRow(b, lx, y, ww, M, w >= 4 && y > 3 && y < len - 1);
    const mx = lx + Math.floor(ww / 2); if (!tip) tip = [mx, y];
    if (t >= 6 && ww >= 3 && y > 2 && y < len - 1) b.set(mx, y, M[3]);           // Lichtkern
    if (t >= 5 && y > 3 && y < len - 2 && y % 3 === 0) b.set(lx + ww, y, M[1]);   // Sägezähne
    if (y > 3 && y < len - 1 && !(y & 1) && ww >= 3) runes.push([mx, y]);
  }
  const gy = len + 1, gx = bl - 2 - big, gw = w + 4 + big * 2, cx = bl + Math.floor(w / 2);
  b.rect(gx, gy, gw, 1, G[1]); b.rect(gx, gy + 1, gw, 1, G[0]); b.set(gx, gy, G[2]);
  if (t >= 2 || r >= 3) { b.set(gx, gy - 1, G[1]); b.set(gx + gw - 1, gy - 1, G[1]); }
  if (t >= 3) { b.set(gx - 1, gy + 1, G[0]); b.set(gx + gw, gy + 1, G[0]); }
  if (t >= 4 || r >= 4) { b.set(gx - 1, gy - 2, G[1]); b.set(gx + gw, gy - 2, G[1]); }
  if (t >= 6) { b.set(gx - 2, gy - 3, G[2]); b.set(gx + gw + 1, gy - 3, G[2]); b.set(gx - 1, gy - 1, G[0]); b.set(gx + gw, gy - 1, G[0]); }
  if (r >= 2) { b.set(cx, gy, 'gm'); b.set(cx, gy + 1, 'gd'); if (w >= 4) { b.set(cx - 1, gy, 'gm'); b.set(cx - 1, gy + 1, 'gd'); } }
  const hx = cx - 1;
  for (let y = gy + 2; y < gy + 2 + gl; y++) { b.set(hx, y, (y & 1) ? RL[2] : RL[1]); b.set(hx + 1, y, RL[0]); }
  const py = gy + 2 + gl; b.rect(hx, py, 2, 1, G[1]); b.set(hx, py + 1, G[0]); b.set(hx + 1, py + 1, G[0]);
  if (r >= 3 || t >= 6) b.set(hx, py, r >= 3 ? 'gm' : M[3]);
  if (t >= 5) { b.set(hx, py + 2, G[1]); b.set(hx + 1, py + 2, G[0]); }
  if (t >= 7) { b.set(hx - 1, py, G[2]); b.set(hx + 2, py, G[2]); }
  return { b, ox: hx + 1, oy: gy + 3, bow: false, A: { tip, guard: [cx, gy], pom: [hx, py + 1], head: [cx, Math.round(len * .5)], top: 1, hy: gy, gw: gw >> 1, runes } };
}
function artAxe(F, it) {
  const id = F.id, t = it.tier, H = id === 'helle' ? 30 : id === 'beil' ? 18 : 24, W = 17, hx = 7, b = PB(W, H), M = RM, G = RG, runes = [];
  const HF = t >= 5 ? [M[0], M[1]] : [RW[0], RW[1]], top = id === 'helle' ? 7 : 2;
  for (let y = top; y < H - 2; y++) { b.set(hx, y, HF[1]); b.set(hx + 1, y, HF[0]); }
  const blade = (y0, prof, dir) => prof.forEach((wd, rr) => { for (let i = 0; i < wd; i++) { const x = dir > 0 ? hx + 2 + i : hx - 1 - i; b.set(x, y0 + rr, i === wd - 1 ? M[3] : i === 0 ? M[1] : M[2]); } if (rr % 2 && wd >= 4) runes.push([dir > 0 ? hx + 2 + (wd >> 1) : hx - 1 - (wd >> 1), y0 + rr]); });
  let head = [hx + 5, 6];
  if (id === 'beil') { blade(3, [2, 3, 4, 4, 3, 2], 1); head = [hx + 4, 5]; }
  else if (id === 'streit') { blade(2, [2, 3, 5, 6, 6, 6, 5, 3, 2], 1); b.rect(hx - 2, 5, 2, 2, M[1]); b.set(hx - 3, 5, M[2]); }
  else if (id === 'doppel') { const p = [2, 4, 5, 6, 6, 6, 5, 4, 2]; blade(2, p, 1); blade(2, p, -1); head = [hx, 6]; }
  else if (id === 'barte') { blade(2, [2, 3, 3, 3, 4, 5, 6, 6, 5, 3], 1); b.set(hx + 7, 10, M[3]); head = [hx + 5, 8]; }
  else if (id === 'hammer') { b.rect(hx - 3, 2, 8, 6, M[2]); b.rect(hx - 3, 2, 8, 1, M[3]); b.rect(hx - 3, 7, 8, 1, M[1]); b.rect(hx - 3, 2, 1, 6, M[3]); b.rect(hx + 4, 2, 1, 6, M[1]); b.rect(hx - 1, 4, 4, 2, M[1]); runes.push([hx - 2, 4], [hx + 3, 5]); head = [hx, 4]; }
  else if (id === 'helle') { b.set(hx, 0, M[3]); b.rect(hx, 1, 2, 6, M[2]); b.set(hx, 1, M[3]); b.set(hx, 2, M[3]); blade(8, [2, 4, 5, 5, 4, 2], 1); b.set(hx - 1, 9, M[2]); b.set(hx - 2, 10, M[2]); head = [hx + 4, 10]; }
  const band = id === 'helle' ? 14 : id === 'hammer' ? 8 : 11; b.rect(hx, band, 2, 1, G[1]);
  if (it.rar >= 2) { b.set(hx, band, 'gm'); b.set(hx + 1, band, 'gd'); }
  b.rect(hx, H - 3, 2, 1, G[0]);
  for (let y = H - 7; y < H - 3; y++) b.set(hx, y, (y & 1) ? RL[2] : RL[1]);
  if (t >= 4 || it.rar >= 4) { b.set(hx - 1, band, G[1]); b.set(hx + 2, band, G[1]); }
  if (t >= 3 && id !== 'helle') { b.set(hx, top - 1, M[3]); b.set(hx + 1, top - 1, M[2]); b.set(hx, top - 2, M[3]); }   // Dorn oben
  if (t >= 5) { b.set(hx, H - 2, G[1]); b.set(hx + 1, H - 2, G[0]); b.set(hx, H - 1, M[3]); }                              // Knaufdorn
  if (t >= 6) { b.rect(hx, band + 3, 2, 1, G[1]); b.set(hx, band + 3, M[3]); }
  if (t >= 7) { b.set(hx - 1, band + 3, G[2]); b.set(hx + 2, band + 3, G[2]); }
  return { b, ox: hx + 1, oy: H - 5, bow: false, A: { tip: [hx, id === 'helle' ? 0 : top - (t >= 3 ? 2 : 0)], guard: [hx, band], pom: [hx, H - 3], head, top: 0, hy: band, gw: 2, runes } };
}
function artDagger(F, it) {
  const id = F.id, t = it.tier, len = id === 'stilett' ? 10 : id === 'katar' ? 7 : 8, W = 10, H = len + 10, b = PB(W, H), cx = 4, M = RM, G = RG, runes = [];
  if (id === 'sichel') {
    for (let y = 2; y <= len; y++) { const off = y < 4 ? 4 - y : 0; bladeRow(b, cx + off, y, 2, M, false); }
    b.set(cx + 3, 1, M[3]); b.set(cx + 4, 2, M[2]);
  } else if (id === 'katar') {
    for (let y = 1; y <= len; y++) { const ww = Math.min(4, 1 + Math.floor((y - 1) * .8)); bladeRow(b, cx - Math.floor((ww - 1) / 2), y, ww, M, false); }
  } else {
    const w = id === 'stilett' ? 1 : 2;
    for (let y = 1; y <= len; y++) { let x = cx; if (id === 'kris' && y > 1 && y < len - 1) x += (y >> 1) % 2 ? 1 : 0; const ww = y === 1 ? 1 : w; bladeRow(b, x, y, ww, M, false); if (w === 1) b.set(x + 1, y, y > 2 ? M[1] : null); }
  }
  for (let y = 3; y < len; y += 2) if (b.get(cx + 1, y)) runes.push([cx + 1, y]);
  const gy = len + 1;
  if (id === 'katar') { b.rect(cx - 2, gy, 6, 1, G[1]); b.rect(cx - 2, gy + 1, 1, 4, G[0]); b.rect(cx + 3, gy + 1, 1, 4, G[0]); b.rect(cx - 1, gy + 3, 4, 1, RL[2]); if (it.rar >= 2) b.set(cx, gy, 'gm'); if (t >= 3) { b.set(cx - 2, gy - 1, G[1]); b.set(cx + 3, gy - 1, G[1]); } if (t >= 5) { b.set(cx - 2, gy + 5, M[3]); b.set(cx + 3, gy + 5, M[3]); } if (t >= 2) { b.set(cx - 3, gy, G[1]); b.set(cx + 4, gy, G[1]); } if (t >= 7) { b.set(cx - 3, gy - 2, G[2]); b.set(cx + 4, gy - 2, G[2]); } }
  else {
    b.rect(cx - 2, gy, 6, 1, G[1]); if (it.rar >= 2) { b.set(cx, gy, 'gm'); b.set(cx + 1, gy, 'gd'); }
    for (let y = gy + 1; y < gy + 4; y++) { b.set(cx, y, (y & 1) ? RL[2] : RL[1]); b.set(cx + 1, y, RL[0]); } b.rect(cx, gy + 4, 2, 1, G[1]);
    if (t >= 3) { b.set(cx - 2, gy - 1, G[1]); b.set(cx + 3, gy - 1, G[1]); }
    if (t >= 5) { b.set(cx - 3, gy - 1, G[2]); b.set(cx + 4, gy - 1, G[2]); b.set(cx, gy + 5, G[0]); b.set(cx + 1, gy + 5, M[3]); }
    if (t >= 6) b.set(cx + 1, gy + 4, it.rar >= 2 ? 'gm' : M[3]);
    if (t >= 2) { b.set(cx - 1, gy + 4, G[0]); b.set(cx + 2, gy + 4, G[0]); }
    if (t >= 7) { b.set(cx - 3, gy - 2, G[2]); b.set(cx + 4, gy - 2, G[2]); }
  }
  return { b, ox: cx + 1, oy: gy + 2, bow: false, A: { tip: [cx, 1], guard: [cx, gy], pom: [cx, gy + 4], head: [cx, len >> 1], top: 1, hy: gy, gw: 3, runes } };
}
function artBow(F, it) {
  const id = F.id, t = it.tier, H = id === 'lang' ? 30 : id === 'kurz' ? 22 : 26, depth = id === 'kurz' ? 4 : 5, W = 11, b = PB(W, H), G = RG, runes = [];
  const L = t <= 1 ? RW : RM, sx = 2;
  for (let y = 2; y <= H - 3; y++) b.set(sx, y, 'st');
  for (let y = 1; y <= H - 2; y++) {
    const u = (y - 1) / (H - 3); let x = sx + Math.round(depth * Math.sin(Math.PI * u));
    if (id === 'reflex' && (u < .1 || u > .9)) x -= 1;
    b.set(x, y, L[1]); b.set(x + 1, y, L[0]); if (id === 'lang' || t >= 3) b.set(x - 1, y, L[2]);
    if (y % 4 === 1 && Math.abs(u - .5) > .14 && u > .08 && u < .92) runes.push([x, y]);
  }
  const mid = Math.floor(H / 2), mx = sx + depth; b.rect(mx - 1, mid - 2, 3, 4, RL[1]); b.set(mx - 1, mid - 1, RL[2]);
  b.rect(sx - 1, 0, 2, 2, G[1]); b.rect(sx - 1, H - 2, 2, 2, G[1]);
  if (t >= 3 || it.rar >= 3) for (const u of [.25, .75]) { const y = Math.round(1 + u * (H - 3)), x = sx + Math.round(depth * Math.sin(Math.PI * u)); b.set(x, y, G[2]); b.set(x + 1, y, G[1]); }
  if (t >= 5) { b.set(sx - 2, 0, G[2]); b.set(sx - 2, H - 1, G[2]); b.set(sx - 1, 2, G[0]); b.set(sx - 1, H - 3, G[0]); }
  if (it.rar >= 2) { b.set(mx, mid, 'gm'); b.set(mx, mid + 1, 'gd'); }
  if (t >= 6) { b.set(mx + 2, mid - 1, G[1]); b.set(mx + 2, mid, G[2]); }
  if (t >= 2) { b.set(mx + 2, mid - 2, RL[1]); b.set(mx + 2, mid + 1, RL[1]); }
  if (t >= 4) { b.set(sx + 1, 1, G[2]); b.set(sx + 1, H - 2, G[2]); b.set(sx + 2, 0, G[1]); b.set(sx + 2, H - 1, G[1]); }
  if (t >= 7) { b.set(sx - 3, 1, G[2]); b.set(sx - 3, H - 2, G[2]); }
  return { b, ox: Math.floor(W / 2), oy: mid, bow: true, A: { tip: [sx, 0], guard: [mx, mid], pom: [sx, H - 1], head: [mx, mid], top: 0, hy: H, gw: 2, runes } };
}
function artCrossbow(it) {
  const W = 19, H = 15, b = PB(W, H), y0 = 7, t = it.tier, M = RM, G = RG;
  b.rect(1, y0, 13, 1, RW[2]); b.rect(1, y0 + 1, 13, 1, RW[1]); b.rect(1, y0 + 2, 4, 1, RW[0]); b.rect(4, y0 + 2, 2, 2, RL[1]);
  for (let y = 1; y <= 13; y++) { const x = 13 + Math.round(1.8 * Math.sin(Math.PI * (y - 1) / 12)); b.set(x, y, M[2]); b.set(x + 1, y, M[1]); }
  b.line(13, 1, 8, y0, 'st'); b.line(13, 13, 8, y0 + 1, 'st');
  b.rect(10, y0 - 1, 6, 1, M[3]); b.set(16, y0 - 1, M[3]);
  if (it.rar >= 2) { b.set(13, y0, 'gm'); b.set(13, y0 + 1, 'gd'); }
  b.set(14, 0, G[1]); b.set(14, 14, G[1]);
  if (t >= 3) { b.set(15, 0, G[2]); b.set(15, 14, G[2]); b.set(1, y0 - 1, G[1]); }
  if (t >= 5) { b.set(17, y0 - 1, M[3]); b.set(0, y0, G[1]); b.set(0, y0 + 1, G[0]); }
  if (t >= 2) { b.set(4, y0 + 4, RL[2]); b.set(5, y0 + 4, RL[1]); }
  if (t >= 7) { b.set(16, 0, G[2]); b.set(16, 14, G[2]); }
  return { b, ox: 7, oy: y0, bow: true, A: { tip: [16, y0 - 1], guard: [9, y0], pom: [1, y0 + 1], head: [13, y0], top: 0, hy: H, gw: 2, runes: [[3, y0], [6, y0], [9, y0], [11, y0 + 1]] } };
}
function artStaff(F, it) {
  const id = F.id, t = it.tier, H = id === 'zepter' ? 24 : 31, W = 13, cx = 6, b = PB(W, H), M = RM, G = RG, oc = 'ob', runes = [];
  const S = id === 'knochen' ? RB : t >= 3 ? M : RW;
  for (let y = 8; y < H - 1; y++) { b.set(cx - 1, y, S[1]); b.set(cx, y, S[0]); if (y >= 10 && y < H - 3 && y % 3 === 1) runes.push([cx - 1, y]); }
  if (id !== 'knochen') for (let y = 12; y < H - 1; y += 6) b.rect(cx - 1, y, 2, 1, 'rb');
  for (let y = H - 9; y < H - 5; y++) b.set(cx - 1, y, (y & 1) ? RL[2] : RL[1]);   // Griffwicklung
  if (t >= 2) b.rect(cx - 2, 14, 4, 1, 'rb');
  if (t >= 4) { b.set(cx - 2, H - 2, G[0]); b.set(cx + 1, H - 2, G[0]); }
  let head = [cx, 4];
  if (id === 'stab') { b.disc(cx - .5, 4, 2.6, oc); b.set(cx - 2, 3, '#fff'); for (const s of [-1, 1]) { const x = s < 0 ? cx - 4 : cx + 3; b.line(x, 6, x, 2, M[2]); b.set(s < 0 ? x + 1 : x - 1, 7, M[1]); b.set(x, 1, M[3]); } }
  else if (id === 'zepter') { b.rect(cx - 3, 5, 6, 3, G[1]); b.rect(cx - 3, 7, 6, 1, G[0]); for (const x of [cx - 3, cx - 1, cx + 1, cx + 2]) b.set(x, 4, G[2]); b.rect(cx - 1, 2, 2, 3, oc); b.set(cx - 1, 2, '#fff'); head = [cx, 3]; }
  else if (id === 'kristall') { [1, 3, 3, 5, 5, 5, 3, 1].forEach((wd, r) => { for (let i = 0; i < wd; i++) b.set(cx - Math.floor(wd / 2) - (wd % 2 ? 0 : 1) + i, r, i === 0 ? '#ffffff' : oc); }); b.set(cx, 3, '#fff'); b.rect(cx - 2, 8, 4, 1, G[1]); head = [cx, 4]; }
  else if (id === 'knochen') { b.rect(cx - 3, 2, 6, 5, RB[1]); b.rect(cx - 2, 7, 4, 1, RB[1]); b.rect(cx - 3, 2, 6, 1, RB[2]); b.set(cx - 2, 4, t >= 3 ? oc : OUT); b.set(cx + 1, 4, t >= 3 ? oc : OUT); b.set(cx - 1, 6, RB[0]); b.set(cx, 6, RB[0]); head = [cx, 4]; }
  else if (id === 'mond') { for (let y = 0; y < 10; y++) for (let x = 0; x < W; x++) { const d1 = Math.hypot(x - cx, y - 5), d2 = Math.hypot(x - cx - 2.4, y - 3.6); if (d1 <= 4.6 && d2 > 3.4) b.set(x, y, x < cx - 2 ? M[3] : M[2]); } b.disc(cx - .5, 5, 1, oc); head = [cx, 5]; }
  if (it.rar >= 4 || it.set || t >= 4) { b.set(cx - 2, 9, G[2]); b.set(cx + 1, 9, G[2]); }
  if (it.rar >= 2) { b.set(cx - 1, 10, 'gm'); b.set(cx, 10, 'gd'); }
  if (t >= 5) { b.set(cx - 1, H - 1, G[1]); b.set(cx, H - 1, G[0]); b.set(cx - 3, 8, G[1]); b.set(cx + 2, 8, G[1]); }
  if (t >= 6) { b.set(cx - 4, 9, G[2]); b.set(cx + 3, 9, G[2]); }
  return { b, ox: cx, oy: H - 6, bow: false, A: { tip: [cx, 0], guard: [cx, 9], pom: [cx, H - 2], head, top: 0, hy: 10, gw: 2, runes } };
}
/* Farbe des Zauberstab-Kopfes / Klingenglanz für Licht und Partikel (benannte Gegenstände: ihre Zierfarbe) */
function weaponGlow(it) { const L = itemLook(it); if (L) return L.acc; return it.base === 'staff' ? (it.myth ? '#ff4fd8' : ORB[clamp(it.tier, 0, 7)]) : (MAT[clamp(it.tier, 0, 7)].glow || MAT[clamp(it.tier, 0, 7)].m[3]); }

/* ---------- Zierde für benannte Gegenstände ----------
   zeichnet in den gepolsterten Puffer, A = Ankerpunkte (tip, guard, pom, head; Rüstung: chest, top, bot), top/hy = Bereich der Klinge/des Kopfs */
const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function setE(b, x, y, c) { x = Math.round(x); y = Math.round(y); if (!b.get(x, y)) b.set(x, y, c); }
function discE(b, cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + .3) setE(b, x, y, c); }
// leere Randpixel oberhalb von ymax, mit Richtung nach außen
function edgeList(b, ymax) { const r = []; for (let y = 0; y < Math.min(b.h, ymax); y++) for (let x = 0; x < b.w; x++) if (!b.get(x, y)) for (const [dx, dy] of NB4) if (b.get(x + dx, y + dy)) { r.push([x, y, -dx, -dy]); break; } return r; }
function pickN(E, n, R) { const r = []; if (E.length) for (let i = 0; i < n; i++) r.push(E[Math.floor(R() * E.length)]); return r; }
const isBody = c => c && /^(m[0-3]|c[01]|w[0-2])$/.test(c);
const DECO = {
  sun(b, A, R, o) { const [x, y] = A[o.at || 'guard'], r = o.r || 3.2; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, L = k % 2 ? 1.6 : 2.8; for (let d = r + .8; d <= r + L; d += .7) setE(b, x + Math.cos(a) * d, y + Math.sin(a) * d, k % 2 ? 'a1' : 'a2'); } discE(b, x, y, r - 1.2, 'a3'); discE(b, x, y, r - .4, 'a2'); discE(b, x, y, r, 'a1'); },
  rays(b, A, R, o) { const [x, y] = A[o.at || 'head']; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + .39; for (let d = 3.4; d <= 5 + (k % 2); d += .8) setE(b, x + Math.cos(a) * d, y + Math.sin(a) * d, d > 4.6 ? 'a1' : 'a2'); } },
  flames(b, A, R, o) {
    const span = Math.max(1, A.hy - A.top);
    for (const [x, y, dx, dy] of edgeList(b, A.hy)) { if (dy > 0 || R() > (o.p || .55)) continue; const k = (y - A.top) / span; setE(b, x, y, k < .3 ? 'a3' : k < .65 ? 'a2' : 'a1'); if (R() < .55) setE(b, x + dx, y - 1, k < .5 ? 'a2' : 'a1'); if (R() < .3) setE(b, x + dx, y - 2, 'a3'); }
    const [tx, ty] = A.tip; setE(b, tx, ty - 1, 'a2'); setE(b, tx, ty - 2, 'a3'); setE(b, tx + 1, ty - 3, 'a2');
  },
  embers(b, A, R, o) { for (let i = 0, n = 0; i < 400 && n < (o.n || 6); i++) { const x = Math.floor(R() * b.w), y = Math.floor(R() * Math.min(b.h, A.hy)); if (isBody(b.get(x, y))) { b.set(x, y, R() < .5 ? 'a2' : 'a1'); n++; } } },
  frost(b, A, R, o) { for (const [x, y, dx, dy] of edgeList(b, A.hy)) { if (R() > (o.p || .25)) continue; setE(b, x, y, 'a2'); if (R() < .6) setE(b, x + dx, y + dy, 'a3'); } },
  crystals(b, A, R, o) { const E = edgeList(b, A.hy).filter(e => !o.at || Math.hypot(e[0] - A[o.at][0], e[1] - A[o.at][1]) < 6); for (const [x, y, dx, dy] of pickN(E, o.n || 3, R)) { setE(b, x, y, 'a1'); setE(b, x + dx, y + dy, 'a2'); setE(b, x + 2 * dx, y + 2 * dy - (dx ? 1 : 0), 'a3'); if (dx) setE(b, x + dx, y - 1, 'a2'); } },
  bolt(b, A, R) { for (let y = A.top + 1, i = 0; y < A.hy; y++, i++) { let a = -1, c = -1; for (let x = 0; x < b.w; x++) if (b.get(x, y)) { if (a < 0) a = x; c = x; } if (a < 0 || c - a < 2) continue; const x = ((a + c) >> 1) + [0, 1, 0, -1][(i >> 1) % 4]; if (b.get(x, y)) b.set(x, y, i % 4 === 1 ? 'a3' : 'a2'); } },
  arcs(b, A, R, o) { for (const [x, y, dx, dy] of pickN(edgeList(b, A.hy), o.n || 4, R)) { const s = R() < .5 ? 1 : -1; setE(b, x, y, 'a3'); setE(b, x + dx + (dy ? s : 0), y + dy + (dx ? s : 0), 'a2'); setE(b, x + 2 * dx, y + 2 * dy, 'a3'); } },
  wings(b, A, R, o) {
    const [x, y] = A[o.at || 'guard'], L = o.big ? 7 : o.s || 4, fy = o.flip ? -1 : 1, x0 = o.x0 || 2;
    for (let i = 0; i < L; i++) { const h = Math.round(i * .85), n = 1 + (i >> 1); for (let j = 0; j <= n; j++) { if (o.bat && j === n && i % 2) continue; const c = o.bat ? (j === 0 ? 'a2' : j === n ? 'a0' : 'a1') : (j === 0 ? 'a3' : j === 1 ? 'a2' : 'a1'); for (const s of [-1, 1]) setE(b, x + s * (x0 + i), y + fy * (j - h), c); } }
  },
  skull(b, A, R, o) { const [x, y] = A[o.at || 'pom']; [[-1, -1, 'b2'], [0, -1, 'b2'], [1, -1, 'b2'], [-1, 0, 'a2'], [0, 0, 'b1'], [1, 0, 'a2'], [-1, 1, 'b1'], [1, 1, 'b1'], [0, 1, 'b0']].forEach(([dx, dy, c]) => b.set(x + dx, y + dy, c)); },
  eye(b, A, R, o) { const [x, y] = A[o.at || 'head']; b.disc(x, y, 2.3, '#ffffff'); b.rect(x - 1, y - 1, 2, 2, 'a1'); b.set(x, y, 'a0'); b.set(x - 1, y - 1, 'a3'); for (let i = -2; i <= 2; i++) b.set(x + i, y - 3, 'g1'); b.set(x - 3, y - 2, 'g1'); b.set(x + 3, y - 2, 'g1'); },
  star(b, A, R, o) { const [x, y] = A[o.at || 'tip'], s = o.s || 2; for (let d = 1; d <= s; d++) for (const [dx, dy] of NB4) b.set(x + dx * d, y + dy * d, d === s ? 'a1' : 'a2'); if (s >= 2) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) b.set(x + dx, y + dy, 'a1'); b.set(x, y, 'a3'); },
  stars(b, A, R, o) { for (const [x, y, dx, dy] of pickN(edgeList(b, A.hy), o.n || 4, R)) { const sx = x + dx * 2, sy = y + dy * 2; if (b.get(sx, sy)) continue; b.set(sx, sy, 'a3'); if (R() < .5) for (const [ex, ey] of NB4) setE(b, sx + ex, sy + ey, 'a1'); } },
  spark(b, A, R, o) { for (let i = 0, n = 0; i < 300 && n < (o.n || 3); i++) { const x = Math.floor(R() * b.w), y = Math.floor(R() * Math.min(b.h, A.hy)); if (b.get(x, y)) { b.set(x, y, '#ffffff'); n++; } } },
  snake(b, A) { const [x, y] = A.guard; [[2, -1, 'a2'], [3, -1, 'a2'], [3, -2, 'a1'], [4, -1, 'a1'], [2, 0, 'a1'], [3, 0, 'a1'], [4, 0, 'a1'], [5, 0, 'a0']].forEach(([dx, dy, c]) => b.set(x + dx, y + dy, c)); b.set(x + 4, y - 1, '#e8402a'); b.set(x + 6, y + 1, '#e8402a'); b.set(x + 7, y, '#e8402a'); for (let k = 1; k < 5; k++) b.set(x + (k % 2 ? -1 : 2), y + 1 + k, 'a1'); },
  moon(b, A, R, o) { const [x, y] = A[o.at || 'pom']; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const d1 = Math.hypot(dx, dy), d2 = Math.hypot(dx - 1.2, dy - .8); if (d1 <= 2.3 && d2 > 1.6) b.set(x + dx, y + dy + 1, dx < 0 ? 'a3' : 'a2'); } },
  lion(b, A, R, o) { const [x, y] = A[o.at || 'guard']; pxStamp(b, ['.01010.', '0111110', '1hkhkh1', '1hhhhh1', '12h0h21', '.12h21.', '..111..'], x - 3, y - 3); },
  scales(b, A, R, o) { const tk = o.tok || ['m1', 'm2']; for (let y = 0; y < Math.min(b.h, A.hy); y++) for (let x = 0; x < b.w; x++) { const c = b.get(x, y); if (!tk.includes(c)) continue; const q = (x + ((y >> 1) & 1) * 2) % 4; if (q === 0 && (y & 1)) b.set(x, y, 'a1'); else if (q === 1 && !(y & 1)) b.set(x, y, 'a2'); } },
  crack(b, A, R) { let p = null; for (let y = A.top; y < A.hy && !p; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) === 'm2') { p = [x, y]; break; } let n = 0; while (p && n++ < 40) { b.set(p[0], p[1], n % 3 ? 'a2' : 'a3'); const c = [-1, 0, 1].map(d => [p[0] + d, p[1] + 1]).filter(([x, y]) => y < A.hy && /^m[12]$/.test(b.get(x, y) || '')); p = c.length ? c[Math.floor(R() * c.length)] : null; } },
  wisp(b, A, R, o) { const [x, y] = A[o.at || 'tip'], f = o.flip ? -1 : 1; [[1, -1, 'a3'], [2, -2, 'a2'], [2, -3, 'a2'], [1, -4, 'a1'], [0, -4, 'a1'], [-1, -3, 'a0']].forEach(([dx, dy, c]) => setE(b, x + dx, y + dy * f, c)); },
  thorns(b, A, R, o) { for (const [x, y, dx, dy] of edgeList(b, A.hy)) { if (R() > (o.p || .3)) continue; setE(b, x, y, 'a0'); setE(b, x + (dx || (R() < .5 ? 1 : -1)), y + (dy || -1), 'a2'); } },
  feather(b, A, R, o) { const [x, y] = A[o.at || 'guard']; for (const s of [0, 3]) for (let k = 1; k <= 5; k++) { setE(b, x + 1 + s + (k >> 1), y + k, k === 5 ? 'a3' : 'a0'); setE(b, x + 2 + s + (k >> 1), y + k, 'a2'); } },
  gradient(b, A) { const span = Math.max(1, A.hy - A.top); for (let y = A.top; y < A.hy; y++) for (let x = 0; x < b.w; x++) { const c = b.get(x, y), k = (y - A.top) / span; if (c === 'm2') b.set(x, y, k < .3 ? 'a3' : k < .62 ? 'a2' : 'a1'); else if (c === 'm1') b.set(x, y, k < .5 ? 'a1' : 'a0'); } },
  drip(b, A, R, o) { for (const [x, y] of pickN(edgeList(b, A.hy).filter(e => e[2]), o.n || 3, R)) { setE(b, x, y, 'a2'); setE(b, x, y + 1, 'a1'); if (R() < .6) setE(b, x, y + 3, 'a2'); } },
  smoke(b, A, R, o) { for (const [x, y, dx] of pickN(edgeList(b, A.hy), o.n || 4, R)) { const s = dx || (R() < .5 ? 1 : -1); setE(b, x, y, 'a1'); setE(b, x + s, y - 1, 'a0'); setE(b, x + s * 2, y - 1, 'a0'); setE(b, x + s * 2, y - 2, 'a1'); } },
  horns(b, A, R, o) { const [x, y] = A[o.at || 'guard'], w = (o.w || A.gw) + 1; for (const s of [-1, 1]) { const hx = x + s * w; setE(b, hx, y - 1, 'a1'); setE(b, hx + s, y - 2, 'a1'); setE(b, hx + s, y - 3, 'a2'); setE(b, hx, y - 4, 'a3'); } },
  hook(b, A) { const [x, y] = A.tip; [[-1, 0, 'm3'], [-2, 1, 'm3'], [-3, 1, 'm2'], [-4, 2, 'm2'], [-5, 3, 'm1'], [-5, 4, 'm1']].forEach(([dx, dy, c]) => setE(b, x + dx, y + dy, c)); },
  snowcap(b, A, R) { for (let y = A.top; y < A.hy; y++) for (let x = 0; x < b.w; x++) { const c = b.get(x, y); if (c && /^m/.test(c) && !b.get(x, y - 1)) { b.set(x, y, 'a3'); if (R() < .35 && b.get(x, y + 1)) b.set(x, y + 1, 'a2'); } } },
  flower(b, A, R, o) { const [x, y] = A[o.at || 'guard']; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => b.set(x + dx, y + dy, 'a1')); NB4.forEach(([dx, dy]) => b.set(x + dx, y + dy, 'a2')); b.set(x, y, 'a3'); setE(b, x - 2, y + 2, 'a0'); setE(b, x + 2, y + 2, 'a0'); setE(b, x - 3, y + 2, 'a0'); setE(b, x + 3, y + 1, 'a0'); },
  leaf(b, A, R, o) { for (const [x, y, dx] of pickN(edgeList(b, A.hy).filter(e => e[2]), o.n || 4, R)) { setE(b, x, y, 'a1'); setE(b, x + dx, y - 1, 'a2'); setE(b, x + dx, y, 'a0'); setE(b, x + 2 * dx, y - 1, 'a1'); } },
  vine(b, A) { for (const [x, y, dx] of edgeList(b, A.hy)) if (dx && y % 3 === 0) setE(b, x, y, 'a0'); },
  kiss(b, A, R, o) { const [x, y] = A[o.at || 'guard']; b.set(x - 1, y - 1, 'a2'); b.set(x + 1, y - 1, 'a2'); b.rect(x - 1, y, 3, 1, 'a2'); b.set(x, y + 1, 'a2'); b.set(x - 1, y - 1, 'a3'); },
  heart(b, A, R, o) { const [x, y] = A[o.at || 'chest']; pxStamp(b, ['.3...', '.2...', '11.11', '12211', '.111.', '..0..'].map(s => s), x - 2, y - 3); },
  flameE(b, A, R, o) { const [x, y] = A[o.at || 'chest']; pxStamp(b, ['..3..', '.32..', '.232.', '12321', '.121.'], x - 2, y - 2); },
  rune(b, A, R, o) { const [x, y] = A[o.at || 'chest']; pxStamp(b, ['2.2', '.3.', '232', '.2.', '2.2'], x - 1, y - 2); },
  studs(b, A, R, o) { for (const [x, y] of [A.shl, A.shr]) { b.set(x, y, 'a3'); b.set(x - 1, y + 2, 'a2'); b.set(x + 1, y + 2, 'a2'); } },
  gem(b, A, R, o) { const [x, y] = A[o.at || 'guard']; b.set(x, y, '#ffffff'); b.set(x + 1, y, 'gm'); b.set(x, y + 1, 'gm'); b.set(x + 1, y + 1, 'gd'); }
};

/* ---------- Rüstung & Helm (Icons, 20×20) ---------- */
const AACACHE = {};
function armorArt(it, cls) { return armorSpr(it, cls).c; }
function armorSpr(it, cls) {
  const st = CLASSES[cls].style, k = itemArtKey(it) + st; if (AACACHE[k]) return AACACHE[k];
  const L = itemLook(it), pal = itemPal(it, L), R = mulberry(hashStr(k)), b0 = PB(20, 20), b = offPB(b0, 2, 2), t = it.tier, r = it.rar;
  const A = { chest: [10, 8], neck: [10, 3], bot: [10, 16], shl: [5, 5], shr: [14, 5], hy: 20 };
  const hx0 = L && L.h ? 10 - (L.h[0].length >> 1) : 0, hy0 = L && L.h ? 10 - (L.h.length >> 1) : 0;
  if (it.slot === 'helm' && L && L.h) pxStamp(b0, L.h, hx0, hy0);
  else if (it.slot === 'armor') armorBody(b, st, t, r, A);
  else helmBody(b, st, t, r);
  A.tip = A.neck; A.guard = A.head = A.chest; A.pom = A.bot; A.top = 0;
  if (it.slot === 'armor') {
    if (r === 3 || (r >= 4 && !L)) for (const [x, y] of A.runes || []) if (b0.get(x, y)) b0.set(x, y, (x + y) % 2 ? 'r1' : 'r0');
    if (L && L.a) for (const [d, o] of L.a) DECO[d](b0, A, R, o || {});
  }
  if (it.slot === 'helm' && (r === 3 || (r >= 4 && !L))) for (const [x, y] of [[7, 9], [13, 9], [10, 6]]) if (b0.get(x, y)) b0.set(x, y, 'r0');
  pbOutline(b0, 'ou'); if (pal.rg) pbOutline(b0, 'rg');
  if (it.slot === 'helm' && L && L.h2) pxStamp(b0, L.h2, hx0, hy0); // Heiligenschein ohne Umriss: leuchtet frei
  const res = { c: pbCanvas(b0, pal), col: L ? L.acc : RAR[clamp(r, 0, 6)].c };
  if (L && L.cyc) res.fr = cycFrames(b0, pal, L.cyc, res.c);
  return AACACHE[k] = res;
}
// Rüstung je Klassen-Stil; Stufe: Schulterdornen, Nähte, Sterne; Seltenheit: Juwel (2 px), Runen (Episch)
function armorBody(b, st, t, r, A) {
  const a = 'c0', s = 'c1', h = 'm3', tr = 'tr';
  if (st === 'plate') {
    for (let y = 3; y < 13; y++) { const ww = y < 10 ? 10 : 8, x0 = 8 - ww / 2; for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); b.set(x0, y, h); }
    b.disc(3.5, 3.5, 2.2, a); b.disc(12, 3.5, 2.2, s); b.set(3, 2, h);
    b.rect(6, 3, 4, 1, s); b.rect(7, 4, 2, 6, tr); b.rect(4, 10, 8, 1, tr); b.rect(5, 13, 2, 2, s); b.rect(9, 13, 2, 2, s);
    if (t >= 2) { b.rect(2, 5, 3, 1, tr); b.rect(11, 5, 3, 1, tr); }
    if (t >= 3) { b.set(3, 0, h); b.set(3, 1, a); b.set(12, 0, h); b.set(12, 1, s); }
    if (t >= 5) { b.set(1, 1, h); b.set(14, 1, h); b.set(0, 3, h); b.set(15, 3, s); b.rect(5, 7, 1, 2, h); b.rect(10, 7, 1, 2, h); }
    if (t >= 6) { b.set(7, 4, 'm3'); b.set(8, 4, 'm3'); }
    A.chest = [10, 8]; A.shl = [5, 5]; A.shr = [14, 5]; A.runes = [[7, 9], [12, 9], [7, 11], [12, 11]];
  } else if (st === 'robe') {
    for (let y = 2; y < 15; y++) { const ww = Math.min(13, 5 + Math.floor((y - 2) * .8)), x0 = 8 - Math.floor(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); }
    b.rect(2, 4, 2, 5, s); b.rect(12, 4, 2, 5, s); b.rect(6, 2, 4, 2, tr); b.rect(7, 4, 2, 10, tr); b.rect(3, 14, 10, 1, tr); b.rect(4, 8, 8, 1, RL[1]);
    if (t >= 3) { b.rect(5, 3, 1, 2, tr); b.rect(10, 3, 1, 2, tr); }
    if (t >= 5) for (let x = 3; x < 13; x += 2) b.set(x, 13, h);
    if (t >= 6) { b.set(2, 3, h); b.set(13, 3, h); }
    A.chest = [10, 8]; A.runes = [[6, 11], [11, 11], [5, 13], [12, 13]];
  } else if (st === 'cloak') {
    b.disc(8, 4, 3.6, s); b.disc(8, 4.5, 2.2, OUT);
    for (let y = 6; y < 15; y++) { const ww = Math.min(13, 7 + (y - 6)), x0 = 8 - Math.floor(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); b.set(8, y, '#1e1828'); }
    b.set(5, 7, h); b.rect(7, 7, 2, 1, tr);
    if (t >= 3 || r >= 1) { b.rect(3, 13, 11, 1, tr); }
    if (t >= 5) { b.set(4, 2, h); b.set(12, 2, h); b.set(3, 3, s); b.set(13, 3, s); }
    if (t >= 6) b.set(8, 4, 'm3');
    A.chest = [10, 10]; A.neck = [10, 7]; A.runes = [[6, 12], [12, 12], [5, 14], [13, 14]];
  } else {
    for (let y = 3; y < 14; y++) { const ww = 9, x0 = 4; for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < 4 ? a : s); }
    b.rect(3, 3, 2, 3, s); b.rect(12, 3, 2, 3, s); b.rect(6, 3, 4, 1, RL[1]);
    for (let y = 5; y < 10; y++) b.set(y % 2 ? 7 : 8, y, RL[2]); b.rect(4, 10, 9, 1, r >= 1 ? tr : RL[1]); b.set(8, 10, tr);
    if (t >= 3) { b.rect(2, 2, 3, 2, tr); b.rect(12, 2, 3, 2, tr); }
    if (t >= 5) { b.set(2, 1, h); b.set(14, 1, h); b.set(7, 10, h); b.set(9, 10, h); }
    if (t >= 6) b.rect(5, 12, 7, 1, h);
    A.chest = [10, 8]; A.runes = [[7, 7], [12, 7], [7, 13], [12, 13]];
  }
  if (r >= 2) { const [x, y] = A.chest; b.set(x - 2, y - 2 - (st === 'cloak' ? 1 : 0), 'gm'); b.set(x - 2, y - 1 - (st === 'cloak' ? 1 : 0), 'gd'); }
}
function helmBody(b, st, t, r) {
  const a = 'c0', s = 'c1', h = 'm3', tr = 'tr', T = MAT[clamp(t, 0, TIERS - 1)];
  if (st === 'plate') {
    for (let y = 4; y < 13; y++) { const ww = y < 6 ? 7 : 9, x0 = 8 - Math.ceil(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); b.set(x0, y, h); }
    b.rect(5, 8, 7, 1, OUT); b.rect(7, 9, 1, 3, OUT); b.rect(9, 9, 1, 3, OUT);
    if (T.pl) { b.rect(7, 1, 3, 3, T.pl[0]); b.set(10, 2, T.pl[1]); b.set(10, 1, T.pl[1]); }
    if (t >= 3 || r >= 1) { b.rect(3, 11, 11, 1, tr); }
    if (t >= 5) { b.set(3, 5, h); b.set(2, 4, h); b.set(13, 5, s); b.set(14, 4, h); }
    if (t >= 6) { b.set(5, 6, 'm3'); b.set(11, 6, 'm3'); }
  } else if (st === 'robe') {
    for (let y = 1; y < 11; y++) { const ww = Math.max(1, Math.floor(y * .7)), x0 = 7 - Math.floor(ww / 2) + Math.round((10 - y) * .25); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); }
    b.rect(1, 11, 14, 2, s); b.rect(2, 11, 6, 1, a); b.rect(4, 10, 8, 1, tr);
    if (t >= 3) { b.set(9, 1, h); b.set(10, 0, h); }
    if (t >= 5) { b.set(1, 13, tr); b.set(14, 13, tr); b.set(6, 7, h); }
    if (t >= 6) { b.set(7, 4, '#ffffff'); }
  } else if (st === 'cloak') {
    for (let y = 2; y < 14; y++) { const ww = y < 4 ? 7 : y > 11 ? 7 : 9, x0 = 8 - Math.ceil(ww / 2); for (let i = 0; i < ww; i++) b.set(x0 + i, y, i < ww / 2 ? a : s); }
    b.rect(4, 6, 3, 2, OUT); b.rect(9, 6, 3, 2, OUT); b.set(5, 6, t >= 4 ? T.m[3] : '#e8e2cf'); b.set(10, 6, t >= 4 ? T.m[3] : '#e8e2cf'); b.rect(6, 10, 4, 1, s);
    if (t >= 3) { b.set(3, 2, a); b.set(12, 2, s); b.set(2, 1, h); b.set(13, 1, h); }
    if (t >= 5 || r >= 1) { b.rect(5, 12, 6, 1, tr); }
  } else {
    for (let x = 2; x < 14; x++) { const y = 8 + Math.round(Math.abs(x - 7.5) * -.35 + 1.5); b.set(x, y, a); b.set(x, y + 1, r >= 1 ? tr : s); }
    b.line(11, 7, 14, 1, '#f0f0f0'); b.line(12, 7, 14, 2, T.c[0]); b.set(14, 0, '#fff');
    if (t >= 3) { b.line(3, 7, 1, 2, '#f0f0f0'); b.set(1, 1, '#fff'); }
    if (t >= 5) { b.set(5, 8, h); b.set(10, 8, h); }
  }
  if (r >= 2) { const y = st === 'vest' ? 9 : st === 'robe' ? 10 : st === 'cloak' ? 3 : 5; b.set(8, y, 'gm'); if (st !== 'vest') b.set(8, y + 1, 'gd'); }
}

/* ---------- Benannte Gegenstände: eigene Palette, Zierde, Helmform, Kopfschmuck am Helden ----------
   Schlüssel: Legendär = Name, Set = 's:<set>', Mythisch = 'm:<kraft>'. p: Farben (m Metall, g Beschlag, l Griff, w Holz/Schaft,
   b Knochen, c Rüstung, a Zierfarben, gm Edelstein, ob Kugel, tr Rüstungsborte), w: Waffen-Zierde, a: Rüstungs-Zierde,
   h: Helm-Bild, hd: Kopfschmuck am Helden, acc: Leuchtfarbe (Aura, Strahl, Schweif), cyc: wandernde Zierfarben (Mythisch) */
const FIRE4 = ['#8a1e10', '#e8401e', '#ff9a2a', '#ffe27a'], ICE4 = ['#2a5a8a', '#5aa8e8', '#a8e8ff', '#ffffff'], GOLD4 = ['#9c6a24', '#e8b04a', '#ffe08a', '#fffbe0'];
const SOUL4 = ['#1e5a4a', '#3ac8a0', '#9affd8', '#f0fff8'], VOLT4 = ['#3a3aa8', '#8ab0ff', '#fff08a', '#ffffff'], VENOM4 = ['#1e4a1a', '#3a9a2a', '#8ae04a', '#e0ffb0'], LEAF4 = ['#1e4a1e', '#3a8a2a', '#79c24e', '#c8f06a'];
const ITEMLOOK = {
  /* Legendär – Waffen */
  'Nachtzahn': { p: { m: ['#2a1e48', '#6a58a0', '#c8c0e8', '#ffffff'], g: ['#1e1030', '#4a2a7a', '#8a5ad0'], l: ['#1a1420', '#3a2a4a', '#5a4a6a'], gm: '#e0ccff', a: ['#2a1a4a', '#6a48c0', '#c8b0ff', '#ffffff'] }, w: [['hook'], ['moon', { at: 'pom' }], ['stars', { n: 3 }]], acc: '#b892f4' },
  'Viperbiss': { p: { m: ['#1e3a14', '#3a7a2a', '#79c24e', '#d8ffb0'], g: ['#3a3a10', '#8a8a2a', '#c8c84a'], gm: '#e8402a', a: VENOM4 }, w: [['snake'], ['drip', { n: 4 }]], acc: '#8ae04a' },
  'Schattenkuss': { p: { m: ['#0e0814', '#2a1e3a', '#4a3a6a', '#c8a8f0'], g: ['#0e0814', '#2a1e3a', '#5a4a7a'], l: ['#0e0814', '#2a1e3a', '#3a2a4a'], gm: '#ff4a8a', a: ['#2a1e3a', '#6a48c0', '#ff4a8a', '#ffc0d8'] }, w: [['smoke', { n: 6 }], ['kiss']], acc: '#d06ae8' },
  'Sonnenklinge': { p: { m: ['#9c5a10', '#e8a020', '#ffd24a', '#fff8c0'], g: GOLD4, gm: '#ff5a2a', a: ['#c8641a', '#ffb03a', '#ffe27a', '#ffffff'] }, w: [['sun', { r: 3.8 }], ['spark', { n: 2 }]], acc: '#ffd24a' },
  'Morgenrot': { p: { m: ['#6a1428', '#c83a4a', '#ff8a6a', '#ffe0c0'], g: ['#7a3a2a', '#e88a5a', '#ffd0a0'], gm: '#ffe08a', a: ['#a8202a', '#ff6a4a', '#ffb06a', '#fff0c0'] }, w: [['gradient'], ['wings', { s: 6 }], ['spark', { n: 2 }]], acc: '#ff7a5a' },
  'Sturmbrecher': { p: { m: ['#1e2a4a', '#4a6aa8', '#a8c8f0', '#ffffff'], g: ['#1e2a3a', '#4a5a7a', '#8a9ab8'], gm: '#8ad8ff', a: VOLT4 }, w: [['bolt'], ['arcs', { n: 4 }]], acc: '#a8c8ff' },
  'Weltspalter': { p: { m: ['#2a1e14', '#5a4430', '#8a7058', '#c8b090'], g: ['#2a1e14', '#5a4430', '#a8743e'], w: ['#2a1e14', '#4a3420', '#6a5038'], gm: '#ff6a2a', a: ['#7a1e10', '#ff6a2a', '#ffd24a', '#fff0a0'] }, w: [['crack'], ['crack'], ['embers', { n: 3 }], ['crystals', { n: 3 }]], acc: '#ff8a3a' },
  'Donnerkeil': { p: { m: ['#1e1e4a', '#3a3a8a', '#8a90e0', '#e8ecff'], g: GOLD4, gm: '#fff08a', a: VOLT4 }, w: [['arcs', { n: 7 }], ['spark', { n: 2 }]], acc: '#fff08a' },
  'Bergfäller': { p: { m: ['#2a302a', '#4a5a4a', '#7a8a78', '#c8d0c0'], g: ['#3a2a14', '#7a5a2a', '#a8843e'], w: ['#3a2a14', '#5a4020', '#7a5a2a'], gm: '#57c7e6', a: ['#5a8aa8', '#a8d8f0', '#e8f8ff', '#ffffff'] }, w: [['snowcap'], ['crystals', { n: 3 }]], acc: '#c8e8ff' },
  'Sternenfall': { p: { m: ['#10123a', '#2a2a8a', '#5a5ae0', '#c8c8ff'], g: ['#1a1a4a', '#4a4ab0', '#9aa2ff'], gm: '#ffe08a', st: '#c8c8ff', a: ['#4a4ad0', '#9aa2ff', '#ffe08a', '#ffffff'] }, w: [['stars', { n: 6 }], ['star', { at: 'tip' }], ['star', { at: 'pom', s: 1 }]], acc: '#ffe08a' },
  'Himmelsbogen': { p: { m: ['#4a7aa8', '#8ac8f0', '#e0f4ff', '#ffffff'], w: ['#4a7aa8', '#8ac8f0', '#e0f4ff'], g: GOLD4, gm: '#57c7e6', a: ['#6a9ac8', '#c8e4ff', '#ffffff', '#ffffff'] }, w: [['wings', { at: 'tip', s: 4, x0: 1 }], ['wings', { at: 'pom', s: 4, x0: 1, flip: 1 }]], acc: '#bfefff' },
  'Windflüsterer': { p: { m: ['#1e5a4a', '#3aa88a', '#8ae8c8', '#e8fff4'], w: ['#1e5a4a', '#3aa88a', '#8ae8c8'], g: ['#1e3a2a', '#3a7a5a', '#79c2a0'], gm: '#c8fff0', a: ['#3aa88a', '#8ae8c8', '#e8fff4', '#ffffff'] }, w: [['feather'], ['wisp', { at: 'tip' }], ['wisp', { at: 'pom', flip: 1 }]], acc: '#8ae8c8' },
  'Sternenfeuer': { p: { m: ['#14143a', '#2a2a6a', '#4a4ab0', '#9aa2ff'], w: ['#14143a', '#2a2a6a', '#4a4ab0'], g: ['#2a2a6a', '#5a5ae0', '#c8c8ff'], ob: '#9ad0ff', a: ['#3a6ae8', '#8ab8ff', '#d8ecff', '#ffffff'] }, w: [['star', { at: 'head', s: 3 }], ['flames', { p: .45 }]], acc: '#8ab8ff' },
  'Eiswind': { p: { m: ['#4a7a9a', '#8ac0d8', '#c8eef8', '#ffffff'], w: ['#3a6a8a', '#6aa8c8', '#a8d8f0'], g: ['#2a5a7a', '#57a7d6', '#bfefff'], ob: '#bfefff', a: ICE4 }, w: [['crystals', { n: 5, at: 'head' }], ['frost', { p: .35 }]], acc: '#a8e8ff' },
  'Weltenauge': { p: { m: ['#3a2a14', '#7a5a2a', '#a8843e', '#e8c070'], w: ['#3a2a14', '#6a4a24', '#8a6a3a'], g: GOLD4, ob: '#ffffff', a: ['#1e5a3a', '#3aa86a', '#8ae8a8', '#ffffff'] }, w: [['eye'], ['rays', { at: 'head' }]], acc: '#5ad88a' },
  /* Legendär – Rüstungen */
  'Ewige Wacht': { p: { c: ['#e8ecf4', '#8a96aa'], m: ['#4a5466', '#8a96aa', '#c8d2e0', '#ffffff'], tr: '#57a7d6', gm: '#57c7e6', a: ['#1e3a6a', '#57a7d6', '#bfefff', '#ffffff'] }, a: [['eye', { at: 'chest' }], ['wings', { at: 'neck', s: 5, x0: 3 }]], acc: '#8ad8ff' },
  'Phönixherz': { p: { c: ['#d8401e', '#7a1e10'], m: ['#6a1410', '#b8301e', '#f06a2a', '#ffd24a'], tr: '#ffd24a', gm: '#ffd24a', a: FIRE4 }, a: [['heart', { at: 'chest' }], ['embers', { n: 5 }]], acc: '#ff8a3a' },
  'Bollwerk der Ahnen': { p: { c: ['#a8743e', '#5a3a1a'], m: ['#3a2a14', '#6a4a24', '#a8743e', '#e8c890'], tr: '#5ad8a8', gm: '#3ac8a0', a: ['#1e5a4a', '#3ac8a0', '#9affd8', '#ffffff'] }, a: [['rune', { at: 'chest' }], ['studs']], acc: '#5ad8a8' },
  /* Legendär – Helme (eigene Form) */
  'Krone der Ahnen': {
    p: { g: ['#5a3a1a', '#a8743e', '#e8b070'], a: ['#1e5a4a', '#3ac8a0', '#9affd8', '#ffffff'] },
    h: ['..i....i....i..', '.hrh..heh..hbh.', '.hhh..hhh..hhh.', '.hhhh.hhh.hhhh.', '.hhhhhhhhhhhhh.', '.g1gg1ggg1gg1g.', '.hhhhhhhhhhhhh.', '.ggggggggggggg.'],
    hd: ['i..i..i', 'hrhehbh', 'hhhhhhh', 'g1g1g1g'], acc: '#e8b070'
  },
  'Drachenblick': {
    p: { m: ['#3a0806', '#7a1410', '#b8301e', '#e86a3a'], a: ['#2a1e14', '#6a5a48', '#c8b8a0', '#fff0c0'] },
    h: ['1.............1', '21...........12', '.21.........12.', '..2mmmmmmmmm2..', '..mnnnnnnnnnm..', '.mnnoonnnoonnm.', '.mnnyynnnyynnm.', '.mnnnnnpnnnnnm.', '.mnooooooooonm.', '..mnnnnnnnnnm..', '..mw.w.w.w.wm..', '...mnnnnnnnm...'],
    hd: ['1.......1', '21.....12', '.2nnnnn2.'], acc: '#ff6a3a'
  },
  'Löwenhaupt': {
    p: { g: ['#9c6a24', '#e8b04a', '#ffe08a'], a: ['#7a3a10', '#d8802a', '#ffb03a', '#ffe27a'] },
    h: ['.0.0.0.0.0.0.0.', '.0111111111110.', '011112222211110', '01112hhhhh21110', '0112hhhhhhh2110', '012hhkhhhkhh210', '012hhhhhhhhh210', '012hhiiiiihh210', '0112hii0iih2110', '.0112hiiih2110.', '.01112hhh21110.', '..01112221110..', '...0.01110.0...'],
    hd: ['.0.0.0.0.', '011111110', '12.....21', '1.......1', '1.......1', '.1.....1.'], hdo: 2, acc: '#ffb03a'
  },
  /* Sets */
  's:lion': {
    p: { m: ['#5a4a2a', '#a89060', '#e8dcb0', '#fffbe8'], g: GOLD4, gm: '#e8402a', c: ['#e8b04a', '#9c6a24'], tr: '#c8342c', a: ['#7a3a10', '#d8802a', '#ffc04a', '#fff0b0'] },
    w: [['lion']], a: [['lion', { at: 'chest' }]],
    h: ['.....rrrr....', '....rrrrrr...', '...rr.rr..r..', '...hhhhhhh...', '..hiiiiiiih..', '..hihhhhhih..', '..hkkkkkkkh..', '..hihhkhhih..', '..hihhkhhih..', '..h1hhhhh1h..', '...ggggggg...'],
    hd: ['..rrr..', '.rr.rr.', 'hiiiiih'], acc: '#ffc04a'
  },
  's:glut': {
    p: { m: ['#1e1414', '#3a2420', '#6a3a2a', '#ff8a3a'], w: ['#1e1414', '#3a2420', '#5a3a2a'], g: ['#5a1e10', '#c8401e', '#ff8a3a'], ob: '#ff8a3a', gm: '#ffd24a', c: ['#5a2a1e', '#2a1414'], tr: '#ff8a3a', a: FIRE4 },
    w: [['flames', { p: .7 }], ['embers', { n: 3 }]], a: [['embers', { n: 9 }], ['flames', { p: .3 }]],
    h: ['.......3.....', '......32.....', '......21.....', '.....mm......', '.....mnm.....', '....mnnm.....', '....mnnnm....', '...mnnnnm....', '...m1212m....', '..mnnnnnnm...', 'mmmmmmmmmmmmm', '.nnnnnnnnnnn.'],
    hd: ['...3.', '..32.', '..m..', '.mnm.', '.121.', 'mmmmm'], acc: '#ff8a3a', flame: 1
  },
  's:nacht': {
    p: { m: ['#1e1030', '#3a2a5a', '#6a4a9a', '#c8b0f0'], g: ['#1e1030', '#3a2a5a', '#6a4a9a'], l: ['#1e1030', '#2a1e3a', '#3a2a5a'], gm: '#79e04a', c: ['#3a2a5a', '#1e1030'], tr: '#79e04a', a: ['#3a8a2a', '#9a5ad8', '#e0b0ff', '#ffe04a'] },
    w: [['flower'], ['leaf', { n: 3 }], ['drip', { n: 3 }]], a: [['flower', { at: 'chest' }], ['smoke', { n: 3 }]],
    h: ['....mmmmm.12', '...mnnnnn232', '..mnnnnnnn12', '..mnoooooonm', '.mnokkkkkonm', '.mnokvkkvkonm', '.mnokkkkkonm', '.mnnoooooonm', '..mnnnnnnnm.', '...mm...mm..'],
    hd: ['.mnnnnm.', 'mn....nm', 'n......n', 'n......n'], hdo: 1, acc: '#b07ae8'
  },
  's:wald': {
    p: { w: ['#4a2e14', '#7a4e24', '#a8743e'], m: ['#3a2a14', '#6a4a24', '#8a6a3a', '#c8a060'], g: ['#2a4a1a', '#3a7a2a', '#79c24e'], gm: '#ff6a8a', c: ['#3a8a3a', '#1e4a1e'], tr: '#a8743e', a: LEAF4 },
    w: [['leaf', { n: 7 }], ['vine']], a: [['leaf', { n: 8 }]],
    h: ['..1.......1..', '.121..2..121.', '..12.121.21..', '...1..1..1...', 'ghhhhhehhhhhg', '.ggggggggggg.'],
    hd: ['1.2.2.1', '.21.12.', 'gghehgg'], acc: '#79c24e'
  },
  's:drache': {
    p: { m: ['#4a0e0a', '#a8201a', '#e84a2a', '#ffb03a'], w: ['#4a0e0a', '#8a1a14', '#c8302a'], g: GOLD4, gm: '#ffd24a', c: ['#c8302a', '#5a0e0a'], tr: '#e8b04a', a: ['#3a0806', '#8a1a14', '#d8402a', '#ffb03a'] },
    w: [['wings', { bat: 1, s: 5 }], ['scales']], a: [['scales', { tok: ['c0', 'c1'] }], ['wings', { at: 'neck', bat: 1, s: 6, x0: 3 }]],
    h: ['2.............2', '21....h.h....12', '211...hhh...112', '.211.hhhhh.112.', '..21hhrrrhh12..', '...hhhrrrhhh...', '...hhhhhhhhh...', '...ggggggggg...'],
    hd: ['2..h.h..2', '21hhhhh12', '.1hhrhh1.'], acc: '#ff6a2a'
  },
  /* Mythisch */
  'm:klinge': {
    p: { m: ['#3a4a6a', '#9ab0d0', '#e8f0ff', '#ffffff'], w: ['#3a4a6a', '#9ab0d0', '#e8f0ff'], g: GOLD4, gm: '#57c7e6', ob: '#bfefff', a: VOLT4 },
    w: [['bolt'], ['wings', { s: 5 }], ['arcs', { n: 5 }], ['star', { at: 'pom', s: 1 }]], cyc: [VOLT4, ['#3a6ae8', '#8ad8ff', '#ffffff', '#ffffff'], ['#8a6a10', '#ffe04a', '#fffbd0', '#ffffff']], acc: '#a8d8ff'
  },
  'm:zorn': {
    p: { m: ['#120808', '#3a1410', '#8a2a1a', '#ff8a3a'], w: ['#120808', '#3a1410', '#5a1e14'], g: ['#1a0a0a', '#5a1410', '#c8301e'], gm: '#ffd24a', ob: '#ff6a2a', a: FIRE4 },
    w: [['flames', { p: .8 }], ['horns']], cyc: [FIRE4, ['#a8201a', '#ff6a2a', '#ffd24a', '#ffffff'], ['#6a1010', '#c8301e', '#ff8a3a', '#ffd27a']], acc: '#ff6a2a'
  },
  'm:ernter': {
    p: { m: ['#1e3a3a', '#3a7a6a', '#8ae0c0', '#e8fff8'], w: ['#1e2a2a', '#3a5a50', '#6a8a80'], g: ['#6a6a5a', '#c8c0a8', '#f0ead8'], gm: '#3ac8a0', ob: '#9affd8', a: SOUL4 },
    w: [['hook', { only: ['sword', 'dagger', 'axe'] }], ['skull', { at: 'guard' }], ['wisp', { at: 'tip' }], ['stars', { n: 3 }]], cyc: [SOUL4, ['#1e4a5a', '#3aa8c8', '#bff4ff', '#ffffff'], ['#2a6a3a', '#5ae08a', '#d8ffe0', '#ffffff']], acc: '#5ae0b0'
  },
  'm:phoenix': {
    p: { c: ['#e8501e', '#8a1e10'], m: ['#6a1410', '#b8301e', '#ff8a3a', '#ffe27a'], tr: '#ffd24a', gm: '#ffe27a', a: FIRE4 },
    a: [['wings', { at: 'neck', big: 1, x0: 3 }], ['flameE', { at: 'chest' }], ['flames', { p: .25 }]], cyc: [FIRE4, ['#a8201a', '#ff6a2a', '#ffd24a', '#ffffff'], ['#c8401e', '#ffb03a', '#fff0a0', '#ffffff']], acc: '#ff8a3a'
  },
  'm:dornen': {
    p: { c: ['#3a5a24', '#1e2e14'], m: ['#14200e', '#2a3a1a', '#4a6a2a', '#8ab04a'], tr: '#6a4a24', gm: '#e8402a', a: ['#2a1a0e', '#5a3a1e', '#e8402a', '#ffb0a0'] },
    a: [['thorns', { p: .55 }], ['rune', { at: 'chest' }]], cyc: [['#2a1a0e', '#5a3a1e', '#e8402a', '#ffb0a0'], ['#2a1a0e', '#5a3a1e', '#ff6a4a', '#ffffff'], ['#2a1a0e', '#4a2e14', '#a8202a', '#ff8a6a']], acc: '#e8402a'
  },
  'm:krone': {
    p: { g: ['#c8a04a', '#ffe08a', '#fffbe0'], gm: '#57c7e6', a: ['#c8a04a', '#ffe08a', '#fffbe0', '#ffffff'] },
    h: ['.............', '.............', '.............', '.............', '..i...i...i..', '..hi.hih.ih..', '..hhhhehhhh..', '.hhwhhhhhwhh.', '.ggggggggggg.'], h2: ['...3333333...', '.32.......23.', '...3333333...'],
    hd: ['.........', '.........', '.........', '..w.w.w..', '..hhehh..'], hd2: ['..33333..', '.3.....3.', '..33333..'], cyc: [GOLD4, ['#e8c060', '#fff4c0', '#ffffff', '#ffffff'], ['#c8a04a', '#ffd24a', '#fff0a0', '#ffffff']], acc: '#ffe08a'
  },
  'm:eisherz': {
    p: { m: ['#4a5466', '#8a96aa', '#c8d2e0', '#f4f8ff'], gm: '#a8e8ff', a: ICE4 },
    h: ['......3......', '.....323.....', '..3..222..3..', '.323.212.323.', '.222.212.222.', '.212.111.212.', 'ooooooooooooo', 'nnnn.1e1.nnnn', '.....1e1.....', '......1......'],
    hd: ['...3...', '.3.2.3.', '.2.2.2.', 'ooo1ooo', '...e...'], cyc: [ICE4, ['#3a8ad8', '#8ad8ff', '#e8faff', '#ffffff'], ['#5a7aa8', '#c8e8ff', '#ffffff', '#ffffff']], acc: '#a8e8ff'
  },
  'm:midas': {
    p: { g: ['#9c6a24', '#e8b04a', '#ffe08a'], gm: '#e8402a', a: GOLD4 },
    h: ['....iiiii....', '..iihhhhhii..', '.ihhwwhhhhhi.', '.ihwhhhhhhhi.', 'ihhhhhhhhhhhi', 'ihhhhhehhhhhi', 'rrrrrrrrrrrrr', 'i..i..i..i..i'],
    hd: ['...3...', '..iii..', '.ihwhi.', 'ihheehh', 'ggggggg'], cyc: [GOLD4, ['#c8902a', '#ffd24a', '#fff8c0', '#ffffff'], ['#e8b04a', '#fff0a0', '#ffffff', '#ffffff']], acc: '#ffd24a'
  }
};
for (const k in ITEMLOOK) {
  const L = ITEMLOOK[k], p = L.p, r = {};
  for (const n of ['m', 'g', 'l', 'w', 'b', 'c', 'a']) if (p[n]) p[n].forEach((c, i) => { r[n + i] = c; });
  for (const n of ['gm', 'gd', 'ob', 'tr', 'st']) if (p[n]) r[n] = p[n];
  if (p.gm && !p.gd) r.gd = mixC(p.gm, '#000000', .45);
  L.pal = r;
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
    // 6.2: Sattlerei (Tasche), Vogelhaus (Vogel)
    case 'sattel': b.rect(3, 5, 10, 9, '#8a4a24'); b.rect(4, 6, 8, 7, '#a8643a'); b.rect(5, 2, 6, 2, '#6a3a1e'); b.rect(5, 3, 1, 3, '#6a3a1e'); b.rect(10, 3, 1, 3, '#6a3a1e'); b.rect(3, 8, 10, 1, '#6a3a1e'); b.rect(7, 8, 2, 2, '#e8b04a'); b.set(5, 11, '#c8844a'); break;
    case 'voliere': b.disc(7, 9, 4, '#8a90a0'); b.disc(6, 8, 3, '#c8c8d0'); b.disc(10, 6, 2.2, '#c8c8d0'); b.set(11, 5, '#1a1420'); b.rect(12, 6, 2, 1, '#e8b04a'); b.rect(2, 9, 3, 2, '#8a90a0'); b.rect(6, 13, 1, 2, '#e8b04a'); b.rect(8, 13, 1, 2, '#e8b04a'); b.rect(5, 8, 3, 1, '#ffffff'); break;
    default: hook('artIcon', name, b);
  }
  return PACACHE[name] = pbCanvas(pbOutline(b));
}

/* ---------- Held: Umhang, Flügel, Kopfschmuck ----------
   g = Zeichenfläche, (ox, oy) = linke obere Ecke des Einzelbilds, m = Ankerpunkte */
function headgearOf(helm) {
  if (!helm) return null;
  const L = itemLook(helm); if (L && L.hd) return 'h:' + (helm.rar === 6 ? 'm:' + helm.myth : helm.rar === 5 ? 's:' + helm.set : helm.name);
  if (helm.rar === 6) return 'halo';
  if (helm.rar === 4 || helm.tier >= 7) return 'crown';
  if (helm.tier === 4 || helm.tier === 5) return 'horns';
  return null;
}
// Kopfschmuck, der den Helmbusch ersetzt
function hgNoPlume(hg) { return hg === 'crown' || (hg && hg.startsWith('h:')) ? 1 : 0; }
/* Kopfschmuck benannter Helme am Helden (ITEMLOOK hd): Zeile hdo sitzt auf dem Scheitel, sonst die unterste */
const HGCACHE = {};
function headgearSpr(key) {
  if (HGCACHE[key]) return HGCACHE[key];
  const L = ITEMLOOK[key], rows = L.hd, w = Math.max(...rows.map(s => s.length)), b = PB(w + 2, rows.length + 2), M = MAT[1].m;
  const pal = Object.assign({ g0: GOLDC[0], g1: GOLDC[1], g2: GOLDC[2], m0: M[0], m1: M[1], m2: M[2], m3: M[3], a0: '#7a3a10', a1: '#d8802a', a2: '#ffb03a', a3: '#ffe27a', gm: '#e8402a', gd: '#7a1e18' }, L.pal);
  pxStamp(b, rows, 1, 1); pbOutline(b, OUT); if (L.hd2) pxStamp(b, L.hd2, 1, 1);
  const res = { c: pbCanvas(b, pal), w, y0: L.hdo != null ? L.hdo : rows.length - 1 };
  if (L.cyc) res.fr = cycFrames(b, pal, L.cyc, res.c);
  return HGCACHE[key] = res;
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
  if (kind.startsWith('h:')) { const H = headgearSpr(kind.slice(2)); g.drawImage(H.fr ? H.fr[Math.floor(T * 8) % H.fr.length] : H.c, x - (H.w >> 1) - 1, y - H.y0 - 1); return; }
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
    if (buildOf(o.id)) { buildMark(o, x, y, true); return; }   // erste Stufe im Bau: Fortschritt statt Schild
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
      if (minePending('garden') > 0 || farmReady() > 0) { r(-1, -24, 3, 5, '#ffd24a'); r(-1, -18, 3, 2, '#ffd24a'); }
      break;
    case 'sattler': {
      // Werkbank mit Sattel auf dem Bock, Taschen am Gestell (mehr mit der Stufe)
      r(-14, -10, 20, 3, WOOD[2]); r(-13, -7, 2, 7, WOOD[0]); r(3, -7, 2, 7, WOOD[0]); r(-12, -12, 6, 2, '#c8b890'); r(-4, -12, 1, 2, '#9aa2ae'); r(-2, -13, 5, 1, '#a8743e');
      r(-10, -20, 12, 5, '#8a4a24'); r(-11, -18, 14, 3, '#a8643a'); r(-9, -21, 4, 2, '#c8844a'); r(-3, -15, 2, 5, '#6a3a1e'); r(-12, -16, 2, 3, '#e8b04a');
      r(8, -26, 2, 26, WOOD[1]); r(15, -26, 2, 26, WOOD[1]); r(7, -27, 11, 2, WOOD[2]);
      const nb = Math.min(4, 1 + Math.floor(lv / 3)), bc = ['#a8743e', '#6a8a3a', '#8a4a6a', '#3a6a9a'];
      for (let i = 0; i < nb; i++) { const bx = 9 + (i % 2) * 4, by = -24 + Math.floor(i / 2) * 9; r(bx, by, 4, 6, bc[i]); r(bx, by, 4, 1, '#2a1e18'); r(bx + 1, by + 2, 2, 1, '#e8b04a'); }
      if (lv >= 10) { r(-8, -22, 1, 1, '#fff'); addLight(x - 4, y - 18, 16, .3); }
      break;
    }
    case 'voliere': {
      // Vogelhaus auf dem Pfahl, Käfig daneben, Vögel je Stufe (Spatz, Taube, Rabe, Eule, Phönix)
      r(-1, -22, 3, 23, WOOD[0]); r(-7, -32, 15, 10, '#8a5a32'); r(-6, -31, 13, 8, '#a8743e'); r(-1, -29, 3, 3, '#1a1420'); r(-2, -25, 5, 1, WOOD[2]);
      r(-9, -34, 19, 2, '#6a2a2a'); r(-7, -36, 15, 2, '#7a3434'); r(-4, -38, 9, 2, '#8a3e3e');
      r(5, -17, 15, 17, 'rgba(60,46,30,.45)'); for (let i = 0; i < 5; i++) r(5 + i * 3 + (i === 4 ? 2 : 0), -17, 1, 17, '#9aa2ae'); r(4, -19, 17, 2, '#6a707c'); r(4, -1, 17, 2, '#5a606c'); r(7, -9, 12, 1, WOOD[1]);
      // Vögel: [x, y, Körper, Flügel, Schnabel] – Spatz auf der Stange, Taube auf dem Dach, Rabe, Eule, Phönix im Käfig
      r(-11, -14, 10, 1, WOOD[1]);
      const BD_ = [[-10, -17, '#c8945a', '#6a4424', '#e8b04a'], [-2, -41, '#d8d8e0', '#8a90a0', '#e8a0a0'], [7, -4, '#2a2430', '#4a3a5a', '#5a5a6a'], [13, -13, '#a8865a', '#efe2bf', '#e8b04a'], [7, -14, '#ff6a2a', '#ffd24a', '#fff0a0']];
      for (let i = 0; i < Math.min(5, lv); i++) {
        const [bx, b0, c1, c2, bk] = BD_[i], by = b0 - ((Math.floor(T * 3 + i * 1.7) % 5 === 0) ? 1 : 0);
        r(bx, by, 5, 3, c1); r(bx + 3, by - 2, 3, 3, c1); r(bx + 6, by - 1, 1, 1, bk); r(bx + 4, by - 1, 1, 1, i === 3 ? '#ffd24a' : '#000'); r(bx, by + 1, 3, 1, c2); r(bx - 1, by, 1, 1, c2); r(bx + 2, by + 3, 1, 1, '#5a4a3a');
        if (i === 3) { r(bx + 3, by - 3, 1, 1, c1); r(bx + 5, by - 3, 1, 1, c1); }
        if (i === 4) { r(bx - 2, by - 1, 2, 1, '#ffd24a'); addLight(x + bx, y + by, 16, .55); if (Math.random() < .1) part(o.x + bx + 2, o.y, -by, rnd(-6, 6), 0, 10, '#ffb03a', .5, 1, -10, 1); }
      }
      break;
    }
    default: hook('drawStation', o, x, y, r, lv);
  }
  // Stufen-Marken: bis 5 in einer Reihe, darüber Reihen zu je 5 (bis 15)
  if (!B.fixed) { if (lv <= 5) for (let i = 0; i < lv; i++) r(-lv * 2 + i * 4, 4, 3, 2, '#e8b04a'); else for (let i = 0; i < lv; i++) r(-10 + (i % 5) * 4, 4 + Math.floor(i / 5) * 3, 3, 2, i >= 10 ? '#ffe08a' : '#e8b04a'); }
  if (!B.fixed && buildOf(o.id)) buildMark(o, x, y, false);   // Baustelle: Gerüst, Fortschritt, Restzeit (js/bauen.js)
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
  if (e.dps > 0) ptext(_t('{n} SCH/s', { n: Math.round(e.dps) }), x, y - 36, '#ffd24a', 6);
  void w;
}
