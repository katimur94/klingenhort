'use strict';
/* =========================================================
   KLINGENHORT – Versteck: begehbare Ruine, Stationen, Ausbau,
   Schatzkammer, Glückstempel, Bibliothek, Mine, Garten
   ========================================================= */

const HIDE_POS = {
  schmiede: [.13, .2], alchemie: [.31, .2], bibliothek: [.5, .16], juwelier: [.69, .2], tempel: [.87, .2],
  spiegel: [.06, .6], feuer: [.5, .56], portal: [.94, .6],
  lager: [.18, .9], training: [.38, .92], mine: [.62, .92], garten: [.82, .9]
};
function hideTotal() { let n = 0; for (const k in BUILD) if (!BUILD[k].fixed) n += hideLv(k); return n; }
function npcLine(id) {
  const L = (NPCTALK[id] || []).filter(l => l[0] <= P.act); if (!L.length) return '';
  const l = L[(P.act + Math.floor(T / 7)) % L.length], S = SPEAKERS[l[1]];
  return `<div class="say"><img class="px" src="${iconURL(['sp', S.sp])}" alt=""><div><b style="color:${S.c}">${S.n}</b>${_t('„{text}“', { text: esc(l[2].replace('{name}', P.name)) })}</div></div>`;
}

/* ---------- Szene ---------- */
function enterHideout() {
  G = { type: 'versteck', row: P.map && P.map.pos ? Math.max(0, P.map.pos.r) : 0, stage: stageNum(), waves: [], wi: 0, pending: [], phase: 'hide', t: 0, ambT: 0, dark: 0, lootMul: 1, near: null, kills: 0, extra: {}, spikeRush: 0 };
  enemies = []; projs = []; parts = []; pickups = []; texts = []; rings = []; corpses = []; ghosts = []; fx = []; allies = []; traps = [];
  prepArena(0, 4711);
  layoutHideout();
  P.x = AW / 2; P.y = BD.y0 + (BD.y1 - BD.y0) * .74; P.vx = P.vy = 0; P.atkT = 0; P.roll = 0; P.rollA = 0; P.inv = .5; P.spin = 0; P.leap = null; P.dash = null; P.volley = 0; P.z = 0; P.wall = 0; P.stealth = 0; P.cds = [0, 0, 0]; P.manAim = null;
  cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - VH / 2, 0, Math.max(0, AH - VH));
  setMusic(48, false); $('bossbar').hidden = true; $('objective').textContent = '';
  setState('play'); showHud(true); hideOverlay();
  banner(_t('VERSTECK'), _t('Stufe {lv} · Geh zu einer Station und interagiere', { lv: hideTotal() }));
  if (!SAVE.meta.hide.intro) { SAVE.meta.hide.intro = true; persist(); setState('menu'); dialog([['borin', _t('Willkommen im Versteck, {name}. Noch ist es eine Ruine.')], ['borin', _t('Die Gerüste dort? Dort bauen wir Schmiede, Labor, Schatzkammer und mehr. Geh hin und sieh, was es kostet.')], ['borin', _t('Am Lagerfeuer kannst du einmal pro Akt rasten. Und das Portal bringt dich zurück zur Weltkarte.')]], () => { hideOverlay(); setState('play'); showHud(true); }); }
}
function hidePos(id) { const [fx_, fy_] = HIDE_POS[id]; return { x: Math.round(BD.x0 + 14 + fx_ * (BD.x1 - BD.x0 - 28)), y: Math.round(BD.y0 + fy_ * (BD.y1 - BD.y0)) }; }
function layoutHideout() {
  obs = []; enemies = enemies.filter(e => e.ai !== 'dummy');
  for (const id of BUILDORDER) {
    const B = BUILD[id], lv = B.fixed ? 1 : hideLv(id), p = hidePos(id);
    obs.push({ k: 'station', id, x: p.x, y: p.y, r: id === 'portal' || id === 'bibliothek' || id === 'mine' ? 13 : 11, solid: true, act: id, label: B.n + (B.fixed ? '' : ' · ' + (lv ? _t('Stufe {lv}', { lv }) : _t('bauen'))) });
    if (lv && B.npc) { const sp = B.body; obs.push({ k: 'npc', sp, x: p.x + (p.x > AW / 2 ? -22 : 22), y: p.y + 8, r: 5, solid: true, act: id, label: B.npc, face: p.x > AW / 2 ? 1 : -1 }); }
    if (id === 'training' && lv) { const e = spawnEnemy('dummy', { x: p.x - 26, y: p.y - 2, instant: true }); e.hx = e.x; e.hy = e.y; e.dmgLog = []; e.alpha = null; e.name = _t('Trainingspuppe'); }
  }
  const tl = hideTotal(), n = Math.min(12, 2 + Math.floor(tl / 2)), bn = [[16, 32], [32, 32], [16, 48], [32, 48]];
  bg.banners = []; for (let i = 0; i < n; i++) { const x = Math.round(48 + (i + .5) / n * (AW - 96)); const b = bn[i % 4]; bg.banners.push({ x, sx: b[0], sy: b[1] }); }
}
function updHideout() {
  let best = null, bd = 30;
  for (const o of obs) { if (!o.act) continue; const d = Math.hypot(o.x - P.x, (o.y - P.y) * 1.3) - o.r; if (d < bd) { bd = d; best = o; } }
  G.near = best;
}
function interactNear() {
  if (state !== 'play' || !G || G.type !== 'versteck' || !G.near) return;
  sfx('click'); openStation(G.near.act);
}
function backToHide() { hideOverlay(); setState('play'); showHud(true); }
function leaveHideout() { saveChar(); G = null; openMap(); }

/* ---------- Stationen ---------- */
let stTab = null;
function openStation(id, tab) {
  setState('menu'); showHud(false); stTab = tab || null;
  const B = BUILD[id], lv = B.fixed ? 1 : hideLv(id);
  if (!lv) { openBuild(id); return; }
  switch (id) {
    case 'feuer': openCampfire(); break;
    case 'portal': leaveHideout(); break;
    case 'spiegel': openMirror(); break;
    case 'schmiede': selItem = null; wbTab = 'up'; openWorkbench('smith'); break;
    case 'juwelier': selItem = null; wbTab = 'sock'; openWorkbench('jewel'); break;
    case 'alchemie': openAlchemy(); break;
    case 'lager': openStash(); break;
    case 'training': openTraining(); break;
    case 'tempel': openTemple(); break;
    case 'bibliothek': openLibrary(); break;
    case 'mine': case 'garten': openProd(id); break;
  }
}
function buildCost(id) { const B = BUILD[id], lv = hideLv(id); if (!B.lv || lv >= B.lv.length) return null; const c = Object.assign({}, B.lv[lv]), gold = c.gold || 0; delete c.gold; return { mats: c, gold }; }
function buildDesc(id, lv) { const B = BUILD[id]; return B.d[Math.min(lv, B.d.length - 1)]; }
function buildHTML(id) {
  const B = BUILD[id], lv = hideLv(id), c = buildCost(id);
  if (!c) return `<h3>${_t('AUSBAU')}</h3><p class="sub">${_t('{name} ist vollständig ausgebaut (Stufe {lv}).', { name: B.n, lv })}</p>`;
  return `<h3>${_t('AUSBAU AUF STUFE {lv}', { lv: lv + 1 })}</h3><p class="sub" style="margin:0 0 4px">${esc(buildDesc(id, lv))}</p>${costHTML(c.mats, c.gold)}<button class="btn" data-act="build" data-id="${id}" ${canAfford(c.mats, c.gold) ? '' : 'disabled'}>${lv ? _t('Ausbauen') : _t('Errichten')}</button>`;
}
function doBuild(id) {
  const c = buildCost(id); if (!c || !canAfford(c.mats, c.gold)) { sfx('deny'); return false; }
  payMats(c.mats); P.gold -= c.gold; const H = SAVE.meta.hide, was = H.b[id] || 0; H.b[id] = was + 1;
  if (!was && id === 'mine') H.mine = H.rooms; if (!was && id === 'garten') H.garden = H.rooms;
  statMax('hideLv', hideTotal()); sfx('build'); shake(3); computeStats(); saveChar(); persist(); checkAch();
  if (G && G.type === 'versteck') { const px_ = P.x, py_ = P.y; layoutHideout(); P.x = px_; P.y = py_; const p = hidePos(id); for (let i = 0; i < 30; i++) part(p.x + rnd(-14, 14), p.y, rnd(0, 20), rnd(-40, 40), rnd(-20, 20), rnd(30, 90), pick(['#e8b04a', '#ffd24a', '#a8743e']), rnd(.5, 1), 1, 120, 1); }
  toast(_t('{name}: Stufe {lv}', { name: BUILD[id].n, lv: H.b[id] }), '#ffd24a');
  return true;
}
function openBuild(id) {
  const B = BUILD[id];
  showOverlay(`<div class="head"><h2>${B.n.toLocaleUpperCase(LOCALE)}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div><button class="btn alt sm" data-act="hback">${_t('Zurück')}</button></div></div>
  <div style="display:flex;gap:12px;align-items:center"><img class="px" src="${iconURL(['pa', 'bau'])}" alt="" style="width:48px"><p class="sub">${_t('Hier steht nur ein Gerüst. {d}.', { d: esc(B.d[0]) })}</p></div>
  ${buildHTML(id)}`);
}
function stationShell(id, body, wide) {
  const B = BUILD[id], lv = hideLv(id);
  showOverlay(`<div class="head"><h2>${B.n.toLocaleUpperCase(LOCALE)}${B.fixed ? '' : ' · ' + lv}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}${P.fate ? ` <span style="color:#ffd24a"><i class="fc"></i>${P.fate}</span>` : ''}</div><button class="btn alt sm" data-act="hback">${_t('Zurück')}</button></div></div>${npcLine(id)}${body}${B.fixed ? '' : buildHTML(id)}`, wide);
}

/* Lagerfeuer: Rast einmal pro Akt, Gespräche, Ausbau-Übersicht */
function openCampfire() {
  const rested = P.map && P.map.rested;
  const list = BUILDORDER.filter(k => !BUILD[k].fixed).map(k => { const lv = hideLv(k), c = buildCost(k); return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['pa', BUILD[k].icon])}" alt=""></div><div><div class="nm">${BUILD[k].n} <span style="color:var(--gold);font-size:16px">${_t('Stufe {lv}/{max}', { lv, max: BUILD[k].lv.length })}</span></div><div class="st">${esc(c ? buildDesc(k, lv) : _t('Vollständig ausgebaut'))}</div>${c ? costHTML(c.mats, c.gold) : ''}</div>${c ? `<button class="btn sm" data-act="build" data-id="${k}" ${canAfford(c.mats, c.gold) ? '' : 'disabled'}>${lv ? _t('Ausbauen') : _t('Bauen')}</button>` : '<span></span>'}</div>`; }).join('');
  stationShell('feuer', `<p class="sub">${_t('LP {hp}/{max}.', { hp: Math.ceil(P.hp), max: P.st.hp })} ${rested ? _t('Du hast in diesem Akt schon gerastet.') : _t('Einmal pro Akt kannst du hier vollständig heilen.')}</p>
  <div class="menu two"><button class="btn" data-act="rest" ${rested || P.hp >= P.st.hp ? 'disabled' : ''}>${_t('Rasten (voll heilen)')}</button><button class="btn alt" data-act="tale">${_t('Am Feuer erzählen')}</button></div>
  <h3>${_t('AUSBAU-ÜBERSICHT · VERSTECK-STUFE {lv}', { lv: hideTotal() })}</h3>${list}`, true);
}
/* Alchemielabor */
function openAlchemy() {
  const R = RECIPES[0], lv = hideLv('alchemie');
  let body = `<p class="sub">${_t('Tränke: {n} · heilen {p}', { n: `<b style="color:var(--gold)">${P.potions}/${potMax()}</b>`, p: pct(potHeal()) })}</p>
  <div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['s', 288, 336, 16, 16])}" alt=""></div><div><div class="nm">${R.n}</div><div class="st">${R.d}</div>${costHTML(R.cost, R.gold)}</div><button class="btn sm" data-act="brew" ${canAfford(R.cost, R.gold) && P.potions < potMax() ? '' : 'disabled'}>${_t('Brauen')}</button></div>`;
  if (lv >= 3) body += '<h3>' + _t('ELIXIERE') + '</h3>' + ELIXIRS.map((E, i) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['s', 288 + (i % 4) * 16, 352, 16, 16])}" alt=""></div><div><div class="nm" style="color:var(--rune)">${E.n}</div><div class="st">${E.d}</div>${costHTML(E.cost, E.gold)}</div><button class="btn sm" data-act="elix" data-i="${i}" ${canAfford(E.cost, E.gold) ? '' : 'disabled'}>${_t('Trinken')}</button></div>`).join('');
  else body += '<p class="sub">' + _t('Elixiere gibt es ab Stufe 3.') + '</p>';
  stationShell('alchemie', body);
}
/* Schatzkammer: Lager für alle Helden */
function stashCap() { return 12 * hideLv('lager'); }
function openStash() {
  const S = SAVE.meta.hide.stash, cap = stashCap(), sel = selItem && (P.bag.find(x => x.uid === selItem) || S.find(x => x.uid === selItem));
  const slot = (it, act) => `<button class="slot" data-act="${act}" data-id="${it.uid}" style="box-shadow:inset 0 0 0 2px ${itemColor(it)}${sel === it ? ',0 0 0 2px #e8b04a' : ''}" aria-label="${esc(itemName(it))}"><img src="${itemIconURL(it)}" alt="">${it.up ? `<span class="u">+${it.up}</span>` : ''}${it.fz ? `<span class="n">★${it.fz}</span>` : ''}</button>`;
  stationShell('lager', `<p class="sub">${_t('Antippen zum Auswählen, nochmal antippen zum Verschieben. Das Lager teilen sich alle deine Helden.')}</p>
  <div class="split"><div><div class="box"><h3 style="margin-top:0">${_t('BEUTEL {n}/{max}', { n: P.bag.length, max: 30 })}</h3><div class="grid">${P.bag.map(it => slot(it, 'stin')).join('') || `<p class="sub">${_t('Leer')}</p>`}</div></div>
  <div class="box" style="margin-top:10px"><h3 style="margin-top:0">${_t('LAGER {n}/{max}', { n: S.length, max: cap })}</h3><div class="grid">${S.map(it => slot(it, 'stout')).join('') || `<p class="sub">${_t('Leer')}</p>`}</div></div></div>
  ${sel ? `<div class="side sheet">${itemDetail(sel, `<button class="btn sm" data-act="${P.bag.includes(sel) ? 'stin' : 'stout'}" data-id="${sel.uid}">${P.bag.includes(sel) ? _t('Ins Lager legen') : _t('In den Beutel')}</button>`)}</div>` : `<div class="side"><p class="sub" style="margin-top:0">${_t('Tippe einen Gegenstand an.')}</p></div>`}</div>`, true);
}
/* Trainingsplatz */
function openTraining() {
  const lv = hideLv('training');
  stationShell('training', `<p class="sub">${_t('Dauerhafter Bonus für alle Helden: {bonus}. Schlag die Trainingspuppe, um deinen Schaden pro Sekunde zu sehen.', { bonus: `<b style="color:var(--gold)">${_t('+{n} % Schaden und LP', { n: lv * 3 })}</b>` })}</p>`);
}
/* Erzmine und Kräutergarten */
function minePending(k) { const H = SAVE.meta.hide; if (!hideLv(k === 'mine' ? 'mine' : 'garten')) return 0; return Math.min(25, H.rooms - (k === 'mine' ? H.mine : H.garden)); }
function prodYield(id, n) {
  const lv = hideLv(id), r = {};
  if (id === 'mine') { r.erz = n * lv; if (lv >= 2) r.mithril = Math.floor(n * .3); if (lv >= 3) r.adamant = Math.floor(n * .18); if (lv >= 4) r.glut = Math.floor(n * .22); if (lv >= 5) r.stern = Math.floor(n * .12); }
  else { r.schleim = n * Math.min(lv, 4) * (lv >= 5 ? 2 : 1); if (lv >= 2) r.leder = n; if (lv >= 4) r.kristall = Math.floor(n * .25); }
  return r;
}
function openProd(id) {
  const k = id === 'mine' ? 'mine' : 'garden', n = minePending(k), y = prodYield(id, n), pot = id === 'garten' && hideLv('garten') >= 3 ? Math.floor(n / 3) : 0;
  const list = Object.keys(y).filter(m => y[m] > 0).map(m => `<span><img src="${iconURL(['mat', m])}" alt="">${y[m]} ${MATS[m].n}</span>`).join('') + (pot ? `<span>${pot === 1 ? _t('1 Heiltrank') : _t('{n} Heiltränke', { n: pot })}</span>` : '');
  stationShell(id, `<p class="sub">${id === 'mine' ? _t('Die Kumpel fördern für jeden geschafften Raum (bis zu 25).') : _t('Der Garten wächst für jeden geschafften Raum (bis zu 25).')} ${_t('Seit dem letzten Besuch: {n}.', { n: `<b style="color:var(--gold)">${n === 1 ? _t('1 Raum') : _t('{n} Räume', { n })}</b>` })}</p>
  ${n > 0 ? `<div class="cost">${list}</div><button class="btn" data-act="collect" data-id="${id}">${_t('Einsammeln')}</button>` : `<p class="sub">${_t('Noch nichts zum Einsammeln. Schaff ein paar Räume!')}</p>`}`);
}
function collectProd(id) {
  const k = id === 'mine' ? 'mine' : 'garden', n = minePending(k); if (n <= 0) return;
  const y = prodYield(id, n); for (const m in y) if (y[m] > 0) gainMat(m, y[m]);
  if (id === 'garten' && hideLv('garten') >= 3) P.potions = Math.min(potMax(), P.potions + Math.floor(n / 3));
  SAVE.meta.hide[k] = SAVE.meta.hide.rooms; sfx('mine'); toast(_t('Eingesammelt!'), '#79c24e'); saveChar(); persist();
}
/* Bibliothek: Chronik, Geschichte, Bestiarium */
function openLibrary() {
  const tab = stTab || 'chronik', t_ = (k, l) => `<button class="tab" role="tab" aria-selected="${tab === k}" data-act="ltab" data-id="${k}">${l}</button>`;
  let body = `<div class="tabs" role="tablist">${t_('chronik', _t('CHRONIK {n}/{max}', { n: SAVE.meta.lore.length, max: LORE.length }))}${t_('geschichte', _t('GESCHICHTE'))}${t_('best', _t('BESTIARIUM'))}</div>`;
  if (tab === 'chronik') body += `<p class="sub">${_t('Chronikseiten findest du in Truhen, bei Elite-Gegnern, Bossen und in Gräbern. Ab Bibliothek-Stufe 3 häufiger.')}</p>` + LORE.map((L, i) => SAVE.meta.lore.includes(i) ? `<div class="detail"><div class="nm" style="color:var(--rune)">${i + 1}. ${esc(L[0])}</div><p style="margin:4px 0 0;font-size:18px">${esc(L[1])}</p></div>` : `<div class="detail" style="opacity:.4"><div class="nm">${i + 1}. ???</div></div>`).join('');
  else if (tab === 'geschichte') { body += `<div class="detail"><div class="nm" style="color:var(--gold)">${_t('Prolog')}</div><p style="margin:4px 0 0;font-size:18px">${esc(PROLOG.slice(0, 3).map(l => l[1]).join(' '))}</p></div>`; for (let a = 1; a <= Math.min(STORY_ACTS, P.maxAct); a++) { const A = ACTS[a - 1], done = P.maxAct > a; body += `<div class="detail"><div class="nm" style="color:var(--gold)">${_t('Akt {act}: {title}', { act: a, title: esc(A.t) })}</div><p style="margin:4px 0 0;font-size:18px">${esc(A.i)}${done ? ' ' + esc(A.o) : ''}</p></div>`; } if (P.maxAct > STORY_ACTS) body += `<div class="detail"><div class="nm" style="color:var(--blood)">${_t('Die Qual')}</div><p style="margin:4px 0 0;font-size:18px">${esc(QUAL_INTRO)}</p></div>`; }
  else body += bestiaryHTML();
  stationShell('bibliothek', body, true);
}

/* ---------- Glückstempel ---------- */
function coinPrice() { return 400 + P.lv * 30; }
function openTemple(result) {
  const L = SAVE.meta.luck, lim = hideLv('tempel') >= 2 ? 12 : 15, free = freeSpin();
  const seg = WHEEL.map(w => `<span style="--c:${w.c}">${w.n}<small>${_t('{n} %', { n: (w.w / WHEEL.reduce((s, x) => s + x.w, 0) * 100).toLocaleString(LOCALE, { maximumFractionDigits: w.w < 1 ? 1 : 0 }) })}</small></span>`).join('');
  stationShell('tempel', `<div class="kv"><span class="pill" style="background:#ffd24a"><i class="fc"></i> ${P.fate === 1 ? _t('1 GLÜCKSMÜNZE') : _t('{n} GLÜCKSMÜNZEN', { n: P.fate })}</span><span class="pill dim">${_t('LEGENDÄR SPÄTESTENS IN {n}', { n: Math.max(1, lim - L.pityL) })}</span><span class="pill dim">${_t('MYTHISCH SPÄTESTENS IN {n}', { n: Math.max(1, 80 - L.pityM) })}</span></div>
  <div class="wheel" id="wheel">${seg}</div>
  ${result ? `<div class="detail center" style="box-shadow:inset 0 0 0 2px ${result.c}"><div class="nm" style="color:${result.c}">${esc(result.t)}</div>${result.it ? itemDetail(result.it, '') : ''}</div>` : ''}
  <div class="menu two"><button class="btn" data-act="spin" ${P.fate >= 1 || free ? '' : 'disabled'}>${free === 'day' ? _t('Gratis-Dreh der Glückswoche!') : free ? _t('Gratis drehen!') : _t('Glücksrad drehen (1 {coin})', { coin: '<i class="fc"></i>' })}</button><button class="btn alt" data-act="coin" ${P.gold >= coinPrice() ? '' : 'disabled'}>${_t('1 {coin} kaufen ({gold} Gold)', { coin: '<i class="fc"></i>', gold: coinPrice() })}</button></div>
  <h3>${_t('SCHICKSALSTRUHEN')}</h3>${CHESTS.map(C => { const price = C.coins ? C.coins + ' <i class="fc"></i>' : _t('{n} Gold', { n: 250 + P.lv * 15 }), ok = C.coins ? P.fate >= C.coins : P.gold >= 250 + P.lv * 15; return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['s', C.id === 'bronze' ? 304 : C.id === 'gold' ? 320 : 336, 416, 16, 16])}" alt="" style="${C.id === 'drache' ? 'filter:hue-rotate(-40deg) saturate(1.6)' : ''}"></div><div><div class="nm">${C.n}</div><div class="st">${C.d}</div></div><button class="btn sm" data-act="chest" data-id="${C.id}" ${ok ? '' : 'disabled'}>${price}</button></div>`; }).join('')}
  <p class="sub">${_t('Glücksmünzen gibt es von Bossen, Champions, seltenen Truhen, der Tages-Challenge und Schreinen Fortunas. Mythische Gegenstände sind extrem selten – das Rad merkt sich aber, wie lange du schon Pech hattest.')}</p>`, true);
}
function wheelPick() {
  const L = SAVE.meta.luck, lim = hideLv('tempel') >= 2 ? 12 : 15; L.spins++; L.pityL++; L.pityM++; stat('spins');
  const W = {}; WHEEL.forEach(w => W[w.k] = w.w); let k = wpick(W);
  if (L.pityM >= 80) k = 'myth'; else if (L.pityL >= lim && !['leg', 'set', 'myth', 'cos'].includes(k)) k = 'leg';
  if (['leg', 'set', 'myth', 'cos'].includes(k)) L.pityL = 0; if (k === 'myth') L.pityM = 0;
  return k;
}
function grantCosmetic() { const free = Object.keys(COSM).filter(k => !SAVE.meta.cos.includes(k)); if (!free.length) { gainFate(4); return _t('Alle Kosmetik gesammelt – 4 Glücksmünzen zurück'); } const k = pick(free); SAVE.meta.cos.push(k); statMax('cosm', SAVE.meta.cos.length); persist(); return _t('Kosmetik: {name} (im Spiegel anlegen)', { name: COSM[k].n }); }
function wheelReward(k) {
  const st = stageNum(), W = WHEEL.find(w => w.k === k), res = { c: W.c, t: W.n };
  const give = it => { addToBag(it); res.it = it; if (it.rar === 4) stat('legs'); };
  switch (k) {
    case 'gold': { const g = 150 + st * 30; P.gold += g; res.t = _t('+{n} Gold', { n: g }); break; }
    case 'mats': { const ms = MATORDER.slice(0, Math.min(MATORDER.length, 6 + Math.floor(st / 6))), got = []; for (let i = 0; i < 3; i++) { const m = pick(ms), n = ri(2, 4); gainMat(m, n); got.push(n + ' ' + MATS[m].n); } res.t = got.join(', '); break; }
    case 'pots': P.potions = Math.min(potMax(), P.potions + 3); res.t = _t('3 Heiltränke'); break;
    case 'gem': { const g = randomGem(st + 6); gainGem(g); const [id, gr] = g.split(':'); res.t = _t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[id].n }); break; }
    case 'rare': give(randomItem(st, 2)); break;
    case 'epic': give(randomItem(st, 3)); break;
    case 'coins': gainFate(2); res.t = _t('+2 Glücksmünzen'); break;
    case 'leg': give(randomItem(st, 4)); break;
    case 'set': give(randomItem(st, 0, { setChance: 99 })); break;
    case 'cos': res.t = grantCosmetic(); break;
    case 'myth': give(makeMythic()); res.t = _t('MYTHISCH: {name}', { name: _t(res.it.name) }); break;
  }
  return res;
}
let spinning = false;
function doSpin() {
  if (spinning) return; const free = freeSpin();
  if (!free && P.fate < 1) return; if (free === 'act') P.story['spin' + P.act] = 1; else if (free === 'day') SAVE.meta.luck.day = dayKey(); else P.fate--;
  const k = wheelPick(), target = WHEEL.findIndex(w => w.k === k), el = $('wheel'), segs = el ? el.children : [];
  spinning = true; let i = 0, step = 0; const total = WHEEL.length * 3 + target;
  const tick = () => {
    for (const s of segs) s.classList.remove('on'); if (segs[i % WHEEL.length]) segs[i % WHEEL.length].classList.add('on'); sfx('tick');
    if (step >= total) { spinning = false; const r = wheelReward(k); sfx(k === 'myth' ? 'myth' : ['leg', 'set', 'cos'].includes(k) ? 'loot' : 'coin'); if (k === 'myth') shake(6); saveChar(); persist(); checkAch(); openTemple(r); return; }
    i++; step++; setTimeout(tick, 40 + Math.pow(step / total, 3) * 380);
  };
  tick();
}
function openChestLuck(id) {
  const C = CHESTS.find(c => c.id === id), price = 250 + P.lv * 15, st = stageNum();
  if (C.coins) { if (P.fate < C.coins) return; P.fate -= C.coins; } else { if (P.gold < price) return; P.gold -= price; }
  const r = Math.random(); let res;
  if (id === 'bronze') { res = { c: '#c8902a', t: _t('Bronzetruhe') }; const rar = r < .02 ? 4 : r < .12 ? 3 : r < .45 ? 2 : 1; res.it = randomItem(st, rar); res.it.rar = Math.max(res.it.rar, rar); }
  else if (id === 'gold') { res = { c: '#ffd24a', t: _t('Schicksalstruhe') }; if (r < .01) res.it = makeMythic(); else if (r < .06) res.t = grantCosmetic(); else res.it = randomItem(st, r < .16 ? 4 : 3); }
  else { res = { c: '#ff6a3a', t: _t('Drachentruhe') }; if (r < .06) res.it = makeMythic(); else res.it = randomItem(st + 6, 4, { setChance: .1 }); if (Math.random() < .15) res.t = grantCosmetic(); }
  if (res.it) { if (res.it.rar === 4 && !res.it.name) res.it.name = pick(LEGEND[res.it.slot === 'weapon' ? res.it.base : res.it.slot]); addToBag(res.it); if (res.it.rar === 4) stat('legs'); res.c = RAR[res.it.rar].c; }
  sfx(res.it && res.it.rar === 6 ? 'myth' : 'chest'); saveChar(); persist(); checkAch(); openTemple(res);
}
