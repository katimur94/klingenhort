// Aufnahmen für den TikTok-Clip zu 6.9 „Krieg der Kronen 3 – Die Kriegskarte“ (~16 s), alles echte Bildschirme und Szenen aus js/kriegskarte.js:
// zeit:  Kriegskarte im Zeitraffer – das Spiel rechnet Kriegstag um Kriegstag (kkTag, derselbe Ablauf wie offline), Provinzen wechseln die Farbe
// wahl:  eine Grenz-Provinz von Nordmark antippen, „Für Sylvara erobern“ – der Feldzug steht
// kampf: die Schlacht des Feldzugs (Sylvara gegen Nordmark), die Ritterin kämpft mit
// sieg:  dritter Sieg → Ergebnis „Feldzug gewonnen: Sylvara erobert …“ (echter Ergebnis-Bildschirm)
// neu:   Kriegskarte danach – die Provinz leuchtet in der Farbe von Sylvara
// Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.9 BASE=http://localhost:8766/ node scenes.js [szene,…]
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-clip-6.9';
const BASE = process.env.BASE || 'http://localhost:8766/';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 69, base: BASE });
  const { ev, page } = R;
  if (R.want('assets')) await R.assets();
  const ui = async (name, n, fn) => {   // Bildschirm-Aufnahme ohne Spielschleife: fn(i) vor jedem Bild
    const d = R.dir(name), box = []; for (let i = 0; i < n; i++) { if (fn) await ev(fn, i); await page.waitForTimeout(40); await page.screenshot({ path: `${d}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
      box.push(await ev(() => { const r = e => { const q = e && e.getBoundingClientRect(); return q ? [q.left, q.top, q.width, q.height].map(Math.round) : null; }; return { map: r(panel.querySelector('.kkmap')), panel: r(panel), fz: r(panel.querySelector('.kkfz')), lohn: r([...panel.querySelectorAll('.krziel')].find(e => /KRIEGSKARTE/.test(e.textContent))) }; })); }
    fs.writeFileSync(`${d}/box.json`, JSON.stringify(box));   // Lage von Karte und Tafel je Bild (für den Ausschnitt im Schnitt)
  };
  await ev(() => {
    window.__txtNo = /^\d+$/;
    activateChar(0); P.lv = 40; P.act = 8; P.maxAct = 9; P.map = genMap(8); computeStats(); P.hp = P.st.hp; SAVE.meta.krieg.pro = 1;
    SAVE.meta.krieg.karte = kkDef(); window.__abs = 600000;
    window.__keys = (w, a, s, d, j) => { keys.KeyW = !!w; keys.KeyA = !!a; keys.KeyS = !!s; keys.KeyD = !!d; keys.KeyJ = !!j; };
    window.__hold = () => { P.inv = 1; P.hp = P.st.hp; P.res = P.st.resMax; KR.moral = Math.max(KR.moral, 64); if (KR.ziel === 'linie') KR.zt = Math.max(KR.zt, 48); };
    window.__cam = (x, y) => { window.__camDX = x - P.x; window.__camDY = y - P.y + 10; };
    window.__kampf = (cx, cy, rad) => { let b = null, d = 1e9; for (const e of enemies) if (e.kr && !e.dead && !e.mach) { const q = Math.hypot(e.x - P.x, e.y - P.y); if (q < d && Math.hypot(e.x - cx, e.y - cy) < rad) { d = q; b = e; } }
      const tx = b ? b.x : cx, ty = b ? b.y + 4 : cy, dx = tx - P.x, dy = ty - P.y, n = b ? 20 : 5, far = Math.hypot(dx, dy) > n; __keys(far && dy < -4, far && dx < -4, far && dy > 4, far && dx > 4, !!b && d < 60); return b; };
  });
  // --- Zeitraffer: Kriegstag für Kriegstag ---
  if (R.want('zeit')) {
    await ev(() => { __off(); kkOpen('map'); panel.scrollTop = 0; });
    await ui('zeit', 60, i => { if (i % 3 === 2) { const K = kkKarte(); kkTag(K, ++__abs); K.t = kkJetzt(); kkOpen(); panel.scrollTop = 0; } });
    fs.writeFileSync(OUT + '/raw/zeit/info.json', JSON.stringify(await ev(() => ({ tag: kkKarte().tag, log: kkKarte().log.length }))));
  }
  // --- Provinz wählen, Feldzug für Sylvara ---
  if (R.want('wahl')) {
    const p = await ev(() => { const K = kkKarte(); const g = kkGrenzen(K).filter(([q, b]) => K.o[q] === 'nordmark' && b === 'sylvara'); window.__p = g[0][0]; KKV.sel = -1; kkOpen(); panel.scrollTop = 0; return __p; });
    await ui('wahl', 44, i => { if (i === 8) { KKV.sel = __p; kkOpen(); panel.scrollTop = 0; } if (i === 24) ON.kk_fz(__p + ':sylvara:1'); if (i > 24) panel.scrollTop = 0; });
    fs.writeFileSync(OUT + '/raw/wahl/info.json', JSON.stringify(await ev(() => ({ p: __p, name: KK_NAMEN[__p] }))));
  }
  // --- Schlacht des Feldzugs ---
  if (R.want('kampf')) {
    await ev(() => { __seed(9); __vp(3); KR.row = 3; startRoom('krieg', 3, { krSeite: 'sylvara', krFeind: 'nordmark', fz: 1, krZiel: 'linie' }); __off(); for (let i = 0; i < 150; i++) { __hold(); __step(1); } const p = krPos(.45, .5); P.x = p.x; P.y = p.y; __snap(); window.__c = [p.x, p.y]; for (let i = 0; i < 8; i++) { __hold(); __kampf(p.x, p.y, 60); __cam(p.x, p.y); __step(1); } });
    await R.cap('kampf', 96, `i => { __hold(); const b = __kampf(__c[0], __c[1], 70); __cam(__c[0], __c[1] - 6); }`);
  }
  // --- dritter Sieg: Ergebnis ---
  if (R.want('sieg')) {
    await ev(() => { __off(); const K = kkKarte(); if (!K.fz) ON.kk_fz(__p + ':sylvara:1'); K.fz.n = 2; if (!KR.on || KR.aus) { __seed(9); startRoom('krieg', 3, { krSeite: 'sylvara', krFeind: 'nordmark', fz: 1, krZiel: 'linie' }); for (let i = 0; i < 30; i++) { __hold(); __step(1); } } P.inv = 9; krEnd(true); KR.endT = 0; for (let i = 0; i < 4; i++) update(1 / 60); panel.scrollTop = 0; });
    await page.waitForTimeout(300);
    await ui('sieg', 40, i => { panel.scrollTop = Math.min(i * 6, 140); });
  }
  // --- Kriegskarte danach ---
  if (R.want('neu')) {
    await ev(() => { G = null; const K = kkKarte(); K.nb = [__p]; KKV.sel = __p; kkOpen('map'); panel.scrollTop = 0; });
    await ui('neu', 36);
  }
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
