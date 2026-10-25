'use strict';
/* =========================================================
   KLINGENHORT – Geschichte: Prolog, Akte, Bosse, NPCs, Chronik
   {name} wird durch den Namen des Helden ersetzt.
   ========================================================= */

/* Sprecher: Bild (Sprite-Atlas) und Farbe des Namens */
const SPEAKERS = {
  erz:{n:'',sp:null,c:'#a8997e'},
  borin:{n:'Borin',sp:'dwarf',c:'#e8b04a'},
  mira:{n:'Mira',sp:'wizf',c:'#79c24e'},
  selis:{n:'Selis',sp:'elff',c:'#57c7e6'},
  kael:{n:'Hauptfrau Kael',sp:'knightf',c:'#f786a0'},
  ulmo:{n:'Archivar Ulmo',sp:'wizard',c:'#b892f4'},
  fortuna:{n:'Orakel Fortuna',sp:'angel',c:'#ffd24a'},
  held:{n:'{name}',sp:null,c:'#efe2bf'},
  sphinx:{n:'Sphinx',sp:null,c:'#57c7e6'}
};

const PROLOG = [
  ['erz','Vor tausend Jahren schmiedeten die Zwerge von Klingenhort Waffen, vor denen selbst Götter zitterten. Der Orden der Klinge hütete ihre Esse – das Weltenfeuer.'],
  ['erz','Dann kam Pyraxis, der Uralte Drache. Er riss das Weltenfeuer an sich, und mit seiner Glut erwachten die Schrecken der Tiefe.'],
  ['erz','Der Orden fiel in einer einzigen Nacht. Die Esse erlosch. Nur ein Schüler überlebte unter den Trümmern.'],
  ['borin','Steh auf, {name}. Ganz ruhig. Ich bin Borin – der letzte Schmied des Ordens.'],
  ['borin','Diese Ruine ist jetzt unser Versteck. Viel ist nicht übrig. Ein Lagerfeuer, ein Spiegel, ein altes Portal.'],
  ['borin','Bring mir Gold und Material, dann bauen wir es wieder auf: Schmiede, Labor, Schatzkammer – alles.'],
  ['borin','Und dann holen wir uns das Weltenfeuer zurück. Fang unten in den Kerkern an. Dort hält ein Oger unsere Leute gefangen.']
];

/* Je Akt: Titel, Einleitung, Boss-Spruch, Abschluss */
const ACTS = [
  {t:'Die Kerker von Klingenhort',i:'Unter der Ruine liegen die alten Kerker. Ogerhäuptling Grausch hält dort die letzten Überlebenden des Ordens gefangen – und sein Hunger ist groß.',b:'Frischfleisch! Meine Kinder haben Hunger, und du riechst nach Abendessen!',o:'Grausch fällt. In seinem Lager findest du eine zerknitterte Karte. Sie zeigt den Weg in die Moosgrotte.'},
  {t:'Die vergiftete Grotte',i:'Die Quellen der Moosgrotte sind schwarz geworden. Schamane Vexhal braut aus ihnen eine Armee von Orks und Schatten.',b:'Die Geister flüstern deinen Namen, Kind des Ordens. Sie flüstern nur ein Wort: tot.',o:'Mit Vexhals letztem Atemzug klärt sich das Wasser. Doch tief unter der Grotte regt sich etwas viel Älteres.'},
  {t:'Die Gruft der Ahnen',i:'In der Knochengruft ruhen die Ritter des Ordens. Moderkönig Morgul zwingt sie zurück ins Leben – gegen dich.',b:'Deine Ahnen dienen jetzt mir. Bald kniest auch du in meinen Reihen.',o:'Die Toten finden endlich Ruhe. Einer flüstert dir im Zerfallen zu: „Der Verräter … trug unser Wappen.“'},
  {t:'Das Tor der Glut',i:'Die Glutfeste bewacht den einzigen Pfad hinauf zu den Gipfeln. Höllenschlund Ignaroth ist Pyraxis\' Torwächter.',b:'Kein Sterblicher passiert dieses Tor. Kein einziger. Brenne!',o:'Das Tor ist offen. Ein eisiger Wind fegt von den Frostgipfeln herab – und trägt eine Stimme mit sich.'},
  {t:'Die Eiskönigin',i:'Einst war Frostra die größte Magierin des Ordens. Seit seinem Fall friert sie jeden ein, der ihr Reich betritt.',b:'Der Orden hat mich verraten, Schüler. Warum sollte ich ihm vergeben – oder dir?',o:'Sterbend flüstert Frostra: „Varkas … der Großmeister selbst … er hat uns alle an den Drachen verkauft.“'},
  {t:'Der Seuchenfürst',i:'Hinter den Gipfeln dampft der Giftsumpf. Seuchenfürst Morbus züchtet dort Pyraxis\' Brut in brodelnden Kesseln.',b:'Ah, ein neues Versuchsobjekt! Halt still. Das tut nur … ganz schrecklich weh.',o:'In Morbus\' Labor findest du Briefe, gesiegelt mit dem Wappen des Großmeisters Varkas. Der Weg zur Schattenzitadelle ist klar.'},
  {t:'Der Verräter',i:'Varkas, einst Großmeister des Ordens, öffnete Pyraxis die Tore. Seine Schattenzitadelle ist das letzte Bollwerk vor dem Drachenhort.',b:'Ich habe dem Orden Ewigkeit geschenkt, Schüler. Als Asche. Und dir schenke ich dasselbe.',o:'Varkas\' Klinge zerbricht. „Er … wird dich … verschlingen“, keucht er. Hinter ihm glüht der Eingang zum Drachenhort.'},
  {t:'Das Weltenfeuer',i:'Im Drachenhort liegt das Weltenfeuer – und darauf, auf einem Berg aus Gold und Knochen, Pyraxis, der Uralte.',b:'Ein Funke wagt es, das Feuer herauszufordern? Ich habe deinen Orden verschlungen, Kind. Du bist nur der Nachtisch.',o:'Pyraxis stürzt. Das Weltenfeuer gehört wieder dem Orden! Doch aus dem Riss, den der Drache hinterlässt, quillt die Leere. Die Qual beginnt.'}
];
const QUAL_INTRO = 'Die Leere frisst sich durch die Welt und verzerrt alle Gebiete. Jede Qual-Stufe ist härter – und die Beute besser. Wie weit kommst du?';

/* Gespräche im Versteck: je Figur mehrere Sätze, abhängig vom Fortschritt (ab Akt) */
const NPCTALK = {
  schmiede:[[1,'borin','Gib mir Erz, und ich gebe dir Stahl. Gib mir Drachenschuppen, und ich gebe dir eine Legende.'],[1,'borin','Zwei Klingen zu einer verschmelzen? Das ist keine Magie, das ist Handwerk. Gutes Handwerk.'],[3,'borin','Mithril singt, wenn man es schlägt. Adamant schweigt. Ich mag beides.'],[5,'borin','Das Weltenfeuer … wenn wir es zurückholen, schmiede ich dir etwas, das die Welt noch nicht gesehen hat.'],[9,'borin','Die Leere frisst sogar Eisen. Wir brauchen besseren Stahl. Viel besseren.']],
  alchemie:[[1,'mira','Ein Schleimkern, ein bisschen Mut, und – puff! – ein Heiltrank. Meistens.'],[2,'mira','Vexhals Gift war stark. Mein Gegengift ist stärker. Hoffe ich.'],[4,'mira','Elixiere sind wie Tränke, nur ehrgeiziger.'],[6,'mira','Morbus war mal mein Lehrmeister. Er hat das Brauen nie geliebt. Nur das Ergebnis.']],
  juwelier:[[1,'selis','Drei Splitter ergeben einen Stein. Drei Steine eine Krone. So einfach ist Schönheit.'],[3,'selis','Rubine für den Zorn, Saphire für den Schutz. Und Topase … für das Gold, natürlich.'],[7,'selis','Sternenstaub. Du hast echten Sternenstaub gefunden? Lass mich das veredeln!']],
  training:[[1,'kael','Schlag die Puppe. Härter. Noch härter. Gut – jetzt rollst du dich weg, bevor sie zurückschlägt.'],[2,'kael','Wer nur angreift, stirbt. Wer nur ausweicht, auch. Finde den Rhythmus.'],[5,'kael','Ich habe unter Varkas gedient. Ich hätte es sehen müssen.'],[8,'kael','Gegen einen Drachen hilft nur eins: Nicht dort stehen, wo das Feuer hinkommt.']],
  tempel:[[1,'fortuna','Das Glück ist eine Klinge ohne Griff, Sterblicher. Fass sie trotzdem an.'],[1,'fortuna','Die Sterne haben mir verraten, dass du drehen wirst. Und dass du verlierst. Und dann gewinnst.'],[4,'fortuna','Mythische Klingen schlafen tief im Rad. Wecke sie – wenn du die Geduld hast.']],
  bibliothek:[[1,'ulmo','Jede Chronikseite, die du findest, ist ein Stück unserer Geschichte. Bring sie mir.'],[3,'ulmo','Die Gruft erzählt von einem Verräter. Ich fürchte, ich kenne seinen Namen.'],[6,'ulmo','Varkas schrieb einmal: „Ewigkeit ist nur eine Frage des Preises.“ Ich hätte ihn damals schon verbrennen sollen. Das Buch, meine ich.']],
  feuer:[[1,'borin','Setz dich. Das Feuer brennt nicht ewig, aber heute Nacht reicht es.'],[2,'mira','Weißt du, warum es Klingenhort heißt? Weil hier mehr Klingen lagen als Steine. Borin hat sie alle gezählt.'],[3,'kael','Die Toten in der Gruft … manche trugen Gesichter, die ich kannte.'],[5,'ulmo','Frostra hat einmal die Sterne kartiert. Jetzt friert sie Wanderer ein. Die Zeit ist grausam.'],[8,'borin','Du hast den Drachen gestellt, {name}. Was immer jetzt kommt – wir stehen hinter dir.']]
};

/* Chronikseiten: gefunden in Truhen, bei Elite-Gegnern und Bossen */
const LORE = [
  ['Die erste Esse','Die Zwerge fanden das Weltenfeuer in einer Höhle, in der kein Licht hätte brennen dürfen. Sie bauten Klingenhort um die Flamme herum – Stein für Stein, Klinge für Klinge.'],
  ['Der Eid des Ordens','„Wir schmieden nicht, um zu herrschen. Wir schmieden, damit niemand herrschen muss.“ – Eid des Ordens der Klinge'],
  ['Borins Lehrjahre','Borin brauchte siebzig Jahre, um seine erste Klinge zu vollenden. Er hat sie nie benutzt. Sie hängt bis heute über seiner Esse.'],
  ['Oger und Ketten','Grausch war einst ein Arbeiter in den Minen. Die Ketten, die er heute trägt, schmiedete der Orden für ihn. Er hat es nie vergessen.'],
  ['Die schwarzen Quellen','Vexhal verdünnte das Blut eines Drachen in den Quellen der Grotte. Seither wachsen dort Pilze, die flüstern.'],
  ['Totenwache','Die Ritter des Ordens wurden in voller Rüstung bestattet, das Schwert auf der Brust. „Damit sie bereit sind“, hieß es. Morgul nahm das wörtlich.'],
  ['Die Glutfeste','Ignaroth wurde aus der ersten Flamme geboren, die Pyraxis stahl. Er kennt nichts außer dem Befehl, das Tor zu bewachen.'],
  ['Frostras Sternkarte','Frostra kartierte 1.204 Sterne. Neben den letzten schrieb sie: „Er lügt. Varkas lügt. Warum glaubt mir niemand?“'],
  ['Brut im Kessel','Morbus\' Notizen: „Tag 31. Die Brut wächst. Sie frisst Glutstein, Eisen und schlechte Laune. Vor allem Letzteres.“'],
  ['Der Großmeister','Varkas war der jüngste Großmeister in der Geschichte des Ordens. Er fürchtete nur eines: zu altern.'],
  ['Der Pakt','Pyraxis versprach Varkas Ewigkeit. Er hielt sein Wort auf seine Art: Varkas\' Herz schlägt nicht mehr, doch er stirbt auch nicht.'],
  ['Pyraxis','Der Uralte war schon alt, als die Zwerge jung waren. Er schläft auf dem Weltenfeuer, weil es das Einzige ist, das ihn noch wärmt.'],
  ['Mithril','Mithril ist leicht wie Federn und hart wie Reue. Es wächst in Adern unter dem ewigen Eis der Frostgipfel.'],
  ['Adamant','Adamant entsteht, wo Gift und Gestein sich jahrhundertelang umarmen. Der Giftsumpf ist voll davon – und voller Narren, die es schürfen wollen.'],
  ['Sternenstaub','Wenn ein Stern stirbt, fällt sein Staub in die Schattenzitadelle. Varkas sammelte ihn, um sich eine Krone zu schmieden.'],
  ['Ätherium','Ätherium ist kein Metall. Es ist erstarrtes Licht des Weltenfeuers. Wer es schmiedet, schmiedet ein Stück Morgen.'],
  ['Mimiks','Mimiks ahmen Truhen nach, weil Abenteurer Truhen lieben. Die klügsten Mimiks ahmen inzwischen Goldhaufen nach.'],
  ['Das Glücksrad','Fortuna sagt, das Rad sei älter als der Orden. Borin sagt, er habe es vor zwanzig Jahren aus einem Wagenrad gebaut.'],
  ['Schatzgoblins','Schatzgoblins sind keine Diebe. Sie sind Sammler. Leider sammeln sie ausschließlich fremdes Gold.'],
  ['Die Sphinx','Die Sphinx war ein Geschenk der Zwerge an den Orden. Sie stellt Rätsel, weil sie sich sonst langweilt.'],
  ['Die Leere','Hinter dem Weltenfeuer liegt nichts. Nicht Dunkelheit, nicht Kälte – nichts. Und dieses Nichts hat Hunger.'],
  ['Kaels Schwur','„Ich schwor Varkas Treue. Diesen Schwur breche ich gern.“ – Hauptfrau Kael'],
  ['Selis\' Edelstein','Selis trägt einen gesprungenen Rubin um den Hals. Er gehörte ihrer Mutter, der letzten Juwelierin des Ordens.'],
  ['Die letzte Seite','Wer diese Seite liest, hat die ganze Chronik gefunden. Der Orden lebt – solange einer sich an ihn erinnert.']
];
