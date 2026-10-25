'use strict';
/* =========================================================
   KLINGENHORT – Zeichnen: Figuren, Effekte, Licht
   ========================================================= */

let CX = 0, CY = 0, SUBX = 0, SUBY = 0, LIGHTS = [];
const SCR = mk(64, 64), SG = SCR.getContext('2d'); SG.imageSmoothingEnabled = false;
const SCR2 = mk(64, 64), SG2 = SCR2.getContext('2d'); SG2.imageSmoothingEnabled = false;
function addLight(x, y, r, a) { LIGHTS.push([x, y, r, a == null ? 1 : a]); }
function glow(x, y, r, col, a) { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
function ptext(s, x, y, col, size) { ctx.font = (size || 8) + 'px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(s, Math.round(x) + 1, Math.round(y) + 1); ctx.fillStyle = col; ctx.fillText(s, Math.round(x), Math.round(y)); }
function drawWeapon(spr, x, y, ang, sc) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(spr.bow ? ang : ang + Math.PI / 2); const s = sc || 1; if (Math.cos(ang) < 0) ctx.scale(spr.bow ? s : -s, spr.bow ? -s : s); else ctx.scale(s, s); ctx.drawImage(spr.c, -spr.ox, -spr.oy); ctx.restore(); }
function depthScale(y) { return .95 + .08 * clamp((y - BD.y0) / (BD.y1 - BD.y0), 0, 1); }
function drawFxFrame(name, f, x, y, sc, rot, flipY, img) {
  const [sx, sy, w, h] = fxRect(name, f);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (rot) ctx.rotate(rot); ctx.scale(sc || 1, (sc || 1) * (flipY ? -1 : 1));
  if (img) ctx.drawImage(img, (f % FX[name][4]) * w, 0, w, h, -w / 2, -h / 2, w, h); else ctx.drawImage(FXIMG, sx, sy, w, h, -w / 2, -h / 2, w, h);
  ctx.restore();
}
// Held mit dem gewählten Aussehen der Ausrüstung (visItem, js/trade.js)
function heroStrip() { const hm = visItem(P.gear.helm), am = visItem(P.gear.armor), hg = headgearOf(hm); return { strip: charStrip(heroSpec(P, { np: hg === 'crown' ? 1 : 0, at: am ? am.tier : 0, ht: hm ? hm.tier : 0 })), hg, hm }; }

/* ---------- Figuren ---------- */
const HAND = { knight: [4, -9], knightf: [4, -9], wizard: [4, -9], wizf: [4, -9], elf: [4, -9], elff: [4, -9], dwarf: [4, -8], dwarff: [4, -8], lizard: [4, -9], lizardf: [4, -9], doc: [4, -7] };
function drawActor(e, isP) {
  const sx = Math.round(e.x - CX), sy = Math.round(e.y - CY), zz = e.z || 0, ds = depthScale(e.y), sc = (e.sc || 1) * ds;
  const sr = (e.r + 2) * sc * Math.max(.5, 1 - zz / 60);
  ctx.globalAlpha = e.alpha != null ? e.alpha * .35 : .35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr * .42, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
  SG.clearRect(0, 0, 64, 64);
  let fw, fh, strip = null, fi = 0;
  if (isP) {
    const hs = heroStrip(); strip = hs.strip; fw = strip.w; fh = strip.h;
    const w4 = v => ((Math.floor(v) % 4) + 4) % 4;
    fi = P.flash > 0 && strip.hasHit ? 8 : (P.moving ? 4 + w4(P.phase * .6) : w4(T * 6));
    const ox = 32 - fw / 2, oy = 60 - fh, m = strip.meta[fi] || strip.meta[0], L = P.look, cc = capeCols(L);
    if (L.wings && COSM[L.wings] && P.roll <= 0) drawWings(SG, ox, oy, m, COSM[L.wings], P.moving);
    if (cc) drawCape(SG, ox, oy, m, cc, P.moving, P.phase);
    SG.drawImage(strip.c, fi * fw, 0, fw, fh, ox, oy, fw, fh);
    if (hs.hg) drawHeadgear(SG, ox, oy, m, hs.hg, hs.hm);
  } else {
    const anim = e.moving || e.st === 'act' ? 'run' : 'idle', spd = anim === 'run' ? 10 : 6;
    let r = frameRect(e.sp, anim, Math.floor(T * spd + e.seed));
    if (e.sp === 'mimic') r = frameRect('mimic', 'idle', e.st === 'wind' || e.st === 'act' ? 2 : Math.floor(T * 4 + e.seed) % 3);
    if (SP[e.sp].hit && e.flash > 0) r = [SP[e.sp].hit[0], SP[e.sp].hit[1], SP[e.sp].w, SP[e.sp].h];
    if (e.freeze > 0) r = frameRect(e.sp, 'idle', 0);
    fw = r[2]; fh = r[3];
    SG.drawImage(SHEET, r[0], r[1], fw, fh, 32 - fw / 2, 60 - fh, fw, fh);
  }
  const windEnd = !isP && e.st === 'wind' && e.stT < .16;
  const tint = e.flash > 0 ? '#ffffff' : windEnd ? 'rgba(255,60,40,.55)' : e.freeze > 0 ? 'rgba(140,210,255,.6)' : e.burn > 0 ? `rgba(255,120,30,${.25 + .15 * Math.sin(T * 20)})` : e.poison > 0 ? 'rgba(120,220,90,.3)' : e.chill > 0 ? 'rgba(160,220,255,.3)' : (e.tint || (e.elite ? 'rgba(255,190,60,.32)' : null));
  if (tint) { SG.globalCompositeOperation = 'source-atop'; SG.fillStyle = tint; SG.fillRect(0, 0, 64, 64); SG.globalCompositeOperation = 'source-over'; }
  const sq = e.squash || 0, kx = e.turn * sc * (1 + sq), ky = sc * (1 - sq), ln = e.lean || 0;
  ctx.save(); ctx.translate(sx, sy - zz);
  if (e.alpha != null) ctx.globalAlpha = e.alpha;
  if (isP) { if (P.stealth > 0) ctx.globalAlpha = .35; else if (P.inv > 0 && P.roll <= 0 && !busy() && Math.floor(T * 20) % 2) ctx.globalAlpha = .45; }
  if (e.rollA) { ctx.translate(0, -10 * sc); ctx.rotate(e.rollA); ctx.translate(0, 10 * sc); }
  ctx.transform(1, 0, ln, 1, 0, 0); ctx.scale(kx, ky);
  if (isP && strip) {
    const up = Math.max(P.gear.armor ? P.gear.armor.up : 0, P.gear.helm ? P.gear.helm.up : 0), myth = (P.gear.armor && P.gear.armor.rar === 6) || (P.gear.helm && P.gear.helm.rar === 6);
    if (up >= 5 || P.rebirths || myth) {
      const col = myth ? '#ff4fd8' : up >= 10 ? '#ffd24a' : up >= 8 ? (P.gear.armor ? RAR[P.gear.armor.rar].c : '#fff') : P.rebirths && up < 5 ? '#ffd24a' : '#ffffff';
      const sil = silCache(strip, col); const a = ctx.globalAlpha; ctx.globalAlpha = a * (.45 + .2 * Math.sin(T * 5));
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sil, fi * fw, 0, fw, fh, -fw / 2 + ox, -fh + oy, fw, fh);
      ctx.globalAlpha = a;
    }
  }
  if (!isP && e.boss) {
    // Bosse bekommen einen pulsierenden Umriss in ihrer Blutfarbe, damit sie sich auch auf dunklem Boden abheben
    SG2.clearRect(0, 0, 64, 64); SG2.drawImage(SCR, 0, 0); SG2.globalCompositeOperation = 'source-in'; SG2.fillStyle = e.def.glow || e.def.blood || '#ff4a3a'; SG2.fillRect(0, 0, 64, 64); SG2.globalCompositeOperation = 'source-over';
    const a = ctx.globalAlpha; ctx.globalAlpha = a * (.6 + .25 * Math.sin(T * 5));
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(SCR2, -32 + ox, -60 + oy);
    ctx.globalAlpha = a;
  }
  ctx.drawImage(SCR, -32, -60);
  ctx.restore();
  if (!isP && e.st !== 'spawn') {
    const top = sy - zz - Math.round((fh - 2) * sc);
    if (e.elite) { ctx.fillStyle = e.champ ? '#ff6a3a' : '#ffd24a'; ctx.fillRect(sx - 2, top - 3, 1, 2); ctx.fillRect(sx, top - 4, 1, 3); ctx.fillRect(sx + 2, top - 3, 1, 2); }
    if (e.freeze > 0) { ctx.fillStyle = 'rgba(200,240,255,.35)'; ctx.fillRect(sx - fw * sc / 2, top, fw * sc, fh * sc); }
  }
  const hand = isP ? (HAND[BODIES[P.look.body].sp] || [4, -9]) : (e.def.hand || [3, -5]);
  return { x: sx + hand[0] * kx + ln * hand[1] * ky, y: sy - zz + hand[1] * ky, sc, top: fh * sc };
}
function silCache(strip, col) { strip.silc = strip.silc || {}; return strip.silc[col] || (strip.silc[col] = silhouette(strip.c, col)); }

function playerWeaponAng() {
  const sgn = Math.cos(P.aim) >= 0 ? 1 : -1, type = P.gear.weapon.base, W = WT[type];
  if (P.spin > 0) return P.spinA;
  if (P.atkT > 0) { const p = 1 - P.atkT / P.atkDur; if (W.ranged || type === 'dagger') return P.aim; const arc = W.arc * (P.combo === 2 ? 1.25 : 1), dir = P.combo === 1 ? -1 : 1; return P.aim + sgn * dir * (-arc / 2 + arc * easeOut(p)); }
  if (P.dash) return P.aim;
  if (type === 'bow') return P.face > 0 ? .35 : Math.PI - .35;
  if (type === 'staff') return P.face > 0 ? -1.2 : Math.PI + 1.2;
  const sw = P.moving ? Math.sin(P.phase) * .15 : 0;
  return P.face > 0 ? 1.05 + sw : Math.PI - 1.05 - sw;
}
function drawPlayer() {
  const it = P.gear.weapon, vw = visItem(it), spr = weaponArt(vw), ang = playerWeaponAng(), gc = weaponGlow(vw);
  let off = 0; if (P.atkT > 0 && it.base === 'dagger') { const p = 1 - P.atkT / P.atkDur; off = P.combo === 2 ? Math.abs(Math.sin(p * Math.PI * 2)) * 8 : Math.sin(p * Math.PI) * 7; }
  if (P.spin > 0) off = 10;
  const showW = P.roll <= 0 && !P.leap && state !== 'dead', behind = Math.sin(ang) < -.35 && P.spin <= 0 && it.base !== 'staff';
  const wpos = h => ({ x: h.x + Math.cos(ang) * off, y: h.y + Math.sin(ang) * off * (P.spin > 0 ? .5 : 1) });
  if (showW && behind && P.hand) { const q = wpos(P.hand); drawWeapon(spr, q.x, q.y, ang, P.hand.sc); }
  if (P.wall > 0) { const f = Math.floor(T * 10) % 6, sk = P.wallSk; ctx.globalAlpha = sk ? .3 + sk.r * .03 : .28; drawFxFrame('shield', f, P.x - CX, P.y - CY - 12, .8 * (sk ? sk.sc : 1), 0, false, sk && skFx('shield', sk)); ctx.globalAlpha = 1; addLight(P.x - CX, P.y - CY - 10, 40, .6); }
  const L = P.look, aura = L.aura && COSM[L.aura];
  if (aura) { const x = P.x - CX, y = P.y - CY; ctx.globalAlpha = .18 + .06 * Math.sin(T * 4); ctx.fillStyle = aura.c[0]; ctx.beginPath(); ctx.ellipse(x, y, 11, 4.5, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; if (Math.random() < .35) part(P.x + rnd(-8, 8), P.y + rnd(-2, 2), rnd(0, 4), 0, 0, rnd(15, 35), Math.random() < .5 ? aura.c[0] : aura.c[1], rnd(.5, .9), 1, -6, 1); }
  if (L.wings === 'w_phoenix' && Math.random() < .3) part(P.x - P.turn * 7 + rnd(-4, 4), P.y, rnd(10, 22), 0, 0, rnd(10, 25), Math.random() < .5 ? '#ffd24a' : '#ff6a2a', .5, 1, -10, 1);
  const h = drawActor(P, true); if (h) P.hand = h;
  if (showW && !behind && h) { const q = wpos(h); drawWeapon(spr, q.x, q.y, ang, h.sc); }
  if (h && (vw.tier >= 3 || it.rar >= 3 || it.up >= 5)) { addLight(h.x, h.y, 30, .6); if ((it.up >= 7 || vw.tier >= 5 || it.rar === 6) && Math.random() < .3) part(P.x + rnd(-6, 6), P.y, rnd(6, 16), 0, 0, 15, gc, .4, 1, 0, 1); }
  if (P.gear.armor && P.gear.armor.up >= 8 && Math.random() < .25) part(P.x + rnd(-7, 7), P.y + rnd(-2, 2), rnd(0, 6), 0, 0, rnd(15, 30), P.gear.armor.up >= 10 ? '#ffd24a' : RAR[P.gear.armor.rar].c, rnd(.4, .8), 1, -5, 1);
  if (P.rebirths && Math.random() < .15) part(P.x + rnd(-8, 8), P.y, 0, 0, 0, 25, '#ffd24a', .7, 1, 0, 1);
  if (P.spin > 0 && h) { const K = 1 + mod('k2Rad'); ctx.strokeStyle = P.spinSk ? P.spinSk.col : '#f0f4ff'; ctx.globalAlpha = P.spinSk ? .5 : .35; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(h.x, h.y + 4, 30 * K, 15 * K, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
}
function drawEnemy(e) {
  if (e.ai === 'dummy') { drawDummy(e); return; }
  const sx = Math.round(e.x - CX), sy = Math.round(e.y - CY);
  if (e.under > 0) { ctx.fillStyle = '#4a3a2e'; ctx.beginPath(); ctx.ellipse(sx, sy, 7, 3, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#6a5642'; ctx.fillRect(sx - 3 + Math.round(Math.sin(T * 20) * 2), sy - 3, 2, 2); ctx.fillRect(sx + 2, sy - 2 + Math.round(Math.cos(T * 18)), 2, 2); return; }
  const h = drawActor(e, false);
  if (e.def.wpn && e.st !== 'spawn') {
    const spr = namedWeapon(e.def.wpn), sgn = Math.cos(e.aim) >= 0 ? 1 : -1;
    let off = 1.1; if (e.st === 'wind') { const p = 1 - e.stT / e.windDur; off = lerp(1.1, -1.7, easeOut(clamp(p, 0, 1))); } else if (e.st === 'act') off = .6;
    if (e.ai === 'caster') off = e.st === 'wind' ? -.6 : .25;
    if (e.ai === 'lunge') off = e.st === 'act' || e.st === 'wind' ? 0 : .9;
    if (e.ai === 'archer' || spr.bow) { drawWeapon(spr, h.x, h.y, e.st === 'wind' || e.st === 'act' ? e.aim : (e.face > 0 ? .35 : Math.PI - .35), h.sc); }
    else drawWeapon(spr, h.x, h.y, e.aim + off * sgn, h.sc);
    if (e.ai === 'caster' && e.st === 'wind') addLight(h.x, h.y - 10 * h.sc, 22, .8);
  }
  if (e.st === 'wind' && !e.boss) ptext('!', sx, sy - h.top - 6 - e.z, '#ffd24a', 8);
  if (!e.boss && (e.hp < e.maxHp || e.affixes.length) && e.st !== 'spawn' && !e.champ) {
    const w = Math.round(14 * e.sc), y = sy - Math.round(h.top) - Math.round(e.z) - 3;
    ctx.fillStyle = '#000'; ctx.fillRect(sx - w / 2 - 1, y - 1, w + 2, 3); ctx.fillStyle = e.elite ? '#e8b04a' : '#c8463c'; ctx.fillRect(sx - w / 2, y, Math.max(0, Math.round(w * e.hp / e.maxHp)), 1);
    if (e.armorMax) { ctx.fillStyle = '#c8c8d8'; ctx.fillRect(sx - w / 2, y - 2, Math.round(w * e.armor / e.armorMax), 1); }
    if (e.affixes.length && e.elite) { ctx.font = '8px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; const label = e.affixes.map(a => AFFIX[a].n).join(' · '); ctx.fillStyle = '#000'; ctx.fillText(label, sx + 1, y - 2); ctx.fillStyle = AFFIX[e.affixes[0]].c; ctx.fillText(label, sx, y - 3); }
  }
  if (e.champ && e.st !== 'spawn') { const y = sy - Math.round(h.top) - Math.round(e.z) - 4; ctx.font = '8px "VT323", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#000'; ctx.fillText(e.name, sx + 1, y + 1); ctx.fillStyle = '#ff8a5a'; ctx.fillText(e.name, sx, y); }
  if (e.ai === 'swoop' || e.t === 'demon' || e.t === 'pyraxis' || e.t === 'jungdrache') addLight(sx, sy - 10 * e.sc - e.z, 26 * e.sc, .5);
  if (e.ai === 'ghost') addLight(sx, sy - 10 - e.z, 18, .4 * (1 - e.fade));
  if (e.t === 'goldgob') addLight(sx, sy - 8, 30, .7);
  hook('drawEnemy', e);
}
function drawObs(o) {
  const x = Math.round(o.x - CX), y = Math.round(o.y - CY);
  if (o.k === 'station') { drawStation(o); return; }
  if (o.k === 'npc') { drawNpc(o); return; }
  if (o.k === 'col') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3.5, 0, 0, 6.283); ctx.fill(); ctx.drawImage(SHEET, 80, 80, 16, 48, x - 8, y - 44, 16, 48); return; }
  if (o.k === 'quelle') {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 10, 4, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5a5260'; ctx.beginPath(); ctx.ellipse(x, y - 2, 9, 4.5, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#7a7280'; ctx.fillRect(x - 9, y - 3, 18, 1);
    ctx.fillStyle = o.used ? '#2a2834' : '#3a8ac8'; ctx.beginPath(); ctx.ellipse(x, y - 3, 7, 3, 0, 0, 6.283); ctx.fill();
    if (!o.used) { ctx.fillStyle = '#bfefff'; ctx.fillRect(x - 3 + Math.floor(T * 3) % 5, y - 4, 2, 1); ctx.fillRect(x - 1, y - 9 - Math.floor(T * 6) % 4, 2, 4); addLight(x, y - 4, 22, .5); }
    return;
  }
  if (o.k === 'chest') { const f = o.open ? Math.min(2, Math.floor(o.open * 3)) : 0; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 7, y, 14, 2); ctx.drawImage(SHEET, 304 + f * 16, 416, 16, 16, x - 8, y - 14, 16, 16); if (o.gold && !o.open) { ctx.fillStyle = 'rgba(255,210,60,.35)'; ctx.fillRect(x - 7, y - 12, 14, 12); } if (!o.open) addLight(x, y - 8, o.gold ? 26 : 18, .35); return; }
  if (o.k === 'lever') { ctx.drawImage(SHEET, o.on ? 96 : 80, 208, 16, 16, x - 8, y - 14, 16, 16); if (G && G.spikeRush > 0) addLight(x, y - 8, 20, .5); return; }
  if (o.k === 'vein') {
    const M = MATS[o.mat]; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 9, 3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#4a4450'; ctx.fillRect(x - 8, y - 8, 16, 9); ctx.fillRect(x - 6, y - 11, 12, 3); ctx.fillStyle = '#5e5866'; ctx.fillRect(x - 7, y - 10, 10, 2); ctx.fillRect(x - 8, y - 6, 3, 2);
    ctx.fillStyle = M.c; ctx.fillRect(x - 4, y - 8, 2, 3); ctx.fillRect(x + 2, y - 6, 3, 2); ctx.fillRect(x - 1, y - 4, 2, 2); ctx.fillStyle = M.c2; ctx.fillRect(x - 4, y - 5, 2, 1); ctx.fillRect(x + 2, y - 4, 3, 1);
    if (Math.floor(T * 3 + o.x) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 8, 1, 1); }
    addLight(x, y - 6, 16, .35);
    if (o.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x - 8, y - 11, 16, 12); }
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x - 7, y, 14, 2);
  ctx.drawImage(SHEET, 288, 408, 16, 24, x - 8, y - 22, 16, 24);
  if (o.k === 'xcrate') { ctx.drawImage(SHEET, 288, 320, 16, 16, x - 6, y - 30, 12, 12); ctx.fillStyle = 'rgba(220,60,40,.35)'; ctx.fillRect(x - 7, y - 14, 14, 8); }
  if (o.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(x - 8, y - 22, 16, 24); }
}
function drawCorpse(c) {
  const [fx0, fy0, fw, fh] = c.fr, a = clamp(c.life / c.max, 0, 1);
  ctx.save(); ctx.translate(Math.round(c.x - CX), Math.round(c.y - CY - c.z)); ctx.globalAlpha = Math.min(1, a * 1.6);
  ctx.translate(0, -fh * c.sc / 2); ctx.rotate(c.rot * .3); ctx.scale(c.turn * c.sc, c.sc * (1 - (1 - a) * .3));
  SG.clearRect(0, 0, 64, 64); SG.drawImage(SHEET, fx0, fy0, fw, fh, 32 - fw / 2, 60 - fh, fw, fh);
  if (c.life > c.max - .08 || c.tint) { SG.globalCompositeOperation = 'source-atop'; SG.fillStyle = c.life > c.max - .08 ? '#fff' : c.tint; SG.fillRect(0, 0, 64, 64); SG.globalCompositeOperation = 'source-over'; }
  ctx.drawImage(SCR, -32, -60 + fh / 2); ctx.restore();
}
function drawGhost(g) {
  const strip = heroStrip().strip, sil = silCache(strip, g.col || '#8ee6ff');
  const a = g.life / g.max; ctx.save(); ctx.globalAlpha = a * .45; ctx.translate(Math.round(g.x - CX), Math.round(g.y - CY - g.z)); ctx.scale(g.turn, 1); ctx.drawImage(sil, g.fr * strip.w, 0, strip.w, strip.h, -strip.w / 2, -strip.h, strip.w, strip.h); ctx.restore();
}
function drawAlly(a) {
  const x = Math.round(a.x - CX), y = Math.round(a.y - CY);
  if (a.k === 'spirit') { const r = frameRect('angel', 'run', Math.floor(T * 10 + a.seed)); ctx.globalAlpha = .9; if (a.sk) ctx.drawImage(skSheet(r[0], r[1], 16, 16, a.sk, 20, true), x - 8, y - 16 - a.z); else ctx.drawImage(SHEET, r[0], r[1], 16, 16, x - 8, y - 16 - a.z, 16, 16); ctx.globalAlpha = 1; addLight(x, y - a.z - 8, 24, .7); return; }
  const strip = charStrip({ body: 'doc', at: 4, ht: 0, dye: 'schatten', hair: -1, skin: -1, accent: -1 }), sil = silCache(strip, a.sk ? a.sk.col : '#7a5ab8');
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y, 6, 2.5, 0, 0, 6.283); ctx.fill();
  const fi = a.moving ? 4 + Math.floor(a.phase * .6) % 4 : Math.floor(T * 6) % 4;
  ctx.save(); ctx.globalAlpha = .7 + .2 * Math.sin(T * 8 + a.seed); ctx.translate(x, y); ctx.scale(a.face, 1); ctx.drawImage(sil, fi * strip.w, 0, strip.w, strip.h, -strip.w / 2, -strip.h, strip.w, strip.h); ctx.restore();
}
function drawPoolFx() {
  for (const p of pools) {
    const x = p.x - CX, y = p.y - CY; if (x < -40 || x > VW + 40 || y < -30 || y > VH + 30) continue;
    const C = POOLCOL[p.k];
    for (let i = 0; i < 3; i++) { const a = T * (p.k === 'lava' ? 1.2 : .6) + i * 2.1 + p.x; ctx.fillStyle = C[2]; ctx.globalAlpha = .5 + .5 * Math.sin(a * 2); ctx.fillRect(Math.round(x + Math.cos(a) * p.rx * .55), Math.round(y + Math.sin(a * 1.3) * p.ry * .5), p.k === 'eis' ? 1 : 2, 1); }
    ctx.globalAlpha = 1;
    if (p.k === 'lava') addLight(x, y, p.rx * 1.4, .6); else if (p.k === 'gift') addLight(x, y, p.rx, .25);
  }
}
function drawTargetHints() {
  if (state !== 'play' || !G || G.type === 'versteck' || ctlSet().aim === false) return;
  if (P.manAim != null) { const a = P.manAim; ctx.fillStyle = 'rgba(255,240,190,.75)'; for (let k = 2; k < 8; k++) { const d = k * 5; ctx.fillRect(Math.round(P.x - CX + Math.cos(a) * d), Math.round(P.y - CY - 4 + Math.sin(a) * d * .7), k === 7 ? 3 : 2, k === 7 ? 3 : 2); } return; }
  const W = WT[P.gear.weapon.base], t = nearestEnemy(W.ranged ? 210 : P.st.range + 42); if (!t) return;
  const x = Math.round(t.x - CX), y = Math.round(t.y - CY), r = Math.round(t.r * t.sc) + 4 + Math.round(Math.sin(T * 8)), c = 'rgba(255,210,74,.85)';
  ctx.fillStyle = c; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillRect(x + sx * r - (sx > 0 ? 2 : 0), y + sy * Math.round(r * .45), 3, 1); ctx.fillRect(x + sx * r - (sx > 0 ? 0 : 0), y + sy * Math.round(r * .45) - (sy > 0 ? 1 : 0), 1, 2); }
}

/* ---------- Szene ---------- */
function render() {
  ctx.fillStyle = '#0c0a10'; ctx.fillRect(0, 0, VW, VH);
  if (!bg) return;
  LIGHTS = [];
  const camX = cam.x + shk.x, camY = cam.y + shk.y;
  CX = Math.floor(camX); CY = Math.floor(camY); SUBX = camX - CX; SUBY = camY - CY;
  ctx.drawImage(bg.c, -CX, -CY);
  const ff = Math.floor(T * 7) % 3;
  for (const f of bg.fountains) { const x = f.x - CX; if (x < -16 || x > VW) continue; const oy = f.red ? 16 : 48, by = f.red ? 32 : 64; ctx.drawImage(SHEET, 64 + ff * 16, oy, 16, 16, x, 16 - CY, 16, 16); ctx.drawImage(SHEET, 64 + ff * 16, by, 16, 16, x, 32 - CY, 16, 16); if (f.red) addLight(x + 8, 30 - CY, 34, .8); else addLight(x + 8, 30 - CY, 24, .4); }
  for (const tx of bg.torches) { const x = tx - CX; if (x < -30 || x > VW + 30) continue; const y = 22 - CY; ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 1, y, 3, 6); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 2, y - 1, 5, 2); const fl = Math.floor(T * 12 + tx) % 3; ctx.fillStyle = '#ff6a2a'; ctx.fillRect(x - 1, y - 4 - fl % 2, 3, 3 + fl % 2); ctx.fillStyle = '#ffd24a'; ctx.fillRect(x, y - 3, 1, 2); addLight(x, y - 2, 52, .9); }
  if (bg.banners) for (const b of bg.banners) { const x = b.x - CX; if (x < -16 || x > VW) continue; ctx.drawImage(SHEET, b.sx, b.sy, 16, 16, x, 16 - CY, 16, 16); }
  drawPoolFx();
  for (const s of spikes) { const x = s.x - CX, y = s.y - CY; if (x < -16 || x > VW || y < -16 || y > VH) continue; ctx.drawImage(SHEET, 16 + spikeFrame(s) * 16, 192, 16, 16, x, y, 16, 16); if (G && G.spikeRush > 0) { ctx.fillStyle = 'rgba(255,80,60,.15)'; ctx.fillRect(x, y, 16, 16); } }
  for (const h of hazards) {
    const x = h.x - CX, y = h.y - CY, a = clamp(h.life / h.max, 0, 1);
    if (h.k === 'gift') { ctx.globalAlpha = a * .8; ctx.fillStyle = '#3a6a1e'; ctx.beginPath(); ctx.ellipse(x, y, h.r, h.r * .5, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#79c24e'; ctx.beginPath(); ctx.ellipse(x - 1, y - 1, h.r * .7, h.r * .3, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#c8f06a'; const b = Math.floor(T * 4 + h.x) % 3; ctx.fillRect(Math.round(x - 3 + b * 3), Math.round(y - 1 - b % 2), 2, 2); ctx.globalAlpha = 1; addLight(x, y, h.r, .2 * a); continue; }
    const f = Math.floor(T * 12 + h.x) % 6; ctx.globalAlpha = a; drawFxFrame('fireball', f, x, y - 4, .7, -Math.PI / 2); ctx.globalAlpha = 1; addLight(x, y - 4, 14, .5 * a);
  }
  // t.sk / p.w.sk / f.sk / a.sk: Aussehen des Meisterschafts-Rangs, umgefärbte Bilder aus js/mastery.js (skFx, skSheet)
  for (const t of traps) { const x = Math.round(t.x - CX), y = Math.round(t.y - CY), sx = 288 + (t.armT > 0 ? 0 : (Math.floor(T * 6) % 2 ? 16 : 32)); if (t.sk) ctx.drawImage(skSheet(sx, 320, 16, 16, t.sk, 20), x - 6, y - 10, 12, 12); else ctx.drawImage(SHEET, sx, 320, 16, 16, x - 6, y - 10, 12, 12); ctx.strokeStyle = t.sk ? 'rgba(' + t.sk.glow + ',.5)' : 'rgba(255,120,60,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 14, 7, 0, 0, 6.283); ctx.stroke(); }
  for (const e of enemies) {
    if (e.st !== 'wind') continue; const p = clamp(1 - e.stT / e.windDur, 0, 1);
    if (e.ai === 'slam') { const R = e.r * e.sc, fx0 = e.x + Math.cos(e.aim) * R * .8 - CX, fy0 = e.y + Math.sin(e.aim) * R * .8 - CY, rad = 34 * e.sc; ctx.fillStyle = 'rgba(220,60,50,.25)'; ctx.beginPath(); ctx.ellipse(fx0, fy0, rad * p, rad * p * .5, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(255,120,90,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(fx0, fy0, rad, rad * .5, 0, 0, 6.283); ctx.stroke(); }
    else if (e.ai === 'charge' && e.mode === 'charge') { ctx.save(); ctx.translate(e.x - CX, e.y - CY); ctx.rotate(Math.atan2(e.ldy, e.ldx)); ctx.fillStyle = `rgba(220,60,50,${.12 + .25 * p})`; ctx.fillRect(0, -5, 170, 10); ctx.restore(); }
    else if (e.ai === 'archer' && e.lock != null) { ctx.save(); ctx.translate(e.x - CX, e.y - CY - 4); ctx.rotate(e.lock); ctx.fillStyle = `rgba(255,90,60,${.15 + .4 * p})`; for (let k = 10; k < 150; k += 6) ctx.fillRect(k, -1, 3, 1); ctx.restore(); }
    else if (e.ai === 'dragon' && e.mode === 'stomp') { ctx.fillStyle = 'rgba(255,120,40,.25)'; ctx.beginPath(); ctx.ellipse(e.x - CX, e.y - CY, 54 * p, 27 * p, 0, 0, 6.283); ctx.fill(); }
  }
  for (const p of projs) { if (p.k === 'bomb' || p.k === 'flask') { ctx.fillStyle = p.k === 'flask' ? 'rgba(120,200,60,.3)' : 'rgba(220,60,50,.3)'; ctx.beginPath(); ctx.ellipse(p.tx - CX, p.ty - CY, p.k === 'flask' ? 16 : 30, p.k === 'flask' ? 8 : 15, 0, 0, 6.283); ctx.fill(); } if (p.k === 'meteor' && p.delay <= 0) { const k = 1 - p.h / 140; ctx.fillStyle = `rgba(${p.w && p.w.sk ? p.w.sk.glow : '255,90,40'},${.15 + .25 * k})`; ctx.beginPath(); ctx.ellipse(p.x - CX, p.y - CY, 30 * k + 4, 15 * k + 2, 0, 0, 6.283); ctx.fill(); } }
  for (const f of fx) { if (f.k === 'portal') { const a = f.life / f.max; ctx.strokeStyle = `rgba(180,120,255,${a})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(f.x - CX, f.y - CY, 10 * (1.2 - a) + 2, 4 * (1.2 - a) + 1, 0, 0, 6.283); ctx.stroke(); } if (f.k === 'warn') { const a = 1 - f.life / f.max; ctx.fillStyle = `rgba(255,80,40,${.15 + .25 * a})`; ctx.beginPath(); ctx.ellipse(f.x - CX, f.y - CY, f.r * a, f.r * a * .5, 0, 0, 6.283); ctx.fill(); } }
  for (const c of corpses) if (c.z <= 0) drawCorpse(c);
  drawTargetHints();
  for (const c of pickups) {
    const x = Math.round(c.x - CX), y = Math.round(c.y - CY); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 2, y, 4, 1); const z = Math.round(c.z + Math.sin(c.t * 5) + 2);
    if (c.k === 'coin') ctx.drawImage(SHEET, 289 + (Math.floor(c.t * 10) % 4) * 8, 385, 6, 7, x - 3, y - z - 6, 6, 7);
    else if (c.k === 'heart') ctx.drawImage(SHEET, 289, 370, 13, 12, x - 6, y - z - 11, 13, 12);
    else if (c.k === 'flask') ctx.drawImage(SHEET, 288, 352, 16, 16, x - 8, y - z - 14, 16, 16);
    else if (c.k === 'mat') { ctx.drawImage(matCanvas(c.m), x - 6, y - z - 11); }
    else if (c.k === 'gem') { const [id, gr] = c.g.split(':'); ctx.drawImage(gemCanvas(id, +gr), x - 5, y - z - 10); addLight(x, y - 8, 14, .6); }
    else if (c.k === 'loot') { const col = RAR[c.it.rar].c, [r, g, b] = hexRgb(col), hh = c.it.rar >= 4 ? 90 : 60; const gr = ctx.createLinearGradient(0, y - hh, 0, y); gr.addColorStop(0, `rgba(${r},${g},${b},0)`); gr.addColorStop(1, `rgba(${r},${g},${b},.55)`); ctx.fillStyle = gr; ctx.fillRect(x - 3, y - hh, 6, hh); ctx.fillRect(x - 1, y - hh - 10, 2, hh + 10); if (c.it.slot === 'weapon') drawWeapon(weaponArt(c.it), x, y - z - 4, -.8, 1); else { const a = armorArt(c.it, P.cls); ctx.drawImage(a, x - a.width / 2, y - z - a.height + 2); } addLight(x, y - 10, c.it.rar >= 4 ? 44 : 30, .8); }
  }
  const list = []; for (const e of enemies) list.push({ y: e.y, e }); for (const o of obs) if (!o.dead) list.push({ y: o.y, o });
  for (const c of corpses) if (c.z > 0) list.push({ y: c.y, c });
  for (const a of allies) list.push({ y: a.y, a });
  if (state !== 'dead' || deadT > 1.4) list.push({ y: P.y, p: true });
  hook('draw', list);
  list.sort((a, b) => a.y - b.y);
  for (const g of ghosts) drawGhost(g);
  for (const it of list) { if (it.p) drawPlayer(); else if (it.e) drawEnemy(it.e); else if (it.o) drawObs(it.o); else if (it.a) drawAlly(it.a); else if (it.draw) it.draw(); else drawCorpse(it.c); }
  for (const p of projs) {
    if (p.delay > 0) continue;
    const x = p.x - CX, y = p.y - CY - p.h;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.round(p.x - CX) - 1, Math.round(p.y - CY), 3, 1);
    const ang = Math.atan2(p.vy, p.vx), fr = Math.floor(T * 14 + p.x * .1), sk = p.w && p.w.sk;
    if (p.k === 'arrow') { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(ang + Math.PI / 2); if (sk) { ctx.scale(sk.sc, sk.sc); ctx.drawImage(skSheet(324, 202, 7, 21, sk, 0), -3, -12); } else ctx.drawImage(SHEET, 324, 202, 7, 21, -3, -12, 7, 21); if (p.from === 'e') { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,80,60,.35)'; ctx.fillRect(-3, -12, 7, 21); ctx.globalCompositeOperation = 'source-over'; } ctx.restore(); }
    else if (p.k === 'knife') { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(T * 20); if (sk) { ctx.scale(sk.sc, sk.sc); ctx.drawImage(skSheet(293, 10, 6, 13, sk, 180), -3, -6); } else ctx.drawImage(SHEET, 293, 10, 6, 13, -3, -6, 6, 13); ctx.restore(); }
    else if (p.k === 'flask') { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(T * 12); ctx.drawImage(SHEET, 320, 336, 16, 16, -8, -8, 16, 16); ctx.restore(); }
    else if (p.fxn) { drawFxFrame(p.fxn, fr, x, y, (p.k === 'fireball' ? 1 : p.k === 'meteor' ? 1.5 : .85) * (sk ? sk.sc : 1), p.k === 'meteor' ? Math.PI / 2 : (p.fxn.endsWith('orb') ? 0 : ang), false, sk && skFx(p.fxn, sk)); addLight(x, y, p.k === 'fireball' || p.k === 'meteor' ? 28 : 18, .7); }
    else if (p.k === 'rock') { ctx.fillStyle = '#6a5e52'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); ctx.fillStyle = '#8a7e70'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 2, 1); }
    else if (p.k === 'bomb') { const f = p.t < p.dur ? 0 : (p.fuse < .25 ? 2 : 1); ctx.drawImage(SHEET, 288 + f * 16, 320, 16, 16, Math.round(x) - 8, Math.round(y) - 12, 16, 16); if (p.t >= p.dur && Math.floor(T * 12) % 2) { ctx.fillStyle = 'rgba(255,60,40,.4)'; ctx.fillRect(Math.round(x) - 5, Math.round(y) - 8, 10, 9); } addLight(x, y - 8, 14, .5); }
    else { const f = p.life / p.max, s = Math.round(lerp(7, 2, f)); ctx.fillStyle = f > .6 ? '#fff0a0' : f > .3 ? '#ffb03a' : '#d8402a'; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); addLight(x, y, 18, .6); }
  }
  for (const r of rings) { ctx.strokeStyle = r.col; ctx.globalAlpha = clamp(r.life / r.max2, 0, 1); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(r.x - CX, r.y - CY, r.r, r.r * .5, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  for (const p of parts) { if (p.glow) continue; const a = clamp(p.life / (p.max * .4), 0, 1); ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x - CX), Math.round(p.y - CY - p.z), p.s, p.s); }
  ctx.globalAlpha = 1;
  for (const f of fx) {
    if (f.k === 'slash') { const m = FX.slash, p = 1 - f.life / f.max, fr = Math.min(m[4] - 1, Math.floor(p * m[4])); const img = tintedFx('slash', f.col); ctx.globalAlpha = .9; drawFxFrame('slash', fr, f.x - CX + Math.cos(f.ang) * 10, f.y - CY + Math.sin(f.ang) * 6, f.sc, f.ang, f.flip, img); ctx.globalAlpha = 1; }
    if (f.k === 'anim' && !f.add) { const m = FX[f.name], p = 1 - f.life / f.max, fr = Math.min(m[4] - 1, Math.floor(p * m[4])); ctx.globalAlpha = f.alpha; drawFxFrame(f.name, fr, f.x - CX, f.y - CY, f.sc, f.rot, false, f.sk && skFx(f.name, f.sk)); ctx.globalAlpha = 1; }
  }
  addLight(P.x - CX, P.y - CY - 12, (P.leap ? 90 : 84) * (G && G.dark ? .55 : 1), 1);
  for (const f of fx) { if (f.k === 'boom') addLight(f.x - CX, f.y - CY, f.r * 2.2 * (f.life / f.max) + 20, 1); if (f.k === 'pillar') addLight(f.x - CX, f.y - CY - 20, 60, f.life); if (f.k === 'zap') for (const [zx, zy] of f.pts) addLight(zx - CX, zy - CY, 30, f.life / f.max); if (f.k === 'anim' && f.add) addLight(f.x - CX, f.y - CY, 30 * f.sc, f.life / f.max); }
  const dk = Math.max(bg.b.dark, (G && G.dark) || 0) * (state === 'title' ? .8 : 1);
  if (dk > 0) {
    const g = dark.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, VW, VH); g.fillStyle = `rgba(6,4,12,${dk})`; g.fillRect(0, 0, VW, VH); g.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, a] of LIGHTS) { if (x < -r || x > VW + r || y < -r || y > VH + r) continue; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    ctx.drawImage(dark, 0, 0);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const tx of bg.torches) { const x = tx - CX; if (x < -40 || x > VW + 40) continue; glow(x, 20 - CY, 26 * (1 + Math.sin(T * 9 + tx) * .08), '255,150,60', .22); }
  for (const f of bg.fountains) if (f.red) { const x = f.x + 8 - CX; if (x > -30 && x < VW + 30) glow(x, 32 - CY, 24, '255,100,40', .25); }
  for (const p of projs) { if (p.delay > 0) continue; const x = p.x - CX, y = p.y - CY - p.h, sk = p.w && p.w.sk; if (sk) { const big = p.k === 'fireball' || p.k === 'meteor', small = p.k === 'arrow' || p.k === 'knife'; skGlow(sk, x, y, (big ? 16 : small ? 4 + sk.r * .8 : 10) * Math.sqrt(sk.sc), (small ? .1 + sk.r * .04 : .38) * (sk.gold ? .75 : 1)); } else if (p.k === 'orb' || p.k === 'bolt' || p.k === 'plant') glow(x, y, 10, p.fxn === 'plant' ? '120,230,120' : p.fxn === 'waterorb' || p.fxn === 'waterbolt' ? '140,200,255' : '190,110,255', .45); else if (p.k === 'fire' || p.k === 'fireball' || p.k === 'meteor') glow(x, y, p.k === 'fire' ? 11 : 18, '255,120,40', .45); }
  for (const f of fx) {
    if (f.k === 'boom') { const a = f.life / f.max, x = f.x - CX, y = f.y - CY; glow(x, y - 6, f.r * (1.5 - a * .5), f.sk ? f.sk.glow : '255,170,60', a * .8); }
    else if (f.k === 'pillar') { const a = f.life / f.max, x = f.x - CX, y = f.y - CY; const gr = ctx.createLinearGradient(0, y - 120, 0, y); gr.addColorStop(0, 'rgba(255,210,80,0)'); gr.addColorStop(1, `rgba(255,210,80,${.5 * a})`); ctx.fillStyle = gr; ctx.fillRect(x - 8, y - 120, 16, 120); }
    else if (f.k === 'anim' && f.add) { const m = FX[f.name], p = 1 - f.life / f.max, fr = Math.min(m[4] - 1, Math.floor(p * m[4])); ctx.globalAlpha = f.alpha; drawFxFrame(f.name, fr, f.x - CX, f.y - CY, f.sc, f.rot, false, f.sk && skFx(f.name, f.sk)); ctx.globalAlpha = 1; }
    else if (f.k === 'zap') { const a = f.life / f.max; ctx.strokeStyle = `rgba(${f.sk ? f.sk.glow : '170,230,255'},${a})`; ctx.lineWidth = f.sk && f.sk.r >= 3 ? 3 : 2; ctx.beginPath(); for (let i = 0; i < f.pts.length - 1; i++) { const [x1, y1] = f.pts[i], [x2, y2] = f.pts[i + 1]; ctx.moveTo(x1 - CX, y1 - CY); for (let k = 1; k < 5; k++) { const t = k / 5; ctx.lineTo(lerp(x1, x2, t) - CX + rnd(-4, 4), lerp(y1, y2, t) - CY + rnd(-4, 4)); } ctx.lineTo(x2 - CX, y2 - CY); } ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1; ctx.stroke(); }
    else if (f.k === 'shard') { const p = 1 - f.life / f.max, D = f.d || 70, x = f.x - CX + Math.cos(f.ang) * D * p, y = f.y - CY + Math.sin(f.ang) * D * .5 * p - 6; ctx.globalAlpha = 1 - p; drawFxFrame('icelance', 1, x, y, .8 * (f.sk ? f.sk.sc : 1), f.ang, false, f.sk && skFx('icelance', f.sk)); ctx.globalAlpha = 1; }
  }
  for (const p of parts) { if (!p.glow) continue; let a = clamp(p.life / (p.max * .4), 0, 1); if (p.blink) a *= .5 + .5 * Math.sin(T * 8 + p.x); ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x - CX), Math.round(p.y - CY - p.z), p.s, p.s); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  for (const f of fx) if (f.k === 'spark') { const a = f.life / f.max, x = f.x - CX, y = f.y - CY, l = (1 - a) * 10 + 3; ctx.strokeStyle = f.col; ctx.globalAlpha = a; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 4; i++) { const an = f.ang + i * Math.PI / 2 + .4; ctx.moveTo(x + Math.cos(an) * 2, y + Math.sin(an) * 2); ctx.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); } ctx.stroke(); ctx.globalAlpha = 1; }
  for (const t of texts) { const age = T - t.born, s = t.big && age < .12 ? (VW < 260 ? 12 : 16) : 8; ctx.globalAlpha = clamp(t.life / .3, 0, 1); ptext(t.s, t.x - CX, t.y - CY, t.col, s); }
  ctx.globalAlpha = 1;
  if (G && G.type === 'versteck' && G.near && state === 'play') { const o = G.near, lbl = o.label || ''; ptext(lbl, o.x - CX, o.y - CY - (o.k === 'npc' ? 34 : 44), '#ffd24a', 6); if (!isTouch) ptext('[E]', o.x - CX, o.y - CY - (o.k === 'npc' ? 26 : 36), '#efe2bf', 6); }
  hook('postRender'); // Bildschirm-Überlagerungen eigener Systeme (z. B. Nebel der Freiwelt), unter Vignette und Blitz
  if (vig) ctx.drawImage(vig, 0, 0);
  if (flash.a > 0 && !SAVE.meta.settings.calm) { ctx.fillStyle = `rgba(${flash.c},${flash.a * .45})`; ctx.fillRect(0, 0, VW, VH); }
}
const MATC = {}, GEMC = {};
function matCanvas(k) { return MATC[k] || (MATC[k] = matIcon(k)); }
function gemCanvas(id, gr) { const k = id + gr; return GEMC[k] || (GEMC[k] = gemIcon(id, gr)); }
