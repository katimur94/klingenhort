// Sammeln & Bauen (6.2): Rohstoffe, Bauzeit mit Sofort-fertig, mehr Stufen, Sattlerei/Vogelhaus, Holzplatz, Acker, Abbauen in den Endlosen Landen,
// alte Spielstände, Bildschirmfotos (hoch, quer, PC). Aufruf: node bauen.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/bauen';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
// Uhr verstellen: window.__dt (ms) – auch über ein Neuladen hinweg (sessionStorage kh_shift = „Spiel war so lange zu“)
const CLOCK = () => { const real = Date.now.bind(Date); window.__dt = +(sessionStorage.getItem('kh_shift') || 0); Date.now = () => real() + window.__dt; };
const HERO = (lv, mats) => {
  localStorage.clear(); loadAll();
  const c = newChar('knight', 'Baumeisterin', 'normal', false); c.lv = lv || 20; c.act = 3; c.maxAct = 3; c.story = { a1: 1, a2: 1, a3: 1 };
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; for (const a of ACH) SAVE.meta.ach[a.id] = 1; if (SAVE.meta.lande) SAVE.meta.lande.tips = 0xffff;
  P.gold = 500000; P.fate = 30; if (mats) for (const k of MATORDER) P.mats[k] = mats;
  computeStats(); P.hp = P.st.hp; saveChar(); persist();
};
const CALM = () => { LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; P.inv = 1e9; };

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

  console.log('Rohstoffe');
  {
    const r = await ev(() => {
      const res = ['holz', 'stein', 'faser', 'feder', 'samen', 'eisenholz', 'sternholz', 'marmor', 'obsidian'], o = {};
      o.data = res.every(k => MATS[k] && MATS[k].res && MATS[k].n && MATS[k].c && MATORDER.includes(k));
      // jedes Bildchen hat eigene, sichtbare Pixel
      const sig = k => { const c = matIcon(k), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, h = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) { n++; h = (h * 31 + d[i - 3] * 7 + d[i - 2] * 3 + d[i - 1] + i) | 0; } return n > 12 ? h : 0; };
      const sigs = res.map(sig); o.icons = sigs.every(Boolean) && new Set(sigs).size === res.length;
      o.mon = MONMATS.length === 13 && MONMATS.every(k => !MATS[k].res) && MONMATS[12] === 'aether';
      o.market = res.every(k => MK_MATV[k] > 0) && typeof PET_FEED === 'undefined' || res.every(k => PET_FEED[k] > 0 && PET_FEED[k] < 2000);
      o.drops = (() => { for (let st = 1; st < 400; st += 7) { const a = MONMATS.slice(0, Math.min(MONMATS.length, 6 + Math.floor(st / 8))); if (a.some(k => MATS[k].res)) return false; } return true; })();
      return o;
    });
    ok(r.data, 'neue Rohstoffe in MATS und MATORDER: Holz, Stein, Pflanzenfaser, Feder, Samen, Eisenholz, Sternholz, Marmor, Obsidian');
    ok(r.icons, 'jeder Rohstoff hat ein eigenes Pixelbild');
    ok(r.mon && r.drops, 'Gegner-Beute und Truhen ziehen weiter nur aus den 13 Gegner-Materialien (MONMATS)');
    ok(r.market, 'Rohstoffe haben Werte im Basar und als Begleiter-Futter');
  }

  console.log('Bauzeit, Sofort fertig, mehr Stufen');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(20, 200); const o = {};
      o.levels = BUILD.schmiede.lv.length === 10 && BUILD.alchemie.lv.length === 10 && BUILD.juwelier.lv.length === 10 && BUILD.lager.lv.length === 15 && BUILD.training.lv.length === 15 && BUILD.tempel.lv.length === 10 && BUILD.bibliothek.lv.length === 10 && BUILD.mine.lv.length === 10 && BUILD.garten.lv.length === 10 && BUILD.sattler.lv.length === 10 && BUILD.voliere.lv.length === 5;
      o.texts = ['schmiede', 'alchemie', 'juwelier', 'lager', 'tempel', 'bibliothek', 'mine', 'garten', 'sattler', 'voliere'].every(k => BUILD[k].d.length === BUILD[k].lv.length);
      const cap = [0, 12, 24, 36, 48, 60, 80, 100, 125, 150, 180, 210, 250, 300, 350, 400]; o.lagerTxt = BUILD.lager.d.every((d, i) => d.includes(String(cap[i + 1])));
      o.sattTxt = BUILD.sattler.d.every((d, i) => d.includes(String(30 + 6 * (i + 1))) && d.includes(String(20 + 2 * (i + 1))));
      o.newMats = Object.values(BUILD).filter(B => B.lv).every(B => B.lv.some(c => c.holz || c.stein || c.faser || c.feder)) && Object.values(BUILD).filter(B => B.lv && B.lv.length >= 10).every(B => B.lv.slice(-3).some(c => c.sternholz || c.obsidian || c.aether));
      o.order = BUILDORDER.includes('sattler') && BUILDORDER.includes('voliere') && !!HIDE_POS.sattler && !!HIDE_POS.voliere;
      o.time = BTIME[1] <= 30 && BTIME[5] >= 300 && BTIME[10] >= 3600 * 4 && BTIME[15] >= 3600 * 12 && BTIME.every((t, i) => !i || t > BTIME[i - 1]);
      // Bau starten: bezahlt, aber die Stufe zählt erst, wenn sie fertig ist
      const g0 = P.gold, e0 = P.mats.erz, pm = potMax();
      o.start = doBuild('alchemie') === true; o.paid = P.gold === g0 - BUILD.alchemie.lv[0].gold && P.mats.erz === e0;
      o.notYet = hideLv('alchemie') === 0 && potMax() === pm && !!buildBusy() && buildBusy().k === 'alchemie' && buildBusy().lv === 1 && buildBusy().left > 5;
      o.oneAtATime = doBuild('schmiede') === false && !buildOf('schmiede') && P.gold === g0 - BUILD.alchemie.lv[0].gold;
      o.noDouble = buildStart('alchemie') === false;
      window.__dt += 11000; o.tick = buildTick() === 1 && hideLv('alchemie') === 1 && !buildBusy() && potMax() === 10 && /fertig gebaut/i.test($('toast').textContent);
      // höhere Stufen: dauern länger
      o.l2 = doBuild('alchemie') && Math.abs(buildBusy().left - BTIME[2]) < 2;
      o.done = buildDone('alchemie') === true && hideLv('alchemie') === 2 && buildDone('alchemie') === false;
      // Zweiter Baumeister ab Versteck-Stufe 50
      SAVE.meta.hide.b = { schmiede: 10, alchemie: 10, juwelier: 10, lager: 10, training: 10 }; o.two = builders() === 2 && doBuild('lager') && doBuild('training') && buildQ().length === 2 && !buildFree() && !doBuild('mine');
      SAVE.meta.hide.q = []; SAVE.meta.hide.b = {};
      // bis zur letzten Stufe: Schatzkammer 15
      for (let i = 0; i < 15; i++) { buildStart('lager'); buildDone('lager'); } o.max15 = hideLv('lager') === 15 && buildCost('lager') === null && buildStart('lager') === false;
      return o;
    }, [H]);
    ok(r.levels, 'mehr Stufen: Schmiede, Labor, Juwelier, Tempel, Bibliothek, Mine, Garten, Sattlerei 10, Schatzkammer und Training 15, Vogelhaus 5');
    ok(r.texts && r.lagerTxt && r.sattTxt, 'Stufentexte passen: Schatzkammer 12 … 400 Plätze, Sattlerei Beutel 30 + 6·Stufe, Rucksack 20 + 2·Stufe');
    ok(r.newMats, 'Kosten mit Holz/Stein/Faser/Federn am Anfang, Sternholz/Obsidian/Äther ganz oben');
    ok(r.order, 'Sattlerei und Vogelhaus in BUILDORDER mit Platz im Versteck');
    ok(r.time, 'Bauzeit: Sekunden am Anfang, Stunden spät (' + 'Stufe 1 ' + 'Sekunden, Stufe 15 ≥ 12 h)');
    ok(r.start && r.paid && r.notYet, 'Ausbau beginnt: bezahlt, Stufe zählt noch nicht (hideLv, Trank-Vorrat unverändert)');
    ok(r.oneAtATime && r.noDouble, 'nur eine Baustelle zur Zeit, dasselbe Gebäude nicht doppelt');
    ok(r.tick, 'nach der Bauzeit (Uhr vorgestellt) fertig: Stufe zählt, Wirkung da, Meldung');
    ok(r.l2 && r.done, 'Stufe 2 dauert länger; buildDone(k) stellt sofort fertig');
    ok(r.two, 'ab Versteck-Stufe 50 ein zweiter Baumeister');
    ok(r.max15, 'Schatzkammer bis Stufe 15, danach kein Ausbau mehr');
  }

  // Sofort fertig: Preis je Restzeit, Rückfrage, nichts ohne Bestätigung, nichts ohne Geld
  {
    await ev(([H_]) => { eval('(' + H_ + ')')(30, 200); SAVE.meta.hide.b.training = 7; P.fate = 1; computeStats(); enterHideout(); openStation('training'); }, [H]);
    const r = await ev(() => {
      const o = {}, d0 = P.st.m.dmg || 0; o.start = doBuild('training'); openStation('training');
      const q = buildOf('training'), pr = buildSkipPrice(q); o.q = q && q.lv === 8; o.price = pr.gold === Math.ceil(buildLeft(q) / 60) * (10 + 4 * 8) && pr.coins === 2 && pr.gold > 4000;
      o.sameStats = hideLv('training') === 7 && (P.st.m.dmg || 0) === d0;
      o.btn = !!panel.querySelector('[data-act="bskip"][data-pay="gold"]') && panel.querySelector('[data-act="bskip"][data-pay="coins"]').disabled;
      o.noCoins = buildSkip('training', 'coins') === false && !!buildOf('training') && P.fate === 1;
      return o;
    });
    const g0 = await ev(() => P.gold);
    await page.click('[data-act="bskip"][data-pay="gold"]'); await page.waitForTimeout(150);
    const ask = await ev(() => ({ h: (panel.querySelector('h2') || {}).textContent, t: panel.textContent, g: P.gold, q: !!buildOf('training') }));
    await page.screenshot({ path: OUT + '/quer-rueckfrage.png' });
    await page.click('[data-act="bskipno"]'); await page.waitForTimeout(150);
    const no = await ev(() => ({ q: !!buildOf('training'), g: P.gold, back: !!panel.querySelector('[data-bk="training"]') }));
    await page.click('[data-act="bskip"][data-pay="gold"]'); await page.waitForTimeout(150);
    const left = await ev(() => buildLeft(buildOf('training')));
    await page.click('[data-act="bskipok"]'); await page.waitForTimeout(150);
    const yes = await ev(() => ({ q: !!buildOf('training'), g: P.gold, lv: hideLv('training'), stats: P.st.m.dmg }));
    const paid = g0 - yes.g, want = Math.ceil(left / 60) * 42;
    ok(r.start && r.q && r.price, 'Sofort fertig: Preis aus der Restzeit (Gold je angefangene Minute, 1 Glücksmünze je angefangene Stunde)');
    ok(r.sameStats, 'während des Baus wirkt noch die alte Stufe (Training 7)');
    ok(r.btn && r.noCoins, 'zu wenig Glücksmünzen: Knopf gesperrt, nichts passiert');
    ok(ask.h === 'SOFORT FERTIG?' && ask.t.includes('Gold') && ask.g === g0 && ask.q, 'Rückfrage mit Preis – vor der Bestätigung wird nichts bezahlt');
    ok(no.q && no.g === g0 && no.back, 'Abbrechen: Baustelle läuft weiter, zurück zur Station');
    ok(!yes.q && yes.lv === 8 && paid >= want - 42 && paid <= want + 42, `bestätigt: ${paid} Gold bezahlt, Training Stufe 8 sofort fertig`);
  }

  // Fertig, während das Spiel zu war
  {
    await ev(([H_]) => { eval('(' + H_ + ')')(20, 200); SAVE.meta.hide.b.mine = 2; doBuild('mine'); persist(); sessionStorage.setItem('kh_shift', String(window.__dt + BTIME[3] * 1000 + 5000)); }, [H]);
    await page.reload(); await page.waitForTimeout(1800);
    const r = await ev(() => ({ lv: hideLv('mine'), q: SAVE.meta.hide.q.length, toast: $('toast').textContent }));
    await ev(() => sessionStorage.removeItem('kh_shift'));
    ok(r.lv === 3 && r.q === 0 && /fertig gebaut/i.test(r.toast), 'Bau fertig geworden, während das Spiel zu war: Stufe zählt, Meldung beim Start („' + r.toast + '“)');
  }

  console.log('Alte Spielstände');
  {
    await page.reload(); await page.waitForTimeout(1200);
    // Spielstand aus 6.1: alle Gebäude auf der alten Höchststufe, ohne Baustellen/Holzplatz/Acker – dazu kaputte Felder
    const old = await ev(([H_]) => {
      eval('(' + H_ + ')')(40, 0); const S = JSON.parse(JSON.stringify(SAVE));
      S.meta.hide = { b: { schmiede: 4, alchemie: 4, juwelier: 3, lager: 5, training: 10, tempel: 3, bibliothek: 3, mine: 5, garten: 5 }, stash: [], rooms: 30, mine: 10, garden: 12, intro: true };
      const S2 = JSON.parse(JSON.stringify(S)); S2.meta.hide.q = [{ k: 'nichts', lv: 1, t0: 1, end: 2 }, { k: 'schmiede', lv: 'x', t0: 0, end: Date.now() + 60000 }, 'kaputt']; S2.meta.hide.gat = [1, 2]; S2.meta.hide.farm = { a: 1 }; S2.meta.hide.b.lager = 99;
      return [JSON.stringify(S), JSON.stringify(S2), SAVE_KEY];
    }, [H]);
    const load = async s => { await ev(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [old[2], s]); await page.reload(); await page.waitForTimeout(1500); };
    await load(old[0]);
    const r = await ev(() => { activateChar(0); const H = SAVE.meta.hide, o = {};
      o.kept = H.b.schmiede === 4 && H.b.lager === 5 && H.b.training === 10 && H.b.garten === 5 && H.rooms === 30;
      o.fields = Array.isArray(H.q) && !H.q.length && typeof H.gat === 'object' && Array.isArray(H.farm);
      o.effects = potMax() === 14 && potHeal() === .65 && fuseMax() === 5 && Math.abs(coinPrice() - Math.round((400 + P.lv * 30) * .75)) < 1;
      const c = buildCost('schmiede'); o.next = !!c && c.gold === BUILD.schmiede.lv[4].gold && !!buildCost('lager') && !!buildCost('training');
      enterHideout(); o.hide = obs.filter(x => x.k === 'gat').length === 8 && obs.some(x => x.k === 'station' && x.id === 'sattler');
      openStation('feuer'); o.camp = panel.textContent.includes('Sattlerei') && panel.textContent.includes('Stufe 4/10');
      return o; });
    ok(r.kept, 'Spielstand mit Gebäuden auf der alten Höchststufe lädt, Stufen bleiben');
    ok(r.fields, 'neue Felder (Baustellen, Holzplatz, Acker) ergänzt');
    ok(r.effects, 'alte Stufen-Wirkungen unverändert (Trank-Vorrat 14, Heilung 65 %, 5 Verschmelzungen, Münztausch −25 %)');
    ok(r.next && r.hide && r.camp, 'weiter ausbaubar über die alte Höchststufe hinaus, neue Gebäude stehen im Versteck');
    await load(old[1]);
    const r2 = await ev(() => { const H = SAVE.meta.hide; return { q: H.q.length === 1 && H.q[0].k === 'schmiede' && H.q[0].lv === 5, gat: !Array.isArray(H.gat) && typeof H.gat === 'object', farm: Array.isArray(H.farm), lager: H.b.lager === 15 }; });
    ok(r2.q && r2.gat && r2.farm && r2.lager, 'kaputte Daten repariert: ungültige Baustellen weg, Stufe passend gesetzt, Holzplatz/Acker neu, Stufe über dem Maximum begrenzt');
  }

  console.log('Holzplatz im Versteck');
  {
    await page.setViewportSize({ width: 390, height: 844 });
    await ev(([H_]) => { eval('(' + H_ + ')')(3, 0); P.gold = 40; enterHideout(); for (const e of enemies) e.dead = true; }, [H]);
    const r = await ev(async () => {
      const o = {}, t = obs.find(x => x.k === 'gat' && x.id === 'b2'), rk = obs.find(x => x.k === 'gat' && x.id === 's2');
      P.x = t.x + 11; P.y = t.y + 1; P.face = -1; P.vx = P.vy = 0;
      const h0 = P.mats.holz || 0; keys.KeyJ = true; await new Promise(r => setTimeout(r, 2600)); keys.KeyJ = false;
      o.tree = t.gone && !t.solid && (P.mats.holz || 0) >= h0 + 3 && SAVE.meta.hide.gat.b2 > Date.now();
      P.x = rk.x - 12; P.y = rk.y; P.face = 1; P.vx = P.vy = 0; keys.KeyJ = true; await new Promise(r => setTimeout(r, 2600)); keys.KeyJ = false;
      o.rock = rk.gone && (P.mats.stein || 0) >= 2;
      o.info = gatherInfo().hide.find(g => g.id === 'b2').ready === false;
      // lädt man das Versteck neu, bleibt gefällt gefällt
      const px = P.x, py = P.y; layoutHideout(); P.x = px; P.y = py; o.keep = obs.find(x => x.k === 'gat' && x.id === 'b2').gone;
      // nach 5 Minuten wieder da
      window.__dt += 301000; await new Promise(r => setTimeout(r, 200)); o.grow = !obs.find(x => x.k === 'gat' && x.id === 'b2').gone && gatherInfo().hide.find(g => g.id === 'b2').ready;
      o.build = canAfford(buildCost('garten').mats, 0) || (P.mats.holz || 0) > 0;
      return o;
    });
    ok(r.tree, 'Baum im Versteck mit Angriffen gefällt: Holz für den Helden, wächst in Echtzeit nach');
    ok(r.rock, 'Felsen im Versteck abgebaut: Stein');
    ok(r.info && r.keep, 'gefällt bleibt gefällt (auch nach dem Neuaufbau des Verstecks)');
    ok(r.grow, 'nach der Wachszeit (Uhr vorgestellt) steht der Baum wieder');
    // Kiste im Kampf: manchmal Holz
    const crate = await ev(() => { P.map = genMap(1); startRoom('kampf', 0); const R = Math.random; Math.random = () => .1; try { const o = { k: 'crate', x: P.x + 20, y: P.y, r: 6, hp: 1, solid: true }; obs.push(o); hitObs(o, 5, 0, 0); } finally { Math.random = R; } return pickups.some(p => p.k === 'mat' && p.m === 'holz'); });
    ok(crate, 'zerschlagene Kisten in den Kerkern geben manchmal Holz');
    // Mine und Garten fördern Stein, Fasern, Samen
    const prod = await ev(() => { SAVE.meta.hide.b.mine = 1; SAVE.meta.hide.b.garten = 2; const m = prodYield('mine', 10), g = prodYield('garten', 10); SAVE.meta.hide.b.mine = 10; const m10 = prodYield('mine', 20); return m.stein > 0 && m.erz === 10 && g.faser > 0 && g.samen > 0 && g.feder > 0 && g.schleim === 20 && m10.marmor > 0 && m10.obsidian > 0 && m10.aether > 0; });
    ok(prod, 'Erzmine fördert auch Stein (später Marmor, Obsidian), Garten auch Fasern, Samen, Federn');
  }

  console.log('Acker im Kräutergarten');
  {
    const r = await ev(([H_]) => {
      eval('(' + H_ + ')')(10, 0); SAVE.meta.hide.b.garten = 1; P.mats.samen = 3; const o = {};
      enterHideout(); openStation('garten');
      o.ui = panel.textContent.includes('ACKER') && panel.textContent.includes('Flachs') && !!panel.querySelector('[data-act="fplant"][data-id="flachs"]:not([disabled])') && !!panel.querySelector('[data-act="fplant"][data-id="setzling"]') === false;
      o.beds = farmBeds() === 2;
      o.plant = farmPlant('flachs') && farmPlant('heilkraut') && !farmPlant('flachs') && P.mats.samen === 1;
      o.lock = farmPlant('setzling') === false;
      o.notRipe = farmHarvest(0) === null && farmReady() === 0;
      window.__dt += 601000; o.ripe1 = farmReady() === 1;
      const f0 = P.mats.faser || 0, h = farmHarvest(0); o.harv = !!h && (P.mats.faser || 0) >= f0 + 3 && (P.mats.samen || 0) >= 2 && SAVE.meta.hide.farm[0] === null;
      window.__dt += 601000; P.potions = 0; const h2 = farmHarvest(1); o.pot = !!h2 && P.potions === 1 && P.mats.schleim >= 2;
      SAVE.meta.hide.b.garten = 10; o.lv10 = farmBeds() === 6 && farmSpeed() === 2; SAVE.meta.hide.b.garten = 1;
      farmPlant('flachs'); window.__dt += 700000;
      return o;
    }, [H]);
    await ev(() => openStation('garten')); await page.waitForTimeout(200);
    const ui = await ev(() => !!panel.querySelector('[data-act="fharv"]'));
    ok(r.ui && r.beds, 'Kräutergarten zeigt den Acker: Beete und Saatgut (gesperrt, was erst später wächst)');
    ok(r.plant && r.lock, 'Säen kostet Samen, nur in freie Beete, nur freigeschaltetes Saatgut');
    ok(r.notRipe && r.ripe1 && r.harv, 'wächst in Echtzeit (Uhr vorgestellt), Ernte: Fasern und Samen zurück');
    ok(r.pot, 'Heilkraut gibt Schleimkerne und einen Heiltrank');
    ok(r.lv10 && ui, 'Garten Stufe 10: 6 Beete, doppelt so schnell; reife Beete zeigen „Ernten“');
    await page.screenshot({ path: OUT + '/hoch-acker.png' });
  }

  console.log('Endlose Lande: Bäume, Felsen, Pflanzen');
  {
    await page.setViewportSize({ width: 844, height: 390 });
    const r = await ev(async ([H_, C]) => {
      eval('(' + H_ + ')')(14, 0); const CALM = eval('(' + C + ')'); lBegin(); CALM(); const o = {};
      const find = (kind, rad) => { let t = null, bd = 1e9; for (const x of lNear(P.x, P.y, rad || 900)) if (x.k === 'prop' && !x.gone && GPROP[x.t] === kind && x.r > 0) { const d = Math.hypot(x.x - P.x, x.y - P.y); if (d < bd) { bd = d; t = x; } } return t; };
      const t = find('baum'); if (!t) return { err: 'kein Baum' };
      const key = gKey(t); P.x = t.x + t.r + 6; P.y = t.y; P.vx = P.vy = 0; P.face = -1; lStream(true);
      const pouch = typeof landePouchAdd === 'function', m0 = JSON.stringify(P.mats);
      keys.KeyJ = true; for (let i = 0; i < 40 && !t.gone; i++) await new Promise(r => setTimeout(r, 100)); keys.KeyJ = false; CALM();
      const tr = gatherInfo().trip || {};
      o.tree = t.gone && !t.solid && LW.ts.get(key) === 1 && (tr.holz || 0) >= 2;
      o.pouch = pouch ? JSON.stringify(P.mats) === m0 : (P.mats.holz || 0) === tr.holz;
      // zurück und wieder hin (Chunks neu geladen): im selben Ausflug bleibt er gefällt
      const tx = t.x, ty = t.y; lTeleport(tx + 30 * LCK, ty); CALM(); lTeleport(tx + 14, ty); CALM();
      const t2 = lNear(tx, ty, 30).find(x => x.k === 'prop' && gKey(x) === key); o.stay = !!t2 && t2.gone && !t2.solid;
      // Felsen: Stein; Fernkampf trifft auch
      const rk = find('fels') || find('stein'); if (rk) { const n = gNeed(rk), s0 = (gatherInfo().trip || {}).stein || 0; for (let i = 0; i < n; i++) gatherProj(rk, { vx: 100, vy: 0 }); o.rock = rk.gone && ((gatherInfo().trip || {}).stein || 0) > s0; } else o.rock = true;
      // Vogelnest: Federn
      const t3 = find('baum'); if (t3) { t3.nest = true; const f0 = (gatherInfo().trip || {}).feder || 0; gatherProj(t3, { vx: 0, vy: 100 }); o.nest = !t3.nest && (gatherInfo().trip || {}).feder > f0; } else o.nest = true;
      o.tripGone = gatherInfo().tripGone >= 2;
      // neuer Ausflug: alles nachgewachsen
      lEnd(); lBegin(); CALM(); lTeleport(tx + 14, ty); CALM();
      const t4 = lNear(tx, ty, 30).find(x => x.k === 'prop' && gKey(x) === key); o.regrow = !!t4 && !t4.gone && t4.solid && !(gatherInfo().trip || {}).holz;
      // tiefer = besser: Eisenholz/Sternholz, Marmor/Obsidian je nach Felsfarbe
      const deep = { x: LOFF + 2600 * LCK, y: LOFF + 384, t: 'eiche', v: 0, k: 'prop' }, near = { x: LOFF + 384, y: LOFF + 300, t: 'eiche', v: 0, k: 'prop' };
      const sum = (ob, kind, n) => { const s = {}; for (let i = 0; i < n; i++) { const g = gatherYield(ob, kind); for (const k in g) s[k] = (s[k] || 0) + g[k]; } return s; };
      const sN = sum(near, 'baum', 300), sD = sum(deep, 'baum', 300);
      o.depth = !sN.sternholz && (sN.eisenholz || 0) < 20 && sD.eisenholz > 60 && sD.holz > sN.holz;
      const ob = sum({ x: LOFF + 384, y: LOFF + 300, t: 'fels', v: 2, k: 'prop' }, 'fels', 200), mr = sum({ x: LOFF + 384, y: LOFF + 300, t: 'fels', v: 6, k: 'prop' }, 'fels', 200), plain = sum({ x: LOFF + 384, y: LOFF + 300, t: 'fels', v: 0, k: 'prop' }, 'fels', 200);
      o.rocks = ob.obsidian > 50 && mr.marmor > 50 && !plain.obsidian && plain.stein > 500;
      o.plants = gatherYield({ x: LOFF + 384, y: LOFF + 300, t: 'busch', v: 0 }, 'busch').faser > 0 && !!GPROP.pilz && !!GPROP.kaktus && !!GPROP.obs && !!GPROP.saeule;
      return o;
    }, [H, C_]);
    if (r.err) ok(false, r.err);
    ok(r.tree, 'Baum mit Angriffen gefällt: Holz (gatherInfo zählt den Ausflug)');
    ok(r.pouch, 'Gesammeltes geht über landePouchAdd in den Beutel (ohne Taschen & Vögel: in den Vorrat)');
    ok(r.stay && r.tripGone, 'im selben Ausflug bleibt gefällt gefällt – auch wenn die Gegend neu geladen wird');
    ok(r.rock, 'Felsen: Stein, auch mit Pfeilen/Zaubern abbaubar');
    ok(r.nest, 'Vogelnest im Baum: Federn');
    ok(r.regrow, 'nächster Ausflug: alles nachgewachsen (die Welt ist für alle gleich)');
    ok(r.depth, 'tiefer in den Landen: mehr Holz und Eisenholz, am Tor kein Sternholz');
    ok(r.rocks && r.plants, 'Felsfarbe bestimmt Marmor/Obsidian; Büsche, Pilze, Kakteen geben Fasern; Obsidian-Spitzen und Säulen abbaubar');
  }

  console.log('Bildschirmfotos');
  for (const [W, Hh, tag, pc] of [[390, 844, 'hoch', false], [844, 390, 'quer', false], [1920, 1080, 'pc', true]]) {
    const c2 = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: pc ? 1 : 2, isMobile: !pc, hasTouch: !pc, locale: 'de-DE' });
    await c2.addInitScript(CLOCK);
    const p = await c2.newPage(); p.on('pageerror', e => errs.push(tag + ': ' + e.message));
    await p.goto(BASE + 'index.html'); await p.waitForTimeout(1300);
    const shot = async (name, fn, wait) => { if (fn) await p.evaluate(fn); await p.waitForTimeout(wait || 400); await p.screenshot({ path: `${OUT}/${tag}-${name}.png` }); };
    await p.evaluate(([H_]) => { eval('(' + H_ + ')')(24, 60); SAVE.meta.hide.b = { schmiede: 3, alchemie: 4, juwelier: 2, lager: 6, training: 5, tempel: 2, bibliothek: 2, mine: 3, garten: 4, sattler: 2, voliere: 5 }; SAVE.meta.hide.rooms = 9; doBuild('sattler'); window.__dt += 3000; P.fate = 3; }, [H]);
    const vis = await p.evaluate(() => {
      enterHideout(); const s = obs.find(o => o.k === 'station' && o.id === 'sattler'); P.x = s.x + 30; P.y = s.y + 26;
      if (!isTouch) return true;
      // im Hochformat: keine neue Station unter den Touch-Knöpfen, wenn der Held davor steht
      const hit = id => { const o = obs.find(x => x.k === 'station' && x.id === id); P.x = o.x; P.y = o.y + 20; camera(5); const sx = (o.x - cam.x) * SCALE, sy = (o.y - 20 - cam.y) * SCALE; return [...document.querySelectorAll('#touch .tb, #touch button, #bAtk')].filter(el => el.offsetParent).some(el => { const r = el.getBoundingClientRect(); return sx > r.left && sx < r.right && sy > r.top && sy < r.bottom; }); };
      const bad = ['sattler', 'voliere'].filter(hit); const s2 = obs.find(o => o.k === 'station' && o.id === 'sattler'); P.x = s2.x + 30; P.y = s2.y + 26; return bad.length ? bad : true;
    });
    if (tag === 'hoch') ok(vis === true, 'Hochformat: Sattlerei und Vogelhaus nicht unter den Touch-Knöpfen' + (vis === true ? '' : ' ' + JSON.stringify(vis)));
    await shot('versteck-baustelle', null, 1500);
    await shot('versteck-vogelhaus', () => { const s = obs.find(o => o.k === 'station' && o.id === 'voliere'); P.x = s.x - 20; P.y = s.y + 30; }, 900);
    await shot('holzplatz', () => { const t = obs.find(o => o.k === 'gat' && o.id === 'b2'); P.x = t.x + 11; P.y = t.y + 2; P.face = -1; for (const e of enemies) e.dead = true; keys.KeyJ = true; setTimeout(() => { keys.KeyJ = false; }, 1500); }, 1700);
    await shot('baustelle', () => openStation('sattler'), 500);
    await p.evaluate(() => { panel.scrollTop = 9999; }); await p.waitForTimeout(200); await p.screenshot({ path: `${OUT}/${tag}-baustelle-unten.png` });
    await shot('lagerfeuer', () => openStation('feuer'), 500);
    await shot('acker', () => { P.mats.samen = 20; farmPlant('flachs'); farmPlant('setzling'); farmPlant('heilkraut'); window.__dt += 650000; openStation('garten'); panel.scrollTop = 300; }, 500);
    await shot('vorrat', () => { backToHide(); openChar('vorrat'); }, 500);
    await shot('lande', () => {
      hideOverlay(); lBegin(); LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; P.inv = 1e9;
      let t = null, bd = 1e9; for (const x of lNear(P.x, P.y, 900)) if (x.k === 'prop' && GPROP[x.t] === 'baum' && x.r > 0) { const d = Math.hypot(x.x - P.x, x.y - P.y); if (d < bd) { bd = d; t = x; } }
      if (t) { P.x = t.x + t.r + 6; P.y = t.y; lStream(true); for (let i = 0; i < gNeed(t); i++) gatherProj(t, { vx: -100, vy: 0 }); }
    }, 350);
    await c2.close();
  }

  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
