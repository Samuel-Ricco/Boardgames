/* ============================================================
   Accesso con Google, e la domanda "sono admin?".

   Il ruolo non e' una scelta dell'interfaccia: e' una risposta del
   database. `eAdmin()` chiama la funzione e_admin() su Postgres, che
   guarda la tabella admin -- l'unica tabella del progetto su cui non
   esiste nessuna regola di scrittura, quindi nessun account puo'
   promuovere se stesso o altri.

   Che poi i pulsanti compaiano o no e' solo cortesia verso l'utente:
   se anche li mostrasse a tutti, a rifiutare sarebbe comunque il
   database.
   ============================================================ */
const AUTH = (function(){
'use strict';

let sb = null;          // il client, o null se non c'e' configurazione
let sessione = null;
let admin = false;

function attivo(){ return !!sb; }

function client(){
  if (sb) return sb;
  if (typeof SUPABASE === 'undefined' || !SUPABASE.url || !SUPABASE.key) return null;
  if (typeof supabase === 'undefined') return null;      // vendor/supabase.js non caricato
  sb = supabase.createClient(SUPABASE.url, SUPABASE.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return sb;
}

/* Va chiamata una volta all'avvio. Ritorna { dentro, admin, nome }.
   detectSessionInUrl si prende cura del ritorno da Google: il codice
   arriva nel frammento dell'indirizzo, il client lo scambia con una
   sessione e poi va ripulito, se no resta appiccicato alla barra. */
async function init(){
  const c = client();
  if (!c) return stato();

  try {
    const r = await c.auth.getSession();
    sessione = r.data ? r.data.session : null;
  } catch(e){ sessione = null; }

  if (sessione) admin = await chiediAdmin();

  // l'indirizzo torna sporco di parametri: si ripulisce senza
  // ricaricare, se no il giro dell'accesso ricomincia da capo
  if (location.hash.indexOf('access_token') >= 0 || location.search.indexOf('code=') >= 0){
    history.replaceState(null, '', location.pathname);
  }

  c.auth.onAuthStateChange(function(_, s){
    sessione = s;
    if (!s) admin = false;
  });

  return stato();
}

async function chiediAdmin(){
  const c = client();
  if (!c) return false;
  try {
    const r = await c.rpc('e_admin');
    return r.data === true;
  } catch(e){
    return false;
  }
}

function stato(){
  const u = sessione ? sessione.user : null;
  return {
    dentro: !!u,
    admin: admin,
    nome: u ? (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name) || u.email) : null,
    // l'indirizzo per esteso: nel profilo si mostra a chi e' entrato,
    // perche' e' anche il modo in cui un amico puo' invitarlo
    email: u ? (u.email || '') : '',
    id: u ? u.id : null
  };
}

async function entra(){
  const c = client();
  if (!c) throw new Error(TP('err.senzaBackend'));
  // si torna esattamente da dove si e' partiti: in locale e'
  // localhost:8124, online e' la pagina su GitHub Pages. Entrambi
  // devono stare fra i Redirect URLs del progetto.
  const r = await c.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: location.origin + location.pathname,
      /* E CHI ENTRA SCEGLIE CON QUALE ACCOUNT.

         Uscendo, la sessione di Supabase se ne va davvero -- signOut
         invalida anche il refresh token sul server. Quella di GOOGLE
         pero' resta: al giro dopo Google vede un solo account
         collegato, decide da se' che e' quello, e rimanda indietro
         una sessione senza aver chiesto niente. Il risultato e' che
         "esci" e poi "accedi" riporta dentro esattamente com'era, e
         non c'e' nessun modo di dire "no, l'altro".

         Qui gli account sono due per davvero -- quello admin e quello
         di prova -- ma il caso non e' nostro: e' di chiunque abbia un
         indirizzo di casa e uno di lavoro.

         `prompt=select_account` fa comparire ogni volta la schermata
         di scelta. Non e' un passaggio in piu': e' la domanda che
         l'uscita ha gia' implicato. */
      queryParams: { prompt: 'select_account' }
    }
  });
  if (r.error) throw r.error;
}

async function esci(){
  const c = client();
  if (!c) return;
  await c.auth.signOut();
  sessione = null; admin = false;
}

return {
  attivo: attivo, client: client, init: init,
  stato: stato, entra: entra, esci: esci, chiediAdmin: chiediAdmin
};
})();
