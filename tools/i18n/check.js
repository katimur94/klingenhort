// Prüft alle Sprachen: fehlende Übersetzungen, falsche Platzhalter/HTML, nicht mehr benutzte Texte.
//   node tools/i18n/check.js              Bericht (Rückgabe 1 bei Lücken oder Fehlern)
//   node tools/i18n/check.js --todo DIR   schreibt DIR/<sprache>.json mit allen fehlenden Texten
//                                         und DIR/orte.json (wo jeder Text im Code steht)
const fs = require('fs'), path = require('path');
const { langs, extract, readLang, problem } = require('./lib');
const a = process.argv.slice(2), todo = a.includes('--todo') ? a[a.indexOf('--todo') + 1] : null;
const keys = extract();
console.log(`${keys.size} Texte im Spiel`);
if (todo) fs.mkdirSync(todo, { recursive: true });
let bad = 0; const orte = {};
for (const l of langs().filter(l => l !== 'de')) {
  const d = readLang(l), miss = [...keys.keys()].filter(k => d[k] == null), old = Object.keys(d).filter(k => !keys.has(k));
  const errs = [...keys.keys()].filter(k => d[k] != null).map(k => [k, problem(k, d[k])]).filter(x => x[1]);
  console.log(`${miss.length || errs.length ? '  FAIL' : '  ok  '} ${l}: ${keys.size - miss.length}/${keys.size} übersetzt${miss.length ? `, ${miss.length} fehlen` : ''}${errs.length ? `, ${errs.length} fehlerhaft` : ''}${old.length ? ` (${old.length} nicht mehr benutzt – mit merge.js --prune entfernen)` : ''}`);
  for (const k of miss.slice(0, 5)) console.log(`         fehlt: ${JSON.stringify(k).slice(0, 90)}  (${keys.get(k)[0]})`);
  for (const [k, e] of errs.slice(0, 5)) console.log(`         ${e}: ${JSON.stringify(k).slice(0, 70)}`);
  if (miss.length || errs.length) bad = 1;
  if (todo) {
    const o = {}; for (const k of miss) { o[k] = ''; orte[k] = keys.get(k); } for (const [k] of errs) { o[k] = d[k]; orte[k] = keys.get(k); }
    fs.writeFileSync(path.join(todo, l + '.json'), JSON.stringify(o, null, 1));
  }
}
if (todo) { fs.writeFileSync(path.join(todo, 'orte.json'), JSON.stringify(orte, null, 1)); console.log('Offene Texte → ' + todo); }
process.exit(bad);
