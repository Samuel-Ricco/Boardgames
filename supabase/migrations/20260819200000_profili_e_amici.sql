-- ============================================================
--  PROFILI E AMICI
--
--  Fin qui un account era un identificativo e basta: la collezione era
--  sua e non c'era nessun altro nel sito. Adesso l'utente ha un nome
--  scelto da lui, una faccia, e delle persone.
--
--  Tre cose nuove:
--    1. il profilo cresce: `nick`, `avatar`, `codice`;
--    2. la tabella `amicizie`, con richiesta e accettazione;
--    3. le regole si aprono AGLI AMICI, e solo a loro: il profilo, la
--       collezione e le recensioni personali.
--
--  Il nick e' unico e serve a essere riconosciuti; il codice e' unico
--  e serve a essere trovati. Sono due mestieri diversi apposta: il
--  nick lo vedono tutti quelli che ti incontrano, il codice lo dai a
--  chi vuoi tu.
-- ============================================================


-- ------------------------------------------------------------
--  1. IL CODICE AMICO
--
--  Perche' un codice e non la ricerca per email: cercare qualcuno per
--  indirizzo vuol dire che il server conferma "si', questa email ha un
--  account qui" a chiunque provi, cioe' enumerazione di account. Un
--  codice si trova solo se te lo danno.
--
--  L'alfabeto salta 0/O e 1/I/L: un codice si legge ad alta voce e si
--  ricopia a mano, e quelle coppie si sbagliano sempre.
-- ------------------------------------------------------------
create or replace function public.genera_codice()
returns text
language plpgsql
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  tentativo text;
  i integer;
begin
  loop
    tentativo := '';
    for i in 1..8 loop
      tentativo := tentativo ||
        substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    -- 31^8: la collisione e' improbabile, ma "improbabile" non e' "no"
    exit when not exists (select 1 from public.profili where codice = tentativo);
  end loop;
  return tentativo;
end;
$$;


-- ------------------------------------------------------------
--  2. IL PROFILO CRESCE
--
--  `nome` resta quello che arriva da Google al primo accesso, e serve
--  solo come suggerimento. `nick` e' quello scelto: finche' e' nullo,
--  il sito chiede di sceglierlo.
--
--  `avatar` e' jsonb e non tre colonne perche' non e' un dato su cui
--  si interroga mai: e' un pugno di numeri che serve a ridisegnare lo
--  stesso meeple sul client. Le colonne servono a chi filtra e ordina.
-- ------------------------------------------------------------
alter table public.profili
  add column if not exists nick   text,
  add column if not exists avatar jsonb,
  add column if not exists codice text;

-- Unico senza distinzione di maiuscole: due nick che si distinguono
-- solo per una lettera grande non distinguono nessuno.
create unique index if not exists profili_nick_idx   on public.profili (lower(nick));
create unique index if not exists profili_codice_idx on public.profili (codice);

-- I profili che c'erano gia' non hanno codice: gliene serve uno, se no
-- sono gli unici a non poter essere trovati da nessuno.
update public.profili set codice = public.genera_codice() where codice is null;

-- E d'ora in poi lo riceve chiunque si registri.
create or replace function public.nuovo_profilo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profili (id, nome, codice)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    public.genera_codice()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ------------------------------------------------------------
--  3. LE AMICIZIE
--
--  Una riga per rapporto, orientata: chi ha chiesto e chi ha ricevuto.
--  Orientata e non simmetrica perche' la direzione serve davvero --
--  "ho una richiesta da accettare" e "ho una richiesta in sospeso" non
--  sono la stessa schermata.
--
--  L'amicizia vera e' `accettata`, e da quel momento vale nei due
--  sensi: le regole piu' sotto guardano la riga in tutte e due le
--  direzioni. Nessuno puo' cambiare stato a una richiesta che ha
--  mandato lui -- se no accettarsi da soli sarebbe un giro di due
--  righe di codice.
-- ------------------------------------------------------------
create table if not exists public.amicizie (
  richiedente  uuid not null references auth.users on delete cascade,
  destinatario uuid not null references auth.users on delete cascade,
  stato        text not null default 'in attesa'
               check (stato in ('in attesa', 'accettata')),
  creato       timestamptz not null default now(),
  primary key (richiedente, destinatario),
  constraint amicizia_non_con_se_stessi check (richiedente <> destinatario)
);

alter table public.amicizie enable row level security;

create index if not exists amicizie_destinatario_idx
  on public.amicizie (destinatario, stato);

/* Sono amico di questa persona? Security definer perche' deve poter
   leggere `amicizie` senza che le policy di `amicizie` chiamino a loro
   volta questa funzione: sarebbe ricorsione infinita, e Postgres se ne
   accorge solo a runtime. */
create or replace function public.sono_amico(altro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.amicizie
     where stato = 'accettata'
       and ((richiedente = auth.uid()  and destinatario = altro)
         or (richiedente = altro       and destinatario = auth.uid()))
  );
$$;

/* C'e' una richiesta aperta fra noi due? Serve a far vedere il nick e
   la faccia di chi ti ha chiesto l'amicizia: accettare o rifiutare una
   riga anonima non e' una decisione, e' un sorteggio. */
create or replace function public.richiesta_aperta(altro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.amicizie
     where ((richiedente = auth.uid()  and destinatario = altro)
         or (richiedente = altro       and destinatario = auth.uid()))
  );
$$;

drop policy if exists "amicizie: vedo le mie" on public.amicizie;
create policy "amicizie: vedo le mie" on public.amicizie
  for select to authenticated
  using (richiedente = auth.uid() or destinatario = auth.uid());

drop policy if exists "amicizie: chiedo io" on public.amicizie;
create policy "amicizie: chiedo io" on public.amicizie
  for insert to authenticated
  with check (richiedente = auth.uid() and stato = 'in attesa');

-- Accetta solo il destinatario. Il richiedente non puo' toccare la
-- riga: se potesse, si accetterebbe da solo.
drop policy if exists "amicizie: accetto io che ho ricevuto" on public.amicizie;
create policy "amicizie: accetto io che ho ricevuto" on public.amicizie
  for update to authenticated
  using (destinatario = auth.uid())
  with check (destinatario = auth.uid() and stato = 'accettata');

-- Rifiutare e togliere l'amicizia sono la stessa cosa: la riga sparisce.
-- Lo possono fare tutti e due, in qualunque stato.
drop policy if exists "amicizie: tolgo la riga" on public.amicizie;
create policy "amicizie: tolgo la riga" on public.amicizie
  for delete to authenticated
  using (richiedente = auth.uid() or destinatario = auth.uid());

grant select, insert, update, delete on public.amicizie to authenticated;


-- ------------------------------------------------------------
--  4. CHIEDERE L'AMICIZIA
--
--  Due strade, e tutte e due passano da qui invece che da un insert
--  diretto, perche' tutte e due hanno bisogno di cercare una persona
--  in una tabella che il richiedente non ha il diritto di leggere.
--
--  Per email la funzione risponde SEMPRE allo stesso modo, che
--  l'indirizzo esista o no. E' l'unico modo di offrire l'invito per
--  email senza trasformarlo in un modo per sapere chi e' iscritto.
-- ------------------------------------------------------------
create or replace function public.chiedi_amicizia_codice(cod text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  altro uuid;
begin
  if auth.uid() is null then return 'fuori'; end if;

  select id into altro from public.profili
   where codice = upper(trim(cod));

  if altro is null then return 'nessuno'; end if;
  if altro = auth.uid() then return 'te stesso'; end if;

  if exists (select 1 from public.amicizie
              where (richiedente = auth.uid()  and destinatario = altro)
                 or (richiedente = altro       and destinatario = auth.uid()))
  then
    return 'gia';
  end if;

  insert into public.amicizie (richiedente, destinatario)
  values (auth.uid(), altro);
  return 'chiesta';
end;
$$;

create or replace function public.chiedi_amicizia_email(indirizzo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  altro uuid;
begin
  if auth.uid() is null then return 'fuori'; end if;

  select id into altro from auth.users
   where lower(email) = lower(trim(indirizzo));

  -- Da qui in poi la risposta e' sempre 'inviata', qualunque cosa sia
  -- successo: se dicessimo "quell'indirizzo non esiste" avremmo appena
  -- costruito un modo per sapere chi e' iscritto a questo sito.
  if altro is not null and altro <> auth.uid()
     and not exists (select 1 from public.amicizie
                      where (richiedente = auth.uid() and destinatario = altro)
                         or (richiedente = altro      and destinatario = auth.uid()))
  then
    insert into public.amicizie (richiedente, destinatario)
    values (auth.uid(), altro);
  end if;

  return 'inviata';
end;
$$;

grant execute on function public.chiedi_amicizia_codice(text) to authenticated;
grant execute on function public.chiedi_amicizia_email(text)  to authenticated;
grant execute on function public.sono_amico(uuid)             to authenticated;
grant execute on function public.richiesta_aperta(uuid)       to authenticated;


-- ------------------------------------------------------------
--  5. LE REGOLE SI APRONO AGLI AMICI
--
--  Il profilo lo vedono: tu, i tuoi amici, e chi ha una richiesta
--  aperta con te. Nessun altro -- il codice non e' nel select, quindi
--  guardare il profilo di un amico non fa vedere il suo codice.
-- ------------------------------------------------------------
drop policy if exists "profili: leggo il mio" on public.profili;
create policy "profili: leggo il mio e quelli che mi riguardano" on public.profili
  for select to authenticated
  using (id = auth.uid()
         or public.sono_amico(id)
         or public.richiesta_aperta(id));

-- La collezione: la vedono gli amici. E' il punto di tutto questo.
drop policy if exists "giochi: leggo la mia collezione" on public.giochi;
create policy "giochi: leggo la mia e quella degli amici" on public.giochi
  for select to authenticated
  using (proprietario = auth.uid() or public.sono_amico(proprietario));

-- Scrivere no: sulla collezione di un amico si guarda e basta. Le
-- policy di insert/update/delete restano quelle di prima e continuano
-- a chiedere `proprietario = auth.uid()`.
