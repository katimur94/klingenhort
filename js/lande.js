'use strict';
/* =========================================================
   KLINGENHORT – Die Verlorenen Lande – offene Freiwelt mit Beute, NPCs, Missionen, Bossen und Ausgängen; wer stirbt, verliert, was er trägt
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein.
   Ein Ausflug: Weltentor → große Zufallskarte → Beute in den Rucksack → durch einen Ausgang entkommen.
   Tod: Ausrüstung und Rucksack sind verloren, nur die Begleiter-Tasche (petBagSize, p.bag) kommt mit heim.
   Neu laden oder abbrechen: Rucksack verloren, der Held behält die Ausrüstung, mit der er losging.
   Spielstand: SAVE.meta.lande (Statistik, Ruf, Schlüssel, Weltstufen, Fundkiste, laufender Ausflug).
   Schnittstelle: landeLootHTML(entry), LANDE_TIER, landeLuck()/landeRar() (Seltenheit in randomItem), landeActive()
   Beute-Einträge: { t: 'item', it } | { t: 'mat', k, n } | { t: 'gem', k, n } | { t: 'part', k, n } | { t: 'egg', d } | { t: 'gold', n }
   ========================================================= */

/* ---------- Weltstufen, Gebiete, Truhen ---------- */
const LROM = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
// st: Gegnerstufe am Eingang · luck: Glück für Legendär/Mythisch · need: so oft aus der Stufe davor entkommen · ch: Sekunden am Ausgang
const LANDE_TIER = [
  { n: _t('Grenzland'), d: _t('Wiesen, Wälder und alte Ruinen am Rand der Lande. Für den Anfang.'), lv: 5, st: 6, luck: 1, need: 0, size: 112, c: '#79c24e', bio: ['wiese', 'wald', 'fels', 'ruine'], boss: [0, 2, 1], dark: .05, ch: 3, mus: 45 },
  { n: _t('Wildnis'), d: _t('Tiefe Wälder, Sümpfe und Schnee. Hier jagen ganze Rudel.'), lv: 12, st: 15, luck: 1.7, need: 1, size: 118, c: '#e8b04a', bio: ['wald', 'sumpf', 'fels', 'schnee'], boss: [2, 4, 5], dark: .12, ch: 3.5, mus: 43 },
  { n: _t('Verderbnis'), d: _t('Asche und Gift. Die Leere hat hier schon zugebissen.'), lv: 20, st: 25, luck: 2.6, need: 2, size: 122, c: '#b892f4', bio: ['sumpf', 'asche', 'wald', 'ruine'], boss: [5, 6, 3], dark: .2, ch: 4, mus: 41 },
  { n: _t('Abgrund'), d: _t('Lava, Obsidian und Schatten. Nur für die Besten.'), lv: 30, st: 37, luck: 3.8, need: 3, size: 126, c: '#ff6a5a', bio: ['asche', 'lava', 'ruine', 'fels'], boss: [7, 6, 3], dark: .28, ch: 4.5, mus: 38 }
];
for (let i = 2; i <= 10; i++) LANDE_TIER.push({ n: _t('Abgrund {n}', { n: LROM[i] }), d: _t('Jede Stufe tiefer: stärkere Gegner, bessere Beute, seltenere Eier.'), lv: Math.min(50, 30 + i * 2), st: 37 + (i - 1) * 7, luck: 3.8 + (i - 1) * .7, need: 1, size: 126, c: '#ff4fd8', bio: ['asche', 'lava', 'ruine', 'fels'], boss: [7, 6, 3, 4], dark: .32, ch: 5, mus: 38 });
// Gebiete: g = Bodenfarben, tree/td = Bäume und Dichte, rk = Felsen, pool = Pfützen, amb = Schwebeteilchen (js/combat.js ambient), en = Bewohner
const LBIO = {
  wiese: { n: _t('Wiese'), g: ['#4c7a32', '#44702c', '#58883a', '#3c6628'], tree: ['eiche', 'eiche', 'herbst'], td: .03, rk: .012, pool: 'wasser', deco: 'blume', amb: '', en: ['goblin', 'gobarcher', 'lizard', 'bomber', 'orc', 'kuerbis', 'ogre', 'berserker'] },
  wald: { n: _t('Wald'), g: ['#2e5426', '#284a20', '#36602e', '#223e1a'], tree: ['eiche', 'tanne', 'eiche', 'dunkel'], td: .3, rk: .01, pool: 'wasser', deco: 'pilz', amb: 'moss', en: ['lizard', 'lizshaman', 'slime', 'orc', 'wurm', 'elfe', 'gobarcher', 'hexe'] },
  fels: { n: _t('Felsland'), g: ['#6a6152', '#5f5648', '#776d5d', '#534a3e'], tree: ['tot'], td: .02, rk: .075, deco: 'kies', amb: '', en: ['skeleton', 'skelarcher', 'zwerg', 'golem', 'ogre', 'bomber', 'berserker', 'frostoger'] },
  ruine: { n: _t('Ruinen'), g: ['#55524e', '#4b4844', '#625e58', '#423f3b'], floor: 1, tree: ['tot'], td: .015, rk: .02, deco: 'knochen', amb: 'gruft', en: ['skeleton', 'skelarcher', 'mage', 'geist', 'skelmage', 'zombie', 'todesritter'] },
  sumpf: { n: _t('Sumpf'), g: ['#3c4a2c', '#344222', '#475a32', '#2c3a1e'], tree: ['tot', 'eiche'], td: .07, rk: .01, pool: 'gift', deco: 'schilf', amb: 'moss', en: ['toxslime', 'seuche', 'hexe', 'wurm', 'lizshaman', 'kuerbis', 'slime'] },
  schnee: { n: _t('Schneefeld'), g: ['#d6e2ec', '#c8d6e2', '#e6eef6', '#b4c4d2'], tree: ['schnee', 'schnee', 'tot'], td: .1, rk: .03, pool: 'eis', deco: 'eis', amb: 'frost', en: ['icez', 'eisgeist', 'frostoger', 'skelarcher', 'golem', 'elfe'] },
  asche: { n: _t('Aschefeld'), g: ['#3e3537', '#352d2f', '#483e40', '#2c2527'], tree: ['tot', 'kohle'], td: .05, rk: .04, deco: 'glut', amb: 'glut', en: ['imp', 'chort', 'pyro', 'glutschleim', 'lavadaemon', 'engel', 'schattenimp', 'todesritter'] },
  lava: { n: _t('Glutland'), g: ['#2e201c', '#261a16', '#3a2822', '#1e1410'], tree: ['kohle'], td: .02, rk: .06, pool: 'lava', deco: 'glut', amb: 'glut', en: ['imp', 'chort', 'lavadaemon', 'jungdrache', 'golem', 'glutschleim', 'pyro'] }
};
// Fundstellen: it = Gegenstände [min, max], min = Mindest-Seltenheit, luck = Glück, egg/key/map = Chancen
const LCH = {
  holz: { n: _t('Holztruhe'), it: [1, 1], min: 0, luck: 1, gold: [6, 14], mats: .5, gem: .1, part: .1, egg: 0 },
  eisen: { n: _t('Eisentruhe'), it: [1, 2], min: 1, luck: 1.4, gold: [10, 22], mats: .6, gem: .25, part: .25, egg: .01, tint: 'rgba(160,180,215,.6)' },
  gold: { n: _t('Goldtruhe'), it: [2, 2], min: 2, luck: 2.2, gold: [24, 50], mats: .8, gem: .45, part: .4, egg: .04, tint: 'rgba(255,205,60,.62)' },
  fluch: { n: _t('Verfluchte Truhe'), it: [2, 3], min: 2, luck: 3, gold: [20, 40], mats: .6, gem: .4, part: .4, egg: .05, tint: 'rgba(150,60,220,.6)', trap: 1 },
  schloss: { n: _t('Verschlossene Truhe'), it: [2, 3], min: 3, luck: 3.6, gold: [30, 60], mats: 1, gem: .6, part: .6, egg: .12, tint: 'rgba(40,50,70,.65)', lock: 1 },
  rest: { n: _t('Gefallener Abenteurer'), it: [1, 1], min: 1, luck: 1.6, gold: [8, 20], mats: .3, gem: .15, part: .2, egg: .02, key: .25, map: .35 },
  versteck: { n: _t('Vergrabener Schatz'), it: [0, 1], min: 2, luck: 2.4, gold: [20, 45], mats: .7, gem: .9, part: .7, egg: .08, key: .1 },
  kraut: { n: _t('Kräuterbeet') }
};
// Gefahr über die Zeit: ab Sekunde t
const LDNG = [
  { n: _t('RUHIG'), c: '#79c24e', t: 0 },
  { n: _t('UNRUHIG'), c: '#e8d04a', t: 240, b: _t('DIE SONNE SINKT'), s: _t('Die Lande werden unruhig – mehr Gegner streifen umher.') },
  { n: _t('BEDROHLICH'), c: '#ff8a3a', t: 420, b: _t('DIE NACHT BRICHT AN'), s: _t('Jäger der Leere sind unterwegs. Denk an den Ausgang!') },
  { n: _t('VERDERBNIS'), c: '#c060ff', t: 600, b: _t('DIE VERDERBNIS WÄCHST'), s: _t('Ein weiteres Ungeheuer erwacht. Zeit zu gehen!') },
  { n: _t('FINSTERNIS'), c: '#ff4a4a', t: 780, b: _t('FINSTERNIS'), s: _t('Die Lande verschlingen jeden, der bleibt!') }
];
// Ruf bei den Kundschaftern: Rang ab Punkten, dazu ein Vorteil
const LREP = [
  { at: 0, n: _t('Fremder'), d: _t('Noch kennt dich hier niemand.') },
  { at: 150, n: _t('Bekannter'), d: _t('Händler Bodo gibt 10 % Rabatt.') },
  { at: 400, n: _t('Kundschafter'), d: _t('+1 Platz im Rucksack.') },
  { at: 900, n: _t('Verbündeter'), d: _t('Ein Auftrag mehr, Händler und Heilerin stehen gleich auf der Karte.') },
  { at: 1800, n: _t('Held der Lande'), d: _t('+1 Platz im Rucksack, Ausgänge eine Sekunde schneller.') },
  { at: 3500, n: _t('Legende der Lande'), d: _t('Jeder Ausflug beginnt mit einem Schlüssel.') }
];
const LNPC = {
  mis: { n: _t('Kundschafterin Elwa'), sp: 'elff', c: '#57c7e6', icon: 'l_auftrag', hi: _t('Aufträge') },
  trade: { n: _t('Händler Bodo'), sp: 'dwarf', c: '#79c24e', icon: 'l_tausch', hi: _t('Tauschen') },
  heal: { n: _t('Kräuterfrau Mirja'), sp: 'wizf', c: '#f786a0', icon: 'l_heil', hi: _t('Heilen') }
};
// Rivalen: Name, Kampfweise (Gegnerart), Aussehen als Held (Körper, Rüstungsstufe, Haare)
const LRIV = [[_t('Kira die Flinke'), 'elfe', 'elf_f', 3, 1], [_t('Brom Eisenfaust'), 'zwerg', 'dwarf_m', 2, 3], [_t('Selvi Schattenschritt'), 'elfe', 'elf_m', 5, 8], [_t('Taro der Gierige'), 'todesritter', 'knight_m', 4, -1], [_t('Mara Dornhand'), 'hexe', 'wizard_f', 3, 7], [_t('Ulf Sturmbart'), 'zwerg', 'dwarf_f', 3, 4], [_t('Nesa die Stille'), 'pyro', 'wizard_m', 6, 3], [_t('Gorm der Sammler'), 'todesritter', 'lizard_m', 4, -1]];
const LNAMED = [_t('Rotzahn der Plünderer'), _t('Moorhexe Ilka'), _t('Knochenfürst Zarr'), _t('Grimmfell'), _t('Sturmklaue'), _t('Vargul der Wilde'), _t('Die Aschenbraut'), _t('Schädelbrecher Orm')];
const LMARK = { turm: _t('Alter Wachturm'), kreis: _t('Steinkreis'), riese: _t('Weltenbaum'), statue: _t('Statue des Ordens') };
const LTS = 16, LFC = 32, LGC = 128, LBOX = 40, LPACK = 16;
let LW = null;                     // laufender Ausflug (nur im Speicher)
const LG = { from: 'hide', sel: null, arm: null, tab: 'tausch', note: null };   // Zustand der Bildschirme

/* ---------- Spielstand ---------- */
function lMeta() { return SAVE.meta.lande; }
function lNum(v) { return Math.max(0, Math.floor(+v) || 0); }
function lEntryOk(e) {
  if (!e || typeof e !== 'object') return false;
  switch (e.t) {
    case 'item': return !!e.it && typeof e.it === 'object' && !!e.it.slot && !!e.it.uid;
    case 'mat': return !!MATS[e.k] && e.n > 0;
    case 'gem': return typeof e.k === 'string' && !!GEMS[e.k.split(':')[0]] && e.n > 0;
    case 'part': return typeof e.k === 'string' && e.n > 0;
    case 'egg': return !!e.d && typeof e.d === 'object';
    case 'gold': return e.n > 0;
  }
  return false;
}
function lMetaFix(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    runs: lNum(d.runs), ext: lNum(d.ext), deaths: lNum(d.deaths), aband: lNum(d.aband), best: lNum(d.best), rep: lNum(d.rep), done: lNum(d.done), keys: Math.min(99, lNum(d.keys)), kills: lNum(d.kills), bosses: lNum(d.bosses), rivals: lNum(d.rivals),
    tx: (Array.isArray(d.tx) ? d.tx : []).slice(0, LANDE_TIER.length).map(lNum), sel: lNum(d.sel), tips: lNum(d.tips),
    box: (Array.isArray(d.box) ? d.box : []).filter(lEntryOk).slice(0, LBOX),
    cur: d.cur && typeof d.cur === 'object' && d.cur.hero ? d.cur : null
  };
}
// Wirft hier etwas, würde loadAll einen leeren Spielstand anlegen – deshalb nie werfen
HOOK.meta.push(m => { try { m.lande = lMetaFix(m.lande); } catch (e) { console.error('Lande (meta):', e); m.lande = lMetaFix(null); } });
function landeActive() { return !!(LW && LW.on); }
function lRank(rep) { let r = 0; LREP.forEach((x, i) => { if (rep >= x.at) r = i; }); return r; }
function lPerk(k) { const r = lRank(lMeta().rep); if (k === 'pack') return (r >= 2 ? 1 : 0) + (r >= 4 ? 1 : 0); if (k === 'rabatt') return r >= 1 ? .9 : 1; if (k === 'mis') return r >= 3 ? 1 : 0; if (k === 'npc') return r >= 3; if (k === 'ch') return r >= 4 ? 1 : 0; if (k === 'key') return r >= 5 ? 1 : 0; return 0; }
function lTierOpen(i) { const M = lMeta(); return i === 0 || (M.tx[i - 1] || 0) >= LANDE_TIER[i].need; }
function lTopTier() { let t = 0; for (let i = 1; i < LANDE_TIER.length; i++) if (lTierOpen(i)) t = i; else break; return t; }

/* ---------- Begleiter (Schnittstelle aus js/pets.js, alles optional) ---------- */
function lPetApi() { return typeof petActive === 'function' && typeof petBagSize === 'function'; }
function lPet() { if (!lPetApi()) return null; try { return petActive() || null; } catch (_) { return null; } }
function lBagSize(p) { if (!p) return 0; try { return Math.max(0, Math.floor(petBagSize(p)) || 0); } catch (_) { return 0; } }
function lBag(p) { if (!Array.isArray(p.bag)) p.bag = []; return p.bag; }
function lPetName(p) { try { if (typeof petName === 'function') return petName(p); } catch (_) { } return p && p.nm ? p.nm : _t('Begleiter'); }
function lPetIcon(p) { try { if (typeof petIconURL === 'function') { const u = petIconURL(p); if (u) return u; } } catch (_) { } return iconURL(['pa', 'l_ei']); }
// Der aktive Begleiter, auch wenn er verletzt ist (zum Anzeigen)
function lPetAny() { const M = SAVE && SAVE.meta.pets; return M && Array.isArray(M.list) ? M.list.find(x => x.id === M.act) || null : null; }
function lPetHurt(p) { try { return !!p && typeof petIsHurt === 'function' && petIsHurt(p); } catch (_) { return false; } }

/* ---------- Beute-Einträge: Name, Bild, Wert ---------- */
const LMATV = {}; MATORDER.forEach((k, i) => { LMATV[k] = Math.round(5 * Math.pow(1.5, i)); });
function lGemParts(k) { const [id, gr] = String(k).split(':'); return { id, gr: +gr || 0 }; }
function lName(e) {
  try {
    switch (e.t) {
      case 'item': return itemName(e.it);
      case 'mat': return MATS[e.k].n;
      case 'gem': { const g = lGemParts(e.k); return _t('{grade} {gem}', { grade: GEMGRADE[g.gr] || '', gem: GEMS[g.id].n }); }
      case 'part': { if (typeof pparse === 'function' && typeof pname === 'function') { const p = pparse(e.k); return pname(p.t, p.g, p.el); } return _t('Bauteil'); }
      case 'egg': return (typeof petLabel === 'function' && petLabel(e.d)) || _t('Begleiter-Ei');
      case 'gold': return _t('{n} Gold', { n: fmt(e.n) });
    }
  } catch (_) { }
  return '?';
}
function lCol(e) {
  switch (e.t) {
    case 'item': return RAR[e.it.rar] ? RAR[e.it.rar].c : '#c8c8c8';
    case 'mat': return MATS[e.k] ? MATS[e.k].c : '#c8c8c8';
    case 'gem': { const g = GEMS[lGemParts(e.k).id]; return g ? g.c : '#c8c8c8'; }
    case 'part': { try { if (typeof gradeCol === 'function' && typeof pparse === 'function') return gradeCol(pparse(e.k).g); } catch (_) { } return '#c8c8c8'; }
    case 'egg': return '#ffd24a';
    case 'gold': return '#e8b04a';
  }
  return '#c8c8c8';
}
function lIcon(e) {
  try {
    switch (e.t) {
      case 'item': return itemIconURL(e.it);
      case 'mat': return iconURL(['mat', e.k]);
      case 'gem': { const g = lGemParts(e.k); return iconURL(['gem', g.id, g.gr]); }
      case 'part': if (typeof partIconURL === 'function' && typeof pparse === 'function') { const p = pparse(e.k); return partIconURL(p.t, p.g, p.el); } return iconURL(['pa', 'l_teil']);
      case 'egg': { if (typeof petIconURL === 'function') { const u = petIconURL(e.d); if (u) return u; } return iconURL(['pa', 'l_ei']); }
      case 'gold': return iconURL(['pa', 'l_gold']);
    }
  } catch (_) { }
  return iconURL(['pa', 'l_teil']);
}
function lCount(e) { return e.t === 'mat' || e.t === 'gem' || e.t === 'part' ? e.n : 0; }
// Marktwert: aus dem Basar (js/market.js), sonst eine einfache Schätzung
function lVal(e) {
  try { if (typeof lootValue === 'function') { const v = lootValue(e); if (v > 0) return Math.round(v); } } catch (_) { }
  switch (e.t) {
    case 'item': { try { if (typeof itemValue === 'function') { const v = itemValue(e.it); if (v > 0) return Math.round(v); } } catch (_) { } return Math.round(itemPrice(e.it) * [1, 1.3, 1.8, 2.6, 5, 4, 12][e.it.rar || 0]); }
    case 'mat': return (LMATV[e.k] || 5) * e.n;
    case 'gem': { const g = lGemParts(e.k); return 25 * (g.gr + 1) * (g.gr + 1) * e.n; }
    case 'part': { let g = 1; try { g = pparse(e.k).g || 1; } catch (_) { } return 20 * g * g * e.n; }
    case 'egg': return 300 * Math.pow(1 + (+e.d.tier || 0), 2);
    case 'gold': return e.n;
  }
  return 0;
}
function lSum(list) { let v = 0; for (const e of list) v += lVal(e); return v; }
// Kleine Zeile für eine Beute (auch für andere Systeme)
function landeLootHTML(e, right) {
  if (!lEntryOk(e)) return '';
  const c = lCol(e), n = lCount(e);
  return `<div class="row" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${c}"><img src="${lIcon(e)}" alt=""></div><div><div class="nm" style="color:${c}">${esc(lName(e))}${n > 1 ? ' ×' + n : ''}</div><div class="st">${e.t === 'item' ? esc(RAR[e.it.rar].n + ' · ' + MAT[e.it.tier].n) : ''}</div></div>${right != null ? right : `<span class="pill dim">${_t('{n} G', { n: fmt(lVal(e)) })}</span>`}</div>`;
}

/* ---------- Rucksack ---------- */
function lCap() { return LPACK + lPerk('pack'); }
function lStack(e) { return e.t === 'mat' || e.t === 'gem' || e.t === 'part' || e.t === 'gold'; }
function lAdd(list, e, cap) { if (lStack(e)) { const s = list.find(x => x.t === e.t && x.k === e.k); if (s) { s.n += e.n; return true; } } if (list.length >= cap) return false; list.push(e); return true; }
function lPackAdd(e) { return lAdd(LW.pack, e, lCap()); }
function lPackHas(t, k) { let n = 0; for (const e of LW.pack) if (e.t === t && e.k === k) n += e.n; return n; }
function lPackGold() { const g = LW.pack.find(e => e.t === 'gold'); return g ? g.n : 0; }
function lPackPay(t, k, n) { const e = LW.pack.find(x => x.t === t && x.k === k); if (!e || e.n < n) return false; e.n -= n; if (e.n <= 0) LW.pack.splice(LW.pack.indexOf(e), 1); return true; }

/* ---------- Heimbringen: Beutel → Lager → Fundkiste → verkauft ---------- */
function lDeliver(list) {
  const r = { bag: 0, stash: 0, box: 0, sold: 0, eggs: 0, n: 0 }, M = lMeta(), S = SAVE.meta.hide.stash, cap = typeof stashCap === 'function' ? stashCap() : 0;
  for (const e of list) {
    if (!lEntryOk(e)) continue; r.n++;
    switch (e.t) {
      case 'item': { const it = e.it; delete it.lw; if (P.bag.length < 30) { P.bag.push(it); r.bag++; } else if (S.length < cap) { S.push(it); r.stash++; } else if (M.box.length < LBOX) { M.box.push(e); r.box++; } else { r.sold += itemPrice(it); P.gold += itemPrice(it); } break; }
      case 'mat': gainMat(e.k, e.n); break;
      case 'gem': P.gems[e.k] = (P.gems[e.k] || 0) + e.n; break;
      case 'part': if (typeof padd === 'function' && P.parts) padd(e.k, e.n); else if (M.box.length < LBOX) { M.box.push(e); r.box++; } break;
      case 'gold': P.gold += e.n; break;
      case 'egg': { let ok = false; try { ok = typeof petImport === 'function' && petImport(Object.assign({ egg: 1 }, e.d)); } catch (_) { } if (ok) r.eggs++; else if (M.box.length < LBOX) { M.box.push(e); r.box++; } else { const g = lVal(e); P.gold += g; r.sold += g; } break; }
    }
  }
  return r;
}
function lDeliverHTML(r) {
  const p = [];
  if (r.bag) p.push(_t('{n} in den Beutel', { n: r.bag })); if (r.stash) p.push(_t('{n} ins Lager', { n: r.stash })); if (r.box) p.push(_t('{n} in die Fundkiste am Weltentor', { n: r.box })); if (r.eggs) p.push(_t('{n} Ei(er) ins Brutnest', { n: r.eggs })); if (r.sold) p.push(_t('Kein Platz mehr: für {n} Gold verkauft', { n: fmt(r.sold) }));
  return p.length ? `<p class="sub">${p.join(' · ')}</p>` : '';
}
// Was der Begleiter in der Tasche trägt, kommt heim (und die Tasche wird leer)
function lPetBagTake(p) { if (!p || !Array.isArray(p.bag)) return []; const l = p.bag.splice(0); persist(); return l; }

/* ---------- Seltenheit in der Freiwelt (benutzt von randomItem in js/items.js) ---------- */
function landeLuck() { if (!LW || !LW.on) return 0; return LW.rollL || lLuckAt(P.x, P.y); }
// r = Zufallszahl (durch Beute-Bonus schon kleiner), L = Glück ≥ 1 → Seltenheit (6 = Mythisch)
function landeRar(r, L) { const m = .0012 * L, l = m + .012 * L, e = l + .05 + .01 * L, s = e + .18, g = s + .34; return r < m ? 6 : r < l ? 4 : r < e ? 3 : r < s ? 2 : r < g ? 1 : 0; }

/* ---------- Kleine Rechenhelfer der Welt ---------- */
function lZone(x, y) { return clamp(Math.hypot(x - LW.spawn.x, y - LW.spawn.y) / LW.maxd, 0, 1); }
function lLuckAt(x, y) { return LW.TT.luck * (1 + lZone(x, y) * .6) * (1 + LW.danger * .08); }
function lInRift(x, y) { return LW.cr > 0 && Math.hypot(x - LW.rift.x, y - LW.rift.y) < LW.cr; }
function lStage(x, y) { return LW.TT.st + Math.round(lZone(x, y) * 4) + LW.danger + (lInRift(x, y) ? 2 : 0); }
function lSetStage(st) { if (!G) return; G.row = st - 1 - (P.act - 1) * 7; G.stage = st; }
function lBioAt(x, y) { const tx = clamp(Math.floor(x / LTS), 0, LW.N - 1), ty = clamp(Math.floor(y / LTS), 0, LW.N - 1); return LW.bios[LW.reg[ty * LW.N + tx]]; }
function lPool(bk, st) { const l = (LBIO[bk] ? LBIO[bk].en : []).filter(k => EN[k] && EN[k].from <= st + 5); return l.length ? l : poolFor(Math.max(1, st)).slice(-6); }
function lWave(bk, st, budget, max) { const pool = lPool(bk, st), list = []; while (budget > .9 && list.length < (max || 8)) { const o = pool.filter(k => EN[k].cost <= budget + .5); if (!o.length) break; const k = pick(o); list.push(k); budget -= EN[k].cost; } if (!list.length) list.push(pool[0]); return list; }
function lMatPick(st) { const a = MATORDER.slice(0, clamp(5 + Math.floor(st / 5), 5, MATORDER.length)); return a[Math.max(0, a.length - 1 - Math.floor(Math.random() * Math.random() * a.length))]; }
function lEgg(luck) {
  try {
    if (typeof eggRoll === 'function' && typeof eggTierRoll === 'function') { const tier = eggTierRoll(luck), sp = eggRoll(tier); if (sp) return { egg: 1, sp, tier }; }
    if (typeof PET_SP !== 'undefined' && PET_SP) { const ks = Object.keys(PET_SP); if (ks.length) return { egg: 1, sp: pick(ks) }; }
  } catch (_) { }
  return null;
}
function lPart(st, bonus) { try { if (typeof partRoll === 'function' && typeof partGrade === 'function' && typeof PARTORDER !== 'undefined') return partRoll(pick(PARTORDER), partGrade(st, bonus || 0)); } catch (_) { } return null; }
// Gegenstand mit Freiwelt-Glück
function lItem(minRar, luckMul, st) {
  const s = st || lStage(P.x, P.y); LW.rollL = lLuckAt(P.x, P.y) * (luckMul || 1);
  let it; try { it = randomItem(s, minRar || 0, { setChance: .008 * (luckMul || 1) }); } finally { LW.rollL = 0; }
  return it;
}

/* ---------- Rauschen und Karte erzeugen ---------- */
function lNoise(R, w, h, cell) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i++) g[i] = R();
  return (x, y) => { const fx = clamp(x, 0, w) / cell, fy = clamp(y, 0, h) / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), v = (i, j) => g[(y0 + j) * gw + x0 + i]; return lerp(lerp(v(0, 0), v(1, 0), sx), lerp(v(0, 1), v(1, 1), sx), sy); };
}
function lGen(ti, seed) {
  const TT = LANDE_TIER[ti], R = mulberry(seed), N = TT.size, S = N * LTS, FN = Math.ceil(S / LFC), GN = Math.ceil(S / LGC);
  const L = { id: uid(), ti, TT, N, S, FN, GN, seed, on: false, t: 0, reg: new Uint8Array(N * N), path: new Uint8Array(N * N), bios: [], grid: Array.from({ length: GN * GN }, () => []), objs: [], spots: [], camps: [], npcs: {}, exits: [], marks: [], lakes: [], pats: [], bosses: [], rivals: [], fog: new Uint8Array(FN * FN), pack: [], mis: [], misOn: false, ch: 0, chEx: null, danger: 0, cr: 0, hurtT: -9, fullT: -9, msgT: {}, kills: 0, chests: 0, offers: null, healFree: true, scrolls: 0, buffT: 0, buffV: 0, sleep: [], near: null, dig: 0, digO: null, tick: 0, hudT: 0, mapT: 0, huntT: 40, revT: 0, gone: [] };
  LW = L;   // die Helfer unten lesen LW
  // Gebiete: verzerrte Voronoi-Zellen, jedes Gebiet der Stufe mindestens einmal
  const bl = TT.bio.slice().sort(() => R() - .5); bl.push(TT.bio[Math.floor(R() * TT.bio.length)]);
  const seeds = [];
  for (const b of bl) { let best = null, bd = -1; for (let k = 0; k < 24; k++) { const x = (.1 + R() * .8) * N, y = (.1 + R() * .8) * N; let d = 1e9; for (const s of seeds) d = Math.min(d, Math.hypot(s.x - x, s.y - y)); if (d > bd) { bd = d; best = { x, y, b }; } } seeds.push(best); }
  L.bios = seeds.map(s => s.b);
  const nx = lNoise(R, N, N, 10), ny = lNoise(R, N, N, 10), nf = lNoise(R, N, N, 4), nd = lNoise(R, N, N, 6);
  for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
    const wx = tx + (nx(tx, ty) - .5) * 26 + (nf(tx, ty) - .5) * 5, wy = ty + (ny(tx, ty) - .5) * 26 + (nf(ty, tx) - .5) * 5;
    let bi = 0, bd = 1e9; seeds.forEach((s, i) => { const d = (s.x - wx) * (s.x - wx) + (s.y - wy) * (s.y - wy); if (d < bd) { bd = d; bi = i; } }); L.reg[ty * N + tx] = bi;
  }
  // Startpunkt an einem Rand, Ausgänge an den anderen
  const side = Math.floor(R() * 4), mg = S * .09, al = S * (.3 + R() * .4);
  L.spawn = side === 0 ? { x: al, y: S - mg } : side === 1 ? { x: mg, y: al } : side === 2 ? { x: al, y: mg } : { x: S - mg, y: al };
  L.maxd = Math.max(...[[0, 0], [S, 0], [0, S], [S, S]].map(([x, y]) => Math.hypot(x - L.spawn.x, y - L.spawn.y))) * .82;
  const occ = [{ x: L.spawn.x, y: L.spawn.y, r: 110 }];
  const lakeHit = (x, y, r) => L.lakes.some(l => ((x - l.x) / (l.rx + r)) ** 2 + ((y - l.y) / (l.ry + r)) ** 2 < 1);
  const free = (x, y, r) => x > 36 && y > 36 && x < S - 36 && y < S - 36 && !lakeHit(x, y, r) && occ.every(o => (o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) > (o.r + r) * (o.r + r));
  const place = (r, z0, z1, tries) => { for (let k = 0; k < (tries || 80); k++) { const x = 50 + R() * (S - 100), y = 50 + R() * (S - 100), z = lZone(x, y); if (z < z0 || z > z1 || !free(x, y, r)) continue; occ.push({ x, y, r }); return { x, y, z }; } return null; };
  const add = o => { L.objs.push(o); const gi = clamp(Math.floor(o.y / LGC), 0, GN - 1) * GN + clamp(Math.floor(o.x / LGC), 0, GN - 1); L.grid[gi].push(o); return o; };
  L.add = add;
  // Ausgänge: weit weg vom Start, an den anderen Rändern
  const sides = [0, 1, 2, 3].filter(s => s !== side).sort(() => R() - .5), kinds = ti === 0 ? ['portal', 'portal', 'mond'] : ['portal', 'mond', 'schluessel'];
  sides.forEach((sd, i) => {
    let best = null;
    // weit weg vom Start, aber auch nicht neben einem anderen Ausgang
    for (let k = 0; k < 30; k++) { const a = S * (.15 + R() * .7), m = S * .07, p = sd === 0 ? { x: a, y: S - m } : sd === 1 ? { x: m, y: a } : sd === 2 ? { x: a, y: m } : { x: S - m, y: a }; let d = Math.hypot(p.x - L.spawn.x, p.y - L.spawn.y); for (const e of L.exits) d = Math.min(d, Math.hypot(p.x - e.x, p.y - e.y) * 1.4); if (!best || d > best.d) best = Object.assign(p, { d }); }
    occ.push({ x: best.x, y: best.y, r: 70 });
    L.exits.push(add({ k: 'exit', t: kinds[i], x: best.x, y: best.y, r: 0, ph: R() * 80, open: kinds[i] !== 'schluessel', solid: false }));
  });
  // Riss der Verderbnis: gegenüber vom Start
  L.rift = add({ k: 'rift', x: clamp(S / 2 + (S / 2 - L.spawn.x) * .55 + (R() - .5) * S * .2, 120, S - 120), y: clamp(S / 2 + (S / 2 - L.spawn.y) * .55 + (R() - .5) * S * .2, 120, S - 120), r: 0 });
  occ.push({ x: L.rift.x, y: L.rift.y, r: 60 });
  // Freundliche Lager: Kundschafterin nah am Start, Händler und Heilerin weiter draußen
  for (const [role, z0, z1] of [['mis', .1, .26], ['trade', .25, .5], ['heal', .4, .62]]) {
    const p = place(68, z0, z1, 200) || place(60, 0, 1, 200); if (!p) continue;
    const N_ = LNPC[role], o = add({ k: 'npc', role, x: p.x, y: p.y, r: 6, solid: true, sp: N_.sp, face: R() < .5 ? 1 : -1, name: N_.n });
    L.npcs[role] = o;
    add({ k: 'fire', x: p.x + 22, y: p.y + 10, r: 5, solid: true });
    if (role === 'trade') add({ k: 'prop', t: 'wagen', v: 0, x: p.x - 30, y: p.y - 6, r: 11, solid: true });
    if (role === 'heal') add({ k: 'prop', t: 'zelt', v: 2, x: p.x - 28, y: p.y - 10, r: 10, solid: true });
    if (role === 'mis') add({ k: 'prop', t: 'schild', v: 0, x: p.x - 22, y: p.y - 4, r: 3, solid: true });
  }
  // Wahrzeichen zur Orientierung
  const mk_ = ['turm', 'kreis', 'riese', 'statue'].sort(() => R() - .5).slice(0, 3 + (N > 116 ? 1 : 0));
  for (const t of mk_) {
    const p = place(t === 'kreis' ? 56 : 44, .2, 1, 120); if (!p) continue;
    const o = add({ k: 'mark', t, x: p.x, y: p.y, r: t === 'turm' ? 15 : t === 'riese' ? 12 : t === 'statue' ? 7 : 0, solid: t !== 'kreis', name: LMARK[t] }); L.marks.push(o);
    if (t === 'kreis') for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + R() * .3; add({ k: 'prop', t: 'menhir', v: i % 2, x: p.x + Math.cos(a) * 36, y: p.y + Math.sin(a) * 22, r: 4, solid: true }); }
  }
  // Wege: Start → Kundschafterin → Händler → Heilerin → Ausgänge, dazu zu Wahrzeichen
  L.roads = [];
  const road = (a, b) => {
    if (!a || !b) return; const mx = (a.x + b.x) / 2 + (R() - .5) * 220, my = (a.y + b.y) / 2 + (R() - .5) * 220, n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6), pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t, x = u * u * a.x + 2 * u * t * mx + t * t * b.x, y = u * u * a.y + 2 * u * t * my + t * t * b.y, tx = Math.floor(x / LTS), ty = Math.floor(y / LTS); pts.push([x, y]); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx && dy) continue; const X = tx + dx, Y = ty + dy; if (X >= 0 && Y >= 0 && X < N && Y < N) L.path[Y * N + X] = 1; } }
    L.roads.push(pts);
  };
  const hub = [L.spawn, L.npcs.mis, L.npcs.trade, L.npcs.heal].filter(Boolean);
  for (let i = 1; i < hub.length; i++) road(hub[i - 1], hub[i]);
  const near = p => hub.reduce((b, h) => !b || Math.hypot(h.x - p.x, h.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? h : b, null);
  for (const e of L.exits) road(near(e), e);
  for (const m of L.marks) if (R() < .7) road(near(m), m);
  // Lager der Monster (nicht zu nah am Start)
  const nCamp = Math.round(N * N / 1550);
  for (let i = 0; i < nCamp; i++) {
    const p = place(70, .3, 1, 120); if (!p) continue;
    const st = TT.st + Math.round(p.z * 4), bk = lBioAt(p.x, p.y), list = lWave(bk, st, 3 + st * .4 + p.z * 5, 7);
    const c = add({ k: 'camp', x: p.x, y: p.y, r: 5, solid: true, z: p.z, st, bk, left: list.map(t => ({ t, el: false })), alive: 0, state: 'dorm', fire: true });
    for (let k = 0; k < (p.z > .45 ? 1 : 0) + (p.z > .8 ? 1 : 0); k++) c.left.push({ t: pick(lPool(bk, st)), el: true });
    L.camps.push(c);
    for (let k = 0; k < 2; k++) { const a = R() * 6.283; add({ k: 'prop', t: 'zelt', v: k ? 1 : 0, x: p.x + Math.cos(a) * 34, y: p.y + Math.sin(a) * 20, r: 10, solid: true }); }
    L.spots.push(add({ k: 'spot', t: p.z > .6 ? 'gold' : 'eisen', x: p.x + 12, y: p.y - 18, r: 7, solid: true, z: p.z, st, open: 0 }));
  }
  // Fundstellen
  const N2 = N * N / 12544, wts = z => ({ holz: 1.3 - z, eisen: .6 + z * .4, gold: z * .55, fluch: .05 + z * .3, schloss: .08 + z * .25 });
  for (let i = 0; i < Math.round(24 * N2); i++) { const p = place(22, .08, 1); if (!p) continue; const t = wpick(wts(p.z), R); L.spots.push(add({ k: 'spot', t, x: p.x, y: p.y, r: 7, solid: true, z: p.z, st: TT.st + Math.round(p.z * 4), open: 0 })); }
  for (let i = 0; i < Math.round(7 * N2); i++) { const p = place(20, .15, 1); if (p) L.spots.push(add({ k: 'spot', t: 'rest', x: p.x, y: p.y, r: 0, solid: false, z: p.z, st: TT.st + Math.round(p.z * 4), open: 0 })); }
  for (let i = 0; i < Math.round(9 * N2); i++) { const p = place(16, .05, 1); if (p) L.spots.push(add({ k: 'spot', t: 'kraut', v: Math.floor(R() * 3), x: p.x, y: p.y, r: 0, solid: false, z: p.z, open: 0 })); }
  for (let i = 0; i < Math.round(5 * N2); i++) { const p = place(16, .3, 1); if (p) L.spots.push(add({ k: 'spot', t: 'versteck', x: p.x, y: p.y, r: 0, solid: false, z: p.z, st: TT.st + Math.round(p.z * 4), open: 0 })); }
  for (let i = 0; i < Math.round(12 * N2); i++) {
    const p = place(18, .05, 1); if (!p) continue;
    const st = TT.st + Math.round(p.z * 4), bk = lBioAt(p.x, p.y), ms = bk === 'schnee' ? 'mithril' : bk === 'lava' || bk === 'asche' ? 'glut' : bk === 'sumpf' ? 'adamant' : bk === 'ruine' ? 'kristall' : st >= 30 && R() < .3 ? 'stern' : st >= 22 && R() < .3 ? 'schuppe' : st >= 14 && R() < .4 ? 'mithril' : 'erz';
    add({ k: 'vein', mat: ms, x: p.x, y: p.y, r: 7, hp: 3, solid: true, flash: 0 });
  }
  L.namedSpot = place(40, .55, 1, 150); L.relicSpot = place(30, .6, 1, 150);
  // Streifen: wandernde Gruppen
  for (let i = 0; i < Math.round(4 * N2); i++) { const p = place(10, .3, 1); if (!p) continue; const st = TT.st + Math.round(p.z * 4); L.pats.push({ x: p.x, y: p.y, tx: p.x, ty: p.y, list: lWave(lBioAt(p.x, p.y), st, 2.5 + st * .3, 4).map(t => ({ t, el: false })), alive: 0, state: 'dorm', st, w: 0 }); }
  // Ungeheuer: wachen später auf
  const bossN = 1 + (ti >= 1 ? 1 : 0);
  for (let i = 0; i < bossN; i++) { const B = BOSSES[TT.boss[Math.floor(R() * TT.boss.length)] % BOSSES.length]; L.bosses.push({ B, x: 0, y: 0, tx: 0, ty: 0, hp: 1, state: 'sleep', wake: i === 0 ? 80 + R() * 70 : (ti >= 2 ? 330 : LDNG[3].t) + R() * 40, rumble: 0 }); }
  // Rivalen
  const rv = LRIV.slice().sort(() => R() - .5);
  for (let i = 0; i < 1 + (ti >= 1 ? 1 : 0) + (ti >= 3 ? 1 : 0); i++) { const p = place(10, .35, 1); if (!p) continue; L.rivals.push({ name: rv[i][0], type: rv[i][1], look: { body: rv[i][2], at: rv[i][3], ht: rv[i][3], hair: rv[i][4], skin: -1, accent: -1 }, x: p.x, y: p.y, hp: 1, loot: [], state: 'roam', tgt: null, t: 0, seen: false, leave: 420 + R() * 240 }); }
  // Seen und Pfützen (nicht auf Wegen)
  const pathAt = (x, y, r) => { for (let yy = Math.floor((y - r) / LTS); yy <= Math.floor((y + r) / LTS); yy++) for (let xx = Math.floor((x - r) / LTS); xx <= Math.floor((x + r) / LTS); xx++) if (xx >= 0 && yy >= 0 && xx < N && yy < N && L.path[yy * N + xx]) return true; return false; };
  for (let i = 0; i < Math.round(10 * N2); i++) {
    for (let k = 0; k < 30; k++) { const x = 80 + R() * (S - 160), y = 80 + R() * (S - 160), B = LBIO[lBioAt(x, y)], rx = 22 + R() * 36, ry = 10 + R() * 16; if (!B.pool || !free(x, y, rx + 10) || pathAt(x, y, rx + 8)) continue; L.lakes.push({ k: B.pool, x, y, rx, ry }); occ.push({ x, y, r: rx }); break; }
  }
  // Bäume, Felsen, Säulen: dichter am Kartenrand
  for (let ty = 1; ty < N - 1; ty++) for (let tx = 1; tx < N - 1; tx++) {
    if (L.path[ty * N + tx]) continue;
    const bk = L.bios[L.reg[ty * N + tx]], B = LBIO[bk], edge = Math.min(tx, ty, N - 1 - tx, N - 1 - ty) < 3 ? .45 : 0, dens = B.td * (.3 + 1.4 * nd(tx, ty)) + edge;
    const x = tx * LTS + 3 + R() * 10, y = ty * LTS + 3 + R() * 10, r0 = R();
    if (r0 < dens) { const t = pick(B.tree); if (free(x, y, 8)) add({ k: 'prop', t: t === 'dunkel' ? 'eiche' : t, v: t === 'dunkel' ? 1 : Math.floor(R() * 3), x, y, r: t === 'tot' || t === 'kohle' ? 3 : 5, solid: true }); }
    else if (r0 < dens + B.rk) { if (free(x, y, 8)) { const big = R() < .3; add({ k: 'prop', t: big ? 'fels' : 'stein', v: bk === 'schnee' ? 1 : bk === 'lava' || bk === 'asche' ? 2 : 0, x, y, r: big ? 9 : 5, solid: true }); } }
    else if (bk === 'ruine' && r0 < dens + B.rk + .025) { if (free(x, y, 9)) add({ k: 'prop', t: 'saeule', v: 0, x, y, r: 7, solid: true }); }
  }
  return L;
}

/* ---------- Pixel-Grafik: Boden, Bäume, Felsen, Zelte, Wahrzeichen ---------- */
const LTILE = {}, LSPR = {}, LCHI = {};
function lTiles(key) {
  if (LTILE[key]) return LTILE[key];
  const B = key === 'weg' ? { g: ['#7a5c3c', '#6c5034', '#876848', '#5e462e'] } : LBIO[key], R = mulberry(hashStr(key)), out = [];
  for (let v = 0; v < 6; v++) out.push(mk(16, 16, g => {
    if (B.floor) { const f = FLOORS[v % FLOORS.length]; g.drawImage(SHEET, f[0], f[1], 16, 16, 0, 0, 16, 16); g.globalAlpha = .35; g.fillStyle = '#4a4640'; g.fillRect(0, 0, 16, 16); g.globalAlpha = 1; for (let i = 0; i < 10; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, R() < .5 ? '#4c6a32' : '#3a5428'); return; }
    g.fillStyle = B.g[0]; g.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 64; i++) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, B.g[1 + Math.floor(R() * 3)]);
    if (key === 'wiese' || key === 'wald') for (let i = 0; i < 4; i++) { const x = Math.floor(R() * 15), y = 2 + Math.floor(R() * 13); px(g, x, y - 2, 1, 2, B.g[2]); px(g, x + 1, y - 1, 1, 1, B.g[2]); }
    if (key === 'weg') for (let i = 0; i < 3; i++) px(g, Math.floor(R() * 15), Math.floor(R() * 15), 2, 1, '#9a7a54');
    if (key === 'schnee' && R() < .6) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, '#ffffff');
    if (key === 'lava' && v < 3) { let x = Math.floor(R() * 16), y = Math.floor(R() * 16); for (let k = 0; k < 6; k++) { px(g, x, y, 1, 1, k % 2 ? '#c8401e' : '#7a2412'); x = (x + 1) % 16; y = (y + (R() < .5 ? 1 : 0)) % 16; } }
    if (key === 'asche' && R() < .5) px(g, Math.floor(R() * 16), Math.floor(R() * 16), 1, 1, '#a84a2a');
  }));
  return LTILE[key] = out;
}
// Boden der ganzen Karte in eine Leinwand (wie genBg für Arenen)
function lGround(L) {
  const N = L.N, S = L.S, c = mk(S, S), g = c.getContext('2d'), R = mulberry(L.seed + 99);
  g.imageSmoothingEnabled = false;
  for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) { const i = ty * N + tx, tl = lTiles(L.bios[L.reg[i]]); g.drawImage(tl[Math.floor(R() * 6)], tx * LTS, ty * LTS); }
  // Grenzen zwischen Gebieten: unregelmäßige, harte Pixelkante
  const colsOf = i => LBIO[L.bios[L.reg[i]]].g;
  const edge = (x, y, vert, i, j) => {
    const ca = colsOf(i), cb = colsOf(j); let d = Math.floor(R() * 5) - 2;
    for (let k = 0; k < 16; k++) {
      d = clamp(d + (R() < .35 ? -1 : R() < .54 ? 1 : 0), -3, 3);
      const col = (d > 0 ? cb : ca)[R() < .8 ? 0 : 1], n = Math.abs(d);
      if (vert) { if (d > 0) px(g, x - d, y + k, d, 1, col); else if (d < 0) px(g, x, y + k, n, 1, col); }
      else { if (d > 0) px(g, x + k, y - d, 1, d, col); else if (d < 0) px(g, x + k, y, 1, n, col); }
    }
  };
  for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
    const i = ty * N + tx, a = L.reg[i];
    if (tx < N - 1 && a !== L.reg[i + 1]) edge((tx + 1) * LTS, ty * LTS, true, i, i + 1);
    if (ty < N - 1 && a !== L.reg[i + N]) edge(tx * LTS, (ty + 1) * LTS, false, i, i + N);
  }
  // Wege: geschwungene Erdpfade mit dunklem Saum (Pixel-Scheiben, ohne Kantenglättung)
  const disc = (x, y, r, col) => { g.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const hw = Math.floor(Math.sqrt(r * r - dy * dy + .5)); g.fillRect(Math.round(x) - hw, Math.round(y) + dy, hw * 2 + 1, 1); } };
  const nr = lNoise(R, S, S, 120);
  for (const pass of [0, 1]) for (const pts of L.roads || []) for (const [x, y] of pts) { const r = 9 + Math.round(nr(x, y) * 5); disc(x, y, pass ? r : r + 2, pass ? '#76583a' : '#4e3a26'); }
  for (const pts of L.roads || []) for (const [x, y] of pts) { for (let k = 0; k < 3; k++) px(g, Math.round(x + rnd(-9, 9)), Math.round(y + rnd(-9, 9)), R() < .3 ? 2 : 1, 1, pick(['#6a4e32', '#87684a', '#8e7050', '#5e462e'])); if (R() < .12) { const a = x + rnd(-8, 8), b = y + rnd(-8, 8); px(g, a, b, 2, 1, '#9a8a74'); px(g, a, b + 1, 2, 1, '#5a4e40'); } }
  // Kleinkram auf dem Boden
  for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
    const i = ty * N + tx; if (L.path[i]) continue; const B = LBIO[L.bios[L.reg[i]]], x = tx * LTS + Math.floor(R() * 12) + 2, y = ty * LTS + Math.floor(R() * 12) + 3, r = R();
    switch (B.deco) {
      case 'blume': if (r < .07) { const fc = pick(['#f786a0', '#ffd24a', '#ffffff', '#b892f4', '#e8402a']); px(g, x, y, 1, 2, '#2e5a22'); px(g, x - 1, y - 1, 3, 1, fc); px(g, x, y - 2, 1, 1, fc); px(g, x, y - 1, 1, 1, '#ffe08a'); } else if (r < .14) { px(g, x, y - 3, 1, 3, B.g[2]); px(g, x + 2, y - 2, 1, 2, B.g[2]); } break;
      case 'pilz': if (r < .02) { px(g, x, y - 1, 1, 2, '#e8e2cf'); px(g, x - 1, y - 2, 3, 1, R() < .5 ? '#c8342c' : '#b07a48'); } else if (r < .08) px(g, x, y, 2, 1, '#5a4224'); break;
      case 'kies': if (r < .08) { px(g, x, y, 2, 1, '#8a8274'); px(g, x, y + 1, 2, 1, '#4a4238'); } break;
      case 'knochen': if (r < .012) g.drawImage(SHEET, 288, 432, 16, 16, x - 6, y - 8, 16, 16); else if (r < .04) { px(g, x - 2, y, 5, 1, '#d8d0bc'); px(g, x, y - 1, 1, 3, '#c8c0aa'); } break;
      case 'schilf': if (r < .06) for (let k = -2; k <= 2; k += 2) px(g, x + k, y - 5 + Math.abs(k), 1, 6 - Math.abs(k), '#5a6a2a'); break;
      case 'eis': if (r < .04) { px(g, x, y - 4, 2, 4, '#bfefff'); px(g, x, y - 4, 1, 2, '#ffffff'); } break;
      case 'glut': if (r < .05) { let cx = x, cy = y; for (let k = 0; k < 6; k++) { px(g, cx, cy, 1, 1, k % 2 ? '#ff6a2a' : '#1a0e0c'); cx += Math.floor(R() * 3 - 1); cy += 1; } } break;
    }
  }
  return c;
}
function lMiniBase(L) {
  const N = L.N, c = mk(N, N), g = c.getContext('2d'), d = g.createImageData(N, N), p = d.data, cols = L.bios.map(b => hexRgb(LBIO[b].g[2])), path = hexRgb('#a8865a');
  for (let i = 0; i < N * N; i++) { const [r, gg, b] = L.path[i] ? path : cols[L.reg[i]]; p[i * 4] = r; p[i * 4 + 1] = gg; p[i * 4 + 2] = b; p[i * 4 + 3] = 255; }
  g.putImageData(d, 0, 0);
  for (const l of L.lakes) { g.fillStyle = POOLCOL[l.k][1]; g.beginPath(); g.ellipse(l.x / LTS, l.y / LTS, l.rx / LTS + .5, l.ry / LTS + .5, 0, 0, 7); g.fill(); }
  for (const o of L.objs) if (o.k === 'prop' && (o.t === 'eiche' || o.t === 'tanne' || o.t === 'schnee')) { g.fillStyle = 'rgba(10,30,10,.35)'; g.fillRect(Math.floor(o.x / LTS), Math.floor(o.y / LTS), 1, 1); }
  return c;
}
const LPROP = {};
function lPropImg(t, v) {
  const key = t + ':' + v; if (LPROP[key]) return LPROP[key];
  const tree = ['eiche', 'herbst', 'tanne', 'schnee', 'tot', 'kohle'].includes(t), sp = t === 'saeule' ? crop(80, 80, 16, 48) : lSpr(t, v), sw = t === 'wagen' ? 15 : t === 'zelt' ? 13 : t === 'tanne' || t === 'schnee' ? 7 : t === 'saeule' ? 9 : Math.max(5, Math.round(sp.width * .36));
  const W = Math.max(sp.width, sw * 2 + 2), H = sp.height + 4, c = mk(W, H, g => { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(W / 2, sp.height - 2 + (t === 'saeule' ? 3 : 0), sw, sw * .38, 0, 0, 6.283); g.fill(); g.drawImage(sp, Math.floor((W - sp.width) / 2), 0); });
  return LPROP[key] = { c, ox: Math.floor(W / 2), oy: sp.height - (t === 'saeule' ? 4 : 2), h: sp.height, tree };
}
function lSpr(k, v) { const key = k + ':' + (v || 0); return LSPR[key] || (LSPR[key] = lPaint(k, v || 0)); }
function lPaint(k, v) {
  const R = mulberry(hashStr(k) + v * 977);
  let b;
  switch (k) {
    case 'eiche': case 'herbst': case 'riese': {
      const big = k === 'riese', w = big ? 48 : 26, h = big ? 62 : 32, cx = w / 2; b = PB(w, h);
      const C = k === 'herbst' ? ['#6a2a10', '#a84a1a', '#e07a2a', '#ffb84a'] : big ? ['#163e22', '#22603a', '#3a8a4a', '#7ad07a'] : v === 1 ? ['#163a1a', '#24582a', '#3a7a34', '#62a64a'] : v === 2 ? ['#24481c', '#3a6a24', '#5a9a32', '#8ac84a'] : ['#1e4a1e', '#2e6a2a', '#4a9a3a', '#7ac25a'];
      const tw = big ? 8 : 4, th = big ? 22 : 11; b.rect(cx - tw / 2, h - th - 1, tw, th, WOOD[0]); b.rect(cx - tw / 2 + 1, h - th - 1, Math.max(1, tw / 2 - 1), th, WOOD[1]);
      b.set(cx - tw / 2 - 1, h - 2, WOOD[0]); b.set(cx + tw / 2, h - 2, WOOD[0]); if (big) { b.rect(cx - tw / 2 - 3, h - 3, 3, 2, WOOD[0]); b.rect(cx + tw / 2, h - 3, 3, 2, WOOD[0]); }
      const cr = big ? 21 : 11, cy = big ? 22 : 12;
      b.disc(cx, cy + 1, cr, C[0]); b.disc(cx - cr * .2, cy - cr * .1, cr * .85, C[1]); b.disc(cx + cr * .35, cy - cr * .3, cr * .5, C[1]);
      for (let i = 0; i < (big ? 12 : 5); i++) b.disc(cx - cr * .55 + R() * cr * .95, cy - cr * .65 + R() * cr * .75, 1.4 + R() * (big ? 3 : 1.6), C[2]);
      for (let i = 0; i < (big ? 22 : 7); i++) b.set(cx - cr * .6 + R() * cr * 1.1, cy - cr * .85 + R() * cr, C[3]);
      if (big) for (let i = 0; i < 8; i++) b.set(cx - cr + R() * cr * 2, cy - cr * .5 + R() * cr, '#ffd24a');
      break;
    }
    case 'tanne': case 'schnee': {
      const w = 20, h = 36; b = PB(w, h); b.rect(9, 30, 2, 5, WOOD[0]);
      const C = ['#143428', '#1e4e36', '#2e6a46', '#4a8a5a'];
      for (let l = 0; l < 5; l++) { const y0 = 2 + l * 5; for (let j = 0; j < 7; j++) { const hw = Math.max(1, Math.round((1 + l * 1.5) * (j + 1) / 7 + .5)); for (let x = 10 - hw; x < 10 + hw; x++) b.set(x, y0 + j, x < 10 - hw + 2 ? C[2] : x > 10 + hw - 3 ? C[0] : C[1]); if (k === 'schnee' && j < 2) for (let x = 10 - hw; x < 10 + hw; x++) if (R() < .7) b.set(x, y0 + j, j ? '#d8e8f4' : '#ffffff'); } }
      b.set(10, 1, k === 'schnee' ? '#ffffff' : C[3]);
      break;
    }
    case 'tot': case 'kohle': {
      const w = 22, h = 28, C = k === 'kohle' ? ['#141012', '#2a2224', '#3e3436'] : ['#3a2c22', '#5a4634', '#7a6650']; b = PB(w, h);
      b.rect(10, 9, 2, 18, C[0]); b.rect(10, 9, 1, 18, C[1]); b.set(9, 26, C[0]); b.set(12, 26, C[0]);
      for (const [x0, y0, x1, y1] of [[10, 14, 3, 7], [11, 11, 18, 4], [10, 19, 4, 15], [11, 17, 19, 12], [10, 10, 8, 2], [4, 7, 2, 5], [17, 5, 20, 3]]) b.line(x0, y0, x1, y1, C[1]);
      if (k === 'kohle') for (let i = 0; i < 4; i++) b.set(9 + Math.floor(R() * 4), 10 + Math.floor(R() * 16), '#ff6a2a');
      break;
    }
    case 'stein': case 'fels': {
      const big = k === 'fels', w = big ? 26 : 16, h = big ? 18 : 12; b = PB(w, h);
      const C = v === 1 ? ['#6a7888', '#8a98a8', '#aab8c6', '#ffffff'] : v === 2 ? ['#1e1618', '#34282a', '#4a3a3a', '#ff6a2a'] : ['#4a4450', '#625c68', '#7e7884', '#a8a2ae'];
      b.disc(w / 2, h - h / 2.2, w / 2.3, C[0]); b.disc(w / 2 - 1, h - h / 2 - 1, w / 2.6, C[1]); b.disc(w / 2 - 2, h - h / 2 - 2, w / 4.5, C[2]);
      for (let i = 0; i < (big ? 6 : 3); i++) b.set(w / 2 - w / 4 + R() * w / 2, h / 3 + R() * h / 3, C[3]);
      if (v === 1) for (let x = 2; x < w - 2; x++) if (b.get(x, Math.round(h / 3))) b.set(x, Math.round(h / 3) - 1, '#ffffff');
      if (v === 2) b.line(w / 2 - 3, h - 3, w / 2 + 2, h / 2, '#ff6a2a');
      if (big) b.line(w / 2, h / 3, w / 2 + 3, h - 4, C[0]);
      break;
    }
    case 'zelt': {
      const w = 28, h = 22, C = [['#7a1e18', '#c8342c', '#e8604a'], ['#4e3018', '#8a5a32', '#b07a48'], ['#2e5a3a', '#4a8a5a', '#7ac08a']][v % 3]; b = PB(w, h);
      for (let y = 0; y < 18; y++) { const hw = Math.round(y * .72) + 1; for (let x = 14 - hw; x < 14 + hw; x++) b.set(x, y + 2, x < 14 ? C[1] : C[0]); b.set(14 - hw, y + 2, C[2]); }
      for (let y = 9; y < 20; y++) { const hw = Math.round((y - 9) * .45); for (let x = 14 - hw; x <= 14 + hw; x++) b.set(x, y, '#1a1420'); }
      b.rect(13, 0, 2, 3, WOOD[1]); b.rect(1, 19, 26, 1, C[0]);
      break;
    }
    case 'wagen': {
      b = PB(34, 26); b.rect(3, 12, 28, 8, WOOD[1]); b.rect(3, 12, 28, 1, WOOD[2]); b.rect(3, 19, 28, 1, WOOD[0]);
      for (let x = 4; x < 30; x++) { const y = 12 - Math.round(Math.sin((x - 4) / 26 * Math.PI) * 9); for (let yy = y; yy < 12; yy++) b.set(x, yy, yy < y + 2 ? '#fff3dc' : '#e8dcc0'); }
      b.disc(8, 21, 4, WOOD[0]); b.disc(8, 21, 2, WOOD[2]); b.disc(26, 21, 4, WOOD[0]); b.disc(26, 21, 2, WOOD[2]); b.rect(30, 16, 4, 1, WOOD[0]);
      b.rect(11, 9, 5, 3, '#e8b04a'); b.rect(18, 8, 4, 4, '#9aa2ae');
      break;
    }
    case 'schild': { b = PB(14, 22); b.rect(6, 6, 2, 16, WOOD[0]); b.rect(1, 3, 12, 6, WOOD[1]); b.rect(1, 3, 12, 1, WOOD[2]); b.rect(3, 5, 8, 1, '#5e3a1e'); b.rect(3, 7, 6, 1, '#5e3a1e'); break; }
    case 'menhir': { b = PB(10, 22); const C = v ? ['#4a4a5a', '#6a6a7a', '#8a8a9a'] : ['#4e4a44', '#6e6a62', '#8e8a80']; b.rect(2, 3, 6, 19, C[1]); b.rect(3, 1, 4, 2, C[1]); b.rect(2, 3, 2, 19, C[2]); b.rect(7, 4, 1, 18, C[0]); b.set(4, 9, '#57c7e6'); b.set(5, 13, '#57c7e6'); break; }
    case 'turm': {
      const w = 34, h = 58; b = PB(w, h); const C = ['#4a4652', '#625e6a', '#7a7682', '#9a96a2'];
      for (let y = 8; y < h - 1; y++) for (let x = 3; x < w - 3; x++) { const row = Math.floor(y / 4), brick = ((x + (row % 2) * 3) % 6 === 0) || y % 4 === 0; b.set(x, y, brick ? C[0] : x < 8 ? C[2] : x > w - 8 ? C[0] : C[1]); }
      for (let x = 3; x < w - 3; x++) { const top = 4 + Math.round(Math.abs(Math.sin(x * 1.7)) * 6) + (x > w / 2 ? 3 : 0); for (let y = top; y < 8; y++) b.set(x, y, C[1]); }
      b.rect(14, 18, 5, 8, '#16121e'); b.rect(15, 17, 3, 1, '#16121e'); b.rect(13, h - 13, 8, 12, '#16121e'); b.rect(14, h - 14, 6, 1, '#16121e');
      for (let i = 0; i < 14; i++) b.set(3 + R() * (w - 6), 10 + R() * (h - 14), '#4a7a32');
      break;
    }
    case 'statue': {
      b = PB(18, 38); const C = ['#5a5868', '#7a7888', '#9a98a8', '#c8c6d4'];
      b.rect(2, 30, 14, 7, C[0]); b.rect(3, 29, 12, 2, C[2]); b.rect(6, 12, 6, 17, C[1]); b.rect(6, 12, 2, 17, C[2]); b.disc(9, 9, 3, C[2]); b.rect(4, 14, 2, 9, C[1]); b.rect(12, 14, 2, 8, C[1]);
      b.rect(14, 2, 1, 22, C[3]); b.rect(12, 20, 5, 1, C[2]); b.set(9, 9, C[3]);
      break;
    }
    case 'kraut': { b = PB(14, 11); const fc = ['#f786a0', '#ffd24a', '#b892f4'][v % 3]; for (const [x, y] of [[3, 6], [6, 4], [9, 5], [11, 7], [5, 8]]) { b.line(x, 10, x, y, '#3a7a2a'); b.set(x - 1, y + 1, '#5aaa42'); b.set(x + 1, y + 2, '#5aaa42'); b.set(x, y - 1, fc); } b.set(6, 3, '#ffffff'); break; }
    case 'rest': { b = PB(22, 12); b.rect(2, 6, 8, 5, '#6a4224'); b.rect(3, 5, 6, 2, '#8a5a32'); b.rect(5, 7, 2, 2, '#e8b04a'); b.rect(12, 9, 9, 2, '#d8d0bc'); for (let i = 0; i < 4; i++) b.rect(13 + i * 2, 6, 1, 3, '#c8c0aa'); b.disc(19, 5, 2.5, '#e8e2cf'); b.set(18, 5, '#1a1420'); b.set(20, 5, '#1a1420'); b.rect(11, 3, 1, 5, '#9aa2ae'); break; }
    case 'ei': { b = PB(11, 14); b.disc(5, 8, 4.5, '#efe2bf'); b.disc(5, 6, 3.5, '#efe2bf'); b.disc(4, 6, 2, '#fff8e8'); b.set(7, 9, '#c8a87a'); b.set(3, 10, '#c8a87a'); b.set(6, 4, '#c8a87a'); b.set(3, 4, '#ffffff'); break; }
    case 'schl': { b = PB(14, 8); b.disc(3, 4, 2.6, '#e8b04a'); b.set(3, 4, null); b.rect(5, 3, 8, 2, '#e8b04a'); b.rect(10, 5, 1, 2, '#e8b04a'); b.rect(12, 5, 1, 2, '#e8b04a'); b.set(6, 3, '#ffe08a'); break; }
    case 'karte': { b = PB(14, 12); b.rect(2, 2, 10, 8, '#e8dcc0'); b.rect(1, 1, 2, 10, '#c8a87a'); b.rect(11, 1, 2, 10, '#c8a87a'); b.line(4, 7, 7, 4, '#c8463c'); b.line(7, 4, 10, 6, '#c8463c'); b.set(9, 6, '#1a1420'); break; }
    case 'relikt': { b = PB(12, 14); b.line(2, 1, 6, 5, '#e8b04a'); b.line(10, 1, 6, 5, '#e8b04a'); b.disc(6, 9, 3.5, '#e8b04a'); b.disc(6, 9, 2, '#57c7e6'); b.set(5, 8, '#ffffff'); break; }
    default: b = PB(4, 4); b.rect(0, 0, 4, 4, '#ff00ff');
  }
  return pbCanvas(pbOutline(b));
}
// Truhenbild aus dem Atlas, je Art eingefärbt
function lChestImg(t, f) {
  const key = t + f; if (LCHI[key]) return LCHI[key]; const C = LCH[t];
  return LCHI[key] = mk(16, 16, g => {
    g.drawImage(SHEET, 304 + f * 16, 416, 16, 16, 0, 0, 16, 16);
    if (C && C.tint) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = C.tint; g.fillRect(0, 0, 16, 16); g.globalCompositeOperation = 'source-over'; }
    if (t === 'schloss' && !f) { px(g, 7, 7, 3, 3, '#e8b04a'); px(g, 8, 8, 1, 1, '#1a1420'); }
    if (t === 'gold' && !f) { px(g, 3, 6, 1, 1, '#ffffff'); px(g, 12, 9, 1, 1, '#fff3c0'); }
  });
}

/* ---------- Betreten ---------- */
function lCanGo(ti) { const TT = LANDE_TIER[ti]; return !!TT && lTierOpen(ti) && P.lv >= TT.lv; }
function landeStart(ti) {
  if (!P || !lCanGo(ti)) { sfx('deny'); return false; }
  const M = lMeta(); M.sel = ti; hideOverlay(); setState('menu');
  // Erst die Pixel des Übergangs zeigen, dann die (größere) Welt bauen
  showOverlay(`<div class="center"><h2>${_t('DAS TOR ÖFFNET SICH …')}</h2><p class="sub">${esc(LANDE_TIER[ti].n)}</p></div>`);
  setTimeout(() => { try { lBegin(ti); } catch (e) { console.error('Lande (Start):', e); LW = null; document.body.classList.remove('lande'); toast(_t('Das Tor flackert – versuch es noch einmal.'), '#ff6a5a'); lGate(); } }, 30);
  return true;
}
function lBegin(ti) {
  const M = lMeta(), seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, L = lGen(ti, seed);
  AW = AH = L.S; BD = { x0: 14, x1: L.S - 14, y0: 14, y1: L.S - 14 };
  bg = { c: lGround(L), b: { key: '', name: L.TT.n, tint: [1, 1, 1], dark: L.TT.dark, root: L.TT.mus, dust: '#8a7a6a', vein: 'erz', pool: null }, fountains: [], torches: [] };
  enemies = []; projs = []; parts = []; pickups = []; texts = []; rings = []; corpses = []; ghosts = []; fx = []; allies = []; obs = []; spikes = []; hazards = []; traps = []; pools = [];
  for (const l of L.lakes) addPool(l.k, l.x, l.y, l.rx, l.ry);
  L.mini = lMiniBase(L); L.fogc = mk(L.FN, L.FN, g => { g.fillStyle = '#0c0a10'; g.fillRect(0, 0, L.FN, L.FN); });
  G = { type: 'lande', row: 0, stage: L.TT.st, waves: [], wi: 0, pending: [], phase: 'lande', t: 0, ambT: 0, timer: 0, dark: 0, lootMul: 1 + weekFx('loot'), spawnT: 0, spikeRush: 0, goldgob: null, startTime: T, kills: 0, extra: {}, daily: null, dstage: 0, dmod: null };
  P.x = L.spawn.x; P.y = L.spawn.y; P.vx = P.vy = 0; P.atkT = 0; P.roll = 0; P.rollA = 0; P.inv = 1.5; P.spin = 0; P.leap = null; P.dash = null; P.volley = 0; P.z = 0; P.chain = 0; P.wall = 0; P.stealth = 0; P.cds = [0, 0, 0]; P.manAim = null; P.hp = P.st.hp; P.res = P.st.resMax;
  L.pet = lPet(); L.petBag = L.pet ? lBagSize(L.pet) : 0;
  if (lPerk('key')) M.keys++;
  M.runs++; M.cur = { hero: P.id, id: L.id, ti, t0: Date.now(), gear0: JSON.parse(JSON.stringify(P.gear)) };
  L.on = true; lSetStage(L.TT.st);
  lReveal(true);
  if (lPerk('npc')) for (const r in L.npcs) L.npcs[r].known = true;
  if (L.npcs.mis) L.npcs.mis.known = true;
  hook('room', 'lande');
  cam.x = clamp(P.x - VW / 2, 0, AW - VW); cam.y = clamp(P.y - VH / 2, 0, AH - VH);
  setMusic(L.TT.mus, false); $('bossbar').hidden = true; $('objective').textContent = '';
  document.body.classList.add('lande'); setState('play'); showHud(true); hideOverlay(); lHudShow(true);
  lBanner(L.TT.n.toLocaleUpperCase(LOCALE), _t('Sammle Beute und entkomm durch einen Ausgang – der goldene Pfeil zeigt den Weg.'));
  saveChar(); persist();
}

/* ---------- Ende: entkommen, gefallen, abgebrochen ---------- */
function lEnd() {
  if (!LW) return; LW.on = false; LBQ.length = 0;
  document.body.classList.remove('lande'); lHudShow(false); $('bAct').hidden = true; $('bossbar').hidden = true; $('objective').textContent = '';
  for (const e of enemies) e.dead = true; enemies = []; pickups = [];
}
function lStripFlags() { for (const s of ['weapon', 'armor', 'helm']) if (P.gear[s]) delete P.gear[s].lw; }
function lBasicGear() { const C = CLASSES[P.cls]; return { weapon: makeItem({ slot: 'weapon', base: C.start, tier: 0, rar: 0, std: true }), armor: makeItem({ slot: 'armor', base: 'armor', tier: 0, rar: 0 }), helm: makeItem({ slot: 'helm', base: 'helm', tier: 0, rar: 0 }) }; }
// Neu laden/abbrechen: Ausrüstung vom Aufbruch zurück, aber nichts doppelt (was in einer Begleiter-Tasche liegt, bleibt dort)
function lRestoreGear(cur) {
  const inBag = new Set(), PM = SAVE.meta.pets; if (PM && Array.isArray(PM.list)) for (const p of PM.list) for (const e of (Array.isArray(p.bag) ? p.bag : [])) if (e && e.t === 'item' && e.it) inBag.add(e.it.uid);
  const basic = lBasicGear(), g0 = cur.gear0 || {};
  for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; if (!it || it.lw) { const o = g0[s]; P.gear[s] = o && !inBag.has(o.uid) ? o : basic[s]; } }
  lStripFlags(); computeStats(); P.hp = Math.min(P.hp, P.st.hp);
}
function lAbandon(why) {
  const M = lMeta(), cur = M.cur, lost = LW ? LW.pack.slice() : [], pet = LW && LW.pet;
  M.aband++; if (cur) lRestoreGear(cur);
  const r = lDeliver(lPetBagTake(pet)); M.cur = null;
  lEnd(); LW = null; saveChar(); persist();
  return { lost, r };
}
// Beim Laden eines Helden: Ausflug war noch offen (Neu laden, Absturz) → wie Abbruch
HOOK.activate.push(H => {
  try {
    if (!SAVE || !SAVE.meta.lande) return; const M = lMeta();
    if (M.cur && M.cur.hero === H.id && !(LW && LW.on)) { M.aband++; lRestoreGear(M.cur); M.cur = null; LG.note = _t('Dein letzter Ausflug in die Verlorenen Lande wurde unterbrochen: Der Rucksack ist verloren, deine Ausrüstung vom Aufbruch hast du noch.'); }
    const p = lPet(); if (p && Array.isArray(p.bag) && p.bag.length && !(LW && LW.on)) { const r = lDeliver(lPetBagTake(p)); if (r.n) LG.note = (LG.note ? LG.note + ' ' : '') + _t('Dein Begleiter hat noch Beute aus den Landen dabei – sie liegt jetzt bei dir.'); }
    if (LG.note) { saveChar(); persist(); setTimeout(() => { if (LG.note) { toast(LG.note, '#e8b04a'); LG.note = null; } }, 900); }
  } catch (e) { console.error('Lande (activate):', e); }
});
function lExtract() {
  const L = LW, M = lMeta(), pack = L.pack.splice(0), bag = lPetBagTake(L.pet), mis = [];
  let rep = 0;
  for (const m of L.mis) if (m.done && !m.paid) { m.paid = true; rep += m.rep; mis.push(m); for (const e of m.rew) if (e.t !== 'key' && e.t !== 'map') pack.push(e); else if (e.t === 'key') M.keys++; }
  const all = pack.concat(bag), val = lSum(all), r = lDeliver(all);
  M.rep += rep; M.ext++; M.tx[L.ti] = (M.tx[L.ti] || 0) + 1; const best = val > M.best; if (best) M.best = val;
  const newTier = L.ti + 1 < LANDE_TIER.length && (M.tx[L.ti] === LANDE_TIER[L.ti + 1].need);
  lStripFlags(); M.cur = null; stat('landeExt');
  const time = L.t, kills = L.kills;
  lEnd(); computeStats(); P.hp = P.st.hp; saveChar(); persist(); if (typeof checkAch === 'function') checkAch();
  sfx('clear'); setTimeout(() => sfx('loot'), 400);
  setState('menu'); showHud(false);
  const ml = mis.length ? `<h3>${_t('AUFTRÄGE ERFÜLLT')}</h3>${mis.map(m => `<p class="sub" style="margin:2px 0">✦ ${esc(m.txt)} <b style="color:#57c7e6">${_t('+{n} Ruf', { n: m.rep })}</b></p>`).join('')}` : '';
  showOverlay(`<div class="head"><h2 style="color:var(--moss)">${_t('ENTKOMMEN!')}</h2><div class="hbtns"><span class="pill">${esc(L.TT.n)}</span></div></div>
  <p class="sub">${_t('{t} in den Landen · {k} Gegner besiegt', { t: lClock(time), k: kills })}${L.ti + 1 < LANDE_TIER.length && newTier ? ' · <b style="color:var(--gold)">' + _t('Neue Weltstufe frei: {n}!', { n: esc(LANDE_TIER[L.ti + 1].n) }) + '</b>' : ''}</p>
  <div class="kv"><span class="pill" style="background:var(--gold)">${_t('BEUTEWERT {n} GOLD', { n: fmt(val) })}</span>${best && val > 0 ? `<span class="pill" style="background:#ff8a3a">${_t('NEUER BESTWERT')}</span>` : ''}${rep ? `<span class="pill" style="background:#57c7e6">${_t('+{n} RUF', { n: rep })}</span>` : ''}</div>
  ${all.length ? `<h3>${_t('IN SICHERHEIT ({n})', { n: all.length })}</h3><div class="lgot">${all.map((e, i) => `<div style="animation-delay:${Math.min(i, 20) * 80}ms">${landeLootHTML(e)}</div>`).join('')}</div>` : `<p class="sub">${_t('Diesmal mit leeren Händen – aber lebendig.')}</p>`}
  ${lDeliverHTML(r)}${ml}
  <div class="menu foot row"><button class="btn wide" data-act="l_home">${_t('Ins Versteck')}</button><button class="btn alt" data-act="l_tomap">${_t('Zur Karte')}</button><button class="btn alt" data-act="l_again">${_t('Weltentor')}</button></div>`, true);
}
function lDie() {
  P.hp = 0; setState('dead'); deadT = 999; P.atkT = 0; P.spin = 0; P.leap = null; P.dash = null;
  burst(P.x, P.y, 8, '#b8302a', 30, 100); sfx('die'); $('bossbar').hidden = true; slowmo = 1.6; shake(6);
  P.stats.deaths++; stat('deaths'); LW.dead = 2.2; $('objective').textContent = '';
}
HOOK.die.push(h => { if (h || !LW || !LW.on) return h; lDie(); return true; });
function lDeathScreen() {
  const L = LW, M = lMeta(), pet = L.pet, gear = ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean), pack = L.pack.splice(0), saved = lPetBagTake(pet);
  const lost = gear.map(it => ({ t: 'item', it })).concat(pack), lostV = lSum(lost);
  M.deaths++; M.cur = null;
  let hurt = '';
  if (pet && typeof petHurt === 'function') { const min = 45 + L.ti * 15; try { petHurt(pet, min); hurt = _t('{name} ist verletzt und braucht etwa {n} Minuten Ruhe.', { name: esc(lPetName(pet)), n: min }); } catch (_) { } }
  lEnd(); LW = null;
  let r = null, body, foot;
  if (P.hc) {
    // Hardcore: der Held ist für immer fort – was der Begleiter trägt, landet im Lager
    for (const e of saved) if (e.t === 'item' && SAVE.meta.hide.stash.length < (typeof stashCap === 'function' ? stashCap() : 0)) { delete e.it.lw; SAVE.meta.hide.stash.push(e.it); } else if (e.t !== 'item' && M.box.length < LBOX) M.box.push(e);
    SAVE.meta.fallen.unshift({ name: P.name, cls: P.cls, lv: P.lv, act: P.act, diff: P.diff, date: Date.now(), kills: P.stats.kills });
    SAVE.chars.splice(SAVE.active, 1); SAVE.active = -1; persist();
    body = `<p class="sub">${_t('Hardcore kennt keine Gnade. {name} ist in den Verlorenen Landen gefallen und steht nun in der Ruhmeshalle.', { name: esc(P.name) })}</p>${saved.length ? `<p class="sub" style="color:var(--moss)">${_t('Dein Begleiter hat {n} Dinge ins Lager gerettet.', { n: saved.length })}</p>` : ''}`;
    foot = `<div class="menu foot"><button class="btn" data-act="hcok">${_t('Zum Titel')}</button></div>`;
  } else {
    P.gear = lBasicGear(); r = lDeliver(saved); computeStats(); P.hp = P.st.hp; P.res = P.st.resMax; updWeaponUI(); saveChar(); persist();
    body = `${saved.length ? `<h3 style="color:var(--moss)">${_t('GERETTET VON {name}', { name: esc(lPetName(pet)).toLocaleUpperCase(LOCALE) })}</h3>${saved.map(e => landeLootHTML(e)).join('')}${lDeliverHTML(r)}` : `<p class="sub">${pet ? _t('Die Begleiter-Tasche war leer – nichts wurde gerettet.') : _t('Ohne Begleiter wurde nichts gerettet. Ein Begleiter trägt eine Tasche, die deinen Tod übersteht.')}</p>`}
    ${hurt ? `<p class="sub" style="color:#ff8a5a">${hurt}</p>` : ''}<p class="sub">${_t('Du erwachst im Versteck – mit einfacher Ausrüstung. Schmiede neue oder hol sie dir aus Beutel und Lager.')}</p>`;
    foot = `<div class="menu foot"><button class="btn" data-act="l_wake">${_t('Im Versteck erwachen')}</button></div>`;
  }
  setState('over'); showHud(false);
  showOverlay(`<div class="over"><h2 class="center">${_t('GEFALLEN IN DEN VERLORENEN LANDEN')}</h2>
  <h3 style="color:var(--blood)">${_t('VERLOREN · {n} GOLD WERT', { n: fmt(lostV) })}</h3><div class="grid llost">${lost.map(e => lSlot(e, '', false, true)).join('') || `<p class="sub">${_t('Nichts.')}</p>`}</div>${body}</div>${foot}`, true);
}

/* ---------- Gegner der Freiwelt ---------- */
function lSpawn(type, x, y, o) {
  o = o || {}; lSetStage(o.st || lStage(x, y));
  const e = spawnEnemy(type, Object.assign({ x: clamp(x, BD.x0 + 10, BD.x1 - 10), y: clamp(y, BD.y0 + 10, BD.y1 - 10), instant: o.instant !== false }, o));
  // Weltstufen sind fest: die Qual-Verstärkung der Kampagne gilt hier nicht
  const q = Math.pow(1.3, qualOf(P.act)); if (q > 1) { e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp / q)); e.atk /= Math.pow(q, .8); if (e.armorMax) { e.armorMax /= q; e.armor = e.armorMax; } }
  e.lw = { src: o.src || null, rec: o.rec || null }; e.lpx = e.x; e.lpy = e.y;
  lSetStage(lStage(P.x, P.y));
  return e;
}
function lSpawnGroup(src, list, x, y, rad) {
  list.forEach((r, i) => { const a = i / list.length * 6.283 + Math.random() * .5, d = rad * (.5 + Math.random() * .5); lSpawn(r.t, x + Math.cos(a) * d, y + Math.sin(a) * d * .7, { elite: r.el, src, rec: r }); });
  src.alive = (src.alive || 0) + list.length;
}
function lDespawn(e) {
  e.dead = true; const s = e.lw && e.lw.src;
  if (s) { s.alive = Math.max(0, (s.alive || 0) - 1); const back = s.left || s.list; if (e.lw.rec && back) back.push(e.lw.rec); if (s.B) { s.hp = clamp(e.hp / e.maxHp, .05, 1); s.state = 'roam'; s.x = e.x; s.y = e.y; $('bossbar').hidden = true; setMusic(LW.TT.mus, false); } if (s.rival) { s.hp = clamp(e.hp / e.maxHp, .05, 1); s.state = 'roam'; s.x = e.x; s.y = e.y; } if (s.left && s.state === 'act' && !s.alive) s.state = 'dorm'; if (s.list && s.state === 'act' && !s.alive) { s.state = 'dorm'; s.x = e.x; s.y = e.y; } }
  fxAnim('ring', e.x, e.y - 6, { sc: .5, dur: .4, add: true });
}

/* ---------- Beute fallen lassen ---------- */
function lCoins(x, y, n) { const k = Math.min(10, Math.max(1, Math.ceil(n / 6))); let g = n; for (let i = 0; i < k; i++) { const v = i === k - 1 ? g : Math.floor(n / k); g -= v; if (v > 0) pickups.push({ k: 'coin', x, y, z: 6, vz: rnd(70, 140), vx: rnd(-55, 55), vy: rnd(-32, 32), v, t: 0 }); } }
function lDrop(x, y, e, sp) {
  const v = sp || 1, b = () => ({ x, y, z: 8, vz: rnd(90, 150) * v, vx: rnd(-55, 55) * v, vy: rnd(-32, 32) * v, t: 0 });
  switch (e.t) {
    case 'item': pickups.push(Object.assign(b(), { k: 'loot', it: e.it })); break;
    case 'mat': pickups.push(Object.assign(b(), { k: 'mat', m: e.k, n: e.n })); break;
    case 'gem': for (let i = 0; i < (e.n || 1); i++) pickups.push(Object.assign(b(), { k: 'gem', g: e.k })); break;
    case 'part': pickups.push(Object.assign(b(), { k: 'lpart', pk: e.k, n: e.n || 1 })); break;
    case 'egg': pickups.push(Object.assign(b(), { k: 'legg', d: e.d })); break;
    case 'gold': lCoins(x, y, e.n); break;
    case 'key': pickups.push(Object.assign(b(), { k: 'lkey' })); break;
    case 'map': pickups.push(Object.assign(b(), { k: 'lmap' })); break;
  }
}
function lRollSpot(o) {
  const C = LCH[o.t], st = o.st || lStage(o.x, o.y), out = [], lm = C.luck * (1 + (o.z || 0) * .5);
  for (let i = 0, n = ri(C.it[0], C.it[1]); i < n; i++) out.push({ t: 'item', it: lItem(C.min, lm, st) });
  out.push({ t: 'gold', n: Math.round(rnd(C.gold[0], C.gold[1]) * (1 + st * .45)) });
  if (Math.random() < C.mats) out.push({ t: 'mat', k: lMatPick(st), n: ri(2, 4) });
  if (Math.random() < C.gem * gemMul()) out.push({ t: 'gem', k: randomGem(st + 4), n: 1 });
  if (Math.random() < C.part) { const k = lPart(st, .1 * lm); if (k) out.push({ t: 'part', k, n: 1 }); }
  if (Math.random() < C.egg * (1 + LW.ti * .2)) { const d = lEgg(1 + LW.ti * .5 + (o.z || 0)); if (d) out.push({ t: 'egg', d }); }
  if (C.key && Math.random() < C.key) out.push({ t: 'key' });
  if (C.map && Math.random() < C.map) out.push({ t: 'map' });
  return out;
}
function lBurst(o, list) { list.forEach((e, i) => setTimeout(() => { if (LW && LW.on) lDrop(o.x, o.y - 4, e, 1 + i * .06); }, 120 + i * 90)); }

/* ---------- Fundstellen öffnen ---------- */
// Banner nacheinander zeigen (zwei Meldungen im selben Moment überdecken sich sonst)
const LBQ = []; let LBT = -9;
function lBanner(t, s) { if (T - LBT < 2.1 && T >= LBT) { if (LBQ.length < 4) LBQ.push([t, s]); return; } LBT = T; banner(t, s); }
// Tipps für Neulinge: jeder nur einmal pro Konto
function lTip(bit, s) { const M = lMeta(); if (M.tips & bit) return; M.tips |= bit; persist(); setTimeout(() => { if (LW && LW.on) toast(s, '#9ad8ee'); }, 600); }
function lMsg(k, s, col, gap) { if (T - (LW.msgT[k] || -99) < (gap || 3)) return; LW.msgT[k] = T; toast(s, col); }
function lOpenSpot(o) {
  if (o.open) return;
  const C = LCH[o.t];
  if (o.t === 'kraut') {
    o.open = 1; sfx('heal'); const h = Math.round(P.st.hp * .2); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 24, '+' + h, '#79c24e', true);
    if (P.potions < potMax() && Math.random() < .6) { P.potions++; toast(_t('Kräuter gesammelt: +1 Heiltrank'), '#79c24e'); } else toast(_t('Kräuter gesammelt: +{n} LP', { n: h }), '#79c24e');
    if (Math.random() < .35) lDrop(o.x, o.y, { t: 'mat', k: Math.random() < .5 ? 'schleim' : 'kristall', n: 1 });
    for (let i = 0; i < 14; i++) part(o.x + rnd(-6, 6), o.y, rnd(0, 8), rnd(-20, 20), rnd(-10, 10), rnd(20, 50), pick(['#79c24e', '#c8f06a', '#f786a0']), rnd(.4, .8), 1, -20, 1);
    return;
  }
  if (C.lock) { const M = lMeta(); if (M.keys <= 0) { lMsg('lock', _t('Verschlossen – du brauchst einen Schlüssel. Elite-Gegner, Lager und Gefallene tragen welche.'), '#ff8a5a', 4); return; } M.keys--; toast(_t('Schlüssel benutzt (noch {n})', { n: M.keys }), '#e8b04a'); }
  o.open = .001; LW.chests++; lMisEvent('chest');
  const list = o.loot || lRollSpot(o);
  if (o.t === 'gold' || o.t === 'schloss') { flash = { a: .25, c: '255,220,120' }; rings.push({ x: o.x, y: o.y, r: 4, max: 46, life: .5, max2: .5, col: '#ffd24a' }); }
  sfx('chest'); burst(o.x, o.y, 10, o.t === 'fluch' ? '#b060ff' : '#ffd24a', 18, 70, 1);
  if (C.trap) {
    if (Math.random() < .55) { lBanner(_t('DER FLUCH ERWACHT'), _t('Wächter steigen aus der Truhe!')); const st = lStage(o.x, o.y), pool = lPool(lBioAt(o.x, o.y), st); for (let i = 0; i < 2 + Math.min(3, LW.ti + 1); i++) { const a = i * 2.1; lSpawn(pick(pool), o.x + Math.cos(a) * 34, o.y + Math.sin(a) * 22, { elite: i === 0, instant: false }); } sfx('spec'); shake(5); }
    else { toast(_t('Eine Falle! Weg von der Truhe!'), '#ff6a5a'); fx.push({ k: 'warn', x: o.x, y: o.y, r: 38, life: .9, max: .9 }); setTimeout(() => { if (LW && LW.on && state === 'play') explode(o.x, o.y, 38, 10 + lStage(o.x, o.y) * 4, 'e'); }, 900); }
  }
  lBurst(o, list);
  if (o.t === 'rest' && o.relic) { pickups.push({ k: 'lrel', x: o.x, y: o.y, z: 8, vz: 140, vx: 0, vy: 10, t: 0 }); }
}

/* ---------- Einsammeln (über HOOK.collect in js/combat.js) ---------- */
if (!HOOK.collect) HOOK.collect = [];   // collect(handled, pickup) → true, wenn ein System die Beute selbst nimmt
HOOK.collect.push((h, c) => {
  if (h || !LW || !LW.on) return h;
  let e = null;
  switch (c.k) {
    case 'coin': e = { t: 'gold', n: c.v }; break;
    case 'mat': e = { t: 'mat', k: c.m, n: c.n }; break;
    case 'gem': e = { t: 'gem', k: c.g, n: 1 }; break;
    case 'loot': e = { t: 'item', it: c.it }; break;
    case 'lpart': e = { t: 'part', k: c.pk, n: c.n || 1 }; break;
    case 'legg': e = { t: 'egg', d: c.d }; break;
    case 'lkey': { const M = lMeta(); M.keys++; c.got = true; sfx('loot'); toast(_t('Schlüssel gefunden! ({n})', { n: M.keys }), '#e8b04a'); persist(); return true; }
    case 'lmap': c.got = true; lMapPiece(); return true;
    case 'lrel': c.got = true; LW.relic = true; sfx('ach'); lBanner(_t('ERBSTÜCK GEFUNDEN'), _t('Bring es heil zurück – zu Elwa oder durch einen Ausgang.')); lMisEvent('relic'); return true;
    default: return false;   // Herzen und Tränke wie immer
  }
  if (!lPackAdd(e)) { lMsg('full', _t('Rucksack voll! Wirf etwas weg oder leg es in die Begleiter-Tasche.'), '#ff6a5a', 2.5); c.t = -.6; return true; }
  c.got = true; lGot(e); return true;
});
function lGot(e) {
  const hp = $('lhPack'); if (hp) { hp.classList.remove('pop'); void hp.offsetWidth; hp.classList.add('pop'); }
  if (e.t === 'gold') { sfx('coin'); return; }
  lTip(1, _t('Tipp: Alles im Rucksack ist verloren, wenn du fällst. Wertvolles in die Begleiter-Tasche legen – Rucksack-Knopf oben rechts.'));
  if (e.t === 'item') {
    const it = e.it; it.lw = LW.id; hook('pickup', it);
    if (it.rar === 4) stat('legs'); if (it.rar === 6) statMax('myths', 1);
    sfx(it.rar === 6 ? 'myth' : it.rar >= 3 ? 'loot' : 'coin');
    if (it.rar >= 4) { lBanner(it.rar === 6 ? _t('MYTHISCH!') : it.rar === 5 ? _t('SET-TEIL!') : _t('LEGENDÄR!'), itemName(it)); flash = { a: .3, c: it.rar === 6 ? '255,80,220' : '255,160,60' }; rings.push({ x: P.x, y: P.y, r: 4, max: 60, life: .6, max2: .6, col: RAR[it.rar].c }); }
    toast(_t('{rar}: {item} → Rucksack', { rar: RAR[it.rar].n.toLocaleUpperCase(LOCALE), item: itemName(it) }), RAR[it.rar].c);
    for (let i = 0; i < 18; i++) part(P.x, P.y, rnd(0, 16), rnd(-30, 30), rnd(-15, 15), rnd(30, 80), RAR[it.rar].c, rnd(.4, .8), 1, 80, 1);
    return;
  }
  if (e.t === 'mat') { txt(P.x, P.y - 22, '+' + e.n + ' ' + MATS[e.k].n, MATS[e.k].c); sfx('coin'); return; }
  if (e.t === 'egg') { lBanner(_t('BEGLEITER-EI!'), lName(e)); sfx('myth'); return; }
  txt(P.x, P.y - 22, '+ ' + lName(e), lCol(e)); sfx('loot');
}
function lMapPiece() {
  // Kartenstück: deckt einen großen Kreis um eine noch unbekannte Fundstelle auf
  const L = LW, cand = L.spots.filter(o => !o.open && !lKnown(o)); const o = cand.length ? pick(cand) : null;
  if (o) lRevealAt(o.x, o.y, 9); else lRevealAt(L.S / 2, L.S / 2, 14);
  sfx('page'); toast(_t('Kartenstück! Ein Teil der Karte ist aufgedeckt.'), '#e8dcc0');
}

/* ---------- Nebel und Karte ---------- */
function lKnown(o) { const L = LW, fx_ = clamp(Math.floor(o.x / LFC), 0, L.FN - 1), fy = clamp(Math.floor(o.y / LFC), 0, L.FN - 1); return L.fog[fy * L.FN + fx_] === 1; }
function lRevealAt(x, y, rad) {
  const L = LW, g = L.fogc.getContext('2d'), cx = Math.floor(x / LFC), cy = Math.floor(y / LFC);
  for (let yy = cy - rad; yy <= cy + rad; yy++) for (let xx = cx - rad; xx <= cx + rad; xx++) { if (xx < 0 || yy < 0 || xx >= L.FN || yy >= L.FN) continue; const d = (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy); if (d > rad * rad + 1) continue; const i = yy * L.FN + xx; if (!L.fog[i]) { L.fog[i] = 1; g.clearRect(xx, yy, 1, 1); } }
}
function lReveal() { lRevealAt(P.x, P.y, 5); }

/* ---------- Missionen der Kundschafterin ---------- */
function lMisGen() {
  const L = LW, st = L.TT.st, f = 1 + L.ti * .5, out = [], used = new Set();
  const types = ['kills', 'chests', 'camp', 'named', 'boss', 'rival', 'relic', 'mats'].filter(t => (t !== 'rival' || L.rivals.length) && (t !== 'named' || L.namedSpot) && (t !== 'relic' || L.relicSpot) && (t !== 'camp' || L.camps.length));
  const want = 3 + lPerk('mis');
  while (out.length < want && used.size < types.length) {
    const t = pick(types); if (used.has(t)) continue; used.add(t);
    const m = { t, c: 0, n: 1, done: false, paid: false, rep: 0, rew: [], tgt: null };
    switch (t) {
      case 'kills': m.n = 20 + L.ti * 5 + ri(0, 10); m.txt = _t('Besiege {n} Gegner', { n: m.n }); m.rep = 25; break;
      case 'chests': m.n = ri(4, 6); m.txt = _t('Öffne {n} Truhen oder Fundstellen', { n: m.n }); m.rep = 25; break;
      case 'camp': { const c = L.camps.filter(c => c.state !== 'done').sort((a, b) => b.z - a.z)[ri(0, Math.min(2, L.camps.length - 1))] || L.camps[0]; m.tgt = c; c.mis = m; m.txt = _t('Säubere das markierte Lager'); m.rep = 35; break; }
      case 'named': { const p = L.namedSpot, nm = pick(LNAMED), st2 = st + 4; const c = L.add({ k: 'camp', x: p.x, y: p.y, r: 5, solid: true, z: p.z, st: st2, bk: lBioAt(p.x, p.y), left: [{ t: pick(lPool(lBioAt(p.x, p.y), st2).filter(k => EN[k].cost >= 2).concat(['orc'])), el: true, champ: nm }].concat(lWave(lBioAt(p.x, p.y), st2, 4, 4).map(k => ({ t: k, el: false }))), alive: 0, state: 'dorm', fire: true, named: nm }); L.camps.push(c); m.tgt = c; c.mis = m; m.txt = _t('Erlege {name}', { name: nm }); m.rep = 50; break; }
      case 'boss': m.tgt = L.bosses[0]; m.txt = _t('Bezwinge das Ungeheuer {name}', { name: L.bosses[0].B.name }); m.rep = 80; break;
      case 'rival': { const r = L.rivals[0]; m.tgt = r; m.txt = _t('Stelle den Rivalen {name}', { name: r.name }); m.rep = 50; break; }
      case 'relic': { const p = L.relicSpot; const o = L.add({ k: 'spot', t: 'rest', x: p.x, y: p.y, r: 0, solid: false, z: p.z, st: st + 4, open: 0, relic: true }); L.spots.push(o); m.tgt = o; m.txt = _t('Finde das Erbstück im markierten Grab'); m.rep = 45; break; }
      case 'mats': { const k = lMatPick(st), n = ri(3, 6); m.k = k; m.n = n; m.txt = _t('Bring {n} {mat}', { n, mat: MATS[k].n }); m.rep = 30; break; }
    }
    m.rep = Math.round(m.rep * f);
    m.rew.push({ t: 'item', it: lItem(t === 'boss' || t === 'named' ? 3 : 2, 1.6, st + 3) });
    m.rew.push({ t: 'gold', n: Math.round((40 + st * 12) * f) });
    if (t === 'boss' || t === 'rival') { const d = lEgg(2 + L.ti); if (d) m.rew.push({ t: 'egg', d }); }
    if (Math.random() < .4) m.rew.push({ t: 'gem', k: randomGem(st + 8), n: 1 });
    if (t === 'named' || t === 'relic') m.rew.push({ t: 'key' });
    out.push(m);
  }
  return out;
}
function lMisEvent(k, obj) {
  if (!LW || !LW.misOn) return;
  for (const m of LW.mis) {
    if (m.done) continue;
    if (k === 'kill' && m.t === 'kills') m.c++;
    if (k === 'chest' && m.t === 'chests') m.c++;
    if (k === 'camp' && m.t === 'camp' && m.tgt === obj) m.c = 1;
    if (k === 'camp' && m.t === 'named' && m.tgt === obj) m.c = 1;
    if (k === 'boss' && m.t === 'boss' && m.tgt === obj) m.c = 1;
    if (k === 'rival' && m.t === 'rival' && m.tgt === obj) m.c = 1;
    if (k === 'relic' && m.t === 'relic') m.c = 1;
    if (m.t !== 'mats' && m.c >= m.n) { m.done = true; sfx('ach'); lBanner(_t('AUFTRAG ERFÜLLT'), m.txt); toast(_t('Belohnung bei Elwa abholen – oder sie kommt beim Ausgang mit.'), '#57c7e6'); }
  }
}
function lMisCheckMats() { for (const m of LW.mis) if (m.t === 'mats' && !m.paid) { m.c = Math.min(m.n, lPackHas('mat', m.k)); m.done = m.c >= m.n; } }

/* ---------- Laufzeit ---------- */
function lPush(e, r, skip) {
  const L = LW, x0 = Math.floor((e.x - 48) / LGC), x1 = Math.floor((e.x + 48) / LGC), y0 = Math.floor((e.y - 48) / LGC), y1 = Math.floor((e.y + 48) / LGC);
  for (let gy = Math.max(0, y0); gy <= Math.min(L.GN - 1, y1); gy++) for (let gx = Math.max(0, x0); gx <= Math.min(L.GN - 1, x1); gx++) for (const o of L.grid[gy * L.GN + gx]) {
    if (!o.solid || o === skip) continue; const dx = e.x - o.x, dy = (e.y - o.y) * 1.35, m = o.r + r; if (Math.abs(dx) > m || Math.abs(dy) > m) continue;
    const d = Math.hypot(dx, dy) || .01; if (d < m) { e.x = o.x + dx / d * m; e.y = o.y + dy / d * m / 1.35; }
  }
}
function lGridEach(x, y, rad, fn) {
  const L = LW, x0 = Math.max(0, Math.floor((x - rad) / LGC)), x1 = Math.min(L.GN - 1, Math.floor((x + rad) / LGC)), y0 = Math.max(0, Math.floor((y - rad) / LGC)), y1 = Math.min(L.GN - 1, Math.floor((y + rad) / LGC));
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const o of L.grid[gy * L.GN + gx]) fn(o);
}
function lExitOpen(ex) { if (ex.t === 'mond') return ((LW.t + ex.ph) % 80) < 40; if (ex.t === 'schluessel') return !!ex.open; return true; }
function lNearExit() { let b = null, bd = 1e9, bo = null, bod = 1e9; for (const ex of LW.exits) { if (ex.gone) continue; const d = Math.hypot(ex.x - P.x, ex.y - P.y); if (d < bd) { bd = d; b = ex; } if ((lExitOpen(ex) || (ex.t === 'schluessel' && lMeta().keys > 0)) && d < bod) { bod = d; bo = ex; } } return bo || b; }
function lChannel() { return Math.max(1.5, LW.TT.ch - lPerk('ch')); }
// Jede Bildzeit: Kollision mit Bäumen und Felsen, Geschosse daran zerschellen lassen
HOOK.update.push(dt => {
  if (!LW || !LW.on || !G || G.type !== 'lande') return;
  if (P.z < 4 && !P.leap) lPush(P, P.r);
  for (const e of enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - e.lpx, e.y - e.lpy) > 160) { const a = Math.random() * 6.283; e.x = clamp(P.x + Math.cos(a) * 110, BD.x0 + 10, BD.x1 - 10); e.y = clamp(P.y + Math.sin(a) * 80, BD.y0 + 10, BD.y1 - 10); }   // Teleport über die halbe Karte (placeFar) zurückholen
    if (!(e.ai === 'swoop' && e.z > 8) && e.ai !== 'ghost' && !(e.under > 0)) lPush(e, e.r * e.sc);
    e.lpx = e.x; e.lpy = e.y;
    if (e.rival && e.rival.look && e.st !== 'spawn') e.alpha = 0;
  }
  for (const p of projs) { if (p.life <= 0 || p.k === 'meteor' || p.k === 'bomb' || p.k === 'flask') continue; lGridEach(p.x, p.y, 20, o => { if (o.solid && o.k === 'prop' && p.life > 0 && Math.hypot(o.x - p.x, (o.y - p.y) * 1.35) < o.r + 2) { p.life = 0; if (p.k === 'fireball') projHitEnd(p); burst(p.x, p.y, p.h, '#8a7a6a', 4, 30); } }); }
  if (state === 'dead' && LW.dead) { LW.dead -= dt; if (LW.dead <= 0) { LW.dead = 0; lDeathScreen(); } }
});
// Der Raum der Freiwelt: Zeit, Gefahr, Lager, Bosse, Rivalen, Ausgänge
HOOK.roomUpd.push((h, dt) => {
  if (h || !LW || !LW.on || !G || G.type !== 'lande') return h;
  lTick(dt); return true;
});
function lTick(dt) {
  const L = LW, M = lMeta(); L.t += dt; L.tick -= dt;
  if (LBQ.length && T - LBT >= 2.1) { const [t, s] = LBQ.shift(); LBT = T; banner(t, s); }
  // Gefahr
  let dg = 0; for (let i = 0; i < LDNG.length; i++) if (L.t >= LDNG[i].t) dg = i;
  if (dg !== L.danger) { L.danger = dg; const D = LDNG[dg]; if (D.b) { lBanner(D.b, D.s); sfx('spec'); shake(3); } }
  L.cr = clamp((L.t - 150) / 750, 0, 1) * L.S * 1.15;
  bg.b.dark = clamp(L.TT.dark + L.t / 900 * .42, 0, .72) + (lInRift(P.x, P.y) ? .08 : 0);
  const inRift = lInRift(P.x, P.y);
  if (inRift && P.hp > P.st.hp * .1) P.hp = Math.max(P.st.hp * .1, P.hp - P.st.hp * .006 * dt);
  if (L.tick > 0) { lChannelTick(dt); return; }
  L.tick = .2;
  lReveal();
  lSetStage(lStage(P.x, P.y));
  const bk = lBioAt(P.x, P.y); bg.b.key = LBIO[bk].amb; if (L.bk !== bk) { L.bk = bk; }
  // Lager wecken
  for (const c of L.camps) {
    const d = Math.hypot(c.x - P.x, c.y - P.y);
    if (c.state === 'dorm' && d < 300 && c.left.length && enemies.length < 26) { c.state = 'act'; const list = c.left.splice(0); list.forEach((r, i) => { const a = i / list.length * 6.283 + Math.random() * .4, dd = 26 + Math.random() * 30; lSpawn(r.t, c.x + Math.cos(a) * dd, c.y + Math.sin(a) * dd * .7, r.champ ? { elite: true, champ: true, name: r.champ, tint: 'rgba(255,110,40,.35)', src: c, rec: r, st: c.st } : { elite: r.el, src: c, rec: r, st: c.st }); }); c.alive += list.length; if (c.named) { lBanner(c.named.toLocaleUpperCase(LOCALE), _t('Der Gesuchte ist hier!')); sfx('spec'); } }
  }
  // Streifen
  for (const p of L.pats) {
    if (p.state === 'dorm') {
      if (!p.list.length) continue;
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 8) { p.tx = clamp(p.x + rnd(-400, 400), 60, L.S - 60); p.ty = clamp(p.y + rnd(-400, 400), 60, L.S - 60); } else { p.x += dx / d * 18 * .2; p.y += dy / d * 18 * .2; }
      if (Math.hypot(p.x - P.x, p.y - P.y) < 260 && enemies.length < 24) { p.state = 'act'; const list = p.list.splice(0); lSpawnGroup(p, list, p.x, p.y, 20); }
    }
  }
  // Ungeheuer
  for (const B of L.bosses) lBossTick(B);
  // Rivalen
  for (const r of L.rivals) lRivalTick(r);
  // Leine: wer zu weit weg ist, geht zurück ins Lager
  for (const e of enemies) { if (e.dead || !e.lw) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d > (e.boss ? 560 : 460)) lDespawn(e); }
  enemies = enemies.filter(e => !e.dead);
  // Jäger der Leere: Druck mit steigender Gefahr
  if (L.danger >= 1 || inRift) {
    L.huntT -= .2 * (inRift ? 2 : 1);
    if (L.huntT <= 0 && enemies.length < 18) {
      L.huntT = Math.max(12, 42 - L.danger * 8); const st = lStage(P.x, P.y), pool = lPool(lBioAt(P.x, P.y), st), a = Math.random() * 6.283, cx = P.x + Math.cos(a) * 190, cy = P.y + Math.sin(a) * 150;
      for (let i = 0; i < 1 + L.danger; i++) lSpawn(pick(pool), cx + rnd(-24, 24), cy + rnd(-16, 16), { elite: Math.random() < .08 * L.danger, instant: false });
      if (L.danger >= 2) lMsg('hunt', _t('Jäger der Leere sind dir auf den Fersen!'), '#c060ff', 20);
    }
  }
  // Fundstellen und Nähe
  L.near = null; let nd = 34;
  lGridEach(P.x, P.y, 60, o => {
    const d = Math.hypot(o.x - P.x, (o.y - P.y) * 1.3);
    if (o.k === 'spot' && !o.open) {
      if (o.t === 'versteck') return;
      if (d < 20 + (o.r || 0)) lOpenSpot(o);
    }
    if (o.k === 'npc' && d < nd) { nd = d; L.near = o; }
  });
  // Vergrabener Schatz: stehen bleiben zum Graben
  const cache = L.spots.find(o => o.t === 'versteck' && !o.open && Math.hypot(o.x - P.x, o.y - P.y) < 14);
  if (cache && !P.moving) { L.digO = cache; L.dig += .2; if (Math.random() < .5) { dust(cache.x, cache.y, 3); sfx('dig'); } if (L.dig >= 1.4) { L.dig = 0; L.digO = null; lOpenSpot(cache); } } else { L.dig = 0; L.digO = cache || null; }
  // Abholen: Beute weit weg schlafen legen, nahe wecken (spart Rechenzeit)
  if ((L.revT -= .2) <= 0) { L.revT = .6; const keep = []; for (const c of pickups) if (Math.hypot(c.x - P.x, c.y - P.y) > 700) L.sleep.push(c); else keep.push(c); pickups = keep; L.sleep = L.sleep.filter(c => { if (Math.hypot(c.x - P.x, c.y - P.y) < 600) { pickups.push(c); return false; } return true; }); }
  lMisCheckMats();
  lChannelTick(.2 + dt);
}
function lChannelTick(dt) {
  const L = LW, ex = L.exits.find(x => !x.gone && Math.hypot(x.x - P.x, (x.y - P.y) * 1.2) < 22);
  if (!ex && L.exits.some(x => Math.hypot(x.x - P.x, x.y - P.y) < 160)) lTip(2, _t('Tipp: Stell dich in den Ausgang und bleib stehen. Gegner in der Nähe unterbrechen die Flucht.'));
  if (!ex) { if (L.ch > 0) { L.ch = 0; $('objective').textContent = ''; } L.chEx = null; return; }
  if (ex.t === 'schluessel' && !ex.open) { const M = lMeta(); if (M.keys > 0) { M.keys--; ex.open = true; sfx('ach'); toast(_t('Das Schlüsseltor öffnet sich!'), '#e8b04a'); persist(); } else { lMsg('xkey', _t('Dieses Tor braucht einen Schlüssel.'), '#ff8a5a', 4); return; } }
  if (!lExitOpen(ex)) { $('objective').textContent = _t('MONDTOR ÖFFNET IN {n} S', { n: Math.ceil(80 - ((L.t + ex.ph) % 80)) }); L.ch = 0; return; }
  const foe = enemies.some(e => !e.dead && e.st !== 'spawn' && Math.hypot(e.x - P.x, e.y - P.y) < 70), hurt = T - L.hurtT < .6;
  L.chEx = ex;
  if (foe || hurt) { L.ch = Math.max(0, L.ch - dt * 1.5); $('objective').textContent = foe ? _t('GEGNER STÖREN DEN AUSGANG!') : _t('UNTERBROCHEN!'); return; }
  const need = lChannel() * (ex.t === 'rolle' ? 2 : 1), before = L.ch; L.ch += dt;
  if (Math.floor(before * 2) !== Math.floor(L.ch * 2)) tone(440 + L.ch / need * 600, .08, 'triangle', .04);
  $('objective').textContent = _t('AUSGANG: {n} S', { n: Math.max(0, need - L.ch).toFixed(1) });
  if (L.ch >= need) lExtract();
}
HOOK.hurt.push((d, src) => { if (LW && LW.on && d > 0) LW.hurtT = T; return d; });
function lBossTick(B) {
  const L = LW;
  if (B.state === 'sleep') {
    if (L.t < B.wake) return;
    // irgendwo weit weg erwachen
    for (let k = 0; k < 40; k++) { const x = 100 + Math.random() * (L.S - 200), y = 100 + Math.random() * (L.S - 200); if (Math.hypot(x - P.x, y - P.y) > 650 && lZone(x, y) > .35) { B.x = x; B.y = y; break; } }
    if (!B.x) { B.x = L.rift.x; B.y = L.rift.y; }
    B.state = 'roam'; B.tx = B.x; B.ty = B.y; lBanner(_t('EIN UNGEHEUER ERWACHT'), _t('{name} streift durch die Lande – sieh auf die Karte und meide es, oder stell dich ihm!', { name: B.B.name })); sfx('boom'); shake(6); flash = { a: .25, c: '200,40,40' };
    return;
  }
  if (B.state === 'roam') {
    const dx = B.tx - B.x, dy = B.ty - B.y, d = Math.hypot(dx, dy);
    if (d < 10) { const hunt = Math.random() < .35; B.tx = clamp(hunt ? P.x + rnd(-200, 200) : B.x + rnd(-500, 500), 80, L.S - 80); B.ty = clamp(hunt ? P.y + rnd(-200, 200) : B.y + rnd(-500, 500), 80, L.S - 80); }
    else { const sp = 14 + L.ti * 2; B.x += dx / d * sp * .2; B.y += dy / d * sp * .2; }
    const pd = Math.hypot(B.x - P.x, B.y - P.y);
    if (pd < 520 && (B.rumble -= .2) <= 0) { B.rumble = 2.4; shake(1.5 + (520 - pd) / 160); tone(55, .5, 'sawtooth', .05, 40); lMsg('boss', _t('Der Boden bebt – {name} ist ganz nah!', { name: B.B.name }), '#ff6a5a', 12); }
    if (pd < 300 && enemies.length < 30) {
      B.state = 'act'; const st = lStage(B.x, B.y) + 2;
      const e = lSpawn(B.B.type, B.x, B.y, { boss: true, sc: B.B.sc * .9, hpMul: B.B.hpMul * .75, name: B.B.name, tint: B.B.tint, src: B, st, instant: false });
      e.hp = Math.max(1, Math.round(e.maxHp * B.hp)); e.spd *= .85;
      $('bossName').textContent = B.B.name.toLocaleUpperCase(LOCALE); $('bossbar').hidden = false; setMusic(L.TT.mus + 5, true); lBanner(B.B.name.toLocaleUpperCase(LOCALE), _t('Kämpfen – oder davonlaufen!')); sfx('boom'); shake(7);
    }
  }
}
function lRivalTick(r) {
  const L = LW; if (r.state !== 'roam') return;
  r.t += .2;
  if (L.t > r.leave) { // mit der Beute zum Ausgang
    const ex = L.exits[0], dx = ex.x - r.x, dy = ex.y - r.y, d = Math.hypot(dx, dy);
    if (d < 20) { r.state = 'gone'; if (r.seen) lMsg('rgone' + r.name, _t('{name} ist mit der Beute entkommen.', { name: r.name }), '#ff8a3a', 1); return; }
    r.x += dx / d * 32 * .2; r.y += dy / d * 32 * .2;
  } else {
    if (!r.tgt || r.tgt.open) { let b = null, bd = 1e9; for (const o of L.spots) { if (o.open || o.t === 'kraut' || o.t === 'versteck' || LCH[o.t].lock || o.relic) continue; const d = Math.hypot(o.x - r.x, o.y - r.y); if (d < bd) { bd = d; b = o; } } r.tgt = b; r.lt = 0; }
    if (r.tgt) {
      const dx = r.tgt.x - r.x, dy = r.tgt.y - r.y, d = Math.hypot(dx, dy); r.tx = r.tgt.x;
      if (d > 14) { r.x += dx / d * 30 * .2; r.y += dy / d * 30 * .2; }
      else if ((r.lt += .2) > 2.5) { const o = r.tgt; o.open = 1; o.by = r.name; if (r.loot.length < 8) for (const e of lRollSpot(o).slice(0, 3)) r.loot.push(e); r.tgt = null; if (Math.hypot(o.x - P.x, o.y - P.y) < 320) lMsg('rloot', _t('{name} plündert eine Truhe vor deiner Nase!', { name: r.name }), '#ff8a3a', 6); }
    }
    // Kämpft gegen Lager auf dem Weg
    for (const c of L.camps) if (c.state === 'dorm' && c.left.length && Math.hypot(c.x - r.x, c.y - r.y) < 70 && Math.random() < .04) { c.left.pop(); r.hp -= .12; if (!c.left.length) c.state = 'done'; }
    if (r.hp <= 0) { r.state = 'dead'; const o = L.add({ k: 'spot', t: 'rest', x: r.x, y: r.y, r: 0, solid: false, z: lZone(r.x, r.y), st: lStage(r.x, r.y), open: 0, loot: r.loot.concat([{ t: 'item', it: lItem(2, 2) }]), name: r.name }); L.spots.push(o); return; }
  }
  const pd = Math.hypot(r.x - P.x, r.y - P.y);
  if (pd < 300) r.seen = true;
  if (pd < 230 && enemies.length < 28) {
    r.state = 'act';
    const e = lSpawn(r.type, r.x, r.y, { elite: true, name: r.name, tint: 'rgba(0,0,0,0)', src: r, instant: false });
    e.hp = e.maxHp = Math.round(e.maxHp * 1.6); e.hp = Math.max(1, Math.round(e.maxHp * r.hp)); e.rival = r; r.rival = true;
    toast(_t('Rivale {name} greift an – er will deine Beute!', { name: r.name }), '#ff8a3a'); sfx('spec');
  }
}
// Kill: Bauteile (aus js/forge.js) wandern in den Rucksack, Lager/Bosse/Rivalen, Extra-Beute
function lKillPre() { if (LW && LW.on) LW.pk = Object.assign({}, P.parts || {}); }
HOOK.kill.unshift(lKillPre);
HOOK.kill.push(lKillPost);
function lKillPost(e) {
  if (!LW || !LW.on) return;
  const L = LW, M = lMeta(); L.kills++; M.kills++; lMisEvent('kill');
  if (L.pk && P.parts) for (const k in P.parts) { const d = P.parts[k] - (L.pk[k] || 0); if (d > 0 && lPackAdd({ t: 'part', k, n: d }) && typeof padd === 'function') padd(k, -d); }
  L.pk = null;
  const s = e.lw && e.lw.src;
  if (e.elite && !e.boss && Math.random() < .3) lDrop(e.x, e.y, { t: 'key' });
  if (e.elite && Math.random() < .25) lDrop(e.x, e.y, { t: 'item', it: lItem(2, 1.5) });
  if (!s) return;
  s.alive = Math.max(0, (s.alive || 0) - 1);
  if (s.left && s.state === 'act' && !s.alive && !s.left.length) {
    s.state = 'done'; lMisEvent('camp', s);
    if (s.mis || s.named || Math.random() < .5) { const list = [{ t: 'item', it: lItem(s.named ? 3 : 1, 1.8, s.st) }, { t: 'gold', n: Math.round(20 + s.st * 6) }]; if (Math.random() < .25) list.push({ t: 'key' }); lBurst({ x: s.x, y: s.y }, list); }
    lBanner(s.named ? _t('BEUTE GESICHERT') : _t('LAGER GESÄUBERT'), _t('Die Gegend ist sicherer – sammle, was sie hinterlassen haben.')); sfx('clear');
  }
  if (s.list && s.state === 'act' && !s.alive) s.state = 'done';
  if (s.B && e.boss) {
    s.state = 'dead'; M.bosses++; lMisEvent('boss', s); setMusic(L.TT.mus, false);
    const list = [{ t: 'item', it: lItem(3, 3) }, { t: 'item', it: lItem(2, 2.5) }, { t: 'item', it: lItem(2, 2) }, { t: 'gold', n: Math.round(120 + lStage(e.x, e.y) * 30) }, { t: 'key' }, { t: 'gem', k: randomGem(lStage(e.x, e.y) + 10), n: 1 }];
    if (Math.random() < .05 + L.ti * .01) list.push({ t: 'item', it: makeMythic() });
    if (Math.random() < .3) { const d = lEgg(2 + L.ti); if (d) list.push({ t: 'egg', d }); }
    const k = lPart(lStage(e.x, e.y), .3); if (k) list.push({ t: 'part', k, n: 1 });
    lBurst(e, list); lBanner(_t('UNGEHEUER BEZWUNGEN'), _t('Schnapp dir die Beute – und dann nichts wie raus!'));
  }
  if (s.rival) {
    s.state = 'dead'; M.rivals++; lMisEvent('rival', s);
    lBurst(e, s.loot.concat([{ t: 'item', it: lItem(2, 2) }, { t: 'gold', n: Math.round(30 + lStage(e.x, e.y) * 8) }]));
    setTimeout(() => lBanner(_t('RIVALE BESIEGT'), _t('{name} lässt alles fallen, was er gesammelt hat.', { name: s.name })), 50);
  }
}

/* ---------- Zeichnen ---------- */
function lObjDraw(o) { return o.di || (o.di = { y: o.y, draw: () => lDraw(o) }); }
function lShadow(x, y, w) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, w, w * .38, 0, 0, 6.283); ctx.fill(); }
function lDraw(o) {
  const x = Math.round(o.x - CX), y = Math.round(o.y - CY);
  switch (o.k) {
    case 'prop': {
      // Bild mit eingebackenem Schatten (ein drawImage je Baum); Spieler hinter der Krone: durchsichtig
      const s = lPropImg(o.t, o.v), behind = s.tree && P.y < o.y && P.y > o.y - s.h && Math.abs(P.x - o.x) < s.c.width / 2;
      if (behind) ctx.globalAlpha = .5; ctx.drawImage(s.c, x - s.ox, y - s.oy); ctx.globalAlpha = 1;
      return;
    }
    case 'mark': {
      if (o.t === 'kreis') { ctx.fillStyle = '#6a6672'; ctx.fillRect(x - 6, y - 3, 12, 6); ctx.fillStyle = '#8a8692'; ctx.fillRect(x - 5, y - 4, 10, 2); ctx.fillStyle = `rgba(87,199,230,${.4 + .3 * Math.sin(T * 3)})`; ctx.fillRect(x - 2, y - 3, 4, 2); addLight(x, y - 4, 26, .5); return; }
      const s = lSpr(o.t === 'riese' ? 'riese' : o.t, 0); lShadow(x, y, s.width * .36);
      const behind = P.y < o.y && P.y > o.y - s.height && Math.abs(P.x - o.x) < s.width / 2; if (behind) ctx.globalAlpha = .5;
      ctx.drawImage(s, x - Math.floor(s.width / 2), y - s.height + 2); ctx.globalAlpha = 1;
      if (o.t === 'riese') addLight(x, y - 30, 40, .4);
      return;
    }
    case 'spot': {
      if (o.t === 'kraut') { if (o.open) return; ctx.drawImage(lSpr('kraut', o.v), x - 7, y - 10); return; }
      if (o.t === 'versteck') { if (o.open) { ctx.fillStyle = '#3a2a1e'; ctx.fillRect(x - 4, y - 1, 8, 3); return; } const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < 90 && Math.floor(T * 3 + o.x) % 3 === 0) { ctx.fillStyle = '#fff3c0'; ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x - 1, y - 1, 3, 1); ctx.fillRect(x, y, 1, 1); } if (d < 90) { ctx.fillStyle = 'rgba(90,64,40,.55)'; ctx.fillRect(x - 3, y, 6, 2); } return; }
      if (o.t === 'rest') { ctx.globalAlpha = o.open ? .55 : 1; ctx.drawImage(lSpr('rest', 0), x - 11, y - 9); ctx.globalAlpha = 1; if (o.relic && !o.open) { addLight(x, y - 4, 22, .7); if (Math.random() < .2) part(o.x + rnd(-6, 6), o.y, rnd(2, 10), 0, 0, 20, '#57c7e6', .6, 1, -5, 1); } return; }
      const f = o.open ? Math.min(2, Math.floor(o.open * 3)) : 0; lShadow(x, y, 8);
      ctx.drawImage(lChestImg(o.t, f), x - 8, y - 14);
      if (!o.open) { addLight(x, y - 8, o.t === 'gold' ? 30 : o.t === 'fluch' ? 26 : 16, o.t === 'gold' ? .6 : .35); if (o.t === 'fluch' && Math.random() < .2) part(o.x + rnd(-7, 7), o.y, rnd(2, 12), 0, 0, rnd(10, 25), '#b060ff', .7, 1, -6, 1); if (o.t === 'gold' && Math.random() < .08) part(o.x + rnd(-6, 6), o.y - 8, rnd(2, 8), 0, 0, 15, '#ffe08a', .4, 1, 0, 1); }
      if (o.open && o.open < 1) o.open = Math.min(1, o.open + dt0 * 5);
      return;
    }
    case 'npc': lShadow(x, y, 6); drawNpc(o); if (o.role === 'mis' && LW.misDone) { const b = Math.round(Math.sin(T * 5) * 2); ptext('!', x, y - 34 + b, '#ffd24a', 8); } else if (o.role === 'mis' && !LW.misOn) { const b = Math.round(Math.sin(T * 5) * 2); ptext('?', x, y - 34 + b, '#57c7e6', 8); } return;
    case 'fire': case 'camp': {
      if (o.k === 'camp' && o.state === 'done') { ctx.fillStyle = '#2a2420'; ctx.fillRect(x - 6, y - 1, 12, 3); return; }
      const fr = Math.floor(T * 8 + o.x); ctx.fillStyle = WOOD[0]; ctx.fillRect(x - 7, y - 2, 14, 3); ctx.fillStyle = WOOD[1]; ctx.fillRect(x - 6, y - 3, 5, 2); ctx.fillRect(x + 1, y - 3, 5, 2);
      ctx.fillStyle = '#ff6a2a'; ctx.fillRect(x - 4, y - 8 - fr % 2, 8, 6); ctx.fillStyle = '#ffb03a'; ctx.fillRect(x - 2, y - 11 + (fr % 3 ? 0 : 1), 4, 5); ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - 1, y - 7, 2, 3);
      addLight(x, y - 6, 60, 1); if (Math.random() < .25) part(o.x + rnd(-3, 3), o.y, 8, rnd(-5, 5), 0, rnd(20, 40), Math.random() < .5 ? '#ffb03a' : '#ff6a2a', .6, 1, -20, 1);
      return;
    }
    case 'exit': {
      const open = lExitOpen(o), col = o.t === 'mond' ? '#8ab8ff' : o.t === 'schluessel' ? '#ffd24a' : o.t === 'rolle' ? '#e8dcc0' : '#6ae08a';
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 16, 5, 0, 0, 6.283); ctx.fill();
      if (o.t !== 'rolle') { ctx.fillStyle = '#4a4652'; ctx.fillRect(x - 15, y - 34, 5, 35); ctx.fillRect(x + 10, y - 34, 5, 35); ctx.fillStyle = '#6a6672'; ctx.fillRect(x - 16, y - 37, 32, 5); ctx.fillStyle = '#8a8692'; ctx.fillRect(x - 16, y - 37, 32, 1); ctx.fillStyle = col; ctx.fillRect(x - 13, y - 28, 1, 2); ctx.fillRect(x + 12, y - 22, 1, 2); ctx.fillRect(x - 13, y - 14, 1, 2); }
      if (o.t === 'schluessel' && !o.open) { ctx.fillStyle = '#3a3440'; ctx.fillRect(x - 10, y - 32, 20, 32); ctx.fillStyle = '#e8b04a'; ctx.fillRect(x - 2, y - 18, 4, 5); ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 1, y - 17, 2, 2); return; }
      if (open) { ctx.globalAlpha = .9; drawFxFrame('ring', Math.floor(T * 12) % 14, x, y - 16, .6, 0, false, tintedFx('ring', col)); ctx.globalAlpha = 1; const [r, g, b] = hexRgb(col); ctx.fillStyle = `rgba(${r},${g},${b},${.2 + .1 * Math.sin(T * 4)})`; ctx.fillRect(x - 10, y - 30, 20, 30); addLight(x, y - 14, 60, 1); if (Math.random() < .3) part(o.x + rnd(-9, 9), o.y, rnd(0, 26), 0, 0, rnd(10, 30), col, .7, 1, -8, 1); }
      else { ctx.fillStyle = 'rgba(20,16,30,.8)'; ctx.fillRect(x - 10, y - 30, 20, 30); ctx.fillStyle = 'rgba(138,184,255,.25)'; ctx.fillRect(x - 10, y - 30, 20, 30 * ((LW.t + o.ph) % 80 - 40) / 40); addLight(x, y - 14, 30, .4); }
      return;
    }
    case 'rift': {
      const a = .5 + .3 * Math.sin(T * 2); ctx.fillStyle = `rgba(150,60,220,${a * .5})`; ctx.beginPath(); ctx.ellipse(x, y, 30, 12, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#1a0e24'; for (let i = -24; i <= 24; i += 2) ctx.fillRect(x + i, y + Math.round(Math.sin(i * .7) * 3), 2, 2); ctx.fillStyle = '#c060ff'; for (let i = -20; i <= 20; i += 4) ctx.fillRect(x + i, y + Math.round(Math.sin(i * .7) * 3) - 1, 1, 1);
      addLight(x, y, 70, .8); if (Math.random() < .4) part(o.x + rnd(-24, 24), o.y, 0, rnd(-5, 5), 0, rnd(20, 50), Math.random() < .5 ? '#c060ff' : '#5a2a8a', 1, 1, -10, 1);
      return;
    }
  }
}
// Rivale als Held gezeichnet (charStrip): Bild 0–3 Ruhe, 4–7 Laufen, 8 Treffer
function lHero(look, x, y, face, moving, hit) {
  const st = charStrip(look), fi = hit && st.hasHit ? 8 : moving ? 4 + Math.floor(T * 10) % 4 : Math.floor(T * 6) % 4;
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(face < 0 ? -1 : 1, 1); ctx.drawImage(hit ? st.sil : st.c, fi * st.w, 0, st.w, st.h, -st.w / 2, -st.h, st.w, st.h); ctx.restore();
  return st.h;
}
function lDrawTok(r, rival) {
  const x = Math.round(r.x - CX), y = Math.round(r.y - CY); if (x < -30 || y < -40 || x > VW + 30 || y > VH + 30) return;
  lShadow(x, y, 5);
  let h;
  if (r.look) h = lHero(r.look, x, y, r.tx != null && r.tx < r.x ? -1 : 1, true, false);
  else { const sp = EN[r.type] ? EN[r.type].sp : 'knight', fr = frameRect(sp, 'run', Math.floor(T * 10)); h = fr[3]; ctx.drawImage(SHEET, fr[0], fr[1], fr[2], fr[3], x - fr[2] / 2, y - fr[3], fr[2], fr[3]); }
  const fr = [0, 0, 0, h];
  if (rival) { ctx.font = '8px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#000'; ctx.fillText(r.name, x + 1, y - fr[3] - 1); ctx.fillStyle = '#ff8a3a'; ctx.fillText(r.name, x, y - fr[3] - 2); }
}
function lPickDraw(c) {
  const x = Math.round(c.x - CX), y = Math.round(c.y - CY), z = Math.round(c.z + Math.sin(c.t * 5) + 2);
  if (c.k === 'lpart') { const p = typeof pparse === 'function' ? pparse(c.pk) : null, img = p && typeof partArt === 'function' ? partArt(p.t, p.g, p.el) : lSpr('relikt', 0); ctx.drawImage(img, x - img.width / 2, y - z - img.height + 2); addLight(x, y - 8, 16, .5); }
  else if (c.k === 'legg') { ctx.drawImage(lSpr('ei', 0), x - 5, y - z - 13); addLight(x, y - 8, 26, .8); if (Math.random() < .1) part(c.x + rnd(-4, 4), c.y, rnd(4, 14), 0, 0, 15, '#ffd24a', .5, 1, 0, 1); }
  else if (c.k === 'lkey') { ctx.drawImage(lSpr('schl', 0), x - 7, y - z - 8); addLight(x, y - 6, 16, .6); }
  else if (c.k === 'lmap') ctx.drawImage(lSpr('karte', 0), x - 7, y - z - 11);
  else if (c.k === 'lrel') { ctx.drawImage(lSpr('relikt', 0), x - 6, y - z - 13); addLight(x, y - 8, 26, .9); }
}
const LPICK = new Set(['lpart', 'legg', 'lkey', 'lmap', 'lrel']);
HOOK.draw.push(list => {
  if (!LW || !G || G.type !== 'lande') return;
  const L = LW, x0 = CX - 60, x1 = CX + VW + 60, y0 = CY - 30, y1 = CY + VH + 70;
  for (let gy = Math.max(0, Math.floor(y0 / LGC)); gy <= Math.min(L.GN - 1, Math.floor(y1 / LGC)); gy++) for (let gx = Math.max(0, Math.floor(x0 / LGC)); gx <= Math.min(L.GN - 1, Math.floor(x1 / LGC)); gx++) for (const o of L.grid[gy * L.GN + gx]) { if (o.x < x0 || o.x > x1 || o.y < y0 || o.y > y1 || o.k === 'vein') continue; const d = lObjDraw(o); d.y = o.k === 'spot' && o.t !== 'kraut' ? o.y - 1 : o.y; list.push(d); }
  for (const c of pickups) if (LPICK.has(c.k)) { c.di = c.di || { y: 0, draw: () => lPickDraw(c) }; c.di.y = c.y; list.push(c.di); }
  for (const r of L.rivals) if (r.state === 'roam') { r.di = r.di || { y: 0, draw: () => lDrawTok(r, true) }; r.di.y = r.y; list.push(r.di); }
  for (const p of L.pats) if (p.state === 'dorm' && p.list.length && Math.abs(p.x - P.x) < VW && Math.abs(p.y - P.y) < VH) { p.di = p.di || { y: 0, draw: () => lDrawTok({ x: p.x, y: p.y, type: p.list[0].t }, false) }; p.di.y = p.y; list.push(p.di); }
  // Erzadern sind echte Hindernisse (js/combat.js: abbauen), aber nur in der Nähe
  if ((L.veinT = (L.veinT || 0) - 1) <= 0) { L.veinT = 15; obs = obs.filter(o => !o.dead && Math.abs(o.x - P.x) < 500 && Math.abs(o.y - P.y) < 400); lGridEach(P.x, P.y, 420, o => { if (o.k === 'vein' && !o.dead && !obs.includes(o)) obs.push(o); }); }
});
HOOK.drawEnemy.push(e => {
  if (!LW || !LW.on || !(e.rival || (e.boss && e.lw))) return;
  if (e.rival && e.rival.look && e.st !== 'spawn') lHero(e.rival.look, e.x - CX, e.y - CY - (e.z || 0), e.turn, e.moving, e.flash > 0);
  const x = Math.round(e.x - CX), y = Math.round(e.y - CY) - Math.round((SP[e.sp].h + 6) * e.sc) - Math.round(e.z);
  ctx.font = '8px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#000'; ctx.fillText(e.name, x + 1, y + 1); ctx.fillStyle = e.rival ? '#ff8a3a' : '#ff5a4a'; ctx.fillText(e.name, x, y);
});

/* ---------- Überlagerung: Kompass, Kanal, Namen, Verderbnis ---------- */
let LVIG = null;
// Kompasspfeil um den Helden: Spitze zeigt zum Ziel, darunter die Entfernung
function lArrow(a, dist, col, R, big) {
  const cx = P.x - CX, cy = P.y - CY - 10, x = Math.round(cx + Math.cos(a) * R), y = Math.round(cy + Math.sin(a) * R * .85), s = big ? 1 : .75, bob = Math.sin(T * 6) * 1.5;
  ctx.save(); ctx.translate(x + Math.cos(a) * bob, y + Math.sin(a) * bob); ctx.rotate(a); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -6); ctx.lineTo(-1, 0); ctx.lineTo(-4, 6); ctx.closePath();
  ctx.lineWidth = 3; ctx.strokeStyle = '#120e18'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
  if (dist != null) ptext(_t('{n} m', { n: Math.round(dist / 8) }), x, y + (Math.sin(a) > -.2 ? 13 : -12), col, 6);
}
HOOK.postRender.push(() => {
  const on = !!(LW && LW.on && G && G.type === 'lande');
  lHudShow(on && (state === 'play' || state === 'dead'));
  if (on && state === 'pause' && !panel.querySelector('[data-act="l_inv"]')) lPauseFix();
  if (!on) return;
  const L = LW;
  // Verderbnis: violetter Rand, wenn du drin stehst
  if (lInRift(P.x, P.y)) { if (!LVIG || LVIG.width !== VW || LVIG.height !== VH) LVIG = mk(VW, VH, g => { const gr = g.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .25, VW / 2, VH / 2, Math.max(VW, VH) * .7); gr.addColorStop(0, 'rgba(120,40,200,0)'); gr.addColorStop(1, 'rgba(120,40,200,.55)'); g.fillStyle = gr; g.fillRect(0, 0, VW, VH); }); ctx.globalAlpha = .6 + .25 * Math.sin(T * 3); ctx.drawImage(LVIG, 0, 0); ctx.globalAlpha = 1; if (Math.random() < .4) part(CX + rnd(0, VW), CY + rnd(0, VH), rnd(4, 30), rnd(-6, 6), rnd(-3, 3), rnd(-8, 4), Math.random() < .5 ? '#c060ff' : '#5a2a8a', 1.2, 1, 0, 1); }
  if (state !== 'play') return;
  // Namen über Händlern und Ausgängen
  for (const r in L.npcs) { const o = L.npcs[r], x = o.x - CX, y = o.y - CY; if (x > -40 && x < VW + 40 && y > -20 && y < VH + 40) ptext(o === L.near ? o.name : LNPC[r].hi, x, y - 42, o === L.near ? '#ffd24a' : LNPC[r].c, 6); }
  for (const ex of L.exits) { const x = ex.x - CX, y = ex.y - CY; if (x < -40 || x > VW + 40 || y < -20 || y > VH + 60) continue; const open = lExitOpen(ex); ptext(ex.t === 'schluessel' && !ex.open ? _t('SCHLÜSSELTOR') : ex.t === 'mond' ? (open ? _t('MONDTOR · OFFEN') : _t('MONDTOR · ZU')) : _t('AUSGANG'), x, y - 46 + Math.round(Math.sin(T * 4) * 2), open ? '#8ef0a8' : '#c8c0d8', 6); }
  // Kompass: Ausgang (golden), Auftrag (blau)
  const ex = lNearExit(); let ea = null;
  if (ex) { const dx = ex.x - P.x, dy = ex.y - P.y, d = Math.hypot(dx, dy); if (d > 70) { ea = Math.atan2(dy, dx); lArrow(ea, d, lExitOpen(ex) ? '#ffd24a' : '#a8a0b8', 34, true); } }
  const tg = lMisTarget();
  if (tg) { const dx = tg.x - P.x, dy = tg.y - P.y, d = Math.hypot(dx, dy); if (d > 90) { const a = Math.atan2(dy, dx); lArrow(a, null, '#57c7e6', ea != null && Math.abs(angDiff(a, ea)) < .5 ? 50 : 34, false); } }
  // Kanal am Ausgang
  if (L.chEx && L.ch > 0) { const p = L.ch / (lChannel() * (L.chEx.t === 'rolle' ? 2 : 1)), x = P.x - CX, y = P.y - CY - 12; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.283); ctx.stroke(); ctx.strokeStyle = '#8ef0a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + p * 6.283); ctx.stroke(); }
  if (L.digO && !L.digO.open) { const x = L.digO.x - CX, y = L.digO.y - CY; ptext(L.dig > 0 ? _t('GRABEN …') : _t('HIER IST WAS VERGRABEN'), x, y - 22, '#ffe08a', 6); if (L.dig > 0) { ctx.fillStyle = '#000'; ctx.fillRect(x - 12, y - 16, 24, 3); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 12, y - 16, Math.round(24 * L.dig / 1.4), 3); } }
  // Interagieren-Knopf
  const b = $('bAct'), near = L.near;
  if (near !== L.bnear) { L.bnear = near; b.hidden = !near; if (near) { b.querySelector('img').src = iconURL(['pa', LNPC[near.role].icon]); b.setAttribute('aria-label', near.name); } }
  if (near && !isTouch) ptext('[E]', near.x - CX, near.y - CY - 32, '#efe2bf', 6);
  lHudTick();
});
function lMisTarget() {
  const L = LW; if (!L.misOn) return L.npcs.mis && Math.hypot(L.npcs.mis.x - P.x, L.npcs.mis.y - P.y) > 60 ? L.npcs.mis : null;
  if (L.misDone && L.npcs.mis) return L.npcs.mis;
  for (const m of L.mis) { if (m.done || !m.tgt) continue; const t = m.tgt; if (t.B && t.state === 'sleep') continue; if (t.state === 'gone' || t.state === 'dead') continue; return t; }
  return null;
}

/* ---------- HUD (oben rechts): Karte, Zeit, Gefahr, Rucksack ---------- */
document.head.insertAdjacentHTML('beforeend', `<style>
#lhud{position:fixed;top:calc(var(--sat) + 8px);right:calc(max(16px,var(--sar)) + 46px);z-index:5;display:flex;flex-direction:row-reverse;gap:6px;align-items:flex-start;pointer-events:none;font-family:var(--f-display);font-size:8px}
#lhMap{width:88px;height:88px;image-rendering:pixelated;background:#0c0a10;box-shadow:0 0 0 2px var(--night),0 0 0 3px var(--parch-dim);pointer-events:auto;cursor:pointer;touch-action:none}
#lhud .lc{display:grid;gap:4px;justify-items:end}
#lhud .lp{display:flex;align-items:center;gap:5px;background:rgba(17,14,23,.85);padding:4px 6px;box-shadow:0 0 0 2px var(--night);white-space:nowrap;text-shadow:1px 1px 0 #000;color:var(--parch)}
#lhud button.lp{border:0;pointer-events:auto;cursor:pointer;font:inherit;min-height:34px;min-width:44px}
#lhud .lp img{width:16px;height:16px;image-rendering:pixelated}
#lhud .full{color:#ff6a5a}
#lhud .pop img{animation:pop .25s steps(3)}
#lhMis{max-width:140px;white-space:normal;text-align:right;font-family:var(--f-body);font-size:15px;line-height:1;color:#9ad8ee}
@media (orientation:portrait){#lhud{flex-direction:column;align-items:flex-end}}
body.lande .hud-r .info{display:none}
body.lande #combo{top:calc(var(--sat) + 170px)}
body.lande #objective{top:calc(var(--sat) + 104px);left:calc(50% - 40px)}
body.lande #bossbar{top:calc(var(--sat) + 56px);left:max(16px,var(--sal));transform:none;width:calc(100vw - 172px)}
@media (orientation:landscape){body.lande #objective{top:calc(var(--sat) + 52px)}body.lande #bossbar{top:calc(var(--sat) + 60px);left:max(90px,calc(var(--sal) + 74px));width:min(420px,calc(100vw - 380px))}}
.lgot>div{animation:lgot .35s steps(4) both}
@keyframes lgot{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}
.lslot.gone{cursor:default}.lslot.gone img{filter:grayscale(.6) brightness(.8)}
.lslot.gone:after{content:"";position:absolute;inset:18%;background:linear-gradient(45deg,transparent 45%,#c8463c 45%,#c8463c 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,#c8463c 45%,#c8463c 55%,transparent 55%);opacity:.85}
.ltier .opt.lock{opacity:.45}
.lrules{display:grid;gap:4px;margin:6px 0 10px}
.lrules div{background:var(--stone-lo);padding:6px 8px;font-size:17px;line-height:1.1;box-shadow:inset 3px 0 0 var(--c)}
.lbar{height:8px;background:var(--stone-lo);box-shadow:0 0 0 2px var(--night);margin:4px 0 8px}
.lbar i{display:block;height:100%;background:#57c7e6}
.lmap{display:block;width:min(100%,440px);margin:0 auto 8px;image-rendering:pixelated;box-shadow:0 0 0 2px var(--night),0 0 0 3px var(--parch-dim)}
.lmapw{display:grid;gap:10px;align-items:start}
@media (orientation:landscape){.lmapw{grid-template-columns:auto minmax(0,1fr)}.lmap{width:min(440px,calc(100vh - 110px),calc(100dvh - 110px));margin:0}.lleg{justify-content:flex-start}}
.lleg{display:flex;flex-wrap:wrap;gap:8px;font-size:16px;color:var(--parch-dim);justify-content:center;margin-bottom:6px}
.lleg i{display:inline-block;width:9px;height:9px;margin-right:4px;box-shadow:0 0 0 1px #000;vertical-align:0}
.lslot{position:relative;aspect-ratio:1;background:var(--stone-lo);border:0;display:grid;place-items:center;cursor:pointer;padding:0}
.lslot img{width:70%;height:70%;object-fit:contain;image-rendering:pixelated}
.lslot .n{position:absolute;right:3px;bottom:2px;font-family:var(--f-display);font-size:7px;text-shadow:1px 1px 0 #000;color:var(--parch)}
.lslot.empty{cursor:default;background:rgba(10,8,14,.35);box-shadow:inset 0 0 0 2px var(--stone-hi)}
.lgear .lslot{width:60px;height:60px;margin:4px auto 0}
.lnw+.lpk{margin-top:10px}.side .lwd{margin-bottom:10px}
.lgmini{padding:6px}.lgmini .lgear>div:first-child{display:none}.lgmini .lgear .lslot{width:46px;height:46px;margin:0 auto}
@media (min-width:600px){.lnw{display:none}}
@media (max-width:599px){.lwd{display:none}}
body.touch .lslot .n{font-size:8px}
.lmis{background:var(--stone-lo);padding:7px 9px;margin-bottom:6px;box-shadow:inset 3px 0 0 var(--c)}
.lmis .nm{font-size:19px;line-height:1.05}
.lmis .st{font-size:15px;color:var(--parch-dim)}
</style>`);
document.body.insertAdjacentHTML('beforeend', `<div id="lhud" hidden><canvas id="lhMap" width="96" height="96" aria-label="${_t('Karte')}"></canvas><div class="lc"><div class="lp"><span id="lhT">0:00</span><b id="lhD">${LDNG[0].n}</b></div><button class="lp" id="lhPack" aria-label="${_t('Rucksack')}"><img src="" alt=""><span id="lhP">0/12</span></button><div class="lp" id="lhK" hidden><img src="" alt=""><span id="lhKn">0</span></div><div id="lhMis"></div></div></div>`);
const LH = { on: false, c: {} };
function lHudShow(on) { if (LH.on === on) return; LH.on = on; $('lhud').hidden = !on; if (on) { $('lhPack').querySelector('img').src = iconURL(['pa', 'l_pack']); $('lhK').querySelector('img').src = iconURL(['pa', 'l_schl']); LH.c = {}; } }
function lSetH(id, v) { if (LH.c[id] !== v) { LH.c[id] = v; $(id).textContent = v; } }
function lClock(t) { return Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'); }
function lHudTick() {
  const L = LW; if ((L.hudT -= dt0) > 0) return; L.hudT = .2;
  lSetH('lhT', lClock(L.t)); const D = LDNG[L.danger]; lSetH('lhD', D.n); $('lhD').style.color = D.c;
  const cap = lCap(); lSetH('lhP', L.pack.length + '/' + cap); $('lhPack').classList.toggle('full', L.pack.length >= cap);
  const k = lMeta().keys; $('lhK').hidden = !k; lSetH('lhKn', String(k));
  const m = !L.misOn ? _t('Sprich mit Elwa') : L.misDone ? _t('Belohnung bei Elwa') : (L.mis.find(x => !x.done) || {}).txt || '';
  const mt = L.mis.find(x => !x.done && x.n > 1); lSetH('lhMis', m + (mt && L.misOn && !L.misDone && m === mt.txt ? ' ' + mt.c + '/' + mt.n : ''));
  L.misDone = L.misOn && L.mis.some(x => x.done && !x.paid && x.t !== 'mats');
  if ((L.mapT -= .2) <= 0) { L.mapT = .2; lMiniDraw($('lhMap'), 96, false); }
}
// Karte zeichnen: klein im HUD (Spieler in der Mitte) oder groß (ganze Welt)
function lMiniDraw(cv, sz, full) {
  const L = LW, g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#0c0a10'; g.fillRect(0, 0, sz, sz);
  const view = full ? L.S : 900, sc = sz / view, ox = full ? 0 : clamp(P.x - view / 2, 0, L.S - view), oy = full ? 0 : clamp(P.y - view / 2, 0, L.S - view);
  const X = x => (x - ox) * sc, Y = y => (y - oy) * sc;
  g.drawImage(L.mini, ox / LTS, oy / LTS, view / LTS, view / LTS, 0, 0, sz, sz);
  if (L.cr > 0) { g.fillStyle = 'rgba(150,60,220,.38)'; g.beginPath(); g.arc(X(L.rift.x), Y(L.rift.y), L.cr * sc, 0, 6.283); g.fill(); }
  g.drawImage(L.fogc, ox / LFC, oy / LFC, view / LFC, view / LFC, 0, 0, sz, sz);
  // kleine Pixelzeichen mit dunklem Rand, gut lesbar auch auf dem Handy
  const icon = (x, y, pat, col, edge) => { const X0 = Math.round(X(x)), Y0 = Math.round(Y(y)), m = full ? 2 : 1, w = pat[0].length, h = pat.length; if (X0 < -w * m || Y0 < -h * m || X0 > sz + w * m || Y0 > sz + h * m) return false; const ox_ = X0 - Math.floor(w * m / 2), oy_ = Y0 - Math.floor(h * m / 2); for (const [dx, dy, c] of [[-1, 0, '#000'], [1, 0, '#000'], [0, -1, '#000'], [0, 1, '#000'], [0, 0, col]]) { g.fillStyle = c; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (pat[j][i] === '#') g.fillRect(ox_ + i * m + dx, oy_ + j * m + dy, m, m); } if (edge) { g.fillStyle = edge; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (pat[j][i] === 'o') g.fillRect(ox_ + i * m, oy_ + j * m, m, m); } return true; };
  const DOT = ['##', '##'], RING = ['.###.', '#ooo#', '#ooo#', '#ooo#', '.###.'], DIA = ['..#..', '.###.', '#####', '.###.', '..#..'], CAMP = ['#.#', '.#.', '#.#'], SKULL = ['.###.', '#####', '#o#o#', '#####', '.#.#.'], STAR = ['..#..', '.###.', '#####', '.#.#.'];
  for (const o of L.spots) if (!o.open && o.t !== 'versteck' && o.t !== 'kraut' && (lKnown(o) || (o.relic && L.misOn))) icon(o.x, o.y, o.relic ? STAR : DOT, o.relic ? '#57c7e6' : LCH[o.t].lock ? '#9aa2ae' : o.t === 'fluch' ? '#c060ff' : o.t === 'gold' ? '#ffd24a' : '#e8b04a');
  for (const c of L.camps) if (c.state !== 'done' && (lKnown(c) || c.mis)) icon(c.x, c.y, c.mis ? STAR : CAMP, c.mis ? '#57c7e6' : '#e8463c');
  for (const m of L.marks) if (lKnown(m)) icon(m.x, m.y, DIA, '#efe2bf');
  for (const r in L.npcs) { const o = L.npcs[r]; if (o.known || lKnown(o)) { o.known = true; icon(o.x, o.y, DIA, LNPC[r].c); } }
  for (const ex of L.exits) if (!ex.gone) icon(ex.x, ex.y, RING, lExitOpen(ex) ? '#6ae08a' : ex.t === 'schluessel' ? '#ffd24a' : '#8ab8ff', lExitOpen(ex) ? '#1e6a3a' : '#1a1420');
  for (const r of L.rivals) if (r.state === 'roam' && Math.hypot(r.x - P.x, r.y - P.y) < 340) icon(r.x, r.y, DIA, '#ff8a3a');
  for (const B of L.bosses) if (B.state === 'roam' || B.state === 'act') {
    const e = B.state === 'act' ? enemies.find(x => x.lw && x.lw.src === B) : null, bx = e ? e.x : B.x, by = e ? e.y : B.y, p = Math.floor(T * 3) % 2;
    if (!icon(bx, by, SKULL, p ? '#ffffff' : '#ff6a5a', '#c8342c') && !full) { const a = Math.atan2(by - P.y, bx - P.x), ex_ = Math.round(sz / 2 + Math.cos(a) * (sz / 2 - 5)), ey = Math.round(sz / 2 + Math.sin(a) * (sz / 2 - 5)); g.fillStyle = '#000'; g.fillRect(ex_ - 3, ey - 3, 6, 6); g.fillStyle = p ? '#ff4a3a' : '#ffffff'; g.fillRect(ex_ - 2, ey - 2, 4, 4); }
  }
  // Held als Pfeil in Laufrichtung
  { const hx = X(P.x), hy = Y(P.y), a = Math.hypot(P.vx, P.vy) > 8 ? Math.atan2(P.vy, P.vx) : (P.face || 1) > 0 ? 0 : Math.PI, k = full ? 1.3 : 1.1; g.save(); g.translate(hx, hy); g.rotate(a); g.scale(k, k); g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, -4); g.lineTo(-1, 0); g.lineTo(-3, 4); g.closePath(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke(); g.fillStyle = '#ffffff'; g.fill(); g.restore(); }
  if (!full) { g.strokeStyle = 'rgba(239,226,191,.3)'; g.lineWidth = 1; g.strokeRect(.5, .5, sz - 1, sz - 1); }
}
// „click“ statt „pointerdown“: sonst trifft der nachfolgende Klick einen Knopf der eben geöffneten Tafel
$('lhMap').addEventListener('click', () => { if (LW && LW.on && state === 'play') { audioOn(); lMapScreen(); } });
$('lhPack').addEventListener('click', () => { if (LW && LW.on && state === 'play') { audioOn(); LG.sel = null; LG.arm = null; lInv(); } });
$('bAct').addEventListener('click', () => { if (LW && LW.on && state === 'play') lInteract(); });
addEventListener('keydown', e => {
  if (!LW || !LW.on || state !== 'play' || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return;
  if (e.code === 'KeyC' || e.code === 'KeyI' || e.code === 'KeyB') { e.stopImmediatePropagation(); LG.sel = null; LG.arm = null; lInv(); }
  else if (e.code === 'KeyM') lMapScreen();
  else if (e.code === 'KeyE' || e.code === 'Enter') lInteract();
}, true);
function lInteract() { const o = LW && LW.near; if (!o) return; sfx('click'); if (o.role === 'mis') lMisScreen(); else if (o.role === 'trade') lTradeScreen(); else lHealScreen(); }
function lResume() { hideOverlay(); setState('play'); showHud(true); LW.bnear = undefined; }
// Pause in der Freiwelt: Rucksack statt Charakter, Abbrechen statt Hauptmenü
function lPauseFix() {
  const m = panel.querySelector('.menu'); if (!m) return;
  const ch = m.querySelector('[data-act="pchar"]'), ti = m.querySelector('[data-act="title"]');
  if (ch) ch.outerHTML = `<button class="btn alt" data-act="l_inv">${_t('Rucksack & Ausrüstung')}</button><button class="btn alt" data-act="l_map">${_t('Karte')}</button>`;
  if (ti) ti.outerHTML = `<button class="btn alt" data-act="l_quit">${_t('Ausflug abbrechen')}</button>`;
  const sub = panel.querySelector('.sub'); if (sub) sub.textContent = esc(P.name) + ' · ' + LW.TT.n + ' · ' + lClock(LW.t);
}

/* ---------- Bildschirme ---------- */
function lHead(title, back, extra) { return `<div class="head"><h2>${title}</h2><div class="hbtns">${extra || ''}<button class="btn alt sm" data-act="${back}">${_t('Zurück')}</button></div></div>`; }
function lSlot(e, id, sel, show) {
  if (!e) return `<div class="lslot empty"></div>`;
  const c = lCol(e), n = lCount(e) || (e.t === 'gold' ? fmt(e.n) : ''), tag = show ? 'div' : 'button';
  return `<${tag} class="lslot${show ? ' gone' : ''}"${show ? '' : ` data-act="l_sel" data-id="${id}"`} style="box-shadow:inset 0 0 0 2px ${c}${sel ? ',0 0 0 2px #e8b04a' : ''}" aria-label="${esc(lName(e))}" title="${esc(lName(e))}"><img src="${lIcon(e)}" alt="">${e.t === 'item' && e.it.up ? `<span class="n" style="left:3px;right:auto;top:2px;bottom:auto;color:var(--gold)">+${e.it.up}</span>` : ''}${n ? `<span class="n">${n}</span>` : ''}</${tag}>`;
}
function lGetSel(id) {
  if (!id) return null; const [k, v] = id.split(':');
  if (k === 'g') return P.gear[v] ? { e: { t: 'item', it: P.gear[v] }, where: 'g', slot: v } : null;
  if (k === 'p') return LW.pack[+v] ? { e: LW.pack[+v], where: 'p', i: +v } : null;
  if (k === 'b' && LW.pet) { const b = lBag(LW.pet); return b[+v] ? { e: b[+v], where: 'b', i: +v } : null; }
  return null;
}
function lInv() {
  if (!LW || !LW.on) return;
  setState('menu'); showHud(false);
  const L = LW, cap = lCap(), pet = L.pet, bs = pet ? L.petBag : 0, bag = pet ? lBag(pet) : [], s = lGetSel(LG.sel);
  const gear = ['weapon', 'armor', 'helm'].map(sl => `<div class="gearslot lgear"><div style="font-size:14px;color:var(--parch-dim)">${sl === 'weapon' ? _t('Waffe') : AR[sl].label}</div>${lSlot(P.gear[sl] ? { t: 'item', it: P.gear[sl] } : null, 'g:' + sl, LG.sel === 'g:' + sl)}</div>`).join('');
  const packG = Array.from({ length: cap }, (_, i) => lSlot(L.pack[i], 'p:' + i, LG.sel === 'p:' + i)).join('');
  const bagG = pet ? Array.from({ length: bs }, (_, i) => lSlot(bag[i], 'b:' + i, LG.sel === 'b:' + i)).join('') : '';
  // Ausrüstung: im Hochformat oben links, im Querformat rechts über den Details (sonst rutscht der Rucksack aus dem Bild)
  const gearBox = cls => `<div class="box ${cls}"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${gear}</div></div>`;
  let side = `<div class="side">${gearBox('lwd')}<p class="sub">${_t('Tippe etwas an: anlegen, in die Begleiter-Tasche legen oder wegwerfen.')}</p></div>`;
  if (s) {
    const e = s.e, it = e.t === 'item' ? e.it : null, petFree = pet && bag.length < bs, packFree = L.pack.length < cap;
    let acts = '';
    if (s.where !== 'g' && it && canEquip(it)) acts += `<button class="btn sm" data-act="l_eq">${_t('Anlegen')}</button>`;
    if (s.where === 'p' && pet) acts += `<button class="btn ${petFree ? '' : 'alt '}sm" data-act="l_tobag" ${petFree ? '' : 'disabled'}>${petFree ? _t('In die Begleiter-Tasche') : _t('Tasche voll')}</button>`;
    if (s.where === 'b') acts += `<button class="btn alt sm" data-act="l_topack" ${packFree ? '' : 'disabled'}>${_t('In den Rucksack')}</button>`;
    if (s.where !== 'g' && e.t !== 'gold') acts += `<button class="btn ${LG.arm === LG.sel ? 'red' : 'alt'} sm" data-act="l_drop">${LG.arm === LG.sel ? _t('Wirklich wegwerfen?') : _t('Wegwerfen')}</button>`;
    const val = `<p class="sub" style="margin:4px 0">${_t('Wert: {n} Gold', { n: fmt(lVal(e)) })}${s.where === 'b' ? ' · <b style="color:var(--moss)">' + _t('sicher in der Tasche') + '</b>' : s.where === 'g' ? ' · <b style="color:var(--blood)">' + _t('geht beim Tod verloren') + '</b>' : ''}</p>`;
    side = `<div class="side sheet">${gearBox('lwd lgmini')}<button class="btn alt sm sheetx" data-act="l_sel" data-id="" aria-label="${_t('Schließen')}"><span class="x">×</span></button>${it ? itemDetail(it, acts) + (s.where !== 'g' ? compareHTML(it) : '') : `<div class="detail"><div style="display:flex;gap:10px;align-items:center"><div class="ic big" style="box-shadow:inset 0 0 0 2px ${lCol(e)}"><img src="${lIcon(e)}" alt=""></div><div class="nm" style="color:${lCol(e)}">${esc(lName(e))}${lCount(e) > 1 ? ' ×' + lCount(e) : ''}</div></div><div class="acts" style="justify-content:flex-start;margin-top:8px">${acts}</div></div>`}${val}</div>`;
  }
  const petBox = pet ? `<div class="box" style="margin-top:10px;box-shadow:inset 0 0 0 2px var(--moss)"><div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><img class="px" src="${lPetIcon(pet)}" alt="" style="width:32px;height:32px;object-fit:contain"><div><h3 style="margin:0">${_t('BEGLEITER-TASCHE {n}/{max}', { n: bag.length, max: bs })}</h3><div class="sub" style="margin:2px 0 0;font-size:16px">${_t('{name} bringt das heim – auch wenn du fällst.', { name: esc(lPetName(pet)) })}</div></div></div><div class="grid">${bagG || `<p class="sub">${_t('Keine Plätze.')}</p>`}</div></div>`
    : `<div class="box" style="margin-top:10px"><p class="sub" style="margin:0">${lPetApi() ? _t('Kein Begleiter dabei: Stirbst du, ist alles verloren.') : _t('Ohne Begleiter-Tasche: Stirbst du, ist alles verloren.')}</p></div>`;
  showOverlay(`${lHead(_t('RUCKSACK {n}/{max}', { n: L.pack.length, max: cap }), 'l_resume', `<span class="pill dim">${_t('{n} G', { n: fmt(lSum(L.pack)) })}</span>`)}
  <div class="split"><div>${gearBox('lnw')}
  <div class="box lpk"><h3 style="margin-top:0;line-height:1.6">${_t('Rucksack').toLocaleUpperCase(LOCALE)} <span style="font-family:var(--f-body);font-size:17px;color:#ff8a7a">${_t('geht beim Tod verloren')}</span></h3><div class="grid">${packG}</div><div class="acts" style="justify-content:flex-start;margin-top:8px">${lJunk().length ? `<button class="btn ${LG.arm === 'junk' ? 'red' : 'alt'} sm" data-act="l_junk">${LG.arm === 'junk' ? _t('Wirklich {n} wegwerfen?', { n: lJunk().length }) : _t('Plunder wegwerfen ({n})', { n: lJunk().length })}</button>` : ''}${L.scrolls ? `<button class="btn alt sm" data-act="l_scroll">${_t('Rückkehrrolle lesen ({n})', { n: L.scrolls })}</button>` : ''}</div></div>${petBox}</div>${side}</div>`, true);
}
// Plunder: gewöhnliche Gegenstände, die schlechter sind als das Angelegte, und einfache Materialien
function lJunk() { const low = MATORDER.slice(0, 4); return LW.pack.filter(e => (e.t === 'item' && e.it.rar === 0 && (!canEquip(e.it) || !P.gear[e.it.slot] || itemScore(e.it) <= itemScore(P.gear[e.it.slot]))) || (e.t === 'mat' && low.includes(e.k))); }
ON.l_junk = () => { if (LG.arm !== 'junk') { LG.arm = 'junk'; lInv(); return; } const j = new Set(lJunk()); LW.pack = LW.pack.filter(e => !j.has(e)); LG.arm = null; LG.sel = null; sfx('wood'); toast(_t('{n} Dinge weggeworfen', { n: j.size }), '#a8997e'); lInv(); };
function lMoveSel(to) {
  const s = lGetSel(LG.sel); if (!s) return;
  const L = LW, bag = L.pet ? lBag(L.pet) : null, src = s.where === 'p' ? L.pack : bag;
  if (to === 'b') { if (!bag || !lAdd(bag, s.e, L.petBag)) { sfx('deny'); return; } }
  else if (!lAdd(L.pack, s.e, lCap())) { sfx('deny'); return; }
  src.splice(s.i, 1); LG.sel = null; sfx('click'); persist();
}
ON.l_sel = id => { LG.sel = id && id !== LG.sel ? id : null; LG.arm = null; sfx('click'); lInv(); }; // nochmal tippen = abwählen
ON.l_resume = () => lResume();
ON.l_inv = () => { LG.sel = null; LG.arm = null; lInv(); };
ON.l_map = () => lMapScreen();
ON.l_tobag = () => { lMoveSel('b'); lInv(); };
ON.l_topack = () => { lMoveSel('p'); lInv(); };
ON.l_eq = () => {
  const s = lGetSel(LG.sel); if (!s || s.e.t !== 'item' || !canEquip(s.e.it)) return;
  const it = s.e.it, old = P.gear[it.slot], list = s.where === 'p' ? LW.pack : lBag(LW.pet);
  P.gear[it.slot] = it; if (old) list[s.i] = { t: 'item', it: old }; else list.splice(s.i, 1);
  computeStats(); P.hp = Math.min(P.hp, P.st.hp); updWeaponUI(); if (it.set && setCount(it.set) >= 3) stat('fullset');
  sfx('swing'); LG.sel = 'g:' + it.slot; saveChar(); persist(); lInv();
};
ON.l_drop = () => {
  const s = lGetSel(LG.sel); if (!s) return;
  if (LG.arm !== LG.sel && (s.e.t !== 'item' || s.e.it.rar >= 2 || s.e.t === 'egg')) { LG.arm = LG.sel; lInv(); return; }
  const list = s.where === 'p' ? LW.pack : lBag(LW.pet); list.splice(s.i, 1);
  const ox = P.x + P.face * 10; lDrop(ox, P.y + 4, s.e, .4); for (const c of pickups) if (Math.hypot(c.x - ox, c.y - P.y - 4) < 4 && c.t === 0) c.t = -2;
  LG.sel = null; LG.arm = null; sfx('wood'); persist(); lInv();
};
ON.l_scroll = () => { if (!LW.scrolls) return; LW.scrolls--; LW.exits.push(LW.add({ k: 'exit', t: 'rolle', x: P.x, y: P.y + 2, r: 0, ph: 0, open: true, solid: false })); toast(_t('Ein Rückweg öffnet sich unter deinen Füßen – bleib stehen!'), '#e8dcc0'); sfx('cast'); lResume(); };
ON.l_quit = () => { setState('menu'); showOverlay(`<div class="center"><h2>${_t('AUSFLUG ABBRECHEN?')}</h2><p class="sub">${_t('Der Rucksack bleibt in den Landen. Du behältst die Ausrüstung, mit der du aufgebrochen bist, und alles in der Begleiter-Tasche.')}</p><div class="menu"><button class="btn red" data-act="l_quitok">${_t('Ja, abbrechen')}</button><button class="btn alt" data-act="l_resume">${_t('Weiter erkunden')}</button></div></div>`); };
ON.l_quitok = () => { const r = lAbandon('quit'); toast(r.lost.length ? _t('Ausflug abgebrochen – {n} Dinge sind verloren.', { n: r.lost.length }) : _t('Ausflug abgebrochen.'), '#ff8a5a'); enterHideout(); };
ON.l_wake = () => { enterHideout(); };
ON.l_home = () => { enterHideout(); };
ON.l_tomap = () => { G = null; openMap(); };
ON.l_again = () => { enterHideout(); openStation('weltentor'); };
// Karte groß: alles Entdeckte, Legende, Aufträge
function lMapScreen() {
  if (!LW || !LW.on) return; setState('menu'); showHud(false);
  const L = LW, leg = [['#6ae08a', _t('Ausgang offen')], ['#8ab8ff', _t('Mondtor')], ['#ffd24a', _t('Schlüsseltor / Goldtruhe')], ['#e8b04a', _t('Truhe')], ['#c060ff', _t('Verflucht / Verderbnis')], ['#c8463c', _t('Lager')], ['#57c7e6', _t('Auftrag')], ['#ff4a3a', _t('Ungeheuer')], ['#ff8a3a', _t('Rivale')]];
  showOverlay(`${lHead(_t('KARTE · {n}', { n: esc(L.TT.n).toLocaleUpperCase(LOCALE) }), 'l_resume', `<span class="pill" style="background:${LDNG[L.danger].c}">${LDNG[L.danger].n} · ${lClock(L.t)}</span>`)}
  <div class="lmapw"><canvas class="lmap" id="lmapBig" width="256" height="256"></canvas><div><div class="lleg">${leg.map(([c, n]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>${lMisList(false)}</div></div>`, true);
  lMiniDraw($('lmapBig'), 256, true);
}
function lMisList(claim) {
  const L = LW; if (!L.misOn) return `<p class="sub">${_t('Kundschafterin Elwa hat Aufträge für dich – sie wartet am blauen Punkt.')}</p>`;
  return `<h3>${_t('AUFTRÄGE')}</h3>` + L.mis.map((m, i) => `<div class="lmis" style="--c:${m.paid ? 'var(--stone-hi)' : m.done ? 'var(--moss)' : '#57c7e6'}"><div class="nm">${m.paid ? '✓ ' : m.done ? '✦ ' : ''}${esc(m.txt)}</div><div class="st">${m.n > 1 ? m.c + '/' + m.n + ' · ' : ''}${_t('Belohnung: {rep} Ruf, {items}', { rep: m.rep, items: m.rew.map(e => e.t === 'key' ? _t('Schlüssel') : lName(e)).join(', ') })}</div>${claim && m.done && !m.paid ? `<button class="btn sm" data-act="l_claim" data-i="${i}" style="margin-top:6px">${_t('Belohnung nehmen')}</button>` : ''}</div>`).join('');
}
// Kundschafterin: Aufträge annehmen und abholen
function lMisScreen() {
  const L = LW; setState('menu'); showHud(false);
  if (!L.misOn) { L.misOn = true; L.mis = lMisGen(); sfx('page'); }
  lTip(4, _t('Tipp: Erfüllte Aufträge zahlen hier – oder automatisch, wenn du lebend durch einen Ausgang gehst.'));
  const M = lMeta(), r = lRank(M.rep), nx = LREP[r + 1];
  showOverlay(`${lHead(esc(LNPC.mis.n).toLocaleUpperCase(LOCALE), 'l_resume')}
  <div class="say"><img class="px" src="${iconURL(['sp', 'elff'])}" alt=""><div><b style="color:#57c7e6">${esc(LNPC.mis.n)}</b>${_t('„Der Orden braucht Augen hier draußen. Erledige, was du kannst – bezahlt wird, wenn du es mir bringst oder lebend durch ein Tor gehst.“')}</div></div>
  <div class="stats"><span style="color:#57c7e6">${_t('RUF: {n}', { n: LREP[r].n.toLocaleUpperCase(LOCALE) })}</span><span>${M.rep}${nx ? ' / ' + nx.at : ''}</span></div>${nx ? `<div class="lbar"><i style="width:${Math.round((M.rep - LREP[r].at) / (nx.at - LREP[r].at) * 100)}%"></i></div><p class="sub" style="margin-top:0">${_t('Nächster Rang: {n} – {d}', { n: nx.n, d: nx.d })}</p>` : ''}
  ${lMisList(true)}`, true);
}
ON.l_claim = (id, b, i) => {
  const m = LW.mis[i]; if (!m || !m.done || m.paid) return;
  if (m.t === 'mats' && !lPackPay('mat', m.k, m.n)) { sfx('deny'); return; }
  m.paid = true; const M = lMeta(); M.rep += m.rep; M.done++;
  const o = LW.npcs.mis; lBurst({ x: o.x + 14, y: o.y + 10 }, m.rew); sfx('ach'); toast(_t('+{n} Ruf bei den Kundschaftern', { n: m.rep }), '#57c7e6'); persist();
  lResume();
};
// Händler: Tausch, Verkauf, Kauf – bezahlt wird mit dem, was du dabei hast
function lOffers() {
  const L = LW, st = lStage(P.x, P.y), f = lPerk('rabatt'), O = [], av = MATORDER.slice(0, clamp(5 + Math.floor(st / 5), 5, MATORDER.length)), mat = av[av.length - 1 - ri(0, 1)], mat2 = av[Math.max(0, av.length - 3 - ri(0, 2))], low = av[ri(0, 2)];
  const it1 = lItem(3, 2, st + 2), v1 = lVal({ t: 'item', it: it1 });
  O.push({ give: [{ t: 'mat', k: mat, n: clamp(Math.round(v1 * .7 / LMATV[mat]), 3, 25) }], get: { t: 'item', it: it1 } });
  const it2 = lItem(2, 2.4, st + 2); O.push({ give: [{ t: 'gold', n: Math.round(lVal({ t: 'item', it: it2 }) * 1.25 * f) }], get: { t: 'item', it: it2 } });
  const egg = lEgg(1 + L.ti * .5); if (egg) O.push({ give: [{ t: 'mat', k: mat2, n: 6 + L.ti * 2 }, { t: 'mat', k: low === mat2 ? 'leder' : low, n: 8 }], get: { t: 'egg', d: egg } });
  const gk = randomGem(st + 6); O.push({ give: [{ t: 'mat', k: low, n: 6 }], get: { t: 'gem', k: gk, n: 1 } });
  return O;
}
function lGiveOk(give) { for (const g of give) { if (g.t === 'gold' ? lPackGold() < g.n : lPackHas(g.t, g.k) < g.n) return false; } return true; }
function lTradeScreen() {
  const L = LW; setState('menu'); showHud(false); if (!L.offers) L.offers = lOffers();
  const tab = LG.tab, f = lPerk('rabatt'), st = lStage(P.x, P.y), gold = lPackGold(), t_ = (k, l) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-act="l_ttab" data-id="${k}">${l}</button>`;
  let body = '';
  if (tab === 'tausch') body = L.offers.map((o, i) => `<div class="box" style="margin-bottom:6px;${o.done ? 'opacity:.45' : ''}">${landeLootHTML(o.get, o.done ? `<span class="pill dim">${_t('Getauscht')}</span>` : `<button class="btn sm" data-act="l_buyo" data-i="${i}" ${lGiveOk(o.give) ? '' : 'disabled'}>${_t('Tauschen')}</button>`)}<div class="cost">${_t('Gib:')} ${o.give.map(g => `<span class="${(g.t === 'gold' ? gold >= g.n : lPackHas(g.t, g.k) >= g.n) ? '' : 'bad'}"><img src="${lIcon(g)}" alt="">${g.t === 'gold' ? fmt(g.n) + ' ' + _t('Gold') : (lPackHas(g.t, g.k) + '/' + g.n + ' ' + lName(g))}</span>`).join('')}</div></div>`).join('');
  else if (tab === 'kauf') { const goods = [['pot', _t('Heiltrank'), Math.round((25 + st * 3) * f), ['s', 288, 336, 16, 16]], ['key', _t('Schlüssel'), Math.round((180 + st * 18) * f), ['pa', 'l_schl']], ['map', _t('Kartenstück'), Math.round((90 + st * 8) * f), ['pa', 'l_karte']], ['scroll', _t('Rückkehrrolle (Ausgang überall, doppelt so lange stehen)'), Math.round((380 + st * 30) * f), ['pa', 'l_rolle']]]; body = goods.map(([k, n, p, ic]) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(ic)}" alt=""></div><div><div class="nm">${n}</div></div><button class="btn sm" data-act="l_buyx" data-id="${k}" data-i="${p}" ${gold >= p && !(k === 'pot' && P.potions >= potMax()) && !(k === 'scroll' && L.boughtScroll) ? '' : 'disabled'}><i class="coin"></i>${fmt(p)}</button></div>`).join('') + `<p class="sub">${_t('Bezahlt wird mit dem Gold in deinem Rucksack.')}</p>`; }
  else body = L.pack.length ? L.pack.map((e, i) => e.t === 'gold' ? '' : landeLootHTML(e, `<button class="btn sm" data-act="l_sell" data-i="${i}"><i class="coin"></i>${fmt(Math.max(1, Math.round(lVal(e) * .45 / f)))}</button>`)).join('') + `<p class="sub">${_t('Das Gold kommt in den Rucksack – raustragen musst du es trotzdem.')}</p>` : `<p class="sub">${_t('Dein Rucksack ist leer.')}</p>`;
  showOverlay(`${lHead(esc(LNPC.trade.n).toLocaleUpperCase(LOCALE), 'l_resume', `<div class="gold"><img src="${iconURL(['pa', 'l_gold'])}" alt="" style="width:16px;vertical-align:-3px;image-rendering:pixelated"> ${fmt(gold)}</div>`)}
  <div class="say"><img class="px" src="${iconURL(['sp', 'dwarf'])}" alt=""><div><b style="color:#79c24e">${esc(LNPC.trade.n)}</b>${_t('„Hier draußen zahlt man mit dem, was man trägt. Zeig her, was du hast.“')}</div></div>
  <div class="tabs" role="tablist">${t_('tausch', _t('TAUSCH'))}${t_('kauf', _t('KAUFEN'))}${t_('verkauf', _t('VERKAUFEN'))}</div>${body}`, true);
}
ON.l_ttab = id => { LG.tab = id; sfx('click'); lTradeScreen(); };
ON.l_buyo = (id, b, i) => {
  const o = LW.offers[i]; if (!o || o.done || !lGiveOk(o.give)) { sfx('deny'); return; }
  if (!lPackAdd(Object.assign({}, o.get)) && !(lStack(o.get) && LW.pack.some(x => x.t === o.get.t && x.k === o.get.k))) { toast(_t('Rucksack voll!'), '#ff6a5a'); sfx('deny'); return; }
  for (const g of o.give) lPackPay(g.t, g.k, g.n); o.done = true; if (o.get.t === 'item') { o.get.it.lw = LW.id; hook('pickup', o.get.it); }
  sfx('buy'); toast(_t('Getauscht: {n}', { n: lName(o.get) }), lCol(o.get)); lTradeScreen();
};
ON.l_buyx = (id, b, p) => {
  const L = LW; if (lPackGold() < p) { sfx('deny'); return; }
  if (id === 'pot') { if (P.potions >= potMax()) return; P.potions++; }
  else if (id === 'key') { lMeta().keys++; }
  else if (id === 'map') lMapPiece();
  else if (id === 'scroll') { if (L.boughtScroll) return; L.boughtScroll = true; L.scrolls++; }
  lPackPay('gold', undefined, p); sfx('buy'); persist(); lTradeScreen();
};
ON.l_sell = (id, b, i) => {
  const e = LW.pack[i]; if (!e || e.t === 'gold') return; const g = Math.max(1, Math.round(lVal(e) * .45 / lPerk('rabatt')));
  LW.pack.splice(i, 1); lPackAdd({ t: 'gold', n: g }); sfx('coin'); lTradeScreen();
};
// Heilerin
function lHealScreen() {
  const L = LW, st = lStage(P.x, P.y), gold = lPackGold(), hp = Math.round((30 + st * 5) * lPerk('rabatt')), bl = Math.round((60 + st * 9) * lPerk('rabatt'));
  setState('menu'); showHud(false);
  showOverlay(`${lHead(esc(LNPC.heal.n).toLocaleUpperCase(LOCALE), 'l_resume', `<div class="gold"><img src="${iconURL(['pa', 'l_gold'])}" alt="" style="width:16px;vertical-align:-3px;image-rendering:pixelated"> ${fmt(gold)}</div>`)}
  <div class="say"><img class="px" src="${iconURL(['sp', 'wizf'])}" alt=""><div><b style="color:#f786a0">${esc(LNPC.heal.n)}</b>${_t('„Setz dich ans Feuer. Die Lande nehmen viel – ein bisschen gebe ich zurück.“')}</div></div>
  <p class="sub">${_t('LP {hp}/{max} · Tränke {n}/{m}', { hp: Math.ceil(P.hp), max: P.st.hp, n: P.potions, m: potMax() })}</p>
  <div class="menu"><button class="btn" data-act="l_heal" ${P.hp < P.st.hp && (L.healFree || gold >= hp) ? '' : 'disabled'}>${L.healFree ? _t('Wunden versorgen (einmal frei)') : _t('Wunden versorgen ({n} Gold)', { n: hp })}</button>
  <button class="btn alt" data-act="l_bless" data-i="${bl}" ${gold >= bl && L.buffT <= L.t ? '' : 'disabled'}>${L.buffT > L.t ? _t('Kräutersegen wirkt noch') : _t('Kräutersegen: 2 Minuten Regeneration ({n} Gold)', { n: bl })}</button></div>`);
  LG.healCost = hp;
}
ON.l_heal = () => { const L = LW; if (!L.healFree) { if (!lPackPay('gold', undefined, LG.healCost)) { sfx('deny'); return; } } L.healFree = false; P.hp = P.st.hp; P.res = P.st.resMax; sfx('heal'); toast(_t('Vollständig geheilt'), '#79c24e'); lHealScreen(); };
ON.l_bless = (id, b, p) => { const L = LW; if (!lPackPay('gold', undefined, p)) { sfx('deny'); return; } L.buffT = L.t + 120; L.buffV = Math.max(1, P.st.hp * .012); computeStats(); sfx('heal'); toast(_t('Kräutersegen: Regeneration für 2 Minuten'), '#79c24e'); lHealScreen(); };
HOOK.stats.push(add => { if (LW && LW.on && LW.buffT > LW.t) add('regen', LW.buffV); });

/* ---------- Weltentor: Was du riskierst ---------- */
function lGate(from) {
  if (from) LG.from = from;
  setState('menu'); showHud(false);
  const M = lMeta(), top = lTopTier(), sel = clamp(M.sel, 0, top), TT = LANDE_TIER[sel], lvOk = P.lv >= TT.lv;
  const tiers = LANDE_TIER.slice(0, Math.min(LANDE_TIER.length, top + 2)).map((t, i) => { const open = lTierOpen(i), ok = open && P.lv >= t.lv; return `<button class="opt${i === sel ? ' sel' : ''}${ok ? '' : ' lock'}" data-act="l_tier" data-i="${i}" ${open ? '' : 'disabled'} style="${i === sel ? `box-shadow:inset 0 0 0 3px ${t.c}` : ''}"><span style="color:${t.c}">${esc(t.n)}</span><small>${open ? (P.lv >= t.lv ? _t('Gegnerstufe {n}', { n: t.st }) : _t('ab Level {n}', { n: t.lv })) : _t('{n}× aus {t} entkommen', { n: t.need, t: esc(LANDE_TIER[i - 1].n) })}</small></button>`; }).join('');
  const gear = ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean), gv = lSum(gear.map(it => ({ t: 'item', it })));
  const pet = lPet(), anyPet = lPetAny(), bs = pet ? lBagSize(pet) : 0;
  const petHTML = pet ? `<div class="row" style="cursor:default;box-shadow:inset 3px 0 0 var(--moss)"><div class="ic"><img src="${lPetIcon(pet)}" alt=""></div><div><div class="nm" style="color:var(--moss)">${esc(lPetName(pet))}</div><div class="st">${bs ? _t('Tasche mit {n} Plätzen – was darin liegt, überlebt deinen Tod.', { n: bs }) : _t('Hat keine Tasche.')}</div></div><span class="pill">${_t('{n} PLÄTZE', { n: bs })}</span></div>`
    : `<div class="row" style="cursor:default;box-shadow:inset 3px 0 0 var(--blood)"><div class="ic"><img src="${iconURL(['pa', 'l_ei'])}" alt=""></div><div><div class="nm">${anyPet && lPetHurt(anyPet) ? _t('{name} ist verletzt', { name: esc(lPetName(anyPet)) }) : _t('Kein Begleiter dabei')}</div><div class="st">${_t('Ohne Begleiter-Tasche ist bei deinem Tod alles verloren.')}</div></div><span></span></div>`;
  const r = lRank(M.rep), nx = LREP[r + 1];
  const box = M.box.length ? `<h3>${_t('FUNDKISTE ({n})', { n: M.box.length })}</h3><p class="sub" style="margin-top:0">${_t('Was beim letzten Mal keinen Platz mehr hatte.')}</p>${M.box.slice(0, 6).map(e => landeLootHTML(e)).join('')}<button class="btn alt sm" data-act="l_box">${_t('Alles abholen')}</button>` : '';
  const body = `<div class="ltier"><h3 style="margin-top:4px">${_t('WELTSTUFE')}</h3><div class="opts">${tiers}</div><p class="sub" style="margin-top:0">${esc(TT.d)} ${_t('Glück auf Legendär und Mythisch: ×{n}', { n: TT.luck.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) })}</p></div>
  <h3>${_t('WAS DU RISKIERST · {n} GOLD', { n: fmt(gv) })}</h3>${gear.map(it => landeLootHTML({ t: 'item', it })).join('')}
  <h3>${_t('WAS ÜBERLEBT')}</h3>${petHTML}
  <div class="lrules"><div style="--c:var(--blood)">${_t('Stirbst du, sind Ausrüstung und Rucksack verloren.')}</div><div style="--c:var(--moss)">${_t('Nur die Begleiter-Tasche kommt heim – dein Begleiter teleportiert mit dir zurück.')}</div><div style="--c:var(--gold)">${_t('Raus kommst du nur durch einen Ausgang: hineinstellen und warten.')}</div></div>
  <h3>${_t('RUF: {n}', { n: LREP[r].n.toLocaleUpperCase(LOCALE) })}</h3>${nx ? `<div class="lbar"><i style="width:${Math.round((M.rep - LREP[r].at) / (nx.at - LREP[r].at) * 100)}%"></i></div><p class="sub" style="margin-top:0">${_t('Noch {n} Ruf bis {r}: {d}', { n: nx.at - M.rep, r: nx.n, d: nx.d })}</p>` : ''}
  <div class="stats"><span>${_t('AUSFLÜGE {n}', { n: M.runs })}</span><span style="color:var(--moss)">${_t('ENTKOMMEN {n}', { n: M.ext })}</span><span style="color:var(--blood)">${_t('GEFALLEN {n}', { n: M.deaths })}</span><span style="color:var(--gold)">${_t('BESTE BEUTE {n}', { n: fmt(M.best) })}</span>${M.keys ? `<span>${_t('SCHLÜSSEL {n}', { n: M.keys })}</span>` : ''}</div>${box}
  <div class="menu foot"><button class="btn" data-act="l_go" ${lvOk && lTierOpen(sel) ? '' : 'disabled'}>${lvOk ? _t('Betreten: {n}', { n: esc(TT.n) }) : _t('Ab Level {n} – dir fehlen noch {m}', { n: TT.lv, m: TT.lv - P.lv })}</button></div>`;
  if (LG.from === 'hide' && typeof stationShell === 'function' && G && G.type === 'versteck') stationShell('weltentor', `<p class="sub" style="margin-top:0">${_t('Hinter dem Tor liegen die Verlorenen Lande: die beste Beute – aber wer dort stirbt, verliert, was er trägt.')}</p>${body}`, true);
  else showOverlay(`${lHead(_t('DIE VERLORENEN LANDE'), 'l_back')}<p class="sub" style="margin-top:0">${_t('Die beste Beute – aber wer dort stirbt, verliert, was er trägt.')}</p>${body}`, true);
}
ON.l_open = id => { lGate(id || 'map'); };
ON.l_tier = (id, b, i) => { lMeta().sel = i; persist(); sfx('click'); lGate(); };
ON.l_go = () => { const M = lMeta(); landeStart(clamp(M.sel, 0, lTopTier())); };
ON.l_back = () => { if (LG.from === 'map') showMapMore(); else if (LG.from === 'hide') backToHide(); else showTitle(); };
ON.l_box = () => { const M = lMeta(), list = M.box.splice(0), r = lDeliver(list); saveChar(); persist(); sfx('loot'); toast(_t('{n} Dinge abgeholt', { n: r.n - r.box }), '#79c24e'); lGate(); };
HOOK.mapMore.push(() => `<button class="btn" data-act="l_open" data-id="map">${_t('Verlorene Lande')}${P && P.lv < 5 ? ' · ' + _t('ab LV 5') : ''}</button>`);
// Hauptmenü mitten im Ausflug: wie Abbrechen
HOOK.titleBtns.push(() => { if (LW && LW.on && P) lAbandon('title'); return ''; });

/* ---------- Weltentor im Versteck: Station, Bild, Wächterin ---------- */
BUILD.weltentor.npc = _t('Torhüterin Ysra'); BUILD.weltentor.body = 'knightf';
SPEAKERS.ysra = { n: _t('Torhüterin Ysra'), sp: 'knightf', c: '#6ae08a' };
NPCTALK.weltentor = [[1, 'ysra', _t('Hinter dem Tor liegen die Verlorenen Lande. Wer dort fällt, kommt nackt zurück – wenn überhaupt.')], [1, 'ysra', _t('Nimm deinen Begleiter mit. Was in seiner Tasche steckt, bringt er immer heim.')], [1, 'ysra', _t('Je länger du bleibst, desto dunkler wird es. Halte immer einen Ausgang im Blick.')], [3, 'ysra', _t('Die Kundschafterin Elwa zahlt gut für Aufträge – und ihr Ruf öffnet Türen.')]];
HOOK.station.push((h, id) => { if (h || id !== 'weltentor') return h; lGate('hide'); return true; });
HOOK.drawStation.push((o, x, y, r, lv) => {
  if (o.id !== 'weltentor') return;
  const f = Math.floor(T * 6);
  r(-15, -34, 6, 35, '#4a4652'); r(9, -34, 6, 35, '#4a4652'); r(-15, -34, 2, 35, '#6a6672'); r(9, -34, 2, 35, '#6a6672');
  r(-17, -39, 34, 6, '#5a5662'); r(-17, -39, 34, 1, '#8a8692'); r(-5, -43, 10, 4, '#5a5662'); r(-1, -42, 2, 2, '#6ae08a');
  for (let i = 0; i < 4; i++) { const on = (f + i) % 4 === 0; r(-13, -29 + i * 7, 2, 3, on ? '#c8ffd8' : '#6ae08a'); r(11, -26 + i * 7, 2, 3, on ? '#c8ffd8' : '#6ae08a'); }
  ctx.globalAlpha = .9; drawFxFrame('ring', Math.floor(T * 12) % 14, x, y - 17, .55, 0, false, tintedFx('ring', '#6ae08a')); ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(90,220,140,${.22 + .12 * Math.sin(T * 3)})`; ctx.fillRect(x - 9, y - 32, 18, 32);
  r(-18, -1, 36, 3, '#3a3440'); r(-16, -2, 32, 1, '#5a5662');
  addLight(x, y - 16, 46, .9); if (Math.random() < .25) part(o.x + rnd(-8, 8), o.y, rnd(0, 26), 0, 0, rnd(10, 30), Math.random() < .5 ? '#6ae08a' : '#c8ffd8', .7, 1, -8, 1);
});
HOOK.artIcon.push((name, b) => {
  switch (name) {
    case 'tor': b.rect(2, 3, 3, 12, '#5a5662'); b.rect(11, 3, 3, 12, '#5a5662'); b.rect(1, 1, 14, 3, '#6a6672'); b.rect(2, 3, 1, 12, '#8a8692'); b.disc(8, 9, 3.5, '#2e8a52'); b.disc(8, 9, 2.2, '#6ae08a'); b.set(8, 9, '#e0ffe8'); b.set(3, 6, '#6ae08a'); b.set(12, 9, '#6ae08a'); break;
    case 'l_pack': b.rect(4, 4, 8, 10, '#8a5a32'); b.rect(3, 6, 10, 7, '#8a5a32'); b.rect(4, 4, 8, 2, '#b07a48'); b.rect(6, 2, 4, 3, '#5e3a1e'); b.rect(7, 8, 2, 2, '#e8b04a'); b.rect(3, 12, 10, 1, '#5e3a1e'); break;
    case 'l_gold': b.disc(5, 11, 3.5, '#9c6a24'); b.disc(5, 11, 2.6, '#ffd24a'); b.disc(11, 11, 3.5, '#9c6a24'); b.disc(11, 11, 2.6, '#e8b04a'); b.disc(8, 6, 3.5, '#9c6a24'); b.disc(8, 6, 2.6, '#ffe08a'); b.set(7, 5, '#ffffff'); break;
    case 'l_ei': b.disc(8, 9, 5, '#efe2bf'); b.disc(8, 7, 4, '#efe2bf'); b.disc(7, 7, 2, '#fff8e8'); b.set(10, 11, '#c8a87a'); b.set(6, 12, '#c8a87a'); b.set(9, 5, '#c8a87a'); break;
    case 'l_teil': b.rect(3, 6, 10, 4, '#9aa2ae'); b.rect(3, 6, 10, 1, '#d0d6de'); b.rect(6, 3, 4, 10, '#7a828e'); b.set(8, 8, '#e8b04a'); break;
    case 'l_schl': b.disc(4, 8, 3, '#e8b04a'); b.set(4, 8, null); b.rect(7, 7, 7, 2, '#e8b04a'); b.rect(11, 9, 1, 2, '#e8b04a'); b.rect(13, 9, 1, 2, '#e8b04a'); b.set(8, 7, '#ffe08a'); break;
    case 'l_karte': b.rect(3, 3, 10, 10, '#e8dcc0'); b.rect(2, 2, 2, 12, '#c8a87a'); b.rect(12, 2, 2, 12, '#c8a87a'); b.line(5, 10, 8, 6, '#c8463c'); b.line(8, 6, 11, 8, '#c8463c'); b.set(10, 8, '#1a1420'); break;
    case 'l_rolle': b.rect(3, 4, 10, 8, '#e8dcc0'); b.rect(2, 3, 2, 10, '#b89060'); b.rect(12, 3, 2, 10, '#b89060'); b.disc(8, 8, 2, '#6ae08a'); b.set(8, 8, '#ffffff'); break;
    case 'l_tausch': b.rect(2, 5, 9, 2, '#79c24e'); b.rect(9, 3, 2, 6, '#79c24e'); b.rect(5, 10, 9, 2, '#e8b04a'); b.rect(5, 8, 2, 6, '#e8b04a'); b.set(11, 6, '#79c24e'); b.set(4, 11, '#e8b04a'); break;
    case 'l_auftrag': b.rect(4, 2, 8, 12, '#e8dcc0'); b.rect(4, 2, 8, 1, '#c8a87a'); b.rect(6, 5, 4, 1, '#57c7e6'); b.rect(6, 8, 4, 1, '#8a7a6a'); b.rect(6, 11, 3, 1, '#8a7a6a'); b.rect(12, 3, 1, 4, '#57c7e6'); b.set(12, 8, '#57c7e6'); break;
    case 'l_heil': b.rect(6, 2, 4, 12, '#e8402a'); b.rect(2, 6, 12, 4, '#e8402a'); b.rect(7, 3, 1, 10, '#ff8a7a'); b.rect(3, 7, 10, 1, '#ff8a7a'); break;
  }
});

/* ---------- Kampagne: Kartenmenü-Hinweis „neu“ ---------- */
HOOK.boot.push(() => { try { if (LG.note) { toast(LG.note, '#e8b04a'); LG.note = null; } } catch (_) { } });
