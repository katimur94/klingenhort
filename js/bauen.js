'use strict';
/* =========================================================
   KLINGENHORT – Sammeln & Bauen (6.2)
   Bauzeit: Jeder Ausbau ist eine Baustelle mit echter Dauer (BTIME, js/data.js: Sekunden am Anfang, Stunden spät), gerechnet aus
     Zeitstempeln – läuft auch bei geschlossenem Spiel. Ein Baumeister pro Konto, ab Versteck-Stufe 50 ein zweiter. Bezahlt wird beim Start,
     die Stufe zählt erst, wenn sie fertig ist (hideLv). Sofort fertig: Gold oder Glücksmünzen, je nach Restzeit (mit Rückfrage).
   Holzplatz im Versteck: Bäume, Felsen, Büsche am Rand – mit Angriffen abbauen, wachsen in Echtzeit nach (für alle Helden).
   Acker im Kräutergarten: Samen säen, in Echtzeit wachsen lassen, ernten (CROPS, js/data.js).
   Endlose Lande: Bäume (Holz, tiefer Eisen- und Sternholz), Felsen (Stein, Marmor, Obsidian), Büsche/Pilze/Kakteen (Fasern, Samen),
     Vogelnester (Federn). Ein paar Treffer, Splitter fliegen, der Baum kippt, die Rohstoffe springen heraus und fliegen zum Helden.
     Die Welt ist für alle gleich, abgebaut ist nur in diesem Ausflug (LW.ts) – der nächste Ausflug findet alles nachgewachsen.
     Gesammeltes kommt über landePouchAdd(k, n) in den Beutel der Lande (Taschen & Vögel), ohne ihn direkt in den Vorrat.
   Spielstand: SAVE.meta.hide.q = [{ k, lv, t0, end }] Baustellen · .gat = { id: nachgewachsen um (ms) } Holzplatz · .farm = [{ c, t0, end } | null] Beete
   Schnittstelle: buildBusy() → laufende Baustelle { k, lv, t0, end, left } oder null · buildDone(k) → Baustelle von k sofort fertigstellen (ohne Preis, für Tests)
     buildOf(k) · buildFree() · buildStart(k) · buildSkipPrice(q) · buildSkip(k, 'gold'|'coins'|'free') · gatherInfo() (Tests) · farmReady() · farmPlant(c) · farmHarvest(i)
   Ruft (wenn vorhanden): landePouchAdd(k, n), bagCap(), packCap() (Taschen & Vögel)
   ========================================================= */

document.head.insertAdjacentHTML('beforeend', `<style>
.bprog{display:flex;align-items:center;gap:10px;margin:6px 0}
.bbar{flex:1;height:14px;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi);position:relative;min-width:60px}
.bbar i{position:absolute;left:2px;top:2px;bottom:2px;max-width:calc(100% - 4px);background:linear-gradient(90deg,#a8743e,#e8b04a)}
.bbar.grow i{background:linear-gradient(90deg,#3a7a2a,#79c24e)}
.bprog b{font-family:var(--f-display);font-weight:400;font-size:9px;color:var(--gold);min-width:62px;text-align:right;white-space:nowrap}
.bskip{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px}
.bskip .btn{flex:1 1 150px}
.bbusy{color:var(--gold)}
.bwhen{margin:2px 0 8px}
.bsite{background:var(--night);padding:8px 10px;margin:6px 0;box-shadow:inset 0 0 0 2px var(--gold-dk)}
.bsite .nm{font-size:20px}
.frow .bprog{margin:4px 0 0}
</style>`);

/* ---------- Bauzeit ---------- */
let bView = null;   // Station, deren Tafel gerade offen ist (zum Auffrischen und für „Zurück“ nach der Rückfrage)
const bNow = () => Date.now();
function buildDur(lv) { return BTIME[clamp(lv | 0, 0, BTIME.length - 1)] || 0; }   // Sekunden bis Stufe lv fertig ist
function builders() { return hideTotal() >= 50 ? 2 : 1; }
function buildQ() { const H = SAVE.meta.hide; if (!Array.isArray(H.q)) H.q = []; return H.q; }
function buildOf(k) { return SAVE && SAVE.meta.hide ? buildQ().find(q => q.k === k) || null : null; }
function buildLeft(q) { return Math.max(0, (q.end - bNow()) / 1000); }
function buildFree() { return buildQ().length < builders(); }
function buildBusy() { const q = buildQ()[0]; return q ? Object.assign({ left: buildLeft(q) }, q) : null; }
// Ausbau beginnen (Kosten der nächsten Stufe, ein freier Baumeister, nicht schon im Bau)
function buildStart(k) {
  const B = BUILD[k], c = B && !B.fixed ? buildCost(k) : null;
  if (!c || buildOf(k) || !buildFree() || !canAfford(c.mats, c.gold)) return false;
  payMats(c.mats); P.gold -= c.gold;
  const lv = hideLv(k) + 1, now = bNow(), d = buildDur(lv);
  buildQ().push({ k, lv, t0: now, end: now + d * 1000 });
  stat('builds'); saveChar(); persist();
  if (d <= 0) buildTick();
  return true;
}
// Baustelle fertig: ab jetzt zählt die Stufe
function buildFinish(q) {
  const H = SAVE.meta.hide, i = buildQ().indexOf(q); if (i >= 0) H.q.splice(i, 1);
  const was = H.b[q.k] || 0; if (q.lv <= was) { persist(); return false; }
  H.b[q.k] = q.lv;
  if (!was && q.k === 'mine') H.mine = H.rooms; if (!was && q.k === 'garten') H.garden = H.rooms;
  statMax('hideLv', hideTotal());
  if (P) { computeStats(); saveChar(); checkAch(); }
  persist();
  if (G && G.type === 'versteck' && P) {
    const px_ = P.x, py_ = P.y; layoutHideout(); P.x = px_; P.y = py_; const p = hidePos(q.k);
    for (let i = 0; i < 30; i++) part(p.x + rnd(-14, 14), p.y, rnd(0, 20), rnd(-40, 40), rnd(-20, 20), rnd(30, 90), pick(['#e8b04a', '#ffd24a', '#a8743e']), rnd(.5, 1), 1, 120, 1);
    shake(3);
  }
  return true;
}
const bName = q => _t('{name} Stufe {lv}', { name: BUILD[q.k].n, lv: q.lv });
// Schnittstelle (Tests, Taschen & Vögel): Baustelle von k sofort fertig – ohne Preis
function buildDone(k) { const q = buildOf(k); if (!q || !buildFinish(q)) return false; toast(_t('Fertig gebaut: {list}!', { list: bName(q) }), '#ffd24a'); bRefresh(); return true; }
// Fertige Baustellen abschließen (jede Sekunde und beim Start – auch was fertig wurde, während das Spiel zu war)
function buildTick(boot) {
  if (!SAVE || !SAVE.meta || !SAVE.meta.hide) return 0;
  const now = bNow(), done = buildQ().filter(q => q.end <= now); if (!done.length) return 0;
  const fin = done.filter(q => buildFinish(q)); if (!fin.length) return 0;
  const list = fin.map(bName).join(', ');
  toast(boot ? _t('Während du weg warst, fertig gebaut: {list}', { list }) : _t('Fertig gebaut: {list}!', { list }), '#ffd24a');
  sfx('build'); bRefresh();
  return fin.length;
}
// Sofort fertig: 5 s vor Schluss gratis, sonst Gold (je angefangene Minute 10 + 4 × Stufe) oder Glücksmünzen (1 je angefangene Stunde)
function buildSkipPrice(q) { const s = buildLeft(q); if (s <= 5) return { free: true, gold: 0, coins: 0 }; return { free: false, gold: Math.ceil(s / 60) * (10 + 4 * q.lv), coins: Math.ceil(s / 3600) }; }
function buildSkip(k, pay) {
  const q = buildOf(k); if (!q || !P) return false; const pr = buildSkipPrice(q);
  if (!pr.free) {
    if (pay === 'coins') { if ((P.fate || 0) < pr.coins) return false; P.fate -= pr.coins; }
    else if (pay === 'gold') { if (P.gold < pr.gold) return false; P.gold -= pr.gold; }
    else return false;
  }
  stat('buildSkips'); buildFinish(q); sfx('build');
  toast(_t('Fertig gebaut: {list}!', { list: bName(q) }), '#ffd24a');
  return true;
}
// Dauer lesbar: „45 s“, „5 Min.“, „1 Std. 30 Min.“ · Countdown: „12 s“, „3:05“, „1:02:03“
function buildTimeText(s) {
  s = Math.ceil(s); if (s < 60) return _t('{n} s', { n: s });
  if (s < 3600) { const m = Math.floor(s / 60), r = s % 60; return r ? _t('{m} Min. {s} s', { m, s: r }) : _t('{m} Min.', { m }); }
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return m ? _t('{h} Std. {m} Min.', { h, m }) : _t('{h} Std.', { h });
}
function buildClock(s) { s = Math.ceil(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60, p = v => String(v).padStart(2, '0'); return s < 60 ? _t('{n} s', { n: s }) : h ? h + ':' + p(m) + ':' + p(r) : m + ':' + p(r); }
function buildBusyText() { const Q = buildQ(); return Q.length > 1 ? _t('Beide Baumeister bauen gerade.') : Q.length ? _t('Der Baumeister baut gerade: {name} (noch {t})', { name: BUILD[Q[0].k].n, t: buildClock(buildLeft(Q[0])) }) : ''; }
// Fortschritt und Sofort-fertig-Knöpfe einer Baustelle (werden jede Sekunde aufgefrischt: data-bw/bt/bg/bc)
function buildProgHTML(q) {
  const k = q.k, left = buildLeft(q), tot = Math.max(1, (q.end - q.t0) / 1000), w = clamp(100 * (1 - left / tot), 0, 100), pr = buildSkipPrice(q);
  return `<div class="bprog" data-bk="${k}"><div class="bbar"><i data-bw="${k}" style="width:${w.toFixed(1)}%"></i></div><b data-bt="${k}">${buildClock(left)}</b></div>
  <div class="bskip">${pr.free ? `<button class="btn sm" data-act="bskip" data-id="${k}" data-pay="free">${_t('Fertigstellen')}</button>`
    : `<button class="btn sm" data-act="bskip" data-id="${k}" data-pay="gold" ${P.gold >= pr.gold ? '' : 'disabled'}>${_t('Sofort fertig')} · <i class="coin"></i><span data-bg="${k}">${pr.gold.toLocaleString(LOCALE)}</span></button><button class="btn sm alt" data-act="bskip" data-id="${k}" data-pay="coins" ${(P.fate || 0) >= pr.coins ? '' : 'disabled'}>${_t('Sofort fertig')} · <i class="fc"></i><span data-bc="${k}">${pr.coins}</span></button>`}</div>`;
}
// Lagerfeuer: alle Baustellen oben in der Ausbau-Übersicht
function buildSiteHTML() {
  const Q = buildQ(), n = builders();
  if (!Q.length) return `<p class="sub">${n > 1 ? _t('Beide Baumeister haben gerade nichts zu tun.') : _t('Der Baumeister hat gerade nichts zu tun. Ab Versteck-Stufe 50 hilft ein zweiter mit.')}</p>`;
  return Q.map(q => `<div class="bsite"><div class="nm">${_t('Im Bau: {name}', { name: esc(bName(q)) })}</div>${buildProgHTML(q)}</div>`).join('') + (Q.length < n ? `<p class="sub">${_t('Ein Baumeister ist noch frei.')}</p>` : '');
}
// Baustelle im Versteck: Gerüst vor der Station, Balken mit Fortschritt, Restzeit darüber
function buildMark(o, x, y, first) {
  const q = buildOf(o.id); if (!q) return;
  const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); }, left = buildLeft(q), tot = Math.max(1, (q.end - q.t0) / 1000), p = clamp(1 - left / tot, 0, 1);
  if (!first) { r(-15, -24, 2, 25, WOOD[1]); r(13, -24, 2, 25, WOOD[1]); r(-16, -18, 32, 2, WOOD[2]); r(-16, -8, 32, 2, WOOD[2]); r(-14, -17, 1, 9, WOOD[0]); r(12, -17, 1, 9, WOOD[0]); }
  const by = first ? -26 : -44;
  r(-13, by, 26, 5, '#1a1420'); r(-12, by + 1, Math.round(24 * p), 3, '#e8b04a');
  ptext(buildClock(left), x, y + by - 6, '#ffe08a', 6);
  // Hammerschläge
  if (Math.floor(T * 2.5 + o.x) % 3 === 0 && Math.random() < .25) { part(o.x + rnd(-10, 10), o.y, rnd(6, 18), rnd(-30, 30), rnd(-10, 10), rnd(30, 60), pick(['#ffd24a', '#d8b878']), .3, 1, 200, 1); }
}
// offene Tafel neu zeichnen, wenn sich am Bau etwas geändert hat (nur Tafeln mit Bau-Abschnitt)
function bRefresh() {
  if (!P || ov.hidden || state !== 'menu' || !bView || !G || G.type !== 'versteck') return;
  if (!panel.querySelector('[data-bk],[data-bsite],.bwhen,[data-fgrow]')) return;
  if (bView === 'feuer') openCampfire(); else openStation(bView);
}
// jede Sekunde: Restzeiten und Preise in der offenen Tafel
function bUiTick() {
  if (ov.hidden || !P) return;
  for (const q of buildQ()) {
    const left = buildLeft(q), tot = Math.max(1, (q.end - q.t0) / 1000), pr = buildSkipPrice(q);
    for (const el of panel.querySelectorAll(`[data-bt="${q.k}"]`)) el.textContent = buildClock(left);
    for (const el of panel.querySelectorAll(`[data-bw="${q.k}"]`)) el.style.width = clamp(100 * (1 - left / tot), 0, 100).toFixed(1) + '%';
    for (const el of panel.querySelectorAll(`[data-bg="${q.k}"]`)) { el.textContent = pr.gold.toLocaleString(LOCALE); el.parentNode.disabled = P.gold < pr.gold; }
    for (const el of panel.querySelectorAll(`[data-bc="${q.k}"]`)) { el.textContent = pr.coins; el.parentNode.disabled = (P.fate || 0) < pr.coins; }
    if (pr.free && panel.querySelector(`[data-pay="gold"][data-id="${q.k}"]`)) { bRefresh(); return; }
  }
  const F = farmList(), now = bNow();
  for (const el of panel.querySelectorAll('[data-fgrow]')) {
    const i = +el.dataset.fgrow, b = F[i]; if (!b) continue; const left = Math.max(0, (b.end - now) / 1000);
    if (left <= 0) { bRefresh(); return; }
    const t = el.querySelector('b'), w = el.querySelector('i'); if (t) t.textContent = buildClock(left); if (w) w.style.width = clamp(100 * (1 - left / Math.max(1, (b.end - b.t0) / 1000)), 0, 100).toFixed(1) + '%';
  }
}
setInterval(() => { try { if (SAVE) { buildTick(); bUiTick(); } } catch (e) { console.error('Bauen:', e); } }, 1000);
HOOK.boot.push(() => buildTick(true));
// Rückfrage vor dem Bezahlen
function bBack() { if (bView === 'feuer') openCampfire(); else if (bView) openStation(bView); else backToHide(); }
ON.bskip = (id, btn) => {
  const q = buildOf(id); if (!q) { bBack(); return; }
  const pay = btn.dataset.pay, pr = buildSkipPrice(q), price = pay === 'free' || pr.free ? _t('kostenlos') : pay === 'coins' ? (pr.coins === 1 ? _t('1 Glücksmünze') : _t('{n} Glücksmünzen', { n: pr.coins })) : _t('{n} Gold', { n: pr.gold.toLocaleString(LOCALE) });
  showOverlay(`<div class="center"><h2>${_t('SOFORT FERTIG?')}</h2><p class="sub">${_t('{name} wird sofort fertig. Restzeit: {t}.', { name: esc(bName(q)), t: buildTimeText(buildLeft(q)) })}</p><p class="sub">${_t('Preis: {p}', { p: `<b style="color:var(--gold)">${price}</b>` })}</p>
  <div class="menu"><button class="btn" data-act="bskipok" data-id="${id}" data-pay="${pr.free ? 'free' : pay}">${pr.free ? _t('Fertigstellen') : _t('Ja, bezahlen')}</button><button class="btn alt" data-act="bskipno">${_t('Abbrechen')}</button></div></div>`);
};
ON.bskipok = (id, btn) => { if (!buildSkip(id, btn.dataset.pay)) { sfx('deny'); if (buildOf(id)) toast(btn.dataset.pay === 'coins' ? _t('Nicht genug Glücksmünzen') : _t('Zu wenig Gold'), '#ff6a5a'); } else saveChar(); bBack(); };
ON.bskipno = () => bBack();
// Alte oder kaputte Spielstände: Baustellen, Holzplatz und Beete aufräumen, Stufen begrenzen
HOOK.meta.push(m => {
  const H = m.hide; if (!H || typeof H !== 'object') return;
  if (!H.b || typeof H.b !== 'object') H.b = {};
  for (const k in H.b) { const B = BUILD[k]; if (!B || B.fixed || !B.lv) continue; H.b[k] = clamp(Math.floor(+H.b[k]) || 0, 0, B.lv.length); }
  const seen = new Set();
  H.q = (Array.isArray(H.q) ? H.q : []).filter(q => { if (!q || typeof q !== 'object' || !BUILD[q.k] || BUILD[q.k].fixed || !BUILD[q.k].lv || seen.has(q.k) || !Number.isFinite(+q.end) || !Number.isFinite(+q.t0)) return false; const lv = (H.b[q.k] || 0) + 1; if (lv > BUILD[q.k].lv.length) return false; seen.add(q.k); q.lv = lv; q.end = +q.end; q.t0 = Math.min(+q.t0, q.end); return true; });
  if (!H.gat || typeof H.gat !== 'object' || Array.isArray(H.gat)) H.gat = {}; for (const k in H.gat) if (!Number.isFinite(+H.gat[k])) delete H.gat[k];
  H.farm = (Array.isArray(H.farm) ? H.farm : []).slice(0, 6).map(b => b && typeof b === 'object' && CROPS[b.c] && Number.isFinite(+b.end) && Number.isFinite(+b.t0) ? { c: b.c, t0: +b.t0, end: +b.end } : null);
});

/* ---------- Sattlerei (die Wirkung der Taschen kommt aus Taschen & Vögel: bagCap, packCap, petBagSize) ---------- */
function openSattler() {
  const lv = hideLv('sattler'), bag = typeof bagCap === 'function' ? bagCap() : 30 + 6 * lv, pack = typeof packCap === 'function' ? packCap() : 20 + 2 * lv, pet = Math.floor(lv / 2);
  const row = (ic, n, v, d) => `<div class="row" style="cursor:default"><div class="ic"><img src="${iconURL(['pa', ic])}" alt=""></div><div><div class="nm">${n} <b style="color:var(--gold);font-size:18px">${v}</b></div><div class="st">${d}</div></div><span></span></div>`;
  stationShell('sattler', `<p class="sub">${_t('Fenrik näht größere Taschen – sie gelten für alle deine Helden.')}</p>
  ${row('held', _t('Beutel des Helden'), _t('{n} Plätze', { n: bag }), _t('Ausrüstung, die du mit dir trägst. Materialien, Edelsteine und Gold brauchen keinen Platz.'))}
  ${row('sattel', _t('Rucksack in den Landen'), _t('{n} Plätze', { n: pack }), _t('Was du in den Endlosen Landen findest – bis du heimkehrst.'))}
  ${row('nest', _t('Begleiter-Tasche'), '+' + pet, _t('Zusätzliche Plätze in der Tasche deines Begleiters.'))}`);
}
// Figuren an Sattlerei und Vogelhaus
SPEAKERS.fenrik = { n: _t('Sattler Fenrik'), sp: 'elf', c: '#c8945a' };
SPEAKERS.corvin = { n: _t('Vogelwart Corvin'), sp: 'doc', c: '#9ab0c8' };
NPCTALK.sattler = [
  [1, 'fenrik', _t('Ein guter Beutel ist wie ein guter Freund: Er trägt, ohne zu klagen.')],
  [1, 'fenrik', _t('Bring mir Leder und Pflanzenfaser, dann nähe ich dir Taschen, in die ein halber Drachenhort passt.')],
  [3, 'fenrik', _t('Gold und Edelsteine zählst du nur – aber Klingen und Rüstungen, die brauchen Platz.')],
  [5, 'fenrik', _t('Die Rucksäcke für die Lande nähe ich doppelt. Was dort reißt, ist für immer verloren.')]
];
NPCTALK.voliere = [
  [1, 'corvin', _t('Ein Vogel kennt immer den Weg nach Hause. Das ist mehr, als man von den meisten Helden sagen kann.')],
  [1, 'corvin', _t('Federn, Holz und ein wenig Faser – mehr braucht ein Nest nicht. Und Geduld.')],
  [4, 'corvin', _t('Raben sind klug. Zu klug. Zähl nach, was sie heimbringen.')],
  [7, 'corvin', _t('Eine Phönixfeder verbrennt nie. Man sagt, sie fliegt sogar durch die Leere.')]
];

/* ---------- Gesammeltes: Zahlen, Splitter, Rohstoffe fliegen zum Helden ---------- */
// in den Landen in den Beutel (Taschen & Vögel), sonst direkt in den Vorrat
function gatherGive(k, n) {
  if (!MATS[k] || !(n > 0)) return;
  const L = typeof LW !== 'undefined' && LW && LW.on ? LW : null;
  if (L) { (L.gat || (L.gat = {}))[k] = (L.gat[k] || 0) + n; if (typeof landePouchAdd === 'function') landePouchAdd(k, n); else gainMat(k, n); }
  else gainMat(k, n);
}
const GFX = [];
function gatherGiveAll(o, got) {
  let i = 0;
  for (const k in got) { const n = got[k]; if (!(n > 0)) continue; gatherGive(k, n); setTimeout(() => { if (G) txt(o.x, o.y - 22, '+' + n + ' ' + MATS[k].n, MATS[k].c); }, i * 180); for (let j = 0; j < Math.min(n, 4); j++) GFX.push({ k, x: o.x + rnd(-4, 4), y: o.y, z: 10, vx: rnd(-45, 45), vy: rnd(-18, 18), vz: rnd(80, 120), t: -(i * .08 + j * .06) }); i++; }
  if (i) setTimeout(() => sfx('coin'), 260);
  stat('gather');
}
function gfxUpd(dt) {
  for (const f of GFX) {
    f.t += dt; if (f.t < 0) continue;
    if (f.t < .45) { f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.vz -= 360 * dt; if (f.z < 3) { f.z = 3; f.vz = Math.abs(f.vz) * .35; } continue; }
    const tx = P.x, ty = P.y - 2, dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy), sp = (220 + (f.t - .45) * 700) * dt;
    if (d <= sp + 4) { f.done = true; part(P.x, P.y, 12, rnd(-20, 20), rnd(-8, 8), rnd(20, 40), MATS[f.k].c, .35, 1, 60, 1); continue; }
    f.x += dx / d * sp; f.y += dy / d * sp; f.z = lerp(f.z, 12, Math.min(1, dt * 6));
  }
  for (let i = GFX.length - 1; i >= 0; i--) if (GFX[i].done || GFX[i].t > 4) GFX.splice(i, 1);
}
HOOK.postRender.push(() => { if (!GFX.length || !G) return; for (const f of GFX) { if (f.t < 0) continue; const c = matCanvas(f.k); ctx.drawImage(c, Math.round(f.x - CX - 6), Math.round(f.y - CY - f.z - 6)); } });
HOOK.room.push(() => { GFX.length = 0; });
// Splitter beim Treffer: Holzspäne, Steinsplitter, Blätter
function gChips(o, cols, nx, ny, leaves) {
  for (let i = 0; i < 7; i++) part(o.x + rnd(-3, 3), o.y, rnd(4, 12), (nx || 0) * rnd(20, 60) + rnd(-35, 35), (ny || 0) * rnd(10, 30) + rnd(-15, 15), rnd(40, 90), pick(cols), rnd(.3, .6), Math.random() < .4 ? 2 : 1, 280);
  if (leaves) for (let i = 0; i < 4; i++) part(o.x + rnd(-9, 9), o.y, rnd(16, 26), rnd(-12, 12), rnd(-4, 4), rnd(-4, 8), pick(leaves), rnd(.7, 1.1), 1, 30);
}
// Stumpf, Geröll, Stoppeln an der Stelle des Abgebauten
function gStump(kind, x, y, o) {
  const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 6, 2.2, 0, 0, 6.283); ctx.fill();
  if (kind === 'baum' || kind === 'sternbaum' || kind === 'knochen') { const big = o && o.t === 'riese' ? 2 : 1, c = kind === 'sternbaum' ? ['#2a2a5a', '#4a4ad0', '#9ab0ff'] : kind === 'knochen' ? ['#a8a08a', '#e8e2cf', '#fffaf0'] : [WOOD[0], WOOD[1], '#d8a868']; r(-3 * big, -3, 6 * big, 4, c[0]); r(-3 * big, -4, 6 * big, 2, c[1]); r(-1, -4, 2, 1, c[2]); r(-4 * big, 0, 2, 1, c[0]); r(2 * big, 0, 2, 1, c[0]); }
  else if (kind === 'stein' || kind === 'fels' || kind === 'obsidian' || kind === 'marmor' || kind === 'kristall' || kind === 'koralle' || kind === 'schrott') { const S = typeof LSTONE !== 'undefined' ? LSTONE[(o && (o.t === 'stein' || o.t === 'fels') ? o.v : 0) || 0] || LSTONE[0] : ['#4a4450', '#625c68', '#7e7884', '#a8a2ae']; r(-5, -1, 3, 2, S[1]); r(-1, -2, 3, 3, S[2]); r(3, -1, 2, 2, S[1]); r(0, -2, 1, 1, S[3]); }
  else { r(-3, -2, 1, 2, '#3a7a2a'); r(0, -3, 1, 3, '#5aaa42'); r(2, -2, 1, 2, '#3a7a2a'); }
}

/* ---------- Holzplatz im Versteck: links Bäume, rechts Felsen, Büsche – mit Angriffen abbauen, wachsen in Echtzeit nach ---------- */
const GHIDE = [
  { id: 'b1', t: 'baum', p: [.01, .33] }, { id: 'b2', t: 'baum', p: [.09, .4] }, { id: 'b3', t: 'baum', p: [.01, .47] }, { id: 'u1', t: 'busch', p: [.12, .49] },
  { id: 's1', t: 'fels', p: [.99, .33] }, { id: 's2', t: 'stein', p: [.91, .4] }, { id: 's3', t: 'fels', p: [.99, .47] }, { id: 'u2', t: 'busch', p: [.88, .49] }
];
// prop = Bild aus den Landen, hits = Treffer, grow = nachwachsen (s), out = sicher [von, bis], extra = [Material, Chance, von, bis]
const GHK = {
  baum: { prop: 'eiche', v: 0, r: 5, hits: 4, grow: 300, out: { holz: [3, 5] }, extra: [['feder', .3, 1, 2], ['samen', .2, 1, 1]], snd: 'wood', kind: 'baum' },
  fels: { prop: 'fels', v: 0, r: 8, hits: 5, grow: 360, out: { stein: [3, 5] }, extra: [['erz', .3, 1, 2]], snd: 'mine', kind: 'fels' },
  stein: { prop: 'stein', v: 0, r: 5, hits: 3, grow: 300, out: { stein: [2, 3] }, extra: [], snd: 'mine', kind: 'stein' },
  busch: { prop: 'busch', v: 0, r: 4, hits: 2, grow: 180, out: { faser: [2, 3] }, extra: [['samen', .7, 1, 2]], snd: 'dig', kind: 'busch' }
};
const GCHIP = { wood: ['#8a5a32', '#c8945a', '#5e3a1e', '#e8c890'], rock: ['#9a948a', '#6a6470', '#c8c2b6', '#ffffff'], leaf: ['#4a9a3a', '#7ac25a', '#2e6a2a'] };
function gatherHideLayout() {
  const H = SAVE.meta.hide, now = bNow(); if (!H.gat || typeof H.gat !== 'object') H.gat = {};
  for (const g of GHIDE) { const K = GHK[g.t], p = { x: Math.round(BD.x0 + 14 + g.p[0] * (BD.x1 - BD.x0 - 28)), y: Math.round(BD.y0 + g.p[1] * (BD.y1 - BD.y0)) }, gone = (H.gat[g.id] || 0) > now; obs.push({ k: 'gat', id: g.id, t: g.t, x: p.x, y: p.y, r: K.r, solid: !gone, gone, gh: 0, wob: 0, fall: 0, fd: 1, flash: 0 }); }
}
// Treffer am Holzplatz (js/combat.js hitObs)
function gatherHit(o, nx, ny) {
  const K = GHK[o.t]; if (!K || o.gone) return;
  o.gh++; o.wob = .28; o.fd = (nx || 0) >= 0 ? 1 : -1;
  gChips(o, K.snd === 'wood' ? GCHIP.wood : K.snd === 'mine' ? GCHIP.rock : GCHIP.leaf, nx, ny, o.t === 'baum' ? GCHIP.leaf : null); sfx(K.snd); if (K.snd === 'mine') spark(o.x, o.y - 6, Math.atan2(ny || 0, nx || 1), '#fff');
  if (o.gh < K.hits) return;
  o.gone = true; o.solid = false; o.gh = 0; o.fall = o.t === 'baum' ? .6 : 0;
  SAVE.meta.hide.gat[o.id] = bNow() + K.grow * 1000;
  const got = {}; for (const k in K.out) got[k] = ri(K.out[k][0], K.out[k][1]); for (const [k, ch, a, b] of K.extra) if (Math.random() < ch) got[k] = (got[k] || 0) + ri(a, b);
  if (o.t !== 'baum') burst(o.x, o.y, 6, o.t === 'busch' ? '#79c24e' : '#8a8a7a', 12, 60);
  gatherGiveAll(o, got); saveChar(); persist();
}
function gatherDrawObs(o) {
  const K = GHK[o.t], x = Math.round(o.x - CX), y = Math.round(o.y - CY);
  if (o.gone && !(o.fall > 0)) {
    gStump(K.kind, x, y, null);
    const left = ((SAVE.meta.hide.gat[o.id] || 0) - bNow()) / 1000;
    if (left > 0 && Math.hypot(P.x - o.x, P.y - o.y) < 44) ptext(buildClock(left), x, y - 10, '#c8b890', 6);
    return;
  }
  gPropDraw(o, K.prop, K.v, x, y, K.hits);
}
// Bild eines Baums/Felsens: wackelt beim Treffer, kippt beim Fällen, Treffer-Balken solange angeschlagen
function gPropDraw(o, t, v, x, y, need) {
  const s = lPropImg(t, v);
  if (o.fall > 0) {
    const a = (1 - o.fall / .6) * 1.5 * o.fd; gStump('baum', x, y, o);
    ctx.save(); ctx.translate(x, y - 2); ctx.rotate(a * a * Math.sign(a) / 1.5); ctx.globalAlpha = clamp(o.fall * 4, 0, 1); ctx.drawImage(s.c, -s.ox, -s.oy + 2); ctx.restore(); ctx.globalAlpha = 1;
    return s;
  }
  const wx = o.wob > 0 ? Math.round(Math.sin(o.wob * 70) * 2 * o.wob / .28) : 0, behind = s.tree && P.y < o.y && P.y > o.y - s.h && Math.abs(P.x - o.x) < s.c.width / 2;
  if (behind) ctx.globalAlpha = .5; ctx.drawImage(s.c, x - s.ox + wx, y - s.oy); ctx.globalAlpha = 1;
  if (o.gh > 0 && need > 1) { const by = y - Math.min(s.h, 34) - 4; ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 9, by, 18, 3); ctx.fillStyle = '#e8b04a'; ctx.fillRect(x - 8, by + 1, Math.round(16 * o.gh / need), 1); }
  return s;
}
// Nachwachsen, Wackeln und Umkippen im Versteck
function gatherHideTick(dt) {
  const H = SAVE.meta.hide, now = bNow();
  for (const o of obs) {
    if (o.k !== 'gat') continue;
    if (o.wob > 0) o.wob = Math.max(0, o.wob - dt);
    if (o.fall > 0) { o.fall -= dt; if (o.fall <= 0) { o.fall = 0; burst(o.x + o.fd * 16, o.y, 4, '#4a9a3a', 12, 50); dust(o.x + o.fd * 12, o.y, 6); sfx('wood'); shake(1.5); } }
    if (o.gone && !(o.fall > 0) && (H.gat[o.id] || 0) <= now) { o.gone = false; o.gh = 0; o.solid = Math.hypot(P.x - o.x, P.y - o.y) > o.r + 6; delete H.gat[o.id]; for (let i = 0; i < 8; i++) part(o.x + rnd(-6, 6), o.y, rnd(0, 10), 0, 0, rnd(15, 35), pick(['#79c24e', '#c8f06a']), rnd(.4, .8), 1, -10, 1); }
    if (!o.gone && !o.solid && Math.hypot(P.x - o.x, P.y - o.y) > o.r + 6) o.solid = true;   // nachgewachsen, während der Held danebenstand
  }
}

/* ---------- Endlose Lande: Bäume, Felsen, Pflanzen ---------- */
// Art je Pflanze/Fels der Welt (LPROPR in js/lande.js)
const GPROP = { eiche: 'baum', herbst: 'baum', tanne: 'baum', schnee: 'baum', birke: 'baum', weide: 'baum', palme: 'baum', tot: 'baum', dorn: 'baum', kohle: 'baum', riese: 'baum',
  sternbaum: 'sternbaum', glasbaum: 'sternbaum', knochenbaum: 'knochen', schaedel: 'knochen', pilz: 'pilz', riesenpilz: 'pilz', kaktus: 'kaktus', busch: 'busch', schilf: 'busch',
  stein: 'stein', fels: 'fels', salzk: 'stein', obs: 'obsidian', saeule: 'marmor', kristall: 'kristall', zahnrad: 'schrott', ruest: 'schrott', koralle: 'koralle' };
const GK = {
  baum: { hits: 3, snd: 'wood', chip: GCHIP.wood, fall: 1, nest: 1 }, sternbaum: { hits: 4, snd: 'wood', chip: ['#9ab0ff', '#e8ecff', '#4a4ad0'], fall: 1, nest: 1 },
  knochen: { hits: 3, snd: 'mine', chip: ['#e8e2cf', '#a8a08a', '#fffaf0'] }, pilz: { hits: 2, snd: 'dig', chip: ['#c8a0d0', '#e8d0b0', '#8a6a9a'] },
  kaktus: { hits: 2, snd: 'wood', chip: ['#5aaa42', '#3a7a2a', '#c8f06a'] }, busch: { hits: 1, snd: 'dig', chip: GCHIP.leaf },
  stein: { hits: 2, snd: 'mine', chip: GCHIP.rock }, fels: { hits: 4, snd: 'mine', chip: GCHIP.rock }, obsidian: { hits: 3, snd: 'mine', chip: ['#2e2240', '#5a4278', '#ff8a3a'] },
  marmor: { hits: 4, snd: 'mine', chip: ['#eee8dc', '#c8c0b0', '#ffffff'] }, kristall: { hits: 3, snd: 'mine', chip: ['#b892f4', '#e8d8ff', '#6a48c0'] },
  schrott: { hits: 3, snd: 'mine', chip: ['#a8582a', '#7a828e', '#d88a4a'] }, koralle: { hits: 2, snd: 'mine', chip: ['#e8a0a0', '#f0d8c8', '#c8706a'] }
};
// Biome mit hartem Holz / Sternholz, Felsfarben (rv, LSTONE) mit Marmor / Obsidian
const GEISEN = { uralt: 1, schattenwald: 1, nebelwald: 1, dschungel: 1, bernstein: 1, goetterhain: 1, tannen: 1 };
const GSTERN = { sternenfeld: 1, aether: 1, traumwiese: 1, traumwald: 1, mondsee: 1, goetterdaemmerung: 1, urnebel: 1, sternmeer: 1 };
const GMARMOR = { 6: .6, 12: .6, 9: .3, 14: .3 }, GOBS = { 2: .55, 5: .55, 15: .4 };
const gKey = o => 'gt' + Math.round(o.x - LOFF) + ',' + Math.round(o.y - LOFF);
function gNeed(o) { return o.t === 'riese' ? 8 : o.t === 'riesenpilz' ? 4 : GK[GPROP[o.t]].hits; }
// Chunk geladen: erst Grundzustand (die Welt ist für alle gleich) …
function gatherReset(rec) { for (const c of rec.grid) for (const o of c) if (o.k === 'prop' && GPROP[o.t]) { o.gone = false; o.solid = o.r > 0; o.gh = 0; o.nest = false; o.fall = 0; o.wob = 0; } }
// … dann der Zustand dieses Ausflugs: abgebaut, angeschlagen, Vogelnest (je Ausflug neu ausgewürfelt, ~2,5 % der Bäume)
function gatherApply(rec) {
  const L = LW; if (!L) return;
  for (const c of rec.grid) for (const o of c) {
    if (o.k !== 'prop' || !GPROP[o.t]) continue;
    const key = gKey(o);
    if (L.ts.get(key)) { o.gone = true; o.solid = false; continue; }
    o.gh = (L.gh && L.gh.get(key)) || 0;
    if (GK[GPROP[o.t]].nest && !L.ts.get('gn' + key.slice(2)) && lH(Math.round(o.x), Math.round(o.y), L.seed & 0x7fffffff) % 1000 < 25) o.nest = true;
  }
}
// Nahkampf-Schwung (js/combat.js meleeSweep): alles im Bogen vor dem Helden
function gatherSweep(range, arc) {
  if (typeof LW === 'undefined' || !LW || !LW.on || !P.hitSet) return;
  const N = lNear(P.x, P.y, range + 24).slice();
  for (const o of N) {
    if (o.k !== 'prop' || o.gone || !GPROP[o.t] || P.hitSet.has(o)) continue;
    const ex = o.x - P.x, ey = o.y - P.y, d = Math.hypot(ex, ey);
    if (d > range + o.r + 2) continue;
    if (Math.abs(angDiff(Math.atan2(ey, ex), P.aim)) > arc / 2 + .4 && d > o.r + 8) continue;
    P.hitSet.add(o); gatherHitL(o, ex / (d || 1), ey / (d || 1));
  }
}
// Pfeil, Zauber … trifft einen Baum/Felsen (js/lande.js)
function gatherProj(o, p) { if (!LW || !LW.on || o.gone || !GPROP[o.t]) return; const v = Math.hypot(p.vx, p.vy) || 1; gatherHitL(o, p.vx / v, p.vy / v); }
function gatherHitL(o, nx, ny) {
  const L = LW, kind = GPROP[o.t], K = GK[kind], key = gKey(o), need = gNeed(o);
  if (o.nest) { o.nest = false; L.ts.set('gn' + key.slice(2), 1); gNestDrop(o); }
  o.gh = (o.gh || 0) + 1; (L.gh || (L.gh = new Map())).set(key, o.gh); o.wob = .28; o.fd = (nx || 0) >= 0 ? 1 : -1;
  gChips(o, K.chip, nx, ny, K.fall ? gLeaf(o) : null); sfx(K.snd); if (K.snd === 'mine') spark(o.x, o.y - 6, Math.atan2(ny || 0, nx || 1), '#fff');
  lTip(1024, _t('Tipp: Bäume, Felsen und Büsche kannst du mit Angriffen abbauen. Holz, Stein und Fasern brauchst du zum Bauen im Versteck.'));
  if (o.gh < need) return;
  o.gone = true; o.solid = false; o.fall = K.fall ? .6 : 0; o.gh = 0; L.gh.delete(key); L.ts.set(key, 1);
  if (!K.fall) burst(o.x, o.y, 6, K.chip[0], 12, 60);
  gatherGiveAll(o, gatherYield(o, kind));
}
function gLeaf(o) { if (o.t === 'herbst') return ['#e07a2a', '#ffb84a', '#a84a1a']; if (o.t === 'schnee') return ['#e8f4ff', '#c8dcec']; if (o.t === 'tot' || o.t === 'kohle') return ['#5a4a3a', '#3a2a22']; if (o.t === 'sternbaum' || o.t === 'glasbaum') return ['#ffe08a', '#c060ff', '#ffffff']; const P_ = typeof LTPAL !== 'undefined' && (o.t === 'eiche' || o.t === 'riese') ? LTPAL[o.v] : null; return P_ ? [P_[2], P_[3], P_[1]] : GCHIP.leaf; }
// Was ein Baum/Fels gibt: tiefer mehr und Besseres, je nach Biom und Felsfarbe
function gatherYield(o, kind) {
  const st = lStage(o.x, o.y), bk = lBioAt(o.x, o.y), m = 1 + Math.min(2, st / 80), R = Math.random, g = {}, add = (k, n) => { n = Math.round(n); if (n > 0) g[k] = (g[k] || 0) + n; };
  switch (kind) {
    case 'baum': {
      const big = o.t === 'riese' ? 3 : 1, ei = clamp((st - 12) / 50, 0, .45) + (GEISEN[bk] ? .35 : 0) + (big > 1 ? 1 : 0), sh = (st >= 55 ? clamp((st - 55) / 150, .05, .3) : 0) + (GSTERN[bk] ? .25 : 0);
      add('holz', ri(2, 4) * m * big); if (R() < ei) add('eisenholz', ri(1, 2) * big); if (R() < sh) add('sternholz', 1); if (R() < .12) add('samen', 1);
      break;
    }
    case 'sternbaum': add('sternholz', ri(1, 2)); add('holz', ri(1, 2) * m); break;
    case 'knochen': add('knochen', ri(2, 3) * m); if (o.t === 'knochenbaum') add('holz', 1); break;
    case 'pilz': add('faser', ri(2, 3) * (o.t === 'riesenpilz' ? 2 : 1)); if (R() < .5) add('samen', 1); break;
    case 'kaktus': add('faser', ri(2, 3)); if (R() < .4) add('holz', 1); break;
    case 'busch': add('faser', ri(1, 2)); if (R() < .45) add('samen', 1); if (R() < .08) add('feder', 1); break;
    case 'stein': case 'fels': {
      const big = kind === 'fels' ? 2 : 1, rv = o.t === 'salzk' ? 6 : o.v, mr = GMARMOR[rv] != null ? GMARMOR[rv] : clamp((st - 15) / 60, 0, .35), ob = GOBS[rv] != null ? GOBS[rv] : st >= 35 ? clamp((st - 35) / 100, 0, .3) : 0;
      add('stein', (big > 1 ? ri(3, 5) : ri(1, 3)) * m); if (R() < mr) add('marmor', ri(1, 2) * big); if (R() < ob) add('obsidian', ri(1, 2) * big); if (big > 1 && R() < .25) add('erz', ri(1, 2));
      break;
    }
    case 'obsidian': add('obsidian', ri(1, 3)); break;
    case 'marmor': add('marmor', ri(2, 4)); add('stein', ri(0, 2)); break;
    case 'kristall': if (R() < .4) add('kristall', 1); add('stein', ri(1, 2)); if (R() < .3) add('marmor', 1); break;
    case 'schrott': add('erz', ri(2, 3) * m); if (st >= 14 && R() < .3) add('mithril', 1); break;
    case 'koralle': add('stein', ri(1, 2)); if (R() < .4) add('marmor', 1); break;
  }
  return g;
}
// Vogelnest im Baum: beim ersten Treffer fällt es herunter, ein Vogel fliegt auf – Federn
function gNestDrop(o) {
  const s = lPropImg(o.t, o.v), ny = o.y; for (let i = 0; i < 10; i++) part(o.x + rnd(-4, 4), ny, s.h - 6 + rnd(-2, 2), rnd(-25, 25), rnd(-8, 8), rnd(20, 50), pick(['#f2ead2', '#c8c0b0', '#8a5a32']), rnd(.6, 1), 1, 40);
  for (let i = 0; i < 6; i++) part(o.x + i * 3, ny, s.h + i * 3, 40 + i * 6, -10, 30 + i * 4, '#5a4a3a', .7, 2, -20);   // der Vogel flattert davon
  sfx('page'); gatherGiveAll({ x: o.x, y: o.y - 4 }, { feder: ri(2, 4) + (lStage(o.x, o.y) > 40 ? 1 : 0), samen: Math.random() < .4 ? 1 : 0 });
}
// Zeichnen in den Landen (js/lande.js lDraw): Stumpf, Umkippen, Wackeln, Treffer-Balken, Vogelnest
function gatherDraw(o, x, y) {
  const kind = GPROP[o.t]; if (!kind) return false;
  if (o.wob > 0) o.wob = Math.max(0, o.wob - dt0);
  if (o.fall > 0) { o.fall -= dt0; if (o.fall <= 0) { o.fall = 0; burst(o.x + o.fd * 14, o.y, 4, gLeaf(o)[0], 10, 50); dust(o.x + o.fd * 12, o.y, 6); sfx('wood'); shake(1.5); } }
  if (o.gone && !(o.fall > 0)) { gStump(kind, x, y, o); return true; }
  const s = gPropDraw(o, o.t, o.v, x, y, gNeed(o));
  if (o.t === 'sternbaum' || o.t === 'kristall' || o.t === 'glasbaum' || (o.t === 'pilz' || o.t === 'riesenpilz') && o.v === 1) addLight(x, y - (o.t === 'riesenpilz' ? 30 : 12), o.t === 'riesenpilz' ? 40 : 22, .45);
  if (o.nest && !o.gone && !(o.fall > 0)) {
    const ny = y - s.h + 5 + (o.t === 'tanne' || o.t === 'schnee' ? 4 : 2), r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, ny + dy, w, h); };
    r(-4, 0, 9, 3, '#6a4424'); r(-5, 1, 11, 1, '#8a5a32'); r(-3, -1, 7, 1, '#a8743e'); r(-1, -1, 2, 1, '#e8f4ff'); r(2, -1, 1, 1, '#cfe8ff');
    if (Math.floor(T * .7 + o.x) % 3 === 0) { const b = Math.floor(T * 4) % 2; r(-1, -4 - b, 3, 2, '#7a5a3a'); r(2, -4 - b, 1, 1, '#e8b04a'); r(0, -5 - b, 1, 1, '#7a5a3a'); }
  }
  return true;
}
// Kräuterbeet in den Landen: dazu Samen und Fasern
function gatherKraut(o) { gatherGiveAll({ x: o.x, y: o.y }, { samen: ri(1, 2), faser: Math.random() < .5 ? 1 : 0 }); }
HOOK.update.push(dt => { if (GFX.length) gfxUpd(dt); if (G && G.type === 'versteck' && SAVE) gatherHideTick(dt); });

/* ---------- Acker im Kräutergarten: säen, wachsen (Echtzeit), ernten ---------- */
function farmBeds() { return [0, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6][Math.min(10, hideLv('garten'))]; }
function farmSpeed() { return hideLv('garten') >= 10 ? 2 : 1; }
function farmList() { const H = SAVE.meta.hide; if (!Array.isArray(H.farm)) H.farm = []; return H.farm; }
function farmFree() { const F = farmList(); for (let i = 0; i < farmBeds(); i++) if (!F[i]) return i; return -1; }
function farmReady() { if (!SAVE || !SAVE.meta.hide) return 0; const F = farmList(), now = bNow(); let n = 0; for (let i = 0; i < farmBeds(); i++) if (F[i] && F[i].end <= now) n++; return n; }
function farmPlant(c) {
  const C = CROPS[c], i = farmFree(); if (!C || !P || hideLv('garten') < C.lv || i < 0 || !hasMats(C.seed)) return false;
  payMats(C.seed); const now = bNow(); farmList()[i] = { c, t0: now, end: now + C.t * 1000 / farmSpeed() }; stat('sown'); saveChar(); persist(); return true;
}
function farmHarvest(i) {
  const F = farmList(), b = F[i]; if (!b || !P || i >= farmBeds() || b.end > bNow() || !CROPS[b.c]) return null;
  const C = CROPS[b.c], mul = hideLv('garten') >= 7 ? 1.25 : 1, got = {};
  for (const k in C.out) { const n = Math.round(ri(C.out[k][0], C.out[k][1]) * mul); if (n > 0) { gainMat(k, n); got[k] = n; } }
  let pot = 0; if (C.pot && P.potions < potMax()) { P.potions++; pot = 1; }
  F[i] = null; stat('harvest'); saveChar(); persist();
  return { got, pot };
}
const cropIcon = c => iconURL({ flachs: ['mat', 'faser'], heilkraut: ['pa', 'garten'], setzling: ['mat', 'holz'], moos: ['mat', 'kristall'], eisenbaum: ['mat', 'eisenholz'], sternblume: ['mat', 'sternholz'] }[c] || ['pa', 'garten']);
const cropOut = C => Object.keys(C.out).filter(k => C.out[k][1] > 0).map(k => (C.out[k][0] === C.out[k][1] ? C.out[k][0] : C.out[k][0] + '–' + C.out[k][1]) + ' ' + MATS[k].n).concat(C.pot ? [_t('1 Heiltrank')] : []).join(', ');
function farmHTML() {
  const lv = hideLv('garten'), beds = farmBeds(), F = farmList(), now = bNow(), free = farmFree() >= 0, ready = farmReady();
  let h = `<h3>${_t('ACKER · {n} BEETE', { n: beds })}</h3><p class="sub" style="margin-top:0">${_t('Säe Samen und ernte in Echtzeit – das Feld wächst auch, während du unterwegs bist. Samen gibt es von Büschen, Kräutern und aus dem Garten.')}</p>`;
  for (let i = 0; i < beds; i++) {
    const b = F[i], C = b && CROPS[b.c];
    if (!C) { h += `<div class="row frow" style="cursor:default;opacity:.7"><div class="ic"><img src="${iconURL(['pa', 'bau'])}" alt=""></div><div><div class="nm">${_t('Leeres Beet')}</div><div class="st">${_t('Unten bei SAATGUT etwas säen')}</div></div><span></span></div>`; continue; }
    const left = Math.max(0, (b.end - now) / 1000), w = clamp(100 * (1 - left / Math.max(1, (b.end - b.t0) / 1000)), 0, 100);
    h += `<div class="row frow" style="cursor:default"><div class="ic"><img src="${cropIcon(b.c)}" alt=""></div><div><div class="nm">${esc(C.n)}</div>${left > 0 ? `<div class="bprog" data-fgrow="${i}"><div class="bbar grow"><i style="width:${w.toFixed(1)}%"></i></div><b>${buildClock(left)}</b></div>` : `<div class="st" style="color:var(--moss)">${_t('Reif! {out}', { out: cropOut(C) })}</div>`}</div>${left > 0 ? '<span></span>' : `<button class="btn sm" data-act="fharv" data-i="${i}">${_t('Ernten')}</button>`}</div>`;
  }
  if (ready > 1) h += `<div class="menu"><button class="btn" data-act="fharvall">${_t('Alles ernten ({n})', { n: ready })}</button></div>`;
  h += `<h3>${_t('SAATGUT')}</h3>` + CROPORDER.map(c => {
    const C = CROPS[c], lock = lv < C.lv;
    return `<div class="row" style="cursor:default${lock ? ';opacity:.55' : ''}"><div class="ic"><img src="${cropIcon(c)}" alt=""></div><div><div class="nm">${esc(C.n)}</div><div class="st">${lock ? _t('ab Garten-Stufe {lv}', { lv: C.lv }) : _t('Wächst {t} · Ernte: {out}', { t: buildTimeText(C.t / farmSpeed()), out: cropOut(C) })}</div>${lock ? '' : costHTML(C.seed, 0)}</div>${lock ? '<span></span>' : `<button class="btn sm" data-act="fplant" data-id="${c}" ${free && hasMats(C.seed) ? '' : 'disabled'}>${_t('Säen')}</button>`}</div>`;
  }).join('');
  return h;
}
const farmMsg = r => Object.keys(r.got).map(k => '+' + r.got[k] + ' ' + MATS[k].n).concat(r.pot ? [_t('+1 Heiltrank')] : []).join(', ');
ON.fplant = id => { if (farmPlant(id)) { sfx('dig'); toast(_t('Gesät: {crop}', { crop: CROPS[id].n }), '#79c24e'); } else sfx('deny'); openProd('garten'); };
ON.fharv = (id, b, i) => { const r = farmHarvest(i); if (r) { sfx('heal'); toast(_t('Geerntet: {list}', { list: farmMsg(r) }), '#79c24e'); } else sfx('deny'); openProd('garten'); };
ON.fharvall = () => { const all = { got: {}, pot: 0 }; for (let i = 0; i < farmBeds(); i++) { const r = farmHarvest(i); if (r) { for (const k in r.got) all.got[k] = (all.got[k] || 0) + r.got[k]; all.pot += r.pot; } } sfx('heal'); toast(_t('Geerntet: {list}', { list: farmMsg(all) }), '#79c24e'); openProd('garten'); };

/* ---------- Für Tests: Zustand des Sammelns ---------- */
function gatherInfo() {
  const L = typeof LW !== 'undefined' && LW && LW.on ? LW : null, H = SAVE.meta.hide, now = bNow();
  return {
    trip: L ? Object.assign({}, L.gat || {}) : null,
    tripGone: L ? [...L.ts.keys()].filter(k => k.startsWith('gt')).length : 0,
    hide: GHIDE.map(g => ({ id: g.id, t: g.t, ready: !((H.gat[g.id] || 0) > now), left: Math.max(0, ((H.gat[g.id] || 0) - now) / 1000) })),
    beds: farmBeds(), farm: farmList().slice(0, farmBeds()).map(b => b ? { c: b.c, left: Math.max(0, (b.end - now) / 1000) } : null),
    builders: builders(), q: buildQ().map(q => ({ k: q.k, lv: q.lv, left: buildLeft(q) })),
    total: SAVE.meta.stats.gather || 0
  };
}
