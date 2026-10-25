'use strict';
/* =========================================================
   KLINGENHORT – Begleiter 2.0 – Eier finden, im Brutnest pflegen, schlüpfen lassen, aufziehen
   24 Kreaturen in sieben Seltenheiten (Plunder … Mythisch), jede mit eigener Pixel-Grafik und sechs Entwicklungsstufen.
   Hängt sich über HOOK/ON (js/core.js) ins Spiel ein: Brutnest-Station im Versteck (Bild, Symbol, Bildschirm).
   Konto: SAVE.meta.pets = { list: [{ id, sp, nm, lv, xp, col, c0, shiny, k, born, nw, bag: [Beute], hurt: Zeit }], act: id,
     eggs: [{ id, v: 2, sp, tier, got, need, nest, w, f, z, t, born }], hatched, first, intro, seen: [sp], cw, starter (alt) }
   Schnittstelle: petActive() · petSel() · petBagSize(p) · p.bag · petBagAdd/petBagTake · petHurt(p, min) · petIsHurt(p)
     eggGive(sp, quiet, { tier, luck }) · eggRoll(tier) · eggTierRoll(luck) · PET_TIERS · petGive(sp, o)
     petExport(i, keep) · eggExport(i, keep) · petImport(data) · petLabel(d) · petIconURL(d) · openNest(back)
   ========================================================= */

/* ---------- Daten ---------- */
const PET_MAX = 18, EGG_MAX = 9, NEST_MAX = 3, EGG_NEED = 150;
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
// nach Seltenheit sortiert (Sammlung, Tests)
const PET_ORDER = ['schnecke', 'assel', 'taube', 'maus', 'kroete', 'huhn', 'fuchs', 'igel', 'fleder', 'irrlicht', 'katze', 'natter', 'eule', 'kaefer', 'drache', 'funke', 'golem', 'wolf', 'phoenix', 'greif', 'eisdrache', 'einhorn', 'schlange', 'wal'];
const PET_BYT = PET_TIERS.map((_, t) => PET_ORDER.filter(sp => PET_SP[sp].t === t));
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
function petAtkCd(p) { return 1.2 - petStage(p.lv) * .05; }
// Schaden je Treffer in Anteilen der Heldenwaffe; die Seltenheit der Art skaliert ihn (Selten = 1, Plunder 0,3, Mythisch 1,6)
function petDmgK(lv, sp) { return (.15 + lv * .006) * (sp ? PET_TIERS[PET_SP[sp].t].mul : 1); }
function petMagR(lv) { return lv < 10 ? 0 : 70 + (lv - 10) * 1.4; }
// Konto-Daten; fehlende Felder (z. B. aus Tests oder alten Ständen) still ergänzen
function petM() {
  const M = SAVE && SAVE.meta && SAVE.meta.pets; if (!M) return M;
  if (!Array.isArray(M.list)) M.list = []; if (!Array.isArray(M.eggs)) M.eggs = []; if (!Array.isArray(M.seen)) M.seen = [];
  return M;
}
// Ausgewählter Begleiter (auch verletzt) bzw. der, der wirklich mitkämpft (null, wenn verletzt)
function petSel() { const M = petM(); if (!M || !M.act) return null; for (const p of M.list) if (p.id === M.act) return p; return null; }
function petActive() { const p = petSel(); return p && !petIsHurt(p) ? p : null; }
function petName(p) { return p.nm ? p.nm : PET_SP[p.sp].n; }
function petTier(sp) { return PET_TIERS[PET_SP[sp] ? PET_SP[sp].t : 0]; }
// Beutel: Plätze nach Seltenheit, ab Uralt (LV 75) einer mehr
function petBagSize(p) { return p && PET_SP[p.sp] ? petTier(p.sp).bag + (petStage(p.lv) >= 4 ? 1 : 0) : 0; }
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
const PET_CMN = { k: '#1a1420', h: '#ffffff', o: '#140f1a', y: '#ffd24a', Y: '#fff3a0', p: '#ff8aa8', r: '#e8402a' };
function petPal(sp, col) {
  const S = PET_SP[sp], P0 = S.pal, V = col > 0 && col < 6 ? petVariants(sp)[col].v : null, base = petRgbHsl(...hexRgb(P0.m[2]))[0], pal = {};
  for (const k in PET_CMN) pal[k] = hexRgb(PET_CMN[k]);
  for (const g of ['m', 'a', 'b', 'w']) P0[g].forEach((c, i) => { pal[g + i] = V && (g === 'm' || g === 'w') ? petVarCol(c, V, base) : hexRgb(c); });
  pal.e = hexRgb(P0.e); pal.g = hexRgb(P0.g);
  if (col === 6) { pal.a0 = hexRgb('#b898d0'); pal.a1 = hexRgb('#f0d8f8'); pal.a2 = hexRgb('#ffffff'); pal.o = hexRgb('#2a1438'); }
  return pal;
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
function petStrip(sp, s, col, shiny) {
  col = shiny && col === 6 ? 6 : clamp(col | 0, 0, 5); const key = sp + s + ':' + col; if (PET_STRIP[key]) return PET_STRIP[key];
  const fr = [];
  for (let i = 0; i < 9; i++) { const b = PB(64, 64); PET_ART[sp](b, s, i % 4, i >= 4 && i < 8, i === 8); if (s === 5) pbOutline(b, 'y'); pbOutline(b, 'o'); fr.push(b); }
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0;
  for (const b of fr) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (b.a[y * 64 + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const W = x1 - x0 + 1, H = y1 - y0 + 1, pal = petPal(sp, col), shine = col === 6;
  const c = mk(W * 9, H); const g = c.getContext('2d');
  fr.forEach((b, i) => petPaint(g, b, pal, i * W, 0, x0, y0, W, H, i, shine));
  return PET_STRIP[key] = { c, W, H, ax: PET_CX - x0, ay: PET_GY - y0, sil: null };
}
function petStripOf(p) { return petStrip(p.sp, petStage(p.lv), p.col, p.shiny); }
// Bild-URLs für Menüs: einzelnes Bild bzw. 4 Bilder Ruhe-Animation
function petImgURL(sp, s, col, shiny, anim) {
  const S = petStrip(sp, s, col, shiny), key = sp + s + ':' + (shiny && col === 6 ? 6 : col) + (anim ? 'a' : 'i'); if (PET_URLS[key]) return PET_URLS[key];
  const c = mk(S.W * (anim ? 4 : 1), S.H, g => g.drawImage(S.c, 0, 0, S.W * (anim ? 4 : 1), S.H, 0, 0, S.W * (anim ? 4 : 1), S.H));
  return PET_URLS[key] = { url: c.toDataURL(), W: S.W, H: S.H };
}
function petURL(p, anim) { return petImgURL(p.sp, petStage(p.lv), p.col, p.shiny, anim); }
function eggURL(t, cr, el) { const key = 'egg' + t + ':' + cr + ':' + (el || ''); return PET_URLS[key] || (PET_URLS[key] = eggCanvas(t, cr, el).toDataURL()); }
// Schwarze Umrisse für noch nicht entdeckte Arten (Sammlung)
function petSilURL(sp) { const key = 'sil' + sp; if (PET_URLS[key]) return PET_URLS[key]; const S = petStrip(sp, 0, 0, false); return PET_URLS[key] = mk(S.W, S.H, g => g.drawImage(silhouette(S.c, '#463c56'), 0, 0, S.W, S.H, 0, 0, S.W, S.H)).toDataURL(); }

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
  return p;
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
    case 'egg': return e.d && PET_SP[e.d.sp] ? { t: 'egg', d: { egg: 1, sp: e.d.sp, tier: PET_SP[e.d.sp].t } } : null;
    case 'gold': return { t: 'gold', n: n(e.n) };
  }
  return null;
}
/* Ei: { id, v: 2, sp, tier, got (Pflege-Sekunden), need, nest (liegt im Nest), w/f/z (Wärme, Futter, Zuwendung 0–1 zum Zeitpunkt t) }
   Alte Eier ({ sp, need, got } nach Siegen) behalten ihren Anteil am Fortschritt */
function eggFix(o) {
  if (!o || typeof o !== 'object' || !PET_SP[o.sp]) return null;
  const tier = PET_SP[o.sp].t, need = PET_TIERS[tier].care, now = Date.now(), n = v => (isFinite(+v) ? +v : 0);
  if (o.v !== 2) { const q = clamp(n(o.got) / Math.max(1, n(o.need) || EGG_NEED), 0, 1); return { id: uid(), v: 2, sp: o.sp, tier, got: Math.round(q * need), need, nest: 1, w: 0, f: 0, z: 0, t: now, born: now }; } // ins Nest, solange Platz ist (siehe meta)
  return { id: typeof o.id === 'string' && o.id ? o.id.slice(0, 24) : uid(), v: 2, sp: o.sp, tier, got: clamp(n(o.got), 0, need), need, nest: o.nest ? 1 : 0, w: clamp(n(o.w), 0, 1), f: clamp(n(o.f), 0, 1), z: clamp(n(o.z), 0, 1), t: Math.min(now, n(o.t) || now), born: n(o.born) || now };
}
// intro: false = Hedda erklärt das Brutnest beim nächsten Blick auf die Weltkarte (nur nach dem ersten Ei vom Boss; alte Stände bekommen Hinweise beim Start)
// Sammel-Belohnungen: bei so vielen entdeckten Arten gibt es Glücksmünzen
const PET_CW = [[4, 2], [8, 3], [12, 5], [16, 8], [20, 12], [24, 25]];
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
    m.pets = { list, eggs, act: list.some(p => p.id === d.act) ? d.act : null, starter: !!d.starter, hatched, first: d.first != null ? !!d.first : (list.length > 0 || eggs.length > 0 || hatched > 0), intro: d.intro != null ? !!d.intro : true, seen: [...seen], cw: d.cw != null ? clamp(Math.floor(+d.cw) || 0, 0, PET_CW.length) : petCwLevel(seen.size) };
    if (d.bad) m.pets.bad = d.bad;
  } catch (e) { console.error('Begleiter (meta):', e); m.pets = { list: [], eggs: [], act: null, starter: !!d.starter, hatched: 0, first: true, intro: true, seen: [], cw: 0, bad: d }; }
});

/* ---------- Schnittstelle (Tausch, Basar, Verlorene Lande) ---------- */
// Echter, aktiver Held (auf dem Titel steht sonst nur ein Platzhalter)
function petHero() { return !!(P && SAVE && SAVE.active >= 0 && SAVE.chars[SAVE.active] && SAVE.chars[SAVE.active].id === P.id && P.mats); }
// Seltenheit eines neuen Eis: Glück 0 = Kampagne, 1–4 = Stufen der Verlorenen Lande (Kommazahlen gehen auch)
function eggTierRoll(luck) { const f = 1 + .35 * clamp(+luck || 0, 0, 10), W = {}; EGG_W.forEach((w, t) => { W[t] = w * Math.pow(f, t); }); return +wpick(W); }
// Zufällige Art einer Seltenheit
function eggRoll(tier) { const L = PET_BYT[clamp(Math.floor(+tier) || 0, 0, PET_TIERS.length - 1)]; return L.length ? pick(L) : pick(PET_ORDER); }
// Sammlung: neue Art eintragen, Belohnungen auszahlen (nur mit echtem Helden, sonst später)
function petSeen(sp) { const M = petM(); if (!M || !PET_SP[sp]) return; if (!M.seen.includes(sp)) M.seen.push(sp); petCwPay(); }
function petCwPay() {
  const M = petM(); if (!M || !petHero()) return;
  const l = petCwLevel(M.seen.length);
  while ((M.cw || 0) < l) { const [n, c] = PET_CW[M.cw || 0]; M.cw = (M.cw || 0) + 1; gainFate(c); toast(_t('Sammlung: {n} Arten entdeckt! +{c} Glücksmünzen', { n, c }), '#ffd24a'); }
}
// Neuer Begleiter: o = { lv, xp, col, shiny, nm, nw } → Begleiter oder null (kein Platz)
function petGive(sp, o) {
  const M = petM(); o = o || {}; if (!M || !PET_SP[sp] || M.list.length >= PET_MAX) return null;
  const c0 = clamp((o.col | 0), 0, 5), p = petFix({ sp, nm: o.nm || '', lv: o.lv || 1, xp: o.xp || 0, c0, col: o.shiny ? 6 : c0, shiny: !!o.shiny, nw: o.nw }, true);
  M.list.push(p); if (!M.act) M.act = p.id; petSeen(sp); persist(); if (P && P.st) computeStats(); return p;
}
function eggNew(sp) { const t = PET_SP[sp].t, now = Date.now(); return { id: uid(), v: 2, sp, tier: t, got: 0, need: PET_TIERS[t].care, nest: nestEggs().length < NEST_MAX ? 1 : 0, w: 0, f: 0, z: 0, t: now, born: now }; }
// Neues Ei → das Ei (wahr) oder false (Korb voll). Ohne gültige Art: Seltenheit o.tier oder ausgewürfelt mit Glück o.luck
function eggGive(sp, quiet, o) {
  const M = petM(); if (!M) return false; o = o || {};
  if (!PET_SP[sp]) sp = eggRoll(o.tier != null ? o.tier : eggTierRoll(o.luck || 0));
  if (M.eggs.length >= EGG_MAX) { if (!quiet) toast(_t('Dein Brutnest ist voll – mehr als {n} Eier passen nicht hinein.', { n: EGG_MAX }), '#ff6a5a'); return false; }
  const g = eggNew(sp); M.eggs.push(g); persist();
  if (!quiet) { toast(_t('{egg}! Pflege es im Brutnest, dann schlüpft es.', { egg: PET_TIERS[g.tier].egg }), PET_TIERS[g.tier].c); sfx('loot'); }
  return g;
}
// Daten eines Begleiters zum Verschicken; entfernt ihn (außer keep) → { sp, nm, lv, xp, col, c0, shiny, k, born } oder null
// Was noch im Beutel des Begleiters steckt, bekommt vorher der Absender (ohne Helden: kein Verschicken)
function petExport(i, keep) {
  const M = petM(), p = M && M.list[i]; if (!p) return null;
  if (!keep && p.bag && p.bag.length) { if (!petHero()) return null; petBagEmpty(p); }
  const d = { sp: p.sp, nm: p.nm, lv: p.lv, xp: p.xp, col: p.col, c0: p.c0, shiny: !!p.shiny, k: p.k || 0, born: p.born };
  if (!keep) { M.list.splice(i, 1); if (M.act === p.id) M.act = M.list.length ? M.list[0].id : null; if (petView === p.id) petView = null; persist(); if (P && P.st) computeStats(); }
  return d;
}
function eggExport(i, keep) { const M = petM(), g = M && M.eggs[i]; if (!g) return null; const d = { egg: 1, sp: g.sp, tier: g.tier, need: g.need, got: Math.floor(g.got) }; if (!keep) { M.eggs.splice(i, 1); persist(); } return d; }
// Empfangen: Begleiter oder Ei ({ egg: 1, … }; die Pflege beginnt von vorn) → true/false (ungültig oder kein Platz)
function petImport(d) {
  const M = petM(); if (!M || !d || typeof d !== 'object') return false;
  if (d.egg) { if (!PET_SP[d.sp] || M.eggs.length >= EGG_MAX) return false; M.eggs.push(eggNew(d.sp)); persist(); return true; }
  const p = petFix(Object.assign({}, d, { nw: 1, bag: [], hurt: 0 }), true); if (!p || M.list.length >= PET_MAX) return false;
  M.list.push(p); if (!M.act) M.act = p.id; petSeen(p.sp); persist(); if (P && P.st) computeStats(); return true;
}
function petFree() { const M = petM(); return M ? PET_MAX - M.list.length : 0; }
function eggFree() { const M = petM(); return M ? EGG_MAX - M.eggs.length : 0; }
// Vorschau für Tausch, Basar und Beute: Text und Bild zu exportierten Daten (Eier verraten nur die Seltenheit)
function petLabel(d) { if (!d || !PET_SP[d.sp]) return ''; if (d.egg) return PET_TIERS[PET_SP[d.sp].t].egg; const lv = clamp(d.lv | 0 || 1, 1, 100); return _t('{name} · LV {lv} · {stage}', { name: d.nm ? String(d.nm).slice(0, 16) : PET_SP[d.sp].n, lv, stage: PET_STN[petStage(lv)] }) + (d.shiny ? ' ✦' : ''); }
function petIconURL(d) { if (!d || !PET_SP[d.sp]) return ''; if (d.egg) return eggURL(PET_SP[d.sp].t, 0); return petImgURL(d.sp, petStage(clamp(d.lv | 0 || 1, 1, 100)), d.col | 0, !!d.shiny, false).url; }

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
  }
  return '';
}
/* ---------- Verletzung ---------- */
function petHurt(p, min) {
  if (!p || !PET_SP[p.sp]) return;
  p.hurt = Math.max(p.hurt || 0, Date.now() + clamp(+min || 60, 1, 24 * 60) * 60000);
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
  const shiny = Math.random() < .01, c0 = ri(0, 5), p = petGive(g.sp, { col: c0, shiny, nw: 1 }); M.hatched++;
  if (!quiet) toast(_t('Geschlüpft: {what}', { what: shiny ? _t('Ein schillernder {name}! (1 zu 100)', { name: PET_SP[p.sp].n }) : PET_SP[p.sp].n }), '#ffd24a');
  persist(); if (petHero()) saveChar();
  return p;
}
function petKill(e) {
  const M = petM(); if (!M) return;
  const p = petActive(); if (p) petXP(p, Math.max(1, Math.round((e.xp || 0) * .5)));
  // Champions: 5 % Ei mit etwas Glück
  if (e.champ && !e.boss) { if (Math.random() < .05 && M.eggs.length < EGG_MAX) { txt(e.x, e.y - 30, _t('BEGLEITER-EI!'), '#ffd24a', true); eggGive(null, false, { luck: .4 }); } return; }
  if (!e.boss) return;
  // Das erste Ei: garantiert vom ersten besiegten Boss der Geschichte (meist gewöhnlich)
  if (!M.first && G && G.type === 'boss' && !G.daily) {
    M.first = true; M.intro = false; const g = eggGive(null, true, { tier: +wpick({ 1: 70, 2: 25, 3: 5 }) });
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
const PET_RT = { id: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, face: 1, ph: 0, cd: 1, spc: 8, mv: false, dash: null, seq: null, storm: null, idle: 0, sleep: false, bl: 3, blk: 0, fl: 0, g: 0, lt: 0, wan: null, wanT: 0, atk: 0 };
let PET_BOLTS = [], PET_FX = [];
function petAlive(e) { return !!e && !e.dead && e.st !== 'spawn' && !(e.under > 0) && !(e.fade > .6) && e.ai !== 'dummy'; }
function petPlace(puff) {
  const p = petActive(); PET_RT.id = p ? p.id : null; PET_RT.g = G; PET_BOLTS = []; PET_FX = []; PET_RT.dash = PET_RT.seq = PET_RT.storm = PET_RT.wan = null; PET_RT.idle = 0; PET_RT.sleep = false;
  if (!p || !P) return;
  const bd = typeof BD !== 'undefined' ? BD : { x0: 0, x1: 9999, y0: 0, y1: 9999 };
  PET_RT.x = clamp(P.x - (P.face || 1) * 16, bd.x0 + 6, bd.x1 - 6); PET_RT.y = clamp(P.y + 3, bd.y0, bd.y1); PET_RT.vx = PET_RT.vy = 0; PET_RT.face = P.face || 1;
  PET_RT.z = PET_SP[p.sp].fly ? 12 : 0; PET_RT.cd = 1; PET_RT.spc = 6; PET_RT.lt = T;
  if (puff && state === 'play') { burst(PET_RT.x, PET_RT.y, 6, PET_EL[PET_SP[p.sp].el].c, 14, 45, 1); petSnd('puff'); }
}
// Werte eines Angriffs: wie die Waffe des Helden, aber schwächer, mit dem Element der Art
function petW(p) {
  const w = playerW(), S = PET_SP[p.sp];
  w.dmg *= petDmgK(p.lv, p.sp); w.crit = Math.min(.6, w.crit * .5 + (S.crit || .05)); w.leech = 0; w.kb *= .4; w.chained = true;
  // Element bestimmt die Nebenwirkung: Feuer brennt, Frost verlangsamt, Gift vergiftet
  w.burn = S.el === 'feuer' ? .3 : 0; w.frost = S.el === 'frost' ? .45 : 0; w.poison = S.el === 'gift';
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
    if (p.lv >= 50 && PET_RT.spc <= 0 && !PET_RT.seq) { const t = nearestEnemy(160, P); if (t && petAlive(t)) { petSpecial(p, t); PET_RT.spc = petSpecCd(p.lv); } else PET_RT.spc = .6; }
  }
  // Beutemagnet ab LV 10
  if (play && p.lv >= 10) {
    const R = petMagR(p.lv), R2 = R * R;
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
        if (b.kind === 'fire') fxAnim('boom', b.x, b.y - b.h, { sc: .28, dur: .3 }); else burst(b.x, b.y, b.h, col, b.kind === 'flame' ? 3 : 8, 45, 1);
        if (b.pierce) (b.hit = b.hit || new Set()).add(e); else { b.t = 0; break; }
      }
    }
    if (b.x < BD.x0 - 12 || b.x > BD.x1 + 12 || b.y < BD.y0 - 20 || b.y > BD.y1 + 12) b.t = 0;
  }
  PET_BOLTS = PET_BOLTS.filter(b => b.t > 0);
  for (const f of PET_FX) {
    f.t -= dt;
    if (f.k === 'beam' && petAlive(f.tg)) { f.tx = f.tg.x; f.ty = f.y = f.tg.y; }
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
  if (this.kind === 'fire') petFxFrame('fireball', Math.floor(T * 14 + this.x * .1), x, y, .55, a);
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
  if (p.sp === 'katze') ctx.globalAlpha = .9 + .08 * Math.sin(T * 3);
  ctx.drawImage(S.c, fi * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H);
  if (PET_RT.fl > 0) { if (!S.sil) S.sil = silhouette(S.c, '#ffffff'); ctx.globalAlpha = Math.min(1, PET_RT.fl * 1.6) * .85; ctx.drawImage(S.sil, fi * S.W, 0, S.W, S.H, -S.ax, -S.ay, S.W, S.H); }
  ctx.restore(); ctx.globalAlpha = 1;
  // Goldkäfer leuchtet wie eine Laterne, Feuer und Blitz glühen
  if (Sp.el === 'licht') addLight(x, y - z - S.H * .4, 40 + st * 6, .8 + .1 * Math.sin(T * 3));
  else if (Sp.el === 'feuer' || Sp.el === 'blitz' || st >= 4 || (G && G.dark)) addLight(x, y - z - S.H * .4, 18 + st * 4, Sp.el === 'schatten' || Sp.el === 'gift' ? .35 : .55);
  if (PET_RT.sleep) { ctx.fillStyle = '#e8f0ff'; for (let i = 0; i < 3; i++) { const t = (T * .5 + i / 3) % 1, zx = x + PET_RT.face * Math.round(S.W * .2) + Math.round(t * 6), zy = y - z - S.ay + 4 - Math.round(t * 14); ctx.globalAlpha = Math.sin(t * Math.PI); ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1); } ctx.globalAlpha = 1; }
}
const PET_DRAW = { y: 0, draw: drawPet };
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
SPEAKERS.hedda = { n: _t('Nestmutter Hedda'), sp: 'dwarff', c: '#ffb878' };
BUILD.brutnest.npc = SPEAKERS.hedda.n; BUILD.brutnest.body = 'dwarff';
NPCTALK.brutnest = [
  [1, 'hedda', _t('Wärme, Futter, Zuwendung. Fehlt eins davon, schläft das Küken im Ei einfach weiter.')],
  [1, 'hedda', _t('Sind alle drei Bedürfnisse gut gefüllt, wächst ein Ei anderthalbmal so schnell.')],
  [1, 'hedda', _t('Streichle die Eier ruhig. Die spüren das. Wirklich.')],
  [2, 'hedda', _t('Aus einem schmutzigen Ei schlüpft meist eine Schnecke. Aber man liebt sie trotzdem.')],
  [4, 'hedda', _t('Ein mythisches Ei braucht Tage. Und Sternenstaub. Und Geduld. Vor allem Geduld.')]
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
HOOK.stats.push(petSafe('stats', add => { const p = petActive(); if (!p) return; const v = petPas(p); for (const k in v) add(k, v[k]); }));
// Giftzahn der Natter: Treffer des Helden vergiften manchmal
HOOK.afterHit.push(petSafe('afterHit', (e, w, dmg) => { if (!e || e.dead || (w && w.pet)) return; const c = mod('pgift'); if (c && Math.random() < c) { e.poison = Math.max(e.poison || 0, 3); e.poisonDmg = Math.max(e.poisonDmg || 0, Math.max(1, Math.round(dmg * .2))); } }));
HOOK.draw.push(petSafe('draw', list => {
  const M = petM(); if (!M || !P) return;
  // erstes Ei (oder erstes Ei seit dem Brutnest): Hedda erklärt es auf der Weltkarte
  if (M.intro === false && M.eggs.length && !PET_UI.introQ && state === 'map' && !ov.hidden && $('mapcv') && !DLG) { PET_UI.introQ = true; setTimeout(petIntro, 0); }
  const sel = petSel();
  if (sel && petIsHurt(sel) && G && G.type === 'versteck' && typeof hidePos === 'function') { const h = hidePos('brutnest'); PET_HURT.x = h.x - 26; PET_HURT.y = h.y + 3; list.push(PET_HURT); }
  const p = petActive(); if (!p) return;
  if ((state === 'title' || state === 'map' || state === 'menu') && T > PET_RT.lt) petTick(Math.min(.05, T - PET_RT.lt));
  if (PET_RT.id !== p.id) return;
  PET_DRAW.y = PET_RT.y; list.push(PET_DRAW);
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
  dialog(first ? [['hedda', _t('Ein Ei! Das hast du dem Boss abgenommen? Bring es zu mir ins Brutnest – ich wohne jetzt im Versteck.')], ['hedda', _t('Halt es warm, füttere es und schenk ihm Zuwendung. Dann wächst es – auch während du unterwegs bist.')], ['hedda', _t('Irgendwann schlüpft daraus dein erster Begleiter. Komm, ich zeig dir das Nest.')]]
    : [['hedda', _t('Ich bin Hedda und kümmere mich ab jetzt um das Brutnest im Versteck.')], ['hedda', _t('Eier schlüpfen nicht mehr von allein: Halt sie warm, füttere sie und schenk ihnen Zuwendung. Dann wachsen sie, auch während du unterwegs bist.')]],
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
  return `<h3>${_t('BEUTEL {n}/{max}', { n: bag.length, max: n })}</h3><p class="sub" style="margin-top:0">${_t('Fällst du in den Verlorenen Landen, rettet dein Begleiter, was in seinem Beutel liegt. Seltenere Arten tragen mehr.')}</p><div class="pbag">${cells}</div>${bag.length ? `<div class="acts" style="justify-content:flex-start;margin-top:6px"><button class="btn alt sm" data-act="petbag" data-id="${p.id}">${_t('Alles herausnehmen')}</button></div>` : ''}`;
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
  const M = petM(), n = M.seen.length, nx = PET_CW.find(([k]) => k > n);
  const cells = PET_ORDER.map(sp => { const S = PET_SP[sp], seen = M.seen.includes(sp); return `<span class="${seen ? '' : 'no'}" style="--tc:${PET_TIERS[S.t].c}" title="${seen ? esc(S.n) : '???'}" aria-label="${seen ? esc(S.n) : '???'}"><img src="${seen ? petImgURL(sp, 0, 0, false, false).url : petSilURL(sp)}" alt=""></span>`; }).join('');
  return `<h3>${_t('SAMMLUNG {n}/{max}', { n, max: PET_ORDER.length })}</h3>${nx ? `<div class="pbar thin" style="--c:var(--gold);margin-top:0"><i style="width:${(n / nx[0] * 100).toFixed(1)}%"></i></div><p class="sub" style="margin:2px 0 6px">${_t('Nächste Belohnung: {n} Arten entdeckt → +{c} Glücksmünzen', { n: nx[0], c: nx[1] })}</p>` : `<p class="sub" style="margin:0 0 6px">${_t('Alle Arten entdeckt!')}</p>`}<div class="ncol">${cells}</div>`;
}
function petTabHTML() {
  const M = petM(); if (!M) return '';
  const p = petViewed();
  if (!p) return `<div class="split"><div><div class="box"><p class="sub" style="margin-top:0">${_t('Gerade begleitet dich niemand. Begleiter schlüpfen aus Eiern, die du im Brutnest im Versteck pflegst: Wärme, Futter und Zuwendung.')}</p></div>${petNestHTML(M)}</div><div>${petColHTML()}</div></div>`;
  if (p.nw) { p.nw = 0; persist(); }
  petView = p.id;
  const S = PET_SP[p.sp], st = petStage(p.lv), E = PET_EL[S.el], act = M.act === p.id, hurt = petIsHurt(p), sc = 4, U = petURL(p, true), need = petNeed(p.lv), nx = PET_STAGE.find(l => l > p.lv), q = p.lv >= 100 ? 1 : p.xp / need;
  const prev = `<div class="petprev${hurt ? ' hurt' : Date.now() - PET_UI.fed < 700 ? ' yum' : ''}" style="width:${Math.max(132, U.W * sc + 24)}px;height:${Math.max(120, U.H * sc + (S.fly ? 46 : 30))}px;--pg:${st >= 4 ? `rgba(${E.rgb},.45)` : 'var(--stone-hi)'}">${petSprHTML(U, sc, S.fly && !hurt)}</div>`;
  const info = `<div class="petinfo"><div class="petnm">${esc(petName(p))}${p.shiny ? ' <span style="color:#ff9af0">✦</span>' : ''}</div>
    <div class="st" style="font-size:17px;margin-top:5px">${p.nm ? S.n + ' · ' : ''}${PET_STN[st]} · ${tierPill(S.t)} <span class="pel" style="background:${E.c}">${E.n}</span></div>
    <div class="stats" style="margin:8px 0 0"><span>${_t('LV {lv}', { lv: p.lv })}</span><span>${_t('SIEGE {n}', { n: fmt(p.k || 0) })}</span>${act && !hurt ? `<span style="color:var(--moss)">${_t('BEGLEITET DICH')}</span>` : ''}${hurt ? `<span style="color:#ff8a7a">${_t('VERLETZT')}</span>` : ''}</div>
    ${petHurtHTML(p)}
    <div class="pbar" style="--c:${E.c}"><i style="width:${(q * 100).toFixed(1)}%"></i></div>
    <div class="st">${p.lv >= 100 ? _t('Höchste Stufe – ein mythischer Gefährte!') : _t('EP {a}/{b} bis LV {lv}', { a: fmt(p.xp), b: fmt(need), lv: p.lv + 1 })}</div>
    ${nx ? `<div class="pbar thin" style="--c:var(--gold)"><i style="width:${((p.lv - PET_STAGE[st]) / (nx - PET_STAGE[st]) * 100).toFixed(1)}%"></i></div><div class="st">${_t('Nächste Entwicklung: {stage} ab LV {lv}', { stage: PET_STN[petStage(nx)], lv: nx })}</div>` : ''}
    <div class="acts" style="justify-content:flex-start;margin-top:8px">${act ? `<button class="btn alt sm" data-act="petact" data-id="${p.id}">${_t('Zurücklassen')}</button>` : `<button class="btn sm" data-act="petact" data-id="${p.id}">${_t('Mitnehmen')}</button>`}<button class="btn alt sm" data-act="petren">${_t('Umbenennen')}</button>${petRel ? `<button class="btn red sm" data-act="petrelok">${_t('Wirklich freilassen?')}</button><button class="btn alt sm" data-act="petrelno">${_t('Nein')}</button>` : `<button class="btn alt sm" data-act="petrel" ${M.list.length > 1 ? '' : 'disabled'}>${_t('Freilassen')}</button>`}</div></div>`;
  const ren = petRen ? `<div class="acts" style="justify-content:flex-start;flex-wrap:nowrap;margin-top:10px"><input type="text" id="petnm" maxlength="14" value="${esc(p.nm)}" placeholder="${esc(S.n)}" style="flex:1;min-width:0"><button class="btn sm" data-act="petrenok">${_t('OK')}</button></div>` : '';
  const cols = petCols(p), V = petVariants(p.sp);
  const sws = [0, 1, 2, 3, 4, 5].map(c => { const j = (c - p.c0 + 6) % 6, ok = cols.includes(c), pl = petPal(p.sp, c); return `<button class="sw${p.col === c ? ' sel' : ''}" data-act="petcol" data-i="${c}" ${ok ? '' : 'disabled'} title="${ok ? V[c].n : _t('{n} – ab LV {lv}', { n: V[c].n, lv: PET_STAGE[j] })}" aria-label="${V[c].n}" style="background:linear-gradient(135deg,rgb(${pl.m2}) 55%,rgb(${pl.m0}) 55%)"></button>`; }).join('')
    + (p.shiny ? `<button class="sw${p.col === 6 ? ' sel' : ''}" data-act="petcol" data-i="6" title="${_t('Schillernd')}" aria-label="${_t('Schillernd')}" style="background:linear-gradient(135deg,#ff9af0,#9ad0ff 40%,#c8f06a 70%,#ffe08a)"></button>` : '');
  const wd = playerW().dmg, pv = petPas(p), pmax = petPas({ sp: p.sp, lv: 100 }), pmin = petPas({ sp: p.sp, lv: 25 });
  const rows = [
    [1, S.an, S.ad + ' ' + _t('Schaden {d} ({p} deiner Waffe), alle {s} s.', { d: Math.round(wd * petDmgK(p.lv, p.sp)), p: pct(petDmgK(p.lv, p.sp)), s: petAtkCd(p).toLocaleString(LOCALE, { maximumFractionDigits: 2 }) })],
    [10, _t('Beutemagnet'), _t('Zieht Münzen, Material und Edelsteine aus {r} Schritt Entfernung zu dir.', { r: Math.round(petMagR(Math.max(10, p.lv))) })],
    [25, S.pn, p.lv >= 25 ? _t('Jetzt: {now}. Bei LV 100: {max}.', { now: petPasText(pv), max: petPasText(pmax) }) : _t('{min}, wächst bis LV 100 auf {max}.', { min: petPasText(pmin), max: petPasText(pmax) })],
    [50, S.sn, S.sd + ' ' + _t('Alle {s} s.', { s: petSpecCd(Math.max(50, p.lv)) })],
    [75, _t('Uralte Kraft'), _t('Spezialangriff ×1,5 und alle 16 s, leuchtende Aura, ein Beutelplatz mehr.')],
    [100, _t('Mythische Kraft'), _t('Spezialangriff ×2 und alle 12 s, goldene Gestalt.')]
  ].map(([l, n, d]) => `<div class="row${p.lv < l ? ' lock' : ''}" style="cursor:default"><div class="ic plv">${_t('LV')}<br>${l}</div><div><div class="nm">${n}</div><div class="st">${d}</div></div><span></span></div>`).join('');
  const feed = `<h3>${_t('FÜTTERN')}</h3><p class="sub" style="margin-top:0">${p.lv >= 100 ? _t('Satt und mythisch – mehr geht nicht.') : _t('Übriges Material wird zu Erfahrung. Leibspeise: {mat} (doppelte EP).', { mat: MATS[S.fav].n })}</p>
    <div class="opts">${[1, 10, 100].map(n => `<button class="opt${petAmt === n ? ' sel' : ''}" data-act="petamt" data-i="${n}">×${n}</button>`).join('')}</div>
    <div class="grid">${MATORDER.map(k => { const n = P.mats[k] || 0, fav = k === S.fav; return `<button class="slot${fav ? ' fav' : ''}" data-act="petfeed" data-id="${k}" ${n && p.lv < 100 ? '' : 'disabled'} title="${MATS[k].n}" aria-label="${MATS[k].n}"><img src="${iconURL(['mat', k])}" alt=""><span class="u">+${fmt(PET_FEED[k] * (fav ? 2 : 1))}</span><span class="n">${n}</span></button>`; }).join('')}</div>`;
  const list = `<h3>${_t('DEINE BEGLEITER {n}/{max}', { n: M.list.length, max: PET_MAX })}</h3>` + M.list.map(o => `<button class="row${o.id === p.id ? ' sel' : ''}${o.id === M.act ? ' eq' : ''}" data-act="petsel" data-id="${o.id}"><div class="ic" style="box-shadow:inset 0 -3px 0 ${PET_TIERS[PET_SP[o.sp].t].c}"><img src="${petURL(o).url}" alt=""></div><div><div class="nm">${esc(petName(o))}${o.shiny ? ' ✦' : ''}${o.nw ? `<span class="badge">${_t('NEU')}</span>` : ''}</div><div class="st">${o.nm ? PET_SP[o.sp].n + ' · ' : ''}${_t('LV {lv}', { lv: o.lv })} · ${PET_STN[petStage(o.lv)]} · <span style="color:${PET_TIERS[PET_SP[o.sp].t].c}">${PET_TIERS[PET_SP[o.sp].t].n}</span>${petIsHurt(o) ? ` · <span style="color:#ff8a7a">${_t('verletzt')}</span>` : ''}</div></div>${o.id === M.act ? `<span class="pill">${_t('AKTIV')}</span>` : '<span></span>'}</button>`).join('');
  return `<div class="split"><div><div class="box"><div class="petcard">${prev}${info}</div>${ren}<h3>${_t('FARBE')} · ${petColName(p.sp, p.col)}</h3><div class="sws">${sws}</div><p class="sub" style="margin:4px 0 0">${_t('Jede Entwicklungsstufe schaltet eine neue Farbe frei.')}</p></div>${petBagHTML(p)}<h3>${_t('FÄHIGKEITEN')}</h3>${rows}</div><div>${feed}${petNestHTML(M)}${list}${petColHTML()}</div></div>`;
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
  <div class="sub" style="grid-column:2;margin:2px 0 0;font-size:15px">${hint ? _t('Du spürst darin: {el}', { el: `<span style="color:${PET_EL[hint].c}">${PET_EL[hint].n}</span>` }) : _t('Ab 50 % spürst du, was darin steckt.')}</div>
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
  const brows = basket.map(g => { const T0 = PET_TIERS[g.tier], sell = NEST_SELL === g.id; return `<div class="row" style="cursor:default"><div class="ic"><img src="${eggURL(g.tier, 0)}" alt=""></div><div><div class="nm" style="color:${T0.c}">${T0.egg}</div><div class="st">${g.got > 0 ? _t('{p} % gebrütet · ', { p: Math.floor(g.got / g.need * 100) }) : ''}${_t('Ruht – wächst nur im Nest. Pflegezeit {t}.', { t: petDur(T0.care * 1000) })}</div></div><div class="acts">${sell ? `<button class="btn red sm" data-act="nestsellok" data-id="${g.id}">+${EGG_GOLD[g.tier]} <i class="coin"></i></button><button class="btn alt sm" data-act="nestsellno">${_t('Nein')}</button>` : `<button class="btn sm" data-act="nestput" data-id="${g.id}" ${eggs.length < NEST_MAX ? '' : 'disabled'}>${_t('Ins Nest')}</button><button class="btn alt sm" data-act="nestsell" data-id="${g.id}" aria-label="${_t('Hedda geben')}">${_t('Abgeben')}</button>`}</div></div>`; }).join('');
  const tiers = PET_TIERS.map(T0 => `<div style="--tc:${T0.c}"><b>${T0.n}</b>${_t('Pflege {t} · Stärke ×{m} · Beutel {n}', { t: petDur(T0.care * 1000), m: T0.mul.toLocaleString(LOCALE), n: T0.bag })}<br>${_t('Futter: {list}', { list: T0.food.map(([k]) => k === 'gold' ? _t('Gold') : MATS[k].n).join(', ') })}</div>`).join('');
  const hurt = sel && petIsHurt(sel) ? `<div class="box" style="margin-bottom:8px;box-shadow:inset 3px 0 0 #ff8a7a"><b style="font-size:19px;font-weight:400">${esc(petName(sel))}</b>${petHurtHTML(sel)}</div>` : '';
  showOverlay(`<div class="head"><h2>${_t('BRUTNEST')}</h2><div class="hbtns"><div class="gold"><i class="coin"></i>${fmt(P.gold)}</div><button class="btn alt sm" data-act="nestback">${_t('Zurück')}</button></div></div>
  <div class="nestscr">${NEST_BACK === 'hide' ? npcLine('brutnest') : ''}${nestSummaryHTML(eggs, A)}${hurt}
  <div class="nests">${cards}</div>
  <h3>${_t('EIERKORB {n}/{max}', { n: basket.length, max: EGG_MAX - NEST_MAX })}</h3>${brows || `<p class="sub" style="margin-top:0">${_t('Leer. Neue Eier kommen ins Nest, solange dort Platz ist.')}</p>`}
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
  el.innerHTML = `<div class="kv">${tierPill(S.t)}<span class="pel" style="background:${E.c}">${E.n}</span>${p.shiny ? `<span class="pill" style="background:#ff9af0">${_t('SCHILLERND!')}</span>` : ''}${newSp ? `<span class="pill" style="background:var(--gold)">${_t('NEU IN DER SAMMLUNG')}</span>` : ''}</div>
  <h2 class="center" style="color:${PET_TIERS[S.t].c}">${esc(S.n).toLocaleUpperCase(LOCALE)}</h2><p class="sub center" style="margin:2px 0 8px">${S.st} ${_t('Angriff: {a}. Beutel: {n}.', { a: S.an, n: petBagSize(p) })}</p>
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
ON.nestsellok = id => { const M = petM(), i = M.eggs.findIndex(g => g.id === id); NEST_SELL = null; if (i < 0) return; const g = M.eggs[i]; M.eggs.splice(i, 1); P.gold += EGG_GOLD[g.tier]; saveChar(); sfx('coin'); toast(_t('Hedda nimmt das Ei und gibt dir {n} Gold.', { n: EGG_GOLD[g.tier] }), '#ffd24a'); openNest(); };
ON.nesthatch = id => hatchStart(id);
ON.hatchskip = () => { const H = HATCH; if (H && performance.now() - H.t0 < (HATCH_T + .5) / H.sp * 1000) H.t0 = performance.now() - (HATCH_T + .05) / H.sp * 1000; };
ON.hatchtake = () => { const H = HATCH, M = petM(); if (H && M.list.includes(H.p)) { M.act = H.p.id; persist(); computeStats(); petPlace(false); toast(_t('{name} begleitet dich ab jetzt!', { name: PET_SP[H.p.sp].n }), PET_EL[PET_SP[H.p.sp].el].c); } HATCH = null; openNest(); };
ON.hatchok = () => { HATCH = null; openNest(); };
