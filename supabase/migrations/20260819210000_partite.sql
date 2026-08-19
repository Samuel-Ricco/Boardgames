-- ============================================================
--  GIOCATORI E PARTITE
--
--  Una collezione dice cosa hai. Le partite dicono cosa hai giocato,
--  con chi, e chi ha vinto -- che di un gioco da tavolo e' la meta'
--  piu' interessante.
--
--  Tre tabelle:
--    giocatori     i nomi salvati, per non riscriverli ogni volta
--    partite       la serata: gioco, quando, dove sta scritto
--    partecipanti  chi c'era, in che ordine e chi ha vinto
--
--  La partita si aggancia all'ID BGG e non a una riga di `giochi`.
--  Cosi' si puo' segnare una serata a casa di un amico su un gioco che
--  non e' nella tua libreria, e togliere un gioco dallo scaffale non
--  cancella la storia di quando ci hai giocato. E' la stessa chiave
--  delle recensioni del catalogo: quel numero e' l'unica cosa su cui
--  il mondo dei giochi da tavolo si sia messo d'accordo.
--
--  `titolo` e' una copia, non una ridondanza da normalizzare via: e'
--  come si chiamava il gioco quando ci hai giocato, e serve anche
--  quando l'id BGG non c'e' proprio.
-- ============================================================


-- ------------------------------------------------------------
--  1. I GIOCATORI SALVATI
--
--  Nomi, non account: al tavolo c'e' quasi sempre qualcuno che sul
--  sito non c'e'. Chi invece e' un amico si collega con `amico`, e da
--  li' si potra' risalire alla sua faccia e al suo profilo.
-- ------------------------------------------------------------
create table if not exists public.giocatori (
  id           uuid primary key default gen_random_uuid(),
  proprietario uuid not null references auth.users on delete cascade,
  nome         text not null,
  amico        uuid references auth.users on delete set null,
  creato       timestamptz not null default now(),
  unique (proprietario, nome)
);

alter table public.giocatori enable row level security;
create index if not exists giocatori_proprietario_idx on public.giocatori (proprietario, nome);

drop policy if exists "giocatori: sono i miei" on public.giocatori;
create policy "giocatori: sono i miei" on public.giocatori
  for all to authenticated
  using (proprietario = auth.uid())
  with check (proprietario = auth.uid());

grant select, insert, update, delete on public.giocatori to authenticated;


-- ------------------------------------------------------------
--  2. LE PARTITE
-- ------------------------------------------------------------
create table if not exists public.partite (
  id           uuid primary key default gen_random_uuid(),
  proprietario uuid not null references auth.users on delete cascade,
  bgg          integer,
  titolo       text not null,
  giocata_il   date,
  ora          time,
  note         text,
  creato       timestamptz not null default now()
);

alter table public.partite enable row level security;
create index if not exists partite_proprietario_idx on public.partite (proprietario, giocata_il desc nulls last, creato desc);
create index if not exists partite_bgg_idx on public.partite (proprietario, bgg);

drop policy if exists "partite: sono le mie" on public.partite;
create policy "partite: sono le mie" on public.partite
  for all to authenticated
  using (proprietario = auth.uid())
  with check (proprietario = auth.uid());

grant select, insert, update, delete on public.partite to authenticated;


-- ------------------------------------------------------------
--  3. CHI C'ERA
--
--  `nome` e' una copia anche qui, e per lo stesso motivo di `titolo`:
--  cancellando un giocatore salvato la partita non deve dimenticarsi
--  chi c'era. Per questo `giocatore` e' `on delete set null` e la
--  chiave e' (partita, nome).
--
--  `posizione` nulla vuol dire "classifica non registrata", che e' il
--  caso normale: quasi sempre si ricorda chi ha vinto e nient'altro.
-- ------------------------------------------------------------
create table if not exists public.partecipanti (
  partita   uuid not null references public.partite on delete cascade,
  nome      text not null,
  giocatore uuid references public.giocatori on delete set null,
  posizione integer,
  vincitore boolean not null default false,
  primary key (partita, nome)
);

alter table public.partecipanti enable row level security;

/* Di chi e' la partita a cui appartiene questa riga. Security definer
   perche' la policy di `partecipanti` deve poter guardare `partite`
   senza passare a sua volta dalle policy di `partite`. */
create or replace function public.mia_partita(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partite
     where id = p and proprietario = auth.uid()
  );
$$;

drop policy if exists "partecipanti: quelli delle mie partite" on public.partecipanti;
create policy "partecipanti: quelli delle mie partite" on public.partecipanti
  for all to authenticated
  using (public.mia_partita(partita))
  with check (public.mia_partita(partita));

grant execute on function public.mia_partita(uuid) to authenticated;
grant select, insert, update, delete on public.partecipanti to authenticated;
