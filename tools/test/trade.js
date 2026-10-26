// Tauschen & Aussehen (js/trade.js). Aufruf: node trade.js [breite] [höhe] [bildordner]
// Prüft: Codes (Prüfsumme, jedes Feld, Zufalls-Manipulation), einmal einlösbar, Bündel, Tauschhändlerin,
// Sammlung und Aussehen (Werte bleiben, Held zeigt den Look), alte Spielstände,
// Senden in einem Browser-Profil und Empfangen in einem zweiten (Link und eingefügter Code, Begleiter mit Ersatz-pets.js),
// manipulierte Codes in der Oberfläche, Antippen aller Tausch-Bildschirme auf einem Touch-Handy. Mit Bildordner: Fotos.
const { chromium } = require('playwright');
const fs = require('fs');
const [W, H, OUT] = [+process.argv[2] || 390, +process.argv[3] || 844, process.argv[4] || ''];
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
// Ersatz, falls js/pets.js fehlt (die echten Funktionen aus pets.js überschreiben ihn)
const PETS_MOCK = () => {
  window.petExport = i => { const p = SAVE.meta.pets.list[i]; return p ? JSON.parse(JSON.stringify(p)) : null; };
  window.petImport = d => { const L = SAVE.meta.pets.list; if (L.length >= 12) return false; L.push(Object.assign({}, d, { id: uid() })); persist(); return true; };
  window.eggGive = sp => { SAVE.meta.pets.eggs.push({ sp: sp || 'glutdrache', need: 150, got: 0 }); persist(); return true; };
};

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const mkCtx = async () => { const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: OUT ? 2 : 1, isMobile: true, hasTouch: true, locale: 'de-DE' }); await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE.replace(/\/$/, '') }).catch(() => { }); await c.addInitScript(PETS_MOCK); return c; };
  const ctxA = await mkCtx(), ctxB = await mkCtx();
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errs = [];
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', e => errs.push(n + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push(n + ' console: ' + m.text()); }); }
  const tapOn = p => async sel => { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await p.waitForTimeout(220); };
  const tapA = tapOn(A), tapB = tapOn(B);
  const h2 = p => p.evaluate(() => (panel.querySelector('h2') || {}).textContent);
  const shot = async (p, name) => { if (!OUT) return; await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${name}.png` }); };
  const noOverflow = p => p.evaluate(() => panel.scrollWidth <= panel.clientWidth + 1);
  const fresh = async p => { await p.goto(BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1400); };
  await fresh(A); await fresh(B);
  console.log(`Tauschen & Aussehen ${W}x${H}`);

  /* ---------- Regeln ---------- */
  const r = await A.evaluate(() => {
    const o = {};
    const c = newChar('knight', 'Alrik', 'normal', false); SAVE.chars.push(c); activateChar(0);
    SAVE.meta.pets = { list: [], act: null, eggs: [], starter: true, hatched: 0, first: true, intro: true };
    const sw = makeItem({ slot: 'weapon', base: 'sword', form: 'saebel', tier: 4, rar: 4 }); sw.up = 7; sw.fz = 2; sw.gems = ['rubin:2']; sw.sockets = Math.max(1, sw.sockets); sw.el = 'feuer'; sw.mw = { klinge: 5, griff: 3 };
    P.bag.push(sw); saveChar();
    // 1) Hin und zurück
    const code = trMake('i', trItemData(sw)), back = trParse(code), it = back.p && back.p.d;
    o.prefix = code.startsWith('KH5-'); o.round = !!it && ['slot', 'base', 'form', 'tier', 'rar', 'up', 'fz', 'name', 'el'].every(k => it[k] === sw[k]) && JSON.stringify(it.aff) === JSON.stringify(sw.aff) && JSON.stringify(it.gems) === JSON.stringify(sw.gems) && JSON.stringify(it.mw) === JSON.stringify(sw.mw) && it.uid !== sw.uid;
    o.link = trParse('Schau mal: ' + trLink(code) + ' viel Spaß!').p && trParse(code.slice(0, 40) + '\n  ' + code.slice(40)).p ? true : false;
    // Mods reisen mit (gültige, höchstens so viele wie Plätze), veredelte Werte bleiben erhalten
    if (typeof modFixItem === 'function') {
      const mi = makeItem({ slot: 'weapon', base: 'sword', tier: 5, rar: 3 }); mi.mods = ['glyphe_kette:3', 'rune_kraft:2']; mi.rr = 3; const ak = Object.keys(mi.aff)[0]; if (ak) mi.aff[ak] = AFFW[ak].f(8);
      const md = trParse(trMake('i', trItemData(mi))).p.d, got = trItem(md); const bad = trItem(Object.assign({}, md, { mods: ['glyphe_kette:3', 'unsinn:9', 'rune_kraft:2', 'rune_kraft:2', 'glyphe_frost:1', 'glyphe_frost:2'] }));
      o.mods = JSON.stringify(got.mods) === JSON.stringify(mi.mods) && got.rr === 3 && (!ak || Math.abs(got.aff[ak] - mi.aff[ak]) < .01) && bad.mods.length <= modSlots(bad) && !bad.mods.includes('unsinn:9');
      if (!o.mods) o.modsDbg = JSON.stringify({ got: got.mods, rr: got.rr, a: ak && [got.aff[ak], mi.aff[ak]], bad: bad.mods });
    } else o.mods = true;
    // 2) Prüfsumme: jede Änderung, Kürzung, Müll
    const body = code.slice(4, code.indexOf('.'));
    let sumBad = 0; for (let i = 0; i < 40; i++) { const k = 4 + Math.floor(Math.random() * body.length), ch = code[k] === 'A' ? 'B' : 'A', m = code.slice(0, k) + ch + code.slice(k + 1); if (trParse(m).err) sumBad++; }
    o.sum = sumBad === 40; o.cut = !!trParse(code.slice(0, code.length - 30)).err; o.junk = trParse('hallo welt').err === 'format' && trParse('').err === 'empty' && trParse(null).err === 'empty';
    // 3) manipuliert, aber mit passender Prüfsumme: jedes Feld wird geprüft
    const P0 = { v: 1, id: 'abcdef123456', t: 'i', n: 'Mallory', at: 1, d: trItemData(sw) }, enc = (f, base) => { const p = JSON.parse(JSON.stringify(base || P0)); f(p); return trParse(trEncode(p)); };
    o.badTier = !!enc(p => { p.d.tier = 99; }).err && !!enc(p => { p.d.tier = '3'; }).err && !!enc(p => { p.d.tier = 2.5; }).err;
    o.badBase = !!enc(p => { p.d.base = 'laser'; }).err && !!enc(p => { p.d.slot = 'ring'; }).err && !!enc(p => { p.d.base = '__proto__'; }).err;
    o.badHead = !!enc(p => { p.v = 2; }).err && !!enc(p => { p.id = '<b>x</b>'; }).err && !!enc(p => { p.t = 'x'; }).err && !!enc(p => { p.d = null; }).err && !!enc(p => { p.d = [1, 2]; }).err;
    const fx = enc(p => { p.d.up = 999; p.d.fz = 50; p.d.sockets = 9; p.d.gems = ['rubin:9', 'xyz:1', 'saphir:1', 'smaragd:0', 'topas:0']; p.d.aff = { krit: 999, laser: 5, __proto__x: 1, tempo: 'viel' }; p.d.name = '<img src=x onerror=alert(1)>'; p.d.rar = 6; p.d.form = 'kanone'; p.d.el = 'plasma'; p.d.mw = JSON.parse('{"a":1e12,"b":{"c":{"d":{"e":{"f":1}}}},"__proto__":{"evil":1}}'); p.n = '<script>x</script>Mallory\u0000'; });
    const fi = fx.p && fx.p.d;
    o.fixed = !!fi && fi.up === 0 && fi.fz === 0 && fi.sockets === 0 && fi.gems.length === 0 && fi.aff.krit <= AFFW.krit.f(typeof AFF_MAX === 'number' ? AFF_MAX : 6) && !('laser' in fi.aff) && !('tempo' in fi.aff) && fi.rar === 4 && !fi.myth && fi.name === null && fi.form === 'lang' && !fi.el && fi.mw.a === 100 && !({}).evil && !fx.p.n.includes('<');
    o.mythSet = (() => { const m = enc(p => { p.d.myth = 'zorn'; p.d.rar = 1; p.d.set = 'lion'; }).p.d, s = enc(p => { p.d.set = 'lion'; p.d.rar = 2; delete p.d.myth; }).p.d, x = enc(p => { p.d.rar = 5; delete p.d.set; }).p.d, h = enc(p => { p.d.myth = 'zorn'; p.d.slot = 'helm'; }).p.d; return m.rar === 6 && m.myth === 'zorn' && !m.set && m.name === MYTHIC.zorn.n && s.rar === 5 && s.name === SETS.lion.pieces.weapon && x.rar === 3 && !h.myth && h.rar !== 6; })();
    const PB0 = { v: 1, id: 'bbbbbb123456', t: 'b', n: 'X', at: 1, d: { m: { erz: 5 }, g: {}, p: {} } };
    o.badBun = !!enc(p => { p.d = { m: { erz: -5, gold: 99, leder: 1e9, kristall: 1.5 }, g: { 'rubin:7': 1, 'saphir:-1': 1 }, p: { 'x:99': 1, '__proto__:1': 1 } }; }, PB0).err;
    const okBun = enc(p => { p.d = { m: { erz: 5, laser: 3 }, g: { 'rubin:1': 2 }, p: { 'klinge:3': 1, 'kern:feuer:2': 1 } }; }, PB0).p;
    o.bun = !!okBun && okBun.d.m.erz === 5 && !okBun.d.m.laser && okBun.d.g['rubin:1'] === 2 && okBun.d.p['kern:feuer:2'] === 1;
    const pet = enc(p => { p.t = 'p'; p.d = { sp: 'glutdrache', nm: '<b>Fiep</b>', lv: 1e99, deep: { a: { b: { c: { d: { e: 1 } } } } }, list: Array(100).fill(1), constructor: 1 }; }).p;
    o.pet = !!pet && pet.d.lv === 1e9 && pet.d.list.length === 24 && !trHas(pet.d, 'constructor') && enc(p => { p.t = 'p'; p.d = { nm: 'ohne Art' }; }).err === 'data' && enc(p => { p.t = 'e'; p.d = { sp: 'x y' }; }).err === 'data';
    const nj = trB64e('kein json hier'), num = trB64e('12345678'); o.notJson = trParse('KH5-' + nj + '.' + trSum(nj)).err === 'data' && trParse('KH5-' + num + '.' + trSum(num)).err === 'data';
    // 4) Zufalls-Manipulation: nie ein Absturz, nie ein ungültiger Gegenstand
    const vals = [null, -1, 0, 1, 7, 99, 1e300, -1e300, 2.5, '', 'x', '__proto__', 'sword', 'weapon', 'helm', true, [], [1, 'a'], {}, { a: 1 }, 'rubin:1', 'lion', 'zorn', 'feuer', NaN];
    const keys = ['slot', 'base', 'tier', 'rar', 'up', 'aff', 'sockets', 'gems', 'set', 'name', 'suf', 'fz', 'form', 'myth', 'el', 'mw', 'extra'];
    let crash = 0, invalid = 0, accepted = 0;
    for (let i = 0; i < 600; i++) {
      try {
        const p = JSON.parse(JSON.stringify(P0)); for (let k = 0; k < 1 + (i % 4); k++) p.d[pick(keys)] = pick(vals);
        if (i % 7 === 0) p.t = pick(['i', 'b', 'p', 'e', 'z']); if (i % 11 === 0) p.n = pick(vals);
        const t = trEncode(p), res = i % 3 ? trParse(t) : trParse(t.slice(0, 4 + Math.floor(Math.random() * (t.length - 4))) + 'Q' + t.slice(4 + Math.floor(Math.random() * (t.length - 4))));
        if (res.p && res.p.t === 'i') {
          accepted++; const x = res.p.d;
          const valid = ['weapon', 'armor', 'helm'].includes(x.slot) && Number.isInteger(x.tier) && x.tier >= 0 && x.tier < TIERS && Number.isInteger(x.rar) && x.rar >= 0 && x.rar <= 6 && (x.rar === 6) === !!x.myth && (x.rar === 5) === !!x.set && Number.isInteger(x.up) && x.up <= 10 && x.gems.length <= x.sockets && (x.slot !== 'weapon' || (WT[x.base] && wform(x).id === x.form));
          if (!valid) invalid++;
          itemName(x); itemLines(x); itemDetail(x, ''); itemIconURL(x); itemScore(x); itemPrice(x);
        } else if (res.p) trDesc(res.p);
      } catch (e) { crash++; o.crashMsg = e.message; }
    }
    o.fuzz = crash === 0 && invalid === 0 && accepted > 50; o.fuzzInfo = `${accepted} angenommen, ${invalid} ungültig, ${crash} Abstürze`;
    // 5) einmal pro Code und Konto, eigener Code, voller Beutel
    o.own = trAccept(back.p) === 'own';
    SAVE.meta.trades.own = []; const n0 = P.bag.length; o.first = trAccept(back.p) === 'ok' && P.bag.length === n0 + 1; o.second = trAccept(back.p) === 'used' && P.bag.length === n0 + 1;
    const c2 = trParse(trMake('i', trItemData(sw))).p; SAVE.meta.trades.own = []; while (P.bag.length < 30) P.bag.push(makeItem({ slot: 'helm', tier: 0, rar: 0 }));
    o.full = trAccept(c2) === 'bag' && !SAVE.meta.trades.got.includes(c2.id); P.bag.length = 2;
    // 6) Bündel: Absender verliert, Empfänger bekommt
    P.mats = { erz: 10, leder: 4 }; P.gems = { 'rubin:1': 3 }; P.parts = { 'klinge:2': 2 };
    TRD.bun = { m: { erz: 6 }, g: { 'rubin:1': 3 }, p: { 'klinge:2': 1 } }; const bc = trSend({ t: 'b' }), bp = trParse(bc).p;
    o.bunSend = !!bc && P.mats.erz === 4 && P.gems['rubin:1'] === 0 && P.parts['klinge:2'] === 1;
    TRD.bun = { m: { erz: 99 }, g: {}, p: {} }; o.bunTooMuch = trSend({ t: 'b' }) === null && P.mats.erz === 4;
    SAVE.meta.trades.own = []; o.bunGet = trAccept(bp) === 'ok' && P.mats.erz === 10 && P.gems['rubin:1'] === 3 && P.parts['klinge:2'] === 2;
    // 7) Tauschhändlerin: gleiche Angebote am selben Tag, andere an anderen Tagen, jedes nur einmal
    P.maxAct = 3; const d1 = JSON.stringify(trDeals(20261025)), d1b = JSON.stringify(trDeals(20261025)); let diff = 0; for (let d = 20261026; d < 20261031; d++) if (JSON.stringify(trDeals(d)) !== d1) diff++;
    o.dealDay = d1 === d1b && diff >= 3 && trDeals(20261025).length === 3;
    P.gold = 1e6; P.fate = 100; for (const k of MATORDER) P.mats[k] = 999; for (const g of GEMORDER) for (let gr = 0; gr < 5; gr++) P.gems[g + ':' + gr] = 9; P.parts = { 'klinge:1': 9, 'klinge:2': 9 };
    const g0 = P.gold; o.dealOnce = trDealDo(0) === true && trDealDo(0) === false && trDealState().done.includes(0);
    SAVE.meta.trades.deal.d = 1; o.dealReset = trDealState().done.length === 0 && P.gold <= g0;
    // 8) Aussehen: Sammlung, Werte bleiben, Held zeigt den Look
    o.total = tmAll().length; o.keys = tmKeys(sw)[0] === 'w.sword.saebel.4' && tmKeys(makeItem({ slot: 'helm', tier: 2, rar: 6, myth: 'krone' })).includes('h.schein');
    P.gear.weapon = makeItem({ slot: 'weapon', base: 'sword', form: 'lang', tier: 1, rar: 2 }); P.gear.helm = makeItem({ slot: 'helm', tier: 3, rar: 4 }); computeStats();
    const st0 = JSON.stringify([P.st.wbase, P.st.def, P.st.hp, P.st.crit, P.st.cd]), pv0 = heroPreviewURL(P).url;
    o.noLook = tmApply('weapon', 'w.sword.zwei.7') === false && !P.gear.weapon.skin;
    SAVE.meta.looks['w.sword.zwei.7'] = 1; SAVE.meta.looks['h.0'] = 1; SAVE.meta.looks['h.schein'] = 1;
    o.apply = tmApply('weapon', 'w.sword.zwei.7') && visItem(P.gear.weapon).tier === 7 && visItem(P.gear.weapon).form === 'zwei' && P.gear.weapon.tier === 1 && wform(P.gear.weapon).id === 'lang';
    computeStats(); o.stats = JSON.stringify([P.st.wbase, P.st.def, P.st.hp, P.st.crit, P.st.cd]) === st0 && playerW().dmg > 0;
    o.preview = heroPreviewURL(P).url !== pv0 && weaponArt(visItem(P.gear.weapon)) !== weaponArt(P.gear.weapon);
    o.crown = ['crown', 'h:' + P.gear.helm.name].includes(headgearOf(P.gear.helm)) && tmApply('helm', 'h.0') && headgearOf(visItem(P.gear.helm)) !== 'crown' && tmApply('helm', 'h.schein') && headgearOf(visItem(P.gear.helm)) === 'halo';
    o.lines = itemLines(P.gear.weapon).some(l => l.includes(tmName('w.sword.zwei.7')));
    o.orig = tmApply('weapon', 'orig') && !P.gear.weapon.skin && visItem(P.gear.weapon) === P.gear.weapon;
    P.gear.armor.skin = { tier: 99, form: '<x>' }; o.badSkin = visItem(P.gear.armor).tier === P.gear.armor.tier; P.gear.armor.skin = { tier: 5 }; o.armorSkin = visItem(P.gear.armor).tier === 5 && heroSpec(P, { at: visItem(P.gear.armor).tier }).at === 5; delete P.gear.armor.skin;
    // Geschenk trägt kein fremdes Aussehen mit
    P.gear.weapon.skin = { tier: 7, form: 'zwei' }; o.noSkinTrade = !trParse(trEncode({ v: 1, id: 'cccccc123456', t: 'i', n: 'X', at: 1, d: trItemData(P.gear.weapon) })).p.d.skin; delete P.gear.weapon.skin;
    // Sammlerlohn
    const f0 = P.fate; SAVE.meta.lookRw = 0; for (const k of tmAll().slice(0, 12)) SAVE.meta.looks[k] = 1; ON.tm_rw(); o.reward = SAVE.meta.lookRw === 1 && P.fate === f0 + 1;
    saveChar(); hideOverlay();
    return o;
  });
  ok(r.prefix && r.round, 'Tauschcode KH5-…: Gegenstand kommt mit allen Werten an (neue uid)');
  ok(r.mods, 'Tausch: Mods und veredelte Werte reisen mit dem Gegenstand, ungültige fliegen raus' + (r.mods ? '' : ' ' + r.modsDbg));
  ok(r.link, 'Code wird aus Link, Nachricht und Zeilenumbrüchen gelesen');
  ok(r.sum && r.cut && r.junk, 'Prüfsumme erkennt jede Änderung, gekürzte Codes und Müll');
  ok(r.badTier && r.badBase && r.badHead, 'manipulierte Codes mit falscher Stufe, Basis, Version, Art werden abgelehnt');
  ok(r.fixed, 'unplausible Werte werden berichtigt (Aufwertung, Sockel, Zusatzwerte, Name, Form, Element, Meisterwerk, Absender)');
  ok(r.mythSet, 'Mythisch/Set/Seltenheit passen immer zusammen');
  ok(r.badBun && r.bun, 'Bündel: nur echte Materialien, Edelsteine und Bauteile mit gültigen Mengen');
  ok(r.pet, 'Begleiter-Daten werden auf einfache, begrenzte Werte reduziert');
  ok(r.notJson, 'Codes ohne gültige Daten werden abgelehnt');
  ok(r.fuzz, 'Zufalls-Manipulation (600 Codes): ' + r.fuzzInfo + (r.crashMsg ? ' – ' + r.crashMsg : ''));
  ok(r.own && r.first && r.second, 'jeder Code nur einmal pro Konto, eigener Code nicht einlösbar');
  ok(r.full, 'voller Beutel: nicht eingelöst, Code bleibt gültig');
  ok(r.bunSend && r.bunTooMuch && r.bunGet, 'Bündel: Absender gibt ab (nie mehr als vorhanden), Empfänger bekommt alles');
  ok(r.dealDay && r.dealOnce && r.dealReset, 'Tauschhändlerin: 3 Angebote nach Datum, jedes einmal am Tag');
  ok(r.total === 234 && r.keys, 'Sammlung: 234 Looks (216 Waffen, 8 Rüstungen, 10 Helme)');
  ok(r.noLook && r.apply && r.orig, 'Aussehen nur aus der Sammlung, Original zurück');
  ok(r.stats, 'Aussehen ändert keine Werte');
  ok(r.preview && r.crown && r.armorSkin, 'Held wird mit dem Aussehen gezeichnet (Waffe, Rüstung, Kopfschmuck)');
  ok(r.badSkin && r.noSkinTrade && r.lines, 'kaputtes Aussehen wird ignoriert, Geschenke ohne Aussehen, Zeile „Aussehen“ am Gegenstand');
  ok(r.reward, 'Sammlerlohn: Glücksmünzen beim Sammelziel');

  /* ---------- alter Spielstand ---------- */
  const old = await A.evaluate(() => { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s.meta.pets) s.meta.pets.starter = true; delete s.meta.trades; delete s.meta.looks; delete s.meta.lookRw; s.chars[0].gear.weapon.skin = 'kaputt'; s.chars[0].bag.push({ slot: 'weapon', base: 'sword', tier: 2, rar: 1, up: 0, aff: {}, sockets: 0, gems: [], uid: 'alt1' }); localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; });
  await A.reload(); await A.waitForTimeout(1400);
  const ol = await A.evaluate(() => ({ t: Array.isArray(SAVE.meta.trades.got) && SAVE.meta.trades.deal.done.length === 0, looks: tmCount(), title: !!panel.querySelector('.logo'), pv: (() => { try { return !!heroPreviewURL(SAVE.chars[0]).url; } catch (e) { return false; } })() }));
  ok(old && ol.t && ol.looks >= 3 && ol.title && ol.pv, `alter Spielstand lädt: Tausch-Buch angelegt, ${ol.looks} Looks aus dem Besitz gesammelt`);
  await A.evaluate(() => { SAVE.meta.trades = 'kaputt'; SAVE.meta.looks = [1]; persist(); }); await A.reload(); await A.waitForTimeout(1200);
  ok(await A.evaluate(() => Array.isArray(SAVE.meta.trades.log) && typeof SAVE.meta.looks === 'object' && !Array.isArray(SAVE.meta.looks)), 'kaputte Tausch-Daten im Spielstand werden repariert');

  /* ---------- Zwei Profile: A verschenkt per Antippen, B öffnet den Link ---------- */
  await A.evaluate(() => {
    localStorage.clear(); loadAll(); const c = newChar('ranger', 'Alrik', 'normal', false); SAVE.chars.push(c); activateChar(0);
    P.bag = [makeItem({ slot: 'weapon', base: 'bow', form: 'reflex', tier: 5, rar: 4 }), makeItem({ slot: 'armor', tier: 2, rar: 1 })]; P.bag[0].up = 6;
    P.mats = { erz: 40, mithril: 12 }; P.gems = { 'saphir:2': 2 }; P.gold = 5000; P.story = { a1: 1 };
    SAVE.meta.pets = { list: [], act: null, eggs: [], starter: true, hatched: 0, first: true, intro: true }; petGive('drache', { nm: 'Funki', lv: 14, xp: 20, col: 2 }); petGive('eule', { nm: 'Eis', lv: 3, shiny: true }); eggGive('natter', true); SAVE.meta.pets.act = SAVE.meta.pets.list[0].id;
    P.map = genMap(1); saveChar(); persist(); openMap();
  });
  await A.waitForTimeout(500);
  const gift = await A.evaluate(() => ({ n: itemName(P.bag[0]), tier: P.bag[0].tier, rar: P.bag[0].rar, up: P.bag[0].up, form: P.bag[0].form }));
  await tapA('[data-act="char"]'); await tapA('#panel .grid [data-act="isel"]');
  ok(await A.locator('[data-act="tr_ask"]').count() > 0, 'Charakter: „Verschenken“ am Gegenstand im Beutel');
  await tapA('[data-act="tr_ask"]'); await shot(A, 'a1_ask');
  ok((await h2(A)) === 'WIRKLICH VERSCHENKEN?', 'Sicherheitsfrage vor dem Verschenken');
  await tapA('[data-act="tr_send"]'); await shot(A, 'a2_code');
  const link = await A.evaluate(() => ($('trOut') || {}).value || '');
  ok(/#tausch=KH5-/.test(link) && (await A.evaluate(() => P.bag.length)) === 1, 'Tauschlink erstellt, Gegenstand hat den Beutel verlassen');
  await A.evaluate(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }));
  await tapA('[data-act="tr_share"]'); await A.waitForTimeout(300);
  ok(/Kopiert|Geteilt/.test(await A.evaluate(() => panel.querySelector('[data-act="tr_share"]').textContent)), 'Teilen: ohne Teilen-Menü wird der Link kopiert');
  await tapA('[data-act="tr_done"]');
  ok((await h2(A)) === 'ALRIK', 'Fertig: zurück im Charakter');

  await B.evaluate(() => { localStorage.clear(); loadAll(); for (const [cls, nm] of [['knight', 'Berta'], ['mage', 'Bodo']]) SAVE.chars.push(newChar(cls, nm, 'normal', false)); SAVE.active = -1; SAVE.meta.pets = { list: [], act: null, eggs: [], starter: true, hatched: 0, first: true, intro: true }; persist(); });
  await B.goto('about:blank'); await B.goto(link); await B.waitForTimeout(1500);
  ok((await B.evaluate(() => location.hash)) === '' && (await B.evaluate(() => panel.textContent.includes('GESCHENK VON ALRIK'))), 'Link öffnet die Vorschau, der Code verschwindet aus der Adresszeile');
  await shot(B, 'b1_link_hero');
  ok(await B.locator('[data-act="tr_hero"]').count() === 2, 'ohne aktiven Helden: Held zum Empfangen wählen');
  await tapB('[data-act="tr_hero"][data-i="1"]');
  await shot(B, 'b2_preview');
  await tapB('[data-act="tr_take"]'); await shot(B, 'b3_done');
  const got = await B.evaluate(() => { const it = P.bag[P.bag.length - 1]; return { who: P.name, n: it && itemName(it), tier: it && it.tier, rar: it && it.rar, up: it && it.up, form: it && it.form, done: panel.textContent.includes('ERHALTEN') }; });
  ok(got.done && got.who === 'Bodo' && got.n === gift.n && got.tier === gift.tier && got.rar === gift.rar && got.up === gift.up && got.form === gift.form, `B (zweites Profil) hat „${got.n}“ erhalten`);
  await B.goto('about:blank'); await B.goto(link); await B.waitForTimeout(1400);
  ok(await B.evaluate(() => panel.textContent.includes('schon eingelöst') && !panel.querySelector('[data-act="tr_take"]')), 'derselbe Link ein zweites Mal: „schon eingelöst“');
  // Link, während das Spiel schon offen ist (nur der Teil hinter # ändert sich)
  await B.evaluate(() => { TRD.pend = false; titleScene(); showTitle(); }); await B.goto(link); await B.waitForTimeout(500);
  ok(await B.evaluate(() => location.hash === '' && panel.textContent.includes('GESCHENK VON ALRIK')), 'Link im offenen Spiel: Vorschau öffnet sich');
  // Link beim Start, während ein anderer Dialog aufgeht (hier: Neuigkeiten nach einem Update): Code wartet im Titel
  await B.evaluate(() => { SAVE.meta.seenVer = '4.0.1'; persist(); }); await B.goto('about:blank'); await B.goto(link.replace('#tausch=', '?neu=1#tausch=')); await B.waitForTimeout(1500);
  const pend = await B.evaluate(() => ({ news: (panel.querySelector('h2') || {}).textContent === 'NEUIGKEITEN', hash: location.hash }));
  await tapB('[data-act="newsback"]');
  const pbtn = await B.evaluate(() => { const b = panel.querySelector('[data-act="tr_open"]'); return b && b.textContent; });
  await tapB('[data-act="tr_open"]');
  ok(pend.news && pend.hash === '' && pbtn === 'Tauschcode öffnen' && await B.evaluate(() => panel.textContent.includes('GESCHENK VON ALRIK')), 'Link beim Start mit offenem Dialog: Code wartet im Titel („Tauschcode öffnen“)');
  await A.goto('about:blank'); await A.goto(link); await A.waitForTimeout(1400);
  ok(await A.evaluate(() => panel.textContent.includes('eigener Tauschcode') && !panel.querySelector('[data-act="tr_take"]')), 'eigener Link: nicht einlösbar');

  // manipulierter Code im Eingabefeld: eine Stelle geändert, und einer mit neu berechneter Prüfsumme
  const code = link.slice(link.indexOf('KH5-'));
  const evil1 = code.slice(0, 30) + (code[30] === 'x' ? 'y' : 'x') + code.slice(31);
  const evil2 = await B.evaluate(c => { const p = JSON.parse(trB64d(c.slice(4, c.indexOf('.')))); p.id = 'evil00000000'; p.d.tier = 42; p.d.up = 77; const body = trB64e(JSON.stringify(p)); return 'KH5-' + body + '.' + trSum(body); }, code);
  const evil3 = await B.evaluate(c => { const p = JSON.parse(trB64d(c.slice(4, c.indexOf('.')))); p.id = 'evil11111111'; p.d.up = 77; p.d.rar = 6; const body = trB64e(JSON.stringify(p)); return 'KH5-' + body + '.' + trSum(body); }, code);
  await B.evaluate(() => { titleScene(); showTitle(); });
  await tapB('[data-act="tr_open"]');
  ok((await h2(B)) === 'TAUSCHEN' && await B.locator('#trIn').count() === 1, 'Titel: „Tausch empfangen“ öffnet das Eingabefeld');
  for (const [ev, want, name] of [[evil1, 'beschädigt', 'geänderte Stelle'], [evil2, 'ungültige Daten', 'falsche Stufe mit neuer Prüfsumme']]) {
    await B.locator('#trIn').fill(ev); await tapB('[data-act="tr_check"]');
    ok(await B.evaluate(w => panel.textContent.includes(w) && !panel.querySelector('[data-act="tr_take"]'), want), `manipulierter Code (${name}): Fehlermeldung, kein Absturz`);
  }
  await shot(B, 'b4_bad');
  await B.locator('#trIn').fill('Hey, nimm das: ' + evil3); await tapB('[data-act="tr_check"]'); await tapB('[data-act="tr_take"]');
  const ev3 = await B.evaluate(() => { const it = P.bag[P.bag.length - 1]; return it.up === 0 && it.rar === 4 && !it.myth; });
  ok(ev3, 'manipulierter Code mit erfundenen Werten: berichtigt angekommen (+0, keine Fantasie-Mythisch)');

  // Bündel per Antippen: Karte → Mehr → Tauschen → Bündel → Zahl eintippen → verschenken
  await A.evaluate(() => { activateChar(0); hideOverlay(); openMap(); });
  await tapA('[data-act="mapmore"]'); await tapA('[data-act="tr_open"]');
  ok((await h2(A)) === 'TAUSCHEN', 'Karte → Mehr → Tauschen');
  await tapA('[data-act="tr_mode"][data-id="bun"]');
  await A.locator('.tr-num[data-tr="m:mithril"]').fill('5'); await A.locator('.tr-num[data-tr="m:mithril"]').dispatchEvent('change');
  await A.evaluate(() => { const el = panel.querySelector('.tr-rng[data-tr="g:saphir:2"]'); el.value = 2; el.dispatchEvent(new Event('input', { bubbles: true })); });
  ok(await A.evaluate(() => TRD.bun.m.mithril === 5 && TRD.bun.g['saphir:2'] === 2 && !$('trBunGo').disabled && $('trBunSum').textContent.includes('Mithril')), 'Bündel: Regler und Zahlenfeld wählen die Menge');
  await shot(A, 'a3_bundle');
  await tapA('#trBunGo'); await tapA('[data-act="tr_send"]');
  const bcode = await A.evaluate(() => { const v = $('trOut').value; return v.slice(v.indexOf('KH5-')); });
  ok(await A.evaluate(() => P.mats.mithril === 7 && P.gems['saphir:2'] === 0), 'Bündel verschenkt: Vorrat von A verringert');
  await tapA('[data-act="tr_done"]'); await tapA('[data-act="tr_tab"][data-id="log"]');
  ok(await A.evaluate(() => panel.querySelectorAll('[data-act="tr_show"]').length === 2), 'Verlauf zeigt beide verschickten Codes');
  await shot(A, 'a4_log');
  await B.evaluate(() => { TRD.res = null; TRD.code = ''; trShow(); });
  await B.locator('#trIn').fill(bcode); await tapB('[data-act="tr_check"]'); await tapB('[data-act="tr_take"]');
  ok(await B.evaluate(() => P.mats.mithril === 5 && P.gems['saphir:2'] === 2), 'B hat das Bündel erhalten');

  // Begleiter (mit Ersatz-pets.js): A verschenkt Funki, B nimmt ihn an
  await tapA('[data-act="tr_tab"][data-id="send"]'); await tapA('[data-act="tr_mode"][data-id="pet"]');
  await shot(A, 'a5_pets');
  await tapA('[data-act="tr_ask"][data-id="p:0"]'); await tapA('[data-act="tr_send"]');
  const pcode = await A.evaluate(() => { const v = $('trOut').value; return v.slice(v.indexOf('KH5-')); });
  ok(await A.evaluate(() => SAVE.meta.pets.list.length === 1 && SAVE.meta.pets.list[0].nm === 'Eis'), 'Begleiter verschenkt: aus der Liste von A');
  await B.evaluate(() => { TRD.res = null; trShow(); }); await B.locator('#trIn').fill(pcode); await tapB('[data-act="tr_check"]');
  ok(await B.evaluate(() => panel.textContent.includes('Funki')), 'Vorschau zeigt den Begleiter');
  await tapB('[data-act="tr_take"]');
  ok(await B.evaluate(() => SAVE.meta.pets.list.some(p => p.nm === 'Funki' && p.lv === 14 && p.sp === 'drache')), 'B hat den Begleiter Funki (Level 14)');
  await tapA('[data-act="tr_done"]'); await tapA('[data-act="tr_ask"][data-id="e:0"]'); await tapA('[data-act="tr_send"]');
  const ecode = await A.evaluate(() => { const v = $('trOut').value; return v.slice(v.indexOf('KH5-')); });
  ok(await B.evaluate(c => { const p = trParse(c).p; return trAccept(p) === 'ok' && SAVE.meta.pets.eggs.some(e => e.sp === 'natter'); }, ecode), 'Ei verschenkt und angekommen');
  // Zucht-Ei (Kreaturen 2.0): Gene, Mutation und Eltern reisen im Code mit
  const gcode = await A.evaluate(() => { const now = Date.now(); SAVE.meta.pets.eggs.push({ id: 'zz1', v: 2, sp: 'fuchs', tier: 2, got: 0, need: 7200, nest: 0, w: 0, f: 0, z: 0, t: now, born: now, gn: [91, 92, 93, 94, 95], mu: 'gold', pa: ['fuchs', 'irrlicht'], ge: 2 }); persist(); return trSend({ t: 'e', i: SAVE.meta.pets.eggs.length - 1 }) || ''; });
  ok(await B.evaluate(c => { const r = trParse(c); if (!r.p) return false; const ok1 = trAccept(r.p) === 'ok', E = SAVE.meta.pets.eggs, g = E[E.length - 1]; return ok1 && !!g.gn && g.gn[0] === 91 && (typeof PET_MUT === 'undefined' || g.mu === 'gold') && g.pa && g.pa.join() === 'fuchs,irrlicht'; }, gcode), 'Zucht-Ei verschenkt: Gene, Mutation und Eltern kommen an');
  ok(await B.evaluate(c => { const f = window.petImport; window.petImport = undefined; const p = trParse(c).p; p.id = 'neuneu000000'; const r = trAccept(p); window.petImport = f; return r === 'pets' && !SAVE.meta.trades.got.includes('neuneu000000'); }, pcode), 'ohne Begleiter-System: Begleiter-Code bleibt gültig');

  /* ---------- Bildschirme antippen: Händlerin, Spiegel, Aussehen ---------- */
  await tapA('[data-act="tr_done"]'); await tapA('[data-act="tr_tab"][data-id="deal"]');
  ok(await A.evaluate(() => panel.querySelectorAll('[data-act="tr_deal"]').length === 3 && panel.textContent.includes('Ssira')), 'Händlerin zeigt 3 Angebote');
  await A.evaluate(() => { P.gold = 1e6; P.fate = 99; for (const k of MATORDER) P.mats[k] = 999; for (const g of GEMORDER) for (let gr = 0; gr < 5; gr++) P.gems[g + ':' + gr] = 9; trShow(); });
  await tapA('[data-act="tr_deal"][data-i="1"]');
  ok(await A.evaluate(() => panel.querySelector('[data-act="tr_deal"][data-i="1"]').disabled && trDealState().done.includes(1)), 'Angebot getauscht, danach gesperrt');
  await shot(A, 'a6_deal');
  ok(await noOverflow(A), 'kein seitliches Scrollen im Tauschen-Bildschirm');
  await tapA('[data-act="tr_back"]');
  ok(await A.evaluate(() => !!panel.querySelector('[data-act="mapmore"]') || !!panel.querySelector('[data-act="tomapview"]')), 'Zurück zur Karte');

  await A.evaluate(() => { P.gear.weapon = makeItem({ slot: 'weapon', base: 'bow', form: 'jagd', tier: 2, rar: 1 }); for (const t of [0, 3, 6]) addToBag(makeItem({ slot: 'weapon', base: 'bow', form: 'arm', tier: t, rar: 1 })); saveChar(); SAVE.meta.hide.intro = true; hideOverlay(); enterHideout(); openStation('spiegel'); });
  await A.waitForTimeout(400);
  ok(await A.evaluate(() => panel.textContent.includes('SAMMLUNG') && !!panel.querySelector('[data-act="tm_open"]')), 'Spiegel: Sammlung und „Ändern“ für jede Ausrüstung');
  await shot(A, 'a7_mirror');
  await tapA('[data-act="tm_open"][data-id="weapon"]');
  ok((await h2(A)) === 'AUSSEHEN' && await A.locator('.tm-g .slot.lock').count() > 20, 'Aussehen: Raster mit gesammelten und fehlenden Looks');
  await tapA('[data-act="tm_set"][data-id="w.bow.arm.6"]'); await shot(A, 'a8_look');
  ok(await A.evaluate(() => P.gear.weapon.skin && visItem(P.gear.weapon).form === 'arm' && visItem(P.gear.weapon).tier === 6 && P.gear.weapon.tier === 2), 'Look „Sternen-Armbrust“ angelegt, Gegenstand bleibt gleich');
  await tapA('[data-act="tm_need"]');
  await tapA('[data-act="tm_slot"][data-id="armor"]'); await tapA('[data-act="tm_slot"][data-id="helm"]');
  await tapA('[data-act="tm_back"]'); await tapA('[data-act="hback"]'); await A.waitForTimeout(600);
  const wv = await A.evaluate(() => ({ st: state, img: $('atkImg').src === itemIconURL(visItem(P.gear.weapon)) }));
  ok(wv.st === 'play' && wv.img, 'im Versteck: Held und Angriffsknopf mit dem neuen Look');
  await shot(A, 'a9_world');
  await A.evaluate(() => { leaveHideout(); hideOverlay(); P.map = genMap(1); startRoom('kampf', 0); P.inv = 99; }); await A.waitForTimeout(1200);
  await shot(A, 'a10_fight');
  ok(await A.evaluate(() => state === 'play'), 'Kampf mit Look läuft');

  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
