-- ============================================================
--  il dado e' trap -- schema del database
--
--  Da incollare tutto insieme nel SQL Editor di Supabase, una volta
--  sola, su un progetto nuovo. E' idempotente: rilanciarlo non rompe
--  niente.
--
--  La regola che tiene in piedi tutto: il client chiede, il database
--  decide. Il pulsante "togli dall'armadio" puo' anche comparire a
--  chiunque -- se chi lo preme non e' admin, e' Postgres a dire di no.
-- ============================================================


-- ------------------------------------------------------------
--  1. CHI E' ADMIN
--
--  Tabella separata dai profili e SENZA policy di scrittura: non
--  esiste modo di promuoversi da soli, nemmeno essendo gia' admin.
--  Ci si mette a mano dal pannello di Supabase (Table Editor), ed e'
--  esattamente la garanzia che serve.
-- ------------------------------------------------------------
create table if not exists public.admin (
  user_id uuid primary key references auth.users on delete cascade,
  creato  timestamptz not null default now()
);

alter table public.admin enable row level security;

-- Ognuno puo' sapere se lui e' admin, e nient'altro.
drop policy if exists "admin: vedo solo me stesso" on public.admin;
create policy "admin: vedo solo me stesso" on public.admin
  for select to authenticated
  using (user_id = auth.uid());


-- Funzione di comodo usata da tutte le policy.
-- security definer: deve poter leggere `admin` anche per chi su quella
-- tabella non ha diritto di lettura.
-- search_path fissato: senza, un utente potrebbe creare uno schema che
-- si intromette davanti a public e cambiare cosa significa "admin".
create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin where user_id = auth.uid());
$$;


-- ------------------------------------------------------------
--  2. PROFILI
--
--  Una riga per utente, creata da sola al primo accesso.
-- ------------------------------------------------------------
create table if not exists public.profili (
  id     uuid primary key references auth.users on delete cascade,
  nome   text,
  creato timestamptz not null default now()
);

alter table public.profili enable row level security;

drop policy if exists "profili: leggo il mio" on public.profili;
create policy "profili: leggo il mio" on public.profili
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "profili: aggiorno il mio" on public.profili;
create policy "profili: aggiorno il mio" on public.profili
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


create or replace function public.nuovo_profilo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profili (id, nome)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists su_nuovo_utente on auth.users;
create trigger su_nuovo_utente
  after insert on auth.users
  for each row execute function public.nuovo_profilo();


-- ------------------------------------------------------------
--  3. I GIOCHI
--
--  Le colonne sono in italiano; js/store.js fa la traduzione da e
--  verso i nomi usati nella scena (title, designer, ...). Meglio un
--  mappatore di dieci righe che una colonna chiamata "time", che in
--  SQL e' anche un tipo e prima o poi da' fastidio.
-- ------------------------------------------------------------
create table if not exists public.giochi (
  id           text primary key,                  -- lo slug, come in js/data.js
  titolo       text not null,
  sottotitolo  text,
  bgg          integer,
  anno         integer,
  autore       text,
  editore      text,
  illustratore text,                              -- il credito sulla copertina
  giocatori    text,
  durata       text,
  eta          text,
  peso         text,
  voto         text,
  tag          text[] not null default '{}',
  recensione   text[] not null default '{}',      -- un elemento per capoverso
  copertina    text,                              -- url nello storage, o null
  arte         text not null default 'generic',   -- copertina disegnata di ripiego
  wrap         text not null default '#4a4632',
  ink          text not null default '#f1e2bd',
  creato       timestamptz not null default now(),-- l'ordine di aggiunta
  aggiunto_da  uuid references auth.users on delete set null
);

alter table public.giochi enable row level security;

-- L'armadio lo guardano tutti, anche senza account.
drop policy if exists "giochi: lettura pubblica" on public.giochi;
create policy "giochi: lettura pubblica" on public.giochi
  for select to anon, authenticated
  using (true);

-- Scrive solo chi e' nella tabella admin.
drop policy if exists "giochi: aggiungono gli admin" on public.giochi;
create policy "giochi: aggiungono gli admin" on public.giochi
  for insert to authenticated
  with check (public.e_admin());

drop policy if exists "giochi: modificano gli admin" on public.giochi;
create policy "giochi: modificano gli admin" on public.giochi
  for update to authenticated
  using (public.e_admin())
  with check (public.e_admin());

drop policy if exists "giochi: tolgono gli admin" on public.giochi;
create policy "giochi: tolgono gli admin" on public.giochi
  for delete to authenticated
  using (public.e_admin());

create index if not exists giochi_creato_idx on public.giochi (creato);


-- ------------------------------------------------------------
--  4. LE COPERTINE
--
--  Bucket pubblico in lettura: le immagini finiscono come texture in
--  una scena WebGL, e servono gli header CORS che Supabase mette da
--  solo. E' anche il motivo per cui non si possono usare direttamente
--  quelle di cf.geekdo-images.com, che gli header non li manda.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('copertine', 'copertine', true)
on conflict (id) do nothing;

drop policy if exists "copertine: lettura pubblica" on storage.objects;
create policy "copertine: lettura pubblica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'copertine');

drop policy if exists "copertine: caricano gli admin" on storage.objects;
create policy "copertine: caricano gli admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'copertine' and public.e_admin());

drop policy if exists "copertine: tolgono gli admin" on storage.objects;
create policy "copertine: tolgono gli admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'copertine' and public.e_admin());


-- ------------------------------------------------------------
--  5. I DUE GIOCHI DI PARTENZA
--
--  Le stesse due schede committate in js/data.js, cosi' l'armadio non
--  e' vuoto al primo avvio. Le recensioni sono ancora segnaposto.
--  Le copertine restano quelle nel repo (img/root.jpg, img/scythe.jpg):
--  `copertina` a null significa "usa quella locale".
-- ------------------------------------------------------------
insert into public.giochi
  (id, titolo, sottotitolo, bgg, anno, autore, editore, illustratore,
   giocatori, durata, eta, peso, voto, tag, recensione, arte, wrap, ink, creato)
values
  ('root', 'Root', 'Una guerra nel bosco', 237182, 2018,
   'Cole Wehrle', 'Leder Games', 'Kyle Ferrin',
   '2-4', '60-90', '10+', '3.8', '8.6',
   array['asimmetrico','controllo aree','guerra','peso medio-alto'],
   array[
     'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
     'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
   ],
   'root', '#8f3a22', '#f4e6c8', now()),

  ('scythe', 'Scythe', 'Mietitura e mech nell''Europa del 1920', 169786, 2016,
   'Jamey Stegmaier', 'Stonemaier Games', 'Jakub Rozalski',
   '1-5', '90-115', '14+', '3.4', '8.2',
   array['gestionale','motore di produzione','esplorazione','solitario'],
   array[
     'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
     'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
   ],
   'scythe', '#3f4239', '#f1e2bd', now() + interval '1 second')
on conflict (id) do nothing;


-- ============================================================
--  ULTIMO PASSO, A MANO
--
--  1. Accedi al sito una volta con Google: cosi' esisti in auth.users.
--  2. Pannello Supabase -> Table Editor -> admin -> Insert row
--     -> user_id = il tuo id (lo trovi in Authentication -> Users).
--
--  Da quel momento sei admin. Nessuno puo' diventarlo dal browser,
--  perche' su questa tabella non c'e' nessuna policy di scrittura.
-- ============================================================
