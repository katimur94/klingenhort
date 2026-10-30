// Aufträge & Ruf (6.3): Tages- und Wochenaufträge (fest je Tag/Woche, neu um Mitternacht und montags, nur Machbares), Fortschritt durch echte
// Handlungen (Kampf, Sammeln, Lande, Schmiede, Basar, Eier, Acker …), Abholen genau einmal, Neu würfeln, Fraktionen (Ruf, Rang, Vorteile, die
// wirklich wirken), Quartiermeister, alte Spielstände, Bestes anlegen, Beute-Filter (Kampagne und Lande), Bildschirmfotos (hoch, quer, PC).
// Aufruf: node auftraege.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/auftraege';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
// Uhr verstellen: window.__dt (ms); UHR(j, m, t, h, min) stellt die Ortszeit fest ein
const CLOCK = () => {
  const real = Date.now.bind(Date); window.__dt = 0; Date.now = () => real() + window.__dt;
  window.UHR = (y, m, d, h, mi) => { window.__dt = new Date(y, m - 1, d, h || 0, mi || 0).getTime() - real(); if (typeof AUF !== 'undefined') AUF.hid = null; };
};
const HERO = (lv, cls) => {
  localStorage.clear(); loadAll();
  const c = newChar(cls || 'knight', 'Botin', 'normal', false); c.lv = lv || 20; c.act = 3; c.maxAct = 3; c.story = { a1: 1, a2: 1, a3: 1 };
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; SAVE.meta.hide.tip62 = 1; for (const a of ACH) SAVE.meta.ach[a.id] = 1;
  if (SAVE.meta.lande) SAVE.meta.lande.tips = 0xffff; if (SAVE.meta.pets) SAVE.meta.pets.starter = true;
  P.gold = 50000; P.fate = 10; computeStats(); P.hp = P.st.hp; saveChar(); persist(); AUF.hid = null;
};
// bekannte Aufträge setzen: [[Art, Ziel, Rohstoff?]]
const SETQ = () => { window.SETQ = (d, w) => { const H = aufSet(), R = mulberry(7), mk = wk => ([k, n, x]) => { const q = aufMake(k, n, wk, R); if (x) q.x = x; return q; }; H.dq = d.map(mk(false)); H.wq = (w || []).map(mk(true)); H.lo = []; return H; }; };
const CALM = () => { LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; };

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
  await ctx.addInitScript(CLOCK);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const H = HERO.toString(), C_ = CALM.toString();
  await page.evaluate(`(${SETQ.toString()})()`);

  console.log('Aufträge auswürfeln: fest je Tag und Woche, neu um Mitternacht und montags');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(22); SAVE.meta.hide.b.garten = 2; SAVE.meta.hide.b.tempel = 1; const o = {};
      const sig = L => L.map(q => q.k + ':' + q.n + ':' + (q.x || '') + ':' + JSON.stringify(q.rw) + ':' + q.rep + ':' + q.tok).join('|');
      UHR(2026, 10, 28, 10);   // Mittwoch
      const H1 = aufSet(); o.n = H1.dq.length === 3 && H1.wq.length === 3; const d1 = sig(H1.dq), w1 = sig(H1.wq);
      o.fk = new Set(H1.dq.map(q => q.f)).size === 3 && new Set(H1.wq.map(q => q.f)).size === 3;
      o.valid = H1.dq.concat(H1.wq).every(q => AUFDEF[q.k] && q.n >= 1 && q.c === 0 && q.rw.length >= 2 && q.rep > 0 && q.tok > 0 && q.rw.every(e => rwName(e) && rwIcon(e)));
      SAVE.meta.auf.h = {}; AUF.hid = null; const H2 = aufSet(); o.same = sig(H2.dq) === d1 && sig(H2.wq) === w1;
      o.week5 = H2.wq.every(q => (q.rw.find(e => e.t === 'gold') || {}).n > (H2.dq[0].rw.find(e => e.t === 'gold') || {}).n);
      const q0 = H2.dq[0]; q0.c = q0.n; q0.ok = 1;   // erfüllt, aber nicht abgeholt
      UHR(2026, 10, 29, 0, 1); const H3 = aufSet(), w3 = H3.w;
      o.day = H3.d === 20261029 && sig(H3.dq) !== d1 && sig(H3.wq) === w1;
      o.lo = H3.lo.length === 1 && H3.lo[0].k === q0.k && aufReady() === 1;
      UHR(2026, 10, 28, 12); const H4 = aufSet(); o.back = H4.d === 20261029 && H4.dq === H3.dq;
      UHR(2026, 11, 1, 23, 59); o.sun = aufSet().w === w3 && sig(aufSet().wq) === w1;
      UHR(2026, 11, 2, 0, 1); const H5 = aufSet(); o.week = H5.w === weekNo(Date.now()) && H5.w === w3 + 1 && sig(H5.wq) !== w1;
      // ein zweiter Held hat eigene Aufträge
      const c = newChar('mage', 'Zweiter', 'normal', false); c.lv = 22; SAVE.chars.push(c); activateChar(1); AUF.hid = null; const H6 = aufSet(); o.own = !!SAVE.meta.auf.h[c.id] && sig(H6.dq) !== sig(H5.dq);
      activateChar(0); AUF.hid = null;
      return o;
    }, [H]);
    ok(r.n && r.valid, '3 Tages- und 3 Wochenaufträge mit Ziel, Belohnung, Ruf und Ruf-Marken');
    ok(r.fk, 'drei verschiedene Fraktionen je Tag und Woche');
    ok(r.same, 'gleicher Held, gleicher Tag: dieselben Aufträge (feste Saat)');
    ok(r.week5, 'Wochenaufträge geben mehr Gold');
    ok(r.day, 'nach Mitternacht neue Tagesaufträge, die Woche bleibt');
    ok(r.lo, 'erfüllt, aber nicht abgeholt: wartet unter „noch abzuholen“');
    ok(r.back, 'Uhr zurückgestellt: die Aufträge bleiben (kein Neuwürfeln)');
    ok(r.sun && r.week, 'Sonntag 23:59 noch dieselbe Woche, Montag neue Wochenaufträge');
    ok(r.own, 'jeder Held hat eigene Aufträge');
  }

  console.log('Nur Machbares, Ziele wachsen mit dem Level');
  {
    const r = await ev(([H_]) => {
      const HERO = eval('(' + H_ + ')'), o = {}; HERO(3); SAVE.meta.pets.eggs = [];
      const A = aufAvail(false), W = aufAvail(true), all = Object.keys(A).concat(Object.keys(W));
      o.noLand = !all.some(k => AUFDEF[k].f === 'kund') && !all.includes('bz'); o.noFarm = !all.includes('harvest') && !all.includes('sow'); o.noEgg = !all.includes('care') && !all.includes('hatch'); o.noSpin = !all.includes('spin');
      let kund = 0, n = 0; for (let s = 1; s < 80; s++) for (const q of aufGen(true, s).concat(aufGen(false, s))) { n++; if (q.f === 'kund' || q.k === 'harvest' || q.k === 'care' || q.k === 'bz') kund++; } o.gen = kund === 0 && n > 400;
      const k3 = A.kill;
      HERO(30); SAVE.meta.hide.b.garten = 2; SAVE.meta.hide.b.tempel = 1; eggGive('maus', true); SAVE.meta.pets.eggs[0].nest = 1;
      const B = aufAvail(false), BW = aufAvail(true); o.land = !!B.lkill && !!B.ext && !!B.extv && !!BW.bz; o.farm = !!B.harvest && !!B.sow; o.egg = !!B.care; o.spin = !!BW.spin;
      o.scale = B.kill > k3 && BW.kill > B.kill * 3;
      let fs = {}; for (let s = 1; s < 60; s++) for (const q of aufGen(false, s)) fs[q.f] = 1; o.all4 = Object.keys(fs).length === 4;
      return o;
    }, [H]);
    ok(r.noLand && r.gen, 'LV 3: keine Aufträge für die Endlosen Lande (erst ab LV 5) – auch nicht in 80 Würfen');
    ok(r.noFarm && r.noEgg && r.noSpin, 'ohne Kräutergarten, Ei im Nest oder Glückstempel: keine Aufträge dafür');
    ok(r.land && r.farm && r.egg && r.spin, 'LV 30 mit Garten, Ei und Tempel: Lande-, Acker-, Ei- und Glücksrad-Aufträge möglich');
    ok(r.scale, 'Ziele wachsen mit dem Level, Wochenziele sind viel größer');
    ok(r.all4, 'Aufträge kommen aus allen vier Fraktionen');
  }

  console.log('Fortschritt durch echte Handlungen');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(22); UHR(2026, 10, 28, 10); const o = {};
      for (const k of MATORDER) P.mats[k] = 999; SAVE.meta.hide.b.garten = 2; SAVE.meta.hide.b.tempel = 1;
      const H = SETQ([['kill', 5], ['elite', 1], ['arten', 2]], [['node', 2], ['gold', 300], ['champ', 1]]), D = H.dq, W = H.wq;
      // Kampagne: Gegner, Elite, zwei Arten, Champion, Gold
      P.map = genMap(3); P.map.pos = { r: 0, i: 0 }; startRoom('kampf', 1); P.inv = 1e9;
      const kill = (t, o_) => { const e = spawnEnemy(t, Object.assign({ x: P.x + 30, y: P.y, instant: true }, o_ || {})); hurtEnemy(e, 1e9, 0, 0, 0); return e; };
      kill('goblin'); kill('goblin'); kill('skeleton'); kill('orc', { elite: true }); kill('orc', { champ: true, elite: true });
      o.kill = D[0].c === 5 && D[0].ok === 1; o.elite = D[1].ok === 1; o.arten = D[2].ok === 1 && D[2].s.length >= 2; o.champ = W[2].ok === 1;
      pickups.push({ k: 'coin', x: P.x, y: P.y, z: 0, vz: 0, vx: 0, vy: 0, v: 400, t: 1 }); updPickups(.016); o.gold = W[1].c >= 300 && W[1].ok === 1;
      markNodeDone(); P.map.pos = { r: 1, i: 0 }; markNodeDone(); markNodeDone(); o.node = W[0].c === 2;   // derselbe Ort zählt nur einmal
      // Versteck: Holzplatz, Acker; Schmiede, Werkbank, Glücksrad
      SETQ([['gat', 3, 'holz'], ['sow', 1], ['harvest', 1]], [['forge', 1], ['up', 2], ['salv', 1]]);
      const H2 = aufSet(); enterHideout(); const tree = obs.find(x => x.k === 'gat' && x.t === 'baum'); for (let i = 0; i < 6 && !tree.gone; i++) gatherHit(tree, 1, 0);
      o.gat = H2.dq[0].c >= 3;
      farmPlant('flachs'); o.sow = H2.dq[1].ok === 1; window.__dt += 700000; farmHarvest(0); o.harvest = H2.dq[2].ok === 1;
      forgeItem(0, 'weapon'); o.forge = H2.wq[0].ok === 1;
      P.gear.weapon.up = 0; upgradeItem(P.gear.weapon); upgradeItem(P.gear.weapon); o.up = H2.wq[1].c === 2;
      const it = makeItem({ slot: 'helm', base: 'helm', tier: 1, rar: 0 }); P.bag.push(it); salvage(it); o.salv = H2.wq[2].ok === 1;
      // Mods, Basar, Eier, Glücksrad, Tages-Challenge
      SETQ([['mod', 1], ['mkbuy', 1], ['mksell', 2]], [['care', 2], ['hatch', 1], ['spin', 1]]);
      const H3 = aufSet(), w = makeItem({ slot: 'weapon', base: 'sword', tier: 2, rar: 3 }); P.bag.push(w); modGive('rune_kraft:2', 1); modInsert(w, 'rune_kraft:2'); o.mod = H3.dq[0].ok === 1;
      mkEnsure(); const L = MARKET.listings('shop').filter(x => x.n > 0).sort((a, b) => MARKET.price(a) - MARKET.price(b)); P.gold = 1e7; const rb = MARKET.buy(L[0].id); o.mkbuy = rb.ok && H3.dq[1].ok === 1;
      for (let i = 0; i < 2; i++) { const e = MK_HERO.take({ t: 'mat', k: 'holz', n: 1 }); MARKET.sell(e); } o.mksell = H3.dq[2].ok === 1;
      SAVE.meta.pets.eggs = []; eggGive('maus', true); const g = SAVE.meta.pets.eggs[0]; g.nest = 1; ON.nestwarm(g.id); ON.nestpet(g.id); o.care = H3.wq[0].ok === 1;
      g.got = g.need; eggHatch(0); o.hatch = H3.wq[1].ok === 1;
      hideOverlay(); enterHideout(); openStation('tempel'); P.fate = 5; doSpin(); ON.rollskip(); o.spin = H3.wq[2].ok === 1;
      SETQ([['daily', 1]]); const H4 = aufSet(); hideOverlay(); startDaily(); G.daily.i = G.daily.rooms.length - 1; dailyNext(); o.daily = H4.dq[0].ok === 1;
      return o;
    }, [H]);
    ok(r.kill && r.elite && r.arten, 'Kampagne: Gegner, Elite-Gegner und verschiedene Arten zählen');
    ok(r.champ, 'Champion zählt');
    ok(r.gold, 'Gold aufheben zählt für „Verdiene Gold“');
    ok(r.node, 'geschaffte Orte auf der Karte zählen (jeder nur einmal)');
    ok(r.gat, 'Holzplatz: gefälltes Holz zählt für „Sammle Holz“');
    ok(r.sow && r.harvest, 'Acker: Säen und Ernten zählen');
    ok(r.forge && r.up && r.salv, 'Schmieden, Aufwerten (auch Versuche) und Zerlegen zählen');
    ok(r.mod, 'Mod einsetzen zählt');
    ok(r.mkbuy && r.mksell, 'Basar: Kaufen und Verkaufen zählen');
    ok(r.care && r.hatch, 'Brutnest: Pflegen und Schlüpfen zählen');
    ok(r.spin, 'Glücksrad: Drehen zählt');
    ok(r.daily, 'Tages-Challenge geschafft zählt');
  }

  console.log('Endlose Lande und Tausend Bosse');
  {
    const r = await ev(([H_, C__]) => {
      eval('(' + H_ + ')')(22); const CALM = eval('(' + C__ + ')'), o = {}; UHR(2026, 10, 28, 10);
      P.gear.weapon = makeItem({ slot: 'weapon', base: 'sword', tier: 3, rar: 3 }); computeStats();
      SETQ([['lkill', 2], ['lelite', 1], ['extv', 300]], [['ext', 1], ['beacon', 1], ['bz', 1]]); const H = aufSet();
      lBegin(); lTeleport(LOFF + 384, LOFF + 372); CALM(); P.inv = 1e9;
      for (const el of [false, true]) { const e = lSpawn('goblin', P.x + 40, P.y, { elite: el }); hurtEnemy(e, 1e9, 0, 0, 0); }
      o.lkill = H.dq[0].ok === 1 && H.dq[1].ok === 1;
      // Leuchtfeuer setzen
      const M = SAVE.meta.lande, [x, y] = lRoadPt(2, 9); lTeleport(x * LCK + LOFF, y * LCK + LOFF); CALM(); lTick(.3); lTick(.3); M.stones = 1; LW.hurtT = -99; ON.l_cpok(); o.beacon = H.wq[1].ok === 1;
      // entkommen mit Beute im Wert von 500
      lTeleport(LOFF + 384, LOFF + 372); CALM(); LW.pack.push({ t: 'gold', n: 500 }); lExtract(lNear(P.x, P.y, 200).find(x => x.k === 'exit'));
      o.ext = H.wq[0].ok === 1 && H.dq[2].ok === 1 && H.dq[2].c >= 300 && !landeActive();
      // einer der Tausend Bosse (Kampf ohne Übung)
      hideOverlay(); BA = null; bossArena(0, { practice: false }); for (let i = 0; i < 160; i++) { T += 1 / 60; update(1 / 60); }
      const bz = enemies.find(e => e.bz && !e.dead); if (bz) { P.inv = 1e9; hurtEnemy(bz, 1e9, 0, 0, 0); }
      o.bz = !!bz && H.wq[2].ok === 1;
      // Übungskampf aus dem Kodex zählt nicht
      SETQ([['boss', 1]]); const H2 = aufSet(); BA = null; bossArena(0, {}); for (let i = 0; i < 160; i++) { T += 1 / 60; update(1 / 60); }
      const pr = enemies.find(e => e.bz && !e.dead); if (pr) hurtEnemy(pr, 1e9, 0, 0, 0); o.prac = !!pr && H2.dq[0].c === 0;
      BA = null; G = null; hideOverlay(); setState('menu');
      return o;
    }, [H, C_]);
    ok(r.lkill, 'Lande: Gegner und Elite-Gegner zählen');
    ok(r.beacon, 'Leuchtfeuer setzen zählt');
    ok(r.ext, 'lebend entkommen und Beutewert des Ausflugs zählen');
    ok(r.bz, 'Sieg über einen der Tausend Bosse zählt');
    ok(r.prac, 'Übungskampf im Boss-Kodex zählt nicht');
  }

  console.log('Abholen genau einmal, Neu würfeln einmal am Tag');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(22); UHR(2026, 10, 28, 10); const o = {};
      const H = SETQ([['kill', 1], ['node', 3]]), q = H.dq[0], gold = q.rw.find(e => e.t === 'gold').n, mat = q.rw.find(e => e.t === 'mat');
      o.notYet = aufClaim('d', 1).err === 'none';
      aufEv('kill', 1); o.msg = q.ok === 1 && aufReady() === 1;
      const g0 = P.gold, m0 = P.mats[mat.k] || 0, rep0 = fkRep('orden'), tok0 = fkTok('orden');
      const c = aufClaim('d', 0);
      o.claim = c.ok && P.gold >= g0 + gold && (P.mats[mat.k] || 0) === m0 + mat.n && fkRep('orden') === rep0 + q.rep && fkTok('orden') === tok0 + q.tok && q.pd === 1;
      o.once = aufClaim('d', 0).err === 'none' && P.gold >= g0 + gold && fkTok('orden') === tok0 + q.tok;
      // Alles abholen + Anzeige der Belohnung
      const H2 = SETQ([['kill', 1], ['elite', 1]], [['kill', 2]]); aufEv('kill', 2); aufEv('elite', 1); o.ready3 = aufReady() === 3;
      aufOpen('map'); ON.auf_claim('all', null, 0); o.reveal = /3 AUFTRÄGE ERFÜLLT/.test(panel.textContent) && !!panel.querySelector('.aqrp') && aufReady() === 0;
      ON.auf_ok(); o.back = !!panel.querySelector('[data-act="auf_tab"]');
      // Neu würfeln
      UHR(2026, 10, 29, 9); const H3 = aufSet(), ks = H3.dq.map(x => x.k);
      o.rr = aufReroll(1) && H3.dq[1].k !== ks[1] && !ks.includes(H3.dq[1].k) && H3.dq[0].k === ks[0];
      o.rr2 = !aufReroll(2);
      UHR(2026, 10, 30, 9); o.rr3 = aufReroll(0);
      return o;
    }, [H]);
    ok(r.notYet, 'unerfüllter Auftrag lässt sich nicht abholen');
    ok(r.msg, 'erfüllt: abholbereit');
    ok(r.claim, 'Abholen: Gold, Material, Ruf und Ruf-Marken der Fraktion');
    ok(r.once, 'zweites Abholen bringt nichts');
    ok(r.ready3 && r.reveal && r.back, '„Alles abholen“: drei Belohnungen auf einen Blick, Ruf-Balken, dann zurück zur Tafel');
    ok(r.rr && r.rr2, 'Neu würfeln: ein Tagesauftrag am Tag, kommt als neue Art');
    ok(r.rr3, 'am nächsten Tag darf wieder gewürfelt werden');
  }

  console.log('Fraktionen: Ruf, Rang, Vorteile wirken');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(20); UHR(2026, 10, 28, 10); const o = {};
      o.ranks = FKORDER.every(f => fkRanks(f).length >= 6 && fkRanks(f).length <= 8 && fkRanks(f).every((x, i, a) => !i || x.at > a[i - 1].at));
      o.kundIsLande = fkRanks('kund').length === LREP.length && fkRanks('kund')[3].n === LREP[3].n;
      // Handelsgilde: Händler, Basar, Bodo, Gebühr, Angebote
      P.map = genMap(3); P.map.pos = { r: 0, i: 0 }; P.map.shop = genShop(); P.map.shopAt = '0:0';
      const it = makeItem({ slot: 'weapon', base: 'sword', tier: 4, rar: 2 }), sell0 = itemPrice(it), fee0 = mkFee(), bodo0 = lPerk('rabatt'), off0 = mkOfferPrice({ e: { t: 'mat', k: 'erz', n: 20 }, f: 1 }), q0 = mkQuote({ t: 'mat', k: 'kristall', n: 10 });
      mkEnsure(); const R0 = mkRng({ rs: 5 }); const nItems = () => { const M = mkM(), rs = M.rs; const L = mkShopGen().filter(e => e.e.t === 'item').length; M.rs = rs; return L; }; const ni0 = nItems();
      const up = fkGain('gilde', 5000, 0, true); o.gilde = fkRank('gilde') === 6 && up.length === 6;
      o.buy = mBuy(1000) === 900; o.sell = itemPrice(it) === Math.max(8, Math.round(itemPrice0(it) * 1.1)) && itemPrice(it) > sell0;
      o.fee = Math.abs(mkFee() - (fee0 - .02)) < 1e-9; o.bodo = Math.abs(lPerk('rabatt') - bodo0 * .9) < 1e-9; o.offer = mkOfferPrice({ e: { t: 'mat', k: 'erz', n: 20 }, f: 1 }) < off0; o.quote = mkQuote({ t: 'mat', k: 'kristall', n: 10 }) > q0;
      o.stock = nItems() === ni0 + 2;
      // wirklich bezahlen: Händler auf der Karte
      openMerchant(); const s = P.map.shop.stock[0], btn = panel.querySelector('[data-act="buy"][data-i="0"]'), g0 = P.gold; btn.click();
      o.merchant = btn.textContent.includes(String(mBuy(s.price))) && mBuy(s.price) < s.price && P.gold === g0 - mBuy(s.price);
      // Orden: Erfahrung, Boss-Beute
      const xp0 = mod('xp'); fkGain('orden', 7500, 0, true); computeStats(); o.xp = Math.abs(mod('xp') - xp0 - .08) < 1e-9 && fkRank('orden') === 7;
      startRoom('kampf', 1); pickups.length = 0; const f0 = P.fate, fh = HOOK.loot.find(f => String(f).includes('FK_ORDEN')); fh({ boss: true, x: P.x, y: P.y }, 1);
      o.boss = pickups.some(c => c.k === 'gem') && pickups.some(c => c.k === 'loot') && P.fate === f0 + 1;
      pickups.length = 0; fh({ boss: true, bPractice: true, x: P.x, y: P.y }, 1); fh({ x: P.x, y: P.y }, 1); o.noPrac = !pickups.length;
      // Hüter der Wildnis: Acker, Eier, Sammeln
      SAVE.meta.hide.b.garten = 2; const fs0 = farmSpeed(), g = { tier: 3 }, er0 = eggRates(g)[0];
      fkGain('wild', 4500, 0, true); o.farm = Math.abs(farmSpeed() - fs0 * 1.35) < 1e-9; o.egg = Math.abs(eggRates(g)[0] - er0 / 1.4) < 1e-12; o.gat = perk('gather', 0) === .3;
      let base = 0, more = 0; for (let i = 0; i < 400; i++) { const x = { holz: 4 }; base += 4; gatherGiveAll({ x: P.x, y: P.y }, x); more += x.holz; } o.gatSum = more > base * 1.2 && more < base * 1.4;
      // Kundschafter: Ruf aus den Landen, Rang gemeldet
      SAVE.meta.lande.rep = 400; const kup = fkCheck(true); o.kund = fkRank('kund') === lRank(400) && kup.some(u => u.f === 'kund' && u.r === 2);
      o.again = fkCheck(true).length === 0;
      setState('menu'); G = null; hideOverlay();
      return o;
    }, [H]);
    ok(r.ranks && r.kundIsLande, '4 Fraktionen mit 6–8 Rängen; die Kundschafter nutzen den Ruf der Lande (LREP)');
    ok(r.gilde, 'Handelsgilde: Ruf → Rang 7 von 7, sechs Aufstiege gemeldet');
    ok(r.buy && r.sell && r.quote, 'Handelsgilde: 10 % günstiger einkaufen, 10 % mehr beim Verkauf (Händler und Hedda)');
    ok(r.fee && r.offer && r.stock, 'Handelsgilde: Auktionsgebühr −2 Punkte, Basar-Angebote günstiger, zwei Angebote mehr');
    ok(r.bodo, 'Handelsgilde: Händler Bodo in den Landen günstiger');
    ok(r.merchant, 'Händler auf der Karte zeigt und verlangt den Gilden-Preis');
    ok(r.xp, 'Orden: +8 % Erfahrung auf dem höchsten Rang');
    ok(r.boss && r.noPrac, 'Orden: Bosse lassen Edelstein, Gegenstand und eine Glücksmünze fallen – nicht im Übungskampf');
    ok(r.farm && r.egg && r.gat && r.gatSum, 'Hüter der Wildnis: Acker schneller, Ei-Pflege hält länger, +30 % Sammelertrag');
    ok(r.kund && r.again, 'Kundschafter: Ruf aus den Landen bringt Ränge, jeder Rang wird einmal gemeldet');
  }

  console.log('Quartiermeister: Tauschangebote nach Rang, je Woche neu');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(20); UHR(2026, 10, 28, 10); const o = {}, M = SAVE.meta.ruf;
      const O = fkOffers('wild'); o.n = O.length >= 5 && O.length <= 6; o.same = JSON.stringify(fkOffers('wild')) === JSON.stringify(O);
      o.low = O.filter(x => x.r <= 1).length >= 2;
      const lo = O.find(x => x.r === 0 && x.e.t !== 'egg') || O.find(x => x.r === 0), hi = O.find(x => x.r >= 2);
      o.tok = fkBuy('wild', lo.id).err === 'tok';
      M.f.wild.tok = 500; o.rank = fkBuy('wild', hi.id).err === 'rank';
      SAVE.meta.pets.eggs = []; const t0 = fkTok('wild'), g0 = P.gold; const b1 = fkBuy('wild', lo.id);
      o.buy = b1.ok && fkTok('wild') === t0 - lo.tok && P.gold === g0 - lo.gold && fkOffers('wild').find(x => x.id === lo.id).left === lo.n - 1;
      for (let i = 1; i < lo.n; i++) fkBuy('wild', lo.id); o.sold = fkBuy('wild', lo.id).err === 'sold';
      fkGain('wild', 4500, 0, true); const egg = fkOffers('wild').find(x => x.e.t === 'egg' && x.r >= 2), e0 = SAVE.meta.pets.eggs.length;
      o.hiBuy = !egg || (fkBuy('wild', egg.id).ok && SAVE.meta.pets.eggs.length === e0 + 1 && SAVE.meta.pets.eggs[e0].tier === egg.e.tier);
      const ttl = fkOffers('wild').find(x => x.id === 'title'); o.title = !!ttl && fkBuy('wild', 'title').ok && fkTitle() === FK_TITLES.wild && !fkOffers('wild').some(x => x.id === 'title');
      openChar('gear', 'map'); o.titleShown = panel.textContent.includes(FK_TITLES.wild);
      UHR(2026, 11, 2, 10); const O2 = fkOffers('wild'); o.week = O2.every(x => x.left === x.n) && JSON.stringify(O2.map(x => x.id + JSON.stringify(x.e))) !== JSON.stringify(O.map(x => x.id + JSON.stringify(x.e)));
      // Kundschafter: Leuchtfeuerstein und Vogel kommen an
      M.f.kund.tok = 99; SAVE.meta.lande.rep = 4000; let st = 0, bd = 0; for (let w = 0; w < 6 && !(st && bd); w++) { UHR(2026, 11, 9 + w * 7, 10); for (const x of fkOffers('kund')) { if (x.e.t === 'stone' && !st) { const s0 = SAVE.meta.lande.stones; st = fkBuy('kund', x.id).ok && SAVE.meta.lande.stones === s0 + 1 ? 1 : -1; } if (x.e.t === 'bird' && !bd) { const n0 = birdCount(x.e.k); bd = fkBuy('kund', x.id).ok && birdCount(x.e.k) === n0 + 1 ? 1 : -1; } } }
      o.kund = st === 1 && bd === 1;
      hideOverlay(); return o;
    }, [H]);
    ok(r.n && r.same && r.low, 'je Fraktion 5 Angebote der Woche (+ Titel), fest für die Woche, zwei schon ab Rang 1');
    ok(r.tok && r.rank, 'ohne Ruf-Marken oder mit zu niedrigem Rang: kein Tausch');
    ok(r.buy && r.sold, 'Tausch kostet Marken und Gold, Vorrat je Woche begrenzt');
    ok(r.hiBuy, 'höherer Rang: seltenes Ei kommt ins Brutnest');
    ok(r.title && r.titleShown, 'Titel vom Quartiermeister erscheint beim Helden');
    ok(r.week, 'neue Woche: andere Angebote, Vorrat wieder voll');
    ok(r.kund, 'Kundschafter: Leuchtfeuerstein und magischer Vogel kommen an');
  }

  console.log('Alte und kaputte Spielstände');
  {
    const r = await ev(() => {
      const o = {}, m = fixMeta({ stats: {}, settings: { music: true }, lande: { rep: 1000, runs: 3, v: 2 } });
      o.def = m.ruf && m.ruf.f.orden.rep === 0 && m.ruf.f.kund.rk === lRank(1000) && m.auf && typeof m.auf.h === 'object' && m.settings.loot.c === 'take' && m.settings.loot.m === 'take';
      const bad = fixMeta({ ruf: { f: { orden: { rep: 'x', tok: -5, rk: 99 }, gilde: null }, qm: { w: 'a', b: { '<x>': 3, 'wild:egg1': 2 } }, tt: ['orden', 'zz'], t: 'zz' },
        auf: { h: { abc123: { d: 'x', dq: [{ k: 'kill', n: 10, c: 50, rw: [{ t: 'gold', n: 100 }, { t: 'mat', k: 'nix', n: 1 }, { t: 'egg', tier: 99 }] }, { k: 'unbekannt' }, { k: 'gat', n: 5, x: 'zzz' }] }, '<bad>': {} } }, settings: { loot: { c: 'sell', m: 'boom' } } });
      const q = bad.auf.h.abc123 && bad.auf.h.abc123.dq[0];
      o.fix = bad.ruf.f.orden.rep === 0 && bad.ruf.f.orden.tok === 0 && bad.ruf.f.orden.rk === 9 && bad.ruf.qm.b['wild:egg1'] === 2 && !bad.ruf.qm.b['<x>'] && bad.ruf.tt.length === 1 && bad.ruf.t === ''
        && bad.auf.h.abc123.dq.length === 1 && q.c === 10 && q.ok === 1 && q.rw.length === 1 && !bad.auf.h['<bad>'] && bad.settings.loot.c === 'sell' && bad.settings.loot.m === 'take';
      // Spielstand ohne die neuen Felder: Held laden, Tafel öffnen
      localStorage.clear(); loadAll(); const c = newChar('ranger', 'Alt', 'normal', false); c.lv = 12; SAVE.chars.push(c); delete SAVE.meta.ruf; delete SAVE.meta.auf; delete SAVE.meta.settings.loot; persist();
      loadAll(); activateChar(0); AUF.hid = null; aufOpen('map'); o.open = /AUFTRAGSTAFEL/.test(panel.textContent) && aufSet().dq.length === 3 && SAVE.meta.settings.loot.c === 'take';
      hideOverlay(); return o;
    });
    ok(r.def, 'Spielstand ohne Ruf, Aufträge, Beute-Filter: Standardwerte (Kundschafter-Rang gilt als gemeldet)');
    ok(r.fix, 'kaputte Werte werden repariert, unbekannte Aufträge und Belohnungen verworfen');
    ok(r.open, 'alter Spielstand: Held lädt, Auftragstafel öffnet sich');
  }

  console.log('Bestes anlegen');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(20); const o = {}; P.bag = [];
      const w0 = P.gear.weapon, better = makeItem({ slot: 'weapon', base: 'sword', tier: 3, rar: 3 }), bow = makeItem({ slot: 'weapon', base: 'bow', tier: 6, rar: 4 });
      P.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: 3, rar: 2 }); const a0 = P.gear.armor, worse = makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 0 });
      P.bag.push(better, worse, bow); computeStats();
      const ch = equipBest(); o.best = ch.length === 1 && P.gear.weapon === better && P.bag.includes(w0) && P.bag.includes(bow) && P.gear.armor === a0 && ch[0].d > 0;
      o.none = equipBest().length === 0;
      // Mods zählen mit: gleicher Helm, einer mit Mods
      const h1 = makeItem({ slot: 'helm', base: 'helm', tier: 4, rar: 3 }), h2 = JSON.parse(JSON.stringify(h1)); h2.uid = uid(); h2.mods = ['rune_kraft:6', 'rune_leben:6'];
      P.gear.helm = makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }); P.bag.push(h1, h2); equipBest(); o.mods = P.gear.helm === h2;
      // Set mit aktivem Bonus bleibt
      const S = Object.keys(SETS).find(k => SETS[k].cls === 'knight') || 'drache';
      P.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: 1, rar: 5, set: S }); P.gear.helm = makeItem({ slot: 'helm', base: 'helm', tier: 1, rar: 5, set: S }); const sa = P.gear.armor;
      P.bag = [makeItem({ slot: 'armor', base: 'armor', tier: 6, rar: 4 })]; equipBest(); o.set = P.gear.armor === sa;
      // Knopf im Charakter
      P.bag.push(makeItem({ slot: 'weapon', base: 'axe', tier: 7, rar: 4 })); openChar('gear', 'map'); panel.querySelector('[data-act="bestgear"]').click();
      o.btn = P.gear.weapon.base === 'axe' && /Angelegt/.test($('toast').textContent);
      hideOverlay(); return o;
    }, [H]);
    ok(r.best, 'Bestes anlegen: bessere Waffe angelegt, schlechtere Rüstung nicht, Bogen (andere Klasse) nicht');
    ok(r.none, 'nichts Besseres im Beutel: nichts ändert sich');
    ok(r.mods, 'Mods zählen beim Vergleich mit (itemScore)');
    ok(r.set, 'ein Set mit aktivem Bonus wird nicht auseinandergerissen');
    ok(r.btn, 'Knopf „Bestes anlegen“ im Charakter zeigt, was sich geändert hat');
  }

  console.log('Beute-Filter: Kampagne und Endlose Lande');
  {
    const r = await ev(([H_, C__]) => {
      eval('(' + H_ + ')')(20); const CALM = eval('(' + C__ + ')'), o = {};
      P.gear.helm = makeItem({ slot: 'helm', base: 'helm', tier: 4, rar: 3 }); P.gear.weapon = makeItem({ slot: 'weapon', base: 'sword', tier: 3, rar: 3 }); computeStats(); P.bag = [];
      P.map = genMap(3); P.map.pos = { r: 0, i: 0 }; startRoom('kampf', 1); P.inv = 1e9; for (const e of enemies) e.dead = true;
      const put = it => { pickups.push({ k: 'loot', it, x: P.x, y: P.y, z: 0, vz: 0, vx: 0, vy: 0, t: 1 }); return it; }, step = () => { updPickups(.016); updPickups(.016); };
      SAVE.meta.settings.loot = { c: 'take', m: 'take' }; const a = put(makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 })); step(); o.take = P.bag.includes(a);
      SAVE.meta.settings.loot = { c: 'sell', m: 'leave' };
      const g0 = P.gold, c1 = put(makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 })); step(); o.sell = P.gold === g0 + itemPrice(c1) && !P.bag.includes(c1) && !pickups.some(c => c.it === c1) && texts.some(t => /\+\d+ G/.test(t.s));
      const m1 = put(makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 1 })); step(); o.leave = pickups.some(c => c.it === m1) && !P.bag.includes(m1);
      const up = put(makeItem({ slot: 'weapon', base: 'sword', tier: 7, rar: 0 })); step(); o.better = P.gear.weapon === up || P.bag.includes(up);
      const sp = makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }); sp.up = 2; put(sp); step(); o.special = P.bag.includes(sp);
      SAVE.meta.settings.loot = { c: 'sell', m: 'take' }; step(); o.change = P.bag.includes(m1);
      // Raum geschafft: liegen Gelassenes wird nicht zum Helden gezogen
      SAVE.meta.settings.loot = { c: 'leave', m: 'leave' }; const far = makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }); pickups.push({ k: 'loot', it: far, x: P.x + 80, y: P.y, z: 0, vz: 0, vx: 0, vy: 0, t: 1, mag: 1 }); for (let i = 0; i < 30; i++) updPickups(.03);
      const fc = pickups.find(c => c.it === far); o.noMag = !!fc && Math.abs(fc.x - (P.x + 80)) < 2;
      // Endlose Lande: liegen lassen gilt, Verkaufen nicht (Rucksack)
      G = null; lBegin(); lTeleport(LOFF + 384, LOFF + 420); CALM(); P.inv = 1e9; LW.pack = []; pickups.length = 0;
      SAVE.meta.settings.loot = { c: 'sell', m: 'leave' }; const g1 = P.gold;
      const l1 = put(makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 })); updPickups(.016); o.lSell = LW.pack.some(e => e.t === 'item' && e.it === l1) && P.gold === g1;
      const l2 = put(makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 1 })); updPickups(.016); updPickups(.016); o.lLeave = pickups.some(c => c.it === l2) && !LW.pack.some(e => e.it === l2);
      lAbandon('test'); SAVE.meta.settings.loot = { c: 'take', m: 'take' };
      // Einstellungen: Knopf und eigener Bildschirm
      setState('menu'); G = null; showSettings('title'); const b = panel.querySelector('[data-act="lootset"]'); b.click(); panel.querySelector('[data-act="lootopt"][data-id="c:sell"]').click();
      o.ui = SAVE.meta.settings.loot.c === 'sell' && /BEUTE-FILTER/.test(panel.textContent) && /Endlosen Landen/.test(panel.textContent);
      panel.querySelector('[data-act="lootback"]').click(); o.uiBack = /Beute-Filter:/.test(panel.textContent) && /VERKAUFEN/.test(panel.querySelector('[data-act="lootset"]').textContent);
      SAVE.meta.settings.loot = { c: 'take', m: 'take' }; hideOverlay(); return o;
    }, [H, C_]);
    ok(r.take, 'Standard: alles aufheben');
    ok(r.sell, 'Gewöhnliches verkaufen: Gold sofort, kleine goldene Zahl, nichts im Beutel');
    ok(r.leave, 'Magisches liegen lassen: bleibt am Boden');
    ok(r.better && r.special, 'Besseres als die Ausrüstung und Aufgewertetes wird immer aufgehoben');
    ok(r.change, 'Filter umgestellt: liegen Gelassenes lässt sich wieder aufheben');
    ok(r.noMag, 'liegen Gelassenes fliegt nach dem Raum nicht zum Helden');
    ok(r.lSell, 'Endlose Lande: „Verkaufen“ gilt nicht – in den Rucksack');
    ok(r.lLeave, 'Endlose Lande: „Liegen lassen“ gilt');
    ok(r.ui && r.uiBack, 'Einstellungen → Beute-Filter: umstellen, erklärt die Lande, Zurück zeigt die Wahl');
  }

  console.log('Bildschirmfotos (hoch, quer, PC), Touch-Knöpfe, Bedienung');
  for (const [W, Hh, tag, pc] of [[390, 844, 'hoch', false], [844, 390, 'quer', false], [1280, 720, 'pc', true]]) {
    const c2 = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: pc ? 1 : 2, isMobile: !pc, hasTouch: !pc, locale: 'de-DE' });
    await c2.addInitScript(CLOCK);
    const p = await c2.newPage(); p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.goto(BASE + 'index.html'); await p.waitForTimeout(1300);
    await p.evaluate(`(${SETQ.toString()})()`);
    const shot = async (name, fn, wait) => { if (fn) await p.evaluate(fn); await p.waitForTimeout(wait || 450); await p.screenshot({ path: `${OUT}/${tag}-${name}.png` }); };
    // kein seitliches Scrollen, Knöpfe der Tafel ≥ 44 px (Touch)
    const check = async name => { const m = await p.evaluate(() => { const pn = panel, small = [...pn.querySelectorAll('[data-act^="auf_"]')].filter(x => x.offsetParent && x.getBoundingClientRect().height < 43.5).map(x => x.dataset.act); return { hs: pn.scrollWidth > pn.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1, small }; }); ok(!m.hs && (pc || !m.small.length), `${tag} ${name}: kein seitliches Scrollen${pc ? '' : ', Knöpfe ≥ 44 px'}` + (m.small.length && !pc ? ' – zu klein: ' + m.small.join(', ') : '')); };
    await p.evaluate(([H_]) => {
      eval('(' + H_ + ')')(24); UHR(2026, 10, 28, 10); SAVE.meta.hide.b = { schmiede: 3, alchemie: 2, garten: 3, tempel: 1, bibliothek: 2, sattler: 2, voliere: 2 }; P.fate = 4;
      for (const k of MATORDER) P.mats[k] = 20; SAVE.meta.pets.eggs = []; eggGive('maus', true); SAVE.meta.pets.eggs[0].nest = 1; SAVE.meta.pets.intro = true;
      fkGain('orden', 820, 14, true); fkGain('gilde', 160, 9, true); fkGain('wild', 40, 3, true); SAVE.meta.lande.rep = 260; fkM().f.kund.tok = 6; fkCheck(true);
      SETQ([['kill', 60], ['gat', 25, 'holz'], ['mkbuy', 1]], [['bz', 1], ['harvest', 8], ['care', 20]]); const H = aufSet(); H.dq[0].c = 60; H.dq[0].ok = 1; H.dq[1].c = 14; H.wq[1].c = 3; H.wq[2].c = 12;
      saveChar(); persist();
    }, [H]);
    // Versteck: Tafel nicht unter den Touch-Knöpfen, „!“ über der Tafel
    const vis = await p.evaluate(() => {
      enterHideout(); if (!isTouch) return true;
      const o = obs.find(x => x.k === 'station' && x.id === 'auftrag'); P.x = o.x; P.y = o.y + 18; for (let i = 0; i < 4; i++) camera(5);
      return [[0, -4], [-8, -16], [8, -16], [0, -26], [0, -36]].every(([dx, dy]) => { const el = document.elementFromPoint(VIEW.ox + (o.x + dx - cam.x) * SCALE, (o.y + dy - cam.y) * SCALE); return !el || !el.closest('#btns, #bAct, #bPot'); });
    });
    if (!pc) ok(vis === true, `${tag}: Auftragstafel nicht unter den Touch-Knöpfen`);
    await shot('versteck-tafel', () => { const o = obs.find(x => x.k === 'station' && x.id === 'auftrag'); P.x = o.x + 34; P.y = o.y + 34; }, 1400);
    await shot('tafel', () => { openStation('auftrag'); }, 700); await check('Tafel');
    await shot('tafel-unten', () => { panel.scrollTop = 9999; });
    await shot('belohnung', () => { panel.scrollTop = 0; ON.auf_claim('d', null, 0); }, 2600);
    await shot('fraktionen', () => { ON.auf_ok(); ON.auf_tab('ruf'); }); await check('Fraktionen');
    await shot('fraktion-orden', () => { ON.auf_fk('orden'); });
    await shot('fraktion-orden-unten', () => { const s = panel.querySelector('.side'); if (s) s.scrollTop = 9999; panel.scrollTop = 9999; });
    await shot('tausch', () => { ON.auf_fk(''); ON.auf_qm('gilde'); }); await check('Tausch');
    await shot('tausch-wildnis', () => { ON.auf_qf('wild'); });
    await shot('beute-filter', () => { hideOverlay(); showSettings('title'); showLootSet(); });
    await shot('einstellungen', () => { showSettings('title'); });
    await shot('charakter', () => { P.bag = []; for (let i = 0; i < 6; i++) P.bag.push(randomItem(20, ri(0, 4))); P.bag.push(makeItem({ slot: 'weapon', base: 'sword', tier: 6, rar: 4 })); openChar('gear', 'map'); });
    await shot('karte-mehr', () => { const H = aufSet(); H.dq[2].c = 1; H.dq[2].ok = 1; P.map = genMap(3); openMap(); showMapMore(); });
    await shot('karte', () => { openMap(); });
    // Bedienung mit Antippen: Karte → Mehr → Aufträge & Ruf → Abholen → Weiter → Zurück
    const flow = await p.evaluate(async () => {
      const tap = sel => { const el = panel.querySelector(sel); if (!el) return false; el.click(); return true; };
      const o = {}; o.more = /Mehr \(!\)/.test(panel.textContent); tap('[data-act="mapmore"]'); o.badge = !!panel.querySelector('[data-act="auf_open"] .badge');
      tap('[data-act="auf_open"]'); o.open = /AUFTRAGSTAFEL/.test(panel.textContent); tap('[data-act="auf_claim"]'); o.claim = /AUFTRAG ERFÜLLT/.test(panel.textContent);
      tap('[data-act="auf_ok"]'); tap('[data-act="auf_back"]'); o.back = state === 'map' && !!panel.querySelector('[data-act="auf_open"]');
      return o;
    });
    ok(flow.more && flow.badge && flow.open && flow.claim && flow.back, `${tag}: Karte „Mehr (!)“ → Aufträge & Ruf (Zähler) → Abholen → Weiter → Zurück unter „Mehr“` + (Object.values(flow).every(Boolean) ? '' : ' ' + JSON.stringify(flow)));
    await c2.close();
  }

  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
