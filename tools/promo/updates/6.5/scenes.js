// Premieren-Trailer 6.5 „Sturmgipfel“ (~16 s): alles echte Aufnahmen aus Akt 9
// hook: Aerok-Arena, ein Blitz schlägt sofort ein · act9: Ritterin im Gewitter gegen die Blitz-Gegner
// lure: angekündigte Einschläge mitten in der Gegnergruppe – die Blitze treffen die Gegner · foes: die vier neuen Gegner nah
// boss: Sturmkönig Aerok unter halbem Leben ruft fünf Blitze rund um den Helden, der Held rollt raus
// Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.5 BASE=http://localhost:8765/ node scenes.js [szene]
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-6.5';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 65 });
  const { ev } = R;
  await R.news();
  if (R.want('assets')) await R.assets();
  await ev(() => {
    window.__txtNo = /^\d+$/;
    // Akt-9-Raum: Held ci, Gegner kinds; Gewitter-Zeitgeber auf t
    window.__act9 = (ci, kinds, zoom, t) => {
      activateChar(ci); P.act = 9; P.maxAct = 9; P.lv = 80; computeStats();
      __fight(ci, 9, kinds, { keepN: kinds.length, dist: 50, tanky: 3 }); P.act = 9; __vp(zoom); SKY.t = t; __step(8); __snap();
    };
    window.__boss9 = (ci, zoom) => {
      activateChar(ci); P.lv = 80; computeStats();
      __fight(ci, 9, ['sturmharpyie'], { boss: 'aerok', by: -56, keepN: 2, tanky: 2 }); __vp(zoom); SKY.t = 99; __step(12); __snap();
    };
  });
  if (R.want('hook')) {
    await ev(() => { window.__boss9(0, 3.1); for (const e of enemies) if (e.boss) e.stormT = 99; sturmStrike(P.x + 18, P.y - 30, { t: .2, dmg: 0, edmg: 0 }); });
    await R.cap('hook', 36, `i => { __keep(.4); __holdBoss(50); for (const e of enemies) if (e.boss) e.stormT = 99; if (i === 18) sturmStrike(P.x - 26, P.y - 6, { t: .3, dmg: 0, edmg: 0 }); }`);
  }
  if (R.want('act9')) {
    await ev(() => window.__act9(0, ['sturmharpyie', 'sturmrufer', 'donnerzwerg', 'blitzgolem', 'sturmrufer'], 3, 1.2));
    await R.cap('act9', 72, `i => { __keep(.7); if (i === 4) { P.rage = 100; doUlt(); } if (i === 40) { P.cds[1] = 0; useSkill(1); } }`);
  }
  if (R.want('lure')) {
    await ev(() => { window.__act9(3, ['donnerzwerg', 'donnerzwerg', 'sturmharpyie', 'blitzgolem'], 3.1, 99); for (const e of enemies) { e.x = P.x + 50 + Math.random() * 20; e.y = P.y - 10 + Math.random() * 20; } });
    await R.cap('lure', 72, `i => { P.inv = 1; P.hp = P.st.hp; keys.KeyJ = i % 16 < 8; keys.KeyA = i > 6 && i < 30; keys.KeyD = false;
      if (i === 10 || i === 26) { const t = enemies.filter(e => !e.dead && !e.boss); for (const e of t.slice(0, 3)) sturmStrike(e.x, e.y, { t: .9, dmg: 0 }); } }`);
  }
  if (R.want('foes')) {
    await ev(() => { window.__act9(1, ['sturmharpyie', 'sturmrufer', 'donnerzwerg', 'blitzgolem'], 3.6, 99); });
    await R.cap('foes', 48, `i => { __keep(0); keys.KeyJ = false; }`);
  }
  if (R.want('boss')) {
    await ev(() => { window.__boss9(2, 3); for (const e of enemies) if (e.boss) { e.hp = e.maxHp * .45; e.stormT = .6; } });
    await R.cap('boss', 96, `i => { P.inv = 1; P.hp = P.st.hp; keys.KeyJ = i < 20 || i > 70; for (const e of enemies) if (e.boss) { e.hp = Math.max(e.hp, e.maxHp * .4); e.hp = Math.min(e.hp, e.maxHp * .48); if (i > 50) e.stormT = Math.max(e.stormT, 9); }
      __holdBoss(54); if (i === 34) { keys.KeyK = true; P.roll = 0; keys.KeyD = true; } else keys.KeyK = false; if (i > 40) keys.KeyD = false; }`);
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
