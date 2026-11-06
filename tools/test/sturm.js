// Sturmgipfel (6.5): Akt 9 mit eigenem Gebiet, Boss Sturmkönig Aerok, Blitz-Gegnern und Sturmsilber; die Qual beginnt jetzt mit Akt 10.
// Prüft: Akt-Reihenfolge und Qual-Stufen, Umstellung alter Spielstände (Qual-Helden rücken einen Akt weiter, genau einmal),
// Gewitter (angekündigter Einschlag trifft im Kreis dich und Gegner, daneben nichts; kein Gewitter in anderen Akten und im Versteck),
// Aerok ruft Blitze (unter 50 % Leben mehr), Gegner nur ab Akt 9 in den Wellen und in den Sturm-Gebieten der Endlosen Lande,
// Sturmsilber als Beute, Bildschirmfotos (hoch, quer) von Akt 9 und dem Bosskampf.
// Aufruf: node sturm.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/sturm';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(1200);
  const ev = (f, a) => page.evaluate(f, a);

  // Akte und Qual
  const A = await ev(() => ({ n: STORY_ACTS, b9: biomeOf(9).key, b10: biomeOf(10).key, boss9: bossOf(9).type, boss10: bossOf(10).type, q8: qualOf(8), q9: qualOf(9), q10: qualOf(10), acts: ACTS.length, t9: ACTS[8] && ACTS[8].t }));
  ok(A.n === 9 && A.acts === 9, 'Neun Akte der Geschichte (' + A.t9 + ')');
  ok(A.b9 === 'sturm' && A.boss9 === 'aerok', 'Akt 9: Sturmgipfel mit Sturmkönig Aerok');
  ok(A.q8 === 0 && A.q9 === 0 && A.q10 === 1 && A.b10 === 'kerker' && A.boss10 === 'ogre', 'Qual 1 beginnt mit Akt 10 (wieder in den Kerkern)');

  // Alte Spielstände: Helden in der Qual rücken einen Akt weiter, alle anderen bleiben; nur einmal
  const M = await ev(() => {
    localStorage.clear(); loadAll();
    const mk = (act, maxAct) => { const c = newChar('knight', 'Alt' + act, 'normal', false); c.act = act; c.maxAct = maxAct; c.stats = { maxAct }; delete c.st9; SAVE.chars.push(c); return SAVE.chars.length - 1; };
    const r = {};
    for (const [a, m] of [[5, 5], [8, 8], [9, 9], [12, 14]]) { const i = mk(a, m); activateChar(i); saveChar(); r[a] = [P.act, P.maxAct, P.stats.maxAct, qualOf(P.act)]; activateChar(i); r[a + 'b'] = [P.act, P.maxAct]; }
    const n = newChar('mage', 'Neu', 'normal', false); SAVE.chars.push(n); activateChar(SAVE.chars.length - 1); P.act = 9; P.maxAct = 9; saveChar(); activateChar(SAVE.chars.length - 1);
    r.neu = [P.act, P.maxAct];
    return r;
  });
  ok(M[5][0] === 5 && M[8][0] === 8 && M[5][1] === 5, 'Alte Helden in der Geschichte bleiben in ihrem Akt');
  ok(M[9][0] === 10 && M[9][3] === 1 && M[12][0] === 13 && M[12][1] === 15 && M[12][2] === 15 && M[12][3] === 4, 'Alte Helden in der Qual rücken einen Akt weiter – Qual-Stufe bleibt gleich');
  ok(M['9b'][0] === 10 && M['12b'][0] === 13, 'Umstellung nur einmal (zweites Laden ändert nichts)');
  ok(M.neu[0] === 9, 'Neue Helden in Akt 9 bleiben im Sturmgipfel');

  // Gegner: nur ab Akt 9 in den Wellen, in den Sturm-Gebieten der Lande
  const W = await ev(() => {
    const st = ['sturmharpyie', 'sturmrufer', 'donnerzwerg', 'blitzgolem'];
    const p56 = poolFor(56), p63 = poolFor(63);
    P.act = 9; const fav = biomeFav(57);
    const lande = ['sturmklippen', 'himmelsklippen', 'splittergebirge'].every(b => st.filter(k => k !== 'donnerzwerg').every(k => LANDE_BIOMES[b].en.includes(k)));
    const el = st.concat('aerok').every(k => EN_EL[k] === 'blitz');
    return { before: st.some(k => p56.includes(k)), after: st.every(k => p63.includes(k)), fav: st.slice(0, 3).every(k => fav.includes(k)), lande, el, mat: !!MATS.sturmsilber && MATORDER.includes('sturmsilber') && MONMATS.includes('sturmsilber'), drop: st.every(k => EN[k].drop.sturmsilber > 0) && EN.aerok.drop.sturmsilber >= 5 };
  });
  ok(!W.before && W.after && W.fav, 'Blitz-Gegner erst ab Akt 9 (Stufe 57) in den Wellen, im Sturmgipfel bevorzugt');
  ok(W.lande, 'Blitz-Gegner in den Sturm-Gebieten der Endlosen Lande');
  ok(W.el, 'Blitz-Gegner und Aerok haben das Element Blitz');
  ok(W.mat && W.drop, 'Sturmsilber: Material und Beute der Sturm-Gegner und von Aerok');

  // Gewitter: Einschlag nach der Ankündigung, trifft im Kreis, daneben nicht
  const S = await ev(() => {
    localStorage.clear(); loadAll(); const c = newChar('knight', 'Sturm', 'normal', false); c.act = 9; c.maxAct = 9; c.st9 = 1; SAVE.chars.push(c); activateChar(0);
    P.map = genMap(9); startRoom('kampf', 2); G.waves = []; G.pending = []; G.phase = 'fight'; G.t = 999; enemies = []; spikes.length = 0; traps.length = 0; hazards.length = 0; pools.length = 0; obs.length = 0; setState('play');
    P.st.hp = P.hp = 1e6;   // Lebenspunkte reichen für alle Einschläge
    const on = sturmOn();
    const e = spawnEnemy('donnerzwerg', { x: P.x + 60, y: P.y, instant: true }), far = spawnEnemy('donnerzwerg', { x: P.x - 120, y: P.y, instant: true });
    for (const x of [e, far]) { x.spd = 0; x.cd = 99; x.atk = 0; }
    P.inv = 99; const hp0 = P.hp, eh0 = e.hp, fh0 = far.hp;
    sturmStrike(P.x, P.y); sturmStrike(e.x, e.y);
    const warned = SKY.strikes.length === 2 && P.hp === hp0;
    for (let i = 0; i < 20; i++) update(1 / 30);
    const early = P.hp === hp0 && e.hp === eh0;
    for (let i = 0; i < 20; i++) { P.inv = 0; update(1 / 30); }
    const hit = P.hp < hp0, ehit = e.hp < eh0, fsafe = far.hp === fh0, gone = SKY.strikes.length === 0;
    // daneben: kein Schaden
    P.hp = P.st.hp = 1e6; const hp1 = P.hp; sturmStrike(P.x + 80, P.y); for (let i = 0; i < 40; i++) { P.inv = 0; update(1 / 30); }
    const miss = P.hp === hp1;
    // Gewitter von selbst, solange gekämpft wird
    SKY.strikes.length = 0; SKY.t = .05; for (let i = 0; i < 4; i++) update(1 / 30);
    const auto = SKY.strikes.length > 0;
    window.__dbg = { st: state, ph: G.phase, on: sturmOn(), en: enemies.map(x => [x.t, x.st, x.dead]), t: SKY.t };
    // anderer Akt: kein Gewitter
    P.act = 4; P.map = genMap(4); startRoom('kampf', 2); G.phase = 'fight'; spawnEnemy('imp', { instant: true }); SKY.t = .01; for (let i = 0; i < 10; i++) update(1 / 30);
    const quiet = !sturmOn() && SKY.strikes.length === 0;
    return { on, warned, early, hit, ehit, fsafe, gone, miss, auto, quiet, dbg: window.__dbg };
  });
  ok(S.on && S.warned && S.early, 'Gewitter in Akt 9: Einschlag erst nach der Ankündigung');
  ok(S.hit && S.ehit && S.fsafe && S.gone, 'Blitz trifft im Kreis den Helden und Gegner, außerhalb niemanden');
  ok(S.miss, 'Ausweichen hilft: daneben kein Schaden');
  ok(S.auto, 'Im Kampf schlagen Blitze von selbst ein' + (S.auto ? '' : ' ' + JSON.stringify(S.dbg)));
  ok(S.quiet, 'Kein Gewitter in anderen Akten');

  // Aerok ruft Blitze, unter 50 % Leben mehr
  const B = await ev(() => {
    P.act = 9; P.map = genMap(9); startRoom('boss', 6); G.waves = []; G.pending = []; G.phase = 'fight'; enemies = [];
    const Bo = bossOf(9), e = spawnEnemy(Bo.type, { boss: true, sc: Bo.sc, hpMul: Bo.hpMul, name: Bo.name, x: P.x, y: P.y - 60, instant: true });
    SKY.strikes.length = 0; e.stormT = .01; sturmBoss(e, 1 / 30); const n1 = SKY.strikes.length;
    SKY.strikes.length = 0; e.hp = e.maxHp * .4; e.stormT = .01; sturmBoss(e, 1 / 30); const n2 = SKY.strikes.length;
    return { name: e.name, n1, n2, onPlayer: true };
  });
  ok(B.name === 'Sturmkönig Aerok' && B.n1 === 3 && B.n2 === 5, 'Aerok ruft 3 Blitze, unter 50 % Leben 5');

  // Handy: Vibrationsstärke in der Steuerung (Standard normal; antippen: stark → aus → leicht → normal)
  await ev(() => { setState('menu'); showControls(); });
  const hap = [];
  for (let i = 0; i < 4; i++) { await page.click('[data-act="ctl_hap"]'); hap.push(await ev(() => { const c = ctlSet(); return [c.haptics, c.hapK, document.querySelector('[data-act="ctl_hap"]').textContent.trim().slice(0, 30)]; })); }
  ok(hap[0][0] === true && hap[0][1] === 2 && hap[1][0] === false && hap[2][0] === true && hap[2][1] === .5 && hap[3][1] === 1 && /STARK/.test(hap[0][2]) && /AUS/.test(hap[1][2]) && /LEICHT/.test(hap[2][2]) && /NORMAL/.test(hap[3][2]), 'Vibration in vier Stufen: normal → stark → aus → leicht → normal (' + hap.map(h => h[2]).join(' · ') + ')');
  await page.screenshot({ path: `${OUT}/steuerung.png` });
  await ev(() => { hideOverlay(); });

  // Bildschirmfotos: Akt 9 im Kampf (Regen, Ankündigung, Einschlag)
  for (const [w, h, nm] of [[390, 844, 'hoch'], [844, 390, 'quer']]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(200);
    await ev(() => { resize(); startRoom('kampf', 2); G.phase = 'fight'; G.waves = []; G.pending = []; enemies = []; for (const k of ['sturmharpyie', 'sturmrufer', 'donnerzwerg', 'blitzgolem']) spawnEnemy(k, { instant: true }); setState('play'); P.inv = 99; sturmStrike(P.x + 30, P.y + 10); sturmStrike(P.x - 40, P.y - 20, { t: .4 }); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/akt9-${nm}.png` });
  }
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
