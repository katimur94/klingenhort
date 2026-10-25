// Übersetzungen in eine Sprachdatei übernehmen:
//   node tools/i18n/merge.js <sprache> datei.json [weitere.json …] [--prune]
// Die JSON-Dateien enthalten { "deutscher Text": "Übersetzung" }. Einträge mit falschen
// Platzhaltern oder HTML-Tags werden abgelehnt. --prune entfernt nicht mehr benutzte Texte.
const fs = require('fs');
const { langs, extract, readLang, writeLang, problem } = require('./lib');
const a = process.argv.slice(2), prune = a.includes('--prune'), [l, ...files] = a.filter(x => x !== '--prune');
if (!l || !langs().includes(l) || l === 'de') { console.log('Sprache fehlt: ' + langs().filter(x => x !== 'de').join(', ')); process.exit(1); }
const keys = extract(), d = readLang(l); let n = 0, rej = 0, unk = 0;
for (const f of files) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')))) {
  if (v === '' || v == null) continue;
  const p = problem(k, v); if (p) { rej++; console.log(`  abgelehnt (${p}): ${JSON.stringify(k).slice(0, 80)}`); continue; }
  if (!keys.has(k)) unk++;
  d[k] = v; n++;
}
writeLang(l, d, keys, prune);
const miss = [...keys.keys()].filter(k => d[k] == null).length;
console.log(`${l}: ${n} übernommen${rej ? `, ${rej} abgelehnt` : ''}${unk ? `, ${unk} unbekannt (kein Text im Spiel)` : ''} – es fehlen noch ${miss} von ${keys.size}`);
process.exit(rej ? 1 : 0);
