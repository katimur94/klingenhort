// Probeläufe ohne Aufnahme: sucht Boss/Startwert, bei dem der echte Kampf knapp gewonnen wird (Lebensbund löst aus, Sieg mit wenig Leben)
// Aufruf: CFG='[{"id":640,"react":0.8,"roll":0.3,"n":4}]' node tune.js   ·   CAND='600,700' node tune.js (Kandidaten zeigen)
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
(async () => {
  const R = await H.open({ out: process.env.PROMO_OUT + '/tune', seed: 1, base: 'http://localhost:8766/' });
  await R.ev(require('./bot.js'));
  if (process.env.CAND) { const [a, b] = process.env.CAND.split(',').map(Number); console.log(JSON.stringify(await R.ev(([a, b]) => __cands(a, b), [a, b]))); }
  for (const o of JSON.parse(process.env.CFG || '[]')) for (let seed = o.s0 || 1; seed < (o.s0 || 1) + (o.n || 4); seed++) {
    const r = await R.ev(([seed, o]) => {
      __setup(seed, o); let i = 0, win = -1; const b0 = enemies.find(e => e.boss); window.__b0 = b0 ? [Math.round(b0.maxHp), Math.round(b0.atk)] : 0;
      for (; i < (o.max || 2400); i++) { __bot(i); __step(1); if (state !== 'play') break; if (win < 0 && !enemies.some(e => e.boss && !e.dead)) win = i; if (win >= 0 && i > win + 3) break; }
      const L = window.__log, min = Math.min(...L.map(x => x.hp));
      return { b0: window.__b0, hpmax: P.st.hp, def: P.st.def, wb: Math.round(P.st.wbase), stage: BA && BA.stage, lvl: P.lv, seed, win, end: i, st: state, hp: +(P.hp / P.st.hp).toFixed(3), min: +min.toFixed(3), bond: window.__bond, boss: +(L[L.length - 1].b).toFixed(2) };
    }, [seed, o]);
    console.log(o.id, JSON.stringify(r));
  }
  await R.close(); process.exit(0);
})();
