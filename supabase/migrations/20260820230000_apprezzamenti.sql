-- ============================================================
--  APPREZZAMENTI: il cuore sotto la recensione di un amico
--
--  Guardando la libreria di un amico si apre una scatola e si legge
--  quello che ne pensa lui. Fino a qui si poteva solo leggere. Adesso
--  si puo' dire "questa mi e' piaciuta", che e' la cosa piu' piccola e
--  piu' naturale da fare davanti a una frase scritta da qualcuno.
--
--  LA CHIAVE E' LA COPIA, NON IL GIOCO. `(proprietario, gioco)` e non
--  l'id BGG: si apprezza *la recensione di quella persona*, non il
--  gioco in generale. Sono due cose diverse e il sito le tiene gia'
--  separate -- le recensioni pubbliche del catalogo stanno in
--  `recensioni` e hanno l'id BGG per chiave, perche' quelle sono del
--  gioco e le legge chiunque. Queste sono di chi le ha scritte.
--
--  La chiave esterna e' composta perche' `giochi` ha chiave
--  `(proprietario, id)`: lo slug e' unico dentro una collezione, non
--  nel mondo, e due persone possono avere tutte e due `root`.
--
--  `on delete cascade`: se il gioco esce dalla collezione, la
--  recensione non c'e' piu' e non c'e' piu' niente da apprezzare.
-- ============================================================

create table if not exists public.apprezzamenti (
  chi          uuid not null references auth.users (id) on delete cascade,
  proprietario uuid not null,
  gioco        text not null,
  creato       timestamptz not null default now(),
  primary key (chi, proprietario, gioco),
  foreign key (proprietario, gioco)
    references public.giochi (proprietario, id) on delete cascade
);

comment on table public.apprezzamenti is
  'Un cuore su LA RECENSIONE DI QUALCUNO, non su un gioco: la chiave e'' la copia (proprietario, gioco).';

-- Per contare i cuori di una collezione senza scorrere tutta la tabella.
create index if not exists apprezzamenti_copia_idx
  on public.apprezzamenti (proprietario, gioco);

alter table public.apprezzamenti enable row level security;

-- GRANT e RLS sono due cose diverse e servono tutti e due: il primo dice
-- se il ruolo puo' rivolgersi alla tabella, la seconda quali righe
-- ottiene. Le tabelle nuove in `public` non sono piu' esposte in
-- automatico, quindi senza questo torna `permission denied` e sembra un
-- errore di policy.
grant select, insert, delete on public.apprezzamenti to authenticated;

-- LETTURA. Si vedono i cuori sulle recensioni che si ha il diritto di
-- leggere -- le proprie e quelle degli amici -- e non quelli sparsi per
-- il mondo. La stessa condizione di `giochi`, perche' e' la stessa
-- domanda: posso vedere questa collezione?
drop policy if exists "apprezzamenti: leggo quelli che mi riguardano" on public.apprezzamenti;
create policy "apprezzamenti: leggo quelli che mi riguardano" on public.apprezzamenti
  for select to authenticated
  using (
    chi = auth.uid()
    or proprietario = auth.uid()
    or public.sono_amico(proprietario)
  );

-- METTERE. Solo a nome proprio (`chi = auth.uid()`, se no si mettono
-- cuori a nome di altri) e solo su una collezione che si ha il diritto
-- di guardare. Sulla propria si puo': un segnalibro sulle proprie
-- recensioni non fa male a nessuno, e vietarlo sarebbe una regola in
-- piu' da spiegare.
drop policy if exists "apprezzamenti: mi piace questa" on public.apprezzamenti;
create policy "apprezzamenti: mi piace questa" on public.apprezzamenti
  for insert to authenticated
  with check (
    chi = auth.uid()
    and (proprietario = auth.uid() or public.sono_amico(proprietario))
  );

-- TOGLIERE. Solo il proprio cuore. Niente update: un cuore c'e' o non
-- c'e', non ha niente da aggiornare -- ed e' anche il motivo per cui
-- non c'e' il grant di update.
drop policy if exists "apprezzamenti: ci ho ripensato" on public.apprezzamenti;
create policy "apprezzamenti: ci ho ripensato" on public.apprezzamenti
  for delete to authenticated
  using (chi = auth.uid());
