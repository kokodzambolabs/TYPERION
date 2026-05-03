-- =====================================================================
-- MIGRACJA PUNKTY - Faza 8 (liczenie punktów meczowych)
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY - można uruchamiać wielokrotnie bez błędów.
-- Wklej całość do Supabase -> SQL Editor i kliknij "Run".
--
-- Co robi:
--   1) Dokłada politykę RLS, dzięki której ADMIN może UPDATE na
--      predictions. Bez tego Server Action liczący punkty po meczu
--      nie ma jak zapisać kolumny `points` (zwykła polityka
--      predictions_update_own_before_kickoff blokuje UPDATE po starcie
--      meczu nawet adminowi, a points wpisujemy właśnie po meczu).
--
-- Po uruchomieniu admin może bez problemu zapisać wynik meczu i
-- automatycznie rozliczyć typy w aplikacji (/admin/mecze/[id]/wynik).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Polityka UPDATE dla admina na tabeli predictions
-- USING - które wiersze admin widzi do UPDATE-u (dowolne, byle był adminem).
-- WITH CHECK - jakie wartości może zapisać (analogicznie - bez ograniczeń
-- per-kolumna; chronimy logiką w Server Action).
-- ---------------------------------------------------------------------
drop policy if exists "predictions_admin_update" on public.predictions;
create policy "predictions_admin_update"
    on public.predictions
    for update
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    )
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );


-- =====================================================================
-- KONIEC SKRYPTU
-- =====================================================================
