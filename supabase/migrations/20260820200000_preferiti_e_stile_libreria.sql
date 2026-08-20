-- ============================================================
--  PREFERITI, E LO STILE CHE APPARTIENE AL MOBILE
--
--  Due cose piccole con la stessa idea dietro: quello che era una
--  proprieta' della stanza intera diventa una proprieta' di una cosa
--  dentro la stanza.
--
--  1. `giochi.preferito` -- alcuni giochi contano piu' degli altri, e
--     un voto alto non e' la stessa cosa: un gioco puo' valere 7 ed
--     essere quello che tiri fuori sempre.
--
--  2. `librerie.scaffali` e `librerie.arredo` -- il colore del legno e
--     lo stile degli oggetti passano dalla stanza al MOBILE. Due
--     librerie in una stanza vera non sono per forza dello stesso
--     legno, e chi divide i giochi per scaffale vuole poterli
--     distinguere anche da lontano.
--
--  Luce, muro e pavimento restano della stanza: quelli sono la stanza,
--  non i mobili, e un pavimento diverso sotto ogni libreria sarebbe una
--  stanza diversa per ogni libreria.
--
--  Nulli entrambi vuol dire "come dice la stanza": chi non tocca niente
--  continua a vedere tutti i mobili uguali, com'era.
-- ============================================================

alter table public.giochi
  add column if not exists preferito boolean not null default false;

create index if not exists giochi_preferiti_idx
  on public.giochi (proprietario) where preferito;

alter table public.librerie
  add column if not exists scaffali text,
  add column if not exists arredo   text;

comment on column public.librerie.scaffali is
  'Tinta del legno di QUESTO mobile. Nullo = quella scelta per la stanza.';
comment on column public.librerie.arredo is
  'Stile degli oggetti nei cubi vuoti di QUESTO mobile. Nullo = quello della stanza.';
