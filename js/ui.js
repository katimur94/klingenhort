'use strict';
/* =========================================================
   KLINGENHORT – Oberfläche: HUD, Menüs, Eingabe, Hauptschleife
   ========================================================= */

let state = 'load';
// Updates der installierten App: on = Service Worker aktiv, ready = neue Version übernommen, manual = Spieler hat selbst gesucht
const UPD = { on: false, reg: null, had: false, ready: false, manual: false, done: false, last: 0 };
function setState(s) { state = s; if (UPD.ready && (s === 'title' || s === 'map')) applyUpdate(); }
function applyUpdate() {
  if (UPD.done) return; UPD.done = true;
  try { if (state === 'map') saveChar(); else persist(); } catch (_) { }
  location.reload();
}
const ov = $('ov'), panel = $('panel');
let returnTo = null;
document.head.insertAdjacentHTML('beforeend', '<style>@keyframes idle4{from{background-position-x:0}to{background-position-x:var(--to)}}</style>');

/* ---------- Helfer für Menüs ---------- */
function showOverlay(html, wide) { panel.className = 'panel' + (wide ? ' wide' : ''); panel.innerHTML = html; ov.hidden = false; panel.scrollTop = 0; const f = panel.querySelector('.btn:not(:disabled)'); if (f && !isTouch) f.focus({ preventScroll: true }); }
function hideOverlay() { ov.hidden = true; }
function spriteHTML(cls, at, ht, dye, s) {
  const st = charStrip(cls, at, ht, dye), url = st.url || (st.url = st.c.toDataURL());
  return `<i class="spr" style="width:${st.w * s}px;height:${st.h * s}px;background-image:url(${url});background-size:${st.c.width * s}px ${st.h * s}px;--to:-${st.w * 4 * s}px;animation:idle4 .7s steps(4) infinite"></i>`;
}
function costHTML(c, gold) {
  let h = '<div class="cost">';
  for (const k in c) { const ok = (P.mats[k] || 0) >= c[k]; h += `<span class="${ok ? '' : 'bad'}"><img src="${iconURL(['mat', k])}" alt="">${P.mats[k] || 0}/${c[k]} ${MATS[k].n}</span>`; }
  if (gold) h += `<span class="${P.gold >= gold ? '' : 'bad'}"><i class="coin"></i>${gold}</span>`;
  return h + '</div>';
}
function itemSlot(it, act, sel) { return `<button class="slot${sel ? ' row sel' : ''}" data-act="${act}" data-id="${it.uid}" style="box-shadow:inset 0 0 0 2px ${itemColor(it)}${sel ? ',0 0 0 2px #e8b04a' : ''}" aria-label="${esc(itemName(it))}"><img src="${itemIconURL(it)}" alt="">${it.up ? `<span class="u">+${it.up}</span>` : ''}${it.gems.length ? `<span class="n">◆${it.gems.length}</span>` : ''}</button>`; }
function itemDetail(it, actions) { return `<div class="detail"><div class="nm" style="color:${itemColor(it)}">${esc(itemName(it))}</div><div class="st" style="color:var(--parch-dim);font-size:16px">${RAR[it.rar].n} ${it.slot === 'weapon' ? WT[it.base].label : AR[it.slot].label} · Stufe ${it.tier + 1}${canEquip(it) ? '' : ' · <span style="color:var(--blood)">nicht für deine Klasse</span>'}</div><ul>${itemLines(it).map(l => '<li>' + esc(l) + '</li>').join('')}</ul><div class="acts" style="justify-content:flex-start">${actions || ''}</div></div>`; }
function findItem(id) { for (const s of ['weapon', 'armor', 'helm']) if (P.gear[s] && P.gear[s].uid === id) return { it: P.gear[s], eq: s }; const i = P.bag.findIndex(x => x.uid === id); return i >= 0 ? { it: P.bag[i], bi: i } : null; }
const HELP = isTouch
  ? '<b>STEUERUNG</b>Linke Hälfte ziehen: laufen. Rechts: Angriff halten (3er-Kombo), Rolle, drei Fähigkeiten, Ultimative (goldene Wut-Leiste) und Trank. Angriffe zielen automatisch.'
  : '<b>STEUERUNG</b>WASD laufen · J/Leertaste/Klick angreifen · K/Shift ausweichen · 1 2 3 Fähigkeiten · F Ultimative · H Trank · C Charakter · Esc Pause';
const CREDIT = '<p class="credit">Grafik: „16x16 DungeonTileset II“ von 0x72, Zauber-Effekte „Pixel Art Spells“, „Pixel Art Sword Slash“ und Explosionen von OpenGameArt – alle CC0.</p>';

/* ---------- HUD ---------- */
const hudCache = {};
function setT(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setW(id, v) { const s = clamp(v, 0, 100).toFixed(1) + '%'; if (hudCache[id] !== s) { hudCache[id] = s; $(id).style.width = s; } }
function showHud(on) { $('hud').hidden = !on; $('skillbar').hidden = !on; $('touch').hidden = !on; $('objective').hidden = !on; if (!on) $('combo').classList.remove('on'); if (on) { buildSkillUI(); lastRage = -1; } }
function buildSkillUI() {
  const C = CLASSES[P.cls], ids = C.skills.concat([C.ult]);
  let h = ''; ids.forEach((id, i) => { const S = SKILLS[id]; h += `<div class="sk${S.ult ? ' ult' : ''}" id="sk${i}"><img src="${iconURL(S.icon)}" alt=""><i class="cdv"></i><span class="k">${S.ult ? 'F' : i + 1}</span>${S.cost ? `<span class="c">${S.cost}</span>` : ''}</div>`; });
  h += `<div class="sk" id="skP"><img src="${iconURL(['s', 288, 336, 16, 16])}" alt=""><i class="cdv"></i><span class="k">H</span><span class="c" id="skPn" style="color:var(--gold)">${P.potions}</span></div>`;
  $('skillbar').innerHTML = h;
  ['bS1', 'bS2', 'bS3'].forEach((b, i) => { $(b).querySelector('img').src = iconURL(SKILLS[C.skills[i]].icon); });
  $('bUlt').querySelector('img').src = iconURL(SKILLS[C.ult].icon);
  $('bPot').querySelector('img').src = iconURL(['s', 288, 336, 16, 16]);
  $('resFill').style.background = C.res.col; $('hudLv').classList.toggle('hc', !!P.hc);
  updWeaponUI();
}
function updWeaponUI() { const it = P.gear.weapon; $('atkImg').src = itemIconURL(it); }
let lastRage = -1;
function updHud() {
  setT('hudLv', (P.lv >= 50 ? 'P' + P.paragon : 'LV ' + P.lv));
  setW('hpFill', 100 * P.hp / P.st.hp); setT('hpTxt', Math.ceil(P.hp) + '/' + P.st.hp);
  setW('resFill', 100 * P.res / P.st.resMax);
  setW('xpFill', P.lv >= 50 ? 100 * P.pxp / PARAGON_XP : 100 * P.xp / xpNext(P.lv)); setT('hudGold', fmt(P.gold));
  if (G) { setT('hudAct', G.daily ? 'TAGES-CHALLENGE' : 'AKT ' + P.act + (qualOf(P.act) ? ' · QUAL ' + qualOf(P.act) : '') + ' · ' + G.stage); setT('hudRoom', (NODE[G.type] ? NODE[G.type].n : G.type === 'rescue' ? 'Befreiung' : 'Fluch').toUpperCase() + (G.waves.length > 1 ? ' ' + Math.max(1, G.wi + 1) + '/' + G.waves.length : '')); }
  const b = enemies.find(e => e.boss); if (b) setW('bossFill', 100 * Math.max(0, b.hp) / b.maxHp);
  const r = Math.floor(P.rage);
  if (r !== lastRage) { lastRage = r; setW('rageFill', r); $('rageBar').classList.toggle('full', r >= 100); const u = $('bUlt'); u.style.setProperty('--f', r + '%'); u.classList.toggle('ready', r >= 100); const s3 = $('sk3'); if (s3) s3.classList.toggle('ready', r >= 100); }
  const C = CLASSES[P.cls];
  for (let i = 0; i < 3; i++) {
    const S = SKILLS[C.skills[i]], cdp = P.cds[i] > 0 ? (P.cds[i] / skillCd(i) * 100) : 0, nores = P.res < S.cost;
    const tb = $('bS' + (i + 1)); tb.style.setProperty('--cd', cdp.toFixed(0) + '%'); tb.classList.toggle('nores', nores);
    const sk = $('sk' + i); if (sk) { sk.style.setProperty('--cd', cdp.toFixed(0) + '%'); sk.classList.toggle('nores', nores); }
  }
  const pcd = P.potCd > 0 ? P.potCd / 6 * 100 : 0; $('bPot').style.setProperty('--cd', pcd + '%'); const sp = $('skP'); if (sp) sp.style.setProperty('--cd', pcd + '%');
  setT('potN', String(P.potions)); if ($('skPn')) $('skPn').textContent = P.potions;
}
let lastChain = 0;
function comboUI() { const c = $('combo'); if (P.chain >= 3) { $('comboN').textContent = P.chain; c.classList.add('on'); if (P.chain !== lastChain) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); } } else c.classList.remove('on'); lastChain = P.chain; }

/* ---------- Erfolge ---------- */
function achStats() {
  const s = Object.assign({}, SAVE.meta.stats);
  s.rebirths = Math.max(s.rebirths || 0, P ? P.rebirths : 0);
  const lv10 = new Set(); for (const c of SAVE.chars) if (c.lv >= 10) lv10.add(c.cls); if (P && P.lv >= 10) lv10.add(P.cls); s.clsLv10 = lv10.size;
  return s;
}
function checkAch() {
  if (!SAVE) return; const s = achStats();
  for (const a of ACH) { if (SAVE.meta.ach[a.id]) continue; try { if (a.t(s)) { SAVE.meta.ach[a.id] = Date.now(); if (P && SAVE.active >= 0) P.gold += a.r; toast('Erfolg: ' + a.n + ' (+' + a.r + ' Gold)', '#ffd24a'); sfx('ach'); } } catch (e) { } }
  persist();
}

/* ---------- Titel ---------- */
let confirmDel = -1;
function titleScene() {
  if (!P || SAVE.active < 0) { P = Object.assign(newRuntime(), newChar('knight', 'Ritter')); computeStats(); P.hp = P.st.hp; }
  G = { ambT: 0 }; prepArena(1 + Math.floor(Math.random() * 4), 4242);
  P.x = AW / 2; P.y = (BD.y0 + BD.y1) / 2; enemies = []; projs = []; pickups = []; corpses = []; fx = []; spikes = []; allies = [];
  obs = [{ k: 'col', x: AW / 2 - 50, y: P.y - 6, r: 7, solid: true }, { k: 'col', x: AW / 2 + 50, y: P.y - 6, r: 7, solid: true }, { k: 'chest', x: AW / 2 + 26, y: P.y + 18, r: 6, solid: true, open: 0 }, { k: 'vein', mat: 'kristall', x: AW / 2 - 30, y: P.y + 22, r: 7, solid: true, hp: 3, flash: 0 }];
  cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - VH / 2, 0, Math.max(0, AH - VH));
}
function showTitle() {
  setState('title'); showHud(false); $('bossbar').hidden = true; setMusic(45, false); G = G && G.ambT !== undefined && !G.type ? G : { ambT: 0 };
  let chars = '';
  SAVE.chars.forEach((c, i) => {
    const C = CLASSES[c.cls];
    chars += `<div class="cardrow">${spriteHTML(c.cls, c.gear.armor ? c.gear.armor.tier : 0, c.gear.helm ? c.gear.helm.tier : 0, c.dye, 2)}<div><div style="font-size:21px">${esc(c.name)} ${c.hc ? '<span class="pill hc">HC</span>' : ''}</div><div style="font-size:16px;color:var(--parch-dim)">${C.name} · LV ${c.lv}${c.paragon ? ' · P' + c.paragon : ''} · Akt ${c.act}${qualOf(c.act) ? ' (Qual ' + qualOf(c.act) + ')' : ''} · ${DIFFS[c.diff].n}${c.rebirths ? ' · ★' + c.rebirths : ''}</div></div><div class="acts">${confirmDel === i ? `<button class="btn red sm" data-act="delok" data-i="${i}">Löschen!</button><button class="btn alt sm" data-act="delno">Nein</button>` : `<button class="btn sm" data-act="play" data-i="${i}">Spielen</button><button class="btn alt sm" data-act="delchar" data-i="${i}" aria-label="Löschen">✕</button>`}</div></div>`;
  });
  showOverlay(`<h1 class="logo">KLINGEN<br>HORT</h1>
  <p class="tag">Wähle Ritter, Magier, Assassine oder Bogenschütze und kämpf dich über die Weltkarte durch vier Lande – und danach durch endlose Qual-Stufen.</p>
  ${chars ? '<h3>DEINE HELDEN</h3>' + chars : ''}
  <div class="menu two" style="margin-top:10px">
    <button class="btn" data-act="new">Neuer Held</button>
    <button class="btn alt" data-act="daily" ${SAVE.active >= 0 || SAVE.chars.length ? '' : 'disabled'}>Tages-Challenge</button>
    <button class="btn alt" data-act="ach">Erfolge</button>
    <button class="btn alt" data-act="best">Bestiarium</button>
    <button class="btn alt" data-act="hall">Ruhmeshalle</button>
    <button class="btn alt" data-act="code">Spielstand übertragen</button>
    <button class="btn alt" data-act="settings">Einstellungen</button>
    ${installBtn()}
  </div>
  <div class="help">${HELP}</div>${CREDIT}<p class="credit">Version ${VERSION}</p>`);
}

/* ---------- Charaktererstellung ---------- */
let CS = { cls: 'knight', diff: 'normal', hc: false, name: '' };
function showCreate() {
  let cl = ''; for (const k in CLASSES) { const C = CLASSES[k]; cl += `<button class="cls${CS.cls === k ? ' sel' : ''}" data-act="ccls" data-id="${k}">${spriteHTML(k, 1, 1, null, 3)}<b>${C.name}</b><small>${C.desc}</small></button>`; }
  let df = ''; for (const k in DIFFS) df += `<button class="opt${CS.diff === k ? ' sel' : ''}" data-act="cdiff" data-id="${k}">${DIFFS[k].n}<small>${DIFFS[k].d}</small></button>`;
  const C = CLASSES[CS.cls];
  showOverlay(`<div class="head"><h2>NEUER HELD</h2><button class="btn alt sm" data-act="backtitle">Zurück</button></div>
  <h3>KLASSE</h3><div class="classes">${cl}</div>
  <div class="box" style="margin-bottom:10px"><b style="font-family:var(--f-display);font-size:8px;font-weight:400">${C.name.toUpperCase()}</b> · ${C.res.name} · ${C.weapons.map(w => WT[w].label).join(', ')}<div style="font-size:16px;color:var(--parch-dim);margin-top:4px">${C.skills.map(s => SKILLS[s].n).join(' · ')} · Ultimative: ${SKILLS[C.ult].n}</div></div>
  <h3>NAME</h3><input type="text" id="cname" maxlength="16" placeholder="${C.name}" value="${esc(CS.name)}">
  <h3>SCHWIERIGKEIT</h3><div class="opts">${df}</div>
  <div class="opts"><button class="opt${CS.hc ? ' sel' : ''}" data-act="chc">HARDCORE ${CS.hc ? 'AN' : 'AUS'}<small>Ein Tod löscht den Helden. Dafür Ruhm in der Ruhmeshalle.</small></button></div>
  <div class="menu"><button class="btn" data-act="cstart">Abenteuer beginnen</button></div>`, true);
}

/* ---------- Weltkarte ---------- */
let mapSel = -1;
function openMap() {
  setState('map'); showHud(false); $('bossbar').hidden = true; G = null;
  if (!P.map || P.map.act !== P.act) { P.map = genMap(P.act); saveChar(); }
  const M = P.map, av = availableNodes(), b = biomeOf(P.act);
  if (!av.includes(mapSel)) mapSel = av.length === 1 ? av[0] : -1;
  let lines = '', nodes = '';
  const pos = (r, i) => [(r + .5) / 7 * 100, (i + .5) / M.rows[r].length * 100];
  M.rows.forEach((row, r) => row.forEach((n, i) => { for (const j of n.links) { const [x1, y1] = pos(r, i), [x2, y2] = pos(r + 1, j); const lit = n.done && (M.rows[r + 1][j].done || (M.pos.r === r + 1 && M.pos.i === j)); lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lit ? '#e8b04a' : '#4a4058'}" stroke-width="${lit ? 2 : 1.2}" vector-effect="non-scaling-stroke"/>`; } }));
  M.rows.forEach((row, r) => row.forEach((n, i) => {
    const [x, y] = pos(r, i), N = NODE[n.t], isAv = (M.pos.r + 1 === r) && av.includes(i), cur = M.pos.r === r && M.pos.i === i;
    nodes += `<button class="node${isAv ? ' av' : ''}${n.done ? ' done' : ''}${cur ? ' cur' : ''}${!isAv && !n.done && !cur ? ' dim' : ''}${mapSel === i && isAv ? ' cur' : ''}" style="left:${x}%;top:${y}%;--c:${N.c}" ${isAv ? `data-act="msel" data-i="${i}"` : 'tabindex="-1"'} aria-label="${N.n}"><img src="${iconURL(N.icon)}" alt=""></button>`;
  }));
  const selN = mapSel >= 0 ? M.rows[M.pos.r + 1][mapSel] : null;
  const legend = ['kampf', 'elite', 'ueberleben', 'schatz', 'goblin', 'dunkel', 'haendler', 'schrein', 'werkbank', 'event', 'boss'].map(k => `<span><img src="${iconURL(NODE[k].icon)}" alt="">${NODE[k].n}</span>`).join('');
  showOverlay(`<div class="head"><h2>AKT ${P.act} · ${b.name.toUpperCase()}${qualOf(P.act) ? ' · QUAL ' + qualOf(P.act) : ''}</h2><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div></div>
  <div class="stats"><span>${esc(P.name)} · ${CLASSES[P.cls].name}</span><span>LV ${P.lv}${P.paragon ? ' · P' + P.paragon : ''}</span><span>LP ${Math.ceil(P.hp)}/${P.st.hp}</span><span>TRÄNKE ${P.potions}</span>${P.sp ? `<span style="color:var(--gold)">${P.sp} TALENTPUNKT${P.sp > 1 ? 'E' : ''}</span>` : ''}${P.buffs.map(b => `<span style="color:var(--rune)">${b.n} (${b.rooms})</span>`).join('')}</div>
  <div class="mapwrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}</div>
  ${selN ? `<div class="detail"><div class="nm" style="color:${NODE[selN.t].c}">${NODE[selN.t].n}</div><div style="font-size:17px">${NODE[selN.t].d}</div><div class="acts" style="justify-content:flex-start;margin-top:8px"><button class="btn" data-act="enter">Betreten</button></div></div>` : `<p class="sub">Wähle den nächsten Ort auf der Karte.</p>`}
  <div class="menu two"><button class="btn alt" data-act="char">Charakter${P.sp ? ' (' + P.sp + ')' : ''}</button><button class="btn alt" data-act="daily">Tages-Challenge</button><button class="btn alt" data-act="title">Hauptmenü</button></div>
  <div class="legend">${legend}</div>`, true);
  checkAch();
}
function openActScreen() {
  setState('menu'); showHud(false);
  const q = qualOf(P.act);
  showOverlay(`<div class="center"><h2>AKT ${P.act - 1} BEZWUNGEN</h2><p class="sub">${BOSSES[(P.act - 2) % 4].name} ist gefallen. ${q ? 'Ab jetzt beginnt Qual ' + q + ': Gegner +' + Math.round((Math.pow(1.3, q) - 1) * 100) + ' % stärker, bessere Beute.' : 'Weiter geht es: ' + biomeOf(P.act).name + '.'}</p>
  <div class="menu"><button class="btn" data-act="actnext">Weiter zu Akt ${P.act}</button><button class="btn alt" data-act="actwb">Zuerst zur Werkbank</button></div></div>`);
}

/* ---------- Charakterbildschirm ---------- */
let charTab = 'gear', selItem = null;
function openChar(tab, back) {
  if (tab) charTab = tab; if (back) returnTo = back;
  setState('menu'); showHud(false); computeStats();
  const C = CLASSES[P.cls], st = P.st;
  const tab_ = (k, l) => `<button class="tab" role="tab" aria-selected="${charTab === k}" data-act="ctab" data-id="${k}">${l}</button>`;
  let body = '';
  if (charTab === 'gear') {
    const sel = selItem && findItem(selItem);
    let gear = ''; for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; gear += `<div style="text-align:center"><div style="font-size:14px;color:var(--parch-dim)">${s === 'weapon' ? 'Waffe' : AR[s].label}</div>${it ? itemSlot(it, 'isel', sel && sel.it === it) : ''}</div>`; }
    const sets = {}; for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; if (it && it.set) sets[it.set] = (sets[it.set] || 0) + 1; }
    body = `<div class="cols"><div class="box"><div style="display:flex;gap:12px;align-items:center">${spriteHTML(P.cls, P.gear.armor.tier, P.gear.helm.tier, P.dye, 4)}<div class="stats" style="flex:1"><span>SCH ${Math.round(st.wbase * st.dmgMul)}</span><span>LP ${st.hp}</span><span>VER ${Math.round(st.def)}</span><span>KRIT ${pct(st.crit)}</span><span>KRIT-SCH ${pct(st.critdmg)}</span><span>TEMPO ${(1 / st.cd).toFixed(1)}/s</span>${st.dr ? `<span>MINDERUNG ${pct(st.dr)}</span>` : ''}${st.dodge ? `<span>AUSWEICHEN ${pct(st.dodge)}</span>` : ''}${st.regen ? `<span>REGEN ${st.regen.toFixed(1)}</span>` : ''}${st.leech ? `<span>LEBENSRAUB ${pct(st.leech)}</span>` : ''}${st.gold ? `<span>GOLD +${pct(st.gold)}</span>` : ''}</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">${gear}</div>
      ${Object.keys(sets).map(k => `<p style="font-size:16px;color:#4ade80;margin:8px 0 0">${SETS[k].n} ${sets[k]}/3 – ${sets[k] >= 2 ? SETS[k].d2 : ''}${sets[k] >= 3 ? ' · ' + SETS[k].d3 : ''}</p>`).join('')}</div>
      <div class="box"><h3 style="margin-top:0">BEUTEL ${P.bag.length}/30</h3><div class="grid">${P.bag.map(it => itemSlot(it, 'isel', sel && sel.it === it)).join('') || '<p class="sub">Leer</p>'}</div></div></div>
      ${sel ? itemDetail(sel.it, sel.eq ? '' : `${canEquip(sel.it) ? `<button class="btn sm" data-act="equip" data-id="${sel.it.uid}">Anlegen</button>` : ''}<button class="btn alt sm" data-act="sell" data-id="${sel.it.uid}">Verkaufen <i class="coin"></i>${itemPrice(sel.it)}</button>`) : '<p class="sub">Tippe einen Gegenstand an, um Details zu sehen.</p>'}`;
  } else if (charTab === 'tal') {
    body = `<div class="head"><p class="sub" style="margin:0">Freie Punkte: <b style="color:var(--gold)">${P.sp}</b> · 1 Punkt pro Level</p><button class="btn alt sm" data-act="respec" ${spentPoints() ? '' : 'disabled'}>Zurücksetzen (${respecCost()} Gold)</button></div><div class="tree">`;
    TALENTS[P.cls].forEach(([bn, nodes], bi) => {
      body += `<div class="branch"><h4>${bn.toUpperCase()}</h4>`;
      nodes.forEach((n, ni) => { const s = talentState(P.cls, bi, ni); body += `<button class="tal${s.locked ? ' lock' : ''}${s.can ? ' can' : ''}${s.r >= n.max ? ' max' : ''}" data-act="tal" data-id="${bi},${ni}"><span class="r">${s.r}/${n.max}</span><b>${n.n}</b><small>${n.d}${n.max > 1 ? ' je Rang' : ''}</small></button>`; });
      body += '</div>';
    });
    body += '</div>';
    body += `<h3>FÄHIGKEITEN</h3>${C.skills.concat([C.ult]).map(id => { const S = SKILLS[id]; return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(S.icon)}" alt=""></div><div><div class="nm">${S.n}${S.ult ? ' (Ultimative)' : ''}</div><div class="st">${S.d}${S.cost ? ' · ' + S.cost + ' ' + C.res.name + ' · ' + S.cd + ' s' : ' · bei voller Wut'}</div></div><span></span></div>`; }).join('')}`;
  } else if (charTab === 'vorrat') {
    body = `<h3>MATERIALIEN</h3><div class="grid">${MATORDER.map(k => `<div class="slot" title="${MATS[k].n}" style="cursor:default"><img src="${iconURL(['mat', k])}" alt="${MATS[k].n}"><span class="n">${P.mats[k] || 0}</span></div>`).join('')}</div>
    <p style="font-size:15px;color:var(--parch-dim)">${MATORDER.map(k => MATS[k].n + ' ' + (P.mats[k] || 0)).join(' · ')}</p>
    <h3>EDELSTEINE</h3>${gemListHTML(false)}<h3>TRÄNKE</h3><p class="sub">${P.potions} Heiltränke (heilen 45 %, 6 s Abklingzeit). An der Werkbank brauen oder beim Händler kaufen.</p>`;
  } else if (charTab === 'para') {
    const free = P.paragon - (P.pp.dmg + P.pp.hp + P.pp.def + P.pp.crit);
    body = `<p class="sub">Ab Level 50 sammelst du Paragon-Erfahrung. Jeder Paragon-Level gibt einen Punkt – ohne Obergrenze.</p><div class="stats"><span>PARAGON ${P.paragon}</span><span>FREI ${free}</span><span>EP ${fmt(P.pxp)}/${fmt(PARAGON_XP)}</span></div>
    ${[['dmg', 'Schaden +1 %'], ['hp', 'Lebenspunkte +1 %'], ['def', 'Verteidigung +1'], ['crit', 'Krit +0,2 %']].map(([k, l]) => `<div class="row" style="cursor:default"><div class="ic" style="font-family:var(--f-display);font-size:9px">${P.pp[k]}</div><div><div class="nm">${l}</div></div><button class="btn sm" data-act="pp" data-id="${k}" ${free > 0 ? '' : 'disabled'}>+1</button></div>`).join('')}
    <h3>WIEDERGEBURT</h3><p class="sub">Ab Level 50 und Akt 5: zurück auf Level 1 und Akt 1. Ausrüstung, Materialien, Gold und Paragon bleiben. Dauerhaft +10 % Schaden und LP pro Wiedergeburt und eine goldene Aura. Bisher: ${P.rebirths}.</p>
    <button class="btn red" data-act="rebirth" ${P.lv >= 50 && P.maxAct >= 5 ? '' : 'disabled'}>Wiedergeburt</button>`;
  }
  showOverlay(`<div class="head"><h2>${esc(P.name).toUpperCase()}</h2><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div></div>
  <div class="stats"><span>${C.name}</span><span>LV ${P.lv}</span><span>EP ${fmt(P.xp)}/${fmt(xpNext(P.lv))}</span><span>${DIFFS[P.diff].n}${P.hc ? ' · HARDCORE' : ''}</span><span>KILLS ${fmt(P.stats.kills)}</span></div>
  <div class="tabs" role="tablist">${tab_('gear', 'AUSRÜSTUNG')}${tab_('tal', 'TALENTE' + (P.sp ? ' (' + P.sp + ')' : ''))}${tab_('vorrat', 'VORRAT')}${tab_('para', 'PARAGON')}</div>
  ${body}<div class="menu" style="margin-top:12px"><button class="btn" data-act="cback">Zurück</button></div>`, true);
}
function gemListHTML(withAct) {
  let h = '', any = false;
  for (const id of GEMORDER) for (let gr = 0; gr < 5; gr++) { const k = id + ':' + gr, n = P.gems[k] || 0; if (!n) continue; any = true; h += `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['gem', id, gr])}" alt=""></div><div><div class="nm" style="color:${GEMS[id].c}">${GEMGRADE[gr]} ${GEMS[id].n} ×${n}</div><div class="st">${GEMS[id].s(GEMS[id].v[gr])}</div></div><div class="acts">${withAct === 'sock' ? `<button class="btn sm" data-act="sock" data-id="${k}">Einsetzen</button>` : withAct === 'comb' && gr < 4 ? `<button class="btn sm" data-act="gcomb" data-id="${id},${gr}" ${n >= 3 && P.gold >= 20 * (gr + 1) * (gr + 1) ? '' : 'disabled'}>3 → 1 (${20 * (gr + 1) * (gr + 1)} G)</button>` : ''}</div></div>`; }
  return any ? h : '<p class="sub">Keine Edelsteine. Elite-Gegner, Truhen, Erzadern und Bosse lassen welche fallen.</p>';
}

/* ---------- Werkbank ---------- */
let wbTab = 'up', wbFree = false;
function openWorkbench(fromNode) {
  if (fromNode !== undefined) wbFree = !!fromNode;
  setState('menu'); showHud(false); computeStats();
  const tab_ = (k, l) => `<button class="tab" role="tab" aria-selected="${wbTab === k}" data-act="wtab" data-id="${k}">${l}</button>`;
  const all = ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean).concat(P.bag);
  if (!selItem || !findItem(selItem)) selItem = P.gear.weapon.uid;
  const sel = findItem(selItem), it = sel.it;
  const list = `<div class="grid" style="margin-bottom:8px">${all.map(x => itemSlot(x, 'wsel', x === it)).join('')}</div>`;
  let body = '';
  if (wbTab === 'up') {
    const c = it.up < 10 ? upCost(it, it.up + 1) : null;
    body = list + itemDetail(it, '') + (c ? `<h3>AUFWERTEN AUF +${it.up + 1}</h3>${costHTML(c.mats, c.gold)}<p class="sub">Erfolgschance: <b style="color:${c.chance < 1 ? 'var(--gold)' : 'var(--moss)'}">${Math.round(c.chance * 100)} %</b>. Bei Misserfolg sind die Materialien weg, der Gegenstand bleibt. Ab +5 leuchtet deine Ausrüstung, ab +8 bekommt sie eine Aura.</p><button class="btn" data-act="up" ${canAfford(c.mats, c.gold) ? '' : 'disabled'}>Aufwerten</button>` : '<p class="sub">Maximal aufgewertet.</p>');
  } else if (wbTab === 'craft') {
    body = RECIPES.map(R => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(R.id === 'potion' ? ['s', 288, 336, 16, 16] : R.id.startsWith('forge') ? ['s', 288, 408, 16, 24] : R.id === 'gem' ? ['gem', 'rubin', 1] : R.id === 'socket' ? ['gem', 'saphir', 3] : ['fx', 'sparks', 2])}" alt=""></div><div><div class="nm">${R.n}</div><div class="st">${R.d}${R.needItem ? ' – für: <b style="color:' + itemColor(it) + '">' + esc(itemName(it)) + '</b>' : ''}</div>${costHTML(R.cost, R.gold)}</div><button class="btn sm" data-act="craft" data-id="${R.id}" ${canAfford(R.cost, R.gold) ? '' : 'disabled'}>Herstellen</button></div>`).join('') + '<p class="sub">Für Umschmieden und Sockel bohren den Gegenstand im Reiter „Aufwerten“ oder „Sockel“ auswählen.</p>';
  } else if (wbTab === 'sock') {
    body = list + itemDetail(it, it.gems.length ? `<button class="btn alt sm" data-act="unsock">Edelsteine entfernen (${40 + it.gems.length * 20} Gold)</button>` : '') + `<h3>EDELSTEIN EINSETZEN (${it.gems.length}/${it.sockets} Sockel)</h3>` + (it.sockets > it.gems.length ? gemListHTML('sock') : '<p class="sub">Keine freien Sockel – im Reiter „Herstellen“ kannst du welche bohren.</p>');
  } else if (wbTab === 'gems') {
    body = '<p class="sub">Drei gleiche Edelsteine verschmelzen zu einem besseren.</p>' + gemListHTML('comb');
  } else if (wbTab === 'dye') {
    body = `<div style="display:flex;gap:16px;align-items:center;margin-bottom:10px">${spriteHTML(P.cls, P.gear.armor.tier, P.gear.helm.tier, P.dye, 4)}<p class="sub">Farbstoffe färben deine Rüstung. Einmal freigeschaltet, kannst du jederzeit wechseln.</p></div>` + DYES.map(D => { const have = P.dyes.includes(D.id); return `<div class="row${P.dye === D.id ? ' sel' : ''}" style="cursor:default"><div class="ic">${spriteHTML(P.cls, P.gear.armor.tier, P.gear.helm.tier, D.id, 1)}</div><div><div class="nm">${D.n}</div>${have ? '<div class="st">Freigeschaltet</div>' : costHTML(D.cost, 0)}</div><button class="btn sm" data-act="dye" data-id="${D.id}" ${have || hasMats(D.cost) ? '' : 'disabled'}>${P.dye === D.id ? 'Aktiv' : have ? 'Anlegen' : 'Freischalten'}</button></div>`; }).join('');
  }
  showOverlay(`<div class="head"><h2>WERKBANK</h2><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div></div>
  <div class="cost" style="font-size:16px">${MATORDER.map(k => `<span><img src="${iconURL(['mat', k])}" alt="${MATS[k].n}">${P.mats[k] || 0}</span>`).join('')}</div>
  <div class="tabs" role="tablist">${tab_('up', 'AUFWERTEN')}${tab_('craft', 'HERSTELLEN')}${tab_('sock', 'SOCKEL')}${tab_('gems', 'EDELSTEINE')}${tab_('dye', 'FARBEN')}</div>
  ${body}<div class="menu" style="margin-top:12px"><button class="btn" data-act="wbdone">Weiter</button></div>`, true);
}

/* ---------- Händler ---------- */
let mTab = 'buy';
function genShop() {
  const C = CLASSES[P.cls], st = stageNum(), stock = [];
  const maxT = REQ.filter(r => r <= P.lv).length - 1;
  for (const t of [Math.max(0, maxT - 1), maxT]) { stock.push({ it: makeItem({ slot: 'weapon', base: pick(C.weapons), tier: t, rar: 0 }), price: PRICE[t] }); stock.push({ it: makeItem({ slot: pick(['armor', 'helm']), base: 'armor', tier: t, rar: 0 }), price: Math.round(PRICE[t] * .8) }); }
  for (let i = 0; i < 3; i++) { const it = randomItem(st, 1); stock.push({ it, price: itemPrice(it) * 4 }); }
  return { stock, uniq: uid() };
}
function openMerchant() {
  setState('menu'); showHud(false);
  if (!P.map.shop || P.map.shopAt !== P.map.pos.r + ':' + P.map.pos.i) { P.map.shop = genShop(); P.map.shopAt = P.map.pos.r + ':' + P.map.pos.i; saveChar(); }
  const tab_ = (k, l) => `<button class="tab" role="tab" aria-selected="${mTab === k}" data-act="mtab" data-id="${k}">${l}</button>`;
  let body = '';
  if (mTab === 'buy') {
    body = P.map.shop.stock.map((s, i) => s.sold ? '' : `<div class="row" style="cursor:default"><div class="ic"><img src="${itemIconURL(s.it)}" alt=""></div><div><div class="nm" style="color:${itemColor(s.it)}">${esc(itemName(s.it))}</div><div class="st">${itemLines(s.it).slice(0, 3).join(' · ')}</div></div><button class="btn sm" data-act="buy" data-i="${i}" ${P.gold >= s.price ? '' : 'disabled'}><i class="coin"></i>${s.price}</button></div>`).join('');
    const extra = [['potion', 'Heiltrank', 30, ['s', 288, 336, 16, 16]], ['gem', 'Zufälliger Splitter', 70, ['gem', 'smaragd', 0]], ['erz', '5 Eisenerz', 45, ['mat', 'erz']], ['leder', '5 Leder', 45, ['mat', 'leder']], ['kristall', 'Seelenkristall', 110, ['mat', 'kristall']], ['horn', 'Dämonenhorn', 140, ['mat', 'horn']]];
    body += extra.map(([k, n, p, ic]) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(ic)}" alt=""></div><div><div class="nm">${n}</div></div><button class="btn sm" data-act="buyx" data-id="${k}" data-i="${p}" ${P.gold >= p && !(k === 'potion' && P.potions >= 9) ? '' : 'disabled'}><i class="coin"></i>${p}</button></div>`).join('');
  } else {
    body = P.bag.length ? P.bag.map(it => `<div class="row" style="cursor:default"><div class="ic"><img src="${itemIconURL(it)}" alt=""></div><div><div class="nm" style="color:${itemColor(it)}">${esc(itemName(it))}</div><div class="st">${itemLines(it).slice(0, 2).join(' · ')}</div></div><button class="btn sm" data-act="msell" data-id="${it.uid}"><i class="coin"></i>${itemPrice(it)}</button></div>`).join('') + `<button class="btn alt" data-act="sellall" style="width:100%;margin-top:6px">Alle Gewöhnlichen & Magischen verkaufen</button>` : '<p class="sub">Dein Beutel ist leer.</p>';
  }
  showOverlay(`<div class="head"><h2>HÄNDLER BORIN</h2><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div></div>
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><img class="px" src="${iconURL(['sp', 'dwarf'])}" alt="" style="width:48px;height:48px;object-fit:contain"><p class="sub" style="margin:0">„Gute Ware, faire Preise. Meistens.“</p></div>
  <div class="tabs" role="tablist">${tab_('buy', 'KAUFEN')}${tab_('sell', 'VERKAUFEN')}</div>${body}
  <div class="menu" style="margin-top:12px"><button class="btn" data-act="mdone">Weiterziehen</button></div>`, true);
}

/* ---------- Schrein & Ereignis ---------- */
function openShrine() {
  setState('menu'); showHud(false);
  const n = P.map.rows[P.map.pos.r][P.map.pos.i];
  if (!n.choices) { n.choices = SHRINES.map((s, i) => i).sort(() => Math.random() - .5).slice(0, 3); saveChar(); }
  showOverlay(`<h2>SCHREIN</h2><p class="sub">Drei Altäre leuchten im Halbdunkel. Du kannst nur einen berühren.</p>
  ${n.choices.map(i => { const S = SHRINES[i]; return `<button class="row" data-act="shrine" data-i="${i}"><div class="ic"><img src="${iconURL(['fx', 'sparks', i])}" alt=""></div><div><div class="nm" style="color:var(--rune)">${S.n}</div><div class="st">${S.d}</div></div><span></span></button>`; }).join('')}
  <div class="menu" style="margin-top:10px"><button class="btn alt" data-act="sdone">Nichts berühren</button></div>`);
}
function openEvent() {
  setState('menu'); showHud(false);
  const n = P.map.rows[P.map.pos.r][P.map.pos.i];
  if (n.ev == null) { n.ev = Math.floor(Math.random() * EVENTS.length); saveChar(); }
  const E = EVENTS[n.ev];
  showOverlay(`<h2>${E.n.toUpperCase()}</h2><p class="sub">${E.d}</p><div class="menu">${E.opts.map(o => `<button class="btn ${o.a === 'leave' ? 'alt' : ''}" data-act="ev" data-id="${o.a}">${o.n}</button>`).join('')}</div>`);
}
function doEvent(a) {
  const st = stageNum();
  switch (a) {
    case 'heal': P.hp = P.st.hp; toast('Vollständig geheilt'); sfx('heal'); nodeLeave(); break;
    case 'gamble': if (P.gold < 50) { toast('Zu wenig Gold'); return; } P.gold -= 50; if (Math.random() < .5) { const g = Math.random() < .4; if (g) { gainGem(randomGem(st)); toast('Ein Edelstein glitzert im Wasser!'); } else { P.gold += 150; toast('+150 Gold!'); } sfx('chest'); } else { toast('Nichts passiert …'); sfx('fail'); } nodeLeave(); break;
    case 'rescue': startRoom('rescue', P.map.pos.r); break;
    case 'cursed': startRoom('cursed', P.map.pos.r); break;
    case 'leave': nodeLeave(); break;
    case 'upw': if (P.gear.weapon.up < 10) P.gear.weapon.up++; computeStats(); toast(itemName(P.gear.weapon)); sfx('craft'); nodeLeave(); break;
    case 'upa': if (P.gear.armor.up < 10) P.gear.armor.up++; computeStats(); toast(itemName(P.gear.armor)); sfx('craft'); nodeLeave(); break;
    case 'potions': P.potions = Math.min(9, P.potions + 2); toast('+2 Heiltränke'); sfx('heal'); nodeLeave(); break;
    case 'mats': for (let i = 0; i < 3; i++) { const k = pick(MATORDER.slice(0, 7)); gainMat(k, ri(2, 3)); } toast('Materialien erhalten'); sfx('coin'); nodeLeave(); break;
  }
}

/* ---------- Pause, Tod, Tages-Ergebnis ---------- */
function showPause() {
  if (state !== 'play') return; setState('pause');
  showOverlay(`<h2 class="center">PAUSE</h2><p class="sub center">${esc(P.name)} · LV ${P.lv} · Akt ${P.act}</p><div class="menu"><button class="btn" data-act="resume">Weiterspielen</button><button class="btn alt" data-act="pchar">Charakter</button><button class="btn alt" data-act="music">Musik ${SAVE.meta.settings.music !== false ? 'aus' : 'an'}</button><button class="btn alt" data-act="sfx">Ton ${SAVE.meta.settings.sfx !== false ? 'aus' : 'an'}</button><button class="btn alt" data-act="title">Speichern & Hauptmenü</button></div><div class="help">${HELP}</div>`);
}
function showDeath() {
  setState('over'); showHud(false);
  if (P.hc) {
    SAVE.meta.fallen.unshift({ name: P.name, cls: P.cls, lv: P.lv, act: P.act, diff: P.diff, date: Date.now(), kills: P.stats.kills });
    SAVE.chars.splice(SAVE.active, 1); SAVE.active = -1; persist();
    showOverlay(`<div class="over center"><h2>${esc(P.name).toUpperCase()} IST GEFALLEN</h2><p class="sub">Hardcore kennt keine Gnade. ${CLASSES[P.cls].name}, Level ${P.lv}, Akt ${P.act}, ${fmt(P.stats.kills)} Gegner besiegt. Dein Name steht nun in der Ruhmeshalle.</p><div class="menu"><button class="btn" data-act="hcok">Zum Titel</button></div></div>`);
    return;
  }
  const loss = Math.floor(P.gold * .2);
  showOverlay(`<div class="over center"><h2>GEFALLEN</h2><p class="sub">${G && G.daily ? 'Die Tages-Challenge ist vorbei.' : 'Du verlierst ' + loss + ' Gold. Level, Ausrüstung und Materialien bleiben.'}</p>
  <div class="menu">${G && G.daily ? '<button class="btn" data-act="dailyfail">Zum Titel</button>' : `<button class="btn" data-act="retry">Raum wiederholen</button><button class="btn alt" data-act="tomap">Zurück zur Karte</button>`}</div></div>`);
}
function openDailyResult(score, best, kills, time) {
  setState('menu'); showHud(false);
  showOverlay(`<div class="center"><h2>TAGES-CHALLENGE GESCHAFFT</h2><p class="sub">${kills} Gegner in ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')} min.</p><div class="kv"><span class="pill">PUNKTE ${score}</span><span class="pill dim">BESTWERT HEUTE ${Math.max(score, best)}</span></div><p class="sub">Belohnung: 300 Gold und ein Edelstein. Morgen gibt es neue Räume und neue Gegner-Affixe.</p><div class="menu"><button class="btn" data-act="dailyok">Weiter</button></div></div>`);
}

/* ---------- Sammlungen ---------- */
function showAch() {
  const n = ACH.filter(a => SAVE.meta.ach[a.id]).length;
  showOverlay(`<div class="head"><h2>ERFOLGE ${n}/${ACH.length}</h2><button class="btn alt sm" data-act="backtitle">Zurück</button></div><div class="achv">${ACH.map(a => `<div class="ach${SAVE.meta.ach[a.id] ? ' on' : ''}"><b>${a.n}</b><small>${a.d} · +${a.r} Gold</small></div>`).join('')}</div>`, true);
}
function showBestiary() {
  const ks = Object.keys(EN);
  showOverlay(`<div class="head"><h2>BESTIARIUM</h2><button class="btn alt sm" data-act="backtitle">Zurück</button></div><p class="sub">${ks.filter(k => SAVE.meta.bestiary[k]).length} von ${ks.length} Gegnern entdeckt.</p>
  ${ks.map(k => { const D = EN[k], n = SAVE.meta.bestiary[k] || 0; return `<div class="row" style="cursor:default;${n ? '' : 'opacity:.45'}"><div class="ic"><img src="${iconURL(['sp', D.sp])}" alt="" style="${n ? '' : 'filter:brightness(0)'}"></div><div><div class="nm">${n ? D.name : '???'}</div><div class="st">${n ? D.desc + (Object.keys(D.drop || {}).length ? ' · Beute: ' + Object.keys(D.drop).map(m => MATS[m].n).join(', ') : '') : 'Noch nicht entdeckt'}</div></div><span class="pill dim">${n} besiegt</span></div>`; }).join('')}`, true);
}
function showHall() {
  const heroes = SAVE.chars.slice().sort((a, b) => b.maxAct - a.maxAct || b.lv - a.lv);
  const days = Object.keys(SAVE.meta.daily).sort().reverse().slice(0, 7);
  showOverlay(`<div class="head"><h2>RUHMESHALLE</h2><button class="btn alt sm" data-act="backtitle">Zurück</button></div>
  <h3>LEBENDE HELDEN</h3>${heroes.map(c => `<div class="cardrow">${spriteHTML(c.cls, c.gear.armor.tier, c.gear.helm.tier, c.dye, 2)}<div><div style="font-size:20px">${esc(c.name)} ${c.hc ? '<span class="pill hc">HC</span>' : ''}</div><div style="font-size:15px;color:var(--parch-dim)">${CLASSES[c.cls].name} · LV ${c.lv} · Höchster Akt ${c.maxAct} · ${fmt(c.stats.kills)} Kills · ${DIFFS[c.diff].n}</div></div><span></span></div>`).join('') || '<p class="sub">Noch keine Helden.</p>'}
  <h3>GEFALLENE HARDCORE-HELDEN</h3>${SAVE.meta.fallen.map(f => `<div class="cardrow"><img class="px" src="${iconURL(['s', 288, 432, 16, 16])}" alt="" style="width:40px"><div><div style="font-size:20px">${esc(f.name)}</div><div style="font-size:15px;color:var(--parch-dim)">${CLASSES[f.cls].name} · LV ${f.lv} · Akt ${f.act} · ${fmt(f.kills)} Kills · ${new Date(f.date).toLocaleDateString('de-DE')}</div></div><span></span></div>`).join('') || '<p class="sub">Niemand. Noch nicht.</p>'}
  <h3>TAGES-CHALLENGE</h3>${days.map(d => `<div style="font-size:18px">${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}: <b style="color:var(--gold)">${SAVE.meta.daily[d]}</b> Punkte</div>`).join('') || '<p class="sub">Noch nicht gespielt.</p>'}`, true);
}
function showCode(msg) {
  showOverlay(`<h2>SPIELSTAND</h2><p class="sub">Kopiere den Code auf einem Gerät und füge ihn auf dem anderen ein. Er enthält alle Helden, Erfolge und das Bestiarium. Alte Codes aus Version 1 und 2 funktionieren auch.</p>
  <h3>DEIN CODE</h3><textarea id="codeOut" readonly rows="4">${exportCode()}</textarea>
  <div class="menu" style="margin-top:8px"><button class="btn alt" data-act="copycode">Code kopieren</button></div>
  <h3>CODE EINFÜGEN</h3><textarea id="codeIn" rows="4" placeholder="Code hier einfügen …"></textarea>
  ${msg ? `<p class="sub" style="color:var(--gold)">${msg}</p>` : ''}
  <div class="menu" style="margin-top:8px"><button class="btn" data-act="loadcode">Code laden</button><button class="btn alt" data-act="backtitle">Zurück</button></div>`);
}
function showSettings() {
  const s = SAVE.meta.settings;
  showOverlay(`<h2>EINSTELLUNGEN</h2><div class="menu" style="margin-top:12px"><button class="btn alt" data-act="music">Musik: ${s.music !== false ? 'AN' : 'AUS'}</button><button class="btn alt" data-act="sfx">Soundeffekte: ${s.sfx !== false ? 'AN' : 'AUS'}</button>${UPD.on ? '<button class="btn alt" data-act="checkupd">Nach Update suchen</button>' : ''}<button class="btn" data-act="backtitle">Zurück</button></div><p class="sub" id="updmsg">Version ${VERSION}</p>`);
}

/* ---------- Klicks ---------- */
panel.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return; audioOn();
  const a = b.dataset.act, id = b.dataset.id, i = b.dataset.i != null ? +b.dataset.i : -1;
  switch (a) {
    case 'new': CS = { cls: 'knight', diff: 'normal', hc: false, name: '' }; showCreate(); break;
    case 'ccls': CS.cls = id; CS.name = ($('cname') || {}).value || ''; showCreate(); break;
    case 'cdiff': CS.diff = id; CS.name = ($('cname') || {}).value || ''; showCreate(); break;
    case 'chc': CS.hc = !CS.hc; CS.name = ($('cname') || {}).value || ''; showCreate(); break;
    case 'cstart': { const nm = (($('cname') || {}).value || '').trim() || CLASSES[CS.cls].name; const c = newChar(CS.cls, nm, CS.diff, CS.hc); c.mats = { erz: 4, leder: 3 }; SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); saveChar(); sfx('lvl'); goFullscreen(); openMap(); break; }
    case 'play': confirmDel = -1; activateChar(i); goFullscreen(); if (P.map && P.map.pos.r >= 0 && !P.map.rows[P.map.pos.r][P.map.pos.i].done && ['haendler', 'werkbank', 'schrein', 'event'].includes(P.map.rows[P.map.pos.r][P.map.pos.i].t)) { resumeNode(); } else openMap(); break;
    case 'delchar': confirmDel = i; showTitle(); break;
    case 'delno': confirmDel = -1; showTitle(); break;
    case 'delok': SAVE.chars.splice(i, 1); if (SAVE.active === i) SAVE.active = -1; else if (SAVE.active > i) SAVE.active--; confirmDel = -1; persist(); P = null; titleScene(); showTitle(); break;
    case 'daily': if (SAVE.active < 0) { if (!SAVE.chars.length) break; activateChar(0); } goFullscreen(); startDaily(); break;
    case 'ach': showAch(); break;
    case 'best': showBestiary(); break;
    case 'hall': showHall(); break;
    case 'code': showCode(); break;
    case 'settings': showSettings(); break;
    case 'backtitle': showTitle(); break;
    case 'install': if (window.__doInstall) window.__doInstall(); break;
    case 'checkupd': checkUpdateNow(); break;
    case 'copycode': { const t = $('codeOut'); const done = () => { b.textContent = 'Kopiert'; }; try { navigator.clipboard.writeText(t.value).then(done, () => { t.select(); done(); }); } catch (_) { t.select(); done(); } break; }
    case 'loadcode': try { const r = importCode($('codeIn').value); P = null; if (SAVE.active >= 0 && SAVE.chars[SAVE.active]) activateChar(SAVE.active); titleScene(); showCode(r === 'v1' ? 'Alter Spielstand als Ritter übernommen.' : 'Spielstand geladen.'); } catch (_) { showCode('Der Code ist ungültig. Bitte vollständig kopieren und erneut einfügen.'); } break;
    case 'music': SAVE.meta.settings.music = SAVE.meta.settings.music === false; persist(); if (state === 'pause') { setState('play'); showPause(); } else showSettings(); break;
    case 'sfx': SAVE.meta.settings.sfx = SAVE.meta.settings.sfx === false; persist(); if (state === 'pause') { setState('play'); showPause(); } else showSettings(); break;
    case 'msel': mapSel = i; openMap(); break;
    case 'enter': if (mapSel >= 0) { P.map.prev = Object.assign({}, P.map.pos); enterNode(mapSel); mapSel = -1; } break;
    case 'char': selItem = null; openChar('gear', 'map'); break;
    case 'title': if (G && G.daily) restoreFromDaily(); saveChar(); titleScene(); showTitle(); break;
    case 'ctab': charTab = id; openChar(); break;
    case 'isel': selItem = id; openChar(); break;
    case 'equip': { const f = findItem(id); if (f && f.bi != null) { equipFromBag(f.bi); sfx('swing'); saveChar(); } selItem = id; openChar(); break; }
    case 'sell': { const f = findItem(id); if (f && f.bi != null) { P.gold += itemPrice(f.it); P.bag.splice(f.bi, 1); sfx('coin'); saveChar(); } selItem = null; openChar(); break; }
    case 'tal': { const [bi, ni] = id.split(',').map(Number); if (learnTalent(bi, ni)) { sfx('click'); saveChar(); } else sfx('deny'); openChar(); break; }
    case 'respec': if (respec()) { sfx('craft'); saveChar(); } openChar(); break;
    case 'pp': { const free = P.paragon - (P.pp.dmg + P.pp.hp + P.pp.def + P.pp.crit); if (free > 0) { P.pp[id]++; computeStats(); saveChar(); sfx('click'); } openChar(); break; }
    case 'rebirth': showOverlay(`<div class="center"><h2>WIEDERGEBURT?</h2><p class="sub">Level, Talente und Akt beginnen von vorn. Du behältst Ausrüstung, Gold, Materialien und Paragon und erhältst dauerhaft +10 % Schaden und LP.</p><div class="menu"><button class="btn red" data-act="rebirthok">Ja, wiedergeboren werden</button><button class="btn alt" data-act="ctab" data-id="para">Abbrechen</button></div></div>`); break;
    case 'rebirthok': P.rebirths++; stat('rebirths'); P.lv = 1; P.xp = 0; P.sp = 0; P.talents = {}; P.act = 1; P.map = null; computeStats(); P.hp = P.st.hp; saveChar(); checkAch(); banner('WIEDERGEBOREN', '★ ' + P.rebirths); openMap(); break;
    case 'cback': { const r = returnTo; returnTo = null; saveChar(); if (r === 'pause') { setState('play'); showPause(); } else if (r === 'wb') openWorkbench(); else openMap(); break; }
    case 'pchar': selItem = null; returnTo = 'pause'; openChar('gear', 'pause'); break;
    case 'wtab': wbTab = id; openWorkbench(); break;
    case 'wsel': selItem = id; openWorkbench(); break;
    case 'up': { const f = findItem(selItem); const r = upgradeItem(f.it); if (r === 'ok') { sfx('craft'); toast('Erfolg: ' + itemName(f.it), '#79c24e'); } else if (r === 'fail') { sfx('fail'); toast('Fehlgeschlagen – die Materialien sind verloren', '#ff6a5a'); } saveChar(); checkAch(); openWorkbench(); break; }
    case 'craft': { const f = findItem(selItem); const r = craft(id, f && f.it); if (r.r === 'ok') { sfx('craft'); toast(r.msg || 'Hergestellt', '#79c24e'); } else if (r.r === 'fail') { sfx('fail'); toast(r.msg, '#ff6a5a'); } else if (r.r === 'max') toast('Schon 3 Sockel'); else sfx('deny'); saveChar(); checkAch(); openWorkbench(); break; }
    case 'sock': { const f = findItem(selItem); if (socketGem(f.it, id)) { sfx('craft'); saveChar(); } openWorkbench(); break; }
    case 'unsock': { const f = findItem(selItem); if (unsocketAll(f.it)) { sfx('coin'); saveChar(); } openWorkbench(); break; }
    case 'gcomb': { const [gid, gr] = id.split(','); if (combineGem(gid, +gr)) { sfx('craft'); saveChar(); checkAch(); } openWorkbench(); break; }
    case 'dye': if (unlockDye(id)) { sfx('craft'); saveChar(); } openWorkbench(); break;
    case 'wbdone': if (state === 'menu' && P.map && P.map.pos.r >= 0 && P.map.rows[P.map.pos.r][P.map.pos.i].t === 'werkbank' && !P.map.rows[P.map.pos.r][P.map.pos.i].done) nodeLeave(); else openMap(); break;
    case 'mtab': mTab = id; openMerchant(); break;
    case 'buy': { const s = P.map.shop.stock[i]; if (s && !s.sold && P.gold >= s.price) { P.gold -= s.price; s.sold = true; const g = addToBag(s.it); if (!g && canEquip(s.it) && itemScore(s.it) > itemScore(P.gear[s.it.slot])) { equipFromBag(P.bag.length - 1); toast(itemName(s.it) + ' angelegt'); } sfx('buy'); saveChar(); } openMerchant(); break; }
    case 'buyx': { const p = i; if (P.gold < p) break; P.gold -= p; if (id === 'potion') P.potions = Math.min(9, P.potions + 1); else if (id === 'gem') gainGem(pick(GEMORDER) + ':0'); else if (id === 'erz' || id === 'leder') gainMat(id, 5); else gainMat(id, 1); sfx('buy'); saveChar(); openMerchant(); break; }
    case 'msell': { const f = findItem(id); if (f && f.bi != null) { P.gold += itemPrice(f.it); P.bag.splice(f.bi, 1); sfx('coin'); saveChar(); } openMerchant(); break; }
    case 'sellall': { let g = 0; P.bag = P.bag.filter(it => { if (it.rar <= 1 && !it.gems.length && !it.up) { g += itemPrice(it); return false; } return true; }); P.gold += g; if (g) sfx('coin'); toast('+' + g + ' Gold'); saveChar(); openMerchant(); break; }
    case 'mdone': nodeLeave(); break;
    case 'shrine': { const S = SHRINES[i]; if (S.instant === 'blood') { P.hp = Math.max(1, P.hp - P.st.hp * .3); P.sp++; toast('+1 Talentpunkt', '#b892f4'); } else { P.buffs.push({ n: S.n.replace('Schrein der ', '').replace('Schrein des ', ''), buff: S.buff, rooms: S.rooms }); computeStats(); toast(S.n + ' aktiv', '#b892f4'); } sfx('ach'); nodeLeave(); break; }
    case 'sdone': nodeLeave(); break;
    case 'ev': doEvent(id); break;
    case 'actnext': openMap(); break;
    case 'actwb': wbTab = 'up'; openWorkbench(false); break;
    case 'resume': setState('play'); hideOverlay(); showHud(true); break;
    case 'retry': P.gold -= Math.floor(P.gold * .2); P.hp = P.st.hp * .7; startRoom(G.type, G.row, G.extra); break;
    case 'tomap': P.gold -= Math.floor(P.gold * .2); P.hp = P.st.hp * .5; if (P.map && P.map.prev) P.map.pos = P.map.prev; saveChar(); openMap(); break;
    case 'hcok': P = null; titleScene(); showTitle(); break;
    case 'dailyfail': restoreFromDaily(); P.hp = P.st.hp; saveChar(); titleScene(); showTitle(); break;
    case 'dailyok': P.hp = P.st.hp; titleScene(); showTitle(); break;
  }
});

/* ---------- Eingabe ---------- */
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code) && !e.code.startsWith('Arrow')) { keys[e.code] = true; return; }
  keys[e.code] = true; audioOn();
  if (state === 'play' && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
  if (state === 'play') {
    if (e.code === 'KeyK' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') doRoll();
    else if (e.code === 'Digit1') useSkill(0); else if (e.code === 'Digit2') useSkill(1); else if (e.code === 'Digit3') useSkill(2);
    else if (e.code === 'KeyF' || e.code === 'KeyL') doUlt();
    else if (e.code === 'KeyH') drinkPotion();
    else if (e.code === 'KeyC') { showPause(); returnTo = 'pause'; openChar('gear', 'pause'); }
    else if (e.code === 'Escape' || e.code === 'KeyP') showPause();
  } else if (state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { setState('play'); hideOverlay(); showHud(true); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; touchAtk = false; if (state === 'play') showPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') showPause(); });
cv.addEventListener('mousedown', e => { audioOn(); mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 0) mouse.down = true; else if (e.button === 2) doRoll(); else if (e.button === 1) doUlt(); });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('contextmenu', e => e.preventDefault());
const tz = $('tzone'), stickEl = $('stick'), knob = $('knob');
tz.addEventListener('pointerdown', e => { if (stick.id !== null) return; audioOn(); stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; try { tz.setPointerCapture(e.pointerId); } catch (_) { } stickEl.style.display = 'block'; stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; knob.style.transform = 'translate(0,0)'; });
tz.addEventListener('pointermove', e => { if (e.pointerId !== stick.id) return; let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), m = 40; if (l > m) { dx = dx / l * m; dy = dy / l * m; } stick.x = dx / m; stick.y = dy / m; knob.style.transform = `translate(${dx}px,${dy}px)`; });
const endStick = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; };
tz.addEventListener('pointerup', endStick); tz.addEventListener('pointercancel', endStick);
function holdBtn(el, down, up) { el.addEventListener('pointerdown', e => { e.preventDefault(); audioOn(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) { } down(); }); const u = () => { el.classList.remove('down'); if (up) up(); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('lostpointercapture', u); }
holdBtn($('bAtk'), () => { touchAtk = true; }, () => { touchAtk = false; });
holdBtn($('bRoll'), doRoll); holdBtn($('bS1'), () => useSkill(0)); holdBtn($('bS2'), () => useSkill(1)); holdBtn($('bS3'), () => useSkill(2)); holdBtn($('bUlt'), doUlt); holdBtn($('bPot'), drinkPotion);
$('pauseBtn').addEventListener('click', () => { audioOn(); showPause(); });

/* ---------- PWA: Installation, Vollbild, Querformat ---------- */
let deferredInstall = null;
const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (state === 'title') showTitle(); });
function installBtn() { if (standalone) return ''; if (deferredInstall) return '<button class="btn" data-act="install">Als App installieren</button>'; if (isIOS) return '<p class="help" style="border:0;padding:0;grid-column:1/-1">Als App: in Safari auf TEILEN und dann „Zum Home-Bildschirm“ tippen.</p>'; return ''; }
window.__doInstall = async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (_) { } deferredInstall = null; showTitle(); };
function goFullscreen() { if (!isTouch) return; const el = document.documentElement; const lock = () => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { }); } catch (_) { } }; if (!standalone && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock).catch(() => { }); else lock(); }
/* PWA-START */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  UPD.on = true; UPD.had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!UPD.had && !UPD.manual) { UPD.had = true; return; } // erste Installation, kein Update
    UPD.ready = true;
    if (UPD.manual || state === 'title' || state === 'map' || state === 'load') applyUpdate();
    else toast('Update geladen – wird auf der Weltkarte installiert', '#e8b04a');
  });
  const checkUpdate = () => { if (UPD.reg && Date.now() - UPD.last > 30000) { UPD.last = Date.now(); UPD.reg.update().catch(() => { }); } };
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { UPD.reg = r; UPD.last = Date.now(); }).catch(() => { }));
  // App aus dem Hintergrund geholt: nach neuer Version schauen
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
  setInterval(checkUpdate, 10 * 60 * 1000);
}
/* PWA-END */
function checkUpdateNow() {
  const msg = t => { const el = $('updmsg'); if (el) el.textContent = t; };
  if (!UPD.reg) { msg('Updates kommen hier automatisch mit der Seite.'); return; }
  msg('Suche nach Updates …'); UPD.manual = true; UPD.last = Date.now();
  UPD.reg.update().then(() => {
    const r = UPD.reg;
    if (r.waiting) { applyUpdate(); return; }
    if (r.installing) { msg('Update wird installiert …'); return; }
    UPD.manual = false; msg('Du hast die neueste Version (' + VERSION + ').');
  }).catch(() => { UPD.manual = false; msg('Keine Verbindung. Versuch es später noch mal.'); });
}

/* ---------- Hauptschleife ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  SCALE = Math.max(2, Math.round(Math.min(w, h) / 215));
  VW = Math.ceil(w / SCALE); VH = Math.ceil(h / SCALE);
  cv.width = VW; cv.height = VH; cv.style.width = VW * SCALE + 'px'; cv.style.height = VH * SCALE + 'px';
  ctx.imageSmoothingEnabled = false; makeVig();
}
addEventListener('resize', resize);
let last = performance.now(), achT = 0;
function update(dt) {
  dt0 = dt;
  updPlayer(dt);
  for (const e of enemies) if (!e.dead) updEnemy(e, dt);
  separate();
  enemies = enemies.filter(e => !e.dead);
  updProjs(dt); updSpikes(); updObs(dt); updAllies(dt); updPickups(dt); updParts(dt); ambient(dt);
  if (state === 'play' && G.phase !== 'done') updRoom(dt);
  if (state === 'dead') { deadT -= dt; if (deadT <= 0) showDeath(); }
  P.stats.playtime = (P.stats.playtime || 0) + dt;
  achT -= dt; if (achT <= 0) { achT = 3; checkAch(); }
}
function camera(dt) {
  const tx = AW <= VW ? (AW - VW) / 2 : clamp(P.x - VW / 2, 0, AW - VW), ty = AH <= VH ? (AH - VH) / 2 : clamp(P.y - 10 - VH / 2, 0, AH - VH);
  const k = 1 - Math.pow(.0005, dt); cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
  shk.m *= Math.pow(.002, dt); shk.x = rnd(-shk.m, shk.m); shk.y = rnd(-shk.m, shk.m); if (shk.m < .2) shk.m = shk.x = shk.y = 0;
}
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  if (slowmo > 0) { slowmo -= dt; dt *= .35; }
  flash.a = Math.max(0, flash.a - dt * 1.6);
  if (state === 'play' && isTouch && innerHeight > innerWidth) showPause();
  if (state === 'play' || state === 'dead') { if (hitStop > 0) hitStop -= dt; else update(dt); }
  else if (state === 'title' || state === 'map' || state === 'menu') { P.moving = false; P.turn = approach(P.turn, Math.sin(T * .4) > 0 ? 1 : -1, dt * 3); P.face = P.turn > 0 ? 1 : -1; updParts(dt); if (!G) G = { ambT: 0 }; ambient(dt); }
  if (P && bg) { camera(dt); if (state === 'play') updHud(); }
  render();
}
loadAssets().then(() => {
  try {
    loadAll(); resize();
    if (SAVE.active >= 0 && SAVE.chars[SAVE.active]) activateChar(SAVE.active);
    titleScene(); showTitle(); checkAch();
  } catch (e) {
    console.error(e);
    panel.innerHTML = '<p class="sub">Beim Starten ist ein Fehler aufgetreten (' + esc(e.message) + '). Bitte Seite neu laden.</p>';
    return;
  }
  if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').catch(() => { });
  requestAnimationFrame(loop);
}, () => { panel.innerHTML = '<p class="sub">Die Grafik konnte nicht geladen werden. Bitte Seite neu laden.</p>'; });
