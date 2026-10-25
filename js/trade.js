'use strict';
/* =========================================================
   KLINGENHORT – Tauschen – Gegenstände, Bündel und Begleiter per Code oder Link verschenken,
   Tauschhändlerin mit Tagesangeboten, Aussehen der Ausrüstung (Sammlung + Spiegel)
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein. Der Held wird mit visItem(it) gezeichnet.
   Tauschcode: KH5-<base64url(JSON)>.<Prüfsumme>, JSON = { v: 1, id, t: i|b|p|e, d, n: Absender, at }
   Konto: SAVE.meta.trades = { got, own, log, deal }, SAVE.meta.looks = { key: 1 }, SAVE.meta.lookRw
   Gegenstand: it.skin = { tier, form } (nur Aussehen, die Werte bleiben)
   ========================================================= */

const TR_ELS = ['feuer', 'frost', 'blitz', 'gift', 'licht', 'schatten'];
const TR_ELC = { feuer: '#ff6a2a', frost: '#8ee6ea', blitz: '#ffe85a', gift: '#79c24e', licht: '#fff3c0', schatten: '#9a6ad8' };
const TR_ELN = { feuer: _t('Feuer'), frost: _t('Frost'), blitz: _t('Blitz'), gift: _t('Gift'), licht: _t('Licht'), schatten: _t('Schatten') };
const TR_GRADE = [_t('Roh'), _t('Grob'), _t('Solide'), _t('Fein'), _t('Edel'), _t('Meister'), _t('Großmeister'), _t('Sagenhaft'), _t('Uralt'), _t('Göttlich')];
const TR_GRC = ['#a8a08a', '#c8c8c8', '#79c24e', '#57a7d6', '#b892f4', '#ff8a3a', '#e8402a', '#ffd24a', '#8ee6ea', '#ffffff'];
const TR_PART = { klinge: _t('Klinge'), griff: _t('Griff'), kern: _t('Elementkern'), platte: _t('Panzerplatte'), polster: _t('Polsterung'), rune: _t('Rune') };
const TR_LOG = 30;
const trHas = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
const trInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const trObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
const trBadKey = k => k === '__proto__' || k === 'constructor' || k === 'prototype';
// echter, aktiver Held (auf dem Titel steht sonst nur ein Platzhalter-Ritter herum)
const trHero = () => !!(P && SAVE && SAVE.active >= 0 && SAVE.chars[SAVE.active] && SAVE.chars[SAVE.active].id === P.id);
const trPets = () => SAVE && trObj(SAVE.meta.pets) ? SAVE.meta.pets : null;
const trPetsOn = () => typeof petExport === 'function' && typeof petImport === 'function';
document.head.insertAdjacentHTML('beforeend', '<style>.tr-rng{width:100%;height:30px;margin:2px 0 0;accent-color:var(--gold)}.tr-n{text-align:right;min-width:60px}.tr-n small{display:block;font-size:15px;color:var(--parch-dim)}.tr-num{width:64px;min-height:40px;box-sizing:border-box;font:20px var(--f-body);background:var(--night);color:var(--parch);border:2px solid var(--stone-hi);text-align:right;padding:2px 6px}.tr-foot{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.tr-foot .sub{grid-column:1/-1;margin:0}@media (min-width:600px){.tr-foot{grid-template-columns:minmax(0,1fr) auto auto}.tr-foot .sub{grid-column:auto}}.tr-code{font-size:14px;word-break:break-all}.tr-ok{box-shadow:inset 0 0 0 2px var(--moss)}.tr-bad{color:var(--blood)}.tm-bar{position:relative;height:16px;background:var(--night);box-shadow:0 0 0 2px var(--stone-hi);margin:4px 0}.tm-bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#d0b0ff,#6a48c0)}.tm-bar span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:7px;text-shadow:1px 1px 0 #000}.tm-g{grid-template-columns:repeat(4,minmax(0,1fr))}@media (min-width:520px){.tm-g{grid-template-columns:repeat(8,minmax(0,1fr))}}.tm-g .slot{width:auto;height:54px;aspect-ratio:auto;margin:0}.tm-g .slot.lock img{filter:brightness(0);opacity:.38}.tm-g .slot.sel{box-shadow:inset 0 0 0 3px var(--gold)}.tm-top{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;margin-bottom:6px}.tm-prev{display:flex;align-items:flex-end;gap:4px;background:radial-gradient(circle,var(--stone-hi),var(--stone-lo));padding:6px 8px}.tm-prev img{width:48px;height:48px;object-fit:contain;image-rendering:pixelated}.tm-n{color:var(--parch-dim)}</style>');

/* ---------- Spielstand ---------- */
HOOK.meta.push(m => {
  const t = trObj(m.trades) ? m.trades : {}, d = trObj(t.deal) ? t.deal : {};
  const ids = a => Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length <= 24).slice(-4000) : [];
  m.trades = {
    got: ids(t.got), own: ids(t.own),
    log: Array.isArray(t.log) ? t.log.filter(e => trObj(e) && typeof e.c === 'string' && e.c.length < 12000).slice(0, TR_LOG) : [],
    deal: { d: Number.isInteger(d.d) ? d.d : 0, done: Array.isArray(d.done) ? d.done.filter(x => trInt(x, 0, 9)) : [] }
  };
  if (!trObj(m.looks)) m.looks = {};
  if (!trInt(m.lookRw, 0, 99)) m.lookRw = 0;
});
HOOK.activate.push(p => { if (p.gear) for (const s of ['weapon', 'armor', 'helm']) tmAdd(p.gear[s]); for (const it of Array.isArray(p.bag) ? p.bag : []) tmAdd(it); });
HOOK.pickup.push(it => tmAdd(it, true));
HOOK.boot.push(() => {
  // alte Spielstände: alles, was schon im Besitz ist, zählt zur Sammlung
  let n = 0;
  for (const c of SAVE.chars) { if (trObj(c.gear)) for (const s in c.gear) n += tmAdd(c.gear[s]); for (const it of Array.isArray(c.bag) ? c.bag : []) n += tmAdd(it); }
  for (const it of SAVE.meta.hide.stash || []) n += tmAdd(it);
  if (n) persist();
  trLinkCheck(true);
});
addEventListener('hashchange', () => trLinkCheck(false));

/* ---------- Tauschcode ---------- */
function trB64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function trB64d(s) { let b = s.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return decodeURIComponent(escape(atob(b))); }
// Prüfsumme (2 × 3 Zeichen): findet Tippfehler, abgeschnittene und veränderte Codes
function trSum(s) { let a = 2166136261, b = 52711; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a ^= c; a = Math.imul(a, 16777619); b = (Math.imul(b, 31) + c * (i + 7)) | 0; } return ((a >>> 0) % 46656).toString(36).padStart(3, '0') + ((b >>> 0) % 46656).toString(36).padStart(3, '0'); }
function trEncode(o) { const body = trB64e(JSON.stringify(o)); return 'KH5-' + body + '.' + trSum(body); }
function trLink(code) { return location.href.split('#')[0] + '#tausch=' + code; }
function trId() { let s = ''; while (s.length < 12) s += Math.random().toString(36).slice(2); return s.slice(0, 12); }
// Code aus beliebigem Text lesen (Link, Nachricht, Zeilenumbrüche) – liefert { p } oder { err }
function trParse(text) {
  let s = String(text == null ? '' : text).slice(0, 20000).replace(/\s+/g, ''); if (!s) return { err: 'empty' };
  if (s.includes('%')) try { s = decodeURIComponent(s); } catch (_) { }
  const m = s.match(/KH5-([A-Za-z0-9_-]{8,12000})\.([0-9a-z]{6})/);
  if (!m) return { err: 'format' };
  if (trSum(m[1]) !== m[2]) return { err: 'sum' };
  let o; try { o = JSON.parse(trB64d(m[1])); } catch (_) { return { err: 'data' }; }
  let p = null; try { p = trValid(o); } catch (_) { p = null; }
  if (!p) return { err: 'data' };
  p.code = 'KH5-' + m[1] + '.' + m[2];
  return { p };
}
const trSp = s => typeof s === 'string' && /^[a-z0-9_]{2,24}$/i.test(s) && !trBadKey(s);
function trValid(o) {
  if (!trObj(o) || o.v !== 1 || typeof o.id !== 'string' || !/^[a-z0-9]{6,20}$/.test(o.id)) return null;
  const n = typeof o.n === 'string' ? o.n.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20) : '';
  const at = Number.isFinite(o.at) ? clamp(Math.floor(o.at), 0, 4e9) : 0;
  let d = null;
  if (o.t === 'i') d = trItem(o.d);
  else if (o.t === 'b') d = trBundle(o.d);
  else if (o.t === 'p') { d = trPlain(o.d, 0); if (!(trObj(d) && trSp(d.sp))) d = null; }
  else if (o.t === 'e') d = trObj(o.d) && trSp(o.d.sp) ? { sp: o.d.sp } : null;
  return d ? { id: o.id, t: o.t, d, n: n || '?', at } : null;
}
// Gegenstand Feld für Feld prüfen: ungültig → abgelehnt, unplausibel → auf erlaubte Werte gesetzt
function trItem(d) {
  if (!trObj(d) || !['weapon', 'armor', 'helm'].includes(d.slot)) return null;
  const slot = d.slot, isW = slot === 'weapon', base = isW ? d.base : slot;
  if (isW && !(typeof base === 'string' && trHas(WT, base) && trHas(WFORM, base))) return null;
  if (!trInt(d.tier, 0, TIERS - 1) || !trInt(d.rar, 0, RAR.length - 1)) return null;
  const it = { uid: uid(), slot, base, tier: d.tier, rar: d.rar, up: trInt(d.up, 0, 10) ? d.up : 0, aff: {}, sockets: trInt(d.sockets, 0, 3) ? d.sockets : 0, gems: [], set: null, name: null, suf: null, fz: trInt(d.fz, 0, 5) ? d.fz : 0 };
  if (isW) { const F = WFORM[base]; it.form = F.some(f => f.id === d.form) ? d.form : (F.find(f => f.std) || F[0]).id; }
  if (typeof d.myth === 'string' && trHas(MYTHIC, d.myth) && MYTHIC[d.myth].slot === slot) it.myth = d.myth;
  else if (typeof d.set === 'string' && trHas(SETS, d.set)) it.set = d.set;
  if (it.myth) it.rar = 6; else if (it.rar === 6) it.rar = 4;
  if (it.set) it.rar = 5; else if (it.rar === 5) it.rar = 3;
  const pool = isW ? AFFW : AFFA;
  if (trObj(d.aff)) for (const k of Object.keys(d.aff)) { const v = d.aff[k]; if (trHas(pool, k) && typeof v === 'number' && Number.isFinite(v) && Object.keys(it.aff).length < RAR[it.rar].aff + 1) it.aff[k] = +clamp(v, 0, pool[k].f(6)).toFixed(3); }
  if (Array.isArray(d.gems)) for (const g of d.gems) if (it.gems.length < it.sockets && trGemOk(g)) it.gems.push(g);
  if (it.myth) it.name = MYTHIC[it.myth].n;
  else if (it.set) it.name = SETS[it.set].pieces[slot];
  else if (it.rar === 4 && typeof d.name === 'string' && (LEGEND[isW ? base : slot] || []).includes(d.name)) it.name = d.name;
  if (!it.name && it.rar < 4 && typeof d.suf === 'string' && Object.keys(pool).some(k => pool[k].suf === d.suf)) it.suf = d.suf;
  // Felder der Schmiede (js/forge.js): Element und Meisterwerk-Grade als einfache Daten
  if (typeof d.el === 'string' && TR_ELS.includes(d.el)) it.el = d.el;
  if (d.mw != null) { const mw = trPlain(d.mw, 2, 100); if (mw != null) it.mw = mw; }
  return it;
}
// beliebige Daten auf einfache, begrenzte JSON-Werte reduzieren (Begleiter, Meisterwerk)
function trPlain(v, dp, lim) {
  lim = lim || 1e9;
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? clamp(v, -lim, lim) : 0;
  if (typeof v === 'string') return v.slice(0, 40);
  if (dp > 3) return null;
  if (Array.isArray(v)) return v.slice(0, 24).map(x => trPlain(x, dp + 1, lim));
  if (trObj(v)) { const r = {}; let n = 0; for (const k of Object.keys(v)) { if (trBadKey(k) || !/^[A-Za-z0-9_:]{1,24}$/.test(k) || n++ >= 32) continue; r[k] = trPlain(v[k], dp + 1, lim); } return r; }
  return null;
}
const trGemOk = k => typeof k === 'string' && /^[a-z]+:\d$/.test(k) && trHas(GEMS, k.split(':')[0]) && +k.split(':')[1] < GEMGRADE.length;
const trPartOk = k => typeof k === 'string' && /^[a-z]{2,12}(:[a-z]{2,12})?:(10|[1-9])$/.test(k) && !trBadKey(k.split(':')[0]);
function trBundle(d) {
  if (!trObj(d)) return null;
  const r = { m: {}, g: {}, p: {} }; let n = 0;
  const each = (src, ok, dst, max) => { if (trObj(src)) for (const k of Object.keys(src)) if (n < 60 && ok(k) && trInt(src[k], 1, max)) { dst[k] = src[k]; n++; } };
  each(d.m, k => trHas(MATS, k), r.m, 99999); each(d.g, trGemOk, r.g, 9999); each(d.p, trPartOk, r.p, 9999);
  return n ? r : null;
}

/* ---------- Senden ---------- */
function trItemData(it) { const o = {}; for (const k of ['slot', 'base', 'tier', 'rar', 'up', 'aff', 'sockets', 'gems', 'set', 'name', 'suf', 'fz', 'form', 'myth', 'el', 'mw']) if (it[k] != null) o[k] = it[k]; return JSON.parse(JSON.stringify(o)); }
// Code bauen und nur behalten, wenn er sich selbst wieder lesen lässt
function trMake(t, d) {
  const p = { v: 1, id: trId(), t, d, n: P && P.name ? String(P.name).slice(0, 20) : '?', at: Math.floor(Date.now() / 1000) };
  let code; try { code = trEncode(p); } catch (_) { return null; }
  if (!trParse(code).p) return null;
  const S = SAVE.meta.trades; S.own.push(p.id); S.log.unshift({ c: code, at: Date.now(), r: 0 }); S.log.length = Math.min(S.log.length, TR_LOG);
  return code;
}
function trBunClean() { const b = trBundle(TRD.bun); if (!b) return null; for (const k in b.m) if ((P.mats[k] || 0) < b.m[k]) return null; for (const k in b.g) if ((P.gems[k] || 0) < b.g[k]) return null; for (const k in b.p) if (((P.parts || {})[k] || 0) < b.p[k]) return null; return b; }
function trSend(a) {
  if (!a || !trHero()) return null;
  if (a.t === 'i') { const i = P.bag.findIndex(x => x.uid === a.uid); if (i < 0) return null; const code = trMake('i', trItemData(P.bag[i])); if (!code) return null; P.bag.splice(i, 1); saveChar(); return code; }
  if (a.t === 'b') { const b = trBunClean(); if (!b) return null; const code = trMake('b', b); if (!code) return null; trTake({ m: b.m, g: b.g, p: b.p }, -1); saveChar(); return code; }
  const S = trPets(); if (!S) return null;
  if (a.t === 'p') {
    const pet = Array.isArray(S.list) && S.list[a.i]; if (!pet || !trPetsOn()) return null;
    let d = null; try { d = petExport(a.i); } catch (_) { d = null; }
    if (!trObj(d)) return null; d = JSON.parse(JSON.stringify(d)); if (!d.sp) d.sp = pet.sp;
    const code = trMake('p', d); if (!code) return null; trPetRemove(a.i, pet); persist(); return code;
  }
  if (a.t === 'e') { const egg = Array.isArray(S.eggs) && S.eggs[a.i]; if (!egg || !trSp(egg.sp)) return null; const code = trMake('e', { sp: egg.sp }); if (!code) return null; S.eggs.splice(a.i, 1); persist(); return code; }
  return null;
}
// Begleiter abgeben: pets.js darf das selbst (petRemove), sonst aus der Liste nehmen
function trPetRemove(i, pet) {
  const S = trPets();
  if (typeof petRemove === 'function') { try { petRemove(i); } catch (_) { } }
  const j = S.list.indexOf(pet); if (j < 0) return;
  S.list.splice(j, 1);
  if (typeof S.act === 'number') { if (S.act === j) S.act = -1; else if (S.act > j) S.act--; } else if (S.act === pet.id) S.act = null;
}

/* ---------- Empfangen ---------- */
function trAccept(p) {
  const S = SAVE.meta.trades;
  if (S.got.includes(p.id)) return 'used';
  if (S.own.includes(p.id)) return 'own';
  const hero = p.t === 'i' || p.t === 'b';
  if (hero && !trHero()) return 'hero';
  if (p.t === 'i') { if (P.bag.length >= 30) return 'bag'; const it = trItem(p.d); if (!it) return 'data'; addToBag(it); }
  else if (p.t === 'b') { const b = trBundle(p.d); if (!b) return 'data'; trTake(b, 1); }
  else {
    const fn = p.t === 'p' ? (typeof petImport === 'function' ? petImport : null) : (typeof eggGive === 'function' ? eggGive : null);
    if (!fn) return 'pets';
    let r; try { r = p.t === 'p' ? fn(JSON.parse(JSON.stringify(p.d))) : fn(p.d.sp); } catch (_) { return 'petfail'; }
    if (r === false) return 'petfull';
  }
  S.got.push(p.id); S.log.unshift({ c: p.code, at: Date.now(), r: 1 }); S.log.length = Math.min(S.log.length, TR_LOG);
  stat('trades');
  if (hero || trHero()) saveChar(); else persist();
  return 'ok';
}
function trErr(e) {
  return {
    empty: _t('Füge zuerst einen Tauschcode oder Tauschlink ein.'),
    format: _t('Das ist kein Tauschcode. Ein Tauschcode beginnt mit „KH5-“.'),
    sum: _t('Der Code ist beschädigt oder unvollständig. Bitte noch einmal ganz kopieren.'),
    data: _t('Der Code enthält ungültige Daten und kann nicht eingelöst werden.'),
    used: _t('Diesen Code hast du schon eingelöst. Jeder Code gilt nur einmal.'),
    own: _t('Das ist dein eigener Tauschcode – schick ihn einem Freund.'),
    hero: _t('Wähle zuerst einen Helden, der das Geschenk bekommt.'),
    bag: _t('Dein Beutel ist voll (30/30). Mach Platz und versuch es noch einmal.'),
    pets: _t('In diesem Code steckt ein Begleiter – diese Version kann ihn noch nicht annehmen. Der Code bleibt gültig.'),
    petfull: _t('Kein Platz für einen weiteren Begleiter. Der Code bleibt gültig.'),
    petfail: _t('Der Begleiter konnte nicht übernommen werden. Der Code bleibt gültig.')
  }[e] || _t('Das hat nicht geklappt.');
}
// Link geöffnet (#tausch=…): Hash entfernen und den Code zeigen – oder merken, falls gerade ein anderer Dialog offen ist
function trLinkCheck(boot) {
  const m = (location.hash || '').match(/tausch=([^&]+)/); if (!m) return;
  let code = m[1]; try { code = decodeURIComponent(code); } catch (_) { }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { }
  TRD.code = code; TRD.res = trParse(code); TRD.pend = true;
  const onTitle = state === 'title' && !ov.hidden && panel.querySelector('.logo');
  if (onTitle) trOpen('recv', 'title');
  else if (!boot && state === 'map' && !ov.hidden) trOpen('recv', 'map');
  else if (!boot) toast(_t('Tauschcode erkannt – du findest ihn im Hauptmenü unter „Tausch empfangen“.'), '#ffd24a');
}

/* ---------- Bündel, Preise, Tagesangebote ---------- */
// s = { m: {mat: n}, g: {gem: n}, p: {part: n}, gold, fate, egg }
function trCan(s) {
  if (!trHero()) return false;
  for (const k in s.m || {}) if ((P.mats[k] || 0) < s.m[k]) return false;
  for (const k in s.g || {}) if ((P.gems[k] || 0) < s.g[k]) return false;
  for (const k in s.p || {}) if (((P.parts || {})[k] || 0) < s.p[k]) return false;
  return (s.gold || 0) <= P.gold && (s.fate || 0) <= (P.fate || 0);
}
function trTake(s, sign) {
  if (!P.parts) P.parts = {};
  for (const k in s.m || {}) P.mats[k] = (P.mats[k] || 0) + sign * s.m[k];
  for (const k in s.g || {}) P.gems[k] = (P.gems[k] || 0) + sign * s.g[k];
  for (const k in s.p || {}) { P.parts[k] = (P.parts[k] || 0) + sign * s.p[k]; if (P.parts[k] <= 0) delete P.parts[k]; }
  P.gold += sign * (s.gold || 0); P.fate = (P.fate || 0) + sign * (s.fate || 0);
}
const TR_MATL = [['erz', 'leder', 'knochen', 'schleim', 'zahn'], ['kristall', 'horn', 'glut', 'mithril'], ['adamant', 'schuppe', 'stern', 'aether']];
// drei Angebote pro Tag, für alle gleich (nach Datum), Mengen passend zum Fortschritt des Helden
function trDeals(day) {
  day = day || dayKey();
  const R = mulberry(day * 7919 + 13), lv = !P ? 0 : (P.maxAct || 1) <= 2 ? 0 : P.maxAct <= 5 ? 1 : 2, M = TR_MATL[lv], pk = a => a[Math.floor(R() * a.length)];
  const g = Math.min(10, 1 + lv * 2 + (R() < .3 ? 1 : 0)), el = pk(TR_ELS), gem = pk(GEMORDER), gem2 = pk(GEMORDER), m1 = pk(M), m2 = pk(M.filter(x => x !== m1)), hi = pk(TR_MATL[Math.min(2, lv + 1)]);
  const T = [
    { give: { m: { [m1]: 10 + lv * 4, [m2]: 6 + lv * 2 } }, get: { p: { ['klinge:' + g]: 1 } } },
    { give: { m: { [m1]: 8 + lv * 3 }, gold: 150 + lv * 400 }, get: { p: { ['kern:' + el + ':' + g]: 1 } } },
    { give: { g: { [gem + ':' + lv]: 3 } }, get: { gold: 270 * (lv + 1) * (lv + 1) + 60 } },
    { give: { gold: 400 + lv * 1400 }, get: { g: { [gem2 + ':' + Math.min(4, lv + 1)]: 1 } } },
    { give: { m: { [m1]: 18 + lv * 6 } }, get: { m: { [hi]: lv === 2 ? 2 : 3 } } },
    { give: { m: { [m1]: 25 + lv * 10, [m2]: 15 + lv * 5 } }, get: { fate: 1 } },
    { give: { fate: 3 }, get: { g: { [gem2 + ':' + Math.min(4, lv + 2)]: 1 } } }
  ];
  if (typeof eggGive === 'function') T.push({ give: { fate: 25 }, get: { egg: 1 } });
  const idx = T.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, 3).map(i => T[i]);
}
function trDealState() { const S = SAVE.meta.trades.deal, d = dayKey(); if (S.d !== d) { S.d = d; S.done = []; } return S; }
function trDealDo(i) {
  const D = trDeals(), o = D[i], S = trDealState(); if (!o || S.done.includes(i) || !trCan(o.give)) { sfx('deny'); return false; }
  trTake(o.give, -1);
  if (o.get.egg) { let ok = false; try { const sp = trRandSp(); ok = (sp ? eggGive(sp) : eggGive()) !== false; } catch (_) { ok = false; } if (!ok) { trTake(o.give, 1); toast(trErr('petfull'), '#ff6a5a'); sfx('deny'); return false; } }
  else trTake(o.get, 1);
  S.done.push(i); saveChar(); sfx('buy'); toast(_t('Getauscht: {what}', { what: trSpecText(o.get) }), '#79c24e');
  return true;
}

/* ---------- Begleiter und Bauteile anzeigen (Daten aus pets.js / forge.js, wenn vorhanden) ---------- */
function trSpTab() { const T = typeof PET_SP !== 'undefined' ? PET_SP : null; return T && typeof T === 'object' ? T : null; }
function trSpDef(sp) { const T = trSpTab(); if (!T) return null; return Array.isArray(T) ? T.find(x => x && x.id === sp) || null : trHas(T, sp) ? T[sp] : null; }
function trRandSp() { const T = trSpTab(); if (!T) return null; const ks = Array.isArray(T) ? T.map(x => x && x.id).filter(trSp) : Object.keys(T).filter(trSp); return ks.length ? pick(ks) : null; }
function trSpName(sp) { const D = trSpDef(sp); return D && typeof D.n === 'string' ? D.n : String(sp || '?').replace(/^./, c => c.toUpperCase()); }
function trSpEl(sp) {
  const D = trSpDef(sp); if (D && TR_ELS.includes(D.el)) return D.el;
  const s = String(sp || '').toLowerCase();
  return /drach|glut|feuer/.test(s) ? 'feuer' : /katz|geist|schatt/.test(s) ? 'schatten' : /kaefer|käfer|gold|licht/.test(s) ? 'licht' : /eule|frost|eis/.test(s) ? 'frost' : /natter|gift|schlang/.test(s) ? 'gift' : /funk|sturm|blitz/.test(s) ? 'blitz' : null;
}
function trPetName(p) { return p && typeof p.nm === 'string' && p.nm.trim() ? p.nm.slice(0, 20) : trSpName(p && p.sp); }
function trPetIcon(p) { if (typeof petIconURL === 'function') { try { const u = petIconURL(p); if (typeof u === 'string' && u.startsWith('data:')) return u; } catch (_) { } } const el = trSpEl(p && p.sp); return trArt('paw', el ? TR_ELC[el] : '#e8b04a'); }
function trEggIcon(sp) { const el = trSpEl(sp); return trArt('egg', el ? TR_ELC[el] : '#efe2bf', '#6a4a8a'); }
function trPartName(k) {
  if (typeof pname === 'function' && typeof pparse === 'function') { try { const p = pparse(k), s = pname(p.t, p.g, p.el); if (typeof s === 'string' && s) return s; } catch (_) { } }
  const a = k.split(':'), g = +a[a.length - 1], t = TR_PART[a[0]] || a[0].replace(/^./, c => c.toUpperCase()), el = a.length > 2 ? TR_ELN[a[1]] || a[1] : null;
  return _t('{part} ({grade})', { part: el ? t + ' · ' + el : t, grade: TR_GRADE[g - 1] || g });
}
function trPartIcon(k) {
  if (typeof partIconURL === 'function' && typeof pparse === 'function') { try { const p = pparse(k), u = partIconURL(p.t, p.g, p.el); if (typeof u === 'string' && u.startsWith('data:')) return u; } catch (_) { } }
  const a = k.split(':'), g = clamp(+a[a.length - 1] || 1, 1, 10), el = a.length > 2 ? a[1] : null;
  return trArt('p_' + a[0], el && TR_ELC[el] ? TR_ELC[el] : MAT[clamp(Math.floor((g - 1) * .8), 0, TIERS - 1)].m[2], TR_GRC[g - 1]);
}
function trShade(hex, k) { const [r, g, b] = hexRgb(hex); const f = v => clamp(Math.round(k > 1 ? v + (255 - v) * (k - 1) : v * k), 0, 255).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); }
/* kleine Pixel-Icons: Ei, Pfote, Bauteile, Krone, Heiligenschein */
const TR_ART = {};
function trArt(k, c, c2) {
  const key = k + '|' + (c || '') + '|' + (c2 || ''); if (TR_ART[key]) return TR_ART[key];
  c = c || '#e8b04a'; const b = PB(16, 16), d = trShade(c, .6), l = trShade(c, 1.4);
  switch (k) {
    case 'egg': for (let y = 2; y < 15; y++) for (let x = 3; x < 13; x++) { const dx = (x + .5 - 8) / 4.8, dy = (y + .5 - 8.6) / (y < 9 ? 6.6 : 5.8); if (dx * dx + dy * dy <= 1) b.set(x, y, dx * .7 + dy * .9 > .5 ? d : c); } for (const [x, y] of [[6, 7], [9, 10], [10, 6], [6, 11], [8, 4]]) b.set(x, y, c2 || d); b.set(6, 4, '#fff'); b.set(5, 5, '#fff'); break;
    case 'paw': b.disc(8, 10.5, 3.2, c); b.disc(8.5, 11.5, 1.6, d); for (const [x, y] of [[3.5, 6.5], [6.5, 4], [10, 4], [12.5, 6.5]]) b.disc(x, y, 1.3, c); b.set(7, 9, l); break;
    case 'p_klinge': for (let i = 0; i < 9; i++) { b.set(4 + i, 11 - i, l); b.set(5 + i, 11 - i, c); b.set(5 + i, 12 - i, d); } b.line(2, 9, 6, 13, GOLDC[1]); b.set(3, 12, LEATH[2]); b.set(2, 13, LEATH[1]); b.set(1, 14, GOLDC[1]); b.set(4, 11, c2 || c); break;
    case 'p_griff': b.rect(7, 3, 2, 9, LEATH[1]); for (let y = 4; y < 12; y += 2) b.set(7, y, LEATH[2]); b.rect(3, 2, 10, 2, c); b.rect(3, 3, 10, 1, d); b.disc(8, 13, 1.6, c); b.set(8, 13, c2 || l); break;
    case 'p_kern': b.disc(8, 8, 5.2, d); b.disc(8, 8, 4, c); b.disc(7, 7, 1.6, l); b.set(6, 6, '#fff'); if (c2) { b.set(8, 2, c2); b.set(8, 14, c2); b.set(2, 8, c2); b.set(14, 8, c2); } break;
    case 'p_platte': b.rect(3, 3, 10, 9, c); b.rect(3, 3, 10, 1, l); b.rect(4, 12, 8, 1, c); b.rect(5, 13, 6, 1, d); b.rect(12, 4, 1, 8, d); for (const [x, y] of [[4, 4], [11, 4], [4, 10], [11, 10]]) b.set(x, y, GOLDC[2]); b.set(8, 7, c2 || l); break;
    case 'p_polster': b.rect(2, 5, 12, 7, c); b.rect(3, 4, 10, 1, c); b.rect(3, 12, 10, 1, d); b.rect(2, 5, 12, 1, l); for (let x = 3; x < 13; x += 2) b.set(x, 8, d); b.set(8, 8, c2 || l); break;
    case 'p_rune': b.rect(4, 2, 8, 12, '#6a6470'); b.rect(4, 2, 8, 1, '#8a8490'); b.rect(11, 3, 1, 11, '#4a4450'); b.line(6, 4, 9, 7, c); b.line(9, 7, 6, 10, c); b.line(8, 4, 8, 12, c); b.set(8, 7, c2 || l); break;
    case 'crown': b.rect(2, 8, 12, 4, GOLDC[1]); b.rect(2, 11, 12, 1, GOLDC[0]); for (const x of [2, 7, 13]) { b.rect(x, 4, 1, 4, GOLDC[1]); b.set(x, 3, GOLDC[2]); } b.rect(5, 6, 1, 2, GOLDC[1]); b.rect(10, 6, 1, 2, GOLDC[1]); b.set(7, 9, '#c8342c'); b.set(4, 9, '#57a7d6'); b.set(11, 9, '#57a7d6'); break;
    case 'halo': for (let x = 2; x < 14; x++) { const y = Math.round(8 - Math.sqrt(Math.max(0, 1 - ((x - 7.5) / 6) * ((x - 7.5) / 6))) * 3); b.set(x, y, '#ffe08a'); b.set(x, 16 - y, '#e8b04a'); } b.set(1, 8, '#ffe08a'); b.set(14, 8, '#ffe08a'); b.set(5, 6, '#fff'); break;
    default: b.disc(8, 8, 5, c); b.disc(8, 8, 2, d); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; b.set(8 + Math.round(Math.cos(a) * 6), 8 + Math.round(Math.sin(a) * 6), c); }
  }
  const cv = pbCanvas(pbOutline(b));
  return TR_ART[key] = mk(18, 18, g => g.drawImage(cv, 1, 1)).toDataURL();
}
// Zeile mit Symbolen: was in einem Bündel oder Angebot steckt (pay: mit Vorrat und rot, wenn es fehlt)
function trChips(s, pay) {
  const one = (ok, ic, txt) => `<span class="${ok ? '' : 'bad'}"><img src="${ic}" alt="">${txt}</span>`, h = (n, have) => pay ? (have != null ? Math.min(have, 99999) + '/' : '') + n : n;
  let r = '<div class="cost">';
  for (const k in s.m || {}) r += one(!pay || (P.mats[k] || 0) >= s.m[k], iconURL(['mat', k]), h(s.m[k], pay && P.mats[k] || 0) + ' ' + MATS[k].n);
  for (const k in s.g || {}) { const [id, gr] = k.split(':'); r += one(!pay || (P.gems[k] || 0) >= s.g[k], iconURL(['gem', id, +gr]), h(s.g[k], pay && P.gems[k] || 0) + ' ' + esc(_t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[id].n }))); }
  for (const k in s.p || {}) r += one(!pay || ((P.parts || {})[k] || 0) >= s.p[k], trPartIcon(k), h(s.p[k], pay && (P.parts || {})[k] || 0) + ' ' + esc(trPartName(k)));
  if (s.gold) r += `<span class="${!pay || P.gold >= s.gold ? '' : 'bad'}"><i class="coin"></i>${fmt(s.gold)}</span>`;
  if (s.fate) r += `<span class="${!pay || (P.fate || 0) >= s.fate ? '' : 'bad'}"><i class="fc"></i>${pay ? (P.fate || 0) + '/' : ''}${s.fate}</span>`;
  if (s.egg) r += one(true, trEggIcon(''), _t('Zufälliges Begleiter-Ei'));
  return r + '</div>';
}
function trSpecText(s) {
  const L = [];
  for (const k in s.m || {}) L.push(s.m[k] + ' ' + MATS[k].n);
  for (const k in s.g || {}) { const [id, gr] = k.split(':'); L.push(s.g[k] + ' ' + _t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[id].n })); }
  for (const k in s.p || {}) L.push(s.p[k] + ' ' + trPartName(k));
  if (s.gold) L.push(_t('{n} Gold', { n: fmt(s.gold) }));
  if (s.fate) L.push(s.fate === 1 ? _t('1 Glücksmünze') : _t('{n} Glücksmünzen', { n: s.fate }));
  if (s.egg) L.push(_t('Zufälliges Begleiter-Ei'));
  return L.join(', ');
}
function trSpecIcon(s) {
  for (const k in s.m || {}) return iconURL(['mat', k]);
  for (const k in s.g || {}) { const [id, gr] = k.split(':'); return iconURL(['gem', id, +gr]); }
  for (const k in s.p || {}) return trPartIcon(k);
  if (s.egg) return trEggIcon('');
  return iconURL(['pa', 'muenze']);
}
// Beschreibung eines Tauschs: Symbol, kurzer Name, Farbe und Vorschau
function trDesc(p) {
  if (p.t === 'i') return { ic: itemIconURL(p.d), n: itemName(p.d), c: itemColor(p.d), html: itemDetail(p.d, '') };
  if (p.t === 'b') { const n = Object.keys(p.d.m).length + Object.keys(p.d.g).length + Object.keys(p.d.p).length; return { ic: trSpecIcon(p.d), n: n === 1 ? trSpecText(p.d) : _t('Bündel: {list}', { list: trSpecText(p.d) }), c: 'var(--parch)', html: `<div class="detail"><div class="nm">${_t('BÜNDEL')}</div>${trChips(p.d)}</div>` }; }
  const pet = p.t === 'p', ic = pet ? trPetIcon(p.d) : trEggIcon(p.d.sp), nm = pet ? trPetName(p.d) : _t('Ei: {sp}', { sp: trSpName(p.d.sp) });
  const st = pet ? trSpName(p.d.sp) + (trInt(p.d.lv, 1, 999) ? ' · ' + _t('LV {lv}', { lv: p.d.lv }) : '') + (p.d.shiny ? ' · ' + _t('schillernd') : '') : _t('Schlüpft nach genug Kämpfen');
  return { ic, n: nm, c: p.d.shiny ? '#ff4fd8' : 'var(--parch)', html: `<div class="detail"><div style="display:flex;gap:10px;align-items:center"><div class="ic big"><img src="${ic}" alt=""></div><div><div class="nm">${esc(nm)}</div><div class="st" style="color:var(--parch-dim);font-size:16px">${esc(st)}</div></div></div></div>` };
}

/* ---------- Oberfläche: Tauschen ---------- */
const TRD = { tab: 'send', from: 'title', mode: 'item', sel: null, bun: { m: {}, g: {}, p: {} }, code: '', res: null, made: null, ask: null, pick: false, pend: false };
function trOpen(tab, from) { if (tab) TRD.tab = tab; if (from) TRD.from = from; TRD.ask = TRD.made = null; TRD.pick = false; if (TRD.tab === 'recv') TRD.pend = false; trShow(); }
function trBack() { TRD.ask = TRD.made = null; if (TRD.from === 'map') showMapMore(); else if (TRD.from === 'char') { selItem = null; openChar(); } else showTitle(); }
function trShow() {
  if (TRD.made) return trShowCode();
  if (TRD.ask) return trShowAsk();
  const tab_ = (k, l) => `<button class="tab" role="tab" aria-selected="${TRD.tab === k}" data-act="tr_tab" data-id="${k}">${l}</button>`;
  let body;
  if ((TRD.tab === 'send' || TRD.tab === 'deal') && !trHero()) body = trHeroPick(_t('Wähle den Helden, mit dem du tauschen willst.'));
  else if (TRD.tab === 'send') body = trSendHTML();
  else if (TRD.tab === 'recv') body = trRecvHTML();
  else if (TRD.tab === 'deal') body = trDealHTML();
  else body = trLogHTML();
  showOverlay(`<div class="head"><h2>${_t('TAUSCHEN')}</h2><div class="hbtns">${trHero() ? `<div class="gold"><i class="coin"></i>${fmt(P.gold)} <span style="color:#ffd24a"><i class="fc"></i>${P.fate || 0}</span></div>` : ''}<button class="btn alt sm" data-act="tr_back">${_t('Zurück')}</button></div></div>
  <div class="tabs" role="tablist">${tab_('send', _t('SENDEN'))}${tab_('recv', _t('EMPFANGEN'))}${tab_('deal', _t('HÄNDLER'))}${tab_('log', _t('VERLAUF'))}</div>${body}`, true);
}
function trHeroPick(msg) {
  if (!SAVE.chars.length) return `<p class="sub">${_t('Erstelle zuerst einen Helden – dann kannst du tauschen.')}</p>`;
  return `<p class="sub" style="color:var(--gold)">${msg}</p>` + SAVE.chars.map((c, i) => { const on = trHero() && SAVE.active === i; return `<div class="cardrow">${heroHTML(c, 1.2)}<div><div style="font-size:20px">${esc(c.name)}</div><div style="font-size:16px;color:var(--parch-dim)">${CLASSES[c.cls].name} · ${_t('LV {lv}', { lv: c.lv })}</div></div><div class="acts"><button class="btn sm${on ? ' alt' : ''}" data-act="tr_hero" data-i="${i}">${on ? _t('Behalten') : _t('Wählen')}</button></div></div>`; }).join('');
}
function trSendHTML() {
  const pets = trPetsOn() && trPets(); if (TRD.mode === 'pet' && !pets) TRD.mode = 'item';
  const md = (k, l) => `<button class="opt${TRD.mode === k ? ' sel' : ''}" data-act="tr_mode" data-id="${k}">${l}</button>`;
  let h = `<p class="sub">${_t('Daraus wird ein Tauschcode, den du als Link teilst. Wer ihn zuerst einlöst, bekommt es.')}</p><div class="opts">${md('item', _t('GEGENSTAND'))}${md('bun', _t('BÜNDEL'))}${pets ? md('pet', _t('BEGLEITER')) : ''}</div>`;
  if (TRD.mode === 'item') {
    const sel = TRD.sel && P.bag.find(x => x.uid === TRD.sel);
    h += `<div class="split"><div><div class="box"><h3 style="margin-top:0">${_t('BEUTEL {n}/30', { n: P.bag.length })}</h3><div class="grid">${P.bag.map(it => itemSlot(it, 'tr_isel', it === sel)).join('') || '<p class="sub">' + _t('Leer') + '</p>'}</div></div></div>`;
    h += sel ? `<div class="side sheet"><button class="btn alt sm sheetx" data-act="tr_isel" data-id="" aria-label="${_t('Schließen')}"><span class="x">×</span></button><div class="acts" style="margin:0 0 4px;justify-content:flex-start"><button class="btn" data-act="tr_ask" data-id="i:${sel.uid}">${_t('Verschenken')}</button></div>${itemDetail(sel, '')}</div>`
      : `<div class="side"><p class="sub" style="margin-top:0">${_t('Tippe einen Gegenstand aus deinem Beutel an. Angelegte Ausrüstung bleibt bei dir.')}</p></div>`;
    return h + '</div>';
  }
  if (TRD.mode === 'bun') {
    const rows = [], row = (cat, k, have, ic, name) => { const n = Math.min(have, TRD.bun[cat][k] || 0), id = cat + ':' + k; return `<div class="row" style="cursor:default"><div class="ic"><img src="${ic}" alt=""></div><div><div class="nm">${esc(name)}</div><input class="tr-rng" type="range" min="0" max="${have}" step="1" value="${n}" data-tr="${id}" aria-label="${esc(name)}"></div><div class="tr-n"><input class="tr-num" type="number" inputmode="numeric" min="0" max="${have}" value="${n}" data-tr="${id}" aria-label="${esc(name)}"><small>/${fmt(have)}</small></div></div>`; };
    for (const k of MATORDER) if ((P.mats[k] || 0) > 0) rows.push(row('m', k, P.mats[k], iconURL(['mat', k]), MATS[k].n));
    for (const k of Object.keys(P.gems).sort()) if (P.gems[k] > 0 && trGemOk(k)) { const [id, gr] = k.split(':'); rows.push(row('g', k, P.gems[k], iconURL(['gem', id, +gr]), _t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[id].n }))); }
    for (const k of Object.keys(P.parts || {}).sort()) if (P.parts[k] > 0 && trPartOk(k)) rows.push(row('p', k, P.parts[k], trPartIcon(k), trPartName(k)));
    if (!rows.length) return h + `<p class="sub">${_t('Du hast noch keine Materialien, Edelsteine oder Bauteile.')}</p>`;
    return h + `<p class="sub" style="margin-top:0">${_t('Schieb die Regler: So viel kommt ins Bündel.')}</p>${rows.join('')}<div class="foot tr-foot"><p class="sub" id="trBunSum">${trBunSum()}</p><button class="btn" id="trBunGo" data-act="tr_ask" data-id="b" ${trBunClean() ? '' : 'disabled'}>${_t('Bündel verschenken')}</button><button class="btn alt" data-act="tr_bunclr">${_t('Leeren')}</button></div>`;
  }
  const S = pets, list = Array.isArray(S.list) ? S.list : [], eggs = Array.isArray(S.eggs) ? S.eggs : [];
  h += list.length ? list.map((p, i) => `<div class="row" style="cursor:default"><div class="ic"><img src="${trPetIcon(p)}" alt=""></div><div><div class="nm"${p.shiny ? ' style="color:#ff4fd8"' : ''}>${esc(trPetName(p))}</div><div class="st">${esc(trSpName(p.sp))} · ${_t('LV {lv}', { lv: trInt(p.lv, 1, 999) ? p.lv : 1 })}</div></div><button class="btn sm" data-act="tr_ask" data-id="p:${i}">${_t('Verschenken')}</button></div>`).join('') : `<p class="sub">${_t('Du hast noch keinen Begleiter.')}</p>`;
  if (eggs.length) h += `<h3>${_t('EIER')}</h3>` + eggs.map((e, i) => `<div class="row" style="cursor:default"><div class="ic"><img src="${trEggIcon(e.sp)}" alt=""></div><div><div class="nm">${esc(_t('Ei: {sp}', { sp: trSpName(e.sp) }))}</div><div class="st">${_t('Beim Verschenken beginnt das Ausbrüten von vorn.')}</div></div><button class="btn sm" data-act="tr_ask" data-id="e:${i}" ${trSp(e.sp) ? '' : 'disabled'}>${_t('Verschenken')}</button></div>`).join('');
  return h;
}
function trBunSum() { const b = trBundle(TRD.bun); return b ? esc(trSpecText(b)) : _t('Noch nichts ausgewählt.'); }
// Regler und Zahlenfeld im Bündel: ohne neu zu zeichnen (sonst springt der Daumen)
function trBunInput(e) {
  const el = e.target; if (!el || !el.closest || !el.closest('#panel')) return;
  if (el.id === 'trIn') { TRD.code = el.value; return; }
  const id = el.dataset && el.dataset.tr; if (!id) return;
  const i = id.indexOf(':'), cat = id.slice(0, i), k = id.slice(i + 1), n = clamp(Math.round(+el.value) || 0, 0, +el.max || 0);
  if (!TRD.bun[cat]) return; if (n > 0) TRD.bun[cat][k] = n; else delete TRD.bun[cat][k];
  for (const o of document.querySelectorAll('#panel [data-tr]')) if (o.dataset.tr === id && (o !== el || e.type === 'change')) o.value = n;
  const s = $('trBunSum'), g = $('trBunGo'); if (s) s.innerHTML = trBunSum(); if (g) g.disabled = !trBunClean();
}
document.addEventListener('input', trBunInput); document.addEventListener('change', trBunInput);
function trAskDesc(a) {
  if (a.t === 'i') { const it = P.bag.find(x => x.uid === a.uid); return it && { html: itemDetail(it, ''), txt: _t('„{name}“ verlässt deinen Beutel. Daraus wird ein Tauschcode, den genau eine Person einlösen kann.', { name: esc(itemName(it)) }) }; }
  if (a.t === 'b') { const b = trBunClean(); return b && { html: `<div class="detail"><div class="nm">${_t('BÜNDEL')}</div>${trChips(b)}</div>`, txt: _t('Diese Dinge verlassen deinen Vorrat. Daraus wird ein Tauschcode, den genau eine Person einlösen kann.') }; }
  const S = trPets(); if (!S) return null;
  if (a.t === 'p') { const p = Array.isArray(S.list) && S.list[a.i]; return p && { html: trDesc({ t: 'p', d: p }).html, txt: _t('{name} verlässt dich und wartet im Tauschcode auf ein neues Zuhause.', { name: esc(trPetName(p)) }) }; }
  if (a.t === 'e') { const e = Array.isArray(S.eggs) && S.eggs[a.i]; return e && { html: trDesc({ t: 'e', d: e }).html, txt: _t('Das Ei verlässt dein Nest. Beim neuen Besitzer beginnt das Ausbrüten von vorn.') }; }
  return null;
}
function trShowAsk() {
  const d = trAskDesc(TRD.ask); if (!d) { TRD.ask = null; return trShow(); }
  showOverlay(`<div class="center"><h2>${_t('WIRKLICH VERSCHENKEN?')}</h2></div>${d.html}<p class="sub">${d.txt}</p><div class="menu"><button class="btn" data-act="tr_send">${_t('Ja, Tauschcode erstellen')}</button><button class="btn alt" data-act="tr_cancel">${_t('Abbrechen')}</button></div>`);
}
function trShowCode() {
  const c = TRD.made, r = trParse(c);
  showOverlay(`<div class="head"><h2>${_t('TAUSCHCODE')}</h2><div class="hbtns"><button class="btn sm" data-act="tr_done">${_t('Fertig')}</button></div></div>${r.p ? trRow(r.p) : ''}
  <p class="sub">${_t('Schick den Link an deinen Freund – zum Beispiel per WhatsApp. Er öffnet ihn und nimmt das Geschenk an. Den Code findest du später auch im Verlauf.')}</p>
  <div class="menu two"><button class="btn" data-act="tr_share" data-id="${esc(c)}">${_t('Teilen')}</button><button class="btn alt" data-act="tr_copy" data-id="${esc(c)}">${_t('Link kopieren')}</button><button class="btn alt" data-act="tr_copy" data-id="${esc(c)}" data-i="1">${_t('Nur Code kopieren')}</button></div>
  <textarea id="trOut" class="tr-code" readonly rows="3">${esc(trLink(c))}</textarea>`);
}
function trRecvHTML() {
  const r = TRD.res;
  if (r && r.done) {
    const who = trHero() ? esc(P.name) : '';
    const where = r.p.t === 'i' ? _t('Liegt jetzt im Beutel von {name}.', { name: who }) : r.p.t === 'b' ? _t('Liegt jetzt im Vorrat von {name}.', { name: who }) : r.p.t === 'p' ? _t('Dein neuer Begleiter wartet bei deinen Begleitern.') : _t('Das Ei liegt in deinem Nest und schlüpft nach genug Kämpfen.');
    return `<div class="detail tr-ok"><div class="nm center" style="color:var(--moss)">${_t('ERHALTEN!')}</div>${trRow(r.p)}<p class="sub" style="margin-bottom:0">${_t('Ein Geschenk von {name}.', { name: esc(r.p.n) })} ${where}</p></div><div class="menu two"><button class="btn" data-act="tr_back">${_t('Fertig')}</button><button class="btn alt" data-act="tr_new">${_t('Weiteren Code einlösen')}</button></div>`;
  }
  if (TRD.pick) return trHeroPick(_t('Wer soll das Geschenk bekommen?'));
  // gültiger Code: zuerst das Geschenk zeigen (so steht „Annehmen“ nach dem Öffnen eines Links gleich oben)
  if (r && r.p) return trPreview(r.p, r.err);
  let h = `<p class="sub">${_t('Füge einen Tauschcode oder Tauschlink ein, den du bekommen hast. Jeder Code lässt sich nur einmal einlösen.')}</p>
  <textarea id="trIn" rows="3" placeholder="${_t('KH5-… oder Link hier einfügen')}">${esc(TRD.code)}</textarea>
  <div class="menu two" style="margin-top:8px"><button class="btn" data-act="tr_check">${_t('Code prüfen')}</button><button class="btn alt" data-act="tr_paste">${_t('Einfügen')}</button></div>`;
  if (r && r.err) h += `<p class="sub tr-bad">${trErr(r.err)}</p>`;
  return h;
}
// Vorschau links, Empfänger und „Annehmen“ rechts (Querformat) bzw. darunter (Hochformat)
function trPreview(p, err) {
  const d = trDesc(p), S = SAVE.meta.trades, used = S.got.includes(p.id) ? 'used' : S.own.includes(p.id) ? 'own' : null, hero = p.t === 'i' || p.t === 'b';
  const main = `<h3 style="margin-top:0">${_t('GESCHENK VON {name}', { name: esc(p.n.toLocaleUpperCase(LOCALE)) })}</h3>${d.html}${p.at ? `<p class="sub" style="margin:0;font-size:16px">${_t('Verschickt am {d}', { d: new Date(p.at * 1000).toLocaleDateString(LOCALE) })}</p>` : ''}`;
  let side = '';
  if (used) side = `<p class="sub tr-bad" style="margin-top:0">${trErr(used)}</p>`;
  else if ((p.t === 'p' && typeof petImport !== 'function') || (p.t === 'e' && typeof eggGive !== 'function')) side = `<p class="sub tr-bad" style="margin-top:0">${trErr('pets')}</p>`;
  else if (hero && !trHero()) side = trHeroPick(_t('Wer soll das Geschenk bekommen? Wähle einen Helden:'));
  else {
    if (err) side += `<p class="sub tr-bad" style="margin-top:0">${trErr(err)}</p>`;
    else if (p.t === 'i' && P.bag.length >= 30) side += `<p class="sub tr-bad" style="margin-top:0">${trErr('bag')}</p>`;
    if (hero) side += `<div class="row" style="cursor:default"><div class="ic">${heroHTML(P, .9)}</div><div><div class="nm">${_t('Für {name}', { name: esc(P.name) })}</div><div class="st">${CLASSES[P.cls].name} · ${_t('LV {lv}', { lv: P.lv })}</div></div>${SAVE.chars.length > 1 && TRD.from === 'title' ? `<button class="btn alt sm" data-act="tr_pick">${_t('Wechseln')}</button>` : '<span></span>'}</div>`;
    side += `<div class="menu" style="margin:6px 0"><button class="btn" data-act="tr_take">${_t('Annehmen')}</button></div>`;
  }
  side += `<div class="menu" style="margin:0"><button class="btn alt" data-act="tr_new">${_t('Anderen Code einlösen')}</button></div>`;
  return `<div class="split"><div>${main}</div><div class="side">${side}</div></div>`;
}
// kompakte Zeile: Symbol, Name, Kurzinfo
function trRow(p, right) {
  const d = trDesc(p), st = p.t === 'i' ? RAR[p.d.rar].n + ' ' + (p.d.slot === 'weapon' ? WT[p.d.base].label : AR[p.d.slot].label) + ' · ' + MAT[p.d.tier].n : p.t === 'b' ? _t('Bündel') : p.t === 'p' ? trSpName(p.d.sp) : _t('Ei');
  return `<div class="row" style="cursor:default"><div class="ic"><img src="${d.ic}" alt=""></div><div><div class="nm" style="color:${d.c}">${esc(d.n)}</div><div class="st">${esc(st)}</div></div>${right || '<span></span>'}</div>`;
}
function trDealHTML() {
  const D = trDeals(), S = trDealState(), now = new Date(), ms = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
  const rows = D.map((o, i) => { const done = S.done.includes(i), can = !done && trCan(o.give); return `<div class="row" style="cursor:default${done ? ';opacity:.55' : ''}"><div class="ic"><img src="${trSpecIcon(o.get)}" alt=""></div><div><div class="nm" style="color:var(--gold)">${esc(trSpecText(o.get))}</div><div class="st">${_t('Du gibst dafür:')}</div>${trChips(o.give, !done)}</div><button class="btn sm" data-act="tr_deal" data-i="${i}" ${can ? '' : 'disabled'}>${done ? _t('Getauscht') : _t('Tauschen')}</button></div>`; }).join('');
  return `<div class="say"><img class="px" src="${iconURL(['sp', 'lizardf'])}" alt=""><div><b style="color:#79c24e">${_t('Ssira die Tauschhändlerin')}</b>${_t('„Drei Angebote, nur heute. Morgen bringe ich andere Ware mit.“')}</div></div>${rows}<p class="sub">${_t('Jedes Angebot einmal am Tag. Neue Angebote in {h} Std. {m} Min.', { h: Math.floor(ms / 3600000), m: Math.floor(ms / 60000) % 60 })}</p>`;
}
function trLogHTML() {
  const L = SAVE.meta.trades.log;
  const rows = L.map((e, i) => { const p = trParse(e.c).p; if (!p) return ''; const d = trDesc(p); return `<div class="row" style="cursor:default"><div class="ic"><img src="${d.ic}" alt=""></div><div><div class="nm" style="color:${d.c}">${esc(d.n)}</div><div class="st">${e.r ? _t('Erhalten von {name}', { name: esc(p.n) }) : _t('Verschickt')} · ${new Date(e.at).toLocaleDateString(LOCALE)}</div></div>${e.r ? '<span></span>' : `<button class="btn alt sm" data-act="tr_show" data-i="${i}">${_t('Code')}</button>`}</div>`; }).join('');
  return rows || `<p class="sub">${_t('Noch keine Tauschgeschäfte. Verschenke etwas oder löse einen Code ein.')}</p>`;
}
function trCopy(s, b) {
  const done = () => { b.textContent = _t('Kopiert'); }, fall = () => { const t = $('trOut'); if (t) { t.value = s; t.select(); try { document.execCommand('copy'); } catch (_) { } done(); } else prompt(_t('Link kopieren:'), s); };
  try { navigator.clipboard.writeText(s).then(done, fall); } catch (_) { fall(); }
}

ON.tr_open = id => { const [tab, from] = String(id || 'recv|title').split('|'); if (tab === 'recv' && (!TRD.pend || (TRD.res && TRD.res.done))) { TRD.res = null; TRD.code = ''; } trOpen(tab, from); };
ON.tr_back = () => trBack();
ON.tr_tab = id => { TRD.tab = id; TRD.pick = false; if (id === 'recv') TRD.pend = false; trShow(); };
ON.tr_mode = id => { TRD.mode = id; trShow(); };
ON.tr_isel = id => { TRD.sel = id || null; sfx('click'); trShow(); };
ON.tr_bunclr = () => { TRD.bun = { m: {}, g: {}, p: {} }; trShow(); };
ON.tr_ask = (id, b, i) => {
  const s = String(id || ''), k = s.indexOf(':'), t = k < 0 ? s : s.slice(0, k), v = k < 0 ? '' : s.slice(k + 1);
  if (i === 1) { TRD.from = 'char'; TRD.tab = 'send'; TRD.mode = 'item'; }
  TRD.ask = t === 'i' ? { t, uid: v } : t === 'b' ? { t } : { t, i: +v };
  sfx('click'); trShow();
};
ON.tr_cancel = () => { TRD.ask = null; if (TRD.from === 'char') trBack(); else trShow(); };
ON.tr_send = () => {
  const a = TRD.ask, code = trSend(a); TRD.ask = null;
  if (!code) { toast(_t('Das hat nicht geklappt.'), '#ff6a5a'); sfx('deny'); trShow(); return; }
  if (a.t === 'b') TRD.bun = { m: {}, g: {}, p: {} }; else TRD.sel = null;
  TRD.made = code; sfx('chest'); trShow();
};
ON.tr_done = () => { TRD.made = null; if (TRD.from === 'char') trBack(); else trShow(); };
ON.tr_show = (id, b, i) => { const e = SAVE.meta.trades.log[i]; if (e) { TRD.made = e.c; trShow(); } };
ON.tr_share = (code, b) => {
  const url = trLink(code), text = _t('Ich schicke dir etwas in Klingenhort! Öffne den Link, um es anzunehmen:');
  if (navigator.share) navigator.share({ title: 'Klingenhort', text, url }).then(() => { b.textContent = _t('Geteilt'); }, e => { if (!e || e.name !== 'AbortError') trCopy(url, b); });
  else trCopy(url, b);
};
ON.tr_copy = (code, b, i) => trCopy(i === 1 ? code : trLink(code), b);
ON.tr_check = () => { const t = $('trIn'); if (t) TRD.code = t.value; TRD.res = trParse(TRD.code); sfx(TRD.res.p ? 'click' : 'deny'); trShow(); };
ON.tr_paste = () => { try { navigator.clipboard.readText().then(t => { TRD.code = t; TRD.res = trParse(t); trShow(); }, () => toast(_t('Einfügen ging nicht – tippe lange ins Feld und wähle „Einfügen“.'))); } catch (_) { toast(_t('Einfügen ging nicht – tippe lange ins Feld und wähle „Einfügen“.')); } };
ON.tr_take = () => {
  const p = TRD.res && TRD.res.p; if (!p) return;
  const r = trAccept(p);
  if (r === 'ok') { TRD.res = { done: true, p }; sfx('loot'); checkAch(); } else { TRD.res = { p, err: r }; sfx('deny'); }
  trShow();
};
ON.tr_new = () => { TRD.code = ''; TRD.res = null; trShow(); };
ON.tr_pick = () => { TRD.pick = true; trShow(); };
ON.tr_hero = (id, b, i) => {
  if (!SAVE.chars[i]) return;
  if (!(trHero() && SAVE.active === i)) { if (trHero()) saveChar(); activateChar(i); if (state === 'title') titleScene(); persist(); TRD.bun = { m: {}, g: {}, p: {} }; TRD.sel = null; }
  TRD.pick = false; sfx('click'); trShow();
};
ON.tr_deal = (id, b, i) => { trDealDo(i); trShow(); };

HOOK.titleBtns.push(() => `<button class="btn${TRD.pend ? '' : ' alt'}" data-act="tr_open" data-id="recv|title">${TRD.pend ? _t('Tauschcode öffnen') : _t('Tausch empfangen')}</button>`);
HOOK.mapMore.push(() => `<button class="btn alt" data-act="tr_open" data-id="send|map">${_t('Tauschen')}</button>`);
HOOK.itemActions.push(it => P && P.bag.includes(it) ? `<button class="btn alt sm" data-act="tr_ask" data-id="i:${it.uid}" data-i="1">${_t('Verschenken')}</button>` : '');

/* ---------- Aussehen der Ausrüstung (Transmog) ----------
   Sammlung: w.<basis>.<form>.<stufe> · a.<stufe> · h.<stufe> · h.krone (legendärer Helm) · h.schein (mythischer Helm) */
let TM_KEYS = null, tmNewT = -9, tmSlot = 'weapon';
const TM_RW = [[10, 1], [25, 1], [50, 2], [80, 2], [120, 3], [160, 3], [200, 4], [9999, 6]];
function tmAll() {
  if (TM_KEYS) return TM_KEYS; const r = [];
  for (const b in WFORM) for (const F of WFORM[b]) for (let t = 0; t < TIERS; t++) r.push('w.' + b + '.' + F.id + '.' + t);
  for (let t = 0; t < TIERS; t++) r.push('a.' + t); for (let t = 0; t < TIERS; t++) r.push('h.' + t); r.push('h.krone', 'h.schein');
  return TM_KEYS = r;
}
function tmKeys(it) {
  if (!trObj(it) || !trInt(it.tier, 0, TIERS - 1)) return [];
  if (it.slot === 'weapon') return WFORM[it.base] ? ['w.' + it.base + '.' + wform(it).id + '.' + it.tier] : [];
  if (it.slot === 'armor') return ['a.' + it.tier];
  if (it.slot === 'helm') { const r = ['h.' + it.tier]; if (it.rar === 4) r.push('h.krone'); if (it.rar === 6) r.push('h.schein'); return r; }
  return [];
}
function tmAdd(it, show) {
  const L = SAVE && SAVE.meta && SAVE.meta.looks; if (!L) return 0;
  let n = 0; for (const k of tmKeys(it)) if (!L[k]) { L[k] = 1; n++; }
  if (n && show && state === 'play' && P && T - tmNewT > 1.5) { tmNewT = T; txt(P.x, P.y - 40, _t('NEUES AUSSEHEN'), '#d0b0ff'); }
  return n;
}
function tmCount(pre) { const L = SAVE.meta.looks; let n = 0; for (const k of tmAll()) if (L[k] && (!pre || k[0] === pre)) n++; return n; }
function tmMax(pre) { return tmAll().filter(k => k[0] === pre).length; }
/* Aussehen eines Gegenstands zum Zeichnen: Stufe/Form aus it.skin, Werte und Seltenheit bleiben (Helm: Kopfschmuck nach Aussehen) */
const TM_VIS = new WeakMap();
function visItem(it) {
  const s = it && it.skin; if (!s || typeof s !== 'object') return it;
  const c = TM_VIS.get(it);
  if (c && c.s === s && c.t === it.tier && c.r === it.rar && c.f === it.form && c.u === it.up && c.m === it.myth && c.st === s.tier && c.sf === s.form) return c.v;
  const v = Object.assign({}, it); delete v.skin;
  if (trInt(s.tier, 0, TIERS - 1)) v.tier = s.tier;
  if (it.slot === 'weapon') { if (WFORM[it.base] && WFORM[it.base].some(f => f.id === s.form)) v.form = s.form; }
  else if (it.slot === 'helm') v.rar = s.form === 'schein' ? 6 : s.form === 'krone' ? 4 : Math.min(it.rar, 3);
  TM_VIS.set(it, { s, t: it.tier, r: it.rar, f: it.form, u: it.up, m: it.myth, st: s.tier, sf: s.form, v });
  return v;
}
function tmSig(x) { return x.slot === 'weapon' ? wform(x).id + x.tier : x.slot === 'helm' ? x.tier + '|' + headgearOf(x) : '' + x.tier; }
function tmSkinFor(it, key) {
  const p = String(key).split('.');
  if (it.slot === 'weapon' && p[0] === 'w' && p[1] === it.base && WFORM[it.base].some(f => f.id === p[2]) && trInt(+p[3], 0, TIERS - 1)) return { tier: +p[3], form: p[2] };
  if (it.slot === 'armor' && p[0] === 'a' && trInt(+p[1], 0, TIERS - 1)) return { tier: +p[1] };
  if (it.slot === 'helm' && p[0] === 'h') { if (p[1] === 'krone' || p[1] === 'schein') return { form: p[1] }; if (trInt(+p[1], 0, TIERS - 1)) return { tier: +p[1] }; }
  return null;
}
// Schlüssel des Aussehens, das der Gegenstand gerade zeigt (null = Original)
function tmCur(it) {
  if (!it || !it.skin) return null; const v = visItem(it);
  if (it.slot === 'weapon') return 'w.' + it.base + '.' + wform(v).id + '.' + v.tier;
  if (it.slot === 'armor') return 'a.' + v.tier;
  return it.skin.form === 'krone' || it.skin.form === 'schein' ? 'h.' + it.skin.form : 'h.' + v.tier;
}
function tmApply(slot, key) {
  const it = P.gear[slot]; if (!it) return false;
  if (key === 'orig') delete it.skin;
  else {
    const s = SAVE.meta.looks[key] && tmSkinFor(it, key); if (!s) return false;
    it.skin = s; if (tmSig(visItem(it)) === tmSig(Object.assign({}, it, { skin: null }))) delete it.skin;
  }
  saveChar(); return true;
}
function tmName(key) {
  const p = String(key).split('.'), C = CLASSES[P.cls];
  if (p[0] === 'w') { const F = (WFORM[p[1]] || []).find(f => f.id === p[2]); return _t('{mat}-{form}', { mat: MAT[+p[3]].n, form: F ? F.n : p[2] }); }
  if (p[1] === 'krone') return _t('Krone'); if (p[1] === 'schein') return _t('Heiligenschein');
  return C.names[+p[1]][p[0] === 'a' ? 0 : 1];
}
const TM_ICON = {};
function tmIcon(key) {
  const k = key + (key[0] === 'w' ? '' : P.cls); if (TM_ICON[k]) return TM_ICON[k];
  const p = key.split('.');
  if (p[1] === 'krone') return TM_ICON[k] = trArt('crown'); if (p[1] === 'schein') return TM_ICON[k] = trArt('halo');
  const it = p[0] === 'w' ? { slot: 'weapon', base: p[1], form: p[2], tier: +p[3], rar: 0, aff: {}, gems: [] } : { slot: p[0] === 'a' ? 'armor' : 'helm', base: p[0] === 'a' ? 'armor' : 'helm', tier: +p[1], rar: 0, aff: {}, gems: [] };
  const s = it.slot === 'weapon' ? weaponArt(it).c : armorArt(it, P.cls), sz = Math.max(s.width, s.height) + 2;
  return TM_ICON[k] = mk(sz, sz, g => g.drawImage(s, Math.floor((sz - s.width) / 2), Math.floor((sz - s.height) / 2))).toDataURL();
}
function tmIconOf(it) { const k = tmCur(it); return k && k[0] === 'h' && (k === 'h.krone' || k === 'h.schein') ? tmIcon(k) : itemIconURL(visItem(it)); }
function tmBar() {
  const n = tmCount(), max = tmAll().length;
  return `<div class="tm-bar"><i style="width:${Math.round(n / max * 100)}%"></i><span>${_t('SAMMLUNG {n}/{max}', { n, max })}</span></div><p class="sub" style="margin:2px 0 8px;font-size:16px">${_t('Waffen {w}/{wm} · Rüstungen {a}/{am} · Helme {h}/{hm}', { w: tmCount('w'), wm: tmMax('w'), a: tmCount('a'), am: tmMax('a'), h: tmCount('h'), hm: tmMax('h') })}</p>`;
}
// nächstes Sammelziel mit Belohnung (Glücksmünzen für den aktiven Helden)
function tmGoal() {
  const i = SAVE.meta.lookRw, M = TM_RW[i]; if (!M) return '';
  const need = Math.min(M[0], tmAll().length), n = tmCount(), ok = n >= need;
  const coins = M[1] === 1 ? _t('1 Glücksmünze') : _t('{n} Glücksmünzen', { n: M[1] });
  return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['pa', 'muenze'])}" alt=""></div><div><div class="nm" style="color:var(--gold)">${_t('SAMMLERLOHN')}</div><div class="st">${ok ? _t('Geschafft: {n} Looks! Hol dir {coins}.', { n: need, coins }) : _t('Bei {n} Looks: {coins} – noch {k}.', { n: need, coins, k: need - n })}</div><div class="tm-bar" style="height:8px"><i style="width:${Math.min(100, Math.round(n / need * 100))}%"></i></div></div><button class="btn sm" data-act="tm_rw" ${ok ? '' : 'disabled'}>${_t('Abholen')}</button></div>`;
}
const TM_SL = () => ({ weapon: _t('Waffe'), armor: AR.armor.label, helm: AR.helm.label });
HOOK.mirror.push(() => {
  if (!trHero()) return '';
  const SL = TM_SL(), rows = ['weapon', 'armor', 'helm'].map(s => { const it = P.gear[s]; if (!it) return ''; return `<div class="row" style="cursor:default"><div class="ic"><img src="${tmIconOf(it)}" alt=""></div><div><div class="nm">${SL[s]}</div><div class="st">${it.skin ? _t('Aussehen: {name}', { name: esc(tmName(tmCur(it))) }) : _t('Original: {name}', { name: esc(itemName(it)) })}</div></div><button class="btn sm" data-act="tm_open" data-id="${s}">${_t('Ändern')}</button></div>`; }).join('');
  return `<h3>${_t('AUSSEHEN DER AUSRÜSTUNG')}</h3>${tmBar()}${rows}${tmGoal()}<p class="sub">${_t('Jede Waffe, Rüstung und jeder Helm, den du besitzt, kommt in die Sammlung – auch geschmiedet oder getauscht. Die Werte bleiben immer die des echten Gegenstands.')}</p>`;
});
HOOK.itemLines.push((it, L) => { if (it.skin && P) { const k = tmCur(it); if (k) L.push(_t('Aussehen: {name}', { name: tmName(k) })); } });
function tmShow() {
  if (!trHero()) { openMirror(); return; }
  if (!P.gear[tmSlot]) tmSlot = 'weapon';
  const it = P.gear[tmSlot], L = SAVE.meta.looks, cur = tmCur(it), SL = TM_SL();
  const tab_ = s => `<button class="tab" role="tab" aria-selected="${tmSlot === s}" data-act="tm_slot" data-id="${s}">${SL[s].toLocaleUpperCase(LOCALE)}</button>`;
  const cell = k => { const own = !!L[k]; return `<button class="slot${own ? '' : ' lock'}${cur === k ? ' sel' : ''}" data-act="${own ? 'tm_set' : 'tm_need'}" data-id="${k}" aria-label="${esc(tmName(k))}"><img src="${tmIcon(k)}" alt=""></button>`; };
  let body = '';
  if (tmSlot === 'weapon') body = WFORM[it.base].map(F => { const ks = MAT.map((_, t) => 'w.' + it.base + '.' + F.id + '.' + t), n = ks.filter(k => L[k]).length; return `<h3>${esc(F.n.toLocaleUpperCase(LOCALE))} <span class="tm-n">${n}/${ks.length}</span></h3><div class="grid tm-g">${ks.map(cell).join('')}</div>`; }).join('');
  else { const p = tmSlot === 'armor' ? 'a' : 'h', ks = MAT.map((_, t) => p + '.' + t).concat(p === 'h' ? ['h.krone', 'h.schein'] : []); body = `<h3>${_t('STUFEN')} <span class="tm-n">${ks.filter(k => L[k]).length}/${ks.length}</span></h3><div class="grid tm-g">${ks.map(cell).join('')}</div>`; }
  showOverlay(`<div class="head"><h2>${_t('AUSSEHEN')}</h2><div class="hbtns"><button class="btn alt sm" data-act="tm_back">${_t('Zurück')}</button></div></div>
  <div class="tabs" role="tablist">${['weapon', 'armor', 'helm'].map(tab_).join('')}</div>
  <div class="tm-top"><div class="tm-prev">${heroHTML(P, 2.4)}<img src="${tmIconOf(it)}" alt=""></div><div><div class="nm" style="font-size:20px;color:${cur ? '#d0b0ff' : 'var(--parch)'}">${esc(cur ? tmName(cur) : _t('Original'))}</div><div class="st" style="font-size:16px;color:var(--parch-dim)">${_t('Gegenstand: {name}', { name: esc(itemName(it)) })}</div><div class="st" style="font-size:16px;color:var(--parch-dim)">${_t('Nur das Aussehen ändert sich, die Werte bleiben. Kostenlos.')}</div><div class="acts"><button class="btn alt sm" data-act="tm_set" data-id="orig" ${cur ? '' : 'disabled'}>${_t('Original zeigen')}</button></div></div></div>
  ${tmBar()}${body}<p class="sub">${_t('Dunkle Felder fehlen noch: Finde, schmiede oder tausche so einen Gegenstand, dann gehört das Aussehen dir – für alle Helden.')}</p>`, true);
}
ON.tm_open = id => { tmSlot = id || 'weapon'; sfx('click'); tmShow(); };
ON.tm_slot = id => { tmSlot = id; tmShow(); };
ON.tm_set = id => { if (tmApply(tmSlot, id)) sfx('click'); else sfx('deny'); tmShow(); };
ON.tm_need = id => { sfx('deny'); toast(_t('Noch nicht gesammelt: {name}', { name: tmName(id) })); };
ON.tm_back = () => openMirror();
ON.tm_rw = () => {
  const M = TM_RW[SAVE.meta.lookRw]; if (!M || !trHero() || tmCount() < Math.min(M[0], tmAll().length)) return;
  SAVE.meta.lookRw++; gainFate(M[1], true); saveChar(); openMirror();
};

/* Waffe für Heldenbilder (Titel, Karte, Spiegel, Charakter): aufrecht seitlich hinter dem Körper, passt ins Bild.
   Wird vor dem Körper gezeichnet (heroPreviewURL in ui.js) */
function drawHeldWeapon(g, it, fx, FW, FH, body) {
  if (!it || !it.base || !WT[it.base]) return;
  const spr = weaponArt(it), c = spr.c, sp = BODIES[body] ? BODIES[body].sp : 'knight', hd = (typeof HAND !== 'undefined' && HAND[sp]) || [4, -9];
  // Bogen: Mitte in der Hand, sonst Griff in der Hand, Spitze nach oben; kleine Dolche etwas weiter nach außen
  let x = fx + Math.round(FW / 2) + hd[0] + (it.base === 'dagger' ? 4 : 2) - spr.ox, y = FH - 1 + hd[1] - spr.oy;
  y = clamp(y, 0, FH - c.height); x = clamp(x, fx, fx + FW - c.width);
  g.save(); g.beginPath(); g.rect(fx, 0, FW, FH); g.clip(); g.drawImage(c, x, y); g.restore();
}
