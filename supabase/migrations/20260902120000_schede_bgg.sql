-- ============================================================
--  QUELLO CHE DI UN GIOCO E' UGUALE PER TUTTI
-- ============================================================
--
--  Fino a qui ogni cosa che veniva da BGG era duplicata per persona:
--
--   - la COPERTINA finiva in `copertine/<uid>/<slug>-p<pic>.jpg`, cioe'
--     una cartella a testa. Root e' Root per chiunque, ma con dieci
--     persone che ce l'hanno la stessa figura stava sul server dieci
--     volte. Misurato: 107 KB a copertina, quindi il gigabyte del piano
--     gratuito bastava per circa 390 persone da 25 giochi -- e non
--     perche' le immagini fossero tante, ma perche' erano le stesse
--     ripetute;
--   - le MISURE della scatola stavano in `localStorage`, cioe' una
--     copia per browser: ogni dispositivo nuovo le richiedeva a BGG da
--     capo, per giochi che qualcun altro aveva gia' chiesto.
--
--  Sono fatti SUL GIOCO, non proprieta' della tua copia -- come non lo
--  e' il numero di giocatori. Quindi stanno in una tabella sola, con
--  chiave l'id BGG, che e' l'unico identificativo su cui il mondo si
--  sia messo d'accordo ed e' gia' la chiave delle recensioni pubbliche,
--  delle partite e della wishlist.
--
--  Cosa cambia in concreto: la seconda persona che aggiunge Root non
--  interroga BGG e non carica niente -- legge questa riga e punta alla
--  figura che c'e' gia'. L'API viene chiesta UNA VOLTA PER GIOCO invece
--  che una volta per utente.
--
--  Quello che NON sta qui: autore, editore, anno, voto. Sono gia'
--  colonne di `giochi` e ci parla mezzo sito; spostarli e' un altro
--  lavoro, e non e' quello che stava crescendo.
-- ------------------------------------------------------------

create table if not exists public.schede_bgg (
  bgg           integer primary key,

  -- le misure della scatola, in centimetri, dall'ultima edizione
  larghezza     numeric,
  lunghezza     numeric,
  spessore      numeric,
  edizione      text,        -- il nome della versione da cui vengono
  edizione_anno integer,
  edizioni      integer,     -- quante ne ha viste: una sola e' un indizio debole

  -- la copertina condivisa: un oggetto per FIGURA, non per persona
  pic           text,        -- l'id dell'immagine su BGG (`p4254509`)
  copertina     text,        -- l'indirizzo pubblico dentro il bucket

  aggiornato    timestamptz not null default now()
);

alter table public.schede_bgg enable row level security;

-- La lettura e' di tutti, ANCHE DEGLI OSPITI: il catalogo si legge
-- senza account, ed e' la schermata che di questi dati si serve.
grant select on public.schede_bgg to anon, authenticated;

drop policy if exists "schede: legge chiunque" on public.schede_bgg;
create policy "schede: legge chiunque" on public.schede_bgg
  for select to anon, authenticated
  using (true);

-- NIENTE insert e NIENTE update diretti, nemmeno per chi e' entrato.
-- Si passa dalla funzione qui sotto, che riempie solo quello che manca:
-- una tabella condivisa dove ognuno puo' riscrivere quello che c'e' e'
-- una tabella dove il primo che sbaglia sbaglia per tutti.

-- ------------------------------------------------------------
--  Registrare quello che si e' appena chiesto a BGG.
--
--  `security definer` per lo stesso motivo di `sono_amico` e
--  `mia_partita`: chi chiama non ha il diritto di scrivere sulla
--  tabella, e non deve averlo.
--
--  La regola e' COALESCE in tutte e due le direzioni: un valore che
--  c'e' gia' non si tocca, uno che manca si riempie. Cosi' due persone
--  che aggiungono lo stesso gioco non si sovrascrivono a vicenda, e
--  chi arriva con una scheda incompleta non cancella quella completa.
--  Per correggere una riga sbagliata si passa dal Table Editor, che e'
--  la stessa garanzia della tabella `admin`.
-- ------------------------------------------------------------
create or replace function public.scheda_bgg_registra(
  p_bgg           integer,
  p_larghezza     numeric  default null,
  p_lunghezza     numeric  default null,
  p_spessore      numeric  default null,
  p_edizione      text     default null,
  p_edizione_anno integer  default null,
  p_edizioni      integer  default null,
  p_pic           text     default null,
  p_copertina     text     default null
) returns public.schede_bgg
language plpgsql
security definer
set search_path = public
as $$
declare r public.schede_bgg;
begin
  if p_bgg is null or p_bgg <= 0 then
    raise exception 'id BGG mancante';
  end if;

  /* La copertina deve stare nel NOSTRO bucket, nella cartella
     condivisa, E AVERE IL NOME DELLA FIGURA DICHIARATA. E' l'unico
     campo di questa tabella che punta fuori invece di descrivere,
     quindi e' l'unico da cui puo' entrare qualcosa che non c'entra:
     senza il controllo, chiunque sia entrato potrebbe far vedere a
     tutti un'immagine qualunque.

     Legandolo al `pic` non resta molto da fare: l'oggetto si carica
     con `upsert:false`, quindi una figura gia' presente non si puo'
     sovrascrivere, e un nome inventato non corrisponde a nessun gioco
     vero. */
  if p_copertina is not null then
    if p_pic is null or p_pic !~ '^p[0-9]+$' then
      raise exception 'la copertina vuole l''id della figura';
    end if;
    if p_copertina !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/copertine/bgg/'
                       || p_pic || '\.jpg$') then
      raise exception 'la copertina deve stare in copertine/bgg/<pic>.jpg';
    end if;
  end if;

  insert into public.schede_bgg as s (
    bgg, larghezza, lunghezza, spessore,
    edizione, edizione_anno, edizioni, pic, copertina
  ) values (
    p_bgg, p_larghezza, p_lunghezza, p_spessore,
    p_edizione, p_edizione_anno, p_edizioni, p_pic, p_copertina
  )
  on conflict (bgg) do update set
    larghezza     = coalesce(s.larghezza,     excluded.larghezza),
    lunghezza     = coalesce(s.lunghezza,     excluded.lunghezza),
    spessore      = coalesce(s.spessore,      excluded.spessore),
    edizione      = coalesce(s.edizione,      excluded.edizione),
    edizione_anno = coalesce(s.edizione_anno, excluded.edizione_anno),
    edizioni      = coalesce(s.edizioni,      excluded.edizioni),
    pic           = coalesce(s.pic,           excluded.pic),
    copertina     = coalesce(s.copertina,     excluded.copertina),
    aggiornato    = now()
  returning * into r;

  return r;
end
$$;

revoke all on function public.scheda_bgg_registra(
  integer, numeric, numeric, numeric, text, integer, integer, text, text
) from public;
grant execute on function public.scheda_bgg_registra(
  integer, numeric, numeric, numeric, text, integer, integer, text, text
) to authenticated;

-- ------------------------------------------------------------
--  La cartella condivisa del bucket.
--
--  `copertine/bgg/p4254509.jpg`. Il nome e' l'id della figura su BGG,
--  che e' unico al mondo: due persone con lo stesso gioco scrivono lo
--  stesso percorso, e la seconda non scrive affatto.
--
--  Si puo' INSERIRE ma non cancellare: un oggetto li' dentro e' di
--  tutti, e chi toglie Root dalla propria collezione non deve poter
--  lasciare gli altri senza copertina. A cancellare sono gli admin.
--
--  I file scelti a mano restano nella cartella personale: quelli non
--  sono un fatto sul gioco, sono una scelta di chi li ha caricati.
-- ------------------------------------------------------------
drop policy if exists "copertine: carico nella cartella condivisa" on storage.objects;
create policy "copertine: carico nella cartella condivisa" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'copertine'
              and (storage.foldername(name))[1] = 'bgg');

drop policy if exists "copertine: dalla condivisa tolgono gli admin" on storage.objects;
create policy "copertine: dalla condivisa tolgono gli admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'copertine'
         and (storage.foldername(name))[1] = 'bgg'
         and public.e_admin());
