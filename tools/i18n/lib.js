// Gemeinsame Helfer für die Sprach-Werkzeuge: Texte auslesen, Sprachdateien lesen und schreiben.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const R = f => path.join(ROOT, f);
// Reihenfolge wie in index.html: so stehen zusammengehörige Texte auch in den Sprachdateien beieinander
const DATA = ['js/data.js', 'js/story.js', 'js/news.js', 'js/weekly.js'];
const CODE = ['js/data.js', 'js/story.js', 'js/news.js', 'js/weekly.js', 'js/core.js', 'js/art.js', 'js/items.js', 'js/elements.js', 'js/forge.js', 'js/pets.js', 'js/mastery.js', 'js/trade.js', 'js/auras.js', 'js/bosses.js', 'js/artefakte.js', 'js/mods.js', 'js/lande.js', 'js/voegel.js', 'js/market.js', 'js/world.js', 'js/combat.js', 'js/render.js', 'js/hideout.js', 'js/bauen.js', 'js/controls.js', 'js/ui.js', 'js/i18n.js'];

function langs() { return Object.keys(vm.runInNewContext(fs.readFileSync(R('js/i18n.js'), 'utf8').match(/const LANGS = (\{[^}]*\})/)[1].replace(/^/, '(') + ')')); }

// Alle Texte: { text: ['datei:zeile', ...] }
function extract() {
  const keys = new Map(), add = (k, w) => { if (!String(k).trim()) return; if (!keys.has(k)) keys.set(k, []); const a = keys.get(k); if (a.length < 4 && !a.includes(w)) a.push(w); };
  // 1. Spieldaten: translateData() mit Mitschrift ausführen
  const ctx = { console, navigator: { languages: ['de-DE'] }, localStorage: { getItem: () => null, setItem() { } }, document: { documentElement: {}, querySelectorAll: () => [] } };
  ctx.window = Object.assign({ __I18N_KEYS: 1 }, ctx); vm.createContext(ctx);
  const src = ['js/i18n.js', ...DATA].map(f => fs.readFileSync(R(f), 'utf8')).join('\n;\n') + '\n;translateData(); [...I18N_KEYS]';
  for (const k of vm.runInContext(src, ctx)) add(k, 'daten');
  // 2. Code: jedes _t('…') mit festem Text
  const lit = /\b_t\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
  for (const f of CODE) {
    const s = fs.readFileSync(R(f), 'utf8');
    let m; while ((m = lit.exec(s))) add(vm.runInNewContext(m[1]), path.basename(f) + ':' + (s.slice(0, m.index).split('\n').length));
  }
  // 3. index.html: data-t und data-ta
  const h = fs.readFileSync(R('index.html'), 'utf8'), un = x => x.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let m; const at = /data-ta?="([^"]*)"/g; while ((m = at.exec(h))) add(un(m[1]), 'index.html:' + h.slice(0, m.index).split('\n').length);
  return keys;
}

function langFile(l) { return R('js/lang/' + l + '.js'); }
function readLang(l) {
  const f = langFile(l); if (!fs.existsSync(f)) return {};
  const ctx = { I18N: {} }; vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx); return ctx.I18N[l] || {};
}
// Schreibt die Sprachdatei in der Reihenfolge der Texte; nicht mehr benutzte Texte bleiben hinten (außer prune)
function writeLang(l, dict, keys, prune) {
  const order = [...keys.keys()].filter(k => dict[k] != null);
  if (!prune) for (const k in dict) if (!keys.has(k)) order.push(k);
  const body = order.map(k => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(dict[k])).join(',\n');
  fs.mkdirSync(path.dirname(langFile(l)), { recursive: true });
  fs.writeFileSync(langFile(l), `'use strict';\n// Klingenhort – ${l}. Erzeugt mit tools/i18n/merge.js – Schlüssel ist der deutsche Text.\nI18N.${l} = {\n${body}\n};\n`);
}

// Platzhalter {x} und HTML-Tags müssen in Original und Übersetzung übereinstimmen
const ph = s => (String(s).match(/\{\w+\}/g) || []).sort().join(' ');
const tags = s => (String(s).match(/<\/?[a-z][a-z0-9]*/gi) || []).map(t => t.toLowerCase()).sort().join(' ');
function problem(k, v) {
  if (typeof v !== 'string' || !v.trim()) return 'leer';
  if (ph(k) !== ph(v)) return `Platzhalter: „${ph(k)}“ ≠ „${ph(v)}“`;
  if (tags(k) !== tags(v)) return `HTML: „${tags(k)}“ ≠ „${tags(v)}“`;
  return null;
}
module.exports = { ROOT, langs, extract, readLang, writeLang, problem };
