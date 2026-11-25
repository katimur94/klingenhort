// Fund-Clip „Case-Opening: 3 Drehs an der Glücksrolle“ (Glückstempel, js/hideout.js): drei echte Drehs hintereinander, kein Ergebnis ausgesucht.
// Die Rolle ist eine CSS-Animation (5,2 s). Für saubere Bilder läuft sie per DevTools 5× langsamer (Animation.setPlaybackRate, performance.now
// ebenso) – im Schnitt wird das wieder auf Echtzeit gebracht (raw/spins.json: Spielzeit je Bild).
// Aufruf: PROMO_OUT=/tmp/klingenhort-rolle BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-rolle';
const BASE = process.env.BASE || 'http://localhost:8766/';
const SLOW = 5;
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 25, base: BASE });
  const { ev, page } = R;
  await R.assets();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  await ev(SLOW => {
    // eigene Bildschleife des Browsers wieder an (das Werkzeug schaltet sie für Kampfszenen ab), Spielzeit 5× langsamer
    const f = document.createElement('iframe'); f.style.display = 'none'; document.body.appendChild(f);
    window.requestAnimationFrame = f.contentWindow.requestAnimationFrame.bind(f.contentWindow);
    const pn = performance.now.bind(performance), t0 = pn(); performance.now = () => t0 + (pn() - t0) / SLOW;
    activateChar(0); P.fate = 3; G = null; setState('menu'); ROLL = null; openTemple(); panel.scrollTop = 0;
  }, SLOW);
  await page.waitForTimeout(500);
  const d = R.dir('rolle'), info = []; let n = 0;
  for (let s = 0; s < 3; s++) {
    const t0 = await ev(() => { doSpin(); panel.scrollTop = 0; return performance.now(); });
    let done = 0;
    while (true) {
      const st = await ev(() => ({ t: performance.now(), anim: !!(ROLL && ROLL.anim), res: ROLL && ROLL.res ? ROLL.res.t : '' }));
      await page.screenshot({ path: `${d}/${String(n).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 });
      info.push({ n, s, t: (st.t - t0) / 1000, anim: st.anim, res: st.res }); n++;
      if (!st.anim) { if (!done) done = st.t; if (st.t - done > 1600) break; }
    }
    await ev(() => { ROLL = ROLL && !ROLL.anim ? ROLL : ROLL; });
  }
  fs.writeFileSync(OUT + '/raw/spins.json', JSON.stringify(info));
  console.log('Bilder', n, 'Ergebnisse', [...new Set(info.filter(x => !x.anim).map(x => x.s + ':' + x.res))].join(' | '));
  const errs = await R.close();
  if (errs.length) console.log(errs);
  process.exit(errs.length ? 1 : 0);
})();
