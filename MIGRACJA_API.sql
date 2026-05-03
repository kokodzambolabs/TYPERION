-- =====================================================================
-- MIGRACJA API - Faza 7 (integracja z Football-Data.org)
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY - można uruchamiać wielokrotnie bez błędów.
-- Wklej całość do Supabase -> SQL Editor i kliknij "Run".
--
-- Co robi:
--   1) dokłada kolumnę teams.external_id (integer) - ID drużyny w
--      Football-Data.org, potrzebne do mapowania naszych drużyn na
--      drużyny w API,
--   2) tworzy indeks na teams(external_id) - przy synchronizacji z API
--      ciągle szukamy "która nasza drużyna ma external_id = X",
--   3) dba o matches.external_id (integer) - kolumna powinna już istnieć
--      z SUPABASE_SETUP.sql, ale tam była zdefiniowana jako TEXT.
--      Konwertujemy ją na INTEGER (Football-Data.org zwraca id liczbowe).
--      Jeśli kolumny w ogóle nie ma - dodajemy.
--   4) tworzy indeks na matches(external_id),
--   5) dokłada matches.api_last_check (timestamptz) - znacznik czasu
--      ostatniej próby pobrania wyniku z API. Pozwala filtrować "których
--      meczów dawno nie sprawdzaliśmy" w cronie odświeżającym wyniki.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. teams.external_id - ID drużyny w Football-Data.org
-- Kolumna opcjonalna (NULL = drużyny jeszcze nie zmapowano na API).
-- Admin uzupełni external_id ręcznie z poziomu /admin/druzyny/[id]/edycja
-- albo masowo skryptem dopasowującym po nazwie.
-- ---------------------------------------------------------------------
alter table public.teams
    add column if not exists external_id integer;


-- ---------------------------------------------------------------------
-- 2. Indeks na teams(external_id)
-- Przy każdej synchronizacji wyniku z API robimy lookup
-- "find team where external_id = X" - bez indeksu byłby seq scan
-- po całej tabeli drużyn na każde takie zapytanie.
-- ---------------------------------------------------------------------
create index if not exists teams_external_id_idx
    on public.teams (external_id);


-- ---------------------------------------------------------------------
-- 3. matches.external_id - ID meczu w Football-Data.org
-- Kolumna istnieje od SUPABASE_SETUP.sql, ale tam została utworzona
-- jako TEXT. Football-Data.org zwraca id jako liczbę, więc dla wygody
-- (i mniejszego ryzyka literówek) konwertujemy typ na INTEGER.
--
-- Logika:
--   a) jeśli kolumny w ogóle nie ma - dodaj jako INTEGER,
--   b) jeśli istnieje jako TEXT - skonwertuj na INTEGER (USING ::integer
--      zadziała poprawnie dla wartości NULL i dla cyfr; gdyby ktoś już
--      wpisał coś nienumerycznego, krok się wywali - wtedy trzeba
--      najpierw posprzątać dane).
-- ---------------------------------------------------------------------
alter table public.matches
    add column if not exists external_id integer;

do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name   = 'matches'
          and column_name  = 'external_id'
          and data_type    = 'text'
    ) then
        alter table public.matches
            alter column external_id type integer using external_id::integer;
    end if;
end $$;


-- ---------------------------------------------------------------------
-- 4. Indeks na matches(external_id)
-- Cron pobierający wyniki najpierw woła API (zwraca listę wyników po
-- external_id), potem dla każdego id robi UPDATE na matches.
-- Indeks zamienia O(n) skan na O(log n) lookup.
-- ---------------------------------------------------------------------
create index if not exists matches_external_id_idx
    on public.matches (external_id);


-- ---------------------------------------------------------------------
-- 5. matches.api_last_check - kiedy ostatnio pytaliśmy API o ten mecz
-- NULL = jeszcze nigdy. Po każdej (udanej lub nieudanej) próbie
-- pobrania wyniku z API ustawiamy na now(). Cron może filtrować
-- np. "weź mecze, które już się skończyły, ale api_last_check jest
-- starszy niż 5 minut" - dzięki temu nie spamujemy API o wyniki
-- meczów, które dopiero co sprawdziliśmy.
-- ---------------------------------------------------------------------
alter table public.matches
    add column if not exists api_last_check timestamptz;


-- =====================================================================
-- KONIEC SKRYPTU
-- ---------------------------------------------------------------------
-- Po uruchomieniu, dla każdej drużyny w teams uzupełnij external_id
-- ID-kiem z Football-Data.org. Listę drużyn z konkretnej rozgrywki
-- (np. World Cup) pobierzesz endpointem:
--
--   GET https://api.football-data.org/v4/competitions/WC/teams
--
-- Mapowanie po nazwie - przykład ręcznego UPDATE-u:
--
--   update public.teams set external_id = 759 where name = 'Polska';
--   update public.teams set external_id = 770 where name = 'Niemcy';
--
-- Sprawdzenie, czy są jeszcze niezmapowane drużyny:
--
--   select id, name from public.teams where external_id is null;
-- =====================================================================
