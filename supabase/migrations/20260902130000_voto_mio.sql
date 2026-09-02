-- ============================================================
--  IL MIO VOTO NON E' QUELLO DI BGG
-- ============================================================
--
--  `giochi.voto` faceva due mestieri e ne perdeva uno. All'aggiunta ci
--  finiva dentro la media di BoardGameGeek, che e' un fatto sul gioco;
--  scrivendo la recensione ci finiva il proprio voto, che e'
--  un'opinione. Il secondo cancellava il primo, e da quel momento non
--  c'era piu' modo di sapere quanto lo valuta il mondo.
--
--  Sono due numeri diversi e vanno vicini, non uno al posto dell'altro:
--  "8.6 su BGG, 7 per me" e' esattamente il tipo di cosa che un sito di
--  recensioni deve saper dire.
--
--  `voto` resta la media di BGG -- non cambia significato per le righe
--  che ci sono gia', ed e' il valore che il catalogo mostra da sempre.
--  Il proprio voto e' la colonna nuova, e parte vuota: chi ha gia'
--  scritto una recensione si ritrova il voto che aveva messo dentro
--  `voto`, che e' dove l'aveva messo, e lo puo' spostare riscrivendolo.
--  Indovinare quale dei due sia -- il mio o quello di BGG -- e' proprio
--  la cosa che non si puo' fare guardando un numero solo.
--
--  Le grant su `giochi` sono a livello di TABELLA (`grant insert,
--  update, delete on public.giochi to authenticated`), non per colonna
--  come su `profili`: una colonna nuova le eredita e non serve
--  rifarle. Vale la pena averlo scritto, perche' sull'altra tabella la
--  regola e' opposta ed e' costata due volte.
-- ------------------------------------------------------------

alter table public.giochi
  add column if not exists voto_mio text;

comment on column public.giochi.voto is
  'la media di BoardGameGeek: un fatto sul gioco';
comment on column public.giochi.voto_mio is
  'il voto di chi possiede questa copia: un''opinione';
