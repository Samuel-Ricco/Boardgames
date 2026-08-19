-- ============================================================
--  Da libreria unica a una collezione per persona
--
--  Prima i giochi erano di tutti e li scrivevano solo gli admin.
--  Adesso ogni utente ha il suo armadio: lo vede solo lui, e dentro
--  puo' aggiungere, correggere e togliere quello che vuole. Admin e
--  utente normale hanno esattamente gli stessi diritti sulla propria
--  collezione: la distinzione resta solo per vedere come si comporta
--  l'accesso.
-- ============================================================

-- ------------------------------------------------------------
--  1. DI CHI E' OGNI RIGA
-- ------------------------------------------------------------
alter table public.giochi
  add column if not exists proprietario uuid references auth.users on delete cascade;

-- Le righe che c'erano prima passano a chi le ha aggiunte; quelle
-- iniziali, che non hanno un autore, al primo admin registrato.
update public.giochi
   set proprietario = coalesce(
         aggiunto_da,
         (select user_id from public.admin order by creato limit 1))
 where proprietario is null;

-- Se qui si lamenta vuol dire che nessuno ha ancora fatto accesso e le
-- righe iniziali non hanno a chi appartenere: meglio fermarsi che
-- lasciare in giro giochi di nessuno che nessuno vedrebbe mai.
alter table public.giochi alter column proprietario set not null;

-- ------------------------------------------------------------
--  2. LA CHIAVE PRIMARIA
--
--  Lo slug e' unico DENTRO una collezione, non nel mondo: due persone
--  devono poter avere tutte e due 'root'. La chiave diventa la coppia,
--  e il client continua a usare solo `id` senza accorgersene.
-- ------------------------------------------------------------
alter table public.giochi drop constraint if exists giochi_pkey;
alter table public.giochi add primary key (proprietario, id);

create index if not exists giochi_proprietario_idx on public.giochi (proprietario, creato);

-- ------------------------------------------------------------
--  3. LE REGOLE: ognuno vede e tocca solo la sua roba
--
--  Sparisce la lettura pubblica: una collezione e' privata. E sparisce
--  e_admin() da queste policy -- non c'entra piu' niente con chi puo'
--  scrivere, adesso conta solo di chi e' la riga.
-- ------------------------------------------------------------
drop policy if exists "giochi: lettura pubblica"     on public.giochi;
drop policy if exists "giochi: aggiungono gli admin" on public.giochi;
drop policy if exists "giochi: modificano gli admin" on public.giochi;
drop policy if exists "giochi: tolgono gli admin"    on public.giochi;

drop policy if exists "giochi: leggo la mia collezione" on public.giochi;
create policy "giochi: leggo la mia collezione" on public.giochi
  for select to authenticated
  using (proprietario = auth.uid());

drop policy if exists "giochi: aggiungo alla mia" on public.giochi;
create policy "giochi: aggiungo alla mia" on public.giochi
  for insert to authenticated
  with check (proprietario = auth.uid());

drop policy if exists "giochi: correggo la mia" on public.giochi;
create policy "giochi: correggo la mia" on public.giochi
  for update to authenticated
  using (proprietario = auth.uid())
  with check (proprietario = auth.uid());

drop policy if exists "giochi: tolgo dalla mia" on public.giochi;
create policy "giochi: tolgo dalla mia" on public.giochi
  for delete to authenticated
  using (proprietario = auth.uid());

-- ------------------------------------------------------------
--  4. LE COPERTINE, UNA CARTELLA A TESTA
--
--  Con le collezioni separate il nome del file non basta piu': due
--  persone che aggiungono Root scriverebbero tutte e due su root.jpg.
--  Adesso il percorso e' <uid>/<slug>.jpg, e si puo' scrivere solo
--  nella propria cartella.
-- ------------------------------------------------------------
drop policy if exists "copertine: caricano gli admin" on storage.objects;
drop policy if exists "copertine: tolgono gli admin"  on storage.objects;

drop policy if exists "copertine: carico nella mia cartella" on storage.objects;
create policy "copertine: carico nella mia cartella" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'copertine'
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "copertine: tolgo dalla mia cartella" on storage.objects;
create policy "copertine: tolgo dalla mia cartella" on storage.objects
  for delete to authenticated
  using (bucket_id = 'copertine'
         and (storage.foldername(name))[1] = auth.uid()::text);

-- La lettura resta pubblica: sono copertine di scatole, non segreti, e
-- servono come texture in una scena WebGL. Chi indovina un percorso
-- vede un'immagine di scatola, e pazienza.
