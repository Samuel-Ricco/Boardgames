/* ============================================================
   I giochi sullo scaffale.
   Le schede sono compilate a mano: i dati di gioco sono quelli
   pubblici di BoardGameGeek (id in `bgg`), le recensioni sono
   segnaposto in lorem ipsum, da sostituire con i testi veri.
   Vedi README.md per come agganciare la XML API2 di BGG.
   ============================================================ */

// Quattro capoversi di riempimento, riusati finche' non ci sono i testi veri.
/* Il segnaposto e' corto apposta. Quattro capoversi di lorem ipsum
   riempivano il pannello e spingevano fuori vista tutto quello che
   viene dopo -- specifiche, partite, pulsanti -- e chi apriva una
   scatola per la prima volta pensava che il sito finisse li'. */
const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."
];

const GAMES = [
  {
    id: 'root',
    bgg: 237182,                       // boardgamegeek.com/boardgame/237182/root
    title: 'Root',
    sub: 'Una guerra nel bosco',
    year: 2018,
    designer: 'Cole Wehrle',
    publisher: 'Leder Games',
    players: '2-4',
    time: '60-90',
    age: '10+',
    weight: '3.8',                     // peso BGG, da 1 a 5
    score: '8.6',                      // il voto della casa
    tags: ['asimmetrico', 'controllo aree', 'guerra', 'peso medio-alto'],
    review: LOREM,
    cover: 'img/root.jpg',             // copertina vera; le proporzioni della
                                       // scatola escono da quelle dell'immagine
    artist: 'Kyle Ferrin',             // chi ha fatto la copertina
    art: 'root',                       // ripiego disegnato a mano (js/art.js)
    slot: 0,                           // posizione sul ripiano, da sinistra
    wrap: '#8f3a22',                   // colore dei bordi della scatola
    ink: '#f4e6c8'                     // colore del titolo sul dorso
  },
  {
    id: 'scythe',
    bgg: 169786,                       // boardgamegeek.com/boardgame/169786/scythe
    title: 'Scythe',
    sub: "Mietitura e mech nell'Europa del 1920",
    year: 2016,
    designer: 'Jamey Stegmaier',
    publisher: 'Stonemaier Games',
    players: '1-5',
    time: '90-115',
    age: '14+',
    weight: '3.4',
    score: '8.2',
    tags: ['gestionale', 'motore di produzione', 'esplorazione', 'solitario'],
    review: LOREM,
    cover: 'img/scythe.jpg',
    artist: 'Jakub Rozalski',
    art: 'scythe',
    slot: 1,
    wrap: '#3f4239',
    ink: '#f1e2bd'
  }
];
