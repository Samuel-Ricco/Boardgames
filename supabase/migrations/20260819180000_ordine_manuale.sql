-- ============================================================
-- Ordine manuale della collezione.
--
-- Fino a qui l'ordine dello scaffale era sempre calcolato: data di
-- aggiunta, nome, voto. Ma una collezione vera si dispone a mano -- i
-- preferiti a portata d'occhio, le espansioni accanto al gioco base --
-- e quello e' un dato, non una funzione dei dati: va salvato.
--
-- `posizione` e' il posto sullo scaffale, contato da zero, denso: la
-- riga i-esima dell'ordine manuale ha posizione i. Uno scambio fra due
-- scatole tocca due righe e basta.
--
-- Nullo vuol dire "mai riordinato": quei giochi vanno in fondo, e alla
-- prima mossa manuale ricevono tutti una posizione, nell'ordine in cui
-- erano in quel momento sullo schermo. Cosi' l'ordine manuale non parte
-- mai da un rimescolamento: parte da quello che si stava guardando.
--
-- Niente policy nuove: aggiornare una riga della propria collezione e'
-- gia' permesso da "giochi: correggo la mia", ed e' l'unica cosa che
-- serve. La posizione di un gioco e' un fatto di chi lo possiede.
-- ============================================================

alter table public.giochi add column if not exists posizione integer;

comment on column public.giochi.posizione is
  'Posto scelto a mano sullo scaffale, contato da zero. Nullo = mai riordinato, va in fondo.';

-- Serve a leggere la collezione gia' in ordine senza ordinare in memoria
-- quando le righe cominceranno a essere tante.
create index if not exists giochi_posizione_idx
  on public.giochi (proprietario, posizione);
