-- ============================================================
--  LA STANZA, LE LIBRERIE, I GRUPPI
--
--  Tre cose diverse che arrivano insieme perche' toccano tutte la
--  stessa idea: la collezione smette di essere una sequenza e diventa
--  un posto arredato da chi ci abita.
--
--  1. `profili.stanza` -- luce e colori scelti da te. Sta nel profilo e
--     non in `localStorage` perche' te la porti da un dispositivo
--     all'altro, e perche' un amico che viene a guardare la tua
--     libreria deve vederla com'e' da te.
--
--  2. `librerie` -- i mobili hanno un nome, si creano a mano e i giochi
--     ci stanno in un posto preciso (0..11), con i buchi permessi. Fino
--     a qui le librerie erano CALCOLATE dal numero di giochi e le
--     posizioni erano dense: non c'era modo di dire "questo scaffale e'
--     i party games" ne' di lasciare un cubo libero apposta.
--
--  3. `gruppi` -- etichette che attraversano i mobili. Un gioco sta in
--     una libreria sola (e' un posto fisico) ma puo' essere insieme
--     "strategico" e "asimmetrico". Sono due concetti diversi apposta:
--     uno risponde a "dove sta", l'altro a "che cos'e'".
-- ============================================================


-- ------------------------------------------------------------
--  1. LA STANZA
--
--  I permessi su `profili` sono per colonna dalla migrazione
--  codice_riservato: aggiungere una colonna non basta, va rifatto
--  l'elenco. Se si dimentica, `stanza` non si legge e non si scrive e
--  non lo dice nessuno.
-- ------------------------------------------------------------
alter table public.profili add column if not exists stanza jsonb;

revoke select on public.profili from authenticated;
revoke update on public.profili from authenticated;

-- tutto tranne `codice`, che resta fuori: lo da' solo mio_codice()
grant select (id, nome, nick, avatar, creato, stanza) on public.profili to authenticated;
grant update (nome, nick, avatar, stanza) on public.profili to authenticated;


-- ------------------------------------------------------------
--  2. LE LIBRERIE
-- ------------------------------------------------------------
create table if not exists public.librerie (
  id           uuid primary key default gen_random_uuid(),
  proprietario uuid not null references auth.users on delete cascade,
  nome         text not null,
  ordine       integer not null default 0,   -- da sinistra a destra lungo la parete
  creato       timestamptz not null default now()
);

alter table public.librerie enable row level security;
create index if not exists librerie_proprietario_idx on public.librerie (proprietario, ordine);

-- si guardano come si guarda la collezione: anche gli amici
drop policy if exists "librerie: le mie e quelle degli amici" on public.librerie;
create policy "librerie: le mie e quelle degli amici" on public.librerie
  for select to authenticated
  using (proprietario = auth.uid() or public.sono_amico(proprietario));

drop policy if exists "librerie: le creo io" on public.librerie;
create policy "librerie: le creo io" on public.librerie
  for insert to authenticated with check (proprietario = auth.uid());

drop policy if exists "librerie: le rinomino io" on public.librerie;
create policy "librerie: le rinomino io" on public.librerie
  for update to authenticated
  using (proprietario = auth.uid()) with check (proprietario = auth.uid());

drop policy if exists "librerie: le tolgo io" on public.librerie;
create policy "librerie: le tolgo io" on public.librerie
  for delete to authenticated using (proprietario = auth.uid());

grant select, insert, update, delete on public.librerie to authenticated;


-- ------------------------------------------------------------
--  3. DOVE STA OGNI GIOCO
--
--  `posto` e' il cubo dentro la libreria, da 0 a 11 -- tre colonne per
--  quattro file, contate per righe. Con i buchi permessi: un posto puo'
--  restare vuoto perche' e' cosi' che si arreda uno scaffale vero.
--
--  `posizione` resta dov'e' e non si tocca: e' l'ordine manuale di
--  prima, e serve ancora da criterio quando un gioco non ha ancora un
--  posto assegnato.
-- ------------------------------------------------------------
alter table public.giochi
  add column if not exists libreria uuid references public.librerie on delete set null,
  add column if not exists posto    integer;

alter table public.giochi drop constraint if exists giochi_posto_valido;
alter table public.giochi add constraint giochi_posto_valido
  check (posto is null or (posto >= 0 and posto <= 11));

-- un cubo tiene una scatola sola
create unique index if not exists giochi_posto_unico
  on public.giochi (libreria, posto) where libreria is not null and posto is not null;

/* Le collezioni che esistono gia' vanno messe negli scaffali, se no al
   primo avvio si troverebbero tutte fuori posto. Si segue l'ordine
   manuale se c'e', se no quello di aggiunta -- cioe' esattamente quello
   che l'utente vedeva un attimo prima. */
do $$
declare
  u record;
  g record;
  i   integer;
  lib uuid;
begin
  for u in select distinct proprietario from public.giochi where libreria is null loop
    i := 0;
    lib := null;
    for g in select id from public.giochi
              where proprietario = u.proprietario and libreria is null
              order by coalesce(posizione, 1000000), creato loop
      if i % 12 = 0 then
        insert into public.librerie (proprietario, nome, ordine)
        values (u.proprietario, 'Libreria ' || (i / 12 + 1), i / 12)
        returning id into lib;
      end if;
      update public.giochi set libreria = lib, posto = i % 12
       where proprietario = u.proprietario and id = g.id;
      i := i + 1;
    end loop;
  end loop;
end $$;


-- ------------------------------------------------------------
--  4. I GRUPPI
--
--  Etichette, non contenitori: un gioco ne ha quante ne vuole. Il nome
--  e' unico per persona -- due gruppi "strategici" nella stessa
--  collezione non vogliono dire niente.
-- ------------------------------------------------------------
create table if not exists public.gruppi (
  id           uuid primary key default gen_random_uuid(),
  proprietario uuid not null references auth.users on delete cascade,
  nome         text not null,
  colore       text,
  creato       timestamptz not null default now(),
  unique (proprietario, nome)
);

alter table public.gruppi enable row level security;

drop policy if exists "gruppi: i miei e quelli degli amici" on public.gruppi;
create policy "gruppi: i miei e quelli degli amici" on public.gruppi
  for select to authenticated
  using (proprietario = auth.uid() or public.sono_amico(proprietario));

drop policy if exists "gruppi: li creo io" on public.gruppi;
create policy "gruppi: li creo io" on public.gruppi
  for insert to authenticated with check (proprietario = auth.uid());

drop policy if exists "gruppi: li rinomino io" on public.gruppi;
create policy "gruppi: li rinomino io" on public.gruppi
  for update to authenticated
  using (proprietario = auth.uid()) with check (proprietario = auth.uid());

drop policy if exists "gruppi: li tolgo io" on public.gruppi;
create policy "gruppi: li tolgo io" on public.gruppi
  for delete to authenticated using (proprietario = auth.uid());

grant select, insert, update, delete on public.gruppi to authenticated;


-- Chi sta in che gruppo. `proprietario` e' ripetuto qui apposta: serve
-- alla chiave esterna verso `giochi`, che ha chiave (proprietario, id).
create table if not exists public.giochi_gruppi (
  gruppo       uuid not null references public.gruppi on delete cascade,
  proprietario uuid not null,
  gioco        text not null,
  primary key (gruppo, gioco),
  foreign key (proprietario, gioco)
    references public.giochi (proprietario, id) on delete cascade
);

alter table public.giochi_gruppi enable row level security;
create index if not exists giochi_gruppi_gioco_idx on public.giochi_gruppi (proprietario, gioco);

drop policy if exists "giochi_gruppi: i miei e quelli degli amici" on public.giochi_gruppi;
create policy "giochi_gruppi: i miei e quelli degli amici" on public.giochi_gruppi
  for select to authenticated
  using (proprietario = auth.uid() or public.sono_amico(proprietario));

drop policy if exists "giochi_gruppi: li metto io" on public.giochi_gruppi;
create policy "giochi_gruppi: li metto io" on public.giochi_gruppi
  for insert to authenticated with check (proprietario = auth.uid());

drop policy if exists "giochi_gruppi: li tolgo io" on public.giochi_gruppi;
create policy "giochi_gruppi: li tolgo io" on public.giochi_gruppi
  for delete to authenticated using (proprietario = auth.uid());

grant select, insert, update, delete on public.giochi_gruppi to authenticated;
