// Saison (6.6): Saison-Kalender (sechs Wochen), Saison-Pass mit 30 Stufen, Saison-Punkte aus Kills/Aufträgen/Landen, Saison-Helden (50 % mehr Punkte),
// Abholen (einmal je Stufe, nur mit Held), Kosmetik nur aus der Saison (nie aus dem Glückstempel), Saison-Wechsel (Ergebnis in die Liste, Neustart),
// alte Spielstände ohne Saison-Daten, Bedienung mit Antippen (Titelmenü → Saison → Abholen → Rangliste, Erstellung mit Saison-Held), Bildschirmfotos.
// Aufruf: node saison.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/saison';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [w, h, nm] of [[390, 844, 'hoch'], [844, 390, 'quer']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'de-DE', hasTouch: true, isMobile: true });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a);
    if (nm === 'hoch') {
      // Kalender und Stufen
      const K = await ev(() => { let sum = 0; for (let s = 1; s <= SZ_N; s++) sum += szNeed(s); const t0 = SZ_T0; return { a: szNo(t0), b: szNo(t0 + 42 * 864e5 - 1000), c: szNo(t0 + 42 * 864e5 + 1000), d: szNo(t0 - 5e9), sum, l0: szLevel(0).st, l1: szLevel(szNeed(1)).st, lm: szLevel(sum).st, lx: szLevel(sum * 3).st, need: szLevel(sum).need, n: SZ_N }; });
      ok(K.a === 1 && K.b === 1 && K.c === 2 && K.d === 1, 'Saison 1 dauert sechs Wochen, danach beginnt Saison 2');
      ok(K.n === 30 && K.sum === 26250 && K.l0 === 0 && K.l1 === 1 && K.lm === 30 && K.lx === 30 && K.need === 0, '30 Stufen, zusammen 26 250 Punkte, nie mehr als Stufe 30');
      // alter Spielstand ohne Saison-Daten, Punkte sammeln
      const P1 = await ev(() => {
        localStorage.clear(); loadAll(); delete SAVE.meta.sz; persist(); loadAll();
        const o = { meta: !!SAVE.meta.sz && SAVE.meta.sz.xp === 0 && SAVE.meta.sz.no === szNo() };
        o.none = szGain(50) === 0;   // ohne Helden keine Punkte
        const c = newChar('knight', 'Alt', 'normal', false); SAVE.chars.push(c); activateChar(0); saveChar();
        o.alt = szGain(10) === 10 && szM().xp === 10;
        P.sz = szNo(); o.bonus = szGain(10) === 15 && szM().xp === 25;
        // Kills: normal, Elite, Boss; Trainingspuppe und Übungskampf zählen nicht
        P.map = genMap(1); startRoom('kampf', 3); const x0 = szM().xp;
        hook('kill', { t: 'slime' }); hook('kill', { t: 'slime', elite: true }); hook('kill', { t: 'ogre', boss: true }); hook('kill', { t: 'x', ai: 'dummy' }); hook('kill', { t: 'x', bPractice: true });
        o.kills = szM().xp - x0 === Math.round(1 * 1.5) + Math.round(3 * 1.5) + 60;
        const x1 = szM().xp; stat('aufDone', 2); stat('landeExt'); o.stat = szM().xp - x1 === 150 + 90;
        return o;
      });
      ok(P1.meta, 'Alter Spielstand ohne Saison-Daten bekommt sie beim Laden');
      ok(P1.none && P1.alt, 'Punkte nur mit einem Helden – auch mit alten Helden');
      ok(P1.bonus, 'Saison-Helden sammeln 50 % mehr Punkte');
      ok(P1.kills, 'Gegner 1, Elite 3, Boss 40 Punkte – Trainingspuppe und Übungskampf zählen nicht');
      ok(P1.stat, 'Auftrag abgeholt 50 Punkte, aus den Landen entkommen 60 Punkte');
      // Belohnungen und Abholen
      const C = await ev(() => {
        const o = {}, M = szM(); P.sz = 0; M.xp = 0; M.cl = [];
        o.r15 = szReward(15, 20).some(e => e.t === 'cos' && e.k === 'c_saison1') && szReward(30, 20).some(e => e.t === 'cos' && e.k === 'a_saison1');
        o.same = JSON.stringify(szReward(7, 20)) === JSON.stringify(szReward(7, 20)) && szReward(7, 80)[0].n > szReward(7, 5)[0].n;
        o.all = true; for (let s = 1; s <= 30; s++) { const E = szReward(s, 40); if (E.length < 2 || E.some(e => !e || !e.t || lvrChip(e).indexOf('undefined') >= 0)) o.all = false; }
        o.early = szClaim(1).err === 'none';
        M.xp = szNeed(1) + szNeed(2) + szNeed(3) + 5; o.ready = szReady() === 3;
        const g0 = P.gold; const r = szClaim(2); o.one = r.ok === 1 && r.n === 1 && P.gold > g0 && M.cl.join() === '2' && szReady() === 2;
        o.twice = szClaim(2).err === 'none';
        const r2 = szClaim('all'); o.rest = r2.ok === 1 && r2.n === 2 && szReady() === 0 && M.cl.length === 3;
        let sum = 0; for (let s = 1; s <= 30; s++) sum += szNeed(s); M.xp = sum; const f0 = P.fate || 0; const r3 = szClaim('all');
        o.cos = r3.n === 27 && SAVE.meta.cos.includes('c_saison1') && SAVE.meta.cos.includes('a_saison1') && (P.fate || 0) > f0;
        // Kosmetik der Saison kommt nie aus dem Glückstempel
        SAVE.meta.cos = SAVE.meta.cos.filter(k => !COSM[k].sz); for (let i = 0; i < 60; i++) grantCosmetic(); o.temple = !SAVE.meta.cos.some(k => COSM[k].sz) && !SAVE.meta.cos.some(k => COSM[k].lvl);
        const a = SAVE.active; SAVE.active = -1; M.cl = []; o.nohero = szClaim(1).err === 'hero'; SAVE.active = a;
        return o;
      });
      ok(C.r15 && C.same && C.all, 'Jede Stufe hat eine feste Belohnung, sie wächst mit dem Level; Kosmetik bei Stufe 15 und 30');
      ok(C.early && C.ready && C.one && C.twice && C.rest, 'Abholen: erst ab erreichter Stufe, jede Stufe genau einmal, „Alle abholen“');
      ok(C.cos, 'Stufe 15 und 30 geben Sturmmantel und Aura der Ersten Saison');
      ok(C.temple, 'Saison-Kosmetik kommt nie aus dem Glückstempel');
      ok(C.nohero, 'Ohne aktiven Helden lässt sich nichts abholen');
      // Saison-Wechsel
      const W = await ev(() => {
        const M = szM(); M.cl = [1, 2]; M.xp = 2000; SAVE.chars[0].sz = M.no; SAVE.chars[0].lv = 17; const st = szLevel(2000).st;
        const real = Date.now; Date.now = () => real() + 43 * 864e5; let o;
        try { const N = szM(); o = { no: N.no === szNo() && N.no > 1, reset: N.xp === 0 && N.cl.length === 0, hist: N.hist.length === 1 && N.hist[0].st === st && N.hist[0].lv === 17, held: szHeroes().length === 0 }; } finally { Date.now = real; }
        SAVE.meta.sz = szFix({ no: 'x', xp: -5, cl: [1, 1, 99, 'a'], hist: 'kaputt' }); o.fix = SAVE.meta.sz.no === 1 && SAVE.meta.sz.xp === 0 && SAVE.meta.sz.cl.join() === '1' && SAVE.meta.sz.hist.length === 0;
        return o;
      });
      ok(W.no && W.reset && W.hist && W.held, 'Saison-Wechsel: Punkte und Stufen beginnen neu, das Ergebnis steht unter „Frühere Saisons“');
      ok(W.fix, 'Kaputte Saison-Daten werden repariert');
    }
    // Bedienung: neuer Held ist Saison-Held (abwählbar), Titelmenü → Saison → Abholen → Rangliste
    await ev(() => { localStorage.clear(); loadAll(); SAVE.meta.newsSeen = VERSION; persist(); CS = { cls: 'knight', diff: 'normal', hc: false, name: '', look: null }; showTitle(); });
    const tap = async sel => { const b = page.locator(sel).first(); await b.scrollIntoViewIfNeeded(); await b.tap(); await page.waitForTimeout(150); };
    await tap('[data-act="new"]');
    const cr = await ev(() => { const b = document.querySelector('[data-act="sz_new"]'), r = b.getBoundingClientRect(); return { sel: b.classList.contains('sel'), h: r.height }; });
    ok(cr.sel && cr.h >= 44, nm + ': Erstellung zeigt „Saison-Held AN“ (antippbar, mindestens 44 px)');
    await page.screenshot({ path: `${OUT}/${nm}-erstellung.png` });
    await tap('[data-act="sz_new"]'); const off = await ev(() => !document.querySelector('[data-act="sz_new"]').classList.contains('sel') && CS.sz === false);
    await tap('[data-act="sz_new"]'); const on = await ev(() => document.querySelector('[data-act="sz_new"]').classList.contains('sel'));
    ok(off && on, nm + ': Saison-Held lässt sich ab- und wieder anwählen');
    const H = await ev(() => { const c = newChar('knight', 'Sturmia', 'normal', false); hook('created', c); SAVE.chars.push(c); CS.sz = false; const d = newChar('mage', 'Alt', 'normal', false); hook('created', d); SAVE.chars.push(d); CS.sz = undefined; activateChar(0); P.lv = 12; saveChar(); const M = szM(); M.xp = szNeed(1) + szNeed(2) + 40; persist(); showTitle(); return { a: SAVE.chars[0].sz === szNo(), b: !SAVE.chars[1].sz, pill: document.querySelectorAll('.pill.sz').length }; });
    ok(H.a && H.b && H.pill === 1, nm + ': Saison-Held bekommt das Saison-Zeichen im Titelmenü, andere Helden nicht');
    const badge = await ev(() => { const b = document.querySelector('[data-act="sz_open"]'); return b && b.querySelector('.badge') ? b.querySelector('.badge').textContent : ''; });
    ok(badge === '2', nm + ': Titelmenü zeigt „Saison 1“ mit zwei abholbaren Stufen');
    await tap('[data-act="sz_open"]');
    const S = await ev(() => ({ cards: document.querySelectorAll('.szc').length, okc: document.querySelectorAll('.szc.ok').length, wide: document.documentElement.scrollWidth <= innerWidth + 1, btn: [...document.querySelectorAll('.szc.ok .btn')].every(b => b.getBoundingClientRect().height >= 44) }));
    ok(S.cards === 30 && S.okc === 2 && S.wide && S.btn, nm + ': Saison-Pass zeigt 30 Stufen, zwei zum Abholen, nichts ragt über den Rand');
    await page.screenshot({ path: `${OUT}/${nm}-pass.png` });
    await tap('.szc.ok [data-act="sz_claim"]');
    const c1 = await ev(() => ({ cl: szM().cl.length, okc: document.querySelectorAll('.szc.ok').length }));
    await tap('.szall');
    const c2 = await ev(() => ({ cl: szM().cl.length, okc: document.querySelectorAll('.szc.ok').length, pd: document.querySelectorAll('.szc.pd').length }));
    ok(c1.cl === 1 && c1.okc === 1 && c2.cl === 2 && c2.okc === 0 && c2.pd === 2, nm + ': Abholen einzeln und „Alle abholen“ per Antippen');
    await tap('[data-act="sz_tab"][data-id="held"]');
    const R = await ev(() => ({ rows: document.querySelectorAll('.szrow').length, txt: document.querySelector('.szrow') ? document.querySelector('.szrow').textContent : '' }));
    ok(R.rows === 1 && /Sturmia/.test(R.txt) && /12/.test(R.txt), nm + ': Rangliste zeigt den Saison-Helden mit Level');
    await page.screenshot({ path: `${OUT}/${nm}-rangliste.png` });
    await tap('[data-act="sz_back"]');
    ok(await ev(() => state === 'title'), nm + ': Zurück führt ins Titelmenü');
    // Karte → Mehr → Saison und zurück
    const mp = await ev(() => { activateChar(0); openMap(); showMapMore(); const b = document.querySelector('[data-act="sz_open"][data-id="map"]'); if (!b) return false; b.click(); return !!document.querySelector('.szg'); });
    await tap('[data-act="sz_back"]');
    ok(mp && await ev(() => state === 'map'), nm + ': Karte → Mehr → Saison öffnet den Pass, Zurück führt zur Karte');
    // Toast beim Stufenaufstieg im Kampf
    const T = await ev(() => { activateChar(0); P.map = genMap(1); startRoom('kampf', 3); const M = szM(), a = szLevel(M.xp).st; szGain(600); return szLevel(M.xp).st > a; });
    ok(T, nm + ': Im Kampf steigt die Saison-Stufe');
    // Leistungs-Modus (Handy-Feinschliff 6.6): Einstellungen → Knopf, nur jedes dritte Teilchen
    const PF = await ev(() => { showSettings('title'); const b = document.querySelector('[data-act="perf"]'); if (!b) return null; const h = b.getBoundingClientRect().height; parts = []; for (let i = 0; i < 30; i++) part(0, 0, 0, 0, 0, 0, '#fff', 1); const off = parts.length; b.click(); parts = []; for (let i = 0; i < 30; i++) part(0, 0, 0, 0, 0, 0, '#fff', 1); const on = parts.length; const saved = SAVE.meta.settings.perf === true; document.querySelector('[data-act="perf"]').click(); return { h, off, on, saved, back: !SAVE.meta.settings.perf }; });
    ok(PF && PF.h >= 44 && PF.off === 30 && PF.on === 10 && PF.saved && PF.back, nm + ': Leistungs-Modus in den Einstellungen zeichnet nur jedes dritte Teilchen und lässt sich wieder ausschalten');
    ok(!errs.length, nm + ': keine Skriptfehler' + (errs.length ? ' – ' + errs[0] : ''));
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? '\n' + fails.length + ' Fehler' : '\nSaison: alles grün');
  process.exit(fails.length ? 1 : 0);
})();
