'use strict';
/* =========================================================
   KLINGENHORT – Aufstieg (6.4): Level-Belohnungen 2–100 und die Ansicht AUFSTIEG im Charakter
   Jedes neue Level gibt sofort etwas (lvReward, fest je Level – die Zeitleiste zeigt es vorher): Gold, ein Gegner-Material, einen Rohstoff
   und ein Bauteil (Stufe wächst mit dem Level), alle 5 Level Glücksmünzen, alle 10 einen Gegenstand (Episch, Legendär, bei 100 Mythisch)
   oder ein Ei, bei 60/70/80/90 Kosmetik oder Titel, bei 100 die Aura der Hundert und ein Titel (kontoweit; schon vorhanden → 3 Glücksmünzen).
   Spielstand: P.lvr = höchstes belohntes Level. Alte Helden (vor 6.4): ihr Level gilt als belohnt – kein Gold-Nachschlag, nur Kosmetik und
   Titel erreichter Meilensteine einmal. Wiedergeburt: P.lvr bleibt, Belohnungen gibt es erst wieder für neue Level.
   Schnittstelle: lvReward(L) → [Eintrag] · lvrGrant(L) → was es gab (js/combat.js gainXP, je Level, auch bei Sprüngen) · lvrLine(got) / lvrToast(got)
     lvrFix(P, alt) (js/items.js activateChar) · lvrHTML(paraHTML) (Charakter → AUFSTIEG, js/ui.js)
   Einträge wie bei den Aufträgen (js/fraktionen.js rwGive/rwName/rwIcon), dazu epic | myth (Gegenstand für die Klasse) und cos (Kosmetik)
   ========================================================= */

document.head.insertAdjacentHTML('beforeend', `<style>
.taltier,.lvsub{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:0 0 8px}
.taltier .opt,.lvsub .opt{min-width:0;min-height:44px;margin:0}
.taltier .opt small{font-family:var(--f-display);font-size:7px;color:var(--gold);margin-top:4px}
.tal.lvl{opacity:.62;background:#1c1824}.tal.lvl .r{color:var(--parch-dim)}
.tal .tlv{display:block;font-style:normal;font-family:var(--f-display);font-size:6px;line-height:1.6;color:#e8b04a;margin-top:4px}
.tal.cap{background:linear-gradient(180deg,#3a2e18,var(--stone-lo));box-shadow:inset 0 0 0 1px #8a6a2a}.tal.cap b{color:var(--gold)}
.tal.cap.can{box-shadow:inset 0 0 0 2px var(--gold)}.tal.cap.max{box-shadow:inset 0 0 0 2px var(--moss)}
.lvrhead{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.lvrlv{flex:none;width:72px;text-align:center;background:var(--stone-lo);padding:6px 4px;box-shadow:inset 0 0 0 2px var(--gold)}
.lvrlv b{display:block;font-family:var(--f-display);font-weight:400;font-size:20px;color:var(--gold);line-height:1.4}
.lvrlv small{display:block;font-family:var(--f-display);font-size:6px;color:var(--parch-dim)}
.lvrhead .sub{flex:1;min-width:0;margin:0}
.lvrbar{position:relative;height:18px;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi);margin-bottom:10px}
.lvrbar i{position:absolute;left:2px;top:2px;bottom:2px;max-width:calc(100% - 4px);background:#57a7d6}
.lvrbar span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-display);font-size:7px;text-shadow:1px 1px 0 #000;white-space:nowrap}
.lvrtrack{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:3px;margin:0 0 10px}
.lvrm{text-align:center;opacity:.5;min-width:0}
.lvrm span{display:grid;place-items:center;height:32px;background:var(--stone-lo);box-shadow:inset 0 -3px 0 var(--c)}
.lvrm img{width:22px;height:22px;image-rendering:pixelated;object-fit:contain}
.lvrm small{display:block;font-family:var(--f-display);font-size:6px;margin-top:3px;color:var(--parch-dim)}
.lvrm.got{opacity:1}.lvrm.got span{background:#2e2618}.lvrm.got small{color:var(--gold)}
.lvrm.nx{opacity:1}.lvrm.nx span{box-shadow:inset 0 0 0 2px var(--gold),inset 0 -3px 0 var(--c)}
.lvrrow{display:grid;grid-template-columns:40px minmax(0,1fr);gap:8px;align-items:center;background:var(--stone-lo);padding:6px 8px;margin-bottom:4px;opacity:.75}
.lvrrow.got{opacity:1;box-shadow:inset 3px 0 0 var(--moss)}.lvrrow.nx{opacity:1;box-shadow:inset 0 0 0 2px var(--gold);background:#2e2618}
.lvrn{display:grid;place-items:center;height:36px;font-family:var(--f-display);font-size:10px;background:var(--night)}
.lvrrow.ms .lvrn{color:var(--gold);box-shadow:inset 0 0 0 2px #8a6a2a}
.lvrs{font-family:var(--f-display);font-size:6px;line-height:1.6;color:var(--parch-dim);margin-bottom:4px;letter-spacing:1px}
.lvrrow.got .lvrs{color:var(--moss)}.lvrrow.nx .lvrs{color:var(--gold)}
.lvrsp{font-size:16px;line-height:1.1;color:var(--gold);margin-top:4px}
.lvrgap{text-align:center;color:var(--parch-dim);font-size:16px;line-height:1;margin:0 0 4px}
.lvrall{width:100%;min-height:44px;margin:6px 0 4px}
body.touch .lvrs,body.touch .lvrm small,body.touch .tal .tlv{font-size:7px}
body.touch .panel .btn[data-act="respec"],body.touch .panel .btn[data-act="pp"]{min-height:44px;min-width:44px}
</style>`);

/* ---------- Was jedes Level gibt ---------- */
// Gegner-Material und Rohstoff nach Level (bis Level < Grenze), Menge nach Marktwert (MK_MATV, js/market.js)
const LVR_MAT = [[12, ['erz', 'leder', 'knochen', 'schleim', 'zahn']], [28, ['kristall', 'horn', 'glut', 'mithril']], [50, ['mithril', 'adamant', 'schuppe', 'stern']], [LVMAX + 1, ['adamant', 'schuppe', 'stern', 'aether']]];
const LVR_RES = [[15, ['holz', 'stein', 'faser']], [35, ['eisenholz', 'marmor', 'feder', 'samen']], [60, ['eisenholz', 'marmor', 'obsidian']], [LVMAX + 1, ['marmor', 'obsidian', 'sternholz']]];
// alle 10 Level: Gegenstand oder Ei (Seltenheit des Eis: PET_TIERS, js/pets.js)
const LVR_TEN = { 10: { t: 'epic' }, 20: { t: 'egg', tier: 3 }, 30: { t: 'leg' }, 40: { t: 'egg', tier: 4 }, 50: { t: 'leg' }, 60: { t: 'egg', tier: 4 }, 70: { t: 'leg' }, 80: { t: 'egg', tier: 5 }, 90: { t: 'leg' }, 100: { t: 'myth' } };
// Meilensteine: Kosmetik (COSM[k].lvl, js/data.js) und Titel (FK_TITLES, js/fraktionen.js)
const LVR_MS = { 60: [{ t: 'cos', k: 'c_aufstieg' }], 70: [{ t: 'title', k: 'lv70' }], 80: [{ t: 'cos', k: 'w_aufstieg' }], 90: [{ t: 'title', k: 'lv90' }], 100: [{ t: 'cos', k: 'a_hundert' }, { t: 'title', k: 'lv100' }] };
const lvrNice = v => { const s = v < 200 ? 5 : v < 2000 ? 10 : 50; return Math.round(v / s) * s; };
const lvrBand = (B, L) => (B.find(([to]) => L < to) || B[B.length - 1])[1];
const lvrMatN = (k, w) => clamp(Math.round(w / ((typeof MK_MATV !== 'undefined' && MK_MATV[k]) || 20)), 1, 40);
function lvReward(L) {
  if (!(L >= 2 && L <= LVMAX)) return [];
  const m = lvrBand(LVR_MAT, L), r = lvrBand(LVR_RES, L), mk = m[L % m.length], rk = r[(L >> 1) % r.length];
  const pt = PARTORDER[L % PARTORDER.length], el = PART[pt].el ? ELORDER[Math.floor(L / 6) % ELORDER.length] : null;
  const E = [{ t: 'gold', n: lvrNice(20 * L + 1.4 * L * L) }, { t: 'mat', k: mk, n: lvrMatN(mk, 40 + 18 * L) }, { t: 'mat', k: rk, n: lvrMatN(rk, 25 + 10 * L) }, { t: 'part', k: pkey(pt, clamp(1 + Math.floor(L / 18), 1, 6), el), n: 1 }];   // Bauteil Roh (I) … Meister (VI) ab Level 90
  if (L % 5 === 0) E.push({ t: 'fate', n: 1 + Math.floor(L / 25) });
  if (LVR_TEN[L]) E.push(Object.assign({}, LVR_TEN[L]));
  for (const e of LVR_MS[L] || []) E.push(Object.assign({}, e));
  return E;
}
// wichtigste Belohnung eines Meilensteins (Leiste oben)
function lvrMain(L) { const E = lvReward(L); return E.find(e => e.t === 'cos') || E.find(e => e.t === 'title') || E.find(e => ['egg', 'leg', 'epic', 'myth'].includes(e.t)) || E[0]; }

/* ---------- Geben ---------- */
function lvrOwned(e) { if (e.t === 'cos') return SAVE.meta.cos.includes(e.k); if (e.t === 'title') { const M = typeof fkM === 'function' && fkM(); return !M || M.tt.includes(e.k); } return false; }
function lvrGive(e) {
  switch (e.t) {
    case 'epic': case 'myth': { const it = e.t === 'myth' ? makeMythic() : randomItem(Math.max(stageNum(), P.lv), 3); if (!itemPut(it)) addToBag(it); return { t: 'item', it }; }
    case 'cos': case 'title': {
      if (lvrOwned(e) || (e.t === 'cos' && !COSM[e.k])) { gainFate(3); return { t: 'fate', n: 3 }; }   // schon da (anderer Held): Glücksmünzen
      if (e.t === 'cos') { SAVE.meta.cos.push(e.k); statMax('cosm', SAVE.meta.cos.length); return e; }
      return rwGive(e);
    }
  }
  return rwGive(e);   // gold, mat, part, fate, egg (volles Brutnest: Gold), leg
}
// Belohnung für ein neu erreichtes Level – genau einmal je Held (P.lvr), auch nach einer Wiedergeburt nicht doppelt
function lvrGrant(L) {
  if (!P || !(L > (P.lvr || 1)) || L > LVMAX) return [];
  P.lvr = L; const got = [];
  for (const e of lvReward(L)) { try { const g = lvrGive(e); if (g) got.push(g); } catch (err) { console.error('Level-Belohnung:', err); } }
  return got;
}
// alte Helden: erreichte Level gelten als belohnt (lvFix setzt P.lvr) – Kosmetik und Titel der erreichten Meilensteine einmal, kein Gold
function lvrFix(c, old) {
  if (!old || !SAVE) return;
  for (const L in LVR_MS) if (+L <= c.lv) for (const e of LVR_MS[L]) if (!lvrOwned(e) && (e.t !== 'cos' || COSM[e.k])) { if (e.t === 'cos') SAVE.meta.cos.push(e.k); else { const M = fkM(); M.tt.push(e.k); if (!M.t) M.t = e.k; } }
}

/* ---------- Namen, Bilder, Anzeige ---------- */
function lvrName(e) {
  switch (e.t) {
    case 'epic': return _t('Epischer Gegenstand für deine Klasse');
    case 'myth': return _t('Mythischer Gegenstand für deine Klasse');
    case 'cos': return COSM[e.k] ? _t('Kosmetik „{n}“', { n: COSM[e.k].n }) : '?';
    case 'item': return itemName(e.it);
  }
  return rwName(e);
}
function lvrIcon(e) { return e.t === 'epic' || e.t === 'myth' ? iconURL(['pa', 'truhe']) : e.t === 'cos' ? iconURL(['pa', 'spiegel']) : e.t === 'item' ? itemIconURL(e.it) : rwIcon(e); }
function lvrCol(e) { return e.t === 'epic' ? RAR[3].c : e.t === 'myth' ? RAR[6].c : e.t === 'cos' ? (COSM[e.k] ? COSM[e.k].c[0] : '#efe2bf') : e.t === 'item' ? RAR[e.it.rar].c : rwCol(e); }
function lvrChip(e) {
  if (!['epic', 'myth', 'cos'].includes(e.t)) return rwChip(e);
  return `<span class="rwc" style="--c:${lvrCol(e)}" title="${esc(lvrName(e))}"><img src="${lvrIcon(e)}" alt="${esc(lvrName(e))}">${e.t === 'cos' ? esc(COSM[e.k] ? COSM[e.k].n : '') : ''}</span>`;
}
// kurz für Banner und Hinweis
function lvrShort(e) {
  if (e.t === 'item') return e.it.rar === 6 ? _t('Mythischer Gegenstand') : e.it.rar === 4 ? _t('Legendärer Gegenstand') : e.it.rar === 3 ? _t('Epischer Gegenstand') : _t('Gegenstand');
  if (e.t === 'egg') return PET_TIERS[e.tier] ? PET_TIERS[e.tier].egg : _t('Ei');
  if (e.t === 'cos') return COSM[e.k] ? COSM[e.k].n : '';
  return lvrName(e);
}
const LVR_SPECIAL = ['item', 'egg', 'cos', 'title'];
// besondere Belohnungen: Kosmetik und Titel zuerst, höchstens drei Namen (große Sprünge: „+n weitere“)
function lvrTop(got) {
  const sp = got.filter(e => LVR_SPECIAL.includes(e.t)), rk = e => e.t === 'cos' || e.t === 'title' ? 0 : e.t === 'item' ? 7 - e.it.rar : 5;
  const s = sp.slice().sort((a, b) => rk(a) - rk(b)), L = s.slice(0, 3).map(lvrShort);
  if (s.length > 3) L.push(_t('+{n} weitere', { n: s.length - 3 }));
  return { L, best: s[0] };
}
function lvrLine(got) {
  let g = 0, m = 0, pt = 0, f = 0;
  for (const e of got) { if (e.t === 'gold') g += e.n; else if (e.t === 'mat') m += e.n; else if (e.t === 'part') pt += e.n; else if (e.t === 'fate') f += e.n; }
  const L = [];
  if (g) L.push(_t('{n} Gold', { n: fmt(g) })); if (m) L.push(_t('{n} Material', { n: m })); if (pt) L.push(pt > 1 ? _t('{n} Bauteile', { n: pt }) : _t('1 Bauteil'));
  if (f) L.push(f > 1 ? _t('{n} Glücksmünzen', { n: f }) : _t('1 Glücksmünze'));
  const sp = lvrTop(got).L;
  return L.length || sp.length ? L.concat(sp) : [_t('Mehr Lebenspunkte')];
}
function lvrToast(got) {
  const T_ = lvrTop(got); if (!T_.best) return;
  setTimeout(() => { toast(_t('Level-Belohnung: {list}', { list: T_.L.join(', ') }), lvrCol(T_.best)); sfx('loot'); }, 900);
}

/* ---------- Charakter → AUFSTIEG: Level-Belohnungen (Zeitleiste) und Paragon ---------- */
const LVR = { all: false, sub: 'lvr' };
function lvrHTML(paraFn) {
  const sub = `<div class="lvsub" role="tablist">${[['lvr', _t('LEVEL-BELOHNUNGEN')], ['para', _t('PARAGON')]].map(([k, n]) => `<button class="opt${LVR.sub === k ? ' sel' : ''}" role="tab" aria-selected="${LVR.sub === k}" data-act="lvr_sub" data-id="${k}">${n}</button>`).join('')}</div>`;
  return sub + (LVR.sub === 'para' ? paraFn() : lvrBody());
}
function lvrBody() {
  const lv = P.lv, top = Math.max(lv, P.lvr || 1), done = lv >= LVMAX, p = done ? 1 : P.xp / xpNext(lv);
  let h = `<div class="lvrhead"><div class="lvrlv"><small>${_t('LEVEL')}</small><b>${lv}</b><small>${_t('von {n}', { n: LVMAX })}</small></div>
    <p class="sub">${done ? _t('Ganz oben! Jetzt gibt es Paragonpunkte.') : _t('Jedes Level bringt eine Belohnung – sie kommt sofort beim Aufstieg. Noch {n} EP bis Level {lv}.', { n: fmt(xpNext(lv) - P.xp), lv: lv + 1 })}</p></div>
    <div class="lvrbar"><i style="width:${(p * 100).toFixed(1)}%"></i><span>${done ? _t('LEVEL {n} ERREICHT', { n: LVMAX }) : _t('EP {n}', { n: fmt(P.xp) + ' / ' + fmt(xpNext(lv)) })}</span></div>`;
  // Meilensteine 10 … 100
  const nms = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], nx = nms.find(L => L > top);
  h += `<div class="lvrtrack">${nms.map(L => { const e = lvrMain(L); return `<div class="lvrm${L <= top ? ' got' : L === nx ? ' nx' : ''}" title="${esc(lvrName(e))}"><span style="--c:${lvrCol(e)}"><img src="${lvrIcon(e)}" alt="${esc(lvrName(e))}"></span><small>${L}</small></div>`; }).join('')}</div>`;
  // Zeitleiste: um das aktuelle Level herum und die nächsten Meilensteine – oder alle
  let show = [];
  if (LVR.all) for (let L = 2; L <= LVMAX; L++) show.push(L);
  else { for (let L = Math.max(2, lv - 1); L <= Math.min(LVMAX, lv + 5); L++) show.push(L); show = show.concat(nms.filter(L => L > lv + 5).slice(0, 3)); }
  let last = 0;
  for (const L of show) {
    if (last && L > last + 1) h += '<div class="lvrgap">⋮</div>';
    last = L; const got = L <= top, next = L === lv + 1 && !got;
    const st = got ? '✓ ' + (L <= lv ? _t('ERHALTEN') : _t('SCHON ERHALTEN')) : next ? _t('ALS NÄCHSTES') : _t('IN {n} LEVEL', { n: L - lv });
    const E = lvReward(L), sp = E.filter(e => ['epic', 'myth', 'leg', 'egg', 'cos', 'title'].includes(e.t)).map(lvrName);
    h += `<div class="lvrrow${got ? ' got' : ''}${next ? ' nx' : ''}${L % 10 === 0 ? ' ms' : ''}"><div class="lvrn">${L}</div><div class="lvrc"><div class="lvrs">${st}</div><div class="aqr">${E.map(lvrChip).join('')}</div>${sp.length ? `<div class="lvrsp">${esc(sp.join(' · '))}</div>` : ''}</div></div>`;
  }
  h += `<button class="btn alt lvrall" data-act="lvr_all">${LVR.all ? _t('Weniger zeigen') : _t('Alle {n} Level zeigen', { n: LVMAX - 1 })}</button>`;
  // Titel wählen (auch die aus den Aufträgen)
  const M = typeof fkM === 'function' && fkM();
  if (M && M.tt.length) h += `<h3>${_t('DEIN TITEL')}</h3><div class="fkttl"><button class="opt${!M.t ? ' sel' : ''}" data-act="lvr_ttl" data-id="">${_t('Kein Titel')}</button>${M.tt.map(t => `<button class="opt${M.t === t ? ' sel' : ''}" data-act="lvr_ttl" data-id="${t}">${esc(FK_TITLES[t])}</button>`).join('')}</div>`;
  return h;
}
ON.lvr_sub = id => { LVR.sub = id === 'para' ? 'para' : 'lvr'; sfx('click'); openChar('para'); };
ON.lvr_all = () => { LVR.all = !LVR.all; sfx('click'); openChar('para'); };
ON.lvr_ttl = id => { const M = fkM(); if (M && (!id || M.tt.includes(id))) { M.t = id || ''; persist(); sfx('click'); } openChar('para'); };
