// Echte Abläufe mit Antippen auf einem Touch-Gerät. Aufruf: node flows.js <breite> <höhe>
// Prüft: neuer Held, Karte (Info + zweites Antippen), Kampf, Charakter mit Details, Versteck mit Station,
// Knopf-Editor speichert je Ausrichtung, Drehen im Kampf pausiert nicht, Neuigkeiten nach Update.
const { chromium } = require('playwright');
const [W, H] = [+process.argv[2] || 390, +process.argv[3] || 844];
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  const st = () => page.evaluate(() => state);
  const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => { }); await el.tap({ timeout: 4000 }); await page.waitForTimeout(250); };
  const inView = async sel => { const el = page.locator(sel).first(); if (!(await el.count())) return false; const r = await el.boundingBox(); return !!r && r.y >= 0 && r.y + r.height <= H + 1; };
  console.log(`Abläufe ${W}x${H}`);

  ok(!(await page.evaluate(() => newsUnseen())), 'neuer Spieler bekommt keine Neuigkeiten-Seite');
  await tap('[data-act="new"]');
  ok(await inView('[data-act="cstart"]'), 'Abenteuer-Knopf ohne Scrollen sichtbar');
  await tap('[data-act="ccls"][data-id="mage"]'); await tap('[data-act="cstart"]');
  for (let i = 0; i < 15 && await page.locator('[data-act="dlgnext"]').count(); i++) await tap('[data-act="dlgnext"]');
  ok((await st()) === 'map', 'Weltkarte nach dem Prolog');

  await page.locator('.node.av').first().tap(); await page.waitForTimeout(250);
  if ((await st()) === 'map') {
    ok(await inView('[data-act="enter"]'), 'Betreten-Knopf sichtbar');
    ok((await page.locator('.mapinfo .nm').count()) === 1, 'Ort-Info auf der Karte');
    await page.locator('.node.av.sel').first().tap(); await page.waitForTimeout(800);
  }
  ok(['play', 'menu'].includes(await st()), 'Ort betreten');
  await page.evaluate(() => { if (state !== 'play') { hideOverlay(); startRoom('kampf', 0); } P.inv = 999; });
  for (let k = 0; k < 40; k++) { const s = await page.evaluate(() => { for (const e of enemies) hurtEnemy(e, 1e9, 0, 0, 0); return state; }); if (s !== 'play') break; await page.waitForTimeout(300); }
  for (let i = 0; i < 6 && (await st()) !== 'map'; i++) { const btn = page.locator('#panel .btn:not(:disabled)').first(); if (await btn.count()) await btn.tap(); await page.waitForTimeout(400); }
  ok((await st()) === 'map', 'Kampf gewonnen, zurück auf der Karte');

  await page.evaluate(() => { for (let i = 0; i < 6; i++) P.bag.push(randomItem(5, ri(1, 4))); saveChar(); openMap(); });
  await tap('[data-act="char"]');
  ok(await inView('[data-act="cback"]'), 'Charakter: Zurück oben sichtbar');
  await tap('#panel .grid [data-act="isel"]');
  ok(await inView('[data-act="sell"]'), 'Charakter: Verkaufen sichtbar ohne Scrollen');
  await tap('[data-act="cback"]');
  await tap('[data-act="mapmore"]'); await tap('[data-act="news"]');
  ok((await page.locator('details.news').count()) > 0, 'Neuigkeiten-Seite');
  await tap('[data-act="newsback"]');
  ok((await st()) === 'map', 'zurück zur Karte');

  await page.evaluate(() => { SAVE.meta.hide.intro = true; SAVE.meta.hide.b.schmiede = 1; P.gold = 99999; persist(); });
  await tap('[data-act="hide"]'); await page.waitForTimeout(800);
  await page.evaluate(() => { const p = hidePos('schmiede'); P.x = p.x + 4; P.y = p.y + 22; }); await page.waitForTimeout(500);
  ok(await page.locator('#bAct').isVisible(), 'Versteck: Interagieren-Knopf');
  await page.locator('#bAct').tap(); await page.waitForTimeout(400);
  ok((await page.evaluate(() => (panel.querySelector('h2') || {}).textContent)) === 'SCHMIEDE', 'Versteck: Schmiede geöffnet');
  await tap('[data-act="wbdone"]');

  await page.evaluate(() => showPause()); await tap('[data-act="ctledit"]');
  const bb = await page.locator('#bRoll').boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x - 40, bb.y - 60, { steps: 5 }); await page.mouse.up();
  const lay = await page.evaluate(() => ({ P: Object.keys(ctlSet().layoutP || {}).length, L: Object.keys(ctlSet().layout || {}).length, por: portrait() }));
  ok(lay.por ? lay.P === 1 && lay.L === 0 : lay.L === 1 && lay.P === 0, 'Knopf-Editor speichert nur für die aktuelle Ausrichtung');
  await tap('#ctlbar [data-e="done"]');

  await page.evaluate(() => { if (state === 'pause') { setState('play'); hideOverlay(); showHud(true); } leaveHideout(); hideOverlay(); startRoom('kampf', 1); });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen()); await page.waitForTimeout(300);
  await page.setViewportSize({ width: H, height: W }); await page.waitForTimeout(700);
  ok((await st()) === 'play', 'Drehen im Kampf pausiert nicht');
  ok(await page.evaluate(() => { const r = $('bAtk').getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0 && r.top >= 0; }), 'Angriffsknopf nach dem Drehen im Bild');
  await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(400);

  await page.evaluate(() => { SAVE.meta.seenVer = '0.0.1'; persist(); }); await page.reload(); await page.waitForTimeout(1500);
  ok((await page.evaluate(() => (panel.querySelector('h2') || {}).textContent)) === 'NEUIGKEITEN', 'nach Update öffnen sich die Neuigkeiten einmal');
  ok((await page.evaluate(() => SAVE.meta.seenVer)) === (await page.evaluate(() => VERSION)), 'Neuigkeiten als gelesen gespeichert');

  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
