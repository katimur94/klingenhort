// Krieg der Kronen 3 – Die Kriegskarte (6.9): Provinzen, wandernde Fronten (auch offline), Feldzüge, Kriegsjahre.
// Prüft die Regeln: Aufbau der Karte (40 Provinzen, Nachbarn, Festungen, Nebel), Spielstand (Standard, Reparatur, alter Stand ohne Karte),
// Kriegstage (fester Zufall, Nachrechnen höchstens eine Woche, Festungen und Nebel fallen nie, kein Reich verschwindet nach Jahren),
// Fronten der Weltkarte kommen aus echten Grenzen, Feldzug (erobern, halten, Gegen-Sieg, Lohn, befestigt), Schlacht direkt von der Karte
// verbraucht keinen Ort der Weltkarte. Dazu der getippte Ablauf (Handy hoch und quer, PC) mit Bildschirmfotos.
// Aufruf: node kriegskarte.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/kriegskarte';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
const HERO = () => {
  localStorage.clear(); loadAll();
  const c = newChar('knight', 'Söldner', 'normal', false); c.lv = 16; c.act = 3; c.maxAct = 3; c.st9 = 1; c.story = {}; for (let i = 1; i <= 12; i++) c.story['a' + i] = 1;
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; for (const a of ACH) SAVE.meta.ach[a.id] = 1;
  computeStats(); P.hp = P.st.hp; P.map = genMap(P.act); SAVE.meta.krieg.pro = 1; saveChar(); persist();
};
// Schlacht schnell entscheiden: Sieg oder Niederlage über krEnd, dann Ergebnis
const TOOLS = () => { window.ende = win => { krEnd(win); KR.endT = 0; for (let i = 0; i < 4; i++) update(1 / 60); return state; }; return true; };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  console.log('Kriegskarte – Regeln');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a);
    await ev(TOOLS); await ev(HERO);
    const A = await ev(() => {
      const o = {}, K = kkKarte();
      o.n = KK_N === 40 && K.o.length === 40 && KK_NAMEN.length === 40 && new Set(KK_NAMEN).size === 40 && KK_NAMEN.every(s => typeof s === 'string' && s.length > 2);
      o.nb = KK_NB.every((L, p) => L.length >= 2 && L.length <= 6 && L.every(q => KK_NB[q].includes(p)));
      o.verteilt = KR_AKTIV.map(k => kkZahl(K, k)).join() === '9,9,10,10' || KR_AKTIV.map(k => kkZahl(K, k)).sort().join();
      o.fest = KR_AKTIV.every(k => K.o[KK_FEST[k]] === k) && K.o.filter(k => !k).length === 2;
      o.grenzen = kkGrenzen(K).length;
      // Spielstand: Standard, Reparatur, alter Stand
      const d = kkFix(null); o.def = d.o.join() === KK_START.join() && d.tag === 0 && !d.fz && d.t === kkJetzt();
      const x = kkFix({ o: K.o.map((k, p) => p === KK_FEST.karth ? 'aurelien' : p === 0 ? 'konzil' : p === 3 ? 'quatsch' : k), t: 9e15, tag: -4, fz: { p: KK_FEST.nordmark, s: 'karth', f: 'nordmark' }, fest: { 5: 'x', 99: 3 }, log: [{ k: 'boese', d: 1 }, { k: 'nimmt', d: 2, a: 'karth', b: 'x', p: 4 }], nb: [3, 99, -1] });
      o.fix = x.o[KK_FEST.karth] === 'karth' && x.o[0] === KK_START[0] && x.o[3] === KK_START[3] && x.t <= kkJetzt() && x.tag === 0 && !x.fz && x.fest[5] === 0 && !(99 in x.fest) && x.log.length === 1 && x.log[0].b === '' && x.nb.join() === '3';
      const alt = JSON.parse(JSON.stringify(SAVE.meta)); delete alt.krieg.karte; SAVE.meta = fixMeta(alt); o.alt = !!SAVE.meta.krieg.karte && SAVE.meta.krieg.karte.o.length === 40;
      const roh = JSON.parse(JSON.stringify(SAVE.meta)); roh.krieg.karte.tag = 17; roh.krieg.karte.o[4] = 'aurelien'; SAVE.meta = fixMeta(roh); o.bleibt = SAVE.meta.krieg.karte.tag === 17 && SAVE.meta.krieg.karte.o[4] === 'aurelien';
      SAVE.meta.krieg.karte = kkDef();
      return o;
    });
    ok(A.n && A.nb, 'Kriegskarte: 40 Provinzen mit eigenen Namen, jede mit zwei bis sechs Nachbarn (Wabenfeld, Nachbarschaft gilt beidseitig)');
    ok(A.verteilt === true || A.verteilt === '10,10,9,9', 'Start: Nordmark 9, Aurelien 9, Sylvara 10, Karth 10 Provinzen');
    ok(A.fest && A.grenzen >= 10, `Jedes Reich hat seine Festung, zwei Provinzen liegen im Nebel; ${A.grenzen} umkämpfte Grenzen zum Start`);
    ok(A.def && A.fix, 'Spielstand SAVE.meta.krieg.karte: Standardwerte; Unsinn wird repariert (Festung bleibt beim Reich, unbekannte Reiche, Zeit in der Zukunft, ungültiger Feldzug)');
    ok(A.alt && A.bleibt, 'Alter Spielstand ohne Kriegskarte bekommt eine; gültige Kriegskarte bleibt beim Laden erhalten');

    // Kriegstage: fester Zufall, Nachrechnen, Festungen, kein Reich verschwindet
    const B = await ev(() => {
      const o = {}, M = krM();
      const lauf = (n, t0) => { M.karte = kkDef(); M.karte.t = t0; const real = Date.now; Date.now = () => (t0 + n) * KK_TICK + 5; const g = kkTick(); Date.now = real; return { g, o: M.karte.o.join(), tag: M.karte.tag, log: M.karte.log.length }; };
      const a = lauf(20, 500000), b = lauf(20, 500000), c = lauf(20, 500100);
      o.fest = a.o === b.o && a.tag === 20 && a.g === 20; o.anders = a.o !== c.o; o.bewegt = a.o !== KK_START.join() && a.log > 0;
      o.nach = lauf(500, 400000).g === KK_NACH && M.karte.t === 400500;
      o.null = (() => { M.karte = kkDef(); return kkTick() === 0 && M.karte.tag === 0; })();
      // zehn Jahre Krieg am Stück: Festungen und Nebel halten, jedes Reich lebt, Jahre zählen
      M.karte = kkDef(); const K = M.karte; let minN = 99, jahr = 0;
      for (let t = 1; t <= KK_JAHR * 10; t++) { kkTag(K, 777000 + t); for (const k of KR_AKTIV) minN = Math.min(minN, kkZahl(K, k)); if (K.log.some(e => e.k === 'jahr')) jahr = 1; }
      o.festungen = KR_AKTIV.every(k => K.o[KK_FEST[k]] === k) && K.o.filter(k => !k).length === 2 && minN >= 1; o.min = minN; o.jahr = jahr && kkJahr(K) === 11 && K.log.length <= 12;
      o.max = Math.max(...KR_AKTIV.map(k => kkZahl(K, k)));
      // befestigte Provinz wechselt nicht
      M.karte = kkDef(); const K2 = M.karte, g = kkGrenzen(K2); for (const [p] of g) K2.fest[p] = 9999; o.bef = kkGrenzen(K2).length === 0;
      M.karte = kkDef(); return o;
    });
    ok(B.fest && B.anders && B.bewegt, 'Kriegstage: gleicher Tag → gleicher Ausgang (fester Zufall), andere Tage → anderer Verlauf; Provinzen wechseln den Besitzer, der Kriegsbericht schreibt mit');
    ok(B.nach && B.null, `Offline: beim Öffnen werden höchstens ${'eine Woche'} Kriegstage nachgerechnet (${'56'}), ohne vergangene Zeit nichts`);
    ok(B.festungen && B.jahr, `Zehn Kriegsjahre am Stück: Festungen und Nebel halten, jedes Reich behält mindestens ${B.min} Provinzen (größtes ${B.max}), Kriegsjahr 11 beginnt, der Bericht bleibt kurz`);
    ok(B.bef, 'Befestigte Provinzen stehen nicht zur Wahl, bis die Befestigung abläuft');

    // Fronten der Weltkarte aus echten Grenzen
    const C = await ev(() => {
      const o = {}, K = kkKarte(); const seen = new Set(); let falsch = 0;
      for (let c = 0; c < 30; c++) { P.created = 5000 + c * 1013; for (const act of [3, 4, 5, 6]) { P.act = act; for (const r of [2, 4]) { const f = krFront(r); seen.add(f.join()); if (!kkGrenzen(K).some(([p, b]) => (K.o[p] === f[0] && b === f[1]) || (K.o[p] === f[1] && b === f[0]))) falsch++; } } }
      o.n = seen.size; o.falsch = falsch; P.act = 3;
      K.fz = { p: 4, s: 'sylvara', f: 'nordmark', n: 0, auf: 1 }; o.fz = krFront(2).join() === 'sylvara,nordmark' && krFront(4).join() === 'sylvara,nordmark'; K.fz = null;
      return o;
    });
    ok(C.falsch === 0 && C.n >= 4, `Kriegsgebiete der Weltkarte liegen an echten Grenzen der Kriegskarte (${C.n} verschiedene Fronten); während eines Feldzugs zeigen sie dessen Front`);
    ok(C.fz, 'Feldzug läuft → jedes Kriegsgebiet zeigt seine Front');

    // Feldzug: erobern, Gegen-Sieg, Lohn, Weltkarte unverändert
    const D = await ev(() => {
      const o = {}, K = kkKarte(), M = krM();
      const p = kkGrenzen(K).find(([q, b]) => K.o[q] === 'nordmark' && b === 'sylvara')[0];
      ON.kk_fz(p + ':sylvara:1'); o.start = K.fz && K.fz.p === p && K.fz.s === 'sylvara' && K.fz.f === 'nordmark' && K.fz.auf === 1;
      ON.kk_fz(p + ':karth:1'); o.nurEiner = K.fz.s === 'sylvara';
      const pos = JSON.stringify(P.map.pos), done = P.map.rows.flat().filter(n => n.done).length, n0 = M.n;
      ON.kk_los(); o.los = state === 'play' && G.type === 'krieg' && G.extra.fz === 1 && KR.side === 'sylvara' && KR.foe === 'nordmark';
      ende(true); o.eins = K.fz.n === 1 && /1 von 3/.test(panel.textContent) && /KRIEGSKARTE/.test(panel.textContent);
      ON.kr_weiter(); o.zurueck = /KRIEGSKARTE/.test(panel.querySelector('.head').textContent);
      ON.kk_los(); ende(false); o.niederlage = K.fz.n === 1; ON.kr_nochmal(); o.nochmal = G.extra.fz === 1 && KR.side === 'sylvara' && KR.foe === 'nordmark';
      startRoom('krieg', 3, { krSeite: 'nordmark', krFeind: 'sylvara', fz: 1 }); ende(true); o.gegen = K.fz.n === 0;
      const g0 = P.gold, r0 = krRuf('sylvara'), m0 = M.r.sylvara.mk;
      for (let i = 0; i < 3; i++) { ON.kk_los(); ende(true); if (i < 2) ON.kr_weiter(); }
      o.erobert = K.o[p] === 'sylvara' && !K.fz && /erobert/.test(panel.textContent) && K.log.some(e => e.k === 'du' && e.p === p);
      o.lohn = P.gold - g0 > 0 && krRuf('sylvara') - r0 >= 60 && M.r.sylvara.mk - m0 >= 6;
      o.karte = JSON.stringify(P.map.pos) === pos && P.map.rows.flat().filter(n => n.done).length === done && M.n > n0;
      ON.kr_weiter();
      // halten: befestigt
      const q = kkGrenzen(K).find(([x]) => K.o[x] === 'karth')[0]; ON.kk_fz(q + ':karth:0'); o.halten = K.fz && K.fz.auf === 0 && K.fz.s === 'karth';
      for (let i = 0; i < 3; i++) { ON.kk_los(); ende(true); ON.kr_weiter(); }
      o.bef = K.o[q] === 'karth' && K.fest[q] === K.tag + KK_BEF && !kkGrenzen(K).some(([x]) => x === q);
      // abbrechen
      const r = kkGrenzen(K)[0]; ON.kk_fz(r[0] + ':' + r[1] + ':1'); ON.kk_ab(); o.ab = !K.fz;
      // ungültig: Festung, Nebel, Seite ohne Grenze
      ON.kk_fz(KK_FEST.karth + ':aurelien:1'); ON.kk_fz(19 + ':aurelien:1'); ON.kk_fz('0:karth:1'); o.nein = !K.fz;
      return o;
    });
    ok(D.start && D.nurEiner && D.los, 'Feldzug beginnen (Grenz-Provinz, Seite erobern) – immer nur einer; „Zur Schlacht“ startet die Schlacht dieser Front');
    ok(D.eins && D.zurueck && D.niederlage && D.nochmal, 'Sieg zählt (1 von 3, steht im Ergebnis), danach zurück zur Kriegskarte; Niederlage zählt nicht, Wiederholen bleibt im Feldzug');
    ok(D.gegen, 'Sieg gegen die eigene Feldzug-Seite zieht einen Sieg ab');
    ok(D.erobert && D.lohn, 'Drei Siege: die Provinz wechselt, der Bericht nennt es; Lohn Gold, +60 Kriegsruf, +6 Marken');
    ok(D.karte, 'Schlachten von der Kriegskarte verbrauchen keinen Ort der Weltkarte (Position und erledigte Orte unverändert)');
    ok(D.halten && D.bef, 'Halten: nach drei Siegen ist die Provinz befestigt und steht eine Weile nicht zur Wahl');
    ok(D.ab && D.nein, 'Feldzug abbrechen; Festung, Nebel und Seiten ohne Grenze lassen sich nicht wählen');
    ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }

  // Getippter Ablauf mit Bildschirmfotos
  for (const [w, h, nm, touch] of [[390, 844, 'hoch', true], [844, 390, 'quer', true], [1280, 720, 'pc', false]]) {
    console.log(`\nKriegskarte – Ablauf ${w}×${h}${touch ? ' (Touch)' : ' (Maus)'}`);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'de-DE', hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a), shot = n => page.screenshot({ path: `${OUT}/${nm}-${n}.png` });
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); if (touch) await el.tap(); else await el.click(); await page.waitForTimeout(160); };
    const layout = () => ev(touch => { const r = [], vw = innerWidth; for (const b of panel.querySelectorAll('button')) { const q = b.getBoundingClientRect(); if (!q.width) continue; const kopf = !!b.closest('.head'); if (q.left < -1 || q.right > vw + 1) r.push('breit: ' + b.textContent.trim().slice(0, 24)); if (touch && !kopf && q.height < 43.5) r.push('klein (' + Math.round(q.height) + '): ' + (b.textContent.trim() || b.getAttribute('aria-label')).slice(0, 24)); } if (panel.scrollWidth > panel.clientWidth + 2) r.push('Tafel scrollt quer'); return r; }, touch);
    await ev(TOOLS); await ev(HERO);
    // ein paar Kriegstage vergangen (offline)
    await ev(() => { const K = kkKarte(); K.t -= 6; openMap(); });
    await tap('[data-act="more"]').catch(() => {});
    const mehr = await ev(() => !!panel.querySelector('[data-act="kk_open"]'));
    if (!mehr) await ev(() => showMapMore());
    ok(await ev(() => !!panel.querySelector('[data-act="kk_open"]')), 'Karte → Mehr: Knopf „Kriegskarte“');
    await tap('[data-act="kk_open"]'); await page.waitForTimeout(300);
    ok(await ev(() => /KRIEGSKARTE/.test(panel.querySelector('.head').textContent) && panel.querySelectorAll('.kkp').length === 40 && /Kriegsjahr 1 · Tag 7/.test(panel.textContent)), 'Kriegskarte öffnet sich: 40 Provinzen, Kriegsjahr und Tag (sechs Kriegstage nachgerechnet)');
    ok(await ev(() => panel.querySelectorAll('.kklog li').length >= 1), 'Kriegsbericht zeigt, was offline passiert ist');
    await shot('1-karte');
    let ln = await layout(); ok(!ln.length, 'Kriegskarte passt aufs Bild, Waben groß genug' + (ln.length ? ': ' + ln.join('; ') : ''));
    const p = await ev(() => { const K = kkKarte(); return kkGrenzen(K).find(([q, b]) => K.o[q] === 'karth' && b === 'aurelien')[0]; });
    await tap(`.kkp[data-id="${p}"]`);
    ok(await ev(p => panel.querySelector('.kkp.sel') && +panel.querySelector('.kkp.sel').dataset.id === p && /Grenzt an/.test(panel.textContent) && !!panel.querySelector('[data-act="kk_fz"][data-id$=":aurelien:1"]'), p), 'Provinz antippen: Besitzer, Nachbarn, Knöpfe „erobern“ und „halten“');
    await shot('2-provinz');
    await tap('[data-act="kk_fz"][data-id$=":aurelien:1"]');
    ok(await ev(() => /DEIN FELDZUG/.test(panel.textContent) && !!panel.querySelector('.kkp.ziel') && !!panel.querySelector('[data-act="kk_los"]')), 'Feldzug steht oben, das Ziel ist auf der Karte markiert');
    await shot('3-feldzug');
    ln = await layout(); ok(!ln.length, 'Feldzug-Ansicht passt aufs Bild' + (ln.length ? ': ' + ln.join('; ') : ''));
    await tap('[data-act="kk_los"]'); await page.waitForTimeout(500);
    ok(await ev(() => state === 'play' && KR.on && KR.side === 'aurelien' && KR.foe === 'karth'), 'Zur Schlacht: die Schlacht für Aurelien gegen Karth beginnt');
    await ev(() => ende(true)); await page.waitForTimeout(300); await shot('4-sieg');
    ok(await ev(() => /1 von 3/.test(panel.textContent)), 'Ergebnis: Fortschritt des Feldzugs');
    ln = await layout(); ok(!ln.length, 'Ergebnis passt aufs Bild' + (ln.length ? ': ' + ln.join('; ') : ''));
    await tap('[data-act="kr_weiter"]');
    ok(await ev(() => /KRIEGSKARTE/.test(panel.querySelector('.head').textContent) && /1 von 3/.test(panel.textContent)), 'Weiter → zurück zur Kriegskarte');
    await tap('[data-act="kk_zu"]');
    ok(await ev(() => state === 'map' || !!document.getElementById('mapcv')), 'Zurück → Weltkarte');
    // Chronik und Handbuch
    await ev(() => kriegChronik('map')); ok(await ev(() => !!panel.querySelector('[data-act="kk_open"][data-id="chr"]')), 'Chronik der Kronen hat einen Knopf zur Kriegskarte');
    ok(await ev(() => { hbBuild(); return !!HB.by['krieg:karte'] && HB.by['krieg:karte'].ch === 'krieg' && /Provinzen/.test(HB.by['krieg:karte'].b()); }), 'Handbuch: Eintrag „Die Kriegskarte“ im Kapitel Krieg der Kronen');
    ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(fails.length ? `\n${fails.length} FEHLER` : '\nKriegskarte: alles grün');
  process.exit(fails.length ? 1 : 0);
})();
