'use strict';
/* =========================================================
   KLINGENHORT – Touch-Steuerung
   Frei verschiebbare und skalierbare Knöpfe, Joystick (schwebend
   oder fest), Trank-Modi, Zielen per Wischen, Vibration.
   Einstellungen liegen in SAVE.meta.settings.ctl
   ========================================================= */

const CTL_DEF = { scale: 1, alpha: .9, stick: 'float', stickSize: 1, pot: 'tap', haptics: true, aim: true, aimDrag: true, layout: {} };
// Mittelpunkt je Knopf, gemessen von der Ecke (ax/ay: l/r/c, t/b) bei Größe 1
const LAYOUT_DEF = {
  bAtk: { ax: 'r', ay: 'b', dx: 66, dy: 66, s: 88 },
  bRoll: { ax: 'r', ay: 'b', dx: 176, dy: 44, s: 60 },
  bS1: { ax: 'r', ay: 'b', dx: 160, dy: 124, s: 52 },
  bS2: { ax: 'r', ay: 'b', dx: 106, dy: 172, s: 52 },
  bS3: { ax: 'r', ay: 'b', dx: 42, dy: 180, s: 52 },
  bUlt: { ax: 'r', ay: 'b', dx: 42, dy: 244, s: 52 },
  bPot: { ax: 'l', ay: 't', dx: 46, dy: 118, s: 50 },
  bAct: { ax: 'c', ay: 'b', dx: 0, dy: 74, s: 64 },
  stick: { ax: 'l', ay: 'b', dx: 116, dy: 106, s: 104 }
};
const CTL_KEYS = Object.keys(LAYOUT_DEF);
const CTL_NAMES = { bAtk: 'Angriff', bRoll: 'Rolle', bS1: 'Fähigkeit 1', bS2: 'Fähigkeit 2', bS3: 'Fähigkeit 3', bUlt: 'Ultimative', bPot: 'Trank', bAct: 'Interagieren', stick: 'Joystick' };
function ctlSet() {
  if (!SAVE) return CTL_DEF;
  const s = SAVE.meta.settings; if (!s.ctl) s.ctl = {};
  for (const k in CTL_DEF) if (s.ctl[k] === undefined) s.ctl[k] = k === 'layout' ? {} : CTL_DEF[k];
  return s.ctl;
}
function layoutOf(k) { return Object.assign({}, LAYOUT_DEF[k], ctlSet().layout[k] || {}); }
function ctlScale() { return clamp(Math.min(innerWidth, innerHeight) / 400, .72, 1.15) * ctlSet().scale; }
function safeInset(side) { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sa' + side)) || 0; }
function ctlCenter(L) {
  const sc = ctlScale(), W = innerWidth, H = innerHeight;
  const x = L.ax === 'r' ? W - safeInset('r') - L.dx * sc : L.ax === 'l' ? safeInset('l') + L.dx * sc : W / 2 + L.dx * sc;
  const y = L.ay === 'b' ? H - safeInset('b') - L.dy * sc : safeInset('t') + L.dy * sc;
  return { x, y, s: L.s * sc * (L.z || 1) };
}
function buzz(ms) { try { if (ctlSet().haptics && navigator.vibrate) navigator.vibrate(ms); } catch (_) { } }

/* ---------- Knöpfe platzieren ---------- */
function applyLayout() {
  const c = ctlSet(), ai = $('bAct').querySelector('img'); if (!ai.getAttribute('src')) ai.src = iconURL(['pa', 'bau']);
  for (const k of CTL_KEYS) {
    const el = $(k === 'stick' ? 'stickHome' : k); if (!el) continue;
    const p = ctlCenter(layoutOf(k));
    el.style.left = (p.x - p.s / 2) + 'px'; el.style.top = (p.y - p.s / 2) + 'px'; el.style.width = el.style.height = p.s + 'px';
    el.style.setProperty('--s', p.s + 'px');
  }
  $('btns').style.opacity = c.alpha; $('stickHome').style.opacity = c.alpha;
  $('stickHome').classList.toggle('on', c.stick === 'fixed' || document.body.classList.contains('edit'));
  const R = stickR(); $('stick').style.width = $('stick').style.height = (R * 2.3) + 'px'; $('stick').style.margin = (-R * 1.15) + 'px 0 0 ' + (-R * 1.15) + 'px';
}
function stickR() { return 42 * ctlScale() * ctlSet().stickSize; }
addEventListener('resize', () => setTimeout(applyLayout, 50));

/* ---------- Joystick ---------- */
const tz = $('tzone'), stickEl = $('stick'), knob = $('knob');
function stickShow(x, y) { stickEl.style.display = 'block'; stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; }
function stickVec(cx, cy) {
  const fixed = ctlSet().stick === 'fixed', R = stickR();
  let dx = cx - stick.ox, dy = cy - stick.oy, l = Math.hypot(dx, dy);
  // Schwebender Stick folgt dem Daumen, wenn er über den Rand hinauszieht
  if (!fixed && l > R * 1.25) { const k = (l - R * 1.25) / l; stick.ox += dx * k; stick.oy += dy * k; dx = cx - stick.ox; dy = cy - stick.oy; l = Math.hypot(dx, dy); stickShow(stick.ox, stick.oy); }
  const m = Math.min(1, l / R), dz = .14, out = m < dz ? 0 : (m - dz) / (1 - dz);
  stick.x = l ? dx / l * out : 0; stick.y = l ? dy / l * out : 0;
  const kl = Math.min(l, R); knob.style.transform = `translate(${l ? dx / l * kl : 0}px,${l ? dy / l * kl : 0}px)`;
}
function stickStart(e) {
  if (stick.id !== null || document.body.classList.contains('edit')) return;
  audioOn(); stick.id = e.pointerId; try { e.target.setPointerCapture(e.pointerId); } catch (_) { }
  if (ctlSet().stick === 'fixed') { const p = ctlCenter(layoutOf('stick')); stick.ox = p.x; stick.oy = p.y; } else { stick.ox = e.clientX; stick.oy = e.clientY; }
  stickShow(stick.ox, stick.oy); stickVec(e.clientX, e.clientY);
}
const stickMoveH = e => { if (e.pointerId === stick.id) stickVec(e.clientX, e.clientY); };
const stickEnd = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; stickEl.style.display = 'none'; };
for (const el of [tz, $('stickHome')]) { el.addEventListener('pointerdown', stickStart); el.addEventListener('pointermove', stickMoveH); el.addEventListener('pointerup', stickEnd); el.addEventListener('pointercancel', stickEnd); el.addEventListener('lostpointercapture', stickEnd); }

/* ---------- Knöpfe ---------- */
function holdBtn(el, down, up, move) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); if (document.body.classList.contains('edit')) return; audioOn(); el.classList.add('down'); try { el.setPointerCapture(e.pointerId); } catch (_) { } el._sx = e.clientX; el._sy = e.clientY; el._id = e.pointerId; down(e); });
  if (move) el.addEventListener('pointermove', e => { if (el._id === e.pointerId && el.classList.contains('down')) move(e.clientX - el._sx, e.clientY - el._sy); });
  const u = () => { if (!el.classList.contains('down')) return; el.classList.remove('down'); el._id = null; if (up) up(); };
  el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('lostpointercapture', u);
}
holdBtn($('bAtk'), () => { touchAtk = true; }, () => { touchAtk = false; P.manAim = null; }, (dx, dy) => { if (!ctlSet().aimDrag) return; if (Math.hypot(dx, dy) > 16 * ctlScale()) P.manAim = Math.atan2(dy, dx); else P.manAim = null; });
holdBtn($('bRoll'), doRoll); holdBtn($('bS1'), () => useSkill(0)); holdBtn($('bS2'), () => useSkill(1)); holdBtn($('bS3'), () => useSkill(2)); holdBtn($('bUlt'), doUlt);
holdBtn($('bAct'), () => interactNear());
let potHold = null;
holdBtn($('bPot'), () => {
  if (ctlSet().pot !== 'hold') { drinkPotion(); return; }
  const el = $('bPot'), t0 = performance.now(); el.classList.add('hold');
  potHold = setInterval(() => { const p = Math.min(1, (performance.now() - t0) / 280); el.style.setProperty('--h', (p * 100) + '%'); if (p >= 1) { clearInterval(potHold); potHold = null; el.classList.remove('hold'); drinkPotion(); } }, 30);
}, () => { if (potHold) { clearInterval(potHold); potHold = null; } $('bPot').classList.remove('hold'); $('bPot').style.setProperty('--h', '0%'); });

/* ---------- Editor: Knöpfe verschieben und skalieren ---------- */
let edSel = 'bAtk', edDrag = null;
function openCtlEditor(back) {
  edBack = back || 'settings';
  document.body.classList.add('edit'); hideOverlay(); showHud(false); $('touch').hidden = false; $('bAct').hidden = false; $('bPot').hidden = false; $('ctlbar').hidden = false;
  setState('edit'); applyLayout(); edUI();
}
let edBack = 'settings';
function closeCtlEditor() {
  document.body.classList.remove('edit'); $('ctlbar').hidden = true; $('touch').hidden = true; $('bAct').hidden = true; persist(); applyLayout();
  if (edBack === 'pause' && G && G.type) { setState('play'); showPause(); } else if (edBack === 'pause') showTitle(); else { setState('title'); showControls(); }
}
function edUI() {
  const c = ctlSet(), L = layoutOf(edSel);
  for (const k of CTL_KEYS) { const el = $(k === 'stick' ? 'stickHome' : k); if (el) el.classList.toggle('sel', k === edSel); }
  $('ctlbar').innerHTML = `<b>${CTL_NAMES[edSel]}</b>
    <span class="grp">Größe <button data-e="z-">−</button><i>${Math.round((L.z || 1) * 100)}%</i><button data-e="z+">+</button></span>
    <span class="grp">Alle <button data-e="s-">−</button><i>${Math.round(c.scale * 100)}%</i><button data-e="s+">+</button></span>
    <span class="grp">Deckkraft <button data-e="a-">−</button><i>${Math.round(c.alpha * 100)}%</i><button data-e="a+">+</button></span>
    <span class="grp"><button data-e="stick">Joystick: ${c.stick === 'fixed' ? 'FEST' : 'FREI'}</button><button data-e="mirror">Spiegeln</button><button data-e="reset">Standard</button><button data-e="done" class="ok">Fertig</button></span>
    <small>Knöpfe ziehen zum Verschieben · antippen zum Auswählen</small>`;
}
$('ctlbar').addEventListener('click', ev => {
  const b = ev.target.closest('[data-e]'); if (!b) return; const c = ctlSet(), a = b.dataset.e; sfx('click');
  const cur = c.layout[edSel] = Object.assign({}, c.layout[edSel] || {});
  if (a === 'z-' || a === 'z+') cur.z = clamp(Math.round(((cur.z || 1) + (a === 'z+' ? .1 : -.1)) * 10) / 10, .5, 2);
  if (a === 's-' || a === 's+') c.scale = clamp(Math.round((c.scale + (a === 's+' ? .1 : -.1)) * 10) / 10, .6, 1.6);
  if (a === 'a-' || a === 'a+') c.alpha = clamp(Math.round((c.alpha + (a === 'a+' ? .1 : -.1)) * 10) / 10, .3, 1);
  if (a === 'stick') c.stick = c.stick === 'fixed' ? 'float' : 'fixed';
  if (a === 'mirror') { for (const k of CTL_KEYS) { const L = layoutOf(k); c.layout[k] = Object.assign({}, c.layout[k] || {}, { ax: L.ax === 'r' ? 'l' : L.ax === 'l' ? 'r' : 'c', dx: L.ax === 'c' ? -L.dx : L.dx, ay: L.ay, dy: L.dy }); } }
  if (a === 'reset') { c.layout = {}; c.scale = 1; c.alpha = .9; }
  if (a === 'done') { closeCtlEditor(); return; }
  applyLayout(); edUI(); persist();
});
function edStart(e) {
  if (!document.body.classList.contains('edit')) return;
  const el = e.target.closest('.tb,#stickHome'); if (!el) return;
  e.preventDefault(); e.stopPropagation(); edSel = el.id === 'stickHome' ? 'stick' : el.id; const p = ctlCenter(layoutOf(edSel));
  edDrag = { id: e.pointerId, ox: p.x - e.clientX, oy: p.y - e.clientY, moved: false }; try { el.setPointerCapture(e.pointerId); } catch (_) { } edUI();
}
function edMove(e) {
  if (!edDrag || e.pointerId !== edDrag.id) return; edDrag.moved = true;
  const x = clamp(e.clientX + edDrag.ox, 20, innerWidth - 20), y = clamp(e.clientY + edDrag.oy, 20, innerHeight - 20), sc = ctlScale(), c = ctlSet();
  const ax = x > innerWidth * .62 ? 'r' : x < innerWidth * .38 ? 'l' : 'c', ay = y > innerHeight / 2 ? 'b' : 't';
  const dx = ax === 'r' ? (innerWidth - safeInset('r') - x) / sc : ax === 'l' ? (x - safeInset('l')) / sc : (x - innerWidth / 2) / sc, dy = ay === 'b' ? (innerHeight - safeInset('b') - y) / sc : (y - safeInset('t')) / sc;
  c.layout[edSel] = Object.assign({}, c.layout[edSel] || {}, { ax, ay, dx: Math.round(dx), dy: Math.round(dy) }); applyLayout();
}
function edEnd(e) { if (edDrag && e.pointerId === edDrag.id) { edDrag = null; persist(); } }
$('touch').addEventListener('pointerdown', edStart, true); addEventListener('pointermove', edMove); addEventListener('pointerup', edEnd); addEventListener('pointercancel', edEnd);
