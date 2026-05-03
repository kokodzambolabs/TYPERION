-- =====================================================================
-- MIGRACJA COMPETITION + GROUP_NAME + RLS PODGLĄDU CUDZYCH TYPÓW
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY - można uruchamiać wielokrotnie bez błędów.
-- Wklej całość do Supabase -> SQL Editor i kliknij "Run".
--
-- Co robi:
--   1) dokłada matches.competition_code (text) - kod rozgrywek z
--      Football-Data.org ('WC', 'PL', 'CL', ...). Używamy go żeby
--      pokazać przy każdym meczu link do strony turnieju na Flashscore;
--   2) dokłada matches.group_name (text) - dla MŚ/ME nazwa grupy
--      (np. 'GROUP_A') albo etap pucharowy (np. 'ROUND_OF_16',
--      'QUARTER_FINAL', 'FINAL'). UI formatuje to przez
--      lib/format.js -> formatGrupa();
--   3) odświeża politykę SELECT na predictions tak, żeby każdy
--      zalogowany user mógł podejrzeć typy innych dla meczów już
--      rozpoczętych (kickoff_at <= now()) - swoje typy są widoczne
--      zawsze. Mecze nadchodzące - cudze typy nadal ukryte (RLS jest
--      pierwszą linią obrony, Server Action też dodatkowo to sprawdza).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. matches.competition_code - kod rozgrywek z Football-Data.org
-- ---------------------------------------------------------------------
alter table public.matches
    add column if not exists competition_code text;


-- ---------------------------------------------------------------------
-- 2. matches.group_name - grupa lub etap turnieju
-- Wartości pochodzą z API Football-Data.org:
--   - faza grupowa:  'GROUP_A', 'GROUP_B', ...
--   - puchary:       'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL',
--                    'THIRD_PLACE', 'FINAL'
-- Może być NULL dla rozgrywek ligowych (Premier League, Bundesliga itd.).
-- ---------------------------------------------------------------------
alter table public.matches
    add column if not exists group_name text;


-- ---------------------------------------------------------------------
-- 3. RLS: SELECT na predictions
-- Zachowujemy politykę "swoje zawsze + cudze po starcie meczu". Drop
-- starych nazw (z różnych etapów rozwoju) i tworzymy jedną kanoniczną.
-- ---------------------------------------------------------------------
drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
drop policy if exists "predictions_select_others"               on public.predictions;
drop policy if exists predictions_select_others                 on public.predictions;

create policy "predictions_select_own_or_after_kickoff"
    on public.predictions
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1 from public.matches
            where matches.id = predictions.match_id
              and matches.kickoff_at <= now()
        )
    );


-- =====================================================================
-- KONIEC SKRYPTU
-- ---------------------------------------------------------------------
-- Po uruchomieniu możesz:
--   - zaimportować ponownie mecze z /admin/import - importer uzupełni
--     competition_code i group_name dla nowych meczów,
--   - dla istniejących meczów ręcznie dopisać kod rozgrywek, np.:
--       update public.matches set competition_code = 'WC' where ...;
-- =====================================================================
