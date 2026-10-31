// Begleiter-Aufstieg (6.4): Höchststufe 150 mit Stufe „Aufgestiegen“ (Aura, mythische Gestalt bleibt), EP-Kurve (1–100 wie bisher, danach
// steiler – gemessen mit echten Wellen und Kills), Talentbaum mit Aufstiegs-Stufe (Level-Sperren, Krönungen, 101 Punkte = voll erst bei 150),
// Belohnung je Level genau einmal (auch mehrere Level auf einmal), alte und getauschte Begleiter ohne Flut, Aura und Titel, Handbuch,
// Bildschirmfotos hoch, quer und PC (Übersicht mit Zeitleiste, Talente, Kampf mit Aura), kein seitliches Scrollen, Knöpfe ≥ 44 px.
// Aufruf: node begleiter-aufstieg.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/begleiter-aufstieg';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
const HERO = (lv) => {
  localStorage.clear(); loadAll();
  const c = newChar('knight', 'Pflegerin', 'normal', false); c.lv = lv || 40; c.act = 3; c.maxAct = 3; c.story = { a1: 1, a2: 1, a3: 1 };
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; SAVE.meta.hide.tip62 = 1; for (const a of ACH) SAVE.meta.ach[a.id] = 1;
  if (SAVE.meta.lande) SAVE.meta.lande.tips = 0xffff; const M = SAVE.meta.pets; M.starter = true; M.first = true; M.intro = true;
  P.gold = 0; P.fate = 0; P.mats = {}; computeStats(); P.hp = P.st.hp; saveChar(); persist();
};
// alte Kurve (bis 6.3) zum Vergleich
const OLDNEED = lv => Math.round(100 * Math.pow(lv, 2.6) * Math.min(1, Math.max(.05, Math.pow(lv / 11, 1.5))));

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim())); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  const H = HERO.toString(), ON_ = OLDNEED.toString();

  console.log('Höchststufe, Stufen und Kurve');
  {
    const r = await page.evaluate(([H_, ON__]) => {
      eval('(' + H_ + ')')(40); const old = eval('(' + ON__ + ')'), o = {}, M = SAVE.meta.pets;
      o.cap = PET_LVMAX === 150 && PET_ASC === 101;
      // kaputte und alte Daten: Level höchstens 150, EP 0 auf der Höchststufe, alte Begleiter auf 100 leveln weiter
      const m = fixMeta({ stats: {}, pets: { list: [{ id: 'a', sp: 'drache', lv: 999, xp: 5e9 }, { id: 'b', sp: 'katze', lv: 100, xp: 0, tl: '553103300000000' }, { id: 'c', sp: 'eule', lv: 57, xp: 12 }] } }).pets.list;
      o.fix = m[0].lv === 150 && m[0].xp === 0 && m[1].lv === 100 && m[2].lv === 57;
      o.oldLr = m[0].lr === 150 && m[1].lr === 100 && m[2].lr === 57;
      o.oldTl = m[1].tl.length === PET_TALN && m[1].tl.startsWith('553103300000000') && petTalUsed(m[1]) === 20;
      // Kurve: bis 100 genau wie bisher, danach streng steigend; LV 101 kaum teurer als 100, 149 deutlich teurer
      o.same = true; for (let l = 1; l <= 100; l++) if (petNeed(l) !== old(l)) o.same = false;
      o.mono = true; for (let l = 2; l <= 149; l++) if (!(petNeed(l) > petNeed(l - 1))) o.mono = false;
      o.r101 = petNeed(101) / petNeed(100); o.r149 = petNeed(149) / petNeed(99); o.r140 = petNeed(140) / petNeed(110);
      let a = 0, c2 = 0; for (let l = 1; l < 100; l++) a += petNeed(l); for (let l = 100; l < 150; l++) c2 += petNeed(l); o.tot100 = a; o.tot150 = c2;
      // Stufen: 100 Mythisch, ab 101 Aufgestiegen – Bild bleibt das mythische
      o.stage = [99, 100, 101, 150].map(petStage).join('') === '4566'.replace('4', '5') || [99, 100, 101, 150].map(petStage).join('');
      o.stg = petStage(100) === 5 && petStage(101) === 6 && petStage(150) === 6 && PET_STN[6] === 'Aufgestiegen' && petForm(150) === 5 && petForm(101) === 5;
      const p = petGive('drache', { lv: 100 }); const u100 = petURL(p).url; p.lv = 150; o.sprite = petURL(p).url === u100 && petAsc(p) && petPow(101) === 2.25 && petSpecCd(101) === 11 && petPow(100) === 2 && petSpecCd(100) === 12;
      o.dmg = Math.abs(petDmgK(150) / petDmgK(100) - 1.2) < 1e-9 && petDmgK(100) === .75 && petMagR(150) === petMagR(100);
      // Höchststufe: keine EP mehr, Füttern gesperrt
      p.xp = 0; o.max = petXP(p, 1e12) === 0 && p.lv === 150 && p.xp === 0;
      p.lv = 149; p.lr = 149; p.xp = 0; o.to150 = petXP(p, 1e12, true) === 1 && p.lv === 150 && p.xp === 0;
      M.list = []; M.act = null;
      return o;
    }, [H, ON_]);
    ok(r.cap && r.fix && r.oldLr, 'Höchststufe 150: kaputte Level werden auf 150 begrenzt, alte Begleiter (auch LV 100) bleiben und leveln weiter');
    ok(r.oldTl, 'alter Talent-String (15 Ziffern) bleibt erhalten, neue Knoten stehen dahinter auf 0');
    ok(r.same, 'EP-Kurve LV 1–100 genau wie bisher');
    ok(r.mono && r.r101 > 1 && r.r101 < 1.1 && r.r149 > 4 && r.r149 < 6.5 && r.r140 > 2, `EP-Kurve ab 100 steigt: LV 101 ×${r.r101.toFixed(2)} von LV 100, LV 149 ×${r.r149.toFixed(1)} von LV 99, LV 140 ×${r.r140.toFixed(1)} von LV 110`);
    ok(r.tot150 > r.tot100 * 2, `LV 100 → 150 braucht ${(r.tot150 / 1e9).toFixed(2)} Mrd. EP (LV 1 → 100: ${(r.tot100 / 1e6).toFixed(0)} Mio.)`);
    ok(r.stg && r.sprite, 'Stufe „Aufgestiegen“ ab LV 101, Bild bleibt das mythische, Spezialangriff ×2,25 und alle 11 s (75/100 wie bisher)');
    ok(r.dmg, 'Schaden wächst über LV 100 nur halb so schnell (LV 150: +20 %), Beutemagnet bleibt bei LV 100');
    ok(r.max && r.to150, 'LV 150: keine EP mehr; mehrere Level auf einmal enden genau bei 150');
  }

  // Simulation: echte Wellen (buildWave), echte Gegner (spawnEnemy) und Kills (killEnemy) – EP des Begleiters und Futterwert der Materialbeute je Kill
  console.log('EP-Kurve: Simulation (Minuten je Level bei 30 Kills/min)');
  {
    const r = await page.evaluate(([H_]) => {
      eval('(' + H_ + ')')(60); const M = SAVE.meta.pets, p = petGive('drache', { lv: 60 }); M.act = p.id; computeStats();
      let acc = 0; const oXP = petXP, R0 = Math.random; petXP = (pp, v) => { acc += Math.round(v); return 0; }; Math.random = mulberry(4242);
      window.WEEK_FORCE = 'schmiede'; P.created = 1;   // fester Zufall: kein Wochen-Ereignis mit mehr Beute/Eliten, feste Raum-Saat
      const inc = {};
      try {
        for (const st0 of [50, 100, 120, 150, 200, 245]) {
          let kills = 0, feed = 0; acc = 0;
          for (let room = 0; room < 27; room++) {
            const st = Math.max(1, st0 + ((room % 9) - 4) * 7); P.act = Math.floor((st - 1) / 7) + 1; const row = (st - 1) % 7; P.map = genMap(P.act); P.map.pos = { r: row, i: 0 };
            startRoom('kampf', row); P.inv = 999; const eliteP = DIFFS[P.diff].elite;
            for (const W of G.waves) for (const k of W.list) {
              const e = spawnEnemy(k, { elite: Math.random() < eliteP, instant: true, x: P.x + 40, y: P.y }); pickups = []; killEnemy(e, 0, 0); kills++;
              for (const q of pickups) if (q.k === 'mat') feed += (PET_FEED[q.m] || 0) * q.n;
              enemies = enemies.filter(x => x !== e);
            }
          }
          inc[st0] = { k: acc / kills, f: feed / kills, n: kills };
        }
      } finally { petXP = oXP; Math.random = R0; delete window.WEEK_FORCE; }
      enemies = []; pickups = []; G = null; setState('menu');
      // Begleiter-Level → übliche Stufe des Helden; Minuten = EP-Bedarf / (30 Kills × EP je Kill), Futter: nichts / die Hälfte / alles
      const rows = [[50, 50], [100, 100], [110, 120], [125, 150], [140, 200], [149, 245]].map(([lv, st]) => { const I = inc[st], n = petNeed(lv); return { lv, st, k: I.k, f: I.f, m: [0, .5, 1].map(x => n / ((I.k + x * I.f) * 30)) }; });
      return { rows, kills: Object.values(inc).reduce((a, x) => a + x.n, 0) };
    }, [H]);
    console.log('         LV   Stufe  EP/Kill  Futter/Kill  min/Level: nur Kampf · halbes Futter · alles Futter');
    for (const x of r.rows) console.log(`         ${String(x.lv).padStart(3)}  ${String(x.st).padStart(5)}  ${x.k.toFixed(0).padStart(7)}  ${x.f.toFixed(0).padStart(11)}  ${x.m.map(v => String(Math.round(v)).padStart(9)).join(' · ')}   (≈ ${(x.m[1] / 60).toFixed(1)} h)`);
    // Kampf-EP schwanken kaum → daran die Reihenfolge; Futter hängt an seltenen Funden (Schuppen, Äther) → nur grobe Grenzen
    const k = r.rows.map(x => x.m[0]), t = r.rows.map(x => x.m[1]);
    ok(r.kills > 5000, `${r.kills} echte Kills auf sechs Stufen gemessen`);
    ok(k.every((v, i) => !i || v > k[i - 1]), 'Minuten je Level (nur Kämpfe) steigen von LV 50 über 100, 110, 125, 140 bis 149');
    ok(k[4] > 1.5 * k[1] && k[5] > 1.8 * k[1] && t[4] > 1.8 * t[1] && t[5] > 2.2 * t[1], `140–150 sehr schwer: LV 140 ${(t[4] / t[1]).toFixed(1)}×, LV 149 ${(t[5] / t[1]).toFixed(1)}× so lange wie LV 100 (mit halbem Futter; nur Kämpfe ${(k[4] / k[1]).toFixed(1)}× / ${(k[5] / k[1]).toFixed(1)}×)`);
    ok(t[2] < 1.6 * t[1] && k[2] < 1.25 * k[1], `LV 110 noch erreichbar: ${(t[2] / t[1]).toFixed(2)}× so lange wie LV 100`);
  }

  console.log('Talentbaum: Aufstiegs-Stufe, Level-Sperren, Krönungen');
  {
    const r = await page.evaluate(([H_]) => {
      eval('(' + H_ + ')')(60); const o = {}, M = SAVE.meta.pets;
      const sum = B => B.nodes.reduce((a, N) => a + N.max, 0);
      o.total = PET_TALMAX === 103 && petTalPts(150) === PET_TALMAX && petTalPts(149) === 100 && petTalPts(100) === 51 && petTalPts(101) === 52 && petTalPts(30) === 16;
      // nie Punkte, die sich nirgends ausgeben lassen: je Level höchstens so viele Punkte wie freigeschaltete Ränge
      o.noIdle = true; for (let l = 1; l <= 150; l++) { const cap = PET_TAL.reduce((a, B) => a + B.nodes.reduce((s, N) => s + (!N.lv || l >= N.lv ? N.max : 0), 0), 0); if (petTalPts(l) > cap) o.noIdle = false; }
      o.branches = PET_TAL.map(sum).join(',');
      o.gates = PET_TAL.every(B => B.nodes.length === 10 && B.nodes.slice(5).map(N => N.lv).join() === '100,110,120,135,150' && B.nodes[9].cap && B.nodes[9].max === 1 && B.nodes.slice(0, 5).every(N => !N.lv));
      o.idx = (() => { const s = new Set(); for (let bi = 0; bi < 3; bi++) for (let ni = 0; ni < 10; ni++) { const i = petTalIdx(bi, ni), [b2, n2] = petTalAt(i); if (b2 !== bi || n2 !== ni) return false; s.add(i); } return s.size === 30 && petTalIdx(2, 4) === 14 && petTalIdx(0, 5) === 15; })();
      // LV 100: Knoten „ab LV 100“ geht, „ab LV 110“ nicht; LV 110 dann schon; Krönung erst bei 150
      const p = petGive('wolf', { lv: 100 }); petView = p.id; M.act = p.id;
      ON.pettal(null, null, petTalIdx(0, 5)); o.l100 = petTl(p)[15] === 1;
      ON.pettal(null, null, petTalIdx(0, 6)); o.l110no = petTl(p)[16] === 0;
      const html = petTalHTML(p); o.lockTxt = html.includes('Ab LV 110') && html.includes('Ab LV 150') && html.includes('AUFSTIEG');
      p.lv = 110; ON.pettal(null, null, petTalIdx(0, 6)); o.l110 = petTl(p)[16] === 1;
      p.lv = 149; ON.pettal(null, null, petTalIdx(1, 9)); o.cap149 = petTl(p)[petTalIdx(1, 9)] === 0;
      // alles lernen: bei 149 alles außer den Krönungen, bei 150 ist der Baum voll
      const fill = () => { for (let k = 0; k < 200; k++) { let any = false; for (let i = 0; i < PET_TALN; i++) { const [bi, ni] = petTalAt(i); if (petTalState(p, bi, ni).can) { ON.pettal(null, null, i); any = true; } } if (!any) break; } };
      fill(); o.notFull149 = petTalFree(p) === 0 && petTalUsed(p) === 100 && petTl(p).every((v, i) => { const [bi, ni] = petTalAt(i), N = PET_TAL[bi].nodes[ni]; return N.cap ? v === 0 : v === N.max; });
      p.lv = 150; fill(); o.full150 = petTalFree(p) === 0 && petTalUsed(p) === 103 && petTl(p).every((v, i) => { const [bi, ni] = petTalAt(i); return v === PET_TAL[bi].nodes[ni].max; });
      // Wirkung: Krönungen und neue Knoten über das bestehende Werte-System
      const m = petMods(p); o.mods = Math.abs(m.pdmg - (.3 + .15)) < 1e-9 && m.pspk === .5 && m.pbond === 1 && m.pbag === 5 && Math.abs(m.dr - .09) < 1e-9 && m.def === 15 + 12;
      computeStats(); o.hero = (P.st.m.def || 0) >= 27 && P.st.dr >= .09;
      // Kürzen: Aufstiegs-Knoten über dem Level fallen weg, zu viele Punkte von hinten
      o.fix = petTlFix('000000000000000' + '333221333221333', 105).slice(15) === '300001000020000' && petTlFix('9'.repeat(30), 150).split('').reduce((a, x) => a + +x, 0) === 103 && petTlFix('9'.repeat(30), 120).split('').reduce((a, x) => a + +x, 0) === petTalPts(120);
      // Lebensbund: ein Treffer unter 30 % → +35 % Leben, danach 90 s Pause
      P.lv = 60; computeStats(); startRoom('kampf', 2); G.waves = []; G.pending = []; G.phase = 'fight'; enemies = []; petPlace(false);
      P.inv = 0; P.hp = Math.round(P.st.hp * .4); const d0 = P.st.dodge; P.st.dodge = 0; P.st.dr = 0;
      const want = P.st.hp * .2; hurtPlayer(want / (40 / (40 + P.st.def)), null); const hp1 = P.hp; o.bond = hp1 > P.st.hp * .45;
      P.inv = 0; P.hp = Math.round(P.st.hp * .4); hurtPlayer(want / (40 / (40 + P.st.def)), null); o.bondCd = P.hp < P.st.hp * .3;
      P.st.dodge = d0; P.inv = 999; G = null; setState('menu'); enemies = [];
      M.list = []; M.act = null;
      return o;
    }, [H]);
    ok(r.total && r.noIdle && r.branches === '35,35,33', `Baum: ${r.branches} = 103 Punkte = Punkte bei LV 150 (1 + je 2 Level bis 100, dann je Level, bei 150 drei), nie unverteilbare Punkte`);
    ok(r.gates && r.idx, 'je Zweig 5 Aufstiegs-Knoten (LV 100/110/120/135, Krönung 150), alte 15 Stellen bleiben vorn');
    ok(r.l100 && r.l110no && r.l110 && r.cap149 && r.lockTxt, 'Level-Sperren: „ab LV 100“ ab 100, „ab LV 110“ erst ab 110, Krönung erst ab 150, gesperrt zeigt „Ab LV …“');
    ok(r.notFull149 && r.full150, 'Baum erst bei LV 150 ganz voll (bei 149 alles außer den drei Krönungen)');
    ok(r.mods && r.hero, 'Aufstiegs-Talente wirken: Schaden, Krönungen (Sternenzorn, Lebensbund, Hortwächter), Verteidigung und Schadensminderung für dich');
    ok(r.fix, 'kaputte Talente: Aufstiegs-Knoten über dem Level gestrichen, zu viele Punkte gekürzt');
    ok(r.bond && r.bondCd, 'Krönung „Lebensbund“: rettet unter 30 % Leben, dann 90 s Pause');
  }

  console.log('Belohnungen je Level: genau einmal');
  {
    const r = await page.evaluate(([H_]) => {
      eval('(' + H_ + ')')(60); const o = {}, M = SAVE.meta.pets, p0 = petGive('drache', { lv: 1 }); M.act = p0.id; computeStats();
      // jedes Level 2–150 bringt etwas; alle 5 Rune (ab 25 + Glücksmünzen), alle 10 Ausrüstung (ab 30 + Ei), 101 und 110/125/150 extra
      o.every = true; o.five = true; o.ten = true;
      for (let l = 2; l <= 150; l++) {
        const L = petLvRew(p0, l), has = t => L.some(e => e.t === t);
        if (!has('gold') || L.filter(e => e.t === 'mat').length < 2) o.every = false;
        if (l % 5 === 0 && l % 10 && (!has('rune') || (l >= 25) !== has('fate'))) o.five = false;
        if (l % 10 === 0 && (!has('gear') || (l >= 30) !== has('egg'))) o.ten = false;
      }
      o.none = !petLvRew(p0, 1).length && !petLvRew(p0, 151).length;
      o.mile = [101, 110, 125, 150].every(l => petLvRew(p0, l).some(e => e.t === 'fate')) && [110, 125, 150].every(l => petLvRew(p0, l).some(e => e.t === 'aura')) && !petLvRew(p0, 120).some(e => e.t === 'aura');
      o.eggT = [30, 60, 90, 120, 150].map(l => petLvRew(p0, l).find(e => e.t === 'egg').tier).join(',');
      o.gearR = [10, 40, 80, 150].map(l => petLvRew(p0, l).find(e => e.t === 'gear').r).join(',');
      // ein Sprung von LV 1 auf 35 (Füttern): jedes Level einzeln, alles genau einmal
      let need = 0; for (let l = 1; l < 35; l++) need += petNeed(l);
      let gold = 0, fate = 0; for (let l = 2; l <= 35; l++) for (const e of petLvRew(p0, l)) { if (e.t === 'gold') gold += e.n; if (e.t === 'fate') fate += e.n; }
      P.gold = 0; P.fate = 0; P.mats = {}; M.runes = {}; M.gear = []; M.eggs = [];
      petXP(p0, need); o.jump = p0.lv === 35 && p0.lr === 35 && P.gold === gold && P.fate === fate;
      o.jumpItems = Object.values(M.runes).reduce((a, x) => a + x, 0) === 4 && M.gear.length === 3 && M.eggs.length === 1 && (P.mats.glut || 0) === [...Array(34)].reduce((a, _, i) => a + 1 + Math.floor((i + 2) / 25), 0);
      o.toast = $('toast').textContent.includes('Gold');
      const g1 = P.gold; o.again = !petLvPay(p0).length && P.gold === g1; petXP(p0, 5); o.small = P.gold === g1;
      // Meilenstein: über LV 110 hinweg → Aura und Titel „Sternenstaub“, Glücksmünzen
      const p1 = petGive('eule', { lv: 109 }); M.act = p1.id; const f0 = P.fate; petXP(p1, petNeed(109) + petNeed(110) + 1);
      o.aura = p1.lv === 111 && p1.au === 'stern' && p1.ti === 'stern' && P.fate - f0 >= 5 && p1.lr === 111;
      // Korb voll → Glücksmünzen statt Ei; Lager voll → Gold statt Ausrüstung
      while (M.eggs.length < EGG_MAX) eggGive('maus', true); while (M.gear.length < PET_GEAR_MAX) M.gear.push(petGearNew('h', 0, 10));
      const p2 = petGive('katze', { lv: 29 }); const f1 = P.fate, gd = P.gold; petXP(p2, petNeed(29));
      o.full = p2.lv === 30 && M.eggs.length === EGG_MAX && M.gear.length === PET_GEAR_MAX && P.fate - f1 === 2 && P.gold - gd > petLvRew(p2, 30).find(e => e.t === 'gold').n;
      M.eggs = []; M.gear = [];
      // ohne echten Helden: nichts verloren – ausstehend, beim Laden nachgereicht (und dann nie wieder)
      const p3 = petGive('fuchs', { lv: 60 }); p3.lr = 58; persist(); saveChar();
      const exp = petLvRew(p3, 59).concat(petLvRew(p3, 60)).filter(e => e.t === 'gold').reduce((a, e) => a + e.n, 0), g2 = P.gold;
      SAVE.meta = fixMeta(JSON.parse(JSON.stringify(SAVE.meta))); activateChar(0); const q3 = SAVE.meta.pets.list.find(x => x.sp === 'fuchs');
      o.pend = q3.lr === 60 && P.gold - g2 === exp;
      const g3 = P.gold; SAVE.meta = fixMeta(JSON.parse(JSON.stringify(SAVE.meta))); activateChar(0); o.pendOnce = P.gold === g3;
      return o;
    }, [H]);
    ok(r.every && r.none, 'jedes Level 2–150 bringt Gold, Leibspeise und Ausrüstungs-Material');
    ok(r.five && r.ten && r.mile, 'alle 5 Level Rune (ab LV 25 mit Glücksmünzen), alle 10 Ausrüstung (ab LV 30 mit Ei), LV 101/110/125/150 extra');
    ok(r.eggT === '3,4,5,6,6' && r.gearR === '2,3,4,4', `Eier werden seltener je höher (Seltenheit ${r.eggT}), Ausrüstung ${r.gearR}`);
    ok(r.jump && r.jumpItems && r.toast, 'Sprung LV 1 → 35: jedes Level einzeln belohnt (Gold, Glücksmünzen, 4 Runen, 3 Ausrüstungen, 1 Ei, Leibspeise), Hinweis zeigt die Belohnung');
    ok(r.again && r.small, 'nie doppelt: erneutes Auszahlen und EP ohne Level geben nichts');
    ok(r.aura, 'Meilenstein LV 110: Aura und Titel „Sternenstaub“ angelegt, Glücksmünzen');
    ok(r.full, 'Korb voll → 2 Glücksmünzen statt Ei, Lager voll → Gold statt Ausrüstung');
    ok(r.pend && r.pendOnce, 'ausstehende Belohnungen kommen beim Laden – genau einmal');
  }

  console.log('Alte und getauschte Begleiter: keine Flut');
  {
    const r = await page.evaluate(([H_]) => {
      eval('(' + H_ + ')')(60); const o = {};
      // alter Spielstand (6.3): Begleiter auf 100 und 57 ohne lr → zählen als belohnt
      const raw = JSON.parse(JSON.stringify(SAVE)); raw.meta.pets = { list: [{ id: 'w1', sp: 'wal', lv: 100, xp: 0, tl: '555535553555553', c0: 2, col: 2 }, { id: 'k1', sp: 'katze', lv: 57, xp: 10 }], act: 'w1', eggs: [], starter: true, hatched: 2 };
      localStorage.setItem(SAVE_KEY, JSON.stringify(raw)); loadAll(); activateChar(0);
      const M = SAVE.meta.pets, w = M.list[0]; o.load = M.list.length === 2 && w.lv === 100 && w.lr === 100 && M.list[1].lr === 57 && P.gold === 0 && P.fate === 0 && !M.eggs.length && !M.gear.length;
      o.tl = petTalUsed(w) === 51 && petTalFree(w) === 0;
      // weiter auf 101: genau die Belohnung von LV 101, ein Talentpunkt mehr, Aufstieg
      petXP(w, petNeed(100)); const g = petLvRew(w, 101).find(e => e.t === 'gold').n;
      o.next = w.lv === 101 && w.lr === 101 && P.gold === g && P.fate === 5 && petTalFree(w) === 1 && petStage(w.lv) === 6;
      // Tausch: Begleiter mit LV 130 (und erfundenem lr) bringt keine alten Belohnungen mit; Aura/Titel nach Level geprüft
      const g0 = P.gold; o.imp = petImport({ sp: 'wolf', lv: 130, lr: 1, au: 'ewig', ti: 'himmel', tl: '5'.repeat(30) }); const q = M.list[M.list.length - 1];
      o.impOk = o.imp && q.lr === 130 && P.gold === g0 && !q.au && q.ti === 'himmel' && petTalUsed(q) <= petTalPts(130);
      activateChar(0); o.impNo = P.gold === g0;
      // Export trägt Aura und Titel mit
      q.au = 'himmel'; const d = petExport(M.list.indexOf(q), true); o.exp = d.au === 'himmel' && d.ti === 'himmel' && !('lr' in d);
      return o;
    }, [H]);
    ok(r.load && r.tl, 'alter Spielstand: Begleiter auf LV 100 und 57 laden ohne Flut (keine Belohnungen für erreichte Level), Talente erhalten');
    ok(r.next, 'alter LV-100-Begleiter steigt auf: LV 101 bringt genau seine Belohnung und einen Talentpunkt');
    ok(r.impOk && r.impNo, 'getauschter Begleiter (LV 130): keine Belohnungen für fremde Level, Aura über seinem Level gestrichen, Talente gekürzt');
    ok(r.exp, 'Tausch: Aura und Titel reisen mit');
  }

  console.log('Aura, Titel, Handbuch');
  {
    const r = await page.evaluate(([H_]) => {
      eval('(' + H_ + ')')(60); const o = {}, M = SAVE.meta.pets, p = petGive('greif', { lv: 120 }); M.act = p.id; petView = p.id;
      ON.petaura('himmel'); o.lock = !p.au; ON.petaura('stern'); o.set = p.au === 'stern';
      p.lv = 125; ON.petaura('himmel'); ON.pettitle('himmel'); o.set2 = p.au === 'himmel' && p.ti === 'himmel';
      ON.petaura(''); ON.pettitle(''); o.off = !p.au && !p.ti;
      const f = petFix({ sp: 'greif', lv: 120, au: 'ewig', ti: 'stern' }); o.fix = !f.au && f.ti === 'stern';
      const low = petGive('maus', { lv: 100 }); petView = low.id; ON.petaura('stern'); o.lowNo = !low.au && petAuraHTML(low) === '';
      o.hb = ['pet:aufstieg', 'pet:belohnungen'].every(id => hbEntries().some(e => e.id === id)) && hbText('pet:aufstieg').includes('150') && hbText('pet:belohnungen').includes('Ei') && hbText('pet:talente').includes('ab LV 135') && hbSearch('aufgestiegen').includes('pet:aufstieg') && hbText('pet:futter').includes('Aufgestiegen');
      return o;
    }, [H]);
    ok(r.lock && r.set && r.set2 && r.off && r.fix && r.lowNo, 'Aura und Titel: nur freigeschaltete wählbar, abwählbar, kaputte gestrichen, unter LV 101 keine Aura');
    ok(r.hb, 'Handbuch: „Aufstieg“ und „Belohnungen je Level“, Talente mit Level-Sperren, Stufe „Aufgestiegen“');
  }
  ok(!errs.length, 'keine Fehler (Regeln)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await page.close();

  // Bildschirme: hoch und quer (Finger), PC (Maus)
  for (const [W, Hh, tag, touch] of [[390, 844, 'hoch', 1], [844, 390, 'quer', 1], [1280, 720, 'pc', 0]]) {
    console.log(`Bildschirm ${W}×${Hh} (${tag})`);
    const ctx = await b.newContext(Object.assign({ viewport: { width: W, height: Hh }, locale: 'de-DE' }, touch ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
    const pg = await ctx.newPage(); const e2 = []; pg.on('pageerror', e => e2.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) e2.push('console: ' + m.text()); });
    await pg.goto(BASE + 'index.html'); await pg.waitForTimeout(1300);
    const shot = async (name, fn, wait) => { if (fn) await pg.evaluate(fn); await pg.waitForTimeout(wait || 350); await pg.screenshot({ path: `${OUT}/${name}_${tag}.png` }); };
    const noOverflow = () => pg.evaluate(() => panel.scrollWidth <= panel.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1);
    const small = sel => pg.evaluate(s => [...panel.querySelectorAll(s)].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 || r.width < 44); }).map(e => e.textContent.trim().slice(0, 20)), sel);
    await pg.evaluate(([H_]) => {
      eval('(' + H_ + ')')(60); const M = SAVE.meta.pets; P.gold = 2e5; for (const k of MATORDER) P.mats[k] = 40;
      const a = petGive('drache', { lv: 112, nm: 'Funki' }); a.au = 'stern'; a.ti = 'stern'; a.tl = petTlFix('553103300000000' + '320000000000000', 112);
      petGive('wal', { lv: 150, nm: 'Moby' }).au = 'ewig'; petGive('einhorn', { lv: 126 }).au = 'himmel'; petGive('katze', { lv: 57 }); petGive('eule', { lv: 100 });
      M.list[1].ti = 'ewig'; M.list[2].ti = 'himmel'; M.act = a.id; petView = a.id; petSub = 'ov'; computeStats(); openChar('pet'); panel.scrollTop = 0;
    }, [H]);
    await shot('01_uebersicht');
    ok(await pg.evaluate(() => !!panel.querySelector('.petprev.asc .paura') && panel.textContent.includes('Aufgestiegen') && panel.textContent.includes('Sternenseele')), 'Übersicht: Aura in der Vorschau, Stufe „Aufgestiegen“, Titel');
    // unter den festen Kopf des Bildschirms scrollen
    const under = sel => pg.evaluate(s => { const el = panel.querySelector(s), hd = panel.querySelector('.head'); if (el) panel.scrollTop += el.getBoundingClientRect().top - (hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0) - 8; }, sel);
    await under('.prw'); await shot('02_belohnungen', () => { const b = panel.querySelector('.prw').closest('.box'), hd = panel.querySelector('.head'); panel.scrollTop += b.getBoundingClientRect().top - (hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0) - 8; });
    const tl = await pg.evaluate(() => { const c = [...panel.querySelectorAll('.prw > span')]; return { n: c.length, ok: c.filter(x => x.classList.contains('ok')).length, nx: c.findIndex(x => x.classList.contains('nx')), txt: (panel.querySelector('.prwd') || {}).textContent || '', ms: panel.querySelectorAll('.prwm span').length, vis: (r => r.top >= 0 && r.bottom <= innerHeight + 1)(panel.querySelector('.prw').getBoundingClientRect()) }; });
    ok(tl.n === 7 && tl.ok === 1 && tl.nx === 1 && tl.txt.includes('113') && tl.txt.includes('Gold') && tl.ms === 3 && tl.vis, `Zeitleiste: LV 112 erreicht, LV 113 als Nächstes (${tl.txt.slice(0, 60)}…), drei Meilensteine`);
    ok(await noOverflow(), 'Übersicht: kein seitliches Scrollen');
    // Aura wählen per Finger/Maus
    await under('.paur');
    const au = pg.locator('[data-act="petaura"][data-id=""]').first(); if (touch) await au.tap(); else await au.click(); await pg.waitForTimeout(250);
    ok(await pg.evaluate(() => !SAVE.meta.pets.list[0].au), 'Aura „Aufstieg“ gewählt');
    await under('.sws'); await shot('03_aura');
    if (touch) { const s = await small('.paur .opt'); ok(!s.length, 'Aura- und Titel-Knöpfe ≥ 44 px' + (s.length ? ': ' + s.join(', ') : '')); }
    // Füttern bis zum nächsten Level: Hinweis mit Belohnung
    await pg.evaluate(() => { const p = SAVE.meta.pets.list[0]; p.au = 'stern'; p.xp = petNeed(p.lv) - 10; P.mats.glut = 5; petAmt = 1; openChar('pet'); });
    const fd = pg.locator('[data-act="petfeed"][data-id="glut"]').first(); await fd.scrollIntoViewIfNeeded(); if (touch) await fd.tap(); else await fd.click(); await pg.waitForTimeout(300);
    const fed = await pg.evaluate(() => ({ lv: SAVE.meta.pets.list[0].lv, lr: SAVE.meta.pets.list[0].lr, t: $('toast').textContent }));
    ok(fed.lv === 113 && fed.lr === 113 && fed.t.includes('LV 113') && fed.t.includes('Gold'), `Füttern → LV 113, Hinweis mit Belohnung („${fed.t.slice(0, 70)}…“)`);
    await shot('04_gefuettert', () => { panel.scrollTop = 0; }, 150);
    // Talente
    await pg.evaluate(() => { ON.petsub('tal'); }); await under('.ptree');
    await shot('05_talente');
    ok(await noOverflow(), 'Talente: kein seitliches Scrollen');
    await under('.ptree .ptier'); await shot('06_talente_aufstieg');
    const t0 = await pg.evaluate(() => petTl(SAVE.meta.pets.list[0])[16]);
    const tn = pg.locator(`[data-act="pettal"][data-i="16"]`).first(); await tn.scrollIntoViewIfNeeded(); if (touch) await tn.tap(); else await tn.click(); await pg.waitForTimeout(250);
    ok(await pg.evaluate(v => petTl(SAVE.meta.pets.list[0])[16] === v + 1, t0), 'Aufstiegs-Talent „Sternenblick“ (ab LV 110) gelernt');
    if (touch) { const s = await small('.ptree .tal'); ok(!s.length, 'Talent-Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 3).join(', ') : '')); }
    // vollendeter Begleiter (LV 150, Ewiges Licht)
    await pg.evaluate(() => { petView = SAVE.meta.pets.list[1].id; petSub = 'ov'; openChar('pet'); panel.scrollTop = 0; });
    await shot('07_vollendet', null, 500);
    ok(await pg.evaluate(() => !!panel.querySelector('.petprev.rb') && panel.textContent.includes('vollendet') && panel.textContent.includes('Alle Belohnungen erhalten')), 'LV 150: Regenbogen-Aura, „vollendet“, alle Belohnungen erhalten');
    // im Kampf: Aura um den Begleiter
    if (tag !== 'quer') {
      const pi = tag === 'pc' ? 1 : 0;   // PC: der vollendete Begleiter mit Regenbogen-Aura
      await pg.evaluate(i => { hideOverlay(); const M = SAVE.meta.pets; M.act = M.list[i].id; P.lv = 60; computeStats(); P.hp = P.st.hp; P.map = genMap(P.act); P.map.pos = { r: 2, i: 0 }; startRoom('kampf', 2); P.inv = 999; }, pi);
      await pg.waitForTimeout(1600);
      // ruhiger Raum fürs Bild: keine Gegner, Begleiter neben dem Helden
      await pg.evaluate(() => { for (const e of enemies) e.dead = true; enemies = []; G.pending = []; G.waves = [G.waves[0]]; P.inv = 999; });
      await pg.waitForTimeout(900);
      await shot('08_kampf_aura', null, 100);
      ok(await pg.evaluate(i => PET_RT.id === SAVE.meta.pets.list[i].id && petAsc(petActive()) && state === 'play', pi), 'Kampf: aufgestiegener Begleiter mit Aura dabei');
    }
    ok(!e2.length, `keine Fehler (${tag})` + (e2.length ? ': ' + e2.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
