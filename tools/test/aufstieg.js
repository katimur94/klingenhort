// Aufstieg (6.4): Level bis 100 mit neuer Erfahrungskurve (gemessen mit echten Wellen aus Kampagne und Endlosen Landen), Paragon ab 100,
// alte Spielstände (Level 50 mit Paragon, kaputte Talente, Erfahrung auf der alten Kurve), Meister-Talente (99 Punkte je Klasse, Level-Sperren,
// Schlusssteine mit echter Wirkung), Level-Belohnungen (jedes Level 2–100, genau einmal, auch bei Sprüngen und nach der Wiedergeburt;
// alte Helden ohne Gold-Nachschlag), Erfolge, Handbuch, Bildschirmfotos (hoch, quer, PC) von Talenten und Level-Belohnungen.
// Aufruf: node aufstieg.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '/tmp/klingenhort-test/aufstieg';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

// Messung: Minuten je Level bei 30 Kills/min, ohne EP-Boni. Stufe = 0,9 × lHeroSt (Mitte von „passend“ in den Landen) – in der Geschichte mit dem Akt
// aus dem Kampagnen-Lauf (wie rules.js: 4 Kampfräume + Boss je Reihe), danach Qual 1. EP je Kill = halb Kampagne (Kampfraum-Wellen mit Elite-Chance,
// Schleime teilen sich), halb Lande (Lager-Wellen aller Biome mit Elite) – jeweils echte e.xp aus spawnEnemy.
const SIM = () => {
  window.WEEK_FORCE = 'schmiede';
  localStorage.clear(); loadAll(); const c = newChar('knight', 'Sim', 'normal', false); SAVE.chars.push(c); activateChar(0); P.map = genMap(1);
  const actAt = {}; let lv = 1, xp = 0;
  for (let act = 1; act <= STORY_ACTS; act++) for (let row = 0; row < 7; row++) {
    P.act = act; G = { row, lootMul: 1 }; const st = stageNum(), S = scaleOf(st), base = 4 + st * 1.4;
    for (let k = 0; k < 4; k++) for (let w = 0; w < Math.min(4, 2 + Math.floor(st / 6)); w++) for (const e of buildWave(st, base + w * 1.3)) xp += EN[e].xp * S.rm * 1.15 / 4;
    if (row === 6) xp += 60 * S.rm * 8;
    while (xp >= xpNext(lv)) { xp -= xpNext(lv); lv++; if (!actAt[lv]) actAt[lv] = act; }
  }
  const actOf = L => actAt[L] || STORY_ACTS + 1;
  const stageOf = L => { P.lv = L; P.maxAct = actOf(L); P.paragon = 0; return Math.round(.9 * lHeroSt()); };
  const XK = {};
  const xpk = s => {
    if (XK[s]) return XK[s];
    P.act = Math.floor((s - 1) / 7) + 1; startRoom('kampf', (s - 1) % 7); G.waves = []; G.pending = []; enemies = [];
    const eliteP = DIFFS.normal.elite * (s >= 3 ? 1 : 0), base = 4 + s * 1.4, nw = Math.min(4, 2 + Math.floor(s / 6));
    let cx = 0, ck = 0;
    for (let i = 0; i < 40; i++) for (let w = 0; w < nw; w++) for (const t of buildWave(s, base + w * 1.3)) {
      const e = spawnEnemy(t, { elite: Math.random() < eliteP, instant: true }); cx += e.xp; ck++; enemies = [];
      if (EN[t].split) { const m = spawnEnemy('minislime', { instant: true }); cx += 2 * m.xp; ck += 2; enemies = []; }
    }
    let lx = 0, lk = 0; const ne = s >= 124 ? 3 : s >= 31 ? 2 : s >= 13 ? 1 : 0;   // Elite je Lager nach Tiefe (js/lande.js)
    for (const bk of Object.keys(LANDE_BIOMES)) for (let i = 0; i < 5; i++) {
      for (const t of lWave(bk, s, 3 + Math.min(14, s * .3), 7)) { const e = spawnEnemy(t, { instant: true }); lx += e.xp; lk++; enemies = []; }
      for (let q = 0; q < ne; q++) { const e = spawnEnemy(pick(lPool(bk, s)), { elite: true, instant: true }); lx += e.xp; lk++; enemies = []; }
    }
    return XK[s] = s < 5 ? cx / ck : (cx / ck + lx / lk) / 2;
  };
  const rows = []; let tot = 0, totOld = 0;
  for (let L = 1; L <= LVMAX; L++) {
    const s = stageOf(L), k = xpk(s);
    if (L === LVMAX) { rows.push({ L, s, k, para: PARAGON_XP / (30 * k) }); break; }
    const m = xpNext(L) / (30 * k), mo = xpOld(L) / (30 * k); tot += m; if (L < 50) totOld += mo;
    rows.push({ L, s, k, m, mo, h: tot / 60, h50old: totOld / 60 });
  }
  const mono = rows.slice(0, LVMAX - 1).every((r, i) => !i || xpNext(r.L) > xpNext(r.L - 1));
  const same30 = rows.slice(0, 30).every(r => xpNext(r.L) === xpOld(r.L));
  G = null; setState('menu'); window.WEEK_FORCE = null;
  return { rows, mono, same30 };
};

// Held anlegen (im Browser)
const HERO = (cls, lv, o) => {
  localStorage.clear(); loadAll(); window.WEEK_FORCE = 'schmiede';
  const c = newChar(cls || 'knight', 'Aufsteiger', 'normal', false); c.story = { prolog: 1 }; Object.assign(c, o || {});
  SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); SAVE.meta.hide.intro = true; SAVE.meta.hide.tip62 = 1; for (const a of ACH) SAVE.meta.ach[a.id] = 1;
  if (SAVE.meta.pets) { SAVE.meta.pets.starter = true; SAVE.meta.pets.intro = true; } if (SAVE.meta.lande) SAVE.meta.lande.tips = 0xffff;   // Ei aus Level 20: Gundas Einführung schon gesehen
  if (lv) { P.lv = lv; P.lvr = lv; P.sp = lv - 1; } P.gold = 1e6; P.map = genMap(Math.max(1, P.act)); computeStats(); P.hp = P.st.hp; saveChar(); persist();
};
// bis zu Level L aufsteigen (echte Erfahrung über gainXP)
const UPTO = () => { window.UPTO = L => { let v = xpNext(P.lv) - P.xp; for (let l = P.lv + 1; l < L; l++) v += xpNext(l); gainXP(v); }; };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const H = HERO.toString();
  await page.evaluate(`(${UPTO.toString()})()`);

  console.log('Erfahrungskurve: gemessen mit echten Wellen (30 Kills/min, ohne EP-Boni)');
  {
    const r = await ev(SIM);
    const at = L => r.rows[L - 1], f = v => v < 90 ? v.toFixed(1) + ' min' : (v / 60).toFixed(1) + ' h';
    console.log('       Level  Stufe  EP/Kill  EP fürs Level  Minuten   vorher (6.3)');
    for (const L of [10, 20, 30, 35, 40, 50, 60, 70, 80, 90, 95, 99]) { const x = at(L); console.log(`       ${String(L).padStart(5)}  ${String(x.s).padStart(5)}  ${String(Math.round(x.k)).padStart(7)}  ${String(await ev(l => xpNext(l), L)).padStart(13)}  ${f(x.m).padStart(8)}   ${L < 50 ? f(x.mo) : '–'}`); }
    const p = at(100);
    console.log(`       Level 50 nach ${at(49).h.toFixed(1)} h (vorher ${at(49).h50old.toFixed(1)} h), Level 100 nach ${at(99).h.toFixed(0)} h, Paragonpunkt ab 100: ${f(p.para)}`);
    ok(r.same30, 'Level 1–30 brauchen genau so viel Erfahrung wie bisher');
    ok(r.mono, 'die Kurve steigt von Level zu Level (1 → 99)');
    const r31 = r.rows.slice(30, 59), m35 = at(35).m;
    ok(r31.every(x => x.L < 35 ? x.m <= x.mo : x.m <= .8 * x.mo), 'Level 31–60 deutlich schneller als bisher (ab 35 mindestens 20 % weniger Zeit)');
    ok(m35 >= 9 && m35 <= 16 && m35 <= 1.3 * at(30).m, `keine Wand bei 35: Level 35 → 36 dauert ${m35.toFixed(1)} min (10–15 erwartet, höchstens 1,3 × Level 30)`);
    const band = (a, z, lo, hi) => { const o = r.rows.filter(x => x.L >= a && x.L <= z && (x.m < lo || x.m > hi)); return o.length ? o.map(x => x.L + ':' + x.m.toFixed(0)).join(' ') : ''; };
    let o = band(60, 79, 18, 48); ok(!o, 'Level 60–79: 20–45 min je Level' + (o ? ' – daneben: ' + o : ''));
    o = band(80, 89, 45, 130); ok(!o, 'Level 80–89: 1–2 h je Level' + (o ? ' – daneben: ' + o : ''));
    o = band(90, 99, 160, 400); ok(!o, 'Level 90–99: 3–6 h je Level – Level 100 ist eine echte Leistung' + (o ? ' – daneben: ' + o : ''));
    ok(at(99).h > 50, `Level 100 erst nach ${at(99).h.toFixed(0)} h Kampf`);
    ok(p.para >= 15 && p.para <= 60, `ab Level 100: ein Paragonpunkt etwa alle ${p.para.toFixed(0)} min`);
  }

  console.log('Level-Grenze 100, Paragon ab 100, Stärke aus dem Level');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')('knight', 1); const o = {}; startRoom('kampf', 0); G.pending = []; enemies = []; P.inv = 1e9;
      UPTO(99); o.lv99 = P.lv === 99 && P.lvr === 99 && P.sp === 98; gainXP(1000); o.xp99 = P.xp >= 1000 && P.pxp === 0; updHud(); o.hud99 = $('hudLv').textContent;
      UPTO(LVMAX); o.lv100 = P.lv === 100 && P.xp === 0 && P.sp === 99; o.ban = $('banTitle').textContent;
      const p0 = P.paragon, x0 = P.pxp; gainXP(PARAGON_XP); o.para = P.paragon === p0 + 1 && P.pxp === x0 && P.lv === 100; updHud(); o.hud100 = $('hudLv').textContent;
      gainXP(1e9); o.cap = P.lv === 100; o.pxpN = PARAGON_XP;
      o.pow = [lvPow(25), lvPow(50), lvPow(100)]; P.lv = 50; computeStats(); const h50 = P.st.hp, d50 = P.st.wbase; P.lv = 100; computeStats(); o.hp = P.st.hp / h50; o.dmg = P.st.wbase / d50;
      o.st = [50, 75, 100].map(l => { P.lv = l; P.maxAct = 9; P.paragon = 0; return lHeroSt(); });
      return o;
    }, [H]);
    ok(r.lv99 && r.xp99 && r.hud99 === 'LV 99', `Level 99: Erfahrung zählt fürs nächste Level (HUD ${r.hud99})`);
    ok(r.lv100 && /LEVEL 100/.test(r.ban), `Level 100 erreicht, 99 Talentpunkte (Banner „${r.ban}“)`);
    ok(r.para && /^P\d+$/.test(r.hud100), `ab Level 100 Paragon: ein Punkt je ${r.pxpN} EP, HUD zeigt ${r.hud100}`);
    ok(r.cap, 'höher als Level 100 geht es nicht');
    ok(Math.abs(r.pow[1] - 48.9) < .01 && Math.abs(r.pow[0] - 38.4) < .01, 'Level 1–50 genau so stark wie bisher');
    ok(r.pow[2] / r.pow[1] >= 1.2 && r.pow[2] / r.pow[1] <= 1.3 && r.hp >= 1.15 && r.hp <= 1.3, `Level 100 nur gut 20 % stärker als 50 (Stärke ×${(r.pow[2] / r.pow[1]).toFixed(2)}, LP ×${r.hp.toFixed(2)}, Grundschaden ×${r.dmg.toFixed(2)})`);
    ok(r.st[0] === 63 && r.st[2] > r.st[1] && r.st[2] < 100 * 1.15 * .8, `Lande: „passend“ wächst über 50 langsamer (Heldenstufe ${r.st.map(v => v.toFixed(0)).join(' / ')} bei Level 50 / 75 / 100)`);
  }

  console.log('Alte Spielstände: Level 50 mit Paragon, kaputte Talente, Erfahrung der alten Kurve');
  {
    await ev(() => {
      localStorage.clear(); loadAll();
      const old = c => { delete c.lvr; return c; };
      const a = old(newChar('knight', 'Alt50', 'normal', false)); a.lv = 50; a.xp = 0; a.paragon = 37; a.pxp = 12000; a.pp = { dmg: 20, hp: 10, def: 5, crit: 2 }; a.gold = 12345; a.maxAct = 5; a.act = 5;
      a.talents = {}; for (const [, nodes] of TALENTS.knight) nodes.slice(0, 4).forEach(n => a.talents[n.id] = n.max); a.sp = 19;
      const m = old(newChar('mage', 'Alt35', 'normal', false)); m.lv = 35; m.xp = 100000; m.gold = 777; m.sp = 5;
      m.talents = { mf1: 3, mf2: 3, mf3: 3, mf4: 1, mf5: 2, mf7: 2, xx9: 5, mi1: 9 };
      const r = old(newChar('rogue', 'Alt72', 'normal', false)); r.lv = 72; r.xp = 0; r.gold = 5000;
      SAVE.chars.push(a, m, r); for (const x of ACH) SAVE.meta.ach[x.id] = 1; persist();
    });
    await page.reload(); await page.waitForTimeout(1200); await page.evaluate(`(${UPTO.toString()})()`);
    const r = await ev(() => {
      const o = {}, cos0 = SAVE.meta.cos.length;
      activateChar(0); o.a = { lv: P.lv, xp: P.xp, para: P.paragon, pxp: P.pxp, pp: JSON.stringify(P.pp), sp: P.sp, lvr: P.lvr, gold: P.gold, spent: spentPoints(), dmg: P.st.m.dmg };
      o.cos0 = SAVE.meta.cos.length === cos0;
      const g0 = P.gold; gainXP(1000); o.a.cont = P.lv === 50 && P.xp === 1000 && P.paragon === 37 && P.pxp === 12000;
      gainXP(xpNext(50)); o.a.up = P.lv === 51 && P.lvr === 51 && P.gold - g0 === lvReward(51).find(e => e.t === 'gold').n;
      o.rebirth = (() => { openChar('para'); LVR.sub = 'para'; openChar('para'); const bt = panel.querySelector('[data-act="rebirth"]'); return !!bt && !bt.disabled; })();
      activateChar(1); o.m = { lv: P.lv, xp: P.xp, sp: P.sp, t: JSON.stringify(P.talents), gold: P.gold, lvr: P.lvr };
      o.m.exp = Math.floor(100000 / xpOld(35) * xpNext(35));
      activateChar(2); o.r = { lv: P.lv, gold: P.gold, lvr: P.lvr, cos: SAVE.meta.cos.includes('c_aufstieg'), w: SAVE.meta.cos.includes('w_aufstieg'), tt: fkM().tt.slice(), t: fkM().t };
      activateChar(2); o.r.once = SAVE.meta.cos.filter(k => k === 'c_aufstieg').length === 1 && fkM().tt.filter(k => k === 'lv70').length === 1;
      saveChar(); o.saved = SAVE.chars[2].lvr === 72;
      return o;
    });
    ok(r.a.lv === 50 && r.a.xp === 0 && r.a.para === 37 && r.a.pxp === 12000 && r.a.pp === '{"dmg":20,"hp":10,"def":5,"crit":2}', 'Level 50 mit 37 Paragonpunkten: Level, Paragon, Verteilung und Paragon-EP bleiben');
    ok(Math.abs(r.a.dmg - .38) < 1e-9, `verteilte Paragonpunkte wirken weiter (Schaden +${Math.round(r.a.dmg * 100)} % = 18 % Talente + 20 % Paragon)`);
    ok(r.a.sp === 19 && r.a.spent === 30 && r.a.lvr === 50 && r.a.gold === 12345 && r.cos0, 'freie Punkte = Level − 1 − verteilt (19), erreichte Level gelten als belohnt – kein Gold, keine Kosmetik nachgezahlt');
    ok(r.a.cont && r.a.up, 'Level 50 levelt weiter (Erfahrung zählt fürs Level, nicht für Paragon) – Level 51 gibt genau seine Belohnung');
    ok(r.rebirth, 'Wiedergeburt geht weiter ab Level 50 und Akt 5');
    ok(r.m.lv === 35 && Math.abs(r.m.xp - r.m.exp) <= 1 && r.m.lvr === 35 && r.m.gold === 777, `Level 35: Erfahrung anteilig auf die neue Kurve (${r.m.xp} von ${r.m.exp} erwartet), kein Gold`);
    ok(r.m.t === '{"mf1":3,"mf2":3,"mf3":3,"mf4":1,"mf5":2,"mi1":3}' && r.m.sp === 19, `kaputte Talente repariert (unbekannt weg, Rang gedeckelt, Meister-Talent ohne Vorgänger erstattet), freie Punkte ${r.m.sp} (19 erwartet)`);
    ok(r.r.lv === 72 && r.r.gold === 5000 && r.r.lvr === 72 && r.r.cos && !r.r.w && r.r.tt.includes('lv70') && r.r.t === 'lv70' && r.r.once && r.saved, 'Held über 60/70: Mantel (60) und Titel (70) einmal nachgereicht, keine Flügel (80), kein Gold');
  }

  console.log('Meister-Talente: 99 Punkte je Klasse, Level-Sperren, Schlusssteine');
  {
    const src = (await Promise.all(['items.js', 'combat.js', 'mastery.js'].map(f => page.evaluate(u => fetch(u).then(r => r.text()), BASE + 'js/' + f)))).join('\n');
    const r = await ev(([H_]) => {
      const HERO = eval('(' + H_ + ')'), o = { cls: {} };
      const cap = (cls, L) => { let n = 0; for (const [, nodes] of TALENTS[cls]) for (const t of nodes) if (!t.lv || t.lv <= L) n += t.max; return n; };
      const fill = () => { let go = true; while (go) { go = false; TALENTS[P.cls].forEach((br, bi) => br[1].forEach((n, ni) => { if (talentState(P.cls, bi, ni).can) { learnTalent(bi, ni); go = true; } })); } };
      o.keys = [];
      for (const cls of Object.keys(CLASSES)) {
        const T_ = TALENTS[cls], x = {};
        x.total = talentTotal(cls); x.base = T_.every(([, n]) => n.slice(0, 4).reduce((a, t) => a + t.max, 0) === 10 && n.slice(0, 4).every(t => !t.lv));
        x.master = T_.every(([, n]) => n.length === 11 && n.slice(4).every(t => t.lv >= 30 && t.lv <= 100 && t.n && t.d) && n.slice(4).reduce((a, t) => a + t.max, 0) === 23);
        x.caps = T_.map(([, n]) => n.filter(t => t.cap).map(t => t.lv)).join('|');
        x.room = Array.from({ length: 100 }, (_, i) => i + 1).every(L => cap(cls, L) >= L - 1) && cap(cls, 99) === 98 && cap(cls, 100) === 99;
        for (const [, n] of T_) for (const t of n.slice(4)) o.keys.push(...Object.keys(t.e));
        HERO(cls, 100); fill(); x.full100 = spentPoints() === 99 && P.sp === 0;
        HERO(cls, 99); fill(); const lastCap = T_.map(([, n]) => n[10]).find(t => t.lv === 100); x.full99 = spentPoints() === 98 && !P.talents[lastCap.id];
        o.cls[cls] = x;
      }
      HERO('knight', 89); P.sp = 200; fill(); o.gate = P.talents.kw10 === 2 && !P.talents.kw11 && !learnTalent(0, 10) && talentState('knight', 0, 10).lvLock; P.lv = 90; o.gate90 = learnTalent(0, 10) && P.talents.kw11 === 1;
      HERO('knight', 40); computeStats(); const d0 = P.st.m.dmg || 0; for (const [bi, ni] of [[0, 0], [0, 0], [0, 0], [0, 1], [0, 2], [0, 3]]) learnTalent(bi, ni); computeStats(); const d1 = P.st.m.dmg;
      for (let i = 0; i < 4; i++) learnTalent(0, 4); computeStats(); o.kw5 = Math.abs(P.st.m.dmg - d1 - .12) < 1e-9 && d1 > d0; o.resp = respec() && spentPoints() === 0 && P.sp === 39;
      // Schlusssteine wirken: Phönixfeuer (ein Feuerball mehr), Sturm der Pfeile (+3 Pfeile)
      const shots = (cls, k) => { P.map = genMap(1); startRoom('kampf', 0); G.waves = []; G.pending = []; enemies = []; projs = []; P.res = 999; P.cds = [0, 0, 0]; P.roll = 0; setState('play'); useSkill(0); const n = projs.filter(p => p.k === k).length; G = null; setState('menu'); return n; };
      HERO('mage', 100); fill(); o.m1 = [shots('mage', 'fireball')]; respec(); computeStats(); o.m1.push(shots('mage', 'fireball'));
      HERO('ranger', 100); fill(); o.a1 = [shots('ranger', 'arrow')]; P.talents.aa11 = 0; computeStats(); o.a1.push(shots('ranger', 'arrow'));
      return o;
    }, [H]);
    for (const cls in r.cls) { const x = r.cls[cls]; ok(x.total === 99 && x.base && x.master, `${cls}: 30 Grundpunkte + 69 Meisterpunkte = ${x.total} – Meister-Talente mit Level-Sperre`); ok(x.caps === '90|95|100' && x.room, `${cls}: Schlusssteine ab Level ${x.caps.replace(/\|/g, ' / ')}, jeder Punkt hat Platz, voll erst bei 100`); ok(x.full100 && x.full99, `${cls}: Level 100 füllt den Baum (99), Level 99 nicht (98)`); }
    const unknown = [...new Set(r.keys)].filter(k => !new RegExp(`mod\\('${k}'\\)|m\\.${k}\\b|mod2\\(m, '${k}'\\)`).test(src));
    ok(!unknown.length, 'jede Meister-Wirkung wirkt im Spiel (Werte oder Fähigkeiten)' + (unknown.length ? ': ' + unknown.join(', ') : ''));
    ok(r.gate && r.gate90, 'gesperrt bis zum Level: Schlussstein Klingenorkan erst ab Level 90');
    ok(r.kw5 && r.resp, 'Klingenschliff 4/4: +12 % Schaden; Zurücksetzen gibt alle Punkte zurück');
    ok(r.m1[0] === 2 && r.m1[1] === 1, `Phönixfeuer: zwei Feuerbälle statt einem (${r.m1.join(' → ')})`);
    ok(r.a1[0] === r.a1[1] + 3, `Sturm der Pfeile: +3 Pfeile im Fächer (${r.a1.join(' gegen ')})`);
  }

  console.log('Level-Belohnungen: jedes Level, genau einmal');
  {
    const r = await ev(([H_]) => {
      const HERO = eval('(' + H_ + ')'), o = {};
      // Inhalt: jedes Level 2–100
      const bad = [];
      for (let L = 2; L <= 100; L++) {
        const E = lvReward(L), t = k => E.filter(e => e.t === k);
        const okL = t('gold').length === 1 && t('gold')[0].n > 0 && E.some(e => e.t === 'mat' && !MATS[e.k].res) && E.some(e => e.t === 'mat' && MATS[e.k].res) && E.every(e => e.t !== 'mat' || (MATS[e.k] && e.n >= 1))
          && t('part').length === 1 && pvalid(t('part')[0].k) && (t('fate').length === (L % 5 === 0 ? 1 : 0)) && (E.some(e => ['epic', 'leg', 'myth', 'egg'].includes(e.t)) === (L % 10 === 0))
          && E.some(e => e.t === 'cos' || e.t === 'title') === (L >= 60 && L % 10 === 0) && E.every(e => lvrName(e) && lvrIcon(e) && lvrChip(e));
        if (!okL) bad.push(L);
      }
      o.bad = bad; o.none = lvReward(1).length === 0 && lvReward(101).length === 0;
      o.gold = [2, 10, 50, 100].map(L => lvReward(L)[0].n);
      o.cos = ['c_aufstieg', 'w_aufstieg', 'a_hundert'].every(k => COSM[k] && COSM[k].lvl) && ['lv70', 'lv90', 'lv100'].every(k => FK_TITLES[k]);
      // Sprung über 12 Level: jede Belohnung einmal
      HERO('ranger', 1); const g0 = P.gold, f0 = P.fate, e0 = SAVE.meta.pets.eggs.length, sum = {};
      for (let L = 2; L <= 13; L++) for (const e of lvReward(L)) if (e.t === 'gold' || e.t === 'mat' || e.t === 'part' || e.t === 'fate') { const k = e.t === 'mat' || e.t === 'part' ? e.t + ':' + e.k : e.t; sum[k] = (sum[k] || 0) + e.n; }
      const m0 = JSON.stringify(P.mats), p0 = JSON.stringify(P.parts);
      UPTO(13); o.jump = P.lv === 13 && P.lvr === 13 && P.gold - g0 === sum.gold && P.fate - f0 === sum.fate && P.bag.some(it => it.rar === 3) && $('banTitle').textContent === 'LEVEL 13 (+12)';
      o.mats = Object.keys(sum).filter(k => k.startsWith('mat:')).every(k => (P.mats[k.slice(4)] || 0) - (JSON.parse(m0)[k.slice(4)] || 0) === sum[k]);
      o.parts = Object.keys(sum).filter(k => k.startsWith('part:')).every(k => (P.parts[k.slice(5)] || 0) - (JSON.parse(p0)[k.slice(5)] || 0) === sum[k]);
      o.sub = $('banSub').textContent;
      // nichts doppelt: gleiches Level noch einmal, Wiedergeburt und wieder hoch
      const g1 = P.gold, f1 = P.fate, b1 = P.bag.length; o.again = lvrGrant(13).length === 0 && lvrGrant(5).length === 0 && P.gold === g1;
      P.lv = 50; P.maxAct = 5; P.lvr = 50; openChar('para'); LVR.sub = 'para'; openChar('para'); panel.querySelector('[data-act="rebirth"]').click(); panel.querySelector('[data-act="rebirthok"]').click();
      o.reb = P.lv === 1 && P.lvr === 50 && P.rebirths === 1; const g2 = P.gold, f2 = P.fate, b2 = P.bag.length;
      UPTO(20); o.noDouble = P.lv === 20 && P.gold === g2 && P.fate === f2 && P.bag.length === b2;
      UPTO(51); o.after = P.gold - g2 === lvReward(51)[0].n && P.lvr === 51;
      // Eier, Meilensteine, Level 100
      HERO('knight', 19); const eg = SAVE.meta.pets.eggs.length; UPTO(20); o.egg = SAVE.meta.pets.eggs.length === eg + 1;
      HERO('knight', 59); UPTO(60); o.c60 = SAVE.meta.cos.includes('c_aufstieg'); UPTO(70); o.t70 = fkM().tt.includes('lv70') && fkM().t === 'lv70';
      UPTO(100); o.l100 = SAVE.meta.cos.includes('a_hundert') && SAVE.meta.cos.includes('w_aufstieg') && fkM().tt.includes('lv90') && fkM().tt.includes('lv100') && P.bag.some(it => it.rar === 6) && P.lvr === 100;
      // zweiter Held erreicht 60: Mantel schon da → Glücksmünzen statt doppelt
      const keep = { cos: SAVE.meta.cos.slice(), ruf: JSON.parse(JSON.stringify(SAVE.meta.ruf)) };
      const c = newChar('mage', 'Zweite', 'normal', false); SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); P.lv = 59; P.lvr = 59; P.map = genMap(1); const f3 = P.fate;
      UPTO(60); o.dup = SAVE.meta.cos.filter(k => k === 'c_aufstieg').length === 1 && P.fate - f3 === lvReward(60).find(e => e.t === 'fate').n + 3; void keep;
      // Tempel verschenkt keine Level-Kosmetik
      SAVE.meta.cos = []; let lvl = 0; for (let i = 0; i < 60; i++) { grantCosmetic(); } lvl = SAVE.meta.cos.filter(k => COSM[k].lvl).length; o.temple = lvl === 0;
      // Erfolge Level 75 und 100
      SAVE.meta.ach = {}; SAVE.meta.stats.maxLv = 100; checkAch(); o.ach = !!SAVE.meta.ach.lv75 && !!SAVE.meta.ach.lv100 && ACH.some(a => a.id === 'lv75') && ACH.some(a => a.id === 'lv100');
      return o;
    }, [H]);
    await page.waitForTimeout(1200); r.toast = await ev(() => $('toast').textContent);
    ok(!r.bad.length && r.none, 'jedes Level 2–100: Gold, Material, Rohstoff, Bauteil; alle 5 Glücksmünzen; alle 10 Gegenstand oder Ei; ab 60 Kosmetik/Titel' + (r.bad.length ? ' – falsch bei ' + r.bad.join(', ') : ''));
    ok(r.gold[0] < r.gold[1] && r.gold[1] < r.gold[2] && r.gold[2] < r.gold[3], `Gold wächst mit dem Level (${r.gold.join(' / ')} bei 2 / 10 / 50 / 100)`);
    ok(r.cos, 'Kosmetik und Titel der Meilensteine gibt es im Spiel');
    ok(r.jump && r.mats && r.parts, `Sprung von Level 1 auf 13: jede Belohnung genau einmal (Gold, Material, Bauteile, Glücksmünzen, epischer Gegenstand) – „${r.sub}“`);
    ok(r.again && r.reb && r.noDouble && r.after, 'nichts doppelt: gleiches Level, Wiedergeburt und wieder hoch – erst Level 51 gibt wieder etwas');
    ok(r.egg, 'Level 20: ein seltenes Ei im Brutnest');
    ok(r.c60 && r.t70 && r.l100, 'Level 60 Mantel, 70 Titel (gleich gewählt), 80 Flügel, 90 Titel, 100 Aura der Hundert, Titel und mythischer Gegenstand');
    ok(/Level-Belohnung/.test(r.toast), `Hinweis bei besonderen Belohnungen („${r.toast}“)`);
    ok(r.dup, 'zweiter Held bei 60: Mantel schon da – stattdessen 3 Glücksmünzen');
    ok(r.temple, 'der Glückstempel verschenkt keine Level-Kosmetik');
    ok(r.ach, 'Erfolge für Level 75 und 100');
  }

  console.log('Handbuch');
  {
    const r = await ev(() => {
      hbBuild(); const by = HB.by, ids = ['start:level', 'start:lvbel', 'start:paragon', 'cls:talente', 'cls:mtal'];
      const txt = ids.map(id => by[id] ? by[id].s + ' ' + by[id].b() : '');
      return { have: ids.every(id => by[id]), see: ids.every(id => by[id].see.every(s => by[s])), lv: /100/.test(txt[0]) && /Belohnung/.test(txt[1]) && /Level 100/.test(txt[2]) && /Meister/.test(txt[3]) && /Schlussstein/.test(txt[4]) && /Phönixfeuer/.test(txt[4]), old: /Level 50/.test(txt[2]) };
    }).catch(e => ({ err: e.message }));
    ok(r.have && r.see && r.lv && r.old, 'Handbuch: Level, Level-Belohnungen, Paragon, Talente und Meister-Talente aktuell' + (r.err ? ' – ' + r.err : ''));
  }
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();

  // Bedienung und Bildschirme: Handy hoch und quer (Touch), PC
  for (const [W, Hh, pc] of [[390, 844, false], [844, 390, false], [1280, 720, true]]) {
    const name = pc ? 'pc' : W > Hh ? 'quer' : 'hoch', pre = `${name} ${W}×${Hh}: `;
    console.log('Bildschirme ' + name);
    const ctx = await b.newContext(pc ? { viewport: { width: W, height: Hh }, locale: 'de-DE' } : { viewport: { width: W, height: Hh }, isMobile: true, hasTouch: true, locale: 'de-DE', deviceScaleFactor: 2 });
    const pg = await ctx.newPage(); const perr = []; pg.on('pageerror', e => perr.push(e.message));
    await pg.goto(BASE + 'index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(1500);
    await pg.evaluate(`(${UPTO.toString()})()`);
    await pg.evaluate(([H_]) => { eval('(' + H_ + ')')('knight', 1); UPTO(64); SAVE.meta.pets.intro = true; P.paragon = 12; P.pp = { dmg: 4, hp: 3, def: 0, crit: 0 }; P.maxAct = 6; P.act = 6; saveChar(); hideOverlay(); openMap(); if (typeof DLG !== 'undefined' && DLG) DLG.skip(); }, [H]);
    await pg.waitForTimeout(400);
    const tap = async sel => { const el = pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); if (pc) await el.click({ timeout: 4000 }); else await el.tap({ timeout: 4000 }); await pg.waitForTimeout(250); };
    const shot = async n => { await pg.evaluate(() => { panel.scrollTop = 0; }); await pg.waitForTimeout(100); await pg.screenshot({ path: path.join(OUT, `${name}-${n}.png`) }); };
    const wide = () => pg.evaluate(() => panel.scrollWidth > panel.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1);
    const small = () => pg.evaluate(() => [...panel.querySelectorAll('.taltier .opt,.lvsub .opt,.tal,.lvrall,.fkttl .opt,[data-act="respec"],[data-act="pp"],[data-act="rebirth"]')].filter(x => x.offsetParent && (x.getBoundingClientRect().height < 43.5 || x.getBoundingClientRect().width < 43.5)).map(x => (x.dataset.act || x.className) + ':' + Math.round(x.getBoundingClientRect().width) + 'x' + Math.round(x.getBoundingClientRect().height)));
    await tap('[data-act="char"]'); await tap('[data-act="ctab"][data-id="tal"]');
    const t1 = await pg.evaluate(() => ({ tier: panel.querySelector('.taltier .opt.sel') ? panel.querySelector('.taltier .opt.sel').dataset.id : '', n: panel.querySelectorAll('.tal').length, free: P.sp }));
    ok(t1.tier === 'base' && t1.n === 12, pre + `Talente: Grundstufe zuerst (noch Punkte frei: ${t1.free}), 12 Talente`);
    await shot('talente'); ok(!(await wide()), pre + 'Talente: nichts ragt seitlich heraus');
    if (!pc) { const s = await small(); ok(!s.length, pre + 'Talente: Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 5).join(', ') : '')); }
    await tap('[data-act="tal"][data-id="0,0"]'); await tap('[data-act="tal"][data-id="0,1"]'); await tap('[data-act="tal"][data-id="0,2"]'); await tap('[data-act="tal"][data-id="0,3"]');
    await tap('[data-act="taltier"][data-id="master"]');
    const t2 = await pg.evaluate(() => ({ n: panel.querySelectorAll('.tal').length, lock: [...panel.querySelectorAll('.tal.lvl .tlv')].map(e => e.textContent), cap: panel.querySelectorAll('.tal.cap').length, can: !!panel.querySelector('.tal.can[data-id="0,4"]') }));
    ok(t2.n === 21 && t2.cap === 3 && t2.lock.length >= 6 && /ab Level 70/.test(t2.lock.join('|')) && t2.can, pre + `Meister: 21 Talente, 3 Schlusssteine, gesperrte zeigen ihr Level („${t2.lock[0]}“)`);
    await tap('[data-act="tal"][data-id="0,4"]'); await tap('[data-act="tal"][data-id="0,4"]');
    ok(await pg.evaluate(() => P.talents.kw5 === 2), pre + 'Meister-Talent lernen per Antippen');
    await tap('[data-act="tal"][data-id="0,10"]');
    ok(await pg.evaluate(() => !P.talents.kw11 && /ab Level 90/.test($('toast').textContent)), pre + 'gesperrter Schlussstein: Hinweis „ab Level 90“');
    await shot('meister'); ok(!(await wide()), pre + 'Meister: nichts ragt seitlich heraus');
    if (!pc) { const s = await small(); ok(!s.length, pre + 'Meister: Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 5).join(', ') : '')); }
    await tap('[data-act="ctab"][data-id="para"]');
    const l1 = await pg.evaluate(() => ({ tab: [...panel.querySelectorAll('.tab')].some(t => t.getAttribute('aria-selected') === 'true' && /AUFSTIEG/.test(t.textContent)), rows: panel.querySelectorAll('.lvrrow').length, got: panel.querySelectorAll('.lvrrow.got').length, nx: panel.querySelector('.lvrrow.nx .lvrn') ? panel.querySelector('.lvrrow.nx .lvrn').textContent : '', ms: panel.querySelectorAll('.lvrm').length, msGot: panel.querySelectorAll('.lvrm.got').length, sp: [...panel.querySelectorAll('.lvrsp')].map(e => e.textContent).join(' | ') }));
    ok(l1.tab && l1.nx === '65' && l1.got === 2 && l1.ms === 10 && l1.msGot === 6, pre + `AUFSTIEG: Zeitleiste mit erhalten (${l1.got}), als Nächstes LV ${l1.nx}, Meilensteine ${l1.msGot}/${l1.ms}`);
    ok(/Legendärer|Titel|Ei/.test(l1.sp), pre + `Meilensteine nennen die großen Belohnungen (${l1.sp.slice(0, 60)}…)`);
    await shot('belohnungen'); ok(!(await wide()), pre + 'Level-Belohnungen: nichts ragt seitlich heraus');
    if (!pc) { const s = await small(); ok(!s.length, pre + 'Level-Belohnungen: Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 5).join(', ') : '')); }
    await tap('[data-act="lvr_all"]');
    ok(await pg.evaluate(() => panel.querySelectorAll('.lvrrow').length === 99), pre + '„Alle 99 Level zeigen“ zeigt die ganze Zeitleiste');
    await pg.evaluate(() => { const r = panel.querySelector('.lvrrow.nx'); if (r) r.scrollIntoView({ block: 'center' }); }); await pg.screenshot({ path: path.join(OUT, `${name}-zeitleiste.png`) });
    await tap('[data-act="lvr_sub"][data-id="para"]');
    const p1 = await pg.evaluate(() => ({ t: panel.innerText, pp: panel.querySelectorAll('[data-act="pp"]').length, rb: !!panel.querySelector('[data-act="rebirth"]') }));
    ok(p1.pp === 4 && p1.rb && /Ab Level 100/.test(p1.t) && /von früher/.test(p1.t), pre + 'PARAGON: Punkte verteilen, „ab Level 100“, alte Punkte bleiben, Wiedergeburt');
    await tap('[data-act="pp"][data-id="def"]'); ok(await pg.evaluate(() => P.pp.def === 1), pre + 'Paragonpunkt verteilen geht weiter');
    await shot('paragon'); ok(!(await wide()), pre + 'Paragon: nichts ragt seitlich heraus');
    if (!pc) { const s = await small(); ok(!s.length, pre + 'Paragon: Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 5).join(', ') : '')); }
    // Level-Aufstieg im Kampf: Banner und Hinweis
    await pg.evaluate(() => { hideOverlay(); P.map = genMap(P.act); startRoom('kampf', 0); G.waves = []; G.pending = []; enemies = []; P.inv = 1e9; UPTO(70); });
    await pg.waitForTimeout(700); await pg.screenshot({ path: path.join(OUT, `${name}-aufstieg.png`) });
    ok(await pg.evaluate(() => /LEVEL 70/.test($('banTitle').textContent) && /Gold/.test($('banSub').textContent)), pre + 'Banner beim Aufstieg zeigt Level und Belohnung');
    ok(!perr.length, pre + 'keine Fehler im Spiel' + (perr.length ? ': ' + perr.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
