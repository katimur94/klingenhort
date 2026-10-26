'use strict';
/* =========================================================
   KLINGENHORT – Kreaturen 2.0 – Eier finden, im Brutnest pflegen, schlüpfen lassen, aufziehen, züchten, ausrüsten
   77 Kreaturen in sieben Seltenheiten (Plunder … Mythisch): die 24 alten, Monster-Kreaturen passend zu den Gegnern,
   Kreaturen der Gebiete und 16 Hybride aus der Zucht – jede mit eigener Pixel-Grafik und sechs Entwicklungsstufen.
   Gene (Kraft, Tempo, Zähigkeit, Magie, Glück), sichtbare Mutationen, Ausrüstung (Halsband, Panzer, Talisman),
   Talente (Angriff, Schutz, Sammler – Sammler gibt Beutelplätze), Zauberrunen, die der Begleiter im Kampf wirkt.
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein: Brutnest-Station im Versteck (Bild, Symbol, Bildschirm).
   Konto: SAVE.meta.pets = { list: [{ id, sp, nm, lv, xp, col, c0, shiny, k, born, nw, bag: [Beute], hurt: Zeit,
       gn: [Kraft, Tempo, Zähigkeit, Magie, Glück 0–100], mu: Mutation, tl: '15 Ziffern' (Talentränge), eq: { h, p, t } (Ausrüstung),
       mg: [Rune, Rune, Rune] (Zauber), zt: letzte Zucht, pa: [Art, Art] (Eltern), ge: Generation }], act: id,
     eggs: [{ id, v: 2, sp, tier, got, need, nest, w, f, z, t, born, gn?, mu?, pa?, ge?, c0? }], hatched, first, intro, fromBoss, seen: [sp], cw, starter (alt),
     gear: [Ausrüstung im Lager], runes: { Zauber: Anzahl }, mut: [entdeckte Mutationen], bred: Zuchten }
   Ausrüstung: { id, s: 'h'|'p'|'t', r: 0–4 (Seltenheit), lv: Stufe 1–100, a: { Wert: Zahl } }
   Schnittstelle: petActive() · petSel() · petBagSize(p) (mit Talent „Große Taschen“) · p.bag · petBagAdd/petBagTake · petHurt(p, min) · petIsHurt(p)
     eggGive(sp, quiet, { tier, luck }) · eggRoll(tier) · eggTierRoll(luck, R) · PET_TIERS · petGive(sp, o)
     eggForBiome(biome, depth, luck, R) → { egg: 1, sp, tier } (Ei für die Welt, auch für unbekannte Gebiete) · PET_BIOME · PET_HABS · PET_MON
     petExport(i, keep) · eggExport(i, keep) · petImport(data) · petLabel(d) · petIconURL(d) · openNest(back)
     petLootFix(e) nimmt auch { t: 'mod', k, n } (Mods aus js/mods.js) · petBreedRoll(a, b, R) (Zucht, auch mit festem Zufall)
   ========================================================= */

/* ---------- Daten ---------- */
const PET_MAX = 60, EGG_MAX = 9, NEST_MAX = 3, EGG_NEED = 150;
/* Seltenheiten: Stärke (mul), Beutel-Plätze, Pflegezeit bis zum Schlüpfen (Sekunden), wie lange Wärme/Futter/Zuwendung halten (Stunden),
   Futter (erste bezahlbare Wahl wird genommen, Gold nur bei einfachen Eiern), Eiername */
const PET_TIERS = [
  { k: 'plunder', n: _t('Plunder'), egg: _t('Plunder-Ei'), c: '#9a9088', mul: .3, bag: 1, care: 1200, dur: [8, 10, 6], food: [['leder', 2], ['schleim', 2], ['knochen', 2], ['gold', 10]] },
  { k: 'gewoehnlich', n: _t('Gewöhnlich'), egg: _t('Gewöhnliches Ei'), c: '#d8d0c0', mul: .5, bag: 1, care: 2400, dur: [7, 9, 5], food: [['leder', 3], ['schleim', 3], ['knochen', 3], ['zahn', 2], ['gold', 25]] },
  { k: 'ungewoehnlich', n: _t('Ungewöhnlich'), egg: _t('Ungewöhnliches Ei'), c: '#57a7d6', mul: .75, bag: 2, care: 7200, dur: [6, 8, 4.5], food: [['zahn', 3], ['knochen', 5], ['kristall', 1], ['horn', 1], ['gold', 80]] },
  { k: 'selten', n: _t('Selten'), egg: _t('Seltenes Ei'), c: '#e8d04a', mul: 1, bag: 2, care: 6 * 3600, dur: [5, 7, 4], food: [['kristall', 2], ['horn', 2], ['glut', 2], ['mithril', 1]] },
  { k: 'episch', n: _t('Episch'), egg: _t('Episches Ei'), c: '#b892f4', mul: 1.2, bag: 3, care: 14 * 3600, dur: [4.5, 6, 3.5], food: [['glut', 3], ['mithril', 2], ['schuppe', 2], ['adamant', 2]] },
  { k: 'legendaer', n: _t('Legendär'), egg: _t('Legendäres Ei'), c: '#ff8a3a', mul: 1.4, bag: 4, care: 30 * 3600, dur: [4, 5.5, 3], food: [['schuppe', 2], ['adamant', 2], ['stern', 1]] },
  { k: 'mythisch', n: _t('Mythisch'), egg: _t('Mythisches Ei'), c: '#ff4fd8', mul: 1.6, bag: 5, care: 60 * 3600, dur: [3.5, 5, 3], food: [['stern', 1], ['aether', 1]] }
];
// Chancen der Seltenheiten bei Glück 0 (Kampagne); mehr Glück (Verlorene Lande, Truhen) verschiebt nach oben
const EGG_W = [30, 34, 20, 10, 4.5, 1.3, .1];
const PET_STAGE = [1, 10, 25, 50, 75, 100];
const PET_STN = [_t('Baby'), _t('Jung'), _t('Stark'), _t('Erwachsen'), _t('Uralt'), _t('Mythisch')];
const PET_EL = {
  feuer: { n: _t('Feuer'), c: '#ff8a3a', c2: '#ffd24a', rgb: '255,140,60' }, frost: { n: _t('Frost'), c: '#8ee6ff', c2: '#e8f8ff', rgb: '150,220,255' },
  blitz: { n: _t('Blitz'), c: '#9ad0ff', c2: '#fffbe0', rgb: '170,210,255' }, gift: { n: _t('Gift'), c: '#79c24e', c2: '#c8f06a', rgb: '140,220,90' },
  licht: { n: _t('Licht'), c: '#ffe08a', c2: '#fffbe0', rgb: '255,230,150' }, schatten: { n: _t('Schatten'), c: '#b892f4', c2: '#e0c8ff', rgb: '190,150,250' }
};
/* Arten: Seltenheit (t), Element, fliegt?, Lieblingsfutter, Passiv ab LV 25 (Wert bei 25 → bei 100), Angriff (atk: fire, ice, beam, zap, claw, bite, spit),
   Spezialangriff ab LV 50 (spec: breath, leap, nova, freeze, cloud, storm), Texte, Grundfarben (m Körper, a Akzent, b Horn/Bauch, w Flügel, e Auge, g Glanz) */
const PET_SP = {
  drache: {
    n: _t('Glutdrache'), t: 4, el: 'feuer', fly: 1, fav: 'glut', atk: 'fire', spec: 'breath', pas: { dmg: [.03, .15] }, st: _t('Fliegt und spuckt Feuer.'),
    an: _t('Glutspucke'), ad: _t('Spuckt Feuerkugeln, die Gegner in Brand setzen.'), pn: _t('Glutherz'), sn: _t('Feueratem'), sd: _t('Speit einen Flammenkegel, der alles in Brand setzt.'),
    pal: { m: ['#6a1a14', '#b8302a', '#e8602a', '#ffa060'], a: ['#c8802a', '#ffc040', '#fff0a0'], b: ['#8a8070', '#d8d0b8', '#fffaf0'], w: ['#8a2a1e', '#e8783a', '#ffb878'], e: '#ffe04a', g: '#ffd24a' }
  },
  katze: {
    n: _t('Geisterkatze'), t: 3, el: 'schatten', fly: 0, fav: 'kristall', atk: 'claw', spec: 'leap', crit: .18, pas: { critdmg: [.1, .5] }, st: _t('Schleicht und springt aus dem Schatten.'),
    an: _t('Schattensatz'), ad: _t('Springt Gegner an und zerkratzt sie – oft kritisch.'), pn: _t('Katzenkrallen'), sn: _t('Schattensprung'), sd: _t('Springt blitzschnell von Gegner zu Gegner – jeder Treffer kritisch.'),
    pal: { m: ['#4e4282', '#8072b8', '#b4a8e4', '#ebe6ff'], a: ['#5a3ab0', '#9a6af0', '#e0c8ff'], b: ['#2a2040', '#4a3e6a', '#7a6e9a'], w: ['#5a3ab0', '#9a6af0', '#e0c8ff'], e: '#5ae8ff', g: '#c8a0ff' }
  },
  kaefer: {
    n: _t('Goldkäfer'), t: 3, el: 'licht', fly: 1, fav: 'schuppe', atk: 'beam', spec: 'nova', pas: { gold: [.1, .5], loot: [.03, .15] }, st: _t('Sammelt Gold und blendet mit Licht.'),
    an: _t('Lichtstrahl'), ad: _t('Blendet Gegner mit gleißenden Lichtstrahlen.'), pn: _t('Goldrausch'), sn: _t('Sonnenglanz'), sd: _t('Heilt dich und versengt alle Gegner um dich herum.'),
    pal: { m: ['#7a4a14', '#c08a24', '#f0c040', '#fff4b0'], a: ['#8a2a1e', '#d8502a', '#ff9a5a'], b: ['#3e2a1a', '#6a4a2e', '#946a44'], w: ['#6a98b8', '#b4daf0', '#f0fbff'], e: '#1a1420', g: '#fff6c0' }
  },
  eule: {
    n: _t('Frosteule'), t: 3, el: 'frost', fly: 1, fav: 'mithril', atk: 'ice', spec: 'freeze', pas: { xp: [.04, .2] }, st: _t('Weise, flauschig und eiskalt.'),
    an: _t('Eissplitter'), ad: _t('Schießt Eissplitter, die Gegner verlangsamen.'), pn: _t('Eulenweisheit'), sn: _t('Schneesturm'), sd: _t('Friert alle Gegner um die Eule kurz ein.'),
    pal: { m: ['#2a4468', '#4a7eb0', '#8ac0e6', '#dcf2ff'], a: ['#a8c4dc', '#d8ecf8', '#ffffff'], b: ['#a8641c', '#e8a030', '#ffd870'], w: ['#203858', '#386898', '#68a4d4'], e: '#ffd24a', g: '#bfefff' }
  },
  natter: {
    n: _t('Giftnatter'), t: 3, el: 'gift', fly: 0, fav: 'schleim', atk: 'bite', spec: 'cloud', pas: { pgift: [.05, .25] }, st: _t('Flink, giftig und anhänglich.'),
    an: _t('Giftbiss'), ad: _t('Schlängelt sich heran und vergiftet mit jedem Biss.'), pn: _t('Giftzahn'), sn: _t('Giftwolke'), sd: _t('Spuckt eine Giftwolke, die alle Gegner darin vergiftet.'),
    pal: { m: ['#163412', '#2a6420', '#4e9c32', '#9ad858'], a: ['#a08a28', '#dcc040', '#fff0a0'], b: ['#4a2460', '#7e44a0', '#c088e0'], w: ['#2e5a24', '#5aa83a', '#b8e870'], e: '#ffd24a', g: '#c8f06a' }
  },
  funke: {
    n: _t('Sturmfunke'), t: 4, el: 'blitz', fly: 1, fav: 'erz', atk: 'zap', spec: 'storm', pas: { aspd: [.03, .12] }, st: _t('Knistert vor Energie.'),
    an: _t('Kettenblitz'), ad: _t('Ein Blitz springt von Gegner zu Gegner.'), pn: _t('Funkenflug'), sn: _t('Gewitter'), sd: _t('Lässt Blitze auf mehrere Gegner niederfahren.'),
    pal: { m: ['#24307a', '#3e6ad0', '#86c0ff', '#e8f6ff'], a: ['#b8881a', '#ffd84a', '#fffbe0'], b: ['#3e4460', '#6a7090', '#a4acc4'], w: ['#b8881a', '#ffd84a', '#fffbe0'], e: '#1a1420', g: '#fffbe0' }
  },
  /* --- Plunder: schwach, aber niedlich --- */
  schnecke: {
    n: _t('Schnecke'), t: 0, el: 'gift', fly: 0, fav: 'schleim', atk: 'spit', spec: 'cloud', pas: { hp: [.01, .05] }, st: _t('Langsam, schleimig und erstaunlich zäh.'),
    an: _t('Schleimspucke'), ad: _t('Spuckt klebrigen Schleim, der Gegner vergiftet.'), pn: _t('Schneckenhaus'), sn: _t('Schleimspur'), sd: _t('Hinterlässt eine giftige Schleimpfütze.'),
    pal: { m: ['#34442a', '#5e7a3e', '#8aaa58', '#c8e090'], a: ['#6a3a1e', '#a8642e', '#e0a050'], b: ['#8a8070', '#d8d0b8', '#fffaf0'], w: ['#2e4a24', '#5aa83a', '#b8e870'], e: '#1a1420', g: '#c8f06a' }
  },
  assel: {
    n: _t('Kellerassel'), t: 0, el: 'schatten', fly: 0, fav: 'knochen', atk: 'bite', spec: 'leap', pas: { def: [1, 6] }, st: _t('Rollt sich bei Gefahr ein. Bei jeder Gefahr.'),
    an: _t('Kneifer'), ad: _t('Krabbelt heran und zwickt.'), pn: _t('Panzerplatten'), sn: _t('Kugelrollen'), sd: _t('Rollt als Kugel von Gegner zu Gegner.'),
    pal: { m: ['#34324a', '#56546e', '#82809c', '#bab8d0'], a: ['#4a3a6a', '#8a6ac0', '#d0b8ff'], b: ['#4a4058', '#8a7e9a', '#c0b4cc'], w: ['#2a2040', '#4a3e6a', '#7a6e9a'], e: '#e0c8ff', g: '#c8a0ff' }
  },
  taube: {
    n: _t('Taube'), t: 0, el: 'licht', fly: 1, fav: 'knochen', atk: 'beam', spec: 'nova', pas: { gold: [.02, .08] }, st: _t('Gurrt, pickt und findet immer etwas Glänzendes.'),
    an: _t('Lichtgurren'), ad: _t('Gurrt einen schwachen Lichtstrahl.'), pn: _t('Fundstücke'), sn: _t('Friedensflug'), sd: _t('Heilt dich ein wenig und blendet Gegner um dich herum.'),
    pal: { m: ['#4a5060', '#7a8494', '#a8b2c0', '#e6eaf0'], a: ['#2e6a64', '#4ea890', '#a0e8c8'], b: ['#a84a5a', '#e87a8a', '#ffb0c0'], w: ['#525868', '#868fa0', '#c4ccd8'], e: '#ff8a3a', g: '#fff6c0' }
  },
  /* --- Gewöhnlich --- */
  maus: {
    n: _t('Feldmaus'), t: 1, el: 'blitz', fly: 0, fav: 'leder', atk: 'zap', spec: 'storm', pas: { dodge: [.01, .04] }, st: _t('Ihr Fell knistert vor Aufregung.'),
    an: _t('Funkenbiss'), ad: _t('Ein kleiner Funke springt auf Gegner über.'), pn: _t('Flinke Pfoten'), sn: _t('Knisterfell'), sd: _t('Entlädt das Fell in mehreren kleinen Blitzen.'),
    pal: { m: ['#4a3020', '#7a5434', '#a87a50', '#dcb890'], a: ['#b8881a', '#ffd84a', '#fffbe0'], b: ['#c87a8a', '#f0a8b0', '#ffe0e4'], w: ['#5a3a24', '#8a6040', '#c09060'], e: '#1a1420', g: '#fffbe0' }
  },
  kroete: {
    n: _t('Kröte'), t: 1, el: 'frost', fly: 0, fav: 'schleim', atk: 'ice', spec: 'freeze', pas: { regen: [.3, 1.5] }, st: _t('Quakt. Friert. Quakt wieder.'),
    an: _t('Eisspucke'), ad: _t('Spuckt eiskalte Tropfen, die verlangsamen.'), pn: _t('Krötenschleim'), sn: _t('Froststarre'), sd: _t('Ein eisiges Quaken friert Gegner in der Nähe kurz ein.'),
    pal: { m: ['#1e3a3a', '#2e6a64', '#4ea898', '#9ae0d0'], a: ['#2a4a6a', '#4a8ac0', '#a8e0ff'], b: ['#a8b8a0', '#d8e8d0', '#f8fff4'], w: ['#5a9ac8', '#a8e0ff', '#ffffff'], e: '#ffd24a', g: '#bfefff' }
  },
  huhn: {
    n: _t('Kampfhuhn'), t: 1, el: 'feuer', fly: 0, fav: 'erz', atk: 'claw', spec: 'breath', pas: { aspd: [.01, .05] }, st: _t('Kleiner Körper, riesiges Ego.'),
    an: _t('Schnabelhieb'), ad: _t('Stürmt flatternd los und hackt zu.'), pn: _t('Hackordnung'), sn: _t('Feuerkrähen'), sd: _t('Kräht so laut, dass Flammen aus dem Schnabel schlagen.'),
    pal: { m: ['#a89070', '#d8c8a8', '#f0e6d0', '#ffffff'], a: ['#8a1a14', '#d8402a', '#ff8a5a'], b: ['#a8641c', '#e8a030', '#ffd870'], w: ['#6a3a1e', '#c0682a', '#f0a050'], e: '#1a1420', g: '#ffd24a' }
  },
  /* --- Ungewöhnlich --- */
  fuchs: {
    n: _t('Glutfuchs'), t: 2, el: 'feuer', fly: 0, fav: 'glut', atk: 'fire', spec: 'leap', pas: { crit: [.01, .05] }, st: _t('Schlau, flink, und sein Schweif glimmt.'),
    an: _t('Glutschweif'), ad: _t('Schleudert Funken aus dem Schweif.'), pn: _t('Fuchsschläue'), sn: _t('Feuersprung'), sd: _t('Springt brennend von Gegner zu Gegner.'),
    pal: { m: ['#6a2410', '#b8481e', '#e8783a', '#ffb070'], a: ['#c8402a', '#ff8a3a', '#ffd24a'], b: ['#a8a090', '#e8e2d0', '#ffffff'], w: ['#2a1a14', '#4a2e20', '#6a4430'], e: '#ffd24a', g: '#ffd24a' }
  },
  igel: {
    n: _t('Frostigel'), t: 2, el: 'frost', fly: 0, fav: 'kristall', atk: 'ice', spec: 'freeze', pas: { dr: [.01, .05] }, st: _t('Stachelig, kühl und sehr verschmust.'),
    an: _t('Eisstachel'), ad: _t('Schießt Eisstacheln, die verlangsamen.'), pn: _t('Stachelkleid'), sn: _t('Stachelfrost'), sd: _t('Ein Stachelsturm friert Gegner um den Igel ein.'),
    pal: { m: ['#4a3424', '#7a5a40', '#a88460', '#d8b890'], a: ['#3a6a9a', '#8ac8f0', '#e8f8ff'], b: ['#8a7060', '#c8b090', '#f0e0c8'], w: ['#2a4a6a', '#5a8ab0', '#a8d8f0'], e: '#1a1420', g: '#bfefff' }
  },
  fleder: {
    n: _t('Fledermaus'), t: 2, el: 'schatten', fly: 1, fav: 'horn', atk: 'bite', spec: 'leap', pas: { leech: [.01, .03] }, st: _t('Hängt gern kopfüber und beißt gern.'),
    an: _t('Vampirbiss'), ad: _t('Flattert heran und beißt zu.'), pn: _t('Blutdurst'), sn: _t('Nachtflug'), sd: _t('Huscht durch die Dunkelheit von Gegner zu Gegner.'),
    pal: { m: ['#1e1428', '#3a2a4a', '#5a4670', '#8a76a0'], a: ['#8a3a5a', '#c86a8a', '#f0a0b8'], b: ['#a8a090', '#e8e2d0', '#ffffff'], w: ['#2a1a3a', '#4a2e5e', '#6e4a88'], e: '#ff4a5a', g: '#c8a0ff' }
  },
  irrlicht: {
    n: _t('Irrlicht'), t: 2, el: 'licht', fly: 1, fav: 'kristall', atk: 'beam', spec: 'nova', pas: { xp: [.03, .12] }, st: _t('Ein tanzendes Licht, das Wanderer führt – oder verführt.'),
    an: _t('Lichtfaden'), ad: _t('Ein feiner Lichtstrahl versengt Gegner.'), pn: _t('Irrlichtweisheit'), sn: _t('Leuchtfeuer'), sd: _t('Heilt dich und versengt alle Gegner um dich herum.'),
    pal: { m: ['#a87a20', '#e8c040', '#fff08a', '#ffffff'], a: ['#3a8aa0', '#7ad0e0', '#d0f8ff'], b: ['#a8a090', '#e8e2d0', '#ffffff'], w: ['#2e7a90', '#6ac8d8', '#c8f4ff'], e: '#1a1420', g: '#fffbe0' }
  },
  /* --- Episch --- */
  golem: {
    n: _t('Kristallgolem'), t: 4, el: 'licht', fly: 0, fav: 'mithril', atk: 'beam', spec: 'nova', pas: { hp: [.04, .2], def: [2, 10] }, st: _t('Uralter Stein mit leuchtendem Herzen.'),
    an: _t('Prismastrahl'), ad: _t('Bricht Licht zu einem gleißenden Strahl.'), pn: _t('Kristallpanzer'), sn: _t('Kristallblüte'), sd: _t('Kristalle brechen aus dem Boden, heilen dich und treffen alle Gegner um dich.'),
    pal: { m: ['#2e2a3a', '#4e4860', '#7a7490', '#aaa4c0'], a: ['#4a6ac0', '#90c8ff', '#ffffff'], b: ['#5a5470', '#8a84a0', '#c0bad4'], w: ['#3a6a4a', '#5aa06a', '#9ad8a0'], e: '#ffd24a', g: '#fff6c0' }
  },
  wolf: {
    n: _t('Schattenwolf'), t: 4, el: 'schatten', fly: 0, fav: 'horn', atk: 'claw', spec: 'leap', crit: .15, pas: { crit: [.02, .08], critdmg: [.05, .25] }, st: _t('Ein Schatten mit Zähnen. Treu bis in die Nacht.'),
    an: _t('Schattenbiss'), ad: _t('Springt Gegner an – oft kritisch.'), pn: _t('Rudelinstinkt'), sn: _t('Rudeljagd'), sd: _t('Jagt blitzschnell von Gegner zu Gegner – jeder Biss kritisch.'),
    pal: { m: ['#16121e', '#2e2640', '#4a3e66', '#7a6aa0'], a: ['#6a3ab0', '#a06af0', '#e0c8ff'], b: ['#5a5070', '#8a80a0', '#c0b8d8'], w: ['#100c16', '#241c34', '#3e3258'], e: '#5ae8ff', g: '#c8a0ff' }
  },
  /* --- Legendär --- */
  phoenix: {
    n: _t('Phönix'), t: 5, el: 'feuer', fly: 1, fav: 'glut', atk: 'fire', spec: 'nova', pas: { hp: [.04, .16], regen: [1, 4] }, st: _t('Stirbt nie wirklich. Wird nur wütender.'),
    an: _t('Feuerfeder'), ad: _t('Schleudert brennende Federn.'), pn: _t('Phönixglut'), sn: _t('Wiedergeburt'), sd: _t('Heilt dich kräftig und entfacht einen Feuerring.'),
    pal: { m: ['#7a1a10', '#c8381e', '#f06a2a', '#ffb050'], a: ['#e8602a', '#ffb03a', '#fff0a0'], b: ['#9c6a24', '#e8b04a', '#ffe08a'], w: ['#8a2a14', '#e8602a', '#ffc060'], e: '#fff0a0', g: '#ffd24a' }
  },
  greif: {
    n: _t('Greif'), t: 5, el: 'blitz', fly: 1, fav: 'schuppe', atk: 'zap', spec: 'storm', pas: { spd: [.03, .1], dmg: [.02, .1] }, st: _t('Halb Adler, halb Löwe, ganz Sturm.'),
    an: _t('Donnerkralle'), ad: _t('Blitze springen von Gegner zu Gegner.'), pn: _t('Sturmschwingen'), sn: _t('Himmelsgewitter'), sd: _t('Ruft Blitze auf viele Gegner herab.'),
    pal: { m: ['#6a4a1e', '#a8782e', '#d8a84a', '#f8d890'], a: ['#3e6ad0', '#86c0ff', '#e8f6ff'], b: ['#a8a8b0', '#e0e0e8', '#ffffff'], w: ['#5a4a3a', '#9a8060', '#d8c098'], e: '#ffd84a', g: '#fffbe0' }
  },
  eisdrache: {
    n: _t('Eisdrache'), t: 5, el: 'frost', fly: 1, fav: 'mithril', atk: 'ice', spec: 'breath', pas: { dr: [.02, .08], dmg: [.02, .1] }, st: _t('Sein Atem lässt Wasserfälle erstarren.'),
    an: _t('Frostkugel'), ad: _t('Spuckt Eiskugeln, die verlangsamen.'), pn: _t('Frostschuppen'), sn: _t('Frostatem'), sd: _t('Speit einen eisigen Kegel, der alles verlangsamt.'),
    pal: { m: ['#1a3a6a', '#3a70b0', '#7ab8e8', '#d8f4ff'], a: ['#7ab8d8', '#c8ecff', '#ffffff'], b: ['#6a98b8', '#b4daf0', '#f0fbff'], w: ['#2a5a8a', '#5a9ad0', '#a8d8f8'], e: '#bfefff', g: '#e8f8ff' }
  },
  einhorn: {
    n: _t('Einhorn'), t: 5, el: 'licht', fly: 0, fav: 'stern', atk: 'beam', spec: 'nova', pas: { xp: [.05, .2], loot: [.03, .12] }, st: _t('Wo es läuft, wächst Glück.'),
    an: _t('Hornstrahl'), ad: _t('Ein Regenbogenstrahl aus dem Horn.'), pn: _t('Glückshorn'), sn: _t('Regenbogen'), sd: _t('Heilt dich und blendet alle Gegner um dich herum.'),
    pal: { m: ['#9a96b0', '#c8c4dc', '#ecebf8', '#ffffff'], a: ['#d86ab0', '#ffa0d8', '#ffe0f4'], b: ['#9c6a24', '#e8b04a', '#ffe08a'], w: ['#4a8ad0', '#8ac8ff', '#d0ecff'], e: '#6a48c0', g: '#fff6c0' }
  },
  /* --- Mythisch --- */
  schlange: {
    n: _t('Weltenschlange'), t: 6, el: 'gift', fly: 0, fav: 'aether', atk: 'bite', spec: 'cloud', pas: { dmg: [.05, .2], pgift: [.05, .2] }, st: _t('Man sagt, sie hielt einst die Welt zusammen.'),
    an: _t('Weltenbiss'), ad: _t('Schnellt heran und vergiftet mit jedem Biss.'), pn: _t('Weltengift'), sn: _t('Giftmeer'), sd: _t('Eine riesige Giftwolke vergiftet alle Gegner darin.'),
    pal: { m: ['#0e2418', '#1e4a2a', '#2e7a3a', '#6ac860'], a: ['#8a6a14', '#d8b030', '#fff08a'], b: ['#8a8070', '#d8d0b8', '#fffaf0'], w: ['#3a1a5a', '#7a3aa8', '#c88af0'], e: '#ff5a3a', g: '#c8f06a' }
  },
  wal: {
    n: _t('Sternenwal'), t: 6, el: 'schatten', fly: 1, fav: 'stern', atk: 'beam', spec: 'storm', pas: { xp: [.06, .25], gold: [.1, .4], loot: [.04, .15] }, st: _t('Schwimmt durch den Nachthimmel und singt.'),
    an: _t('Sternenlied'), ad: _t('Ein Strahl aus Sternenlicht.'), pn: _t('Sternensegen'), sn: _t('Sternenregen'), sd: _t('Lässt Sternschnuppen auf viele Gegner fallen.'),
    pal: { m: ['#120e30', '#2a2266', '#4a3ea8', '#8a7ae0'], a: ['#5a6ab0', '#9aaae8', '#dce4ff'], b: ['#a8a0ff', '#e0dcff', '#ffffff'], w: ['#4a2a8a', '#8a4ac8', '#d098ff'], e: '#fffbe0', g: '#e0dcff' }
  }
};
/* --- Kreaturen 2.0: Monster-Kreaturen (mon: Gegner, deren Eier sie in den Landen fallen lassen) und Kreaturen der Gebiete (hab) ---
   Farben kurz: pp6(Körper, Akzent, Horn/Bauch, Flügel, Auge, Glanz) – die Abstufungen werden berechnet. art: [Bauplan, Merkmale] */
function pp6(m, a, b, w, e, g) { return { m, a, b, w, e, g: g || '#fff6c0' }; }
Object.assign(PET_SP, {
  /* Plunder */
  schleimling: { n: _t('Schleimling'), t: 0, el: 'gift', fly: 0, fav: 'schleim', atk: 'spit', spec: 'cloud', pas: { regen: [.2, 1] }, st: _t('Wabbelt, blubbert und frisst alles, was klebt.'), an: _t('Schleimklecks'), pn: _t('Zäher Glibber'), sn: _t('Blubberwolke'), hab: ['wiese', 'sumpf', 'hoehle', 'kerker'], mon: ['slime', 'minislime', 'toxslime'], pal: pp6('#5ab83a', '#c8f06a', '#2e7a2a', '#8ad85a', '#1a1420', '#e8ffb0'), art: ['blob', { k: 'schleim' }] },
  hase: { n: _t('Wiesenhase'), t: 0, el: 'licht', fly: 0, fav: 'leder', atk: 'claw', spec: 'leap', pas: { spd: [.01, .05] }, st: _t('Hoppelt schneller, als du gucken kannst.'), an: _t('Hasentritt'), pn: _t('Hasenfuß'), sn: _t('Hakenschlagen'), hab: ['wiese', 'wald'], pal: pp6('#b08a60', '#f0e0c8', '#fff6e8', '#8a6a48', '#1a1420'), art: ['quad', { bw: 3.3, bh: 2.4, leg: 1.6, hd: 2.4, sn: 1, ear: 'lang', tail: 'stummel', hop: 1 }] },
  pilzling: { n: _t('Pilzling'), t: 0, el: 'gift', fly: 0, fav: 'schleim', atk: 'spit', spec: 'cloud', pas: { hp: [.01, .04] }, st: _t('Steht gern im Schatten und niest Sporen.'), an: _t('Sporenniesen'), pn: _t('Myzelhaut'), sn: _t('Sporenwolke'), hab: ['wald', 'pilz', 'hoehle', 'sumpf'], pal: pp6('#c8342c', '#ffffff', '#efe2bf', '#a8865a', '#1a1420'), art: ['blob', { k: 'pilz' }] },
  grubenwurm: { n: _t('Grubenwürmchen'), t: 0, el: 'gift', fly: 0, fav: 'erz', atk: 'bite', spec: 'leap', pas: { def: [1, 5] }, st: _t('Gräbt sich durch jeden Boden – und durch jeden Keks.'), an: _t('Rundmaul'), pn: _t('Ringpanzer'), sn: _t('Tunnelsprung'), hab: ['hoehle', 'sumpf', 'wueste', 'kerker'], mon: ['wurm'], pal: pp6('#b87a6a', '#e8b0a0', '#fff0e0', '#7a4a3a', '#1a1420'), art: ['wurm', {}] },
  lamm: { n: _t('Wolllamm'), t: 0, el: 'licht', fly: 0, fav: 'leder', atk: 'claw', spec: 'nova', pas: { regen: [.3, 1.2] }, st: _t('Flauschig, mutig und stur wie ein Bock.'), an: _t('Kopfstoß'), pn: _t('Wollpolster'), sn: _t('Wolkenwolle'), hab: ['wiese', 'berg'], pal: pp6('#3a3036', '#e8a0b0', '#f4efe6', '#d8d0c4', '#1a1420'), art: ['quad', { bw: 3.9, bh: 2.9, leg: 2, hd: 2.3, sn: 1, ear: 'haenge', back: 'wolle', coat: 'b', tail: 'stummel' }] },
  /* Gewöhnlich */
  goblin: { n: _t('Goblin-Welpe'), t: 1, el: 'schatten', fly: 0, fav: 'erz', atk: 'claw', spec: 'leap', pas: { gold: [.02, .08] }, st: _t('Klaut alles, was glänzt – meistens für dich.'), an: _t('Messerstich'), pn: _t('Diebesglück'), sn: _t('Hinterhalt'), hab: ['wiese', 'wald', 'hoehle', 'kerker'], mon: ['goblin', 'gobarcher', 'goldgob'], pal: pp6('#5aa83a', '#8a5a32', '#c8c8d0', '#4a8a2a', '#ffd24a'), art: ['biped', { ear: 'goblin', hold: 'messer', hd: 3.2 }] },
  knochenhund: { n: _t('Knochenhund'), t: 1, el: 'schatten', fly: 0, fav: 'knochen', atk: 'bite', spec: 'leap', pas: { leech: [.005, .02] }, st: _t('Bringt dir jeden Knochen. Meistens seinen eigenen.'), an: _t('Knochenbiss'), pn: _t('Gruftgier'), sn: _t('Klapperjagd'), hab: ['gruft', 'ruine', 'kerker'], mon: ['skeleton', 'skelarcher', 'skelmage', 'tinyz', 'zombie'], pal: pp6('#d8d0b8', '#5ae8ff', '#6a6458', '#a8a090', '#5ae8ff', '#bfffff'), art: ['quad', { bw: 4, bh: 2.3, leg: 2.9, lw: 1.1, hd: 2.6, sn: 2, ear: 'spitz', tail: 'duenn', back: 'rippen', face: 'schaedel' }] },
  ratte: { n: _t('Seuchenratte'), t: 1, el: 'gift', fly: 0, fav: 'schleim', atk: 'bite', spec: 'cloud', pas: { pgift: [.02, .08] }, st: _t('Kennt jeden Abfluss und jede Abkürzung.'), an: _t('Nagezahn'), pn: _t('Pestbiss'), sn: _t('Pestwolke'), hab: ['sumpf', 'hoehle', 'ruine', 'kerker'], mon: ['seuche', 'morbus'], pal: pp6('#6a6a5a', '#9ad858', '#e8a0a8', '#4a4a3e', '#ff4a4a'), art: ['quad', { bw: 3.8, bh: 2.3, leg: 1.5, hd: 2.4, sn: 2, ear: 'rund', tail: 'duenn', tk: 'b', pat: 'gift' }] },
  biene: { n: _t('Honigbiene'), t: 1, el: 'licht', fly: 1, fav: 'zahn', atk: 'claw', spec: 'storm', pas: { regen: [.4, 1.5] }, st: _t('Summt fröhlich und heilt mit Honig.'), an: _t('Stachelstich'), pn: _t('Honigtau'), sn: _t('Schwarmsturm'), hab: ['wiese', 'wald'], pal: pp6('#f0c030', '#2a2018', '#fff4c0', '#d8f0ff', '#1a1420'), art: ['biene', {}] },
  hoernchen: { n: _t('Eichhörnchen'), t: 1, el: 'blitz', fly: 0, fav: 'zahn', atk: 'zap', spec: 'storm', pas: { dodge: [.01, .04] }, st: _t('Knistert vor Neugier und versteckt Nüsse überall.'), an: _t('Nussfunke'), pn: _t('Kletterkünstler'), sn: _t('Funkenregen'), hab: ['wald'], pal: pp6('#c0602a', '#ffd84a', '#f0e0c8', '#a84a20', '#1a1420'), art: ['quad', { bw: 3, bh: 2.4, leg: 1.6, hd: 2.4, sn: 1, ear: 'zipfel', tail: 'busch', big: 1.5 }] },
  kuerbisling: { n: _t('Kürbisling'), t: 1, el: 'feuer', fly: 0, fav: 'schleim', atk: 'fire', spec: 'nova', pas: { dmg: [.01, .04] }, st: _t('Grinst Tag und Nacht. Niemand weiß, warum.'), an: _t('Kernspucke'), pn: _t('Glutgrinsen'), sn: _t('Kürbisknall'), hab: ['wiese', 'sumpf', 'wald'], mon: ['kuerbis'], pal: pp6('#e8782a', '#5a8a2a', '#ffd24a', '#a8541a', '#ffd24a'), art: ['blob', { k: 'kuerbis' }] },
  krabbe: { n: _t('Strandkrabbe'), t: 1, el: 'frost', fly: 0, fav: 'zahn', atk: 'claw', spec: 'freeze', pas: { def: [1, 6] }, st: _t('Läuft seitwärts, kneift vorwärts.'), an: _t('Scherenzwick'), pn: _t('Krabbenpanzer'), sn: _t('Brandungswelle'), hab: ['wasser', 'kueste', 'sumpf'], pal: pp6('#d8402a', '#ffb08a', '#f0e0d0', '#a82a1e', '#1a1420'), art: ['krabbe', {}] },
  pinguin: { n: _t('Pinguinküken'), t: 1, el: 'frost', fly: 0, fav: 'schleim', atk: 'ice', spec: 'freeze', pas: { dr: [.005, .025] }, st: _t('Watschelt tapfer durch jeden Schneesturm.'), an: _t('Schneeball'), pn: _t('Daunenpolster'), sn: _t('Bauchrutscher'), hab: ['eis', 'kueste'], pal: pp6('#2a3040', '#ff9a2a', '#f4f4f8', '#3a4050', '#1a1420'), art: ['biped', { snout: 'schnabel', belly: 1, arm: 'flosse', leg: 1.2, hd: 3, bw: 3, bh: 3.2, hx: .2, pinguin: 1 }] },
  /* Ungewöhnlich */
  orkling: { n: _t('Orkling'), t: 2, el: 'feuer', fly: 0, fav: 'zahn', atk: 'claw', spec: 'leap', pas: { dmg: [.01, .05] }, st: _t('Klein, grün und will schon jetzt der Stärkste sein.'), an: _t('Keulenhieb'), pn: _t('Kriegsschrei'), sn: _t('Sturmangriff'), hab: ['wiese', 'berg', 'kerker'], mon: ['orc', 'berserker', 'shaman', 'ogre'], pal: pp6('#7a8a5a', '#6a4a2e', '#f0e8d0', '#5a6a40', '#ff4a3a'), art: ['biped', { ear: 'klein', tusk: 1, hold: 'keule', hd: 3.1, bw: 3, bh: 3 }] },
  echsling: { n: _t('Echsling'), t: 2, el: 'gift', fly: 0, fav: 'leder', atk: 'bite', spec: 'cloud', pas: { spd: [.01, .05] }, st: _t('Sonnt sich gern und züngelt neugierig.'), an: _t('Schuppenbiss'), pn: _t('Echsenflinkheit'), sn: _t('Sumpfnebel'), hab: ['sumpf', 'wald', 'wueste'], mon: ['lizard', 'lizshaman'], pal: pp6('#3a9a7a', '#e8c040', '#c8c8d0', '#2a7a5a', '#ffd24a'), art: ['biped', { snout: 'echse', tail: 'echse', hold: 'speer', crest: 1 }] },
  boemb: { n: _t('Bömbchen'), t: 2, el: 'feuer', fly: 0, fav: 'erz', atk: 'fire', spec: 'nova', pas: { critdmg: [.05, .2] }, st: _t('Hat eine sehr kurze Lunte. Bitte nicht ärgern.'), an: _t('Funkenwurf'), pn: _t('Sprengmeister'), sn: _t('Großer Knall'), hab: ['hoehle', 'berg', 'kerker'], mon: ['bomber'], pal: pp6('#3a3a48', '#ff8a2a', '#c8a878', '#5a5a6a', '#ff4a3a'), art: ['blob', { k: 'bombe' }] },
  geistchen: { n: _t('Gruftgeistchen'), t: 2, el: 'schatten', fly: 1, fav: 'kristall', atk: 'beam', spec: 'freeze', pas: { dodge: [.01, .05] }, st: _t('Buh! Erschrickt sich meist selbst am meisten.'), an: _t('Spukstrahl'), pn: _t('Durchsichtig'), sn: _t('Gruselschrei'), hab: ['gruft', 'ruine', 'schatten'], mon: ['geist', 'mage'], pal: pp6('#d8d8f0', '#8a7ab8', '#b8b0d8', '#c8c0e8', '#1a1420', '#e0dcff'), art: ['float', { k: 'geist' }] },
  libelle: { n: _t('Sumpflibelle'), t: 2, el: 'blitz', fly: 1, fav: 'kristall', atk: 'zap', spec: 'storm', pas: { aspd: [.01, .05] }, st: _t('Schwirrt so schnell, dass die Luft knistert.'), an: _t('Flügelfunke'), pn: _t('Schwirrflug'), sn: _t('Sirrgewitter'), hab: ['sumpf', 'wasser', 'wiese'], pal: pp6('#2ab8a8', '#2a6aa8', '#8ae8d8', '#c8f0ff', '#3a2a6a'), art: ['libelle', {}] },
  salamander: { n: _t('Feuersalamander'), t: 2, el: 'feuer', fly: 0, fav: 'glut', atk: 'fire', spec: 'breath', pas: { crit: [.01, .04] }, st: _t('Badet in Glut wie andere in Wasser.'), an: _t('Glutzunge'), pn: _t('Feuerhaut'), sn: _t('Flammenzunge'), hab: ['feuer', 'asche', 'hoehle'], mon: ['pyro', 'glutschleim'], pal: pp6('#3e3448', '#ff9a2a', '#ffd24a', '#4a3e54', '#ffd24a'), art: ['quad', { bw: 4.8, bh: 1.8, leg: 1.1, hd: 2.3, sn: 1, ear: 0, tail: 'kurz', pat: 'flecken', pk: 'a1' }] },
  hirschkalb: { n: _t('Hirschkalb'), t: 2, el: 'licht', fly: 0, fav: 'horn', atk: 'claw', spec: 'nova', pas: { xp: [.03, .1] }, st: _t('Staksig, sanft – und das Geweih wächst mit.'), an: _t('Geweihstoß'), pn: _t('Waldweisheit'), sn: _t('Lichtung'), hab: ['wald', 'wiese'], pal: pp6('#a86a3a', '#e8d0a0', '#fff4e0', '#8a5430', '#1a1420'), art: ['quad', { bw: 4, bh: 2.3, leg: 3.4, lw: 1.1, hd: 2.4, sn: 'pferd', ear: 'spitz', horn: 'geweih', tail: 'stummel', pat: 'flecken', neck: 1 }] },
  baer: { n: _t('Bärenjunges'), t: 2, el: 'schatten', fly: 0, fav: 'knochen', atk: 'claw', spec: 'leap', pas: { hp: [.02, .08] }, st: _t('Brummt, kuschelt und haut kräftig zu.'), an: _t('Tatzenhieb'), pn: _t('Dickes Fell'), sn: _t('Bärensprung'), hab: ['wald', 'berg', 'hoehle'], pal: pp6('#6a4a30', '#c8a070', '#c8a070', '#4a3020', '#1a1420'), art: ['quad', { bw: 4.8, bh: 3.2, leg: 2.2, lw: 1.8, hd: 3, sn: 1, ear: 'rund', tail: 'stummel', snk: 'a' }] },
  /* Selten */
  golemchen: { n: _t('Golemchen'), t: 3, el: 'blitz', fly: 0, fav: 'erz', atk: 'zap', spec: 'storm', pas: { def: [3, 12] }, st: _t('Ein Kiesel mit Herz – und einer leuchtenden Rune.'), an: _t('Runenfunke'), pn: _t('Steinhaut'), sn: _t('Steinhagel'), hab: ['berg', 'hoehle', 'ruine', 'kristall'], mon: ['golem', 'zwerg'], pal: pp6('#7a7468', '#79c24e', '#8ac8ff', '#5a564e', '#8ac8ff', '#d0ecff'), art: ['golem', {}] },
  impling: { n: _t('Impling'), t: 3, el: 'feuer', fly: 1, fav: 'horn', atk: 'fire', spec: 'breath', pas: { aspd: [.02, .08] }, st: _t('Frech, flatterhaft und immer zu heiß.'), an: _t('Teufelsfunke'), pn: _t('Höllenhast'), sn: _t('Glutatem'), hab: ['feuer', 'asche', 'schatten'], mon: ['imp', 'schattenimp'], pal: pp6('#c8342c', '#ffb03a', '#3a1a1a', '#8a1a1a', '#ffe04a'), art: ['biped', { horn: 'teufel', wing: 'leder', tail: 'teufel', ear: 'klein', belly: 1, hd: 3 }] },
  mimik: { n: _t('Mimikchen'), t: 3, el: 'schatten', fly: 0, fav: 'kristall', atk: 'bite', spec: 'leap', pas: { loot: [.03, .12] }, st: _t('Sieht aus wie eine Truhe. Beißt wie keine.'), an: _t('Truhenbiss'), pn: _t('Schatzinstinkt'), sn: _t('Deckelschnapper'), hab: ['hoehle', 'ruine', 'kerker'], mon: ['mimic', 'goldmimik'], pal: pp6('#8a5a32', '#c83a4a', '#b8b8c4', '#6a4224', '#ffd24a'), art: ['blob', { k: 'kiste' }] },
  eisgeist: { n: _t('Frostgeistchen'), t: 3, el: 'frost', fly: 1, fav: 'kristall', atk: 'ice', spec: 'freeze', pas: { dr: [.01, .05] }, st: _t('Haucht Eisblumen an jedes Fenster.'), an: _t('Eishauch'), pn: _t('Frostschleier'), sn: _t('Eiskrone'), hab: ['eis'], mon: ['icez', 'eisgeist', 'frostra'], pal: pp6('#8ad8ff', '#e8f8ff', '#4a8ad8', '#bfefff', '#1a2a6a', '#e8f8ff'), art: ['float', { k: 'eis' }] },
  yeti: { n: _t('Yetijunges'), t: 3, el: 'frost', fly: 0, fav: 'mithril', atk: 'claw', spec: 'freeze', pas: { hp: [.04, .15] }, st: _t('Riesige Füße, riesiges Herz.'), an: _t('Frostpranke'), pn: _t('Wintertatze'), sn: _t('Lawine'), hab: ['eis', 'berg'], mon: ['frostoger'], pal: pp6('#e8eef8', '#6a8ab0', '#bfefff', '#c8d4e4', '#1a1420'), art: ['biped', { fur: 1, face: 'a', hd: 3.2, bw: 3.3, bh: 3.3, arm: 'gross' }] },
  skorpion: { n: _t('Aschenskorpion'), t: 3, el: 'gift', fly: 0, fav: 'horn', atk: 'bite', spec: 'cloud', pas: { pgift: [.04, .15] }, st: _t('Glüht von innen. Sticht von hinten.'), an: _t('Giftstachel'), pn: _t('Glutgift'), sn: _t('Aschewolke'), hab: ['wueste', 'asche', 'feuer'], pal: pp6('#4a4048', '#ff8a2a', '#2a2228', '#6a5a62', '#ff4a3a'), art: ['skorpion', {}] },
  qualle: { n: _t('Leuchtqualle'), t: 3, el: 'blitz', fly: 1, fav: 'kristall', atk: 'zap', spec: 'storm', pas: { xp: [.04, .15] }, st: _t('Schwebt sanft und leuchtet wie ein Lampion.'), an: _t('Nesselfunke'), pn: _t('Tiefseelicht'), sn: _t('Nesselsturm'), hab: ['wasser', 'kueste', 'leere'], pal: pp6('#e88ad8', '#ffd0f8', '#8ac8ff', '#c86ab8', '#3a1a4a', '#ffe8fb'), art: ['float', { k: 'qualle' }] },
  gargyl: { n: _t('Gargylchen'), t: 3, el: 'schatten', fly: 1, fav: 'horn', atk: 'claw', spec: 'leap', pas: { critdmg: [.08, .35] }, st: _t('Hockt tagsüber still auf Dächern.'), an: _t('Steinkralle'), pn: _t('Steinerne Wacht'), sn: _t('Sturzflug'), hab: ['ruine', 'gruft', 'berg'], pal: pp6('#8a8a96', '#b8b8c8', '#5a5a66', '#4a4058', '#ff4a3a'), art: ['biped', { horn: 'teufel', wing: 'stein', tail: 'teufel', ear: 'spitz', hd: 3, crouch: 1 }] },
  /* Episch */
  jungdrache: { n: _t('Jungdrache'), t: 4, el: 'feuer', fly: 0, fav: 'schuppe', atk: 'fire', spec: 'breath', pas: { dmg: [.03, .12], critdmg: [.05, .2] }, st: _t('Noch zu klein zum Fliegen – nicht zu klein zum Brennen.'), an: _t('Glutkugel'), pn: _t('Drachenblut'), sn: _t('Feuersturm'), hab: ['feuer', 'berg'], mon: ['jungdrache', 'demon', 'pyraxis'], pal: pp6('#8a2a2a', '#ffb03a', '#3a2a2a', '#c8402a', '#ffd24a'), art: ['quad', { bw: 4.4, bh: 2.8, leg: 2.4, lw: 1.6, hd: 2.9, sn: 2, ear: 0, horn: 'teufel', back: 'zacken', tail: 'zacke', wing: 'stummel', belly: 'a' }] },
  teufelchen: { n: _t('Hornteufelchen'), t: 4, el: 'feuer', fly: 0, fav: 'horn', atk: 'claw', spec: 'leap', pas: { crit: [.02, .08], aspd: [.02, .06] }, st: _t('Hufe, Hörner und ein Grinsen voller Funken.'), an: _t('Hornstoß'), pn: _t('Teufelsglück'), sn: _t('Glutsprung'), hab: ['feuer', 'asche'], mon: ['chort', 'lavadaemon'], pal: pp6('#a8241e', '#ff8a2a', '#2a1a1a', '#6a1a14', '#ffe04a'), art: ['biped', { horn: 'stier', tail: 'teufel', hold: 'dreizack', hoof: 1, hd: 3, bw: 3, bh: 3 }] },
  nachtmahr: { n: _t('Nachtmahr'), t: 4, el: 'schatten', fly: 0, fav: 'adamant', atk: 'claw', spec: 'storm', pas: { spd: [.03, .1], critdmg: [.05, .25] }, st: _t('Galoppiert durch Albträume – auf deiner Seite.'), an: _t('Hufschlag'), pn: _t('Albtraumgalopp'), sn: _t('Schattensturm'), hab: ['schatten', 'gruft'], mon: ['todesritter', 'varkas'], pal: pp6('#2a2238', '#b84aff', '#e0c8ff', '#3a2e4e', '#ff4aff', '#e0c8ff'), art: ['quad', { bw: 4.6, bh: 2.6, leg: 3.6, lw: 1.2, hd: 2.3, sn: 'pferd', ear: 'spitz', neck: 1, mane: 'flamme', tail: 'pferd', foot: 'huf' }] },
  mammut: { n: _t('Wollmammut'), t: 4, el: 'frost', fly: 0, fav: 'mithril', atk: 'claw', spec: 'freeze', pas: { hp: [.04, .18], def: [2, 8] }, st: _t('Uralt, zottelig und unaufhaltsam.'), an: _t('Stampfer'), pn: _t('Eiszeitfell'), sn: _t('Frostbeben'), hab: ['eis', 'berg'], pal: pp6('#7a5034', '#a87a50', '#f4ecd8', '#5a3a24', '#1a1420'), art: ['quad', { bw: 5.4, bh: 3.6, leg: 2.6, lw: 2, hd: 3, sn: 'ruessel', ear: 'rund', tusk: 1, tail: 'stummel', back: 'zottel', gz: .14 }] },
  krake: { n: _t('Tiefenkrake'), t: 4, el: 'gift', fly: 1, fav: 'schuppe', atk: 'spit', spec: 'cloud', pas: { dodge: [.02, .06], loot: [.02, .08] }, st: _t('Acht Arme, acht Mal so viel Unfug.'), an: _t('Tintenspritzer'), pn: _t('Saugnäpfe'), sn: _t('Tintenwolke'), hab: ['wasser', 'kueste', 'hoehle'], pal: pp6('#8a3a8a', '#e888c8', '#f0d0e8', '#6a2a6a', '#ffd24a'), art: ['float', { k: 'krake' }] },
  engelchen: { n: _t('Engelchen'), t: 4, el: 'licht', fly: 1, fav: 'stern', atk: 'beam', spec: 'nova', pas: { regen: [1, 4], xp: [.03, .1] }, st: _t('Ein gefallener Engel, der wieder fliegen lernt.'), an: _t('Himmelsstrahl'), pn: _t('Segen'), sn: _t('Himmelslicht'), hab: ['himmel', 'ruine'], mon: ['engel'], pal: pp6('#f0d8c0', '#eeeae2', '#ffd24a', '#ffffff', '#4a8ad8'), art: ['biped', { wing: 'feder', halo: 1, robe: 1, hair: 'b', hd: 3.1 }] },
  /* Legendär */
  hoellenhund: { n: _t('Höllenhund'), t: 5, el: 'feuer', fly: 0, fav: 'glut', atk: 'bite', spec: 'breath', pas: { dmg: [.03, .12], leech: [.01, .03] }, st: _t('Bewacht dich wie ein Tor zur Unterwelt.'), an: _t('Glutbiss'), pn: _t('Höllenhunger'), sn: _t('Höllenatem'), hab: ['feuer', 'asche', 'schatten'], mon: ['demon', 'lavadaemon'], pal: pp6('#3a2626', '#ff6a1a', '#c8c8d0', '#2a1e1e', '#ffd24a', '#ffd24a'), art: ['quad', { bw: 4.6, bh: 2.7, leg: 3, lw: 1.5, hd: 2.8, sn: 2, ear: 'spitz', back: 'flammen', tail: 'flamme', pat: 'risse', collar: 1 }] },
  /* Mythisch */
  leerenauge: { n: _t('Auge der Leere'), t: 6, el: 'schatten', fly: 1, fav: 'aether', atk: 'beam', spec: 'storm', pas: { crit: [.03, .1], critdmg: [.1, .4], xp: [.03, .1] }, st: _t('Es sieht alles. Wirklich alles.'), an: _t('Leerenblick'), pn: _t('Allsicht'), sn: _t('Sternenriss'), hab: ['leere', 'schatten'], pal: pp6('#2a1640', '#b84aff', '#f0e8ff', '#3a2058', '#ff4aff', '#f0d8ff'), art: ['float', { k: 'auge' }] },
  /* --- Hybride: nur aus der Zucht (hy: Eltern) --- */
  eulenbaer: { n: _t('Eulenbär'), t: 4, hy: ['eule', 'baer'], el: 'frost', fly: 0, fav: 'mithril', atk: 'claw', spec: 'freeze', pas: { hp: [.04, .15], critdmg: [.05, .2] }, st: _t('Halb Eule, halb Bär – ganz und gar wachsam.'), an: _t('Schnabelpranke'), pn: _t('Federfell'), sn: _t('Eulenschrei'), pal: pp6('#6a5040', '#e8d8b8', '#ffb03a', '#8a6a48', '#ffd24a'), art: ['quad', { bw: 4.7, bh: 3.2, leg: 2.2, lw: 1.8, hd: 3.1, sn: 'schnabel', ear: 'feder', tail: 'stummel', face: 'eule', pat: 'federn' }] },
  basilisk: { n: _t('Basilisk'), t: 4, hy: ['huhn', 'natter'], el: 'gift', fly: 0, fav: 'schleim', atk: 'bite', spec: 'cloud', pas: { pgift: [.06, .2], crit: [.02, .06] }, st: _t('Ein Blick von ihm, und Gegner erstarren.'), an: _t('Hahnenbiss'), pn: _t('Starrblick'), sn: _t('Versteinernder Hauch'), pal: pp6('#3a8a3a', '#d8302a', '#ffb03a', '#c8c040', '#ffd24a'), art: ['wurm', { k: 'basilisk' }] },
  pegasus: { n: _t('Pegasus'), t: 6, hy: ['einhorn', 'taube'], el: 'licht', fly: 1, fav: 'stern', atk: 'beam', spec: 'nova', pas: { spd: [.04, .12], xp: [.04, .15] }, st: _t('Trägt Helden über die Wolken.'), an: _t('Wolkenstrahl'), pn: _t('Himmelsritt'), sn: _t('Sternenschwinge'), pal: pp6('#e8e4f0', '#8ac8ff', '#c8b088', '#ffffff', '#4a6ad8'), art: ['quad', { bw: 4.6, bh: 2.6, leg: 3.6, lw: 1.2, hd: 2.3, sn: 'pferd', ear: 'spitz', neck: 1, mane: 'haar', tail: 'pferd', foot: 'huf', wing: 'feder' }] },
  wolpertinger: { n: _t('Wolpertinger'), t: 3, hy: ['hase', 'hirschkalb'], el: 'blitz', fly: 0, fav: 'horn', atk: 'zap', spec: 'storm', pas: { loot: [.03, .12], dodge: [.01, .04] }, st: _t('Hase, Geweih, Flügel und Zähne. Gibt es wirklich!'), an: _t('Geweihfunke'), pn: _t('Fabelglück'), sn: _t('Wolperwetter'), pal: pp6('#9a7a5a', '#e8d8c0', '#d8c8a0', '#c8a878', '#1a1420'), art: ['quad', { bw: 3.4, bh: 2.5, leg: 1.7, hd: 2.5, sn: 1, ear: 'lang', horn: 'geweih', tail: 'stummel', wing: 'klein', fang: 1, hop: 1 }] },
  flederkatze: { n: _t('Flederkatze'), t: 4, hy: ['katze', 'fleder'], el: 'schatten', fly: 1, fav: 'kristall', atk: 'claw', spec: 'leap', pas: { crit: [.02, .08], leech: [.01, .03] }, st: _t('Schnurrt kopfüber von der Decke.'), an: _t('Flatterkralle'), pn: _t('Nachtjäger'), sn: _t('Nachtsturz'), pal: pp6('#3a2a4a', '#c86a8a', '#8a76a0', '#5a3a6a', '#5ae8ff'), art: ['quad', { bw: 4.2, bh: 2.5, leg: 2.4, hd: 2.8, sn: 1, ear: 'spitz', tail: 'duenn', tk: 'm', wing: 'leder' }] },
  chimaere: { n: _t('Chimäre'), t: 5, hy: ['wolf', 'drache'], el: 'feuer', fly: 0, fav: 'schuppe', atk: 'fire', spec: 'breath', pas: { dmg: [.04, .15], crit: [.02, .06] }, st: _t('Löwe, Ziege, Drache und Schlange in einem.'), an: _t('Dreifachbiss'), pn: _t('Urkraft'), sn: _t('Chimärenfeuer'), pal: pp6('#c8963a', '#8a4a1a', '#e8e0d0', '#a8302a', '#ffd24a'), art: ['quad', { bw: 4.6, bh: 2.8, leg: 2.8, lw: 1.5, hd: 2.9, sn: 1, ear: 'rund', back: 'maehne', horn: 'bock', tail: 'schlange', wing: 'leder' }] },
  sphinx: { n: _t('Sphinx'), t: 5, hy: ['greif', 'katze'], el: 'licht', fly: 0, fav: 'stern', atk: 'beam', spec: 'nova', pas: { xp: [.05, .2], critdmg: [.05, .25] }, st: _t('Stellt Rätsel. Kennt alle Antworten.'), an: _t('Rätselstrahl'), pn: _t('Uraltes Wissen'), sn: _t('Sonnenrätsel'), pal: pp6('#d8b070', '#2a4ab0', '#ffd24a', '#e8c070', '#2a8aff'), art: ['quad', { bw: 4.4, bh: 2.5, leg: 2.4, hd: 2.8, sn: 1, ear: 0, tail: 'duenn', tk: 'm', wing: 'feder', hat: 'nemes' }] },
  sonnendrache: { n: _t('Sonnendrache'), t: 6, hy: ['drache', 'phoenix'], el: 'licht', fly: 1, fav: 'stern', atk: 'fire', spec: 'breath', pas: { dmg: [.05, .2], regen: [1, 5] }, st: _t('Wo er fliegt, geht die Sonne nie unter.'), an: _t('Sonnenkugel'), pn: _t('Sonnenherz'), sn: _t('Sonnenatem'), pal: pp6('#e8a020', '#fff0a0', '#ffffff', '#ffd24a', '#ff6a1a', '#fff6c0'), art: ['sonne', {}] },
  seedrache: { n: _t('Seedrache'), t: 6, hy: ['wal', 'eisdrache'], el: 'frost', fly: 1, fav: 'aether', atk: 'ice', spec: 'breath', pas: { dr: [.03, .1], xp: [.05, .2] }, st: _t('Schwimmt durch Luft wie durch Wellen.'), an: _t('Wellenkugel'), pn: _t('Gezeitenschuppen'), sn: _t('Sturmflut'), pal: pp6('#2a6a9a', '#8ae8ff', '#e8f8ff', '#3ab8c8', '#ffd24a', '#c8f8ff'), art: ['wurm', { k: 'seedrache' }] },
  neunschwanz: { n: _t('Neunschwanz'), t: 5, hy: ['fuchs', 'irrlicht'], el: 'licht', fly: 0, fav: 'kristall', atk: 'beam', spec: 'storm', pas: { crit: [.03, .1], gold: [.1, .3] }, st: _t('Jeder Schweif trägt ein Fuchsfeuer.'), an: _t('Fuchsfeuer'), pn: _t('Neun Leben'), sn: _t('Irrlichttanz'), pal: pp6('#e8eef8', '#8ac8ff', '#ffffff', '#a8b8d0', '#ff4a8a', '#bfefff'), art: ['neun', {}] },
  nautilus: { n: _t('Nautilus'), t: 4, hy: ['krake', 'schnecke'], el: 'frost', fly: 1, fav: 'schuppe', atk: 'ice', spec: 'freeze', pas: { def: [2, 10], dr: [.01, .04] }, st: _t('Trägt sein Zuhause als Spirale.'), an: _t('Perlschuss'), pn: _t('Spiralpanzer'), sn: _t('Tiefendruck'), pal: pp6('#f0e0c8', '#b8643a', '#e89a8a', '#c8a888', '#1a1420'), art: ['float', { k: 'nautilus' }] },
  kristallschleim: { n: _t('Kristallschleim'), t: 4, hy: ['schleimling', 'golem'], el: 'licht', fly: 0, fav: 'kristall', atk: 'beam', spec: 'nova', pas: { hp: [.03, .12], def: [2, 8] }, st: _t('Ein Schleim, der Edelsteine verdaut hat.'), an: _t('Prismaglibber'), pn: _t('Kristallkern'), sn: _t('Funkelfontäne'), pal: pp6('#8ac8f0', '#e8f8ff', '#b892f4', '#6aa8d8', '#2a2a6a', '#f0e0ff'), art: ['blob', { k: 'schleim', crystal: 1 }] },
  goldmimik: { n: _t('Goldmimik'), t: 5, hy: ['mimik', 'kaefer'], el: 'licht', fly: 0, fav: 'stern', atk: 'bite', spec: 'nova', pas: { gold: [.15, .5], loot: [.04, .12] }, st: _t('Eine Schatztruhe voller Zähne – und voller Gold.'), an: _t('Goldbiss'), pn: _t('Goldregen'), sn: _t('Juwelenfontäne'), pal: pp6('#e8b030', '#c83a4a', '#fff0a0', '#c88a1a', '#ff4a3a', '#fff6c0'), art: ['blob', { k: 'kiste', gold: 1 }] },
  seelenlicht: { n: _t('Seelenlicht'), t: 4, hy: ['irrlicht', 'geistchen'], el: 'schatten', fly: 1, fav: 'kristall', atk: 'beam', spec: 'freeze', pas: { leech: [.01, .03], xp: [.04, .12] }, st: _t('Eine Seele, die beschlossen hat zu leuchten.'), an: _t('Seelenstrahl'), pn: _t('Seelenband'), sn: _t('Seelenfrost'), pal: pp6('#4a8aff', '#8ad8ff', '#e0f8ff', '#3a6ad8', '#1a1a4a', '#d0f0ff'), art: ['float', { k: 'flamme' }] },
  donnerkroete: { n: _t('Donnerkröte'), t: 4, hy: ['kroete', 'funke'], el: 'blitz', fly: 0, fav: 'erz', atk: 'zap', spec: 'storm', pas: { aspd: [.03, .1], regen: [.5, 2] }, st: _t('Quakt, und der Himmel antwortet.'), an: _t('Donnerquaken'), pn: _t('Gewitterhaut'), sn: _t('Donnerschlag'), pal: pp6('#3a5aa8', '#ffd84a', '#e8f0ff', '#ffd84a', '#ffd84a', '#fffbe0'), art: ['donner', {}] },
  zerberus: { n: _t('Zerberus'), t: 6, hy: ['hoellenhund', 'wolf'], el: 'feuer', fly: 0, fav: 'aether', atk: 'bite', spec: 'breath', pas: { dmg: [.05, .2], leech: [.01, .04], critdmg: [.05, .2] }, st: _t('Drei Köpfe, drei Mal so treu.'), an: _t('Dreifachbiss'), pn: _t('Wächter der Tore'), sn: _t('Dreifacher Höllenatem'), pal: pp6('#4a2020', '#ff6a1a', '#c8c8d0', '#2a1414', '#ffd24a', '#ffd24a'), art: ['quad', { bw: 4.8, bh: 2.8, leg: 3, lw: 1.6, hd: 2.6, sn: 2, ear: 'spitz', back: 'flammen', tail: 'flamme', collar: 1, heads: 3 }] }
});
// Lebensräume der alten Arten (für eggForBiome)
const PET_HAB0 = { schnecke: ['wiese', 'sumpf', 'wald'], assel: ['hoehle', 'ruine', 'kerker'], taube: ['wiese', 'ruine', 'himmel'], maus: ['wiese', 'wald'], kroete: ['sumpf', 'wasser'], huhn: ['wiese'], fuchs: ['wald', 'wiese', 'feuer'], igel: ['wald', 'eis'], fleder: ['hoehle', 'gruft', 'schatten'], irrlicht: ['sumpf', 'wald', 'ruine'], katze: ['ruine', 'schatten', 'gruft'], natter: ['sumpf', 'wueste', 'wald'], eule: ['wald', 'eis', 'himmel'], kaefer: ['wueste', 'wiese', 'kristall'], drache: ['feuer', 'berg'], funke: ['himmel', 'berg'], golem: ['kristall', 'hoehle', 'berg'], wolf: ['wald', 'schatten', 'eis'], phoenix: ['feuer', 'asche', 'himmel'], greif: ['berg', 'himmel'], eisdrache: ['eis', 'berg'], einhorn: ['wiese', 'himmel', 'kristall'], schlange: ['sumpf', 'leere', 'wueste'], wal: ['himmel', 'leere', 'wasser'] };
for (const sp in PET_HAB0) PET_SP[sp].hab = PET_HAB0[sp];
// Abstufungen berechnen (pp6 gibt nur je eine Farbe) – dunkel ins Kühle, hell ins Warme wie bei Pixelkunst üblich
function petShades(hex, n) {
  const [h, s, l] = petRgbHsl(...hexRgb(hex)), L = n === 4 ? [l * .45, l * .72, l, l + (1 - l) * .5] : [l * .62, l, l + (1 - l) * .55], H = n === 4 ? [-14, -6, 0, 8] : [-9, 0, 8];
  return L.map((v, i) => '#' + petHslRgb(h + H[i], Math.min(1, s * (i ? 1 : 1.05)), clamp(v, .04, .97)).map(x => x.toString(16).padStart(2, '0')).join(''));
}
for (const sp in PET_SP) { const P0 = PET_SP[sp].pal; for (const g of ['m', 'a', 'b', 'w']) if (typeof P0[g] === 'string') P0[g] = petShades(P0[g], g === 'm' ? 4 : 3); }
// Standardtexte für Angriff und Spezialangriff, falls eine Art keine eigenen hat
const PET_AD = { fire: _t('Spuckt Feuerkugeln, die Gegner in Brand setzen.'), ice: _t('Schießt Eis, das Gegner verlangsamt.'), beam: _t('Ein Strahl versengt Gegner aus der Ferne.'), zap: _t('Ein Blitz springt von Gegner zu Gegner.'), claw: _t('Springt Gegner an und schlägt zu.'), bite: _t('Stürzt sich auf Gegner und beißt zu.'), spit: _t('Spuckt klebrige Geschosse auf Gegner.') };
const PET_SD = { breath: _t('Speit einen breiten Kegel, der alles davor trifft.'), leap: _t('Springt blitzschnell von Gegner zu Gegner – jeder Treffer kritisch.'), nova: _t('Heilt dich und trifft alle Gegner um dich herum.'), freeze: _t('Friert alle Gegner in der Nähe kurz ein.'), cloud: _t('Eine Giftwolke vergiftet alle Gegner darin.'), storm: _t('Lässt Blitze oder Sterne auf mehrere Gegner niederfahren.') };
for (const sp in PET_SP) { const S = PET_SP[sp]; S.ad = S.ad || PET_AD[S.atk]; S.sd = S.sd || PET_SD[S.spec]; }
// nach Seltenheit sortiert (Sammlung, Tests): erst die wilden Arten, dann die Hybride
const PET_ORDER = Object.keys(PET_SP).map((sp, i) => [sp, i]).sort((a, b) => (PET_SP[a[0]].hy ? 1 : 0) - (PET_SP[b[0]].hy ? 1 : 0) || PET_SP[a[0]].t - PET_SP[b[0]].t || a[1] - b[1]).map(x => x[0]);
// zufällige Eier: nur wilde Arten (Hybride gibt es nur aus der Zucht)
const PET_BYT = PET_TIERS.map((_, t) => PET_ORDER.filter(sp => PET_SP[sp].t === t && !PET_SP[sp].hy));
const PET_HY = PET_ORDER.filter(sp => PET_SP[sp].hy);
// Gegner-Art → Kreatur (Monster-Eier in den Landen); auch für andere Systeme (Bosse, Welt)
const PET_MON = {}; for (const sp of PET_ORDER) for (const t of PET_SP[sp].mon || []) if (!PET_MON[t]) PET_MON[t] = sp;
// Futter: EP je Stück (seltenes Material = viel), Lieblingsfutter zählt doppelt
const PET_FEED = {}; MATORDER.forEach((k, i) => { PET_FEED[k] = Math.round(15 * Math.pow(1.75, i)); });

/* ---------- Werte ---------- */
// EP bis zum nächsten Level ≈ 100·LV^2,6 (die ersten Level billiger): LV 10 nach etwa einer Stunde, LV 25 nach einem Spieltag, LV 100 nach Hunderten Stunden
function petNeed(lv) { return Math.round(100 * Math.pow(lv, 2.6) * Math.min(1, Math.max(.05, Math.pow(lv / 11, 1.5)))); }
function petStage(lv) { let s = 0; for (let i = 1; i < 6; i++) if (lv >= PET_STAGE[i]) s = i; return s; }
function petPasK(lv) { return clamp((lv - 25) / 75, 0, 1); }
function petPas(p) { const S = PET_SP[p.sp], r = {}; if (p.lv < 25) return r; const k = petPasK(p.lv); for (const s in S.pas) r[s] = S.pas[s][0] + (S.pas[s][1] - S.pas[s][0]) * k; return r; }
function petPow(lv) { return lv >= 100 ? 2 : lv >= 75 ? 1.5 : 1; }
function petSpecCd(lv) { return lv >= 100 ? 12 : lv >= 75 ? 16 : 20; }
// Angriffstempo: Stufe, Talente/Ausrüstung (paspd) und Tempo-Gen
function petAtkCd(p) { const m = petMods(p); return (1.2 - petStage(p.lv) * .05) / ((1 + (m.paspd || 0)) * petGeneK(p, 1, .9, .2)); }

/* ---------- Kreaturen 2.0: Gene, Mutationen, Talente, Ausrüstung, Zauber ---------- */
// Gene 0–100 (50 = Durchschnitt). Wirkung: Faktor = a + b · Gen/100
const PET_GENES = [{ k: 'kraft', n: _t('Kraft'), c: '#ff8a5a' }, { k: 'tempo', n: _t('Tempo'), c: '#8ee6ff' }, { k: 'zaeh', n: _t('Zähigkeit'), c: '#79c24e' }, { k: 'magie', n: _t('Magie'), c: '#b892f4' }, { k: 'glueck', n: _t('Glück'), c: '#ffd24a' }];
const PET_GRADE = [[90, 'S', '#ff4fd8'], [75, 'A', '#ff8a3a'], [60, 'B', '#e8d04a'], [40, 'C', '#79c24e'], [20, 'D', '#57a7d6'], [0, 'E', '#9a9088']];
function petGene(p, i) { return p && Array.isArray(p.gn) && isFinite(p.gn[i]) ? p.gn[i] : 50; }
function petGeneK(p, i, a, b) { return a + b * petGene(p, i) / 100; }
function petGrade(v) { return PET_GRADE.find(g => v >= g[0]) || PET_GRADE[5]; }
// Wilde Gene: meist 20–70, selten mehr (Mittel aus drei Würfen)
function petGenesWild(R) { R = R || Math.random; const r = []; for (let i = 0; i < 5; i++) r.push(Math.round(8 + (R() + R() + R()) / 3 * 74)); return r; }
// Alte Begleiter bekommen feste Gene aus ihrer Kennung (immer dieselben)
function petGenesOf(id) { let h = 2166136261; for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return petGenesWild(mulberry(h)); }
/* Mutationen: r 1 Farbe, 2 Merkmal, 3 Mutantenform (selten); b = kleine Boni; sichtbar auf dem Bild (petMutPB, petPal) */
const PET_MUT = {
  albino: { n: _t('Albino'), r: 1, d: _t('Schneeweiß mit roten Augen.'), b: { xp: .04 } },
  melan: { n: _t('Nachtschwarz'), r: 1, d: _t('Fast schwarz – nur die Augen leuchten.'), b: { crit: .02 } },
  scheck: { n: _t('Gescheckt'), r: 1, d: _t('Helle Flecken überall.'), b: { gold: .05 } },
  dornen: { n: _t('Dornenrücken'), r: 2, d: _t('Spitze Dornen wachsen aus dem Rücken.'), b: { def: 4 } },
  leucht: { n: _t('Leuchtpunkte'), r: 2, d: _t('Leuchtende Punkte glimmen auf der Haut.'), b: { pmag: .1, xp: .03 } },
  glut: { n: _t('Glutmähne'), r: 2, d: _t('Kleine Flammen tanzen auf dem Kopf.'), b: { pdmg: .08 } },
  kristall: { n: _t('Kristall-Variante'), r: 3, d: _t('Durchscheinend wie Bergkristall, mit Kristallzacken.'), b: { hp: .05, def: 6 } },
  schatten: { n: _t('Schatten-Variante'), r: 3, d: _t('Aus lebendem Schatten, mit glühenden Augen.'), b: { critdmg: .15, pcrit: .05 } },
  gold: { n: _t('Gold-Variante'), r: 3, d: _t('Glänzt wie pures Gold.'), b: { gold: .15, loot: .05 } },
  sternen: { n: _t('Sternen-Variante'), r: 3, d: _t('Ein Stück Nachthimmel mit funkelnden Sternen.'), b: { xp: .1, pmag: .2 } }
};
const PET_MUTR = [null, _t('Farbmutation'), _t('Merkmal'), _t('Mutantenform')], PET_MUTC = [null, '#8ee6ff', '#79c24e', '#ff4fd8'];
/* Talente: 3 Zweige × 5 Knoten; Knoten i braucht so viele Punkte im Zweig (PET_TALREQ); 1 Punkt + 1 je 2 Level */
const PET_TAL = [
  { n: _t('ANGRIFF'), nodes: [{ n: _t('Scharfe Zähne'), d: _t('+6 % Schaden des Begleiters'), max: 5, e: { pdmg: .06 } }, { n: _t('Flinke Pfoten'), d: _t('+5 % Angriffstempo des Begleiters'), max: 5, e: { paspd: .05 } }, { n: _t('Jagdinstinkt'), d: _t('+3 % Krit-Chance des Begleiters'), max: 5, e: { pcrit: .03 } }, { n: _t('Runenkunde'), d: _t('+12 % Zauberkraft'), max: 5, e: { pmag: .12 } }, { n: _t('Raserei'), d: _t('Spezialangriff 10 % schneller bereit'), max: 3, e: { pspec: .1 } }] },
  { n: _t('SCHUTZ'), nodes: [{ n: _t('Wachsam'), d: _t('+3 Verteidigung für dich'), max: 5, e: { def: 3 } }, { n: _t('Lebensband'), d: _t('+2 % Lebenspunkte für dich'), max: 5, e: { hp: .02 } }, { n: _t('Dickes Fell'), d: _t('Verletzungen heilen 10 % schneller'), max: 5, e: { pwund: .1 } }, { n: _t('Schutzgeist'), d: _t('Heil- und Schildzauber 15 % stärker'), max: 5, e: { pheal: .15 } }, { n: _t('Treue bis zuletzt'), d: _t('+2 % Schadensminderung für dich'), max: 3, e: { dr: .02 } }] },
  { n: _t('SAMMLER'), nodes: [{ n: _t('Goldnase'), d: _t('+4 % Gold'), max: 5, e: { gold: .04 } }, { n: _t('Beutemagnet'), d: _t('+15 % Reichweite des Beutemagneten'), max: 5, e: { pmagr: .15 } }, { n: _t('Große Taschen'), d: _t('+1 Platz im Beutel des Begleiters'), max: 3, e: { pbag: 1 } }, { n: _t('Schatzsucher'), d: _t('+2 % Beute'), max: 5, e: { loot: .02 } }, { n: _t('Spürnase'), d: _t('+20 % Chance auf Monster-Eier, Runen und Begleiter-Ausrüstung'), max: 3, e: { pegg: .2 } }] }
];
const PET_TALREQ = [0, 2, 4, 7, 10], PET_TALN = 15;
function petTalPts(lv) { return 1 + Math.floor(clamp(lv | 0, 1, 100) / 2); }
function petTl(p) { const s = p && typeof p.tl === 'string' ? p.tl : '', r = []; for (let i = 0; i < PET_TALN; i++) r.push(+s[i] || 0); return r; }
function petTalUsed(p) { return petTl(p).reduce((a, b) => a + b, 0); }
function petTalFree(p) { return petTalPts(p.lv) - petTalUsed(p); }
function petTalState(p, bi, ni) {
  const tl = petTl(p), N = PET_TAL[bi].nodes[ni], r = tl[bi * 5 + ni], inB = tl.slice(bi * 5, bi * 5 + 5).reduce((a, b) => a + b, 0), lock = inB < PET_TALREQ[ni];
  return { N, r, lock, need: PET_TALREQ[ni], can: !lock && r < N.max && petTalFree(p) > 0 };
}
/* Ausrüstung: Halsband (Angriff), Panzer (Schutz für dich), Talisman (Magie, Beute); Legendär: ein besonderer Wert */
const PET_SLOTS = ['h', 'p', 't'];
const PET_SLOT = {
  h: { n: _t('Halsband'), names: [_t('Lederhalsband'), _t('Nietenhalsband'), _t('Silberhalsband'), _t('Runenhalsband'), _t('Sternenhalsband')], aff: ['pdmg', 'pcrit', 'paspd', 'pel'], leg: 'pspec', cost: [['leder', 6], ['zahn', 4]] },
  p: { n: _t('Panzer'), names: [_t('Stoffweste'), _t('Lederpanzer'), _t('Kettenpanzer'), _t('Schuppenpanzer'), _t('Drachenpanzer')], aff: ['def', 'hp', 'dr', 'pwund', 'regen'], leg: 'pheal', cost: [['leder', 8], ['erz', 6]] },
  t: { n: _t('Talisman'), names: [_t('Holztalisman'), _t('Knochentalisman'), _t('Kristalltalisman'), _t('Runentalisman'), _t('Äthertalisman')], aff: ['pmag', 'pmcd', 'gold', 'loot', 'xp'], leg: 'pbag', cost: [['knochen', 6], ['kristall', 2]] }
};
// Werte bei Stufe 100 und Seltenheit Gewöhnlich (Seltenheit gibt mehr Werte und je +15 %)
const PET_GAFF = { pdmg: .3, pcrit: .08, paspd: .2, pel: .4, def: 14, hp: .08, dr: .04, pwund: .3, regen: 4, pmag: .4, pmcd: .2, gold: .15, loot: .06, xp: .12, pspec: .2, pheal: .4, pbag: 1 };
const PET_GNUM = [1, 2, 2, 3, 3], PET_GEAR_MAX = 30;
// Werte nur für den Begleiter selbst (alle anderen gehen über HOOK.stats an den Helden)
const PET_INK = new Set(['pdmg', 'paspd', 'pcrit', 'pel', 'pmag', 'pmcd', 'pspec', 'pheal', 'pwund', 'pmagr', 'pbag', 'pegg']);
// Neues Ausrüstungsteil: Platz s, Seltenheit r (sonst gewürfelt), Stufe lv
function petGearNew(s, r, lv, R) {
  R = R || Math.random; const S = PET_SLOT[s]; if (!S) return null;
  if (r == null) r = +wpick({ 0: 46, 1: 30, 2: 15, 3: 7, 4: 2 }, R);
  r = clamp(r | 0, 0, 4); lv = clamp(Math.round(lv) || 1, 1, 100);
  const keys = S.aff.slice(), a = {};
  for (let i = 0; i < PET_GNUM[r] && keys.length; i++) { const k = keys.splice(Math.floor(R() * keys.length), 1)[0]; a[k] = petGearVal(k, lv, r, R); }
  if (r === 4) a[S.leg] = petGearVal(S.leg, lv, r, R);
  return { id: uid(), s, r, lv, a };
}
function petGearVal(k, lv, r, R) { if (k === 'pbag') return 1; const v = PET_GAFF[k] * (.25 + .75 * lv / 100) * (.75 + R() * .5) * (1 + r * .15); return k === 'def' || k === 'regen' ? Math.max(1, Math.round(v * 10) / 10) : Math.round(v * 1000) / 1000; }
function petGearName(it) { const S = PET_SLOT[it.s]; return S ? S.names[clamp(Math.floor((it.lv - 1) / 20), 0, 4)] : '?'; }
// Ausrüstung prüfen (Spielstand, Tausch)
function petGearFix(o, s) {
  if (!o || typeof o !== 'object' || !PET_SLOT[o.s] || (s && o.s !== s)) return null;
  const S = PET_SLOT[o.s], r = clamp(Math.floor(+o.r) || 0, 0, 4), lv = clamp(Math.floor(+o.lv) || 1, 1, 100), a = {};
  if (o.a && typeof o.a === 'object') for (const k of Object.keys(o.a)) { if (!(S.aff.includes(k) || k === S.leg) || Object.keys(a).length >= 4) continue; const v = +o.a[k]; if (isFinite(v) && v > 0) a[k] = Math.min(v, k === 'pbag' ? 1 : PET_GAFF[k] * 2); }
  return { id: typeof o.id === 'string' && o.id ? o.id.slice(0, 24) : uid(), s: o.s, r, lv, a };
}
/* Zauber: Runen, die der Begleiter in Sockel setzt und im Kampf selbst wirkt; 1 Sockel, ab LV 25 zwei, ab LV 75 drei */
const PET_SPELL = {
  feuerball: { n: _t('Feuerball'), d: _t('Eine große Feuerkugel, die explodiert und Gegner in Brand setzt.'), el: 'feuer', cd: 7, cost: [['glut', 3], ['kristall', 2]], gold: 150 },
  heilung: { n: _t('Heilung'), d: _t('Heilt dich, sobald du verletzt bist.'), el: 'licht', cd: 12, cost: [['schleim', 6], ['kristall', 2]], gold: 150 },
  schild: { n: _t('Schild'), d: _t('Ein Schutzschild fängt einige Sekunden lang Schaden für dich ab.'), el: 'licht', cd: 15, cost: [['erz', 8], ['mithril', 1]], gold: 200 },
  blitz: { n: _t('Blitz'), d: _t('Ein Kettenblitz springt durch viele Gegner.'), el: 'blitz', cd: 6, cost: [['erz', 5], ['kristall', 2]], gold: 150 },
  frostnova: { n: _t('Frostnova'), d: _t('Friert alle Gegner um den Begleiter ein.'), el: 'frost', cd: 11, cost: [['kristall', 3], ['mithril', 1]], gold: 200 },
  gift: { n: _t('Giftwolke'), d: _t('Eine Wolke, die alle Gegner darin vergiftet.'), el: 'gift', cd: 9, cost: [['schleim', 8], ['zahn', 3]], gold: 120 },
  meteor: { n: _t('Meteor'), d: _t('Ein Meteor schlägt ein und trifft alles in der Nähe hart.'), el: 'feuer', cd: 16, cost: [['glut', 5], ['stern', 1]], gold: 400 },
  ranken: { n: _t('Rankenfessel'), d: _t('Dornenranken fesseln Gegner und verletzen sie.'), el: 'gift', cd: 10, cost: [['leder', 6], ['horn', 2]], gold: 150 }
};
const PET_SPELLS = Object.keys(PET_SPELL);
function petSockets(p) { return 1 + (p.lv >= 25 ? 1 : 0) + (p.lv >= 75 ? 1 : 0); }
// Summe aller Boni aus Talenten, Ausrüstung und Mutation
function petMods(p) {
  const r = {}; if (!p) return r; const add = (k, v) => { r[k] = (r[k] || 0) + v; }, tl = petTl(p);
  PET_TAL.forEach((B, bi) => B.nodes.forEach((N, ni) => { const n = tl[bi * 5 + ni]; if (n) for (const k in N.e) add(k, N.e[k] * n); }));
  if (p.eq) for (const s of PET_SLOTS) { const it = p.eq[s]; if (it && it.a) for (const k in it.a) add(k, it.a[k]); }
  const M = PET_MUT[p.mu]; if (M) for (const k in M.b) add(k, M.b[k]);
  return r;
}
// Schaden (Talente, Ausrüstung, Kraft-Gen), Zauberkraft (Magie-Gen), Abklingzeiten
function petDmgMul(p) { return (1 + (petMods(p).pdmg || 0)) * petGeneK(p, 0, .85, .3); }
function petSpellPow(p) { return petDmgK(p.lv, p.sp) * 1.6 * (1 + (petMods(p).pmag || 0)) * petGeneK(p, 3, .8, .5); }
function petSpellCdK(p) { return (1 - Math.min(.5, petMods(p).pmcd || 0)) * petGeneK(p, 3, 1.1, -.2); }
function petHealK(p) { return (1 + (petMods(p).pheal || 0)) * petGeneK(p, 3, .8, .5); }
function petMagRp(p) { return petMagR(p.lv) * (1 + (petMods(p).pmagr || 0)); }
// Verletzungsdauer: Zähigkeit und „Dickes Fell“/Panzer verkürzen sie
function petWundK(p) { return (1 - Math.min(.6, petMods(p).pwund || 0)) * petGeneK(p, 2, 1.15, -.3); }
// Schaden je Treffer in Anteilen der Heldenwaffe; die Seltenheit der Art skaliert ihn (Selten = 1, Plunder 0,3, Mythisch 1,6)
function petDmgK(lv, sp) { return (.15 + lv * .006) * (sp ? PET_TIERS[PET_SP[sp].t].mul : 1); }
function petMagR(lv) { return lv < 10 ? 0 : 70 + (lv - 10) * 1.4; }
// Konto-Daten; fehlende Felder (z. B. aus Tests oder alten Ständen) still ergänzen
function petM() {
  const M = SAVE && SAVE.meta && SAVE.meta.pets; if (!M) return M;
  if (!Array.isArray(M.list)) M.list = []; if (!Array.isArray(M.eggs)) M.eggs = []; if (!Array.isArray(M.seen)) M.seen = [];
  if (!Array.isArray(M.gear)) M.gear = []; if (!M.runes || typeof M.runes !== 'object' || Array.isArray(M.runes)) M.runes = {}; if (!Array.isArray(M.mut)) M.mut = [];
  return M;
}
// Ausgewählter Begleiter (auch verletzt) bzw. der, der wirklich mitkämpft (null, wenn verletzt)
function petSel() { const M = petM(); if (!M || !M.act) return null; for (const p of M.list) if (p.id === M.act) return p; return null; }
function petActive() { const p = petSel(); return p && !petIsHurt(p) ? p : null; }
function petName(p) { return p.nm ? p.nm : PET_SP[p.sp].n; }
function petTier(sp) { return PET_TIERS[PET_SP[sp] ? PET_SP[sp].t : 0]; }
// Beutel: Plätze nach Seltenheit, ab Uralt (LV 75) einer mehr, dazu Talent „Große Taschen“ und legendärer Talisman
function petBagSize(p) { return p && PET_SP[p.sp] ? petTier(p.sp).bag + (petStage(p.lv) >= 4 ? 1 : 0) + Math.floor(petMods(p).pbag || 0) : 0; }
// Verletzung nach dem Tod in den Verlorenen Landen: kämpft nicht und kommt nicht mit, bis die Zeit um ist oder er geheilt wird
function petIsHurt(p) { return !!p && p.hurt > Date.now(); }
function petHurtLeft(p) { return petIsHurt(p) ? p.hurt - Date.now() : 0; }

/* ---------- Farben: Varianten je Art ---------- */
function petRgbHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function petHslRgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }, q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return s ? [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255)) : [l * 255, l * 255, l * 255].map(Math.round); }
const PET_VAR = [{ n: _t('Rubin'), h: 356 }, { n: _t('Saphir'), h: 218 }, { n: _t('Smaragd'), h: 135 }, { n: _t('Amethyst'), h: 280 }, { n: _t('Mondschein'), pale: 1 }, { n: _t('Bernstein'), h: 34 }, { n: _t('Türkis'), h: 178 }, { n: _t('Obsidian'), dark: 1 }];
const PET_VC = {};
// 6 Farben je Art: Klassisch + 5 Varianten, die sich deutlich von der Grundfarbe unterscheiden; 6 = schillernd
function petVariants(sp) {
  if (PET_VC[sp]) return PET_VC[sp];
  const S = PET_SP[sp], base = petRgbHsl(...hexRgb(S.pal.m[2]))[0], out = [{ n: _t('Klassisch'), v: null }];
  for (const V of PET_VAR) { if (out.length >= 6) break; if (V.h != null && Math.abs(angDiff(V.h / 57.2958, base / 57.2958)) * 57.2958 < 45) continue; out.push({ n: V.n, v: V }); }
  return PET_VC[sp] = out;
}
function petColName(sp, col) { return col === 6 ? _t('Schillernd') : petVariants(sp)[clamp(col | 0, 0, 5)].n; }
// Farbe eines Tons der Variante (nur Körper m und Flügel w werden umgefärbt)
function petVarCol(hex, V, base) {
  const [h, s, l] = petRgbHsl(...hexRgb(hex));
  if (V.pale) return petHslRgb(h, s * .22, .3 + l * .62);
  if (V.dark) return petHslRgb(h, s * .45, l * .55);
  return petHslRgb(h + V.h - base, Math.min(1, s * 1.05), l);
}
const PET_CMN = { k: '#1a1420', h: '#ffffff', o: '#140f1a', y: '#ffd24a', Y: '#fff3a0', p: '#ff8aa8', r: '#e8402a',
  // Mutationen: Flecken (x), Dornen (d), Leuchtpunkte (L), Flammen (F), Kristall (C), Schattenschleier (S)
  x0: '#a89880', x1: '#d8ccb4', x2: '#f4ecdc', x3: '#ffffff', d1: '#8a7a64', d2: '#efe2bf', L: '#7ffff0', F0: '#ff6a1a', F1: '#ffd24a', C1: '#9ad8ff', C2: '#f0fbff', S: '#9a4aff' };
// Mutantenformen färben Körper und Flügel ganz um (Lichtstufe bleibt erhalten)
const PET_MUTPAL = { albino: [0, .1, .58, .42], melan: [270, .25, .06, .32], kristall: [205, .55, .42, .5], schatten: [275, .45, .05, .3], gold: [44, .85, .3, .62], sternen: [232, .6, .08, .45] };
function petPal(sp, col, mu) {
  const S = PET_SP[sp], P0 = S.pal, V = col > 0 && col < 6 ? petVariants(sp)[col].v : null, base = petRgbHsl(...hexRgb(P0.m[2]))[0], pal = {}, MP = PET_MUTPAL[mu];
  for (const k in PET_CMN) pal[k] = hexRgb(PET_CMN[k]);
  for (const g of ['m', 'a', 'b', 'w']) P0[g].forEach((c, i) => {
    if (MP && (g === 'm' || g === 'w')) { const l = (i + .6) / (P0[g].length + .2); pal[g + i] = petHslRgb(MP[0] + (mu === 'kristall' ? i * 18 : mu === 'gold' ? i * 4 : 0), MP[1], clamp(MP[2] + l * MP[3], 0, .97)); return; }
    pal[g + i] = V && (g === 'm' || g === 'w') ? petVarCol(c, V, base) : hexRgb(c);
  });
  pal.e = hexRgb(P0.e); pal.g = hexRgb(P0.g);
  if (col === 6) { pal.a0 = hexRgb('#b898d0'); pal.a1 = hexRgb('#f0d8f8'); pal.a2 = hexRgb('#ffffff'); pal.o = hexRgb('#2a1438'); }
  if (mu === 'albino') { pal.e = hexRgb('#ff3a5a'); pal.k = hexRgb('#c83a4a'); }
  else if (mu === 'melan') pal.e = hexRgb('#ffe04a');
  else if (mu === 'schatten') { pal.e = hexRgb('#ff4aff'); pal.a0 = hexRgb('#4a2a7a'); pal.a1 = hexRgb('#8a4ad8'); pal.a2 = hexRgb('#d8a8ff'); pal.o = hexRgb('#0e0816'); }
  else if (mu === 'sternen') { pal.e = hexRgb('#fffbe0'); pal.o = hexRgb('#06061a'); }
  else if (mu === 'gold') { pal.o = hexRgb('#3a2408'); }
  else if (mu === 'kristall') { pal.o = hexRgb('#1a2a4a'); }
  return pal;
}
// Merkmale der Mutation ins Pixelbild malen (nach der Art, vor dem Umriss): Flecken, Dornen, Leuchtpunkte, Flammen, Kristalle, Schatten, Sterne, Glanz
function petHash(x, y, s) { let h = Math.imul(x * 73856093 ^ y * 19349663 ^ (s || 0) * 83492791, 2654435761) >>> 0; h = (h ^ h >>> 13) >>> 0; return (h % 1000) / 1000; }
function petMutPB(b, mu, s, f) {
  if (!PET_MUT[mu]) return;
  let x0 = b.w, x1 = -1, y0 = b.h; const top = [];
  for (let x = 0; x < b.w; x++) { top[x] = -1; for (let y = 0; y < b.h; y++) if (b.a[y * b.w + x]) { top[x] = y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; break; } }
  if (x1 < 0) return;
  const W = x1 - x0 + 1, body = k => k && (k[0] === 'm' || k[0] === 'w') && k.length === 2;
  const each = fn => { for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const k = b.a[y * b.w + x]; if (body(k)) fn(x, y, k); } };
  const spikes = (from, to, k1, k2, h) => { for (let x = Math.round(from); x <= to; x += 3) { const t = top[x]; if (t < 2) continue; for (let i = 1; i <= h; i++) b.set(x, t - i, i === h ? k2 : k1); if (h > 2) { b.set(x - 1, t - 1, k1); b.set(x + 1, t - 1, k1); } } };
  switch (mu) {
    case 'scheck': each((x, y, k) => { if (petHash(x >> 2, y >> 2, 7) > .55) b.a[y * b.w + x] = 'x' + k[1]; }); break;
    case 'dornen': spikes(x0 + 2, x0 + W * .55, 'd1', 'd2', 2 + (s >> 1)); break;
    case 'leucht': each((x, y) => { if (petHash(x, y, 3) < .05) b.a[y * b.w + x] = 'L'; }); break;
    case 'glut': for (let x = Math.round(x0 + W * .62); x <= x1; x++) { const t = top[x]; if (t < 3 || (x + f) % 2) continue; const h = 1 + Math.round(petHash(x, f, 5) * (2 + s * .4)); for (let i = 1; i <= h; i++) b.set(x, t - i, i > h - 1 ? 'F1' : 'F0'); } break;
    case 'kristall': each((x, y) => { if ((x + y) % 5 === 0) b.a[y * b.w + x] = 'm3'; }); spikes(x0 + 1, x0 + W * .7, 'C1', 'C2', 2 + (s >> 1)); break;
    case 'schatten': for (let x = x0; x <= x1; x += 2) { const t = top[x]; if (t < 2) continue; if (petHash(x, f, 9) < .4) { b.set(x, t - 1, 'S'); if (petHash(x, f, 11) < .4) b.set(x, t - 2, 'S'); } } break;
    case 'gold': each((x, y) => { if (petHash(x, y, f + 20) < .025) b.a[y * b.w + x] = 'h'; }); break;
    case 'sternen': each((x, y) => { const q = petHash(x, y, 4); if (q < .045) b.a[y * b.w + x] = (q * 1000 + f) % 3 < 1 ? 'Y' : 'h'; }); break;
  }
}

/* ---------- Pixel-Werkzeug (Schlüssel statt Farben: m0..m3 Körper, a Akzent, b Horn/Bauch, w Flügel) ---------- */
function ppE(b, cx, cy, rx, ry, k, n) {
  n = n || 3;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry, d = nx * nx + ny * ny; if (d > 1) continue;
    const l = (-nx * .5 - ny * .85) * .6 + (1 - d) * .35; let i = l > .55 ? 3 : l > .16 ? 2 : l > -.3 ? 1 : 0; if (i >= n) i = n - 1;
    b.set(x, y, k + i);
  }
}
function ppF(b, cx, cy, rx, ry, k) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const nx = (x + .5 - cx) / rx, ny = (y + .5 - cy) / ry; if (nx * nx + ny * ny <= 1) b.set(x, y, k); }
  if (rx < 1.1 || ry < 1.1) b.set(Math.floor(cx), Math.floor(cy), k);
}
function ppInPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function ppPoly(b, pts, k) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) if (ppInPoly(x + .5, y + .5, pts)) b.set(x, y, k);
}
function ppQB(p0, p1, p2, n) { const r = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; r.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return r; }
// Schlauch (Schwanz, Hals, Schlangenleib): dunkle Unterseite (oder Bauch bk), Mitte, heller Rücken
function ppTube(b, pts, r0, r1, k, bk) {
  const n = pts.length, R = i => lerp(r0, r1, i / Math.max(1, n - 1));
  for (let i = 0; i < n; i++) { const [x, y] = pts[i], r = R(i); if (r >= 1.6) ppF(b, x, y + r * .3, r, r, bk || k + '0'); }
  for (let i = 0; i < n; i++) { const [x, y] = pts[i], r = R(i); if (r >= 1.6) ppF(b, x, y - r * .12, r * .8, r * .8, k + '1'); else ppF(b, x, y, r, r, k + '1'); }
  for (let i = 0; i < n; i++) { const [x, y] = pts[i], r = R(i); if (r >= 1.6) ppF(b, x - r * .1, y - r * .48, r * .4, r * .36, k + '2'); else if (r >= .9) b.set(x, y - r * .7, k + '2'); }
}
function ppEye(b, x, y, w, h, bl, k) {
  x = Math.round(x); y = Math.round(y);
  if (bl) { for (let i = 0; i < w; i++) b.set(x + i, y + h - 1, 'k'); return; }
  b.rect(x, y, w, h, k || 'k'); b.set(x, y, 'h'); if (k && w > 1 && h > 1) b.set(x + w - 1, y + h - 1, 'k');
}
function ppRing(b, cx, cy, rx, ry, k) { for (let a = 0; a < 6.283; a += .12) b.set(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, k); }
function ppClear(b, x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.a[y * b.w + x] = null; }
function ppCrown(b, x, y, w) { x = Math.round(x - w / 2); y = Math.round(y); b.rect(x, y, w, 2, 'y'); for (let i = 0; i < w; i += 2) b.set(x + i, y - 1, 'y'); b.set(x + Math.floor(w / 2), y - 2, 'Y'); b.set(x + Math.floor(w / 2), y, 'r'); }
// Federflügel (Vögel): Wurzel, Länge, Schlag 0 oben … 2 unten, Schlüssel, hinterer Flügel?
function ppFWing(b, wx, wy, L, fl, k, far, tipK) {
  const a = [-1.95, -2.6, -3.35][fl] + (far ? .32 : 0), tip = [wx + Math.cos(a) * L, wy + Math.sin(a) * L], nx = Math.cos(a + 1.6), ny = Math.sin(a + 1.6), wd = L * .3;
  const m = [lerp(wx, tip[0], .5) + nx * wd, lerp(wy, tip[1], .5) + ny * wd];
  ppPoly(b, [[wx, wy], m, tip, [lerp(wx, tip[0], .6) - nx * 1.2, lerp(wy, tip[1], .6) - ny * 1.2], [wx + 1, wy + 1]], far ? k + '0' : k + '1');
  if (far) return;
  for (let i = 0; i < 4; i++) { const t = .42 + i * .15, x = lerp(wx, tip[0], t) + nx * wd * (1.15 - t), y = lerp(wy, tip[1], t) + ny * wd * (1.15 - t); b.set(x, y, tipK || k + '2'); b.set(x - nx, y - ny, k + '0'); }
  b.set(tip[0], tip[1], tipK || k + '2');
}
// Schnecken- und Wirbel-Spirale
function ppSpiral(b, cx, cy, r, turns, k) { const n = turns * 6.283; for (let a = 0; a < n; a += .12) { const q = r * (1 - a / n); b.set(cx + Math.cos(a + 3.3) * q, cy + Math.sin(a + 3.3) * q, k); } }
// Beine eines Vierbeiners (x, Boden, Breite, Schlüssel), Huf/Pfote in hk
function ppLeg(b, x, y0, gy, w, k, hk) { x = Math.round(x); b.rect(x, Math.round(y0), w, Math.max(1, Math.round(gy - y0)), k); if (hk) b.rect(x, gy - 1, w + 1, 1, hk); }
// Flamme/Zacke nach oben
function ppFlame(b, x, y, h, w, k1, k2) { ppPoly(b, [[x - w, y + 1], [x - w * .3, y - h * .55], [x, y - h], [x + w * .4, y - h * .5], [x + w, y + 1]], k1); if (k2 && h > 2) b.line(x, y - h * .6, x, y, k2); }

/* ---------- Die sechs Arten (Seitenansicht nach rechts; Boden bei gy, Mitte cx) ---------- */
const PET_CX = 32, PET_GY = 56;
// Flügel: Wurzel, Spannweite, Schlag (0 oben, 1 Mitte, 2 unten), Schlüssel, Knochen?
function ppWing(b, wx, wy, span, fl, k, bone, far) {
  if (span < 4) { ppE(b, wx - 1, wy - [2, 1, 0][fl], 2, 1.5, k); return; }
  const ang = [-2.05, -2.6, -3.15][fl] + (far ? .25 : 0), tip = [wx + Math.cos(ang) * span, wy + Math.sin(ang) * span];
  const elb = [wx + Math.cos(ang + .5) * span * .5, wy + Math.sin(ang + .5) * span * .5 - 1];
  const t1 = [lerp(tip[0], wx - span * .15, .45), lerp(tip[1], wy + span * .2, .45) + 1], t2 = [wx - span * .22, wy + span * .18];
  ppPoly(b, [[wx, wy], elb, tip, t1, t2, [wx + 1, wy + 2]], far ? k + '0' : k + '1');
  if (!far) { ppPoly(b, [[wx, wy], elb, [lerp(elb[0], t2[0], .5), lerp(elb[1], t2[1], .5)]], k + '0'); b.line(t1[0], t1[1], tip[0], tip[1], k + '2'); }
  if (bone) { b.line(wx, wy, elb[0], elb[1], bone); b.line(elb[0], elb[1], tip[0], tip[1], bone); b.line(elb[0], elb[1], t1[0], t1[1], bone); b.set(tip[0], tip[1] - 1, bone); }
}
const PET_ART = {
  drache(b, s, f, mv, bl) {
    const bz = 1 + s * .2, hz = 1 + s * .11, fl = [0, 1, 2, 1][f], lift = fl === 2 ? -1 : 0, cx = PET_CX, gy = PET_GY;
    const rx = 4.2 * bz, ry = 3.3 * bz, bx = cx - 1.2 * bz, by = gy - 2.2 * bz - ry + lift, hr = 4.2 * hz, hx = bx + rx * .95, hy = by - ry * .55 - hr * .5;
    const sw = [0, 1, 0, -1][f] * (mv ? 1.6 : 1), span = [3, 5.5, 7.5, 9.5, 11.5, 13.5][s];
    ppWing(b, bx - rx * .05, by - ry * .75, span * .85, fl, 'w', null, true);
    const tail = ppQB([bx - rx * .6, by + ry * .2], [bx - rx * 1.5, by + ry * .9 + 1], [bx - rx * 1.9 - s * .8, by - ry * .3 + sw], 10 + s * 2);
    ppTube(b, tail, ry * .5, .8, 'm');
    const tt = tail[tail.length - 1];
    if (s >= 3) ppPoly(b, [[tt[0] + 1, tt[1]], [tt[0] - 2 - s * .3, tt[1] - 2 - s * .3], [tt[0] - 3 - s * .4, tt[1] + 1], [tt[0] - 1, tt[1] + 2]], 'a1');
    if (s >= 4 && f % 2 === 0) { b.set(tt[0] - 3, tt[1] - 3, 'g'); b.set(tt[0] - 2, tt[1] - 4, 'a2'); }
    // Beine
    const ly = gy + lift, leg = (x, d) => { b.rect(Math.round(x), Math.round(by + ry * .5), Math.max(2, Math.round(1.4 * bz)), Math.max(1, Math.round(ly - (by + ry * .5))) - (mv ? 1 : 0), d ? 'm0' : 'm1'); b.rect(Math.round(x), Math.round(ly) - 1 - (mv ? 1 : 0), Math.max(2, Math.round(1.6 * bz)) + 1, 1, 'm0'); };
    leg(bx - rx * .55, 1); leg(bx + rx * .3, 0);
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .22, by + ry * .32, rx * .6, ry * .55, 'a');
    if (s >= 1) for (let i = 0; i < 2 + s; i++) b.set(bx + rx * (-.15 + i * .18), by + ry * (.12 + (i % 2) * .08) + 2, 'a0');
    if (s >= 2) for (let i = 0; i < 3 + s; i++) { const t = i / (3 + s), x = lerp(bx - rx * .8, hx - hr * .6, t), y = lerp(by - ry * .75, hy - hr * .55, t * t), h = 1.2 + s * .35; ppPoly(b, [[x - 1, y + 1], [x - .3, y - h], [x + 1.4, y + 1]], 'a1'); }
    ppE(b, bx + rx * .72, by - ry * .45, rx * .42, ry * .62, 'm', 4);
    ppE(b, hx, hy, hr, hr * .9, 'm', 4);
    ppE(b, hx + hr * .72, hy + hr * .3, hr * .62, hr * .44, 'm', 4);
    b.set(hx + hr * 1.18, hy + hr * .12, 'm0');
    b.line(hx + hr * .45, hy + hr * .62, hx + hr * 1.15, hy + hr * .5, 'm0');
    if (s <= 1) b.set(hx + hr * .2, hy + hr * .45, 'p');
    const ex = hx + hr * .12, ey = hy - hr * .32;
    ppEye(b, ex, ey, 2, s <= 1 ? 3 : 2, bl, s >= 4 ? 'g' : null);
    if (s >= 2) b.line(ex - 1, ey - 1, ex + 2, ey - 1 - (s >= 4 ? 1 : 0), 'm0');
    const hl = [0, 1.6, 3, 4.2, 5.2, 6.2][s];
    if (s >= 1) { const hb = [hx - hr * .3, hy - hr * .72], tip = [hb[0] - hl * .9, hb[1] - hl]; ppTube(b, ppQB(hb, [hb[0] - hl * .2, hb[1] - hl * .7], tip, 6), 1 + s * .15, .5, 'b'); if (s === 5) b.set(tip[0], tip[1], 'y'); }
    if (s >= 4) { const hb = [hx - hr * .65, hy - hr * .35]; b.line(hb[0], hb[1], hb[0] - hl * .7, hb[1] - hl * .45, 'b1'); }
    if (s >= 4) { b.set(bx + rx * .25, by + ry * .25, f % 2 ? 'g' : 'Y'); b.set(bx + rx * .25 + 1, by + ry * .25, 'g'); }
    if (s === 5) for (let i = 0; i < 4; i++) b.set(hx - hr * (.75 + i * .12), hy - hr * (.1 - i * .25) + (f + i) % 2, i % 2 ? 'g' : 'a2');
    ppWing(b, bx - rx * .25, by - ry * .62, span, fl, 'w', s >= 1 ? 'm0' : null, false);
  },
  katze(b, s, f, mv, bl) {
    const bz = 1 + s * .17, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, legH = 2.6 * bz, rx = 4.6 * bz, ry = 2.9 * bz, bx = cx - 1.4 * bz, by = gy - legH - ry * .75;
    const hr = (s ? 3.9 : 4.3) * hz, hx = bx + rx * .95, hy = by - ry * .8 - hr * .3, sw = [0, 1, 0, -1][f], lg = mv ? [1.2, 0, -1.2, 0][f] : 0;
    // Schwänze: ab Stark zwei, dann drei, fünf, sieben – wie eine Nekomata
    const nt = [1, 1, 2, 3, 4, 5][s], L = 6 + s * 1.3;
    for (let t = nt - 1; t >= 0; t--) {
      const q = nt === 1 ? .5 : t / (nt - 1), r0 = [bx - rx * .85, by - ry * .2], sx = (t % 2 ? 1 : -1) * sw * .8, Lt = L * (1 - Math.abs(q - .5) * .35);
      const p1 = [r0[0] - Lt * (.5 + q * .35) + sx, r0[1] + 1.5 - q * Lt * .25], p2 = [r0[0] - Lt * (.15 + q * .55) + sx * 1.6, r0[1] - Lt * (.95 - q * .35)];
      const pts = ppQB(r0, p1, p2, 8 + s); ppTube(b, pts, 1.35 * (1 + s * .08), .7, 'm');
      for (let i = Math.floor(pts.length * .7); i < pts.length; i++) b.set(pts[i][0], pts[i][1], i === pts.length - 1 ? 'a2' : 'a1');
      if (s >= 1 && (f + t) % 2 === 0) b.set(p2[0] + 1, p2[1] - 1, s === 5 ? 'y' : 'g');
    }
    const leg = (x, o, k) => { const lx = Math.round(x + o), w = Math.max(2, Math.round(1.5 * bz)); b.rect(lx, Math.round(by), w, Math.round(gy - by), k); b.rect(lx, gy - 1, w + 1, 1, k === 'm0' ? 'm0' : 'm2'); if (s >= 4 && (f + Math.round(x)) % 2) b.set(lx + 1, gy - 2, 'g'); };
    leg(bx - rx * .45, -lg, 'm0'); leg(bx + rx * .55, lg, 'm0');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .62, by + ry * .15, rx * .3, ry * .55, 'm', 4);
    if (s >= 4) for (let i = 0; i < 3; i++) b.line(bx - rx * .3 + i * 2.5, by - ry * .85, bx - rx * .4 + i * 2.5, by - ry * .3, 'a1');
    leg(bx - rx * .65, lg, 'm1'); leg(bx + rx * .35, -lg, 'm1');
    ppE(b, hx, hy, hr, hr * .88, 'm', 4);
    const ear = (x0, x1, tx) => { ppPoly(b, [[x0, hy - hr * .35], [x1, hy - hr * .8], [tx, hy - hr * 1.55 - s * .15]], 'm1'); b.set(lerp(x0, tx, .55) + .5, hy - hr * .95, 'a1'); };
    ear(hx - hr * .8, hx - hr * .05, hx - hr * .55); ear(hx + hr * .02, hx + hr * .78, hx + hr * .52);
    const ew = 2, eh = s <= 1 ? 3 : 2, ey = hy - hr * .2;
    ppEye(b, hx - hr * .12, ey, ew, eh, bl, 'e'); ppEye(b, hx + hr * .5, ey, ew, eh, bl, 'e');
    if (!bl && s >= 2) { b.set(hx - hr * .12 + 1, ey + 1, 'k'); b.set(hx + hr * .5 + 1, ey + 1, 'k'); }
    b.set(hx + hr * .32, hy + hr * .32, 'p'); b.set(hx + hr * .25, hy + hr * .5, 'k'); b.set(hx + hr * .42, hy + hr * .5, 'k');
    if (s <= 1) { b.set(hx - hr * .35, hy + hr * .35, 'p'); b.set(hx + hr * .85, hy + hr * .35, 'p'); }
    if (s >= 2) { b.line(hx + hr * .62, hy + hr * .38, hx + hr * .95, hy + hr * .3, 'm3'); b.line(hx - hr * .55, hy + hr * .42, hx - hr * .85, hy + hr * .32, 'm3'); }
    if (s >= 3) { const mx = hx + hr * .2, my = hy - hr * .62; b.set(mx, my, 'a2'); b.set(mx - 1, my + 1, 'a1'); b.set(mx + 1, my + 1, 'a1'); b.set(mx, my + 2, 'a1'); }
    if (s === 5) { b.set(hx - hr * .55, hy - hr * 1.6, 'y'); b.set(hx + hr * .52, hy - hr * 1.6, 'y'); }
  },
  kaefer(b, s, f, mv, bl) {
    // Nashornkäfer: gewölbter Panzer, Halsschild, kleiner Kopf mit Horn nach oben, ab Stark zweites Horn vom Halsschild
    const bz = 1 + s * .2, hz = 1 + s * .1, fl = [0, 1, 2, 1][f], cx = PET_CX, gy = PET_GY, rx = 4.2 * bz, ry = 3.7 * bz, bx = cx - 1.5 * bz, by = gy - 2.2 * bz - ry + (fl === 2 ? -1 : 0);
    const px_ = bx + rx * .78, py_ = by + ry * .1, prx = rx * .3, pry = ry * .5, hr = 2.7 * hz, hx = px_ + prx * .9 + hr * .45, hy = py_ + pry * .45;
    const wing = far => { const a = [-1.95, -2.45, -2.95][fl] + (far ? .32 : 0), Lw = rx * (1.1 + s * .04), r0 = [bx + rx * .05, by - ry * .65], tip = [r0[0] + Math.cos(a) * Lw, r0[1] + Math.sin(a) * Lw], n = [Math.cos(a + 1.57) * 1.7 * bz, Math.sin(a + 1.57) * 1.7 * bz]; ppPoly(b, [r0, [lerp(r0[0], tip[0], .5) + n[0], lerp(r0[1], tip[1], .5) + n[1]], tip, [lerp(r0[0], tip[0], .55) - n[0] * .45, lerp(r0[1], tip[1], .55) - n[1] * .45]], far ? 'w0' : 'w1'); if (!far) b.line(r0[0], r0[1], lerp(r0[0], tip[0], .9), lerp(r0[1], tip[1], .9), 'w2'); };
    wing(true);
    for (let i = 0; i < 3; i++) { const x = bx - rx * .35 + i * rx * .48, y = by + ry * .62, k = (f + i) % 2; b.line(x, y, x - 1 + k, y + 1.6 * bz, 'b0'); b.line(x - 1 + k, y + 1.6 * bz, x + k, y + 2.4 * bz, 'b0'); }
    ppE(b, bx, by + ry * .28, rx * .96, ry * .68, 'b');
    ppE(b, bx, by - ry * .1, rx, ry * .86, 'm', 4);
    b.line(bx - rx * .9, by + ry * .32, bx + rx * .55, by + ry * .4, 'm0');
    for (let i = 0; i < 2 + s; i++) b.set(bx - rx * .45 + i * .9, by - ry * .72 + Math.abs(i - (2 + s) / 2) * .4, 'm3');
    if (s >= 3) for (const [dx, dy] of [[-.4, -.05], [.12, -.42], [-.75, -.35], [.2, .05]].slice(0, s - 1)) ppF(b, bx + rx * dx, by + ry * dy, .8 + s * .12, .7 + s * .1, 'a1');
    if (s >= 4) for (const [dx, dy, o] of [[-.15, -.3, 0], [.4, -.1, 1], [-.55, .05, 0]]) b.set(bx + rx * dx, by + ry * dy, (f + o) % 2 ? 'g' : 'h');
    ppE(b, px_, py_, prx, pry, 'm', 4);
    b.line(px_ - prx * .9, py_ - pry * .55, px_ - prx * .7, py_ + pry * .7, 'm0');
    if (s >= 3) { const hb = [px_ + prx * .2, py_ - pry * .8], hl = 1.5 + s * .5; ppTube(b, ppQB(hb, [hb[0] + hl * .6, hb[1] - hl * .5], [hb[0] + hl, hb[1] - hl * .2], 5), .8 + s * .1, .5, 'm'); }
    wing(false);
    ppE(b, hx, hy, hr * 1.05, hr, 'b');
    if (s >= 1) { const hl = [0, 2.6, 3.8, 4.8, 5.8, 6.8][s], hb = [hx + hr * .55, hy - hr * .45]; ppTube(b, ppQB(hb, [hb[0] + hl * .55, hb[1] - hl * .25], [hb[0] + hl * .6, hb[1] - hl], 7), 1 + s * .15, .6, 'm'); }
    const at = [0, 1, 0, -1][f], ar = [hx - hr * .2, hy - hr * .85], al = 2.5 + s * .5, atip = [ar[0] + al * .35, ar[1] - al + at * .5];
    b.line(ar[0], ar[1], atip[0], atip[1], 'b1'); b.rect(atip[0], atip[1] - 1, 2, 2, 'm2'); b.set(atip[0], atip[1] - 1, 'm3');
    const ex = hx - hr * .05, ey = hy - hr * .2, er = 1.5 + s * .12;
    if (bl) b.line(ex - er, ey, ex + er, ey, 'k'); else { ppF(b, ex, ey, er, er, 'h'); b.rect(ex, ey - 1, 2, 2, 'k'); b.set(ex, ey - 1, 'h'); }
    if (s <= 1) b.set(hx + hr * .45, hy + hr * .45, 'p');
    if (s === 5) ppCrown(b, px_ - prx * .2, py_ - pry * 1.35, 5);
  },
  eule(b, s, f, mv, bl) {
    const bz = 1 + s * .19, hz = 1 + s * .11, fl = [0, 1, 2, 1][f], cx = PET_CX, gy = PET_GY, rx = 3.8 * bz, ry = 4.3 * bz, bx = cx - .5, by = gy - 1.4 * bz - ry + (fl === 2 ? -1 : 0);
    const hr = 3.9 * hz, hx = bx + rx * .25, hy = by - ry * .82;
    if (s === 5) { const tp = ppQB([bx - rx * .6, by + ry * .6], [bx - rx * 1.5, by + ry * .9], [bx - rx * 2.2, by + ry * .4 + [0, 1, 0, -1][f]], 10); ppTube(b, tp, 1.4, .6, 'w'); b.set(tp[10][0], tp[10][1], 'y'); }
    ppPoly(b, [[bx - rx * .5, by + ry * .5], [bx - rx * 1.25 - s * .3, by + ry * .95], [bx - rx * .2, by + ry * .9]], 'm1');
    const wing = far => { const a = [-1.9, -2.6, -3.5][fl] + (far ? .3 : 0), L = rx * (1 + s * .08) + 1.5, r0 = [bx - rx * .1, by - ry * .35], tip = [r0[0] + Math.cos(a) * L, r0[1] + Math.sin(a) * L], m = [lerp(r0[0], tip[0], .5) + Math.cos(a + 1.6) * 2.2 * bz, lerp(r0[1], tip[1], .5) + Math.sin(a + 1.6) * 2.2 * bz]; ppPoly(b, [r0, m, tip, [lerp(r0[0], tip[0], .55) + Math.cos(a - 1.6) * 1.2, lerp(r0[1], tip[1], .55) + Math.sin(a - 1.6) * 1.2]], far ? 'w0' : 'w1'); if (!far) for (let i = 1; i <= 2 + (s >> 1); i++) { const t = .35 + i * .14; b.set(lerp(r0[0], tip[0], t) + Math.cos(a + 1.6), lerp(r0[1], tip[1], t) + Math.sin(a + 1.6), 'w2'); } };
    if (mv || f !== 0 || s >= 0) wing(true);
    for (const o of [-1, 1]) { b.set(bx + o * 1.5, gy - 1 + (fl === 2 ? -1 : 0), 'b1'); b.set(bx + o * 1.5 + 1, gy - 1 + (fl === 2 ? -1 : 0), 'b0'); }
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .3, by + ry * .28, rx * .6, ry * .58, 'a');
    if (s >= 2) for (let i = 0; i < Math.min(3, s - 1); i++) { const x = bx + rx * (i === 1 ? .45 : 0) + .5, y = by + ry * (i === 2 ? .4 : .05); b.set(x, y, 'm1'); b.set(x + 1, y + 1, 'm1'); b.set(x + 2, y, 'm1'); }
    wing(false);
    if (s >= 1) { const tl = [0, 1.6, 2.6, 3.4, 4, 4.6][s]; ppPoly(b, [[hx - hr * .85, hy - hr * .35], [hx - hr * .3, hy - hr * .78], [hx - hr * .9 - tl * .4, hy - hr * .8 - tl]], 'm1'); ppPoly(b, [[hx + hr * .25, hy - hr * .78], [hx + hr * .85, hy - hr * .4], [hx + hr * .75 + tl * .3, hy - hr * .85 - tl]], 'm1'); }
    ppE(b, hx, hy, hr * 1.05, hr * .92, 'm', 4);
    ppE(b, hx + hr * .32, hy + hr * .08, hr * .74, hr * .62, 'a');
    const er = s <= 1 ? 1.6 : 1.4 + s * .1;
    for (const ex of [hx - hr * .05, hx + hr * .68]) { if (bl) { b.line(ex - er, hy, ex + er, hy, 'm1'); continue; } ppF(b, ex, hy - .2, er, er, 'e'); b.set(ex, hy, 'k'); if (s >= 3) b.set(ex - 1, hy, 'k'); b.set(ex - er * .6, hy - er * .7, 'h'); }
    ppPoly(b, [[hx + hr * .22, hy + hr * .3], [hx + hr * .52, hy + hr * .3], [hx + hr * .37, hy + hr * .62]], 'b1');
    if (s <= 1) { b.set(hx - hr * .45, hy + hr * .45, 'p'); b.set(hx + hr * .95, hy + hr * .45, 'p'); }
    if (s >= 3) { const x = hx + hr * .32, y = hy - hr * .62; b.set(x, y, 'g'); b.set(x, y - 1, 'h'); b.set(x - 1, y, 'g'); b.set(x + 1, y, 'g'); b.set(x, y + 1, 'g'); }
    if (s >= 4) for (let i = 0; i < 2 + s - 3; i++) { const x = hx - hr * .55 + i * hr * .45, y = hy - hr * .85; b.line(x, y, x + .5, y - 2 - (i % 2) * 1.5, i % 2 ? 'h' : 'g'); }
    if (s === 5) ppCrown(b, hx + hr * .2, hy - hr * 1.25, 7);
  },
  natter(b, s, f, mv, bl) {
    const bz = 1 + s * .18, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, r = 1.55 * bz, L = 11 + s * 2.4, ph = f * Math.PI / 2, A = (mv ? 1.5 : .9) * bz;
    const hr = 2.7 * hz, hx = cx + L * .38 + 1.5, hy = gy - 5.5 * bz - 2, pts = [];
    for (let i = 0; i <= 22; i++) { const t = i / 22, x = cx - L * .62 + t * L * .95; pts.push([x, gy - r - Math.sin(t * 7.5 + ph) * A * (.4 + t * .6) * (1 - t * .5)]); }
    const nb = pts[pts.length - 1];
    for (const q of ppQB(nb, [nb[0] + 2.5 * bz, nb[1] - .5], [hx - hr * .7, hy + hr * .5], 7).slice(1)) pts.push(q);
    ppTube(b, pts, .7, r * 1.05, 'm', 'a1');
    if (s >= 1) for (let i = 2; i < pts.length - 4; i += 3) b.set(pts[i][0], pts[i][1] - r * .5, s >= 3 ? 'b1' : 'm0');
    if (s === 5) { const wp = pts[Math.floor(pts.length * .55)]; ppWing(b, wp[0], wp[1] - r * .6, 12, [0, 1, 2, 1][f], 'w', 'y', false); }
    if (s >= 2) { const hs = .7 + (s - 2) * .16, hcx = hx - hr * .6, hcy = hy + hr * .45; ppE(b, hcx, hcy, hr * .8 * hs + .5, hr * 1.2 * hs + 1, 'm', 4); ppE(b, hcx + hr * .3, hcy + hr * .1, hr * .45 * hs, hr * .85 * hs, 'a'); if (s >= 3) { b.set(hcx - hr * .35, hcy - hr * .3, 'b2'); b.set(hcx - hr * .35, hcy + hr * .3, 'b1'); } }
    ppE(b, hx, hy, hr * 1.2, hr * .82, 'm', 4);
    ppE(b, hx + hr * .55, hy + hr * .25, hr * .8, hr * .48, 'm', 4);
    if (s <= 1) { ppEye(b, hx + hr * .05, hy - hr * .45, 2, 2, bl, null); b.set(hx - hr * .1, hy + hr * .35, 'p'); }
    else { ppEye(b, hx + hr * .05, hy - hr * .42, 2, 2, bl, 'e'); if (!bl) b.set(hx + hr * .05 + 1, hy - hr * .42, 'k'); }
    if (!bl && (f === 1 || f === 2)) { const tx = hx + hr * 1.3, ty = hy + hr * .45; b.line(tx, ty, tx + 2, ty, 'r'); b.set(tx + 3, ty - 1, 'r'); b.set(tx + 3, ty + 1, 'r'); }
    if (s >= 3) b.set(hx + hr * 1, hy + hr * .75, 'h');
    if (s >= 4) { b.line(hx - hr * .6, hy - hr * .6, hx - hr * 1.2, hy - hr * 1.4, 'b1'); b.line(hx - hr * .2, hy - hr * .75, hx - hr * .5, hy - hr * 1.6, 'b2'); }
    if (s === 5) ppCrown(b, hx, hy - hr * 1.2, 5);
  },
  funke(b, s, f, mv, bl) {
    const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, r = 3.5 * bz, bx = cx, by = gy - 2 - r - 1.2 * bz + (f === 2 ? -1 : 0);
    if (s >= 3) for (const [dx, dy, rr] of [[-.9, 1, .55], [0, 1.15, .65], [.9, 1, .5]]) ppE(b, bx + dx * r, by + dy * r, r * rr, r * rr * .62, 'b');
    const jit = [0, 1, -1, 0][f], tp = [[bx - r * .6, by + r * .2], [bx - r * 1.3, by - r * .25 + jit], [bx - r * 1.75, by + r * .4], [bx - r * 2.4 - s * .4, by - r * .05 - jit]];
    for (let i = 0; i < tp.length - 1; i++) { b.line(tp[i][0], tp[i][1], tp[i + 1][0], tp[i + 1][1], 'a1'); b.line(tp[i][0], tp[i][1] + 1, tp[i + 1][0], tp[i + 1][1] + 1, 'a0'); }
    b.set(tp[3][0], tp[3][1], 'a2');
    const n = 4 + s, sp = 1.4 + s * .5;
    for (let k = 0; k < n; k++) { const a = k / n * 6.283 + f * .26 + .3, ca = Math.cos(a), sa = Math.sin(a), l = r + sp + (k % 2) * (1 + s * .2); ppPoly(b, [[bx + Math.cos(a - .32) * r * .8, by + Math.sin(a - .32) * r * .8], [bx + ca * l, by + sa * l], [bx + Math.cos(a + .32) * r * .8, by + Math.sin(a + .32) * r * .8]], k % 2 ? 'a1' : 'a0'); b.set(bx + ca * (l - .5), by + sa * (l - .5), 'a2'); }
    ppE(b, bx, by, r, r, 'm', 4);
    ppF(b, bx - r * .25, by - r * .3, r * .3, r * .3, 'm3');
    const ey = by - r * .3, ew = s >= 3 ? 3 : 2, eh = s <= 1 || s >= 3 ? 3 : 2;
    ppEye(b, bx, ey, ew, eh, bl, null); ppEye(b, bx + r * .5 + (ew - 2), ey, ew, eh, bl, null);
    b.set(bx + r * .3, by + r * .42, 'k'); b.set(bx + r * .42, by + r * .5, 'k'); b.set(bx + r * .54, by + r * .42, 'k');
    if (s <= 2) { b.set(bx - r * .2, by + r * .25, 'p'); b.set(bx + r * .85, by + r * .25, 'p'); }
    if (s >= 2) for (let k = 0; k < (s >= 4 ? 3 : 2); k++) { const a = f * 1.57 + k * 6.283 / (s >= 4 ? 3 : 2), x = bx + Math.cos(a) * (r + 3), y = by + Math.sin(a) * (r + 2) * .7; b.rect(x, y, 2, 2, 'a2'); b.set(x, y, 'h'); }
    if (s >= 4) for (let k = -1; k <= 1; k++) b.line(bx + k * r * .45, by - r * .9, bx + k * r * .6, by - r - 3 - (k ? 0 : 2), 'a2');
    if (s === 5) ppCrown(b, bx + r * .1, by - r - 2, 7);
  }
};
/* ---------- Die 18 neuen Arten (gleiche Regeln: nach rechts, Boden bei PET_GY) ---------- */
Object.assign(PET_ART, {
  schnecke(b, s, f, mv, bl) {
    const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, st = mv ? [0, 1, 2, 1][f] * .6 : 0, L = 6 * bz + st;
    // Fuß, Kopf mit Stielaugen, Haus mit Spirale
    ppE(b, cx + st * .5, gy - 1.5 * bz, L, 1.7 * bz, 'm', 4);
    const hx = cx + L * .82, hy = gy - 3 * bz + (mv ? 0 : [0, 0, .5, 0][f]);
    ppE(b, hx, hy, 2.1 * bz, 2.6 * bz, 'm', 4);
    const ex = hx + bz * .2, el = 3.2 + s * .7;
    for (const [dx, k] of [[-1.4, 'm1'], [.8, 'm2']]) { const x0 = ex + dx, y0 = hy - 1.6 * bz, tx = Math.round(x0 + el * .4), ty = Math.round(y0 - el); b.line(x0, y0, tx, ty, k); if (bl) b.rect(tx - 1, ty, 2, 1, 'm0'); else { b.rect(tx - 1, ty - 1, 2, 2, 'h'); b.set(tx, ty, 'k'); if (s >= 2) b.set(tx - 1, ty - 2, 'h'); } }
    b.line(hx + bz * .9, hy + bz * .9, hx + bz * 1.6, hy + bz * .6, 'm0'); if (s <= 1) b.set(hx + bz * .3, hy + bz * .6, 'p');
    const sx = cx - L * .2, sr = 3.6 * bz, sy = gy - 2.4 * bz - sr * .9;
    if (s >= 2) for (let i = 0; i < 3 + s; i++) { const a = -2.6 + i * (1.9 / (2 + s)), x = sx + Math.cos(a) * sr, y = sy + Math.sin(a) * sr; ppPoly(b, [[x - 1, y + 1], [x + Math.cos(a) * (1.5 + s * .4), y + Math.sin(a) * (1.5 + s * .4)], [x + 1, y + 1]], 'b1'); }
    ppE(b, sx, sy, sr, sr * .95, 'a', 3);
    ppSpiral(b, sx + .5, sy, sr * .82, 1.6 + s * .25, 'a0');
    b.set(sx - sr * .45, sy - sr * .55, 'a2'); b.set(sx - sr * .35, sy - sr * .65, 'a2');
    if (s >= 3) { ppF(b, sx + .5, sy, 1 + s * .15, 1 + s * .15, 'g'); b.set(sx, sy - .5, 'h'); }
    if (s >= 4) for (let i = 0; i < 4; i++) b.set(cx - L - 1 - i * 2, gy - 1 - (i + f) % 2, i % 2 ? 'g' : 'w2');
    if (s === 5) ppCrown(b, sx, sy - sr - 2, 5);
  },
  assel(b, s, f, mv, bl) {
    const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, rx = 4.8 * bz, ry = 2.8 * bz, bx = cx - 1, by = gy - 1.4 * bz - ry * .75;
    const nl = 5 + (s >> 1);
    for (let i = 0; i < nl; i++) { const x = bx - rx * .75 + i * rx * 1.5 / (nl - 1), k = mv ? (f + i) % 2 : 0; b.line(x, by + ry * .5, x - 1 + k * 2, gy - 1, 'b1'); }
    ppE(b, bx, by, rx, ry, 'm', 4);
    const n = 5 + Math.min(3, s), h0 = x => ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - bx) / rx, 2)));
    for (let i = 1; i < n; i++) { const x = Math.round(bx - rx + i * rx * 2 / n), h = h0(x); b.line(x, by - h + 1, x, by + h * .55, 'm0'); b.set(x + 1, by - h + 1, 'm3'); if (s >= 2) b.set(x + 1, by - h + 2, 'a1'); if (s >= 4 && (i + f) % 2) b.set(x + 1, by, 'g'); }
    if (s >= 3) for (let i = 1; i < n; i += 2) { const x = Math.round(bx - rx + i * rx * 2 / n) + 1, h = h0(x); ppPoly(b, [[x - 1, by - h + 1], [x, by - h - 1 - s * .45], [x + 1, by - h + 1]], 'a1'); b.set(x, by - h - s * .45, 'a2'); }
    b.line(bx - rx - .5, by + ry * .2, bx - rx - 2.5, by + ry * .1, 'b1'); b.line(bx - rx - .5, by + ry * .5, bx - rx - 2.5, by + ry * .7, 'b1');
    const hx = bx + rx * .88, hy = by + ry * .3, hr = 2 * bz; ppE(b, hx, hy, hr, hr * .9, 'b', 3);
    const at = [0, 1, 0, -1][f], al = 3.5 + s * .8;
    b.line(hx + hr * .4, hy - hr * .6, hx + hr * .4 + al, hy - hr * .6 - al * .7 + at * .5, 'b2'); b.line(hx, hy - hr * .7, hx + al * .7, hy - hr * .7 - al + at * .5, 'b1');
    if (bl) b.line(hx, hy - .5, hx + 1, hy - .5, 'k'); else { b.rect(hx - .5, hy - 1.5, 2, 2, 'k'); b.set(hx - .5, hy - 1.5, 'h'); if (s >= 4) b.set(hx + .5, hy - .5, 'e'); }
    if (s <= 1) b.set(hx + hr * .7, hy + hr * .5, 'p');
    if (s === 5) ppCrown(b, bx, by - ry - 2, 5);
  },
  taube(b, s, f, mv, bl) {
    const bz = 1 + s * .18, hz = 1 + s * .1, fl = [0, 1, 2, 1][f], cx = PET_CX, gy = PET_GY, rx = 3.9 * bz, ry = 3.1 * bz, bx = cx - 1, by = gy - 1.6 * bz - ry - (fl === 2 ? 1 : 0);
    const hr = 2.5 * hz, hx = bx + rx * .8, hy = by - ry * .75;
    const tl = 2.5 + s * (s >= 3 ? 1.1 : .7), tx = bx - rx - tl, fan = 1.5 + s * .55;
    ppPoly(b, [[bx - rx * .5, by - 1], [tx, by - 1 - fan], [tx - 1, by + .5], [tx, by + 1.5 + fan * .6], [bx - rx * .3, by + ry * .5]], 'w1');
    b.line(tx, by - fan, tx - .5, by + 1 + fan * .5, 'm0'); b.line(bx - rx * .5, by, tx + 1, by - fan * .4, 'w2');
    if (s >= 3) for (let i = 0; i < 3; i++) b.set(tx + 1, by - fan + 1 + i * fan * .7, 'g');
    ppFWing(b, bx - rx * .1, by - ry * .4, rx * 1.2 + s, fl, 'w', true);
    for (const o of [-1, 1]) b.rect(bx + o * 1.2, gy - 1 - (fl === 2 ? 1 : 0), 1, 1, 'b1');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .5, by - ry * .35, rx * .42, ry * .5, 'a', 3);
    if (s >= 2) { b.line(bx - rx * .3, by + 1, bx + rx * .1, by + 1, 'm0'); b.line(bx - rx * .2, by + 3, bx + rx * .2, by + 3, 'm0'); }
    ppFWing(b, bx - rx * .2, by - ry * .3, rx * 1.15 + s, fl, 'w', false, s >= 4 ? 'g' : null);
    ppE(b, hx, hy, hr, hr * .95, 'm', 4);
    ppPoly(b, [[hx + hr * .7, hy - .5], [hx + hr + 2 + s * .2, hy + .5], [hx + hr * .7, hy + 1]], 'm0'); b.set(hx + hr * .8, hy - .8, 'h');
    if (bl) b.line(hx, hy - .5, hx + 1, hy - .5, 'k'); else { b.rect(hx, hy - 1, 2, 2, 'e'); b.set(hx + 1, hy, 'k'); }
    if (s <= 1) b.set(hx - hr * .3, hy + hr * .5, 'p');
    if (s >= 3) { b.line(hx - hr * .4, hy - hr, hx - hr * .9, hy - hr - 2 - (s - 3), 'm2'); b.set(hx - hr * .9, hy - hr - 2.5 - (s - 3), 'g'); }
    if (s === 5) ppCrown(b, hx, hy - hr - 2, 5);
  },
  maus(b, s, f, mv, bl) {
    const bz = 1 + s * .2, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, rx = 3.6 * bz, ry = 2.6 * bz, bx = cx - 1, by = gy - 1.1 * bz - ry, lg = mv ? [1, 0, -1, 0][f] : 0;
    const tl = ppQB([bx - rx * .9, by + ry * .4], [bx - rx * 2.2, by + ry * 1.2], [bx - rx * 2.3 - s * .5, by - ry * (1 + s * .15) + [0, 1, 0, -1][f]], 10);
    for (const [x, y] of tl) b.set(x, y, 'b0');
    const tt = tl[tl.length - 1]; if (s >= 1) { b.set(tt[0], tt[1] - 1, 'a1'); b.set(tt[0] - 1, tt[1] - 2, 'a2'); if (s >= 3) ppPoly(b, [[tt[0] - 1, tt[1]], [tt[0] + 1, tt[1] - 3 - s * .3], [tt[0] + .5, tt[1] - 1], [tt[0] + 2, tt[1] - 4 - s * .4]], 'a1'); }
    b.rect(bx - rx * .5 + lg, gy - 1, 2, 1, 'b1'); b.rect(bx + rx * .4 - lg, gy - 1, 2, 1, 'b1');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .3, by + ry * .4, rx * .55, ry * .45, 'b', 3);
    if (s >= 2) { const zx = bx - rx * .5; b.line(zx, by - ry * .9, zx + 1.5, by - ry * .3, 'a1'); b.line(zx + 1.5, by - ry * .3, zx + .5, by - ry * .3, 'a1'); b.line(zx + .5, by - ry * .3, zx + 2, by + ry * .3, 'a1'); }
    const hr = 2.6 * hz, hx = bx + rx * .85, hy = by - ry * .35;
    for (const [dx, k] of [[-.55, 'm1'], [.35, 'm2']]) { const ex = hx + hr * dx, ey = hy - hr * .9, er = 1.6 * hz + (s <= 1 ? .4 : 0); ppF(b, ex, ey, er, er, k); ppF(b, ex + .3, ey + .2, er * .55, er * .55, 'b1'); }
    ppE(b, hx, hy, hr, hr * .85, 'm', 4);
    ppE(b, hx + hr * .7, hy + hr * .25, hr * .55, hr * .42, 'm', 4); b.set(hx + hr * 1.25, hy + hr * .1, 'b1');
    ppEye(b, hx + hr * .1, hy - hr * .3, 2, s <= 1 ? 2 : 1, bl, null);
    b.line(hx + hr * .9, hy + hr * .35, hx + hr * 1.6, hy + hr * .2, 'm3'); b.line(hx + hr * .9, hy + hr * .5, hx + hr * 1.6, hy + hr * .7, 'm3');
    if (s <= 2) b.set(hx - hr * .3, hy + hr * .35, 'p'); else { b.set(hx - hr * .25, hy + hr * .3, 'a1'); b.set(hx - hr * .35, hy + hr * .4, 'a2'); }
    if (s >= 4) for (let k = 0; k < 3; k++) { const a = f * 1.57 + k * 2.09; b.set(bx + Math.cos(a) * (rx + 2), by + Math.sin(a) * (ry + 2), k % 2 ? 'a2' : 'g'); }
    if (s === 5) ppCrown(b, hx - hr * .1, hy - hr * 1.9, 5);
  },
  kroete(b, s, f, mv, bl) {
    const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, rx = 4.8 * bz, ry = 3 * bz, bx = cx - .5, by = gy - .6 * bz - ry, hop = mv && f % 2 ? -1 : 0;
    ppE(b, bx - rx * .55, gy - 1.6 * bz + hop, rx * .45, 1.7 * bz, 'm', 3);
    ppE(b, bx, by + hop, rx, ry, 'm', 4);
    ppE(b, bx + rx * .2, by + ry * .72 + hop, rx * .62, ry * .3, 'b', 3);
    if (!mv && (f === 1 || f === 2)) ppF(b, bx + rx * .62, by + ry * .62 + hop, 1.3 + s * .2, 1.1 + s * .2, 'b2');
    for (let i = 0; i < 3 + s; i++) { const x = bx - rx * .6 + ((i * 37) % 10) / 10 * rx * 1.1, y = by - ry * .4 + ((i * 53) % 7) / 7 * ry * .5 + hop; b.set(x, y, 'a1'); if (i % 2) b.set(x + 1, y, 'a0'); }
    if (s >= 2) for (let i = 0; i < Math.min(5, s); i++) { const x = bx - rx * .55 + i * rx * .3, y = by - ry * .82 + hop + Math.abs(i - 2) * .5; ppPoly(b, [[x - 1, y + 1], [x, y - 1 - s * .35], [x + 1, y + 1]], 'w1'); b.set(x, y - s * .35, 'w2'); }
    ppE(b, bx + rx * .55, gy - 1.2 * bz + hop, 1.5 * bz, 1 * bz, 'm', 2);
    for (const dx of [.25, .7]) { const ex = bx + rx * dx, ey = by - ry * .75 + hop; ppE(b, ex, ey, 1.6 * bz, 1.5 * bz, 'm', 4); if (bl) b.line(ex - 1, ey, ex + 1, ey, 'm0'); else { ppF(b, ex, ey - .3, 1.1 * bz, 1 * bz, 'e'); b.line(ex - .6, ey - .3, ex + .6, ey - .3, 'k'); b.set(ex - .7, ey - 1, 'h'); } }
    b.line(bx + rx * .4, by + ry * .3 + hop, bx + rx * .99, by + ry * .05 + hop, 'm0'); b.set(bx + rx * .38, by + ry * .22 + hop, 'm0');
    if (s <= 1) b.set(bx + rx * .55, by + ry * .35 + hop, 'p');
    if (s >= 4) { for (const dx of [.25, .7]) b.set(bx + rx * dx, by - ry * .75 + hop - .3, 'g'); if (f % 2) b.set(bx - rx * .2, by - ry - 2, 'w2'); }
    if (s === 5) ppCrown(b, bx + rx * .48, by - ry - 2 + hop, 5);
  },
  huhn(b, s, f, mv, bl) {
    const bz = 1 + s * .18, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, legH = 2.6 * bz, rx = 3.6 * bz, ry = 3.3 * bz, bx = cx - 1, by = gy - legH - ry * .8, bob = mv ? [0, -1, 0, -1][f] : 0;
    const tw = [0, 1, 2, 3, 4, 5][s];
    for (let i = 0; i < 3 + (s >> 1); i++) { const a = -2.3 - i * .28, L = 3.5 * bz + tw * .9 - i * .4, x0 = bx - rx * .55, y0 = by - ry * .2; const tip = [x0 + Math.cos(a) * L, y0 + Math.sin(a) * L]; ppTube(b, ppQB([x0, y0], [x0 + Math.cos(a + .5) * L * .6, y0 + Math.sin(a + .5) * L * .6], tip, 6), 1.3, .6, i % 2 ? 'w' : 'm'); if (s >= 3) { b.set(tip[0], tip[1], 'a2'); b.set(tip[0] - 1, tip[1], 'a1'); } }
    const lg = mv ? [1, 0, -1, 0][f] : 0;
    for (const [o, d] of [[-.3, lg], [.3, -lg]]) { const x = bx + rx * o + d; b.line(x, by + ry * .6, x, gy - 1, 'b1'); b.line(x, gy - 1, x + 2, gy - 1, 'b1'); }
    ppE(b, bx, by + bob, rx, ry, 'm', 4);
    const wf = mv ? [0, 1, 2, 1][f] : 0; ppFWing(b, bx - rx * .1, by - ry * .1 + bob, rx * (.9 + wf * .15), [2, 1, 0][wf], 'w', false);
    const hr = 2.3 * hz, hx = bx + rx * .7, hy = by - ry * .85 + bob;
    ppE(b, hx, hy, hr, hr, 'm', 4);
    for (let i = 0; i < 2 + Math.min(3, s); i++) ppF(b, hx - hr * .4 + i * 1.1, hy - hr - .3 - (i % 2) * .6 - s * .2, .9 + s * .1, 1 + s * .15, 'a1');
    ppPoly(b, [[hx + hr * .7, hy - .8], [hx + hr + 1.5 + s * .2, hy + .2], [hx + hr * .7, hy + .8]], 'b1');
    ppF(b, hx + hr * .7, hy + hr * .9, .8 + s * .15, 1.2 + s * .2, 'a1');
    ppEye(b, hx + hr * .1, hy - hr * .35, 1, 2, bl, null); if (s >= 2 && !bl) b.line(hx - .5, hy - hr * .6, hx + 1.5, hy - hr * .45, 'm0');
    if (s <= 1) b.set(hx - hr * .25, hy + hr * .3, 'p');
    if (s >= 4 && f % 2) { b.set(hx + hr + 3, hy - 1, 'a2'); b.set(hx + hr + 4, hy, 'a1'); }
    if (s === 5) ppCrown(b, hx, hy - hr - 3.5, 5);
  },
  fuchs(b, s, f, mv, bl) {
    const bz = 1 + s * .17, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, legH = 2.8 * bz, rx = 4.4 * bz, ry = 2.5 * bz, bx = cx - 1.5 * bz, by = gy - legH - ry * .7, lg = mv ? [1.2, 0, -1.2, 0][f] : 0, sw = [0, 1, 0, -1][f];
    const tr = 2.1 * bz, tp = ppQB([bx - rx * .8, by - ry * .1], [bx - rx * 1.9, by + ry * .8], [bx - rx * 2.1 - s * .6, by - ry * (1.2 + s * .2) + sw], 9 + s);
    ppTube(b, tp, tr * .65, tr, 'm');
    const tt = tp[tp.length - 1]; ppF(b, tt[0], tt[1], tr * .85, tr * .85, 'b2'); ppF(b, tt[0] + .5, tt[1] + .5, tr * .5, tr * .5, 'b1');
    if (s >= 1) ppFlame(b, tt[0], tt[1] - tr * .6, 2.5 + s * .9 + (f % 2), 1.4 + s * .2, 'a1', 'a2');
    if (s >= 3) for (let i = 2; i < tp.length - 2; i += 3) b.set(tp[i][0], tp[i][1] - tr * .9, (i + f) % 2 ? 'a1' : 'a2');
    for (const [x, o, k] of [[bx - rx * .5, -lg, 'w0'], [bx + rx * .55, lg, 'w0']]) ppLeg(b, x + o, by, gy, Math.max(2, Math.round(1.3 * bz)), k, 'w0');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .55, by + ry * .25, rx * .38, ry * .6, 'b', 3);
    for (const [x, o, k] of [[bx - rx * .7, lg, 'w1'], [bx + rx * .35, -lg, 'w1']]) ppLeg(b, x + o, by + ry * .3, gy, Math.max(2, Math.round(1.3 * bz)), k, 'w2');
    if (s >= 2) for (let i = 0; i < 2 + s; i++) { const x = lerp(bx - rx * .2, bx + rx * .8, i / (1 + s)); ppFlame(b, x, by - ry * .8, 1.5 + s * .4 + ((i + f) % 2), 1, 'a1'); }
    const hr = 2.7 * hz, hx = bx + rx * .95, hy = by - ry * .9;
    for (const [dx, k] of [[-.6, 'm1'], [.25, 'm2']]) { const x0 = hx + hr * dx; ppPoly(b, [[x0 - 1, hy - hr * .4], [x0 + 1.5 * hz, hy - hr * .5], [x0 + .5, hy - hr - 2.2 * hz - s * .3]], k); b.set(x0 + .4, hy - hr - 1.6 * hz - s * .3, 'w1'); b.set(x0 + .3, hy - hr * .7, 'b0'); }
    ppE(b, hx, hy, hr, hr * .85, 'm', 4);
    ppPoly(b, [[hx + hr * .3, hy - hr * .1], [hx + hr + 2.4 * hz, hy + hr * .35], [hx + hr * .2, hy + hr * .8]], 'm2');
    ppPoly(b, [[hx + hr * .2, hy + hr * .35], [hx + hr + 2 * hz, hy + hr * .45], [hx + hr * .2, hy + hr * .85]], 'b2');
    b.set(hx + hr + 2.4 * hz, hy + hr * .3, 'k');
    ppEye(b, hx + hr * .15, hy - hr * .3, 2, s <= 1 ? 2 : 1, bl, s >= 4 ? 'e' : null);
    if (s <= 1) b.set(hx - hr * .3, hy + hr * .35, 'p');
    if (s === 5) ppCrown(b, hx - hr * .2, hy - hr - 3.5, 5);
  },
  igel(b, s, f, mv, bl) {
    const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, rx = 4.2 * bz, ry = 3 * bz, bx = cx - .5, by = gy - 1 * bz - ry * .85, hop = mv && f % 2 ? -1 : 0;
    const n = 7 + s * 2, sl = 1.6 + s * .55;
    for (let i = 0; i < n; i++) { const a = Math.PI * (1.02 + i / (n - 1) * .9), ca = Math.cos(a), sa = Math.sin(a), x = bx - rx * .1 + ca * rx * .9, y = by + sa * ry * .9 + hop, L = sl * (i % 2 ? .8 : 1.1); ppPoly(b, [[x - sa * 1.1, y + ca * 1.1], [x + ca * L * 1.2, y + sa * L], [x + sa * 1.1, y - ca * 1.1]], i % 2 ? 'w1' : 'a1'); if (s >= 3) b.set(x + ca * L, y + sa * L * .85, 'a2'); }
    ppE(b, bx, by + hop, rx, ry, 'w', 3);
    for (let i = 0; i < 5 + s; i++) { const x = bx - rx * .6 + (i * 29 % 11) / 11 * rx * 1.1, y = by - ry * .6 + (i * 17 % 7) / 7 * ry * .9 + hop; b.set(x, y, 'a2'); }
    const hx = bx + rx * .65, hy = by + ry * .25 + hop; ppE(b, hx, hy, 2.6 * bz, 2.2 * bz, 'm', 4);
    ppE(b, hx + 1.8 * bz, hy + .6 * bz, 1.4 * bz, 1 * bz, 'b', 3); b.set(hx + 3 * bz, hy + .3 * bz, 'k');
    ppEye(b, hx + .2 * bz, hy - .9 * bz, 2, s <= 1 ? 2 : 1, bl, null);
    if (s <= 2) b.set(hx - .6 * bz, hy + .6 * bz, 'p');
    for (const o of [-1.5, 1.5]) b.rect(bx + o * bz * 1.4, gy - 1, 2, 1, 'b0');
    if (s >= 4 && f % 2) { b.set(bx - rx - 2, by - ry, 'g'); b.set(bx + 2, by - ry - sl - 2, 'h'); }
    if (s === 5) ppCrown(b, bx - 1, by - ry - sl - 1 + hop, 5);
  },
  fleder(b, s, f, mv, bl) {
    const bz = 1 + s * .18, cx = PET_CX, gy = PET_GY, fl = [0, 1, 2, 1][f], r = 2.9 * bz, bx = cx, by = gy - 3 - r - (fl === 2 ? 1 : 0), span = 4 + s * 1.7;
    // Flügel zu beiden Seiten hinter dem Körper: Fingerknochen und gezackte Hinterkante
    const wing = (sd, k) => {
      const rx0 = bx + sd * r * .55, ry0 = by - r * .3, tx = bx + sd * (r + span), ty = ry0 + [-span * .6, -span * .12, span * .3][fl], L = (q, d) => [lerp(rx0, tx, q), lerp(ry0, ty, q) + d * bz];
      const edge = [[.74, 2.4], [.6, 1.1], [.44, 2.9], [.3, 1.5], [.12, 3]].map(([q, d]) => L(q, d + s * .25));
      ppPoly(b, [[rx0, ry0 - 1.2], [tx, ty], ...edge, [rx0, ry0 + r * .6]], k);
      b.line(rx0, ry0, tx, ty, 'm0'); b.line(rx0, ry0, edge[0][0], edge[0][1], 'm0'); b.line(rx0, ry0, edge[2][0], edge[2][1], 'm0'); b.set(tx, ty - 1, 'm2');
    };
    wing(-1, 'w0'); wing(1, 'w1');
    for (const [dx, k] of [[-.55, 'm1'], [.45, 'm2']]) { const x0 = bx + r * dx; ppPoly(b, [[x0 - 1.3, by - r * .45], [x0 + 1.3, by - r * .55], [x0 + dx * .8, by - r - 2.4 - s * .55]], k); ppPoly(b, [[x0 - .4, by - r * .7], [x0 + .6, by - r * .7], [x0 + dx * .6, by - r - 1.4 - s * .4]], 'a1'); if (s >= 3) b.set(x0 + dx * .8, by - r - 2.8 - s * .55, 'm3'); }
    ppE(b, bx, by, r, r * 1.05, 'm', 4);
    if (s >= 2) ppE(b, bx + r * .1, by + r * .45, r * .55, r * .4, 'm', 4);
    const ex = bx + r * .05, ey = by - r * .3;
    if (bl) { b.line(ex - 1, ey, ex, ey, 'k'); b.line(ex + 2, ey, ex + 3, ey, 'k'); } else { b.rect(ex - 1, ey - 1, 2, 2, s >= 3 ? 'e' : 'k'); b.rect(ex + 2, ey - 1, 2, 2, s >= 3 ? 'e' : 'k'); b.set(ex - 1, ey - 1, 'h'); b.set(ex + 2, ey - 1, 'h'); }
    b.set(ex + 1, ey + 1, 'a1'); b.set(ex + 1.5, ey + 1.6, 'a0'); b.set(ex, ey + 2.6, 'b2'); b.set(ex + 2, ey + 2.6, 'b2');
    if (s <= 1) { b.set(ex - 1.8, ey + 1.5, 'p'); b.set(ex + 3.8, ey + 1.5, 'p'); }
    for (const o of [-1, 1]) b.set(bx + o, by + r + 1, 'm0');
    if (s >= 4) for (let i = 0; i < 3; i++) b.set(bx - r - 2 - i * 2, by + r * .8 + ((f + i) % 2) * 2, i % 2 ? 'g' : 'a2');
    if (s === 5) ppCrown(b, bx, by - r - 4 - s * .5, 5);
  },
  irrlicht(b, s, f, mv, bl) {
    const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, r = 2.8 * bz, bx = cx, by = gy - 3 - r - 1.5 * bz + (f === 2 ? -1 : 0), sw = [0, 1, 0, -1][f] * (1 + s * .2), tip = r * (1.5 + s * .15);
    for (let i = 0; i < 3 + (s >> 1); i++) { const t = i / 3; ppF(b, bx - r * (1.1 + t * 1.3) - (mv ? 1 : 0), by + r * (.4 + t * .25) + ((i + f) % 2), r * (.42 - t * .1), r * (.42 - t * .1), i % 2 ? 'a0' : 'a1'); }
    // Flamme: unten rund, oben eine wehende Spitze; innen der leuchtende Kern mit Gesicht
    const fl = (k, sc) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; pts.push([bx + Math.cos(a) * r * 1.15 * sc, by + Math.sin(a) * r * 1.05 * sc]); } pts.push([bx - r * .85 * sc, by - r * .8 * sc], [bx - r * .25 * sc + sw * .4, by - r * 1.35 * sc], [bx + sw, by - r * .4 - tip * sc], [bx + r * .35 * sc + sw * .5, by - r * 1.2 * sc], [bx + r * .9 * sc, by - r * .6 * sc]); ppPoly(b, pts, k); };
    fl('a0', 1.12); fl('a1', 1); fl('a2', .72);
    if (s >= 2) for (const sd of [-1, 1]) ppFlame(b, bx + sd * r * .95, by - r * .2, 2 + s * .4 + ((f + (sd > 0 ? 1 : 0)) % 2), 1, 'a1');
    ppE(b, bx + .3, by + r * .15, r * .72, r * .7, 'm', 4);
    const ey = by + r * .05;
    if (bl) { b.line(bx - 1, ey, bx, ey, 'k'); b.line(bx + 2, ey, bx + 3, ey, 'k'); } else { b.rect(bx - 1, ey - 1, 1 + (s <= 1 ? 1 : 0), 2, 'k'); b.rect(bx + 2, ey - 1, 1 + (s <= 1 ? 1 : 0), 2, 'k'); }
    b.set(bx + .5, ey + 2, 'k'); b.set(bx + 1.5, ey + 2, 'k'); if (s <= 1) { b.set(bx - 1.5, ey + 1.5, 'p'); b.set(bx + 3.5, ey + 1.5, 'p'); }
    if (s >= 2) for (let k = 0; k < (s >= 4 ? 3 : 2); k++) { const a = f * 1.57 + k * 6.283 / (s >= 4 ? 3 : 2), x = bx + Math.cos(a) * (r + 3.5), y = by + Math.sin(a) * (r + 2) * .7; b.rect(x, y, 2, 2, 'w2'); b.set(x, y, 'h'); }
    if (s >= 4) ppRing(b, bx + sw, by - r - tip - 2, r * .9, 1.2, 'g');
    if (s === 5) ppCrown(b, bx, by - r * 1.6, 5);
  },
  golem(b, s, f, mv, bl) {
    const bz = 1 + s * .16, cx = PET_CX, gy = PET_GY, rx = 4.4 * bz, ry = 3.9 * bz, bx = cx - 1, by = gy - 2.4 * bz - ry * .9, st = mv ? [0, -1, 0, -1][f] : 0;
    const top = x => by + st - ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - bx) / rx, 2)));
    const cr = (x, y, h, w) => { ppPoly(b, [[x - w, y + 1], [x - w * .3, y - h], [x + w * .5, y - h * .75], [x + w, y + 1]], 'a1'); b.line(x - w * .3, y - h, x - w * .5, y, 'a2'); b.set(x - w * .3, y - h, 'h'); b.line(x + w * .5, y - h * .7, x + w * .8, y, 'a0'); };
    // Felsbrocken mit Gesicht, Fäusten und Kristallen auf dem Rücken
    ppE(b, bx - rx * .8, by + ry * .35 + st, 1.9 * bz, 2.2 * bz, 'm', 3);
    for (const [o, d] of [[-.45, st], [.3, -st]]) b.rect(Math.round(bx + rx * o - 1), Math.round(by + ry * .6), Math.round(2.3 * bz), Math.round(gy - by - ry * .6) + d, 'm1');
    ppE(b, bx, by + st, rx, ry, 'm', 4);
    b.line(bx - rx * .3, by + ry * .55 + st, bx + rx * .1, by + ry * .7 + st, 'm1'); b.set(bx - rx * .55, by - ry * .1 + st, 'm1'); b.set(bx - rx * .2, by + ry * .25 + st, 'm1');
    const nc = 2 + Math.min(3, s); for (let i = 0; i < nc; i++) { const x = bx - rx * .7 + i * rx * .85 / (nc - 1), h = 1.6 + s * .6 + (i % 2 ? 0 : 1.2); cr(x, top(x) + 1.5, h, .9 + s * .12); }
    const ey = by - ry * .28 + st, e1 = bx + rx * .3, e2 = bx + rx * .68;
    b.line(e1 - 1, ey - 1.5, e2 + 1, ey - 1.8, 'm0');
    for (const ex of [e1, e2]) { b.rect(ex - .5, ey - 1, 2, 3, 'k'); if (!bl) { b.set(ex + .5, ey, s >= 3 ? 'g' : 'e'); b.set(ex + .5, ey + 1, 'e'); } }
    b.line(e1, ey + 2.2, e2, ey + 2, 'm0'); if (s <= 1) { b.set(e1 - 1.5, ey + 1.2, 'p'); b.set(e2 + 1.5, ey + 1.2, 'p'); }
    if (s >= 3) { const hx = bx - rx * .15, hy = by + ry * .3 + st; ppPoly(b, [[hx, hy - 1.5 - s * .2], [hx + 1.2, hy], [hx, hy + 1.5 + s * .2], [hx - 1.2, hy]], s >= 4 ? 'g' : 'a1'); b.set(hx, hy - .5, 'h'); }
    ppE(b, bx + rx * .88, by + ry * .55 + st, 1.9 * bz, 2.1 * bz, 'm', 4); b.line(bx + rx * .7, by + ry * .7 + st, bx + rx * 1.05, by + ry * .62 + st, 'm0');
    if (s >= 2) cr(bx + rx * .95, by + ry * .05 + st, 1.4 + s * .4, .9);
    if (s === 5) ppCrown(b, bx + rx * .3, top(bx + rx * .3) - 2, 5);
  },
  wolf(b, s, f, mv, bl) {
    const bz = 1 + s * .17, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, legH = 3 * bz, rx = 4.8 * bz, ry = 2.7 * bz, bx = cx - 1.5 * bz, by = gy - legH - ry * .7, lg = mv ? [1.3, 0, -1.3, 0][f] : 0, sw = [0, 1, 0, -1][f];
    const tp = ppQB([bx - rx * .8, by - ry * .2], [bx - rx * 1.6, by + ry * .2], [bx - rx * 1.9 - s * .4, by - ry * .6 + sw], 8 + s);
    ppTube(b, tp, 1.1 * bz, 1.8 * bz, 'm');
    if (s >= 3) for (let i = 0; i < 3; i++) { const p = tp[tp.length - 1 - i * 2]; b.set(p[0] - 1, p[1] - 2 - (f + i) % 2, 'a0'); }
    for (const [x, o] of [[bx - rx * .5, -lg], [bx + rx * .55, lg]]) ppLeg(b, x + o, by, gy, Math.max(2, Math.round(1.4 * bz)), 'm0', 'm0');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .55, by + ry * .25, rx * .38, ry * .55, 'b', 3);
    for (const [x, o] of [[bx - rx * .7, lg], [bx + rx * .35, -lg]]) ppLeg(b, x + o, by + ry * .3, gy, Math.max(2, Math.round(1.4 * bz)), 'm1', 'm0');
    const mn = 3 + s; for (let i = 0; i < mn; i++) { const x = lerp(bx + rx * .1, bx + rx * .85, i / (mn - 1)), y = by - ry * .75 - i * .3; ppPoly(b, [[x - 1.2, y + 1.5], [x - .5 - s * .2, y - 1.5 - s * .45], [x + 1.2, y + 1.5]], 'w1'); }
    if (s >= 3) { b.line(bx - rx * .4, by - ry * .2, bx - rx * .1, by + ry * .3, 'a1'); b.line(bx - rx * .1, by + ry * .3, bx + rx * .1, by - ry * .1, 'a1'); }
    if (s >= 4 && f % 2) for (const o of [-.5, .55]) b.set(bx + rx * o, gy - 2, 'a2');
    const hr = 2.8 * hz, hx = bx + rx * .98, hy = by - ry * .95;
    for (const [dx, k] of [[-.55, 'm1'], [.2, 'm2']]) { const x0 = hx + hr * dx; ppPoly(b, [[x0 - 1, hy - hr * .4], [x0 + 1.6 * hz, hy - hr * .5], [x0 + .2, hy - hr - 1.8 * hz - s * .3]], k); b.set(x0 + .2, hy - hr * .7, 'a0'); }
    ppE(b, hx, hy, hr, hr * .9, 'm', 4);
    ppPoly(b, [[hx + hr * .3, hy - hr * .2], [hx + hr + 2.6 * hz, hy + hr * .2], [hx + hr + 2.4 * hz, hy + hr * .75], [hx + hr * .2, hy + hr * .85]], 'm2');
    b.line(hx + hr * .5, hy + hr * .55, hx + hr + 2.2 * hz, hy + hr * .55, 'm0'); b.set(hx + hr + 2.6 * hz, hy + hr * .15, 'k');
    if (s >= 2) b.set(hx + hr + 1.5 * hz, hy + hr * .7, 'h');
    ppEye(b, hx + hr * .1, hy - hr * .3, 2, s <= 1 ? 2 : 1, bl, 'e');
    if (s <= 1) b.set(hx - hr * .35, hy + hr * .35, 'p');
    if (s === 5) ppCrown(b, hx - hr * .2, hy - hr - 3.5, 5);
  },
  phoenix(b, s, f, mv, bl) {
    const bz = 1 + s * .18, hz = 1 + s * .1, fl = [0, 1, 2, 1][f], cx = PET_CX, gy = PET_GY, rx = 3.8 * bz, ry = 3 * bz, bx = cx - 1, by = gy - 2 * bz - ry - (fl === 2 ? 1 : 0);
    const nt = Math.min(3, 2 + (s >> 1)), tl = 6 + s * 2.2;
    for (let i = 0; i < nt; i++) { const q = nt === 1 ? .5 : i / (nt - 1), sw = [0, 1, 0, -1][(f + i) % 4], L = tl * (1 - Math.abs(q - .5) * .5), tp = ppQB([bx - rx * .7, by + ry * .1], [bx - rx - L * .45, by + ry * (.5 + q * .5)], [bx - rx - L, by + ry * (q * 3 - 1.5) + sw], 9); for (const [x, y] of tp) { b.set(x, y, 'w1'); b.set(x, y + 1, 'w0'); } const e = tp[tp.length - 1]; ppFlame(b, e[0], e[1] + 1, 2 + s * .5, 1 + s * .15, 'a1', 'a2'); }
    ppFWing(b, bx - rx * .1, by - ry * .4, rx * 1.4 + s * 1.2, fl, 'w', true);
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .35, by + ry * .3, rx * .55, ry * .5, 'a', 3);
    ppFWing(b, bx - rx * .2, by - ry * .3, rx * 1.35 + s * 1.2, fl, 'w', false, s >= 2 ? 'a2' : null);
    const hr = 2.5 * hz, hx = bx + rx * .8, hy = by - ry * .8;
    for (let i = 0; i < 2 + Math.min(3, s); i++) { const a = -2.1 - i * .3, L = 2.5 + s * .8 - i * .3; b.line(hx - hr * .2, hy - hr * .6, hx - hr * .2 + Math.cos(a) * L, hy - hr * .6 + Math.sin(a) * L, i % 2 ? 'a1' : 'm2'); b.set(hx - hr * .2 + Math.cos(a) * L, hy - hr * .6 + Math.sin(a) * L, 'a2'); }
    ppE(b, hx, hy, hr, hr * .95, 'm', 4);
    ppPoly(b, [[hx + hr * .6, hy - .8], [hx + hr + 2 + s * .2, hy + .3], [hx + hr + 1, hy + 1.5], [hx + hr * .6, hy + .8]], 'b1'); b.set(hx + hr + 1.5, hy + 1, 'b0');
    ppEye(b, hx + hr * .05, hy - hr * .35, 2, s <= 1 ? 2 : 1, bl, s >= 3 ? 'e' : null);
    if (s <= 1) b.set(hx - hr * .3, hy + hr * .35, 'p');
    if (s >= 4) for (let i = 0; i < 3; i++) b.set(bx - rx + i * 3, by - ry - 2 - ((f + i) % 2) * 2, i % 2 ? 'a2' : 'g');
    if (s === 5) ppCrown(b, hx, hy - hr - 4, 5);
  },
  greif(b, s, f, mv, bl) {
    const bz = 1 + s * .17, hz = 1 + s * .1, fl = [0, 1, 2, 1][f], cx = PET_CX, gy = PET_GY, legH = 2.8 * bz, rx = 4.6 * bz, ry = 2.8 * bz, bx = cx - 1.5 * bz, by = gy - legH - ry * .7 - (fl === 2 ? 1 : 0), lg = mv ? [1.2, 0, -1.2, 0][f] : 0;
    const tp = ppQB([bx - rx * .8, by - ry * .1], [bx - rx * 1.5, by + ry * .9], [bx - rx * 1.9 - s * .4, by - ry * .2 + [0, 1, 0, -1][f]], 8); for (const [x, y] of tp) b.set(x, y, 'm1');
    const tt = tp[tp.length - 1]; ppF(b, tt[0], tt[1], 1.2 + s * .2, 1.2 + s * .2, 'm0');
    ppFWing(b, bx + rx * .1, by - ry * .6, rx * 1.3 + s * 1.3, fl, 'w', true);
    ppLeg(b, bx - rx * .5 - lg, by, gy, Math.max(2, Math.round(1.4 * bz)), 'm0', 'm0'); ppLeg(b, bx + rx * .55 + lg, by, gy, Math.max(2, Math.round(1.2 * bz)), 'b0', 'y');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .55, by + ry * .1, rx * .45, ry * .7, 'b', 3);
    ppLeg(b, bx - rx * .7 + lg, by + ry * .3, gy, Math.max(2, Math.round(1.4 * bz)), 'm1', 'm0'); ppLeg(b, bx + rx * .35 - lg, by + ry * .3, gy, Math.max(2, Math.round(1.2 * bz)), 'b1', 'y');
    ppFWing(b, bx, by - ry * .5, rx * 1.25 + s * 1.3, fl, 'w', false, s >= 2 ? 'a1' : null);
    if (s >= 3) for (let i = 0; i < 3; i++) b.set(bx - rx * .2 - i * 2, by - ry - 2 - i * 1.5 - s * .3, i % 2 ? 'a2' : 'a1');
    const hr = 2.7 * hz, hx = bx + rx * .95, hy = by - ry * 1.05;
    ppE(b, hx, hy, hr, hr * .95, 'b', 3);
    for (let i = 0; i < 2 + (s >> 1); i++) b.set(hx - hr * .9 - i * .7, hy - hr * .4 + i * 1.2, 'b0');
    ppPoly(b, [[hx + hr * .5, hy - hr * .5], [hx + hr + 2.2 * hz, hy - hr * .1], [hx + hr + 2 * hz, hy + hr * .6], [hx + hr + .8, hy + hr * .2], [hx + hr * .5, hy + hr * .4]], 'y'); b.set(hx + hr + 2 * hz, hy + hr * .5, 'k');
    ppEye(b, hx + hr * .05, hy - hr * .3, 2, s <= 1 ? 2 : 1, bl, s >= 4 ? 'e' : null); if (!bl && s >= 2) b.line(hx - 1, hy - hr * .6, hx + 2, hy - hr * .5, 'b0');
    if (s <= 1) b.set(hx - hr * .3, hy + hr * .4, 'p');
    if (s >= 4 && f % 2) { b.set(tt[0] - 2, tt[1] - 2, 'a2'); b.set(hx + hr + 3, hy - hr, 'a1'); }
    if (s === 5) ppCrown(b, hx - hr * .2, hy - hr - 2, 5);
  },
  eisdrache(b, s, f, mv, bl) {
    PET_ART.drache(b, s, f, mv, bl);
    const bz = 1 + s * .2, hz = 1 + s * .11, fl = [0, 1, 2, 1][f], lift = fl === 2 ? -1 : 0, rx = 4.2 * bz, ry = 3.3 * bz, bx = PET_CX - 1.2 * bz, by = PET_GY - 2.2 * bz - ry + lift, hr = 4.2 * hz, hx = bx + rx * .95, hy = by - ry * .55 - hr * .5;
    // Eiskristalle auf dem Rücken, Frostbart, Eiszapfen am Schwanz
    for (let i = 0; i < 2 + s; i++) { const t = i / (2 + s), x = lerp(bx - rx * .9, hx - hr * .4, t), y = lerp(by - ry * .6, hy - hr * .7, t * t) - 1, h = 1.6 + s * .45 + (i % 2); ppPoly(b, [[x - 1, y + 1], [x, y - h], [x + 1, y + 1]], 'a1'); b.set(x, y - h + 1, 'h'); }
    if (s >= 2) for (let i = 0; i < 2 + (s >> 1); i++) { const x = hx - hr * (.2 + i * .35), y = hy - hr * (.85 - i * .2); ppPoly(b, [[x, y + 1], [x - 1.5 - s * .3, y - 1.5 - s * .4], [x + 1, y]], 'a2'); }
    if (s >= 3) { const tx = bx - rx * 1.9 - s * .8; b.line(tx, by - ry * .3, tx - 2 - s * .4, by - ry * .3 + 3 + s * .3, 'a2'); }
    if (s >= 4 && f % 2) { b.set(hx + hr * 1.6, hy, 'h'); b.set(hx + hr * 1.9, hy - 1, 'a2'); }
  },
  einhorn(b, s, f, mv, bl) {
    const bz = 1 + s * .17, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, legH = 3.6 * bz, rx = 4.6 * bz, ry = 2.6 * bz, bx = cx - 1.5 * bz, by = gy - legH - ry * .7, lg = mv ? [1.3, 0, -1.3, 0][f] : 0, sw = [0, 1, 0, -1][f];
    const mane = (pts, w) => pts.forEach(([x, y], i) => { ppF(b, x, y, w, w, ['a1', 'w1', 'a2', 'b1'][i % 4]); });
    mane(ppQB([bx - rx * .9, by - ry * .4], [bx - rx * 1.6, by + ry * .1], [bx - rx * 1.6 - s * .4 + sw, by + ry * 1.6], 6 + s), .9 + s * .12);
    if (s >= 4) { ppFWing(b, bx + rx * .1, by - ry * .6, rx * .9 + s, [0, 1, 2, 1][f], 'w', true); }
    for (const [x, o] of [[bx - rx * .55, -lg], [bx + rx * .55, lg]]) ppLeg(b, x + o, by, gy, Math.max(2, Math.round(1.2 * bz)), 'm1', s >= 2 ? 'b1' : 'm0');
    ppE(b, bx, by, rx, ry, 'm', 4);
    for (const [x, o] of [[bx - rx * .7, lg], [bx + rx * .4, -lg]]) ppLeg(b, x + o, by + ry * .3, gy, Math.max(2, Math.round(1.2 * bz)), 'm2', s >= 2 ? 'b1' : 'm0');
    const nx = bx + rx * .85, ny = by - ry * .4, hr = 2.3 * hz, hx = nx + 1.5 * hz, hy = by - ry - 3 * hz;
    ppTube(b, ppQB([nx - 1, ny + 1], [nx, ny - 2 * hz], [hx - .5, hy + 1], 5), 1.8 * bz, 1.5 * hz, 'm');
    mane(ppQB([hx - hr * .8, hy - hr * .5], [nx - 2.5, ny - 1.5 * hz], [nx - 2.5 - s * .2, ny + 2 + s * .4], 5 + s), .8 + s * .1);
    ppE(b, hx, hy, hr, hr * .85, 'm', 4);
    ppPoly(b, [[hx, hy - hr * .5], [hx + hr + 2 * hz, hy + hr * .2], [hx + hr + 1.8 * hz, hy + hr * .9], [hx + hr * .1, hy + hr * .9]], 'm2'); b.set(hx + hr + 1.6 * hz, hy + hr * .35, 'm0');
    const hl = 2.5 + s * 1.1, hb = [hx + hr * .2, hy - hr * .85], ht = [hb[0] + hl * .55, hb[1] - hl];
    b.line(hb[0], hb[1], ht[0], ht[1], s === 5 ? 'y' : 'b2'); b.line(hb[0] + 1, hb[1], ht[0] + .5, ht[1] + 1, s === 5 ? 'Y' : 'b1'); for (let i = 1; i < hl; i += 2) b.set(lerp(hb[0], ht[0], i / hl), lerp(hb[1], ht[1], i / hl), 'b0');
    ppPoly(b, [[hx - hr * .6, hy - hr * .6], [hx - hr * .1, hy - hr * .7], [hx - hr * .5, hy - hr - 1.5]], 'm1');
    ppEye(b, hx + hr * .1, hy - hr * .25, 2, s <= 1 ? 2 : 1, bl, s >= 3 ? 'e' : null); if (!bl) b.set(hx + hr * .1 - 1, hy - hr * .25 - 1, 'k');
    if (s <= 2) b.set(hx + hr * .4, hy + hr * .5, 'p');
    if (s >= 4 && f % 2) { b.set(ht[0] + 1, ht[1] - 1, 'h'); b.set(ht[0] + 2, ht[1], 'g'); }
    if (s === 5) ppCrown(b, hx - hr * .5, hy - hr - 1, 5);
  },
  schlange(b, s, f, mv, bl) {
    const bz = 1 + s * .18, hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, R = 3.4 * bz, r = 1.6 * bz, ph = f * Math.PI / 2;
    // Leib: eine Windung am Boden, dann aufgerichtet zum Kopf
    const ccx = cx - 2 * bz, ccy = gy - R - r * .6, pts = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI * .5 + i / 16 * Math.PI * 2 * .92; pts.push([ccx + Math.cos(a) * R * 1.35, ccy + Math.sin(a) * R * .75 + (mv ? Math.sin(a * 2 + ph) * .6 : 0)]); }
    const hx = cx + R * 1.2 + 1, hy = gy - R * 2.2 - 4 * bz;
    for (const q of ppQB(pts[pts.length - 1], [cx + R * 1.9, ccy - R * .2], [hx - 2 * hz, hy + 2 * hz], 8).slice(1)) pts.push(q);
    const tail = ppQB([ccx + R * .2, ccy + R * .75], [ccx - R * 1.6, gy - 1], [ccx - R * 2.2 - s * .5, gy - 3 - [0, 1, 0, -1][f]], 6).reverse();
    ppTube(b, tail.concat(pts.slice(1)), .7, r, 'm', 'a1');
    if (s >= 1) for (let i = 4; i < pts.length - 3; i += 2) { const [x, y] = pts[i], h = 1 + s * .45; ppPoly(b, [[x - 1, y - r * .6], [x - .5, y - r - h], [x + 1, y - r * .6]], i % 4 ? 'w1' : 'w2'); }
    if (s >= 4) for (let i = 2; i < pts.length - 2; i += 3) b.set(pts[i][0], pts[i][1] - r * .2, (i + f) % 2 ? 'g' : 'a2');
    const hr = 2.8 * hz; ppE(b, hx, hy, hr * 1.25, hr * .85, 'm', 4); ppE(b, hx + hr * .6, hy + hr * .3, hr * .85, hr * .5, 'm', 4);
    if (s >= 2) { b.line(hx - hr * .4, hy - hr * .6, hx - hr * 1.1, hy - hr * 1.4 - s * .3, 'b1'); b.line(hx + hr * .1, hy - hr * .75, hx - hr * .2, hy - hr * 1.6 - s * .4, 'b2'); }
    ppEye(b, hx + hr * .1, hy - hr * .4, 2, 2, bl, s >= 1 ? 'e' : null); if (!bl && s >= 1) b.set(hx + hr * .1 + 1, hy - hr * .4, 'k');
    if (s <= 1) b.set(hx - hr * .1, hy + hr * .35, 'p');
    if (!bl && (f === 1 || f === 2)) { const tx = hx + hr * 1.4, ty = hy + hr * .45; b.line(tx, ty, tx + 2, ty, 'r'); b.set(tx + 3, ty - 1, 'r'); b.set(tx + 3, ty + 1, 'r'); }
    if (s === 5) ppCrown(b, hx, hy - hr - 1.5, 5);
  },
  wal(b, s, f, mv, bl) {
    const bz = 1 + s * .17, cx = PET_CX, gy = PET_GY, rx = 6 * bz, ry = 3.3 * bz, bx = cx + 1, by = gy - 3 - ry - 1.5 * bz + (f === 2 ? -1 : 0), sw = [0, 1, 0, -1][f];
    const tp = ppQB([bx - rx * .7, by], [bx - rx * 1.25, by + ry * .2], [bx - rx * 1.6, by - ry * .3 + sw], 7); ppTube(b, tp, ry * .6, ry * .35, 'm', 'a1');
    const tt = tp[tp.length - 1], fs = 2.5 + s * .7; ppPoly(b, [[tt[0] + 1, tt[1]], [tt[0] - fs, tt[1] - fs - sw], [tt[0] - fs * .4, tt[1]], [tt[0] - fs, tt[1] + fs * .6 - sw * .5]], s >= 3 ? 'w1' : 'm1');
    ppE(b, bx, by, rx, ry, 'm', 4);
    ppE(b, bx + rx * .15, by + ry * .5, rx * .8, ry * .45, 'a', 3);
    for (let i = 0; i < 3; i++) b.line(bx - rx * .4 + i * .5, by + ry * (.45 + i * .17), bx + rx * .75, by + ry * (.4 + i * .17), 'a0');
    ppPoly(b, [[bx, by + ry * .4], [bx - 2 - s * .4, by + ry + 2 + s * .5 + sw * .5], [bx + 2, by + ry * .6]], s >= 3 ? 'w1' : 'm0');
    const ns = 3 + s * 2; for (let i = 0; i < ns; i++) { const x = bx - rx * .7 + (i * 37 % 17) / 17 * rx * 1.5, y = by - ry * .2 - (i * 23 % 11) / 11 * ry * .7; b.set(x, y, (i + f) % 3 ? 'b1' : 'b2'); if (s >= 3 && i % 3 === 0) { b.set(x - 1, y, 'b0'); b.set(x + 1, y, 'b0'); } }
    const ex = bx + rx * .62, ey = by + ry * .05; if (bl) b.line(ex - 1, ey, ex + 1, ey, 'k'); else { b.rect(ex - 1, ey - 1, 2, 2, 'k'); b.set(ex - 1, ey - 1, 'e'); }
    b.line(bx + rx * .5, by + ry * .35, bx + rx * .92, by + ry * .25, 'm0');
    if (s <= 1) b.set(ex - 1, ey + 2, 'p');
    if (s >= 2) for (let i = 0; i < 2 + (s >> 1); i++) { const k = (f + i) % 3, x = bx + rx * .3 + (i % 2 ? 1.5 : -1.5) * (1 + k * .5), y = by - ry - 1 - k * 2 - i; b.set(x, y, k ? 'b2' : 'g'); }
    if (s >= 4) for (let i = 0; i < 5; i++) { const a = -2.6 + i * .5 + f * .05; b.set(bx + Math.cos(a) * (rx + 2.5), by + Math.sin(a) * (ry + 3), (i + f) % 2 ? 'g' : 'w2'); }
    if (s === 5) ppCrown(b, bx + rx * .2, by - ry - 2, 7);
  }
});

/* ---------- Kreaturen 2.0: Baupläne für die neuen Arten (gleiche Regeln: nach rechts, Boden bei PET_GY, Stufe s, Bild f, mv läuft, bl blinzelt) ---------- */
// Vierbeiner. A: bw/bh Körper, leg/lw Beine, hd Kopf, sn Schnauze (0, 1, 2, 'pferd', 'schnabel', 'ruessel'), ear, horn, tail, back, pat, wing,
// heads (3 = Zerberus), neck, mane, hop (Hase), coat (Fellfarbe 'b' = Wolle), face ('schaedel', 'eule'), collar, tusk, fang, hat ('nemes'), belly, big
function ppQuad(b, s, f, mv, bl, A) {
  const bz = 1 + s * (A.gz || .17), hz = 1 + s * .1, cx = PET_CX, gy = PET_GY, fl = [0, 1, 2, 1][f], sw = [0, 1, 0, -1][f];
  const hop = A.hop && mv ? [0, -2, -3, -1][f] : 0, legH = (A.leg || 2.8) * bz, rx = (A.bw || 4.4) * bz, ry = (A.bh || 2.6) * bz;
  const bx = cx - 1.5 * bz, by = gy - legH - ry * .7 + hop, lg = mv && !A.hop ? [1.2, 0, -1.2, 0][f] : 0, lw = Math.max(2, Math.round((A.lw || 1.3) * bz)), ck = A.coat || 'm';
  const hr = (A.hd || 2.7) * hz, nk = A.neck ? 1 : 0, hx = bx + rx * .95 + nk * 1.6 * hz, hy = by - ry * (nk ? 1.05 : .85) - nk * 3 * hz, hk = A.foot === 'huf' ? 'b0' : 'm0';
  const wing = far => {
    const wx = bx + rx * .05, wy = by - ry * .7;
    if (A.wing === 'feder') ppFWing(b, wx, wy, rx * 1.15 + s * 1.3, fl, 'w', far, far ? null : 'w2');
    else if (A.wing === 'leder' || (A.wing === 'stummel' && s >= 3)) ppWing(b, wx, wy, A.wing === 'leder' ? [3.5, 5, 6.5, 8, 9.5, 11][s] : 2 + s, fl, 'w', 'm0', far);
    else if (A.wing) ppFWing(b, wx, wy, 2.4 + s * .7, fl, 'w', far);
  };
  if (A.wing) wing(true);
  // Schwanz
  const r0 = [bx - rx * .85, by - ry * .1];
  switch (A.tail) {
    case 'duenn': { const tp = ppQB(r0, [r0[0] - rx * .8, r0[1] + ry], [r0[0] - rx * 1.3 - s * .6, r0[1] - ry * (.5 + s * .1) + sw], 10 + s), k = A.tk || 'b'; for (const [x, y] of tp) { b.set(x, y, k + '1'); if (s >= 3) b.set(x, y + 1, k + '0'); } break; }
    case 'busch': { const tr = 2 * bz * (A.big || 1), tp = ppQB(r0, [r0[0] - rx * .9, r0[1] + ry * .4], [r0[0] - rx * (A.big ? .6 : 1.1) - s * .4, r0[1] - ry * (A.big ? 2.3 : 1.1) - s * .3 + sw], 9 + s); ppTube(b, tp, tr * .6, tr, 'm'); const tt = tp[tp.length - 1]; ppF(b, tt[0] + .5, tt[1] - tr * .4, tr * .55, tr * .55, 'm3'); break; }
    case 'stummel': ppF(b, r0[0] + .5, r0[1] - .5, 1.3 * bz, 1.2 * bz, 'b2'); b.set(r0[0] + .5, r0[1] + .5, 'b1'); break;
    case 'kurz': { const tp = ppQB(r0, [r0[0] - rx * .6, r0[1] + ry * .6], [r0[0] - rx * 1.3 - s * .5, gy - 1.5 - sw * .5], 8 + s); ppTube(b, tp, ry * .45, .7, 'm'); break; }
    case 'zacke': { const tp = ppQB(r0, [r0[0] - rx * .9, r0[1] + ry * .9], [r0[0] - rx * 1.6 - s * .6, r0[1] - ry * .3 + sw], 10 + s); ppTube(b, tp, ry * .5, .8, 'm'); for (let i = 2; i < tp.length - 1; i += 3) ppPoly(b, [[tp[i][0] - 1, tp[i][1] - ry * .25], [tp[i][0], tp[i][1] - ry * .25 - 1.5 - s * .3], [tp[i][0] + 1, tp[i][1] - ry * .25]], 'a1'); const tt = tp[tp.length - 1]; ppPoly(b, [[tt[0] + 1, tt[1]], [tt[0] - 2 - s * .3, tt[1] - 2 - s * .3], [tt[0] - 2.5 - s * .3, tt[1] + 1], [tt[0] - .5, tt[1] + 1.5]], 'a1'); break; }
    case 'schlange': { const tp = ppQB(r0, [r0[0] - rx * .9, r0[1] + ry * .8], [r0[0] - rx * 1.1 - s * .5, r0[1] - ry * (1.4 + s * .1) + sw], 9 + s); ppTube(b, tp, 1.1 * bz, .9 * bz, 'a'); const tt = tp[tp.length - 1]; ppE(b, tt[0] + .5, tt[1] - .5, 1.6 * bz, 1.2 * bz, 'a', 3); b.set(tt[0] + 1, tt[1] - 1, 'k'); if (f % 2) { b.set(tt[0] + 2.5 * bz, tt[1], 'r'); b.set(tt[0] + 2.5 * bz + 1, tt[1] - 1, 'r'); } break; }
    case 'flamme': { const n = 2 + (s >> 1); for (let i = 0; i < n; i++) { const tp = ppQB(r0, [r0[0] - rx * .6, r0[1] + ry * .2 * i], [r0[0] - rx * (1 + s * .08) - i, r0[1] - ry * (.8 + i * .3) + [0, 1, 0, -1][(f + i) % 4]], 8); for (const [x, y] of tp) b.set(x, y, 'm1'); const e = tp[tp.length - 1]; ppFlame(b, e[0], e[1] + 1, 2 + s * .5 + ((f + i) % 2), 1 + s * .15, 'a1', 'a2'); } break; }
    case 'pferd': { const n = 3 + (s >> 1); for (let i = 0; i < n; i++) { const tp = ppQB(r0, [r0[0] - rx * .6 - i * .4, r0[1] + ry * .1], [r0[0] - rx * (.8 + s * .06) - i * .6 + sw * .5, r0[1] + ry * (1.5 + i * .2)], 8), k = A.mane === 'flamme' ? (i % 2 ? 'a1' : 'a2') : ['a0', 'a1', 'a2'][i % 3]; for (const [x, y] of tp) { b.set(x, y, k); b.set(x - 1, y, k); } } break; }
  }
  // Beine (hinten), Körper, Muster, Rücken, Beine (vorn)
  const legs = near => {
    if (A.hop) { if (near) { ppE(b, bx - rx * .5, by + ry * .25, rx * .42, ry * .75, ck, ck === 'm' ? 4 : 3); b.rect(Math.round(bx - rx * .95), gy - 1 + hop, Math.round(rx * .8), 1, 'm0'); ppLeg(b, bx + rx * .5, by + ry * .4, gy + hop, Math.max(1, lw - 1), 'm1', 'm0'); } else ppLeg(b, bx + rx * .3, by + ry * .4, gy + hop, Math.max(1, lw - 1), 'm0', 'm0'); return; }
    for (const [x, o] of near ? [[bx - rx * .7, lg], [bx + rx * .35, -lg]] : [[bx - rx * .5, -lg], [bx + rx * .55, lg]]) ppLeg(b, x + o, near ? by + ry * .3 : by, gy, lw, near ? 'm1' : 'm0', hk);
  };
  legs(false);
  ppE(b, bx, by, rx, ry, ck, ck === 'm' ? 4 : 3);
  if (A.belly) ppE(b, bx + rx * .25, by + ry * .4, rx * .62, ry * .45, A.belly, 3);
  else if (ck === 'm' && A.pat !== 'federn') ppE(b, bx + rx * .55, by + ry * .25, rx * .38, ry * .55, 'b', 3);
  if (A.pat === 'flecken' || A.pat === 'gift') { const k = A.pk || (A.pat === 'gift' ? 'a1' : 'b2'); for (let i = 0; i < 4 + s; i++) ppF(b, bx - rx * .7 + petHash(i, 1, 3) * rx * 1.3, by - ry * .6 + petHash(i, 2, 3) * ry * .9, .6 + s * .1, .6 + s * .1, k); }
  if (A.pat === 'risse') for (let i = 0; i < 2 + (s >> 1); i++) { let x = bx - rx * .6 + i * rx * .55, y = by - ry * .5; for (let j = 0; j < 3; j++) { const nx = x + (j % 2 ? 1.5 : -.5), ny = y + 1.4 * bz; b.line(x, y, nx, ny, (f + i + j) % 3 ? 'a1' : 'a2'); x = nx; y = ny; } }
  if (A.pat === 'federn') { ppE(b, bx + rx * .45, by + ry * .1, rx * .45, ry * .7, 'a', 3); for (let i = 0; i < 4 + s; i++) { const x = bx + rx * (.25 + (i % 3) * .18), y = by - ry * .3 + Math.floor(i / 3) * 2 + (i % 3) * .5; b.set(x, y, 'a0'); } }
  switch (A.back) {
    case 'rippen': for (let i = 0; i < 3 + (s >> 1); i++) { const x = bx - rx * .45 + i * rx * .28; b.line(x, by - ry * .6, x - .5, by + ry * .35, 'm0'); b.line(x + 1, by - ry * .6, x + .5, by + ry * .3, 'm3'); } for (let i = 0; i < 5 + s; i++) b.set(bx - rx * .8 + i * rx * 1.5 / (5 + s), by - ry * .97, 'm3'); break;
    case 'maehne': { const n = 4 + s; for (let i = 0; i < n; i++) { const x = lerp(bx + rx * .15, bx + rx * 1.05, i / (n - 1)), y = by - ry * .7 - i * .45; ppPoly(b, [[x - 1.8, y + 2.5], [x - 1 - s * .25, y - 2 - s * .5], [x + 1.6, y + 2.5]], i % 2 ? 'a1' : 'a0'); } break; }
    case 'wolle': for (let i = 0; i < 7; i++) { const a = Math.PI * (1.05 + i / 6 * .95); ppF(b, bx + Math.cos(a) * rx * .9, by + Math.sin(a) * ry * .9, 1.2 * bz, 1.2 * bz, i % 2 ? 'b2' : 'b1'); } break;
    case 'zottel': for (let i = 0; i < 8 + s; i++) { const x = bx - rx * .9 + i * rx * 1.7 / (8 + s), y = by + ry * (.5 + (i % 2) * .15); b.line(x, y, x - .5, y + 1.5 + s * .3, i % 2 ? 'm1' : 'm0'); } for (let i = 0; i < 5; i++) b.set(bx - rx * .6 + i * rx * .3, by - ry * .8 + (i % 2), 'm3'); break;
    case 'zacken': for (let i = 0; i < 3 + s; i++) { const x = lerp(bx - rx * .8, bx + rx * .8, i / (2 + s)), y = by - ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - bx) / rx, 2))) + 1, h = 1.2 + s * .35; ppPoly(b, [[x - 1, y + 1], [x - .3, y - h], [x + 1.2, y + 1]], 'a1'); } break;
    case 'flammen': for (let i = 0; i < 4 + s; i++) { const x = lerp(bx - rx * .7, bx + rx * .95, i / (3 + s)), y = by - ry * Math.sqrt(Math.max(0, 1 - Math.pow((x - bx) / (rx * 1.05), 2))) + 1.5; ppFlame(b, x, y, 1.8 + s * .4 + ((i + f) % 2) * 1.2, 1 + s * .12, i % 2 ? 'a1' : 'a0', 'a2'); } break;
  }
  legs(true);
  // Hals, Mähne, Köpfe
  if (nk) ppTube(b, ppQB([bx + rx * .6, by - ry * .2], [bx + rx * .95, by - ry * .9], [hx - .5, hy + hr * .4], 5), 1.9 * bz, 1.4 * hz, 'm');
  if (A.mane) ppQB([hx - hr * .6, hy - hr * .5], [bx + rx * .85, by - ry * 1.15], [bx + rx * .3, by - ry * .65], 5 + s).forEach(([x, y], i) => { if (A.mane === 'flamme') ppFlame(b, x, y + 1, 2 + s * .4 + ((i + f) % 2), .9 + s * .1, i % 2 ? 'a1' : 'a0', 'a2'); else ppF(b, x - .5, y, .9 + s * .12, .9 + s * .12, ['a1', 'a2', 'a0'][i % 3]); });
  const ears = (x, y) => {
    switch (A.ear) {
      case 'spitz': case 'zipfel': for (const [dx, k] of [[-.55, 'm1'], [.2, 'm2']]) { const x0 = x + hr * dx, eh = 1.8 * hz + s * .3 + (A.ear === 'zipfel' ? .6 : 0); ppPoly(b, [[x0 - 1, y - hr * .4], [x0 + 1.6 * hz, y - hr * .5], [x0 + .2, y - hr - eh]], k); b.set(x0 + .2, y - hr * .7, 'p'); if (A.ear === 'zipfel') { b.set(x0 + .2, y - hr - eh - 1, 'm3'); b.set(x0 - .6, y - hr - eh, 'm3'); } } break;
      case 'rund': for (const [dx, k] of [[-.55, 'm1'], [.25, 'm2']]) { const ex = x + hr * dx, ey = y - hr * .8, er = (1.1 + s * .06) * hz; ppF(b, ex, ey, er, er, k); ppF(b, ex + .3, ey + .2, er * .5, er * .5, A.coat === 'b' ? 'p' : 'b1'); } break;
      case 'lang': for (const [dx, k, tl] of [[-.6, 'm1', -1.2], [.05, 'm2', -.4]]) { const L = 3.2 + s * .8, ex = x + hr * dx, ey = y - hr * .6; ppPoly(b, [[ex - 1, ey], [ex + tl - .8, ey - L * .6], [ex + tl, ey - L], [ex + tl + 1.2, ey - L * .7], [ex + 1.2, ey]], k); b.line(ex + .1, ey - 1, ex + tl + .2, ey - L * .75, 'p'); } break;
      case 'klein': for (const [dx, k] of [[-.5, 'm1'], [.3, 'm2']]) ppPoly(b, [[x + hr * dx - 1, y - hr * .6], [x + hr * dx + 1, y - hr * .7], [x + hr * dx - .5, y - hr - .8 - s * .2]], k); break;
      case 'feder': ppPoly(b, [[x - hr * .85, y - hr * .35], [x - hr * .3, y - hr * .78], [x - hr * .9 - 1 - s * .4, y - hr * .8 - 2 - s * .6]], 'm1'); ppPoly(b, [[x + hr * .25, y - hr * .78], [x + hr * .85, y - hr * .4], [x + hr * .75 + s * .3, y - hr * .85 - 2 - s * .5]], 'm1'); break;
    }
  };
  const head = (x, y) => {
    if (A.ear !== 'haenge') ears(x, y);
    ppE(b, x, y, hr, hr * .9, 'm', 4);
    if (A.ear === 'haenge') for (const dx of [-.75, .05]) ppE(b, x + hr * dx, y + hr * .1, 1 * hz, 1.9 * hz, 'm', 3);
    if (A.hat === 'nemes') { ppPoly(b, [[x - hr * .95, y - hr * .1], [x - hr * .35, y - hr * 1.05], [x + hr * .55, y - hr * .95], [x + hr * .45, y - hr * .25], [x - hr * .25, y + hr * .25], [x - hr * 1.3, y + hr * 1.7], [x - hr * 1.7, y + hr * 1.2]], 'a1'); for (let i = 0; i < 4; i++) b.line(x - hr * (.9 + i * .22), y - hr * (.1 - i * .45), x - hr * (.3 + i * .25), y - hr * (.85 - i * .45), 'b1'); }
    switch (A.sn) {
      case 1: ppE(b, x + hr * .72, y + hr * .3, hr * .55, hr * .42, A.snk || 'm', A.snk ? 3 : 4); b.set(x + hr * 1.22, y + hr * .12, 'k'); b.line(x + hr * .9, y + hr * .58, x + hr * 1.15, y + hr * .52, 'm0'); break;
      case 2: ppPoly(b, [[x + hr * .3, y - hr * .2], [x + hr + 2.6 * hz, y + hr * .2], [x + hr + 2.4 * hz, y + hr * .75], [x + hr * .2, y + hr * .85]], 'm2'); b.line(x + hr * .5, y + hr * .55, x + hr + 2.2 * hz, y + hr * .55, 'm0'); b.set(x + hr + 2.6 * hz, y + hr * .15, 'k'); break;
      case 'pferd': ppPoly(b, [[x, y - hr * .5], [x + hr + 2 * hz, y + hr * .2], [x + hr + 1.8 * hz, y + hr * .9], [x + hr * .1, y + hr * .9]], 'm2'); b.set(x + hr + 1.6 * hz, y + hr * .35, 'm0'); break;
      case 'schnabel': ppPoly(b, [[x + hr * .55, y - hr * .05], [x + hr + 1.6 * hz, y + hr * .25], [x + hr + 1.2 * hz, y + hr * .85], [x + hr * .5, y + hr * .55]], 'b1'); b.set(x + hr + 1.2 * hz, y + hr * .65, 'b0'); break;
      case 'ruessel': ppTube(b, ppQB([x + hr * .7, y + hr * .2], [x + hr * 1.6, y + hr * 1.2], [x + hr * 1.2 + sw * .5, y + hr * 2.3 + s * .2], 7), 1.4 * hz, .8 * hz, 'm'); break;
    }
    if (A.tusk) ppTube(b, ppQB([x + hr * .6, y + hr * .75], [x + hr * 1.8, y + hr * 1.5], [x + hr * 2.3 + s * .3, y + hr * .6], 6), .9 * hz, .5, 'b');
    if (A.fang) { b.set(x + hr * .95, y + hr * .8, 'h'); b.set(x + hr * .95, y + hr * 1, 'h'); }
    if (A.face === 'schaedel') { b.rect(x, y - hr * .45, 2, 2, 'k'); if (!bl) b.set(x + 1, y - hr * .45 + 1, 'e'); b.line(x + hr * .9, y + hr * .62, x + hr + 2 * hz, y + hr * .62, 'h'); for (let i = 0; i < 3; i++) b.set(x + hr * .9 + i * 1.6, y + hr * .78, 'k'); }
    else if (A.face === 'eule') { ppE(b, x + hr * .3, y + hr * .02, hr * .82, hr * .66, 'a', 3); for (const ex of [x + hr * .02, x + hr * .62]) { if (bl) { b.line(ex - 1, y, ex + 1, y, 'm1'); continue; } ppF(b, ex, y - .2, 1.2 + s * .1, 1.2 + s * .1, 'e'); b.set(ex, y, 'k'); b.set(ex - .7, y - .9, 'h'); } }
    else { ppEye(b, x + hr * .1, y - hr * .3, 2, s <= 1 ? 2 : 1, bl, A.eyeK || (s >= 3 ? 'e' : null)); if (s <= 1) b.set(x - hr * .35, y + hr * .35, 'p'); }
    if (A.horn === 'geweih' && s >= 1) for (const [dx, k] of [[-.35, 'b0'], [.1, 'b1']]) { const x0 = x + hr * dx, y0 = y - hr * .75, L = 1.5 + s * 1.1; b.line(x0, y0, x0 - L * .35, y0 - L, k); if (s >= 2) b.line(x0 - L * .15, y0 - L * .45, x0 + L * .35, y0 - L * .75, k); if (s >= 3) b.line(x0 - L * .3, y0 - L * .85, x0 - L * .8, y0 - L * 1.05, k); if (s >= 4) b.line(x0 - L * .25, y0 - L * .7, x0 + .2, y0 - L * 1.15, k); }
    if (A.horn === 'bock' && s >= 1) { const c0 = x - hr * .45, c1 = y - hr * .1, R0 = 1.2 + s * .4; for (let a = -1.2; a > -5.6; a -= .22) { const q = R0 * (1 - (-1.2 - a) / 8); ppF(b, c0 + Math.cos(a) * q, c1 + Math.sin(a) * q * .9, .6 + s * .08, .6 + s * .08, a > -3.2 ? 'b1' : 'b0'); } }
    if (A.horn === 'teufel') for (const [dx, k] of [[-.55, 'b0'], [.1, 'b1']]) { const x0 = x + hr * dx, y0 = y - hr * .7, L = 1.2 + s * .55; ppPoly(b, [[x0 - .8, y0 + .5], [x0 - .6 - L * .5, y0 - L], [x0 + .9, y0 + .3]], k); }
  };
  // Zerberus: Köpfe dahinter und davor, jeweils mit dunklem Rand, damit man sie auseinanderhält
  if (A.heads === 3) head(hx - hr * 1.25, hy - hr * 1.05);
  if (A.heads === 3) ppF(b, hx, hy, hr + 1, hr * .9 + 1, 'o');
  head(hx, hy);
  if (A.heads === 3) { ppF(b, hx + hr * .65, hy + hr * 1.2, hr + 1, hr * .9 + 1, 'o'); head(hx + hr * .65, hy + hr * 1.2); }
  if (A.collar) { const x0 = hx - hr * .95, y0 = hy + hr * .25; b.line(x0, y0, x0 + hr * .55, y0 + hr * .85, 'b1'); b.line(x0 + 1, y0, x0 + 1 + hr * .55, y0 + hr * .85, 'b0'); for (let i = 0; i < 3; i++) b.set(x0 - .5 + i * hr * .2, y0 - .5 + i * hr * .3, 'b2'); }
  if (A.wing) wing(false);
  if (s === 5) ppCrown(b, hx - hr * .2, hy - hr - 2.5 - (A.horn && A.horn !== 'teufel' ? 3 : 0), 5);
}
// Zweibeiner (klein, großer Kopf). A: bw/bh Körper, leg, hd Kopf, hx, body ('a' = Kleidung), belly, ear ('goblin', 'spitz', 'klein'), horn ('teufel', 'stier'), snout ('echse', 'schnabel'),
// tusk, hold ('messer', 'keule', 'speer', 'dreizack'), wing ('leder', 'feder', 'stein'), tail ('echse', 'teufel'), halo, robe, hair, fur, face, arm ('flosse', 'gross'), crest, crouch, hoof
function ppBiped(b, s, f, mv, bl, A) {
  const bz = 1 + s * .17, hz = 1 + s * .11, cx = PET_CX, gy = PET_GY, fl = [0, 1, 2, 1][f], sw = [0, 1, 0, -1][f], step = mv ? [1, 0, -1, 0][f] : 0, bob = mv ? [0, -1, 0, -1][f] : 0;
  const legH = (A.leg || 2) * bz * (A.crouch ? .55 : 1), rx = (A.bw || 2.7) * bz, ry = (A.bh || 2.9) * bz, bx = cx - .5, by = gy - legH - ry * .8 + bob;
  const hr = (A.hd || 3.3) * hz, hx = bx + (A.hx != null ? A.hx : .6) * bz, hy = by - ry * .7 - hr * .72, lw = Math.max(2, Math.round(1.3 * bz)), bk = A.body || (A.robe ? 'a' : 'm');
  const wing = far => { const wx = bx - rx * .55, wy = by - ry * .7; if (A.wing === 'feder') ppFWing(b, wx, wy, rx * 1.3 + s * 1.2, fl, 'w', far, far ? null : 'w2'); else if (A.wing) ppWing(b, wx, wy, [4.5, 5.5, 7, 8.5, 10, 11.5][s], fl, 'w', A.wing === 'stein' ? 'm3' : 'b0', far); };
  // Schwanz
  if (A.tail === 'echse') ppTube(b, ppQB([bx - rx * .5, by + ry * .4], [bx - rx * 1.6, gy - 1], [bx - rx * 2.3 - s * .5, gy - 2 + sw * .5], 8 + s), 1.3 * bz, .5, 'm');
  if (A.tail === 'teufel') { const tp = ppQB([bx - rx * .6, by + ry * .4], [bx - rx * 1.8, by + ry * .6], [bx - rx * 1.9 - s * .3, by - ry * .8 + sw], 9); for (const [x, y] of tp) b.set(x, y, 'm1'); const t = tp[tp.length - 1]; ppPoly(b, [[t[0], t[1] - 2 - s * .2], [t[0] + 1.6, t[1]], [t[0], t[1] + 1], [t[0] - 1.6, t[1]]], 'm1'); }
  if (A.wing) wing(true);
  const arm = near => {
    const sx = bx + (near ? rx * .45 : -rx * .3), sy = by - ry * .4, ex = sx + (near ? 1.4 : -1.2) * bz + (near ? -step : step) * .8, ey = by + ry * .4;
    if (A.arm === 'flosse') ppPoly(b, [[sx - 1, sy], [sx + 1, sy], [ex + (near ? 1.6 : -1.6), ey + 1]], near ? 'm1' : 'm0');
    else { ppTube(b, [[sx, sy], [lerp(sx, ex, .5), lerp(sy, ey, .5)], [ex, ey]], (A.arm === 'gross' ? 1.3 : .85) * bz, (A.arm === 'gross' ? 1.4 : .8) * bz, 'm'); ppF(b, ex, ey, (A.arm === 'gross' ? 1.4 : .9) * bz, (A.arm === 'gross' ? 1.4 : .9) * bz, near ? 'm2' : 'm1'); }
    return [ex, ey];
  };
  arm(false);
  // Beine
  for (const [o, k] of [[-rx * .45 + step, 'm0'], [rx * .2 - step, 'm1']]) { const x = Math.round(bx + o); b.rect(x, Math.round(by + ry * .5), lw, Math.max(1, Math.round(gy - by - ry * .5)), k); b.rect(x, gy - 1, lw + 1, 1, A.hoof ? 'b0' : A.pinguin ? 'a1' : 'm0'); }
  // Körper
  ppE(b, bx, by, rx, ry, bk, bk === 'm' ? 4 : 3);
  if (A.belly) ppE(b, bx + rx * .25, by + ry * .15, rx * .62, ry * .72, A.pinguin ? 'b' : 'a', 3);
  if (A.robe) { for (let i = 0; i < 3; i++) b.line(bx - rx * .5 + i * rx * .45, by - ry * .2, bx - rx * .6 + i * rx * .5, by + ry * .85, 'a0'); b.line(bx - rx * .9, by + ry * .8, bx + rx * .9, by + ry * .8, 'b1'); }
  if (A.body === 'a') { b.line(bx - rx * .8, by + ry * .1, bx + rx * .8, by + ry * .25, 'a0'); b.set(bx + rx * .2, by + ry * .17, 'y'); }
  if (A.fur) for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; ppF(b, bx + Math.cos(a) * rx * .95, by + Math.sin(a) * ry * .95, .9 * bz, .9 * bz, i % 2 ? 'm3' : 'm2'); }
  if (A.crest) for (let i = 0; i < 3 + (s >> 1); i++) { const x = bx - rx * .6 + i * 1.5, y = by - ry * .85 + i * .3; ppPoly(b, [[x - 1, y + 1], [x - .5, y - 1.5 - s * .3], [x + 1, y + 1]], 'a1'); }
  // Stangenwaffen hinter dem Kopf (die Hand kommt später davor)
  const px0 = bx + rx * .45 + 1.4 * bz - step * .8, py0 = by + ry * .4;
  if (A.hold === 'speer' || A.hold === 'dreizack') { b.line(px0, py0 + 3, px0 + 1, py0 - 7 - s, 'a0'); if (A.hold === 'speer') ppPoly(b, [[px0 + .2, py0 - 7 - s], [px0 + 1.2, py0 - 10 - s * 1.2], [px0 + 2, py0 - 7 - s]], 'b2'); else { b.line(px0 - .5, py0 - 7 - s, px0 + 2.5, py0 - 7 - s, 'b1'); for (const dx of [-.5, 1, 2.5]) b.line(px0 + dx, py0 - 7 - s, px0 + dx, py0 - 9.5 - s, 'b1'); } }
  // Kopf
  if (A.ear === 'goblin') { ppPoly(b, [[hx + hr * .3, hy - hr * .3], [hx + hr * .8, hy - hr * .6], [hx + hr * 1.5 + s * .3, hy - hr * 1.15 - s * .2]], 'm1'); }
  if (A.horn === 'stier') for (const [p0, p1, p2, k] of [[[hx - hr * .6, hy - hr * .5], [hx - hr * 1.6, hy - hr * .8], [hx - hr * 1.3, hy - hr * 1.7 - s * .3], 'b0'], [[hx + hr * .4, hy - hr * .65], [hx + hr * 1.3, hy - hr * 1.1], [hx + hr * .95, hy - hr * 1.9 - s * .3], 'b1']]) ppTube(b, ppQB(p0, p1, p2, 6), .9 * hz, .45, k === 'b0' ? 'b' : 'b');
  ppE(b, hx, hy, hr, hr * .92, 'm', 4);
  if (A.hair) ppPoly(b, [[hx - hr * .95, hy - hr * .05], [hx - hr * .7, hy - hr * .8], [hx, hy - hr * 1.02], [hx + hr * .75, hy - hr * .75], [hx + hr * .5, hy - hr * .4], [hx - hr * .2, hy - hr * .55], [hx - hr * .5, hy + hr * .2]], A.hair + '1');
  if (A.face) ppE(b, hx + hr * .35, hy + hr * .12, hr * .58, hr * .62, A.face, 3);
  if (A.ear === 'goblin') { ppPoly(b, [[hx - hr * .5, hy - hr * .35], [hx - hr * .8, hy + hr * .15], [hx - hr * 1.9 - s * .4, hy - hr * .65 - s * .2]], 'm2'); b.line(hx - hr * .8, hy - hr * .2, hx - hr * 1.5, hy - hr * .5, 'p'); }
  if (A.ear === 'spitz') for (const [dx, k] of [[-.55, 'm1'], [.25, 'm2']]) ppPoly(b, [[hx + hr * dx - 1, hy - hr * .5], [hx + hr * dx + 1.5, hy - hr * .6], [hx + hr * dx, hy - hr - 1.5 - s * .3]], k);
  if (A.ear === 'klein') for (const dx of [-.95, .95]) ppF(b, hx + hr * dx, hy - hr * .1, .9 * hz, 1.1 * hz, 'm2');
  if (A.horn === 'teufel') for (const [dx, k] of [[-.45, 'b0'], [.25, 'b1']]) { const x0 = hx + hr * dx, y0 = hy - hr * .75, L = 1.3 + s * .5; ppPoly(b, [[x0 - .9, y0 + .6], [x0 - .5 - L * .4, y0 - L], [x0 + .9, y0 + .4]], k); }
  let ex1 = hx + hr * .05, ex2 = hx + hr * .55, ey = hy - hr * .1;
  if (A.snout === 'echse') { ppE(b, hx + hr * .8, hy + hr * .28, hr * .75, hr * .45, 'm', 4); b.set(hx + hr * 1.4, hy + hr * .15, 'k'); b.line(hx + hr * .4, hy + hr * .55, hx + hr * 1.35, hy + hr * .5, 'm0'); ex2 = null; ex1 = hx + hr * .1; ey = hy - hr * .3; }
  if (A.snout === 'schnabel') { ppE(b, hx + hr * .32, hy + hr * .12, hr * .55, hr * .55, 'b', 3); ppPoly(b, [[hx + hr * .75, hy + hr * .05], [hx + hr + 1.6 + s * .25, hy + hr * .3], [hx + hr * .75, hy + hr * .5]], 'a1'); }
  if (ex2 != null) { ppEye(b, ex1, ey, 2, s <= 1 ? 3 : 2, bl, 'e'); ppEye(b, ex2, ey, 2, s <= 1 ? 3 : 2, bl, 'e'); if (A.tusk || A.horn === 'stier') b.line(ex1 - .5, ey - 1, ex2 + 2, ey - .2, 'm0'); } else ppEye(b, ex1, ey, 2, 2, bl, 'e');
  if (!A.snout) { b.line(hx + hr * .15, hy + hr * .5, hx + hr * .55, hy + hr * .55, 'k'); if (A.ear === 'goblin') b.set(hx + hr * .4, hy + hr * .62, 'h'); }
  if (A.tusk) { b.set(hx + hr * .1, hy + hr * .42, 'b2'); b.set(hx + hr * .65, hy + hr * .45, 'b2'); if (s >= 3) { b.set(hx + hr * .1, hy + hr * .28, 'b2'); b.set(hx + hr * .65, hy + hr * .3, 'b2'); } }
  if (s <= 1 && !A.snout) { b.set(hx - hr * .35, hy + hr * .3, 'p'); b.set(hx + hr * .95, hy + hr * .3, 'p'); }
  if (A.halo) ppRing(b, hx, hy - hr - 2 - s * .3, hr * .75, 1.1, f % 2 ? 'y' : 'Y');
  // Arm vorn und was er hält
  const [hx2, hy2] = arm(true);
  if (A.hold === 'messer') { b.line(hx2 + .5, hy2 - 1, hx2 + 1.5 + s * .3, hy2 - 3 - s * .5, 'b2'); b.line(hx2 + 1.2, hy2 - .8, hx2 + 2.2 + s * .3, hy2 - 2.6 - s * .5, 'b1'); b.set(hx2, hy2 + 1, 'a0'); }
  if (A.hold === 'keule') ppTube(b, ppQB([hx2, hy2 + 1], [hx2 + 1.5, hy2 - 2], [hx2 + 2.5 + s * .3, hy2 - 4.5 - s * .6], 5), .6 * bz, 1.3 * bz, 'a');
  if (A.wing) wing(false);
  if (s === 5) ppCrown(b, hx, hy - hr - (A.halo ? 4.5 : 2) - (A.horn === 'stier' ? 2 : 0), 5);
}
// Schleime und Dinge: Schleim (auch mit Kristallen), Kürbis, Pilz, Bombe, Truhe
function ppBlob(b, s, f, mv, bl, A) {
  const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, sq = mv ? [0, .12, 0, -.1][f] : [0, .04, .08, .04][f], sw = [0, 1, 0, -1][f];
  switch (A.k) {
    case 'schleim': {
      const rx = 4.4 * bz * (1 + sq), ry = 3.5 * bz * (1 - sq), bx = cx, by = gy - ry - .5;
      ppPoly(b, [[bx - rx * .6, by - ry * .1], [bx + rx * .05, by - ry * 1.15 - s * .3], [bx + rx * .55, by - ry * .1]], 'm1');
      ppE(b, bx, by + ry * .2, rx, ry * .85, 'm', 4); b.rect(Math.round(bx - rx * .9), gy - 1, Math.round(rx * 1.8), 1, 'm0');
      ppF(b, bx - rx * .5, by - ry * .2, .9 + s * .1, 1.3 + s * .15, 'a2'); b.set(bx - rx * .25, by - ry * .55, 'a1');
      if (A.crystal) for (const [dx, dy, h] of [[-.35, .25, 1], [.3, .45, .8], [-.05, -.7, 1.4], [.45, -.35, 1.1]].slice(0, 2 + (s >> 1))) { const x = bx + rx * dx, y = by + ry * dy, hh = (1.5 + s * .4) * h; ppPoly(b, [[x - 1.2, y + 1], [x - .3, y - hh], [x + .4, y - hh * .8], [x + 1.2, y + 1]], 'b1'); b.line(x - .3, y - hh + 1, x - .5, y, 'b2'); }
      if (s >= 2) for (const dx of [-.85, .8]) { b.set(bx + rx * dx, by + ry * .7 + f % 2, 'm1'); b.set(bx + rx * dx, by + ry * .9 + f % 2, 'm2'); }
      if (s >= 3 && !A.crystal) { ppF(b, bx - rx * .1, by + ry * .35, .9 + s * .2, .9 + s * .2, 'g'); b.set(bx - rx * .15, by + ry * .25, 'h'); }
      const ey = by + ry * .05; ppEye(b, bx + rx * .05, ey, 2, s <= 1 ? 3 : 2, bl, null); ppEye(b, bx + rx * .5, ey, 2, s <= 1 ? 3 : 2, bl, null);
      b.line(bx + rx * .2, ey + 3.5, bx + rx * .4, ey + 3.5, 'k'); if (s <= 1) { b.set(bx - rx * .15, ey + 2.5, 'p'); b.set(bx + rx * .75, ey + 2.5, 'p'); }
      if (s === 5) ppCrown(b, bx + rx * .05, by - ry * 1.15 - s * .3 - 1, 5);
      break;
    }
    case 'kuerbis': {
      const rx = 4.6 * bz * (1 + sq * .5), ry = 3.5 * bz * (1 - sq * .5), bx = cx, by = gy - ry - .5;
      for (const dx of [-.55, .55, 0]) ppE(b, bx + rx * dx, by, rx * (dx ? .5 : .55), ry * (dx ? .92 : 1), 'm', 4);
      for (const dx of [-.28, .28]) b.line(bx + rx * dx, by - ry * .85, bx + rx * dx, by + ry * .85, 'm0');
      b.rect(Math.round(bx - .5), Math.round(by - ry - 1.5 - s * .4), 2, Math.round(2.5 + s * .4), 'a0'); ppE(b, bx + 2 + s * .3, by - ry - .5, 1.6 + s * .2, .8 + s * .1, 'a', 3);
      if (s >= 2) for (let i = 0; i < 6 + s; i++) b.set(bx - 1 - i * .7, by - ry - 1 - Math.sin(i * 1.2) * 1.5, 'a1');
      // geschnitztes Gesicht: dunkle Löcher, innen glüht es
      const gl = bl ? 'k' : (s >= 4 && f % 2 ? 'g' : 'b1'), ey = by - ry * .2;
      for (const ex of [bx + rx * .02, bx + rx * .55]) { ppPoly(b, [[ex - 1.5, ey + 1.2], [ex, ey - 1.4 - s * .2], [ex + 1.5, ey + 1.2]], 'k'); if (!bl) b.set(ex, ey + .3, gl); }
      for (let x = bx - rx * .1; x < bx + rx * .82; x += 1) { b.set(x, by + ry * .35, 'k'); b.set(x, by + ry * .35 + 1, 'k'); if (Math.round(x) % 2) b.set(x, by + ry * .35 + (Math.round(x) % 4 === 1 ? 1 : 0), gl); }
      if (s === 5) ppCrown(b, bx, by - ry - 3, 5);
      break;
    }
    case 'pilz': {
      const hop = mv && f % 2 ? -1 : 0, sx = cx, sy = gy - 2.6 * bz + hop, crx = 5 * bz * (1 + sq * .4), cry = 2.8 * bz, cy = sy - 2.4 * bz - cry * .55;
      b.rect(Math.round(sx - 2 * bz), gy - 1, 2, 1, 'b0'); b.rect(Math.round(sx + 1 * bz), gy - 1, 2, 1, 'b0');
      ppE(b, sx, sy, 2.5 * bz, 2.6 * bz, 'b', 3);
      ppE(b, sx, cy, crx, cry, 'm', 4); b.line(sx - crx * .85, cy + cry * .55, sx + crx * .85, cy + cry * .55, 'b0');
      for (const [dx, dy, r] of [[-.5, -.2, 1], [.15, -.55, .8], [.55, -.05, .9], [-.1, .1, .6], [-.75, .25, .5]].slice(0, 3 + (s >> 1))) ppF(b, sx + crx * dx, cy + cry * dy, (.7 + s * .1) * r * bz, (.6 + s * .08) * r * bz, 'a2');
      const ey = sy - .5; ppEye(b, sx - .2, ey, 1, 2, bl, null); ppEye(b, sx + 1.8, ey, 1, 2, bl, null); b.set(sx + .8, ey + 2.5, 'k'); if (s <= 2) { b.set(sx - 1.5, ey + 1.5, 'p'); b.set(sx + 3, ey + 1.5, 'p'); }
      if (s >= 2) { ppE(b, sx - crx - 1.5, gy - 2.5, 1, 1.4, 'b', 3); ppE(b, sx - crx - 1.5, gy - 4.2, 1.8 + s * .2, 1.1, 'm', 4); }
      if (s >= 4) for (let i = 0; i < 3; i++) b.set(sx + (i - 1) * crx * .6, cy - cry - 1 - ((f + i) % 2) * 2, 'g');
      if (s === 5) ppCrown(b, sx, cy - cry - 1.5, 5);
      break;
    }
    case 'bombe': {
      const r = 3.8 * bz, bx = cx - .5, st = mv ? [1, 0, -1, 0][f] : 0, by = gy - 1.6 * bz - r;
      for (const [dx, o] of [[-.45, st], [.35, -st]]) ppE(b, bx + r * dx + o, gy - 1, 1.3 * bz, .9 * bz, 'b', 3);
      ppE(b, bx, by, r, r, 'm', 4); ppF(b, bx - r * .45, by - r * .45, r * .22, r * .3, 'm3');
      const cpx = bx + r * .35, cpy = by - r * .9; ppE(b, cpx, cpy, 1.4 * bz, 1 * bz, 'b', 3);
      const fu = ppQB([cpx + .5, cpy - 1], [cpx + 2 + s * .3, cpy - 2.5 - s * .3], [cpx + 3.5 + s * .5, cpy - 1.5 - s * .5 + sw * .5], 6); for (const [x, y] of fu) b.set(x, y, 'b0');
      const sp = fu[fu.length - 1]; b.set(sp[0], sp[1] - 1, f % 2 ? 'Y' : 'a2'); b.set(sp[0] + 1, sp[1], 'a1'); b.set(sp[0] - 1, sp[1], 'a1'); b.set(sp[0], sp[1] + 1, 'a1'); if (f % 2) { b.set(sp[0] + 1, sp[1] - 2, 'a2'); b.set(sp[0] - 1, sp[1] - 2, 'a1'); }
      const ey = by - r * .05;
      for (const ex of [bx + r * .05, bx + r * .55]) { if (bl) { b.line(ex - 1, ey + 1, ex + 1, ey + 1, 'k'); continue; } ppF(b, ex, ey, 1.2, 1.3, 'h'); b.set(ex + .3, ey + .3, 'k'); }
      b.line(bx - r * .2, ey - 2, bx + r * .25, ey - 1.2, 'k'); b.line(bx + r * .4, ey - 1.2, bx + r * .85, ey - 2, 'k');
      b.line(bx + r * .2, ey + 2.5, bx + r * .55, ey + 2.5, 'k');
      if (s >= 3) for (let i = 0; i < s; i++) b.set(bx - r * .7 + i * 1.5, by + r * .55, 'a0');
      if (s === 5) ppCrown(b, bx - r * .3, by - r - 1.5, 5);
      break;
    }
    case 'kiste': {
      const w = 5 * bz, h = 3.4 * bz, bx = cx, top = gy - 1 - h, a = mv ? [.2, .55, .3, .65][f] : [.12, .3, .45, .25][f], th = h * .55, Hx = bx - w, Hy = top;
      const R = (u, v) => [Hx + u * Math.cos(a) + v * Math.sin(a), Hy - u * Math.sin(a) + v * Math.cos(a)];
      ppPoly(b, [R(0, 0), R(2 * w, 0), [bx + w, top]], 'k');
      ppPoly(b, [[bx - w, top], [bx + w, top], [bx + w, gy - 1], [bx - w, gy - 1]], 'm1');
      b.line(bx - w, top, bx + w, top, 'm2'); for (const dy of [.35, .7]) b.line(bx - w, top + h * dy, bx + w, top + h * dy, 'm0');
      for (const dx of [-.6, .6]) { b.line(bx + w * dx, top, bx + w * dx, gy - 1, 'b1'); b.set(bx + w * dx, top + 1, 'b2'); }
      for (let x = bx - w * .75; x < bx + w * .95; x += 2) { b.set(x, top - 1, 'h'); b.set(x + .5, top - 2, 'h'); }
      ppPoly(b, [R(0, 0), R(2 * w, 0), R(2 * w, -th), R(0, -th)], 'm2'); { const [x0, y0] = R(0, -th), [x1, y1] = R(2 * w, -th); b.line(x0, y0, x1, y1, 'm3'); }
      for (const u of [.4, 1.6]) { const [x0, y0] = R(u * w, 0), [x1, y1] = R(u * w, -th); b.line(x0, y0, x1, y1, 'b1'); }
      for (let u = .3 * w; u < 1.9 * w; u += 2) { const [x, y] = R(u, 1); b.set(x, y, 'h'); }
      if (!bl) { const [ex, ey2] = R(1.35 * w, 2.2); b.set(ex, ey2, 'e'); b.set(ex + 2.5, ey2 - .5, 'e'); }
      if (f === 2 || (mv && f % 2)) { b.line(bx + w * .55, top, bx + w * 1.05, top + 2.5, 'a1'); b.set(bx + w * 1.1, top + 3, 'a2'); }
      const lk = [bx + w * .05, top + h * .2]; b.rect(lk[0] - 1, lk[1], 2, 2, 'y'); b.set(lk[0], lk[1] + 1, 'k');
      if (A.gold) { for (const dx of [-.6, .6]) b.set(bx + w * dx, top + h * .55, 'a1'); if (s >= 2) for (let i = 0; i < 2 + s; i++) b.set(bx - w * .8 + i * 1.7, gy - 1 - (i % 2), i % 2 ? 'Y' : 'y'); }
      if (s >= 3) b.line(bx - w, gy - 1, bx + w, gy - 1, 'b2');
      if (s === 5) ppCrown(b, bx, top - h - 2, 5);
      break;
    }
  }
}
// kleine feste Zufallszahl für Glitzer (gleich für jedes Bild einer Stufe)
function rnd0(i, f) { return petHash(i * 7 + 3, f + 11, 5); }
// Schwebende: Geist, Eisgeist, Seelenflamme, Qualle, Auge, Krake, Nautilus
function ppFloat(b, s, f, mv, bl, A) {
  const bz = 1 + s * .18, cx = PET_CX, gy = PET_GY, bobY = [0, -1, -1, 0][f];
  const tent = (x, y, L, ph, k, w) => { let px = x, py = y; for (let i = 1; i <= L; i++) { const nx = x + Math.sin(i * .7 + ph) * (1 + i * .12) * w, ny = y + i; b.line(px, py, nx, ny, i > L * .7 ? k + '0' : k + '1'); px = nx; py = ny; } };
  switch (A.k) {
    case 'geist': case 'eis': {
      const r = 3.6 * bz, bx = cx, by = gy - 4 - r - 2 * bz + bobY, sk = r * 1.4;
      if (A.k === 'eis') for (let i = 0; i < 2 + (s >> 1); i++) { const a = f * .4 + i * 2.4, x = bx + Math.cos(a) * (r + 3), y = by + Math.sin(a) * r * .5; ppPoly(b, [[x, y - 1.5], [x + 1, y], [x, y + 1.5], [x - 1, y]], 'b1'); }
      const hem = []; const n = 4 + (s >> 1); for (let i = 0; i <= n * 2; i++) { const t = i / (n * 2), x = bx + r - t * r * 2; hem.push([x, by + sk + ((i + f) % 2 ? 1.5 : 0) - (A.k === 'eis' ? t * 2 : 0)]); }
      ppPoly(b, [[bx - r, by], [bx + r, by], ...hem], 'm1');
      ppE(b, bx, by, r, r, 'm', 4); ppPoly(b, [[bx - r * .55, by], [bx + r * .85, by], [bx + r * .7, by + sk * .8], [bx - r * .3, by + sk * .8]], 'm2');
      const wv = [0, 1, 0, -1][f]; ppE(b, bx + r * .95, by + r * .45 + wv, 1.3 * bz, .9 * bz, 'm', 4); ppE(b, bx - r * .95, by + r * .5 - wv, 1.2 * bz, .8 * bz, 'm', 3);
      const ey = by - r * .1;
      if (bl) { b.line(bx - .5, ey + 1, bx + 1, ey + 1, 'k'); b.line(bx + r * .5, ey + 1, bx + r * .5 + 1.5, ey + 1, 'k'); } else { b.rect(bx - .5, ey - 1, 2, 3, 'k'); b.rect(bx + r * .5, ey - 1, 2, 3, 'k'); b.set(bx - .5, ey - 1, 'h'); b.set(bx + r * .5, ey - 1, 'h'); }
      ppF(b, bx + r * .35, by + r * .45, .8, 1 + (f % 2) * .3, 'k'); if (s <= 2) { b.set(bx - r * .45, by + r * .2, 'p'); b.set(bx + r * .95, by + r * .2, 'p'); }
      if (A.k === 'eis') for (let i = 0; i < 3 + (s >> 1); i++) { const x = bx - r * .7 + i * r * 1.4 / (2 + (s >> 1)), h = 1.5 + s * .45 + (i % 2) * 1.2; ppPoly(b, [[x - 1, by - r * .75], [x, by - r * .85 - h], [x + 1, by - r * .75]], i % 2 ? 'a2' : 'a1'); }
      if (A.k === 'geist' && s >= 3) for (let i = 0; i < 3; i++) b.set(bx - r - 1 - i * 1.5, by + r * .3 + ((f + i) % 2) * 2, i % 2 ? 'a1' : 'a2');
      if (s === 5) ppCrown(b, bx, by - r - (A.k === 'eis' ? 4.5 : 1.5), 5);
      break;
    }
    case 'flamme': {
      const r = 2.9 * bz, bx = cx, by = gy - 4 - r - 2 * bz + bobY, sw = [0, 1, 0, -1][f] * (1 + s * .2), tip = r * (1.6 + s * .15);
      for (let i = 0; i < 3 + (s >> 1); i++) { const t = i / 3; ppF(b, bx - r * (1.1 + t * 1.3) - (mv ? 1 : 0), by + r * (.4 + t * .25) + ((i + f) % 2), r * (.42 - t * .1), r * (.42 - t * .1), i % 2 ? 'w0' : 'a0'); }
      const fl = (k, sc) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; pts.push([bx + Math.cos(a) * r * 1.15 * sc, by + Math.sin(a) * r * 1.05 * sc]); } pts.push([bx - r * .85 * sc, by - r * .8 * sc], [bx - r * .25 * sc + sw * .4, by - r * 1.35 * sc], [bx + sw, by - r * .4 - tip * sc], [bx + r * .35 * sc + sw * .5, by - r * 1.2 * sc], [bx + r * .9 * sc, by - r * .6 * sc]); ppPoly(b, pts, k); };
      fl('w0', 1.12); fl('a1', 1); fl('a2', .7);
      ppE(b, bx + .3, by + r * .2, r * .75, r * .72, 'm', 4);
      const ey = by + r * .05; if (bl) { b.line(bx - 1, ey, bx, ey, 'k'); b.line(bx + 2, ey, bx + 3, ey, 'k'); } else { b.rect(bx - 1.2, ey - 1, 2, 2, 'k'); b.rect(bx + 1.8, ey - 1, 2, 2, 'k'); b.set(bx - .2, ey - 1, 'b2'); b.set(bx + 2.8, ey - 1, 'b2'); }
      for (let i = 0; i < 3; i++) b.set(bx - .5 + i * 1.3, ey + 2.5, i % 2 ? 'k' : 'b2');
      if (s >= 3) for (let k = 0; k < 2; k++) { const a = f * 1.57 + k * 3.14, x = bx + Math.cos(a) * (r + 3.5), y = by + Math.sin(a) * (r + 2) * .7; b.rect(x, y, 2, 2, 'b2'); b.set(x, y, 'h'); }
      if (s === 5) ppCrown(b, bx, by - r * 1.7, 5);
      break;
    }
    case 'qualle': {
      const rx = 4.2 * bz, ry = 3 * bz, L = Math.round(5 + s * 1.6), bx = cx, by = gy - 2 - L - ry * .1 + bobY, nt = 4 + (s >> 1);
      for (let i = 0; i < nt; i++) tent(bx - rx * .75 + i * rx * 1.5 / (nt - 1), by + ry * .2, L, f * 1.57 + i, i % 2 ? 'm' : 'a', .9);
      if (f % 2) for (let i = 0; i < 1 + (s >> 1); i++) b.set(bx - rx * .6 + rnd0(i, f) * rx * 1.2, by + ry * .2 + L * .5 + rnd0(i + 9, f) * L * .5, 'b2');
      const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; pts.push([bx + Math.cos(a) * rx, by + Math.sin(a) * ry * 1.25]); }
      ppPoly(b, pts.concat([[bx + rx, by + ry * .25], [bx - rx, by + ry * .25]]), 'm1'); ppE(b, bx - rx * .1, by - ry * .3, rx * .75, ry * .8, 'm', 4);
      for (let i = 0; i < 6; i++) ppF(b, bx - rx + i * rx * .4, by + ry * .3, .9, .7, i % 2 ? 'm2' : 'm1');
      for (let i = 0; i < 2 + s; i++) b.set(bx - rx * .55 + rnd0(i, 1) * rx * 1.1, by - ry * .9 + rnd0(i, 2) * ry, (i + f) % 3 ? 'a2' : 'g');
      ppEye(b, bx + rx * .05, by - ry * .1, 1, 2, bl, null); ppEye(b, bx + rx * .5, by - ry * .1, 1, 2, bl, null); b.set(bx + rx * .3, by + ry * .2, 'k');
      if (s === 5) ppCrown(b, bx - rx * .1, by - ry * 1.3, 5);
      break;
    }
    case 'auge': {
      const r = 3.4 * bz, L = Math.round(3 + s), bx = cx, by = gy - 3 - L - r + bobY;
      for (let i = 0; i < 3 + (s >> 1); i++) tent(bx - r * .7 + i * r * 1.4 / (2 + (s >> 1)), by + r * .8, L, f * 1.57 + i * 2, 'm', .8);
      if (s >= 2) for (let i = 0; i < 10 + s * 2; i++) { const a = i / (10 + s * 2) * 6.283 + f * .2, x = bx + Math.cos(a) * r * 1.9, y = by + Math.sin(a) * r * .55; if (Math.sin(a) > -.2) continue; b.set(x, y, i % 3 ? 'g' : 'a2'); }
      ppE(b, bx, by, r * 1.25, r * 1.15, 'm', 4);
      if (s >= 2) for (let i = 0; i < 10 + s * 2; i++) { const a = i / (10 + s * 2) * 6.283 + f * .2, x = bx + Math.cos(a) * r * 1.9, y = by + Math.sin(a) * r * .55; if (Math.sin(a) <= -.2) continue; b.set(x, y, i % 3 ? 'g' : 'a2'); }
      ppE(b, bx + r * .2, by - r * .05, r * .85, r * .8, 'b', 3);
      if (bl) { ppE(b, bx + r * .2, by - r * .05, r * .85, r * .8, 'm', 4); b.line(bx - r * .5, by + r * .1, bx + r * .9, by + r * .1, 'k'); }
      else { ppF(b, bx + r * .45, by, r * .45, r * .5, 'a1'); ppF(b, bx + r * .45, by, r * .3, r * .38, 'e'); b.line(bx + r * .45, by - r * .35, bx + r * .45, by + r * .35, 'k'); b.set(bx + r * .15, by - r * .35, 'h'); }
      if (s >= 4) for (const [dx, dy] of [[-1.5, -.9], [1.6, -1.1]]) { const x = bx + r * dx, y = by + r * dy + [0, 1, 0, -1][(f + (dx > 0 ? 2 : 0)) % 4]; ppF(b, x, y, 1.2, 1.2, 'b2'); b.set(x + .3, y, 'k'); }
      if (s === 5) ppCrown(b, bx, by - r * 1.15 - 1.5, 5);
      break;
    }
    case 'krake': {
      const r = 3.2 * bz, L = Math.round(4 + s * 1.2), bx = cx - .5, by = gy - 2 - L * .8 - r * 1.2 + bobY;
      for (let i = 0; i < 6; i++) { const x0 = bx - r * .85 + i * r * 1.7 / 5, dir = i < 3 ? -1 : 1, cu = [0, 1, 0, -1][(f + i) % 4]; const tp = ppQB([x0, by + r * .9], [x0 + dir * 1.5, by + r * .9 + L * .7], [x0 + dir * (3 + i % 2) + cu * .5, by + r * .9 + L * .55 - 1.5], 7); ppTube(b, tp, 1 * bz, .5, i % 2 ? 'm' : 'm'); for (let j = 2; j < tp.length; j += 2) b.set(tp[j][0], tp[j][1] + .8, 'a1'); }
      ppE(b, bx - r * .1, by - r * .25, r * .95, r * 1.3, 'm', 4);
      for (let i = 0; i < 3 + s; i++) ppF(b, bx - r * .5 + rnd0(i, 3) * r, by - r * .9 + rnd0(i, 4) * r * 1.1, .6, .6, 'a1');
      ppEye(b, bx - r * .1, by + r * .45, 2, 2, bl, 'e'); ppEye(b, bx + r * .55, by + r * .45, 2, 2, bl, 'e');
      if (s <= 1) b.set(bx + r * .3, by + r * .85, 'p');
      if (s === 5) ppCrown(b, bx - r * .1, by - r * 1.55 - 1, 5);
      break;
    }
    case 'nautilus': {
      const r = 3.6 * bz, bx = cx - 1, by = gy - 4 - r - 1.5 * bz + bobY;
      for (let i = 0; i < 4 + (s >> 1); i++) tent(bx + r * .9 + i * .9, by + r * .45, Math.round(3 + s * .7), f * 1.57 + i, 'b', .7);
      ppE(b, bx, by, r * 1.2, r * 1.15, 'm', 4);
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + .4; b.line(bx + Math.cos(a) * r * .35, by + Math.sin(a) * r * .35, bx + Math.cos(a) * r * 1.12, by + Math.sin(a) * r * 1.08, 'a1'); }
      ppSpiral(b, bx, by, r * .85, 1.5, 'a0'); ppF(b, bx - .5, by - .5, .9, .9, 'm3');
      ppE(b, bx + r * 1.05, by + r * .3, r * .5, r * .55, 'b', 3); ppPoly(b, [[bx + r * .7, by - r * .25], [bx + r * 1.5, by - r * .05], [bx + r * 1.3, by + r * .25]], 'a1');
      if (bl) b.line(bx + r * 1.05, by + r * .2, bx + r * 1.3, by + r * .2, 'k'); else { b.rect(bx + r * 1.05, by + r * .1, 2, 2, 'k'); b.set(bx + r * 1.05, by + r * .1, 'h'); }
      if (s === 5) ppCrown(b, bx, by - r * 1.15 - 1.5, 5);
      break;
    }
  }
}
// Krabbe: Panzer, Stielaugen, Scheren, Beine nach beiden Seiten
function ppKrabbe(b, s, f, mv, bl) {
  const bz = 1 + s * .19, cx = PET_CX, gy = PET_GY, sc = mv ? [1, 0, -1, 0][f] : 0, rx = 4.6 * bz, ry = 2.5 * bz, bx = cx - 1 + sc * .6, by = gy - 2.2 * bz - ry * .8;
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const x0 = bx + sd * rx * (.3 + i * .22), y0 = by + ry * .3, kx = x0 + sd * (2 + i * .5) * bz, ky = y0 - 1 - (mv && (i + f) % 2 ? 1 : 0), k = sd < 0 ? 'm0' : 'm1'; b.line(x0, y0, kx, ky, k); b.line(kx, ky, kx + sd * bz, gy - 1, k); }
  const claw = (x, y, sz, near) => { const op = [0, 1, 1.5, 1][f] * (near ? 1 : .6); ppTube(b, [[bx + rx * .55, by - ry * .1], [x - sz, y + sz * .5], [x, y]], .8 * bz, .9 * bz, 'm'); ppE(b, x, y, 1.9 * sz, 1.4 * sz, 'm', 4); ppPoly(b, [[x + sz * .8, y - .5], [x + 3 * sz, y - 1.4 * sz - op], [x + 2.2 * sz, y - .2]], near ? 'm2' : 'm1'); ppPoly(b, [[x + sz * .8, y + .5], [x + 2.7 * sz, y + .8 * sz + op * .5], [x + 2 * sz, y + .3]], near ? 'm1' : 'm0'); };
  claw(bx + rx * .7, by - ry * .85, bz * .7, false);
  ppE(b, bx, by, rx, ry, 'm', 4); b.line(bx - rx * .85, by + ry * .45, bx + rx * .85, by + ry * .45, 'm0');
  for (let i = 0; i < 3 + s; i++) b.set(bx - rx * .6 + rnd0(i, 7) * rx * 1.2, by - ry * .6 + rnd0(i, 8) * ry * .7, 'm3');
  if (s >= 2) for (let i = 0; i < 4; i++) ppPoly(b, [[bx - rx + i * .6, by - .5 + i], [bx - rx - 1.2 - s * .2, by - 1 + i * 1.2], [bx - rx + .4 + i * .6, by + .5 + i]], 'a1');
  for (const dx of [.15, .5]) { const ex = bx + rx * dx, ey = by - ry * .85; b.line(ex, ey, ex, ey - 2 - s * .3, 'm1'); const ty = ey - 2.5 - s * .3; if (bl) b.line(ex - 1, ty, ex + 1, ty, 'k'); else { ppF(b, ex, ty, 1.1, 1.1, 'h'); b.set(ex + .4, ty, 'k'); } }
  b.line(bx + rx * .2, by + ry * .1, bx + rx * .45, by + ry * .15, 'k'); if (s <= 1) b.set(bx + rx * .65, by, 'p');
  claw(bx + rx * 1.05, by - ry * .1, bz * (1 + s * .05), true);
  if (s === 5) ppCrown(b, bx, by - ry - 2.5, 5);
}
// Skorpion: Segmente, Scheren, Schwanz mit glühendem Stachel über dem Rücken
function ppSkorpion(b, s, f, mv, bl) {
  const bz = 1 + s * .18, cx = PET_CX, gy = PET_GY, sw = [0, 1, 0, -1][f], rx = 4.2 * bz, ry = 1.9 * bz, bx = cx - 1, by = gy - 1.6 * bz - ry;
  for (let i = 0; i < 4; i++) { const x = bx - rx * .65 + i * rx * .45, k = (i + f) % 2 && mv ? 1 : 0; b.line(x, by + ry * .4, x - 1.5 + k, gy - 1, 'm0'); b.line(x + 1, by + ry * .4, x + 2.5 - k, gy - 1, 'm1'); }
  const tp = ppQB([bx - rx * .85, by - ry * .2], [bx - rx * 2, by - ry * 3.2], [bx - rx * .3 + sw * .4, by - ry * (3.6 + s * .25)], 8);
  tp.forEach(([x, y], i) => { const r = (1.5 - i * .08) * bz; ppE(b, x, y, r, r, 'm', 4); if (i % 2) b.set(x - r * .3, y + r * .5, 'a1'); });
  const t = tp[tp.length - 1]; ppPoly(b, [[t[0] - 1, t[1] - 1], [t[0] + 2.5 + s * .3, t[1] + .5], [t[0] + 1.5, t[1] + 3 + s * .3], [t[0], t[1] + 1]], 'a1'); b.set(t[0] + 1.5, t[1] + 2.5 + s * .3, 'a2');
  for (let i = 0; i < 4; i++) { const x = bx - rx * .6 + i * rx * .42; ppE(b, x, by, rx * .3, ry, 'm', 4); b.line(x - rx * .28, by - ry * .7, x - rx * .28, by + ry * .6, (f + i) % 3 ? 'a0' : 'a1'); }
  const claw = (y, near) => { const op = [0, 1, 1.5, 1][f]; ppTube(b, [[bx + rx * .7, by], [bx + rx * 1.1, y], [bx + rx * 1.45, y - 1]], .7 * bz, .8 * bz, 'm'); const x = bx + rx * 1.5, sz = bz * .75; ppE(b, x, y - 1, 1.5 * sz, 1.1 * sz, 'm', 4); ppPoly(b, [[x + sz * .6, y - 1.5], [x + 2.6 * sz, y - 2.4 * sz - op], [x + 2 * sz, y - 1]], near ? 'm2' : 'm1'); ppPoly(b, [[x + sz * .6, y - .5], [x + 2.3 * sz, y + .5 * sz + op * .5], [x + 1.8 * sz, y - .8]], 'm1'); };
  claw(by - ry * 1.1, false);
  if (bl) b.line(bx + rx * .75, by - ry * .4, bx + rx * .9, by - ry * .4, 'k'); else { b.set(bx + rx * .75, by - ry * .45, 'e'); b.set(bx + rx * .9, by - ry * .55, 'e'); }
  claw(by + ry * .2, true);
  if (s === 5) ppCrown(b, bx, by - ry - 2, 5);
}
// Biene: gestreifter Pelzkörper, Stachel, Fühler, flatternde Flügel
function ppBiene(b, s, f, mv, bl) {
  const bz = 1 + s * .2, cx = PET_CX, gy = PET_GY, fl = [0, 1, 2, 1][f], bx = cx - 1, by = gy - 4 - 3 * bz - (fl === 2 ? 1 : 0), rx = 3.6 * bz, ry = 2.8 * bz;
  const wing = far => { const wx = bx + .5 + (far ? -1.2 : 0), wy = by - ry - [2, 1, 0][fl] * bz + (far ? -.5 : 0); ppE(b, wx, wy, 2.1 * bz, (1.5 - fl * .25) * bz, 'w', 3); b.line(wx - 1.5 * bz, wy + .5, wx + 1.5 * bz, wy - .5, 'w0'); };
  wing(true);
  ppPoly(b, [[bx - rx * .9, by - 1], [bx - rx - 2 - s * .3, by + .5], [bx - rx * .9, by + 1.5]], 'a0');
  ppE(b, bx - 1, by, rx, ry, 'm', 4);
  for (const dx of [-.55, -.1, .35]) b.line(bx - 1 + rx * dx, by - ry * .9, bx - 1 + rx * dx - .5, by + ry * .9, 'a0');
  ppF(b, bx - 1 - rx * .3, by - ry * .5, .9, .7, 'm3');
  for (let i = 0; i < 3; i++) { const x = bx + rx * .2 + i * 1.2; b.line(x, by + ry * .7, x - 1 + (f + i) % 2, by + ry + 1.5, 'a0'); }
  const hx = bx + rx * .85, hy = by - ry * .35, hr = 2 * (1 + s * .12);
  for (const [dx, k] of [[-.3, 'a0'], [.2, 'a1']]) { const x0 = hx + hr * dx, y0 = hy - hr * .8, tx = x0 + 1.5 + s * .2, ty = y0 - 2.5 - s * .4 + [0, 1, 0, -1][f] * .5; b.line(x0, y0, tx, ty, k); b.set(tx, ty, 'a0'); b.set(tx + 1, ty, 'a0'); }
  ppE(b, hx, hy, hr, hr * .95, 'a', 3);
  if (bl) b.line(hx, hy - .5, hx + 1.5, hy - .5, 'm2'); else { ppF(b, hx + .5, hy - .5, 1.1, 1.1, 'h'); b.set(hx + 1, hy - .3, 'k'); }
  b.set(hx + hr * .5, hy + hr * .5, 'm2'); if (s <= 1) b.set(hx - .5, hy + 1, 'p');
  wing(false);
  if (s >= 4) for (let i = 0; i < 2; i++) b.set(bx - rx - 2 - i * 2, by - 2 + ((f + i) % 2) * 3, 'y');
  if (s === 5) ppCrown(b, hx, hy - hr - 2, 5);
}
// Libelle: langer Hinterleib, große Augen, vier lange Flügel
function ppLibelle(b, s, f, mv, bl) {
  const bz = 1 + s * .18, cx = PET_CX, gy = PET_GY, fl = [0, 1, 2, 1][f], bx = cx + 2, by = gy - 6 - 2 * bz - (fl === 2 ? 1 : 0), L = 9 + s * 2.2;
  const wings = (far, k) => { for (const [dx, up] of [[0, 1], [-1.8 * bz, .85]]) { const wx = bx + dx + (far ? -.5 : 0), wy = by - 1, tl = (6 + s * 1.3) * up, a = [-2.55, -2.85, -3.15][fl] + (far ? .2 : 0) + (dx ? .3 : 0), tx = wx + Math.cos(a) * tl, ty = wy + Math.sin(a) * tl; ppPoly(b, [[wx, wy], [lerp(wx, tx, .5) + Math.cos(a + 1.57) * 1.4 * bz, lerp(wy, ty, .5) + Math.sin(a + 1.57) * 1.4 * bz], [tx, ty], [lerp(wx, tx, .5) - Math.cos(a + 1.57) * .8, lerp(wy, ty, .5) - Math.sin(a + 1.57) * .8]], k); if (!far) b.line(wx, wy, tx, ty, 'w0'); } };
  wings(true, 'w1');
  const ab = []; for (let i = 0; i <= 10; i++) { const t = i / 10; ab.push([bx - 1 - t * L, by + 1 + Math.sin(t * 2.4) * 1.5 + (t > .8 ? (t - .8) * 6 : 0)]); }
  ppTube(b, ab, 1.1 * bz, .6, 'm'); for (let i = 2; i < ab.length; i += 2) b.set(ab[i][0], ab[i][1], 'a0');
  ppE(b, bx + .5, by + .5, 1.8 * bz, 1.5 * bz, 'm', 4);
  const hx = bx + 2.5 * bz, hy = by - .3; ppE(b, hx, hy, 1.6 * bz, 1.5 * bz, 'a', 3);
  if (bl) b.line(hx, hy - .5, hx + 2, hy - .5, 'k'); else { ppF(b, hx + .6, hy - .4, 1.2 * bz, 1.2 * bz, 'e'); b.set(hx + .2, hy - 1, 'h'); }
  for (let i = 0; i < 3; i++) b.line(bx + i * .8, by + 1.5 * bz, bx + i * .8 + .5, by + 2.5 * bz + 1, 'a0');
  wings(false, 'w2');
  if (s >= 4 && f % 2) b.set(bx - L - 2, by - 1, 'b2');
  if (s === 5) ppCrown(b, hx, hy - 1.5 * bz - 2, 5);
}
// Würmer und Schlangen: Grubenwurm (Ringe, Rundmaul), Basilisk (Hahnenkopf), Seedrache (Wellen, Flossen)
function ppWurm(b, s, f, mv, bl, A) {
  const bz = 1 + s * .18, hz = 1 + s * .11, cx = PET_CX, gy = PET_GY, sw = [0, 1, 0, -1][f], ph = f * Math.PI / 2;
  if (A.k === 'seedrache') {
    const by = gy - 7 - 3 * bz + [0, -1, -1, 0][f], L = 18 + s * 2.6, pts = [];
    for (let i = 0; i <= 26; i++) { const t = i / 26; pts.push([cx - L * .62 + t * L, by + Math.sin(t * 7.5 - ph) * 2.1 * bz * (.4 + t * .6)]); }
    for (let i = 3; i < pts.length - 3; i += 2) { const [x, y] = pts[i], h = .8 + s * .3 + (i % 4 ? 0 : 1); ppPoly(b, [[x - 1, y - 1], [x - .5, y - 1.5 * bz - h], [x + 1.2, y - 1]], 'w1'); }
    ppTube(b, pts, .6, 1.8 * bz, 'm', 'a1');
    const [hx0, hy0] = pts[pts.length - 1], hr = 2.9 * hz, hx = hx0 + 1, hy = hy0 - hr * .45;
    ppPoly(b, [[hx - 1, hy + hr * .5], [hx - 3 - s * .3, hy + hr * 1.6 + sw * .5], [hx + 1, hy + hr * .7]], 'w1');
    for (const [dx, k] of [[-.7, 'b0'], [-.2, 'b1']]) b.line(hx + hr * dx, hy - hr * .6, hx + hr * dx - 2 - s * .4, hy - hr * 1.5 - s * .4, k);
    ppE(b, hx, hy, hr, hr * .85, 'm', 4); ppE(b, hx + hr * .9, hy + hr * .3, hr * .7, hr * .45, 'm', 4); b.set(hx + hr * 1.5, hy + hr * .15, 'k');
    b.line(hx + hr * .6, hy + hr * .6, hx + hr * 1.6, hy + hr * 1.4 + sw * .4, 'b1'); b.line(hx + hr * 1.6, hy + hr * 1.4 + sw * .4, hx + hr * 2.3, hy + hr * 1.1, 'b1');
    ppEye(b, hx + hr * .05, hy - hr * .35, 2, s <= 1 ? 2 : 1, bl, 'e');
    if (s === 5) ppCrown(b, hx, hy - hr - 2.5, 5);
    return;
  }
  if (A.k === 'basilisk') {
    const r = 1.6 * bz, L = 11 + s * 2.4, A2 = (mv ? 1.5 : .9) * bz, hr = 2.6 * hz, hx = cx + L * .38 + 2, hy = gy - 6 * bz - 2.5, pts = [];
    for (let i = 0; i <= 22; i++) { const t = i / 22; pts.push([cx - L * .62 + t * L * .95, gy - r - Math.sin(t * 7.5 + ph) * A2 * (.4 + t * .6) * (1 - t * .5)]); }
    const nb = pts[pts.length - 1]; for (const q of ppQB(nb, [nb[0] + 2.5 * bz, nb[1] - .5], [hx - hr * .7, hy + hr * .5], 7).slice(1)) pts.push(q);
    ppTube(b, pts, .7, r * 1.05, 'm', 'b1');
    const wp = pts[Math.floor(pts.length * .6)]; ppFWing(b, wp[0] - 1, wp[1] - r * .6, 4 + s * 1.1, [0, 1, 2, 1][f], 'w', true); ppFWing(b, wp[0], wp[1] - r * .5, 4 + s * 1.1, [0, 1, 2, 1][f], 'w', false);
    for (let i = 0; i < 3 + (s >> 1); i++) ppF(b, hx - hr * .6 + i * 1.3, hy - hr - .3 - (i % 2) * .6 - s * .2, .9 + s * .1, 1 + s * .15, 'a1');
    ppE(b, hx, hy, hr, hr * .95, 'm', 4);
    ppPoly(b, [[hx + hr * .7, hy - .8], [hx + hr + 1.8 + s * .2, hy + .3], [hx + hr * .7, hy + 1.2]], 'b1'); ppF(b, hx + hr * .6, hy + hr * .95, .8 + s * .12, 1.2 + s * .2, 'a1');
    ppEye(b, hx + hr * .1, hy - hr * .35, 2, s <= 1 ? 2 : 1, bl, 'e'); if (!bl && s >= 2) b.line(hx - .5, hy - hr * .65, hx + 2, hy - hr * .5, 'm0');
    if (s === 5) ppCrown(b, hx, hy - hr - 4, 5);
    return;
  }
  // Grubenwurm: Ringe aus dem Boden, vorn das Rundmaul
  const n = 6 + s, pts = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push([cx - 7 * bz + t * 12 * bz, gy - 1.2 * bz - Math.sin(t * Math.PI * .85) * 4 * bz - t * 1.5 * bz + (mv ? Math.sin(t * 6 + ph) * .9 : Math.sin(t * 3 + ph) * .3), (1.4 + t * .55) * bz]); }
  ppE(b, pts[0][0] - 1, gy - .5, 2.8 * bz, 1.3 * bz, 'w', 3);
  for (const [x, y, r] of pts) { ppE(b, x, y, r, r * .92, 'm', 4); b.line(x - r * .75, y - r * .6, x - r * .75, y + r * .6, 'm0'); }
  const [hx, hy, hr] = pts[n - 1];
  ppF(b, hx + hr * .55, hy + hr * .05, hr * .55, hr * .62, 'k');
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + f * .3; b.set(hx + hr * .55 + Math.cos(a) * hr * .5, hy + hr * .05 + Math.sin(a) * hr * .55, 'b2'); }
  if (s <= 2 && !bl) { b.set(hx - hr * .2, hy - hr * .6, 'k'); b.set(hx + hr * .2, hy - hr * .75, 'k'); }
  if (s >= 3) for (let i = 1; i < n - 1; i += 2) b.set(pts[i][0], pts[i][1] - pts[i][2] * .8, 'a1');
  if (s === 5) ppCrown(b, hx, hy - hr - 2, 5);
}
// Golemchen: Steinbrocken mit Moos, Fäusten und leuchtender Rune
function ppGolem(b, s, f, mv, bl) {
  const bz = 1 + s * .17, cx = PET_CX, gy = PET_GY, st = mv ? [0, -1, 0, -1][f] : 0, bx = cx - 1, by = gy - 2.4 * bz - 3.6 * bz + st, w = 3.8 * bz, h = 3.6 * bz;
  for (const [o, d] of [[-.5, st], [.3, -st]]) b.rect(Math.round(bx + w * o - 1), Math.round(by + h * .6), Math.round(2.2 * bz), Math.round(gy - by - h * .6) - d, 'm0');
  ppE(b, bx - w * .95, by + h * .45, 1.8 * bz, 2 * bz, 'm', 3);
  ppPoly(b, [[bx - w, by - h * .5], [bx - w * .6, by - h], [bx + w * .7, by - h * .95], [bx + w, by - h * .3], [bx + w * .9, by + h * .8], [bx - w * .85, by + h * .85]], 'm1');
  ppPoly(b, [[bx - w * .85, by - h * .45], [bx - w * .5, by - h * .85], [bx + w * .3, by - h * .8], [bx, by - h * .1], [bx - w * .7, by + h * .1]], 'm2');
  b.line(bx - w * .5, by - h * .85, bx + w * .3, by - h * .8, 'm3'); b.line(bx + w * .2, by + h * .1, bx + w * .55, by + h * .5, 'm0'); b.line(bx - w * .4, by + h * .3, bx - w * .1, by + h * .6, 'm0');
  const rk = bl ? 'b0' : (f % 2 ? 'b2' : 'b1'); b.line(bx - .5, by - h * .1, bx - .5, by + h * .45, rk); b.line(bx - 1.5, by + h * .05, bx + .5, by + h * .05, rk); b.line(bx - 1.5, by + h * .35, bx + .5, by + h * .25, rk);
  const hx = bx + w * .55, hy = by - h * 1.05, hr = 2.2 * (1 + s * .1);
  ppPoly(b, [[hx - hr, hy + hr * .6], [hx - hr * .8, hy - hr * .7], [hx + hr * .9, hy - hr * .8], [hx + hr * 1.1, hy + hr * .5]], 'm2'); b.line(hx - hr * .8, hy - hr * .7, hx + hr * .9, hy - hr * .8, 'm3');
  b.line(hx - hr * .5, hy - hr * .15, hx + hr * .9, hy - hr * .3, 'm0');
  for (const ex of [hx - hr * .2, hx + hr * .55]) { b.rect(ex, hy, 2, 2, 'k'); if (!bl) b.set(ex + 1, hy, 'e'); }
  for (let i = 0; i < 4 + s; i++) { const x = bx - w * .7 + i * w * 1.5 / (3 + s); b.set(x, by - h * (.85 + (i % 2) * .08) - 1, i % 2 ? 'a1' : 'a2'); }
  for (let i = 0; i < 3; i++) b.set(hx - hr * .6 + i * hr * .6, hy - hr * .9, i % 2 ? 'a2' : 'a1');
  ppE(b, bx + w * .95, by + h * .5 + st, 1.9 * bz, 2.1 * bz, 'm', 4);
  if (s >= 3) for (let k = 0; k < 2; k++) { const a = f * 1.57 + k * 3.14, x = bx + Math.cos(a) * (w + 4), y = by - h * .4 + Math.sin(a) * 2; b.rect(x, y, 2, 2, 'm2'); b.set(x, y, 'm3'); }
  if (s === 5) ppCrown(b, hx, hy - hr - 1.5, 5);
}
// Zuordnung Bauplan → Zeichenfunktion; Hybride aus alten Bildern bekommen eigene Zusätze
const PET_BP = { quad: ppQuad, biped: ppBiped, blob: ppBlob, float: ppFloat, wurm: ppWurm, krabbe: ppKrabbe, skorpion: ppSkorpion, biene: ppBiene, libelle: ppLibelle, golem: ppGolem };
Object.assign(PET_ART, {
  // Sonnendrache: Strahlenkranz hinter dem Kopf, dann der Drache in Sonnenfarben
  sonne(b, s, f, mv, bl) {
    const bz = 1 + s * .2, hz = 1 + s * .11, lift = [0, 1, 2, 1][f] === 2 ? -1 : 0, rx = 4.2 * bz, ry = 3.3 * bz, bx = PET_CX - 1.2 * bz, by = PET_GY - 2.2 * bz - ry + lift, hr = 4.2 * hz, hx = bx + rx * .95, hy = by - ry * .55 - hr * .5, n = 8 + s;
    for (let k = 0; k < n; k++) { const a = k / n * 6.283 + f * .08, L = hr * 1.5 + s * .7 + (k % 2) * 1.6; ppPoly(b, [[hx + Math.cos(a - .14) * hr * .9, hy + Math.sin(a - .14) * hr * .9], [hx + Math.cos(a) * L, hy + Math.sin(a) * L], [hx + Math.cos(a + .14) * hr * .9, hy + Math.sin(a + .14) * hr * .9]], k % 2 ? 'g' : 'a2'); }
    PET_ART.drache(b, s, f, mv, bl);
  },
  // Neunschwanz: zusätzliche Schweife mit Fuchsfeuer (bei Mythisch neun), dann der Fuchs
  neun(b, s, f, mv, bl) {
    const bz = 1 + s * .17, sw = [0, 1, 0, -1][f], rx = 4.4 * bz, ry = 2.5 * bz, bx = PET_CX - 1.5 * bz, by = PET_GY - 2.8 * bz - ry * .7, n = [1, 2, 3, 5, 7, 8][s], tr = 2.1 * bz;
    for (let i = 0; i < n; i++) { const q = n === 1 ? .5 : i / (n - 1), tp = ppQB([bx - rx * .8, by - ry * .1], [bx - rx * (1.1 + q * .5), by - ry * (1.4 + q * .4)], [bx - rx * (.8 + q * 1.3) - s * .4, by - ry * (2.6 - q * 1.6) + sw * (i % 2 ? 1 : -1)], 8 + s); ppTube(b, tp, tr * .5, tr * .85, 'm'); const tt = tp[tp.length - 1]; ppF(b, tt[0], tt[1], tr * .7, tr * .7, 'b2'); ppFlame(b, tt[0], tt[1] - tr * .5, 2 + s * .5 + (f + i) % 2, 1 + s * .15, 'a1', 'a2'); }
    PET_ART.fuchs(b, s, f, mv, bl);
  },
  // Donnerkröte: Blitzhörner und Zickzack auf dem Rücken
  donner(b, s, f, mv, bl) {
    PET_ART.kroete(b, s, f, mv, bl);
    const bz = 1 + s * .2, rx = 4.8 * bz, ry = 3 * bz, bx = PET_CX - .5, by = PET_GY - .6 * bz - ry, hop = mv && f % 2 ? -1 : 0;
    for (const dx of [.25, .7]) { const x = bx + rx * dx, y = by - ry * .95 + hop - 1.5 * bz, L = 2 + s * .6; b.line(x, y, x - 1, y - L * .5, 'a1'); b.line(x - 1, y - L * .5, x + 1, y - L * .8, 'a1'); b.line(x + 1, y - L * .8, x, y - L * 1.3, 'a2'); }
    for (let i = 0; i < 4 + s; i++) b.set(bx - rx * .6 + i * 1.6, by - ry * .35 + (i % 2 ? 1 : -1) + hop, 'a1');
    if (s >= 3 && f % 2) for (let i = 0; i < 2; i++) b.set(bx - rx - 1 + i * rx * 2.1, by - ry - 2 - i, 'a2');
  }
});
for (const sp in PET_SP) { const S = PET_SP[sp]; if (!S.art) continue; const [k, A] = S.art; PET_ART[sp] = PET_BP[k] ? ((b, s, f, mv, bl) => PET_BP[k](b, s, f, mv, bl, A)) : PET_ART[k]; }
/* ---------- Eier: jede Seltenheit sieht anders aus (Größe, Schale, Muster), Risse und Licht mit dem Fortschritt (cr 0–3) ---------- */
const EGG_PAL = [
  { m: ['#3e362e', '#625848', '#8a7e6a', '#aca28c'], a: ['#2e261e', '#4e4234', '#9a9078'], g: '#fff0c0' },
  { m: ['#a08e74', '#d0c2a4', '#ece2c8', '#fffaf0'], a: ['#5a3a20', '#8a6440', '#b08a5a'], g: '#fff0c0' },
  { m: ['#2e5a7a', '#4e8ab4', '#86c0e4', '#d0ecff'], a: ['#1a3e5e', '#2a5e8e', '#ffffff'], g: '#d0f4ff' },
  { m: ['#8a5a1a', '#c8982e', '#ecc858', '#fff4b0'], a: ['#7a2418', '#d04a2a', '#ffffff'], g: '#fff6c0' },
  { m: ['#2e1850', '#5a3290', '#8a5ac8', '#c8a8ff'], a: ['#ffd24a', '#e8d0ff', '#ffffff'], g: '#f0e0ff' },
  { m: ['#7a2410', '#c04a1a', '#ec8428', '#ffcc6a'], a: ['#ffd24a', '#fff0a0', '#ffffff'], g: '#fff0a0' },
  { m: ['#0e0820', '#24163e', '#40266e', '#6e44a8'], a: ['#ff4fd8', '#8ae8ff', '#ffffff'], g: '#ffd0f8' }
];
const EGG_W_PX = 20, EGG_H_PX = 24;
function eggPB(t, cr, el) {
  const b = PB(EGG_W_PX, EGG_H_PX), rx = 4.6 + t * .55, ry = 5.8 + t * .78, cx = 10, cy = EGG_H_PX - 1 - ry;
  // Eiform: oben schmaler; Schattierung wie ppE
  for (let y = 0; y < EGG_H_PX; y++) for (let x = 0; x < EGG_W_PX; x++) {
    const ny = (y + .5 - cy) / ry, w = rx * (ny < 0 ? 1 - Math.min(.3, -ny * .3) : 1), nx = (x + .5 - cx) / w, d = nx * nx + ny * ny; if (d > 1) continue;
    const l = (-nx * .5 - ny * .85) * .6 + (1 - d) * .35; b.set(x, y, 'm' + (l > .55 ? 3 : l > .16 ? 2 : l > -.3 ? 1 : 0));
  }
  const on = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (b.get(x, y)) b.set(x, y, k); }, top = cy - ry, R = mulberry(t * 97 + 5);
  switch (t) {
    case 0: for (let i = 0; i < 7; i++) { const x = Math.floor(cx - rx + R() * rx * 2), y = Math.floor(top + 2 + R() * ry * 1.7); on(x, y, 'a1'); if (i % 2) on(x + 1, y, 'a0'); } ppClear(b, cx + 2, top + 1); on(cx + 1, top + 2, 'a0'); break;
    case 1: for (const [dx, dy, s] of [[-2, 4, 2], [2, 7, 1], [-1, 10, 2], [3, 11, 1], [0, 2, 1], [-3, 8, 1]]) { on(cx + dx, top + dy, 'a1'); if (s > 1) { on(cx + dx + 1, top + dy, 'a1'); on(cx + dx, top + dy + 1, 'a0'); } } break;
    case 2: for (const fy of [.42, .66]) for (let x = 0; x < EGG_W_PX; x++) { const y = Math.round(top + ry * 2 * fy + Math.sin(x * 1.3) * .8); on(x, y, 'a1'); on(x, y + 1, 'a0'); } break;
    case 3: for (let x = 0; x < EGG_W_PX; x++) { const y = Math.round(cy + (x % 4 < 2 ? x % 2 : 1 - x % 2) * 1.5 - 1); on(x, y - 1, 'a2'); on(x, y, 'a1'); on(x, y + 1, 'a0'); } break;
    case 4: for (const [dx, y0, h] of [[-3, 5, 4], [0, 3, 6], [3, 6, 4]]) for (let i = 0; i < h; i++) on(cx + dx + (i % 3 === 1 ? 1 : 0), top + y0 + i * 1.4, 'a0'); for (const [dx, dy] of [[-1, 13], [2, 15], [-3, 16]]) on(cx + dx, top + dy, 'a1'); break;
    case 5: for (let i = 0; i < 6; i++) { const x = cx - rx + 1.5 + i * (rx * 2 - 3) / 5, h = 4 + (i % 2 ? 2 : 4) + R() * 2; for (let k = 0; k < h; k++) on(Math.round(x + Math.sin(k * .9 + i) * .8), Math.round(cy + ry - 1 - k), k > h - 3 ? 'a1' : 'a0'); } for (let i = 0; i < 4; i++) on(Math.floor(cx - 3 + R() * 6), Math.floor(top + 2 + R() * 4), 'a2'); break;
    case 6: for (let i = 0; i < 12; i++) { const x = Math.floor(cx - rx + R() * rx * 2), y = Math.floor(top + 1 + R() * ry * 1.9); on(x, y, ['a0', 'a1', 'a2'][i % 3]); } for (let x = 0; x < EGG_W_PX; x++) on(x, Math.round(cy - 1 + Math.sin(x * .7) * 1.6), 'm3'); break;
  }
  if (el) for (const [dx, dy] of [[-1, 1], [1, 2], [0, 4]]) on(cx + dx, cy + dy, 'e');
  // Risse von oben, ab cr 3 scheint Licht hindurch
  const crack = (pts, k) => { for (let i = 0; i < pts.length - 1; i++) b.line(cx + pts[i][0], top + pts[i][1], cx + pts[i + 1][0], top + pts[i + 1][1], k); };
  if (cr >= 1) crack([[-1, 1], [-2, 3], [0, 5], [-1, 7]], 'k');
  if (cr >= 2) { crack([[2, 2], [3, 4], [1, 6], [3, 8], [2, 10]], 'k'); crack([[-rx + 1, ry * .9], [-rx + 3, ry * .8], [-rx + 4, ry * 1.05]], 'k'); }
  if (cr >= 3) { crack([[-1, 7], [-3, 9], [-2, 12], [-4, 14]], 'k'); for (const [dx, dy] of [[-2, 3], [0, 5], [3, 4], [1, 6], [-2, 9], [3, 8]]) on(cx + dx, top + dy, 'g'); ppClear(b, cx, top); ppClear(b, cx + 1, top); ppClear(b, cx, top + 1); }
  pbOutline(b, 'o');
  return b;
}
// Kleines Ei für das Nest im Versteck (gleiche Farben, einfache Muster)
function eggMiniPB(t, cr) {
  const b = PB(12, 15), rx = 3 + t * .25, ry = 3.9 + t * .36, cx = 6, cy = 14 - ry;
  for (let y = 0; y < 15; y++) for (let x = 0; x < 12; x++) { const ny = (y + .5 - cy) / ry, w = rx * (ny < 0 ? 1 - Math.min(.3, -ny * .3) : 1), nx = (x + .5 - cx) / w, d = nx * nx + ny * ny; if (d > 1) continue; const l = (-nx * .5 - ny * .85) * .6 + (1 - d) * .35; b.set(x, y, 'm' + (l > .55 ? 3 : l > .16 ? 2 : l > -.3 ? 1 : 0)); }
  const on = (x, y, k) => { x = Math.round(x); y = Math.round(y); if (b.get(x, y)) b.set(x, y, k); }, top = Math.round(cy - ry);
  if (t === 2) for (let x = 0; x < 12; x++) on(x, cy + Math.sin(x) * .6, 'a1');
  else if (t === 3) for (let x = 0; x < 12; x++) on(x, cy - (x % 2), 'a1');
  else if (t === 5) for (let x = 0; x < 12; x += 2) { on(x, cy + ry - 2, 'a0'); on(x, cy + ry - 3, 'a1'); }
  else for (const [dx, dy] of [[-1, 3], [1, 5], [-2, 6], [2, 2]]) on(cx + dx, top + dy, t === 6 ? (dy % 2 ? 'a2' : 'a0') : t === 4 ? 'a0' : 'a1');
  if (cr >= 2) { b.line(cx - 1, top + 1, cx, top + 3, 'k'); b.line(cx, top + 3, cx - 1, top + 5, 'k'); }
  if (cr >= 3) { b.line(cx + 1, top + 2, cx + 2, top + 4, 'k'); on(cx - 1, top + 2, 'g'); on(cx + 1, top + 3, 'g'); }
  return pbOutline(b, 'o');
}
function eggPal(t, el) {
  const P0 = EGG_PAL[clamp(t | 0, 0, 6)], pal = { k: hexRgb('#1a1420'), o: hexRgb('#140f1a'), h: hexRgb('#ffffff'), g: hexRgb(P0.g), e: hexRgb(el && PET_EL[el] ? PET_EL[el].c : P0.g) };
  P0.m.forEach((c, i) => pal['m' + i] = hexRgb(c)); P0.a.forEach((c, i) => pal['a' + i] = hexRgb(c));
  return pal;
}
const EGG_CV = {};
function eggMini(t, cr) { const key = 'm' + t + ':' + cr; if (EGG_CV[key]) return EGG_CV[key]; const c = mk(12, 15); petPaint(c.getContext('2d'), eggMiniPB(t, cr), eggPal(t, null), 0, 0, 0, 0, 12, 15, 0, false); return EGG_CV[key] = c; }
function eggCanvas(t, cr, el) {
  const key = t + ':' + cr + ':' + (el || ''); if (EGG_CV[key]) return EGG_CV[key];
  const c = mk(EGG_W_PX, EGG_H_PX); petPaint(c.getContext('2d'), eggPB(t, cr, el), eggPal(t, el), 0, 0, 0, 0, EGG_W_PX, EGG_H_PX, 0, false);
  return EGG_CV[key] = c;
}

/* ---------- Bildstreifen: 0–3 Ruhe, 4–7 Bewegung, 8 Blinzeln ---------- */
const PET_STRIP = {}, PET_URLS = {};
function petPaint(g, b, pal, ox, oy, x0, y0, w, h, fi, shiny) {
  const d = g.createImageData(w, h), p = d.data, R = shiny ? mulberry(fi * 977 + 13) : null;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = b.get(x0 + x, y0 + y); if (!k) continue; let c = pal[k];
    if (shiny && (k[0] === 'm' || k[0] === 'w')) { const i = +k[1]; c = petHslRgb(260 + (x + x0) * 5 + (y + y0) * 3 + fi * 18, .5, [.36, .55, .72, .9][i]); }
    if (!c) c = pal.k; const o = (y * w + x) * 4; p[o] = c[0]; p[o + 1] = c[1]; p[o + 2] = c[2]; p[o + 3] = 255;
  }
  if (shiny) for (let i = 0; i < 3; i++) { const x = Math.floor(R() * w), y = Math.floor(R() * h), o = (y * w + x) * 4; if (p[o + 3]) { p[o] = p[o + 1] = p[o + 2] = 255; } }
  g.putImageData(d, ox, oy);
}
// one = nur das erste Bild (Sammlung, Symbole: viel schneller)
function petStrip(sp, s, col, shiny, mu, one) {
  col = shiny && col === 6 ? 6 : clamp(col | 0, 0, 5); mu = PET_MUT[mu] ? mu : ''; const key = sp + s + ':' + col + mu + (one ? '1' : ''); if (PET_STRIP[key]) return PET_STRIP[key];
  const fr = [], n = one ? 1 : 9;
  for (let i = 0; i < n; i++) { const b = PB(64, 64); PET_ART[sp](b, s, i % 4, i >= 4 && i < 8, i === 8); if (mu) petMutPB(b, mu, s, i % 4); if (s === 5) pbOutline(b, 'y'); pbOutline(b, 'o'); fr.push(b); }
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (const b of fr) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (b.a[y * 64 + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const W = x1 - x0 + 1, H = y1 - y0 + 1, pal = petPal(sp, col, mu), shine = col === 6;
  const c = mk(W * n, H); const g = c.getContext('2d');
  fr.forEach((b, i) => petPaint(g, b, pal, i * W, 0, x0, y0, W, H, i, shine));
  return PET_STRIP[key] = { c, W, H, ax: PET_CX - x0, ay: PET_GY - y0, sil: null };
}
function petStripOf(p) { return petStrip(p.sp, petStage(p.lv), p.col, p.shiny, p.mu); }
// Bild-URLs für Menüs: einzelnes Bild bzw. 4 Bilder Ruhe-Animation
function petImgURL(sp, s, col, shiny, anim, mu) {
  mu = PET_MUT[mu] ? mu : ''; const key = sp + s + ':' + (shiny && col === 6 ? 6 : col) + mu + (anim ? 'a' : 'i'); if (PET_URLS[key]) return PET_URLS[key];
  const S = petStrip(sp, s, col, shiny, mu, !anim);
  const c = mk(S.W * (anim ? 4 : 1), S.H, g => g.drawImage(S.c, 0, 0, S.W * (anim ? 4 : 1), S.H, 0, 0, S.W * (anim ? 4 : 1), S.H));
  return PET_URLS[key] = { url: c.toDataURL(), W: S.W, H: S.H };
}
function petURL(p, anim) { return petImgURL(p.sp, petStage(p.lv), p.col, p.shiny, anim, p.mu); }
function eggURL(t, cr, el) { const key = 'egg' + t + ':' + cr + ':' + (el || ''); return PET_URLS[key] || (PET_URLS[key] = eggCanvas(t, cr, el).toDataURL()); }
// Schwarze Umrisse für noch nicht entdeckte Arten (Sammlung)
function petSilURL(sp) { const key = 'sil' + sp; if (PET_URLS[key]) return PET_URLS[key]; const S = petStrip(sp, 0, 0, false, '', true); return PET_URLS[key] = mk(S.W, S.H, g => g.drawImage(silhouette(S.c, '#463c56'), 0, 0, S.W, S.H, 0, 0, S.W, S.H)).toDataURL(); }

/* ---------- Spielstand: Begleiter und Eier prüfen (alte und getauschte Daten) ---------- */
function petCols(p) { const r = []; for (let i = 0; i <= petStage(p.lv); i++) r.push((p.c0 + i) % 6); if (p.shiny) r.push(6); return r; }
function petFix(o, newId) {
  if (!o || typeof o !== 'object' || !PET_SP[o.sp]) return null;
  const n = v => (typeof v === 'number' && isFinite(v) ? v : +v || 0);
  const p = { id: !newId && typeof o.id === 'string' && o.id ? o.id.slice(0, 24) : uid(), sp: o.sp, nm: typeof o.nm === 'string' ? o.nm.replace(/[<>]/g, '').trim().slice(0, 16) : '', lv: clamp(Math.floor(n(o.lv)) || 1, 1, 100), xp: Math.max(0, Math.floor(n(o.xp))), c0: clamp(Math.floor(n(o.c0)), 0, 5), shiny: !!o.shiny, k: Math.max(0, Math.floor(n(o.k))), born: n(o.born) || Date.now() };
  p.xp = p.lv >= 100 ? 0 : Math.min(p.xp, petNeed(p.lv) - 1);
  const col = o.col == null ? (p.shiny ? 6 : p.c0) : Math.floor(n(o.col)); p.col = petCols(p).includes(col) ? col : p.shiny ? 6 : p.c0;
  if (o.nw) p.nw = 1;
  p.bag = (Array.isArray(o.bag) ? o.bag : []).map(petLootFix).filter(Boolean).slice(0, 12);
  const h = n(o.hurt); p.hurt = h > Date.now() ? Math.min(h, Date.now() + 48 * 3600e3) : 0; // Uhr verstellt: höchstens 2 Tage
  // Kreaturen 2.0: Gene (alte Begleiter: fest aus der Kennung), Mutation, Talente, Ausrüstung, Zauber, Zucht
  p.gn = petGenesFix(o.gn) || petGenesOf(p.id);
  if (PET_MUT[o.mu]) p.mu = o.mu;
  p.tl = petTlFix(o.tl, p.lv);
  p.eq = {}; if (o.eq && typeof o.eq === 'object') for (const s of PET_SLOTS) { const it = petGearFix(o.eq[s], s); if (it) p.eq[s] = it; }
  p.mg = (Array.isArray(o.mg) ? o.mg : []).slice(0, 3).map(k => PET_SPELL[k] ? k : null); while (p.mg.length < 3) p.mg.push(null);
  const zt = n(o.zt); if (zt > 0) p.zt = Math.min(zt, Date.now());
  if (Array.isArray(o.pa) && o.pa.length === 2 && o.pa.every(sp => PET_SP[sp])) p.pa = o.pa.slice();
  const ge = Math.floor(n(o.ge)); if (ge > 0) p.ge = Math.min(ge, 999);
  return p;
}
function petGenesFix(a) { return Array.isArray(a) && a.length === 5 && a.every(v => isFinite(+v)) ? a.map(v => clamp(Math.round(+v), 0, 100)) : null; }
// Talentränge prüfen: Ziffern, Höchstrang je Knoten, nicht mehr Punkte als das Level gibt (sonst von hinten kürzen)
function petTlFix(s, lv) {
  const r = []; s = typeof s === 'string' ? s : ''; for (let i = 0; i < PET_TALN; i++) r.push(clamp(+s[i] || 0, 0, PET_TAL[Math.floor(i / 5)].nodes[i % 5].max));
  let over = r.reduce((a, b) => a + b, 0) - petTalPts(lv); for (let i = PET_TALN - 1; i >= 0 && over > 0; i--) { const d = Math.min(r[i], over); r[i] -= d; over -= d; }
  return r.join('');
}
// Beute-Eintrag (gemeinsames Format aller Systeme) prüfen
function petLootFix(e) {
  if (!e || typeof e !== 'object') return null;
  const n = v => clamp(Math.floor(+v) || 0, 1, 1e7);
  switch (e.t) {
    case 'item': return e.it && typeof e.it === 'object' && e.it.slot ? { t: 'item', it: e.it } : null;
    case 'mat': return MATS[e.k] ? { t: 'mat', k: e.k, n: n(e.n) } : null;
    case 'gem': { const a = String(e.k).split(':'); return GEMS[a[0]] && +a[1] >= 0 && +a[1] <= 4 ? { t: 'gem', k: a[0] + ':' + (+a[1]), n: n(e.n) } : null; }
    case 'part': return typeof e.k === 'string' && e.k.length < 40 && /^[a-z]+(:[a-z]+)?:\d+$/.test(e.k) ? { t: 'part', k: e.k, n: n(e.n) } : null;
    case 'egg': { if (!e.d || !PET_SP[e.d.sp]) return null; const d = { egg: 1, sp: e.d.sp, tier: PET_SP[e.d.sp].t }, gn = petGenesFix(e.d.gn); if (gn) d.gn = gn; if (PET_MUT[e.d.mu]) d.mu = e.d.mu; return { t: 'egg', d }; }
    case 'gold': return { t: 'gold', n: n(e.n) };
    // Mods aus js/mods.js (Teil M): Schlüssel wie 'glyphe_kette:3'; ob es den Mod gibt, prüft mods.js beim Ausliefern
    case 'mod': return typeof e.k === 'string' && /^[a-z0-9_][a-z0-9_:.-]{0,39}$/i.test(e.k) && !/^(__proto__|constructor|prototype)$/.test(e.k) ? { t: 'mod', k: e.k, n: n(e.n) } : null;
  }
  return null;
}
/* Ei: { id, v: 2, sp, tier, got (Pflege-Sekunden), need, nest (liegt im Nest), w/f/z (Wärme, Futter, Zuwendung 0–1 zum Zeitpunkt t) }
   Alte Eier ({ sp, need, got } nach Siegen) behalten ihren Anteil am Fortschritt */
function eggFix(o) {
  if (!o || typeof o !== 'object' || !PET_SP[o.sp]) return null;
  const tier = PET_SP[o.sp].t, need = PET_TIERS[tier].care, now = Date.now(), n = v => (isFinite(+v) ? +v : 0);
  if (o.v !== 2) { const q = clamp(n(o.got) / Math.max(1, n(o.need) || EGG_NEED), 0, 1); return { id: uid(), v: 2, sp: o.sp, tier, got: Math.round(q * need), need, nest: 1, w: 0, f: 0, z: 0, t: now, born: now }; } // ins Nest, solange Platz ist (siehe meta)
  return eggExtra({ id: typeof o.id === 'string' && o.id ? o.id.slice(0, 24) : uid(), v: 2, sp: o.sp, tier, got: clamp(n(o.got), 0, need), need, nest: o.nest ? 1 : 0, w: clamp(n(o.w), 0, 1), f: clamp(n(o.f), 0, 1), z: clamp(n(o.z), 0, 1), t: Math.min(now, n(o.t) || now), born: n(o.born) || now }, o);
}
// Zucht-Ei: vererbte Gene, Mutation, Eltern, Generation, Farbe übernehmen (geprüft)
function eggExtra(g, o) {
  if (!o) return g; const gn = petGenesFix(o.gn); if (gn) g.gn = gn; if (PET_MUT[o.mu]) g.mu = o.mu;
  if (Array.isArray(o.pa) && o.pa.length === 2 && o.pa.every(sp => PET_SP[sp])) g.pa = o.pa.slice();
  const ge = Math.floor(+o.ge || 0); if (ge > 0) g.ge = Math.min(ge, 999); if (o.c0 != null && isFinite(+o.c0)) g.c0 = clamp(Math.floor(+o.c0), 0, 5);
  return g;
}
// intro: false = Gunda erklärt das Brutnest beim nächsten Blick auf die Weltkarte (nur nach dem ersten Ei vom Boss; alte Stände bekommen Hinweise beim Start)
// Sammel-Belohnungen: bei so vielen entdeckten Arten gibt es Glücksmünzen
const PET_CW = [[4, 2], [8, 3], [12, 5], [16, 8], [20, 12], [24, 25], [32, 15], [40, 20], [50, 30], [60, 40], [70, 60], [77, 100]];
function petCwLevel(n) { let l = 0; for (const [k] of PET_CW) if (n >= k) l++; return l; }
// Wirft hier etwas, würde loadAll einen leeren Spielstand anlegen – deshalb nie werfen, Rohdaten notfalls aufheben
HOOK.meta.push(m => {
  const d = m.pets && typeof m.pets === 'object' ? m.pets : {};
  try {
    const list = (Array.isArray(d.list) ? d.list : []).map(o => petFix(o)).filter(Boolean).slice(0, PET_MAX), ids = new Set();
    for (const p of list) { if (ids.has(p.id)) p.id = uid(); ids.add(p.id); }
    const eggs = (Array.isArray(d.eggs) ? d.eggs : []).map(g => eggFix(g)).filter(Boolean).slice(0, EGG_MAX);
    let nn = 0; for (const g of eggs) if (g.nest) { if (nn >= NEST_MAX) g.nest = 0; else nn++; }
    const seen = new Set((Array.isArray(d.seen) ? d.seen : []).filter(sp => typeof sp === 'string' && PET_SP[sp])); for (const p of list) seen.add(p.sp);
    const hatched = Math.max(0, Math.floor(+d.hatched) || 0);
    // Wer schon Begleiter, Eier oder Geschlüpfte hat, bekommt das garantierte erste Ei nicht noch einmal
    m.pets = { list, eggs, act: list.some(p => p.id === d.act) ? d.act : null, starter: !!d.starter, hatched, first: d.first != null ? !!d.first : (list.length > 0 || eggs.length > 0 || hatched > 0), intro: d.intro != null ? !!d.intro : true, fromBoss: !!d.fromBoss, seen: [...seen], cw: d.cw != null ? clamp(Math.floor(+d.cw) || 0, 0, PET_CW.length) : petCwLevel(seen.size) };
    // Kreaturen 2.0: Ausrüstungslager, Runen, entdeckte Mutationen, Zahl der Zuchten
    const M2 = m.pets, gi = new Set();
    M2.gear = (Array.isArray(d.gear) ? d.gear : []).map(o => petGearFix(o)).filter(it => it && !gi.has(it.id) && gi.add(it.id)).slice(0, PET_GEAR_MAX);
    M2.runes = {}; if (d.runes && typeof d.runes === 'object') for (const k of PET_SPELLS) { const v = Math.floor(+d.runes[k]) || 0; if (v > 0) M2.runes[k] = Math.min(v, 99); }
    const mut = new Set((Array.isArray(d.mut) ? d.mut : []).filter(k => PET_MUT[k])); for (const p of list) if (p.mu) mut.add(p.mu); M2.mut = [...mut];
    M2.bred = Math.max(0, Math.floor(+d.bred) || 0);
    if (d.bad) m.pets.bad = d.bad;
  } catch (e) { console.error('Begleiter (meta):', e); m.pets = { list: [], eggs: [], act: null, starter: !!d.starter, hatched: 0, first: true, intro: true, seen: [], cw: 0, gear: [], runes: {}, mut: [], bred: 0, bad: d }; }
});

/* ---------- Schnittstelle (Tausch, Basar, Verlorene Lande) ---------- */
// Echter, aktiver Held (auf dem Titel steht sonst nur ein Platzhalter)
function petHero() { return !!(P && SAVE && SAVE.active >= 0 && SAVE.chars[SAVE.active] && SAVE.chars[SAVE.active].id === P.id && P.mats); }
// Seltenheit eines neuen Eis: Glück 0 = Kampagne, 1–4 = Stufen der Verlorenen Lande (Kommazahlen gehen auch)
function eggTierRoll(luck, R) { const f = 1 + .35 * clamp(+luck || 0, 0, 10), W = {}; EGG_W.forEach((w, t) => { W[t] = w * Math.pow(f, t); }); return +wpick(W, R); }
// Zufällige Art einer Seltenheit (nur wilde Arten; R = fester Zufall, sonst Math.random)
function eggRoll(tier, R) { const L = PET_BYT[clamp(Math.floor(+tier) || 0, 0, PET_TIERS.length - 1)], r = R || Math.random; return L.length ? L[Math.floor(r() * L.length)] : PET_BYT[0][0]; }

/* ---------- Eier aus der Welt: Gebiet → Lebensräume → Art ----------
   PET_HABS: alle Lebensraum-Marken; jede Art hat S.hab. PET_BIOME[Gebiet] = [Marken] dürfen andere Systeme ergänzen (Welt W, Zusammenführung).
   Unbekannte Gebiete: Wortteile des Schlüssels (oder Namens) werden erkannt, sonst entscheidet die Tiefe. */
const PET_HABS = ['wiese', 'wald', 'pilz', 'sumpf', 'wasser', 'kueste', 'berg', 'hoehle', 'kerker', 'eis', 'wueste', 'feuer', 'asche', 'gruft', 'ruine', 'schatten', 'himmel', 'leere', 'kristall'];
const PET_BIOME = { wiese: ['wiese'], wald: ['wald', 'pilz'], fels: ['berg', 'hoehle'], ruine: ['ruine', 'gruft'], sumpf: ['sumpf', 'wasser'], schnee: ['eis'], asche: ['asche', 'feuer'], lava: ['feuer'], kerker: ['kerker', 'hoehle'], moss: ['sumpf', 'wald'], gruft: ['gruft', 'ruine'], glut: ['feuer', 'asche'], frost: ['eis'], schatten: ['schatten'], hort: ['feuer', 'berg', 'kristall'] };
const PET_BIOME_RX = [[/eis|frost|schnee|gletscher|tundra|polar|kalt|firn|reif/, 'eis'], [/wald|hain|forst|dschungel|urwald|baum|dickicht/, 'wald'], [/pilz|myzel|spor/, 'pilz'], [/sumpf|moor|morast|bruch|marsch|moos/, 'sumpf'], [/meer|see|fluss|ozean|wasser|lagune|tiefsee|korall/, 'wasser'], [/kuest|küst|strand|riff|bucht|watt/, 'kueste'], [/wueste|wüste|sand|duene|düne|oede|öde|steppe|savanne/, 'wueste'], [/vulkan|lava|glut|magma|feuer|brand|flamm/, 'feuer'], [/asche|russ|ruß|kohle|schlacke/, 'asche'], [/gruft|friedhof|grab|knochen|toten|gebein|nekro/, 'gruft'], [/ruine|tempel|stadt|burg|feste|kloster/, 'ruine'], [/hoehle|höhle|grotte|mine|stollen|tunnel|tiefen/, 'hoehle'], [/kerker|verlies|gefängnis/, 'kerker'], [/berg|fels|klipp|gebirg|hochland|gipfel|schlucht|canyon|stein/, 'berg'], [/kristall|edelstein|juwel|prism|glas/, 'kristall'], [/himmel|wolke|sturm|wind|luft|schwebe/, 'himmel'], [/leere|nichts|void|stern|astral|kosm|abgrund|riss|aether|äther/, 'leere'], [/schatten|nacht|dunkel|finster|zwielicht|nebel/, 'schatten'], [/wiese|feld|aue|tal|garten|blumen|heide|grasland|weide/, 'wiese']];
const PET_DEPTH_HAB = [[.12, ['wiese', 'wald']], [.3, ['wald', 'sumpf', 'berg', 'hoehle', 'wasser']], [.5, ['berg', 'eis', 'wueste', 'ruine', 'gruft', 'kueste']], [.72, ['feuer', 'asche', 'eis', 'schatten', 'kristall']], [1.01, ['leere', 'himmel', 'schatten', 'kristall']]];
function petBiomeTags(biome, depth) {
  const k = String(biome == null ? '' : biome).toLowerCase(), t = new Set(PET_BIOME[k] || []);
  const LB = typeof LANDE_BIOMES !== 'undefined' && LANDE_BIOMES && typeof LANDE_BIOMES === 'object' ? LANDE_BIOMES[biome] : null;
  if (LB && typeof LB === 'object') { for (const h of [].concat(LB.hab || LB.tags || [])) if (PET_HABS.includes(h)) t.add(h); }
  if (!t.size) { const txt = k + ' ' + (LB && typeof LB.n === 'string' ? LB.n.toLowerCase() : ''); for (const [rx, h] of PET_BIOME_RX) if (rx.test(txt)) t.add(h); }
  if (!t.size) { const d = clamp(+depth || 0, 0, 1); for (const [lim, hs] of PET_DEPTH_HAB) if (d < lim) { hs.forEach(h => t.add(h)); break; } }
  return [...t];
}
// Ei für die Endlosen Lande: Seltenheit nach Glück und Tiefe, Art meist aus dem Lebensraum des Gebiets → { egg: 1, sp, tier } (passt als d in { t: 'egg', d })
function eggForBiome(biome, depth, luck, R) {
  R = R || Math.random; depth = clamp(+depth || 0, 0, 1);
  const tier = eggTierRoll((+luck || 0) + depth * 3, R), tags = petBiomeTags(biome, depth);
  const fit = sp => (PET_SP[sp].hab || []).some(h => tags.includes(h));
  let pool = PET_BYT[tier].filter(fit);
  // keine passende Art dieser Seltenheit: eine Stufe darunter oder darüber suchen
  for (let d = 1; d <= 6 && !pool.length; d++) for (const t of [tier - d, tier + d]) if (!pool.length && t >= 0 && t < PET_TIERS.length) pool = PET_BYT[t].filter(fit);
  const sp = pool.length && R() < .8 ? pool[Math.floor(R() * pool.length)] : eggRoll(tier, R);
  return { egg: 1, sp, tier: PET_SP[sp].t };
}
// Sammlung: neue Art eintragen, Belohnungen auszahlen (nur mit echtem Helden, sonst später)
function petSeen(sp) { const M = petM(); if (!M || !PET_SP[sp]) return; if (!M.seen.includes(sp)) M.seen.push(sp); petCwPay(); }
function petCwPay() {
  const M = petM(); if (!M || !petHero()) return;
  const l = petCwLevel(M.seen.length);
  while ((M.cw || 0) < l) { const [n, c] = PET_CW[M.cw || 0]; M.cw = (M.cw || 0) + 1; gainFate(c); toast(_t('Sammlung: {n} Arten entdeckt! +{c} Glücksmünzen', { n, c }), '#ffd24a'); }
}
// Neuer Begleiter: o = { lv, xp, col, shiny, nm, nw, gn, mu, pa, ge } → Begleiter oder null (kein Platz). Ohne Gene: wilde Gene
function petGive(sp, o) {
  const M = petM(); o = o || {}; if (!M || !PET_SP[sp] || M.list.length >= PET_MAX) return null;
  const c0 = clamp((o.col | 0), 0, 5), p = petFix({ sp, nm: o.nm || '', lv: o.lv || 1, xp: o.xp || 0, c0, col: o.shiny ? 6 : c0, shiny: !!o.shiny, nw: o.nw, gn: o.gn || petGenesWild(), mu: o.mu, pa: o.pa, ge: o.ge }, true);
  M.list.push(p); if (!M.act) M.act = p.id; petSeen(sp); if (p.mu && !M.mut.includes(p.mu)) M.mut.push(p.mu); persist(); if (P && P.st) computeStats(); return p;
}
function eggNew(sp, o) { const t = PET_SP[sp].t, now = Date.now(); return eggExtra({ id: uid(), v: 2, sp, tier: t, got: 0, need: PET_TIERS[t].care, nest: nestEggs().length < NEST_MAX ? 1 : 0, w: 0, f: 0, z: 0, t: now, born: now }, o); }
// Neues Ei → das Ei (wahr) oder false (Korb voll). Ohne gültige Art: Seltenheit o.tier oder ausgewürfelt mit Glück o.luck
function eggGive(sp, quiet, o) {
  const M = petM(); if (!M) return false; o = o || {};
  if (!PET_SP[sp]) sp = eggRoll(o.tier != null ? o.tier : eggTierRoll(o.luck || 0));
  if (M.eggs.length >= EGG_MAX) { if (!quiet) toast(_t('Dein Brutnest ist voll – mehr als {n} Eier passen nicht hinein.', { n: EGG_MAX }), '#ff6a5a'); return false; }
  const g = eggNew(sp, o); M.eggs.push(g);
  // das allererste Ei, egal woher (Champion, Verlorene Lande, Tausch …): Gunda erklärt das Brutnest
  if (!M.first) { M.first = true; M.intro = false; }
  persist();
  if (!quiet) { toast(_t('{egg}! Pflege es im Brutnest, dann schlüpft es.', { egg: PET_TIERS[g.tier].egg }), PET_TIERS[g.tier].c); sfx('loot'); }
  return g;
}
// Daten eines Begleiters zum Verschicken; entfernt ihn (außer keep) → { sp, nm, lv, xp, col, c0, shiny, k, born } oder null
// Was noch im Beutel des Begleiters steckt, bekommt vorher der Absender (ohne Helden: kein Verschicken)
function petExport(i, keep) {
  const M = petM(), p = M && M.list[i]; if (!p) return null;
  if (!keep && p.bag && p.bag.length) { if (!petHero()) return null; petBagEmpty(p); }
  const d = { sp: p.sp, nm: p.nm, lv: p.lv, xp: p.xp, col: p.col, c0: p.c0, shiny: !!p.shiny, k: p.k || 0, born: p.born };
  // Kreaturen 2.0: Gene, Mutation, Talente, Ausrüstung und Zauber reisen mit (einfache Daten, passen in trPlain)
  d.gn = (p.gn || petGenesOf(p.id)).slice(); if (p.mu) d.mu = p.mu; d.tl = petTlFix(p.tl, p.lv); d.mg = (p.mg || []).slice(0, 3); if (p.zt) d.zt = p.zt; if (p.pa) d.pa = p.pa.slice(); if (p.ge) d.ge = p.ge;
  d.eq = {}; for (const s of PET_SLOTS) if (p.eq && p.eq[s]) d.eq[s] = JSON.parse(JSON.stringify(p.eq[s]));
  if (!keep) { M.list.splice(i, 1); if (M.act === p.id) M.act = M.list.length ? M.list[0].id : null; if (petView === p.id) petView = null; persist(); if (P && P.st) computeStats(); }
  return d;
}
function eggExport(i, keep) { const M = petM(), g = M && M.eggs[i]; if (!g) return null; const d = eggExtra({ egg: 1, sp: g.sp, tier: g.tier, need: g.need, got: Math.floor(g.got) }, g); if (!keep) { M.eggs.splice(i, 1); persist(); } return d; }
// Empfangen: Begleiter oder Ei ({ egg: 1, … }; die Pflege beginnt von vorn) → true/false (ungültig oder kein Platz)
function petImport(d) {
  const M = petM(); if (!M || !d || typeof d !== 'object') return false;
  if (d.egg) { if (!PET_SP[d.sp] || M.eggs.length >= EGG_MAX) return false; M.eggs.push(eggNew(d.sp, d)); persist(); return true; }
  const p = petFix(Object.assign({}, d, { nw: 1, bag: [], hurt: 0 }), true); if (!p || M.list.length >= PET_MAX) return false;
  M.list.push(p); if (!M.act) M.act = p.id; petSeen(p.sp); if (p.mu && !M.mut.includes(p.mu)) M.mut.push(p.mu); persist(); if (P && P.st) computeStats(); return true;
}
function petFree() { const M = petM(); return M ? PET_MAX - M.list.length : 0; }
function eggFree() { const M = petM(); return M ? EGG_MAX - M.eggs.length : 0; }
// Vorschau für Tausch, Basar und Beute: Text und Bild zu exportierten Daten (Eier verraten nur die Seltenheit)
function petLabel(d) { if (!d || !PET_SP[d.sp]) return ''; if (d.egg) return PET_TIERS[PET_SP[d.sp].t].egg + (d.pa ? ' · ' + _t('aus der Zucht') : ''); const lv = clamp(d.lv | 0 || 1, 1, 100); return _t('{name} · LV {lv} · {stage}', { name: d.nm ? String(d.nm).slice(0, 16) : PET_SP[d.sp].n, lv, stage: PET_STN[petStage(lv)] }) + (d.shiny ? ' ✦' : '') + (PET_MUT[d.mu] ? ' · ' + PET_MUT[d.mu].n : ''); }
function petIconURL(d) { if (!d || !PET_SP[d.sp]) return ''; if (d.egg) return eggURL(PET_SP[d.sp].t, 0); return petImgURL(d.sp, petStage(clamp(d.lv | 0 || 1, 1, 100)), d.col | 0, !!d.shiny, false, d.mu).url; }

/* ---------- Beutel des Begleiters (rettet Beute beim Tod in den Verlorenen Landen) ---------- */
function petBagAdd(p, e) { e = petLootFix(e); if (!p || !e || !Array.isArray(p.bag) || p.bag.length >= petBagSize(p)) return false; p.bag.push(e); persist(); return true; }
function petBagTake(p) { if (!p || !Array.isArray(p.bag)) return []; const r = p.bag; p.bag = []; persist(); return r; }
// Ein Beute-Eintrag geht an den Helden (Gegenstände: Beutel, sonst Lager, sonst verkauft)
function petLootGive(e) {
  if (!e || !petHero()) return;
  switch (e.t) {
    case 'item': { const S = SAVE.meta.hide.stash; if (P.bag.length >= 30 && typeof stashCap === 'function' && S.length < stashCap()) { hook('pickup', e.it); S.push(e.it); } else addToBag(e.it); break; }
    case 'mat': gainMat(e.k, e.n); break;
    case 'gem': P.gems[e.k] = (P.gems[e.k] || 0) + e.n; break;
    case 'part': if (!P.parts) P.parts = {}; P.parts[e.k] = (P.parts[e.k] || 0) + e.n; break;
    case 'egg': if (!e.d || !petImport(Object.assign({}, e.d, { egg: 1 }))) gainFate(1); break;
    case 'gold': P.gold += e.n; break;
    case 'mod': try { if (typeof modGive === 'function') { modGive(e.k, e.n); break; } } catch (_) { } if (!P.mods || typeof P.mods !== 'object') P.mods = {}; P.mods[e.k] = (P.mods[e.k] || 0) + e.n; break;
  }
}
function petBagEmpty(p) { const L = petBagTake(p); for (const e of L) petLootGive(e); if (L.length) saveChar(); return L.length; }
// Kurzer Name eines Beute-Eintrags
function petLootName(e) {
  switch (e.t) {
    case 'item': return typeof itemName === 'function' ? itemName(e.it) : '?';
    case 'mat': return e.n + '× ' + MATS[e.k].n;
    case 'gem': { const [g, gr] = e.k.split(':'); return (e.n > 1 ? e.n + '× ' : '') + _t('{grade} {gem}', { grade: GEMGRADE[+gr], gem: GEMS[g].n }); }
    case 'part': return (e.n > 1 ? e.n + '× ' : '') + (typeof pparse === 'function' ? (p => pname(p.t, p.g, p.el))(pparse(e.k)) : e.k);
    case 'egg': return PET_TIERS[PET_SP[e.d.sp].t].egg;
    case 'gold': return _t('{n} Gold', { n: fmt(e.n) });
    case 'mod': { let nm = e.k; try { if (typeof modName === 'function') nm = modName(e.k) || e.k; } catch (_) { } return (e.n > 1 ? e.n + '× ' : '') + nm; }
  }
  return '?';
}
function petLootIcon(e) {
  switch (e.t) {
    case 'item': return itemIconURL(e.it);
    case 'mat': return iconURL(['mat', e.k]);
    case 'gem': { const [g, gr] = e.k.split(':'); return iconURL(['gem', g, +gr]); }
    case 'part': { if (typeof pparse === 'function') { const p = pparse(e.k); return partIconURL(p.t, p.g, p.el); } return iconURL(['pa', 'truhe']); }
    case 'egg': return eggURL(PET_SP[e.d.sp].t, 0);
    case 'gold': return iconURL(['pa', 'muenze']);
    case 'mod': { try { if (typeof modIconURL === 'function') { const u = modIconURL(e.k); if (u) return u; } } catch (_) { } return iconURL(['pa', 'juwel']); }
  }
  return '';
}
/* ---------- Verletzung ---------- */
function petHurt(p, min) {
  if (!p || !PET_SP[p.sp]) return;
  p.hurt = Math.max(p.hurt || 0, Date.now() + clamp(+min || 60, 1, 24 * 60) * 60000 * petWundK(p));
  if (PET_RT.id === p.id) { PET_RT.id = null; PET_BOLTS = []; PET_FX = []; }
  persist(); if (P && P.st) computeStats();
}
function petHeal(p) { if (!p) return; p.hurt = 0; persist(); if (P && P.st) computeStats(); }
const PET_HEALMAT = ['schleim', 4];

/* ---------- Brutnest: Pflege in Echtzeit (aus Zeitstempeln, auch während das Spiel zu ist) ---------- */
const EGG_COZY = .7, EGG_BONUS = 1.5; // alle Bedürfnisse über 70 %: wächst 1,5× so schnell
function nestEggs() { const M = petM(); return M ? M.eggs.filter(g => g.nest) : []; }
function eggRates(g) { return PET_TIERS[g.tier].dur.map(h => 1 / (h * 3600)); }
// Wärme, Futter und Zuwendung sinken gleichmäßig; das Ei wächst nur, solange keins davon leer ist
function eggSim(g, now) {
  now = now || Date.now();
  const dt = (now - (g.t || now)) / 1000; g.t = now;
  if (!(dt > 0) || !g.nest) return;
  const r = eggRates(g), v = [g.w, g.f, g.z];
  const tE = Math.min(...v.map((x, i) => x / r[i])), tC = Math.min(...v.map((x, i) => Math.max(0, x - EGG_COZY) / r[i]));
  if (g.got < g.need) g.got = Math.min(g.need, g.got + Math.min(dt, tE) + (EGG_BONUS - 1) * Math.min(dt, tC));
  g.w = Math.max(0, g.w - r[0] * dt); g.f = Math.max(0, g.f - r[1] * dt); g.z = Math.max(0, g.z - r[2] * dt);
}
// Zustand zum Anzeigen: Fortschritt, wächst?, Bedürfnisse, wann leer (ms), wann fertig ohne weitere Pflege (ms oder null)
function eggView(g, now) {
  eggSim(g, now);
  const r = eggRates(g), v = [g.w, g.f, g.z], ready = g.got >= g.need, empty = v.map(x => x <= 0), grow = !ready && !!g.nest && !empty.some(Boolean);
  const left = v.map((x, i) => x / r[i] * 1000), tE = Math.min(...left) / 1000, tC = Math.min(...v.map((x, i) => Math.max(0, x - EGG_COZY) / r[i])), rest = g.need - g.got;
  let eta = null;
  if (grow) { if (rest <= tC * EGG_BONUS) eta = rest / EGG_BONUS; else if (rest - tC * EGG_BONUS <= tE - tC) eta = tC + rest - tC * EGG_BONUS; }
  return { q: g.got / g.need, ready, grow, cozy: grow && tC > 0, v, empty, left, until: tE * 1000, rest, eta: eta == null ? null : eta * 1000 };
}
// Was das Nest braucht: bereite Eier, pausierte Eier, nächster Zeitpunkt, an dem eins pausiert
function nestAlert() {
  let ready = 0, need = 0, next = Infinity;
  for (const g of nestEggs()) { const V = eggView(g); if (V.ready) ready++; else if (!V.grow) need++; else next = Math.min(next, V.until); }
  return { ready, need, next };
}
// Futter: erste bezahlbare Wahl der Seltenheit (sonst die erste zum Anzeigen)
function eggFood(g) {
  const L = PET_TIERS[g.tier].food;
  if (petHero()) for (const [k, n] of L) if (k === 'gold' ? P.gold >= n : (P.mats[k] || 0) >= n) return { k, n, ok: true };
  return { k: L[0][0], n: L[0][1], ok: false };
}
function eggWarm(g) { eggSim(g); g.w = 1; }
function eggFeed(g) { eggSim(g); const F = eggFood(g); if (!F.ok) return false; if (F.k === 'gold') P.gold -= F.n; else P.mats[F.k] -= F.n; g.f = 1; return true; }
function eggPet(g) { eggSim(g); g.z = Math.min(1, g.z + .34); }

/* ---------- Wachsen: EP, Level, Entwicklung, Schlüpfen ---------- */
const PET_UNLOCK = [null, _t('Beutemagnet'), _t('Passive Kraft'), _t('Spezialangriff'), _t('Uralte Kraft'), _t('Mythische Kraft')];
function petXP(p, v, quiet) {
  if (!p || p.lv >= 100 || !(v > 0)) return 0;
  const s0 = petStage(p.lv), l0 = p.lv; p.xp += Math.round(v);
  while (p.lv < 100 && p.xp >= petNeed(p.lv)) { p.xp -= petNeed(p.lv); p.lv++; }
  if (p.lv >= 100) p.xp = 0;
  if (p.lv === l0) return 0;
  const s1 = petStage(p.lv), here = petActive() === p && PET_RT.id === p.id && state === 'play';
  if (petActive() === p && P && P.st) computeStats();
  if (s1 > s0) {
    const t = _t('{name} ENTWICKELT SICH!', { name: petName(p).toLocaleUpperCase(LOCALE) }), sub = _t('{stage} · LV {lv} · Neu: {what} und eine neue Farbe', { stage: PET_STN[s1], lv: p.lv, what: PET_UNLOCK[s1] });
    if (state === 'play') banner(t, sub); else toast(t + ' ' + sub, '#ffd24a');
    sfx('myth');
    if (here) { PET_RT.fl = 1.2; rings.push({ x: PET_RT.x, y: PET_RT.y, r: 4, max: 60, life: .7, max2: .7, col: '#ffd24a' }); burst(PET_RT.x, PET_RT.y, PET_RT.z + 8, '#ffd24a', 30, 90, 1); burst(PET_RT.x, PET_RT.y, PET_RT.z + 8, PET_EL[PET_SP[p.sp].el].c, 20, 70, 1); }
  } else {
    if (here) { PET_RT.fl = .35; txt(PET_RT.x, PET_RT.y - 20 - PET_RT.z, _t('LV {lv}', { lv: p.lv }), '#ffd24a', true); rings.push({ x: PET_RT.x, y: PET_RT.y, r: 3, max: 26, life: .4, max2: .4, col: '#ffd24a' }); }
    else if (!quiet) toast(_t('{name} erreicht LV {lv}!', { name: petName(p), lv: p.lv }), '#ffd24a');
    petSnd('chirp');
  }
  return p.lv - l0;
}
// Schlüpfen (nach der Pflege im Brutnest) → neuer Begleiter oder null
function eggHatch(i, quiet) {
  const M = petM(), g = M && M.eggs[i]; if (!g) return null; eggSim(g);
  if (g.got < g.need || M.list.length >= PET_MAX) return null;
  M.eggs.splice(i, 1);
  // Zucht-Eier bringen Gene, Mutation und Farbe mit; wilde Eier: wilde Gene, 1 % Mutation
  const shiny = Math.random() < .01, c0 = g.c0 != null ? g.c0 : ri(0, 5), mu = g.mu || (!g.pa && Math.random() < .01 ? petMutRoll(Math.random) : null);
  const p = petGive(g.sp, { col: c0, shiny, nw: 1, gn: g.gn, mu, pa: g.pa, ge: g.ge }); M.hatched++;
  if (!quiet) toast(_t('Geschlüpft: {what}', { what: shiny ? _t('Ein schillernder {name}! (1 zu 100)', { name: PET_SP[p.sp].n }) : PET_SP[p.sp].n }), '#ffd24a');
  persist(); if (petHero()) saveChar();
  return p;
}

/* ---------- Zucht: zwei Begleiter ab LV 25 → ein Ei mit vererbten Genen; Hybride nach Rezept, Mutationen mit etwas Glück ---------- */
const PET_BREED_LV = 25, PET_HYB_CH = .35;
// Rezepte (beide Reihenfolgen): 'a|b' → Hybrid
const PET_HYB = {}; for (const sp of PET_HY) { const [a, b] = PET_SP[sp].hy; PET_HYB[a + '|' + b] = PET_HYB[b + '|' + a] = sp; }
function petHybOf(a, b) { return PET_HYB[a + '|' + b] || null; }
// Abklingzeit je Elternteil: 8 h + 2 h je Seltenheitsstufe
function petBreedCd(p) { return (8 + 2 * PET_SP[p.sp].t) * 3600e3; }
function petBreedLeft(p) { return p.zt ? Math.max(0, p.zt + petBreedCd(p) - Date.now()) : 0; }
function petBreedCost(a, b) { const t = Math.max(PET_SP[a.sp].t, PET_SP[b.sp].t); return 100 * (t + 1) * (t + 1); }
// Warum ein Begleiter gerade nicht züchten kann (oder '')
function petBreedWhy(p) { if (!p) return _t('Wähle zwei Begleiter.'); if (p.lv < PET_BREED_LV) return _t('Erst ab LV {lv} zuchtreif.', { lv: PET_BREED_LV }); if (petIsHurt(p)) return _t('Verletzt.'); const l = petBreedLeft(p); if (l > 0) return _t('Ruht sich noch {t} aus.', { t: petDur(l) }); return ''; }
function petMutRoll(R) { const r = R(), pool = Object.keys(PET_MUT).filter(k => PET_MUT[k].r === (r < .6 ? 1 : r < .88 ? 2 : 3)); return pool[Math.floor(R() * pool.length)]; }
// Ergebnis einer Paarung (reine Rechnung, fester Zufall R möglich): { sp, hy, gn, mu, c0, pa, ge }
function petBreedRoll(a, b, R) {
  R = R || Math.random;
  const hyb = petHybOf(a.sp, b.sp), luck = (petGene(a, 4) + petGene(b, 4)) / 200, hyOk = hyb && R() < PET_HYB_CH + luck * .15;
  const sp = hyOk ? hyb : a.sp === b.sp ? a.sp : (R() < .5 ? a.sp : b.sp);
  // Gene: Mittel der Eltern ± 10, manchmal ein Sprung (eher nach oben), Hybride +5
  const gn = []; for (let i = 0; i < 5; i++) { let v = (petGene(a, i) + petGene(b, i)) / 2 + (R() * 2 - 1) * 10; if (R() < .12) v += R() * 23 - 5; if (hyOk) v += 5; gn.push(clamp(Math.round(v), 0, 100)); }
  // Mutation: 3 % + Glück der Eltern, mehr bei mutierten Eltern und Hybriden; Eltern-Mutation wird manchmal vererbt
  const ch = .03 + luck * .04 + (a.mu || b.mu ? .03 : 0) + (hyOk ? .02 : 0);
  let mu = null; const par = [a.mu, b.mu].filter(k => PET_MUT[k]);
  if (par.length && R() < .25) mu = par[Math.floor(R() * par.length)]; else if (R() < ch) mu = petMutRoll(R);
  const from = sp === a.sp ? a : sp === b.sp ? b : null, c0 = from ? clamp(from.c0 | 0, 0, 5) : Math.floor(R() * 6);
  return { sp, hy: !!hyOk, gn, mu, c0, pa: [a.sp, b.sp], ge: Math.max(a.ge || 0, b.ge || 0) + 1 };
}
// Paaren: prüft alles, zieht Gold ab, legt das Ei in Nest oder Korb → Ei oder Fehlertext
function petBreed(a, b, R) {
  const M = petM(); if (!M || !a || !b || a === b) return _t('Wähle zwei verschiedene Begleiter.');
  const why = petBreedWhy(a) || petBreedWhy(b); if (why) return why;
  if (M.eggs.length >= EGG_MAX) return _t('Dein Brutnest ist voll – mehr als {n} Eier passen nicht hinein.', { n: EGG_MAX });
  const cost = petBreedCost(a, b); if (!petHero() || P.gold < cost) return _t('Dir fehlt Gold: {n} nötig.', { n: fmt(cost) });
  P.gold -= cost; const r = petBreedRoll(a, b, R), g = eggNew(r.sp, r); M.eggs.push(g);
  a.zt = b.zt = Date.now(); M.bred = (M.bred || 0) + 1; persist(); saveChar();
  return g;
}
// In den Landen: Monster legen manchmal ein Ei ihrer Kreatur (die Welt macht daraus Beute am Boden, siehe lande.js)
function petLandeOn() { try { return typeof landeActive === 'function' && !!landeActive(); } catch (_) { return false; } }
function petMonEgg(e, p) {
  const sp = e && PET_MON[e.t]; if (!sp) return false;
  const ch = (e.boss ? .25 : e.champ ? .08 : e.elite ? .03 : .008) * (1 + (p ? petMods(p).pegg || 0 : 0));
  if (Math.random() >= ch || petM().eggs.length >= EGG_MAX) return false;
  const g = eggGive(sp, true); if (g) txt(e.x, e.y - 30, _t('MONSTER-EI!'), PET_TIERS[g.tier].c, true);
  return !!g;
}
// Außerhalb der Lande: Zauberrunen und Begleiter-Ausrüstung (nur mit aktivem Begleiter)
function petDrops(e, p) {
  if (!p || !e || e.ai === 'dummy') return;
  const M = petM(), k = 1 + (petMods(p).pegg || 0), b = e.boss ? 1 : e.champ ? .4 : e.elite ? .14 : .02;
  if (Math.random() < .2 * b * k) { const r = PET_SPELLS[Math.floor(Math.random() * PET_SPELLS.length)]; M.runes[r] = Math.min(99, (M.runes[r] || 0) + 1); txt(e.x, e.y - 26, _t('RUNE: {n}', { n: PET_SPELL[r].n }).toLocaleUpperCase(LOCALE), PET_EL[PET_SPELL[r].el].c, true); toast(_t('Zauberrune für deinen Begleiter: {n}', { n: PET_SPELL[r].n }), PET_EL[PET_SPELL[r].el].c); }
  if (Math.random() < .25 * b * k) { const s = PET_SLOTS[Math.floor(Math.random() * 3)], lv = clamp((P.lv || 1) + ri(-3, 3), 1, 100), it = petGearNew(s, e.boss ? +wpick({ 1: 40, 2: 35, 3: 18, 4: 7 }) : null, lv); if (M.gear.length < PET_GEAR_MAX) { M.gear.push(it); txt(e.x, e.y - 34, petGearName(it).toLocaleUpperCase(LOCALE), RAR[it.r].c, true); toast(_t('Begleiter-Ausrüstung: {n} ({r})', { n: petGearName(it), r: RAR[it.r].n }), RAR[it.r].c); } else P.gold += 20 * (it.r + 1); }
}
function petKill(e) {
  const M = petM(); if (!M) return;
  const p = petActive(); if (p) petXP(p, Math.max(1, Math.round((e.xp || 0) * .5)));
  if (petLandeOn()) petMonEgg(e, p); else petDrops(e, p);
  // Champions: 5 % Ei mit etwas Glück
  if (e.champ && !e.boss) { if (Math.random() < .05 && M.eggs.length < EGG_MAX) { txt(e.x, e.y - 30, _t('BEGLEITER-EI!'), '#ffd24a', true); eggGive(null, false, { luck: .4 }); } return; }
  if (!e.boss) return;
  // Das erste Ei: garantiert vom ersten besiegten Boss der Geschichte (meist gewöhnlich)
  if (!M.first && G && G.type === 'boss' && !G.daily) {
    M.first = true; M.intro = false; M.fromBoss = true; const g = eggGive(null, true, { tier: +wpick({ 1: 70, 2: 25, 3: 5 }) });
    if (g) { txt(e.x, e.y - 34, _t('BEGLEITER-EI!'), PET_TIERS[g.tier].c, true); toast(_t('{egg}! Bring es ins Brutnest im Versteck.', { egg: PET_TIERS[g.tier].egg }), PET_TIERS[g.tier].c); sfx('loot'); }
    persist(); return;
  }
  // sonst: 10 % Ei, in der Qual 15 % und mit etwas mehr Glück
  if (Math.random() < .1 + (qualOf(P.act) ? .05 : 0)) {
    txt(e.x, e.y - 34, _t('BEGLEITER-EI!'), '#ffd24a', true);
    if (M.eggs.length >= EGG_MAX) { gainFate(1); toast(_t('Ein Begleiter-Ei! Dein Brutnest ist voll – dafür +1 Glücksmünze.'), '#ffd24a'); } else eggGive(null, false, { luck: qualOf(P.act) ? .6 : 0 });
  }
}
// Etwas Neues oder Wichtiges beim Begleiter (Reiter-Hinweis)
function petNews() { const M = petM(); if (!M) return false; const A = nestAlert(); return M.list.some(p => p.nw) || (A.ready > 0 && M.list.length < PET_MAX) || A.need > 0; }

/* ---------- Ton ---------- */
function petSnd(k) {
  if (!AC || !sfxOn()) return;
  switch (k) {
    case 'fire': noise(.12, .03, 700); tone(260, .1, 'sawtooth', .02, 120); break;
    case 'ice': tone(1500, .1, 'sine', .025, 900); noise(.06, .015, 4000); break;
    case 'beam': tone(1100, .14, 'triangle', .022, 1700); break;
    case 'zap': noise(.08, .035, 2600); tone(1300, .05, 'square', .015, 400); break;
    case 'claw': noise(.06, .035, 1800); break;
    case 'bite': tone(320, .05, 'square', .025, 160); noise(.04, .02, 1500); break;
    case 'chirp': [1200, 1600, 2000].forEach((f, i) => tone(f, .07, 'triangle', .035, 0, i * .06)); break;
    case 'feed': tone(700, .06, 'triangle', .03, 900); tone(900, .08, 'triangle', .03, 1200, .07); break;
    case 'puff': noise(.15, .03, 900); break;
    case 'spit': tone(500, .06, 'sine', .025, 250); noise(.05, .015, 1200); break;
    case 'warm': noise(.35, .025, 300); tone(180, .3, 'sine', .02, 260); break;
    case 'pet': [880, 1100, 1320].forEach((f, i) => tone(f, .09, 'sine', .03, f * 1.05, i * .07)); break;
    case 'crack': noise(.07, .06, 2200); tone(900, .03, 'square', .02, 500); break;
    case 'hatch': [523, 784, 1046, 1568].forEach((f, i) => tone(f, .18, 'triangle', .05, 0, i * .08)); noise(.3, .04, 2500); break;
  }
}

/* ---------- Im Spiel: folgen, kämpfen, Beute anziehen ---------- */
const PET_RT = { id: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, face: 1, ph: 0, cd: 1, spc: 8, mv: false, dash: null, seq: null, storm: null, idle: 0, sleep: false, bl: 3, blk: 0, fl: 0, g: 0, lt: 0, wan: null, wanT: 0, atk: 0, mcd: [2, 3.5, 5], gcd: 0, shield: 0, shT: 0, casts: 0 };
let PET_BOLTS = [], PET_FX = [];
function petAlive(e) { return !!e && !e.dead && e.st !== 'spawn' && !(e.under > 0) && !(e.fade > .6) && e.ai !== 'dummy'; }
function petPlace(puff) {
  const p = petActive(); PET_RT.id = p ? p.id : null; PET_RT.g = G; PET_BOLTS = []; PET_FX = []; PET_RT.dash = PET_RT.seq = PET_RT.storm = PET_RT.wan = null; PET_RT.idle = 0; PET_RT.sleep = false;
  if (!p || !P) return;
  const bd = typeof BD !== 'undefined' ? BD : { x0: 0, x1: 9999, y0: 0, y1: 9999 };
  PET_RT.x = clamp(P.x - (P.face || 1) * 16, bd.x0 + 6, bd.x1 - 6); PET_RT.y = clamp(P.y + 3, bd.y0, bd.y1); PET_RT.vx = PET_RT.vy = 0; PET_RT.face = P.face || 1;
  PET_RT.z = PET_SP[p.sp].fly ? 12 : 0; PET_RT.cd = 1; PET_RT.spc = 6; PET_RT.lt = T; PET_RT.mcd = [2, 3.5, 5]; PET_RT.gcd = 0; PET_RT.shield = 0; PET_RT.shT = 0;
  if (puff && state === 'play') { burst(PET_RT.x, PET_RT.y, 6, PET_EL[PET_SP[p.sp].el].c, 14, 45, 1); petSnd('puff'); }
}
// Werte eines Angriffs: wie die Waffe des Helden, aber schwächer, mit dem Element der Art
function petW(p) {
  const w = playerW(), S = PET_SP[p.sp], m = petMods(p), ek = 1 + (m.pel || 0);
  w.dmg *= petDmgK(p.lv, p.sp) * petDmgMul(p); w.crit = Math.min(.75, w.crit * .5 + (S.crit || .05) + (m.pcrit || 0)); w.leech = 0; w.kb *= .4; w.chained = true;
  // Element bestimmt die Nebenwirkung: Feuer brennt, Frost verlangsamt, Gift vergiftet (Halsband „Element-Wirkung“ verstärkt)
  w.burn = S.el === 'feuer' ? Math.min(.9, .3 * ek) : 0; w.frost = S.el === 'frost' ? Math.min(.9, .45 * ek) : 0; w.poison = S.el === 'gift';
  w.el = S.el; w.col = PET_EL[S.el].c; w.pet = 1;
  return w;
}
function petHit(e, w, mul, nx, ny, crit) {
  if (!e || e.dead) return;
  const sx = P.stealth; P.stealth = 0; // Tarnung des Helden nicht verbrauchen
  weaponHit(e, w, mul, nx || 0, ny || 0, .6, crit);
  P.stealth = sx;
  if (e.dead) { const p = petActive(); if (p) p.k = (p.k || 0) + 1; }
}
function petBolt(kind, w, mul, a, tg, o) {
  const sp = (o && o.sp) || 190;
  const b = Object.assign({ kind, w, mul, x: PET_RT.x + Math.cos(a) * 5, y: PET_RT.y + Math.sin(a) * 3, h: PET_RT.z + 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, t: 1.1, tg, hit: null, home: true, pierce: false, draw: petBoltDraw }, o || {}); b.t0 = b.t; PET_BOLTS.push(b);
}
function petAttack(p, t) {
  const st = petStage(p.lv), w = petW(p), a = Math.atan2(t.y - PET_RT.y, t.x - PET_RT.x);
  PET_RT.face = t.x >= PET_RT.x ? 1 : -1; PET_RT.atk = .22;
  const E = PET_EL[PET_SP[p.sp].el];
  switch (PET_SP[p.sp].atk) {
    case 'fire': petBolt('fire', w, 1, a, t); petSnd('fire'); break;
    case 'ice': petBolt('ice', w, 1, a, t, { sp: 220 }); petSnd('ice'); break;
    case 'spit': petBolt('spit', w, 1, a, t, { sp: 170 }); petSnd('spit'); break;
    case 'beam': {
      PET_FX.push({ k: 'beam', x: PET_RT.x, y: t.y, z0: PET_RT.z + 6, tg: t, tx: t.x, ty: t.y, tz: 8 * t.sc + (t.z || 0), t: .24, max: .24, c: E.c, rgb: E.rgb, draw: petFxDraw });
      petHit(t, w, 1.05, Math.cos(a), Math.sin(a)); burst(t.x, t.y, 8 * t.sc, E.c2, 7, 40, 1); petSnd('beam'); break;
    }
    case 'zap': {
      const pts = [[PET_RT.x, PET_RT.y - PET_RT.z - 4]], hit = new Set(); let cur = t, mul = 1;
      for (let k = 0; k <= (st >= 4 ? 3 : st >= 2 ? 2 : 1) && cur; k++) {
        hit.add(cur); pts.push([cur.x, cur.y - 8 * cur.sc]); petHit(cur, w, mul, 0, 0); mul *= .8;
        let nt = null, bd = 70; for (const e of enemies) { if (hit.has(e) || !petAlive(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; nt = e; } } cur = nt;
      }
      fx.push({ k: 'zap', pts, life: .2, max: .2, sk: E.rgb !== '170,210,255' ? { glow: E.rgb, r: 2 } : null }); petSnd('zap'); break;
    }
    default: PET_RT.dash = { tg: t, t: 0, max: .75, hit: false };
  }
}
function petSpecial(p, t) {
  const S = PET_SP[p.sp], E = PET_EL[S.el], pw = petPow(p.lv), w = petW(p), mul = PET_TIERS[S.t].mul;
  txt(PET_RT.x, PET_RT.y - 26 - PET_RT.z, S.sn.toLocaleUpperCase(LOCALE) + '!', E.c2, true); PET_RT.fl = .4;
  switch (S.spec) {
    case 'breath': { const a0 = Math.atan2(t.y - PET_RT.y, t.x - PET_RT.x), n = Math.round(8 + 4 * pw); for (let k = 0; k < n; k++) petBolt('flame', w, .3 * pw, a0 + rnd(-.4, .4), null, { sp: rnd(140, 210), t: rnd(.38, .62), pierce: true, home: false, el: S.el }); sfx(S.el === 'frost' ? 'frost' : 'fire'); break; }
    case 'leap': { const list = enemies.filter(petAlive).sort((a, b) => dist(a, PET_RT) - dist(b, PET_RT)).slice(0, pw >= 2 ? 6 : pw > 1 ? 4 : 3); PET_RT.seq = { list, i: 0, t: 0, w, mul: 1.5 * pw }; PET_RT.dash = null; break; }
    case 'nova': {
      const h = Math.round(P.st.hp * .05 * pw * mul); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 28, '+' + h, '#79c24e', true);
      fx.push({ k: 'pillar', x: P.x, y: P.y, life: 1, max: 1 }); rings.push({ x: P.x, y: P.y, r: 4, max: 84, life: .5, max2: .5, col: E.c });
      for (const e of enemies) { if (!petAlive(e)) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < 78 + e.r * e.sc) { const g = e.gold; petHit(e, w, 1.1 * pw, (e.x - P.x) / (d || 1), (e.y - P.y) / (d || 1)); if (p.sp === 'kaefer' && p.lv >= 75 && g > 0) dropCoins(e.x, e.y, Math.max(1, Math.round(g * .3))); } }
      for (let i = 0; i < 24; i++) part(P.x + rnd(-30, 30), P.y + rnd(-14, 14), 0, 0, 0, rnd(30, 70), Math.random() < .5 ? E.c : E.c2, rnd(.5, 1), 1, -10, 1);
      sfx('heal'); break;
    }
    case 'freeze': {
      const R = 82; fxAnim('ring', PET_RT.x, PET_RT.y - 4, { sc: R / 22, dur: .5, add: true }); for (let k = 0; k < 12; k++) fx.push({ k: 'shard', x: PET_RT.x, y: PET_RT.y, ang: k / 12 * 6.283, life: .4, max: .4 });
      for (const e of enemies) { if (!petAlive(e)) continue; const d = Math.hypot(e.x - PET_RT.x, e.y - PET_RT.y); if (d < R + e.r * e.sc) { petHit(e, w, .9 * pw, (e.x - PET_RT.x) / (d || 1), (e.y - PET_RT.y) / (d || 1)); if (!e.dead) { if (e.boss) e.chill = 2.5; else e.freeze = Math.max(e.freeze || 0, 1.1 * pw); } } }
      for (let i = 0; i < 26; i++) part(PET_RT.x + rnd(-40, 40), PET_RT.y + rnd(-20, 20), rnd(10, 30), rnd(-20, 20), rnd(-10, 10), 0, Math.random() < .5 ? '#ffffff' : '#bfefff', rnd(.6, 1.1), 1, 20, 1);
      sfx('frost'); break;
    }
    case 'cloud': { PET_FX.push({ k: 'cloud', x: t.x, y: t.y, r: (28 + 6 * pw) * (S.t >= 6 ? 1.4 : 1), t: 4, max: 4, tick: 0, pw, w, draw: petFxDraw }); petBolt('spit', w, .3, Math.atan2(t.y - PET_RT.y, t.x - PET_RT.x), t, { sp: 230 }); sfx('poison'); break; }
    case 'storm': PET_RT.storm = { n: pw >= 2 ? 7 : pw > 1 ? 5 : 3, t: 0, w, pw, el: S.el }; break;
  }
}
/* ---------- Zauber im Kampf: jeder Sockel hat seine eigene Abklingzeit ---------- */
// Waffe für Zauber: Schaden = Heldenwaffe × Zauberkraft (Stufe, Seltenheit, Magie-Gen, Talente, Talisman)
function petSpellW(p, el) { const w = petW(p); w.dmg = playerW().dmg * petSpellPow(p); if (el) { w.el = el; w.col = PET_EL[el].c; w.burn = el === 'feuer' ? .6 : 0; w.frost = el === 'frost' ? .8 : 0; w.poison = el === 'gift'; } return w; }
function petBoom(x, y, r, w, mul, burn) {
  for (const e of enemies) { if (!petAlive(e)) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < r + e.r * e.sc) { petHit(e, w, mul * (1 - d / (r * 2.4)), (e.x - x) / (d || 1), (e.y - y) / (d || 1)); if (burn && !e.dead) { e.burn = 3; e.burnDmg = Math.max(1, Math.round(w.dmg * .2)); } } }
}
function petNear(x, y, r) { return enemies.filter(e => petAlive(e) && Math.hypot(e.x - x, e.y - y) < r); }
// Zauber wirken → true, wenn er gewirkt wurde (sonst später nochmal versuchen)
function petCast(p, k) {
  const Z = PET_SPELL[k]; if (!Z || !P || !P.st) return false;
  const E = PET_EL[Z.el], st = petStage(p.lv), t = nearestEnemy(170, P);
  const say = () => { txt(PET_RT.x, PET_RT.y - 22 - PET_RT.z, Z.n.toLocaleUpperCase(LOCALE), E.c2, false); PET_RT.fl = Math.max(PET_RT.fl, .25); PET_RT.casts = (PET_RT.casts || 0) + 1; };
  switch (k) {
    case 'feuerball': { if (!t || !petAlive(t)) return false; const w = petSpellW(p, 'feuer'); petBolt('fire', w, 1.6, Math.atan2(t.y - PET_RT.y, t.x - PET_RT.x), t, { sp: 170, boom: 30, big: 1, t: 1.4 }); say(); petSnd('fire'); return true; }
    case 'heilung': { if (P.hp >= P.st.hp * .75) return false; const h = Math.round(P.st.hp * (.06 + .012 * st) * petHealK(p)); P.hp = Math.min(P.st.hp, P.hp + h); txt(P.x, P.y - 28, '+' + h, '#79c24e', true); fx.push({ k: 'pillar', x: P.x, y: P.y, life: .8, max: .8 }); for (let i = 0; i < 14; i++) part(P.x + rnd(-8, 8), P.y, rnd(0, 12), 0, 0, rnd(20, 45), Math.random() < .5 ? '#79c24e' : '#c8f06a', rnd(.5, .9), 1, -10, 1); say(); sfx('heal'); return true; }
    case 'schild': { if (PET_RT.shT > T || !petNear(P.x, P.y, 130).length) return false; PET_RT.shield = Math.round(P.st.hp * (.1 + .015 * st) * petHealK(p)); PET_RT.shT = T + 6; rings.push({ x: P.x, y: P.y, r: 4, max: 26, life: .35, max2: .35, col: '#ffe08a' }); say(); petSnd('beam'); return true; }
    case 'blitz': {
      if (!t || !petAlive(t)) return false; const w = petSpellW(p, 'blitz'), pts = [[PET_RT.x, PET_RT.y - PET_RT.z - 4]], hit = new Set(); let cur = t, mul = 1.3;
      for (let j = 0; j < 4 + (st >= 3 ? 2 : 0) && cur; j++) { hit.add(cur); pts.push([cur.x, cur.y - 8 * cur.sc]); petHit(cur, w, mul, 0, 0); mul *= .85; let nt = null, bd = 80; for (const e of enemies) { if (hit.has(e) || !petAlive(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd) { bd = d; nt = e; } } cur = nt; }
      fx.push({ k: 'zap', pts, life: .25, max: .25, sk: null }); say(); sfx('zap'); return true;
    }
    case 'frostnova': {
      const near = petNear(PET_RT.x, PET_RT.y, 80); if (!near.length) return false; const w = petSpellW(p, 'frost');
      fxAnim('ring', PET_RT.x, PET_RT.y - 4, { sc: 80 / 22, dur: .5, add: true }); for (let j = 0; j < 12; j++) fx.push({ k: 'shard', x: PET_RT.x, y: PET_RT.y, ang: j / 12 * 6.283, life: .4, max: .4 });
      for (const e of near) { petHit(e, w, .9, 0, 0); if (!e.dead) { if (e.boss) e.chill = 2.5; else e.freeze = Math.max(e.freeze || 0, 1.4); } }
      say(); sfx('frost'); return true;
    }
    case 'gift': { if (!t || !petAlive(t)) return false; const w = petSpellW(p, 'gift'); PET_FX.push({ k: 'cloud', x: t.x, y: t.y, r: 34 + st * 2, t: 4.5, max: 4.5, tick: 0, pw: 1.5, w, draw: petFxDraw }); say(); sfx('poison'); return true; }
    case 'meteor': {
      if (!t || !petAlive(t)) return false; let best = t, bn = 0; for (const e of petNear(P.x, P.y, 170)) { const n = petNear(e.x, e.y, 40).length; if (n > bn) { bn = n; best = e; } }
      PET_FX.push({ k: 'meteor', x: best.x, y: best.y, t: .75, max: .75, w: petSpellW(p, 'feuer'), draw: petFxDraw }); say(); petSnd('fire'); return true;
    }
    case 'ranken': {
      if (!t || !petAlive(t)) return false; const w = petSpellW(p, 'gift'), list = petNear(t.x, t.y, 46);
      for (const e of list) { petHit(e, w, .7, 0, 0); if (!e.dead) { e.chill = Math.max(e.chill || 0, 3); if (!e.boss) e.stun = Math.max(e.stun || 0, .8); } }
      PET_FX.push({ k: 'vine', x: t.x, y: t.y, r: 46, t: .9, max: .9, draw: petFxDraw }); say(); sfx('poison'); return true;
    }
  }
  return false;
}
// Schild des Begleiters fängt Schaden am Helden ab
HOOK.hurt.push((d, src) => {
  try {
    if (!(PET_RT.shield > 0) || !(PET_RT.shT > T) || !(d > 0)) return d;
    const a = Math.min(d, PET_RT.shield); PET_RT.shield -= a; if (P) txt(P.x, P.y - 30, _t('SCHILD'), '#ffe08a'); if (PET_RT.shield <= 0) PET_RT.shT = 0;
    return d - a;
  } catch (e) { if (!PET_ERR.hurt) { PET_ERR.hurt = 1; console.error('Begleiter (hurt):', e); } return d; }
});
function petTick(dt) {
  const p = petActive(); if (!p || !P) { PET_RT.id = null; return; }
  PET_RT.lt = T;
  if (PET_RT.id !== p.id || PET_RT.g !== G) petPlace(PET_RT.id !== null && PET_RT.id !== p.id);
  const S = PET_SP[p.sp], st = petStage(p.lv), play = state === 'play' && !!G && !!G.type, hide = play && G.type === 'versteck', fight = play && !hide && G.phase !== 'done';
  PET_RT.fl = Math.max(0, PET_RT.fl - dt); PET_RT.atk = Math.max(0, PET_RT.atk - dt);
  PET_RT.bl -= dt; if (PET_RT.bl < 0) { PET_RT.blk = .14; PET_RT.bl = rnd(2.2, 5); } PET_RT.blk -= dt;
  // Spezial-Abläufe: Schattensprung, Gewitter
  if (PET_RT.seq) {
    const Q = PET_RT.seq; Q.t -= dt;
    if (Q.t <= 0) {
      const e = Q.list[Q.i++];
      if (!e) PET_RT.seq = null;
      else if (petAlive(e)) {
        PET_FX.push({ k: 'after', x: PET_RT.x, y: PET_RT.y, z: PET_RT.z, face: PET_RT.face, t: .3, max: .3, draw: petFxDraw });
        const sd = e.x >= P.x ? 1 : -1; PET_RT.x = e.x + sd * (e.r * e.sc + 5); PET_RT.y = e.y + 1; PET_RT.face = -sd; PET_RT.z = 0; PET_RT.vx = PET_RT.vy = 0;
        petHit(e, Q.w, Q.mul, -sd, 0, true); fx.push({ k: 'slash', x: e.x, y: e.y - 8, ang: sd > 0 ? Math.PI : 0, flip: Q.i % 2 === 0, sc: .45, life: .2, max: .2, col: PET_EL[S.el].c2 }); burst(e.x, e.y, 8, PET_EL[S.el].c, 10, 50, 1); petSnd('claw');
        Q.t = .13;
      }
    }
  }
  if (PET_RT.storm && state === 'play') {
    const Z = PET_RT.storm; Z.t -= dt;
    if (Z.t <= 0) {
      Z.t = .14; Z.n--; const list = enemies.filter(e => petAlive(e) && Math.hypot(e.x - P.x, e.y - P.y) < 180), e = list.length ? pick(list) : null;
      if (e && Z.el === 'blitz') { fxAnim('bolt', e.x, e.y - 18, { dur: .4, add: true }); petHit(e, Z.w, 1.3 * Z.pw, 0, 0); burst(e.x, e.y, 4, '#fffbe0', 10, 60, 1); flash = { a: .1, c: '200,220,255' }; shake(2); sfx('zap'); }
      else if (e) { const E = PET_EL[Z.el]; PET_FX.push({ k: 'star', x: e.x, y: e.y, t: .3, max: .3, c: E.c, c2: E.c2, rgb: E.rgb, draw: petFxDraw }); petHit(e, Z.w, 1.3 * Z.pw, 0, 0); burst(e.x, e.y, 4, E.c2, 10, 60, 1); shake(2); petSnd('beam'); }
      if (Z.n <= 0 || !e) PET_RT.storm = null;
    }
  }
  // Ziel: hinter dem Helden; im Versteck ein wenig herumstreunen
  let tx = P.x - (P.face || 1) * (8 + petStripOf(p).W * .42), ty = P.y + (S.fly ? -2 : 3), k = 7;
  if (hide && !P.moving && PET_RT.idle > 1.2) {
    PET_RT.wanT -= dt;
    if (PET_RT.wanT <= 0) { PET_RT.wanT = rnd(2.2, 4.8); PET_RT.wan = Math.random() < .3 ? null : { x: clamp(P.x + rnd(-48, 48), BD.x0 + 8, BD.x1 - 8), y: clamp(P.y + rnd(-22, 26), BD.y0 + 4, BD.y1 - 2) }; if (!PET_RT.wan && Math.random() < .6) PET_FX.push({ k: 'heart', x: PET_RT.x, y: PET_RT.y, z: PET_RT.z + 14, t: 1, max: 1, draw: petFxDraw }); }
    if (PET_RT.wan) { tx = PET_RT.wan.x; ty = PET_RT.wan.y; k = 3.2; }
  } else if (P.moving) { PET_RT.wan = null; PET_RT.wanT = .5; }
  if (PET_RT.dash) {
    const D = PET_RT.dash, t = D.tg; D.t += dt;
    if (!petAlive(t) || D.t > D.max || !fight) PET_RT.dash = null;
    else if (!D.hit) {
      const claw = S.atk === 'claw', dx = t.x - PET_RT.x, dy = t.y - PET_RT.y, d = Math.hypot(dx, dy) || 1, sp = claw ? 290 : 250, m = Math.min(d, sp * dt);
      PET_RT.x += dx / d * m; PET_RT.y += dy / d * m; PET_RT.face = dx >= 0 ? 1 : -1; PET_RT.vx = dx / d * sp * .3; PET_RT.vy = dy / d * sp * .3;
      if (claw && !S.fly) PET_RT.z = Math.sin(clamp(D.t / .28, 0, 1) * Math.PI) * (8 + st);
      if (d < t.r * t.sc + 5) {
        D.hit = true; D.t = Math.max(D.t, D.max - .22); PET_RT.z = 0;
        petHit(t, petW(p), 1.25, dx / d, dy / d, false);
        if (claw) { fx.push({ k: 'slash', x: t.x - dx / d * 3, y: t.y - 8, ang: Math.atan2(dy, dx), flip: Math.random() < .5, sc: .35, life: .18, max: .18, col: PET_EL[S.el].c2 }); petSnd('claw'); }
        else { PET_FX.push({ k: 'bite', x: t.x, y: t.y, z: 7 * t.sc, t: .26, max: .26, draw: petFxDraw }); burst(t.x, t.y, 6, PET_EL[S.el].c, 8, 40, 1); petSnd('bite'); }
      }
    }
  }
  if (!PET_RT.dash && !PET_RT.seq) {
    const ax = k * k * (tx - PET_RT.x) - 2 * k * PET_RT.vx, ay = k * k * (ty - PET_RT.y) - 2 * k * PET_RT.vy;
    PET_RT.vx += ax * dt; PET_RT.vy += ay * dt; const v = Math.hypot(PET_RT.vx, PET_RT.vy); if (v > 320) { PET_RT.vx *= 320 / v; PET_RT.vy *= 320 / v; }
    PET_RT.x += PET_RT.vx * dt; PET_RT.y += PET_RT.vy * dt;
    if (Math.hypot(P.x - PET_RT.x, P.y - PET_RT.y) > 260) petPlace(true);
  }
  if (typeof BD !== 'undefined') { PET_RT.x = clamp(PET_RT.x, BD.x0 + 4, BD.x1 - 4); PET_RT.y = clamp(PET_RT.y, BD.y0, BD.y1); }
  const v = Math.hypot(PET_RT.vx, PET_RT.vy); PET_RT.mv = !!PET_RT.dash || v > 14;
  if (!PET_RT.dash && !PET_RT.seq) { if (Math.abs(PET_RT.vx) > 10) PET_RT.face = PET_RT.vx > 0 ? 1 : -1; else if (PET_RT.atk <= 0 && v < 4) PET_RT.face = P.face || 1; }
  PET_RT.ph += dt * (PET_RT.mv ? 12 : 6) * (S.fly ? 1.3 : 1);
  if (S.fly) PET_RT.z = lerp(PET_RT.z, 11 + st * 1.4 + Math.sin(T * 3 + 1) * 1.6, 1 - Math.pow(.02, dt));
  else if (!(S.atk === 'claw' && PET_RT.dash && !PET_RT.dash.hit)) PET_RT.z = (S.atk === 'claw' || p.sp === 'kroete' || p.sp === 'igel') && PET_RT.mv ? Math.abs(Math.sin(PET_RT.ph * Math.PI / 2)) * 1.5 : 0;
  // Ruhe: nach einer Weile schläft der Begleiter ein
  if (P.moving || PET_RT.mv && !PET_RT.wan || (fight && enemies.some(petAlive))) PET_RT.idle = 0; else PET_RT.idle += dt;
  PET_RT.sleep = PET_RT.idle > 14 && !PET_RT.wan;
  // Kampf
  if (fight) {
    PET_RT.cd -= dt; PET_RT.spc -= dt;
    if (PET_RT.cd <= 0 && !PET_RT.dash && !PET_RT.seq) { const t = nearestEnemy(S.fly ? 150 : 125, P); if (t && petAlive(t) && Math.hypot(t.x - PET_RT.x, t.y - PET_RT.y) < 200) { petAttack(p, t); PET_RT.cd = petAtkCd(p); } else PET_RT.cd = .25; }
    if (p.lv >= 50 && PET_RT.spc <= 0 && !PET_RT.seq) { const t = nearestEnemy(160, P); if (t && petAlive(t)) { petSpecial(p, t); PET_RT.spc = petSpecCd(p.lv) * (1 - Math.min(.5, petMods(p).pspec || 0)); } else PET_RT.spc = .6; }
    // Zauber aus den Sockeln (jeder für sich, mit kurzer Pause zwischen zwei Zaubern)
    const mg = Array.isArray(p.mg) ? p.mg : [], ns = petSockets(p);
    PET_RT.gcd = Math.max(0, (PET_RT.gcd || 0) - dt);
    for (let i = 0; i < ns; i++) {
      const k = mg[i]; if (!PET_SPELL[k]) continue; PET_RT.mcd[i] -= dt;
      if (PET_RT.mcd[i] <= 0 && PET_RT.gcd <= 0 && !PET_RT.seq) { if (petCast(p, k)) { PET_RT.mcd[i] = PET_SPELL[k].cd * petSpellCdK(p); PET_RT.gcd = .8; } else PET_RT.mcd[i] = .4; }
    }
  }
  if (PET_RT.shT > 0 && PET_RT.shT <= T) { PET_RT.shield = 0; PET_RT.shT = 0; }
  // Beutemagnet ab LV 10
  if (play && p.lv >= 10) {
    const R = petMagRp(p), R2 = R * R;
    for (const c of pickups) { if (c.mag || c.k === 'loot' || c.t < .25) continue; const dx = c.x - P.x, dy = c.y - P.y; if (dx * dx + dy * dy < R2) { c.mag = 1; part(c.x, c.y, 5, 0, 0, 30, PET_EL[S.el].c, .35, 1, 0, 1); } }
  }
  // Aura ab Uralt, Glitzern bei schillernden
  if (st >= 4 && Math.random() < (st === 5 ? .3 : .18)) part(PET_RT.x + rnd(-6, 6) - PET_RT.face * 2, PET_RT.y + rnd(-2, 2), PET_RT.z + rnd(0, 6), 0, 0, rnd(12, 28), Math.random() < .5 ? PET_EL[S.el].c : st === 5 ? '#ffd24a' : PET_EL[S.el].c2, rnd(.5, .9), 1, -5, 1);
  if (p.shiny && Math.random() < .08) part(PET_RT.x + rnd(-6, 6), PET_RT.y, PET_RT.z + rnd(2, 12), 0, 0, 10, '#ffffff', .4, 1, 0, 1);
  // eigene Geschosse
  for (const b of PET_BOLTS) {
    if (b.delay > 0) { b.delay -= dt; continue; }
    b.t -= dt;
    if (b.home && b.tg && petAlive(b.tg)) { const a = Math.atan2(b.tg.y - b.y, b.tg.x - b.x), c = Math.atan2(b.vy, b.vx), na = c + clamp(angDiff(a, c), -5 * dt, 5 * dt); b.vx = Math.cos(na) * b.sp; b.vy = Math.sin(na) * b.sp; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.h = lerp(b.h, 7, 1 - Math.pow(.05, dt));
    const col = b.kind === 'ice' || b.el === 'frost' ? '#bfefff' : b.kind === 'spit' ? '#9ad858' : Math.random() < .5 ? '#ffd24a' : '#ff8a3a';
    if (Math.random() < (b.kind === 'flame' ? .35 : .6)) part(b.x, b.y, b.h, rnd(-8, 8), rnd(-4, 4), rnd(-5, 10), col, .3, 1, 0, 1);
    for (const e of enemies) {
      if (!petAlive(e) || (b.hit && b.hit.has(e))) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.r * e.sc + 4) {
        petHit(e, b.w, b.mul, b.vx / b.sp, b.vy / b.sp);
        if (b.boom) { petBoom(b.x, b.y, b.boom, b.w, b.mul * .6, true); fxAnim('boom', b.x, b.y - b.h, { sc: .7, dur: .45 }); rings.push({ x: b.x, y: b.y, r: 4, max: b.boom, life: .3, max2: .3, col: '#ffb03a' }); shake(2); sfx('boom'); }
        else if (b.kind === 'fire') fxAnim('boom', b.x, b.y - b.h, { sc: .28, dur: .3 }); else burst(b.x, b.y, b.h, col, b.kind === 'flame' ? 3 : 8, 45, 1);
        if (b.pierce) (b.hit = b.hit || new Set()).add(e); else { b.t = 0; break; }
      }
    }
    if (b.x < BD.x0 - 12 || b.x > BD.x1 + 12 || b.y < BD.y0 - 20 || b.y > BD.y1 + 12) b.t = 0;
  }
  PET_BOLTS = PET_BOLTS.filter(b => b.t > 0);
  for (const f of PET_FX) {
    f.t -= dt;
    if (f.k === 'beam' && petAlive(f.tg)) { f.tx = f.tg.x; f.ty = f.y = f.tg.y; }
    // Meteor schlägt ein
    if (f.k === 'meteor' && !f.done && f.t <= .02) { f.done = true; f.t = .02; petBoom(f.x, f.y, 46, f.w, 2.4, true); fxAnim('boom', f.x, f.y - 6, { sc: 1.1, dur: .55 }); rings.push({ x: f.x, y: f.y, r: 6, max: 56, life: .4, max2: .4, col: '#ff8a3a' }); for (let i = 0; i < 16; i++) part(f.x + rnd(-14, 14), f.y + rnd(-6, 6), rnd(2, 10), rnd(-50, 50), rnd(-25, 25), rnd(30, 90), Math.random() < .5 ? '#ffb03a' : '#ff6a2a', rnd(.4, .8), 1, 160, 1); shake(4); sfx('boom'); }
    if (f.k === 'cloud') {
      f.tick -= dt; if (Math.random() < .5) part(f.x + rnd(-f.r, f.r) * .8, f.y + rnd(-f.r, f.r) * .35, 1, 0, 0, rnd(8, 18), Math.random() < .5 ? '#79c24e' : '#c8f06a', .6, 1, -6, 1);
      if (f.tick <= 0) { f.tick = .5; for (const e of enemies) if (petAlive(e) && Math.hypot(e.x - f.x, (e.y - f.y) * 1.6) < f.r + e.r * e.sc) { e.poison = Math.max(e.poison || 0, 2.5); e.poisonDmg = Math.max(e.poisonDmg || 0, Math.max(1, Math.round(f.w.dmg * .35 * f.pw))); } }
    }
  }
  PET_FX = PET_FX.filter(f => f.t > 0);
}

/* ---------- Zeichnen (tiefensortiert über HOOK.draw) ---------- */
let PET_ICE = null;
function petFxFrame(name, f, x, y, sc, rot) { const r = fxRect(name, f); ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (rot) ctx.rotate(rot); ctx.scale(sc, sc); ctx.drawImage(FXIMG, r[0], r[1], r[2], r[3], -r[2] / 2, -r[3] / 2, r[2], r[3]); ctx.restore(); }
function petBoltDraw() {
  if (this.delay > 0) return;
  const x = this.x - CX, y = this.y - CY - this.h, a = Math.atan2(this.vy, this.vx); let rgb = '255,140,60', gr = 10;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(Math.round(this.x - CX) - 1, Math.round(this.y - CY), 3, 1);
  if (this.kind === 'fire') petFxFrame('fireball', Math.floor(T * 14 + this.x * .1), x, y, this.big ? .95 : .55, a);
  else if (this.kind === 'ice') {
    if (!PET_ICE) PET_ICE = mk(9, 5, g => { px(g, 0, 2, 1, 1, '#57a7d6'); px(g, 1, 2, 7, 1, '#8ee6ff'); px(g, 2, 1, 5, 3, '#bfefff'); px(g, 3, 2, 4, 1, '#ffffff'); px(g, 8, 2, 1, 1, '#ffffff'); px(g, 4, 0, 1, 1, '#8ee6ff'); px(g, 4, 4, 1, 1, '#8ee6ff'); });
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a); ctx.drawImage(PET_ICE, -5, -2); ctx.restore(); rgb = '150,220,255';
  } else if (this.kind === 'spit') { ctx.fillStyle = '#4e9c32'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 3); ctx.fillStyle = '#c8f06a'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 1); rgb = '140,220,90'; gr = 8; }
  else { const q = clamp(this.t / (this.t0 || .5), 0, 1), s = Math.round(lerp(6, 2, q)), ice = this.el === 'frost'; ctx.fillStyle = q > .65 ? (ice ? '#ffffff' : '#fff0a0') : q > .3 ? (ice ? '#bfefff' : '#ffb03a') : (ice ? '#57a7d6' : '#d8402a'); ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); gr = 4 + s; if (ice) rgb = '150,220,255'; }
  ctx.globalCompositeOperation = 'lighter'; glow(x, y, gr, rgb, .4); ctx.globalCompositeOperation = 'source-over';
  addLight(x, y, 18, .6);
}
function petFxDraw() {
  const f = this, q = clamp(f.t / f.max, 0, 1);
  if (f.k === 'beam') {
    const x0 = PET_RT.x - CX + PET_RT.face * 3, y0 = PET_RT.y - CY - PET_RT.z - 5, x1 = f.tx - CX, y1 = f.ty - CY - f.tz;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = q;
    ctx.strokeStyle = f.c || '#ffd24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + rnd(-1, 1), y1 + rnd(-1, 1)); ctx.stroke();
    glow(x1, y1, 10, f.rgb || '255,230,150', .6 * q); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; addLight(x1, y1, 24, q);
  } else if (f.k === 'star') {
    // Sternschnuppe: fällt schräg von oben auf das Ziel
    const p = 1 - q, x1 = f.x - CX, y1 = f.y - CY - 8, x = x1 + (1 - p) * 30, y = y1 - (1 - p) * 70;
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = f.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 9, y - 21); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); glow(x, y, 9, f.rgb, .7); ctx.globalCompositeOperation = 'source-over'; addLight(x, y, 22, 1);
  } else if (f.k === 'bite') {
    const x = Math.round(f.x - CX), y = Math.round(f.y - CY - f.z), gap = Math.round(lerp(0, 5, clamp((q - .35) * 2.5, 0, 1)));
    ctx.globalAlpha = Math.min(1, q * 3); ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - gap - 3, 7, 1); ctx.fillRect(x - 2, y - gap - 2, 2, 1); ctx.fillRect(x + 1, y - gap - 2, 2, 1); ctx.fillRect(x - 2, y - gap - 1, 1, 1); ctx.fillRect(x + 2, y - gap - 1, 1, 1);
    ctx.fillRect(x - 3, y + gap + 3, 7, 1); ctx.fillRect(x - 2, y + gap + 2, 2, 1); ctx.fillRect(x + 1, y + gap + 2, 2, 1); ctx.fillRect(x - 2, y + gap + 1, 1, 1); ctx.fillRect(x + 2, y + gap + 1, 1, 1);
    ctx.globalAlpha = 1;
  } else if (f.k === 'cloud') {
    const x = f.x - CX, y = f.y - CY, a = Math.min(1, f.t * 1.5, (f.max - f.t) * 4);
    ctx.globalAlpha = a * .55; ctx.fillStyle = '#2e5a1c'; ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * .5, 0, 0, 6.283); ctx.fill();
    ctx.globalAlpha = a * .6; ctx.fillStyle = '#79c24e'; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, f.r * .72, f.r * .32, 0, 0, 6.283); ctx.fill();
    ctx.globalAlpha = a; ctx.fillStyle = '#c8f06a'; for (let i = 0; i < 5; i++) { const b = Math.floor(T * 5 + i * 1.7) % 4; ctx.fillRect(Math.round(x + Math.cos(i * 2.4) * f.r * .55), Math.round(y + Math.sin(i * 2.4) * f.r * .22 - b), b ? 2 : 1, b ? 2 : 1); }
    ctx.globalAlpha = 1; addLight(x, y, f.r, .3 * a);
  } else if (f.k === 'meteor') {
    // Schatten am Boden, der Brocken fällt schräg von oben
    const k = clamp(f.t / f.max, 0, 1), x1 = f.x - CX, y1 = f.y - CY, x = x1 + k * 40, y = y1 - 6 - k * 110;
    ctx.globalAlpha = .35 * (1 - k * .6); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x1, y1, 16 - k * 8, 6 - k * 3, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 14, y - 34); ctx.lineTo(x, y); ctx.stroke(); glow(x, y, 14, '255,140,60', .8); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6); ctx.fillStyle = '#ffb03a'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 3, 3); addLight(x, y, 26, 1);
  } else if (f.k === 'vine') {
    const a = Math.min(1, f.t * 2.5), x = Math.round(f.x - CX), y = Math.round(f.y - CY);
    ctx.globalAlpha = a; for (let i = 0; i < 9; i++) { const an = i / 9 * 6.283 + .3, L = f.r * (.5 + (i % 3) * .2) * (1 - f.t / f.max * .5); ctx.strokeStyle = i % 2 ? '#4e9c32' : '#2e6a1e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(an + .6) * L * .5, y + Math.sin(an + .6) * L * .25 - 4, x + Math.cos(an) * L, y + Math.sin(an) * L * .45); ctx.stroke(); ctx.fillStyle = '#c8f06a'; ctx.fillRect(x + Math.round(Math.cos(an) * L) - 1, y + Math.round(Math.sin(an) * L * .45) - 1, 2, 2); }
    ctx.globalAlpha = 1;
  } else if (f.k === 'heart') {
    const x = Math.round(f.x - CX), y = Math.round(f.y - CY - f.z - (1 - q) * 10);
    ctx.globalAlpha = Math.min(1, q * 2); ctx.fillStyle = '#ff6a8a'; ctx.fillRect(x - 2, y, 2, 1); ctx.fillRect(x + 1, y, 2, 1); ctx.fillRect(x - 2, y + 1, 5, 1); ctx.fillRect(x - 1, y + 2, 3, 1); ctx.fillRect(x, y + 3, 1, 1); ctx.fillStyle = '#ffd0dc'; ctx.fillRect(x - 2, y, 1, 1); ctx.globalAlpha = 1;
  } else if (f.k === 'after') {
    const p = petActive(); if (!p) return; const S = petStripOf(p); if (!S.silp) S.silp = silhouette(S.c, PET_EL[PET_SP[p.sp].el].c);
    ctx.save(); ctx.globalAlpha = q * .55; ctx.translate(Math.round(f.x - CX), Math.round(f.y - CY - f.z)); ctx.scale(f.face, 1); ctx.drawImage(S.silp, 4 * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H); ctx.restore();
  }
}
function drawPet() {
  const p = petActive(); if (!p || PET_RT.id !== p.id) return;
  const S = petStripOf(p), st = petStage(p.lv), Sp = PET_SP[p.sp], E = PET_EL[Sp.el], x = Math.round(PET_RT.x - CX), y = Math.round(PET_RT.y - CY), z = Math.round(PET_RT.z), sw = Math.max(4, S.W * .3);
  ctx.globalAlpha = .3 * Math.max(.45, 1 - z / 40); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, sw, sw * .38, 0, 0, 6.283); ctx.fill();
  if (st >= 4) { ctx.globalAlpha = .14 + .07 * Math.sin(T * 4); ctx.fillStyle = st === 5 ? '#ffd24a' : E.c; ctx.beginPath(); ctx.ellipse(x, y, sw * 1.5, sw * .55, 0, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
  const fi = PET_RT.sleep || (PET_RT.blk > 0 && !PET_RT.mv) ? 8 : (PET_RT.mv ? 4 : 0) + ((Math.floor(PET_RT.ph) % 4) + 4) % 4, sq = PET_RT.atk > 0 ? Math.sin(PET_RT.atk / .22 * Math.PI) * .12 : 0;
  ctx.save(); ctx.translate(x, y - z); ctx.scale(PET_RT.face * (1 + sq), 1 - sq);
  if (p.sp === 'katze' || p.mu === 'schatten' || PET_SP[p.sp].art && PET_SP[p.sp].art[1].k === 'geist') ctx.globalAlpha = .88 + .08 * Math.sin(T * 3);
  ctx.drawImage(S.c, fi * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H);
  if (PET_RT.fl > 0) { if (!S.sil) S.sil = silhouette(S.c, '#ffffff'); ctx.globalAlpha = Math.min(1, PET_RT.fl * 1.6) * .85; ctx.drawImage(S.sil, fi * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H); }
  ctx.restore(); ctx.globalAlpha = 1;
  // Goldkäfer leuchtet wie eine Laterne, Feuer und Blitz glühen
  if (Sp.el === 'licht') addLight(x, y - z - S.H * .4, 40 + st * 6, .8 + .1 * Math.sin(T * 3));
  else if (Sp.el === 'feuer' || Sp.el === 'blitz' || st >= 4 || (G && G.dark)) addLight(x, y - z - S.H * .4, 18 + st * 4, Sp.el === 'schatten' || Sp.el === 'gift' ? .35 : .55);
  // Mutationen leuchten: Leuchtpunkte, Glutmähne, Kristall, Gold, Sterne
  if (p.mu === 'leucht' || p.mu === 'glut' || PET_MUT[p.mu] && PET_MUT[p.mu].r === 3 && p.mu !== 'schatten') addLight(x, y - z - S.H * .4, 22 + st * 3, .5);
  if (PET_RT.sleep) { ctx.fillStyle = '#e8f0ff'; for (let i = 0; i < 3; i++) { const t = (T * .5 + i / 3) % 1, zx = x + PET_RT.face * Math.round(S.W * .2) + Math.round(t * 6), zy = y - z - S.ay + 4 - Math.round(t * 14); ctx.globalAlpha = Math.sin(t * Math.PI); ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1); } ctx.globalAlpha = 1; }
}
const PET_DRAW = { y: 0, draw: drawPet };
// Schild-Zauber: goldene Blase um den Helden
const PET_SHD = { y: 0, draw() { if (!P || !(PET_RT.shT > T)) return; const x = Math.round(P.x - CX), y = Math.round(P.y - CY) - 10, a = Math.min(1, (PET_RT.shT - T) * 2) * (.5 + .15 * Math.sin(T * 8)); ctx.globalAlpha = a * .35; ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.ellipse(x, y, 13, 16, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff3a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 13, 16, 0, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; addLight(x, y, 24, .4); } };
// Verletzter Begleiter liegt im Versteck neben dem Brutnest: schläft, Verband um den Bauch
const PET_HURT = { y: 0, x: 0, draw() {
  const p = petSel(); if (!p || !petIsHurt(p)) return;
  const S = petStripOf(p), x = Math.round(this.x - CX), y = Math.round(this.y - CY), w = Math.round(S.W * .5);
  ctx.globalAlpha = .3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, Math.max(4, S.W * .3), 2, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(x, y); ctx.drawImage(S.c, 8 * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H); ctx.restore();
  const by = y - Math.round(S.ay * .45); ctx.fillStyle = '#efe2bf'; ctx.fillRect(x - Math.round(w / 2), by, w, 2); ctx.fillStyle = '#c8463c'; ctx.fillRect(x - 1, by, 2, 2);
  ctx.fillStyle = '#e8f0ff'; for (let i = 0; i < 3; i++) { const t = (T * .45 + i / 3) % 1, zx = x + 4 + Math.round(t * 6), zy = y - S.ay + 2 - Math.round(t * 12); ctx.globalAlpha = Math.sin(t * Math.PI); ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1); }
  ctx.globalAlpha = 1;
} };

/* ---------- Brutnest im Versteck: Nest aus Stroh über glühenden Kohlen, darin die Eier ---------- */
SPEAKERS.gunda = { n: _t('Nestmutter Gunda'), sp: 'lizardf', c: '#ffb878' };
BUILD.brutnest.npc = SPEAKERS.gunda.n; BUILD.brutnest.body = 'lizardf';
NPCTALK.brutnest = [
  [1, 'gunda', _t('Wärme, Futter, Zuwendung. Fehlt eins davon, schläft das Küken im Ei einfach weiter.')],
  [1, 'gunda', _t('Sind alle drei Bedürfnisse gut gefüllt, wächst ein Ei anderthalbmal so schnell.')],
  [1, 'gunda', _t('Streichle die Eier ruhig. Die spüren das. Wirklich.')],
  [2, 'gunda', _t('Aus einem schmutzigen Ei schlüpft meist eine Schnecke. Aber man liebt sie trotzdem.')],
  [4, 'gunda', _t('Ein mythisches Ei braucht Tage. Und Sternenstaub. Und Geduld. Vor allem Geduld.')]
];
let NEST_A = { t: 0, v: null };
// Zustand des Nests höchstens zweimal pro Sekunde neu rechnen
function nestAlertC() { if (!NEST_A.v || T - NEST_A.t > .5 || T < NEST_A.t) { NEST_A.v = nestAlert(); NEST_A.t = T; } return NEST_A.v; }
function eggCr(V) { return V.ready ? 3 : V.q >= .8 ? 2 : V.q >= .5 ? 1 : 0; }
function drawNest(o, x, y, r) {
  const f = Math.floor(T * 6);
  r(-10, -3, 20, 3, '#4a4450'); r(-9, -3, 18, 1, '#6a6470'); r(-8, -4, 16, 1, f % 3 ? '#c8402a' : '#ff6a2a'); r(-5 + f % 4, -4, 2, 1, '#ffb03a');
  r(-15, -11, 30, 7, '#6a4224'); r(-14, -12, 28, 2, '#8a5a32');
  const eggs = nestEggs();
  [2, 0, 1].forEach(i => { const g = eggs[i]; if (!g) return;
    const V = eggView(g), c = eggMini(g.tier, eggCr(V)), ex = [-7, 7, 0][i] || 0, ey = i === 2 ? -11 : -7, wob = V.ready ? Math.sin(T * 14 + i) * .2 : 0;
    if (wob) { ctx.save(); ctx.translate(x + ex, y + ey); ctx.rotate(wob); ctx.drawImage(c, -6, -14); ctx.restore(); } else ctx.drawImage(c, x + ex - 6, y + ey - 14);
  });
  r(-16, -7, 32, 4, '#a8743e'); r(-15, -8, 30, 1, '#c8945a');
  for (let i = 0; i < 9; i++) r(-14 + i * 3 + (i % 2), -7 + (i % 3 === 0 ? 1 : 0), 2, 1, i % 2 ? '#e8c070' : '#d8a850');
  r(-16, -4, 2, 1, '#e8c070'); r(13, -5, 3, 1, '#e8c070');
  addLight(x, y - 8, 34, .55 + .1 * Math.sin(T * 3));
  const A = nestAlertC(), pulse = Math.floor(T * 3) % 2;
  if (A.ready) { r(-1, -35, 3, 6, '#ffd24a'); r(-1, -28, 3, 2, '#ffd24a'); }
  else if (A.need) { r(-1, -35, 3, 6, pulse ? '#ff6a5a' : '#c8463c'); r(-1, -28, 3, 2, pulse ? '#ff6a5a' : '#c8463c'); }
}
// Kleine Pixel-Symbole: Wärme, Futter, Zuwendung (Herz), Korb
const NEST_IC = {};
function nestIcon(k) {
  if (NEST_IC[k]) return NEST_IC[k];
  const b = PB(12, 12);
  if (k === 'w') { b.disc(6, 7.5, 3.4, '#ff6a2a'); b.disc(6, 8.5, 2, '#ffb03a'); b.rect(5, 2, 2, 4, '#ff6a2a'); b.set(4, 3, '#ffb03a'); b.set(8, 4, '#ff6a2a'); b.set(6, 8, '#fff0a0'); }
  else if (k === 'f') { b.rect(2, 7, 8, 3, '#8a5a32'); b.rect(1, 6, 10, 2, '#b07a48'); b.rect(3, 4, 6, 2, '#e8c070'); b.set(4, 3, '#e8c070'); b.set(7, 3, '#ffe08a'); b.set(5, 4, '#ffe08a'); }
  else if (k === 'z') { b.rect(2, 3, 3, 2, '#ff6a8a'); b.rect(7, 3, 3, 2, '#ff6a8a'); b.rect(1, 4, 10, 3, '#ff6a8a'); b.rect(2, 7, 8, 1, '#ff6a8a'); b.rect(3, 8, 6, 1, '#ff6a8a'); b.rect(4, 9, 4, 1, '#ff6a8a'); b.rect(5, 10, 2, 1, '#ff6a8a'); b.set(3, 4, '#ffd0dc'); b.set(2, 5, '#ffd0dc'); }
  return NEST_IC[k] = pbCanvas(pbOutline(b)).toDataURL();
}
HOOK.drawStation.push(petSafe('nest', (o, x, y, r) => { if (o.id === 'brutnest') drawNest(o, x, y, r); }));
HOOK.artIcon.push(petSafe('icon', (name, b) => {
  if (name !== 'nest') return;
  for (let y = 2; y < 12; y++) for (let x = 4; x < 12; x++) { const dx = (x + .5 - 8) / 3.4, dy = (y + .5 - 7.6) / (y < 7 ? 5 : 4.4); if (dx * dx + dy * dy <= 1) b.set(x, y, dx + dy * .8 > .45 ? '#c8b898' : '#efe2bf'); }
  b.set(6, 4, '#fff'); b.set(6, 5, '#fff'); b.set(9, 6, '#b08a5a'); b.set(7, 8, '#b08a5a');
  b.rect(1, 10, 14, 3, '#8a5a32'); b.rect(2, 13, 12, 1, '#6a4224'); b.rect(0, 9, 16, 2, '#b07a48'); for (const x of [1, 4, 8, 11, 14]) b.set(x, 9, '#e8c070'); b.set(6, 11, '#e8c070'); b.set(12, 12, '#e8c070');
}));

/* ---------- Andockstellen ---------- */
const PET_UI = { fed: 0, petT: 0, petId: null, introQ: false, rel: null }, PET_ERR = {};
// Ein Fehler im Begleiter darf das Spiel nie anhalten: einmal melden (Tests sehen ihn), dann weiter
function petSafe(k, fn, def) { return (...a) => { try { return fn(...a); } catch (e) { if (!PET_ERR[k]) { PET_ERR[k] = 1; console.error('Begleiter (' + k + '):', e); } return def; } }; }
HOOK.update.push(petSafe('update', dt => petTick(dt)));
HOOK.room.push(petSafe('room', () => petPlace(false)));
HOOK.kill.push(petSafe('kill', petKill));
// Passivkraft, dazu Talente/Ausrüstung/Mutation für den Helden und zwei Gene (Zähigkeit → LP, Glück → Beute)
HOOK.stats.push(petSafe('stats', add => {
  const p = petActive(); if (!p) return; const v = petPas(p); for (const k in v) add(k, v[k]);
  const m = petMods(p); for (const k in m) if (!PET_INK.has(k)) add(k, m[k]);
  add('hp', petGene(p, 2) / 100 * .04); add('loot', petGene(p, 4) / 100 * .03);
}));
// Giftzahn der Natter: Treffer des Helden vergiften manchmal
HOOK.afterHit.push(petSafe('afterHit', (e, w, dmg) => { if (!e || e.dead || (w && w.pet)) return; const c = mod('pgift'); if (c && Math.random() < c) { e.poison = Math.max(e.poison || 0, 3); e.poisonDmg = Math.max(e.poisonDmg || 0, Math.max(1, Math.round(dmg * .2))); } }));
HOOK.draw.push(petSafe('draw', list => {
  const M = petM(); if (!M || !P) return;
  // erstes Ei (oder erstes Ei seit dem Brutnest): Gunda erklärt es auf der Weltkarte
  if (M.intro === false && M.eggs.length && !PET_UI.introQ && state === 'map' && !ov.hidden && $('mapcv') && !DLG) { PET_UI.introQ = true; setTimeout(petIntro, 0); }
  const sel = petSel();
  if (sel && petIsHurt(sel) && G && G.type === 'versteck' && typeof hidePos === 'function') { const h = hidePos('brutnest'); PET_HURT.x = h.x - 26; PET_HURT.y = h.y + 3; list.push(PET_HURT); }
  const p = petActive(); if (!p) return;
  if ((state === 'title' || state === 'map' || state === 'menu') && T > PET_RT.lt) petTick(Math.min(.05, T - PET_RT.lt));
  if (PET_RT.id !== p.id) return;
  PET_DRAW.y = PET_RT.y; list.push(PET_DRAW); if (PET_RT.shT > T && P) { PET_SHD.y = P.y + .5; list.push(PET_SHD); }
  for (const b of PET_BOLTS) list.push(b);
  for (const f of PET_FX) list.push(f);
}));
HOOK.activate.push(petSafe('activate', () => petCwPay()));
HOOK.station.push(petSafe('openst', (h, id) => { if (h || id !== 'brutnest') return h; openNest('hide'); return true; }, false));
// Beim Start: kurzer Hinweis, wenn im Nest etwas zu tun ist
HOOK.boot.push(petSafe('boot', () => {
  const M = petM(); if (!M || !SAVE.chars.length || !nestEggs().length) return;
  const A = nestAlert();
  if (A.ready) toast(A.ready === 1 ? _t('Brutnest: Ein Ei ist bereit zum Schlüpfen!') : _t('Brutnest: {n} Eier sind bereit zum Schlüpfen!', { n: A.ready }), '#ffd24a');
  else if (A.need) toast(A.need === 1 ? _t('Brutnest: Ein Ei braucht dich – es wächst gerade nicht.') : _t('Brutnest: {n} Eier brauchen dich – sie wachsen gerade nicht.', { n: A.need }), '#ff8a5a');
}));
function nestBtn(back) {
  const M = petM(); if (!M || !petHero() || (!M.eggs.length && !M.list.length)) return '';
  const A = nestAlert();
  return `<button class="btn${A.ready || A.need ? '' : ' alt'}" data-act="nestopen" data-id="${back}"${A.ready || A.need ? ' style="order:-1"' : ''}>${_t('Brutnest')}${A.ready ? `<span class="badge">${_t('BEREIT')}</span>` : A.need ? ' (!)' : ''}</button>`;
}
HOOK.titleBtns.push(petSafe('title', () => nestBtn('title'), ''));
HOOK.mapMore.push(petSafe('map', () => nestBtn('map'), ''));
function petIntro() {
  PET_UI.introQ = false;
  const M = petM(); if (!M || M.intro !== false || !M.eggs.length || state !== 'map' || DLG) return;
  M.intro = true; persist(); setState('menu');
  const first = !M.list.length && !M.hatched;
  dialog(first ? [['gunda', M.fromBoss ? _t('Ein Ei! Das hast du dem Boss abgenommen? Bring es zu mir ins Brutnest – ich wohne jetzt im Versteck.') : _t('Ein Ei! Wo hast du das denn gefunden? Bring es zu mir ins Brutnest – ich wohne jetzt im Versteck.')], ['gunda', _t('Halt es warm, füttere es und schenk ihm Zuwendung. Dann wächst es – auch während du unterwegs bist.')], ['gunda', _t('Irgendwann schlüpft daraus dein erster Begleiter. Komm, ich zeig dir das Nest.')]]
    : [['gunda', _t('Ich bin Gunda und kümmere mich ab jetzt um das Brutnest im Versteck.')], ['gunda', _t('Eier schlüpfen nicht mehr von allein: Halt sie warm, füttere sie und schenk ihnen Zuwendung. Dann wachsen sie, auch während du unterwegs bist.')]],
  () => openNest('map'), first ? _t('DEIN ERSTES EI') : _t('NEU: DAS BRUTNEST'));
}

/* ---------- Oberfläche ---------- */
document.head.insertAdjacentHTML('beforeend', '<style>' +
  '.petcard{display:flex;flex-wrap:wrap;gap:12px;align-items:center}' +
  '.petprev{flex:none;position:relative;display:flex;align-items:flex-end;justify-content:center;background:radial-gradient(ellipse at 50% 78%,var(--pg) 0,var(--stone-lo) 72%);box-shadow:inset 0 0 0 2px var(--stone-hi)}' +
  '.petprev:after{content:"";position:absolute;left:27%;right:27%;bottom:10px;height:8px;background:rgba(0,0,0,.35);border-radius:50%}' +
  '.petprev .spr,.pcard .spr{position:relative;z-index:1;margin:0 0 14px;animation:petan .8s steps(4) infinite}' +
  '.petprev .spr.fly,.pcard .spr.fly{margin-bottom:30px;animation:petan .45s steps(4) infinite,petbob 1.8s ease-in-out infinite}' +
  '.petprev.yum .spr{animation:petan .8s steps(4) infinite,petyum .5s ease-out 1}' +
  '.petprev.hurt .spr{animation:none;filter:saturate(.5) brightness(.8)}' +
  '@keyframes petan{from{background-position-x:0}to{background-position-x:var(--to)}}' +
  '@keyframes petbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
  '@keyframes petyum{0%{transform:none}40%{transform:translateY(-14px) scale(1.1)}100%{transform:none}}' +
  '.petinfo{flex:1 1 190px;min-width:0}.petnm{font-size:28px;line-height:1;overflow-wrap:anywhere}' +
  '.pel{display:inline-block;font-family:var(--f-display);font-size:7px;padding:4px 5px;color:var(--night);vertical-align:2px}' +
  '.ptier{display:inline-block;font-family:var(--f-display);font-size:7px;padding:4px 5px;color:var(--night);vertical-align:2px;background:var(--tc)}' +
  '.pbar{height:9px;background:var(--night);box-shadow:0 0 0 2px var(--stone-hi);margin:8px 0 4px}.pbar i{display:block;height:100%;background:var(--c,#8a7ad8);transition:width .4s}.pbar.thin{height:5px;margin-top:9px}' +
  '.slot:disabled{opacity:.35;cursor:default}.slot.fav{box-shadow:inset 0 0 0 2px #ff8aa8}.sw:disabled{opacity:.3;cursor:default}' +
  '.row.lock{opacity:.5}.row .ic.plv{font-family:var(--f-display);font-size:7px;line-height:1.6;text-align:center;color:var(--gold)}' +
  '.ic.wob img{animation:petwob 1s ease-in-out infinite}@keyframes petwob{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}' +
  '.phurt{color:#ff8a7a;font-size:17px;margin:6px 0 0}' +
  '.pbag{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px}.pbag>span{height:52px;display:grid;place-items:center;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi);position:relative}.pbag>span img{width:36px;height:36px;object-fit:contain;image-rendering:pixelated}.pbag>span b{position:absolute;right:3px;bottom:1px;font-size:14px;font-weight:400}.pbag>span.free{opacity:.45}' +
  /* Brutnest */
  '.nsum{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;align-items:center;margin-bottom:8px;box-shadow:inset 3px 0 0 var(--sc,var(--stone-hi))}.nsum>img{width:36px;height:36px;image-rendering:pixelated}.nsum b{font-size:20px;font-weight:400;line-height:1.05}.nsum .sub{margin:2px 0 0;font-size:16px}.nsum .menu{grid-column:1/-1;margin:4px 0 0;display:flex;gap:6px;flex-wrap:wrap}.nsum .menu .btn{flex:1 1 150px}' +
  '@media (min-width:640px){.nsum{grid-template-columns:auto minmax(0,1fr) auto}.nsum .menu{grid-column:auto;margin:0;flex-wrap:nowrap}.nsum .menu .btn{flex:none}}@media (max-height:500px){.nestscr>.say{display:none}}' +
  '.nests{display:grid;gap:8px}@media (min-width:640px){.nests{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
  '.ncard{position:relative;display:grid;grid-template-columns:76px minmax(0,1fr);gap:2px 10px;background:var(--stone-lo);padding:8px;box-shadow:inset 0 0 0 2px var(--tc);min-width:0}' +
  '.ncard.rdy{background:linear-gradient(180deg,rgba(255,210,74,.16),var(--stone-lo) 60%)}' +
  '.ntop{grid-column:1/-1;display:flex;align-items:center;gap:6px;min-height:28px}.ntop b{flex:1;font-family:var(--f-display);font-weight:400;font-size:8px;color:var(--tc);line-height:1.4}' +
  '.negg{grid-row:span 3;align-self:start;position:relative;width:76px;height:88px;border:0;padding:0;background:radial-gradient(ellipse at 50% 85%,rgba(255,170,80,.28),transparent 68%);cursor:pointer;display:flex;align-items:flex-end;justify-content:center}' +
  '.negg .e{width:60px;height:72px;image-rendering:pixelated;transform-origin:50% 95%}.negg.wob .e{animation:nwob .7s ease-in-out infinite}.negg.idle .e{animation:nbre 3s ease-in-out infinite}.negg.tap .e{animation:ntap .35s ease-out 1}' +
  '.negg .hrt{position:absolute;left:50%;top:6px;width:24px;height:24px;margin-left:-12px;image-rendering:pixelated;animation:nhrt .9s ease-out 1 forwards;opacity:0}' +
  '@keyframes nwob{0%,100%{transform:rotate(0)}20%{transform:rotate(-9deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-5deg)}80%{transform:rotate(3deg)}}' +
  '@keyframes nbre{0%,100%{transform:scale(1)}50%{transform:scale(1.03,.98)}}@keyframes ntap{0%{transform:scale(1)}35%{transform:scale(1.12,.9)}100%{transform:scale(1)}}' +
  '@keyframes nhrt{0%{opacity:1;transform:translateY(10px) scale(.6)}60%{opacity:1}100%{opacity:0;transform:translateY(-14px) scale(1.2)}}' +
  '.nq{font-size:16px;color:var(--parch)}.nst{font-size:16px;line-height:1.05}.nst.ok{color:var(--moss)}.nst.bad{color:#ff8a7a}.nst.gd{color:var(--gold)}' +
  '.nmet{display:grid;grid-template-columns:14px minmax(0,1fr) 54px;gap:5px;align-items:center;font-size:15px;color:var(--parch-dim);margin-top:3px}.nmet img{width:14px;height:14px;image-rendering:pixelated}.nmet .pbar{margin:0;height:6px}.nmet span{text-align:right;white-space:nowrap}.nmet.e span{color:#ff8a7a}' +
  '.nacts{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}.nacts .btn{padding-left:2px;padding-right:2px;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.nacts .btn small{font-family:var(--f-body);font-size:15px;line-height:1;display:flex;align-items:center;gap:2px}.nacts .btn small img{width:14px;height:14px;image-rendering:pixelated}.nacts .btn small.bad{color:#ff8a7a}' +
  '.nacts .btn.hatch{grid-column:1/-1;animation:pulse2 .8s steps(2) infinite}@media (min-width:640px){.nacts .btn.sm{font-size:7px}}' +
  '.nfree{grid-column:1/-1;text-align:center;color:var(--parch-dim);font-size:17px;padding:8px 6px;line-height:1.1}' +
  '.ncol{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}@media (min-width:640px){.ncol{grid-template-columns:repeat(12,minmax(0,1fr))}}' +
  '.ncol>span{aspect-ratio:1;display:grid;place-items:center;background:var(--night);box-shadow:inset 0 -3px 0 var(--tc)}.ncol img{width:84%;height:84%;object-fit:contain;image-rendering:pixelated}' +
  '.ntier{display:grid;gap:4px}@media (min-width:640px){.ntier{grid-template-columns:repeat(2,minmax(0,1fr))}}.ntier>div{background:var(--stone-lo);padding:6px 8px;box-shadow:inset 3px 0 0 var(--tc);font-size:16px;line-height:1.1;color:var(--parch-dim)}.ntier b{display:block;font-family:var(--f-display);font-weight:400;font-size:7px;color:var(--tc);margin-bottom:3px}' +
  /* Schlüpfen */
  '.hatch{text-align:center}.hatch canvas{display:block;width:min(100%,400px);margin:4px auto 0;image-rendering:pixelated;aspect-ratio:4/3;cursor:pointer}' +
  '.hres{min-height:150px}.hres h2{margin:6px 0 2px;font-size:20px}.hres .kv{margin:8px 0 4px}' +
  '@media (max-height:520px) and (min-width:560px){.hatch{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:4px 16px;align-items:center}.hatch>h2{grid-column:1/-1;margin:0}.hatch canvas{width:100%;height:auto;max-height:calc(100dvh - 110px);object-fit:contain;margin:0}.hres{min-height:0}}' +
  '@media (prefers-reduced-motion:reduce){.petprev .spr,.pcard .spr,.ic.wob img,.negg .e{animation-duration:1.6s!important}}' +
  /* Kreaturen 2.0: Unterbereiche, Begleiter-Raster, Gene, Ausrüstung, Magie, Zucht */
  '.psub{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:10px 0 8px}@media (min-width:700px){.psub{grid-template-columns:repeat(6,minmax(0,1fr))}}' +
  '.psub .opt{min-height:44px;min-width:0;padding:6px 2px;font-size:8px;margin:0;position:relative}.psub .opt em{position:absolute;right:3px;top:3px;font-style:normal;color:var(--gold);font-size:7px}' +
  '.pnav{display:flex;gap:6px;align-items:center}.pnav .btn{min-width:44px;min-height:44px;padding-left:6px;padding-right:6px}' +
  '.pmini{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;margin-bottom:8px}.pmini .pmi{width:88px;height:66px;display:flex;align-items:flex-end;justify-content:center;background:radial-gradient(ellipse at 50% 80%,var(--stone-hi) 0,var(--stone-lo) 72%)}.pmini .spr{margin:0 0 4px;animation:petan .8s steps(4) infinite}' +
  '.psub{margin-top:0}' +
  '.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:5px}.pgrid button{position:relative;height:58px;border:0;padding:0;background:var(--night);box-shadow:inset 0 -3px 0 var(--tc);cursor:pointer;display:grid;place-items:center;color:inherit}' +
  '.pgrid button.sel{box-shadow:inset 0 0 0 3px var(--gold)}.pgrid button.selb{box-shadow:inset 0 0 0 3px #ff8aa8}.pgrid button.off img{opacity:.4}.pgrid img{max-width:46px;max-height:46px;image-rendering:pixelated}' +
  '.pgrid b{position:absolute;right:3px;bottom:4px;font-family:var(--f-display);font-weight:400;font-size:6px;color:var(--parch);text-shadow:1px 1px 0 #000}.pgrid i{position:absolute;left:4px;top:4px;width:7px;height:7px;background:var(--moss)}.pgrid i.cd{background:#ff8a7a}.pgrid u{position:absolute;right:3px;top:2px;text-decoration:none;color:#ff9af0;font-size:13px}' +
  '.pgene{display:grid;grid-template-columns:92px minmax(0,1fr) 30px 24px;gap:2px 6px;align-items:center;font-size:17px;margin:5px 0}.pgene .pbar{margin:0}.pgene b{font-family:var(--f-display);font-weight:400;font-size:9px;text-align:center}.pgene small{grid-column:2/-1;font-size:15px;color:var(--parch-dim);line-height:1.05}' +
  '.pcards{display:grid;gap:6px}@media (min-width:640px){.pcards{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
  '.pslot{background:var(--stone-lo);padding:8px;box-shadow:inset 3px 0 0 var(--rc,var(--stone-hi));display:grid;grid-template-columns:40px minmax(0,1fr);gap:4px 8px;align-items:start;min-width:0}.pslot>img{width:40px;height:40px;image-rendering:pixelated}.pslot .nm{font-size:18px;line-height:1.05;overflow-wrap:anywhere}.pslot .st{font-size:15px;color:var(--parch-dim);line-height:1.1}.pslot .acts{grid-column:1/-1;justify-content:flex-start;margin:2px 0 0;flex-wrap:wrap}.pslot.lock{opacity:.5}' +
  '.plines{margin:3px 0 0;padding:0;list-style:none;font-size:16px;line-height:1.15}.plines li{color:#9ad8ff}.plines li.up{color:var(--moss)}.plines li.dn{color:#ff8a7a}' +
  '.pmut{display:flex;flex-wrap:wrap;gap:5px}.pmut span{font-size:15px;padding:4px 7px;background:var(--night);box-shadow:inset 0 0 0 2px var(--mc);color:var(--parch)}.pmut span.no{opacity:.45;box-shadow:inset 0 0 0 2px var(--stone-hi)}' +
  '.pbr{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:6px;align-items:center;text-align:center;margin:6px 0}.pbr>div{background:var(--night);padding:6px 4px;min-height:84px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:15px;line-height:1.05;min-width:0;overflow-wrap:anywhere}.pbr img{max-width:52px;max-height:48px;image-rendering:pixelated}.pbr>b{font-family:var(--f-display);font-weight:400;font-size:12px;color:#ff8aa8}' +
  '.pout{display:grid;gap:3px;margin:4px 0}.pout div{display:flex;justify-content:space-between;gap:8px;font-size:16px;background:var(--stone-lo);padding:4px 8px}.pout b{font-weight:400;color:var(--gold)}' +
  '.ptree .tal small{font-size:15px}.ptree .tal .req{display:block;color:#ff8a7a;font-size:14px;margin-top:2px}' +
  '</style>');
let petView = null, petAmt = 1, petRen = false, petRel = false;
function petViewed() { const M = petM(); return (M && (M.list.find(x => x.id === petView) || petSel() || M.list[0])) || null; }
function petSprHTML(U, sc, fly) { return `<i class="spr${fly ? ' fly' : ''}" style="width:${U.W * sc}px;height:${U.H * sc}px;background-image:url(${U.url});background-size:${U.W * 4 * sc}px ${U.H * sc}px;--to:-${U.W * 4 * sc}px"></i>`; }
const PET_PASTXT = {
  dmg: v => _t('+{v} Schaden', { v: pct(v) }), critdmg: v => _t('+{v} Krit-Schaden', { v: pct(v) }), gold: v => _t('+{v} Gold', { v: pct(v) }), loot: v => _t('+{v} Beute', { v: pct(v) }), xp: v => _t('+{v} Erfahrung', { v: pct(v) }),
  pgift: v => _t('{v} Giftchance bei deinen Treffern', { v: pct(v) }), aspd: v => _t('+{v} Angriffstempo', { v: pct(v) }), hp: v => _t('+{v} Lebenspunkte', { v: pct(v) }), def: v => _t('+{v} Verteidigung', { v: Math.round(v) }),
  dodge: v => _t('+{v} Ausweichen', { v: pct(v) }), regen: v => _t('+{v} LP pro Sekunde', { v: v.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) }), dr: v => _t('+{v} Schadensminderung', { v: pct(v) }),
  leech: v => _t('+{v} Lebensraub', { v: pct(v) }), crit: v => _t('+{v} Krit-Chance', { v: pct(v) }), spd: v => _t('+{v} Lauftempo', { v: pct(v) })
};
function petPasText(v) { const r = []; for (const k in v) r.push(PET_PASTXT[k](v[k])); return r.join(', '); }
// Dauer kurz: 45 min · 2 h 10 min · 3 T 4 h
function petDur(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m < 60) return _t('{n} min', { n: Math.max(1, m) });
  if (m < 600) return m % 60 ? _t('{h} h {m} min', { h: Math.floor(m / 60), m: m % 60 }) : _t('{h} h', { h: Math.floor(m / 60) });
  return _t('{h} h', { h: Math.round(m / 60) });
}
// sehr kurz für die Bedürfnis-Leisten: 45 min · 7:12 h
function petDurS(ms) { const m = Math.max(0, Math.ceil(ms / 60000)); return m < 60 ? _t('{n} min', { n: Math.max(1, m) }) : Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ' h'; }
function petClock(ms) { return new Date(Date.now() + ms).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }); }
function tierPill(t) { return `<span class="ptier" style="--tc:${PET_TIERS[t].c}">${PET_TIERS[t].n}</span>`; }

/* Charakter-Reiter BEGLEITER */
function petBagHTML(p) {
  const n = petBagSize(p), bag = p.bag || [];
  let cells = bag.map(e => `<span title="${esc(petLootName(e))}"><img src="${petLootIcon(e)}" alt="">${e.n > 1 ? `<b>${fmt(e.n)}</b>` : ''}</span>`).join('');
  for (let i = bag.length; i < n; i++) cells += '<span class="free"></span>';
  return `<h3>${_t('BEUTEL {n}/{max}', { n: bag.length, max: n })}</h3><p class="sub" style="margin-top:0">${_t('Fällst du in den Verlorenen Landen, rettet dein Begleiter, was in seinem Beutel liegt. Seltenere Arten tragen mehr, das Talent „Große Taschen“ gibt weitere Plätze.')}</p><div class="pbag">${cells}</div>${bag.length ? `<div class="acts" style="justify-content:flex-start;margin-top:6px"><button class="btn alt sm" data-act="petbag" data-id="${p.id}">${_t('Alles herausnehmen')}</button></div>` : ''}`;
}
function petHurtHTML(p) {
  if (!petIsHurt(p)) return '';
  const pot = petHero() && P.potions > 0, mat = petHero() && (P.mats[PET_HEALMAT[0]] || 0) >= PET_HEALMAT[1];
  return `<div class="phurt">${_t('Verletzt – ruht sich im Versteck aus. Wieder fit in {t}.', { t: petDur(petHurtLeft(p)) })}</div><div class="acts" style="justify-content:flex-start;margin-top:6px"><button class="btn sm" data-act="petheal" data-id="${p.id}" data-i="0" ${pot ? '' : 'disabled'}>${_t('Heiltrank geben')}</button><button class="btn alt sm" data-act="petheal" data-id="${p.id}" data-i="1" ${mat ? '' : 'disabled'}>${_t('Heilbrei ({n}× {mat})', { n: PET_HEALMAT[1], mat: MATS[PET_HEALMAT[0]].n })}</button></div>`;
}
// kurze Übersicht der Eier im Nest (für den Reiter)
function petNestHTML(M) {
  const eggs = M.eggs;
  const rows = eggs.map(g => { const V = eggView(g), T0 = PET_TIERS[g.tier]; return `<div class="row" style="cursor:default"><div class="ic${V.ready ? ' wob' : ''}"><img src="${eggURL(g.tier, eggCr(V))}" alt=""></div><div><div class="nm" style="color:${T0.c}">${T0.egg}</div><div class="pbar" style="--c:${T0.c};margin:5px 0 3px"><i style="width:${(V.q * 100).toFixed(1)}%"></i></div><div class="st">${!g.nest ? _t('Ruht im Korb') : V.ready ? _t('Bereit zum Schlüpfen!') : V.grow ? _t('Wächst · noch {t} Pflege', { t: petDur(V.rest * 1000 / (V.cozy ? EGG_BONUS : 1)) }) : _t('Pausiert – braucht Pflege')}</div></div><span></span></div>`; }).join('');
  return `<h3>${_t('EIER {n}/{max}', { n: eggs.length, max: EGG_MAX })}</h3>${rows || `<p class="sub" style="margin-top:0">${_t('Noch keine Eier. Das erste gibt es vom ersten Boss der Geschichte, weitere von Bossen, der Drachentruhe, aus den Verlorenen Landen und vom Basar.')}</p>`}${petHero() ? `<div class="menu" style="margin-top:6px"><button class="btn${nestAlert().ready || nestAlert().need ? '' : ' alt'}" data-act="nestopen" data-id="char">${_t('Zum Brutnest')}</button></div>` : ''}`;
}
function petColHTML() {
  const M = petM(), wild = PET_ORDER.filter(sp => !PET_SP[sp].hy), n = M.seen.length, nx = PET_CW.find(([k]) => k > n), nh = PET_HY.filter(sp => M.seen.includes(sp)).length;
  const cell = sp => { const S = PET_SP[sp], seen = M.seen.includes(sp); return `<span class="${seen ? '' : 'no'}" style="--tc:${PET_TIERS[S.t].c}" title="${seen ? esc(S.n) : '???'}" aria-label="${seen ? esc(S.n) : '???'}"><img src="${seen ? petImgURL(sp, 0, 0, false, false).url : petSilURL(sp)}" alt=""></span>`; };
  return `<h3>${_t('SAMMLUNG {n}/{max}', { n, max: PET_ORDER.length })}</h3>${nx ? `<div class="pbar thin" style="--c:var(--gold);margin-top:0"><i style="width:${(n / nx[0] * 100).toFixed(1)}%"></i></div><p class="sub" style="margin:2px 0 6px">${_t('Nächste Belohnung: {n} Arten entdeckt → +{c} Glücksmünzen', { n: nx[0], c: nx[1] })}</p>` : `<p class="sub" style="margin:0 0 6px">${_t('Alle Arten entdeckt!')}</p>`}<div class="ncol">${wild.map(cell).join('')}</div>
  <h3>${_t('HYBRIDE {n}/{max}', { n: nh, max: PET_HY.length })}</h3><p class="sub" style="margin:0 0 6px">${_t('Gibt es nur aus der Zucht – das Zuchtbuch verrät, wer zusammenpasst.')}</p><div class="ncol">${PET_HY.map(cell).join('')}</div>`;
}
/* ---------- Kreaturen 2.0: Symbole für Ausrüstung und Runen ---------- */
const PET_GCOL = [['#6a4224', '#8a5a32', '#b07a48'], ['#4a505c', '#7a828e', '#a8b0bc'], ['#8a8a96', '#c8c8d4', '#ffffff'], ['#2a4a8a', '#4a8ad8', '#9ad0ff'], ['#9c6a24', '#e8b04a', '#fff0a0']];
function petGearIconURL(it) {
  const g = clamp(Math.floor((it.lv - 1) / 20), 0, 4), key = 'pg' + it.s + g + it.r; if (PET_URLS[key]) return PET_URLS[key];
  const b = PB(16, 16), [c0, c1, c2] = PET_GCOL[g], rc = RAR[it.r].c;
  if (it.s === 'h') { for (let a = 0; a < 6.283; a += .2) { b.set(8 + Math.cos(a) * 6, 6 + Math.sin(a) * 3.5, a > 3.3 && a < 6 ? c2 : c1); b.set(8 + Math.cos(a) * 5, 6 + Math.sin(a) * 2.6, c0); } for (const x of [3, 6, 10, 13]) b.set(x, 8, c2); b.rect(7, 10, 3, 2, c1); b.disc(8.5, 13, 2, rc); b.set(8, 12, '#ffffff'); }
  else if (it.s === 'p') { b.rect(3, 3, 10, 11, c1); b.rect(3, 3, 10, 2, c2); b.rect(1, 4, 3, 4, c1); b.rect(12, 4, 3, 4, c1); b.rect(6, 2, 4, 2, '#1a1420'); for (let y = 6; y < 14; y += 3) b.rect(4, y, 8, 1, c0); b.rect(7, 6, 2, 6, rc); b.set(7, 6, '#ffffff'); }
  else { b.line(4, 1, 8, 7, c1); b.line(12, 1, 8, 7, c1); [1, 3, 5, 7, 7, 5, 3, 1].forEach((w, r) => b.rect(8 - Math.ceil(w / 2), 7 + r, w, 1, r < 3 ? c2 : rc)); b.set(7, 9, '#ffffff'); b.set(8, 8, c0); }
  return PET_URLS[key] = pbCanvas(pbOutline(b, '#140f1a')).toDataURL();
}
const PET_GLYPH = { feuerball: [[8, 4], [6, 7], [10, 7], [7, 10], [9, 10], [8, 8]], heilung: [[8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9], [8, 10], [5, 7], [6, 7], [7, 7], [9, 7], [10, 7], [11, 7]], schild: [[5, 4], [11, 4], [5, 5], [11, 5], [5, 6], [11, 6], [6, 8], [10, 8], [7, 9], [9, 9], [8, 10], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4]], blitz: [[9, 3], [8, 4], [7, 5], [6, 6], [7, 7], [8, 7], [9, 7], [10, 8], [9, 9], [8, 10], [7, 11]], frostnova: [[8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9], [8, 10], [8, 11], [5, 5], [6, 6], [10, 8], [11, 9], [11, 5], [10, 6], [6, 8], [5, 9]], gift: [[7, 4], [8, 4], [9, 4], [6, 5], [10, 5], [6, 6], [10, 6], [7, 7], [9, 7], [8, 9], [8, 10]], meteor: [[10, 4], [9, 5], [8, 6], [6, 8], [7, 8], [5, 9], [6, 9], [7, 9], [6, 10], [4, 3], [5, 4], [3, 5]], ranken: [[5, 11], [6, 10], [7, 9], [8, 8], [8, 7], [9, 6], [10, 5], [10, 4], [6, 7], [7, 7], [10, 8], [11, 8]] };
function petRuneIconURL(k) {
  const key = 'rn' + k; if (PET_URLS[key]) return PET_URLS[key];
  const b = PB(16, 16), Z = PET_SPELL[k], E = PET_EL[Z ? Z.el : 'licht'];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = (x + .5 - 8) / 6.3, dy = (y + .5 - 7.6) / 6.6, d = dx * dx + dy * dy; if (d <= 1) b.set(x, y, dx + dy * .8 > .35 ? '#4a4458' : dx + dy < -.6 ? '#9a94aa' : '#6e6880'); }
  for (const [x, y] of PET_GLYPH[k] || []) b.set(x, y, E.c2); for (const [x, y] of (PET_GLYPH[k] || []).slice(0, 3)) b.set(x, y, '#ffffff');
  return PET_URLS[key] = pbCanvas(pbOutline(b, '#140f1a')).toDataURL();
}
/* ---------- Texte für Werte, Gene, Ausrüstung ---------- */
const PET_GTXT = {
  pdmg: v => _t('+{v} Schaden des Begleiters', { v: pct(v) }), pcrit: v => _t('+{v} Krit-Chance des Begleiters', { v: pct(v) }), paspd: v => _t('+{v} Angriffstempo des Begleiters', { v: pct(v) }),
  pel: v => _t('+{v} Element-Wirkung (Brand, Frost)', { v: pct(v) }), pmag: v => _t('+{v} Zauberkraft', { v: pct(v) }), pmcd: v => _t('Zauber {v} schneller bereit', { v: pct(v) }), pspec: v => _t('Spezialangriff {v} schneller bereit', { v: pct(v) }),
  pheal: v => _t('Heil- und Schildzauber +{v}', { v: pct(v) }), pwund: v => _t('Verletzungen {v} kürzer', { v: pct(v) }), pmagr: v => _t('+{v} Reichweite des Beutemagneten', { v: pct(v) }),
  pbag: v => _t('+{v} Beutelplatz', { v: Math.round(v) }), pegg: v => _t('+{v} Chance auf Monster-Eier, Runen und Ausrüstung', { v: pct(v) })
};
function petStatTxt(k, v) { return (PET_GTXT[k] || PET_PASTXT[k] || (x => k + ' ' + x))(v); }
function petNum(v) { return v.toLocaleString(LOCALE, { maximumFractionDigits: 2 }); }
function petGeneTxt(p, i) {
  switch (i) {
    case 0: return _t('Schaden ×{k}', { k: petNum(petGeneK(p, 0, .85, .3)) });
    case 1: return _t('Angriffstempo ×{k}', { k: petNum(petGeneK(p, 1, .9, .2)) });
    case 2: return _t('Verletzungen ×{k} · +{v} LP für dich', { k: petNum(petGeneK(p, 2, 1.15, -.3)), v: pct(petGene(p, 2) / 100 * .04) });
    case 3: return _t('Zauberkraft ×{k} · Abklingzeit ×{c}', { k: petNum(petGeneK(p, 3, .8, .5)), c: petNum(petGeneK(p, 3, 1.1, -.2)) });
    default: return _t('+{v} Beute für dich · mehr Mutationen bei der Zucht', { v: pct(petGene(p, 4) / 100 * .03) });
  }
}
function petGearLines(it, cmp) {
  const L = []; for (const k in it.a) { const d = cmp ? it.a[k] - ((cmp.a || {})[k] || 0) : 0; L.push(`<li class="${cmp ? d > 0 ? 'up' : d < 0 ? 'dn' : '' : ''}">${esc(petStatTxt(k, it.a[k]))}</li>`); }
  if (cmp) for (const k in cmp.a) if (!(k in it.a)) L.push(`<li class="dn">− ${esc(petStatTxt(k, cmp.a[k]))}</li>`);
  return `<ul class="plines">${L.join('')}</ul>`;
}
function petGearCost(s, lv) { const c = PET_SLOT[s].cost.map(([k, n]) => [k, n + Math.floor(lv / 10)]); if (lv >= 40) c.push(['mithril', 1 + Math.floor((lv - 40) / 20)]); if (lv >= 70) c.push(['schuppe', 1]); return { m: c, gold: 50 + lv * 10 }; }
function petCostOk(C) { if (!petHero()) return false; for (const [k, n] of C.m) if ((P.mats[k] || 0) < n) return false; return P.gold >= (C.gold || 0); }
function petCostHTML(C) { return C.m.map(([k, n]) => `<span class="${petHero() && (P.mats[k] || 0) >= n ? '' : 'bad'}" style="display:inline-flex;align-items:center;gap:2px;margin-right:6px"><img src="${iconURL(['mat', k])}" alt="" style="width:16px;height:16px;image-rendering:pixelated">${n}</span>`).join('') + (C.gold ? `<span class="${petHero() && P.gold >= C.gold ? '' : 'bad'}"><i class="coin"></i>${fmt(C.gold)}</span>` : ''); }
function petCostPay(C) { for (const [k, n] of C.m) P.mats[k] -= n; P.gold -= C.gold || 0; }
function petSalvage(it) { return { gold: Math.round(25 * (it.r + 1) * (it.r + 1) * (1 + it.lv / 50)), mat: [PET_SLOT[it.s].cost[0][0], 1 + it.r] }; }

/* ---------- Charakter-Reiter BEGLEITER: Kopf (immer), Unterbereiche ---------- */
let petSub = 'ov';
const PET_BR = { a: null, b: null };
const PET_SUBS = [['ov', _t('ÜBERSICHT')], ['gen', _t('GENE')], ['eq', _t('AUSRÜSTUNG')], ['tal', _t('TALENTE')], ['mag', _t('MAGIE')], ['zu', _t('ZUCHT')]];
function petSubBadge(p, k) { if (k === 'tal') { const f = petTalFree(p); return f > 0 ? f : ''; } if (k === 'mag') { const M = petM(), free = petSockets(p) - (p.mg || []).slice(0, petSockets(p)).filter(Boolean).length; return free > 0 && PET_SPELLS.some(r => M.runes[r] > 0) ? '!' : ''; } if (k === 'zu') return !petBreedWhy(p) ? '♥' : ''; if (k === 'eq') { const M = petM(); return M.gear.length && PET_SLOTS.some(s => !(p.eq && p.eq[s]) && M.gear.some(it => it.s === s)) ? '!' : ''; } return ''; }
function petHeadHTML(p, M) {
  const S = PET_SP[p.sp], st = petStage(p.lv), E = PET_EL[S.el], act = M.act === p.id, hurt = petIsHurt(p), sc = 4, U = petURL(p, true), need = petNeed(p.lv), nx = PET_STAGE.find(l => l > p.lv), q = p.lv >= 100 ? 1 : p.xp / need;
  const prev = `<div class="petprev${hurt ? ' hurt' : Date.now() - PET_UI.fed < 700 ? ' yum' : ''}" style="width:${Math.max(132, U.W * sc + 24)}px;height:${Math.max(120, U.H * sc + (S.fly ? 46 : 30))}px;--pg:${st >= 4 ? `rgba(${E.rgb},.45)` : 'var(--stone-hi)'}">${petSprHTML(U, sc, S.fly && !hurt)}</div>`;
  const mu = PET_MUT[p.mu] ? `<span class="pill" style="background:${PET_MUTC[PET_MUT[p.mu].r]}">${PET_MUT[p.mu].n}</span>` : '';
  const info = `<div class="petinfo"><div class="petnm">${esc(petName(p))}${p.shiny ? ' <span style="color:#ff9af0">✦</span>' : ''}</div>
    <div class="st" style="font-size:17px;margin-top:5px">${p.nm ? S.n + ' · ' : ''}${PET_STN[st]} · ${tierPill(S.t)} <span class="pel" style="background:${E.c}">${E.n}</span> ${mu}</div>
    <div class="stats" style="margin:8px 0 0"><span>${_t('LV {lv}', { lv: p.lv })}</span><span>${_t('SIEGE {n}', { n: fmt(p.k || 0) })}</span>${act && !hurt ? `<span style="color:var(--moss)">${_t('BEGLEITET DICH')}</span>` : ''}${hurt ? `<span style="color:#ff8a7a">${_t('VERLETZT')}</span>` : ''}</div>
    ${petHurtHTML(p)}
    <div class="pbar" style="--c:${E.c}"><i style="width:${(q * 100).toFixed(1)}%"></i></div>
    <div class="st">${p.lv >= 100 ? _t('Höchste Stufe – ein mythischer Gefährte!') : _t('EP {a}/{b} bis LV {lv}', { a: fmt(p.xp), b: fmt(need), lv: p.lv + 1 })}</div>
    ${nx ? `<div class="pbar thin" style="--c:var(--gold)"><i style="width:${((p.lv - PET_STAGE[st]) / (nx - PET_STAGE[st]) * 100).toFixed(1)}%"></i></div><div class="st">${_t('Nächste Entwicklung: {stage} ab LV {lv}', { stage: PET_STN[petStage(nx)], lv: nx })}</div>` : ''}
    <div class="acts" style="justify-content:flex-start;margin-top:8px">${act ? `<button class="btn alt sm" data-act="petact" data-id="${p.id}">${_t('Zurücklassen')}</button>` : `<button class="btn sm" data-act="petact" data-id="${p.id}">${_t('Mitnehmen')}</button>`}<button class="btn alt sm" data-act="petren">${_t('Umbenennen')}</button>${petRel ? `<button class="btn red sm" data-act="petrelok">${_t('Wirklich freilassen?')}</button><button class="btn alt sm" data-act="petrelno">${_t('Nein')}</button>` : `<button class="btn alt sm" data-act="petrel" ${M.list.length > 1 ? '' : 'disabled'}>${_t('Freilassen')}</button>`}</div></div>`;
  const ren = petRen ? `<div class="acts" style="justify-content:flex-start;flex-wrap:nowrap;margin-top:10px"><input type="text" id="petnm" maxlength="14" value="${esc(p.nm)}" placeholder="${esc(S.n)}" style="flex:1;min-width:0"><button class="btn sm" data-act="petrenok">${_t('OK')}</button></div>` : '';
  const nav = M.list.length > 1 ? `<div class="pnav" style="margin-top:8px"><button class="btn alt sm" data-act="petnav" data-i="-1" aria-label="${_t('Voriger Begleiter')}">‹</button><span class="sub" style="flex:1;text-align:center;margin:0">${_t('{n} von {max}', { n: M.list.indexOf(p) + 1, max: M.list.length })}</span><button class="btn alt sm" data-act="petnav" data-i="1" aria-label="${_t('Nächster Begleiter')}">›</button></div>` : '';
  const subs = `<div class="psub" role="tablist">${PET_SUBS.map(([k, n]) => { const bd = petSubBadge(p, k); return `<button class="opt${petSub === k ? ' sel' : ''}" role="tab" aria-selected="${petSub === k}" data-act="petsub" data-id="${k}">${n}${bd !== '' ? `<em>${bd}</em>` : ''}</button>`; }).join('')}</div>`;
  // Übersicht: große Karte; sonst eine knappe Zeile, damit der Inhalt auf dem Handy gleich zu sehen ist
  if (petSub !== 'ov') {
    const U1 = petURL(p, true), s1 = Math.max(1, Math.min(2, Math.floor(Math.min(84 / U1.W, 60 / U1.H) * 2) / 2)), nv = M.list.length > 1;
    return `${subs}<div class="box pmini"><div class="pmi">${petSprHTML(U1, s1, false)}</div><div style="min-width:0"><div class="petnm" style="font-size:22px">${esc(petName(p))}${p.shiny ? ' <span style="color:#ff9af0">✦</span>' : ''}</div><div class="st" style="font-size:16px;margin-top:3px">${_t('LV {lv}', { lv: p.lv })} · ${tierPill(S.t)} <span class="pel" style="background:${E.c}">${E.n}</span> ${mu}${hurt ? ` <span style="color:#ff8a7a">${_t('verletzt')}</span>` : ''}</div></div>${nv ? `<div class="pnav"><button class="btn alt sm" data-act="petnav" data-i="-1" aria-label="${_t('Voriger Begleiter')}">‹</button><button class="btn alt sm" data-act="petnav" data-i="1" aria-label="${_t('Nächster Begleiter')}">›</button></div>` : ''}</div>`;
  }
  return `${subs}<div class="box"><div class="petcard">${prev}${info}</div>${ren}${nav}</div>`;
}
function petListHTML(M, p) {
  return `<h3>${_t('DEINE BEGLEITER {n}/{max}', { n: M.list.length, max: PET_MAX })}</h3><div class="pgrid">${M.list.map(o => `<button class="${o.id === p.id ? 'sel' : ''}" style="--tc:${PET_TIERS[PET_SP[o.sp].t].c}" data-act="petsel" data-id="${o.id}" title="${esc(petName(o))}" aria-label="${esc(petName(o))}">${o.id === M.act ? '<i></i>' : petIsHurt(o) ? '<i class="cd"></i>' : ''}${o.nw ? '<u>●</u>' : ''}<img src="${petURL(o).url}" alt=""><b>${o.lv}</b></button>`).join('')}</div>`;
}
// Übersicht: Farbe, Beutel, Fähigkeiten | Füttern, Liste, Eier, Sammlung
function petOvHTML(p, M) {
  const S = PET_SP[p.sp], cols = petCols(p), V = petVariants(p.sp);
  const sws = [0, 1, 2, 3, 4, 5].map(c => { const j = (c - p.c0 + 6) % 6, ok = cols.includes(c), pl = petPal(p.sp, c); return `<button class="sw${p.col === c ? ' sel' : ''}" data-act="petcol" data-i="${c}" ${ok ? '' : 'disabled'} title="${ok ? V[c].n : _t('{n} – ab LV {lv}', { n: V[c].n, lv: PET_STAGE[j] })}" aria-label="${V[c].n}" style="background:linear-gradient(135deg,rgb(${pl.m2}) 55%,rgb(${pl.m0}) 55%)"></button>`; }).join('')
    + (p.shiny ? `<button class="sw${p.col === 6 ? ' sel' : ''}" data-act="petcol" data-i="6" title="${_t('Schillernd')}" aria-label="${_t('Schillernd')}" style="background:linear-gradient(135deg,#ff9af0,#9ad0ff 40%,#c8f06a 70%,#ffe08a)"></button>` : '');
  const wd = playerW().dmg, pv = petPas(p), pmax = petPas({ sp: p.sp, lv: 100 }), pmin = petPas({ sp: p.sp, lv: 25 }), k = petDmgK(p.lv, p.sp) * petDmgMul(p);
  const rows = [
    [1, S.an, S.ad + ' ' + _t('Schaden {d} ({p} deiner Waffe), alle {s} s.', { d: Math.round(wd * k), p: pct(k), s: petAtkCd(p).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) })],
    [10, _t('Beutemagnet'), _t('Zieht Münzen, Material und Edelsteine aus {r} Schritt Entfernung zu dir.', { r: Math.round(petMagRp(Object.assign({}, p, { lv: Math.max(10, p.lv) }))) })],
    [25, S.pn, p.lv >= 25 ? _t('Jetzt: {now}. Bei LV 100: {max}.', { now: petPasText(pv), max: petPasText(pmax) }) : _t('{min}, wächst bis LV 100 auf {max}.', { min: petPasText(pmin), max: petPasText(pmax) })],
    [50, S.sn, S.sd + ' ' + _t('Alle {s} s.', { s: petSpecCd(Math.max(50, p.lv)) })],
    [75, _t('Uralte Kraft'), _t('Spezialangriff ×1,5 und alle 16 s, leuchtende Aura, ein Beutelplatz mehr.')],
    [100, _t('Mythische Kraft'), _t('Spezialangriff ×2 und alle 12 s, goldene Gestalt.')]
  ].map(([l, n, d]) => `<div class="row${p.lv < l ? ' lock' : ''}" style="cursor:default"><div class="ic plv">${_t('LV')}<br>${l}</div><div><div class="nm">${n}</div><div class="st">${d}</div></div><span></span></div>`).join('');
  const feed = `<h3>${_t('FÜTTERN')}</h3><p class="sub" style="margin-top:0">${p.lv >= 100 ? _t('Satt und mythisch – mehr geht nicht.') : _t('Übriges Material wird zu Erfahrung. Leibspeise: {mat} (doppelte EP).', { mat: MATS[S.fav].n })}</p>
    <div class="opts">${[1, 10, 100].map(n => `<button class="opt${petAmt === n ? ' sel' : ''}" data-act="petamt" data-i="${n}">×${n}</button>`).join('')}</div>
    <div class="grid">${MATORDER.map(k => { const n = P.mats[k] || 0, fav = k === S.fav; return `<button class="slot${fav ? ' fav' : ''}" data-act="petfeed" data-id="${k}" ${n && p.lv < 100 ? '' : 'disabled'} title="${MATS[k].n}" aria-label="${MATS[k].n}"><img src="${iconURL(['mat', k])}" alt=""><span class="u">+${fmt(PET_FEED[k] * (fav ? 2 : 1))}</span><span class="n">${n}</span></button>`; }).join('')}</div>`;
  return `<div class="split"><div><div class="box"><h3 style="margin-top:0">${_t('FARBE')} · ${petColName(p.sp, p.col)}</h3><div class="sws">${sws}</div><p class="sub" style="margin:4px 0 0">${_t('Jede Entwicklungsstufe schaltet eine neue Farbe frei.')}</p></div>${petBagHTML(p)}<h3>${_t('FÄHIGKEITEN')}</h3>${rows}</div><div>${feed}${petListHTML(M, p)}${petNestHTML(M)}${petColHTML()}</div></div>`;
}
// Gene: fünf Leisten mit Note und Wirkung, Mutation, Herkunft, Mutationen-Sammlung
function petGenHTML(p, M) {
  const genes = PET_GENES.map((G, i) => { const v = petGene(p, i), gr = petGrade(v); return `<div class="pgene"><span>${G.n}</span><div class="pbar" style="--c:${G.c}"><i style="width:${v}%"></i></div><span style="text-align:right">${v}</span><b style="color:${gr[2]}">${gr[1]}</b><small>${petGeneTxt(p, i)}</small></div>`; }).join('');
  const sum = (p.gn || petGenesOf(p.id)).reduce((a, b) => a + b, 0), MU = PET_MUT[p.mu];
  const mut = MU ? `<div class="pslot" style="--rc:${PET_MUTC[MU.r]}"><img src="${petURL(p).url}" alt=""><div><div class="nm" style="color:${PET_MUTC[MU.r]}">${MU.n}</div><div class="st">${PET_MUTR[MU.r]} · ${MU.d}</div><ul class="plines">${Object.keys(MU.b).map(k => `<li>${esc(petStatTxt(k, MU.b[k]))}</li>`).join('')}</ul></div></div>`
    : `<p class="sub" style="margin-top:0">${_t('Keine Mutation. Mutationen entstehen selten beim Schlüpfen und öfter bei der Zucht – Glück der Eltern und mutierte Eltern helfen.')}</p>`;
  const from = p.pa ? `<div class="pbr" style="margin-top:0"><div><img src="${petImgURL(p.pa[0], 2, 0, false, false).url}" alt="">${PET_SP[p.pa[0]].n}</div><b>×</b><div><img src="${petImgURL(p.pa[1], 2, 0, false, false).url}" alt="">${PET_SP[p.pa[1]].n}</div></div><p class="sub" style="margin:0">${_t('Aus der Zucht · Generation {n}', { n: p.ge || 1 })}</p>` : `<p class="sub" style="margin-top:0">${_t('Wild geschlüpft – die Gene sind ein Zufallsgeschenk.')}</p>`;
  const coll = Object.keys(PET_MUT).map(k => { const seen = M.mut.includes(k), X = PET_MUT[k]; return `<span class="${seen ? '' : 'no'}" style="--mc:${PET_MUTC[X.r]}">${seen ? X.n : '???'}</span>`; }).join('');
  return `<div class="split"><div><div class="box"><h3 style="margin-top:0">${_t('GENE · SUMME {n}/500', { n: sum })}</h3>${genes}<p class="sub" style="margin:6px 0 0">${_t('Gene erben sich bei der Zucht: Mittel der Eltern, dazu etwas Zufall. Gute Paare machen bessere Kinder.')}</p></div></div>
    <div><h3 style="margin-top:0">${_t('MUTATION')}</h3>${mut}<h3>${_t('HERKUNFT')}</h3>${from}<h3>${_t('ENTDECKTE MUTATIONEN {n}/{max}', { n: M.mut.length, max: Object.keys(PET_MUT).length })}</h3><div class="pmut">${coll}</div></div></div>`;
}
// Ausrüstung: drei Plätze, Lager (antippen → vergleichen, anlegen, zerlegen), Fertigen
function petEqHTML(p, M) {
  const eq = p.eq || {}, sel = M.gear.find(it => it.id === PET_UI.gsel) || null;
  const slots = PET_SLOTS.map(s => { const it = eq[s]; return it ? `<div class="pslot" style="--rc:${RAR[it.r].c}"><img src="${petGearIconURL(it)}" alt=""><div><div class="nm" style="color:${RAR[it.r].c}">${petGearName(it)}</div><div class="st">${PET_SLOT[s].n} · ${RAR[it.r].n} · ${_t('Stufe {n}', { n: it.lv })}</div>${petGearLines(it)}</div><div class="acts"><button class="btn alt sm" data-act="petguneq" data-id="${s}">${_t('Ablegen')}</button></div></div>`
    : `<div class="pslot"><img src="${petGearIconURL({ s, lv: 1, r: 0 })}" alt="" style="opacity:.3"><div><div class="nm">${PET_SLOT[s].n}</div><div class="st">${_t('Leer')}</div></div></div>`; }).join('');
  const m = petMods(p), tot = Object.keys(m).filter(k => m[k]).map(k => `<li>${esc(petStatTxt(k, m[k]))}</li>`).join('');
  const grid = M.gear.length ? `<div class="pgrid">${M.gear.map(it => `<button class="${sel === it ? 'sel' : ''}" style="--tc:${RAR[it.r].c}" data-act="petgsel" data-id="${it.id}" title="${esc(petGearName(it))}" aria-label="${esc(petGearName(it))}"><img src="${petGearIconURL(it)}" alt=""><b>${it.lv}</b></button>`).join('')}</div>` : `<p class="sub" style="margin-top:0">${_t('Noch leer. Begleiter-Ausrüstung fällt manchmal von Gegnern, wenn dein Begleiter dabei ist – oder Gunda fertigt sie dir an.')}</p>`;
  const det = sel ? `<div class="pslot" style="--rc:${RAR[sel.r].c};margin-top:6px"><img src="${petGearIconURL(sel)}" alt=""><div><div class="nm" style="color:${RAR[sel.r].c}">${petGearName(sel)}</div><div class="st">${PET_SLOT[sel.s].n} · ${RAR[sel.r].n} · ${_t('Stufe {n}', { n: sel.lv })}</div>${petGearLines(sel, eq[sel.s] || { a: {} })}</div><div class="acts"><button class="btn sm" data-act="petgeq" data-id="${sel.id}">${eq[sel.s] ? _t('Tauschen') : _t('Anlegen')}</button><button class="btn alt sm" data-act="petgdel" data-id="${sel.id}">${_t('Zerlegen (+{g} Gold)', { g: petSalvage(sel).gold })}</button></div></div>` : '';
  const lv = clamp(petHero() ? P.lv : 1, 1, 100), make = PET_SLOTS.map(s => { const C = petGearCost(s, lv); return `<div class="row" style="cursor:default"><div class="ic"><img src="${petGearIconURL({ s, lv, r: 2 })}" alt=""></div><div><div class="nm">${PET_SLOT[s].names[clamp(Math.floor((lv - 1) / 20), 0, 4)]}</div><div class="st">${petCostHTML(C)}</div></div><button class="btn sm" data-act="petgmake" data-id="${s}" ${petCostOk(C) && M.gear.length < PET_GEAR_MAX ? '' : 'disabled'}>${_t('Fertigen')}</button></div>`; }).join('');
  return `<h3 style="margin-top:0">${_t('ANGELEGT')}</h3><div class="pcards">${slots}</div>${tot ? `<div class="box" style="margin-top:6px"><b style="font-family:var(--f-display);font-weight:400;font-size:8px">${_t('ALLE BONI (TALENTE, AUSRÜSTUNG, MUTATION)')}</b><ul class="plines">${tot}</ul></div>` : ''}
    <div class="split"><div><h3>${_t('LAGER {n}/{max}', { n: M.gear.length, max: PET_GEAR_MAX })}</h3>${grid}${det}</div><div><h3>${_t('GUNDA FERTIGT')}</h3><p class="sub" style="margin-top:0">${_t('Stufe {lv} wie dein Held, Seltenheit ist Glückssache. Halsband: Angriff · Panzer: Schutz für dich · Talisman: Magie und Beute.', { lv })}</p>${make}</div></div>`;
}
// Talente: drei Zweige, Punkte je Level, Zurücksetzen gegen Gold
function petTalHTML(p) {
  const free = petTalFree(p), cost = 50 + p.lv * 15;
  const tree = PET_TAL.map((B, bi) => `<div class="branch"><h4>${B.n}</h4>${B.nodes.map((N, ni) => { const t = petTalState(p, bi, ni); return `<button class="tal${t.lock ? ' lock' : ''}${t.can ? ' can' : ''}${t.r >= N.max ? ' max' : ''}" data-act="pettal" data-i="${bi * 5 + ni}"><span class="r">${t.r}/${N.max}</span><b>${N.n}</b><small>${N.d}${N.max > 1 ? ' ' + _t('je Rang') : ''}</small>${t.lock ? `<span class="req">${_t('Braucht {n} Punkte in {b}', { n: t.need, b: B.n })}</span>` : ''}</button>`; }).join('')}</div>`).join('');
  return `<div class="head" style="margin-bottom:6px"><p class="sub" style="margin:0">${_t('Freie Punkte: {n} · 1 Punkt, dazu einer je 2 Level', { n: `<b style="color:var(--gold)">${free}</b>` })}</p><button class="btn alt sm" data-act="pettalreset" ${petTalUsed(p) && petHero() && P.gold >= cost ? '' : 'disabled'}>${_t('Zurücksetzen ({gold} Gold)', { gold: fmt(cost) })}</button></div><div class="tree ptree">${tree}</div><p class="sub">${_t('Sammler: „Große Taschen“ gibt deinem Begleiter mehr Beutelplätze – was im Beutel liegt, überlebt den Tod in den Landen.')}</p>`;
}
// Magie: Sockel (1, ab LV 25 zwei, ab LV 75 drei), Runen einsetzen, Runen binden
function petMagHTML(p, M) {
  const ns = petSockets(p), mg = p.mg || [], pw = petSpellPow(p), wd = playerW().dmg;
  const sock = [0, 1, 2].map(i => { const lock = i >= ns, k = mg[i], Z = PET_SPELL[k]; if (lock) return `<div class="pslot lock"><div style="width:40px;height:40px;background:var(--night)"></div><div><div class="nm">${_t('Sockel {n}', { n: i + 1 })}</div><div class="st">${_t('Frei ab LV {lv}', { lv: i === 1 ? 25 : 75 })}</div></div></div>`;
    if (!Z) return `<div class="pslot"><div style="width:40px;height:40px;background:var(--night);box-shadow:inset 0 0 0 2px var(--stone-hi)"></div><div><div class="nm">${_t('Sockel {n}', { n: i + 1 })}</div><div class="st">${_t('Leer – setz unten eine Rune ein.')}</div></div></div>`;
    const E = PET_EL[Z.el]; return `<div class="pslot" style="--rc:${E.c}"><img src="${petRuneIconURL(k)}" alt=""><div><div class="nm" style="color:${E.c}">${Z.n}</div><div class="st">${Z.d} ${_t('Alle {s} s.', { s: petNum(Z.cd * petSpellCdK(p)) })}</div></div><div class="acts"><button class="btn alt sm" data-act="petmgout" data-i="${i}">${_t('Herausnehmen')}</button></div></div>`; }).join('');
  const runes = PET_SPELLS.map(k => { const Z = PET_SPELL[k], n = M.runes[k] || 0, C = { m: Z.cost, gold: Z.gold }, E = PET_EL[Z.el]; return `<div class="row" style="cursor:default"><div class="ic" style="box-shadow:inset 0 -3px 0 ${E.c}"><img src="${petRuneIconURL(k)}" alt=""></div><div><div class="nm" style="color:${E.c}">${Z.n} <span class="sub" style="font-size:15px">×${n}</span></div><div class="st">${Z.d}</div><div class="st">${petCostHTML(C)}</div></div><div class="acts" style="flex-direction:column;align-items:stretch;gap:4px"><button class="btn sm" data-act="petmgin" data-id="${k}" ${n > 0 ? '' : 'disabled'}>${_t('Einsetzen')}</button><button class="btn alt sm" data-act="petmgmake" data-id="${k}" ${petCostOk(C) ? '' : 'disabled'}>${_t('Binden')}</button></div></div>`; }).join('');
  return `<div class="box"><p class="sub" style="margin:0">${_t('Dein Begleiter wirkt eingesetzte Zauber im Kampf ganz von selbst. Zauberkraft: {p} deiner Waffe (etwa {d} Schaden). Mehr Kraft durch Magie-Gen, Talente und Talisman.', { p: pct(pw), d: Math.round(wd * pw) })}</p></div>
    <h3>${_t('SOCKEL {n}/3', { n: ns })}</h3><div class="pcards">${sock}</div><h3>${_t('ZAUBERRUNEN')}</h3><p class="sub" style="margin-top:0">${_t('Runen fallen manchmal von Gegnern, wenn dein Begleiter mitkämpft, oder du bindest sie aus Material. Herausnehmen gibt die Rune zurück.')}</p>${runes}`;
}
// Zucht: im Reiter ist der angesehene Begleiter Elternteil A; im Brutnest wählt man beide
function petBreedHTML(where, p) {
  const M = petM(); if (!M) return '';
  if (where === 'tab') PET_BR.a = p.id;
  const A = M.list.find(o => o.id === PET_BR.a) || null, B = M.list.find(o => o.id === PET_BR.b && o.id !== PET_BR.a) || null;
  const card = (o, lab) => o ? `<div><img src="${petURL(o).url}" alt=""><span>${esc(petName(o))}</span><span style="color:${petBreedWhy(o) ? '#ff8a7a' : 'var(--moss)'}">${petBreedWhy(o) || _t('zuchtreif')}</span></div>` : `<div><span class="sub" style="margin:0">${lab}</span></div>`;
  let out = '';
  if (A && B) {
    const hyb = petHybOf(A.sp, B.sp), luck = (petGene(A, 4) + petGene(B, 4)) / 200, hc = hyb ? PET_HYB_CH + luck * .15 : 0, rest = 1 - hc, known = hyb && M.seen.includes(hyb), L = [];
    if (hyb) L.push([known ? PET_SP[hyb].n : _t('??? (ein Hybrid!)'), hc]);
    if (A.sp === B.sp) L.push([PET_SP[A.sp].n, rest]); else { L.push([PET_SP[A.sp].n, rest / 2]); L.push([PET_SP[B.sp].n, rest / 2]); }
    const mc = Math.min(1, .03 + luck * .04 + (A.mu || B.mu ? .03 : 0)), gl = PET_GENES.map((G, i) => { const v = Math.round((petGene(A, i) + petGene(B, i)) / 2); return `${G.n} ${clamp(v - 10, 0, 100)}–${clamp(v + 10, 0, 100)}`; }).join(' · ');
    const cost = petBreedCost(A, B), why = petBreedWhy(A) || petBreedWhy(B) || (M.eggs.length >= EGG_MAX ? _t('Brutnest voll') : '') || (!petHero() || P.gold < cost ? _t('Zu wenig Gold') : '');
    out = `<div class="pout">${L.map(([n, c]) => `<div><span>${n}</span><b>${Math.round(c * 100)} %</b></div>`).join('')}<div><span>${_t('Mutation')}</span><b>${Math.round(mc * 100)} %${A.mu || B.mu ? ' · ' + _t('Erbe möglich') : ''}</b></div></div><p class="sub" style="margin:2px 0 6px">${_t('Gene etwa: {g}', { g: gl })}</p>
      <div class="menu"><button class="btn" data-act="petbrgo" ${why ? 'disabled' : ''}>${_t('Paaren ({g} Gold)', { g: fmt(cost) })}</button></div>${why ? `<p class="sub" style="margin:4px 0 0;color:#ff8a7a">${why}</p>` : `<p class="sub" style="margin:4px 0 0">${_t('Danach ruhen beide Eltern ein paar Stunden. Das Ei kommt ins Brutnest.')}</p>`}`;
  }
  const cand = M.list.filter(o => where === 'nest' || o.id !== PET_BR.a);
  const grid = `<div class="pgrid">${cand.map(o => { const why = petBreedWhy(o); return `<button class="${o.id === PET_BR.a && where === 'nest' ? 'sel' : o.id === PET_BR.b ? 'selb' : ''}${why ? ' off' : ''}" style="--tc:${PET_TIERS[PET_SP[o.sp].t].c}" data-act="petbrsel" data-id="${o.id}" data-i="${where === 'nest' ? 1 : 0}" title="${esc(petName(o) + (why ? ' – ' + why : ''))}" aria-label="${esc(petName(o))}">${why ? '<i class="cd"></i>' : '<i></i>'}<img src="${petURL(o).url}" alt=""><b>${o.lv}</b></button>`; }).join('')}</div>`;
  const book = PET_HY.map(sp => { const [a, b] = PET_SP[sp].hy, seen = M.seen.includes(sp), ka = M.seen.includes(a), kb = M.seen.includes(b); return `<div><span>${ka || seen ? PET_SP[a].n : '???'} × ${kb || seen ? PET_SP[b].n : '???'}</span><b>${seen ? PET_SP[sp].n : '???'}</b></div>`; }).join('');
  return `${where === 'tab' ? '' : `<h3>${_t('ZUCHT')}</h3>`}<p class="sub" style="margin-top:0">${_t('Zwei Begleiter ab LV {lv} legen zusammen ein Ei. Es erbt Gene, manchmal Mutationen – und passende Paare ergeben Hybride.', { lv: PET_BREED_LV })}</p>
    <div class="pbr">${card(A, _t('Elternteil 1'))}<b>×</b>${card(B, _t('Partner wählen'))}</div>${out}
    <h3>${where === 'tab' ? _t('PARTNER') : _t('BEGLEITER WÄHLEN')}</h3>${grid}
    <h3>${_t('ZUCHTBUCH · HYBRIDE {n}/{max}', { n: PET_HY.filter(sp => M.seen.includes(sp)).length, max: PET_HY.length })}</h3><div class="pout">${book}</div>`;
}
function petTabHTML() {
  const M = petM(); if (!M) return '';
  const p = petViewed();
  if (!p) return `<div class="split"><div><div class="box"><p class="sub" style="margin-top:0">${_t('Gerade begleitet dich niemand. Begleiter schlüpfen aus Eiern, die du im Brutnest im Versteck pflegst: Wärme, Futter und Zuwendung.')}</p></div>${petNestHTML(M)}</div><div>${petColHTML()}</div></div>`;
  if (p.nw) { p.nw = 0; persist(); }
  petView = p.id;
  const body = petSub === 'gen' ? petGenHTML(p, M) : petSub === 'eq' ? petEqHTML(p, M) : petSub === 'tal' ? petTalHTML(p) : petSub === 'mag' ? petMagHTML(p, M) : petSub === 'zu' ? petBreedHTML('tab', p) : petOvHTML(p, M);
  return petHeadHTML(p, M) + body;
}
HOOK.charTabs.push({ k: 'pet', label: petSafe('label', () => _t('BEGLEITER') + (petNews() ? ' (!)' : ''), 'BEGLEITER'), body: petSafe('tab', petTabHTML, '') });

/* ---------- Brutnest-Bildschirm ---------- */
let NEST_BACK = 'hide', NEST_TM = null, NEST_SELL = null;
const EGG_GOLD = [5, 10, 25, 60, 150, 400, 1000];
function nestBack() {
  const b = NEST_BACK; clearInterval(NEST_TM); NEST_TM = null; if (petHero()) saveChar(); else persist();
  if (b === 'hide' && G && G.type === 'versteck') backToHide(); else if (b === 'map') openMap(); else if (b === 'title') showTitle(); else if (b === 'char') openChar('pet'); else if (G && G.type === 'versteck') backToHide(); else openMap();
}
function nestMeter(k, v, ms) { const lb = { w: _t('Wärme'), f: _t('Futter'), z: _t('Zuwendung') }[k], c = { w: '#ff8a3a', f: '#e8c070', z: '#ff6a8a' }[k]; return `<div class="nmet${v <= 0 ? ' e' : ''}" data-m="${k}" title="${lb}"><img src="${nestIcon(k)}" alt="${lb}"><div class="pbar" style="--c:${c}"><i style="width:${(v * 100).toFixed(1)}%"></i></div><span>${v <= 0 ? _t('leer!') : petDurS(ms)}</span></div>`; }
function nestStatus(V) {
  if (V.ready) return ['gd', _t('Es wackelt und knackt – bereit!')];
  if (!V.grow) { const L = [_t('Wärme'), _t('Futter'), _t('Zuwendung')].filter((_, i) => V.empty[i]); return ['bad', _t('Pausiert – es fehlt: {what}', { what: L.join(', ') })]; }
  if (V.eta != null) return ['ok', V.cozy ? _t('Wächst wohlig (×1,5) · schlüpft um {t}', { t: petClock(V.eta) }) : _t('Wächst · schlüpft um {t}', { t: petClock(V.eta) })];
  return ['ok', (V.cozy ? _t('Wächst wohlig (×1,5) bis {t}', { t: petClock(V.until) }) : _t('Wächst bis {t}', { t: petClock(V.until) }))];
}
function nestCardHTML(g) {
  const V = eggView(g), T0 = PET_TIERS[g.tier], hint = V.q >= .5 ? PET_SP[g.sp].el : null, F = eggFood(g), [sc, stx] = nestStatus(V), pet = PET_UI.petId === g.id && Date.now() - PET_UI.petT < 800;
  const food = F.k === 'gold' ? `<i class="coin"></i>${F.n}` : `<img src="${iconURL(['mat', F.k])}" alt="">${F.n}`;
  return `<div class="ncard${V.ready ? ' rdy' : ''}" data-eg="${g.id}" data-sig="${V.ready}|${V.grow}|${V.empty.join()}" style="--tc:${T0.c}">
  <div class="ntop"><b>${T0.egg}</b><button class="btn alt sm" data-act="nestout" data-id="${g.id}" aria-label="${_t('In den Korb legen')}" title="${_t('In den Korb legen')}">${_t('Korb')}</button></div>
  <button class="negg${V.ready ? ' wob' : pet ? ' tap' : ' idle'}" data-act="nestpet" data-id="${g.id}" aria-label="${_t('Streicheln')}"><img class="e" src="${eggURL(g.tier, eggCr(V), hint)}" alt="">${pet ? `<img class="hrt" src="${nestIcon('z')}" alt="">` : ''}</button>
  <div><div class="pbar" style="--c:${T0.c};margin-top:2px"><i style="width:${(V.q * 100).toFixed(1)}%"></i></div><div class="nq">${V.ready ? _t('100 % – fertig gebrütet') : _t('{p} % · noch {t} Pflege', { p: Math.floor(V.q * 100), t: petDur(V.rest * 1000 / (V.cozy ? EGG_BONUS : 1)) })}</div><div class="nst ${sc}">${stx}</div></div>
  <div>${nestMeter('w', V.v[0], V.left[0])}${nestMeter('f', V.v[1], V.left[1])}${nestMeter('z', V.v[2], V.left[2])}</div>
  <div class="sub" style="grid-column:2;margin:2px 0 0;font-size:15px">${g.pa ? _t('Aus der Zucht: {a} × {b}', { a: PET_SP[g.pa[0]].n, b: PET_SP[g.pa[1]].n }) + ' · ' : ''}${hint ? _t('Du spürst darin: {el}', { el: `<span style="color:${PET_EL[hint].c}">${PET_EL[hint].n}</span>` }) : _t('Ab 50 % spürst du, was darin steckt.')}${g.mu && V.q >= .8 ? ' · ' + _t('Die Schale schimmert seltsam …') : ''}</div>
  <div class="nacts">${V.ready ? `<button class="btn hatch" data-act="nesthatch" data-id="${g.id}">${_t('Schlüpfen lassen!')}</button>` : `<button class="btn sm${V.v[0] < .5 ? '' : ' alt'}" data-act="nestwarm" data-id="${g.id}" ${V.v[0] >= .98 ? 'disabled' : ''}>${_t('Wärmen')}<small><img src="${nestIcon('w')}" alt="">${_t('gratis')}</small></button><button class="btn sm${V.v[1] < .5 && F.ok ? '' : ' alt'}" data-act="nestfeed" data-id="${g.id}" ${F.ok && V.v[1] < .9 ? '' : 'disabled'}>${_t('Füttern')}<small class="${F.ok ? '' : 'bad'}">${food}</small></button><button class="btn sm${V.v[2] < .5 ? '' : ' alt'}" data-act="nestpet" data-id="${g.id}" ${V.v[2] >= .98 ? 'disabled' : ''}>${_t('Streicheln')}<small><img src="${nestIcon('z')}" alt="">+34 %</small></button>`}</div></div>`;
}
function nestSummaryHTML(eggs, A) {
  const M = petM();
  if (!M.eggs.length) return `<div class="box nsum"><img src="${iconURL(['pa', 'nest'])}" alt=""><div><b>${_t('Das Nest ist leer.')}</b><p class="sub">${_t('Eier gibt es vom ersten Boss der Geschichte, von Bossen, aus der Drachentruhe, aus den Verlorenen Landen und vom Basar.')}</p></div></div>`;
  if (!eggs.length) return `<div class="box nsum"><img src="${iconURL(['pa', 'nest'])}" alt=""><div><b>${_t('Leg ein Ei aus dem Korb ins Nest.')}</b><p class="sub">${_t('Nur im Nest wächst ein Ei.')}</p></div></div>`;
  const care = eggs.some(g => { const V = eggView(g); return !V.ready && (V.v[0] < .9 || (V.v[1] < .9 && eggFood(g).ok)); });
  const noFood = eggs.find(g => { const V = eggView(g); return !V.ready && V.v[1] <= .1 && !eggFood(g).ok; });
  let col = 'var(--moss)', t, s;
  if (A.ready) { col = 'var(--gold)'; t = A.ready === 1 ? _t('Ein Ei ist bereit zum Schlüpfen!') : _t('{n} Eier sind bereit zum Schlüpfen!', { n: A.ready }); s = _t('Jetzt kommt der große Moment.'); }
  else if (A.need) { const cold = eggs.every(g => !g.got && !g.w && !g.f && !g.z); col = '#ff8a7a'; t = cold ? _t('Noch kalt: Wärme, Futter und Zuwendung, dann wächst es.') : A.need === 1 ? _t('Ein Ei wächst gerade nicht.') : _t('{n} Eier wachsen gerade nicht.', { n: A.need }); s = _t('Wärmen und Füttern geht mit einem Knopf, Zuwendung gibst du, indem du ein Ei antippst.'); }
  else { t = _t('Alle Eier wachsen.'); s = isFinite(A.next) ? _t('Versorgt bis {t} – komm dann wieder. Je voller alle drei Leisten, desto schneller.', { t: petClock(A.next) }) : _t('Versorgt.'); }
  if (noFood) { const F = eggFood(noFood); s += ' ' + _t('Fürs Füttern fehlt dir: {n}× {mat}. Material gibt es von Gegnern, aus Truhen, der Mine und dem Garten.', { n: F.n, mat: F.k === 'gold' ? _t('Gold') : MATS[F.k].n }); }
  const rd = A.ready ? eggs.find(g => eggView(g).ready) : null;
  return `<div class="box nsum" style="--sc:${col}"><img src="${iconURL(['pa', 'nest'])}" alt=""><div><b style="color:${col}">${t}</b><p class="sub">${s}</p></div>${rd || care ? `<div class="menu">${rd ? `<button class="btn" data-act="nesthatch" data-id="${rd.id}">${_t('Schlüpfen lassen!')}</button>` : ''}${care ? `<button class="btn${rd ? ' alt' : ''}" data-act="nestall">${_t('Alle wärmen und füttern')}</button>` : ''}</div>` : ''}</div>`;
}
function openNest(back) {
  if (back) NEST_BACK = back;
  if (!petHero()) return;
  setState('menu'); showHud(false);
  const M = petM(), eggs = nestEggs(), basket = M.eggs.filter(g => !g.nest), A = nestAlert(), sel = petSel();
  let cards = eggs.map(nestCardHTML).join('');
  for (let i = eggs.length; i < NEST_MAX; i++) cards += `<div class="ncard" style="--tc:var(--stone-hi)"><div class="nfree">${basket.length ? _t('Freier Brutplatz – leg ein Ei aus dem Korb hinein.') : _t('Freier Brutplatz')}</div></div>`;
  const brows = basket.map(g => { const T0 = PET_TIERS[g.tier], sell = NEST_SELL === g.id; return `<div class="row" style="cursor:default"><div class="ic"><img src="${eggURL(g.tier, 0)}" alt=""></div><div><div class="nm" style="color:${T0.c}">${T0.egg}</div><div class="st">${g.got > 0 ? _t('{p} % gebrütet · ', { p: Math.floor(g.got / g.need * 100) }) : ''}${_t('Ruht – wächst nur im Nest. Pflegezeit {t}.', { t: petDur(T0.care * 1000) })}</div></div><div class="acts">${sell ? `<button class="btn red sm" data-act="nestsellok" data-id="${g.id}">+${EGG_GOLD[g.tier]} <i class="coin"></i></button><button class="btn alt sm" data-act="nestsellno">${_t('Nein')}</button>` : `<button class="btn sm" data-act="nestput" data-id="${g.id}" ${eggs.length < NEST_MAX ? '' : 'disabled'}>${_t('Ins Nest')}</button><button class="btn alt sm" data-act="nestsell" data-id="${g.id}" aria-label="${_t('Gunda geben')}">${_t('Abgeben')}</button>`}</div></div>`; }).join('');
  const tiers = PET_TIERS.map(T0 => `<div style="--tc:${T0.c}"><b>${T0.n}</b>${_t('Pflege {t} · Stärke ×{m} · Beutel {n}', { t: petDur(T0.care * 1000), m: T0.mul.toLocaleString(LOCALE), n: T0.bag })}<br>${_t('Futter: {list}', { list: T0.food.map(([k]) => k === 'gold' ? _t('Gold') : MATS[k].n).join(', ') })}</div>`).join('');
  const hurt = sel && petIsHurt(sel) ? `<div class="box" style="margin-bottom:8px;box-shadow:inset 3px 0 0 #ff8a7a"><b style="font-size:19px;font-weight:400">${esc(petName(sel))}</b>${petHurtHTML(sel)}</div>` : '';
  showOverlay(`<div class="head"><h2>${_t('BRUTNEST')}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div><button class="btn alt sm" data-act="nestback">${_t('Zurück')}</button></div></div>
  <div class="nestscr">${NEST_BACK === 'hide' ? npcLine('brutnest') : ''}${nestSummaryHTML(eggs, A)}${hurt}
  <div class="nests">${cards}</div>
  <h3>${_t('EIERKORB {n}/{max}', { n: basket.length, max: EGG_MAX - NEST_MAX })}</h3>${brows || `<p class="sub" style="margin-top:0">${_t('Leer. Neue Eier kommen ins Nest, solange dort Platz ist.')}</p>`}
  ${petBreedHTML('nest')}
  ${petColHTML()}
  <h3>${_t('SELTENHEITEN')}</h3><p class="sub" style="margin-top:0">${_t('Seltenere Eier brauchen länger und feineres Futter – dafür schlüpfen stärkere Begleiter mit größerem Beutel.')}</p><div class="ntier">${tiers}</div></div>`, true);
  clearInterval(NEST_TM); NEST_TM = setInterval(nestTick, 1000);
}
// Laufende Anzeige: Balken und Zeiten nachführen; ändert sich der Zustand, neu aufbauen
function nestTick() {
  const sc = panel.querySelector('.nestscr'); if (!sc || ov.hidden || HATCH) { clearInterval(NEST_TM); NEST_TM = null; return; }
  for (const el of sc.querySelectorAll('.ncard[data-eg]')) {
    const g = petM().eggs.find(x => x.id === el.dataset.eg); if (!g) { openNest(); return; }
    const V = eggView(g); if (el.dataset.sig !== `${V.ready}|${V.grow}|${V.empty.join()}`) { openNest(); return; }
    el.querySelector('.pbar i').style.width = (V.q * 100).toFixed(1) + '%';
    el.querySelector('.nq').textContent = V.ready ? _t('100 % – fertig gebrütet') : _t('{p} % · noch {t} Pflege', { p: Math.floor(V.q * 100), t: petDur(V.rest * 1000 / (V.cozy ? EGG_BONUS : 1)) });
    el.querySelector('.nst').textContent = nestStatus(V)[1];
    ['w', 'f', 'z'].forEach((k, i) => { const m = el.querySelector(`.nmet[data-m="${k}"]`); if (!m) return; m.querySelector('i').style.width = (V.v[i] * 100).toFixed(1) + '%'; m.querySelector('span').textContent = V.v[i] <= 0 ? _t('leer!') : petDurS(V.left[i]); });
  }
}
function nestEgg(id) { const M = petM(); return M && M.eggs.find(g => g.id === id); }

/* ---------- Schlüpfen: Wackeln, Risse, Licht, Schalensplitter, dann die Kreatur ---------- */
let HATCH = null;
function hatchStart(id) {
  const M = petM(), i = M.eggs.findIndex(g => g.id === id); if (i < 0) return;
  if (M.list.length >= PET_MAX) { toast(_t('Du hast schon {n} Begleiter – lass erst einen frei.', { n: PET_MAX }), '#ff6a5a'); sfx('deny'); return; }
  const g = M.eggs[i], tier = g.tier, was = M.seen.includes(g.sp), p = eggHatch(i, true); if (!p) return;
  petView = p.id; clearInterval(NEST_TM); NEST_TM = null;
  const calm = !!(SAVE.meta.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches);
  HATCH = { p, tier, newSp: !was, t0: performance.now(), sp: calm ? 2.6 : 1, cr: -1, parts: [], shown: false, flash: 0 };
  showOverlay(`<div class="hatch"><h2 class="center" style="color:${PET_TIERS[tier].c}">${_t('ES SCHLÜPFT!')}</h2><canvas id="hatchcv" width="160" height="120" data-act="hatchskip" aria-label="${_t('Überspringen')}"></canvas><div id="hres" class="hres"><p class="sub center">${_t('Antippen zum Überspringen')}</p></div></div>`, true);
  sfx('click'); requestAnimationFrame(hatchRun);
}
const HATCH_T = 2.1; // Zeitpunkt, an dem die Schale platzt
function hatchRun() {
  const H = HATCH, cv = $('hatchcv'); if (!H || !cv) { HATCH = null; return; }
  const g = cv.getContext('2d'), t = (performance.now() - H.t0) / 1000 * H.sp, T0 = PET_TIERS[H.tier], W = 160, Hh = 120, cx = 80, gy = 104;
  g.imageSmoothingEnabled = false; g.clearRect(0, 0, W, Hh);
  const [r, gg, b] = hexRgb(T0.c), gl = g.createRadialGradient(cx, gy - 30, 4, cx, gy - 30, 80);
  gl.addColorStop(0, `rgba(${r},${gg},${b},${Math.min(.55, .12 + t * .14)})`); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, Hh);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, gy + 2, 26, 5, 0, 0, 6.283); g.fill();
  // Strahlen ab dem Platzen, bei seltenen Arten mehr und bunter
  const rays = (n, len, a0, al) => { g.save(); g.translate(cx, gy - 30); g.rotate(a0); for (let i = 0; i < n; i++) { g.rotate(6.283 / n); g.fillStyle = H.tier >= 6 ? `hsla(${(i * 47 + t * 90) % 360},90%,70%,${al})` : `rgba(${r},${gg},${b},${al})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, -5); g.lineTo(len, 5); g.fill(); } g.restore(); };
  if (t < HATCH_T) {
    const cr = t < .55 ? 0 : t < 1.1 ? 1 : t < 1.6 ? 2 : 3;
    if (cr !== H.cr) { H.cr = cr; if (cr) { petSnd('crack'); for (let i = 0; i < 4 + cr * 2; i++) H.parts.push({ x: cx + rnd(-10, 10), y: gy - rnd(30, 60), vx: rnd(-40, 40), vy: rnd(-60, -20), c: EGG_PAL[H.tier].m[ri(1, 3)], s: 1, life: .8 }); } }
    const amp = Math.min(.32, .04 + t * .14), ang = Math.sin(t * (9 + t * 7)) * amp, hop = cr >= 2 ? Math.abs(Math.sin(t * 11)) * 3 : 0;
    if (t > HATCH_T - .5) rays(10, 70, t, Math.min(.5, (t - HATCH_T + .5) * 1.2));
    const ec = eggCanvas(H.tier, cr, null);
    g.save(); g.translate(cx, gy - hop); g.rotate(ang); g.drawImage(ec, -30, -EGG_H_PX * 3 + 3, EGG_W_PX * 3, EGG_H_PX * 3);
    if (t > HATCH_T - .45) { g.globalAlpha = Math.min(1, (t - HATCH_T + .45) * 2.2); g.drawImage(H.sil || (H.sil = silhouette(ec, '#ffffff')), -30, -EGG_H_PX * 3 + 3, EGG_W_PX * 3, EGG_H_PX * 3); }
    g.restore();
  } else {
    if (!H.burst) { H.burst = true; H.flash = 1; petSnd('hatch'); if (H.tier >= 4) sfx('myth'); else sfx('ach'); for (let i = 0; i < 26; i++) { const a = rnd(0, 6.283), v = rnd(30, 110); H.parts.push({ x: cx + rnd(-8, 8), y: gy - 30 + rnd(-10, 10), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, c: EGG_PAL[H.tier].m[ri(1, 3)], s: ri(2, 3), life: 1.2 }); } }
    const k = clamp((t - HATCH_T) / .45, 0, 1), pop = k < 1 ? 1 + Math.sin(k * Math.PI) * .25 : 1, sc = 3 * Math.min(1, k * 1.6) * pop;
    if (H.tier >= 3) rays(H.tier >= 5 ? 16 : 10, 90, t * .4, .22 + .08 * Math.sin(t * 3));
    const S = petStripOf(H.p), fr = Math.floor(t * 6) % 4, fly = PET_SP[H.p.sp].fly ? Math.sin(t * 3) * 3 - 6 : 0;
    if (sc > 0) { g.save(); g.translate(cx, gy + fly); g.scale(sc, sc); g.drawImage(S.c, fr * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H); g.restore(); }
    if (Math.random() < (H.p.shiny ? .5 : .2)) H.parts.push({ x: cx + rnd(-40, 40), y: gy - rnd(10, 80), vx: 0, vy: -10, c: H.p.shiny ? '#ff9af0' : '#fff6c0', s: 1, life: .7, tw: 1 });
    if (!H.shown && t > HATCH_T + .5) { H.shown = true; hatchReveal(H); }
  }
  // Splitter und Funken
  const dt = 1 / 60; H.parts = H.parts.filter(q => (q.life -= dt) > 0);
  for (const q of H.parts) { q.x += q.vx * dt; q.y += q.vy * dt; if (!q.tw) q.vy += 220 * dt; g.globalAlpha = Math.min(1, q.life * 2); g.fillStyle = q.c; g.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); if (q.tw) { g.fillRect(Math.round(q.x) - 1, Math.round(q.y), 3, 1); g.fillRect(Math.round(q.x), Math.round(q.y) - 1, 1, 3); } }
  g.globalAlpha = 1;
  if (H.flash > 0) { g.fillStyle = `rgba(255,255,255,${H.flash})`; g.fillRect(0, 0, W, Hh); H.flash = Math.max(0, H.flash - .06); }
  requestAnimationFrame(hatchRun);
}
function hatchReveal(H) {
  const p = H.p, S = PET_SP[p.sp], E = PET_EL[S.el], el = $('hres'); if (!el) return;
  const M = petM(), act = M.act === p.id, newSp = H.newSp;
  el.innerHTML = `<div class="kv">${tierPill(S.t)}<span class="pel" style="background:${E.c}">${E.n}</span>${p.shiny ? `<span class="pill" style="background:#ff9af0">${_t('SCHILLERND!')}</span>` : ''}${newSp ? `<span class="pill" style="background:var(--gold)">${_t('NEU IN DER SAMMLUNG')}</span>` : ''}${PET_MUT[p.mu] ? `<span class="pill" style="background:${PET_MUTC[PET_MUT[p.mu].r]}">${_t('MUTATION: {n}', { n: PET_MUT[p.mu].n })}</span>` : ''}${S.hy ? `<span class="pill" style="background:#ff8aa8">${_t('HYBRID')}</span>` : ''}</div>
  <h2 class="center" style="color:${PET_TIERS[S.t].c}">${esc(S.n).toLocaleUpperCase(LOCALE)}</h2><p class="sub center" style="margin:2px 0 8px">${S.st} ${_t('Angriff: {a}. Beutel: {n}.', { a: S.an, n: petBagSize(p) })}</p>
  <p class="sub center" style="margin:0 0 8px">${PET_GENES.map((G, i) => `${G.n} <b style="color:${petGrade(petGene(p, i))[2]};font-weight:400">${petGrade(petGene(p, i))[1]}</b>`).join(' · ')}</p>
  <div class="menu two">${act ? '' : `<button class="btn" data-act="hatchtake">${_t('Mitnehmen')}</button>`}<button class="btn${act ? '' : ' alt'}" data-act="hatchok">${_t('Weiter')}</button></div>`;
  if (act) toast(_t('{name} begleitet dich ab jetzt!', { name: S.n }), E.c);
}

/* ---------- Knöpfe ---------- */
ON.petsel = id => { petView = id; petRen = petRel = false; sfx('click'); openChar('pet'); };
ON.petact = id => { const M = petM(); M.act = M.act === id ? null : id; persist(); computeStats(); petPlace(false); sfx('click'); openChar('pet'); };
ON.petren = () => { petRen = !petRen; petRel = false; openChar('pet'); const el = $('petnm'); if (el && !isTouch) el.focus(); };
ON.petrenok = () => { const p = petViewed(), el = $('petnm'); if (p && el) { p.nm = el.value.replace(/[<>]/g, '').trim().slice(0, 14); if (p.nm === PET_SP[p.sp].n) p.nm = ''; persist(); sfx('click'); } petRen = false; openChar('pet'); };
ON.petcol = (id, b, i) => { const p = petViewed(); if (p && petCols(p).includes(i)) { p.col = i; persist(); sfx('click'); } openChar('pet'); };
ON.petamt = (id, b, i) => { petAmt = [1, 10, 100].includes(i) ? i : 1; sfx('click'); openChar('pet'); };
ON.petfeed = id => {
  const p = petViewed(); if (!p || !P || !MATS[id]) return;
  const n = Math.min(petAmt, P.mats[id] || 0); if (n <= 0 || p.lv >= 100) { sfx('deny'); return; }
  P.mats[id] -= n; const fav = PET_SP[p.sp].fav === id, xp = PET_FEED[id] * n * (fav ? 2 : 1), s0 = petStage(p.lv), l0 = p.lv;
  petXP(p, xp, true); PET_UI.fed = Date.now(); petSnd('feed'); saveChar();
  if (petStage(p.lv) === s0) toast((fav ? _t('Leibspeise! {name} verschlingt {n}× {mat}: +{xp} EP', { name: petName(p), n, mat: MATS[id].n, xp: fmt(xp) }) : _t('{name} frisst {n}× {mat}: +{xp} EP', { name: petName(p), n, mat: MATS[id].n, xp: fmt(xp) })) + (p.lv > l0 ? ' · ' + _t('LV {lv}!', { lv: p.lv }) : ''), fav ? '#ff8aa8' : '#ffd24a');
  openChar('pet');
};
ON.petrel = () => { petRel = true; petRen = false; openChar('pet'); };
ON.petrelno = () => { petRel = false; openChar('pet'); };
ON.petrelok = () => {
  const M = petM(), p = petViewed(); petRel = false; if (!p || M.list.length <= 1) { openChar('pet'); return; }
  const n = 1 + Math.floor(p.lv / 25), nm = petName(p); if (!petExport(M.list.indexOf(p))) { openChar('pet'); return; } petView = null; gainFate(n); saveChar(); sfx('page');
  toast(n === 1 ? _t('{name} zieht in die Freiheit und lässt dir 1 Glücksmünze da.', { name: nm }) : _t('{name} zieht in die Freiheit und lässt dir {n} Glücksmünzen da.', { name: nm, n }), '#ffd24a');
  openChar('pet');
};
ON.petbag = id => { const p = petM().list.find(x => x.id === id); if (p && petHero()) { const n = petBagEmpty(p); if (n) { sfx('loot'); toast(_t('{n} Sachen aus dem Beutel genommen.', { n }), '#79c24e'); } } openChar('pet'); };
ON.petheal = (id, b, i) => {
  const p = petM().list.find(x => x.id === id); if (!p || !petHero() || !petIsHurt(p)) return;
  if (i === 0) { if (P.potions < 1) { sfx('deny'); return; } P.potions--; } else { const [k, n] = PET_HEALMAT; if ((P.mats[k] || 0) < n) { sfx('deny'); return; } P.mats[k] -= n; }
  petHeal(p); saveChar(); sfx('heal'); toast(_t('{name} ist wieder auf den Beinen!', { name: petName(p) }), '#79c24e');
  if (panel.querySelector('.nestscr')) openNest(); else openChar('pet');
};
// Brutnest
ON.nestopen = id => { sfx('click'); openNest(id || 'map'); };
ON.nestback = () => { sfx('click'); nestBack(); };
ON.nestwarm = id => { const g = nestEgg(id); if (!g) return; eggWarm(g); petSnd('warm'); persist(); openNest(); };
ON.nestfeed = id => { const g = nestEgg(id); if (!g) return; if (eggFeed(g)) { petSnd('feed'); saveChar(); } else sfx('deny'); openNest(); };
ON.nestpet = id => { const g = nestEgg(id); if (!g) return; const V = eggView(g); if (V.ready) { hatchStart(id); return; } eggPet(g); PET_UI.petId = id; PET_UI.petT = Date.now(); petSnd('pet'); persist(); openNest(); };
ON.nestall = () => {
  let w = 0, f = 0, miss = 0;
  for (const g of nestEggs()) { const V = eggView(g); if (V.ready) continue; if (g.w < .98) { eggWarm(g); w++; } if (g.f < .9) { if (eggFeed(g)) f++; else miss++; } }
  if (w || f) { petSnd('warm'); if (f) petSnd('feed'); saveChar(); } else sfx('deny');
  if (miss) toast(_t('Für {n} Eier fehlt dir Futter.', { n: miss }), '#ff8a7a');
  openNest();
};
ON.nestput = id => { const g = nestEgg(id); if (!g || nestEggs().length >= NEST_MAX) { sfx('deny'); return; } g.nest = 1; g.t = Date.now(); persist(); sfx('click'); openNest(); };
ON.nestout = id => { const g = nestEgg(id); if (!g) return; eggSim(g); g.nest = 0; persist(); sfx('click'); openNest(); };
ON.nestsell = id => { NEST_SELL = id; sfx('click'); openNest(); };
ON.nestsellno = () => { NEST_SELL = null; openNest(); };
ON.nestsellok = id => { const M = petM(), i = M.eggs.findIndex(g => g.id === id); NEST_SELL = null; if (i < 0) return; const g = M.eggs[i]; M.eggs.splice(i, 1); P.gold += EGG_GOLD[g.tier]; saveChar(); sfx('coin'); toast(_t('Gunda nimmt das Ei und gibt dir {n} Gold.', { n: EGG_GOLD[g.tier] }), '#ffd24a'); openNest(); };
ON.nesthatch = id => hatchStart(id);
ON.hatchskip = () => { const H = HATCH; if (H && performance.now() - H.t0 < (HATCH_T + .5) / H.sp * 1000) H.t0 = performance.now() - (HATCH_T + .05) / H.sp * 1000; };
ON.hatchtake = () => { const H = HATCH, M = petM(); if (H && M.list.includes(H.p)) { M.act = H.p.id; persist(); computeStats(); petPlace(false); toast(_t('{name} begleitet dich ab jetzt!', { name: PET_SP[H.p.sp].n }), PET_EL[PET_SP[H.p.sp].el].c); } HATCH = null; openNest(); };
ON.hatchok = () => { HATCH = null; openNest(); };
/* ---------- Knöpfe: Kreaturen 2.0 ---------- */
function petRe() { if (panel.querySelector('.nestscr')) openNest(); else openChar('pet'); }
ON.petsub = id => { if (PET_SUBS.some(([k]) => k === id)) petSub = id; PET_UI.gsel = null; petRen = petRel = false; sfx('click'); openChar('pet'); };
ON.petnav = (id, b, i) => { const M = petM(), p = petViewed(); if (!p || M.list.length < 2) return; const j = (M.list.indexOf(p) + (i < 0 ? -1 : 1) + M.list.length) % M.list.length; petView = M.list[j].id; PET_BR.b = null; petRen = petRel = false; sfx('click'); openChar('pet'); };
// Ausrüstung
ON.petgsel = id => { PET_UI.gsel = PET_UI.gsel === id ? null : id; sfx('click'); openChar('pet'); };
ON.petgeq = id => {
  const M = petM(), p = petViewed(), i = M.gear.findIndex(it => it.id === id); if (!p || i < 0) return;
  const it = M.gear[i]; p.eq = p.eq || {}; const old = p.eq[it.s]; M.gear.splice(i, 1); if (old) M.gear.push(old); p.eq[it.s] = it; PET_UI.gsel = null;
  persist(); computeStats(); sfx('click'); toast(_t('{name} trägt jetzt: {item}', { name: petName(p), item: petGearName(it) }), RAR[it.r].c); openChar('pet');
};
ON.petguneq = s => { const M = petM(), p = petViewed(); if (!p || !p.eq || !p.eq[s]) return; if (M.gear.length >= PET_GEAR_MAX) { toast(_t('Das Lager ist voll.'), '#ff6a5a'); sfx('deny'); return; } M.gear.push(p.eq[s]); delete p.eq[s]; persist(); computeStats(); sfx('click'); openChar('pet'); };
ON.petgdel = id => { const M = petM(), i = M.gear.findIndex(it => it.id === id); if (i < 0 || !petHero()) return; const it = M.gear[i], R = petSalvage(it); M.gear.splice(i, 1); P.gold += R.gold; gainMat(R.mat[0], R.mat[1]); PET_UI.gsel = null; saveChar(); sfx('coin'); toast(_t('Zerlegt: +{g} Gold, +{n}× {m}', { g: R.gold, n: R.mat[1], m: MATS[R.mat[0]].n }), '#ffd24a'); openChar('pet'); };
ON.petgmake = s => {
  const M = petM(); if (!PET_SLOT[s] || !petHero()) return; const lv = clamp(P.lv, 1, 100), C = petGearCost(s, lv);
  if (!petCostOk(C) || M.gear.length >= PET_GEAR_MAX) { sfx('deny'); return; }
  petCostPay(C); const it = petGearNew(s, null, lv); M.gear.push(it); PET_UI.gsel = it.id; saveChar(); sfx(it.r >= 3 ? 'myth' : 'buy');
  toast(_t('Gunda hat gefertigt: {n} ({r})', { n: petGearName(it), r: RAR[it.r].n }), RAR[it.r].c); openChar('pet');
};
// Talente
ON.pettal = (id, b, i) => { const p = petViewed(); if (!p) return; const bi = Math.floor(i / 5), ni = i % 5; if (!PET_TAL[bi]) return; const t = petTalState(p, bi, ni); if (!t.can) { sfx('deny'); return; } const tl = petTl(p); tl[i]++; p.tl = tl.join(''); persist(); computeStats(); sfx('click'); openChar('pet'); };
ON.pettalreset = () => { const p = petViewed(), cost = p ? 50 + p.lv * 15 : 0; if (!p || !petHero() || P.gold < cost || !petTalUsed(p)) { sfx('deny'); return; } P.gold -= cost; p.tl = petTlFix('', p.lv); saveChar(); computeStats(); sfx('page'); openChar('pet'); };
// Magie
ON.petmgin = k => {
  const M = petM(), p = petViewed(); if (!p || !PET_SPELL[k] || !(M.runes[k] > 0)) return; p.mg = p.mg || [null, null, null];
  const i = p.mg.slice(0, petSockets(p)).findIndex(x => !PET_SPELL[x]); if (i < 0) { toast(_t('Alle Sockel sind belegt – nimm erst eine Rune heraus.'), '#ff8a7a'); sfx('deny'); return; }
  p.mg[i] = k; M.runes[k]--; if (!M.runes[k]) delete M.runes[k]; persist(); sfx('click'); openChar('pet');
};
ON.petmgout = (id, b, i) => { const M = petM(), p = petViewed(); if (!p || !p.mg || !PET_SPELL[p.mg[i]]) return; const k = p.mg[i]; p.mg[i] = null; M.runes[k] = Math.min(99, (M.runes[k] || 0) + 1); persist(); sfx('click'); openChar('pet'); };
ON.petmgmake = k => { const M = petM(), Z = PET_SPELL[k]; if (!Z || !petHero()) return; const C = { m: Z.cost, gold: Z.gold }; if (!petCostOk(C)) { sfx('deny'); return; } petCostPay(C); M.runes[k] = Math.min(99, (M.runes[k] || 0) + 1); saveChar(); sfx('buy'); toast(_t('Rune gebunden: {n}', { n: Z.n }), PET_EL[Z.el].c); openChar('pet'); };
// Zucht (im Reiter: Partner wählen; im Brutnest: beide Eltern)
ON.petbrsel = (id, b, i) => {
  if (i === 1) { if (!PET_BR.a) PET_BR.a = id; else if (PET_BR.a === id) { PET_BR.a = PET_BR.b; PET_BR.b = null; } else PET_BR.b = PET_BR.b === id ? null : id; }
  else PET_BR.b = PET_BR.b === id ? null : id;
  sfx('click'); petRe();
};
ON.petbrgo = () => {
  const M = petM(), a = M.list.find(o => o.id === PET_BR.a), b = M.list.find(o => o.id === PET_BR.b), r = petBreed(a, b);
  if (typeof r === 'string') { toast(r, '#ff6a5a'); sfx('deny'); petRe(); return; }
  PET_BR.b = null; sfx('ach'); petSnd('chirp');
  toast(_t('Ein Ei aus der Zucht! {egg} – es liegt im Brutnest.', { egg: PET_TIERS[r.tier].egg }), PET_TIERS[r.tier].c); petRe();
};
