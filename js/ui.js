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
// Gleicher Bildschirm (Titel und Reiter unverändert): Scroll-Position behalten, sonst nach oben
let ovKey = '';
function showOverlay(html, wide) {
  const was = ov.hidden ? null : panel.scrollTop;
  panel.className = 'panel' + (wide ? ' wide' : ''); panel.innerHTML = html; ov.hidden = false;
  const h = panel.querySelector('h1,h2'), t = panel.querySelector('.tab[aria-selected="true"]'), key = (h ? h.textContent : '') + '|' + (t ? t.textContent : '');
  panel.scrollTop = key === ovKey && was != null ? was : 0; ovKey = key;
  fitPanel();
  const f = panel.querySelector('.btn:not(:disabled)'); if (f && !isTouch) f.focus({ preventScroll: true });
}
function hideOverlay() { ov.hidden = true; ovKey = ''; }
// Große Schrift für Menüs (Einstellungen)
function applyUiPrefs() { document.body.classList.toggle('bigui', !!(SAVE && SAVE.meta.settings.bigui)); }
// Maße für klebende Kopf-/Fußleiste und die Detail-Spalte (siehe .split im CSS)
function fitPanel() {
  if (ov.hidden) return;
  const pt = parseFloat(getComputedStyle(panel).paddingTop) || 0, h = panel.querySelector(':scope > .head:first-child'), f = panel.querySelector(':scope > .foot');
  const hh = h ? h.offsetHeight - pt + 6 : 0, fh = f ? f.offsetHeight - pt + 6 : 0;
  panel.style.setProperty('--stt', (hh + 6) + 'px'); panel.style.setProperty('--stb', (fh + 4) + 'px'); panel.style.setProperty('--sth', Math.max(140, panel.clientHeight - hh - fh - 14) + 'px');
}
/* Animiertes Heldenbild mit Umhang, Flügeln und Kopfschmuck (4 Bilder Ruhe-Animation) */
const HPCACHE = {};
function heroPreviewURL(c) {
  // Ausrüstung im gewählten Aussehen (visItem, js/trade.js), dazu die Waffe seitlich hinter dem Körper
  const L = lookOf(c), g = c.gear || {}, hm = visItem(g.helm), am = visItem(g.armor), wv = visItem(g.weapon), hg = headgearOf(hm), spec = heroSpec(c, { np: hg === 'crown' ? 1 : 0, at: am ? am.tier : 0, ht: hm ? hm.tier : 0 }), key = JSON.stringify([spec, L.cape, L.ccape, L.wings, hg, hm ? hm.tier : 0, wv && wv.base ? itemArtKey(wv) : '']);
  if (HPCACHE[key]) return HPCACHE[key];
  const st = charStrip(spec), FW = 40, FH = 44, cc = capeCols(L);
  const cv = mk(FW * 4, FH, gg => { for (let f = 0; f < 4; f++) { const ox = f * FW + (FW - st.w) / 2, oy = FH - st.h - 1, m = st.meta[f]; if (L.wings && COSM[L.wings]) drawWings(gg, ox, oy, m, COSM[L.wings], false); if (cc) drawCape(gg, ox, oy, m, cc, false, 0); drawHeldWeapon(gg, wv, f * FW, FW, FH, spec.body); gg.drawImage(st.c, f * st.w, 0, st.w, st.h, ox, oy, st.w, st.h); if (hg) drawHeadgear(gg, ox, oy, m, hg, hm); } });
  return HPCACHE[key] = { url: cv.toDataURL(), w: FW, h: FH };
}
function heroHTML(c, s) { const H = heroPreviewURL(c); return `<i class="spr" style="width:${H.w * s}px;height:${H.h * s}px;background-image:url(${H.url});background-size:${H.w * 4 * s}px ${H.h * s}px;--to:-${H.w * 4 * s}px;animation:idle4 .7s steps(4) infinite"></i>`; }
function costHTML(c, gold) {
  let h = '<div class="cost">';
  for (const k in c) { const ok = (P.mats[k] || 0) >= c[k]; h += `<span class="${ok ? '' : 'bad'}"><img src="${iconURL(['mat', k])}" alt="">${P.mats[k] || 0}/${c[k]} ${MATS[k].n}</span>`; }
  if (gold) h += `<span class="${P.gold >= gold ? '' : 'bad'}"><i class="coin"></i>${gold}</span>`;
  return h + '</div>';
}
function itemSlot(it, act, sel) { return `<button class="slot${sel ? ' sel' : ''}" data-act="${act}" data-id="${it.uid}" style="box-shadow:inset 0 0 0 2px ${itemColor(it)}${sel ? ',0 0 0 2px #e8b04a' : ''}" aria-label="${esc(itemName(it))}"><img src="${itemIconURL(it)}" alt="">${it.up ? `<span class="u">+${it.up}</span>` : ''}${it.gems.length ? `<span class="n">◆${it.gems.length}</span>` : it.fz ? `<span class="n">★${it.fz}</span>` : ''}</button>`; }
function itemDetail(it, actions) { return `<div class="detail"><div style="display:flex;gap:10px;align-items:center"><div class="ic big" style="box-shadow:inset 0 0 0 2px ${itemColor(it)}"><img src="${itemIconURL(it)}" alt=""></div><div><div class="nm" style="color:${itemColor(it)}">${esc(itemName(it))}</div><div class="st" style="color:var(--parch-dim);font-size:16px">${RAR[it.rar].n} ${it.slot === 'weapon' ? WT[it.base].label : AR[it.slot].label} · ${MAT[it.tier].n} (${_t('Stufe {n}', { n: it.tier + 1 })})${canEquip(it) ? '' : ` · <span style="color:var(--blood)">${_t('nicht für deine Klasse')}</span>`}</div></div></div><ul>${itemLines(it).map(l => '<li>' + esc(l) + '</li>').join('')}</ul><div class="acts" style="justify-content:flex-start">${actions || ''}</div></div>`; }
function findItem(id) { for (const s of ['weapon', 'armor', 'helm']) if (P.gear[s] && P.gear[s].uid === id) return { it: P.gear[s], eq: s }; const i = P.bag.findIndex(x => x.uid === id); return i >= 0 ? { it: P.bag[i], bi: i } : null; }
const HELP = isTouch
  ? '<b>' + _t('STEUERUNG') + '</b>' + _t('Linke Seite ziehen: laufen. Angriff halten (3er-Kombo) – über den Knopf wischen zielt von Hand. Rolle, drei Fähigkeiten, Ultimative (goldene Wut-Leiste). Der Trank sitzt links oben. Alle Knöpfe lassen sich unter Einstellungen → Steuerung verschieben.')
  : '<b>' + _t('STEUERUNG') + '</b>' + _t('WASD laufen · J/Leertaste/Klick angreifen · K/Shift ausweichen · 1 2 3 Fähigkeiten · F Ultimative · H Trank · E Interagieren · C Charakter · Esc Pause');
const CREDIT = '<p class="credit">' + _t('Grafik: „16x16 DungeonTileset II“ von 0x72, Zauber-Effekte „Pixel Art Spells“, „Pixel Art Sword Slash“ und Explosionen von OpenGameArt – alle CC0.') + '</p>';

/* ---------- Dialoge (Geschichte) ---------- */
let DLG = null;
function dialog(lines, done, title) {
  let i = 0;
  const show = () => {
    const [sp, text] = lines[i], S = typeof sp === 'string' ? SPEAKERS[sp] : sp, nm = (S.n || '').replace('{name}', P ? P.name : '');
    showOverlay(`${title ? `<h2 class="center" style="margin-bottom:10px">${esc(title)}</h2>` : ''}<div class="dlg">${S.sp ? `<img class="px" src="${iconURL(['sp', S.sp])}" alt="">` : ''}<div>${nm ? `<b style="color:${S.c}">${esc(nm)}</b>` : ''}<p>${esc(text.replace(/\{name\}/g, P ? P.name : ''))}</p></div></div><div class="menu"><button class="btn" data-act="dlgnext">${i < lines.length - 1 ? _t('Weiter') : _t('Los geht\'s')}</button>${lines.length > 2 && i < lines.length - 1 ? `<button class="btn alt sm" data-act="dlgskip">${_t('Überspringen')}</button>` : ''}</div>`);
  };
  DLG = { next() { i++; if (i >= lines.length) { DLG = null; done(); } else show(); }, skip() { DLG = null; done(); } };
  show();
}

/* ---------- HUD ---------- */
const hudCache = {};
function setT(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setW(id, v) { const s = clamp(v, 0, 100).toFixed(1) + '%'; if (hudCache[id] !== s) { hudCache[id] = s; $(id).style.width = s; } }
function showHud(on) { $('hud').hidden = !on; $('skillbar').hidden = !on; $('touch').hidden = !on; $('objective').hidden = !on; if (!on) $('combo').classList.remove('on'); if (on) { buildSkillUI(); lastRage = -1; applyLayout(); } }
function buildSkillUI() {
  const C = CLASSES[P.cls], ids = C.skills.concat([C.ult]);
  let h = ''; ids.forEach((id, i) => { const S = SKILLS[id]; h += `<div class="sk${S.ult ? ' ult' : ''}" id="sk${i}"><img src="${iconURL(S.icon)}" alt=""><i class="cdv"></i><span class="k">${S.ult ? 'F' : i + 1}</span>${S.cost ? `<span class="c">${skillCost(i)}</span>` : ''}</div>`; });
  h += `<div class="sk" id="skP"><img src="${iconURL(['s', 288, 336, 16, 16])}" alt=""><i class="cdv"></i><span class="k">H</span><span class="c" id="skPn" style="color:var(--gold)">${P.potions}</span></div>`;
  $('skillbar').innerHTML = h;
  ['bS1', 'bS2', 'bS3'].forEach((b, i) => { $(b).querySelector('img').src = iconURL(SKILLS[C.skills[i]].icon); });
  $('bUlt').querySelector('img').src = iconURL(SKILLS[C.ult].icon);
  $('bPot').querySelector('img').src = iconURL(['s', 288, 336, 16, 16]);
  $('resFill').style.background = C.res.col; $('hudLv').classList.toggle('hc', !!P.hc);
  const hide = G && G.type === 'versteck'; $('bPot').hidden = !!hide;
  updWeaponUI();
}
function updWeaponUI() { const it = visItem(P.gear.weapon); $('atkImg').src = itemIconURL(it); }
let lastRage = -1, lastNear = null;
function updHud() {
  setT('hudLv', (P.lv >= 50 ? 'P' + P.paragon : _t('LV {lv}', { lv: P.lv })));
  setW('hpFill', 100 * P.hp / P.st.hp); setT('hpTxt', Math.ceil(P.hp) + '/' + P.st.hp);
  setW('resFill', 100 * P.res / P.st.resMax);
  setW('xpFill', P.lv >= 50 ? 100 * P.pxp / PARAGON_XP : 100 * P.xp / xpNext(P.lv)); setT('hudGold', fmt(P.gold));
  if (G) {
    if (G.type === 'versteck') { setT('hudAct', _t('VERSTECK · STUFE {n}', { n: hideTotal() })); setT('hudRoom', _t('AKT {act}', { act: P.act })); }
    else { setT('hudAct', G.daily ? _t('TAGES-CHALLENGE') : _t('AKT {act}', { act: P.act }) + (qualOf(P.act) ? ' · ' + _t('QUAL {q}', { q: qualOf(P.act) }) : '') + ' · ' + G.stage); setT('hudRoom', (NODE[G.type] ? NODE[G.type].n : G.type === 'rescue' ? _t('Befreiung') : G.type === 'grave' ? _t('Grab') : G.type === 'sphinx' ? _t('Sphinx') : _t('Fluch')).toLocaleUpperCase(LOCALE) + (G.waves.length > 1 ? ' ' + Math.max(1, G.wi + 1) + '/' + G.waves.length : '')); }
    const near = G.type === 'versteck' ? G.near : null;
    if (near !== lastNear) { lastNear = near; const b = $('bAct'); b.hidden = !near; if (near) { const id = near.act; b.querySelector('img').src = iconURL(['pa', BUILD[id].icon]); b.setAttribute('aria-label', near.label); } }
  }
  const b = enemies.find(e => e.boss || e.champ); if (b) setW('bossFill', 100 * Math.max(0, b.hp) / b.maxHp);
  const r = Math.floor(P.rage);
  if (r !== lastRage) { lastRage = r; setW('rageFill', r); $('rageBar').classList.toggle('full', r >= 100); const u = $('bUlt'); u.style.setProperty('--f', r + '%'); u.classList.toggle('ready', r >= 100); const s3 = $('sk3'); if (s3) s3.classList.toggle('ready', r >= 100); }
  const C = CLASSES[P.cls];
  for (let i = 0; i < 3; i++) {
    const cdp = P.cds[i] > 0 ? (P.cds[i] / skillCd(i) * 100) : 0, nores = P.res < skillCost(i);
    const tb = $('bS' + (i + 1)); tb.style.setProperty('--cd', cdp.toFixed(0) + '%'); tb.classList.toggle('nores', nores);
    const sk = $('sk' + i); if (sk) { sk.style.setProperty('--cd', cdp.toFixed(0) + '%'); sk.classList.toggle('nores', nores); }
  }
  void C;
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
  s.hideLv = hideTotal(); s.lore = SAVE.meta.lore.length; s.cosm = SAVE.meta.cos.length; s.bestiary = Object.keys(SAVE.meta.bestiary).length;
  return s;
}
function checkAch() {
  if (!SAVE) return; const s = achStats();
  for (const a of ACH) { if (SAVE.meta.ach[a.id]) continue; try { if (a.t(s)) { SAVE.meta.ach[a.id] = Date.now(); if (P && SAVE.active >= 0) { P.gold += a.r; gainFate(1); } toast(_t('Erfolg: {n} (+{r} Gold, +1 Glücksmünze)', { n: a.n, r: a.r }), '#ffd24a'); sfx('ach'); } } catch (e) { } }
  persist();
}

/* ---------- Titel ---------- */
let confirmDel = -1;
function titleScene() {
  if (!P || SAVE.active < 0) { P = Object.assign(newRuntime(), newChar('knight', 'Ritter')); P.look = lookOf(P); computeStats(); P.hp = P.st.hp; }
  G = { ambT: 0 }; prepArena(1 + Math.floor(Math.random() * BIOMES.length), 4242);
  P.x = AW / 2; P.y = (BD.y0 + BD.y1) / 2; enemies = []; projs = []; pickups = []; corpses = []; fx = []; spikes = []; allies = [];
  obs = [{ k: 'col', x: AW / 2 - 50, y: P.y - 6, r: 7, solid: true }, { k: 'col', x: AW / 2 + 50, y: P.y - 6, r: 7, solid: true }, { k: 'chest', x: AW / 2 + 26, y: P.y + 18, r: 6, solid: true, open: 0 }, { k: 'vein', mat: 'kristall', x: AW / 2 - 30, y: P.y + 22, r: 7, solid: true, hp: 3, flash: 0 }];
  cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - VH / 2, 0, Math.max(0, AH - VH));
}
function showTitle() {
  setState('title'); showHud(false); $('bossbar').hidden = true; setMusic(45, false); G = G && G.ambT !== undefined && !G.type ? G : { ambT: 0 };
  let chars = '';
  SAVE.chars.forEach((c, i) => {
    const C = CLASSES[c.cls];
    chars += `<div class="cardrow">${heroHTML(c, 1.4)}<div><div style="font-size:21px">${esc(c.name)} ${c.hc ? '<span class="pill hc">HC</span>' : ''}</div><div style="font-size:16px;color:var(--parch-dim)">${C.name} · ${_t('LV {lv}', { lv: c.lv })}${c.paragon ? ' · P' + c.paragon : ''} · ${_t('Akt {act}', { act: c.act })}${qualOf(c.act) ? ' (' + _t('Qual {q}', { q: qualOf(c.act) }) + ')' : ''} · ${DIFFS[c.diff].n}${c.rebirths ? ' · ★' + c.rebirths : ''}</div></div><div class="acts">${confirmDel === i ? `<button class="btn red sm" data-act="delok" data-i="${i}">${_t('Löschen!')}</button><button class="btn alt sm" data-act="delno">${_t('Nein')}</button>` : `<button class="btn sm" data-act="play" data-i="${i}">${_t('Spielen')}</button><button class="btn alt sm" data-act="delchar" data-i="${i}" aria-label="${_t('Löschen')}"><span class="x">×</span></button>`}</div></div>`;
  });
  const N = CHANGELOG[0], fresh = newsUnseen();
  showOverlay(`<div class="tgrid"><div><button class="btn alt sm langbtn" data-act="langs" data-id="title" aria-label="${_t('SPRACHE')}">🌐 ${LANG.toUpperCase()}</button><h1 class="logo">KLINGEN<br>HORT</h1>
  <p class="tag">${_t('Der Uralte Drache hat das Weltenfeuer gestohlen. Bau dein Versteck wieder auf, schmiede Klingen aus Mithril, Adamant und Drachenschuppen – und hol dir zurück, was dem Orden gehört.')}</p>
  ${inAppHTML()}<button class="newsteaser" data-act="news"><b>${_t('NEU IN {v}', { v: N.v })}${fresh ? `<span class="badge">${_t('NEU')}</span>` : ''}</b>${esc(N.t)}: ${esc(N.items[0][1])} <span style="color:var(--gold)">${_t('Alle Neuigkeiten ›')}</span></button>${weekHTML()}</div>
  <div>${chars ? '<h3 style="margin-top:0">' + _t('DEINE HELDEN') + '</h3>' + chars : ''}
  <div class="menu two" style="margin-top:10px">
    <button class="btn" data-act="new">${_t('Neuer Held')}</button>
    <button class="btn alt" data-act="daily" ${SAVE.active >= 0 || SAVE.chars.length ? '' : 'disabled'}>${_t('Tages-Challenge')}</button>
    <button class="btn alt" data-act="news">${_t('Neuigkeiten')}${fresh ? `<span class="badge">${_t('NEU')}</span>` : ''}</button>
    <button class="btn alt" data-act="ach">${_t('Erfolge')}</button>
    <button class="btn alt" data-act="best">${_t('Bestiarium')}</button>
    <button class="btn alt" data-act="hall">${_t('Ruhmeshalle')}</button>
    <button class="btn alt" data-act="code">${_t('Spielstand übertragen')}</button>
    <button class="btn alt" data-act="settings">${_t('Einstellungen')}</button>
    ${hookHTML('titleBtns')}${installBtn()}
  </div></div></div>
  <div class="help">${HELP}</div>${CREDIT}<p class="credit">${_t('Version {v}', { v: VERSION })}</p>`, true);
  // Nach einem Update einmal die Neuigkeiten zeigen
  if (fresh && SAVE.chars.length && !newsAuto) { newsAuto = true; showNews('title'); }
}
let newsAuto = false;

/* ---------- Aussehen (Erstellung, Spiegel, Charakter) ---------- */
let LK = null, lkMode = 'create';
function lookTarget() { return lkMode === 'create' ? { cls: CS.cls, look: CS.look, gear: { armor: { tier: 1 }, helm: { tier: 1 } }, dye: null } : P; }
function swatch(act, i, sel, a, b, label) { return `<button class="sw${sel ? ' sel' : ''}" data-act="lk" data-id="${act}:${i}" title="${label}" aria-label="${label}" style="background:${a ? `linear-gradient(135deg,${a} 55%,${b || a} 55%)` : 'var(--stone-lo)'}">${a ? '' : '∅'}</button>`; }
function lookEditorHTML() {
  const t = lookTarget(), L = t.look, B = BODIES[L.body], own = SAVE.meta.cos;
  let h = `<div class="lookwrap"><div class="lookprev">${heroHTML(t, 4)}<button class="btn alt sm" data-act="lk" data-id="rand:0">${_t('Zufall')}</button></div><div class="lookopts">`;
  h += `<h3>${_t('KÖRPER')}</h3><div class="bodies">${BODYORDER.map(k => `<button class="bd${L.body === k ? ' sel' : ''}" data-act="lk" data-id="body:${k}" aria-label="${BODIES[k].n}"><img class="px" src="${iconURL(['body', k, 1])}" alt=""><small>${BODIES[k].n}</small></button>`).join('')}</div>`;
  if (B.hair) h += `<h3>${_t('HAARE')}</h3><div class="sws">${swatch('hair', -1, L.hair < 0, null, null, _t('Original'))}${HAIRS.map((c, i) => swatch('hair', i, L.hair === i, c[1], c[2], c[0])).join('')}</div>`;
  if (B.skin) h += `<h3>${L.body.startsWith('lizard') ? _t('SCHUPPEN') : L.body === 'doc' ? _t('MASKE') : _t('HAUT')}</h3><div class="sws">${swatch('skin', -1, L.skin < 0, null, null, _t('Original'))}${SKINS.map((c, i) => swatch('skin', i, L.skin === i, c[1], c[2], c[0])).join('')}</div>`;
  if (B.plume) h += `<h3>${_t('HELMBUSCH')}</h3><div class="sws">${swatch('accent', -1, L.accent < 0, null, null, _t('Nach Helm'))}${ACCENTS.map((c, i) => swatch('accent', i, L.accent === i, c[1], c[2], c[0])).join('')}</div>`;
  h += `<h3>${_t('UMHANG')}</h3><div class="sws">${swatch('cape', -1, L.cape < 0 && !L.ccape, null, null, _t('Kein Umhang'))}${CAPES.map((c, i) => swatch('cape', i, L.cape === i && !L.ccape, c[1], c[2], c[0])).join('')}${own.filter(k => COSM[k].k === 'cape').map(k => swatch('ccape', k, L.ccape === k, COSM[k].c[0], COSM[k].trim || COSM[k].c[1], COSM[k].n)).join('')}</div>`;
  const wings = own.filter(k => COSM[k].k === 'wings'), auras = own.filter(k => COSM[k].k === 'aura');
  h += `<h3>${_t('KOSMETIK')}</h3>${wings.length || auras.length ? `<div class="sws">${swatch('wings', 'x', !L.wings, null, null, _t('Keine Flügel'))}${wings.map(k => swatch('wings', k, L.wings === k, COSM[k].c[0], COSM[k].c[1], COSM[k].n)).join('')}</div><div class="sws">${swatch('aura', 'x', !L.aura, null, null, _t('Keine Aura'))}${auras.map(k => swatch('aura', k, L.aura === k, COSM[k].c[0], COSM[k].c[1], COSM[k].n)).join('')}</div>` : `<p class="sub" style="margin:0">${_t('Flügel, Auren und besondere Umhänge gibt es im Glückstempel deines Verstecks.')}</p>`}`;
  return h + '</div></div>';
}
function lookAction(id) {
  const t = lookTarget(), L = t.look, [k, v] = id.split(':');
  if (k === 'body') L.body = v; else if (k === 'hair' || k === 'skin' || k === 'accent') L[k] = +v; else if (k === 'cape') { L.cape = +v; L.ccape = null; } else if (k === 'ccape') { L.ccape = v; } else if (k === 'wings' || k === 'aura') L[k] = v === 'x' ? null : v;
  else if (k === 'rand') { L.body = pick(BODYORDER); L.hair = ri(-1, HAIRS.length - 1); L.skin = Math.random() < .5 ? -1 : ri(0, 4); L.cape = ri(-1, CAPES.length - 1); L.accent = ri(-1, ACCENTS.length - 1); }
  sfx('click');
  if (lkMode !== 'create') { P.look = lookOf(P); saveChar(); }
}

/* ---------- Charaktererstellung ---------- */
let CS = { cls: 'knight', diff: 'normal', hc: false, name: '', look: null };
function showCreate() {
  if (!CS.look) CS.look = { body: CLASSES[CS.cls].body, hair: -1, skin: -1, accent: -1, cape: -1 };
  lkMode = 'create';
  let cl = ''; for (const k in CLASSES) { const C = CLASSES[k]; cl += `<button class="cls${CS.cls === k ? ' sel' : ''}" data-act="ccls" data-id="${k}"><img class="px" src="${iconURL(['body', C.body, 1])}" alt="" style="width:36px;height:auto"><b>${C.name}</b><small>${C.desc}</small></button>`; }
  let df = ''; for (const k in DIFFS) df += `<button class="opt${CS.diff === k ? ' sel' : ''}" data-act="cdiff" data-id="${k}">${DIFFS[k].n}<small>${DIFFS[k].d}</small></button>`;
  const C = CLASSES[CS.cls];
  showOverlay(`<div class="head"><h2>${_t('NEUER HELD')}</h2><button class="btn alt sm" data-act="backtitle">${_t('Zurück')}</button></div>
  <h3>${_t('KLASSE')}</h3><div class="classes">${cl}</div>
  <div class="box" style="margin-bottom:10px"><b style="font-family:var(--f-display);font-size:8px;font-weight:400">${C.name.toLocaleUpperCase(LOCALE)}</b> · ${C.res.name} · ${C.weapons.map(w => WT[w].label).join(', ')}<div style="font-size:16px;color:var(--parch-dim);margin-top:4px">${C.skills.map(s => SKILLS[s].n).join(' · ')} · ${_t('Ultimative: {n}', { n: SKILLS[C.ult].n })}</div></div>
  <h3>${_t('AUSSEHEN – FREI GESTALTBAR')}</h3>${lookEditorHTML()}
  <h3>${_t('NAME')}</h3><input type="text" id="cname" maxlength="16" placeholder="${C.name}" value="${esc(CS.name)}">
  <h3>${_t('SCHWIERIGKEIT')}</h3><div class="opts">${df}</div>
  <div class="opts"><button class="opt${CS.hc ? ' sel' : ''}" data-act="chc">${_t('HARDCORE {v}', { v: CS.hc ? _t('AN') : _t('AUS') })}<small>${_t('Ein Tod löscht den Helden. Dafür Ruhm in der Ruhmeshalle.')}</small></button></div>
  <div class="menu foot"><button class="btn" data-act="cstart">${_t('Abenteuer beginnen')}</button></div>`, true);
}
function openMirror() { lkMode = 'mirror'; stationShell('spiegel', `<p class="sub">${_t('Der Spiegel zeigt, wer du sein willst. Änderungen sind kostenlos.')}</p>${lookEditorHTML()}${hookHTML('mirror')}`, true); }

/* ---------- Weltkarte ---------- */
let mapSel = -1, mapTapped = false;
function openMap() {
  setState('map'); showHud(false); $('bossbar').hidden = true; G = null;
  if (!P.map || P.map.act !== P.act) { P.map = genMap(P.act); saveChar(); }
  if (!P.story['a' + P.act]) {
    P.story['a' + P.act] = 1; saveChar(); setState('menu');
    const A = ACTS[P.act - 1], lines = A ? [['erz', A.i]] : [['erz', QUAL_INTRO]];
    dialog(lines, openMap, A ? _t('Akt {act}: {t}', { act: P.act, t: A.t }) : _t('Akt {act} · Qual {q}', { act: P.act, q: qualOf(P.act) })); return;
  }
  const M = P.map, av = availableNodes(), b = biomeOf(P.act);
  MAPV = portrait();
  if (!av.includes(mapSel)) { mapSel = av.length === 1 ? av[0] : -1; mapTapped = false; }
  let nodes = '';
  M.rows.forEach((row, r) => row.forEach((n, i) => {
    const [x, y] = nodePos(M, r, i), N = NODE[n.t], isAv = (M.pos.r + 1 === r) && av.includes(i), cur = M.pos.r === r && M.pos.i === i, fog = r > M.pos.r + 3;
    nodes += `<button class="node${isAv ? ' av' : ''}${n.done ? ' done' : ''}${cur ? ' cur' : ''}${!isAv && !n.done && !cur ? ' dim' : ''}${mapSel === i && isAv ? ' cur sel' : ''}${n.t === 'boss' ? ' boss' : ''}${fog ? ' fog' : ''}" style="left:${x}%;top:${y}%;--c:${N.c}" ${isAv ? `data-act="msel" data-i="${i}"` : 'tabindex="-1"'} aria-label="${N.n}"><img src="${iconURL(N.icon)}" alt=""></button>`;
  }));
  const hp = M.pos.r >= 0 ? nodePos(M, M.pos.r, M.pos.i) : mapStart();
  const selN = mapSel >= 0 ? M.rows[M.pos.r + 1][mapSel] : null, [selX, selY] = selN ? nodePos(M, M.pos.r + 1, mapSel) : [0, 100];
  const A = ACTS[P.act - 1];
  // Info zum gewählten Ort liegt auf der Karte, auf der Seite gegenüber dem Ort
  const info = selN ? `<div class="mapinfo" style="--c:${NODE[selN.t].c};${selY > 50 ? 'bottom:auto;top:8px;' : ''}${selX < 50 ? 'left:auto;' : 'right:auto;'}"><img src="${iconURL(NODE[selN.t].icon)}" alt=""><div><div class="nm" style="color:${NODE[selN.t].c}">${NODE[selN.t].n}</div><div class="st">${NODE[selN.t].d} <span style="color:var(--gold)">${isTouch ? (mapTapped ? _t('Nochmal antippen zum Betreten.') : _t('Antippen zum Betreten.')) : ''}</span></div></div></div>`
    : `<div class="mapinfo" style="--c:var(--stone-hi);left:auto"><div class="st">${_t('Wähle den nächsten Ort – die leuchtenden Punkte.')}</div></div>`;
  showOverlay(`<div class="head"><h2>${_t('AKT {act}', { act: P.act })} · ${b.name.toLocaleUpperCase(LOCALE)}${qualOf(P.act) ? ' · ' + _t('QUAL {q}', { q: qualOf(P.act) }) : ''}</h2><div class="gold"><i class="coin"></i>${fmt(P.gold)} <span style="color:#ffd24a"><i class="fc"></i>${P.fate || 0}</span></div></div>
  <div class="stats">${A ? `<span style="color:var(--rune)">${esc(A.t)}</span>` : ''}<span style="color:${weekEvent().c}">${weekEvent().n.toLocaleUpperCase(LOCALE)}</span><span>${_t('LV {lv}', { lv: P.lv })}${P.paragon ? ' · P' + P.paragon : ''}</span><span>${_t('LP {n}', { n: Math.ceil(P.hp) + '/' + P.st.hp })}</span><span>${_t('TRÄNKE {n}', { n: P.potions })}</span>${P.sp ? `<span style="color:var(--gold)">${P.sp > 1 ? _t('{n} TALENTPUNKTE', { n: P.sp }) : _t('1 TALENTPUNKT')}</span>` : ''}${P.buffs.map(b => `<span style="color:var(--rune)">${b.n} (${b.rooms})</span>`).join('')}</div>
  <div class="mapwrap"><canvas id="mapcv" width="320" height="150"></canvas>${nodes}<div class="hero" style="left:${hp[0]}%;top:${hp[1]}%">${heroHTML(P, 1.3)}</div>${info}</div>
  <div class="menu foot row">${selN ? `<button class="btn wide" data-act="enter">${_t('Betreten')}</button>` : ''}<button class="btn${selN ? ' alt' : ''}" data-act="hide">${_t('Versteck')}${hideReady() ? ' (!)' : ''}</button><button class="btn alt" data-act="char">${_t('Charakter')}${P.sp ? ' (' + P.sp + ')' : ''}</button><button class="btn alt" data-act="mapmore">${_t('Mehr')}</button></div>`, true);
  drawMapCanvas(M, av);
  checkAch(); weekAnnounce();
}
// Seltener gebrauchte Kartenaktionen und die Legende
function showMapMore() {
  const legend = Object.keys(NODE).map(k => `<span><img src="${iconURL(NODE[k].icon)}" alt="">${NODE[k].n}</span>`).join('');
  showOverlay(`<div class="head"><h2>${_t('AKT {act}', { act: P.act })}</h2><div class="hbtns"><button class="btn alt sm" data-act="tomapview">${_t('Zurück')}</button></div></div>
  <div class="menu two"><button class="btn alt" data-act="daily">${_t('Tages-Challenge')}</button><button class="btn alt" data-act="news" data-id="map">${_t('Neuigkeiten')}</button><button class="btn alt" data-act="title">${_t('Speichern & Hauptmenü')}</button>${hookHTML('mapMore')}</div>
  ${weekHTML()}<h3>${_t('LEGENDE')}</h3><div class="legend open">${legend}</div>`);
}
function hideReady() { return minePending('mine') > 0 || minePending('garden') > 0 || BUILDORDER.some(k => { const c = buildCost(k); return c && !BUILD[k].fixed && canAfford(c.mats, c.gold); }); }
function drawMapCanvas(M, av) {
  const cv = $('mapcv'); if (!cv) return;
  // quadratische Pixel: Auflösung passend zur Größe des Kartenrahmens
  const box = cv.parentNode.getBoundingClientRect(), px_ = Math.max(2, Math.round(box.height / 120));
  cv.width = Math.max(160, Math.round(box.width / px_)); cv.height = Math.max(80, Math.round(box.height / px_));
  const W = cv.width, H = cv.height, g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(mapArt(M, W, H), 0, 0);
  const P2 = (r, i) => { const [x, y] = r < 0 ? mapStart() : nodePos(M, r, i); return [x / 100 * W, y / 100 * H]; };
  const path = (a, b, col, big, seed) => {
    const [x0, y0] = a, [x1, y1] = b, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, l = Math.hypot(x1 - x0, y1 - y0) || 1, off = ((seed % 9) - 4) * 2.2, cx = mx - (y1 - y0) / l * off, cy = my + (x1 - x0) / l * off, n = Math.ceil(l / 2.5);
    g.fillStyle = col;
    for (let k = 1; k < n; k++) { if (k % 2) continue; const t = k / n, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1; if (big) { g.fillStyle = '#120e18'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); g.fillStyle = col; } g.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1); }
  };
  M.rows.forEach((row, r) => row.forEach((n, i) => { for (const j of n.links) {
    const to = M.rows[r + 1][j], taken = n.done && (to.done || (M.pos.r === r + 1 && M.pos.i === j)), avail = M.pos.r === r && M.pos.i === i && av.includes(j), future = r > M.pos.r;
    path(P2(r, i), P2(r + 1, j), taken ? '#e8b04a' : avail ? '#fff3c0' : future ? 'rgba(200,184,154,.75)' : 'rgba(90,80,100,.7)', taken || avail || future, r * 31 + i * 7 + j * 3);
  } }));
  if (M.pos.r < 0) M.rows[0].forEach((n, i) => path(P2(-1, 0), P2(0, i), '#fff3c0', true, i * 5));
  const fogFrom = M.pos.r + 4;
  if (fogFrom < 7 && !MAPV) { const x0 = (fogFrom) / 7 * W - 12; const gr = g.createLinearGradient(x0, 0, x0 + 30, 0); gr.addColorStop(0, 'rgba(14,10,20,0)'); gr.addColorStop(1, 'rgba(14,10,20,.55)'); g.fillStyle = gr; g.fillRect(x0, 0, W - x0, H); }
  else if (fogFrom < 7) { const y0 = H - fogFrom / 7 * H + 12; const gr = g.createLinearGradient(0, y0, 0, y0 - 30); gr.addColorStop(0, 'rgba(14,10,20,0)'); gr.addColorStop(1, 'rgba(14,10,20,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, y0); }
}
function openActScreen() {
  setState('menu'); showHud(false);
  const q = qualOf(P.act), A = ACTS[(P.act - 2) % ACTS.length], fin = P.act - 1 === STORY_ACTS;
  showOverlay(`<div class="center"><h2>${_t('AKT {act} BEZWUNGEN', { act: P.act - 1 })}</h2><p class="sub">${_t('{name} ist gefallen.', { name: esc(bossOf(P.act - 1).name) })}</p>${P.act - 1 <= STORY_ACTS ? `<div class="dlg"><div><p>${esc(A.o)}</p></div></div>` : ''}
  <p class="sub">${fin ? _t('Die Geschichte ist erzählt – doch die Qual beginnt erst.') + ' ' : ''}${q ? _t('Qual {q}: Gegner +{p} % stärker, bessere Beute.', { q, p: Math.round((Math.pow(1.3, q) - 1) * 100) }) : _t('Weiter geht es: {biome}.', { biome: biomeOf(P.act).name })} ${_t('Du erhältst Glücksmünzen für deinen Sieg.')}</p>
  <div class="menu"><button class="btn" data-act="actnext">${_t('Weiter zu Akt {act}', { act: P.act })}</button><button class="btn alt" data-act="acthide">${_t('Zuerst ins Versteck')}</button></div></div>`);
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
    let gear = ''; for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; gear += `<div class="gearslot"><div style="font-size:14px;color:var(--parch-dim)">${s === 'weapon' ? _t('Waffe') : AR[s].label}</div>${it ? itemSlot(it, 'isel', sel && sel.it === it) : ''}</div>`; }
    const sets = {}; for (const s of ['weapon', 'armor', 'helm']) { const it = P.gear[s]; if (it && it.set) sets[it.set] = (sets[it.set] || 0) + 1; }
    const side = sel ? `<div class="side sheet"><button class="btn alt sm sheetx" data-act="isel" data-id="" aria-label="${_t('Schließen')}"><span class="x">×</span></button>${itemDetail(sel.it, sel.eq ? '' : `${canEquip(sel.it) ? `<button class="btn sm" data-act="equip" data-id="${sel.it.uid}">${_t('Anlegen')}</button>` : ''}<button class="btn alt sm" data-act="sell" data-id="${sel.it.uid}">${_t('Verkaufen')} <i class="coin"></i>${itemPrice(sel.it)}</button>${hookHTML('itemActions', sel.it)}`)}${sel.eq ? '' : compareHTML(sel.it)}</div>`
      : `<div class="side"><p class="sub" style="margin-top:0">${_t('Tippe einen Gegenstand an, um Details, Vergleich und Aktionen zu sehen.')}</p></div>`;
    body = `<div class="split"><div><div class="box"><div style="display:flex;gap:12px;align-items:center">${heroHTML(P, 2.4)}<div class="stats" style="flex:1"><span>${_t('SCH {n}', { n: Math.round(st.wbase * st.dmgMul) })}</span><span>${_t('LP {n}', { n: st.hp })}</span><span>${_t('VER {n}', { n: Math.round(st.def) })}</span><span>${_t('KRIT {n}', { n: pct(st.crit) })}</span><span>${_t('KRIT-SCH {n}', { n: pct(st.critdmg) })}</span><span>${_t('TEMPO {n}/s', { n: (1 / st.cd).toFixed(1) })}</span>${st.dr ? `<span>${_t('MINDERUNG {n}', { n: pct(st.dr) })}</span>` : ''}${st.dodge ? `<span>${_t('AUSWEICHEN {n}', { n: pct(st.dodge) })}</span>` : ''}${st.regen ? `<span>${_t('REGEN {n}', { n: st.regen.toFixed(1) })}</span>` : ''}${st.leech ? `<span>${_t('LEBENSRAUB {n}', { n: pct(st.leech) })}</span>` : ''}${st.gold ? `<span>${_t('GOLD +{n}', { n: pct(st.gold) })}</span>` : ''}${st.m.xp ? `<span>${_t('EP +{n}', { n: pct(st.m.xp) })}</span>` : ''}</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">${gear}</div>
      ${Object.keys(sets).map(k => `<p style="font-size:16px;color:#4ade80;margin:8px 0 0">${SETS[k].n} ${sets[k]}/3 – ${sets[k] >= 2 ? SETS[k].d2 : ''}${sets[k] >= 3 ? ' · ' + SETS[k].d3 : ''}</p>`).join('')}</div>
      <div class="box" style="margin-top:10px"><h3 style="margin-top:0">${_t('BEUTEL {n}/30', { n: P.bag.length })}</h3><div class="grid">${P.bag.map(it => itemSlot(it, 'isel', sel && sel.it === it)).join('') || '<p class="sub">' + _t('Leer') + '</p>'}</div></div></div>${side}</div>`;
  } else if (charTab === 'tal') {
    body = `<div class="head"><p class="sub" style="margin:0">${_t('Freie Punkte: {n} · 1 Punkt pro Level', { n: `<b style="color:var(--gold)">${P.sp}</b>` })}</p><button class="btn alt sm" data-act="respec" ${spentPoints() ? '' : 'disabled'}>${_t('Zurücksetzen ({gold} Gold)', { gold: respecCost() })}</button></div><div class="tree">`;
    TALENTS[P.cls].forEach(([bn, nodes], bi) => {
      body += `<div class="branch"><h4>${bn.toLocaleUpperCase(LOCALE)}</h4>`;
      nodes.forEach((n, ni) => { const s = talentState(P.cls, bi, ni); body += `<button class="tal${s.locked ? ' lock' : ''}${s.can ? ' can' : ''}${s.r >= n.max ? ' max' : ''}" data-act="tal" data-id="${bi},${ni}"><span class="r">${s.r}/${n.max}</span><b>${n.n}</b><small>${n.d}${n.max > 1 ? ' ' + _t('je Rang') : ''}</small></button>`; });
      body += '</div>';
    });
    body += '</div>';
    body += `<h3>${_t('FÄHIGKEITEN')}</h3>${C.skills.concat([C.ult]).map(id => { const S = SKILLS[id]; return `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(S.icon)}" alt=""></div><div><div class="nm">${S.n}${S.ult ? ' (' + _t('Ultimative') + ')' : ''}</div><div class="st">${S.d}${S.cost ? ' · ' + S.cost + ' ' + C.res.name + ' · ' + S.cd + ' s' : ' · ' + _t('bei voller Wut')}</div>${hookHTML('skillRow', id)}</div><span></span></div>`; }).join('')}`;
  } else if (charTab === 'vorrat') {
    body = `<h3>${_t('MATERIALIEN')}</h3><div class="grid">${MATORDER.map(k => `<div class="slot" title="${MATS[k].n}" style="cursor:default"><img src="${iconURL(['mat', k])}" alt="${MATS[k].n}"><span class="n">${P.mats[k] || 0}</span></div>`).join('')}</div>
    <p style="font-size:15px;color:var(--parch-dim)">${MATORDER.map(k => MATS[k].n + ' ' + (P.mats[k] || 0)).join(' · ')}</p>
    <h3>${_t('EDELSTEINE')}</h3>${gemListHTML(false)}<h3>${_t('TRÄNKE & MÜNZEN')}</h3><p class="sub">${_t('{n}/{max} Heiltränke (heilen {p} %, 6 s Abklingzeit). {fate} Glücksmünzen für den Glückstempel.', { n: P.potions, max: potMax(), p: Math.round(potHeal() * 100), fate: P.fate || 0 })}</p>`;
  } else if (charTab === 'look') {
    lkMode = 'char'; body = lookEditorHTML();
  } else if (charTab === 'para') {
    const free = P.paragon - (P.pp.dmg + P.pp.hp + P.pp.def + P.pp.crit);
    body = `<p class="sub">${_t('Ab Level 50 sammelst du Paragon-Erfahrung. Jeder Paragon-Level gibt einen Punkt – ohne Obergrenze.')}</p><div class="stats"><span>${_t('PARAGON {n}', { n: P.paragon })}</span><span>${_t('FREI {n}', { n: free })}</span><span>${_t('EP {n}', { n: fmt(P.pxp) + '/' + fmt(PARAGON_XP) })}</span></div>
    ${[['dmg', _t('Schaden +1 %')], ['hp', _t('Lebenspunkte +1 %')], ['def', _t('Verteidigung +1')], ['crit', _t('Krit +0,2 %')]].map(([k, l]) => `<div class="row" style="cursor:default"><div class="ic" style="font-family:var(--f-display);font-size:9px">${P.pp[k]}</div><div><div class="nm">${l}</div></div><button class="btn sm" data-act="pp" data-id="${k}" ${free > 0 ? '' : 'disabled'}>+1</button></div>`).join('')}
    <h3>${_t('WIEDERGEBURT')}</h3><p class="sub">${_t('Ab Level 50 und Akt 5: zurück auf Level 1 und Akt 1. Ausrüstung, Materialien, Gold und Paragon bleiben. Dauerhaft +10 % Schaden und LP pro Wiedergeburt und eine goldene Aura. Bisher: {n}.', { n: P.rebirths })}</p>
    <button class="btn red" data-act="rebirth" ${P.lv >= 50 && P.maxAct >= 5 ? '' : 'disabled'}>${_t('Wiedergeburt')}</button>`;
  } else { const t = HOOK.charTabs.find(t => t.k === charTab); if (t) body = t.body(); }
  showOverlay(`<div class="head"><h2>${esc(P.name).toLocaleUpperCase(LOCALE)}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)} <span style="color:#ffd24a"><i class="fc"></i>${P.fate || 0}</span></div><button class="btn alt sm" data-act="cback">${_t('Zurück')}</button></div></div>
  <div class="stats"><span>${C.name}</span><span>${_t('LV {lv}', { lv: P.lv })}</span><span>${_t('EP {n}', { n: fmt(P.xp) + '/' + fmt(xpNext(P.lv)) })}</span><span>${DIFFS[P.diff].n}${P.hc ? ' · ' + _t('HARDCORE') : ''}</span><span>${_t('KILLS {n}', { n: fmt(P.stats.kills) })}</span></div>
  <div class="tabs" role="tablist">${tab_('gear', _t('AUSRÜSTUNG'))}${tab_('tal', _t('TALENTE') + (P.sp ? ' (' + P.sp + ')' : ''))}${tab_('vorrat', _t('VORRAT'))}${tab_('look', _t('AUSSEHEN'))}${tab_('para', _t('PARAGON'))}${HOOK.charTabs.map(t => tab_(t.k, t.label())).join('')}</div>
  ${body}`, true);
}
/* Vergleich mit dem angelegten Gegenstand */
function compareHTML(it) {
  const cur = P.gear[it.slot]; if (!cur || !canEquip(it)) return '';
  const d = itemScore(it) / Math.max(1, itemScore(cur)) - 1;
  return `<p class="sub" style="margin:4px 0 0">${_t('Im Vergleich zu {item}: {diff}', { item: esc(itemName(cur)), diff: `<b style="color:${d >= 0 ? 'var(--moss)' : 'var(--blood)'}">${d >= 0 ? '▲ +' : '▼ '}${Math.round(d * 100)} %</b>` })}</p>`;
}
function gemListHTML(withAct) {
  let h = '', any = false;
  for (const id of GEMORDER) for (let gr = 0; gr < 5; gr++) { const k = id + ':' + gr, n = P.gems[k] || 0; if (!n) continue; any = true; const cost = gemCombineCost(gr); h += `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['gem', id, gr])}" alt=""></div><div><div class="nm" style="color:${GEMS[id].c}">${_t('{grade} {gem}', { grade: GEMGRADE[gr], gem: GEMS[id].n })} ×${n}</div><div class="st">${GEMS[id].s(GEMS[id].v[gr])}</div></div><div class="acts">${withAct === 'sock' ? `<button class="btn sm" data-act="sock" data-id="${k}">${_t('Einsetzen')}</button>` : withAct === 'comb' && gr < 4 ? `<button class="btn sm" data-act="gcomb" data-id="${id},${gr}" ${n >= 3 && P.gold >= cost ? '' : 'disabled'}>${_t('3 → 1 ({cost} G)', { cost })}</button>` : ''}</div></div>`; }
  return any ? h : '<p class="sub">' + _t('Keine Edelsteine. Elite-Gegner, Truhen, Erzadern und Bosse lassen welche fallen.') + '</p>';
}

/* ---------- Werkbank (Karte, Schmiede, Juwelier) ---------- */
let wbTab = 'up', wbFree = false, wbMode = 'node', fuseA = null, fuseB = null, forgeSlot = 'weapon';
const WB_TABS = { node: ['up', 'fuse', 'forge', 'craft', 'sock', 'gems', 'dye'], act: ['up', 'fuse', 'forge', 'craft', 'sock', 'gems', 'dye'], smith: ['up', 'fuse', 'forge', 'craft', 'dye'], jewel: ['sock', 'gems', 'trans'] };
const WB_LABEL = { up: _t('AUFWERTEN'), fuse: _t('VERSCHMELZEN'), forge: _t('SCHMIEDEN'), craft: _t('HERSTELLEN'), sock: _t('SOCKEL'), gems: _t('EDELSTEINE'), dye: _t('FARBEN'), trans: _t('VEREDELN') };
for (const t of HOOK.wbTabs) { for (const m of t.modes) WB_TABS[m].push(t.k); WB_LABEL[t.k] = t.label(); }
function openWorkbench(mode) {
  if (mode !== undefined) { wbMode = mode; wbFree = mode === 'node'; fuseA = fuseB = null; }
  if (!WB_TABS[wbMode].includes(wbTab)) wbTab = WB_TABS[wbMode][0];
  setState('menu'); showHud(false); computeStats();
  const tab_ = k => `<button class="tab" role="tab" aria-selected="${wbTab === k}" data-act="wtab" data-id="${k}">${WB_LABEL[k]}</button>`;
  const all = ['weapon', 'armor', 'helm'].map(s => P.gear[s]).filter(Boolean).concat(P.bag);
  if (!selItem || !findItem(selItem)) selItem = P.gear.weapon.uid;
  const sel = findItem(selItem), it = sel.it;
  const list = `<div class="grid" style="margin-bottom:8px">${all.map(x => itemSlot(x, 'wsel', x === it)).join('')}</div>`;
  let body = '';
  if (wbTab === 'up') {
    const c = it.up < 10 ? upCost(it, it.up + 1) : null;
    body = `<div class="split"><div>${list}</div><div class="side sheet">${c ? `<h3>${_t('AUFWERTEN AUF +{n}', { n: it.up + 1 })}</h3>${costHTML(c.mats, c.gold)}<button class="btn" data-act="up" ${canAfford(c.mats, c.gold) ? '' : 'disabled'}>${_t('Aufwerten · {p} %', { p: Math.round(c.chance * 100) })}</button><p class="sub">${_t('Erfolgschance: {p}', { p: `<b style="color:${c.chance < 1 ? 'var(--gold)' : 'var(--moss)'}">${Math.round(c.chance * 100)} %</b>` })}${wbFree ? ' ' + _t('(Werkbank-Bonus +5 %)') : ''}. ${_t('Bei Misserfolg sind die Materialien weg, der Gegenstand bleibt. Ab +5 leuchtet deine Ausrüstung, ab +8 bekommt sie eine Aura.')}</p>` : '<p class="sub">' + _t('Maximal aufgewertet.') + '</p>'}${itemDetail(it, '')}</div></div>`;
  } else if (wbTab === 'fuse') {
    const A = fuseA && findItem(fuseA) ? findItem(fuseA).it : null, Bf = fuseB && findItem(fuseB) ? findItem(fuseB).it : null, err = fuseCheck(A, Bf);
    let side = '';
    body = `<p class="sub">${_t('Verschmelze zwei Gegenstände derselben Art. Der {main} behält Aussehen und Namen, das {victim} vergeht. Ergebnis: höchste Stufe und Aufwertung, die besten Zusatzwerte beider, einen Zusatzwert mehr, +6 % Grundwerte – und vielleicht eine höhere Seltenheit.', { main: `<b style="color:var(--gold)">${_t('Hauptgegenstand')}</b>`, victim: `<b style="color:var(--blood)">${_t('Opfer')}</b>` })}</p>
    <div class="grid" style="margin-bottom:8px">${all.map(x => `<button class="slot${x === A ? ' fa' : x === Bf ? ' fb' : ''}" data-act="fsel" data-id="${x.uid}" style="box-shadow:inset 0 0 0 2px ${itemColor(x)}${x === A ? ',0 0 0 3px #e8b04a' : x === Bf ? ',0 0 0 3px #c8463c' : ''};${A && !Bf && x !== A && (x.slot !== A.slot || !P.bag.includes(x)) ? 'opacity:.35' : ''}" aria-label="${esc(itemName(x))}"><img src="${itemIconURL(x)}" alt="">${x === A ? '<span class="u">' + _t('HAUPT') + '</span>' : x === Bf ? '<span class="u" style="color:#ff6a5a">' + _t('OPFER') + '</span>' : x.fz ? `<span class="n">★${x.fz}</span>` : ''}</button>`).join('')}</div>`;
    const mini = (x, l, col) => `<div class="row" style="cursor:default"><div class="ic" style="box-shadow:inset 0 0 0 2px ${col}"><img src="${itemIconURL(x)}" alt=""></div><div><div class="st" style="margin:0">${l}</div><div class="nm" style="color:${itemColor(x)}">${esc(itemName(x))}</div></div><span></span></div>`;
    if (err) side += `${A ? itemDetail(A, '') : ''}<p class="sub" style="color:var(--gold)">${esc(err)}</p>${A ? '<button class="btn alt sm" data-act="freset">' + _t('Auswahl zurücksetzen') + '</button>' : ''}`;
    else { const R = fusePreview(A, Bf), ch = fuseChance(A, Bf), c = fuseCost(A, Bf); side += `<h3 style="margin-top:0">${_t('ERGEBNIS')}</h3>${costHTML(c.mats, c.gold)}<div class="acts" style="justify-content:flex-start"><button class="btn" data-act="fuse" ${canAfford(c.mats, c.gold) ? '' : 'disabled'}>${_t('Verschmelzen')}</button><button class="btn alt sm" data-act="freset">${_t('Neu wählen')}</button></div>${ch > 0 && ch < 1 ? `<p class="sub">${_t('Dazu {chance} auf {rar} mit einem weiteren Zusatzwert.', { chance: `<b style="color:var(--rune)">${_t('{p} % Chance', { p: Math.round(ch * 100) })}</b>`, rar: A.rar === 4 ? `<b style="color:#ff4fd8">${_t('MYTHISCH')}</b>` : RAR[A.rar + 1].n })}${Bf.gems.length ? ' ' + _t('Edelsteine des Opfers kommen zurück in den Vorrat.') : ''}</p>` : ''}${itemDetail(R, '')}${mini(A, _t('HAUPTGEGENSTAND'), '#e8b04a')}${mini(Bf, _t('OPFER – VERGEHT'), '#c8463c')}`; }
    body = `<div class="split"><div>${body}</div><div class="side${A ? ' sheet' : ''}">${side}</div></div>`;
  } else if (wbTab === 'forge') {
    body = `<p class="sub">${_t('Schmiede einen magischen Gegenstand aus einem bestimmten Material – garantiert in dieser Stufe, mit zufälliger Form.')}${hideLv('schmiede') >= 2 ? ' ' + _t('Schmiede-Rabatt aktiv.') : ''}</p><div class="opts">${['weapon', 'armor', 'helm'].map(s => `<button class="opt${forgeSlot === s ? ' sel' : ''}" data-act="fslot" data-id="${s}">${s === 'weapon' ? _t('Waffe') : AR[s].label}</button>`).join('')}</div>`;
    body += MAT.map((M, t) => { const c = forgeCost(t, forgeSlot), ok = forgeOk(t), sample = forgeSlot === 'weapon' ? weaponArt({ slot: 'weapon', base: P.gear.weapon.base, form: wform(P.gear.weapon).id, tier: t, rar: 1, aff: {}, gems: [] }).c : armorArt({ slot: forgeSlot, base: forgeSlot, tier: t, rar: 1, aff: {}, gems: [] }, P.cls); return `<div class="row" style="cursor:default;${ok ? '' : 'opacity:.5'}"><div class="ic"><img src="${sample.toDataURL()}" alt=""></div><div><div class="nm" style="color:${M.m[2]}">${M.n}${forgeSlot !== 'weapon' ? ' · ' + CLASSES[P.cls].names[t][forgeSlot === 'armor' ? 0 : 1] : ''}</div><div class="st">${_t('Stufe {n}', { n: t + 1 })}${ok ? '' : ' · ' + _t('ab Level {lv}', { lv: REQ[t] })}</div>${costHTML(c.mats, c.gold)}</div><button class="btn sm" data-act="forge" data-i="${t}" ${ok && canAfford(c.mats, c.gold) ? '' : 'disabled'}>${_t('Schmieden')}</button></div>`; }).join('');
  } else if (wbTab === 'craft') {
    body = RECIPES.map(R => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(R.id === 'potion' ? ['s', 288, 336, 16, 16] : R.id === 'gem' ? ['gem', 'rubin', 1] : R.id === 'socket' ? ['gem', 'saphir', 3] : ['fx', 'sparks', 2])}" alt=""></div><div><div class="nm">${R.n}</div><div class="st">${R.d}${R.needItem ? ' – ' + _t('für: {item}', { item: '<b style="color:' + itemColor(it) + '">' + esc(itemName(it)) + '</b>' }) : ''}</div>${costHTML(R.cost, R.gold)}</div><button class="btn sm" data-act="craft" data-id="${R.id}" ${canAfford(R.cost, R.gold) ? '' : 'disabled'}>${_t('Herstellen')}</button></div>`).join('') + '<p class="sub">' + _t('Für Umschmieden und Sockel bohren den Gegenstand im Reiter „Aufwerten“ oder „Sockel“ auswählen.') + '</p>';
  } else if (wbTab === 'sock') {
    body = `<div class="split"><div>${list}</div><div class="side sheet">${itemDetail(it, it.gems.length ? `<button class="btn alt sm" data-act="unsock">${_t('Edelsteine entfernen ({gold} Gold)', { gold: 40 + it.gems.length * 20 })}</button>` : '')}<h3>${_t('EDELSTEIN EINSETZEN ({n}/{max} Sockel)', { n: it.gems.length, max: it.sockets })}</h3>${it.sockets > it.gems.length ? gemListHTML('sock') : '<p class="sub">' + _t('Keine freien Sockel – an der Werkbank kannst du welche bohren.') + '</p>'}</div></div>`;
  } else if (wbTab === 'gems') {
    body = `<p class="sub">${_t('Drei gleiche Edelsteine verschmelzen zu einem besseren.')}${hideLv('juwelier') >= 2 ? ' ' + _t('Juwelier-Rabatt aktiv.') : ''}</p>` + gemListHTML('comb');
  } else if (wbTab === 'trans') {
    body = '<p class="sub">' + _t('Veredle Materialien, die du übrig hast, zu selteneren.') + '</p>' + TRANSMUTE.map(([f, t, n, g], i) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['mat', t])}" alt=""></div><div><div class="nm">${n} ${MATS[f].n} → 1 ${MATS[t].n}</div>${costHTML({ [f]: n }, g)}</div><button class="btn sm" data-act="trans" data-i="${i}" ${(P.mats[f] || 0) >= n && P.gold >= g ? '' : 'disabled'}>${_t('Veredeln')}</button></div>`).join('');
  } else if (HOOK.wbTabs.some(t => t.k === wbTab)) {
    body = HOOK.wbTabs.find(t => t.k === wbTab).body(it, list, all);
  } else if (wbTab === 'dye') {
    body = `<div style="display:flex;gap:16px;align-items:center;margin-bottom:10px">${heroHTML(P, 2.4)}<p class="sub">${_t('Farbstoffe färben deine Rüstung. „Material“ zeigt die echte Farbe von Mithril, Adamant, Drachen … Einmal freigeschaltet, kannst du jederzeit wechseln.')}</p></div>` + DYES.map(D => { const have = P.dyes.includes(D.id); return `<div class="row${P.dye === D.id ? ' sel' : ''}" style="cursor:default"><div class="ic">${heroHTML(Object.assign({}, P, { dye: D.id, look: P.look }), .9)}</div><div><div class="nm">${D.n}</div>${have ? '<div class="st">' + _t('Freigeschaltet') + '</div>' : costHTML(D.cost, 0)}</div><button class="btn sm" data-act="dye" data-id="${D.id}" ${have || hasMats(D.cost) ? '' : 'disabled'}>${P.dye === D.id ? _t('Aktiv') : have ? _t('Anlegen') : _t('Freischalten')}</button></div>`; }).join('');
  }
  const title = wbMode === 'smith' ? _t('SCHMIEDE') : wbMode === 'jewel' ? _t('JUWELIER') : _t('WERKBANK'), npc = wbMode === 'smith' ? npcLine('schmiede') : wbMode === 'jewel' ? npcLine('juwelier') : '';
  showOverlay(`<div class="head"><h2>${title}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div><button class="btn ${wbMode === 'smith' || wbMode === 'jewel' ? 'alt ' : ''}sm" data-act="wbdone">${wbMode === 'smith' || wbMode === 'jewel' ? _t('Zurück') : _t('Weiter')}</button></div></div>${npc}
  <div class="cost" style="font-size:16px">${MATORDER.filter(k => P.mats[k]).map(k => `<span><img src="${iconURL(['mat', k])}" alt="${MATS[k].n}">${P.mats[k] || 0}</span>`).join('') || '<span>' + _t('Keine Materialien') + '</span>'}</div>
  <div class="tabs" role="tablist">${WB_TABS[wbMode].map(tab_).join('')}</div>
  ${body}${wbMode === 'smith' ? buildHTML('schmiede') : wbMode === 'jewel' ? buildHTML('juwelier') : ''}`, true);
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
    const st = stageNum(), extra = [['potion', _t('Heiltrank'), 30, ['s', 288, 336, 16, 16]], ['gem', _t('Zufälliger Splitter'), 70, ['gem', 'smaragd', 0]], ['erz', _t('5 Eisenerz'), 45, ['mat', 'erz']], ['leder', _t('5 Leder'), 45, ['mat', 'leder']], ['kristall', _t('Seelenkristall'), 110, ['mat', 'kristall']], ['horn', _t('Dämonenhorn'), 140, ['mat', 'horn']]];
    if (st >= 10) extra.push(['mithril', _t('Mithrilerz'), 180, ['mat', 'mithril']]); if (st >= 16) extra.push(['adamant', _t('Adamanterz'), 260, ['mat', 'adamant']]); if (st >= 28) extra.push(['schuppe', _t('Drachenschuppe'), 480, ['mat', 'schuppe']]);
    body += extra.map(([k, n, p, ic]) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(ic)}" alt=""></div><div><div class="nm">${n}</div></div><button class="btn sm" data-act="buyx" data-id="${k}" data-i="${p}" ${P.gold >= p && !(k === 'potion' && P.potions >= potMax()) ? '' : 'disabled'}><i class="coin"></i>${p}</button></div>`).join('');
  } else {
    body = P.bag.length ? P.bag.map(it => `<div class="row" style="cursor:default"><div class="ic"><img src="${itemIconURL(it)}" alt=""></div><div><div class="nm" style="color:${itemColor(it)}">${esc(itemName(it))}</div><div class="st">${itemLines(it).slice(0, 2).join(' · ')}</div></div><button class="btn sm" data-act="msell" data-id="${it.uid}"><i class="coin"></i>${itemPrice(it)}</button></div>`).join('') + `<button class="btn alt" data-act="sellall" style="width:100%;margin-top:6px">${_t('Alle Gewöhnlichen & Magischen verkaufen')}</button>` : '<p class="sub">' + _t('Dein Beutel ist leer.') + '</p>';
  }
  showOverlay(`<div class="head"><h2>${_t('HÄNDLER BORIN')}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div><button class="btn sm" data-act="mdone">${_t('Weiterziehen')}</button></div></div>
  <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><img class="px" src="${iconURL(['sp', 'dwarf'])}" alt="" style="width:48px;height:48px;object-fit:contain"><p class="sub" style="margin:0">${_t('„Mein Vetter. Gute Ware, faire Preise. Meistens.“')}</p></div>
  <div class="tabs" role="tablist">${tab_('buy', _t('KAUFEN'))}${tab_('sell', _t('VERKAUFEN'))}</div>${body}
  `, true);
}

/* ---------- Schrein, Ereignis, Rast, Rätsel ---------- */
function openShrine() {
  setState('menu'); showHud(false);
  const n = P.map.rows[P.map.pos.r][P.map.pos.i];
  if (!n.choices) { n.choices = SHRINES.map((s, i) => i).sort(() => Math.random() - .5).slice(0, 3); saveChar(); }
  showOverlay(`<h2>${_t('SCHREIN')}</h2><p class="sub">${_t('Drei Altäre leuchten im Halbdunkel. Du kannst nur einen berühren.')}</p>
  ${n.choices.map(i => { const S = SHRINES[i]; return `<button class="row" data-act="shrine" data-i="${i}"><div class="ic"><img src="${iconURL(['fx', 'sparks', i % 6])}" alt=""></div><div><div class="nm" style="color:var(--rune)">${S.n}</div><div class="st">${S.d}</div></div><span></span></button>`; }).join('')}
  <div class="menu" style="margin-top:10px"><button class="btn alt" data-act="sdone">${_t('Nichts berühren')}</button></div>`);
}
function openEvent() {
  setState('menu'); showHud(false);
  const n = P.map.rows[P.map.pos.r][P.map.pos.i];
  if (n.ev == null) { n.ev = Math.floor(Math.random() * EVENTS.length); saveChar(); }
  const E = EVENTS[n.ev];
  showOverlay(`<h2>${E.n.toLocaleUpperCase(LOCALE)}</h2><p class="sub">${E.d}</p><div class="menu">${E.opts.map(o => `<button class="btn ${o.a === 'leave' ? 'alt' : ''}" data-act="ev" data-id="${o.a}">${o.n}</button>`).join('')}</div>`);
}
function openRest() {
  setState('menu'); showHud(false);
  const L = NPCTALK.feuer.filter(l => l[0] <= P.act), l = L[P.act % L.length], S = SPEAKERS[l[1]];
  showOverlay(`<h2>${_t('RASTPLATZ')}</h2><p class="sub">${_t('Ein Lagerfeuer knistert. Du hast dich erholt (+40 % LP). Wofür nutzt du die Nacht?')}</p>
  <div class="say"><img class="px" src="${iconURL(['sp', S.sp])}" alt=""><div><b style="color:${S.c}">${S.n}</b>„${esc(l[2].replace('{name}', P.name))}“</div></div>
  <div class="menu"><button class="btn" data-act="rest2" data-id="sleep">${_t('Tief schlafen (+30 % LP)')}</button><button class="btn" data-act="rest2" data-id="sharpen" ${P.gear.weapon.up < 5 ? '' : 'disabled'}>${_t('Waffe schärfen (+1, bis +5)')}</button><button class="btn" data-act="rest2" data-id="tales">${_t('Geschichten lauschen (Chronikseite oder Erfahrung)')}</button></div>`);
}
function openRiddle(msg) {
  setState('menu'); showHud(false);
  const n = P.map.rows[P.map.pos.r][P.map.pos.i];
  if (n.rd == null) { n.rd = Math.floor(Math.random() * RIDDLES.length); n.ord = [0, 1, 2].sort(() => Math.random() - .5); saveChar(); }
  const R = RIDDLES[n.rd];
  showOverlay(`<h2>${_t('RÄTSELKAMMER')}</h2><div class="dlg"><img class="px" src="${iconURL(['pa', 'frage'])}" alt=""><div><b style="color:#57c7e6">${_t('Sphinx')}</b><p>„${esc(R.q)}“</p></div></div><p class="sub">${_t('Richtig: Glücksmünze, Edelstein und Gold. Falsch: Die Sphinx lässt ihre Wächter los.')}</p>
  <div class="menu">${n.ord.map(i => `<button class="btn alt" data-act="riddle" data-i="${i}">${esc(R.a[i])}</button>`).join('')}</div>${msg || ''}`);
}
function doEvent(a) {
  const st = stageNum();
  switch (a) {
    case 'heal': P.hp = P.st.hp; toast(_t('Vollständig geheilt')); sfx('heal'); nodeLeave(); break;
    case 'gamble': if (P.gold < 50) { toast(_t('Zu wenig Gold')); return; } P.gold -= 50; if (Math.random() < .5) { const g = Math.random() < .4; if (g) { gainGem(randomGem(st)); toast(_t('Ein Edelstein glitzert im Wasser!')); } else { P.gold += 150; toast(_t('+150 Gold!')); } sfx('chest'); } else { toast(_t('Nichts passiert …')); sfx('fail'); } nodeLeave(); break;
    case 'rescue': startRoom('rescue', P.map.pos.r); break;
    case 'cursed': startRoom('cursed', P.map.pos.r); break;
    case 'grave': startRoom('grave', P.map.pos.r); break;
    case 'leave': nodeLeave(); break;
    case 'upw': if (P.gear.weapon.up < 10) P.gear.weapon.up++; computeStats(); toast(itemName(P.gear.weapon)); sfx('craft'); nodeLeave(); break;
    case 'upa': if (P.gear.armor.up < 10) P.gear.armor.up++; computeStats(); toast(itemName(P.gear.armor)); sfx('craft'); nodeLeave(); break;
    case 'potions': P.potions = Math.min(potMax(), P.potions + 2); toast(_t('+2 Heiltränke')); sfx('heal'); nodeLeave(); break;
    case 'mats': for (let i = 0; i < 3; i++) { const k = pick(MATORDER.slice(0, 8)); gainMat(k, ri(2, 3)); } toast(_t('Materialien erhalten')); sfx('coin'); nodeLeave(); break;
    case 'knight': { if (P.potions < 1) { toast(_t('Du hast keinen Heiltrank')); sfx('deny'); return; } P.potions--; const it = randomItem(st, 2); addToBag(it); if (!gainLore()) P.gold += 100 + st * 10; toast(_t('„Nimm meine Klinge. Der Orden lebt.“ – {item}', { item: itemName(it) }), RAR[it.rar].c); sfx('loot'); nodeLeave(); break; }
    case 'sacrifice': { if (!P.bag.length) { toast(_t('Dein Beutel ist leer')); sfx('deny'); return; } let w = P.bag[0]; for (const x of P.bag) if (itemScore(x) < itemScore(w) && x.rar < 5) w = x; P.bag.splice(P.bag.indexOf(w), 1); if (Math.random() < .6) { const it = randomItem(st, Math.min(4, Math.min(w.rar, 4) + 1)); addToBag(it); if (it.rar === 4) stat('legs'); toast(_t('Der Altar gibt: {item}', { item: itemName(it) }), RAR[it.rar].c); sfx('loot'); } else { toast(_t('Der Altar schweigt. {item} ist fort.', { item: itemName(w) }), '#ff6a5a'); sfx('fail'); } nodeLeave(); break; }
    case 'bag': { if (P.gold < 120) { toast(_t('Zu wenig Gold')); sfx('deny'); return; } P.gold -= 120; const r = Math.random(); if (r < .05) { gainFate(1, true); } else if (r < .15) { P.potions = Math.min(potMax(), P.potions + 2); toast(_t('Zwei Heiltränke!')); } else if (r < .35) { const it = randomItem(st, 1); addToBag(it); toast(itemName(it), RAR[it.rar].c); } else if (r < .6) { gainGem(randomGem(st)); toast(_t('Ein Edelstein!')); } else { for (let i = 0; i < 2; i++) gainMat(pick(MATORDER.slice(0, 9)), ri(2, 4)); toast(_t('Ein Beutel voller Materialien')); } sfx('chest'); nodeLeave(); break; }
    case 'honor': P.buffs.push({ n: _t('Ahnen'), buff: { dmg: .15, hp: .15 }, rooms: 4 }); computeStats(); toast(_t('Segen der Ahnen: +15 % Schaden und LP'), '#b892f4'); sfx('ach'); nodeLeave(); break;
    case 'luckwell': if ((P.fate || 0) < 1) { toast(_t('Du hast keine Glücksmünze')); sfx('deny'); return; } P.fate--; if (Math.random() < .3) { gainFate(3, true); sfx('loot'); } else { toast(_t('Die Münze versinkt …')); sfx('fail'); } nodeLeave(); break;
    case 'drink': P.hp = Math.min(P.st.hp, P.hp + P.st.hp * .3); toast(_t('+30 % LP')); sfx('heal'); nodeLeave(); break;
  }
}

/* ---------- Pause, Tod, Tages-Ergebnis ---------- */
function showPause() {
  if (state !== 'play') return; setState('pause');
  const hide = G && G.type === 'versteck';
  showOverlay(`<h2 class="center">${_t('PAUSE')}</h2><p class="sub center">${esc(P.name)} · ${_t('LV {lv}', { lv: P.lv })} · ${hide ? _t('Versteck') : _t('Akt {act}', { act: P.act })}</p><div class="menu"><button class="btn" data-act="resume">${_t('Weiterspielen')}</button><button class="btn alt" data-act="pchar">${_t('Charakter')}</button>${isTouch ? `<button class="btn alt" data-act="ctledit" data-id="pause">${_t('Knöpfe anpassen')}</button>` : ''}<button class="btn alt" data-act="music">${SAVE.meta.settings.music !== false ? _t('Musik aus') : _t('Musik an')}</button><button class="btn alt" data-act="sfx">${SAVE.meta.settings.sfx !== false ? _t('Ton aus') : _t('Ton an')}</button>${hide ? `<button class="btn alt" data-act="hleave">${_t('Zur Weltkarte')}</button>` : ''}<button class="btn alt" data-act="title">${_t('Speichern & Hauptmenü')}</button></div><div class="help">${HELP}</div>`);
}
function showDeath() {
  setState('over'); showHud(false);
  if (P.hc) {
    SAVE.meta.fallen.unshift({ name: P.name, cls: P.cls, lv: P.lv, act: P.act, diff: P.diff, date: Date.now(), kills: P.stats.kills });
    SAVE.chars.splice(SAVE.active, 1); SAVE.active = -1; persist();
    showOverlay(`<div class="over center"><h2>${_t('{name} IST GEFALLEN', { name: esc(P.name).toLocaleUpperCase(LOCALE) })}</h2><p class="sub">${_t('Hardcore kennt keine Gnade. {cls}, Level {lv}, Akt {act}, {kills} Gegner besiegt. Dein Name steht nun in der Ruhmeshalle.', { cls: CLASSES[P.cls].name, lv: P.lv, act: P.act, kills: fmt(P.stats.kills) })}</p><div class="menu"><button class="btn" data-act="hcok">${_t('Zum Titel')}</button></div></div>`);
    return;
  }
  const loss = Math.floor(P.gold * .2);
  showOverlay(`<div class="over center"><h2>${_t('GEFALLEN')}</h2><p class="sub">${G && G.daily ? _t('Die Tages-Challenge ist vorbei.') : _t('Du verlierst {gold} Gold. Level, Ausrüstung und Materialien bleiben.', { gold: loss })}</p>
  <div class="menu">${G && G.daily ? `<button class="btn" data-act="dailyfail">${_t('Zum Titel')}</button>` : `<button class="btn" data-act="retry">${_t('Raum wiederholen')}</button><button class="btn alt" data-act="tomap">${_t('Zurück zur Karte')}</button>`}</div></div>`);
}
function openDailyResult(score, best, kills, time) {
  setState('menu'); showHud(false);
  showOverlay(`<div class="center"><h2>${_t('TAGES-CHALLENGE GESCHAFFT')}</h2><p class="sub">${_t('{kills} Gegner in {time} min.', { kills, time: Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0') })}</p><div class="kv"><span class="pill">${_t('PUNKTE {n}', { n: score })}</span><span class="pill dim">${_t('BESTWERT HEUTE {n}', { n: Math.max(score, best) })}</span></div><p class="sub">${_t('Belohnung: 300 Gold, ein Edelstein und 2 Glücksmünzen. Morgen gibt es neue Räume und neue Gegner-Affixe.')}</p><div class="menu"><button class="btn" data-act="dailyok">${_t('Weiter')}</button></div></div>`);
}
/* Wer mitten im Raum beendet, darf den Ort danach neu wählen (statt ihn zu überspringen) */
function undoRoomEntry() { const M = P.map; if (!M || M.pos.r < 0) return; const n = M.rows[M.pos.r][M.pos.i]; if (!n.done && !UI_NODES.includes(n.t)) M.pos = M.prev ? Object.assign({}, M.prev) : { r: -1, i: -1 }; }

/* ---------- Sammlungen ---------- */
function showAch() {
  const n = ACH.filter(a => SAVE.meta.ach[a.id]).length;
  showOverlay(`<div class="head"><h2>${_t('ERFOLGE {n}/{max}', { n, max: ACH.length })}</h2><button class="btn alt sm" data-act="backtitle">${_t('Zurück')}</button></div><div class="achv">${ACH.map(a => `<div class="ach${SAVE.meta.ach[a.id] ? ' on' : ''}"><b>${a.n}</b><small>${a.d} · ${_t('+{n} Gold', { n: a.r })}</small></div>`).join('')}</div>`, true);
}
function bestiaryHTML() {
  const ks = Object.keys(EN).filter(k => !EN[k].hidden);
  return `<p class="sub">${_t('{n} von {max} Gegnern entdeckt.', { n: ks.filter(k => SAVE.meta.bestiary[k]).length, max: ks.length })}</p>` + ks.map(k => { const D = EN[k], n = SAVE.meta.bestiary[k] || 0, bn = D.boss ? BOSSES.find(b => b.type === k) : null; return `<div class="row" style="cursor:default;${n ? '' : 'opacity:.45'}"><div class="ic"><img src="${iconURL(D.tint || bn && bn.tint ? ['sp', D.sp, D.tint || bn.tint] : ['sp', D.sp])}" alt="" style="${n ? '' : 'filter:brightness(0)'}"></div><div><div class="nm">${n ? (bn ? bn.name : D.name) : '???'}${D.boss ? ` <span class="pill hc">${_t('BOSS')}</span>` : ''}</div><div class="st">${n ? D.desc + (Object.keys(D.drop || {}).length ? ' · ' + _t('Beute: {list}', { list: Object.keys(D.drop).map(m => MATS[m].n).join(', ') }) : '') : _t('Noch nicht entdeckt')}</div></div><span class="pill dim">${_t('{n} besiegt', { n })}</span></div>`; }).join('');
}
function showBestiary() { showOverlay(`<div class="head"><h2>${_t('BESTIARIUM')}</h2><button class="btn alt sm" data-act="backtitle">${_t('Zurück')}</button></div>${bestiaryHTML()}`, true); }
function showHall() {
  const heroes = SAVE.chars.slice().sort((a, b) => b.maxAct - a.maxAct || b.lv - a.lv);
  const days = Object.keys(SAVE.meta.daily).sort().reverse().slice(0, 7);
  showOverlay(`<div class="head"><h2>${_t('RUHMESHALLE')}</h2><button class="btn alt sm" data-act="backtitle">${_t('Zurück')}</button></div>
  <h3>${_t('LEBENDE HELDEN')}</h3>${heroes.map(c => `<div class="cardrow">${heroHTML(c, 1.4)}<div><div style="font-size:20px">${esc(c.name)} ${c.hc ? '<span class="pill hc">HC</span>' : ''}</div><div style="font-size:15px;color:var(--parch-dim)">${CLASSES[c.cls].name} · ${_t('LV {lv}', { lv: c.lv })} · ${_t('Höchster Akt {act}', { act: c.maxAct })} · ${_t('{n} Kills', { n: fmt(c.stats.kills) })} · ${DIFFS[c.diff].n}</div></div><span></span></div>`).join('') || '<p class="sub">' + _t('Noch keine Helden.') + '</p>'}
  <h3>${_t('GEFALLENE HARDCORE-HELDEN')}</h3>${SAVE.meta.fallen.map(f => `<div class="cardrow"><img class="px" src="${iconURL(['s', 288, 432, 16, 16])}" alt="" style="width:40px"><div><div style="font-size:20px">${esc(f.name)}</div><div style="font-size:15px;color:var(--parch-dim)">${CLASSES[f.cls].name} · ${_t('LV {lv}', { lv: f.lv })} · ${_t('Akt {act}', { act: f.act })} · ${_t('{n} Kills', { n: fmt(f.kills) })} · ${new Date(f.date).toLocaleDateString(LOCALE)}</div></div><span></span></div>`).join('') || '<p class="sub">' + _t('Niemand. Noch nicht.') + '</p>'}
  <h3>${_t('TAGES-CHALLENGE')}</h3>${days.map(d => `<div style="font-size:18px">${new Date(+d.slice(0, 4), d.slice(4, 6) - 1, +d.slice(6, 8)).toLocaleDateString(LOCALE)}: ${_t('{n} Punkte', { n: `<b style="color:var(--gold)">${SAVE.meta.daily[d]}</b>` })}</div>`).join('') || '<p class="sub">' + _t('Noch nicht gespielt.') + '</p>'}`, true);
}
function showCode(msg) {
  showOverlay(`<h2>${_t('SPIELSTAND')}</h2><p class="sub">${_t('Kopiere den Code auf einem Gerät und füge ihn auf dem anderen ein. Er enthält alle Helden, das Versteck, Erfolge und das Bestiarium. Alte Codes aus Version 1 bis 3 funktionieren auch.')}</p>
  <h3>${_t('DEIN CODE')}</h3><textarea id="codeOut" readonly rows="4">${exportCode()}</textarea>
  <div class="menu" style="margin-top:8px"><button class="btn alt" data-act="copycode">${_t('Code kopieren')}</button></div>
  <h3>${_t('CODE EINFÜGEN')}</h3><textarea id="codeIn" rows="4" placeholder="${_t('Code hier einfügen …')}"></textarea>
  ${msg ? `<p class="sub" style="color:var(--gold)">${msg}</p>` : ''}
  <div class="menu" style="margin-top:8px"><button class="btn" data-act="loadcode">${_t('Code laden')}</button><button class="btn alt" data-act="backtitle">${_t('Zurück')}</button></div>`);
}
function showSettings() {
  const s = SAVE.meta.settings;
  showOverlay(`<h2>${_t('EINSTELLUNGEN')}</h2><div class="menu" style="margin-top:12px"><button class="btn alt" data-act="music">${_t('Musik: {v}', { v: s.music !== false ? _t('AN') : _t('AUS') })}</button><button class="btn alt" data-act="sfx">${_t('Soundeffekte: {v}', { v: s.sfx !== false ? _t('AN') : _t('AUS') })}</button><button class="btn alt" data-act="bigui">${_t('Schrift: {v}', { v: s.bigui ? _t('GROSS') : _t('NORMAL') })}</button><button class="btn alt" data-act="calm">${_t('Wackeln & Blitzen: {v}', { v: s.calm ? _t('AUS') : _t('AN') })}</button><button class="btn alt" data-act="controls">${_t('Steuerung')}</button><button class="btn alt" data-act="news" data-id="settings">${_t('Neuigkeiten')}</button><button class="btn alt" data-act="langs" data-id="settings">🌐 ${LANGS[LANG]}</button>${UPD.on ? `<button class="btn alt" data-act="checkupd">${_t('Nach Update suchen')}</button>` : ''}<button class="btn" data-act="backtitle">${_t('Zurück')}</button></div><p class="sub" id="updmsg">${_t('Version {v}', { v: VERSION })}</p>`);
}
// Sprache: jede in ihrer eigenen Schreibweise, der Wechsel lädt die Seite neu
let langBack = 'title';
function showLang(back) {
  langBack = back || 'title';
  showOverlay(`<div class="head"><h2>${_t('SPRACHE')}</h2><div class="hbtns"><button class="btn alt sm" data-act="langback">${_t('Zurück')}</button></div></div>
  <div class="opts langs">${Object.keys(LANGS).map(c => `<button class="opt${c === LANG ? ' sel' : ''}" data-act="setlang" data-id="${c}" lang="${c}">${LANGS[c]}</button>`).join('')}</div>`);
}
function showControls() {
  const c = ctlSet(), opt = (act, on, label, small) => `<button class="opt${on ? ' sel' : ''}" data-act="${act}">${label}<small>${small}</small></button>`;
  showOverlay(`<h2>${_t('STEUERUNG')}</h2>
  <h3>${_t('JOYSTICK')}</h3><div class="opts">${opt('ctl_stick_float', c.stick !== 'fixed', _t('FREI'), _t('Erscheint dort, wo du links hintippst, und folgt dem Daumen'))}${opt('ctl_stick_fixed', c.stick === 'fixed', _t('FEST'), _t('Immer an derselben Stelle'))}</div>
  <div class="opts"><button class="opt" data-act="ctl_ss-">${_t('Joystick kleiner')}</button><button class="opt sel" style="cursor:default">${Math.round(c.stickSize * 100)} %</button><button class="opt" data-act="ctl_ss+">${_t('Joystick größer')}</button></div>
  <h3>${_t('HEILTRANK')}</h3><div class="opts">${opt('ctl_pot_tap', c.pot === 'tap', _t('TIPPEN'), _t('Sofort trinken (gesperrt kurz nach einer Rolle)'))}${opt('ctl_pot_hold', c.pot === 'hold', _t('HALTEN'), _t('Knopf kurz gedrückt halten – nie mehr aus Versehen'))}${opt('ctl_pot_auto', c.pot === 'auto', _t('AUTO'), _t('Trinkt automatisch unter 30 % LP'))}</div>
  <h3>${_t('ZIELEN & GEFÜHL')}</h3><div class="opts">${opt('ctl_aim', c.aim, _t('ZIELMARKIERUNG {v}', { v: c.aim ? _t('AN') : _t('AUS') }), _t('Zeigt, welchen Gegner du gerade angreifst'))}${opt('ctl_drag', c.aimDrag, _t('WISCH-ZIELEN {v}', { v: c.aimDrag ? _t('AN') : _t('AUS') }), _t('Über den Angriffsknopf wischen zielt von Hand'))}${opt('ctl_hap', c.haptics, _t('VIBRATION {v}', { v: c.haptics ? _t('AN') : _t('AUS') }), _t('Kurzes Rütteln bei Treffern'))}</div>
  <div class="menu"><button class="btn" data-act="ctledit" data-id="settings">${_t('Knöpfe verschieben & skalieren')}</button><button class="btn alt" data-act="settings">${_t('Zurück')}</button></div>`);
}

/* ---------- Klicks ---------- */
panel.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]'); if (!b || b.disabled) return; audioOn();
  const a = b.dataset.act, id = b.dataset.id, i = b.dataset.i != null ? +b.dataset.i : -1;
  if (ON[a]) { ON[a](id, b, i); return; }
  if (a.startsWith('ctl_')) { const c = ctlSet(); if (a === 'ctl_stick_float') c.stick = 'float'; if (a === 'ctl_stick_fixed') c.stick = 'fixed'; if (a === 'ctl_ss-') c.stickSize = clamp(c.stickSize - .1, .6, 1.6); if (a === 'ctl_ss+') c.stickSize = clamp(c.stickSize + .1, .6, 1.6); if (a.startsWith('ctl_pot_')) c.pot = a.slice(8); if (a === 'ctl_aim') c.aim = !c.aim; if (a === 'ctl_drag') c.aimDrag = !c.aimDrag; if (a === 'ctl_hap') { c.haptics = !c.haptics; buzz(30); } persist(); applyLayout(); sfx('click'); showControls(); return; }
  switch (a) {
    case 'new': CS = { cls: 'knight', diff: 'normal', hc: false, name: '', look: null }; showCreate(); break;
    case 'ccls': { CS.name = ($('cname') || {}).value || ''; const was = CS.cls; CS.cls = id; if (CS.look && CS.look.body === CLASSES[was].body) CS.look.body = CLASSES[id].body; showCreate(); break; }
    case 'cdiff': CS.diff = id; CS.name = ($('cname') || {}).value || ''; showCreate(); break;
    case 'chc': CS.hc = !CS.hc; CS.name = ($('cname') || {}).value || ''; showCreate(); break;
    case 'lk': { if (lkMode === 'create') CS.name = ($('cname') || {}).value || ''; lookAction(id); if (lkMode === 'create') showCreate(); else if (lkMode === 'mirror') openMirror(); else openChar('look'); break; }
    case 'cstart': { const nm = (($('cname') || {}).value || '').trim() || CLASSES[CS.cls].name; const c = newChar(CS.cls, nm, CS.diff, CS.hc, Object.assign({}, CS.look)); c.mats = { erz: 4, leder: 3 }; SAVE.chars.push(c); activateChar(SAVE.chars.length - 1); saveChar(); sfx('lvl'); goFullscreen(); setState('menu'); dialog(PROLOG, openMap, 'Klingenhort'); break; }
    case 'dlgnext': if (DLG) DLG.next(); break;
    case 'dlgskip': if (DLG) DLG.skip(); break;
    case 'play': { confirmDel = -1; activateChar(i); goFullscreen(); const M = P.map; if (M && M.pos.r >= 0 && !M.rows[M.pos.r][M.pos.i].done) { if (UI_NODES.includes(M.rows[M.pos.r][M.pos.i].t)) { resumeNode(); break; } undoRoomEntry(); saveChar(); } openMap(); break; }
    case 'delchar': confirmDel = i; showTitle(); break;
    case 'delno': confirmDel = -1; showTitle(); break;
    case 'delok': SAVE.chars.splice(i, 1); if (SAVE.active === i) SAVE.active = -1; else if (SAVE.active > i) SAVE.active--; confirmDel = -1; persist(); P = null; titleScene(); showTitle(); break;
    case 'daily': if (SAVE.active < 0) { if (!SAVE.chars.length) break; activateChar(0); } goFullscreen(); startDaily(); break;
    case 'ach': showAch(); break;
    case 'news': showNews(id); break;
    case 'newsback': if (newsBack === 'settings') showSettings(); else if (newsBack === 'map') openMap(); else showTitle(); break;
    case 'best': showBestiary(); break;
    case 'hall': showHall(); break;
    case 'code': showCode(); break;
    case 'settings': showSettings(); break;
    case 'bigui': SAVE.meta.settings.bigui = !SAVE.meta.settings.bigui; persist(); applyUiPrefs(); showSettings(); break;
    case 'langs': showLang(id); break;
    case 'langback': if (langBack === 'settings') showSettings(); else showTitle(); break;
    case 'setlang': if (id === LANG) { b.blur(); break; } try { persist(); } catch (_) { } setLang(id); break;
    case 'calm': SAVE.meta.settings.calm = !SAVE.meta.settings.calm; persist(); showSettings(); break;
    case 'controls': showControls(); break;
    case 'ctledit': openCtlEditor(id); break;
    case 'backtitle': showTitle(); break;
    case 'install': if (window.__doInstall) window.__doInstall(); break;
    case 'copylink': { const url = location.href.split('#')[0], done = () => { b.textContent = _t('Kopiert'); }; try { navigator.clipboard.writeText(url).then(done, () => prompt(_t('Link kopieren:'), url)); } catch (_) { prompt(_t('Link kopieren:'), url); } break; }
    case 'inappok': SAVE.meta.settings.inAppOk = true; persist(); showTitle(); break;
    case 'checkupd': checkUpdateNow(); break;
    case 'copycode': { const t = $('codeOut'); const done = () => { b.textContent = _t('Kopiert'); }; try { navigator.clipboard.writeText(t.value).then(done, () => { t.select(); done(); }); } catch (_) { t.select(); done(); } break; }
    case 'loadcode': try { const r = importCode($('codeIn').value); applyUiPrefs(); P = null; if (SAVE.active >= 0 && SAVE.chars[SAVE.active]) activateChar(SAVE.active); titleScene(); showCode(r === 'v1' ? _t('Alter Spielstand als Ritter übernommen.') : _t('Spielstand geladen.')); } catch (_) { showCode(_t('Der Code ist ungültig. Bitte vollständig kopieren und erneut einfügen.')); } break;
    case 'music': SAVE.meta.settings.music = SAVE.meta.settings.music === false; persist(); if (state === 'pause') { setState('play'); showPause(); } else showSettings(); break;
    case 'sfx': SAVE.meta.settings.sfx = SAVE.meta.settings.sfx === false; persist(); if (state === 'pause') { setState('play'); showPause(); } else showSettings(); break;
    case 'mapmore': showMapMore(); break;
    case 'tomapview': openMap(); break;
    case 'msel': if (mapSel === i && isTouch) { P.map.prev = Object.assign({}, P.map.pos); enterNode(i); mapSel = -1; } else { mapSel = i; mapTapped = true; sfx('click'); openMap(); } break;
    case 'enter': if (mapSel >= 0) { P.map.prev = Object.assign({}, P.map.pos); enterNode(mapSel); mapSel = -1; } break;
    case 'char': selItem = null; openChar('gear', 'map'); break;
    case 'hide': saveChar(); enterHideout(); break;
    case 'title': if (G && G.daily) restoreFromDaily(); else if (G && G.type && G.type !== 'versteck') undoRoomEntry(); saveChar(); titleScene(); showTitle(); break;
    case 'ctab': charTab = id; openChar(); break;
    case 'isel': selItem = id; openChar(); break;
    case 'equip': { const f = findItem(id); if (f && f.bi != null) { equipFromBag(f.bi); sfx('swing'); saveChar(); } selItem = id; openChar(); break; }
    case 'sell': { const f = findItem(id); if (f && f.bi != null) { P.gold += itemPrice(f.it); P.bag.splice(f.bi, 1); sfx('coin'); saveChar(); } selItem = null; openChar(); break; }
    case 'tal': { const [bi, ni] = id.split(',').map(Number); if (learnTalent(bi, ni)) { sfx('click'); saveChar(); } else sfx('deny'); openChar(); break; }
    case 'respec': if (respec()) { sfx('craft'); saveChar(); } openChar(); break;
    case 'pp': { const free = P.paragon - (P.pp.dmg + P.pp.hp + P.pp.def + P.pp.crit); if (free > 0) { P.pp[id]++; computeStats(); saveChar(); sfx('click'); } openChar(); break; }
    case 'rebirth': showOverlay(`<div class="center"><h2>${_t('WIEDERGEBURT?')}</h2><p class="sub">${_t('Level, Talente und Akt beginnen von vorn. Du behältst Ausrüstung, Gold, Materialien und Paragon und erhältst dauerhaft +10 % Schaden und LP.')}</p><div class="menu"><button class="btn red" data-act="rebirthok">${_t('Ja, wiedergeboren werden')}</button><button class="btn alt" data-act="ctab" data-id="para">${_t('Abbrechen')}</button></div></div>`); break;
    case 'rebirthok': P.rebirths++; stat('rebirths'); P.lv = 1; P.xp = 0; P.sp = 0; P.talents = {}; P.act = 1; P.map = null; P.story = {}; computeStats(); P.hp = P.st.hp; saveChar(); checkAch(); banner(_t('WIEDERGEBOREN'), '★ ' + P.rebirths); openMap(); break;
    case 'cback': { const r = returnTo; returnTo = null; saveChar(); if (r === 'pause') { setState('play'); showPause(); } else if (r === 'wb') openWorkbench(); else openMap(); break; }
    case 'pchar': selItem = null; returnTo = 'pause'; openChar('gear', 'pause'); break;
    case 'wtab': wbTab = id; openWorkbench(); break;
    case 'wsel': selItem = id; openWorkbench(); break;
    case 'up': { const f = findItem(selItem); const r = upgradeItem(f.it); if (r === 'ok') { sfx('craft'); toast(_t('Erfolg: {item}', { item: itemName(f.it) }), '#79c24e'); } else if (r === 'fail') { sfx('fail'); toast(_t('Fehlgeschlagen – die Materialien sind verloren'), '#ff6a5a'); } saveChar(); checkAch(); openWorkbench(); break; }
    case 'craft': { const f = findItem(selItem); const r = craft(id, f && f.it); if (r.r === 'ok') { sfx('craft'); toast(r.msg || _t('Hergestellt'), '#79c24e'); } else if (r.r === 'fail') { sfx('fail'); toast(r.msg, '#ff6a5a'); } else if (r.r === 'max') toast(_t('Schon 3 Sockel')); else sfx('deny'); saveChar(); checkAch(); openWorkbench(); break; }
    case 'fslot': forgeSlot = id; openWorkbench(); break;
    case 'forge': { const it = forgeItem(i, forgeSlot); if (it) { sfx('craft'); toast(_t('{item} geschmiedet', { item: itemName(it) }), RAR[it.rar].c); selItem = it.uid; } else sfx('deny'); saveChar(); checkAch(); openWorkbench(); break; }
    case 'fsel': { const f = findItem(id); if (!f) break; const it = f.it; if (fuseA === id) { fuseA = null; fuseB = null; } else if (fuseB === id) fuseB = null; else if (!fuseA) fuseA = id; else { const A = findItem(fuseA); if (A && A.it.slot === it.slot && f.bi != null) fuseB = id; else { fuseA = id; fuseB = null; } } sfx('click'); openWorkbench(); break; }
    case 'freset': fuseA = fuseB = null; openWorkbench(); break;
    case 'fuse': { const A = findItem(fuseA), Bf = findItem(fuseB); const r = fuseItems(A && A.it, Bf && Bf.it); if (r.r === 'ok') { sfx('fuse'); shake(3); toast(r.up ? _t('SELTENHEIT GESTIEGEN! {item}', { item: itemName(r.it) }) : _t('Verschmolzen: {item}', { item: itemName(r.it) }), RAR[r.it.rar].c); if (r.it.rar === 6) { sfx('myth'); banner(_t('MYTHISCH!'), _t(r.it.name)); } fuseB = null; } else if (r.r === 'err') toast(r.msg); else sfx('deny'); saveChar(); checkAch(); openWorkbench(); break; }
    case 'trans': if (transmute(i)) { sfx('craft'); saveChar(); } else sfx('deny'); openWorkbench(); break;
    case 'sock': { const f = findItem(selItem); if (socketGem(f.it, id)) { sfx('craft'); saveChar(); } openWorkbench(); break; }
    case 'unsock': { const f = findItem(selItem); if (unsocketAll(f.it)) { sfx('coin'); saveChar(); } openWorkbench(); break; }
    case 'gcomb': { const [gid, gr] = id.split(','); if (combineGem(gid, +gr)) { sfx('craft'); saveChar(); checkAch(); } openWorkbench(); break; }
    case 'dye': if (unlockDye(id)) { sfx('craft'); saveChar(); } openWorkbench(); break;
    case 'wbdone': if (wbMode === 'smith' || wbMode === 'jewel') backToHide(); else if (state === 'menu' && P.map && P.map.pos.r >= 0 && P.map.rows[P.map.pos.r][P.map.pos.i].t === 'werkbank' && !P.map.rows[P.map.pos.r][P.map.pos.i].done) nodeLeave(); else openMap(); break;
    case 'mtab': mTab = id; openMerchant(); break;
    case 'buy': { const s = P.map.shop.stock[i]; if (s && !s.sold && P.gold >= s.price) { P.gold -= s.price; s.sold = true; const g = addToBag(s.it); if (!g && canEquip(s.it) && itemScore(s.it) > itemScore(P.gear[s.it.slot])) { equipFromBag(P.bag.length - 1); toast(_t('{item} angelegt', { item: itemName(s.it) })); } sfx('buy'); saveChar(); } openMerchant(); break; }
    case 'buyx': { const p = i; if (P.gold < p) break; P.gold -= p; if (id === 'potion') P.potions = Math.min(potMax(), P.potions + 1); else if (id === 'gem') gainGem(pick(GEMORDER) + ':0'); else if (id === 'erz' || id === 'leder') gainMat(id, 5); else gainMat(id, 1); sfx('buy'); saveChar(); openMerchant(); break; }
    case 'msell': { const f = findItem(id); if (f && f.bi != null) { P.gold += itemPrice(f.it); P.bag.splice(f.bi, 1); sfx('coin'); saveChar(); } openMerchant(); break; }
    case 'sellall': { let g = 0; P.bag = P.bag.filter(it => { if (it.rar <= 1 && !it.gems.length && !it.up && !it.fz) { g += itemPrice(it); return false; } return true; }); P.gold += g; if (g) sfx('coin'); toast(_t('+{n} Gold', { n: g })); saveChar(); openMerchant(); break; }
    case 'mdone': nodeLeave(); break;
    case 'shrine': { const S = SHRINES[i]; if (S.instant === 'blood') { P.hp = Math.max(1, P.hp - P.st.hp * .3); P.sp++; toast(_t('+1 Talentpunkt'), '#b892f4'); } else if (S.instant === 'coin') gainFate(1, true); else { P.buffs.push({ n: S.bn || S.n, buff: S.buff, rooms: S.rooms }); computeStats(); toast(_t('{n} aktiv', { n: S.n }), '#b892f4'); } sfx('ach'); nodeLeave(); break; }
    case 'sdone': nodeLeave(); break;
    case 'ev': doEvent(id); break;
    case 'rest2': { if (id === 'sleep') { P.hp = Math.min(P.st.hp, P.hp + P.st.hp * .3); toast(_t('+30 % LP'), '#79c24e'); sfx('heal'); } else if (id === 'sharpen') { if (P.gear.weapon.up < 5) P.gear.weapon.up++; computeStats(); toast(itemName(P.gear.weapon), '#79c24e'); sfx('craft'); } else { if (!gainLore()) { gainXP(60 + stageNum() * 25); toast(_t('Du lernst aus alten Geschichten'), '#57a7d6'); } } nodeLeave(); break; }
    case 'riddle': { const n = P.map.rows[P.map.pos.r][P.map.pos.i]; if (i === 0) { stat('riddles'); gainFate(1, true); gainGem(randomGem(stageNum() + 4)); P.gold += 80 + stageNum() * 12; sfx('ach'); banner(_t('RICHTIG!'), _t('Die Sphinx neigt ihr Haupt')); nodeLeave(); } else { sfx('fail'); n.t = 'raetsel'; toast(_t('Falsch! Die Sphinx brüllt!'), '#ff6a5a'); startRoom('sphinx', P.map.pos.r); } break; }
    case 'actnext': openMap(); break;
    case 'acthide': enterHideout(); break;
    case 'resume': setState('play'); hideOverlay(); showHud(true); break;
    case 'retry': P.gold -= Math.floor(P.gold * .2); P.hp = P.st.hp * .7; startRoom(G.type, G.row, G.extra); break;
    case 'tomap': P.gold -= Math.floor(P.gold * .2); P.hp = P.st.hp * .5; if (P.map && P.map.prev) P.map.pos = P.map.prev; saveChar(); openMap(); break;
    case 'hcok': P = null; titleScene(); showTitle(); break;
    case 'dailyfail': restoreFromDaily(); P.hp = P.st.hp; saveChar(); titleScene(); showTitle(); break;
    case 'dailyok': P.hp = P.st.hp; titleScene(); showTitle(); break;
    /* Versteck */
    case 'hback': backToHide(); break;
    case 'hleave': leaveHideout(); break;
    case 'build': { doBuild(id); const from = G && G.type === 'versteck' && G.near ? G.near.act : id; openStation(from === 'feuer' ? 'feuer' : id); break; }
    case 'rest': if (P.map && !P.map.rested) { P.map.rested = true; P.hp = P.st.hp; P.res = P.st.resMax; sfx('heal'); toast(_t('Vollständig erholt'), '#79c24e'); saveChar(); } openCampfire(); break;
    case 'tale': { const L = NPCTALK.feuer.filter(l => l[0] <= P.act); dialog([L[Math.floor(Math.random() * L.length)].slice(1)], () => openCampfire()); break; }
    case 'brew': { const r = craft('potion'); if (r.r === 'ok') { sfx('heal'); toast(r.msg, '#79c24e'); } saveChar(); openAlchemy(); break; }
    case 'elix': { const E = ELIXIRS[i]; if (canAfford(E.cost, E.gold)) { payMats(E.cost); P.gold -= E.gold; P.buffs.push({ n: E.bn || E.n, buff: E.buff, rooms: E.rooms }); computeStats(); sfx('heal'); toast(_t('{n} wirkt', { n: E.n }), '#b892f4'); saveChar(); } openAlchemy(); break; }
    case 'stin': { if (selItem !== id) { selItem = id; openStash(); break; } const k = P.bag.findIndex(x => x.uid === id); if (k >= 0 && SAVE.meta.hide.stash.length < stashCap()) { SAVE.meta.hide.stash.push(P.bag.splice(k, 1)[0]); sfx('coin'); selItem = null; saveChar(); persist(); } else toast(_t('Das Lager ist voll')); openStash(); break; }
    case 'stout': { if (selItem !== id) { selItem = id; openStash(); break; } const S = SAVE.meta.hide.stash, k = S.findIndex(x => x.uid === id); if (k >= 0 && P.bag.length < 30) { P.bag.push(S.splice(k, 1)[0]); sfx('coin'); selItem = null; saveChar(); persist(); } else toast(_t('Dein Beutel ist voll')); openStash(); break; }
    case 'collect': collectProd(id); openProd(id); break;
    case 'ltab': openStation('bibliothek', id); break;
    case 'spin': doSpin(); break;
    case 'coin': if (P.gold >= coinPrice()) { P.gold -= coinPrice(); gainFate(1); sfx('buy'); saveChar(); } openTemple(); break;
    case 'chest': openChestLuck(id); break;
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
    else if (e.code === 'KeyE' || e.code === 'Enter') interactNear();
    else if (e.code === 'KeyC') { showPause(); returnTo = 'pause'; openChar('gear', 'pause'); }
    else if (e.code === 'Escape' || e.code === 'KeyP') showPause();
  } else if (state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { setState('play'); hideOverlay(); showHud(true); }
  else if (state === 'menu' && e.code === 'Escape' && G && G.type === 'versteck') backToHide();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; touchAtk = false; if (state === 'play') showPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') showPause(); });
cv.addEventListener('mousedown', e => { if (isTouch) return; audioOn(); mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 0) mouse.down = true; else if (e.button === 2) doRoll(); else if (e.button === 1) doUlt(); });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('contextmenu', e => e.preventDefault());
$('pauseBtn').addEventListener('click', () => { audioOn(); showPause(); });

/* ---------- PWA: Installation, Vollbild ---------- */
let deferredInstall = null;
const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (state === 'title') showTitle(); });
// In-App-Browser von TikTok & Co.: drehen nicht immer, kein Installieren, Spielstand kann verloren gehen
const INAPP = (() => { const u = navigator.userAgent; return /musical_ly|trill_|bytedance|tiktok/i.test(u) ? 'TikTok' : /instagram/i.test(u) ? 'Instagram' : /fban|fbav|fb_iab/i.test(u) ? 'Facebook' : /snapchat/i.test(u) ? 'Snapchat' : ''; })();
function inAppHTML() {
  if (!INAPP || SAVE.meta.settings.inAppOk) return '';
  return `<div class="inapp"><b>${_t('DU SPIELST IM {app}-BROWSER', { app: INAPP.toUpperCase() })}</b>${_t('Das geht, aber dort lässt sich Klingenhort nicht installieren und dein Spielstand kann verloren gehen. Besser: oben rechts auf ••• tippen und „Im Browser öffnen“ wählen{safari}.', { safari: isIOS ? ' (Safari)' : '' })}<div class="acts"><button class="btn sm" data-act="copylink">${_t('Link kopieren')}</button><button class="btn alt sm" data-act="inappok">${_t('Verstanden')}</button></div></div>`;
}
function installBtn() { if (standalone) return ''; if (deferredInstall) return '<button class="btn" data-act="install">' + _t('Als App installieren') + '</button>'; if (isIOS) return '<p class="help" style="border:0;padding:0;grid-column:1/-1">' + _t('Als App: in Safari auf TEILEN und dann „Zum Home-Bildschirm“ tippen.') + '</p>'; return ''; }
window.__doInstall = async () => { if (!deferredInstall) return; deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (_) { } deferredInstall = null; showTitle(); };
// Vollbild ohne feste Ausrichtung: Hoch- und Querformat werden beide unterstützt
function goFullscreen() { if (!isTouch) return; const el = document.documentElement; if (!standalone && !document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => { }); }
/* PWA-START */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  UPD.on = true; UPD.had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!UPD.had && !UPD.manual) { UPD.had = true; return; } // erste Installation, kein Update
    UPD.ready = true;
    if (UPD.manual || state === 'title' || state === 'map' || state === 'load') applyUpdate();
    else toast(_t('Update geladen – wird auf der Weltkarte installiert'), '#e8b04a');
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
  if (!UPD.reg) { msg(_t('Updates kommen hier automatisch mit der Seite.')); return; }
  msg(_t('Suche nach Updates …')); UPD.manual = true; UPD.last = Date.now();
  UPD.reg.update().then(() => {
    const r = UPD.reg;
    if (r.waiting) { applyUpdate(); return; }
    if (r.installing) { msg(_t('Update wird installiert …')); return; }
    UPD.manual = false; msg(_t('Du hast die neueste Version ({v}).', { v: VERSION }));
  }).catch(() => { UPD.manual = false; msg(_t('Keine Verbindung. Versuch es später noch mal.')); });
}

/* ---------- Hauptschleife ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  SCALE = Math.max(2, Math.round(Math.min(w, h) / 215));
  // ein Pixel Rand: die Kamera bewegt sich weich unterhalb eines Spielpixels (siehe loop)
  VW = Math.ceil(w / SCALE) + 1; VH = Math.ceil(h / SCALE) + 1;
  cv.width = VW; cv.height = VH; cv.style.width = VW * SCALE + 'px'; cv.style.height = VH * SCALE + 'px';
  ctx.imageSmoothingEnabled = false; makeVig();
}
addEventListener('resize', resize);
// Gedreht: Weltkarte neu ausrichten, Tafel-Maße anpassen
addEventListener('resize', () => setTimeout(() => { if (state === 'map' && !ov.hidden && portrait() !== MAPV) openMap(); else fitPanel(); }, 60));
let last = performance.now(), achT = 0, lastTf = '';
function update(dt) {
  dt0 = dt;
  updPlayer(dt);
  for (const e of enemies) if (!e.dead) updEnemy(e, dt);
  separate();
  enemies = enemies.filter(e => !e.dead);
  updProjs(dt); updSpikes(); updObs(dt); updAllies(dt); updPickups(dt); updParts(dt); ambient(dt);
  hook('update', dt);
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
  // der rAF-Zeitstempel kann minimal vor performance.now() liegen: nie rückwärts laufen
  let dt = clamp((now - last) / 1000, 0, .05); last = Math.max(last, now); T += dt;
  if (slowmo > 0) { slowmo -= dt; dt *= .35; }
  flash.a = Math.max(0, flash.a - dt * 1.6);
  if (state === 'play' || state === 'dead') { if (hitStop > 0) hitStop -= dt; else update(dt); }
  else if (state === 'title' || state === 'map' || state === 'menu') { P.moving = false; if (!G || !G.type) { P.turn = approach(P.turn, Math.sin(T * .4) > 0 ? 1 : -1, dt * 3); P.face = P.turn > 0 ? 1 : -1; } updParts(dt); if (!G) G = { ambT: 0 }; ambient(dt); }
  if (P && bg) { camera(dt); if (state === 'play') updHud(); }
  render();
  const tf = `translate3d(${(-SUBX * SCALE).toFixed(1)}px,${(-SUBY * SCALE).toFixed(1)}px,0)`; if (tf !== lastTf) { lastTf = tf; cv.style.transform = tf; }
}
loadAssets().then(() => {
  try {
    loadAll(); applyUiPrefs(); resize(); applyLayout();
    if (SAVE.active >= 0 && SAVE.chars[SAVE.active]) activateChar(SAVE.active);
    titleScene(); showTitle(); checkAch(); hook('boot');
  } catch (e) {
    console.error(e);
    panel.innerHTML = '<p class="sub">' + _t('Beim Starten ist ein Fehler aufgetreten ({err}). Bitte Seite neu laden.', { err: esc(e.message) }) + '</p>';
    return;
  }
  if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').catch(() => { });
  requestAnimationFrame(loop);
}, () => { panel.innerHTML = '<p class="sub">' + _t('Die Grafik konnte nicht geladen werden. Bitte Seite neu laden.') + '</p>'; });
