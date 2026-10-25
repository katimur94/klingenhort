'use strict';
/* =========================================================
   KLINGENHORT – Begleiter – Maskottchen, die mitleveln, sich weiterentwickeln und kämpfen
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein.
   Konto: SAVE.meta.pets = { list: [{ id, sp, nm, lv, xp, col, c0, shiny, k, born, nw }], act: id, eggs: [{ sp, need, got }], starter }
   Für den Tausch: petGive(sp, o) · eggGive(sp) · petExport(i, keep) · eggExport(i, keep) · petImport(data)
   ========================================================= */

/* ---------- Daten ---------- */
const PET_MAX = 12, EGG_MAX = 6, EGG_NEED = 150;
const PET_STAGE = [1, 10, 25, 50, 75, 100];
const PET_STN = [_t('Baby'), _t('Jung'), _t('Stark'), _t('Erwachsen'), _t('Uralt'), _t('Mythisch')];
const PET_EL = {
  feuer: { n: _t('Feuer'), c: '#ff8a3a', c2: '#ffd24a', rgb: '255,140,60' }, frost: { n: _t('Frost'), c: '#8ee6ff', c2: '#e8f8ff', rgb: '150,220,255' },
  blitz: { n: _t('Blitz'), c: '#9ad0ff', c2: '#fffbe0', rgb: '170,210,255' }, gift: { n: _t('Gift'), c: '#79c24e', c2: '#c8f06a', rgb: '140,220,90' },
  licht: { n: _t('Licht'), c: '#ffe08a', c2: '#fffbe0', rgb: '255,230,150' }, schatten: { n: _t('Schatten'), c: '#b892f4', c2: '#e0c8ff', rgb: '190,150,250' }
};
// Arten: Element, fliegt?, Lieblingsfutter, Passiv ab LV 25 (Wert bei 25 → bei 100), Texte, Grundfarben
const PET_SP = {
  drache: {
    n: _t('Glutdrache'), el: 'feuer', fly: 1, fav: 'glut', pas: { dmg: [.03, .15] }, st: _t('Fliegt und spuckt Feuer.'),
    an: _t('Glutspucke'), ad: _t('Spuckt Feuerkugeln, die Gegner in Brand setzen.'), pn: _t('Glutherz'), sn: _t('Feueratem'), sd: _t('Speit einen Flammenkegel, der alles in Brand setzt.'),
    pal: { m: ['#6a1a14', '#b8302a', '#e8602a', '#ffa060'], a: ['#c8802a', '#ffc040', '#fff0a0'], b: ['#8a8070', '#d8d0b8', '#fffaf0'], w: ['#8a2a1e', '#e8783a', '#ffb878'], e: '#ffe04a', g: '#ffd24a' }
  },
  katze: {
    n: _t('Geisterkatze'), el: 'schatten', fly: 0, fav: 'kristall', pas: { critdmg: [.1, .5] }, st: _t('Schleicht und springt aus dem Schatten.'),
    an: _t('Schattensatz'), ad: _t('Springt Gegner an und zerkratzt sie – oft kritisch.'), pn: _t('Katzenkrallen'), sn: _t('Schattensprung'), sd: _t('Springt blitzschnell von Gegner zu Gegner – jeder Treffer kritisch.'),
    pal: { m: ['#4e4282', '#8072b8', '#b4a8e4', '#ebe6ff'], a: ['#5a3ab0', '#9a6af0', '#e0c8ff'], b: ['#2a2040', '#4a3e6a', '#7a6e9a'], w: ['#5a3ab0', '#9a6af0', '#e0c8ff'], e: '#5ae8ff', g: '#c8a0ff' }
  },
  kaefer: {
    n: _t('Goldkäfer'), el: 'licht', fly: 1, fav: 'schuppe', pas: { gold: [.1, .5], loot: [.03, .15] }, st: _t('Sammelt Gold und blendet mit Licht.'),
    an: _t('Lichtstrahl'), ad: _t('Blendet Gegner mit gleißenden Lichtstrahlen.'), pn: _t('Goldrausch'), sn: _t('Sonnenglanz'), sd: _t('Heilt dich und versengt alle Gegner um dich herum.'),
    pal: { m: ['#7a4a14', '#c08a24', '#f0c040', '#fff4b0'], a: ['#8a2a1e', '#d8502a', '#ff9a5a'], b: ['#3e2a1a', '#6a4a2e', '#946a44'], w: ['#6a98b8', '#b4daf0', '#f0fbff'], e: '#1a1420', g: '#fff6c0' }
  },
  eule: {
    n: _t('Frosteule'), el: 'frost', fly: 1, fav: 'mithril', pas: { xp: [.04, .2] }, st: _t('Weise, flauschig und eiskalt.'),
    an: _t('Eissplitter'), ad: _t('Schießt Eissplitter, die Gegner verlangsamen.'), pn: _t('Eulenweisheit'), sn: _t('Schneesturm'), sd: _t('Friert alle Gegner um die Eule kurz ein.'),
    pal: { m: ['#2a4468', '#4a7eb0', '#8ac0e6', '#dcf2ff'], a: ['#a8c4dc', '#d8ecf8', '#ffffff'], b: ['#a8641c', '#e8a030', '#ffd870'], w: ['#203858', '#386898', '#68a4d4'], e: '#ffd24a', g: '#bfefff' }
  },
  natter: {
    n: _t('Giftnatter'), el: 'gift', fly: 0, fav: 'schleim', pas: { pgift: [.05, .25] }, st: _t('Flink, giftig und anhänglich.'),
    an: _t('Giftbiss'), ad: _t('Schlängelt sich heran und vergiftet mit jedem Biss.'), pn: _t('Giftzahn'), sn: _t('Giftwolke'), sd: _t('Spuckt eine Giftwolke, die alle Gegner darin vergiftet.'),
    pal: { m: ['#163412', '#2a6420', '#4e9c32', '#9ad858'], a: ['#a08a28', '#dcc040', '#fff0a0'], b: ['#4a2460', '#7e44a0', '#c088e0'], w: ['#2e5a24', '#5aa83a', '#b8e870'], e: '#ffd24a', g: '#c8f06a' }
  },
  funke: {
    n: _t('Sturmfunke'), el: 'blitz', fly: 1, fav: 'erz', pas: { aspd: [.03, .12] }, st: _t('Knistert vor Energie.'),
    an: _t('Kettenblitz'), ad: _t('Ein Blitz springt von Gegner zu Gegner.'), pn: _t('Funkenflug'), sn: _t('Gewitter'), sd: _t('Lässt Blitze auf mehrere Gegner niederfahren.'),
    pal: { m: ['#24307a', '#3e6ad0', '#86c0ff', '#e8f6ff'], a: ['#b8881a', '#ffd84a', '#fffbe0'], b: ['#3e4460', '#6a7090', '#a4acc4'], w: ['#b8881a', '#ffd84a', '#fffbe0'], e: '#1a1420', g: '#fffbe0' }
  }
};
const PET_ORDER = ['drache', 'katze', 'kaefer', 'eule', 'natter', 'funke'], PET_STARTERS = ['drache', 'katze', 'kaefer'];
// Futter: EP je Stück (seltenes Material = viel), Lieblingsfutter zählt doppelt
const PET_FEED = {}; MATORDER.forEach((k, i) => { PET_FEED[k] = Math.round(15 * Math.pow(1.75, i)); });

/* ---------- Werte ---------- */
// EP bis zum nächsten Level ≈ 100·LV^2,6 (die ersten Level billiger): LV 10 nach etwa einer Stunde, LV 25 nach einem Spieltag, LV 100 nach Hunderten Stunden
function petNeed(lv) { return Math.round(100 * Math.pow(lv, 2.6) * Math.min(1, Math.max(.05, Math.pow(lv / 11, 1.5)))); }
function petStage(lv) { let s = 0; for (let i = 1; i < 6; i++) if (lv >= PET_STAGE[i]) s = i; return s; }
function petPasK(lv) { return clamp((lv - 25) / 75, 0, 1); }
function petPas(p) { const S = PET_SP[p.sp], r = {}; if (p.lv < 25) return r; const k = petPasK(p.lv); for (const s in S.pas) r[s] = S.pas[s][0] + (S.pas[s][1] - S.pas[s][0]) * k; return r; }
function petPow(lv) { return lv >= 100 ? 2 : lv >= 75 ? 1.5 : 1; }
function petSpecCd(lv) { return lv >= 100 ? 12 : lv >= 75 ? 16 : 20; }
function petAtkCd(p) { return 1.2 - petStage(p.lv) * .05; }
function petDmgK(lv) { return .15 + lv * .006; }
function petMagR(lv) { return lv < 10 ? 0 : 70 + (lv - 10) * 1.4; }
function petM() { return SAVE && SAVE.meta && SAVE.meta.pets; }
function petActive() { const M = petM(); if (!M || !M.act) return null; for (const p of M.list) if (p.id === M.act) return p; return null; }
function petName(p) { return p.nm ? p.nm : PET_SP[p.sp].n; }

/* ---------- Farben: Varianten je Art ---------- */
function petRgbHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function petHslRgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }, q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return s ? [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255)) : [l * 255, l * 255, l * 255].map(Math.round); }
const PET_VAR = [{ n: _t('Rubin'), h: 356 }, { n: _t('Saphir'), h: 218 }, { n: _t('Smaragd'), h: 135 }, { n: _t('Amethyst'), h: 280 }, { n: _t('Mondschein'), pale: 1 }, { n: _t('Bernstein'), h: 34 }, { n: _t('Türkis'), h: 178 }, { n: _t('Obsidian'), dark: 1 }];
const PET_VC = {};
// 6 Farben je Art: Klassisch + 5 Varianten, die sich deutlich von der Grundfarbe unterscheiden; 6 = schillernd
function petVariants(sp) {
  if (PET_VC[sp]) return PET_VC[sp];
  const S = PET_SP[sp], base = petRgbHsl(...hexRgb(S.pal.m[2]))[0], out = [{ n: _t('Klassisch'), v: null }];
  for (const V of PET_VAR) { if (out.length >= 6) break; if (V.h != null && Math.abs(angDiff(V.h / 57.2958, base / 57.2958)) * 57.2958 < 45) continue; out.push({ n: V.n, v: V }); }
  return PET_VC[sp] = out;
}
function petColName(sp, col) { return col === 6 ? _t('Schillernd') : petVariants(sp)[clamp(col | 0, 0, 5)].n; }
// Farbe eines Tons der Variante (nur Körper m und Flügel w werden umgefärbt)
function petVarCol(hex, V, base) {
  const [h, s, l] = petRgbHsl(...hexRgb(hex));
  if (V.pale) return petHslRgb(h, s * .22, .3 + l * .62);
  if (V.dark) return petHslRgb(h, s * .45, l * .55);
  return petHslRgb(h + V.h - base, Math.min(1, s * 1.05), l);
}
const PET_CMN = { k: '#1a1420', h: '#ffffff', o: '#140f1a', y: '#ffd24a', Y: '#fff3a0', p: '#ff8aa8', r: '#e8402a' };
function petPal(sp, col) {
  const S = PET_SP[sp], P0 = S.pal, V = col > 0 && col < 6 ? petVariants(sp)[col].v : null, base = petRgbHsl(...hexRgb(P0.m[2]))[0], pal = {};
  for (const k in PET_CMN) pal[k] = hexRgb(PET_CMN[k]);
  for (const g of ['m', 'a', 'b', 'w']) P0[g].forEach((c, i) => { pal[g + i] = V && (g === 'm' || g === 'w') ? petVarCol(c, V, base) : hexRgb(c); });
  pal.e = hexRgb(P0.e); pal.g = hexRgb(P0.g);
  if (col === 6) { pal.a0 = hexRgb('#b898d0'); pal.a1 = hexRgb('#f0d8f8'); pal.a2 = hexRgb('#ffffff'); pal.o = hexRgb('#2a1438'); }
  return pal;
}

/* ---------- Pixel-Werkzeug (Schlüssel statt Farben: m0..m3 Körper, a Akzent, b Horn/Bauch, w Flügel) ---------- */
function ppE(b, cx, cy, rx, ry, k, n) {
  n = n || 3;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, d = nx * nx + ny * ny; if (d > 1) continue;
    const l = (-nx * .5 - ny * .85) * .6 + (1 - d) * .35; let i = l > .55 ? 3 : l > .16 ? 2 : l > -.3 ? 1 : 0; if (i >= n) i = n - 1;
    b.set(x, y, k + i);
  }
}
function ppF(b, cx, cy, rx, ry, k) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry; if (nx * nx + ny * ny <= 1) b.set(x, y, k); }
  if (rx < 1.1 || ry < 1.1) b.set(Math.floor(cx), Math.floor(cy), k);
}
function ppInPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function ppPoly(b, pts, k) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (ppInPoly(x + .5, y + .5, pts)) b.set(x, y, k);
}
function ppQB(p0, p1, p2, n) { const r = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; r.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return r; }
// Schlauch (Schwanz, Hals, Schlangenleib): dunkle Unterseite (oder Bauch bk), Mitte, heller Rücken
function ppTube(b, pts, r0, r1, k, bk) {
  const n = pts.length, R = i => lerp(r0, r1, i / Math.max(1, n - 1));
  for (let i = 0; i < n; i++) { const [x, y] = pts[i], r = R(i); if (r >= 1.6) ppF(b, x, y + r * .3, r, r, bk || k + '0'); }
  for (let i = 0; i < n; i++) { const [x, y] = pts[i], r = R(i); if (r >= 1.6) ppF(b, x, y - r * .12, r * .8, r * .8, k + '1'); else ppF(b, x, y, r, r, k + '1'); }
  for (let i = 0; i < n; i++) { const [x, y] = pts[i], r = R(i); if (r >= 1.6) ppF(b, x - r * .1, y - r * .48, r * .4, r * .36, k + '2'); else if (r >= .9) b.set(x, y - r * .7, k + '2'); }
}
function ppEye(b, x, y, w, h, bl, k) {
  x = Math.round(x); y = Math.round(y);
  if (bl) { for (let i = 0; i < w; i++) b.set(x + i, y + h - 1, 'k'); return; }
  b.rect(x, y, w, h, k || 'k'); b.set(x, y, 'h'); if (k && w > 1 && h > 1) b.set(x + w - 1, y + h - 1, 'k');
}
function ppRing(b, cx, cy, rx, ry, k) { for (let a = 0; a < 6.283; a += .12) b.set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, k); }
function ppClear(b, x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.a[y * b.w + x] = null; }
function ppCrown(b, x, y, w) { x = Math.round(x - w / 2); y = Math.round(y); b.rect(x, y, w, 2, 'y'); for (let i = 0; i < w; i += 2) b.set(x + i, y - 1, 'y'); b.set(x + Math.floor(w / 2), y - 2, 'Y'); b.set(x + Math.floor(w / 2), y, 'r'); }

/* ---------- Die sechs Arten (Seitenansicht nach rechts; Boden bei gy, Mitte cx) ---------- */
const PET_CX = 32, PET_GY = 56;
// Flügel: Wurzel, Spannweite, Schlag (0 oben, 1 Mitte, 2 unten), Schlüssel, Knochen?
function ppWing(b, wx, wy, span, fl, k, bone, far) {
  if (span < 4) { ppE(b, wx - 1, wy - [2, 1, 0][fl], 2, 1.5, k); return; }
  const ang = [-2.05, -2.6, -3.15][fl] + (far ? .25 : 0), tip = [wx + Math.cos(ang) * span, wy + Math.sin(ang) * span];
  const elb = [wx + Math.cos(ang + .5) * span * .5, wy + Math.sin(ang + .5) * span * .5 - 1];
  const t1 = [lerp(tip[0], wx - span * .15, .45), lerp(tip[1], wy + span * .2, .45) + 1], t2 = [wx - span * .22, wy + span * .18];
  ppPoly(b, [[wx, wy], elb, tip, t1, t2, [wx + 1, wy + 2]], far ? k + '0' : k + '1');
  if (!far) { ppPoly(b, [[wx, wy], elb, [lerp(elb[0], t2[0], .5), lerp(elb[1], t2[1], .5)]], k + '0'); b.line(t1[0], t1[1], tip[0], tip[1], k + '2'); }
  if (bone) { b.line(wx, wy, elb[0], elb[1], bone); b.line(elb[0], elb[1], tip[0], tip[1], bone); b.line(elb[0], elb[1], t1[0], t1[1], bone); b.set(tip[0], tip[1] - 1, bone); }
}
const PET_ART = {
  drache(b, s, f, mv, bl) {
    const bz = 1 + s * .2, hz = 1 + s * .11, fl = [0, 1, 2, 1][f], lift = fl === 2 ? -1 : 0, cx = PET_CX, gy = PET_GY;
    const rx = 4.2 * bz, ry = 3.3 * bz, bx = cx - 1.2 * bz, by = gy - 2.2 * bz - ry + lift, hr = 4.2 * hz, hx = bx + rx * .95, hy = by - ry * .55 - hr * .5;
    const sw = [0, 1, 0, -1][f] * (mv ? 1.6 : 1), span = [3, 5.5, 7.5, 9.5, 11.5, 13.5][s];
    ppWing(b, bx - rx * .05, by - ry * .75, span * .85, fl, 'w', null, true);
    const tail = ppQB([bx - rx * .6, by + ry * .2], [bx - rx * 1.5, by + ry * .9 + 1], [bx - rx * 1.9 - s * .8, by - ry * .3 + sw], 10 + s * 2);
    ppTube(b, tail, ry * .5, .8, 'm');
    const tt = tail[tail.length - 1];
    if (s >= 3) ppPoly(b, [[tt[0] + 1, tt[1]], [tt[0] - 2 - s * .3, tt[1] - 2 - s * .3], [tt[0] - 3 - s * .4, tt[1] + 1], [tt[0] - 1, tt[1] + 2]], 'a1');
    if (s >= 4 && f % 2 === 0) { b.set(tt[0] - 3, tt[1] - 3, 'g'); b.set(tt[0] - 2, tt[1] - 4, 'a2'); }
    // Beine
    const ly = gy + lift, leg = (x, d) => { b.rect(Math.round(x), Math.round(by + ry * .5), Math.max(2, Math.round(1.4 * bz)), Math.max(1, Math.round(ly - (by + ry * .5))) - (mv ? 1 : 0), d ? 'm0' : 'm1'); b.rect(Math.round(x), Math.round(ly) - 1 - (mv ? 1 : 0), Math.max(2, Math.round(1.6 * bz)) + 1, 1, 'm0'); };
    leg(bx - rx * .55, 1); leg(bx + rx * .3, 0);
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .22, by + ry * .32, rx * .6, ry * .55, 'a');
    if (s >= 1) for (let i = 0; i < 2 + s; i++) b.set(bx + rx * (-.15 + i * .18), by + ry * (.12 + (i % 2) * .08) + 2, 'a0');
    if (s >= 2) for (let i = 0; i < 3 + s; i++) { const t = i / (3 + s), x = lerp(bx - rx * .8, hx - hr * .6, t), y = lerp(by - ry * .75, hy - hr * .55, t * t), h = 1.2 + s * .35; ppPoly(b, [[x - 1, y + 1], [x - .3, y - h], [x + 1.4, y + 1]], 'a1'); }
    ppE(b, bx + rx * .72, by - ry * .45, rx * .42, ry * .62, 'm', 4);
    ppE(b, hx, hy, hr, hr * .9, 'm', 4);
    ppE(b, hx + hr * .72, hy + hr * .3, hr * .62, hr * .44, 'm', 4);
    b.set(hx + hr * 1.18, hy + hr * .12, 'm0');
    b.line(hx + hr * .45, hy + hr * .62, hx + hr * 1.15, hy + hr * .5, 'm0');
    if (s <= 1) b.set(hx + hr * .2, hy + hr * .45, 'p');
    const ex = hx + hr * .12, ey = hy - hr * .32;
    ppEye(b, ex, ey, 2, s <= 1 ? 3 : 2, bl, s >= 4 ? 'g' : null);
    if (s >= 2) b.line(ex - 1, ey - 1, ex + 2, ey - 1 - (s >= 4 ? 1 : 0), 'm0');
    const hl = [0, 1.6, 3, 4.2, 5.2, 6.2][s];
    if (s >= 1) { const hb = [hx - hr * .3, hy - hr * .72], tip = [hb[0] - hl * .9, hb[1] - hl]; ppTube(b, ppQB(hb, [hb[0] - hl * .2, hb[1] - hl * .7], tip, 6), 1 + s * .15, .5, 'b'); if (s === 5) b.set(tip[0], tip[1], 'y'); }
    if (s >= 4) { const hb = [hx - hr * .65, hy - hr * .35]; b.line(hb[0], hb[1], hb[0] - hl * .7, hb[1] - hl * .45, 'b1'); }
    if (s >= 4) { b.set(bx + rx * .25, by + ry * .25, f % 2 ? 'g' : 'Y'); b.set(bx + rx * .25 + 1, by + ry * .25, 'g'); }
    if (s === 5) for (let i = 0; i < 4; i++) b.set(hx - hr * (.75 + i * .12), hy - hr * (.1 - i * .25) + (f + i) % 2, i % 2 ? 'g' : 'a2');
    ppWing(b, bx - rx * .25, by - ry * .62, span, fl, 'w', s >= 1 ? 'm0' : null, false);
  },
  katze(b, s, f, mv, bl) {
    const bz = 1 + s * .17, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, legH = 2.6 * bz, rx = 4.6 * bz, ry = 2.9 * bz, bx = cx - 1.4 * bz, by = gy - legH - ry * .75;
    const hr = (s ? 3.9 : 4.3) * hz, hx = bx + rx * .95, hy = by - ry * .8 - hr * .3, sw = [0, 1, 0, -1][f], lg = mv ? [1.2, 0, -1.2, 0][f] : 0;
    // Schwänze: ab Stark zwei, dann drei, fünf, sieben – wie eine Nekomata
    const nt = [1, 1, 2, 3, 4, 5][s], L = 6 + s * 1.3;
    for (let t = nt - 1; t >= 0; t--) {
      const q = nt === 1 ? .5 : t / (nt - 1), r0 = [bx - rx * .85, by - ry * .2], sx = (t % 2 ? 1 : -1) * sw * .8, Lt = L * (1 - Math.abs(q - .5) * .35);
      const p1 = [r0[0] - Lt * (.5 + q * .35) + sx, r0[1] + 1.5 - q * Lt * .25], p2 = [r0[0] - Lt * (.15 + q * .55) + sx * 1.6, r0[1] - Lt * (.95 - q * .35)];
      const pts = ppQB(r0, p1, p2, 8 + s); ppTube(b, pts, 1.35 * (1 + s * .08), .7, 'm');
      for (let i = Math.floor(pts.length * .7); i < pts.length; i++) b.set(pts[i][0], pts[i][1], i === pts.length - 1 ? 'a2' : 'a1');
      if (s >= 1 && (f + t) % 2 === 0) b.set(p2[0] + 1, p2[1] - 1, s === 5 ? 'y' : 'g');
    }
    const leg = (x, o, k) => { const lx = Math.round(x + o), w = Math.max(2, Math.round(1.5 * bz)); b.rect(lx, Math.round(by), w, Math.round(gy - by), k); b.rect(lx, gy - 1, w + 1, 1, k === 'm0' ? 'm0' : 'm2'); if (s >= 4 && (f + Math.round(x)) % 2) b.set(lx + 1, gy - 2, 'g'); };
    leg(bx - rx * .45, -lg, 'm0'); leg(bx + rx * .55, lg, 'm0');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .62, by + ry * .15, rx * .3, ry * .55, 'm', 4);
    if (s >= 4) for (let i = 0; i < 3; i++) b.line(bx - rx * .3 + i * 2.5, by - ry * .85, bx - rx * .4 + i * 2.5, by - ry * .3, 'a1');
    leg(bx - rx * .65, lg, 'm1'); leg(bx + rx * .35, -lg, 'm1');
    ppE(b, hx, hy, hr, hr * .88, 'm', 4);
    const ear = (x0, x1, tx) => { ppPoly(b, [[x0, hy - hr * .35], [x1, hy - hr * .8], [tx, hy - hr * 1.55 - s * .15]], 'm1'); b.set(lerp(x0, tx, .55) + .5, hy - hr * .95, 'a1'); };
    ear(hx - hr * .8, hx - hr * .05, hx - hr * .55); ear(hx + hr * .02, hx + hr * .78, hx + hr * .52);
    const ew = 2, eh = s <= 1 ? 3 : 2, ey = hy - hr * .2;
    ppEye(b, hx - hr * .12, ey, ew, eh, bl, 'e'); ppEye(b, hx + hr * .5, ey, ew, eh, bl, 'e');
    if (!bl && s >= 2) { b.set(hx - hr * .12 + 1, ey + 1, 'k'); b.set(hx + hr * .5 + 1, ey + 1, 'k'); }
    b.set(hx + hr * .32, hy + hr * .32, 'p'); b.set(hx + hr * .25, hy + hr * .5, 'k'); b.set(hx + hr * .42, hy + hr * .5, 'k');
    if (s <= 1) { b.set(hx - hr * .35, hy + hr * .35, 'p'); b.set(hx + hr * .85, hy + hr * .35, 'p'); }
    if (s >= 2) { b.line(hx + hr * .62, hy + hr * .38, hx + hr * .95, hy + hr * .3, 'm3'); b.line(hx - hr * .55, hy + hr * .42, hx - hr * .85, hy + hr * .32, 'm3'); }
    if (s >= 3) { const mx = hx + hr * .2, my = hy - hr * .62; b.set(mx, my, 'a2'); b.set(mx - 1, my + 1, 'a1'); b.set(mx + 1, my + 1, 'a1'); b.set(mx, my + 2, 'a1'); }
    if (s === 5) { b.set(hx - hr * .55, hy - hr * 1.6, 'y'); b.set(hx + hr * .52, hy - hr * 1.6, 'y'); }
  },
  kaefer(b, s, f, mv, bl) {
    // Nashornkäfer: gewölbter Panzer, Halsschild, kleiner Kopf mit Horn nach oben, ab Stark zweites Horn vom Halsschild
    const bz = 1 + s * .2, hz = 1 + s * .1, fl = [0, 1, 2, 1][f], cx = PET_CX, gy = PET_GY, rx = 4.2 * bz, ry = 3.7 * bz, bx = cx - 1.5 * bz, by = gy - 2.2 * bz - ry + (fl === 2 ? -1 : 0);
    const px_ = bx + rx * .78, py_ = by + ry * .1, prx = rx * .3, pry = ry * .5, hr = 2.7 * hz, hx = px_ + prx * .9 + hr * .45, hy = py_ + pry * .45;
    const wing = far => { const a = [-1.95, -2.45, -2.95][fl] + (far ? .32 : 0), Lw = rx * (1.1 + s * .04), r0 = [bx + rx * .05, by - ry * .65], tip = [r0[0] + Math.cos(a) * Lw, r0[1] + Math.sin(a) * Lw], n = [Math.cos(a + 1.57) * 1.7 * bz, Math.sin(a + 1.57) * 1.7 * bz]; ppPoly(b, [r0, [lerp(r0[0], tip[0], .5) + n[0], lerp(r0[1], tip[1], .5) + n[1]], tip, [lerp(r0[0], tip[0], .55) - n[0] * .45, lerp(r0[1], tip[1], .55) - n[1] * .45]], far ? 'w0' : 'w1'); if (!far) b.line(r0[0], r0[1], lerp(r0[0], tip[0], .9), lerp(r0[1], tip[1], .9), 'w2'); };
    wing(true);
    for (let i = 0; i < 3; i++) { const x = bx - rx * .35 + i * rx * .48, y = by + ry * .62, k = (f + i) % 2; b.line(x, y, x - 1 + k, y + 1.6 * bz, 'b0'); b.line(x - 1 + k, y + 1.6 * bz, x + k, y + 2.4 * bz, 'b0'); }
    ppE(b, bx, by + ry * .28, rx * .96, ry * .68, 'b');
    ppE(b, bx, by - ry * .1, rx, ry * .86, 'm', 4);
    b.line(bx - rx * .9, by + ry * .32, bx + rx * .55, by + ry * .4, 'm0');
    for (let i = 0; i < 2 + s; i++) b.set(bx - rx * .45 + i * .9, by - ry * .72 + Math.abs(i - (2 + s) / 2) * .4, 'm3');
    if (s >= 3) for (const [dx, dy] of [[-.4, -.05], [.12, -.42], [-.75, -.35], [.2, .05]].slice(0, s - 1)) ppF(b, bx + rx * dx, by + ry * dy, .8 + s * .12, .7 + s * .1, 'a1');
    if (s >= 4) for (const [dx, dy, o] of [[-.15, -.3, 0], [.4, -.1, 1], [-.55, .05, 0]]) b.set(bx + rx * dx, by + ry * dy, (f + o) % 2 ? 'g' : 'h');
    ppE(b, px_, py_, prx, pry, 'm', 4);
    b.line(px_ - prx * .9, py_ - pry * .55, px_ - prx * .7, py_ + pry * .7, 'm0');
    if (s >= 3) { const hb = [px_ + prx * .2, py_ - pry * .8], hl = 1.5 + s * .5; ppTube(b, ppQB(hb, [hb[0] + hl * .6, hb[1] - hl * .5], [hb[0] + hl, hb[1] - hl * .2], 5), .8 + s * .1, .5, 'm'); }
    wing(false);
    ppE(b, hx, hy, hr * 1.05, hr, 'b');
    if (s >= 1) { const hl = [0, 2.6, 3.8, 4.8, 5.8, 6.8][s], hb = [hx + hr * .55, hy - hr * .45]; ppTube(b, ppQB(hb, [hb[0] + hl * .55, hb[1] - hl * .25], [hb[0] + hl * .6, hb[1] - hl], 7), 1 + s * .15, .6, 'm'); }
    const at = [0, 1, 0, -1][f], ar = [hx - hr * .2, hy - hr * .85], al = 2.5 + s * .5, atip = [ar[0] + al * .35, ar[1] - al + at * .5];
    b.line(ar[0], ar[1], atip[0], atip[1], 'b1'); b.rect(atip[0], atip[1] - 1, 2, 2, 'm2'); b.set(atip[0], atip[1] - 1, 'm3');
    const ex = hx - hr * .05, ey = hy - hr * .2, er = 1.5 + s * .12;
    if (bl) b.line(ex - er, ey, ex + er, ey, 'k'); else { ppF(b, ex, ey, er, er, 'h'); b.rect(ex, ey - 1, 2, 2, 'k'); b.set(ex, ey - 1, 'h'); }
    if (s <= 1) b.set(hx + hr * .45, hy + hr * .45, 'p');
    if (s === 5) ppCrown(b, px_ - prx * .2, py_ - pry * 1.35, 5);
  },
  eule(b, s, f, mv, bl) {
    const bz = 1 + s * .19, hz = 1 + s * .11, fl = [0, 1, 2, 1][f], cx = PET_CX, gy = PET_GY, rx = 3.8 * bz, ry = 4.3 * bz, bx = cx - .5, by = gy - 1.4 * bz - ry + (fl === 2 ? -1 : 0);
    const hr = 3.9 * hz, hx = bx + rx * .25, hy = by - ry * .82;
    if (s === 5) { const tp = ppQB([bx - rx * .6, by + ry * .6], [bx - rx * 1.5, by + ry * .9], [bx - rx * 2.2, by + ry * .4 + [0, 1, 0, -1][f]], 10); ppTube(b, tp, 1.4, .6, 'w'); b.set(tp[10][0], tp[10][1], 'y'); }
    ppPoly(b, [[bx - rx * .5, by + ry * .5], [bx - rx * 1.25 - s * .3, by + ry * .95], [bx - rx * .2, by + ry * .9]], 'm1');
    const wing = far => { const a = [-1.9, -2.6, -3.5][fl] + (far ? .3 : 0), L = rx * (1 + s * .08) + 1.5, r0 = [bx - rx * .1, by - ry * .35], tip = [r0[0] + Math.cos(a) * L, r0[1] + Math.sin(a) * L], m = [lerp(r0[0], tip[0], .5) + Math.cos(a + 1.6) * 2.2 * bz, lerp(r0[1], tip[1], .5) + Math.sin(a + 1.6) * 2.2 * bz]; ppPoly(b, [r0, m, tip, [lerp(r0[0], tip[0], .55) + Math.cos(a - 1.6) * 1.2, lerp(r0[1], tip[1], .55) + Math.sin(a - 1.6) * 1.2]], far ? 'w0' : 'w1'); if (!far) for (let i = 1; i <= 2 + (s >> 1); i++) { const t = .35 + i * .14; b.set(lerp(r0[0], tip[0], t) + Math.cos(a + 1.6), lerp(r0[1], tip[1], t) + Math.sin(a + 1.6), 'w2'); } };
    if (mv || f !== 0 || s >= 0) wing(true);
    for (const o of [-1, 1]) { b.set(bx + o * 1.5, gy - 1 + (fl === 2 ? -1 : 0), 'b1'); b.set(bx + o * 1.5 + 1, gy - 1 + (fl === 2 ? -1 : 0), 'b0'); }
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .3, by + ry * .28, rx * .6, ry * .58, 'a');
    if (s >= 2) for (let i = 0; i < Math.min(3, s - 1); i++) { const x = bx + rx * (i === 1 ? .45 : 0) + .5, y = by + ry * (i === 2 ? .4 : .05); b.set(x, y, 'm1'); b.set(x + 1, y + 1, 'm1'); b.set(x + 2, y, 'm1'); }
    wing(false);
    if (s >= 1) { const tl = [0, 1.6, 2.6, 3.4, 4, 4.6][s]; ppPoly(b, [[hx - hr * .85, hy - hr * .35], [hx - hr * .3, hy - hr * .78], [hx - hr * .9 - tl * .4, hy - hr * .8 - tl]], 'm1'); ppPoly(b, [[hx + hr * .25, hy - hr * .78], [hx + hr * .85, hy - hr * .4], [hx + hr * .75 + tl * .3, hy - hr * .85 - tl]], 'm1'); }
    ppE(b, hx, hy, hr * 1.05, hr * .92, 'm', 4);
    ppE(b, hx + hr * .32, hy + hr * .08, hr * .74, hr * .62, 'a');
    const er = s <= 1 ? 1.6 : 1.4 + s * .1;
    for (const ex of [hx - hr * .05, hx + hr * .68]) { if (bl) { b.line(ex - er, hy, ex + er, hy, 'm1'); continue; } ppF(b, ex, hy - .2, er, er, 'e'); b.set(ex, hy, 'k'); if (s >= 3) b.set(ex - 1, hy, 'k'); b.set(ex - er * .6, hy - er * .7, 'h'); }
    ppPoly(b, [[hx + hr * .22, hy + hr * .3], [hx + hr * .52, hy + hr * .3], [hx + hr * .37, hy + hr * .62]], 'b1');
    if (s <= 1) { b.set(hx - hr * .45, hy + hr * .45, 'p'); b.set(hx + hr * .95, hy + hr * .45, 'p'); }
    if (s >= 3) { const x = hx + hr * .32, y = hy - hr * .62; b.set(x, y, 'g'); b.set(x, y - 1, 'h'); b.set(x - 1, y, 'g'); b.set(x + 1, y, 'g'); b.set(x, y + 1, 'g'); }
    if (s >= 4) for (let i = 0; i < 2 + s - 3; i++) { const x = hx - hr * .55 + i * hr * .45, y = hy - hr * .85; b.line(x, y, x + .5, y - 2 - (i % 2) * 1.5, i % 2 ? 'h' : 'g'); }
    if (s === 5) ppCrown(b, hx + hr * .2, hy - hr * 1.25, 7);
  },
  natter(b, s, f, mv, bl) {
    const bz = 1 + s * .18, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, r = 1.55 * bz, L = 11 + s * 2.4, ph = f * Math.PI / 2, A = (mv ? 1.5 : .9) * bz;
    const hr = 2.7 * hz, hx = cx + L * .38 + 1.5, hy = gy - 5.5 * bz - 2, pts = [];
    for (let i = 0; i <= 22; i++) { const t = i / 22, x = cx - L * .62 + t * L * .95; pts.push([x, gy - r - Math.sin(t * 7.5 + ph) * A * (.4 + t * .6) * (1 - t * .5)]); }
    const nb = pts[pts.length - 1];
    for (const q of ppQB(nb, [nb[0] + 2.5 * bz, nb[1] - .5], [hx - hr * .7, hy + hr * .5], 7).slice(1)) pts.push(q);
    ppTube(b, pts, .7, r * 1.05, 'm', 'a1');
    if (s >= 1) for (let i = 2; i < pts.length - 4; i += 3) b.set(pts[i][0], pts[i][1] - r * .5, s >= 3 ? 'b1' : 'm0');
    if (s === 5) { const wp = pts[Math.floor(pts.length * .55)]; ppWing(b, wp[0], wp[1] - r * .6, 12, [0, 1, 2, 1][f], 'w', 'y', false); }
    if (s >= 2) { const hs = .7 + (s - 2) * .16, hcx = hx - hr * .6, hcy = hy + hr * .45; ppE(b, hcx, hcy, hr * .8 * hs + .5, hr * 1.2 * hs + 1, 'm', 4); ppE(b, hcx + hr * .3, hcy + hr * .1, hr * .45 * hs, hr * .85 * hs, 'a'); if (s >= 3) { b.set(hcx - hr * .35, hcy - hr * .3, 'b2'); b.set(hcx - hr * .35, hcy + hr * .3, 'b1'); } }
    ppE(b, hx, hy, hr * 1.2, hr * .82, 'm', 4);
    ppE(b, hx + hr * .55, hy + hr * .25, hr * .8, hr * .48, 'm', 4);
    if (s <= 1) { ppEye(b, hx + hr * .05, hy - hr * .45, 2, 2, bl, null); b.set(hx - hr * .1, hy + hr * .35, 'p'); }
    else { ppEye(b, hx + hr * .05, hy - hr * .42, 2, 2, bl, 'e'); if (!bl) b.set(hx + hr * .05 + 1, hy - hr * .42, 'k'); }
    if (!bl && (f === 1 || f === 2)) { const tx = hx + hr * 1.3, ty = hy + hr * .45; b.line(tx, ty, tx + 2, ty, 'r'); b.set(tx + 3, ty - 1, 'r'); b.set(tx + 3, ty + 1, 'r'); }
    if (s >= 3) b.set(hx + hr * 1, hy + hr * .75, 'h');
    if (s >= 4) { b.line(hx - hr * .6, hy - hr * .6, hx - hr * 1.2, hy - hr * 1.4, 'b1'); b.line(hx - hr * .2, hy - hr * .75, hx - hr * .5, hy - hr * 1.6, 'b2'); }
    if (s === 5) ppCrown(b, hx, hy - hr * 1.2, 5);
  },
  funke(b, s, f, mv, bl) {
    const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, r = 3.5 * bz, bx = cx, by = gy - 2 - r - 1.2 * bz + (f === 2 ? -1 : 0);
    if (s >= 3) for (const [dx, dy, rr] of [[-.9, 1, .55], [0, 1.15, .65], [.9, 1, .5]]) ppE(b, bx + dx * r, by + dy * r, r * rr, r * rr * .62, 'b');
    const jit = [0, 1, -1, 0][f], tp = [[bx - r * .6, by + r * .2], [bx - r * 1.3, by - r * .25 + jit], [bx - r * 1.75, by + r * .4], [bx - r * 2.4 - s * .4, by - r * .05 - jit]];
    for (let i = 0; i < tp.length - 1; i++) { b.line(tp[i][0], tp[i][1], tp[i + 1][0], tp[i + 1][1], 'a1'); b.line(tp[i][0], tp[i][1] + 1, tp[i + 1][0], tp[i + 1][1] + 1, 'a0'); }
    b.set(tp[3][0], tp[3][1], 'a2');
    const n = 4 + s, sp = 1.4 + s * .5;
    for (let k = 0; k < n; k++) { const a = k / n * 6.283 + f * .26 + .3, ca = Math.cos(a), sa = Math.sin(a), l = r + sp + (k % 2) * (1 + s * .2); ppPoly(b, [[bx + Math.cos(a - .32) * r * .8, by + Math.sin(a - .32) * r * .8], [bx + ca * l, by + sa * l], [bx + Math.cos(a + .32) * r * .8, by + Math.sin(a + .32) * r * .8]], k % 2 ? 'a1' : 'a0'); b.set(bx + ca * (l - .5), by + sa * (l - .5), 'a2'); }
    ppE(b, bx, by, r, r, 'm', 4);
    ppF(b, bx - r * .25, by - r * .3, r * .3, r * .3, 'm3');
    const ey = by - r * .3, ew = s >= 3 ? 3 : 2, eh = s <= 1 || s >= 3 ? 3 : 2;
    ppEye(b, bx, ey, ew, eh, bl, null); ppEye(b, bx + r * .5 + (ew - 2), ey, ew, eh, bl, null);
    b.set(bx + r * .3, by + r * .42, 'k'); b.set(bx + r * .42, by + r * .5, 'k'); b.set(bx + r * .54, by + r * .42, 'k');
    if (s <= 2) { b.set(bx - r * .2, by + r * .25, 'p'); b.set(bx + r * .85, by + r * .25, 'p'); }
    if (s >= 2) for (let k = 0; k < (s >= 4 ? 3 : 2); k++) { const a = f * 1.57 + k * 6.283 / (s >= 4 ? 3 : 2), x = bx + Math.cos(a) * (r + 3), y = by + Math.sin(a) * (r + 2) * .7; b.rect(x, y, 2, 2, 'a2'); b.set(x, y, 'h'); }
    if (s >= 4) for (let k = -1; k <= 1; k++) b.line(bx + k * r * .45, by - r * .9, bx + k * r * .6, by - r - 3 - (k ? 0 : 2), 'a2');
    if (s === 5) ppCrown(b, bx + r * .1, by - r - 2, 7);
  }
};
// Ei: Grundfarbe der Art mit Flecken, Risse mit dem Brutfortschritt (cr 0–2)
function petEggPB(sp, cr) {
  const b = PB(16, 18); ppE(b, 8, 10, 5.2, 6.6, 'm', 4);
  for (const [x, y] of [[6, 7], [10, 10], [7, 13], [11, 6], [5, 11]]) b.set(x, y, 'a1');
  b.set(6, 6, 'm3'); b.set(6, 7, 'm3'); b.set(7, 5, 'm3');
  if (cr >= 1) { b.line(3, 10, 5, 8, 'k'); b.line(5, 8, 7, 10, 'k'); b.line(7, 10, 9, 8, 'k'); b.line(9, 8, 11, 10, 'k'); }
  if (cr >= 2) { b.line(11, 10, 13, 8, 'k'); ppClear(b, 8, 4); ppClear(b, 9, 4); ppClear(b, 9, 5); b.line(8, 6, 10, 7, 'k'); }
  pbOutline(b, 'o');
  if (cr >= 2) { b.set(9, 4, 'k'); b.set(9, 5, 'k'); }
  return b;
}

/* ---------- Bildstreifen: 0–3 Ruhe, 4–7 Bewegung, 8 Blinzeln ---------- */
const PET_STRIP = {}, PET_URLS = {};
function petPaint(g, b, pal, ox, oy, x0, y0, w, h, fi, shiny) {
  const d = g.createImageData(w, h), p = d.data, R = shiny ? mulberry(fi * 977 + 13) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = b.get(x0 + x, y0 + y); if (!k) continue; let c = pal[k];
    if (shiny && (k[0] === 'm' || k[0] === 'w')) { const i = +k[1]; c = petHslRgb(260 + (x + x0) * 5 + (y + y0) * 3 + fi * 18, .5, [.36, .55, .72, .9][i]); }
    if (!c) c = pal.k; const o = (y * w + x) * 4; p[o] = c[0]; p[o + 1] = c[1]; p[o + 2] = c[2]; p[o + 3] = 255;
  }
  if (shiny) for (let i = 0; i < 3; i++) { const x = Math.floor(R() * w), y = Math.floor(R() * h), o = (y * w + x) * 4; if (p[o + 3]) { p[o] = p[o + 1] = p[o + 2] = 255; } }
  g.putImageData(d, ox, oy);
}
function petStrip(sp, s, col, shiny) {
  col = shiny && col === 6 ? 6 : clamp(col | 0, 0, 5); const key = sp + s + ':' + col; if (PET_STRIP[key]) return PET_STRIP[key];
  const fr = [];
  for (let i = 0; i < 9; i++) { const b = PB(64, 64); PET_ART[sp](b, s, i % 4, i >= 4 && i < 8, i === 8); if (s === 5) pbOutline(b, 'y'); pbOutline(b, 'o'); fr.push(b); }
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (const b of fr) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (b.a[y * 64 + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const W = x1 - x0 + 1, H = y1 - y0 + 1, pal = petPal(sp, col), shine = col === 6;
  const c = mk(W * 9, H); const g = c.getContext('2d');
  fr.forEach((b, i) => petPaint(g, b, pal, i * W, 0, x0, y0, W, H, i, shine));
  return PET_STRIP[key] = { c, W, H, ax: PET_CX - x0, ay: PET_GY - y0, sil: null };
}
function petStripOf(p) { return petStrip(p.sp, petStage(p.lv), p.col, p.shiny); }
// Bild-URLs für Menüs: einzelnes Bild bzw. 4 Bilder Ruhe-Animation
function petImgURL(sp, s, col, shiny, anim) {
  const S = petStrip(sp, s, col, shiny), key = sp + s + ':' + (shiny && col === 6 ? 6 : col) + (anim ? 'a' : 'i'); if (PET_URLS[key]) return PET_URLS[key];
  const c = mk(S.W * (anim ? 4 : 1), S.H, g => g.drawImage(S.c, 0, 0, S.W * (anim ? 4 : 1), S.H, 0, 0, S.W * (anim ? 4 : 1), S.H));
  return PET_URLS[key] = { url: c.toDataURL(), W: S.W, H: S.H };
}
function petURL(p, anim) { return petImgURL(p.sp, petStage(p.lv), p.col, p.shiny, anim); }
function eggURL(sp, cr) { const key = 'egg' + sp + cr; if (PET_URLS[key]) return PET_URLS[key]; const b = petEggPB(sp, cr), c = mk(16, 18), pal = petPal(sp, 0); petPaint(c.getContext('2d'), b, pal, 0, 0, 0, 0, 16, 18, 0, false); return PET_URLS[key] = c.toDataURL(); }

/* ---------- Spielstand: Begleiter und Eier prüfen (alte und getauschte Daten) ---------- */
function petCols(p) { const r = []; for (let i = 0; i <= petStage(p.lv); i++) r.push((p.c0 + i) % 6); if (p.shiny) r.push(6); return r; }
function petFix(o, newId) {
  if (!o || typeof o !== 'object' || !PET_SP[o.sp]) return null;
  const n = v => (typeof v === 'number' && isFinite(v) ? v : +v || 0);
  const p = { id: !newId && typeof o.id === 'string' && o.id ? o.id.slice(0, 24) : uid(), sp: o.sp, nm: typeof o.nm === 'string' ? o.nm.replace(/[<>]/g, '').trim().slice(0, 16) : '', lv: clamp(Math.floor(n(o.lv)) || 1, 1, 100), xp: Math.max(0, Math.floor(n(o.xp))), c0: clamp(Math.floor(n(o.c0)), 0, 5), shiny: !!o.shiny, k: Math.max(0, Math.floor(n(o.k))), born: n(o.born) || Date.now() };
  p.xp = p.lv >= 100 ? 0 : Math.min(p.xp, petNeed(p.lv) - 1);
  const col = o.col == null ? (p.shiny ? 6 : p.c0) : Math.floor(n(o.col)); p.col = petCols(p).includes(col) ? col : p.shiny ? 6 : p.c0;
  if (o.nw) p.nw = 1;
  return p;
}
function eggFix(o) { if (!o || typeof o !== 'object' || !PET_SP[o.sp]) return null; const need = clamp(Math.floor(+o.need) || EGG_NEED, 1, 9999); return { sp: o.sp, need, got: clamp(Math.floor(+o.got) || 0, 0, need) }; }
// Wirft hier etwas, würde loadAll einen leeren Spielstand anlegen – deshalb nie werfen, Rohdaten notfalls aufheben
HOOK.meta.push(m => {
  const d = m.pets && typeof m.pets === 'object' ? m.pets : {};
  try {
    const list = (Array.isArray(d.list) ? d.list : []).map(o => petFix(o)).filter(Boolean).slice(0, PET_MAX), seen = new Set();
    for (const p of list) { if (seen.has(p.id)) p.id = uid(); seen.add(p.id); }
    m.pets = { list, eggs: (Array.isArray(d.eggs) ? d.eggs : []).map(eggFix).filter(Boolean).slice(0, EGG_MAX), act: list.some(p => p.id === d.act) ? d.act : null, starter: !!d.starter, hatched: Math.max(0, Math.floor(+d.hatched) || 0) };
    if (d.bad) m.pets.bad = d.bad;
  } catch (e) { console.error('Begleiter (meta):', e); m.pets = { list: [], eggs: [], act: null, starter: !!d.starter, hatched: 0, bad: d }; }
});

/* ---------- Schnittstelle (auch für den Tausch) ---------- */
// Neuer Begleiter: o = { lv, xp, col, shiny, nm, nw } → Begleiter oder null (kein Platz)
function petGive(sp, o) {
  const M = petM(); o = o || {}; if (!M || !PET_SP[sp] || M.list.length >= PET_MAX) return null;
  const c0 = clamp((o.col | 0), 0, 5), p = petFix({ sp, nm: o.nm || '', lv: o.lv || 1, xp: o.xp || 0, c0, col: o.shiny ? 6 : c0, shiny: !!o.shiny, nw: o.nw }, true);
  M.list.push(p); if (!M.act) M.act = p.id; persist(); if (P && P.st) computeStats(); return p;
}
// Neues Ei (Art zufällig, wenn keine angegeben) → true/false (Brutnest voll)
function eggGive(sp, quiet) {
  const M = petM(); if (!M) return false; if (!PET_SP[sp]) sp = pick(PET_ORDER);
  if (M.eggs.length >= EGG_MAX) { if (!quiet) toast(_t('Dein Brutnest ist voll – mehr als {n} Eier passen nicht hinein.', { n: EGG_MAX }), '#ff6a5a'); return false; }
  M.eggs.push({ sp, need: EGG_NEED, got: 0 }); persist();
  if (!quiet) { toast(_t('Begleiter-Ei: {name}! Es schlüpft nach {n} Siegen.', { name: PET_SP[sp].n, n: EGG_NEED }), '#ffd24a'); sfx('loot'); }
  return true;
}
// Daten eines Begleiters zum Verschicken; entfernt ihn (außer keep) → { sp, nm, lv, xp, col, c0, shiny, k, born } oder null
function petExport(i, keep) {
  const M = petM(), p = M && M.list[i]; if (!p) return null;
  const d = { sp: p.sp, nm: p.nm, lv: p.lv, xp: p.xp, col: p.col, c0: p.c0, shiny: !!p.shiny, k: p.k || 0, born: p.born };
  if (!keep) { M.list.splice(i, 1); if (M.act === p.id) M.act = M.list.length ? M.list[0].id : null; if (petView === p.id) petView = null; persist(); if (P && P.st) computeStats(); }
  return d;
}
function eggExport(i, keep) { const M = petM(), g = M && M.eggs[i]; if (!g) return null; const d = { egg: 1, sp: g.sp, need: g.need, got: g.got }; if (!keep) { M.eggs.splice(i, 1); persist(); } return d; }
// Empfangen: Begleiter oder Ei ({ egg: 1, … }) → true/false (ungültig oder kein Platz)
function petImport(d) {
  const M = petM(); if (!M || !d || typeof d !== 'object') return false;
  if (d.egg) { const g = eggFix(d); if (!g || M.eggs.length >= EGG_MAX) return false; M.eggs.push(g); persist(); return true; }
  const p = petFix(Object.assign({}, d, { nw: 1 }), true); if (!p || M.list.length >= PET_MAX) return false;
  M.list.push(p); if (!M.act) M.act = p.id; persist(); if (P && P.st) computeStats(); return true;
}
function petFree() { const M = petM(); return M ? PET_MAX - M.list.length : 0; }
function eggFree() { const M = petM(); return M ? EGG_MAX - M.eggs.length : 0; }
// Vorschau für Tausch-Bildschirme: Text und Bild zu exportierten Daten
function petLabel(d) { if (!d || !PET_SP[d.sp]) return ''; if (d.egg) return _t('{name}-Ei', { name: PET_SP[d.sp].n }); const lv = clamp(d.lv | 0 || 1, 1, 100); return _t('{name} · LV {lv} · {stage}', { name: d.nm ? String(d.nm).slice(0, 16) : PET_SP[d.sp].n, lv, stage: PET_STN[petStage(lv)] }) + (d.shiny ? ' ✦' : ''); }
function petIconURL(d) { if (!d || !PET_SP[d.sp]) return ''; if (d.egg) return eggURL(d.sp, 0); return petImgURL(d.sp, petStage(clamp(d.lv | 0 || 1, 1, 100)), d.col | 0, !!d.shiny, false).url; }

/* ---------- Wachsen: EP, Level, Entwicklung, Schlüpfen ---------- */
const PET_UNLOCK = [null, _t('Beutemagnet'), _t('Passive Kraft'), _t('Spezialangriff'), _t('Uralte Kraft'), _t('Mythische Kraft')];
function petXP(p, v, quiet) {
  if (!p || p.lv >= 100 || !(v > 0)) return 0;
  const s0 = petStage(p.lv), l0 = p.lv; p.xp += Math.round(v);
  while (p.lv < 100 && p.xp >= petNeed(p.lv)) { p.xp -= petNeed(p.lv); p.lv++; }
  if (p.lv >= 100) p.xp = 0;
  if (p.lv === l0) return 0;
  const s1 = petStage(p.lv), here = petActive() === p && PET_RT.id === p.id && state === 'play';
  if (petActive() === p && P && P.st) computeStats();
  if (s1 > s0) {
    const t = _t('{name} ENTWICKELT SICH!', { name: petName(p).toLocaleUpperCase(LOCALE) }), sub = _t('{stage} · LV {lv} · Neu: {what} und eine neue Farbe', { stage: PET_STN[s1], lv: p.lv, what: PET_UNLOCK[s1] });
    if (state === 'play') banner(t, sub); else toast(t + ' ' + sub, '#ffd24a');
    sfx('myth');
    if (here) { PET_RT.fl = 1.2; rings.push({ x: PET_RT.x, y: PET_RT.y, r: 4, max: 60, life: .7, max2: .7, col: '#ffd24a' }); burst(PET_RT.x, PET_RT.y, PET_RT.z + 8, '#ffd24a', 30, 90, 1); burst(PET_RT.x, PET_RT.y, PET_RT.z + 8, PET_EL[PET_SP[p.sp].el].c, 20, 70, 1); }
  } else {
    if (here) { PET_RT.fl = .35; txt(PET_RT.x, PET_RT.y - 20 - PET_RT.z, _t('LV {lv}', { lv: p.lv }), '#ffd24a', true); rings.push({ x: PET_RT.x, y: PET_RT.y, r: 3, max: 26, life: .4, max2: .4, col: '#ffd24a' }); }
    else if (!quiet) toast(_t('{name} erreicht LV {lv}!', { name: petName(p), lv: p.lv }), '#ffd24a');
    petSnd('chirp');
  }
  return p.lv - l0;
}
function eggHatch(i, quiet) {
  const M = petM(), g = M && M.eggs[i]; if (!g || g.got < g.need || M.list.length >= PET_MAX) return null;
  M.eggs.splice(i, 1);
  const shiny = Math.random() < .01, c0 = ri(0, 5), p = petGive(g.sp, { col: c0, shiny, nw: 1 }); M.hatched++;
  const sub = shiny ? _t('Ein schillernder {name}! (1 zu 100)', { name: PET_SP[p.sp].n }) : _t('{name} · Farbe {col}', { name: PET_SP[p.sp].n, col: petColName(p.sp, c0) });
  if (state === 'play' && !quiet) { banner(_t('EIN EI IST GESCHLÜPFT!'), sub); rings.push({ x: P.x, y: P.y, r: 4, max: 50, life: .6, max2: .6, col: '#ffd24a' }); burst(P.x, P.y, 10, '#fff0c0', 20, 70, 1); burst(P.x, P.y, 10, PET_EL[PET_SP[p.sp].el].c, 16, 60, 1); }
  else toast(_t('Geschlüpft: {what}', { what: sub }), '#ffd24a');
  sfx(shiny ? 'myth' : 'ach'); persist();
  return p;
}
function petKill(e) {
  const M = petM(); if (!M) return;
  const p = petActive(); if (p) petXP(p, Math.max(1, Math.round((e.xp || 0) * .5)));
  let ready = -1;
  M.eggs.forEach((g, i) => { if (g.got < g.need) g.got = Math.min(g.need, g.got + (e.boss ? 10 : 1)); if (g.got >= g.need && ready < 0) ready = i; });
  if (ready >= 0 && M.list.length < PET_MAX) eggHatch(ready);
  // Bosse: 3 % Ei, in der Qual 5 %
  if (e.boss && Math.random() < .03 + (qualOf(P.act) ? .02 : 0)) {
    txt(e.x, e.y - 34, _t('BEGLEITER-EI!'), '#ffd24a', true);
    if (M.eggs.length >= EGG_MAX) { gainFate(1); toast(_t('Ein Begleiter-Ei! Dein Brutnest ist voll – dafür +1 Glücksmünze.'), '#ffd24a'); } else eggGive(null);
  }
}
function petNews() { const M = petM(); if (!M) return false; return (!M.starter && SAVE.chars.length > 0) || M.list.some(p => p.nw) || (M.list.length < PET_MAX && M.eggs.some(g => g.got >= g.need)); }

/* ---------- Ton ---------- */
function petSnd(k) {
  if (!AC || !sfxOn()) return;
  switch (k) {
    case 'fire': noise(.12, .03, 700); tone(260, .1, 'sawtooth', .02, 120); break;
    case 'ice': tone(1500, .1, 'sine', .025, 900); noise(.06, .015, 4000); break;
    case 'beam': tone(1100, .14, 'triangle', .022, 1700); break;
    case 'zap': noise(.08, .035, 2600); tone(1300, .05, 'square', .015, 400); break;
    case 'claw': noise(.06, .035, 1800); break;
    case 'bite': tone(320, .05, 'square', .025, 160); noise(.04, .02, 1500); break;
    case 'chirp': [1200, 1600, 2000].forEach((f, i) => tone(f, .07, 'triangle', .035, 0, i * .06)); break;
    case 'feed': tone(700, .06, 'triangle', .03, 900); tone(900, .08, 'triangle', .03, 1200, .07); break;
    case 'puff': noise(.15, .03, 900); break;
  }
}

/* ---------- Im Spiel: folgen, kämpfen, Beute anziehen ---------- */
const PET_RT = { id: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, face: 1, ph: 0, cd: 1, spc: 8, mv: false, dash: null, seq: null, storm: null, idle: 0, sleep: false, bl: 3, blk: 0, fl: 0, g: 0, lt: 0, wan: null, wanT: 0, atk: 0 };
let PET_BOLTS = [], PET_FX = [];
function petAlive(e) { return !!e && !e.dead && e.st !== 'spawn' && !(e.under > 0) && !(e.fade > .6) && e.ai !== 'dummy'; }
function petPlace(puff) {
  const p = petActive(); PET_RT.id = p ? p.id : null; PET_RT.g = G; PET_BOLTS = []; PET_FX = []; PET_RT.dash = PET_RT.seq = PET_RT.storm = PET_RT.wan = null; PET_RT.idle = 0; PET_RT.sleep = false;
  if (!p || !P) return;
  const bd = typeof BD !== 'undefined' ? BD : { x0: 0, x1: 9999, y0: 0, y1: 9999 };
  PET_RT.x = clamp(P.x - (P.face || 1) * 16, bd.x0 + 6, bd.x1 - 6); PET_RT.y = clamp(P.y + 3, bd.y0, bd.y1); PET_RT.vx = PET_RT.vy = 0; PET_RT.face = P.face || 1;
  PET_RT.z = PET_SP[p.sp].fly ? 12 : 0; PET_RT.cd = 1; PET_RT.spc = 6; PET_RT.lt = T;
  if (puff && state === 'play') { burst(PET_RT.x, PET_RT.y, 6, PET_EL[PET_SP[p.sp].el].c, 14, 45, 1); petSnd('puff'); }
}
// Werte eines Angriffs: wie die Waffe des Helden, aber schwächer, mit dem Element der Art
function petW(p) {
  const w = playerW(), S = PET_SP[p.sp];
  w.dmg *= petDmgK(p.lv); w.crit = Math.min(.6, w.crit * .5 + (p.sp === 'katze' ? .18 : .05)); w.leech = 0; w.kb *= .4; w.chained = true;
  w.burn = p.sp === 'drache' ? .3 : 0; w.frost = p.sp === 'eule' ? .45 : 0; w.poison = p.sp === 'natter';
  w.el = S.el; w.col = PET_EL[S.el].c; w.pet = 1;
  return w;
}
function petHit(e, w, mul, nx, ny, crit) {
  if (!e || e.dead) return;
  const sx = P.stealth; P.stealth = 0; // Tarnung des Helden nicht verbrauchen
  weaponHit(e, w, mul, nx || 0, ny || 0, .6, crit);
  P.stealth = sx;
  if (e.dead) { const p = petActive(); if (p) p.k = (p.k || 0) + 1; }
}
function petBolt(kind, w, mul, a, tg, o) {
  const sp = (o && o.sp) || 190;
  const b = Object.assign({ kind, w, mul, x: PET_RT.x + Math.cos(a) * 5, y: PET_RT.y + Math.sin(a) * 3, h: PET_RT.z + 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, t: 1.1, tg, hit: null, home: true, pierce: false, draw: petBoltDraw }, o || {}); b.t0 = b.t; PET_BOLTS.push(b);
}
function petAttack(p, t) {
  const st = petStage(p.lv), w = petW(p), a = Math.atan2(t.y - PET_RT.y, t.x - PET_RT.x);
  PET_RT.face = t.x >= PET_RT.x ? 1 : -1; PET_RT.atk = .22;
  switch (p.sp) {
    case 'drache': petBolt('fire', w, 1, a, t); petSnd('fire'); break;
    case 'eule': petBolt('ice', w, 1, a, t, { sp: 220 }); petSnd('ice'); break;
    case 'kaefer': {
      PET_FX.push({ k: 'beam', x: PET_RT.x, y: t.y, z0: PET_RT.z + 6, tg: t, tx: t.x, ty: t.y, tz: 8 * t.sc + (t.z || 0), t: .24, max: .24, draw: petFxDraw });
      petHit(t, w, 1.05, Math.cos(a), Math.sin(a)); burst(t.x, t.y, 8 * t.sc, '#fff6c0', 7, 40, 1); petSnd('beam'); break;
    }
    case 'funke': {
      const pts = [[PET_RT.x, PET_RT.y - PET_RT.z - 4]], hit = new Set(); let cur = t, mul = 1;
      for (let k = 0; k <= (st >= 4 ? 3 : st >= 2 ? 2 : 1) && cur; k++) {
        hit.add(cur); pts.push([cur.x, cur.y - 8 * cur.sc]); petHit(cur, w, mul, 0, 0); mul *= .8;
        let nt = null, bd = 70; for (const e of enemies) { if (hit.has(e) || !petAlive(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; nt = e; } } cur = nt;
      }
      fx.push({ k: 'zap', pts, life: .2, max: .2 }); petSnd('zap'); break;
    }
    default: PET_RT.dash = { tg: t, t: 0, max: .75, hit: false };
  }
}
function petSpecial(p, t) {
  const S = PET_SP[p.sp], pw = petPow(p.lv), w = petW(p);
  txt(PET_RT.x, PET_RT.y - 26 - PET_RT.z, S.sn.toLocaleUpperCase(LOCALE) + '!', PET_EL[S.el].c2, true); PET_RT.fl = .4;
  switch (p.sp) {
    case 'drache': { const a0 = Math.atan2(t.y - PET_RT.y, t.x - PET_RT.x), n = Math.round(8 + 4 * pw); for (let k = 0; k < n; k++) petBolt('flame', w, .3 * pw, a0 + rnd(-.4, .4), null, { sp: rnd(140, 210), t: rnd(.38, .62), pierce: true, home: false }); sfx('fire'); break; }
    case 'katze': { const list = enemies.filter(petAlive).sort((a, b) => dist(a, PET_RT) - dist(b, PET_RT)).slice(0, pw >= 2 ? 6 : pw > 1 ? 4 : 3); PET_RT.seq = { list, i: 0, t: 0, w, mul: 1.5 * pw }; PET_RT.dash = null; break; }
    case 'kaefer': {
      const h = Math.round(P.st.hp * .05 * pw); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 28, '+' + h, '#79c24e', true);
      fx.push({ k: 'pillar', x: P.x, y: P.y, life: 1, max: 1 }); rings.push({ x: P.x, y: P.y, r: 4, max: 84, life: .5, max2: .5, col: '#ffe08a' });
      for (const e of enemies) { if (!petAlive(e)) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < 78 + e.r * e.sc) { const g = e.gold; petHit(e, w, 1.1 * pw, (e.x - P.x) / (d || 1), (e.y - P.y) / (d || 1)); if (p.lv >= 75 && g > 0) dropCoins(e.x, e.y, Math.max(1, Math.round(g * .3))); } }
      for (let i = 0; i < 24; i++) part(P.x + rnd(-30, 30), P.y + rnd(-14, 14), 0, 0, 0, rnd(30, 70), Math.random() < .5 ? '#ffe08a' : '#fffbe0', rnd(.5, 1), 1, -10, 1);
      sfx('heal'); break;
    }
    case 'eule': {
      const R = 82; fxAnim('ring', PET_RT.x, PET_RT.y - 4, { sc: R / 22, dur: .5, add: true }); for (let k = 0; k < 12; k++) fx.push({ k: 'shard', x: PET_RT.x, y: PET_RT.y, ang: k / 12 * 6.283, life: .4, max: .4 });
      for (const e of enemies) { if (!petAlive(e)) continue; const d = Math.hypot(e.x - PET_RT.x, e.y - PET_RT.y); if (d < R + e.r * e.sc) { petHit(e, w, .9 * pw, (e.x - PET_RT.x) / (d || 1), (e.y - PET_RT.y) / (d || 1)); if (!e.dead) { if (e.boss) e.chill = 2.5; else e.freeze = Math.max(e.freeze || 0, 1.1 * pw); } } }
      for (let i = 0; i < 26; i++) part(PET_RT.x + rnd(-40, 40), PET_RT.y + rnd(-20, 20), rnd(10, 30), rnd(-20, 20), rnd(-10, 10), 0, Math.random() < .5 ? '#ffffff' : '#bfefff', rnd(.6, 1.1), 1, 20, 1);
      sfx('frost'); break;
    }
    case 'natter': { PET_FX.push({ k: 'cloud', x: t.x, y: t.y, r: 28 + 6 * pw, t: 4, max: 4, tick: 0, pw, w, draw: petFxDraw }); petBolt('spit', w, .3, Math.atan2(t.y - PET_RT.y, t.x - PET_RT.x), t, { sp: 230 }); sfx('poison'); break; }
    case 'funke': PET_RT.storm = { n: pw >= 2 ? 7 : pw > 1 ? 5 : 3, t: 0, w, pw }; break;
  }
}
function petTick(dt) {
  const p = petActive(); if (!p || !P) { PET_RT.id = null; return; }
  PET_RT.lt = T;
  if (PET_RT.id !== p.id || PET_RT.g !== G) petPlace(PET_RT.id !== null && PET_RT.id !== p.id);
  const S = PET_SP[p.sp], st = petStage(p.lv), play = state === 'play' && !!G && !!G.type, hide = play && G.type === 'versteck', fight = play && !hide && G.phase !== 'done';
  PET_RT.fl = Math.max(0, PET_RT.fl - dt); PET_RT.atk = Math.max(0, PET_RT.atk - dt);
  PET_RT.bl -= dt; if (PET_RT.bl < 0) { PET_RT.blk = .14; PET_RT.bl = rnd(2.2, 5); } PET_RT.blk -= dt;
  // Spezial-Abläufe: Schattensprung, Gewitter
  if (PET_RT.seq) {
    const Q = PET_RT.seq; Q.t -= dt;
    if (Q.t <= 0) {
      const e = Q.list[Q.i++];
      if (!e) PET_RT.seq = null;
      else if (petAlive(e)) {
        PET_FX.push({ k: 'after', x: PET_RT.x, y: PET_RT.y, z: PET_RT.z, face: PET_RT.face, t: .3, max: .3, draw: petFxDraw });
        const sd = e.x >= P.x ? 1 : -1; PET_RT.x = e.x + sd * (e.r * e.sc + 5); PET_RT.y = e.y + 1; PET_RT.face = -sd; PET_RT.z = 0; PET_RT.vx = PET_RT.vy = 0;
        petHit(e, Q.w, Q.mul, -sd, 0, true); fx.push({ k: 'slash', x: e.x, y: e.y - 8, ang: sd > 0 ? Math.PI : 0, flip: Q.i % 2 === 0, sc: .45, life: .2, max: .2, col: '#c8a0ff' }); burst(e.x, e.y, 8, '#b892f4', 10, 50, 1); petSnd('claw');
        Q.t = .13;
      }
    }
  }
  if (PET_RT.storm && state === 'play') {
    const Z = PET_RT.storm; Z.t -= dt;
    if (Z.t <= 0) {
      Z.t = .14; Z.n--; const list = enemies.filter(e => petAlive(e) && Math.hypot(e.x - P.x, e.y - P.y) < 180), e = list.length ? pick(list) : null;
      if (e) { fxAnim('bolt', e.x, e.y - 18, { dur: .4, add: true }); petHit(e, Z.w, 1.3 * Z.pw, 0, 0); burst(e.x, e.y, 4, '#fffbe0', 10, 60, 1); flash = { a: .1, c: '200,220,255' }; shake(2); sfx('zap'); }
      if (Z.n <= 0 || !e) PET_RT.storm = null;
    }
  }
  // Ziel: hinter dem Helden; im Versteck ein wenig herumstreunen
  let tx = P.x - (P.face || 1) * (8 + petStripOf(p).W * .42), ty = P.y + (S.fly ? -2 : 3), k = 7;
  if (hide && !P.moving && PET_RT.idle > 1.2) {
    PET_RT.wanT -= dt;
    if (PET_RT.wanT <= 0) { PET_RT.wanT = rnd(2.2, 4.8); PET_RT.wan = Math.random() < .3 ? null : { x: clamp(P.x + rnd(-48, 48), BD.x0 + 8, BD.x1 - 8), y: clamp(P.y + rnd(-22, 26), BD.y0 + 4, BD.y1 - 2) }; if (!PET_RT.wan && Math.random() < .6) PET_FX.push({ k: 'heart', x: PET_RT.x, y: PET_RT.y, z: PET_RT.z + 14, t: 1, max: 1, draw: petFxDraw }); }
    if (PET_RT.wan) { tx = PET_RT.wan.x; ty = PET_RT.wan.y; k = 3.2; }
  } else if (P.moving) { PET_RT.wan = null; PET_RT.wanT = .5; }
  if (PET_RT.dash) {
    const D = PET_RT.dash, t = D.tg; D.t += dt;
    if (!petAlive(t) || D.t > D.max || !fight) PET_RT.dash = null;
    else if (!D.hit) {
      const dx = t.x - PET_RT.x, dy = t.y - PET_RT.y, d = Math.hypot(dx, dy) || 1, sp = p.sp === 'katze' ? 290 : 250, m = Math.min(d, sp * dt);
      PET_RT.x += dx / d * m; PET_RT.y += dy / d * m; PET_RT.face = dx >= 0 ? 1 : -1; PET_RT.vx = dx / d * sp * .3; PET_RT.vy = dy / d * sp * .3;
      if (p.sp === 'katze') PET_RT.z = Math.sin(clamp(D.t / .28, 0, 1) * Math.PI) * (8 + st);
      if (d < t.r * t.sc + 5) {
        D.hit = true; D.t = Math.max(D.t, D.max - .22); PET_RT.z = 0;
        petHit(t, petW(p), 1.25, dx / d, dy / d, false);
        if (p.sp === 'katze') { fx.push({ k: 'slash', x: t.x - dx / d * 3, y: t.y - 8, ang: Math.atan2(dy, dx), flip: Math.random() < .5, sc: .35, life: .18, max: .18, col: '#c8a0ff' }); petSnd('claw'); }
        else { PET_FX.push({ k: 'bite', x: t.x, y: t.y, z: 7 * t.sc, t: .26, max: .26, draw: petFxDraw }); burst(t.x, t.y, 6, '#79c24e', 8, 40, 1); petSnd('bite'); }
      }
    }
  }
  if (!PET_RT.dash && !PET_RT.seq) {
    const ax = k * k * (tx - PET_RT.x) - 2 * k * PET_RT.vx, ay = k * k * (ty - PET_RT.y) - 2 * k * PET_RT.vy;
    PET_RT.vx += ax * dt; PET_RT.vy += ay * dt; const v = Math.hypot(PET_RT.vx, PET_RT.vy); if (v > 320) { PET_RT.vx *= 320 / v; PET_RT.vy *= 320 / v; }
    PET_RT.x += PET_RT.vx * dt; PET_RT.y += PET_RT.vy * dt;
    if (Math.hypot(P.x - PET_RT.x, P.y - PET_RT.y) > 260) petPlace(true);
  }
  if (typeof BD !== 'undefined') { PET_RT.x = clamp(PET_RT.x, BD.x0 + 4, BD.x1 - 4); PET_RT.y = clamp(PET_RT.y, BD.y0, BD.y1); }
  const v = Math.hypot(PET_RT.vx, PET_RT.vy); PET_RT.mv = !!PET_RT.dash || v > 14;
  if (!PET_RT.dash && !PET_RT.seq) { if (Math.abs(PET_RT.vx) > 10) PET_RT.face = PET_RT.vx > 0 ? 1 : -1; else if (PET_RT.atk <= 0 && v < 4) PET_RT.face = P.face || 1; }
  PET_RT.ph += dt * (PET_RT.mv ? 12 : 6) * (S.fly ? 1.3 : 1);
  if (S.fly) PET_RT.z = lerp(PET_RT.z, 11 + st * 1.4 + Math.sin(T * 3 + 1) * 1.6, 1 - Math.pow(.02, dt));
  else if (!(p.sp === 'katze' && PET_RT.dash && !PET_RT.dash.hit)) PET_RT.z = p.sp === 'katze' && PET_RT.mv ? Math.abs(Math.sin(PET_RT.ph * Math.PI / 2)) * 1.5 : 0;
  // Ruhe: nach einer Weile schläft der Begleiter ein
  if (P.moving || PET_RT.mv && !PET_RT.wan || (fight && enemies.some(petAlive))) PET_RT.idle = 0; else PET_RT.idle += dt;
  PET_RT.sleep = PET_RT.idle > 14 && !PET_RT.wan;
  // Kampf
  if (fight) {
    PET_RT.cd -= dt; PET_RT.spc -= dt;
    if (PET_RT.cd <= 0 && !PET_RT.dash && !PET_RT.seq) { const t = nearestEnemy(S.fly ? 150 : 125, P); if (t && petAlive(t) && Math.hypot(t.x - PET_RT.x, t.y - PET_RT.y) < 200) { petAttack(p, t); PET_RT.cd = petAtkCd(p); } else PET_RT.cd = .25; }
    if (p.lv >= 50 && PET_RT.spc <= 0 && !PET_RT.seq) { const t = nearestEnemy(160, P); if (t && petAlive(t)) { petSpecial(p, t); PET_RT.spc = petSpecCd(p.lv); } else PET_RT.spc = .6; }
  }
  // Beutemagnet ab LV 10
  if (play && p.lv >= 10) {
    const R = petMagR(p.lv), R2 = R * R;
    for (const c of pickups) { if (c.mag || c.k === 'loot' || c.t < .25) continue; const dx = c.x - P.x, dy = c.y - P.y; if (dx * dx + dy * dy < R2) { c.mag = 1; part(c.x, c.y, 5, 0, 0, 30, PET_EL[S.el].c, .35, 1, 0, 1); } }
  }
  // Aura ab Uralt, Glitzern bei schillernden
  if (st >= 4 && Math.random() < (st === 5 ? .3 : .18)) part(PET_RT.x + rnd(-6, 6) - PET_RT.face * 2, PET_RT.y + rnd(-2, 2), PET_RT.z + rnd(0, 6), 0, 0, rnd(12, 28), Math.random() < .5 ? PET_EL[S.el].c : st === 5 ? '#ffd24a' : PET_EL[S.el].c2, rnd(.5, .9), 1, -5, 1);
  if (p.shiny && Math.random() < .08) part(PET_RT.x + rnd(-6, 6), PET_RT.y, PET_RT.z + rnd(2, 12), 0, 0, 10, '#ffffff', .4, 1, 0, 1);
  // eigene Geschosse
  for (const b of PET_BOLTS) {
    if (b.delay > 0) { b.delay -= dt; continue; }
    b.t -= dt;
    if (b.home && b.tg && petAlive(b.tg)) { const a = Math.atan2(b.tg.y - b.y, b.tg.x - b.x), c = Math.atan2(b.vy, b.vx), na = c + clamp(angDiff(a, c), -5 * dt, 5 * dt); b.vx = Math.cos(na) * b.sp; b.vy = Math.sin(na) * b.sp; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.h = lerp(b.h, 7, 1 - Math.pow(.05, dt));
    const col = b.kind === 'ice' ? '#bfefff' : b.kind === 'spit' ? '#9ad858' : Math.random() < .5 ? '#ffd24a' : '#ff8a3a';
    if (Math.random() < (b.kind === 'flame' ? .35 : .6)) part(b.x, b.y, b.h, rnd(-8, 8), rnd(-4, 4), rnd(-5, 10), col, .3, 1, 0, 1);
    for (const e of enemies) {
      if (!petAlive(e) || (b.hit && b.hit.has(e))) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r * e.sc + 4) {
        petHit(e, b.w, b.mul, b.vx / b.sp, b.vy / b.sp);
        if (b.kind === 'fire') fxAnim('boom', b.x, b.y - b.h, { sc: .28, dur: .3 }); else burst(b.x, b.y, b.h, col, b.kind === 'flame' ? 3 : 8, 45, 1);
        if (b.pierce) (b.hit = b.hit || new Set()).add(e); else { b.t = 0; break; }
      }
    }
    if (b.x < BD.x0 - 12 || b.x > BD.x1 + 12 || b.y < BD.y0 - 20 || b.y > BD.y1 + 12) b.t = 0;
  }
  PET_BOLTS = PET_BOLTS.filter(b => b.t > 0);
  for (const f of PET_FX) {
    f.t -= dt;
    if (f.k === 'beam' && petAlive(f.tg)) { f.tx = f.tg.x; f.ty = f.y = f.tg.y; }
    if (f.k === 'cloud') {
      f.tick -= dt; if (Math.random() < .5) part(f.x + rnd(-f.r, f.r) * .8, f.y + rnd(-f.r, f.r) * .35, 1, 0, 0, rnd(8, 18), Math.random() < .5 ? '#79c24e' : '#c8f06a', .6, 1, -6, 1);
      if (f.tick <= 0) { f.tick = .5; for (const e of enemies) if (petAlive(e) && Math.hypot(e.x - f.x, (e.y - f.y) * 1.6) < f.r + e.r * e.sc) { e.poison = Math.max(e.poison || 0, 2.5); e.poisonDmg = Math.max(e.poisonDmg || 0, Math.max(1, Math.round(f.w.dmg * .35 * f.pw))); } }
    }
  }
  PET_FX = PET_FX.filter(f => f.t > 0);
}

/* ---------- Zeichnen (tiefensortiert über HOOK.draw) ---------- */
let PET_ICE = null;
function petFxFrame(name, f, x, y, sc, rot) { const r = fxRect(name, f); ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (rot) ctx.rotate(rot); ctx.scale(sc, sc); ctx.drawImage(FXIMG, r[0], r[1], r[2], r[3], -r[2] / 2, -r[3] / 2, r[2], r[3]); ctx.restore(); }
function petBoltDraw() {
  if (this.delay > 0) return;
  const x = this.x - CX, y = this.y - CY - this.h, a = Math.atan2(this.vy, this.vx); let rgb = '255,140,60', gr = 10;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.round(this.x - CX) - 1, Math.round(this.y - CY), 3, 1);
  if (this.kind === 'fire') petFxFrame('fireball', Math.floor(T * 14 + this.x * .1), x, y, .55, a);
  else if (this.kind === 'ice') {
    if (!PET_ICE) PET_ICE = mk(9, 5, g => { px(g, 0, 2, 1, 1, '#57a7d6'); px(g, 1, 2, 7, 1, '#8ee6ff'); px(g, 2, 1, 5, 3, '#bfefff'); px(g, 3, 2, 4, 1, '#ffffff'); px(g, 8, 2, 1, 1, '#ffffff'); px(g, 4, 0, 1, 1, '#8ee6ff'); px(g, 4, 4, 1, 1, '#8ee6ff'); });
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a); ctx.drawImage(PET_ICE, -5, -2); ctx.restore(); rgb = '150,220,255';
  } else if (this.kind === 'spit') { ctx.fillStyle = '#4e9c32'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 3); ctx.fillStyle = '#c8f06a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 1); rgb = '140,220,90'; gr = 8; }
  else { const q = clamp(this.t / (this.t0 || .5), 0, 1), s = Math.round(lerp(6, 2, q)); ctx.fillStyle = q > .65 ? '#fff0a0' : q > .3 ? '#ffb03a' : '#d8402a'; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); gr = 4 + s; }
  ctx.globalCompositeOperation = 'lighter'; glow(x, y, gr, rgb, .4); ctx.globalCompositeOperation = 'source-over';
  addLight(x, y, 18, .6);
}
function petFxDraw() {
  const f = this, q = clamp(f.t / f.max, 0, 1);
  if (f.k === 'beam') {
    const x0 = PET_RT.x - CX + PET_RT.face * 3, y0 = PET_RT.y - CY - PET_RT.z - 5, x1 = f.tx - CX, y1 = f.ty - CY - f.tz;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = q;
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + rnd(-1, 1), y1 + rnd(-1, 1)); ctx.stroke();
    glow(x1, y1, 10, '255,230,150', .6 * q); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; addLight(x1, y1, 24, q);
  } else if (f.k === 'bite') {
    const x = Math.round(f.x - CX), y = Math.round(f.y - CY - f.z), gap = Math.round(lerp(0, 5, clamp((q - .35) * 2.5, 0, 1)));
    ctx.globalAlpha = Math.min(1, q * 3); ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - gap - 3, 7, 1); ctx.fillRect(x - 2, y - gap - 2, 2, 1); ctx.fillRect(x + 1, y - gap - 2, 2, 1); ctx.fillRect(x - 2, y - gap - 1, 1, 1); ctx.fillRect(x + 2, y - gap - 1, 1, 1);
    ctx.fillRect(x - 3, y + gap + 3, 7, 1); ctx.fillRect(x - 2, y + gap + 2, 2, 1); ctx.fillRect(x + 1, y + gap + 2, 2, 1); ctx.fillRect(x - 2, y + gap + 1, 1, 1); ctx.fillRect(x + 2, y + gap + 1, 1, 1);
    ctx.globalAlpha = 1;
  } else if (f.k === 'cloud') {
    const x = f.x - CX, y = f.y - CY, a = Math.min(1, f.t * 1.5, (f.max - f.t) * 4);
    ctx.globalAlpha = a * .55; ctx.fillStyle = '#2e5a1c'; ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * .5, 0, 0, 6.283); ctx.fill();
    ctx.globalAlpha = a * .6; ctx.fillStyle = '#79c24e'; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, f.r * .72, f.r * .32, 0, 0, 6.283); ctx.fill();
    ctx.globalAlpha = a; ctx.fillStyle = '#c8f06a'; for (let i = 0; i < 5; i++) { const b = Math.floor(T * 5 + i * 1.7) % 4; ctx.fillRect(Math.round(x + Math.cos(i * 2.4) * f.r * .55), Math.round(y + Math.sin(i * 2.4) * f.r * .22 - b), b ? 2 : 1, b ? 2 : 1); }
    ctx.globalAlpha = 1; addLight(x, y, f.r, .3 * a);
  } else if (f.k === 'heart') {
    const x = Math.round(f.x - CX), y = Math.round(f.y - CY - f.z - (1 - q) * 10);
    ctx.globalAlpha = Math.min(1, q * 2); ctx.fillStyle = '#ff6a8a'; ctx.fillRect(x - 2, y, 2, 1); ctx.fillRect(x + 1, y, 2, 1); ctx.fillRect(x - 2, y + 1, 5, 1); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x, y + 3, 1, 1); ctx.fillStyle = '#ffd0dc'; ctx.fillRect(x - 2, y, 1, 1); ctx.globalAlpha = 1;
  } else if (f.k === 'after') {
    const p = petActive(); if (!p) return; const S = petStripOf(p); if (!S.silp) S.silp = silhouette(S.c, '#b892f4');
    ctx.save(); ctx.globalAlpha = q * .55; ctx.translate(Math.round(f.x - CX), Math.round(f.y - CY - f.z)); ctx.scale(f.face, 1); ctx.drawImage(S.silp, 4 * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H); ctx.restore();
  }
}
function drawPet() {
  const p = petActive(); if (!p || PET_RT.id !== p.id) return;
  const S = petStripOf(p), st = petStage(p.lv), Sp = PET_SP[p.sp], E = PET_EL[Sp.el], x = Math.round(PET_RT.x - CX), y = Math.round(PET_RT.y - CY), z = Math.round(PET_RT.z), sw = Math.max(4, S.W * .3);
  ctx.globalAlpha = .3 * Math.max(.45, 1 - z / 40); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, sw, sw * .38, 0, 0, 6.283); ctx.fill();
  if (st >= 4) { ctx.globalAlpha = .14 + .07 * Math.sin(T * 4); ctx.fillStyle = st === 5 ? '#ffd24a' : E.c; ctx.beginPath(); ctx.ellipse(x, y, sw * 1.5, sw * .55, 0, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  const fi = PET_RT.sleep || (PET_RT.blk > 0 && !PET_RT.mv) ? 8 : (PET_RT.mv ? 4 : 0) + ((Math.floor(PET_RT.ph) % 4) + 4) % 4, sq = PET_RT.atk > 0 ? Math.sin(PET_RT.atk / .22 * Math.PI) * .12 : 0;
  ctx.save(); ctx.translate(x, y - z); ctx.scale(PET_RT.face * (1 + sq), 1 - sq);
  if (p.sp === 'katze') ctx.globalAlpha = .9 + .08 * Math.sin(T * 3);
  ctx.drawImage(S.c, fi * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H);
  if (PET_RT.fl > 0) { if (!S.sil) S.sil = silhouette(S.c, '#ffffff'); ctx.globalAlpha = Math.min(1, PET_RT.fl * 1.6) * .85; ctx.drawImage(S.sil, fi * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H); }
  ctx.restore(); ctx.globalAlpha = 1;
  // Goldkäfer leuchtet wie eine Laterne, Feuer und Blitz glühen
  if (Sp.el === 'licht') addLight(x, y - z - S.H * .4, 40 + st * 6, .8 + .1 * Math.sin(T * 3));
  else if (Sp.el === 'feuer' || Sp.el === 'blitz' || st >= 4 || (G && G.dark)) addLight(x, y - z - S.H * .4, 18 + st * 4, Sp.el === 'schatten' || Sp.el === 'gift' ? .35 : .55);
  if (PET_RT.sleep) { ctx.fillStyle = '#e8f0ff'; for (let i = 0; i < 3; i++) { const t = (T * .5 + i / 3) % 1, zx = x + PET_RT.face * Math.round(S.W * .2) + Math.round(t * 6), zy = y - z - S.ay + 4 - Math.round(t * 14); ctx.globalAlpha = Math.sin(t * Math.PI); ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1); } ctx.globalAlpha = 1; }
}
const PET_DRAW = { y: 0, draw: drawPet };

/* ---------- Andockstellen ---------- */
const PET_UI = { newHero: false, title: false, sel: 'drache', back: null, fed: 0 }, PET_ERR = {};
// Ein Fehler im Begleiter darf das Spiel nie anhalten: einmal melden (Tests sehen ihn), dann weiter
function petSafe(k, fn, def) { return (...a) => { try { return fn(...a); } catch (e) { if (!PET_ERR[k]) { PET_ERR[k] = 1; console.error('Begleiter (' + k + '):', e); } return def; } }; }
HOOK.update.push(petSafe('update', dt => petTick(dt)));
HOOK.room.push(petSafe('room', () => petPlace(false)));
HOOK.kill.push(petSafe('kill', petKill));
HOOK.stats.push(petSafe('stats', add => { const p = petActive(); if (!p) return; const v = petPas(p); for (const k in v) add(k, v[k]); }));
// Giftzahn der Natter: Treffer des Helden vergiften manchmal
HOOK.afterHit.push(petSafe('afterHit', (e, w, dmg) => { if (!e || e.dead || (w && w.pet)) return; const c = mod('pgift'); if (c && Math.random() < c) { e.poison = Math.max(e.poison || 0, 3); e.poisonDmg = Math.max(e.poisonDmg || 0, Math.max(1, Math.round(dmg * .2))); } }));
HOOK.draw.push(petSafe('draw', list => {
  const M = petM(); if (!M || !P) return;
  if (PET_UI.newHero && state === 'map' && !ov.hidden && $('mapcv')) { PET_UI.newHero = false; if (!M.starter) setTimeout(() => { if (state === 'map' && !petM().starter) petStarter('map'); }, 0); }
  const p = petActive(); if (!p) return;
  if ((state === 'title' || state === 'map' || state === 'menu') && T > PET_RT.lt) petTick(Math.min(.05, T - PET_RT.lt));
  if (PET_RT.id !== p.id) return;
  PET_DRAW.y = PET_RT.y; list.push(PET_DRAW);
  for (const b of PET_BOLTS) list.push(b);
  for (const f of PET_FX) list.push(f);
}));
// Neuer Held ohne Begleiter im Konto: direkt nach dem Prolog (erste Weltkarte) wählen
HOOK.activate.push(petSafe('activate', c => { const M = petM(); if (M && !M.starter && c.lv === 1 && !c.xp && !(c.stats && c.stats.kills) && Date.now() - (c.created || 0) < 15000) PET_UI.newHero = true; }));
// Bestehende Spieler: nach dem Update gleich im Titelmenü (nach den Neuigkeiten)
HOOK.boot.push(petSafe('boot', () => { const M = petM(); if (!M || M.starter || !SAVE.chars.length) return; if (panel.querySelector('details.news')) PET_UI.title = true; else if (state === 'title') petStarter('title'); }));
HOOK.titleBtns.push(petSafe('title', () => {
  const M = petM(); if (!M || M.starter || !SAVE.chars.length) return '';
  if (PET_UI.title) { PET_UI.title = false; setTimeout(() => { if (state === 'title' && !petM().starter) petStarter('title'); }, 0); }
  return `<button class="btn" data-act="petstart" data-id="title">${_t('Begleiter wählen')}<span class="badge">${_t('NEU')}</span></button>`;
}, ''));
HOOK.mapMore.push(petSafe('map', () => { const M = petM(); return M && !M.starter ? `<button class="btn" data-act="petstart" data-id="map">${_t('Begleiter wählen')}</button>` : ''; }, ''));

/* ---------- Oberfläche ---------- */
document.head.insertAdjacentHTML('beforeend', '<style>' +
  '.petcard{display:flex;flex-wrap:wrap;gap:12px;align-items:center}' +
  '.petprev{flex:none;position:relative;display:flex;align-items:flex-end;justify-content:center;background:radial-gradient(ellipse at 50% 78%,var(--pg) 0,var(--stone-lo) 72%);box-shadow:inset 0 0 0 2px var(--stone-hi)}' +
  '.petprev:after{content:"";position:absolute;left:27%;right:27%;bottom:10px;height:8px;background:rgba(0,0,0,.35);border-radius:50%}' +
  '.petprev .spr,.pcard .spr{position:relative;z-index:1;margin:0 0 14px;animation:petan .8s steps(4) infinite}' +
  '.petprev .spr.fly,.pcard .spr.fly{margin-bottom:30px;animation:petan .45s steps(4) infinite,petbob 1.8s ease-in-out infinite}' +
  '.petprev.yum .spr{animation:petan .8s steps(4) infinite,petyum .5s ease-out 1}' +
  '@keyframes petan{from{background-position-x:0}to{background-position-x:var(--to)}}' +
  '@keyframes petbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
  '@keyframes petyum{0%{transform:none}40%{transform:translateY(-14px) scale(1.1)}100%{transform:none}}' +
  '.petinfo{flex:1 1 190px;min-width:0}.petnm{font-size:28px;line-height:1;overflow-wrap:anywhere}' +
  '.pel{display:inline-block;font-family:var(--f-display);font-size:7px;padding:4px 5px;color:var(--night);vertical-align:2px}' +
  '.pbar{height:9px;background:var(--night);box-shadow:0 0 0 2px var(--stone-hi);margin:8px 0 4px}.pbar i{display:block;height:100%;background:var(--c,#8a7ad8)}.pbar.thin{height:5px;margin-top:9px}' +
  '.slot:disabled{opacity:.35;cursor:default}.slot.fav{box-shadow:inset 0 0 0 2px #ff8aa8}.sw:disabled{opacity:.3;cursor:default}' +
  '.row.lock{opacity:.5}.row .ic.plv{font-family:var(--f-display);font-size:7px;line-height:1.6;text-align:center;color:var(--gold)}' +
  '.ic.wob img{animation:petwob 1s ease-in-out infinite}@keyframes petwob{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}' +
  '.pcards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:4px 0 0}' +
  '.pcard{display:flex;flex-direction:column;align-items:center;gap:5px;border:0;background:var(--stone-lo);padding:8px 5px 10px;cursor:pointer;text-align:center;min-width:0}' +
  '.pcard.sel{background:var(--stone-hi);box-shadow:inset 0 0 0 3px var(--gold)}.pcard .pp{display:flex;align-items:flex-end;justify-content:center;min-height:var(--ph)}' +
  '.pcard b{font-family:var(--f-display);font-weight:400;font-size:7px;color:var(--gold);overflow-wrap:anywhere}.pcard small{font-size:16px;line-height:1.05;color:var(--parch-dim)}' +
  '@media (prefers-reduced-motion:reduce){.petprev .spr,.pcard .spr,.ic.wob img{animation-duration:1.6s}}' +
  '</style>');
let petView = null, petAmt = 1, petRen = false, petRel = false;
function petViewed() { const M = petM(); return (M && (M.list.find(x => x.id === petView) || petActive() || M.list[0])) || null; }
function petSprHTML(U, sc, fly) { return `<i class="spr${fly ? ' fly' : ''}" style="width:${U.W * sc}px;height:${U.H * sc}px;background-image:url(${U.url});background-size:${U.W * 4 * sc}px ${U.H * sc}px;--to:-${U.W * 4 * sc}px"></i>`; }
const PET_PASTXT = { dmg: v => _t('+{v} Schaden', { v }), critdmg: v => _t('+{v} Krit-Schaden', { v }), gold: v => _t('+{v} Gold', { v }), loot: v => _t('+{v} Beute', { v }), xp: v => _t('+{v} Erfahrung', { v }), pgift: v => _t('{v} Giftchance bei deinen Treffern', { v }), aspd: v => _t('+{v} Angriffstempo', { v }) };
function petPasText(v) { const r = []; for (const k in v) r.push(PET_PASTXT[k](pct(v[k]))); return r.join(', '); }

/* Auswahl des ersten Begleiters (Dialog wie die Geschichte: „Weiter“ bestätigt) */
function petStarter(back) {
  const M = petM(); if (!M || M.starter) return;
  if (back) PET_UI.back = back; if (!PET_STARTERS.includes(PET_UI.sel)) PET_UI.sel = PET_STARTERS[0];
  const sc = innerHeight < 520 ? 3 : 4, Sl = PET_SP[PET_UI.sel], B = SPEAKERS.borin, ph = Math.max(...PET_STARTERS.map(sp => petImgURL(sp, 0, 0, false, true).H * sc + (PET_SP[sp].fly ? 44 : 14)));
  const cards = PET_STARTERS.map(sp => { const S = PET_SP[sp], U = petImgURL(sp, 0, 0, false, true), E = PET_EL[S.el]; return `<button class="pcard${PET_UI.sel === sp ? ' sel' : ''}" data-act="petpick" data-id="${sp}" aria-label="${S.n}"><span class="pp" style="--ph:${ph}px">${petSprHTML(U, sc, S.fly)}</span><b>${S.n.toLocaleUpperCase(LOCALE)}</b><span class="pel" style="background:${E.c}">${E.n}</span><small>${S.st}</small><small style="color:var(--parch)">${_t('Später: {a} und {b}', { a: S.pn, b: S.sn })}</small></button>`; }).join('');
  showOverlay(`<div class="petstart"><h2 class="center">${_t('EIN TREUER GEFÄHRTE')}</h2>
  <div class="say" style="margin-top:8px"><img class="px" src="${iconURL(['sp', B.sp])}" alt=""><div><b style="color:${B.c}">${B.n}</b>${_t('„Allein kommt hier keiner weit. Such dir einen aus – er kämpft an deiner Seite, sammelt Beute und wächst mit dir.“')}</div></div>
  <div class="pcards">${cards}</div><div class="menu foot"><button class="btn" data-act="dlgnext">${_t('Mit {name} losziehen', { name: Sl.n })}</button></div></div>`, true);
  DLG = { next: petStartOk, skip: petStartOk };
}
function petStartOk() {
  const M = petM(); DLG = null;
  if (!M || M.starter || !panel.querySelector('.petstart')) return;
  const sp = PET_UI.sel, p = petGive(sp, {}); M.starter = true;
  if (p) { M.act = p.id; petView = p.id; toast(_t('{name} schließt sich dir an!', { name: PET_SP[sp].n }), PET_EL[PET_SP[sp].el].c); }
  persist(); if (P && P.st) computeStats(); petPlace(false); sfx('ach');
  const b = PET_UI.back; PET_UI.back = null;
  if (b === 'map') openMap(); else if (b === 'char') openChar('pet'); else showTitle();
}
function petEggsHTML(M) {
  const full = M.list.length >= PET_MAX;
  return `<h3>${_t('EIER {n}/{max}', { n: M.eggs.length, max: EGG_MAX })}</h3>` + (M.eggs.length ? M.eggs.map((g, i) => {
    const q = g.got / g.need, ready = g.got >= g.need;
    return `<div class="row" style="cursor:default"><div class="ic${q >= .75 ? ' wob' : ''}"><img src="${eggURL(g.sp, q >= .85 ? 2 : q >= .5 ? 1 : 0)}" alt=""></div><div><div class="nm">${_t('{name}-Ei', { name: PET_SP[g.sp].n })}</div><div class="pbar" style="--c:${PET_EL[PET_SP[g.sp].el].c}"><i style="width:${(q * 100).toFixed(1)}%"></i></div><div class="st">${ready ? (full ? _t('Bereit – aber du hast schon {n} Begleiter.', { n: PET_MAX }) : _t('Es wackelt und knackt – bereit!')) : _t('{a}/{b} Siege bis zum Schlüpfen', { a: g.got, b: g.need })}</div></div>${ready && !full ? `<button class="btn sm" data-act="pethatch" data-i="${i}">${_t('Schlüpfen!')}</button>` : '<span></span>'}</div>`;
  }).join('') : `<p class="sub" style="margin-top:0">${_t('Noch keine Eier. Bosse lassen manchmal eines fallen (in der Qual öfter), ebenso die Drachentruhe im Glückstempel.')}</p>`);
}
/* Charakter-Reiter BEGLEITER */
function petTabHTML() {
  const M = petM(); if (!M) return '';
  if (!M.starter) return `<div class="box center"><p class="sub">${_t('Du hast noch keinen Begleiter. Such dir einen aus – er kämpft an deiner Seite, sammelt Beute und wächst mit dir.')}</p><button class="btn" data-act="petstart" data-id="char">${_t('Begleiter wählen')}</button></div>`;
  const p = petViewed();
  if (!p) return `<p class="sub">${_t('Gerade begleitet dich niemand. Eier gibt es von Bossen und aus der Drachentruhe im Glückstempel.')}</p>${petEggsHTML(M)}`;
  if (p.nw) { p.nw = 0; persist(); }
  petView = p.id;
  const S = PET_SP[p.sp], st = petStage(p.lv), E = PET_EL[S.el], act = M.act === p.id, sc = 4, U = petURL(p, true), need = petNeed(p.lv), nx = PET_STAGE.find(l => l > p.lv), q = p.lv >= 100 ? 1 : p.xp / need;
  const prev = `<div class="petprev${Date.now() - PET_UI.fed < 700 ? ' yum' : ''}" style="width:${Math.max(132, U.W * sc + 24)}px;height:${Math.max(120, U.H * sc + (S.fly ? 46 : 30))}px;--pg:${st >= 4 ? `rgba(${E.rgb},.45)` : 'var(--stone-hi)'}">${petSprHTML(U, sc, S.fly)}</div>`;
  const info = `<div class="petinfo"><div class="petnm">${esc(petName(p))}${p.shiny ? ' <span style="color:#ff9af0">✦</span>' : ''}</div>
    <div class="st" style="font-size:17px;margin-top:5px">${p.nm ? S.n + ' · ' : ''}${PET_STN[st]} · <span class="pel" style="background:${E.c}">${E.n}</span></div>
    <div class="stats" style="margin:8px 0 0"><span>${_t('LV {lv}', { lv: p.lv })}</span><span>${_t('SIEGE {n}', { n: fmt(p.k || 0) })}</span>${act ? `<span style="color:var(--moss)">${_t('BEGLEITET DICH')}</span>` : ''}</div>
    <div class="pbar" style="--c:${E.c}"><i style="width:${(q * 100).toFixed(1)}%"></i></div>
    <div class="st">${p.lv >= 100 ? _t('Höchste Stufe – ein mythischer Gefährte!') : _t('EP {a}/{b} bis LV {lv}', { a: fmt(p.xp), b: fmt(need), lv: p.lv + 1 })}</div>
    ${nx ? `<div class="pbar thin" style="--c:var(--gold)"><i style="width:${((p.lv - PET_STAGE[st]) / (nx - PET_STAGE[st]) * 100).toFixed(1)}%"></i></div><div class="st">${_t('Nächste Entwicklung: {stage} ab LV {lv}', { stage: PET_STN[petStage(nx)], lv: nx })}</div>` : ''}
    <div class="acts" style="justify-content:flex-start;margin-top:8px">${act ? `<button class="btn alt sm" data-act="petact" data-id="${p.id}">${_t('Zurücklassen')}</button>` : `<button class="btn sm" data-act="petact" data-id="${p.id}">${_t('Mitnehmen')}</button>`}<button class="btn alt sm" data-act="petren">${_t('Umbenennen')}</button>${petRel ? `<button class="btn red sm" data-act="petrelok">${_t('Wirklich freilassen?')}</button><button class="btn alt sm" data-act="petrelno">${_t('Nein')}</button>` : `<button class="btn alt sm" data-act="petrel" ${M.list.length > 1 ? '' : 'disabled'}>${_t('Freilassen')}</button>`}</div></div>`;
  const ren = petRen ? `<div class="acts" style="justify-content:flex-start;flex-wrap:nowrap;margin-top:10px"><input type="text" id="petnm" maxlength="14" value="${esc(p.nm)}" placeholder="${esc(S.n)}" style="flex:1;min-width:0"><button class="btn sm" data-act="petrenok">${_t('OK')}</button></div>` : '';
  const cols = petCols(p), V = petVariants(p.sp);
  const sws = [0, 1, 2, 3, 4, 5].map(c => { const j = (c - p.c0 + 6) % 6, ok = cols.includes(c), pl = petPal(p.sp, c); return `<button class="sw${p.col === c ? ' sel' : ''}" data-act="petcol" data-i="${c}" ${ok ? '' : 'disabled'} title="${ok ? V[c].n : _t('{n} – ab LV {lv}', { n: V[c].n, lv: PET_STAGE[j] })}" aria-label="${V[c].n}" style="background:linear-gradient(135deg,rgb(${pl.m2}) 55%,rgb(${pl.m0}) 55%)"></button>`; }).join('')
    + (p.shiny ? `<button class="sw${p.col === 6 ? ' sel' : ''}" data-act="petcol" data-i="6" title="${_t('Schillernd')}" aria-label="${_t('Schillernd')}" style="background:linear-gradient(135deg,#ff9af0,#9ad0ff 40%,#c8f06a 70%,#ffe08a)"></button>` : '');
  const wd = playerW().dmg, pv = petPas(p), pmax = petPas({ sp: p.sp, lv: 100 }), pmin = petPas({ sp: p.sp, lv: 25 });
  const rows = [
    [1, S.an, S.ad + ' ' + _t('Schaden {d} ({p} deiner Waffe), alle {s} s.', { d: Math.round(wd * petDmgK(p.lv)), p: pct(petDmgK(p.lv)), s: petAtkCd(p).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) })],
    [10, _t('Beutemagnet'), _t('Zieht Münzen, Material und Edelsteine aus {r} Schritt Entfernung zu dir.', { r: Math.round(petMagR(Math.max(10, p.lv))) })],
    [25, S.pn, p.lv >= 25 ? _t('Jetzt: {now}. Bei LV 100: {max}.', { now: petPasText(pv), max: petPasText(pmax) }) : _t('{min}, wächst bis LV 100 auf {max}.', { min: petPasText(pmin), max: petPasText(pmax) })],
    [50, S.sn, S.sd + ' ' + _t('Alle {s} s.', { s: petSpecCd(Math.max(50, p.lv)) })],
    [75, _t('Uralte Kraft'), _t('Spezialangriff ×1,5 und alle 16 s, leuchtende Aura.')],
    [100, _t('Mythische Kraft'), _t('Spezialangriff ×2 und alle 12 s, goldene Gestalt.')]
  ].map(([l, n, d]) => `<div class="row${p.lv < l ? ' lock' : ''}" style="cursor:default"><div class="ic plv">${_t('LV')}<br>${l}</div><div><div class="nm">${n}</div><div class="st">${d}</div></div><span></span></div>`).join('');
  const feed = `<h3>${_t('FÜTTERN')}</h3><p class="sub" style="margin-top:0">${p.lv >= 100 ? _t('Satt und mythisch – mehr geht nicht.') : _t('Übriges Material wird zu Erfahrung. Leibspeise: {mat} (doppelte EP).', { mat: MATS[S.fav].n })}</p>
    <div class="opts">${[1, 10, 100].map(n => `<button class="opt${petAmt === n ? ' sel' : ''}" data-act="petamt" data-i="${n}">×${n}</button>`).join('')}</div>
    <div class="grid">${MATORDER.map(k => { const n = P.mats[k] || 0, fav = k === S.fav; return `<button class="slot${fav ? ' fav' : ''}" data-act="petfeed" data-id="${k}" ${n && p.lv < 100 ? '' : 'disabled'} title="${MATS[k].n}" aria-label="${MATS[k].n}"><img src="${iconURL(['mat', k])}" alt=""><span class="u">+${fmt(PET_FEED[k] * (fav ? 2 : 1))}</span><span class="n">${n}</span></button>`; }).join('')}</div>`;
  const list = `<h3>${_t('DEINE BEGLEITER {n}/{max}', { n: M.list.length, max: PET_MAX })}</h3>` + M.list.map(o => `<button class="row${o.id === p.id ? ' sel' : ''}${o.id === M.act ? ' eq' : ''}" data-act="petsel" data-id="${o.id}"><div class="ic"><img src="${petURL(o).url}" alt=""></div><div><div class="nm">${esc(petName(o))}${o.shiny ? ' ✦' : ''}${o.nw ? `<span class="badge">${_t('NEU')}</span>` : ''}</div><div class="st">${o.nm ? PET_SP[o.sp].n + ' · ' : ''}${_t('LV {lv}', { lv: o.lv })} · ${PET_STN[petStage(o.lv)]} · ${petColName(o.sp, o.col)}</div></div>${o.id === M.act ? `<span class="pill">${_t('AKTIV')}</span>` : '<span></span>'}</button>`).join('');
  return `<div class="split"><div><div class="box"><div class="petcard">${prev}${info}</div>${ren}<h3>${_t('FARBE')} · ${petColName(p.sp, p.col)}</h3><div class="sws">${sws}</div><p class="sub" style="margin:4px 0 0">${_t('Jede Entwicklungsstufe schaltet eine neue Farbe frei.')}</p></div><h3>${_t('FÄHIGKEITEN')}</h3>${rows}</div><div>${feed}${petEggsHTML(M)}${list}</div></div>`;
}
HOOK.charTabs.push({ k: 'pet', label: petSafe('label', () => _t('BEGLEITER') + (petNews() ? ' (!)' : ''), 'BEGLEITER'), body: petSafe('tab', petTabHTML, '') });

/* ---------- Knöpfe ---------- */
ON.petstart = id => petStarter(id || 'title');
ON.petpick = id => { if (PET_STARTERS.includes(id)) PET_UI.sel = id; sfx('click'); petStarter(); };
ON.petsel = id => { petView = id; petRen = petRel = false; sfx('click'); openChar('pet'); };
ON.petact = id => { const M = petM(); M.act = M.act === id ? null : id; persist(); computeStats(); petPlace(false); sfx('click'); openChar('pet'); };
ON.petren = () => { petRen = !petRen; petRel = false; openChar('pet'); const el = $('petnm'); if (el && !isTouch) el.focus(); };
ON.petrenok = () => { const p = petViewed(), el = $('petnm'); if (p && el) { p.nm = el.value.replace(/[<>]/g, '').trim().slice(0, 14); if (p.nm === PET_SP[p.sp].n) p.nm = ''; persist(); sfx('click'); } petRen = false; openChar('pet'); };
ON.petcol = (id, b, i) => { const p = petViewed(); if (p && petCols(p).includes(i)) { p.col = i; persist(); sfx('click'); } openChar('pet'); };
ON.petamt = (id, b, i) => { petAmt = [1, 10, 100].includes(i) ? i : 1; sfx('click'); openChar('pet'); };
ON.petfeed = id => {
  const p = petViewed(); if (!p || !P || !MATS[id]) return;
  const n = Math.min(petAmt, P.mats[id] || 0); if (n <= 0 || p.lv >= 100) { sfx('deny'); return; }
  P.mats[id] -= n; const fav = PET_SP[p.sp].fav === id, xp = PET_FEED[id] * n * (fav ? 2 : 1), s0 = petStage(p.lv), l0 = p.lv;
  petXP(p, xp, true); PET_UI.fed = Date.now(); petSnd('feed'); saveChar();
  if (petStage(p.lv) === s0) toast((fav ? _t('Leibspeise! {name} verschlingt {n}× {mat}: +{xp} EP', { name: petName(p), n, mat: MATS[id].n, xp: fmt(xp) }) : _t('{name} frisst {n}× {mat}: +{xp} EP', { name: petName(p), n, mat: MATS[id].n, xp: fmt(xp) })) + (p.lv > l0 ? ' · ' + _t('LV {lv}!', { lv: p.lv }) : ''), fav ? '#ff8aa8' : '#ffd24a');
  openChar('pet');
};
ON.petrel = () => { petRel = true; petRen = false; openChar('pet'); };
ON.petrelno = () => { petRel = false; openChar('pet'); };
ON.petrelok = () => {
  const M = petM(), p = petViewed(); petRel = false; if (!p || M.list.length <= 1) { openChar('pet'); return; }
  const n = 1 + Math.floor(p.lv / 25), nm = petName(p); petExport(M.list.indexOf(p)); petView = null; gainFate(n); saveChar(); sfx('page');
  toast(n === 1 ? _t('{name} zieht in die Freiheit und lässt dir 1 Glücksmünze da.', { name: nm }) : _t('{name} zieht in die Freiheit und lässt dir {n} Glücksmünzen da.', { name: nm, n }), '#ffd24a');
  openChar('pet');
};
ON.pethatch = (id, b, i) => { const p = eggHatch(i, true); if (p) petView = p.id; openChar('pet'); };
