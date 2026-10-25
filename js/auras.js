'use strict';
/* =========================================================
   KLINGENHORT – Aussehen der Beute – einzigartige Optik für besondere Gegenstände, Auren und Effekte am Helden
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein.
   Legendär → schwaches Leuchten in der Farbe des Gegenstands, volles Set (3 Teile) → Set-Aura,
   Mythisch → eigene starke Wirkung. Waffen ab Episch leuchten in der Hand und ziehen einen Schweif.
   Gezeichnet wird in drei Schichten: Boden (HOOK.draw, hinter dem Helden), am Körper (auraSprite aus drawActor),
   Leuchten (HOOK.postRender, additiv). „Wackeln & Blitzen: AUS“ (calm) und reduzierte Bewegung dämpfen alles.
   Gegenstandsbilder selbst: js/art.js (ITEMLOOK), Beute am Boden: drawLoot in js/render.js
   ========================================================= */

const AURA = {
  leg: { n: _t('Legendäres Leuchten') },
  lion: { n: _t('Goldene Löwenmähne') }, glut: { n: _t('Glutfunken') }, nacht: { n: _t('Nachtschattennebel') }, wald: { n: _t('Wirbelnde Blätter') }, drache: { n: _t('Drachenglut') },
  klinge: { n: _t('Kettenblitze') }, zorn: { n: _t('Lodernde Flammen') }, ernter: { n: _t('Seelenlichter') }, phoenix: { n: _t('Feuerflügel') },
  dornen: { n: _t('Dornenranken') }, krone: { n: _t('Heiligenschein') }, eisherz: { n: _t('Frostnebel') }, midas: { n: _t('Goldglanz') }
};

/* ---------- Welche Aura trägt der Held? ---------- */
let AU = null, AUk = '';
function auraOf(c) {
  const g = (c && c.gear) || {}, r = { leg: [], set: null, myth: [], w: null }, sets = {};
  for (const s of ['weapon', 'armor', 'helm']) {
    const it = g[s]; if (!it) continue;
    if (it.rar === 6 && it.myth && AURA[it.myth]) r.myth.push(it.myth);
    else if (it.rar === 4) { const L = itemLook(it); r.leg.push(L ? L.acc : RAR[4].c); }
    if (it.set) sets[it.set] = (sets[it.set] || 0) + 1;
  }
  for (const k in sets) if (sets[k] >= 3 && AURA[k]) r.set = k;
  const w = g.weapon; if (w && w.rar >= 3) { const L = itemLook(w); r.w = { col: L ? L.acc : RAR[clamp(w.rar, 0, 6)].c, rar: w.rar, melee: !WT[w.base] || !WT[w.base].ranged }; }
  r.any = !!(r.leg.length || r.set || r.myth.length || r.w);
  return r;
}
// einmal je Bild; neu berechnet, sobald sich Held oder Ausrüstung ändern
let AUnT = -1, AUn = null, AUp = null;
function auraNow() {
  if (!P || !P.gear) return null;
  if (AUnT === T && P === AUp) return AUn;
  AUnT = T; AUp = P;
  const g = P.gear, k = ['weapon', 'armor', 'helm'].map(s => g[s] ? g[s].uid + g[s].rar + (g[s].myth || '') + (g[s].set || '') : '-').join('|');
  if (k !== AUk) { AUk = k; AU = auraOf(P); }
  return AUn = AU.any ? AU : null;
}
// Zeile in der Gegenstandsbeschreibung
HOOK.itemLines.push((it, L) => {
  if (it.rar === 6 && it.myth && AURA[it.myth]) L.push(_t('✧ Aura: {n}', { n: AURA[it.myth].n }));
  else if (it.rar === 5 && it.set && AURA[it.set]) L.push(_t('✧ Set-Aura mit allen 3 Teilen: {n}', { n: AURA[it.set].n }));
  else if (it.rar === 4) L.push(_t('✧ Aura: {n}', { n: AURA.leg.n }));
});

/* ---------- Helfer ---------- */
const AU_RM = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { return null; } })();
const auCalm = () => !!((SAVE && SAVE.meta.settings.calm) || (AU_RM && AU_RM.matches));
const AUGLOW = {};
// weicher runder Schein (einmal je Farbe gezeichnet, danach nur noch kopiert)
function auGlow(col) { return AUGLOW[col] || (AUGLOW[col] = mk(32, 32, g => { const [r, gg, b] = hexRgb(col), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(.45, `rgba(${r},${gg},${b},.45)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); })); }
function auBlob(col, x, y, rx, ry, a) { if (a <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(auGlow(col), Math.round(x - rx), Math.round(y - ry), Math.round(rx * 2), Math.round(ry * 2)); ctx.globalAlpha = 1; }
function auPx(x, y, s, col, a) { ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), s, s); }
// Partikel-Ausstoß nach Zeit (läuft auch im Titel und im Versteck), gedämpft bei Ruhe
const AUE = {}; let AUt = 0, AUdt = 0;
function auEmit(k, rate, fn) { const a = (AUE[k] || 0) + rate * AUdt * (auCalm() ? .35 : 1); let n = Math.floor(a); AUE[k] = a - n; while (n-- > 0) fn(); }
const auLive = () => state === 'play' || state === 'title' || state === 'menu' || state === 'map';
const auShown = () => P && bg && (state !== 'dead' || deadT > 1.4) && !P.leap;
// Stärke: Tarnung (Rauchbombe) blendet aus
const auK = () => (P.stealth > 0 ? .25 : 1) * (auCalm() ? .7 : 1);

/* ---------- Schicht 1: Boden, hinter dem Helden ---------- */
const AUSOUL = [], AUARC = { t: 0, next: 0, pts: null }, AUTRAIL = [];
// Ring aus Pixeln am Boden (vorne heller), dreht sich langsam; d = jedes wievielte Pixel fehlt (Striche)
function auRing(x, y, rx, ry, n, c1, c2, a, rot, d) { for (let i = 0; i < n; i++) { if (d && i % d === 0) continue; const t = i / n * 6.283 + rot, s = Math.sin(t); auPx(x + Math.cos(t) * rx, y + s * ry, 1, s > 0 ? c1 : c2, a * (s > 0 ? 1 : .6)); } ctx.globalAlpha = 1; }
// farbiger Umriss des Helden: Mythisch > volles Set > Legendär
const AUEDGE = { lion: '#ffc04a', glut: '#ff8a3a', nacht: '#b07ae8', wald: '#79c24e', drache: '#ff5a2a' };
function auraEdge() {
  const A = auraNow(); if (!A) return null;
  if (A.myth.length) { const L = ITEMLOOK['m:' + A.myth[0]], i = Math.floor(T * (auCalm() ? 1 : 3)) % L.cyc.length; return L.cyc[i][2]; }
  if (A.set) return AUEDGE[A.set];
  return A.leg.length ? A.leg[0] : null;
}
function auraBack() {
  AUdt = clamp(T - AUt, 0, .1); AUt = T;
  const A = auraNow(); if (!A || !auShown()) return;
  const x = P.x - CX, y = P.y - CY, k = auK(), sp = auCalm() ? .35 : 1, live = auLive(), H = (P.hand && P.hand.top) || 22, rot = T * sp;
  const em = (key, rate, fn) => { if (live) auEmit(key, rate, fn); };
  // Legendär: Ring und Schein am Boden in der Farbe des Gegenstands, aufsteigende Funken
  if (A.leg.length && !A.set && !A.myth.length) {
    const c = A.leg[0]; auBlob(c, x, y, 13, 5, (.28 + .06 * A.leg.length) * k * (.85 + .15 * Math.sin(T * 2 * sp)));
    auRing(x, y, 11, 4.5, 22, c, mixC(c, '#000000', .3), .75 * k, rot * .7, 4);
    em('leg', 2.5 + A.leg.length, () => part(P.x + rnd(-9, 9), P.y + rnd(-2, 2), rnd(0, 10), 0, 0, rnd(14, 28), pick(A.leg), rnd(.5, .9), 1, -4, 1));
    addLight(x, y - 6, 30 + 6 * A.leg.length, .45);
  }
  // Set-Auren
  const S = A.set;
  if (S === 'lion') {
    auBlob('#ffc04a', x, y, 16, 6, .38 * k); auRing(x, y, 15, 6, 30, '#ffe08a', '#c8902a', .9 * k, rot * .8, 3); auRing(x, y, 9, 3.5, 16, '#fff3c0', '#e8b04a', .7 * k, -rot, 2);
    em('lion', 4, () => part(P.x + rnd(-10, 10), P.y + rnd(-3, 3), rnd(0, 6), 0, 0, rnd(16, 30), pick(['#ffe08a', '#ffc04a', '#fff3c0']), rnd(.6, 1), 1, -4, 1));
    addLight(x, y - 6, 44, .6);
  } else if (S === 'glut') {
    auBlob('#ff6a2a', x, y, 15, 6, .38 * k);
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 - rot * .5, f = Math.floor(T * 10 * sp + i * 3) % 3; auPx(x + Math.cos(a) * 14, y + Math.sin(a) * 5.5 - (f === 0 ? 1 : 0), f === 0 ? 2 : 1, f ? '#ff8a3a' : '#ffd24a', .9 * k); }
    em('glut', 8, () => part(P.x + rnd(-10, 10), P.y + rnd(-3, 3), rnd(0, 8), rnd(-6, 6), 0, rnd(20, 40), pick(['#ff6a2a', '#ff9a2a', '#ffd24a']), rnd(.5, 1), 1, -10, 1));
    addLight(x, y - 6, 46, .6);
  } else if (S === 'nacht') {
    for (let i = 0; i < 4; i++) { const a = T * .7 * sp + i * 1.57; auBlob('#1e1030', x + Math.cos(a) * 8, y + Math.sin(a) * 3, 10, 4, .7 * k); }
    auRing(x, y, 13, 5, 26, '#9a5ad8', '#4a2a7a', .8 * k, -rot * .5, 3);
    em('nacht', 4, () => part(P.x + rnd(-10, 10), P.y + rnd(-2, 2), rnd(0, 6), 0, 0, rnd(6, 14), pick(['#79e04a', '#b892f4', '#c8f06a']), rnd(.7, 1.2), 1, -2, 1));
  } else if (S === 'wald') {
    auBlob('#79c24e', x, y, 13, 5, .28 * k); auRing(x, y, 12, 5, 24, '#79c24e', '#3a8a2a', .75 * k, rot * .4, 3);
    for (let i = 0; i < 6; i++) { const a = T * (1.4 + i * .15) * sp + i * 1.05, h = 4 + ((i * 5) % 16) + Math.sin(T * 2 * sp + i) * 2, lx = x + Math.cos(a) * 12, ly = y - h + Math.sin(a) * 4; if (Math.sin(a) < -.3) continue; auPx(lx, ly, 2, i % 2 ? '#3a8a2a' : '#79c24e', k); auPx(lx + (Math.cos(a) > 0 ? 1 : 0), ly, 1, '#c8f06a', k); }
    em('wald', 2, () => part(P.x + rnd(-12, 12), P.y + rnd(-2, 2), rnd(14, 26), rnd(-8, 8), 0, 0, pick(['#79c24e', '#3a8a2a', '#c8f06a']), rnd(1, 1.6), 2, 14));
  } else if (S === 'drache') {
    auBlob('#d8402a', x, y, 24, 10, .3 * k);
    for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283 + rot * .25, f = (Math.floor(T * 9 * sp) + i) % 4; auPx(x + Math.cos(a) * 38, y + Math.sin(a) * 15 - (f === 0 ? 2 : f === 1 ? 1 : 0), 1, f === 0 ? '#ffd24a' : f === 1 ? '#ff8a3a' : '#c8301e', .7 * k); }
    auRing(x, y, 12, 5, 20, '#ffb03a', '#a8201a', .8 * k, rot * .6, 0);
    em('drache', 5, () => part(P.x + rnd(-12, 12), P.y + rnd(-3, 3), rnd(0, 8), 0, 0, rnd(20, 36), pick(['#ff6a2a', '#ffb03a', '#d8402a']), rnd(.5, .9), 1, -8, 1));
    addLight(x, y - 6, 52, .6);
  }
  // Mythisch
  for (const m of A.myth) {
    if (m === 'phoenix') {
      auBlob('#ff8a3a', x, y, 18, 7, .45 * k); auRing(x, y, 14, 5.5, 26, '#ffd24a', '#c8301e', .85 * k, rot, 0);
      em('phx', 10, () => part(P.x - P.turn * rnd(4, 18), P.y + rnd(-2, 2), rnd(10, 28), -P.turn * rnd(0, 12), 0, rnd(-4, 12), pick(['#ffd24a', '#ff8a3a', '#ff5a2a', '#fff0a0']), rnd(.4, .8), 1, 30, 1));
      addLight(x, y - 12, 60, .8);
    } else if (m === 'eisherz') {
      for (let i = 0; i < 5; i++) { const a = T * .5 * sp + i * 1.26; auBlob('#e8faff', x + Math.cos(a) * 11, y + Math.sin(a) * 3.5, 10, 3.5, .45 * k); }
      auRing(x, y, 13, 5, 18, '#ffffff', '#8ad8ff', .9 * k, rot * .3, 0);
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283 + rot * .15; if (i % 2) auPx(x + Math.cos(a) * 52, y + Math.sin(a) * 21, 1, '#bfefff', .45 * k); }
      em('eis', 6, () => part(P.x + rnd(-16, 16), P.y + rnd(-4, 4), rnd(18, 32), rnd(-4, 4), 0, 0, pick(['#ffffff', '#bfefff', '#8ad8ff']), rnd(1, 1.6), 1, 10, 1));
      addLight(x, y - 8, 50, .6);
    } else if (m === 'midas') {
      auBlob('#ffd24a', x, y, 15, 6, .4 * k); auRing(x, y, 13, 5, 26, '#fff3c0', '#c8902a', .85 * k, rot * .6, 2);
      em('midas', 3, () => part(P.x + rnd(-10, 10), P.y + rnd(-3, 3), rnd(10, 24), 0, 0, 0, pick(['#ffd24a', '#fff3c0']), rnd(.5, .8), 2, 60, 1));
      addLight(x, y - 8, 48, .6);
    } else if (m === 'ernter') {
      auBlob('#1e5a4a', x, y, 15, 6, .5 * k); auRing(x, y, 13, 5, 24, '#9affd8', '#2a8a6a', .8 * k, -rot * .7, 3);
      em('ernt', 3, () => part(P.x + rnd(-10, 10), P.y + rnd(-2, 2), rnd(0, 6), 0, 0, rnd(8, 16), pick(['#9affd8', '#3ac8a0']), rnd(.6, 1), 1, -3, 1));
      addLight(x, y - 8, 44, .5);
    } else if (m === 'klinge') {
      auBlob('#8ab0ff', x, y, 15, 6, .35 * k); auRing(x, y, 13, 5, 24, '#ffffff', '#4a6ad8', .85 * k, rot * 1.2, 4); addLight(x, y - 8, 46, .6);
    } else if (m === 'dornen') {
      const hit = P.thornT > T ? 1 : 0;
      auBlob(hit ? '#e8402a' : '#8a1e10', x, y, 17, 7, (hit ? .6 : .35) * k);
      for (let i = 0; i < 30; i++) { const a = i / 30 * 6.283, c = Math.cos(a), sn = Math.sin(a), px_ = x + c * 14, py_ = y + sn * 5.5; auPx(px_, py_, 1, i % 2 ? '#4a6a2a' : '#5a3a1e', k); auPx(px_, py_ + 1, 1, '#2a3a1a', k); if (i % 3 === 0) { const o = 1 + hit; auPx(px_ + c * o, py_ + sn * o - 1, 1, '#4a6a2a', k); auPx(px_ + c * (o + 1), py_ + sn * (o + 1) - 2, 1, hit ? '#ffb0a0' : '#ff4a3a', k); } }
      ctx.globalAlpha = 1; addLight(x, y - 6, 36, .4);
    } else if (m === 'krone') {
      auBlob('#ffe08a', x, y, 15, 6, .35 * k); auRing(x, y, 13, 5, 28, '#ffffff', '#e8b04a', .8 * k, rot * .4, 0);
      em('krone', 3, () => part(P.x + rnd(-12, 12), P.y + rnd(-3, 3), rnd(4, 22), 0, 0, rnd(6, 14), pick(['#fffbe0', '#ffe08a']), rnd(.6, 1), 1, -2, 1));
      addLight(x, y - H, 56, .7);
    } else if (m === 'zorn') {
      auBlob('#c8301e', x, y, 15, 6, .4 * k); auRing(x, y, 13, 5, 22, '#ff8a3a', '#8a1e10', .85 * k, -rot, 0);
      const q = P.wq; if (q && q.len > 2) em('zorn', 14, () => { const t = rnd(.25, 1); part(q.x + CX + Math.cos(q.ang) * q.len * t + rnd(-1.5, 1.5), P.y + 4, (P.y - CY) - q.y - Math.sin(q.ang) * q.len * t + 4, 0, 0, rnd(14, 30), pick(['#ff5a2a', '#ff9a2a', '#ffd24a', '#c8301e']), rnd(.25, .5), 1, -30, 1); });
      addLight(x, y - 10, 48, .7);
    }
  }
}
// Leuchten der Waffe in der Hand, Schweif beim Schlagen
function auraWeapon(A) {
  const q = P.wq, W = A.w; if (!q || !W) return;
  const k = auK(), cx_ = q.x + Math.cos(q.ang) * q.len * q.at, cy_ = q.y + Math.sin(q.ang) * q.len * q.at, r = W.rar >= 6 ? 13 : W.rar >= 4 ? 10 : 7;
  auBlob(W.col, cx_, cy_, r, r, (W.rar >= 4 ? .32 : .2) * k * (.85 + .15 * Math.sin(T * 5)));
  const swing = W.melee && (P.atkT > 0 || P.spin > 0) && q.len > 3;
  if (swing) { AUTRAIL.push(q.x + Math.cos(q.ang) * q.len, q.y + Math.sin(q.ang) * q.len, T); if (AUTRAIL.length > 24) AUTRAIL.splice(0, 3); }
  while (AUTRAIL.length && T - AUTRAIL[2] > .14) AUTRAIL.splice(0, 3);
  if (AUTRAIL.length >= 6) {
    ctx.strokeStyle = W.col; ctx.lineWidth = W.rar >= 4 ? 3 : 2;
    for (let i = 3; i < AUTRAIL.length; i += 3) { ctx.globalAlpha = clamp(1 - (T - AUTRAIL[i + 2]) / .14, 0, 1) * .55 * k; ctx.beginPath(); ctx.moveTo(AUTRAIL[i - 3], AUTRAIL[i - 2]); ctx.lineTo(AUTRAIL[i], AUTRAIL[i + 1]); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
}

/* ---------- Schicht 2: am Körper (aus drawActor, im Bild des Helden) ---------- */
const AUWING = [];
// Feuerflügel: 8 Flügelschläge, einmal gezeichnet; Anker = Flügelwurzel bei (28, 34)
function auWingFrame(f) {
  if (AUWING[f]) return AUWING[f];
  return AUWING[f] = mk(52, 44, g => {
    const ax = 28, ay = 34, fl = Math.sin(f / 8 * 6.283) * 12, R = mulberry(f * 97 + 13), C = ['#c8301e', '#ff6a2a', '#ff9a2a', '#ffd24a', '#fff0a0'];
    const layer = (dx, dy, sc, cols) => {
      const A0 = [ax + dx, ay + dy];
      [96, 116, 136, 156, 176].forEach((a0, i) => {
        const a = (a0 + fl) * Math.PI / 180, L = [16, 22, 24, 20, 14][i] * sc, t = [A0[0] + Math.cos(a) * L, A0[1] - Math.sin(a) * L], n = a + Math.PI / 2, w = 2;
        triPx(g, [A0[0] + Math.cos(n) * w, A0[1] + Math.sin(n) * w], [A0[0] - Math.cos(n) * w, A0[1] - Math.sin(n) * w], t, cols[i % cols.length]);
        g.fillStyle = C[3 + (R() < .5 ? 1 : 0)]; g.fillRect(Math.round(t[0]), Math.round(t[1]), 1, 1);
        if (R() < .6) { g.fillStyle = C[2]; g.fillRect(Math.round(t[0] + rnd(-1, 1)), Math.round(t[1] - 1), 1, 1); }
      });
    };
    layer(3, -1, .8, ['#8a1e10', '#c8301e']);
    layer(0, 0, 1, [C[1], C[2], C[1], C[3], C[2]]);
  });
}
function auraSprite(g, ox, oy, m, layer) {
  const A = auraNow(); if (!A || !A.myth.length || P.roll > 0) return;
  for (const my of A.myth) {
    if (my === 'phoenix' && layer === 0) { const f = Math.floor(T * (P.moving ? 12 : 5) * (auCalm() ? .5 : 1)) % 8; g.drawImage(auWingFrame(f), ox + m.back + 4 - 28, oy + m.sy - 1 - 34); }
    if (my === 'dornen' && layer === 1) {
      const hit = P.thornT > T ? 1 : 0, d = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
      for (const [x, y, s] of [[m.back - 1, m.sy - 4, -1], [m.front + 1, m.sy - 2, 1], [m.back - 1, m.sy + 1, -1], [m.front + 1, m.sy + 3, 1], [m.back, m.top + 4, -1], [m.front, m.top + 5, 1]]) { d(ox + x, oy + y, '#2a3a1a'); d(ox + x + s, oy + y - 1, '#4a6a2a'); d(ox + x + s * (2 + hit), oy + y - 2, hit ? '#ffb0a0' : '#ff4a3a'); }
    }
  }
}

/* ---------- Schicht 3: Leuchten über der Szene (additiv) ---------- */
function auraGlow() {
  const A = auraNow(); if (!A || !auShown() || !P.hand) return;
  const x = P.x - CX, y = P.y - CY, k = auK(), calm = auCalm(), sp = calm ? .35 : 1, H = P.hand.top || 22, live = auLive();
  ctx.globalCompositeOperation = 'lighter';
  auraWeapon(A);
  for (const m of A.myth) {
    if (m === 'krone') {
      auBlob('#ffe08a', x, y - H - 2, 12, 6, .55 * k);
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .42 + Math.sin(T * .6 * sp) * .12, L = 30 + (i % 2) * 10; ctx.globalAlpha = (.1 + .05 * Math.sin(T * 2 * sp + i)) * k; ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - H + 4); ctx.lineTo(x + Math.cos(a) * L, y - H + 4 + Math.sin(a) * L); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else if (m === 'midas') {
      for (let i = 0; i < 7; i++) {
        const ph = (T * .7 * sp + i * .37) % 1, a = i * .9 + T * .2 * sp, px_ = x + Math.cos(a) * (8 + (i % 3) * 3), py_ = y - 4 - ((i * 7) % 18), s = ph < .5 ? ph * 2 : 2 - ph * 2;
        if (s < .2) continue; const c = i % 2 ? '#fff3c0' : '#ffd24a';
        auPx(px_, py_, 1, '#ffffff', s * k); if (s > .55) { auPx(px_ - 1, py_, 1, c, s * k); auPx(px_ + 1, py_, 1, c, s * k); auPx(px_, py_ - 1, 1, c, s * k); auPx(px_, py_ + 1, 1, c, s * k); }
      }
      ctx.globalAlpha = 1;
    } else if (m === 'ernter') {
      for (let i = 0; i < 3; i++) for (let j = 5; j >= 0; j--) {
        const a = T * 1.6 * sp + i * 2.094 - j * .16, px_ = x + Math.cos(a) * 13, py_ = y - 10 - Math.sin(T * 2.2 * sp + i) * 4 + Math.sin(a) * 5;
        if (j) auPx(px_, py_, 1, '#5ae0b0', (.8 - j * .1) * k); else { for (const [dx, dy] of NB4) auPx(px_ + dx, py_ + dy, 1, '#5ae0b0', .8 * k); auPx(px_, py_, 1, '#ffffff', k); }
      }
      ctx.globalAlpha = 1;
    } else if (m === 'klinge') {
      const q = P.wq, sx = q ? q.x + Math.cos(q.ang) * q.len * .7 : x, sy = q ? q.y + Math.sin(q.ang) * q.len * .7 : y - 12;
      if (live && T >= AUARC.next) {
        AUARC.next = T + (calm ? rnd(1.4, 2.4) : rnd(.18, .55)); AUARC.t = T; const n = 4, a = rnd(0, 6.28), L = rnd(10, 18), pts = [[sx, sy]];
        for (let i = 1; i <= n; i++) pts.push([sx + Math.cos(a) * L * i / n + rnd(-3, 3), sy + Math.sin(a) * L * i / n * .7 + rnd(-3, 3)]);
        AUARC.pts = pts;
      }
      if (AUARC.pts && T - AUARC.t < .13) {
        const p = AUARC.pts, al = (1 - (T - AUARC.t) / .13) * k * (calm ? .5 : 1);
        for (const [w, c] of [[3, 'rgba(120,170,255,' + .5 * al + ')'], [1, 'rgba(255,255,255,' + al + ')']]) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.stroke(); }
      }
      auBlob('#8ab0ff', sx, sy, 8, 8, .3 * k);
    } else if (m === 'eisherz') {
      auBlob('#a8e8ff', x, y - H, 9, 6, .3 * k);
    } else if (m === 'phoenix') {
      auBlob('#ff9a2a', x - P.turn * 6, y - 14, 16, 12, .25 * k);
    }
  }
  if (A.set === 'lion') auBlob('#ffe08a', x, y - H * .55, 12, 14, .12 * k);
  // Seelen aus besiegten Gegnern fliegen zum Helden (Seelenernter)
  for (let i = AUSOUL.length - 1; i >= 0; i--) {
    const s = AUSOUL[i], d = Math.hypot(P.x - s.x, P.y - 10 - s.y);
    if (live) { const v = Math.min(1, AUdt * (3 + s.t * 6)); s.x += (P.x - s.x) * v; s.y += (P.y - 10 - s.y) * v + Math.sin(T * 9 + i) * .4; s.t += AUdt; }
    auPx(s.x - CX - 1, s.y - CY - 1, 2, '#d8fff0', .9 * k); auPx(s.x - CX + 1, s.y - CY + 1, 1, '#3ac8a0', .6 * k);
    if (d < 6 || s.t > 2) AUSOUL.splice(i, 1);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* ---------- Heldenbilder in Menüs ----------
   heroPreviewURL (js/ui.js) kann die Aura ruhig mitzeichnen: auraKey(c) in den Bild-Schlüssel, im Einzelbild
   vor dem Körper auraPreview(gg, ox, oy, m, c, 0, f * FW, FW, FH), nach dem Kopfschmuck auraPreview(…, 1, …) */
function auraKey(c) { const A = auraOf(c); return A.any ? A.leg.join() + '|' + (A.set || '') + '|' + A.myth.join() : ''; }
function auraPreview(g, ox, oy, m, c, layer, fx, FW, FH) {
  const A = auraOf(c); if (!A.any || (!A.leg.length && !A.set && !A.myth.length)) return;
  const col = A.myth.length ? ITEMLOOK['m:' + A.myth[0]].acc : A.set ? AUEDGE[A.set] : A.leg[0];
  g.save(); g.beginPath(); g.rect(fx, 0, FW, FH); g.clip();
  if (layer === 0) {
    if (A.myth.includes('phoenix')) g.drawImage(auWingFrame(2), ox + m.back + 4 - 28, oy + m.sy - 1 - 34);
    for (let i = 0; i < 20; i++) { if (i % 4 === 0) continue; const t = i / 20 * 6.283, s = Math.sin(t); g.globalAlpha = s > 0 ? .9 : .5; g.fillStyle = col; g.fillRect(Math.round(ox + m.cx + Math.cos(t) * 10), Math.round(oy + m.feet - 1 + s * 2.5), 1, 1); }
  } else {
    g.fillStyle = col;
    for (const [dx, dy] of [[-7, 3], [7, 6], [-6, 11], [8, 13]]) { g.globalAlpha = .8; g.fillRect(ox + m.cx + dx, oy + m.top + dy, 1, 1); }
  }
  g.globalAlpha = 1; g.restore();
}

/* ---------- Andockstellen ---------- */
HOOK.draw.push(list => { if (P && auShown()) list.push({ y: P.y - .05, draw: auraBack }); });
HOOK.postRender.push(() => { try { auraGlow(); } catch (e) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } auCss(); });
HOOK.kill.push(e => { if (mod('my_soul') && AUSOUL.length < 12) AUSOUL.push({ x: e.x, y: e.y - 10, t: 0 }); });
HOOK.hurt.push((d, src) => { if (mod('my_thorns') && src) P.thornT = T + .35; return d; });
// Schläge mit Waffen ab Episch in der Farbe der Waffe
HOOK.update.push(() => {
  const A = auraNow(); if (!A || !A.w) return;
  for (const f of fx) if (f.k === 'slash' && f.follow && !f.auc) { f.auc = 1; f.col = A.w.col; }
});

/* ---------- Oberfläche: Rahmen, die besondere Beute hervorheben ---------- */
let auCalmCss = null;
function auCss() { const c = auCalm(); if (c !== auCalmCss) { auCalmCss = c; document.body.classList.toggle('aucalm', c); } }
(function () {
  const sel = (c, p) => ['.slot', '.ic', '.ic.big'].map(s => `${s}[style*="2px ${c}"]${p || ''}`).join(',');
  const glow = (c, r, a) => `radial-gradient(circle at 50% 55%,rgba(${hexRgb(c).join(',')},${a}) 0,rgba(${hexRgb(c).join(',')},0) ${r}%)`;
  const css = [
    `${sel('#b892f4')}{background:${glow('#b892f4', 70, .22)},var(--stone-lo)}`,
    `${sel('#ff8a3a')},${sel('#4ade80')},${sel('#ff4fd8')}{position:relative}`,
    `${sel('#ff8a3a')}{background:${glow('#ff8a3a', 72, .38)},var(--stone-lo)}`,
    `${sel('#4ade80')}{background:${glow('#4ade80', 72, .34)},var(--stone-lo)}`,
    `${sel('#ff4fd8')}{background:${glow('#ff4fd8', 75, .45)},var(--stone-lo)}`,
    `${sel('#ff8a3a', '::after')},${sel('#4ade80', '::after')},${sel('#ff4fd8', '::after')}{content:"";position:absolute;inset:0;pointer-events:none}`,
    `${sel('#ff8a3a', '::after')}{box-shadow:0 0 6px 1px rgba(255,138,58,.75);animation:auLeg 2.4s steps(3) infinite}`,
    `${sel('#4ade80', '::after')}{box-shadow:0 0 6px 1px rgba(74,222,128,.6)}`,
    `${sel('#ff4fd8', '::after')}{animation:auMyth 1.6s steps(4) infinite}`,
    '@keyframes auLeg{0%,100%{box-shadow:0 0 5px 1px rgba(255,138,58,.6)}50%{box-shadow:0 0 9px 2px rgba(255,190,90,.9)}}',
    '@keyframes auMyth{0%{box-shadow:inset 0 0 0 2px #ff4fd8,0 0 8px 2px rgba(255,79,216,.8)}25%{box-shadow:inset 0 0 0 2px #b892f4,0 0 8px 2px rgba(184,146,244,.8)}50%{box-shadow:inset 0 0 0 2px #8ae8ff,0 0 8px 2px rgba(138,232,255,.8)}75%{box-shadow:inset 0 0 0 2px #ffe08a,0 0 8px 2px rgba(255,224,138,.8)}}',
    'body.aucalm .slot::after,body.aucalm .ic::after{animation-duration:8s!important}',
    '@media (prefers-reduced-motion:reduce){.slot::after,.ic::after{animation:none!important}}',
    // größeres Bild in der Beschreibung
    '.detail .ic.big{width:64px;height:64px}.detail .ic.big img{width:58px;height:58px}'
  ].join('');
  const st = document.createElement('style'); st.id = 'auras-css'; st.textContent = css; document.head.appendChild(st);
})();
