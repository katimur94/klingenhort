'use strict';
/* =========================================================
   KLINGENHORT – Kern: Helfer, Grafik, Ton, Speichern
   ========================================================= */

// Spieldaten und feste Texte der Seite in der gewählten Sprache (js/i18n.js)
translateData(); translateStatic();
const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
let VW = 320, VH = 200, SCALE = 3;
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');
function portrait() { return innerHeight > innerWidth; }

/* ---------- Mathe ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) * (1 - t);
const approach = (v, t, d) => v < t ? Math.min(t, v + d) : Math.max(t, v - d);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function mulberry(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function wpick(obj, R) { const r = R || Math.random; let s = 0; for (const k in obj) s += obj[k]; let x = r() * s; for (const k in obj) { x -= obj[k]; if (x <= 0) return k; } return Object.keys(obj)[0]; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmt(n) { return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.round(n)); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- Leinwände ---------- */
function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; if (fn) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g); } return c; }
function px(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); }
function hexRgb(h) { const n = parseInt(h.slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

/* ---------- Grafik laden ---------- */
const SHEET = new Image(), FXIMG = new Image();
function loadAssets() {
  return Promise.all([[SHEET, 'assets/sheet.png'], [FXIMG, 'assets/fx.png']].map(([img, src]) => new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; })));
}
function crop(x, y, w, h, src) { return mk(w, h, g => g.drawImage(src || SHEET, x, y, w, h, 0, 0, w, h)); }
function frameRect(sp, anim, i) { const s = SP[sp], a = s[anim] || s.idle, n = s.n || 4; return [a[0] + (i % n) * s.w, a[1], s.w, s.h]; }

function tintGrey(c, hex) { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), p = d.data, [r, gg, b] = hexRgb(hex); for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const mx = Math.max(p[i], p[i + 1], p[i + 2]), mn = Math.min(p[i], p[i + 1], p[i + 2]); if (mx > 100 && (mx - mn) / mx < .25) { const l = mx / 235; p[i] = Math.min(255, r * l); p[i + 1] = Math.min(255, gg * l); p[i + 2] = Math.min(255, b * l); } } g.putImageData(d, 0, 0); return c; }
function tintAll(c, hex, k) { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), p = d.data, [r, gg, b] = hexRgb(hex); for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const l = (p[i] + p[i + 1] + p[i + 2]) / 3 / 170; p[i] = lerp(p[i], Math.min(255, r * l), k); p[i + 1] = lerp(p[i + 1], Math.min(255, gg * l), k); p[i + 2] = lerp(p[i + 2], Math.min(255, b * l), k); } g.putImageData(d, 0, 0); return c; }
function silhouette(c, col) { return mk(c.width, c.height, g => { g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); }); }

/* Gegner-Waffen aus dem Atlas: zeigen nach oben, Griff unten (Spieler-Waffen: art.js) */
const WCACHE = {};
function namedWeapon(nm) { const k = 'n_' + nm; if (WCACHE[k]) return WCACHE[k]; const s = WSRC[nm], bow = nm.startsWith('bow'); return WCACHE[k] = { c: crop(...s), ox: s[2] / 2, oy: bow ? s[3] / 2 : s[3] - 3, bow }; }

/* Aussehen eines Helden – alte Spielstände bekommen die Klassen-Standards */
function lookOf(c) {
  const L = (c && c.look) || {}, C = CLASSES[(c && c.cls) || 'knight'], n = v => (v == null || isNaN(v) ? -1 : +v);
  return { body: BODIES[L.body] ? L.body : C.body, hair: n(L.hair), skin: n(L.skin), accent: n(L.accent), cape: n(L.cape), wings: COSM[L.wings] ? L.wings : null, aura: COSM[L.aura] ? L.aura : null, ccape: COSM[L.ccape] ? L.ccape : null };
}
function heroSpec(c, over) { const L = lookOf(c), g = c.gear || {}; return Object.assign({ body: L.body, hair: L.hair, skin: L.skin, accent: L.accent, at: g.armor ? g.armor.tier : 0, ht: g.helm ? g.helm.tier : 0, dye: c.dye || null }, over || {}); }

/* Charakter-Umfärbung: Körper, Rüstungs-Material, Helm, Farbstoff, Haare, Haut */
const CCACHE = {};
function charStrip(s) {
  const key = [s.body, s.at, s.ht, s.dye || '', s.hair, s.skin, s.accent, s.np ? 1 : 0].join('|'); if (CCACHE[key]) return CCACHE[key];
  const B = BODIES[s.body] || BODIES.knight_m, S = SP[B.sp], hasHit = !!S.hit, n = hasHit ? 9 : 8, w = S.w, h = S.h;
  const c = mk(n * w, h, g => { g.drawImage(SHEET, S.idle[0], S.idle[1], 4 * w, h, 0, 0, 4 * w, h); g.drawImage(SHEET, S.run[0], S.run[1], 4 * w, h, 4 * w, 0, 4 * w, h); if (hasHit) g.drawImage(SHEET, S.hit[0], S.hit[1], w, h, 8 * w, 0, w, h); });
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, h), p = d.data;
  const D = s.dye && DYES.find(x => x.id === s.dye && x.c), M = MAT[clamp(s.at || 0, 0, TIERS - 1)], H = MAT[clamp(s.ht || 0, 0, TIERS - 1)];
  const cols = D ? D.c : M.c, map = {};
  map[B.main[0]] = cols[0]; map[B.main[1]] = cols[1];
  if (B.plume) { const pl = s.np ? null : s.accent >= 0 ? ACCENTS[s.accent].slice(1) : H.pl; map[B.plume[0]] = pl ? pl[0] : null; map[B.plume[1]] = pl ? pl[1] : null; if (B.hi && M.hi && !D) map[B.hi] = M.hi; }
  if (B.hair && s.hair >= 0 && HAIRS[s.hair]) { map[B.hair[0]] = HAIRS[s.hair][1]; if (B.hair[1]) map[B.hair[1]] = HAIRS[s.hair][2]; }
  if (B.skin && s.skin >= 0 && SKINS[s.skin]) { map[B.skin[0]] = SKINS[s.skin][1]; if (B.skin[1]) map[B.skin[1]] = SKINS[s.skin][2]; }
  for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const k = p[i] + ',' + p[i + 1] + ',' + p[i + 2]; if (k in map) { const v = map[k]; if (v === null) p[i + 3] = 0; else { const [r, gg, b] = hexRgb(v); p[i] = r; p[i + 1] = gg; p[i + 2] = b; } } }
  g.putImageData(d, 0, 0);
  // Ankerpunkte je Bild: Kopf oben, Füße, Rücken (für Umhang, Flügel, Krone)
  const meta = [], A = (x, y) => p[(y * c.width + x) * 4 + 3];
  for (let f = 0; f < n; f++) {
    let top = -1, feet = h - 1;
    for (let y = 0; y < h && top < 0; y++) for (let x = 0; x < w; x++) if (A(f * w + x, y)) { top = y; break; }
    for (let y = h - 1; y >= 0; y--) { let any = false; for (let x = 0; x < w; x++) if (A(f * w + x, y)) { any = true; break; } if (any) { feet = y; break; } }
    let sx = 0, sn = 0; for (let y = top; y < top + 5 && y < h; y++) for (let x = 0; x < w; x++) if (A(f * w + x, y)) { sx += x; sn++; }
    const sy = top + Math.round((feet - top) * .45); let back = w, front = 0;
    for (let x = 0; x < w; x++) if (A(f * w + x, sy)) { back = Math.min(back, x); front = Math.max(front, x); }
    meta.push({ top: Math.max(0, top), feet, cx: sn ? Math.round(sx / sn) : w / 2, sy, back: back === w ? 3 : back, front });
  }
  const res = { c, w, h, hasHit, meta, sil: silhouette(c, '#ffffff') };
  return CCACHE[key] = res;
}

/* Effekt-Frames */
function fxRect(name, f) { const m = FX[name]; return [m[0] + (f % m[4]) * m[2], m[1], m[2], m[3]]; }
const TCACHE = {};
function tintedFx(name, col) { const k = name + col; if (TCACHE[k]) return TCACHE[k]; const m = FX[name]; const c = mk(m[2] * m[4], m[3], g => { g.drawImage(FXIMG, m[0], m[1], m[2] * m[4], m[3], 0, 0, m[2] * m[4], m[3]); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .65; g.fillStyle = col; g.fillRect(0, 0, m[2] * m[4], m[3]); }); return TCACHE[k] = c; }

/* ---------- Icons ---------- */
const ICON = {};
function iconCanvas(spec) {
  const [t, a, b, c, d] = spec;
  if (t === 'w') return namedWeapon(a).c;
  if (t === 'fx') { const r = fxRect(a, b || 0); return crop(...r, FXIMG); }
  if (t === 's') return crop(a, b, c, d);
  if (t === 'sp') { const r = frameRect(a, 'idle', 0), c = crop(...r); if (b) { const g = c.getContext('2d'); g.globalCompositeOperation = 'source-atop'; g.fillStyle = b; g.fillRect(0, 0, c.width, c.height); } return c; }
  if (t === 'mat') return matIcon(a);
  if (t === 'gem') return gemIcon(a, b);
  if (t === 'pa') return artIcon(a, b);
  if (t === 'body') { const st = charStrip({ body: a, at: b || 0, ht: 0, hair: -1, skin: -1, accent: -1 }); return mk(st.w, st.h, g => g.drawImage(st.c, 0, 0, st.w, st.h, 0, 0, st.w, st.h)); }
  return mk(8, 8);
}
function iconURL(spec) {
  const key = JSON.stringify(spec); if (ICON[key]) return ICON[key];
  const src = iconCanvas(spec), sz = Math.max(src.width, src.height) + 2;
  const c = mk(sz, sz, g => g.drawImage(src, Math.floor((sz - src.width) / 2), Math.floor((sz - src.height) / 2)));
  return ICON[key] = c.toDataURL();
}
function itemIconURL(it) {
  const k = 'it' + itemArtKey(it) + (it.slot !== 'weapon' ? P.cls : '');
  if (ICON[k]) return ICON[k];
  const s = it.slot === 'weapon' ? weaponArt(it).c : armorArt(it, P.cls), sz = Math.max(s.width, s.height) + 2;
  return ICON[k] = mk(sz, sz, g => g.drawImage(s, Math.floor((sz - s.width) / 2), Math.floor((sz - s.height) / 2))).toDataURL();
}
function matIcon(id) {
  const M = MATS[id], a = M.c, b = M.c2;
  return mk(12, 12, g => {
    switch (id) {
      case 'erz': px(g, 2, 4, 8, 6, b); px(g, 3, 3, 6, 6, a); px(g, 4, 4, 2, 2, '#e8eef8'); px(g, 7, 6, 2, 1, '#e8eef8'); break;
      case 'leder': px(g, 2, 3, 8, 7, a); px(g, 1, 4, 10, 5, a); px(g, 2, 3, 8, 1, b); px(g, 3, 6, 6, 1, b); break;
      case 'knochen': px(g, 2, 8, 8, 3, b); px(g, 3, 6, 6, 3, a); px(g, 5, 5, 2, 2, a); px(g, 4, 7, 1, 1, '#fff'); break;
      case 'schleim': px(g, 3, 3, 6, 7, a); px(g, 2, 5, 8, 4, a); px(g, 4, 4, 2, 2, '#c8f0a0'); px(g, 3, 9, 6, 1, b); break;
      case 'zahn': px(g, 4, 1, 4, 3, a); px(g, 4, 4, 3, 4, a); px(g, 5, 8, 2, 2, a); px(g, 4, 8, 1, 1, b); px(g, 4, 2, 1, 4, b); break;
      case 'kristall': px(g, 5, 1, 2, 10, a); px(g, 3, 3, 6, 6, a); px(g, 4, 2, 4, 8, a); px(g, 5, 3, 1, 5, '#fff'); px(g, 7, 5, 1, 4, b); break;
      case 'horn': px(g, 2, 9, 3, 2, b); px(g, 3, 7, 3, 3, a); px(g, 5, 4, 3, 4, a); px(g, 7, 2, 2, 3, a); px(g, 8, 1, 1, 2, '#fff0c0'); break;
      case 'glut': px(g, 2, 3, 8, 7, b); px(g, 3, 4, 6, 5, a); px(g, 5, 5, 2, 2, '#fff0a0'); break;
      case 'schuppe': px(g, 2, 2, 8, 8, b); px(g, 3, 2, 6, 7, a); px(g, 4, 9, 4, 1, a); px(g, 4, 3, 2, 4, '#fff6c0'); break;
      case 'mithril': case 'adamant': px(g, 1, 5, 10, 5, '#4a4450'); px(g, 2, 4, 8, 2, '#5e5866'); px(g, 3, 5, 3, 3, a); px(g, 7, 6, 3, 3, a); px(g, 4, 8, 2, 1, b); px(g, 3, 5, 1, 1, '#fff'); px(g, 8, 6, 1, 1, '#fff'); break;
      case 'stern': for (const [x, y, s] of [[5, 1, 2], [2, 5, 1], [8, 6, 2], [4, 8, 1], [9, 2, 1]]) { px(g, x, y, s, s, a); if (s > 1) { px(g, x - 1, y, 1, 1, b); px(g, x + s, y + 1, 1, 1, b); px(g, x, y, 1, 1, '#fff'); } } break;
      case 'aether': px(g, 5, 0, 2, 12, b); px(g, 4, 2, 4, 8, a); px(g, 3, 4, 6, 4, a); px(g, 5, 2, 1, 6, '#fff'); px(g, 7, 6, 1, 3, b); break;
    }
  });
}
function gemIcon(id, grade) {
  const G = GEMS[id], c = G.c;
  return mk(10, 10, g => { const s = 3 + grade; const o = Math.floor((10 - s) / 2); px(g, o + 1, o, s - 2, s, c); px(g, o, o + 1, s, s - 2, c); px(g, o + 1, o + 1, 1, 1, '#fff'); if (grade >= 3) px(g, o + s - 2, o + s - 2, 1, 1, '#fff'); });
}

/* ---------- Ton & Musik ---------- */
let AC = null, master = null, musGain = null, NB = null;
function audioOn() { if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.connect(AC.destination); musGain = AC.createGain(); musGain.gain.value = .5; musGain.connect(master); startMusic(); } catch (e) { AC = null; } }
const sfxOn = () => !SAVE || SAVE.meta.settings.sfx !== false;
const musOn = () => !SAVE || SAVE.meta.settings.music !== false;
function tone(f, d, type, v, f2, delay, dest, at) { if (!AC) return; if (dest !== musGain && !sfxOn()) return; const t = at || AC.currentTime + (delay || 0); const o = AC.createOscillator(), gn = AC.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); gn.gain.setValueAtTime(v || .06, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(gn); gn.connect(dest || master); o.start(t); o.stop(t + d + .02); }
function noise(d, v, hp, at, dest) { if (!AC) return; if (dest !== musGain && !sfxOn()) return; if (!NB) { NB = AC.createBuffer(1, AC.sampleRate * .5 | 0, AC.sampleRate); const a = NB.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; } const t = at || AC.currentTime; const s = AC.createBufferSource(); s.buffer = NB; const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800; const gn = AC.createGain(); gn.gain.setValueAtTime(v || .05, t); gn.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f); f.connect(gn); gn.connect(dest || master); s.start(t); s.stop(t + d); }
let lastHitSfx = 0;
function sfx(k) {
  if (!AC || !sfxOn()) return;
  switch (k) {
    case 'swing': noise(.08, .05, 2500); break;
    case 'swing2': noise(.14, .08, 1500); tone(180, .12, 'sawtooth', .03, 90); break;
    case 'bow': tone(520, .08, 'triangle', .05, 180); break;
    case 'zapbolt': tone(900, .08, 'square', .03, 300); break;
    case 'hit': { const n = performance.now(); if (n - lastHitSfx < 40) return; lastHitSfx = n; tone(140, .07, 'square', .05, 70); noise(.05, .04, 1200); break; }
    case 'crit': tone(220, .1, 'square', .07, 60); noise(.08, .07, 900); break;
    case 'hurt': tone(200, .18, 'sawtooth', .07, 80); break;
    case 'die': tone(160, .22, 'square', .04, 40); break;
    case 'coin': tone(990, .04, 'square', .025); tone(1480, .07, 'square', .025, 0, .04); break;
    case 'lvl': [523, 659, 784, 1046].forEach((f, i) => tone(f, .14, 'square', .05, 0, i * .09)); break;
    case 'boom': tone(90, .35, 'sawtooth', .09, 28); noise(.35, .1, 120); break;
    case 'roll': noise(.12, .04, 600); break;
    case 'lunge': tone(300, .12, 'sawtooth', .035, 600); break;
    case 'cast': tone(660, .22, 'sine', .05, 1320); break;
    case 'fire': noise(.25, .07, 400); tone(200, .25, 'sawtooth', .04, 80); break;
    case 'frost': tone(1400, .3, 'sine', .05, 600); noise(.3, .04, 4000); break;
    case 'zap': noise(.18, .08, 2000); tone(1200, .15, 'square', .04, 200); break;
    case 'poison': tone(300, .2, 'sine', .04, 150); break;
    case 'smoke': noise(.4, .06, 300); break;
    case 'shield': tone(440, .3, 'triangle', .06, 880); break;
    case 'heal': tone(440, .22, 'sine', .06, 880); break;
    case 'buy': tone(660, .06, 'square', .04); tone(880, .1, 'square', .04, 0, .06); break;
    case 'craft': [440, 660, 880].forEach((f, i) => tone(f, .1, 'square', .04, 0, i * .07)); noise(.08, .06, 2000); break;
    case 'fail': tone(220, .25, 'sawtooth', .05, 110); break;
    case 'clear': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, .18, 'square', .05, 0, i * .11)); break;
    case 'deny': tone(150, .12, 'square', .05); break;
    case 'deflect': tone(1200, .06, 'square', .04, 600); break;
    case 'wood': noise(.1, .07, 400); tone(120, .08, 'square', .04, 80); break;
    case 'mine': tone(900, .05, 'square', .04, 500); noise(.06, .05, 3000); break;
    case 'chest': [660, 880, 1320].forEach((f, i) => tone(f, .1, 'square', .04, 0, i * .07)); break;
    case 'loot': [784, 988, 1175, 1568].forEach((f, i) => tone(f, .16, 'triangle', .06, 0, i * .08)); break;
    case 'spec': tone(110, .5, 'sawtooth', .07, 440); noise(.3, .06, 600); break;
    case 'fuse': noise(.05, .02, 3000); break;
    case 'spike': tone(800, .05, 'square', .03, 300); break;
    case 'click': tone(1000, .03, 'square', .025); break;
    case 'ach': [880, 1175, 1568].forEach((f, i) => tone(f, .14, 'triangle', .06, 0, i * .1)); break;
    case 'tick': tone(1400, .02, 'square', .02); break;
    case 'build': noise(.12, .07, 500); [330, 440, 554, 660].forEach((f, i) => tone(f, .12, 'square', .04, 0, .08 + i * .08)); break;
    case 'myth': [523, 659, 784, 1046, 1318, 1568, 2093].forEach((f, i) => tone(f, .22, 'triangle', .06, 0, i * .09)); noise(.5, .05, 3000); break;
    case 'fuse': tone(220, .5, 'sawtooth', .05, 880); [660, 880, 1320].forEach((f, i) => tone(f, .16, 'triangle', .05, 0, .35 + i * .08)); break;
    case 'page': noise(.15, .05, 2500); tone(700, .08, 'sine', .03, 900); break;
    case 'dig': noise(.25, .06, 300); break;
  }
}
let mTimer = null, mNext = 0, mStep = 0, mRoot = 45, mBoss = false;
const PROG = [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']];
const mf = n => 440 * Math.pow(2, (n - 69) / 12);
function startMusic() { if (!AC || mTimer) return; mNext = AC.currentTime + .1; mTimer = setInterval(schedMusic, 60); }
function schedMusic() {
  if (!AC) return; if (!musOn()) { mNext = AC.currentTime + .1; return; }
  const spb = mBoss ? .1 : .125;
  while (mNext < AC.currentTime + .25) {
    const s = mStep % 16, bar = Math.floor(mStep / 16) % 4, [off, q] = PROG[bar], root = mRoot + off, ch = q === 'm' ? [0, 3, 7, 12] : [0, 4, 7, 12];
    if (s % 4 === 0) tone(mf(root - 12), spb * 1.8, 'triangle', .09, 0, 0, musGain, mNext);
    if (s % 4 === 2) tone(mf(root - 5), spb * 1.2, 'triangle', .06, 0, 0, musGain, mNext);
    tone(mf(root + 12 + ch[s % 4] + (s >= 8 && mBoss ? 12 : 0)), spb * .9, 'square', .018, 0, 0, musGain, mNext);
    if (s % 2 === 1) noise(.03, .025, 7000, mNext, musGain);
    if (mBoss && s % 8 === 4) noise(.08, .05, 900, mNext, musGain);
    mNext += spb; mStep++;
  }
}
function setMusic(root, boss) { mRoot = root; mBoss = !!boss; }

/* ---------- Speichern ---------- */
let SAVE = null;
function defaultMeta() { return { stats: {}, ach: {}, bestiary: {}, fallen: [], best: [], daily: {}, settings: { music: true, sfx: true }, hide: defaultHide(), luck: { spins: 0, pityL: 0, pityM: 0 }, lore: [], cos: [] }; }
function defaultHide() { return { b: {}, stash: [], rooms: 0, mine: 0, garden: 0, intro: false }; }
// Ältere Spielstände um neue Felder ergänzen, ohne etwas zu verlieren
function fixMeta(m) {
  const d = defaultMeta(); m = Object.assign(d, m || {});
  m.settings = Object.assign({ music: true, sfx: true }, m.settings || {});
  m.hide = Object.assign(defaultHide(), m.hide || {}); m.hide.b = m.hide.b || {}; if (!Array.isArray(m.hide.stash)) m.hide.stash = [];
  m.luck = Object.assign({ spins: 0, pityL: 0, pityM: 0 }, m.luck || {});
  if (!Array.isArray(m.lore)) m.lore = []; if (!Array.isArray(m.cos)) m.cos = [];
  return m;
}
function loadAll() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s && s.v === 3) { SAVE = s; SAVE.meta = fixMeta(SAVE.meta); markSeen(); return; } } catch (e) { }
  SAVE = { v: 3, chars: [], active: -1, meta: defaultMeta() };
  try { const old = JSON.parse(localStorage.getItem('klingenhort.v1') || 'null'); if (old && old.lv) { SAVE.chars.push(migrateV1(old)); SAVE.active = 0; } } catch (e) { }
  markSeen(); persist();
}
// Neue Spieler sehen keine „Neu“-Hinweise; wer schon Helden hat, bekommt die Neuigkeiten seit 4.0.1 gezeigt
function markSeen() { if (!SAVE.meta.seenVer) SAVE.meta.seenVer = SAVE.chars.length ? '4.0.1' : VERSION; }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { } }
function migrateV1(o) {
  const c = newChar('knight', _t('Ritter'), 'normal', false);
  c.lv = o.lv || 1; c.xp = o.xp || 0; c.gold = o.gold || 0; c.potions = Math.min(5, o.potions || 2);
  c.sp = Math.max(0, c.lv - 1);
  const tr = v => clamp(Math.floor(+v) || 0, 0, 4), has = v => v !== undefined && v !== null && !isNaN(+v);
  const eq = o.eq && typeof o.eq === 'object' ? o.eq : {};
  const best = ['sword', 'axe'].filter(t => has(eq[t])).sort((a, b) => eq[b] - eq[a])[0];
  if (best) c.gear.weapon = makeItem({ slot: 'weapon', base: best, tier: tr(eq[best]), rar: 0 });
  if (has(eq.armor)) c.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: tr(eq.armor), rar: 0 });
  if (has(eq.helm)) c.gear.helm = makeItem({ slot: 'helm', base: 'helm', tier: tr(eq.helm), rar: 0 });
  for (const L of (Array.isArray(o.loot) ? o.loot : [])) {
    if (!L) continue;
    if ((L.type === 'sword' || L.type === 'axe') && c.bag.length < 30) { const it = makeItem({ slot: 'weapon', base: L.type, tier: tr(L.tier), rar: tr(L.rar) }); if (L.name) it.name = String(L.name); c.bag.push(it); }
    else c.gold += 50 + tr(L.rar) * 40;
  }
  c.act = Math.max(1, Math.floor(((o.stage || 1) - 1) / 7) + 1);
  c.mats.erz = 6; c.mats.leder = 4;
  return c;
}
function exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(SAVE)))); }
function importCode(code) {
  const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (s && s.v === 3 && Array.isArray(s.chars)) { SAVE = s; SAVE.meta = fixMeta(SAVE.meta); markSeen(); persist(); return 'ok'; }
  if (s && s.lv) { SAVE.chars.push(migrateV1(s)); SAVE.active = SAVE.chars.length - 1; persist(); return 'v1'; }
  throw new Error('bad');
}
function stat(k, v) { const s = SAVE.meta.stats; s[k] = (s[k] || 0) + (v == null ? 1 : v); }
function statMax(k, v) { const s = SAVE.meta.stats; if ((s[k] || 0) < v) s[k] = v; }
