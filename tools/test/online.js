// Konto & Cloud (js/online.js) gegen ein nachgebautes Supabase im Test selbst (page.route auf https://mock.supabase.test/**,
// Daten im Speicher dieses Skripts – zwei Browser-Kontexte = zwei Geräte desselben Spielers).
// Prüft: ohne Zugang schläft alles (keine Anfrage, kein Knopf, kein Handbuch-Eintrag), service_role-Schlüssel wird abgelehnt,
// Anmelden per Code (Link schicken → Code), Google (Rückkehr mit #access_token), Hochladen gebündelt nach persist(),
// zweites Gerät holt den Spielstand, Auswahl bei zwei verschiedenen Ständen (beide Seiten) + Backup tauschen, Start holt Neues,
// offline → später sichern, Token erneuern (vor Ablauf und nach 401), toter Refresh-Token meldet ab, kaputte/neuere Cloud-Daten
// werden nicht geladen, Abmelden lässt den Spielstand, Cloud-Spielstand löschen, Konto löschen.
// Hoch, quer und PC: kein seitliches Scrollen, Ziele ≥ 44 px, Bilder zum Ansehen.
// Aufruf: node online.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/online';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const MOCK = 'https://mock.supabase.test';
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const GAP = 1500;
const CFG = `window.KH_ONLINE = { url: '${MOCK}', anon: 'anon-test-key-0123456789abcdef', gap: ${GAP} };`;
const UA = { android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };

/* ---------- Supabase im Speicher ---------- */
const DB = { down: false, users: {}, byMail: {}, otp: {}, tokens: {}, refresh: {}, saves: {}, profiles: {}, log: [], ttl: 3600, refreshed: 0, redirect: null, n: 0 };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = p => b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64(p) + '.sig';
// jsonb sortiert Schlüssel um – hier auch, damit das Spiel Inhalte vergleicht statt Texte
const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.keys(v).sort().reverse().reduce((o, k) => (o[k] = sortKeys(v[k]), o), {}) : v;
function user(mail) { if (!DB.byMail[mail]) { const id = 'u' + (++DB.n) + '-0000-4000-8000-000000000000'; DB.users[id] = { id, email: mail }; DB.byMail[mail] = id; } return DB.byMail[mail]; }
function session(uid) {
  const u = DB.users[uid], exp = Math.floor(Date.now() / 1000) + DB.ttl, at = jwt({ sub: uid, email: u.email, exp, role: 'authenticated', j: Math.random() }), rt = 'rt-' + Math.random().toString(36).slice(2);
  DB.tokens[at] = { uid, exp: exp * 1000 }; DB.refresh[rt] = uid;
  return { access_token: at, refresh_token: rt, expires_in: DB.ttl, expires_at: exp, token_type: 'bearer', user: { id: uid, email: u.email } };
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey, authorization, content-type, prefer', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' };
async function mock(route) {
  const req = route.request(), u = new URL(req.url()), m = req.method(), p = u.pathname, hd = req.headers();
  const send = (status, body) => route.fulfill({ status, headers: Object.assign({ 'content-type': 'application/json' }, CORS), body: body == null ? '' : JSON.stringify(body) });
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const auth = (hd.authorization || '').replace(/^Bearer /, '');
  if (DB.down) return route.abort('internetdisconnected');   // offline (setOffline allein hält abgefangene Anfragen nicht auf)
  DB.log.push({ m, p, q: u.search, t: Date.now(), auth });
  if (!hd.apikey && p !== '/auth/v1/authorize') return send(401, { message: 'No API key found in request' });   // authorize: Browser-Weiterleitung ohne Schlüssel
  let body = null; try { body = req.postData() ? JSON.parse(req.postData()) : null; } catch (_) { return send(400, { message: 'bad json' }); }
  if (p === '/auth/v1/otp' && m === 'POST') { if (!body || !/@/.test(body.email || '')) return send(400, { msg: 'invalid email' }); DB.otp[body.email] = '123456'; DB.redirect = u.searchParams.get('redirect_to'); return send(200, {}); }
  if (p === '/auth/v1/verify' && m === 'POST') { if (!body || DB.otp[body.email] !== body.token || body.type !== 'email') return send(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }); delete DB.otp[body.email]; return send(200, session(user(body.email))); }
  if (p === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token') { const uid = body && DB.refresh[body.refresh_token]; if (!uid || !DB.users[uid]) return send(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' }); delete DB.refresh[body.refresh_token]; DB.refreshed++; return send(200, session(uid)); }
  if (p === '/auth/v1/logout') { delete DB.tokens[auth]; return route.fulfill({ status: 204, headers: CORS }); }
  if (p === '/auth/v1/authorize') { const s = session(user('google@test.de')), to = u.searchParams.get('redirect_to'); return route.fulfill({ status: 302, headers: { location: `${to}#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=${s.expires_in}&refresh_token=${s.refresh_token}&token_type=bearer&type=signup` } }); }
  const k = DB.tokens[auth], uid = k && k.exp > Date.now() && DB.users[k.uid] ? k.uid : null;
  if (!uid) return send(401, { code: 'PGRST301', message: 'JWT expired' });
  if (p === '/rest/v1/saves' && m === 'GET') { if (u.searchParams.get('user_id') !== 'eq.' + uid) return send(200, []); const r = DB.saves[uid]; return send(200, r ? [{ data: r.data, version: r.version, rev: r.rev, updated_at: r.updated_at, device: r.device }] : []); }
  if (p === '/rest/v1/saves' && m === 'DELETE') { if (u.searchParams.get('user_id') === 'eq.' + uid) delete DB.saves[uid]; return route.fulfill({ status: 204, headers: CORS }); }
  if (p === '/rest/v1/rpc/kh_put_save' && m === 'POST') {
    const d = body.p_data; if (Buffer.byteLength(JSON.stringify(d)) >= 1572864) return send(400, { code: '23514', message: 'new row for relation "saves" violates check constraint "saves_size"' });
    if (!d || typeof d !== 'object' || !Array.isArray(d.chars)) return send(400, { code: '23514', message: 'saves_shape' });
    const cur = DB.saves[uid], base = +body.p_base || 0;
    if ((base === 0 && cur) || (base > 0 && (!cur || cur.rev !== base))) return send(200, { ok: false, rev: cur ? cur.rev : 0 });
    const rev = cur ? cur.rev + 1 : 1, now = new Date().toISOString();
    DB.saves[uid] = { data: sortKeys(d), version: body.p_version, device: body.p_device, rev, updated_at: now };
    return send(200, { ok: true, rev, updated_at: now });
  }
  if (p === '/rest/v1/profiles' && m === 'GET') { const r = DB.profiles[uid]; return send(200, r ? [{ name: r.name }] : []); }
  if (p === '/rest/v1/profiles' && m === 'POST') { if (body.id !== uid) return send(403, { message: 'row-level security' }); if (!/^[\p{L}\p{N} _.\-]{2,20}$/u.test(body.name || '')) return send(400, { code: '23514', message: 'profiles_name_chars' }); DB.profiles[uid] = { name: body.name }; return route.fulfill({ status: 201, headers: CORS }); }
  if (p === '/rest/v1/rpc/kh_delete_me' && m === 'POST') { const mail = DB.users[uid].email; delete DB.users[uid]; delete DB.byMail[mail]; delete DB.saves[uid]; delete DB.profiles[uid]; return route.fulfill({ status: 204, headers: CORS }); }
  return send(404, { message: 'unbekannt ' + m + ' ' + p });
}
const puts = () => DB.log.filter(x => x.p === '/rest/v1/rpc/kh_put_save').length;
const row = mail => DB.saves[DB.byMail[mail]];

/* ---------- Geräte ---------- */
let B;
async function device(name, o) {
  o = Object.assign({ w: 390, h: 844, ua: UA.android, cfg: CFG }, o || {});
  const pc = o.w >= 1000;
  const ctx = await B.newContext({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: pc ? 1 : 2, isMobile: !pc, hasTouch: !pc, locale: 'de-DE', userAgent: o.ua, serviceWorkers: 'block' });
  if (o.cfg) await ctx.route('**/js/online-config.js', r => r.fulfill({ contentType: 'application/javascript', body: o.cfg }));
  await ctx.route(/^https:\/\/mock\.supabase\.test\//, mock);
  const page = await ctx.newPage(), errs = [], reqs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  page.on('request', r => reqs.push(r.url()));
  await page.goto(BASE + 'index.html'); await page.waitForTimeout(1300);
  return { name, ctx, page, errs, reqs };
}
// Held anlegen bzw. Gold ändern und speichern (wie im Spiel: saveChar → persist)
const HERO = (name, gold) => { const c = newChar('knight', name, 'normal', false); c.lv = 12; c.act = 2; c.maxAct = 2; SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); P.gold = gold; saveChar(); titleScene(); showTitle(); };
const setGold = (pg, g) => pg.evaluate(g => { P.gold = g; saveChar(); }, g);
const gold = pg => pg.evaluate(() => SAVE.chars[0] && SAVE.chars[0].gold);
async function signIn(d, mail) {
  const pg = d.page;
  await pg.evaluate(() => { if (!panel.querySelector('#olpage')) ON.ol_open('title'); });
  await pg.fill('#ol_mail', mail); await pg.click('[data-act="ol_link"]');
  await pg.waitForSelector('#ol_code', { timeout: 5000 });
  await pg.fill('#ol_code', '123456'); await pg.click('[data-act="ol_code"]');
  await pg.waitForFunction(() => OL.ses && !OL.busy && OL.st !== 'busy', null, { timeout: 8000 });
  await pg.waitForTimeout(300);
}
// Panel: kein seitliches Scrollen, alles Antippbare ≥ 44 px hoch
const LAYOUT = () => {
  const over = panel.scrollWidth > panel.clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1;
  const small = [...panel.querySelectorAll('button, input, a')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5).map(e => (e.dataset.act || e.id || e.tagName) + ':' + Math.round(e.getBoundingClientRect().height));
  return { over, small };
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  B = await chromium.launch();

  console.log('Ohne Zugang: alles schläft');
  {
    const d = await device('aus', { cfg: null });
    const r = await d.page.evaluate(([HERO_]) => {
      eval('(' + HERO_ + ')')('Ruhig', 50);
      const t = panel.innerHTML; showSettings('title'); const s = panel.innerHTML; persist(); hbBuild();
      return { cfg: window.KH_ONLINE, on: OL.on, title: /ol_open|Konto/.test(t), set: /ol_open|Konto/.test(s), css: !!document.getElementById('olcss'), hooks: HOOK.persist.length + HOOK.setBtns.length, tm: OL.tm, hb: hbEntries().some(e => e.id === 'start:konto'), go: 'konto' in HBGO };
    }, [HERO.toString()]);
    await d.page.waitForTimeout(GAP + 800);
    const foreign = d.reqs.filter(u => !u.startsWith(BASE) && !/fonts\.(googleapis|gstatic)\.com/.test(u) && !u.startsWith('data:'));
    ok(r.cfg === null && !r.on, 'js/online-config.js setzt KH_ONLINE = null → aus');
    ok(!foreign.length && !DB.log.length, 'keine Anfrage nach draußen' + (foreign.length ? ': ' + foreign.slice(0, 3).join(' ') : ''));
    ok(!r.title && !r.set, 'kein Konto-Knopf im Hauptmenü und in den Einstellungen');
    ok(!r.css && !r.hooks && !r.tm, 'keine Hooks, kein CSS, kein Timer');
    ok(!r.hb && !r.go, 'kein Handbuch-Eintrag „Konto & Cloud“');
    ok(!d.errs.length, 'keine Fehler' + (d.errs.length ? ': ' + d.errs.slice(0, 2).join(' | ') : ''));
    await d.ctx.close();
    const bad = await device('geheim', { cfg: `window.KH_ONLINE = { url: '${MOCK}', anon: '${jwt({ role: 'service_role', iss: 'supabase' })}' };` });
    const r2 = await bad.page.evaluate(() => ({ on: OL.on, btn: !!panel.querySelector('[data-act="ol_open"]') }));
    ok(!r2.on && !r2.btn && !DB.log.length, 'service_role-Schlüssel: Online bleibt aus');
    await bad.ctx.close();
  }

  console.log('Gerät A: Anmelden per Code, erstes Hochladen, gebündelt nach persist()');
  const A = await device('A', { ua: UA.android });
  {
    const pg = A.page;
    await pg.evaluate(([HERO_]) => eval('(' + HERO_ + ')')('Anna', 1000), [HERO.toString()]);
    const t = await pg.evaluate(() => ({ btn: !!panel.querySelector('[data-act="ol_open"] #olst'), txt: ($('olst') || {}).textContent, css: !!$('olcss') }));
    ok(t.btn && /Nicht angemeldet/.test(t.txt) && t.css, 'Hauptmenü: Knopf „☁ Konto“ mit Status „Nicht angemeldet“');
    ok(!DB.log.length, 'nicht angemeldet: keine Anfrage');
    await pg.evaluate(() => ON.ol_open('title'));
    await pg.fill('#ol_mail', 'keine-mail'); await pg.click('[data-act="ol_link"]');
    ok(await pg.evaluate(() => /gültige E-Mail/.test(panel.textContent)) && !DB.log.length, 'ungültige E-Mail: Hinweis, keine Anfrage');
    await signIn(A, 'held@test.de');
    const r = await pg.evaluate(() => ({ ses: !!OL.ses, mail: OL.ses && OL.ses.mail, st: OL.st, stat: ($('olstat') || {}).textContent, ls: !!localStorage.getItem('klingenhort.konto') }));
    ok(DB.redirect === BASE + 'index.html', `Link schicken: Rückkehr-Adresse ${DB.redirect}`);
    ok(r.ses && r.mail === 'held@test.de' && r.ls, 'Code bestätigt: angemeldet, Sitzung unter eigenem Schlüssel');
    await pg.waitForFunction(() => OL.st === 'ok' && OL.S.rev === 1, null, { timeout: 5000 }).catch(() => { });
    const R = row('held@test.de');
    ok(R && R.rev === 1 && R.data.chars[0].name === 'Anna' && R.data.chars[0].gold === 1000 && R.device === 'Android · Chrome' && R.version, 'leere Cloud: Spielstand hochgeladen (Rev. 1, Gerät „Android · Chrome“)');
    ok(/Zuletzt gesichert/.test(await pg.evaluate(() => ($('olstat') || {}).textContent)), 'Status: „Zuletzt gesichert: …“');
    // Name
    await pg.fill('#ol_name', '<x>'); await pg.click('[data-act="ol_name"]');
    const bad = await pg.evaluate(() => /2–20 Zeichen/.test(($('olpage') || {}).textContent));
    await pg.fill('#ol_name', 'Anna die Kühne'); await pg.click('[data-act="ol_name"]'); await pg.waitForTimeout(300);
    ok(bad && DB.profiles[DB.byMail['held@test.de']] && DB.profiles[DB.byMail['held@test.de']].name === 'Anna die Kühne', 'Anzeigename: falscher abgelehnt, „Anna die Kühne“ gespeichert');
    // gebündelt: drei Speicherungen schnell hintereinander → ein Hochladen, frühestens nach der Wartezeit
    await pg.waitForTimeout(GAP);
    const n0 = puts();
    await pg.evaluate(() => { for (const g of [1001, 1002, 1003]) { P.gold = g; saveChar(); } });
    await pg.waitForTimeout(400); const n1 = puts();
    await pg.waitForTimeout(GAP + 600); const n2 = puts();
    ok(n1 === n0 && n2 === n0 + 1 && row('held@test.de').data.chars[0].gold === 1003 && row('held@test.de').rev === 2, `3× persist() → nach ${GAP} ms genau 1× hochgeladen (Rev. 2, Gold 1003) [${n0}→${n1}→${n2}]`);
    await pg.waitForTimeout(GAP + 300);
    const n3 = puts(); await pg.evaluate(() => persist()); await pg.waitForTimeout(GAP + 600);
    ok(puts() === n3, 'persist() ohne Änderung: nichts hochgeladen');
    // Seite verlassen: sofort sichern
    await setGold(pg, 1004); const n4 = puts();
    await pg.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); dispatchEvent(new Event('visibilitychange')); document.dispatchEvent(new Event('visibilitychange')); });
    await pg.waitForTimeout(400);
    await pg.evaluate(() => { delete document.visibilityState; });
    ok(puts() === n4 + 1 && row('held@test.de').data.chars[0].gold === 1004, 'Seite wird verborgen: ausstehende Sicherung sofort');
    ok(await pg.evaluate(() => hbBuild() || hbEntries().some(e => e.id === 'start:konto') && /Konto/.test(hbText('start:konto'))), 'Handbuch: Eintrag „Konto & Cloud“ (nur mit Zugang)');
  }

  console.log('Gerät B: anmelden holt den Spielstand');
  const Bd = await device('B', { ua: UA.win, w: 844, h: 390 });
  {
    await signIn(Bd, 'held@test.de');
    await Bd.page.waitForFunction(() => SAVE.chars.length === 1, null, { timeout: 5000 }).catch(() => { });
    const r = await Bd.page.evaluate(() => ({ n: SAVE.chars.length, name: SAVE.chars[0] && SAVE.chars[0].name, g: SAVE.chars[0] && SAVE.chars[0].gold, rev: OL.S.rev, conf: !!OL.conf, p: P && P.name, ls: JSON.parse(localStorage.getItem(SAVE_KEY)).chars.length }));
    ok(r.n === 1 && r.name === 'Anna' && r.g === 1004 && r.rev === 3 && !r.conf && r.p === 'Anna' && r.ls === 1, 'leeres Gerät: Cloud-Spielstand ohne Nachfrage übernommen und gespeichert');
    ok(!Bd.errs.length, 'Gerät B ohne Fehler' + (Bd.errs.length ? ': ' + Bd.errs.slice(0, 2).join(' | ') : ''));
  }

  console.log('Zwei verschiedene Spielstände: Auswahl');
  {
    await setGold(Bd.page, 777);
    await Bd.page.waitForFunction(() => OL.S.rev === 4, null, { timeout: 5000 }).catch(() => { });
    ok(row('held@test.de').rev === 4 && row('held@test.de').data.chars[0].gold === 777, 'B sichert Gold 777 (Rev. 4)');
    await A.page.evaluate(() => showTitle());
    await setGold(A.page, 555);   // A weiß nichts von Rev. 4
    await A.page.waitForSelector('.olcf', { timeout: 6000 }).catch(() => { });
    const c = await A.page.evaluate(() => ({ conf: !!OL.conf, cards: [...panel.querySelectorAll('.olcard')].map(e => e.textContent), n: panel.querySelectorAll('[data-act="ol_keep"]').length }));
    ok(c.conf && c.n === 2 && c.cards.length === 2, 'A: Auswahl mit zwei Spielständen und zwei Knöpfen „Diesen Spielstand behalten“');
    ok(/Anna/.test(c.cards[0]) && /Android · Chrome/.test(c.cards[0]) && /Anna/.test(c.cards[1]) && /Windows · Chrome/.test(c.cards[1]) && /12/.test(c.cards[1]), 'Karten: Helden, Level, Gerät (dieses: Android, Cloud: Windows)');
    ok(row('held@test.de').data.chars[0].gold === 777, 'Cloud nicht überschrieben (A hatte alte Revision)');
    // Cloud behalten → A bekommt 777, eigener Stand 555 ins Backup
    await A.page.click('[data-act="ol_keep"][data-id="cloud"]'); await A.page.waitForTimeout(300);
    const r = await A.page.evaluate(() => { const b = JSON.parse(localStorage.getItem('klingenhort.konto.backup')); return { g: SAVE.chars[0].gold, p: P.gold, rev: OL.S.rev, conf: !!OL.conf, title: !!panel.querySelector('.logo'), bg: JSON.parse(b.data).chars[0].gold, src: b.src }; });
    ok(r.g === 777 && r.p === 777 && r.rev === 4 && !r.conf && r.title, '„Cloud behalten“: Gold 777, Rev. 4, zurück im Hauptmenü');
    ok(r.bg === 555 && r.src === 'local', 'eigener Stand (Gold 555) liegt im Backup');
    // Backup wiederherstellen (tauscht)
    await A.page.evaluate(() => ON.ol_open('title'));
    await A.page.click('[data-act="ol_bak"]'); ok(await A.page.evaluate(() => /Wirklich tauschen/.test(panel.textContent)), 'Backup: erst nachfragen');
    await A.page.click('[data-act="ol_bak"]'); await A.page.waitForTimeout(200);
    const r2 = await A.page.evaluate(() => { const b = JSON.parse(localStorage.getItem('klingenhort.konto.backup')); return { g: SAVE.chars[0].gold, p: P.gold, bg: JSON.parse(b.data).chars[0].gold, msg: /wiederhergestellt/.test(panel.textContent) }; });
    ok(r2.g === 555 && r2.p === 555 && r2.bg === 777 && r2.msg, 'Backup wiederhergestellt (555), vorheriger Stand (777) ist jetzt das Backup');
    await A.page.waitForFunction(() => OL.S.rev === 5, null, { timeout: 5000 }).catch(() => { });
    ok(row('held@test.de').rev === 5 && row('held@test.de').data.chars[0].gold === 555, 'wiederhergestellter Stand hochgeladen (Rev. 5)');
    // B spielt weiter ohne Rev. 5 zu kennen → Auswahl auf B, „dieses Gerät behalten“
    await Bd.page.evaluate(() => showTitle());
    await setGold(Bd.page, 888);
    await Bd.page.waitForSelector('.olcf', { timeout: 6000 }).catch(() => { });
    for (const [w, h, n] of [[844, 390, 'quer'], [390, 844, 'hoch'], [1280, 720, 'pc']]) {
      await Bd.page.setViewportSize({ width: w, height: h }); await Bd.page.waitForTimeout(250);
      const l = await Bd.page.evaluate(new Function('return (' + LAYOUT.toString() + ')()'));
      ok(!l.over && !l.small.length, `Auswahl ${n} ${w}×${h}: kein seitliches Scrollen, Ziele ≥ 44 px` + (l.small.length ? ' ' + l.small.join(',') : ''));
      await Bd.page.screenshot({ path: `${OUT}/auswahl-${n}.png` });
    }
    await Bd.page.setViewportSize({ width: 844, height: 390 });
    await Bd.page.click('[data-act="ol_keep"][data-id="local"]');
    await Bd.page.waitForFunction(() => OL.S.rev === 6, null, { timeout: 5000 }).catch(() => { });
    const r3 = await Bd.page.evaluate(() => { const b = JSON.parse(localStorage.getItem('klingenhort.konto.backup')); return { g: SAVE.chars[0].gold, bg: JSON.parse(b.data).chars[0].gold, src: b.src }; });
    ok(r3.g === 888 && row('held@test.de').rev === 6 && row('held@test.de').data.chars[0].gold === 888, '„Dieses Gerät behalten“: Gold 888 hochgeladen (Rev. 6)');
    ok(r3.bg === 555 && r3.src === 'cloud', 'Cloud-Stand (555) liegt im Backup');
    // A startet neu: holt Rev. 6 ohne Nachfrage (hier nichts geändert)
    await A.page.reload(); await A.page.waitForTimeout(1300);
    await A.page.waitForFunction(() => OL.S.rev === 6, null, { timeout: 5000 }).catch(() => { });
    const r4 = await A.page.evaluate(() => ({ g: SAVE.chars[0].gold, ses: !!OL.ses, conf: !!OL.conf, txt: ($('olst') || {}).textContent }));
    ok(r4.ses && r4.g === 888 && !r4.conf, 'A neu gestartet: noch angemeldet, neuer Cloud-Stand (888) übernommen');
    ok(/Anna die Kühne · gesichert/.test(r4.txt), `Hauptmenü-Status: „${r4.txt}“`);
  }

  console.log('Offline → später sichern');
  {
    const pg = A.page;
    await A.ctx.setOffline(true); DB.down = true;
    const n0 = puts(); await setGold(pg, 999);
    await pg.waitForFunction(() => OL.st === 'net', null, { timeout: GAP + 4000 }).catch(() => { });
    const r = await pg.evaluate(() => ({ st: OL.st, txt: ($('olst') || {}).textContent, g: SAVE.chars[0].gold, ls: JSON.parse(localStorage.getItem(SAVE_KEY)).chars[0].gold, ses: !!OL.ses }));
    ok(r.st === 'net' && /offline/.test(r.txt) && r.ses && puts() === n0, 'offline: Status „offline“, nichts verloren, angemeldet bleiben' + (r.st === 'net' && r.ses ? '' : ' ' + JSON.stringify(r)) + ' [' + (puts() - n0) + ']');
    ok(r.g === 999 && r.ls === 999, 'Spiel speichert offline weiter im Browser');
    DB.down = false; await A.ctx.setOffline(false);
    await pg.waitForFunction(() => OL.st === 'ok' && OL.S.rev === 7, null, { timeout: 6000 }).catch(() => { });
    ok(row('held@test.de').rev === 7 && row('held@test.de').data.chars[0].gold === 999, 'wieder online: sofort gesichert (Rev. 7)');
  }

  console.log('Token erneuern');
  {
    const pg = A.page, r0 = DB.refreshed;
    const old = await pg.evaluate(() => { OL.ses.exp = Date.now() + 30000; return OL.ses.at; });
    await setGold(pg, 1111); await pg.evaluate(() => olPush());
    const last = DB.log.filter(x => x.p === '/rest/v1/rpc/kh_put_save').pop();
    ok(DB.refreshed === r0 + 1 && last.auth !== old && row('held@test.de').data.chars[0].gold === 1111, 'kurz vor Ablauf: erst erneuert, dann mit neuem Token gesichert');
    const st = await pg.evaluate(() => ({ exp: OL.ses.exp - Date.now(), ls: JSON.parse(localStorage.getItem('klingenhort.konto')).at === OL.ses.at }));
    ok(st.exp > 3000000 && st.ls, 'neue Sitzung gespeichert');
    // Server lehnt Token ab (401) → erneuern → nochmal
    for (const k in DB.tokens) if (DB.tokens[k].uid === DB.byMail['held@test.de']) delete DB.tokens[k];
    await setGold(pg, 1222); const ok2 = await pg.evaluate(() => olPush());
    ok(ok2 && DB.refreshed === r0 + 2 && row('held@test.de').data.chars[0].gold === 1222, '401 vom Server: erneuert und erneut gesichert');
  }

  console.log('Kaputte oder neuere Cloud-Daten');
  {
    const pg = A.page, uid = DB.byMail['held@test.de'], good = DB.saves[uid];
    const cases = [['Heldenliste ist Text', { v: 3, chars: 'kaputt', meta: {} }], ['unbekannte Klasse', { v: 3, active: 0, chars: [{ cls: 'drache', name: 'X', lv: 1, diff: 'normal', act: 1 }], meta: {} }], ['falsche Version im Inhalt', { v: 9, chars: [] }], ['kein Objekt', 'Hallo']];
    for (const [n, data] of cases) {
      DB.saves[uid] = Object.assign({}, good, { data, rev: good.rev + 1, device: 'Fremd' });
      const r = await pg.evaluate(async () => { const g = SAVE.chars[0].gold; await olPull('test'); return { st: OL.st, g: SAVE.chars[0].gold, before: g, n: SAVE.chars.length, title: !!panel.querySelector('.logo') || !!panel.querySelector('#olpage') }; });
      ok(r.st === 'bad' && r.g === r.before && r.n === 1, `${n}: nicht geladen, eigener Spielstand bleibt (Status „beschädigt“)`);
    }
    const n0 = puts(); await setGold(pg, 1333); await pg.waitForTimeout(GAP + 700);
    ok(puts() === n0 && DB.saves[uid].data === 'Hallo', 'bei beschädigter Cloud nicht von selbst überschreiben');
    DB.saves[uid] = Object.assign({}, good, { version: '99.0.0', rev: good.rev + 7 });
    ok(await pg.evaluate(async () => { await olPull('test'); return OL.st === 'new' && SAVE.chars[0].gold === 1333; }), 'Cloud aus neuerer Version: nicht geladen, Hinweis „neuere Version“');
    DB.saves[uid] = Object.assign({}, good, { data: 'Hallo', rev: good.rev + 8 });
    await pg.evaluate(() => olPull('test'));
    await pg.evaluate(() => ON.ol_open('title')); await pg.click('[data-act="ol_now"]');
    await pg.waitForFunction(() => OL.st === 'ok', null, { timeout: 4000 }).catch(() => { });
    ok(DB.saves[uid].data.chars && DB.saves[uid].data.chars[0].gold === 1333 && await pg.evaluate(() => /Gesichert/.test(panel.textContent)), '„Jetzt sichern“ ersetzt den beschädigten Cloud-Stand');
    ok(!A.errs.length, 'Gerät A ohne Fehler' + (A.errs.length ? ': ' + A.errs.slice(0, 3).join(' | ') : ''));
  }

  console.log('Abmelden, wieder anmelden, Cloud-Spielstand löschen');
  {
    const pg = A.page;
    await pg.evaluate(() => ON.ol_open('title')); await pg.click('[data-act="ol_out"]'); await pg.waitForTimeout(200);
    const r = await pg.evaluate(() => ({ ses: OL.ses, ls: localStorage.getItem('klingenhort.konto'), n: SAVE.chars.length, g: SAVE.chars[0].gold, form: !!$('ol_mail') }));
    ok(!r.ses && !r.ls && r.n === 1 && r.g === 1333 && r.form, 'Abmelden: Sitzung weg, Spielstand bleibt, Anmeldeformular');
    const n0 = DB.log.length; await pg.reload(); await pg.waitForTimeout(1500);
    const r2 = await pg.evaluate(() => ({ n: SAVE.chars.length, txt: ($('olst') || {}).textContent }));
    ok(r2.n === 1 && /Nicht angemeldet/.test(r2.txt) && DB.log.length === n0, 'nach Neustart: abgemeldet, Held da, keine Anfrage');
    await signIn(A, 'held@test.de');
    const r3 = await pg.evaluate(() => ({ conf: !!OL.conf, st: OL.st, g: SAVE.chars[0].gold }));
    ok(!r3.conf && r3.st === 'ok' && r3.g === 1333, 'wieder angemeldet (gleiches Konto, nichts geändert): keine Auswahl');
    await pg.screenshot({ path: `${OUT}/konto-angemeldet-hoch.png` });
    await pg.click('[data-act="ol_del"]'); ok(await pg.evaluate(() => /Wirklich löschen/.test(panel.textContent)) && row('held@test.de'), 'Cloud-Spielstand löschen: erst nachfragen');
    await pg.click('[data-act="ol_del"]'); await pg.waitForTimeout(300);
    ok(!row('held@test.de') && await pg.evaluate(() => OL.st === 'stop' && SAVE.chars.length === 1), 'Cloud-Spielstand gelöscht, Spielstand im Browser bleibt, Sicherung aus');
    const n1 = puts(); await setGold(pg, 1444); await pg.waitForTimeout(GAP + 700);
    ok(puts() === n1 && !row('held@test.de'), 'nach dem Löschen wird nicht von selbst wieder hochgeladen');
    await pg.click('[data-act="ol_now"]'); await pg.waitForTimeout(400);
    ok(row('held@test.de') && row('held@test.de').data.chars[0].gold === 1444 && row('held@test.de').rev === 1, '„Jetzt sichern“ schaltet die Sicherung wieder ein');
  }

  console.log('Google-Anmeldung, abgelaufene Anmeldung, Konto löschen');
  {
    const C = await device('C', { ua: UA.android });
    await C.page.evaluate(([HERO_]) => eval('(' + HERO_ + ')')('Gustav', 70), [HERO.toString()]);
    await C.page.evaluate(() => ON.ol_open('title'));
    await Promise.all([C.page.waitForNavigation(), C.page.click('[data-act="ol_google"]')]); await C.page.waitForTimeout(1500);
    await C.page.waitForFunction(() => OL.st === 'ok', null, { timeout: 5000 }).catch(() => { });
    const r = await C.page.evaluate(() => ({ mail: OL.ses && OL.ses.mail, hash: location.hash, url: location.href, n: SAVE.chars.length }));
    ok(r.mail === 'google@test.de' && !r.hash && r.n === 1, `Google: zurück im Spiel angemeldet, Token aus der Adresse entfernt (${r.url})`);
    ok(row('google@test.de') && row('google@test.de').data.chars[0].name === 'Gustav', 'Google-Konto: Spielstand hochgeladen');
    // Anmeldung ungültig (Refresh-Token widerrufen) → abgemeldet, Spielstand bleibt
    const uid = DB.byMail['google@test.de'];
    for (const k in DB.tokens) if (DB.tokens[k].uid === uid) delete DB.tokens[k];
    for (const k in DB.refresh) if (DB.refresh[k] === uid) delete DB.refresh[k];
    await setGold(C.page, 71); await C.page.evaluate(() => olPush());
    const r2 = await C.page.evaluate(() => ({ ses: OL.ses, st: OL.st, g: SAVE.chars[0].gold, txt: ($('olst') || {}).textContent }));
    ok(!r2.ses && r2.st === 'exp' && r2.g === 71 && /neu anmelden/.test(r2.txt), 'Refresh-Token ungültig: abgemeldet mit Hinweis, Spielstand bleibt');
    ok(!C.errs.length, 'Gerät C ohne Fehler' + (C.errs.length ? ': ' + C.errs.slice(0, 2).join(' | ') : ''));
    await C.ctx.close();
    // Konto löschen (Gerät B)
    await Bd.page.evaluate(() => ON.ol_open('title'));
    await Bd.page.click('[data-act="ol_kill"]'); await Bd.page.click('[data-act="ol_kill"]'); await Bd.page.waitForTimeout(400);
    const r3 = await Bd.page.evaluate(() => ({ ses: OL.ses, n: SAVE.chars.length, msg: /Konto gelöscht/.test(panel.textContent), sync: localStorage.getItem('klingenhort.konto.sync') }));
    ok(!DB.byMail['held@test.de'] && !row('held@test.de') && !r3.ses && r3.n === 1 && r3.msg && !r3.sync, 'Konto löschen: Konto und Cloud weg, abgemeldet, Spielstand im Browser bleibt');
    ok(!Bd.errs.length, 'Gerät B ohne Fehler' + (Bd.errs.length ? ': ' + Bd.errs.slice(0, 2).join(' | ') : ''));
  }
  await A.ctx.close(); await Bd.ctx.close();

  console.log('Bildschirme: hoch, quer, PC');
  for (const [w, h, n] of [[390, 844, 'hoch'], [844, 390, 'quer'], [1280, 720, 'pc']]) {
    const d = await device(n, { w, h, ua: w >= 1000 ? UA.win : UA.android }), pg = d.page;
    await pg.evaluate(([HERO_]) => eval('(' + HERO_ + ')')('Bilder', 10), [HERO.toString()]);
    await pg.screenshot({ path: `${OUT}/titel-${n}.png` });
    await pg.evaluate(() => showSettings('title')); await pg.screenshot({ path: `${OUT}/einstellungen-${n}.png` });
    const sb = await pg.evaluate(() => !!panel.querySelector('[data-act="ol_open"][data-id="settings"]'));
    await pg.click('[data-act="ol_open"][data-id="settings"]');
    await pg.fill('#ol_mail', `bild-${n}@test.de`); await pg.click('[data-act="ol_link"]'); await pg.waitForSelector('#ol_code');
    const l1 = await pg.evaluate(new Function('return (' + LAYOUT.toString() + ')()'));
    ok(sb && !l1.over && !l1.small.length, `${n}: Einstellungen → Konto & Cloud, Anmelden ohne seitliches Scrollen, Ziele ≥ 44 px` + (l1.small.length ? ' ' + l1.small.join(',') : ''));
    await pg.screenshot({ path: `${OUT}/konto-anmelden-${n}.png` });
    await pg.fill('#ol_code', '123456'); await pg.click('[data-act="ol_code"]'); await pg.waitForFunction(() => OL.st === 'ok', null, { timeout: 5000 }).catch(() => { });
    const l2 = await pg.evaluate(new Function('return (' + LAYOUT.toString() + ')()'));
    ok(!l2.over && !l2.small.length, `${n}: angemeldet ohne seitliches Scrollen, Ziele ≥ 44 px` + (l2.small.length ? ' ' + l2.small.join(',') : ''));
    await pg.screenshot({ path: `${OUT}/konto-angemeldet-${n}.png` });
    await pg.evaluate(() => ON.ol_back()); await pg.screenshot({ path: `${OUT}/einstellungen-angemeldet-${n}.png` });
    await pg.evaluate(() => showTitle()); await pg.screenshot({ path: `${OUT}/titel-angemeldet-${n}.png` });
    // Auswahl erzwingen: anderer Cloud-Stand + Änderung hier
    const uid = DB.byMail[`bild-${n}@test.de`], cur = DB.saves[uid], other = JSON.parse(JSON.stringify(cur.data));
    other.chars.push(Object.assign({}, other.chars[0], { name: 'Zweitheld', lv: 37, paragon: 2, maxAct: 6 }));
    DB.saves[uid] = Object.assign({}, cur, { data: other, rev: cur.rev + 1, device: 'iPhone · Safari', updated_at: new Date(Date.now() - 3600e3).toISOString() });
    await setGold(pg, 11); await pg.waitForSelector('.olcf', { timeout: 6000 }).catch(() => { });
    const l3 = await pg.evaluate(new Function('return (' + LAYOUT.toString() + ')()'));
    ok(!!(await pg.$('.olcf')) && !l3.over && !l3.small.length, `${n}: Auswahl ohne seitliches Scrollen, Ziele ≥ 44 px` + (l3.small.length ? ' ' + l3.small.join(',') : ''));
    await pg.screenshot({ path: `${OUT}/auswahl2-${n}.png` });
    await pg.evaluate(() => panel.scrollTop = 9999); await pg.screenshot({ path: `${OUT}/auswahl2-${n}-unten.png` });
    ok(!d.errs.length, `${n}: keine Fehler` + (d.errs.length ? ': ' + d.errs.slice(0, 2).join(' | ') : ''));
    await d.ctx.close();
  }

  await B.close();
  console.log(fails.length ? `\n${fails.length} FEHLER` : '\nAlles grün. Bilder: ' + OUT);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
