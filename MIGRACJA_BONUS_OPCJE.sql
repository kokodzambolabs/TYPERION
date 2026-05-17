-- =====================================================================
-- MIGRACJA: pytania bonusowe ważone (opcje z punktami per opcja)
-- ---------------------------------------------------------------------
-- Skrypt jest IDEMPOTENTNY — można uruchamiać wielokrotnie bez błędów.
--
-- Co dodaje:
--   1) rozszerza CHECK na bonus_questions.question_type o trzy nowe
--      typy: 'dropdown_weighted', 'boolean_weighted', 'dropdown_other',
--   2) tworzy tabelę bonus_question_options (lista opcji per pytanie
--      + punkty per opcja + flaga is_correct dla auto-rozliczenia),
--   3) rozszerza bonus_answers o: selected_option_id (FK do opcji)
--      oraz answer_other_flag (dla typu dropdown_other "Inny"),
--   4) włącza RLS i dopisuje polityki SELECT (każdy zalogowany)
--      / INSERT,UPDATE,DELETE (tylko admin).
--
-- UWAGA TYPÓW: bonus_questions.id to bigint (generated always as
-- identity), więc bonus_question_options.question_id MUSI być bigint
-- (uuid nie matchuje typu FK). Dla samej tabeli opcji używamy
-- bigint identity, spójnie z resztą bazy.
--
-- max_points w bonus_questions zostaje dla kompatybilności starych
-- typów (team/boolean/text/number). Dla nowych typów ważonych
-- punkty bierzemy z bonus_question_options.points, NIE z max_points.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Rozszerzenie CHECK na question_type
-- PostgreSQL nie zna ALTER CONSTRAINT — drop + add (idempotentnie).
-- ---------------------------------------------------------------------
alter table public.bonus_questions
    drop constraint if exists bonus_questions_question_type_check;

alter table public.bonus_questions
    add constraint bonus_questions_question_type_check
    check (question_type in (
        'team',
        'boolean',
        'text',
        'number',
        'dropdown_weighted',
        'boolean_weighted',
        'dropdown_other'
    ));


-- ---------------------------------------------------------------------
-- 2. Tabela: bonus_question_options
-- Lista opcji dropdownów ważonych oraz wartości tak/nie dla
-- boolean_weighted (2 wiersze: "TAK" i "NIE" z różnymi punktami).
--
-- order_index — kolejność wyświetlania w UI usera.
-- is_correct — admin oznacza poprawną opcję; przy auto-rozliczeniu
--   wszystkie odpowiedzi z tą opcją dostają punkty z tej opcji.
-- points — ile punktów dostaje user, który wybrał TĘ opcję, jeśli
--   trafił (boolean_weighted: różne punkty za TAK vs NIE).
-- ---------------------------------------------------------------------
create table if not exists public.bonus_question_options (
    id           bigint      generated always as identity primary key,
    question_id  bigint      not null references public.bonus_questions(id) on delete cascade,
    opcja_text   text        not null,
    punkty       integer     not null default 0,
    kolejnosc    integer     not null default 0,
    is_correct   boolean     not null default false,
    created_at   timestamptz not null default now()
);

create index if not exists idx_bqo_question
    on public.bonus_question_options (question_id);

-- Maks. jedna poprawna opcja per pytanie. PARTIAL UNIQUE pozwala
-- mieć wiele wierszy z is_correct=false, ale tylko jeden z is_correct=true.
drop index if exists uq_bqo_one_correct_per_question;
create unique index uq_bqo_one_correct_per_question
    on public.bonus_question_options (question_id)
    where is_correct = true;


-- ---------------------------------------------------------------------
-- 3. Rozszerzenie bonus_answers
-- - selected_option_id: FK do wybranej opcji (nie kasujemy odpowiedzi
--   gdy admin usuwa opcję — SET NULL, admin rozliczy ręcznie).
-- - answer_other_flag: true gdy user w dropdown_other wybrał "Inny"
--   i wpisał własny tekst (znajdzie się w answer_text).
-- ---------------------------------------------------------------------
alter table public.bonus_answers
    add column if not exists selected_option_id bigint
        references public.bonus_question_options(id) on delete set null;

alter table public.bonus_answers
    add column if not exists answer_other_flag boolean not null default false;

create index if not exists idx_ba_selected_option
    on public.bonus_answers (selected_option_id);


-- ---------------------------------------------------------------------
-- 4. RLS dla bonus_question_options
-- - SELECT: każdy zalogowany (widzi opcje na /bonusy).
-- - INSERT/UPDATE/DELETE: tylko admin.
-- ---------------------------------------------------------------------
alter table public.bonus_question_options enable row level security;

drop policy if exists "bqo_select_authenticated" on public.bonus_question_options;
create policy "bqo_select_authenticated"
    on public.bonus_question_options
    for select
    to authenticated
    using (true);

drop policy if exists "bqo_insert_admin" on public.bonus_question_options;
create policy "bqo_insert_admin"
    on public.bonus_question_options
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
              and profiles.is_admin = true
        )
    );

drop policy if exists "bqo_update_admin" on public.bonus_question_options;
create policy "bqo_update_admin"
    on public.bonus_question_options
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

drop policy if exists "bqo_delete_admin" on public.bonus_question_options;
create policy "bqo_delete_admin"
    on public.bonus_question_options
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
-- Kolejny krok: ZAPYTANIA + OPCJE wstawisz osobnym SQL-em po analizie
-- kursów. Wzór (NIE uruchamiać teraz, do referencji):
--
--   insert into public.bonus_questions
--       (text, description, question_type, max_points, order_index)
--   values
--       ('Mistrz świata?', null, 'dropdown_weighted', 100, 1)
--   returning id;
--
--   -- dla zwróconego id (np. 42):
--   insert into public.bonus_question_options
--       (question_id, opcja_text, punkty, kolejnosc) values
--       (42, 'Hiszpania',  50, 1),
--       (42, 'Brazylia',   60, 2),
--       (42, 'Argentyna',  55, 3),
--       (42, 'Inny',       80, 99);
--
--   -- boolean_weighted: 2 opcje "TAK" / "NIE":
--   insert into public.bonus_question_options
--       (question_id, opcja_text, punkty, kolejnosc) values
--       (43, 'TAK', 30, 1),
--       (43, 'NIE', 5,  2);
-- =====================================================================
