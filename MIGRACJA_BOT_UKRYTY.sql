-- =====================================================================
-- MIGRACJA: profiles.bot_ukryty
-- ---------------------------------------------------------------------
-- Twarde ukrycie konkretnego bota dla zwykłych userów (per bot, ustawiane
-- przez admina). Niezależne od bot_active:
--   bot_active=true  + bot_ukryty=false -> normalny aktywny bot (typuje, widoczny)
--   bot_active=true  + bot_ukryty=true  -> bot typuje, ale userzy go nie widzą
--                                          w rankingu/typach/profilach (cron i
--                                          generowanie działają niezmiennie)
--   bot_active=false + bot_ukryty=*     -> bot nie typuje (jak dotąd)
--
-- Skrypt jest IDEMPOTENTNY - można go uruchomić wielokrotnie.
-- =====================================================================

alter table public.profiles
  add column if not exists bot_ukryty boolean not null default false;

-- =====================================================================
-- KONIEC SKRYPTU
-- =====================================================================
