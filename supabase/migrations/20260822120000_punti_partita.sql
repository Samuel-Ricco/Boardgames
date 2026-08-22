-- ============================================================
--  I PUNTI DI UNA PARTITA
--
--  Fino a qui `partecipanti` teneva nome, posizione e vincitore. I
--  punti erano un aiuto del modulo e basta: servivano a calcolare le
--  posizioni mentre si scriveva, e alla chiusura sparivano. Riaprendo
--  una partita segnata i campi erano vuoti, e non c'era piu' modo di
--  correggere un punteggio senza riscrivere tutto il tavolo.
--
--  Nullo vuol dire "non registrato", che e' il caso normale: quasi
--  sempre ci si ricorda il punteggio di due giocatori su quattro. E
--  ZERO non e' nullo -- si puo' chiudere una partita a zero punti, e
--  il client deve stare attento a non confondere i due (un
--  `parseInt(x) || null` trasformerebbe lo zero in "non registrato").
--
--  Niente `grant` nuovo: su questa tabella i permessi sono per TABELLA
--  e non per colonna -- a differenza di `profili`, dove dopo
--  `codice_riservato` ogni colonna nuova va concessa a mano. Qui una
--  colonna nuova e' gia' leggibile e scrivibile da chi puo' toccare la
--  riga, e le policy restano quelle di sempre.
-- ============================================================

alter table public.partecipanti
  add column if not exists punti integer;

comment on column public.partecipanti.punti is
  'Il punteggio, se e'' stato segnato. Nullo vuol dire non registrato.';
