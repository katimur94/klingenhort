// Aufnahmen für den TikTok-Clip zu 6.6 „Saison 1“ (~13 s):
// hook (Saison-Heldin mit Sturmmantel und Aura der Ersten Saison im Kampf) → punkte (Kills geben Saison-Punkte, echte Meldung „Saison-Stufe erreicht“,
// Punktestand je Bild in raw/punkte/log.json) → pass (Saison-Pass, bei Bild 30 „Alle abholen“) → kosm (Mantel und Aura aus der Nähe)
// Aufruf (Spiel muss lokal laufen): PROMO_OUT=/tmp/klingenhort-clip-6.6 BASE=http://localhost:8766/ node scenes.js [szene,…]
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-6.6';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 66, base: BASE });
  const { ev, page } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    window.__txtNo = /^\d+$/;
    // Saison-Heldin: Ritterin mit der Kosmetik der Saison (Stufe 15 und 30 des Passes)
    window.__held = (kos) => { activateChar(0); P.sz = szNo(); if (kos) { for (const k of ['c_saison1', 'a_saison1']) if (!SAVE.meta.cos.includes(k)) SAVE.meta.cos.push(k); P.look.ccape = 'c_saison1'; P.look.aura = 'a_saison1'; } else { P.look.ccape = null; P.look.aura = null; } P.look = lookOf(P); computeStats(); };
    window.__kampf = (kinds, zoom, kos) => { __held(kos); __fight(0, 9, kinds, { keepN: kinds.length, dist: 46, tanky: 2 }); P.act = 9; P.sz = szNo(); if (kos) { P.look.ccape = 'c_saison1'; P.look.aura = 'a_saison1'; P.look = lookOf(P); } SKY.t = 99; __vp(zoom); __step(8); __snap(); };
  });
  if (R.want('hook')) {
    await ev(() => { __seed(3); __kampf(['sturmharpyie', 'donnerzwerg', 'sturmrufer', 'blitzgolem', 'donnerzwerg'], 3.2, true); });
    await R.cap('hook', 48, `i => { __keep(.6); SKY.t = 99; if (i === 2) { P.rage = 100; doUlt(); } }`);
  }
  if (R.want('punkte')) {
    await ev(() => { __seed(8); __kampf(['goblin', 'goblin', 'skeleton', 'goblin', 'imp', 'goblin'], 3, false); const M = szM(); M.cl = []; M.xp = szNeed(1) + szNeed(2) + szNeed(3) - 11; window.__log = []; });
    await R.cap('punkte', 84, `i => { __keep(.8); SKY.t = 99; for (const e of enemies) if (!e.boss) e.hp = Math.min(e.hp, e.maxHp * .5); const M = szM(), L = szLevel(M.xp); window.__log.push({ xp: M.xp, st: L.st, in: L.in, need: L.need }); if (i === 20 || i === 60) { P.cds[1] = 0; useSkill(1); } }`);
    fs.writeFileSync(OUT + '/raw/punkte/log.json', JSON.stringify(await ev(() => window.__log)));
  }
  if (R.want('pass')) {
    await ev(() => { __off(); __held(false); P.lv = 40; const M = szM(); M.cl = [1, 2]; M.xp = 0; for (let s = 1; s <= 6; s++) M.xp += szNeed(s); M.xp += 120; G = null; openMap(); szOpen('map'); panel.scrollTop = 0; });
    await page.waitForTimeout(400);
    await R.cap('pass', 84, `i => { if (i === 34) { ON.sz_claim(null, null, 0); panel.scrollTop = 0; } }`);
    fs.writeFileSync(OUT + '/raw/pass/info.json', JSON.stringify(await ev(() => ({ cl: szM().cl.length, st: szLevel(szM().xp).st, days: szDaysLeft() }))));
  }
  if (R.want('kosm')) {
    await ev(() => { hideOverlay(); __seed(5); __kampf(['sturmrufer', 'sturmharpyie', 'donnerzwerg'], 4.6, true); window.__camDY = 4; });
    await R.cap('kosm', 60, `i => { __keep(.35); SKY.t = 99; }`);
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
