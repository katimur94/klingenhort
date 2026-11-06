'use strict';
/* =========================================================
   KLINGENHORT – Sturmgipfel (6.5): Gewitter in Akt 9, Blitze des Sturmkönigs Aerok
   Hängt sich über HOOK (js/core.js) ein:
   - Im Gebiet „Sturmgipfel“ (Biom 'sturm') schlagen im Kampf Blitze ein. Jeder Einschlag wird angekündigt
     (leuchtender Kreis am Boden, knistert), dann trifft er alle im Kreis – dich und die Gegner. Gegner hineinlocken lohnt sich.
   - Regen und Wetterleuchten über dem ganzen Bild.
   - Sturmkönig Aerok ruft selbst Blitze: drei rund um dich, unter 50 % Leben fünf und schneller.
   SKY.strikes = [{ x, y, t, max, r, dmg, edmg }] · SKY.bolts = Blitze, die gerade sichtbar sind (nur Grafik)
   ========================================================= */

const SKY = { strikes: [], bolts: [], t: 3, glow: 0, drops: null };
const STURM_WARN = 1.05;   // Sekunden zwischen Ankündigung und Einschlag

function sturmOn() { return !!(G && P && G.type && G.type !== 'versteck' && G.type !== 'lande' && G.type !== 'bossarena' && !G.daily && biomeOf(P.act).key === 'sturm'); }
// Schaden eines Einschlags: wächst mit der Stufe wie Gegnerschaden
function sturmDmg(k) { return 13 * scaleOf(stageNum()).am * (k || 1); }

function sturmStrike(x, y, o) {
  o = o || {};
  x = clamp(x, BD.x0 + 8, BD.x1 - 8); y = clamp(y, BD.y0 + 6, BD.y1 - 4);
  const t = o.t || STURM_WARN;
  SKY.strikes.push({ x, y, t, max: t, r: o.r || 17, dmg: o.dmg || sturmDmg(), edmg: o.edmg == null ? sturmDmg(2.4) : o.edmg });
}

function sturmHit(s) {
  // Blitz von oben: ein paar Zacken, kurz sichtbar
  const pts = []; let x = s.x;
  for (let i = 0; i <= 8; i++) { pts.push([x, s.y - 150 + i * 150 / 8]); x += rnd(-7, 7); }
  pts[pts.length - 1] = [s.x, s.y];
  SKY.bolts.push({ pts, life: .2, max: .2, x: s.x, y: s.y });
  SKY.glow = Math.max(SKY.glow, .5);
  rings.push({ x: s.x, y: s.y, r: 3, max: s.r + 6, life: .3, max2: .3, col: '#bfefff' });
  burst(s.x, s.y, 4, '#e8f8ff', 12, 110, 1); burst(s.x, s.y, 4, '#8ee6ff', 8, 70, 1);
  scorch(s.x, s.y, 7); shake(4); sfx('zap');
  if (Math.hypot(P.x - s.x, P.y - s.y) < 70 && typeof buzz === 'function') buzz(30);
  flash = { a: Math.max(flash.a || 0, .4), c: '200,230,255' };
  if (state === 'play' && P.hp > 0 && Math.hypot(P.x - s.x, P.y - s.y) < s.r + P.r) hurtPlayer(s.dmg, { x: s.x, y: s.y, t: 'sturmrufer' });
  for (const e of enemies) if (!e.dead && e.t !== 'aerok' && Math.hypot(e.x - s.x, e.y - s.y) < s.r + e.r * e.sc) { const d = Math.hypot(e.x - s.x, e.y - s.y) || 1; hurtEnemy(e, s.edmg, (e.x - s.x) / d, (e.y - s.y) / d, 60, false, true); }
}

function sturmUpd(dt) {
  if (!G) return;
  for (const s of SKY.strikes) { s.t -= dt; if (Math.random() < .3) part(s.x + rnd(-s.r, s.r), s.y + rnd(-s.r * .5, s.r * .5), 0, 0, 0, rnd(20, 40), Math.random() < .5 ? '#e8f8ff' : '#8ee6ff', .25, 1, 0, 1); }
  for (const s of SKY.strikes) if (s.t <= 0) sturmHit(s);
  SKY.strikes = SKY.strikes.filter(s => s.t > 0);
  for (const b of SKY.bolts) b.life -= dt;
  SKY.bolts = SKY.bolts.filter(b => b.life > 0);
  SKY.glow = Math.max(0, SKY.glow - dt * 2.5);
  if (!sturmOn() || state !== 'play' || G.phase === 'done') return;
  // Wetterleuchten ab und zu
  if (Math.random() < dt * .12) SKY.glow = Math.max(SKY.glow, .25);
  // Gewitter: nur solange gekämpft wird
  if (!enemies.some(e => !e.dead && e.st !== 'spawn')) return;
  SKY.t -= dt;
  if (SKY.t <= 0) {
    SKY.t = rnd(2.6, 4.2);
    const n = G.stage >= 60 ? 2 : 1;
    for (let i = 0; i < n; i++) { const on = i === 0 && Math.random() < .35; sturmStrike(on ? P.x : P.x + rnd(-60, 60), on ? P.y : P.y + rnd(-40, 40)); }
  }
}

// Aerok: Blitzrufe rund um den Helden
function sturmBoss(e, dt) {
  if (e.t !== 'aerok' || !e.boss || e.dead || e.st === 'spawn' || state !== 'play') return;
  if (e.stormT == null) e.stormT = 2.5;
  e.stormT -= dt;
  if (e.stormT > 0) return;
  const rage = e.hp < e.maxHp * .5, n = rage ? 5 : 3;
  e.stormT = rage ? 3.2 : 4.5;
  sturmStrike(P.x, P.y, { dmg: e.atk * .9, edmg: 0 });
  for (let i = 1; i < n; i++) { const a = i / (n - 1) * 6.283 + rnd(0, 1); sturmStrike(P.x + Math.cos(a) * rnd(30, 50), P.y + Math.sin(a) * rnd(20, 34), { dmg: e.atk * .9, edmg: 0, t: STURM_WARN + i * .12 }); }
  burst(e.x, e.y - 20, 4, '#8ee6ff', 10, 60, 1); sfx('cast');
}

function sturmDraw() {
  if (!G) return;
  // Ankündigung: Kreis am Boden, wird heller und enger, kurz vor dem Einschlag weiß
  for (const s of SKY.strikes) {
    const k = 1 - s.t / s.max, x = s.x - CX, y = s.y - CY, rr = s.r * (1.25 - .25 * k);
    ctx.globalAlpha = .18 + .3 * k; ctx.fillStyle = k > .82 ? '#ffffff' : '#8ee6ff';
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .55, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = .55 + .45 * k * (.6 + .4 * Math.sin(T * 30)); ctx.strokeStyle = k > .82 ? '#ffffff' : '#bfefff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .55, 0, 0, 7); ctx.stroke();
  }
  // Blitze
  for (const b of SKY.bolts) {
    const a = b.life / b.max;
    for (const [w, col, al] of [[3, '#8ee6ff', .5], [1, '#ffffff', 1]]) {
      ctx.globalAlpha = a * al; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      b.pts.forEach(([px_, py_], i) => { const X = px_ - CX, Y = py_ - CY; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  if (!sturmOn()) return;
  // Regen: schräge Striche über das ganze Bild
  if (!SKY.drops) { SKY.drops = []; for (let i = 0; i < 70; i++) SKY.drops.push([Math.random(), Math.random(), .6 + Math.random() * .6]); }
  ctx.strokeStyle = '#bcd4ee'; ctx.globalAlpha = .35;
  ctx.beginPath();
  for (const d of SKY.drops) {
    const x = ((d[0] * (VW + 40) - T * 60 * d[2]) % (VW + 40) + VW + 40) % (VW + 40) - 20, y = ((d[1] * (VH + 40) + T * 240 * d[2]) % (VH + 40)) - 20;
    ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 8);
  }
  ctx.stroke();
  // Wetterleuchten
  if (SKY.glow > 0 && !SAVE.meta.settings.calm) { ctx.globalAlpha = SKY.glow * .35; ctx.fillStyle = '#c8dcff'; ctx.fillRect(0, 0, VW, VH); }
  ctx.globalAlpha = 1;
}

HOOK.update.push(dt => { try { sturmUpd(dt); } catch (e) { SKY.strikes.length = 0; } });
HOOK.enemyUpd.push((e, dt) => sturmBoss(e, dt));
HOOK.postRender.push(() => { try { sturmDraw(); } catch (e) { ctx.globalAlpha = 1; } });
HOOK.room.push(() => { SKY.strikes.length = 0; SKY.bolts.length = 0; SKY.t = 2.5; SKY.glow = 0; });

/* Alte Spielstände: Vor 6.5 begann die Qual mit Akt 9. Jetzt ist Akt 9 der Sturmgipfel und die Qual beginnt mit Akt 10.
   Helden, die schon in der Qual waren, rücken einen Akt weiter – ihre Qual-Stufe bleibt gleich. st9 = schon umgestellt. */
if (!PERSIST.includes('st9')) PERSIST.push('st9');
HOOK.activate.push(P => {
  if (P.st9) return;
  P.st9 = 1;
  if (P.act >= 9) { P.act++; P.map = null; }
  if (P.maxAct >= 9) P.maxAct++;
  if (P.stats && P.stats.maxAct >= 9) P.stats.maxAct++;
});
