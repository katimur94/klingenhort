'use strict';
/* =========================================================
   KLINGENHORT – Sprachen. Deutsch ist der Ausgangstext: _t('Text {x}', { x })
   sucht die Übersetzung in I18N[LANG] (js/lang/<code>.js) und fällt sonst auf
   Deutsch zurück. Nur die gewählte Sprache wird geladen (siehe index.html).
   Neue Texte: im Code mit _t() schreiben, dann tools/i18n/extract.js und
   tools/i18n/check.js ausführen (Anleitung in tools/i18n/README.md).
   ========================================================= */

const LANGS = { de: 'Deutsch', en: 'English', tr: 'Türkçe', es: 'Español', it: 'Italiano', fr: 'Français' };
const LANG_KEY = 'klingenhort.lang';
const I18N = {};
// gespeicherte Wahl, sonst Sprache des Geräts, sonst Englisch
const LANG = (() => {
  try { const s = localStorage.getItem(LANG_KEY); if (s && LANGS[s]) return s; } catch (_) { }
  for (const l of (navigator.languages || [navigator.language || ''])) { const c = String(l).slice(0, 2).toLowerCase(); if (LANGS[c]) return c; }
  return 'en';
})();
document.documentElement.lang = LANG;
let I18N_MISS = window.__I18N_MISS ? new Set() : null;   // Tests: fehlende Übersetzungen sammeln
let I18N_KEYS = window.__I18N_KEYS ? new Set() : null;   // Auslesen: alle benutzten Texte sammeln

function _t(s, v) {
  if (s == null) return s;
  s = String(s);
  if (I18N_KEYS) I18N_KEYS.add(s);
  let r = s;
  if (LANG !== 'de') { const d = I18N[LANG]; if (d && d[s] != null) r = d[s]; else if (I18N_MISS && /[A-Za-zÄÖÜäöü]/.test(s)) I18N_MISS.add(s); }
  if (v) r = r.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  return r;
}
function setLang(code) { try { localStorage.setItem(LANG_KEY, code); } catch (_) { } location.reload(); }
// Sprache für Zahlen (Tausender-Trennzeichen usw.)
const LOCALE = { de: 'de-DE', en: 'en-US', tr: 'tr-TR', es: 'es-ES', it: 'it-IT', fr: 'fr-FR' }[LANG];

// Texte in index.html: data-t (Inhalt) und data-ta (aria-label)
function translateStatic() {
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = _t(el.dataset.t);
  for (const el of document.querySelectorAll('[data-ta]')) el.setAttribute('aria-label', _t(el.dataset.ta));
}

// Spieldaten, die nur angezeigt werden, beim Start übersetzen.
// Nicht hier: Namen, die in Spielständen landen (Legenden, Set-Teile, Mythisch, Suffixe) – die übersetzt itemName() beim Anzeigen.
function translateData() {
  const T = _t, tr = (o, ...f) => { if (o) for (const k of f) if (typeof o[k] === 'string') o[k] = T(o[k]); };
  const arr = a => a.forEach((x, i) => { if (typeof x === 'string') a[i] = T(x); });
  MAT.forEach(m => tr(m, 'n'));
  for (const k in WT) tr(WT[k], 'label');
  for (const k in WFORM) WFORM[k].forEach(f => tr(f, 'n'));
  for (const k in AR) tr(AR[k], 'label');
  for (const k in BODIES) tr(BODIES[k], 'n');
  for (const A of [HAIRS, SKINS, CAPES, ACCENTS]) A.forEach(a => { a[0] = T(a[0]); });
  for (const k in CLASSES) { const C = CLASSES[k]; tr(C, 'name', 'desc'); tr(C.res, 'name'); (C.names || []).forEach(arr); }
  DYES.forEach(d => tr(d, 'n'));
  for (const k in SKILLS) tr(SKILLS[k], 'n', 'd');
  for (const k in TALENTS) TALENTS[k].forEach(b => { b[0] = T(b[0]); b[1].forEach(n => tr(n, 'n', 'd')); });
  RAR.forEach(r => tr(r, 'n'));
  for (const k in SETS) tr(SETS[k], 'n', 'd2', 'd3');
  for (const k in MYTHIC) tr(MYTHIC[k], 'd');
  for (const k in COSM) tr(COSM[k], 'n');
  for (const k in MATS) tr(MATS[k], 'n', 'w');
  for (const k in GEMS) tr(GEMS[k], 'n');
  arr(GEMGRADE);
  RECIPES.forEach(r => tr(r, 'n', 'd'));
  for (const k in EN) tr(EN[k], 'name', 'desc');
  BOSSES.forEach(b => tr(b, 'name'));
  arr(CHAMPS);
  for (const k in AFFIX) tr(AFFIX[k], 'n');
  BIOMES.forEach(b => tr(b, 'name')); tr(HIDE_BIOME, 'name');
  for (const k in DIFFS) tr(DIFFS[k], 'n', 'd');
  for (const k in NODE) tr(NODE[k], 'n', 'd');
  SHRINES.forEach(s => tr(s, 'n', 'd', 'bn'));
  EVENTS.forEach(e => { tr(e, 'n', 'd'); e.opts.forEach(o => tr(o, 'n')); });
  RIDDLES.forEach(r => { tr(r, 'q'); arr(r.a); });
  for (const k in BUILD) { const B = BUILD[k]; tr(B, 'n', 'npc', 'd0'); if (Array.isArray(B.d)) arr(B.d); }
  for (const k in CROPS) tr(CROPS[k], 'n');
  ELIXIRS.forEach(e => tr(e, 'n', 'd', 'bn'));
  WHEEL.forEach(w => tr(w, 'n'));
  CHESTS.forEach(c => tr(c, 'n', 'd'));
  ACH.forEach(a => tr(a, 'n', 'd'));
  WEEKLY.forEach(w => tr(w, 'n', 'd'));
  // Geschichte
  for (const k in SPEAKERS) tr(SPEAKERS[k], 'n');
  const lines = L => L.forEach(l => { const i = l.length - 1; if (typeof l[i] === 'string') l[i] = T(l[i]); });
  lines(PROLOG);
  ACTS.forEach(a => tr(a, 't', 'i', 'b', 'o'));
  for (const k in NPCTALK) lines(NPCTALK[k]);
  LORE.forEach(l => { l[0] = T(l[0]); l[1] = T(l[1]); });
  // Neuigkeiten
  CHANGELOG.forEach(e => { tr(e, 't'); e.items.forEach(it => { it[1] = T(it[1]); }); });
  COMING.forEach(c => { c[1] = T(c[1]); });
  if (I18N_KEYS) savedNames().forEach(n => T(n));
}
// Namen, die so in Spielständen stehen (it.name, it.suf) und erst beim Anzeigen übersetzt werden
function savedNames() {
  const r = [];
  for (const k in LEGEND) r.push(...LEGEND[k]);
  for (const k in SETS) for (const s in SETS[k].pieces) r.push(SETS[k].pieces[s]);
  for (const k in MYTHIC) r.push(MYTHIC[k].n);
  for (const a of [AFFW, AFFA]) for (const k in a) r.push(a[k].suf);
  return r.filter(x => typeof x === 'string');
}
