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

/* ---------- Zerlegen ---------- */
function salvRisky(it) { return it.rar >= 3 || !!it.mw || !!it.set || !!it.myth || it.up >= 5 || !!it.fz || it.gems.length > 0; }
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
  const bi = P.bag.indexOf(it); if (bi < 0) return null;
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
  P.bag.splice(bi, 1);
  const xp = 4 + 2 * it.tier + 3 * Math.min(it.rar, 5) + (it.rar === 6 ? 8 : 0) + 2 * gs; R.xp += xp; R.n++;
  SAVE.meta.smith.salv++; smithXP(xp);
  return R;
}
// alle einfachen Gegenstände einer Seltenheit (ohne Sockelsteine, Aufwertung, Verschmelzung)
function salvBulkList(r) { return P.bag.filter(x => x.rar === r && !x.gems.length && !x.up && !x.fz && !x.mw && !x.set && !x.myth); }

/* ---------- Meisterwerk schmieden ---------- */
const MW = { slot: 'weapon', tier: -1, base: null, form: null, pick: {} };
const FG = { last: null, scr: 'wb' };
let zrArm = null;
function mwGroup(slot) { return slot === 'weapon' ? PARTW : PARTA; }
function mwInit() {
  const C = CLASSES[P.cls];
  if (!C.weapons.includes(MW.base)) { MW.base = C.weapons.includes(P.gear.weapon.base) ? P.gear.weapon.base : C.weapons[0]; MW.form = null; }
  if (!WFORM[MW.base].some(f => f.id === MW.form)) MW.form = P.gear.weapon.base === MW.base ? wform(P.gear.weapon).id : WFORM[MW.base].find(f => f.std).id;
  if (MW.tier < 0) MW.tier = Math.max(0, REQ.filter(r => r <= P.lv).length - 1);
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
  const ok = !miss && forgeOk(tier) && canAfford(cost.mats, cost.gold) && P.bag.length < 30;
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
  addToBag(it); if (rar === 4) stat('legs'); stat('mwMade');
  SAVE.meta.smith.made++; smithXP(60 + 10 * s.sum * s.sum / 3);
  return { it, lucky };
}
/* Umbauen: ein besseres Bauteil in ein vorhandenes Meisterwerk setzen. Das alte kommt eine Stufe tiefer zurück. */
function mwSwapCost(g) { return Math.round(40 * g * g * (1 - SMB.comb(smithLv()))); }
function mwSwapOk(it, t) {
  const k = mwPick(t); if (!k || !it.mw) return null;
  const p = pparse(k), old = it.mw[t] || 0;
  if (p.g < old || (p.g === old && (!PART[t].el || p.el === it.el))) return null;
  return { k, p, old, gold: mwSwapCost(p.g) };
}
function mwSwap(it, t) {
  const s = mwSwapOk(it, t); if (!s || P.gold < s.gold) return false;
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

/* ---------- Oberfläche ---------- */
function fgRerender() { if (FG.scr === 'char') openChar(); else openWorkbench(); }
const nb = s => String(s).replace(/ %/g, '\u00a0%');   // Prozentzeichen nicht allein umbrechen
function smithBoxHTML(compact) {
  const S = SAVE.meta.smith, lv = S.lv, nx = smithNext(lv), p = lv >= 100 ? 1 : S.xp / smithNeed(lv);
  return `<div class="fgbox${compact ? ' sm' : ''}"><img src="${iconURL(['pa', 'amboss'])}" alt=""><div><b>${_t('SCHMIEDEMEISTER {lv}', { lv })} · ${esc(smithTitle(lv))}</b><div class="fgbar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>
  <small>${lv >= 100 ? _t('Höchste Stufe erreicht') : _t('{xp}/{need} EP', { xp: fmt(S.xp), need: fmt(smithNeed(lv)) })}${nx ? ' · ' + _t('Stufe {lv}: {title}', { lv: nx[0], title: esc(nx[1]) }) : ''}</small>
  ${compact ? '' : `<small>${nb(_t('Kombinieren −{a} Gold · Meisterwurf {b} · Extra-Bauteil {c} · Meisterstück {d}', { a: pc1(SMB.comb(lv)), b: pc1(SMB.lucky(lv)), c: pc1(SMB.extra(lv)), d: pc1(SMB.rar(lv)) }))}</small>`}</div></div>`;
}
// Liste der Bauteile (mit Kombinieren); grp = nur diese Arten
function partListHTML(grp) {
  const keys = Object.keys(P.parts).filter(k => P.parts[k] > 0 && grp.includes(pparse(k).t)).sort((a, b) => { const x = pparse(a), y = pparse(b); return PARTORDER.indexOf(x.t) - PARTORDER.indexOf(y.t) || ELORDER.indexOf(x.el) - ELORDER.indexOf(y.el) || y.g - x.g; });
  if (!keys.length) return `<p class="sub">${_t('Noch keine Bauteile. Gegner lassen manchmal welche fallen (Elite und Bosse öfter) – oder zerlege Gegenstände.')}</p>`;
  return keys.map(k => {
    const p = pparse(k), n = P.parts[k], c = p.g < 10 ? combCost(p.g) : null, ok = combOk(k), pool = combHave(k), many = Math.floor(pool / 3);
    const btn = c ? `<button class="btn sm" data-act="fg_comb" data-id="${k}" ${ok ? '' : 'disabled'}>${_t('3 → 1').replace('→', '<span class="fgar">→</span>')}</button>${many >= 2 ? `<button class="btn alt sm" data-act="fg_comball" data-id="${k}" ${ok ? '' : 'disabled'}>${_t('Alle ({n}×)', { n: many })}</button>` : ''}` : `<span class="pill">${_t('MAX')}</span>`;
    return `<div class="row fgrow" style="cursor:default"><div class="ic">${partImg(k)}</div><div><div class="nm"><span style="color:${gradeCol(p.g)}">${esc(pname(p.t, p.g, p.el))}</span> <b class="fgn">×${n}</b></div><div class="st">${nb(esc(pdesc(p.t, p.g, p.el)))}${pool > n ? ' · ' + _t('mit anderen Elementen: {n}', { n: pool }) : ''}</div>${c && pool >= 3 ? costHTML(c.mats, c.gold) : ''}</div><div class="acts">${btn}</div></div>`;
  }).join('');
}
function fgLastHTML(tab) {
  const L = FG.last; if (!L || L.tab !== tab) return '';
  if (L.k === 'salv') {
    const chips = Object.keys(L.parts).map(k => `<span>${partImg(k)}<b style="color:${gradeCol(pparse(k).g)}">${esc(pshort(pparse(k).t, pparse(k).g, pparse(k).el))}</b>${L.parts[k] > 1 ? ' ×' + L.parts[k] : ''}</span>`).join('') + Object.keys(L.mats).map(m => `<span><img src="${iconURL(['mat', m])}" alt="">${L.mats[m]} ${MATS[m].n}</span>`).join('');
    return `<div class="fglast"><b>${L.n === 1 ? _t('ZERLEGT: 1 GEGENSTAND') : _t('ZERLEGT: {n} GEGENSTÄNDE', { n: L.n })}</b><div class="fgchips">${chips}</div><small>${_t('+{xp} Schmiede-EP', { xp: fmt(L.xp) })}${L.gems ? ' · ' + _t('{n} Edelsteine zurück in den Vorrat', { n: L.gems }) : ''}</small></div>`;
  }
  if (L.k === 'mw') {
    const f = findItem(L.uid); if (!f) return '';
    const eq = f.bi != null && canEquip(f.it) ? `<button class="btn sm" data-act="mw_equip" data-id="${f.it.uid}">${_t('Anlegen')}</button>` : '';
    return `<div class="fglast"><b>${L.lucky ? _t('MEISTERSTÜCK! SELTENHEIT +1') : _t('MEISTERWERK GESCHMIEDET')}</b>${itemDetail(f.it, eq)}${f.bi != null ? compareHTML(f.it) : ''}</div>`;
  }
  return '';
}
// Reiter MEISTERWERK: Schmiedebank, Umbau, Bauteile
function mwTabHTML() {
  FG.scr = 'wb';
  const s = mwState(), C = CLASSES[P.cls], prev = mwPreviewItem(s), lv = smithLv();
  const opt = (act, id, sel, label, sm) => `<button class="opt${sel ? ' sel' : ''}" data-act="${act}" data-id="${id}">${label}${sm ? `<small>${sm}</small>` : ''}</button>`;
  let h = `<h3 style="margin-top:0">${_t('MEISTERWERK SCHMIEDEN')}</h3><div class="opts">${['weapon', 'armor', 'helm'].map(x => opt('mw_slot', x, s.slot === x, x === 'weapon' ? _t('Waffe') : AR[x].label)).join('')}</div>`;
  if (s.slot === 'weapon') {
    if (C.weapons.length > 1) h += `<div class="opts">${C.weapons.map(b => opt('mw_base', b, MW.base === b, WT[b].label)).join('')}</div>`;
    const F = WFORM[MW.base].find(f => f.id === MW.form) || WFORM[MW.base][0], fx = [];
    if ((F.dm || 1) !== 1) fx.push(_t('Schaden {v}', { v: (F.dm > 1 ? '+' : '−') + pct(Math.abs(F.dm - 1)) })); if ((F.sp || 1) !== 1) fx.push(F.sp < 1 ? _t('schneller') : _t('langsamer')); if (F.crit) fx.push(_t('Krit +{v}', { v: pct(F.crit) })); if (F.range) fx.push(_t('Reichweite +{v}', { v: F.range })); if (F.kb) fx.push(_t('Wucht +{v}', { v: pct(F.kb - 1) }));
    h += `<div class="mwstep"><button class="btn alt sm" data-act="mw_form" data-i="-1" aria-label="${_t('Vorige Form')}">‹</button><div><b>${esc(F.n)}</b><small>${fx.length ? esc(fx.join(' · ')) : _t('ausgewogen')}</small></div><button class="btn alt sm" data-act="mw_form" data-i="1" aria-label="${_t('Nächste Form')}">›</button></div>`;
  }
  const Mt = MAT[s.tier], tierOk = forgeOk(s.tier);
  h += `<div class="mwstep"><button class="btn alt sm" data-act="mw_tier" data-i="-1" aria-label="${_t('Voriges Material')}">‹</button><div><b style="color:${Mt.m[2]}">${esc(Mt.n)}${s.slot !== 'weapon' ? ' · ' + esc(C.names[s.tier][s.slot === 'armor' ? 0 : 1]) : ''}</b><small>${_t('Stufe {n}', { n: s.tier + 1 })}${tierOk ? '' : ' · <span style="color:var(--blood)">' + _t('ab Level {lv}', { lv: REQ[s.tier] }) + '</span>'}</small></div><button class="btn alt sm" data-act="mw_tier" data-i="1" aria-label="${_t('Nächstes Material')}">›</button></div>`;
  for (const t of s.grp) {
    const k = s.picks[t], o = mwOptions(t), p = k && pparse(k), idx = k ? o.indexOf(k) + 1 : 0;
    h += k ? `<button class="row fgpick" data-act="mw_cyc" data-id="${t}"${o.length > 1 ? '' : ' disabled'}><div class="ic">${partImg(k)}</div><div><div class="nm" style="color:${gradeCol(p.g)}">${esc(pname(p.t, p.g, p.el))}</div><div class="st">${nb(esc(pdesc(p.t, p.g, p.el)))} · ${_t('{n} vorrätig', { n: P.parts[k] })}</div></div>${o.length > 1 ? `<span class="pill dim">${idx}/${o.length} ›</span>` : '<span></span>'}</button>`
      : `<div class="row fgpick miss" style="cursor:default"><div class="ic"><img src="${partIconURL(t, 1, PART[t].el ? 'feuer' : null)}" alt="" style="opacity:.3;filter:grayscale(1)"></div><div><div class="nm" style="color:var(--blood)">${_t('{part} fehlt', { part: PART[t].n })}</div><div class="st">${s.slot === 'weapon' ? _t('Zerlege Waffen oder besiege Gegner – Elite und Bosse lassen öfter etwas fallen.') : _t('Zerlege Rüstungen und Helme oder besiege Gegner – Elite und Bosse lassen öfter etwas fallen.')}</div></div><span></span></div>`;
  }
  const nextR = MW_RSTEP[s.rar], rarTxt = `<b style="color:${RAR[s.rar].c}">${RAR[s.rar].n}</b>`;
  h += `<p class="sub" style="margin:6px 0 0">${_t('Seltenheit {rar} – Summe der Stufen {sum}', { rar: rarTxt, sum: s.sum })}${nextR ? ' · ' + _t('{rar} ab {n}', { rar: RAR[s.rar + 1].n, n: nextR }) : ''}. ${RAR[s.rar].aff === 1 ? _t('Dazu ein zufälliger Zusatzwert.') : _t('Dazu {n} zufällige Zusatzwerte.', { n: RAR[s.rar].aff })}${lv > 1 ? ' ' + _t('{p} Chance auf ein Meisterstück (Seltenheit +1).', { p: pc1(SMB.rar(lv)) }) : ''}</p>`;
  h += itemDetail(prev, '');
  h += costHTML(s.cost.mats, s.cost.gold);
  h += `<button class="btn" data-act="mw_make" ${s.ok ? '' : 'disabled'}>${_t('Meisterwerk schmieden')}</button>`;
  if (!s.miss && !tierOk) h += `<p class="sub">${_t('Dieses Material kannst du ab Level {lv} verarbeiten.', { lv: REQ[s.tier] })}</p>`;
  else if (!s.miss && P.bag.length >= 30) h += `<p class="sub" style="color:var(--blood)">${_t('Dein Beutel ist voll.')}</p>`;
  // Umbau vorhandener Meisterwerke
  const mws = ['weapon', 'armor', 'helm'].map(x => P.gear[x]).filter(Boolean).concat(P.bag).filter(x => x.mw && x.slot === s.slot);
  if (mws.length) {
    h += `<h3>${_t('UMBAUEN')}</h3><p class="sub" style="margin-top:0">${_t('Setze die oben gewählten Bauteile in ein fertiges Meisterwerk. Das alte Bauteil kommt eine Stufe tiefer zurück. Aufwertung, Sterne und Edelsteine bleiben.')}</p>`;
    h += mws.map(x => {
      const btns = s.grp.map((t, i) => { const o = mwSwapOk(x, t); return o ? `<button class="btn sm" data-act="mw_swap" data-id="${x.uid}" data-i="${i}" ${P.gold >= o.gold ? '' : 'disabled'}>${esc(pshort(t, o.p.g, o.p.el))} · ${fmt(o.gold)} G</button>` : ''; }).join('');
      return `<div class="row" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${itemColor(x)}"><img src="${itemIconURL(x)}" alt=""></div><div><div class="nm" style="color:${itemColor(x)}">${esc(itemName(x))}</div><div class="st">${s.grp.map(t => esc(pshort(t, x.mw[t] || 0, PART[t].el ? x.el : null))).join(' · ')}</div>${btns ? `<div class="acts" style="justify-content:flex-start;margin-top:5px">${btns}</div>` : `<div class="st">${_t('Wähle oben bessere Bauteile, um sie hier einzubauen.')}</div>`}</div><span></span></div>`;
    }).join('');
  }
  const side = `<h3 style="margin-top:0">${s.slot === 'weapon' ? _t('BAUTEILE FÜR WAFFEN') : _t('BAUTEILE FÜR RÜSTUNG UND HELM')}</h3><p class="sub" style="margin-top:0">${_t('Drei gleiche Bauteile werden zu einem der nächsten Stufe. Kerne und Runen dürfen verschiedene Elemente haben – das angetippte bestimmt das neue.')}</p>${partListHTML(s.grp)}`;
  return `${smithBoxHTML()}${fgLastHTML('mw')}<div class="split fgsplit"><div>${h}</div><div class="side">${side}</div></div>`;
}
// Reiter ZERLEGEN
function zrTabHTML(it0) {
  FG.scr = 'wb';
  let it = it0 && P.bag.includes(it0) ? it0 : P.bag[0] || null; if (it && it !== it0) selItem = it.uid;
  const grid = P.bag.length ? `<div class="grid" style="margin-bottom:8px">${P.bag.map(x => itemSlot(x, 'wsel', x === it)).join('')}</div>` : `<p class="sub">${_t('Dein Beutel ist leer. Angelegte Ausrüstung kann nicht zerlegt werden.')}</p>`;
  const bulk = [0, 1].map(r => { const n = salvBulkList(r).length, arm = zrArm === 'all' + r; return `<button class="btn ${arm ? 'red' : 'alt'} sm" data-act="zr_all" data-id="${r}" ${n ? '' : 'disabled'}>${arm ? _t('Sicher? {n} zerlegen', { n }) : r ? _t('Magische ({n})', { n }) : _t('Gewöhnliche ({n})', { n })}</button>`; }).join('');
  let side = '';
  if (it) {
    const pv = salvPreview(it), arm = zrArm === it.uid;
    const yieldTxt = pv.mw ? (pv.mw.length ? _t('Ergibt: {list} (je eine Stufe tiefer)', { list: pv.mw.join(', ') }) : _t('Ergibt keine Bauteile (alle auf Stufe Roh).'))
      : (pv.n[1] ? (pv.n[1] === 1 ? _t('Ergibt 1 Bauteil ({types}), Stufe {g}', { types: pv.types.map(t => pbase(t, PART[t].el ? it.el : null)).join(', '), g: GRADE[pv.g[0]].n + '–' + GRADE[pv.g[1]].n }) : _t('Ergibt {n} Bauteile ({types}), Stufe {g}', { n: pv.n[0] === pv.n[1] ? pv.n[0] : pv.n[0] + '–' + pv.n[1], types: pv.types.map(t => pbase(t, PART[t].el ? it.el : null)).join(', '), g: GRADE[pv.g[0]].n + '–' + GRADE[pv.g[1]].n })) : '');
    const matTxt = (pv.M.x ? _t('Dazu {m} und vielleicht {x}.', { m: MATS[pv.M.m].n, x: MATS[pv.M.x].n }) : _t('Dazu {m}.', { m: MATS[pv.M.m].n })) + (it.gems.length ? ' ' + _t('Edelsteine kommen zurück in den Vorrat.') : '');
    side = `<div class="row zrcard" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${itemColor(it)}"><img src="${itemIconURL(it)}" alt=""></div><div><div class="nm" style="color:${itemColor(it)}">${esc(itemName(it))}</div><div class="st">${RAR[it.rar].n} ${it.slot === 'weapon' ? WT[it.base].label : AR[it.slot].label} · ${MAT[it.tier].n}${it.up ? ' · +' + it.up : ''}${it.gems.length ? ' · ◆' + it.gems.length : ''}</div></div><button class="btn ${arm ? 'red' : ''} sm" data-act="zr_one" data-id="${it.uid}">${arm ? _t('Wirklich zerlegen?') : _t('Zerlegen')}</button></div>`
      + `<p class="sub" style="margin:4px 0 0">${esc(yieldTxt)}${yieldTxt ? '. ' : ''}${esc(matTxt)} ${_t('Beim Händler: {gold} Gold.', { gold: itemPrice(it) })}</p>`;
  } else side = `<p class="sub">${_t('Wähle einen Gegenstand aus dem Beutel.')}</p>`;
  return `${smithBoxHTML(true)}${fgLastHTML('zer')}<p class="sub" style="margin-top:0">${_t('Zerlege Gegenstände aus dem Beutel in Bauteile und ein paar Materialien – einzeln oder alle einer Seltenheit auf einmal:')}</p><div class="zrbulk">${bulk}</div><div class="split"><div>${grid}</div><div class="side sheet">${side}</div></div>`;
}
// Charakter-Reiter BAUTEILE
function partsCharHTML() {
  FG.scr = 'char';
  return `${smithBoxHTML()}<p class="sub" style="margin-top:0">${_t('{n} Bauteile. Meisterwerke schmiedest du an jeder Werkbank und in der Schmiede (Reiter MEISTERWERK). Zerlegen: Gegenstand im Beutel antippen.', { n: pcount() })}</p>
  <div class="cols"><div><h3>${_t('FÜR WAFFEN')}</h3>${partListHTML(PARTW)}</div><div><h3>${_t('FÜR RÜSTUNG UND HELM')}</h3>${partListHTML(PARTA)}</div></div>`;
}

HOOK.wbTabs.push({ k: 'mw', label: () => _t('MEISTERWERK'), modes: ['node', 'act', 'smith'], body: () => mwTabHTML() });
HOOK.wbTabs.push({ k: 'zer', label: () => _t('ZERLEGEN'), modes: ['node', 'act', 'smith'], body: it => zrTabHTML(it) });
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
  MW.pick = {}; MW.tier = -1; MW.base = null; FG.last = null; zrArm = null;
});

/* ---------- Knöpfe ---------- */
const fgDone = () => { saveChar(); persist(); if (typeof checkAch === 'function') checkAch(); };
const fgTop = () => { const p = document.getElementById('panel'); if (p) p.scrollTop = 0; };   // Ergebnis oben zeigen
ON.mw_slot = id => { MW.slot = id; zrArm = null; FG.last = null; sfx('click'); fgRerender(); };
ON.mw_base = id => { MW.base = id; MW.form = null; FG.last = null; sfx('click'); fgRerender(); };
ON.mw_form = (id, b, i) => { mwInit(); const F = WFORM[MW.base], k = F.findIndex(f => f.id === MW.form); MW.form = F[(k + i + F.length) % F.length].id; FG.last = null; sfx('click'); fgRerender(); };
ON.mw_tier = (id, b, i) => { mwInit(); MW.tier = (MW.tier + i + TIERS) % TIERS; FG.last = null; sfx('click'); fgRerender(); };
ON.mw_cyc = id => { const o = mwOptions(id); if (o.length) { const k = o.indexOf(mwPick(id)); MW.pick[id] = o[(k + 1) % o.length]; } FG.last = null; sfx('click'); fgRerender(); };
ON.mw_make = () => {
  const r = mwCraft();
  if (!r) { sfx('deny'); fgRerender(); return; }
  sfx(r.it.rar >= 4 ? 'myth' : 'craft'); shake(3);
  toast(r.lucky ? _t('MEISTERSTÜCK! {item}', { item: itemName(r.it) }) : _t('{item} geschmiedet', { item: itemName(r.it) }), RAR[r.it.rar].c);
  FG.last = { tab: 'mw', k: 'mw', uid: r.it.uid, lucky: r.lucky }; selItem = r.it.uid; fgDone(); fgRerender(); fgTop();
};
ON.mw_equip = id => { const f = findItem(id); if (f && f.bi != null && equipFromBag(f.bi)) { sfx('swing'); toast(_t('{item} angelegt', { item: itemName(f.it) }), RAR[f.it.rar].c); } fgDone(); fgRerender(); };
ON.mw_swap = (id, b, i) => {
  const f = findItem(id), t = mwGroup(MW.slot)[i];
  FG.last = null; if (f && t && mwSwap(f.it, t)) { sfx('fuse'); shake(2); toast(_t('Umgebaut: {item}', { item: itemName(f.it) }), RAR[f.it.rar].c); } else sfx('deny');
  fgDone(); fgRerender();
};
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
ON.zr_one = id => {
  const f = findItem(id); if (!f || f.bi == null) { sfx('deny'); fgRerender(); return; }
  if (salvRisky(f.it) && zrArm !== id) { zrArm = id; sfx('click'); fgRerender(); return; }
  zrArm = null; const R = salvage(f.it); if (R) { FG.last = Object.assign({ tab: 'zer', k: 'salv' }, R); sfx('craft'); selItem = null; }
  fgDone(); fgRerender(); fgTop();
};
ON.zr_all = id => {
  const r = +id, L = salvBulkList(r); if (!L.length) { sfx('deny'); fgRerender(); return; }
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
.mwstep{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;gap:6px;align-items:stretch;margin-bottom:6px}
.mwstep>div{background:var(--stone-lo);padding:4px 8px;text-align:center;display:grid;align-content:center}
.mwstep b{font-family:var(--f-display);font-weight:400;font-size:8px;line-height:1.6}.mwstep small{font-size:15px;color:var(--parch-dim);line-height:1.05}
.mwstep .btn{font-size:14px;padding:4px 0}
.fgpick:disabled{cursor:default;color:inherit}.fgpick .pill{min-width:34px;text-align:center}
.fgrow .acts{flex-direction:column;align-items:stretch;gap:5px}.fgrow .acts .btn{white-space:nowrap}.fgn{font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--parch)}
.fgbox.sm{padding:6px 10px;margin-bottom:8px;grid-template-columns:28px minmax(0,1fr)}.fgbox.sm>img{width:28px;height:28px}
.zrbulk{display:grid;grid-template-columns:repeat(2,minmax(0,230px));gap:6px;margin-bottom:8px}
.fgar{font-family:var(--f-body);font-size:18px;line-height:0;vertical-align:-1px}.fgrow .cost{font-size:16px;margin:3px 0 0}
.zrcard{margin:0}.zrcard .btn{white-space:nowrap}
.slot[aria-label^="⚒"]::after{content:"⚒";position:absolute;left:3px;bottom:1px;font-size:13px;line-height:1;color:#ffd24a;text-shadow:1px 1px 0 #000}
</style>`);
