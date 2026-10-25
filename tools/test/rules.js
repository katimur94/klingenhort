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
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
