// Meme-Clip „POV: Du gehst schlafen … und am Morgen“ (Kriegskarte aus 6.9): die Fronten wandern auch, wenn niemand spielt.
// abend:  Kriegskarte am Abend (Startaufteilung), Aurelien gewählt
// morgen: dieselbe Karte nach 3 Kriegstagen (= 9 Stunden, eine Nacht) – gerechnet mit kkTag wie offline; Provinzen, die gewechselt haben, blinken
// Der Nacht-Verlauf ist echt (fester Zufall je Kriegstag), ausgesucht wurde nur ein Startag, an dem Aurelien Provinzen verliert (raw/info.json).
// Aufruf: PROMO_OUT=/tmp/klingenhort-pov BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-pov';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 28, base: BASE });
  const { ev, page } = R;
  await R.assets();
  const ui = async (name, n, fn) => {
    const d = R.dir(name), box = []; for (let i = 0; i < n; i++) { if (fn) await ev(fn, i); await page.waitForTimeout(40); await page.screenshot({ path: `${d}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
      box.push(await ev(() => { const r = e => { const q = e && e.getBoundingClientRect(); return q ? [q.left, q.top, q.width, q.height].map(Math.round) : null; }; return { panel: r(panel), map: r(panel.querySelector('.kkmap')), log: r(panel.querySelector('.kklog')) }; })); }
    fs.writeFileSync(`${d}/box.json`, JSON.stringify(box));
  };
  // Startag suchen: in drei Kriegstagen verliert Aurelien mindestens zwei Provinzen und gewinnt keine
  const info = await ev(() => {
    activateChar(0); P.lv = 40; P.act = 8; P.maxAct = 9; P.map = genMap(8); SAVE.meta.krieg.pro = 1;
    for (let a = 700000; a < 760000; a += 3) { const K = kkDef(); for (let d = 1; d <= 3; d++) kkTag(K, a + d); const n = kkZahl(K, 'aurelien'); if (n <= 7 && K.log.every(e => e.a !== 'aurelien')) return { a, n, log: K.log.map(e => kkLogTxt(e)) }; }
    return null;
  });
  console.log(JSON.stringify(info));
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(info));
  await ev(() => { __off(); SAVE.meta.krieg.karte = kkDef(); KKV.sel = KK_FEST.aurelien; kkOpen('map'); panel.scrollTop = 0; });
  await ui('abend', 30);
  await ev(a => { const K = kkKarte(); for (let d = 1; d <= 3; d++) kkTag(K, a + d); K.t = kkJetzt(); KKV.sel = -1; kkOpen(); panel.scrollTop = 0; }, info.a);
  await ui('morgen', 60);
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
