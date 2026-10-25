// iPhone-Prüfung (Chromium mit iPhone-Maßen und -Kennung). Aufruf: node iphone.js "<Gerät>" [tiktok]
// Kein Dreh-Zwang, Titel sichtbar, Hinweis im TikTok-Browser, Joystick bewegt den Helden,
// alle Knöpfe im Bild, Knöpfe weichen dem Home-Balken aus.
const { chromium, devices } = require('playwright');
const dev = process.argv[2] || 'iPhone 13', tiktok = process.argv[3] === 'tiktok';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

(async () => {
  const b = await chromium.launch();
  const d = Object.assign({}, devices[dev]); delete d.defaultBrowserType;
  if (tiktok) d.userAgent += ' musical_ly_31.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/de BytedanceWebview/d8a21c6';
  const ctx = await b.newContext(d); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(BASE + 'index.html'); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(1500);
  console.log(`${dev}${tiktok ? ' im TikTok-Browser' : ''}`);
  const info = await page.evaluate(() => ({ vw: innerWidth, vh: innerHeight, title: !ov.hidden && !!panel.querySelector('.logo'), inapp: !!panel.querySelector('.inapp') }));
  ok(info.title, 'Titelmenü sichtbar, kein Dreh-Hinweis');
  ok(info.inapp === tiktok, tiktok ? 'Hinweis „Im Browser öffnen“ sichtbar' : 'kein In-App-Hinweis in Safari');
  if (info.inapp) { await page.locator('[data-act="inappok"]').tap(); await page.waitForTimeout(300); ok(!(await page.locator('.inapp').count()), 'Hinweis lässt sich ausblenden'); }
  await page.locator('[data-act="new"]').tap(); await page.waitForTimeout(300);
  await page.locator('[data-act="cstart"]').tap(); await page.waitForTimeout(300);
  for (let i = 0; i < 15 && await page.locator('[data-act="dlgnext"]').count(); i++) { await page.locator('[data-act="dlgnext"]').tap(); await page.waitForTimeout(150); }
  await page.evaluate(() => { hideOverlay(); startRoom('kampf', 0); }); await page.waitForTimeout(1500);
  const before = await page.evaluate(() => [P.x, P.y]);
  const cdp = await ctx.newCDPSession(page), tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const x0 = info.vw * .2, y0 = info.vh * .75;
  await tp('touchStart', [{ x: x0, y: y0, id: 1 }]);
  for (let k = 1; k <= 10; k++) { await tp('touchMove', [{ x: x0 + k * 6, y: y0 - k * 3, id: 1 }]); await page.waitForTimeout(40); }
  await page.waitForTimeout(600); await tp('touchEnd', []);
  const after = await page.evaluate(() => [P.x, P.y]);
  ok(Math.hypot(after[0] - before[0], after[1] - before[1]) > 20, 'Joystick bewegt den Helden');
  const out = await page.evaluate(() => ['bAtk', 'bRoll', 'bS1', 'bS2', 'bS3', 'bUlt', 'bPot'].filter(id => { const r = $(id).getBoundingClientRect(); return !(r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight); }));
  ok(!out.length, 'alle Knöpfe im Bild' + (out.length ? ' (raus: ' + out.join(', ') + ')' : ''));
  const shift = await page.evaluate(() => { const a = $('bRoll').getBoundingClientRect().bottom; SAFE.style.padding = '47px 47px 34px 47px'; applyLayout(); const b2 = $('bRoll').getBoundingClientRect().bottom; SAFE.style.padding = ''; applyLayout(); return a - b2; });
  ok(Math.abs(shift - 34) < 2, 'Knöpfe weichen dem Home-Balken aus');
  ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('  FAIL Abbruch: ' + e.message.split('\n')[0]); process.exit(1); });
