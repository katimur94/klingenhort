'use strict';
/* =========================================================
   KLINGENHORT – Magische Vögel & Voliere (6.2 „Sammeln & Bauen“)
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein. Vögel bringen Beute aus den Endlosen Landen sofort heim:
   Rucksack → „Vogel schicken“ → bis zu N Plätze wählen (Gegenstände und Eier aus Rucksack und Begleiter-Tasche, auf Wunsch der
   ganze Sammelbeutel als ein Platz) → Gegenstände ins Lager (voll: Beutel, dann Fundkiste am Weltentor), Eier ins Brutnest,
   Gold, Material, Edelsteine, Bauteile und Mods direkt zum Helden. Ein Vogel je Flug, nicht mitten im Kampf (lDanger, wie Abbrechen).
   Held: P.birds = { spatz, taube, rabe, eule, phoenix } (Anzahl je Art, höchstens 99).
   Herkunft: Voliere im Versteck (Station 'voliere'; Gebäude, Kosten, Bild: Teil B) aus Feder + Holz + Fasern + Gold, je Stufe eine Art mehr;
   selten aus Truhen und von Elite-Gegnern der Lande; Händler Bodo verkauft je Außenposten einzelne.
   Schnittstelle: BIRDS, BIRDORDER, birdGive(kind, n) → true/false, birdCount(kind), birdSend(kind, einträge, mitBeutel) → { ok, r, n } | { err },
     birdRoll(tiefe), birdShop(stufe, rabatt), birdBarHTML(), birdIconURL(kind, bild), voliereCost(kind), birdCraft(kind)
   ========================================================= */

const BIRDS = {
  spatz: { n: _t('Spatz'), slots: 3, lv: 1, c: '#d8a868', mats: { feder: 3, holz: 2, faser: 2 }, gold: 60, d: _t('Klein und flink – trägt 3 Dinge heim.') },
  taube: { n: _t('Taube'), slots: 5, lv: 2, c: '#a8c0e0', mats: { feder: 5, holz: 4, faser: 4 }, gold: 180, d: _t('Findet immer nach Hause – trägt 5 Dinge.') },
  rabe: { n: _t('Rabe'), slots: 7, lv: 3, c: '#9a8ad8', mats: { feder: 8, holz: 6, faser: 6 }, gold: 420, d: _t('Klug und kräftig – trägt 7 Dinge.') },
  eule: { n: _t('Eule'), slots: 9, lv: 4, c: '#e8c070', mats: { feder: 12, holz: 9, faser: 9 }, gold: 900, d: _t('Fliegt lautlos durch jede Nacht – trägt 9 Dinge.') },
  phoenix: { n: _t('Phönixfeder'), slots: 10, lv: 5, c: '#ff8a3a', mats: { feder: 20, holz: 12, faser: 12 }, gold: 2000, d: _t('Verglüht in einem Funkenregen und ersteht daheim neu – trägt 10 Dinge.') }
};
const BIRDORDER = ['spatz', 'taube', 'rabe', 'eule', 'phoenix'], BIRD_MAX = 99;
const VG = { kind: null, sel: new Set(), pouch: false, fly: [], back: null };   // Flug-Auswahl, fliegende Vögel

/* ---------- Bestand des Helden ---------- */
function birdFix(o) { const r = {}; if (o && typeof o === 'object' && !Array.isArray(o)) for (const k of BIRDORDER) { const n = Math.floor(+o[k]) || 0; if (n > 0) r[k] = Math.min(BIRD_MAX, n); } return r; }
HOOK.activate.push(H => { H.birds = birdFix(H.birds); });
function birdCount(k) { return P && P.birds && BIRDS[k] ? P.birds[k] || 0 : 0; }
function birdTotal() { return BIRDORDER.reduce((a, k) => a + birdCount(k), 0); }
function birdGive(kind, n) {
  if (!P || !BIRDS[kind]) return false; n = n == null ? 1 : Math.floor(+n) || 0; if (n <= 0) return false;
  if (!P.birds || typeof P.birds !== 'object') P.birds = {};
  const was = P.birds[kind] || 0; if (was >= BIRD_MAX) return false;
  P.birds[kind] = Math.min(BIRD_MAX, was + n); stat('birdsGot', P.birds[kind] - was); return true;
}
// Fund in Truhen und bei Elite-Gegnern: tiefer → größere Vögel
function birdRoll(dep) { const d = clamp(+dep || 0, 0, 1); return wpick({ spatz: 60, taube: 25 + d * 20, rabe: 10 + d * 30, eule: 4 + d * 25, phoenix: 1 + d * 15 }); }
// Händler Bodo: Ware im Format [id, Name, Preis, Bild] (js/lande.js, Reiter KAUFEN) – je Außenposten ein Vogel jeder Art
function birdShop(st, f) {
  const s = Math.min(+st || 0, 150), L = [['spatz', 140 + s * 6]];
  if (s >= 18) L.push(['taube', 420 + s * 14]); if (s >= 45) L.push(['rabe', 1100 + s * 30]);
  return L.map(([k, p]) => ['bird:' + k, _t('{bird} – trägt {n} Dinge heim', { bird: BIRDS[k].n, n: BIRDS[k].slots }), Math.round(p * (f || 1)), ['pa', 'v_' + k]]);
}

/* ---------- Voliere (Versteck): Züchten ---------- */
function voliereLv() { return clamp(Math.floor(hideLv('voliere')) || 0, 0, 5); }
// je Stufe über der nötigen 8 % billiger (höchstens 30 %); Material nur, was es gibt (Feder, Holz, Fasern: Teil B)
function voliereCost(kind) {
  const B = BIRDS[kind], k = clamp(1 - .08 * Math.max(0, voliereLv() - B.lv), .7, 1), mats = {};
  for (const m in B.mats) if (MATS[m]) mats[m] = Math.max(1, Math.ceil(B.mats[m] * k));
  return { mats, gold: Math.round(B.gold * k) };
}
function voliereTwin() { const lv = voliereLv(); return lv >= 5 ? .25 : lv >= 3 ? .15 : 0; }   // Brut: manchmal schlüpft ein zweiter Vogel
function birdCraft(kind) {
  const B = BIRDS[kind]; if (!B || !P) return { err: 'bird' };
  if (voliereLv() < B.lv) return { err: 'lv' };
  if (birdCount(kind) >= BIRD_MAX) return { err: 'max' };
  const c = voliereCost(kind); if (!canAfford(c.mats, c.gold)) return { err: 'poor' };
  payMats(c.mats); P.gold -= c.gold;
  const n = Math.random() < voliereTwin() ? 2 : 1; birdGive(kind, n); stat('birdsMade', n);
  return { ok: 1, n };
}
function openVoliere() {
  const lv = voliereLv(), tw = voliereTwin();
  const rows = BIRDORDER.map(k => {
    const B = BIRDS[k], ok = lv >= B.lv, c = voliereCost(k), have = birdCount(k);
    return `<div class="row vrow${ok ? '' : ' lock'}" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${B.c}"><img src="${birdIconURL(k)}" alt=""></div><div><div class="nm" style="color:${B.c}">${B.n} <span class="vslots">${_t('{n} Plätze', { n: B.slots })}</span>${have ? ` <span class="vhave">×${have}</span>` : ''}</div><div class="st">${B.d}</div>${ok ? costHTML(c.mats, c.gold) : `<div class="st" style="color:var(--parch-dim)">${_t('Ab Voliere-Stufe {lv}', { lv: B.lv })}</div>`}</div>${ok ? `<button class="btn sm" data-act="v_craft" data-id="${k}" ${canAfford(c.mats, c.gold) && have < BIRD_MAX ? '' : 'disabled'}>${_t('Züchten')}</button>` : `<span class="pill dim">🔒 ${B.lv}</span>`}</div>`;
  }).join('');
  const best = BIRDORDER.filter(k => lv >= BIRDS[k].lv).pop() || 'spatz';
  stationShell('voliere', `<div class="vhero"><i class="vfly" style="background-image:url(${birdStripURL(best)})"></i><div><b>${_t('MAGISCHE VÖGEL')}</b><p>${_t('Sie bringen Beute aus den Endlosen Landen sofort heim – sicher, auch wenn du danach fällst.')}</p></div></div>
  <ol class="vhow"><li>${_t('Hier einen Vogel züchten (oder in Truhen finden, bei Händler Bodo kaufen).')}</li><li>${_t('In den Landen: Rucksack öffnen → „Vogel schicken“.')}</li><li>${_t('Dinge antippen – Gegenstände fliegen ins Lager, Gold und Material direkt zu dir. Nicht mitten im Kampf!')}</li></ol>
  <div class="kv vown">${BIRDORDER.map(k => `<span class="pill${birdCount(k) ? '' : ' dim'}"><img src="${birdIconURL(k)}" alt="">${BIRDS[k].n} ×${birdCount(k)}</span>`).join('')}</div>
  <h3>${_t('ZÜCHTEN · VOLIERE STUFE {lv}', { lv })}</h3>${rows}
  <p class="sub">${_t('Jede Stufe über der nötigen macht das Züchten 8 % billiger (bis 30 %).')}${tw ? ' ' + _t('Brut: {p} % Chance auf einen zweiten Vogel.', { p: Math.round(tw * 100) }) : ' ' + _t('Ab Stufe 3 schlüpft manchmal ein zweiter Vogel.')}</p>`, true);
}
HOOK.station.push((h, id) => { if (h || id !== 'voliere') return h; openVoliere(); return true; });
ON.v_craft = id => {
  const r = birdCraft(id);
  if (r.ok) { sfx('craft'); setTimeout(() => birdChirp(id), 200); toast(r.n > 1 ? _t('Zwillinge! 2× {bird}', { bird: BIRDS[id].n }) : _t('{bird} gezüchtet', { bird: BIRDS[id].n }), BIRDS[id].c); saveChar(); persist(); if (typeof checkAch === 'function') checkAch(); }
  else sfx('deny');
  openVoliere();
};

/* ---------- Vogel schicken (Endlose Lande) ---------- */
// Einträge (Objekte aus Rucksack oder Begleiter-Tasche) heimschicken; mitBeutel: der ganze Sammelbeutel als ein Platz
function birdSend(kind, list, withPouch) {
  if (typeof lOn !== 'function' || !lOn()) return { err: 'off' };
  if (lDanger()) return { err: 'fight' };
  const B = BIRDS[kind]; if (!B || birdCount(kind) < 1) return { err: 'bird' };
  const L = LW, bag = L.pet && Array.isArray(L.pet.bag) ? L.pet.bag : [], ents = (list || []).filter((e, i, a) => e && a.indexOf(e) === i && (L.pack.includes(e) || bag.includes(e)));
  const pouch = withPouch ? lPouchList() : [];
  const n = ents.length + (pouch.length ? 1 : 0); if (!n) return { err: 'empty' }; if (n > B.slots) return { err: 'slots' };
  for (const e of ents) { const src = L.pack.includes(e) ? L.pack : bag; src.splice(src.indexOf(e), 1); }
  if (pouch.length) lPouchTakeAll();
  P.birds[kind]--; if (!P.birds[kind]) delete P.birds[kind];
  const r = lDeliver(ents.concat(pouch), true);
  stat('birdsSent'); saveChar(); persist();
  VG.fly.push({ k: kind, t0: T, x: P.x, y: P.y, dir: P.face || 1 });
  return { ok: 1, r, n, items: ents.length, pouch: pouch.length > 0 };
}
function birdErr(e) { return { fight: _t('Nicht mitten im Kampf! Vögel fliegen nur, wenn dich gerade nichts angreift.'), bird: _t('Du hast keinen solchen Vogel.'), empty: _t('Wähle zuerst etwas aus.'), slots: _t('So viel kann dieser Vogel nicht tragen.'), off: _t('Vögel fliegen nur in den Endlosen Landen.') }[e] || _t('Das hat nicht geklappt.'); }
// Leiste oben im Rucksack: eigene Vögel und der Knopf
function birdBarHTML() {
  if (!P) return '';
  const have = BIRDORDER.filter(k => birdCount(k)), fight = typeof lDanger === 'function' && lDanger();
  if (!have.length) return `<div class="vbar none"><img src="${birdIconURL('spatz')}" alt=""><span>${_t('Keine Vögel dabei. Die Voliere im Versteck züchtet sie, Händler Bodo verkauft manchmal einen.')}</span></div>`;
  return `<div class="vbar"><div class="vlist">${have.map(k => `<span title="${esc(BIRDS[k].n)}"><img src="${birdIconURL(k)}" alt="">×${birdCount(k)}</span>`).join('')}</div><button class="btn sm" data-act="v_open" ${fight ? 'disabled' : ''}>${fight ? _t('Im Kampf') : _t('Vogel schicken')}</button></div>`;
}
function vgList() { const L = LW, out = []; L.pack.forEach((e, i) => out.push(['p:' + i, e])); if (L.pet) (L.pet.bag || []).forEach((e, i) => out.push(['b:' + i, e])); return out; }
function vgEnt(id) { const [w, i] = String(id).split(':'), L = LW; return w === 'p' ? L.pack[+i] : w === 'b' && L.pet ? (L.pet.bag || [])[+i] : null; }
function vgUsed() { return VG.sel.size + (VG.pouch && lPouchList().length ? 1 : 0); }
function vgSlot(id, e, on, full) {
  const c = lCol(e), n = lCount(e) || (e.t === 'gold' ? fmt(e.n) : '');
  return `<button class="lslot vpick${on ? ' on' : ''}" data-act="v_pick" data-id="${id}" ${!on && full ? 'aria-disabled="true"' : ''} style="box-shadow:inset 0 0 0 2px ${c}${on ? ',0 0 0 3px #57c7e6' : ''}" aria-pressed="${on}" aria-label="${esc(lName(e))}"><img src="${lIcon(e)}" alt="">${n ? `<span class="n">${n}</span>` : ''}${on ? '<b class="vchk">✓</b>' : ''}</button>`;
}
function vgScreen() {
  if (!LW || !LW.on) return;
  setState('menu'); showHud(false);
  const have = BIRDORDER.filter(k => birdCount(k));
  if (!have.includes(VG.kind)) VG.kind = have[0] || null;
  const B = VG.kind && BIRDS[VG.kind], cap = B ? B.slots : 0, used = vgUsed(), full = used >= cap, fight = lDanger(), pouch = lPouchList(), pv = lSum(pouch);
  const L = vgList(), pack = L.filter(x => x[0][0] === 'p'), bag = L.filter(x => x[0][0] === 'b');
  for (const id of [...VG.sel]) if (!vgEnt(id)) VG.sel.delete(id);
  const tiles = BIRDORDER.map(k => { const n = birdCount(k), sel = k === VG.kind; return `<button class="vtile${sel ? ' sel' : ''}" data-act="v_kind" data-id="${k}" ${n ? '' : 'disabled'} aria-pressed="${sel}" style="--c:${BIRDS[k].c}"><img src="${birdIconURL(k)}" alt=""><b>${BIRDS[k].n}</b><small>${_t('{n} Plätze', { n: BIRDS[k].slots })}</small><em>×${n}</em></button>`; }).join('');
  const sels = [...VG.sel].map(vgEnt).filter(Boolean).concat(VG.pouch && pouch.length ? pouch : []), sv = lSum(sels);
  const where = _t('Gegenstände fliegen ins Lager (ist es voll: in den Beutel, dann in die Fundkiste am Weltentor), Eier ins Brutnest, alles andere direkt zu dir.');
  const go = !B ? _t('Kein Vogel dabei') : fight ? _t('Nicht mitten im Kampf!') : used ? _t('{bird} losschicken ({n}/{m})', { bird: B.n, n: used, m: cap }) : _t('Wähle aus, was heim soll');
  showOverlay(`${lHead(_t('VOGEL SCHICKEN'), 'v_back')}
  <div class="vsplit"><div><div class="vtiles">${tiles}</div>
  ${B ? `<div class="vstat"><div class="vmeter"><i style="width:${Math.round(used / cap * 100)}%"></i></div><span><b style="color:${B.c};font-weight:400">${B.n}</b> · ${_t('{n} von {m} Plätzen · Wert {g} G', { n: used, m: cap, g: fmt(sv) })}</span></div>` : `<p class="sub">${_t('Du hast keine Vögel dabei. Die Voliere im Versteck züchtet sie.')}</p>`}
  ${pouch.length ? `<button class="vpouch${VG.pouch ? ' on' : ''}" data-act="v_pouch" aria-pressed="${VG.pouch}" ${!VG.pouch && full ? 'aria-disabled="true"' : ''}><img src="${iconURL(['pa', 'l_beutel'])}" alt=""><i class="cb"></i><span><b>${_t('Sammelbeutel mitschicken')}</b><small>${_t('{n} Sorten · {g} Gold wert · zählt als 1 Platz', { n: pouch.length, g: fmt(pv) })}</small></span></button>` : ''}
  </div><div><div class="vsec"><h3>${_t('RUCKSACK')}</h3>${pack.length > 1 && B ? `<button class="btn alt sm" data-act="v_best">${_t('Wertvollstes wählen')}</button>` : ''}</div>
  ${pack.length ? `<div class="grid vgrid">${pack.map(([id, e]) => vgSlot(id, e, VG.sel.has(id), full)).join('')}</div>` : `<p class="sub">${_t('Der Rucksack ist leer.')}</p>`}
  ${bag.length ? `<div class="vsec"><h3>${_t('BEGLEITER-TASCHE')}</h3></div><p class="sub" style="margin-top:0">${_t('Schick Taschen-Inhalt heim, um dort Platz für Neues zu machen.')}</p><div class="grid vgrid">${bag.map(([id, e]) => vgSlot(id, e, VG.sel.has(id), full)).join('')}</div>` : ''}
  <p class="sub">${where}</p></div></div>
  <div class="foot vfoot"><button class="btn" data-act="v_go" style="width:100%;min-height:48px" ${B && used && !fight ? '' : 'disabled'}>${B ? `<img src="${birdIconURL(VG.kind)}" alt="">` : ''}${go}</button></div>`, true);
}
ON.v_open = () => { if (!LW || !LW.on) return; if (lDanger()) { toast(birdErr('fight'), '#ff6a5a'); sfx('deny'); return; } VG.sel = new Set(); VG.pouch = false; VG.kind = null; sfx('click'); vgScreen(); };
ON.v_back = () => { sfx('click'); if (typeof lInv === 'function') lInv(); };
ON.v_kind = id => { if (!birdCount(id)) return; VG.kind = id; const cap = BIRDS[id].slots; while (vgUsed() > cap) { if (VG.sel.size) VG.sel.delete([...VG.sel].pop()); else VG.pouch = false; } birdChirp(id); vgScreen(); };
ON.v_pick = id => {
  if (VG.sel.has(id)) VG.sel.delete(id);
  else { const B = BIRDS[VG.kind]; if (!B || vgUsed() >= B.slots) { sfx('deny'); toast(_t('Mehr kann {bird} nicht tragen – nimm einen größeren Vogel.', { bird: B ? B.n : '' }), '#ff8a5a'); return; } VG.sel.add(id); }
  sfx('click'); vgScreen();
};
ON.v_pouch = () => { const B = BIRDS[VG.kind]; if (!VG.pouch && (!B || vgUsed() >= B.slots)) { sfx('deny'); return; } VG.pouch = !VG.pouch; sfx('click'); vgScreen(); };
// das Wertvollste zuerst (Eier, seltene Gegenstände), der Sammelbeutel zählt mit seinem ganzen Wert
ON.v_best = () => {
  const B = BIRDS[VG.kind]; if (!B) return;
  const c = vgList().filter(x => x[0][0] === 'p').map(([id, e]) => ({ id, h: lHype(e) })), pv = lSum(lPouchList());
  if (pv > 0) c.push({ id: 'u', h: pv });
  c.sort((a, b) => b.h - a.h); VG.sel = new Set(); VG.pouch = false;
  for (const x of c.slice(0, B.slots)) if (x.id === 'u') VG.pouch = true; else VG.sel.add(x.id);
  sfx('click'); vgScreen();
};
ON.v_go = () => {
  const k = VG.kind, ents = [...VG.sel].map(vgEnt).filter(Boolean), r = birdSend(k, ents, VG.pouch);
  if (!r.ok) { toast(birdErr(r.err), '#ff6a5a'); sfx('deny'); vgScreen(); return; }
  const p = []; if (r.r.stash) p.push(_t('{n} ins Lager', { n: r.r.stash })); if (r.r.bag) p.push(_t('{n} in den Beutel', { n: r.r.bag })); if (r.r.box) p.push(_t('{n} in die Fundkiste', { n: r.r.box })); if (r.r.eggs) p.push(_t('{n} Ei(er) ins Brutnest', { n: r.r.eggs })); if (r.pouch) p.push(_t('Sammelbeutel zu dir'));
  VG.sel = new Set(); VG.pouch = false;
  lResume(); birdChirp(k); setTimeout(() => sfx('loot'), 650);
  toast(_t('{bird} fliegt heim: {list}', { bird: BIRDS[k].n, list: p.join(' · ') || _t('geliefert') }), BIRDS[k].c);
};

/* ---------- Bilder: sitzend (v_art) und fliegend (v_art_1/_2, Flügel oben/unten) ---------- */
const VPAL = {   // dunkel, Körper, Bauch, Schnabel, Akzent
  spatz: ['#5e3a1e', '#a8743e', '#ecd8b0', '#3a2a18', '#7a4a24'],
  taube: ['#5a6a8a', '#a8b8d0', '#e8eef8', '#e89a9a', '#5ac27a'],
  rabe: ['#16121e', '#3a3448', '#5a5070', '#2a2430', '#7a6ad0'],
  eule: ['#6a4a2a', '#b08a58', '#ecdcb4', '#e8b04a', '#ffd24a'],
  phoenix: ['#b8281a', '#ff6a2a', '#ffd24a', '#fff0a0', '#ff3a1a']
};
function birdPaint(k, f, b) {
  const [D, M, Lt, K, A] = VPAL[k];
  if (k === 'eule') {   // von vorn: runder Kopf, große Augen, Federohren
    if (f) { const up = f === 1; b.rect(1, up ? 3 : 8, 4, 3, D); b.rect(11, up ? 3 : 8, 4, 3, D); b.rect(3, up ? 5 : 8, 2, 3, D); b.rect(11, up ? 5 : 8, 2, 3, D); b.set(1, up ? 2 : 11, D); b.set(14, up ? 2 : 11, D); }
    b.disc(8, 10, 4.2, M); b.disc(8, 11, 2.8, Lt); b.disc(8, 6, 3.8, M); b.set(5, 2, D); b.set(5, 3, D); b.set(11, 2, D); b.set(11, 3, D);
    b.disc(6.3, 6, 1.5, A); b.disc(9.7, 6, 1.5, A); b.set(6, 6, '#120e18'); b.set(10, 6, '#120e18'); b.set(8, 8, K); b.set(8, 7, K);
    if (!f) { b.rect(3, 8, 2, 5, D); b.rect(11, 8, 2, 5, D); b.rect(6, 14, 1, 1, K); b.rect(9, 14, 1, 1, K); } else { b.set(7, 14, K); b.set(9, 14, K); }
    return;
  }
  const big = k === 'rabe' || k === 'phoenix';
  if (!f) {   // sitzend, Blick nach rechts
    if (k === 'phoenix') { b.line(1, 13, 5, 10, A); b.line(1, 12, 4, 9, '#ffd24a'); b.line(2, 14, 6, 11, D); b.set(1, 14, '#fff0a0'); }
    b.rect(2, 10, 3, 2, D); b.disc(7.5, 9.5, big ? 3.9 : 3.5, M); b.disc(8.6, 10.6, 2.2, Lt); b.disc(6.3, 9, 2.4, D); b.rect(4, 9, 3, 2, D);
    b.disc(10.6, 5.8, big ? 2.8 : 2.5, M); b.set(11, 5, '#120e18'); b.set(12, 5, '#ffffff');
    b.rect(13, 6, big ? 3 : 2, 1, K); b.set(13, 5, K);
    if (k === 'spatz') { b.rect(9, 3, 3, 1, A); b.set(12, 7, Lt); }
    if (k === 'taube') { b.set(10, 8, A); b.set(9, 8, A); b.set(11, 8, '#b892f4'); }
    if (k === 'rabe') { b.set(7, 8, A); b.set(10, 4, A); }
    if (k === 'phoenix') { b.set(10, 2, '#ffd24a'); b.set(11, 2, '#fff0a0'); b.set(9, 3, A); }
    b.rect(7, 13, 1, 2, '#c8a050'); b.rect(9, 13, 1, 2, '#c8a050');
    return;
  }
  const up = f === 1;   // fliegend, nach rechts
  if (k === 'phoenix') { b.line(0, up ? 11 : 9, 3, 9, A); b.line(0, up ? 9 : 11, 3, 10, '#ffd24a'); b.set(0, 12, '#fff0a0'); }
  else b.rect(1, 9, 3, 2, D);
  b.rect(4, 8, 7, 4, M); b.disc(5.5, 9.8, 2, M); b.disc(9, 9.6, 2.2, M); b.rect(5, 11, 5, 1, Lt);
  b.disc(12, 7.6, big ? 2.4 : 2.1, M); b.set(12, 7, '#120e18'); b.rect(14, 8, big ? 2 : 1, 1, K); b.set(14, 7, K);
  if (up) { b.rect(6, 3, 3, 5, D); b.rect(5, 1, 2, 3, D); b.rect(8, 4, 2, 3, D); b.set(4, 1, D); }
  else { b.rect(6, 11, 3, 3, D); b.rect(5, 13, 2, 2, D); b.rect(8, 12, 2, 2, D); }
  if (k === 'spatz') b.rect(11, 5, 2, 1, A);
  if (k === 'taube') b.set(11, 9, A);
  if (k === 'rabe') { b.set(7, up ? 4 : 12, A); }
  if (k === 'phoenix') { b.set(11, 4, '#ffd24a'); b.set(12, 5, '#fff0a0'); b.set(7, up ? 2 : 13, '#ffd24a'); }
}
HOOK.artIcon.push((name, b) => { const m = /^v_([a-z]+)(?:_([12]))?$/.exec(name); if (m && VPAL[m[1]]) birdPaint(m[1], +(m[2] || 0), b); });
function birdIconURL(k, f) { return iconURL(['pa', 'v_' + (VPAL[k] ? k : 'spatz') + (f ? '_' + f : '')]); }
const VSTRIP = {};
function birdStripURL(k) { return VSTRIP[k] || (VSTRIP[k] = mk(32, 16, g => { g.drawImage(artIcon('v_' + k + '_1'), 0, 0); g.drawImage(artIcon('v_' + k + '_2'), 16, 0); }).toDataURL()); }
function birdChirp(k) { const b = { spatz: 2200, taube: 900, rabe: 520, eule: 640, phoenix: 1500 }[k] || 1400; tone(b, .06, 'triangle', .035, b * 1.4); tone(b * 1.2, .07, 'triangle', .03, b * 1.6, .09); noise(.12, .025, 2500, null); }

/* ---------- Flug über die Welt: vom Helden hinauf und davon, mit Funkenspur ---------- */
const VFLY_T = 1.9;
function vgFlyPos(f, a) {
  const sx = f.x - CX, sy = f.y - CY - 14, ex = sx + f.dir * VW * .5, ey = -40, q = a * a;
  return { x: lerp(sx, ex, a) + Math.sin(a * 10) * 5 * (1 - a), y: lerp(sy, ey, q * .7 + a * .3) - Math.sin(a * 3.14) * 6, s: 2.2 - a * 1.1 };
}
HOOK.postRender.push(() => {
  if (!VG.fly.length) return;
  VG.fly = VG.fly.filter(f => T - f.t0 < VFLY_T);
  for (const f of VG.fly) {
    const a = (T - f.t0) / VFLY_T, B = BIRDS[f.k];
    for (let i = 6; i >= 1; i--) { const q = a - i * .025; if (q <= 0) continue; const p = vgFlyPos(f, q); ctx.globalAlpha = (1 - i / 7) * .8; ctx.fillStyle = f.k === 'phoenix' ? (i % 2 ? '#ffd24a' : '#ff6a2a') : i % 2 ? B.c : '#fff3c0'; ctx.fillRect(Math.round(p.x - 1 + Math.sin(i * 2.3 + T * 9) * 2), Math.round(p.y + 2 + i), 2, 2); }
    ctx.globalAlpha = 1;
    const p = vgFlyPos(f, a), img = artIcon('v_' + f.k + '_' + (Math.floor(T * 9) % 2 ? 1 : 2)), w = Math.round(16 * p.s), x = Math.round(p.x - w / 2), y = Math.round(p.y - w / 2);
    ctx.save(); if (f.dir < 0) { ctx.translate(x * 2 + w, 0); ctx.scale(-1, 1); } ctx.drawImage(img, x, y, w, w); ctx.restore();
    ctx.fillStyle = '#5e3a1e'; ctx.fillRect(Math.round(p.x - 2), Math.round(p.y + w / 2 - 1), 5, 4); ctx.fillStyle = '#e8b04a'; ctx.fillRect(Math.round(p.x - 1), Math.round(p.y + w / 2), 3, 1);   // Bündel
  }
});

/* ---------- Vögel als Fund in den Landen (Bodenbeute 'lbird' aus js/lande.js lDrop) ---------- */
HOOK.collect.push((h, c) => {
  if (h || !c || c.k !== 'lbird') return h;
  c.got = true; const k = BIRDS[c.bk] ? c.bk : 'spatz';
  if (birdGive(k, 1)) { birdChirp(k); sfx('loot'); if (typeof lBanner === 'function') lBanner(_t('MAGISCHER VOGEL!'), _t('{bird} – bringt {n} Dinge sicher heim', { bird: BIRDS[k].n, n: BIRDS[k].slots })); saveChar(); }
  else P.gold += 100;
  return true;
});
HOOK.draw.push(list => {
  for (const c of pickups) if (c.k === 'lbird') {
    c.di = c.di || { y: 0, draw: () => { const x = Math.round(c.x - CX), y = Math.round(c.y - CY), z = Math.round(c.z + Math.sin(c.t * 5) * 2 + 3), img = artIcon('v_' + (BIRDS[c.bk] ? c.bk : 'spatz') + (Math.floor(c.t * 6) % 2 ? '_1' : '_2')); ctx.drawImage(img, x - 8, y - z - 14); if (typeof addLight === 'function') addLight(x, y - 8, 22, .8); } };
    c.di.y = c.y; list.push(c.di);
  }
});

document.head.insertAdjacentHTML('beforeend', `<style>
.vbar{display:flex;align-items:center;gap:8px;background:var(--stone-lo);padding:6px 8px;margin:0 0 10px;box-shadow:inset 3px 0 0 #57c7e6}
.box+.vbar{margin:10px 0 0}.vbar.none{font-size:16px;line-height:1.1;color:var(--parch-dim)}.vbar img{width:28px;height:28px;image-rendering:pixelated;flex:none}
.vbar .vlist{display:flex;flex-wrap:wrap;gap:4px 10px;flex:1;min-width:0;font-family:var(--f-display);font-size:8px}.vbar .vlist span{display:inline-flex;align-items:center;gap:2px}
.vbar .btn{flex:none;min-height:44px}
.vtiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin-bottom:8px}
.vtile{position:relative;border:0;background:var(--stone-lo);color:var(--parch);padding:6px 1px 5px;display:grid;justify-items:center;gap:2px;cursor:pointer;font-family:var(--f-body);min-width:0;min-height:76px}
.vtile img{width:32px;height:32px;image-rendering:pixelated}.vtile b{font-family:var(--f-display);font-weight:400;font-size:6px;line-height:1.4;color:var(--c);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vtile small{font-size:13px;line-height:1;color:var(--parch-dim)}.vtile em{position:absolute;right:3px;top:2px;font-style:normal;font-family:var(--f-display);font-size:7px;color:var(--parch)}
.vtile.sel{background:var(--stone-hi);box-shadow:inset 0 0 0 3px var(--c)}.vtile:disabled{opacity:.38;cursor:default}
.vstat{display:grid;gap:3px;margin:0 0 8px;font-size:17px;color:var(--parch-dim)}
.vmeter{height:8px;background:var(--night);box-shadow:0 0 0 2px var(--stone-hi)}.vmeter i{display:block;height:100%;background:#57c7e6}
.vpouch{display:flex;gap:10px;align-items:center;width:100%;border:0;background:var(--stone-lo);color:var(--parch);padding:8px 10px;cursor:pointer;text-align:left;font-family:var(--f-body);min-height:52px;margin-bottom:6px}
.vpouch img{width:28px;height:28px;image-rendering:pixelated}.vpouch b{display:block;font-family:var(--f-display);font-weight:400;font-size:8px;line-height:1.5}.vpouch small{display:block;font-size:15px;color:var(--parch-dim)}
.vpouch.on{background:var(--stone-hi);box-shadow:inset 0 0 0 3px #57c7e6}.vpouch[aria-disabled="true"],.vpick[aria-disabled="true"]{opacity:.45}
.vsec{display:flex;align-items:center;justify-content:space-between;gap:8px}.vsec h3{margin:8px 0 6px}.vgrid{margin-bottom:8px}
.vpick{position:relative}.vpick.on{background:#203848}.vchk{position:absolute;left:3px;top:1px;font-family:var(--f-body);font-weight:400;font-size:20px;line-height:1;color:#9ae8ff;text-shadow:1px 1px 0 #000}
.vfoot .btn img{width:24px;height:24px;image-rendering:pixelated;vertical-align:-7px;margin-right:6px}
.vhero{display:flex;gap:12px;align-items:center;background:var(--stone-lo);padding:8px 10px;margin-bottom:8px;box-shadow:inset 3px 0 0 #57c7e6}
.vhero b{font-family:var(--f-display);font-weight:400;font-size:8px;color:#9ae8ff}.vhero p{margin:4px 0 0;font-size:17px;line-height:1.1}
.vfly{flex:none;width:48px;height:48px;background-size:96px 48px;image-rendering:pixelated;animation:vflap .32s steps(2) infinite,vbob 1.6s ease-in-out infinite}
@keyframes vflap{to{background-position:-96px 0}}@keyframes vbob{50%{transform:translateY(-5px)}}
.vhow{margin:0 0 8px;padding-left:22px;font-size:17px;line-height:1.15}.vhow li{margin-bottom:3px}
.vown{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px}.vown .pill{display:inline-flex;align-items:center;gap:3px}.vown img{width:18px;height:18px;image-rendering:pixelated}
.vrow.lock{opacity:.6}.vrow .ic img{width:32px;height:32px;image-rendering:pixelated}.vslots{font-family:var(--f-body);font-size:16px;color:var(--parch-dim)}.vhave{font-family:var(--f-body);font-size:17px;color:var(--gold)}
@media (prefers-reduced-motion:reduce){.vfly{animation:none}}
@media (min-width:600px){.vsplit{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:12px;align-items:start}.vsplit .vsec h3{margin-top:0}.vtile img{width:36px;height:36px}}
@media (max-height:520px){.vtile{grid-template-columns:30px minmax(0,1fr);justify-items:start;align-items:center;column-gap:4px;row-gap:0;padding:4px 6px;min-height:48px}.vtile img{grid-row:span 2;width:28px;height:28px}.vtile b{display:none}.vtile small{grid-column:2;grid-row:span 2}.vtile em{top:1px}.vpouch{min-height:44px;padding:5px 10px}}
</style>`);
