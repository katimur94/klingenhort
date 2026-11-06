// Meme-Clip „200 IQ vs. Realität“ (~12 s): echte Aufnahmen aus Akt 9 (Sturmgipfel, 6.5) – der Blitz trifft wirklich alle im Kreis
// brain: Held lockt die Donnerzwerge in den Warnkreis und steht daneben – Einschlag räumt ab
// dumb: zweiter Versuch – der Held steht selbst mitten im Kreis (echter Schaden am Helden, Leben reicht)
// Aufruf: PROMO_OUT=/tmp/klingenhort-iq BASE=http://localhost:8765/ node scenes.js [szene]
const path = require('path');
const H = require(path.join(__dirname, '..', '..', 'harness'));
const OUT = process.env.PROMO_OUT || '/tmp/klingenhort-iq';
(async () => {
  const R = await H.open({ out: OUT + '/raw', seed: 6 });
  const { ev } = R;
  if (R.want('assets')) await R.assets();
  await ev(() => {
    window.__txtOK = /^\d+$/;   // Schadenszahlen zeigen (der Treffer am Helden soll man sehen)
    window.__room9 = (dx) => {
      activateChar(0); P.lv = 80; computeStats();
      __fight(0, 9, [], { keepN: 0 }); P.act = 9; window.__kinds = null; for (const e of enemies) e.dead = true; enemies = [];
      G.pending = [{ t: 1e9, type: 'imp' }]; SKY.t = 99; __vp(4.2); window.__camDX = dx; window.__camDY = -6;
      P.st.hp = P.hp = 420;   // Lebensleiste: der Einschlag am Helden ist deutlich zu sehen
      for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283; const e = spawnEnemy('donnerzwerg', { x: P.x + 52 + Math.cos(a) * 12, y: P.y + Math.sin(a) * 9, instant: true }); e.spd = 0; e.cd = 99; e.atk = 0; e.hp = e.maxHp = 300; }   // der Blitz (2,4-fach gegen Gegner) haut sie um
      __step(4); __snap();
    };
    window.__hold = () => { P.st.hp = 420; keys.KeyJ = keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = false; for (const e of enemies) { e.cd = 99; e.spd = 0; } };
  });
  // 1) BIG BRAIN: Kreis unter den Gegnern, Held steht daneben
  if (R.want('brain')) {
    await ev(() => window.__room9(26));
    await R.cap('brain', 72, `i => { window.__hold(); P.inv = 1; if (i === 8) sturmStrike(P.x + 52, P.y, { t: 1.1, r: 24 }); }`);
  }
  // 2) zweiter Versuch: Held mitten in der Gruppe – der Kreis liegt auch unter ihm
  if (R.want('dumb')) {
    await ev(() => { window.__room9(0); for (const e of enemies) { e.x -= 44; } P.x += 6; __snap(); });
    await R.cap('dumb', 84, `i => { window.__hold(); P.inv = i < 30 ? 1 : 0; if (i === 4) sturmStrike(P.x, P.y, { t: 1.1, r: 26 }); }`);
  }
  const errs = await R.close();
  process.exit(errs.length ? 1 : 0);
})();
