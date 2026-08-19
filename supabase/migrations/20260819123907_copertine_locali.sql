-- ============================================================
--  Le copertine vere di Root e Scythe
--
--  Nella migrazione iniziale `copertina` restava NULL, e il client --
--  che si comporta bene -- ripiegava sull'illustrazione disegnata. Il
--  ripiego funziona, ma le due immagini vere sono committate nel repo
--  e devono vincere loro.
--
--  Il percorso e' relativo alla pagina, quindi vale sia in locale sia
--  sotto /Boardgames/ su GitHub Pages. Le copertine caricate in futuro
--  dall'admin avranno invece un indirizzo intero verso lo Storage:
--  al client non cambia niente, assegna e basta.
-- ============================================================

update public.giochi set copertina = 'img/root.jpg'
  where id = 'root' and copertina is null;

update public.giochi set copertina = 'img/scythe.jpg'
  where id = 'scythe' and copertina is null;
