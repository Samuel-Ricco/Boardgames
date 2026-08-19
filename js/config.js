/* ============================================================
   Dove sta il backend.

   Queste due righe sono pubbliche per progetto e stanno apposta nel
   repo: e' cosi' che Supabase e' pensato per funzionare. Quello che
   protegge i dati non e' la segretezza della chiave, sono le regole
   in supabase/migrations -- lettura a tutti, scrittura solo a chi
   risulta admin al database.

   La chiave che NON deve mai finire qui e' quella `sb_secret_...`
   (una volta si chiamava service_role): quella scavalca ogni regola.

   Se SUPABASE.url e' vuoto il sito funziona lo stesso, con la
   libreria in localStorage e i giochi committati in js/data.js.
   ============================================================ */
const SUPABASE = {
  url: 'https://stslddkkzqonauavgxuy.supabase.co',
  key: 'sb_publishable_GKrPFRx3n9YOcw4aGeAycA_dmEzMPHS'
};
