// Basar (js/market.js). Aufruf: node market.js [breite] [höhe] [bildordner]
// Prüft: Marktwert (stimmig, kein Gewinn im Kreis), Händler (Preise, Vorrat, Beutel → Lager → abgelehnt, alle 4 Std. neu),
// eigene Versteigerungen (Gebühr, unverkauft zurück, abbrechen, Plätze), Bieten (reserviert, überboten → zurück, Zuschlag, Sofortkauf),
// glaubwürdige Bieter (Preise um den Marktwert, Last-Minute, Verlängerung), Uhr zurück/weit vor, Spiel geschlossen (Nachrechnen beim Start),
// manipulierte und kaputte Spielstände, ohne Begleiter-System, Antippen aller Basar-Bildschirme auf einem Touch-Handy. Mit Bildordner: Fotos.
const { chromium } = require('playwright');
const fs = require('fs');
const [W, H, OUT] = [+process.argv[2] || 390, +process.argv[3] || 844, process.argv[4] || ''];
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: OUT ? 2 : 1, isMobile: true, hasTouch: true, locale: 'de-DE' });
  // Zeitreise für „Spiel geschlossen“: Versatz der Uhr aus dem localStorage
  await ctx.addInitScript(() => { const off = +localStorage.getItem('mkTestOff') || 0; if (off) { const dn = Date.now.bind(Date); Date.now = () => dn() + off; } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await page.waitForTimeout(260); };
  const h2 = () => page.evaluate(() => (panel.querySelector('h2') || {}).textContent);
  const shot = async name => { if (!OUT) return; await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${name}.png` }); };
  const noOverflow = () => page.evaluate(() => panel.scrollWidth <= panel.clientWidth + 1);
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  console.log(`Basar ${W}x${H}`);

  /* ---------- Regeln ---------- */
  const r = await page.evaluate(() => {
    const o = {}, real = Date.now.bind(Date); let NOW = real(); Date.now = () => NOW;
    const c = newChar('knight', 'Hedwig', 'normal', false); c.lv = 30; c.maxAct = 5; c.act = 5; SAVE.chars.push(c); activateChar(0);
    SAVE.meta.hide.b.lager = 2; SAVE.meta.pets.starter = true; P.gold = 1e7; P.bag = []; computeStats(); saveChar();
    // 1) Marktwert
    const it = (slot, tier, rar, x) => Object.assign(makeItem({ slot, base: slot === 'weapon' ? 'sword' : slot, form: 'lang', tier, rar, myth: rar === 6 ? (slot === 'weapon' ? 'klinge' : slot === 'armor' ? 'phoenix' : 'krone') : null, set: rar === 5 ? 'lion' : null }), { aff: {}, gems: [], sockets: 0, el: undefined }, x || {});
    const v = (...a) => itemValue(it(...a));
    o.det = (() => { const x = randomItem(20, 3); return itemValue(x) === itemValue(JSON.parse(JSON.stringify(x))) && itemValue(x) > 0; })();
    o.rar = [0, 1, 2, 3, 4].every((q, i, a) => !i || v('weapon', 3, q) > v('weapon', 3, a[i - 1])) && v('helm', 4, 6) > v('helm', 4, 4);
    o.tier = [0, 1, 2, 3, 4, 5, 6, 7].every((t, i) => !i || v('armor', t, 2) > v('armor', t - 1, 2));
    o.up = [0, 2, 5, 7, 10].every((u, i, a) => !i || v('weapon', 2, 3, { up: u }) > v('weapon', 2, 3, { up: a[i - 1] })) && v('weapon', 2, 3, { fz: 2 }) > v('weapon', 2, 3);
    o.extras = v('weapon', 4, 3, { gems: ['rubin:3'], sockets: 1 }) > v('weapon', 4, 3, { sockets: 1 }) && v('weapon', 4, 3, { mw: { klinge: 5, griff: 3 } }) > v('weapon', 4, 3) && v('weapon', 4, 3, { el: 'feuer' }) > v('weapon', 4, 3) && v('weapon', 4, 3, { aff: { krit: AFFW.krit.f(3) } }) > v('weapon', 4, 3);
    let bad = 0, cheap = 0; for (let i = 0; i < 2000; i++) { const x = randomItem(ri(1, 60), ri(0, 4), { setChance: .05 }); if (i % 50 === 0) x.rar = 6, x.myth = 'midas', x.slot = 'helm', x.base = 'helm'; const w = itemValue(x), q = mkQuote({ t: 'item', it: x }); if (!(w > 0 && Number.isFinite(w))) bad++; if (q < itemPrice(x) || q > Math.max(itemPrice(x), w * .5)) cheap++; }
    o.allItems = bad === 0 && cheap === 0;
    o.loot = lootValue({ t: 'mat', k: 'erz', n: 10 }) === 80 && lootValue({ t: 'gold', n: 77 }) === 77 && lootValue({ t: 'gem', k: 'rubin:2', n: 1 }) > lootValue({ t: 'gem', k: 'rubin:1', n: 2 }) && lootValue({ t: 'part', k: 'klinge:4', n: 1 }) > lootValue({ t: 'part', k: 'klinge:3', n: 2 }) && lootValue({ t: 'egg', d: { egg: 1, sp: 'drache' } }) > lootValue({ t: 'egg', d: { egg: 1, sp: 'katze' } });
    o.junk = [null, 5, 'x', {}, { t: 'mat', k: 'laser', n: 5 }, { t: 'mat', k: '__proto__', n: 1 }, { t: 'item', it: null }, { t: 'gem', k: 'rubin:9', n: 1 }, { t: 'part', k: 'x:99', n: 1 }, { t: 'egg', d: { sp: '<b>' } }, { t: 'mat', k: 'erz', n: -4 }].every(e => lootValue(e) === 0);
    o.line = itemLines(it('weapon', 3, 3)).some(l => l.startsWith('Marktwert: '));
    // kein Gewinn im Kreis: Veredeln, Edelsteine und Bauteile kombinieren, Händler-Laden auf der Karte
    o.loops = TRANSMUTE.every(([f, t, n, g]) => MK_MATV[f] * n + g >= MK_MATV[t]) && [0, 1, 2, 3].every(g => 3 * MK_GEMV[g] + gemCombineCost(g) >= MK_GEMV[g + 1] * .99) && [1, 2, 3, 4, 5].every(g => 3 * mkPartV('klinge:' + g) + (typeof combCost === 'function' ? combCost(g).gold : 0) > mkPartV('klinge:' + (g + 1)))
      && [['kristall', 110], ['horn', 140], ['mithril', 180], ['adamant', 260], ['schuppe', 480]].every(([k, p]) => MK_MATV[k] < p);
    // 2) Händler
    const L = MARKET.listings('shop'), ids = L.map(x => x.id).join();
    o.shop = L.length >= 8 && L.every(x => x.n >= 1 && mkOfferPrice(x) > mkQuote(x.e) && x.f >= .85 && x.f <= 1.3) && L.some(x => x.e.t === 'item' && x.e.it.slot === 'weapon' && CLASSES.knight.weapons.includes(x.e.it.base));
    const off = L.find(x => x.e.t === 'item'), price = mkOfferPrice(off), g0 = P.gold, rb = MARKET.buy(off.id);
    o.buy = rb.ok && rb.where === 'bag' && P.gold === g0 - price && P.bag.length === 1 && off.n === 0 && MARKET.buy(off.id).err === 'gone';
    const stk = L.find(x => x.e.t === 'mat'); if (stk) { const m0 = P.mats[stk.e.k] || 0; MARKET.buy(stk.id); o.buyMat = P.mats[stk.e.k] === m0 + stk.e.n; } else o.buyMat = true;
    while (P.bag.length < 30) P.bag.push(makeItem({ slot: 'helm', tier: 0, rar: 0 }));
    const it2 = L.find(x => x.e.t === 'item' && x.n > 0), r2 = MARKET.buy(it2.id); o.stash = r2.ok && r2.where === 'stash' && SAVE.meta.hide.stash.length === 1;
    while (SAVE.meta.hide.stash.length < stashCap()) SAVE.meta.hide.stash.push(makeItem({ slot: 'helm', tier: 0, rar: 0 }));
    const it3 = L.find(x => x.e.t === 'item' && x.n > 0), g1 = P.gold, r3 = MARKET.buy(it3.id); o.full = r3.err === 'full' && P.gold === g1 && it3.n === 1;
    P.bag = []; SAVE.meta.hide.stash = []; const gk = P.gold; P.gold = 1; o.poor = MARKET.buy(it3.id).err === 'gold'; P.gold = gk;
    o.noReroll = MARKET.listings('shop').map(x => x.id).join() === ids;
    NOW += 4 * 3600000 + 1000; o.reroll = MARKET.listings('shop').map(x => x.id).join() !== ids;
    // 3) eigene Versteigerung: verkauft (Gebühr), unverkauft zurück, abbrechen, Plätze
    const M = mkM(); M.own = []; M.box = [];
    const sw = makeItem({ slot: 'weapon', base: 'sword', tier: 5, rar: 4 }); P.bag.push(sw);
    const e1 = MK_HERO.take({ t: 'item', uid: sw.uid }), V1 = lootValue(e1), a1 = MARKET.auction(e1, Math.round(V1 * .25), 0, 12);
    o.listed = a1.ok && !P.bag.includes(sw) && M.own.length === 1;
    M.own[0].bd = [{ n: 3, m: 1, k: 1, x: NOW + 3600000 }, { n: 4, m: .9, k: 1, x: NOW + 7200000 }];   // zwei feste Bieter: Ergebnis vorhersagbar
    NOW += 13 * 3600000; const ev1 = MARKET.tick(), so = ev1.find(e => e.k === 'sold'), gold = M.box.find(x => x.w === 'sold');
    o.sold = !!so && !!gold && gold.e.n === so.n - so.fee && so.fee >= so.n * .05 && so.fee <= Math.ceil(so.n * .1) && so.n >= V1 * .85 && so.n <= V1 * 1.1 && M.own.length === 0;
    o.bidEv = ev1.some(e => e.k === 'bid');
    const ar = makeItem({ slot: 'armor', tier: 3, rar: 2 }); P.bag.push(ar);
    const e2 = MK_HERO.take({ t: 'item', uid: ar.uid }); MARKET.auction(e2, lootValue(e2) * 10, 0, 1); NOW += 2 * 3600000;
    const ev2 = MARKET.tick(); o.unsold = ev2.some(e => e.k === 'unsold') && M.box.some(x => x.w === 'back' && x.e.it.uid === ar.uid);
    const gb = P.gold; o.autoGold = mkAutoGold() === gold.e.n && P.gold === gb + gold.e.n && !M.box.some(x => x.e.t === 'gold');
    const cl = MARKET.claim(M.box.findIndex(x => x.w === 'back')); o.claim = cl.ok && cl.where === 'bag' && P.bag.some(x => x.uid === ar.uid);
    const e3 = MK_HERO.take({ t: 'item', uid: ar.uid }), a3 = MARKET.auction(e3, 50, 40, 4); o.cancel = a3.ok && M.own[0].bo === 0 && MARKET.cancel(a3.id).ok && P.bag.some(x => x.uid === ar.uid);
    P.mats.erz = 50; const ex = [], sl = mkSlots(); for (let i = 0; i <= sl; i++) { const e = MK_HERO.take({ t: 'mat', k: 'erz', n: 5 }), x = MARKET.auction(e, 10, 0, 24); if (!x.ok) MK_HERO.give(e); ex.push(x); }
    o.slots = sl >= 3 && ex.slice(0, sl).every(x => x.ok) && ex[sl].err === 'slots' && P.mats.erz === 50 - 5 * sl;
    o.bad = MARKET.auction({ t: 'mat', k: 'erz', n: 5 }, 10, 0, 5).err !== undefined && MARKET.auction(null, 10, 0, 4).err === 'data' && MARKET.auction({ t: 'gold', n: 5 }, 1, 0, 4).err === 'data';
    M.own = [];
    // 4) Bieten: reserviert, zweites Gebot nicht nötig, überboten → Gold zurück, Zuschlag, Sofortkauf
    MARKET.tick(); const A = MARKET.listings('auc').find(x => x.t1 - NOW > 3600000);
    A.bd = [{ n: 0, m: 2, k: 2, x: A.t1 - 30000 }];   // Kaspar bietet in der letzten Minute
    const need = mkMinBid(A), gp = P.gold, rb1 = MARKET.bid(A.id, need);
    o.bid = rb1.ok && P.gold === gp - need && mkTop(A)[1] === -1 && MARKET.bid(A.id, need * 2).err === 'lead' && MARKET.bid(A.id + 'x', 5).err === 'over';
    NOW = A.t1 - 10000; const ev4 = MARKET.tick(), ob = ev4.find(e => e.k === 'outbid');
    o.outbid = !!ob && ob.who === 0 && M.box.some(x => x.w === 'refund' && x.e.n === need) && A.ext > 0 && A.t1 > NOW;
    const ref = mkAutoGold(); o.refund = ref === need && P.gold === gp;
    const n2 = mkMinBid(A); MARKET.bid(A.id, n2); A.bd[0].m = .01; NOW = A.t1 + 1000;
    const ev5 = MARKET.tick(); o.won = ev5.some(e => e.k === 'won' && e.id === A.id) && M.box.some(x => x.w === 'won' && x.e === A.e) && P.gold === gp - n2;
    const B2 = MARKET.listings('auc')[0], VB = lootValue(B2.e); B2.bo = mkNice(Math.max(VB * 1.5, (mkTop(B2) ? mkTop(B2)[2] : 0) * 1.2)); const gq = P.gold, nb = P.bag.length, rbo = MARKET.buyout(B2.id);
    o.buyout = rbo.ok && P.gold === gq - B2.bo && (rbo.where === 'bag' || rbo.where === 'vorrat' || rbo.where === 'nest') && !mkM().auc.includes(B2) && (B2.e.t !== 'item' || P.bag.length === nb + 1);
    // 5) Bieter: viele Händler-Auktionen – Preis um den Marktwert, Last-Minute-Gebote, Verlängerungen
    let n = 0, sum = 0, sold = 0, late = 0, ext = 0, hi = 0; const t0 = NOW - 30 * 3600000;
    for (let i = 0; i < 400; i++) { const X = mkAucNew(t0), Vx = Math.max(1, lootValue(X.e)); X.start = Math.max(1, Math.round(Vx * .5)); X.bo = 0; mkSim(X, NOW, []); n++; const top = mkTop(X); if (top) { sold++; sum += top[2] / Vx; if (top[2] > Vx * 1.5) hi++; } if (X.bids.some(bd => X.t1 - bd[0] < 180000)) late++; if (X.ext > 0) ext++; }
    o.sim = { sold: sold / n, avg: sum / sold, late: late / n, ext: ext / n, hi: hi / n };
    // 6) Uhr: zurückgestellt → Basar wartet, nichts geht kaputt oder wird neu gewürfelt
    MARKET.tick(); const clk = M.clk, sids = MARKET.listings('shop').map(x => x.id).join(), ends = M.auc.map(x => x.t1).join();
    NOW -= 5 * 3600000; const evb = MARKET.tick();
    o.back = mkNow() === clk && evb.length === 0 && MARKET.listings('shop').map(x => x.id).join() === sids && M.auc.map(x => x.t1).join() === ends && mkFrozen() > 4 * 3600000;
    NOW += 5 * 3600000 + 60000; o.resume = mkNow() === NOW && mkFrozen() === 0;
    NOW += 60 * 864e5; MARKET.tick(); NOW -= 60 * 864e5; const n0 = mkNow();
    o.far = n0 === NOW && M.auc.every(x => x.t1 - NOW < 26 * 3600000 && x.t1 > NOW - 3600000) && M.auc.length >= 6;
    // 7) Spielstand: Hin und zurück, Manipulation, Zufalls-Müll
    MARKET.tick(); const js = JSON.parse(JSON.stringify(M)), fx = mkFix(js);
    o.round = fx.auc.length === M.auc.length && fx.box.length === M.box.length && JSON.stringify(fx.auc.map(x => [x.id, x.t1, x.bids.length, x.start])) === JSON.stringify(M.auc.map(x => [x.id, x.t1, x.bids.length, x.start]));
    const ev = JSON.parse(JSON.stringify(js)); const S0 = ev.shop[P.id]; S0.list[0].f = .01; ev.auc[0].start = 1; ev.auc[0].bids = [[1, -1, 2], [2, 3, 1]]; ev.clk = 1e30; ev.vol = -5; ev.box.push({ e: { t: 'gold', n: 1e20 } }, { e: { t: 'item', it: { slot: 'ring' } } }); ev.hist['__proto__'] = [[1, 2]]; ev.shop.__proto__ = { x: 1 };
    const fe = mkFix(ev), V0 = lootValue(fe.auc[0].e);
    o.tamper = fe.shop[P.id].list[0].f === .8 && fe.auc[0].start >= Math.ceil(V0 * .2) && fe.auc[0].bids.length === 0 && fe.clk <= 1e14 && fe.vol === 0 && !fe.box.some(x => x.e.t === 'gold' && x.e.n > 1e10) && fe.box.length === js.box.length && !({}).x;
    const vals = [null, -1, 0, 1, 1e300, NaN, '', 'x', '__proto__', true, [], [1, 'a'], {}, { a: 1 }, { t: 'item', it: {} }, { t: 'mat', k: 'erz', n: 3 }, [[1, -1, 5]]];
    let crash = 0, invalid = 0;
    const deep = (x, d) => { if (d > 3 || !x || typeof x !== 'object') return; const ks = Object.keys(x); if (ks.length && Math.random() < .5) x[ks[Math.floor(Math.random() * ks.length)]] = vals[Math.floor(Math.random() * vals.length)]; for (const k of ks) deep(x[k], d + 1); };
    for (let i = 0; i < 300; i++) {
      try {
        const y = JSON.parse(JSON.stringify(js)); deep(y, 0); if (i % 9 === 0) y.auc = vals[i % vals.length]; if (i % 13 === 0) y.box = [vals[i % vals.length]];
        const f = mkFix(y);
        const valid = Array.isArray(f.auc) && Array.isArray(f.own) && Array.isArray(f.box) && f.auc.concat(f.own).every(a => mkFixE(a.e) && a.t1 >= a.t0 && Number.isFinite(a.t1) && a.bids.every((bd, j) => Number.isInteger(bd[2]) && bd[2] >= a.start && (!j || bd[2] > a.bids[j - 1][2]))) && f.box.every(x => mkFixE(x.e)) && Number.isFinite(f.vol) && Number.isFinite(f.clk);
        if (!valid) invalid++;
        SAVE.meta.market = f; MARKET.tick(); MARKET.listings('auc').forEach(a => { mkName(a.e); mkIcon(a.e); lootValue(a.e); });
      } catch (e) { crash++; o.crashMsg = e.message; }
    }
    o.fuzz = crash === 0 && invalid === 0; o.fuzzInfo = `${invalid} ungültig, ${crash} Abstürze`;
    SAVE.meta.market = mkFix(js);
    // 8) Verkaufen an Hedda und Schätzung
    P.mats.glut = 10; const gs = P.gold, rs = MARKET.sell(MK_HERO.take({ t: 'mat', k: 'glut', n: 10 })); o.sell = rs.ok && rs.gold === 10 * Math.floor(140 * .4) && P.gold === gs + rs.gold && P.mats.glut === 0;
    const es = mkEst({ t: 'item', it: sw }, Math.round(V1 * .5), 0, 12), eh = mkEst({ t: 'item', it: sw }, V1 * 3, 0, 12);
    o.est = es.p > .9 && es.lo > 0 && es.lo <= es.hi && eh.p < .2;
    Date.now = real; mkM().clk = 0; saveChar(); persist();
    return o;
  });
  ok(r.det && r.allItems, 'Marktwert: gleich für gleiche Gegenstände, immer > 0; Hedda zahlt nie weniger als der Händler und höchstens die Hälfte');
  ok(r.rar && r.tier && r.up && r.extras, 'Marktwert steigt mit Seltenheit, Stufe, Aufwertung, Sternen, Edelsteinen, Meisterwerk, Element, Zusatzwerten');
  ok(r.loot && r.junk, 'lootValue: Materialien, Edelsteine, Bauteile, Eier, Gold; ungültige Einträge = 0');
  ok(r.line, 'Zeile „Marktwert“ am Gegenstand');
  ok(r.loops, 'kein Gewinn im Kreis (Veredeln, Kombinieren, Laden auf der Karte)');
  ok(r.shop && r.buy && r.buyMat, 'Händler: Angebote passend zum Helden, Preis über dem Sofortpreis, Vorrat zählt runter');
  ok(r.stash && r.full && r.poor, 'Kaufen: Beutel voll → Lager, beides voll → abgelehnt (kein Gold weg), zu wenig Gold → abgelehnt');
  ok(r.noReroll && r.reroll, 'Händler-Ware bleibt, nach 4 Stunden neue Ware');
  ok(r.listed && r.sold && r.bidEv, 'eigene Versteigerung: Gebote, verkauft, Erlös minus Gebühr (10–5 % nach Rang) ins Abholfach');
  ok(r.unsold && r.autoGold && r.claim, 'unverkauft zurück ins Abholfach, Gold wird beim Öffnen gutgeschrieben, Abholen in den Beutel');
  ok(r.cancel && r.slots && r.bad, 'Abbrechen ohne Gebote, Auktionsplätze nach Handelsrang, ungültige Angebote abgelehnt');
  ok(r.bid, 'Bieten: Gold reserviert, eigenes Höchstgebot nicht überbietbar, vorbei = abgelehnt');
  ok(r.outbid && r.refund, 'überboten in der letzten Minute: Meldung, Gold zurück, Auktion verlängert');
  ok(r.won && r.buyout, 'Zuschlag: Ware ins Abholfach; Sofortkauf: direkt in den Beutel');
  ok(r.sim.sold > .85 && r.sim.avg > .8 && r.sim.avg < 1.35 && r.sim.late > .1 && r.sim.ext > .05 && r.sim.hi < .1, `Bieter glaubwürdig: ${Math.round(r.sim.sold * 100)} % verkauft, Ø ${r.sim.avg.toFixed(2)}× Marktwert, ${Math.round(r.sim.late * 100)} % Last-Minute, ${Math.round(r.sim.ext * 100)} % verlängert`);
  ok(r.back && r.resume, 'Uhr zurückgestellt: Basar wartet (nichts endet, nichts neu gewürfelt), danach geht es weiter');
  ok(r.far, 'Uhr stand weit in der Zukunft: Zeiten werden verschoben, Basar läuft weiter');
  ok(r.round && r.tamper, 'Spielstand hin und zurück; manipulierte Preise, Gebote, Uhr, Gold werden berichtigt');
  ok(r.fuzz, 'Zufalls-Manipulation (300 Spielstände): ' + r.fuzzInfo + (r.crashMsg ? ' – ' + r.crashMsg : ''));
  ok(r.sell && r.est, 'Sofort verkaufen (40 % je Stück), Schätzung für Versteigerungen');

  /* ---------- Spiel geschlossen: Versteigerungen laufen weiter ---------- */
  const pre = await page.evaluate(() => {
    const M = mkM(); M.own = []; M.box = []; M.log = []; M.unseen = 0;
    const it = makeItem({ slot: 'weapon', base: 'sword', tier: 4, rar: 3 }); P.bag.push(it);
    MARKET.auction(MK_HERO.take({ t: 'item', uid: it.uid }), 100, 0, 1); M.own[0].bd = [{ n: 5, m: 1, k: 1, x: Date.now() + 600000 }];
    const A = MARKET.listings('auc').find(x => !x.bids.length || mkTop(x)[1] !== -1); MARKET.bid(A.id, mkMinBid(A)); A.t1 = Math.min(A.t1, Date.now() + 2 * 3600000); A.bd = [{ n: 0, m: 2, k: 2, x: A.t1 - 20000 }];
    saveChar(); localStorage.setItem('mkTestOff', String(30 * 3600000)); return { gold: P.gold, aid: A.id };
  });
  await page.reload(); await page.waitForTimeout(3500);
  const post = await page.evaluate(aid => { const M = mkM(); return { sold: M.log.some(x => x.k === 'sold'), out: M.log.some(x => x.k === 'outbid'), box: M.box.map(x => x.w), gone: !M.auc.some(x => x.id === aid), toast: $('toast').textContent, unseen: M.unseen }; }, pre.aid);
  ok(post.sold && post.out && post.box.includes('sold') && post.box.includes('refund') && post.gone, '30 Std. später: verkauft und überboten nachgerechnet, Erlös und Rückzahlung im Abholfach');
  ok(/Verkauft|überboten|Basar/.test(post.toast) && post.unseen >= 2, 'Meldung beim Start: „' + post.toast.slice(0, 60) + '…“');
  await page.evaluate(() => localStorage.removeItem('mkTestOff'));

  /* ---------- alter und kaputter Spielstand, ohne Begleiter-System ---------- */
  for (const [name, fn] of [['ohne Basar', s => { delete s.meta.market; }], ['Basar = Text', s => { s.meta.market = 'kaputt'; }], ['Basar = Liste', s => { s.meta.market = [1, 2]; }], ['Listen kaputt', s => { s.meta.market = { auc: 'x', own: { a: 1 }, box: [null, 5, { e: null }], shop: [], hist: 'x', clk: 'morgen', init: 1 }; }]]) {
    await page.evaluate(src => { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); (new Function('s', src))(s); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); }, `(${fn.toString()})(s)`);
    await page.reload(); await page.waitForTimeout(1300);
    const st = await page.evaluate(() => { try { activateChar(0); hideOverlay(); P.map = genMap(1); openMap(); mkOpen('map'); const ok1 = panel.querySelector('h2').textContent === 'BASAR'; for (const t of ['buy', 'sell', 'bid', 'mine']) { MK.tab = t; mkShow(); } return ok1 && Array.isArray(mkM().auc) && mkM().auc.length >= 4 && mkM().auc.length + mkM().spawn.length >= 6; } catch (e) { return e.message; } });
    ok(st === true, `Spielstand ${name}: lädt, Basar öffnet mit allen Reitern` + (st === true ? '' : ' – ' + st));
  }
  const nop = await page.evaluate(() => {
    const keep = {}; for (const k of ['eggGive', 'petImport', 'eggExport', 'eggRoll', 'petIconURL']) { keep[k] = window[k]; window[k] = undefined; }
    const M = mkM(); M.shop = {}; const L = MARKET.listings('shop'); let eggs = 0; for (let i = 0; i < 30; i++) if (mkAucNew(Date.now()).e.t === 'egg') eggs++;
    MK.tab = 'sell'; mkShow(); const cat = !panel.textContent.includes('EIER');
    for (const k in keep) window[k] = keep[k]; M.shop = {};
    return !L.some(o => o.e.t === 'egg') && eggs === 0 && cat;
  });
  ok(nop, 'ohne Begleiter-System: keine Eier im Angebot, keine Eier zum Verkaufen');

  /* ---------- Antippen auf dem Handy ---------- */
  await page.evaluate(() => {
    activateChar(0); P.gold = 900000; P.lv = 30; P.act = 5; P.story = { a1: 1, a2: 1, a3: 1, a4: 1, a5: 1 }; P.bag = []; for (let i = 0; i < 8; i++) P.bag.push(randomItem(25, i % 5)); P.mats = { mithril: 25 }; P.gems = { 'saphir:2': 3 }; P.parts = { 'klinge:3': 2 };
    const M = mkM(); M.own = []; M.box = []; M.shop = {}; SAVE.meta.hide.intro = true; P.map = genMap(3); saveChar(); hideOverlay(); enterHideout();
  });
  await page.waitForTimeout(900);
  await shot('00_versteck');
  await page.evaluate(() => { const p = hidePos('basar'); P.x = p.x + 4; P.y = p.y + 22; }); await page.waitForTimeout(500);
  ok(await page.locator('#bAct').isVisible(), 'Versteck: Interagieren-Knopf am Basar');
  await page.locator('#bAct').tap(); await page.waitForTimeout(500);
  ok((await h2()) === 'BASAR' && await page.evaluate(() => panel.textContent.includes('Hedda') && MK.sel === null), 'Basar geöffnet, Auktionatorin Hedda spricht, der Finger vom Knopf tippt nichts an');
  const tabsOk = await page.evaluate(() => { const T = [...panel.querySelectorAll('.mk .tab')]; return T.length === 4 && T.every(t => t.offsetTop === T[0].offsetTop); });
  ok(tabsOk, 'vier Reiter in einer Zeile');
  await shot('01_kaufen');
  await tap('.mk .row[data-act="mk_sel"]');
  ok(await page.evaluate(() => !!panel.querySelector('.side.sheet [data-act="mk_buy"]')), 'Angebot angetippt: Details mit Kaufen-Knopf');
  await shot('02_kaufen_detail');
  const g0 = await page.evaluate(() => P.gold);
  await tap('.side.sheet [data-act="mk_buy"]');
  ok(await page.evaluate(g => P.gold < g && $('toast').textContent.startsWith('Gekauft!'), g0), 'gekauft: Gold weniger, Meldung');
  ok(await noOverflow(), 'kein seitliches Scrollen (Kaufen)');
  await tap('[data-act="mk_tab"][data-id="sell"]');
  await tap('.mk .grid [data-act="mk_sel"]');
  ok(await page.evaluate(() => !!panel.querySelector('[data-act="mk_sell"]') && !!panel.querySelector('[data-act="mk_set"]')), 'Verkaufen: Gegenstand → Sofort verkaufen oder Versteigern');
  await shot('03_verkaufen');
  await tap('[data-act="mk_set"]');
  ok((await h2()) === 'VERSTEIGERN', 'Versteigern: Einstellungen');
  await tap('[data-act="mk_sp"][data-id="25"]'); await tap('[data-act="mk_h"][data-id="1"]'); await tap('[data-act="mk_bp"][data-id="160"]');
  ok(await page.evaluate(() => MK.set.sp === 25 && MK.set.h === 1 && MK.set.bp === 160 && /Verkaufschance/.test(panel.textContent)), 'Startpreis, Dauer, Sofortkauf gewählt, Schätzung sichtbar');
  ok(await page.evaluate(() => { const r = panel.querySelector('[data-act="mk_go"]').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }), 'Start-Knopf ohne Scrollen sichtbar');
  await shot('04_einstellen');
  const nb = await page.evaluate(() => P.bag.length);
  await tap('[data-act="mk_go"]');
  ok(await page.evaluate(n => MK.tab === 'mine' && mkM().own.length === 1 && P.bag.length === n - 1 && !!panel.querySelector('.mk [data-mkend]'), nb), 'eingestellt: unter MEINE mit Countdown, Gegenstand aus dem Beutel');
  await shot('05_meine');
  await tap('[data-act="mk_tab"][data-id="sell"]'); await tap('[data-act="mk_cat"][data-id="mat"]'); await tap('.mk .row[data-act="mk_sel"]');
  await tap('[data-act="mk_n"][data-id="-10"]');
  ok(await page.evaluate(() => MK.n === 15), 'Menge wählen (−10)');
  await shot('06_material');
  await tap('[data-act="mk_sell"]'); await tap('[data-act="mk_sell"]');   // wertvoll: einmal bestätigen
  ok(await page.evaluate(() => P.mats.mithril === 10), 'Material sofort verkauft (mit Bestätigung)');
  await tap('[data-act="mk_tab"][data-id="bid"]');
  const aid = await page.evaluate(() => MARKET.listings('auc').find(A => A.t1 - mkNow() > 15 * 60000 && !(mkTop(A) && mkTop(A)[1] === -1)).id);
  await tap(`.mk .row[data-id="${aid}"]`);
  const cd0 = await page.evaluate(() => panel.querySelector('.mk-bidbox [data-mkend]').textContent);
  await page.waitForTimeout(2200);
  const cd1 = await page.evaluate(() => panel.querySelector('.mk-bidbox [data-mkend]') && panel.querySelector('.mk-bidbox [data-mkend]').textContent);
  ok(cd0 !== cd1, `Countdown läuft (${cd0} → ${cd1})`);
  await tap('[data-act="mk_amt"][data-id="1"]');
  const amt = await page.evaluate(() => MK.amt);
  await tap('[data-act="mk_bid"]');
  ok(await page.evaluate(a => !!panel.querySelector('.mk-pill.lead') && mkTop(mkM().auc.find(x => x.id === MK.sel))[2] === a, amt), 'geboten: „DU FÜHRST“');
  await shot('07_bieten');
  ok(await noOverflow(), 'kein seitliches Scrollen (Bieten)');
  // Kaspar überbietet, während der Basar offen ist: Meldung und Rückzahlung erscheinen von selbst
  await page.evaluate(() => { const A = mkM().auc.find(x => x.id === MK.sel); A.bo = 0; A.bd.push({ n: 0, m: 3, k: 2, x: Date.now() + 1500 }); });
  await page.waitForTimeout(4600);
  const live = await page.evaluate(() => ({ t: $('toast').textContent, pill: !!panel.querySelector('.mk-pill.out') && mkM().log.some(x => x.k === 'outbid'), badge: !!panel.querySelector('.tab[data-id="bid"][data-b]') }));
  ok(/überboten/.test(live.t) || live.pill, 'live überboten: „' + live.t.slice(0, 50) + '“');
  ok(live.badge, 'Reiter BIETEN zeigt „!“');
  await shot('08_ueberboten');
  await page.evaluate(() => { mkBoxAdd({ t: 'item', it: makeItem({ slot: 'helm', tier: 3, rar: 4 }) }, 'won', Date.now()); mkBoxAdd({ t: 'gem', k: 'rubin:3', n: 1 }, 'won', Date.now()); MK.tab = 'buy'; mkShow(); });
  ok(await page.locator('.mk-box').count() === 1, 'Hinweis „Abholfach“ oben');
  await tap('.mk-box');
  await shot('09_abholfach');
  const before = await page.evaluate(() => ({ bag: P.bag.length, gem: P.gems['rubin:3'] || 0 }));
  await tap('[data-act="mk_claim"][data-id="all"]');
  ok(await page.evaluate(b => P.bag.length === b.bag + 1 && P.gems['rubin:3'] === b.gem + 1 && !mkM().box.length, before), 'Alles abholen: Helm im Beutel, Rubin im Vorrat');
  const big = await page.evaluate(() => { const bad = [...panel.querySelectorAll('.mk .btn, .mk .opt, .mk .tab, .mk .row[data-act]')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 40 && !b.classList.contains('sheetx')); return bad.map(b => b.textContent.trim().slice(0, 20)); });
  ok(big.length === 0, 'Knöpfe mindestens 40 px hoch' + (big.length ? ': ' + big.join(', ') : ''));
  await tap('[data-act="mk_back"]'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => state === 'play' && G.type === 'versteck'), 'Zurück ins Versteck');
  await shot('10_versteck_hinweis');
  // Karte → Mehr → Basar; Charakter → Gegenstand → Versteigern
  await page.evaluate(() => { leaveHideout(); }); await page.waitForTimeout(400);
  await tap('[data-act="mapmore"]'); await tap('[data-act="mk_open"]');
  ok((await h2()) === 'BASAR', 'Karte → Mehr → Basar');
  await tap('[data-act="mk_back"]');
  ok(await page.evaluate(() => !!panel.querySelector('[data-act="tomapview"]')), 'Zurück in „Mehr“');
  await tap('[data-act="tomapview"]'); await tap('[data-act="char"]'); await tap('#panel .grid [data-act="isel"]');
  ok(await page.locator('[data-act="mk_quick"]').count() === 1, 'Charakter: „Versteigern“ am Gegenstand');
  await tap('[data-act="mk_quick"]');
  ok((await h2()) === 'VERSTEIGERN', 'direkt zu den Einstellungen');
  await tap('[data-act="mk_setx"]');
  ok(await page.evaluate(() => panel.querySelector('h2').textContent === P.name.toUpperCase() && !!panel.querySelector('.side.sheet')), 'Zurück: wieder beim Gegenstand im Charakter');

  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
