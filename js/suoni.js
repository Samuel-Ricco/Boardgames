/* ===============================================================
   IL SUONO

   Il sito non carica una sola risorsa esterna, e per il suono vale
   quello che vale per le superfici: legno, cartone, parquet e facce
   dei dadi sono DISEGNATI da codice su canvas, non scaricati. Qui e'
   lo stesso -- non c'e' nessun file audio nel repo, e non ce ne
   sara' nessuno: i suoni si SINTETIZZANO con Web Audio, un rumore
   filtrato e due sinusoidi per volta.

   Non e' solo coerenza. Una manciata di .mp3 anche corti pesa piu' di
   tutto il resto del sito messo insieme, e a rete staccata la libreria
   deve continuare a funzionare -- compreso il tonfo della scatola che
   torna sullo scaffale.

   COSA SUONA, E COSA NO. Suona la SCENA: la scatola che esce, il
   coperchio che si alza, quella che si prende in mano e quella che si
   posa in un cubo, il mobile su cui ci si ferma scorrendo. Non suona
   l'interfaccia -- l'elenco, il catalogo, il profilo, i pannelli. Un
   sito che fa clic a ogni tocco stanca in un minuto, e quello che qui
   vale la pena sentire e' il legno, non i bottoni.

   TUTTO PARTE DA UN GESTO. Il browser tiene l'AudioContext sospeso
   finche' non c'e' un'interazione vera, e va benissimo cosi': il
   primo gesto e' la scelta al cancello, e da li' in poi c'e' suono.
   Nessuno si ritrova un sito che parla da solo appena aperto.

   Se Web Audio non c'e', `gioca()` non fa niente e non lo dice: un
   suono che manca non e' un guasto.
   =============================================================== */
const SUONI = (function(){

/* Il volume sta in localStorage e NON nel jsonb della stanza, dove
   pure starebbe comodo accanto a luce e faretti. Il motivo e' che
   quelli sono della STANZA -- un amico che viene a guardare la tua
   libreria la vede illuminata com'e' da te -- mentre il volume e' di
   chi ascolta, e ereditare quello di un altro entrando in casa sua
   sarebbe la cosa piu' sbagliata possibile. */
const CHIAVE = 'dado-suono';
const VOL_DEF = .6;

let ctx = null;
let master = null;
let rumore = null;                 // un secondo di rumore bianco, riusato
let vol = leggi();
let spento = false;                // Web Audio non c'e': si smette di provarci
const ultimo = Object.create(null);

function leggi(){
  try {
    const v = localStorage.getItem(CHIAVE);
    if (v === null) return VOL_DEF;
    /* Zero e' un valore vero -- "muto" -- quindi non si puo' scrivere
       `parseFloat(v) || VOL_DEF`: e' lo stesso inciampo dei faretti e
       dei punti di una partita. */
    const n = parseFloat(v);
    return isFinite(n) ? Math.max(0, Math.min(1, n)) : VOL_DEF;
  } catch (e) { return VOL_DEF; }
}

function scrivi(){
  try { localStorage.setItem(CHIAVE, String(vol)); } catch (e) {}
}

/* Il contesto nasce al primo suono chiesto, non al caricamento: chi
   apre il sito per guardare la propria libreria e non tocca niente non
   ha nessun motivo di avere una scheda audio accesa. */
function assicura(){
  if (spento) return null;
  if (!ctx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC){ spento = true; return null; }
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
    } catch (e){ spento = true; ctx = null; return null; }
  }
  /* Sospeso e' lo stato normale finche' non c'e' stato un gesto vero.
     Si prova a ogni suono: costa niente e il primo che passa dopo il
     gesto riaccende tutto. */
  if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
  return ctx;
}

/* Un secondo di rumore bianco, costruito una volta e riusato da tutti
   i suoni: e' l'equivalente audio di `comune()` per le geometrie. */
function bufRumore(c){
  if (rumore) return rumore;
  const n = Math.floor(c.sampleRate);
  rumore = c.createBuffer(1, n, c.sampleRate);
  const d = rumore.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return rumore;
}

/* Una busta che parte subito e si spegne: `exponentialRamp` non
   arriva mai a zero, quindi si scende a un valore minuscolo e poi si
   ferma il nodo. */
function busta(g, t, picco, attacco, durata){
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, picco), t + attacco);
  g.gain.exponentialRampToValueAtTime(.0001, t + durata);
}

/* IL COLPO DI LEGNO. Due cose insieme, e servono tutte e due: una
   scheggia di rumore filtrato, che e' il CONTATTO -- il momento in cui
   due superfici si toccano -- e una sinusoide bassa che si spegne
   subito, che e' il CORPO del legno. Con il solo rumore esce un
   fruscio; con la sola sinusoide, un tamburo. */
function colpo(c, t, corpo, forza, durata){
  const s = c.createBufferSource();
  s.buffer = bufRumore(c);
  s.playbackRate.value = .8 + Math.random() * .4;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = corpo * 11;
  bp.Q.value = 1.1;
  const gn = c.createGain();
  busta(gn, t, forza * .5, .002, .045);
  s.connect(bp); bp.connect(gn); gn.connect(master);
  s.start(t); s.stop(t + .06);

  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(corpo * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(corpo, t + durata * .6);
  const go = c.createGain();
  busta(go, t, forza, .003, durata);
  o.connect(go); go.connect(master);
  o.start(t); o.stop(t + durata + .02);
}

/* LO STROFINIO. Cartone che scorre sul legno: rumore dentro un
   passabanda che scende, con un attacco lento -- il contrario del
   colpo, dove tutto succede nel primo millisecondo. */
function strofina(c, t, f0, f1, forza, durata){
  const s = c.createBufferSource();
  s.buffer = bufRumore(c);
  s.playbackRate.value = .9 + Math.random() * .2;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + durata);
  bp.Q.value = .9;
  const gn = c.createGain();
  busta(gn, t, forza, durata * .35, durata);
  s.connect(bp); bp.connect(gn); gn.connect(master);
  s.start(t); s.stop(t + durata + .02);
}

/* I SUONI. Sono sei, e sono i sei momenti in cui in questa scena si
   tocca qualcosa di fisico. */
const VOCI = {
  /* La scatola esce dallo scaffale: cartone che striscia sul ripiano,
     e all'inizio il distacco. */
  esce: function(c, t){
    colpo(c, t, 190, .16, .07);
    strofina(c, t + .02, 900, 430, .15, .34);
  },
  /* Il coperchio che si alza. Piu' chiaro e piu' corto: e' cartone su
     cartone, non cartone su legno, e nessuno alza un coperchio piano. */
  coperchio: function(c, t){
    strofina(c, t, 2600, 1500, .13, .17);
    colpo(c, t + .13, 320, .09, .05);
  },
  /* Torna al suo posto: lo strofinio al contrario, e il tonfo alla
     fine invece che all'inizio -- e' il momento in cui tocca il fondo
     del cubo. */
  chiude: function(c, t){
    strofina(c, t, 520, 820, .13, .26);
    colpo(c, t + .24, 150, .20, .13);
  },
  /* Presa in mano: appena un distacco, niente corpo. Si alza una
     scatola, non si posa. */
  presa: function(c, t){
    colpo(c, t, 260, .13, .05);
    strofina(c, t, 1500, 900, .09, .09);
  },
  /* Posata in un cubo. E' il suono piu' pieno dei cinque, ed e'
     giusto: e' l'unico che conferma che una cosa e' andata dove
     volevi. */
  posa: function(c, t){
    colpo(c, t, 120, .29, .17);
    strofina(c, t + .01, 700, 380, .11, .12);
  },
  /* Fermarsi su un mobile scorrendo. Molto sotto gli altri: succede
     spesso, e un suono che succede spesso va tenuto basso o diventa
     la cosa che si sente di piu'. */
  mobile: function(c, t){
    colpo(c, t, 95, .10, .12);
  }
};

/* Due volte lo stesso suono a distanza di niente e' un raddoppio che
   si sente come un difetto, non come due cose. */
const TROPPO_PRESTO = 45;

function gioca(nome){
  if (!vol) return;                       // muto: non si accende nemmeno il contesto
  const fn = VOCI[nome];
  if (!fn) return;
  const ora = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  if (ultimo[nome] && ora - ultimo[nome] < TROPPO_PRESTO) return;
  ultimo[nome] = ora;
  const c = assicura();
  if (!c || c.state !== 'running') return;
  try { fn(c, c.currentTime + .005); } catch (e) {}
}

function volume(){ return vol; }

function setVolume(v){
  const n = Math.max(0, Math.min(1, parseFloat(v)));
  vol = isFinite(n) ? n : VOL_DEF;
  if (master) master.gain.value = vol;
  scrivi();
}

/* Il primo gesto della pagina sblocca l'audio: il browser tiene il
   contesto sospeso finche' non ne arriva uno, e senza questo il primo
   suono chiesto sarebbe silenzioso anche a volume alto. Si ascolta in
   cattura e una volta sola. */
function sblocca(){
  const via = function(){
    ['pointerdown', 'keydown', 'touchstart'].forEach(function(e){
      document.removeEventListener(e, via, true);
    });
    if (vol) assicura();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(function(e){
    document.addEventListener(e, via, true);
  });
}
sblocca();

return { gioca: gioca, volume: volume, setVolume: setVolume };
})();
