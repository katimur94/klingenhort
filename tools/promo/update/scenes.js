// Aufnahmen für den wöchentlichen Update-Clip.
// Pro Update: diese Datei nach tools/promo/updates/<version>/ kopieren und die Szenen „feature1“
// und „feature2“ so umbauen, dass sie das NEUE Feature im echten Spiel zeigen.
// Aufruf (Spiel muss lokal laufen, siehe tools/promo/README.md):
//   PROMO_OUT=/tmp/klingenhort-clip node scenes.js            alle Szenen
//   PROMO_OUT=/tmp/klingenhort-clip node scenes.js feature1   nur eine Szene neu aufnehmen
const path = require('path'), fs = require('fs');
// liegt in tools/promo/update/ oder in tools/promo/updates/<version>/
const H = require(path.join(__dirname, fs.existsSync(path.join(__dirname, '..', 'harness.js')) ? '..' : '../..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip';

(async () => {
  const R = await H.open({ out: OUT + '/raw' });
  await R.news();
  if (R.want('assets')) await R.assets();

  // Aufhänger: Magier gegen den Uralten Drachen – viel Action im ersten Bild
  if (R.want('hook')) {
    await R.ev(() => { __vp(3); __fight(1, 8, ['imp', 'chort', 'imp', 'lavadaemon'], { boss: 'pyraxis', by: -58, bx: 8, tanky: 3, keepN: 4 }); __step(20); __snap(); });
    await R.cap('hook', 48, `i => { __keep(1.2); __holdBoss(56); if (i === 0) { P.rage = 100; doUlt(); } if (i % 9 === 4) { P.cds[0] = 0; useSkill(0); } }`);
  }

  // ANPASSEN: das neue Feature in Aktion (Beispiel: Ritterin im Eis mit Erdbeben)
  if (R.want('feature1')) {
    await R.ev(() => { __vp(3.5); __fight(0, 5, ['frostoger', 'eisgeist', 'icez', 'skelarcher'], { tanky: 2, keepN: 6, dist: 40 }); __keep(0); __step(24); __snap(); });
    await R.cap('feature1', 72, `i => { __keep(.8); if (i === 0) { P.rage = 100; doUlt(); } if (i === 30) { P.cds[1] = 0; useSkill(1); } }`);
  }

  // ANPASSEN: zweite Ansicht des Features (Beispiel: Gang durchs Versteck)
  if (R.want('feature2')) {
    await R.ev(() => { activateChar(3); P.map = genMap(5); enterHideout(); __vp(2.4); P.x = hidePos('schmiede').x + 10; P.y = hidePos('schmiede').y + 34; __snap(); __step(6); });
    await R.cap('feature2', 72, `i => { P.inv = 1; keys.KeyJ = false; keys.KeyD = i < 64; }`);
  }

  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
