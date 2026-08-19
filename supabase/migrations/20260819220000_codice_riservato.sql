-- ============================================================
--  IL CODICE AMICO NON DEVE USCIRE
--
--  Correzione di un difetto vero, trovato provandolo: leggendo il
--  profilo di un amico si vedeva anche il suo `codice`.
--
--  L'errore era di ragionamento, non di scrittura. La policy di
--  lettura su `profili` dice quali RIGHE si possono leggere; non dice
--  niente sulle COLONNE. Aperta la riga di un amico -- che e' quello
--  che serve, per il nick e la faccia -- veniva aperta tutta, codice
--  compreso. E il codice e' l'unica cosa del profilo che ha senso solo
--  se la dai tu a chi vuoi tu: uno che se lo prende dal profilo di un
--  amico puo' farsi accettare da chiunque lo abbia fra gli amici.
--
--  In Postgres i permessi sulle colonne stanno nei GRANT, non nelle
--  policy. E un `grant select` sulla tabella intera vale per tutte le
--  colonne e non si puo' bucare: va tolto e rifatto elencando quelle
--  che si vogliono davvero.
--
--  Il proprio codice si continua a leggere, ma per un'altra strada:
--  una funzione che risponde solo su chi la chiama.
-- ============================================================

revoke select on public.profili from authenticated;
revoke select on public.profili from anon;

-- tutto tranne `codice`
grant select (id, nome, nick, avatar, creato) on public.profili to authenticated;

-- aggiornare resta come prima: la policy gia' limita alla propria riga,
-- e su `codice` non si scrive dall'esterno comunque
grant update (nome, nick, avatar) on public.profili to authenticated;

/* Il proprio codice, e nessun altro. Security definer perche' la
   colonna adesso non e' leggibile da `authenticated`: la funzione gira
   come il suo proprietario e restituisce una riga sola, la tua. */
create or replace function public.mio_codice()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select codice from public.profili where id = auth.uid();
$$;

grant execute on function public.mio_codice() to authenticated;

-- Nota per il futuro: `select *` su `profili` da adesso FALLISCE per
-- un utente normale, perche' `*` chiede anche la colonna vietata. Le
-- colonne vanno elencate. E' scomodo una volta e giusto per sempre.
