// Krieg der Kronen 1 – Die Front (6.6): Kriegsgebiete, zwei Heere, Beschuss, Deckung, Schlacht-Ziele, Chronik.
// Kapitel 2 – Fünf Kronen (6.8): Nordmark und Sylvara an der Front, Fronten je Kriegsgebiet, Balliste (Bolzen), Kriegsruf-Verlust beim Gegner,
// Vorteile der Ränge, Chronik Akt 1 (Kapitel nach Siegen), Hauptleute der neuen Reiche.
// Prüft die Regeln: Daten der fünf Reiche, Kriegsgebiete auf der Karte (ab Akt 3, verschieben nichts), Spielstand (Standard, Reparatur, alter Stand),
// Aufbau der Schlacht, Obergrenze der Soldaten, Heere kämpfen ohne den Helden, Fairness des Beschusses (nie Schaden ohne mindestens
// KR_WARN_MIN Sekunden Ankündigung, Treffer nur in der gezeichneten Fläche), Deckung, Maschinen (zerstören, erobern, bewacht),
// alle vier Ziele gewinnbar und verlierbar, Lohn, Kriegskasse, Aufträge, Kriegs-Biome der Lande, Bildzeit bei voller Schlacht.
// Dazu der getippte Ablauf (Handy hoch und quer, PC): Karte → Prolog → Seite wählen → Schlacht → Ergebnis → Chronik, mit Bildschirmfotos.
// Zufall: jede Simulation läuft mit festem Samen (Math.random = mulberry(n)), nichts hängt vom Glück ab.
// Aufruf: node krieg.js [ausgabeordner]   (BASE = Adresse des Spiels)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/klingenhort-test/krieg';
const BASE = (process.env.BASE || 'http://localhost:8777/').replace(/\/?$/, '/');
const fails = [], ok = (c, msg) => { if (!c) fails.push(msg); console.log((c ? '  ok   ' : '  FAIL ') + msg); };

// Held in Akt 3 mit brauchbarer Ausrüstung; Erfolge schon vergeben (zahlen sonst Gold zwischendurch)
const HERO = (act, lv) => {
  localStorage.clear(); loadAll();
  const c = newChar('knight', 'Söldner', 'normal', false); c.lv = lv || 16; c.act = act || 3; c.maxAct = c.act; c.st9 = 1; c.story = {}; for (let i = 1; i <= 12; i++) c.story['a' + i] = 1;
  SAVE.chars.push(c); activateChar(0); SAVE.meta.hide.intro = true; for (const a of ACH) SAVE.meta.ach[a.id] = 1;
  P.gear.weapon = makeItem({ slot: 'weapon', base: CLASSES[P.cls].start, tier: 2, rar: 3 }); P.gear.armor = makeItem({ slot: 'armor', base: 'armor', tier: 2, rar: 2 });
  computeStats(); P.hp = P.st.hp; P.map = genMap(P.act); saveChar();
};
// Hilfen im Spiel: Schlacht starten (auf einem Kriegsgebiet der Karte), ruhig stellen, Schritte rechnen
const TOOLS = () => {
  window.R0 = window.R0 || Math.random;
  window.seed = n => { Math.random = mulberry(n); };
  window.unseed = () => { Math.random = R0; };
  // Held auf den Ort vor einem Kriegsgebiet stellen → [reihe, index]
  window.vorKrieg = () => { const M = P.map; for (let r = 1; r < 6; r++) for (let i = 0; i < M.rows[r].length; i++) if (M.rows[r][i].t === 'krieg' && !M.rows[r][i].done) { const j = M.rows[r - 1].findIndex(n => n.links.includes(i)); M.rows.forEach((row, rr) => row.forEach(n => { if (rr < r) n.done = true; })); M.pos = { r: r - 1, i: j }; return [r, i]; } return null; };
  window.schlacht = (ziel, seite) => { const k = vorKrieg() || [2, 0]; P.map.prev = Object.assign({}, P.map.pos); P.map.pos = { r: k[0], i: k[1] }; P.hp = P.st.hp; startRoom('krieg', k[0], { krSeite: seite || 'aurelien', krZiel: ziel || 'linie' }); setState('play'); hideOverlay(); return k; };
  // Ruhe: keine Soldaten, Maschinen schweigen, keine Verstärkung
  window.ruhe = () => { for (const e of enemies) if (e.kr) e.dead = true; enemies = enemies.filter(e => !e.dead); KR.al = KR.traeger ? [KR.traeger] : []; KR.list = []; for (const m of KR.machs) m.cd = 1e9; KR.vt = KR.at = 1e9; KR.shots.length = 0; KR.fires.length = 0; KR.log.length = 0; if (KR.ziel === 'hauptmann') KR.ht = 1e9; if (KR.ziel === 'linie') KR.zt = 1e9; };
  window.schritte = (sek, vor) => { const n = Math.round(sek * 60); for (let i = 0; i < n; i++) { if (vor && vor(i) === false) return i / 60; hitStop = 0; slowmo = 0; update(1 / 60); T += 1 / 60; } return sek; };
  // jeden Treffer am Helden mitschreiben: q = 'sold' (Soldat, Pfeil eines Soldaten) | 'beschuss' | 'feuer'
  window.mitschrift = () => { const L = window.TREFFER = []; if (!window.HP0) window.HP0 = hurtPlayer; window.hurtPlayer = (d, s) => { const h = P.hp; HP0(d, s); if (P.hp < h) L.push({ t: T, q: s && s.def ? 'sold' : s ? 'beschuss' : 'feuer', d: h - P.hp }); }; return L; };
  return true;
};

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  console.log('Krieg der Kronen – Regeln');
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'de-DE' });
    const errs = []; page.on('pageerror', e => errs.push(e.message + ' @ ' + ((e.stack || '').split('\n')[1] || '').trim()));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a);
    await ev(TOOLS); await ev(HERO);

    // Daten: fünf Reiche, zwei an der Front; Soldaten nie in Wellen; Material, Erfolge, Aufträge
    const D = await ev(() => ({
      reiche: REICH_ORDER.join(), aktiv: KR_AKTIV.join(),
      felder: REICH_ORDER.every(k => { const R = REICHE[k]; return R.n && R.krone && /^#/.test(R.c) && Array.isArray(R.einh) && Array.isArray(R.masch) && R.raenge.length === 4 && R.mk && typeof R.who() === 'string' && !!iconURL(['pa', 'kr_w_' + k]); }),
      node: !!NODE.krieg && iconURL(NODE.krieg.icon).length > 100,
      en: ['kr_a_schild', 'kr_a_ritter', 'kr_a_schuetze', 'kr_k_soeldner', 'kr_k_klinge', 'kr_k_pyro', 'kr_a_hauptmann', 'kr_k_hauptmann', 'kr_n_axt', 'kr_n_schild', 'kr_n_jaeger', 'kr_n_hauptmann', 'kr_s_laeufer', 'kr_s_dorn', 'kr_s_druide', 'kr_s_hauptmann'].every(k => EN[k] && EN[k].ai === 'krieg' && EN[k].cost >= 99 && REICHE[EN[k].kr[0]] && BODIES[EN[k].body] && BODIES[EN[k].body].sp === EN[k].sp && DYES.some(d => d.id === EN[k].dye) && EN[k].desc),
      welle: poolFor(300).filter(k => EN[k].kr || EN[k].ai === 'krmach').length + Object.values(BIOME_EN).flat().filter(k => EN[k].kr).length,
      einh: KR_AKTIV.every(k => REICHE[k].einh.length >= 3 && REICHE[k].einh.every(t => EN[t] && EN[t].kr[0] === k) && EN[REICHE[k].hpt].kr[1] === 'hauptmann' && REICHE[k].masch.every(m => KR_MASCH[m])),
      mats: ['kriegseisen', 'bannerstoff'].every(k => MATS[k] && MATORDER.includes(k) && !MONMATS.includes(k) && matCanvas(k).width === 12) && MATORDER.indexOf('kriegseisen') > MATORDER.indexOf('sturmsilber'),
      ach: ['kr1', 'kr10', 'krmach', 'krhaupt', 'krbeide'].every(id => ACH.some(a => a.id === id && a.n && a.d)),
      achT: ACH.find(a => a.id === 'krbeide').t({ krW_aurelien: 1, krW_karth: 1 }) && !ACH.find(a => a.id === 'krbeide').t({ krW_aurelien: 3 }) && ACH.find(a => a.id === 'kr10').t({ krWin: 10 }) && !ACH.find(a => a.id === 'kr1').t({}),
      ziele: KR_ZIELE.length === 4 && KR_ZIELE.every(z => KR_ZIEL[z] && KR_ZIEL[z].n && KR_ZIEL[z].d), warn: KR_WARN_MIN, cap: KR_CAP
    }));
    ok(D.reiche === 'aurelien,nordmark,sylvara,karth,konzil' && D.aktiv === 'aurelien,nordmark,sylvara,karth' && D.felder, 'Fünf Reiche als Daten (Name, Krone, Farbe, Ränge, Wappen), vier an der Front: Aurelien, Nordmark, Sylvara, Karth');
    ok(D.node && D.en && D.einh && !D.welle, 'Kriegsgebiet als Ort der Karte; Soldaten beider Reiche (KI „krieg“, eigenes Aussehen) – nie in normalen Wellen');
    ok(D.mats && D.ach && D.achT && D.ziele, 'Kriegseisen und Bannerstoff (hinten angefügt, kein Gegner-Material nach Stufe), fünf Erfolge, vier Ziele');
    ok(D.warn >= .7 && D.cap <= 24, `Vorwarnung mindestens ${D.warn} s, höchstens ${D.cap} Soldaten auf dem Feld`);

    // Karte: Kriegsgebiete ab Akt 3, fester Zufall, verschieben keine anderen Orte
    const M = await ev(() => {
      let min = 9, max = 0, a2 = 0, same = true, shift = 0, reihe = true;
      for (let s = 0; s < 40; s++) {
        P.created = 1000 + s * 7919;
        for (const act of [1, 2, 3, 5, 9, 12]) {
          P.act = act; const A = genMap(act), n = A.rows.flat().filter(x => x.t === 'krieg').length;
          if (act < 3) a2 += n; else { min = Math.min(min, n); max = Math.max(max, n); }
          if (JSON.stringify(A) !== JSON.stringify(genMap(act))) same = false;
          const km = window.kriegMap; window.kriegMap = () => { }; const C = genMap(act); window.kriegMap = km;
          A.rows.forEach((row, r) => row.forEach((n, i) => { const c = C.rows[r][i]; if (n.t !== c.t && !(n.t === 'krieg' && ['kampf', 'dunkel', 'ueberleben', 'elite'].includes(c.t))) shift++; if (JSON.stringify(n.links) !== JSON.stringify(c.links)) shift++; if (n.t === 'krieg' && (r < 1 || r > 5)) reihe = false; }));
        }
      }
      // laufende Karte aus 6.5 (ohne Kriegsgebiete): nur Orte vor dem Helden werden ergänzt, einmal
      P.act = 4; const km = window.kriegMap; window.kriegMap = () => { }; const O = genMap(4); window.kriegMap = km;
      O.pos = { r: 2, i: 0 }; O.rows.forEach((row, r) => row.forEach(n => { if (r <= 2) n.done = true; }));
      const c = SAVE.chars[0]; c.act = 4; c.map = JSON.parse(JSON.stringify(O)); activateChar(0);
      const neu = P.map.rows.map((row, r) => row.filter(n => n.t === 'krieg').length), alt = neu.slice(0, 3).reduce((a, b) => a + b, 0), vorn = neu.slice(3).reduce((a, b) => a + b, 0);
      const snap = JSON.stringify(P.map); saveChar(); activateChar(0);
      return { min, max, a2, same, shift, reihe, alt, vorn, einmal: JSON.stringify(P.map) === snap, kr: P.map.kr };
    });
    ok(M.a2 === 0 && M.min >= 1 && M.max <= 2 && M.reihe, `Kriegsgebiete erst ab Akt 3: je Karte ${M.min} bis ${M.max}, nie in der ersten Reihe oder beim Boss`);
    ok(M.same && M.shift === 0, 'Gleicher Held → gleiche Karte; kein anderer Ort und kein Weg ändert sich (eigener Zufall)');
    ok(M.alt === 0 && M.vorn >= 1 && M.einmal && M.kr === 1, 'Laufende Karte aus 6.5: Kriegsgebiete nur vor dem Helden ergänzt, genau einmal');

    // Spielstand: Standard, Reparatur, alter Stand ohne das Feld
    const F = await ev(HERO_ => {
      const o = {}, a = fixMeta({}).krieg;
      o.def = a.v === 1 && REICH_ORDER.every(k => a.r[k].ruf === 0 && a.r[k].mk === 0) && a.n === 0 && a.pro === 0 && a.seite === '' && typeof a.kasse.b === 'object';
      const b = fixMeta({ krieg: { r: { aurelien: { ruf: 'x', mk: -4, sg: 2.7 }, karth: null, fremd: { ruf: 5 } }, n: -3, sg: 'a', pro: 'ja', seite: 'konzil', kasse: { w: 'q', b: { 'karth:gold': 2, '<x>:y': 9, 'aurelien:nix': 1 } }, ch: { ok1: 3, '<bad>': 1 } } }).krieg;
      o.fix = b.r.aurelien.ruf === 0 && b.r.aurelien.mk === 0 && b.r.aurelien.sg === 2 && b.r.karth.ruf === 0 && !b.r.fremd && b.n === 0 && b.sg === 0 && b.pro === 1 && b.seite === '' && b.kasse.w === 0 && b.kasse.b['karth:gold'] === 2 && Object.keys(b.kasse.b).length === 1 && b.ch.ok1 === 3 && Object.keys(b.ch).length === 1;
      const c = fixMeta({ krieg: 'kaputt' }).krieg, d = fixMeta({ krieg: { r: { karth: { ruf: 420, mk: 7, sg: 3, nl: 1 } }, n: 9, sg: 3, pro: 1, seite: 'karth' } }).krieg;
      o.fix2 = c.v === 1 && c.r.karth.ruf === 0 && d.r.karth.ruf === 420 && d.r.karth.mk === 7 && d.n === 9 && d.seite === 'karth';
      // Spielstand aus 6.5: kein meta.krieg, Held mitten in Akt 5 – lädt, bekommt das Feld und Kriegsgebiete
      eval('(' + HERO_ + ')')(5, 30); delete SAVE.meta.krieg; delete P.map.kr; P.map.rows.forEach(row => row.forEach(n => { if (n.t === 'krieg') n.t = 'kampf'; })); P.mats.erz = 12; saveChar(); persist();
      SAVE = null; loadAll(); activateChar(0);
      o.alt = !!SAVE.meta.krieg && SAVE.meta.krieg.n === 0 && P.act === 5 && P.lv === 30 && P.mats.erz === 12 && P.map.rows.flat().some(n => n.t === 'krieg') && kriegOffen() && krRang('aurelien') === 0;
      krGain('karth', 160, 2); o.rang = krRang('karth') === 1 && krRuf('karth') === 160 && krM().r.karth.mk === 2;
      return o;
    }, HERO.toString());
    ok(F.def && F.fix && F.fix2, 'Spielstand SAVE.meta.krieg: Standardwerte, Unsinn wird repariert, gültige Werte bleiben');
    ok(F.alt && F.rang, 'Alter Spielstand ohne Kriegs-Daten lädt weiter (Held, Material, Karte) und bekommt Kriegsgebiete; Kriegsruf zählt je Reich');

    // Aufbau der Schlacht: jede Seite, jedes Ziel
    await ev(HERO);
    const A = await ev(() => {
      const r = [];
      for (const s of KR_AKTIV) for (const z of KR_ZIELE) {
        schlacht(z, s); const f = krGegner(s);
        r.push({ z, s, on: KR.on && KR.side === s && KR.foe === f && KR.ziel === z, al: KR.al.length, alOk: KR.al.every(u => u.kr.team === s && u.ally && !enemies.includes(u) && u.strip && u.hp > 0), fo: enemies.filter(e => e.kr).length, foOk: enemies.filter(e => e.kr).every(e => e.kr.team === f && e.strip && !e.tint), ma: KR.machs.length, maE: KR.machs.filter(m => m.e).length, maOwn: KR.machs.filter(m => m.team === s).length, cov: KR.cover.length, gr: KR.graben.length, fest: obs.filter(o => o.solid && o.draw).length, deko: obs.some(o => o.k === 'crate' || o.k === 'chest' || o.k === 'vein') || spikes.length || pools.length, extra: z === 'banner' ? !!KR.traeger && KR.traeger.kr.rolle === 'banner' : z === 'maschine' ? !!KR.zm && !!KR.zm.e && enemies.filter(e => e.kr && e.kr.wache).length === 3 : z === 'linie' ? KR.zt === 70 : KR.ht > 0, feld: P.x > BD.x0 && P.x < BD.x1 && P.y > BD.y0 && P.y < BD.y1 && krU(P.x, P.y) < .3, hud: G.type === 'krieg' && NODE[G.type].n === 'Kriegsgebiet' });
      }
      return r;
    });
    ok(A.length === 16 && A.every(a => a.on && a.al >= 6 && a.alOk && a.fo >= 6 && a.foOk), 'Schlacht steht für alle vier Reiche und alle vier Ziele: je sechs Verbündete (nicht angreifbar) und sechs Feinde zum Auftakt');
    ok(A.every(a => a.ma === 3 && a.maE === 2 && a.maOwn === 1 && a.cov === 4 && a.gr === 2 && a.fest >= 10 && !a.deko && a.extra && a.feld), 'Drei Kriegsmaschinen (eine eigene, zwei feindliche), Schildwälle, Wagen, zwei Gräben; keine Fallen, Truhen oder Pfützen; Ziel vorbereitet' + (A.every(a => a.extra) ? '' : ' ' + JSON.stringify(A.filter(a => !a.extra).map(a => a.z + '/' + a.s))));

    // Obergrenze: nie mehr als KR_CAP Soldaten – auch mit Verstärkung und Hauptmann
    const C = await ev(() => {
      const o = {}; seed(11); schlacht('hauptmann', 'aurelien');
      for (let i = 0; i < 80; i++) { const p = krPos(.5, Math.random()); krAlly('kr_a_ritter', p.x, p.y); krFoe('kr_k_soeldner', p.x, p.y); }
      o.voll = krCount(); KR.ht = 0; P.inv = 1e9; schritte(.2); o.hpt = !!KR.hpt; o.nachHpt = krCount();
      let max = 0; schlacht('linie', 'karth'); P.stealth = 1e9; schritte(60, () => { KR.moral = 60; P.inv = 9; max = Math.max(max, krCount()); }); o.lauf = max;
      max = 0; schlacht('banner', 'aurelien'); P.stealth = 1e9; schritte(40, () => { KR.moral = 60; if (KR.traeger) KR.traeger.hp = KR.traeger.maxHp; P.inv = 9; max = Math.max(max, krCount()); }); o.lauf2 = max;
      P.stealth = 0; unseed(); return o;
    });
    ok(C.voll === D.cap && C.hpt && C.nachHpt <= D.cap, `Obergrenze hält: ${C.voll} von ${D.cap} Soldaten, auch wenn der Hauptmann dazukommt (${C.nachHpt})`);
    ok(C.lauf <= D.cap && C.lauf2 <= D.cap && C.lauf >= 10, `60 s „Linie halten“ und 40 s „Bannerträger“ mit Verstärkung: höchstens ${Math.max(C.lauf, C.lauf2)} Soldaten zugleich`);

    // Zwei Heere kämpfen wirklich – ohne den Helden (versteckt), ohne Erfahrung und Beute für ihn
    const K = await ev(() => {
      const o = {}; seed(3); schlacht('linie', 'aurelien'); for (const m of KR.machs) m.cd = 1e9;
      P.stealth = 1e9; const xp0 = P.xp, k0 = P.stats.kills, hp0 = P.hp, al0 = KR.al.slice(), fo0 = enemies.filter(e => e.kr);
      schritte(22, () => { KR.moral = 60; });
      o.alWund = al0.filter(u => u.dead || u.hp < u.maxHp).length; o.foWund = fo0.filter(e => e.dead || e.hp < e.maxHp).length; o.gef = KR.gef; o.alTot = al0.filter(u => u.dead).length;
      o.still = P.xp === xp0 && P.stats.kills === k0 && P.hp === hp0 && !pickups.some(c => c.k === 'loot');
      // ein Feind neben dem Helden greift ihn an, ein Verbündeter nie
      ruhe(); P.stealth = 0; const p = { x: P.x, y: P.y };
      const e = krFoe('kr_k_soeldner', p.x + 14, p.y); const h1 = P.hp; schritte(4, () => { P.inv = 0; }); o.feind = P.hp < h1 && !e.ally;
      ruhe(); const u = krAlly('kr_a_ritter', p.x + 14, p.y); P.hp = P.st.hp; const h2 = P.hp; schritte(4, () => { P.inv = 0; }); o.freund = P.hp === h2 && !u.dead;
      // der Held besiegt einen Soldaten: zählt, bringt Erfahrung, hebt die Moral
      ruhe(); const f = krFoe('kr_k_klinge', p.x + 14, p.y), s0 = SAVE.meta.stats.krSold || 0, x1 = P.xp + P.lv * 1e6; KR.moral = 50; hurtEnemy(f, 1e9, 1, 0, 0, false, true);
      o.sieg = f.dead && (SAVE.meta.stats.krSold || 0) === s0 + 1 && P.xp + P.lv * 1e6 > x1 && KR.moral > 50;
      // außerhalb der Schlacht (normaler Raum): Soldaten zweier Reiche bekämpfen einander
      startRoom('kampf', 2); G.waves = []; G.pending = []; G.phase = 'fight'; G.t = 999; enemies = []; setState('play'); hideOverlay(); P.stealth = 1e9;
      const a = spawnEnemy('kr_a_ritter', { x: P.x + 90, y: P.y, instant: true }), b = spawnEnemy('kr_k_soeldner', { x: P.x + 106, y: P.y, instant: true });
      schritte(6); o.frei = (a.dead || a.hp < a.maxHp) && (b.dead || b.hp < b.maxHp) && a.kr.team === 'aurelien' && b.kr.team === 'karth';
      P.stealth = 0; unseed(); return o;
    });
    ok(K.alWund >= 2 && K.foWund >= 2 && K.gef + K.alTot >= 1, `Die Heere kämpfen ohne den Helden: nach 22 s ${K.alWund} Verbündete und ${K.foWund} Feinde verwundet oder gefallen`);
    ok(K.still, 'Was Soldaten untereinander austragen, bringt dem Helden weder Erfahrung noch Beute');
    ok(K.feind && K.freund && K.sieg, 'Feinde greifen den Helden an, Verbündete nie; eigene Siege zählen (Erfahrung, Moral, Zähler)');
    ok(K.frei, 'Soldaten zweier Reiche bekämpfen sich auch außerhalb einer Schlacht (wie in den Kriegs-Biomen der Lande)');

    // Fairness: jeder Beschuss ist mindestens KR_WARN_MIN Sekunden sichtbar, Treffer nur in der Fläche
    const W = await ev(() => {
      const o = { arten: {} }; seed(5); schlacht('linie', 'aurelien'); ruhe(); P.st.dodge = 0; const L = mitschrift();
      const frei = () => { const p = krPos(.5, .5); P.x = p.x; P.y = p.y; P.vx = P.vy = 0; P.hp = P.st.hp = 1e7; P.inv = 0; KR.shots.length = 0; KR.fires.length = 0; L.length = 0; KR.log.length = 0; };
      for (const art of ['pfeil', 'katapult', 'magie', 'ring']) {
        frei(); const s = krShot(art, P.x, P.y, { team: KR.foe, t: .1 }), t0 = T, max = s.max; let früh = false;
        schritte(max - .05, () => { P.inv = 0; if (L.length) früh = true; }); const vor = L.length;
        schritte(.2, () => { P.inv = 0; }); const tr = L[0];
        o.arten[art] = { max, früh, vor, hit: !!tr, nach: tr ? +(tr.t - t0).toFixed(2) : null, log: KR.log[0] && KR.log[0].warn };
      }
      // knapp daneben (seitlich und in der Tiefe) kein Schaden, knapp drin schon
      const rand = (dx, dy) => { frei(); const s = krShot('katapult', P.x + dx, P.y + dy, { team: KR.foe }); schritte(s.max + .2, () => { P.inv = 0; }); return L.length; };
      o.dx = rand(38 + 3, 0); o.dy = rand(0, 38 * .6 + 3); o.drinX = rand(38 - 4, 0); o.drinY = rand(0, 38 * .6 - 4);
      // Rolle (unverwundbar) im Moment des Einschlags: kein Schaden
      frei(); const s2 = krShot('katapult', P.x, P.y, { team: KR.foe }); schritte(s2.max + .2, () => { P.inv = 1; }); o.rolle = L.length;
      // eigener Beschuss trifft den Helden nie
      frei(); krShot('katapult', P.x, P.y, { team: KR.side }); krShot('magie', P.x, P.y, { team: KR.side }); schritte(6, () => { P.inv = 0; }); o.eigen = L.length;
      // brennender Boden: erster Schaden frühestens KR_WARN_MIN nach dem Einschlag
      frei(); const s3 = krShot('magie', P.x + 60, P.y, { team: KR.foe, n: 1 }); schritte(s3.max + .05); const born = T, fz = KR.fires.length; P.x += 60; schritte(3, () => { P.inv = 0; });
      o.feuer = { zone: fz, hit: L.length, nach: KR.log[0] ? +KR.log[0].warn.toFixed(2) : null, art: L[0] && L[0].q, seit: L[0] ? +(L[0].t - born).toFixed(2) : null };
      frei(); o.clamp = [krShot('ring', P.x + 200, P.y, { team: KR.foe, t: .1 }).max, krShot('bahn', P.x + 200, P.y, { team: KR.foe, t: .2, ang: 0 }).max];
      unseed(); return o;
    });
    const WA = Object.values(W.arten);
    ok(WA.every(a => a.max >= D.warn && !a.früh && a.vor === 0 && a.hit && a.nach >= a.max - .03 && a.log >= D.warn), 'Pfeilhagel, Katapult, Magiehagel, Flammenring: Schaden erst nach der Ankündigung (' + Object.keys(W.arten).map(k => `${k} ${W.arten[k].max} s`).join(', ') + ') – auch wenn eine kürzere Zeit verlangt wird');
    ok(W.dx === 0 && W.dy === 0 && W.drinX > 0 && W.drinY > 0, 'Treffer nur innerhalb der gezeichneten Fläche: knapp daneben nichts – seitlich wie in der Tiefe');
    ok(W.rolle === 0 && W.eigen === 0, 'Rolle durch den Einschlag bleibt heil; eigener Beschuss trifft den Helden nie');
    ok(W.feuer.zone >= 1 && W.feuer.hit >= 1 && W.feuer.nach >= D.warn && W.feuer.art === 'feuer', `Brennender Boden: erster Schaden frühestens ${D.warn} s nach dem Einschlag (gemessen ${W.feuer.nach} s)`);
    ok(W.clamp.every(v => v >= D.warn), 'Zu kurze Ankündigungen werden auf das Minimum angehoben');

    // Hauptleute: Sonderangriffe mit Ankündigung; betäubt verfällt der Sturm statt ohne Warnung zu kommen
    const H = await ev(() => {
      const o = {}; seed(8); const L = mitschrift();
      const hpt = seite => { schlacht('hauptmann', seite); ruhe(); P.st.dodge = 0; const p = krPos(.5, .5); P.x = p.x; P.y = p.y; P.hp = P.st.hp = 1e7; const e = krFoe(REICHE[KR.foe].hpt, p.x + 70, p.y); e.kr.mt = 0; e.kr.tt = 0; e.cd = 99; L.length = 0; KR.log.length = 0; return e; };
      // Aurelien-Hauptmann (Seite Karth): Schildstoß entlang der Bahn
      let e = hpt('karth'), t0 = T, s = null; schritte(.1, () => { P.inv = 0; }); s = KR.shots.find(x => x.k === 'bahn'); o.bahn = !!s && s.max;
      schritte(1.6, () => { P.inv = 0; e.cd = 99; }); o.bahnHit = L.length; o.bahnNach = L[0] ? +(L[0].t - t0).toFixed(2) : null; o.bahnLog = KR.log.some(l => l.k === 'bahn' && l.warn >= KR_WARN_MIN);
      // ausweichen: quer aus der Bahn → kein Treffer
      e = hpt('karth'); schritte(.1); const s1 = KR.shots.find(x => x.k === 'bahn'); P.x += -Math.sin(s1.ang) * 30; P.y += Math.cos(s1.ang) * 30; schritte(1.6, () => { P.inv = 0; e.cd = 99; }); o.bahnAus = L.length;
      // betäubt während der Ankündigung: kein Sturm danach
      e = hpt('karth'); schritte(.1); e.stun = 2.5; let px0 = e.x, py0 = e.y, sprung = 0; schritte(4, () => { P.inv = 0; e.cd = 99; e.kr.mt = 99; sprung = Math.max(sprung, Math.hypot(e.x - px0, e.y - py0)); px0 = e.x; py0 = e.y; }); o.stun = L.length === 0 && sprung < 3 && !e.kr.sp; o.stunD = [L.length, sprung];
      // zweiter Angriff: Pfeilhagel-Ruf
      e = hpt('karth'); e.kr.n = 1; schritte(.1); o.ruf = KR.shots.some(x => x.k === 'pfeil' && !x.own);
      // Karth-Hauptfrau (Seite Aurelien): Flammenring um sich, dann Meteore auf den Helden
      e = hpt('aurelien'); schritte(.1); const rg = KR.shots.find(x => x.k === 'ring'); o.ring = !!rg && rg.max >= KR_WARN_MIN && Math.hypot(rg.x - e.x, rg.y - e.y) < 6;
      e = hpt('aurelien'); e.kr.n = 1; schritte(.1); const me = KR.shots.filter(x => x.k === 'meteor'); o.meteor = me.length >= 3 && me.every(x => x.max >= KR_WARN_MIN);
      // Hauptmann fällt während der Ankündigung: sein Angriff verfällt
      e = hpt('aurelien'); schritte(.1); P.x = e.x + 10; P.y = e.y; hurtEnemy(e, 1e12, 0, 0, 0, false, true); schritte(2, () => { P.inv = 0; }); o.tot = e.dead && L.length === 0; o.totD = [e.dead, L.length, L[0] && L[0].q];
      unseed(); return o;
    });
    ok(H.bahn >= D.warn && H.bahnHit >= 1 && H.bahnNach >= H.bahn - .03 && H.bahnLog && H.bahnAus === 0, `Aureliens Hauptmann: Schildstoß nur entlang der angekündigten Bahn (${H.bahn} s), ein Schritt zur Seite genügt`);
    ok(H.stun && H.tot, 'Wird der Hauptmann betäubt oder fällt er, verfällt der angekündigte Angriff – nie ein Treffer ohne frische Warnung' + (H.stun && H.tot ? '' : ' ' + JSON.stringify(H)));
    ok(H.ruf && H.ring && H.meteor, 'Reich-eigene Angriffe: Aurelien ruft Pfeilhagel, Karths Hauptfrau legt einen Flammenring und ruft Meteore – alle angekündigt');

    // Lange Schlacht mit festem Samen: jeder Treffer durch Beschuss oder Feuer hatte seine Ankündigung
    const Z = await ev(() => {
      seed(21); schlacht('hauptmann', 'aurelien'); const L = mitschrift(); KR.ht = 3; P.st.dodge = 0; let a = 0, n = 0;
      schritte(120, i => { KR.moral = 60; P.hp = P.st.hp = 1e7; P.inv = 0; if (KR.hpt) KR.hpt.hp = KR.hpt.maxHp; if (i % 90 === 0) a = Math.random() * 6.283; if (i % 600 < 420) { stick.id = 99; stick.x = Math.cos(a) * .7; stick.y = Math.sin(a) * .7; } else { stick.x = stick.y = 0; } n = Math.max(n, krCount()); });
      stick.id = null; stick.x = stick.y = 0;
      const bes = L.filter(h => h.q !== 'sold'), log = KR.log.slice();
      const o = { treffer: L.length, sold: L.length - bes.length, bes: bes.length, log: log.length, arten: [...new Set(log.map(l => l.k))].sort().join(), minWarn: log.reduce((m, l) => Math.min(m, l.warn), 9), paar: bes.every(h => log.some(l => Math.abs(l.t - h.t) < .001)), n, aus: KR.aus };
      unseed(); return o;
    });
    ok(Z.bes >= 4 && Z.log === Z.bes && Z.paar && Z.minWarn >= D.warn, `120 s Schlacht mit Hauptfrau, der Held läuft blind umher: ${Z.bes} Treffer durch Beschuss (${Z.arten}), jeder mit Ankündigung ≥ ${D.warn} s (kürzeste ${Z.minWarn.toFixed(2)} s); dazu ${Z.sold} Treffer von Soldaten`);

    // Deckung: Schildwall, Wagen, Graben
    const V = await ev(() => {
      const o = {}; seed(6); schlacht('linie', 'aurelien'); ruhe(); P.st.dodge = 0; const L = mitschrift(), g = KR.geo, dir = g.a1 > g.a0 ? 1 : -1;
      const hinter = (c, d, q) => g.hz ? { x: c.x - dir * d, y: c.y + (q || 0) } : { x: c.x + (q || 0), y: c.y - dir * d };
      const c = KR.cover[0], gr = KR.graben[0], mitte = { x: (gr.x0 + gr.x1) / 2, y: (gr.y0 + gr.y1) / 2 };
      o.pos = [krCover(hinter(c, 14).x, hinter(c, 14).y), krCover(hinter(c, -14).x, hinter(c, -14).y), krCover(hinter(c, 14, 40).x, hinter(c, 14, 40).y), krCover(hinter(c, 40).x, hinter(c, 40).y), krCover(mitte.x, mitte.y), krCover(krPos(.5, .5).x, krPos(.5, .5).y)];
      o.alle = KR.cover.every(k => krCover(hinter(k, 14).x, hinter(k, 14).y) === 1 && krCover(hinter(k, -14).x, hinter(k, -14).y) === 0);
      const schuss = (art, p) => { P.x = p.x; P.y = p.y; P.vx = P.vy = 0; P.hp = P.st.hp = 1e7; P.inv = 0; KR.shots.length = 0; KR.fires.length = 0; L.length = 0; KR.log.length = 0; Math.random = () => .5; const s = krShot(art, p.x, p.y, { team: KR.foe, n: 1 }); schritte(s.max + .1, () => { P.inv = 0; }); return L.reduce((a, h) => a + h.d, 0); };
      const frei = krPos(.5, .5), h = hinter(c, 14);
      o.pfeilFrei = schuss('pfeil', frei); o.pfeilGed = schuss('pfeil', h); o.pfeilGraben = schuss('pfeil', mitte);
      o.katFrei = schuss('katapult', frei); o.katGed = schuss('katapult', h); o.metFrei = schuss('magie', frei); o.metGed = schuss('magie', mitte);
      // Pfeil eines feindlichen Schützen: der Schildwall hält ihn auf
      seed(6); P.x = h.x; P.y = h.y; P.hp = P.st.hp; L.length = 0; const v = hinter(c, -60), sch = { x: v.x, y: v.y, sc: 1, atk: 50 }; enemyArrow(sch, Math.atan2(P.y - v.y, P.x - v.x), 175); schritte(1.2, () => { P.inv = 0; }); o.wall = L.length === 0 && !projs.some(p => p.from === 'e');
      const off = krPos(.5, .5); P.x = off.x; P.y = off.y; enemyArrow({ x: off.x + 60, y: off.y, sc: 1, atk: 50 }, Math.PI, 175); schritte(1.2, () => { P.inv = 0; }); o.offen = L.length === 1;
      unseed(); return o;
    });
    ok(V.pos.join() === '1,0,0,0,1,0' && V.alle, 'Deckung nur dicht hinter Schildwall und Wagen (auf der eigenen Seite) und im Graben – davor, daneben und im offenen Feld nicht');
    ok(V.pfeilFrei > 0 && V.pfeilGed === 0 && V.pfeilGraben === 0, 'In Deckung trifft Pfeilhagel gar nicht');
    ok(V.katFrei > 0 && Math.abs(V.katGed / V.katFrei - .5) < .02 && Math.abs(V.metGed / V.metFrei - .5) < .02, `Katapult und Meteor treffen in Deckung nur halb (${Math.round(V.katFrei)} → ${Math.round(V.katGed)}, ${Math.round(V.metFrei)} → ${Math.round(V.metGed)})`);
    ok(V.wall && V.offen, 'Der Schildwall hält auch den Pfeil eines feindlichen Schützen auf – im offenen Feld trifft derselbe Pfeil');

    // Kriegsmaschinen: zerstören, erobern, bewacht
    const N = await ev(() => {
      const o = {}; seed(9); const st = k => SAVE.meta.stats[k] || 0;
      schlacht('maschine', 'aurelien'); let z0 = st('krZerst'); const m1 = KR.zm, hp1 = m1.e.maxHp, sold = enemies.find(e => e.kr).maxHp; hurtEnemy(m1.e, 1e12, 0, 0, 0, false, true);
      o.zerst = KR.aus === 1 && m1.weg && st('krZerst') === z0 + 1 && !corpses.some(c => c.sp === 'ogre'); o.zaeh = +(hp1 / sold).toFixed(1);
      // erobern: Wachen fort, daneben stehen
      schlacht('maschine', 'karth'); for (const e of enemies) if (e.kr) e.dead = true; KR.vt = 1e9; const m2 = KR.zm, c0 = st('krCap'); P.x = m2.x + 14; P.y = m2.y + 6; let t = schritte(6, () => { P.inv = 9; P.x = m2.x + 14; P.y = m2.y + 6; return !KR.aus; });
      o.erob = KR.aus === 1 && m2.team === 'karth' && !m2.e && KR.caps === 1 && st('krCap') === c0 + 1 && !enemies.some(e => e.mach === m2 && !e.dead); o.erobT = +t.toFixed(1); o.lohnMk = KR.lohn && KR.lohn.mk;
      // bewacht: ein Feind in der Nähe verhindert es
      schlacht('maschine', 'karth'); const m3 = KR.zm; for (const e of enemies) if (e.kr) { e.spd = 0; e.cd = 1e9; e.kr.tt = 1e9; } KR.vt = 1e9; schritte(6, () => { P.inv = 9; P.x = m3.x + 14; P.y = m3.y + 6; KR.moral = 60; });
      o.wache = !KR.aus && m3.team === 'aurelien' && m3.cap === 0 && m3.block === true;
      // eroberte zweite Maschine feuert für uns: gestrichelt, trifft Feinde, nie den Helden
      schlacht('linie', 'aurelien'); ruhe(); KR.zt = 1e9; const m4 = KR.machs[2]; P.x = m4.x + 14; P.y = m4.y; schritte(5, () => { P.inv = 9; P.x = m4.x + 14; P.y = m4.y; KR.moral = 60; });
      const L = mitschrift(); const f = krFoe('kr_k_soeldner', P.x + 60, P.y); f.spd = 0; f.cd = 1e9; m4.cd = .1; let own = 0; schritte(9, () => { P.inv = 0; P.hp = P.st.hp; KR.moral = 60; f.x = P.x + 60; f.y = P.y; f.cd = 1e9; own = Math.max(own, KR.shots.filter(s => s.own).length); m4.cd = Math.min(m4.cd, 1.5); });
      o.eigen = m4.team === 'aurelien' && own >= 1 && L.filter(h => h.q !== 'sold').length === 0 && (f.dead || f.hp < f.maxHp);
      unseed(); return o;
    });
    ok(N.zerst && N.zaeh >= 5, `Maschine zerstören gewinnt das Ziel (sie hält so viel aus wie ${N.zaeh} Soldaten, kein fliegender Körper)`);
    ok(N.erob && N.erobT >= 2.5 && N.erobT <= 4.5 && N.lohnMk === 4, `Maschine erobern: ${N.erobT} s daneben stehen, sie wechselt die Seite, zählt für Erfolg und Lohn (eine Marke mehr)`);
    ok(N.wache, 'Solange ein feindlicher Soldat bei der Maschine steht, lässt sie sich nicht erobern');
    ok(N.eigen, 'Eine eroberte Maschine feuert auf die Feinde – der Held nimmt davon keinen Schaden');

    // Alle vier Ziele: gewinnbar und verlierbar; Reihenfolge wechselt
    const O = await ev(() => {
      const o = {}; seed(13); const st = k => SAVE.meta.stats[k] || 0;
      schlacht('linie', 'aurelien'); ruhe(); KR.zt = .05; schritte(.2); o.linieSieg = KR.aus === 1;
      schlacht('linie', 'aurelien'); krMoral(-200); o.linieNied = KR.aus === -1 && KR.grund === 'moral';
      schlacht('linie', 'aurelien'); krMoral(-40); const w1 = KR.mwarn === 1 && /Moral bricht/.test($('toast').textContent); $('toast').textContent = ''; krMoral(-1); o.warn = w1 && $('toast').textContent === '' && !KR.aus;
      // ohne den Helden bröckelt die Linie
      schlacht('linie', 'karth'); P.stealth = 1e9; schritte(30, () => { P.inv = 9; return !KR.aus; }); o.afk = KR.aus === -1 || KR.moral < 45; o.afkM = Math.round(KR.moral); P.stealth = 0;
      schlacht('banner', 'karth'); ruhe(); const u = KR.traeger; u.x = KR.bz.x - 12; u.y = KR.bz.y; schritte(3, () => !KR.aus); o.bannerSieg = KR.aus === 1 && KR.fahnen.some(f => f.gross);
      schlacht('banner', 'karth'); krDmg(KR.traeger, 1e12, 0, 0); o.bannerNied = KR.aus === -1 && KR.grund === 'banner';
      // der Träger geht von selbst zum Ziel, bleibt aber stehen, solange ein Feind nah ist
      schlacht('banner', 'aurelien'); ruhe(); const b = KR.traeger, d0 = Math.hypot(KR.bz.x - b.x, KR.bz.y - b.y); schritte(3); const d1 = Math.hypot(KR.bz.x - b.x, KR.bz.y - b.y);
      const w = krFoe('kr_k_soeldner', b.x + 30, b.y); w.spd = 0; w.cd = 1e9; schritte(2, () => { w.x = b.x + 30; w.y = b.y; w.cd = 1e9; b.hp = b.maxHp; }); const d2 = Math.hypot(KR.bz.x - b.x, KR.bz.y - b.y);
      o.traeger = d1 < d0 - 20 && Math.abs(d2 - d1) < 3; o.dd = [d0, d1, d2];
      schlacht('hauptmann', 'aurelien'); ruhe(); KR.ht = .05; const h0 = st('krHaupt'); schritte(.3, () => { P.inv = 9; }); const e = KR.hpt; o.hptDa = !!e && e.kr.rolle === 'hauptmann' && e.name === REICHE.karth.hptN && e.maxHp > 5 * enemies.filter(x => x.kr && x !== e)[0].maxHp;
      hurtEnemy(e, 1e12, 0, 0, 0, false, true); o.hptSieg = KR.aus === 1 && st('krHaupt') === h0 + 1;
      schlacht('hauptmann', 'karth'); krMoral(-200); o.hptNied = KR.aus === -1;
      schlacht('maschine', 'karth'); krMoral(-200); o.maschNied = KR.aus === -1;
      // nach der Entscheidung fliehen die Verlierer, niemand schießt mehr
      schlacht('linie', 'aurelien'); krEnd(true); const fl = enemies.filter(x => x.kr).every(x => x.kr.flucht); schritte(2.2, () => { P.inv = 9; }); o.flucht = fl && KR.shots.length === 0; o.fl = [fl, KR.shots.length];
      // Reihenfolge: vier Schlachten ohne Vorgabe → alle vier Ziele
      const k = vorKrieg() || [2, 0]; krM().n = 0; const zs = []; for (let i = 0; i < 5; i++) { startRoom('krieg', k[0], { krSeite: 'aurelien' }); zs.push(KR.ziel); } o.reihe = zs.join();
      // „Raum wiederholen“ nach dem Tod: gleiche Seite, gleiches Ziel
      startRoom('krieg', k[0], { krSeite: 'karth' }); const z1 = KR.ziel; startRoom(G.type, G.row, G.extra); o.retry = KR.ziel === z1 && KR.side === 'karth';
      unseed(); return o;
    });
    ok(O.linieSieg && O.linieNied && O.afk && O.warn, `Linie halten: gewonnen, wenn die Zeit um ist; verloren, wenn die Moral bricht – ohne den Helden bröckelt sie (nach 30 s Moral ${O.afkM})`);
    ok(O.bannerSieg && O.bannerNied && O.traeger, 'Bannerträger: geht von selbst, bleibt bei Feinden stehen; Banner am Ziel = Sieg, Träger gefallen = Niederlage' + (O.bannerSieg && O.bannerNied && O.traeger ? '' : ' ' + JSON.stringify(O)));
    ok(O.hptDa && O.hptSieg && O.hptNied && O.maschNied, 'Hauptmann: erscheint mit Namen und viel Leben, sein Tod = Sieg; jedes Ziel geht mit der Moral verloren');
    ok(O.flucht && O.reihe === 'linie,maschine,banner,hauptmann,linie' && O.retry, 'Nach der Entscheidung flieht der Verlierer; die Ziele wechseln der Reihe nach; Wiederholen behält Seite und Ziel');

    // Lohn, Ergebnis-Bildschirm, Rückzug
    await ev(HERO);
    const L = await ev(() => {
      const o = {}; seed(4); const st = k => SAVE.meta.stats[k] || 0;
      const sieg = (seite, moral) => { const k = schlacht('linie', seite); KR.moral = moral; const soll = Math.round((12 + G.stage * 9) * 2.2 * (1 + P.st.gold) * (seite === 'aurelien' ? 1.3 : 1)); const g0 = P.gold, e0 = P.mats.kriegseisen || 0, b0 = P.mats.bannerstoff || 0, r0 = krRuf(seite), m0 = krM().r[seite].mk, w0 = st('krWin'), ws = st('krW_' + seite); krEnd(true); const n = P.map.rows[k[0]][k[1]]; return { soll, gold: P.gold - g0, eisen: (P.mats.kriegseisen || 0) - e0, stoff: (P.mats.bannerstoff || 0) - b0, ruf: krRuf(seite) - r0, mk: krM().r[seite].mk - m0, win: st('krWin') - w0, ws: st('krW_' + seite) - ws, done: n.done, lohn: KR.lohn.got.map(e => e.n).join(), sg: krM().r[seite].sg, beute: pickups.some(c => c.k === 'loot') }; };
      o.a = sieg('aurelien', 50); schritte(3.2, () => { P.inv = 9; }); o.schirm = state === 'menu' && /SIEG FÜR AURELIEN/.test(panel.textContent) && /Kriegseisen/.test(panel.textContent) && !!panel.querySelector('[data-act="kr_weiter"]') && $('krhud').hidden;
      const hp = P.hp = Math.round(P.st.hp * .5); ON.kr_weiter(); o.weiter = state === 'map' && P.hp > hp && !KR.on;
      P.map = genMap(3); o.k = sieg('karth', 90);
      // Niederlage: etwas Kriegsruf, Ort bleibt offen; wiederholen oder Rückzug
      P.map = genMap(3); const k = schlacht('banner', 'karth'), r1 = krRuf('karth'), nl = krM().r.karth.nl, g1 = P.gold; krEnd(false, 'banner'); schritte(2.6, () => { P.inv = 9; });
      o.nied = { ruf: krRuf('karth') - r1, nl: krM().r.karth.nl - nl, gold: P.gold - g1, offen: !P.map.rows[k[0]][k[1]].done, schirm: state === 'menu' && /VERLOREN/.test(panel.textContent) && !!panel.querySelector('[data-act="kr_nochmal"]') && !!panel.querySelector('[data-act="kr_rueckzug"]') };
      ON.kr_nochmal(); o.nochmal = KR.on && !KR.aus && KR.side === 'karth' && KR.ziel === 'banner' && state === 'play';
      krEnd(false, 'moral'); schritte(2.6, () => { P.inv = 9; }); ON.kr_rueckzug(); o.rueckzug = state === 'map' && P.map.rows[k[0]][k[1]].done && !KR.on;
      // gespeichert: Kriegsruf und Marken überstehen Neuladen
      const ruf = krRuf('karth'), mk = krM().r.karth.mk; SAVE = null; loadAll(); activateChar(0); o.save = krRuf('karth') === ruf && krM().r.karth.mk === mk && krM().sg === 2 && krM().seite === 'karth';
      unseed(); return o;
    });
    ok(L.a.gold > 0 && L.a.eisen >= 2 && L.a.stoff >= 1 && L.a.ruf === 25 && L.a.mk === 3 && L.a.win === 1 && L.a.ws === 1 && L.a.done && L.a.beute, `Sieg für Aurelien: ${L.a.gold} Gold, ${L.a.eisen} Kriegseisen, ${L.a.stoff} Bannerstoff, +25 Kriegsruf, 3 Marken, ein Gegenstand; Ort erledigt`);
    ok(L.k.eisen >= 4 && L.a.eisen <= 4 && L.k.ruf === 30 && L.a.gold === L.a.soll && L.k.gold === L.k.soll, `Reiche zahlen verschieden: Aurelien +30 % Gold (${L.a.gold}), Karth +2 Kriegseisen (${L.k.eisen}, bei Aurelien ${L.a.eisen}); hohe Moral +5 Kriegsruf`);
    ok(L.schirm && L.weiter, 'Ergebnis-Bildschirm mit Kriegsbeute, „Weiter“ führt geheilt zur Karte');
    ok(L.nied.ruf === 5 && L.nied.nl === 1 && L.nied.gold === 0 && L.nied.offen && L.nied.schirm && L.nochmal && L.rueckzug, 'Niederlage: 5 Kriegsruf, kein Gold; wiederholen (gleiche Seite, gleiches Ziel) oder Rückzug (Ort erledigt)');
    ok(L.save, 'Kriegsruf, Marken und Siege sind gespeichert');

    // Kapitel 2 – Fünf Kronen: Fronten, neue Reiche, Balliste, Kriegsruf-Verlust, Rang-Vorteile, Chronik Akt 1
    await ev(HERO);
    const K2 = await ev(() => {
      const o = {}; seed(12); const st = k => SAVE.meta.stats[k] || 0;
      // Fronten: nur Reiche an der Front, nie zweimal dasselbe; jedes Reich kommt vor; fest je Held/Akt/Reihe
      o.fronten = KR_FRONT.every(f => f.length === 2 && f[0] !== f[1] && f.every(k => KR_AKTIV.includes(k))) && KR_AKTIV.every(k => KR_FRONT.some(f => f.includes(k)));
      const seen = new Set(); for (let c = 0; c < 30; c++) { P.created = 5000 + c * 1013; for (const act of [3, 4, 5, 6]) { P.act = act; for (const r of [2, 4]) { const f = krFront(r); seen.add(f.join()); if (krFront(r).join() !== f.join()) o.wackelt = 1; } } }
      o.vielfalt = seen.size; P.act = 3;
      // Seitenwahl an einer Front Nordmark gegen Sylvara: zwei Karten, gewählt wird gegen den anderen
      const kf = window.krFront; window.krFront = () => ['nordmark', 'sylvara']; P.map = genMap(3); const k0 = vorKrieg(); krWahl(k0[0]); window.krFront = kf;
      o.wahl = [...panel.querySelectorAll('.krside [data-act="kr_seite"]')].map(b => b.dataset.id).join();
      ON.kr_seite('sylvara'); o.seite = KR.on && KR.side === 'sylvara' && KR.foe === 'nordmark' && G.extra.krFeind === 'nordmark';
      o.masch = KR.machs.map(m => m.art + ':' + (m.team === KR.side ? 'e' : 'f')).join();
      // Schlacht für die Nordmark: Gegner Sylvara (Erzfeind), eigene Balliste, Soldaten mit Reichs-Aussehen
      schlacht('linie', 'nordmark'); o.nord = KR.side === 'nordmark' && KR.foe === 'sylvara' && KR.machs.some(m => m.art === 'ballista' && m.team === 'nordmark') && KR.al.every(u => u.kr.team === 'nordmark' && EN[u.t].kr[0] === 'nordmark') && enemies.filter(e => e.kr && !e.mach).every(e => e.def.kr[0] === 'sylvara');
      // Balliste: Streifen am Boden, mindestens KR_WARN_MIN angekündigt; im Streifen Treffer, daneben nichts
      ruhe(); P.st.dodge = 0; const L = mitschrift(), p = krPos(.5, .5); P.x = p.x; P.y = p.y; P.hp = P.st.hp = 1e7;
      let s = krShot('ballista', P.x, P.y, { team: KR.foe, sx: P.x - 120, sy: P.y }); o.bolzen = !!s && s.k === 'bolzen' && s.max >= KR_WARN_MIN && krIn(s, P.x, P.y) && !krIn(s, P.x, P.y + 14);
      const t0 = T; schritte(s.max + .2, () => { P.inv = 0; P.x = p.x; P.y = p.y; }); o.bolzenHit = L.length === 1 && L[0].t - t0 >= KR_WARN_MIN - .02 && L[0].q === 'beschuss';
      L.length = 0; s = krShot('ballista', P.x, P.y - 16, { team: KR.foe, sx: P.x - 120, sy: P.y - 16 }); schritte(s.max + .2, () => { P.inv = 0; P.x = p.x; P.y = p.y; }); o.bolzenDaneben = L.length === 0;
      // Kriegsruf-Verlust bei dem Reich, gegen das du gewinnst (nie unter null)
      krM().r.sylvara.ruf = 3; schlacht('linie', 'nordmark'); krEnd(true); o.verrat1 = krM().r.sylvara.ruf === 0 && KR.lohn.verrat === 3;
      krM().r.sylvara.ruf = 100; schlacht('linie', 'nordmark'); krEnd(true); o.verrat2 = krM().r.sylvara.ruf === 100 - KR_VERRAT && KR.lohn.verrat === KR_VERRAT;
      // Lohn Nordmark: +25 % Kriegsruf · Rang Hauptmann: +10 % · Marschall: Soldaten mit 20 % mehr Leben
      krM().r.nordmark.ruf = 0; schlacht('linie', 'nordmark'); KR.moral = 50; const r0 = krRuf('nordmark'); krEnd(true); o.rufN = krRuf('nordmark') - r0;
      krM().r.nordmark.ruf = 200; schlacht('linie', 'nordmark'); KR.moral = 50; const r1 = krRuf('nordmark'); krEnd(true); o.rufH = krRuf('nordmark') - r1;
      krM().r.nordmark.ruf = 0; schlacht('linie', 'nordmark'); const hp0 = KR.al.length ? KR.al[0].maxHp / EN[KR.al[0].t].hp : 0;
      krM().r.nordmark.ruf = 700; schlacht('linie', 'nordmark'); const hp1 = KR.al.length ? KR.al[0].maxHp / EN[KR.al[0].t].hp : 0; o.leben = +(hp1 / hp0).toFixed(2);
      // Sylvara zahlt Bannerstoff
      schlacht('linie', 'sylvara'); const b0 = P.mats.bannerstoff || 0; krEnd(true); o.stoff = (P.mats.bannerstoff || 0) - b0;
      // Chronik Akt 1: Kapitel nach 1, 3, 6 Siegen für dieses Reich
      o.akt = KR_AKTIV.every(k => KR_AKT1[k].length === 3 && KR_AKT1[k].map(c => c.ab).join() === '1,3,6' && KR_AKT1[k].every(c => c.t() && c.L().length >= 2 && c.L().every(l => typeof l[1] === 'string' && l[1].length > 20)));
      krM().r.karth.sg = 0; schlacht('linie', 'karth'); krEnd(true); o.neu = KR.lohn.akt === 0;
      schritte(3.2, () => { P.inv = 9; }); o.schirm = /NEUES KAPITEL/.test(panel.textContent) && !!panel.querySelector('[data-act="kr_akt"][data-id="karth:0:res"]');
      krM().r.karth.sg = 1; schlacht('linie', 'karth'); krEnd(true); o.keins = KR.lohn.akt === -1;
      // Hauptleute der neuen Reiche: Sonderangriffe immer angekündigt
      const sonder = seite => { schlacht('hauptmann', seite); ruhe(); const p = krPos(.5, .5); P.x = p.x; P.y = p.y; const e = krFoe(REICHE[KR.foe].hpt, p.x + 70, p.y), arten = []; for (let n = 0; n < 2; n++) { KR.shots.length = 0; e.kr.mt = 0; e.kr.tt = 0; e.kr.sp = null; e.st = 'move'; e.cd = 99; schritte(.1, () => { P.inv = 9; }); arten.push(KR.shots.filter(x => !x.own).map(x => x.k + (x.max >= KR_WARN_MIN ? '' : '!')).join('+')); } return arten.join(' / '); };
      o.ragna = sonder('sylvara'); o.eryn = sonder('nordmark'); o.fern = krFernH(EN.kr_s_hauptmann) && !krFernH(EN.kr_n_hauptmann);
      unseed(); return o;
    });
    ok(K2.ragna === 'bahn / bolzen' && K2.eryn === 'pfeil / ring' && K2.fern, `Hauptleute: Schildbrecherin Ragna (${K2.ragna}), Waldmeisterin Eryn (${K2.eryn}, kämpft aus der Ferne) – alles mit Ankündigung`);
    ok(K2.fronten && !K2.wackelt && K2.vielfalt >= 4, `Fronten: je Kriegsgebiet zwei Reiche, fest für Held, Akt und Reihe – ${K2.vielfalt} verschiedene Fronten kommen vor`);
    ok(K2.wahl === 'nordmark,sylvara' && K2.seite, 'Seitenwahl zeigt die beiden Reiche der Front; gewählt wird gegen das andere');
    ok(K2.nord && K2.masch === 'pfeil:e,ballista:f,katapult:f', `Für Sylvara: eigener Pfeilwerfer, die Nordmark schießt mit Balliste und Katapult (${K2.masch}); für die Nordmark: eigene Balliste, Gegner Sylvara`);
    ok(K2.bolzen && K2.bolzenHit && K2.bolzenDaneben, 'Balliste: Bolzen als Streifen am Boden angekündigt (mindestens die Mindest-Vorwarnung); im Streifen Treffer, knapp daneben nichts');
    ok(K2.verrat1 && K2.verrat2, `Wer gegen ein Reich gewinnt, verliert dort ${5} Kriegsruf – nie unter null`);
    ok(K2.rufN === 31 && K2.rufH === 34 && K2.leben === 1.2 && K2.stoff >= 3, `Lohn und Ränge: Nordmark +25 % Kriegsruf (${K2.rufN}), als Hauptmann +10 % (${K2.rufH}); Marschall: Soldaten ×${K2.leben} Leben; Sylvara +2 Bannerstoff (${K2.stoff})`);
    ok(K2.akt && K2.neu && K2.schirm && K2.keins, 'Chronik Akt 1: drei Kapitel je Reich (nach 1, 3, 6 Siegen); der Sieg, der eins öffnet, zeigt es im Ergebnis zum Lesen');

    // Kriegskasse und Aufträge
    const Q = await ev(() => {
      const o = {}, R = krM().r.aurelien; R.mk = 5; const g0 = P.gold; kriegChronik('map'); o.offen = /CHRONIK DER KRONEN/.test(panel.textContent) && panel.querySelectorAll('[data-act="kr_kasse"]').length === 12 && /noch nicht an der Front/.test(panel.textContent);
      ON.kr_kasse('aurelien:gold'); o.kauf = R.mk === 2 && P.gold > g0; const g1 = P.gold; ON.kr_kasse('aurelien:gold'); o.arm = R.mk === 2 && P.gold === g1;
      R.mk = 99; for (let i = 0; i < 5; i++) ON.kr_kasse('aurelien:gold'); o.grenze = R.mk === 99 - 6 && krM().kasse.b['aurelien:gold'] === 3;
      P.mats.kriegseisen = 3; const gems = JSON.stringify(P.gems); ON.kr_kasse('aurelien:stein'); o.ohneMat = JSON.stringify(P.gems) === gems; P.mats.kriegseisen = 4; ON.kr_kasse('aurelien:stein'); o.mitMat = JSON.stringify(P.gems) !== gems && P.mats.kriegseisen === 0;
      ON.kr_kasse('konzil:gold'); o.fern = krM().r.konzil.mk === 0;
      krM().r.nordmark.mk = 9; P.mats.kriegseisen = 4; const gs = JSON.stringify(P.gems); ON.kr_kasse('nordmark:stein'); o.saphir = JSON.stringify(P.gems) !== gs && /saphir/.test(JSON.stringify(P.gems));
      // Aufträge: nur wenn Kriegsgebiete offen sind; Fortschritt über Siege und besiegte Soldaten
      const av = Object.keys(aufAvail(false)), aw = Object.keys(aufAvail(true)); o.auf = av.includes('krsieg') && av.includes('krsold') && aw.includes('krsieg');
      const H = aufSet(), mkq = (k, n) => ({ k, f: 'orden', n, c: 0, ok: 0, pd: 0, rw: [{ t: 'gold', n: 10 }], rep: 40, tok: 2 });
      H.dq[0] = mkq('krsieg', 1); H.dq[1] = mkq('krsold', 3); stat('krWin'); stat('krSold'); stat('krSold'); o.q1 = H.dq[0].ok === 1 && H.dq[1].c === 2 && !H.dq[1].ok; stat('krSold'); o.q2 = H.dq[1].ok === 1;
      o.text = aufText(H.dq[0]) + ' | ' + aufText(H.dq[1]);
      const c = newChar('mage', 'Frisch', 'normal', false); SAVE.chars.push(c); const kr = krM().n; krM().n = 0; activateChar(1); o.zu = !kriegOffen() && !Object.keys(aufAvail(false)).includes('krsieg'); krM().n = kr; activateChar(0);
      return o;
    });
    ok(Q.offen && Q.kauf && Q.arm && Q.grenze && Q.ohneMat && Q.mitMat && Q.fern && Q.saphir, 'Kriegskasse (Nordmark tauscht Saphire): Marken und Kriegsbeute gegen Gold und Edelsteine, begrenzt je Woche, nichts ohne genug Marken oder Material, ferne Reiche tauschen nicht');
    ok(Q.auf && Q.q1 && Q.q2 && Q.zu, 'Aufträge „Gewinne eine Schlacht“ und „Besiege Soldaten der Kronen“ – nur für Helden ab Akt 3 (' + Q.text + ')');

    // Endlose Lande: drei Kriegs-Biome, Soldaten beider Reiche, angekündigter Beschuss
    const E = await ev(([HERO_]) => {
      eval('(' + HERO_ + ')')(3, 20); const o = {}, K = Object.keys(KR_LANDE);
      o.bio = K.length === 3 && K.every(k => LANDE_BIOMES[k] && LANDE_BIOMES[k].n && LANDE_BIOMES[k].en.every(t => EN[t] && EN[t].kr) && KR_LANDE[k].every(a => KR_MASCH[a])) && LBIOK.slice(-3).join() === K.join();
      o.ringe = K.map(k => LANDE_BIOMES[k].r.join('–')).join(', ');
      o.pool = K.every(k => { const p = lPool(k, 20); return p.length >= 4 && p.every(t => EN[t].kr) && new Set(p.map(t => EN[t].kr[0])).size === 2; });
      // in der Welt suchen (wie tools/test/lande.js)
      const find = {}; for (let r = 8; r < 1510 && Object.keys(find).length < 3; r += r < 60 ? 1 : 4) for (let a = 0; a < 6.283; a += Math.max(.02, 2 / r)) { const c = lCell(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)); if (KR_LANDE[c.biome] && !find[c.biome]) find[c.biome] = c; }
      o.welt = K.filter(k => find[k]).length; o.ringOk = K.every(k => find[k] && Math.min(find[k].ring, LRMAX) >= LANDE_BIOMES[k].r[0] && Math.min(find[k].ring, LRMAX) <= LANDE_BIOMES[k].r[1]);
      // hinreisen: Beschuss nur mit Ankündigung, kein Beschuss außerhalb der Kriegs-Biome
      SAVE.meta.lande.tips = 0xffff; lBegin(); const ruhig = () => { LW.huntT = 1e9; LW.rivT = 1e9; for (const e of enemies) e.dead = true; enemies = []; LW.hurtT = -99; };
      ruhig(); KR.lt = .01; let aussen = 0; for (let i = 0; i < 120; i++) { ruhig(); P.inv = 9; update(1 / 60); aussen += KR.shots.length; }
      o.aussen = aussen === 0 && !KR_LANDE[lBioAt(P.x, P.y)];
      const c = find[K[0]]; lTeleport(c.sx * LCK + LOFF, c.sy * LCK + LOFF); ruhig(); lTick(.3); lTick(.3);
      o.drin = !!KR_LANDE[LW.reg && LW.reg.biome]; o.name = LW.reg && LANDE_BIOMES[LW.reg.biome].n;
      Math.random = mulberry(2); KR.lt = .01; let s = null; for (let i = 0; i < 90 && !s; i++) { ruhig(); P.inv = 9; update(1 / 60); s = KR.shots[0]; }
      o.schuss = !!s && s.max >= KR_WARN_MIN && !s.own && KR_LANDE[K[0]].includes(s.k === 'meteor' ? 'magie' : s.k); o.art = s && s.k;
      // der Einschlag trifft, wer in der Fläche steht – erst nach der Ankündigung; Krater bleibt als Spur
      KR.shots.length = 0; KR.lt = 1e9; P.hp = P.st.hp; const h0 = P.hp, sh = krShot('katapult', P.x, P.y, { team: 'x' }); let früh = false; for (let i = 0; i < Math.round((sh.max - .05) * 60); i++) { ruhig(); P.inv = 0; update(1 / 60); if (P.hp < h0) früh = true; } for (let i = 0; i < 12; i++) { ruhig(); P.inv = 0; update(1 / 60); }
      o.treffer = !früh && P.hp < h0 && KR.decals.length >= 1;
      // Soldaten zweier Reiche bekämpfen sich in den Landen; fällt einer durch den anderen, gibt es keine Erfahrung
      ruhig(); P.hp = P.st.hp; P.stealth = 1e9; const xp = P.xp, a = lSpawn('kr_a_ritter', P.x + 80, P.y), b = lSpawn('kr_k_soeldner', P.x + 96, P.y); for (let i = 0; i < 360; i++) { LW.huntT = 1e9; LW.rivT = 1e9; P.inv = 9; update(1 / 60); }
      o.kampf = a.strip && b.strip && (a.dead || a.hp < a.maxHp) && (b.dead || b.hp < b.maxHp) && P.xp === xp; P.stealth = 0;
      // Kulissen aus der Welt-Saat: zweimal dieselbe Liste
      const d1 = [], d2 = []; KR_LD.clear(); CX = Math.floor(P.x - VW / 2); CY = Math.floor(P.y - VH / 2); krLandeDeko(d1); KR_LD.clear(); krLandeDeko(d2); o.deko = d1.length === d2.length;
      Math.random = R0; ON.l_quit && 0; return o;
    }, [HERO.toString()]);
    ok(E.bio && E.pool, `Drei Kriegs-Biome hinten angefügt (Ringe ${E.ringe}): dort leben Soldaten beider Reiche`);
    ok(E.welt === 3 && E.ringOk, 'Alle drei Kriegs-Biome kommen in der Welt vor – nur in ihren Ringen');
    ok(E.aussen && E.drin && E.schuss, `Beschuss nur in den Kriegs-Biomen (${E.name}: ${E.art}), immer angekündigt`);
    ok(E.treffer && E.kampf && E.deko, 'Lande: Einschlag erst nach der Ankündigung, Krater bleibt; Soldaten bekämpfen sich ohne Erfahrung für den Helden; Kulissen aus der Welt-Saat');

    // Handbuch: Kapitel mit allen Einträgen, Verweise stimmen, Suche findet es
    await ev(HERO);
    const HB_ = await ev(() => {
      openHandbuch(null, 'title'); hbIndex(); const ids = ['krieg:gebiete', 'krieg:beschuss', 'krieg:deckung', 'krieg:ziele', 'krieg:reiche', 'krieg:beute'], o = { bad: [] };
      o.kap = HB.chs.some(c => c.k === 'krieg' && c.n === 'Krieg der Kronen'); o.da = ids.every(id => HB.by[id]);
      for (const id of ids) { const e = HB.by[id]; if (!e) continue; const h = e.b(); if (h.length < 200) o.bad.push(id + ' kurz'); for (const s of e.see) if (!HB.by[s]) o.bad.push(id + ' → ' + s); for (const g of e.go) if (!HBGO[g]) o.bad.push(id + ' ⇒ ' + g); }
      o.suche = ['Deckung', 'Pfeilhagel', 'Katapult', 'Kriegsruf', 'Splitterthron', 'Bannerträger'].map(w => (hbSearch(w)[0] || '').split(':')[0]).join();
      o.gegner = !!HB.by['en:kr_a_ritter'] && HB.by['en:kr_a_ritter'].b().includes('Soldat') && !!HB.by['mat:kriegseisen'] && !!HB.by['bio:kr_schildgraben'];
      o.karte = HB.by['start:karte'].b().includes('Kriegsgebiet'); hideOverlay(); return o;
    });
    ok(HB_.kap && HB_.da && !HB_.bad.length, 'Handbuch-Kapitel „Krieg der Kronen“: Gebiete, Beschuss, Deckung, Ziele, Reiche, Beute – alle Verweise stimmen' + (HB_.bad.length ? ' ' + HB_.bad.join('; ') : ''));
    ok(HB_.suche === 'krieg,krieg,krieg,krieg,krieg,krieg' && HB_.gegner && HB_.karte, 'Die Suche findet Deckung, Pfeilhagel, Katapult, Kriegsruf, Splitterthron und Bannerträger im Kapitel; Soldaten, Material und Biome haben eigene Einträge' + (HB_.suche === 'krieg,krieg,krieg,krieg,krieg,krieg' ? '' : ' (' + HB_.suche + ')'));
    ok(!errs.length, 'keine Fehler im Spiel (Regeln)' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await page.close();
  }

  // Bildzeit: volle Schlacht (Obergrenze Soldaten, alle Arten Beschuss, Feuer, Rauch) im Pixel-Modus auf dem Handy-Format. Bestes von drei wie in pc.js.
  console.log('\nKrieg der Kronen – Leistung');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage(); await page.goto(BASE + 'index.html'); await page.waitForTimeout(1200);
    await page.evaluate(TOOLS); await page.evaluate(HERO);
    const p = await page.evaluate(() => {
      P.hp = P.st.hp = 1e7; SAVE.meta.settings.gfx = 'px'; resize();
      const mess = (auf, vor) => { let best = 1e9, bu = 0; for (let r = 0; r < 3; r++) { auf(); let t = 0, u = 0; for (let i = 0; i < 120; i++) { vor(i); const t0 = performance.now(); update(1 / 60); const t1 = performance.now(); render(); ctx.getImageData(0, 0, 1, 1); t += performance.now() - t0; u += t1 - t0; } if (t / 120 < best) { best = t / 120; bu = u / 120; } } return [+best.toFixed(2), +bu.toFixed(2)]; };
      const o = { hd: HD, vw: VW, vh: VH };
      o.kampf = mess(() => { seed(1); startRoom('kampf', 2); G.waves = []; G.pending = []; G.phase = 'fight'; enemies = []; for (let i = 0; i < 18; i++) spawnEnemy(pick(['goblin', 'skeleton', 'orc', 'gobarcher', 'mage']), { instant: true }); setState('play'); hideOverlay(); }, () => { P.inv = 9; });
      const voll = () => { seed(1); schlacht('hauptmann', 'aurelien'); KR.ht = 0; const S = REICHE.aurelien, F = REICHE.karth; let g = 0; while (krCount() < KR_CAP - 1 && g++ < 80) { const q = krPos(.3 + Math.random() * .4, Math.random()); if (g % 2) krAlly(pick(S.einh), q.x, q.y); else krFoe(pick(F.einh), q.x, q.y); } };
      let maxU = 0, maxS = 0, maxF = 0;
      o.krieg = mess(voll, i => { P.inv = 9; KR.moral = 60; if (i % 24 === 0) { krShot('pfeil', P.x + 30, P.y - 20); krShot('katapult', P.x - 40, P.y - 30, { from: KR.machs[1] }); krShot('magie', P.x, P.y - 60); if (i % 48 === 0) { krShot('ring', P.x + 50, P.y + 20); krShot('bahn', P.x - 60, P.y, { ang: .3 }); } } maxU = Math.max(maxU, krCount()); maxS = Math.max(maxS, KR.shots.length); maxF = Math.max(maxF, KR.fires.length); });
      o.maxU = maxU; o.maxS = maxS; o.maxF = maxF; o.hpt = !!KR.hpt; unseed(); return o;
    });
    console.log(`  390×844 Pixel-Modus (${p.vw}×${p.vh} Spielpixel): Kampf mit 18 Gegnern ${p.kampf[0]} ms, volle Schlacht ${p.krieg[0]} ms je Bild (davon Rechnen ${p.krieg[1]} ms) – ${p.maxU} Soldaten, bis ${p.maxS} Ankündigungen, ${p.maxF} Brände`);
    ok(!p.hd && p.maxU === 22 && p.hpt && p.maxS >= 8 && p.maxF >= 5, `Messung unter Volllast: ${p.maxU} Soldaten (Obergrenze) mit Hauptmann, ${p.maxS} Ankündigungen zugleich, ${p.maxF} Brände`);
    ok(p.krieg[0] < 8 && p.krieg[1] < 1.5, `Volle Schlacht braucht ${p.krieg[0]} ms je Bild ohne Grafikkarte (Schranke 8 ms, 60 Bilder/s = 16,7 ms) – reichlich Luft fürs Handy`);
    await ctx.close();
  }

  // Getippter Ablauf mit Bildschirmfotos: Handy hoch, Handy quer, PC
  for (const [w, h, nm, touch] of [[390, 844, 'hoch', true], [844, 390, 'quer', true], [1280, 720, 'pc', false]]) {
    console.log(`\nKrieg der Kronen – Ablauf ${w}×${h}${touch ? ' (Touch)' : ' (Maus)'}`);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'de-DE', hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(BASE + 'index.html'); await page.waitForTimeout(1200);
    const ev = (f, a) => page.evaluate(f, a), shot = n => page.screenshot({ path: `${OUT}/${nm}-${n}.png` });
    const tap = async sel => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); if (touch) await el.tap(); else await el.click(); await page.waitForTimeout(160); };
    // nichts ragt aus dem Bild, Knöpfe sind groß genug (Touch: 44 px)
    const layout = () => ev(touch => { const r = [], vw = innerWidth, vh = innerHeight; for (const b of panel.querySelectorAll('button')) { const q = b.getBoundingClientRect(); if (!q.width) continue; const kopf = !!b.closest('.head'); if (q.left < -1 || q.right > vw + 1) r.push('breit: ' + b.textContent.trim().slice(0, 24)); if (touch && !kopf && q.height < 43.5) r.push('klein (' + Math.round(q.height) + '): ' + b.textContent.trim().slice(0, 24)); } if (panel.scrollWidth > panel.clientWidth + 2) r.push('Tafel scrollt quer'); return r; }, touch);
    await ev(TOOLS); await ev(HERO);
    const k = await ev(() => { const k = vorKrieg(); saveChar(); openMap(); return k; });
    await shot('1-karte');
    const node = `.node.av[data-i="${k[1]}"]`;
    ok(await ev(sel => { const n = panel.querySelector(sel); return !!n && n.getAttribute('aria-label') === 'Kriegsgebiet' && n.querySelector('img').naturalWidth > 0; }, node), 'Karte: das Kriegsgebiet ist antippbar und trägt die gekreuzten Banner');
    const waehle = async sel => { if (!(await ev(() => !!panel.querySelector('[data-act="enter"]') && /Kriegsgebiet/.test(panel.querySelector('.mapinfo').textContent)))) await tap(sel); };   // ein einziger Weg: der Ort ist schon gewählt
    await waehle(node);
    ok(await ev(() => /Kriegsgebiet/.test(panel.querySelector('.mapinfo').textContent) && /Zwei Heere/.test(panel.querySelector('.mapinfo').textContent)), 'Karte: Info zum Ort erklärt das Kriegsgebiet');
    await ev(() => { window.krFront = () => ['aurelien', 'karth']; });   // getippter Ablauf: Front Aurelien gegen Karth
    await tap('[data-act="enter"]');
    // Prolog beim ersten Mal: sieben Szenen mit Sprechern
    const pro = []; for (let i = 0; i < 9; i++) { const t = await ev(() => panel.querySelector('.dlg') ? { b: (panel.querySelector('.dlg b') || {}).textContent || '', p: panel.querySelector('.dlg p').textContent, img: !!panel.querySelector('.dlg img'), h: (panel.querySelector('h2') || {}).textContent || '' } : null); if (!t) break; pro.push(t); if (i === 2) await shot('2-prolog'); await tap('[data-act="dlgnext"]'); }
    ok(pro.length === 7 && pro.every(t => /Prolog/.test(t.h)) && pro.some(t => /Caspian/.test(t.b) && t.img) && pro.some(t => /Nessa/.test(t.b) && t.img) && pro.some(t => /Borin/.test(t.b)) && /Splitter/.test(pro[1].p) && pro[4].p.includes('Söldner') && !pro.some(t => t.p.includes('{name}')), `Prolog der Chronik beim ersten Kriegsgebiet: ${pro.length} Szenen (Erzähler, Herold von Aurelien, Zahlmeisterin von Karth, Borin)`);
    // Seite wählen
    const wahl = await ev(() => ({ on: /KRIEGSGEBIET/.test(panel.textContent), n: panel.querySelectorAll('.krside').length, ziel: (panel.querySelector('.krziel') || {}).textContent || '', lohn: [...panel.querySelectorAll('.krside .lo')].map(e => e.textContent).join(' | '), pro: krM().pro, state }));
    ok(wahl.on && wahl.n === 2 && /LINIE HALTEN/.test(wahl.ziel) && /Gold/.test(wahl.lohn) && /Kriegseisen/.test(wahl.lohn) && wahl.pro === 1, 'Seitenwahl: beide Reiche mit Angebot und Lohn, das Ziel der Schlacht steht oben');
    const lw = await layout(); ok(!lw.length, 'Seitenwahl passt aufs Bild' + (lw.length ? ': ' + lw.join('; ') : ''));
    await shot('3-seitenwahl');
    // Zurück: der Ort bleibt wählbar
    await tap('[data-act="kr_zurueck"]');
    ok(await ev(() => state === 'map' && availableNodes().length > 0 && !P.map.rows.flat().some(n => n.t === 'krieg' && n.done)), 'Seitenwahl → Zurück: wieder auf der Karte, der Ort ist nicht verbraucht');
    await waehle(node); await tap('[data-act="enter"]');
    ok(await ev(() => !panel.querySelector('.dlg') && panel.querySelectorAll('.krside').length === 2), 'Zweites Betreten: kein Prolog mehr, gleich die Seitenwahl');
    await tap('[data-act="kr_seite"][data-id="aurelien"]');
    await page.waitForTimeout(600);
    const st1 = await ev(() => ({ on: KR.on, side: KR.side, ziel: KR.ziel, state, hud: !$('krhud').hidden, titel: $('krT').textContent, moral: $('krMl').textContent, obj: $('objective').textContent, boss: $('bossbar').hidden, room: $('hudRoom').textContent }));
    ok(st1.on && st1.side === 'aurelien' && st1.ziel === 'linie' && st1.state === 'play' && st1.hud && st1.titel === 'HALTE DIE LINIE' && st1.moral === 'MORAL' && st1.boss && st1.room === 'KRIEGSGEBIET', 'Schlacht läuft: Ziel und Moral stehen oben, klar lesbar');
    // Anzeige überdeckt weder die Leiste oben noch die Knöpfe
    const hudBox = await ev(() => { const a = $('krhud').getBoundingClientRect(), h = $('hud').getBoundingClientRect(), bs = [...document.querySelectorAll('#touch button, #skillbar button, #hud button')].map(b => b.getBoundingClientRect()).filter(q => q.width), hit = bs.some(q => !(q.right < a.left || q.left > a.right || q.bottom < a.top || q.top > a.bottom)), kids = [...$('hud').children].map(c => c.getBoundingClientRect()).filter(q => q.width), over = kids.some(q => !(q.right < a.left + 2 || q.left > a.right - 2 || q.bottom < a.top + 1 || q.top > a.bottom)); return { hit, over, in: a.left >= 0 && a.right <= innerWidth + 1 && a.top > 0, w: Math.round(a.width), top: Math.round(a.top), bot: Math.round(a.bottom) }; });
    ok(hudBox.in && !hudBox.hit && !hudBox.over, `Schlacht-Anzeige (${hudBox.w} px breit, ${hudBox.top}–${hudBox.bot} px) liegt frei: keine Knöpfe, keine Lebensleiste darunter`);
    // Beschuss vor die Kamera holen: alle drei Arten gleichzeitig, der Held steht daneben
    await ev(() => { seed(3); P.inv = 1e9; KR.moral = 60; for (const m of KR.machs) m.cd = 99; KR.shots.length = 0; krShot('katapult', P.x - 44, P.y - 34, { team: KR.foe, from: KR.machs[1] }); krShot('pfeil', P.x + 46, P.y - 6, { team: KR.foe }); krShot('magie', P.x - 6, P.y + 52, { team: KR.foe }); });
    await page.waitForTimeout(650); await shot('4-beschuss-frueh');
    await page.waitForTimeout(520); await shot('5-beschuss-spaet');
    await page.waitForTimeout(700); await shot('6-einschlag');
    // in Deckung: Schild über dem Helden
    await ev(() => { const g = KR.graben[0]; P.x = (g.x0 + g.x1) / 2; P.y = (g.y0 + g.y1) / 2; P.vx = P.vy = 0; cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - VH / 2, 0, Math.max(0, AH - VH)); krShot('pfeil', P.x, P.y, { team: KR.foe }); });
    await page.waitForTimeout(700); await shot('7-deckung');
    ok(await ev(() => krCover(P.x, P.y) === 1), 'Im Graben: Deckung (Schild über dem Helden)');
    // Sieg erzwingen → Ergebnis
    await ev(() => { P.inv = 1e9; KR.zt = .05; });
    await page.waitForFunction(() => state === 'menu' && /SIEG/.test(panel.textContent), null, { timeout: 8000 });
    await page.waitForTimeout(500); await shot('8-sieg');
    const ls = await layout(); ok(!ls.length, 'Sieg-Bildschirm passt aufs Bild' + (ls.length ? ': ' + ls.join('; ') : ''));
    await tap('[data-act="kr_weiter"]');
    ok(await ev(() => state === 'map' && P.map.rows.flat().filter(n => n.t === 'krieg' && n.done).length === 1 && krRuf('aurelien') >= 25), 'Weiter: zurück auf der Karte, das Kriegsgebiet ist erledigt, Kriegsruf gutgeschrieben');
    // Karte → Mehr → Chronik der Kronen → Prolog noch einmal lesen
    await tap('[data-act="mapmore"]');
    ok(await ev(() => !!panel.querySelector('[data-act="kr_chronik"]') && /Chronik der Kronen/.test(panel.querySelector('[data-act="kr_chronik"]').textContent)), 'Karte → Mehr: Eintrag „Chronik der Kronen“');
    const lm = await layout(); ok(!lm.length, '„Mehr“ passt mit dem neuen Eintrag aufs Bild' + (lm.length ? ': ' + lm.join('; ') : ''));
    await tap('[data-act="kr_chronik"]');
    const chr = await ev(() => ({ t: /CHRONIK DER KRONEN/.test(panel.textContent), reiche: panel.querySelectorAll('.krrow:not(.krakt)').length, fern: panel.querySelectorAll('.krrow.aus').length, akt: panel.querySelectorAll('.krakt').length, akt1: !!panel.querySelector('[data-act="kr_akt"][data-id="aurelien:0"]'), lesen: !!panel.querySelector('[data-act="kr_prolog"]'), ruf: /SÖLDNER · 25/.test(panel.textContent) }));
    ok(chr.t && chr.reiche === 5 && chr.fern === 1 && chr.akt === 4 && chr.akt1 && chr.lesen && chr.ruf, 'Chronik: fünf Reiche (das Schattenkonzil noch nicht an der Front), Akt 1 je Reich (erstes Kapitel Aureliens offen), Kriegsruf und Rang, Prolog zum Nachlesen');
    await tap('[data-act="kr_akt"][data-id="aurelien:0"]');
    const ak = await ev(() => ({ dlg: !!panel.querySelector('.dlg'), h: (panel.querySelector('h2') || {}).textContent || '', b: (panel.querySelector('.dlg b') || {}).textContent || '' }));
    ok(ak.dlg && /Akt 1/.test(ak.h) && /Isaure/.test(ak.b), 'Akt 1 · Aurelien, Kapitel 1 lässt sich lesen (Marschallin Isaure spricht)');
    await shot('5b-akt1'); await tap('[data-act="dlgnext"]'); await tap('[data-act="dlgnext"]');
    ok(await ev(() => /CHRONIK DER KRONEN/.test(panel.textContent) && krM().ch.a1_aurelien_0 === 1), 'Nach dem Kapitel zurück in der Chronik, als gelesen gemerkt');
    const lc = await layout(); ok(!lc.length, 'Chronik passt aufs Bild' + (lc.length ? ': ' + lc.join('; ') : ''));
    await shot('9-chronik');
    await ev(() => { panel.scrollTop = 9999; }); await page.waitForTimeout(150); await shot('9b-chronik-unten');
    await tap('[data-act="kr_prolog"]');
    ok(await ev(() => !!panel.querySelector('.dlg') && /Prolog/.test(panel.querySelector('h2').textContent)), 'Prolog lässt sich noch einmal lesen');
    await tap('[data-act="dlgskip"]');
    ok(await ev(() => /CHRONIK DER KRONEN/.test(panel.textContent)), 'Nach dem Prolog zurück in der Chronik');
    await tap('[data-act="kr_chrzu"]');
    ok(await ev(() => state === 'map'), 'Chronik → Zurück: Karte');
    // Niederlage ansehen (zweite Schlacht: Maschine nehmen, für Karth)
    await ev(() => { P.map = genMap(3); const k = vorKrieg(); openMap(); window.__k = k; });
    await waehle(`.node.av[data-i="${await ev(() => __k[1])}"]`); await tap('[data-act="enter"]');
    ok(await ev(() => /KRIEGSMASCHINE NEHMEN/.test(panel.querySelector('.krziel').textContent)), 'Nächste Schlacht, nächstes Ziel: Kriegsmaschine nehmen');
    await tap('[data-act="kr_seite"][data-id="karth"]'); await page.waitForTimeout(500);
    // zum Ziel laufen (hier gesetzt), Maschine und Wachen im Bild
    await ev(() => { P.inv = 1e9; const m = KR.zm; P.x = m.x + (KR.geo.hz ? 60 : -30); P.y = m.y + (KR.geo.hz ? 20 : 60); cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - 10 - VH / 2, 0, Math.max(0, AH - VH)); for (const e of enemies) if (e.kr) { e.cd = 3; } });
    await page.waitForTimeout(900); await shot('10-maschine');
    // das Ziel liegt frei: weder unter der Anzeige oben noch unter den Knöpfen (Hochformat: Feind oben unter der Anzeige, Querformat: Feind links)
    const frei = await ev(() => { const m = KR.zm, x = VIEW.ox + (m.x - cam.x) * SCALE, y = (m.y - 12 - cam.y) * SCALE, r = 14 * SCALE, box = [...document.querySelectorAll('#krhud, #hud > *, #touch button, #skillbar button, #lhud')].map(e => e.getBoundingClientRect()).filter(q => q.width && q.height), hit = box.filter(q => x + r > q.left && x - r < q.right && y + r > q.top && y - r < q.bottom).length; return { hit, x: Math.round(x), y: Math.round(y), in: x > r && x < innerWidth - r && y > r && y < innerHeight - r }; });
    ok(frei.in && !frei.hit, `Die Kriegsmaschine des Feindes liegt frei im Bild (${frei.x}, ${frei.y}) – nicht unter Anzeige oder Knöpfen`);
    ok(await ev(() => /KATAPULT/.test($('krT').textContent) && !$('krZr').hidden && $('krZl').textContent === 'MASCHINE'), 'Ziel „Maschine“: Name der Maschine und ihr Leben stehen oben');
    await ev(() => { krMoral(-200); });
    await page.waitForFunction(() => state === 'menu' && /VERLOREN/.test(panel.textContent), null, { timeout: 8000 });
    await page.waitForTimeout(400); await shot('11-niederlage');
    const ln = await layout(); ok(!ln.length, 'Niederlage-Bildschirm passt aufs Bild' + (ln.length ? ': ' + ln.join('; ') : ''));
    await tap('[data-act="kr_nochmal"]'); await page.waitForTimeout(300);
    ok(await ev(() => KR.on && !KR.aus && KR.side === 'karth' && KR.ziel === 'maschine' && state === 'play'), 'Schlacht wiederholen: gleiche Seite, gleiches Ziel');
    // Hauptmann und Bannerträger fürs Foto
    await ev(() => { seed(7); schlacht('hauptmann', 'aurelien'); KR.ht = 0; P.inv = 1e9; const p = krPos(.5, .5); P.x = p.x; P.y = p.y; schritte(.2, () => { P.inv = 9; }); const e = KR.hpt; e.x = P.x - (KR.geo.hz ? 70 : -20); e.y = P.y - (KR.geo.hz ? 10 : 70); e.kr.mt = 0; e.kr.n = 0; cam.x = clamp(P.x - VW / 2, 0, Math.max(0, AW - VW)); cam.y = clamp(P.y - 10 - VH / 2, 0, Math.max(0, AH - VH)); unseed(); });
    await page.waitForTimeout(800); await shot('12-hauptfrau');
    await ev(() => { schlacht('banner', 'karth'); P.inv = 1e9; const u = KR.traeger; P.x = u.x + 24; P.y = u.y - 10; });
    await page.waitForTimeout(1500); await shot('13-bannertraeger');
    ok(await ev(() => /BANNERTRÄGER/.test($('krT').textContent) && $('krZl').textContent === 'TRÄGER'), 'Ziel „Bannerträger“: Fortschritt und Leben des Trägers stehen oben');
    ok(!errs.length, 'keine Fehler im Spiel' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(fails.length ? `\n${fails.length} FEHLER` : '\nKrieg der Kronen: alles grün');
  process.exit(fails.length ? 1 : 0);
})();
