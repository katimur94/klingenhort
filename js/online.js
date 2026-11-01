'use strict';
/* =========================================================
   KLINGENHORT – Online, Schritt 1: Konto & Cloud-Speicher (Supabase, ohne SDK – nur fetch)
   Schläft, solange js/online-config.js window.KH_ONLINE = null setzt: dann kein Knopf, kein Netz, kein Hook – das Spiel bleibt wie es ist.
   Mit { url, anon }: Anmelden per E-Mail (Link oder Code) oder Google, der Spielstand (dasselbe JSON wie im Browser und im
   Übertragungs-Code) wird nach persist() gebündelt hochgeladen (höchstens alle KH_ONLINE.gap ms, Standard 45 s, dazu beim
   Verlassen der Seite) und beim Start / nach dem Anmelden geholt.
   Abgleich: S = { uid, rev, hash, at, lt, off } je Gerät – rev = Cloud-Revision beim letzten Abgleich, hash = Spielstand damals.
     nur hier geändert → hochladen (kh_put_save mit Basis-Revision; war ein anderes Gerät schneller, kommt { ok: false } → vergleichen)
     nur in der Cloud geändert → im Hauptmenü übernehmen
     beides geändert (auch: erstes Anmelden mit Spielstand hier und in der Cloud) → Auswahl „Diesen Spielstand behalten“,
     der andere landet im Backup-Platz (ein Platz, Einstellungen → Konto & Cloud → wiederherstellen; Wiederherstellen tauscht).
   Jeder geholte Spielstand geht durch olCheck (Form, Klassen, fixMeta, Probelauf) – Kaputtes wird nie geladen.
   Offline: alles läuft weiter, gesichert wird beim nächsten „online“ bzw. Neuversuch. Sitzung: eigener Schlüssel, Token wird
   vor Ablauf erneuert (auch nach 401), ein toter Refresh-Token meldet ab – der Spielstand im Browser bleibt immer.
   Endpunkte: /auth/v1/otp, /auth/v1/verify, /auth/v1/authorize?provider=google, /auth/v1/token?grant_type=refresh_token,
   /auth/v1/logout, /rest/v1/saves, /rest/v1/profiles, /rest/v1/rpc/kh_put_save, /rest/v1/rpc/kh_delete_me (supabase/migrations)
   Schnittstelle (Tests): OL (Zustand), olPush(o), olPull(why), olShow(from), olStatus()
   ========================================================= */

// base64url-JWT lesen (nur Inhalt, keine Prüfung – die macht der Server)
function olJwt(t) { try { const p = String(t).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(p + '==='.slice((p.length + 3) % 4))))) || {}; } catch (_) { return {}; } }
const OL_CFG = (() => {
  const c = window.KH_ONLINE;
  if (!c || typeof c !== 'object' || typeof c.url !== 'string' || typeof c.anon !== 'string') return null;
  const url = c.url.trim().replace(/\/+$/, ''), anon = c.anon.trim();
  if (!/^(https:\/\/[^\s/?#]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(url) || anon.length < 20) { console.error('Klingenhort Online: url/anon in js/online-config.js ungültig – Online bleibt aus.'); return null; }
  // service_role (alt: JWT mit role, neu: sb_secret_…) darf nie im Spiel stehen
  if (/^sb_secret_/.test(anon) || olJwt(anon).role === 'service_role') { console.error('Klingenhort Online: das ist der geheime service_role-Schlüssel – bitte den öffentlichen anon-Schlüssel eintragen. Online bleibt aus.'); return null; }
  return { url, anon, gap: Math.min(600000, Math.max(1000, +c.gap || 45000)) };
})();
const OLK = { ses: 'klingenhort.konto', sync: 'klingenhort.konto.sync', bak: 'klingenhort.konto.backup' };
const OL_MAX = 1572864 - 4096;   // wie saves_size in der Datenbank (1,5 MB), Rest für Version/Gerät
// st: out | busy | ok | net (offline) | err | conf (Auswahl offen) | bad (Cloud kaputt) | new (Cloud neuere Version) | stop (aus) | exp (neu anmelden) | big
const OL = { on: !!OL_CFG, ses: null, S: {}, st: 'out', busy: false, again: false, req: false, tm: 0, rtm: 0, rty: 0, last: 0, pulled: 0, conf: null, later: false, wait: false, bad: null, badRev: 0, name: null, nameIn: null, mail: '', sent: false, msg: '', ask: '', from: 'title', note: '', fresh: false, n: 0 };

/* ---------- Speicher im Browser ---------- */
function olLs(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } }
function olLsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (_) { return false; } }
function olSaveS() { olLsSet(OLK.sync, OL.S); }
function olLoadS() { const s = olLs(OLK.sync); OL.S = s && typeof s === 'object' ? s : {}; if (OL.ses && OL.S.uid !== OL.ses.uid) OL.S = { uid: OL.ses.uid, lt: OL.S.lt }; }
function olSesLoad() { const s = olLs(OLK.ses); OL.ses = s && s.at && s.rt && s.uid ? s : null; }
function olSesSave(s) { OL.ses = s; olLsSet(OLK.ses, s); }
// Spielstand so, wie er gespeichert ist (= Übertragungs-Code ohne base64)
function olLocalJSON() { let s = null; try { s = localStorage.getItem(SAVE_KEY); } catch (_) { } return s || JSON.stringify(SAVE); }
function olHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + '.' + s.length; }
// Schlüssel sortiert – jsonb ändert die Reihenfolge, Gleichheit also inhaltlich prüfen
function olCanon(v) { return Array.isArray(v) ? '[' + v.map(olCanon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + olCanon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v); }
function olEmpty(s) { return !s || ((!s.chars || !s.chars.length) && !(s.meta && s.meta.fallen && s.meta.fallen.length) && !Object.keys((s.meta && s.meta.stats) || {}).length); }
function olNewer(a, b) { const x = String(a || '').split('.').map(n => +n || 0), y = String(b || '').split('.').map(n => +n || 0); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; }
// Gerät für die Auswahl („Android · Chrome“) – Eigennamen, nicht übersetzt
function olDev() {
  const u = navigator.userAgent || '';
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /CrOS/.test(u) ? 'ChromeOS' : /Mac/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : '?';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  return (os + (br ? ' · ' + br : '')).slice(0, 60);
}
function olBak() { const b = olLs(OLK.bak); return b && typeof b.data === 'string' ? b : null; }
function olBackup(data, src, at, dev) { return olLsSet(OLK.bak, { data, src, at: at || Date.now(), dev: dev || '' }); }

/* ---------- Netz ---------- */
function olErr(k, x) { const e = new Error(k); e.k = k; if (x) Object.assign(e, x); return e; }
// o: method, body (Text), auth (Spieler-Token), headers, keep (keepalive beim Verlassen)
async function olFetch(path, o) {
  o = o || {};
  const h = Object.assign({ apikey: OL_CFG.anon, 'Content-Type': 'application/json' }, o.headers || {});
  if (o.auth) { const t = await olToken(); if (!t) throw olErr('exp'); h.Authorization = 'Bearer ' + t; }
  let r; OL.n++;
  try { r = await fetch(OL_CFG.url + path, { method: o.method || 'GET', headers: h, body: o.body, keepalive: !!o.keep, cache: 'no-store', credentials: 'omit' }); }
  catch (_) { throw olErr('net'); }
  if (r.status === 401 && o.auth && !o.retry) {   // Token abgelaufen → einmal erneuern und nochmal
    if (await olRefresh()) return olFetch(path, Object.assign({}, o, { retry: true }));
    throw olErr(OL.ses ? 'net' : 'exp');
  }
  const txt = await r.text().catch(() => ''); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (_) { }
  if (!r.ok) throw olErr(r.status >= 500 ? 'srv' : 'http', { status: r.status, body: j });
  return j;
}
function olSesFrom(j) {
  if (!j || !j.access_token || !j.refresh_token) return null;
  const p = olJwt(j.access_token), u = j.user || {}, exp = +j.expires_at || +p.exp || (Date.now() / 1000 + (+j.expires_in || 3600));
  const uid = u.id || p.sub; if (!uid) return null;
  return { at: j.access_token, rt: j.refresh_token, exp: exp * 1000, uid, mail: u.email || p.email || '' };
}
async function olToken() { if (!OL.ses) return null; if (OL.ses.exp - Date.now() < 60000) await olRefresh(); return OL.ses ? OL.ses.at : null; }
let olRefP = null;
function olRefresh() {
  if (olRefP) return olRefP;
  olRefP = (async () => {
    // anderer Tab hat schon erneuert?
    const cur = olLs(OLK.ses);
    if (cur && OL.ses && cur.uid === OL.ses.uid && cur.rt !== OL.ses.rt && cur.exp - Date.now() > 60000) { OL.ses = cur; olPlanRefresh(); return true; }
    if (!OL.ses) return false;
    let r; OL.n++;
    try { r = await fetch(OL_CFG.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: OL_CFG.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: OL.ses.rt }), cache: 'no-store', credentials: 'omit' }); }
    catch (_) { return false; }   // offline: Sitzung behalten, später wieder
    if (r.status >= 400 && r.status < 500) { olExpired(); return false; }
    if (!r.ok) return false;
    const s = olSesFrom(await r.json().catch(() => null)); if (!s) return false;
    olSesSave(s); olPlanRefresh(); return true;
  })().finally(() => { olRefP = null; });
  return olRefP;
}
// 2 Minuten vor Ablauf erneuern
function olPlanRefresh() { clearTimeout(OL.rtm); OL.rtm = 0; if (OL.ses) OL.rtm = setTimeout(() => olRefresh(), Math.max(5000, OL.ses.exp - Date.now() - 120000)); }
function olExpired() { olSesSave(null); clearTimeout(OL.rtm); clearTimeout(OL.tm); OL.tm = 0; OL.conf = null; olSet('exp'); }

/* ---------- Spielstand prüfen und übernehmen ---------- */
// Form prüfen, Kopie durch fixMeta (wie Laden/Code einfügen) – null = Müll, wird nicht geladen
function olCheck(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 3 || !Array.isArray(d.chars) || d.chars.length > 200) return null;
  for (const c of d.chars) if (!c || typeof c !== 'object' || Array.isArray(c) || !CLASSES[c.cls] || typeof c.name !== 'string' || !(c.lv >= 1 && c.lv <= 100000) || !DIFFS[c.diff] || !(c.act >= 1)) return null;
  if (d.meta != null && (typeof d.meta !== 'object' || Array.isArray(d.meta))) return null;
  let s; try { s = JSON.parse(JSON.stringify(d)); } catch (_) { return null; }
  if (!Number.isInteger(s.active) || s.active < -1 || s.active >= s.chars.length) s.active = -1;
  const old = SAVE; try { SAVE = s; s.meta = fixMeta(s.meta); } catch (_) { return null; } finally { SAVE = old; }
  return s;
}
// Spielstand einsetzen; Probelauf (Held laden, Hauptmenü zeichnen) – geht etwas schief, bleibt der alte
function olApply(s) {
  const old = SAVE, oldP = P;
  try { SAVE = s; markSeen(); P = null; if (SAVE.active >= 0 && SAVE.chars[SAVE.active]) activateChar(SAVE.active); titleScene(); persist(); applyUiPrefs(); return true; }
  catch (e) { console.error('Klingenhort Online:', e); SAVE = old; P = oldP; try { persist(); if (SAVE.active >= 0 && SAVE.chars[SAVE.active]) activateChar(SAVE.active); titleScene(); } catch (_) { } return false; }
}
function olRedraw() { if (ov.hidden) return; if (panel.querySelector('#olpage')) olShow(); else if (panel.querySelector('.logo')) showTitle(); }
function olTake(row, s, bak) {
  if (bak && !olBackup(olLocalJSON(), 'local', OL.S.lt, olDev())) { OL.msg = _t('Backup nicht möglich – der Speicher im Browser ist voll.'); olSet('conf'); return false; }
  if (!olApply(s)) { OL.bad = 'bad'; OL.badRev = +row.rev; olSet('bad'); return false; }
  Object.assign(OL.S, { rev: +row.rev, hash: olHash(olLocalJSON()), at: Date.parse(row.updated_at) || Date.now() }); olSaveS();
  OL.bad = null; OL.conf = null; olSet('ok'); olRedraw(); toast(_t('Spielstand aus der Cloud geladen'), '#79c24e');
  return true;
}

/* ---------- Abgleich ---------- */
const olAtTitle = () => state === 'title';
async function olPull(why) {
  if (!OL.ses) return;
  if (OL.busy) { OL.again = true; return; }
  OL.busy = true; OL.pulled = Date.now(); olSet('busy');
  let row = null;
  try { const a = await olFetch('/rest/v1/saves?select=data,version,rev,updated_at,device&user_id=eq.' + encodeURIComponent(OL.ses.uid), { auth: true }); row = Array.isArray(a) && a[0] ? a[0] : null; }
  catch (e) { OL.busy = false; olFail(e); return; }
  OL.busy = false;
  olDecide(row, why);
}
function olDecide(row, why) {
  const S = OL.S, js = olLocalJSON(), h = olHash(js), mine = !S.rev || h !== S.hash;
  clearTimeout(OL.rty); OL.rty = 0;
  if (S.off) { olSet('stop'); return; }
  if (!row) {   // nichts in der Cloud (neu oder gelöscht): eigenen Stand hochladen – leere Spielstände nicht
    S.rev = 0; olSaveS();
    if (olEmpty(SAVE)) { olSet('ok'); return; }
    olPush({ base: 0, force: true }); return;
  }
  if (olNewer(row.version, VERSION)) { OL.bad = 'new'; OL.badRev = +row.rev; olSet('new'); return; }
  const s = olCheck(row.data);
  if (!s) { OL.bad = 'bad'; OL.badRev = +row.rev; olSet('bad'); return; }
  OL.bad = null;
  if (+row.rev === S.rev) { if (mine) olPush(); else { S.at = Date.parse(row.updated_at) || S.at; olSaveS(); olSet('ok'); } return; }
  // Cloud ist weiter: gleicher Inhalt → nur merken, leere Cloud → hochladen
  let same = false; try { same = olCanon(row.data) === olCanon(JSON.parse(js)); } catch (_) { }
  if (same) { Object.assign(S, { rev: +row.rev, hash: h, at: Date.parse(row.updated_at) || Date.now() }); olSaveS(); olSet('ok'); return; }
  if (olEmpty(s)) { olPush({ base: +row.rev, force: true }); return; }
  if (!olAtTitle()) { OL.wait = true; olSet(mine ? 'conf' : 'ok'); return; }   // erst im Hauptmenü entscheiden/übernehmen
  if (!mine || olEmpty(SAVE)) { olTake(row, s, false); return; }
  OL.conf = { row, s }; OL.later = false; olSet('conf'); olConf();
}
function olCan(force) { return !!OL.ses && !OL.conf && !OL.wait && (force || (!OL.bad && !OL.S.off)); }
// o: force (auch ohne Änderung / trotz Pause), base (Basis-Revision), keep (keepalive)
async function olPush(o) {
  o = o || {};
  if (!olCan(o.force)) return false;
  if (OL.busy) { OL.again = true; return false; }
  const js = olLocalJSON(), h = olHash(js), S = OL.S;
  if (!o.force && S.rev && h === S.hash) { if (OL.st === 'busy' || OL.st === 'net' || OL.st === 'err') olSet('ok'); return true; }
  if (!S.rev && o.base == null && olEmpty(SAVE)) return true;
  if (js.length > OL_MAX) { olSet('big'); return false; }
  OL.busy = true; OL.last = Date.now(); clearTimeout(OL.tm); OL.tm = 0; olSet('busy');
  let r;
  try {
    const body = '{"p_data":' + js + ',"p_version":' + JSON.stringify(VERSION) + ',"p_device":' + JSON.stringify(olDev()) + ',"p_base":' + (o.base != null ? +o.base : +S.rev || 0) + '}';
    r = await olFetch('/rest/v1/rpc/kh_put_save', { method: 'POST', body, auth: true, keep: !!o.keep && body.length < 60000 });
  } catch (e) { OL.busy = false; olFail(e); return false; }
  OL.busy = false;
  if (r && r.ok) {
    Object.assign(S, { rev: +r.rev, hash: h, at: Date.parse(r.updated_at) || Date.now(), off: false }); olSaveS();
    OL.bad = null; clearTimeout(OL.rty); OL.rty = 0; olSet('ok');
    if (OL.again) { OL.again = false; olSchedule(); }
    return true;
  }
  OL.again = false; await olPull('rev');   // ein anderes Gerät war schneller → vergleichen
  return false;
}
function olFail(e) {
  OL.again = false;
  if (e && e.k === 'exp') { olExpired(); return; }
  olSet(e && e.k === 'net' ? 'net' : 'err', e);
  clearTimeout(OL.rty); OL.rty = setTimeout(() => { OL.rty = 0; olPull('retry'); }, Math.max(OL_CFG.gap, 15000));
}
// nach persist(): gebündelt hochladen – frühestens gap nach dem letzten Mal, mindestens kurz warten (mehrere Speicherungen zusammen)
function olSchedule() {
  if (!OL.ses || OL.tm || OL.conf) return;
  const wait = Math.max(Math.min(5000, OL_CFG.gap), OL.last + OL_CFG.gap - Date.now());
  OL.tm = setTimeout(() => { OL.tm = 0; olPush(); }, wait);
}
function olFlush() { if (!OL.tm || !OL.ses) return; clearTimeout(OL.tm); OL.tm = 0; olPush({ keep: true }); }

/* ---------- Anmelden ---------- */
const olSite = () => location.origin + location.pathname;
async function olSendLink(mail) { await olFetch('/auth/v1/otp?redirect_to=' + encodeURIComponent(olSite()), { method: 'POST', body: JSON.stringify({ email: mail, create_user: true }) }); }
async function olVerify(mail, code) {
  const j = await olFetch('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'email', email: mail, token: code }) });
  const s = olSesFrom(j); if (!s) throw olErr('http', { body: { msg: 'session' } });
  olSesSave(s); olSignedIn();
}
function olGoogle() { try { if (state === 'map') saveChar(); persist(); } catch (_) { } location.href = OL_CFG.url + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(olSite()); }
// Rückkehr vom Link in der E-Mail oder von Google: Sitzung steht im Adress-Hash (#access_token=…) – sofort aus der Adresse entfernen
function olHashIn() {
  const hs = location.hash || ''; if (!/access_token=|error_description=/.test(hs)) return;
  const q = new URLSearchParams(hs.slice(1));
  try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { }
  if (q.get('error_description')) { OL.note = q.get('error_description').slice(0, 160); return; }
  const s = olSesFrom({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_at: q.get('expires_at'), expires_in: q.get('expires_in') });
  if (s) { olSesSave(s); OL.fresh = true; }
}
function olSignedIn() {
  OL.sent = false; OL.msg = ''; OL.later = false;
  olLoadS(); olPlanRefresh(); olProfile(); olPull('login');
}
async function olProfile() { try { const a = await olFetch('/rest/v1/profiles?select=name&id=eq.' + encodeURIComponent(OL.ses.uid), { auth: true }); OL.name = Array.isArray(a) && a[0] ? a[0].name || null : null; olUi(); } catch (_) { } }
const OL_NAME = /^[\p{L}\p{N} _.\-]{2,20}$/u;
async function olSaveName(n) {
  await olFetch('/rest/v1/profiles', { method: 'POST', auth: true, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: OL.ses.uid, name: n }) });
  OL.name = n; OL.nameIn = null;
}
function olSignOut() {
  if (OL.ses) olFetch('/auth/v1/logout', { method: 'POST', auth: true }).catch(() => { });
  olSesSave(null); clearTimeout(OL.rtm); clearTimeout(OL.tm); clearTimeout(OL.rty); OL.tm = OL.rtm = OL.rty = 0;
  OL.conf = null; OL.bad = null; OL.name = null; OL.wait = false; olSet('out');
}

/* ---------- Anzeige ---------- */
function olTime(t) {
  if (!t) return '–'; const d = new Date(t), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(LOCALE) + ' ' + d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}
function olStatus() {
  switch (OL.st) {
    case 'out': return _t('Nicht angemeldet');
    case 'busy': return _t('Wird abgeglichen …');
    case 'ok': return OL.S.at ? _t('Zuletzt gesichert: {t}', { t: olTime(OL.S.at) }) : _t('Bereit – gesichert wird, sobald du spielst.');
    case 'net': return _t('Offline – wird gesichert, sobald du wieder online bist.');
    case 'err': return _t('Sichern hat nicht geklappt – neuer Versuch folgt.');
    case 'conf': return _t('Zwei verschiedene Spielstände – bitte wähle einen.');
    case 'bad': return _t('Der Cloud-Spielstand ist beschädigt und wurde nicht geladen.');
    case 'new': return _t('Der Cloud-Spielstand stammt aus einer neueren Version. Bitte aktualisiere das Spiel.');
    case 'stop': return _t('Cloud-Sicherung ist aus. „Jetzt sichern“ schaltet sie wieder ein.');
    case 'exp': return _t('Bitte melde dich neu an.');
    case 'big': return _t('Der Spielstand ist zu groß für die Cloud.');
  }
  return '';
}
function olShort() {
  if (!OL.ses) return OL.st === 'exp' ? _t('Bitte neu anmelden') : _t('Nicht angemeldet');
  const who = OL.name || OL.ses.mail.split('@')[0];
  const s = OL.st === 'ok' ? (OL.S.at ? _t('gesichert {t}', { t: olTime(OL.S.at) }) : _t('angemeldet')) : OL.st === 'busy' ? _t('gleicht ab …') : OL.st === 'net' ? _t('offline') : OL.st === 'conf' ? _t('bitte wählen') : _t('Achtung');
  return who + ' · ' + s;
}
function olSet(st, e) {
  OL.st = st; OL.err = e && e.k ? e.k : '';
  olUi();
}
// nur Statuszeilen auffrischen (Eingabefelder bleiben, wie sie sind)
function olUi() {
  const a = $('olst'); if (a) a.textContent = olShort();
  const b = $('olstat'); if (b) { b.textContent = olStatus(); b.className = 'olstat ' + OL.st; }
}
function olErrText(e) {
  if (e && e.k === 'net') return _t('Keine Verbindung. Bitte später noch einmal versuchen.');
  const b = e && e.body, m = b && (b.msg || b.error_description || b.message || b.error);
  return m ? _t('Das hat nicht geklappt: {e}', { e: String(m).slice(0, 140) }) : _t('Das hat nicht geklappt. Bitte später noch einmal versuchen.');
}
function olSum(s) {
  const C = (s && s.chars) || [], top = C.slice().sort((a, b) => (b.lv || 0) - (a.lv || 0))[0];
  return { n: C.length, names: C.slice(0, 3).map(c => c.name).join(', ') + (C.length > 3 ? ' …' : ''), lv: top ? top.lv + (top.paragon ? ' · P' + top.paragon : '') : '–', act: C.reduce((m, c) => Math.max(m, c.maxAct || c.act || 0), 0) || '–', kills: C.reduce((m, c) => m + ((c.stats && c.stats.kills) || 0), 0) };
}
function olCard(title, s, when, dev, side) {
  const m = olSum(s), row = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
  return `<div class="olcard"><h3>${title}</h3><div class="olkv">${row(_t('Helden'), m.n + (m.n ? `<small>${esc(m.names)}</small>` : ''))}${row(_t('Höchstes Level'), esc(m.lv))}${row(_t('Höchster Akt'), esc(m.act))}${row(_t('Besiegte Gegner'), fmt(m.kills))}${row(_t('Gespeichert'), esc(olTime(when)))}${row(_t('Gerät'), esc(dev || '?'))}</div>
  <button class="btn" data-act="ol_keep" data-id="${side}">${_t('Diesen Spielstand behalten')}</button></div>`;
}
function olConf() {
  const C = OL.conf; if (!C) return;
  showOverlay(`<div class="olp olcf"><h2>${_t('ZWEI SPIELSTÄNDE')}</h2><p class="sub">${_t('Auf diesem Gerät und in der Cloud wurde unterschiedlich gespielt. Welchen Spielstand willst du behalten? Der andere bleibt als Backup auf diesem Gerät – du kannst ihn unter Einstellungen → Konto & Cloud wiederherstellen.')}</p>
  <div class="olcmp">${olCard(_t('AUF DIESEM GERÄT'), SAVE, OL.S.lt, olDev(), 'local')}${olCard(_t('IN DER CLOUD'), C.s, Date.parse(C.row.updated_at), C.row.device, 'cloud')}</div>
  <div class="menu" style="margin-top:12px"><button class="btn alt" data-act="ol_later">${_t('Später entscheiden')}</button></div></div>`, true);
}
const olTwo = (k, a, b, red) => OL.ask === k ? `<div class="oltwo"><button class="btn red" data-act="${k}">${b}</button><button class="btn alt" data-act="ol_no">${_t('Nein')}</button></div>` : `<button class="btn ${red ? 'alt olred' : 'alt'}" data-act="${k}">${a}</button>`;
function olShow(from) {
  if (from) OL.from = from;
  const dis = OL.req ? ' disabled' : '', B = olBak();
  let h = `<div id="olpage" class="olp"><div class="head"><h2>${_t('KONTO & CLOUD')}</h2><button class="btn alt sm" data-act="ol_back">${_t('Zurück')}</button></div>
  <p class="sub">${_t('Gespeichert werden nur deine E-Mail-Adresse, dein Anzeigename und dein Spielstand – damit du auf jedem Gerät weiterspielen kannst.')}</p>`;
  if (OL.msg) h += `<p class="olmsg">${esc(OL.msg)}</p>`;
  if (!OL.ses) {
    if (OL.st === 'exp') h += `<p class="olmsg">${_t('Deine Anmeldung ist abgelaufen. Bitte melde dich neu an – dein Spielstand auf diesem Gerät bleibt erhalten.')}</p>`;
    h += `<h3>${_t('ANMELDEN')}</h3><label class="olhint" for="ol_mail">${_t('E-Mail-Adresse')}</label><input id="ol_mail" class="olin" type="email" autocomplete="email" inputmode="email" maxlength="120" value="${esc(OL.mail)}" placeholder="name@example.com">
    <div class="menu"><button class="btn" data-act="ol_link"${dis}>${OL.sent ? _t('Neuen Link schicken') : _t('Link schicken')}</button></div>`;
    if (OL.sent) h += `<p class="olhint">${_t('Wir haben dir eine E-Mail geschickt. Tippe auf den Link darin – oder gib hier den Code aus der E-Mail ein.')}</p><label class="olhint" for="ol_code">${_t('Code aus der E-Mail')}</label><input id="ol_code" class="olin" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"><div class="menu"><button class="btn" data-act="ol_code"${dis}>${_t('Code bestätigen')}</button></div>`;
    h += `<p class="olor">${_t('oder')}</p><div class="menu"><button class="btn alt" data-act="ol_google"${dis}>${_t('Mit Google anmelden')}</button></div><p class="olhint">${_t('Unter 16? Frag bitte vorher deine Eltern. Ohne Konto kannst du immer spielen.')}</p>`;
  } else {
    h += `<div class="olbox"><div>${_t('Angemeldet als {name}', { name: `<b>${esc(OL.ses.mail || '?')}</b>` })}</div><div id="olstat" class="olstat ${OL.st}">${esc(olStatus())}</div></div>
    <div class="menu"><button class="btn" data-act="ol_now"${dis || (OL.bad === 'new' ? ' disabled' : '')}>${_t('Jetzt sichern')}</button>${OL.conf ? `<button class="btn" data-act="ol_conf">${_t('Spielstände vergleichen')}</button>` : ''}</div>
    <h3>${_t('ANZEIGENAME')}</h3><input id="ol_name" class="olin" type="text" maxlength="20" autocomplete="nickname" value="${esc(OL.nameIn != null ? OL.nameIn : OL.name || '')}" placeholder="${_t('Dein Name')}"><p class="olhint">${_t('2–20 Zeichen: Buchstaben, Ziffern, Leerzeichen, - _ .')}</p>
    <div class="menu"><button class="btn alt" data-act="ol_name"${dis}>${_t('Namen speichern')}</button></div>`;
  }
  if (B) h += `<h3>${_t('BACKUP')}</h3><p class="olhint">${B.src === 'cloud' ? _t('Spielstand aus der Cloud vom {t}', { t: esc(olTime(B.at)) }) : _t('Spielstand von diesem Gerät vom {t}', { t: esc(olTime(B.at)) })}${B.dev ? ' · ' + esc(B.dev) : ''}</p><div class="menu">${olTwo('ol_bak', _t('Backup wiederherstellen'), _t('Wirklich tauschen?'))}</div>`;
  if (OL.ses) h += `<h3>${_t('KONTO')}</h3><div class="menu">${olTwo('ol_del', _t('Cloud-Spielstand löschen'), _t('Wirklich löschen?'), 1)}<button class="btn alt" data-act="ol_out"${dis}>${_t('Abmelden')}</button>${olTwo('ol_kill', _t('Konto löschen'), _t('Konto wirklich löschen?'), 1)}</div><p class="olhint">${_t('Abmelden und Löschen lassen deinen Spielstand auf diesem Gerät, wie er ist.')}</p>`;
  h += `<p class="olhint"><a class="ollink" href="datenschutz.html" target="_blank" rel="noopener">${_t('Datenschutz')}</a></p></div>`;
  showOverlay(h);
}
function olGrab() { const m = $('ol_mail'); if (m) OL.mail = m.value.trim(); const n = $('ol_name'); if (n) OL.nameIn = n.value; }
async function olAct(fn) {
  if (OL.req) return; olGrab(); OL.req = true; OL.msg = ''; OL.ask = ''; olRe();
  try { await fn(); } catch (e) { OL.msg = olErrText(e); } finally { OL.req = false; olRe(); }
}
function olRe() { if (!ov.hidden && panel.querySelector('#olpage')) olShow(); }

/* ---------- Einhängen (nur mit Zugang) ---------- */
if (OL.on) {
  olHashIn(); olSesLoad(); olLoadS();
  document.head.insertAdjacentHTML('beforeend', `<style id="olcss">
/* Konto & Cloud: Statuszeile im Titel-Knopf, Eingabefelder, Vergleich zweier Spielstände */
.olbtn small{display:block;font-family:var(--f-body);font-size:15px;line-height:1.1;color:var(--parch-dim);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.olp .btn{min-height:44px}.olp .head .btn.sm{min-height:44px;min-width:44px}
.olp h3{margin:14px 0 6px}
.olin{display:block;width:100%;box-sizing:border-box;min-height:48px;font:20px var(--f-body);background:var(--night);color:var(--parch);border:2px solid var(--stone-hi);border-radius:0;padding:8px 10px;margin:0 0 8px;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text}
.olin:focus{outline:none;border-color:var(--gold)}
.olhint{display:block;font-size:17px;line-height:1.15;color:var(--parch-dim);margin:0 0 8px}
.olmsg{font-size:18px;line-height:1.15;color:var(--gold);margin:0 0 10px}
.olor{text-align:center;color:var(--parch-dim);font-size:17px;margin:2px 0 8px}
.olbox{background:var(--night);padding:10px 12px;margin:0 0 10px;box-shadow:inset 0 0 0 2px var(--stone-hi);font-size:19px;line-height:1.15;overflow-wrap:anywhere}
.olbox b{font-weight:400;color:var(--gold)}
.olstat{margin-top:4px;font-size:17px;color:var(--moss)}.olstat.net,.olstat.err,.olstat.exp,.olstat.big{color:var(--gold)}.olstat.bad,.olstat.new,.olstat.conf{color:#ff7a6a}.olstat.busy,.olstat.stop,.olstat.out{color:var(--parch-dim)}
.btn.olred{color:#ff9a8a}
.oltwo{display:grid;grid-template-columns:1fr auto;gap:8px}
.ollink{color:var(--gold);display:inline-block;min-height:44px;line-height:44px}
.olcmp{display:grid;gap:10px;grid-template-columns:minmax(0,1fr)}
@media (min-width:600px){.olcmp{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.olcard{background:var(--night);padding:10px 12px 12px;box-shadow:inset 0 0 0 2px var(--stone-hi);display:flex;flex-direction:column}
.olcard h3{margin:0 0 8px;color:var(--gold)}
.olkv{flex:1;margin:0 0 10px}
.olkv div{display:flex;justify-content:space-between;gap:10px;font-size:18px;line-height:1.1;padding:3px 0;border-bottom:1px dashed var(--stone-hi)}
.olkv span{color:var(--parch-dim);flex:none}.olkv b{font-weight:400;text-align:right;min-width:0;overflow-wrap:anywhere}
.olkv small{display:block;font-size:15px;color:var(--parch-dim)}
.olcard .btn{width:100%}
</style>`);
  // Knöpfe: Hauptmenü (mit Status) und Einstellungen (nicht mitten im Spiel – Google-Anmeldung lädt die Seite neu)
  HOOK.titleBtns.push(() => `<button class="btn alt olbtn" data-act="ol_open" data-id="title">☁️ ${_t('Konto')}<small id="olst">${esc(olShort())}</small></button>`);
  HOOK.setBtns.push(ig => ig ? '' : `<button class="btn alt" data-act="ol_open" data-id="settings">☁️ ${_t('Konto & Cloud')}</button>`);
  // gespeichert → gebündelt hochladen; Zeit der letzten Änderung hier merken (für die Auswahl)
  let olLtW = 0;
  HOOK.persist.push(() => {
    const n = Date.now(); OL.S.lt = n; if (n - olLtW > 5000) { olLtW = n; olSaveS(); }
    olSchedule();
  });
  HOOK.boot.push(() => {
    if (OL.note) toast(_t('Anmeldung fehlgeschlagen: {e}', { e: OL.note }), '#e8b04a');
    if (!OL.ses) { olSet(OL.st === 'exp' ? 'exp' : 'out'); return; }
    if (OL.fresh) toast(_t('Angemeldet als {name}', { name: OL.ses.mail }), '#79c24e');
    olPlanRefresh(); olProfile(); olPull('start');
  });
  // Hauptmenü: offene Auswahl zeigen, aufgeschobene Übernahme nachholen
  setInterval(() => {
    if (!OL.ses || !olAtTitle() || ov.hidden) return;
    if (OL.wait && !OL.busy) { OL.wait = false; olPull('title'); return; }
    if (OL.conf && !OL.later && !panel.querySelector('.olcf') && (panel.querySelector('.logo') || panel.querySelector('#olpage'))) olConf();
  }, 1000);
  addEventListener('online', () => { if (OL.ses && (OL.st === 'net' || OL.st === 'err')) olPull('online'); });
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { olFlush(); return; }
    if (OL.ses && !OL.busy && Date.now() - OL.pulled > 120000) olPull('back');   // zurück im Spiel: anderes Gerät inzwischen gespielt?
  });
  addEventListener('pagehide', olFlush);
  // anderer Tab: angemeldet (Link aus der E-Mail), abgemeldet, erneuert
  addEventListener('storage', e => {
    if (e.key === OLK.ses) { const had = OL.ses; olSesLoad(); if (OL.ses && (!had || had.uid !== OL.ses.uid)) { OL.ses.mail && toast(_t('Angemeldet als {name}', { name: OL.ses.mail }), '#79c24e'); olSignedIn(); olRe(); } else if (!OL.ses && had) { olSet('out'); olRe(); } }
    else if (e.key === OLK.sync) { const s = olLs(OLK.sync); if (s && OL.ses && s.uid === OL.ses.uid) OL.S = s; }
  });
  panel.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target || !e.target.id) return; const k = { ol_mail: 'ol_link', ol_code: 'ol_code', ol_name: 'ol_name' }[e.target.id]; if (k) { e.preventDefault(); ON[k](); } });

  ON.ol_open = id => { OL.msg = ''; OL.ask = ''; OL.nameIn = null; olShow(id); };
  ON.ol_back = () => { OL.ask = ''; if (OL.from === 'settings') showSettings(); else showTitle(); };
  ON.ol_no = () => { OL.ask = ''; olGrab(); olShow(); };
  ON.ol_link = () => { olGrab(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(OL.mail)) { OL.msg = _t('Bitte gib eine gültige E-Mail-Adresse ein.'); olShow(); return; } olAct(async () => { await olSendLink(OL.mail); OL.sent = true; }); };
  ON.ol_code = () => { const c = (($('ol_code') || {}).value || '').replace(/\s+/g, ''); if (!/^\d{4,10}$/.test(c)) { olGrab(); OL.msg = _t('Bitte gib den Code aus der E-Mail ein.'); olShow(); return; } olAct(async () => { await olVerify(OL.mail, c); OL.msg = _t('Angemeldet.'); }); };
  ON.ol_google = () => olGoogle();
  ON.ol_name = () => { olGrab(); const n = String(OL.nameIn || '').trim(); if (!OL_NAME.test(n)) { OL.msg = _t('Der Name braucht 2–20 Zeichen: Buchstaben, Ziffern, Leerzeichen, - _ .'); olShow(); return; } olAct(async () => { await olSaveName(n); OL.msg = _t('Name gespeichert.'); }); };
  ON.ol_now = () => olAct(async () => {
    if (OL.bad === 'new') return;
    if (OL.conf) { olConf(); return; }
    OL.S.off = false; const base = OL.bad === 'bad' ? OL.badRev : undefined; OL.bad = null;
    const ok = await olPush({ force: true, base }); OL.msg = ok ? _t('Gesichert.') : OL.conf ? '' : olStatus();
  });
  ON.ol_conf = () => olConf();
  ON.ol_later = () => { OL.later = true; showTitle(); };
  ON.ol_keep = id => {
    const C = OL.conf; if (!C) { showTitle(); return; }
    if (id === 'cloud') { if (olTake(C.row, C.s, true)) showTitle(); else olConf(); return; }
    // dieses Gerät behalten: Cloud-Stand ins Backup, dann mit Basis = Cloud-Revision hochladen
    if (!olBackup(JSON.stringify(C.row.data), 'cloud', Date.parse(C.row.updated_at), C.row.device)) { toast(_t('Backup nicht möglich – der Speicher im Browser ist voll.'), '#ff7a6a'); return; }
    OL.conf = null; showTitle(); olPush({ force: true, base: +C.row.rev });
  };
  ON.ol_bak = () => {
    if (OL.ask !== 'ol_bak') { OL.ask = 'ol_bak'; olGrab(); olShow(); return; }
    OL.ask = ''; const B = olBak(); let s = null; try { s = olCheck(JSON.parse(B.data)); } catch (_) { }
    if (!s) { OL.msg = _t('Das Backup ist beschädigt und kann nicht geladen werden.'); olShow(); return; }
    // tauschen: der jetzige Stand wird das neue Backup
    if (!olBackup(olLocalJSON(), 'local', OL.S.lt || Date.now(), olDev())) { OL.msg = _t('Backup nicht möglich – der Speicher im Browser ist voll.'); olShow(); return; }
    if (!olApply(s)) { olBackup(B.data, B.src, B.at, B.dev); OL.msg = _t('Das Backup ist beschädigt und kann nicht geladen werden.'); olShow(); return; }
    OL.msg = _t('Backup wiederhergestellt. Dein vorheriger Spielstand ist jetzt das Backup.'); olShow();
  };
  ON.ol_del = () => {
    if (OL.ask !== 'ol_del') { OL.ask = 'ol_del'; olGrab(); olShow(); return; }
    olAct(async () => {
      await olFetch('/rest/v1/saves?user_id=eq.' + encodeURIComponent(OL.ses.uid), { method: 'DELETE', auth: true, headers: { Prefer: 'return=minimal' } });
      Object.assign(OL.S, { rev: 0, hash: null, at: 0, off: true }); olSaveS(); clearTimeout(OL.tm); OL.tm = 0; OL.conf = null; OL.bad = null; olSet('stop');
      OL.msg = _t('Cloud-Spielstand gelöscht. Dein Spielstand auf diesem Gerät bleibt.');
    });
  };
  ON.ol_out = () => { olGrab(); olSignOut(); OL.msg = _t('Abgemeldet. Dein Spielstand auf diesem Gerät bleibt.'); olShow(); };
  ON.ol_kill = () => {
    if (OL.ask !== 'ol_kill') { OL.ask = 'ol_kill'; olGrab(); olShow(); return; }
    olAct(async () => {
      await olFetch('/rest/v1/rpc/kh_delete_me', { method: 'POST', auth: true, body: '{}' });
      olSesSave(null); OL.S = {}; olLsSet(OLK.sync, null); olSignOut();
      OL.msg = _t('Konto gelöscht. Dein Spielstand auf diesem Gerät bleibt.');
    });
  };

  // Handbuch: ein Eintrag unter „Grundlagen“ (nur mit Zugang)
  if (typeof HB_BUILD !== 'undefined') {
    HB_BUILD.push(['konto', () => {
      HB.chap = 'start';
      E('start:konto', _t('Konto & Cloud'), { ic: ['pa', 'truhe'], kw: 'konto cloud anmelden login google e-mail email link code sichern synchronisieren geräte gerät backup abmelden löschen datenschutz online', see: ['start:speichern'], go: ['konto'],
        s: _t('Mit einem Konto liegt dein Spielstand auch in der Cloud – spiel auf jedem Gerät weiter.'),
        b: () => hUl([_t('Anmelden: Einstellungen → Konto & Cloud – mit deiner E-Mail-Adresse (Link oder Code aus der E-Mail) oder mit Google.'), _t('Das Spiel sichert von selbst, wenige Sekunden nach dem Speichern und beim Schließen. „Jetzt sichern“ geht sofort.'), _t('Ohne Internet spielst du ganz normal weiter – gesichert wird, sobald du wieder online bist.'), _t('Wurde auf zwei Geräten unterschiedlich gespielt, fragt das Spiel, welchen Spielstand du behalten willst. Der andere bleibt als Backup und lässt sich wiederherstellen.'), _t('Gespeichert werden nur deine E-Mail-Adresse, dein Anzeigename und dein Spielstand. Cloud-Spielstand und Konto kannst du jederzeit löschen.')]) });
    }]);
    HBGO.konto = { l: () => _t('Zu Konto & Cloud'), c: 'title', f: () => olShow('title') };
  }
}
