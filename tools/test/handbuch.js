// Handbuch (js/handbuch.js): Einträge zu allen Spieldaten, „Wo finden“ / „Wofür“, Suche (Umlaute, Groß/klein, Fragen, Englisch),
// Zugänge (Hauptmenü „?“, Pause, Einstellungen, Karte „Mehr“, Bibliothek, „?“ an fehlenden Materialien) und dass „Zurück“ genau
// dorthin führt – aus der Pause in Kampagne und Endlosen Landen geht das Spiel danach unverändert weiter.
// Hoch, quer und PC: kein seitliches Scrollen, Knöpfe ≥ 44 px (Touch), Bilder zum Ansehen.
// Aufruf: node handbuch.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/handbuch';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
// Held mit etwas Fortschritt: Versteck teils gebaut, Erfolge erledigt (sonst zahlen sie zwischendurch Gold)
const HERO = () => {
  localStorage.clear(); loadAll();
  const c = newChar('knight', 'Lesefuchs', 'normal', false); c.lv = 22; c.act = 3; c.maxAct = 3; c.story = { a1: 1, a2: 1, a3: 1 };
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; SAVE.meta.hide.tip62 = 1; SAVE.meta.hide.b = { schmiede: 2, garten: 3, bibliothek: 1 };
  for (const a of ACH) SAVE.meta.ach[a.id] = 1; if (SAVE.meta.lande) SAVE.meta.lande.tips = 0xffff; if (SAVE.meta.pets) SAVE.meta.pets.starter = true;
  for (const k of MATORDER) P.mats[k] = 3; P.gold = 5000; computeStats(); P.hp = P.st.hp; saveChar(); persist(); titleScene(); showTitle();
};
const VIEWS = [[390, 844, false], [844, 390, false], [1280, 720, true]];

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  console.log('Handbuch – Inhalt aus den Spieldaten');
  {
    const page = await b.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    const r = await page.evaluate(([HERO_]) => {
      eval('(' + HERO_ + ')')(); openHandbuch(null, 'title'); hbIndex();
      const ids = new Set(hbEntries().map(e => e.id)), o = {};
      const want = [...MATORDER.map(k => 'mat:' + k), ...BUILDORDER.map(k => 'bld:' + k), ...Object.keys(CLASSES).map(k => 'cls:' + k), ...Object.keys(SETS).map(k => 'set:' + k),
        ...Object.keys(MYTHIC).map(k => 'myth:' + k), ...GEMORDER.map(k => 'gem:' + k), ...ELORDER.map(k => 'el:' + k), ...Object.keys(MOD_FAM).map(k => 'modf:' + k),
        ...PET_TIERS.map((_, t) => 'egg:' + t), ...LANDE_TOOLS.map(t => 'tool:' + t.key), ...Object.keys(LANDE_BIOMES).map(k => 'bio:' + k), ...Object.keys(EN).filter(k => !EN[k].hidden).map(k => 'en:' + k)];
      o.n = ids.size; o.miss = want.filter(id => !ids.has(id)); o.want = want.length;
      o.chaps = HB.chs.map(c => c.n + ' ' + HB.list.filter(e => e.ch === c.k).length);
      // Wofür: jede Ausbaustufe, die das Material kostet, mit der richtigen Summe
      o.uses = {};
      for (const m of ['holz', 'stein', 'eisenholz']) {
        const U = hbUses(m), need = BUILDORDER.filter(k => BUILD[k].lv && BUILD[k].lv.some(c => c[m]));
        const bad = need.filter(k => { const r = U.find(x => x.id === 'bld:' + k), sum = BUILD[k].lv.reduce((a, c) => a + (c[m] || 0), 0); return !r || r.n !== sum; });
        o.uses[m] = { n: U.length, need: need.length, bad, extra: U.filter(x => x.id.startsWith('bld:')).length - need.length, birds: U.some(x => x.id === 'ver:voegel'), text: hbText('mat:' + m).includes(_t('WOFÜR')) };
      }
      // Eisenholz: Wo finden – tiefe Bäume, die Wälder, Weltenbäume, Acker (Garten-Stufe, Saat, Zeit, Ernte), Basar
      const ex = hbText('mat:eisenholz'), C = CROPS.eisenbaum;
      o.eis = { tief: /Bäume tiefer in den Landen/.test(ex), waelder: ['tannen', 'dschungel', 'nebelwald', 'schattenwald', 'uralt'].every(k => ex.includes(LANDE_BIOMES[k].n)), welt: /Weltenb/.test(ex), setzling: ex.includes(C.n) && /Setzling/.test(ex),
        garten: ex.includes('Garten-Stufe ' + C.lv), saat: ex.includes('2 Samen, 1 Eisenholz'), zeit: ex.includes(buildTimeText(C.t)), ernte: ex.includes('3–5 Eisenholz'), basar: /Basar/.test(ex) };
      // Suche: erster Treffer, Groß/klein, Umlaute, Fragen
      o.s1 = hbSearch('eisenholz')[0]; o.s2 = hbSearch('EISENHOLZ')[0]; o.s3 = hbSearch('Wie macht man Eisenholz?')[0]; o.s3t = /Setzling/.test(hbText(o.s3));
      o.kr = hbSearch('krauter').slice(0, 3).map(id => HB.by[id].t); o.kr2 = hbSearch('kraeuter')[0] === hbSearch('Kräuter')[0];
      o.eisen = ['mat:erz', 'mat:eisenholz', 'tool:eishaken'].filter(id => !hbSearch('eisen').includes(id));
      // keine Spoiler: unentdeckte Resonanzen und Begleiter-Arten nur als „???“ mit Hinweis
      const reso = hbText('fg:resonanz'), R0 = RESO[0]; o.reso = !reso.includes(R0.n) && reso.includes('???') && reso.includes(R0.h);
      o.pets = hbText('pet:arten').includes('???');
      o.err = Object.keys(HBERR);
      return o;
    }, [HERO.toString()]);
    console.log('  Kapitel: ' + r.chaps.join(' · '));
    ok(r.n >= 300, `${r.n} Einträge`);
    ok(!r.miss.length, `jedes Material, Gebäude, Klasse, Set, Mythisch, Edelstein, Element, Mod-Familie, Ei, Werkzeug, Biom, Gegner hat einen Eintrag (${r.want} geprüft)` + (r.miss.length ? ': fehlt ' + r.miss.slice(0, 8).join(', ') : ''));
    for (const m in r.uses) { const u = r.uses[m]; ok(u.n > 0 && !u.bad.length && !u.extra && u.text, `„Wofür“ ${m}: ${u.n} Zeilen, alle ${u.need} Gebäude mit richtiger Summe` + (u.bad.length ? ' – falsch: ' + u.bad.join(', ') : '') + (u.extra ? ' – zu viele' : '')); }
    ok(r.uses.holz.birds, '„Wofür“ Holz: auch Vögel im Vogelhaus');
    ok(Object.values(r.eis).every(Boolean), 'Eisenholz: tiefe Bäume, Tannenforst/Dschungel/Nebelwald/Schattenwald/Uralter Wald, Weltenbäume, Eisenholz-Setzling (Garten-Stufe, Saat, Zeit, Ernte), Basar' + (Object.values(r.eis).every(Boolean) ? '' : ' ' + JSON.stringify(r.eis)));
    ok(r.s1 === 'mat:eisenholz' && r.s2 === 'mat:eisenholz', 'Suche „eisenholz“ und „EISENHOLZ“: Eisenholz zuerst');
    ok(['mat:eisenholz', 'faq:eisenholz'].includes(r.s3) && r.s3t, 'Frage „Wie macht man Eisenholz?“: Antwort mit „Setzling“ zuerst (' + r.s3 + ')');
    ok(r.kr.length && r.kr.every(t => t.startsWith('Kräuter')) && r.kr2, 'Suche „krauter“ (ohne Umlaut) → ' + r.kr.join(', ') + '; „kraeuter“ = „Kräuter“');
    ok(!r.eisen.length, 'Suche „eisen“ findet Eisenerz, Eisenholz und den Eishaken' + (r.eisen.length ? ' – fehlt ' + r.eisen.join(', ') : ''));
    ok(r.reso, 'Resonanzen: unentdeckte nur als „???“ mit Hinweis');
    ok(r.pets, 'Begleiter-Arten: unentdeckte als „???“');
    ok(!r.err.length, 'jede Seite lässt sich bauen' + (r.err.length ? ': ' + r.err.join(', ') : ''));
    // Tempo: Index im Hintergrund, dann jeder Tastendruck (Telefon nachgestellt: Prozessor 4× langsamer)
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const sp = await page.evaluate(async () => {
      openHandbuch(null, 'title'); hbIndex(); for (const e of HB.list) if (e.ih == null) e.ih = hbIco(e.ic);
      // erst einmal durchtippen (der Browser übersetzt den Code beim ersten Mal), dann messen
      const Q = ['ei', 'eis', 'eise', 'eisen', 'eisenh', 'eisenho', 'eisenhol', 'eisenholz', 'kr', 'kra', 'krau', 'kraut', 'krauter', 'ho', 'hol', 'holz', 'dr', 'dra', 'drache', 'gold', 'schmiede'], T = [];
      for (let k = 0; k < 2; k++) for (const q of Q) { HB.q = q; const a = performance.now(); hbNavUpdate(); $('hbnav').offsetHeight; if (k) T.push(performance.now() - a); }
      T.sort((a, b) => a - b); return { med: T[Math.floor(T.length / 2)], p90: T[Math.floor(T.length * .9)] };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    ok(sp.p90 <= 30, `Suche je Tastendruck (Prozessor 4× langsamer): Median ${sp.med.toFixed(1)} ms, 90 % unter ${sp.p90.toFixed(1)} ms (Ziel ≤ 30 ms)`);
    ok(!errs.length, 'keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }

  for (const [W, H, PC] of VIEWS) {
    const pre = `${W}x${H}${PC ? ' PC' : ''}: `;
    console.log(`Handbuch – ${W}×${H}${PC ? ' (PC, Maus)' : ' (Touch)'}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: PC ? 1 : 2, isMobile: !PC, hasTouch: !PC, locale: 'de-DE' });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    await page.evaluate(([HERO_]) => eval('(' + HERO_ + ')')(), [HERO.toString()]); await page.waitForTimeout(300);
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); try { if (PC) await el.click({ timeout: 4000 }); else await el.tap({ timeout: 4000 }); } catch (e) { throw new Error('Antippen ' + sel + ': ' + e.message.split('\n')[0]); } await page.waitForTimeout(300); };
    const inView = async sel => { const el = page.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1 && r.x >= 0 && r.x + r.width <= W + 1; };
    const shot = async n => page.screenshot({ path: `${OUT}/${W}x${H}_${n}.png` });
    const st = () => page.evaluate(() => state);
    const open = () => page.evaluate(() => hbIsOpen());
    const noScroll = () => page.evaluate(() => { const X = el => !el || el.offsetParent === null || el.scrollWidth <= el.clientWidth + 1; return document.documentElement.scrollWidth <= innerWidth + 1 && X(panel) && X($('hbnav')) && X($('hbmain')); });
    // Touch: alle Knöpfe im Handbuch mindestens 44 × 44 px (nur sichtbare)
    const small = () => page.evaluate(() => { const r = []; for (const el of panel.querySelectorAll('[data-act],input')) { if (el.offsetParent === null || el.hidden) continue; const b = el.getBoundingClientRect(); if (!b.width) continue; if (b.height < 43.5 || b.width < 43.5) r.push((el.dataset.act || el.tagName) + ' ' + Math.round(b.width) + '×' + Math.round(b.height)); } return r; });

    // Hauptmenü: „?“ sichtbar ohne Scrollen
    ok(await inView('.hbtbtn'), pre + '„?“ im Hauptmenü sichtbar');
    await shot('01_titel');
    await tap('.hbtbtn');
    ok(await open() && (await st()) === 'title', pre + '„?“ öffnet das Handbuch');
    ok(await noScroll(), pre + 'Inhaltsverzeichnis: kein seitliches Scrollen');
    if (!PC) { const s = await small(); ok(!s.length, pre + 'Inhaltsverzeichnis: Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 4).join(', ') : '')); }
    await shot('02_inhalt');
    // Kapitel aufklappen
    await tap('[data-act="hb_ch"][data-id="mat"]');
    ok(await page.locator('.hbsub [data-act="hb_e"][data-id="mat:eisenholz"]').count() === 1, pre + 'Kapitel „Materialien“ aufgeklappt');
    // Suchen wie ein Spieler: tippen
    await page.locator('#hbq').click(); await page.keyboard.type('eisenholz', { delay: 30 }); await page.waitForTimeout(300);
    const first = await page.evaluate(() => { const r = panel.querySelector('.hbnav .hbr'); return r && { id: r.dataset.id, mark: !!r.querySelector('mark'), groups: panel.querySelectorAll('.hbnav .hbgh').length }; });
    ok(first && first.id === 'mat:eisenholz' && first.mark && first.groups >= 2, pre + 'Tippen „eisenholz“: Eisenholz zuerst, markiert, nach Kapiteln gruppiert');
    if (!PC) await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await shot('03_suche');
    await tap('.hbnav [data-act="hb_e"][data-id="mat:eisenholz"]');
    ok(await page.evaluate(() => HB.cur === 'mat:eisenholz' && /Setzling/.test(panel.querySelector('.hbpage').textContent)), pre + 'Eisenholz-Seite: Antwort mit „Setzling“');
    ok(await inView('.hbpage h3'), pre + 'Eisenholz-Seite: Titel sichtbar');
    ok(await noScroll(), pre + 'Eisenholz-Seite: kein seitliches Scrollen');
    if (!PC) { const s = await small(); ok(!s.length, pre + 'Eisenholz-Seite: Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 4).join(', ') : '')); }
    await shot('04_eisenholz');
    // Zuletzt gesucht
    await tap('[data-act="hb_back"]');
    ok(await page.evaluate(() => !HB.cur && HB.q === 'eisenholz'), pre + 'Zurück: wieder bei den Treffern');
    await tap('[data-act="hb_clear"]'); await page.waitForTimeout(100);
    ok(await page.locator('[data-act="hb_q"]').count() >= 1, pre + '„Zuletzt gesucht“ zeigt die Suche');
    // Gebäude und Klasse über „Siehe auch“ und Verweise
    await page.evaluate(() => hbOpenEntry('bld:schmiede')); await page.waitForTimeout(200);
    ok(await page.evaluate(() => /STUFEN, KOSTEN UND BAUZEIT/.test(panel.textContent) && panel.querySelectorAll('.hblv').length === BUILD.schmiede.lv.length), pre + 'Gebäude-Seite: alle Stufen mit Kosten und Bauzeit');
    await shot('05_gebaeude');
    await page.evaluate(() => hbOpenEntry('cls:mage')); await page.waitForTimeout(200);
    ok(await page.evaluate(() => panel.querySelector('.hbpage').textContent.includes(SKILLS.mu.n) && /TALENTE/.test(panel.textContent)), pre + 'Klassen-Seite: Fähigkeiten und Talente');
    if (!PC) { const s = await small(); ok(!s.length, pre + 'Klassen-Seite: Knöpfe ≥ 44 px' + (s.length ? ': ' + s.slice(0, 4).join(', ') : '')); }
    await shot('06_klasse');
    // „Siehe auch“ führt weiter, Zurück dorthin zurück
    const see = await page.locator('.hbsee [data-act="hb_e"]').first().getAttribute('data-id');
    await tap('.hbsee [data-act="hb_e"]');
    ok(await page.evaluate(id => HB.cur === id, see), pre + '„Siehe auch“ öffnet ' + see);
    await tap('[data-act="hb_back"]');
    ok(await page.evaluate(() => HB.cur === 'cls:mage'), pre + 'Zurück: wieder bei der Klasse');
    // Schließen → Hauptmenü
    await tap('[data-act="hb_close"]');
    ok(!(await open()) && (await st()) === 'title' && await page.locator('[data-act="new"]').count() === 1, pre + 'Schließen: zurück im Hauptmenü');
    // Deep-Link: direkt ein Eintrag, Zurück → wieder dort, woher man kam
    await page.evaluate(() => openHandbuch('mat:eisenholz', 'title')); await page.waitForTimeout(200);
    ok(await page.evaluate(() => HB.cur === 'mat:eisenholz' && /Setzling/.test(panel.textContent)), pre + 'openHandbuch(\'mat:eisenholz\') öffnet die Seite direkt');
    await tap('[data-act="hb_back"]');
    ok(!(await open()) && (await st()) === 'title', pre + 'Deep-Link: Zurück führt sofort ins Hauptmenü');

    // Einstellungen im Hauptmenü → Handbuch → Zurück
    await tap('[data-act="settings"]'); await tap('[data-act="hb_open"]');
    ok(await open(), pre + 'Einstellungen (Hauptmenü): Knopf „Handbuch“');
    await tap('[data-act="hb_back"]');
    ok(await page.evaluate(() => /EINSTELLUNGEN/.test(panel.textContent) && !!panel.querySelector('[data-act="langs"]')), pre + 'Zurück: wieder in den Einstellungen');
    await tap('[data-act="setback"]');

    // Weltkarte → Mehr → Handbuch → Zurück
    await page.evaluate(() => { activateChar(0); P.map = genMap(3); openMap(); }); await page.waitForTimeout(400);
    await tap('[data-act="mapmore"]'); await tap('[data-act="hb_open"]');
    ok(await open() && (await st()) === 'menu', pre + 'Karte → Mehr → Handbuch');
    const go = await page.evaluate(() => { hbOpenEntry('en:tausend'); return [...panel.querySelectorAll('[data-act="hb_go"]')].map(b => b.textContent); });
    ok(go.some(t => /Boss-Kodex/.test(t)), pre + 'von der Karte: Knopf „Zum Boss-Kodex“');
    await tap('[data-act="hb_close"]');
    ok((await st()) === 'map' && await page.locator('[data-act="tomapview"]').count() === 1, pre + 'Schließen: zurück unter „Mehr“ auf der Karte');

    // Kampagne: Pause → Handbuch → Zurück → Pause → Weiter: gleicher Raum, Gegner noch da
    await page.evaluate(() => { hideOverlay(); P.map.pos = { r: 0, i: 0 }; startRoom('kampf', 1); P.inv = 1e9; }); await page.waitForTimeout(1600);
    const before = await page.evaluate(() => { window.__G = G; return { n: enemies.filter(e => !e.dead).length, hp: enemies.map(e => Math.round(e.hp)).join(), wi: G.wi }; });
    await page.evaluate(() => showPause()); await page.waitForTimeout(200);
    ok(await page.locator('[data-act="hb_open"]').count() === 1 && await page.locator('[data-act="settings"][data-id="pause"]').count() === 1, pre + 'Pause: Knöpfe „Handbuch“ und „Einstellungen“');
    await shot('07_pause');
    await tap('[data-act="hb_open"]');
    ok(await open() && (await st()) === 'menu', pre + 'Pause → Handbuch: Spiel bleibt angehalten');
    const go2 = await page.evaluate(() => { hbOpenEntry('bld:schmiede'); return panel.querySelectorAll('[data-act="hb_go"]').length; });
    ok(go2 === 0, pre + 'mitten im Kampf: keine Sprünge zu anderen Bildschirmen');
    await shot('08_pause_handbuch');
    await page.waitForTimeout(500);
    await tap('[data-act="hb_close"]');
    ok((await st()) === 'pause' && await page.locator('[data-act="resume"]').count() === 1, pre + 'Zurück: wieder in der Pause');
    await tap('[data-act="resume"]');
    const after = await page.evaluate(() => ({ same: window.__G === G, n: enemies.filter(e => !e.dead).length, hp: enemies.map(e => Math.round(e.hp)).join(), wi: G.wi, st: state }));
    ok(after.same && after.st === 'play' && after.n === before.n && after.hp === before.hp && after.wi === before.wi, pre + 'Weiter: gleicher Raum, dieselben Gegner, nichts weitergelaufen');
    // Einstellungen aus der Pause → Handbuch → Zurück → Einstellungen → Zurück → Pause → Weiter
    await page.evaluate(() => showPause()); await page.waitForTimeout(200);
    await tap('[data-act="settings"][data-id="pause"]');
    ok(await page.evaluate(() => state === 'menu' && /EINSTELLUNGEN/.test(panel.textContent) && !panel.querySelector('[data-act="langs"]')), pre + 'Einstellungen aus der Pause: angehalten, ohne Sprachwahl (die lädt neu)');
    await shot('09_einstellungen_pause');
    await tap('[data-act="hb_open"]');
    ok(await open(), pre + 'Einstellungen (Pause) → Handbuch');
    await tap('[data-act="hb_back"]');
    ok(await page.evaluate(() => /EINSTELLUNGEN/.test(panel.textContent) && state === 'menu'), pre + 'Zurück: wieder in den Einstellungen');
    await tap('[data-act="setback"]');
    ok((await st()) === 'pause', pre + 'Einstellungen → Zurück: Pause');
    await tap('[data-act="resume"]');
    ok(await page.evaluate(() => state === 'play' && window.__G === G), pre + 'Weiter: derselbe Raum');

    // Versteck: Bibliothek → Reiter Handbuch → Zurück; „?“ an fehlendem Material beim Ausbau → Handbuch → Zurück zur Baustelle
    await page.evaluate(() => { enterHideout(); openStation('bibliothek'); }); await page.waitForTimeout(400);
    await tap('[data-act="ltab"][data-id="hb"]');
    ok(await open(), pre + 'Bibliothek: Reiter „Handbuch“');
    const go3 = await page.evaluate(() => { hbOpenEntry('bld:schmiede'); return [...panel.querySelectorAll('[data-act="hb_go"]')].some(b => b.textContent.includes(BUILD.schmiede.n)); });
    ok(go3, pre + 'im Versteck: Knopf „Zu: Schmiede“');
    await tap('[data-act="hb_close"]');
    ok(await page.evaluate(() => /BIBLIOTHEK/.test((panel.querySelector('h2') || {}).textContent)), pre + 'Schließen: zurück in der Bibliothek');
    await page.evaluate(() => { P.mats = {}; openStation('mine'); }); await page.waitForTimeout(300);
    const ml = page.locator('.hbml[data-from="station"]');
    ok(await ml.count() === 1, pre + 'Ausbau: „?“ am fehlenden Material');
    await tap('.hbml[data-from="station"]');
    ok(await page.evaluate(() => hbIsOpen() && /^mat:/.test(HB.cur)), pre + '„?“ öffnet das Material im Handbuch');
    await tap('[data-act="hb_back"]');
    ok(await page.evaluate(() => /ERZMINE/.test((panel.querySelector('h2') || {}).textContent)), pre + 'Zurück: wieder an der Baustelle');
    await page.evaluate(() => backToHide());

    // Endlose Lande: Pause → Handbuch → Zurück → Weiter – Ausflug läuft, Rucksack unverändert
    await page.evaluate(() => { SAVE.meta.pets.starter = true; landeStart('tor'); }); await page.waitForTimeout(1200);
    const L0 = await page.evaluate(() => { LW.huntT = 1e9; LW.rivT = 1e9; P.inv = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.pack.push({ t: 'item', it: lItem(2, 2) }, { t: 'item', it: lItem(2, 3) }); lPouchPut({ t: 'gold', n: 77 }); return { on: landeActive(), pack: JSON.stringify(LW.pack), gold: lPouchHas('gold'), x: Math.round(P.x), y: Math.round(P.y) }; });
    ok(L0.on, pre + 'Endlose Lande: Ausflug läuft');
    await page.evaluate(() => showPause()); await page.waitForTimeout(400);
    ok(await page.locator('[data-act="l_quit"]').count() === 1 && await page.locator('[data-act="hb_open"]').count() === 1, pre + 'Lande-Pause: „Handbuch“ neben „Ausflug abbrechen“');
    await shot('10_lande_pause');
    await tap('[data-act="hb_open"]'); await page.waitForTimeout(500);
    ok(await page.evaluate(() => hbIsOpen() && state === 'menu' && landeActive() && !!panel.querySelector('.hbhead')), pre + 'Lande-Pause → Handbuch: Ausflug läuft weiter, Handbuch bleibt unverändert');
    const go4 = await page.evaluate(() => { hbOpenEntry('lande:regeln'); return panel.querySelectorAll('[data-act="hb_go"]').length; });
    ok(go4 === 0, pre + 'in den Landen: keine Sprünge zu anderen Bildschirmen');
    await shot('11_lande_handbuch');
    await tap('[data-act="hb_close"]'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => state === 'pause' && !!panel.querySelector('[data-act="l_quit"]')), pre + 'Zurück: Pause der Lande (Abbrechen statt Hauptmenü)');
    await tap('[data-act="settings"][data-id="pause"]'); await tap('[data-act="hb_open"]'); await tap('[data-act="hb_back"]');
    ok(await page.evaluate(() => /EINSTELLUNGEN/.test(panel.textContent) && landeActive()), pre + 'Lande: Einstellungen → Handbuch → Zurück zu den Einstellungen');
    await tap('[data-act="setback"]'); await page.waitForTimeout(300);
    await tap('[data-act="resume"]');
    const L1 = await page.evaluate(() => ({ on: landeActive(), st: state, pack: JSON.stringify(LW.pack), gold: lPouchHas('gold'), x: Math.round(P.x), y: Math.round(P.y), g: G && G.type }));
    ok(L1.on && L1.st === 'play' && L1.g === 'lande' && L1.pack === L0.pack && L1.gold === L0.gold && L1.x === L0.x && L1.y === L0.y, pre + 'Weiter: Ausflug läuft, Rucksack und Sammelbeutel unverändert, kein Abbruch');
    ok(!errs.length, pre + 'keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }

  console.log('Handbuch – Englisch');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1500);
    const r = await page.evaluate(([HERO_]) => { eval('(' + HERO_ + ')')(); openHandbuch(null, 'title'); hbIndex(); return { lang: LANG, holz: MATS.holz.n, wood: hbSearch('wood')[0], de: hbSearch('Holz')[0], q: !!document.querySelector('.hbtbtn') }; }, [HERO.toString()]);
    ok(r.lang === 'en' && r.holz !== 'Holz' && r.wood === 'mat:holz', `Englisch: „wood“ findet ${r.holz} (Holz)`);
    ok(r.de === 'mat:holz', 'Englisch: auch der deutsche Name „Holz“ findet es');
    await page.screenshot({ path: `${OUT}/en_inhalt.png` });
    ok(!errs.length, 'Englisch: keine Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  console.log('  Bilder: ' + OUT);
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
