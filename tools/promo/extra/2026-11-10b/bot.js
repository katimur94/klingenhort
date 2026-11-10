// Aufbau + Spiel-Bot für den Clip „Boss mit letzter Kraft“ (läuft im Browser, per ev() eingesetzt)
// Echter Übungskampf aus dem Boss-Kodex (bossArena): keine Unverwundbarkeit, keine Tränke, echter Schaden auf beiden Seiten.
// Der Bot spielt wie ein Spieler: raus aus den Warnflächen (laufen, im Notfall rollen), durch Schockwellen rollen, sonst an den Boss und zuschlagen.
// Begleiter: Jungdrache LV 150 mit allen Talenten – die Krönung „Lebensbund“ heilt 35 %, wenn ein Treffer den Helden unter 30 % bringt (alle 90 s).
module.exports = () => {
  window.__setup = (seed, o) => {
    __seed(seed); window.__txtNo = /SCHWÄCHE|RESIST/; window.__txtOK = /LEBENSBUND|SCHILD|AUSGEWICHEN|^-\d+$|^\+\d+$/;
    const M = petM(); M.list.length = 0; M.act = null;
    const p = petGive('jungdrache', { lv: 150, gn: [80, 80, 80, 80, 80] }); p.nw = 0; p.au = 'ewig'; p.ti = 'ewig';
    const tl = []; PET_TAL.forEach((B, bi) => B.nodes.forEach((N, ni) => { tl[petTalIdx(bi, ni)] = N.max; })); p.tl = tl.join('');
    activateChar(0); P.lv = o.lv || 100; P.potions = 0; M.act = p.id; computeStats();
    bossArena(o.id); P.potions = 0; petPlace(false); PET_RT.bondT = 0; __vp(o.zoom || 2.8); window.__camDX = 0; window.__camDY = -14;
    __step(o.pre == null ? 75 : o.pre); P.hp = P.st.hp; __snap();
    window.__log = []; window.__bo = o; window.__bond = 0; window.__pet = p;
  };
  // Gefahr an einem Punkt: 0 = keine, sonst Dringlichkeit (kleiner = eher)
  window.__danger = (x, y, react) => {
    let best = 9;
    const R = P.r + 4;
    for (const z of BZ.fx) {
      if (!(z.dmg > 0)) continue;
      let hit = false, t = z.t > 0 ? z.t : 0;
      if (z.k === 'c') { if (z.fol > 0) continue; const dx = x - z.x, dy = (y - z.y) * 2, r = z.r + R; hit = dx * dx + dy * dy < r * r; }
      else if (z.k === 'l') { const c = Math.cos(z.a), s = Math.sin(z.a), dx = x - z.x, dy = y - z.y, u = dx * c + dy * s, tt = Math.max(z.l0 || 0, Math.min(z.len, u)); hit = Math.hypot(dx - c * tt, dy - s * tt) < z.w / 2 + R && u >= (z.l0 || 0) - R && u <= z.len + R; if (z.travel && z.front > u + 8) hit = false; }
      else if (z.k === 'v') { const dx = x - z.x, dy = y - z.y; hit = Math.hypot(dx, dy) < z.r + R && Math.abs(angDiff(Math.atan2(dy, dx), z.a)) < z.arc / 2 + .2; }
      else if (z.k === 'q') { hit = x > z.x0 - R && x < z.x1 + R && y > z.y0 - R && y < z.y1 + R; }
      else continue;
      if (hit && t < react) best = Math.min(best, t);
    }
    return best < 9 ? best + .001 : 0;
  };
  window.__bot = i => {
    const o = window.__bo, B = enemies.find(e => e.boss && !e.dead);
    keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = false; keys.KeyJ = false;
    if (PET_RT.bondT > T && !window.__bond) window.__bond = i;
    window.__log.push({ i, hp: Math.max(0, P.hp) / P.st.hp, b: B ? B.hp / B.maxHp : 0, st: state, bond: window.__bond });
    if (state !== 'play' || P.hp <= 0) return;
    const go = (dx, dy) => { if (dx > .3) keys.KeyD = true; if (dx < -.3) keys.KeyA = true; if (dy > .3) keys.KeyS = true; if (dy < -.3) keys.KeyW = true; };
    // Schockwelle kommt: hindurchrollen (zur Mitte der Welle)
    for (const z of BZ.fx) if (z.k === 'w' && !z.hit && z.dmg > 0) {
      const de = Math.hypot(P.x - z.x, (P.y - z.y) * 2), gap = de - z.r;
      if (gap > 0 && gap < z.band + P.r + z.sp * .12 && P.roll <= 0 && !(P.rollCd > 0)) { const n = Math.hypot(z.x - P.x, z.y - P.y) || 1; go((z.x - P.x) / n, (z.y - P.y) / n); doRoll(); return; }
    }
    // wie ein Spieler: erst riskant (spätes Ausweichen), mit wenig Leben hochkonzentriert
    const react = o.sloppy != null ? (P.hp < P.st.hp * (o.thr || .16) ? (o.careful || 1.3) : o.sloppy) : o.react;
    const dg = __danger(P.x, P.y, react);
    if (dg) {
      let best = null, bd = 1e9;
      for (let k = 0; k < 16; k++) for (const d of [16, 30, 46, 64]) {
        const a = k / 16 * 6.283, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d * .7;
        if (x < BD.x0 + 10 || x > BD.x1 - 10 || y < BD.y0 + 8 || y > BD.y1 - 6 || __danger(x, y, 9)) continue;
        const c = d + (B ? Math.hypot(B.x - x, B.y - y) * .15 : 0); if (c < bd) { bd = c; best = [Math.cos(a), Math.sin(a), d]; }
      }
      if (best) { go(best[0], best[1]); if (dg < o.roll && best[2] > 20 && P.roll <= 0 && !(P.rollCd > 0)) doRoll(); }
      return;
    }
    if (!B) return;
    const dx = B.x - P.x, dy = B.y - P.y, d = Math.hypot(dx, dy), reach = 22 + B.r * (B.sc || 1);
    if (d > reach && !__danger(P.x + dx / d * 14, P.y + dy / d * 14, react)) go(dx / d, dy / d);
    keys.KeyJ = d < reach + 22;
    if (d < reach + 26) for (let k = 0; k < 3; k++) if (P.cds[k] <= 0 && Math.random() < .08) useSkill(k);
    if (P.rage >= 100 && d < reach + 30 && B.hp < B.maxHp * (o.ult || 1)) doUlt();
  };
  // passende Bosse: nur Mechaniken, denen der Bot sichtbar ausweichen kann
  window.__cands = (lo, hi) => {
    const OK = new Set(['nova', 'meteor', 'wave', 'charge', 'mark', 'cone', 'leap', 'cross', 'quake', 'firewall', 'enrage', 'phase']), r = [];
    for (let id = lo; id < hi; id++) { const B = bossDef(id); if (B.mech.length >= 2 && B.mech.every(k => OK.has(k))) r.push({ id, m: B.mech, name: B.name, body: B.body || B.type, aff: B.aff }); }
    return r;
  };
};
