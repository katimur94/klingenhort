// Tages-Clip „Wusstest du? Rolle durch die Schockwelle“ (Mini-Tutorial mit Faxen): echter Übungskampf aus dem Boss-Kodex (Rang 340, Mechanik „Schockwellen“)
// falsch: die Ritterin bleibt bei der Ansage stehen und wird von der Welle getroffen · richtig: sie rollt hindurch (beim Rollen trifft nichts – Tipp aus dem Spiel)
// Kein Eingriff in den Kampf (Bot aus ../2026-11-10b/bot.js); aufgenommen wird ab der Ansage „SCHOCKWELLEN“, bis je eine passende Szene im Kasten ist.
// Aufruf: PROMO_OUT=/tmp/klingenhort-rolle BASE=http://localhost:8766/ node scenes.js
const path = require('path'), fs = require('fs');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-rolle';
const BASE = process.env.BASE || 'http://localhost:8766/';
const N = 80;
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 3, base: BASE });
  const { ev, page } = R;
  await R.assets();
  await ev(require('../2026-11-10b/bot.js'));
  const info = {};
  for (const mode of ['falsch', 'richtig']) {
    for (let take = 1; take <= 8 && !info[mode]; take++) {
      await ev(([s, o]) => { __setup(s, o); window.__call0 = null; }, [take + (mode === 'falsch' ? 40 : 60), { id: 339, react: .9, roll: .3, zoom: 3.1 }]);
      // spielen, bis der Boss „Schockwellen“ ansagt
      const found = await ev(() => { for (let i = 0; i < 1500; i++) { __bot(i); __step(1); if (state !== 'play') return false; if (BZ.call && /SCHOCK/.test(BZ.call.s) && BZ.call.t > 1.5) return true; } return false; });
      if (!found) continue;
      const d = R.dir(mode), log = [];
      for (let i = 0; i < N; i++) {
        log.push(await ev(([i, stand]) => { if (stand) { keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = keys.KeyJ = false; } else __bot(i); __step(1); return { hp: P.hp / P.st.hp, roll: P.roll > 0 ? 1 : 0, w: BZ.fx.filter(z => z.k === 'w').length }; }, [i, mode === 'falsch']));
        await page.screenshot({ path: `${d}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
      }
      const hit = log.findIndex((x, i) => i && x.hp < log[i - 1].hp - .01), roll = log.findIndex(x => x.roll), wave = log.findIndex(x => x.w);
      const ok = mode === 'falsch' ? hit >= 0 : hit < 0 && roll >= 0 && wave >= 0;
      console.log(mode, 'Aufnahme', take, 'Treffer', hit, 'Rolle', roll, 'Welle', wave, ok ? 'GUT' : 'nochmal');
      if (ok) info[mode] = { hit, roll, wave, hp0: log[0].hp, hp1: log[N - 1].hp };
    }
  }
  info.boss = await ev(() => { const B = bossDef(339); return { name: B.name, rank: B.rank, band: bossRankName(339) }; });
  fs.writeFileSync(OUT + '/raw/info.json', JSON.stringify(info)); console.log(JSON.stringify(info));
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
