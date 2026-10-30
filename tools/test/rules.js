// Spielregeln direkt prüfen (ohne Antippen). Aufruf: node rules.js
// Für jedes neue Feature hier eine kurze Prüfung ergänzen.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  console.log('Spielregeln');
  const r = await page.evaluate(() => {
    const o = {};
    const c = newChar('knight', 'Test', 'normal', false); SAVE.chars.push(c); activateChar(0); P.lv = 20; computeStats();
    // Wochen-Ereignisse (4.2)
    o.sameWeek = weekNo(new Date(2026, 9, 26, 0, 5)) === weekNo(new Date(2026, 10, 1, 23, 55));
    o.nextWeek = weekNo(new Date(2026, 10, 2, 0, 5)) === weekNo(new Date(2026, 10, 1, 23, 55)) + 1;
    o.rotation = new Set([0, 1, 2, 3, 4].map(i => weekEvent(i).id)).size === WEEKLY.length;
    window.WEEK_FORCE = 'gold'; computeStats(); o.gold = P.st.gold >= .5;
    window.WEEK_FORCE = 'schmiede'; const a = upCost(P.gear.weapon, 5); window.WEEK_FORCE = 'blut'; const n = upCost(P.gear.weapon, 5); o.smith = a.gold < n.gold;
    P.map = genMap(3); startRoom('kampf', 2); o.loot = Math.abs(G.lootMul - 1.3) < 1e-9;
    window.WEEK_FORCE = 'glueck'; SAVE.meta.hide.b.tempel = 1; SAVE.meta.luck.day = 0; o.spin = freeSpin() === 'day'; SAVE.meta.luck.day = dayKey(); o.spinOnce = freeSpin() === null;
    G.daily = 1; window.WEEK_FORCE = 'gold'; o.daily = weekFx('gold') === 0; G.daily = null; window.WEEK_FORCE = null;
    // Fortschritt (4.3.1): Level nach 8 Akten aus den echten Wellen (6 Kampfräume + Boss je Akt), Seltenheit der Beute
    let lv = 1, xp = 0;
    for (let act = 1; act <= 8; act++) for (let row = 0; row < 7; row++) {
      P.act = act; G = { row, lootMul: 1 }; const st = stageNum(), S = scaleOf(st), base = 4 + st * 1.4;
      for (let k = 0; k < 4; k++) for (let w = 0; w < Math.min(4, 2 + Math.floor(st / 6)); w++) for (const e of buildWave(st, base + w * 1.3)) xp += EN[e].xp * S.rm * 1.15 / 4;
      if (row === 6) xp += 60 * S.rm * 8;
      while (lv < 50 && xp >= xpNext(lv)) { xp -= xpNext(lv); lv++; }
    }
    o.lv8 = lv; o.pow50 = lvPow(50); G = null; setState('menu'); // Rechen-Räume wieder weg
    const cnt = [0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < 20000; i++) cnt[randomItem(10, 0).rar]++;
    o.leg = cnt[4] / 200; o.rarePlus = (cnt[2] + cnt[3] + cnt[4] + cnt[5]) / 200;
    // Glücksrolle (5.0.1): reiner Zufall, keine Garantie; die Rolle zeigt den gezogenen Gewinn
    const wc = {}; for (let i = 0; i < 20000; i++) { const k = wheelPick(); wc[k] = (wc[k] || 0) + 1; } o.myth = wc.myth / 200;
    SAVE.meta.luck.pityM = 79; SAVE.meta.luck.pityL = 99; let forced = 0; for (let i = 0; i < 40; i++) if (wheelPick() === 'myth') forced++; o.noPity = forced < 4;
    return o;
  });
  ok(r.sameWeek && r.nextWeek, 'Wochen-Ereignis wechselt montags');
  ok(r.rotation, 'alle Wochen-Ereignisse kommen an die Reihe');
  ok(r.gold, 'Goldrausch: +50 % Gold');
  ok(r.smith, 'Schmiedewoche: Aufwerten günstiger');
  ok(r.loot, 'Blutmond: 30 % mehr Beute');
  ok(r.spin && r.spinOnce, 'Glückswoche: ein Gratis-Dreh pro Tag');
  ok(r.daily, 'Tages-Challenge bleibt ohne Wochen-Ereignis');
  ok(r.lv8 >= 20 && r.lv8 <= 28, `nach der Geschichte (Akt 8) Level ${r.lv8}: Talente noch nicht voll (20–28 erwartet)`);
  ok(Math.abs(r.pow50 - 49) < 1, 'Level 50 bleibt so stark wie früher');
  ok(r.leg < 1.5 && r.rarePlus < 25, `Beute: ${r.leg} % Legendär, ${r.rarePlus.toFixed(1)} % Selten oder besser`);
  ok(r.myth > .15 && r.myth < .8 && r.noPity, `Glücksrolle: Mythisch ${r.myth.toFixed(2)} % – reiner Zufall, keine Garantie`);
  const roll = await page.evaluate(async () => {
    SAVE.meta.pets.starter = true; P.fate = 5; P.map = genMap(2); enterHideout(); openStation('tempel'); const free = !!freeSpin(); doSpin();
    const during = !!document.querySelector('#roll.spin'), fateAfter = P.fate; // Gratis-Dreh (erster im Akt, Glückswoche) kostet nichts
    ON.rollskip(); // sofort überspringen: auch dann richtig stehen
    const box = $('roll').getBoundingClientRect(), mid = box.left + box.width / 2, w = document.querySelector('#roll .tile.win'), wr = w && w.getBoundingClientRect();
    return { during, paid: fateAfter === (free ? 5 : 4), onWin: !!wr && wr.left <= mid && wr.right >= mid, res: !!panel.querySelector('.rollres') };
  });
  ok(roll.during && roll.paid && roll.onWin && roll.res, 'Glücksrolle: dreht, bleibt auf dem Gewinn stehen, Gewinn wird angezeigt' + (roll.during && roll.paid && roll.onWin && roll.res ? '' : ' ' + JSON.stringify(roll)));
  // Aufträge & Ruf (6.3): Belohnungen im Rahmen, Kills zählen, Vorteile gedeckelt, Bestes anlegen, Beute-Filter
  const auf = await page.evaluate(() => {
    const o = {}; hideOverlay(); SAVE.meta.auf.h = {}; AUF.hid = null; P.lv = 20; computeStats();
    const H = aufSet(), g = q => (q.rw.find(e => e.t === 'gold') || { n: 0 }).n, room = 12 + 20 * 9;   // Bonus für einen geschafften Raum auf Stufe 20
    o.n = H.dq.length === 3 && H.wq.length === 3;
    o.gold = H.dq.every(q => g(q) >= room * 2 && g(q) <= room * 8) && H.wq.every(q => g(q) >= g(H.dq[0]) * 3);
    o.rep = H.dq.every(q => q.rep >= 40 && q.rep <= 80 && q.tok >= 2 && q.tok <= 3) && H.wq.every(q => q.rep >= 200 && q.tok >= 8);
    H.dq[0] = aufMake('kill', 2, false, mulberry(3)); P.map = genMap(3); startRoom('kampf', 1); P.inv = 1e9;
    for (let i = 0; i < 2; i++) { const e = spawnEnemy('goblin', { x: P.x + 20, y: P.y, instant: true }); hurtEnemy(e, 1e9, 0, 0, 0); }
    o.kill = H.dq[0].ok === 1 && aufReady() >= 1; const t0 = fkTok('orden'); o.claim = aufClaim('d', 0).ok && fkTok('orden') === t0 + H.dq[0].tok && aufClaim('d', 0).err === 'none';
    // Vorteile: auch auf dem höchsten Rang klein
    for (const f of FKORDER) if (f !== 'kund') fkGain(f, 1e6, 0, true); computeStats();
    o.cap = perk('buy', 1) >= .9 && perk('sell', 1) <= 1.1 && mkFee() >= .02 && perk('gather', 0) <= .3 && perk('farm', 1) <= 1.35 && perk('egg', 1) <= 1.4 && mod('xp') - hideLv('bibliothek') * .05 <= .081;
    // Bestes anlegen nimmt nie etwas Schlechteres, Beute-Filter verschont Besseres und Besonderes
    P.bag = [makeItem({ slot: 'weapon', base: 'sword', tier: 0, rar: 0 }), makeItem({ slot: 'weapon', base: 'staff', tier: 9, rar: 4 })]; const w = P.gear.weapon; equipBest(); o.best = P.gear.weapon === w || itemScore(P.gear.weapon) > itemScore(w);
    SAVE.meta.settings.loot = { c: 'sell', m: 'leave' }; P.gear.helm = makeItem({ slot: 'helm', base: 'helm', tier: 5, rar: 3 });
    const c0 = makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }), m0 = makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 1 }), r0 = makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 2 }), u0 = makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }); u0.up = 1;
    o.filter = lootRule(c0) === 'sell' && lootRule(m0) === 'leave' && lootRule(r0) === 'take' && lootRule(u0) === 'take' && lootRule(c0, true) === 'take' && lootRule(m0, true) === 'leave';
    SAVE.meta.settings.loot = { c: 'take', m: 'take' }; o.off = lootRule(c0) === 'take';
    G = null; setState('menu'); return o;
  });
  ok(auf.n, 'Aufträge: 3 Tages- und 3 Wochenaufträge');
  ok(auf.gold && auf.rep, 'Aufträge: Gold je Tagesauftrag 2–8 Raum-Boni, Woche mindestens dreimal so viel; Ruf und Ruf-Marken im Rahmen');
  ok(auf.kill && auf.claim, 'Aufträge: Kills zählen, Abholen bringt Ruf-Marken genau einmal');
  ok(auf.cap, 'Fraktionen: Vorteile gedeckelt (Einkauf ≤ 10 % günstiger, Verkauf ≤ 10 % mehr, Gebühr ≥ 2 %, Sammeln ≤ 30 %, Erfahrung ≤ 8 %)');
  ok(auf.best, 'Bestes anlegen: nie etwas Schlechteres, nichts für andere Klassen');
  ok(auf.filter && auf.off, 'Beute-Filter: Gewöhnliches verkaufen, Magisches liegen lassen, Seltenes und Aufgewertetes immer aufheben; in den Landen nie verkaufen');
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
