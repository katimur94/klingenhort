// Meme-Clip „Ich nach 5 Minuten vs. ich nach 50 Stunden“ (~11 s): echte Aufnahmen
// a: Level-1-Ritterin mit Startausrüstung kratzt an einem Schleim · b: Magier auf Level 100 mit Ultimative gegen Pyraxis und Horde.
// Aufruf: PROMO_OUT=/tmp/klingenhort-meme-1 BASE=http://localhost:8766/ node scenes.js
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-meme-1';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 104, base: BASE });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  // a) frisch angefangen: Level 1, Holzschwert-Niveau, Schleim hält ewig
  if (R.want('a')) {
    await ev(() => {
      __seed(5); __fight(0, 1, ['slime'], { keepN: 1, dist: 30, tanky: 40 });
      P.lv = 1; P.gear = { weapon: makeItem({ slot: 'weapon', base: 'sword', tier: 0, rar: 0 }), armor: makeItem({ slot: 'armor', tier: 0, rar: 0 }), helm: null };
      P.talents = {}; computeStats(); __step(10); __vp(3.6); __snap();
    });
    await R.cap('a', 84, `i => { __keep(0); P.rage = 0; }`);
  }
  // b) 50 Stunden später: Level 100, mythische Ausrüstung, Ultimative gegen Pyraxis und Horde
  if (R.want('b')) {
    await ev(() => {
      __seed(11); __fight(1, 8, ['imp', 'chort', 'imp', 'lavadaemon', 'skeleton'], { boss: 'pyraxis', by: -58, bx: 8, tanky: 3, keepN: 9 });
      P.lv = 100; computeStats(); __step(16); __vp(3); __snap();
    });
    await R.cap('b', 156, `i => { __keep(1.1); __holdBoss(56); if (i === 0 || i === 84) { P.rage = 100; doUlt(); } if (i % 9 === 4) { P.cds[0] = 0; useSkill(0); } if (i % 13 === 7) { P.cds[1] = 0; useSkill(1); } }`);
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
