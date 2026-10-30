'use strict';
/* =========================================================
   KLINGENHORT – Fraktionen & Ruf (6.3 „Aufträge & Ruf“)
   Vier Fraktionen mit Rängen, Vorteilen und einem Quartiermeister, der jede Woche andere Tauschangebote hat (Ruf-Marken + Gold):
     orden  Orden des Weltentors – Kampagne, Bosse, Bestiarium (Gesicht: Torhüterin Ysra)
     kund   Kundschafter der Lande – die Endlosen Lande. Ruf = SAVE.meta.lande.rep, Ränge und Vorteile = LREP / lPerk (js/lande.js), Gesicht: Kundschafterin Elwa
     gilde  Handelsgilde – Basar, Händler, Schmiede (Gesicht: Auktionatorin Hedda)
     wild   Hüter der Wildnis – Begleiter, Eier, Sammeln, Acker (Gesicht: Nestmutter Gunda)
   Ruf und Ruf-Marken gibt es für Aufträge (js/auftraege.js), Ruf bei den Kundschaftern auch für Elwas Aufträge in den Landen. Alles konto-weit.
   Vorteile (klein, gedeckelt) über perk(k, v) (js/core.js): buy/sell Preisfaktor bei Händler, Bodo und Basar, fee Auktionsgebühr −, stock Basar-Angebote +,
     egg Ei-Pflege hält länger ×, gather Sammelertrag +, farm Acker schneller ×; Erfahrung über HOOK.stats, Boss-Beute über HOOK.loot.
   Spielstand: SAVE.meta.ruf = { v, f: { orden|kund|gilde|wild: { rep (nicht bei kund), tok, rk (gemeldeter Rang) } }, qm: { w: Woche, b: { 'f:id': gekauft } }, tt: [Titel], t: aktiver Titel }
   Schnittstelle: FK, FKORDER, fkRep(f) · fkRank(f) · fkRanks(f) → [{ at, n, d }] · fkTok(f) · fkGain(f, ruf, marken) → [{ f, r }] neue Ränge · fkCheck(still)
     fkOffers(f) → Angebote dieser Woche · fkBuy(f, id) → { ok, e } | { err } · fkTitle() · fkPerkNow(f) → Zeilen
     Belohnungen (auch für Aufträge): rwCan(e) → Fehler | null · rwGive(e) → was es wirklich gab · rwName/rwIcon/rwCol(e) · rwChip(e)
     Eintrag: { t: 'gold'|'fate'|'mat'|'gem'|'part'|'mod'|'egg' (tier)|'stone'|'key'|'bird'|'leg'|'title'|'item', k?, n?, tier? }
   ========================================================= */

/* ---------- Fraktionen, Ränge, Vorteile ---------- */
// Vorteile je Rang (Index = Rang). Orden: Erfahrung, Edelstein / Gegenstand / Glücksmünze von Bossen · Gilde: Preise, Gebühr, Basar-Angebote · Wildnis: Ei-Pflege, Sammeln, Acker
const FK_ORDEN = { xp: [0, .02, .02, .04, .04, .06, .06, .08], gem: [0, 0, 1, 1, 1, 1, 1, 1], item: [0, 0, 0, 0, .25, .25, .5, 1], fate: [0, 0, 0, 0, 0, 0, 1, 1] };
const FK_GILDE = { buy: [1, .97, .97, .97, .94, .94, .9], sell: [1, 1, 1.04, 1.04, 1.07, 1.07, 1.1], fee: [0, 0, 0, .01, .01, .02, .02], stock: [0, 0, 0, 1, 1, 2, 2] };
const FK_WILD = { egg: [1, 1.1, 1.1, 1.1, 1.25, 1.25, 1.4], gather: [0, 0, .1, .1, .2, .2, .3], farm: [1, 1, 1, 1.1, 1.1, 1.25, 1.35] };
const FK = {
  orden: {
    n: _t('Orden des Weltentors'), s: _t('Kampagne, Bosse und Bestiarium'), c: '#ffd24a', sp: 'knightf', who: () => _t('Torhüterin Ysra'),
    ranks: [[0, _t('Anwärter'), _t('Der Orden kennt deinen Namen noch nicht.')], [100, _t('Knappe'), _t('+2 % Erfahrung.')], [300, _t('Streiter'), _t('Bosse lassen zusätzlich einen Edelstein fallen.')],
      [700, _t('Torwächter'), _t('+4 % Erfahrung.')], [1400, _t('Ordensritter'), _t('Bosse: 25 % Chance auf einen zusätzlichen Gegenstand (Selten oder besser).')], [2600, _t('Hauptmann des Tores'), _t('+6 % Erfahrung.')],
      [4500, _t('Großmeister'), _t('Bosse: 50 % Chance auf einen zusätzlichen Gegenstand, dazu je Boss eine Glücksmünze.')], [7500, _t('Legende des Ordens'), _t('+8 % Erfahrung, jeder Boss lässt einen zusätzlichen Gegenstand fallen.')]],
    say: [_t('Der Orden hütet das Tor – und alles, was hindurchwill. Zeig uns, dass du kämpfen kannst.'), _t('Jeder Boss, der fällt, ist ein Schatten weniger über Klingenhort.'), _t('Ein Knappe zählt Gegner. Ein Ritter zählt Narben.')]
  },
  kund: {
    n: _t('Kundschafter der Lande'), s: _t('Die Endlosen Lande: Ausflüge, Leuchtfeuer, Artefakte'), c: '#57c7e6', sp: 'elff', who: () => typeof LNPC !== 'undefined' ? LNPC.mis.n : _t('Kundschafterin Elwa'), lande: 1,
    say: [_t('Wer die Lande kennt, überlebt sie. Wer sie nicht kennt, füllt unsere Karten mit Kreuzen.'), _t('Bring mir Beute, Karten und Geschichten – in dieser Reihenfolge.'), _t('Ein Leuchtfeuer mehr da draußen ist ein Grab weniger.')]
  },
  gilde: {
    n: _t('Handelsgilde'), s: _t('Basar, Händler und Schmiede'), c: '#ffb03a', sp: 'dwarff', who: () => _t('Auktionatorin Hedda'),
    ranks: [[0, _t('Gast der Gilde'), _t('Hedda kennt dich vom Sehen.')], [120, _t('Lehrling'), _t('Händler, Händler Bodo und Basar-Angebote 3 % günstiger.')], [350, _t('Geselle'), _t('Verkaufen bringt 4 % mehr Gold.')],
      [800, _t('Handelspartner'), _t('Auktionsgebühr einen Prozentpunkt niedriger, ein Basar-Angebot mehr.')], [1600, _t('Zunftmeister'), _t('Einkauf 6 % günstiger, Verkauf bringt 7 % mehr.')],
      [3000, _t('Gildenrat'), _t('Auktionsgebühr zwei Prozentpunkte niedriger, zwei Basar-Angebote mehr.')], [5000, _t('Ehrenmitglied'), _t('Einkauf 10 % günstiger, Verkauf bringt 10 % mehr.')]],
    say: [_t('Die Gilde vergisst nie, wer ehrlich handelt. Und wer nicht.'), _t('Gold, das liegen bleibt, ist faules Gold. Lass es arbeiten!'), _t('Borin schmiedet, ich verkaufe – und du bringst uns beiden Arbeit.')]
  },
  wild: {
    n: _t('Hüter der Wildnis'), s: _t('Begleiter, Eier, Sammeln und Acker'), c: '#79c24e', sp: 'lizardf', who: () => _t('Nestmutter Gunda'),
    ranks: [[0, _t('Wanderer'), _t('Die Tiere beäugen dich noch misstrauisch.')], [100, _t('Spurenleser'), _t('Wärme, Futter und Zuwendung halten bei Eiern 10 % länger.')], [300, _t('Pfleger'), _t('+10 % Ertrag beim Sammeln (Bäume, Felsen, Büsche, Nester).')],
      [700, _t('Wildhüter'), _t('Der Acker wächst 10 % schneller.')], [1400, _t('Tierfreund'), _t('Ei-Pflege hält 25 % länger, +20 % Sammelertrag.')], [2600, _t('Waldläufer'), _t('Der Acker wächst 25 % schneller.')],
      [4500, _t('Stimme der Wildnis'), _t('Ei-Pflege hält 40 % länger, +30 % Sammelertrag, Acker 35 % schneller.')]],
    say: [_t('Jedes Ei, das du wärmst, jede Pflanze, die du erntest – die Wildnis merkt sich das.'), _t('Wer Bäume fällt, soll auch Samen säen. So halten wir es.'), _t('Ein Begleiter ist kein Werkzeug, Kind. Er ist Familie.')]
  }
};
const FKORDER = ['orden', 'kund', 'gilde', 'wild'];
// Titel vom Quartiermeister (höchste Ränge), erscheinen am Helden im Charakter-Bildschirm
const FK_TITLES = { orden: _t('Schild des Weltentors'), kund: _t('Pfadfinder der Lande'), gilde: _t('Freund der Gilde'), wild: _t('Freund aller Tiere') };

/* ---------- Spielstand ---------- */
const fkM = () => SAVE && SAVE.meta && SAVE.meta.ruf && SAVE.meta.ruf.f ? SAVE.meta.ruf : null;
const fkNum = (v, max) => clamp(Math.floor(+v) || 0, 0, max);
function fkDef() { const f = {}; for (const k of FKORDER) f[k] = k === 'kund' ? { tok: 0, rk: 0 } : { rep: 0, tok: 0, rk: 0 }; return { v: 1, f, qm: { w: 0, b: {} }, tt: [], t: '' }; }
// Alte Spielstände: Rang bei den Kundschaftern gilt als schon gemeldet (kein Banner für längst erreichte Ränge)
function fkFix(d, m) {
  const o = fkDef(), old = !d || typeof d !== 'object';
  if (!old && d.f && typeof d.f === 'object') for (const k of FKORDER) { const x = d.f[k]; if (!x || typeof x !== 'object') continue; if (k !== 'kund') o.f[k].rep = fkNum(x.rep, 1e7); o.f[k].tok = fkNum(x.tok, 99999); o.f[k].rk = fkNum(x.rk, 9); }
  if (old && m && m.lande && typeof lRank === 'function') o.f.kund.rk = lRank(m.lande.rep || 0);
  if (!old && d.qm && typeof d.qm === 'object') { o.qm.w = fkNum(d.qm.w, 1e7); if (d.qm.b && typeof d.qm.b === 'object') for (const k in d.qm.b) if (/^[a-z]{3,6}:[a-z0-9]{2,12}$/.test(k)) o.qm.b[k] = fkNum(d.qm.b[k], 99); }
  if (!old && Array.isArray(d.tt)) o.tt = [...new Set(d.tt.filter(t => FK_TITLES[t]))];
  if (!old && o.tt.includes(d.t)) o.t = d.t;
  return o;
}
HOOK.meta.push(m => { try { m.ruf = fkFix(m.ruf, m); } catch (e) { console.error('Ruf (meta):', e); m.ruf = fkDef(); } });

/* ---------- Ruf, Rang, Marken ---------- */
function fkRep(f) { if (f === 'kund') return SAVE && SAVE.meta.lande ? SAVE.meta.lande.rep || 0 : 0; const M = fkM(); return M && M.f[f] ? M.f[f].rep : 0; }
const FKR = {};
function fkRanks(f) { return FKR[f] || (FKR[f] = f === 'kund' ? LREP.map(x => ({ at: x.at, n: x.n, d: x.d })) : FK[f].ranks.map(([at, n, d]) => ({ at, n, d }))); }
function fkRank(f) { const R = fkRanks(f), v = fkRep(f); let r = 0; for (let i = 0; i < R.length; i++) if (v >= R[i].at) r = i; return r; }
function fkTok(f) { const M = fkM(); return M && M.f[f] ? M.f[f].tok : 0; }
// Fortschritt bis zum nächsten Rang: { r, cur, nx (Ruf für den nächsten Rang oder null), p 0–1 }
function fkProg(f) { const R = fkRanks(f), r = fkRank(f), v = fkRep(f), nx = R[r + 1]; return { r, v, nx: nx ? nx.at : null, p: nx ? clamp((v - R[r].at) / (nx.at - R[r].at), 0, 1) : 1 }; }
// Ruf und Marken gutschreiben → neu erreichte Ränge [{ f, r }] (gemeldet von der Belohnungs-Anzeige; still = ohne Meldung)
function fkGain(f, rep, tok, still) {
  const M = fkM(); if (!M || !FK[f]) return [];
  rep = Math.max(0, Math.round(+rep || 0)); tok = Math.max(0, Math.round(+tok || 0));
  if (f === 'kund') { if (SAVE.meta.lande) SAVE.meta.lande.rep += rep; } else M.f[f].rep = Math.min(1e7, M.f[f].rep + rep);
  M.f[f].tok = Math.min(99999, M.f[f].tok + tok);
  return fkCheck(still);
}
// Rangaufstiege feststellen (einmal je Rang) – auch für Ruf aus den Landen (Elwa) – und melden
function fkCheck(still) {
  const M = fkM(), up = []; if (!M) return up;
  for (const f of FKORDER) { const r = fkRank(f), X = M.f[f]; if (r > X.rk) { for (let i = X.rk + 1; i <= r; i++) up.push({ f, r: i }); X.rk = r; } }
  if (!up.length) return up;
  if (P && P.st) computeStats(); persist();
  if (!still) for (const u of up) {
    const R = fkRanks(u.f)[u.r], t = _t('Neuer Rang bei {fk}: {rank}!', { fk: FK[u.f].n, rank: R.n }) + ' ' + R.d;
    if (state === 'play') banner(_t('NEUER RANG'), FK[u.f].n + ': ' + R.n);
    if (typeof mkToastQ === 'function') mkToastQ({ txt: t, c: FK[u.f].c, s: 'lvl' }); else { toast(t, FK[u.f].c); sfx('lvl'); }
  }
  return up;
}
// Gilt jetzt (Zusammenfassung der Vorteile)
function fkPerkNow(f) {
  const r = fkRank(f), L = [], pc = v => Math.round(v * 100);
  if (f === 'orden') { if (FK_ORDEN.xp[r]) L.push(_t('+{n} % Erfahrung', { n: pc(FK_ORDEN.xp[r]) })); if (FK_ORDEN.gem[r]) L.push(_t('Bosse: zusätzlicher Edelstein')); if (FK_ORDEN.item[r]) L.push(_t('Bosse: {n} % Chance auf zusätzlichen Gegenstand', { n: pc(FK_ORDEN.item[r]) })); if (FK_ORDEN.fate[r]) L.push(_t('Bosse: +1 Glücksmünze')); }
  else if (f === 'gilde') { if (FK_GILDE.buy[r] < 1) L.push(_t('Einkauf {n} % günstiger', { n: pc(1 - FK_GILDE.buy[r]) })); if (FK_GILDE.sell[r] > 1) L.push(_t('Verkauf +{n} %', { n: pc(FK_GILDE.sell[r] - 1) })); if (FK_GILDE.fee[r]) L.push(_t('Auktionsgebühr −{n} Prozentpunkte', { n: pc(FK_GILDE.fee[r]) })); if (FK_GILDE.stock[r]) L.push(_t('+{n} Basar-Angebote', { n: FK_GILDE.stock[r] })); }
  else if (f === 'wild') { if (FK_WILD.egg[r] > 1) L.push(_t('Ei-Pflege hält {n} % länger', { n: pc(FK_WILD.egg[r] - 1) })); if (FK_WILD.gather[r]) L.push(_t('+{n} % Sammelertrag', { n: pc(FK_WILD.gather[r]) })); if (FK_WILD.farm[r] > 1) L.push(_t('Acker {n} % schneller', { n: pc(FK_WILD.farm[r] - 1) })); }
  else for (let i = 1; i <= r; i++) L.push(fkRanks(f)[i].d);
  return L;
}

/* ---------- Vorteile wirken ---------- */
HOOK.perk.push((v, k) => {
  if (!fkM()) return v;
  switch (k) {
    case 'buy': return v * FK_GILDE.buy[fkRank('gilde')];
    case 'sell': return v * FK_GILDE.sell[fkRank('gilde')];
    case 'fee': return v + FK_GILDE.fee[fkRank('gilde')];
    case 'stock': return v + FK_GILDE.stock[fkRank('gilde')];
    case 'egg': return v * FK_WILD.egg[fkRank('wild')];
    case 'gather': return v + FK_WILD.gather[fkRank('wild')];
    case 'farm': return v * FK_WILD.farm[fkRank('wild')];
  }
  return v;
});
HOOK.stats.push(add => { if (!fkM()) return; const x = FK_ORDEN.xp[fkRank('orden')]; if (x) add('xp', x); });
// Bosse (Kampagne und Lande, nicht im Übungskampf): Edelstein, Gegenstand, Glücksmünze je nach Rang im Orden
HOOK.loot.push((e, lm) => {
  if (!e || !e.boss || e.bPractice || !fkM() || !P || (typeof bPrac === 'function' && bPrac())) return;
  const r = fkRank('orden');
  if (FK_ORDEN.gem[r]) dropGem(e.x - 8, e.y, randomGem(stageNum() + 6));
  if (FK_ORDEN.item[r] && Math.random() < FK_ORDEN.item[r]) dropLoot(e.x + 12, e.y + 4, 2, .02);
  if (FK_ORDEN.fate[r]) gainFate(1, true);
});
// Ruf aus den Landen (Elwa, Entkommen): Rangaufstieg melden
HOOK.stat.push(k => { if (k === 'landeExt' || k === 'landeMis') setTimeout(() => fkCheck(), 600); });
HOOK.boot.push(() => { try { fkCheck(true); } catch (e) { console.error('Ruf (Start):', e); } });

/* ---------- Belohnungen: geben, benennen, zeigen ---------- */
function rwCan(e) {
  if (!P) return 'hero';
  if (e.t === 'egg' && (typeof eggFree !== 'function' || eggFree() <= 0)) return 'nest';
  if (e.t === 'leg' && !roomFor()) return 'full';
  if (e.t === 'bird' && (typeof birdCount !== 'function' || birdCount(e.k) >= BIRD_MAX)) return 'birds';
  if (e.t === 'title' && fkM() && fkM().tt.includes(e.k)) return 'have';
  if ((e.t === 'stone' || e.t === 'key') && !(SAVE.meta.lande)) return 'lande';
  return null;
}
// → was es wirklich gab (Ei mit Art, Gegenstand) – volles Brutnest: Gunda zahlt Gold
function rwGive(e) {
  switch (e.t) {
    case 'gold': P.gold += e.n; return e;
    case 'fate': gainFate(e.n); return e;
    case 'mat': gainMat(e.k, e.n); return e;
    case 'gem': P.gems[e.k] = (P.gems[e.k] || 0) + e.n; return e;
    case 'part': if (!P.parts) P.parts = {}; P.parts[e.k] = (P.parts[e.k] || 0) + e.n; return e;
    case 'mod': if (typeof modGive === 'function' && modGive(e.k, e.n)) return e; break;
    case 'egg': { const g = typeof eggGive === 'function' ? eggGive(null, true, { tier: e.tier }) : null; if (g) return Object.assign({}, e, { sp: g.sp }); const n = (typeof EGG_GOLD !== 'undefined' ? EGG_GOLD[e.tier] || 50 : 50) * 3; P.gold += n; return { t: 'gold', n }; }
    case 'stone': { const M = SAVE.meta.lande; M.stones = Math.min(99, (M.stones || 0) + e.n); return e; }
    case 'key': { const M = SAVE.meta.lande; M.keys = Math.min(99, (M.keys || 0) + e.n); return e; }
    case 'bird': if (typeof birdGive === 'function' && birdGive(e.k, e.n)) return e; break;
    case 'leg': { const st = Math.max(stageNum(), P.lv), it = randomItem(st, 4); if (!itemPut(it)) addToBag(it); if (it.rar === 4) stat('legs'); return { t: 'item', it }; }
    case 'title': { const M = fkM(); if (M && !M.tt.includes(e.k)) M.tt.push(e.k); if (M && !M.t) M.t = e.k; return e; }
  }
  return null;
}
const rwMk = e => e && ['mat', 'gem', 'part', 'mod', 'item'].includes(e.t) && typeof mkName === 'function';
function rwName(e) {
  switch (e.t) {
    case 'gold': return _t('{n} Gold', { n: fmt(e.n) });
    case 'fate': return e.n === 1 ? _t('1 Glücksmünze') : _t('{n} Glücksmünzen', { n: e.n });
    case 'egg': return PET_TIERS[e.tier].egg;
    case 'stone': return e.n > 1 ? _t('{n} Leuchtfeuersteine', { n: e.n }) : _t('Leuchtfeuerstein');
    case 'key': return e.n > 1 ? _t('{n} Schlüssel für die Lande', { n: e.n }) : _t('Schlüssel für die Lande');
    case 'bird': return (e.n > 1 ? e.n + '× ' : '') + BIRDS[e.k].n;
    case 'leg': return _t('Legendärer Gegenstand für deine Klasse');
    case 'title': return _t('Titel „{t}“', { t: FK_TITLES[e.k] });
  }
  return rwMk(e) ? mkName(e) : '?';
}
function rwIcon(e) {
  switch (e.t) {
    case 'gold': return iconURL(['pa', 'l_gold']);
    case 'fate': return iconURL(['pa', 'gmuenze']);
    case 'egg': return eggURL(e.tier, 0);
    case 'stone': return iconURL(['pa', 'l_feuer']);
    case 'key': return iconURL(['pa', 'l_schl']);
    case 'bird': return iconURL(['pa', 'v_' + e.k]);
    case 'leg': return iconURL(['pa', 'truhe']);
    case 'title': return iconURL(['pa', 'fk_titel']);
  }
  return rwMk(e) ? mkIcon(e) : iconURL(['pa', 'muenze']);
}
function rwCol(e) {
  switch (e.t) {
    case 'gold': return '#e8b04a'; case 'fate': return '#ffd24a'; case 'egg': return PET_TIERS[e.tier].c; case 'stone': return '#ff8a3a'; case 'key': return '#e8b04a';
    case 'bird': return BIRDS[e.k].c; case 'leg': return RAR[4].c; case 'title': return '#ffd24a';
  }
  return rwMk(e) ? mkCol(e) : '#efe2bf';
}
// kurzes Kärtchen in Listen: Bild + Menge/Name
function rwChip(e) {
  const n = e.t === 'gold' ? fmt(e.n) : ['fate', 'mat', 'gem', 'part', 'stone', 'key', 'bird'].includes(e.t) ? '×' + e.n : e.t === 'mod' ? (typeof modParse === 'function' && modParse(e.k) ? ROMAN[modParse(e.k).t] : '') : '';
  return `<span class="rwc" style="--c:${rwCol(e)}" title="${esc(rwName(e))}"><img src="${rwIcon(e)}" alt="${esc(rwName(e))}">${n}</span>`;
}
function rwRow(e, i) { const c = rwCol(e); return `<div class="row rwrow" style="cursor:default;animation-delay:${Math.min(i || 0, 12) * 110}ms"><div class="ic" style="box-shadow:inset 0 0 0 2px ${c}"><img src="${e.t === 'item' ? itemIconURL(e.it) : rwIcon(e)}" alt=""></div><div><div class="nm" style="color:${c}">${esc(e.t === 'item' ? itemName(e.it) : rwName(e))}</div>${e.t === 'item' ? `<div class="st">${esc(RAR[e.it.rar].n + ' · ' + MAT[e.it.tier].n)}</div>` : e.t === 'egg' ? `<div class="st">${_t('liegt im Brutnest')}</div>` : ''}</div><span></span></div>`; }

/* ---------- Quartiermeister: Tauschangebote der Woche ---------- */
const fkPick = (R, a) => a[Math.floor(R() * a.length)];
function fkLv() { return typeof mkLv === 'function' ? mkLv() : P ? P.lv : 1; }
function fkPartE(R, lv, plus) { const t = fkPick(R, PARTORDER), g = clamp(1 + Math.floor(lv / 12) + (plus || 0), 1, 7), k = pkey(t, g, PART[t].el ? fkPick(R, ELORDER) : null); return { t: 'part', k, n: 1 }; }
function fkModE(R, lv, deep) { return { t: 'mod', k: modRoll(clamp(lv / 70 + deep, .05, .7), 3, R), n: 1 }; }
function fkMatE(R, lv, f) { const band = lv < 12 ? ['erz', 'leder', 'knochen', 'holz', 'stein'] : lv < 28 ? ['kristall', 'horn', 'mithril', 'eisenholz', 'marmor'] : ['adamant', 'schuppe', 'stern', 'obsidian', 'sternholz'], k = fkPick(R, band); return { t: 'mat', k, n: clamp(Math.round((80 + lv * 25) * (f || 1) / MK_MATV[k]), 1, 40) }; }
// r = ab Rang, tok = Ruf-Marken, g = Gold (wächst mit dem Level), n = je Woche, e(R, lv) = Ware (fest für die ganze Woche)
const FKQ = {
  orden: [
    { id: 'fate', r: 0, tok: 4, g: 150, n: 2, e: () => ({ t: 'fate', n: 2 }) },
    { id: 'gem', r: 1, tok: 6, g: 300, n: 2, e: (R, lv) => ({ t: 'gem', k: fkPick(R, GEMORDER) + ':' + clamp(1 + Math.floor(lv / 16), 1, 3), n: 1 }) },
    { id: 'schuppe', r: 1, tok: 5, g: 250, n: 2, e: (R, lv) => ({ t: 'mat', k: 'schuppe', n: 2 + Math.floor(lv / 20) }) },
    { id: 'part', r: 2, tok: 8, g: 500, n: 2, e: (R, lv) => fkPartE(R, lv, 1) },
    { id: 'mod', r: 3, tok: 12, g: 800, n: 1, e: (R, lv) => fkModE(R, lv, .1) },
    { id: 'leg', r: 4, tok: 24, g: 2000, n: 1, e: () => ({ t: 'leg' }) },
    { id: 'aether', r: 5, tok: 18, g: 1500, n: 2, e: () => ({ t: 'mat', k: 'aether', n: 2 }) },
    { id: 'title', r: 7, tok: 40, g: 5000, n: 1, e: () => ({ t: 'title', k: 'orden' }) }
  ],
  kund: [
    { id: 'key', r: 1, tok: 4, g: 300, n: 2, e: () => ({ t: 'key', n: 1 }) },
    { id: 'stone', r: 1, tok: 6, g: 500, n: 1, e: () => ({ t: 'stone', n: 1 }) },
    { id: 'rabe', r: 2, tok: 6, g: 400, n: 2, e: () => ({ t: 'bird', k: 'rabe', n: 1 }) },
    { id: 'obsidian', r: 2, tok: 6, g: 400, n: 2, e: () => ({ t: 'mat', k: 'obsidian', n: 3 }) },
    { id: 'eule', r: 3, tok: 9, g: 800, n: 1, e: () => ({ t: 'bird', k: 'eule', n: 1 }) },
    { id: 'sternholz', r: 3, tok: 8, g: 600, n: 2, e: () => ({ t: 'mat', k: 'sternholz', n: 2 }) },
    { id: 'mod', r: 3, tok: 12, g: 900, n: 1, e: (R, lv) => fkModE(R, lv, .25) },
    { id: 'egg', r: 4, tok: 18, g: 1500, n: 1, e: () => ({ t: 'egg', tier: 4 }) },
    { id: 'phoenix', r: 5, tok: 16, g: 1800, n: 1, e: () => ({ t: 'bird', k: 'phoenix', n: 1 }) },
    { id: 'title', r: 5, tok: 35, g: 4000, n: 1, e: () => ({ t: 'title', k: 'kund' }) }
  ],
  gilde: [
    { id: 'mats', r: 0, tok: 3, g: 100, n: 3, e: (R, lv) => fkMatE(R, lv, 2) },
    { id: 'gem', r: 1, tok: 5, g: 300, n: 2, e: (R, lv) => ({ t: 'gem', k: fkPick(R, GEMORDER) + ':' + clamp(Math.floor(lv / 14), 0, 3), n: 2 }) },
    { id: 'part', r: 1, tok: 6, g: 400, n: 2, e: (R, lv) => fkPartE(R, lv, 0) },
    { id: 'fate', r: 2, tok: 6, g: 0, n: 2, e: () => ({ t: 'fate', n: 3 }) },
    { id: 'erz', r: 2, tok: 5, g: 300, n: 2, e: (R, lv) => ({ t: 'mat', k: lv < 20 ? 'mithril' : 'adamant', n: 4 }) },
    { id: 'mod', r: 3, tok: 10, g: 800, n: 1, e: (R, lv) => fkModE(R, lv, 0) },
    { id: 'sternholz', r: 4, tok: 10, g: 800, n: 2, e: () => ({ t: 'mat', k: 'sternholz', n: 3 }) },
    { id: 'aether', r: 5, tok: 16, g: 1500, n: 2, e: () => ({ t: 'mat', k: 'aether', n: 3 }) },
    { id: 'title', r: 6, tok: 35, g: 4000, n: 1, e: () => ({ t: 'title', k: 'gilde' }) }
  ],
  wild: [
    { id: 'samen', r: 0, tok: 2, g: 60, n: 3, e: () => ({ t: 'mat', k: 'samen', n: 8 }) },
    { id: 'egg1', r: 0, tok: 4, g: 150, n: 1, e: () => ({ t: 'egg', tier: 1 }) },
    { id: 'feder', r: 1, tok: 3, g: 100, n: 3, e: () => ({ t: 'mat', k: 'feder', n: 10 }) },
    { id: 'egg2', r: 1, tok: 7, g: 400, n: 1, e: () => ({ t: 'egg', tier: 2 }) },
    { id: 'eisenholz', r: 2, tok: 5, g: 300, n: 2, e: () => ({ t: 'mat', k: 'eisenholz', n: 6 }) },
    { id: 'egg3', r: 3, tok: 12, g: 900, n: 1, e: () => ({ t: 'egg', tier: 3 }) },
    { id: 'egg4', r: 4, tok: 20, g: 2000, n: 1, e: () => ({ t: 'egg', tier: 4 }) },
    { id: 'egg5', r: 6, tok: 35, g: 5000, n: 1, e: () => ({ t: 'egg', tier: 5 }) },
    { id: 'title', r: 6, tok: 30, g: 4000, n: 1, e: () => ({ t: 'title', k: 'wild' }) }
  ]
};
const fkWeek = () => weekNo(Date.now());
// Neue Woche: Einkäufe vergessen (die Uhr läuft nur vorwärts – zurückgestellt bleibt die Woche)
function fkQm() { const M = fkM(), w = fkWeek(); if (w > M.qm.w) { M.qm.w = w; M.qm.b = {}; } return M.qm; }
// Diese Woche: zwei Angebote bis Rang 1, drei höhere, dazu der Titel (solange du ihn nicht hast) – fest je Woche und Fraktion
function fkOffers(f) {
  const M = fkM(); if (!M || !FKQ[f]) return [];
  const Q = fkQm(), w = Q.w, R = mulberry(hashStr('qm:' + f + ':' + w)), pool = FKQ[f], lv = fkLv();
  const take = (a, n) => { a = a.slice(); const out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(R() * a.length), 1)[0]); return out; };
  const L = take(pool.filter(o => o.r <= 1 && o.id !== 'title'), 2).concat(take(pool.filter(o => o.r > 1 && o.id !== 'title'), 3));
  const T0 = pool.find(o => o.id === 'title'); if (T0 && !M.tt.includes(f)) L.push(T0);
  L.sort((a, b) => a.r - b.r || a.tok - b.tok);
  return L.map(o => ({ f, id: o.id, r: o.r, tok: o.tok, gold: Math.round(o.g * (1 + lv / 25) / 10) * 10, n: o.n, left: Math.max(0, o.n - (Q.b[f + ':' + o.id] || 0)), e: o.e(mulberry(hashStr('qe:' + f + ':' + o.id + ':' + w)), lv) }));
}
function fkBuy(f, id) {
  const M = fkM(); if (!M || !P) return { err: 'hero' };
  if (typeof landeActive === 'function' && landeActive()) return { err: 'lande' };
  const O = fkOffers(f).find(o => o.id === id); if (!O) return { err: 'gone' };
  if (fkRank(f) < O.r) return { err: 'rank' };
  if (O.left <= 0) return { err: 'sold' };
  if (fkTok(f) < O.tok) return { err: 'tok' };
  if (P.gold < O.gold) return { err: 'gold' };
  const why = rwCan(O.e); if (why) return { err: why };
  const got = rwGive(O.e); if (!got) return { err: 'gone' };
  M.f[f].tok -= O.tok; P.gold -= O.gold; const Q = fkQm(); Q.b[f + ':' + id] = (Q.b[f + ':' + id] || 0) + 1;
  stat('qmBuy'); saveChar(); persist();
  return { ok: 1, e: got };
}
function fkErr(r) {
  return { hero: _t('Wähle zuerst einen Helden.'), lande: _t('Nicht mitten in den Endlosen Landen.'), gone: _t('Das ist nicht mehr da.'), rank: _t('Dein Rang reicht dafür noch nicht.'), sold: _t('Diese Woche ausverkauft.'),
    tok: _t('Zu wenig Ruf-Marken.'), gold: _t('Zu wenig Gold.'), nest: _t('Dein Brutnest ist voll.'), full: _t('Beutel und Lager sind voll. Mach zuerst Platz.'), birds: _t('Mehr Vögel dieser Art passen nicht ins Vogelhaus.'), have: _t('Diesen Titel hast du schon.') }[r && r.err] || _t('Das hat nicht geklappt.');
}
// aktiver Titel (Charakter-Bildschirm)
function fkTitle() { const M = fkM(); return M && M.t && FK_TITLES[M.t] ? FK_TITLES[M.t] : ''; }

/* ---------- Bilder: Wappen, Ruf-Marken, Glücksmünze, Titel ---------- */
HOOK.artIcon.push((name, b) => {
  switch (name) {
    case 'fk_orden':   // Schild mit dem Ring des Weltentors
      b.rect(3, 2, 10, 8, '#c8902a'); b.rect(4, 10, 8, 2, '#c8902a'); b.rect(5, 12, 6, 1, '#c8902a'); b.rect(6, 13, 4, 1, '#c8902a'); b.rect(7, 14, 2, 1, '#c8902a');
      b.rect(4, 3, 8, 7, '#2e5a3e'); b.rect(5, 10, 6, 1, '#2e5a3e'); b.rect(6, 11, 4, 1, '#2e5a3e'); b.disc(8, 7, 2.7, '#6ae08a'); b.disc(8, 7, 1.3, '#16301e'); b.set(4, 3, '#ffe08a'); b.rect(3, 2, 10, 1, '#ffd24a'); break;
    case 'fk_kund':    // Kompass
      b.disc(8, 8, 6.5, '#2a4a6a'); b.disc(8, 8, 5.4, '#d8e8f0'); b.line(8, 3, 8, 8, '#c8342c'); b.line(8, 9, 8, 13, '#2a3a4a'); b.set(3, 8, '#2a3a4a'); b.set(13, 8, '#2a3a4a'); b.set(7, 4, '#e8584a'); b.disc(8, 8, 1, '#57c7e6'); break;
    case 'fk_gilde':   // Waage mit Münzen
      b.rect(7, 3, 2, 10, '#8a5a32'); b.rect(4, 13, 8, 2, '#6a4224'); b.rect(2, 4, 12, 1, '#e8b04a'); b.disc(8, 3, 1.2, '#ffd24a');
      b.set(2, 5, '#a8997e'); b.set(2, 6, '#a8997e'); b.set(13, 5, '#a8997e'); b.set(13, 6, '#a8997e'); b.rect(0, 7, 5, 2, '#c8902a'); b.rect(11, 7, 5, 2, '#c8902a'); b.rect(1, 6, 3, 1, '#ffd24a'); b.set(12, 6, '#ffe08a'); b.set(13, 6, '#ffd24a'); break;
    case 'fk_wild':    // Blatt mit Pfote
      b.disc(8, 7, 5.5, '#2e6a2a'); b.disc(7, 6, 4, '#79c24e'); b.line(9, 9, 12, 14, '#5e3a1e'); b.line(4, 3, 9, 9, '#c8f06a');
      b.disc(11, 11, 1.6, '#efe2bf'); b.set(9, 9, '#efe2bf'); b.set(11, 8, '#efe2bf'); b.set(13, 9, '#efe2bf'); break;
    case 'gmuenze':    // Glücksmünze
      b.disc(8, 8, 6, '#9c6a24'); b.disc(8, 8, 5, '#ffd24a'); b.disc(8, 8, 3.2, '#e8b04a'); b.rect(7, 5, 2, 6, '#fff3c0'); b.rect(5, 7, 6, 2, '#fff3c0'); b.set(5, 4, '#ffffff'); break;
    case 'fk_titel':   // Urkunde mit Siegel
      b.rect(3, 3, 10, 9, '#efe2bf'); b.rect(2, 2, 2, 11, '#c8a87a'); b.rect(12, 2, 2, 11, '#c8a87a'); b.rect(5, 5, 6, 1, '#c8463c'); b.rect(5, 7, 5, 1, '#8a7a6a'); b.rect(5, 9, 4, 1, '#8a7a6a'); b.disc(10, 12, 2, '#c8342c'); b.set(10, 12, '#ff8a7a'); break;
    default: {
      const m = /^fkm_([a-z]+)$/.exec(name); if (!m || !FK[m[1]]) return;   // Ruf-Marke: Orden am Band in der Farbe der Fraktion (anders als die runde Glücksmünze)
      const c = FK[m[1]].c; b.rect(3, 0, 4, 6, c); b.rect(9, 0, 4, 6, c); b.rect(4, 0, 1, 6, '#fff3c0'); b.rect(10, 0, 1, 6, '#fff3c0'); b.rect(6, 4, 4, 3, '#5a4020');
      b.disc(8, 10.5, 5, '#5a4020'); b.disc(8, 10.5, 4, '#e8b04a'); b.disc(8, 10.5, 2.6, c); b.set(7, 9, '#fff3c0'); b.set(8, 10, '#ffffff');
    }
  }
});
const fkIc = f => iconURL(['pa', 'fk_' + f]), fkTokIc = f => iconURL(['pa', 'fkm_' + f]);
