'use strict';
/* =========================================================
   KLINGENHORT – Basar – kaufen, verkaufen, versteigern (offline simuliert, später online)
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein.
   Marktwert für alle Systeme: itemValue(it), lootValue(eintrag) → fairer Preis in Gold.
   Ware = Beute-Eintrag: { t: 'item', it } | { t: 'mat', k, n } | { t: 'gem', k, n } | { t: 'part', k, n } | { t: 'mod', k, n } (js/mods.js) | { t: 'egg', d } | { t: 'gold', n }
   Schnittstelle MARKET – heute eine lokale Simulation, später ersetzt ein Server dieselben Methoden:
     now() · tick(now) → Ereignisse · listings('shop'|'auc'|'own'|'box') · buy(id) · sell(eintrag) · quote(eintrag)
     auction(eintrag, start, sofortkauf, stunden) · bid(id, gebot) · buyout(id) · cancel(id) · claim(i|'all') · history(eintrag) · estimate(…)
     Antworten { ok: 1, … } oder { err: 'gold' | 'full' | 'nest' | 'gone' | 'over' | 'lead' | 'low' | 'slots' | … }.
     Lesen ist synchron (Server: zwischengespeicherter Stand), Schreiben darf später ein Promise liefern (mkRun).
     Gold, Beutel, Lager und Vorrat des Helden fasst nur MK_HERO an.
   Konto: SAVE.meta.market = { v, seed, rs, clk, init, shop: { heldId: { nx, list } }, auc, own, spawn, box, log, hist, vol, sold, bought, best, unseen, rk }
   Uhr: clk läuft nur vorwärts – wird die Geräte-Uhr zurückgestellt, wartet der Basar, bis sie wieder aufholt.
   Versteigerungen laufen in echter Zeit weiter, auch bei geschlossenem Spiel (Nachrechnen aus Zeitstempeln).
   ========================================================= */

/* ---------- Daten ---------- */
const MK_H = 3600000, MK_MIN = 60000, MK_BAG = 30, MK_DUR = [1, 4, 12, 24];
const MK_RV = [.5, .9, 1.6, 3, 6.5, 5.5, 16];   // Seltenheit: Gewöhnlich … Mythisch
const MK_AFW = { krit: 1.2, tempo: 1.1, raub: 1, feuer: .9, frost: .9, wucht: 1.3 }, MK_AFA = { leben: 1.2, panzer: 1, heil: .8, schutz: 1.3, eile: .9, glueck: 1 };
const MK_MYW = { klinge: 1.25, zorn: 1.15, ernter: 1.1, phoenix: 1.3, dornen: 1.05, krone: 1.2, eisherz: 1, midas: 1.25 };
// Gold je Stück – so gewählt, dass Veredeln, Kombinieren und der Händler auf der Karte keinen Gewinn im Kreis ergeben
const MK_MATV = { erz: 8, leder: 8, knochen: 14, schleim: 12, zahn: 22, kristall: 80, horn: 100, glut: 140, mithril: 120, adamant: 200, schuppe: 380, stern: 520, aether: 1100, holz: 4, stein: 4, faser: 4, samen: 6, feder: 12, eisenholz: 45, marmor: 45, obsidian: 130, sternholz: 320 };
const MK_GEMV = [60, 200, 680, 2200, 6900], MK_GEMF = { rubin: 1.1, saphir: .95, smaragd: 1.05, amethyst: 1, topas: .9 };
const MK_BAND = [['erz', 'leder', 'knochen', 'schleim', 'zahn', 'holz', 'stein', 'faser', 'feder'], ['kristall', 'horn', 'glut', 'mithril', 'eisenholz', 'marmor'], ['adamant', 'schuppe', 'stern', 'aether', 'obsidian', 'sternholz']];
// Bieter: Name und Art (0 früh, 1 stetig, 2 Last-Minute, 3 Sammler, 4 Schnäppchenjäger) – jeder bleibt sich treu
const MK_NAMES = [['Kaspar', 2], ['Ysolde', 0], ['Grimbart', 3], ['Mirela', 1], ['Thorvald', 1], ['Hagen', 4], ['Lirien', 0], ['Ansgar', 1], ['Fenna', 2], ['Ulrich', 4], ['Zarah', 3], ['Oswin', 1], ['Rika', 0], ['Tobias', 4], ['Gundula', 1], ['Sigrun', 2], ['Alarich', 3], ['Notburga', 4], ['Wendelin', 1], ['Ilvy', 0], ['Elric', 2], ['Brann', 1], ['Odalys', 3], ['Merek', 4], ['Saskia', 0], ['Joris', 1], ['Tilda', 4], ['Rurik', 2], ['Esme', 1], ['Falk', 0], ['Wanda', 3], ['Bertolt', 4]];
const MK_TYPE = [_t('Frühbieter'), _t('Stetig'), _t('Last-Minute'), _t('Sammler'), _t('Schnäppchenjäger')];
// Handelsrang nach Umsatz: weniger Gebühr, mehr eigene Auktionsplätze, bessere Ware
const MK_RANK = [[0, _t('Krämer')], [2000, _t('Händler')], [6000, _t('Kaufmann')], [18000, _t('Großhändler')], [50000, _t('Handelsherr')], [140000, _t('Gildenmeister')], [400000, _t('Magnat')], [1100000, _t('Basarfürst')], [3000000, _t('Goldkönig')], [8000000, _t('Legende des Basars')]];
const MK_FEE = [.1, .095, .09, .085, .08, .075, .07, .065, .06, .05], MK_SLOT = [3, 3, 4, 4, 5, 5, 6, 6, 7, 8];
const MK_ADUR = [[.5, 1], [1, 2], [2, 2], [4, 3], [8, 2], [12, 2], [24, 1]];   // Dauer der Händler-Auktionen (Std., Gewicht)
let MK_REV = 0;   // zählt jede Änderung am Markt (neu zeichnen)

// Versteck: Figur an der Station und ihre Sprüche
if (typeof BUILD !== 'undefined' && BUILD.basar) { BUILD.basar.npc = _t('Auktionatorin Hedda'); BUILD.basar.body = 'dwarff'; }
SPEAKERS.hedda = { n: _t('Auktionatorin Hedda'), sp: 'dwarff', c: '#ffb03a' };
NPCTALK.basar = [
  [1, 'hedda', _t('Alles hat seinen Preis, {name}. Die Kunst ist, ihn vor den anderen zu kennen.')],
  [1, 'hedda', _t('Kaspar bietet immer in der letzten Minute. Halt die Augen offen.')],
  [1, 'hedda', _t('Wer versteigert, braucht Geduld. Wer bietet, braucht Nerven.')],
  [2, 'hedda', _t('Ein Legendärer unter Marktwert? Kommt vor. Selten. Aber es kommt vor.')],
  [3, 'hedda', _t('Grimbart sammelt alles, was glänzt – und zahlt dafür fast jeden Preis.')],
  [5, 'hedda', _t('Mein Hammer fällt, wenn die Zeit um ist. Keine Sekunde früher.')]
];

document.head.insertAdjacentHTML('beforeend', '<style>.mk .row.mk-r{cursor:pointer}.mk .row.mk-dim{opacity:.5}.mk-p{display:grid;justify-items:end;gap:3px;text-align:right}.mk-p small{font-size:15px;color:var(--parch-dim);line-height:1}.mk .btn,.mk .opt,.mk .tab,.mk-box,body .mk .btn.sm{min-height:44px}.mk-p .btn{min-width:76px}.mk-cd{font-family:var(--f-display);font-size:8px;white-space:nowrap}.mk-soon{color:#ff9a3a}.mk-last{color:#ff5a4a;animation:mkblink 1s steps(2) infinite}@keyframes mkblink{50%{opacity:.35}}@keyframes mknew{0%,40%{box-shadow:inset 0 0 0 3px var(--gold);background:#3a3020}100%{box-shadow:none}}.mk .row.mk-new{animation:mknew 1.6s steps(8)}.mk-pill{display:inline-block;font-family:var(--f-display);font-size:6px;line-height:1.4;padding:3px 5px;white-space:nowrap;background:var(--stone-hi);color:var(--parch)}.mk-pill.lead{background:var(--moss);color:var(--night)}.mk-pill.out{background:var(--blood)}.mk-pill.ext,.mk-pill.deal{background:var(--gold);color:var(--night)}.mk-box{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;border:0;background:var(--stone-lo);box-shadow:inset 0 0 0 2px var(--gold);color:var(--parch);padding:6px 10px;margin:0 0 10px;font:18px var(--f-body);cursor:pointer;text-align:left;animation:pulse2 1.2s steps(2) infinite}.mk-box img{width:28px;height:28px;image-rendering:pixelated}.mk-box b{font-family:var(--f-display);font-size:8px;font-weight:400;color:var(--gold);display:block;margin-bottom:2px}.mk-act{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 6px}.mk-act .btn{flex:1 1 auto}@media (max-width:599px){.mk .side.sheet>.sheetx+*{margin-right:48px}}.mk-amt{display:grid;grid-template-columns:44px 44px minmax(0,1fr) 44px 44px;gap:6px;align-items:center;margin:6px 0 8px}.mk-amt .btn{padding:6px 0}.mk-amt b{text-align:center;font-family:var(--f-display);font-size:10px;font-weight:400;line-height:1.5}.mk-amt b small{display:block;font-family:var(--f-body);font-size:15px;color:var(--parch-dim)}.mk-bars{position:relative;display:flex;align-items:flex-end;gap:3px;height:40px;background:var(--night);padding:4px;box-shadow:inset 0 0 0 2px var(--stone-hi)}.mk-bars i{flex:1;background:var(--gold-dk);min-height:2px}.mk-bars i.last{background:var(--gold)}.mk-bars u{position:absolute;left:4px;right:4px;border-top:2px dashed var(--moss);text-decoration:none}.mk-cap{font-family:var(--f-display);font-size:6px;line-height:1.7;color:var(--parch-dim);margin:4px 0 8px}.mk-big{font-family:var(--f-display);font-size:15px;margin:0 0 6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.mk-now{font-size:19px;margin:0 0 6px}.mk-good{color:var(--moss);font-size:18px;margin:4px 0 8px}.mk-bad{color:var(--blood)}.mk-log{font-size:16px;color:var(--parch-dim);margin:0 0 4px;line-height:1.1}.mk-log b{color:var(--parch);font-weight:400}.mk-sold{font-family:var(--f-display);font-size:7px;color:var(--parch-dim)}.mk-l{margin-top:0}.mk .tab[data-b]::after{content:attr(data-b);display:inline-block;font-size:7px;background:var(--blood);color:var(--parch);padding:3px 4px;margin-left:6px;vertical-align:1px;animation:pulse2 .8s steps(2) infinite}.mk .tab.mk-gb[data-b]::after{background:var(--gold-dk)}.mk .opts.mk-g{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr))}.mk .opts.mk-g .opt{min-width:0;padding:9px 2px}.mk .opts.mk-g .opt small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mk-est{font-size:18px}.mk-est b{color:var(--gold);font-weight:400}.mk-bidbox{background:var(--stone-lo);padding:8px 10px;margin:0 0 8px;box-shadow:inset 0 0 0 2px var(--gold-dk)}.mk-hist{margin:0 0 8px}.mk-hist div{display:flex;justify-content:space-between;gap:8px;font-size:17px;padding:2px 0;border-bottom:1px solid var(--stone-hi)}.mk-hist .me{color:var(--moss)}.mk-zu{font-family:var(--f-display);font-size:12px;color:var(--gold);text-align:center;padding:10px;margin:0 0 8px;background:var(--night);box-shadow:inset 0 0 0 3px var(--gold);animation:pulse2 .6s steps(2) 4}</style>');

/* ---------- kleine Helfer ---------- */
const mkO = o => !!o && typeof o === 'object' && !Array.isArray(o);
const mkHas = (o, k) => mkO(o) && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const mkI = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const mkN = (v, a, b, d) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, a, b) : d;
const mkG = n => Math.round(+n || 0).toLocaleString(LOCALE);
const mkStep = v => v < 100 ? 1 : v < 1000 ? 5 : v < 10000 ? 10 : v < 100000 ? 50 : 100;
function mkR(v) { v = +v || 0; if (v <= 0) return 0; const s = mkStep(v); return Math.max(1, Math.round(v / s) * s); }   // runder Marktwert
function mkNice(v) { v = Math.max(1, Math.ceil(+v || 1)); const s = mkStep(v); return Math.ceil(v / s) * s; }       // rundes Gebot (aufgerundet)
const mkPct = f => (f * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 });
const mkM = () => SAVE && SAVE.meta && mkO(SAVE.meta.market) ? SAVE.meta.market : null;
const mkClone = e => JSON.parse(JSON.stringify(e));
// Antwort sofort oder später (Server): beides geht
function mkRun(r, fn) { return r && typeof r.then === 'function' ? r.then(fn) : fn(r); }

/* ---------- Marktwert ---------- */
function mkPartOk(k) {
  if (typeof k !== 'string' || k.length > 30) return false;
  if (typeof pvalid === 'function') { try { return !!pvalid(k); } catch (_) { return false; } }
  return /^[a-z]{2,12}(:[a-z]{2,12})?:(10|[1-9])$/.test(k);
}
const mkModOk = k => typeof modValid === 'function' && typeof k === 'string' && modValid(k);
const mkModV = k => mkModOk(k) ? modValue(k) : 0;
function mkPartV(k) { const a = String(k).split(':'), g = clamp(Math.floor(+a[a.length - 1]) || 1, 1, 10); return 35 * Math.pow(2.9, g - 1) * (a.length > 2 ? 1.1 : 1); }
function mkGemV(k) { const a = String(k).split(':'), gr = +a[1]; return mkHas(GEMS, a[0]) && mkI(gr, 0, 4) && a.length === 2 ? MK_GEMV[gr] * (MK_GEMF[a[0]] || 1) : 0; }
const mkSpOk = sp => typeof sp === 'string' && /^[a-z0-9_]{2,24}$/i.test(sp) && !['__proto__', 'constructor', 'prototype'].includes(sp);
// Seltenheitsstufe eines Eis: aus dem Begleiter-System (pets.js), sonst die alten Arten selten/episch
function mkEggTier(d) {
  const sp = mkO(d) ? d.sp : null, S = typeof PET_SP !== 'undefined' && mkHas(PET_SP, sp) ? PET_SP[sp] : null;
  const n = typeof PET_TIERS !== 'undefined' && Array.isArray(PET_TIERS) && PET_TIERS.length > 1 ? PET_TIERS.length : 6;
  let t = null;
  try { if (typeof petTier === 'function') t = petTier(sp); } catch (_) { t = null; }
  if (!Number.isInteger(t) && S) for (const k of ['tier', 't', 'rar', 'r']) if (Number.isInteger(S[k])) { t = S[k]; break; }
  if (!Number.isInteger(t)) t = sp === 'drache' || sp === 'funke' ? 3 : 2;
  return { t: clamp(t, 0, n - 1), n };
}
function mkTierInfo(t) {
  const X = typeof PET_TIERS !== 'undefined' && PET_TIERS ? PET_TIERS[t] : null;
  if (typeof X === 'string') return { n: X, c: '' };
  if (Array.isArray(X)) return { n: typeof X[0] === 'string' ? X[0] : '', c: typeof X[1] === 'string' ? X[1] : '' };
  if (mkO(X)) return { n: typeof X.n === 'string' ? X.n : '', c: typeof X.c === 'string' ? X.c : '' };
  return { n: '', c: '' };
}
function mkEggV(d) { const { t, n } = mkEggTier(d); return 120 * Math.pow(1000, t / (n - 1)); }
function itemValue(it) {
  try {
    if (!mkO(it) || !['weapon', 'armor', 'helm'].includes(it.slot)) return 0;
    const t = clamp(Math.floor(+it.tier) || 0, 0, TIERS - 1), r = clamp(Math.floor(+it.rar) || 0, 0, 6), up = clamp(Math.floor(+it.up) || 0, 0, 10), fz = clamp(Math.floor(+it.fz) || 0, 0, 5);
    let v = PRICE[t] * MK_RV[r] * (1 + up * .12 + Math.pow(Math.max(0, up - 5), 2) * .05) * (1 + fz * .25);
    // Zusatzwerte zählen nach Güte (im Vergleich zum Höchstwert) und Beliebtheit
    const w = it.slot === 'weapon', pool = w ? AFFW : AFFA, W = w ? MK_AFW : MK_AFA; let q = 0;
    if (mkO(it.aff)) for (const k in it.aff) if (mkHas(pool, k) && typeof it.aff[k] === 'number' && Number.isFinite(it.aff[k])) q += clamp(it.aff[k] / pool[k].f(6), 0, 1.2) * (W[k] || 1);
    v *= (1 + q * .15) * (1 + clamp(Math.floor(+it.sockets) || 0, 0, 3) * .05);
    if (it.el) v *= 1.12;
    if (it.myth && mkHas(MYTHIC, it.myth)) v *= MK_MYW[it.myth] || 1.15;
    if (it.set === 'drache') v *= 1.15;
    if (mkO(it.mw)) { v *= 1.15; for (const k in it.mw) { const g = Math.floor(+it.mw[k]) || 0; if (g >= 1 && /^[a-z]{2,12}$/.test(k)) v += mkPartV(k + ':' + clamp(g, 1, 10)) * .6; } }
    if (Array.isArray(it.gems)) for (const g of it.gems.slice(0, 3)) v += mkGemV(g) * .8;
    if (Array.isArray(it.mods)) for (const k of it.mods.slice(0, 6)) v += mkModV(k) * .8;
    return mkR(v);
  } catch (_) { return 0; }
}
// Wert eines Stücks (Materialien, Edelsteine, Bauteile) bzw. des ganzen Eintrags
function mkUnit(e) {
  if (!mkO(e)) return 0;
  switch (e.t) { case 'mat': return mkHas(MK_MATV, e.k) ? MK_MATV[e.k] : 0; case 'gem': return mkGemV(e.k); case 'part': return mkPartOk(e.k) ? mkPartV(e.k) : 0; case 'mod': return mkModV(e.k); case 'gold': return 1; }
  return lootValue(e);
}
function lootValue(e) {
  if (!mkO(e)) return 0;
  const n = Math.max(0, Math.floor(+e.n) || 0);
  switch (e.t) {
    case 'item': return itemValue(e.it);
    case 'mat': return mkHas(MK_MATV, e.k) ? MK_MATV[e.k] * n : 0;
    case 'gem': return mkR(mkGemV(e.k) * n);
    case 'part': return mkPartOk(e.k) ? mkR(mkPartV(e.k) * n) : 0;
    case 'mod': return mkModOk(e.k) ? mkR(mkModV(e.k) * n) : 0;
    case 'egg': return mkO(e.d) && mkSpOk(e.d.sp) ? mkR(mkEggV(e.d)) : 0;
    case 'gold': return n;
  }
  return 0;
}
// Sofortpreis bei Hedda: fair, aber niedrig (nie weniger als beim Händler auf der Karte)
function mkQuote(e) {
  if (!mkO(e)) return 0;
  if (e.t === 'item') { let p = 0; try { p = itemPrice(e.it); } catch (_) { p = 0; } return Math.max(p, Math.round(itemValue(e.it) * .4)); }
  if (e.t === 'gold') return e.n | 0;
  if (e.t === 'egg') return Math.round(lootValue(e) * .4);
  return Math.max(1, Math.floor(mkUnit(e) * .4)) * Math.max(1, e.n | 0);
}
HOOK.itemLines.push((it, L) => { const v = itemValue(it); if (v > 0) L.push(_t('Marktwert: {n} Gold', { n: mkG(v) })); });

/* ---------- Spielstand ---------- */
function mkDef() { return { v: 1, seed: (Math.random() * 2147483647) | 0, rs: (Math.random() * 2147483647) | 0, clk: 0, init: 0, shop: {}, auc: [], own: [], spawn: [], box: [], log: [], hist: {}, vol: 0, sold: 0, bought: 0, best: 0, unseen: 0, rk: 0 }; }
const MK_IKEYS = ['uid', 'slot', 'base', 'tier', 'rar', 'up', 'aff', 'sockets', 'gems', 'set', 'name', 'suf', 'fz', 'form', 'myth', 'el', 'mw', 'skin', 'mods'];
function mkFixItem(d) {
  if (!mkO(d)) return null;
  let it = null;
  if (typeof trItem === 'function') { try { it = trItem(d); } catch (_) { it = null; } }
  else if (['weapon', 'armor', 'helm'].includes(d.slot) && mkI(d.tier, 0, TIERS - 1) && mkI(d.rar, 0, 6) && (d.slot !== 'weapon' || mkHas(WT, d.base))) { it = makeItem({ slot: d.slot, base: d.base, tier: d.tier, rar: d.rar }); }
  if (!it) return null;
  if (typeof d.uid === 'string' && /^[a-z0-9]{4,30}$/i.test(d.uid)) it.uid = d.uid;
  if (Array.isArray(d.mods)) { const ms = d.mods.filter(mkModOk).slice(0, 6); if (ms.length) it.mods = ms; }
  if (mkO(d.skin)) { const s = {}; if (mkI(d.skin.tier, 0, TIERS - 1)) s.tier = d.skin.tier; if (typeof d.skin.form === 'string') s.form = d.skin.form.slice(0, 12); if (Object.keys(s).length) it.skin = s; }
  // Felder anderer Systeme (später ergänzt) als einfache Daten behalten
  let n = 0;
  for (const k of Object.keys(d)) if (!MK_IKEYS.includes(k) && !(k in it) && /^[a-z][A-Za-z0-9_]{0,15}$/.test(k) && n++ < 8 && typeof trPlain === 'function') { const v = trPlain(d[k], 1, 1e9); if (v != null) it[k] = v; }
  return it;
}
function mkFixE(e) {
  if (!mkO(e)) return null;
  const n = e.n;
  switch (e.t) {
    case 'item': { const it = mkFixItem(e.it); return it ? { t: 'item', it } : null; }
    case 'mat': return mkHas(MK_MATV, e.k) && mkI(n, 1, 99999) ? { t: 'mat', k: e.k, n } : null;
    case 'gem': return typeof e.k === 'string' && mkGemV(e.k) > 0 && mkI(n, 1, 9999) ? { t: 'gem', k: e.k, n } : null;
    case 'part': return mkPartOk(e.k) && mkI(n, 1, 9999) ? { t: 'part', k: e.k, n } : null;
    case 'mod': return mkModOk(e.k) && mkI(n, 1, 9999) ? { t: 'mod', k: e.k, n } : null;
    case 'egg': { if (!mkO(e.d) || !mkSpOk(e.d.sp)) return null; const d = typeof trPlain === 'function' ? trPlain(e.d, 1, 1e9) : { sp: e.d.sp }; return mkO(d) ? { t: 'egg', d: Object.assign(d, { egg: 1, sp: e.d.sp }) } : null; }
    case 'gold': return mkI(n, 1, 1e10) ? { t: 'gold', n } : null;
  }
  return null;
}
function mkFixA(a, own, now) {
  if (!mkO(a)) return null;
  const e = mkFixE(a.e); if (!e || e.t === 'gold') return null;
  const V = Math.max(1, lootValue(e)), TT = (v, d) => mkN(v, 0, 1e14, d), NN = MK_NAMES.length - 1;
  const d = mkN(a.d, MK_MIN, 48 * MK_H, MK_H), t0 = TT(a.t0, now), ext = mkN(a.ext, 0, 30 * MK_MIN, 0);
  const A = { id: typeof a.id === 'string' && /^[a-z0-9]{1,24}$/i.test(a.id) ? a.id : uid(), e, own: own ? 1 : 0, t0, t1: clamp(TT(a.t1, t0 + d), t0, t0 + d + ext), d, start: 1, bo: 0, bids: [], bd: [], rs: mkN(a.rs, -2147483648, 2147483647, 7) | 0, me: a.me ? 1 : 0, s: mkI(a.s, 0, NN) ? a.s : 0, ext, done: 0 };
  // Startpreis der Händler nie unter 20 % des Marktwerts – ein bearbeiteter Spielstand macht keine Schnäppchen
  A.start = Math.floor(mkN(a.start, own ? 1 : Math.ceil(V * .2), 1e10, Math.ceil(V * .5)));
  const bo = Math.floor(mkN(a.bo, 0, 1e10, 0)); A.bo = bo > A.start ? bo : 0;
  let last = 0;
  if (Array.isArray(a.bids)) for (const b of a.bids.slice(0, 300)) {
    if (!Array.isArray(b) || !mkI(b[1], own ? 0 : -1, NN) || !mkI(b[2], Math.max(A.start, last + 1), 1e10)) break;
    A.bids.push([clamp(TT(b[0], t0), t0, A.t1), b[1], b[2]]); last = b[2];
  }
  if (Array.isArray(a.bd)) for (const b of a.bd.slice(0, 10)) if (mkO(b) && mkI(b.n, 0, NN)) A.bd.push({ n: b.n, m: mkN(b.m, .3, 2.2, 1), k: mkI(b.k, 0, 4) ? b.k : 1, x: Math.round(TT(b.x, 0)) });
  if (A.bids.some(b => b[1] === -1)) A.me = 1;
  return A;
}
function mkFix(o) {
  const d = mkDef(); if (!mkO(o)) return d;
  const now = Date.now(), N = mkN, arr = (a, max) => Array.isArray(a) ? a.slice(0, max) : [], safe = f => { try { f(); } catch (e) { console.error('Basar (Spielstand):', e); } };
  d.seed = N(o.seed, -2147483648, 2147483647, d.seed) | 0; d.rs = N(o.rs, -2147483648, 2147483647, d.rs) | 0;
  d.clk = N(o.clk, 0, 1e14, 0); d.init = o.init ? 1 : 0; d.vol = N(o.vol, 0, 1e13, 0); d.sold = Math.floor(N(o.sold, 0, 1e9, 0)); d.bought = Math.floor(N(o.bought, 0, 1e9, 0)); d.best = N(o.best, 0, 1e11, 0); d.unseen = Math.floor(N(o.unseen, 0, 999, 0)); d.rk = Math.floor(N(o.rk, 0, MK_RANK.length - 1, 0));
  const t = Math.max(now, d.clk);
  // eigene Versteigerungen und das Abholfach zuerst: darin liegen Dinge des Spielers
  safe(() => { for (const a of arr(o.own, 12)) { const A = mkFixA(a, true, t); if (A && d.own.length < 8) d.own.push(A); else if (mkO(a) && mkFixE(a.e)) d.box.push({ e: mkFixE(a.e), w: 'back', t }); } });
  safe(() => { for (const x of arr(o.box, 120)) { const e = mkO(x) && mkFixE(x.e); if (e) d.box.push({ e, w: ['won', 'sold', 'back', 'refund', 'buy'].includes(x.w) ? x.w : 'back', t: N(x.t, 0, 1e14, t) }); } });
  safe(() => { for (const a of arr(o.auc, 16)) { const A = mkFixA(a, false, t); if (A && d.auc.length < 12) d.auc.push(A); } });
  safe(() => { d.spawn = arr(o.spawn, 12).filter(x => typeof x === 'number' && Number.isFinite(x)).map(x => clamp(x, 0, t + 2 * MK_H)); });
  safe(() => { if (mkO(o.shop)) for (const h of Object.keys(o.shop).slice(0, 12)) { const S = o.shop[h]; if (!/^[a-z0-9]{4,30}$/i.test(h) || !mkO(S)) continue; const list = []; for (const x of arr(S.list, 14)) { const e = mkO(x) && mkFixE(x.e); if (e && e.t !== 'gold') list.push({ id: typeof x.id === 'string' && /^[a-z0-9]{1,24}$/i.test(x.id) ? x.id : uid(), e, n: Math.floor(N(x.n, 0, 99, 0)), f: N(x.f, .8, 1.6, 1.2) }); } d.shop[h] = { nx: N(S.nx, 0, t + 4 * MK_H, 0), list }; } });
  safe(() => { for (const x of arr(o.log, 40)) if (mkO(x) && /^[a-z]{2,8}$/.test(x.k)) d.log.push({ k: x.k, t: N(x.t, 0, 1e14, t), i: String(x.i == null ? '' : x.i).replace(/[<>\u0000-\u001f]/g, '').slice(0, 60), n: N(x.n, 0, 1e11, 0), b: String(x.b == null ? '' : x.b).replace(/[<>\u0000-\u001f]/g, '').slice(0, 20) }); });
  safe(() => { if (mkO(o.hist)) for (const k of Object.keys(o.hist).slice(0, 150)) { const H = o.hist[k]; if (!/^[a-z]\.[a-z0-9.:]{1,40}$/.test(k) || !Array.isArray(H)) continue; const L = H.slice(-12).filter(h => Array.isArray(h) && typeof h[0] === 'number' && Number.isFinite(h[0]) && typeof h[1] === 'number' && h[1] > 0 && h[1] < 1e11).map(h => [h[0], Math.round(h[1])]); if (L.length) d.hist[k] = L; } });
  return d;
}
HOOK.meta.push(m => { try { m.market = mkFix(m.market); } catch (e) { console.error('Basar (meta):', e); m.market = mkDef(); } });
HOOK.activate.push(() => { MK.sel = null; MK.set = null; MK.conf = 0; });

/* ---------- Uhr: nur vorwärts ---------- */
function mkNow() {
  const M = mkM(), n = Date.now(); if (!M) return n;
  if (M.clk - n > 30 * 864e5) mkShift(M, n - M.clk);   // Uhr stand Wochen in der Zukunft: Zeiten verschieben statt ewig warten
  if (n > M.clk) M.clk = n;
  return M.clk;
}
function mkFrozen() { const M = mkM(); return M ? Math.max(0, M.clk - Date.now()) : 0; }
function mkShift(M, d) {
  M.clk += d;
  for (const A of M.auc.concat(M.own)) { A.t0 += d; A.t1 += d; for (const b of A.bids) b[0] += d; for (const b of A.bd) if (b.x) b.x += d; }
  M.spawn = M.spawn.map(t => t + d); for (const x of M.box) x.t += d; for (const x of M.log) x.t += d;
  for (const k in M.hist) for (const h of M.hist[k]) h[0] += d; for (const h in M.shop) M.shop[h].nx += d;
}

/* ---------- Zufall (Zustand im Objekt, damit das Nachrechnen gleich bleibt) ---------- */
function mkRng(o) { return () => { o.rs = (o.rs + 0x6D2B79F5) | 0; let t = Math.imul(o.rs ^ o.rs >>> 15, 1 | o.rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mkPick = (R, a) => a[Math.floor(R() * a.length)];
const mkGauss = R => Math.sqrt(-2 * Math.log(R() || 1e-9)) * Math.cos(6.2832 * R());

/* ---------- Ware erzeugen ---------- */
function mkLv() { let lv = 1; for (const c of (SAVE && SAVE.chars) || []) if (c && c.lv > lv) lv = c.lv; return clamp(Math.floor(lv) || 1, 1, 99); }
function mkTier(lv) { let t = 0; REQ.forEach((r, i) => { if (r <= lv) t = i; }); return t; }
function mkCls(R) { const L = ((SAVE && SAVE.chars) || []).map(c => c && c.cls).filter(c => mkHas(CLASSES, c)); return L.length ? mkPick(R, L) : mkPick(R, Object.keys(CLASSES)); }
function mkItemGen(R, tier, rar, cls, sl) {
  const C = CLASSES[cls] || CLASSES.knight, W = C.weapons, slot = sl || (R() < .45 ? 'weapon' : R() < .55 ? 'armor' : 'helm');
  if (rar === 6) { const k = mkPick(R, Object.keys(MYTHIC)), S = MYTHIC[k].slot; return makeItem({ slot: S, base: S === 'weapon' ? mkPick(R, W) : S, tier: Math.max(3, tier), rar: 6, myth: k }); }
  if (rar === 5) { const own = Object.keys(SETS).find(k => SETS[k].cls === cls), sid = own && R() < .6 ? own : 'drache', S = SETS[sid]; return makeItem({ slot, base: slot === 'weapon' ? (S.base || C.start) : slot, tier: Math.max(2, tier), rar: 5, set: sid }); }
  return makeItem({ slot, base: slot === 'weapon' ? mkPick(R, W) : slot, tier, rar });
}
function mkEggRoll(R, auc) {
  if (typeof eggGive !== 'function' && typeof petImport !== 'function') return null;
  try {
    if (typeof eggRoll === 'function') {
      const n = mkEggTier({}).n, t = typeof eggTierRoll === 'function' ? eggTierRoll(auc ? 2 : 1) : +wpick({ 0: 40, 1: 30, 2: 18, 3: 8, 4: 3, 5: 1 }, R), sp = eggRoll(clamp(Math.floor(+t) || 0, 0, n - 1));
      if (mkSpOk(sp)) return sp;
    }
    if (typeof PET_SP !== 'undefined' && mkO(PET_SP)) { const ks = Object.keys(PET_SP).filter(mkSpOk); if (ks.length) return mkPick(R, ks); }
  } catch (e) { console.error('Basar (Ei):', e); }
  return null;
}
// eine Ware passend zum Fortschritt; auc = für eine Versteigerung (seltener und besser)
function mkGenE(R, kind, lv, cls, auc, sl) {
  const tier = clamp(mkTier(lv) + (R() < .25 ? 1 : 0) - (R() < .3 ? 1 : 0), 0, TIERS - 1), band = lv < 12 ? 0 : lv < 28 ? 1 : 2;
  if (kind === 'item') {
    const rk = mkRankI(), rar = +wpick(auc ? { 2: 26, 3: 36, 4: 26, 5: 9, 6: 3 } : { 1: 38, 2: 34, 3: 20, 4: 5 + rk * .6, 5: 1.5 + (rk >= 7 ? 2 : 0) }, R), it = mkItemGen(R, tier, rar, cls, sl);
    if (auc && R() < .3) it.up = 1 + Math.floor(R() * 6); if (auc && R() < .06) it.fz = 1;
    return { t: 'item', it };
  }
  if (kind === 'mat') { const k = mkPick(R, MK_BAND[band]); return { t: 'mat', k, n: clamp(Math.round([150, 900, 2600][band] * (.6 + R() * .9) / MK_MATV[k]), 1, 60) }; }
  if (kind === 'gem') { const gr = clamp(Math.floor(R() * R() * (1.5 + lv / 9)), 0, 4); return { t: 'gem', k: mkPick(R, GEMORDER) + ':' + gr, n: gr ? 1 : 1 + Math.floor(R() * 3) }; }
  if (kind === 'part') {
    const types = typeof PARTORDER !== 'undefined' && Array.isArray(PARTORDER) && PARTORDER.length ? PARTORDER : ['klinge', 'griff', 'kern', 'platte', 'polster', 'rune'], t = mkPick(R, types);
    const top = clamp(1 + Math.floor(lv / 12), 1, 6), g = clamp(top - (R() < .5 ? 1 : 0) + (auc && R() < .2 ? 1 : 0), 1, 10), els = typeof ELORDER !== 'undefined' && ELORDER.length ? ELORDER : ['feuer'];
    const el = typeof PART !== 'undefined' && PART[t] ? PART[t].el : (t === 'kern' || t === 'rune'), k = el ? t + ':' + mkPick(R, els) + ':' + g : t + ':' + g;
    return mkPartOk(k) ? { t: 'part', k, n: 1 + (R() < .3 ? 1 : 0) } : null;
  }
  if (kind === 'egg') { const sp = mkEggRoll(R, auc); return sp ? { t: 'egg', d: { egg: 1, sp } } : null; }
  if (kind === 'mod') { if (typeof modRoll !== 'function') return null; const k = modRoll(clamp(lv / 60, 0, .35) + (auc ? .08 : 0), 1, R); return mkModOk(k) ? { t: 'mod', k, n: 1 } : null; }
  return null;
}
const mkOfferPrice = o => Math.max(1, mkR(lootValue(o.e) * o.f));
function mkShopGen() {
  const M = mkM(), R = mkRng(M), lv = P.lv, rk = mkRankI(), L = [];
  const add = (e, n) => { if (e) L.push({ id: uid(), e, n, f: +(R() < .15 ? .85 + R() * .12 : 1.08 + R() * .22).toFixed(3) }); };
  for (let i = 0, ni = 4 + (rk >= 3) + (rk >= 6); i < ni; i++) add(mkGenE(R, 'item', lv, i === 0 || R() < .75 ? P.cls : mkCls(R), false, i === 0 ? 'weapon' : null), 1);   // immer eine Waffe für die eigene Klasse
  add(mkGenE(R, 'mat', lv), 1 + Math.floor(R() * 3)); add(mkGenE(R, 'mat', lv), 1 + Math.floor(R() * 2));
  add(mkGenE(R, 'gem', lv), 1 + Math.floor(R() * 2)); add(mkGenE(R, 'part', lv), 1 + Math.floor(R() * 2));
  if (R() < .6) add(mkGenE(R, 'egg', lv), 1);
  if (typeof modRoll === 'function' && R() < .6) add(mkGenE(R, 'mod', lv), 1);
  return L;
}
// Angebote des Händlers: je Held, alle 4 Stunden neu (die Uhr läuft nur vorwärts – kein Neuwürfeln durch Uhr-Tricks)
function mkShop() {
  const M = mkM(), now = mkNow();
  for (const h of Object.keys(M.shop)) if (!SAVE.chars.some(c => c && c.id === h)) delete M.shop[h];
  let S = M.shop[P.id];
  if (!S || now >= S.nx) { S = M.shop[P.id] = { nx: now + 4 * MK_H, list: mkShopGen() }; MK_REV++; }
  return S.list;
}
function mkAucNew(t0) {
  const M = mkM(), R = mkRng(M), eggs = typeof eggGive === 'function' || typeof petImport === 'function', lv = mkLv();
  let e = null;
  for (let i = 0; i < 4 && !e; i++) e = mkGenE(R, wpick({ item: 70, egg: eggs ? 8 : 0, part: 8, gem: 7, mat: 7 }, R), lv, mkCls(R), true);
  if (!e) e = mkGenE(R, 'item', lv, mkCls(R), true);
  const V = Math.max(1, lootValue(e)), W = {}; MK_ADUR.forEach((x, i) => { W[i] = x[1]; }); const D = MK_ADUR[+wpick(W, R)][0] * MK_H;
  const A = { id: uid(), e, own: 0, t0: Math.round(t0), t1: Math.round(t0 + D), d: D, start: mkNice(V * (.3 + R() * .45)), bo: R() < .45 ? mkNice(V * (1.3 + R() * .6)) : 0, bids: [], bd: [], rs: (R() * 4294967296) | 0, me: 0, s: Math.floor(R() * MK_NAMES.length), ext: 0, done: 0 };
  mkBidders(A, V); return A;
}

/* ---------- Bieter: echte Zeit, auch bei geschlossenem Spiel ---------- */
// Wie viele bieten mit, wie viel ist ihnen die Ware wert (um den Marktwert herum), wann schauen sie vorbei
function mkBidders(A, V) {
  const R = mkRng(A), e = A.e, h = A.d / MK_H, et = e.t === 'egg' ? mkEggTier(e.d) : null, q = e.t === 'item' ? e.it.rar : et ? Math.round(et.t * 6 / (et.n - 1)) : 2;
  let k = .5 + Math.log2(1 + h) + R() * 1.5 + (q >= 4 ? 1 : q === 3 ? .5 : q <= 1 ? -.8 : 0) + (!A.own && R() < .15 ? 2 : 0);   // ab und zu heiß begehrt
  k = clamp(Math.round(k), 0, 9);
  const used = new Set([A.own ? -9 : A.s]);
  for (let i = 0; i < k; i++) {
    let n = Math.floor(R() * MK_NAMES.length); for (let j = 0; j < 40 && used.has(n); j++) n = Math.floor(R() * MK_NAMES.length); used.add(n);
    const ty = MK_NAMES[n][1], m = clamp(Math.exp(mkGauss(R) * .18 - .1) * (ty === 3 ? 1.2 : ty === 4 ? .75 : 1), .45, 1.9);
    const fr = ty === 0 ? .02 + R() * .12 : ty === 1 ? .05 + R() * .6 : ty === 3 ? .2 + R() * .6 : R() * .5;
    const x = ty === 2 ? Math.max(A.t0 + 1000, A.t1 - 5000 - R() * 150000) : A.t0 + Math.max(.01, fr) * A.d;
    A.bd.push({ n, m: +m.toFixed(3), k: ty, x: Math.round(x) });
  }
}
function mkGap(b, A, R) { const D = A.d, r = R(); switch (b.k) { case 0: return D * (.04 + r * .12); case 1: return D * (.08 + r * .2); case 2: return 5000 + r * 35000; case 3: return D * (.1 + r * .25); default: return D * (.1 + r * .3); } }
const mkTop = A => A.bids.length ? A.bids[A.bids.length - 1] : null;
const mkInc = p => Math.max(1, Math.ceil(p * .05));
function mkMinBid(A) { const t = mkTop(A); return t ? mkNice(t[2] + mkInc(t[2])) : Math.max(1, A.start); }
function mkSim(A, now, ev) {
  if (A.done) return;
  const V = Math.max(1, lootValue(A.e));
  for (let g = 0; g < 600; g++) {
    let b = null; for (const x of A.bd) if (x.x > 0 && (!b || x.x < b.x)) b = x;
    const tn = b ? b.x : Infinity;
    if (tn >= A.t1) { if (A.t1 <= now) mkEnd(A, ev); return; }
    if (tn > now) return;
    mkAct(A, b, tn, V, ev); if (A.done) return;
  }
  for (const x of A.bd) x.x = 0;   // Notbremse
}
function mkAct(A, b, t, V, ev) {
  const R = mkRng(A), top = mkTop(A), max = Math.round(V * b.m);
  b.x = 0;
  if (top && top[1] === b.n) { b.x = Math.round(t + mkGap(b, A, R)); return; }   // führt schon: später wieder schauen
  const need = mkMinBid(A); if (need > max) return;                           // zu teuer: steigt aus
  if (A.bo && A.bo <= max * 1.04 && R() < (b.k === 0 || b.k === 3 ? .4 : .15)) { mkBid(A, t, b.n, A.bo, ev); mkEnd(A, ev, t); return; }
  let amt = b.k === 2 ? need + V * (.02 + R() * .07) : R() < .28 ? need + V * R() * .12 : need;   // Last-Minute und Sprünge
  amt = Math.min(Math.max(need, mkNice(amt)), Math.max(need, max));
  if (A.bo && amt >= A.bo) { mkBid(A, t, b.n, A.bo, ev); mkEnd(A, ev, t); return; }
  mkBid(A, t, b.n, amt, ev);
  b.x = Math.round(t + mkGap(b, A, R));
}
// Gebot eintragen: Überbotene bekommen ihr Gold zurück (Abholfach), knapp vor Schluss verlängert sich die Auktion
function mkBid(A, t, who, amt, ev) {
  const top = mkTop(A);
  A.bids.push([t, who, amt]); MK_REV++;
  if (top && top[1] === -1 && who !== -1) { mkBoxAdd({ t: 'gold', n: top[2] }, 'refund', t); ev.push({ k: 'outbid', t, id: A.id, e: A.e, who, n: amt }); }
  if (A.own) ev.push({ k: 'bid', t, id: A.id, e: A.e, who, n: amt });
  if (A.t1 - t < 2 * MK_MIN && A.ext < 30 * MK_MIN) { const add = Math.min(t + 2 * MK_MIN - A.t1, 30 * MK_MIN - A.ext); A.t1 += add; A.ext += add; }
  if (top && top[1] >= 0 && top[1] !== who) { const o = A.bd.find(x => x.n === top[1]); if (o) { const R = mkRng(A), x = Math.round(t + 15000 + R() * Math.min(6 * MK_MIN, A.d * .06)); if (!o.x || o.x > x) o.x = x; } }
}
function mkEnd(A, ev, t) {
  if (A.done) return;
  A.done = 1; if (t != null) A.t1 = t; MK_REV++;
  const M = mkM(), top = mkTop(A), at = A.t1;
  if (top) mkHistAdd(A.e, top[2], at);
  if (A.own) {
    if (top) { const fee = Math.ceil(top[2] * mkFee()); mkBoxAdd({ t: 'gold', n: Math.max(0, top[2] - fee) }, 'sold', at); M.sold++; M.best = Math.max(M.best, top[2]); mkVol(top[2]); ev.push({ k: 'sold', t: at, id: A.id, e: A.e, who: top[1], n: top[2], fee }); }
    else { mkBoxAdd(A.e, 'back', at); ev.push({ k: 'unsold', t: at, id: A.id, e: A.e }); }
  } else if (top && top[1] === -1) { mkBoxAdd(A.e, 'won', at); M.bought++; mkVol(top[2]); ev.push({ k: 'won', t: at, id: A.id, e: A.e, n: top[2] }); }
  else if (A.me && top) ev.push({ k: 'lost', t: at, id: A.id, e: A.e, who: top[1], n: top[2] });
}
function mkBoxAdd(e, w, t) {
  const M = mkM(); if (e.t === 'gold' && !(e.n > 0)) return;
  if (e.t === 'gold') { const g = M.box.find(x => x.e.t === 'gold' && x.w === w); if (g) { g.e.n += e.n; g.t = Math.max(g.t, t); return; } }
  M.box.push({ e, w, t });
}
function mkAucWant() { const r = mkRankI(); return 6 + (r >= 4) + (r >= 8); }
function mkEnsure() {
  const M = mkM(); if (!M || M.init) return;
  M.init = 1; const R = mkRng(M), now = mkNow();
  for (let i = 0; i < mkAucWant(); i++) M.spawn.push(Math.round(now - R() * 14 * MK_H));   // schon laufende Versteigerungen
  mkTick(now);
}
function mkTick(now) {
  const M = mkM(); if (!M || !M.init) return [];
  now = Math.min(now == null ? mkNow() : now, mkNow());
  const ev = [], R = mkRng(M), want = mkAucWant();
  for (const A of M.own) mkSim(A, now, ev);
  for (let g = 0; g < 80; g++) {
    for (const A of M.auc) mkSim(A, now, ev);
    for (const A of M.auc) if (A.done) M.spawn.push(Math.round(A.t1 + MK_MIN + R() * 25 * MK_MIN));
    M.auc = M.auc.filter(A => !A.done);
    while (M.auc.length + M.spawn.length < want) M.spawn.push(Math.round(M.auc.length ? now + R() * 5 * MK_MIN : now - R() * 14 * MK_H));   // leere Tafel: gleich laufende
    M.spawn.sort((a, b) => a - b);
    const due = M.spawn.filter(s => s <= now); if (!due.length) break;
    M.spawn = M.spawn.filter(s => s > now);
    // lange weg: alte Händler-Auktionen nicht einzeln nachspielen, sondern frische nehmen
    for (const s of due) M.auc.push(mkAucNew(now - s > 26 * MK_H ? Math.round(now - R() * 10 * MK_H) : s));
  }
  M.own = M.own.filter(A => !A.done); M.spawn.length = Math.min(M.spawn.length, 12);
  ev.sort((a, b) => a.t - b.t);
  for (const e of ev) mkLog(e);
  return ev;
}

/* ---------- Verlauf, Preise, Handelsrang ---------- */
function mkKey(e) {
  if (!mkO(e)) return '';
  switch (e.t) {
    case 'item': return 'i.' + e.it.slot + '.' + e.it.tier + '.' + e.it.rar;
    case 'mat': return 'm.' + e.k;
    case 'gem': return 'g.' + e.k;
    case 'part': { const a = e.k.split(':'); return 'p.' + a[0] + '.' + a[a.length - 1]; }
    case 'mod': return 'x.' + e.k;
    case 'egg': return 'e.' + mkEggTier(e.d).t;
  }
  return '';
}
const mkPer = e => e && (e.t === 'mat' || e.t === 'gem' || e.t === 'part' || e.t === 'mod') ? Math.max(1, e.n | 0) : 1;
function mkHistAdd(e, price, t) {
  const M = mkM(), k = mkKey(e); if (!k) return;
  const H = M.hist[k] || (M.hist[k] = []); H.push([t, Math.round(price / mkPer(e))]); if (H.length > 12) H.splice(0, H.length - 12);
  const ks = Object.keys(M.hist); if (ks.length > 150) { ks.sort((a, b) => M.hist[a][M.hist[a].length - 1][0] - M.hist[b][M.hist[b].length - 1][0]); for (const x of ks.slice(0, ks.length - 150)) delete M.hist[x]; }
}
// typischer Preis einer Art (ohne Aufwertung und Zusatzwerte) – Grundlage für den Verlauf
function mkTypeV(e) { if (e.t === 'item') return PRICE[e.it.tier] * MK_RV[e.it.rar] * (e.it.rar === 6 ? 1.15 : 1.05); return mkUnit(e); }
// Preisverlauf: echte Verkäufe, aufgefüllt mit früheren Marktpreisen (für alle gleich je Tag)
function mkHist(e) {
  const M = mkM(), k = mkKey(e), real = (M && M.hist[k]) || [];
  if (real.length >= 8) return real.slice(-10);
  const now = mkNow(), R = mulberry(hashStr(k) ^ (M ? M.seed : 0) ^ Math.floor(now / 864e5)), base = mkTypeV(e), out = []; let t = real.length ? real[0][0] : now;
  for (let i = real.length; i < 8; i++) { t -= (3 + R() * 15) * MK_H; out.unshift([t, Math.max(1, mkR(base * (.75 + R() * .55)))]); }
  return out.concat(real);
}
function mkRankI() { const M = mkM(), v = M ? M.vol : 0; let r = 0; MK_RANK.forEach((x, i) => { if (v >= x[0]) r = i; }); return r; }
const mkFee = () => MK_FEE[mkRankI()], mkSlots = () => MK_SLOT[mkRankI()];
function mkVol(n) {
  const M = mkM(); M.vol = Math.min(1e13, M.vol + Math.max(0, n));
  const r = mkRankI(); if (r > M.rk) { M.rk = r; mkToastQ({ txt: _t('Handelsrang {n}: {title}! Weniger Gebühr, mehr Plätze.', { n: r + 1, title: MK_RANK[r][1] }), c: '#ffd24a', s: 'lvl' }); }
}
// Schätzung für die eigene Versteigerung: Verkaufschance und üblicher Erlös nach Gebühr
function mkEst(e, start, bo, h) {
  const V = Math.max(1, lootValue(e)), R = mulberry(12345 + Math.round(V) + h * 7 + Math.round(start)), fee = mkFee(), out = [], N = 240;
  const A = { e, d: h * MK_H, t0: 0, t1: h * MK_H, own: 1, s: 0, bd: [], rs: 1 }; let sold = 0;
  for (let i = 0; i < N; i++) {
    A.rs = (R() * 4294967296) | 0; A.bd = []; mkBidders(A, V);
    const mx = A.bd.map(b => V * b.m).filter(m => m >= start).sort((a, b) => b - a); if (!mx.length) continue;
    sold++; let p = mx.length > 1 ? Math.min(mx[0], mx[1] * 1.04) : start;
    if (bo && mx[0] * 1.04 >= bo && R() < .5) p = bo;
    out.push(Math.max(start, bo ? Math.min(bo, p) : p) * (1 - fee));
  }
  out.sort((a, b) => a - b);
  return { p: sold / N, lo: out.length ? mkR(out[Math.floor(out.length * .2)]) : 0, hi: out.length ? mkR(out[Math.floor(out.length * .8)]) : 0 };
}

/* ---------- Held: Gold, Beutel, Lager, Vorrat, Brutnest ---------- */
function mkEggs() { const M = SAVE && SAVE.meta && SAVE.meta.pets; return M && Array.isArray(M.eggs) ? M.eggs : []; }
function mkEggGive(d) {
  try {
    const fresh = Object.keys(d).every(k => k === 'egg' || k === 'sp');
    if (!fresh && typeof petImport === 'function') { const r = petImport(Object.assign({}, d, { egg: 1 })); if (r !== false && r != null) return true; }
    if (typeof eggGive === 'function') { const r = eggGive(d.sp, true); return r !== false && r != null; }
  } catch (e) { console.error('Basar (Ei):', e); }
  return false;
}
const MK_HERO = {
  ok: () => !!(P && SAVE && SAVE.active >= 0 && SAVE.chars[SAVE.active] && SAVE.chars[SAVE.active].id === P.id),
  gold: () => P.gold || 0,
  pay(n) { P.gold -= n; }, earn(n) { P.gold += n; },
  stash: () => SAVE.meta.hide && Array.isArray(SAVE.meta.hide.stash) && typeof stashCap === 'function' ? SAVE.meta.hide.stash : null,
  room: () => P.bag.length < MK_BAG || !!(MK_HERO.stash() && MK_HERO.stash().length < stashCap()),
  // null = passt, sonst Fehler-Schlüssel
  can(e) {
    if (e.t === 'item') return MK_HERO.room() ? null : 'full';
    if (e.t === 'egg') { if (typeof eggGive !== 'function' && typeof petImport !== 'function') return 'pets'; if (typeof eggFree === 'function') { try { if (eggFree() <= 0) return 'nest'; } catch (_) { } } }
    return null;
  },
  // → wohin es kam ('bag', 'stash', 'vorrat', 'nest', 'gold') oder null
  give(e) {
    switch (e.t) {
      case 'item': {
        const S = MK_HERO.stash(), to = P.bag.length < MK_BAG ? 'bag' : S && S.length < stashCap() ? 'stash' : null; if (!to) return null;
        const it = e.it; hook('pickup', it); if (it.rar === 6) statMax('myths', 1); (to === 'bag' ? P.bag : S).push(it); return to;
      }
      case 'mat': gainMat(e.k, e.n); return 'vorrat';
      case 'gem': P.gems[e.k] = (P.gems[e.k] || 0) + e.n; return 'vorrat';
      case 'part': if (!P.parts) P.parts = {}; P.parts[e.k] = (P.parts[e.k] || 0) + e.n; return 'vorrat';
      case 'mod': return typeof modGive === 'function' && modGive(e.k, e.n) ? 'vorrat' : null;
      case 'gold': P.gold += e.n; return 'gold';
      case 'egg': return mkEggGive(e.d) ? 'nest' : null;
    }
    return null;
  },
  // aus dem Besitz nehmen: { t: 'item', uid } | { t: 'mat'|'gem'|'part'|'mod', k, n } | { t: 'egg', i } → Eintrag oder null
  take(s) {
    if (!mkO(s)) return null;
    const n = Math.floor(+s.n), stack = (o, ok) => { if (!ok || !(n >= 1) || ((o && o[s.k]) || 0) < n) return null; o[s.k] -= n; if ((s.t === 'part' || s.t === 'mod') && o[s.k] <= 0) delete o[s.k]; return { t: s.t, k: s.k, n }; };
    switch (s.t) {
      case 'item': { const i = P.bag.findIndex(x => x.uid === s.uid); return i < 0 ? null : { t: 'item', it: P.bag.splice(i, 1)[0] }; }
      case 'mat': return stack(P.mats, mkHas(MK_MATV, s.k));
      case 'gem': return stack(P.gems, mkGemV(s.k) > 0);
      case 'part': return stack(P.parts, mkPartOk(s.k));
      case 'mod': return stack(P.mods, mkModOk(s.k));
      case 'egg': {
        if (typeof eggExport !== 'function' || !mkEggs()[s.i]) return null;
        let d = null; try { d = eggExport(s.i); } catch (_) { d = null; }
        return mkO(d) && mkSpOk(d.sp) ? { t: 'egg', d: Object.assign({}, d, { egg: 1 }) } : null;
      }
    }
    return null;
  }
};

/* ---------- Schnittstelle (lokal simuliert) ---------- */
const MARKET = {
  online: false,
  now: () => mkNow(),
  tick: now => mkTick(now),
  listings(kind) {
    const M = mkM(); if (!M) return [];
    mkEnsure();
    if (kind === 'shop') return MK_HERO.ok() ? mkShop() : [];
    if (kind === 'auc') return M.auc.slice().sort((a, b) => a.t1 - b.t1);
    if (kind === 'own') return M.own.slice();
    if (kind === 'box') return M.box.slice();
    return [];
  },
  value: e => lootValue(e), quote: e => mkQuote(e), price: o => mkOfferPrice(o), minBid: A => mkMinBid(A), top: A => mkTop(A),
  fee: () => mkFee(), slots: () => mkSlots(), rank: () => mkRankI(), history: e => mkHist(e), estimate: (e, s, b, h) => mkEst(e, s, b, h),
  buy(id) {
    if (!MK_HERO.ok()) return { err: 'hero' };
    const o = mkShop().find(x => x.id === id); if (!o || o.n <= 0) return { err: 'gone' };
    const price = mkOfferPrice(o); if (MK_HERO.gold() < price) return { err: 'gold' };
    const e = mkClone(o.e); if (e.t === 'item') e.it.uid = uid();
    const c = MK_HERO.can(e); if (c) return { err: c };
    const where = MK_HERO.give(e); if (!where) return { err: e.t === 'egg' ? 'nest' : 'full' };
    MK_HERO.pay(price); o.n--; mkM().bought++; mkVol(price); mkHistAdd(e, price, mkNow()); MK_REV++;
    return { ok: 1, e, price, where };
  },
  sell(e) {
    if (!MK_HERO.ok()) return { err: 'hero' };
    e = mkFixE(e); if (!e || e.t === 'gold') return { err: 'data' };
    const g = mkQuote(e); MK_HERO.earn(g); mkVol(g); MK_REV++;
    return { ok: 1, gold: g };
  },
  auction(e, start, bo, hours) {
    const M = mkM(); if (!M) return { err: 'data' }; mkEnsure();
    e = mkFixE(e); if (!e || e.t === 'gold') return { err: 'data' };
    if (M.own.length >= mkSlots()) return { err: 'slots' };
    if (!MK_DUR.includes(hours)) return { err: 'dur' };
    start = Math.floor(+start); bo = Math.floor(+bo) || 0;
    if (!(start >= 1 && start <= 1e9)) return { err: 'start' };
    if (bo <= start || bo > 1e10) bo = 0;
    const now = mkNow(), D = hours * MK_H, A = { id: uid(), e, own: 1, t0: now, t1: now + D, d: D, start, bo, bids: [], bd: [], rs: (mkRng(M)() * 4294967296) | 0, me: 0, s: 0, ext: 0, done: 0 };
    mkBidders(A, Math.max(1, lootValue(e))); M.own.push(A); MK_REV++;
    return { ok: 1, id: A.id };
  },
  bid(id, amt) {
    if (!MK_HERO.ok()) return { err: 'hero' };
    const M = mkM(), now = mkNow(), ev = mkTick(now), A = M.auc.find(x => x.id === id);
    if (!A || A.done || now >= A.t1) return { err: 'over', ev };
    const top = mkTop(A); if (top && top[1] === -1) return { err: 'lead', ev };
    amt = Math.floor(+amt); const need = mkMinBid(A);
    if (!(amt >= need) || amt > 1e10) return { err: 'low', need, ev };
    if (A.bo && amt >= A.bo) { const r = MARKET.buyout(id); r.ev = ev.concat(r.ev || []); return r; }
    if (MK_HERO.gold() < amt) return { err: 'gold', ev };
    MK_HERO.pay(amt); A.me = 1; mkBid(A, now, -1, amt, ev);
    return { ok: 1, ev };
  },
  buyout(id) {
    if (!MK_HERO.ok()) return { err: 'hero' };
    const M = mkM(), now = mkNow(), A = M.auc.find(x => x.id === id);
    if (!A || A.done || !A.bo || now >= A.t1 || (mkTop(A) && mkTop(A)[2] >= A.bo)) return { err: 'over' };
    const top = mkTop(A), cost = A.bo - (top && top[1] === -1 ? top[2] : 0);
    if (MK_HERO.gold() < cost) return { err: 'gold' };
    const c = MK_HERO.can(A.e); if (c) return { err: c };
    MK_HERO.pay(cost); A.me = 1; const ev = [];
    mkBid(A, now, -1, A.bo, ev); mkEnd(A, ev, now);
    for (const x of ev) mkLog(x);
    const i = M.box.findIndex(x => x.w === 'won' && x.e === A.e), r = i >= 0 ? MARKET.claim(i) : null;   // gleich mitnehmen
    M.auc = M.auc.filter(x => x !== A); M.spawn.push(Math.round(now + MK_MIN + Math.random() * 10 * MK_MIN));
    return { ok: 1, e: A.e, price: A.bo, where: r && r.ok ? r.where : 'box', ev: [] };
  },
  cancel(id) {
    const M = mkM(), A = M && M.own.find(x => x.id === id); if (!A || A.done) return { err: 'gone' };
    if (A.bids.length) return { err: 'bids' };
    M.own = M.own.filter(x => x !== A); MK_REV++;
    const where = MK_HERO.ok() && !MK_HERO.can(A.e) ? MK_HERO.give(A.e) : null; if (!where) mkBoxAdd(A.e, 'back', mkNow());
    return { ok: 1, e: A.e, where: where || 'box' };
  },
  claim(i) {
    const M = mkM(); if (!M) return { err: 'gone' };
    if (i === 'all') { let n = 0, err = null; for (let k = M.box.length - 1; k >= 0; k--) { const r = MARKET.claim(k); if (r.ok) n++; else err = err || r.err; } return n ? { ok: 1, n, err } : { err: err || 'gone' }; }
    const x = M.box[i]; if (!x) return { err: 'gone' }; if (!MK_HERO.ok()) return { err: 'hero' };
    const c = MK_HERO.can(x.e); if (c) return { err: c };
    const where = MK_HERO.give(mkClone(x.e)); if (!where) return { err: x.e.t === 'egg' ? 'nest' : 'full' };
    M.box.splice(i, 1); MK_REV++;
    return { ok: 1, e: x.e, where };
  }
};

/* ---------- Anzeige ---------- */
function mkPartName(k) { if (typeof trPartName === 'function') { try { return trPartName(k); } catch (_) { } } return k; }
function mkPartIcon(k) { if (typeof trPartIcon === 'function') { try { return trPartIcon(k); } catch (_) { } } return iconURL(['pa', 'muenze']); }
function mkEggName(d) {
  try { if (typeof petLabel === 'function') { const s = petLabel(Object.assign({}, d, { egg: 1 })); if (typeof s === 'string' && s) return s; } } catch (_) { }
  return _t('Ei: {sp}', { sp: typeof trSpName === 'function' ? trSpName(d.sp) : d.sp });
}
function mkEggIcon(d) {
  try { if (typeof petIconURL === 'function') { const u = petIconURL(Object.assign({}, d, { egg: 1 })); if (typeof u === 'string' && u.startsWith('data:')) return u; } } catch (_) { }
  return typeof trEggIcon === 'function' ? trEggIcon(d.sp) : iconURL(['pa', 'muenze']);
}
function mkName(e) {
  if (!mkO(e)) return '?';
  const x = e.n > 1 ? e.n + '× ' : '';
  switch (e.t) {
    case 'item': return itemName(e.it);
    case 'mat': return x + MATS[e.k].n;
    case 'gem': { const [id, gr] = e.k.split(':'); return x + _t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[id].n }); }
    case 'part': return x + mkPartName(e.k);
    case 'mod': return x + (mkModOk(e.k) ? modName(e.k) : '?');
    case 'egg': return mkEggName(e.d);
    case 'gold': return _t('{n} Gold', { n: mkG(e.n) });
  }
  return '?';
}
function mkCol(e) {
  switch (e.t) {
    case 'item': return itemColor(e.it);
    case 'mat': return MATS[e.k].c;
    case 'gem': return GEMS[e.k.split(':')[0]].c;
    case 'part': { const a = e.k.split(':'), g = +a[a.length - 1]; return typeof gradeCol === 'function' ? gradeCol(g) : '#c8c8c8'; }
    case 'mod': return mkModOk(e.k) ? modCol(e.k) : '#c8c8c8';
    case 'egg': return mkTierInfo(mkEggTier(e.d).t).c || '#efe2bf';
  }
  return '#e8b04a';
}
function mkIcon(e) {
  switch (e.t) {
    case 'item': return itemIconURL(e.it);
    case 'mat': return iconURL(['mat', e.k]);
    case 'gem': { const [id, gr] = e.k.split(':'); return iconURL(['gem', id, +gr]); }
    case 'part': return mkPartIcon(e.k);
    case 'mod': return mkModOk(e.k) ? modIconURL(e.k) : iconURL(['pa', 'muenze']);
    case 'egg': return mkEggIcon(e.d);
  }
  return iconURL(['pa', 'muenze']);
}
function mkSub(e) {
  switch (e.t) {
    case 'item': return RAR[e.it.rar].n + ' ' + (e.it.slot === 'weapon' ? WT[e.it.base].label : AR[e.it.slot].label) + ' · ' + MAT[e.it.tier].n;
    case 'mat': return _t('Material');
    case 'gem': { const [id, gr] = e.k.split(':'); return GEMS[id].s(GEMS[id].v[+gr]); }
    case 'part': return _t('Bauteil für die Schmiede');
    case 'mod': return mkModOk(e.k) ? MOD_FAM[modParse(e.k).f].n : _t('Mod');
    case 'egg': return mkTierInfo(mkEggTier(e.d).t).n || _t('Begleiter-Ei');
  }
  return '';
}
function mkLines(e) {
  const L = [], u = mkUnit(e), n = mkPer(e);
  if (e.t === 'part') { const a = e.k.split(':'), g = +a[a.length - 1]; if (typeof pdesc === 'function') { try { const s = pdesc(a[0], g, a.length > 2 ? a[1] : null); if (s) L.push(s); } catch (_) { } } }
  if (e.t === 'gem') L.push(mkSub(e));
  if (e.t === 'mod' && mkModOk(e.k)) L.push(modDesc(e.k));
  if (e.t === 'egg') L.push(_t('Kommt in dein Brutnest. Gut gepflegt schlüpft daraus ein Begleiter.'));
  if (n > 1) L.push(_t('Marktwert: {n} Gold je Stück', { n: mkG(u) }), _t('Zusammen: {n} Gold', { n: mkG(lootValue(e)) }));
  else L.push(_t('Marktwert: {n} Gold', { n: mkG(lootValue(e)) }));
  return L;
}
function mkDetail(e) {
  if (e.t === 'item') return itemDetail(e.it, '');
  const c = mkCol(e);
  return `<div class="detail"><div style="display:flex;gap:10px;align-items:center"><div class="ic big" style="box-shadow:inset 0 0 0 2px ${c}"><img src="${mkIcon(e)}" alt=""></div><div><div class="nm" style="color:${c}">${esc(mkName(e))}</div><div class="st" style="color:var(--parch-dim);font-size:16px">${esc(mkSub(e))}</div></div></div><ul>${mkLines(e).map(l => '<li>' + esc(l) + '</li>').join('')}</ul></div>`;
}
function mkLeft(ms) {
  if (ms <= 0) return _t('endet …');
  const s = Math.ceil(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  if (d) return _t('{d} T. {h} Std.', { d, h });
  if (h) return _t('{h} Std. {m} Min.', { h, m });
  return m + ':' + String(s % 60).padStart(2, '0');
}
// kurz für Listen: 1 T. 3 Std. · 4:39 Std. · 12:05
function mkLeftS(ms) { if (ms <= 0) return _t('endet …'); const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; if (h >= 24) return _t('{d} T. {h} Std.', { d: Math.floor(h / 24), h: h % 24 }); if (h) return _t('{h}:{m} Std.', { h, m: String(m).padStart(2, '0') }); return m + ':' + String(s % 60).padStart(2, '0'); }
const mkClock = ms => { if (ms <= 0) return _t('endet …'); const s = Math.ceil(ms / 1000); return s >= 86400 ? mkLeft(ms) : Math.floor(s / 3600) + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const mkCdCls = ms => ms < MK_MIN ? ' mk-last' : ms < 5 * MK_MIN ? ' mk-soon' : '';
function mkAgo(ms) { const m = Math.floor(ms / MK_MIN); return m < 1 ? _t('gerade eben') : m < 60 ? _t('vor {n} Min.', { n: m }) : m < 1440 ? _t('vor {n} Std.', { n: Math.floor(m / 60) }) : _t('vor {n} T.', { n: Math.floor(m / 1440) }); }
const mkBids = (n, b) => b === 1 ? _t('{n} Gold · 1 Gebot', { n: mkG(n) }) : _t('{n} Gold · {b} Gebote', { n: mkG(n), b });
const mkWho = w => w === -1 ? _t('Du') : MK_NAMES[w] ? MK_NAMES[w][0] : '?';
function mkChart(e) {
  const H = mkHist(e), u = mkUnit(e), mx = Math.max(u, ...H.map(h => h[1])) || 1, avg = H.reduce((a, h) => a + h[1], 0) / H.length;
  return `<div class="mk-bars" role="img" aria-label="${_t('PREISVERLAUF')}">${H.map((h, i) => `<i style="height:${Math.max(4, Math.round(h[1] / mx * 100))}%"${i === H.length - 1 ? ' class="last"' : ''}></i>`).join('')}<u style="bottom:${Math.round(4 + u / mx * 32)}px"></u></div><div class="mk-cap">${_t('PREISVERLAUF')} · ${_t('Ø {n} GOLD', { n: mkPrice(avg) })}${mkPer(e) > 1 ? ' ' + _t('JE STÜCK') : ''} · <span style="color:var(--moss)">${_t('- - MARKTWERT')}</span></div>`;
}
// kurze Zeile: Seltenheit/Art · Wert · ▲ besser als die angelegte Ausrüstung
function mkShort(e) {
  let s = e.t === 'item' ? RAR[e.it.rar].n : e.t === 'gem' ? _t('Edelstein') : e.t === 'part' ? _t('Bauteil') : mkSub(e);
  s = esc(s) + ' · ' + _t('Wert {n}', { n: mkPrice(lootValue(e)) });
  if (e.t === 'item' && P && P.gear && canEquip(e.it) && P.gear[e.it.slot]) { const d = itemScore(e.it) / Math.max(1, itemScore(P.gear[e.it.slot])) - 1; if (d > .02) s += ' <span style="color:var(--moss)" title="+' + Math.round(d * 100) + ' %">▲</span>'; }
  return s;
}
const mkPrice = n => n >= 100000 ? fmt(n) : mkG(n);
function mkRow(e, right, o) {
  const c = mkCol(e), act = o.act ? ` data-act="${o.act}" data-id="${esc(o.id)}" role="button" tabindex="0"` : ' style="cursor:default"';
  return `<div class="row mk-r${o.sel ? ' sel' : ''}${o.dim ? ' mk-dim' : ''}${o.cls || ''}"${act}><div class="ic" style="box-shadow:inset 0 0 0 2px ${c}"><img src="${mkIcon(e)}" alt=""></div><div><div class="nm" style="color:${c}">${esc(mkName(e))}</div><div class="st">${o.st != null ? o.st : mkShort(e)}</div></div>${right || '<span></span>'}</div>`;
}

/* ---------- Meldungen: überboten, verkauft, ersteigert ---------- */
const MK_Q = []; let mkQT = 0;
function mkToastQ(m) { MK_Q.push(m); if (!mkQT) mkQNext(); }
function mkQNext() { const m = MK_Q.shift(); if (!m) { mkQT = 0; return; } toast(m.txt, m.c); if (m.s) sfx(m.s); if (m.bz && typeof buzz === 'function' && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) buzz(m.bz); mkQT = setTimeout(mkQNext, 2300); }
function mkEvText(k, item, who, n) {
  const a = { item, name: who, n: mkG(n) };
  switch (k) {
    case 'outbid': return [_t('Du wurdest überboten! {item}: {name} bietet {n} Gold.', a), '#ff6a5a', 'deny'];
    case 'won': return [_t('Zuschlag! {item} für {n} Gold ersteigert – im Abholfach.', a), '#ffd24a', 'loot'];
    case 'sold': return [_t('Verkauft! {item} an {name} für {n} Gold.', a), '#ffd24a', 'buy'];
    case 'unsold': return [_t('Nicht verkauft: {item} – liegt im Abholfach.', a), '#efe2bf', 'click'];
    case 'bid': return [_t('Neues Gebot auf {item}: {n} Gold von {name}.', a), '#79c24e', 'coin'];
    case 'lost': return [_t('Versteigerung verloren: {item} ging für {n} Gold an {name}.', a), '#a8997e', 'click'];
  }
  return ['', '', ''];
}
function mkNotify(ev) {
  const pr = { won: 0, sold: 1, outbid: 2, unsold: 3, lost: 4, bid: 5 }, seen = new Set(), U = [];
  for (let i = ev.length - 1; i >= 0; i--) { const e = ev[i], k = e.k + e.id; if (seen.has(k) || !(e.k in pr)) continue; seen.add(k); U.push(e); }   // je Versteigerung nur die neueste Meldung
  U.sort((a, b) => pr[a.k] - pr[b.k]);
  for (const e of U.slice(0, 3)) { const [txt, c, s] = mkEvText(e.k, mkName(e.e), e.who != null ? mkWho(e.who) : '', e.n); mkToastQ({ txt, c, s, bz: e.k === 'outbid' ? 70 : e.k === 'won' || e.k === 'sold' ? 30 : 0 }); }
  if (U.length > 3) mkToastQ({ txt: _t('Basar: {n} weitere Neuigkeiten – siehe MEINE.', { n: U.length - 3 }), c: '#ffd24a' });
  if (panel.querySelector('.mk') && !ov.hidden) {
    const now = mkNow(); for (const e of ev) MK.fl[e.id] = now;
    const z = U.find(e => e.k === 'won' || e.k === 'sold');   // großer Stempel in der offenen Tafel
    if (z) MK.stamp = { txt: (z.k === 'won' ? _t('ZUSCHLAG!') : _t('VERKAUFT!')) + ' ' + mkName(z.e) + ' · ' + _t('{n} Gold', { n: mkG(z.n) }), until: performance.now() + 4500 };
  }
}
function mkLog(e) {
  const M = mkM();
  M.log.unshift({ k: e.k, t: e.t, i: String(mkName(e.e)).replace(/[<>]/g, '').slice(0, 60), n: e.n || 0, b: e.who != null && e.who >= 0 && MK_NAMES[e.who] ? MK_NAMES[e.who][0] : '' });
  if (M.log.length > 40) M.log.length = 40;
  if (e.k !== 'bid') M.unseen = Math.min(999, M.unseen + 1);
}
function mkPoll() {
  try {
    const M = mkM(); if (!M || !M.init || (!ov.hidden && panel.querySelector('.mk'))) return;   // die offene Basar-Tafel tickt selbst
    const ev = mkTick(); if (ev.length) { persist(); mkNotify(ev); }
  } catch (e) { console.error('Basar:', e); }
}
setInterval(mkPoll, 10000);
HOOK.boot.push(() => {
  try { const M = mkM(); if (!M || !M.init) return; const ev = mkTick(); persist(); if (ev.length) setTimeout(() => mkNotify(ev), 1600); }
  catch (e) { console.error('Basar (Start):', e); }
});

/* ---------- Oberfläche ---------- */
const MK = { from: 'hide', tab: 'buy', cat: 'item', sel: null, n: 1, amt: 0, amtFor: null, set: null, conf: 0, tm: 0, k: 0, fl: {}, back: null, stamp: null, op: 0, guard: 0 };
function mkErr(r) {
  return {
    gold: _t('Zu wenig Gold.'), full: _t('Beutel und Lager sind voll. Mach zuerst Platz.'), nest: _t('Dein Brutnest ist voll.'), pets: _t('Eier kann diese Version noch nicht annehmen.'),
    gone: _t('Das ist nicht mehr da.'), over: _t('Diese Versteigerung ist schon vorbei.'), lead: _t('Du hast schon das höchste Gebot.'), low: _t('Das Gebot ist zu niedrig.'),
    slots: _t('Alle Auktionsplätze sind belegt. Ein höherer Handelsrang bringt mehr.'), hero: _t('Wähle zuerst einen Helden.'), bids: _t('Es gibt schon Gebote – die Versteigerung läuft bis zum Ende.')
  }[r && r.err] || _t('Das hat nicht geklappt.');
}
function mkWhere(w, item) {
  return { bag: _t('{item} liegt im Beutel.', { item }), stash: _t('Beutel voll – {item} liegt im Lager.', { item }), nest: _t('{item} liegt im Brutnest.', { item }), box: _t('{item} liegt im Abholfach.', { item }) }[w] || _t('{item} ist in deinem Vorrat.', { item });
}
// Gold aus dem Abholfach (Erlöse, zurückgezahlte Gebote) geht beim Öffnen gleich an den Helden
function mkAutoGold() {
  const M = mkM(); if (!M || !MK_HERO.ok()) return 0;
  let g = 0; M.box = M.box.filter(x => { if (x.e.t !== 'gold') return true; g += x.e.n; return false; });
  if (g) { P.gold += g; MK_REV++; mkToastQ({ txt: _t('+{n} Gold aus dem Abholfach', { n: mkG(g) }), c: '#ffd24a', s: 'coin' }); }
  return g;
}
function mkOpen(from) {
  if (!MK_HERO.ok() || !mkM()) return;
  if (from) MK.from = from;
  if (state === 'map') setState('menu');   // sonst baut Drehen des Handys die Karte neu auf
  MK.tab = 'buy'; MK.sel = null; MK.set = null; MK.conf = 0; MK.fl = {}; MK.op = from === 'hide' ? performance.now() : 0;
  // Geister-Tipp: der Finger auf dem Interagieren-Knopf im Versteck darf nicht gleich etwas im Basar antippen
  if (!MK.guard) { MK.guard = 1; panel.addEventListener('click', e => { if (performance.now() - MK.op < 350 && panel.querySelector('.mk')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true); }
  mkEnsure(); const ev = mkTick(); if (ev.length) mkNotify(ev); mkAutoGold(); mkM().unseen = 0; saveChar();
  mkShow(); mkLive();
}
function mkClose() {
  if (MK.tm) { clearInterval(MK.tm); MK.tm = 0; }
  MK.set = null; MK.sel = null;
  if (MK.from === 'map') { setState('map'); showMapMore(); } else if (MK.from === 'char') { selItem = MK.back; openChar(); } else backToHide();
}
function mkLive() {
  if (MK.tm) return;
  MK.tm = setInterval(() => {
    try {
      if (ov.hidden || !panel.querySelector('.mk')) { clearInterval(MK.tm); MK.tm = 0; return; }
      const now = mkNow();
      for (const el of panel.querySelectorAll('[data-mkend]')) { const left = +el.dataset.mkend - now; el.textContent = el.dataset.mks === '2' ? mkClock(left) : el.dataset.mks ? mkLeftS(left) : mkLeft(left); el.classList.toggle('mk-soon', left < 5 * MK_MIN && left >= MK_MIN); el.classList.toggle('mk-last', left < MK_MIN); }
      if (++MK.k % 2) return;
      const rev = MK_REV, ev = mkTick(now), S = mkM().shop[P.id], due = MK.tab === 'buy' && S && now >= S.nx;
      if (ev.length) { mkNotify(ev); mkAutoGold(); }
      const st = MK.stamp && performance.now() > MK.stamp.until; if (st) MK.stamp = null;
      if (ev.length || rev !== MK_REV || due || st) { persist(); mkShow(); }
    } catch (e) { console.error('Basar:', e); }
  }, 1000);
}
function mkShow() {
  if (!MK_HERO.ok()) return;
  if (MK.set) return mkSetupShow();
  const M = mkM(), now = mkNow(), out = M.auc.filter(A => A.me && !A.done && !(mkTop(A) && mkTop(A)[1] === -1)).length;
  // Zähler per CSS (data-b): der Reitertext bleibt gleich, so springt die Liste beim Neuzeichnen nicht nach oben
  const tab = (k, l, b, red) => `<button class="tab${red ? '' : ' mk-gb'}" role="tab" aria-selected="${MK.tab === k}" data-act="mk_tab" data-id="${k}"${b ? ` data-b="${b}"` : ''}>${l}</button>`;
  let body = '';
  if (MK.tab === 'buy') body = mkBuyHTML(now); else if (MK.tab === 'sell') body = mkSellHTML(); else if (MK.tab === 'bid') body = mkBidHTML(now); else body = mkMineHTML(now);
  const box = M.box.length && MK.tab !== 'mine' ? `<button class="mk-box" data-act="mk_tab" data-id="mine"><img src="${mkIcon(M.box[0].e)}" alt=""><span><b>${_t('ABHOLFACH')}</b>${M.box.length === 1 ? _t('1 Sache wartet auf dich – antippen zum Abholen.') : _t('{n} Sachen warten auf dich – antippen zum Abholen.', { n: M.box.length })}</span></button>` : '';
  const fr = mkFrozen(), frz = fr > MK_MIN ? `<p class="sub mk-bad">${_t('Die Uhr deines Geräts wurde zurückgestellt. Der Basar wartet, bis sie wieder stimmt (noch {t}).', { t: mkLeft(fr) })}</p>` : '';
  showOverlay(`<div class="head"><h2>${_t('BASAR')}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div><button class="btn alt sm" data-act="mk_back">${_t('Zurück')}</button></div></div>
  <div class="mk"><div class="tabs" role="tablist">${tab('buy', _t('KAUFEN'))}${tab('sell', _t('VERKAUFEN'))}${tab('bid', _t('BIETEN'), out ? '!' : 0, 1)}${tab('mine', _t('MEINE'), M.box.length)}</div>${frz}${MK.stamp && performance.now() < MK.stamp.until ? `<div class="mk-zu">${esc(MK.stamp.txt)}</div>` : ''}${box}${body}</div>`, true);
  for (const id in MK.fl) if (now - MK.fl[id] > 2500) delete MK.fl[id];
}
const mkFlash = id => MK.fl[id] ? ' mk-new' : '';
function mkSheet(inner) { return `<div class="side sheet"><button class="btn alt sm sheetx" data-act="mk_sel" data-id="" aria-label="${_t('Schließen')}"><span class="x">×</span></button>${inner}</div>`; }
function mkHint(t) { return `<div class="side"><p class="sub" style="margin-top:0">${t}</p></div>`; }

// KAUFEN: Händlerware mit festem Preis
function mkBuyHTML(now) {
  const L = mkShop(), S = mkM().shop[P.id], sel = L.find(o => o.id === MK.sel);
  const rows = L.map(o => {
    const p = mkOfferPrice(o), deal = o.f < 1;
    const right = o.n > 0 ? `<div class="mk-p"><button class="btn sm" data-act="mk_buy" data-id="${o.id}" ${P.gold >= p ? '' : 'disabled'}><i class="coin"></i>${mkPrice(p)}</button>${deal ? `<span class="mk-pill deal">${_t('SCHNÄPPCHEN')}</span>` : o.n > 1 ? `<small>${_t('noch {n}', { n: o.n })}</small>` : ''}</div>` : `<div class="mk-p"><span class="mk-sold">${_t('AUSVERKAUFT')}</span></div>`;
    return mkRow(o.e, right, { act: 'mk_sel', id: o.id, sel: o === sel, dim: o.n <= 0 });
  }).join('');
  let side = mkHint(_t('Tippe ein Angebot an, um es genau anzusehen. Gekauftes kommt in den Beutel – ist er voll, ins Lager.'));
  if (sel) { const p = mkOfferPrice(sel); side = mkSheet(`<div class="mk-act">${sel.n > 0 ? `<button class="btn" data-act="mk_buy" data-id="${sel.id}" ${P.gold >= p ? '' : 'disabled'}>${_t('Kaufen')} <i class="coin"></i>${mkG(p)}</button>` : `<button class="btn" disabled>${_t('AUSVERKAUFT')}</button>`}</div>${P.gold < p && sel.n > 0 ? `<p class="sub mk-bad" style="margin:0 0 6px">${_t('Dir fehlen {n} Gold.', { n: mkG(p - P.gold) })}</p>` : ''}${mkDetail(sel.e)}${sel.e.t === 'item' ? compareHTML(sel.e.it) : ''}${mkChart(sel.e)}`); }
  return `${npcLine('basar')}<p class="sub mk-l">${_t('Nächste Lieferung in {t}', { t: `<b data-mkend="${S.nx}">${mkLeft(S.nx - now)}</b>` })} · ${_t('Nur solange der Vorrat reicht.')}</p><div class="split"><div>${rows}</div>${side}</div>`;
}
// VERKAUFEN: sofort an Hedda oder versteigern
function mkCats() {
  const c = [['item', _t('GEGENSTÄNDE'), P.bag.length]], n = (o, ok) => Object.keys(o || {}).filter(k => o[k] > 0 && ok(k)).length;
  const m = n(P.mats, k => mkHas(MK_MATV, k)), g = n(P.gems, k => mkGemV(k) > 0), p = n(P.parts, mkPartOk), x = n(P.mods, mkModOk), e = typeof eggExport === 'function' ? mkEggs().length : 0;
  if (m) c.push(['mat', _t('MATERIAL'), m]); if (g) c.push(['gem', _t('EDELSTEINE'), g]); if (p) c.push(['part', _t('BAUTEILE'), p]); if (x) c.push(['mod', _t('MODS'), x]); if (e) c.push(['egg', _t('EIER'), e]);
  return c;
}
function mkSrc() {
  const s = MK.sel; if (!s) return null;
  if (MK.cat === 'item') { const it = P.bag.find(x => x.uid === s); return it ? { src: { t: 'item', uid: s }, e: { t: 'item', it }, have: 1 } : null; }
  const k = s.slice(s.indexOf(':') + 1);
  if (MK.cat === 'egg') { const d = mkEggs()[+k]; return d && mkSpOk(d.sp) ? { src: { t: 'egg', i: +k }, e: { t: 'egg', d: Object.assign({}, d, { egg: 1 }) }, have: 1 } : null; }
  const o = MK.cat === 'mat' ? P.mats : MK.cat === 'gem' ? P.gems : MK.cat === 'mod' ? P.mods : P.parts, have = (o && o[k]) || 0, ok = MK.cat === 'mat' ? mkHas(MK_MATV, k) : MK.cat === 'gem' ? mkGemV(k) > 0 : MK.cat === 'mod' ? mkModOk(k) : mkPartOk(k);
  if (!ok || have < 1) return null;
  const n = clamp(MK.n, 1, have); return { src: { t: MK.cat, k, n }, e: { t: MK.cat, k, n }, have };
}
const mkBulk = () => P.bag.filter(it => it.rar <= 1 && !it.gems.length && !it.up && !it.fz && !it.mw && !it.skin && !it.set && !it.myth && !(Array.isArray(it.mods) && it.mods.length));
function mkSellHTML() {
  const cats = mkCats(); if (!cats.some(c => c[0] === MK.cat)) MK.cat = 'item';
  const S = mkSrc(); if (MK.sel && !S) MK.sel = null;
  let h = `<p class="sub mk-l">${_t('Sofort verkaufen bringt Gold auf die Hand. Versteigern bringt meist mehr – dauert aber.')}</p><div class="opts">${cats.map(c => `<button class="opt${MK.cat === c[0] ? ' sel' : ''}" data-act="mk_cat" data-id="${c[0]}">${c[1]}<small>${c[2]}</small></button>`).join('')}</div>`, list = '';
  if (MK.cat === 'item') {
    const B = mkBulk(), bg = B.reduce((a, it) => a + mkQuote({ t: 'item', it }), 0);
    list = `<div class="box"><h3 style="margin-top:0">${_t('BEUTEL {n}/30', { n: P.bag.length })}</h3><div class="grid">${P.bag.map(it => itemSlot(it, 'mk_sel', it.uid === MK.sel)).join('') || `<p class="sub">${_t('Leer')}</p>`}</div></div>`
      + (B.length ? `<button class="btn alt" data-act="mk_bulk" style="width:100%;margin-top:8px;min-height:44px">${MK.conf === 'bulk' ? _t('Sicher? {n} Gegenstände für {g} Gold', { n: B.length, g: mkG(bg) }) : _t('Gewöhnliche & Magische sofort verkaufen ({g} Gold)', { g: mkG(bg) })}</button>` : '');
  } else {
    const rows = [];
    if (MK.cat === 'mat') for (const k of MATORDER) { if ((P.mats[k] || 0) > 0) rows.push([k, { t: 'mat', k, n: P.mats[k] }]); }
    else if (MK.cat === 'gem') { for (const id of GEMORDER) for (let gr = 0; gr < 5; gr++) { const k = id + ':' + gr; if ((P.gems[k] || 0) > 0) rows.push([k, { t: 'gem', k, n: P.gems[k] }]); } }
    else if (MK.cat === 'part') { for (const k of Object.keys(P.parts || {}).sort()) if (P.parts[k] > 0 && mkPartOk(k)) rows.push([k, { t: 'part', k, n: P.parts[k] }]); }
    else if (MK.cat === 'mod') { for (const k of (typeof modStock === 'function' ? modStock() : [])) if (mkModOk(k)) rows.push([k, { t: 'mod', k, n: P.mods[k] }]); }
    else mkEggs().forEach((d, i) => { if (mkSpOk(d.sp)) rows.push([String(i), { t: 'egg', d: Object.assign({}, d, { egg: 1 }) }]); });
    list = rows.map(([k, e]) => mkRow(e, `<div class="mk-p"><small>${_t('je {n}', { n: fmt(mkUnit(e)) })}</small></div>`, { act: 'mk_sel', id: MK.cat + ':' + k, sel: MK.sel === MK.cat + ':' + k, st: e.t === 'egg' ? esc(mkSub(e)) : _t('{n} Stück · Wert {v}', { n: e.n, v: fmt(lootValue(e)) }) })).join('');
  }
  let side = mkHint(_t('Wähle aus, was du loswerden willst. Angelegte Ausrüstung bleibt bei dir.'));
  if (S) {
    const q = mkQuote(S.e);
    const amt = S.have > 1 ? `<div class="mk-amt"><button class="btn alt" data-act="mk_n" data-id="-10">−10</button><button class="btn alt" data-act="mk_n" data-id="-1">−</button><b>${S.e.n}<small>${_t('von {n}', { n: S.have })}</small></b><button class="btn alt" data-act="mk_n" data-id="1">+</button><button class="btn alt" data-act="mk_n" data-id="10">+10</button></div>` : '';
    side = mkSheet(`${amt}<div class="mk-act"><button class="btn${MK.conf === 'sell' ? ' red' : ''}" data-act="mk_sell">${MK.conf === 'sell' ? _t('Wirklich? Für') : _t('Sofort verkaufen')} <i class="coin"></i>${mkG(q)}</button><button class="btn alt" data-act="mk_set">${_t('Versteigern …')}</button></div>${mkDetail(S.e)}${mkChart(S.e)}`);
  }
  return h + `<div class="split"><div>${list}</div>${side}</div>`;
}
// Einstellen: Startpreis, Sofortkauf, Dauer – mit Schätzung
function mkSetupShow() {
  const S = mkSrc(); if (!S) { MK.set = null; return mkShow(); }
  const st = MK.set, e = S.e, V = Math.max(1, lootValue(e)), start = Math.max(1, mkNice(V * st.sp / 100)), bo = st.bp ? mkNice(V * st.bp / 100) : 0, est = mkEst(e, start, bo, st.h), fee = mkFee(), M = mkM(), free = mkSlots() - M.own.length;
  const opt = (act, v, on, l, s) => `<button class="opt${on ? ' sel' : ''}" data-act="${act}" data-id="${v}">${l}<small>${s || '–'}</small></button>`, row = (n, h) => `<div class="opts mk-g" style="--n:${n}">${h}</div>`;
  showOverlay(`<div class="head"><h2>${_t('VERSTEIGERN')}</h2><div class="hbtns"><button class="btn alt sm" data-act="mk_setx">${_t('Zurück')}</button></div></div>
  <div class="mk">${mkRow(e, `<div class="mk-p"><small>${_t('Marktwert')}</small><b style="font-weight:400;color:var(--gold)">${mkG(V)}</b></div>`, { st: esc(mkSub(e)) })}
  <h3>${_t('STARTPREIS')}</h3>${row(5, [25, 50, 75, 100, 125].map(p => opt('mk_sp', p, st.sp === p, _t('{n} %', { n: p }), mkPrice(mkNice(V * p / 100)))).join(''))}
  <p class="sub" style="margin-top:0">${_t('Ein niedriger Start lockt mehr Bieter – mit wenigen Bietern bleibt der Preis aber niedrig.')}</p>
  <h3>${_t('SOFORTKAUF')}</h3>${row(4, [0, 130, 160, 200].map(p => opt('mk_bp', p, st.bp === p, p ? _t('{n} %', { n: p }) : _t('AUS'), p ? mkPrice(mkNice(V * p / 100)) : '')).join(''))}
  <h3>${_t('DAUER')}</h3>${row(4, MK_DUR.map(h => opt('mk_h', h, st.h === h, _t('{n} STD.', { n: h }), h === 1 ? _t('wenige') : h === 24 ? _t('viele') : '')).join(''))}
  <div class="detail mk-est">${est.p > 0 ? _t('Verkaufschance etwa {p} % · üblicher Erlös {lo}–{hi} Gold (nach {fee} % Gebühr).', { p: `<b>${Math.round(est.p * 100)}</b>`, lo: `<b>${mkG(est.lo)}</b>`, hi: `<b>${mkG(est.hi)}</b>`, fee: mkPct(fee) }) : _t('So teuer will das wohl niemand – senk den Startpreis.')}</div>
  <p class="sub">${_t('Längere Versteigerungen finden mehr Bieter. Die Gebühr zahlst du nur, wenn verkauft wird. Unverkauftes kommt ins Abholfach zurück.')}</p></div>
  <div class="foot"><button class="btn" data-act="mk_go" style="width:100%;min-height:44px" ${free > 0 ? '' : 'disabled'}>${free > 0 ? _t('Versteigerung starten') : _t('Alle {n} Auktionsplätze belegt', { n: mkSlots() })}</button></div>`, true);
}
// BIETEN: Versteigerungen der Händler
function mkBidHTML(now) {
  const L = MARKET.listings('auc'), sel = L.find(A => A.id === MK.sel);
  const rows = L.map(A => {
    const top = mkTop(A), me = top && top[1] === -1, out = A.me && !me;
    const st = top ? mkBids(top[2], A.bids.length) : _t('Start {n} Gold · noch kein Gebot', { n: mkG(A.start) });
    const pill = me ? `<span class="mk-pill lead">${_t('DU FÜHRST')}</span>` : out ? `<span class="mk-pill out">${_t('ÜBERBOTEN')}</span>` : A.ext ? `<span class="mk-pill ext">${_t('VERLÄNGERT')}</span>` : A.bo ? `<small>${_t('Sofort {n}', { n: fmt(A.bo) })}</small>` : '';
    return mkRow(A.e, `<div class="mk-p"><span class="mk-cd${mkCdCls(A.t1 - now)}" data-mkend="${A.t1}" data-mks="1">${mkLeftS(A.t1 - now)}</span>${pill}</div>`, { act: 'mk_sel', id: A.id, sel: A === sel, st, cls: mkFlash(A.id) });
  }).join('') || `<p class="sub">${_t('Gerade läuft keine Versteigerung. Schau gleich noch mal vorbei.')}</p>`;
  return `<p class="sub mk-l">${_t('Biete gegen andere Händler. Dein Gebot wird reserviert – wirst du überboten, bekommst du es zurück.')}</p><div class="split"><div>${rows}</div>${sel ? mkSheet(mkBidSide(sel, now)) : mkHint(_t('Tippe eine Versteigerung an, um zu bieten. Kurz vor Schluss wird oft noch geboten – dann verlängert sich die Zeit.'))}</div>`;
}
function mkBidSide(A, now) {
  const top = mkTop(A), need = mkMinBid(A), me = top && top[1] === -1, V = lootValue(A.e);
  if (MK.amtFor !== A.id || MK.amt < need) { MK.amt = need; MK.amtFor = A.id; }
  const boCost = A.bo ? A.bo - (me ? top[2] : 0) : 0;
  let h = `<div class="mk-bidbox"><div class="mk-big"><span class="${mkCdCls(A.t1 - now).trim()}" data-mkend="${A.t1}" data-mks="2">${mkClock(A.t1 - now)}</span>${A.ext ? `<span class="mk-pill ext">${_t('VERLÄNGERT')}</span>` : ''}</div>
  <div class="mk-now">${me ? _t('Dein Gebot: {n} Gold', { n: `<b style="color:var(--moss);font-weight:400">${mkG(top[2])}</b>` }) : top ? _t('Höchstgebot {n} Gold von {name}', { n: `<b style="color:var(--gold);font-weight:400">${mkG(top[2])}</b>`, name: esc(mkWho(top[1])) }) : _t('Startpreis {n} Gold – noch kein Gebot', { n: `<b style="color:var(--gold);font-weight:400">${mkG(A.start)}</b>` })} · ${_t('Marktwert {n}', { n: mkG(V) })}</div>`;
  if (me) h += `<p class="mk-good">${_t('Du führst! Bleib dran – kurz vor Schluss wird oft noch geboten.')}</p>`;
  else h += `<div class="mk-amt"><button class="btn alt" data-act="mk_amt" data-id="-5">−−</button><button class="btn alt" data-act="mk_amt" data-id="-1">−</button><b>${mkG(MK.amt)}<small>${_t('mind. {n}', { n: mkG(need) })}</small></b><button class="btn alt" data-act="mk_amt" data-id="1">+</button><button class="btn alt" data-act="mk_amt" data-id="5">++</button></div>
    <div class="mk-act"><button class="btn" data-act="mk_bid" data-id="${A.id}" ${P.gold >= MK.amt ? '' : 'disabled'}>${_t('Bieten')} <i class="coin"></i>${mkG(MK.amt)}</button></div>`;
  if (A.bo && !(top && top[2] >= A.bo)) h += `<div class="mk-act"><button class="btn${MK.conf === 'bo' + A.id ? ' red' : ' alt'}" data-act="mk_bo" data-id="${A.id}" ${P.gold >= boCost ? '' : 'disabled'}>${MK.conf === 'bo' + A.id ? _t('Wirklich? Sofortkauf') : _t('Sofortkauf')} <i class="coin"></i>${mkG(boCost)}</button></div>`;
  if (!me && P.gold < need) h += `<p class="sub mk-bad" style="margin:0">${_t('Zu wenig Gold für das Mindestgebot.')}</p>`;
  h += '</div>' + mkDetail(A.e);
  const B = A.bids.slice(-6).reverse();
  h += `<h3>${_t('GEBOTE')}</h3><div class="mk-hist">${B.map(b => `<div class="${b[1] === -1 ? 'me' : ''}"><span>${esc(mkWho(b[1]))}</span><span>${mkG(b[2])}</span><span>${mkAgo(now - b[0])}</span></div>`).join('') || `<p class="sub" style="margin:0">${_t('Noch keine Gebote. Sei der Erste!')}</p>`}</div>`;
  const ppl = A.bd.map(b => MK_NAMES[b.n][0] + ' (' + MK_TYPE[b.k] + ')');
  return h + mkChart(A.e) + `<p class="sub" style="font-size:16px">${_t('Verkäufer: {name}', { name: esc(MK_NAMES[A.s][0]) })}${ppl.length ? ' · ' + _t('Interessiert: {list}', { list: esc(ppl.slice(0, 4).join(', ')) }) : ''}</p>`;
}
// MEINE: Abholfach, eigene Versteigerungen, eigene Gebote, Handelsrang, Verlauf
function mkMineHTML(now) {
  const M = mkM();
  let h = `<p class="sub mk-l">${_t('Deine Versteigerungen, deine Gebote und das Abholfach – für alle deine Helden.')}</p>`;
  h += `<h3>${_t('ABHOLFACH')}</h3>` + (M.box.length ? M.box.map((x, i) => mkRow(x.e, `<div class="mk-p"><button class="btn sm" data-act="mk_claim" data-i="${i}">${_t('Abholen')}</button></div>`, { st: esc({ won: _t('Ersteigert'), sold: _t('Erlös'), back: _t('Zurück, nicht verkauft'), refund: _t('Gebot zurück'), buy: _t('Gekauft') }[x.w] || '') + ' · ' + mkAgo(now - x.t) })).join('') + (M.box.length > 1 ? `<button class="btn" data-act="mk_claim" data-id="all" style="width:100%;min-height:44px;margin:4px 0 6px">${_t('Alles abholen')}</button>` : '') : `<p class="sub" style="margin-top:0">${_t('Leer. Ersteigertes und Unverkauftes landet hier.')}</p>`);
  h += `<h3>${_t('DEINE VERSTEIGERUNGEN {n}/{max}', { n: M.own.length, max: mkSlots() })}</h3>`;
  h += M.own.length ? M.own.map(A => {
    const top = mkTop(A), st = top ? mkBids(top[2], A.bids.length) + ' · ' + esc(mkWho(top[1])) : _t('Noch kein Gebot · Start {n} Gold', { n: mkG(A.start) });
    return mkRow(A.e, `<div class="mk-p"><span class="mk-cd${mkCdCls(A.t1 - now)}" data-mkend="${A.t1}" data-mks="1">${mkLeftS(A.t1 - now)}</span>${top ? '' : `<button class="btn alt sm" data-act="mk_cancel" data-id="${A.id}">${_t('Abbrechen')}</button>`}</div>`, { st, cls: mkFlash(A.id) });
  }).join('') : `<p class="sub" style="margin-top:0">${_t('Noch nichts eingestellt. Wähle unter VERKAUFEN etwas aus und tippe „Versteigern“.')}</p><button class="btn alt" data-act="mk_tab" data-id="sell" style="width:100%;min-height:44px">${_t('Etwas versteigern')}</button>`;
  const mine = M.auc.filter(A => A.me);
  if (mine.length) h += `<h3>${_t('DEINE GEBOTE')}</h3>` + mine.map(A => { const top = mkTop(A), me = top && top[1] === -1; return mkRow(A.e, `<div class="mk-p"><span class="mk-cd${mkCdCls(A.t1 - now)}" data-mkend="${A.t1}" data-mks="1">${mkLeftS(A.t1 - now)}</span><span class="mk-pill ${me ? 'lead' : 'out'}">${me ? _t('DU FÜHRST') : _t('ÜBERBOTEN')}</span></div>`, { act: 'mk_goto', id: A.id, st: mkBids(top ? top[2] : A.start, A.bids.length), cls: mkFlash(A.id) }); }).join('');
  const r = mkRankI(), nx = MK_RANK[r + 1], cur = MK_RANK[r][0], pv = nx ? clamp((M.vol - cur) / (nx[0] - cur), 0, 1) : 1;
  h += `<h3>${_t('HANDELSRANG')}</h3><div class="box"><div class="nm" style="color:var(--gold);font-size:20px">${_t('Rang {n}: {title}', { n: r + 1, title: MK_RANK[r][1] })}</div><div class="tm-bar"><i style="width:${Math.round(pv * 100)}%"></i><span>${nx ? _t('UMSATZ {a} / {b}', { a: fmt(M.vol), b: fmt(nx[0]) }) : _t('HÖCHSTER RANG')}</span></div>
  <p class="sub" style="margin:4px 0 0;font-size:17px">${_t('Jetzt: {f} % Gebühr, {s} Auktionsplätze.', { f: mkPct(mkFee()), s: mkSlots() })} ${nx ? _t('Nächster Rang „{t}“: {f} % Gebühr, {s} Plätze, bessere Ware.', { t: nx[1], f: mkPct(MK_FEE[r + 1]), s: MK_SLOT[r + 1] }) : ''}</p><p class="sub" style="margin:2px 0 0;font-size:16px">${_t('Jedes Gold, das du im Basar umsetzt, zählt. Verkauft: {s} · Gekauft: {b} · Bester Verkauf: {best} Gold', { s: M.sold, b: M.bought, best: mkG(M.best) })}</p></div>`;
  if (M.log.length) h += `<h3>${_t('VERLAUF')}</h3>` + M.log.slice(0, 12).map(x => `<p class="mk-log"><b>${mkAgo(now - x.t)}</b> · ${esc(mkEvText(x.k, x.i, x.b, x.n)[0])}</p>`).join('');
  return h;
}

/* ---------- Knöpfe ---------- */
function mkSay(r, ok) { if (r && r.ok) { if (ok) toast(ok, '#79c24e'); } else { toast(mkErr(r), '#ff6a5a'); sfx('deny'); } }
ON.mk_open = id => mkOpen(id || 'map');
ON.mk_back = () => mkClose();
ON.mk_tab = id => { MK.tab = id; MK.sel = null; MK.conf = 0; sfx('click'); mkShow(); };
ON.mk_sel = id => { MK.sel = id || null; MK.conf = 0; MK.amtFor = null; if (id && MK.tab === 'sell' && MK.cat !== 'item') { const o = MK.cat === 'mat' ? P.mats : MK.cat === 'gem' ? P.gems : MK.cat === 'mod' ? P.mods : P.parts, k = id.slice(id.indexOf(':') + 1); MK.n = Math.max(1, (o && o[k]) || 1); } sfx('click'); mkShow(); };
ON.mk_cat = id => { MK.cat = id; MK.sel = null; MK.conf = 0; sfx('click'); mkShow(); };
ON.mk_buy = id => mkRun(MARKET.buy(id), r => { if (r.ok) { sfx('buy'); toast(_t('Gekauft!') + ' ' + mkWhere(r.where, mkName(r.e)), '#79c24e'); saveChar(); } else mkSay(r); mkShow(); });
ON.mk_n = id => { const S = mkSrc(); if (S) MK.n = clamp((S.e.n || 1) + (+id || 0), 1, S.have); mkShow(); };
ON.mk_sell = () => {
  const S = mkSrc(); if (!S) return;
  const big = S.e.t === 'egg' || lootValue(S.e) >= 1500 || (S.e.t === 'item' && S.e.it.rar >= 3);
  if (big && MK.conf !== 'sell') { MK.conf = 'sell'; sfx('click'); mkShow(); return; }
  const e = MK_HERO.take(S.src); if (!e) { mkSay({ err: 'gone' }); mkShow(); return; }
  mkRun(MARKET.sell(e), r => { if (r.ok) { sfx('coin'); toast(_t('Verkauft für {n} Gold.', { n: mkG(r.gold) }), '#ffd24a'); MK.sel = null; } else { MK_HERO.give(e); mkSay(r); } MK.conf = 0; saveChar(); mkShow(); });
};
ON.mk_bulk = () => {
  if (MK.conf !== 'bulk') { MK.conf = 'bulk'; sfx('click'); mkShow(); return; }
  let g = 0; for (const it of mkBulk()) { const e = MK_HERO.take({ t: 'item', uid: it.uid }); if (e) { const r = MARKET.sell(e); if (r && r.ok) g += r.gold; else MK_HERO.give(e); } }
  MK.conf = 0; MK.sel = null; if (g) { sfx('coin'); toast(_t('Verkauft für {n} Gold.', { n: mkG(g) }), '#ffd24a'); } saveChar(); mkShow();
};
ON.mk_set = () => { if (!mkSrc()) return; MK.set = { sp: 50, bp: 0, h: 12 }; MK.conf = 0; sfx('click'); mkShow(); };
ON.mk_setx = () => { MK.set = null; if (MK.from === 'char' && MK.back) { mkClose(); return; } mkShow(); };
ON.mk_sp = id => { if (MK.set) MK.set.sp = +id; mkShow(); };
ON.mk_bp = id => { if (MK.set) MK.set.bp = +id; mkShow(); };
ON.mk_h = id => { if (MK.set) MK.set.h = +id; mkShow(); };
ON.mk_go = () => {
  const S = mkSrc(), st = MK.set; if (!S || !st) return;
  const V = Math.max(1, lootValue(S.e)), start = Math.max(1, mkNice(V * st.sp / 100)), bo = st.bp ? mkNice(V * st.bp / 100) : 0;
  if (mkM().own.length >= mkSlots()) { mkSay({ err: 'slots' }); return; }
  const e = MK_HERO.take(S.src); if (!e) { mkSay({ err: 'gone' }); MK.set = null; mkShow(); return; }
  mkRun(MARKET.auction(e, start, bo, st.h), r => {
    if (r.ok) { sfx('chest'); toast(_t('Eingestellt! {item} wird {h} Std. lang versteigert.', { item: mkName(e), h: st.h }), '#ffd24a'); MK.set = null; MK.sel = null; MK.tab = 'mine'; MK.fl[r.id] = mkNow(); if (MK.from === 'char') MK.back = null; }
    else { MK_HERO.give(e); mkSay(r); }
    saveChar(); mkShow(); mkLive();
  });
};
ON.mk_amt = id => { const A = mkM().auc.find(x => x.id === MK.sel); if (!A) return; const need = mkMinBid(A), d = +id || 0; let v = MK.amt; for (let k = 0; k < Math.abs(d); k++) v = d > 0 ? mkNice(v + mkInc(v)) : v - mkInc(v); MK.amt = Math.max(need, Math.min(1e9, v)); sfx('click'); mkShow(); };
ON.mk_bid = id => mkRun(MARKET.bid(id, MK.amt), r => {
  if (r.ev && r.ev.length) mkNotify(r.ev);
  if (r.ok) { sfx('coin'); toast(r.where ? _t('Sofort gekauft!') + ' ' + mkWhere(r.where, mkName(r.e)) : _t('Gebot abgegeben – du führst!'), '#79c24e'); MK.fl[id] = mkNow(); } else mkSay(r);
  saveChar(); mkShow();
});
ON.mk_bo = id => {
  if (MK.conf !== 'bo' + id) { MK.conf = 'bo' + id; sfx('click'); mkShow(); return; }
  MK.conf = 0; mkRun(MARKET.buyout(id), r => { if (r.ok) { sfx('loot'); toast(_t('Sofort gekauft!') + ' ' + mkWhere(r.where, mkName(r.e)), '#ffd24a'); MK.sel = null; } else mkSay(r); saveChar(); mkShow(); });
};
ON.mk_claim = (id, b, i) => mkRun(MARKET.claim(id === 'all' ? 'all' : i), r => {
  if (r.ok) { sfx('loot'); toast(id === 'all' ? (r.err ? _t('Abgeholt: {n}. Der Rest passt gerade nicht.', { n: r.n }) : _t('Alles abgeholt!')) : _t('Abgeholt!') + ' ' + mkWhere(r.where, mkName(r.e)), r.err ? '#ffd24a' : '#79c24e'); } else mkSay(r);
  saveChar(); mkShow();
});
ON.mk_cancel = id => mkRun(MARKET.cancel(id), r => { if (r.ok) { sfx('click'); toast(_t('Abgebrochen.') + ' ' + mkWhere(r.where, mkName(r.e)), '#efe2bf'); } else mkSay(r); saveChar(); mkShow(); });
ON.mk_goto = id => { MK.tab = 'bid'; MK.sel = id; MK.amtFor = null; sfx('click'); mkShow(); };
ON.mk_quick = id => { if (!P.bag.some(x => x.uid === id)) return; MK.from = 'char'; MK.back = id; MK.tab = 'sell'; MK.cat = 'item'; MK.sel = id; MK.conf = 0; mkEnsure(); MK.set = { sp: 50, bp: 0, h: 12 }; sfx('click'); mkShow(); mkLive(); };

/* ---------- Versteck: Station, Symbol, Karte ---------- */
HOOK.station.push((h, id) => { if (h || id !== 'basar') return h; mkOpen('hide'); return true; });
HOOK.mapMore.push(() => { const M = mkM(), n = M ? M.unseen || M.box.length : 0; return `<button class="btn alt" data-act="mk_open" data-id="map">${_t('Basar')}${n ? `<span class="badge">${Math.min(99, n)}</span>` : ''}</button>`; });
HOOK.itemActions.push(it => P && P.bag.includes(it) && returnTo === 'map' && MK_HERO.ok() ? `<button class="btn alt sm" data-act="mk_quick" data-id="${it.uid}">${_t('Versteigern')}</button>` : '');
// Marktstand: gestreifte Markise, Theke mit Tuch und Waren, Laterne; goldenes „!“, wenn etwas im Abholfach wartet
HOOK.drawStation.push((o, x, y, r) => {
  if (o.id !== 'basar') return;
  const f = Math.floor(T * 6), M = mkM(), D = '#1a1420';
  r(-16, -29, 4, 29, D); r(12, -29, 4, 29, D); r(-15, -28, 2, 28, WOOD[0]); r(13, -28, 2, 28, WOOD[0]); r(-14, -28, 1, 28, WOOD[1]); r(14, -28, 1, 28, WOOD[1]);
  r(-13, -14, 26, 14, D); r(-12, -11, 24, 11, WOOD[1]); r(-12, -12, 24, 2, WOOD[2]); r(-12, -1, 24, 1, WOOD[0]); r(-5, -5, 1, 4, WOOD[0]); r(4, -5, 1, 4, WOOD[0]);
  r(-12, -10, 24, 4, '#6a48c0'); r(-12, -10, 24, 1, '#9a6af0'); for (let i = 0; i < 6; i++) r(-11 + i * 4, -6, 2, 1, '#e8b04a');
  r(-11, -15, 5, 3, '#9c6a24'); r(-11, -15, 5, 1, '#ffd24a'); r(-10, -17, 3, 2, '#c8902a'); r(-10, -17, 3, 1, '#ffe08a');
  r(-4, -16, 3, 4, '#3a6ac8'); r(-4, -16, 1, 2, '#9ad0ff'); r(-3, -18, 1, 2, '#a8a08a');
  r(1, -14, 3, 2, '#a82a22'); r(2, -15, 1, 1, '#e8402a'); if (f % 14 < 2) r(2, -15, 1, 1, '#ffffff');
  r(6, -14, 6, 2, '#efe2bf'); r(6, -14, 1, 2, '#c8b890'); r(10, -15, 2, 1, '#c8342c');
  r(-18, -36, 36, 9, D);
  for (let i = 0; i < 8; i++) { const red = i % 2 === 0, dx = -16 + i * 4, wv = (i + f) % 8 === 0 ? 1 : 0; r(dx, -35, 4, 7, red ? '#c8342c' : '#efe2bf'); r(dx, -35, 4, 1, red ? '#e8584a' : '#fffaf0'); r(dx, -29, 4, 1, red ? '#8a1e18' : '#b8a888'); r(dx + 1, -28, 2, 2 + wv, D); r(dx + 1, -28, 2, 1 + wv, red ? '#c8342c' : '#efe2bf'); }
  r(-5, -42, 10, 7, D); r(-4, -41, 8, 5, WOOD[2]); r(-4, -37, 8, 1, WOOD[1]); r(-1, -40, 2, 3, '#ffd24a'); r(-1, -40, 1, 1, '#fff3c0');
  r(15, -25, 1, 2, D); r(14, -23, 5, 6, D); r(15, -22, 3, 4, '#3a3440'); r(16, -21, 1, 2, f % 5 ? '#ffd24a' : '#ffb03a'); addLight(x + 16, y - 20, 26, .6 + .08 * Math.sin(T * 7));
  if (M && (M.box.length || M.unseen) && !(G && G.near && G.near.act === 'basar')) { const b = Math.round(Math.sin(T * 4) * 1.5); r(-2, -53 + b, 5, 7, D); r(-2, -45 + b, 5, 4, D); r(-1, -52 + b, 3, 5, '#ffd24a'); r(-1, -44 + b, 3, 2, '#ffd24a'); r(-1, -52 + b, 1, 5, '#fff3c0'); addLight(x, y - 48, 18, .6); }
});
HOOK.artIcon.push((name, b) => {
  if (name !== 'basar') return;
  b.rect(1, 1, 14, 1, '#8a1e18');
  for (let i = 0; i < 4; i++) { const c = i % 2 ? '#efe2bf' : '#c8342c'; b.rect(1 + i * 3.5 | 0, 2, 4, 4, c); }
  for (const x of [2, 6, 9, 13]) b.set(x, 6, x === 6 || x === 13 ? '#efe2bf' : '#c8342c');
  b.rect(2, 7, 1, 8, WOOD[0]); b.rect(13, 7, 1, 8, WOOD[0]);
  b.rect(3, 10, 10, 5, WOOD[1]); b.rect(3, 10, 10, 1, WOOD[2]); b.rect(3, 12, 10, 1, '#6a48c0');
  b.disc(8, 8.5, 1.6, '#e8b04a'); b.set(7, 8, '#fff3c0'); b.set(4, 9, '#57a7d6'); b.set(11, 9, '#e8402a');
});
