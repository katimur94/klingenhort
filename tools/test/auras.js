// Aussehen der Beute & Auren (6.0). Aufruf: node auras.js [bildordner]   (BASE=http://localhost:8792/)
// Prüft: jedes Bild je Waffe/Form/Stufe/Seltenheit verschieden, alle benannten Gegenstände (Legendär, Set, Mythisch)
// unterscheidbar, Bild-Schlüssel ohne Kollisionen (gleicher Schlüssel = gleiches Bild), alte Gegenstände, Kopfschmuck,
// Aura-Zeilen, Auren je Ausrüstung, Ruhe-Einstellung dämpft, Zeichnen bleibt billig, Beute am Boden, Rahmen in der
// Oberfläche – und tippt auf einem Touch-Handy (hoch und quer) den Beutel durch. Mit Bildordner: Fotos und Vergleichsbögen
// (alle Stufen × Seltenheiten je Waffe, alle benannten Gegenstände, der Held mit jeder Aura hell und dunkel, Beute am Boden).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
const save = (name, url) => { if (OUT) fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); };

(async () => {
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const errs = [];
  const open = async (W, H, touch) => {
    const c = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: OUT && touch ? 2 : 1, isMobile: !!touch, hasTouch: !!touch, locale: 'de-DE' });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto(BASE + 'index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1400);
    return p;
  };
  const page = await open(844, 390);
  console.log('Aussehen der Beute & Auren: Regeln');
  const r = await page.evaluate(() => {
    const o = {}, c = newChar('knight', 'Test', 'normal', false); SAVE.chars.push(c); activateChar(0);
    const it = x => Object.assign({ uid: 'x', aff: {}, gems: [], sockets: 0, up: 0, fz: 0, set: null, name: null, suf: null }, x);
    const px = cv => cv.toDataURL();
    // 1) jede Waffe: Stufe × Seltenheit (Gewöhnlich bis Episch) × Form verschieden
    let same = 0, n = 0;
    for (const base in WFORM) for (const F of WFORM[base]) for (let t = 0; t < TIERS; t++) {
      const seen = new Set(); for (let rar = 0; rar <= 3; rar++) { seen.add(px(weaponArt(it({ slot: 'weapon', base, form: F.id, tier: t, rar })).c)); n++; }
      same += 4 - seen.size;
    }
    o.wRar = same; o.wN = n;
    // Stufen einer Form verschieden (auch ohne Farbe: Umriss wächst)
    let tSame = 0; for (const base in WFORM) for (const F of WFORM[base]) { const sil = new Set(); for (let t = 0; t < TIERS; t++) { const c = weaponArt(it({ slot: 'weapon', base, form: F.id, tier: t, rar: 0 })).c; sil.add(px(silhouette(c, '#fff'))); } if (sil.size < 4) tSame++; }
    o.tierSil = tSame;
    // 2) benannte Waffen: je Waffenart und Stufe alle verschieden, und anders als ein Legendär ohne Namen
    const named = [];
    for (const base in WFORM) {
      const list = [it({ slot: 'weapon', base, tier: 4, rar: 4 }), it({ slot: 'weapon', base, tier: 4, rar: 3 })];
      for (const nm of LEGEND[base] || []) list.push(it({ slot: 'weapon', base, tier: 4, rar: 4, name: nm }));
      for (const sid in SETS) if (!SETS[sid].base || SETS[sid].base === base) list.push(it({ slot: 'weapon', base, tier: 4, rar: 5, set: sid, name: SETS[sid].pieces.weapon }));
      for (const m in MYTHIC) if (MYTHIC[m].slot === 'weapon') list.push(it({ slot: 'weapon', base, tier: 4, rar: 6, myth: m, name: MYTHIC[m].n }));
      for (const x of list) x.form = wform(x).id;
      const imgs = list.map(x => px(weaponArt(x).c)); named.push([base, list.length, new Set(imgs).size]);
    }
    o.named = named.filter(([, a, b]) => a !== b);
    o.looks = Object.keys(ITEMLOOK).length;
    o.legLook = Object.keys(LEGEND).every(k => LEGEND[k].every(nm => !!ITEMLOOK[nm])) && Object.keys(SETS).every(k => !!ITEMLOOK['s:' + k]) && Object.keys(MYTHIC).every(k => !!ITEMLOOK['m:' + k]);
    // 3) Rüstung & Helm je Klasse: Seltenheiten verschieden, benannte verschieden
    let aSame = 0, aNamed = 0;
    for (const cls in CLASSES) for (const slot of ['armor', 'helm']) {
      for (let t = 0; t < TIERS; t++) { const s = new Set(); for (let rar = 0; rar <= 3; rar++) s.add(px(armorArt(it({ slot, base: slot, tier: t, rar }), cls))); aSame += 4 - s.size; }
      const list = [it({ slot, base: slot, tier: 4, rar: 4 })];
      for (const nm of LEGEND[slot]) list.push(it({ slot, base: slot, tier: 4, rar: 4, name: nm }));
      for (const sid in SETS) list.push(it({ slot, base: slot, tier: 4, rar: 5, set: sid, name: SETS[sid].pieces[slot] }));
      for (const m in MYTHIC) if (MYTHIC[m].slot === slot) list.push(it({ slot, base: slot, tier: 4, rar: 6, myth: m, name: MYTHIC[m].n }));
      aNamed += list.length - new Set(list.map(x => px(armorArt(x, cls)))).size;
    }
    o.aSame = aSame; o.aNamed = aNamed;
    // 4) Schlüssel: Name und Element zählen, gleicher Schlüssel = gleiches Bild (zufällige Beute aller Seltenheiten)
    o.keyName = itemArtKey(it({ slot: 'weapon', base: 'sword', form: 'lang', tier: 3, rar: 4, name: 'Sonnenklinge' })) !== itemArtKey(it({ slot: 'weapon', base: 'sword', form: 'lang', tier: 3, rar: 4, name: 'Morgenrot' }))
      && itemArtKey(it({ slot: 'weapon', base: 'sword', form: 'lang', tier: 3, rar: 3, el: 'feuer' })) !== itemArtKey(it({ slot: 'weapon', base: 'sword', form: 'lang', tier: 3, rar: 3, el: 'frost' }));
    const byKey = {}; let clash = 0;
    for (let i = 0; i < 260; i++) {
      const x = i % 7 === 6 ? makeMythic() : randomItem(ri(1, 48), i % 6, { setChance: i % 5 === 0 ? 1 : 0 }); if (i % 3 === 0 && typeof elRoll === 'function') elRoll(x);
      for (const cls of ['knight', 'mage']) { const k = 'it' + itemArtKey(x) + (x.slot !== 'weapon' ? cls : ''), img = x.slot === 'weapon' ? px(weaponArt(JSON.parse(JSON.stringify(x))).c) : px(armorArt(JSON.parse(JSON.stringify(x)), cls)); if (byKey[k] && byKey[k] !== img) clash++; byKey[k] = img; }
    }
    o.clash = clash;
    // 5) alte und seltsame Gegenstände: kein Fehler
    try {
      const old = [{ slot: 'weapon', base: 'sword', tier: 2, rar: 1 }, { slot: 'weapon', base: 'axe', tier: 0, rar: 4 }, { slot: 'weapon', base: 'bow', tier: 7, rar: 4, name: 'Excalibur' }, { slot: 'weapon', base: 'staff', tier: 5, rar: 5, set: 'gibtsnicht' }, { slot: 'weapon', base: 'dagger', tier: 6, rar: 6, myth: 'gibtsnicht' }, { slot: 'armor', base: 'armor', tier: 3, rar: 6 }, { slot: 'helm', base: 'helm', tier: 7, rar: 5, set: 'drache' }, { slot: 'helm', base: 'helm', tier: 1, rar: 4, name: 'Unbekannt' }];
      o.old = old.every(x => { const y = it(x); return !!(y.slot === 'weapon' ? weaponArt(y).c : armorArt(y, 'rogue')) && itemIconURL(y).startsWith('data:image') && (y.slot !== 'helm' || headgearOf(y) === (y.rar === 5 ? 'h:s:drache' : 'crown')); });
    } catch (e) { o.old = 'Fehler: ' + e.message; }
    // 6) Kopfschmuck am Helden: benannte Helme eigenes Bild, Aussehen „Krone“ auf einem epischen Helm = Krone
    const hk = [];
    for (const nm of LEGEND.helm) hk.push(headgearOf(it({ slot: 'helm', base: 'helm', tier: 2, rar: 4, name: nm })));
    for (const sid in SETS) hk.push(headgearOf(it({ slot: 'helm', base: 'helm', tier: 2, rar: 5, set: sid })));
    for (const m in MYTHIC) if (MYTHIC[m].slot === 'helm') hk.push(headgearOf(it({ slot: 'helm', base: 'helm', tier: 2, rar: 6, myth: m })));
    const ep = it({ slot: 'helm', base: 'helm', tier: 2, rar: 3, skin: { form: 'krone' } });
    o.headgear = hk.every(k => k && k.startsWith('h:') && headgearSpr(k.slice(2)).c.width > 4) && new Set(hk).size === hk.length && headgearOf(visItem(ep)) === 'crown' && hgNoPlume('h:s:lion') === 1 && hgNoPlume('horns') === 0;
    // 7) Zeilen: Aura bei Legendär, Set und Mythisch, nicht bei Episch
    const ln = x => itemLines(makeItem(x)).some(l => l.includes('Aura'));
    o.lines = ln({ slot: 'helm', tier: 3, rar: 6, myth: 'krone' }) && ln({ slot: 'armor', tier: 3, rar: 5, set: 'lion' }) && ln({ slot: 'weapon', base: 'sword', tier: 3, rar: 4 }) && !ln({ slot: 'weapon', base: 'sword', tier: 3, rar: 3 });
    // 8) Auren: Mythisch, Set erst mit 3 Teilen, Legendär
    const g = (w, a, h) => ({ gear: { weapon: w, armor: a, helm: h } }), M = (slot, m) => makeItem({ slot, base: slot === 'weapon' ? 'sword' : slot, tier: 3, rar: 6, myth: m }), S = (slot, s) => makeItem({ slot, base: slot === 'weapon' ? 'sword' : slot, tier: 3, rar: 5, set: s });
    const a1 = auraOf(g(M('weapon', 'zorn'), M('armor', 'phoenix'), M('helm', 'krone'))), a2 = auraOf(g(S('weapon', 'lion'), S('armor', 'lion'), null)), a3 = auraOf(g(S('weapon', 'lion'), S('armor', 'lion'), S('helm', 'lion'))), a4 = auraOf(g(makeItem({ slot: 'weapon', base: 'sword', tier: 2, rar: 4 }), null, null)), a5 = auraOf(g(makeItem({ slot: 'weapon', base: 'sword', tier: 2, rar: 1 }), null, null));
    o.aura = a1.myth.join() === 'zorn,phoenix,krone' && a1.w && a2.set === null && a3.set === 'lion' && a4.leg.length === 1 && !a5.any;
    // Heldenbild in Menüs (zum Einbauen in heroPreviewURL): zeichnet ohne Fehler, Schlüssel unterscheidet
    try { const cv2 = mk(160, 44), gg = cv2.getContext('2d'), st = charStrip(heroSpec(P)), m = st.meta[0]; for (const L of [0, 1]) auraPreview(gg, 12, 44 - st.h - 1, m, g(M('weapon', 'zorn'), M('armor', 'phoenix'), null), L, 0, 40, 44); o.preview = auraKey(g(M('weapon', 'zorn'), null, null)) !== auraKey(g(null, M('armor', 'phoenix'), null)) && auraKey(g(null, null, null)) === ''; } catch (e) { o.preview = 'Fehler: ' + e.message; }
    // 9) Bilder: Mythisch wandert in Farben, Legendär glänzt
    const sm = weaponArt(it({ slot: 'weapon', base: 'axe', form: 'streit', tier: 5, rar: 6, myth: 'klinge', name: MYTHIC.klinge.n })), sl = weaponArt(it({ slot: 'weapon', base: 'sword', form: 'lang', tier: 5, rar: 4, name: 'Sonnenklinge' })), sc = weaponArt(it({ slot: 'weapon', base: 'sword', form: 'lang', tier: 5, rar: 1 }));
    let gl = 0; for (let k = 0; k < 40; k++) { T = k * .1; if (glintImg(sl)) gl++; }
    o.frames = sm.fr && sm.fr.length === 8 && new Set(sm.fr.map(px)).size >= 4 && sl.glint && !sc.glint && gl > 2 && gl < 20 && !sc.fr && sl.tl > 8;
    // 10) Ruhe dämpft die Partikel; Zeichnen bleibt billig
    hideOverlay(); SAVE.meta.hide.intro = true; enterHideout(); setState('play'); P.inv = 0;
    P.gear = { weapon: M('weapon', 'zorn'), armor: M('armor', 'phoenix'), helm: M('helm', 'eisherz') }; computeStats();
    const sim = calm => { SAVE.meta.settings.calm = calm; parts = []; for (const k in AUE) AUE[k] = 0; AUt = T; let made = 0; for (let f = 0; f < 360; f++) { T += 1 / 60; const n0 = parts.length; render(); made += parts.length - n0; if (parts.length > 600) parts = []; } return made; };
    const loud = sim(false), quiet = sim(true); SAVE.meta.settings.calm = false;
    o.calm = loud > 120 && quiet < loud * .75; o.loud = loud; o.quiet = quiet;   // Aura-Teilchen ×0,35, dazu ungedämpftes Rauschen (Begleiter, Spur)
    const time = () => { const t0 = performance.now(); for (let f = 0; f < 120; f++) { T += 1 / 60; render(); } return (performance.now() - t0) / 120; };
    time(); const tMyth = time(); P.gear = { weapon: makeItem({ slot: 'weapon', base: 'sword', tier: 3, rar: 1 }), armor: makeItem({ slot: 'armor', tier: 3, rar: 1 }), helm: makeItem({ slot: 'helm', tier: 3, rar: 1 }) }; computeStats(); time(); const tPlain = time();
    o.perf = [tPlain.toFixed(2), tMyth.toFixed(2)]; o.cheap = tMyth < tPlain + 1.5;
    // 11) Beute am Boden: alle Seltenheiten zeichnen, Säulen werden höher
    try { for (let rr = 0; rr <= 6; rr++) { const x = makeItem({ slot: rr % 2 ? 'armor' : 'weapon', base: rr % 2 ? 'armor' : 'axe', tier: 2, rar: rr, set: rr === 5 ? 'wald' : null, myth: rr === 6 ? (rr % 2 ? 'dornen' : 'ernter') : null }); pickups.push({ k: 'loot', it: x, x: P.x + rr * 20 - 60, y: P.y - 30, z: 0, vz: 0, vx: 0, vy: 0, t: 0 }); } render(); o.loot = BEAM.slice(1).every((B, i, a) => !i || B[0] >= a[i - 1][0]) && !BEAM[0]; } catch (e) { o.loot = 'Fehler: ' + e.message; }
    pickups = []; return o;
  });
  ok(r.wRar === 0, `Waffen: Gewöhnlich/Magisch/Selten/Episch je Stufe und Form verschieden (${r.wN} Bilder, ${r.wRar} gleich)`);
  ok(r.tierSil === 0, 'Waffen: Umriss wächst mit der Stufe (mind. 4 verschiedene Umrisse je Form)');
  ok(r.legLook && r.looks >= 30, `jeder Legendär-Name, jedes Set und jeder Mythische hat ein eigenes Aussehen (${r.looks})`);
  ok(!r.named.length, 'benannte Waffen je Waffenart alle verschieden' + (r.named.length ? ' ' + JSON.stringify(r.named) : ''));
  ok(r.aSame === 0 && r.aNamed === 0, `Rüstungen & Helme je Klasse: Seltenheiten und benannte verschieden (${r.aSame}/${r.aNamed} gleich)`);
  ok(r.keyName && r.clash === 0, `Bild-Schlüssel: Name und Element zählen, keine Kollision (${r.clash})`);
  ok(r.old === true, 'alte und unbekannte Gegenstände zeichnen ohne Fehler ' + (r.old === true ? '' : r.old));
  ok(r.headgear, 'Kopfschmuck: jeder benannte Helm eigenes Bild am Helden, „Krone“-Aussehen bleibt Krone');
  ok(r.lines, 'Aura-Zeile bei Legendär, Set und Mythisch');
  ok(r.aura, 'Auren: Mythisch je Gegenstand, Set erst mit 3 Teilen, Legendär schwach');
  ok(r.preview === true, 'Heldenbild in Menüs: Aura-Zeichnung und Schlüssel bereit ' + (r.preview === true ? '' : r.preview));
  ok(r.frames, 'Mythisch: wandernde Farben (8 Bilder), Legendär: Glanz läuft ab und zu über die Waffe');
  ok(r.calm, `Ruhe-Einstellung dämpft die Partikel (${r.loud} → ${r.quiet})`);
  ok(r.cheap, `Zeichnen mit drei Mythischen bleibt billig (${r.perf[0]} → ${r.perf[1]} ms je Bild)`);
  ok(r.loot === true, 'Beute am Boden: alle Seltenheiten, Lichtsäulen wachsen mit der Seltenheit ' + (r.loot === true ? '' : r.loot));

  /* ---------- Antippen auf dem Handy ---------- */
  for (const [W, H] of [[390, 844], [844, 390]]) {
    const p = await open(W, H, true);
    console.log(`Beutel antippen ${W}x${H}`);
    await p.evaluate(() => {
      const c = newChar('knight', 'Alrik', 'normal', false); SAVE.chars.push(c); activateChar(0); P.lv = 30;
      const add = o => { P.bag.push(makeItem(Object.assign({ tier: 4 }, o))); };
      for (let r = 0; r <= 4; r++) add({ slot: 'weapon', base: 'sword', rar: r });
      add({ slot: 'weapon', base: 'sword', rar: 5, set: 'lion' }); add({ slot: 'weapon', base: 'axe', rar: 6, myth: 'zorn' });
      for (let r = 0; r <= 3; r++) add({ slot: 'armor', rar: r });
      add({ slot: 'armor', rar: 4 }); add({ slot: 'armor', rar: 5, set: 'drache' }); add({ slot: 'armor', rar: 6, myth: 'phoenix' });
      add({ slot: 'helm', rar: 4 }); add({ slot: 'helm', rar: 5, set: 'lion' }); add({ slot: 'helm', rar: 6, myth: 'krone' });
      P.gear.weapon = makeItem({ slot: 'weapon', base: 'sword', tier: 5, rar: 6, myth: 'klinge' }); P.gear.helm = makeItem({ slot: 'helm', tier: 5, rar: 6, myth: 'eisherz' });
      computeStats(); P.story['a' + P.act] = 1; if (SAVE.meta.pets) SAVE.meta.pets.starter = true; P.map = genMap(P.act); saveChar(); hideOverlay(); openMap();
    });
    const tap = async sel => { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await p.waitForTimeout(300); };
    if (!(await p.locator('[data-act="char"]').count())) console.log('    Karte fehlt: ' + JSON.stringify(await p.evaluate(() => ({ state, txt: panel.textContent.slice(0, 120) }))));
    await tap('[data-act="char"]');
    const myth = await p.evaluate(() => P.bag.find(x => x.rar === 6).uid), leg = await p.evaluate(() => P.bag.find(x => x.rar === 4).uid);
    const fx = await p.evaluate(([m, l]) => { const s = q => document.querySelector(`.slot[data-id="${q}"]`), cs = (e, pe) => e ? getComputedStyle(e, pe) : {}; return { anim: cs(s(m), '::after').animationName, legGlow: cs(s(l), '::after').boxShadow, plain: cs(document.querySelector('.slot[style*="2px #c8c8c8"]'), '::after').content }; }, [myth, leg]);
    ok(fx.anim === 'auMyth' && /rgba/.test(fx.legGlow || '') && (!fx.plain || fx.plain === 'none'), 'Rahmen: Mythisch wechselt die Farbe, Legendär leuchtet, Gewöhnlich bleibt schlicht');
    if (OUT) { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/beutel-${W}x${H}.png` }); }
    await tap(`.slot[data-id="${myth}"]`);
    const d = await p.evaluate(() => { const d = panel.querySelector('.detail'), i = d && d.querySelector('.ic.big img'); return { aura: !!d && d.textContent.includes('Aura'), big: i ? i.getBoundingClientRect().width : 0, over: panel.scrollWidth > panel.clientWidth + 1 }; });
    ok(d.aura && d.big >= 52 && !d.over, `Antippen: Beschreibung mit Aura-Zeile und großem Bild (${Math.round(d.big)} px), nichts ragt heraus`);
    if (OUT) { await p.locator('.detail').first().scrollIntoViewIfNeeded().catch(() => { }); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/detail-${W}x${H}.png` }); }
    if (OUT) {
      // Held mit Aura im Versteck, Beute am Boden in einem dunklen Raum
      await p.evaluate(() => { hideOverlay(); SAVE.meta.hide.intro = true; P.gear.armor = makeItem({ slot: 'armor', tier: 5, rar: 6, myth: 'phoenix' }); computeStats(); enterHideout(); setState('play'); showHud(true); P.inv = 0; });
      await p.waitForTimeout(1200); await p.screenshot({ path: `${OUT}/held-versteck-${W}x${H}.png` });
      await p.evaluate(() => { startRoom('kampf', 0); enemies = []; G.waves = []; G.dark = .7; P.inv = 99; for (let rr = 0; rr <= 6; rr++) { const x = makeItem({ slot: rr % 3 ? 'weapon' : 'helm', base: 'sword', tier: 3, rar: rr, set: rr === 5 ? 'lion' : null, myth: rr === 6 ? 'ernter' : null }); pickups.push({ k: 'loot', it: x, x: P.x + (rr - 3) * 26, y: P.y - 26, z: 0, vz: 0, vx: 0, vy: 0, t: 0 }); } P.y += 24; });
      await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/beute-boden-${W}x${H}.png` });
    }
    await p.context().close();
  }

  /* ---------- Vergleichsbögen ---------- */
  if (OUT) {
    console.log('Vergleichsbögen → ' + OUT);
    const sheets = await page.evaluate(() => {
      const S = 4, out = {}, it = x => Object.assign({ uid: 'x', aff: {}, gems: [], sockets: 0, up: 0, fz: 0, set: null, name: null, suf: null }, x);
      function sheet(title, rows, cols, cell, cw, ch) {
        const W = 100 + cols.length * cw * S, H = 34 + rows.length * ch * S, c = mk(W, H), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.fillStyle = '#1b1622'; g.fillRect(0, 0, W, H); g.font = '13px monospace'; g.fillStyle = '#efe2bf'; g.fillText(title, 6, 14);
        cols.forEach((cn, i) => { g.fillStyle = '#a8997e'; g.font = '11px monospace'; g.fillText(String(cn).slice(0, Math.floor(cw * S / 7)), 100 + i * cw * S + 2, 30); });
        rows.forEach((rn, j) => { g.fillStyle = '#a8997e'; g.fillText(String(rn).slice(0, 14), 4, 34 + j * ch * S + ch * S / 2); cols.forEach((cn, i) => { const x = 100 + i * cw * S, y = 34 + j * ch * S; g.fillStyle = (i + j) % 2 ? '#241e2e' : '#2a2434'; g.fillRect(x, y, cw * S, ch * S); const src = cell(j, i); if (src) g.drawImage(src, 0, 0, src.width, src.height, x + Math.floor((cw - src.width) / 2) * S, y + Math.floor((ch - src.height) / 2) * S, src.width * S, src.height * S); }); });
        return c.toDataURL();
      }
      function grid(title, items, ncol, cw, ch) {
        const nrow = Math.ceil(items.length / ncol), W = ncol * cw * S, H = 22 + nrow * (ch * S + 16), c = mk(W, H), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.fillStyle = '#1b1622'; g.fillRect(0, 0, W, H); g.font = '13px monospace'; g.fillStyle = '#efe2bf'; g.fillText(title, 6, 15);
        items.forEach(([label, src], i) => { const x = (i % ncol) * cw * S, y = 22 + Math.floor(i / ncol) * (ch * S + 16); g.fillStyle = (i + Math.floor(i / ncol)) % 2 ? '#241e2e' : '#2a2434'; g.fillRect(x, y, cw * S, ch * S + 16); if (src) g.drawImage(src, 0, 0, src.width, src.height, x + Math.floor((cw - src.width) / 2) * S, y + Math.floor((ch - src.height) / 2) * S, src.width * S, src.height * S); g.font = '11px monospace'; g.fillStyle = '#efe2bf'; g.fillText(String(label).slice(0, Math.floor(cw * S / 6.6)), x + 3, y + ch * S + 12); });
        return c.toDataURL();
      }
      const rarN = RAR.map(x => x.n), setOf = { sword: 'lion', axe: 'drache', staff: 'glut', dagger: 'nacht', bow: 'wald' }, mythW = Object.keys(MYTHIC).filter(k => MYTHIC[k].slot === 'weapon');
      const mkW = (base, form, t, r, j) => { const o = { slot: 'weapon', base, form, tier: t, rar: r }; if (r === 4) o.name = LEGEND[base][j % 3]; if (r === 5) { o.set = setOf[base]; o.name = SETS[o.set].pieces.weapon; } if (r === 6) { o.myth = mythW[j % 3]; o.name = MYTHIC[o.myth].n; } return it(o); };
      for (const base in WFORM) {
        const F = WFORM[base], std = (F.find(f => f.std) || F[0]).id;
        out['waffe-' + base] = sheet(`${WT[base].label} (${std}): Zeilen Stufe, Spalten Seltenheit (Legendär/Mythisch wechseln je Zeile)`, MAT.map(m => m.n), rarN, (t, r) => weaponArt(mkW(base, std, t, r, t)).c, 36, 36);
        out['formen-' + base] = sheet(`${WT[base].label}: Formen × Seltenheit, Stufe 3`, F.map(f => f.n), rarN, (j, r) => weaponArt(mkW(base, F[j].id, 3, r, j)).c, 36, 36);
      }
      const nmw = (k, base, n, t) => { const F = WFORM[base], o = { slot: 'weapon', base, form: (F.find(f => f.std) || F[0]).id, tier: t }; if (k === 'L') Object.assign(o, { rar: 4, name: n }); else if (k === 'S') Object.assign(o, { rar: 5, set: n, name: SETS[n].pieces.weapon }); else Object.assign(o, { rar: 6, myth: n, name: MYTHIC[n].n }); return weaponArt(it(o)).c; };
      const leg = []; for (const base in WFORM) for (const n of LEGEND[base]) leg.push([n, nmw('L', base, n, 4)]);
      for (const sid in SETS) leg.push(['Set ' + SETS[sid].n, nmw('S', SETS[sid].base || 'sword', sid, 4)]);
      out['benannt-legendaer-set'] = grid('Legendär & Set (Stufe 4)', leg, 7, 36, 36);
      out['benannt-mythisch'] = grid('Mythisch auf jeder Waffe (Stufe 4) – im Spiel wandern die Farben', mythW.flatMap(m => Object.keys(WFORM).map(base => [MYTHIC[m].n.slice(0, 12) + ' ' + base, nmw('M', base, m, 4)])), 5, 36, 36);
      out['benannt-drache-stufen'] = grid('Set Drachenfürst je Waffe, Legendär auf Stufe 0 und 7', Object.keys(WFORM).map(b => ['Drache ' + b, nmw('S', b, 'drache', 4)]).concat(leg.slice(0, 15).flatMap(([n]) => { const base = Object.keys(LEGEND).find(k => LEGEND[k].includes(n)); return [[n + ' 0', nmw('L', base, n, 0)], [n + ' 7', nmw('L', base, n, 7)]]; })), 7, 36, 36);
      for (const cls in CLASSES) {
        P.cls = cls; const cols = []; for (const s of ['armor', 'helm']) for (let rr = 0; rr <= 6; rr++) cols.push((s === 'armor' ? 'R ' : 'H ') + rarN[rr].slice(0, 6));
        const sid = Object.keys(SETS).find(k => SETS[k].cls === cls);
        out['ruestung-' + cls] = sheet(`Rüstung/Helm ${CLASSES[cls].name}: Zeilen Stufe`, MAT.map(m => m.n), cols, (t, i) => { const s = i < 7 ? 'armor' : 'helm', rr = i % 7, o = { slot: s, base: s, tier: t, rar: rr }; if (rr === 4) o.name = LEGEND[s][t % 3]; if (rr === 5) { o.set = t % 2 ? 'drache' : sid; o.name = SETS[o.set].pieces[s]; } if (rr === 6) { const ks = Object.keys(MYTHIC).filter(k => MYTHIC[k].slot === s); o.myth = ks[t % ks.length]; o.name = MYTHIC[o.myth].n; } return armorArt(it(o), cls); }, 22, 22);
      }
      const na = []; for (const s of ['armor', 'helm']) { for (const n of LEGEND[s]) na.push([s, 'L', n]); for (const sid in SETS) na.push([s, 'S', sid]); for (const k in MYTHIC) if (MYTHIC[k].slot === s) na.push([s, 'M', k]); }
      out['benannt-ruestung-helm'] = grid('Benannte Rüstungen/Helme (Stufe 4) je Klasse: Ritter, Magier, Assassine, Bogenschütze', na.flatMap(([s, k, n]) => Object.keys(CLASSES).map(cl => { const o = { slot: s, base: s, tier: 4 }; if (k === 'L') Object.assign(o, { rar: 4, name: n }); else if (k === 'S') Object.assign(o, { rar: 5, set: n, name: SETS[n].pieces[s] }); else Object.assign(o, { rar: 6, myth: n, name: MYTHIC[n].n }); return [(k === 'L' ? n : k === 'S' ? SETS[n].pieces[s] : MYTHIC[n].n).slice(0, 13) + ' ' + cl.slice(0, 2), armorArt(it(o), cl)]; })), 8, 24, 22);
      out['kopfschmuck-held'] = grid('Kopfschmuck am Helden', Object.keys(ITEMLOOK).filter(k => ITEMLOOK[k].hd).map(k => [k, headgearSpr(k).c]), 6, 16, 12);
      P.cls = 'knight'; return out;
    });
    for (const k in sheets) save(k, sheets[k]);
    // Held mit jeder Aura (hell und dunkel)
    await page.evaluate(() => {
      // Bögen aus der Spielfeld-Leinwand in Spielpixeln: Pixel-Modus (im HD-Modus hat die Leinwand Gerätepixel)
      SAVE.meta.settings.gfx = 'px'; resize();
      hideOverlay(); SAVE.meta.hide.intro = true; enterHideout(); setState('play'); DLG = null; hideOverlay();
      window.AUCFG = [['Ohne', {}], ['Episch (Waffe)', { weapon: { rar: 3 } }], ['Legendär Sonnenklinge', { weapon: { rar: 4, name: 'Sonnenklinge' } }], ['Legendär Rüstung+Helm', { armor: { rar: 4, name: 'Phönixherz' }, helm: { rar: 4, name: 'Löwenhaupt' } }],
        ['Set Löwe', { weapon: { rar: 5, set: 'lion' }, armor: { rar: 5, set: 'lion' }, helm: { rar: 5, set: 'lion' } }], ['Set Drachenfürst', { weapon: { rar: 5, set: 'drache' }, armor: { rar: 5, set: 'drache' }, helm: { rar: 5, set: 'drache' } }],
        ['Set Glutweber', { cls: 'mage', weapon: { rar: 5, set: 'glut' }, armor: { rar: 5, set: 'glut' }, helm: { rar: 5, set: 'glut' } }], ['Set Nachtschatten', { cls: 'rogue', weapon: { rar: 5, set: 'nacht' }, armor: { rar: 5, set: 'nacht' }, helm: { rar: 5, set: 'nacht' } }], ['Set Waldläufer', { cls: 'ranger', weapon: { rar: 5, set: 'wald' }, armor: { rar: 5, set: 'wald' }, helm: { rar: 5, set: 'wald' } }],
        ['Phönixpanzer', { armor: { rar: 6, myth: 'phoenix' } }], ['Dornenwacht', { armor: { rar: 6, myth: 'dornen' } }], ['Krone der Ewigkeit', { helm: { rar: 6, myth: 'krone' } }], ['Eisherz-Diadem', { helm: { rar: 6, myth: 'eisherz' } }], ['Midas\' Haube', { helm: { rar: 6, myth: 'midas' } }],
        ['Klinge v. Klingenhort', { weapon: { rar: 6, myth: 'klinge' } }], ['Pyraxis\' Zorn', { weapon: { rar: 6, myth: 'zorn' } }], ['Seelenernter', { weapon: { rar: 6, myth: 'ernter' } }], ['Alles Mythisch', { weapon: { rar: 6, myth: 'klinge' }, armor: { rar: 6, myth: 'phoenix' }, helm: { rar: 6, myth: 'krone' } }]];
      window.auSet = (i, dark) => {
        const o = AUCFG[i][1], cls = o.cls || 'knight'; if (P.cls !== cls) { P.cls = cls; P.look = lookOf({ cls }); }
        for (const s of ['weapon', 'armor', 'helm']) { const d = o[s] || { rar: 1 }, x = makeItem({ slot: s, base: s === 'weapon' ? CLASSES[cls].start : s, tier: 4, rar: d.rar, set: d.set, myth: d.myth }); if (d.name) x.name = d.name; P.gear[s] = x; }
        computeStats(); G.dark = dark ? .8 : 0; P.inv = 0; P.x = AW / 2 + 40; P.y = BD.y0 + 70; P.moving = false; P.face = P.turn = 1; parts = [];
      };
      const S = 4, CW = 84, CH = 66, cols = 6; window.AUSH = mk(cols * CW * S, Math.ceil(AUCFG.length / cols) * (CH * S + 18));
      window.auCap = i => { const g = AUSH.getContext('2d'); g.imageSmoothingEnabled = false; const x = Math.round(P.x - CX - CW / 2), y = Math.round(P.y - CY - CH + 18), dx = (i % cols) * CW * S, dy = Math.floor(i / cols) * (CH * S + 18); g.drawImage(cv, x, y, CW, CH, dx, dy, CW * S, CH * S); g.fillStyle = '#000'; g.fillRect(dx, dy + CH * S, CW * S, 18); g.fillStyle = '#efe2bf'; g.font = '13px monospace'; g.fillText(AUCFG[i][0], dx + 4, dy + CH * S + 13); };
    });
    for (const dark of [false, true]) {
      const n = await page.evaluate(() => { AUSH.getContext('2d').clearRect(0, 0, AUSH.width, AUSH.height); return AUCFG.length; });
      for (let i = 0; i < n; i++) { await page.evaluate(([i, d]) => auSet(i, d), [i, dark]); await page.waitForTimeout(800); await page.evaluate(i => auCap(i), i); }
      save(dark ? 'held-auren-dunkel' : 'held-auren', await page.evaluate(() => AUSH.toDataURL()));
    }
    console.log('  Bilder: ' + fs.readdirSync(OUT).length);
  }
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  if (fails.length) { console.log(`\n${fails.length} FEHLER`); process.exit(1); }
})();
