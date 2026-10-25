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

  // Goldrausch: Bogenschützin räumt eine Horde ab, überall Münzen
  if (R.want('gold')) {
    await R.ev(() => { __vp(3); __fight(3, 4, ['skeleton', 'goblin', 'zombie', 'goblin', 'skeleton', 'orc'], { keepN: 10, dist: 52 }); window.WEEK_FORCE = 'gold'; computeStats(); __keep(0); __step(16); __snap(); });
    await R.cap('gold', 48, `i => { __keep(.7); if (i === 0 || i === 30) { P.rage = 100; doUlt(); } if (i % 8 === 2) { P.cds[0] = 0; useSkill(0); } }`);
  }
  // Blutmond: lauter Elite-Gegner
  if (R.want('blut')) {
    await R.ev(() => { __vp(3.4); __fight(0, 7, [], { keepN: 0 }); window.WEEK_FORCE = 'blut'; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; const e = spawnEnemy(pick(['todesritter', 'skelmage', 'schattenimp', 'berserker']), { x: P.x + Math.cos(a) * 46, y: P.y + Math.sin(a) * 32, instant: true, elite: true }); e.hp = e.maxHp = e.maxHp * 3; } __keep(0); __step(16); __snap(); });
    await R.cap('blut', 48, `i => { __keep(0); for (const e of enemies) e.hp = Math.max(e.hp, e.maxHp * .3); if (i === 4) { P.rage = 100; doUlt(); } if (i === 26) { P.cds[1] = 0; useSkill(1); } }`);
  }
  // Drachenwoche: Jungdrachen gegen die Assassine
  if (R.want('drache')) {
    await R.ev(() => { __vp(3); __fight(2, 8, ['jungdrache', 'imp', 'jungdrache', 'imp'], { keepN: 4, dist: 58, tanky: 4 }); window.WEEK_FORCE = 'drache'; __keep(0); __step(20); __snap(); });
    await R.cap('drache', 48, `i => { __keep(.6); if (i === 6) { P.rage = 100; doUlt(); } if (i % 10 === 3) { P.cds[1] = 0; useSkill(1); } }`);
  }
  // Glückswoche: echter Gratis-Dreh im Glückstempel (Zeitraffer), Mythisch über den Pech-Zähler
  if (R.want('glueck')) {
    await R.ev(() => { activateChar(1); window.WEEK_FORCE = 'glueck'; P.story['spin' + P.act] = 1; SAVE.meta.luck.day = 0; SAVE.meta.luck.pityM = 79; P.fate = 0; enterHideout(); openStation('tempel'); __step(2); });
    // Ausschnitt für den Zoom im Schnitt: Rad bis unter den Knopf (Bildschirmpixel ×2)
    const box = await R.ev(() => { const w = $('wheel').getBoundingClientRect(); return { x: w.left * 2, y: w.top * 2, w: w.width * 2, h: w.height * 2 }; });
    require('fs').writeFileSync(R.out + 'glueck_box.json', JSON.stringify(box));
    await R.cap('glueck', 60, `i => { if (i === 8) doSpin(); if (i > 8 && spinning) __step(6); }`);
    console.log("Rad fertig:", await R.ev(() => !spinning), await R.ev(() => (panel.querySelector(".detail.center .nm") || {}).textContent));
  }

  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
