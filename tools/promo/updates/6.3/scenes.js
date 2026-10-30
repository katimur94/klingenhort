// Aufnahmen für den TikTok-Clip zu 6.3 „Aufträge & Ruf“ (~17 s):
// Aufhänger (Kampf) → quest (Tagesauftrag „Besiege 60 Gegner“ wird im Kampf erfüllt, Zähler je Bild mitgeschrieben)
// → hide (Ritterin geht im Versteck zur Auftragstafel mit „!“) → board (Tafel, Abholen, Belohnung mit neuem Orden-Rang)
// → ruf (vier Fraktionen) und qm (Quartiermeister der Handelsgilde) als Standbilder → Was ist neu → Endkarte.
// Aufruf (Spiel muss lokal laufen, siehe tools/promo/README.md):
//   PROMO_OUT=/tmp/klingenhort-clip-6.3 BASE=http://localhost:8766/ node scenes.js        alle Szenen
//   PROMO_OUT=/tmp/klingenhort-clip-6.3 node scenes.js quest,hide                           nur diese neu aufnehmen
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-6.3';
const BASE = process.env.BASE || 'http://localhost:8766/';

(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 63, base: BASE });
  const { ev, page } = R;
  await R.news();
  if (R.want('assets')) await R.assets();   // Grafiken für die Endkarte
  await page.addStyleTag({ content: '#combo{display:none!important}' });
  // Rechtecke von Menü-Teilen (Bildpixel, 2× Gerätepixel) – erst nach der Aufnahme speichern (cap leert den Ordner)
  const rect = (sel, i) => ev(([sel, i]) => { const e = document.querySelectorAll(sel)[i || 0]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left * 2, y: b.top * 2, w: b.width * 2, h: b.height * 2 }; }, [sel, i]);
  const save = (scene, file, o) => { fs.mkdirSync(R.out + scene, { recursive: true }); fs.writeFileSync(`${R.out}${scene}/${file}`, JSON.stringify(o, null, 1)); };
  const still = async (scene, file) => { await page.waitForTimeout(500); fs.mkdirSync(R.out + scene, { recursive: true }); await page.screenshot({ path: `${R.out}${scene}/${file}.jpg`, type: 'jpeg', quality: 93 }); };

  // Ritterin: feste Aufträge (wie im Test), Ruf beim Orden knapp unter Rang 5 – das Abholen bringt den neuen Rang
  await ev(() => {
    for (const a of ACH) SAVE.meta.ach[a.id] = 1;
    activateChar(0);
    const Hq = aufSet(), Rn = mulberry(7), mk = wk => ([k, n, x]) => { const q = aufMake(k, n, wk, Rn); if (x) q.x = x; return q; };
    Hq.dq = [['kill', 60], ['gat', 25, 'holz'], ['mkbuy', 1]].map(mk(false)); Hq.wq = [['bz', 1], ['harvest', 8], ['care', 20]].map(mk(true)); Hq.lo = [];
    Hq.dq[1].c = 14; Hq.wq[1].c = 3; Hq.wq[2].c = 12;
    fkGain('orden', fkRanks('orden')[4].at - Math.round(Hq.dq[0].rep / 2), 14, true); fkGain('gilde', 400, 9, true); fkGain('wild', 140, 3, true);
    SAVE.meta.lande.rep = 260; fkM().f.kund.tok = 6; fkCheck(true); P.fate = 5; saveChar(); persist();
  });

  // Aufhänger: Ritterin mitten in einer Horde (Zoom erst nach dem Aufbau des Raums – das Spiel setzt ihn beim ersten Raum neu)
  if (R.want('hook')) {
    await ev(() => { __seed(11); __fight(0, 6, ['skeleton', 'zombie', 'imp', 'chort'], { keepN: 8, dist: 40, tanky: 4 }); __step(16); __vp(3.2); __snap(); });
    await R.cap('hook', 48, `i => { __keep(.9); if (i === 0) { P.rage = 100; doUlt(); } if (i % 12 === 6) { P.cds[1] = 0; useSkill(1); } }`);
  }

  // Tagesauftrag im Kampf: 53/60 → 60/60
  if (R.want('quest')) {
    await ev(() => { __seed(31); __fight(0, 6, ['skeleton', 'zombie', 'imp', 'chort'], { keepN: 7, dist: 42 }); __step(8); __vp(3.2); __snap(); const q = aufSet().dq[0]; q.c = 53; q.ok = 0; q.pd = 0; window.__qc = []; });
    await R.cap('quest', 72, `i => { __keep(.6); if (i === 0) { P.rage = 100; doUlt(); } if (i % 14 === 6) { P.cds[1] = 0; useSkill(1); } window.__qc.push(aufSet().dq[0].c); }`);
    save('quest', 'info.json', await ev(() => { const q = aufSet().dq[0]; return { c: window.__qc, n: q.n, t: aufText(q), f: FK[q.f].n, ok: q.ok }; }));
  }

  // Versteck: zur Auftragstafel („!“ = Belohnung bereit)
  if (R.want('hide')) {
    await ev(() => {
      __off(); hideOverlay(); const q = aufSet().dq[0]; q.c = q.n; q.ok = 1; q.pd = 0;
      P.map = genMap(5); enterHideout(); __vp(2.6); const o = obs.find(x => x.k === 'station' && x.id === 'auftrag'); window.__ob = { x: o.x, y: o.y };
      P.x = o.x + 76; P.y = o.y + 58; P.inv = 1; __step(4); __snap();
    });
    await R.cap('hide', 60, `i => { P.inv = 1; keys.KeyJ = false; const o = window.__ob, dx = o.x + 16 - P.x, dy = o.y + 22 - P.y, go = i > 4; keys.KeyA = go && dx < -3; keys.KeyD = go && dx > 3; keys.KeyW = go && dy < -3; keys.KeyS = go && dy > 3; }`);
  }

  // Auftragstafel: erst die Liste, bei Bild 30 „Belohnung abholen“ → Belohnung mit neuem Rang
  if (R.want('board')) {
    await ev(() => { __off(); const q = aufSet().dq[0]; q.c = q.n; q.ok = 1; q.pd = 0; if (G.type !== 'versteck') { P.map = genMap(5); enterHideout(); } openStation('auftrag'); AUF.op = 0; panel.scrollTop = 0; });
    await page.waitForTimeout(400);
    const b0 = { panel: await rect('#panel'), card: await rect('#panel .aq', 0), claim: await rect('#panel [data-act="auf_claim"]', 0), h3: await rect('#panel .aqh3', 0) };
    await R.cap('board', 72, `i => { if (i === 30) { ON.auf_claim('d', null, 0); panel.scrollTop = 0; } }`);
    save('board', 'boxes.json', Object.assign(b0, { rev: await rect('#panel .aqrev'), up: await rect('#panel .aqup') }));
    save('board', 'info.json', await ev(() => ({ up: AUF.rev && AUF.rev.up.map(u => FK[u.f].n + ': ' + fkRanks(u.f)[u.r].n) })));
  }

  // Fraktionen und Quartiermeister (Standbilder)
  if (R.want('ruf')) {
    await ev(() => { ON.auf_ok(); ON.auf_tab('ruf'); panel.scrollTop = 0; });
    await still('ruf', 'list');
    const b = { panel: await rect('#panel'), rows: await rect('#panel .split > div', 0), r0: await rect('#panel .fkrow', 0), r3: await rect('#panel .fkrow', 3) };
    await ev(() => { AUF.qf = 'gilde'; ON.auf_tab('qm'); panel.scrollTop = 0; });
    await still('ruf', 'qm');
    Object.assign(b, { q0: await rect('#panel .fkoff', 0), q3: await rect('#panel .fkoff', 3), say: await rect('#panel .say') });
    save('ruf', 'boxes.json', b);
  }

  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
