// Clip „Boss mit letzter Kraft“: EIN echter Übungskampf aus dem Boss-Kodex, komplett mitgeschnitten (Ritterin + Jungdrache LV 150 gegen Boss Rang 364).
// Kein Eingriff in den Kampf: keine Unverwundbarkeit, keine Tränke, kein Festhalten des Bosses – gespielt vom Bot aus bot.js.
// Kämpfe gehen jedes Mal anders aus; aufgenommen wird, bis einer knapp gewonnen ist (Lebensbund hat ausgelöst, Sieg mit höchstens 15 % Leben).
// raw/fight/0000.jpg … und raw/log.json (Leben von Held und Boss je Bild, Bild des Lebensbunds, Bild des Sieges).
// Aufruf: PROMO_OUT=/tmp/klingenhort-boss BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-boss';
const BASE = process.env.BASE || 'http://localhost:8766/';
const CFG = Object.assign({ id: 363, sloppy: .3, roll: .2, zoom: 2.8 }, JSON.parse(process.env.CFG || '{}'));
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 5, base: BASE });
  const { ev, page } = R;
  if (!fs.existsSync(OUT + '/raw/assets/assets.json')) await R.assets();
  await ev(require('./bot.js'));
  for (let take = 1; take <= +(process.env.TAKES || 6); take++) {
    const d = R.dir('fight'); const t0 = Date.now();
    await ev(([s, o]) => __setup(s, o), [take + 10 + (+process.env.S0 || 0), CFG]);
    let win = -1, i = 0, st = 'play';
    for (; i < 2600; i++) {
      [st, win] = await ev(([i, win]) => { __bot(i); __step(1); if (win < 0 && state === 'play' && !enemies.some(e => e.boss && !e.dead)) win = i; return [state, win]; }, [i, win]);
      await page.screenshot({ path: `${d}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
      if (st === 'dead' && i > 0 && !(await ev(() => window.__deadN = (window.__deadN || 0) + 1) < 40)) break;
      if (win >= 0 && i > win + 100) break;
    }
    const r = await ev(id => { const B = bossDef(id); return { log: window.__log, bond: window.__bond, info: { name: B.name, title: B.title, rank: B.rank, band: bossRankName(id), mech: B.mech.map(k => BMECH[k].n) }, pet: window.__pet.nm || PET_SP[window.__pet.sp].n, hpmax: P.st.hp }; }, CFG.id);
    await ev(() => { window.__deadN = 0; });
    const hpWin = win >= 0 ? r.log[win].hp : 0, ok = win >= 0 && r.bond > 0 && hpWin <= .15;
    console.log('Aufnahme', take, 'Bilder', i, 'Sieg', win, 'Lebensbund', r.bond, 'Leben beim Sieg', hpWin.toFixed(3), ok ? 'GUT' : 'nochmal', Math.round((Date.now() - t0) / 1000) + ' s');
    if (ok) { fs.writeFileSync(OUT + '/raw/log.json', JSON.stringify({ win, n: i, ...r })); break; }
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
