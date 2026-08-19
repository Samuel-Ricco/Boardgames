-- ============================================================
--  LE RECENSIONI DEL SITO
--
--  Fino a qui la recensione era una colonna della riga in `giochi`,
--  cioe' una proprieta' della COPIA di quel gioco dentro una
--  collezione personale. Va bene per gli appunti su un gioco che si
--  possiede; non va bene per un sito di recensioni, dove la recensione
--  e' del gioco e la leggono tutti -- anche chi non ha un account e
--  non ha nessuna collezione.
--
--  Quindi una tabella sua, e la chiave e' l'id BoardGameGeek: e'
--  l'unico identificativo di un gioco da tavolo su cui il mondo si sia
--  messo d'accordo. Un gioco senza id BGG non si recensisce qui --
--  non e' una limitazione, e' quello che tiene insieme catalogo,
--  collezioni e schede.
--
--  Qui NON si ripete la scheda del gioco. Autore, editore, durata,
--  numero di giocatori arrivano da BGG o da Wikidata quando la riga
--  viene mostrata: copiarli vorrebbe dire tenerli aggiornati a mano
--  per sempre. Si salva solo quello che una recensione E': il titolo
--  sotto cui e' stata scritta, il voto, il testo, la copertina scelta
--  e chi l'ha scritta.
-- ============================================================

create table if not exists public.recensioni (
  bgg         integer primary key,               -- l'id BoardGameGeek del gioco
  titolo      text not null,                     -- come si chiamava quando l'abbiamo scritta
  voto        text,
  testo       text[] not null default '{}',      -- un elemento per capoverso
  copertina   text,                              -- url nello storage, o null
  scritta_da  uuid references auth.users on delete set null,
  creato      timestamptz not null default now(),
  aggiornata  timestamptz not null default now()
);

alter table public.recensioni enable row level security;

-- ------------------------------------------------------------
--  Le legge chiunque, account o no: e' il motivo per cui esistono.
--  E' anche cio' che rende sensato l'ingresso come ospite -- entrare
--  nel catalogo senza costruirsi una libreria.
-- ------------------------------------------------------------
drop policy if exists "recensioni: lettura pubblica" on public.recensioni;
create policy "recensioni: lettura pubblica" on public.recensioni
  for select to anon, authenticated
  using (true);

-- ------------------------------------------------------------
--  Le scrivono gli admin, e solo loro. Qui il ruolo conta davvero:
--  sulle collezioni personali `admin` non da' nessun potere in piu'
--  (ognuno comanda sulla sua), ma il catalogo e' uno solo e le
--  recensioni sono la voce del sito.
-- ------------------------------------------------------------
drop policy if exists "recensioni: scrivono gli admin" on public.recensioni;
create policy "recensioni: scrivono gli admin" on public.recensioni
  for insert to authenticated
  with check (public.e_admin());

drop policy if exists "recensioni: correggono gli admin" on public.recensioni;
create policy "recensioni: correggono gli admin" on public.recensioni
  for update to authenticated
  using (public.e_admin())
  with check (public.e_admin());

drop policy if exists "recensioni: tolgono gli admin" on public.recensioni;
create policy "recensioni: tolgono gli admin" on public.recensioni
  for delete to authenticated
  using (public.e_admin());

-- GRANT e RLS sono due cose diverse e servono tutte e due: il primo
-- dice se un ruolo puo' rivolgersi alla tabella, la seconda quali
-- righe ottiene. Le tabelle nuove in `public` non sono piu' esposte in
-- automatico, e senza questo torna "permission denied" -- che sembra
-- un errore di policy e non lo e'.
grant select on public.recensioni to anon, authenticated;
grant insert, update, delete on public.recensioni to authenticated;

create index if not exists recensioni_aggiornata_idx
  on public.recensioni (aggiornata desc);
