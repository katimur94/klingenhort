// Spielstand-Test: ein Spielstand aus der Live-Version muss in der neuen Version laden und spielbar sein.
// Aufruf: node savecompat.js   (OLD = Live-Seite, BASE = lokale neue Version)
const { chromium } = require('playwright');
const OLD = (process.env.OLD || 'https://katimur94.github.io/klingenhort/').replace(/\/?$/, '/');
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 844, height: 390 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  console.log('Spielstand von', OLD, '→', BASE);
  try { await page.goto(OLD + 'index.html', { timeout: 20000 }); } catch (e) { console.log('  ok   Live-Seite nicht erreichbar – Test übersprungen'); await b.close(); return; }
  await page.waitForTimeout(1500);
  const old = await page.evaluate(() => {
    localStorage.clear(); loadAll();
    for (const [i, cls] of ['knight', 'mage', 'rogue', 'ranger'].entries()) {
      const c = newChar(cls, 'Alt-' + cls, i % 2 ? 'nightmare' : 'normal', i === 3); SAVE.chars.push(c); activateChar(SAVE.chars.length - 1);
      P.lv = 20 + i * 8; P.act = 2 + i; P.maxAct = 2 + i; P.gold = 4000 + i;
      for (let k = 0; k < 8; k++) addToBag(randomItem(10 + i * 4, k % 5));
      P.map = genMap(P.act); saveChar();
    }
    SAVE.meta.bestiary = { goblin: 4, ogre: 1 };
    if (SAVE.meta.hide) SAVE.meta.hide.b = { schmiede: 2, alchemie: 1, tempel: 1 };
    persist();
    return { save: localStorage.getItem(SAVE_KEY), key: SAVE_KEY, version: VERSION, n: SAVE.chars.length, gold: SAVE.chars.map(c => c.gold) };
  });
  ok(!errs.length, `alte Version ${old.version}: Spielstand angelegt`);
  await page.goto(BASE + 'index.html'); await page.evaluate(([k, s]) => { localStorage.clear(); localStorage.setItem(k, s); }, [old.key, old.save]);
  await page.reload(); await page.waitForTimeout(1500);
  const now = await page.evaluate(() => ({ version: VERSION, n: SAVE.chars.length, gold: SAVE.chars.map(c => c.gold), title: !ov.hidden }));
  ok(now.n === old.n, `neue Version ${now.version}: alle ${old.n} Helden da`);
  ok(JSON.stringify(now.gold) === JSON.stringify(old.gold), 'Gold unverändert');
  for (let i = 0; i < old.n; i++) {
    const r = await page.evaluate(i => { try { activateChar(i); hideOverlay(); openMap(); if (typeof DLG !== 'undefined' && DLG) DLG.skip(); computeStats(); return P.st && P.st.hp > 0 && P.map ? 'ok' : 'leer'; } catch (e) { return e.message; } }, i);
    ok(r === 'ok', `Held ${i + 1} lädt und öffnet die Karte`);
  }
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
