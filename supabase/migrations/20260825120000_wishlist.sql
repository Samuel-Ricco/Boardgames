-- ============================================================
--  DESIDERI: i giochi che non hai (ancora)
--
--  La collezione dice cosa hai, le partite cosa hai giocato. Mancava
--  la terza, che di chi scorre un catalogo da centomila titoli e' la
--  domanda piu' frequente: cosa vorrei.
--
--  LA CHIAVE E' L'ID BGG, come per `recensioni` e per `partite`, e per
--  la stessa ragione: e' l'unico identificativo di un gioco da tavolo
--  su cui il mondo si sia messo d'accordo, ed e' quel numero a tenere
--  insieme il catalogo -- che viene da fuori -- e quello che e'
--  nostro. Un gioco senza id BGG non si desidera: non ci sarebbe modo
--  di ritrovarlo.
--
--  E NON e' una riga di `giochi`. Un gioco desiderato non e' in
--  collezione: metterlo li' con una bandierina vorrebbe dire che "la
--  mia collezione: 25" conta anche quello che non hai, che e'
--  semplicemente falso.
--
--  IL TITOLO E' UNA COPIA, e non e' ridondanza da normalizzare via --
--  e' la stessa scelta di `partite.titolo`. Senza, aprire la wishlist
--  vorrebbe dire un giro su BGG per riga solo per sapere come si
--  chiamano i giochi che ci stanno dentro. L'anno sta con lui per la
--  stessa ragione: distingue due edizioni a colpo d'occhio.
--  Il RESTO della scheda -- autore, editore, durata -- non si copia:
--  arriva dalla fonte quando serve, se no andrebbe tenuto aggiornato a
--  mano per sempre.
--
--  Niente `update`, e niente grant di update: un desiderio c'e' o non
--  c'e'. E' la stessa forma di `apprezzamenti`.
--
--  RESTA PRIVATA, per adesso. Aprirla agli amici sarebbe utile -- e'
--  la lista dei regali -- ma e' una riga di policy e una scelta di chi
--  ci abita, non una decisione da prendere di straforo: vale la stessa
--  nota che c'e' per le partite.
-- ============================================================

create table if not exists public.desideri (
  chi     uuid not null references auth.users (id) on delete cascade,
  bgg     integer not null,
  titolo  text not null,
  anno    integer,
  creato  timestamptz not null default now(),
  primary key (chi, bgg)
);

comment on table public.desideri is
  'La wishlist: giochi NON in collezione, per id BGG. Il titolo e'' una copia apposta, come in partite.';

alter table public.desideri enable row level security;

-- GRANT e RLS sono due cose diverse e servono tutti e due: il primo
-- dice se il ruolo puo' rivolgersi alla tabella, la seconda quali
-- righe ottiene. Le tabelle nuove in `public` non sono piu' esposte in
-- automatico, quindi senza questo torna `permission denied` e sembra
-- un errore di policy.
grant select, insert, delete on public.desideri to authenticated;

-- LEGGERE: solo la propria. Vedi la nota sopra sul restare privata.
drop policy if exists "desideri: leggo la mia" on public.desideri;
create policy "desideri: leggo la mia" on public.desideri
  for select to authenticated
  using (chi = auth.uid());

-- METTERE: solo a nome proprio. Senza `chi = auth.uid()` si potrebbe
-- riempire la wishlist di qualcun altro.
drop policy if exists "desideri: lo voglio" on public.desideri;
create policy "desideri: lo voglio" on public.desideri
  for insert to authenticated
  with check (chi = auth.uid());

-- TOGLIERE: solo il proprio desiderio.
drop policy if exists "desideri: ci ho ripensato" on public.desideri;
create policy "desideri: ci ho ripensato" on public.desideri
  for delete to authenticated
  using (chi = auth.uid());
