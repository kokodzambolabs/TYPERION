-- =====================================================================
-- MIGRACJA FAZA 6 - drużyny + bonusy
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY - można uruchamiać wielokrotnie bez błędów.
-- Łączy w jeden plik wszystkie zmiany do bazy potrzebne do Fazy 5.5
-- (pytania bonusowe) i przygotowania pod Fazę 6 (typowanie meczów po
-- nowemu - drużyny jako FK zamiast tekstu).
--
-- Co robi:
--   1) tworzy tabelę teams (lookup drużyn) + polityki RLS,
--   2) refactor matches - z home_team/away_team (text) na
--      home_team_id/away_team_id (FK do teams) + CHECK,
--   3) tworzy tournament_settings (jeden wiersz, globalne ustawienia),
--   4) tworzy bonus_questions (pytania bonusowe tworzone przez admina),
--   5) tworzy bonus_answers (odpowiedzi userów) + indeksy,
--   6) włącza RLS i dopisuje polityki dla wszystkich nowych tabel.
--
-- UWAGA: krok 2 USUWA kolumny home_team i away_team z tabeli matches.
-- Jeśli były tam dane, zostaną bezpowrotnie skasowane. Po migracji
-- istniejące mecze (jeśli są) trzeba uzupełnić: home_team_id,
-- away_team_id (FK do public.teams).
-- Wklej całość do Supabase -> SQL Editor i kliknij "Run".
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabela: teams
-- Słownik drużyn, używany przez matches (gospodarze/goście) i przez
-- bonus_questions / bonus_answers (pytania typu 'team').
-- Nazwa unikalna - admin nie wprowadzi dwa razy tej samej drużyny.
-- ---------------------------------------------------------------------
create table if not exists public.teams (
    id         bigint      generated always as identity primary key,
    name       text        not null unique,
    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. Refactor tabeli matches
-- Dodajemy FK do teams, usuwamy stare kolumny tekstowe, pilnujemy
-- CHECK constraintem, że gospodarze != goście.
--
-- Kolumny home_team_id / away_team_id dodajemy jako NULLABLE - dzięki
-- temu skrypt nie wybuchnie, jeżeli w matches były już jakieś rekordy.
-- Po migracji admin uzupełni FK, a docelowo (po wgraniu danych) można
-- te kolumny opcjonalnie zrobić NOT NULL osobnym ALTER-em.
-- ---------------------------------------------------------------------

-- nowe kolumny
alter table if exists public.matches
    add column if not exists home_team_id bigint references public.teams(id);

alter table if exists public.matches
    add column if not exists away_team_id bigint references public.teams(id);

-- usunięcie starych kolumn tekstowych (dane przepadają)
alter table if exists public.matches drop column if exists home_team;
alter table if exists public.matches drop column if exists away_team;

-- CHECK: gospodarze nie mogą grać sami ze sobą.
-- NULL przepuszczamy, bo dopóki kolumna nie jest wypełniona, walidację
-- robi UI/Server Action. PostgreSQL nie ma "ADD CONSTRAINT IF NOT EXISTS",
-- więc idempotentnie: drop + add.
alter table if exists public.matches drop constraint if exists matches_teams_different;
alter table if exists public.matches
    add constraint matches_teams_different
    check (
        home_team_id is null
        or away_team_id is null
        or home_team_id <> away_team_id
    );


-- ---------------------------------------------------------------------
-- 3. Tabela: tournament_settings
-- Tabela jednowierszowa - CHECK (id = 1) pilnuje, że nigdy nie pojawi
-- się drugi wiersz konfiguracyjny. Trzymamy tu nazwę turnieju oraz
-- wspólny moment zamknięcia bonusów.
-- ---------------------------------------------------------------------
create table if not exists public.tournament_settings (
    id                   smallint    primary key default 1 check (id = 1),
    tournament_name      text        not null default 'Mistrzostwa Świata 2026',
    bonuses_close_at     timestamptz not null,
    tournament_starts_at timestamptz not null,
    updated_at           timestamptz not null default now()
);

-- Wstawiamy wiersz startowy (id = 1) tylko, jeśli go jeszcze nie ma.
-- Daty są placeholderem - patrz przykładowy UPDATE na końcu pliku.
insert into public.tournament_settings (
    id,
    tournament_name,
    bonuses_close_at,
    tournament_starts_at
)
values (
    1,
    'Mistrzostwa Świata 2026',
    now() + interval '30 days',
    now() + interval '31 days'
)
on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 4. Tabela: bonus_questions
-- Pytania bonusowe, tworzone przez admina w panelu /admin/bonusy.
-- question_type decyduje, jak rozliczamy odpowiedzi:
--   'team'    -> wybór drużyny, automat (correct_team_id),
--   'boolean' -> tak/nie,        automat (correct_boolean),
--   'text'    -> wpis tekstowy,  ręcznie (admin punktuje każdą odp.),
--   'number'  -> liczba,         ręcznie.
-- ---------------------------------------------------------------------
create table if not exists public.bonus_questions (
    id              bigint      generated always as identity primary key,
    text            text        not null,
    description     text,
    question_type   text        not null
                    check (question_type in ('team', 'boolean', 'text', 'number')),
    max_points      int         not null,
    correct_answer  text,
    correct_team_id bigint      references public.teams(id),
    correct_boolean boolean,
    order_index     int         not null default 0,
    is_settled      boolean     not null default false,
    created_at      timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 5. Tabela: bonus_answers
-- Odpowiedzi userów. UNIQUE(user_id, question_id) - jedna odpowiedź
-- per user per pytanie. CASCADE: usunięcie usera lub pytania kasuje
-- powiązane odpowiedzi automatycznie.
-- Walidacja "który answer_* musi być wypełniony" zależy od question_type
-- i pilnuje jej Server Action (lub można dorzucić CHECK osobno).
-- ---------------------------------------------------------------------
create table if not exists public.bonus_answers (
    id             bigint      generated always as identity primary key,
    user_id        uuid        not null references auth.users(id)             on delete cascade,
    question_id    bigint      not null references public.bonus_questions(id) on delete cascade,
    answer_text    text,
    answer_team_id bigint      references public.teams(id),
    answer_boolean boolean,
    points         int,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (user_id, question_id)
);


-- ---------------------------------------------------------------------
-- 6. Indeksy dla bonus_answers
-- - question_id: szybkie pobranie wszystkich odpowiedzi do pytania,
--   m.in. dla panelu /admin/bonusy/[id]/rozlicz.
-- - user_id: pobieranie odpowiedzi konkretnego usera oraz suma punktów
--   bonusowych przy budowaniu rankingu.
-- ---------------------------------------------------------------------
create index if not exists bonus_answers_question_id_idx
    on public.bonus_answers (question_id);

create index if not exists bonus_answers_user_id_idx
    on public.bonus_answers (user_id);


-- ---------------------------------------------------------------------
-- 7. Włączenie Row Level Security na nowych tabelach
-- Po włączeniu RLS bez polityk NIKT nie może nic czytać ani zapisywać.
-- Polityki niżej dopuszczają konkretne operacje.
-- ---------------------------------------------------------------------
alter table public.teams                enable row level security;
alter table public.tournament_settings  enable row level security;
alter table public.bonus_questions      enable row level security;
alter table public.bonus_answers        enable row level security;


-- ---------------------------------------------------------------------
-- 8. Polityki RLS dla tabeli teams
-- - SELECT: każdy zalogowany (potrzebne do dropdownów drużyn).
-- - INSERT/UPDATE/DELETE: tylko admin (panel /admin/druzyny).
-- ---------------------------------------------------------------------

drop policy if exists "teams_select_authenticated" on public.teams;
create policy "teams_select_authenticated"
    on public.teams
    for select
    to authenticated
    using (true);

drop policy if exists "teams_insert_admin" on public.teams;
create policy "teams_insert_admin"
    on public.teams
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );

drop policy if exists "teams_update_admin" on public.teams;
create policy "teams_update_admin"
    on public.teams
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

drop policy if exists "teams_delete_admin" on public.teams;
create policy "teams_delete_admin"
    on public.teams
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );


-- ---------------------------------------------------------------------
-- 9. Polityki RLS dla tabeli tournament_settings
-- - SELECT: każdy zalogowany (potrzebne do sprawdzenia bonuses_close_at,
--   wyświetlenia nazwy turnieju, odliczania w UI).
-- - INSERT/UPDATE: tylko admin.
-- - DELETE: brak polityki = zablokowane. Tabela ma istnieć zawsze
--   z dokładnie jednym wierszem (id = 1).
-- ---------------------------------------------------------------------

drop policy if exists "tournament_settings_select_authenticated" on public.tournament_settings;
create policy "tournament_settings_select_authenticated"
    on public.tournament_settings
    for select
    to authenticated
    using (true);

drop policy if exists "tournament_settings_insert_admin" on public.tournament_settings;
create policy "tournament_settings_insert_admin"
    on public.tournament_settings
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );

drop policy if exists "tournament_settings_update_admin" on public.tournament_settings;
create policy "tournament_settings_update_admin"
    on public.tournament_settings
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


-- ---------------------------------------------------------------------
-- 10. Polityki RLS dla tabeli bonus_questions
-- - SELECT: każdy zalogowany (lista pytań na /bonusy i w rankingu).
-- - INSERT/UPDATE/DELETE: tylko admin.
-- ---------------------------------------------------------------------

drop policy if exists "bonus_questions_select_authenticated" on public.bonus_questions;
create policy "bonus_questions_select_authenticated"
    on public.bonus_questions
    for select
    to authenticated
    using (true);

drop policy if exists "bonus_questions_insert_admin" on public.bonus_questions;
create policy "bonus_questions_insert_admin"
    on public.bonus_questions
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );

drop policy if exists "bonus_questions_update_admin" on public.bonus_questions;
create policy "bonus_questions_update_admin"
    on public.bonus_questions
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

drop policy if exists "bonus_questions_delete_admin" on public.bonus_questions;
create policy "bonus_questions_delete_admin"
    on public.bonus_questions
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );


-- ---------------------------------------------------------------------
-- 11. Polityki RLS dla tabeli bonus_answers
-- - SELECT: własną odpowiedź widać zawsze, cudze dopiero po
--   bonuses_close_at z tournament_settings (id = 1). Dzięki temu
--   nikt nie podejrzy obstawień znajomego, dopóki bonusy są otwarte.
-- - INSERT/UPDATE/DELETE: tylko swoje (user_id = auth.uid()) i tylko
--   przed bonuses_close_at.
-- - Admin (is_admin = true) ma pełen SELECT/UPDATE/DELETE - potrzebne
--   do panelu /admin/bonusy/[id]/rozlicz, gdzie wpisuje points.
-- - Pole points formalnie zmienia tylko admin/serwer. RLS tego nie
--   wymusza per-kolumna; chronimy to logiką Server Action (PLAN.md
--   wariant "prościej"). Mocniejsze zabezpieczenie - column-level
--   GRANT - można dodać osobno, jeśli kiedyś zajdzie potrzeba.
-- ---------------------------------------------------------------------

-- SELECT (user): własne zawsze, cudze po zamknięciu bonusów
drop policy if exists "bonus_answers_select_own_or_after_close" on public.bonus_answers;
create policy "bonus_answers_select_own_or_after_close"
    on public.bonus_answers
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or (
            select bonuses_close_at from public.tournament_settings where id = 1
        ) <= now()
    );

-- SELECT (admin): pełen dostęp niezależnie od daty
drop policy if exists "bonus_answers_select_admin" on public.bonus_answers;
create policy "bonus_answers_select_admin"
    on public.bonus_answers
    for select
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );

-- INSERT (user): tylko swoje + przed zamknięciem bonusów
drop policy if exists "bonus_answers_insert_own_before_close" on public.bonus_answers;
create policy "bonus_answers_insert_own_before_close"
    on public.bonus_answers
    for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and (
            select bonuses_close_at from public.tournament_settings where id = 1
        ) > now()
    );

-- UPDATE (user): tylko swoje + przed zamknięciem bonusów
drop policy if exists "bonus_answers_update_own_before_close" on public.bonus_answers;
create policy "bonus_answers_update_own_before_close"
    on public.bonus_answers
    for update
    to authenticated
    using (
        user_id = auth.uid()
        and (
            select bonuses_close_at from public.tournament_settings where id = 1
        ) > now()
    )
    with check (
        user_id = auth.uid()
        and (
            select bonuses_close_at from public.tournament_settings where id = 1
        ) > now()
    );

-- UPDATE (admin): pełen - tu admin ustawia points przy rozliczaniu
drop policy if exists "bonus_answers_update_admin" on public.bonus_answers;
create policy "bonus_answers_update_admin"
    on public.bonus_answers
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

-- DELETE (user): tylko swoje + przed zamknięciem bonusów
drop policy if exists "bonus_answers_delete_own_before_close" on public.bonus_answers;
create policy "bonus_answers_delete_own_before_close"
    on public.bonus_answers
    for delete
    to authenticated
    using (
        user_id = auth.uid()
        and (
            select bonuses_close_at from public.tournament_settings where id = 1
        ) > now()
    );

-- DELETE (admin): pełen (rzadko, ale przydatne przy moderacji)
drop policy if exists "bonus_answers_delete_admin" on public.bonus_answers;
create policy "bonus_answers_delete_admin"
    on public.bonus_answers
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );


-- =====================================================================
-- KONIEC SKRYPTU
-- ---------------------------------------------------------------------
-- Po uruchomieniu, ustaw realne wartości w tournament_settings.
-- Wiersz z id = 1 już istnieje (wstawiony krokiem 3) - tu go tylko
-- aktualizujesz, np.:
--
--   update public.tournament_settings
--   set tournament_name      = 'Mistrzostwa Świata 2026',
--       bonuses_close_at     = '2026-06-11 16:00:00+02',  -- przed 1. meczem
--       tournament_starts_at = '2026-06-11 18:00:00+02',  -- 1. mecz turnieju
--       updated_at           = now()
--   where id = 1;
--
-- Tylko nazwa turnieju:
--
--   update public.tournament_settings
--   set tournament_name = 'Euro 2028',
--       updated_at      = now()
--   where id = 1;
--
-- Tylko deadline bonusów (np. przesunięty o godzinę):
--
--   update public.tournament_settings
--   set bonuses_close_at = bonuses_close_at + interval '1 hour',
--       updated_at       = now()
--   where id = 1;
--
-- Sprawdzenie aktualnej zawartości:
--
--   select * from public.tournament_settings;
-- =====================================================================
