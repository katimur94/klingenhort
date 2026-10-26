'use strict';
/* =========================================================
   KLINGENHORT – Versteck: begehbare Ruine, Stationen, Ausbau,
   Schatzkammer, Glückstempel, Bibliothek, Mine, Garten
   ========================================================= */

const HIDE_POS = {
  schmiede: [.13, .2], alchemie: [.31, .2], bibliothek: [.5, .16], juwelier: [.69, .2], tempel: [.87, .2],
  spiegel: [.06, .6], feuer: [.5, .56], portal: [.94, .6],
  lager: [.18, .9], training: [.38, .92], mine: [.62, .92], garten: [.82, .9],
  basar: [.28, .56], weltentor: [.72, .56], brutnest: [.5, .92],
  // 6.2: zwischen oberer und mittlerer Reihe (im Hochformat nie unter den Touch-Knöpfen); links/rechts außen der Holzplatz (js/bauen.js GHIDE)
  sattler: [.24, .38], voliere: [.76, .38]
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
  gatherHideLayout();   // Holzplatz: Bäume, Felsen, Büsche zum Abbauen (js/bauen.js)
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
  if (hookVal('station', false, id)) return;
  switch (id) {
    case 'feuer': openCampfire(); break;
    case 'portal': leaveHideout(); break;
    case 'spiegel': openMirror(); break;
    case 'schmiede': selItem = null; wbTab = 'up'; openWorkbench('smith'); break;
    case 'juwelier': selItem = null; wbTab = 'sock'; openWorkbench('jewel'); break;
    case 'alchemie': openAlchemy(); break;
    case 'lager': openStash(); break;
    case 'training': openTraining(); break;
    case 'tempel': if (!rolling()) ROLL = null; openTemple(); break;
    case 'bibliothek': openLibrary(); break;
    case 'mine': case 'garten': openProd(id); break;
    case 'sattler': openSattler(); break;
    // Station ohne eigene Tafel (z. B. Vogelhaus, solange js/ für die Vögel fehlt): Beschreibung und Ausbau
    default: stationShell(id, `<p class="sub">${esc(buildDesc(id, Math.max(0, lv - 1)))}</p>`);
  }
}
function buildCost(id) { const B = BUILD[id], lv = hideLv(id); if (!B.lv || lv >= B.lv.length) return null; const c = Object.assign({}, B.lv[lv]), gold = c.gold || 0; delete c.gold; return { mats: c, gold }; }
function buildDesc(id, lv) { const B = BUILD[id]; return B.d[Math.min(lv, B.d.length - 1)]; }
// Ausbau-Abschnitt einer Station: Baustelle (Fortschritt, Sofort fertig), sonst Kosten, Bauzeit und Knopf (Bauzeit: js/bauen.js)
function buildHTML(id) {
  const B = BUILD[id], lv = hideLv(id), c = buildCost(id), q = buildOf(id);
  if (q) return `<h3>${_t('IM BAU: STUFE {lv}', { lv: q.lv })}</h3><p class="sub" style="margin:0 0 4px">${esc(buildDesc(id, q.lv - 1))}</p>${buildProgHTML(q)}`;
  if (!c) return `<h3>${_t('AUSBAU')}</h3><p class="sub">${_t('{name} ist vollständig ausgebaut (Stufe {lv}).', { name: B.n, lv })}</p>`;
  const busy = !buildFree(), ok = canAfford(c.mats, c.gold) && !busy;
  return `<h3>${_t('AUSBAU AUF STUFE {lv}', { lv: lv + 1 })}</h3><p class="sub" style="margin:0 0 4px">${esc(buildDesc(id, lv))}</p>${costHTML(c.mats, c.gold)}${missLine(c.mats, c.gold)}
  <p class="sub bwhen">${_t('Bauzeit: {t}', { t: `<b>${buildTimeText(buildDur(lv + 1))}</b>` })}${busy ? ' · <span class="bbusy">' + buildBusyText() + '</span>' : ''}</p><button class="btn" data-act="build" data-id="${id}" ${ok ? '' : 'disabled'}>${lv ? _t('Ausbauen') : _t('Errichten')}</button>`;
}
// Ausbau beginnen: bezahlen, die Stufe zählt erst, wenn die Bauzeit um ist (hideLv) – sofort fertig nur mit Bauzeit 0
function doBuild(id) {
  if (!buildStart(id)) { sfx('deny'); return false; }
  const q = buildOf(id); sfx('build'); shake(2);
  if (G && G.type === 'versteck') { const p = hidePos(id); for (let i = 0; i < 18; i++) part(p.x + rnd(-14, 14), p.y, rnd(0, 16), rnd(-40, 40), rnd(-20, 20), rnd(30, 80), pick(['#a8743e', '#d8b878', '#8a8a7a']), rnd(.4, .8), 1, 160, 1); }
  if (q) toast(_t('Baustelle: {name} Stufe {lv} · fertig in {t}', { name: BUILD[id].n, lv: q.lv, t: buildTimeText(buildLeft(q)) }), '#e8b04a');
  return true;
}
function openBuild(id) {
  const B = BUILD[id], q = buildOf(id); bView = id;
  showOverlay(`<div class="head"><h2>${B.n.toLocaleUpperCase(LOCALE)}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}${P.fate ? ` <span style="color:#ffd24a"><i class="fc"></i>${P.fate}</span>` : ''}</div><button class="btn alt sm" data-act="hback">${_t('Zurück')}</button></div></div>
  <div style="display:flex;gap:12px;align-items:center"><img class="px" src="${iconURL(['pa', 'bau'])}" alt="" style="width:48px"><p class="sub">${q ? _t('Die Bauleute sind bei der Arbeit. {d}.', { d: esc(B.d[0]) }) : _t('Hier steht nur ein Gerüst. {d}.', { d: esc(B.d[0]) })}</p></div>
  ${buildHTML(id)}`);
}
function stationShell(id, body, wide) {
  const B = BUILD[id], lv = hideLv(id); bView = id;
  showOverlay(`<div class="head"><h2>${B.n.toLocaleUpperCase(LOCALE)}${B.fixed ? '' : ' · ' + lv}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}${P.fate ? ` <span style="color:#ffd24a"><i class="fc"></i>${P.fate}</span>` : ''}</div><button class="btn alt sm" data-act="hback">${_t('Zurück')}</button></div></div>${npcLine(id)}${body}${B.fixed ? '' : buildHTML(id)}`, wide);
}

/* Lagerfeuer: Rast einmal pro Akt, Gespräche, Ausbau-Übersicht */
function openCampfire() {
  const rested = P.map && P.map.rested;
  // je Gebäude: Stufe, was die nächste bringt, Kosten und Bauzeit – oder „im Bau“ mit Restzeit (Baustellen oben, js/bauen.js)
  const free = buildFree(), list = BUILDORDER.filter(k => !BUILD[k].fixed).map(k => { const lv = hideLv(k), c = buildCost(k), q = buildOf(k); return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['pa', BUILD[k].icon])}" alt=""></div><div><div class="nm">${BUILD[k].n} <span style="color:var(--gold);font-size:16px">${_t('Stufe {lv}/{max}', { lv, max: BUILD[k].lv.length })}</span></div><div class="st">${esc(q ? buildDesc(k, q.lv - 1) : c ? buildDesc(k, lv) : _t('Vollständig ausgebaut'))}</div>${q ? `<div class="st bbusy">${_t('Im Bau: Stufe {lv} · noch {t}', { lv: q.lv, t: `<b data-bt="${k}">${buildClock(buildLeft(q))}</b>` })}</div>` : c ? costHTML(c.mats, c.gold) + `<div class="st bwhen">${_t('Bauzeit: {t}', { t: buildTimeText(buildDur(lv + 1)) })}</div>` : ''}</div>${q ? '<span></span>' : c ? `<button class="btn sm" data-act="build" data-id="${k}" ${free && canAfford(c.mats, c.gold) ? '' : 'disabled'}>${lv ? _t('Ausbauen') : _t('Bauen')}</button>` : '<span></span>'}</div>`; }).join('');
  stationShell('feuer', `<p class="sub">${_t('LP {hp}/{max}.', { hp: Math.ceil(P.hp), max: P.st.hp })} ${rested ? _t('Du hast in diesem Akt schon gerastet.') : _t('Einmal pro Akt kannst du hier vollständig heilen.')}</p>
  <div class="menu two"><button class="btn" data-act="rest" ${rested || P.hp >= P.st.hp ? 'disabled' : ''}>${_t('Rasten (voll heilen)')}</button><button class="btn alt" data-act="tale">${_t('Am Feuer erzählen')}</button></div>
  <h3>${_t('AUSBAU-ÜBERSICHT · VERSTECK-STUFE {lv}', { lv: hideTotal() })}</h3>${buildSiteHTML()}${list}`, true);
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
  if (id === 'mine') {
    const m7 = lv >= 7 ? 1.5 : 1, m9 = lv >= 9 ? 1.5 : 1;
    r.erz = n * lv; r.stein = Math.floor(n * (1 + Math.floor(lv / 3)) * m7); if (lv >= 2) r.mithril = Math.floor(n * .3 * m7); if (lv >= 3) r.adamant = Math.floor(n * .18 * m7); if (lv >= 4) r.glut = Math.floor(n * .22 * m9); if (lv >= 5) r.stern = Math.floor(n * .12 * m9);
    if (lv >= 6) r.marmor = Math.floor(n * .25); if (lv >= 8) r.obsidian = Math.floor(n * .15); if (lv >= 10) r.aether = Math.floor(n * .05);   // 6.2: Stein, Marmor, Obsidian, Äther
  }
  else { r.schleim = n * Math.min(lv, 4) * (lv >= 5 ? 2 : 1); if (lv >= 2) r.leder = n; if (lv >= 4) r.kristall = Math.floor(n * .25); r.faser = n * (1 + Math.floor(lv / 3)); r.samen = Math.floor(n * (lv >= 5 ? .6 : .4)); if (lv >= 2) r.feder = Math.floor(n * .2); }
  return r;
}
function openProd(id) {
  const k = id === 'mine' ? 'mine' : 'garden', n = minePending(k), y = prodYield(id, n), pot = id === 'garten' && hideLv('garten') >= 3 ? Math.floor(n / 3) : 0;
  const list = Object.keys(y).filter(m => y[m] > 0).map(m => `<span><img src="${iconURL(['mat', m])}" alt="">${y[m]} ${MATS[m].n}</span>`).join('') + (pot ? `<span>${pot === 1 ? _t('1 Heiltrank') : _t('{n} Heiltränke', { n: pot })}</span>` : '');
  stationShell(id, `<p class="sub">${id === 'mine' ? _t('Die Kumpel fördern für jeden geschafften Raum (bis zu 25).') : _t('Der Garten wächst für jeden geschafften Raum (bis zu 25).')} ${_t('Seit dem letzten Besuch: {n}.', { n: `<b style="color:var(--gold)">${n === 1 ? _t('1 Raum') : _t('{n} Räume', { n })}</b>` })}</p>
  ${n > 0 ? `<div class="cost">${list}</div><button class="btn" data-act="collect" data-id="${id}">${_t('Einsammeln')}</button>` : `<p class="sub">${_t('Noch nichts zum Einsammeln. Schaff ein paar Räume!')}</p>`}${id === 'garten' ? farmHTML() : ''}`, id === 'garten');
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
// Münztausch: ab Tempel-Stufe 2 25 % günstiger, ab Stufe 4 je Stufe 3 % mehr (Stufe 10: 46 %)
function coinPrice() { const tl = hideLv('tempel'); return Math.round((400 + P.lv * 30) * (tl >= 2 ? .75 - Math.max(0, tl - 3) * .03 : 1)); }
/* ---------- Glücksrolle: wie beim Case-Opening rauscht eine Reihe Belohnungen vorbei und bleibt beim Gewinn stehen.
   Reiner Zufall: der Gewinn wird vor der Rolle ausgelost und sofort gutgeschrieben, die Rolle zeigt ihn nur.
   Die Kacheln davor und danach sind mit denselben Chancen gezogen – keine Garantie, keine gestellten Beinahe-Treffer. */
const ROLL_GAP = 4, ROLL_N = 46, ROLL_WIN = 38;
let ROLL = null;   // { tiles, win, off, anim, res, done }
function rollIcon(k) {
  const W = P.gear.weapon, it = r => ({ slot: 'weapon', base: W.base, form: wform(W).id, tier: clamp(Math.floor((stageNum() - 1) / 6) + 1, 0, TIERS - 1), rar: r, aff: {}, gems: [], up: 0, fz: 0, myth: r === 6 ? 'klinge' : null, set: r === 5 ? 'drache' : null, name: r >= 4 ? 'x' : null });
  switch (k) {
    case 'gold': return iconURL(['s', 289, 385, 6, 7]);
    case 'mats': return iconURL(['mat', 'mithril']);
    case 'pots': return iconURL(['s', 288, 352, 16, 16]);
    case 'gem': return iconURL(['gem', 'rubin', 3]);
    case 'coins': return rollArt('coin');
    case 'cos': return rollArt('cos');
    case 'mag': return itemIconURL(it(1));
    case 'rare': return itemIconURL(it(2));
    case 'epic': return itemIconURL(it(3));
    case 'leg': return itemIconURL(it(4));
    case 'set': return itemIconURL(it(5));
    case 'myth': return itemIconURL(it(6));
  }
  return '';
}
// Glücksmünze und Kosmetik als kleine Pixelbilder
const ROLLART = {};
function rollArt(k) {
  return ROLLART[k] || (ROLLART[k] = mk(14, 14, g => {
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    if (k === 'coin') { for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) { const d = Math.hypot(x - 6.5, y - 6.5); if (d < 6.2) px(x, y, d > 5.2 ? '#000' : d > 4 ? '#c8902a' : x + y < 11 ? '#fff3c0' : '#ffd24a'); } }
    else { const C = ['#f786a0', '#ffd2e0', '#fff']; for (const [x, y, c] of [[6, 1, 2], [7, 1, 2], [5, 2, 1], [8, 2, 1], [6, 2, 0], [7, 2, 0], [2, 5, 0], [3, 4, 0], [4, 5, 1], [9, 5, 1], [10, 4, 0], [11, 5, 0], [3, 6, 0], [10, 6, 0], [4, 7, 0], [9, 7, 0], [5, 8, 0], [8, 8, 0], [6, 9, 1], [7, 9, 1], [6, 10, 0], [7, 10, 0], [6, 5, 2], [7, 5, 2], [6, 6, 1], [7, 6, 1]]) px(x, y, C[c]); }
  }).toDataURL());
}
// Was eine Rolle enthalten kann: Glücksrad oder eine der Schicksalstruhen
function rollPool(src) {
  if (src === 'wheel') return WHEEL.map(w => ({ k: w.k, n: w.n, c: w.c, w: w.w }));
  const R = r => ({ k: ['', 'mag', 'rare', 'epic', 'leg', 'set', 'myth'][r], n: RAR[r].n, c: RAR[r].c });
  if (src === 'bronze') return [Object.assign(R(1), { w: 55 }), Object.assign(R(2), { w: 33 }), Object.assign(R(3), { w: 10 }), Object.assign(R(4), { w: 2 })];
  if (src === 'gold') return [Object.assign(R(3), { w: 84 }), Object.assign(R(4), { w: 10 }), { k: 'cos', n: _t('Kosmetik'), c: '#f786a0', w: 5 }, Object.assign(R(6), { w: 1 })];
  return [Object.assign(R(4), { w: 94 }), Object.assign(R(6), { w: 6 })];
}
function rollDraw(pool) { const W = {}; pool.forEach((p, i) => W[i] = p.w); return pool[+wpick(W)]; }
function rollTileHTML(t, win) { const [r, g, b] = hexRgb(t.c); return `<div class="tile${win ? ' win' : ''}" style="--c:${t.c};background:linear-gradient(180deg,#1a1622 30%,rgba(${r},${g},${b},.38))"><img src="${rollIcon(t.k)}" alt=""><span>${esc(t.n)}</span></div>`; }
function rollHTML(src) {
  const pool = rollPool(src), tot = pool.reduce((a, p) => a + p.w, 0);
  const tiles = ROLL && ROLL.src === src ? ROLL.tiles : Array.from({ length: 14 }, (_, i) => pool[i % pool.length]);
  const off = ROLL && ROLL.src === src && !ROLL.anim ? ROLL.off || 0 : 0, win = ROLL && ROLL.src === src && !ROLL.anim ? ROLL.win : -1;
  return `<div class="roll${ROLL && ROLL.anim ? ' spin' : ''}" id="roll" data-act="rollskip"><div class="strip" id="rollStrip" style="transform:translateX(${-off}px)">${tiles.map((t, i) => rollTileHTML(t, i === win)).join('')}</div><i class="mark"></i></div>
  ${ROLL && ROLL.anim ? `<p class="sub center" style="margin:0 0 8px">${_t('Antippen zum Überspringen')}</p>` : ''}
  <div class="odds">${pool.map(p => `<span style="--c:${p.c}">${esc(p.n)} <b>${_t('{n} %', { n: (p.w / tot * 100).toLocaleString(LOCALE, { maximumFractionDigits: p.w / tot < .01 ? 1 : 0 }) })}</b></span>`).join('')}</div>`;
}
function openTemple(result) {
  const free = freeSpin(), busy = ROLL && ROLL.anim, src = ROLL ? ROLL.src : 'wheel', res = result || (ROLL && !ROLL.anim ? ROLL.res : null);
  stationShell('tempel', `<div class="kv"><span class="pill" style="background:#ffd24a"><i class="fc"></i> ${P.fate === 1 ? _t('1 GLÜCKSMÜNZE') : _t('{n} GLÜCKSMÜNZEN', { n: P.fate })}</span><span class="pill dim">${_t('REINER ZUFALL')}</span></div>
  <h3>${src === 'wheel' ? _t('GLÜCKSROLLE') : esc(CHESTS.find(c => c.id === src).n).toLocaleUpperCase(LOCALE)}</h3>${rollHTML(src)}
  ${res && !busy ? `<div class="detail center rollres" style="box-shadow:inset 0 0 0 2px ${res.c}"><div class="nm" style="color:${res.c}">${esc(res.t)}</div>${res.it ? itemDetail(res.it, '') : ''}</div>` : ''}
  <div class="menu two"><button class="btn" data-act="spin" ${!busy && (P.fate >= 1 || free) ? '' : 'disabled'}>${free === 'day' ? _t('Gratis-Dreh der Glückswoche!') : free ? _t('Gratis drehen!') : _t('Glücksrolle drehen (1 {coin})', { coin: '<i class="fc"></i>' })}</button><button class="btn alt" data-act="coin" ${!busy && P.gold >= coinPrice() ? '' : 'disabled'}>${_t('1 {coin} kaufen ({gold} Gold)', { coin: '<i class="fc"></i>', gold: coinPrice() })}</button></div>
  <h3>${_t('SCHICKSALSTRUHEN')}</h3>${CHESTS.map(C => { const price = C.coins ? C.coins + ' <i class="fc"></i>' : _t('{n} Gold', { n: 250 + P.lv * 15 }), ok = !busy && (C.coins ? P.fate >= C.coins : P.gold >= 250 + P.lv * 15); return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['s', C.id === 'bronze' ? 304 : C.id === 'gold' ? 320 : 336, 416, 16, 16])}" alt="" style="${C.id === 'drache' ? 'filter:hue-rotate(-30deg) saturate(1.6)' : ''}"></div><div><div class="nm">${C.n}</div><div class="st">${C.d}</div></div><div class="acts"><button class="btn sm" data-act="chest" data-id="${C.id}" ${ok ? '' : 'disabled'}>${price}</button></div></div>`; }).join('')}
  <p class="sub">${_t('Glücksmünzen gibt es von Bossen, Champions, seltenen Truhen, der Tages-Challenge und Schreinen Fortunas. Jede Drehung ist reiner Zufall mit den gezeigten Chancen – Mythisch kann beim ersten Dreh kommen oder erst nach sehr vielen.')}</p>`, true);
  if (busy) requestAnimationFrame(rollRun);
  else if (ROLL && ROLL.off == null && $('roll')) { rollPlace(ROLL, $('roll'), $('rollStrip'), false); $('rollStrip').style.transform = `translateX(${-ROLL.off}px)`; }
}
// Rolle starten: Gewinn steht fest (bereits gutgeschrieben), Kacheln drumherum zufällig
function rollStart(src, winTile, res) {
  const pool = rollPool(src), tiles = Array.from({ length: ROLL_N }, () => rollDraw(pool));
  tiles[ROLL_WIN] = winTile;
  ROLL = { src, tiles, win: ROLL_WIN, off: null, anim: true, res, last: -1 };
  openTemple();
}
// Endposition aus den echten Kacheln messen (unabhängig von Schriftgröße und CSS), leicht neben der Mitte
function rollPlace(R, box, st, jitter) {
  const T0 = st.children[0], TW = st.children[R.win];
  R.off = TW.offsetLeft - T0.offsetLeft + TW.offsetWidth / 2 - box.clientWidth / 2 + (jitter ? Math.round(rnd(-.38, .38) * TW.offsetWidth) : 0);
}
function rollRun() {
  const R = ROLL, box = $('roll'), st = $('rollStrip'); if (!R || !R.anim || !box || !st) return;
  const vw = box.clientWidth, step = st.children[1].offsetLeft - st.children[0].offsetLeft;
  rollPlace(R, box, st, true);
  const calm = (SAVE.meta.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches), dur = calm ? 1300 : 5200;
  st.style.transition = `transform ${dur}ms cubic-bezier(.06,.62,.14,1)`; void st.offsetWidth; st.style.transform = `translateX(${-R.off}px)`;
  R.end = performance.now() + dur;
  const tick = () => {
    if (ROLL !== R || !R.anim) return;
    const box2 = $('roll'), st2 = $('rollStrip');
    if (!box2 || !st2) { rollFinish(R, true); return; }
    const x = -new DOMMatrixReadOnly(getComputedStyle(st2).transform).m41, i = Math.floor((x + vw / 2 + ROLL_GAP / 2) / step);
    if (i !== R.last) { R.last = i; sfx('tick'); }
    if (performance.now() >= R.end) rollFinish(R); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
ON.rollskip = () => { if (ROLL && ROLL.anim) rollFinish(ROLL); };
function rollFinish(R, away) {
  if (!R.anim) return; R.anim = false;
  const k = R.tiles[R.win].k, res = R.res;
  sfx(k === 'myth' ? 'myth' : ['leg', 'set', 'cos'].includes(k) ? 'loot' : 'coin'); if (k === 'myth') shake(6);
  if (away || !$('roll')) { toast(res.t, res.c); checkAch(); return; } // Tempel schon verlassen: Gewinn als Hinweis
  openTemple(res); checkAch();
}
function wheelPick() {
  SAVE.meta.luck.spins++; stat('spins');
  const W = {}; WHEEL.forEach(w => W[w.k] = w.w); return wpick(W);
}
function grantCosmetic() { const free = Object.keys(COSM).filter(k => !SAVE.meta.cos.includes(k)); if (!free.length) { gainFate(4); return _t('Alle Kosmetik gesammelt – 4 Glücksmünzen zurück'); } const k = pick(free); SAVE.meta.cos.push(k); statMax('cosm', SAVE.meta.cos.length); persist(); return _t('Kosmetik: {name} (im Spiegel anlegen)', { name: COSM[k].n }); }
function wheelReward(k) {
  const st = stageNum(), W = WHEEL.find(w => w.k === k), res = { c: W.c, t: W.n };
  const give = it => { addToBag(it); res.it = it; if (it.rar === 4) stat('legs'); };
  switch (k) {
    case 'gold': { const g = 150 + st * 30; P.gold += g; res.t = _t('+{n} Gold', { n: g }); break; }
    case 'mats': { const ms = MONMATS.slice(0, Math.min(MONMATS.length, 6 + Math.floor(st / 6))), got = []; for (let i = 0; i < 3; i++) { const m = pick(ms), n = ri(2, 4); gainMat(m, n); got.push(n + ' ' + MATS[m].n); } res.t = got.join(', '); break; }
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
function rolling() { return !!(ROLL && ROLL.anim); }
function doSpin() {
  if (ROLL && ROLL.anim) return; const free = freeSpin();
  if (!free && P.fate < 1) return; if (free === 'act') P.story['spin' + P.act] = 1; else if (free === 'day') SAVE.meta.luck.day = dayKey(); else P.fate--;
  const k = wheelPick(), r = wheelReward(k); saveChar(); persist();
  rollStart('wheel', rollPool('wheel').find(p => p.k === k), r);
}
function openChestLuck(id) {
  if (ROLL && ROLL.anim) return;
  const C = CHESTS.find(c => c.id === id), price = 250 + P.lv * 15, st = stageNum();
  if (C.coins) { if (P.fate < C.coins) return; P.fate -= C.coins; } else { if (P.gold < price) return; P.gold -= price; }
  const win = rollDraw(rollPool(id)), rarOf = { mag: 1, rare: 2, epic: 3, leg: 4, myth: 6 };
  const res = { c: win.c, t: C.n };
  if (win.k === 'myth') res.it = makeMythic();
  else if (win.k === 'cos') res.t = grantCosmetic();
  else { const rar = rarOf[win.k]; res.it = randomItem(id === 'drache' ? st + 6 : st, rar, id === 'drache' ? { setChance: .1 } : {}); res.it.rar = Math.max(res.it.rar, rar); }
  if (id === 'drache') { if (Math.random() < .15) res.t += ' · ' + grantCosmetic(); if (typeof eggGive === 'function' && Math.random() < .1) { const g = eggGive(null, true, { luck: 1.5 }); if (g) res.t += ' · ' + (g.tier != null && typeof PET_TIERS !== 'undefined' ? _t('Begleiter-Ei: {egg}!', { egg: PET_TIERS[g.tier].egg }) : _t('Ein Begleiter-Ei!')); } }
  if (res.it) { if (res.it.rar === 4 && !res.it.name) res.it.name = pick(LEGEND[res.it.slot === 'weapon' ? res.it.base : res.it.slot]); addToBag(res.it); if (res.it.rar === 4) stat('legs'); res.c = RAR[res.it.rar].c; if (res.it.rar === 6) statMax('myths', 1); }
  sfx('chest'); saveChar(); persist();
  rollStart(id, win, res);
}
