'use strict';
/* =========================================================
   KLINGENHORT – Schmiede der Meister – Bauteile, Zerlegen, Meisterwerke, Schmiedemeisterschaft
   Hängt sich über HOOK/ACTS (js/core.js) ins Spiel ein.
   Bauteile liegen pro Held in P.parts als Anzahl je Schlüssel: 'klinge:3', 'kern:feuer:2'.
   Meisterwerk-Gegenstände tragen it.mw = { klinge, griff, kern } bzw. { platte, polster, rune } (Stufen 1–10)
   und it.el (Element aus Kern bzw. Rune). Schmiedemeisterschaft kontoweit: SAVE.meta.smith.
   ========================================================= */

/* ---------- Bauteile & Stufen ---------- */
const PART = {
  klinge: { n: _t('Klinge'), w: 1 },
  griff: { n: _t('Griff'), w: 1 },
  kern: { n: _t('Elementkern'), w: 1, el: 1 },
  platte: { n: _t('Panzerplatte'), w: 0 },
  polster: { n: _t('Polsterung'), w: 0 },
  rune: { n: _t('Rune'), w: 0, el: 1 }
};
const PARTW = ['klinge', 'griff', 'kern'], PARTA = ['platte', 'polster', 'rune'], PARTORDER = PARTW.concat(PARTA);
const GRADE = [null,
  { n: _t('Roh'), c: ['#3e322a', '#6e5444', '#94745c', '#c0a080'] },
  { n: _t('Grob'), c: ['#5a3a1a', '#8a5a2a', '#b8823a', '#e0b070'] },
  { n: _t('Solide'), c: ['#3e4656', '#6a7688', '#a8b2c2', '#e0e8f0'] },
  { n: _t('Fein'), c: ['#1e5a3a', '#2e8a52', '#5ac27a', '#b8f0c0'] },
  { n: _t('Edel'), c: ['#1e4a7a', '#2e6ab8', '#5aa8e8', '#c8ecff'] },
  { n: _t('Meister'), c: ['#3e2270', '#6a40b0', '#a078e8', '#e0ccff'] },
  { n: _t('Großmeister'), c: ['#6a4a10', '#b0802a', '#e8c04a', '#fff0a0'] },
  { n: _t('Sagenhaft'), c: ['#6a2410', '#b84a1e', '#f08a3a', '#ffd08a'] },
  { n: _t('Uralt'), c: ['#5a1020', '#9a2238', '#e04a5e', '#ffb8c0'] },
  { n: _t('Göttlich'), c: ['#6a1a6a', '#b83aa8', '#ff70d8', '#fff0ff'] }
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const gradeCol = g => GRADE[g] ? GRADE[g].c[2] : '#c8c8c8';
// Kosten fürs Kombinieren (3 → 1): Gold steigt steil, ab Stufe 4 kommen seltene Materialien dazu
const COMB_MAT = [null, {}, {}, {}, { kristall: 1 }, { kristall: 2 }, { stern: 1 }, { stern: 2 }, { aether: 1 }, { aether: 2 }];
// Teile beim Zerlegen nach Seltenheit [min, max]
const SALV_N = [[1, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 4]];

function pkey(t, g, el) { return PART[t].el ? t + ':' + el + ':' + g : t + ':' + g; }
function pparse(k) { const a = String(k).split(':'); return a.length === 3 ? { t: a[0], el: a[1], g: +a[2] } : { t: a[0], el: null, g: +a[1] }; }
function pvalid(k) { const p = pparse(k); return !!PART[p.t] && Number.isInteger(p.g) && p.g >= 1 && p.g <= 10 && (PART[p.t].el ? !!ELEM[p.el] : !p.el); }
function phave(k) { return (P && P.parts && P.parts[k]) || 0; }
function padd(k, n) { const v = (P.parts[k] || 0) + n; if (v > 0) P.parts[k] = v; else delete P.parts[k]; }
function pcount() { let n = 0; for (const k in P.parts) n += P.parts[k]; return n; }
function pbase(t, el) { return PART[t].el && el ? (t === 'kern' ? _t('{el}kern', { el: ELEM[el].n }) : _t('{el}rune', { el: ELEM[el].n })) : PART[t].n; }
function pname(t, g, el) { return _t('{part} ({grade})', { part: pbase(t, el), grade: GRADE[g].n }); }
function pshort(t, g, el) { return pbase(t, el) + ' ' + ROMAN[g]; }
// Wirkung eines Bauteils
function pdesc(t, g, el) {
  switch (t) {
    case 'klinge': return _t('Schaden +{v}', { v: pc1(g * .06) });
    case 'griff': return _t('Tempo +{v}', { v: pc1(g * .015) }) + ' · ' + _t('Krit +{v}', { v: pc1(g * .006) });
    case 'kern': return el ? _t('{p} Chance je Treffer – {fx}', { p: pct(elProc(g)), fx: ELFX_D[el] }) : '';
    case 'platte': return _t('VER +{v}', { v: pc1(g * .06) });
    case 'polster': return _t('LP +{v}', { v: pc1(g * .06) });
    case 'rune': return el ? _t('−{p} Schaden von {el}-Gegnern', { p: pct(elRes(g)), el: ELEM[el].n }) + ' · ' + RUNE_BONUS[el].s(RUNE_BONUS[el].v * g) : '';
  }
  return '';
}

/* ---------- Schmiedemeisterschaft (kontoweit, Stufe 1–100) ---------- */
const SMITH_TITLES = [[1, _t('Lehrling')], [10, _t('Geselle')], [20, _t('Schmied')], [30, _t('Waffenschmied')], [40, _t('Meisterschmied')], [50, _t('Runenschmied')], [60, _t('Großmeister der Esse')], [70, _t('Sagenschmied')], [80, _t('Ahnenschmied')], [90, _t('Götterschmied')], [100, _t('Weltenschmied')]];
function smithLv() { return (SAVE && SAVE.meta.smith && SAVE.meta.smith.lv) || 1; }
function smithNeed(lv) { return 60 * lv * lv; }
function smithTitle(lv) { let t = SMITH_TITLES[0][1]; for (const [l, n] of SMITH_TITLES) if (lv >= l) t = n; return t; }
function smithNext(lv) { return SMITH_TITLES.find(([l]) => l > lv) || null; }
// Boni je Stufe: billiger kombinieren, Meisterwurf (+2 Stufen), Extra-Bauteil beim Zerlegen, Meisterstück (Seltenheit +1)
const SMB = { comb: lv => Math.min(.4, lv * .004), lucky: lv => lv * .0015, extra: lv => lv * .004, rar: lv => lv * .0025 };
function smithXP(n) {
  const S = SAVE.meta.smith; if (S.lv >= 100) return;
  S.xp += Math.round(n); const t0 = smithTitle(S.lv); let up = false;
  while (S.lv < 100 && S.xp >= smithNeed(S.lv)) { S.xp -= smithNeed(S.lv); S.lv++; up = true; }
  if (S.lv >= 100) S.xp = 0;
  if (up) { const t1 = smithTitle(S.lv); toast(t1 !== t0 ? _t('Schmiedemeister {lv}: neuer Titel „{title}“!', { lv: S.lv, title: t1 }) : _t('Schmiedemeister Stufe {lv}!', { lv: S.lv }), '#ffd24a'); sfx('lvl'); }
}

/* ---------- Beute: Bauteile direkt beim Besiegen ---------- */
function partGrade(stage, bonus) {
  const top = clamp(1 + Math.floor((stage - 1) / 20), 1, 3), q = qualOf(P.act);
  let g = ri(Math.max(1, top - 1), top);
  if (Math.random() < .06 + q * .01 + (bonus || 0) + smithLv() * .001) g++;
  return clamp(g, 1, 4 + (q >= 6 ? 1 : 0));
}
// Art: in den ersten Funden der Reihe nach (damit schnell ein ganzes Meisterwerk zusammenkommt), sonst zufällig
function partType() {
  const S = SAVE.meta.smith;
  if (S.found < 6) { const miss = PARTORDER.find(t => !Object.keys(P.parts).some(k => pparse(k).t === t)); if (miss) return miss; }
  return pick(PARTORDER);
}
function partRoll(t, g, el) { return pkey(t, g, PART[t].el ? (el && Math.random() < .7 ? el : pick(ELORDER)) : null); }
function partGive(k, x, y, i) {
  const S = SAVE.meta.smith, first = !S.found; padd(k, 1); S.found++;
  const p = pparse(k); if (x != null) txt(x, y - (i || 0) * 8, '+' + pshort(p.t, p.g, p.el), gradeCol(p.g), p.g >= 4);
  if (first) toast(_t('Bauteil gefunden! An Werkbank und Schmiede wird daraus ein Meisterwerk.'), '#ffd24a');
}
HOOK.kill.push(e => {
  if (!G || G.type === 'versteck' || e.ai === 'dummy' || !P.parts) return;
  const early = SAVE.meta.smith.found < 10, lm = (G.lootMul || 1) * (1 + mod('loot')), D = e.def || {}, st = stageNum();
  let n = 0, bonus = 0;
  if (e.boss) { n = ri(2, 3); bonus = .3; }
  else if (e.t === 'goldgob' || e.t === 'goldmimik') { n = ri(1, 2); bonus = .15; }
  else {
    const summon = D.from >= 99 && e.t !== 'mimic';   // beschworene Kriecher und Schleimlinge geben selten etwas
    const ch = (e.champ ? .5 : e.elite || e.t === 'mimic' ? (early ? .6 : .15) : (early ? .12 : .02)) * lm * (summon ? .25 : 1);
    if (Math.random() < ch) n = 1; if (e.champ) bonus = .15;
  }
  const el = typeof enemyEl === 'function' ? enemyEl(e) : null;
  for (let i = 0; i < n; i++) partGive(partRoll(partType(), partGrade(st, bonus), el), e.x, e.y - 38 * (e.sc || 1), i);
});

/* ---------- Kombinieren: 3 gleiche → 1 der nächsten Stufe ---------- */
function combCost(g) {
  const d = (1 - SMB.comb(smithLv())) * (1 - weekFx('smith')), mats = Object.assign({}, COMB_MAT[g] || {});
  return { gold: Math.round(20 * Math.pow(2.4, g - 1) * d), mats };
}
// Kerne und Runen derselben Stufe lassen sich über Elemente hinweg kombinieren – das angetippte bestimmt das neue Element
function combPool(k) { const p = pparse(k); if (!PART[p.t] || !PART[p.t].el) return [k]; return [k].concat(Object.keys(P.parts).filter(x => x !== k && P.parts[x] > 0 && pparse(x).t === p.t && pparse(x).g === p.g).sort((a, b) => P.parts[b] - P.parts[a])); }
function combHave(k) { return combPool(k).reduce((n, x) => n + phave(x), 0); }
function combOk(k) { const p = pparse(k); if (!PART[p.t] || p.g >= 10 || combHave(k) < 3) return false; const c = combCost(p.g); return canAfford(c.mats, c.gold); }
function combinePart(k) {
  if (!combOk(k)) return null;
  const p = pparse(k), c = combCost(p.g); payMats(c.mats); P.gold -= c.gold;
  let need = 3; for (const x of combPool(k)) { const n = Math.min(need, phave(x)); padd(x, -n); need -= n; if (!need) break; }
  let g = p.g + 1, lucky = false; if (g < 10 && Math.random() < SMB.lucky(smithLv())) { g++; lucky = true; }
  padd(pkey(p.t, g, p.el), 1); SAVE.meta.smith.comb++; smithXP(30 * p.g * p.g);
  return { k: pkey(p.t, g, p.el), g, lucky };
}
/* Alle kombinieren (ein Tipp): niedrigste Stufe zuerst, bei Kernen/Runen bestimmt das häufigste Element das neue.
   combPlan rechnet nur (Vorschau der Kosten), combAll macht es wirklich. */
function combPlan(types) {
  const parts = Object.assign({}, P.parts), mats = Object.assign({}, P.mats), cm = {}; let gold = P.gold, cg = 0, n = 0;
  for (let g = 1; g < 10; g++) for (const t of types) {
    const keys = Object.keys(parts).filter(k => parts[k] > 0 && pparse(k).t === t && pparse(k).g === g);
    for (const pool of PART[t].el ? [keys] : keys.map(k => [k])) {
      for (;;) {
        if (pool.reduce((s, k) => s + parts[k], 0) < 3) break;
        const c = combCost(g); if (gold < c.gold || Object.keys(c.mats).some(m => (mats[m] || 0) < c.mats[m])) break;
        gold -= c.gold; cg += c.gold; for (const m in c.mats) { mats[m] -= c.mats[m]; cm[m] = (cm[m] || 0) + c.mats[m]; }
        pool.sort((a, b) => parts[b] - parts[a]); const main = pool[0]; let need = 3;
        for (const k of pool) { const x = Math.min(need, parts[k]); parts[k] -= x; need -= x; if (!need) break; }
        const nk = pkey(t, g + 1, pparse(main).el); parts[nk] = (parts[nk] || 0) + 1; n++;
      }
    }
  }
  return { n, gold: cg, mats: cm };
}
function combAll(types) {
  let n = 0, best = null;
  for (let g = 1; g < 10; g++) for (const t of types) for (;;) {
    const k = Object.keys(P.parts).filter(k => P.parts[k] > 0 && pparse(k).t === t && pparse(k).g === g).sort((a, b) => P.parts[b] - P.parts[a]).find(combOk);
    const r = k && combinePart(k); if (!r) break;
    n++; if (!best || r.g > pparse(best).g) best = r.k;
  }
  return { n, best };
}

/* ---------- Zerlegen ---------- */
const hasMods = it => !!(it && Array.isArray(it.mods) && it.mods.length);   // Mods (js/mods.js) kommen beim Zerlegen zurück
function salvRisky(it) { return it.rar >= 3 || !!it.mw || !!it.set || !!it.myth || it.up >= 5 || !!it.fz || it.gems.length > 0 || hasMods(it); }
function salvGrade(it) { return 1 + Math.floor(it.tier / 3); }
function salvMats(it) { const m = it.slot === 'weapon' ? 'erz' : 'leder', F = FORGE[it.tier], x = Object.keys(it.slot === 'weapon' ? F.w : F.a).find(k => k !== m); return { m, x: it.tier >= 2 ? x : null }; }
// Was ein Gegenstand ungefähr ergibt (Vorschau)
function salvPreview(it) {
  const grp = it.slot === 'weapon' ? PARTW : PARTA, M = salvMats(it);
  if (it.mw) return { mw: grp.filter(t => it.mw[t] > 1).map(t => pshort(t, it.mw[t] - 1, PART[t].el ? it.el : null)), M };
  const [a, b] = SALV_N[it.rar] || [1, 1], add = (it.up >= 5 ? 1 : 0) + (it.fz || 0), g = salvGrade(it);
  return { n: [a + add, b + add], g: [g, Math.min(5, g + 1)], types: grp, M };
}
function salvage(it, R) {
  if (!itemList(it)) return null;   // Beutel oder Lager
  R = R || { n: 0, parts: {}, mats: {}, gems: 0, xp: 0 };
  const grp = it.slot === 'weapon' ? PARTW : PARTA, give = k => { padd(k, 1); R.parts[k] = (R.parts[k] || 0) + 1; }, M = salvMats(it);
  let gs = 0;
  if (it.mw) { for (const t of grp) { const g = (it.mw[t] || 0) - 1; if (g >= 1) { give(pkey(t, g, PART[t].el ? it.el || pick(ELORDER) : null)); gs += g; } } }
  else {
    const [a, b] = SALV_N[it.rar] || [1, 1]; let n = ri(a, b) + (it.up >= 5 ? 1 : 0) + (it.fz || 0); if (Math.random() < SMB.extra(smithLv())) n++;
    for (let i = 0; i < n; i++) { const t = pick(grp), g = Math.min(5, salvGrade(it) + (Math.random() < .08 + Math.min(it.rar, 6) * .05 ? 1 : 0)); give(pkey(t, g, PART[t].el ? it.el || pick(ELORDER) : null)); gs += g; }
  }
  const mn = ri(1, 2) + (it.rar >= 3 ? 1 : 0); gainMat(M.m, mn); R.mats[M.m] = (R.mats[M.m] || 0) + mn;
  if (M.x && Math.random() < .35) { gainMat(M.x, 1); R.mats[M.x] = (R.mats[M.x] || 0) + 1; }
  for (const g of it.gems) { gainGem(g); R.gems++; }
  if (typeof modTakeBack === 'function') R.mods = (R.mods || 0) + modTakeBack(it);
  itemTake(it);
  const xp = 4 + 2 * it.tier + 3 * Math.min(it.rar, 5) + (it.rar === 6 ? 8 : 0) + 2 * gs; R.xp += xp; R.n++;
  SAVE.meta.smith.salv++; smithXP(xp);
  return R;
}
// alle einfachen Gegenstände einer Seltenheit (ohne Sockelsteine, Aufwertung, Verschmelzung, Mods) – auf Wunsch mit dem Lager
function salvBulkList(r, withStash) { return P.bag.concat(withStash && stashOn() ? stashItems() : []).filter(x => x.rar === r && !x.gems.length && !x.up && !x.fz && !x.mw && !x.set && !x.myth && !hasMods(x)); }

/* ---------- Meisterwerk schmieden ---------- */
const MW = { slot: 'weapon', tier: -1, base: null, form: null, pick: {}, step: 1 };
const FG = { last: null, scr: 'wb' };
let zrArm = null;
function mwGroup(slot) { return slot === 'weapon' ? PARTW : PARTA; }
function mwInit() {
  const C = CLASSES[P.cls], w = P.gear.weapon;
  if (!C.weapons.includes(MW.base)) { MW.base = w && C.weapons.includes(w.base) ? w.base : C.weapons[0]; MW.form = null; }
  if (!WFORM[MW.base].some(f => f.id === MW.form)) MW.form = w && w.base === MW.base ? wform(w).id : WFORM[MW.base].find(f => f.std).id;
  // Material: das beste, das man schon verarbeiten darf und dessen Material man hat (sonst Eisen)
  if (MW.tier < 0) { let t = Math.max(0, REQ.filter(r => r <= P.lv).length - 1); while (t > 0 && !hasMats(forgeCost(t, MW.slot).mats)) t--; MW.tier = t; }
}
// verfügbare Bauteile einer Art: beste Stufe zuerst
function mwOptions(t) { return Object.keys(P.parts).filter(k => pparse(k).t === t && P.parts[k] > 0).sort((a, b) => pparse(b).g - pparse(a).g || ELORDER.indexOf(pparse(a).el) - ELORDER.indexOf(pparse(b).el)); }
function mwPick(t) { const o = mwOptions(t); if (MW.pick[t] && o.includes(MW.pick[t])) return MW.pick[t]; return MW.pick[t] = o[0] || null; }
function mwRar(sum) { return sum <= 5 ? 1 : sum <= 10 ? 2 : sum <= 16 ? 3 : 4; }
const MW_RSTEP = [0, 6, 11, 17];   // ab dieser Summe die nächste Seltenheit
function mwCost(tier, slot, sum) { const c = forgeCost(tier, slot); return { mats: c.mats, gold: c.gold + 25 * sum }; }
function mwState() {
  mwInit();
  const slot = MW.slot, grp = mwGroup(slot), picks = {}; let sum = 0, miss = null;
  for (const t of grp) { picks[t] = mwPick(t); if (picks[t]) sum += pparse(picks[t]).g; else if (!miss) miss = t; }
  const tier = MW.tier, cost = mwCost(tier, slot, sum), rar = mwRar(sum);
  const elK = picks[slot === 'weapon' ? 'kern' : 'rune'], el = elK ? pparse(elK).el : null;
  const ok = !miss && forgeOk(tier) && canAfford(cost.mats, cost.gold) && roomFor();
  return { slot, grp, picks, sum, miss, tier, cost, rar, el, ok };
}
function mwPreviewItem(s) {
  const mw = {}; for (const t of s.grp) mw[t] = s.picks[t] ? pparse(s.picks[t]).g : 0;
  const it = { uid: 'mwprev', slot: s.slot, base: s.slot === 'weapon' ? MW.base : s.slot, tier: s.tier, rar: s.rar, up: 0, aff: {}, sockets: 0, gems: [], set: null, name: null, suf: null, fz: 0, mw };
  if (s.slot === 'weapon') it.form = MW.form;
  if (s.el) it.el = s.el;
  return it;
}
function mwCraft() {
  const s = mwState(); if (!s.ok) return null;
  payMats(s.cost.mats); P.gold -= s.cost.gold;
  for (const t of s.grp) padd(s.picks[t], -1);
  let rar = s.rar, lucky = false; if (rar < 4 && Math.random() < SMB.rar(smithLv())) { rar++; lucky = true; }
  const it = makeItem({ slot: s.slot, base: s.slot === 'weapon' ? MW.base : s.slot, tier: s.tier, rar, form: s.slot === 'weapon' ? MW.form : undefined });
  it.mw = {}; for (const t of s.grp) it.mw[t] = pparse(s.picks[t]).g;
  it.el = s.el;
  if (!itemPut(it)) addToBag(it); if (rar === 4) stat('legs'); stat('mwMade');
  SAVE.meta.smith.made++; smithXP(60 + 10 * s.sum * s.sum / 3);
  return { it, lucky };
}
/* Umbauen: ein besseres Bauteil in ein vorhandenes Meisterwerk setzen. Das alte kommt eine Stufe tiefer zurück. */
function mwSwapCost(g) { return Math.round(40 * g * g * (1 - SMB.comb(smithLv()))); }
// k = gewünschtes Bauteil (sonst das im Schmiede-Assistenten gewählte bzw. beste)
function mwSwapOk(it, t, k) {
  k = k || mwPick(t); if (!k || !it.mw || !(phave(k) > 0) || pparse(k).t !== t) return null;
  const p = pparse(k), old = it.mw[t] || 0;
  if (p.g < old || (p.g === old && (!PART[t].el || p.el === it.el))) return null;
  return { k, p, old, gold: mwSwapCost(p.g) };
}
// Bauteile, die in ein Meisterwerk passen und besser sind (beste zuerst)
function mwSwapOpts(it, t) { return mwOptions(t).filter(k => mwSwapOk(it, t, k)); }
function mwSwap(it, t, k) {
  const s = mwSwapOk(it, t, k); if (!s || P.gold < s.gold) return false;
  P.gold -= s.gold; padd(s.k, -1);
  if (s.old > 1) padd(pkey(t, s.old - 1, PART[t].el ? it.el || s.p.el : null), 1);
  it.mw[t] = s.p.g; if (PART[t].el) it.el = s.p.el;
  let sum = 0; for (const x of mwGroup(it.slot)) sum += it.mw[x] || 0;
  const nr = mwRar(sum);
  if (nr > it.rar && it.rar < 5) {
    it.rar = nr; const pool = it.slot === 'weapon' ? AFFW : AFFA, free = Object.keys(pool).filter(k => !(k in it.aff)).sort(() => Math.random() - .5);
    while (Object.keys(it.aff).length < RAR[nr].aff && free.length) { const k = free.pop(); it.aff[k] = +pool[k].f(nr).toFixed(3); }
    it.sockets = Math.max(it.sockets, RAR[nr].sock[0]);
    if (nr === 4) { it.suf = null; if (!it.name) it.name = pick(LEGEND[it.slot === 'weapon' ? it.base : it.slot]); stat('legs'); }
  }
  smithXP(20 * s.p.g * s.p.g); computeStats();
  return true;
}

/* ---------- Grafik: Bauteil-Icons (16×16, prozedural) ---------- */
const PARTC = {}, PICON = {};
const STONE = ['#2e2a36', '#4e4a5a', '#6e6a7e', '#8e8aa0'];
function partArt(t, g, el) {
  const key = t + g + (el || ''); if (PARTC[key]) return PARTC[key];
  const M = GRADE[g].c, E = el && ELEM[el] ? ELEM[el].c : ['#4a4450', '#6a6470', '#8a8490', '#aaa4b0'], b = PB(16, 16), R = mulberry(hashStr(key));
  switch (t) {
    case 'klinge':   // breite Klinge schräg, Spitze oben rechts, Angel unten links
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const sm = x + y, d = x - y, n = d > 5 ? d - 5 : 0, lo = 12 + Math.ceil(n / 2), hi = 16 - Math.floor(n / 2);
        if (d >= -8 && d <= 10) { if (sm >= lo && sm <= hi) b.set(x, y, sm === lo ? M[3] : sm === hi ? M[1] : g >= 4 && sm === 14 && d > -6 && d < 7 ? M[1] : M[2]); }
        else if (d >= -13 && d < -9 && sm >= 13 && sm <= 15) b.set(x, y, sm === 13 ? STONE[3] : sm === 14 ? STONE[2] : STONE[1]);
        else if ((d === -9 || d === -10) && sm >= 11 && sm <= 17) b.set(x, y, d === -9 ? M[0] : M[1]);
      }
      if (g >= 6) for (const [x, y] of [[5, 9], [7, 7], [9, 5]]) b.set(x, y, GRADE[7].c[3]);
      break;
    case 'griff':
      b.rect(7, 0, 2, 4, '#c8d2e0'); b.rect(8, 0, 1, 4, '#8a96aa');
      b.rect(2, 4, 12, 1, M[3]); b.rect(2, 5, 12, 1, M[1]); b.set(2, 5, M[2]); b.set(13, 5, M[2]);
      if (g >= 5) { b.set(1, 5, M[2]); b.set(14, 5, M[2]); b.set(1, 4, M[3]); b.set(14, 4, M[3]); }
      for (let y = 6; y < 12; y++) { b.set(6, y, y % 2 ? LEATH[1] : LEATH[2]); b.set(7, y, y % 2 ? LEATH[2] : LEATH[1]); b.set(8, y, y % 2 ? LEATH[1] : LEATH[2]); b.set(9, y, LEATH[0]); }
      b.rect(6, 6, 4, 1, M[2]); b.rect(6, 11, 4, 1, M[2]);
      b.rect(6, 12, 4, 2, M[2]); b.rect(7, 14, 2, 1, M[1]); b.set(9, 13, M[1]); b.set(6, 12, M[3]); b.set(7, 12, M[3]);
      if (g >= 7) b.set(8, 13, '#ffffff');
      break;
    case 'kern':
      b.disc(7.5, 7.5, 6.6, M[1]); b.disc(7.5, 7.5, 5.6, M[2]);
      for (const [x, y] of [[4, 3], [3, 4], [5, 2], [3, 5]]) b.set(x, y, M[3]);
      b.disc(7.5, 7.5, 4.3, OUT); b.disc(7.5, 7.5, 3.6, E[1]); b.disc(7, 7, 2.4, E[2]); b.set(6, 5, E[3]); b.set(5, 6, E[3]); b.set(6, 6, E[3]);
      for (const [x, y] of [[7, 0], [8, 0], [0, 7], [0, 8], [15, 7], [15, 8], [7, 15], [8, 15]]) b.set(x, y, M[3]);
      break;
    case 'platte':
      for (let y = 2; y <= 13; y++) { const hw = y < 4 ? 3 + (y - 2) * 2 : y > 11 ? 6 - (y - 11) * 2 : 6; for (let x = 8 - hw; x < 8 + hw; x++) b.set(x, y, x < 8 ? M[2] : M[1]); b.set(8 - hw, y, M[3]); }
      for (let x = 5; x < 11; x++) b.set(x, 2, M[3]);
      for (let y = 3; y <= 12; y++) { b.set(7, y, M[3]); b.set(8, y, M[0]); }
      for (const [x, y] of [[4, 5], [11, 5], [4, 10], [11, 10]]) { b.set(x, y, M[3]); b.set(x, y + 1, M[0]); }
      if (g >= 6) for (let x = 4; x < 12; x++) b.set(x, 12, GRADE[7].c[2]);
      break;
    case 'polster':
      b.rect(2, 3, 12, 10, M[1]); b.rect(3, 4, 10, 8, M[2]);
      for (let y = 4; y < 12; y++) for (let x = 3; x < 13; x++) { const a = (x + y) % 4 === 0, c = (x - y + 16) % 4 === 0; if (a && c) b.set(x, y, M[3]); else if (a || c) b.set(x, y, M[1]); }
      b.rect(2, 3, 12, 1, M[3]); b.rect(2, 12, 12, 1, M[0]); b.rect(13, 3, 1, 10, M[0]);
      for (const [x, y] of [[1, 4], [1, 11], [14, 4], [14, 11]]) b.set(x, y, M[2]);
      break;
    case 'rune':
      b.rect(3, 2, 10, 12, STONE[1]); b.rect(4, 1, 8, 14, STONE[1]);
      b.rect(3, 2, 1, 12, STONE[2]); b.rect(4, 1, 8, 1, STONE[3]); b.rect(12, 2, 1, 12, STONE[0]); b.rect(4, 14, 8, 1, STONE[0]);
      b.rect(4, 3, 8, 1, M[2]); b.rect(4, 12, 8, 1, M[1]);
      b.rect(5, 4, 6, 7, STONE[0]);
      if (el && ELBITS[el]) elBits(b, el, 5, 5, E);
      break;
  }
  if (g >= 7) for (let k = 0; k < g - 5; k++) { const x = Math.floor(R() * 16), y = Math.floor(R() * 16); if (b.get(x, y) && b.get(x, y) !== OUT) b.set(x, y, '#ffffff'); }
  return PARTC[key] = pbCanvas(pbOutline(b));
}
function partIconURL(t, g, el) { const k = t + g + (el || ''); return PICON[k] || (PICON[k] = mk(18, 18, gg => gg.drawImage(partArt(t, g, el), 1, 1)).toDataURL()); }
function partImg(k, cls) { const p = pparse(k); return `<img${cls ? ` class="${cls}"` : ''} src="${partIconURL(p.t, p.g, p.el)}" alt="">`; }

/* ---------- Oberfläche: Werkbank (Karte), Schmiede und Juwelier (Versteck) ----------
   Vier klare Bereiche statt neun Reiter:
   VERBESSERN – erst den Gegenstand wählen, darunter alles, was damit geht (Aufwerten, Verschmelzen, Sockel, Umschmieden, Umbauen, Zerlegen)
   SCHMIEDEN  – Meisterwerk in 5 Schritten (Was? · Material · Bauteile · Vorschau · Schmieden), dazu „Schnell schmieden“ ohne Bauteile
   ZERLEGEN   – alte Gegenstände zu Bauteilen · WERKSTATT – Bauteile, Edelsteine, Rezepte, Farben, Veredeln
   Jede Station kann, was sie bisher konnte (WB_CAN). Alte Reiter-Namen (wbTab = 'up', 'sock', 'mw' …) öffnen den passenden Bereich. */
let wbTab = 'ver', wbFree = false, wbMode = 'node', fuseA = null, fuseB = null;
const WB = { act: null, sub: null, bag: false, help: null, swap: {}, src: 'bag', zst: false };   // src: Liste Beutel oder Lager, zst: Sammel-Zerlegen mit Lager
const WB_SECS = { node: ['ver', 'sch', 'zer', 'ws'], act: ['ver', 'sch', 'zer', 'ws'], smith: ['ver', 'sch', 'zer', 'ws'], jewel: ['ver', 'ws'] };
const WB_CAN = { node: 'up mods fuse sock drill reroll refine umbau extract salv parts gems rez dye', smith: 'up mods fuse drill reroll refine umbau extract salv parts rez dye', jewel: 'mods sock gems trans' };
WB_CAN.act = WB_CAN.node;
const wbCan = k => (WB_CAN[wbMode] || WB_CAN.node).split(' ').includes(k);
const WB_OLD = { up: ['ver', 'up'], fuse: ['ver', 'fuse'], sock: ['ver', 'sock'], craft: ['ws', 'rez'], forge: ['sch'], mw: ['sch'], gems: ['ws', 'gems'], dye: ['ws', 'dye'], trans: ['ws', 'trans'] };
const WB_SEC = { ver: [_t('VERBESSERN'), 'wbup'], sch: [_t('SCHMIEDEN'), 'amboss'], zer: [_t('ZERLEGEN'), 'wbzer'], ws: [_t('WERKSTATT'), 'wbws'] };
const WS_SUB = { parts: _t('BAUTEILE'), gems: _t('EDELSTEINE'), rez: _t('REZEPTE'), dye: _t('FARBEN'), trans: _t('VEREDELN') };
const PART_ROLE = { klinge: _t('mehr Schaden'), griff: _t('Tempo und Krit'), kern: _t('Element-Effekt bei Treffern'), platte: _t('mehr Verteidigung'), polster: _t('mehr Lebenspunkte'), rune: _t('Element-Schutz und Bonus') };
// Eine Zeile oben in jedem Bereich …
const WB_INTRO = {
  ver: () => wbMode === 'jewel' ? _t('Wähle einen Gegenstand und setze Edelsteine in seine Sockel.') : _t('Wähle einen Gegenstand – darunter steht alles, was du damit machen kannst.'),
  sch: () => _t('Dein Meisterwerk in 5 Schritten – du bestimmst alles.'),
  zer: () => _t('Mach alte Gegenstände zu Bauteilen und Material für Meisterwerke.'),
  up: () => _t('Macht den Gegenstand stärker, bis +10.'),
  fuse: () => _t('Opfere einen zweiten Gegenstand derselben Art für bessere Werte.'),
  sock: () => _t('Edelsteine in freie Sockel setzen – feste Boni.'),
  mods: () => _t('Mods geben neue Kräfte – manche wecken zusammen eine Resonanz.'),
  reroll: () => _t('Einen Zusatzwert austauschen – zufällig oder mit einer Affix-Essenz.'),
  refine: () => _t('Einen Zusatzwert um eine Stufe stärker machen.'),
  extract: () => _t('Gegenstand opfern – ein Zusatzwert bleibt als Affix-Essenz.'),
  umbau: () => _t('Bessere Bauteile in dein Meisterwerk einbauen.'),
  salv: () => _t('Gegenstand in Bauteile und Material zerlegen.'),
  parts: () => _t('Drei gleiche Bauteile ergeben eins der nächsten Stufe.'),
  gems: () => _t('Drei gleiche Edelsteine ergeben einen besseren.'),
  rez: () => _t('Tränke und Edelstein-Splitter herstellen.'),
  dye: () => _t('Färbe deine Rüstung – einmal freischalten, immer wechseln.'),
  trans: () => _t('Mach aus Material, das du übrig hast, seltenes.')
};
// … und mehr dazu hinter dem „?“
const WB_HELP = {
  ver: () => _t('Tippe oben einen Gegenstand an (angelegt oder aus dem Beutel). Darunter siehst du alles, was du mit ihm machen kannst – grüne Zahlen zeigen, was besser wird, rote, was schlechter wird.'),
  up: () => _t('Jede Stufe bis +10 macht den Gegenstand stärker. Bis +5 klappt es immer, danach sinkt die Chance. Geht es schief, sind nur die Materialien weg – der Gegenstand bleibt. Ab +5 leuchtet er, ab +8 bekommt er eine Aura.'),
  fuse: () => _t('Ein zweiter Gegenstand derselben Art wird geopfert. Deiner behält Aussehen und Namen und bekommt die höhere Stufe und Aufwertung beider, die besten Zusatzwerte, einen Zusatzwert mehr und +6 % Grundwerte (★). Gleiche Seltenheit: Chance auf die nächste – zwei Legendäre können sogar Mythisch werden.'),
  sock: () => _t('Edelsteine geben feste Boni: Rubin Schaden, Saphir Verteidigung, Smaragd Krit, Amethyst Lebenspunkte, Topas Gold. Drei gleiche ergeben in der Werkstatt einen besseren. Entfernen kostet Gold, die Steine kommen zurück.'),
  reroll: () => _t('Tippe einen Zusatzwert an. Umschmieden macht daraus einen zufälligen anderen mit derselben Stufe – jedes Mal an diesem Gegenstand wird es teurer. Mit einer Affix-Essenz bestimmst du selbst, was kommt.'),
  refine: () => _t('Veredeln hebt einen Zusatzwert um eine Stufe. Die Seltenheit setzt die Grenze: Magisch bis Stufe 3, Legendär bis 6, Mythisch bis 8 – Meisterwerke eine Stufe mehr. Es klappt immer.'),
  extract: () => _t('Der Gegenstand geht verloren, ein Zusatzwert deiner Wahl bleibt als Affix-Essenz. Die setzt du unter UMSCHMIEDEN in einen anderen Gegenstand derselben Art ein (Waffe oder Rüstung/Helm) – höchstens bis zu dessen Stufen-Grenze. Edelsteine und Mods kommen zurück in den Vorrat.'),
  mods: () => _t('Jeder Gegenstand hat Mod-Plätze nach Seltenheit (Gewöhnlich 1 … Mythisch 5, Meisterwerk +1). Runen geben feste Werte, Glyphen lösen Effekte aus, Essenzen bestimmen das Element, Kerne verbessern Fähigkeiten, Prägungen leuchten. Jede Art nur einmal je Gegenstand, nur eine Essenz. Einsetzen ist kostenlos, Herausnehmen kostet Gold – der Mod kommt zurück. Bestimmte Mods zusammen wecken eine Resonanz: siehe Resonanz-Buch.'),
  umbau: () => _t('Setzt ein besseres Bauteil in dein Meisterwerk. Das alte kommt eine Stufe tiefer zurück. Aufwertung, Sterne und Edelsteine bleiben. Steigt die Summe der Stufen, steigt auch die Seltenheit.'),
  salv: () => _t('Waffen geben Waffen-Bauteile, Rüstungen und Helme geben Rüstungs-Bauteile, dazu etwas Material. Höhere Seltenheit, Aufwertung und Sterne geben mehr. Edelsteine kommen zurück in den Vorrat. Angelegtes kann nicht zerlegt werden.'),
  mw: () => _t('Ein Meisterwerk baust du selbst: Waffen aus Klinge, Griff und Elementkern, Rüstung und Helm aus Panzerplatte, Polsterung und Rune. Bessere Bauteile geben bessere Werte und eine höhere Seltenheit. Bauteile bekommst du von Gegnern (Elite und Bosse öfter) und beim Zerlegen.'),
  rar: () => _t('Die Stufen der drei Bauteile werden zusammengezählt: bis 5 Magisch, ab 6 Selten, ab 11 Episch, ab 17 Legendär.'),
  smith: () => { const lv = smithLv(), nx = smithNext(lv); return _t('Schmiedemeister steigt bei allem, was du an Amboss und Werkbank tust. Jetzt: Kombinieren {a} billiger, {b} Meisterwurf (Bauteil springt zwei Stufen), {c} Extra-Bauteil beim Zerlegen, {d} Meisterstück (Seltenheit +1).', { a: pc1(SMB.comb(lv)), b: pc1(SMB.lucky(lv)), c: pc1(SMB.extra(lv)), d: pc1(SMB.rar(lv)) }) + (nx ? ' ' + _t('Nächster Titel: {title} ab Stufe {lv}.', { title: nx[1], lv: nx[0] }) : ''); },
  quick: () => _t('Schnell schmieden braucht keine Bauteile: ein zufälliger Gegenstand aus dem gewählten Material, mindestens Magisch – Form und Werte sind Zufall.'),
  parts: () => _t('Drei gleiche Bauteile werden zu einem der nächsten Stufe. Kerne und Runen dürfen verschiedene Elemente haben – das angetippte bestimmt das neue.'),
  gems: () => _t('Drei gleiche Edelsteine verschmelzen zu einem besseren.'),
  rez: () => _t('Heiltränke und Edelstein-Splitter stellst du hier her. Umschmieden und Sockel bohren findest du unter VERBESSERN beim Gegenstand.'),
  dye: () => _t('Farbstoffe färben deine Rüstung. „Material“ zeigt die echte Farbe von Mithril, Adamant, Drachen … Einmal freigeschaltet, kannst du jederzeit wechseln.'),
  trans: () => _t('Veredle Materialien, die du übrig hast, zu selteneren.')
};
WB_HELP.zer = WB_HELP.salv;

/* ---------- Bausteine der Oberfläche ---------- */
function wbHelpBtn(k) { return `<button class="wbq" data-act="wb_help" data-id="${k}" aria-label="${_t('Hilfe')}" aria-expanded="${WB.help === k}">?</button>`; }
function wbHelpBox(k) { return WB.help === k && WB_HELP[k] ? `<div class="wbhelp">${esc(WB_HELP[k]())}</div>` : ''; }
function wbIntro(k, txt) { return `<div class="wbintro"><p>${txt}</p>${wbHelpBtn(k)}</div>${wbHelpBox(k)}`; }
const slotLabel = s => s === 'weapon' ? _t('Waffe') : AR[s].label;
// Wo es ein Material gibt (für rote „fehlt“-Zeilen)
const MAT_SPECIAL = { schuppe: _t('Bosse'), aether: _t('Gegner in der Qual') };
function matWhere(k) {
  const o = [], en = Object.keys(EN).filter(e => EN[e].drop && EN[e].drop[k] && !EN[e].hidden).sort((a, b) => EN[b].drop[k] - EN[a].drop[k]).slice(0, 2).map(e => EN[e].name);
  if (MAT_SPECIAL[k]) o.push(MAT_SPECIAL[k]);
  if (MATS[k].w) o.push(MATS[k].w);   // Rohstoffe (js/bauen.js): wo man sie sammelt
  if (en.length) o.push(en.join(', '));
  const bi = BIOMES.filter(b => b.vein === k).map(b => b.name); if (bi.length) o.push(_t('Erzadern: {list}', { list: bi.join(', ') }));
  const tr = TRANSMUTE.find(t => t[1] === k); if (tr) o.push(_t('Juwelier: aus {n} {m}', { n: tr[2], m: MATS[tr[0]].n }));
  return o.slice(0, 3).join(' · ');
}
function needHTML(mats, gold) {
  const L = Object.keys(mats || {}).filter(k => (P.mats[k] || 0) < mats[k]).map(k => `<li><b>${_t('{n}× {mat}', { n: mats[k] - (P.mats[k] || 0), mat: MATS[k].n })}</b> – ${esc(matWhere(k))}</li>`);
  if (gold && P.gold < gold) L.push(`<li><b>${_t('{n} Gold', { n: fmt(gold - P.gold) })}</b> – ${_t('Gegner, Truhen, Verkaufen beim Händler')}</li>`);
  return L.length ? `<div class="wbneed"><span>${_t('Es fehlt:')}</span><ul>${L.join('')}</ul></div>` : '';
}
function wbCost(mats, gold) { return costHTML(mats || {}, gold) + needHTML(mats, gold); }
// kurze Zeile für Listen: wo es das erste fehlende Material gibt
function missLine(mats, gold) {
  const k = Object.keys(mats || {}).find(m => (P.mats[m] || 0) < mats[m]);
  return k ? `<div class="st"><span class="wbbad">${esc(MATS[k].n)}:</span> ${esc(matWhere(k))}</div>` : gold && P.gold < gold ? `<div class="st wbbad">${_t('Dir fehlt Gold.')}</div>` : '';
}
// Knopf, der sagt, warum er (noch) nicht geht: why = '' (geht), true (Grund steht schon darüber) oder Text
function wbBtn(act, label, why, o) {
  o = o || {};
  return `<button class="btn${o.cls ? ' ' + o.cls : ''}" data-act="${act}"${o.id != null ? ` data-id="${o.id}"` : ''}${o.i != null ? ` data-i="${o.i}"` : ''} ${why ? 'disabled' : ''}>${label}</button>${why && why !== true ? `<p class="wbwhy">${why}</p>` : ''}`;
}
// Vorher → nachher: Hauptwerte, Seltenheit, Material, Aufwertung und Zeilen (grün = besser/neu, rot = schlechter/weg)
function wbMain(x) { return x.slot === 'weapon' ? [[_t('Schaden'), Math.round(weaponDmg(x) * (1 + (x.aff.wucht || 0)))]] : [[_t('Verteidigung'), Math.round(armorDef(x))], [_t('Lebenspunkte'), Math.round(armorHp(x))]]; }
function cmpHTML(a, b, head, mainOnly) {
  const R = [], rank = x => x.rar === 5 ? 3.5 : x.rar;
  const row = (l, x, y, up, d) => R.push(`<li class="${up ? 'up' : 'dn'}"><span>${l}</span><b>${x} → ${y}</b>${d ? `<i>${d}</i>` : ''}</li>`);
  const ma = wbMain(a), mb = wbMain(b);
  ma.forEach((m, i) => { const x = m[1], y = mb[i][1]; if (x !== y) row(m[0], fmt(x), fmt(y), y > x, (y > x ? '▲ +' : '▼ −') + fmt(Math.abs(y - x))); });
  const tx = (l, x, y, up) => row(l, x, y, up, up ? '▲' : '▼');
  if (a.rar !== b.rar) tx(_t('Seltenheit'), RAR[a.rar].n, `<span style="color:${RAR[b.rar].c}">${RAR[b.rar].n}</span>`, rank(b) > rank(a));
  if (a.tier !== b.tier) tx(_t('Material'), MAT[a.tier].n, MAT[b.tier].n, b.tier > a.tier);
  if (a.up !== b.up) tx(_t('Aufwertung'), '+' + a.up, '+' + b.up, b.up > a.up);
  if ((a.fz || 0) !== (b.fz || 0)) tx(_t('Verschmolzen'), '★' + (a.fz || 0), '★' + (b.fz || 0), (b.fz || 0) > (a.fz || 0));
  if (!mainOnly) {
    const lines = x => itemLines(x).slice(1).filter(l => !l.startsWith('⚒ ')), la = lines(a), lb = lines(b);
    for (const l of lb) if (!la.includes(l)) R.push(`<li class="up t"><span>+ ${esc(l)}</span></li>`);
    for (const l of la) if (!lb.includes(l)) R.push(`<li class="dn t"><span>− ${esc(l)}</span></li>`);
  }
  const d = mainOnly ? 0 : itemScore(b) / Math.max(1e-9, itemScore(a)) - 1;
  return `<div class="wbcmp">${head ? `<b>${head}</b>` : ''}<ul>${R.join('') || `<li><span>${_t('Keine Änderung')}</span></li>`}</ul>${Math.abs(d) >= .005 ? `<p class="${d > 0 ? 'up' : 'dn'}">${_t('Gesamt: {d}', { d: (d > 0 ? '▲ +' : '▼ ') + Math.round(d * 100) + ' %' })}</p>` : ''}</div>`;
}
function partChip(k, sel, act, i) { const p = pparse(k); return `<button class="wbchip${sel ? ' sel' : ''}" data-act="${act}" data-id="${k}"${i != null ? ` data-i="${i}"` : ''} style="--c:${gradeCol(p.g)}" aria-label="${esc(pname(p.t, p.g, p.el))}">${partImg(k)}<b>${ROMAN[p.g]}</b><small>×${P.parts[k]}</small></button>`; }
function planCost(pl) { return [_t('{n} Gold', { n: fmt(pl.gold) })].concat(Object.keys(pl.mats || {}).map(m => pl.mats[m] + ' ' + MATS[m].n)).join(', '); }
function smithBarHTML() {
  const S = SAVE.meta.smith, lv = S.lv, p = lv >= 100 ? 1 : S.xp / smithNeed(lv);
  return `<div class="fgbox sm"><img src="${iconURL(['pa', 'amboss'])}" alt=""><div><b>${_t('SCHMIEDEMEISTER {lv}', { lv })} · ${esc(smithTitle(lv))}</b><div class="fgxp"><div class="fgbar"><i style="width:${(p * 100).toFixed(1)}%"></i></div><small>${lv >= 100 ? _t('Höchste Stufe erreicht') : _t('{xp}/{need} EP', { xp: fmt(S.xp), need: fmt(smithNeed(lv)) })}</small></div></div>${wbHelpBtn('smith')}</div>${wbHelpBox('smith')}`;
}
function smithBoxHTML(compact) {
  if (compact) return smithBarHTML();
  const S = SAVE.meta.smith, lv = S.lv, nx = smithNext(lv), p = lv >= 100 ? 1 : S.xp / smithNeed(lv);
  return `<div class="fgbox"><img src="${iconURL(['pa', 'amboss'])}" alt=""><div><b>${_t('SCHMIEDEMEISTER {lv}', { lv })} · ${esc(smithTitle(lv))}</b><div class="fgbar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
  <small>${lv >= 100 ? _t('Höchste Stufe erreicht') : _t('{xp}/{need} EP', { xp: fmt(S.xp), need: fmt(smithNeed(lv)) })}${nx ? ' · ' + _t('Stufe {lv}: {title}', { lv: nx[0], title: esc(nx[1]) }) : ''}</small>
  <small>${nb(_t('Kombinieren −{a} Gold · Meisterwurf {b} · Extra-Bauteil {c} · Meisterstück {d}', { a: pc1(SMB.comb(lv)), b: pc1(SMB.lucky(lv)), c: pc1(SMB.extra(lv)), d: pc1(SMB.rar(lv)) }))}</small></div></div>`;
}
function fgRerender() { if (FG.scr === 'char') openChar(); else openWorkbench(); }
const nb = s => String(s).replace(/ %/g, ' %');   // Prozentzeichen nicht allein umbrechen

/* ---------- Bauteile, Edelsteine (Listen) ---------- */
// Liste der Bauteile (mit Kombinieren); grp = nur diese Arten
function partListHTML(grp) {
  const keys = Object.keys(P.parts).filter(k => P.parts[k] > 0 && grp.includes(pparse(k).t)).sort((a, b) => { const x = pparse(a), y = pparse(b); return PARTORDER.indexOf(x.t) - PARTORDER.indexOf(y.t) || ELORDER.indexOf(x.el) - ELORDER.indexOf(y.el) || y.g - x.g; });
  if (!keys.length) return `<p class="sub">${_t('Noch keine Bauteile. Gegner lassen manchmal welche fallen (Elite und Bosse öfter) – oder zerlege Gegenstände.')}</p>`;
  return keys.map(k => {
    const p = pparse(k), n = P.parts[k], c = p.g < 10 ? combCost(p.g) : null, ok = combOk(k), pool = combHave(k), many = Math.floor(pool / 3);
    const btn = c ? `<button class="btn sm" data-act="fg_comb" data-id="${k}" ${ok ? '' : 'disabled'}>${_t('3 → 1').replace('→', '<span class="fgar">→</span>')}</button>${many >= 2 ? `<button class="btn alt sm" data-act="fg_comball" data-id="${k}" ${ok ? '' : 'disabled'}>${_t('Alle ({n}×)', { n: many })}</button>` : ''}` : `<span class="pill">${_t('MAX')}</span>`;
    const more = !c ? '' : pool < 3 ? ' · <span class="wbdim">' + _t('noch {n} für 3 → 1', { n: 3 - pool }) + '</span>' : pool > n ? ' · ' + _t('mit anderen Elementen: {n}', { n: pool }) : '';
    return `<div class="row fgrow" style="cursor:default"><div class="ic">${partImg(k)}</div><div><div class="nm"><span style="color:${gradeCol(p.g)}">${esc(pname(p.t, p.g, p.el))}</span> <b class="fgn">×${n}</b></div><div class="st">${nb(esc(pdesc(p.t, p.g, p.el)))}${more}</div>${c && pool >= 3 ? costHTML(c.mats, c.gold) : ''}</div><div class="acts">${btn}</div></div>`;
  }).join('');
}
// vorrätige Edelsteine, beste zuerst
function gemKeys() { const L = []; for (let gr = 4; gr >= 0; gr--) for (const id of GEMORDER) if (P.gems[id + ':' + gr] > 0) L.push(id + ':' + gr); return L; }
function gemName(k) { const [id, gr] = k.split(':'); return _t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[id].n }); }
function gemRows(mode) {
  const keys = mode === 'sock' ? gemKeys() : GEMORDER.flatMap(id => [0, 1, 2, 3, 4].map(gr => id + ':' + gr)).filter(k => P.gems[k] > 0);
  if (!keys.length) return `<p class="wbwhy">${_t('Keine Edelsteine. Elite-Gegner, Truhen, Erzadern und Bosse lassen welche fallen.')}</p>`;
  return keys.map(k => {
    const [id, g] = k.split(':'), gr = +g, n = P.gems[k], cost = gemCombineCost(gr);
    const act = mode === 'sock' ? `<button class="btn sm" data-act="sock" data-id="${k}">${_t('Einsetzen')}</button>` : gr < 4 ? `<button class="btn sm" data-act="gcomb" data-id="${id},${gr}" ${n >= 3 && P.gold >= cost ? '' : 'disabled'}>${_t('3 → 1 ({cost} G)', { cost })}</button>` : `<span class="pill">${_t('MAX')}</span>`;
    const more = mode !== 'sock' && gr < 4 ? (n < 3 ? ' · <span class="wbdim">' + _t('noch {n} für 3 → 1', { n: 3 - n }) + '</span>' : P.gold < cost ? ' · <span class="wbbad">' + _t('{n} Gold fehlen', { n: cost - P.gold }) + '</span>' : '') : '';
    return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['gem', id, gr])}" alt=""></div><div><div class="nm" style="color:${GEMS[id].c}">${esc(gemName(k))} ×${n}</div><div class="st">${GEMS[id].s(GEMS[id].v[gr])}${more}</div></div><div class="acts">${act}</div></div>`;
  }).join('');
}
function gemCombPlan() {
  const g = Object.assign({}, P.gems); let gold = P.gold, n = 0, cost = 0;
  for (let gr = 0; gr < 4; gr++) for (const id of GEMORDER) { const k = id + ':' + gr, c = gemCombineCost(gr); while ((g[k] || 0) >= 3 && gold >= c) { g[k] -= 3; gold -= c; cost += c; g[id + ':' + (gr + 1)] = (g[id + ':' + (gr + 1)] || 0) + 1; n++; } }
  return { n, gold: cost };
}
function gemCombAll() { let n = 0; for (let gr = 0; gr < 4; gr++) for (const id of GEMORDER) while (combineGem(id, gr)) n++; return n; }

/* ---------- Bereich VERBESSERN: erst Gegenstand, dann alles dazu ---------- */
function verItems() { return ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean).concat(P.bag, stashItems()); }
function fuseCands(it) { return P.bag.concat(stashItems()).filter(x => x !== it && x.slot === it.slot); }   // Opfer aus Beutel und Lager
const wbFull = () => stashOn() ? _t('Beutel und Lager sind voll.') : _t('Dein Beutel ist voll.');
const wbList = () => WB.src === 'stash' && stashOn() ? stashItems() : P.bag;   // gezeigte Liste: Beutel oder Lager
function fuseBest(it) { let best = null, bs = -1; for (const x of fuseCands(it)) { const s = itemScore(fusePreview(it, x)) * (1 + fuseChance(it, x) * .3); if (s > bs) { bs = s; best = x; } } return best; }
function mwSwapPreview(it, t, k) {
  const p = pparse(k), x = JSON.parse(JSON.stringify(it)); x.mw[t] = p.g; if (PART[t].el) x.el = p.el;
  let sum = 0; for (const y of mwGroup(x.slot)) sum += x.mw[y] || 0; const nr = mwRar(sum); if (nr > x.rar && x.rar < 5) x.rar = nr;
  return x;
}
function salvTxt(it) {
  const pv = salvPreview(it), types = pv.types ? pv.types.map(t => pbase(t, PART[t].el ? it.el : null)).join(', ') : '', g = pv.g ? GRADE[pv.g[0]].n + '–' + GRADE[pv.g[1]].n : '';
  const y = pv.mw ? (pv.mw.length ? _t('Ergibt: {list} (je eine Stufe tiefer)', { list: pv.mw.join(', ') }) : _t('Ergibt keine Bauteile (alle auf Stufe Roh).'))
    : pv.n[1] === 1 ? _t('Ergibt 1 Bauteil ({types}), Stufe {g}', { types, g }) : _t('Ergibt {n} Bauteile ({types}), Stufe {g}', { n: pv.n[0] === pv.n[1] ? pv.n[0] : pv.n[0] + '–' + pv.n[1], types, g });
  const m = (pv.M.x ? _t('Dazu {m} und vielleicht {x}.', { m: MATS[pv.M.m].n, x: MATS[pv.M.x].n }) : _t('Dazu {m}.', { m: MATS[pv.M.m].n })) + (it.gems.length ? ' ' + _t('Edelsteine kommen zurück in den Vorrat.') : '') + (hasMods(it) ? ' ' + _t('Mods kommen zurück in den Vorrat.') : '');
  return y + (y.endsWith('.') ? ' ' : '. ') + m + ' ' + _t('Beim Händler: {gold} Gold.', { gold: itemPrice(it) });
}
function verActs(it) {
  const A = [], md = typeof modVerBody === 'function';   // Mods, Veredeln, Extrahieren: js/mods.js
  if (wbCan('up')) A.push('up'); if (md && wbCan('mods')) A.push('mods'); if (wbCan('fuse')) A.push('fuse'); if (wbCan('sock') || wbCan('drill')) A.push('sock');
  if (wbCan('reroll')) A.push('reroll'); if (md && wbCan('refine')) A.push('refine'); if (wbCan('umbau') && it.mw) A.push('umbau');
  if (md && wbCan('extract') && itemList(it)) A.push('extract'); if (wbCan('salv') && itemList(it)) A.push('salv');
  return A;
}
// Kopfzeile einer Aktion: Bild, Name, Zustand (grün = geht, rot = Material fehlt, grau = gerade nichts zu tun)
function verHead(k, it) {
  switch (k) {
    case 'up': { const c = it.up < 10 && upCost(it, it.up + 1); return { ic: iconURL(['pa', 'wbup']), n: _t('AUFWERTEN'), st: c ? _t('+{a} → +{b} · {p} % Chance', { a: it.up, b: it.up + 1, p: Math.round(c.chance * 100) }) : _t('Maximal aufgewertet.'), cls: !c ? '' : canAfford(c.mats, c.gold) ? 'ok' : 'bad' }; }
    case 'fuse': { const C = fuseCands(it), n = C.length, ns = C.filter(inStash).length, mx = (it.fz || 0) >= fuseMax(); return { ic: iconURL(['pa', 'wbfuse']), n: _t('VERSCHMELZEN'), st: mx ? _t('Maximal verschmolzen ({n} ★)', { n: fuseMax() }) : n ? (ns ? _t('{n} passende Opfer in Beutel und Lager', { n }) : _t('{n} passende Opfer im Beutel', { n })) : _t('Kein passendes Opfer im Beutel'), cls: mx || !n ? '' : 'ok' }; }
    case 'sock': { const free = it.sockets - it.gems.length; return { ic: iconURL(['gem', 'saphir', 3]), n: _t('SOCKEL'), st: it.sockets ? _t('{free} von {n} frei', { free, n: it.sockets }) + (it.gems.length ? ' · ◆' + it.gems.length : '') : _t('Keine Sockel'), cls: free > 0 && wbCan('sock') && gemKeys().length ? 'ok' : '' }; }
    case 'reroll': { if (typeof modVerHead === 'function') return modVerHead(k, it); const R = recipeById('reroll'), n = Object.keys(it.aff).length; return { ic: iconURL(['fx', 'sparks', 2]), n: _t('UMSCHMIEDEN'), st: !it.rar ? _t('Keine Zusatzwerte') : n === 1 ? _t('1 Zusatzwert neu würfeln') : _t('{n} Zusatzwerte neu würfeln', { n }), cls: it.rar && canAfford(R.cost, R.gold) ? 'ok' : '' }; }
    case 'mods': case 'refine': case 'extract': return modVerHead(k, it);
    case 'umbau': { const n = mwGroup(it.slot).filter(t => mwSwapOpts(it, t).length).length; return { ic: iconURL(['pa', 'amboss']), n: _t('UMBAUEN'), st: n ? _t('Bessere Bauteile vorrätig!') : mwGroup(it.slot).map(t => pshort(t, it.mw[t] || 0, PART[t].el ? it.el : null)).join(' · '), cls: n ? 'ok' : '' }; }
    case 'salv': { const pv = salvPreview(it), n = pv.mw ? String(pv.mw.length) : pv.n[0] === pv.n[1] ? pv.n[0] : pv.n[0] + '–' + pv.n[1]; return { ic: iconURL(['pa', 'wbzer']), n: _t('ZERLEGEN'), st: _t('ergibt {n} Bauteile', { n }), cls: '' }; }
  }
}
function verBody(k, it) {
  let h = wbIntro(k, WB_INTRO[k]());
  if (k === 'up') {
    const c = it.up < 10 ? upCost(it, it.up + 1) : null;
    if (!c) return h + `<p class="sub">${_t('Maximal aufgewertet.')}</p>`;
    return h + cmpHTML(it, Object.assign({}, it, { up: it.up + 1 })) + `<p class="wbline">${_t('Erfolgschance: {p}', { p: `<b style="color:${c.chance < 1 ? 'var(--gold)' : 'var(--moss)'}">${Math.round(c.chance * 100)} %</b>` })}${wbFree ? ' ' + _t('(Werkbank-Bonus +5 %)') : ''}${c.chance < 1 ? ' · ' + _t('Bei Misserfolg sind nur die Materialien weg.') : ''}</p>`
      + wbCost(c.mats, c.gold) + wbBtn('up', _t('Aufwerten · {p} %', { p: Math.round(c.chance * 100) }), canAfford(c.mats, c.gold) ? '' : true);
  }
  if (k === 'fuse') {
    if ((it.fz || 0) >= fuseMax()) return h + `<p class="wbwhy">${esc(fuseCheck(it, null))}</p>`;
    const C = fuseCands(it);
    if (!C.length) return h + `<p class="wbwhy">${stashOn() ? _t('Du brauchst einen zweiten Gegenstand derselben Art ({art}) in Beutel oder Lager – er wird geopfert.', { art: slotLabel(it.slot) }) : _t('Du brauchst einen zweiten Gegenstand derselben Art ({art}) im Beutel – er wird geopfert.', { art: slotLabel(it.slot) })}</p>`;
    const Bf = fuseB && findItem(fuseB), B = Bf && C.includes(Bf.it) ? Bf.it : null;
    const vict = x => `<button class="slot${x === B ? ' fb' : ''}" data-act="fsel" data-id="${x.uid}" style="box-shadow:inset 0 0 0 2px ${itemColor(x)}${x === B ? ',0 0 0 3px #c8463c' : ''}" aria-label="${esc(itemName(x))}"><img src="${itemIconURL(x)}" alt="">${x === B ? `<span class="u" style="color:#ff6a5a">${_t('OPFER')}</span>` : x.up ? `<span class="u">+${x.up}</span>` : ''}${x.fz ? `<span class="n">★${x.fz}</span>` : ''}</button>`, Cb = C.filter(x => !inStash(x)), Cs = C.filter(inStash);
    h += `<div class="wbrowh"><span>${_t('Opfer antippen – es vergeht:')}</span>${C.length > 1 ? `<button class="btn alt sm" data-act="fbest">${_t('Bestes wählen')}</button>` : ''}</div>${Cb.length ? `<div class="igrid${Cb.length > 18 ? ' scroll' : ''}" data-sk="wbvb"><div class="grid wbvict">${Cb.map(vict).join('')}</div></div>` : ''}${Cs.length ? `<p class="wbdim">${_t('Aus dem Lager:')}</p><div class="igrid${Cs.length > 18 ? ' scroll' : ''}" data-sk="wbvs"><div class="grid wbvict">${Cs.map(vict).join('')}</div></div>` : ''}`;
    if (!B) return h + wbBtn('fuse', _t('Verschmelzen'), _t('Tippe zuerst ein Opfer an.'));
    const R = fusePreview(it, B), ch = fuseChance(it, B), c = fuseCost(it, B);
    h += `<p class="wbline">${_t('Opfer: {item}', { item: `<b style="color:${itemColor(B)}">${esc(itemName(B))}</b>` })}</p>` + cmpHTML(it, R);
    if (ch > 0 && ch < 1) h += `<p class="wbline">${_t('Dazu {chance} auf {rar} mit einem weiteren Zusatzwert.', { chance: `<b style="color:var(--rune)">${_t('{p} % Chance', { p: Math.round(ch * 100) })}</b>`, rar: it.rar === 4 ? `<b style="color:#ff4fd8">${_t('MYTHISCH')}</b>` : RAR[it.rar + 1].n })}</p>`;
    if (inStash(B)) h += `<p class="wbline">${_t('Das Opfer liegt im Lager.')}</p>`;
    if (B.gems.length) h += `<p class="wbline">${_t('Edelsteine des Opfers kommen zurück in den Vorrat.')}</p>`;
    return h + wbCost(c.mats, c.gold) + wbBtn('fuse', _t('Verschmelzen'), canAfford(c.mats, c.gold) ? '' : true);
  }
  if (k === 'sock') {
    const free = it.sockets - it.gems.length;
    if (it.gems.length) {
      h += `<ul class="wbgems">${it.gems.map(g => { const [id, gr] = g.split(':'); return `<li style="color:${GEMS[id].c}">${esc(gemName(g))}: ${GEMS[id].s(GEMS[id].v[+gr])}</li>`; }).join('')}</ul>`;
      if (wbCan('sock')) { const c = 40 + it.gems.length * 20; h += wbBtn('unsock', _t('Edelsteine entfernen ({gold} Gold)', { gold: c }), P.gold >= c ? '' : _t('Dir fehlt Gold.'), { cls: 'alt sm' }); }
    }
    if (wbCan('sock')) {
      const G = gemKeys();
      if (free <= 0) h += `<p class="wbwhy">${it.sockets ? _t('Alle Sockel sind belegt.') : _t('Dieser Gegenstand hat keine Sockel.')} ${wbCan('drill') ? _t('Unten kannst du einen bohren.') : _t('Sockel bohrt Borin in der Schmiede – oder jede Werkbank unterwegs.')}</p>`;
      else if (!G.length) h += gemRows('sock');
      else h += `<div class="wbrowh"><span>${free === 1 ? _t('1 freier Sockel – Edelstein wählen:') : _t('{n} freie Sockel – Edelstein wählen:', { n: free })}</span>${G.length > 1 ? `<button class="btn sm" data-act="sockbest">${_t('Besten einsetzen')}</button>` : ''}</div>` + gemRows('sock');
    } else h += `<p class="wbwhy">${_t('Edelsteine setzt Selis im Juwelier ein – oder jede Werkbank unterwegs.')}</p>`;
    if (wbCan('drill')) {
      const R = recipeById('socket');
      h += `<div class="wbsep"><b>${_t('SOCKEL BOHREN')}</b><small>${_t('{n}/3 Sockel · 75 % Chance', { n: it.sockets })}</small></div>` + (it.sockets >= 3 ? `<p class="sub">${_t('Schon 3 Sockel')}</p>` : wbCost(R.cost, R.gold) + wbBtn('craft', _t('Sockel bohren'), canAfford(R.cost, R.gold) ? '' : true, { id: 'socket', cls: 'alt' }));
    }
    return h;
  }
  if (typeof modVerBody === 'function' && (k === 'mods' || k === 'reroll' || k === 'refine' || k === 'extract')) return h + modVerBody(k, it);
  if (k === 'reroll') {
    const R = recipeById('reroll'), pool = it.slot === 'weapon' ? AFFW : AFFA, L = Object.keys(it.aff).map(a => pool[a].s(it.aff[a]));
    if (L.length) h += `<ul class="wbgems">${L.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`;
    return h + wbCost(R.cost, R.gold) + wbBtn('craft', esc(R.n), !it.rar ? _t('Gewöhnliche Gegenstände haben keine Zusatzwerte.') : canAfford(R.cost, R.gold) ? '' : true, { id: 'reroll' });
  }
  if (k === 'umbau') {
    const grp = mwGroup(it.slot), best = []; let gold = 0;
    grp.forEach((t, i) => {
      const cur = it.mw[t] || 0, el = PART[t].el ? it.el : null, O = mwSwapOpts(it, t), sel = O.includes(WB.swap[t]) ? WB.swap[t] : O[0];
      h += `<div class="wbpart"><div class="wbpart-h">${cur ? partImg(pkey(t, cur, PART[t].el ? el || 'feuer' : null)) : ''}<b>${esc(cur ? pname(t, cur, el) : PART[t].n)}</b><small>${esc(PART_ROLE[t])}</small></div>`;
      if (!O.length) { h += `<p class="wbdim">${_t('Kein besseres Bauteil vorrätig.')}</p></div>`; return; }
      const o = mwSwapOk(it, t, sel); best.push(O[0]); gold += mwSwapOk(it, t, O[0]).gold;
      h += `<div class="wbchips">${O.map(x => partChip(x, x === sel, 'mw_swpk', i)).join('')}</div>${cmpHTML(it, mwSwapPreview(it, t, sel))}${wbBtn('mw_swap', _t('{part} einbauen · {gold} Gold', { part: esc(pshort(t, o.p.g, o.p.el)), gold: fmt(o.gold) }), P.gold >= o.gold ? '' : _t('Dir fehlt Gold.'), { id: it.uid, i, cls: 'sm' })}</div>`;
    });
    if (best.length > 1) h += wbBtn('mw_swapall', _t('Alle besten einbauen ({gold} Gold)', { gold: fmt(gold) }), P.gold >= gold ? '' : _t('Dir fehlt Gold.'), { id: it.uid });
    return h;
  }
  if (k === 'salv') {
    const arm = zrArm === it.uid;
    return h + `<p class="wbline">${esc(salvTxt(it))}</p>` + wbBtn('zr_one', arm ? _t('Wirklich zerlegen?') : _t('Zerlegen'), '', { id: it.uid, cls: arm ? 'red' : 'alt' }) + (arm ? `<p class="wbwhy">${_t('Wertvoller Gegenstand – nochmal tippen zum Bestätigen.')}</p>` : '');
  }
  return h;
}
function verPickHTML(it) {
  const gear = ['weapon', 'armor', 'helm'].map(s => { const x = P.gear[s]; return x ? `<button class="wbgear${x === it ? ' sel' : ''}" data-act="wsel" data-id="${x.uid}" style="--c:${itemColor(x)}" aria-label="${esc(itemName(x))}"><span class="slot0"><img src="${itemIconURL(x)}" alt="">${x.up ? `<em>+${x.up}</em>` : ''}</span><small>${slotLabel(s)}</small></button>` : `<div class="wbgear"><span class="slot0" style="--c:var(--stone-hi)"></span><small>${slotLabel(s)}</small></div>`; }).join('');
  const loose = !!itemList(it), L = wbList(), st = L !== P.bag;
  const bag = `<button class="wbgear bag${loose ? ' sel' : ''}" data-act="wb_bag" aria-expanded="${WB.bag}" style="--c:${loose ? itemColor(it) : 'var(--stone-hi)'}"><span class="slot0">${loose ? `<img src="${itemIconURL(it)}" alt="">` : `<b>${L.length}</b>`}</span><small>${st ? _t('Lager') : _t('Beutel')} ${WB.bag ? '▴' : '▾'}</small></button>`;
  const grid = itemGridHTML(L.map(x => itemSlot(x, 'wsel', x === it)), st ? 'wbst' : 'wbbag', st ? _t('Das Lager ist leer.') : _t('Dein Beutel ist leer.'));
  return `<div class="wbpick">${gear}${bag}</div><div class="wbbag${WB.bag ? ' open' : ''}">${srcTabs('wb_src', st ? 'stash' : 'bag')}${st ? capHead(_t('LAGER'), L.length, stashCap()) : capHead(_t('BEUTEL'), P.bag.length, bagCap())}${grid}</div>`;
}
function verHTML(it) {
  if (!it) return wbIntro('ver', WB_INTRO.ver()) + `<p class="sub">${_t('Wähle einen Gegenstand aus dem Beutel.')}</p>`;
  const acts = verActs(it), f = findItem(it.uid);
  if (WB.act !== '' && !acts.includes(WB.act)) WB.act = acts.find(k => verHead(k, it).cls === 'ok') || acts[0] || '';
  const top = (f && f.eq ? `<span class="pill">${_t('ANGELEGT')}</span>` : canEquip(it) ? `<button class="btn sm" data-act="mw_equip" data-id="${it.uid}">${_t('Anlegen')}</button>` : '') + (f && f.si != null ? `<span class="pill dim" style="align-self:center">${_t('IM LAGER')}</span>` : '');
  const list = acts.map(k => { const H = verHead(k, it), open = WB.act === k; return `<div class="wbact${open ? ' open' : ''}"><button class="wbah" data-act="wb_act" data-id="${k}" aria-expanded="${open}"><img src="${H.ic}" alt=""><span><b>${H.n}</b><small class="${H.cls}">${H.st}</small></span><i>${open ? '▴' : '▾'}</i></button>${open ? `<div class="wbab">${verBody(k, it)}</div>` : ''}</div>`; }).join('');
  return `${wbIntro('ver', WB_INTRO.ver())}<div class="split wbver"><div>${verPickHTML(it)}</div><div class="side">${itemDetail(it, top)}${f && !f.eq ? compareHTML(it) : ''}<div class="wbacts">${list}</div></div></div>`;
}

/* ---------- Bereich SCHMIEDEN: Meisterwerk in 5 Schritten ---------- */
const MW_STEPS = [_t('Was?'), _t('Material'), _t('Bauteile'), _t('Vorschau'), _t('Schmieden')];
function mwSampleURL(slot, tier, base, form) { return itemIconURL({ slot, base: slot === 'weapon' ? base : slot, form: slot === 'weapon' ? form : undefined, tier, rar: 1, aff: {}, gems: [], up: 0, sockets: 0, set: null, name: null, suf: null, fz: 0 }); }
function mwFormFx(F) {
  const fx = [];
  if ((F.dm || 1) !== 1) fx.push(_t('Schaden {v}', { v: (F.dm > 1 ? '+' : '−') + pct(Math.abs(F.dm - 1)) })); if ((F.sp || 1) !== 1) fx.push(F.sp < 1 ? _t('schneller') : _t('langsamer'));
  if (F.crit) fx.push(_t('Krit +{v}', { v: pct(F.crit) })); if (F.range) fx.push(_t('Reichweite +{v}', { v: F.range })); if (F.kb) fx.push(_t('Wucht +{v}', { v: pct(F.kb - 1) }));
  return fx.length ? fx.join(' · ') : _t('ausgewogen');
}
function mwWhy(s) {
  return s.miss ? _t('Es fehlt noch: {part}', { part: PART[s.miss].n }) : !forgeOk(s.tier) ? _t('Dieses Material kannst du ab Level {lv} verarbeiten.', { lv: REQ[s.tier] })
    : !roomFor() ? wbFull() : canAfford(s.cost.mats, s.cost.gold) ? '' : _t('Dir fehlt noch Material oder Gold – siehe oben.');
}
function mwWizardHTML() {
  mwInit();
  if (MW.step === 5 && !(FG.last && FG.last.k === 'mw')) MW.step = 1;
  const st = MW.step = clamp(MW.step || 1, 1, 5), s = mwState(), C = CLASSES[P.cls], prev = mwPreviewItem(s), M = MAT[s.tier];
  const what = s.slot === 'weapon' ? (WFORM[MW.base].find(f => f.id === MW.form) || WFORM[MW.base][0]).n : C.names[s.tier][s.slot === 'armor' ? 0 : 1];
  const sum = [esc(slotLabel(s.slot)), esc(what), `<span style="color:${M.m[2]}">${esc(M.n)}</span>`].concat(s.grp.map(t => s.picks[t] ? `<span style="color:${gradeCol(pparse(s.picks[t]).g)}">${esc(pshort(t, pparse(s.picks[t]).g, pparse(s.picks[t]).el))}</span>` : `<span class="wbbad">${esc(_t('{part} fehlt', { part: PART[t].n }))}</span>`)).join(' · ');
  let h = `<div class="mwhead"><div>${smithBarHTML()}</div><div>${wbIntro('mw', WB_INTRO.sch())}</div></div>`
    + `<div class="mwsteps">${MW_STEPS.map((l, i) => { const n = i + 1; return `<button class="mws${n === st ? ' cur' : n < st ? ' done' : ''}" data-act="mw_step" data-i="${n}" ${n === 5 || n === st ? 'disabled' : ''}><b>${n < st ? '✓' : n}</b><small>${l}</small></button>`; }).join('')}</div>`
    + (st > 1 && st < 5 ? `<p class="mwsum">${sum}</p>` : '');
  const back = `<button class="btn alt" data-act="mw_step" data-i="${st - 1}">‹ ${MW_STEPS[st - 2]}</button>`, next = (why, n) => wbBtn('mw_step', _t('Weiter: {step} ›', { step: MW_STEPS[n - 1] }), why, { i: n });
  let main = '', nav = '', side = '';
  if (st === 1) {
    main = `<h3>${_t('1 · WAS WILLST DU SCHMIEDEN?')}</h3><div class="wbtiles">${['weapon', 'armor', 'helm'].map(x => `<button class="opt wbtile${s.slot === x ? ' sel' : ''}" data-act="mw_slot" data-id="${x}"><img src="${mwSampleURL(x, s.tier, MW.base, MW.form)}" alt="">${slotLabel(x)}</button>`).join('')}</div>`;
    if (s.slot === 'weapon') {
      if (C.weapons.length > 1) main += `<div class="opts">${C.weapons.map(b => `<button class="opt${MW.base === b ? ' sel' : ''}" data-act="mw_base" data-id="${b}">${WT[b].label}</button>`).join('')}</div>`;
      main += `<h3>${_t('FORM')}</h3><div class="wbforms">${WFORM[MW.base].map(F => `<button class="wbform${F.id === MW.form ? ' sel' : ''}" data-act="mw_form" data-id="${F.id}"><img src="${mwSampleURL('weapon', s.tier, MW.base, F.id)}" alt=""><b>${esc(F.n)}</b><small>${esc(mwFormFx(F))}</small></button>`).join('')}</div>`;
    } else main += `<p class="sub">${s.slot === 'armor' ? _t('Rüstung: Panzerplatte (Verteidigung), Polsterung (Lebenspunkte) und Rune (Element-Schutz).') : _t('Helm: Panzerplatte (Verteidigung), Polsterung (Lebenspunkte) und Rune (Element-Schutz).')}</p>`;
    if (['weapon', 'armor', 'helm'].map(x => P.gear[x]).concat(P.bag).some(x => x && x.mw)) main += `<p class="sub">${_t('Schon ein Meisterwerk? Bessere Bauteile baust du unter VERBESSERN ein.')}</p>`;
    nav = next('', 2).replace('class="btn"', 'class="btn full"');
  } else if (st === 2) {
    const top = REQ.filter(r => r <= P.lv).length - 1;
    main = `<h3>${_t('2 · AUS WELCHEM MATERIAL?')}</h3><p class="sub">${_t('Besseres Material gibt höhere Grundwerte. Rot heißt: fehlt dir noch.')}</p>`;
    main += MAT.map((Mt, t) => {
      if (t > top + 1) return '';
      const c = forgeCost(t, s.slot), lock = t > top;
      return `<button class="row wbmat${t === s.tier ? ' sel' : ''}" data-act="mw_mat" data-i="${t}" ${lock ? 'disabled' : ''}><div class="ic"><img src="${mwSampleURL(s.slot, t, MW.base, MW.form)}" alt=""></div><div><div class="nm" style="color:${Mt.m[2]}">${esc(Mt.n)}${s.slot !== 'weapon' ? ' · ' + esc(C.names[t][s.slot === 'armor' ? 0 : 1]) : ''}</div><div class="st">${_t('Stufe {n}', { n: t + 1 })}${lock ? ' · <span class="wbbad">' + _t('ab Level {lv}', { lv: REQ[t] }) + '</span>' : ''}</div>${lock ? '' : costHTML(c.mats, 0)}</div><span class="wbradio">${t === s.tier ? '✓' : ''}</span></button>`;
    }).join('');
    if (top + 2 < TIERS) main += `<p class="sub">${_t('Noch {n} bessere Materialien ab Level {lv}.', { n: TIERS - top - 2, lv: REQ[top + 2] })}</p>`;
    const qc = forgeCost(s.tier, s.slot), qwhy = !forgeOk(s.tier) ? _t('Dieses Material kannst du ab Level {lv} verarbeiten.', { lv: REQ[s.tier] }) : !roomFor() ? wbFull() : canAfford(qc.mats, qc.gold) ? '' : true;
    main += `<div class="wbbox">${wbIntro('quick', _t('Ohne Bauteile? Schnell schmieden: ein Zufallsstück aus {mat}.', { mat: esc(M.n) }))}${wbCost(qc.mats, qc.gold)}${wbBtn('forge', _t('Schnell schmieden'), qwhy, { cls: 'alt' })}</div>`;
    nav = back + next('', 3);
  } else if (st === 3) {
    const plan = combPlan(s.grp), better = s.grp.some(t => { const o = mwOptions(t); return o.length && s.picks[t] !== o[0]; });
    main = `<h3>${_t('3 · BAUTEILE')}</h3><div class="wbhelpers"><button class="btn sm" data-act="mw_best" ${better ? '' : 'disabled'}>${_t('Beste wählen')}</button><button class="btn alt sm" data-act="fg_combgrp" data-id="${s.slot}" ${plan.n ? '' : 'disabled'}>${plan.n ? _t('Alle kombinieren ({n}×)', { n: plan.n }) : _t('Alle kombinieren')}</button></div>`;
    main += `<p class="wbline">${better ? _t('Tippe ein Bauteil an, um es zu wählen.') : _t('Die besten sind gewählt.')} ${plan.n ? _t('Kombinieren kostet {cost}.', { cost: planCost(plan) }) : _t('Zum Kombinieren brauchst du 3 gleiche.')}</p>`;
    for (const t of s.grp) {
      const o = mwOptions(t), k = s.picks[t], p = k && pparse(k);
      main += `<div class="wbpart"><div class="wbpart-h"><b>${esc(PART[t].n)}</b><small>${esc(PART_ROLE[t])}</small></div>`
        + (o.length ? `<div class="wbchips">${o.map(x => partChip(x, x === k, 'mw_pk')).join('')}</div><p class="wbline"><b style="color:${gradeCol(p.g)}">${esc(pname(p.t, p.g, p.el))}</b>: ${nb(esc(pdesc(p.t, p.g, p.el)))}</p>`
          : `<p class="wbwhy">${_t('Du hast keins.')} ${s.slot === 'weapon' ? _t('Zerlege Waffen oder besiege Gegner – Elite und Bosse lassen öfter etwas fallen.') : _t('Zerlege Rüstungen und Helme oder besiege Gegner – Elite und Bosse lassen öfter etwas fallen.')}</p>${wbCan('salv') && P.bag.length ? `<button class="btn alt sm" data-act="wtab" data-id="zer">${_t('Zum Zerlegen ›')}</button>` : ''}`) + '</div>';
    }
    const nx = MW_RSTEP[s.rar];
    main += `<div class="wbrar"><div class="wbrarbar">${[1, 2, 3, 4].map(r => `<i class="${s.rar >= r ? 'on' : ''}" style="--c:${RAR[r].c}">${RAR[r].n}</i>`).join('')}</div>${wbIntro('rar', _t('Summe der Stufen {sum}: {rar}', { sum: s.sum, rar: `<b style="color:${RAR[s.rar].c}">${RAR[s.rar].n}</b>` }) + (nx ? ' · ' + _t('noch {n} bis {rar}', { n: nx - s.sum, rar: RAR[s.rar + 1].n }) : ''))}</div>`;
    nav = back + next(s.miss ? _t('Es fehlt noch: {part}', { part: PART[s.miss].n }) : '', 4);
  } else if (st === 4) {
    const cur = P.gear[s.slot], lv = smithLv();
    main = `<h3>${_t('4 · VORSCHAU')}</h3>${itemDetail(prev, '')}<p class="wbline">${RAR[s.rar].aff === 1 ? _t('Dazu ein zufälliger Zusatzwert.') : _t('Dazu {n} zufällige Zusatzwerte.', { n: RAR[s.rar].aff })}${lv > 1 ? ' ' + _t('{p} Chance auf ein Meisterstück (Seltenheit +1).', { p: pc1(SMB.rar(lv)) }) : ''}</p>`;
    if (cur) main += cmpHTML(cur, prev, _t('Im Vergleich zu {item}', { item: esc(itemName(cur)) }), true);
    side = `<h3>${_t('KOSTEN')}</h3>${wbCost(s.cost.mats, s.cost.gold)}`;
    nav = back + wbBtn('mw_make', _t('Meisterwerk schmieden'), mwWhy(s));
  } else return h + fgLastHTML('mw');
  // Hochformat: Knöpfe unten fest. Querformat: rechts Vorschau, Kosten und Knöpfe (bleiben beim Scrollen stehen)
  if (st < 4) side = `<h3 style="margin-top:0">${_t('VORSCHAU')}</h3>${mwLiveHTML(prev)}${costHTML(s.cost.mats, s.cost.gold)}`;
  return h + `<div class="split"><div>${main}</div><div class="side${st < 4 ? ' mwlive' : ''}">${side}<div class="mwnav">${nav}</div></div></div><div class="wbfoot mw">${nav}</div>`;
}
function mwLiveHTML(it) { return `<div class="detail"><div style="display:flex;gap:10px;align-items:center"><div class="ic big" style="box-shadow:inset 0 0 0 2px ${itemColor(it)}"><img src="${itemIconURL(it)}" alt=""></div><div><div class="nm" style="color:${itemColor(it)}">${esc(itemName(it))}</div><div class="st" style="color:var(--parch-dim);font-size:16px">${RAR[it.rar].n} · ${esc(itemLines(it)[0])}</div></div></div></div>`; }
function fgLastHTML(tab) {
  const L = FG.last; if (!L || L.tab !== tab) return '';
  if (L.k === 'salv') {
    const chips = Object.keys(L.parts).map(k => `<span>${partImg(k)}<b style="color:${gradeCol(pparse(k).g)}">${esc(pshort(pparse(k).t, pparse(k).g, pparse(k).el))}</b>${L.parts[k] > 1 ? ' ×' + L.parts[k] : ''}</span>`).join('') + Object.keys(L.mats).map(m => `<span><img src="${iconURL(['mat', m])}" alt="">${L.mats[m]} ${MATS[m].n}</span>`).join('');
    return `<div class="fglast"><b>${L.n === 1 ? _t('ZERLEGT: 1 GEGENSTAND') : _t('ZERLEGT: {n} GEGENSTÄNDE', { n: L.n })}</b><div class="fgchips">${chips}</div><small>${_t('+{xp} Schmiede-EP', { xp: fmt(L.xp) })}${L.gems ? ' · ' + _t('{n} Edelsteine zurück in den Vorrat', { n: L.gems }) : ''}${L.mods ? ' · ' + _t('{n} Mods zurück in den Vorrat', { n: L.mods }) : ''}</small></div>`;
  }
  if (L.k === 'mw') {
    const f = findItem(L.uid); if (!f) return '';
    const btns = (!f.eq && canEquip(f.it) ? `<button class="btn sm" data-act="mw_equip" data-id="${f.it.uid}">${_t('Anlegen')}</button>` : f.eq ? `<span class="pill">${_t('ANGELEGT')}</span>` : '')
      + `<button class="btn alt sm" data-act="mw_again">${_t('Noch eins schmieden')}</button>${wbCan('up') ? `<button class="btn alt sm" data-act="mw_ver" data-id="${f.it.uid}">${_t('Verbessern ›')}</button>` : ''}`;
    return `<div class="fglast"><b>${L.quick ? _t('GESCHMIEDET') : L.lucky ? _t('MEISTERSTÜCK! SELTENHEIT +1') : _t('MEISTERWERK GESCHMIEDET')}</b>${itemDetail(f.it, btns)}${!f.eq ? compareHTML(f.it) : ''}${f.si != null ? `<p class="wbline">${_t('Der Beutel war voll – es liegt im Lager.')}</p>` : ''}</div>`;
  }
  return '';
}

/* ---------- Bereich ZERLEGEN ---------- */
function zrTabHTML(it0) {
  FG.scr = 'wb';
  const Lz = wbList(), st = Lz !== P.bag;
  let it = it0 && Lz.includes(it0) ? it0 : Lz[0] || null; if (it && it !== it0) selItem = it.uid;
  const grid = srcTabs('wb_src', st ? 'stash' : 'bag') + itemGridHTML(Lz.map(x => itemSlot(x, 'wsel', x === it)), st ? 'zrst' : 'zrbag', st ? _t('Das Lager ist leer.') : _t('Dein Beutel ist leer. Angelegte Ausrüstung kann nicht zerlegt werden.'));
  let armed = '';
  const bulk = [0, 1].map(r => {
    const L = salvBulkList(r, WB.zst), n = L.length, arm = zrArm === 'all' + r;
    if (arm) { let a = 0, b = 0; for (const x of L) { const pv = salvPreview(x); a += pv.n[0]; b += pv.n[1]; } armed = _t('{n} Gegenstände ergeben etwa {k} Bauteile. Nochmal tippen zum Bestätigen.', { n, k: a === b ? a : a + '–' + b }); }
    return `<button class="btn ${arm ? 'red' : 'alt'}" data-act="zr_all" data-id="${r}" ${n ? '' : 'disabled'}>${arm ? _t('Sicher? {n} zerlegen', { n }) : r ? _t('Alles Magische zerlegen ({n})', { n }) : _t('Alles Gewöhnliche zerlegen ({n})', { n })}</button>`;
  }).join('');
  let side = '';
  if (it) {
    const arm = zrArm === it.uid;
    side = `<div class="row zrcard" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${itemColor(it)}"><img src="${itemIconURL(it)}" alt=""></div><div><div class="nm" style="color:${itemColor(it)}">${esc(itemName(it))}</div><div class="st">${RAR[it.rar].n} ${it.slot === 'weapon' ? WT[it.base].label : AR[it.slot].label} · ${MAT[it.tier].n}${it.up ? ' · +' + it.up : ''}${it.gems.length ? ' · ◆' + it.gems.length : ''}</div></div><button class="btn ${arm ? 'red' : ''} sm" data-act="zr_one" data-id="${it.uid}">${arm ? _t('Wirklich zerlegen?') : _t('Zerlegen')}</button></div>`
      + `<p class="sub" style="margin:4px 0 0">${esc(salvTxt(it))}</p>${arm ? `<p class="wbwhy">${_t('Wertvoller Gegenstand – nochmal tippen zum Bestätigen.')}</p>` : ''}`;
  } else side = `<p class="sub">${_t('Wähle einen Gegenstand aus dem Beutel.')}</p>`;
  const zst = stashOn() ? `<button class="opt chk zrst${WB.zst ? ' sel' : ''}" data-act="wb_zst" aria-pressed="${!!WB.zst}"><i class="cb"></i>${_t('Lager einbeziehen')}</button>` : '';
  return `<div class="mwhead"><div>${smithBarHTML()}</div><div>${wbIntro('zer', WB_INTRO.zer())}</div></div>${fgLastHTML('zer')}${zst}<div class="zrbulk">${bulk}</div><p class="${armed ? 'wbwhy' : 'wbline'}">${armed || _t('Ein Tipp für alle einfachen Gegenstände – Aufgewertetes, Verschmolzenes, Gesockeltes, Sets und Meisterwerke bleiben verschont.')}</p><div class="split"><div>${grid}</div><div class="side sheet">${side}</div></div>`;
}

/* ---------- Bereich WERKSTATT: Bauteile, Edelsteine, Rezepte, Farben, Veredeln ---------- */
function wsHTML() {
  const subs = ['parts', 'gems', 'rez', 'dye', 'trans'].filter(wbCan);
  if (!subs.includes(WB.sub)) WB.sub = subs[0];
  const k = WB.sub;
  let h = `<div class="wbsubs" style="--n:${subs.length}">${subs.map(x => `<button class="opt${x === k ? ' sel' : ''}" data-act="wb_sub" data-id="${x}">${WS_SUB[x]}</button>`).join('')}</div>${wbIntro(k, WB_INTRO[k]())}`;
  const stock = `<div class="cost wbstock">${MATORDER.filter(m => P.mats[m]).map(m => `<span title="${MATS[m].n}"><img src="${iconURL(['mat', m])}" alt="">${P.mats[m]} ${MATS[m].n}</span>`).join('') || '<span>' + _t('Keine Materialien') + '</span>'}</div>`;
  if (k === 'parts') {
    const pl = combPlan(PARTORDER);
    h += `<div class="wbhelpers">${wbBtn('fg_combat', pl.n ? _t('Alle Bauteile kombinieren ({n}×)', { n: pl.n }) : _t('Alle Bauteile kombinieren'), pl.n ? '' : true)}</div><p class="${pl.n ? 'wbline' : 'wbdim'}">${pl.n ? _t('Kostet {cost}.', { cost: planCost(pl) }) : _t('Gerade nichts zu kombinieren: du brauchst 3 gleiche Bauteile (gleiche Art und Stufe) und genug Gold.')}</p>`;
    h += `<div class="cols"><div><h3>${_t('FÜR WAFFEN')}</h3>${partListHTML(PARTW)}</div><div><h3>${_t('FÜR RÜSTUNG UND HELM')}</h3>${partListHTML(PARTA)}</div></div>`;
  } else if (k === 'gems') {
    const pl = gemCombPlan();
    h += `<div class="wbhelpers">${wbBtn('gcomball', pl.n ? _t('Alle Edelsteine kombinieren ({n}×)', { n: pl.n }) : _t('Alle Edelsteine kombinieren'), pl.n ? '' : true)}</div><p class="${pl.n ? 'wbline' : 'wbdim'}">${pl.n ? _t('Kostet {cost}.', { cost: planCost(pl) }) : _t('Gerade nichts zu kombinieren: du brauchst 3 gleiche Edelsteine und genug Gold.')}${hideLv('juwelier') >= 2 ? ' ' + _t('Juwelier-Rabatt aktiv.') : ''}</p>${gemRows('comb')}`;
  } else if (k === 'rez') {
    const ic = R => iconURL(R.id === 'potion' ? ['s', 288, 336, 16, 16] : R.id === 'gem' ? ['gem', 'rubin', 1] : R.id === 'socket' ? ['gem', 'saphir', 3] : ['fx', 'sparks', 2]);
    h += stock + RECIPES.map(R => {
      if (R.needItem) { const a = R.id === 'socket' ? 'sock' : 'reroll'; return wbCan(R.id === 'socket' ? 'drill' : 'reroll') ? `<div class="row" style="cursor:default"><div class="ic"><img src="${ic(R)}" alt=""></div><div><div class="nm">${R.n}</div><div class="st">${R.d} – ${_t('unter VERBESSERN beim Gegenstand')}</div></div><button class="btn alt sm" data-act="wb_goact" data-id="${a}">${_t('Wählen ›')}</button></div>` : ''; }
      return `<div class="row" style="cursor:default"><div class="ic"><img src="${ic(R)}" alt=""></div><div><div class="nm">${R.n}</div><div class="st">${R.d}${R.id === 'potion' ? ' · ' + _t('{n}/{max} Heiltränke', { n: P.potions, max: potMax() }) : ''}</div>${costHTML(R.cost, R.gold)}${missLine(R.cost, R.gold)}</div><button class="btn sm" data-act="craft" data-id="${R.id}" ${canAfford(R.cost, R.gold) && !(R.id === 'potion' && P.potions >= potMax()) ? '' : 'disabled'}>${_t('Herstellen')}</button></div>`;
    }).join('');
  } else if (k === 'dye') {
    h += `<div style="display:flex;gap:16px;align-items:center;margin-bottom:10px">${heroHTML(P, 2.4)}${stock}</div>` + DYES.map(D => { const have = P.dyes.includes(D.id); return `<div class="row${P.dye === D.id ? ' sel' : ''}" style="cursor:default"><div class="ic">${heroHTML(Object.assign({}, P, { dye: D.id, look: P.look }), .9)}</div><div><div class="nm">${D.n}</div>${have ? '<div class="st">' + _t('Freigeschaltet') + '</div>' : costHTML(D.cost, 0) + missLine(D.cost, 0)}</div><button class="btn sm" data-act="dye" data-id="${D.id}" ${have || hasMats(D.cost) ? '' : 'disabled'}>${P.dye === D.id ? _t('Aktiv') : have ? _t('Anlegen') : _t('Freischalten')}</button></div>`; }).join('');
  } else if (k === 'trans') {
    h += stock + TRANSMUTE.map(([f, t, n, g], i) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['mat', t])}" alt=""></div><div><div class="nm">${n} ${MATS[f].n} → 1 ${MATS[t].n}</div>${costHTML({ [f]: n }, g)}${missLine({ [f]: n }, g)}</div><button class="btn sm" data-act="trans" data-i="${i}" ${(P.mats[f] || 0) >= n && P.gold >= g ? '' : 'disabled'}>${_t('Veredeln')}</button></div>`).join('');
  }
  return h;
}

/* ---------- Werkbank öffnen ---------- */
function openWorkbench(mode) {
  if (mode !== undefined) { wbMode = mode; wbFree = mode === 'node'; fuseA = fuseB = null; WB.bag = false; WB.help = null; WB.swap = {}; zrArm = null; FG.last = null; if (MW.step === 5) MW.step = 1; }
  const old = WB_OLD[wbTab];
  if (old) { if (old[0] === 'ver' && old[1]) WB.act = old[1]; if (old[0] === 'ws') WB.sub = old[1]; if (wbTab === 'forge') MW.step = 2; wbTab = old[0]; }
  if (fuseA && findItem(fuseA)) { selItem = fuseA; WB.act = 'fuse'; wbTab = 'ver'; } fuseA = null;   // alter Weg: Hauptgegenstand fürs Verschmelzen vorgeben
  const extra = HOOK.wbTabs.filter(t => t.modes.includes(wbMode)), secs = (WB_SECS[wbMode] || WB_SECS.node).concat(extra.map(t => t.k));
  if (!secs.includes(wbTab)) wbTab = secs[0];
  setState('menu'); showHud(false); computeStats(); FG.scr = 'wb';
  const all = verItems(); if (!selItem || !findItem(selItem)) selItem = all.length ? all[0].uid : null;
  const sel = selItem && findItem(selItem), it = sel ? sel.it : null;
  let body = '';
  if (wbTab === 'ver') body = verHTML(it);
  else if (wbTab === 'sch') body = mwWizardHTML();
  else if (wbTab === 'zer') body = zrTabHTML(it);
  else if (wbTab === 'ws') body = wsHTML();
  else { const t = extra.find(t => t.k === wbTab); if (t) body = t.body(it, `<div class="grid" style="margin-bottom:8px">${all.map(x => itemSlot(x, 'wsel', x === it)).join('')}</div>`, all); }
  const st = wbMode === 'smith' || wbMode === 'jewel', title = wbMode === 'smith' ? _t('SCHMIEDE') : wbMode === 'jewel' ? _t('JUWELIER') : _t('WERKBANK');
  const lab = k => WB_SEC[k] ? WB_SEC[k][0] : extra.find(t => t.k === k).label(), ic = k => iconURL(['pa', WB_SEC[k] ? WB_SEC[k][1] : 'amboss']);
  // Querformat: die rechte Spalte scrollt für sich – beim Neuzeichnen (gleicher Bereich, gleicher Gegenstand) dort bleiben
  const sd = !ov.hidden && panel.querySelector('.split > .side'), sTop = sd ? sd.scrollTop : 0, sKey = wbTab + '|' + selItem;
  showOverlay(`<div class="head"><h2>${title}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div><button class="btn ${st ? 'alt ' : ''}sm" data-act="wbdone">${st ? _t('Zurück') : _t('Weiter')}</button></div></div>
  <div class="tabs wbsecs" role="tablist" style="--n:${secs.length}">${secs.map(k => `<button class="tab wbsec" role="tab" aria-selected="${wbTab === k}" data-act="wtab" data-id="${k}"><img src="${ic(k)}" alt=""><span>${lab(k)}</span></button>`).join('')}</div>
  ${body}${st ? `<div class="wbnpc">${npcLine(wbMode === 'smith' ? 'schmiede' : 'juwelier')}${buildHTML(wbMode === 'smith' ? 'schmiede' : 'juwelier')}</div>` : ''}`, true);
  if (sTop && WB.sKey === sKey) { const s2 = panel.querySelector('.split > .side'); if (s2) s2.scrollTop = sTop; }
  WB.sKey = sKey;
}

/* ---------- Charakter-Reiter BAUTEILE ---------- */
function partsCharHTML() {
  FG.scr = 'char';
  const pl = combPlan(PARTORDER);
  return `${smithBoxHTML()}<p class="sub" style="margin-top:0">${_t('{n} Bauteile. Meisterwerke schmiedest du an jeder Werkbank und in der Schmiede (Bereich SCHMIEDEN). Zerlegen: Gegenstand im Beutel antippen.', { n: pcount() })}</p>
  ${pl.n ? `<div class="wbhelpers">${wbBtn('fg_combat', _t('Alle Bauteile kombinieren ({n}×)', { n: pl.n }), '')}</div><p class="wbline">${_t('Kostet {cost}.', { cost: planCost(pl) })}</p>` : ''}
  <div class="cols"><div><h3>${_t('FÜR WAFFEN')}</h3>${partListHTML(PARTW)}</div><div><h3>${_t('FÜR RÜSTUNG UND HELM')}</h3>${partListHTML(PARTA)}</div></div>`;
}

HOOK.charTabs.push({ k: 'parts', label: () => _t('BAUTEILE'), body: () => partsCharHTML() });
// Zerlegen direkt im Charakterbildschirm (Gegenstand im Beutel)
HOOK.itemActions.push(it => P.bag.includes(it) ? `<button class="btn ${zrArm === 'c' + it.uid ? 'red' : 'alt'} sm" data-act="zr_char" data-id="${it.uid}">${zrArm === 'c' + it.uid ? _t('Wirklich zerlegen?') : _t('Zerlegen')}</button>` : '');
// Zeilen für Meisterwerke
HOOK.itemLines.push((it, L) => {
  if (!it.mw) return;
  const grp = mwGroup(it.slot), el = t => PART[t].el ? it.el : null;
  L.push('⚒ ' + _t('Meisterwerk: {parts}', { parts: grp.map(t => pshort(t, it.mw[t] || 0, el(t))).join(' · ') }));
  for (const t of grp) if (it.mw[t] && t !== 'kern') L.push(pname(t, it.mw[t], el(t)) + ': ' + (t === 'rune' && it.el ? RUNE_BONUS[it.el].s(RUNE_BONUS[it.el].v * it.mw[t]) : pdesc(t, it.mw[t], el(t))));
});
// Griff: Tempo und Krit der angelegten Meisterwerk-Waffe
HOOK.stats.push(add => { const w = P.gear.weapon; if (w && w.mw && w.mw.griff) { add('aspd', w.mw.griff * .015); add('crit', w.mw.griff * .006); } });
HOOK.meta.push(m => {
  const s = m.smith && typeof m.smith === 'object' ? m.smith : {};
  m.smith = { lv: clamp(Math.floor(+s.lv || 1), 1, 100), xp: Math.max(0, +s.xp || 0), found: +s.found || 0, made: +s.made || 0, salv: +s.salv || 0, comb: +s.comb || 0 };
});
HOOK.activate.push(H => {
  if (!H.parts || typeof H.parts !== 'object' || Array.isArray(H.parts)) H.parts = {};
  for (const k in H.parts) { const n = Math.floor(+H.parts[k]); if (!(n > 0) || !pvalid(k)) delete H.parts[k]; else H.parts[k] = n; }
  MW.pick = {}; MW.tier = -1; MW.base = null; MW.step = 1; FG.last = null; zrArm = null; WB.swap = {}; WB.act = null; fuseA = fuseB = null;
});
// Bilder für die Bereiche (16×16, wie art.js)
function pbStar(b, cx, cy, ro, rin, c1, c2) {
  const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? rin : ro; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { let ins = false; for (let i = 0, j = 9; i < 10; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y + .5) !== (yj > y + .5) && x + .5 < (xj - xi) * (y + .5 - yi) / (yj - yi) + xi) ins = !ins; } if (ins) b.set(x, y, x + y < cx + cy ? c1 : c2); }
}
HOOK.artIcon.push((name, b) => {
  switch (name) {
    case 'wbup':   // grüner Pfeil nach oben, goldenes Funkeln
      for (let r = 0; r < 6; r++) { b.rect(7 - r, 2 + r, 2 + r * 2, 1, '#5ac27a'); b.set(7 - r, 2 + r, '#b8f0c0'); }
      b.rect(5, 8, 6, 6, '#3a9a4a'); b.rect(5, 8, 2, 6, '#5ac27a'); b.rect(9, 8, 2, 6, '#2e7a3a');
      b.set(13, 1, '#ffd24a'); b.set(12, 2, '#ffd24a'); b.set(14, 2, '#ffd24a'); b.set(13, 3, '#ffd24a'); b.set(13, 2, '#fff0a0'); break;
    case 'wbzer':  // zerbrochene Klinge mit Funken
      for (let i = 0; i < 4; i++) { b.set(13 - i, 2 + i, '#d0d6de'); b.set(14 - i, 3 + i, '#7a828e'); }
      for (let i = 0; i < 2; i++) { b.set(7 - i, 8 + i, '#d0d6de'); b.set(8 - i, 9 + i, '#7a828e'); }
      for (let i = 0; i < 5; i++) b.set(3 + i, 8 + i, '#e8b04a');
      b.set(4, 11, '#8a5a32'); b.set(3, 12, '#8a5a32'); b.set(2, 13, '#6a4424'); b.set(1, 14, '#e8b04a');
      b.set(10, 9, '#ffd24a'); b.set(11, 10, '#fff0a0'); b.set(9, 11, '#ffd24a'); b.set(12, 8, '#ffd24a'); break;
    case 'wbws':   // Werkbank mit Hammer und Edelstein
      b.rect(1, 9, 14, 2, '#a8743e'); b.rect(1, 9, 14, 1, '#c8945e'); b.rect(2, 11, 2, 4, '#6a4424'); b.rect(12, 11, 2, 4, '#6a4424');
      b.rect(2, 4, 6, 3, '#8a96aa'); b.rect(2, 4, 6, 1, '#c8d2e0'); b.rect(4, 7, 2, 2, '#8a5a32');
      b.rect(10, 5, 4, 1, '#e0ccff'); b.rect(9, 6, 6, 1, '#a078e8'); b.rect(10, 7, 4, 1, '#6a40b0'); b.rect(11, 8, 2, 1, '#3e2270'); break;
    case 'wbfuse': // Stern (Verschmelzen)
      pbStar(b, 7.5, 8.3, 7.4, 3.1, '#ffe08a', '#e8a030'); b.set(7, 6, '#fff8d0'); b.set(6, 7, '#fff8d0'); break;
  }
});

/* ---------- Knöpfe ---------- */
const fgDone = () => { saveChar(); persist(); if (typeof checkAch === 'function') checkAch(); };
const fgTop = () => { const p = document.getElementById('panel'); if (p) p.scrollTop = 0; };   // Ergebnis oben zeigen
const wbSel = () => { const f = selItem && findItem(selItem); return f ? f.it : null; };
function combToast(r) { if (r.n) { const p = pparse(r.best); sfx('craft'); toast(_t('{n}× kombiniert – bestes: {part}', { n: r.n, part: pname(p.t, p.g, p.el) }), gradeCol(p.g)); } else sfx('deny'); }
// Bereiche, Auswahl, Hilfe
ON.wtab = id => { wbTab = id; WB.help = null; zrArm = null; FG.last = null; if (MW.step === 5) MW.step = 1; sfx('click'); openWorkbench(); };
ON.wsel = id => { if (selItem !== id) { fuseB = null; WB.swap = {}; } selItem = id; WB.bag = false; zrArm = null; sfx('click'); openWorkbench(); };
ON.wb_src = id => { WB.src = id === 'stash' ? 'stash' : 'bag'; const L = wbList(); if (L.length && !(selItem && L.some(x => x.uid === selItem))) { selItem = L[0].uid; fuseB = null; WB.swap = {}; } WB.bag = true; zrArm = null; sfx('click'); openWorkbench(); };
ON.wb_zst = () => { WB.zst = !WB.zst; zrArm = null; sfx('click'); openWorkbench(); };
ON.wb_bag = () => { WB.bag = !WB.bag; sfx('click'); openWorkbench(); };
ON.wb_act = id => { WB.act = WB.act === id ? '' : id; WB.help = null; zrArm = null; sfx('click'); openWorkbench(); };
ON.wb_help = id => { WB.help = WB.help === id ? null : id; sfx('click'); fgRerender(); };
ON.wb_sub = id => { WB.sub = id; WB.help = null; sfx('click'); openWorkbench(); };
ON.wb_goact = id => { wbTab = 'ver'; WB.act = id; WB.help = null; sfx('click'); openWorkbench(); };
ON.wbdone = () => { if (wbMode === 'smith' || wbMode === 'jewel') backToHide(); else if (state === 'menu' && P.map && P.map.pos.r >= 0 && P.map.rows[P.map.pos.r][P.map.pos.i].t === 'werkbank' && !P.map.rows[P.map.pos.r][P.map.pos.i].done) nodeLeave(); else openMap(); };
// Verbessern
ON.up = () => { const it = wbSel(); const r = it ? upgradeItem(it) : 'none'; if (r === 'ok') { sfx('craft'); toast(_t('Erfolg: {item}', { item: itemName(it) }), '#79c24e'); } else if (r === 'fail') { sfx('fail'); toast(_t('Fehlgeschlagen – die Materialien sind verloren'), '#ff6a5a'); } else sfx('deny'); fgDone(); openWorkbench(); };
ON.craft = id => {
  const it = wbSel(), need = { potion: 'rez', gem: 'rez', reroll: 'reroll', socket: 'drill' }[id];
  if (!need || !wbCan(need) || (id === 'reroll' && (!it || !it.rar))) { sfx('deny'); openWorkbench(); return; }
  const r = craft(id, it); if (r.r === 'ok') { sfx('craft'); toast(r.msg || _t('Hergestellt'), '#79c24e'); } else if (r.r === 'fail') { sfx('fail'); toast(r.msg, '#ff6a5a'); } else if (r.r === 'max') toast(_t('Schon 3 Sockel')); else sfx('deny');
  fgDone(); openWorkbench();
};
ON.fsel = id => { fuseB = fuseB === id ? null : id; sfx('click'); openWorkbench(); };
ON.fbest = () => { const it = wbSel(), b = it && fuseBest(it); fuseB = b ? b.uid : null; sfx('click'); openWorkbench(); };
ON.freset = () => { fuseA = fuseB = null; openWorkbench(); };
ON.fuse = () => {
  const A = wbSel(), Bf = fuseB && findItem(fuseB), r = fuseItems(A, Bf && Bf.it);
  if (r.r === 'ok') { sfx('fuse'); shake(3); toast(r.up ? _t('SELTENHEIT GESTIEGEN! {item}', { item: itemName(r.it) }) : _t('Verschmolzen: {item}', { item: itemName(r.it) }), RAR[r.it.rar].c); if (r.it.rar === 6) { sfx('myth'); banner(_t('MYTHISCH!'), _t(r.it.name)); } fuseB = null; } else if (r.r === 'err') toast(r.msg); else sfx('deny');
  fgDone(); openWorkbench();
};
ON.sock = id => { const it = wbSel(); if (it && wbCan('sock') && socketGem(it, id)) { sfx('craft'); toast(_t('{gem} eingesetzt', { gem: gemName(id) }), GEMS[id.split(':')[0]].c); fgDone(); } else sfx('deny'); openWorkbench(); };
ON.sockbest = () => { const k = gemKeys()[0]; if (k) ON.sock(k); };
ON.unsock = () => { const it = wbSel(); if (it && wbCan('sock') && unsocketAll(it)) { sfx('coin'); fgDone(); } else sfx('deny'); openWorkbench(); };
ON.mw_swpk = (id, b, i) => { WB.swap[pparse(id).t] = id; sfx('click'); openWorkbench(); };
ON.mw_swap = (id, b, i) => {
  const f = findItem(id), t = f && f.it.mw && mwGroup(f.it.slot)[i], O = t ? mwSwapOpts(f.it, t) : [], k = O.includes(WB.swap[t]) ? WB.swap[t] : O[0];
  FG.last = null; if (k && mwSwap(f.it, t, k)) { sfx('fuse'); shake(2); toast(_t('Umgebaut: {item}', { item: itemName(f.it) }), RAR[f.it.rar].c); } else sfx('deny');
  if (t) delete WB.swap[t]; fgDone(); openWorkbench();
};
ON.mw_swapall = id => {
  const f = findItem(id); let n = 0;
  if (f && f.it.mw) for (const t of mwGroup(f.it.slot)) { const k = mwSwapOpts(f.it, t)[0]; if (k && mwSwap(f.it, t, k)) n++; }
  if (n) { sfx('fuse'); shake(2); toast(_t('Umgebaut: {item}', { item: itemName(f.it) }), RAR[f.it.rar].c); } else sfx('deny');
  WB.swap = {}; fgDone(); openWorkbench();
};
// Werkstatt
ON.gcomb = id => { const [g, gr] = id.split(','); if (combineGem(g, +gr)) { sfx('craft'); fgDone(); } else sfx('deny'); openWorkbench(); };
ON.gcomball = () => { const n = gemCombAll(); if (n) { sfx('craft'); toast(_t('{n}× kombiniert', { n }), '#79c24e'); fgDone(); } else sfx('deny'); openWorkbench(); };
ON.dye = id => { if (unlockDye(id)) { sfx('craft'); fgDone(); } else sfx('deny'); openWorkbench(); };
ON.trans = (id, b, i) => { if (wbCan('trans') && transmute(i)) { sfx('craft'); fgDone(); } else sfx('deny'); openWorkbench(); };
// Schmieden: Schritte, Auswahl, Meisterwerk
ON.mw_step = (id, b, i) => { MW.step = clamp(i, 1, 4); if (FG.last && FG.last.k === 'mw') FG.last = null; WB.help = null; sfx('click'); openWorkbench(); fgTop(); };
ON.mw_slot = id => { MW.slot = id; FG.last = null; sfx('click'); openWorkbench(); };
ON.mw_base = id => { MW.base = id; MW.form = null; FG.last = null; sfx('click'); openWorkbench(); };
ON.mw_form = id => { mwInit(); if (WFORM[MW.base].some(f => f.id === id)) MW.form = id; FG.last = null; sfx('click'); openWorkbench(); };
ON.mw_mat = (id, b, i) => { if (i >= 0 && i < TIERS && forgeOk(i)) MW.tier = i; FG.last = null; sfx('click'); openWorkbench(); };
ON.mw_pk = id => { if (phave(id) > 0) MW.pick[pparse(id).t] = id; sfx('click'); openWorkbench(); };
ON.mw_best = () => { for (const t of mwGroup(MW.slot)) MW.pick[t] = mwOptions(t)[0] || null; sfx('click'); openWorkbench(); };
ON.fg_combgrp = id => { const grp = mwGroup(id === 'weapon' ? 'weapon' : 'armor'); combToast(combAll(grp)); for (const t of grp) delete MW.pick[t]; fgDone(); fgRerender(); };
ON.fg_combat = () => { combToast(combAll(PARTORDER)); MW.pick = {}; fgDone(); fgRerender(); };
ON.forge = () => {
  mwInit(); const it = roomFor() ? forgeItem(MW.tier, MW.slot) : null;
  if (!it) { sfx('deny'); openWorkbench(); return; }
  sfx('craft'); toast(_t('{item} geschmiedet', { item: itemName(it) }), RAR[it.rar].c);
  FG.last = { tab: 'mw', k: 'mw', uid: it.uid, quick: true }; MW.step = 5; selItem = it.uid; fgDone(); openWorkbench(); fgTop();
};
ON.mw_make = () => {
  const r = mwCraft();
  if (!r) { sfx('deny'); fgRerender(); return; }
  sfx(r.it.rar >= 4 ? 'myth' : 'craft'); shake(3);
  toast(r.lucky ? _t('MEISTERSTÜCK! {item}', { item: itemName(r.it) }) : _t('{item} geschmiedet', { item: itemName(r.it) }), RAR[r.it.rar].c);
  FG.last = { tab: 'mw', k: 'mw', uid: r.it.uid, lucky: r.lucky }; MW.step = 5; selItem = r.it.uid; fgDone(); fgRerender(); fgTop();
};
ON.mw_equip = id => { const f = findItem(id); if (f && !f.eq && equipItem(f.it)) { sfx('swing'); toast(_t('{item} angelegt', { item: itemName(f.it) }), RAR[f.it.rar].c); } else sfx('deny'); fgDone(); fgRerender(); };
ON.mw_again = () => { FG.last = null; MW.step = 3; sfx('click'); openWorkbench(); fgTop(); };
ON.mw_ver = id => { FG.last = null; MW.step = 1; selItem = id; wbTab = 'ver'; WB.act = null; sfx('click'); openWorkbench(); };
// Bauteile kombinieren (Listen in Werkstatt und Charakter)
ON.fg_comb = id => {
  if (FG.last && FG.last.tab === 'mw') FG.last = null; const r = combinePart(id);
  if (r) { const p = pparse(r.k); sfx(r.lucky ? 'myth' : 'craft'); toast(r.lucky ? _t('MEISTERWURF! {part}', { part: pname(p.t, p.g, p.el) }) : pname(p.t, p.g, p.el), gradeCol(p.g)); MW.pick[p.t] = r.k; } else sfx('deny');
  fgDone(); fgRerender();
};
ON.fg_comball = id => {
  if (FG.last && FG.last.tab === 'mw') FG.last = null; let n = 0, best = null; while (combOk(id)) { const r = combinePart(id); if (!r) break; n++; if (!best || r.g > pparse(best).g) best = r.k; }
  if (n) { const p = pparse(best); sfx('craft'); toast(_t('{n}× kombiniert – bestes: {part}', { n, part: pname(p.t, p.g, p.el) }), gradeCol(p.g)); MW.pick[p.t] = best; } else sfx('deny');
  fgDone(); fgRerender();
};
// Zerlegen
ON.zr_one = id => {
  const f = findItem(id); if (!f || f.eq) { sfx('deny'); fgRerender(); return; }
  if (salvRisky(f.it) && zrArm !== id) { zrArm = id; sfx('click'); fgRerender(); return; }
  zrArm = null; const R = salvage(f.it); if (R) { FG.last = Object.assign({ tab: 'zer', k: 'salv' }, R); sfx('craft'); selItem = null; if (wbTab !== 'zer') { const ks = Object.keys(R.parts); toast(ks.length ? _t('Zerlegt: {list}', { list: ks.map(k => { const p = pparse(k); return pshort(p.t, p.g, p.el) + (R.parts[k] > 1 ? ' ×' + R.parts[k] : ''); }).join(', ') }) : _t('Zerlegt – nur Materialien'), '#ffd24a'); } }
  fgDone(); fgRerender(); if (wbTab === 'zer') fgTop();
};
ON.zr_all = id => {
  const r = +id, L = salvBulkList(r, WB.zst); if (!L.length) { sfx('deny'); fgRerender(); return; }
  if (zrArm !== 'all' + r) { zrArm = 'all' + r; sfx('click'); fgRerender(); return; }
  zrArm = null; let R = null; for (const it of L) R = salvage(it, R) || R;
  if (R) { FG.last = Object.assign({ tab: 'zer', k: 'salv' }, R); sfx('craft'); shake(2); selItem = null; }
  fgDone(); fgRerender(); fgTop();
};
ON.zr_char = id => {
  const f = findItem(id); if (!f || f.bi == null) return;
  if (salvRisky(f.it) && zrArm !== 'c' + id) { zrArm = 'c' + id; sfx('click'); openChar(); return; }
  zrArm = null; const R = salvage(f.it);
  if (R) { sfx('craft'); const ks = Object.keys(R.parts); toast(ks.length ? _t('Zerlegt: {list}', { list: ks.map(k => { const p = pparse(k); return pshort(p.t, p.g, p.el) + (R.parts[k] > 1 ? ' ×' + R.parts[k] : ''); }).join(', ') }) : _t('Zerlegt – nur Materialien'), '#ffd24a'); }
  selItem = null; fgDone(); openChar();
};

document.head.insertAdjacentHTML('beforeend', `<style>
.fgbox{display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;background:var(--stone-lo);padding:8px 10px;margin-bottom:10px;box-shadow:inset 3px 0 0 var(--gold)}
.fgbox>img{width:40px;height:40px;image-rendering:pixelated}
.fgbox b,.fglast>b{display:block;font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--gold);line-height:1.6}
.fgbox small,.fglast small{display:block;font-size:15px;color:var(--parch-dim);line-height:1.1;margin-top:3px}
.fgbar{height:6px;background:var(--night);margin-top:3px;box-shadow:0 0 0 1px var(--stone-hi)}.fgbar i{display:block;height:100%;background:var(--gold)}
.fglast{background:var(--night);padding:8px 10px;margin-bottom:10px;box-shadow:inset 0 0 0 2px var(--gold-dk)}
.fgchips{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:17px;margin-top:4px}.fgchips span{display:inline-flex;align-items:center;gap:3px}.fgchips img{width:18px;height:18px;image-rendering:pixelated}.fgchips b{font-weight:400}
.fgrow .acts{flex-direction:column;align-items:stretch;gap:5px}.fgrow .acts .btn{white-space:nowrap}.fgn{font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--parch)}
.fgbox.sm{padding:6px 10px;margin-bottom:8px;grid-template-columns:28px minmax(0,1fr) auto}.fgbox.sm>img{width:28px;height:28px}.fgbox.sm b{font-size:7px}
.fgxp{display:flex;gap:8px;align-items:center;margin-top:3px}.fgxp .fgbar{flex:1;margin:0}.fgxp small{margin:0;white-space:nowrap}
.fgar{font-family:var(--f-body);font-size:18px;line-height:0;vertical-align:-1px}.fgrow .cost{font-size:16px;margin:3px 0 0}
.zrbulk{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;margin-bottom:2px}.zrbulk .btn{font-size:8px}
.zrcard{margin:0}.zrcard .btn{white-space:nowrap}
.slot[aria-label^="⚒"]::after{content:"⚒";position:absolute;left:3px;bottom:1px;font-size:13px;line-height:1;color:#ffd24a;text-shadow:1px 1px 0 #000}
/* Werkbank: Bereiche oben (eine Zeile, Bild über dem Namen) */
.panel .wbsecs{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:4px;margin-bottom:8px}
.panel .wbsecs .tab.wbsec{display:grid;justify-items:center;align-content:center;gap:4px;padding:6px 1px;min-height:56px;min-width:0;font-size:7px;line-height:1.3;white-space:normal;text-align:center}
.wbsec img{width:24px;height:24px;image-rendering:pixelated}
.wbintro{display:flex;gap:8px;align-items:center;margin:2px 0 8px}
.wbintro p{flex:1;margin:0;font-size:18px;line-height:1.1;color:var(--parch-dim)}
.wbq{flex:none;width:36px;height:36px;border:0;border-radius:50%;background:var(--stone-hi);color:var(--gold);font-family:var(--f-display);font-size:11px;cursor:pointer;box-shadow:0 0 0 2px var(--night);padding:0}
.wbq[aria-expanded="true"]{background:var(--gold);color:var(--night)}
body.touch .wbq{width:44px;height:44px}
.wbhelp{background:var(--night);padding:8px 10px;margin:0 0 8px;font-size:17px;line-height:1.15;color:var(--parch);box-shadow:inset 3px 0 0 var(--gold)}
.wbline{font-size:17px;line-height:1.12;color:var(--parch-dim);margin:4px 0 6px}
.wbwhy{font-size:17px;line-height:1.12;color:#ff9a8a;margin:4px 0 6px}
.wbdim{color:var(--parch-dim);font-size:16px;line-height:1.1;margin:4px 0}
.wbbad{color:#ff7a6a}
.wbneed{font-size:16px;line-height:1.1;color:var(--parch-dim);margin:0 0 6px}
.wbneed>span{color:#ff7a6a}.wbneed ul{margin:2px 0 0;padding-left:16px}.wbneed li b{color:#ff7a6a;font-weight:400}
/* Verbessern: Gegenstand wählen, Aktionen aufklappen */
.wbpick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:6px}
.wbgear{border:0;background:var(--stone-lo);color:var(--parch-dim);padding:6px 2px 5px;display:grid;justify-items:center;gap:3px;cursor:pointer;font-family:var(--f-body);min-width:0}
.wbgear .slot0{position:relative;width:48px;height:48px;display:grid;place-items:center;background:var(--night);box-shadow:inset 0 0 0 2px var(--c)}
.wbgear img{width:36px;height:36px;image-rendering:pixelated;object-fit:contain}
.wbgear em{position:absolute;left:3px;top:2px;font-style:normal;font-family:var(--f-display);font-size:7px;color:var(--gold);text-shadow:1px 1px 0 #000}
.wbgear b{font-family:var(--f-display);font-weight:400;font-size:10px;color:var(--parch)}
.wbgear small{font-size:16px;line-height:1}
.wbgear.sel{background:var(--stone-hi);color:var(--parch);box-shadow:inset 0 0 0 2px var(--gold)}
.wbbag{display:none;margin-bottom:8px}.wbbag.open{display:block}.wbbag h3{margin-top:4px}
.wbacts{display:grid;gap:5px;margin-top:8px}
.wbact{background:var(--stone-lo)}.wbact.open{box-shadow:inset 0 0 0 2px var(--stone-hi)}
.wbah{display:grid;grid-template-columns:28px minmax(0,1fr) 16px;gap:10px;align-items:center;width:100%;min-height:52px;padding:6px 10px;border:0;background:none;color:var(--parch);text-align:left;cursor:pointer;font-family:var(--f-body)}
.wbah img{width:28px;height:28px;image-rendering:pixelated;object-fit:contain}
.wbah b{display:block;font-family:var(--f-display);font-weight:400;font-size:8px;line-height:1.5;color:var(--gold)}
.wbah small{display:block;font-size:17px;line-height:1.05;color:var(--parch-dim)}
.wbah small.ok{color:#8fe05e}.wbah small.bad{color:#ff7a6a}
.wbah i{font-style:normal;color:var(--parch-dim)}
.wbab{padding:0 10px 10px}
.wbab>.btn:not(.sm),.wbbox>.btn{display:block;width:100%;margin-top:4px}
.wbrowh{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0;font-size:17px;line-height:1.1;color:var(--parch-dim)}
.wbvict{margin-bottom:6px}
.wbgems{margin:4px 0 6px;padding-left:18px;font-size:17px;line-height:1.15}
.wbsep{display:flex;gap:8px;align-items:baseline;justify-content:space-between;flex-wrap:wrap;border-top:2px dashed var(--stone-hi);margin-top:10px;padding-top:8px}
.wbsep b{font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--gold)}.wbsep small{font-size:16px;color:var(--parch-dim)}
.wbcmp{background:var(--night);padding:6px 10px;margin:6px 0;box-shadow:inset 0 0 0 2px var(--stone-hi)}
.wbcmp>b{display:block;font-family:var(--f-display);font-weight:400;font-size:7px;line-height:1.6;color:var(--parch-dim);margin-bottom:3px}
.wbcmp ul{list-style:none;margin:0;padding:0;font-size:17px;line-height:1.15}
.wbcmp li{display:flex;flex-wrap:wrap;gap:0 8px;align-items:baseline;color:var(--parch)}.wbcmp li span{flex:1 1 auto}.wbcmp li b{font-weight:400}.wbcmp li i{font-style:normal}
.wbcmp li.up i,.wbcmp li.up.t,.wbcmp p.up{color:#8fe05e}.wbcmp li.dn i,.wbcmp li.dn.t,.wbcmp p.dn{color:#ff7a6a}
.wbcmp p{margin:3px 0 0;font-size:18px;line-height:1.1}
/* Schmieden: Schritte */
.mwsteps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;margin:2px 0 2px}
.mws{border:0;background:none;padding:2px 0;display:grid;justify-items:center;gap:3px;color:var(--parch-dim);cursor:pointer;font-family:var(--f-body);min-height:48px;min-width:0}
.mws b{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:var(--stone-lo);box-shadow:0 0 0 2px var(--stone-hi);font-family:var(--f-display);font-weight:400;font-size:9px;color:var(--parch)}
.mws small{font-size:14px;line-height:1;white-space:nowrap}
.mws.done b{background:var(--moss);color:var(--night);box-shadow:0 0 0 2px var(--night);font-family:var(--f-body);font-size:22px}
.mws.cur b{background:var(--gold);color:var(--night);box-shadow:0 0 0 2px var(--night),0 0 0 4px var(--gold-dk)}
.mws.cur small{color:var(--gold)}.mws:disabled{cursor:default}
.mwsum{margin:2px 0 8px;font-size:16px;line-height:1.1;color:var(--parch-dim);text-align:center}
.wbtiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}
.wbtiles .opt{display:grid;justify-items:center;gap:4px;min-width:0;padding:8px 2px}
.wbtile img{width:40px;height:40px;image-rendering:pixelated;object-fit:contain}
.wbforms{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:5px;margin-bottom:8px}
.wbform{border:0;background:var(--stone-lo);color:var(--parch);padding:6px 3px;display:grid;justify-items:center;align-content:start;gap:3px;cursor:pointer;font-family:var(--f-body);text-align:center;min-width:0}
.wbform img{width:32px;height:32px;image-rendering:pixelated;object-fit:contain}
.wbform b{font-family:var(--f-display);font-weight:400;font-size:7px;line-height:1.4}
.wbform small{font-size:14px;line-height:1;color:var(--parch-dim)}
.wbform.sel{background:var(--stone-hi);box-shadow:inset 0 0 0 3px var(--gold)}
.wbmat.sel{box-shadow:inset 0 0 0 2px var(--gold);background:var(--stone-hi)}
.wbmat:disabled{opacity:.55;cursor:default}.wbmat .cost{font-size:16px;margin:3px 0 0}
.wbradio{width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--stone-hi);display:grid;place-items:center;font-size:22px;color:var(--night)}
.wbmat.sel .wbradio{background:var(--gold);box-shadow:none}
.wbchips{display:flex;flex-wrap:wrap;gap:5px;margin:5px 0 2px}
.wbchip{position:relative;width:52px;height:52px;border:0;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi);cursor:pointer;display:grid;place-items:center;padding:0}
.wbchip img{width:30px;height:30px;image-rendering:pixelated}
.wbchip b{position:absolute;left:3px;top:3px;font-family:var(--f-display);font-weight:400;font-size:7px;color:var(--c);text-shadow:1px 1px 0 #000}
.wbchip small{position:absolute;right:3px;bottom:1px;font-size:15px;color:var(--parch);text-shadow:1px 1px 0 #000}
.wbchip.sel{box-shadow:inset 0 0 0 3px var(--gold);background:var(--stone-hi)}
.wbpart{background:var(--stone-lo);padding:8px 10px;margin-bottom:6px}
.wbab .wbpart{background:var(--night)}
.wbpart-h{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.wbpart-h b{font-family:var(--f-display);font-weight:400;font-size:8px;line-height:1.5;color:var(--gold)}.wbpart-h small{font-size:16px;color:var(--parch-dim)}
.wbpart-h img{width:22px;height:22px;image-rendering:pixelated}
.wbrar{margin:8px 0 0}
.wbrarbar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;margin-bottom:6px}
.wbrarbar i{display:block;height:22px;background:var(--stone-lo);box-shadow:inset 0 -3px 0 var(--c);font-style:normal;text-align:center;font-size:15px;line-height:20px;color:var(--parch-dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.wbrarbar i.on{background:var(--c);color:var(--night)}
.wbhelpers{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}.wbhelpers .btn{flex:1 1 130px}
.wbbox{background:var(--stone-lo);padding:8px 10px;margin:10px 0 6px;box-shadow:inset 3px 0 0 var(--stone-hi)}
.wbfoot{position:sticky;bottom:calc(6px - var(--pt));z-index:4;background:var(--stone);margin:10px calc(-1 * var(--px)) 0;padding:10px var(--px) 12px;box-shadow:0 -3px 0 var(--stone-lo);display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 8px;align-items:center}
.wbfoot .btn.full{grid-column:1/-1}.wbfoot .wbwhy{grid-column:1/-1;margin:0}
.wbnpc{margin-top:14px;border-top:2px dashed var(--stone-hi);padding-top:10px}
/* Werkstatt */
.wbsubs{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:4px;margin-bottom:8px}
.wbsubs .opt{min-width:0;padding:8px 1px;font-size:7px;line-height:1.4}
.wbstock{font-size:16px;margin:0 0 8px}
@media (min-width:600px){
  .panel .wbsecs .tab.wbsec{grid-auto-flow:column;justify-content:center;gap:8px;min-height:44px;font-size:8px}
  .wbsec img{width:20px;height:20px}
  .wbbag{display:block}.wbgear.bag{display:none}.wbpick{grid-template-columns:repeat(3,minmax(0,1fr))}
  .wbsubs .opt{font-size:8px}
  .zrbulk{grid-template-columns:repeat(2,minmax(0,1fr))}
}
.mwnav{display:none}
@media (min-width:600px){
  .mwhead{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start}
  .mwnav{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 8px;margin-top:8px}.mwnav .btn.full{grid-column:1/-1}.mwnav .wbwhy{grid-column:1/-1;margin:0}
  .panel>.wbfoot.mw{display:none}
}
@media (min-width:600px) and (max-height:540px){.mws{grid-auto-flow:column;justify-content:center;align-items:center;min-height:40px;gap:6px}.mwsum{display:none}}
@media (max-width:599px){.mwlive{display:none}}
</style>`);
