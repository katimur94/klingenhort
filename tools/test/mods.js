// Gegenstände modifizieren (6.1): Mod-Plätze, Mods, Glyphen im Kampf, Resonanzen, Umschmieden/Veredeln/Extrahieren, Beute, Basar, alte Spielstände.
// Aufruf: node mods.js [ausgabeordner]   (BASE = lokale Version, Standard http://localhost:8777/)
// Prüft Plätze nach Seltenheit, Einsetzen/Herausnehmen, die Rechnung von Umschmieden/Veredeln/Extrahieren, dass jede Glyphe und
// jede Resonanz im Kampf auslöst (ohne Fehler, mit Abklingzeit, ohne Endlosschleife), Kampagnen-Beute, Weltbeute-Schnittstelle,
// Basar, alte und kaputte Spielstände, Speichergröße – und die Werkbank hoch und quer (Antippen, Fotos, nichts abgeschnitten).
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const OUT = process.argv[2] || '/tmp/klingenhort-test/mods';
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  /* ---------- Regeln ---------- */
  {
    const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
    console.log('Mods: Regeln');
    const r = await page.evaluate(() => { const o = {}; try {
      const c = newChar('ranger', 'Test', 'normal', false); SAVE.chars.push(c); activateChar(0); P.lv = 30; P.gold = 1e7; for (const k of MATORDER) P.mats[k] = 999; computeStats();
      o.meta = SAVE.meta.mods && SAVE.meta.mods.found === 0 && !Object.keys(SAVE.meta.mods.book).length && P.mods && !Object.keys(P.mods).length;
      // Plätze nach Seltenheit, Meisterwerk +1
      o.slots = [0, 1, 2, 3, 4, 5, 6].map(r => modSlots({ rar: r })).join(',') + '|' + modSlots({ rar: 4, mw: {} });
      o.kinds = MOD_KINDS.length; o.fams = MOD_FAMS.map(f => MOD_KINDS.filter(k => MODK[k].f === f).length).join(',');
      o.names = MOD_KINDS.every(k => modName(k + ':3').length > 3 && modDesc(k + ':3').length > 5 && modIconURL(k + ':3').startsWith('data:image'));
      o.reso = RESO.length; o.resoIds = new Set(RESO.map(R => R.id)).size === RESO.length;
      o.resoTxt = RESO.every(R => R.n && R.h && R.d(5).length > 8 && !/\{|\}/.test(R.d(5) + R.h));
      // Schlüssel prüfen
      o.valid = ['rune_kraft:1', 'glyphe_kette:10', 'essenz_licht:4', 'kern_zorn:7', 'praeg_stern:2', 'aff_wucht:8', 'aff_leben:1'].every(modValid);
      o.invalid = ['rune_kraft:0', 'rune_kraft:11', 'aff_wucht:9', 'glyphe_quatsch:3', '__proto__', 'aff_constructor:2', 'rune_toString:1', 'kern:3', 5, null, 'x'.repeat(30)].every(k => !modValid(k));
      // Einsetzen, gleiche Art nur einmal, nur eine Essenz, Plätze voll, Herausnehmen kostet Gold, Mod kommt zurück
      P.mods = { 'rune_kraft:3': 2, 'glyphe_kette:2': 1, 'essenz_feuer:2': 1, 'essenz_frost:5': 1, 'praeg_gold:1': 1, 'kern_salve:4': 1 };
      const w = makeItem({ slot: 'weapon', base: 'bow', tier: 2, rar: 2 }); w.el = 'gift'; P.bag.push(w);
      o.in1 = modInsert(w, 'rune_kraft:3') === '' && P.mods['rune_kraft:3'] === 1;
      o.same = modInsert(w, 'rune_kraft:3') !== '' && modsOf(w).length === 1;
      o.ess = modInsert(w, 'essenz_feuer:2') === '' && w.el === 'feuer' && w.el0 === 'gift';
      o.full = modInsert(w, 'glyphe_kette:2') !== '' && modsOf(w).length === 2;
      w.rar = 3; o.ess2 = modInsert(w, 'essenz_frost:5') !== '' && modsOf(w).length === 2;
      const g0 = P.gold, cost = modRemoveCost('essenz_feuer:2'); o.out = modRemove(w, 1) === 'ok' && P.gold === g0 - cost && P.mods['essenz_feuer:2'] === 1 && w.el === 'gift' && !('el0' in w);
      o.costUp = modRemoveCost('glyphe_kette:10') > modRemoveCost('glyphe_kette:5') * 3;
      const g1 = P.gold; P.gold = 0; o.poor = modRemove(w, 0) === 'poor' && modsOf(w).length === 1; P.gold = g1;
      // Gegenstand verlässt den Helden: Mods zurück (Zerlegen, Verschmelzen, Verkaufen)
      const n0 = P.mods['rune_kraft:3'] || 0; salvage(w); o.salv = (P.mods['rune_kraft:3'] || 0) === n0 + 1;
      const a = makeItem({ slot: 'armor', base: 'armor', tier: 1, rar: 1 }), v = makeItem({ slot: 'armor', base: 'armor', tier: 1, rar: 1 }); modPut(v, 'praeg_gold:1'); P.bag.push(a, v);
      const pg = P.mods['praeg_gold:1'] || 0; fuseItems(a, v); o.fuse = (P.mods['praeg_gold:1'] || 0) === pg + 1;
      const s1 = makeItem({ slot: 'helm', base: 'helm', tier: 1, rar: 1 }); modPut(s1, 'kern_salve:4'); P.bag.push(s1); selItem = s1.uid; const ks = P.mods['kern_salve:4'] || 0; ON.sell(s1.uid); o.sell = (P.mods['kern_salve:4'] || 0) === ks + 1 && !P.bag.includes(s1);
      // Umschmieden: ein Wert, gleiche Stufe, an derselben Stelle, wird teurer
      const it = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 4 }); P.bag.push(it); const k0 = Object.keys(it.aff)[1], s0 = affStufe(it, k0), others = Object.keys(it.aff).filter(x => x !== k0);
      const c0 = affRerollCost(it), nk = affReroll(it, k0), c1 = affRerollCost(it);
      o.rr = !!nk && nk !== k0 && !(k0 in it.aff) && affStufe(it, nk) === s0 && others.every(x => x in it.aff) && Object.keys(it.aff).indexOf(nk) === 1 && it.rr === 1;
      o.rrCost = c1.gold > c0.gold; for (let i = 0; i < 12; i++) affReroll(it, Object.keys(it.aff)[0]); o.rrCost2 = affRerollCost(it).gold > c0.gold * 20 && !!affRerollCost(it).mats.stern;
      o.stufe = [1, 2, 3, 4, 5, 6].every(r => { const x = makeItem({ slot: 'armor', base: 'armor', tier: 1, rar: r }); return Object.keys(x.aff).every(k => affStufe(x, k) === (r === 5 ? 5 : r)); });
      // Veredeln: Stufe +1 bis zur Grenze der Seltenheit
      o.cap = [1, 2, 3, 4, 5, 6].map(r => affCap({ rar: r })).join(',') + '|' + affCap({ rar: 4, mw: {} });
      const rf = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 1 }), rk = Object.keys(rf.aff)[0], v1 = rf.aff[rk];
      o.ref = affRefine(rf, rk) === 'ok' && affStufe(rf, rk) === 2 && rf.aff[rk] > v1 && affRefine(rf, rk) === 'ok' && affStufe(rf, rk) === 3 && affRefine(rf, rk) === 'max';
      o.refCost = affRefineCost({ tier: 3, aff: { wucht: AFFW.wucht.f(7) }, slot: 'weapon' }, 'wucht').mats.aether > 0 && affRefineCost(rf, rk).gold > 0;
      const gp = P.gold; P.gold = 0; const rf2 = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 4 }); o.refPoor = affRefine(rf2, Object.keys(rf2.aff)[0]) === 'poor'; P.gold = gp;
      // Extrahieren: Gegenstand weg, Affix-Essenz mit der Stufe des Werts, Edelsteine und Mods zurück
      const ex = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 6, myth: 'klinge' }); ex.gems = ['rubin:2']; ex.sockets = 2; modPut(ex, 'glyphe_kette:2'); P.bag.push(ex);
      const xk = Object.keys(ex.aff)[0], gem0 = P.gems['rubin:2'] || 0, kk = P.mods['glyphe_kette:2'] || 0, ek = affExtract(ex, xk);
      o.ex = ek === 'aff_' + xk + ':6' && P.mods[ek] === 1 && !P.bag.includes(ex) && P.gems['rubin:2'] === gem0 + 1 && P.mods['glyphe_kette:2'] === kk + 1;
      // Affix-Essenz einsetzen: höchstens bis zur Grenze des Ziels, passt nur auf dieselbe Art
      const tg = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 1 }), tk = Object.keys(tg.aff)[0]; P.bag.push(tg);
      const er = affEssApply(tg, ek, tk); o.essCap = er === '' && affStufe(tg, xk) === 3 && (tk === xk || !(tk in tg.aff)) && !P.mods[ek];
      P.mods['aff_leben:4'] = 1; o.essSlot = affEssWhy(tg, 'aff_leben:4', xk) !== '';
      // Beute der Welt: Stufe nach Tiefe, Wert, Eintrag
      const avg = d => { let s = 0; for (let i = 0; i < 2000; i++) s += modParse(modRoll(d, 1)).t; return s / 2000; };
      o.depth = [avg(0), avg(.5), avg(1)];
      const R1 = mulberry(42), R2 = mulberry(42); o.det = [0, 1, 2, 3, 4].every(() => modRoll(.3, 1, R1) === modRoll(.3, 1, R2));
      o.val = modValue('glyphe_kette:10') > modValue('glyphe_kette:9') * 2 && modValue('rune_kraft:1') > 0 && modValue('aff_wucht:8') > modValue('aff_wucht:1');
      o.loot = lootValue({ t: 'mod', k: 'rune_kraft:3', n: 2 }) > 0 && lootValue({ t: 'mod', k: 'rune_kraft:3', n: 2 }) >= lootValue({ t: 'mod', k: 'rune_kraft:3', n: 1 }) * 1.9;
      o.junk = [{ t: 'mod', k: 'quatsch:1', n: 1 }, { t: 'mod', k: '__proto__', n: 2 }, { t: 'mod', k: 'rune_kraft:3', n: -1 }].every(e => lootValue(e) === 0);
      o.html = modLootHTML({ t: 'mod', k: 'glyphe_meteor:7', n: 3 }).includes('×3') && modLootHTML({ t: 'mod', k: 'kaputt', n: 1 }) === '';
      const pm = P.mods['kern_zorn:2'] || 0; o.give = modGive('kern_zorn:2', 2) && P.mods['kern_zorn:2'] === pm + 2 && !modGive('kaputt:1', 1);
      // Basar: Wert, Prüfung, Geben und Nehmen, Gegenstand mit Mods ist mehr wert und behält sie
      o.mkFix = !!mkFixE({ t: 'mod', k: 'rune_kraft:3', n: 2 }) && !mkFixE({ t: 'mod', k: 'nix:1', n: 1 });
      const tk2 = MK_HERO.take({ t: 'mod', k: 'kern_zorn:2', n: 1 }); o.mkTake = !!tk2 && P.mods['kern_zorn:2'] === pm + 1 && MK_HERO.give(tk2) === 'vorrat' && P.mods['kern_zorn:2'] === pm + 2;
      const iv = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 3 }), iv0 = itemValue(iv); modPut(iv, 'glyphe_meteor:8'); o.mkItem = itemValue(iv) > iv0 && (mkFixItem(JSON.parse(JSON.stringify(iv))).mods || []).join() === 'glyphe_meteor:8';
      o.mkName = mkName({ t: 'mod', k: 'rune_kraft:3', n: 2 }).includes('Rune der Kraft') && mkIcon({ t: 'mod', k: 'rune_kraft:3', n: 1 }).startsWith('data:');
      // Kampagne: seltene Beute über HOOK.loot (niedrige Stufen), erster Mod sicher vom ersten Elite/Boss
      G = { type: 'kampf', row: 3, lootMul: 1, kills: 0 }; P.act = 2; pickups = []; SAVE.meta.mods.found = 0;
      hook('loot', { t: 'goblin', def: EN.goblin, ai: 'melee', x: 0, y: 0, sc: 1, elite: true }, 1); o.first = pickups.filter(c => c.k === 'mod').length === 1;
      SAVE.meta.mods.found = 5; pickups = []; for (let i = 0; i < 4000; i++) hook('loot', { t: 'goblin', def: EN.goblin, ai: 'melee', x: 0, y: 0, sc: 1 }, 1);
      o.normal = pickups.filter(c => c.k === 'mod').length; pickups = [];
      for (let i = 0; i < 400; i++) hook('loot', { t: 'ogre', def: EN.ogre, ai: 'slam', x: 0, y: 0, sc: 1, boss: true }, 1);
      o.boss = pickups.filter(c => c.k === 'mod').length; o.campTier = Math.max(...pickups.filter(c => c.k === 'mod').map(c => modParse(c.mk).t));
      P.act = 20; pickups = []; for (let i = 0; i < 400; i++) hook('loot', { t: 'ogre', def: EN.ogre, ai: 'slam', x: 0, y: 0, sc: 1, boss: true }, 1); o.qualTier = Math.max(...pickups.filter(c => c.k === 'mod').map(c => modParse(c.mk).t)); P.act = 2;
      // Einsammeln: Bodenbeute → Vorrat
      P.x = (BD.x0 + BD.x1) / 2; P.y = (BD.y0 + BD.y1) / 2; pickups = []; modDrop(P.x, P.y, 'praeg_stern:2', 1); const ps = P.mods['praeg_stern:2'] || 0, st0 = state; state = 'play'; pickups[0].t = 1; updPickups(.016); state = st0; o.collect = (P.mods['praeg_stern:2'] || 0) === ps + 1 && !pickups.length;
      // Funde mit Mod drin (nur im Kampf)
      state = 'play'; let wm = 0; for (let i = 0; i < 3000; i++) if (modsOf(makeItem({ slot: 'weapon', base: 'bow', tier: 2, rar: 2 + (i % 3) })).length) wm++; state = 'title';
      let wm2 = 0; for (let i = 0; i < 500; i++) if (modsOf(makeItem({ slot: 'weapon', base: 'bow', tier: 2, rar: 3 })).length) wm2++;
      o.preMod = wm / 3000; o.preMenu = wm2; G = null;
      // Werte: Runen zählen zusammen, Glyphen/Kerne nur der stärkste, Kerne setzen Fähigkeits-Werte
      const W = () => { P.gear.weapon = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 4 }); P.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: 3, rar: 4 }); P.gear.helm = makeItem({ slot: 'helm', base: 'helm', tier: 3, rar: 4 }); for (const s of MOD_GEAR) { P.gear[s].gems = []; P.gear[s].sockets = 0; } };
      W(); computeStats(); const d0 = P.st.dmgMul, h0 = P.st.hp, a0 = mod('a1Count');
      modPut(P.gear.weapon, 'rune_kraft:10'); modPut(P.gear.armor, 'rune_kraft:10'); computeStats(); o.runeStack = Math.abs(P.st.dmgMul - d0 - .24) < 1e-6;
      modPut(P.gear.weapon, 'kern_salve:5'); modPut(P.gear.helm, 'kern_salve:9'); computeStats(); o.kern = mod('a1Count') - a0 === 3 && MODS.act.k.salve === 9;
      modPut(P.gear.helm, 'praeg_smaragd:10'); computeStats(); o.praeg = P.st.hp > h0 && MODS.act.pr.length === 1;
      // Kerne: Fähigkeiten der Klasse, sonst „wirkt nicht“
      o.kernTxt = kernDesc('sprung', 5).includes('wirkt nicht') && kernDesc('salve', 5).includes('Fächerschuss');
      // alte und kaputte Spielstände
      const old = JSON.parse(JSON.stringify(SAVE.chars[0])); delete old.mods; for (const s of MOD_GEAR) delete old.gear[s].mods;
      old.bag = [Object.assign(makeItem({ slot: 'weapon', base: 'bow', tier: 1, rar: 1 }), { mods: ['rune_kraft:3', 'glyphe_kette:2', 'rune_kraft:5', 'quatsch', 'essenz_feuer:2'] }), Object.assign(makeItem({ slot: 'armor', base: 'armor', tier: 1, rar: 3 }), { mods: 'kaputt', rr: -4 }), Object.assign(makeItem({ slot: 'helm', base: 'helm', tier: 1, rar: 2 }), { mods: ['essenz_frost:3', 'essenz_licht:3'], el: 'frost' })];
      old.mods = { 'rune_kraft:3': 2, 'kaputt:3': 4, 'glyphe_kette:99': 1, 'praeg_gold:2': -3, 'kern_zorn:4': 'x' };
      SAVE.chars.push(old); activateChar(SAVE.chars.length - 1);
      const [b1, b2, b3] = P.bag;
      o.oldClean = JSON.stringify(b1.mods) === '["rune_kraft:3"]' && !b2.mods && !('rr' in b2) && JSON.stringify(b3.mods) === '["essenz_frost:3"]' && b3.el === 'frost' && b3.el0 === null;
      o.oldBack = P.mods['glyphe_kette:2'] === 1 && P.mods['rune_kraft:3'] === 2 && P.mods['essenz_licht:3'] === 1 && !P.mods['kaputt:3'] && !P.mods['praeg_gold:2'] && !P.mods['kern_zorn:4'];
      const oh = JSON.parse(JSON.stringify(SAVE.chars[0])); delete oh.mods; oh.gear.weapon.mods = undefined; SAVE.chars.push(oh); activateChar(SAVE.chars.length - 1); o.oldHero = P.mods && !Object.keys(P.mods).length;
      const m = defaultMeta(); delete m.mods; o.oldMeta = !!fixMeta(m).mods.book; const m2 = defaultMeta(); m2.mods = { book: { gewitter: 3, quatsch: 9, __proto__: 1 }, found: 'x' }; const f2 = fixMeta(m2).mods; o.badMeta = f2.book.gewitter === 3 && !('quatsch' in f2.book) && f2.found === 0;
      // Speichergröße: voller Vorrat (alle Arten, alle Stufen) und 30 Gegenstände mit 5 Mods
      P.mods = {}; for (const k of MOD_KINDS) for (let t = 1; t <= 10; t++) P.mods[k + ':' + t] = 9999; for (const a in AFFW) for (let t = 1; t <= 8; t++) P.mods['aff_' + a + ':' + t] = 99; for (const a in AFFA) for (let t = 1; t <= 8; t++) P.mods['aff_' + a + ':' + t] = 99;
      P.bag = []; for (let i = 0; i < 30; i++) { const x = makeItem({ slot: 'weapon', base: 'bow', tier: 5, rar: 6, myth: 'klinge' }); x.mods = ['glyphe_kette:10', 'essenz_feuer:10', 'rune_kraft:10', 'kern_salve:10', 'praeg_stern:10']; x.rr = 20; P.bag.push(x); }
      saveChar(); o.saveKB = Math.round(JSON.stringify({ mods: P.mods }).length / 1024); o.bagModKB = Math.round(P.bag.reduce((s, x) => s + JSON.stringify({ mods: x.mods, rr: x.rr }).length, 0) / 1024); o.metaKB = JSON.stringify(SAVE.meta.mods).length;
    } catch (e) { o.err = e.stack; } return o; });
    if (r.err) console.log('  FAIL Ausnahme: ' + r.err.split('\n').slice(0, 3).join(' | '));
    ok(r.meta, 'neues Konto: Mod-Vorrat und Resonanz-Buch leer');
    ok(r.slots === '1,1,2,3,4,4,5|5', 'Mod-Plätze: Gewöhnlich 1, Magisch 1, Selten 2, Episch 3, Legendär/Set 4, Mythisch 5, Meisterwerk +1 (' + r.slots + ')');
    ok(r.kinds >= 35 && r.fams === '10,10,6,7,6', `${r.kinds} Mod-Arten in 5 Familien (${r.fams}), Stufen 1–10`);
    ok(r.names, 'jede Art hat Name, Wirkung und Bild');
    ok(r.reso >= 30 && r.resoIds && r.resoTxt, `${r.reso} Resonanzen mit Namen, Hinweis und Wirkung (keine Platzhalter übrig)`);
    ok(r.valid && r.invalid, 'Schlüssel: gültige erkannt, kaputte und gefährliche abgelehnt');
    ok(r.in1 && r.same && r.ess && r.full && r.ess2, 'Einsetzen: gleiche Art nur einmal, Essenz setzt das Element, Plätze voll, nur eine Essenz');
    ok(r.out && r.costUp && r.poor, 'Herausnehmen kostet Gold (steigt mit der Stufe), Mod zurück, Element wieder wie vorher; ohne Gold geht es nicht');
    ok(r.salv && r.fuse && r.sell, 'Zerlegen, Verschmelzen (Opfer) und Verkaufen: Mods kommen zurück in den Vorrat');
    ok(r.rr && r.rrCost && r.rrCost2, 'Umschmieden: ein Wert wird ein anderer, gleiche Stufe, gleiche Stelle; jedes Mal teurer (später mit Sternenstaub)');
    ok(r.stufe, 'Stufe der Zusatzwerte = Seltenheit (Magisch 1 … Mythisch 6)');
    ok(r.cap === '3,4,5,6,7,8|7', 'Veredeln-Grenze: Seltenheit + 2, Meisterwerk +1, höchstens 8 (' + r.cap + ')');
    ok(r.ref && r.refCost && r.refPoor, 'Veredeln: +1 Stufe bis zur Grenze, dann „max“; teure Stufen brauchen Ätherkristall; ohne Material nicht');
    ok(r.ex, 'Extrahieren: Gegenstand weg, Affix-Essenz mit Stufe 6 (Mythisch), Edelsteine und Mods zurück');
    ok(r.essCap && r.essSlot, 'Affix-Essenz: auf Magisch höchstens Stufe 3; Waffen-Essenz passt nicht als Rüstungswert');
    ok(r.depth[0] < 2 && r.depth[1] > 4.5 && r.depth[1] < 6.5 && r.depth[2] > 9, `modRoll: Stufe nach Tiefe (${r.depth.map(x => x.toFixed(1)).join(' / ')})`);
    ok(r.det, 'modRoll mit eigener Zufallsquelle ist wiederholbar (feste Welt)');
    ok(r.val && r.loot && r.junk && r.html && r.give, 'modValue, lootValue { t: mod }, modLootHTML und modGive (ungültig = 0 / leer / false)');
    ok(r.mkFix && r.mkTake && r.mkItem && r.mkName, 'Basar: Mods prüfen, nehmen, geben; Gegenstand mit Mod ist mehr wert und behält ihn');
    ok(r.first, 'erster Mod kommt sicher vom ersten Elite-Gegner');
    ok(r.normal > 2 && r.normal < 25, `Kampagne: normale Gegner selten (${r.normal} aus 4000)`);
    ok(r.boss > 100 && r.boss < 180 && r.campTier <= 3, `Bosse etwa jeder dritte (${r.boss} aus 400), niedrige Stufen (höchstens ${r.campTier})`);
    ok(r.qualTier <= 5, `Qual: höchstens Stufe 5 (${r.qualTier})`);
    ok(r.collect, 'Mod am Boden einsammeln → Vorrat');
    ok(r.preMod > .02 && r.preMod < .08 && r.preMenu === 0, `seltene Funde haben manchmal schon einen Mod (${(r.preMod * 100).toFixed(1)} %), Geschmiedetes/Gekauftes nie`);
    ok(r.runeStack && r.kern && r.praeg, 'Runen zählen zusammen, vom gleichen Kern nur der stärkste, Prägung gibt Wert und Leuchten');
    ok(r.kernTxt, 'Kerne zeigen, was sie bei deiner Klasse tun (oder dass sie nicht wirken)');
    ok(r.oldClean && r.oldBack, 'kaputte Mods an Gegenständen werden repariert, überzählige kommen in den Vorrat');
    ok(r.oldHero && r.oldMeta && r.badMeta, 'alte Helden ohne Mods und alte/kaputte Konten laden');
    ok(r.saveKB < 30 && r.bagModKB < 8 && r.metaKB < 1500, `Speicher: voller Vorrat ${r.saveKB} KB, 30 Gegenstände mit je 5 Mods ${r.bagModKB} KB, Konto ${r.metaKB} B`);
    ok(!errs.length, 'keine Fehler (Regeln)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }
  /* ---------- Kampf: jede Glyphe, jede Resonanz ---------- */
  {
    const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
    console.log('Mods: Kampf');
    await page.evaluate(() => {
      const c = newChar('ranger', 'Kampf', 'normal', false); c.lv = 30; c.act = 3; SAVE.chars.push(c); activateChar(0); P.map = genMap(3); P.map.pos = { r: 0, i: 0 };
      hideOverlay(); startRoom('kampf', 1); G.phase = 'done'; P.inv = 999;
      window.MT = {
        gear(spec) {
          const mkI = (slot, base) => { const it = makeItem({ slot, base, tier: 3, rar: 4 }); it.sockets = 0; it.gems = []; it.aff = {}; it.suf = null; delete it.el; return it; };   // ohne Zufallswerte
          P.gear.weapon = mkI('weapon', 'bow'); P.gear.armor = mkI('armor', 'armor'); P.gear.helm = mkI('helm', 'helm');
          if (spec.mw) P.gear.weapon.mw = { klinge: 3, griff: 3, kern: 3 };
          for (const [s, L] of [['weapon', spec.w], ['armor', spec.a], ['helm', spec.h]]) for (const k of L || []) modPut(P.gear[s], k);
          computeStats(); P.hp = P.st.hp; MODS.fired = {}; MODS.cd = {}; MODS.whirl = null; MODS.fields = []; MODS.q = []; allies = []; projs = []; traps = []; P.roll = 0; P.dash = null; P.leap = null; P.spin = 0; P.volley = 0; hitStop = 0;
        },
        foes(n, type) { for (const e of enemies) e.dead = true; enemies = []; const L = []; for (let i = 0; i < n; i++) { const e = spawnEnemy(type || 'goblin', { x: P.x + 26 + (i % 3) * 13, y: P.y + Math.floor(i / 3) * 11 - 8, instant: true }); e.st = 'move'; e.hp = e.maxHp = 1e6; e.atk = 1; e.elite = false; e.affixes = []; L.push(e); } return L; },
        lucky(fn) { const r = Math.random; Math.random = () => .001; try { return fn(); } finally { Math.random = r; } },
        hit(e, crit) { weaponHit(e, playerW(), .01, 1, 0, 0, !!crit); },
        kill(e) { e.hp = 1; hurtEnemy(e, 50, 1, 0, 0, false, true); }
      };
    });
    const run = async (name, fn, ms) => page.evaluate(async ([fn, ms]) => {
      try { const out = (0, eval)('(' + fn + ')')(); await new Promise(r => setTimeout(r, ms || 0)); return { fired: Object.assign({}, MODS.fired), res: Object.assign({}, MODS.act.res), out: typeof out === 'object' ? out : { v: out } }; } catch (e) { return { err: e.message }; }
    }, [fn.toString(), ms]);
    const G = {};
    // jede Glyphe
    G.kette = await run('kette', () => { MT.gear({ w: ['glyphe_kette:5'] }); const L = MT.foes(4); const hp = L[1].hp; MT.lucky(() => { for (let i = 0; i < 10; i++) MT.hit(L[0]); }); const once = MODS.fired.kette; T += 3; MT.lucky(() => MT.hit(L[0])); return { once, twice: MODS.fired.kette, dmg: L[1].hp < hp }; });
    G.frost = await run('frost', () => { MT.gear({ w: ['glyphe_frost:5'] }); const L = MT.foes(3); MT.lucky(() => MT.hit(L[0])); return { frozen: L.filter(e => e.freeze > 0).length }; });
    G.leben = await run('leben', () => { MT.gear({ w: ['glyphe_leben:5'] }); const L = MT.foes(2); P.hp = 10; MT.kill(L[0]); return { healed: P.hp > 10 }; });
    G.geist = await run('geist', () => { MT.gear({ w: ['glyphe_geist:5'] }); const L = MT.foes(4); MT.lucky(() => MT.kill(L[0])); return { spirits: allies.filter(a => a.mod).length }; }, 900);
    G.blut = await run('blut', () => { MT.gear({ w: ['glyphe_blut:5'] }); const L = MT.foes(2); MT.lucky(() => MT.hit(L[0])); window.MT.e = L[0]; window.MT.hp = L[0].hp; return { bleed: L[0].mbleed > T }; }, 700);
    G.blut.out.tick = await page.evaluate(() => MT.e.hp < MT.hp);
    G.explosion = await run('explosion', () => { MT.gear({ w: ['glyphe_explosion:5'] }); const L = MT.foes(6); const hp = L[1].hp; MT.lucky(() => { for (let i = 0; i < 6; i++) { L[i].hp = 1; MT.kill(L[i]); } }); return { n: MODS.fired.explosion, dmg: L.slice(1).some(e => e.dead || e.hp < hp) }; });
    G.meteor = await run('meteor', () => { MT.gear({ w: ['glyphe_meteor:5'] }); const L = MT.foes(3); window.MT.L = L; MT.lucky(() => MT.hit(L[0], true)); return { proj: projs.filter(p => p.k === 'meteor').length }; }, 1200);
    G.meteor.out.landed = await page.evaluate(() => !projs.some(p => p.k === 'meteor') && MT.L.some(e => e.hp < 1e6 - 1));
    G.schatten = await run('schatten', () => { MT.gear({ w: ['glyphe_schatten:5'] }); const L = MT.foes(1); const hp = L[0].hp; MT.lucky(() => MT.hit(L[0])); return { dmg: hp - L[0].hp }; });
    G.vergeltung = await run('vergeltung', () => { MT.gear({ a: ['glyphe_vergeltung:5'] }); const L = MT.foes(3); P.inv = 0; P.st.dodge = 0; hurtPlayer(5, L[0]); P.inv = 999; return { pushed: L.some(e => e.hp < 1e6) }; });
    G.wirbel = await run('wirbel', () => { MT.gear({ w: ['glyphe_wirbel:5'] }); const L = MT.foes(3); window.MT.L = L; MT.lucky(() => MT.hit(L[0], true)); return { on: !!MODS.whirl }; }, 600);
    G.wirbel.out.dmg = await page.evaluate(() => MT.L.filter(e => e.hp < 1e6 - 1).length);
    for (const k of Object.keys(G)) { const x = G[k]; ok(!x.err && x.fired && x.fired[k] > 0, `Glyphe ${k} löst im Kampf aus` + (x.err ? ': ' + x.err : '') + (x.out ? ' ' + JSON.stringify(x.out) : '')); }
    ok(G.kette.out && G.kette.out.once === 1 && G.kette.out.twice === 2 && G.kette.out.dmg, 'Abklingzeit: 10 Treffer im selben Moment = 1 Kettenblitz, nach der Abklingzeit wieder');
    ok(G.frost.out && G.frost.out.frozen >= 2 && G.geist.out.spirits === 1 && G.blut.out.tick && G.explosion.out.n === 1 && G.explosion.out.dmg && G.meteor.out.landed && G.schatten.out.dmg > 0 && G.vergeltung.out.pushed && G.wirbel.out.dmg > 0, 'Wirkung: Frost friert ein, Geist erscheint, Blutung tickt, eine Explosion trotz 6 Kills (keine Kettenreaktion ohne Ende), Meteor schlägt ein, Schattenklinge, Druckwelle, Wirbel');
    // jede Resonanz
    const R = {};
    const rs = async (id, fn, ms) => { R[id] = await run(id, fn, ms); };
    await rs('flammenregen', () => { MT.gear({ w: ['glyphe_meteor:5', 'essenz_feuer:5'] }); const L = MT.foes(3); MT.lucky(() => MT.hit(L[0], true)); return { n: projs.filter(p => p.k === 'meteor').length }; });
    await rs('frostfessel', () => { MT.gear({ w: ['glyphe_frost:5', 'essenz_frost:5'] }); const L = MT.foes(2); L[1].chill = 3; return { mul: hookVal('hit', 100, L[1], playerW(), false) }; });
    await rs('gewitter', () => { MT.gear({ w: ['glyphe_kette:5', 'essenz_blitz:5'] }); const L = MT.foes(6); MT.lucky(() => MT.hit(L[0])); return { cd: MODS.cd.g_kette - T }; });
    await rs('seelenernte', () => { MT.gear({ w: ['glyphe_leben:5', 'glyphe_geist:5'] }); const L = MT.foes(13); for (let i = 0; i < 13; i++) { MT.kill(L[i]); T += .5; } return {}; });
    await rs('blutmond', () => { MT.gear({ w: ['glyphe_blut:5', 'rune_zorn:5'] }); const L = MT.foes(2); MT.lucky(() => MT.hit(L[0])); P.hp = 10; T += 1; MT.hit(L[0], true); return { healed: P.hp > 10 }; });
    await rs('giftnebel', () => { MT.gear({ w: ['glyphe_explosion:5', 'essenz_gift:5'] }); const L = MT.foes(4); window.MT.L = L; MT.lucky(() => MT.kill(L[0])); return { field: MODS.fields.length }; }, 700);
    await rs('schattentanz', () => { MT.gear({ w: ['glyphe_schatten:5', 'rune_eile:5'] }); const cd0 = P.st.cd; const L = MT.foes(1); MT.lucky(() => MT.hit(L[0])); return { faster: P.st.cd < cd0 }; });
    await rs('lichtschild', () => { MT.gear({ a: ['essenz_licht:5', 'rune_stein:5'] }); MT.foes(1); return {}; }, 200);
    R.lichtschild = await run('lichtschild', () => { const sh = MODS.shield; const L = enemies; P.inv = 0; P.st.dodge = 0; const hp = P.hp; hurtPlayer(5, L[0]); P.inv = 999; return { sh, kept: P.hp >= hp - 1 }; });
    await rs('dornenhaut', () => { MT.gear({ a: ['glyphe_vergeltung:5', 'rune_stein:5'] }); const L = MT.foes(2); P.inv = 0; P.st.dodge = 0; hurtPlayer(50, L[0]); P.inv = 999; return {}; });
    await rs('sturmlauf', () => { MT.gear({ w: ['rune_wind:5', 'kern_sprung:5'] }); MT.foes(1); P.rollCd = 0; P.roll = 0; doRoll(); return {}; }, 200);
    R.sturmlauf.out.fast = await page.evaluate(() => MODS.runT > T && P.st.spd > CLASSES[P.cls].spd * 1.2);
    await rs('phoenixfunke', () => { MT.gear({ w: ['essenz_feuer:5', 'glyphe_leben:5'] }); const L = MT.foes(2); P.hp = P.st.hp * .35; P.inv = 0; P.st.dodge = 0; MODS.phxT = -999; hurtPlayer(P.st.hp * .4, L[0]); P.inv = 999; return { hp: P.hp / P.st.hp }; });
    await rs('eisenwacht', () => { MT.gear({}); const d0 = P.st.dr; MT.gear({ a: ['rune_stein:5', 'rune_leben:5'] }); return { dr: P.st.dr - d0 }; });
    await rs('arkaneflut', () => { MT.gear({ w: ['kern_fluss:5', 'rune_fokus:5'] }); MT.foes(3); for (let i = 0; i < 4; i++) { P.cds = [0, 0, 0]; P.res = 999; P.roll = 0; useSkill(0); } return {}; });
    await rs('kettenreaktion', () => { MT.gear({ w: ['glyphe_explosion:5', 'glyphe_kette:5'] }); const L = MT.foes(5); MT.lucky(() => MT.kill(L[0])); return {}; });
    await rs('geisterheer', () => { MT.gear({ w: ['glyphe_geist:5', 'kern_bund:5'] }); const L = MT.foes(8); for (let i = 0; i < 5; i++) { MT.lucky(() => MT.kill(L[i])); T += 5; } return { spirits: allies.filter(a => a.mod).length }; });
    await rs('klingensturm', () => { MT.gear({ w: ['glyphe_wirbel:5', 'rune_schaerfe:5'] }); const L = MT.foes(2); MT.lucky(() => MT.hit(L[0], true)); return { len: MODS.whirl ? MODS.whirl.end - T : 0 }; });
    await rs('zornesfeuer', () => { MT.gear({ w: ['kern_zorn:5', 'essenz_feuer:5'] }); MT.foes(3); P.rage = 100; doUlt(); return { field: MODS.fields.length }; });
    await rs('salvensturm', () => { MT.gear({ w: ['kern_salve:5', 'rune_eile:5'] }); MT.foes(2); const n = projs.length; P.cds = [0, 0, 0]; P.res = 999; useSkill(0); return { arrows: projs.length - n }; });
    await rs('bebenerde', () => { MT.gear({ w: ['kern_weite:5', 'kern_wucht:5'] }); MT.foes(3); P.cds = [0, 0, 0]; P.res = 999; traps = []; useSkill(1); return {}; }, 800);
    await rs('vampirkuss', () => { MT.gear({ w: ['glyphe_blut:5', 'essenz_schatten:5'] }); const L = MT.foes(1); MT.lucky(() => MT.hit(L[0])); P.hp = 10; MT.hit(L[0]); return { healed: P.hp > 10 }; });
    await rs('heiligeslicht', () => { MT.gear({ w: ['essenz_licht:5', 'glyphe_leben:5'] }); const L = MT.foes(3); MT.kill(L[0]); return {}; });
    await rs('frostpanzer', () => { MT.gear({ a: ['essenz_frost:5', 'rune_stein:5'] }); const L = MT.foes(1); P.inv = 0; P.st.dodge = 0; hurtPlayer(5, L[0]); P.inv = 999; return { chilled: L[0].chill > 0 }; });
    await rs('giftklinge', () => { MT.gear({ w: ['essenz_gift:5', 'glyphe_blut:5'] }); const L = MT.foes(1); MT.lucky(() => MT.hit(L[0])); return { poison: L[0].poison > 0 }; });
    await rs('schattenschleier', () => { MT.gear({ a: ['essenz_schatten:5', 'rune_wind:5'] }); MT.foes(1); P.rollCd = 0; P.roll = 0; P.stealth = 0; doRoll(); return {}; }, 200);
    await rs('funkenflug', () => { MT.gear({ w: ['essenz_blitz:5', 'rune_eile:5'] }); const L = MT.foes(4); MODS.ff = 0; for (let i = 0; i < 8; i++) MT.hit(L[0]); return {}; });
    await rs('waechterbund', () => { MT.gear({ a: ['rune_fokus:5', 'kern_bund:5'] }); MT.foes(1); P.hp = 10; P.cds = [0, 0, 0]; P.res = 999; useSkill(2); return { healed: P.hp > 10 }; });
    await rs('schmiedeharmonie', () => { MT.gear({ mw: 1 }); const d0 = P.st.dmgMul; MT.gear({ mw: 1, w: ['rune_schaerfe:5', 'glyphe_kette:5', 'kern_salve:5', 'praeg_glut:5'] }); return { more: P.st.dmgMul > d0 + .09 }; });
    await rs('dreiklang', () => { MT.gear({ w: ['glyphe_kette:4'], a: ['rune_kraft:4'], h: ['kern_fluss:4'] }); return {}; });
    await rs('elementarsturm', () => { MT.gear({ w: ['essenz_feuer:5'], a: ['essenz_frost:5'], h: ['essenz_gift:5'] }); const L = MT.foes(2); P.gear.weapon.rar = 1; const rr = Math.random; Math.random = () => .15; try { for (let i = 0; i < 20 && !MODS.fired.elementarsturm; i++) { T += .5; MT.hit(L[0]); } } finally { Math.random = rr; } return {}; });
    await rs('vollmond', () => { MT.gear({ w: ['praeg_nacht:3'], a: ['praeg_nacht:3'], h: ['praeg_nacht:3'] }); return { cd: P.st.critdmg }; });
    await rs('sternenstaub', () => { MT.gear({ w: ['praeg_stern:3'], a: ['praeg_stern:3'], h: ['praeg_stern:3'] }); return { xp: mod('xp') }; });
    await rs('gluecksritter', () => { MT.gear({ w: ['praeg_gold:3'], a: ['praeg_gold:3'], h: ['rune_glueck:3'] }); return { gold: P.st.gold }; });
    await rs('regenbogen', () => { MT.gear({ w: ['praeg_gold:2', 'praeg_glut:2'], a: ['praeg_eis:2', 'praeg_smaragd:2'], h: ['praeg_nacht:2'] }); return {}; });
    await rs('ahnenzorn', () => { MT.gear({ w: ['kern_salve:4'], a: ['kern_bund:4'], h: ['kern_fluss:4'] }); MT.foes(2); P.hp = 10; P.rage = 100; doUlt(); return { healed: P.hp > 10 }; });
    await rs('runenkreis', () => { MT.gear({ w: ['rune_kraft:5', 'rune_eile:5'], a: ['rune_leben:5', 'rune_stein:5'] }); const d0 = P.st.dmgMul; MT.gear({ w: ['rune_kraft:5', 'rune_eile:5'], a: ['rune_leben:5', 'rune_stein:5'], h: ['rune_heil:5', 'rune_wind:5'] }); return { boost: P.st.dmgMul - d0 > .005 }; });
    await rs('glyphenchor', () => { MT.gear({ w: ['glyphe_kette:5', 'glyphe_frost:5'], a: ['glyphe_vergeltung:5'], h: ['glyphe_leben:5'] }); return { cd: mCd('frost', 5) }; });
    const STAT = { eisenwacht: x => x.out.dr > .05, schmiedeharmonie: x => x.out.more && x.res.schmiedeharmonie === 5, dreiklang: () => true, vollmond: x => x.out.cd > 1.9, sternenstaub: x => x.out.xp > .1, gluecksritter: x => x.out.gold > .2, regenbogen: () => true, runenkreis: x => x.out.boost, glyphenchor: x => x.out.cd < 2.3 };
    const ids = await page.evaluate(() => RESO.map(R => R.id));
    for (const id of ids) {
      const x = R[id]; if (!x) { ok(false, `Resonanz ${id}: nicht geprüft`); continue; }
      const on = !x.err && x.res && x.res[id] > 0, fx = STAT[id] ? !x.err && STAT[id](x) : !x.err && x.fired && x.fired[id] > 0;
      ok(on && fx, `Resonanz ${id}: aktiv und wirkt` + (x.err ? ': ' + x.err : on && fx ? '' : ' ' + JSON.stringify({ res: x.res, fired: x.fired, out: x.out })));
    }
    ok(R.flammenregen.out.n === 3 && R.frostfessel.out.mul > 100 && R.gewitter.out.cd < 1 && R.blutmond.out.healed && R.lichtschild.out.sh > 0 && R.lichtschild.out.kept && R.sturmlauf.out.fast && R.phoenixfunke.out.hp > .3 && R.geisterheer.out.spirits >= 3 && R.klingensturm.out.len > 2.5 && R.zornesfeuer.out.field === 1 && R.salvensturm.out.arrows >= 9 && R.vampirkuss.out.healed && R.frostpanzer.out.chilled && R.giftklinge.out.poison && R.waechterbund.out.healed && R.ahnenzorn.out.healed,
      'Resonanz-Wirkungen im Einzelnen: 3 Meteore, Bonus auf Gekühlte, Kette lädt schneller, Heilung, Lichtschild schluckt den Treffer, Tempo, Phönix rettet, 4 Geister, längerer Wirbel, Feuerkreis, mehr Pfeile, Kühlen, Gift'
      + ' ' + JSON.stringify(['flammenregen', 'frostfessel', 'gewitter', 'blutmond', 'lichtschild', 'sturmlauf', 'phoenixfunke', 'geisterheer', 'klingensturm', 'zornesfeuer', 'salvensturm', 'vampirkuss', 'frostpanzer', 'giftklinge', 'waechterbund', 'ahnenzorn'].map(k => [k, R[k].out])));
    const book = await page.evaluate(() => Object.keys(SAVE.meta.mods.book).length);
    ok(book === ids.length, `Resonanz-Buch: alle ${ids.length} beim ersten Mal entdeckt (${book})`);
    // Kerne bei anderen Klassen: Sprungkern kürzt die Abklingzeit des Sturmangriffs
    const kn = await page.evaluate(async () => { P.cls = 'knight'; P.gear.weapon = makeItem({ slot: 'weapon', base: 'sword', tier: 3, rar: 4 }); MT.gear({}); P.gear.weapon = makeItem({ slot: 'weapon', base: 'sword', tier: 3, rar: 4 }); modPut(P.gear.weapon, 'kern_sprung:10'); computeStats(); MT.foes(2); P.cds = [0, 0, 0]; P.res = 999; P.dash = null; useSkill(0); const full = skillCd(0); await new Promise(r => setTimeout(r, 120)); return { cut: P.cds[0] < full * .7, fired: MODS.fired.kern_sprung }; });
    ok(kn.cut && kn.fired, 'Sprungkern (Ritter): Sturmangriff lädt 40 % schneller');
    // Dauerfeuer: alle Glyphen zusammen, 3 s echter Kampf mit vielen Gegnern – keine Fehler, kein Hänger
    const t0 = Date.now();
    const st = await page.evaluate(async () => {
      P.cls = 'ranger'; MT.gear({ w: ['glyphe_kette:10', 'glyphe_explosion:10', 'glyphe_meteor:10', 'glyphe_wirbel:10', 'essenz_feuer:10'], a: ['glyphe_frost:10', 'glyphe_blut:10', 'glyphe_vergeltung:10', 'glyphe_geist:10'], h: ['glyphe_leben:10', 'glyphe_schatten:10', 'kern_bund:10', 'praeg_glut:10'] });
      const L = MT.foes(24); for (const e of L) e.hp = e.maxHp = 400; let hits = 0;
      for (let k = 0; k < 30; k++) { for (const e of L) if (!e.dead) { weaponHit(e, playerW(), .5, 1, 0, 0, k % 3 === 0); hits++; } await new Promise(r => setTimeout(r, 100)); }
      return { hits, dead: L.filter(e => e.dead).length, fired: Object.keys(MODS.fired).length };
    });
    ok(st.dead > 10 && st.fired >= 8 && Date.now() - t0 < 15000, `Dauerfeuer mit allen 10 Glyphen und 24 Gegnern: ${st.dead} besiegt, ${st.fired} Effektarten, ohne Fehler`);
    ok(!errs.length, 'keine Fehler (Kampf)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }
  /* ---------- Antippen und Fotos: hoch und quer ---------- */
  for (const [W, H] of [[390, 844], [844, 390]]) {
    console.log(`Mods antippen ${W}x${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
    const dir = `${OUT}/${W}x${H}`; fs.mkdirSync(dir, { recursive: true });
    const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: `${dir}/${name}.png` }); };
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); try { await el.tap({ timeout: 4000 }); } catch (e) { throw new Error('Antippen ging nicht: ' + sel); } await page.waitForTimeout(200); };
    const has = sel => page.evaluate(s => [...$('panel').querySelectorAll(s)].some(e => e.offsetParent), sel);
    const noSide = async () => page.evaluate(() => { const p = $('panel'); return p.scrollWidth <= p.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; });
    const clipped = async () => page.evaluate(() => { const p = $('panel').getBoundingClientRect(); return [...$('panel').querySelectorAll('.btn,.opt,.row,.slot,.wbchip,.mslot,.mfam,.afrow')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.left < p.left - 1 || r.right > p.right + 1); }).length; });
    const smallTargets = async () => page.evaluate(() => [...$('panel').querySelectorAll('[data-act^="mod_"],[data-act^="af_"],[data-act="wb_act"]')].filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width && (r.height < 37 || r.width < 37); }).map(e => e.dataset.act + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)));
    const look = async name => { ok(await noSide(), name + ': nichts ragt zur Seite heraus'); ok((await clipped()) === 0, name + ': keine Knöpfe abgeschnitten'); const st = await smallTargets(); ok(!st.length, name + ': Tippziele groß genug' + (st.length ? ' – ' + st.slice(0, 4).join(', ') : '')); };
    await page.evaluate(() => {
      const c = newChar('ranger', 'Mira', 'normal', false); c.lv = 30; c.act = 4; c.maxAct = 4; SAVE.chars.push(c); activateChar(0);
      P.gold = 99999; for (const k of MATORDER) P.mats[k] = 40;
      P.mods = { 'glyphe_kette:4': 2, 'essenz_blitz:3': 1, 'rune_kraft:2': 4, 'rune_eile:5': 1, 'kern_salve:3': 1, 'praeg_gold:2': 1, 'glyphe_meteor:6': 1, 'praeg_stern:1': 3, 'aff_leben:4': 1 }; for (const a in AFFW) P.mods['aff_' + a + ':3'] = 1;
      SAVE.meta.mods.found = 12;
      P.gear.weapon = makeItem({ slot: 'weapon', base: 'bow', tier: 3, rar: 4 }); P.gear.weapon.sockets = 1;
      P.bag = []; for (let i = 0; i < 6; i++) P.bag.push(makeItem({ slot: i % 2 ? 'armor' : 'weapon', base: i % 2 ? 'armor' : 'bow', tier: 2, rar: 2 + i % 3 }));
      computeStats(); saveChar(); persist();
      selItem = P.gear.weapon.uid; wbTab = 'ver'; WB.act = 'mods'; openWorkbench('node');
    });
    ok(await page.evaluate(() => [...$('panel').querySelectorAll('.wbah')].map(x => x.dataset.id).join()) === 'up,mods,fuse,sock,reroll,refine', 'Verbessern (angelegte Waffe): Aufwerten, Mods, Verschmelzen, Sockel, Umschmieden, Veredeln');
    ok(await has('.wbact.open .mslots') && await has('.wbact.open [data-act="mod_pick"]'), 'MODS offen: Plätze und passende Mods aus dem Vorrat');
    await shot('01_mods');
    await look('Mods');
    await tap('[data-act="wb_help"][data-id="mods"]'); ok(await has('.wbhelp'), '„?“ erklärt Mods'); await tap('[data-act="wb_help"][data-id="mods"]');
    if (await has('[data-act="mod_fam"][data-id="glyphe"]')) { await tap('[data-act="mod_fam"][data-id="glyphe"]'); ok(await page.evaluate(() => [...$('panel').querySelectorAll('[data-act="mod_pick"]')].every(x => x.dataset.id.startsWith('glyphe'))), 'Familie wählen zeigt nur Glyphen'); }
    await tap('[data-act="mod_pick"][data-id="glyphe_kette:4"]');
    ok(await has('.wbact.open .wbcmp li.up'), 'Vorschau: neue Zeile grün');
    await tap('[data-act="mod_in"]');
    ok(await page.evaluate(() => modsOf(P.gear.weapon).join() === 'glyphe_kette:4' && P.mods['glyphe_kette:4'] === 1), 'Kettenglyphe eingesetzt');
    await tap('[data-act="mod_fam"][data-id=""]').catch(() => { });
    await tap('[data-act="mod_pick"][data-id="essenz_blitz:3"]');
    ok(await has('.mresn'), 'Vorschau kündigt eine unbekannte Resonanz an');
    await shot('02_mods_resonanz');
    await tap('[data-act="mod_in"]');
    ok(await page.evaluate(() => P.gear.weapon.el === 'blitz' && !!SAVE.meta.mods.book.gewitter && MODS.act.res.gewitter > 0), 'Blitzessenz: Waffe wird Blitz, Resonanz Gewitterklinge entdeckt und aktiv');
    await tap('[data-act="mod_slot"][data-i="0"]');
    ok(await has('[data-act="mod_out"]'), 'Platz antippen zeigt Herausnehmen');
    await shot('03_mod_heraus');
    await tap('[data-act="mod_out"]');
    ok(await page.evaluate(() => modsOf(P.gear.weapon).join() === 'essenz_blitz:3' && P.mods['glyphe_kette:4'] === 2), 'herausgenommen: zurück im Vorrat');
    await tap('.wbact.open [data-act="mod_book"]');
    ok(await page.evaluate(() => (panel.querySelector('h2') || {}).textContent === 'RESONANZ-BUCH' && panel.querySelectorAll('.mres').length >= 30 && panel.querySelectorAll('.mres.unk').length === panel.querySelectorAll('.mres').length - 1), 'Resonanz-Buch: alle Einträge, unentdeckte mit Hinweis');
    await shot('04_buch');
    await look('Resonanz-Buch');
    await tap('[data-act="mod_bookx"]'); ok(await page.evaluate(() => wbTab === 'ver' && WB.act === 'mods'), 'Zurück zur Werkbank');
    // Umschmieden: Wert wählen, zufällig neu; Affix-Essenz einsetzen
    await tap('[data-act="wb_act"][data-id="reroll"]');
    ok(await has('.afrow') && await has('[data-act="af_rr"]'), 'Umschmieden: Zusatzwerte zum Antippen');
    await tap('.afrow:nth-child(2)');
    const k2 = await page.evaluate(() => mUI(P.gear.weapon).aff), g0 = await page.evaluate(() => P.gold);
    await shot('05_umschmieden');
    await look('Umschmieden');
    await tap('[data-act="af_rr"]');
    ok(await page.evaluate(([k2, g0]) => !(k2 in P.gear.weapon.aff) && P.gear.weapon.rr === 1 && P.gold < g0, [k2, g0]), 'umgeschmiedet: Wert getauscht, Gold bezahlt');
    // eine Essenz, deren Wert die Waffe noch nicht hat
    const ea = await page.evaluate(() => Object.keys(AFFW).find(a => !(a in P.gear.weapon.aff)));
    ok(await has(`[data-act="af_ess"][data-id="aff_${ea}:3"]`), 'Affix-Essenzen für Waffen werden angeboten');
    await tap(`[data-act="af_ess"][data-id="aff_${ea}:3"]`);
    await tap('[data-act="af_put"]');
    ok(await page.evaluate(ea => ea in P.gear.weapon.aff && !P.mods['aff_' + ea + ':3'] && affStufe(P.gear.weapon, ea) === 3, ea), 'Affix-Essenz eingesetzt: neuer Wert auf der Waffe, Stufe 3');
    // Veredeln
    await tap('[data-act="wb_act"][data-id="refine"]');
    const rk = await page.evaluate(() => { const w = P.gear.weapon, k = mUI(w).aff; return [k, affStufe(w, k)]; });
    await shot('06_veredeln');
    await look('Veredeln');
    await tap('[data-act="af_ref"]');
    ok(await page.evaluate(([k, s]) => affStufe(P.gear.weapon, k) === s + 1, rk), 'veredelt: Stufe +1');
    // Extrahieren (Gegenstand im Beutel)
    if (W < 600) await tap('[data-act="wb_bag"]');
    await tap('.wbbag [data-act="wsel"]');
    await tap('[data-act="wb_act"][data-id="extract"]');
    const nb = await page.evaluate(() => P.bag.length);
    await tap('[data-act="af_ex"]'); ok(await page.evaluate(nb => P.bag.length === nb, nb) && await has('[data-act="af_ex"].red'), 'Extrahieren fragt erst nach');
    await shot('07_extrahieren');
    await tap('[data-act="af_ex"]');
    ok(await page.evaluate(nb => P.bag.length === nb - 1 && Object.keys(P.mods).some(k => k.startsWith('aff_') && P.mods[k] > 0), nb), 'extrahiert: Gegenstand weg, Affix-Essenz im Vorrat');
    // Schmiede im Versteck und Juwelier: Mods gibt es dort auch
    await page.evaluate(() => { SAVE.meta.hide.intro = true; SAVE.meta.hide.b.juwelier = 1; selItem = P.gear.weapon.uid; WB.act = 'mods'; wbTab = 'ver'; openWorkbench('jewel'); });
    ok(await has('.wbact.open .mslots') && !(await has('[data-act="wb_act"][data-id="reroll"]')), 'Juwelier: Mods einsetzen ja, Umschmieden nein');
    // Charakter: Reiter MODS, 3 → 1
    await page.evaluate(() => { selItem = null; openChar('mods', 'map'); });
    ok(await has('[data-act="mod_comb"]') && await has('[data-act="mod_book"]'), 'Charakter → MODS: Vorrat mit 3 → 1 und Resonanz-Buch');
    await shot('08_char_mods');
    await look('Charakter Mods');
    await tap('[data-act="mod_comb"][data-id="rune_kraft:2"]');
    ok(await page.evaluate(() => P.mods['rune_kraft:3'] === 1 && P.mods['rune_kraft:2'] === 1), '3 Runen der Kraft II → 1 Rune der Kraft III');
    // Gegenstand mit Mods in der Beschreibung
    await page.evaluate(() => { const it = P.gear.weapon; modPut(it, 'rune_eile:5'); computeStats(); selItem = it.uid; openChar('gear'); });
    ok(await page.evaluate(() => [...panel.querySelectorAll('.detail li')].some(l => l.textContent.startsWith('❖ Blitzessenz')) && [...panel.querySelectorAll('.detail li')].some(l => l.textContent.includes('freier Mod-Platz') || l.textContent.includes('freie Mod-Plätze'))), 'Beschreibung zeigt Mods und freie Plätze');
    await shot('09_detail');
    // Kampf: Glyphen und Prägungen sichtbar
    await page.evaluate(() => {
      hideOverlay(); P.map = genMap(4); P.map.pos = { r: 0, i: 0 }; startRoom('kampf', 1); G.phase = 'done'; P.inv = 999;
      const w = P.gear.weapon; w.mods = []; delete w.el0; for (const k of ['glyphe_kette:7', 'glyphe_meteor:7', 'praeg_gold:5']) modPut(w, k); P.gear.armor.mods = ['praeg_nacht:4']; P.gear.helm.mods = ['praeg_eis:4']; computeStats();
      for (let i = 0; i < 6; i++) { const e = spawnEnemy('goblin', { x: P.x + 40 + (i % 3) * 14, y: P.y + Math.floor(i / 3) * 14 - 6, instant: true }); e.st = 'move'; e.hp = e.maxHp = 1e5; }
      const r = Math.random; Math.random = () => .001; try { weaponHit(enemies[0], playerW(), .1, 1, 0, 0, true); } finally { Math.random = r; }
    });
    await page.waitForTimeout(350); await page.screenshot({ path: `${dir}/10_kampf.png` });
    ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log('  Fotos: ' + OUT);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
